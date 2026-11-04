/* 簡體字串對照表（build_xzm.py 以系統 ICU 產生，勿手改）*/
window.XZM_SC = {'321互動聖經・小智':'321互动圣经・小智','321福音同行':'321福音同行','✍️ 寫下你的領受':'✍️ 写下你的领受','✨ 小智畫線':'✨ 小智画线','。我的領受是：「':'。我的领受是：「','・小智':'・小智','做成美圖':'做成美图','停止':'停止','儲存':'储存','分享':'分享','原回答已不在對話中':'原回答已不在对话中','取消畫線':'取消画线','只列出最近 40 筆。':'只列出最近 40 笔。','只列出最近 60 筆。':'只列出最近 60 笔。','咖啡':'咖啡','問小智':'问小智','回到原處':'回到原处','回到回答':'回到回答','國度321空中團契':'国度321空中团契','墨黑':'墨黑','小智':'小智','小智畫線':'小智画线','已儲存':'已储存','已複製':'已复制','從這裡朗讀':'从这里朗读','我在讀小智的回答，畫了這一句：「':'我在读小智的回答，画了这一句：「','我的領受是：「':'我的领受是：「','我的領受：':'我的领受：','我的默想：':'我的默想：','朗讀這句':'朗读这句','畫線顏色':'画线颜色','粉':'粉','紫':'紫','綠':'绿','繁體':'繁体','美圖工作室還在載入，請稍後再試':'美图工作室还在载入，请稍后再试','美圖工作室還沒載入':'美图工作室还没载入','藍':'蓝','複製':'复制','複製全部':'复制全部','請就這句幫助我默想：':'请就这句帮助我默想：','請就這句話幫助我默想：「':'请就这句话帮助我默想：「','請幫我更深地明白這句話對我的意思，也帶我把焦點對準耶穌。':'请帮我更深地明白这句话对我的意思，也带我把焦点对准耶稣。','請針對小智說的這一句，告訴我傳福音時可以怎麼運用、怎麼對他說：「':'请针对小智说的这一句，告诉我传福音时可以怎么运用、怎么对他说：「','這句話帶給你什麼領受、感動，或聖靈的提醒？寫下來，把焦點對準耶穌……':'这句话带给你什么领受、感动，或圣灵的提醒？写下来，把焦点对准耶稣……','還沒有小智畫線。在小智的回答裡點一下句子就能畫線。':'还没有小智画线。在小智的回答里点一下句子就能画线。','酒紅':'酒红','金':'金','關閉':'关闭','（原回答已不在對話中）':'（原回答已不在对话中）','💡 點一下任何一句畫線；再點一下可換色、寫領受、做成美圖或問小智。':'💡 点一下任何一句画线；再点一下可换色、写领受、做成美图或问小智。'};
/* ═══════════════════════════════════════════════════════════════════
   xzm.js v1（xzm1103-g）— 321 小智回答「逐句跟讀＋畫線＋再點」通用模組（ES5，無相依）

   小智每則回答完成後，文字被切成一句一句 <span class="xzs" data-xk="z|訊息id|區塊序|句序">：
     · 點一下畫線、再點開面板（面板與儲存重用該 App 正文的畫線機制，由 marks 後端接上）
     · 🔊 朗讀整則回答時逐句高亮、畫面捲到該句，使用者自己捲動後 6 秒內不搶畫面
     · 小智訊息（最近 60 則）保存、重開還原；孤兒畫線仍可看，跳轉停用
   不改任何宿主函式的原始碼：全部用「外掛」方式——
     · 用 MutationObserver 看著聊天視窗，宿主重畫之後立刻把已完成的回答切句（同一個 microtask，畫面不閃）
     · 🔊 按鈕用 capture 階段攔截（或包 SAGE321.speak），沒有 XZM 時宿主行為完全不變
   移植只需要提供一個 adapter（見 porting.md 的「adapter 介面」）；本檔內附兩組現成 preset：
     XZM.preset.gx(opts)      SAGE321 + GXA.hl + TTS321（gxa.js / gxr.js 系）
     XZM.preset.lesson(opts)  S.chat／CHAT + 課程型 App 的 sentList／paintHl／spk 朗讀（mission、life 系）
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  if (window.__xzmc) return; window.__xzmc = 1;
  var root = document.documentElement;
  var A = null;                                   /* 目前的 adapter */
  var HOLD_MS = 6000, KEEP = 60;
  var ST = { reading: null, hold: 0, timer: 0, own: false, mo: null, wait: 0, busy: false, sig: '', last: [], tagSig: {}, units: {} };

  /* ── 小工具 ─────────────────────────────────────────────────────── */
  function g(f, d) { try { var r = f(); return r === undefined ? d : r; } catch (e) { return d; } }
  function arr(l) { return Array.prototype.slice.call(l || []); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $1(s, r) { return (r || document).querySelector(s); }
  function lang() { return g(function () { return A.lang(); }, 'tc'); }
  /* T(繁體, English)；簡體從 window.XZM_SC（build 時由系統 ICU 產生的對照表）查，沒有就用 adapter.toSC */
  function T(zh, en) {
    var l = lang();
    if (l === 'en') return en;
    if (l === 'sc') {
      var m = window.XZM_SC && window.XZM_SC[zh];
      if (m) return m;
      var r = g(function () { return A.toSC(zh); });
      if (r) return r;
    }
    return zh;
  }
  function say(m) { g(function () { A.toast(m); }); }
  function isTag(t) { return t.charAt(0) === '<'; }

  /* ── 切句（句子界線：。！？ 與英文 .!?；收尾引號括號跟著前一句；標籤與實體不切）──── */
  var TOKRE = /<[^>]*>|&#?\w+;|[\s\S]/g;
  var CLOSERS = '」』）)】》〉”’"\'］]»';
  var ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&rdquo;': '”', '&rsquo;': '’' };
  var BOOKS = /^(gen|exod|ex|lev|num|deut|josh|judg|sam|kgs|chr|neh|esth|ps|prov|eccl|isa|jer|lam|ezek|dan|hos|obad|mic|nah|hab|zeph|hag|zech|mal|matt|mk|lk|jn|rom|cor|gal|eph|phil|col|thess|tim|tit|phlm|heb|jas|pet|rev|ch|chs|vv|v)$/i;
  var REAL = /[\p{L}\p{N}]/u;
  function pc(t) { return t.length === 1 ? t : (ENT[t] !== undefined ? ENT[t] : 'x'); }
  function isSp(t) { return !isTag(t) && /^\s$/.test(pc(t)); }
  function isCloser(t) { return !isTag(t) && CLOSERS.indexOf(pc(t)) >= 0; }
  function afterOk(toks, i) {
    var j = i + 1, nx;
    while (j < toks.length && (isCloser(toks[j]) || toks[j] === '.' || toks[j] === '!' || toks[j] === '?')) j++;
    nx = toks[j];
    if (nx === undefined || isTag(nx) || isSp(nx)) return { ok: true, j: j };
    return { ok: false, j: j, cjk: pc(nx).charCodeAt(0) > 0x2E7F };
  }
  function isEndMark(toks, i, ch) {
    if (ch === '。' || ch === '！' || ch === '？') return true;
    if (ch === '!' || ch === '?') { var a = afterOk(toks, i); return a.ok || a.cjk; }
    if (ch === '.') {
      var r = afterOk(toks, i);
      if (!r.ok) return false;
      var w = '', p = i - 1, k;
      while (p >= 0 && !isTag(toks[p]) && /^[A-Za-z]$/.test(toks[p])) { w = toks[p] + w; p--; }
      if (w) {
        if (/^(mr|mrs|ms|dr|st|vs|prof|fig|vol|no|nos|jr|sr)$/i.test(w)) return false;
        k = r.j;
        while (k < toks.length && (isSp(toks[k]) || isTag(toks[k]))) k++;
        if (BOOKS.test(w) && toks[k] && /^[0-9]$/.test(toks[k])) return false;
        if (w.length === 1 && /[A-Z]/.test(w) && toks[k] && /^[A-Z]$/.test(toks[k])) return false;
      }
      return true;
    }
    return false;
  }
  function splitSent(html) {
    var toks = String(html).match(TOKRE) || [], out = [], cur = [], depth = 0, pend = false, i, t, ch;
    function flush() { if (cur.length) { out.push({ k: 's', h: cur.join('') }); cur = []; } pend = false; }
    for (i = 0; i < toks.length; i++) {
      t = toks[i];
      if (isTag(t)) {
        if (/^<br\b/i.test(t)) { flush(); out.push({ k: 'x', h: t }); continue; }
        cur.push(t);
        if (t.charAt(1) === '/') { depth = Math.max(0, depth - 1); if (depth === 0 && pend) flush(); }
        else if (!/\/>$/.test(t) && !/^<(img|hr|wbr|input)\b/i.test(t)) depth++;
        continue;
      }
      cur.push(t);
      ch = pc(t);
      if (isEndMark(toks, i, ch)) {
        while (i + 1 < toks.length && !isTag(toks[i + 1]) && (CLOSERS.indexOf(pc(toks[i + 1])) >= 0 || '。！？!?'.indexOf(pc(toks[i + 1])) >= 0)) cur.push(toks[++i]);
        if (depth === 0) flush(); else pend = true;
      } else if (pend && !/^\s$/.test(ch) && CLOSERS.indexOf(ch) < 0) pend = false;
    }
    flush();
    var res = [], carry = '';
    out.forEach(function (it) {
      if (it.k !== 's') { if (carry) { res.push({ k: 'x', h: carry }); carry = ''; } res.push(it); return; }
      if (REAL.test(it.h.replace(/<[^>]*>|&#?\w+;/g, ''))) { res.push({ k: 's', h: carry + it.h }); carry = ''; }
      else { var last = res[res.length - 1]; if (last && last.k === 's') last.h += it.h; else carry += it.h; }
    });
    if (carry) res.push({ k: 'x', h: carry });
    return res;
  }

  /* ── 訊息與代號 ─────────────────────────────────────────────────── */
  function msgs() { return g(function () { return A.msgs(); }, []) || []; }
  function newId() { return 'a' + (new Date()).getTime().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function idOf(m) {
    if (!m) return '';
    if (typeof A.idOf === 'function') return A.idOf(m);
    if (!m.xid) { m.xid = newId(); ST.dirty = true; }
    return m.xid;
  }
  function msgById(id) { var a = msgs(), i; for (i = 0; i < a.length; i++) if (a[i] && a[i].xid === id) return a[i]; return null; }
  function parse(xk) { var p = String(xk).split('|'); return { id: p[1] || '', b: +p[2] || 0, s: +p[3] || 0 }; }
  function isZ(xk) { return typeof xk === 'string' && xk.charAt(0) === 'z' && xk.charAt(1) === '|'; }

  /* ── 把回答的 HTML 切成可點的句子 ─────────────────────────────── */
  function containers(el) { var c = el.querySelectorAll('li,th,td'); return c.length ? arr(c) : [el]; }
  function plain(h) {
    return h.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  }
  var BLOCKRE = /^(P|UL|OL|DL|H[1-6]|BLOCKQUOTE|TABLE|DIV|PRE|HR|SECTION|ARTICLE|FIGURE|DETAILS)$/;
  /* 頂層若有「裸文字＋行內標籤」（有些宿主的 markdown 不包 <p>），連續的一段包成 <span data-xzrun>，視同一個段落 */
  function normalize(tpl) {
    var run = null;
    arr(tpl.content.childNodes).forEach(function (nd) {
      if (nd.nodeType === 1 && BLOCKRE.test(nd.tagName)) { run = null; return; }
      if (nd.nodeType === 8) return;
      if (!run) { run = document.createElement('span'); run.setAttribute('data-xzrun', '1'); tpl.content.insertBefore(run, nd); }
      run.appendChild(nd);
    });
  }
  function tagHtml(html, id) {
    var tpl = document.createElement('template'), list = [];
    tpl.innerHTML = html;
    normalize(tpl);
    arr(tpl.content.children).forEach(function (el, b) {
      var n = 0;
      if (el.classList && (el.classList.contains('xzhint') || el.hasAttribute('data-xzskip'))) return;
      containers(el).forEach(function (c) {
        var out = '';
        splitSent(c.innerHTML).forEach(function (it) {
          if (it.k === 'x') { out += it.h; return; }
          var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(it.h), xk = 'z|' + id + '|' + b + '|' + (n++);
          out += m[1] + '<span class="xzs' + (A.cls ? ' ' + A.cls : '') + '" data-xk="' + xk + '"' + (A.attrs ? A.attrs(id, b, n - 1, xk) : '') +
            (A.ownClick === false ? '' : ' onclick="XZM.tap(event,this)"') + '>' + m[2] + '</span>' + m[3];
          list.push({ xk: xk, b: b, s: n - 1, t: plain(m[2]) });
        });
        c.innerHTML = out;
      });
    });
    return { html: tpl.innerHTML, list: list };
  }
  /* 掃描聊天視窗：把「已完成、還沒切句」的回答切句（整個過程在 busy 旗標裡，自己造成的 DOM 變動不會再觸發自己） */
  function scan() {
    if (!A || ST.busy) return;
    ST.busy = true;
    var any = false;
    try {
      A.answers().forEach(function (a) {
        var m = a.m, body = a.body;
        if (!m || !body || !A.isDone(m)) return;
        var id = idOf(m), sig = id + ':' + String(m.text || '').length;
        if (body.getAttribute('data-xzt') === sig && body.querySelector('.xzs')) return;
        var r = tagHtml(body.innerHTML, id);
        body.innerHTML = r.html;
        body.setAttribute('data-xzt', sig);
        g(function () { if (A.decorate) A.decorate(body, id); });
        any = true;
        if (A.hint && a.last && r.list.length) addHint(body);
      });
      if (any || ST.dirty) {
        ST.dirty = false;
        g(function () { A.marks.attach(chatRoot()); });
        g(function () { A.marks.paint(chatRoot()); });
        syncBtn();
        var rd = ST.reading;
        if (rd && rd.units[rd.last]) { var h = ST.hold; ST.hold = Date.now() + 1500; mark(rd.units[rd.last], true); ST.hold = h; }
        g(function () { if (A.afterScan) A.afterScan(any); });
      }
      persist();
    } catch (e) { try { console.error('XZM scan', e); } catch (_) {} }
    if (ST.mo) ST.mo.takeRecords();
    ST.busy = false;
  }
  function addHint(body) {
    if (anyMarks() || body.querySelector('.xzhint')) return;
    body.insertAdjacentHTML('beforeend', '<div class="xzhint" data-xzskip="1">' + esc(T('💡 點一下任何一句畫線；再點一下可換色、寫領受、做成美圖或問小智。',
      '💡 Tap any sentence to highlight it; tap again to change colour, write a reflection, make a card or ask Xiaozhi.')) + '</div>');
  }
  function anyMarks() { return g(function () { return A.marks.any(); }, false); }
  function chatRoot() { return g(function () { return A.root(); }, null); }
  /* ── 看著聊天視窗 ─────────────────────────────────────────────── */
  function watch() {
    var r = chatRoot();
    if (!r) { ST.wait = setTimeout(watch, 400); return; }
    if (ST.watched === r) return;
    ST.watched = r;
    if (ST.mo) ST.mo.disconnect();
    if (window.MutationObserver) {
      ST.mo = new MutationObserver(function () { if (!ST.busy) scan(); });
      ST.mo.observe(r, { childList: true, subtree: true });
    }
    scan();
  }
  /* 聊天視窗元素本身也可能被換掉：低頻檢查一次（不重的 getElementById） */
  setInterval(function () { if (A && ST.watched && chatRoot() !== ST.watched) { ST.watched = null; watch(); } else if (A && !ST.watched) watch(); }, 1500);

  /* ── 點一下畫線、再點開面板 ───────────────────────────────────── */
  function selecting() { return g(function () { return String(window.getSelection()).replace(/\s/g, '').length > 0; }, false); }
  function tap(ev, el) {
    try {
      if (ev) {
        ev.stopPropagation();
        var t = ev.target;
        if (t && t.closest && t.closest('a,button,.mknote,.hl-note,.gxhl-note')) return;
      }
    } catch (e) {}
    if (selecting()) return;
    if (!el) return;
    A.marks.tap(el.getAttribute('data-xk'), el);
  }
  function sentEl(xk) { return $1('.xzs[data-xk="' + xk + '"]', chatRoot() || document); }
  function sentText(el) { return plain(el.innerHTML); }

  /* ── 朗讀：句子 ↔ 單元一對一 ─────────────────────────────────── */
  function endP(t) { return /[。！？；：、，,.:;!?」』）)”"…]$/.test(t) ? t : t + (lang() === 'en' ? '.' : '。'); }
  function tableText(el) {
    var rows = arr(el.querySelectorAll('tr')).map(function (tr) { return arr(tr.children).map(function (c) { return plain(c.innerHTML); }).filter(Boolean); });
    var head = rows[0] || [], body = rows.slice(1), out = [];
    if (!body.length) return endP(head.join('，'));
    body.forEach(function (r) {
      out.push(endP(r.map(function (c, j) { return (head[j] && r.length > 1 ? head[j] + (lang() === 'en' ? ': ' : '：') : '') + c; }).join(lang() === 'en' ? ', ' : '，')));
    });
    return out.join(' ');
  }
  /* 預設：一句一個單元；表格整張一個單元；adapter.units(node, i, m) 可以整個換掉（例如用 NAR321 補口語帶入詞） */
  function unitsOf(node, m, i) {
    if (A.units) { var u = g(function () { return A.units(node, m, i, defaultUnits); }, null); if (u && u.length) return u; }
    return defaultUnits(node);
  }
  function defaultUnits(node) {
    var body = A.bodyOf(node), us = [];
    function U(t, spans, whole) {
      t = A.clean ? g(function () { return A.clean(t); }, t) : t;
      if (!t || !String(t).replace(/\s+/g, '')) return;
      us.push({ t: t, keys: spans.map(function (s) { return s.getAttribute('data-xk'); }), whole: !!whole });
    }
    arr(body.children).forEach(function (el) {
      var spans = arr(el.querySelectorAll('.xzs'));
      if (!spans.length) return;
      if (el.tagName === 'TABLE' || el.querySelector('table') && el.children.length === 1) { U(tableText(el.tagName === 'TABLE' ? el : el.querySelector('table')), spans, true); return; }
      spans.forEach(function (s) { U(endP(sentText(s)), [s]); });
    });
    return us;
  }
  function resolve(u) {
    var els = u.keys.map(sentEl).filter(Boolean);
    if (u.whole && els[0]) { var tb = els[0].closest('table'); if (tb) return [tb]; }
    return els;
  }
  function clearMarks() {
    ST.last.forEach(function (e) { g(function () { e.classList.remove(A.nowCls || 'spk-now'); }); });
    ST.last = [];
    arr(document.querySelectorAll('.' + (A.nowCls || 'spk-now'))).forEach(function (e) { e.classList.remove(A.nowCls || 'spk-now'); });
  }
  function scrollToEl(el) {
    var box = g(function () { return A.scroller(); }, null);
    if (!box || !el) return;
    var r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
    var top = box.scrollTop + (r.top - br.top) - (r.height > br.height * 0.8 ? 24 : (br.height - r.height) / 2);
    top = Math.max(0, top);
    if (Math.abs(top - box.scrollTop) < 8) return;
    try { box.scrollTo({ top: top, behavior: 'smooth' }); } catch (e) { box.scrollTop = top; }
  }
  function mark(u, quiet) {
    clearMarks();
    var els = resolve(u);
    if (!els.length) return;
    g(function () { if (A.beforeMark) A.beforeMark(els[0]); });
    els.forEach(function (e) { e.classList.add(A.nowCls || 'spk-now'); });
    ST.last = els;
    if (!quiet && g(function () { return A.follow(); }, true) === false) return;
    if (Date.now() < ST.hold) return;
    scrollToEl(els[0]);
  }
  /* poll 型引擎（TTS321 這種「有 isOn／index」的）：每 120ms 看一次現在唸到第幾段 */
  function tick() {
    var rd = ST.reading;
    if (!rd) { stopTimer(); return; }
    var s = A.engine.state();
    if (!s.on) { endReading(); return; }
    if (s.i !== rd.last) { rd.last = s.i; if (rd.units[s.i]) mark(rd.units[s.i]); }
  }
  function stopTimer() { if (ST.timer) { clearInterval(ST.timer); ST.timer = 0; } }
  function endReading() { ST.reading = null; stopTimer(); clearMarks(); syncBtn(); }
  function stopEngine() { g(function () { A.engine.stop(); }); endReading(); }
  function begin(units, title, meta) {
    if (!A.engine || !units.length) return false;
    g(function () { if (A.engine.ready) A.engine.ready(); });   /* 引擎若是延遲初始化（TTS321.init）先叫醒它 */
    var us = [];
    units.forEach(function (u) { A.engine.chunks(u.t).forEach(function (c) { us.push({ t: c, src: u }); }); });
    if (!us.length) return false;
    ST.hold = 0;
    endReading();
    ST.own = true;
    try { A.engine.play(us.map(function (x) { return { t: x.t }; }), title); } catch (err) { ST.own = false; return false; }
    ST.own = false;
    ST.reading = { mid: meta.mid, kind: meta.kind, units: us.map(function (x) { return x.src; }), last: -1 };
    ST.timer = setInterval(tick, 120);
    tick();
    syncBtn();
    return true;
  }
  /* 🔊 朗讀整則回答（i＝adapter 認得的訊息索引） */
  function speakMsg(i) {
    var m = g(function () { return A.msgAt(i); }, null), node = g(function () { return A.nodeAt(i); }, null);
    if (!m || !node || !A.isDone(m) || !node.querySelector('.xzs')) return false;
    var id = idOf(m);
    if (A.beginMsg) {                               /* 非 poll 型引擎（課程型 App 的 spk 朗讀）：由 adapter 自己開唸 */
      return g(function () { return A.beginMsg(i, m, node, unitsOf(node, m, i), id); }, false);
    }
    if (!A.engine) return false;
    var rd = ST.reading;
    if (rd && rd.mid === id && rd.kind === 'msg' && A.engine.state().on) { stopEngine(); return true; }
    var units = unitsOf(node, m, i);
    if (!units.length) return false;
    return begin(units, T('小智', 'Xiaozhi'), { mid: id, kind: 'msg' });
  }
  /* 從某一句開始唸到這則回答結束（面板的「從這裡朗讀」；單句＝from 之後只取一句） */
  function sayFrom(xk, onlyOne) {
    var el = typeof xk === 'string' ? sentEl(xk) : xk;
    if (!el) return false;
    var key = el.getAttribute('data-xk'), p = parse(key), node = el.closest(A.msgSel), m = msgById(p.id), units, j, from = -1, picked;
    if (!node || !m) return false;
    units = unitsOf(node, m, -1);
    for (j = 0; j < units.length; j++) if (units[j].keys.indexOf(key) >= 0) { from = j; break; }
    if (from < 0) return false;
    picked = onlyOne ? [units[from]] : units.slice(from);
    if (A.beginMsg) return g(function () { return A.beginMsg(-1, m, node, picked, idOf(m), true); }, false);
    return begin(picked, T('小智', 'Xiaozhi'), { mid: idOf(m), kind: onlyOne ? 'one' : 'from' });
  }
  function syncBtn() { g(function () { if (A.syncBtn) A.syncBtn(ST.reading); }); }
  function wrapEngine() {
    if (!A.engine || !A.engine.wrap) return;
    A.engine.wrap(function () { if (!ST.own) endReading(); });
  }
  ['wheel', 'touchstart', 'touchmove', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (ST.reading || (A && A.reading && A.reading())) ST.hold = Date.now() + HOLD_MS; }, { passive: true });
  });
  window.addEventListener('keydown', function (e) {
    if ((ST.reading || (A && A.reading && A.reading())) && /^(Arrow|Page)|^(Home|End)$|^ $/.test(e.key || '')) ST.hold = Date.now() + HOLD_MS;
  });

  /* ── 小智訊息的保存／還原（宿主自己會存的就不用，adapter 不給 store 即略過）──── */
  function persist() {
    if (!A || !A.store) return;
    try {
      var a = msgs(), out = [], i, m;
      for (i = 0; i < a.length; i++) {
        m = a[i];
        if (!m || m.cont) continue;
        if (A.isUser(m)) { out.push({ id: idOf(m), role: 'user', text: m.text, at: +m.at || 0 }); continue; }
        if (!A.isDone(m)) continue;
        out.push({ id: idOf(m), role: 'assistant', text: m.text, at: +m.at || 0 });
      }
      if (out.length && out[out.length - 1].role === 'user' && g(function () { return A.busy(); }, false)) out.pop();
      out = out.slice(-KEEP);
      var sig = out.map(function (x) { return x.id + x.text.length; }).join(',');
      if (sig === ST.sig) return;
      ST.sig = sig;
      A.store.set(out);
    } catch (e) {}
  }
  function restore() {
    if (!A || !A.store || msgs().length || g(function () { return A.busy(); }, false)) return false;
    var list = g(function () { return A.store.get(); }, null);
    if (!Array.isArray(list) || !list.length) return false;
    list = list.filter(function (x) { return x && x.id && x.text && (x.role === 'user' || x.role === 'assistant'); });
    if (!list.length) return false;
    g(function () { A.restore(list); });
    ST.sig = list.map(function (x) { return x.id + x.text.length; }).join(',');
    return true;
  }

  /* ── 回到原處／刪除 ──────────────────────────────────────────── */
  function jump(xk) {
    var m = msgById(parse(xk).id);
    if (!m) { say(T('原回答已不在對話中', 'The original answer is no longer in the chat')); return false; }
    g(function () { A.open(); });
    setTimeout(function () {
      var el = sentEl(xk);
      if (!el) return;
      g(function () { if (A.beforeMark) A.beforeMark(el); });
      scrollToEl(el);
      el.classList.add('xzflash');
      setTimeout(function () { el.classList.remove('xzflash'); }, 1800);
    }, 120);
    return true;
  }

  /* ── 樣式 ───────────────────────────────────────────────────── */
  function css() {
    if (document.getElementById('xzmcss')) return;
    var st = document.createElement('style'); st.id = 'xzmcss';
    st.textContent =
      '.xzs{cursor:pointer;border-radius:4px;-webkit-box-decoration-break:clone;box-decoration-break:clone}' +
      '.xzs.spk-now{background:rgba(108,147,209,.28);box-shadow:inset 0 0 0 999px rgba(108,147,209,.0)}' +
      'table.spk-now,.spk-now>table{background:rgba(108,147,209,.18)}' +
      '.xzhint{font-size:.78em;line-height:1.6;color:#6b6b6b;background:rgba(156,107,24,.1);border-radius:10px;padding:7px 11px;margin-top:8px}' +
      '.xzs.xzflash{animation:xzfl 1.7s ease}' +
      '@keyframes xzfl{0%,60%{background:#FFE9A8}100%{background:transparent}}' +
      'html[data-dark="1"] .xzs.spk-now,html[data-theme=dark] .xzs.spk-now{background:rgba(120,160,230,.34)}' +
      'html[data-dark="1"] .xzhint,html[data-theme=dark] .xzhint{color:#bdb8aa;background:rgba(255,230,160,.1)}' +
      '@media (prefers-color-scheme:dark){html:not([data-theme=light]) .xzhint{color:#bdb8aa;background:rgba(255,230,160,.1)}}' +
      (A.css || '');
    document.head.appendChild(st);
  }

  /* ── 安裝 ───────────────────────────────────────────────────── */
  function install(adapter) {
    if (A) return false;
    A = adapter;
    css();
    wrapEngine();
    g(function () { if (A.hook) A.hook(); });
    restore();
    watch();
    scan();
    return true;
  }
  window.XZM = {
    version: 'xzm1103-g', install: install, tap: tap, scan: scan, watch: watch, persist: persist, restore: restore,
    speakMsg: speakMsg, sayFrom: sayFrom, jump: jump, begin: begin, mark: mark, clearMarks: clearMarks, endReading: endReading,
    stopEngine: stopEngine, scrollToEl: scrollToEl, holdScroll: function () { ST.hold = Date.now() + HOLD_MS; },
    T: T, esc: esc, g: g, arr: arr, splitSent: splitSent, tagHtml: tagHtml, plain: plain, endP: endP, tableText: tableText, defaultUnits: defaultUnits,
    parse: parse, isZ: isZ, msgById: msgById, idOf: idOf, sentEl: sentEl, sentText: sentText, newId: newId,
    state: function () { return ST; }, adapter: function () { return A; }, preset: {}
  };
})();

/* ═══ preset.gx：SAGE321（gxa.js 或內嵌的 v2.0.0 核心）＋ GXA.hl 畫線面板 ＋ TTS321 朗讀（gxr.js）══════════════
   host 需要：window.SAGE321（msgs／draw／open／isBusy／speak）、window.GXA.hl（attach／tap／paint／db）
   朗讀：window.TTS321 + window.GXR.speak（用來先把 TTS321 初始化）；沒有 TTS321 就不接管 🔊（宿主照舊朗讀）
   opts.slug 畫線資料庫的前綴（預設 GXA_CFG.slug）；opts.nar=false 關掉用 NAR321 補口語帶入詞 */
XZM.preset.gx = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T;
  var SLUG = o.slug || g(function () { return GXA_CFG.slug; }, 'app');
  var KEY = SLUG + '-xz';
  var NODE = /^gxxzm(\d+)$/;
  function root() { return document.getElementById('gxaxz'); }
  function nodeAt(i) { return document.getElementById('gxxzm' + i); }
  function dbKeys() { var d = g(function () { return GXA.hl.db(); }, {}), p = KEY + '|'; return Object.keys(d).filter(function (k) { return k.indexOf(p) === 0; }); }

  /* ── 朗讀單元（口語帶入詞用 NAR321；與講義版同做法）─────────────────── */
  function blockMd(blk) {
    if (blk.k === 'h') return new Array(blk.n + 1).join('#') + ' ' + blk.t;
    if (blk.k === 'table') {
      var hd = blk.head, hh = '| ' + hd.join(' | ') + ' |\n|' + hd.map(function () { return '---'; }).join('|') + '|';
      return hh + '\n' + blk.rows.map(function (r) { return '| ' + r.join(' | ') + ' |'; }).join('\n');
    }
    return '';
  }
  function listHeads(blk, bi) {
    var n = blk.items.length, j, mk1 = [], mk2 = [], p1, p2, heads = [], ends = [], pre = blk.ord ? function (x) { return (x + 1) + '. '; } : function () { return '- '; };
    for (j = 0; j < n; j++) { mk1.push(pre(j) + 'ǂ' + j + 'ǂ'); mk2.push(pre(j) + 'ǂ' + j + 'ǂ。'); }
    p1 = NAR321.speech(mk1.join('\n'), { i: bi }).split(/ǂ\d+ǂ/);
    p2 = NAR321.speech(mk2.join('\n'), { i: bi }).split(/ǂ\d+ǂ。/);
    if (p1.length !== n + 1 || p2.length !== n + 1) return null;
    for (j = 0; j < n; j++) {
      heads.push(j === 0 ? p1[0] : p2[j]);
      var a = p1[j + 1], b = p2[j + 1];
      ends.push(j < n - 1 ? (a.length >= b.length && a.slice(a.length - b.length) === b ? a.slice(0, a.length - b.length) : '') : a);
    }
    return { heads: heads, ends: ends };
  }
  function narUnits(node, m) {
    if (o.nar === false || !window.NAR321 || !NAR321.blocks || !NAR321.speech) return null;
    var body = node.querySelector('.xzt'), kids = arr(body ? body.children : []).filter(function (x) { return !x.classList.contains('xzhint'); });
    var bl = g(function () { return NAR321.blocks(m.text); }, null), us = [];
    if (!(bl && bl.length === kids.length)) return null;
    function U(t, spans, whole) {
      if (!t || !String(t).replace(/\s+/g, '')) return;
      us.push({ t: t, keys: spans.map(function (s) { return s.getAttribute('data-xk'); }), whole: !!whole });
    }
    function sp(el) { return X.sentText(el); }
    kids.forEach(function (el, b) {
      var spans = arr(el.querySelectorAll('.xzs')), blk = bl[b], done = false, n0 = us.length;
      if (!spans.length) return;
      try {
        if (blk.k === 'h') { U(NAR321.speech(blockMd(blk), { i: b }), spans); done = true; }
        else if (blk.k === 'table') { U(NAR321.speech(blockMd(blk), { i: b }), spans, true); done = true; }
        else if (blk.k === 'quote') {
          var lead = NAR321.speech('> ǂ', { i: b }).replace('ǂ', '');
          spans.forEach(function (s, j) { U((j === 0 ? lead : '') + X.endP(sp(s)), [s]); }); done = true;
        } else if (blk.k === 'list') {
          var lh = listHeads(blk, b), lis = arr(el.querySelectorAll('li'));
          if (lh && lis.length === blk.items.length) {
            lis.forEach(function (li, j) {
              var ss = arr(li.querySelectorAll('.xzs'));
              ss.forEach(function (s, q) {
                var tx = sp(s), last = q === ss.length - 1;
                U((q === 0 ? lh.heads[j] : '') + tx + (last && !/[。！？.!?]$/.test(tx) ? lh.ends[j] : ''), [s]);
              });
            });
            done = true;
          }
        }
      } catch (e) { done = false; us.length = n0; }
      if (!done) spans.forEach(function (s) { U(X.endP(sp(s)), [s]); });
    });
    return us.length ? us : null;
  }

  var HEAD = 'h1,h2,h3,h4,h5,h6';
  var A = {
    css: '.gxz .xzh>.xs{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +          /* 英文 320 寬標題列會把 ✕ 擠出畫面 */
         '.gxz .xzs.spk-now{background:rgba(31,77,61,.20)}.gxz table.spk-now{background:rgba(31,77,61,.12)}' +
         '@media (prefers-color-scheme:dark){.gxz .xzs.spk-now{background:rgba(120,190,150,.30)}}',
    lang: function () { var l = g(function () { return GXA_CFG.lang(); }, 'zh'); return l === 'en' ? 'en' : (l === 'zs' || l === 'sc' ? 'sc' : 'tc'); },
    toast: function (m) { g(function () { GXA.toast(m); }); },
    msgs: function () { return SAGE321.msgs(); },
    isDone: function (m) { return !!(m && m.role === 'assistant' && m.ok && !m.cont); },
    isUser: function (m) { return !!(m && m.role === 'user'); },
    busy: function () { return SAGE321.isBusy(); },
    open: function () { SAGE321.open(); },
    root: root,
    msgSel: '.xzm',
    nodeAt: nodeAt,
    msgAt: function (i) { return SAGE321.msgs()[i]; },
    bodyOf: function (node) { return node.querySelector('.xzt'); },
    scroller: function () { return document.getElementById('gxxzb'); },
    follow: function () { return true; },
    hint: true,
    answers: function () {
      var a = SAGE321.msgs(), out = [];
      arr(document.querySelectorAll('#gxaxz .xzm.assistant')).forEach(function (node) {
        var mm = NODE.exec(node.id), i = mm ? +mm[1] : -1, m = a[i];
        if (m) out.push({ node: node, body: node.querySelector('.xzt'), m: m, i: i, last: i === a.length - 1 });
      });
      return out;
    },
    units: function (node, m, i, dflt) { return narUnits(node, m) || dflt(node); },
    /* 先前存的小智訊息 → 放回 SAGE321 */
    store: o.store === false ? null : {
      get: function () { try { return JSON.parse(localStorage.getItem('xzm_' + SLUG) || 'null'); } catch (e) { return null; } },
      set: function (l) { try { localStorage.setItem('xzm_' + SLUG, JSON.stringify(l)); } catch (e) {} }
    },
    restore: function (list) {
      var a = SAGE321.msgs();
      if (a.length) return;
      list.forEach(function (x) { var m = { role: x.role, text: x.text, xid: x.id, at: x.at }; if (x.role === 'assistant') m.ok = true; a.push(m); });
      g(function () { SAGE321.draw(true); });
    },
    /* 畫線：GXA.hl（和正文同一個資料庫、同一個面板） */
    marks: {
      any: function () { return dbKeys().length > 0; },
      attach: function (r) {
        if (!r || !window.GXA || !GXA.hl) return;
        GXA.hl.attach(r, {
          unit: '.xzs', key: KEY, bind: false, head: HEAD + ',.xzhint',
          idOf: function (el) { return el.getAttribute('data-xk'); },
          refOf: function (el) { return refOf(el); },
          readFrom: function (el) { X.sayFrom(el); }
        });
      },
      paint: function (r) { if (r && r.__gxhl && window.GXA && GXA.hl) GXA.hl.paint(r); },
      tap: function (xk, el) { GXA.hl.tap(el); },
      keys: dbKeys
    },
    /* 朗讀引擎：TTS321（gxr.js）*/
    engine: window.TTS321 && window.GXR ? {
      ready: function () { g(function () { GXR.speak(''); }); },
      state: function () { return { on: g(function () { return TTS321.isOn(); }, false), i: g(function () { return TTS321.index(); }, -1) }; },
      stop: function () { g(function () { TTS321.stop(); }); },
      chunks: function (t) { return g(function () { return TTS321.chunks(t); }, []) || []; },
      play: function (parts, title) { this.ready(); TTS321.play(parts.map(function (u) { return { t: u.t, els: [] }; }), { title: title }); },   /* els:[] 讓 gxr.js 的 elFor 不會因為沒有元素而丟錯 */
      wrap: function (onOther) {
        ['play', 'playFrom'].forEach(function (n) {
          var f = TTS321[n]; if (typeof f !== 'function' || f.__xzm) return;
          TTS321[n] = function () { onOther(); return f.apply(this, arguments); };
          TTS321[n].__xzm = 1;
        });
      }
    } : null,
    syncBtn: function (rd) {
      arr(document.querySelectorAll('#gxaxz .xzm.assistant')).forEach(function (node) {
        var mm = NODE.exec(node.id), i = mm ? +mm[1] : -1, m = SAGE321.msgs()[i];
        arr(node.querySelectorAll('.xzact button')).forEach(function (b) {
          if ((b.getAttribute('onclick') || '').indexOf('SAGE321.speak(') < 0) return;
          var on = !!(rd && m && rd.mid === m.xid && rd.kind === 'msg');
          if (b.getAttribute('data-xzl') == null) b.setAttribute('data-xzl', b.textContent);
          b.textContent = on ? '⏹ ' + T('停止', 'Stop') : b.getAttribute('data-xzl');
          b.classList.toggle('on', on);
        });
      });
    },
    hook: function () {
      var s0 = SAGE321.speak;
      SAGE321.speak = function (i) { if (A.engine && X.speakMsg(i)) return; return s0.apply(this, arguments); };
      var o0 = SAGE321.open;
      SAGE321.open = function () { X.restore(); return o0.apply(this, arguments); };
    }
  };
  function refOf(el) {
    var id = X.parse(el.getAttribute('data-xk')).id, m = X.msgById(id), at = m && m.at;
    return T('小智', 'Xiaozhi') + (at ? ' · ' + g(function () { return new Date(at).toLocaleDateString(); }, '') : '');
  }
  return A;
};

/* ═══ preset.lesson：課程型 App（321mission／321life 這一系：S.chat 或 CHAT、S.hl 或 HL、spk 逐句朗讀、#xz 滿版小智）══
   畫線：把小智的句子做成宿主的 .sent（同一套 sentList／paintHl／openHlSheet／hlKeyOf），所以換色、領受、做成美圖、問小智、
        複製、分享、刪除全是宿主原本的面板與資料（HL 或 S.hl），不另存一份。
   朗讀：宿主的 spk（page 朗讀）佇列，一句一個項目，由宿主的 raSeg 加 .tts-reading 並捲到畫面中央。
   兩種宿主的差別由偵測決定：
     mission 型：S.chat／S.hl／hlRoot()，sentList(root)、paintHl(root)、區塊要有 data-l／data-b（我們補在回答的頂層區塊上）
     life 型   ：CHAT／HL，sentList()、paintHl()，區塊代號放在句子的 data-k
   opts.msgSel／ttsSel 等可覆寫；opts.noNow 不改 RA_COOL                                                    */
XZM.preset.lesson = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T;
  var MIS = g(function () { return typeof hlRoot === 'function' && typeof S !== 'undefined' && !!S.hl && Array.isArray(S.chat); }, false);
  function CH() { return MIS ? S.chat : CHAT; }
  function HLS() { return MIS ? S.hl : HL; }
  function saveChatHost() { g(function () { if (MIS) save(); else saveChat(); }); }
  function saveHlHost() { g(function () { if (MIS) save(); else saveHL(); }); }
  function root() { return document.getElementById('xz'); }
  function lastOkIdx() { var a = CH(), i; for (i = a.length - 1; i >= 0; i--) if (a[i].role !== 'user') return A.isDone(a[i]) ? i : -1; return -1; }
  function chatEls() { var r = root(); return r ? arr(r.querySelectorAll('.sent.xzs')) : []; }
  function isChatEl(e) { return !!(e && e.classList && e.classList.contains('xzs') && e.closest && e.closest('#xz')); }
  function zRec(k) { return /^[a-z]+\|z:/.test(k); }
  function zKeys() { var h = HLS(), out = [], k; for (k in h) if (h.hasOwnProperty(k) && zRec(k) && (h[k].lang || 'zh') === g(function () { return L(); }, 'zh')) out.push(k); return out; }
  function refFor(el) {
    var id = X.parse(el.getAttribute('data-xk')).id, m = X.msgById(id), at = m && (m.ts || m.at);
    return T('小智', 'Xiaozhi') + (at ? ' · ' + g(function () { return new Date(at).toLocaleDateString(); }, '') : '');
  }
  function xkOfRec(h) { return h && h.xk ? h.xk : ''; }

  XZM._mis = MIS;
  var A = {
    lang: function () { var l = g(function () { return L(); }, 'zh'); return l === 'en' ? 'en' : (l === 'zs' ? 'sc' : 'tc'); },
    toast: function (m) { g(function () { toast(m); }); },
    msgs: function () { return CH(); },
    isDone: function (m) { return !!(m && m.role !== 'user' && m.ok && !m.wait && !m.cont && !m.err); },
    isUser: function (m) { return !!(m && m.role === 'user'); },
    busy: function () { return g(function () { return !!chatBusy; }, false); },
    open: function () { g(function () { openXz(); }); },
    root: root,
    msgSel: '.msg',
    nodeAt: function (i) { return document.getElementById('msg' + i); },
    msgAt: function (i) { return CH()[i]; },
    bodyOf: function (node) { return node.querySelector('.msg-body'); },
    scroller: function () { return document.getElementById('xzb'); },
    follow: function () { return true; },
    hint: true,
    /* 句子＝宿主的 .sent；life 型靠 data-k（區塊代號）、mission 型靠區塊上的 data-l／data-b */
    cls: 'sent',
    attrs: function (id, b, s, xk) { return MIS ? ' data-s="' + s + '"' : ' data-k="z:' + id + ':' + b + '" data-s="' + s + '"'; },
    idOf: function (m) { if (!m.xid) { m.xid = X.newId(); saveChatHost(); } return m.xid; },
    decorate: function (body, id) {
      var i = 0;
      arr(body.children).forEach(function (el) {
        if (el.classList.contains('xzhint') || !el.querySelector('.xzs')) return;
        el.setAttribute('data-xzb', '1'); el.setAttribute('data-l', 'z:' + id); el.setAttribute('data-b', String(i++));
        el.setAttribute('data-rf', T('小智', 'Xiaozhi'));
      });
    },
    answers: function () {
      var a = CH(), lk = lastOkIdx(), out = [];
      arr(document.querySelectorAll('#xz .msg.ai')).forEach(function (node) {
        var i = +String(node.id).replace('msg', ''), m = a[i];
        if (m) out.push({ node: node, body: node.querySelector('.msg-body'), m: m, i: i, last: i === lk });
      });
      return out;
    },
    marks: {
      any: function () { return zKeys().length > 0; },
      attach: function () { },
      paint: function () { g(function () { if (MIS) { paintHl(hlRoot()); } else paintHl(); }); },
      tap: function (xk, el) {
        var k = g(function () { return hlKeyOf(el); }, null);
        onSentTap(el);
        var r = k && HLS()[k];
        if (r && !r.xk) { r.xk = xk; saveHlHost(); }
        else if (!k) { var k2 = g(function () { return hlKeyOf(el); }, null); if (k2 && HLS()[k2] && !HLS()[k2].xk) { HLS()[k2].xk = xk; saveHlHost(); } }
      },
      keys: zKeys
    },
    /* 逐句朗讀：把句子排進宿主的 spk 佇列 */
    beginMsg: function (i, m, node, units, id, isFrom) {
      var key = 'm' + (i >= 0 ? i : CH().indexOf(m));
      if (!isFrom && g(function () { return sayKey === key && spk.on; }, false)) { stopAll(); return true; }
      if (node.classList.contains('fold')) g(function () { msgFold(CH().indexOf(m), true); });
      var items = [];
      units.forEach(function (u) {
        var els = u.keys.map(X.sentEl).filter(Boolean);
        if (u.whole && els[0]) { var tb = els[0].closest('table'); if (tb) els = [tb]; }
        var t = u.t;
        if (!els.length || !g(function () { return ttsPrep(t); }, t)) return;
        items.push({ text: t, segs: els, lens: [Math.max(1, g(function () { return ttsPrep(t).length; }, t.length))], locs: [], xks: u.keys.slice(), at: -1 });
      });
      if (!items.length) return false;
      stopAll(); ttsUnlock();
      var ttl = T('小智', 'Xiaozhi');
      spk = { on: true, items: items, idx: 0, cache: {}, native: false, abort: false, title: ttl };
      raManualAt = 0; sayKey = key;
      g(function () { keepAwake(true); }); g(function () { mediaSession(ttl); }); g(function () { drawFab(); });
      g(function () { paintSay(); });
      ttsPlayFrom(0);
      return true;
    },
    /* 聊天視窗重畫之後：把朗讀佇列裡的句子元素換成新的，現在唸到的那句重新亮起 */
    afterScan: function (tagged) {
      if (!tagged || !g(function () { return spk.on; }, false)) return;
      var cur = null;
      spk.items.forEach(function (it, j) {
        if (!it.xks) return;
        var els = it.xks.map(X.sentEl).filter(Boolean);
        if (els.length) { if (it.segs[0] && it.segs[0].tagName === 'TABLE') { var tb = els[0].closest('table'); if (tb) els = [tb]; } it.segs = els; }
        if (j === spk.idx) cur = it;
      });
      if (cur && cur.at >= 0) {
        var k = cur.at, keep = raManualAt; cur.at = -1; raManualAt = Date.now(); raSeg(cur, k); raManualAt = keep;
      }
    },
    syncBtn: function () { g(function () { paintSay(); }); },
    beforeMark: function (el) {
      var n = el.closest && el.closest('.msg');
      if (n && n.classList.contains('fold')) g(function () { msgFold(+String(n.id).replace('msg', ''), true); });
    },
    hook: function () {
      /* 1) 句子清單：不帶參數＝宿主的 hl 操作（含小智）；帶 root 參數＝只看那個 root（朗讀整頁不會唸到小智）*/
      var SL0 = window.sentList;
      if (MIS) window.sentList = function (r) { var l = SL0.apply(this, arguments); return r ? l : l.concat(chatEls()); };
      else window.sentList = function () { return SL0.apply(this, arguments).concat(chatEls()); };
      /* 2) 區塊／出處／畫線重畫 */
      var BK0 = window.blkOf;
      window.blkOf = function (el) {
        var tb = isChatEl(el) ? el.closest('table') : null;
        if (MIS) { var z = el && el.closest && el.closest('#xz [data-xzb]'); if (z) return z; }
        else if (tb) return tb;
        return BK0.apply(this, arguments);
      };
      var HR0 = window.hlRef;
      window.hlRef = function (x) {
        var e = Array.isArray(x) ? x[0] : x;
        if (isChatEl(e)) return refFor(e);
        return HR0.apply(this, arguments);
      };
      var PH0 = window.paintHl;
      window.paintHl = function (r) {
        var rr = root();
        if (rr) arr(rr.querySelectorAll('.hl-note')).forEach(function (n) { n.parentNode.removeChild(n); });
        var res = PH0.apply(this, arguments);
        if (MIS && r && r === hlRoot() && rr) PH0.call(this, rr);
        return res;
      };
      /* 3) 回到原處／我的畫線多一個「小智」類別 */
      if (typeof window.hlGo === 'function') {
        var GO0 = window.hlGo;
        window.hlGo = function (k) {
          var h = HLS()[k];
          if (h && zRec(k)) { var xk = xkOfRec(h); if (xk) X.jump(xk); else A.toast(T('原回答已不在對話中', 'The original answer is no longer in the chat')); return; }
          return GO0.apply(this, arguments);
        };
      }
      var MK0 = window.marksHTML, HLL0 = window.hlListHtml;
      function zSection() {
        var ks = zKeys().sort(function (a, b) { return (HLS()[b].ts || 0) - (HLS()[a].ts || 0); });
        if (!ks.length) return '';
        var h = '', E = X.esc;
        ks.forEach(function (k) {
          var x = HLS()[k], orphan = !(x.xk && X.msgById(X.parse(x.xk).id));
          h += '<div class="hitem"><div class="q" data-color="' + E(x.c) + '" data-c="' + E(x.c) + '">' + E(x.t) + '</div>' + (x.n ? '<div class="n">' + E(x.n) + '</div>' : '') +
            '<div class="m"><span>' + E(x.ref || '') + (orphan ? '　' + E(T('（原回答已不在對話中）', '(the original answer is no longer in the chat)')) : '') + '</span><span>' +
            (orphan ? '' : '<button class="linkbtn" onclick="XZM.jump(\'' + E(x.xk) + '\')">' + E(T('回到原處', 'Go back')) + '</button>') +
            '<button class="linkbtn" onclick="XZM.zCard(\'' + E(k) + '\')">🖼</button>' +
            '<button class="linkbtn" onclick="XZM.zAsk(\'' + E(k) + '\')">✨</button>' +
            '<button class="linkbtn danger" onclick="XZM.zDel(\'' + E(k) + '\')">✕</button></span></div></div>';
        });
        return '<section class="card xzsec"><div class="eyebrow">✨ ' + E(T('小智', 'Xiaozhi')) + '（' + ks.length + '）</div>' + h + '</section>';
      }
      function stashed(fn, self, args) {
        var st = {}, h = HLS();
        zKeys().forEach(function (k) { st[k] = h[k]; delete h[k]; });
        try { return fn.apply(self, args); } finally { Object.keys(st).forEach(function (k) { h[k] = st[k]; }); }
      }
      if (typeof MK0 === 'function') {
        window.marksHTML = function () {
          var h = stashed(MK0, this, arguments), z = zSection();
          if (!z) return h;
          var i = h.lastIndexOf('<section class="card"><div class="eyebrow">');
          return i < 0 ? h + z : h.slice(0, i) + z + h.slice(i);
        };
      }
      if (typeof HLL0 === 'function') {
        window.hlListHtml = function () {
          var h = stashed(HLL0, this, arguments), z = zSection();
          if (!z) return h;
          if (/class="empty"/.test(h)) h = '';
          return h + z;
        };
      }
      /* 4) 🔊 與畫線面板的朗讀：capture 階段攔截，小智頁上才逐句跟讀 */
      var TTS = MIS ? '[data-act="msgtts"]' : '[data-xa="tts"]';
      document.addEventListener('click', function (e) {
        var t = e.target, b = t && t.closest ? t.closest(TTS) : null;
        if (b && b.closest('#xz')) {
          if (X.speakMsg(+b.getAttribute('data-i'))) { e.stopPropagation(); e.preventDefault(); }
          return;
        }
        var nb = t && t.closest ? t.closest('#xz .hl-note') : null;
        if (nb && !g(function () { return !!document.getElementById(MIS ? 'hsheet' : 'sheet'); }, false)) {   /* 點領受條＝打開那一句的面板 */
          var hk = nb.getAttribute('data-hk'), list = chatEls(), q;
          for (q = 0; q < list.length; q++) if (g(function () { return hlKeyOf(list[q]); }) === hk) { e.stopPropagation(); e.preventDefault(); openHlSheet(list[q]); break; }
          return;
        }
        var cur = g(function () { return hlCur; }, null);
        if (!cur || !isChatEl(cur.el)) return;
        var rb = t && t.closest ? t.closest(MIS ? '[data-act="hlread"]' : '[data-ha="read"],[data-ha="from"]') : null;
        if (rb) {
          e.stopPropagation(); e.preventDefault();
          var one = MIS || rb.getAttribute('data-ha') === 'read', el = cur.el;
          g(function () { hlNoteGrab(); }); g(function () { MIS ? closeHSheet() : closeSheet(); });
          g(function () { MIS ? paintHl(hlRoot()) : paintHl(); });
          X.sayFrom(el, one);
        }
      }, true);
      if (!o.noNow && typeof window.RA_COOL === 'number') window.RA_COOL = Math.max(window.RA_COOL, 6000);   /* 使用者自己捲動後 6 秒不搶畫面（宿主原本 4 秒）*/
      /* 5) 句子點擊在 mission 型由我們自己處理（宿主 document 監聽只認 target 本身是 .sent，點到粗體會漏掉）*/
    },
    css: '@media (max-width:360px){#xz .hd{gap:6px;padding-left:10px;padding-right:10px}#xz .hd .btn.sm{padding-left:8px;padding-right:8px}#xz .hd .ib{min-width:36px}}' +
         '#xz .hd .grow{min-width:0}#xz .hd .grow .xs{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
         '.xz table.tts-reading,.xz .tts-reading>table{background:rgba(108,147,209,.22)}' +
         '.xz .msg-body .sent{-webkit-box-decoration-break:clone;box-decoration-break:clone}' +
         '.xz .msg-body .xzhint{margin-top:10px}' +
         /* 宿主的小智視窗層級 >= 面板（ot／soul／truth：xz 80、面板 75）時，面板會被蓋住：只在這種情況把面板抬到視窗之上；層級本來就夠的（mission、pray…）不輸出任何規則 */
         g(function () {
           var t = document.createElement('div'); t.className = 'xz'; t.style.display = 'none'; document.body.appendChild(t);
           var zx = parseInt(getComputedStyle(t).zIndex, 10); document.body.removeChild(t);
           var m = document.createElement('div'); m.className = 'sheet-mask'; m.style.display = 'none'; document.body.appendChild(m);
           var zs = parseInt(getComputedStyle(m).zIndex, 10); document.body.removeChild(m);
           return (zx >= 0 && !(zs > zx)) ? '#hsheet.sheet-mask,#sheet.sheet-mask{z-index:' + (zx + 5) + '}' : '';
         }, '')
  };
  return A;
};
/* 清單裡「小智」項目的按鈕動作 */
XZM.zCard = function (k) { var h = XZM.g(function () { return (typeof S !== 'undefined' && S.hl && S.hl[k]) || HL[k]; }); if (h && window.openStudio) openStudio({ t: h.t, ref: h.ref, n: h.n }); };
XZM.zAsk = function (k) {
  var h = XZM.g(function () { return (typeof S !== 'undefined' && S.hl && S.hl[k]) || HL[k]; });
  if (!h) return;
  var q = XZM.T('請就這句幫助我默想：', 'Please help me reflect on this: ') + '「' + h.t + '」' + (h.n ? '\n' + XZM.T('我的領受：', 'My reflection: ') + h.n : '');
  XZM.g(function () { if (XZM._mis) openXz(q, undefined, { t: h.t, ref: h.ref }); else openXz(q, { t: h.t, ref: h.ref }); });
};
XZM.zDel = function (k) {
  var H = XZM.g(function () { return (typeof S !== 'undefined' && S.hl) ? S.hl : HL; });
  if (H && H[k]) { delete H[k]; XZM.g(function () { if (typeof S !== 'undefined' && S.hl) save(); else saveHL(); }); }
  XZM.g(function () { if (typeof S !== 'undefined' && S.hl) { render(); } else { keepScroll(); } });
};
/* ═══ preset.sage：「課程＋AI 小智」範本（235leader／321assistant／321head／321leader／321student／321creation）══════════
   這一系的宿主已經自己做完：
     · 小智回答 .msg.ai[data-mid] 放在 #chatlog（我的收藏 #favlog），完成後 bindBodies → wrapSents(b,'chat|'+mid) 切成 .sent
     · 畫線：HLS['chat|mid|區塊|句'] ＋ paintHl／onSentTap／openHlSheet（點一下畫線、再點開面板）
     · 朗讀：spk 佇列 ＋ ttsPlayFrom ＋ raSeg（加 .tts-reading 並捲到畫面中央）
     · 訊息保存：S.chat（或 localStorage CHATKEY），m.id 穩定，最多 40 則
   所以本 preset 不切句、不另存畫線，只補宿主缺的三件事：
     1) 🔊 逐句跟讀：把回答的 .sent 一句一個項目排進宿主的 spk，由宿主的 ttsPlayFrom／raSeg 高亮與捲動；
        表格整張高亮（一列一個朗讀單位，高亮整張 table）；已收合的回答先展開；串流／接續寫作中不接管（宿主照舊整段念）
     2) 畫線面板「朗讀這句」：小智句子改成單句（含「範圍」多句）逐句高亮，不再整段念不高亮
     3) 手動捲動保護 6 秒（RA_COOLDOWN 拉到 ≥ 6000，再補鍵盤捲動）
   補洞：宿主的 mdToHtml 對「## 標題\n緊接的文字」不包 <p>，這些頂層裸文字不在 [data-b] 區塊裡，wrapSents 完全沒切到——不能點、朗讀也會漏唸。
        本 preset 在宿主畫完之後，把頂層裸文字節點用宿主自己的 wrapSents 補切（key＝chat|mid|x<節點序>|句，不動既有區塊的 key），
        唸的時候相鄰的「粗體開頭＋後面的裸文字」合成一個朗讀單位（同時亮起）。
   宿主頁面重畫（收合、收藏、送出新問題）後，把 spk 項目裡的句子元素換成新節點、現在唸到的那句重新亮起。
   取得宿主內部函式的方式：window.XZM_HOST（宿主在 IIFE 內時由宿主放一個小掛鉤，321creation 用）；沒有就直接讀全域。
   XZM_HOST = { fn:{wrapSents,groups,gText,rootOf,ttsPrep,ttsStop,ttsSayStop,ttsUnlock,ttsBtn,ttsPlayFrom,raSeg,wake?,saveHl,paintHl,msgAction},
                spk(v?), reset(), manual(), cool(ms), busy(), audio(), list(where), hls() }                                                    */
XZM.preset.sage = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T;
  var COOL = o.cool || 6000;
  var lastTap = '';                                   /* 最後一次點的 .sent 的畫線 key（面板「朗讀這句」要知道是哪一句）*/

  /* ── 宿主橋接：IIFE 宿主給 XZM_HOST；全域宿主直接讀 window ───────────────── */
  function H() {
    if (window.XZM_HOST) return window.XZM_HOST;
    return {
      fn: window,
      spk: function (v) { if (v) window.spk = v; return window.spk; },
      manual: function () { window.raManualAt = Date.now(); },
      reset: function () { window.raManualAt = 0; },
      cool: function (ms) { if (typeof window.RA_COOLDOWN === 'number' && window.RA_COOLDOWN < ms) window.RA_COOLDOWN = ms; },
      busy: function () { return !!window.chatBusy; },
      audio: function () { return window.ttsEl; },
      list: function (w) { return w === 'fav' ? window.FAV : window.CHAT; },
      hls: function () { return window.HLS; }
    };
  }
  function F(n) { var h = H(); return (h.fn && h.fn[n]) || null; }
  function SP() { return g(function () { return H().spk(); }, null); }
  function isEn() { return /^en/i.test(document.documentElement.lang || ''); }

  /* ── 補切頂層裸文字（宿主 wrapSents 漏掉的）────────────────────────── */
  var BLOCK = /^(P|UL|OL|DL|H[1-6]|BLOCKQUOTE|TABLE|DIV|PRE|HR|SECTION|FIGURE|DETAILS)$/;
  function fixLoose(body) {
    if (body.getAttribute('data-xzl') || !body.querySelector('.sent')) return false;
    var mid = body.parentNode && body.parentNode.getAttribute('data-mid'), ws = F('wrapSents'), done = 0;
    if (!mid || !ws) return false;
    body.setAttribute('data-xzl', '1');
    arr(body.childNodes).forEach(function (nd, i) {
      if (nd.nodeType !== 3 || !/\S/.test(nd.nodeValue)) return;
      var outer = document.createElement('span'), inner = document.createElement('p');   /* P：各宿主的領受條都掛在 P 後面（321creation 的清單不含 DIV）；CSS 讓它維持行內 */
      inner.setAttribute('data-b', 'x' + i); inner.className = 'xzl';
      inner.appendChild(document.createTextNode(nd.nodeValue));
      outer.appendChild(inner);
      ws(outer, 'chat|' + mid);
      body.replaceChild(inner, nd); done++;
    });
    if (done) g(function () { F('paintHl')(); });
    return done > 0;
  }
  function fixAll() { arr(document.querySelectorAll('#chatlog .msg.ai .msg-body,#favlog .msg.ai .msg-body')).forEach(function (b) { g(function () { fixLoose(b); }); }); }
  function topOf(body, el) { while (el && el.parentNode !== body) el = el.parentNode; return el; }
  function nextSib(n) { n = n && n.nextSibling; while (n && n.nodeType === 3 && !/\S/.test(n.nodeValue)) n = n.nextSibling; return n; }
  var ENDP = /[。！？.!?][」』）)"”’]*$/;

  /* ── 朗讀單位 ──────────────────────────────────────────────────── */
  function cellText(c) { return (c.textContent || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, ''); }
  function tableUnits(tb, idx, keys) {
    var rows = arr(tb.querySelectorAll('tr')).map(function (tr) { return arr(tr.children).map(cellText).filter(Boolean); }).filter(function (r) { return r.length; });
    var head = rows[0] || [], body = rows.slice(1), en = isEn(), out = [];
    function U(t) { out.push({ t: t, keys: keys, tb: idx }); }
    if (!body.length) { if (head.length) U(X.endP(head.join(en ? ', ' : '，'))); return out; }
    body.forEach(function (r, i) {
      var s = r.map(function (c, j) { var hh = head[j] || ''; c = c.replace(/[。！？.!?]+$/, ''); return hh && r.length > 1 ? (en ? hh + ' is ' + c : hh + '是' + c) : c; }).join(en ? ', ' : '，') + (en ? '.' : '。');
      U((i === 0 ? (en ? 'Here is a summary: ' : '下面用表格整理：') : '') + s);
    });
    return out;
  }
  function unitsOf(body) {
    var gs = g(function () { return F('groups')(body); }, []), gText = F('gText'), tbs = arr(body.querySelectorAll('table')), seen = {}, out = [], prev = null;
    gs.forEach(function (gr) {
      var tb = gr.els[0] && gr.els[0].closest ? gr.els[0].closest('table') : null, ti = tb ? tbs.indexOf(tb) : -1;
      if (ti >= 0) {
        prev = null;
        if (seen[ti]) return;
        seen[ti] = 1;
        var ks = {}, kl = [];
        gs.forEach(function (x) { if (x.els[0] && tb.contains(x.els[0]) && !ks[x.k]) { ks[x.k] = 1; kl.push(x.k); } });
        tableUnits(tb, ti, kl).forEach(function (u) { out.push(u); });
        return;
      }
      var t = gText(gr);
      if (!t) return;
      var tf = topOf(body, gr.els[0]), tl = topOf(body, gr.els[gr.els.length - 1]);
      if (prev && !ENDP.test(prev.raw) && prev.tl && tf && !BLOCK.test(prev.tl.tagName || '') && !BLOCK.test(tf.tagName || '') && nextSib(prev.tl) === tf) {
        prev.raw += (isEn() ? ' ' : '') + t; prev.keys.push(gr.k); prev.tl = tl; return;       /* 粗體開頭＋後面的裸文字：同一句 */
      }
      prev = { raw: t, keys: [gr.k], tl: tl };
      out.push(prev);
    });
    return out.map(function (u) { return u.raw === undefined ? u : { t: X.endP(u.raw), keys: u.keys, tb: -1 }; });
  }
  function elsOf(body, u) {
    if (u.tb >= 0) { var tb = body.querySelectorAll('table')[u.tb]; return tb ? [tb] : []; }
    var out = [];
    u.keys.forEach(function (k) { arr(body.querySelectorAll('.sent')).forEach(function (e) { if (e.getAttribute('data-k') === k) out.push(e); }); });
    return out;
  }
  function nodeOfMid(mid, where) {
    var log = document.getElementById(where === 'fav' ? 'favlog' : 'chatlog'), n = null;
    if (!log) return null;
    arr(log.querySelectorAll('.msg.ai')).forEach(function (x) { if (x.getAttribute('data-mid') === mid) n = x; });
    return n;
  }

  /* ── 開唸：一句一個項目排進宿主的 spk ─────────────────────────────── */
  function start(node, units, one, btn) {
    var body = node.querySelector('.msg-body'), prep = F('ttsPrep'), items = [], h = H();
    if (!body || !prep) return false;
    units.forEach(function (u) {
      var els = elsOf(body, u), n = g(function () { return prep(u.t).length; }, 0);
      if (els.length && n > 0) items.push({ text: u.t, segs: [els], lens: [Math.max(1, n)], at: -1, u: u });
    });
    if (!items.length) return false;
    var mid = node.getAttribute('data-mid'), where = node.parentNode && node.parentNode.id === 'favlog' ? 'fav' : 'chat';
    /* 只有「正在唸」才先停；閒置時不呼叫 ttsStop（它會 pause 已播完的 audio，Chromium 會補發 ended，舊的 onended 就把新佇列結束掉）*/
    var sp0 = SP();
    if (sp0 && sp0.on) F('ttsStop')(); else { var ss = F('ttsSayStop'); if (ss) ss(); }
    /* 宿主 ttsUnlock 在還沒解鎖成功時會再播一次靜音 wav，它的 ended 會觸發上一輪遺留的 onended → 新佇列被直接結束；先清掉舊處理器 */
    g(function () { var au = h.audio && h.audio(); if (au) { au.onended = null; au.onerror = null; au.ontimeupdate = null; } });
    F('ttsUnlock')();
    g(function () { h.reset(); });                                  /* 開唸時第一句一定捲到畫面中央 */
    g(function () { h.cool(COOL); });
    var label = btn ? btn.textContent : '';
    h.spk({ on: true, items: items, idx: 0, cache: {}, native: false, abort: false, btn: one ? null : btn, label: label || '🔊', root: 'xzm-sage', sage: { mid: mid, where: where, one: !!one } });
    g(function () { var w = F('wake'); if (w) w(true); });
    F('ttsBtn')('loading');
    F('ttsPlayFrom')(0);
    return true;
  }
  /* 收合的回答先展開（用宿主自己的「展開」動作，會存 col 並重畫、保留捲動位置）*/
  function unfold(node) {
    if (!node.classList.contains('col')) return node;
    var mid = node.getAttribute('data-mid'), where = node.parentNode.id === 'favlog' ? 'fav' : 'chat', mb = node.querySelector('.msg-more');
    if (mb) g(function () { F('msgAction')({ target: mb }); });
    return nodeOfMid(mid, where) || node;
  }
  function speakBtn(btn) {
    var node = btn.closest('.msg.ai');
    if (!node || H().busy()) return false;                          /* 接續寫作中：宿主照舊 */
    var sp = SP(), mid = node.getAttribute('data-mid'), where = btn.getAttribute('data-w') || 'chat';
    if (sp && sp.on && sp.sage && sp.sage.mid === mid && sp.sage.where === where) { F('ttsStop')(); return true; }   /* 再按一次＝停止 */
    if (!node.querySelector('.sent')) return false;
    node = unfold(node);
    g(function () { fixLoose(node.querySelector('.msg-body')); });
    btn = node.querySelector('.msg-act[data-a="tts"]') || btn;
    var units = unitsOf(node.querySelector('.msg-body'));
    if (!units.length) return false;
    return start(node, units, false, btn);
  }
  /* 面板的「朗讀這句」：小智句子 → 單句（或畫線範圍內的幾句）逐句高亮 */
  function speakHl(mask) {
    var k = lastTap, hls = g(function () { return H().hls(); }, null), hh = hls && hls[k], q = document.getElementById('hlQuote');
    if (!hh || !/^chat\|/.test(k) || !q || q.textContent !== hh.t) return false;
    var first = document.querySelector('.sent[data-k="' + k + '"]'), body = first && F('rootOf')(first), node = body && body.closest('.msg.ai');
    if (!node) return false;
    var gs = F('groups')(body), i = -1, j, units = [], gText = F('gText'), n = Math.max(1, +hh.sp || 1);
    for (j = 0; j < gs.length; j++) if (gs[j].k === k) { i = j; break; }
    if (i < 0) return false;
    for (j = i; j < i + n && j < gs.length; j++) { var t = gText(gs[j]); if (t) units.push({ t: X.endP(t), keys: [gs[j].k], tb: -1 }); }
    if (!units.length) return false;
    var ta = document.getElementById('hlNote');
    if (ta) hh.n = ta.value.replace(/^\s+|\s+$/g, '');
    g(function () { F('saveHl')(); });
    if (mask && mask.parentNode) mask.parentNode.removeChild(mask);
    g(function () { F('paintHl')(); });
    return start(node, units, true, null);
  }

  /* ── 宿主重畫之後把朗讀佇列接回新的節點 ─────────────────────────────── */
  var rebinding = false;
  function rebind() {
    var sp = SP();
    if (rebinding || !sp || !sp.on || !sp.sage) return;
    var cur = sp.items[sp.idx] || sp.items[0], probe = cur && cur.segs[0] && cur.segs[0][0];
    if (probe && document.body.contains(probe)) return;
    rebinding = true;
    try {
      var node = nodeOfMid(sp.sage.mid, sp.sage.where), body = node && node.querySelector('.msg-body');
      if (!body) {
        var lg = document.getElementById(sp.sage.where === 'fav' ? 'favlog' : 'chatlog');
        if (lg && g(function () { return H().list(sp.sage.where).every(function (m) { return m.id !== sp.sage.mid; }); }, false)) F('ttsStop')();   /* 這則回答已被刪掉 */
        return;
      }
      sp.items.forEach(function (it) { it.segs = [elsOf(body, it.u)]; });
      var btn = node.querySelector('.msg-act[data-a="tts"]');
      if (!sp.sage.one && btn) { sp.btn = btn; g(function () { F('ttsBtn')('playing'); }); }
      if (cur && cur.at >= 0) {
        var k = cur.at; cur.at = -1;
        var h = H(); g(function () { h.manual(); });                 /* 只重新亮起、不搶畫面 */
        g(function () { F('raSeg')(cur, k); });
      }
    } finally { rebinding = false; }
  }

  var A = {
    lang: function () { var l = document.documentElement.lang || ''; return /^en/i.test(l) ? 'en' : (/Hans|CN/i.test(l) ? 'sc' : 'tc'); },
    toast: function () { },
    msgs: function () { return []; },
    isDone: function () { return false; },
    isUser: function () { return false; },
    busy: function () { return false; },
    root: function () {
      var r = document.getElementById('xzm-sage-root');
      if (!r && document.body) { r = document.createElement('div'); r.id = 'xzm-sage-root'; r.hidden = true; document.body.appendChild(r); }
      return r;
    },
    msgSel: '.msg.ai', nodeAt: function () { return null; }, msgAt: function () { return null; }, bodyOf: function (n) { return n.querySelector('.msg-body'); },
    answers: function () { return []; },                           /* 切句與畫線都是宿主做的，核心不掃描 */
    scroller: function () { return document.scrollingElement || document.documentElement; },
    marks: { attach: function () { }, paint: function () { }, tap: function () { }, keys: function () { return []; }, any: function () { return false; } },
    store: null,
    hook: function () {
      var h = H();
      if (!F('groups') || !F('ttsPlayFrom') || !F('raSeg') || !F('ttsPrep') || !h.spk) return;
      g(function () { h.cool(COOL); });
      /* document capture：🔊（小智訊息）與畫線面板的「朗讀這句」 */
      document.addEventListener('click', function (e) {
        var t = e.target; if (!t || !t.closest) return;
        var s = t.closest('.sent');
        if (s) { lastTap = s.getAttribute('data-own') || s.getAttribute('data-k') || ''; return; }
        var b = t.closest('.msg-act[data-a="tts"]');
        if (b && b.closest('#chatlog,#favlog')) {
          if (speakBtn(b)) { e.stopPropagation(); e.preventDefault(); }
          return;
        }
        var rb = t.closest('.hlsheet-mask [data-a="read"]');
        if (rb && speakHl(rb.closest('.hlsheet-mask'))) { e.stopPropagation(); e.preventDefault(); }
      }, true);
      /* 手動捲動保護：宿主已聽 wheel／touchmove；補鍵盤與拖捲軸，朗讀中才算 */
      window.addEventListener('keydown', function (e) {
        var sp = SP();
        if (sp && sp.on && /^(Arrow|Page)|^(Home|End)$|^ $/.test(e.key || '')) g(function () { H().manual(); });
      });
      window.addEventListener('pointerdown', function (e) {
        var sp = SP();
        if (sp && sp.on && (e.target === document.documentElement || e.target === document.body)) g(function () { H().manual(); });
      }, { passive: true });
      if (window.MutationObserver) new MutationObserver(function () { fixAll(); rebind(); }).observe(document.body, { childList: true, subtree: true });
      fixAll();
    },
    css: '.msg-body p.xzl{display:inline!important;margin:0!important;padding:0!important}.msg-body table.tts-reading,.msg-body table.tts-reading th,.msg-body table.tts-reading td{background:var(--reading,#D6E3F7)}' +
         '.msg-body table.tts-reading{box-shadow:0 0 0 3px var(--reading,#D6E3F7)}'
  };
  XZM.sage = { start: start, units: unitsOf, rebind: rebind, speakBtn: speakBtn, fix: fixAll };
  return A;
};
/* ═══ preset.mix：混合系（G3：課程型宿主＋內嵌 SAGE321 v2 小智＋GXHL 畫線，朗讀走宿主的 spk 頁面朗讀）══════════
   聊天與畫線＝preset.gx（#gxaxz／#gxxzm{i}／.xzt、GXA.hl 資料庫 gxa_hl_<slug>、點一下畫線再點開面板）；
   朗讀＝preset.lesson 的做法：一句一個項目排進宿主的 spk 佇列，由宿主的 ttsPlayFrom／raSeg 加 .tts-reading 並捲到畫面中央
        （宿主沒有 TTS321，所以不用 poll 型引擎）；口語帶入詞照舊用 NAR321（與 SAGE321 原本的 onSpeak 一致）。
   另補：「我的畫線」（宿主 hlListHtml）多一個「✨ 小智」區段；朗讀按鈕狀態（⏹ 停止）；RA_COOL 拉到 ≥ 6000；
        聊天視窗重畫（收合、收藏、送出新問題）後把朗讀佇列接回新節點。
   取得宿主內部函式：宿主在頂層 script（churchlife／seekerlife）就直接讀 window；宿主包在 IIFE 裡（family／marriage／spiritual／work）
   則由宿主放一個只做存取的小掛鉤 window.XZM_MIXHOST：
     { fn:{ttsPrep,ttsUnlock,ttsPlayFrom,stopAll,raSeg,keepAwake,mediaSession}, spk(v?), manual(v?), cool(ms), say(v?)（讀寫 sayKey）, audio()（ttsEl）,
       nextGen?()（有 ttsGen 的宿主）, wrapPaintSay(w), wrapHlList(w), wrapTtsStop?(w)（ttsStop 有 natural 參數、會自動換頁的宿主）, resume?(v?) }       */
XZM.preset.mix = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T;
  var A = XZM.preset.gx(o);
  var SLUG = o.slug || g(function () { return GXA_CFG.slug; }, 'app'), KEY = SLUG + '-xz', NODE = /^gxxzm(\d+)$/;
  var gxCss = A.css || '';
  A.engine = null;                                       /* 宿主沒有 TTS321：🔊 由 beginMsg 接管 */

  function H() {
    if (window.XZM_MIXHOST) return window.XZM_MIXHOST;
    var W = window;
    return {
      fn: W,
      spk: function (v) { if (v) W.spk = v; return W.spk; },
      manual: function (v) { if (v !== undefined) W.raManualAt = v; return W.raManualAt; },
      cool: function (ms) { if (typeof W.RA_COOL === 'number' && W.RA_COOL < ms) W.RA_COOL = ms; },
      say: function (v) { if (v !== undefined) W.sayKey = v; return W.sayKey; },
      audio: function () { return W.ttsEl; },
      wrapPaintSay: function (w) { var f = W.paintSay; if (typeof f === 'function') W.paintSay = function () { var r = f.apply(this, arguments); try { w(); } catch (e) { } return r; }; },
      wrapHlList: function (w) { var f = W.hlListHtml; if (typeof f === 'function') W.hlListHtml = function () { return w(f.apply(this, arguments)); }; }
    };
  }
  function F(n) { return g(function () { return H().fn[n]; }, null); }
  function SP() { return g(function () { return H().spk(); }, null); }
  function spkOn() { var s = SP(); return !!(s && s.on && s.xzm); }
  function spkMid() { var s = SP(); return s && s.xzm ? s.xzm.mid : ''; }

  A.beginMsg = function (i, m, node, units, id, isFrom) {
    var prep = F('ttsPrep'), play = F('ttsPlayFrom');
    if (!prep || !play) return false;
    if (!isFrom && spkOn() && spkMid() === id) { g(function () { F('stopAll')(); }); return true; }      /* 再按一次＝停止 */
    var items = [];
    units.forEach(function (u) {
      var els = u.keys.map(X.sentEl).filter(Boolean);
      if (u.whole && els[0]) { var tb = els[0].closest('table'); if (tb) els = [tb]; }
      var t = u.t, n = g(function () { return prep(t).length; }, t.length);
      if (!els.length || !n) return;
      items.push({ text: t, segs: els, lens: [Math.max(1, n)], locs: [], xks: u.keys.slice(), at: -1 });
    });
    if (!items.length) return false;
    var h = H(), sp0 = SP();
    /* 只有「正在唸」才先停；閒置時不呼叫 stopAll（它會 pause 已播完的 audio，Chromium 會補發 ended，舊的 onended 就把新佇列結束掉）*/
    if ((sp0 && sp0.on) || g(function () { return h.say() != null; }, false)) g(function () { F('stopAll')(); });
    g(function () { var au = h.audio && h.audio(); if (au) { au.onended = null; au.onerror = null; au.ontimeupdate = null; } });
    g(function () { F('ttsUnlock')(); });
    var ttl = T('小智', 'Xiaozhi'), gen = g(function () { return h.nextGen ? h.nextGen() : 0; }, 0);
    h.spk({ on: true, paused: false, items: items, idx: 0, cache: {}, native: false, abort: false, gen: gen, audio: null, title: ttl, xzm: { mid: id } });
    g(function () { h.manual(0); });                       /* 開唸時第一句一定捲到畫面中央 */
    g(function () { h.say('xzm'); });
    g(function () { F('keepAwake')(true); }); g(function () { F('mediaSession')(ttl); }); g(function () { var d = F('drawSpk'); if (d) d(); });
    A.syncBtn();
    play(0, gen);
    return true;
  };
  /* 聊天視窗重畫之後：把朗讀佇列裡的句子元素換成新的，現在唸到的那句重新亮起 */
  A.afterScan = function (tagged) {
    if (!tagged || !spkOn()) return;
    var sp = SP(), cur = null, h = H();
    sp.items.forEach(function (it, j) {
      if (!it.xks) return;
      var els = it.xks.map(X.sentEl).filter(Boolean);
      if (els.length) { if (it.segs[0] && it.segs[0].tagName === 'TABLE') { var tb = els[0].closest('table'); if (tb) els = [tb]; } it.segs = els; }
      if (j === sp.idx) cur = it;
    });
    A.syncBtn();
    if (cur && cur.at >= 0) {
      var k = cur.at, keep = h.manual(); cur.at = -1; h.manual(Date.now()); g(function () { F('raSeg')(cur, k); }); h.manual(keep);
    }
  };
  A.reading = spkOn;
  A.syncBtn = function () {
    var mid = spkOn() ? spkMid() : '';
    arr(document.querySelectorAll('#gxaxz .xzm.assistant')).forEach(function (node) {
      var mm = NODE.exec(node.id), i = mm ? +mm[1] : -1, m = g(function () { return SAGE321.msgs()[i]; }, null);
      arr(node.querySelectorAll('.xzact button')).forEach(function (b) {
        if ((b.getAttribute('onclick') || '').indexOf('SAGE321.speak(') < 0) return;
        var on = !!(mid && m && m.xid === mid);
        if (b.getAttribute('data-xzl') == null) b.setAttribute('data-xzl', b.textContent);
        b.textContent = on ? '⏹ ' + T('停止', 'Stop') : b.getAttribute('data-xzl');
        b.classList.toggle('on', on);
      });
    });
  };

  /* ── 我的畫線：宿主清單多一個「✨ 小智」區段（資料在 GXA.hl 資料庫，key＝<slug>-xz|…）──────────────── */
  function zKeys() {
    var d = g(function () { return GXA.hl.db(); }, {}), p = KEY + '|';
    return Object.keys(d).filter(function (k) { return k.indexOf(p) === 0 && d[k] && d[k].t; }).sort(function (a, b) { return (d[b].ts || 0) - (d[a].ts || 0); });
  }
  function zSection() {
    var ks = zKeys(), d = X.mixDb(), E = X.esc, h = '';
    if (!ks.length) return '';
    ks.forEach(function (k) {
      var x = d[k], xk = k.slice(KEY.length + 1), orphan = !X.msgById(X.parse(xk).id);
      h += '<div class="hitem"><div class="q" data-c="' + E(x.c || 'gold') + '">' + E(x.t) + '</div>' + (x.n ? '<div class="n">' + E(x.n) + '</div>' : '') +
        '<div class="m"><span>' + E(x.ref || '') + (orphan ? '　' + E(T('（原回答已不在對話中）', '(the original answer is no longer in the chat)')) : '') + '</span><span>' +
        (orphan ? '' : '<button class="linkbtn" onclick="XZM.mixGo(\'' + E(k) + '\')">' + E(T('回到原處', 'Go back')) + '</button>') +
        '<button class="linkbtn" onclick="XZM.mixCard(\'' + E(k) + '\')">🖼</button>' +
        '<button class="linkbtn" onclick="XZM.mixAsk(\'' + E(k) + '\')">✨</button>' +
        '<button class="linkbtn danger" onclick="XZM.mixDel(\'' + E(k) + '\',this)">✕</button></span></div></div>';
    });
    return '<div class="card xzsec" style="padding:4px 16px"><div class="eyebrow" style="margin:10px 0 2px">✨ ' + E(T('小智', 'Xiaozhi')) + '（' + ks.length + '）</div>' + h + '</div>';
  }
  X.mixDb = function () { return g(function () { return GXA.hl.db(); }, {}); };
  X.mixGo = function (k) { X.jump(k.slice(KEY.length + 1)); };
  X.mixCard = function (k) { var h = X.mixDb()[k]; if (h) g(function () { GXA.studio({ text: h.t, ref: h.ref || '', note: h.n || '' }); }); };
  X.mixAsk = function (k) {
    var h = X.mixDb()[k]; if (!h) return;
    var q = T('請就這句話幫助我默想：「', 'Help me meditate on this: “') + h.t + T('」', '”') + (h.n ? '\n' + T('我的領受：', 'My reflection: ') + h.n : '');
    g(function () { SAGE321.open(); SAGE321.send(q); });
  };
  X.mixDel = function (k, btn) {
    var d = X.mixDb();
    if (d[k]) { delete d[k]; g(function () { localStorage.setItem('gxa_hl_' + SLUG, JSON.stringify(d)); }); }
    g(function () { arr(document.querySelectorAll('#gxaxz')).forEach(function (r) { GXA.hl.paint(r); }); });
    /* 清單即時更新：移除該列；整區沒有了就移除整個區段（宿主若有 render 也一併重畫）*/
    g(function () {
      var row = btn && btn.closest ? btn.closest('.hitem') : null, sec = row && row.closest('.xzsec');
      if (row) row.parentNode.removeChild(row);
      if (sec) {
        var n = sec.querySelectorAll('.hitem').length, ey = sec.querySelector('.eyebrow');
        if (!n) sec.parentNode.removeChild(sec); else if (ey) ey.textContent = ey.textContent.replace(/[（(]\d+[）)]/, '（' + n + '）');
      }
    });
    g(function () { if (typeof render === 'function') render(); });
  };

  A.hook = function () {
    var h = H();
    var s0 = SAGE321.speak;
    SAGE321.speak = function (i) { if (X.speakMsg(i)) return; return s0.apply(this, arguments); };
    var o0 = SAGE321.open;
    SAGE321.open = function () { X.restore(); return o0.apply(this, arguments); };
    if (!o.noNow) g(function () { h.cool(6000); });        /* 使用者自己捲動後 6 秒不搶畫面（宿主原本 4 秒）*/
    g(function () { h.wrapPaintSay(function () { A.syncBtn(); }); });
    g(function () { h.wrapHlList(function (html) {
      var z = zSection();
      if (!z) return html;
      if (/class="empty"/.test(html)) html = '';
      return html + z;
    }); });
    /* 宿主的 ttsStop（有 natural 參數）：念完／停止小智回答時不要觸發「自動下一頁」、也不要蓋掉課程頁的續讀位置 */
    g(function () { if (h.wrapTtsStop) h.wrapTtsStop(function (orig, self, args) {
      if (!spkOn()) return orig.apply(self, args);
      var keep = h.resume ? h.resume() : null;
      var r = orig.call(self, false);
      if (h.resume) h.resume(keep);
      return r;
    }); });
    window.addEventListener('keydown', function (e) {
      if (spkOn() && /^(Arrow|Page)|^(Home|End)$|^ $/.test(e.key || '')) g(function () { h.manual(Date.now()); });
    });
  };
  A.css = gxCss +
    '.gxz .xzs.tts-reading,.xzs.tts-reading{background:rgba(108,147,209,.26);-webkit-box-decoration-break:clone;box-decoration-break:clone}' +
    '.gxz table.tts-reading,.gxz .tts-reading>table{background:rgba(108,147,209,.18)}' +
    '@media (prefers-color-scheme:dark){.gxz .xzs.tts-reading,.xzs.tts-reading{background:rgba(120,160,230,.34)}}';
  return A;
};

/* ═══ preset.mix2：內嵌 SAGE321 v2（#gxaxz／.xzt／GXA.hl）但「沒有 TTS321」的 App ═══════════════════════════════
   321sociallife／321couples／chendu321：小智視窗與畫線面板與 preset.gx 相同，所以以 gx 為底（不改 gx），只補三件事：
     1) 朗讀引擎（poll 型，與 TTS321 同介面：state/stop/chunks/play）依宿主現有的 azure 朗讀自動選：
        · 'along'：宿主有 window.xzSpeakAlong(items,btn,onEnd)（321couples）——宿主自己做 azure 預抓、解鎖、重試、內建語音備援、
                  Media Session；我們給每一句一個「假元素」，宿主只負責念，高亮與捲動全由 XZM 核心做（6 秒手動捲動保護、表格整塊）。
        · 'speak'：宿主有 speak／stopSpeak／ttsFetch／audioEl／SPK（321sociallife）——照宿主 speak() 的規則自建逐句佇列：
                  同一個 audio 元素、點擊當下用靜音 wav 解鎖、預抓後 2 段、失敗重試 2 次、仍失敗該句改用內建語音；
                  沿用宿主的 SPK 與 #spk 控制列（⏮ ⏸ ⏭ ✕）、PRON321 發音修正、GXMS 的鎖屏控制／Wake Lock。
        · 都沒有（chendu321：宿主的 yun 朗讀是整課串成一個 MP3，沒有逐句邊界）→ 不接管 🔊，宿主照舊；只做畫線＋面板。
     2) 沒有引擎時，面板的「從這裡朗讀」改成把該句到回答結尾的文字交給宿主朗讀函式（spkToggle／speak）。
     3) 宿主換語言時會重建 SAGE321（sociallife）：偵測物件換了就重新掛 🔊／關閉／清空；訊息保存分語言（xzm_<slug>_<lang>）。
   opts：engine＝'along'|'speak'|'none'（預設自動偵測）；slug／nar 同 preset.gx。                                    */
XZM.preset.mix2 = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr;
  var A = X.preset.gx(o);
  var SLUG = o.slug || g(function () { return GXA_CFG.slug; }, 'app');
  var SIL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';

  /* 一個朗讀單位若太長（>280 字）就在標點處切開；一般一句一個 part */
  function chunks(t) {
    t = String(t || '');
    if (t.length <= 280) return t.replace(/\s/g, '') ? [t] : [];
    var out = [], buf = '', i, ch;
    for (i = 0; i < t.length; i++) { ch = t.charAt(i); buf += ch; if (buf.length >= 120 && '。！？；.!?;'.indexOf(ch) >= 0) { out.push(buf); buf = ''; } }
    if (buf.replace(/\s/g, '')) out.push(buf);
    var fin = [];
    out.forEach(function (s) { while (s.length > 300) { fin.push(s.slice(0, 300)); s = s.slice(300); } if (s) fin.push(s); });
    return fin;
  }

  /* ── 引擎一：宿主 xzSpeakAlong（321couples）──────────────────────── */
  function alongEngine() {
    var tok = 0, on = false, cur = -1;
    return {
      ready: function () { },
      state: function () { return { on: on, i: cur }; },
      stop: function () { on = false; g(function () { window.xzSpeakStop(); }); },
      chunks: chunks,
      play: function (parts, title) {
        var my = ++tok, items;
        on = true; cur = -1;
        items = parts.map(function (p, i) {
          /* 宿主只對 el 做 classList.add/remove、scrollIntoView、CR.tts(el)：給它一個假的，真正的高亮與捲動由 XZM 核心做 */
          var fake = { classList: { add: function () { if (my === tok) cur = i; }, remove: function () { }, contains: function () { return false; } }, scrollIntoView: function () { }, closest: function () { return null; } };
          return { text: p.t, el: fake };
        });
        window.xzSpeakAlong(items, null, function () { if (my === tok) on = false; });
      }
    };
  }

  /* ── 引擎二：宿主 speak／ttsFetch／audioEl／SPK（321sociallife）────── */
  function speakEngine() {
    var mine = 0, cur = -1;
    function nativeSay(text, done) {
      try {
        if (!window.speechSynthesis) return done();
        var u = new SpeechSynthesisUtterance(text), l = g(function () { return L(); }, 'zh');
        u.lang = l === 'en' ? 'en-US' : (l === 'zs' ? 'zh-CN' : 'zh-TW'); u.rate = 1;
        u.onend = u.onerror = function () { done(); };
        speechSynthesis.speak(u);
      } catch (e) { done(); }
    }
    return {
      ready: function () { },
      state: function () { var s = window.SPK; return { on: !!(mine && s && s.on && s.tok === mine), i: cur }; },
      stop: function () { if (mine && window.SPK && SPK.tok === mine) g(function () { stopSpeak(); }); },
      chunks: chunks,
      play: function (parts, title) {
        var texts = parts.map(function (p) { return g(function () { return sanitize(p.t); }, p.t) || ' '; });
        var n = texts.length, human = g(function () { return !!S.set.human; }, true) && navigator.onLine !== false;
        g(function () { stopSpeak(); });
        var my = (window.SPK && SPK.tok || 0) + 1, blobs = [], played = [], url = null, a = null;
        mine = my; cur = -1;
        window.SPK = { on: true, pause: false, tok: my, list: texts, i: 0, title: title || '小智', nat: human ? 0 : 1 };
        function stillMine() { return my === SPK.tok && SPK.on; }
        function finish() { if (stillMine()) g(function () { stopSpeak(); }); }
        function bar() { g(function () { drawSpk(); }); }
        if (!human) {                                             /* 內建語音：一句一個 utterance */
          g(function () { speechSynthesis.cancel(); });
          var step = function (k) {
            if (!stillMine()) return;
            if (k >= n) return finish();
            SPK.i = k; cur = k; bar();
            nativeSay(texts[k], function () { if (stillMine()) step(k + 1); });
          };
          SPK.go = function () { };
          bar(); step(0); return;
        }
        /* azure：同一個 audio、點擊當下用靜音 wav 解鎖（這個函式就是在點擊裡同步呼叫的）*/
        a = g(function () { return audioEl(); }, null);
        if (a) { try { a.onended = null; a.onerror = null; a.src = SIL; var pr = a.play(); if (pr && pr['catch']) pr['catch'](function () { }); } catch (e) { } }
        function get(k) {
          if (k >= n || blobs[k]) return;
          blobs[k] = 'p';
          (function attempt(t) {
            ttsFetch(texts[k], function (b) {
              if (!b || b.size < 128) return bad(t); blobs[k] = b; kick(k);
            }, function () { bad(t); });
            function bad(t0) {
              if (my !== SPK.tok) return;
              if (t0 < 2) setTimeout(function () { attempt(t0 + 1); }, [800, 1600][t0]);
              else { blobs[k] = 'x'; kick(k); }
            }
          })(0);
        }
        function kick(k) { if (k === cur && !played[k]) playAt(k); }
        function playAt(k) {
          if (!stillMine()) return;
          if (k >= n) return finish();
          SPK.i = k; cur = k; bar();
          get(k); get(k + 1); get(k + 2);
          var b = blobs[k];
          if (!b || b === 'p') return;                            /* 還在抓：抓好時 kick */
          played[k] = 1;
          if (b === 'x') { nativeSay(texts[k], function () { if (stillMine()) playAt(k + 1); }); return; }   /* 這句連不上：改內建語音，下一句繼續 */
          var au = g(function () { return audioEl(); }, a);
          try { if (url) URL.revokeObjectURL(url); } catch (e) { }
          url = URL.createObjectURL(b);
          au.onended = function () { if (stillMine()) playAt(k + 1); };
          au.onerror = function () { if (stillMine()) playAt(k + 1); };
          au.src = url;
          var p = au.play(); if (p && p['catch']) p['catch'](function () { if (stillMine()) playAt(k + 1); });
        }
        SPK.go = function (k) { played[k] = 0; try { audioEl().pause(); } catch (e) { } playAt(k); };
        bar();
        get(0); get(1); get(2);
        cur = 0; SPK.i = 0; kick(0);
      }
    };
  }

  var kind = o.engine || (typeof window.xzSpeakAlong === 'function' ? 'along' :
    (typeof window.speak === 'function' && typeof window.ttsFetch === 'function' && typeof window.audioEl === 'function' && typeof window.stopSpeak === 'function' && 'SPK' in window ? 'speak' : 'none'));
  A.engine = kind === 'along' ? alongEngine() : (kind === 'speak' ? speakEngine() : null);
  XZM._mix2 = kind;

  /* ── 沒有引擎：面板「從這裡朗讀」交給宿主朗讀函式 ─────────────────── */
  function hostRead(text) {
    if (!text) return;
    if (typeof window.spkToggle === 'function') { g(function () { if (window.spkStop) spkStop(); }); g(function () { spkToggle(text, 'xzm_from'); }); }
    else if (typeof window.speak === 'function') g(function () { speak(text, X.T('小智', 'Xiaozhi')); });
  }
  function textFrom(el) {
    var node = el.closest && el.closest('.xzm'), all = node ? arr(node.querySelectorAll('.xzs')) : [el], i = all.indexOf(el), t = '', j;
    for (j = Math.max(0, i); j < all.length && t.length < 6000; j++) t += (t && /^en/i.test(document.documentElement.lang || '') ? ' ' : '') + X.sentText(all[j]);
    return t;
  }
  var attach0 = A.marks.attach;
  A.marks.attach = function (r) {
    if (A.engine || !window.GXA || !GXA.hl) return attach0.apply(this, arguments);
    var h = GXA.hl, a0 = h.attach;
    h.attach = function (root, opt) { if (opt && opt.unit === '.xzs') opt.readFrom = function (el) { hostRead(textFrom(el)); }; return a0.apply(this, arguments); };
    try { return attach0.apply(this, arguments); } finally { h.attach = a0; }
  };

  /* ── 訊息保存分語言 ──────────────────────────────────────────── */
  if (A.store) {
    var key = function () { return 'xzm_' + SLUG + '_' + A.lang(); };
    A.store = {
      get: function () { try { return JSON.parse(localStorage.getItem(key()) || 'null'); } catch (e) { return null; } },
      set: function (l) { try { localStorage.setItem(key(), JSON.stringify(l)); } catch (e) { } }
    };
  }

  /* ── 掛鉤：🔊（含 SAGE321 被宿主換掉後重掛）、開窗還原、關閉／清空時停止朗讀 ── */
  function hookObj() {
    var S3 = window.SAGE321;
    if (!S3 || S3.__xzm2) return;
    S3.__xzm2 = 1;
    var s0 = S3.speak, o0 = S3.open, c0 = S3.close, k0 = S3.clear;
    S3.speak = function (i) { if (A.engine && X.speakMsg(i)) return; return s0.apply(this, arguments); };
    S3.open = function () { X.restore(); return o0.apply(this, arguments); };
    S3.close = function () { if (X.state().reading) X.stopEngine(); return c0.apply(this, arguments); };
    S3.clear = function () { if (X.state().reading) X.stopEngine(); return k0.apply(this, arguments); };
  }
  A.hook = function () { hookObj(); setInterval(hookObj, 800); };
  return A;
};
/* ═══ preset.xk：xk321.js 外掛架構的 App（321care／321overcomer／321seminary…）═══════════════════════════════
   宿主：xk321.js（IIFE，window.XK）。小智視窗 .xk-chat、訊息 .msg.ai#xkm{i}（本體 .mb，捲動容器 #xkBd）、
        自己的畫線資料 S.hl（key＝data-k）、畫線面板 .xk-sheet、「我的畫線」.xk-marks、朗讀 startSpeak（spk 佇列、#xkBar 控制列）。
   宿主原本只掃正文（XK_CFG.blocks），小智回答裡沒有 .xks。本 preset 把回答切成宿主認得的句子單位：
        每個含句子的容器（p／h4／blockquote／li／td…）＝宿主的 block（class xk-blk、data-xk），句子＝ <span class="xzs xks" data-xk="z|訊息id|區塊|句" data-k="同左">；
        所以宿主既有的點一下畫線（onSentTap）、再點開面板（openSheet：換色／句數／領受／問小智／做成美圖／複製／分享／刪除）、
        paintBlock（上色、領受條）、「我的畫線」清單全部原封重用，畫線資料就存在宿主的 S.hl（key 形如 z|id|b|s，另存 xz/xid/lang/ref）。
   宿主需要的唯一掛鉤（xk321.js 最後一行 window.XK 多一個 x）：
        XK.x = { speak: startSpeak, spk(): spk, save, paint: paintBlock, cur(): 面板目前的畫線 }
   朗讀：poll 型引擎。每句一個 spk 項目（el:null），XZM 核心每 120ms 看 spk.idx 決定高亮哪一句、捲動、6 秒手動捲動保護、表格整塊；
        聲音、語速、控制列、背景播放、失敗改內建語音全部是宿主的。
   🔊（data-a=mtts）與面板的「朗讀」（data-a=read，只在畫線 key 是 z| 開頭時）用 document capture 攔截；其餘照宿主。
   訊息 id：xid＝'x'+ts（宿主訊息自己有穩定的 ts，隨 S.chat 保存，不必另存）。 */
XZM.preset.xk = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T;
  var K = window.XK, H = K && K.x;
  if (!K || !H || !K.state || typeof H.speak !== 'function') throw new Error('XZM xk: host hook XK.x missing');
  var S = K.state, C = K.cfg || {}, BRAND = C.brand || '#1E5A86';
  var NODE = /^xkm(\d+)$/, nextKey = '', mine = null;

  function root() { return document.querySelector('.xk-chat'); }
  function chat() { return S.chat || []; }
  function isDone(m) { return !!(m && m.role !== 'user' && !m.wait && !m.cont && m.ok === true && m.text); }
  function xidOf(m) { if (m && !m.xid && m.ts && isDone(m)) m.xid = 'x' + (+m.ts).toString(36); return m && m.xid; }
  function nodeOf(i) { return document.getElementById('xkm' + i); }
  function toast(m) {
    var o2 = document.querySelector('.xk-toast'); if (o2 && o2.parentNode) o2.parentNode.removeChild(o2);
    var d = document.createElement('div'); d.className = 'xk-toast'; d.textContent = m; document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2400);
  }
  function zKeys() { return Object.keys(S.hl || {}).filter(X.isZ); }
  function refOf(el) {
    var m = X.msgById(X.parse(el.getAttribute('data-xk')).id), at = m && m.ts;
    return T('小智', 'Xiaozhi') + (at ? ' · ' + g(function () { return new Date(at).toLocaleDateString(); }, '') : '');
  }
  function chunks(t) {
    t = String(t || '');
    if (t.length <= 280) return t.replace(/\s/g, '') ? [t] : [];
    var out = [], buf = '', i, ch, fin = [];
    for (i = 0; i < t.length; i++) { ch = t.charAt(i); buf += ch; if (buf.length >= 120 && '。！？；.!?;'.indexOf(ch) >= 0) { out.push(buf); buf = ''; } }
    if (buf.replace(/\s/g, '')) out.push(buf);
    out.forEach(function (s) { while (s.length > 300) { fin.push(s.slice(0, 300)); s = s.slice(300); } if (s) fin.push(s); });
    return fin;
  }

  var A = {
    cls: 'xks', ownClick: false,                           /* 點擊由宿主的 document click（.xks → onSentTap）處理 */
    attrs: function (id, b, n, xk) { return ' data-k="' + xk + '" data-i="' + n + '"'; },
    css: '.xk-chat .xzs.spk-now{background:rgba(255,214,102,.45);outline:2px solid ' + BRAND + ';outline-offset:1px}' +
         '.xk-chat table.spk-now,.xk-chat .spk-now>table{background:rgba(255,214,102,.3)}' +
         '.xk-chat .xzw{display:block}' +
         '.xk-chat .msg.ai.fold.xzopen .mb{max-height:none;-webkit-mask-image:none;mask-image:none}' +
         '.xk-marks .xzm-sec{font-weight:800;font-size:15px;margin:18px 2px 8px}' +
         '.xk-mi.xzmi .a{flex-wrap:wrap}.xk-mi.xzmi .a button{white-space:nowrap}' +
         '.xk-mi .a button:disabled{opacity:.4;cursor:default}' +
         '@media (prefers-color-scheme:dark){.xk-chat .xzs.spk-now{background:rgba(255,214,102,.28)}.xk-chat table.spk-now,.xk-chat .spk-now>table{background:rgba(255,214,102,.18)}}',
    lang: function () {
      var l = g(function () { return typeof window.LG === 'function' ? window.LG() : ''; }, '') || document.documentElement.getAttribute('lang') || '';
      return /^en/i.test(l) ? 'en' : (/hans|^zh-cn|^zs$|^sc$/i.test(l) ? 'sc' : 'tc');
    },
    toast: toast,
    msgs: function () { var a = chat(), i; for (i = 0; i < a.length; i++) xidOf(a[i]); return a; },
    isDone: isDone,
    isUser: function (m) { return !!(m && m.role === 'user'); },
    busy: function () { return chat().some(function (m) { return m && (m.wait || m.cont); }); },
    open: function () { K.open(); },
    root: root,
    msgSel: '.msg.ai',
    nodeAt: nodeOf,
    msgAt: function (i) { return chat()[i]; },
    bodyOf: function (node) { return node.querySelector('.mb'); },
    scroller: function () { return document.getElementById('xkBd'); },
    follow: function () { return true; },
    hint: true,
    answers: function () {
      var a = A.msgs(), out = [];
      arr(document.querySelectorAll('.xk-chat .msg.ai')).forEach(function (node) {
        var mm = NODE.exec(node.id), i = mm ? +mm[1] : -1, m = a[i];
        if (m) out.push({ node: node, body: node.querySelector('.mb'), m: m, i: i, last: i === a.length - 1 });
      });
      return out;
    },
    /* 口語化（同宿主 mdSpeak）：數字圈號、禱告結語；表情符號與出處由宿主 ttsPrep 處理 */
    clean: function (t) { return String(t).replace(/(\d)️?⃣/g, '$1. ').replace(/奉主耶穌的名禱告[，,]?\s*阿們/g, '奉主耶穌的名禱告，阿們'); },
    /* 切句後：li／td／th 的內容包一層 div（宿主的畫線領受條插在 block 後面，這樣會留在格子裡）；含句子的直接父層＝宿主的 block */
    decorate: function (body) {
      arr(body.querySelectorAll('li,th,td')).forEach(function (c) {
        if (!arr(c.children).some(function (ch) { return ch.classList.contains('xzs'); })) return;
        var w = document.createElement('div'); w.className = 'xzw';
        while (c.firstChild) w.appendChild(c.firstChild);
        c.appendChild(w);
      });
      var seen = [];
      arr(body.querySelectorAll('.xzs')).forEach(function (s) {
        var p = s.parentNode;
        if (seen.indexOf(p) >= 0) return;
        seen.push(p); p.classList.add('xk-blk'); p.setAttribute('data-xk', 'zb|' + s.getAttribute('data-xk'));
      });
    },
    beforeMark: function (el) {                              /* 被收合的訊息：朗讀到那裡就暫時展開，句子才看得到 */
      var n = el && el.closest && el.closest('.msg.ai');
      if (n && n.classList.contains('fold')) n.classList.add('xzopen');
    },
    syncBtn: function (rd) { if (!rd) arr(document.querySelectorAll('.xk-chat .xzopen')).forEach(function (n) { n.classList.remove('xzopen'); }); },
    store: null,
    marks: {
      any: function () { return zKeys().length > 0; },
      attach: function () { },
      paint: function (r) { arr((r || document).querySelectorAll('.xk-blk')).forEach(function (b) { g(function () { H.paint(b); }); }); },
      tap: function (xk, el) { },
      keys: zKeys
    },
    /* 朗讀引擎：宿主的 startSpeak（每句一個項目，el:null；高亮由 XZM 核心依 spk.idx 輪詢）*/
    engine: {
      ready: function () { },
      state: function () { var s = H.spk(); return { on: !!(s && s.on && mine && s.items && s.items[0] === mine), i: s ? s.idx : -1 }; },
      stop: function () { if (A.engine.state().on) K.stop(); },
      chunks: chunks,
      play: function (parts, title) {
        var items = parts.map(function (p) { return { text: p.t, el: null }; });
        mine = items[0];
        H.speak(items, nextKey || 'xzm', title, 0);
      }
    },
    hook: function () { hook(); }
  };

  /* ── 面板的「朗讀」：從畫線起點唸 sp 句（高亮、跟讀）──────────────────── */
  function readRange(cur) {
    var head = cur.span, node = head.closest('.msg.ai');
    if (!node) return false;
    var spans = arr(head.parentNode.querySelectorAll('.xks')), i = spans.indexOf(head), n = Math.max(1, +(cur.h && cur.h.sp) || 1);
    var keys = spans.slice(i, i + n).map(function (s) { return s.getAttribute('data-xk'); });
    var picked = X.defaultUnits(node).filter(function (u) { return u.keys.some(function (k) { return keys.indexOf(k) >= 0; }); });
    if (!picked.length) return false;
    var sh = document.querySelector('.xk-sheet'), cl = sh && sh.querySelector('[data-a="close"]');
    if (cl) cl.click();                                      /* 先關面板（順便存領受），再開唸 */
    nextKey = 'xzf';
    try { return X.begin(picked, T('小智', 'Xiaozhi'), { mid: X.parse(keys[0]).id, kind: 'from' }); } finally { nextKey = ''; }
  }

  /* ── 「我的畫線」：小智的畫線集中成「✨ 小智」區段（宿主的清單照舊，只重排與加註）────── */
  function enhanceMarks(box) {
    if (!box || box.getAttribute('data-xzm')) return;
    box.setAttribute('data-xzm', '1');
    var mb = box.querySelector('.xk-mb'); if (!mb) return;
    var zs = [];
    arr(mb.querySelectorAll('.xk-mi')).forEach(function (it) {
      var b = it.querySelector('button[data-k]'), k = b && b.getAttribute('data-k');
      if (X.isZ(k)) zs.push([it, k]);
    });
    if (!zs.length) return;
    var h = document.createElement('div'); h.className = 'xzm-sec'; h.textContent = '✨ ' + T('小智', 'Xiaozhi') + ' ' + zs.length;
    mb.appendChild(h);
    zs.forEach(function (p) {
      var it = p[0], k = p[1], orphan = !X.msgById(X.parse(k).id), a = it.querySelector('.a'), r = it.querySelector('.r');
      mb.appendChild(it); it.classList.add('xzmi');
      if (orphan && r) r.textContent = (r.textContent ? r.textContent + ' · ' : '') + T('原回答已不在對話中', 'Original answer is no longer in the chat');
      if (a) {
        var j = document.createElement('button'); j.type = 'button'; j.setAttribute('data-xzj', k); j.textContent = '↩ ' + T('回到回答', 'Back to answer');
        if (orphan) j.disabled = true;
        a.insertBefore(j, a.firstChild);
      }
    });
  }

  var hooked = false;
  function hook() {
    if (hooked) return; hooked = true;
    /* 1) 🔊／面板朗讀／我的畫線的「回到回答」：capture 階段攔截 */
    document.addEventListener('click', function (e) {
      var t = e.target, b = t && t.closest ? t.closest('button') : null;
      if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'mtts' && b.closest('.xk-chat')) {
        var i = +b.getAttribute('data-i'), ok;
        nextKey = 'm' + i;
        try { ok = X.speakMsg(i); } catch (er) { ok = false; } finally { nextKey = ''; }
        if (ok) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (a === 'read' && b.closest('.xk-sheet')) {
        var cur = g(function () { return H.cur(); }, null);
        if (cur && X.isZ(cur.k) && cur.span && cur.span.closest('.xzs') && g(function () { return readRange(cur); }, false)) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (b.hasAttribute('data-xzj') && b.closest('.xk-marks')) {
        e.preventDefault(); e.stopPropagation();
        if (b.disabled) return;
        var k = b.getAttribute('data-xzj'), cb = document.querySelector('.xk-marks [data-a="x"]');
        if (cb) cb.click();
        X.jump(k);
      }
    }, true);
    /* 2) 新畫的小智句：補 ref／xz／xid／lang（宿主的 onSentTap 先跑，這個後跑）*/
    document.addEventListener('click', function (e) {
      var s = e.target && e.target.closest ? e.target.closest('.xk-chat .xks') : null;
      if (!s) return;
      var k = s.getAttribute('data-k'), h = S.hl && S.hl[k];
      if (!h || h.xz || !X.isZ(k)) return;
      h.xz = 1; h.xid = X.parse(k).id; h.lang = A.lang(); h.ref = refOf(s);
      g(function () { H.save(); });
    }, false);
    /* 3) 「我的畫線」開啟（每次都是新節點）*/
    if (window.MutationObserver) {
      new MutationObserver(function (ms) {
        ms.forEach(function (m) { arr(m.addedNodes).forEach(function (n) { if (n.classList && n.classList.contains('xk-marks')) g(function () { enhanceMarks(n); }); }); });
      }).observe(document.body, { childList: true });
      arr(document.querySelectorAll('.xk-marks')).forEach(enhanceMarks);
    }
  }
  return A;
};
/* ═══ preset.mini：宿主「沒有畫線系統」的單檔 App（G4：321／321leadership／321gospel）═══════════════════════════════
   這三個 App 的正文畫線都包在宿主的 IIFE 裡、只認課文章節（sec/pidx/idx），小智聊天裡沒有可重用的畫線與面板，
   所以 mini 自帶一整套（不碰宿主的畫線資料）：
     · 畫線資料庫：localStorage `xzm_hl_<slug>`（key＝句子代號 xk，值 {c 顏色, n 領受, t 原句, at, lang}）
     · 點一下畫線、再點開面板：八色色票、領受輸入、🖼 做成美圖（宿主的 GXU 美圖工作室）、✨ 問小智（把問題送進宿主聊天）、
       🔊 朗讀這句、▶ 從這裡朗讀、⧉ 複製、↗ 分享、取消畫線；有領受的句子在回答下方列出「📝 領受」
     · 「我的」頁（321／leadership）或設定頁（gospel）多一個「✨ 小智畫線」清單（孤兒——原回答已不在對話——仍會列出）
     · 小智訊息最近 60 則另存 xzm_<slug>，重開 App 放回宿主的聊天
   宿主差異（opts.host）：
     'ls'     321、321leadership：chatSession.messages（app.js 的 IIFE 裡）、#view／#chatlog／.msg.ai／.msg-body，
              朗讀＝宿主 spk（azure 逐項佇列，一項一句；唸到哪一項由 core 輪詢 spk.idx 標出該句）
              需要宿主一個小掛鉤：window.<LS321|L321>.xz = { chat(), speak(key,texts,title), stop(), expand(mi), spk }
     'gospel' 321gospel：chat.msgs（app-2a.js 的 IIFE 裡）、#xiaozhi／#xz-msgs／.xz-msg，宿主朗讀只能整段唸 → 自帶 azure 逐句引擎
              （同一個 audio、點擊當下解鎖、預抓、重試、失敗改內建語音），需要小掛鉤：window.__xzHost = { chat(), draw() }
   全部 UI 字串用 T('繁體','English')，簡體由 build_xzm.py 產生。                                                    */
XZM.preset.mini = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T, esc = X.esc;
  var KIND = o.host || (g(function () { return window.__xzHost ? 'gospel' : 'ls'; }, 'ls'));
  var SLUG = o.slug || (KIND === 'gospel' ? '321gospel' : '321');
  var DBK = 'xzm_hl_' + SLUG, COLK = 'xzm_hlc_' + SLUG;
  var SIL = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
  var NEXT = null;                                     /* 下一次 engine.play 要用的朗讀代號／訊息索引（由我們自己的點擊處理設定） */
  var H;                                               /* 宿主描述（下面依 KIND 建立） */

  /* ── 八色（與 321 系列宿主一致：gold green blue pink purple maroon brown charcoal）──────────────────────── */
  var COLORS = [
    { id: 'gold', dot: '#D9A73D', rgb: '217,167,61' }, { id: 'green', dot: '#6FAE71', rgb: '111,174,113' },
    { id: 'blue', dot: '#6C93D1', rgb: '108,147,209' }, { id: 'pink', dot: '#E58FA0', rgb: '229,143,160' },
    { id: 'purple', dot: '#A48AC9', rgb: '164,138,201' }, { id: 'maroon', dot: '#8C4A4E', rgb: '140,74,78' },
    { id: 'brown', dot: '#8A6740', rgb: '138,103,64' }, { id: 'charcoal', dot: '#54534E', rgb: '84,83,78' }
  ];
  function colName(id) {
    var m = { gold: T('金', 'Gold'), green: T('綠', 'Green'), blue: T('藍', 'Blue'), pink: T('粉', 'Pink'), purple: T('紫', 'Purple'), maroon: T('酒紅', 'Maroon'), brown: T('咖啡', 'Brown'), charcoal: T('墨黑', 'Charcoal') };
    return m[id] || id;
  }

  /* ── 資料庫 ─────────────────────────────────────────────────────── */
  function dbGet() { try { var d = JSON.parse(localStorage.getItem(DBK) || '{}'); return (d && typeof d === 'object') ? d : {}; } catch (e) { return {}; } }
  function dbSet(d) { try { localStorage.setItem(DBK, JSON.stringify(d)); } catch (e) { } }
  function lastColor() { try { var c = localStorage.getItem(COLK); return COLORS.some(function (x) { return x.id === c; }) ? c : 'gold'; } catch (e) { return 'gold'; } }
  function setLastColor(c) { try { localStorage.setItem(COLK, c); } catch (e) { } }
  function keys() { return Object.keys(dbGet()).filter(X.isZ); }
  function toast(m) { g(function () { H.toast(m); }); }
  function fmtDate(ts) { return ts ? g(function () { return new Date(ts).toLocaleDateString(); }, '') : ''; }

  /* ── 畫線上色＋回答下方的「領受」清單 ─────────────────────────── */
  function noteSig(list) { return list.map(function (x) { return x.xk + x.c + x.n; }).join('~'); }
  function paint() {
    var db = dbGet();
    arr(document.querySelectorAll('.xzs')).forEach(function (e) {
      var r = db[e.getAttribute('data-xk')];
      if (r) { if (e.getAttribute('data-xzm-c') !== (r.c || 'gold')) e.setAttribute('data-xzm-c', r.c || 'gold'); }
      else if (e.hasAttribute('data-xzm-c')) e.removeAttribute('data-xzm-c');
    });
    g(function () {
      H.answers().forEach(function (a) {
        var list = [], box = a.node.querySelector('.xzm-notes'), sig, i;
        arr(a.body.querySelectorAll('.xzs[data-xzm-c]')).forEach(function (e) {
          var xk = e.getAttribute('data-xk'), r = db[xk];
          if (r && r.n) list.push({ xk: xk, c: r.c || 'gold', n: r.n, q: X.sentText(e) });
        });
        sig = noteSig(list);
        if (!list.length) { if (box) box.parentNode.removeChild(box); return; }
        if (box && box.getAttribute('data-sig') === sig) return;
        if (box) box.parentNode.removeChild(box);
        box = document.createElement('div'); box.className = 'xzm-notes'; box.setAttribute('data-sig', sig);
        var h = '';
        for (i = 0; i < list.length; i++) {
          var q = list[i].q; if (q.length > 16) q = q.slice(0, 16) + '…';
          h += '<div class="mknote" data-xk="' + esc(list[i].xk) + '" data-c="' + list[i].c + '"><span class="q">' + esc(q) + '</span>📝 ' + esc(list[i].n) + '</div>';
        }
        box.innerHTML = h;
        a.body.parentNode.insertBefore(box, a.body.nextSibling);
      });
    });
  }

  /* ── 面板 ───────────────────────────────────────────────────── */
  function closePanel() { var m = document.getElementById('xzpMask'); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function ref() { return H.appName() + T('・小智', ' · Xiaozhi'); }
  function outText(xk) {
    var r = dbGet()[xk]; if (!r) return '';
    var q = A_lang() === 'en' ? '“' + r.t + '”' : '「' + r.t + '」';
    return q + '\n—— ' + ref() + (r.n ? '\n\n' + r.n : '') + '\n\n' + T('國度321空中團契', 'Kingdom 321 Online Fellowship') + '\n' + location.origin + location.pathname.replace(/index\.html$/, '');
  }
  function A_lang() { return g(function () { return H.lang(); }, 'tc'); }
  function copyTxt(t, done) {
    function fb() { try { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.parentNode.removeChild(ta); } catch (e) { } if (done) done(); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { if (done) done(); }, fb); else fb(); } catch (e) { fb(); }
  }
  function askText(xk) {
    var r = dbGet()[xk]; if (!r) return '';
    if (H.askQ) return H.askQ(r.t, r.n);
    var l = A_lang();
    if (l === 'en') return 'I highlighted this line from Xiaozhi’s answer: “' + r.t + '”. ' + (r.n ? 'My reflection: “' + r.n + '”. ' : '') + 'Please help me understand what this line means for me more deeply, and help me keep my focus on Jesus.';
    return T('我在讀小智的回答，畫了這一句：「', '') + r.t + T('」。', '') + (r.n ? T('我的領受是：「', '') + r.n + T('」。', '') : '') + T('請幫我更深地明白這句話對我的意思，也帶我把焦點對準耶穌。', '');
  }
  function openPanel(xk, el) {
    var db = dbGet(), r = db[xk];
    if (!r) return;
    closePanel();
    el = el || X.sentEl(xk);
    var mask = document.createElement('div');
    mask.id = 'xzpMask'; mask.className = 'xzp-mask';
    var hasEl = !!el, hasCard = g(function () { return H.hasCard(); }, false);
    mask.innerHTML = '<div class="xzp-card" role="dialog"><div class="xzp-grip"></div>' +
      '<div class="xzp-title">' + esc(T('✍️ 寫下你的領受', '✍️ Write what you received')) + '</div>' +
      '<div class="xzp-quote">' + esc(r.t) + '</div>' +
      '<div class="xzp-colorrow"><span class="xzp-lb">' + esc(T('畫線顏色', 'Highlight colour')) + '</span><div class="xzp-colors">' +
      COLORS.map(function (c) { return '<button type="button" class="xzp-sw' + (c.id === (r.c || 'gold') ? ' on' : '') + '" data-c="' + c.id + '" style="background:' + c.dot + '" aria-label="' + esc(colName(c.id)) + '"></button>'; }).join('') + '</div></div>' +
      '<textarea class="xzp-ta" placeholder="' + esc(T('這句話帶給你什麼領受、感動，或聖靈的提醒？寫下來，把焦點對準耶穌……', 'What has this sentence given you — a word, a stirring, a reminder from the Holy Spirit? Write it down and turn your focus to Jesus…')) + '">' + esc(r.n || '') + '</textarea>' +
      '<div class="xzp-acts">' +
      '<button type="button" class="xzp-b pri" data-a="save">' + esc(T('儲存', 'Save')) + '</button>' +
      '<button type="button" class="xzp-b" data-a="ask">✨ ' + esc(T('問小智', 'Ask Xiaozhi')) + '</button>' +
      (hasCard ? '<button type="button" class="xzp-b" data-a="card">🖼 ' + esc(T('做成美圖', 'Make a card')) + '</button>' : '') +
      (hasEl ? '<button type="button" class="xzp-b" data-a="read">🔊 ' + esc(T('朗讀這句', 'Read this')) + '</button><button type="button" class="xzp-b" data-a="from">▶ ' + esc(T('從這裡朗讀', 'Read from here')) + '</button>' : '') +
      '<button type="button" class="xzp-b" data-a="copy">⧉ ' + esc(T('複製', 'Copy')) + '</button>' +
      '<button type="button" class="xzp-b" data-a="share">↗ ' + esc(T('分享', 'Share')) + '</button>' +
      '<button type="button" class="xzp-b danger" data-a="del">' + esc(T('取消畫線', 'Remove highlight')) + '</button>' +
      '<button type="button" class="xzp-b" data-a="close">' + esc(T('關閉', 'Close')) + '</button></div></div>';
    document.body.appendChild(mask);
    var ta = mask.querySelector('.xzp-ta');
    function keep() {
      var d = dbGet(), x = d[xk]; if (!x) return '';
      x.n = (ta.value || '').replace(/^\s+|\s+$/g, ''); d[xk] = x; dbSet(d); paint(); refreshMe();
      return x.n;
    }
    mask.addEventListener('click', function (ev) {
      var b = ev.target;
      if (b === mask) { keep(); closePanel(); return; }
      b = b.closest ? b.closest('button') : null;
      if (!b) return;
      ev.stopPropagation();
      var c = b.getAttribute('data-c');
      if (c) {
        var d = dbGet(); if (!d[xk]) return;
        d[xk].c = c; dbSet(d); setLastColor(c); paint(); refreshMe();
        arr(mask.querySelectorAll('.xzp-sw')).forEach(function (s) { s.classList.toggle('on', s === b); });
        return;
      }
      var a = b.getAttribute('data-a');
      if (a === 'save') { keep(); closePanel(); toast(T('已儲存', 'Saved')); }
      else if (a === 'close') { keep(); closePanel(); }
      else if (a === 'del') { var d2 = dbGet(); delete d2[xk]; dbSet(d2); closePanel(); paint(); refreshMe(); }
      else if (a === 'ask') { keep(); var q = askText(xk); closePanel(); g(function () { H.ask(q); }); }
      else if (a === 'card') {
        var n = keep(), t = dbGet()[xk] && dbGet()[xk].t; closePanel();
        g(function () { H.card(t, ref(), n); });
      }
      else if (a === 'read' || a === 'from') {
        keep(); closePanel();
        NEXT = { key: 'xzf:' + xk + ':' + Date.now(), mi: null };
        try { X.sayFrom(xk, a === 'read'); } finally { NEXT = null; }
      }
      else if (a === 'copy') { keep(); copyTxt(outText(xk), function () { toast(T('已複製', 'Copied')); }); }
      else if (a === 'share') {
        keep(); var tx = outText(xk);
        if (navigator.share) navigator.share({ text: tx }).catch(function (e) { if (!e || e.name !== 'AbortError') copyTxt(tx, null); });
        else copyTxt(tx, function () { toast(T('已複製', 'Copied')); });
      }
    });
  }

  /* ── 「我的畫線」清單（孤兒——原回答已不在對話中——仍列出）────────── */
  function listBody() {
    var db = dbGet(), ks = keys().sort(function (a, b) { return (db[b].at || 0) - (db[a].at || 0); });
    var h = '';
    if (!ks.length) return '<div class="xzm-empty">' + esc(T('還沒有小智畫線。在小智的回答裡點一下句子就能畫線。', 'No Xiaozhi highlights yet. Tap a sentence in an answer to highlight it.')) + '</div>';
    ks.slice(0, 40).forEach(function (k) {
      var r = db[k], live = !!X.msgById(X.parse(k).id), col = (COLORS.filter(function (c) { return c.id === (r.c || 'gold'); })[0] || COLORS[0]).dot;
      h += '<div class="xzm-li" data-xk="' + esc(k) + '"><span class="xzm-dot" style="background:' + col + '"></span><div class="xzm-lt"><div class="xzm-tx" data-xzm="open">' + esc(r.t) + '</div>' +
        (r.n ? '<div class="xzm-s">📝 ' + esc(r.n.slice(0, 60)) + '</div>' : '') +
        '<div class="xzm-s">' + esc(fmtDate(r.at)) + (live ? '' : ' · ' + esc(T('原回答已不在對話中', 'The original answer is no longer in the chat'))) + '</div>' +
        '<div class="xzm-bt">' + (live ? '<button type="button" class="xzm-mini" data-xzm="jump">' + esc(T('回到原處', 'Go to answer')) + '</button>' : '') +
        '<button type="button" class="xzm-mini" data-xzm="open">✎</button>' +
        (g(function () { return H.hasCard(); }, false) ? '<button type="button" class="xzm-mini" data-xzm="card">🖼</button>' : '') +
        '<button type="button" class="xzm-mini" data-xzm="ask">✨</button>' +
        '<button type="button" class="xzm-mini" data-xzm="del">🗑</button></div></div></div>';
    });
    if (ks.length > 40) h += '<div class="xzm-s">' + esc(T('只列出最近 40 筆。', 'Showing the latest 40.')) + '</div>';
    return h;
  }
  function listAct(act, xk) {
    var db = dbGet(), r = db[xk];
    if (!r) return;
    if (act === 'open') openPanel(xk, X.sentEl(xk));
    else if (act === 'jump') X.jump(xk);
    else if (act === 'card') g(function () { H.card(r.t, ref(), r.n || ''); });
    else if (act === 'ask') { var q = askText(xk); g(function () { H.ask(q); }); }
    else if (act === 'del') { delete db[xk]; dbSet(db); paint(); refreshMe(); }
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target, b = t && t.closest ? t.closest('[data-xzm]') : null, li;
    if (b && (li = b.closest('.xzm-li'))) { ev.preventDefault(); ev.stopPropagation(); listAct(b.getAttribute('data-xzm'), li.getAttribute('data-xk')); return; }
    var n = t && t.closest ? t.closest('.mknote') : null;
    if (n && n.getAttribute('data-xk')) { ev.stopPropagation(); openPanel(n.getAttribute('data-xk'), null); }
  }, true);
  var meTimer = 0;
  function refreshMe() { clearTimeout(meTimer); meTimer = setTimeout(function () { g(function () { if (H.refreshMe) H.refreshMe(listBody, listTitle); }); }, 30); }
  function listTitle() { return T('✨ 小智畫線', '✨ Xiaozhi highlights') + '（' + keys().length + '）'; }

  /* ── 朗讀用的小工具 ──────────────────────────────────────────── */
  function chunks(t) {
    t = String(t || '');
    if (t.length <= 280) return t.replace(/\s/g, '') ? [t] : [];
    var out = [], buf = '', i, ch;
    for (i = 0; i < t.length; i++) { ch = t.charAt(i); buf += ch; if (buf.length >= 120 && '。！？；.!?;'.indexOf(ch) >= 0) { out.push(buf); buf = ''; } }
    if (buf.replace(/\s/g, '')) out.push(buf);
    var fin = [];
    out.forEach(function (s) { while (s.length > 300) { fin.push(s.slice(0, 300)); s = s.slice(300); } if (s) fin.push(s); });
    return fin;
  }
  /* 與宿主 mdSpeakText 一致：括號裡的經文出處不唸、拿掉引號書名號、破折號改逗號、補句尾標點 */
  function cleanSpeak(t) {
    var en = A_lang() === 'en';
    t = String(t || '').replace(/[（(]\s*(參|见|見|參看|另見|cf\.|see)?\s*[^（）()]*\d+\s*[:：]\s*\d+[^（）()]*[）)]/gi, '');
    if (!en) t = t.replace(/[「」『』《》〈〉]/g, '').replace(/——|—/g, '，');
    t = t.replace(/^\s*(#{1,6}\s*|>\s?|[-*•]\s+)/, '').replace(/\*\*|__|`/g, '').replace(/^\s+|\s+$/g, '');
    if (t && !/[。！？；.!?;：:，,]$/.test(t)) t += en ? '.' : '。';
    return t;
  }

  /* ═══ 宿主一：321／321leadership（ls）═══════════════════════════ */
  function hostLs() {
    var NSO = function () { return g(function () { return (window.LS321 || window.L321).xz; }, null); };
    var KEY = '';
    function msgsArr() { var c = g(function () { return NSO().chat(); }, null); return c ? c.messages : null; }
    function st() { return g(function () { return (window.LS321 || window.L321).state; }, null); }
    var WS = {                                         /* 滿版陪讀頁是整頁一起捲，不是 #chatlog 自己捲 */
      getBoundingClientRect: function () { var h = window.innerHeight || 700; return { top: 70, height: Math.max(120, h - 70 - 170) }; },
      get scrollTop() { return window.pageYOffset || document.documentElement.scrollTop || 0; },
      set scrollTop(v) { window.scrollTo(0, v); },
      scrollTo: function (opt) { try { window.scrollTo({ top: opt.top, behavior: opt.behavior || 'auto' }); } catch (e) { window.scrollTo(0, opt.top); } }
    };
    function chatScroller() {
      var lg = document.getElementById('chatlog');
      if (lg && lg.scrollHeight > lg.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(lg).overflowY)) return lg;
      return WS;
    }
    function nodeAt(i) { return document.querySelector('#chatlog .msg.ai[data-mi="' + i + '"]'); }
    return {
      appName: function () { return T(o.appZh || '落實321', o.appEn || 'Living Out 321'); },
      lang: function () { var l = g(function () { return st().lang; }, 'zh'); return l === 'en' ? 'en' : (l === 'zs' ? 'sc' : 'tc'); },
      toast: function (m) { g(function () { (window.uiToast || function () { })(m); }); },
      ready: function () { return !!msgsArr(); },
      msgs: function () { return msgsArr() || []; },
      isDone: function (m) { return !!(m && m.role === 'ai' && !m.pending && m.ok && !m.partial); },
      isUser: function (m) { return !!(m && m.role === 'user'); },
      busy: function () { var a = msgsArr() || []; return a.some(function (m) { return m && m.pending; }); },
      root: function () { return document.getElementById('view'); },
      msgSel: '.msg.ai',
      nodeAt: nodeAt,
      bodyOf: function (node) { return node.querySelector('.msg-body'); },
      answers: function () {
        var a = msgsArr() || [], out = [];
        arr(document.querySelectorAll('#chatlog .msg.ai[data-mi]')).forEach(function (node) {
          var i = +node.getAttribute('data-mi'), m = a[i];
          if (m) out.push({ node: node, body: node.querySelector('.msg-body'), m: m, i: i, last: i === a.length - 1 });
        });
        return out;
      },
      scroller: chatScroller,
      nowCls: 'tts-reading',
      open: function () { location.hash = '#/companion'; },
      ask: function (q) {
        function fill() { var ta = document.getElementById('chatIn'), b = document.getElementById('chatSend'); if (!ta || !b) return false; ta.value = q; b.click(); return true; }
        if (fill()) return;
        location.hash = '#/companion';
        var n = 0, tm = setInterval(function () { if (fill() || ++n > 24) clearInterval(tm); }, 150);
      },
      hasCard: function () { return !!(window.GXU && GXU.open); },
      card: function (text, ref0, note) {
        try { window.GXU.open({ text: text, ref: ref0, note: note || '', plain: true }); } catch (e) { toast(T('美圖工作室還在載入，請稍後再試', 'The card studio is still loading — please try again')); }
      },
      restoreMsgs: function (list) {
        var a = msgsArr(); if (!a || a.length) return;
        list.forEach(function (x) {
          var m = x.role === 'user' ? { role: 'user', text: x.text, id: x.id, xid: x.id, at: x.at } : { role: 'ai', text: x.text, id: x.id, xid: x.id, at: x.at, ok: true };
          a.push(m);
        });
        g(function () { if (document.getElementById('chatlog')) window.dispatchEvent(new HashChangeEvent('hashchange')); });
      },
      engine: {
        ready: function () { },
        state: function () { var s = g(function () { return NSO().spk; }, null); return { on: !!(s && s.active && KEY && s.curKey === KEY), i: s ? s.idx : -1 }; },
        stop: function () { var s = g(function () { return NSO().spk; }, null); if (s && s.active && s.curKey === KEY) g(function () { NSO().stop(); }); },
        chunks: chunks,
        play: function (parts, title) {
          var n = NEXT || {}, s = NSO().spk;
          KEY = n.key || ('xzm:' + Date.now());
          if (n.mi != null) g(function () { NSO().expand(n.mi); });
          if (s.active && s.curKey === KEY) NSO().stop();
          NSO().speak(KEY, parts.map(function (p) { return p.t; }), title);
          NEXT = null;
        }
      },
      /* 🔊：宿主按鈕在 #chatlog 上冒泡；我們在 window 捕獲階段先接，已在唸同一則時放行（宿主做暫停／繼續） */
      speakHit: function (t) {
        var b = t.closest && t.closest('.msg-speak'); if (!b) return null;
        var i = +b.getAttribute('data-mi'), a = msgsArr() || [], m = a[i], s = g(function () { return NSO().spk; }, null);
        if (!m || !H.isDone(m)) return null;
        var node = nodeAt(i); if (!node || !node.querySelector('.xzs')) return null;
        if (s && s.active && s.curKey === 'msg:' + m.id) return null;
        return { i: i, key: 'msg:' + m.id };
      },
      /* 「我的」頁：在「我的畫線筆記」那張卡後面加一組 */
      refreshMe: function (body, title) {
        var v = document.getElementById('view'); if (!v) return;
        var old = arr(v.querySelectorAll('.xzm-me'));
        var re = /我的畫線筆記|我的画线笔记|my highlights/i, ttl = arr(v.querySelectorAll('.section-title')).filter(function (e) { return re.test(e.textContent || '') && !e.classList.contains('xzm-me'); })[0];
        if (!ttl) { old.forEach(function (e) { e.parentNode.removeChild(e); }); return; }
        var card = ttl.nextElementSibling;
        var sig = title() + '|' + JSON.stringify(dbGet()) + '|' + (msgsArr() || []).length;
        if (old.length && old[0].getAttribute('data-sig') === sig) return;
        old.forEach(function (e) { e.parentNode.removeChild(e); });
        var t2 = document.createElement('div'); t2.className = 'section-title xzm-me'; t2.setAttribute('data-sig', sig); t2.textContent = title();
        var c2 = document.createElement('div'); c2.className = 'card xzm-me'; c2.innerHTML = body();
        var anchor = card && card.classList.contains('card') ? card : ttl;
        anchor.parentNode.insertBefore(t2, anchor.nextSibling); t2.parentNode.insertBefore(c2, t2.nextSibling);
      },
      vars: { bg: 'var(--surface)', ink: 'var(--ink)', soft: 'var(--ink-soft)', alt: 'var(--surface-alt)', line: 'var(--border-strong)', pri: 'var(--accent)', priInk: '#fff', gold: 'var(--gold)', danger: 'var(--bad)', quote: 'var(--gold)' },
      under: true,
      tints: { gold: 'var(--gold-soft)', green: 'var(--hlbg-green)', blue: 'var(--hlbg-blue)', pink: 'var(--hlbg-pink)', purple: 'var(--hlbg-purple)', maroon: 'var(--hlbg-maroon)', brown: 'var(--hlbg-brown)', charcoal: 'var(--hlbg-charcoal)' },
      css: '',
      hook: function () { }
    };
  }

  /* ═══ 宿主二：321gospel ═══════════════════════════════════════ */
  function hostGospel() {
    function XH() { return window.__xzHost; }
    function chat() { return g(function () { return XH().chat(); }, null); }
    function G() { return window.__G; }
    var EP = 'https://azure-tts.spch321.workers.dev', SAFE = 'zh-TW-YunJheNeural';
    var ERR = /^目前似乎沒有網路|^小智暫時連不上線|^小智等候得有點久|^小智一時想不出/;
    function lang0() { var l = g(function () { return window.I18N.lang; }, 'tc'); return l === 'en' ? 'en' : (l === 'sc' ? 'sc' : 'tc'); }
    function nodeAt(i) { var b = document.querySelector('#xz-msgs button[data-xz="speak"][data-i="' + i + '"]'); return b ? b.closest('.xz-msg') : null; }
    function pron(t) { return g(function () { return GXR.pron(GXR.pre(t)); }, t); }
    /* 逐句 azure 引擎（比照 xzm_mix2 的 speakEngine：同一個 audio、點擊當下解鎖、預抓 2 句、失敗重試 2 次、仍失敗改內建語音） */
    var E = { my: 0, on: false, cur: -1, a: null, url: null };
    function audio() {
      if (!E.a) { E.a = new Audio(); E.a.preload = 'auto'; try { E.a.playsInline = true; E.a.setAttribute('playsinline', ''); } catch (e) { } }
      return E.a;
    }
    function voice() { return g(function () { return GXR_BR.voice(); }, SAFE) || SAFE; }
    function rate() { var r = +g(function () { return G().S.ttsRate; }, 0.95) || 0.95, pct = Math.round((r - 1) * 100); return (pct >= 0 ? '+' : '') + pct + '%'; }
    function human() { return g(function () { return G().LS.get('rvOn', true) !== false; }, true) && navigator.onLine !== false; }
    function nativeSay(text, done) {
      try {
        if (!window.speechSynthesis) return done();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = g(function () { return window.I18N.ttsLang(); }, 'zh-TW'); u.rate = +g(function () { return G().S.ttsRate; }, 0.95) || 0.95;
        u.onend = u.onerror = function () { done(); };
        speechSynthesis.speak(u);
      } catch (e) { done(); }
    }
    function fetchBlob(text, ok, bad) {
      fetch(EP, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: voice(), rate: rate(), sil: 140, silc: 140, sile: 260, text: text }) })
        .then(function (r) { if (!r.ok) throw new Error('TTS ' + r.status); return r.blob(); }).then(ok, bad);
    }
    function stopMine() {
      E.my++; E.on = false; E.cur = -1;
      try { if (E.a) { E.a.pause(); E.a.onended = null; E.a.onerror = null; } } catch (e) { }
      try { if (E.url) { URL.revokeObjectURL(E.url); E.url = null; } } catch (e) { }
      try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { }
      try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none'; } catch (e) { }
    }
    var engine = {
      ready: function () { },
      state: function () { return { on: E.on, i: E.cur }; },
      stop: function () { stopMine(); },
      chunks: chunks,
      play: function (parts, title) {
        g(function () { G().TTS.stop(); });                /* 先停宿主自己的整段朗讀 */
        stopMine();
        var texts = parts.map(function (p) { return pron(p.t) || ' '; }), n = texts.length, my = ++E.my, blobs = [], played = [], isHuman = human(), a = null;
        E.on = true; E.cur = -1;
        function still() { return my === E.my && E.on; }
        function finish() { if (still()) { stopMine(); } }
        try {
          if (navigator.mediaSession && window.MediaMetadata) {
            navigator.mediaSession.metadata = new MediaMetadata({ title: title || '小智', artist: A_name() });
            navigator.mediaSession.playbackState = 'playing';
            navigator.mediaSession.setActionHandler('pause', function () { try { audio().pause(); } catch (e) { } });
            navigator.mediaSession.setActionHandler('play', function () { try { audio().play(); } catch (e) { } });
            navigator.mediaSession.setActionHandler('stop', function () { stopMine(); });
          }
        } catch (e) { }
        if (!isHuman) {
          var step = function (k) { if (!still()) return; if (k >= n) return finish(); E.cur = k; nativeSay(texts[k], function () { if (still()) step(k + 1); }); };
          step(0); return;
        }
        a = audio();
        try { a.onended = null; a.onerror = null; a.src = SIL; var pr = a.play(); if (pr && pr['catch']) pr['catch'](function () { }); } catch (e) { }   /* 點擊當下解鎖 */
        function get(k) {
          if (k >= n || blobs[k]) return;
          blobs[k] = 'p';
          (function attempt(t) {
            fetchBlob(texts[k], function (b) { if (!b || b.size < 128) return bad(t); blobs[k] = b; kick(k); }, function () { bad(t); });
            function bad(t0) {
              if (my !== E.my) return;
              if (t0 < 2) setTimeout(function () { attempt(t0 + 1); }, [800, 1600][t0]);
              else { blobs[k] = 'x'; kick(k); }
            }
          })(0);
        }
        function kick(k) { if (k === E.cur && !played[k]) playAt(k); }
        function playAt(k) {
          if (!still()) return;
          if (k >= n) return finish();
          E.cur = k;
          get(k); get(k + 1); get(k + 2);
          var b = blobs[k];
          if (!b || b === 'p') return;
          played[k] = 1;
          if (b === 'x') { nativeSay(texts[k], function () { if (still()) playAt(k + 1); }); return; }
          var au = audio();
          try { if (E.url) URL.revokeObjectURL(E.url); } catch (e) { }
          E.url = URL.createObjectURL(b);
          au.onended = function () { if (still()) playAt(k + 1); };
          au.onerror = function () { if (still()) playAt(k + 1); };
          au.src = E.url;
          var p = au.play(); if (p && p['catch']) p['catch'](function () { if (still()) playAt(k + 1); });
        }
        get(0); get(1); get(2);
        E.cur = 0; kick(0);
      },
      /* 宿主任何朗讀（整頁／整張）開始或停止時，我們這一路也要停 */
      wrap: function (onOther) {
        var T0 = g(function () { return G().TTS; }, null);
        if (!T0 || T0.__xzm) return;
        T0.__xzm = 1;
        ['speak', 'stop'].forEach(function (nm) {
          var f = T0[nm]; if (typeof f !== 'function') return;
          T0[nm] = function () { if (E.on) { stopMine(); onOther(); } return f.apply(this, arguments); };
        });
      }
    };
    function A_name() { return T('321福音同行', '321 Gospel Together'); }
    return {
      appName: A_name,
      lang: lang0,
      toast: function (m) { g(function () { G().toast(m); }); },
      ready: function () { return !!chat() && !!document.getElementById('xiaozhi'); },
      msgs: function () { var c = chat(); return c ? c.msgs : []; },
      isDone: function (m) { return !!(m && m.role === 'assistant' && !ERR.test(m.text || '')); },
      isUser: function (m) { return !!(m && m.role === 'user'); },
      busy: function () { var c = chat(); return !!(c && c.busy); },
      root: function () { return document.getElementById('xiaozhi'); },
      msgSel: '.xz-msg',
      nodeAt: nodeAt,
      bodyOf: function (node) { return node.querySelector('.xzb'); },
      answers: function () {
        var c = chat(), out = [];
        if (!c) return out;
        arr(document.querySelectorAll('#xz-msgs .xz-msg')).forEach(function (node) {
          var sp = node.querySelector('button[data-xz="speak"][data-i]'), bub = node.querySelector('.xz-bub');
          if (!sp || !bub) return;
          var i = +sp.getAttribute('data-i'), m = c.msgs[i];
          if (!m) return;
          var body = null, k;
          for (k = 0; k < bub.children.length; k++) if (bub.children[k].classList.contains('xzb')) { body = bub.children[k]; break; }
          if (!body) {                                     /* 宿主把文字直接放在氣泡裡（沒有 markdown）：包成 .xzb，動作列留在外面 */
            body = document.createElement('div'); body.className = 'xzb';
            arr(bub.childNodes).forEach(function (nd) { if (!(nd.nodeType === 1 && nd.classList.contains('xz-acts'))) body.appendChild(nd); });
            bub.insertBefore(body, bub.firstChild);
          }
          out.push({ node: node, body: body, m: m, i: i, last: i === c.msgs.length - 1 });
        });
        return out;
      },
      scroller: function () { return document.getElementById('xz-msgs'); },
      nowCls: 'spk-now',
      open: function () { g(function () { if (!chat().open) { XH().open(); } }); },
      ask: function (q) { g(function () { window.__xzAsk(q); }); },
      askQ: function (t, n) {
        var l = lang0();
        if (l === 'en') return 'About this line from Xiaozhi: “' + t + '”. ' + (n ? 'My reflection: “' + n + '”. ' : '') + 'How can I use it when sharing the gospel, and what could I say to him?';
        return T('請針對小智說的這一句，告訴我傳福音時可以怎麼運用、怎麼對他說：「', '') + t + T('」', '') + (n ? T('。我的領受是：「', '') + n + T('」', '') : '') + T('。', '');
      },
      hasCard: function () { return !!(window.GXU && GXU.open); },
      card: function (text, ref0, note) {
        try { window.GXU.open({ text: text, ref: ref0, note: note || '', plain: true }); } catch (e) { toast(T('美圖工作室還沒載入', 'Card studio is not ready')); }
      },
      restoreMsgs: function (list) {
        var c = chat(); if (!c || c.msgs.length) return;
        list.forEach(function (x) { c.msgs.push({ role: x.role, text: x.text, xid: x.id, at: x.at }); });
        g(function () { XH().draw(); });
      },
      engine: engine,
      speakHit: function (t) {
        var b = t.closest && t.closest('button[data-xz="speak"][data-i]'); if (!b) return null;
        var i = +b.getAttribute('data-i'), c = chat(), m = c && c.msgs[i];
        if (!m || !H.isDone(m)) return null;
        var node = nodeAt(i); if (!node || !node.querySelector('.xzs')) return null;
        return { i: i, key: 'msg:' + i };
      },
      syncBtn: function (rd) {
        arr(document.querySelectorAll('#xz-msgs button[data-xz="speak"][data-i]')).forEach(function (b) {
          var c = chat(), m = c && c.msgs[+b.getAttribute('data-i')], on = !!(rd && m && m.xid === rd.mid && rd.kind === 'msg');
          if (b.getAttribute('data-xzl') == null) b.setAttribute('data-xzl', b.textContent);
          b.textContent = on ? '⏹ ' + T('停止', 'Stop') : b.getAttribute('data-xzl');
        });
      },
      /* 設定頁：把清單接在「我的畫線與默想」那一張卡後面（包 SHEETS.settings，不改宿主碼） */
      refreshMe: function () { if (document.querySelector('.xzm-me')) g(function () { G().refreshSheet(); }); },
      wrapSettings: function () {
        var Gg = G(), S0 = Gg && Gg.SHEETS && Gg.SHEETS.settings;
        if (!S0 || S0.__xzm) return;
        var f = function () {
          return Promise.resolve(S0.apply(this, arguments)).then(function (html) {
            return html + '<div class="card xzm-me"><div class="eyebrow">' + esc(listTitle()) + '</div>' + listBody() + '</div>';
          });
        };
        f.__xzm = 1; Gg.SHEETS.settings = f;
      },
      vars: { bg: 'var(--bg,#fff)', ink: 'var(--ink,#222)', soft: 'var(--ink-2,#666)', alt: 'var(--soft,#f3f1f6)', line: 'var(--line,#ccc)', pri: 'var(--navy,#4E2061)', priInk: '#fff', gold: 'var(--gold,#B8860B)', danger: '#B3261E', quote: 'var(--gold,#B8860B)' },
      under: false,
      tints: null,
      css: '.xzs.spk-now{background:rgba(78,32,97,.16)}[data-theme="dark"] .xzs.spk-now{background:rgba(190,150,220,.30)}' +
        '.xz-bub .xzb{display:block}',
      hook: function () { }
    };
  }

  H = KIND === 'gospel' ? hostGospel() : hostLs();

  /* ── 樣式 ───────────────────────────────────────────────────── */
  function buildCss() {
    var V = H.vars, c = '', i;
    COLORS.forEach(function (k) {
      var tint = H.tints ? H.tints[k.id] : 'rgba(' + k.rgb + ',.42)';
      c += H.under ? '.xzs[data-xzm-c="' + k.id + '"]{background:linear-gradient(transparent 60%,' + tint + ' 60%);border-radius:2px}'
                   : '.xzs[data-xzm-c="' + k.id + '"]{background:' + tint + ';padding:1px 3px}';
      c += '.mknote[data-c="' + k.id + '"]{border-left-color:' + k.dot + '}';
    });
    c += '.xzm-notes{margin:8px 0 2px}' +
      '.mknote{margin:6px 0 0;padding:7px 11px;background:' + V.alt + ';border-left:3px solid ' + V.gold + ';border-radius:6px;font-size:.85em;color:' + V.ink + ';white-space:pre-wrap;cursor:pointer;line-height:1.55}' +
      '.mknote .q{display:block;font-size:.82em;color:' + V.soft + ';margin-bottom:2px}' +
      '.xzp-mask{position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.45);z-index:450;display:flex;align-items:flex-end}' +
      '.xzp-card{background:' + V.bg + ';color:' + V.ink + ';width:100%;max-width:720px;margin:0 auto;max-height:88vh;overflow-y:auto;-webkit-overflow-scrolling:touch;border-radius:18px 18px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 30px rgba(0,0,0,.25);box-sizing:border-box}' +
      '.xzp-grip{width:44px;height:5px;border-radius:3px;background:' + V.line + ';margin:-6px auto 12px}' +
      '.xzp-title{font-size:16px;font-weight:800;margin-bottom:10px}' +
      '.xzp-quote{border-left:3px solid ' + V.quote + ';padding:4px 0 4px 14px;font-size:15px;line-height:1.7;color:' + V.soft + ';margin-bottom:12px;max-height:26vh;overflow-y:auto;word-break:break-word}' +
      '.xzp-colorrow{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}' +
      '.xzp-lb{font-size:12.5px;color:' + V.soft + ';white-space:nowrap}' +
      '.xzp-colors{display:flex;gap:10px;flex-wrap:wrap}' +
      '.xzp-sw{width:28px;height:28px;border-radius:50%;border:2px solid transparent;padding:0;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}' +
      '.xzp-sw.on{border-color:' + V.ink + '}' +
      '.xzp-ta{width:100%;box-sizing:border-box;border:1px solid ' + V.line + ';border-radius:10px;padding:10px 12px;font-size:16px;font-family:inherit;resize:vertical;background:' + V.alt + ';color:' + V.ink + ';min-height:84px;margin-bottom:12px}' +
      '.xzp-acts{display:flex;gap:8px;flex-wrap:wrap}' +
      '.xzp-b{flex:1 1 auto;min-height:42px;padding:9px 12px;border-radius:9px;border:1px solid ' + V.line + ';background:' + V.bg + ';color:' + V.ink + ';font:inherit;font-size:14px;font-weight:600;cursor:pointer}' +
      '.xzp-b.pri{background:' + V.pri + ';border-color:' + V.pri + ';color:' + V.priInk + '}' +
      '.xzp-b.danger{color:' + V.danger + ';border-color:' + V.danger + '}' +
      '.xzm-li{display:flex;gap:10px;padding:10px 0;border-top:1px solid ' + V.line + '}.xzm-li:first-child{border-top:0}' +
      '.xzm-dot{flex:0 0 14px;height:14px;border-radius:50%;margin-top:5px}' +
      '.xzm-lt{flex:1;min-width:0;word-break:break-word}.xzm-tx{cursor:pointer;line-height:1.6}' +
      '.xzm-s{font-size:.8em;color:' + V.soft + ';margin-top:2px}' +
      '.xzm-bt{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}' +
      '.xzm-mini{padding:5px 11px;min-height:34px;border-radius:8px;border:1px solid ' + V.line + ';background:' + V.alt + ';color:' + V.ink + ';font:inherit;font-size:.85em;cursor:pointer}' +
      '.xzm-empty{font-size:.9em;color:' + V.soft + ';padding:6px 0}';
    return c + (H.css || '');
  }

  /* ── 組出 adapter ───────────────────────────────────────────── */
  var A = {
    css: buildCss(),
    lang: A_lang,
    toast: toast,
    msgs: function () { return H.msgs(); },
    isDone: function (m) { return H.isDone(m); },
    isUser: function (m) { return H.isUser(m); },
    busy: function () { return H.busy(); },
    open: function () { H.open(); },
    root: function () { return H.root(); },
    msgSel: H.msgSel,
    nodeAt: function (i) { return H.nodeAt(i); },
    msgAt: function (i) { return H.msgs()[i]; },
    bodyOf: function (node) { return H.bodyOf(node); },
    answers: function () { return H.answers(); },
    scroller: function () { return H.scroller(); },
    nowCls: H.nowCls,
    follow: function () { return true; },
    hint: true,
    clean: cleanSpeak,
    idOf: function (m) { if (!m.xid) { m.xid = m.id || X.newId(); } return m.xid; },
    engine: H.engine,
    syncBtn: H.syncBtn || null,
    store: o.store === false ? null : {
      get: function () { if (!H.ready()) return null; try { return JSON.parse(localStorage.getItem('xzm_' + SLUG) || 'null'); } catch (e) { return null; } },
      set: function (l) { try { localStorage.setItem('xzm_' + SLUG, JSON.stringify(l)); } catch (e) { } }
    },
    restore: function (list) { H.restoreMsgs(list); },
    marks: {
      any: function () { return keys().length > 0; },
      attach: function () { },
      paint: function () { paint(); },
      tap: function (xk, el) {
        var d = dbGet();
        if (d[xk]) { openPanel(xk, el); return; }
        var c = lastColor();
        d[xk] = { c: c, n: '', t: X.sentText(el).slice(0, 200), at: Date.now(), lang: A_lang() };
        dbSet(d); paint(); refreshMe();
      },
      keys: keys
    },
    hook: function () {
      if (H.wrapSettings) { var tries = 0, tm = setInterval(function () { H.wrapSettings(); if (g(function () { return window.__G.SHEETS.settings.__xzm; }, false) || ++tries > 40) clearInterval(tm); }, 400); }
      /* 宿主要等到載入完才有聊天物件：就緒後補還原 */
      var n = 0, t2 = setInterval(function () { if (H.ready()) { clearInterval(t2); X.restore(); X.scan(); refreshMe(); } else if (++n > 80) clearInterval(t2); }, 250);
      /* 🔊：window 捕獲階段先接（早於宿主 document 捕獲／#chatlog 冒泡） */
      window.addEventListener('click', function (ev) {
        var hit = g(function () { return H.speakHit(ev.target); }, null);
        if (!hit) return;
        ev.stopPropagation(); ev.preventDefault();
        NEXT = { key: hit.key, mi: hit.i };
        try { X.speakMsg(hit.i); } finally { NEXT = null; }
      }, true);
      /* 「我的」頁每次重畫後補清單（ls 宿主） */
      if (KIND === 'ls') {
        var mt = 0, mo = null, v = null;
        setInterval(function () {
          var el = document.getElementById('view');
          if (el && el !== v) { v = el; if (mo) mo.disconnect(); mo = new MutationObserver(function () { clearTimeout(mt); mt = setTimeout(refreshMe, 60); }); mo.observe(el, { childList: true }); refreshMe(); }
        }, 700);
      }
    }
  };
  XZM.mini = { openPanel: openPanel, db: dbGet, keys: keys, kind: KIND, host: function () { return H; } };
  return A;
};
/* ═══ preset.fl：國度321空中團契主 App（321fellowship）═══════════════════════════════════════════════════════
   宿主：小智聊天 = aic（#aicHost 滿版視窗，訊息 #msg{i}、內文 .msg-body、捲動容器 #aic-msgs，非串流：回答完成才寫入 m.ok），
        整個 App 包在一個 IIFE 裡；正文畫線（k321_marks）以「課號＋區塊#句」為鍵、面板綁 hlCur，無法直接收小智的句子。
   接法：
     · 畫線資料：localStorage `k321_xzm_hl`（key＝句子代號 xk，值 {c 顏色, n 領受, t 原句, at, lang}）；顏色沿用宿主 S.lastColor
     · 面板：用宿主的 openHSheet／closeHSheet 與同一組 class（hlswatch、sheet-ta、btn、xbtn…）與同一批介面字串（X321.T），
             看起來與正文畫線的面板一致：八色、領受、問小智、做成美圖（宿主 openStudio ＝團契嵌入的完整美圖）、朗讀這句、
             從這裡朗讀、複製、分享、刪除
     · 朗讀：宿主的 spk 佇列（一句一項，由宿主的 raSeg 加 .tts-reading 並捲到畫面中央）；與共讀相容（小智視窗不在 #view，共讀不送出）
     · 訊息保存：宿主自己存（k321_ai_chat，最近 60 則）；XZM 只補 m.xid／m.at 並請宿主 chatSave
     · 「我的畫線」頁：#view 重畫後在畫線分頁底下補一張「✨ 小智」卡（孤兒——原回答已不在對話——仍列出，跳轉停用）
   宿主掛鉤（index.html 內 window.X321.xz，只提供存取，不改任何行為）：
     aic、chatSave、msgFold、ask、studio、copy、share、url、svg、rerender、v(spk|sayKey|raManualAt|RA_COOL)、tts{stop,unlock,awake,media,paint,play,prep}
   全部 UI 字串：宿主已有的用 X321.T（含簡體），其餘用 T('繁體','English')，簡體由 build_xzm.py 產生。                          */
XZM.preset.fl = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T, esc = X.esc;
  var HX = window.X321, H = HX && HX.xz;
  if (!H) throw new Error('xzm.fl: X321.xz hook missing');
  var DBK = 'k321_xzm_hl';
  var COLORS = ['gold', 'green', 'blue', 'pink', 'purple', 'maroon', 'brown', 'charcoal'];
  var SW = { gold: '#D9B168', green: '#6FAE71', blue: '#6C93D1', pink: '#E58FA0', purple: '#A48AC9', maroon: '#8C4A4E', brown: '#8A6740', charcoal: '#54534E' };
  var ST = { xk: '', saveT: 0, meT: 0 };

  function hT() { return HX.T.apply(null, arguments); }
  function AL() { return HX.isEN() ? 'en' : (HX.isZS() ? 'sc' : 'tc'); }
  function host() { return document.getElementById('aicHost'); }
  function chat() { return H.aic.msgs; }
  function toast(m) { g(function () { HX.toast(m); }); }
  function who() { return hT('xz'); }
  function Qt(s) { return HX.isEN() ? '“' + s + '”' : '「' + s + '」'; }

  /* ── 資料庫 ─────────────────────────────────────────────────────── */
  function dbGet() { try { var d = JSON.parse(localStorage.getItem(DBK) || '{}'); return (d && typeof d === 'object') ? d : {}; } catch (e) { return {}; } }
  function dbSet(d) { try { localStorage.setItem(DBK, JSON.stringify(d)); } catch (e) { } }
  function keys() { return Object.keys(dbGet()).filter(X.isZ); }
  function lastColor() { var c = g(function () { return HX.S.lastColor; }, ''); return COLORS.indexOf(c) >= 0 ? c : 'gold'; }
  function setLastColor(c) { g(function () { HX.S.lastColor = c; HX.save(); }); }
  function refOf(r) { return who() + (r && r.at ? ' · ' + g(function () { return HX.fmtDate(r.at); }, '') : ''); }
  function outText(xk) {
    var r = dbGet()[xk]; if (!r) return '';
    return Qt(r.t) + '\n—— ' + who() + (r.n ? '\n\n' + r.n : '') + '\n\n' + hT('fellowshipName') + '\n' + g(function () { return H.url(); }, '');
  }
  function askText(r) {
    var note = r.n ? T('我的默想：', 'My note: ') + r.n + '\n' : '';
    return hT('xzAboutHl', Qt(r.t), who(), note);
  }

  /* ── 畫線上色＋回答下方的「領受」條 ─────────────────────────────── */
  function paint() {
    var hs = host(); if (!hs) return;
    var db = dbGet();
    arr(hs.querySelectorAll('.xzs')).forEach(function (e) {
      var r = db[e.getAttribute('data-xk')];
      if (r) { var c = r.c || 'gold'; if (e.getAttribute('data-xzm-c') !== c) e.setAttribute('data-xzm-c', c); }
      else if (e.hasAttribute('data-xzm-c')) e.removeAttribute('data-xzm-c');
    });
    g(function () {
      A.answers().forEach(function (a) {
        var list = [], box = a.node.querySelector('.xzf-notes'), sig, i;
        arr(a.body.querySelectorAll('.xzs[data-xzm-c]')).forEach(function (e) {
          var xk = e.getAttribute('data-xk'), r = db[xk];
          if (r && r.n) list.push({ xk: xk, c: r.c || 'gold', n: r.n, q: X.sentText(e) });
        });
        sig = list.map(function (x) { return x.xk + x.c + x.n; }).join('~');
        if (!list.length) { if (box) box.parentNode.removeChild(box); return; }
        if (box && box.getAttribute('data-sig') === sig) return;
        if (box) box.parentNode.removeChild(box);
        box = document.createElement('div'); box.className = 'xzf-notes'; box.setAttribute('data-sig', sig);
        var h = '';
        for (i = 0; i < list.length; i++) {
          var q = list[i].q; if (q.length > 16) q = q.slice(0, 16) + '…';
          h += '<div class="hl-note xzf-note" data-color="' + esc(list[i].c) + '" data-xk="' + esc(list[i].xk) + '"><span class="q">' + esc(q) + '</span>' + esc(list[i].n) + '</div>';
        }
        box.innerHTML = h;
        a.body.parentNode.insertBefore(box, a.body.nextSibling);
      });
    });
  }
  /* 第一次進來的提示：用宿主自己的 hlTip 字串（英文名稱是 Sage AI，不是 Xiaozhi），只出現在最後一則回答、且還沒有任何小智畫線時 */
  function ensureHint() {
    if (keys().length) return;
    var la = A.answers().filter(function (a) { return a.last && a.body.querySelector('.xzs'); })[0];
    if (!la || la.body.querySelector('.xzhint')) return;
    arr(document.querySelectorAll('#aicHost .xzhint')).forEach(function (e) { e.parentNode.removeChild(e); });
    la.body.insertAdjacentHTML('beforeend', '<div class="xzhint" data-xzskip="1">' + esc(hT('hlTip')) + '</div>');
  }

  /* ── 面板（宿主的 openHSheet ＋ 同一組 class）──────────────────── */
  function closePanel() { ST.xk = ''; g(function () { HX.closeHSheet(); }); }
  function keep() {
    var ta = document.getElementById('xzfNote'), d = dbGet(), x = d[ST.xk];
    if (!ta || !x) return '';
    x.n = (ta.value || '').replace(/^\s+|\s+$/g, ''); d[ST.xk] = x; dbSet(d); paint(); refreshMe();
    return x.n;
  }
  function openPanel(xk) {
    var r = dbGet()[xk]; if (!r) return;
    g(function () { HX.closeHSheet(); });
    ST.xk = xk;
    var live = !!X.sentEl(xk), sw = '';
    COLORS.forEach(function (c) { sw += '<button class="hlswatch' + (c === (r.c || 'gold') ? ' on' : '') + '" data-xzf="c" data-c="' + c + '" style="background:' + SW[c] + '" aria-label="' + c + '"></button>'; });
    HX.openHSheet(
      '<div class="sheet-title">' + esc(hT('hlTitle')) + '<span class="sheet-ref">' + esc(who()) + '</span></div>' +
      '<div class="sheet-quote">' + esc(r.t) + '</div>' +
      '<div class="sheet-row"><span class="sheet-lab">' + esc(hT('hlColor')) + '</span><div class="swatches">' + sw + '</div></div>' +
      '<textarea class="sheet-ta" id="xzfNote" placeholder="' + esc(hT('hlNotePH')) + '">' + esc(r.n || '') + '</textarea>' +
      '<div class="sheet-acts"><button class="btn gold" data-xzf="save">' + esc(hT('save')) + '</button><button class="btn" data-xzf="ask">' + g(function () { return H.svg('chat'); }, '') + ' ' + esc(hT('askXz')) + '</button></div>' +
      '<div class="sheet-acts2"><button class="xbtn gold" data-xzf="card">' + g(function () { return H.svg('img'); }, '') + ' ' + esc(hT('makeCard')) + '</button>' +
      (live ? '<button class="xbtn" data-xzf="read">' + g(function () { return H.svg('sound'); }, '') + ' ' + esc(hT('readThis')) + '</button><button class="xbtn" data-xzf="from">▶ ' + esc(T('從這裡朗讀', 'Read from here')) + '</button>' : '') +
      '<button class="xbtn" data-xzf="copy">' + esc(hT('copy')) + '</button><button class="xbtn" data-xzf="share">' + esc(hT('share')) + '</button>' +
      '<button class="xbtn bad" data-xzf="del">' + esc(hT('hlDel')) + '</button><button class="xbtn" data-xzf="close">' + esc(hT('close')) + '</button></div>');
  }
  function panelAct(a, b) {
    var xk = ST.xk, d = dbGet(), r = d[xk];
    if (!r) { closePanel(); return; }
    if (a === 'c') {
      var c = b.getAttribute('data-c'); r.c = c; d[xk] = r; dbSet(d); setLastColor(c); paint(); refreshMe();
      arr(document.querySelectorAll('#hsheet .hlswatch')).forEach(function (s) { s.className = 'hlswatch' + (s === b ? ' on' : ''); });
      return;
    }
    if (a === 'save') { keep(); closePanel(); toast(hT('saved')); return; }
    if (a === 'close') { keep(); closePanel(); return; }
    if (a === 'del') { if (window.confirm(hT('delHl'))) { delete d[xk]; dbSet(d); closePanel(); paint(); refreshMe(); } return; }
    if (a === 'copy') { keep(); g(function () { H.copy(outText(xk)); }); toast(hT('copied')); return; }
    if (a === 'share') { keep(); g(function () { H.share(outText(xk)); }); return; }
    var n = keep(), r2 = dbGet()[xk] || r;
    if (a === 'ask') { closePanel(); g(function () { H.ask(askText(r2), { t: r2.t, ref: who() }); }); return; }
    if (a === 'card') { closePanel(); g(function () { H.studio({ t: r2.t, ref: '', n: n, plain: true }); }); return; }
    if (a === 'read' || a === 'from') { closePanel(); X.sayFrom(xk, a === 'read'); }
  }

  /* ── 「我的畫線」頁：畫線分頁底下加一張小智卡 ──────────────────── */
  function refreshMe() {
    clearTimeout(ST.meT);
    ST.meT = setTimeout(function () { g(doMe); }, 30);
  }
  function doMe() {
    var v = document.getElementById('view'); if (!v) return;
    var old = v.querySelector('.xzf-me'), on = !!v.querySelector('button[data-xact="mtab"][data-t="hl"].on'), db = dbGet(), ks = on ? keys() : [];
    if (!ks.length) { if (old) old.parentNode.removeChild(old); return; }
    ks.sort(function (a, b) { return (db[b].at || 0) - (db[a].at || 0); });
    var sig = AL() + '|' + JSON.stringify(db) + '|' + chat().length;
    if (old && old.getAttribute('data-sig') === sig) return;
    if (old) old.parentNode.removeChild(old);
    var h = '';
    ks.slice(0, 60).forEach(function (k) {
      var x = db[k], orphan = !X.msgById(X.parse(k).id);
      h += '<div class="hitem" data-xk="' + esc(k) + '"><div class="q" data-color="' + esc(x.c || 'gold') + '">' + esc(x.t) + '</div>' + (x.n ? '<div class="n">' + esc(x.n) + '</div>' : '') +
        '<div class="m"><span>' + esc(refOf(x)) + (orphan ? '　' + esc(T('（原回答已不在對話中）', '(the original answer is no longer in the chat)')) : '') + '</span><span>' +
        (orphan ? '' : '<button data-xzf="go" aria-label="open">↗</button>') +
        '<button data-xzf="lcard" aria-label="picture">🖼</button><button data-xzf="lask" aria-label="ask">✨</button><button data-xzf="ldel" aria-label="delete">✕</button></span></div></div>';
    });
    var card = document.createElement('div');
    card.className = 'card xzf-me'; card.setAttribute('data-sig', sig); card.style.padding = '4px 16px';
    card.innerHTML = '<p class="eyebrow" style="margin:12px 0 0">✨ ' + esc(who()) + '（' + ks.length + '）</p>' + h +
      (ks.length > 60 ? '<p class="note" style="margin:8px 0 12px">' + esc(T('只列出最近 60 筆。', 'Showing the latest 60.')) + '</p>' : '');
    /* 宿主在完全沒有畫線時只放一張「還沒有畫線」的空卡：有小智畫線就不要它 */
    var last = v.lastElementChild;
    if (last && last.classList.contains('center') && last.classList.contains('card') && last.querySelector('.note') && !last.classList.contains('xzf-me')) v.removeChild(last);
    v.appendChild(card);
  }
  function listAct(a, xk) {
    var d = dbGet(), r = d[xk]; if (!r) return;
    if (a === 'go') X.jump(xk);
    else if (a === 'lcard') g(function () { H.studio({ t: r.t, ref: '', n: r.n || '', plain: true }); });
    else if (a === 'lask') g(function () { H.ask(askText(r), { t: r.t, ref: who() }); });
    else if (a === 'ldel') { if (window.confirm(hT('delHl'))) { delete d[xk]; dbSet(d); paint(); g(function () { H.rerender(); }); refreshMe(); } }
  }

  /* ── 逐句朗讀：宿主的 spk 佇列 ──────────────────────────────── */
  function lastOkIdx() { var a = chat(), i; for (i = a.length - 1; i >= 0; i--) if (a[i].role !== 'user') return A.isDone(a[i]) ? i : -1; return -1; }
  function foldIdx(node) { return +String(node.id).replace('msg', ''); }

  var A = {
    css:
      '.xzs{-webkit-tap-highlight-color:transparent;-webkit-box-decoration-break:clone;box-decoration-break:clone}' +
      COLORS.map(function (c) { return '.xzs[data-xzm-c="' + c + '"]{background:linear-gradient(transparent 58%,var(--hlbg-' + c + ') 58%)}'; }).join('') +
      '.xzs.tts-reading[data-xzm-c]{background:none}' +
      '.aic-msg table.tts-reading{background:var(--reading)}' +
      '.aic-msg .xzhint{margin-top:10px;font-size:calc(13px * var(--fs,1))}' +
      '.xzf-notes{margin-top:8px}.xzf-note{margin:6px 0 8px;font-size:calc(14px * var(--fs,1))}' +
      '.xzf-note .q{display:block;font-size:.82em;color:var(--muted);margin-bottom:2px}' +
      '.xzf-me .hitem .q{white-space:pre-wrap}',
    lang: AL,
    toast: toast,
    msgs: chat,
    isDone: function (m) { return !!(m && m.role !== 'user' && m.ok && !m.wait && !m.cont && !m.err); },
    isUser: function (m) { return !!(m && m.role === 'user'); },
    busy: function () { return !!H.aic.busy; },
    open: function () {
      var a = H.aic;
      if (!a.open || a.favView) { a.favView = false; a.open = true; g(function () { window.renderAIC(); }); }
    },
    root: host,
    msgSel: '.aic-msg.aic-ai',
    nodeAt: function (i) { return document.getElementById('msg' + i); },
    msgAt: function (i) { return chat()[i]; },
    bodyOf: function (node) { return node.querySelector('.msg-body'); },
    scroller: function () { return document.getElementById('aic-msgs'); },
    follow: function () { return true; },
    hint: false,
    idOf: function (m) {
      if (!m.xid) {
        m.xid = X.newId(); if (!m.at) m.at = Date.now();
        clearTimeout(ST.saveT); ST.saveT = setTimeout(function () { g(function () { H.chatSave(); }); }, 40);
      }
      return m.xid;
    },
    answers: function () {
      var a = chat(), lk = lastOkIdx(), out = [], hs = host();
      if (!hs) return out;
      arr(hs.querySelectorAll('.aic-msg.aic-ai[id^="msg"]')).forEach(function (node) {
        var i = foldIdx(node), m = a[i];
        if (m) out.push({ node: node, body: node.querySelector('.msg-body'), m: m, i: i, last: i === lk });
      });
      return out;
    },
    marks: {
      any: function () { return keys().length > 0; },
      attach: function () { },
      paint: paint,
      tap: function (xk, el) {
        var d = dbGet();
        if (d[xk]) { openPanel(xk); return; }
        d[xk] = { c: lastColor(), n: '', t: X.sentText(el).slice(0, 400), at: Date.now(), lang: AL() };
        dbSet(d); paint(); refreshMe();
        toast(hT('hlAdded'));
      },
      keys: keys
    },
    /* 逐句朗讀：把句子排進宿主的 spk 佇列（宿主的 raSeg 加 .tts-reading、捲動、手動捲動後 RA_COOL 內不搶畫面） */
    beginMsg: function (i, m, node, units, id, isFrom) {
      var idx = i >= 0 ? i : chat().indexOf(m), key = 'm' + idx;
      if (!isFrom && g(function () { return H.v('sayKey') === key && H.v('spk').on; }, false)) { H.tts.stop(); return true; }
      if (node.classList.contains('fold')) g(function () { H.msgFold(idx); });
      var items = [];
      units.forEach(function (u) {
        var els = u.keys.map(X.sentEl).filter(Boolean), t = u.t;
        if (u.whole && els[0]) { var tb = els[0].closest('table'); if (tb) els = [tb]; }
        var pl = g(function () { return H.tts.prep(t).length; }, t.length);
        if (!els.length || !pl) return;
        items.push({ text: t, segs: els, lens: [Math.max(1, pl)], keys: els.map(function () { return ''; }), xks: u.keys.slice(), at: -1 });
      });
      if (!items.length) return false;
      H.tts.stop(); H.tts.unlock();
      var ttl = who();
      H.v('spk', { on: true, items: items, idx: 0, cache: {}, native: false, abort: false, title: ttl, kind: 'xz' });
      H.v('raManualAt', 0); H.v('sayKey', key);
      g(function () { H.tts.awake(true); }); g(function () { H.tts.media(ttl); }); g(function () { H.tts.paint(); });
      H.tts.play(0);
      return true;
    },
    /* 聊天視窗重畫（收合、收藏、送出新問題…）之後：把佇列裡的句子元素換成新的，現在唸到的那句重新亮起 */
    afterScan: function (tagged) {
      g(ensureHint);
      var sp = g(function () { return H.v('spk'); }, null);
      if (!tagged || !sp || !sp.on) return;
      var cur = null;
      sp.items.forEach(function (it, j) {
        if (!it.xks) return;
        var els = it.xks.map(X.sentEl).filter(Boolean);
        if (els.length) { if (it.segs[0] && it.segs[0].tagName === 'TABLE') { var tb = els[0].closest('table'); if (tb) els = [tb]; } it.segs = els; it.keys = els.map(function () { return ''; }); }
        if (j === sp.idx) cur = it;
      });
      if (cur && cur.at >= 0) {
        var k = cur.at, keepAt = H.v('raManualAt'); cur.at = -1; H.v('raManualAt', Date.now()); g(function () { H.tts.seg(cur, k); }); H.v('raManualAt', keepAt);
      }
    },
    syncBtn: function () { g(function () { H.tts.paint(); }); },
    beforeMark: function (el) {
      var n = el.closest && el.closest('.aic-msg');
      if (n && n.classList.contains('fold')) g(function () { H.msgFold(foldIdx(n)); });
    },
    hook: function () {
      document.addEventListener('click', function (ev) {
        var t = ev.target; if (!t || !t.closest) return;
        var pb = t.closest('[data-xzf]');
        if (pb) {
          if (pb.closest('#hsheet')) { ev.stopPropagation(); ev.preventDefault(); panelAct(pb.getAttribute('data-xzf'), pb); return; }
          var li = pb.closest('.xzf-me .hitem');
          if (li) { ev.stopPropagation(); ev.preventDefault(); listAct(pb.getAttribute('data-xzf'), li.getAttribute('data-xk')); return; }
        }
        if (t.id === 'hsheet' && ST.xk && document.getElementById('xzfNote')) { keep(); ST.xk = ''; return; }   /* 點遮罩關閉前先存領受 */
        var nb = t.closest('.xzf-note');
        if (nb && nb.closest('#aicHost')) { ev.stopPropagation(); ev.preventDefault(); openPanel(nb.getAttribute('data-xk')); return; }
        var tb = t.closest('#aicHost [data-xact="msgtts"]');
        if (tb && X.speakMsg(+tb.getAttribute('data-i'))) { ev.stopPropagation(); ev.preventDefault(); }
      }, true);
      /* 使用者自己捲動後 6 秒不搶畫面（宿主原本 4 秒；全域設定，正文朗讀也一樣） */
      if (!o.noNow) g(function () { H.v('RA_COOL', Math.max(+H.v('RA_COOL') || 0, 6000)); });
      /* 「我的畫線」頁每次重畫後補小智卡 */
      var mo = null, vw = null;
      setInterval(function () {
        var el = document.getElementById('view');
        if (el && el !== vw) { vw = el; if (mo) mo.disconnect(); mo = new MutationObserver(function () { refreshMe(); }); mo.observe(el, { childList: true }); refreshMe(); }
        else if (el) g(doMe);   /* 小智視窗裡清空／刪除訊息不會重畫 #view：低頻補一次，孤兒狀態才會更新 */
      }, 700);
    }
  };
  XZM.fl = { openPanel: openPanel, db: dbGet, keys: keys };
  return A;
};
/* ═══ preset.bb：321互動聖經（bible repo；app.js 為頂層 classic script，ES2017，所有函式／let 全域可見）══════════════════
   小智＝chatLog（{role:'user'|'ai', text, ok, cont, src}）、paintChat()（每次整個 #chatlog 重畫）、mdToHtml()、sendChat()。
   本 preset 不改 app.js 任何一行，只從外面「看著」#view（MutationObserver，由 core 負責）並包裝兩個全域函式：
     · ttsMaybeAutoNext：小智逐句朗讀唸完時，宿主會「自然結束→自動接下一章」，要擋掉（只擋 XZM 開的那一輪）
   畫線：宿主正文的畫線系統綁死 #reader／RD.book，不適合小智的句子，所以自帶一套（比照 preset.mini）：
     · 資料庫 localStorage `xzm_hl_bible`（key＝句子代號 xk，值 {c 顏色, n 領受, t 原句, at, lang}）
     · 點一下畫線、再點開面板（面板直接用宿主的 hlsheet-* 樣式，與正文畫線面板一個樣子）：
       換色、領受、✨問小智、🖼做成美圖（openStudio）、🔊朗讀這句、▶從這裡朗讀、複製、分享、取消畫線
     · 「我的」頁在「我的畫線」那一組後面多一組「✨ 小智畫線」（孤兒仍列出）＋複製全部
   朗讀：poll 型引擎，借宿主 spk 佇列（ttsPlayFrom：預抓、重試、改內建語音、鎖屏、暫停全是宿主的），一句一個項目、
        項目不帶 segs（宿主的 raSeg 不動），由 core 的 tick 讀 spk.idx 標 .spk-now 並捲動（手動捲動後 6 秒不搶）。
        朗讀文字與宿主整則朗讀一致：以 mdSpeak(m.text) 的口語版對齊每個區塊，補上「首先／我們來談…」等帶入詞；對齊失敗退回原句。
   小智訊息：宿主沒有保存，XZM 另存 xzm_bible（最近 60 則），重開 App 放回 chatLog。
   語言：宿主 60+ 種語言，XZM 只有 繁／簡／英三套字串——zh→繁、zs→簡、其他一律英文（與宿主 L3 的回退一致）。
   全部 UI 字串用 T('繁體','English')，簡體由 build_xzm.py 以系統 ICU 產生。                                                         */
XZM.preset.bb = function (o) {
  o = o || {};
  var X = XZM, g = X.g, arr = X.arr, T = X.T, esc = X.esc;
  var SLUG = o.slug || 'bible';
  var DBK = 'xzm_hl_' + SLUG, COLK = 'xzm_hlc_' + SLUG;
  var NEXT = null;                                    /* 下一次 engine.play 的訊息索引（sayId 用） */

  var COLORS = [
    { id: 'gold', dot: '#D9B168', rgb: '217,167,61' }, { id: 'green', dot: '#6FAE71', rgb: '111,174,113' },
    { id: 'blue', dot: '#6C93D1', rgb: '108,147,209' }, { id: 'pink', dot: '#E58FA0', rgb: '229,143,160' },
    { id: 'purple', dot: '#A48AC9', rgb: '164,138,201' }, { id: 'maroon', dot: '#8C4A4E', rgb: '140,74,78' },
    { id: 'brown', dot: '#8A6740', rgb: '138,103,64' }, { id: 'charcoal', dot: '#54534E', rgb: '84,83,78' }
  ];
  function colName(id) {
    var m = { gold: T('金', 'Gold'), green: T('綠', 'Green'), blue: T('藍', 'Blue'), pink: T('粉', 'Pink'), purple: T('紫', 'Purple'), maroon: T('酒紅', 'Maroon'), brown: T('咖啡', 'Brown'), charcoal: T('墨黑', 'Charcoal') };
    return m[id] || id;
  }
  function dotOf(id) { var c = COLORS.filter(function (x) { return x.id === id; })[0] || COLORS[0]; return c.dot; }

  /* ── 宿主（全域）────────────────────────────────────────────── */
  function hostLang() { return g(function () { return state.lang; }, 'zh'); }
  function A_lang() { var l = hostLang(); return l === 'zh' ? 'tc' : (l === 'zs' ? 'sc' : 'en'); }
  function toast(m) { g(function () { window.toast(m, 2200); }); }
  function log() { return g(function () { return chatLog; }, null) || []; }
  function msgIndex(m) { return log().indexOf(m); }
  function nodeAt(i) { return document.getElementById('msg' + i); }
  function viewEl() { return document.getElementById('view'); }

  /* ── 資料庫 ─────────────────────────────────────────────────── */
  function dbGet() { try { var d = JSON.parse(localStorage.getItem(DBK) || '{}'); return (d && typeof d === 'object') ? d : {}; } catch (e) { return {}; } }
  function dbSet(d) { try { localStorage.setItem(DBK, JSON.stringify(d)); } catch (e) { } }
  function lastColor() { try { var c = localStorage.getItem(COLK); return COLORS.some(function (x) { return x.id === c; }) ? c : 'gold'; } catch (e) { return 'gold'; } }
  function setLastColor(c) { try { localStorage.setItem(COLK, c); } catch (e) { } }
  function keys() { return Object.keys(dbGet()).filter(X.isZ); }
  function fmtDate(ts) { return ts ? g(function () { return new Date(ts).toLocaleDateString(); }, '') : ''; }

  /* ── 畫線上色＋回答下方的「領受」清單 ───────────────────────── */
  function noteSig(list) { return list.map(function (x) { return x.xk + x.c + x.n; }).join('~'); }
  function paint() {
    var db = dbGet();
    arr(document.querySelectorAll('.xzs')).forEach(function (e) {
      var r = db[e.getAttribute('data-xk')];
      if (r) { if (e.getAttribute('data-xzm-c') !== (r.c || 'gold')) e.setAttribute('data-xzm-c', r.c || 'gold'); }
      else if (e.hasAttribute('data-xzm-c')) e.removeAttribute('data-xzm-c');
    });
    g(function () {
      A.answers().forEach(function (a) {
        var list = [], box = a.node.querySelector('.xzm-notes'), sig, i;
        arr(a.body.querySelectorAll('.xzs[data-xzm-c]')).forEach(function (e) {
          var xk = e.getAttribute('data-xk'), r = db[xk];
          if (r && r.n) list.push({ xk: xk, c: r.c || 'gold', n: r.n, q: X.sentText(e) });
        });
        sig = noteSig(list);
        if (!list.length) { if (box) box.parentNode.removeChild(box); return; }
        if (box && box.getAttribute('data-sig') === sig) return;
        if (box) box.parentNode.removeChild(box);
        box = document.createElement('div'); box.className = 'xzm-notes'; box.setAttribute('data-sig', sig);
        var h = '';
        for (i = 0; i < list.length; i++) {
          var q = list[i].q; if (q.length > 16) q = q.slice(0, 16) + '…';
          h += '<div class="mknote" data-xk="' + esc(list[i].xk) + '" data-c="' + list[i].c + '"><span class="q">' + esc(q) + '</span>📝 ' + esc(list[i].n) + '</div>';
        }
        box.innerHTML = h;
        a.body.parentNode.insertBefore(box, a.body.nextSibling);
      });
    });
  }

  /* ── 面板（宿主 hlsheet-* 樣式）──────────────────────────────── */
  function closePanel() { var m = document.getElementById('xzpMask'); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function ref() { return T('321互動聖經・小智', '321 Interactive Bible · Xiaozhi'); }
  function outText(xk) {
    var r = dbGet()[xk]; if (!r) return '';
    var q = A_lang() === 'en' ? '“' + r.t + '”' : '「' + r.t + '」';
    return q + '\n—— ' + ref() + (r.n ? '\n\n' + r.n : '') + '\n\n' + T('國度321空中團契', 'Kingdom 321 Online Fellowship') + '\n' + location.origin + location.pathname.replace(/index\.html$/, '');
  }
  function copyTxt(t, done) {
    function fb() { try { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.parentNode.removeChild(ta); } catch (e) { } if (done) done(); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { if (done) done(); }, fb); else fb(); } catch (e) { fb(); }
  }
  function askText(xk) {
    var r = dbGet()[xk]; if (!r) return '';
    if (A_lang() === 'en') return 'I highlighted this line from Xiaozhi’s answer: “' + r.t + '”. ' + (r.n ? 'My reflection: “' + r.n + '”. ' : '') + 'Please help me understand what this line means for me more deeply, and help me keep my focus on Jesus.';
    return T('我在讀小智的回答，畫了這一句：「', '') + r.t + T('」。', '') + (r.n ? T('我的領受是：「', '') + r.n + T('」。', '') : '') + T('請幫我更深地明白這句話對我的意思，也帶我把焦點對準耶穌。', '');
  }
  /* 問小智：已在陪讀頁就直接送出；不在就掛上 chatPending 再切過去（viewCompanion 會自己送）。不是從經文來的，來源經文清空 */
  function ask(q) {
    g(function () { chatSrc = null; });
    if (g(function () { return !!document.getElementById('chatIn'); }, false) && g(function () { return !chatBusy; }, true)) { g(function () { sendChat(q); }); return; }
    g(function () { chatPending = q; });
    location.hash = '#/companion';
  }
  function card(text, note, color) {
    g(function () { openStudio({ t: text, n: note || '', b: '', ref: ref(), ch: 0, v: 0, c: color || 'gold', ts: Date.now() }); });
  }
  function hasCard() { return g(function () { return typeof openStudio === 'function'; }, false); }
  function openPanel(xk, el) {
    var db = dbGet(), r = db[xk];
    if (!r) return;
    closePanel();
    el = el || X.sentEl(xk);
    var mask = document.createElement('div');
    mask.id = 'xzpMask'; mask.className = 'hlsheet-mask xzp-mask';
    var hasEl = !!el, cardOk = hasCard();
    mask.innerHTML = '<div class="hlsheet-card" role="dialog">' +
      '<div class="hlsheet-title">' + esc(T('✍️ 寫下你的領受', '✍️ Write what you received')) + '</div>' +
      '<span class="hlsheet-quote">' + esc(r.t) + '</span>' +
      '<div class="hlsheet-colorrow"><span class="hlsheet-colorlabel">' + esc(T('畫線顏色', 'Highlight colour')) + '</span><div class="hlsheet-colors">' +
      COLORS.map(function (c) { return '<button type="button" class="hlswatch' + (c.id === (r.c || 'gold') ? ' active' : '') + '" data-c="' + c.id + '" style="background:' + c.dot + '" aria-label="' + esc(colName(c.id)) + '"></button>'; }).join('') + '</div></div>' +
      '<textarea class="hlsheet-ta" placeholder="' + esc(T('這句話帶給你什麼領受、感動，或聖靈的提醒？寫下來，把焦點對準耶穌……', 'What has this sentence given you — a word, a stirring, a reminder from the Holy Spirit? Write it down, and keep your eyes on Jesus…')) + '">' + esc(r.n || '') + '</textarea>' +
      '<div class="hlsheet-acts">' +
      '<button type="button" class="btn primary" data-a="save">' + esc(T('儲存', 'Save')) + '</button>' +
      '<button type="button" class="btn" data-a="ask">✨ ' + esc(T('問小智', 'Ask Xiaozhi')) + '</button>' +
      (hasEl ? '<button type="button" class="btn" data-a="from">▶ ' + esc(T('從這裡朗讀', 'Read from here')) + '</button>' : '') + '</div>' +
      '<div class="hlsheet-acts2">' +
      (cardOk ? '<button type="button" class="btn gold" data-a="card">🖼 ' + esc(T('做成美圖', 'Make a card')) + '</button>' : '') +
      (hasEl ? '<button type="button" class="btn" data-a="read">🔊 ' + esc(T('朗讀這句', 'Read this')) + '</button>' : '') +
      '<button type="button" class="btn" data-a="copy">⧉ ' + esc(T('複製', 'Copy')) + '</button>' +
      '<button type="button" class="btn" data-a="share">↗ ' + esc(T('分享', 'Share')) + '</button>' +
      '<button type="button" class="btn danger" data-a="del">' + esc(T('取消畫線', 'Remove highlight')) + '</button>' +
      '<button type="button" class="btn" data-a="close">' + esc(T('關閉', 'Close')) + '</button></div></div>';
    document.body.appendChild(mask);
    var ta = mask.querySelector('.hlsheet-ta');
    function keep() {
      var d = dbGet(), x = d[xk]; if (!x) return '';
      x.n = (ta.value || '').replace(/^\s+|\s+$/g, ''); d[xk] = x; dbSet(d); paint(); refreshMe();
      return x.n;
    }
    mask.addEventListener('click', function (ev) {
      var b = ev.target;
      if (b === mask) { keep(); closePanel(); return; }
      b = b.closest ? b.closest('button') : null;
      if (!b) return;
      ev.stopPropagation();
      var c = b.getAttribute('data-c');
      if (c) {
        var d = dbGet(); if (!d[xk]) return;
        d[xk].c = c; dbSet(d); setLastColor(c); paint(); refreshMe();
        arr(mask.querySelectorAll('.hlswatch')).forEach(function (s) { s.classList.toggle('active', s === b); });
        return;
      }
      var a = b.getAttribute('data-a');
      if (a === 'save') { keep(); closePanel(); toast(T('已儲存', 'Saved')); }
      else if (a === 'close') { keep(); closePanel(); }
      else if (a === 'del') { var d2 = dbGet(); delete d2[xk]; dbSet(d2); closePanel(); paint(); refreshMe(); }
      else if (a === 'ask') { keep(); var q = askText(xk); closePanel(); ask(q); }
      else if (a === 'card') { var n = keep(), x2 = dbGet()[xk]; closePanel(); if (x2) card(x2.t, n, x2.c); }
      else if (a === 'read' || a === 'from') { keep(); closePanel(); sayFrom(xk, a === 'read'); }
      else if (a === 'copy') { keep(); copyTxt(outText(xk), function () { toast(T('已複製', 'Copied')); }); }
      else if (a === 'share') {
        keep(); var tx = outText(xk);
        if (navigator.share) navigator.share({ text: tx }).catch(function (e) { if (!e || e.name !== 'AbortError') copyTxt(tx, null); });
        else copyTxt(tx, function () { toast(T('已複製', 'Copied')); });
      }
    });
  }
  function sayFrom(xk, one) {
    var m = X.msgById(X.parse(xk).id);
    NEXT = { i: m ? msgIndex(m) : -1 };
    try { return X.sayFrom(xk, one); } finally { NEXT = null; }
  }

  /* ── 「我的」頁：在「我的畫線」那一組後面加「✨ 小智畫線」──────── */
  function listBody() {
    var db = dbGet(), ks = keys().sort(function (a, b) { return (db[b].at || 0) - (db[a].at || 0); }), h = '', cardOk = hasCard();
    if (!ks.length) return '<div class="empty">' + esc(T('還沒有小智畫線。在小智的回答裡點一下句子就能畫線。', 'No Xiaozhi highlights yet. Tap a sentence in an answer to highlight it.')) + '</div>';
    ks.slice(0, 40).forEach(function (k) {
      var r = db[k], live = !!X.msgById(X.parse(k).id);
      h += '<div class="hitem xzm-li" data-xk="' + esc(k) + '"><div class="q" style="border-left:4px solid ' + dotOf(r.c || 'gold') + ';padding-left:8px">' + esc(r.t) + '</div>' +
        (r.n ? '<div class="n">' + esc(r.n) + '</div>' : '') +
        '<div class="m"><span>' + esc(fmtDate(r.at)) + (live ? '' : ' · ' + esc(T('原回答已不在對話中', 'The original answer is no longer in the chat'))) + '</span><span>' +
        (live ? '<button type="button" data-xzm="jump">↗ ' + esc(T('回到原處', 'Go to answer')) + '</button>' : '') +
        '<button type="button" data-xzm="open">✎</button>' +
        (cardOk ? '<button type="button" data-xzm="card">🖼</button>' : '') +
        '<button type="button" data-xzm="ask">✨</button>' +
        '<button type="button" data-xzm="del">✕</button></span></div></div>';
    });
    if (ks.length > 40) h += '<div class="muted" style="padding:8px 0">' + esc(T('只列出最近 40 筆。', 'Showing the latest 40.')) + '</div>';
    h += '<div style="padding:8px 0"><button type="button" class="btn" data-xzm="copyall">⧉ ' + esc(T('複製全部', 'Copy all')) + '</button></div>';
    return h;
  }
  function allText() {
    var db = dbGet();
    return keys().sort(function (a, b) { return (db[a].at || 0) - (db[b].at || 0); }).map(function (k) {
      var r = db[k]; return (A_lang() === 'en' ? '“' + r.t + '”' : '「' + r.t + '」') + (r.n ? '\n' + r.n : '');
    }).join('\n\n') + '\n\n—— ' + ref();
  }
  function listAct(act, xk) {
    var db = dbGet(), r = db[xk];
    if (act === 'copyall') { copyTxt(allText(), function () { toast(T('已複製', 'Copied')); }); return; }
    if (!r) return;
    if (act === 'open') openPanel(xk, X.sentEl(xk));
    else if (act === 'jump') jumpTo(xk);
    else if (act === 'card') card(r.t, r.n || '', r.c);
    else if (act === 'ask') ask(askText(xk));
    else if (act === 'del') { delete db[xk]; dbSet(db); paint(); refreshMe(); }
  }
  /* 從「我的」頁回到原句：陪讀頁是非同步畫出來的，等句子出現（最多 3 秒）、宿主自己的捲到底（30ms）過後再跳 */
  function jumpTo(xk) {
    if (!X.msgById(X.parse(xk).id)) { X.jump(xk); return; }
    var n = 0;
    if (!/^#\/companion/.test(location.hash || '')) location.hash = '#/companion';
    (function wait() {
      if (X.sentEl(xk) || ++n > 30) { setTimeout(function () { X.jump(xk); }, 160); return; }
      setTimeout(wait, 100);
    })();
  }
  var meTimer = 0;
  function refreshMe() { clearTimeout(meTimer); meTimer = setTimeout(doMe, 40); }
  function doMe() {
    var v = viewEl(); if (!v) return;
    var old = v.querySelector('details.xzm-me');
    if (!/^#\/me(\/|$)/.test(location.hash || '')) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }
    var grps = arr(v.querySelectorAll('details.grp')).filter(function (e) { return !e.classList.contains('xzm-me'); });
    if (grps.length < 3) return;
    var anchor = grps[grps.length - 2];                                 /* 書籤／畫線／收藏：畫線在倒數第二 */
    var n = keys().length, sig = n + '|' + JSON.stringify(dbGet()) + '|' + log().length + '|' + hostLang();
    if (old && old.getAttribute('data-sig') === sig && old.previousElementSibling === anchor) return;
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var d = document.createElement('details'); d.className = 'grp xzm-me'; d.setAttribute('data-sig', sig);
    if (old && old.open) d.open = true;
    d.innerHTML = '<summary><span style="color:var(--gold)">◆</span>✨ ' + esc(T('小智畫線', 'Xiaozhi highlights')) + '<span class="cnt">' + n + '</span></summary>' +
      '<div class="card" style="padding:4px 16px;border:none;border-radius:0;margin-bottom:0">' + listBody() + '</div>';
    anchor.parentNode.insertBefore(d, anchor.nextSibling);
  }

  /* ── 朗讀：句子 → 項目（口語帶入詞對齊）──────────────────────── */
  function chunks(t) {
    t = String(t || '');
    if (t.length <= 280) return t.replace(/\s/g, '') ? [t] : [];
    var out = [], buf = '', i, ch;
    for (i = 0; i < t.length; i++) { ch = t.charAt(i); buf += ch; if (buf.length >= 120 && '。！？；.!?;'.indexOf(ch) >= 0) { out.push(buf); buf = ''; } }
    if (buf.replace(/\s/g, '')) out.push(buf);
    var fin = [];
    out.forEach(function (s) { while (s.length > 300) { fin.push(s.slice(0, 300)); s = s.slice(300); } if (s) fin.push(s); });
    return fin;
  }
  function norm(s) { return String(s || '').replace(/[\s\p{P}\p{S}]/gu, ''); }
  function hasContent(s) { return norm(s).length > 0; }
  /* 句子所在的「行」：li／p（以 <br> 分行）／標題／引言；同一行的句子共用一組口語帶入詞 */
  function lineId(el, body) {
    var c = el.closest('li,p,h1,h2,h3,h4,h5,h6,blockquote,th,td,[data-xzrun]'), idx = -1, i, brs, n = 0, all;
    if (!c || !body.contains(c)) return 'x';
    all = arr(body.querySelectorAll('li,p,h1,h2,h3,h4,h5,h6,blockquote,th,td,[data-xzrun]'));
    idx = all.indexOf(c);
    brs = c.querySelectorAll('br');
    for (i = 0; i < brs.length; i++) if (brs[i].compareDocumentPosition(el) & 4) n++;
    return idx + '#' + n;
  }
  function spokenUnits(node, m, dflt) {
    var base = dflt(node), body = A.bodyOf(node), S, sp = 0, groups = [], cur = null, out = [];
    S = String(g(function () { return mdSpeak(m.text); }, '') || '').split('\n').map(function (x) { return x.replace(/^\s+|\s+$/g, ''); }).filter(Boolean);
    if (!S.length) return base;
    base.forEach(function (u) {
      var el = !u.whole && u.keys.length === 1 ? X.sentEl(u.keys[0]) : null, id = el ? lineId(el, body) : null;
      if (!el) { cur = null; groups.push({ whole: true, us: [u] }); return; }
      if (cur && cur.id === id) cur.us.push(u); else { cur = { id: id, us: [u] }; groups.push(cur); }
    });
    groups.forEach(function (gr) {
      var raws, N, j, hit = null, normS, map, k, a, b, pre, suf, last = gr.us.length - 1;
      if (gr.whole) { out.push(gr.us[0]); return; }
      raws = gr.us.map(function (u) { return X.sentText(X.sentEl(u.keys[0])); });
      N = norm(raws.join(''));
      for (j = sp; N && j < Math.min(S.length, sp + 7) && !hit; j++) {
        map = []; normS = '';
        for (k = 0; k < S[j].length; k++) { var chx = S[j].charAt(k); if (hasContent(chx)) { normS += chx; map.push(k); } }
        a = normS.indexOf(N);
        if (a >= 0) {
          b = map[a + N.length - 1] + 1; a = map[a];
          pre = S[j].slice(0, a); suf = S[j].slice(b);
          if (pre.length <= 40 && suf.length <= 40) { hit = { j: j, pre: pre, suf: suf }; }
        }
      }
      if (!hit) { gr.us.forEach(function (u) { out.push(u); }); return; }
      sp = hit.j + 1;
      gr.us.forEach(function (u, i) {
        var t = (i === 0 ? hit.pre : '') + raws[i];
        if (i === last && hasContent(hit.suf)) t += hit.suf; else t = X.endP(t);
        out.push({ t: t, keys: u.keys, whole: false });
      });
    });
    return out;
  }

  /* ── 宿主 spk 佇列當引擎 ────────────────────────────────────── */
  var engine = {
    ready: function () { },
    state: function () { var s = g(function () { return spk; }, null); return { on: !!(s && s.on && s.xz), i: s ? s.idx : -1 }; },
    stop: function () { g(function () { if (spk && spk.xz && spk.on) ttsStop(); }); },
    chunks: chunks,
    play: function (parts, title) {
      var n = NEXT || {}, items, gen;
      ttsStop(); ttsSayStop(); ttsUnlock();                /* ttsUnlock 必須還在點擊手勢裡（同步） */
      items = parts.map(function (p) { return { text: p.t, els: [], segs: [], lens: [1], at: -1 }; });
      gen = ++ttsGen;
      spk = { on: true, paused: false, items: items, idx: 0, audio: null, cache: {}, native: false, abort: false, gen: gen, xz: 1 };
      if (n.i != null && n.i >= 0) { sayId = n.i; paintSay(); }
      ttsBtn('loading');
      ttsPlayFrom(0, gen);
    }
  };

  /* ── adapter ─────────────────────────────────────────────── */
  /* 小智頁是整頁一起捲，不是 #chatlog 自己捲。宿主 html,body{height:100%;overflow-x:hidden} 使 body 成為捲動容器（宿主自己用 body.scrollTop||pageYOffset），
     所以先看 body 能不能捲，不能才用 window */
  function scEl() {
    var b = document.body, cs = g(function () { return getComputedStyle(b); }, null);
    return (cs && /(auto|scroll)/.test(cs.overflowY) && b.scrollHeight > b.clientHeight + 4) ? b : null;
  }
  var WS = {
    getBoundingClientRect: function () {
      var hd = document.querySelector('header.topbar'), ci = document.querySelector('.chatinput');
      var top = hd ? Math.max(0, hd.getBoundingClientRect().bottom) : 56;
      var bot = ci ? ci.getBoundingClientRect().top : (window.innerHeight || 700) - 62;
      return { top: top, height: Math.max(120, bot - top) };
    },
    get scrollTop() { var e = scEl(); return e ? e.scrollTop : (window.pageYOffset || document.documentElement.scrollTop || 0); },
    set scrollTop(v) { var e = scEl(); if (e) e.scrollTop = v; else window.scrollTo(0, v); },
    scrollTo: function (opt) {
      var e = scEl(), b = opt.behavior || 'auto';
      if (e) { try { e.scrollTo({ top: opt.top, behavior: b }); } catch (x) { e.scrollTop = opt.top; } return; }
      try { window.scrollTo({ top: opt.top, behavior: b }); } catch (x) { window.scrollTo(0, opt.top); }
    }
  };
  function lastAiIdx() { var a = log(), i; for (i = a.length - 1; i >= 0; i--) if (a[i] && a[i].role === 'ai') return i; return -1; }
  var A = {
    lang: A_lang,
    toast: toast,
    msgs: log,
    isDone: function (m) { return !!(m && m.role === 'ai' && m.ok && !m.cont); },
    isUser: function (m) { return !!(m && m.role === 'user'); },
    busy: function () { return g(function () { return !!chatBusy; }, false); },
    open: function () { location.hash = '#/companion'; },
    root: viewEl,
    msgSel: '.msg.ai',
    nodeAt: nodeAt,
    msgAt: function (i) { return log()[i]; },
    bodyOf: function (node) { return node.querySelector('.msg-body'); },
    scroller: function () { return WS; },
    nowCls: 'spk-now',
    follow: function () { return true; },
    hint: true,
    idOf: function (m) { if (!m.xid) { m.xid = X.newId(); if (!m.at) m.at = Date.now(); } return m.xid; },
    answers: function () {
      var a = log(), out = [], la = lastAiIdx();
      arr(document.querySelectorAll('#chatlog .msg.ai')).forEach(function (node) {
        var i = +String(node.id).replace('msg', ''), m = a[i];
        if (m) out.push({ node: node, body: node.querySelector('.msg-body'), m: m, i: i, last: i === la });
      });
      return out;
    },
    /* 回答裡「1. 」「2) 」這種序號：core 會把它單獨切成一句（讀成「一。」），併回下一句 */
    decorate: function (body) {
      arr(body.querySelectorAll('.xzs')).forEach(function (s) {
        if (!/^\d{1,2}\s*[.)．、]$/.test(X.sentText(s))) return;
        var nx = s.nextSibling;
        while (nx && nx.nodeType === 3 && !/\S/.test(nx.nodeValue)) nx = nx.nextSibling;
        if (!nx || nx.nodeType !== 1 || !nx.classList.contains('xzs')) return;
        nx.innerHTML = s.innerHTML + ' ' + nx.innerHTML;
        s.parentNode.removeChild(s);
      });
    },
    units: function (node, m, i, dflt) { return g(function () { return spokenUnits(node, m, dflt); }, null) || dflt(node); },
    engine: engine,
    store: o.store === false ? null : {
      get: function () { try { return JSON.parse(localStorage.getItem('xzm_' + SLUG) || 'null'); } catch (e) { return null; } },
      set: function (l) { try { localStorage.setItem('xzm_' + SLUG, JSON.stringify(l)); } catch (e) { } }
    },
    restore: function (list) {
      var a = log(); if (a.length) return;
      list.forEach(function (x) {
        a.push(x.role === 'user' ? { role: 'user', text: x.text, xid: x.id, at: x.at } : { role: 'ai', text: x.text, ok: true, xid: x.id, at: x.at });
      });
      g(function () { if (document.getElementById('chatlog')) paintChat(); });
    },
    beforeMark: function (el) {
      var n = el.closest && el.closest('.msg.ai');
      if (n && n.classList.contains('fold')) g(function () { msgFold(+String(n.id).replace('msg', '')); });
    },
    marks: {
      any: function () { return keys().length > 0; },
      attach: function () { },
      paint: function () { paint(); refreshMe(); },
      tap: function (xk, el) {
        var d = dbGet();
        if (d[xk]) { openPanel(xk, el); return; }
        d[xk] = { c: lastColor(), n: '', t: X.sentText(el).slice(0, 200), at: Date.now(), lang: hostLang() };
        dbSet(d); paint(); refreshMe();
      },
      keys: keys
    },
    hook: function () {
      /* 小智逐句朗讀自然唸完時，宿主會 ttsMaybeAutoNext()（自動跳下一章）——只擋 XZM 開的這一輪 */
      var MA = window.ttsMaybeAutoNext;
      if (typeof MA === 'function' && !MA.__xzm) {
        window.ttsMaybeAutoNext = function () { if (g(function () { return !!(spk && spk.xz); }, false)) return; return MA.apply(this, arguments); };
        window.ttsMaybeAutoNext.__xzm = 1;
      }
      /* 🔊：capture 階段先接；有切好的句子才逐句跟讀，否則放行給宿主。領受條也在這裡接 */
      document.addEventListener('click', function (ev) {
        var t = ev.target, b = t && t.closest ? t.closest('.msg-act[data-a="tts"]') : null, n, li, bm;
        if (b && b.closest('#chatlog')) {
          var i = +b.getAttribute('data-i'), m = log()[i];
          if (m && A.isDone(m) && nodeAt(i) && nodeAt(i).querySelector('.xzs')) {
            NEXT = { i: i };
            try { if (X.speakMsg(i)) { ev.stopPropagation(); ev.preventDefault(); } } finally { NEXT = null; }
          }
          return;
        }
        n = t && t.closest ? t.closest('#chatlog .xzm-notes .mknote') : null;
        if (n && n.getAttribute('data-xk')) { ev.stopPropagation(); ev.preventDefault(); openPanel(n.getAttribute('data-xk'), X.sentEl(n.getAttribute('data-xk'))); return; }
        bm = t && t.closest ? t.closest('[data-xzm]') : null;
        if (bm && (li = bm.closest('details.xzm-me'))) {
          ev.preventDefault(); ev.stopPropagation();
          var row = bm.closest('.xzm-li');
          listAct(bm.getAttribute('data-xzm'), row ? row.getAttribute('data-xk') : '');
        }
      }, true);
      /* 「我的」頁每次重畫後補清單：看 #view 的直接子節點變化＋低頻補檢查（#view 偶爾被宿主換掉） */
      var mo = null, watched = null;
      setInterval(function () {
        var v = viewEl();
        if (v && v !== watched) {
          watched = v; if (mo) mo.disconnect();
          if (window.MutationObserver) { mo = new MutationObserver(function () { refreshMe(); }); mo.observe(v, { childList: true }); }
          refreshMe();
        }
      }, 700);
      window.addEventListener('hashchange', function () { refreshMe(); });
      refreshMe();
    },
    css: (function () {
      var c = '', i;
      COLORS.forEach(function (k) {
        c += '.msg.ai .xzs[data-xzm-c="' + k.id + '"]{background:linear-gradient(transparent 56%,rgba(' + k.rgb + ',.46) 56%);border-radius:2px}';
        c += '.xzm-notes .mknote[data-c="' + k.id + '"]{border-left-color:' + k.dot + '}';
      });
      c += '.msg.ai .xzs.spk-now{background-color:transparent;box-shadow:inset 0 0 0 999px var(--reading,rgba(108,147,209,.28))}' +
        '.msg.ai .xzs[data-xzm-c].spk-now{box-shadow:inset 0 0 0 999px var(--reading,rgba(108,147,209,.28))}' +
        '.msg.ai table.spk-now,.msg.ai .spk-now>table{background:var(--reading,rgba(108,147,209,.2))}' +
        '.msg.ai .xzs{-webkit-box-decoration-break:clone;box-decoration-break:clone}' +
        '.xzm-notes{margin:8px 0 2px}' +
        '.xzm-notes .mknote{margin:6px 0 0;padding:7px 11px;background:var(--surface);border-left:3px solid var(--gold);border-radius:6px;font-size:.88em;color:var(--ink);white-space:pre-wrap;cursor:pointer;line-height:1.55}' +
        '.xzm-notes .mknote .q{display:block;font-size:.82em;color:var(--ink-soft);margin-bottom:2px}' +
        '.msg.ai .xzhint{font-size:.8em;line-height:1.6;color:var(--gold);background:var(--gold-soft);border-radius:10px;padding:7px 11px;margin-top:8px}' +
        '.xzp-mask{z-index:450}' +
        '.xzm-li .m span:last-child{display:flex;flex-wrap:wrap;gap:2px;justify-content:flex-end}' +
        '.xzm-li .m button{min-height:30px}';
      return c;
    })()
  };
  XZM.bb = { openPanel: openPanel, db: dbGet, keys: keys, refreshMe: refreshMe };
  return A;
};
