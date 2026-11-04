/* 美圖工作室測試（v2.63.0）：一鍵調整、輸出格式（有相片 JPEG／無相片 PNG）、預覽固定。 */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type':types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };
(async () => {
  await new Promise(o => srv.listen(0, o));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args:['--no-sandbox'] });
  const pg = await (await b.newContext({ viewport:{ width:390, height:800 }, serviceWorkers:'block' })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript("localStorage.setItem('ib_state',JSON.stringify({lang:'zh'}))");
  await pg.goto('http://localhost:' + srv.address().port + '/index.html'); await pg.waitForSelector('nav.tabbar');
  await pg.evaluate(() => { studioItem = { t:'耶和華是我的牧者，我必不至缺乏。他使我躺臥在青草地上，領我到可安歇的水邊。他使我的靈魂甦醒，為自己的名引導我走義路。我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。', ref:'詩篇 23:1-4' }; studioNote = '今天不用焦慮，牧者已經安排好一切，我只要跟著祂走，不必害怕。'; state.cardSize = 's'; state.cardFs = 1.45; go('#/studio'); });
  await pg.waitForSelector('#cardPv img');
  ok(await pg.evaluate(() => /^data:image\/png/.test(cardOut)), '無相片輸出 PNG');
  await pg.click('.sttabs button[data-st=lay]');
  await pg.click('#cardAuto'); await pg.waitForTimeout(600);
  const a = await pg.evaluate(() => ({ sz:state.cardSize, fs:state.cardFs, ov:cardOverflow }));
  ok(a.ov === '', '一鍵調整後放得下（' + a.sz + ' / ' + a.fs + '）'); ok(a.sz !== 's' || a.fs !== 1.45, '一鍵調整有改動尺寸或字級');
  await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 600; c.getContext('2d').fillRect(0, 0, 400, 600); const i = new Image(); i.onload = () => { photoImg = i; photoMode = 'bg'; renderCard(studioItem); }; i.src = c.toDataURL(); });
  await pg.waitForFunction(() => /^data:image\/jpeg/.test(cardOut || ''));
  ok(true, '有相片輸出 JPEG');
  ok(errs.length === 0, '沒有頁面錯誤 ' + errs.join('|'));
  await b.close(); srv.close(); if (fail) process.exit(1); console.log('studio-test OK');
})();
