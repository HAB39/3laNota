const CACHE_NAME = '3laNota-POS-v1';
const urlsToCache = [
  '/3laNota/',
  '/3laNota/styles.css',
  '/3laNota/scripts.js',
  '/3laNota/index.html',
  '/3laNota/db.js',
  '/3laNota/jspdf.umd.min.js',
  '/3laNota/logo_512.png',
  '/3laNota/logo_192.png',
  '/3laNota/PdfReports.js'
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