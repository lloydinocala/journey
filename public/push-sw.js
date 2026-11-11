/* Journey push notifications — loaded into the Workbox service worker via importScripts. */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'Journey'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-32.png',
    data: { url: data.url || '/tech/field' },
  }
  if (data.tag) { options.tag = data.tag; options.renotify = true }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/tech/field', self.location.origin).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const same = wins.filter((w) => w.url.startsWith(self.location.origin))
    const win = same.find((w) => w.focused) || same[0]
    if (win) {
      try { await win.focus() } catch (e) { /* ignore */ }
      try { if ('navigate' in win) { await win.navigate(target); return } } catch (e) { /* fall through */ }
      win.postMessage({ type: 'push-navigate', url: target })
      return
    }
    await self.clients.openWindow(target)
  })())
})
