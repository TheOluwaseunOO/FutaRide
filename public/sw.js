// public/sw.js

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch (e) {
    data = {
      title: '🛺 New Ride Request!',
      body: event.data.text() || 'A rider is waiting for dispatch on campus.',
    }
  }

  const rideId = data.rideId || data.record?.id || 'ride-alert'
  const tag = `ride-${rideId}`

  // 1. If another driver claimed the ride or it was cancelled, dismiss the notification
  if (data.action === 'dismiss' || data.status === 'accepted' || data.status === 'cancelled') {
    event.waitUntil(
      self.registration.getNotifications({ tag }).then((notifications) => {
        notifications.forEach((notification) => notification.close())
      })
    )
    return
  }

  // 2. Otherwise display new ride notification
  const title = data.title || '🛺 New Ride Request!'
  const body = data.body || data.message || 'A new student ride is available in the queue.'

  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [300, 100, 400, 100, 400],
    tag,
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/driver',
      rideId,
    },
    actions: [
      { action: 'view', title: '👀 View Ride' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/driver'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/driver') && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})