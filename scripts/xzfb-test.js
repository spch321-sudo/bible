#!/usr/bin/env node
/* 小智備援網址測試（v2.75.1）：用假的 fetch 驗證 xzfb.js。
   用法：node scripts/xzfb-test.js   （不需要瀏覽器） */
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'xzfb.js'), 'utf8');
const P = 'https://xiaozhi-proxy.spch321.workers.dev', B = 'https://xz.example.com';
let bad = 0; const ck = (ok, name, extra) => { console.log((ok ? '✓ ' : '✗ ') + name + (extra ? '  ' + extra : '')); if (!ok) bad++; };

function make(backups, behave) {
  const store = {}; const calls = [];
  const win = { fetch: (u, i) => { calls.push(u); return behave(u, i); } };
  win.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  if (backups) store.xzfb_backups = JSON.stringify(backups);
  const ctx = { window: win, localStorage: win.localStorage, JSON, Promise, String, Object, Array, Date, Error, setTimeout };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { win, calls, store };
}
const ok = () => Promise.resolve({ status: 200, ok: true });
const post = { method: 'POST', body: '{}' };

(async () => {
  /* ① 沒設備援：完全照舊（只呼叫一次、原網址） */
  let t = make(null, () => ok()); await t.win.fetch(P, post);
  ck(t.calls.length === 1 && t.calls[0] === P, '沒設備援網址：照舊直送主網址');

  /* ② 非 POST 或別的網址：不碰 */
  t = make([B], () => ok()); await t.win.fetch('https://example.com/x', post); await t.win.fetch(P, { method: 'GET' });
  ck(t.calls.length === 2 && t.calls[0] === 'https://example.com/x', '別的網址／GET 不被改動');

  /* ③ 主網址網路失敗 → 改用備援，並記住 */
  t = make([B], u => u.indexOf('workers.dev') > -1 ? Promise.reject(new TypeError('Failed to fetch')) : ok());
  let r = await t.win.fetch(P, post);
  ck(r.status === 200 && t.calls.join() === P + ',' + B, '主網址連不上 → 自動改用備援', t.calls.join(' → '));
  t.calls.length = 0; await t.win.fetch(P, post);
  ck(t.calls[0] === B && t.calls.length === 1, '記住備援：下一次直接走備援');

  /* ④ 502/522 視為連不上；500 不換 */
  t = make([B], u => u === P ? Promise.resolve({ status: 522 }) : ok());
  r = await t.win.fetch(P, post); ck(r.status === 200 && t.calls.length === 2, '522 → 換備援');
  t = make([B], u => u === P ? Promise.resolve({ status: 500 }) : ok());
  r = await t.win.fetch(P, post); ck(r.status === 500 && t.calls.length === 1, '500（模型／程式錯誤）不換網址');

  /* ⑤ 備援路徑與查詢字串保留 */
  t = make([B], u => u === P + '/v1/x?a=1' ? Promise.reject(new TypeError('x')) : ok());
  await t.win.fetch(P + '/v1/x?a=1', post);
  ck(t.calls[1] === B + '/v1/x?a=1', '路徑與查詢字串保留', t.calls[1]);

  /* ⑥ 全部失敗 → 回丟最後的錯誤 */
  t = make([B], () => Promise.reject(new TypeError('down')));
  let thrown = null; try { await t.win.fetch(P, post); } catch (e) { thrown = e; }
  ck(thrown && thrown.message === 'down' && t.calls.length === 2, '全部失敗 → 照常丟錯（兩個都試過）');

  /* ⑦ 使用者取消：不換網址 */
  const ac = { aborted: true };
  t = make([B], () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  thrown = null; try { await t.win.fetch(P, { method: 'POST', body: '{}', signal: ac }); } catch (e) { thrown = e; }
  ck(thrown && thrown.name === 'AbortError' && t.calls.length === 1, '使用者取消 → 不重試');

  /* ⑧ 非 https 備援被忽略 */
  t = make(['http://evil.example.com', 'javascript:1'], () => Promise.reject(new TypeError('down')));
  thrown = null; try { await t.win.fetch(P, post); } catch (e) { thrown = e; }
  ck(t.calls.length === 1, '非 https 備援網址被忽略');

  /* ⑨ 過期的記憶不採用 */
  t = make([B], () => ok()); t.store.xzfb_v1 = JSON.stringify({ u: B, t: Date.now() - 25 * 3600 * 1000 });
  await t.win.fetch(P, post); ck(t.calls[0] === P, '超過 24 小時的記憶不採用，回到主網址優先');

  console.log(bad ? '\n✗ 有 ' + bad + ' 項失敗' : '\n全部通過'); process.exit(bad ? 1 : 0);
})();
