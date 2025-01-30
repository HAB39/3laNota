const CACHE_NAME = '3laNota-POS-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/scripts.js',
  '/index.html',
  '/db.js',
  '/jspdf.umd.min.js',
  '/PdfReports.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
