// public/sw.js
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const title = data.title || 'New Campus Ride Request!'
  const options = {
    body: data.message || 'A rider is waiting for dispatch.',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || '/driver' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes('/driver') && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url)
      }
    })
  )
})