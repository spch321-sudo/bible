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


  /* ───── v2.77 逐字顯示（串流）───── */
  const enc = o => 'event: ' + o.type + '\ndata: ' + JSON.stringify(o) + '\n\n';
  const sse = (texts, stop) => enc({ type:'message_start', message:{ id:'m' } }) + enc({ type:'content_block_start', index:0, content_block:{ type:'text', text:'' } })
    + texts.map(t => enc({ type:'content_block_delta', index:0, delta:{ type:'text_delta', text:t } })).join('') + enc({ type:'content_block_stop', index:0 })
    + enc({ type:'message_delta', delta:{ stop_reason: stop || 'end_turn' } }) + enc({ type:'message_stop' });
  const body = sse(['平安，', '這是「約翰福音」', '的回答。'], 'end_turn');

  /* readSSE：把串流在「任意位元組」切開（含中文字被切一半），結果仍要正確、而且是逐步長出來的 */
  const rs = await pg.evaluate(async (b) => {
    const bytes = new TextEncoder().encode(b); const chunks = []; for (let i = 0; i < bytes.length; i += 7) chunks.push(bytes.slice(i, i + 7));
    const resp = new Response(new ReadableStream({ start(c){ chunks.forEach(x => c.enqueue(x)); c.close(); } }), { headers:{ 'content-type':'text/event-stream' } });
    const seen = []; const r = await readSSE(resp, t => seen.push(t), 5000, new AbortController());
    return { out:r.out, stop:r.stop, cut:r.cut, steps:seen };
  }, body);
  ok(rs.out === '平安，這是「約翰福音」的回答。' && rs.stop === 'end_turn' && !rs.cut, '串流被任意切開（含中文字）仍組得回完整內容');
  ok(rs.steps.length === 3 && rs.steps[0] === '平安，' && rs.steps[1].length > rs.steps[0].length, '逐步長出來（' + rs.steps.length + ' 段）');

  /* 中途斷線：保留已收到的，標記 cut */
  const cutR = await pg.evaluate(async (b) => {
    const half = b.slice(0, b.indexOf('這是'));
    const resp = new Response(new ReadableStream({ start(c){ c.enqueue(new TextEncoder().encode(half)); setTimeout(() => c.error(new Error('net')), 30); } }), { headers:{ 'content-type':'text/event-stream' } });
    const r = await readSSE(resp, () => {}, 5000, new AbortController()); return { out:r.out, cut:r.cut };
  }, body);
  ok(cutR.cut === true && cutR.out === '平安，', '中途斷線：已收到的內容保留，並標記被截斷');

  /* chatCall：Worker 回串流 */
  await pg.unroute(apiUrl); const bodies = [];
  await pg.route(apiUrl, async r => { bodies.push(JSON.parse(r.request().postData() || '{}')); await r.fulfill({ status:200, headers:{ 'content-type':'text/event-stream', 'access-control-allow-origin':'*' }, body }); });
  const sr = await pg.evaluate(async () => { const seen = []; const r = await chatCall('s', [{ role:'user', content:'q' }], 'fast', t => seen.push(t)); return { out:r.out, stop:r.stop, n:seen.length }; });
  ok(sr.out === '平安，這是「約翰福音」的回答。' && sr.stop === 'end_turn' && sr.n === 3 && bodies[0].stream === true, 'chatCall 走串流：請求帶 stream:true、逐段回呼');
  /* 沒要串流時不帶 stream；Worker 回 JSON（舊 Worker）也能處理 */
  await pg.unroute(apiUrl);
  await pg.route(apiUrl, async r => { bodies.push(JSON.parse(r.request().postData() || '{}')); await r.fulfill({ status:200, contentType:'application/json', headers:{ 'access-control-allow-origin':'*' }, body: JSON.stringify({ content:[{ type:'text', text:'JSON 回答' }], stop_reason:'end_turn' }) }); });
  const jr = await pg.evaluate(async () => { const seen = []; const a = await chatCall('s', [{ role:'user', content:'q' }], 'fast', t => seen.push(t)); const b = await chatCall('s', [{ role:'user', content:'q' }], 'fast'); return [a.out, seen.length, b.out]; });
  ok(jr[0] === 'JSON 回答' && jr[1] === 0 && jr[2] === 'JSON 回答', '舊 Worker（只回 JSON）仍能用，一次顯示');
  ok(bodies[bodies.length - 1].stream === undefined, '沒給回呼就不要求串流');

  /* sendChat 全流程：畫面上第一個字出現後，整頁只重畫一次，之後只更新內文，最後變成完整回答 */
  await pg.unroute(apiUrl);
  await pg.route(apiUrl, async r => { await r.fulfill({ status:200, headers:{ 'content-type':'text/event-stream', 'access-control-allow-origin':'*' }, body }); });
  await pg.evaluate(() => { location.hash = '#/companion'; }); await pg.waitForSelector('#chatIn');
  await pg.evaluate(() => { window.__pc = 0; const o = paintChat; window.paintChat = function(){ window.__pc++; return o.apply(this, arguments); }; });
  await pg.evaluate(() => sendChat('今天讀哪一章？')); await pg.waitForTimeout(900);
  const fin = await pg.evaluate(() => ({ t: chatLog[chatLog.length - 1].text, ok: chatLog[chatLog.length - 1].ok, cont: !!chatLog[chatLog.length - 1].cont, busy: chatBusy, dom: (document.querySelector('.msg.ai:last-of-type .msg-body') || {}).textContent || '' }));
  ok(fin.t === '平安，這是「約翰福音」的回答。' && fin.ok === true && !fin.cont && !fin.busy, 'sendChat 全流程：最後是完整、成功的回答');
  ok(fin.dom.indexOf('約翰福音') > -1, '畫面上看得到回答內容');

  /* 自備金鑰（xzkey）不會因為 stream 旗標被繞過 */
  await pg.unroute(apiUrl);
  let proxyHit = 0, gHit = 0;
  await pg.route(apiUrl, async r => { proxyHit++; await r.fulfill({ status:200, contentType:'application/json', headers:{ 'access-control-allow-origin':'*' }, body: '{"content":[{"type":"text","text":"shared"}]}' }); });
  await pg.route(/generativelanguage\.googleapis\.com/, async r => { gHit++; await r.fulfill({ status:200, contentType:'application/json', headers:{ 'access-control-allow-origin':'*' }, body: JSON.stringify({ candidates:[{ content:{ parts:[{ text:'own key' }] }, finishReason:'STOP' }] }) }); });
  await pg.evaluate(() => localStorage.setItem('xzkey_v1', JSON.stringify({ on:true, key:'AIzaTEST', model:'gemini-3.5-flash' })));
  const xk = await pg.evaluate(async () => { const a = await chatCall('s', [{ role:'user', content:'q' }], 'fast', () => {}); return a.out; });
  ok(xk === 'own key' && gHit === 1 && proxyHit === 0, '自備金鑰開啟時，即使要求串流也走自己的 Gemini（不耗共用額度）');
  await pg.evaluate(() => localStorage.removeItem('xzkey_v1'));

  /* 預設長度「短」與一次性遷移 */
  const lenOf = async init => { const c = await b.newContext({ serviceWorkers:'block' }); const p = await c.newPage(); await p.addInitScript("localStorage.setItem('ib_state'," + JSON.stringify(JSON.stringify(init)) + ")"); await p.goto('http://localhost:' + srv.address().port + '/index.html'); await p.waitForSelector('nav.tabbar'); const v = await p.evaluate(() => state.alen); await c.close(); return v; };
  ok(await lenOf({ lang:'zh' }) === 's', '全新使用者預設長度＝短');
  ok(await lenOf({ lang:'zh', alen:'mid' }) === 's', '舊使用者停在預設的「中」→ 一次性改成「短」');
  ok(await lenOf({ lang:'zh', alen:'mid', alenSet:true }) === 'mid', '自己點選過「中」的人維持不變');
  ok(await lenOf({ lang:'zh', alen:'long' }) === 'long', '選過「長」的人維持不變');

  ok(errs.length === 0, '沒有 JS 錯誤' + (errs.length ? '：' + errs[0] : ''));
  await b.close(); srv.close(); console.log(fail ? '\n✗ 有 ' + fail + ' 項失敗' : '\n全部通過'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
