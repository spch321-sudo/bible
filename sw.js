/* 321互動聖經 — Service Worker
   每次改動內容或程式，務必把 VERSION 往上加（也要同步 app.js 的 VERSION 與 version.json），
   否則已安裝的使用者不會看到更新。 */
const VERSION = 'ib-v2.64.0';
const VER = 'v2.64.0';
/* v2.61.0：整本經文檔（bible.<語言>.<分卷>.json）改存在獨立的快取 DATA_CACHE，不跟著程式版本一起清掉——
   以前每次更新版本，已經下載、預先存好的經文都被清空，離線閱讀等於重來。
   名稱不能以 ib- 開頭（更新時會清掉 ib- 開頭的快取）。經文檔內容若有改動，要把這個名稱的數字加 1，舊的會在 activate 時自動刪除。 */
const DATA_CACHE = 'bible-data-v1';
/* v2.56.0：語言包不再全部預先快取，改為用到才下載並快取（見下方 fetch 處理） */
const SHELL = [
  './', './index.html', './app.js', './xzm.js', './qrcode.js', './manifest.json', './toc.json', './plans.json', './cover.jpg', './hero.jpg', './wxpay.jpg',
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
    caches.keys().then(ks => Promise.all(ks.filter(k => (k.indexOf('ib-') === 0 && k !== VERSION) || (k.indexOf('bible-data-') === 0 && k !== DATA_CACHE)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type:'window', includeUncontrolled:true }))
      .then(cs => cs.forEach(c => {
        try{ if (c.url.indexOf(self.registration.scope) === 0) c.postMessage({ t:'sw-updated', v:VER }); }catch(_){}
        /* 背景中的頁面直接帶到新版——連沒有自動更新程式碼的舊頁面也一樣；前景頁面交給頁面自己處理 */
        if (c.visibilityState === 'hidden' && c.url.indexOf(self.registration.scope) === 0){ try{ c.navigate(c.url); }catch(_){} }
      }))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skip' || e.data === 'skipWaiting') self.skipWaiting();
  else if (e.data && e.data.t === 'prefetch' && /^[a-z]{2,3}$/.test(e.data.lang || '')) e.waitUntil(prefetchLang(e.data.lang));
});

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
  // 那個壞掉的版本會被「快取命中」永遠鎖住。
  if (/bible\.[a-z]+\.[a-z0-9]+\.json$/.test(url.pathname) || url.pathname.endsWith('toc.json') || url.pathname.endsWith('plans.json')){
    e.respondWith(dataFetch(req, /bible\.[a-z]+\.[a-z0-9]+\.json$/.test(url.pathname)));
    return;
  }

  /* 其餘（網頁、程式、設定）：network-first 並用 cache:'no-cache' 重新驗證，離線才回落到快取；
     導覽請求的快取鍵固定為 ./index.html，帶 ?u= 的更新網址也不會塞滿快取。
     v2.58.3：網路太慢（超過 SHELL_WAIT（1 秒）還沒回應）時，若快取裡有「完全相同」的那一份，就先用快取開起來，
     網路那一份照樣繼續下載並更新快取；弱網路也不必乾等。只有導覽請求才可以退回 index.html，
     程式檔絕不拿 index.html 頂替（否則會把網頁當成 JS 執行而整個壞掉）。 */
  const nav = req.mode === 'navigate';
  const key = nav ? './index.html' : req;
  e.respondWith(shellFetch(req, key, nav));
});

/* 經文檔：先查獨立的 DATA_CACHE，再查舊版本的快取（搬過去），都沒有才連網並存進 DATA_CACHE；toc／plans 仍跟程式版本走 */
async function dataFetch(req, isShard){
  const dc = await caches.open(DATA_CACHE);
  let hit = await dc.match(req, { ignoreSearch:true });
  if (hit) return hit;
  const vc = await caches.open(VERSION);
  hit = await vc.match(req);
  if (hit){ if (isShard) dc.put(req, hit.clone()).catch(() => {}); return hit; }
  const res = await fetch(req);
  if (res.ok) (isShard ? dc : vc).put(req, res.clone()).catch(() => {});
  return res;
}

const SHELL_WAIT = 1000;
async function shellFetch(req, key, nav){
  const net = fetch(req, { cache:'no-cache' }).then(res => {
    if (res.ok){
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(key, copy)).catch(() => {});
    }
    return res;
  });
  /* 預先快取的程式檔存的是不帶 ?v= 的網址，所以程式檔比對時忽略查詢字串（快取本身以版本命名，不會拿到舊版） */
  const exact = () => caches.match(key, nav ? undefined : { ignoreSearch:true });
  const anyHit = () => exact().then(hit => hit || (nav ? caches.match('./index.html') : undefined));
  try{
    const first = await Promise.race([net, new Promise(ok => setTimeout(() => ok(null), SHELL_WAIT))]);
    if (first) return first;
    const hit = await exact();
    if (hit){ net.catch(() => {}); return hit; }   // 慢：先用快取，網路那份繼續下載更新
    return await net;                                // 快取沒有：只能等網路
  }catch(err){
    const hit = await anyHit();                      // 離線／網路錯誤：照舊退回快取
    if (hit) return hit;
    throw err;
  }
}

/* v2.58.3：把「當前語言」的整本經文在閒置時先存進快取，之後完全離線也能讀。
   由頁面在空閒時送來 {t:'prefetch', lang}；已快取的跳過，單次下載量設上限，失敗就算了（讀到時仍會即時下載）。 */
const PREFETCH_BUDGET = 4 * 1024 * 1024;
async function prefetchLang(lang){
  try{
    const c = await caches.open(DATA_CACHE);
    let used = 0;
    for (const s of ['nt', 'law', 'hist', 'poet', 'proph']){
      const u = './bible.' + lang + '.' + s + '.json';
      if (await c.match(u)) continue;
      if (used > PREFETCH_BUDGET) break;
      const r = await fetch(u);
      if (!r.ok) continue;
      used += Number(r.headers.get('content-length')) || 600 * 1024;
      await c.put(u, r);
    }
  }catch(err){ /* 沒存成就算了，讀到的時候照常下載 */ }
}

/* 音樂卡片做好的通知：點一下回到 App */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(cs => {
    for (const c of cs){ if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
