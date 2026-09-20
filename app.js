/* ============================================================================
   321互動聖經 — 和合本．去章節．只留經文
   國度321空中團契 ／ 架構沿用《321領導力》App
   ----------------------------------------------------------------------------
   ⚙ 端點與請求格式：與《321領導力》／《晨讀321》共用同一組 Cloudflare Worker，
      request/response 契約已照 321領導力 app.js 實際使用的格式對齊。
   ========================================================================== */
const API = {
  chat: 'https://xiaozhi-proxy.spch321.workers.dev',   // {system, messages:[{role,content}]}
  tts : 'https://azure-tts.spch321.workers.dev'        // {voice, rate, sil, silc, sile, text}
};
const TTS_SIL = 140, TTS_SILC = 140, TTS_SILE = 260, TTS_RATE = '+0%';
const VERSION = 'v1.1.5';

/* ---------------------------------------------------------------- 基本工具 */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = n => (n < 10 ? '0' + n : '' + n);
function toast(msg, ms){
  $$('.uitoast').forEach(e => e.remove());
  const d = document.createElement('div'); d.className = 'uitoast'; d.textContent = msg;
  document.body.appendChild(d); setTimeout(() => d.remove(), ms || 2200);
}

/* ---------------------------------------------------------------- 語言字串 */
const I18N = {
  zh: { app:'321互動聖經', today:'今日', books:'經卷', search:'搜尋', companion:'陪讀', me:'我的',
        ot:'舊約', nt:'新約', ch:'章', chapter:n=>`第 ${n} 章`, verses:'節',
        cont:'繼續閱讀', start:'開始讀經', daily:'今日默想', progress:'讀經進度',
        prev:'上一章', next:'下一章', toc:'目錄', pure:'閱讀方式', note:'註釋',
        modes:['分章','整卷連讀'], chnum:'章節標示', onoff:['顯示','隱藏'],
        modeHint:['一章一章讀，讀完按下一章','整卷接成一篇，一口氣讀完'],
        chnumHint:['每章開頭有淡雅的章題','完全看不到章號，純粹的經文'],
        prevBk:'上一卷', nextBk:'下一卷', bookDone:'已讀完這一卷',
        bm:'書籤', bmAdd:'已加書籤', bmDel:'已移除書籤', myBm:'我的書籤',
        emptyBm:'還沒有書籤。讀到想記住的地方，按閱讀器上的 🔖 就會把位置記下來。',
        resume:'從上次的地方繼續',
        read:'讀這一章', done:'已讀完本章', markRead:'標記已讀',
        searchPH:'輸入要找的字句…', searchHint:'輸入兩個字以上開始搜尋', noResult:'找不到相符的經文',
        found:n=>`找到 ${n} 節`, loading:'載入中…',
        hlTitle:'這一句', hlColor:'顏色', hlNote:'寫下默想…', save:'儲存', ask:'問陪讀', del:'刪除畫線', close:'關閉',
        myHl:'我的畫線', myFav:'我的收藏', settings:'設定', font:'字級大小', theme:'主題',
        fonts:['標準','大','特大','超大'], themes:['自動','日','夜','羊皮紙'],
        voice:'朗讀聲音', langLabel:'語言', stats:['已讀章數','畫線','書籤'],
        emptyHl:'還沒有畫線。在經文上點一下就能畫線、寫默想。',
        emptyFav:'還沒有收藏陪讀的回答。',
        chatPH:'就這段經文提問…', send:'送出', examples:'範例問題',
        ctx:(b,c)=>`目前經文：${b} 第 ${c} 章`, thinking:'小智思想中…',
        ttsFallback:'改用裝置內建語音朗讀', ttsErr:'朗讀服務連不上',
        chatErr:'陪讀服務連不上，請稍後再試。' },
  zs: { app:'321互动圣经', today:'今日', books:'经卷', search:'搜索', companion:'陪读', me:'我的',
        ot:'旧约', nt:'新约', ch:'章', chapter:n=>`第 ${n} 章`, verses:'节',
        cont:'继续阅读', start:'开始读经', daily:'今日默想', progress:'读经进度',
        prev:'上一章', next:'下一章', toc:'目录', pure:'阅读方式', note:'注释',
        modes:['分章','整卷连读'], chnum:'章节标示', onoff:['显示','隐藏'],
        modeHint:['一章一章读，读完按下一章','整卷接成一篇，一口气读完'],
        chnumHint:['每章开头有淡雅的章题','完全看不到章号，纯粹的经文'],
        prevBk:'上一卷', nextBk:'下一卷', bookDone:'已读完这一卷',
        bm:'书签', bmAdd:'已加书签', bmDel:'已移除书签', myBm:'我的书签',
        emptyBm:'还没有书签。读到想记住的地方，按阅读器上的 🔖 就会把位置记下来。',
        resume:'从上次的地方继续',
        read:'读这一章', done:'已读完本章', markRead:'标记已读',
        searchPH:'输入要找的字句…', searchHint:'输入两个字以上开始搜索', noResult:'找不到相符的经文',
        found:n=>`找到 ${n} 节`, loading:'载入中…',
        hlTitle:'这一句', hlColor:'颜色', hlNote:'写下默想…', save:'保存', ask:'问陪读', del:'删除划线', close:'关闭',
        myHl:'我的划线', myFav:'我的收藏', settings:'设置', font:'字级大小', theme:'主题',
        fonts:['标准','大','特大','超大'], themes:['自动','日','夜','羊皮纸'],
        voice:'朗读声音', langLabel:'语言', stats:['已读章数','划线','书签'],
        emptyHl:'还没有划线。在经文上点一下就能划线、写默想。',
        emptyFav:'还没有收藏陪读的回答。',
        chatPH:'就这段经文提问…', send:'发送', examples:'范例问题',
        ctx:(b,c)=>`当前经文：${b} 第 ${c} 章`, thinking:'小智思想中…',
        ttsFallback:'改用设备内置语音朗读', ttsErr:'朗读服务连不上',
        chatErr:'陪读服务连不上，请稍后再试。' }
};
const t = () => I18N[state.lang];

/* ---------------------------------------------------------------- 狀態 */
const FONT_CLASS = ['', 'fs-lg', 'fs-xl', 'fs-xxl'];
const THEMES = ['auto', 'light', 'dark', 'sepia'];
const HL_COLORS = ['gold','green','blue','pink','purple','maroon','brown','charcoal'];
const HL_SWATCH = {gold:'#D9B168', green:'#6FAE71', blue:'#6C93D1', pink:'#E58FA0',
                   purple:'#A48AC9', maroon:'#8C4A4E', brown:'#8A6740', charcoal:'#54534E'};
/* 與姊妹App共用的 Azure 真人語音；順序＝預設值在最前（zh 雲哲、zs 云帆） */
const VOICES = {
  zh: [{n:'雲哲', v:'zh-TW-YunJheNeural'},
       {n:'雲帆', v:'zh-CN-Yunfan:DragonHDLatestNeural'},
       {n:'曉辰', v:'zh-CN-Xiaochen:DragonHDLatestNeural'}],
  zs: [{n:'云帆', v:'zh-CN-Yunfan:DragonHDLatestNeural'},
       {n:'云哲', v:'zh-TW-YunJheNeural'},
       {n:'晓辰', v:'zh-CN-Xiaochen:DragonHDLatestNeural'}]
};

const DEFAULTS = { lang:'zh', font:0, theme:0, flow:false, chnum:true, hidenote:false, voice:{zh:0, zs:0} };
/* 「淨」鍵依序切換的四種組合：[整卷連讀?, 顯示章號?] */
const VIEW_CYCLE = [[false, true], [false, false], [true, true], [true, false]];
let state = Object.assign({}, DEFAULTS);
let user  = { progress:{}, hl:{}, fav:[], marks:[], last:null };
let TOC = [], BOOK = {}, SHARD = {};   // SHARD['zh|law'] = {BookId:[chapters]}

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem('ib_state') || '{}');
    state = Object.assign({}, DEFAULTS, s);
    state.voice = Object.assign({}, DEFAULTS.voice, s.voice || {});
    // 舊設定轉換：v1.0.4 的 mode(0分章/1純淨/2整卷)、更早的 pure 開關
    if (s.flow === undefined){
      if (s.mode !== undefined){ state.flow = s.mode === 2; state.chnum = s.mode === 0; }
      else if (s.pure){ state.flow = false; state.chnum = false; }
    }
    delete state.pure; delete state.mode;
    state.flow = !!state.flow; state.chnum = !!state.chnum;
  }catch(e){ state = Object.assign({}, DEFAULTS); }
}
function saveState(){ try{ localStorage.setItem('ib_state', JSON.stringify(state)); }catch(e){} }
function loadUser(){
  try{
    const u = JSON.parse(localStorage.getItem('ib_user') || '{}');
    user = Object.assign({progress:{}, hl:{}, fav:[], marks:[], last:null}, u);
    if (!Array.isArray(user.marks)) user.marks = [];
  }catch(e){}
}
function saveUser(){ try{ localStorage.setItem('ib_user', JSON.stringify(user)); }catch(e){} }

function applyChrome(){
  const h = document.documentElement;
  FONT_CLASS.forEach(c => c && h.classList.remove(c));
  if (FONT_CLASS[state.font]) h.classList.add(FONT_CLASS[state.font]);
  h.classList.toggle('pure', !state.chnum);      // pure = 不顯示章號
  h.classList.toggle('flow', state.flow);
  h.classList.toggle('hidenote', !!state.hidenote);
  const th = THEMES[state.theme] || 'auto';
  if (th === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', th);
  h.setAttribute('lang', state.lang === 'zs' ? 'zh-Hans' : 'zh-Hant');
  h.setAttribute('data-lang', state.lang);
  $('#brandName').textContent = t().app;
  document.title = t().app;
  ['today','books','search','companion','me'].forEach(k => { const e = $('#tab-' + k); if (e) e.textContent = t()[k]; });
  $$('#langswitch button').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
}

/* ---------------------------------------------------------------- 資料 */
/* 讀資料檔。少一個檔就直接說出檔名——不要讓瀏覽器把 404 頁面當成 JSON 去解析，
   那樣只會冒出「The string did not match the expected pattern」這種看不懂的訊息。 */
async function fetchJSON(file){
  let r;
  try{ r = await fetch(file); }
  catch(e){ throw new Error(`讀不到 ${file}（網路問題）`); }
  if (!r.ok) throw new Error(`網站上找不到 ${file}（HTTP ${r.status}）──這個檔還沒上傳`);
  try{ return await r.json(); }
  catch(e){ throw new Error(`${file} 的內容不是有效的 JSON，請重新上傳這個檔`); }
}
async function loadTOC(){
  if (TOC.length) return;
  TOC = await fetchJSON('toc.json');
  TOC.forEach((b, i) => { b.i = i; BOOK[b.id] = b; });
}
async function loadShard(lang, shard){
  const key = lang + '|' + shard;
  if (SHARD[key]) return SHARD[key];
  SHARD[key] = await fetchJSON(`bible.${lang}.${shard}.json`);
  return SHARD[key];
}
async function getBook(bookId){
  const b = BOOK[bookId]; if (!b) return null;
  const d = await loadShard(state.lang, b.shard);
  return d[bookId] || null;
}
async function getChapter(bookId, ch){
  const b = BOOK[bookId]; if (!b) return null;
  const d = await loadShard(state.lang, b.shard);
  const arr = d[bookId]; if (!arr || !arr[ch - 1]) return null;
  return arr[ch - 1];
}
const bname = b => (state.lang === 'zs' ? b.zs : b.zh);
const babbr = b => (state.lang === 'zs' ? b.azs : b.azh);

const GROUPS = [
  { zh:'摩西五經',   zs:'摩西五经',   a:0,  b:5  },
  { zh:'歷史書',     zs:'历史书',     a:5,  b:17 },
  { zh:'詩歌智慧書', zs:'诗歌智慧书', a:17, b:22 },
  { zh:'大先知書',   zs:'大先知书',   a:22, b:27 },
  { zh:'小先知書',   zs:'小先知书',   a:27, b:39 },
  { zh:'福音書與使徒行傳', zs:'福音书与使徒行传', a:39, b:44 },
  { zh:'保羅書信',   zs:'保罗书信',   a:44, b:57 },
  { zh:'一般書信',   zs:'一般书信',   a:57, b:65 },
  { zh:'啟示錄',     zs:'启示录',     a:65, b:66 }
];

/* 今日默想輪替的經卷章（皆為歷代信徒所愛的篇章） */
const DAILY = [
  ['Genesis',1],['Exodus',20],['Psalms',1],['Psalms',23],['Psalms',27],['Psalms',34],
  ['Psalms',37],['Psalms',42],['Psalms',46],['Psalms',51],['Psalms',63],['Psalms',84],
  ['Psalms',90],['Psalms',91],['Psalms',103],['Psalms',119],['Psalms',121],['Psalms',139],
  ['Proverbs',3],['Proverbs',4],['Ecclesiastes',3],['Isaiah',6],['Isaiah',40],['Isaiah',43],
  ['Isaiah',53],['Isaiah',55],['Jeremiah',29],['Lamentations',3],['Ezekiel',36],['Daniel',3],
  ['Micah',6],['Habakkuk',3],['Matthew',5],['Matthew',6],['Matthew',11],['Matthew',28],
  ['Mark',10],['Luke',15],['John',1],['John',3],['John',14],['John',15],['John',17],
  ['Acts',2],['Romans',5],['Romans',8],['Romans',12],['1Corinthians',13],['2Corinthians',4],
  ['Galatians',2],['Galatians',5],['Ephesians',1],['Ephesians',3],['Ephesians',6],
  ['Philippians',2],['Philippians',4],['Colossians',3],['1Thessalonians',5],['2Timothy',2],
  ['Hebrews',11],['Hebrews',12],['James',1],['1Peter',2],['1John',4],['Revelation',21],['Revelation',22]
];
function dailyPick(){
  const d = new Date();
  const day = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  return DAILY[(day + d.getFullYear()) % DAILY.length];
}

/* ---------------------------------------------------------------- 句子切分 */
const SENT_END = /[。！？]/;
function splitSentences(text){
  const out = []; let cur = '';
  for (let i = 0; i < text.length; i++){
    cur += text[i];
    if (SENT_END.test(text[i])){
      // 收尾的引號／括號一併帶入
      while (i + 1 < text.length && '」』）〕'.indexOf(text[i + 1]) >= 0){ cur += text[++i]; }
      out.push(cur); cur = '';
    }
  }
  if (cur) out.push(cur);
  return out;
}
/* 〔…〕為譯者註，淡色顯示，可在設定中隱藏 */
function markNotes(html){
  return html.replace(/〔[^〕]*〕/g, m => `<span class="note">${m}</span>`);
}
const hlKey = (b, c, p, s) => `${b}|${c}|${p}|${s}`;

/* 畫面頂端（避開黏在上面的標題列）的第一句，就是「讀到這裡」 */
function currentAnchor(){
  for (const el of $$('#reader .sent')){
    if (el.getBoundingClientRect().bottom > 84)
      return { c:+el.dataset.c, p:+el.dataset.p, s:+el.dataset.s, t:el.textContent.slice(0, 40) };
  }
  return null;
}
let jumpTo = null;                       // 換頁前先放好要捲到的位置
function anchorEl(a){
  return a ? $(`#reader .sent[data-c="${a.c}"][data-p="${a.p}"][data-s="${a.s}"]`) : null;
}
function scrollToAnchor(a){
  const el = anchorEl(a);
  if (!el) return false;
  requestAnimationFrame(() => {
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo(0, Math.max(0, y));
  });
  return true;
}
function openAt(m){ jumpTo = { c:m.c, p:m.p, s:m.s }; go(`#/read/${m.b}/${m.c}`); }

/* ---------------------------------------------------------------- 路由 */
function go(h){ location.hash = h; }
function currentRoute(){
  const h = (location.hash || '#/today').replace(/^#/, '');
  return h.split('/').filter(Boolean);
}
async function render(){
  const r = currentRoute();
  const tab = r[0] || 'today';
  $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === (tab === 'read' ? 'books' : tab)));
  const v = $('#view');
  try{
    if (tab === 'today')          await viewToday(v);
    else if (tab === 'books')     await viewBooks(v, r[1]);
    else if (tab === 'read')      await viewReader(v, r[1], parseInt(r[2] || '1', 10));
    else if (tab === 'search')    await viewSearch(v);
    else if (tab === 'companion') await viewCompanion(v);
    else if (tab === 'me')        await viewMe(v);
    else { go('#/today'); return; }
  }catch(e){
    v.innerHTML = `<div class="empty">載入失敗：${esc(e.message || e)}</div>`;
    console.error(e);
  }
  if (tab !== 'read') window.scrollTo(0, 0);
}

/* ================================================================ 今日 */
async function viewToday(v){
  const L = t();
  const readCount = Object.keys(user.progress).length;
  const pct = Math.round(readCount / 1189 * 100);
  const [db, dc] = dailyPick();
  const chap = await getChapter(db, dc);
  let excerpt = '';
  if (chap){
    const first = chap.find(bl => bl.length > 1 && bl[0] !== 'd') || chap.find(bl => bl.length > 1);
    const src = first ? first[2] : '';
    const ss = splitSentences(src);
    excerpt = ss.slice(0, 2).join('');
    if (excerpt.length > 110) excerpt = ss[0] || '';
  }
  const last = user.last;
  const lastBook = last && BOOK[last.book];
  const C = 2 * Math.PI * 25;

  v.innerHTML = `
    <div class="hero-cover">
      <img src="cover.jpg" alt="" loading="eager">
      <div class="hc-mask">
        <div class="hc-title">${esc(L.app)}</div>
        <div class="hc-sub">${state.lang === 'zs' ? '新标点和合本 · 去章节 · 只留经文' : '新標點和合本 · 去章節 · 只留經文'}</div>
      </div>
    </div>

    <div class="card">
      <div class="progwrap">
        <svg class="progring" viewBox="0 0 58 58">
          <circle class="bgc" cx="29" cy="29" r="25"></circle>
          <circle class="fgc" cx="29" cy="29" r="25" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"></circle>
          <text x="29" y="33" text-anchor="middle">${pct}%</text>
        </svg>
        <div style="flex:1">
          <h3 style="margin:0">${esc(L.progress)}</h3>
          <div class="muted">${readCount} / 1189 ${esc(L.ch)}</div>
        </div>
      </div>
      <div style="margin-top:14px">
        ${lastBook
          ? `<button class="btn primary block" id="resumeBtn">${esc(L.cont)} · ${esc(bname(lastBook))} ${last.ch}</button>
             ${last.a && last.a.t ? `<div class="muted" style="font-size:12px;margin-top:7px;text-align:center">${esc(L.resume)}：${esc(last.a.t)}…</div>` : ''}`
          : `<a class="btn primary block" href="#/read/Genesis/1">${esc(L.start)}</a>`}
      </div>
    </div>

    <div class="section-title">${esc(L.daily)}</div>
    <div class="card">
      <div class="daily">${markNotes(esc(excerpt))}</div>
      <div class="dailyref">${esc(bname(BOOK[db]))} ${esc(L.chapter(dc))}</div>
      <div style="margin-top:12px"><a class="btn gold block" href="#/read/${db}/${dc}">${esc(L.read)}</a></div>
    </div>

    <div class="section-title">${state.lang === 'zs' ? '快速进入' : '快速進入'}</div>
    <div class="card" style="padding:4px 16px">
      <a class="rowlink" href="#/read/Psalms/${(new Date().getDate() % 150) + 1}">
        <div class="meta"><div class="t">${esc(bname(BOOK['Psalms']))}</div><div class="s">${esc(L.chapter((new Date().getDate() % 150) + 1))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/read/John/1"><div class="meta"><div class="t">${esc(bname(BOOK['John']))}</div><div class="s">${esc(L.chapter(1))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/books"><div class="meta"><div class="t">${esc(L.books)}</div><div class="s">66 ${state.lang === 'zs' ? '卷' : '卷'}</div></div><div class="chev">›</div></a>
    </div>`;

  const rb = $('#resumeBtn', v);
  if (rb) rb.onclick = () => {
    if (last.a) jumpTo = last.a;
    go(`#/read/${last.book}/${last.ch}`);
  };
}

/* ================================================================ 經卷 / 章 */
async function viewBooks(v, bookId){
  const L = t();
  if (bookId && BOOK[bookId]) return viewChapters(v, bookId);
  const tabOT = !(location.hash.indexOf('nt') > -1);
  const html = GROUPS.map(g => {
    const bs = TOC.slice(g.a, g.b);
    return `<details class="grp" ${g.a < 5 || g.a === 39 ? 'open' : ''}>
      <summary><span style="color:var(--gold)">◆</span>${esc(state.lang === 'zs' ? g.zs : g.zh)}<span class="cnt">${bs.length} 卷</span></summary>
      <div class="bklist">${bs.map(b => {
        const done = readOfBook(b.id);
        return `<button class="bkbtn ${done === b.ch ? 'done' : ''}" data-b="${b.id}">${esc(bname(b))}
          <span class="bs">${done ? done + '/' : ''}${b.ch} ${esc(L.ch)}</span></button>`;
      }).join('')}</div></details>`;
  }).join('');
  v.innerHTML = `<div class="section-title">${esc(L.ot)} · ${esc(L.nt)}</div>${html}`;
  $$('.bkbtn', v).forEach(b => b.onclick = () => go('#/books/' + b.dataset.b));
}
function readOfBook(id){
  let n = 0; const b = BOOK[id];
  for (let i = 1; i <= b.ch; i++) if (user.progress[id + '-' + i]) n++;
  return n;
}
async function viewChapters(v, bookId){
  const L = t(), b = BOOK[bookId];
  const cur = user.last && user.last.book === bookId ? user.last.ch : 0;
  v.innerHTML = `
    <div class="chtoolbar"><button class="chtb-btn" id="backBooks">‹</button>
      <div style="flex:1"><div style="font-family:'Noto Serif TC',serif;font-weight:900;font-size:19px">${esc(bname(b))}</div>
      <div class="muted">${b.ch} ${esc(L.ch)} · ${b.v} ${esc(L.verses)}</div></div></div>
    <div class="chgrid">${Array.from({length: b.ch}, (_, i) => {
      const n = i + 1, read = user.progress[bookId + '-' + n];
      return `<button class="chbtn ${n === cur ? 'now' : (read ? 'read' : '')}" data-c="${n}">${n}</button>`;
    }).join('')}</div>`;
  $('#backBooks', v).onclick = () => go('#/books');
  $$('.chbtn', v).forEach(x => x.onclick = () => go(`#/read/${bookId}/${x.dataset.c}`));
}

/* ================================================================ 閱讀器 */
let RD = { book:null, ch:0, data:null, flow:false };

/* 一章 = 若干區塊：['p'|'q1'|'q2'|'d'|'b', 節號, 經文, 節號, 經文…]，
   節號 0 代表這一段是上一節的接續（不另外標號）。
   畫線識別碼用「區塊序號＋句序號」，分章與整卷連讀兩種模式共用同一把 key。 */
const BLOCK_CLASS = { p:'prose', q1:'q1', q2:'q2', d:'dline' };
function chapterHTML(bookId, cno, chap, withHead){
  const bm = new Set(user.marks.filter(m => m.b === bookId && m.c === cno)
                               .map(m => hlKey(m.b, m.c, m.p, m.s)));
  const body = chap.map((bl, bi) => {
    if (bl[0] === 'b') return '<div class="stanza"></div>';
    let inner = '', notes = '', si = 0;
    for (let j = 1; j < bl.length; j += 2){
      const vno = bl[j], txt = bl[j + 1];
      if (vno) inner += `<span class="vn">${vno}</span>`;
      for (const sx of splitSentences(txt)){
        const k = hlKey(bookId, cno, bi, si);
        const h = user.hl[k];
        inner += `<span class="sent" data-c="${cno}" data-p="${bi}" data-s="${si}"`
               + `${h ? ` data-hl="1" data-color="${h.c}"` : ''}${bm.has(k) ? ' data-bm="1"' : ''}`
               + `>${markNotes(esc(sx))}</span>`;
        if (h && h.n) notes += `<div class="hl-note" data-c="${cno}" data-p="${bi}" data-s="${si}" data-color="${h.c}">${esc(h.n)}</div>`;
        si++;
      }
    }
    return `<p class="${BLOCK_CLASS[bl[0]] || 'prose'}" data-c="${cno}" data-p="${bi}">${inner}</p>${notes}`;
  }).join('');
  const unit = bookId === 'Psalms' ? '篇' : '章';
  const head = withHead ? `<h2 class="ch" data-c="${cno}">${'第 ' + cno + ' ' + unit}</h2>` : '';
  return head + body;
}

async function viewReader(v, bookId, ch){
  const L = t(), b = BOOK[bookId];
  if (!b) { go('#/books'); return; }
  ch = Math.min(Math.max(1, ch), b.ch);
  const flow = state.flow;
  const all = await getBook(bookId);
  if (!all) { v.innerHTML = `<div class="empty">讀不到 ${esc(bname(b))}</div>`; return; }
  RD = { book:bookId, ch:ch, data:all[ch - 1], flow:flow };
  user.last = { book:bookId, ch:ch }; saveUser();

  const body = flow
    ? all.map((c, i) => chapterHTML(bookId, i + 1, c, true)).join('')
    : chapterHTML(bookId, ch, all[ch - 1], false);

  const head = flow
    ? `<div class="bk">${esc(L.app)}</div><h1 class="bktitle">${esc(bname(b))}</h1>`
    : `<div class="bk">${esc(bname(b))}</div><h1 class="chtitle">${esc(L.chapter(ch))}</h1>`;

  v.innerHTML = `
    <div class="chtoolbar">
      <button class="chtb-btn" id="rdToc" title="${esc(L.toc)}">☰</button>
      <button class="chtb-btn" id="rdPrev">‹</button>
      <button class="chtb-btn" id="rdNext">›</button>
      <div class="chtb-spacer"></div>
      <button class="chtb-btn" id="rdBm" title="${esc(L.bm)}">🔖</button>
      <button class="chtb-btn ${(state.flow || !state.chnum) ? 'on' : ''}" id="rdMode" title="${esc(L.pure)}">${state.lang === 'zs' ? '净' : '淨'}</button>
      <button class="chtb-btn" id="rdFont">A⁺</button>
      <button class="chtb-btn" id="rdTts">🔊</button>
    </div>
    <div class="chhead">${head}<div class="rule"></div></div>
    <div class="reader" id="reader">${body}</div>
    <div class="chfoot">
      <button class="btn" id="fPrev">${esc(flow ? L.prevBk : L.prev)}</button>
      <button class="btn primary" id="fNext">${esc(flow ? L.nextBk : L.next)}</button>
    </div>
    <div class="readend" id="readEnd"></div>`;

  $('#rdToc').onclick  = () => go('#/books/' + bookId);
  $('#rdBm').onclick   = () => {
    const a = currentAnchor(); if (!a) return;
    const i = user.marks.findIndex(m => m.b === bookId && m.c === a.c && m.p === a.p && m.s === a.s);
    if (i >= 0){ user.marks.splice(i, 1); toast(t().bmDel); }
    else { user.marks.push({ b:bookId, c:a.c, p:a.p, s:a.s, t:a.t, ts:Date.now() }); toast(t().bmAdd); }
    saveUser();
    const el = anchorEl(a);
    if (el){ i >= 0 ? el.removeAttribute('data-bm') : el.setAttribute('data-bm', '1'); }
  };
  $('#rdMode').onclick = () => {
    const now = VIEW_CYCLE.findIndex(([f, c]) => f === state.flow && c === state.chnum);
    const [f, c] = VIEW_CYCLE[(now + 1) % VIEW_CYCLE.length];
    state.flow = f; state.chnum = c; saveState(); applyChrome();
    const L2 = t();
    toast(`${L2.modes[f ? 1 : 0]}・${L2.chnum}${L2.onoff[c ? 0 : 1]}`, 2400);
    render();
  };
  $('#rdFont').onclick = () => { state.font = (state.font + 1) % FONT_CLASS.length; saveState(); applyChrome(); toast(t().fonts[state.font]); };
  $('#rdTts').onclick  = () => ttsToggle();

  const navBook = d => {
    ttsStop();
    const ni = b.i + d;
    if (ni < 0 || ni > 65) return;
    go(`#/read/${TOC[ni].id}/1`);
  };
  const navChap = d => {
    ttsStop();
    let nb = b.i, nc = ch + d;
    if (nc < 1){ nb = b.i - 1; if (nb < 0) return; nc = TOC[nb].ch; }
    if (nc > b.ch){ nb = b.i + 1; if (nb > 65) return; nc = 1; }
    go(`#/read/${TOC[nb].id}/${nc}`);
  };
  const back = () => flow ? navBook(-1) : navChap(-1);
  const fwd  = () => { if (!flow) markRead(bookId, ch); flow ? navBook(1) : navChap(1); };
  $('#rdPrev').onclick = $('#fPrev').onclick = back;
  $('#rdNext').onclick = $('#fNext').onclick = fwd;

  $$('#reader .sent').forEach(el => el.onclick = () => onSentTap(el));
  $$('#reader .hl-note').forEach(el => el.onclick = () => {
    const sel = `#reader .sent[data-c="${el.dataset.c}"][data-p="${el.dataset.p}"][data-s="${el.dataset.s}"]`;
    const sp = $(sel); if (sp) openHlSheet(sp);
  });

  const re = $('#readEnd');
  re.textContent = flow
    ? (readOfBook(bookId) === b.ch ? L.bookDone : '')
    : (user.progress[bookId + '-' + ch] ? L.done : '');

  window.scrollTo(0, 0);
  const want = jumpTo; jumpTo = null;
  if (!(want && scrollToAnchor(want)) && flow && ch > 1){
    const target = $(`#reader p[data-c="${ch}"]`);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block:'start' }));
  }
  watchProgress(bookId, flow, b.ch);
}

/* 讀到哪裡就記到哪裡。分章模式捲到底即算讀完；
   整卷連讀時，一章的最後一段捲過去就記這一章。 */
let progressHandler = null;
function watchProgress(bookId, flow, total){
  if (progressHandler) window.removeEventListener('scroll', progressHandler);
  const lastOf = {};
  if (flow) $$('#reader p[data-c]').forEach(p => { lastOf[p.dataset.c] = p; });
  let tick = 0;
  progressHandler = () => {
    if (Date.now() - tick < 400) return;
    tick = Date.now();
    const atEnd = window.innerHeight + window.scrollY >= document.body.offsetHeight - 160;
    const a = currentAnchor();
    if (a){ user.last = { book:bookId, ch:a.c, a:{ c:a.c, p:a.p, s:a.s } }; saveUser(); }
    if (flow){
      for (const c in lastOf){
        if (user.progress[bookId + '-' + c]) continue;
        if (atEnd || lastOf[c].getBoundingClientRect().bottom < 0) markRead(bookId, +c);
      }
      if (atEnd){
        const re = $('#readEnd');
        if (re && readOfBook(bookId) === total) re.textContent = t().bookDone;
      }
    } else if (atEnd){
      markRead(bookId, RD.ch);
      const re = $('#readEnd'); if (re && !re.textContent) re.textContent = t().done;
    }
  };
  window.addEventListener('scroll', progressHandler, { passive:true });
}

function markRead(bookId, ch){
  const k = bookId + '-' + ch;
  if (!user.progress[k]){ user.progress[k] = Date.now(); saveUser(); }
}
/* ================================================================ 畫線 / 默想 */
function onSentTap(el){
  const cno = +el.dataset.c || RD.ch;
  const k = hlKey(RD.book, cno, el.dataset.p, el.dataset.s);
  if (!user.hl[k]){
    user.hl[k] = { c:'gold', n:'', t:el.textContent, b:RD.book, ch:cno, ts:Date.now() };
    el.setAttribute('data-hl', '1'); el.setAttribute('data-color', 'gold');
    saveUser();
  } else {
    openHlSheet(el);
  }
}
function openHlSheet(el){
  const L = t();
  const k = hlKey(RD.book, +el.dataset.c || RD.ch, el.dataset.p, el.dataset.s);
  const h = user.hl[k]; if (!h) return;
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card">
    <div class="hlsheet-title">${esc(L.hlTitle)}</div>
    <span class="hlsheet-quote">${esc(h.t)}</span>
    <div class="hlsheet-colorrow"><span class="hlsheet-colorlabel">${esc(L.hlColor)}</span>
      <div class="hlsheet-colors">${HL_COLORS.map(c =>
        `<button class="hlswatch ${h.c === c ? 'active' : ''}" data-c="${c}" style="background:${HL_SWATCH[c]}"></button>`).join('')}</div></div>
    <textarea class="hlsheet-ta" placeholder="${esc(L.hlNote)}">${esc(h.n || '')}</textarea>
    <div class="hlsheet-acts">
      <button class="btn primary" data-a="save">${esc(L.save)}</button>
      <button class="btn" data-a="ask">${esc(L.ask)}</button>
    </div>
    <div class="hlsheet-acts2">
      <button class="btn danger" data-a="del">${esc(L.del)}</button>
      <button class="btn" data-a="close">${esc(L.close)}</button>
    </div></div>`;
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  let color = h.c;
  $$('.hlswatch', mask).forEach(b => b.onclick = () => {
    color = b.dataset.c;
    $$('.hlswatch', mask).forEach(x => x.classList.toggle('active', x === b));
  });
  const ta = $('.hlsheet-ta', mask);
  const commit = () => {
    h.c = color; h.n = ta.value.trim(); saveUser();
    mask.remove(); render();
  };
  $$('[data-a]', mask).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'save') commit();
    else if (a === 'close') mask.remove();
    else if (a === 'del'){ delete user.hl[k]; saveUser(); mask.remove(); render(); }
    else if (a === 'ask'){
      h.c = color; h.n = ta.value.trim(); saveUser(); mask.remove();
      chatPending = `${state.lang === 'zs' ? '请就这句经文帮助我默想：' : '請就這句經文幫助我默想：'}「${h.t}」`;
      go('#/companion');
    }
  });
}

/* ================================================================ 搜尋 */
let searchState = { q:'', results:[], busy:false };
async function viewSearch(v){
  const L = t();
  v.innerHTML = `
    <div class="searchbar">
      <input id="sq" type="search" placeholder="${esc(L.searchPH)}" value="${esc(searchState.q)}">
      <button class="btn primary" id="sgo">${esc(L.search)}</button>
    </div>
    <div class="sprog" id="sprog" hidden><i></i></div>
    <div id="sout"></div>`;
  const inp = $('#sq', v);
  const run = () => doSearch(inp.value.trim());
  $('#sgo', v).onclick = run;
  inp.onkeydown = e => { if (e.key === 'Enter') run(); };
  if (searchState.results.length) paintResults();
  else $('#sout', v).innerHTML = `<div class="empty">${esc(L.searchHint)}</div>`;
}
async function doSearch(q){
  const L = t(), out = $('#sout'), prog = $('#sprog');
  searchState.q = q;
  if (q.length < 2){ out.innerHTML = `<div class="empty">${esc(L.searchHint)}</div>`; return; }
  if (searchState.busy) return;
  searchState.busy = true;
  out.innerHTML = `<div class="empty">${esc(L.loading)}</div>`;
  prog.hidden = false;
  const shards = ['law','hist','poet','proph','nt'];
  const res = [];
  for (let i = 0; i < shards.length; i++){
    const d = await loadShard(state.lang, shards[i]);
    $('i', prog).style.width = Math.round((i + 1) / shards.length * 100) + '%';
    for (const bid in d){
      const b = BOOK[bid]; if (!b) continue;
      d[bid].forEach((chap, ci) => {
        chap.forEach(bl => {
          for (let j = 2; j < bl.length; j += 2){
            if (bl[j].indexOf(q) < 0) continue;
            for (const sx of splitSentences(bl[j])){
              if (sx.indexOf(q) >= 0 && res.length < 400)
                res.push({ b:bid, c:ci + 1, x:sx });
            }
          }
        });
      });
    }
    await new Promise(r => setTimeout(r, 0));
  }
  prog.hidden = true;
  searchState.results = res; searchState.busy = false;
  paintResults();
}
function paintResults(){
  const L = t(), out = $('#sout'); if (!out) return;
  const res = searchState.results, q = searchState.q;
  if (!res.length){ out.innerHTML = `<div class="empty">${esc(L.noResult)}</div>`; return; }
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  out.innerHTML = `<div class="muted" style="margin-bottom:8px">${esc(L.found(res.length))}${res.length >= 400 ? '＋' : ''}</div>` +
    res.map((r, i) => `<div class="sres" data-i="${i}">
      <div class="sr">${esc(bname(BOOK[r.b]))} ${esc(L.chapter(r.c))}</div>
      <div class="sx">${esc(r.x).replace(rx, m => '<em>' + m + '</em>')}</div></div>`).join('');
  $$('.sres', out).forEach(e => e.onclick = () => {
    const r = res[+e.dataset.i]; go(`#/read/${r.b}/${r.c}`);
  });
}

/* ================================================================ 陪讀 */
let chatLog = [], chatPending = null, chatBusy = false;
const QBANK = {
  zh: ['這段經文讓我看見神是怎樣的一位神？',
       '這段經文照出我裡面什麼樣的舊人有己？',
       '若讓耶穌在這件事上作王，我會怎麼做？',
       '這段經文中，耶穌給我看見什麼樣的榜樣？',
       '聖靈要藉這段話引導我今天走哪一步？',
       '這裡的人為什麼會失敗？根源是驕傲還是恐懼？',
       '這段經文如何幫助我操練無己的生命？',
       '我可以把這段經文用在與誰的關係上？',
       '這段經文與主禱文「願你的國降臨」有什麼關聯？',
       '請用一個比喻幫我明白這段經文的核心。'],
  zs: ['这段经文让我看见神是怎样的一位神？',
       '这段经文照出我里面什么样的旧人有己？',
       '若让耶稣在这件事上作王，我会怎么做？',
       '这段经文中，耶稣给我看见什么样的榜样？',
       '圣灵要借这段话引导我今天走哪一步？',
       '这里的人为什么会失败？根源是骄傲还是恐惧？',
       '这段经文如何帮助我操练无己的生命？',
       '我可以把这段经文用在与谁的关系上？',
       '这段经文与主祷文「愿你的国降临」有什么关联？',
       '请用一个比喻帮我明白这段经文的核心。']
};
function mdToHtml(s){
  let h = esc(s);
  h = h.replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>')
       .replace(/^#{1,4} (.*)$/gm, '<h4>$1</h4>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  h = h.replace(/^&gt; ?(.*)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^---+$/gm, '<hr>');
  h = h.replace(/^[-*] (.*)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, m => '<ul>' + m + '</ul>');
  return h.split(/\n{2,}/).map(p => /^<(h\d|ul|blockquote|hr)/.test(p.trim()) ? p : '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
}
async function viewCompanion(v){
  const L = t();
  const b = RD.book ? BOOK[RD.book] : null;
  v.innerHTML = `<div class="chatwrap">
      ${b ? `<div class="chatctx">${esc(L.ctx(bname(b), RD.ch))}</div>` : ''}
      <button class="qs-toggle" id="qsBtn">💡 ${esc(L.examples)}</button>
      <div class="qs-panel" id="qsPanel" hidden></div>
      <div class="chatlog" id="chatlog"></div>
      <div class="chatinput">
        <textarea id="chatIn" rows="1" placeholder="${esc(L.chatPH)}"></textarea>
        <button id="chatSend">${esc(L.send)}</button>
      </div></div>`;
  const panel = $('#qsPanel', v);
  panel.innerHTML = QBANK[state.lang].map(q => `<button class="qs-chip">${esc(q)}</button>`).join('');
  $('#qsBtn', v).onclick = () => { panel.hidden = !panel.hidden; };
  $$('.qs-chip', panel).forEach(c => c.onclick = () => { panel.hidden = true; sendChat(c.textContent); });
  paintChat();
  $('#chatSend', v).onclick = () => sendChat($('#chatIn').value);
  $('#chatIn', v).onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendChat(e.target.value); }
  };
  if (chatPending){ const p = chatPending; chatPending = null; sendChat(p); }
}
function paintChat(){
  const log = $('#chatlog'); if (!log) return;
  log.innerHTML = chatLog.map((m, i) => m.role === 'user'
    ? `<div class="msg user">${esc(m.text)}</div>`
    : `<div class="msg ai"><div class="msg-body">${mdToHtml(m.text)}</div>
        <div class="msg-actions">
          <button class="msg-act ${isFav(m.text) ? 'on' : ''}" data-a="fav" data-i="${i}">★ ${state.lang === 'zs' ? '收藏' : '收藏'}</button>
          <button class="msg-act" data-a="tts" data-i="${i}">🔊</button>
          <button class="msg-act" data-a="del" data-i="${i}">✕</button>
        </div></div>`).join('');
  $$('.msg-act', log).forEach(b => b.onclick = () => {
    const i = +b.dataset.i, m = chatLog[i];
    if (b.dataset.a === 'fav'){ toggleFav(m.text); paintChat(); }
    else if (b.dataset.a === 'del'){ chatLog.splice(i, 1); paintChat(); }
    else if (b.dataset.a === 'tts'){ ttsSpeakText(m.text); }
  });
  log.scrollTop = log.scrollHeight;
}
const isFav = txt => user.fav.some(f => f.text === txt);
function toggleFav(txt){
  const i = user.fav.findIndex(f => f.text === txt);
  if (i >= 0) user.fav.splice(i, 1);
  else user.fav.push({ text:txt, b:RD.book, ch:RD.ch, ts:Date.now() });
  saveUser();
}
/* 代理可能回傳幾種格式，一律寬鬆解析（與 321領導力 的 extractReplyText 相同） */
function extractReply(d){
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (Array.isArray(d.content) && d.content[0] && d.content[0].text) return d.content[0].text;
  if (d.reply) return d.reply;
  if (d.text) return d.text;
  if (d.message) return d.message;
  if (d.choices && d.choices[0] && d.choices[0].message) return d.choices[0].message.content;
  return '';
}
async function sendChat(text){
  text = (text || '').trim(); if (!text || chatBusy) return;
  const inp = $('#chatIn'); if (inp) inp.value = '';
  chatLog.push({ role:'user', text }); paintChat();
  chatBusy = true;
  chatLog.push({ role:'ai', text: t().thinking }); paintChat();
  const b = RD.book ? BOOK[RD.book] : null;
  const sys = (state.lang === 'zs'
    ? '你是「小智」，国度321空中团契的圣经陪读。以321理念（耶稣是我的榜样、圣经是我的准则、圣灵是我的引导；让耶稣作王、让耶稣得着一切的荣耀；建立属神的体系）回应，深入浅出、善用比喻，引用和合本圣经，回答简明。'
    : '你是「小智」，國度321空中團契的聖經陪讀。以321理念（耶穌是我的榜樣、聖經是我的準則、聖靈是我的引導；讓耶穌作王、讓耶穌得著一切的榮耀；建立屬神的體系）回應，深入淺出、善用比喻，引用和合本聖經，回答簡明。')
    + (b ? `（讀者目前在讀：${bname(b)} 第 ${RD.ch} 章）` : '');
  let reply = '';
  try{
    const r = await fetch(API.chat, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        system: sys,
        messages: chatLog.filter(m => m.text !== t().thinking).slice(-12)
          .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      })
    });
    if (!r.ok) throw new Error('proxy ' + r.status);
    reply = extractReply(await r.json().catch(() => null));
  }catch(e){ reply = ''; }
  chatLog[chatLog.length - 1] = { role:'ai', text: reply || t().chatErr };
  chatBusy = false; paintChat();
}

/* ================================================================ 我的 */
async function viewMe(v){
  const L = t();
  const hls = Object.entries(user.hl).sort((a, b) => b[1].ts - a[1].ts);
  const readCount = Object.keys(user.progress).length;
  v.innerHTML = `
    <div class="card"><div class="statgrid">
      <div><div class="sv">${readCount}</div><div class="sk">${esc(L.stats[0])}</div></div>
      <div><div class="sv">${hls.length}</div><div class="sk">${esc(L.stats[1])}</div></div>
      <div><div class="sv">${user.marks.length}</div><div class="sk">${esc(L.stats[2])}</div></div>
    </div></div>

    <div class="section-title">${esc(L.settings)}</div>
    <div class="card" style="padding:4px 16px">
      <div class="setrow"><div class="sl">${esc(L.langLabel)}</div><div class="segbtns" id="setLang">
        <button class="${state.lang === 'zh' ? 'on' : ''}" data-l="zh">繁體中文</button>
        <button class="${state.lang === 'zs' ? 'on' : ''}" data-l="zs">简体中文</button>
        </div></div>
      <div class="setrow"><div class="sl">${esc(L.font)}</div><div class="segbtns" id="setFont">
        ${L.fonts.map((f, i) => `<button class="${state.font === i ? 'on' : ''}" data-i="${i}">${esc(f)}</button>`).join('')}</div></div>
      <div class="setrow"><div class="sl">${esc(L.theme)}</div><div class="segbtns" id="setTheme">
        ${L.themes.map((f, i) => `<button class="${state.theme === i ? 'on' : ''}" data-i="${i}">${esc(f)}</button>`).join('')}</div></div>
      <div class="setrow"><div class="sl">${esc(L.pure)}
        <div class="muted" style="font-size:11.5px;line-height:1.6">${esc(L.modeHint[state.flow ? 1 : 0])}</div></div>
        <div class="segbtns" id="setMode">
        ${L.modes.map((m, i) => `<button class="${(state.flow ? 1 : 0) === i ? 'on' : ''}" data-i="${i}">${esc(m)}</button>`).join('')}
        </div></div>
      <div class="setrow"><div class="sl">${esc(L.chnum)}
        <div class="muted" style="font-size:11.5px;line-height:1.6">${esc(L.chnumHint[state.chnum ? 0 : 1])}</div></div>
        <div class="segbtns" id="setChnum">
        ${L.onoff.map((m, i) => `<button class="${(state.chnum ? 0 : 1) === i ? 'on' : ''}" data-i="${i}">${esc(m)}</button>`).join('')}
        </div></div>
      <div class="setrow"><div class="sl">${esc(L.note)}〔…〕</div><div class="segbtns" id="setNote">
        <button class="${!state.hidenote ? 'on' : ''}" data-i="0">${state.lang === 'zs' ? '显示' : '顯示'}</button>
        <button class="${state.hidenote ? 'on' : ''}" data-i="1">${state.lang === 'zs' ? '隐藏' : '隱藏'}</button></div></div>
      <div class="setrow"><div class="sl">${esc(L.voice)}</div><div class="segbtns" id="setVoice">
        ${VOICES[state.lang].map((v2, i) => `<button class="${state.voice[state.lang] === i ? 'on' : ''}" data-i="${i}">${esc(v2.n)}</button>`).join('')}</div></div>
    </div>

    <div class="section-title">${esc(L.myBm)}</div>
    <div class="card" style="padding:4px 16px">${user.marks.length
      ? user.marks.slice().sort((a, b2) => b2.ts - a.ts).map((m, i) => `
      <div class="hitem">
        <div class="q">${markNotes(esc(m.t || ''))}…</div>
        <div class="m"><span>${esc(BOOK[m.b] ? bname(BOOK[m.b]) : m.b)} ${esc(L.chapter(m.c))}</span>
          <span><button data-bmgo="${i}">↗</button><button data-bmdel="${i}">✕</button></span></div>
      </div>`).join('')
      : `<div class="empty">${esc(L.emptyBm)}</div>`}</div>

    <div class="section-title">${esc(L.myHl)}</div>
    <div class="card" style="padding:4px 16px">${hls.length ? hls.map(([k, h]) => `
      <div class="hitem">
        <div class="q">${markNotes(esc(h.t))}</div>
        ${h.n ? `<div class="n">${esc(h.n)}</div>` : ''}
        <div class="m"><span>${esc(BOOK[h.b] ? bname(BOOK[h.b]) : h.b)} ${esc(L.chapter(h.ch))}</span>
          <span><button data-go="${h.b}|${h.ch}">↗</button><button data-del="${esc(k)}">✕</button></span></div>
      </div>`).join('') : `<div class="empty">${esc(L.emptyHl)}</div>`}</div>

    <div class="section-title">${esc(L.myFav)}</div>
    <div class="card" style="padding:4px 16px">${user.fav.length ? user.fav.slice().reverse().map((f, i) => `
      <div class="hitem"><div class="q" style="font-family:inherit;font-size:13.5px">${mdToHtml(f.text)}</div>
        <div class="m"><span>${f.b && BOOK[f.b] ? esc(bname(BOOK[f.b])) + ' ' + esc(L.chapter(f.ch)) : ''}</span>
        <button data-favdel="${user.fav.length - 1 - i}">✕</button></div></div>`).join('')
      : `<div class="empty">${esc(L.emptyFav)}</div>`}</div>

    <div class="muted" style="text-align:center;margin:18px 0 8px">
      ${esc(L.app)} ${VERSION}<br>和合本聖經屬公有領域，沒有版權限制</div>`;

  $$('#setLang button', v).forEach(b => b.onclick = () => switchLang(b.dataset.l));
  $$('#setFont button', v).forEach(b => b.onclick = () => { state.font = +b.dataset.i; saveState(); applyChrome(); render(); });
  $$('#setTheme button', v).forEach(b => b.onclick = () => { state.theme = +b.dataset.i; saveState(); applyChrome(); render(); });
  $$('#setMode button', v).forEach(b => b.onclick = () => { state.flow = b.dataset.i === '1'; saveState(); applyChrome(); render(); });
  $$('#setChnum button', v).forEach(b => b.onclick = () => { state.chnum = b.dataset.i === '0'; saveState(); applyChrome(); render(); });
  $$('#setNote button', v).forEach(b => b.onclick = () => { state.hidenote = b.dataset.i === '1'; saveState(); applyChrome(); render(); });
  $$('#setVoice button', v).forEach(b => b.onclick = () => { state.voice[state.lang] = +b.dataset.i; saveState(); render(); });
  const sortedMarks = user.marks.slice().sort((a, b2) => b2.ts - a.ts);
  $$('[data-bmgo]', v).forEach(b => b.onclick = () => openAt(sortedMarks[+b.dataset.bmgo]));
  $$('[data-bmdel]', v).forEach(b => b.onclick = () => {
    const m = sortedMarks[+b.dataset.bmdel];
    const i = user.marks.findIndex(x => x.b === m.b && x.c === m.c && x.p === m.p && x.s === m.s);
    if (i >= 0) user.marks.splice(i, 1);
    saveUser(); render();
  });
  $$('[data-del]', v).forEach(b => b.onclick = () => { delete user.hl[b.dataset.del]; saveUser(); render(); });
  $$('[data-go]', v).forEach(b => b.onclick = () => { const [x, y] = b.dataset.go.split('|'); go(`#/read/${x}/${y}`); });
  $$('[data-favdel]', v).forEach(b => b.onclick = () => { user.fav.splice(+b.dataset.favdel, 1); saveUser(); render(); });
}

/* ================================================================ 朗讀 */
const TTS_CHUNK = 130, TTS_LOOKAHEAD = 2, TTS_RETRY = [800, 1600];
const RA_COOLDOWN = 4000;
let spk = { on:false, items:[], idx:0, audio:null, cache:{}, native:false, abort:false };
let raManualAt = 0;

/* 朗讀發音修正（僅影響語音，不影響畫面文字） */
const TTS_FIX = [
  [/長老/g, '掌老'], [/長子/g, '掌子'], [/家長/g, '家掌'], [/長大/g, '掌大'],
  [/行為/g, '行圍'], [/為大/g, '圍大'], [/中了/g, '衷了'],
  [/教會/g, '叫會'], [/傳道/g, '船道'], [/朝見/g, '潮見'],
  [/應當/g, '英當'], [/應許/g, '英許'], [/相應/g, '相映'],
  [/看守/g, '刊守'], [/種子/g, '腫子'], [/中間/g, '衷間']
];
function ttsPrep(s){
  let x = s.replace(/〔[^〕]*〕/g, '');            // 譯者註不朗讀
  x = x.replace(/[「」『』（）]/g, '');
  TTS_FIX.forEach(([re, to]) => { x = x.replace(re, to); });
  return x.trim();
}
function buildQueue(){
  let els = $$('#reader .sent');
  const from = els.findIndex(el => el.getBoundingClientRect().bottom > 0);
  if (from > 0) els = els.slice(from);
  const items = []; let cur = { text:'', els:[] };
  els.forEach(el => {
    const txt = el.textContent;
    if (cur.text.length + txt.length > TTS_CHUNK && cur.text){ items.push(cur); cur = { text:'', els:[] }; }
    cur.text += txt; cur.els.push(el);
  });
  if (cur.text) items.push(cur);
  return items.filter(i => ttsPrep(i.text).length > 0);
}
function raClear(){ $$('.tts-reading').forEach(e => e.classList.remove('tts-reading')); }
function raShow(item){
  raClear();
  if (!item || !item.els.length) return;
  item.els.forEach(e => e.classList.add('tts-reading'));
  if (Date.now() - raManualAt > RA_COOLDOWN){
    try{ item.els[0].scrollIntoView({ behavior:'smooth', block:'center' }); }catch(e){}
  }
}
['wheel','touchmove'].forEach(ev => window.addEventListener(ev, () => { raManualAt = Date.now(); }, { passive:true }));

function ttsBtn(st){ const b = $('#rdTts'); if (b) b.setAttribute('data-state', st || ''); }

/* iOS/Safari 兩個坑，都要照《321領導力》的作法避開：
   ① 整個 App 只能有「一個」<audio> 元素，而且必須在使用者按下按鈕的那一瞬間
      （還在 user gesture 裡）就先 play() 過一次，之後才准程式自己播。
      如果等 fetch 回來再 new Audio()，手勢早就過期了，play() 會被擋下來，
      看起來就像「真人語音壞掉、自動改用裝置語音」。
   ② Worker 回傳的 Content-Type 不一定是 audio/mpeg；直接拿 response.blob()
      交給 <audio> 會解不出來。改成自己讀 arrayBuffer 再指定 audio/mpeg。 */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
let ttsEl = null, ttsUnlocked = false, ttsLastErr = '';
function ttsAudio(){
  if (!ttsEl){
    ttsEl = new Audio();
    ttsEl.preload = 'auto';
    try{ ttsEl.playsInline = true; ttsEl.setAttribute('playsinline', ''); }catch(e){}
  }
  return ttsEl;
}
/* 必須在 onclick 同步呼叫，不可 await 之後才呼叫 */
function ttsUnlock(){
  if (ttsUnlocked) return;
  try{
    const a = ttsAudio();
    a.src = SILENT_WAV;
    const p = a.play();
    if (p && p.then) p.then(() => { ttsUnlocked = true; }).catch(() => {});
    else ttsUnlocked = true;
  }catch(e){}
}
async function ttsFetch(text, voice){
  const body = JSON.stringify({ voice, rate: TTS_RATE, sil: TTS_SIL, silc: TTS_SILC, sile: TTS_SILE, text });
  for (let a = 0; a <= TTS_RETRY.length; a++){
    try{
      const r = await fetch(API.tts, { method:'POST', headers:{'Content-Type':'application/json'}, body });
      if (!r.ok) throw new Error('http ' + r.status);
      const buf = await r.arrayBuffer();
      if (!buf || buf.byteLength < 128) throw new Error('empty audio');
      return URL.createObjectURL(new Blob([buf], { type:'audio/mpeg' }));
    }catch(e){
      ttsLastErr = (e && e.message) ? String(e.message) : 'network';
      if (a === TTS_RETRY.length) throw e;
      await new Promise(r => setTimeout(r, TTS_RETRY[a]));
    }
  }
}
function ttsWarmUp(){
  try{
    fetch(API.tts, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ voice: VOICES[state.lang][state.voice[state.lang]].v,
                             rate: TTS_RATE, sil: TTS_SIL, silc: TTS_SILC, sile: TTS_SILE, text:'。' }) }).catch(() => {});
  }catch(e){}
}
async function ttsPrefetch(i){
  const it = spk.items[i]; if (!it || spk.cache[i]) return;
  const voice = VOICES[state.lang][state.voice[state.lang]].v;
  try{ spk.cache[i] = await ttsFetch(ttsPrep(it.text), voice); }catch(e){ spk.cache[i] = null; }
}
async function ttsPlayFrom(i){
  if (!spk.on || spk.abort) return;
  if (i >= spk.items.length){ ttsStop(); return; }
  spk.idx = i; raShow(spk.items[i]);
  /* 先排這一段自己的請求，再排後面的預抓——否則第一聲會等在後面兩段的後面 */
  if (spk.cache[i] === undefined) await ttsPrefetch(i);
  for (let k = i + 1; k <= i + TTS_LOOKAHEAD; k++) ttsPrefetch(k);
  if (!spk.on || spk.abort) return;
  const url = spk.cache[i];
  if (!url){ return ttsNativeFrom(i); }
  ttsBtn('playing');
  const a = ttsAudio(); spk.audio = a;
  const old = a.src;
  a.onended = null; a.onerror = null;
  a.src = url;
  if (old && old.startsWith('blob:')){ try{ URL.revokeObjectURL(old); }catch(e){} }
  a.onended = () => { if (spk.on && !spk.abort) ttsPlayFrom(i + 1); };
  a.onerror = () => { if (i === 0) ttsNativeFrom(i); else if (spk.on && !spk.abort) ttsPlayFrom(i + 1); };
  try{
    const p = a.play();
    if (p && p.catch) await p;
  }catch(e){
    if (i === 0) ttsNativeFrom(i); else if (spk.on && !spk.abort) ttsPlayFrom(i + 1);
  }
}
function ttsNativeFrom(i){
  if (!('speechSynthesis' in window)){ toast(t().ttsErr); ttsStop(); return; }
  if (!spk.native){ spk.native = true; toast(t().ttsFallback + (ttsLastErr ? '（' + ttsLastErr + '）' : '')); }
  if (!spk.on || spk.abort || i >= spk.items.length){ ttsStop(); return; }
  spk.idx = i; raShow(spk.items[i]); ttsBtn('playing');
  const u = new SpeechSynthesisUtterance(ttsPrep(spk.items[i].text));
  u.lang = state.lang === 'zs' ? 'zh-CN' : 'zh-TW'; u.rate = .95;
  u.onend = () => { if (spk.on && !spk.abort) ttsNativeFrom(i + 1); };
  u.onerror = () => { if (spk.on && !spk.abort) ttsNativeFrom(i + 1); };
  try{ speechSynthesis.speak(u); }catch(e){ ttsStop(); }
}
function ttsToggle(){
  if (spk.on){ ttsStop(); return; }
  ttsUnlock();                       // 一定要在這裡（還在使用者的點擊手勢裡）
  const items = buildQueue();
  if (!items.length) return;
  spk = { on:true, items, idx:0, audio:null, cache:{}, native:false, abort:false };
  ttsBtn('loading');
  ttsPlayFrom(0);
}
function ttsStop(){
  spk.on = false; spk.abort = true;
  try{ if (ttsEl){ ttsEl.pause(); } }catch(e){}
  spk.audio = null;
  try{ if ('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
  raClear(); ttsBtn('');
}
async function ttsSpeakText(text){
  ttsUnlock();
  const clean = ttsPrep(text.replace(/[#*>`_\-]/g, ''));
  if (!clean) return;
  const voice = VOICES[state.lang][state.voice[state.lang]].v;
  try{
    const url = await ttsFetch(clean.slice(0, 900), voice);
    const a = ttsAudio();
    const old = a.src;
    a.onended = null; a.onerror = null;
    a.src = url;
    if (old && old.startsWith('blob:')){ try{ URL.revokeObjectURL(old); }catch(e){} }
    const p = a.play(); if (p && p.catch) await p;
  }catch(e){
    if ('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = state.lang === 'zs' ? 'zh-CN' : 'zh-TW';
      speechSynthesis.speak(u); toast(t().ttsFallback);
    } else toast(t().ttsErr);
  }
}

/* ================================================================ 啟動 */
async function switchLang(l){
  if (l === state.lang) return;
  ttsStop();
  state.lang = l; saveState(); applyChrome();
  searchState = { q:searchState.q, results:[], busy:false };
  await render();
}
async function boot(){
  loadState(); loadUser(); applyChrome();
  $$('#langswitch button').forEach(b => b.onclick = () => switchLang(b.dataset.lang));
  const diagTimer = setTimeout(() => { const d = $('#boot-diag'); if (d) d.style.display = 'flex'; }, 8000);
  $('#boot-reload').onclick = () => location.reload();
  $('#boot-clear').onclick = async () => {
    try{
      if ('caches' in window){ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
      if (navigator.serviceWorker){ const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); }
    }catch(e){}
    location.reload();
  };
  try{
    await loadTOC();
    if (!location.hash) location.hash = '#/today';
    await render();
  }catch(e){
    $('#bootText').textContent = '載入失敗：' + (e.message || e);
    $('#boot-diag').style.display = 'flex';
    return;
  }
  clearTimeout(diagTimer);
  const b = $('#boot'); if (b) b.remove();
  window.addEventListener('hashchange', () => { ttsStop(); render(); });
  if ('serviceWorker' in navigator){
    try{ navigator.serviceWorker.register('sw.js'); }catch(e){}
  }
  setTimeout(ttsWarmUp, 1200);
}
boot();
