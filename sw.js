/* 321互動聖經 — Service Worker
   每次改動內容或程式，務必把 VERSION 往上加（也要同步 app.js 的 VERSION 與 version.json），
   否則已安裝的使用者不會看到更新。 */
const VERSION = 'ib-v2.16.2';
const VER = 'v2.16.2';

const SHELL = [
  './', './index.html', './app.js', './manifest.json', './toc.json', './plans.json', './cover.jpg',
  './icon-72.png', './icon-96.png', './icon-128.png', './icon-144.png',
  './icon-152.png', './icon-180.png', './icon-192.png', './icon-384.png', './icon-512.png', './icon-maskable-192.png', './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  /* 逐一用 cache:'reload' 抓，繞過 GitHub Pages 約 10 分鐘的 HTTP 快取，確保存進來的是新檔 */
  e.waitUntil(caches.open(VERSION).then(c =>
    Promise.all(SHELL.map(u => fetch(new Request(u, { cache:'reload' })).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})))
  ));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type:'window', includeUncontrolled:true }))
      .then(cs => cs.forEach(c => {
        try{ c.postMessage({ t:'sw-updated', v:VER }); }catch(_){}
        /* 背景中的頁面直接帶到新版——連沒有自動更新程式碼的舊頁面也一樣；前景頁面交給頁面自己處理 */
        if (c.visibilityState === 'hidden'){ try{ c.navigate(c.url); }catch(_){} }
      }))
  );
});

self.addEventListener('message', e => { if (e.data === 'skip' || e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // TTS / 陪讀 等外部請求不攔截
  /* 音訊、影片與帶 Range 標頭的請求一律不攔截，否則試聽、拖曳、錄影混音都會壞 */
  if (req.headers.has('range') || /\.(mp3|m4a|aac|wav|ogg|opus|flac|mp4|mov|webm)$/i.test(url.pathname)) return;

  if (url.pathname.endsWith('/version.json')){
    e.respondWith(fetch(req, { cache:'no-store' }).catch(() =>
      new Response('{}', { headers:{ 'Content-Type':'application/json' } })));
    return;
  }

  // 經文資料：cache-first（讀過一次即可離線）
  // 注意：只有 res.ok（HTTP 200系列）才寫進快取——網路不穩、GitHub Pages
  // 剛部署完那幾秒偶爾會回傳 404／5xx 或不完整的內容，若不判斷就整包存進去，
  // 那個壞掉的版本會被「快取命中」永遠鎖住，使用者之後每次都讀到同一份壞檔，
  // 得等到下次 VERSION 再往上加才會被清掉。
  if (/bible\.[a-z]+\.[a-z0-9]+\.json$/.test(url.pathname) || url.pathname.endsWith('toc.json') || url.pathname.endsWith('plans.json')){
    e.respondWith(
      caches.open(VERSION).then(c =>
        c.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok) c.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  /* 其餘（網頁、程式、設定）：network-first 並用 cache:'no-cache' 重新驗證，離線才回落到快取；
     導覽請求的快取鍵固定為 ./index.html，帶 ?u= 的更新網址也不會塞滿快取 */
  const nav = req.mode === 'navigate';
  const key = nav ? './index.html' : req;
  e.respondWith(
    fetch(req, { cache:'no-cache' }).then(res => {
      if (res.ok){
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(key, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(key).then(hit => hit || caches.match('./index.html')))
  );
});

/* 音樂卡片做好的通知：點一下回到 App */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs => {
    for (const c of cs){ if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
