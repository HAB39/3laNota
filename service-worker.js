const CACHE_NAME = '3laNota-POS-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/scripts.js',
  '/index.html',
  '/db.js',
  '/jspdf.umd.min.js',
  '/logo_512.png',
  '/logo_192.png',
  '/PdfReports.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          urlsToCache.map(url => {
            return fetch(url)
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
                }
                return cache.put(url, response);
              })
              .catch(error => {
                console.error(`Failed to cache ${url}:`, error);
              });
          })
        );
      })
      .catch(error => {
        console.error('Failed to cache resources:', error);
      })
  );
});