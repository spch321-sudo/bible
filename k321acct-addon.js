/* 321互動聖經 × 321 共用帳號（ES5 外掛；需要 ../321steward/k321acct.js）
 * ‧「我的」頁加一張「321 共用帳號」卡片
 * ‧ 登入後自動加密備份讀經進度、畫線、收藏、讀經計畫與設定（位置 'bible'），換手機找回
 * ‧ 把讀經進度公開給 321管家（位置 'bible-pub'）：讀過幾章、讀經的日子、最近讀到哪裡、讀經計畫 */
(function(){
 var A=window.K321ACCT;if(!A)return;
 function lang(){try{return state.lang||'zh';}catch(e){return 'zh';}}
 function P(){var l=lang();return l==='zs'?'zs':(l==='zh'?'zh':'en');}
 var TXS={
  zh:{t:'🔑 321 共用帳號',d:'一組帳號碼，所有 321 App 共用：自動加密備份讀經進度、畫線與收藏，換手機找回；讀經進度也會出現在 321管家。',open:'建立或登入 321 帳號',on:'✓ 已登入',last:'上次同步：',never:'尚未同步',sync:'立即同步',acct:'帳號碼與登出',synced:'已同步到 321 帳號',fail:'同步失敗：',ask:'321 帳號裡有你的互動聖經備份（讀過 {n} 章），要下載到這支手機嗎？會取代這支手機上的進度、畫線與收藏。'},
  zs:{t:'🔑 321 共用账号',d:'一组账号码，所有 321 App 共用：自动加密备份读经进度、画线与收藏，换手机找回；读经进度也会出现在 321管家。',open:'建立或登录 321 账号',on:'✓ 已登录',last:'上次同步：',never:'尚未同步',sync:'立即同步',acct:'账号码与登出',synced:'已同步到 321 账号',fail:'同步失败：',ask:'321 账号里有你的互动圣经备份（读过 {n} 章），要下载到这部手机吗？会取代这部手机上的进度、画线与收藏。'},
  en:{t:'🔑 321 Account',d:'One code for every 321 app: encrypted backup of your reading progress, highlights and favourites, restored on a new phone; your progress also appears in the 321 Steward.',open:'Create or sign in to a 321 Account',on:'✓ Signed in',last:'Last sync: ',never:'Not synced yet',sync:'Sync now',acct:'Account code / sign out',synced:'Synced to your 321 Account',fail:'Sync failed: ',ask:'Your 321 Account has an Interactive Bible backup ({n} chapters read). Download it to this phone? It replaces progress, highlights and favourites here.'}
 };
 function X(){return TXS[P()];}
 function note(m){try{if(typeof toast==='function'){toast(m);return;}}catch(e){}}
 function U(){try{return user;}catch(e){return null;}}
 function pad(n){return n<10?'0'+n:''+n;}
 function day(ts){var d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
 function bookName(id){try{for(var i=0;i<TOC.length;i++){var b=TOC[i];if(b.id===id)return {zh:b.zh||b.name||id,zs:b.zs||b.zh||id,en:b.en||id};}}catch(e){}return {zh:id,zs:id,en:id};}
 function summary(){
  var u=U()||{},pr=u.progress||{},k,days={},n=0,from=Date.now()-90*864e5;
  for(k in pr){if(!pr[k])continue;n++;if(typeof pr[k]==='number'&&pr[k]>from)days[day(pr[k])]=1;}
  var dl=[];for(k in days)dl.push(k);dl.sort();
  var last=null;if(u.last&&u.last.book){var bn=bookName(u.last.book);last={book:u.last.book,ch:u.last.ch,zh:bn.zh,zs:bn.zs,en:bn.en};}
  var plan=null;try{if(u.plan&&u.plan.active){var pid=u.plan.active,pd=0,tot=0,nm={zh:pid,zs:pid,en:pid};
   for(k in (u.plan.done||{}))if(u.plan.done[k]&&String(k).indexOf(pid)===0)pd++;
   if(typeof PLANS!=='undefined'&&PLANS&&PLANS[pid]){tot=+PLANS[pid].totalDays||((PLANS[pid].days||[]).length);if(PLANS[pid].title)nm=PLANS[pid].title;}
   plan={id:pid,name:{zh:nm.zh||pid,zs:nm.zs||nm.zh||pid,en:nm.en||pid},done:pd,total:tot};}}catch(e){}
  var hl=0;for(k in (u.hl||{}))hl++;
  return {v:1,at:Date.now(),chapters:n,total:1189,days:dl,last:last,plan:plan,hl:hl,books:(function(){var c=0;for(var r in (u.rewards||{}))c++;return c;})()};
 }
 var busy=false,timer=null;
 function sync(cb){
  if(!A.get()||busy){if(cb)cb('busy');return;}busy=true;
  var raw={};try{raw.ib_user=localStorage.getItem('ib_user');raw.ib_state=localStorage.getItem('ib_state');}catch(e){}
  A.put('bible',{v:1,at:Date.now(),raw:raw},function(e1){A.put('bible-pub',summary(),function(e2){busy=false;paint();if(cb)cb(e1||e2);});});
 }
 function soon(){if(!A.get())return;clearTimeout(timer);timer=setTimeout(function(){sync(null);},45000);}
 if(typeof window.saveUser==='function'){var _su=window.saveUser;window.saveUser=function(){var r=_su.apply(this,arguments);soon();return r;};}
 function restore(){
  A.fetch('bible',function(err,o){
   if(err||!o||!o.raw||!o.raw.ib_user){sync(null);return;}
   var n=0;try{n=Object.keys((JSON.parse(o.raw.ib_user)||{}).progress||{}).length;}catch(e){}
   if(confirm(X().ask.replace('{n}',n))){try{localStorage.setItem('ib_user',o.raw.ib_user);if(o.raw.ib_state)localStorage.setItem('ib_state',o.raw.ib_state);}catch(e){}location.reload();}
   else sync(null);
  });
 }
 function changed(kind){if(kind==='login'){A.syncProfile();restore();}else if(kind==='create'){A.syncProfile();sync(function(e){note(e?X().fail+e:X().synced);});}paint();}
 function open(){A.open({lang:P(),onChange:changed});}
 function html(){
  var a=A.get(),at=Math.max(A.lastAt('bible'),A.lastAt('bible-pub')),t=X();
  return '<div style="font-weight:700;margin-bottom:4px">'+t.t+'</div>'+(a?'<div style="color:#2A8550;font-weight:700">'+t.on+'</div><div class="muted" style="font-size:13px;margin:2px 0 10px">'+(at?t.last+new Date(at).toLocaleString():t.never)+'</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" onclick="K321B.sync()">'+t.sync+'</button><button class="btn ghost" onclick="K321B.open()">'+t.acct+'</button></div>'
   :'<div class="muted" style="font-size:13.5px;line-height:1.7;margin-bottom:10px">'+t.d+'</div><button class="btn block" onclick="K321B.open()">'+t.open+'</button>');
 }
 function paint(){var el=document.getElementById('k321bcard');if(el)el.innerHTML=html();}
 function inject(){
  var dg=document.getElementById('diagBtn');if(!dg||document.getElementById('k321bcard'))return;
  var card=dg.closest?dg.closest('.card'):dg.parentNode;if(!card)return;var title=card.previousElementSibling;
  var d=document.createElement('div');d.className='card';d.id='k321bcard';d.innerHTML=html();
  card.parentNode.insertBefore(d,title&&/section-title/.test(title.className)?title:card);
 }
 window.K321B={sync:function(){sync(function(e){note(e&&e!=='busy'?X().fail+e:X().synced);});},open:open};
 setInterval(inject,800);inject();
 setTimeout(function(){if(!A.get())return;A.syncProfile();if(Date.now()-A.lastAt('bible-pub')>10*60000)sync(null);},4000);
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'&&A.get()&&Date.now()-A.lastAt('bible-pub')>3*60000)sync(null);});
})();
