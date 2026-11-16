/* 小智失敗可以重試＋空串流自動改非串流（v2.77.1） */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
(async () => {
  await new Promise(o => srv.listen(0, o));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args:['--no-sandbox'] });
  const ctx = await b.newContext({ viewport:{ width:390, height:800 }, serviceWorkers:'block' });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript("localStorage.setItem('ib_state',JSON.stringify({lang:'zh'}))");
  await pg.goto('http://localhost:' + srv.address().port + '/index.html'); await pg.waitForSelector('nav.tabbar');
  await pg.evaluate(() => { location.hash = '#/companion'; }); await pg.waitForSelector('#chatIn', { timeout: 15000 });
  const apiUrl = await pg.evaluate(() => API.chat); let mode = 'fail'; const log = [];
  await pg.route(apiUrl, async r => { const j = JSON.parse(r.request().postData() || '{}'); log.push({ stream: !!j.stream, mode });
    const H = { 'access-control-allow-origin': '*' };
    if (mode === 'fail') return r.fulfill({ status: 500, headers: H, body: 'x' });
    if (mode === 'emptystream' && j.stream) return r.fulfill({ status: 200, headers: { ...H, 'content-type': 'text/event-stream' }, body: 'data: {"type":"message_start"}\n\ndata: {"type":"message_stop"}\n\n' });
    return r.fulfill({ status: 200, contentType: 'application/json', headers: H, body: JSON.stringify({ content: [{ type: 'text', text: '平安的回答。' }], stop_reason: 'end_turn' }) }); });
  await pg.evaluate(() => { sendChat('我心裡不平安'); });
  await pg.waitForSelector('.msg.ai .retry', { timeout: 30000 });
  ok(true, '失敗後出現「重試」按鈕');
  ok(await pg.evaluate(() => !document.querySelector('.msg.ai [data-a="fav"]')), '失敗訊息不顯示收藏／分享');
  mode = 'ok'; await pg.click('.msg.ai .retry');
  await pg.waitForFunction(() => /平安的回答/.test(document.getElementById('chatlog').innerText), null, { timeout: 15000 });
  const st = await pg.evaluate(() => ({ users: chatLog.filter(m => m.role === 'user').length, ais: chatLog.filter(m => m.role === 'ai' && !m.crisis).length, err: chatLog.some(m => m.err), btn: !!document.querySelector('.retry') }));
  ok(st.users === 1 && st.ais === 1 && !st.err && !st.btn, '重試成功：只剩一組問答，錯誤與按鈕消失 ' + JSON.stringify(st));
  /* 空串流：自動改用非串流 */
  mode = 'emptystream'; log.length = 0;
  await pg.evaluate(() => { sendChat('第二個問題'); });
  await pg.waitForFunction(() => /平安的回答/.test([...document.querySelectorAll('.msg.ai')].pop().innerText), null, { timeout: 20000 });
  ok(log.length >= 2 && log[0].stream === true && log[1].stream === false, '空串流後改用非串流並成功（' + log.map(x => x.stream ? 'S' : 'N').join('') + '）');
  ok(errs.length === 0, '沒有頁面錯誤 ' + errs.slice(0, 2));
  await b.close(); srv.close(); console.log(fail ? 'FAILS ' + fail : 'ALL OK'); process.exit(fail ? 1 : 0);
})();
