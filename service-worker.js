const CACHE_NAME = 'chronohit-v1';
const STATIC_ASSETS = [
  '/', '/index.html',
  '/assets/chronohit.css', '/assets/logo.svg',
  '/assets/ga-loader.js', '/assets/ads-loader.js',
  '/assets/utils.js', '/assets/share.js',
  '/games/stroop-blitz/index.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)).then(()=> self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))).then(()=> self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Network-first for HTML
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy));
      return res;
    }).catch(()=> caches.match(req)));
    return;
  }

  // Cache-first for static
  e.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    if (res.ok && (req.method === 'GET')) {
      const copy = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(req, copy));
    }
    return res;
  })));
});
