/* 小智回答「雙語並讀」：每一句下面接著第二語言的翻譯（來源 xzpar v1）
   宿主可設 window.XZPAR_HOST={on:fn→第二語言碼或'',ep,model}；沒設就用全域 parOn()/SVC */
(function () {
  'use strict';
  var NAME = { zh: '正體中文（繁體）', zs: '简体中文', en: 'English', ko: '한국어 (Korean)' };
  var CK = 'xzpar_v1', MAXC = 60, busy = {}, timer = 0;
  function H() { return window.XZPAR_HOST || {}; }
  function on() { try { var h = H(); if (h.on) return h.on() || ''; if (typeof parOn === 'function') return parOn() || ''; } catch (e) { } return ''; }
  function ep() { var h = H(); try { return h.ep || (typeof SVC !== 'undefined' && SVC.xz) || 'https://xiaozhi-proxy.spch321.workers.dev'; } catch (e) { return 'https://xiaozhi-proxy.spch321.workers.dev'; } }
  function model() { var h = H(); try { return h.model || (typeof SVC !== 'undefined' && SVC.model) || 'claude-sonnet-4-6'; } catch (e) { return 'claude-sonnet-4-6'; } }
  function hash(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return String(h); }
  function cget() { try { return JSON.parse(localStorage.getItem(CK) || '{}') || {}; } catch (e) { return {}; } }
  function cset(k, a) {
    try {
      var c = cget(); c[k] = { t: Date.now(), a: a };
      var ks = Object.keys(c);
      if (ks.length > MAXC) { ks.sort(function (x, y) { return c[x].t - c[y].t; }); ks.slice(0, ks.length - MAXC).forEach(function (z) { delete c[z]; }); }
      localStorage.setItem(CK, JSON.stringify(c));
    } catch (e) { }
  }
  function css() {
    if (document.getElementById('xzparcss')) return;
    var s = document.createElement('style'); s.id = 'xzparcss';
    s.textContent = '.xzparS{display:block;margin:1px 0 7px;padding:1px 0 1px 8px;border-left:2px solid #C9A227;font-size:.86em;line-height:1.55;opacity:.78;font-weight:400;font-style:normal}' +
      '.xzparW{display:block;font-size:.76em;opacity:.55;margin:2px 0 4px}';
    document.head.appendChild(s);
  }
  function clear(body) {
    var a = body.querySelectorAll('.xzparS,.xzparW'), i;
    for (i = 0; i < a.length; i++) a[i].parentNode.removeChild(a[i]);
    body.__xzp = '';
  }
  function paint(body, sents, arr, sig) {
    var a = body.querySelectorAll('.xzparS,.xzparW'), i, sp;
    for (i = 0; i < a.length; i++) a[i].parentNode.removeChild(a[i]);
    for (i = 0; i < sents.length; i++) {
      if (!arr[i]) continue;
      sp = document.createElement('span'); sp.className = 'xzparS'; sp.textContent = arr[i];
      sents[i].parentNode.insertBefore(sp, sents[i].nextSibling);
    }
    body.__xzp = sig;
  }
  function parseArr(t, n) {
    var m = /\[[\s\S]*\]/.exec(t || ''), a;
    if (!m) return null;
    try { a = JSON.parse(m[0]); } catch (e) { return null; }
    if (!Array.isArray(a)) return null;
    a = a.map(function (x) { return String(x == null ? '' : x).trim(); });
    if (a.length !== n) return null;
    return a;
  }
  function ask(texts, lang, cb) {
    var sys = 'You are a careful translator for a Christian Bible-study app. Translate each numbered sentence into ' + (H().name ? H().name(lang) : (NAME[lang] || lang)) + '. ' +
      'Keep it faithful, warm and natural; keep Bible book names and verse references; use the standard Bible wording of that language for scripture quotations; keep 321 / 920 / 235 and names as they are. ' +
      'Return ONLY a JSON array of strings with exactly ' + texts.length + ' items, in the same order, one translation per input line. No commentary.';
    var user = texts.map(function (t, i) { return (i + 1) + '. ' + t.replace(/\s+/g, ' '); }).join('\n');
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, tm = ac ? setTimeout(function () { ac.abort(); }, 60000) : 0;
    fetch(ep(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ac ? ac.signal : undefined,
      body: JSON.stringify(H().nomodel ? { system: sys, messages: [{ role: 'user', content: user }] } : { model: model(), max_tokens: 3000, system: sys, messages: [{ role: 'user', content: user }] }) })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function (d) {
        clearTimeout(tm);
        var t = '';
        if (d && d.content && d.content.length) d.content.forEach(function (b) { t += b.text || ''; });
        else if (d) t = d.reply || d.text || d.message || '';
        cb(parseArr(t, texts.length));
      }).catch(function () { clearTimeout(tm); cb(null); });
  }
  function one(body, lang) {
    var sents = [].slice.call(body.querySelectorAll('.sent')).filter(function (s) { return (s.textContent || '').trim(); });
    if (!sents.length) return;
    var texts = sents.map(function (s) { return s.textContent.trim(); });
    var key = lang + ':' + hash(texts.join('\u0001')), sig = key;
    if (body.__xzp === sig && body.querySelector('.xzparS')) return;
    var c = cget()[key];
    if (c && c.a && c.a.length === sents.length) { paint(body, sents, c.a, sig); return; }
    if (busy[key]) return;
    busy[key] = 1;
    var w = document.createElement('span'); w.className = 'xzparW'; w.textContent = '⇄ …';
    body.appendChild(w);
    var parts = [], i, step = 40, res = [], k = 0;
    for (i = 0; i < texts.length; i += step) parts.push(texts.slice(i, i + step));
    (function next() {
      if (k >= parts.length) {
        delete busy[key];
        if (w.parentNode) w.parentNode.removeChild(w);
        cset(key, res);
        if (document.body.contains(body) && on() === lang) { var ss = [].slice.call(body.querySelectorAll('.sent')).filter(function (s) { return (s.textContent || '').trim(); }); if (ss.length === res.length) paint(body, ss, res, sig); }
        return;
      }
      ask(parts[k], lang, function (a) {
        if (!a) { delete busy[key]; if (w.parentNode) w.parentNode.removeChild(w); return; }
        res = res.concat(a); k++; next();
      });
    })();
  }
  function scan() {
    timer = 0;
    var lang = on(), bodies = document.querySelectorAll('.msg.ai .msg-body'), i, b;
    for (i = 0; i < bodies.length; i++) {
      b = bodies[i];
      if (!lang) { if (b.querySelector('.xzparS')) clear(b); continue; }
      if (b.querySelector('.typing') || b.parentNode.classList.contains('wait')) continue;
      one(b, lang);
    }
  }
  function sched() { if (!timer) timer = setTimeout(scan, 700); }
  function init() {
    css();
    try { new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var t = ms[i].target; if (t && t.classList && (t.classList.contains('xzparS') || t.classList.contains('xzparW'))) continue;
        sched(); return;
      }
    }).observe(document.body, { childList: true, subtree: true }); } catch (e) { }
    setInterval(sched, 2500);
    sched();
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
  window.XZPAR = { scan: scan };
})();
