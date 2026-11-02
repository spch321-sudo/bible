#!/usr/bin/env node
/* 321互動聖經 發佈前自動檢查（node scripts/check.js）。
   檢查：語法、版本號一致、Service Worker 檔案存在、語言包清單一致、語言包結構、經文 JSON 與節數（對照英文骨架，不得比 baseline 更差）。
   --update-baseline：接受目前的缺節數為新的基準（新增語言或補節時使用）。 */
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(root, f), 'utf8');
let fails = 0, warns = 0;
const ok = m => console.log('  ✓ ' + m);
const fail = m => { fails++; console.log('  ✗ ' + m); };
const warn = m => { warns++; console.log('  ! ' + m); };
const section = t => console.log('\n' + t);

/* 1. 語法 */
section('1. 語法檢查');
const jsFiles = fs.readdirSync(root).filter(f => /^(app|sw|qrcode)\.js$|^lang-[a-z]+\.js$/.test(f));
for (const f of jsFiles){
  try{ new vm.Script(R(f), { filename: f }); }catch(e){ fail(f + ' 語法錯誤：' + e.message); }
}
ok(jsFiles.length + ' 個 JS 檔已檢查');
for (const f of ['version.json', 'manifest.json', 'toc.json', 'plans.json']){
  try{ JSON.parse(R(f)); }catch(e){ fail(f + ' 不是有效 JSON：' + e.message); }
}

/* 2. 版本號一致 */
section('2. 版本號一致');
const vApp = (R('app.js').match(/const VERSION = 'v([\d.]+)'/) || [])[1];
const vSw = (R('sw.js').match(/const VER = 'v([\d.]+)'/) || [])[1];
const vSwC = (R('sw.js').match(/const VERSION = 'ib-v([\d.]+)'/) || [])[1];
const vJson = JSON.parse(R('version.json')).v.replace(/^v/, '');
const vIdx = (R('index.html').match(/var V='([\d.]+)'/) || [])[1];
const vals = { 'app.js': vApp, 'sw.js(VER)': vSw, 'sw.js(VERSION)': vSwC, 'version.json': vJson, 'index.html': vIdx };
const uniq = new Set(Object.values(vals));
if (uniq.size === 1 && !uniq.has(undefined)) ok('五處版本號一致：v' + vApp);
else fail('版本號不一致：' + JSON.stringify(vals));
if (!new RegExp('v' + String(vApp).replace(/\./g, '\\.') + '：').test(R('README.md'))) warn('README.md 尚未記載 v' + vApp);

/* 3. Service Worker 預先快取檔案存在 */
section('3. Service Worker 預先快取');
const shell = (R('sw.js').match(/const SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
const files = [...shell.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
const missing = files.filter(f => !fs.existsSync(path.join(root, f)));
missing.length ? fail('SHELL 內的檔案不存在：' + missing.join(', ')) : ok(files.length + ' 個預先快取檔案都存在');

/* 4. 語言包清單一致（app.js PACK_LANGS／index.html 載入器／實際檔案） */
section('4. 語言包清單一致');
const packFiles = fs.readdirSync(root).map(f => (f.match(/^lang-([a-z]+)\.js$/) || [])[1]).filter(l => l && l !== 'pf').sort();
const appSet = [...((R('app.js').match(/const PACK_LANGS = new Set\(\[([^\]]*)\]\)/) || [])[1] || '').matchAll(/'([a-z]+)'/g)].map(m => m[1]).sort();
const idxSet = ((R('index.html').match(/var P='([a-z ]+)'\.split/) || [])[1] || '').split(' ').filter(Boolean).sort();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
same(packFiles, appSet) ? ok('app.js PACK_LANGS 與 lang-*.js 檔案一致（' + packFiles.length + ' 種）') : fail('app.js PACK_LANGS 與檔案不一致：' + JSON.stringify({ files: packFiles, app: appSet }));
same(packFiles, idxSet) ? ok('index.html 載入器清單一致') : fail('index.html 載入器清單不一致：' + JSON.stringify({ files: packFiles, idx: idxSet }));
const attach = new Set([...R('app.js').matchAll(/ATTACH\.([a-z]+) = function/g)].map(m => m[1]));
const noAttach = packFiles.filter(l => !attach.has(l));
noAttach.length ? fail('缺少 ATTACH 區塊：' + noAttach.join(', ')) : ok('每個語言包都有對應的 ATTACH');
const btn = R('index.html');
const noBtn = packFiles.filter(l => !new RegExp('data-lang="' + l + '"').test(btn));
noBtn.length ? fail('index.html 沒有語言按鈕：' + noBtn.join(', ')) : ok('每個語言都有選單按鈕');

/* 5. 語言包結構（對照阿拉伯文包） */
section('5. 語言包結構');
function loadPack(l){
  const w = {}; const ctx = vm.createContext({ window: w, document: {}, console });
  vm.runInContext(R('lang-' + l + '.js'), ctx);
  return w[l.toUpperCase() + '_PACK'];
}
const AR = loadPack('ar');
const refTop = Object.keys(AR.I18N.ar);
for (const l of packFiles){
  const P = loadPack(l); const errs = [];
  if (!P){ fail(l + '：沒有 ' + l.toUpperCase() + '_PACK'); continue; }
  const I = P.I18N && P.I18N[l];
  if (!I){ fail(l + '：缺少 I18N.' + l); continue; }
  const miss = refTop.filter(k => !(k in I)); if (miss.length) errs.push('I18N 缺 ' + miss.length + ' 個鍵（如 ' + miss.slice(0, 3) + '）');
  if (!P.books || Object.keys(P.books).length !== 66) errs.push('books 不是 66 卷');
  if (!P.groups || P.groups.length !== 9) errs.push('groups 不是 9 組');
  if (typeof P.t !== 'function') errs.push('缺 P.t');
  else { try{ if (typeof P.t('x', 'Home') !== 'string') errs.push('P.t 回傳非字串'); }catch(e){ errs.push('P.t 出錯：' + e.message); } }
  errs.length ? fail(l + '：' + errs.join('；')) : null;
}
if (!fails) ok(packFiles.length + ' 個語言包結構正常');

/* 6. 經文 JSON 與節數（對照英文骨架） */
section('6. 經文資料與節數');
const SH = ['law', 'hist', 'poet', 'proph', 'nt'];
function verses(lang){
  const out = {}; // 'Book|ch' -> Set(verse)
  for (const s of SH){
    const f = 'bible.' + lang + '.' + s + '.json';
    if (!fs.existsSync(path.join(root, f))) return null;
    let j; try{ j = JSON.parse(R(f)); }catch(e){ fail(f + ' 不是有效 JSON'); return null; }
    for (const [bk, chs] of Object.entries(j)){
      if (!Array.isArray(chs)) { fail(f + ' ' + bk + ' 結構錯誤'); continue; }
      chs.forEach((blocks, ci) => {
        const set = new Set();
        for (const b of blocks || []){
          if (!Array.isArray(b)) continue;
          if (b[0] === 'p') for (let i = 1; i < b.length; i += 2) set.add(b[i]);
          else if (b[0] === 'q1' || b[0] === 'q2') set.add(b[1]);
        }
        out[bk + '|' + (ci + 1)] = set;
      });
    }
  }
  return out;
}
const en = verses('en');
const langs = [...new Set(fs.readdirSync(root).map(f => (f.match(/^bible\.([a-z]+)\.[a-z]+\.json$/) || [])[1]).filter(Boolean))].sort();
const baseFile = path.join(__dirname, 'verse-baseline.json');
const base = fs.existsSync(baseFile) ? JSON.parse(fs.readFileSync(baseFile, 'utf8')) : {};
const now = {};
for (const l of langs){
  if (l === 'en') continue;
  const v = verses(l); if (!v){ fail(l + '：經文檔不完整'); continue; }
  let miss = 0, chMiss = 0;
  for (const [k, set] of Object.entries(en)){
    const s = v[k]; if (!s){ chMiss++; miss += set.size; continue; }
    for (const x of set) if (!s.has(x)) miss++;
  }
  now[l] = miss;
  const b = base[l];
  if (b === undefined) warn(l + '：缺 ' + miss + ' 節（無 baseline；新語言請執行 --update-baseline）');
  else if (miss > b) fail(l + '：缺節數增加（相對骨架，含詩篇標題） ' + b + ' → ' + miss);
  else if (miss < b) ok(l + '：缺節數減少 ' + b + ' → ' + miss + '（可更新 baseline）');
  if (chMiss) warn(l + '：缺 ' + chMiss + ' 章');
}
if (process.argv.includes('--update-baseline')){ fs.writeFileSync(baseFile, JSON.stringify(now, null, 1) + '\n'); console.log('  已更新 scripts/verse-baseline.json'); }
else if (!fails) ok(langs.length - 1 + ' 種語言的缺節數都不比 baseline 差');

console.log('\n' + (fails ? '失敗：' + fails + ' 項錯誤' : '全部通過') + (warns ? '，' + warns + ' 項提醒' : ''));
process.exit(fails ? 1 : 0);
