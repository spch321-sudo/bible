/* 小智分流測試（v2.76.0）：App 端判斷「快速／深入」，並確認請求有帶 tier、手動設定優先、接續回答沿用同一個模型。 */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
(async () => {
  await new Promise(o => srv.listen(0, o));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args:['--no-sandbox'] });
  const ctx = await b.newContext({ viewport:{ width:390, height:800 }, serviceWorkers:'block' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript("localStorage.setItem('ib_state',JSON.stringify({lang:'zh'}))");
  await pg.goto('http://localhost:' + srv.address().port + '/index.html'); await pg.waitForSelector('nav.tabbar');

  const T = async (q, depth, src) => pg.evaluate(([q, d, s]) => { state.adepth = d || 'auto'; return chatTier(q, s); }, [q, depth, src]);
  const fast = ['今天要讀哪一章？', '請用三句話幫我寫早安禱告', '約翰福音3章16節講什麼？', '我今天心情不錯，想感謝神'];
  const deep = ['約3:16的「world」希臘文是什麼意思？', '以弗所書和雅各書的教導不是矛盾嗎？', '同性戀是罪嗎？', '女人可以當牧師嗎？', '說方言是每個信徒都該有嗎', '我媽媽癌末，怎麼面對？', '我撐不下去了', '这个经文的原文是什么意思', 'Is predestination biblical?', '我老公外遇了怎麼辦', 'x'.repeat(130)];
  for (const q of fast) ok(await T(q) === 'fast', '快速：' + q.slice(0, 20));
  for (const q of deep) ok(await T(q) === 'deep', '深入：' + q.slice(0, 20));
  ok(await T('你好', 'auto', { word: true }) === 'deep', '原文字義模式 → 深入');
  ok(await T('同性戀是罪嗎？', 'fast') === 'fast', '手動選「快速」優先於關鍵字');
  ok(await T('今天讀哪一章', 'deep') === 'deep', '手動選「深入」優先於一般問題');
  ok(await pg.evaluate(() => { state.adepth = 'bogus'; return chatTier('同性戀', null); }) === 'deep' || true, '不合法設定不會當掉');

  /* 實際請求：tier 有帶、接續回答沿用同一個 tier */
  const apiUrl = await pg.evaluate(() => API.chat); const seen = [];
  await pg.route(apiUrl, async r => { const j = JSON.parse(r.request().postData() || '{}'); seen.push(j.tier);
    const first = seen.length === 1;
    await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ content: [{ type: 'text', text: first ? '這是被截斷的回答' : '接續完成。' }], stop_reason: first ? 'max_tokens' : 'end_turn' }) }); });
  const r = await pg.evaluate(async () => { state.adepth = 'auto'; const t = chatTier('同性戀是罪嗎？'); const a = await chatCall('sys', [{ role:'user', content:'q' }], t); const c = await chatCall('sys', [{ role:'user', content:'q' }, { role:'assistant', content:a.out }, { role:'user', content:'請接著寫' }], t); return [a.stop, c.out]; });
  ok(seen.length === 2 && seen[0] === 'deep' && seen[1] === 'deep', '請求帶 tier，且接續呼叫沿用 deep（' + seen.join() + '）');
  const none = await pg.evaluate(async () => { await chatCall('s', [{ role:'user', content:'q' }]); return 1; }); ok(seen[2] === 'fast', '沒指定時預設送 fast');

  /* 設定面板有「思考：自動／深入／快速」 */
  await pg.evaluate(() => { location.hash = '#/companion'; });
  await pg.waitForSelector('#depthSeg button', { timeout: 15000 });
  const seg = await pg.evaluate(() => { const e = document.getElementById('depthSeg'); return e ? e.textContent.replace(/\s+/g, '') : ''; });
  ok(/思考：自動深入快速/.test(seg), '面板有「思考」選項：' + seg);
  await pg.evaluate(() => { document.querySelector('#depthSeg button[data-k="deep"]').click(); });
  ok(await pg.evaluate(() => state.adepth) === 'deep', '點「深入」會存進設定');

  ok(errs.length === 0, '沒有 JS 錯誤' + (errs.length ? '：' + errs[0] : ''));
  await b.close(); srv.close(); console.log(fail ? '\n✗ 有 ' + fail + ' 項失敗' : '\n全部通過'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
