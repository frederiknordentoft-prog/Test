// Kill-switch: en tidligere app registrerede en service worker på site-roden.
// Denne version rydder cachen, afregistrerer sig selv og genindlæser åbne faner,
// så forsiden og alle apps altid serveres frisk fra nettet.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url))
    })(),
  )
})
