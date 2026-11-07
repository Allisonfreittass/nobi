// Service worker do Nobi: só cuida das notificações (não guarda páginas em cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Nobi', body: event.data?.text() || '' }; }
  const title = data.title || 'Nobi';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icon/nobi-icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || 'nobi',
    renotify: data.tag === 'reminder',
    data: { url: data.url || '/' },
    lang: 'pt-BR',
  }));
});

// Tocar na notificação abre (ou traz para frente) o app na tela certa
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      if ('navigate' in open) return open.navigate(url);
      return undefined;
    }
    return self.clients.openWindow(url);
  })());
});
