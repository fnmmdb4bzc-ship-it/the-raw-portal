// The Raw Portal: shows phone notifications sent by the reminder engine and opens the right page when tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const url = d.url || '#home';
  e.waitUntil(self.registration.showNotification(d.title || 'The Raw Portal', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    tag: url,
    renotify: true,
    data: { url }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || '#home';
  const url = new URL('./' + hash, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.postMessage({ url: hash }); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
