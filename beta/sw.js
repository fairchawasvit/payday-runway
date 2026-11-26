/* Offline support. Bump VERSION on every release so phones pick up the new files. */
const VERSION = 'beta-runway-30';
const FILES = ['./', 'index.html', 'core.js', 'store.js', 'help.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('beta-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// The page asks the waiting worker to take over when the user taps "Reload".
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
// Cache first: the app works with no signal. Only same-origin app files are handled.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(c => c.match(e.request, { ignoreSearch: true })).then(hit => hit || fetch(e.request)));
});
