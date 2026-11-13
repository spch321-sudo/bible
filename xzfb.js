/* ═════════════════════════════════════════════════════════════════
   xzfb.js v1 — 小智「備援網址」通用模組（ES5，無相依）

   為什麼：小智的主網址 xiaozhi-proxy.spch321.workers.dev 是 Cloudflare 的免費 workers.dev 網域，
   中國大陸部分地區／電信商連不上。本模組讓 App 在主網址失敗時，自動改用「備援網址」
   （例如綁在自己網域上的 api.你的網域），不必改任何呼叫端。

   做法：包住 window.fetch。凡是 POST 到 xiaozhi-proxy 的請求，
     · 沒設定備援網址（BACKUPS 為空）→ 完全照舊，一行都不動；
     · 有備援網址 → 先用「上次成功的網址」，連不上（網路錯誤、502／503／504／52x）就換下一個，
       成功的網址記在手機（localStorage：xzfb_v1，24 小時內優先使用）。
   必須比 xzkey.js、app.js 先載入（xzkey 的「改回國度共用小智」也會經過這裡）。

   設定備援網址：
     ① 正式：把網址填進下面的 BACKUPS（改檔、發新版）。
     ② 測試：在那支手機的瀏覽器主控台執行
          localStorage.setItem('xzfb_backups', JSON.stringify(['https://api.example.com']))
        （備援網址上必須部署跟主網址一樣的 Worker，並允許 CORS）。
   查狀態：XZFB.status()
   ═════════════════════════════════════════════════════════════════ */
(function () {
  if (window.XZFB) return;
  var PRIMARY = 'https://xiaozhi-proxy.spch321.workers.dev';
  /* ← 備援網址填這裡，例如 'https://xz.你的網域.com'（不要結尾斜線）。留空＝不啟用 */
  var BACKUPS = [];
  var MEM = 'xzfb_v1', KEEP = 24 * 3600 * 1000, SLOW = 20000;
  var PROXY = /^https?:\/\/xiaozhi-proxy\.spch321\.workers\.dev(\/|$|\?)/;
  var GATEWAY = { 502: 1, 503: 1, 504: 1, 521: 1, 522: 1, 523: 1, 524: 1, 530: 1 };
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  var lastUsed = '';

  function clean(u) { return String(u || '').replace(/\/+$/, ''); }
  function list() {
    var extra = [];
    try { var o = JSON.parse(localStorage.getItem('xzfb_backups') || '[]'); if (o && o.length) extra = o; } catch (e) { }
    var all = [PRIMARY], seen = {}; seen[PRIMARY] = 1;
    var src = BACKUPS.concat(extra);
    for (var i = 0; i < src.length; i++) {
      var u = clean(src[i]);
      if (/^https:\/\//.test(u) && !seen[u]) { seen[u] = 1; all.push(u); }
    }
    return all;
  }
  function mem() { try { return JSON.parse(localStorage.getItem(MEM) || '{}') || {}; } catch (e) { return {}; } }
  function remember(u) { try { localStorage.setItem(MEM, JSON.stringify({ u: u, t: new Date().getTime() })); } catch (e) { } }
  function order(all) {
    var m = mem();
    if (m.u && new Date().getTime() - (m.t || 0) < KEEP) {
      var i = all.indexOf(m.u);
      if (i > 0) return [m.u].concat(all.slice(0, i), all.slice(i + 1));
    }
    return all;
  }
  /* 把請求網址的主網址前綴換成別的端點 */
  function swap(url, to) { return to + url.replace(PROXY, function (m, tail) { return tail === '/' ? '/' : (tail === '?' ? '?' : ''); }); }

  function wrapped(input, init) {
    var url = (typeof input === 'string') ? input : '';
    var method = String((init && init.method) || 'GET').toUpperCase();
    if (!origFetch || !url || method !== 'POST' || !PROXY.test(url)) return origFetch ? origFetch(input, init) : Promise.reject(new Error('fetch'));
    var all = list();
    if (all.length < 2) return origFetch(input, init);
    var seq = order(all), sig = init && init.signal, n = 0;

    function attempt() {
      var base = seq[n], t0 = new Date().getTime();
      var u = (base === PRIMARY) ? url : swap(url, base);
      function fail(err, res) {
        /* 使用者自己取消：不換網址。等很久才被逾時中止：多半是這個網址被擋，記下來下次先走別的 */
        var slow = new Date().getTime() - t0 >= SLOW;
        var cancelled = sig && sig.aborted;
        if (cancelled && !slow) { if (err) throw err; return res; }
        if (cancelled && slow) { memFail(base, all); if (err) throw err; return res; }
        n++;
        if (n < seq.length) return attempt();
        if (err) throw err;
        return res;
      }
      return origFetch(u, init).then(function (res) {
        if (res && GATEWAY[res.status]) return fail(null, res);
        lastUsed = base; remember(base);
        return res;
      }, function (err) { return fail(err); });
    }
    return attempt();
  }
  /* 逾時被中止時，把「下一個」網址記成優先，讓使用者重問就走備援 */
  function memFail(bad, all) {
    var i = all.indexOf(bad);
    if (all.length > 1) remember(all[(i + 1) % all.length]);
  }

  if (origFetch) window.fetch = wrapped;
  window.XZFB = {
    status: function () { var m = mem(); return { endpoints: list(), preferred: m.u || PRIMARY, lastUsed: lastUsed }; },
    _list: list
  };
})();
