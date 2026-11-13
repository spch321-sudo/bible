/* ═══════════════════════════════════════════════════════════════════
   xzkey.js v1 — 321 小智「用自己的免費額度」通用模組（ES5，無相依）

   使用者在自己的手機貼上自己的 Google Gemini API 金鑰（aistudio.google.com 免費申請），
   小智就改由手機直接問 Google，用的是他自己的免費額度；沒設定時一切照舊走國度共用的 xiaozhi-proxy。

   做法：包住 window.fetch。凡是 POST 到 xiaozhi-proxy 的請求
     {system, messages:[{role,content}], max_tokens?}
   在「我的金鑰」模式下改送 Gemini generateContent，再把回覆包成 Anthropic 格式
     {content:[{type:'text',text}], stop_reason}
   回給宿主——所以任何 321 App 只要載入本檔，原本的程式一行都不用改。

   · 金鑰只存在這支手機的 localStorage（key：xzkey_v1）。所有 321 App 都在 spch321-sudo.github.io
     同一個網域，設定一次，其他也載入本檔的 App 會一起生效。
   · 額度用完（429）、金鑰失效、Google 出錯時，預設自動改用國度共用小智，並提醒一次。
   · 打開設定：XZKEY.open()；查狀態：XZKEY.status()
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  if (window.XZKEY) return;
  var CK = 'xzkey_v1';
  var PROXY = /xiaozhi-proxy\.spch321\.workers\.dev/;
  var GAPI = 'https://generativelanguage.googleapis.com/v1beta/';
  var KEY_URL = 'https://aistudio.google.com/apikey';
  /* 依序挑第一個「這把金鑰真的能用」的模型（免費方案能用哪些，Google 會調整，所以不寫死） */
  var PREF = [/^gemini-3\.5-flash$/, /^gemini-3\.5-flash-lite$/, /^gemini-3\.1-flash-lite$/, /^gemini-3-flash/, /^gemini-2\.5-flash$/, /^gemini-2\.5-flash-lite$/, /^gemma-4/, /^gemini-[\d.]+-flash/];
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  var warned = {};

  /* ── 設定存取 ── */
  function cfg() { try { return JSON.parse(localStorage.getItem(CK) || '{}') || {}; } catch (e) { return {}; } }
  function put(o) { try { localStorage.setItem(CK, JSON.stringify(o)); } catch (e) { } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function active() { var c = cfg(); return !!(c.on && c.key && c.model && c.quotaDay !== today()); }
  function bump() { var c = cfg(), t = today(); if (c.day !== t) { c.day = t; c.n = 0; } c.n = (c.n || 0) + 1; put(c); }

  /* ── 語言 ── */
  function lang() {
    try { var h = window.XZKEY_HOST; if (h && h.lang) return h.lang(); } catch (e) { }
    try { if (typeof state !== 'undefined' && state && state.lang) return state.lang === 'zh' ? 'zh' : state.lang === 'zs' ? 'zs' : 'en'; } catch (e) { }
    try { if (typeof S !== 'undefined' && S && S.set && S.set.lang) return S.set.lang; } catch (e) { }
    var n = (document.documentElement.lang || navigator.language || '').toLowerCase();
    return /^zh/.test(n) ? (/hans|cn|sg/.test(n) ? 'zs' : 'zh') : 'en';
  }
  var TX = {
    zh: {
      title: '🔑 小智：用自己的免費額度', now: '目前使用', shared: '☁️ 國度共用小智', mine: '🔑 我自己的 Google 金鑰',
      sharedD: '不用設定，打開就能用。費用由國度負擔。', mineD: '用你自己 Google 帳號的免費額度，國度不用付費。',
      today: '今天用自己的額度問了 {0} 次', model: '模型：{0}', quotaOut: '今天的免費額度用完了，明天會自動恢復',
      keyL: '貼上你的 API 金鑰', keyPh: '以 AIza 開頭的一長串', show: '顯示', hide: '隱藏',
      test: '測試並儲存', testing: '正在測試金鑰…', ok: '成功！小智改用你自己的免費額度（{0}）', del: '刪除金鑰',
      delQ: '確定要刪除這支手機上的金鑰嗎？', deleted: '已刪除，小智改回國度共用',
      fb: '我的額度用完或出錯時，自動改用國度共用小智', noKey: '請先貼上金鑰',
      bad: '金鑰不正確，請確認有完整複製（以 AIza 開頭）', noModel: '這把金鑰目前沒有可用的免費模型，請稍後再試',
      net: '連不上 Google，請檢查網路後再試', e429: '這把金鑰的免費額度暫時用完了，請稍後或明天再試',
      privT: '⚠️ 隱私提醒', priv: 'Google 免費方案會用你送出的內容來改善它的產品。請不要在小智裡寫別人的真實姓名、病情、家中私事等個資；需要時請用國度共用小智，或使用匿名模式。',
      howT: '📖 怎麼申請（約 3 分鐘，免費）',
      how: ['用手機或電腦打開下面的「申請金鑰」，用你的 Google（Gmail）帳號登入。', '第一次使用會請你同意服務條款，勾選後按「繼續」。', '按「Create API key」（建立 API 金鑰），若問專案就選預設的那一個。', '出現一長串以 AIza 開頭的金鑰，按右邊的複製圖示。', '回到這裡貼上，按「測試並儲存」。看到「成功」就完成了！'],
      open: '↗ 申請金鑰（Google AI Studio）', note: '金鑰只存在這支手機，不會上傳給國度。換手機要重新貼一次。同一支手機上的其他 321 App 也會一起使用。',
      close: '關閉', fbToast: '你的免費額度今天用完了，小智先改用國度共用的', errToast: '你的金鑰暫時不能用，小智先改用國度共用的',
      safety: '這個問題被 Google 擋下來了，請換個說法再問'
    },
    zs: {
      title: '🔑 小智：用自己的免费额度', now: '目前使用', shared: '☁️ 国度共用小智', mine: '🔑 我自己的 Google 密钥',
      sharedD: '不用设定，打开就能用。费用由国度负担。', mineD: '用你自己 Google 账号的免费额度，国度不用付费。',
      today: '今天用自己的额度问了 {0} 次', model: '模型：{0}', quotaOut: '今天的免费额度用完了，明天会自动恢复',
      keyL: '贴上你的 API 密钥', keyPh: '以 AIza 开头的一长串', show: '显示', hide: '隐藏',
      test: '测试并储存', testing: '正在测试密钥…', ok: '成功！小智改用你自己的免费额度（{0}）', del: '删除密钥',
      delQ: '确定要删除这支手机上的密钥吗？', deleted: '已删除，小智改回国度共用',
      fb: '我的额度用完或出错时，自动改用国度共用小智', noKey: '请先贴上密钥',
      bad: '密钥不正确，请确认有完整复制（以 AIza 开头）', noModel: '这把密钥目前没有可用的免费模型，请稍后再试',
      net: '连不上 Google，请检查网路后再试', e429: '这把密钥的免费额度暂时用完了，请稍后或明天再试',
      privT: '⚠️ 隐私提醒', priv: 'Google 免费方案会用你送出的内容来改善它的产品。请不要在小智里写别人的真实姓名、病情、家中私事等个资；需要时请用国度共用小智，或使用匿名模式。',
      howT: '📖 怎么申请（约 3 分钟，免费）',
      how: ['用手机或电脑打开下面的「申请密钥」，用你的 Google（Gmail）账号登入。', '第一次使用会请你同意服务条款，勾选后按「继续」。', '按「Create API key」（建立 API 密钥），若问专案就选预设的那一个。', '出现一长串以 AIza 开头的密钥，按右边的复制图示。', '回到这里贴上，按「测试并储存」。看到「成功」就完成了！'],
      open: '↗ 申请密钥（Google AI Studio）', note: '密钥只存在这支手机，不会上传给国度。换手机要重新贴一次。同一支手机上的其他 321 App 也会一起使用。',
      close: '关闭', fbToast: '你的免费额度今天用完了，小智先改用国度共用的', errToast: '你的密钥暂时不能用，小智先改用国度共用的',
      safety: '这个问题被 Google 挡下来了，请换个说法再问'
    },
    en: {
      title: '🔑 Xiaozhi: use my own free quota', now: 'Now using', shared: '☁️ Kingdom-shared Xiaozhi', mine: '🔑 My own Google key',
      sharedD: 'Nothing to set up. Kingdom 321 covers the cost.', mineD: 'Uses the free quota of your own Google account, at no cost to Kingdom 321.',
      today: 'Asked {0} times on my own quota today', model: 'Model: {0}', quotaOut: 'Today’s free quota is used up; it resets tomorrow',
      keyL: 'Paste your API key', keyPh: 'A long string starting with AIza', show: 'Show', hide: 'Hide',
      test: 'Test & save', testing: 'Testing the key…', ok: 'Done! Xiaozhi now uses your own free quota ({0})', del: 'Delete key',
      delQ: 'Delete the key from this phone?', deleted: 'Deleted. Xiaozhi is back to the Kingdom-shared one',
      fb: 'If my quota runs out or fails, switch to the Kingdom-shared Xiaozhi', noKey: 'Please paste a key first',
      bad: 'The key is not valid. Check you copied all of it (starts with AIza)', noModel: 'No free model is available for this key right now. Try again later',
      net: 'Can’t reach Google. Check your connection and try again', e429: 'This key’s free quota is used up for now. Try later or tomorrow',
      privT: '⚠️ Privacy', priv: 'Google’s free tier uses what you send to improve its products. Don’t type other people’s real names, health issues or family matters into Xiaozhi; for those, use the Kingdom-shared Xiaozhi or anonymous mode.',
      howT: '📖 How to get a key (about 3 minutes, free)',
      how: ['Open “Get a key” below and sign in with your Google (Gmail) account.', 'The first time, accept the terms and tap Continue.', 'Tap “Create API key”. If it asks for a project, pick the default one.', 'Copy the long key that starts with AIza.', 'Come back, paste it here and tap “Test & save”. When you see “Done”, you’re set!'],
      open: '↗ Get a key (Google AI Studio)', note: 'The key stays on this phone and is never sent to Kingdom 321. On a new phone, paste it again. Other 321 apps on this phone use it too.',
      close: 'Close', fbToast: 'Your free quota is used up today, so Xiaozhi is using the Kingdom-shared one', errToast: 'Your key isn’t working right now, so Xiaozhi is using the Kingdom-shared one',
      safety: 'Google blocked this question. Please try rewording it'
    }
  };
  function T(k, a) { var L = TX[lang()] || TX.en, s = L[k] != null ? L[k] : TX.en[k]; return a == null ? s : String(s).replace('{0}', a); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(m) {
    try { if (typeof toast === 'function') return toast(m, 4000); } catch (e) { }
    try { if (window.GXA && GXA.toast) return GXA.toast(m); } catch (e) { }
    var d = document.createElement('div'); d.className = 'xzk-toast'; d.textContent = m; document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4000);
  }
  function warnOnce(k, m) { var t = today() + k; if (warned[t]) return; warned[t] = 1; say(m); }

  /* ── Anthropic 格式 → Gemini 格式 ── */
  function parts(c) {
    if (typeof c === 'string') return [{ text: c }];
    var out = [], i, b;
    for (i = 0; c && i < c.length; i++) {
      b = c[i]; if (!b) continue;
      if (typeof b === 'string') out.push({ text: b });
      else if (b.type === 'text' && b.text) out.push({ text: b.text });
      else if (b.type === 'image' && b.source && b.source.data) out.push({ inline_data: { mime_type: b.source.media_type || 'image/jpeg', data: b.source.data } });
    }
    return out.length ? out : [{ text: ' ' }];
  }
  function sysText(s) {
    if (!s) return '';
    if (typeof s === 'string') return s;
    var a = [], i; for (i = 0; i < s.length; i++) if (s[i] && s[i].text) a.push(s[i].text);
    return a.join('\n\n');
  }
  function toGemini(b) {
    var cs = [], ms = b.messages || [], i, r, p;
    for (i = 0; i < ms.length; i++) {
      r = ms[i].role === 'assistant' ? 'model' : 'user'; p = parts(ms[i].content);
      if (cs.length && cs[cs.length - 1].role === r) cs[cs.length - 1].parts = cs[cs.length - 1].parts.concat(p);
      else cs.push({ role: r, parts: p });
    }
    if (!cs.length || cs[0].role !== 'user') cs.unshift({ role: 'user', parts: [{ text: '…' }] });
    var g = { contents: cs, generationConfig: { maxOutputTokens: Math.max(+b.max_tokens || 0, 8192) } };
    var s = sysText(b.system); if (s) g.systemInstruction = { parts: [{ text: s }] };
    if (b.temperature != null) g.generationConfig.temperature = b.temperature;
    return g;
  }
  function textOf(d) {
    var c = d && d.candidates && d.candidates[0], ps = c && c.content && c.content.parts, a = [], i;
    for (i = 0; ps && i < ps.length; i++) if (ps[i].text && !ps[i].thought) a.push(ps[i].text);
    return a.join('').replace(/<\|?channel\|?>thought[\s\S]*?<\|?channel\|?>/g, '').replace(/^\s+/, '');
  }

  function gcall(key, model, body, signal) {
    return origFetch(GAPI + 'models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body), signal: signal
    });
  }
  function anthropicResp(text, fin, model) {
    var stop = fin === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn';
    return new Response(JSON.stringify({ type: 'message', role: 'assistant', model: model, content: [{ type: 'text', text: text }], stop_reason: stop, via: 'xzkey' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  /* ── 包住 fetch ── */
  function wrapped(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!origFetch || !PROXY.test(url) || !active() || !init || String(init.method || 'GET').toUpperCase() !== 'POST' || typeof init.body !== 'string') return origFetch(input, init);
    var b; try { b = JSON.parse(init.body); } catch (e) { return origFetch(input, init); }
    if (!b || !b.messages || b.stream) return origFetch(input, init);
    var c = cfg(), fb = c.fb !== false;
    var back = function (kind, status) {
      if (fb) { warnOnce(kind, T(kind === 'quota' ? 'fbToast' : 'errToast')); return origFetch(input, init); }
      return new Response(JSON.stringify({ error: kind }), { status: status || 502, headers: { 'Content-Type': 'application/json' } });
    };
    return gcall(c.key, c.model, toGemini(b), init.signal).then(function (r) {
      if (r.status === 429) { var x = cfg(); x.quotaDay = today(); put(x); return back('quota', 429); }
      if (!r.ok) { c.lastErr = r.status; put(c); return back('err', r.status); }
      return r.json().then(function (d) {
        var fin = d && d.candidates && d.candidates[0] && d.candidates[0].finishReason, t = textOf(d);
        if (!t) {
          if ((d && d.promptFeedback && d.promptFeedback.blockReason) || fin === 'SAFETY') { if (!fb) say(T('safety')); return back('err', 400); }
          return back('err', 502);
        }
        bump(); return anthropicResp(t, fin, c.model);
      });
    }, function (e) {
      if (e && e.name === 'AbortError') throw e;
      return back('err', 0);
    });
  }
  if (origFetch) window.fetch = wrapped;

  /* ── 測試金鑰、挑模型 ── */
  function listModels(key) {
    return origFetch(GAPI + 'models?pageSize=200', { headers: { 'x-goog-api-key': key } }).then(function (r) {
      if (r.status === 400 || r.status === 401 || r.status === 403) throw { code: 'bad' };
      if (!r.ok) throw { code: 'net' };
      return r.json();
    }, function () { throw { code: 'net' }; }).then(function (d) {
      var ms = (d && d.models) || [], names = [], i, n;
      for (i = 0; i < ms.length; i++) {
        n = String(ms[i].name || '').replace(/^models\//, '');
        if ((ms[i].supportedGenerationMethods || []).indexOf('generateContent') > -1 && !/image|tts|audio|live|embedding|robotics|computer|preview-tts/.test(n)) names.push(n);
      }
      var out = [], p, j;
      for (p = 0; p < PREF.length; p++) for (j = 0; j < names.length; j++) if (PREF[p].test(names[j]) && out.indexOf(names[j]) < 0) out.push(names[j]);
      return out;
    });
  }
  function tryModels(key, list, i) {
    if (i >= list.length) return Promise.reject({ code: list.length ? 'e429' : 'noModel' });
    return gcall(key, list[i], { contents: [{ role: 'user', parts: [{ text: '請只回答「好」' }] }], generationConfig: { maxOutputTokens: 256 } }).then(function (r) {
      if (r.ok) return list[i];
      if (r.status === 400 || r.status === 403) { return r.json().then(function (d) { var m = JSON.stringify(d || ''); if (/API_KEY_INVALID|API key not valid/i.test(m)) throw { code: 'bad' }; return tryModels(key, list, i + 1); }, function () { return tryModels(key, list, i + 1); }); }
      return tryModels(key, list, i + 1);
    }, function () { throw { code: 'net' }; });
  }
  function setup(key) {
    key = String(key || '').replace(/\s+/g, '');
    if (!key) return Promise.reject({ code: 'noKey' });
    return listModels(key).then(function (list) { return tryModels(key, list, 0); }).then(function (m) {
      var c = cfg(); c.key = key; c.model = m; c.on = true; delete c.quotaDay; delete c.lastErr; if (c.fb == null) c.fb = true; put(c); return m;
    });
  }

  /* ── 設定面板 ── */
  function css() {
    if (document.getElementById('xzkcss')) return;
    var s = document.createElement('style'); s.id = 'xzkcss';
    s.textContent =
      '.xzk-mask{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.xzk-card{background:var(--bg,#fffdf8);color:var(--ink,#222);width:100%;max-width:640px;max-height:92vh;max-height:92dvh;overflow:auto;-webkit-overflow-scrolling:touch;border-radius:18px 18px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));box-sizing:border-box;font-size:17px;line-height:1.65}' +
      '.xzk-card h3{margin:0 0 12px;font-size:1.2em}.xzk-card h4{margin:18px 0 6px;font-size:1.02em}' +
      '.xzk-st{background:rgba(201,162,39,.12);border-radius:12px;padding:10px 12px;margin-bottom:12px}.xzk-st b{display:block}.xzk-st small{display:block;opacity:.75;font-size:.85em}' +
      '.xzk-mode{display:flex;flex-direction:column;gap:8px}.xzk-mode button{text-align:left;border:2px solid rgba(0,0,0,.12);background:transparent;color:inherit;border-radius:12px;padding:10px 12px;font:inherit;min-height:56px;cursor:pointer}' +
      '.xzk-mode button.on{border-color:#C9A227;background:rgba(201,162,39,.14)}.xzk-mode button small{display:block;opacity:.7;font-size:.82em}' +
      '.xzk-row{display:flex;gap:8px;margin-top:6px}.xzk-row input{flex:1;min-width:0;font:inherit;font-size:16px;padding:12px;border:1px solid rgba(0,0,0,.2);border-radius:10px;background:#fff;color:#222}' +
      '.xzk-btn{font:inherit;border:0;border-radius:12px;padding:12px 16px;min-height:52px;background:#2B4C7E;color:#fff;font-weight:700;cursor:pointer}.xzk-btn.lt{background:rgba(0,0,0,.08);color:inherit;font-weight:600}.xzk-btn.gd{background:#C9A227;color:#222}.xzk-btn.rd{background:transparent;color:#b3261e;border:1px solid #b3261e}' +
      '.xzk-btn:disabled{opacity:.55}.xzk-wide{display:block;width:100%;margin-top:10px;text-align:center;text-decoration:none;box-sizing:border-box}' +
      '.xzk-ck{display:flex;gap:10px;align-items:flex-start;margin-top:12px;font-size:.92em}.xzk-ck input{width:24px;height:24px;flex:0 0 auto;margin-top:2px}' +
      '.xzk-msg{margin-top:8px;font-size:.92em;min-height:1.4em}.xzk-msg.ok{color:#1b7a3a}.xzk-msg.er{color:#b3261e}' +
      '.xzk-priv{background:rgba(179,38,30,.08);border-left:4px solid #b3261e;border-radius:8px;padding:8px 12px;font-size:.9em}' +
      '.xzk-how{margin:0;padding-left:1.4em}.xzk-how li{margin:4px 0}.xzk-note{font-size:.82em;opacity:.7;margin-top:10px}' +
      '.xzk-toast{position:fixed;left:50%;bottom:calc(90px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483001;background:rgba(30,30,30,.92);color:#fff;padding:10px 16px;border-radius:12px;font-size:15px;max-width:86vw;text-align:center}';
    document.head.appendChild(s);
  }
  function statusLine() {
    var c = cfg();
    if (!c.key) return '<b>' + esc(T('shared')) + '</b>';
    var h = '<b>' + esc(c.on ? T('mine') : T('shared')) + '</b>';
    if (c.on && c.model) h += '<small>' + esc(T('model', c.model)) + '</small>';
    if (c.on && c.day === today()) h += '<small>' + esc(T('today', c.n || 0)) + '</small>';
    if (c.on && c.quotaDay === today()) h += '<small>' + esc(T('quotaOut')) + '</small>';
    return h;
  }
  function open() {
    css(); close();
    var c = cfg(), L = TX[lang()] || TX.en, i, how = '';
    for (i = 0; i < L.how.length; i++) how += '<li>' + esc(L.how[i]) + '</li>';
    var m = document.createElement('div'); m.className = 'xzk-mask'; m.id = 'xzkmask';
    m.innerHTML = '<div class="xzk-card" role="dialog" aria-modal="true">' +
      '<h3>' + esc(T('title')) + '</h3>' +
      '<div class="xzk-st"><small>' + esc(T('now')) + '</small><div id="xzkst">' + statusLine() + '</div></div>' +
      '<div class="xzk-mode"><button data-m="0" class="' + (c.on && c.key ? '' : 'on') + '">' + esc(T('shared')) + '<small>' + esc(T('sharedD')) + '</small></button>' +
      '<button data-m="1" class="' + (c.on && c.key ? 'on' : '') + '">' + esc(T('mine')) + '<small>' + esc(T('mineD')) + '</small></button></div>' +
      '<h4>' + esc(T('keyL')) + '</h4>' +
      '<div class="xzk-row"><input id="xzkin" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="' + esc(T('keyPh')) + '" value="' + esc(c.key || '') + '"><button class="xzk-btn lt" id="xzkeye">' + esc(T('show')) + '</button></div>' +
      '<button class="xzk-btn xzk-wide" id="xzktest">' + esc(T('test')) + '</button>' +
      '<div class="xzk-msg" id="xzkmsg"></div>' +
      '<label class="xzk-ck"><input type="checkbox" id="xzkfb"' + (c.fb !== false ? ' checked' : '') + '><span>' + esc(T('fb')) + '</span></label>' +
      '<h4>' + esc(T('privT')) + '</h4><div class="xzk-priv">' + esc(T('priv')) + '</div>' +
      '<h4>' + esc(T('howT')) + '</h4><ol class="xzk-how">' + how + '</ol>' +
      '<a class="xzk-btn gd xzk-wide" href="' + KEY_URL + '" target="_blank" rel="noopener">' + esc(T('open')) + '</a>' +
      '<div class="xzk-note">' + esc(T('note')) + '</div>' +
      (c.key ? '<button class="xzk-btn rd xzk-wide" id="xzkdel">' + esc(T('del')) + '</button>' : '') +
      '<button class="xzk-btn lt xzk-wide" id="xzkclose">' + esc(T('close')) + '</button></div>';
    document.body.appendChild(m);
    var $ = function (id) { return document.getElementById(id); };
    var msg = function (t, k) { var e = $('xzkmsg'); e.textContent = t || ''; e.className = 'xzk-msg' + (k ? ' ' + k : ''); };
    var refresh = function () { var c2 = cfg(), bs = m.querySelectorAll('.xzk-mode button'); $('xzkst').innerHTML = statusLine(); bs[0].className = c2.on && c2.key ? '' : 'on'; bs[1].className = c2.on && c2.key ? 'on' : ''; fire(); };
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    $('xzkclose').onclick = close;
    $('xzkeye').onclick = function () { var x = $('xzkin'); x.type = x.type === 'password' ? 'text' : 'password'; this.textContent = T(x.type === 'password' ? 'show' : 'hide'); };
    $('xzkfb').onchange = function () { var c2 = cfg(); c2.fb = !!this.checked; put(c2); };
    var bs = m.querySelectorAll('.xzk-mode button');
    bs[0].onclick = function () { var c2 = cfg(); c2.on = false; put(c2); refresh(); msg(''); };
    bs[1].onclick = function () { var c2 = cfg(); if (c2.key && c2.model) { c2.on = true; put(c2); refresh(); msg(''); } else { $('xzkin').focus(); msg(T('noKey'), 'er'); } };
    $('xzktest').onclick = function () {
      var btn = this; btn.disabled = true; msg(T('testing'));
      setup($('xzkin').value).then(function (model) { msg(T('ok', model), 'ok'); refresh(); },
        function (e) { msg(T((e && e.code) || 'net'), 'er'); }).then(function () { btn.disabled = false; });
    };
    if ($('xzkdel')) $('xzkdel').onclick = function () { if (!confirm(T('delQ'))) return; var c2 = cfg(); delete c2.key; delete c2.model; c2.on = false; put(c2); say(T('deleted')); close(); fire(); };
  }
  function close() { var m = document.getElementById('xzkmask'); if (m && m.parentNode) m.parentNode.removeChild(m); }
  function fire() { try { window.dispatchEvent(new Event('xzkey')); } catch (e) { } }
  function label() { var c = cfg(); return c.on && c.key ? T('mine') + ' ✓' : T('shared'); }

  window.XZKEY = { open: open, close: close, active: active, label: label, setup: setup,
    status: function () { var c = cfg(); return { on: !!c.on, hasKey: !!c.key, model: c.model || '', today: c.day === today() ? (c.n || 0) : 0, quotaOut: c.quotaDay === today(), fallback: c.fb !== false }; },
    _toGemini: toGemini, _textOf: textOf };
})();
