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
    try {
      data = JSON.parse(event.data.text())
    } catch {
      data = {
        action: 'notify',
        title: '🛺 New Ride Request!',
        body: event.data.text() || 'A rider is waiting for dispatch on campus.',
      }
    }
  }

  const rideId = String(data.rideId || data.record?.id || 'ride-alert')
  const tag = `ride-${rideId}`

  // 1. Silent Dismissal: If ride was accepted, cancelled, or flagged to dismiss
  const isDismissal =
    data.action === 'dismiss' ||
    data.status === 'accepted' ||
    data.status === 'cancelled'

  if (isDismissal) {
    event.waitUntil(
      self.registration.getNotifications().then((notifications) => {
        const closePromises = []
        for (const notification of notifications) {
          if (notification.tag === tag || notification.data?.rideId === rideId) {
            closePromises.push(notification.close())
          }
        }
        return Promise.all(closePromises)
      })
    )
    return // Explicitly terminate so NO new notification is shown
  }

  // 2. Only show alert for new incoming rides
  const title = data.title || '🛺 New Ride Request!'
  const body = data.body || data.message || 'A new student ride is available in the queue.'

  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [300, 100, 400, 100, 400],
    tag,
    renotify: false, // Prevents duplicate re-alert sounds/banners for the same ride
    requireInteraction: true,
    data: {
      url: data.url || '/driver',
      rideId,
    },
    actions: [
      { action: 'view', title: 'View Ride' },
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