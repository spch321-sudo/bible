/* =====================================================================
   我的小家（xj1109，2026-11-09）— 移植自《321教會生活》「我的教會」
   建立／加入小家、小家消息（家長發佈）、小家聊天室、今天完成晨讀／晚禱的家人名字＋獎勵動畫、
   關懷名單（家人自己同意後才分享進度）。ES5。
   後端沿用已上線的兩個 Cloudflare Worker，不必另外開通：
     church-news.spch321.workers.dev  ── 小家本身（名稱、代碼、家長密碼、消息）
     church-chat.spch321.workers.dev  ── 聊天、今天完成名單、關懷名單
   存檔只用 fl321_xj* 開頭的 localStorage key（同網域其他 App 不會撞到）。
   ===================================================================== */
(function () {
  'use strict';
  var H = window.X321 && window.X321.xj;
  if (!H || window.XJ321) return;
  var NEWS = 'https://church-news.spch321.workers.dev';
  var CHAT = 'https://church-chat.spch321.workers.dev';
  var PAGES = H.PAGES, esc = H.esc;
  /* 宿主可以換掉「晨讀／晚禱」這個詞（教會生活用「靈修」） */
  var f9 = function (zh, en) {
    if (H.wordZh) zh = String(zh).split('晨讀／晚禱').join(H.wordZh);
    if (H.wordEn && en) en = String(en).replace(/[Mm]orning reading (\/|or) evening prayer/g, function (m) { return m.charAt(0) === 'M' ? H.wordEn.charAt(0).toUpperCase() + H.wordEn.slice(1) : H.wordEn; });
    return H.f9(zh, en);
  };
  /* 共用給其他 App（教會生活）：存檔前綴、App 名稱、入口說明都可以由宿主覆寫 */
  var P = H.prefix || 'fl321_';
  var APPZ = H.appZh || '國度321空中團契', APPE = H.appEn || 'Kingdom 321 Fellowship';
  var WHEREZ = H.whereZh || '底部「小家」→「加入或建立其他小家」', WHEREE = H.whereEn || 'the Group tab';

  /* ── 存檔 ── */
  function lg(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function ls(k, v) { try { if (v == null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (e) { } }
  function lj(k, d) { try { var v = JSON.parse(lg(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  /* 可以同時參加好幾個小家（mg1109）：GL＝參加的小家清單，DM＝各小家的資料快取，CUR＝目前看的小家 */
  var GL = lj(P + 'xjs', null);            /* [{code,name,pin,seen,chatSeen,share,shAt,hideName}] */
  var DM = lj(P + 'xjdm', {}) || {};       /* {code: church-news 回傳的小家資料} */
  var CUR = lg(P + 'xjcur') || '';
  if (!GL) {                                  /* 舊版只存一個小家：搬進清單 */
    GL = []; var old0 = lj(P + 'xj', null);
    if (old0 && old0.code) { GL.push(old0); var od0 = lj(P + 'xjdata', null); if (od0) DM[old0.code] = od0; CUR = old0.code; }
  }
  var X = null, DATA = null;
  function pick() {
    X = null; for (var i = 0; i < GL.length; i++) if (GL[i].code === CUR) X = GL[i];
    if (!X && GL.length) X = GL[0];
    CUR = X ? X.code : ''; DATA = X ? (DM[X.code] || null) : null;
  }
  pick();
  var DAYS = lj(P + 'xjdays', {});         /* 完成晨讀／晚禱的日子 {YYYY-MM-DD: ts}，只存這支手機 */
  function save() { if (X && DATA) DM[X.code] = DATA; ls(P + 'xjs', JSON.stringify(GL)); ls(P + 'xjdm', JSON.stringify(DM)); ls(P + 'xjcur', CUR); }
  function findGroup(c) { for (var i = 0; i < GL.length; i++) if (GL[i].code === c) return GL[i]; return null; }
  function saveDays() { ls(P + 'xjdays', JSON.stringify(DAYS)); }
  function dev() { if (H.altDev && typeof CC !== 'undefined' && CC && CC.alt) { try { var ad = H.altDev(CC.alt.code); if (ad) return ad; } catch (e) { } } var d = lg(P + 'xjdev'); if (!d) { d = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); ls(P + 'xjdev', d); } return d; }
  function nick() { var n = ''; if (H.getNick) { try { n = trim(H.getNick() || ''); } catch (e) { } } if (!n) n = trim(lg(P + 'xjnick') || ''); if (!n && H.myName) { try { n = trim(H.myName() || ''); } catch (e) { } } return n.slice(0, 20); }
  function setNick(n) { ls(P + 'xjnick', trim(n).slice(0, 20)); if (H.setNick) { try { H.setNick(trim(n).slice(0, 20)); } catch (e) { } } }
  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function now() { return Date.now(); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function $(id) { return document.getElementById(id); }
  function route() { return H.route(); }
  function rr(r) { if (route() === r) H.render(r); }
  function note(m) { try { H.note(m); } catch (e) { } }
  function isEN() { return H.lang() === 'en'; }

  /* 邀請連結 ?xj=CODE：頁首小腳本已先存到 fl321_xjpend */
  (function () {
    var m = location.search.match(/[?&]xj=([A-Za-z0-9]{4,10})/);
    if (m) { ls(P + 'xjpend', m[1].toUpperCase()); try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { } }
  })();
  function pend() {
    var p = lg(P + 'xjpend') || '';
    if (p && findGroup(p)) { ls(P + 'xjpend', null); if (!X || X.code !== p) { CUR = p; pick(); save(); resetLive(); } return ''; }
    return p;
  }

  /* ── 連線 ── */
  function api(base, m, path, body, cb, tmo) {
    var x; try { x = new XMLHttpRequest(); x.open(m, base + path, true); } catch (e) { cb(null, 'net'); return; }
    x.timeout = tmo || 15000;
    if (body) x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function () {
      if (x.readyState !== 4) return;
      var j = null; try { j = JSON.parse(x.responseText); } catch (e) { }
      if (j && j.ok) cb(j, ''); else cb(null, (j && j.err) ? j.err : (x.status ? 'http' + x.status : 'net'));
    };
    x.ontimeout = function () { };
    try { x.send(body ? JSON.stringify(body) : null); } catch (e) { cb(null, 'net'); }
  }
  function errTxt(e) {
    var M = {
      badpin: f9('家長密碼不對', 'Wrong leader password'), locked: f9('密碼錯太多次，請 15 分鐘後再試', 'Too many wrong tries — try again in 15 minutes'),
      nochurch: f9('找不到這個小家，請確認代碼', 'Small group not found — please check the code'), notfound: f9('找不到這個小家，請確認代碼', 'Small group not found — please check the code'),
      createkey: f9('建立小家需要「建立碼」，請向團契同工索取', 'Creating a group needs a creation code — ask a fellowship co-worker'),
      badkey: f9('建立碼不對', 'Wrong creation code'), slow: f9('說太快了，等一下再送', 'Too fast — wait a moment'),
      full: f9('今天的訊息太多了，明天再聊', 'Too many messages today — try tomorrow'), forbid: f9('只能刪除自己的訊息', 'You can only delete your own messages'),
      empty: f9('請輸入內容', 'Please write something'), toobig: f9('檔案太大，上限 5MB', 'File too large — 5 MB maximum'),
      attfull: f9('今天小家傳的相片和檔案太多了，明天再傳', 'Too many photos and files today — try tomorrow'), mime: f9('這種相片格式不支援', 'This image format isn’t supported'),
      http413: f9('檔案太大，上限 5MB', 'File too large — 5 MB maximum'), dev: f9('裝置資料不完整，請重新打開 App', 'Please reopen the app')
    };
    return M[e] || (f9('連不上小家服務，請稍後再試', 'Can’t reach the small-group service — try again later') + (e ? '（' + e + '）' : ''));
  }

  /* ── 小家資料（church-news）── */
  var NW = { at: 0, busy: 0, f: '' };
  function fetchHome(force, cb) {
    if (!X) { if (cb) cb(null); return; }
    if (!force && DATA && now() - NW.at < 60000) { if (cb) cb(DATA); return; }
    if (NW.busy) { if (cb) cb(DATA); return; }
    NW.busy = 1;
    api(NEWS, 'GET', '/c/' + X.code + '?day=' + today(), null, function (j, e) {
      NW.busy = 0;
      if (j) { NW.at = now(); DATA = j; X.name = j.name || X.name; if (!X.seen) X.seen = maxTs(j); save(); }
      else if (e === 'nochurch') note(f9('這個小家已經不存在了', 'This small group no longer exists'));
      if (cb) cb(j, e);
    });
  }
  function maxTs(j) { var m = 1, L = (j && j.news) || []; for (var i = 0; i < L.length; i++) if (L[i].ts > m) m = L[i].ts; return m; }
  function unreadNews() { var n = 0, L = (DATA && DATA.news) || []; if (!X) return 0; for (var i = 0; i < L.length; i++) if (L[i].ts > (X.seen || 0)) n++; return n; }
  function adm(path, body, ok) {
    if (NW.busy) return; NW.busy = 1; body.pin = X.pin; body.day = today();
    api(NEWS, 'POST', '/c/' + X.code + path, body, function (j, e) {
      NW.busy = 0;
      if (!j) { if (e === 'badpin') { X.pin = ''; save(); rr('xj'); } note(errTxt(e)); return; }
      DATA = j; X.name = j.name || X.name; NW.at = now(); save(); if (ok) ok(j);
    });
  }
  function kindTxt(k) { return ({ news: f9('公告', 'Notice'), meet: f9('聚會', 'Meeting'), event: f9('活動', 'Event'), pray: f9('代禱', 'Prayer') })[k || 'news'] || f9('公告', 'Notice'); }
  function nTi(n) { return isEN() && n.title_en ? n.title_en : n.title; }
  function nBo(n) { return isEN() && n.body_en ? n.body_en : n.body; }
  function linkify(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>'); }
  function findNews(id) { var L = (DATA && DATA.news) || []; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }

  /* ── 聊天室（church-chat）── */
  /* CC.alt＝{code,name}：借用這個聊天室介面給別的群組（例如互動聖經的 235 團隊，代碼 TM＋六碼） */
  function ccCode() { return CC.alt ? CC.alt.code : (X ? X.code : ''); }
  function ccName() { return CC.alt ? CC.alt.name : (X ? X.name : ''); }
  /* CC.dm＝{who,nick}：一對一私訊（同一個群組代碼裡，伺服器只讓這兩支手機讀得到） */
  function dmq() { return CC.dm ? '&with=' + CC.dm.who : ''; }
  var DMS = { list: [], at: 0, unread: 0, busy: 0 };
  function dmSeenMap() { try { return JSON.parse(lg(P + 'xjdmseen') || '{}') || {}; } catch (e) { return {}; } }
  function dmKey(who) { return ccCode() + ':' + who; }
  var CC = { alt: null, dm: null, msgs: [], last: 0, busy: 0, re: 0, err: '', unread: 0, uAt: 0, arm: 0, sel: 0, draft: '', sending: 0 };
  var COLS = ['#1F3C88', '#5E8A35', '#A8572E', '#6C4BA3', '#2E7D8C', '#B8473E', '#8A6510', '#3A74B0'];
  function col(w) { var n = parseInt(String(w || '0').slice(0, 6), 16) || 0; return COLS[n % COLS.length]; }
  function chatSeen() { return (X && X.chatSeen) || 0; }
  function merge(list) {
    var have = {}, i;
    for (i = 0; i < CC.msgs.length; i++) have[CC.msgs[i].id] = i;
    for (i = 0; i < (list || []).length; i++) { var m = list[i]; if (have[m.id] != null) CC.msgs[have[m.id]] = m; else CC.msgs.push(m); if (m.id > CC.last) CC.last = m.id; }
    CC.msgs.sort(function (a, b) { return a.id - b.id; });
    if (CC.msgs.length > 400) CC.msgs = CC.msgs.slice(-400);
  }
  function peek() {
    if (!X || now() - CC.uAt < 60000) return;
    CC.uAt = now();
    api(CHAT, 'GET', '/c/' + X.code + '/msgs?after=' + chatSeen() + '&dev=' + encodeURIComponent(dev()), null, function (j) {
      if (!j) return; var n = 0;
      for (var i = 0; i < j.msgs.length; i++) { var m = j.msgs[i]; if (!m.mine && !m.del && m.id > chatSeen()) n++; }
      CC.unread = n; var el = $('xjChatCard'); if (el) el.outerHTML = chatCard();
      var hb = $('xjHomeUnread'); if (hb) hb.innerHTML = n ? '<span class="xjdot">' + esc(f9(n + ' 則新訊息', n + ' new')) + '</span>' : '';
    });
    dmLoad();
  }
  /* 私訊清單與未讀數 */
  function dmLoad(cb) {
    var c = ccCode(); if (!c || DMS.busy) { if (cb) cb(); return; }
    DMS.busy = 1;
    api(CHAT, 'GET', '/c/' + c + '/dms?dev=' + encodeURIComponent(dev()), null, function (j) {
      DMS.busy = 0;
      if (j) {
        var sm = dmSeenMap(), u = 0;
        DMS.list = j.list || []; DMS.at = now(); DMS.code = c;
        for (var i = 0; i < DMS.list.length; i++) { var d = DMS.list[i]; d.unread = !d.mine && d.last > (sm[c + ':' + d['with']] || 0); if (d.unread) u++; }
        DMS.unread = u;
        var b = $('xjDmBtn'); if (b) b.innerHTML = '✉️' + (u ? '<span class="xjdot" style="margin-left:4px">' + u + '</span>' : '');
        var el = $('xjChatCard'); if (el) el.outerHTML = chatCard();
      }
      if (cb) cb(j);
    });
  }
  function dmInbox() {
    dmLoad(function (j) {
      var L = DMS.list, h = '<h3>✉️ ' + esc(f9('私訊', 'Private messages')) + '</h3>';
      if (!j) h += '<p class="note">' + esc(errTxt('net')) + '</p>';
      else if (!L.length) h += '<p class="note">' + esc(f9('還沒有私訊。在聊天室點一下別人的訊息，按「✉️ 私訊」就可以一對一聊天，只有你們兩個人看得到。', 'No private messages yet. Tap someone’s message in the chat and choose “✉️ Message” — only the two of you can read it.')) + '</p>';
      for (var i = 0; i < L.length; i++) {
        var d = L[i];
        h += '<div class="xjdmrow" data-xj="dmopen" data-who="' + esc(d['with']) + '" data-nick="' + esc(d.nick || '') + '"><div class="xjav" style="background:' + col(d['with']) + '">' + esc(String(d.nick || '?').slice(0, 1)) + '</div><div class="xjgrow" style="min-width:0"><b>' + esc(d.nick || f9('家人', 'Member')) + '</b>' + (d.unread ? ' <span class="xjdot">' + esc(f9('新', 'New')) + '</span>' : '') + '<div class="note" style="margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc((d.mine ? f9('我：', 'Me: ') : '') + (d.text || '')) + '</div></div><span class="note" style="margin:0">' + esc(d.ts ? fmtDay(d.ts) : '') + '</span></div>';
      }
      h += '<div class="xjbtns"><button class="btn ghost" data-xj="mclose">' + esc(f9('關閉', 'Close')) + '</button></div>';
      modal(h);
    });
  }
  function dmOpen(who, nickName) {
    closeModal();
    CC.dm = { who: who, nick: nickName || f9('家人', 'Member') }; CC.msgs = []; CC.last = 0; CC.loaded = 0; CC.re = 0; CC.sel = 0; CC.draft = '';
    if (route() === 'xjchat') H.render('xjchat'); else H.go('xjchat');
  }
  function pull(full) {
    if ((!X && !CC.alt) || CC.busy) return;
    CC.busy = 1;
    api(CHAT, 'GET', '/c/' + ccCode() + '/msgs?after=' + (full ? 0 : CC.last) + '&dev=' + encodeURIComponent(dev()) + dmq(), null, function (j, e) {
      CC.busy = 0;
      if (!j) { CC.err = e; if (!CC.msgs.length || full) paintChat(); if (full) note(errTxt(e)); return; }
      CC.err = '';
      if (full) { CC.msgs = []; CC.last = 0; }
      var before = CC.last; merge(j.msgs);
      if (full || CC.last !== before) paintChat(full);
    });
  }
  function fmtTime(ts) { var d = new Date(ts); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function fmtDay(ts) {
    var d = new Date(ts), t = new Date(), y = new Date(t.getTime() - 864e5);
    var same = function (a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
    if (same(d, t)) return f9('今天', 'Today'); if (same(d, y)) return f9('昨天', 'Yesterday');
    return isEN() ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : (d.getMonth() + 1) + '/' + d.getDate();
  }
  function findMsg(id) { for (var i = 0; i < CC.msgs.length; i++) if (CC.msgs[i].id === id) return CC.msgs[i]; return null; }
  function listHtml() {
    if (!CC.msgs.length) return '<div class="xjempty">' + esc(CC.err ? errTxt(CC.err) : (CC.busy || !CC.loaded ? f9('載入中…', 'Loading…') : f9('還沒有人說話，來打聲招呼吧！', 'No messages yet — say hello!'))) + '</div>';
    var h = '', lastDay = '';
    for (var i = 0; i < CC.msgs.length; i++) {
      var m = CC.msgs[i];
      var day = fmtDay(m.ts); if (day !== lastDay) { h += '<div class="xjday"><span>' + esc(day) + '</span></div>'; lastDay = day; }
      var q = m.re ? findMsg(m.re) : null, sel = CC.sel === m.id, isAdm = !CC.alt && !CC.dm && !!(X && X.pin);
      h += '<div class="xjm' + (m.mine ? ' mine' : '') + '">' +
        (m.mine ? '' : '<div class="xjav" style="background:' + col(m.who) + '">' + esc(String(m.nick || '?').slice(0, 1)) + '</div>') +
        '<div class="xjb">' + (m.mine ? '' : '<div class="xjn">' + esc(m.nick || '') + (m.lead ? ' · ' + esc(f9('家長', 'Leader')) : '') + '</div>') +
        (m.del ? '<div class="xjt gone">' + esc(f9('這則訊息已刪除', 'Message deleted')) + '</div>' :
          (m.kind ? attHtml(m, q) : '<div class="xjt" data-xj="tap" data-id="' + m.id + '">' + (q ? '<div class="xjq">↩ ' + esc((q.nick || '') + '：' + (q.del ? '…' : q.text)) + '</div>' : '') + linkify(m.text) + '</div>')) +
        (sel && !m.del ? '<div class="xjacts"><button data-xj="reply" data-id="' + m.id + '">' + esc(f9('回覆', 'Reply')) + '</button><button data-xj="copy" data-id="' + m.id + '">' + esc(f9('複製', 'Copy')) + '</button>' +
          (!m.mine && !CC.dm && m.who ? '<button data-xj="dmopen" data-who="' + esc(m.who) + '" data-nick="' + esc(m.nick || '') + '">✉️ ' + esc(f9('私訊', 'Message')) + '</button>' : '') +
          (m.mine || isAdm ? '<button data-xj="mdel" data-id="' + m.id + '">' + esc(CC.arm === m.id ? f9('再按一次刪除', 'Tap again to delete') : f9('刪除', 'Delete')) + '</button>' : '') + '</div>' : '') +
        '</div><div class="xjtime">' + (m.kind && !m.del ? '<button class="xjmore" data-xj="tap" data-id="' + m.id + '" aria-label="more">⋯</button>' : '') + fmtTime(m.ts) + '</div></div>';
    }
    return h;
  }
  /* ── 相片、檔案、貼圖 ── */
  var STKS = [
    ['amen', '🙏', '阿們', 'Amen', '#F6E7B4', '#7A5800'], ['halle', '🙌', '哈利路亞', 'Hallelujah', '#FFE1C6', '#A4481A'],
    ['thanks', '💐', '感謝主', 'Thank the Lord', '#FBE4E9', '#A33A55'], ['pray', '🕊️', '為你禱告', 'Praying for you', '#E1EBF7', '#2F5C93'],
    ['love', '❤️', '愛你', 'Love you', '#FBE0E0', '#B33535'], ['peace', '🌿', '平安', 'Peace', '#E3F0E1', '#356B32'],
    ['cheer', '💪', '加油', 'Keep going', '#FFF0C8', '#8A5A10'], ['praise', '🎶', '讚美主', 'Praise the Lord', '#ECE3F5', '#6C3F8A'],
    ['good', '👍', '好棒', 'Well done', '#DDF3F0', '#1C6E63'], ['hug', '🤗', '抱抱', 'Hugs', '#FDE8D8', '#9A4E28'],
    ['morning', '🌅', '早安', 'Good morning', '#FFF3D6', '#94621A'], ['night', '🌙', '晚安', 'Good night', '#E2E5F5', '#3A4A8C'],
    ['welcome', '🎉', '歡迎', 'Welcome', '#FCE7F0', '#A3346E'], ['bible', '📖', '讀經去', 'Time for the Word', '#E7EDF6', '#12233F'],
    ['withyou', '✝️', '主與你同在', 'The Lord is with you', '#F3ECDC', '#6E5019'], ['sorry', '🥺', '對不起', 'Sorry', '#EDEDED', '#4A4A4A']
  ];
  function stkFind(k) { for (var i = 0; i < STKS.length; i++) if (STKS[i][0] === k) return STKS[i]; return null; }
  function stkHtml(k) { var s = stkFind(k); if (!s) return '<div class="xjt">[' + esc(f9('貼圖', 'Sticker')) + ']</div>'; return '<div class="xjstk" style="background:' + s[4] + ';color:' + s[5] + '"><span class="e">' + s[1] + '</span><b>' + esc(f9(s[2], s[3])) + '</b></div>'; }
  function attUrl(id) { return CHAT + '/c/' + ccCode() + '/att/' + id + (CC.dm ? '?dev=' + encodeURIComponent(dev()) : ''); }
  function fmtSize(n) { n = +n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function attHtml(m, q) {
    var mt = m.meta || {}, qh = q ? '<div class="xjq">↩ ' + esc((q.nick || '') + '：' + (q.del ? '…' : q.text)) + '</div>' : '';
    if (m.kind === 'stk') return (qh ? '<div class="xjt">' + qh + '</div>' : '') + stkHtml(mt.stk);
    if (m.kind === 'img' && m.att) {
      var ar = mt.w && mt.h ? ' style="aspect-ratio:' + mt.w + '/' + mt.h + '"' : '';
      return (qh ? '<div class="xjt">' + qh + '</div>' : '') + '<img class="xjimg" src="' + esc(attUrl(m.att)) + '" alt="' + esc(f9('相片', 'Photo')) + '" loading="lazy" data-xj="img" data-id="' + m.att + '"' + ar + '>';
    }
    if (m.kind === 'voice' && m.att) return '<div class="xjt xjvoice">' + qh + '<audio controls preload="none" src="' + esc(attUrl(m.att)) + '"></audio>' + (mt.dur ? '<small>🎤 ' + fmtDur(mt.dur) + '</small>' : '') + '</div>';
    if (m.att) return '<a class="xjt xjfile" href="' + esc(attUrl(m.att)) + '" target="_blank" rel="noopener" download="' + esc(mt.name || 'file') + '">' + qh + '<span class="fi">📄</span><span class="fn"><b>' + esc(mt.name || f9('檔案', 'File')) + '</b><small>' + esc(fmtSize(mt.size)) + ' · ' + esc(f9('點一下下載', 'Tap to download')) + '</small></span></a>';
    return '<div class="xjt">' + linkify(m.text) + '</div>';
  }
  function viewImg(id) {
    var old = $('xjView'); if (old) old.parentNode.removeChild(old);
    var u = attUrl(id), el = document.createElement('div'); el.id = 'xjView'; el.className = 'xjview';
    el.innerHTML = '<img src="' + esc(u) + '" alt=""><div class="bar"><a class="xjsm" href="' + esc(u) + '" target="_blank" rel="noopener" download>' + esc(f9('下載／另存', 'Download')) + '</a><button class="xjsm" data-xj="vclose">' + esc(f9('關閉', 'Close')) + '</button></div>';
    document.body.appendChild(el);
    el.onclick = function (e) { if (e.target === el || e.target.tagName === 'IMG') el.parentNode.removeChild(el); };
  }
  function fmtDur(n) { n = Math.round(+n || 0); return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); }
  /* 語音錄音：點🎤開始，最長 3 分鐘；可取消或送出 */
  var RC = { rec: null, stream: null, chunks: [], t0: 0, timer: 0, cancel: 0 };
  function recMime() {
    var L = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    try { for (var i = 0; i < L.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(L[i])) return L[i]; } catch (e) { }
    return '';
  }
  function recBar(on) {
    var b = $('xjRec'); if (!b) return;
    b.style.display = on ? 'flex' : 'none'; fitChat();
  }
  function recTick() {
    var s = Math.floor((now() - RC.t0) / 1000), el = $('xjRecT'); if (el) el.textContent = fmtDur(s);
    if (s >= 180) recStop(0);
  }
  function recStart() {
    if (RC.rec) return;
    if (needNick()) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { note(f9('這支手機的瀏覽器不支援錄音', 'Recording isn’t supported in this browser')); return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (st) {
      var mt = recMime(), r;
      try { r = mt ? new MediaRecorder(st, { mimeType: mt, audioBitsPerSecond: 48000 }) : new MediaRecorder(st); } catch (e) { r = new MediaRecorder(st); }
      RC.rec = r; RC.stream = st; RC.chunks = []; RC.cancel = 0; RC.t0 = now();
      r.ondataavailable = function (e) { if (e.data && e.data.size) RC.chunks.push(e.data); };
      r.onstop = function () {
        var dur = Math.round((now() - RC.t0) / 1000), type = (r.mimeType || mt || 'audio/webm').split(';')[0];
        try { st.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
        clearInterval(RC.timer); RC.rec = null; RC.stream = null; recBar(0);
        if (RC.cancel || !RC.chunks.length) return;
        if (dur < 1) { note(f9('錄音太短了', 'Too short')); return; }
        var blob = new Blob(RC.chunks, { type: type });
        if (blob.size > 5 * 1048576) { note(errTxt('toobig')); return; }
        upShow(f9('語音上傳中…', 'Uploading voice…'));
        readDataUrl(blob, function (d) {
          if (!d) { $('xjUp').style.display = 'none'; return; }
          post({ kind: 'voice', data: d, mime: type, name: 'voice.' + (/mp4|aac|m4a/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm'), dur: dur, text: '' });
        });
      };
      r.start(1000);
      RC.timer = setInterval(recTick, 250); recTick(); recBar(1);
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { }
    })['catch'](function () { note(f9('沒有取得麥克風權限，請在瀏覽器設定允許使用麥克風', 'Microphone permission was not granted — allow it in your browser settings')); });
  }
  function recStop(cancel) { if (!RC.rec) return; RC.cancel = cancel ? 1 : 0; try { RC.rec.stop(); } catch (e) { recBar(0); } }
  function readDataUrl(file, cb) { var r = new FileReader(); r.onload = function () { cb(String(r.result || '')); }; r.onerror = function () { cb(''); }; r.readAsDataURL(file); }
  function prepImage(file, cb) {
    var MAX = 1600;
    if (/gif$/i.test(file.type) && file.size <= 4.5 * 1048576) { readDataUrl(file, function (d) { cb(d ? { data: d, mime: 'image/gif', name: file.name || 'photo.gif', w: 0, h: 0 } : null); }); return; }
    var url; try { url = URL.createObjectURL(file); } catch (e) { cb(null); return; }
    var im = new Image();
    im.onload = function () {
      var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, MAX / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch); g.drawImage(im, 0, 0, cw, ch);
      var q = 0.82, d = cv.toDataURL('image/jpeg', q);
      while (d.length * 0.75 > 4.5 * 1048576 && q > 0.4) { q -= 0.15; d = cv.toDataURL('image/jpeg', q); }
      try { URL.revokeObjectURL(url); } catch (e) { }
      cb({ data: d, mime: 'image/jpeg', name: (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', w: cw, h: ch });
    };
    im.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) { } cb(null); };
    im.src = url;
  }
  function needNick() {
    var nk = $('xjNick');
    if (nk) { var n = trim(nk.value); if (!n) { note(f9('請先填你的稱呼', 'Please enter your name first')); nk.focus(); return true; } setNick(n); }
    return false;
  }
  function post(body, done) {
    if (CC.sending) return; CC.sending = 1;
    var btn = $('xjSend'); if (btn) btn.disabled = true;
    body.dev = dev(); body.nick = nick(); body.re = CC.re || 0; body.after = CC.last; if (CC.dm) body['with'] = CC.dm.who;
    api(CHAT, 'POST', '/c/' + ccCode() + '/send', body, function (j, e) {
      CC.sending = 0; var b = $('xjSend'); if (b) b.disabled = false;
      var up = $('xjUp'); if (up) up.style.display = 'none';
      if (!j && (e === 'slow' || e === 'http429') && !body._r) { body._r = 1; upShow(f9('稍等一下，馬上送出…', 'Sending in a moment…')); setTimeout(function () { post(body, done); }, 1700); return; }
      if (!j) { note(errTxt(e)); return; }
      var hadRe = CC.re; CC.re = 0;
      merge(j.msgs);
      if (done) done();
      if (hadRe || $('xjNick')) { H.render('xjchat'); return; }
      paintChat(true);
    }, body.data ? 120000 : 15000);
  }
  function upShow(t) { var up = $('xjUp'); if (up) { up.textContent = t; up.style.display = 'block'; fitChat(); } }
  function pickPhoto(inp) {
    var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    if (needNick()) return;
    upShow(f9('相片處理中…', 'Preparing photo…'));
    prepImage(f, function (r) {
      if (!r) { upShow(''); $('xjUp').style.display = 'none'; note(f9('這張相片讀不出來，請換一張', 'Couldn’t read this photo — try another')); return; }
      upShow(f9('相片上傳中…', 'Uploading photo…'));
      post({ kind: 'img', data: r.data, mime: r.mime, name: r.name, w: r.w, h: r.h, text: '' });
    });
  }
  function pickFile(inp) {
    var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    if (needNick()) return;
    if ((/^image\//i.test(f.type) && !/svg/i.test(f.type) && (f.size > 1.5 * 1048576 || !/^image\/(jpeg|png|webp|gif)$/i.test(f.type))) || /\.(heic|heif)$/i.test(f.name || '')) { pickPhoto({ files: [f], value: '' }); return; }
    if (f.size > 5 * 1048576) { note(errTxt('toobig')); return; }
    upShow(f9('檔案上傳中…', 'Uploading file…') + ' ' + fmtSize(f.size));
    readDataUrl(f, function (d) {
      if (!d) { $('xjUp').style.display = 'none'; note(f9('檔案讀不出來', 'Couldn’t read this file')); return; }
      var img = /^image\/(jpeg|png|webp|gif)$/i.test(f.type);
      post({ kind: img ? 'img' : 'file', data: d, mime: f.type || 'application/octet-stream', name: f.name || 'file', text: '' });
    });
  }
  function sendStk(k) {
    if (needNick()) return;
    var s = stkFind(k); if (!s) return;
    CC.stk = 0; var pn = $('xjStk'); if (pn) pn.style.display = 'none';
    post({ kind: 'stk', stk: k, text: '[貼圖] ' + s[2] });
  }
  function stkPanel() {
    var h = '<div class="xjstkp" id="xjStk" style="display:' + (CC.stk ? 'grid' : 'none') + '">';
    for (var i = 0; i < STKS.length; i++) h += '<button data-xj="stk" data-k="' + STKS[i][0] + '" aria-label="' + esc(f9(STKS[i][2], STKS[i][3])) + '">' + stkHtml(STKS[i][0]) + '</button>';
    return h + '</div>';
  }
  function paintChat(stick) {
    var box = $('xjList'); if (!box) return;
    var nearEnd = stick || (window.innerHeight + (window.pageYOffset || 0) >= document.body.scrollHeight - 160);
    box.innerHTML = listHtml();
    try { H.simp(box); } catch (e) { }
    if (nearEnd) setTimeout(function () { window.scrollTo(0, document.body.scrollHeight); }, 30);
    if (CC.dm) { var sm = dmSeenMap(), k = dmKey(CC.dm.who); if (CC.last > (sm[k] || 0)) { sm[k] = CC.last; ls(P + 'xjdmseen', JSON.stringify(sm)); } }
    else if (X && !CC.alt && CC.last > chatSeen()) { X.chatSeen = CC.last; CC.unread = 0; save(); }
  }
  function fitChat() {
    var tb = $('tabbar'), ft = $('xjFt'); if (!ft) return;
    var h = 0;
    if (tb && !document.body.classList.contains('embedmode')) { var cs = window.getComputedStyle(tb); if (cs.display !== 'none' && cs.visibility !== 'hidden') h = tb.getBoundingClientRect().height; }
    ft.style.bottom = h + 'px';
    var list = $('xjList'); if (list) list.style.paddingBottom = (ft.getBoundingClientRect().height + 16) + 'px';
  }
  function growTa(ta) { CC.draft = ta.value; ta.style.height = '46px'; ta.style.height = Math.min(130, ta.scrollHeight + 2) + 'px'; fitChat(); }
  function send() {
    var ta = $('xjIn'), nk = $('xjNick');
    if (nk) { var n = trim(nk.value); if (!n) { note(f9('請先填你的稱呼', 'Please enter your name first')); nk.focus(); return; } setNick(n); }
    var text = trim(ta ? ta.value : ''); if (!text) { note(errTxt('empty')); return; }
    post({ text: text }, function () { CC.draft = ''; var t2 = $('xjIn'); if (t2) { t2.value = ''; growTa(t2); } });
  }
  function delMsg(id) {
    if (CC.arm !== id) { CC.arm = id; paintChat(); return; }
    CC.arm = 0;
    api(CHAT, 'POST', '/c/' + ccCode() + '/del', { id: id, dev: dev(), pin: (CC.alt || CC.dm) ? '' : (X.pin || ''), 'with': CC.dm ? CC.dm.who : '' }, function (j, e) {
      if (!j) { note(errTxt(e)); return; }
      var m = findMsg(id); if (m) { m.del = 1; m.text = ''; }
      CC.sel = 0; paintChat(); note(f9('已刪除', 'Deleted'));
    });
  }
  setInterval(function () { if (route() === 'xjchat' && !document.hidden) pull(0); }, 6000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && route() === 'xjchat') pull(0); });
  window.addEventListener('resize', fitChat);

  /* ── 今天完成名單＋獎勵 ── */
  var TD = { list: null, day: '', at: 0, busy: 0 };
  function tdFetch(force, cb) {
    if (!X) { if (cb) cb(null); return; }
    var d = today();
    if (!force && TD.list && TD.day === d && now() - TD.at < 60000) { if (cb) cb(TD.list); return; }
    if (TD.busy) { if (cb) cb(TD.list); return; }
    TD.busy = 1;
    api(CHAT, 'GET', '/c/' + X.code + '/today?day=' + d, null, function (j) {
      TD.busy = 0; if (j) { TD.list = j.list; TD.day = d; TD.at = now(); }
      if (cb) cb(j ? TD.list : null);
    });
  }
  function tdChips(max) {
    var L = (TD.day === today() && TD.list) || [], named = [], anon = 0, h = '';
    for (var i = 0; i < L.length; i++) { if (L[i].nick) named.push(L[i].nick); else anon++; }
    var shown = named.slice(0, max), rest = named.length - shown.length + anon;
    for (i = 0; i < shown.length; i++) h += '<span class="xjchip">🌟 ' + esc(shown[i]) + '</span>';
    if (rest) h += '<span class="xjchip more">' + esc(shown.length ? f9('等 ' + rest + ' 位', 'and ' + rest + ' more') : rest + ' ' + f9('位家人', rest > 1 ? 'members' : 'member')) + '</span>';
    return { html: h, total: L.length };
  }
  function doneToday() { return !!DAYS[today()]; }
  function progress() {
    var last = 0, total = 0, d7 = 0, t7 = now() - 7 * 864e5;
    for (var k in DAYS) if (Object.prototype.hasOwnProperty.call(DAYS, k)) { var ts = +DAYS[k] || 0; total++; if (ts > last) last = ts; if (ts > t7) d7++; }
    var o = { total: total, last: last, d7: d7, pw: 0, pd: 0, pn: 0 };
    if (H.teamCounts) { try { var tc = H.teamCounts() || {}; o.t2 = tc.t2 || 0; o.t3 = tc.t3 || 0; o.t5 = tc.t5 || 0; } catch (e) { } }
    return o;
  }
  function finish() {
    var d = today(), fresh = !DAYS[d];
    if (fresh) { DAYS[d] = now(); saveDays(); }
    if (!X) { reward(0, []); rerenderAll(); return; }
    shareAll(true);
    for (var gi = 0; gi < GL.length; gi++) if (GL[gi] !== X) (function (g) { api(CHAT, 'POST', '/c/' + g.code + '/done', { dev: dev(), nick: nick(), day: d, hide: g.hideName ? 1 : 0 }, function () { }); })(GL[gi]);
    var shown = 0;
    var t = setTimeout(function () { shown = 1; reward(0, TD.day === d ? TD.list : []); rerenderAll(); }, 2500);
    api(CHAT, 'POST', '/c/' + X.code + '/done', { dev: dev(), nick: nick(), day: d, hide: X.hideName ? 1 : 0 }, function (j) {
      if (j) { TD.list = j.list; TD.day = d; TD.at = now(); }
      if (shown) { rerenderAll(); return; }
      clearTimeout(t);
      reward(j ? j.rank : 0, j ? j.list : []);
      rerenderAll();
    });
  }
  function toggleName() {
    X.hideName = X.hideName ? 0 : 1; save();
    var d = today();
    if (doneToday()) api(CHAT, 'POST', '/c/' + X.code + '/done', { dev: dev(), nick: nick(), day: d, hide: X.hideName ? 1 : 0 }, function (j) { if (j) { TD.list = j.list; TD.day = d; TD.at = now(); } rr('xj'); });
    else rr('xj');
  }
  var CHEERS = [
    ['太好了，{0}！今天又和主約會了。', 'Well done, {0}! Another day spent with the Lord.'],
    ['{0}，你把一天最好的時間獻給了主，主必親近你。', '{0}, you gave the Lord the best of your day — He draws near to you.'],
    ['一生的果效由心發出——{0}，今天你把心交給了主。', 'Out of the heart flow the springs of life — {0}, today you gave your heart to the Lord.'],
    ['讓耶穌作王的一天，從親近祂開始。做得好，{0}！', 'A day with Jesus as King starts by drawing near to Him. Well done, {0}!'],
    ['{0}，你的堅持是小家的祝福，我們一起繼續走下去！', '{0}, your faithfulness is a blessing to our small group. Let’s keep going together!']
  ];
  var VERSES = [
    ['你的話是我腳前的燈，是我路上的光。', '詩篇 119:105', 'Your word is a lamp to my feet, and a light for my path.', 'Psalm 119:105'],
    ['人活著，不是單靠食物，乃是靠神口裡所出的一切話。', '馬太福音 4:4', 'Man shall not live by bread alone, but by every word that proceeds out of God’s mouth.', 'Matthew 4:4'],
    ['你們親近神，神就必親近你們。', '雅各書 4:8', 'Draw near to God, and he will draw near to you.', 'James 4:8'],
    ['看哪，弟兄和睦同居是何等地善，何等地美！', '詩篇 133:1', 'See how good and how pleasant it is for brothers to live together in unity!', 'Psalm 133:1'],
    ['當將你的事交託耶和華，並倚靠他，他就必成全。', '詩篇 37:5', 'Commit your way to the LORD. Trust also in him, and he will do this.', 'Psalm 37:5']
  ];
  var MEDAL = '<svg class="medal" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="xjg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".5" stop-color="#F2C75C"/><stop offset="1" stop-color="#C9962A"/></linearGradient>' +
    '<radialGradient id="xjb" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#3A6FD0"/><stop offset="1" stop-color="#12233F"/></radialGradient></defs>' +
    '<path d="M62 118 L44 186 L70 172 L84 196 L98 132 Z" fill="#B8473E"/><path d="M138 118 L156 186 L130 172 L116 196 L102 132 Z" fill="#B8473E"/>' +
    '<circle cx="100" cy="88" r="70" fill="url(#xjg)"/><circle cx="100" cy="88" r="58" fill="url(#xjb)" stroke="#FFF3C8" stroke-width="3"/>' +
    '<g fill="#FFE9A0" class="glow"><rect x="93" y="50" width="14" height="76" rx="3"/><rect x="72" y="68" width="56" height="13" rx="3"/></g>' +
    '<g fill="#F2C75C" opacity=".9"><path d="M40 70 q-12 18 0 36 q4-18 0-36z"/><path d="M160 70 q12 18 0 36 q-4-18 0-36z"/><path d="M48 52 q-16 10 -10 30 q8-14 10-30z"/><path d="M152 52 q16 10 10 30 q-8-14-10-30z"/></g>' +
    '<g fill="#fff"><path d="M30 30 l3 8 8 3 -8 3 -3 8 -3-8 -8-3 8-3z" class="glow"/><path d="M170 24 l2 6 6 2 -6 2 -2 6 -2-6 -6-2 6-2z" class="glow"/><path d="M176 140 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2z" class="glow"/></g></svg>';
  var RWTXT = '';
  function reward(rank, list) {
    var old = $('xjRw'); if (old) old.parentNode.removeChild(old);
    var nm = nick(), seed = new Date().getDate() + (rank || 0);
    var ch = CHEERS[seed % CHEERS.length], v = VERSES[(seed + 2) % VERSES.length];
    var cheer = f9(ch[0], ch[1]).replace('{0}', nm || f9('家人', 'friend'));
    var vt = isEN() ? v[2] : f9(v[0], v[0]), vr = isEN() ? v[3] : f9(v[1], v[1]);
    var others = [];
    for (var i = 0; i < (list || []).length && others.length < 8; i++) if (list[i].nick && list[i].nick !== nm) others.push(list[i].nick);
    var h = '<div class="rays"></div><div class="box">' + MEDAL +
      '<h2>' + esc(f9('今天又和主親近了！', 'Another day close to the Lord!')) + '</h2>' +
      (rank ? '<div class="rk">' + esc(rank === 1 ? f9('你是小家今天第一位完成晨讀／晚禱的家人！', 'You’re the first in your small group to finish today!') : f9('你是小家今天第 ' + rank + ' 位完成晨讀／晚禱的家人', 'You’re number ' + rank + ' in your small group today')) + '</div>' : '') +
      '<p class="cheer">' + esc(cheer) + '</p><div class="vs">' + (isEN() ? '“' + esc(vt) + '”' : '「' + esc(vt) + '」') + '<small>' + esc(vr) + '</small></div>' +
      (others.length ? '<p class="wt">' + esc(f9('今天一起完成的有：', 'Also finished today:')) + '<br>' + others.map(function (x) { return '<span>🌟 ' + esc(x) + '</span>'; }).join('') + '</p>' : '') +
      '<div class="acts"><button class="btn ghost" data-xj="rwshare">' + esc(f9('分享喜樂', 'Share the joy')) + '</button><button class="btn gold" data-xj="rwclose">' + esc(f9('阿們！', 'Amen!')) + '</button></div></div>';
    var el = document.createElement('div'); el.className = 'xjrw'; el.id = 'xjRw'; el.innerHTML = h;
    var cols = ['#F2C75C', '#FFFFFF', '#8FB0F5', '#E58FA0', '#6FAE71', '#C9962A'];
    for (var k = 0; k < 46; k++) {
      var c = document.createElement('i'); c.className = 'cf';
      c.style.left = (Math.random() * 100) + '%'; c.style.background = cols[k % cols.length];
      c.style.animationDuration = (2.4 + Math.random() * 2.2) + 's'; c.style.animationDelay = (Math.random() * 1.2) + 's';
      c.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px'); c.style.setProperty('--rt', (Math.random() * 720 - 360) + 'deg');
      el.appendChild(c);
    }
    document.body.appendChild(el);
    RWTXT = cheer + '\n' + (isEN() ? '“' + vt + '” ' : '「' + vt + '」') + vr;
    try { if (navigator.vibrate) navigator.vibrate([30, 40, 60]); } catch (e) { }
  }
  function shareText(t) {
    if (navigator.share) { navigator.share({ text: t })['catch'](function () { }); return; }
    try { navigator.clipboard.writeText(t).then(function () { note(f9('已複製', 'Copied')); }, function () { note(t); }); } catch (e) { note(t); }
  }

  /* ── 關懷名單 ── */
  var CR2 = { list: null, err: '', f: 'all', busy: 0, rows: [] };
  function shareProg(force, cb, grp) {
    var G = grp || X;
    if (!G || G.share !== 1) { if (cb) cb(); return; }
    if (!force && G.shAt && now() - G.shAt < 6 * 3600e3) { if (cb) cb(); return; }
    var g = progress(); g.dev = dev(); g.nick = nick(); g.share = 1;
    api(CHAT, 'POST', '/c/' + G.code + '/prog', g, function (j, e) { if (j) { G.shAt = now(); save(); } if (cb) cb(j, e); });
  }
  function shareAll(force) { for (var i = 0; i < GL.length; i++) shareProg(force, null, GL[i]); }
  function setShare(on) {
    var nk = $('xjShNick');
    if (on && nk) { var n = trim(nk.value); if (!n) { note(f9('請先填你的稱呼', 'Please enter your name first')); nk.focus(); return; } setNick(n); }
    if (on) {
      X.share = 1; X.shAt = 0; save();
      shareProg(true, function (j, e) { note(j ? f9('已分享，謝謝你讓家人彼此看顧', 'Shared — thank you for letting us care for one another') : errTxt(e)); rr('xj'); });
    } else {
      var was = X.share === 1; X.share = 0; save();
      if (was) api(CHAT, 'POST', '/c/' + X.code + '/prog', { dev: dev(), share: 0 }, function (j, e) { note(j ? f9('已關閉分享，伺服器上的進度已刪除', 'Sharing off — your progress was removed from the server') : errTxt(e)); });
      rr('xj');
    }
  }
  function loadRoster(force) {
    if (CR2.busy || !X || !X.pin) return; CR2.busy = 1;
    api(CHAT, 'POST', '/c/' + X.code + '/roster', { pin: X.pin, dev: dev() }, function (j, e) {
      CR2.busy = 0; CR2.err = j ? '' : e; if (j) CR2.list = j.list;
      if (!j && force) note(errTxt(e));
      rr('xjcare');
    });
  }
  /* 235 關係（互動聖經才有）：2 屬靈同伴、3 屬靈父母兒女、5 五重團隊 */
  function rel235(m) {
    if (m.t2 == null && m.t3 == null && m.t5 == null) return '';
    var K = [['t2', '2', f9('同伴', 'partner')], ['t3', '3', f9('父母兒女', 'parent/child')], ['t5', '5', f9('團隊', 'team')]], h = '';
    for (var i = 0; i < K.length; i++) { var on = (m[K[i][0]] || 0) > 0; h += '<span class="xj235' + (on ? ' on' : '') + '">' + (on ? '✓ ' : '✗ ') + K[i][1] + ' ' + esc(K[i][2]) + '</span>'; }
    return '<div class="xj235s">' + h + '</div>';
  }
  function daysAgo(ts) { if (!ts) return -1; var a = new Date(ts), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 864e5); }
  function level(m) { var d = daysAgo(m.last); if (d < 0) return 3; if (d === 0) return 0; if (d <= 2) return 1; if (d <= 6) return 2; return 3; }

  /* ── 對話框 ── */
  function modal(inner) {
    closeModal();
    var m = document.createElement('div'); m.id = 'xjModal'; m.className = 'xjmodal';
    m.innerHTML = '<div class="xjmask" data-xj="mclose"></div><div class="xjpanel">' + inner + '</div>';
    document.body.appendChild(m);
    try { H.simp(m); } catch (e) { }
    return m;
  }
  function closeModal() { var m = $('xjModal'); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function fld(lbl, inner) { return '<label class="fld"><span>' + esc(lbl) + '</span>' + inner + '</label>'; }

  function editNews(id) {
    var n = id ? findNews(id) : null; n = n || { kind: 'news', title: '', body: '', link: '', until: '', top: 0 };
    var ks = '', K = ['news', 'meet', 'event', 'pray'];
    for (var i = 0; i < K.length; i++) ks += '<option value="' + K[i] + '"' + (n.kind === K[i] ? ' selected' : '') + '>' + esc(kindTxt(K[i])) + '</option>';
    modal('<h3>' + esc(id ? f9('修改消息', 'Edit news') : f9('發佈小家消息', 'Post group news')) + '</h3>' +
      fld(f9('類別', 'Type'), '<select id="xjK">' + ks + '</select>') +
      fld(f9('標題', 'Title'), '<input id="xjT" type="text" maxlength="80" value="' + esc(n.title) + '">') +
      fld(f9('內容', 'Message'), '<textarea id="xjB" rows="5" maxlength="2000">' + esc(n.body) + '</textarea>') +
      fld(f9('連結（可不填）', 'Link (optional)'), '<input id="xjL" type="url" placeholder="https://" maxlength="500" value="' + esc(n.link || '') + '">') +
      fld(f9('顯示到哪一天（過了自動收起，可不填）', 'Show until (optional)'), '<input id="xjU" type="date" value="' + esc(n.until || '') + '">') +
      '<label class="chk"><input type="checkbox" id="xjTop"' + (n.top ? ' checked' : '') + '><span>📌 ' + esc(f9('置頂', 'Pin to top')) + '</span></label>' +
      '<div class="xjbtns"><button class="btn ghost" data-xj="mclose">' + esc(f9('取消', 'Cancel')) + '</button><button class="btn" id="xjSave" data-xj="nsave" data-id="' + esc(id || '') + '">' + esc(id ? f9('儲存', 'Save') : f9('發佈', 'Publish')) + '</button></div>');
  }
  function saveNews(id, btn) {
    var g = function (x) { var el = $(x); return el ? el.value : ''; };
    var it = { id: id, kind: g('xjK'), title: trim(g('xjT')), body: trim(g('xjB')), link: trim(g('xjL')), img: '', until: g('xjU'), top: ($('xjTop') || {}).checked ? 1 : 0 };
    if (!it.title && !it.body) { note(f9('請寫標題或內容', 'Please write a title or message')); return; }
    if (it.link && !/^https?:\/\//i.test(it.link)) { note(f9('連結要以 http:// 或 https:// 開頭', 'Links must start with http:// or https://')); return; }
    btn.disabled = true; var lbl = btn.textContent; btn.textContent = f9('正在翻譯成英文…', 'Translating…');
    var go = function () {
      adm('/news', { item: it }, function () { closeModal(); note(id ? f9('已儲存', 'Saved') : f9('已發佈，家人打開 App 就會看到', 'Published — everyone will see it')); X.seen = maxTs(DATA); save(); rr('xj'); });
      setTimeout(function () { if (btn) { btn.disabled = false; btn.textContent = lbl; } }, 1500);
    };
    if (H.nTr) H.nTr(it.title, it.body, function (r) { if (r) { it.title_en = r.title; it.body_en = r.body; } go(); });
    else go();
  }
  function delNews(id, btn) {
    if (btn.getAttribute('data-arm') !== '1') { btn.setAttribute('data-arm', '1'); btn.textContent = f9('再按一次刪除', 'Tap again to delete'); return; }
    adm('/del', { id: id }, function () { note(f9('已刪除', 'Deleted')); rr('xj'); });
  }
  function loginBox() {
    modal('<h3>' + esc(f9('家長登入', 'Leader sign-in')) + '</h3><p class="note">' + esc(f9('輸入建立小家時設定的家長密碼，這支手機就能發佈消息、看關懷名單、刪除不合宜的聊天訊息。', 'Enter the leader password set when the group was created, so this phone can post news, see the care list and remove messages.')) + '</p>' +
      fld(f9('家長密碼', 'Leader password'), '<input id="xjPin" type="password" maxlength="64" autocomplete="current-password">') +
      '<div class="xjbtns"><button class="btn ghost" data-xj="mclose">' + esc(f9('取消', 'Cancel')) + '</button><button class="btn" data-xj="logingo">' + esc(f9('登入', 'Sign in')) + '</button></div>');
    setTimeout(function () { var i = $('xjPin'); if (i) i.focus(); }, 200);
  }
  function toolsBox() {
    modal('<h3>' + esc(f9('家長工具', 'Leader tools')) + '</h3>' +
      fld(f9('小家名稱', 'Group name'), '<input id="xjRn" type="text" maxlength="40" value="' + esc(X.name || '') + '">') +
      '<button class="btn ghost" data-xj="rename">' + esc(f9('改名稱', 'Rename')) + '</button>' +
      '<div style="height:14px"></div>' +
      fld(f9('新的家長密碼（至少 4 碼）', 'New leader password (4+ characters)'), '<input id="xjP1" type="password" maxlength="64">') +
      fld(f9('再輸入一次', 'Type it again'), '<input id="xjP2" type="password" maxlength="64">') +
      '<button class="btn ghost" data-xj="newpin">' + esc(f9('更換密碼', 'Change password')) + '</button>' +
      '<div style="height:14px"></div><button class="btn ghost" data-xj="logout">' + esc(f9('這支手機登出家長身分', 'Sign out as leader on this phone')) + '</button>' +
      '<div class="xjbtns"><button class="btn" data-xj="mclose">' + esc(f9('關閉', 'Close')) + '</button></div>');
  }

  /* ── 建立／加入 ── */
  var JN = { busy: 0, needKey: 0, adding: 0 };
  function join() {
    var c = trim(($('xjCode') || {}).value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(), n = trim(($('xjJNick') || {}).value || '');
    if (c.length < 4) { note(f9('請輸入小家代碼', 'Please enter the group code')); return; }
    if (!n) { note(f9('請填你的稱呼，家人才認得你', 'Please enter your name so others know you')); return; }
    if (JN.busy) return; JN.busy = 1; note(f9('連線中…', 'Connecting…'));
    api(NEWS, 'GET', '/c/' + c + '?day=' + today(), null, function (j, e) {
      JN.busy = 0; if (!j) { note(errTxt(e)); return; }
      setNick(n);
      addGroup({ code: j.code, name: j.name, pin: '', seen: maxTs(j), chatSeen: 0, share: -1, shAt: 0, hideName: 0 }, j);
      ls(P + 'xjpend', null);
      note(f9('已加入「' + j.name + '」', 'Joined “' + j.name + '”'));
      H.render('xj');
    });
  }
  function create() {
    var g = function (x) { var el = $(x); return el ? el.value : ''; };
    var n = trim(g('xjNm')), nk = trim(g('xjCNick')), p = g('xjP'), p2 = g('xjP2c'), k = g('xjKey');
    if (!n) { note(f9('請填小家名稱', 'Please enter a group name')); return; }
    if (!nk) { note(f9('請填你的稱呼', 'Please enter your name')); return; }
    if (p.length < 4) { note(f9('家長密碼至少 4 碼', 'The password needs at least 4 characters')); return; }
    if (p !== p2) { note(f9('兩次密碼不一樣', 'The two passwords don’t match')); return; }
    if (JN.busy) return; JN.busy = 1; note(f9('建立中…', 'Creating…'));
    api(NEWS, 'POST', '/create', { name: n, pin: p, key: k, day: today() }, function (j, e) {
      JN.busy = 0;
      if (!j) { if (e === 'createkey' || e === 'badkey') { JN.needKey = 1; H.render('xj'); } note(errTxt(e)); return; }
      setNick(nk);
      addGroup({ code: j.code, name: j.name, pin: p, seen: 1, chatSeen: 0, share: -1, shAt: 0, hideName: 0 }, j);
      H.render('xj');
      modal('<h3>' + esc(f9('小家建立好了', 'Your small group is ready')) + '</h3><p class="note">' + esc(f9('這是你們的小家代碼，家人輸入代碼或點邀請連結就能加入：', 'This is your group code. Members can enter it or tap your invitation link:')) + '</p>' +
        '<p class="xjcode">' + esc(j.code) + '</p><p class="note">' + esc(f9('請記好家長密碼，發佈消息、看關懷名單時要用。', 'Keep the leader password — you need it to post news and see the care list.')) + '</p>' +
        '<div class="xjbtns"><button class="btn ghost" data-xj="mclose">' + esc(f9('阿們', 'Amen')) + '</button><button class="btn" data-xj="invite">' + esc(f9('邀請家人加入', 'Invite members')) + '</button></div>');
    });
  }
  function addGroup(g, data) {
    var ex = findGroup(g.code);
    if (ex) { ex.name = g.name; if (g.pin) ex.pin = g.pin; } else GL.push(g);
    CUR = g.code; pick(); DATA = data; DM[g.code] = data; NW.at = now(); JN.adding = 0; save(); resetLive();
  }
  function switchTo(c) {
    if (!findGroup(c) || (X && X.code === c)) return;
    CUR = c; pick(); NW.at = 0; NW.f = ''; resetLive(); save(); H.render('xj'); try { window.scrollTo(0, 0); } catch (e) { }
  }
  function resetLive() { CC.msgs = []; CC.last = 0; CC.unread = 0; CC.uAt = 0; CC.loaded = 0; TD.list = null; TD.at = 0; CR2.list = null; }
  function inviteUrl() { return location.origin + location.pathname.replace(/index\.html$/, '') + '?xj=' + X.code; }
  function invite() {
    shareText(f9('邀請你加入我們的小家「' + X.name + '」，在《' + APPZ + '》App 裡一起晨讀／晚禱、聊天、彼此代禱。\n點這個連結：' + inviteUrl() + '\n或在 App ' + WHEREZ + ' 輸入代碼：' + X.code,
      'You’re invited to join our small group “' + X.name + '” in the ' + APPE + ' app — morning reading, evening prayer and chat together.\nTap: ' + inviteUrl() + '\nOr open ' + WHEREE + ' and enter the code: ' + X.code));
  }
  var ARM = { leave: 0 };
  function leave(btn) {
    if (!ARM.leave) { ARM.leave = 1; btn.textContent = f9('再按一次離開', 'Tap again to leave'); setTimeout(function () { ARM.leave = 0; }, 4000); return; }
    ARM.leave = 0;
    if (X && X.share === 1) api(CHAT, 'POST', '/c/' + X.code + '/prog', { dev: dev(), share: 0 }, function () { });
    var lc = X.code, ln = X.name;
    GL = GL.filter(function (g) { return g.code !== lc; }); delete DM[lc];
    CUR = ''; pick(); save(); resetLive(); note(f9('已離開「' + ln + '」', 'You left “' + ln + '”')); H.render('xj');
  }

  /* ── 畫面 ── */
  function chatCard() {
    return '<div class="card xjcard" id="xjChatCard" data-xj="gochat" role="button"><div class="xjrow"><div class="xjic">💬</div><div class="xjgrow"><b>' + esc(f9('小家聊天室', 'Group chat')) + '</b><div class="note" style="margin:2px 0 0">' + esc(f9('和小家家人聊天、分享、彼此代禱', 'Chat, share and pray for one another')) + '</div></div>' +
      (DMS.unread && DMS.code === (X && X.code) ? '<span class="xjdot" style="margin-right:4px">✉️ ' + DMS.unread + '</span>' : '') + (CC.unread ? '<span class="xjdot">' + esc(f9(CC.unread + ' 則新訊息', CC.unread + ' new')) + '</span>' : '<span class="note" style="margin:0">' + esc(f9('進入', 'Open')) + ' ›</span>') + '</div></div>';
  }
  function doneCard() {
    if (H.autoDone) {
      if (doneToday()) return '<div class="card xjdone ok"><b>✅ ' + esc(f9('今天的晨讀／晚禱完成了', 'Today’s morning reading / evening prayer is done')) + '</b><p class="note">' + esc(f9('完成課程後，名字已自動出現在小家的「今天完成」名單。', 'Your name was added to “Finished today” automatically.')) + '</p></div>';
      return '<div class="card xjdone"><b>🙏 ' + esc(f9('今天晨讀／晚禱了嗎？', 'Morning reading or evening prayer today?')) + '</b><p class="note" style="margin-bottom:10px">' + esc(f9('完成今天的課程，名字就會自動出現在每個小家的「今天完成」名單（可在下方設定隱藏）。', 'Finish today’s lesson and your name appears on “Finished today” in every group automatically (you can hide it below).')) + '</p>' +
        (H.goRead ? '<button class="btn gold" data-xj="goread">' + esc(f9('去讀今天的課', 'Go to today’s lesson')) + '</button>' : '') + '</div>';
    }
    if (doneToday()) return '<div class="card xjdone ok"><b>✅ ' + esc(f9('今天的晨讀／晚禱完成了', 'Today’s morning reading / evening prayer is done')) + '</b><p class="note">' + esc(f9('感謝主！明天再一起親近祂。', 'Thank the Lord! See you tomorrow.')) + '</p></div>';
    return '<div class="card xjdone"><b>🙏 ' + esc(f9('今天晨讀／晚禱了嗎？', 'Morning reading or evening prayer today?')) + '</b><p class="note" style="margin-bottom:10px">' + esc(H.hintZh ? f9(H.hintZh, H.hintEn || '') : f9('參加晨讀或晚禱後，按一下讓家人一起歡喜。', 'After morning reading or evening prayer, tap to share the joy with your group.')) + '</p>' +
      '<button class="btn gold" data-xj="finish">' + esc(f9('我今天完成晨讀／晚禱了', 'I finished morning reading / evening prayer')) + '</button></div>';
  }
  function todayCard() {
    var c = tdChips(40);
    if (!TD.list || TD.day !== today()) return '';
    if (!c.total) return '<div class="card xjtd"><b>🙏 ' + esc(f9('今天完成晨讀／晚禱的家人', 'Finished today')) + '</b><p class="note">' + esc(f9('今天還沒有人完成，你來作第一位！', 'No one yet today — be the first!')) + '</p></div>';
    return '<div class="card xjtd"><div class="xjrow"><b class="xjgrow">🙏 ' + esc(f9('今天完成晨讀／晚禱的家人', 'Finished today')) + '</b><span class="xjnum">' + c.total + '</span></div><div class="xjchips">' + c.html + '</div></div>';
  }
  function careAsk() {
    if (!X || X.share === 1 || X.share === 0) return '';
    return '<div class="card xjask"><b>🤝 ' + esc(f9('讓家長知道你的晨讀／晚禱進度？', 'Let your leader see your progress?')) + '</b><p class="note" style="margin:6px 0 10px">' +
      esc(f9('家長可以看到你的稱呼、最近一次完成晨讀／晚禱的日期、完成天數，方便為你禱告、關心你。不會送出筆記、畫線或禱告內容，隨時可以關閉。', 'Your leader can see your name, the last day you finished, and how many days — so they can pray for and care for you. Notes, highlights and prayers are never sent. You can turn this off any time.')) + '</p>' +
      (nick() ? '' : '<input id="xjShNick" class="xjinp" type="text" maxlength="20" placeholder="' + esc(f9('你的稱呼（家人會看到）', 'Your name (others will see it)')) + '">') +
      '<div class="xjrow"><button class="btn" data-xj="shareon">' + esc(f9('好，分享給家長', 'Yes, share with my leader')) + '</button><button class="btn ghost" data-xj="shareoff" style="width:auto;white-space:nowrap;padding:15px 16px">' + esc(f9('先不要', 'Not now')) + '</button></div></div>';
  }
  function settingsLines() {
    var on = X.share === 1, hid = !!X.hideName, h = '';
    if (X.share === 1 || X.share === 0) h += '<div class="xjline"><span>' + (on ? '🤝 ' : '') + esc(on ? f9('已分享晨讀／晚禱進度給家長', 'Sharing progress with my leader') : f9('沒有分享晨讀／晚禱進度給家長', 'Not sharing progress with my leader')) + '</span><button class="xjsm" data-xj="' + (on ? 'shareoff' : 'shareon') + '">' + esc(on ? f9('關閉分享', 'Turn off') : f9('開啟分享', 'Turn on')) + '</button></div>';
    h += '<div class="xjline"><span>🌟 ' + esc(f9('在「今天完成」顯示我的名字：', 'Show my name on “Finished today”: ')) + esc(hid ? f9('已隱藏', 'Hidden') : f9('顯示中', 'Shown')) + '</span><button class="xjsm" data-xj="hidename">' + esc(hid ? f9('顯示', 'Show') : f9('隱藏', 'Hide')) + '</button></div>';
    h += '<div class="xjline"><span>🙋 ' + esc(f9('我的稱呼：', 'My name: ')) + esc(nick() || f9('（還沒填）', '(not set)')) + '</span><button class="xjsm" data-xj="nick">' + esc(f9('修改', 'Edit')) + '</button></div>';
    return '<div class="card xjset">' + h + '<p class="note">' + esc(f9('完成晨讀／晚禱的家人，名字會顯示在小家頁一起歡喜；筆記和禱告內容不會送出。', 'Names of members who finish are shown on the group page; notes and prayers are never sent.')) + '</p></div>';
  }
  function newsHtml() {
    var L = (DATA && DATA.news) || [], isAdm = !!X.pin, h = '', tdy = today(), seen = X.seen || 0, list = [];
    for (var i = 0; i < L.length; i++) { var n = L[i]; if (n.until && n.until < tdy && !isAdm) continue; if (NW.f && n.kind !== NW.f) continue; list.push(n); }
    list.sort(function (a, b) { if ((b.top ? 1 : 0) !== (a.top ? 1 : 0)) return (b.top ? 1 : 0) - (a.top ? 1 : 0); return (b.ts || 0) - (a.ts || 0); });
    var chips = '<div class="xjchips" style="margin:0 0 10px">';
    var F = [['', f9('全部', 'All')], ['news', kindTxt('news')], ['meet', kindTxt('meet')], ['event', kindTxt('event')], ['pray', kindTxt('pray')]];
    for (i = 0; i < F.length; i++) chips += '<button class="xjchip btn-chip' + (NW.f === F[i][0] ? ' on' : '') + '" data-xj="nf" data-k="' + F[i][0] + '">' + esc(F[i][1]) + '</button>';
    chips += '</div>';
    if (!list.length) return chips + '<div class="xjempty">' + esc(isAdm ? f9('還沒有消息，按「發佈消息」寫第一則吧', 'No news yet — tap “Post news” to write the first one') : f9('目前還沒有消息', 'No news yet')) + '</div>';
    for (i = 0; i < list.length; i++) {
      var m = list[i], isNew = m.ts > seen;
      h += '<div class="card xjnews' + (isNew ? ' new' : '') + '"><div class="xjrow"><span class="xjkind k-' + esc(m.kind || 'news') + '">' + esc(kindTxt(m.kind)) + '</span>' + (m.top ? '<span>📌</span>' : '') + (isNew ? '<span class="xjdot">' + esc(f9('新', 'New')) + '</span>' : '') +
        '<span class="note xjgrow" style="margin:0;text-align:right">' + esc(m.date || '') + (m.until ? ' · ' + esc(f9('到 ' + m.until, 'until ' + m.until)) : '') + '</span></div>' +
        (nTi(m) ? '<div class="xjnt">' + esc(nTi(m)) + '</div>' : '') + (nBo(m) ? '<div class="xjnb">' + linkify(nBo(m)) + '</div>' : '') +
        (m.link ? '<a class="xjsm" style="display:inline-block;margin-top:8px" href="' + esc(m.link) + '" target="_blank" rel="noopener">' + esc(f9('打開連結', 'Open link')) + ' ↗</a>' : '') +
        '<div class="xjrow" style="margin-top:8px;gap:6px;flex-wrap:wrap"><button class="xjsm" data-xj="nshare" data-id="' + esc(m.id) + '">' + esc(f9('分享', 'Share')) + '</button>' +
        (isAdm ? '<button class="xjsm" data-xj="nedit" data-id="' + esc(m.id) + '">' + esc(f9('修改', 'Edit')) + '</button><button class="xjsm" data-xj="ndel" data-id="' + esc(m.id) + '">' + esc(f9('刪除', 'Delete')) + '</button>' : '') + '</div></div>';
    }
    return chips + h;
  }
  function joinView() {
    var p = pend();
    var h = (X ? '<button class="xjsm" data-xj="joinback" style="margin:0 0 10px">‹ ' + esc(f9('回到「' + X.name + '」', 'Back to “' + X.name + '”')) + '</button>' : '') +
      H.pageHead(f9('關係 · 彼此相顧', 'RELATIONSHIPS · CARING FOR ONE ANOTHER'), X ? f9('加入或建立其他小家', 'Join or create another group') : f9('我的小家', 'My Small Group'),
        X ? f9('可以同時參加好幾個小家，在小家頁上方切換。', 'You can be in several groups and switch at the top of the group page.') : f9('和小家家人一起晨讀／晚禱、聊天、彼此代禱', 'Morning reading, evening prayer and chat with your small group'));
    h += '<div class="card"><h3>🏡 ' + esc(f9('加入小家', 'Join a small group')) + '</h3>' +
      (p ? '<p class="note" style="color:var(--gold-text)">' + esc(f9('你收到一個小家的邀請，按「加入」就可以了。', 'You received an invitation — just tap Join.')) + '</p>' : '<p class="note">' + esc(f9('向小家家長索取代碼，或直接點家長傳給你的邀請連結。', 'Ask your group leader for the code, or tap the invitation link they sent you.')) + '</p>') +
      fld(f9('小家代碼', 'Group code'), '<input id="xjCode" class="xjcodein" type="text" maxlength="10" autocapitalize="characters" placeholder="ABC234" value="' + esc(p) + '">') +
      fld(f9('你的稱呼（家人會看到）', 'Your name (others will see it)'), '<input id="xjJNick" type="text" maxlength="20" value="' + esc(nick()) + '">') +
      '<button class="btn" data-xj="join">' + esc(f9('加入', 'Join')) + '</button></div>';
    h += '<div class="card"><h3>🌱 ' + esc(f9('我是家長：建立小家', 'I’m a leader: create a group')) + '</h3><p class="note">' + esc(f9('建立後會得到一組小家代碼，把邀請連結傳給家人就能加入。請記好家長密碼。', 'You’ll get a group code to share. Keep your leader password safe.')) + '</p>' +
      fld(f9('小家名稱', 'Group name'), '<input id="xjNm" type="text" maxlength="40" placeholder="' + esc(f9('例如：恩典小家', 'e.g. Grace Group')) + '">') +
      fld(f9('你的稱呼', 'Your name'), '<input id="xjCNick" type="text" maxlength="20" value="' + esc(nick()) + '">') +
      fld(f9('家長密碼（至少 4 碼）', 'Leader password (4+ characters)'), '<input id="xjP" type="password" maxlength="64">') +
      fld(f9('再輸入一次密碼', 'Type the password again'), '<input id="xjP2c" type="password" maxlength="64">') +
      (JN.needKey ? fld(f9('建立碼（向團契同工索取）', 'Creation code (ask a co-worker)'), '<input id="xjKey" type="text" maxlength="64">') : '') +
      '<button class="btn ghost" data-xj="create">' + esc(f9('建立小家', 'Create group')) + '</button></div>';
    h += '<p class="note" style="margin:6px 4px 20px">' + esc(f9('「又要彼此相顧，激發愛心，勉勵行善。」（希伯來書 10:24）', '“Let’s consider how to provoke one another to love and good works.” (Hebrews 10:24)')) + '</p>';
    return h;
  }
  function switcher() {
    var h = '<div class="xjsw">';
    for (var i = 0; i < GL.length; i++) h += '<button class="xjchip btn-chip' + (GL[i].code === CUR ? ' on' : '') + '" data-xj="sw" data-k="' + esc(GL[i].code) + '">🏡 ' + esc(GL[i].name) + (GL[i].pin ? ' 🔑' : '') + '</button>';
    return h + '<button class="xjchip btn-chip xjadd" data-xj="addgrp">＋ ' + esc(f9('加入或建立其他小家', 'Join or create another')) + '</button></div>';
  }
  PAGES.xj = function () {
    var pp = pend();
    if (!X || JN.adding || pp) return joinView();
    var h = switcher() + H.pageHead(f9('我的小家', 'MY SMALL GROUP') + (GL.length > 1 ? ' · ' + f9('共 ' + GL.length + ' 個', GL.length + ' groups') : ''), X.name || f9('我的小家', 'My Small Group'), f9('小家代碼 ', 'Group code ') + X.code);
    h += doneCard() + todayCard() + chatCard() + (H.groupExtra ? (function () { try { return H.groupExtra(X) || ''; } catch (e) { return ''; } })() : '') + careAsk();
    if (X.pin) h += '<div class="xjadm"><button class="btn" data-xj="nnew">＋ ' + esc(f9('發佈消息', 'Post news')) + '</button><button class="btn ghost" data-xj="gocare">💌 ' + esc(f9('關懷名單', 'Care list')) + '</button><button class="btn ghost" data-xj="tools">⚙️ ' + esc(f9('家長工具', 'Leader tools')) + '</button></div>';
    h += H.sect('消', f9('小家消息', 'Group News')) + newsHtml();
    h += H.sect('我', f9('我的設定', 'My Settings')) + settingsLines();
    h += '<div class="xjadm"><button class="btn ghost" data-xj="addgrp">＋ ' + esc(f9('加入或建立其他小家', 'Join or create another group')) + '</button><button class="btn ghost" data-xj="invite">📨 ' + esc(f9('邀請家人加入', 'Invite members')) + '</button>' +
      (X.pin ? '' : '<button class="btn ghost" data-xj="login">🔑 ' + esc(f9('家長登入', 'Leader sign-in')) + '</button>') +
      '<button class="btn ghost" data-xj="leave">' + esc(f9('離開這個小家', 'Leave this group')) + '</button></div>';
    var mx = maxTs(DATA); if (DATA && mx > (X.seen || 0)) { X.seen = mx; save(); }
    return h;
  };
  PAGES.xjchat = function () {
    if (!X && !CC.alt) return PAGES.xj();
    var q = CC.re ? findMsg(CC.re) : null;
    var h = (CC.dm ? '<div class="xjchathd"><button class="xjsm" data-xj="dmback">‹ ' + esc(f9('回聊天室', 'Back')) + '</button><b>✉️ ' + esc(CC.dm.nick) + '</b><button class="xjsm" data-xj="cref" aria-label="refresh">⟳</button></div>' +
        '<div class="xjtip">' + esc(f9('這是你和「' + CC.dm.nick + '」的私訊，只有你們兩個人看得到。', 'Private messages with ' + CC.dm.nick + ' — only the two of you can see them.')) + '</div>'
      : '<div class="xjchathd"><b>' + esc(ccName()) + ' · ' + esc(CC.alt ? f9('聊天室', 'Chat') : f9('小家聊天室', 'Group chat')) + '</b><button class="xjsm" id="xjDmBtn" data-xj="dminbox" aria-label="private messages">✉️' + (DMS.unread && DMS.code === ccCode() ? '<span class="xjdot" style="margin-left:4px">' + DMS.unread + '</span>' : '') + '</button><button class="xjsm" data-xj="cref" aria-label="refresh">⟳</button></div>') +
      (CC.dm ? '' : '<div class="xjtip">') + (CC.dm ? '' : esc(CC.alt ? f9('請彼此尊重、用愛心說誠實話；個人隱私與代禱細節請斟酌。每個人可以刪除自己的訊息。', 'Be respectful and speak the truth in love; take care with private details. You can delete your own messages.') : f9('請彼此尊重、用愛心說誠實話；個人隱私與代禱細節請斟酌。家長可以刪除不合宜的訊息。', 'Be respectful and speak the truth in love; take care with private details. The leader can remove messages.')) + '') + (CC.dm ? '' : '</div>') +
      '<div id="xjList" class="xjlist">' + listHtml() + '</div>' +
      '<div class="xjft" id="xjFt"><div class="in">' +
      (q ? '<div class="xjre"><span>↩ ' + esc(f9('回覆 ', 'Reply to ') + (q.nick || '')) + '：' + esc(q.text) + '</span><button data-xj="recancel">✕</button></div>' : '') +
      (nick() ? '' : '<input id="xjNick" class="xjinp" type="text" maxlength="20" placeholder="' + esc(f9('你的稱呼（大家會看到）', 'Your name (everyone will see it)')) + '">') +
      stkPanel() + '<div class="xjup" id="xjUp" style="display:none"></div>' +
      '<div class="xjrec" id="xjRec" style="display:none"><span class="dot"></span><b>' + esc(f9('錄音中', 'Recording')) + '</b><span id="xjRecT">0:00</span><span class="xjgrow"></span><button class="xjsm" data-xj="reccancel">' + esc(f9('取消', 'Cancel')) + '</button><button class="btn" data-xj="recsend" style="width:auto;padding:8px 16px;min-height:0">' + esc(f9('送出', 'Send')) + '</button></div>' +
      '<div class="xjrow"><button class="xjtool" data-xj="file" aria-label="' + esc(f9('傳相片或檔案', 'Send photo or file')) + '">📎</button><button class="xjtool" data-xj="rec" aria-label="' + esc(f9('錄音', 'Record voice')) + '">🎤</button><button class="xjtool" data-xj="stkp" aria-label="' + esc(f9('貼圖', 'Stickers')) + '">😊</button>' +
      '<input type="file" id="xjPhoto" accept="image/*" style="display:none"><input type="file" id="xjFile" style="display:none">' +
      '<textarea id="xjIn" class="xjinp" rows="1" maxlength="600" placeholder="' + esc(f9('說些什麼…', 'Say something…')) + '">' + esc(CC.draft) + '</textarea><button class="btn" id="xjSend" data-xj="send" style="width:auto">' + esc(f9('送出', 'Send')) + '</button></div></div></div>';
    return h;
  };
  PAGES.xjcare = function () {
    if (!X) return PAGES.xj();
    var h = H.pageHead(f9('家長 · 關懷', 'LEADER · CARE'), f9('關懷名單', 'Care List'), f9('同意分享進度的家人', 'Members who chose to share their progress'));
    if (!X.pin) return h + '<div class="xjempty">' + esc(f9('請先用家長身分登入', 'Please sign in as leader first')) + '</div>';
    if (!CR2.list) { if (!CR2.err) setTimeout(function () { loadRoster(0); }, 0); return h + '<div class="xjempty">' + esc(CR2.err ? errTxt(CR2.err) : f9('載入中…', 'Loading…')) + '</div>'; }
    var L = CR2.list, need = 0, rows = [], i;
    for (i = 0; i < L.length; i++) if (level(L[i]) >= 2) need++;
    h += '<div class="xjrow" style="margin:0 0 10px;gap:8px"><button class="xjchip btn-chip' + (CR2.f === 'all' ? ' on' : '') + '" data-xj="cf" data-k="all">' + esc(f9('全部 ', 'All ') + L.length) + '</button>' +
      '<button class="xjchip btn-chip' + (CR2.f === 'need' ? ' on' : '') + '" data-xj="cf" data-k="need">' + esc(f9('需要關懷 ', 'Need care ') + need) + '</button><span class="xjgrow"></span><button class="xjsm" data-xj="cload">⟳</button></div>';
    for (i = 0; i < L.length; i++) { if (CR2.f === 'need' && level(L[i]) < 2) continue; rows.push(L[i]); }
    rows.sort(function (a, b) { return (a.last || 0) - (b.last || 0); });
    if (!L.length) h += '<div class="xjempty">' + esc(f9('還沒有人分享進度。可以在聚會或聊天室邀請家人到「我的小家」按「好，分享給家長」。', 'No one is sharing yet. Invite members to tap “Yes, share with my leader” on the group page.')) + '</div>';
    var COL = ['#2E7D32', '#3A74B0', '#C77700', '#C0392B'], ICN = ['✅', '🟢', '🟠', '🔴'];
    for (i = 0; i < rows.length; i++) {
      var m = rows[i], lv = level(m), d = daysAgo(m.last);
      var when = d < 0 ? f9('還沒有完成紀錄', 'No record yet') : (d === 0 ? f9('今天完成', 'Finished today') : f9(d + ' 天前完成', d + (d > 1 ? ' days ago' : ' day ago')));
      h += '<div class="card xjcr" style="border-left:5px solid ' + COL[lv] + '"><div class="xjrow"><div class="xjav" style="background:' + col(m.who) + '">' + esc(String(m.nick || '?').slice(0, 1)) + '</div>' +
        '<div class="xjgrow" style="min-width:0"><b>' + esc(m.nick) + '</b><div style="color:' + COL[lv] + ';font-weight:700;font-size:.85em">' + ICN[lv] + ' ' + esc(when) + '</div>' +
        '<div class="note" style="margin:0">' + esc(f9('共 ' + (m.total || 0) + ' 天', (m.total || 0) + ' days in all')) + ' · ' + esc(f9('近 7 天 ' + (m.d7 || 0) + ' 天', (m.d7 || 0) + ' of last 7 days')) + '</div>' + rel235(m) + '</div>' +
        '<button class="xjsm" data-xj="care" data-i="' + i + '">💌 ' + esc(f9('關懷', 'Care')) + '</button></div></div>';
    }
    CR2.rows = rows;
    h += '<p class="note" style="margin:14px 4px 20px">' + esc(f9('只顯示同意分享的家人；沒出現在名單上的人，可能只是沒有開啟分享。關懷時請私下聯絡，不要在聊天室點名。', 'Only members who chose to share appear here. Please reach out privately — don’t name anyone in the chat.')) + '</p>';
    return h;
  };
  try { H.TITLES.xj = '我的小家'; H.TITLES.xjchat = '小家聊天室'; H.TITLES.xjcare = '關懷名單'; } catch (e) { }
  try { H.CR_SKIP.xj = 1; H.CR_SKIP.xjchat = 1; H.CR_SKIP.xjcare = 1; } catch (e) { }

  /* 入口：底部導覽「小家」分頁、連結同行頁、首頁的小家卡片 */
  function homeCard() {
    var c = tdChips(6);
    return '<div class="card xjhome" data-xj="gohome" role="button"><div class="xjrow"><b class="xjgrow">🏡 ' + esc(X.name) + (GL.length > 1 ? ' <span class="note" style="font-weight:400">' + esc(f9('等 ' + GL.length + ' 個小家', '+' + (GL.length - 1) + ' more')) + '</span>' : '') + '</b><span id="xjHomeUnread">' + (CC.unread ? '<span class="xjdot">' + esc(f9(CC.unread + ' 則新訊息', CC.unread + ' new')) + '</span>' : '') + (unreadNews() ? ' <span class="xjdot">' + esc(f9(unreadNews() + ' 則消息', unreadNews() + ' news')) + '</span>' : '') + '</span></div>' +
      (c.total ? '<div class="note" style="margin:4px 0 0">' + esc(f9('今天 ' + c.total + ' 位家人完成晨讀／晚禱', c.total + ' finished today')) + '</div><div class="xjchips">' + c.html + '</div>' : '<div class="note" style="margin:4px 0 0">' + esc(f9('今天還沒有人完成晨讀／晚禱，你來作第一位', 'No one has finished today — be the first')) + '</div>') +
      (doneToday() ? '<div class="note" style="margin:8px 0 0;color:#2E7D32;font-weight:700">✅ ' + esc(f9('我今天完成晨讀／晚禱了', 'I finished today’s reading / prayer')) + '</div>' : '<button class="btn gold" style="margin-top:10px" data-xj="finish">🙏 ' + esc(f9('我今天完成晨讀／晚禱了', 'I finished morning reading / evening prayer')) + '</button>') + '</div>';
  }
  function after(r) {
    var view = $('view'); if (!view) return;
    try { document.body.classList[r === 'xjchat' ? 'add' : 'remove']('xjchatmode'); } catch (e) { }
    if (r !== 'xjchat' && RC.rec) recStop(1);
    if (r === 'xjchat' || r === 'xjcare') {
      var tabs = document.querySelectorAll('#tabbar .tab');
      for (var ti = 0; ti < tabs.length; ti++) { var on = tabs[ti].getAttribute('data-route') === 'xj'; tabs[ti].className = 'tab' + (on ? ' on' : ''); if (on) tabs[ti].setAttribute('aria-current', 'page'); else tabs[ti].removeAttribute('aria-current'); }
    }
    if (r === 'home' && X) {
      var old = $('xjHome'); if (old) old.parentNode.removeChild(old);
      var box = document.createElement('div'); box.id = 'xjHome'; box.innerHTML = homeCard();
      var va = view.querySelector('.xtools') || view.querySelector('.vact') || view.querySelector('.verse');
      if (va && va.parentNode) va.parentNode.insertBefore(box, va.nextSibling); else view.insertBefore(box, view.firstChild);
      try { H.simp(box); } catch (e) { }
      fetchHome(false, function (j) { if (j && route() === 'home') { var b = $('xjHome'); if (b) { b.innerHTML = homeCard(); try { H.simp(b); } catch (e) { } } } });
      tdFetch(false, function (L) { if (L && route() === 'home') { var b = $('xjHome'); if (b) { b.innerHTML = homeCard(); try { H.simp(b); } catch (e) { } } } });
      peek();
    }
    if (r === 'connect') {
      var labs = view.querySelectorAll('.section-label'), lab = labs.length ? labs[0] : null;
      if (lab && !$('xjConn')) {
        var d = document.createElement('div'); d.id = 'xjConn';
        d.innerHTML = '<div class="card xjcard" data-xj="gohome" role="button"><div class="xjrow"><div class="xjic">🏡</div><div class="xjgrow"><b>' + esc(f9('我的小家', 'My Small Group')) + '</b><div class="note" style="margin:2px 0 0">' +
          esc(X ? X.name + ' · ' + f9('消息、聊天室、彼此代禱', 'news, chat, prayer') : f9('建立或加入小家，一起晨讀／晚禱、聊天、彼此代禱', 'Create or join a group — morning reading, evening prayer and chat together')) + '</div></div><span class="note" style="margin:0">›</span></div></div>';
        lab.parentNode.insertBefore(d, lab.nextSibling);
        try { H.simp(d); } catch (e) { }
      }
    }
    if (r === 'xj' && X) {
      autoSync();
      var stale = !DATA || now() - NW.at > 60000, tdStale = !TD.list || TD.day !== today() || now() - TD.at > 60000;
      if (stale) fetchHome(false, function (j) { if (j) rr('xj'); });
      if (tdStale) tdFetch(false, function (L) { if (L) rr('xj'); });
      peek();
      shareProg(false);
    }
    if (r === 'xjchat' && (X || CC.alt)) {
      var ta = $('xjIn');
      if (ta) { ta.oninput = function () { growTa(ta); }; ta.onkeydown = function (e) { if (e.keyCode === 13 && !e.shiftKey && !e.isComposing && window.innerWidth > 760) { e.preventDefault(); send(); } }; if (CC.draft) growTa(ta); }
      var ph = $('xjPhoto'), fl = $('xjFile');
      if (ph) ph.onchange = function () { pickPhoto(ph); };
      if (fl) fl.onchange = function () { pickFile(fl); };
      setTimeout(fitChat, 0); setTimeout(fitChat, 300);
      if (!CC.loaded) { CC.loaded = 1; pull(1); } else { paintChat(true); pull(0); }
      if (!CC.dm) dmLoad();
    }
  }
  H.wrapRender(after);
  function rerenderAll() { var r = route(); if (r === 'xj' || r === 'home') H.render(r); }

  /* ── 點擊 ── */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    while (t && t !== document && !(t.getAttribute && t.getAttribute('data-xj'))) t = t.parentNode;
    if (!t || t === document) return;
    var a = t.getAttribute('data-xj'), id = t.getAttribute('data-id');
    if (a === 'join') join();
    else if (a === 'goread') { if (H.goRead) H.goRead(); }
    else if (a === 'sw') switchTo(t.getAttribute('data-k'));
    else if (a === 'addgrp') { JN.adding = 1; H.render('xj'); try { window.scrollTo(0, 0); } catch (e) { } }
    else if (a === 'joinback') { JN.adding = 0; ls(P + 'xjpend', null); H.render('xj'); }
    else if (a === 'create') create();
    else if (a === 'gohome') H.go('xj');
    else if (a === 'gochat') { if (CC.alt || CC.dm) { CC.alt = null; CC.dm = null; resetLive(); } H.go('xjchat'); }
    else if (a === 'dminbox') dmInbox();
    else if (a === 'dmopen') dmOpen(t.getAttribute('data-who'), t.getAttribute('data-nick'));
    else if (a === 'dmback') { CC.dm = null; CC.msgs = []; CC.last = 0; CC.loaded = 0; CC.re = 0; H.render('xjchat'); }
    else if (a === 'gocare') { CR2.list = null; CR2.err = ''; H.go('xjcare'); }
    else if (a === 'finish') { ev.stopPropagation(); finish(); }
    else if (a === 'rwclose') { var el = $('xjRw'); if (el) el.parentNode.removeChild(el); }
    else if (a === 'rwshare') shareText(f9('我今天在《' + APPZ + '》完成晨讀／晚禱了！', 'I joined today’s morning reading / evening prayer in the ' + APPE + ' app!') + '\n' + RWTXT);
    else if (a === 'shareon') setShare(1);
    else if (a === 'shareoff') setShare(0);
    else if (a === 'hidename') toggleName();
    else if (a === 'nick') {
      modal('<h3>' + esc(f9('我的稱呼', 'My name')) + '</h3>' + fld(f9('家人會看到這個名字', 'Others will see this name'), '<input id="xjNk" type="text" maxlength="20" value="' + esc(nick()) + '">') +
        '<div class="xjbtns"><button class="btn ghost" data-xj="mclose">' + esc(f9('取消', 'Cancel')) + '</button><button class="btn" data-xj="nicksave">' + esc(f9('儲存', 'Save')) + '</button></div>');
    }
    else if (a === 'nicksave') { var nv = trim(($('xjNk') || {}).value); if (!nv) { note(f9('請填你的稱呼', 'Please enter your name')); return; } setNick(nv); closeModal(); X.shAt = 0; shareProg(true); rr('xj'); }
    else if (a === 'invite') { closeModal(); invite(); }
    else if (a === 'leave') leave(t);
    else if (a === 'login') loginBox();
    else if (a === 'logingo') {
      var p = ($('xjPin') || {}).value || ''; if (!p) return;
      X.pin = p; adm('/auth', {}, function () { closeModal(); note(f9('已用家長身分登入', 'Signed in as leader')); rr('xj'); });
    }
    else if (a === 'tools') toolsBox();
    else if (a === 'rename') { var rn = trim(($('xjRn') || {}).value); if (!rn) { note(f9('請填小家名稱', 'Please enter a group name')); return; } adm('/name', { name: rn }, function () { closeModal(); note(f9('已儲存', 'Saved')); rr('xj'); }); }
    else if (a === 'newpin') {
      var p1 = ($('xjP1') || {}).value || '', p2 = ($('xjP2') || {}).value || '';
      if (p1.length < 4) { note(f9('密碼至少 4 碼', 'At least 4 characters')); return; } if (p1 !== p2) { note(f9('兩次密碼不一樣', 'The two passwords don’t match')); return; }
      adm('/pin', { newpin: p1 }, function () { X.pin = p1; save(); closeModal(); note(f9('密碼已更換', 'Password changed')); });
    }
    else if (a === 'logout') { X.pin = ''; save(); closeModal(); note(f9('已登出家長身分', 'Signed out')); rr('xj'); }
    else if (a === 'mclose') closeModal();
    else if (a === 'nnew') editNews('');
    else if (a === 'nedit') editNews(id);
    else if (a === 'nsave') saveNews(id || '', t);
    else if (a === 'ndel') delNews(id, t);
    else if (a === 'nshare') { var n = findNews(id); if (n) shareText('【' + X.name + '・' + kindTxt(n.kind) + '】' + (nTi(n) ? nTi(n) + '\n' : '') + (nBo(n) || '') + (n.link ? '\n' + n.link : '')); }
    else if (a === 'nf') { NW.f = t.getAttribute('data-k') || ''; rr('xj'); }
    else if (a === 'send') send();
    else if (a === 'photo') { var ip = $('xjPhoto'); if (ip) ip.click(); }
    else if (a === 'file') { var ifl = $('xjFile'); if (ifl) ifl.click(); }
    else if (a === 'stkp') { CC.stk = CC.stk ? 0 : 1; var pn = $('xjStk'); if (pn) pn.style.display = CC.stk ? 'grid' : 'none'; fitChat(); }
    else if (a === 'stk') sendStk(t.getAttribute('data-k'));
    else if (a === 'rec') recStart();
    else if (a === 'recsend') recStop(0);
    else if (a === 'reccancel') recStop(1);
    else if (a === 'img') viewImg(id);
    else if (a === 'vclose') { var vw = $('xjView'); if (vw) vw.parentNode.removeChild(vw); }
    else if (a === 'cref') pull(1);
    else if (a === 'tap') { var mid = +id; CC.sel = CC.sel === mid ? 0 : mid; CC.arm = 0; paintChat(); }
    else if (a === 'reply') { CC.re = +id; CC.sel = 0; H.render('xjchat'); var ta = $('xjIn'); if (ta) ta.focus(); }
    else if (a === 'recancel') { CC.re = 0; H.render('xjchat'); }
    else if (a === 'copy') { var mm = findMsg(+id); if (mm) { try { navigator.clipboard.writeText(mm.text).then(function () { note(f9('已複製', 'Copied')); }, function () { note(mm.text); }); } catch (e) { note(mm.text); } } CC.sel = 0; paintChat(); }
    else if (a === 'mdel') delMsg(+id);
    else if (a === 'cf') { CR2.f = t.getAttribute('data-k'); rr('xjcare'); }
    else if (a === 'cload') loadRoster(1);
    else if (a === 'care') {
      var m = CR2.rows[+t.getAttribute('data-i')]; if (!m) return;
      var txt = f9(m.nick + '平安！這幾天想起你，為你禱告。最近好嗎？有什麼需要代禱的，隨時跟我說。願主親自陪伴你，我們一起繼續走下去。', 'Peace to you, ' + m.nick + '! I’ve been thinking of you and praying for you. How are you doing? If there’s anything I can pray about, just tell me. May the Lord be with you — let’s keep walking together.');
      shareText(txt);
    }
  });

  /* ── 樣式 ── */
  var st = document.createElement('style');
  st.textContent =
    '.xjrow{display:flex;align-items:center;gap:10px}.xjgrow{flex:1;min-width:0}.xjcard{cursor:pointer}.xjic{width:44px;height:44px;border-radius:14px;background:var(--sky);display:flex;align-items:center;justify-content:center;font-size:1.3em;flex:none}' +
    '.xjdot{display:inline-block;background:#C8463C;color:#fff;border-radius:999px;font-size:.72em;padding:2px 9px;font-weight:700;white-space:nowrap}' +
    '.xjdone{border-left:5px solid var(--gold)}.xjdone.ok{border-left-color:#2E7D32}.xjhome{cursor:pointer;border-left:5px solid var(--gold);margin-top:12px}' +
    '.xjtd{background:linear-gradient(135deg,#FFF8E2,#EEF3FB);border-color:#EADFBF}.xjnum{font-family:var(--font-display);font-weight:800;color:var(--gold-text);font-size:1.4em}' +
    '.xjchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.xjchip{background:var(--white);border:1px solid var(--line);border-radius:999px;padding:3px 11px;font-size:.84em;font-weight:600;color:var(--ink)}.xjchip.more{color:var(--muted);font-weight:500}' +
    '.btn-chip{cursor:pointer;font-family:inherit}.btn-chip.on{background:var(--navy);border-color:var(--navy);color:#fff}' +
    '.xjadm{display:flex;flex-direction:column;gap:8px;margin:12px 0}.xjsm{border:1px solid var(--line);background:var(--white);color:var(--head);border-radius:999px;padding:6px 13px;font-size:.84em;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit}' +
    '.xjline{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--line)}.xjline span{flex:1;font-size:.92em}.xjline:last-of-type{border-bottom:0}' +
    '.xjnews.new{box-shadow:0 0 0 2px rgba(200,70,60,.25)}.xjnt{margin:8px 0 4px;font-weight:700;font-size:1.06em;color:var(--head)}.xjnb{line-height:1.85;word-break:break-word}' +
    '.xjkind{font-size:.76em;font-weight:700;border-radius:999px;padding:2px 10px;background:var(--sky);color:var(--head)}.k-meet{background:#E6F0FA;color:#1F5C99}.k-event{background:#FBF0DC;color:#9A6512}.k-pray{background:#F3E8F7;color:#6C3F8A}' +
    '.xjempty{text-align:center;color:var(--muted);padding:26px 12px;font-size:.95em}.xjcode{font-size:2.1em;letter-spacing:.25em;font-weight:800;color:var(--head);text-align:center;margin:14px 0}' +
    '.xjcodein{text-transform:uppercase;letter-spacing:.2em;font-size:1.2em!important}.xjinp{width:100%;border:1px solid var(--line);border-radius:12px;padding:11px 12px;font-family:inherit;font-size:calc(16px * var(--fs));background:var(--white);color:var(--ink);box-sizing:border-box;margin-bottom:8px}' +
    '.fld select{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-family:inherit;font-size:calc(16px * var(--fs));background:var(--white);color:var(--ink)}' +
    '.xjmodal{position:fixed;inset:0;z-index:80;display:flex;align-items:flex-end;justify-content:center}.xjmask{position:absolute;inset:0;background:rgba(10,20,40,.45)}' +
    '.xjpanel{position:relative;width:100%;max-width:var(--maxw);max-height:88vh;overflow:auto;background:var(--paper);border-radius:20px 20px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom))}.xjpanel h3{margin:0 0 8px;color:var(--head)}' +
    '.xjbtns{display:flex;gap:10px;margin-top:14px}.chk{display:flex;align-items:center;gap:8px;margin:8px 0}' +
    '.xjchathd{display:flex;align-items:center;gap:10px;margin:4px 0 6px}.xjchathd b{flex:1;font-family:var(--font-display);font-size:1.1em;color:var(--head)}' +
    '.xjtip{font-size:.78em;color:var(--muted);background:var(--sky);border-radius:12px;padding:8px 12px;margin:0 0 8px;line-height:1.6}' +
    '.xjlist{padding-bottom:140px}.xjday{text-align:center;margin:14px 0 6px}.xjday span{font-size:.72em;color:var(--muted);background:var(--sky);border-radius:999px;padding:3px 10px}' +
    '.xjm{display:flex;gap:8px;margin:8px 0;align-items:flex-end}.xjm.mine{flex-direction:row-reverse}.xjav{width:34px;height:34px;border-radius:50%;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none;font-size:.9em}' +
    '.xjb{max-width:76%;min-width:0}.xjn{font-size:.74em;color:var(--muted);margin:0 4px 2px}' +
    '.xjt{background:var(--white);border:1px solid var(--line);border-radius:16px;border-bottom-left-radius:5px;padding:9px 13px;white-space:pre-wrap;word-break:break-word;line-height:1.65;cursor:pointer}' +
    '.xjm.mine .xjt{background:var(--navy);border-color:var(--navy);color:#fff;border-bottom-left-radius:16px;border-bottom-right-radius:5px}.xjm.mine .xjt a{color:#fff}' +
    '.xjt.gone{background:none;color:var(--muted);font-style:italic;border-style:dashed;cursor:default}.xjq{font-size:.8em;opacity:.8;border-left:3px solid var(--gold);padding:2px 8px;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.xjtime{font-size:.68em;color:var(--muted);margin:0 4px;white-space:nowrap}.xjacts{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}.xjm.mine .xjacts{justify-content:flex-end}' +
    '.xjacts button{border:1px solid var(--line);background:var(--white);border-radius:999px;font-size:.76em;padding:4px 11px;cursor:pointer;color:var(--ink);font-family:inherit}' +
    '.xjft{position:fixed;left:50%;transform:translateX(-50%);width:100%;max-width:var(--maxw);bottom:0;z-index:34;background:var(--white);border-top:1px solid var(--line);padding:8px 12px}' +
    '.xjft .xjrow{align-items:flex-end;gap:8px}.xjft textarea{min-height:46px;max-height:130px;height:46px;resize:none;line-height:1.5;margin:0}.xjft .btn{min-height:46px;padding:10px 18px;flex:none}' +
    '.xjre{display:flex;align-items:center;gap:8px;font-size:.8em;color:var(--head);margin-bottom:6px}.xjre span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.xjre button{border:0;background:none;color:var(--muted);cursor:pointer}' +
    '.xjtool{flex:none;width:40px;height:46px;border:0;background:none;font-size:1.35em;cursor:pointer;padding:0;border-radius:10px}.xjtool:active{background:var(--sky)}' +
    '.xjft .xjrow{gap:2px}.xjft textarea{margin-left:4px!important}.xjup{font-size:.82em;color:var(--head);background:var(--sky);border-radius:10px;padding:6px 10px;margin-bottom:6px}' +
    '.xjstkp{grid-template-columns:repeat(4,1fr);gap:8px;max-height:min(44vh,330px);overflow:auto;padding:4px 0 8px}.xjstkp button{border:0;background:none;padding:0;cursor:pointer}.xjstkp .xjstk{width:100%;height:auto;aspect-ratio:1;min-width:0}.xjstkp .xjstk .e{font-size:1.8em}.xjstkp .xjstk b{font-size:.72em}' +
    '.xjstk{width:124px;height:124px;border-radius:22px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;box-shadow:0 3px 10px rgba(18,35,63,.12);text-align:center;padding:6px}.xjstk .e{font-size:2.6em;line-height:1}.xjstk b{font-size:.92em;line-height:1.25;font-family:var(--font-display)}' +
    '.xjimg{display:block;max-width:min(240px,100%);max-height:320px;width:auto;border-radius:14px;border:1px solid var(--line);cursor:zoom-in;background:var(--sky);object-fit:cover}' +
    '.xjfile{display:flex!important;align-items:center;gap:10px;text-decoration:none;color:inherit;flex-wrap:wrap}.xjfile .fi{font-size:1.7em}.xjfile .fn{display:flex;flex-direction:column;min-width:0}.xjfile .fn b{word-break:break-all}.xjfile small{opacity:.75;font-size:.78em}' +
    '.xjmore{border:0;background:none;color:var(--muted);font-size:1.2em;line-height:1;padding:0 4px;cursor:pointer;display:block;margin:0 auto 2px}' +
    '.xjview{position:fixed;inset:0;z-index:96;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px}.xjview img{max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px}.xjview .bar{display:flex;gap:10px;margin-top:14px}' +
    '.xjvoice audio{display:block;width:230px;max-width:100%;height:40px}.xjvoice small{display:block;font-size:.74em;opacity:.8;margin-top:2px}.xjm.mine .xjvoice{background:var(--white);color:var(--ink);border-color:var(--line)}' +
    '.xjrec{align-items:center;gap:8px;background:#FDECEC;border-radius:12px;padding:8px 10px;margin-bottom:6px;color:#9B2C2C}.xjrec .dot{flex:none;width:10px;height:10px;border-radius:50%;background:#D23B3B;animation:xjBlink 1s infinite}@keyframes xjBlink{50%{opacity:.25}}' +
    '.xjsw{display:flex;gap:6px;overflow-x:auto;padding:2px 0 12px;margin:0 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none}.xjsw::-webkit-scrollbar{display:none}.xjsw .xjchip{white-space:nowrap;flex:none;padding:6px 12px}.xjsw .xjadd{border-style:dashed;color:var(--head)}' +
    '.xj235s{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.xj235{font-size:.72em;border-radius:999px;padding:1px 8px;background:#FDECEC;color:#9B2C2C;font-weight:600}.xj235.on{background:#E3F0E1;color:#2E6B32}' +
    '.xjdmrow{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--line);cursor:pointer}.xjchathd .xjsm{flex:none}' +
    '.xjcr{padding:12px 14px}.xjchatmode .aic-fab,.xjchatmode .help-fab{display:none!important}' +
    '@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .xjtd{background:#22304A;border-color:#33445F}html:not([data-theme="light"]) .xjft,html:not([data-theme="light"]) .xjt,html:not([data-theme="light"]) .xjsm,html:not([data-theme="light"]) .xjchip,html:not([data-theme="light"]) .xjinp{background:#16243A;color:#E8EEF6}}' +
    'html[data-theme="dark"] .xjtd{background:#22304A;border-color:#33445F}html[data-theme="dark"] .xjft,html[data-theme="dark"] .xjt,html[data-theme="dark"] .xjsm,html[data-theme="dark"] .xjchip,html[data-theme="dark"] .xjinp{background:#16243A;color:#E8EEF6}' +
    '.xjrw{position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,rgba(255,236,170,.96),rgba(18,35,63,.95) 70%);overflow:hidden;padding:20px;animation:xjIn .35s ease-out}' +
    '.xjrw .box{position:relative;z-index:2;max-width:420px;width:100%;text-align:center;color:#fff}.xjrw svg.medal{width:180px;height:180px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.3));animation:xjPop .9s cubic-bezier(.2,1.6,.4,1) both}' +
    '.xjrw .rays{position:absolute;left:50%;top:38%;width:760px;height:760px;margin:-380px 0 0 -380px;z-index:1;background:repeating-conic-gradient(rgba(255,255,255,.16) 0 9deg,transparent 9deg 22deg);border-radius:50%;animation:xjSpin 24s linear infinite;-webkit-mask-image:radial-gradient(circle,#000 25%,transparent 68%);mask-image:radial-gradient(circle,#000 25%,transparent 68%)}' +
    '.xjrw h2{font-family:var(--font-display);font-size:1.45em;margin:10px 0 4px;text-shadow:0 2px 8px rgba(0,0,0,.35);animation:xjUp .6s .35s both}.xjrw .rk{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.4);border-radius:999px;padding:5px 14px;font-weight:700;margin:4px 0 10px;animation:xjUp .6s .5s both}' +
    '.xjrw .cheer{font-size:1.02em;line-height:1.7;margin:4px 0 12px;animation:xjUp .6s .65s both}.xjrw .vs{font-family:var(--font-display);background:rgba(255,255,255,.14);border-radius:14px;padding:12px 14px;line-height:1.8;animation:xjUp .6s .8s both}.xjrw .vs small{display:block;opacity:.85;margin-top:4px}' +
    '.xjrw .wt{font-size:.86em;margin:12px 0 0;opacity:.95;animation:xjUp .6s .95s both}.xjrw .wt span{display:inline-block;background:rgba(255,255,255,.2);border-radius:999px;padding:2px 9px;margin:3px 2px}' +
    '.xjrw .acts{display:flex;gap:10px;margin-top:16px;animation:xjUp .6s 1.1s both}.xjrw .acts .btn{flex:1}.xjrw .btn.ghost{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.6);color:#fff}' +
    '.xjrw i.cf{position:absolute;top:-20px;width:9px;height:14px;border-radius:2px;z-index:3;animation:xjFall linear forwards}' +
    '@keyframes xjIn{from{opacity:0}to{opacity:1}}@keyframes xjPop{0%{transform:scale(.2) rotate(-25deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}@keyframes xjSpin{to{transform:rotate(360deg)}}' +
    '@keyframes xjUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes xjFall{0%{transform:translate3d(0,0,0) rotate(0)}100%{transform:translate3d(var(--dx),110vh,0) rotate(var(--rt))}}' +
    '@keyframes xjGlow{0%,100%{opacity:.55}50%{opacity:1}}.xjrw .glow{animation:xjGlow 1.8s ease-in-out infinite}' +
    '@media (prefers-reduced-motion:reduce){.xjrw,.xjrw *{animation:none!important}.xjrw i.cf{display:none}}';
  document.head.appendChild(st);

  /* 宿主（教會生活）完成一課時呼叫：記到每個小家的「今天完成」，不另外放獎勵動畫 */
  function autoDone(cb) {
    var d = today(); if (!DAYS[d]) { DAYS[d] = now(); saveDays(); }
    if (!GL.length) { if (cb) cb(); return; }
    shareAll(true);
    var left = GL.length;
    for (var i = 0; i < GL.length; i++) (function (g) {
      api(CHAT, 'POST', '/c/' + g.code + '/done', { dev: dev(), nick: nick(), day: d, hide: g.hideName ? 1 : 0 }, function (j) {
        if (j && X && g.code === X.code) { TD.list = j.list; TD.day = d; TD.at = now(); }
        g.doneDay = d; save();
        if (--left === 0) { if (cb) cb(); var r = route(); if (r === 'xj') rr('xj'); }
      });
    })(GL[i]);
  }
  /* 今天已經完成課程、但某個小家還沒記到（例如剛加入）：補送一次 */
  function autoSync() {
    if (!H.didToday || !H.didToday()) return;
    var d = today(), need = !DAYS[d];
    for (var i = 0; i < GL.length; i++) if (GL[i].doneDay !== d) need = true;
    if (need && !autoSync.busy) { autoSync.busy = 1; autoDone(function () { autoSync.busy = 0; }); }
  }
  function openChat(code, name) {
    if (!CC.alt || CC.alt.code !== code || CC.dm) { CC.alt = { code: code, name: name || code }; CC.dm = null; resetLive(); }
    H.go('xjchat');
  }
  function setAlt(code, name) { if (!CC.alt || CC.alt.code !== code) { CC.alt = { code: code, name: name || code }; CC.dm = null; resetLive(); } }
  window.XJ321 = { finish: finish, autoDone: autoDone, autoSync: autoSync, openChat: openChat,
    dm: function (code, name, who, nk) { setAlt(code, name); dmOpen(who, nk); },
    inbox: function (code, name) { setAlt(code, name); dmInbox(); }, shareNow: function () { shareAll(true); },
    api: function (m, path, body, cb) { api(CHAT, m, path, body, cb); }, dev: dev, nick: nick,
    open: function (c) { if (c && findGroup(c)) { CUR = c; pick(); NW.at = 0; NW.f = ''; resetLive(); save(); } JN.adding = c === '+' ? 1 : 0; H.go('xj'); }, state: function () { return X; }, groups: function () { return GL; }, unread: function () { return CC.unread; }, go: function () { H.go('xj'); } };
  /* 已經停在小家相關頁（重新載入）就重畫一次 */
  var r0 = route(); if (r0 === 'xj' || r0 === 'xjchat' || r0 === 'xjcare' || r0 === 'home' || r0 === 'connect') { try { H.render(r0); } catch (e) { } }
})();
