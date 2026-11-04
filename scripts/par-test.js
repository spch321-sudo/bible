#!/usr/bin/env node
/* 並讀譯本與離線下載測試（v2.61.0）。
   ① 並讀：節號對齊、不影響朗讀佇列、詩歌／整卷連讀、無效設定自動清掉、手機寬度不爆版。
   ② 離線下載：下載整個語言、更新程式版本後經文仍在、伺服器關掉後仍讀得到、刪除。
   用法：node scripts/par-test.js [chrome路徑]   （需要 playwright 與 chromium） */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
(async () => {
  await new Promise(ok => srv.listen(0, ok)); const base = 'http://localhost:' + srv.address().port + '/index.html';
  const b = await chromium.launch(process.argv[2] ? { executablePath: process.argv[2] } : {});
  let bad = 0; const ck = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra ? '  ' + extra : '')); if (!ok) bad++; };

  /* ---------- ① 並讀 ---------- */
  const c1 = await b.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: 'block' });
  await c1.addInitScript(`if(!localStorage.getItem('ib_state'))localStorage.setItem('ib_state', JSON.stringify({lang:'zh', par:'en'}))`);
  const pg = await c1.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(base); await pg.waitForSelector('nav.tabbar', { timeout: 20000 });
  await pg.evaluate(() => { location.hash = '#/read/John/3'; }); await pg.waitForSelector('#reader .par-tx', { timeout: 15000 });
  const j = await pg.evaluate(() => {
    const n = document.querySelectorAll('#reader .par-tx').length, all = [...document.querySelectorAll('#reader .par-tx')].map(e => e.textContent).join(' ');
    const q = buildQueue(true).map(i => i.text).join('');
    return { n, hasEn: /God so loved the world/.test(all), v16: /16/.test(all), qClean: !/God so loved|Nicodemus/.test(q), hd: !!document.querySelector('.par-hd'),
             sent: document.querySelectorAll('#reader .sent').length, lang: document.querySelector('.par-tx').lang, pvn: document.querySelectorAll('#reader .par-tx .pvn').length };
  });
  ck(j.n === 36 && j.pvn === 36 && j.hasEn && j.v16 && j.lang === 'en', '並讀：約翰福音 3 章 36 節都有英文，節號對齊', '並讀段=' + j.n + ' 節號=' + j.pvn);
  ck(j.qClean && j.sent > 20, '並讀文字不進朗讀佇列（朗讀、畫線只作用在主要語言）');
  ck(j.hd, '章首有「並讀：English／更換」');
  const order = await pg.evaluate(() => { const t = document.querySelector('#reader .par-tx'); const pv = t.previousElementSibling; return t.parentElement.tagName === 'P' && pv && pv.classList.contains('sent') && t.querySelector('.pvn').textContent === '1' && pv.dataset.v === '1'; });
  ck(order, '逐節對照：第 1 節的英文緊接在第 1 節的中文之後');
  await pg.evaluate(() => { location.hash = '#/read/Psalms/23'; }); await pg.waitForFunction(() => document.querySelector('.chtitle') && /23/.test(document.querySelector('.chtitle').textContent) && document.querySelector('#reader .par-tx'), null, { timeout: 15000 });
  const ps = await pg.evaluate(() => ({ n: document.querySelectorAll('#reader .par-tx').length, txt: [...document.querySelectorAll('#reader .par-tx')].map(e => e.textContent).join(' ') }));
  ck(ps.n === 6 && /Lord is my shepherd/i.test(ps.txt), '詩歌體（詩篇 23）：6 節各有並讀文字，放在每節之後', 'n=' + ps.n);
  const fl = await pg.evaluate(async () => { state.flow = true; await render(); const n = document.querySelectorAll('#reader .par-tx').length; state.flow = false; saveState(); return n; });
  ck(fl > 800, '整卷連讀模式也有並讀（約翰福音 879 節）', 'n=' + fl);
  const fit = await pg.evaluate(() => { const t = document.querySelector('.chtoolbar'); return t.scrollWidth <= t.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth; });
  ck(fit, '360 寬手機：朗讀列與頁面不會左右爆版');
  await pg.evaluate(() => { location.hash = '#/read/John/3'; }); await pg.waitForSelector('#reader .par-tx');
  await pg.click('#rdPar'); await pg.waitForSelector('#parMask button[data-l]');
  const sheet = await pg.evaluate(() => ({ n: document.querySelectorAll('#parMask button[data-l]').length, noSelf: ![...document.querySelectorAll('#parMask button[data-l]')].some(b => b.dataset.l === state.lang) }));
  ck(sheet.n === 29 && sheet.noSelf, '並讀選單：不並讀＋其他 28 個語言版本（不含主要語言）', 'n=' + sheet.n);
  await pg.click('#parMask button[data-l="ko"]'); await pg.waitForFunction(() => document.querySelector('.par-tx') && document.querySelector('.par-tx').lang === 'ko', null, { timeout: 15000 });
  ck(await pg.evaluate(() => state.par === 'ko'), '選擇韓文後立即並讀並存起來');
  await pg.evaluate(() => { location.hash = '#/read/John/3'; }); 
  await pg.evaluate(async () => { await switchLang('ko'); await switchLang('zh'); });
  ck(await pg.evaluate(() => state.lang === 'zh'), '切換語言流程正常');
  await pg.evaluate(() => { state.par = 'zh'; saveState(); }); await pg.reload(); await pg.waitForSelector('nav.tabbar');
  ck(await pg.evaluate(() => state.par === ''), '並讀語言等於主要語言時自動關閉');
  await pg.evaluate(() => { localStorage.setItem('ib_state', JSON.stringify({ lang:'zh', par:'xx' })); }); await pg.reload(); await pg.waitForSelector('nav.tabbar');
  ck(await pg.evaluate(() => state.par === ''), '無效的並讀設定被清掉');
  ck(!errs.length, '並讀：沒有頁面錯誤', errs[0] || '');
  await c1.close();

  /* ---------- ② 離線下載 ---------- */
  const c2 = await b.newContext({ viewport: { width: 390, height: 800 } });
  await c2.addInitScript(`if(!localStorage.getItem('ib_state'))localStorage.setItem('ib_state', JSON.stringify({lang:'zh'}))`);
  const p2 = await c2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(String(e)));
  await p2.goto(base); await p2.waitForSelector('nav.tabbar', { timeout: 20000 });
  await p2.evaluate(() => navigator.serviceWorker.ready.then(() => 1)); await p2.waitForTimeout(800);
  const s0 = await p2.evaluate(async () => (await dlStatus()).en);
  await p2.evaluate(() => dlLang('en'));
  const s1 = await p2.evaluate(async () => (await dlStatus()).en);
  ck(s0 === 0 && s1 === 5, '下載：英文五個經文檔存進離線快取', s0 + ' → ' + s1);
  await p2.evaluate(async () => { for (const k of await caches.keys()) if (k.indexOf('ib-') === 0) await caches.delete(k); });   // 模擬程式更新：舊版本快取被清掉
  ck(await p2.evaluate(async () => (await dlStatus()).en === 5 && (await caches.keys()).includes(DATA_CACHE_NAME)), '更新程式版本後，已下載的經文仍在');
  srv.closeAllConnections && srv.closeAllConnections(); srv.close();
  const off = await p2.evaluate(async () => { try{ const r = await fetch('bible.en.nt.json'); const d = await r.json(); return r.ok && !!d.John; }catch(e){ return 'ERR ' + e.message; } });
  ck(off === true, '伺服器關掉（離線）後仍讀得到已下載的經文', String(off));
  await p2.evaluate(() => dlRemove('en'));
  ck(await p2.evaluate(async () => (await dlStatus()).en === 0), '刪除：該語言的經文檔被移除');
  ck(!e2.length, '離線下載：沒有頁面錯誤', e2[0] || '');
  await b.close();
  console.log(bad ? '\n失敗：' + bad + ' 項' : '\n並讀與離線下載測試全部通過'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
