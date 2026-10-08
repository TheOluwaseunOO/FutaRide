// src/lib/pushNotifications.ts
import { supabase } from './supabase'

// Fallback directly to the verified working key pair if env is not loaded
const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ||
  'BL1c6FxJuHnmk9LiwBJXxcHO5HFug-EksvJNVLwPAM5cj6t0D-OMrJqNLheOxtk6gfGZI-3ofeLEB6wSPiXAvpA'

/**
 * Converts URL-safe base64 string to a Uint8Array buffer required by PushManager
 */
function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Registers the current device's browser service worker and saves its push subscription into Supabase.
 * Exported as subscribeDriverToPush to match DriverDashboard.tsx
 */
export async function subscribeDriverToPush(driverId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false

  // 1. Guard against environments with no Push / ServiceWorker support
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service workers or PushManager not supported on this browser/device.')
    return false
  }

  try {
    // 2. Request / check notification permission
    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }

    if (permission !== 'granted') {
      console.warn('[Push] Notification permission was not granted:', permission)
      return false
    }

    // 3. Ensure Service Worker is registered and ready
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // 4. Retrieve or create push subscription with matched VAPID key
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      const applicationServerKey = urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }

    // 5. Extract cryptographic keys
    const p256dhKey = subscription.getKey('p256dh')
    const authKey = subscription.getKey('auth')

    if (!p256dhKey || !authKey) {
      console.error('[Push] Unable to extract cryptographic keys from subscription.')
      return false
    }

    const p256dh = btoa(String.fromCharCode(...new Uint8Array(p256dhKey)))
    const auth = btoa(String.fromCharCode(...new Uint8Array(authKey)))

    // 6. Upsert subscription into Supabase driver_push_subscriptions table
    const { error } = await supabase
      .from('driver_push_subscriptions')
      .upsert(
        {
          driver_id: driverId,
          endpoint: subscription.endpoint,
          p256dh,
          auth,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('[Push] Database error registering subscription:', error.message)
      return false
    }

    console.log('[Push] Device push subscription synced successfully!')
    return true
  } catch (err: any) {
    console.error('[Push] Error in subscribeDriverToPush:', err?.message || err)
    return false
  }
}

// Named alias in case other components import registerDevicePush
export const registerDevicePush = subscribeDriverToPush