/* 321互動聖經 — Service Worker
   每次改動內容或程式，務必把 VERSION 往上加，
   否則已安裝的使用者不會看到更新。 */
const VERSION = 'ib-v2.3.0';

const SHELL = [
  './', './index.html', './app.js', './manifest.json', './toc.json', './cover.jpg',
  './icon-72.png', './icon-96.png', './icon-128.png', './icon-144.png',
  './icon-152.png', './icon-180.png', './icon-192.png', './icon-384.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // TTS / 陪讀 等外部請求不攔截

  // 經文資料：cache-first（讀過一次即可離線）
  if (/bible\.[a-z]+\.[a-z0-9]+\.json$/.test(url.pathname) || url.pathname.endsWith('toc.json')){
    e.respondWith(
      caches.open(VERSION).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))
      )
    );
    return;
  }

  // 其餘：network-first，離線時回落到快取
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
