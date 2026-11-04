#!/usr/bin/env node
/* 朗讀測試：① 發音回歸（使用者回報過的字，送去合成的文字必須是這樣）② 快取、失敗回復、語速、切段、睡前定時等機制。
   後端用假的回應取代，不會連到真正的朗讀服務。
   新的錯音回報：先在下面 PRON 表加一列，再改規則。
   用法：node scripts/tts-test.js [chrome路徑]   （需要 playwright 與 chromium） */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => {
  const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
/* [輸入, 應送去合成的文字]（繁體、預設首選聲音＝臺灣國語） */
const PRON = [
  ['大大地祝福他們，地上的走獸', '大大地祝福他們，第上的走獸'],
  ['要長三百肘，寬五十肘', '要常三百肘，寬五十肘'],
  ['撒但試探耶穌，教會的長老', '仨但試探耶穌，叫會的掌老'],
  ['神使乾地露出來，鴿子飛去', '神使甘第露出來，哥子飛去'],
  ['創 1:26 與 詩 23:1-3', '創世記1章26節 與 詩篇23篇1到3節']
];
(async () => {
  await new Promise(ok => srv.listen(0, ok)); const base = 'http://localhost:' + srv.address().port + '/index.html';
  const b = await chromium.launch(process.argv[2] ? { executablePath: process.argv[2] } : {});
  const c = await b.newContext({ viewport: { width: 360, height: 780 }, serviceWorkers: 'block' });
  await c.addInitScript(`localStorage.setItem('ib_state', JSON.stringify({lang:'zh'}))`);
  let hits = 0, mode = 'ok';
  await c.route('https://azure-tts.spch321.workers.dev/**', r => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    hits++;
    if (mode === 'down') return r.abort();
    r.fulfill({ status: 200, contentType: 'audio/mpeg', headers: cors, body: Buffer.alloc(2048, 7) });
  });
  const pg = await c.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(base); await pg.waitForSelector('nav.tabbar', { timeout: 20000 });
  let bad = 0; const ck = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra ? '  ' + extra : '')); if (!ok) bad++; };

  for (const [i, o] of PRON){ const got = await pg.evaluate(x => ttsPrep(x), i); ck(got === o, '發音 ' + i, got === o ? '' : '得到：' + got); }

  const T = 'ttsTestText' + Date.now();
  const v = await pg.evaluate(() => VOICES.zh[0].v);
  const u1 = await pg.evaluate(([t, v]) => ttsFetch(t, v), [T, v]); const h1 = hits; await pg.waitForTimeout(400);
  const u2 = await pg.evaluate(([t, v]) => ttsFetch(t, v), [T, v]);
  ck(h1 === 1 && hits === 1 && u1.startsWith('blob:') && u2.startsWith('blob:'), '快取：同一段第二次不再連後端', 'requests=' + hits);
  const key1 = await pg.evaluate(([t, v]) => ttsKey(v, t), [T, v]), key2 = await pg.evaluate(([t, v]) => ttsKey(v, t + '。'), [T, v]);
  ck(key1 !== key2 && !key1.includes(T), '快取鍵：用雜湊、不含原文');
  ck(await pg.evaluate(async () => (await caches.keys()).includes('tts-audio') && !'tts-audio'.startsWith('ib-')), '快取名稱不會被更新程式清掉');

  mode = 'down'; hits = 0;
  const t0 = Date.now();
  const e1 = await pg.evaluate(([t, v]) => ttsFetch(t, v, true).then(() => 'ok', e => e.message), ['down-a' + T, v]); const d1 = Date.now() - t0;
  ck(e1 !== 'ok' && d1 < 4000, '雲端不通：第一段快速失敗', d1 + ' ms（逾時規則：6 秒、重試 1 次；這裡是立刻拒絕）');
  const t1 = Date.now();
  const e2 = await pg.evaluate(([t, v]) => ttsFetch(t, v).then(() => 'ok', e => e.message), ['down-b' + T, v]);
  ck(e2 === 'cloud paused' && Date.now() - t1 < 500, '雲端不通：20 秒內其餘各段立刻改裝置語音');
  const e3 = await pg.evaluate(([t, v]) => ttsFetch(t, v).then(() => 'ok', e => e.message), [T, v]);
  ck(e3 === 'ok', '雲端不通：已存的音檔仍可離線播放');
  mode = 'ok'; await pg.evaluate(() => { ttsDownUntil = 0; });
  ck(await pg.evaluate(([t, v]) => ttsFetch(t, v).then(() => true, () => false), ['back' + T, v]), '雲端恢復：自動回到雲端語音');

  const sp = await pg.evaluate(() => ttsSplitText('甲'.repeat(100) + '。' + '乙'.repeat(100) + '。' + '丙'.repeat(100) + '。', 250));
  ck(sp.length === 2 && sp.every(x => x.length <= 250) && sp.join('').length === 303, '長回答切段：不超過 250 字、不漏字', sp.map(x => x.length).join('+'));
  const sp2 = await pg.evaluate(() => ttsSplitText('丁'.repeat(900), 250));
  ck(sp2.join('').length === 900 && sp2.every(x => x.length <= 500), '長回答切段：沒有標點也不卡住');
  ck(await pg.evaluate(() => ttsWeight('你好，世界。') > '你好，世界。'.length), '標亮權重：逗號句號計入停頓');

  const rates = await pg.evaluate(() => { const o = []; [0.85, 1, 1.2, 3, 'x'].forEach(r => { state.ttsRate = r; o.push(ttsRateNow()); }); state.ttsRate = 1; return o; });
  ck(rates.join() === '0.85,1,1.2,1,1', '語速：只接受慢／標準／快三檔');
  const pr = await pg.evaluate(() => { state.ttsRate = 1.2; const a = new Audio(); ttsApplyRate(a); const r = a.playbackRate + '/' + a.defaultPlaybackRate; state.ttsRate = 1; return r; });
  ck(pr === '1.2/1.2', '語速：套用到音檔的播放速率');

  await pg.evaluate(() => { location.hash = '#/read/John/3'; }); await pg.waitForSelector('#reader .sent', { timeout: 15000 });
  ck(await pg.evaluate(() => !!document.getElementById('rdSleep')), '朗讀列有睡前定時鈕');
  const sl = await pg.evaluate(() => { const o = []; for (let i = 0; i < 5; i++){ ttsSleepCycle(); o.push(ttsSleep.mode + ':' + document.getElementById('rdSleep').textContent + ':' + (ttsSleep.t ? 1 : 0)); } ttsSleepClear(); return o.join(' '); });
  ck(/^1:⏲15:1 2:⏲30:1 3:⏲60:1 4:⏲章:0 0:⏲:0$/.test(sl), '睡前定時：依序切換並設好計時器', sl);
  const box = await pg.evaluate(() => { const g = document.querySelector('.tts-group').getBoundingClientRect(); return { r: g.right, w: innerWidth }; });
  ck(box.r <= box.w, '朗讀列在 360 寬的手機上不會超出畫面', 'right=' + Math.round(box.r) + ' / ' + box.w);
  const q = await pg.evaluate(() => { const items = buildQueue(true); return items.length; });
  const jump = await pg.evaluate(async () => {
    const items = buildQueue(true); const g = ++ttsGen;
    spk = { on:true, paused:false, items, idx:2, audio:null, cache:{}, native:false, abort:false, gen:g, first:2, failed:false, toasted:false };
    let to = -1; const orig = ttsPlayFrom; ttsPlayFrom = (i, gg) => { to = i; spk.gen === gg || (to = -99); };
    ttsJump(-1); const a = to; ttsJump(1); const b2 = to; ttsPlayFrom = orig; spk.on = false; return a + ',' + b2;
  });
  ck(q > 1 && jump === '1,3', '鎖屏上一段／下一段：移到相鄰的段落', 'jump=' + jump);

  await pg.evaluate(() => { location.hash = '#/me'; }); await pg.waitForTimeout(600);
  const setRows = await pg.evaluate(() => !!document.getElementById('setRate') && document.querySelectorAll('#setRate button').length);
  ck(setRows === 3, '設定頁有三檔朗讀速度');

  ck(!errs.length, '沒有頁面錯誤', errs[0] || '');
  await b.close(); srv.close();
  console.log(bad ? '\n失敗：' + bad + ' 項' : '\n朗讀測試全部通過'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
