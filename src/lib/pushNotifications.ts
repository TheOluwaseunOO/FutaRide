// src/lib/pushNotifications.ts
import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeDriverToPush(driverId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported by this browser.')
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidPublicKey) {
      console.warn('Missing VITE_VAPID_PUBLIC_KEY in environment variables.')
      return
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
    }

    const rawSub = subscription.toJSON()
    if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) return

    await supabase.from('driver_push_subscriptions').upsert(
      {
        driver_id: driverId,
        endpoint: rawSub.endpoint,
        p256dh: rawSub.keys.p256dh,
        auth: rawSub.keys.auth,
      },
      { onConflict: 'endpoint' }
    )
  } catch (err) {
    console.error('Failed to subscribe driver to push:', err)
  }
}