// public/sw.js
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

  const options = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [300, 150, 300, 150, 300],
    tag: data.rideId || 'ride-alert',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/driver',
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/driver'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing driver dashboard tab if open
      for (const client of windowClients) {
        if (client.url.includes('/driver') && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})