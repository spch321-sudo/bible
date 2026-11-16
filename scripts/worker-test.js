#!/usr/bin/env node
/* 小智 Worker 分流測試（v2.76.0）：用假的上游驗證選模型、白名單、換模型重試。
   用法：node scripts/worker-test.js */
const fs = require('fs'), path = require('path');
let bad = 0; const ck = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra ? '  ' + extra : '')); if (!ok) bad++; };
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'worker', 'xiaozhi-proxy.js'), 'utf8').replace('export default', 'module.exports =');
  const mod = { exports: null }; new Function('module', 'Response', 'fetch', src).call(null, mod, Response, (...a) => globalThis.__f(...a));
  const W = mod.exports;
  const mk = (b, o) => new Request('https://w.test/', { method: 'POST', headers: { Origin: 'https://spch321-sudo.github.io', 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const env = { ANTHROPIC_API_KEY: 'k' };
  const okBody = JSON.stringify({ content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn' });
  let seen = [];
  const run = async (b, e, plan) => { seen = []; globalThis.__f = async (u, i) => { const body = JSON.parse(i.body); seen.push(body); const p = plan[seen.length - 1] || 200; if (p === 'net') throw new Error('net'); return new Response(p === 200 ? okBody : '{"error":"x"}', { status: p }); }; const r = await W.fetch(mk(b), e || env); return { r, models: seen.map(s => s.model), last: seen[0] }; };
  const M = { f: 'claude-haiku-5-5', d: 'claude-sonnet-5-5' };

  let x = await run({ system: 's', messages: [{ role: 'user', content: 'q' }] }, null, []);
  ck(x.models[0] === M.f && x.r.headers.get('X-XZ-Model') === M.f, '沒送 tier → Haiku', x.models.join());
  x = await run({ tier: 'deep', system: 's', messages: [] }, null, []);
  ck(x.models[0] === M.d, 'tier:deep → Sonnet 5.5');
  x = await run({ tier: 'fast', system: 's', messages: [] }, null, []);
  ck(x.models[0] === M.f, 'tier:fast → Haiku');
  x = await run({ system: 's', messages: [] }, { ANTHROPIC_API_KEY: 'k', DEFAULT_TIER: 'deep' }, []);
  ck(x.models[0] === M.d, 'DEFAULT_TIER=deep → 沒送 tier 也走 Sonnet');
  x = await run({ model: 'claude-opus-5-5', system: 's', messages: [] }, null, []);
  ck(x.models[0] === M.f, '白名單外的模型（Opus）被忽略，改依 tier');
  x = await run({ model: 'claude-sonnet-4-6', system: 's', messages: [] }, null, []);
  ck(x.models[0] === 'claude-sonnet-4-6', '白名單內的舊代號照用（相容其他 App）');
  x = await run({ system: 's', messages: [], max_tokens: 99999, tier: 'x', evil: 'y' }, null, []);
  ck(x.last.max_tokens === 1024 && !('evil' in x.last) && !('tier' in x.last), 'max_tokens 上限 1024；多餘欄位不轉給上游');
  ck(x.last.thinking && x.last.thinking.type === 'disabled', '送出時帶 thinking:disabled（避免額度被思考吃光）');
  { const calls = []; globalThis.__f = async (u, i) => { const bd = JSON.parse(i.body); calls.push(bd); return bd.thinking ? new Response('{"error":{"message":"thinking is not supported for this model"}}', { status: 400 }) : new Response(okBody, { status: 200 }); };
    const r = await W.fetch(mk({ system: 's', messages: [] }), env); ck(r.status === 200 && calls.length === 2 && !calls[1].thinking, '上游因 thinking 回 400 → 自動拿掉欄位再送一次', calls.length + ' calls'); }

  x = await run({ tier: 'fast', system: 's', messages: [] }, null, [529, 200]);
  ck(x.models.join() === M.f + ',' + M.d && x.r.status === 200 && x.r.headers.get('X-XZ-Fallback') === '1', 'Haiku 529 → 換 Sonnet 成功', x.models.join(' → '));
  x = await run({ tier: 'deep', system: 's', messages: [] }, null, ['net', 200]);
  ck(x.models.join() === M.d + ',' + M.f && x.r.status === 200, 'Sonnet 網路錯誤 → 換 Haiku 成功');
  x = await run({ tier: 'fast', system: 's', messages: [] }, null, [400]);
  ck(x.models.length === 1 && x.r.status === 400, '400（請求本身有問題）不重試');
  x = await run({ tier: 'fast', system: 's', messages: [] }, null, [503, 503]);
  ck(x.models.length === 2 && x.r.status === 503 && x.r.headers.get('X-XZ-Fallback') === '0', '兩個都失敗 → 回第一個的錯誤');
  x = await run({ tier: 'fast', system: 's', messages: [] }, null, ['net', 'net']);
  ck(x.r.status === 502, '兩個都連不上 → 502');
  /* 串流（v2.77） */
  const sseTxt = 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"嗨"}}\n\n';
  const runS = async (b, plan) => { seen = []; globalThis.__f = async (u, i) => { const bd = JSON.parse(i.body); seen.push(bd); const p = plan[seen.length - 1] || 200; if (p === 'net') throw new Error('net'); return p === 200 ? new Response(bd.stream ? sseTxt : okBody, { status: 200, headers: { 'content-type': bd.stream ? 'text/event-stream' : 'application/json' } }) : new Response('{"error":"x"}', { status: p }); }; const r = await W.fetch(mk(b), env); return { r, txt: await r.text() }; };
  x = await runS({ tier: 'fast', stream: true, system: 's', messages: [] }, []);
  ck(x.r.headers.get('content-type').indexOf('text/event-stream') === 0 && x.txt === sseTxt && seen[0].stream === true, 'stream:true → 回 SSE，內容原封不動、上游也要求串流');
  ck(x.r.headers.get('X-XZ-Model') === M.f && x.r.headers.get('Cache-Control') === 'no-store', '串流回應帶模型標頭與 no-store');
  x = await runS({ tier: 'fast', system: 's', messages: [] }, []);
  ck(x.r.headers.get('content-type') === 'application/json' && !('stream' in seen[0]), '沒要 stream → 照舊回 JSON，上游不帶 stream');
  x = await runS({ tier: 'fast', stream: 'yes', system: 's', messages: [] }, []);
  ck(!('stream' in seen[0]), 'stream 不是 true（字串）→ 不當串流');
  x = await runS({ tier: 'fast', stream: true, system: 's', messages: [] }, [529, 200]);
  ck(seen.length === 2 && seen[1].model === M.d && x.txt === sseTxt && x.r.headers.get('X-XZ-Fallback') === '1', '串流時 Haiku 529 → 換 Sonnet 串流成功');
  x = await runS({ tier: 'fast', stream: true, system: 's', messages: [] }, [400]);
  ck(x.r.status === 400 && x.r.headers.get('content-type') === 'application/json', '串流時上游 400 → 回 JSON 錯誤，前端可讀');
  const g = await W.fetch(new Request('https://w.test/', { method: 'GET' }), env); ck(g.status === 405, 'GET → 405');
  const nk = await W.fetch(mk({}), {}); ck(nk.status === 500, '沒設金鑰 → 500');
  console.log(bad ? '\n✗ 有 ' + bad + ' 項失敗' : '\n全部通過'); process.exit(bad ? 1 : 0);
})();
