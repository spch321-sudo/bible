/* 美圖版面測試（v2.62.0）：長短經文 × 5 尺寸 × 字級 × 範本 × 有無相片，
   檢查：文字行不重疊、範本輔助色對比 ≥ 4.5、相片遮罩後文字對比 ≥ 4.5。 */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.png':'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()){ r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type':types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise(o => srv.listen(0, o));
  const base = 'http://localhost:' + srv.address().port + '/index.html';
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args:['--no-sandbox'] });
  const pg = await (await b.newContext({ viewport:{ width:390, height:800 }, serviceWorkers:'block' })).newPage();
  await pg.goto(base); await pg.waitForSelector('nav.tabbar');
  const res = await pg.evaluate(async () => {
    state.lang = 'zh';
    const rec = []; const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(t, x, y){ rec.push([t, y, parseFloat(this.font.match(/(\d+(\.\d+)?)px/)[1])]); return orig.apply(this, arguments); };
    const mk = (a, z) => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 800); g.addColorStop(0, a); g.addColorStop(1, z); x.fillStyle = g; x.fillRect(0, 0, 600, 800); return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = c.toDataURL(); }); };
    const photos = { none:null, dark:await mk('#050a14', '#101820'), bright:await mk('#fff6c8', '#ffffff'), mid:await mk('#808080', '#707070') };
    const verses = {
      short:{ t:'神愛世人，甚至將他的獨生子賜給他們，叫一切信他的，不至滅亡，反得永生。', ref:'約翰福音 3:16', n:'神愛我，這是我的盼望。' },
      long:{ t:'耶和華是我的牧者，我必不至缺乏。他使我躺臥在青草地上，領我到可安歇的水邊。他使我的靈魂甦醒，為自己的名引導我走義路。我雖然行過死蔭的幽谷，也不怕遭害，因為你與我同在；你的杖，你的竿，都安慰我。', ref:'詩篇 23:1-4', n:'今天不用焦慮，牧者已經安排好一切，我只要跟著祂走，不必害怕，因為祂與我同在。' } };
    const bad = [], warn = {}; let n = 0;
    photoMode = 'bg'; stkImg = null;
    for (const tp of Object.keys(CARD_TPL)) for (const sz of Object.keys(CARD_SIZES)) for (const fs of [1, 1.45, 1.7]) for (const vk in verses) for (const pk in photos){
      state.cardTpl = tp; state.cardSize = sz; state.cardFs = fs; photoImg = photos[pk]; studioItem = verses[vk]; studioNote = verses[vk].n;
      rec.length = 0; const [W, H] = CARD_SIZES[sz]; const cv = document.createElement('canvas');
      drawVerseCard(cv, verses[vk], Math.round(W / 2), Math.round(H / 2)); n++;
      const rows = rec.slice().sort((a, c) => a[1] - c[1]);
      for (let i = 1; i < rows.length; i++){
        const dy = rows[i][1] - rows[i - 1][1];
        if (dy > 1 && dy < Math.min(rows[i][2], rows[i - 1][2]) * .8) bad.push([tp, sz, fs, vk, pk, 'overlap', rows[i - 1][0].slice(0, 6), rows[i][0].slice(0, 6), Math.round(dy)].join(' '));
      }
      if (cardOverflow) warn[cardOverflow] = (warn[cardOverflow] || 0) + 1;
      /* 相片遮罩後的對比 */
      if (photos[pk]){
        const T = CARD_TPL[tp], bg = hexRGB(T.bg[1]), al = scrimAlphas(photos[pk], T, bg), inkL = relLum(...hexRGB(T.ink));
        const c = document.createElement('canvas'); c.width = 8; c.height = 12; const x = c.getContext('2d'); coverDraw(x, photos[pk], 0, 0, 8, 12); const d = x.getImageData(0, 0, 8, 12).data;
        for (let k = 0; k < 3; k++) for (let row = k * 4; row < k * 4 + 4; row++) for (let col = 0; col < 8; col++){
          const i = (row * 8 + col) * 4, a = al[k], L = relLum(d[i] * (1 - a) + bg[0] * a, d[i + 1] * (1 - a) + bg[1] * a, d[i + 2] * (1 - a) + bg[2] * a);
          const cr = (Math.max(L, inkL) + .05) / (Math.min(L, inkL) + .05);
          if (cr < 4.5 && a < .9) bad.push([tp, pk, 'scrim contrast', cr.toFixed(2)].join(' '));
        }
      }
    }
    const subLow = [];
    for (const tp in CARD_TPL){ const T = CARD_TPL[tp], sL = relLum(...hexRGB(T.sub)); for (const bgc of [T.bg[1], T.bg[2]]){ const L = relLum(...hexRGB(bgc)); const cr = (Math.max(L, sL) + .05) / (Math.min(L, sL) + .05); if (cr < 4.5) subLow.push(tp + ' ' + cr.toFixed(2)); } }
    return { n, bad: [...new Set(bad)].slice(0, 20), badCount: bad.length, warn, subLow };
  });
  console.log('cards', res.n, 'overflow-flagged', JSON.stringify(res.warn));
  let fail = false;
  if (res.subLow.length){ console.log('FAIL 範本輔助色對比不足', res.subLow); fail = true; }
  if (res.badCount){ console.log('FAIL', res.badCount, res.bad); fail = true; }
  await b.close(); srv.close();
  if (fail) process.exit(1); console.log('card-test OK');
})();
