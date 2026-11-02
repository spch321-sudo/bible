#!/usr/bin/env node
/* 冒煙測試：每種語言冷啟動 → 只載入自己的語言包 → 無頁面錯誤 → 介面標題正確；再從繁中逐一切換所有語言。
   用法：node scripts/smoke.js [chrome路徑]   （需要 playwright 與 chromium） */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
(async () => {
  await new Promise(ok => srv.listen(0, ok)); const base = 'http://localhost:' + srv.address().port + '/index.html';
  const LANGS = 'zh zs en ko ja id tl my vi th ms ar he el pt fa sw ta am uk bn hi ne ceb es fr de it ru'.split(' ');
  const PACK = new Set(LANGS.filter(l => !['zh', 'zs', 'en'].includes(l)));
  const b = await chromium.launch(process.argv[2] ? { executablePath: process.argv[2] } : {});
  let bad = 0;
  for (const l of LANGS){
    const c = await b.newContext({ viewport: { width: 420, height: 860 }, serviceWorkers: 'block' });
    await c.addInitScript(`localStorage.setItem('ib_state', JSON.stringify({lang:'${l}'}))`);
    const pg = await c.newPage(); const errs = [], packs = [];
    pg.on('pageerror', e => errs.push(String(e)));
    pg.on('request', r => { const m = r.url().match(/\/lang-([a-z]+)\.js/); if (m && m[1] !== 'pf') packs.push(m[1]); });
    await pg.goto(base); await pg.waitForSelector('nav.tabbar', { timeout: 20000 });
    const app = await pg.evaluate(() => t().app);
    const good = !errs.length && app && (PACK.has(l) ? packs.length === 1 && packs[0] === l : packs.length === 0);
    console.log((good ? '✓ ' : '✗ ') + l + ' ' + app + ' packs=' + JSON.stringify(packs) + (errs.length ? ' ERR ' + errs[0] : ''));
    if (!good) bad++; await c.close();
  }
  const c = await b.newContext({ viewport: { width: 420, height: 860 }, serviceWorkers: 'block' }); const pg = await c.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(base); await pg.waitForSelector('nav.tabbar');
  for (const l of LANGS){
    await pg.evaluate(x => switchLang(x), l); await pg.waitForTimeout(400);
    const st = await pg.evaluate(x => [state.lang, !!I18N[x]], l);
    if (st[0] !== l || !st[1]){ console.log('✗ 切換失敗 ' + l); bad++; }
  }
  /* 讀經：開約翰福音 3 章，經文要有內容 */
  await pg.evaluate(() => switchLang('en')); await pg.waitForTimeout(400);
  const txt = await pg.evaluate(async () => { await loadTOC(); const s = await loadShard('en', 'nt'); return JSON.stringify(s.John[2]).length; });
  if (!(txt > 500)){ console.log('✗ 約翰福音 3 章內容異常'); bad++; }
  if (errs.length){ console.log('✗ 切換過程出現錯誤：' + errs[0]); bad++; }
  await b.close(); srv.close();
  console.log(bad ? '\n失敗 ' + bad + ' 項' : '\n冒煙測試全部通過'); process.exit(bad ? 1 : 0);
})();
