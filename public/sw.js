// public/sw.js

// Ensure the service worker takes control immediately upon activation
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

  const title = data.title || '🛺 New Ride Request!'
  const body = data.body || data.message || 'A new student ride is available in the queue.'
  const rideId = data.rideId || 'ride-alert'

  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    // Strong alert pattern: 300ms buzz, 100ms pause, 400ms buzz, 100ms pause, 400ms buzz
    vibrate: [300, 100, 400, 100, 400],
    tag: `ride-${rideId}`,
    renotify: true,
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
      // 1. Focus an existing driver window or tab if already open
      for (const client of windowClients) {
        if (client.url.includes('/driver') && 'focus' in client) {
          return client.focus()
        }
      }
      // 2. Otherwise open the driver dashboard in a new tab/window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})