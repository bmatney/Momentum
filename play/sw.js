// Generated from the complete web build. Updates activate only after existing clients close.
const CACHE = 'momentum-play-63d9d3a89c70af7f';
const PREFIX = 'momentum-play-';
const ASSETS = ["assets/index-BZNdE7W4.js","assets/index-CUKXtTRc.css","assets/logo-BQSJUUh_.png","assets/web-Cn9_RJaQ.js","assets/web-D2VnehbF.js","assets/web-D7FeRhZ9.js","assets/web-DZdD2XOs.js","assets/web-DqxgXONL.js","fonts/BarlowCondensed-Bold.ttf","fonts/OFL.txt","fonts/SOURCE.md","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","index.html","manifest.webmanifest","vite.svg"];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const key = event.request.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : event.request;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
