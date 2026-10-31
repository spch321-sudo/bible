/* ============================================================================
   321互動聖經 — 和合本．去章節．只留經文
   國度321空中團契 ／ 架構沿用《321領導力》App
   ----------------------------------------------------------------------------
   ⚙ 端點與請求格式：與《321領導力》／《晨讀321》共用同一組 Cloudflare Worker，
      request/response 契約已照 321領導力 app.js 實際使用的格式對齊。
   ========================================================================== */
/* 韓文模式：不管系統提示是哪一種語言，一律要求小智用韓文回答（含經文引用與用語） */
const KO_DIRECTIVE = '\n\nIMPORTANT — LANGUAGE (this overrides any earlier instruction about reply language): write your entire reply in natural, warm, elegant Korean (한국어), using the vocabulary of the Korean Protestant church (하나님, 예수 그리스도, 성령님, 은혜, 구원, 기도). When you quote Scripture, use the wording of the 개역한글 (Korean Revised Version, 1961) and give references with Korean book names, for example 요한복음 3:16. Do not answer in English or Chinese unless the user explicitly asks. Wherever this prompt mentions the reader\'s language, script or Chinese/English wording, it means Korean.';
const JA_DIRECTIVE = '\n\nIMPORTANT — LANGUAGE (this overrides any earlier instruction about reply language): write your entire reply in natural, warm, elegant Japanese (日本語, polite です・ます style), using the vocabulary of the Japanese Protestant church (神, 主イエス・キリスト, 聖霊, 恵み, 救い, 祈り, 福音). When you quote Scripture, use the wording of the 口語訳聖書 (Japanese Colloquial Bible, 1955) and give references with Japanese book names, for example ヨハネによる福音書 3:16. Do not answer in English or Chinese unless the user explicitly asks. Wherever this prompt mentions the reader\'s language, script or Chinese/English wording, it means Japanese.';
const ID_DIRECTIVE = '\n\nIMPORTANT — LANGUAGE (this overrides any earlier instruction about reply language): write your entire reply in natural, warm, elegant Indonesian (Bahasa Indonesia baku yang hangat), using the vocabulary of Indonesian Protestant/Evangelical churches (Allah, Tuhan, TUHAN, Tuhan Yesus, Roh Kudus, Injil, firman Tuhan, pertobatan, anugerah). When you quote Scripture, follow the wording of the Alkitab Yang Terbuka (AYT) / Terjemahan Baru and name books as in AYT (e.g. Yohanes 3:16, Kisah Para Rasul, Wahyu). Keep Xiaozhi as the name of the companion. Everything else in the instructions stays the same.';
const koSys = x => (state.lang === 'id') ? String(x == null ? '' : x) + ID_DIRECTIVE : (state.lang === 'ko') ? String(x == null ? '' : x) + KO_DIRECTIVE : (state.lang === 'ja') ? String(x == null ? '' : x) + JA_DIRECTIVE : x;
const API = {
  chat: 'https://xiaozhi-proxy.spch321.workers.dev',   // {system, messages:[{role,content}]}
  tts : 'https://azure-tts.spch321.workers.dev',       // {voice, rate, sil, silc, sile, text}
  team: 'https://bible-team.spch321.workers.dev'       // 235 團隊同步（見 team-worker.js 的部署說明）
};
const TTS_SIL = 140, TTS_SILC = 140, TTS_SILE = 260, TTS_RATE = '+0%';

/* ── Pexels 免費圖庫的金鑰 ────────────────────────────────────────────
   到 https://www.pexels.com/api/ 免費申請（登入後按 Your API Key 就看得到），
   把那一長串貼進下面的引號裡。留空的話「從免費圖庫選」會提醒你還沒設定。 */
const PEXELS_KEY = 'ofCQ7i2mqaEddrACvvmzdgfrpZ90Z8gVOI9D6vYVf7uxWXCCtzQbj9yR';
const VERSION = 'v2.26.5';
/* v2.11.1 小螢幕補丁：iOS Safari 的 <input type="search">／<textarea> 有自己的預設寬度（約 20 個字），
   放進 flex 一列時最小寬度撐不下去，把旁邊的按鈕（例如搜尋鈕）推到畫面右邊外面看不到——
   外層又設了 overflow-x:hidden，所以只看到被切掉、不能捲。解法是讓這些欄位可以縮到 0（min-width:0、
   flex-basis:0），按鈕不准被擠扁（flex:0 0 auto）；長字串（網址、英文長字）也允許換行。 */
(function(){
  const css = 'input,textarea,select{min-width:0;max-width:100%}'
    + '.searchbar input,.chatinput textarea,.pxbar .cardinput,.pl-guess input,.tmrepbox .cardinput{flex:1 1 0;width:0;min-width:0}'
    + '.searchbar .btn,.chatinput button,.pxbar .btn,.pl-guess .btn,.tmrepbox button{flex:0 0 auto}'
    + 'main#view{min-width:0}'
    /* v2.15.2 設定列：回答對象有 8 顆按鈕，會把左邊的說明文字擠成一字一行；讓整列可換行，按鈕掉到說明下面 */
    + '.setrow{flex-wrap:wrap}.setrow .sl{flex:1 1 7em;min-width:7em}.setrow .segbtns{flex-wrap:wrap}#setAud{flex:1 1 100%}'
    /* v2.11.2 小智回答裡的表格、引言條、小標題、按鈕原本是固定 px，只有正文跟著字級放大；
       改成相對於 .msg 的 em，字級調大時整則回答（含追問鈕與範例問題）一起變大 */
    + '.msg.ai .mdtb{font-size:.93em}.msg.ai blockquote{font-size:.97em}.msg.ai h4,.msg.ai h5,.msg.ai h6{font-size:1.03em}'
    + '.msg.ai .msg-act{font-size:.82em}.msg .fu-t{font-size:.83em}.msg .fu-chip{font-size:.9em}'
    + 'html.fs-lg .qs-chip{font-size:15px}html.fs-xl .qs-chip{font-size:17px}html.fs-xxl .qs-chip{font-size:19px}'
    + 'html.fs-lg .chatctx{font-size:13.5px}html.fs-xl .chatctx{font-size:15px}html.fs-xxl .chatctx{font-size:16.5px}'
    + '.msg.ai.fold .msg-body{max-height:9.6em;overflow:hidden;-webkit-mask-image:linear-gradient(#000 55%,transparent);mask-image:linear-gradient(#000 55%,transparent)}'
         + '.msg-more{display:block;margin:6px 0 0;padding:4px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface-alt);color:var(--accent);font-size:.8em;font-weight:700;font-family:inherit;cursor:pointer}'
         + '.msg-cont{margin-top:8px;font-size:.85em;color:var(--ink-faint)}.msg-actions[hidden]{display:none!important}'
         + '.xz-fold{margin-left:auto;padding:5px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface-alt);color:var(--accent);font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;flex:none}'
         + '.sres .sx,.msg,.hitem .q,.tmtext,.tmreply,.hl-note,.pl-q,.pl-opt,.pl-hint,.pl-expl,.tmverse,.hlsheet-quote{overflow-wrap:anywhere}';
  const el = document.createElement('style'); el.id = 'fixcss'; el.textContent = css;
  document.head.appendChild(el);
})();

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
  zh: { app:'321互動聖經', today:'今日', books:'經卷', search:'搜尋', companion:'小智', companionFull:'小智AI屬靈同伴', me:'我的',
        ot:'舊約', nt:'新約', ch:'章', chapter:n=>`第 ${n} 章`, verses:'節', bookUnit:'卷',
        cont:'繼續閱讀', start:'開始讀經', daily:'今日默想', progress:'讀經進度',
        prev:'上一章', next:'下一章', toc:'目錄', pure:'閱讀方式', note:'註釋', back:'返回',
        modes:['分章','整卷連讀'], onoff:['顯示','隱藏'],
        shCh:'顯示章', shV:'顯示節',
        shChHint:['每章開頭有淡雅的章題','看不到章題'],
        shVHint:['每一節前面有金色小節號','看不到節號，純粹的經文'],
        modeHint:['一章一章讀，讀完按下一章','整卷接成一篇，一口氣讀完'],
        prevBk:'上一卷', nextBk:'下一卷', bookDone:'已讀完這一卷',
        bm:'書籤', bmAdd:'已加書籤', bmDel:'已移除書籤', myBm:'我的書籤',
        emptyBm:'還沒有書籤。在閱讀器按 🔖 進入書籤模式，點一下讀到的那一句就記下來。',
        bmHint:'書籤模式：點一下讀到的那一句就加書籤，再點一下移除。按 🔖 結束。',
        bmModeOn:'書籤模式開啟', bmModeOff:'書籤模式結束',
        resume:'從上次的地方繼續',
        read:'讀這一章', done:'已讀完本章', markRead:'標記已讀',
        searchPH:'輸入要找的字句…', searchHint:'輸入兩個字以上開始搜尋', noResult:'找不到相符的經文',
        found:n=>`找到 ${n} 節`, loading:'載入中…',
        hlTitle:'這一句', hlColor:'顏色', hlNote:'寫下默想…', save:'儲存', ask:'問小智', del:'刪除畫線', close:'關閉',
        ttsFrom:'🔊 從這裡開始朗讀', ttsPlay:'開始朗讀', ttsPause:'暫停朗讀', ttsStop:'停止朗讀',
        hlSpan:'範圍', spanUnit:n=>`${n} 句`, spanV:'整節', spanP:'整段',
        spanHint:'按 ＋ 往下多畫一句，畫線就不只一句，可以連成一整段。',
        spanIsV:'這一節已經整節畫起來了', spanIsP:'這一段已經整段畫起來了',
        spanDoneV:n=>`已畫整節，共 ${n} 句`, spanDoneP:n=>`已畫整段，共 ${n} 句`,
        team:'團隊', myHl:'我的畫線', myFav:'我的收藏', settings:'設定', font:'字級大小', theme:'主題',
        fonts:['標準','大','特大','超大'], themes:['自動','日','夜','羊皮紙'],
        voice:'朗讀聲音', ttsAutoNext:'讀完自動接下一章',
        ttsAutoNextHint:['一章朗讀完會自動翻到下一章繼續唸','讀完這一章就停下來，不會自動翻頁'],
        langLabel:'語言', stats:['已讀章數','畫線','書籤'],
        diag:'連線測試', diagRun:'測試小智與朗讀', diagBusy:'測試中…',
        upd:'版本更新', updCheck:'檢查更新', updChecking:'檢查中…', updLatest:'已經是最新版本',
        updFound:'找到新版本，下載中…', updReadyBar:'有新版本，點一下立即更新 ↻', updFail:'檢查失敗，請稍後再試',
        updApplying:'更新中…',
        card:'做成美圖', cardTitle:'做成美圖分享', cardStyle:'版型', cardSize:'尺寸',
        cardBorder:'邊框', cardFsL:'內文字級', cardFsHint:'團體名稱、稱呼、經文、內文與署名都會跟著放大。',
        cardText:'卡片內文', bless:'請小智寫祝福', blessing:'小智寫作中…', blessDone:'小智寫好了',
        blessHint:'可以自己寫，也可以請小智照這節經文寫一段關懷祝福；改完卡片會立刻跟著變。',
        useMine:'用我的領受', clearText:'不要內文',
        cardLines:'卡片上下的署名', cardTopL:'上面（團體名）', cardSignL:'下面（署名）',
        cardToL:'稱呼（這張圖寫給誰）', cardToPH:'例：親愛的珍姐',
        cardLinesHint:'留空就用預設。例如下面改成「愛你的財哥、珍姐　敬上」。',
        cardShare:'分享', cardSave:'存到相簿',
        cardHint:'按「分享」可直接選 LINE／IG／FB 傳出去；也可以長按上面的圖片存起來。',
        cardSaved:'已下載，請從相簿分享',
        saveIOS:'請在選單裡選「儲存影像」，圖就會進相簿',
        savedFile:'已下載到「檔案」App 的下載項目',
        holdT:'長按下面這張圖', holdS:'選「加入照片」或「儲存影像」，就會存進相簿。',
        photo:'加一張相片（選用）', photoPick:'從相簿選相片', photoSwap:'從相簿換一張', photoDel:'移除相片',
        photoBg:['作背景','作背景'], photoStk:['貼在卡片上','贴在卡片上'],
        photoHint:'可以當卡片背景，也可以像貼紙貼上去，大小與位置都能調。',
        photoBgHint:'先選一張當卡片背景；之後可以再切到「貼在卡片上」加第二張。', photoStkHint:'背景之外，可以再貼一張相片在卡片上，底部署名會自動往上讓開。', photoUseBg:'把背景這張改貼在卡片上',
        photoBad:'這張相片讀不出來，換一張試試',
        stkShape:'相片形狀', stkSize:'相片大小', stkPos:'相片位置',
        bgm:'背景音樂（選用）', bgmPick:'從檔案選音樂', bgmSwap:'換一首', bgmDel:'移除音樂',
        bgmVol:'音樂音量', bgmNote:'錄製時會自動循環，混進影片或錄音裡。',
        bgmHint:'選一首詩歌或輕音樂；若一時找不到，按選擇視窗左下角「瀏覽」，再到 iCloud 雲碟或「我的 iPhone」裡找。',
        bgmBad:'這不是音樂檔，請選 mp3、m4a、wav 等音檔', bgmBig:'音檔太大（超過 25MB），請選短一點的',
        bgmAdded:'已加入背景音樂', bgmNeed:'請先選一首背景音樂',
        recSec:'錄成影片', recVoice:'🎙 只有聲音', recCard:'🖼 卡片畫面', recSelfie:'📷 自拍畫面',
        recVoiceD:'只錄你的聲音，存成語音檔',
        recCardD:'卡片＋你的聲音，合成一支影片',
        recSelfieD:'卡片＋你的臉＋聲音，合成一支影片',
        recIntro:'按下開始，對著手機把這段經文與領受讀出來。可以只錄聲音，也可以把卡片、自拍合成一支影片直接傳出去。',
        recIntroA:'這台裝置不支援合成影片，會先錄成語音；播放時可用手機「螢幕錄影」錄成影片。',
        recReady:'按下開始，把想說的話錄進去', recStartV:'開始錄影片', recStartS:'開始自拍錄影',
        recStartA:'開始錄音', recStop:'停止並完成', recing:'錄影中…', recingA:'錄音中…',
        recTip:'建議 30～60 秒：先讀經文，再說這段話對你的意思。',
        recDoneV:'影片做好了！可以分享出去', recDoneA:'錄好了！可以播放或分享',
        rvTitleV:'錄好了，先看一下', rvTitleA:'錄好了，先聽一下',
        rvHint:'滿意就存起來；不滿意可以重錄一次，或直接刪掉不留。',
        rvSave:'儲存到作品庫', rvShare:'分享出去', rvAgain:'重錄一次', rvDrop:'刪掉不留',
        rvDropAsk:'這一段就不留了？', rvDropped:'已刪掉，沒有存下來', rvSaving:'存檔中…',
        rvNote:'這一段還沒存起來', rvLeaveAsk:'還沒存起來，關掉就不見了，確定嗎？',
        recNo:'這台裝置不支援錄音', vidNo:'這台裝置不支援自動合成影片',
        micDeny:'無法使用麥克風，請允許權限', camDeny:'無法使用相機，請允許權限',
        selfieHint:'你的臉會以圓形貼在卡片右下角，錄影時同步合成。',
        beauty:'美顏', beautyOn:'柔膚', beautyOff:'原圖',
        beautyHint:['已經柔化膚質、稍微提亮，自拍看起來更好看。','使用鏡頭原始畫面，不做任何處理。'],
        mcLen:'音樂卡片長度', mcStart:'不錄音，只配音樂', mcing:'音樂卡片製作中…',
        mcHint:'卡片配上背景音樂做成影片，不必開口。選 15 或 30 秒很快就好，選「整首」要等音樂播完。',
        works:'我的作品', noWorks:'還沒有作品。錄一段話或配一首音樂，就會出現在這裡。',
        delAsk:'刪除這個作品？', deleted:'已刪除',
        emptyHl:'還沒有畫線。在經文上點一下就能畫線、寫默想。',
        emptyFav:'還沒有收藏小智的回答。',
        chatPH:'就這段經文提問…', send:'送出', examples:'範例問題',
        ctx:(b,c)=>`目前經文：${b} 第 ${c} 章`, thinking:'小智思想中…',
        ttsFallback:'改用裝置內建語音朗讀', ttsErr:'朗讀服務連不上',
        chatErr:'小智連不上，請稍後再試。',
        plan:'讀經計畫', planTitle:'選一個讀經計畫', planDaysUnit:'天',
        planStart:'開始這個計畫', planSwitch:'換一個計畫', planRestart:'重新開始',
        planRestartAsk:'要重新開始這個計畫嗎？之前打勾的進度都會清空。',
        planGoRead:'前往閱讀', planDone:'已讀', planMarkDone:'標記今天已讀',
        planDay:n=>`第 ${n} 天`, planWeek:n=>`第 ${n} 週`,
        chapterRange:(a,b)=>`第 ${a}–${b} 章`, psalmRange:(a,b)=>`第 ${a}–${b} 篇`,
        planEmpty:'還沒有開始讀經計畫。選一個計畫，就會從第一天開始為你排好進度。',
        planRemind:'每日提醒',
        planRemindHint:['已開啟：今天的進度還沒讀完的話，晚上8點左右手機會跳通知提醒你。','關閉：不會有提醒通知。'],
        planRemindDenied:'手機／瀏覽器封鎖了通知權限，請到系統設定裡開啟本App的通知權限',
        planRemindUnsupported:'這個瀏覽器不支援通知功能（iPhone 請先把App「加入主畫面」後再開啟）',
        planRemindTitle:'321互動聖經．讀經提醒',
        planRemindBody:(b,r)=>`今天還沒讀${b}${r}，找個時間讀一下吧！`,
        planAutoDoneToast:'讀完了！今天的進度已經自動幫你打勾' },
  zs: { app:'321互动圣经', today:'今日', books:'经卷', search:'搜索', companion:'小智', companionFull:'小智AI属灵同伴', me:'我的',
        ot:'旧约', nt:'新约', ch:'章', chapter:n=>`第 ${n} 章`, verses:'节', bookUnit:'卷',
        cont:'继续阅读', start:'开始读经', daily:'今日默想', progress:'读经进度',
        prev:'上一章', next:'下一章', toc:'目录', pure:'阅读方式', note:'注释', back:'返回',
        modes:['分章','整卷连读'], onoff:['显示','隐藏'],
        shCh:'显示章', shV:'显示节',
        shChHint:['每章开头有淡雅的章题','看不到章题'],
        shVHint:['每一节前面有金色小节号','看不到节号，纯粹的经文'],
        modeHint:['一章一章读，读完按下一章','整卷接成一篇，一口气读完'],
        prevBk:'上一卷', nextBk:'下一卷', bookDone:'已读完这一卷',
        bm:'书签', bmAdd:'已加书签', bmDel:'已移除书签', myBm:'我的书签',
        emptyBm:'还没有书签。在阅读器按 🔖 进入书签模式，点一下读到的那一句就记下来。',
        bmHint:'书签模式：点一下读到的那一句就加书签，再点一下移除。按 🔖 结束。',
        bmModeOn:'书签模式开启', bmModeOff:'书签模式结束',
        resume:'从上次的地方继续',
        read:'读这一章', done:'已读完本章', markRead:'标记已读',
        searchPH:'输入要找的字句…', searchHint:'输入两个字以上开始搜索', noResult:'找不到相符的经文',
        found:n=>`找到 ${n} 节`, loading:'载入中…',
        hlTitle:'这一句', hlColor:'颜色', hlNote:'写下默想…', save:'保存', ask:'问小智', del:'删除划线', close:'关闭',
        ttsFrom:'🔊 从这里开始朗读', ttsPlay:'开始朗读', ttsPause:'暂停朗读', ttsStop:'停止朗读',
        hlSpan:'范围', spanUnit:n=>`${n} 句`, spanV:'整节', spanP:'整段',
        spanHint:'按 ＋ 往下多划一句，划线就不只一句，可以连成一整段。',
        spanIsV:'这一节已经整节划起来了', spanIsP:'这一段已经整段划起来了',
        spanDoneV:n=>`已划整节，共 ${n} 句`, spanDoneP:n=>`已划整段，共 ${n} 句`,
        team:'团队', myHl:'我的划线', myFav:'我的收藏', settings:'设置', font:'字级大小', theme:'主题',
        fonts:['标准','大','特大','超大'], themes:['自动','日','夜','羊皮纸'],
        voice:'朗读声音', ttsAutoNext:'读完自动接下一章',
        ttsAutoNextHint:['一章朗读完会自动翻到下一章继续念','读完这一章就停下来，不会自动翻页'],
        langLabel:'语言', stats:['已读章数','划线','书签'],
        diag:'连线测试', diagRun:'测试小智与朗读', diagBusy:'测试中…',
        upd:'版本更新', updCheck:'检查更新', updChecking:'检查中…', updLatest:'已经是最新版本',
        updFound:'找到新版本，下载中…', updReadyBar:'有新版本，点一下立即更新 ↻', updFail:'检查失败，请稍后再试',
        updApplying:'更新中…',
        card:'做成美图', cardTitle:'做成美图分享', cardStyle:'版型', cardSize:'尺寸',
        cardBorder:'边框', cardFsL:'内文字级', cardFsHint:'团体名称、称呼、经文、内文与署名都会跟着放大。',
        cardText:'卡片内文', bless:'请小智写祝福', blessing:'小智写作中…', blessDone:'小智写好了',
        blessHint:'可以自己写，也可以请小智照这节经文写一段关怀祝福；改完卡片会立刻跟着变。',
        useMine:'用我的领受', clearText:'不要内文',
        cardLines:'卡片上下的署名', cardTopL:'上面（团体名）', cardSignL:'下面（署名）',
        cardToL:'称呼（这张图写给谁）', cardToPH:'例：亲爱的珍姐',
        cardLinesHint:'留空就用预设。例如下面改成“爱你的财哥、珍姐　敬上”。',
        cardShare:'分享', cardSave:'存到相册',
        cardHint:'按“分享”可直接选 LINE／IG／FB 传出去；也可以长按上面的图片存起来。',
        cardSaved:'已下载，请从相册分享',
        saveIOS:'请在菜单里选“存储图像”，图就会进相册',
        savedFile:'已下载到“文件”App 的下载项目',
        holdT:'长按下面这张图', holdS:'选“加入照片”或“存储图像”，就会存进相册。',
        photo:'加一张相片（选用）', photoPick:'从相册选相片', photoSwap:'从相册换一张', photoDel:'移除相片',
        photoBg:['作背景','作背景'], photoStk:['贴在卡片上','贴在卡片上'],
        photoHint:'可以当卡片背景，也可以像贴纸贴上去，大小与位置都能调。',
        photoBgHint:'先选一张当卡片背景；之后可以再切到“贴在卡片上”加第二张。', photoStkHint:'背景之外，可以再贴一张相片在卡片上，底部署名会自动往上让开。', photoUseBg:'把背景这张改贴在卡片上',
        photoBad:'这张相片读不出来，换一张试试',
        stkShape:'相片形状', stkSize:'相片大小', stkPos:'相片位置',
        bgm:'背景音乐（选用）', bgmPick:'从文件选音乐', bgmSwap:'换一首', bgmDel:'移除音乐',
        bgmVol:'音乐音量', bgmNote:'录制时会自动循环，混进视频或录音里。',
        bgmHint:'选一首诗歌或轻音乐；若一时找不到，按选择窗口左下角“浏览”，再到 iCloud 云碟或“我的 iPhone”里找。',
        bgmBad:'这不是音乐文件，请选 mp3、m4a、wav 等音频', bgmBig:'音频太大（超过 25MB），请选短一点的',
        bgmAdded:'已加入背景音乐', bgmNeed:'请先选一首背景音乐',
        recSec:'录成视频', recVoice:'🎙 只有声音', recCard:'🖼 卡片画面', recSelfie:'📷 自拍画面',
        recVoiceD:'只录你的声音，存成语音档',
        recCardD:'卡片＋你的声音，合成一支视频',
        recSelfieD:'卡片＋你的脸＋声音，合成一支视频',
        recIntro:'按下开始，对着手机把这段经文与领受读出来。可以只录声音，也可以把卡片、自拍合成一支视频直接传出去。',
        recIntroA:'这台设备不支持合成视频，会先录成语音；播放时可用手机“录屏”录成视频。',
        recReady:'按下开始，把想说的话录进去', recStartV:'开始录视频', recStartS:'开始自拍录像',
        recStartA:'开始录音', recStop:'停止并完成', recing:'录像中…', recingA:'录音中…',
        recTip:'建议 30～60 秒：先读经文，再说这段话对你的意思。',
        recDoneV:'视频做好了！可以分享出去', recDoneA:'录好了！可以播放或分享',
        rvTitleV:'录好了，先看一下', rvTitleA:'录好了，先听一下',
        rvHint:'满意就存起来；不满意可以重录一次，或直接删掉不留。',
        rvSave:'保存到作品库', rvShare:'分享出去', rvAgain:'重录一次', rvDrop:'删掉不留',
        rvDropAsk:'这一段就不留了？', rvDropped:'已删掉，没有存下来', rvSaving:'保存中…',
        rvNote:'这一段还没存起来', rvLeaveAsk:'还没存起来，关掉就不见了，确定吗？',
        recNo:'这台设备不支持录音', vidNo:'这台设备不支持自动合成视频',
        micDeny:'无法使用麦克风，请允许权限', camDeny:'无法使用相机，请允许权限',
        selfieHint:'你的脸会以圆形贴在卡片右下角，录像时同步合成。',
        beauty:'美颜', beautyOn:'柔肤', beautyOff:'原图',
        beautyHint:['已经柔化肤质、稍微提亮，自拍看起来更好看。','使用镜头原始画面，不做任何处理。'],
        mcLen:'音乐卡片长度', mcStart:'不录音，只配音乐', mcing:'音乐卡片制作中…',
        mcHint:'卡片配上背景音乐做成视频，不必开口。选 15 或 30 秒很快就好，选“整首”要等音乐播完。',
        works:'我的作品', noWorks:'还没有作品。录一段话或配一首音乐，就会出现在这里。',
        delAsk:'删除这个作品？', deleted:'已删除',
        emptyHl:'还没有划线。在经文上点一下就能划线、写默想。',
        emptyFav:'还没有收藏小智的回答。',
        chatPH:'就这段经文提问…', send:'发送', examples:'范例问题',
        ctx:(b,c)=>`当前经文：${b} 第 ${c} 章`, thinking:'小智思想中…',
        ttsFallback:'改用设备内置语音朗读', ttsErr:'朗读服务连不上',
        chatErr:'小智连不上，请稍后再试。',
        plan:'读经计划', planTitle:'选一个读经计划', planDaysUnit:'天',
        planStart:'开始这个计划', planSwitch:'换一个计划', planRestart:'重新开始',
        planRestartAsk:'要重新开始这个计划吗？之前打勾的进度都会清空。',
        planGoRead:'前往阅读', planDone:'已读', planMarkDone:'标记今天已读',
        planDay:n=>`第 ${n} 天`, planWeek:n=>`第 ${n} 周`,
        chapterRange:(a,b)=>`第 ${a}–${b} 章`, psalmRange:(a,b)=>`第 ${a}–${b} 篇`,
        planEmpty:'还没有开始读经计划。选一个计划，就会从第一天开始为你排好进度。',
        planRemind:'每日提醒',
        planRemindHint:['已开启：今天的进度还没读完的话，晚上8点左右手机会跳通知提醒你。','关闭：不会有提醒通知。'],
        planRemindDenied:'手机／浏览器封锁了通知权限，请到系统设置里开启本App的通知权限',
        planRemindUnsupported:'这个浏览器不支持通知功能（iPhone 请先把App「添加到主屏幕」后再开启）',
        planRemindTitle:'321互动圣经．读经提醒',
        planRemindBody:(b,r)=>`今天还没读${b}${r}，找个时间读一下吧！`,
        planAutoDoneToast:'读完了！今天的进度已经自动帮你打勾' },
  en: { app:'321 Interactive Bible', today:'Today', books:'Books', search:'Search', companion:'Xiaozhi',
        companionFull:'Xiaozhi — AI Companion', me:'Me',
        ot:'Old Testament', nt:'New Testament', ch:'ch', chapter:n=>`Chapter ${n}`, verses:'verses', bookUnit:'books',
        cont:'Continue reading', start:'Start reading', daily:"Today's meditation", progress:'Reading progress',
        prev:'Previous', next:'Next', toc:'Contents', pure:'Reading mode', note:'Notes', back:'Back',
        modes:['By chapter','Whole book'], onoff:['Show','Hide'],
        shCh:'Chapter headings', shV:'Verse numbers',
        shChHint:['A quiet heading at the start of each chapter','No chapter headings'],
        shVHint:['A small gold number before each verse','No numbers — just the text'],
        modeHint:['One chapter at a time','The whole book as one flowing text'],
        prevBk:'Previous book', nextBk:'Next book', bookDone:'You have finished this book',
        bm:'Bookmark', bmAdd:'Bookmarked', bmDel:'Bookmark removed', myBm:'My bookmarks',
        emptyBm:'No bookmarks yet. Tap 🔖 in the reader, then tap the sentence you have reached.',
        bmHint:'Bookmark mode: tap a sentence to bookmark it, tap again to remove. Tap 🔖 to finish.',
        bmModeOn:'Bookmark mode on', bmModeOff:'Bookmark mode off',
        resume:'Pick up where you left off',
        read:'Read this chapter', done:'Chapter finished', markRead:'Mark as read',
        searchPH:'Search the Bible…', searchHint:'Type at least two letters', noResult:'Nothing found',
        found:n=>`${n} verse${n === 1 ? '' : 's'} found`, loading:'Loading…',
        hlTitle:'This sentence', hlColor:'Colour', hlNote:'Write your reflection…', save:'Save',
        ask:'Ask Xiaozhi', del:'Remove highlight', close:'Close',
        ttsFrom:'🔊 Read from here', ttsPlay:'Play', ttsPause:'Pause', ttsStop:'Stop',
        hlSpan:'Range', spanUnit:n=>`${n} sentence${n === 1 ? '' : 's'}`, spanV:'Whole verse', spanP:'Whole paragraph',
        spanHint:'Tap ＋ to take in the next sentence, so a highlight can cover a whole passage.',
        spanIsV:'The whole verse is already highlighted', spanIsP:'The whole paragraph is already highlighted',
        spanDoneV:n=>`Whole verse — ${n} sentence${n===1?'':'s'}`, spanDoneP:n=>`Whole paragraph — ${n} sentence${n===1?'':'s'}`,
        team:'Team', myHl:'My highlights', myFav:'My saved replies', settings:'Settings', font:'Text size', theme:'Theme',
        fonts:['Normal','Large','Larger','Largest'], themes:['Auto','Day','Night','Parchment'],
        voice:'Reading voice', ttsAutoNext:'Auto-continue to next chapter',
        ttsAutoNextHint:['When a chapter finishes reading aloud, automatically move on to the next one','Stop when this chapter ends — no automatic page turn'],
        langLabel:'Language', stats:['Chapters read','Highlights','Bookmarks'],
        diag:'Connection test', diagRun:'Test Xiaozhi and read-aloud', diagBusy:'Testing…',
        upd:'Updates', updCheck:'Check for updates', updChecking:'Checking…', updLatest:'You have the latest version',
        updFound:'Update found, downloading…', updReadyBar:'A new version is ready — tap to update ↻', updFail:'Check failed, please try again later',
        updApplying:'Updating…',
        card:'Make an image', cardTitle:'Make an image to share', cardStyle:'Style', cardSize:'Size',
        cardBorder:'Border', cardFsL:'Body text size', cardFsHint:'The group name, greeting, verse, body text and signature all scale together.',
        cardText:'Card text', bless:'Ask Xiaozhi to write', blessing:'Xiaozhi is writing…', blessDone:'Xiaozhi has written it',
        blessHint:'Write it yourself, or let Xiaozhi write a short blessing from this verse. The card updates as you type.',
        useMine:'Use my reflection', clearText:'No body text',
        cardLines:'Lines above and below', cardTopL:'Top (your fellowship)', cardSignL:'Bottom (signature)',
        cardToL:'To (who this card is for)', cardToPH:'e.g. Dear Joy',
        cardLinesHint:'Leave blank for the default — for example, “With love, Alex & Joy”.',
        cardShare:'Share', cardSave:'Save to photos',
        cardHint:'Tap Share to send it straight to LINE, Instagram or Facebook — or press and hold the image to save it.',
        cardSaved:'Downloaded — share it from your photos',
        saveIOS:'Choose “Save Image” in the menu and it goes to your photos',
        savedFile:'Downloaded to the Files app',
        holdT:'Press and hold the image below', holdS:'Choose “Add to Photos” or “Save Image” to keep it.',
        photo:'Add a photo (optional)', photoPick:'Choose a photo', photoSwap:'Choose from album', photoDel:'Remove photo',
        photoBg:['As background','As background'], photoStk:['As a sticker','As a sticker'],
        photoHint:'Use it as the card background, or stick it on like a polaroid. Size and position are adjustable.',
        photoBgHint:'Pick a background photo first; then switch to “As a sticker” to add a second one.', photoStkHint:'On top of the background you can stick a second photo on the card — the signature moves up to make room.', photoUseBg:'Move the background photo onto the card',
        photoBad:"That photo could not be read — try another one",
        stkShape:'Photo shape', stkSize:'Photo size', stkPos:'Photo position',
        bgm:'Background music (optional)', bgmPick:'Choose music', bgmSwap:'Change music', bgmDel:'Remove music',
        bgmVol:'Music volume', bgmNote:'It loops quietly under your voice while you record.',
        bgmHint:'Pick a hymn or something gentle. If you cannot find it, tap Browse at the bottom left and look in iCloud Drive or On My iPhone.',
        bgmBad:'That is not an audio file — choose an mp3, m4a or wav', bgmBig:'That file is too large (over 25MB) — choose a shorter one',
        bgmAdded:'Music added', bgmNeed:'Choose some background music first',
        recSec:'Record a video', recVoice:'🎙 Voice only', recCard:'🖼 Card video', recSelfie:'📷 With selfie',
        recVoiceD:'Your voice alone, saved as an audio file',
        recCardD:'The card plus your voice, made into a video',
        recSelfieD:'The card, your face and your voice, made into a video',
        recIntro:'Tap start and read the verse aloud. Record your voice alone, or add the card and your face, and it becomes a video you can send straight to anyone.',
        recIntroA:'This device cannot build a video, so it will record audio only. You can use Screen Recording while it plays.',
        recReady:'Tap start and say what is on your heart', recStartV:'Start recording', recStartS:'Start selfie recording',
        recStartA:'Start recording', recStop:'Stop and finish', recing:'Recording…', recingA:'Recording…',
        recTip:'30–60 seconds works well: read the verse, then say what it means to you.',
        recDoneV:'Your video is ready to share', recDoneA:'Recorded — you can play it or share it',
        rvTitleV:'Here it is — take a look', rvTitleA:'Here it is — have a listen',
        rvHint:'Keep it if you are happy with it, record it again, or delete it without saving.',
        rvSave:'Save to my recordings', rvShare:'Share', rvAgain:'Record again', rvDrop:'Delete',
        rvDropAsk:'Delete this without saving?', rvDropped:'Deleted — nothing was saved', rvSaving:'Saving…',
        rvNote:'Not saved yet', rvLeaveAsk:'This has not been saved yet — close anyway?',
        recNo:'This device cannot record audio', vidNo:'This device cannot build a video',
        micDeny:'Microphone not available — please allow access', camDeny:'Camera not available — please allow access',
        selfieHint:'Your face appears in a circle at the bottom right, composed in as you record.',
        beauty:'Beauty', beautyOn:'Smooth', beautyOff:'Original',
        beautyHint:['Skin is softened and slightly brightened for a more flattering selfie.','Uses the raw camera image, unprocessed.'],
        mcLen:'Music card length', mcStart:'No talking — just music', mcing:'Building your music card…',
        mcHint:'The card set to music, no need to speak. 15 or 30 seconds is quick; “Whole track” waits for the music to finish.',
        works:'My recordings', noWorks:'Nothing yet. Record a few words, or set the card to music.',
        delAsk:'Delete this recording?', deleted:'Deleted',
        emptyHl:'No highlights yet. Tap any sentence to highlight it and write a reflection.',
        emptyFav:"You have not saved any of Xiaozhi's replies yet.",
        chatPH:'Ask about this passage…', send:'Send', examples:'Example questions',
        ctx:(b,c)=>`Reading: ${b} ${c}`, thinking:'Xiaozhi is thinking…',
        ttsFallback:"Using this device's built-in voice", ttsErr:'Read-aloud service unavailable',
        chatErr:'Xiaozhi is unreachable. Please try again shortly.',
        plan:'Reading Plan', planTitle:'Choose a reading plan', planDaysUnit:'days',
        planStart:'Start this plan', planSwitch:'Change plan', planRestart:'Restart',
        planRestartAsk:'Restart this plan? All progress checked off so far will be cleared.',
        planGoRead:'Go read', planDone:'Done', planMarkDone:"Mark today's reading done",
        planDay:n=>`Day ${n}`, planWeek:n=>`Week ${n}`,
        chapterRange:(a,b)=>`Chapters ${a}-${b}`, psalmRange:(a,b)=>`Psalms ${a}-${b}`,
        planEmpty:"You haven't started a reading plan yet. Pick one and it will lay out a day-by-day pace for you, starting from day one.",
        planRemind:'Daily reminder',
        planRemindHint:["On: if today's reading isn't finished yet, you'll get a notification around 8 PM.", "Off: no reminder notifications."],
        planRemindDenied:'Notifications are blocked for this app. Please enable notification permission in your device settings.',
        planRemindUnsupported:'This browser does not support notifications (on iPhone, add this app to your Home Screen first).',
        planRemindTitle:'321 Interactive Bible — Reading Reminder',
        planRemindBody:(b,r)=>`You haven't read ${b} ${r} yet today — take a few minutes when you can!`,
        planAutoDoneToast:"Nice! Today's reading has been checked off automatically" }
};
const t = () => I18N[state.lang] || I18N.zh;
const isKO = () => state.lang === 'ko';
const isJA = () => state.lang === 'ja';
const isID = () => state.lang === 'id';
/* 「語言包」語言（韓、日）：UI 文字先查 lang-xx.js 對照表（英文原句→該語言），查不到就維持英文 */
const isX = () => state.lang === 'ko' || state.lang === 'ja' || state.lang === 'id';
/* 提示詞／內容底稿用英文的語言（英、韓、日）；排版仍各走各的（日文走 CJK 排版） */
const isEP = () => state.lang === 'en' || state.lang === 'ko' || state.lang === 'ja' || state.lang === 'id';
/* 「西文排版」：斷句、空白、標點、量詞都走英文那一套——韓文（有空格、句點結尾）也走這一條 */
const isEN = () => state.lang === 'en' || state.lang === 'ko' || state.lang === 'id';
/* 韓文 UI 字串：先查 lang-ko.js 的對照表（英文原句→韓文），查不到就維持英文 */
const koT = (zh, en) => { const P = state.lang === 'id' ? window.ID_PACK : state.lang === 'ja' ? window.JA_PACK : window.KO_PACK; return (P && typeof en === 'string') ? P.t(zh, en) : en; };
const isZS = () => state.lang === 'zs';
/* 三語挑字：L3(繁, 简, 英) */
const L3 = (zh, zs, en) => isX() ? koT(zh, en) : (isEN() ? en : (isZS() ? zs : zh));

/* ---------------------------------------------------------------- 狀態 */
const FONT_CLASS = ['', 'fs-lg', 'fs-xl', 'fs-xxl'];
const THEMES = ['auto', 'light', 'dark', 'sepia'];
const HL_COLORS = ['gold','green','blue','pink','purple','maroon','brown','charcoal'];
const HL_SWATCH = {gold:'#D9B168', green:'#6FAE71', blue:'#6C93D1', pink:'#E58FA0',
                   purple:'#A48AC9', maroon:'#8C4A4E', brown:'#8A6740', charcoal:'#54534E'};
/* 與姊妹App共用的 Azure 真人語音；順序＝預設值在最前（zh 雲哲、zs 云帆） */
const VOICES = {
  id: [{n:'Ardi', v:'id-ID-ArdiNeural'},
       {n:'Gadis', v:'id-ID-GadisNeural'},
       {n:'Ardi (alt)', v:'id-ID-ArdiNeural'}],
  ja: [{n:'ケイタ', v:'ja-JP-KeitaNeural'},
       {n:'ナナミ', v:'ja-JP-NanamiNeural'},
       {n:'ダイチ', v:'ja-JP-DaichiNeural'}],
  ko: [{n:'인준', v:'ko-KR-InJoonNeural'},
       {n:'선희', v:'ko-KR-SunHiNeural'},
       {n:'현수', v:'ko-KR-HyunsuMultilingualNeural'}],
  en: [{n:'Andrew', v:'en-US-AndrewNeural'},
       {n:'Emma',   v:'en-US-EmmaNeural'},
       {n:'Brian',  v:'en-US-BrianNeural'}],
  zh: [{n:'雲哲', v:'zh-TW-YunJheNeural'},
       {n:'雲帆', v:'zh-CN-Yunfan:DragonHDLatestNeural'},
       {n:'曉辰', v:'zh-CN-Xiaochen:DragonHDLatestNeural'}],
  zs: [{n:'云帆', v:'zh-CN-Yunfan:DragonHDLatestNeural'},
       {n:'云哲', v:'zh-TW-YunJheNeural'},
       {n:'晓辰', v:'zh-CN-Xiaochen:DragonHDLatestNeural'}]
};

const DEFAULTS = { lang:'zh', font:0, theme:0, flow:false, shCh:true, shV:true, hidenote:false,
                   cardTpl:'plain', cardSize:'p', cardBorder:'none', cardFs:1.45, cardFont:'auto', cardInk:'',
                   cardTop:'', cardSign:'', cardTo:'親愛的家人：平安！', cardGreet:'', photoLast:'', photoMode:'full',
                   voice:{zh:0, zs:0, en:0, ko:0, ja:0, id:0}, ttsAutoNext:false, beauty:true, planRemindOn:false,
                   audience:'adult', alen:'mid', skbg:'none' };
/* 「淨」鍵依序切換的四種組合：[整卷連讀?, 顯示章號?] */
/* 「淨」鍵循環的四種常用讀法：[整卷連讀, 顯示章, 顯示節] */
const VIEW_CYCLE = [[false, true, true], [false, true, false], [false, false, false], [true, false, false]];
let state = Object.assign({}, DEFAULTS);
let user  = { progress:{}, hl:{}, fav:[], marks:[], last:null,
               uid:'', nick:'', teams:[], pts:0, badges:[], acts:{},
               plan:{ active:null, starts:{}, done:{} }, play:{ right:0, total:0, best:{} }, quizWrong:[], rewards:{} };
let TOC = [], BOOK = {}, SHARD = {};   // SHARD['zh|law'] = {BookId:[chapters]}

function loadState(){
  try{
    const s = JSON.parse(localStorage.getItem('ib_state') || '{}');
    state = Object.assign({}, DEFAULTS, s);
    state.voice = Object.assign({}, DEFAULTS.voice, s.voice || {});
    if (!I18N[state.lang]) state.lang = 'zh';
    // 舊設定轉換：v1.0.4 的 mode(0分章/1純淨/2整卷)、更早的 pure 開關
    if (s.flow === undefined){
      if (s.mode !== undefined){ state.flow = s.mode === 2; state.shCh = state.shV = s.mode === 0; }
      else if (s.pure){ state.flow = false; state.shCh = state.shV = false; }
    }
    delete state.pure; delete state.mode;
    /* v1.3.x 之前只有一個「章節標示」開關，拆成「顯示章」「顯示節」 */
    if (s.chnum !== undefined && s.shCh === undefined){ state.shCh = !!s.chnum; state.shV = !!s.chnum; }
    delete state.chnum;
    state.flow = !!state.flow; state.shCh = !!state.shCh; state.shV = !!state.shV;
    if (!['adult','teen','kid','seeker','elder','single_parent','single','parent','couple','pastor'].includes(state.audience)) state.audience = 'adult';
    if (!['brief','mid','full'].includes(state.alen)) state.alen = 'mid';
    if (!['none','buddhism','folk','yiguandao','muslim','atheist'].includes(state.skbg)) state.skbg = 'none';
  }catch(e){ state = Object.assign({}, DEFAULTS); }
}
function saveState(){ try{ localStorage.setItem('ib_state', JSON.stringify(state)); }catch(e){} }
function loadUser(){
  try{
    const u = JSON.parse(localStorage.getItem('ib_user') || '{}');
    user = Object.assign({progress:{}, hl:{}, fav:[], marks:[], last:null,
                          uid:'', nick:'', teams:[], pts:0, badges:[], acts:{},
                          plan:{ active:null, starts:{}, done:{} }}, u);
    if (!Array.isArray(user.marks)) user.marks = [];
    if (!Array.isArray(user.teams)) user.teams = [];
    if (!Array.isArray(user.badges)) user.badges = [];
    if (!user.acts || typeof user.acts !== 'object') user.acts = {};
    if (!user.plan || typeof user.plan !== 'object') user.plan = { active:null, starts:{}, done:{} };
    if (!user.plan.starts || typeof user.plan.starts !== 'object') user.plan.starts = {};
    if (!user.plan.done || typeof user.plan.done !== 'object') user.plan.done = {};
    if (!user.plan.pair || typeof user.plan.pair !== 'object' || Array.isArray(user.plan.pair)) user.plan.pair = {};   // 陪讀夥伴：{計畫id: 團隊代碼}
    if (!user.play || typeof user.play !== 'object') user.play = { right:0, total:0, best:{} };
    if (!user.play.best || typeof user.play.best !== 'object') user.play.best = {};
    if (!Array.isArray(user.quizWrong)) user.quizWrong = [];
    if (!user.rewards || typeof user.rewards !== 'object' || Array.isArray(user.rewards)) user.rewards = {};
    if (!user.uid) user.uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }catch(e){}
}
function saveUser(){ try{ localStorage.setItem('ib_user', JSON.stringify(user)); }catch(e){} }

function applyChrome(){
  const h = document.documentElement;
  FONT_CLASS.forEach(c => c && h.classList.remove(c));
  if (FONT_CLASS[state.font]) h.classList.add(FONT_CLASS[state.font]);
  h.classList.toggle('nochap', !state.shCh);     // 不顯示章題
  h.classList.toggle('noverse', !state.shV);     // 不顯示節號
  h.classList.toggle('flow', state.flow);
  h.classList.toggle('hidenote', !!state.hidenote);
  h.classList.toggle('bmmode', bmMode);
  const th = THEMES[state.theme] || 'auto';
  if (th === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', th);
  h.setAttribute('lang', isID() ? 'id' : isJA() ? 'ja' : isKO() ? 'ko' : (isEN() ? 'en' : (isZS() ? 'zh-Hans' : 'zh-Hant')));
  h.setAttribute('data-lang', state.lang);
  $('#brandName').textContent = t().app;
  document.title = t().app;
  ['today','books','search','companion','team','me'].forEach(k => { const e = $('#tab-' + k); if (e) e.textContent = t()[k]; });
  $$('#langswitch button').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
  syncHeaderH();
}
/* 頂欄高度會因安全區域（瀏海／圓角）而不同機型不一樣，量實際高度存成 CSS 變數，
   讓閱讀器工具列可以貼齊在頂欄下面，捲動時工具列會黏住、隨時按得到朗讀鍵 */
function syncHeaderH(){
  const hd = document.querySelector('header.topbar');
  if (hd) document.documentElement.style.setProperty('--header-h', hd.offsetHeight + 'px');
}

/* ---------------------------------------------------------------- 資料 */
/* 讀資料檔。少一個檔就直接說出檔名——不要讓瀏覽器把 404 頁面當成 JSON 去解析，
   那樣只會冒出「The string did not match the expected pattern」這種看不懂的訊息。 */
/* 把某個檔案從所有版本的 Service Worker 快取裡清掉。用在讀到「快取存了半份
   壞掉的資料」時自救——不必等使用者自己去清瀏覽器快取或重裝 App。 */
async function purgeCached(file){
  if (typeof caches === 'undefined') return;
  try{
    const names = await caches.keys();
    await Promise.all(names.map(async name => {
      const c = await caches.open(name);
      const reqs = await c.keys();
      await Promise.all(reqs.filter(rq => rq.url.endsWith(file)).map(rq => c.delete(rq)));
    }));
  }catch(e){ /* 清不掉就算了，不要因為這個再多噴一個錯誤 */ }
}
async function fetchJSON(file){
  let r;
  try{ r = await fetch(file); }
  catch(e){ throw new Error(`讀不到 ${file}（網路問題）`); }
  if (!r.ok) throw new Error(`網站上找不到 ${file}（HTTP ${r.status}）──這個檔還沒上傳`);
  try{ return await r.json(); }
  catch(e){
    /* 部署或網路不穩時，Service Worker 有可能把不完整的內容當成成功存進快取，
       之後每次都讀到同一份壞掉的資料。先清掉那份快取，換一個網址（避開快取）
       重抓一次；還是不行才真的放棄，提醒使用者手動重新整理。 */
    await purgeCached(file);
    try{
      const r2 = await fetch(file + (file.indexOf('?') > -1 ? '&' : '?') + '_retry=' + Date.now());
      if (r2.ok) return await r2.json();
    }catch(e2){ /* 補救也失敗，往下丟出原本的錯誤 */ }
    throw new Error(`${file} 的內容不是有效的 JSON，請重新整理頁面再試一次`);
  }
}
async function loadTOC(){
  if (TOC.length) return;
  TOC = await fetchJSON('toc.json');
  TOC.forEach((b, i) => { b.i = i; BOOK[b.id] = b;
    const kb = window.KO_PACK && KO_PACK.books[b.id]; if (kb){ b.ko = kb.ko; b.ako = kb.ako; }
    const jb = window.JA_PACK && JA_PACK.books[b.id]; if (jb){ b.ja = jb.ja; b.aja = jb.aja; }
    const ib = window.ID_PACK && ID_PACK.books[b.id]; if (ib){ b.idn = ib.idn; b.aid = ib.aid; } });
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
const bname = b => isID() ? (b.idn || b.en || b.zh) : isJA() ? (b.ja || b.en || b.zh) : isKO() ? (b.ko || b.en || b.zh) : (isEN() ? (b.en || b.zh) : (isZS() ? b.zs : b.zh));
const babbr = b => isID() ? (b.aid || b.aen || b.azh) : isJA() ? (b.aja || b.aen || b.azh) : isKO() ? (b.ako || b.aen || b.azh) : (isEN() ? (b.aen || b.azh) : (isZS() ? b.azs : b.azh));

const GROUPS = [
  { zh:'摩西五經',   zs:'摩西五经',   en:'The Law',              a:0,  b:5  },
  { zh:'歷史書',     zs:'历史书',     en:'History',              a:5,  b:17 },
  { zh:'詩歌智慧書', zs:'诗歌智慧书', en:'Poetry & Wisdom',      a:17, b:22 },
  { zh:'大先知書',   zs:'大先知书',   en:'Major Prophets',       a:22, b:27 },
  { zh:'小先知書',   zs:'小先知书',   en:'Minor Prophets',       a:27, b:39 },
  { zh:'福音書與使徒行傳', zs:'福音书与使徒行传', en:'Gospels & Acts', a:39, b:44 },
  { zh:'保羅書信',   zs:'保罗书信',   en:"Paul's Letters",       a:44, b:57 },
  { zh:'一般書信',   zs:'一般书信',   en:'General Letters',      a:57, b:65 },
  { zh:'啟示錄',     zs:'启示录',     en:'Revelation',           a:65, b:66 }
];
const gname = g => isID() ? (g.idn || g.en) : isJA() ? (g.ja || g.en) : isKO() ? (g.ko || g.en) : (isEN() ? g.en : (isZS() ? g.zs : g.zh));

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
/* 英文靠句點＋空白斷句；縮寫（Mr. St. etc.）與引號結尾都要顧到 */
function splitSentencesEN(text){
  const out = [];
  const re = /[^.!?]*[.!?]+["'”’\)\]]*(?:\s+|$)/g;
  let m, last = 0;
  while ((m = re.exec(text)) !== null){
    if (m[0].trim()) out.push(m[0]);
    last = re.lastIndex;
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  if (last < text.length && text.slice(last).trim()) out.push(text.slice(last));
  return out.length ? out : [text];
}
function splitSentences(text){
  if (isEN()) return splitSentencesEN(text);
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
  return html.replace(/〔[^〕]*〕/g, m => `<span class="note">${m}</span>`)
             .replace(/\[[^\]]*\]/g, m => `<span class="note">${m}</span>`);
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
let jumpTo = null;
/* 從搜尋結果點進去，要在這一章渲染完之後自動幫命中的那一句加畫線＋捲過去，
   方便回頭找「剛剛搜到的是哪一句」。只記書卷/章/節號＋命中片段，
   渲染完之後在畫面上比對哪一句 .sent 元素符合，找不到就算了不強求。 */
let jumpHl = null;
function goSearchHit(r){
  jumpHl = { b:r.b, c:r.c, v:r.v, x:r.x };
  go(`#/read/${r.b}/${r.c}`);
}
let bmMode = false;                 // 書籤模式（只存在當下，不寫進設定）
function anchorEl(a){
  return a ? $(`#reader .sent[data-c="${a.c}"][data-p="${a.p}"][data-s="${a.s}"]`) : null;
}
/* 捲回最頂端：跟 scrollToAnchor 同一個毛病——不確定真正在捲動的是 window 還是 body
   （這個 App 的版面 html,body{height:100%} 加上只設 overflow-x:hidden，瀏覽器會把
   overflow-y 算成 auto，實測 body 才是真正在捲的那個，window.scrollTo 完全是空跑）。
   使用者回報：朗讀自動接下一章，沒有從新的一章開頭開始唸，而是從讀到一半的地方
   接著唸——查出來是因為新章節渲染後想把畫面捲回頂端，用的是 window.scrollTo(0,0)，
   在 body 才是真正捲動容器的情況下完全沒有效果，畫面（跟捲動位置決定「要從哪裡開始
   朗讀」的 buildQueue()）都還停在上一章讀到一半的捲動位置，於是新的一章從那個位置
   往下算，等於漏掉了新章節開頭那一段。
   「捲回頂端」這種情境沒有一個固定的錨點元素可以 scrollIntoView，所以不是像
   scrollToAnchor 那樣交給瀏覽器找容器，而是三個容器都直接歸零——不管真正在捲的是
   哪一個，歸零都有效；歸零另一個沒在捲的容器不會出錯，也不會有任何副作用。 */
function scrollToTop(){
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
function scrollToAnchor(a, opts){
  const el = anchorEl(a);
  if (!el) return false;
  const center = opts && opts.center;
  requestAnimationFrame(() => {
    if (center){
      /* 搜尋結果點進來是「找這一句」而不是「接著往下讀」，置中比較看得清楚上下文。
         用 scrollIntoView 而不是手算 window.scrollTo：不用猜真正在捲動的是 window
         還是 body（不同瀏覽器、不同版面高度算法可能不一樣），瀏覽器自己找對容器捲。 */
      el.scrollIntoView({ block:'center', behavior:'auto' });
    } else {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo(0, Math.max(0, y));
    }
  });
  return true;
}
function openAt(m){ jumpTo = { c:m.c, p:m.p, s:m.s }; go(`#/read/${m.b}/${m.c}`); }

/* ---------------------------------------------------------------- 路由 */
function go(h){ location.hash = h; }
/* v2.23.1：App 自己記住走過的頁面（不靠 history.length：從團契、LINE 或自動更新重載進來時，瀏覽器的上一頁常常會離開 App 或沒反應） */
let NAVSTK = []; try{ NAVSTK = JSON.parse(sessionStorage.getItem('ib_navstk') || '[]') || []; }catch(e){ NAVSTK = []; }
let navBacking = false;
function navNorm(h){ h = (h || '').replace(/^#/, ''); return '#' + (h && h !== '/' ? h : '/today'); }
function navTrack(){
  const h = navNorm(location.hash);
  if (navBacking){ navBacking = false; }
  else if (NAVSTK.length >= 2 && NAVSTK[NAVSTK.length - 2] === h) NAVSTK.pop();        /* 按了手機／瀏覽器的返回 */
  else if (NAVSTK[NAVSTK.length - 1] !== h) NAVSTK.push(h);
  if (h === '#/today') NAVSTK = ['#/today'];                                            /* 回到首頁就從頭記 */
  if (NAVSTK.length > 40) NAVSTK = NAVSTK.slice(-40);
  try{ sessionStorage.setItem('ib_navstk', JSON.stringify(NAVSTK)); }catch(e){}
}
function navParent(){
  const r = currentRoute(), tab = r[0] || 'today';
  if (tab === 'read') return r[1] ? '#/books/' + r[1] : '#/books';
  if (tab === 'books' && r[1]) return '#/books';
  if (tab === 'team' && r[1]) return '#/team';
  if (tab === 'studio' && RD && RD.book) return `#/read/${RD.book}/${RD.ch}`;
  return '#/today';
}
/* 「上一頁」：回到 App 裡真正的上一個畫面；沒有紀錄時回到合理的上一層（經文→該卷章節→經卷→首頁） */
function appBack(fallback){
  const cur = navNorm(location.hash);
  while (NAVSTK.length && NAVSTK[NAVSTK.length - 1] === cur) NAVSTK.pop();
  const to = NAVSTK.length ? NAVSTK[NAVSTK.length - 1] : (fallback || navParent());
  if (!NAVSTK.length) NAVSTK.push(to);
  try{ sessionStorage.setItem('ib_navstk', JSON.stringify(NAVSTK)); }catch(e){}
  if (to === cur){ render(); return; }
  navBacking = true; go(to);
}
function appHome(){ NAVSTK = ['#/today']; try{ sessionStorage.setItem('ib_navstk', '["#/today"]'); }catch(e){} if (navNorm(location.hash) === '#/today') { render(); scrollToTop(); } else { navBacking = true; go('#/today'); } }
// 首頁主視覺（內嵌，不依賴額外圖檔）
const HERO_IMG = 'data:image/jpeg;base64,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';

// ===== 321 理念簡介（首頁） =====
function intro321(){
  if (!document.getElementById('i321css')){
    const st=document.createElement('style'); st.id='i321css';
    st.textContent='.hero-cover{max-height:none!important}.hero-cover img{object-fit:contain}'
     +'.i321-row{display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line,rgba(0,0,0,.08))}'
     +'.i321-ic{flex:0 0 auto;width:30px;height:30px;border-radius:50%;background:#0D3988;color:#F7EFDC;font-weight:900;display:flex;align-items:center;justify-content:center;font-family:var(--f-serif)}'
     +'.i321-row b{font-size:1em}.i321-d{font-size:.92em;line-height:1.65;color:var(--muted,#6b6455);margin-top:2px;overflow-wrap:anywhere}'
     +'.i321-more{margin-top:6px;border-top:1px solid var(--line,rgba(0,0,0,.08));padding-top:8px}.i321-more summary{cursor:pointer;color:#0D3988;font-weight:700;font-size:.95em}'
     +'.i321-more p{font-size:.92em;line-height:1.75;margin:8px 0 0;overflow-wrap:anywhere}';
    document.head.appendChild(st);
  }
  const T = (zh, zs, en) => esc(L3(zh, zs, en));
  const row = (ic, h, d) => `<div class="i321-row"><span class="i321-ic">${ic}</span><div><b>${h}</b><div class="i321-d">${d}</div></div></div>`;
  return `<div class="card i321">
    <h3 style="margin:0 0 4px">${T('321 理念','321 理念','The 3-2-1 Ideology')}</h3>
    <div class="muted" style="font-size:13px;margin-bottom:10px">${T('改變觀念，就改變生命；改變生命，就改變生活。','改变观念，就改变生命；改变生命，就改变生活。','Change your mindset, and your life is changed; change your life, and your living is changed.')}</div>
    ${row('3', T('三個基礎','三个基础','The three foundations'),
      T('耶穌是我的榜樣　聖經是我的準則　聖靈是我的引導','耶稣是我的榜样　圣经是我的准则　圣灵是我的引导','Jesus is my Role Model · The Bible is my Standard · The Holy Spirit is my Guide'))}
    ${row('2', T('兩個核心','两个核心','The two core values'),
      T('讓耶穌作王　讓耶穌得著一切的榮耀','让耶稣作王　让耶稣得着一切的荣耀','Let Jesus be King · Let Jesus receive all the glory'))}
    ${row('1', T('一個目的','一个目的','The one purpose'),
      T('建立屬神的體系，成就主禱文：願你的國降臨，願你的旨意行在地上如同行在天上','建立属神的体系，成就主祷文：愿你的国降临，愿你的旨意行在地上如同行在天上','To build God’s system — the fulfilment of the Lord’s Prayer: Your kingdom come, Your will be done on earth as it is in heaven'))}
    <details class="i321-more">
      <summary>${T('再多認識一點','再多认识一点','Learn a little more')}</summary>
      <p>${T('舊人有己，以自己為中心，驕傲、離開本位、想要代替神，這是問題的根源；耶穌的死解決我們的罪，耶穌的復活賜給我們新生命。「我已經與基督同釘十字架，現在活著的不再是我，乃是基督在我裡面活著。」（加拉太書 2:20）',
          '旧人有己，以自己为中心，骄傲、离开本位、想要代替神，这是问题的根源；耶稣的死解决我们的罪，耶稣的复活赐给我们新生命。“我已经与基督同钉十字架，现在活着的不再是我，乃是基督在我里面活着。”（加拉太书 2:20）',
          'The old self is full of self (self-centredness): in pride it leaves its position and grasps at God’s authority, wanting to take His place — this is the root of the problem. Jesus’ death deals with our sin, and His resurrection gives us new life. “I have been crucified with Christ; and it is no longer I who live, but Christ lives in me.” (Galatians 2:20)')}</p>
      <p>${T('無己，不是沒有，乃是讓基督在裡面活，進入無限。由內而外五重的改變：觀念、生命、生活、關係、事工。謙卑戰勝驕傲，無己戰勝撒旦，一同成為得勝者。',
          '无己，不是没有，乃是让基督在里面活，进入无限。由内而外五重的改变：观念、生命、生活、关系、事工。谦卑战胜骄傲，无己战胜撒旦，一同成为得胜者。',
          'Selflessness (“self is absent”) is not emptiness — it is letting Christ live in us and entering the infinite. The five-fold change from the inside out: Mindset → Life → Living → Relationships → Ministry. Humility overcomes pride, selflessness overcomes Satan, and together we become victors.')}</p>
    </details>
  </div>`;
}

function currentRoute(){
  const h = (location.hash || '#/today').replace(/^#/, '');
  return h.split('/').filter(Boolean);
}
async function render(){
  const r = currentRoute();
  const tab = r[0] || 'today';
  if (EMBED && tab !== 'studio'){ if (studioItem) location.hash = '#/studio'; else embedClose(); return; }
  navTrack();
  $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === (tab === 'read' ? 'books' : ((tab === 'plan' || tab === 'play' || tab === 'meet') ? 'today' : tab))));
  const v = $('#view');
  try{
    if (tab === 'today')          await viewToday(v);
    else if (tab === 'books')     await viewBooks(v, r[1]);
    else if (tab === 'read')      await viewReader(v, r[1], parseInt(r[2] || '1', 10));
    else if (tab === 'search')    await viewSearch(v);
    else if (tab === 'companion') await viewCompanion(v);
    else if (tab === 'team')      await viewTeam(v, r[1], r[2]);
    else if (tab === 'me')        await viewMe(v);
    else if (tab === 'studio')    await viewStudio(v);
    else if (tab === 'plan')      await viewPlan(v);
    else if (tab === 'play')      await viewPlay(v);
    else if (tab === 'meet')      await viewMeet(v);
    else { go('#/today'); return; }
  }catch(e){
    v.innerHTML = `<div class="empty">載入失敗：${esc(e.message || e)}</div>`;
    console.error(e);
  }
  if (tab === 'read' && ttsAutoNextPending){
    ttsAutoNextPending = false;
    ttsStart();   // 接著唸下一章；ttsUnlock() 裡已經解鎖過，這裡不在點擊手勢裡也還是播得出來
  }
  if (tab !== 'read'){ bmMode = false; document.documentElement.classList.remove('bmmode'); }
  if (tab !== 'studio'){ stopSelfie(); if (recMode === 's') recMode = 'c'; }
  addNavButtons(v, tab);
  if (tab !== 'read' && tab !== 'studio') scrollToTop();
  if (tab === 'studio'){ mjDoneItem = null; mjRestore(); }
  mjPill();
  crAfter();
}


/* 每一頁都有「上一頁／首頁／經卷」：沒有自己頂部工具列的頁面，在最上面補一條；有工具列的（閱讀器、章節、美圖）把按鈕併進去 */
function addNavButtons(v, tab){
  try{
    if (!document.getElementById('navlblCss')){
      const st = document.createElement('style'); st.id = 'navlblCss';
      st.textContent = '.navlbl{font-weight:700!important;font-size:14.5px!important;color:var(--accent)!important;padding:0 12px!important;white-space:nowrap;gap:4px}'
        + '.xz-back.navlbl{width:auto!important;min-width:0;border:1px solid var(--border-strong);border-radius:9px;background:var(--surface);height:36px}'
        + '.chtoolbar{flex-wrap:wrap;row-gap:8px}'
        /* 上面已經有「‹ 上一頁／🏠 首頁」那一列時，不再重複一顆上一頁（小智收合時那一列會藏起來，才顯示小智自己的） */
        + '.chatwrap:not(.xzc) .xz-back,#plBack{display:none!important}';
      document.head.appendChild(st);
    }
    if (!v || tab === 'today') return;
    const goBack = () => {
      /* 計畫進度頁其實是「選單」按了開始之後同一個網址換畫面，所以「上一頁」要先退回計畫選單 */
      if (tab === 'plan' && user.plan && user.plan.active){ switchPlan(); return; }
      if (tab === 'play' && PL){ PL = null; plPaint(); return; }   /* 讀經樂：先退出正在玩的遊戲 */
      appBack();
    };
    const mk = (txt, title, fn) => { const b = document.createElement('button'); b.className = 'chtb-btn gnavb navlbl'; b.textContent = txt; b.title = title; b.setAttribute('aria-label', title); b.onclick = fn; return b; };
    const tHome = L3('回首頁', '回首页', 'Home'), tBooks = L3('經卷', '经卷', 'Books'), tBack = L3('上一頁', '上一页', 'Back');
    const home = () => mk('🏠 ' + L3('首頁', '首页', 'Home'), tHome, appHome), books = () => mk('📖 ' + tBooks, tBooks, () => go('#/books'));
    const first = v.firstElementChild;
    if (first && first.classList.contains('chtoolbar')){
      if (tab === 'read'){ first.insertBefore(home(), first.firstChild); first.insertBefore(books(), first.firstChild); }
      else first.insertBefore(home(), first.children[1] || null);
      return;
    }
    const bar = document.createElement('div');
    bar.className = 'chtoolbar gnav';
    const bb = mk('‹ ' + tBack, tBack, goBack); bar.appendChild(bb);
    bar.appendChild(home());
    if (tab !== 'books') bar.appendChild(books());
    v.insertBefore(bar, v.firstChild);
  }catch(e){ console.error(e); }
}

/* ================================================================ 聚會與奉獻（複製自空中團契 App） */
const MEET_TZ_OFFSET = 8;   /* 聚會時間以台北時間（UTC+8，無夏令時間）為準 */
const MEET_URL = 'https://zoom.us/j/8193972372?pwd=o3tuX9k87Lyhb3UEV7hgRtSUYVyI1Q.1';
const MEET_ID = '819 397 2372', MEET_PASS = '321';
const YT_URL = 'https://www.youtube.com/@kingdom321air';
const MEETINGS = [
  { t: ['晨讀', '晨读', 'Morning Reading'], days: [1,2,3,4,5,6], s: '06:00', e: '07:00' },
  { t: ['午修靈糧', '午修灵粮', 'Midday Manna'], days: [1,2,3,4,5], s: '12:10', e: '13:00' },
  { t: ['晚禱', '晚祷', 'Evening Prayer'], days: [1,2,3,4,5], s: '21:00', e: '22:00' }
];
const OFFERING = [
  { c: ['台灣', '台湾', 'Taiwan'], holder: '社團法人中華活力全人關懷協會', bank: '新光商業銀行 新埔分行', acct: '(103) 0338101013000' },
  { c: ['馬來西亞', '马来西亚', 'Malaysia'], holder: '馬來西亞安提阿教會', bank: 'Public Bank', acct: '3178557627' },
  { c: ['紐西蘭', '纽西兰', 'New Zealand'], holder: 'Bin Lu', bank: 'ASB Bank Auckland Branch', acct: '12-3231-0055109-00' },
  { c: ['新加坡', '新加坡', 'Singapore'], holder: 'LEE CHEW YONG', bank: 'DBS My Account', acct: '275-153637-9' },
  { c: ['中國', '中国', 'China'], title: ['微信支付', '微信支付', 'WeChat Pay'], qr: 'wxpay.jpg', cap: '321祝福(**淑)' }
];
const mtTitle = m => L3(m.t[0], m.t[1], m.t[2]);
/* 找出某堂聚會「下一次（或正在進行中）」的起訖時間（UTC 毫秒） */
function mtOccur(m, now){
  now = now || Date.now();
  const sp = m.s.split(':').map(Number), ep = m.e.split(':').map(Number);
  const sh = new Date(now + MEET_TZ_OFFSET * 3600000);   /* 以台北時間的「日期」起算 */
  const base = Date.UTC(sh.getUTCFullYear(), sh.getUTCMonth(), sh.getUTCDate());
  for (let k = 0; k < 9; k++){
    const day = new Date(base + k * 86400000);
    if (!m.days.includes(day.getUTCDay())) continue;
    const st = day.getTime() + (sp[0] - MEET_TZ_OFFSET) * 3600000 + sp[1] * 60000;
    let en = day.getTime() + (ep[0] - MEET_TZ_OFFSET) * 3600000 + ep[1] * 60000;
    if (en <= st) en += 86400000;
    if (now < en) return { start: st, end: en, live: now >= st, m };
  }
  return null;
}
function mtNext(now){
  let best = null;
  for (const m of MEETINGS){
    const o = mtOccur(m, now);
    if (!o) continue;
    if (o.live) return o;
    if (!best || o.start < best.start) best = o;
  }
  return best;
}
const mtWd = d => L3('週' + '日一二三四五六'[d], '周' + '日一二三四五六'[d], ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]);
const mtHm = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); };
function mtUntil(ms){
  const mins = Math.round(ms / 60000);
  if (mins < 1) return L3('就要開始了', '就要开始了', 'Starting now');
  if (mins < 60) return L3(`還有 ${mins} 分鐘`, `还有 ${mins} 分钟`, `in ${mins} min`);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h < 24) return L3(`還有 ${h} 小時${m ? ' ' + m + ' 分' : ''}`, `还有 ${h} 小时${m ? ' ' + m + ' 分' : ''}`, `in ${h} hr${m ? ' ' + m + ' min' : ''}`);
  const d = Math.floor(h / 24), hh = h % 24;
  return L3(`還有 ${d} 天${hh ? ' ' + hh + ' 小時' : ''}`, `还有 ${d} 天${hh ? ' ' + hh + ' 小时' : ''}`, `in ${d} day${d > 1 ? 's' : ''}${hh ? ' ' + hh + ' hr' : ''}`);
}
function meetCss(){
  if (document.getElementById('meetcss')) return;
  const st = document.createElement('style'); st.id = 'meetcss';
  st.textContent = '.nextmtg{background:linear-gradient(160deg,#1d4a86,#0f2547);color:#fff;border-radius:16px;padding:18px;margin-bottom:12px}'
   + '.nextmtg .nm-k{display:inline-block;background:rgba(255,255,255,.16);color:#e8c66a;border-radius:99px;padding:3px 12px;font-size:.8em;font-weight:700}'
   + '.nextmtg h4{margin:10px 0 4px;font-size:1.35em}.nextmtg .nm-t{font-size:1em;opacity:.95}.nextmtg .nm-sub{font-size:.85em;opacity:.8;margin-top:2px}'
   + '.nextmtg .mt-cd{color:#e8c66a;font-weight:700;margin:8px 0 12px;font-size:.95em}'
   + '.nextmtg .btn{width:100%;background:#8d6700;border-color:#8d6700;color:#fff}'
   + '.mtrow{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}.mtrow:last-child{border-bottom:none}'
   + '.mttime{flex:0 0 auto;min-width:96px;background:#eaf0f9;color:#14233f;border-radius:12px;padding:8px 10px;text-align:center;font-size:.9em;line-height:1.5}'
   + '.mttime b{display:block;font-size:1.02em}.mttime small{display:block;color:#5b6b85;font-size:.85em}'
   + '.mtmid{flex:1;min-width:0}.mtmid .t{font-weight:700}.mtmid .s{font-size:.85em;color:var(--ink-faint)}.mtmid .cd{font-size:.85em;color:#1d4a86;font-weight:700}'
   + '.offer{border:1px solid var(--border);border-radius:12px;padding:14px;margin-top:10px}.offer .oc{display:inline-block;background:#14233f;color:#fff;border-radius:8px;padding:3px 10px;font-size:.8em;font-weight:700}'
   + '.offer .oh{font-weight:800;margin:8px 0 2px;overflow-wrap:anywhere}.offer .od{color:var(--ink-faint);font-size:.92em}.offer .oa{font-family:ui-monospace,Menlo,monospace;font-size:1.05em;margin:6px 0 10px;overflow-wrap:anywhere}'
   + '.offer .onote{background:#faf3e0;border:1px solid #ecd9a2;border-radius:10px;padding:8px 10px;font-size:.85em;margin-bottom:10px}';
  document.head.appendChild(st);
}
function nextMeetCard(){
  const o = mtNext();
  if (!o) return '';
  const sd = new Date(o.start);
  const tp = new Date(o.start + MEET_TZ_OFFSET * 3600000);
  const sameTz = (-new Date().getTimezoneOffset() / 60) === MEET_TZ_OFFSET;
  return `<div class="nextmtg" data-s="${o.start}" data-e="${o.end}">
    <span class="nm-k">${esc(o.live ? L3('正在聚會', '正在聚会', 'Live now') : L3('下一堂', '下一堂', 'Next'))}</span>
    <h4>${esc(mtTitle(o.m))}</h4>
    <div class="nm-t">${esc(L3('你的時間', '你的时间', 'Your time'))}　${esc(mtWd(sd.getDay()))} ${mtHm(o.start)}–${mtHm(o.end)}</div>
    ${sameTz ? '' : `<div class="nm-sub">${esc(L3('台北時間', '台北时间', 'Taipei'))}　${esc(mtWd(tp.getUTCDay()))} ${o.m.s}–${o.m.e}</div>`}
    <div class="mt-cd">${esc(o.live ? L3('進行中', '进行中', 'In progress') : mtUntil(o.start - Date.now()))}</div>
    <a class="btn" href="${esc(MEET_URL)}" target="_blank" rel="noopener">${esc(o.live ? L3('立即加入', '立即加入', 'Join now') : L3('一鍵加入聚會', '一键加入聚会', 'Join the meeting'))}</a>
  </div>`;
}
async function viewMeet(v){
  meetCss();
  const rows = MEETINGS.map(m => {
    const o = mtOccur(m); if (!o) return '';
    const sd = new Date(o.start);
    return `<div class="mtrow"><div class="mttime"><b>${mtHm(o.start)}–${mtHm(o.end)}</b><small>${esc(mtWd(sd.getDay()))}</small><small>${esc(L3('你的時間', '你的时间', 'Your time'))}</small></div>
      <div class="mtmid"><div class="t">${esc(mtTitle(m))}</div><div class="s">Zoom · ${esc(L3('台北', '台北', 'Taipei'))} ${m.s}–${m.e}</div><div class="cd">${esc(o.live ? L3('進行中', '进行中', 'In progress') : mtUntil(o.start - Date.now()))}</div></div>
      <a class="btn primary sm" href="${esc(MEET_URL)}" target="_blank" rel="noopener">${esc(L3('加入', '加入', 'Join'))}</a></div>`;
  }).join('');
  const offs = OFFERING.map((a, i) => `<div class="offer"><span class="oc">${esc(L3(a.c[0], a.c[1], a.c[2]))}</span>
      ${a.qr ? `<div class="oh" style="text-align:center">${esc(L3(a.title[0], a.title[1], a.title[2]))}</div><img src="${a.qr}" alt="${esc(a.cap)}" style="display:block;width:100%;max-width:300px;margin:8px auto;border-radius:10px"><div class="od" style="text-align:center">${esc(a.cap)}</div></div>` : `<div class="oh">${esc(a.holder)}</div><div class="od">${esc(a.bank)}</div><div class="oa">${esc(a.acct)}</div>
      <button class="btn" data-copy="${i}">📋 ${esc(L3('複製帳號', '复制帐号', 'Copy account number'))}</button></div>`}`).join('');
  v.innerHTML = `
    <div class="section-title">${esc(L3('永遠可用', '永远可用', 'ALWAYS HERE'))}</div>
    <h2 style="margin:0 0 4px">${esc(L3('聚會與工具', '聚会与工具', 'Meet & Tools'))}</h2>
    <div class="muted" style="margin-bottom:14px">${esc(L3('把最高頻的行動集中在這裡', '把最高频的行动集中在这里', 'Everything you reach for most, in one place'))}</div>
    <div class="card"><h3 style="margin:0 0 10px">🎥 ${esc(L3('線上聚會 Zoom', '线上聚会 Zoom', 'Online Meeting · Zoom'))}</h3>
      <a class="btn primary block" href="${esc(MEET_URL)}" target="_blank" rel="noopener">${esc(L3('一鍵加入聚會', '一键加入聚会', 'Join the meeting'))}</a>
      <div class="muted" style="margin-top:10px;font-size:.92em">${esc(L3('會議號：', '会议号：', 'Meeting ID: '))}<b>${MEET_ID}</b>　${esc(L3('密碼：', '密码：', 'Passcode: '))}<b>${MEET_PASS}</b></div></div>
    <div class="card"><h3 style="margin:0 0 10px">▶️ ${esc(L3('YouTube 頻道', 'YouTube 频道', 'YouTube Channel'))}</h3>
      <a class="btn block" href="${esc(YT_URL)}" target="_blank" rel="noopener">${esc(L3('前往 YouTube 頻道', '前往 YouTube 频道', 'Go to the YouTube channel'))}</a></div>
    <div class="section-title">${esc(L3('聚會時間表', '聚会时间表', 'MEETING SCHEDULE'))}</div>
    <div id="mtNext">${nextMeetCard()}</div>
    <div class="card" id="mtRows" style="padding:4px 16px">${rows}</div>
    <div class="muted" style="text-align:center;font-size:.9em;margin-bottom:6px">${esc(L3('同一個 Zoom · 天天都在', '同一个 Zoom · 天天都在', 'One Zoom · every day'))}</div>
    <div class="section-title">${esc(L3('奉獻支持', '奉献支持', 'GIVING'))}</div>
    <div class="card"><h3 style="margin:0 0 6px">🎁 ${esc(L3('奉獻支持', '奉献支持', 'Giving'))}</h3>
      <div class="muted" style="font-size:.92em">${esc(L3('奉獻是回應神的供應，出於甘心樂意（林後九7）。凡事謝恩，把榮耀歸給神。', '奉献是回应神的供应，出于甘心乐意（林后九7）。凡事谢恩，把荣耀归给神。', 'Giving is our response to God’s provision, offered cheerfully (2 Corinthians 9:7). Give thanks in everything, and give the glory to God.'))}</div>
      ${offs}</div>`;
  $$('[data-copy]', v).forEach(b => b.onclick = async () => {
    const a = OFFERING[+b.dataset.copy].acct;
    try{ await navigator.clipboard.writeText(a); toast(L3('已複製帳號', '已复制帐号', 'Account number copied')); }
    catch(e){ const ta = document.createElement('textarea'); ta.value = a; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); toast(L3('已複製帳號', '已复制帐号', 'Account number copied')); }catch(_){ toast(a); } ta.remove(); }
  });
  /* 每 30 秒更新倒數；離開頁面就停 */
  const tm = setInterval(() => {
    if (!document.body.contains(v) || currentRoute()[0] !== 'meet'){ clearInterval(tm); return; }
    const n = $('#mtNext', v); if (n) n.innerHTML = nextMeetCard();
  }, 30000);
}
/* 團契簡介（今日頁） */
function introAir(){
  const T = (zh, zs, en) => esc(L3(zh, zs, en));
  return `<div class="card">
    <h3 style="margin:0 0 6px">${T('國度321空中團契', '国度321空中团契', 'Kingdom 321 Online Fellowship')}</h3>
    <div class="muted" style="font-size:13px;margin-bottom:8px">${T('連結世界各國敬虔愛神的人，每天在線上一起讀經、一起得勝', '连结世界各国敬虔爱神的人，每天在线上一起读经、一起得胜', 'Godly believers from many nations, reading the Word and growing together online every day')}</div>
    <p style="margin:0 0 8px;line-height:1.75;font-size:.95em">${T('我們是一個以「321理念」為核心的線上團契，連結台灣、馬來西亞、中國、印尼、新加坡、紐西蘭、澳洲、韓國、日本等多個國家敬虔愛神的人，每天透過線上聚會一同學習聖經真理，操練活出基督的生命。', '我们是一个以“321理念”为核心的线上团契，连结台湾、马来西亚、中国、印尼、新加坡、纽西兰、澳洲、韩国、日本等多个国家敬虔爱神的人，每天透过线上聚会一同学习圣经真理，操练活出基督的生命。', 'We are an online fellowship built on the 3-2-1 ideology, connecting godly believers in Taiwan, Malaysia, China, Indonesia, Singapore, New Zealand, Australia, Korea, Japan and many other countries. Every day we meet online to learn the truth of Scripture and practise living out the life of Christ.')}</p>
    <p style="margin:0 0 8px;line-height:1.75;font-size:.95em">${T('我們看見自己的問題——舊人有己、驕傲、想代替神；也看見神的恩典——耶穌的死解決我們的罪，耶穌的復活賜給我們新生命。我們一起操練「920」：每個與我們有關係的人是我們的「2」，活出無己的「0」，結出聖靈的九種果子；再發展「235」：屬靈同伴(2)、屬靈父母兒女(3)、屬靈戰友五重職份團隊(5)。', '我们看见自己的问题——旧人有己、骄傲、想代替神；也看见神的恩典——耶稣的死解决我们的罪，耶稣的复活赐给我们新生命。我们一起操练“920”：每个与我们有关系的人是我们的“2”，活出无己的“0”，结出圣灵的九种果子；再发展“235”：属灵同伴(2)、属灵父母儿女(3)、属灵战友五重职份团队(5)。', 'We see our problem — the old self-centred life, pride, wanting to take God’s place — and we see God’s grace: Jesus’ death deals with our sin, and His resurrection gives us new life. Together we practise “920” (everyone in relationship with us is our “2”; we live out selflessness, the “0”; and bear the nine-fold fruit of the Spirit) and grow “235” (spiritual companions, spiritual parents and children, and a five-fold team of co-workers).')}</p>
    <p style="margin:0 0 12px;line-height:1.75;font-size:.95em">${T('建立屬神的體系，邁進末後的大復興，迎接主耶穌再來；陪伴每個人成為得勝者，將來在神國與基督同坐寶座、同作王直到永遠。', '建立属神的体系，迈进末后的大复兴，迎接主耶稣再来；陪伴每个人成为得胜者，将来在神国与基督同坐宝座、同作王直到永远。', 'We are building God’s system, moving into the final great revival and awaiting the Lord Jesus’ return, walking with everyone to become victors who will sit with Christ on His throne and reign forever.')}</p>
    <a class="btn primary block" href="#/meet">${T('聚會時間與奉獻支持', '聚会时间与奉献支持', 'Meeting times & giving')}</a>
  </div>`;
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
    <div class="hero-cover"><img src="${HERO_IMG}" alt="" loading="eager"></div>

    ${intro321()}

    ${introAir()}

    <div id="todayNext"></div>

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
      <div class="dailyref">${esc(bname(BOOK[db]))} ${esc(chapLabel(db, dc))}</div>
      <div style="margin-top:12px"><a class="btn gold block" href="#/read/${db}/${dc}">${esc(L.read)}</a></div>
    </div>

    <div class="section-title">${esc(L3('快速進入', '快速进入', 'Jump to'))}</div>
    <div class="card" style="padding:4px 16px">
      <a class="rowlink" href="#/meet"><div class="meta"><div class="t">🎥 ${esc(L3('聚會與奉獻', '聚会与奉献', 'Meetings & Giving'))}</div>
        <div class="s">${esc(L3('Zoom 連結、聚會時間表、奉獻帳號', 'Zoom 链接、聚会时间表、奉献帐号', 'Zoom link, schedule and giving accounts'))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/play"><div class="meta"><div class="t">🎯 ${esc(L3('讀經樂：猜謎與測驗', '读经乐：猜谜与测验', 'Bible Fun: Riddles & Quiz'))}</div>
        <div class="s">${esc(L3('玩一玩，加深對經文的記憶', '玩一玩，加深对经文的记忆', 'Play to remember what you read'))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/plan"><div class="meta"><div class="t">${esc(L.plan)}</div>
        <div class="s">${user.plan.active ? esc(L.progress) : esc(L.planTitle)}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/read/Psalms/${(new Date().getDate() % 150) + 1}">
        <div class="meta"><div class="t">${esc(bname(BOOK['Psalms']))}</div><div class="s">${esc(chapLabel('Psalms', (new Date().getDate() % 150) + 1))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/read/John/1"><div class="meta"><div class="t">${esc(bname(BOOK['John']))}</div><div class="s">${esc(L.chapter(1))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/books"><div class="meta"><div class="t">${esc(L.books)}</div><div class="s">66 ${esc(L.bookUnit)}</div></div><div class="chev">›</div></a>
    </div>`;

  meetCss(); { const tn = $('#todayNext', v); if (tn) tn.innerHTML = nextMeetCard(); }
  const rb = $('#resumeBtn', v);
  if (rb) rb.onclick = () => {
    if (last.a) jumpTo = last.a;
    go(`#/read/${last.book}/${last.ch}`);
  };
}

/* ================================================================ 讀經獎章（v2.10.0）
   讀經計畫裡某一卷書的每一天都打勾，就算「這卷書達標」：跳出動畫獎勵圖，
   並在「經卷」目錄那卷書上留下 🏅。獎章記在 user.rewards{書卷id:時間}，
   一旦拿到就永久保留——之後重新開始計畫、清掉打勾也不會被收回。
   只有「剛剛才讀完的那一卷」會播動畫；更新前就已完成的卷，進目錄時悄悄補上標示，
   不會一次跳出一堆動畫。 */
const RW_COLORS = [
  ['#EDB955', '#B8761A'], ['#E58467', '#A8442F'], ['#82BE95', '#3E7D4C'],
  ['#78A0DA', '#2D5AA8'], ['#AE94D2', '#6A4C9C'], ['#E99AAA', '#B4435F'],
  ['#58BAC6', '#1F7A86'], ['#A3B0BD', '#5A6B7C'], ['#F6D766', '#C08A14']
];
const rwGroupOf = id => { const i = TOC.findIndex(x => x.id === id); const g = GROUPS.findIndex(gr => i >= gr.a && i < gr.b); return g < 0 ? 0 : g; };
const rwCount = () => Object.keys(user.rewards || {}).length;
const RW_CSS = `
.bkbtn{position:relative}
.bkbtn.rw{border-color:var(--gold);background:linear-gradient(var(--gold-soft),var(--bg))}
.bkbtn .rw-b{position:absolute;top:-7px;right:-4px;font-size:17px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))}
.rw-line{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--gold);font-weight:700;margin:0 2px 10px}
.rw-mask{position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;padding:20px;
  background:radial-gradient(circle at 50% 38%,rgba(255,226,140,.28),rgba(6,24,60,.82) 62%);backdrop-filter:blur(2px);overflow:hidden;animation:rwfade .35s ease-out}
@keyframes rwfade{from{opacity:0}to{opacity:1}}
.rw-card{position:relative;z-index:2;width:min(340px,100%);text-align:center;color:#fff;animation:rwpop .75s cubic-bezier(.2,1.5,.4,1) both}
@keyframes rwpop{0%{transform:scale(.2) rotate(-14deg);opacity:0}60%{transform:scale(1.08) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0)}}
.rw-medal{width:210px;height:230px;margin:0 auto -4px;display:block;overflow:visible}
.rw-rays{transform-origin:100px 96px;animation:rwspin 14s linear infinite}
@keyframes rwspin{to{transform:rotate(360deg)}}
.rw-shine{animation:rwshine 2.6s ease-in-out .9s infinite}
@keyframes rwshine{0%{transform:translateX(-120px)}55%,100%{transform:translateX(160px)}}
.rw-tw{animation:rwtw 1.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
@keyframes rwtw{0%,100%{transform:scale(.4);opacity:.3}50%{transform:scale(1.15);opacity:1}}
.rw-t1{font-family:var(--f-serif);font-size:15px;letter-spacing:.3em;color:#F5E3A8;font-weight:700;animation:rwup .6s .5s both}
.rw-t2{font-family:var(--f-serif);font-size:28px;font-weight:900;margin:2px 0 6px;text-shadow:0 2px 14px rgba(0,0,0,.6);animation:rwup .6s .62s both}
.rw-t3{font-size:14.5px;line-height:1.75;color:#EEF2FA;animation:rwup .6s .75s both}
.rw-t4{display:inline-block;margin-top:8px;padding:3px 12px;border-radius:99px;background:rgba(255,226,140,.18);border:1px solid rgba(255,226,140,.5);color:#F5E3A8;font-size:12.5px;font-weight:700;animation:rwup .6s .85s both}
.rw-acts{display:flex;gap:10px;margin-top:16px;animation:rwup .6s 1s both}
.rw-acts .btn{flex:1}
.rw-acts .btn.ghost{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.35);color:#fff}
@keyframes rwup{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
.rw-conf{position:absolute;top:-12px;width:10px;height:14px;border-radius:2px;opacity:0;z-index:1;animation:rwfall var(--d) linear var(--dl) infinite}
@keyframes rwfall{0%{transform:translate3d(0,-10px,0) rotate(0);opacity:0}8%{opacity:1}100%{transform:translate3d(var(--dx),105vh,0) rotate(var(--r));opacity:.9}}
@media (prefers-reduced-motion:reduce){.rw-rays,.rw-shine,.rw-tw,.rw-conf{animation:none}.rw-conf{display:none}.rw-card{animation:none}}
`;
function rwCss(){
  if ($('#rwcss')) return;
  const el = document.createElement('style'); el.id = 'rwcss'; el.textContent = RW_CSS;
  document.head.appendChild(el);
}
function rwMedalSvg(id){
  const [c1, c2] = RW_COLORS[rwGroupOf(id) % RW_COLORS.length];
  const ab = babbr(BOOK[id]);
  const fs = ab.length > 2 ? 40 : (ab.length === 2 ? 50 : 62);
  const rays = Array.from({ length: 12 }, (_, i) =>
    `<path d="M100 96 L92 -14 L108 -14 Z" fill="rgba(255,226,140,.42)" transform="rotate(${i * 30} 100 96)"/>`).join('');
  return `<svg class="rw-medal" viewBox="0 0 200 230" aria-hidden="true">
    <defs>
      <radialGradient id="rwg1" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#FFF3C4"/><stop offset=".5" stop-color="#F0C45A"/><stop offset="1" stop-color="#B8761A"/></radialGradient>
      <linearGradient id="rwg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
      <clipPath id="rwclip"><circle cx="100" cy="96" r="58"/></clipPath>
    </defs>
    <g class="rw-rays">${rays}</g>
    <path d="M64 150 L44 224 L72 210 L86 228 L100 156 Z" fill="#C23B3B"/>
    <path d="M136 150 L156 224 L128 210 L114 228 L100 156 Z" fill="#9E2B2B"/>
    <circle cx="100" cy="96" r="72" fill="url(#rwg1)"/>
    <circle cx="100" cy="96" r="66" fill="none" stroke="#FFF3C4" stroke-width="2" stroke-dasharray="3 5" opacity=".9"/>
    <circle cx="100" cy="96" r="58" fill="url(#rwg2)"/>
    <g clip-path="url(#rwclip)"><rect class="rw-shine" x="-20" y="30" width="26" height="140" fill="#fff" opacity=".35" transform="rotate(20 100 96)"/></g>
    <text x="100" y="${96 + fs * .34}" text-anchor="middle" font-family="'Noto Serif TC','Noto Serif SC',Georgia,serif" font-weight="900" font-size="${fs}" fill="#fff" style="paint-order:stroke;stroke:rgba(0,0,0,.28);stroke-width:2px">${esc(ab)}</text>
    <g fill="#FFF3C4"><path class="rw-tw" d="M30 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/>
      <path class="rw-tw" style="animation-delay:.5s" d="M172 30 l2.5 6.5 6.5 2.5 -6.5 2.5 -2.5 6.5 -2.5 -6.5 -6.5 -2.5 6.5 -2.5z"/>
      <path class="rw-tw" style="animation-delay:1s" d="M178 120 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z"/></g>
  </svg>`;
}
let rwQueue = [], rwShowing = false, rwTimer = 0;
function rwLine(id){
  const a = state.audience;
  const b = BOOK[id], nm = bname(b);
  if (a === 'seeker') return SK_RW(nm);
  { const x2 = A2(); if (x2) return x2.rw.map(s => s.split('{nm}').join(nm)); }
  return {
    adult:[L3(`你讀完整卷《${nm}》了！`, `你读完整卷《${nm}》了！`, `You finished the whole book of ${nm}!`),
           L3('一天一天走到這裡，神的話已經在你裡面扎根。', '一天一天走到这里，神的话已经在你里面扎根。', 'Day by day you came this far — the Word is taking root in you.')],
    teen :[L3(`《${nm}》通關！`, `《${nm}》通关！`, `${nm} — cleared!`),
           L3('整卷讀完不是人人做得到，這枚獎章你拿得實至名歸。', '整卷读完不是人人做得到，这枚奖章你拿得实至名归。', 'Not everyone finishes a whole book — you earned this one.')],
    kid  :[L3(`哇！你讀完《${nm}》了！🎉`, `哇！你读完《${nm}》了！🎉`, `Wow! You finished ${nm}! 🎉`),
           L3('你好棒！神一定很高興，我們一起收下這枚金牌！🏅', '你好棒！神一定很高兴，我们一起收下这枚金牌！🏅', 'You did it! God is so happy. Here is your gold medal! 🏅')]
  }[a];
}
function rwShow(id, replay){
  rwCss();
  if (rwShowing){ rwQueue.push([id, replay]); return; }
  rwShowing = true;
  const b = BOOK[id], [l1, l2] = rwLine(id), n = rwCount();
  const mask = document.createElement('div'); mask.className = 'rw-mask';
  const cols = ['#F5C84B', '#E9695C', '#6FAE71', '#6C93D1', '#E58FA0', '#FFF3C4', '#A48AC9'];
  const conf = Array.from({ length: 34 }, (_, i) =>
    `<i class="rw-conf" style="left:${(i * 29 + Math.random() * 20) % 100}%;background:${cols[i % cols.length]};--d:${(2.6 + Math.random() * 2.4).toFixed(2)}s;--dl:${(Math.random() * 2.2).toFixed(2)}s;--dx:${Math.round(Math.random() * 120 - 60)}px;--r:${Math.round(240 + Math.random() * 480)}deg"></i>`).join('');
  mask.innerHTML = conf + `<div class="rw-card">
      ${rwMedalSvg(id)}
      <div class="rw-t1">${esc(L3('達　標', '达　标', 'GOAL REACHED'))}</div>
      <div class="rw-t2">${esc(bname(b))}</div>
      <div class="rw-t3">${esc(l1)}<br>${esc(l2)}</div>
      <div class="rw-t4">🏅 ${esc(L3(`第 ${n} 枚獎章　共 ${b.ch} 章`, `第 ${n} 枚奖章　共 ${b.ch} 章`, `Medal ${n} · ${b.ch} chapters`))}</div>
      <div class="rw-acts"><button class="btn ghost" id="rwShare">↗ ${esc(L3('分享', '分享', 'Share'))}</button>
        <button class="btn gold" id="rwOk">${esc(L3('收下獎章', '收下奖章', 'Collect'))}</button></div></div>`;
  document.body.appendChild(mask);
  try{ if (!replay && navigator.vibrate) navigator.vibrate([40, 60, 90]); }catch(e){}
  const close = () => {
    clearTimeout(rwTimer); mask.remove(); rwShowing = false;
    const nx = rwQueue.shift(); if (nx) setTimeout(() => rwShow(nx[0], nx[1]), 350);
  };
  $('#rwOk', mask).onclick = close;
  mask.onclick = e => { if (e.target === mask) close(); };
  $('#rwShare', mask).onclick = async () => {
    clearTimeout(rwTimer);
    const home = location.origin + location.pathname.replace(/index\.html$/, '');
    const text = '🏅 ' + l1 + '\n\n—— ' + (state.cardTop || L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Online Fellowship')) + '\n' + home;
    if (navigator.share){ try{ await navigator.share({ title: t().app, text }); return; }catch(e){ if (e && e.name === 'AbortError') return; } }
    try{ await navigator.clipboard.writeText(text); toast(L3('已複製，可以貼到群組裡', '已复制，可以贴到群组里', 'Copied — paste it anywhere'), 3000); }catch(e){}
  };
  rwTimer = setTimeout(close, 14000);
}
/* 這一卷在這個計畫裡的每一天都打勾了嗎 */
function rwBookDone(pid, id){
  const p = PLANS && PLANS[pid]; if (!p || p.kind === 'companion') return false;   // 陪讀計畫只讀部分章節，不算整卷達標
  let any = false;
  for (const d of p.days){
    if (d.book !== id) continue;
    any = true;
    if (!user.plan.done[planDayKey(pid, d.day)]) return false;
  }
  return any;
}
/* 剛剛讀完／打勾的那一卷：新達標就發獎章並播動畫 */
function rwCheckBook(pid, id){
  if (!id || !BOOK[id] || user.rewards[id]) return;
  if (!rwBookDone(pid, id)) return;
  user.rewards[id] = Date.now(); saveUser();
  rwShow(id, false);
}
/* 進目錄時悄悄補上「更新前就已完成」的卷（不播動畫） */
async function rwBackfill(){
  let P; try{ P = await loadPlans(); }catch(e){ return; }
  let ch = false;
  for (const pid of PLAN_IDS){
    if (!P[pid]) continue;
    const seen = {};
    P[pid].days.forEach(d => { seen[d.book] = 1; });
    for (const id in seen){ if (!user.rewards[id] && BOOK[id] && rwBookDone(pid, id)){ user.rewards[id] = Date.now(); ch = true; } }
  }
  if (ch) saveUser();
}

/* ================================================================ 經卷 / 章 */
async function viewBooks(v, bookId){
  const L = t();
  if (bookId && BOOK[bookId]) return viewChapters(v, bookId);
  const tabOT = !(location.hash.indexOf('nt') > -1);
  rwCss(); await rwBackfill();
  const html = GROUPS.map(g => {
    const bs = TOC.slice(g.a, g.b);
    const gr = bs.filter(b => user.rewards[b.id]).length;
    return `<details class="grp" open>
      <summary><span style="color:var(--gold)">◆</span>${esc(gname(g))}<span class="cnt">${gr ? '🏅' + gr + '/' : ''}${bs.length} ${esc(t().bookUnit)}</span></summary>
      <div class="bklist">${bs.map(b => {
        const done = readOfBook(b.id), rw = !!user.rewards[b.id];
        return `<button class="bkbtn ${done === b.ch ? 'done' : ''} ${rw ? 'rw' : ''}" data-b="${b.id}">${rw ? '<span class="rw-b">🏅</span>' : ''}${esc(bname(b))}
          <span class="bs">${done ? done + '/' : ''}${b.ch} ${esc(L.ch)}</span></button>`;
      }).join('')}</div></details>`;
  }).join('');
  v.innerHTML = `<div class="section-title">${esc(L.ot)} · ${esc(L.nt)}</div>
    <div class="rw-line"><span>🏅 ${esc(L3('讀經計畫獎章', '读经计划奖章', 'Reading-plan medals'))}　${rwCount()} / ${TOC.length}</span>
      <span class="muted" style="font-weight:400;font-size:11.5px">${esc(L3('讀完計畫中的整卷書就會得到', '读完计划中的整卷书就会得到', 'Finish a whole book in your plan to earn one'))}</span></div>${html}`;
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
    <div class="chtoolbar"><button class="chtb-btn navlbl" id="backBooks" title="${esc(L3('上一頁', '上一页', 'Back'))}">‹ ${esc(L3('上一頁', '上一页', 'Back'))}</button>
      <div style="flex:1"><div style="font-family:var(--f-serif);font-weight:900;font-size:19px">${esc(bname(b))}</div>
      <div class="muted">${b.ch} ${esc(L.ch)} · ${b.v} ${esc(L.verses)}</div></div>
      ${user.rewards[bookId] ? `<button class="chtb-btn on" id="rwAgain" title="${esc(L3('重看獎章', '重看奖章', 'Replay medal'))}">🏅</button>` : ''}</div>
    <div class="chgrid">${Array.from({length: b.ch}, (_, i) => {
      const n = i + 1, read = user.progress[bookId + '-' + n];
      return `<button class="chbtn ${n === cur ? 'now' : (read ? 'read' : '')}" data-c="${n}">${n}</button>`;
    }).join('')}</div>`;
  $('#backBooks', v).onclick = () => appBack('#/books');
  const ra = $('#rwAgain', v); if (ra) ra.onclick = () => rwShow(bookId, true);
  $$('.chbtn', v).forEach(x => x.onclick = () => go(`#/read/${bookId}/${x.dataset.c}`));
}

/* ================================================================ 讀經計畫
   三個現成計畫（一年／兩年／沉浸式三年，資料在 plans.json）都是同一套資料形狀：
   { totalDays, title:{zh,zs,en}, subtitle:{zh,zs,en}, days:[{day,book,start,end,week[,vol,volNo,year]}] }
   進度存法比照 user.progress 的「鍵存在即代表做過」慣例：
   user.plan = { active: 'y1'|'y2'|'immerse3'|null, starts:{[planId]:ts}, done:{[planId+'-'+day]:ts} } */
let PLANS = null;
const PLAN_IDS = ['y1', 'y2', 'immerse3', 'seeker', 'disciple'];   // 後兩個是「陪讀計畫」（kind:'companion'，有每週陪讀指引，不發經卷獎章）
async function loadPlans(){
  if (PLANS) return PLANS;
  PLANS = await fetchJSON('plans.json');
  return PLANS;
}
const planTitle = p => (p.title[state.lang] || (isX() && p.title.en) || p.title.zh);
const planSubtitle = p => (p.subtitle[state.lang] || (isX() && p.subtitle.en) || p.subtitle.zh);
const planDayKey = (pid, day) => pid + '-' + day;
function planDoneCount(pid){
  let n = 0; const pfx = pid + '-';
  for (const k in user.plan.done) if (k.indexOf(pfx) === 0) n++;
  return n;
}
/* 「今天／目前進度」＝目前為止第一個還沒打勾的那一天，不是照日曆天數往前推算。
   舊寫法是拿「距離開始日期經過幾個日曆天」來算第幾天，跟實際讀了多少天完全脫鉤：
   使用者反應：明明已經讀完第1–4章（第1、2天都打勾了），「前往閱讀」卻還是停在
   第1天創世記1–2章，沒有跟著已完成的進度往前走——尤其現在（v2.7.17）讀完會
   自動打勾，一次連讀好幾天份很正常，卡在日曆天數上完全不合理。
   改成看實際打勾進度：往後找目前第一個還沒打勾的那一天，讀得比日曆進度快
   （用朗讀一次聽完好幾章）或慢，都會準確反映「下一個還沒讀的是哪一天」。 */
function planTodayIndex(p){
  for (let day = 1; day <= p.totalDays; day++){
    if (!user.plan.done[planDayKey(p.id, day)]) return day;
  }
  return p.totalDays;
}
/* 詩篇用「篇」／Psalm，其餘用「章」／Chapter；單一章沿用既有的 chapLabel() */
function planRangeLabel(bookId, start, end){
  if (start === end) return chapLabel(bookId, start);
  return bookId === 'Psalms' ? t().psalmRange(start, end) : t().chapterRange(start, end);
}
function startPlan(pid){
  user.plan.active = pid;
  if (!user.plan.starts[pid]) user.plan.starts[pid] = Date.now();
  saveUser();
  loadPlans().then(P => { planSumUpdate(P[pid]); }).catch(() => {});
  render();
}
function switchPlan(){
  user.plan.active = null; user.plan.sum = null;
  saveUser();
  if ((user.teams || []).length) teamPingSoon();
  render();
}
function restartPlan(pid){
  if (!confirm(t().planRestartAsk)) return;
  user.plan.starts[pid] = Date.now();
  const pfx = pid + '-';
  Object.keys(user.plan.done).forEach(k => { if (k.indexOf(pfx) === 0) delete user.plan.done[k]; });
  saveUser();
  if (PLANS && PLANS[pid]) planSumUpdate(PLANS[pid]);
  render();
}
function togglePlanDone(pid, day){
  const k = planDayKey(pid, day);
  const turnedOn = !user.plan.done[k];
  if (user.plan.done[k]) delete user.plan.done[k]; else user.plan.done[k] = Date.now();
  saveUser();
  if (PLANS && PLANS[pid]) planSumUpdate(PLANS[pid]);
  render();
  if (turnedOn){ const dd = PLANS && PLANS[pid] && PLANS[pid].days.find(x => x.day === day); if (dd) rwCheckBook(pid, dd.book); }
}
/* ================================================================ 陪讀計畫（v2.14.0）
   kind:'companion' 的計畫（seeker 陪慕道友、disciple 陪屬靈兒女）多一份 weeks 資料：
   weeks[週] = { t:本週主題, i:陪讀者的提醒, q:[三個一起聊的問題], p:一句禱告 }，每一欄都是 {zh,zs,en}。
   進度、打勾、提醒都跟其他計畫共用；差別只有：每週指引卡、請小智幫忙預備、分享本週給對方，
   而且不發經卷獎章（只讀部分章節）。 */
const cpL = o => (o && (o[state.lang] || (isX() && o.en) || o.zh)) || '';
function companionPassage(d){ return bname(BOOK[d.book]) + ' ' + planRangeLabel(d.book, d.start, d.end); }
function companionShareText(p, today){
  const w = p.weeks[today.week], C = isEN() ? ': ' : '：';
  const qs = w.q.map((q, i) => (i + 1) + '. ' + cpL(q)).join('\n');
  return L3('我們這一週一起讀', '我们这一周一起读', 'This week we are reading together') + C + cpL(w.t) + '\n'
    + L3('今天讀', '今天读', 'Today') + C + companionPassage(today) + '\n\n' + cpL(w.i) + '\n\n'
    + L3('一起聊聊', '一起聊聊', 'Talk about') + C + '\n' + qs + '\n\n🙏 ' + cpL(w.p)
    + '\n\n—— ' + (state.cardTop || L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Online Fellowship'));
}
function companionAsk(p, today){
  const w = p.weeks[today.week], who = p.id === 'seeker'
    ? L3('一位慕道友', '一位慕道友', 'a seeker')
    : L3('我的屬靈兒女', '我的属灵儿女', 'my spiritual child');
  return L3(
    `我正在陪${who}讀「${cpL(p.title)}」，本週主題是「${cpL(w.t)}」，今天讀${companionPassage(today)}。請用淺顯溫暖的話，幫我預備今天的陪讀：這段經文的重點、可以怎麼開場、再給我三個可以問對方的問題，最後給一句禱告。`,
    `我正在陪${who}读“${cpL(p.title)}”，本周主题是“${cpL(w.t)}”，今天读${companionPassage(today)}。请用浅显温暖的话，帮我预备今天的陪读：这段经文的重点、可以怎么开场、再给我三个可以问对方的问题，最后给一句祷告。`,
    `I am walking with ${who} through "${cpL(p.title)}". This week's theme is "${cpL(w.t)}" and today we read ${companionPassage(today)}. In warm, plain words, help me prepare: the key point of the passage, how to open the conversation, three questions to ask, and a short prayer.`);
}
function companionGuideHtml(p, today){
  const w = p.weeks[today.week]; if (!w) return '';
  return `<div class="card cpguide">
    <div class="pill">${esc(L3('本週陪讀指引', '本周陪读指引', 'This week’s companion guide'))} · ${esc(t().planWeek(today.week))}</div>
    <h3 style="margin:6px 0 4px">${esc(cpL(w.t))}</h3>
    <div class="muted" style="font-size:13px;line-height:1.7">${esc(cpL(w.i))}</div>
    <div class="cpq-t">${esc(L3('可以一起聊的三個問題', '可以一起聊的三个问题', 'Three questions to talk through'))}</div>
    <ol class="cpq">${w.q.map(q => `<li>${esc(cpL(q))}</li>`).join('')}</ol>
    <div class="cppray">🙏 ${esc(cpL(w.p))}</div>
    <div class="cpbtns">
      <button class="btn gold" id="cpAsk">${esc(L3('請小智幫我預備今天的陪讀', '请小智帮我预备今天的陪读', 'Ask Xiaozhi to help me prepare'))}</button>
      <button class="btn" id="cpShare">${esc(L3('分享本週給對方', '分享本周给对方', 'Share this week with them'))}</button>
    </div>
  </div>`;
}
function bindCompanionGuide(v, p, today){
  if (!document.getElementById('cpcss')){
    const st = document.createElement('style'); st.id = 'cpcss';
    st.textContent = '.pairbox{border-color:var(--accent,#0D3988)}.pairhead{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.pairrow{display:flex;gap:10px;align-items:flex-start;margin-top:10px}.pairrow .meta{flex:1;min-width:0}.pairrow .s{font-size:.88em;line-height:1.6;color:var(--muted,#6b6455);overflow-wrap:anywhere}'
      + '.cpguide{border-color:var(--gold,#C8A24A)}.cpq-t{font-weight:700;margin:12px 0 4px;font-size:.95em}'
      + '.cpq{margin:0;padding-left:1.4em;font-size:.95em;line-height:1.75}.cpq li{margin:2px 0;overflow-wrap:anywhere}'
      + '.cppray{margin-top:10px;padding:9px 12px;border-radius:10px;background:var(--accent-soft,rgba(13,57,136,.07));font-size:.93em;line-height:1.7}'
      + '.cpbtns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.cpbtns .btn{flex:1 1 140px}';
    document.head.appendChild(st);
  }
  const ask = $('#cpAsk', v), sh = $('#cpShare', v);
  if (ask) ask.onclick = () => { const q = companionAsk(p, today); go('#/companion'); setTimeout(() => sendChat(q), 700); };
  if (sh) sh.onclick = async () => {
    const text = companionShareText(p, today);
    if (navigator.share){ try{ await navigator.share({ title: cpL(p.title), text }); return; }catch(e){ if (e && e.name === 'AbortError') return; } }
    try{ await navigator.clipboard.writeText(text); toast(L3('已複製，可以貼給對方', '已复制，可以贴给对方', 'Copied — paste it to them'), 3000); }catch(e){}
  };
}
/* ================================================================ 陪讀同步（v2.15.0）
   不另外架伺服器：每個人目前的計畫進度摘要放進 myStat().plan，跟著原本的 235 團隊同步一起送出去，
   夥伴在自己的計畫頁就能看到。user.plan.pair[計畫id] = 團隊代碼 記下「這個計畫跟哪個團隊同步」。
   摘要只有計畫id、已讀天數、第幾天、今天的經文（書卷id＋章範圍）與時間，不含任何個人內容。 */
/* v2.22.4：
   ① 每個讀過的計畫都記一份摘要（user.plan.sums），不只「目前選的」那一個——
     夥伴手機上選的是別的計畫、或換過計畫，原本就整個看不到，一律顯示「還沒開始」。
   ② 打勾後 1.5 秒就送出（原本等 20 秒，打完勾就關 App 的人永遠送不出去）；
     App 切到背景時若還有沒送出的進度，立刻送。 */
function planSumOf(p){
  const idx = planTodayIndex(p), d = p.days[idx - 1] || p.days[0];
  return { id:p.id, done:planDoneCount(p.id), total:p.totalDays, day:idx,
           b:d.book, s:d.start, e:d.end, ts:Date.now() };
}
function planSumUpdate(p, pushNow){
  if (!p) return;
  user.plan.sums = user.plan.sums || {};
  const sum = planSumOf(p);
  if (sum.done > 0 || user.plan.starts[p.id]) user.plan.sums[p.id] = sum;
  if (user.plan.active === p.id) user.plan.sum = sum;
  saveUser();
  if ((user.teams || []).length) teamPingSoon(1500);
}
/* 某位夥伴在某個計畫的摘要：先看他目前的計畫，再看 all（其他計畫） */
function pairSumOf(m, pid){
  const pl = m.stat && m.stat.plan;
  if (!pl) return null;
  if (pl.id === pid) return pl;
  return (pl.all && pl.all[pid]) || null;
}
/* 「陪讀夥伴」卡：連結一個團隊，看夥伴在同一個計畫走到哪裡 */
function pairAgo(ts){
  if (!ts) return L3('尚未同步', '尚未同步', 'not synced yet');
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d <= 0 ? L3('今天', '今天', 'today') : d === 1 ? L3('昨天', '昨天', 'yesterday') : L3(d + ' 天前', d + ' 天前', d + ' days ago');
}
function pairLabel(s){ return bname(BOOK[s.b]) + ' ' + planRangeLabel(s.b, s.s, s.e); }
function paintPair(v, p, today){
  const box = $('#pairBox', v); if (!box) return;
  const pid = p.id, code = user.plan.pair[pid];
  const tmList = (user.teams || []).filter(x => String(x.kind) === '2' || String(x.kind) === '3');
  const myDone = planDoneCount(pid);
  const title = L3('陪讀夥伴', '陪读伙伴', 'Reading partner');
  if (!code || !(user.teams || []).some(x => x.code === code)){
    box.innerHTML = `<div class="card pairbox"><div class="pill">${esc(title)}</div>
      <div class="muted" style="font-size:13px;line-height:1.7;margin:6px 0 10px">${esc(L3(
        '和對方連結後，雙方都能在這裡看到彼此讀到第幾天、今天讀哪一段。連結用的是「團隊」功能：兩個人加入同一個屬靈同伴（2）或屬靈父母兒女（3）團隊就可以。',
        '和对方连结后，双方都能在这里看到彼此读到第几天、今天读哪一段。连结用的是“团队”功能：两个人加入同一个属灵同伴（2）或属灵父母儿女（3）团队就可以。',
        'Once linked, you can each see here how far the other has read and today’s passage. Linking uses Teams: both of you join the same Spiritual Partner (2) or Parent & Child (3) team.'))}</div>
      ${tmList.map(x => `<button class="btn block" style="margin-bottom:8px" data-pair="${esc(x.code)}">${esc(L3('與「', '与“', 'Link with “'))}${esc(x.name)}${esc(L3('」連結', '”连结', '”'))}</button>`).join('')}
      <button class="btn gold block" id="pairTeam">${esc(tmList.length ? L3('建立或加入另一個團隊', '建立或加入另一个团队', 'Create or join another team') : L3('建立或加入團隊', '建立或加入团队', 'Create or join a team'))}</button></div>`;
    $$('[data-pair]', box).forEach(b => b.onclick = () => { user.plan.pair[pid] = b.dataset.pair; saveUser(); paintPair(v, p, today); pairPull(v, p, today); });
    $('#pairTeam', box).onclick = () => go('#/team');
    return;
  }
  const tm = teamCached(code);
  const others = tm ? memberList(tm).filter(m => m.uid !== user.uid) : [];
  const mine = user.plan.sum && user.plan.sum.id === pid ? user.plan.sum : null;
  const rows = others.map(m => {
    const s = pairSumOf(m, pid);
    if (!s){
      const op = m.stat && m.stat.plan && m.stat.plan.id && PLANS && PLANS[m.stat.plan.id];
      const why = op ? L3('正在讀「' + planTitle(op) + '」，還沒開始這個計畫', '正在读“' + planTitle(op) + '”，还没开始这个计划', 'Reading “' + planTitle(op) + '”; has not started this plan')
        : L3('還沒開始這個計畫，或尚未同步（請對方更新到最新版並打開一次）', '还没开始这个计划，或尚未同步（请对方更新到最新版并打开一次）', 'Has not started this plan, or not synced yet (ask them to update the app and open it once)');
      return `<div class="pairrow"><div class="tmavatar">${esc((m.nick || '?').slice(0, 1))}</div><div class="meta"><div class="t">${esc(m.nick || '?')}</div>
        <div class="s">${esc(why)}</div>${m.stat && m.stat.lastTs ? `<div class="s">${esc(L3('最近一次讀經', '最近一次读经', 'Last read'))}：${esc(pairAgo(m.stat.lastTs))}</div>` : ''}</div></div>`;
    }
    const pc = Math.round(s.done / s.total * 100);
    const diff = mine ? s.done - mine.done : 0;
    const note = !mine ? '' : diff === 0 ? L3('你們讀到同樣的進度，一起往前！', '你们读到同样的进度，一起往前！', 'You are at the same place. Keep going together!')
      : diff > 0 ? L3(`對方比你多讀 ${diff} 天，一起追上吧`, `对方比你多读 ${diff} 天，一起追上吧`, `They are ${diff} day(s) ahead; catch up together`)
      : L3(`你比對方多讀 ${-diff} 天，可以鼓勵他`, `你比对方多读 ${-diff} 天，可以鼓励他`, `You are ${-diff} day(s) ahead; encourage them`);
    return `<div class="pairrow"><div class="tmavatar">${esc((m.nick || '?').slice(0, 1))}</div><div class="meta"><div class="t">${esc(m.nick || '?')}　<span class="muted" style="font-size:12px">${s.done} / ${s.total} ${esc(t().planDaysUnit)}（${pc}%）</span></div>
      <div class="tmbar" style="margin:5px 0"><i style="width:${pc}%"></i></div>
      <div class="s">${esc(L3('今天讀', '今天读', 'Today'))}：${esc(pairLabel(s))}　·　${esc(pairAgo(s.ts))}</div>
      ${note ? `<div class="s" style="margin-top:3px">${esc(note)}</div>` : ''}</div></div>`;
  }).join('');
  box.innerHTML = `<div class="card pairbox"><div class="pairhead"><div class="pill">${esc(title)}　${esc(tm ? tm.name : code)}</div>
      <div><button class="btn sm" id="pairSync">⟳ ${esc(L3('同步', '同步', 'Sync'))}</button> <button class="btn sm" id="pairOff">${esc(L3('取消連結', '取消连结', 'Unlink'))}</button></div></div>
    ${rows || `<div class="muted" style="font-size:13px;line-height:1.7;margin-top:8px">${esc(L3('團隊裡還沒有其他人。把團隊代碼傳給對方，請他加入並開始同一個計畫。', '团队里还没有其他人。把团队代码传给对方，请他加入并开始同一个计划。', 'No one else is on the team yet. Send them the team code and ask them to join and start the same plan.'))}</div>`}
    <div class="muted" style="font-size:12px;margin-top:8px">${esc(L3('你的進度', '你的进度', 'Your progress'))}：${myDone} / ${p.totalDays} ${esc(t().planDaysUnit)}　·　${esc(L3('團隊代碼', '团队代码', 'Team code'))} ${esc(code)}</div></div>`;
  $('#pairSync', box).onclick = () => pairPull(v, p, today, true);
  $('#pairOff', box).onclick = () => { delete user.plan.pair[pid]; saveUser(); paintPair(v, p, today); };
}
let PAIR_NOW = null;   // 目前畫面上的陪讀夥伴卡，回到 App 時自動重新同步
async function pairPull(v, p, today, loud){
  const code = user.plan.pair[p.id]; if (!code) return;
  PAIR_NOW = { v, p, today };
  try{ await teamPull(code); }catch(e){ if (loud) toast(L3('同步失敗，稍後再試', '同步失败，稍后再试', 'Sync failed — try again later'), 2600); return; }
  if (loud) toast(L3('已同步', '已同步', 'Synced'), 1600);
  if (document.body.contains(v) && $('#pairBox', v)) paintPair(v, p, today);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden'){ if (teamPingTimer){ clearTimeout(teamPingTimer); teamPingTimer = null; teamPingNow(); } return; }
  const x = PAIR_NOW;
  if (x && document.body.contains(x.v) && $('#pairBox', x.v)) pairPull(x.v, x.p, x.today);
});
function planRowHtml(d, pid, todayIdx){
  const b = BOOK[d.book];
  const done = !!user.plan.done[planDayKey(pid, d.day)];
  const isToday = d.day === todayIdx;
  return `<div class="planrow ${isToday ? 'today' : ''} ${done ? 'done' : ''}" data-book="${d.book}" data-c="${d.start}">
    <div class="pd">${esc(t().planDay(d.day))}</div>
    <div class="pm">${esc(bname(b))} ${esc(planRangeLabel(d.book, d.start, d.end))}</div>
    <button class="plancheck ${done ? 'on' : ''}" data-toggle="${d.day}">✓</button>
  </div>`;
}
let P_WEEKS = null;   // 目前畫的計畫若是陪讀計畫，這裡放它的每週資料
function planWeeksHtml(rows, pid, todayIdx){
  let html = '', i = 0;
  while (i < rows.length){
    const wk = rows[i].week;
    let j = i; while (j < rows.length && rows[j].week === wk) j++;
    const seg = rows.slice(i, j);
    const open = seg.some(d => d.day === todayIdx);
    const wkInfo = P_WEEKS && P_WEEKS[wk];
    html += `<details class="grp" ${open ? 'open' : ''}>
      <summary><span style="color:var(--gold)">◆</span>${esc(t().planWeek(wk))}${wkInfo ? '　' + esc(cpL(wkInfo.t)) : ''}<span class="cnt">${seg.length} ${esc(t().planDaysUnit)}</span></summary>
      <div>${seg.map(d => planRowHtml(d, pid, todayIdx)).join('')}</div></details>`;
    i = j;
  }
  return html;
}
function planGroupsHtml(p, pid, todayIdx){
  const rows = p.days;
  P_WEEKS = p.weeks || null;
  if (!rows[0].vol) return planWeeksHtml(rows, pid, todayIdx);
  let html = '', i = 0;
  while (i < rows.length){
    const { year, vol, volNo } = rows[i];
    let j = i; while (j < rows.length && rows[j].year === year && rows[j].vol === vol) j++;
    html += `<div class="section-title">${esc(year)}．${esc(L3(`第${volNo}冊`, `第${volNo}冊`, 'Volume ' + volNo))}：${esc(vol)}</div>`;
    html += planWeeksHtml(rows.slice(i, j), pid, todayIdx);
    i = j;
  }
  return html;
}
let planScrollComp = false;
async function viewPlan(v){
  const L = t();
  const P = await loadPlans();
  if (!user.plan.active){
    v.innerHTML = `
      <div class="section-title">${esc(L.planTitle)}</div>
      ${PLAN_IDS.filter(pid => P[pid]).map(pid => {
        const p = P[pid];
        const comp = p.kind === 'companion';
        const head = (comp && pid === PLAN_IDS.filter(x => P[x] && P[x].kind === 'companion')[0])
          ? `<div class="section-title" id="cpHead" style="margin-top:18px">${esc(L3('陪讀計畫：陪伴別人一起讀','陪读计划：陪伴别人一起读','Companion plans: read together with someone'))}</div>
             <div class="muted" style="font-size:12.5px;line-height:1.65;margin:0 4px 10px">${esc(L3('每週附上「陪讀指引」：本週重點、可以一起聊的三個問題、一句禱告，還能請小智幫你預備。','每周附上“陪读指引”：本周重点、可以一起聊的三个问题、一句祷告，还能请小智帮你预备。','Each week comes with a companion guide: a focus, three questions to talk through, a prayer, and Xiaozhi can help you prepare.'))}</div>` : '';
        return head + `<div class="card plancard">
          <div class="pill">${comp ? esc(L3('陪讀','陪读','Companion')) + ' · ' : ''}${p.totalDays} ${esc(L.planDaysUnit)}</div>
          <h3>${esc(planTitle(p))}</h3>
          <div class="muted" style="font-size:13px;line-height:1.6;margin-bottom:12px">${esc(planSubtitle(p))}</div>
          <button class="btn gold block" data-start="${pid}">${esc(L.planStart)}</button>
        </div>`;
      }).join('')}`;
    $$('[data-start]', v).forEach(b => b.onclick = () => startPlan(b.dataset.start));
    if (planScrollComp){ planScrollComp = false; const h = $('#cpHead', v); if (h) setTimeout(() => h.scrollIntoView({ block: 'start' }), 60); }
    return;
  }
  const pid = user.plan.active, p = P[pid];
  if (!p){ user.plan.active = null; user.plan.sum = null; saveUser(); return viewPlan(v); }   // 計畫資料不在（例如 plans.json 還是舊版）就回到選單，不要當掉
  const doneN = planDoneCount(pid);
  const todayIdx = planTodayIndex(p);
  const today = p.days[todayIdx - 1];
  const todayDone = !!user.plan.done[planDayKey(pid, todayIdx)];
  const pct = Math.round(doneN / p.totalDays * 100);
  const C = 2 * Math.PI * 25;
  if (!user.plan.sum || user.plan.sum.id !== pid || user.plan.sum.done !== doneN || user.plan.sum.day !== todayIdx) planSumUpdate(p);

  v.innerHTML = `
    <div style="display:flex;gap:8px;margin:0 0 12px;flex-wrap:wrap">
      <button class="btn sm" id="planToPick">📋 ${esc(L3('讀經計畫選單', '读经计划选单', 'Reading plans'))}</button>
      <button class="btn sm" id="planToComp">🤝 ${esc(L3('陪讀計畫', '陪读计划', 'Companion plans'))}</button>
    </div>
    <div class="card">
      <div class="progwrap">
        <svg class="progring" viewBox="0 0 58 58">
          <circle class="bgc" cx="29" cy="29" r="25"></circle>
          <circle class="fgc" cx="29" cy="29" r="25" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"></circle>
          <text x="29" y="33" text-anchor="middle">${pct}%</text>
        </svg>
        <div style="flex:1">
          <h3 style="margin:0">${esc(planTitle(p))}</h3>
          <div class="muted">${doneN} / ${p.totalDays} ${esc(L.planDaysUnit)}</div>
        </div>
      </div>
      <div style="margin-top:14px">
        <a class="btn primary block" href="#/read/${today.book}/${today.start}">${esc(L.planGoRead)} · ${esc(bname(BOOK[today.book]))} ${esc(planRangeLabel(today.book, today.start, today.end))}</a>
      </div>
      <div style="margin-top:10px">
        <button class="btn block" id="todayToggle">${todayDone ? '✓ ' + esc(L.planDone) : esc(L.planMarkDone)}</button>
      </div>
    </div>
    ${p.weeks ? '<div id="pairBox"></div>' + companionGuideHtml(p, today) : ''}
    <div class="card" style="padding:4px 16px">
      <div class="setrow"><div class="sl">${esc(L.planRemind)}
        <div class="muted" style="font-size:11.5px;line-height:1.6">${esc(L.planRemindHint[state.planRemindOn ? 0 : 1])}</div></div>
        <div class="segbtns" id="setPlanRemind">
        ${L.onoff.map((m, i) => `<button class="${(state.planRemindOn ? 0 : 1) === i ? 'on' : ''}" data-i="${i}">${esc(m)}</button>`).join('')}
        </div></div>
    </div>
    <div style="display:flex;gap:18px;margin:2px 4px 14px;font-size:12.5px">
      <button id="planSwitchBtn" style="background:none;border:none;color:var(--accent);font-weight:600;cursor:pointer;padding:0">${esc(L.planSwitch)}</button>
      <button id="planRestartBtn" style="background:none;border:none;color:var(--ink-faint);font-weight:600;cursor:pointer;padding:0">${esc(L.planRestart)}</button>
    </div>
    ${planGroupsHtml(p, pid, todayIdx)}`;

  $('#todayToggle', v).onclick = () => togglePlanDone(pid, todayIdx);
  if (p.weeks){ bindCompanionGuide(v, p, today); paintPair(v, p, today); pairPull(v, p, today); }
  $$('#setPlanRemind button', v).forEach(b => b.onclick = () => togglePlanRemind(b.dataset.i === '0'));
  $('#planSwitchBtn', v).onclick = () => switchPlan();
  $('#planToPick', v).onclick = () => switchPlan();
  $('#planToComp', v).onclick = () => { planScrollComp = true; switchPlan(); };
  $('#planRestartBtn', v).onclick = () => restartPlan(pid);
  $$('.planrow', v).forEach(row => {
    row.onclick = e => {
      if (e.target.closest('.plancheck')) return;
      go(`#/read/${row.dataset.book}/${row.dataset.c}`);
    };
  });
  $$('.plancheck', v).forEach(b => {
    b.onclick = e => { e.stopPropagation(); togglePlanDone(pid, +b.dataset.toggle); };
  });
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
  /* 先把整章的句子攤成一列，畫線才能跨句、跨段落連成一整段 */
  const flat = [];
  /* curV 要跨區塊延續。詩歌體每一行都是獨立區塊，續行的 vnum 是 0，
     若每個區塊都把 curV 歸零，續行的 data-v 就變成 0，
     「整節」會抓不到下一行，出處也會退回只有章。 */
  let curV = 0;
  chap.forEach((bl, bi) => {
    if (bl[0] === 'b') return;
    let si = 0;
    for (let j = 1; j < bl.length; j += 2){
      const vno = bl[j], txt = bl[j + 1];
      let first = true;
      for (const sx of splitSentences(txt)){
        if (vno && first) curV = vno;
        flat.push({ bi, si, vn:(vno && first) ? vno : 0, v:curV, tx:sx });
        si++; first = false;
      }
    }
  });
  /* 每一句是被哪一條畫線蓋住的（h.sp = 這條畫線含幾句） */
  const own = {};
  flat.forEach((f, i) => {
    const k = hlKey(bookId, cno, f.bi, f.si);
    const h = user.hl[k];
    if (!h) return;
    const n = Math.max(1, +h.sp || 1);
    for (let d = 0; d < n && i + d < flat.length; d++){
      const g = flat[i + d];
      own[g.bi + '|' + g.si] = { k, h, head:d === 0, p0:f.bi, s0:f.si };
    }
  });
  const byBlock = {};
  flat.forEach(f => { (byBlock[f.bi] = byBlock[f.bi] || []).push(f); });

  const body = chap.map((bl, bi) => {
    if (bl[0] === 'b') return '<div class="stanza"></div>';
    let inner = '', notes = '';
    (byBlock[bi] || []).forEach(f => {
      if (f.vn) inner += `<span class="vn">${f.vn}</span>`;
      const k = hlKey(bookId, cno, bi, f.si);
      const o = own[bi + '|' + f.si];
      inner += `<span class="sent" data-c="${cno}" data-p="${bi}" data-s="${f.si}" data-v="${f.v}"`
             + (o ? ` data-hl="1" data-color="${o.h.c}"${o.head ? '' : ` data-op="${o.p0}" data-os="${o.s0}"`}` : '')
             + (bm.has(k) ? ' data-bm="1"' : '')
             + `>${markNotes(esc(f.tx))}</span>`;
      if (o && o.head && o.h.n)
        notes += `<div class="hl-note" data-c="${cno}" data-p="${bi}" data-s="${f.si}" data-color="${o.h.c}">${esc(o.h.n)}</div>`;
    });
    return `<p class="${BLOCK_CLASS[bl[0]] || 'prose'}" data-c="${cno}" data-p="${bi}">${inner}</p>${notes}`;
  }).join('');
  const head = withHead ? `<h2 class="ch" data-c="${cno}">${esc(chapLabel(bookId, cno))}</h2>` : '';
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
    : `<div class="bk">${esc(bname(b))}</div><h1 class="chtitle">${esc(chapLabel(bookId, ch))}</h1>`;

  v.innerHTML = `
    <div class="chtoolbar">
      <button class="chtb-btn" id="rdToc" title="${esc(L.toc)}">☰</button>
      <button class="chtb-btn" id="rdPrev" title="${esc(L3('上一章', '上一章', 'Previous chapter'))}" aria-label="${esc(L3('上一章', '上一章', 'Previous chapter'))}">‹</button>
      <button class="chtb-btn" id="rdNext" title="${esc(L3('下一章', '下一章', 'Next chapter'))}" aria-label="${esc(L3('下一章', '下一章', 'Next chapter'))}">›</button>
      <div class="chtb-spacer"></div>
      <button class="chtb-btn ${bmMode ? 'on' : ''}" id="rdBm" title="${esc(L.bm)}">🔖</button>
      <button class="chtb-btn ${(state.flow || !state.shCh || !state.shV) ? 'on' : ''}" id="rdMode" title="${esc(L.pure)}">${esc(L3('淨', '净', '¶'))}</button>
      <button class="chtb-btn" id="rdFont">A⁺</button>
      ${crBtn()}
      <span class="tts-group">
        <button class="chtb-btn" id="rdPlay" title="${esc(L.ttsPlay)}">▶</button>
        <button class="chtb-btn" id="rdPause" title="${esc(L.ttsPause)}">⏸</button>
        <button class="chtb-btn" id="rdStop" title="${esc(L.ttsStop)}">⏹</button>
      </span>
    </div>
    ${bmMode ? `<div class="bm-hint">${esc(L.bmHint)}</div>` : ''}
    <div class="chhead">${head}<div class="rule"></div></div>
    <div class="reader" id="reader">${body}</div>
    <div class="chfoot">
      <button class="btn" id="fPrev">${esc(flow ? L.prevBk : L.prev)}</button>
      <button class="btn primary" id="fNext">${esc(flow ? L.nextBk : L.next)}</button>
    </div>
    ${flow ? '' : `<button class="btn block" id="fPlay" style="margin-top:10px">🎯 ${esc(L3('考考我這一章：猜謎與測驗', '考考我这一章：猜谜与测验', 'Quiz me on this chapter'))}</button>`}
    <div class="readend" id="readEnd"></div>`;
  { const fp = $('#fPlay'); if (fp) fp.onclick = () => { plSrc = 'cur'; PL = null; go('#/play'); }; }

  $('#rdToc').onclick  = () => go('#/books/' + bookId);
  $('#rdBm').onclick   = () => {
    bmMode = !bmMode;
    applyChrome();
    toast(bmMode ? t().bmModeOn : t().bmModeOff);
    const y = window.scrollY;
    render().then(() => window.scrollTo(0, y));
  };
  $('#rdMode').onclick = () => {
    const now = VIEW_CYCLE.findIndex(([f, c, vv]) => f === state.flow && c === state.shCh && vv === state.shV);
    const [f, c, vv] = VIEW_CYCLE[(now + 1) % VIEW_CYCLE.length];
    state.flow = f; state.shCh = c; state.shV = vv; saveState(); applyChrome();
    const L2 = t();
    const sep = isEN() ? ' · ' : '・', cn = isEN() ? ': ' : '：';
    toast(`${L2.modes[f ? 1 : 0]}${sep}${L2.shCh}${cn}${L2.onoff[c ? 0 : 1]}${sep}${L2.shV}${cn}${L2.onoff[vv ? 0 : 1]}`, 2600);
    render();
  };
  $('#rdFont').onclick = () => { state.font = (state.font + 1) % FONT_CLASS.length; saveState(); applyChrome(); toast(t().fonts[state.font]); };
  $('#rdPlay').onclick  = () => ttsStart();
  $('#rdPause').onclick = () => ttsPauseNow();
  $('#rdStop').onclick  = () => ttsStop();

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

  if (!(spk.on && spk.items.length)) scrollToTop();
  const want = jumpTo; jumpTo = null;
  if (!(want && scrollToAnchor(want)) && flow && ch > 1){
    const target = $(`#reader p[data-c="${ch}"]`);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block:'start' }));
  }
  /* 從搜尋結果點進來：找出命中的那一句（同一節、文字對得上），自動幫它加畫線再捲過去，
     一眼就看得出「搜到的是這一句」，不用自己在整章裡再找一次。找不到就算了，不影響正常進頁。 */
  if (jumpHl && jumpHl.b === bookId){
    const jh = jumpHl; jumpHl = null;
    const list = sentList(jh.c);
    const el = list.find(e => (+e.dataset.v || 0) === jh.v && e.textContent.indexOf(jh.x) >= 0)
            || list.find(e => (+e.dataset.v || 0) === jh.v);
    if (el){
      createHl(el, jh.c);
      scrollToAnchor({ c:jh.c, p:el.dataset.p, s:el.dataset.s }, { center:true });
    }
  }
  watchProgress(bookId, flow, b.ch);
  ttsRebind();
  ttsBtn(spk.on ? (spk.paused ? 'paused' : 'playing') : '');   // 換頁後工具列重新畫過，朗讀（或暫停）狀態要保持，不能又變回沒在讀的樣子
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
  if (!user.progress[k]){ user.progress[k] = Date.now(); saveUser(); teamPingSoon(); planAutoCheck(bookId, ch); }
}
/* 讀經計畫「讀完自行圈選」：不管是使用者自己滑到章節底，還是朗讀（TTS）自動接
   下一章唸完，最後都會經過這裡的 markRead() 幫這一章打勾——這裡接住同一個動作，
   只要目前有在走的讀經計畫、這一章剛好落在某一天的範圍內、而且那一天範圍內的
   章節全部都讀完了，就自動把那一天的進度打勾，不用使用者自己再按「✓已讀」。
   使用者要求：讀完（捲到底、或聽完朗讀）都要能自動圈選——兩種情況本來就都會
   呼叫 markRead()，接在這一個點上剛好兩種都涵蓋，不用另外分別偵測。
   不主動 render()：避免在使用者正在閱讀／朗讀途中被強制重畫畫面，只用 toast
   提示；讀經計畫頁面下次自己打開時，會照 user.plan.done 的最新狀態重新畫。 */
async function planAutoCheck(bookId, ch){
  if (!user.plan.active) return;
  let P; try{ P = await loadPlans(); }catch(e){ return; }
  const pid = user.plan.active, p = P[pid];
  if (!p) return;
  let changed = false;
  for (const d of p.days){
    if (d.book !== bookId || ch < d.start || ch > d.end) continue;
    const k = planDayKey(pid, d.day);
    if (user.plan.done[k]) continue;
    let allRead = true;
    for (let c = d.start; c <= d.end; c++){ if (!user.progress[bookId + '-' + c]){ allRead = false; break; } }
    if (allRead){ user.plan.done[k] = Date.now(); changed = true; }
  }
  if (changed){ saveUser(); planSumUpdate(p); toast(t().planAutoDoneToast, 2600); rwCheckBook(pid, bookId); }
}
/* ============ 讀經計畫：每日提醒（本機通知，不是伺服器推播）====================
   這個App是純前端PWA，沒有一直開著的伺服器可以主動推播；只能靠瀏覽器的
   Notification API，在使用者把App留在背景、或重新開啟／切回前景時，用本機
   判斷「現在幾點、今天讀了沒」來決定要不要跳通知——是「盡力而為」的提醒，
   不保證App完全被系統關掉也會響（那需要另外架一台推播伺服器）。這個取捨
   已經先跟使用者確認過。提醒時間固定在晚上8點，不開放每個人自訂。 */
const PLAN_REMIND_H = 20, PLAN_REMIND_M = 0;
function todayStr(){ const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
async function planRemindPermission(){
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try{ return await Notification.requestPermission(); }catch(e){ return 'denied'; }
}
async function togglePlanRemind(on){
  if (!on){ state.planRemindOn = false; saveState(); render(); return; }
  const perm = await planRemindPermission();
  if (perm === 'unsupported'){ toast(t().planRemindUnsupported, 3600); return; }
  if (perm !== 'granted'){ toast(t().planRemindDenied, 3600); return; }
  state.planRemindOn = true; saveState(); render();
  checkPlanRemind();
}
async function fireLocalNotification(title, body){
  try{
    if ('serviceWorker' in navigator){
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification){ await reg.showNotification(title, { body, icon:'./icon-192.png', badge:'./icon-96.png', tag:'plan-remind' }); return; }
    }
  }catch(e){}
  try{ new Notification(title, { body, icon:'./icon-192.png' }); }catch(e){}
}
/* 提醒用的「今天該讀到哪」跟「前往閱讀」按鈕不是同一件事：
   planTodayIndex() 是「下一個還沒打勾的是哪一天」，只要計畫沒整個讀完，
   永遠會指到某一天——如果拿它來決定要不要跳提醒，會變成使用者明明已經超前
   進度很多天，還是天天被提醒「你還沒讀下一天」，太吵了。
   提醒真正該問的是「行事曆算下來，到今天為止該讀的份，有沒有跟上」：
   用「已經打勾的天數」跟「從開始日算起經過的行事曆天數」比，落後才提醒，
   超前或剛好跟上都不會被打擾。 */
function planCalendarDue(pid, p){
  const st = user.plan.starts[pid];
  if (!st) return 1;
  const d = Math.floor((Date.now() - st) / 86400000) + 1;
  return Math.min(Math.max(1, d), p.totalDays);
}
/* 到了提醒時間、確定落後進度了，就跳一次通知；一天最多跳一次（記在 user.plan.remindedOn）。
   在App開啟／回到前景、或每隔一段時間的計時器裡呼叫；App被系統徹底關掉、
   或背景太久被瀏覽器整個終止時不會被呼叫到，這是本機提醒先天的限制。 */
async function checkPlanRemind(){
  if (!state.planRemindOn || !user.plan.active) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  if (now.getHours() < PLAN_REMIND_H || (now.getHours() === PLAN_REMIND_H && now.getMinutes() < PLAN_REMIND_M)) return;
  const ds = todayStr();
  if (user.plan.remindedOn === ds) return;
  let P; try{ P = await loadPlans(); }catch(e){ return; }
  const pid = user.plan.active, p = P[pid];
  if (!p) return;
  if (planDoneCount(pid) >= p.totalDays) return;          // 整個計畫都讀完了
  if (planDoneCount(pid) >= planCalendarDue(pid, p)) return;   // 沒有落後，不用提醒
  const nextIdx = Math.min(planTodayIndex(p), p.totalDays);
  const d = p.days[nextIdx - 1];
  user.plan.remindedOn = ds; saveUser();
  const L = t();
  fireLocalNotification(L.planRemindTitle, L.planRemindBody(bname(BOOK[d.book]), planRangeLabel(d.book, d.start, d.end)));
}
/* ================================================================ 畫線 / 默想 */
/* 一「句」的定義：到句號（。！？）為止，不是到逗號。
   詩歌體每一行都是獨立區塊，一個完整句常常橫跨好幾行——
   例如詩篇 1:5「因此，當審判的時候，惡人必站立不住；／罪人在義人的會中也是如此。」
   是一句話兩行。所以畫線與朗讀標示都要以「完整句」為單位，不是以「行」為單位。 */
const SENT_TAIL = /[」』）〕”’"'\)\]\s]+$/;
function isSentEnd(el){
  const x = (el.textContent || '').replace(SENT_TAIL, '');
  return isEN() ? /[.!?]$/.test(x) : /[。！？]$/.test(x);
}
const SENT_MAX = 12;                 // 保險：再長也不要無限併下去
/* 這一句從 el 開始往下要含幾個 .sent 才算完整 */
function sentSpan(list, i){
  let n = 1;
  while (!isSentEnd(list[i + n - 1]) && i + n < list.length && n < SENT_MAX) n++;
  return n;
}
/* 把一串句子併成「一個完整句」為一組 */
function sentGroups(els){
  const gs = []; let cur = [];
  els.forEach(e => {
    cur.push(e);
    if (isSentEnd(e) || cur.length >= SENT_MAX){ gs.push(cur); cur = []; }
  });
  if (cur.length) gs.push(cur);
  return gs;
}
function onSentTap(el){
  const cno = +el.dataset.c || RD.ch;
  crPoint(el);
  if (bmMode){ toggleBm(el, cno); return; }
  const k = hlKey(RD.book, cno, el.dataset.p, el.dataset.s);
  if (!user.hl[k] && el.dataset.op == null){
    createHl(el, cno);
  } else {
    openHlSheet(el);
  }
}
/* 幫某一句加上金色畫線——點兩下同一句、或搜尋結果點進去自動畫線，都共用這一段。
   已經畫過的句子不重複建立，回傳有沒有真的新建。 */
function createHl(el, cno){
  const k = hlKey(RD.book, cno, el.dataset.p, el.dataset.s);
  if (user.hl[k]) return false;
  const h = { c:'gold', n:'', sp:1, t:el.textContent, b:RD.book, ch:cno,
              v:+el.dataset.v || 0, ts:Date.now() };
  user.hl[k] = h;
  /* 一畫就畫一個完整句（到句號），不是只畫到逗號那一行 */
  const list = sentList(cno), i = list.indexOf(el);
  if (i >= 0) spanApply(cno, el, h, sentSpan(list, i));
  saveUser();
  paintHl(cno);
  return true;
}
/* 書籤：直接點那一句，再點一下移除 */
function toggleBm(el, cno){
  const p = +el.dataset.p, sx = +el.dataset.s;
  const i = user.marks.findIndex(m => m.b === RD.book && m.c === cno && m.p === p && m.s === sx);
  if (i >= 0){
    user.marks.splice(i, 1);
    el.removeAttribute('data-bm');
    toast(t().bmDel);
  } else {
    user.marks.push({ b:RD.book, c:cno, p, s:sx, v:+el.dataset.v || 0, t:el.textContent.slice(0, 40), ts:Date.now() });
    el.setAttribute('data-bm', '1');
    toast(t().bmAdd);
  }
  saveUser();
}
/* 同一章的句子，照畫面上的先後排成一列（分章模式與整卷連讀共用） */
function sentList(cno){
  return $$('#reader .sent').filter(e => (+e.dataset.c || RD.ch) === cno);
}
/* 畫線的顏色與範圍直接改在畫面上，不重畫整章。
   重畫會把朗讀中那一段的顏色標示洗掉，也會把捲軸彈回最上面，
   使用者就覺得「一畫線，朗讀就斷了」。 */
function paintHl(cno){
  const list = sentList(cno);
  const cover = new Array(list.length).fill(null);
  list.forEach((el, i) => {
    const h = user.hl[hlKey(RD.book, cno, el.dataset.p, el.dataset.s)];
    if (!h) return;
    const n = Math.max(1, +h.sp || 1);
    for (let d = 0; d < n && i + d < list.length; d++)
      cover[i + d] = { h, head:d === 0, p0:el.dataset.p, s0:el.dataset.s };
  });
  list.forEach((el, i) => {
    const o = cover[i];
    if (o){
      el.setAttribute('data-hl', '1'); el.setAttribute('data-color', o.h.c);
      if (o.head){ el.removeAttribute('data-op'); el.removeAttribute('data-os'); }
      else { el.setAttribute('data-op', o.p0); el.setAttribute('data-os', o.s0); }
    } else {
      ['data-hl','data-color','data-op','data-os'].forEach(a => el.removeAttribute(a));
    }
  });
  paintNotes(cno, list, cover);
}
function paintNotes(cno, list, cover){
  $$('#reader .hl-note').forEach(n => { if ((+n.dataset.c || RD.ch) === cno) n.remove(); });
  let curP = null, after = null;
  list.forEach((el, i) => {
    const o = cover[i];
    if (!o || !o.head || !o.h.n) return;
    const p = el.closest('p'); if (!p) return;
    if (p !== curP){ curP = p; after = p; }
    const d = document.createElement('div');
    d.className = 'hl-note';
    d.dataset.c = cno; d.dataset.p = el.dataset.p; d.dataset.s = el.dataset.s;
    d.setAttribute('data-color', o.h.c);
    d.textContent = o.h.n;
    d.onclick = () => openHlSheet(el);
    after.after(d); after = d;
  });
}
/* 把畫線含的幾句接回一段完整的經文（卡片、我的畫線、問小智都用這一段） */
function spanApply(cno, el, h, n){
  const list = sentList(cno);
  const i = list.indexOf(el);
  if (i < 0) return h;
  n = Math.max(1, Math.min(n, list.length - i));
  const part = list.slice(i, i + n);
  h.sp = n;
  h.t = part.map(e => e.textContent).join(isEN() ? ' ' : '').replace(/\s+/g, ' ').trim();
  h.v = +part[0].dataset.v || 0;
  const lastV = +part[part.length - 1].dataset.v || 0;
  h.v2 = lastV > h.v ? lastV : 0;
  return h;
}
/* 「這一段」的範圍：散文就是同一個 <p>；詩歌體每一行各自是一個 <p>，
   所以要往下把連著的詩行一起算進來，遇到空行（.stanza）、章題或換成別種
   區塊就停——那才是詩的一「段」。 */
function paraBlocks(el){
  const p0 = el.closest('p'); if (!p0) return [];
  const out = [p0];
  const poet = /\bq1\b|\bq2\b/.test(p0.className);
  if (!poet) return out;
  let n = p0.nextElementSibling;
  while (n){
    if (n.classList && n.classList.contains('hl-note')){ n = n.nextElementSibling; continue; }
    if (n.tagName !== 'P' || !/\bq1\b|\bq2\b/.test(n.className)) break;
    out.push(n); n = n.nextElementSibling;
  }
  return out;
}
/* 整節：這一節剩下的句子都畫進來；整段：這一段剩下的句子都畫進來 */
function spanTo(cno, el, mode){
  const list = sentList(cno);
  const i = list.indexOf(el);
  if (i < 0) return 1;
  let n = 1;
  if (mode === 'v'){
    const v0 = el.dataset.v || '';
    while (i + n < list.length && (list[i + n].dataset.v || '') === v0) n++;
  } else {
    const ps = new Set(paraBlocks(el).map(p => p.dataset.p));
    while (i + n < list.length && ps.has(list[i + n].dataset.p)) n++;
  }
  return n;
}

function openHlSheet(el){
  const L = t();
  const cno = +el.dataset.c || RD.ch;
  /* 點到的是被別條畫線蓋住的句子，就打開那一條 */
  if (el.dataset.op != null){
    const own = $(`#reader .sent[data-c="${cno}"][data-p="${el.dataset.op}"][data-s="${el.dataset.os}"]`);
    if (own && own !== el) return openHlSheet(own);
  }
  const k = hlKey(RD.book, cno, el.dataset.p, el.dataset.s);
  const h = user.hl[k]; if (!h) return;
  if (!h.sp) h.sp = 1;
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card">
    <div class="hlsheet-title">${esc(L.hlTitle)}</div>
    <span class="hlsheet-quote">${esc(h.t)}</span>
    <div class="hlsheet-colorrow"><span class="hlsheet-colorlabel">${esc(L.hlColor)}</span>
      <div class="hlsheet-colors">${HL_COLORS.map(c =>
        `<button class="hlswatch ${h.c === c ? 'active' : ''}" data-c="${c}" style="background:${HL_SWATCH[c]}"></button>`).join('')}</div></div>
    <div class="hlsheet-colorrow"><span class="hlsheet-colorlabel">${esc(L.hlSpan)}</span>
      <div class="spanrow">
        <button class="spanbtn" data-sp="-1">－</button>
        <span class="spannum" id="spanNum">${esc(L.spanUnit(h.sp))}</span>
        <button class="spanbtn" data-sp="1">＋</button>
        <button class="spanbtn wide" data-sp="v">${esc(L.spanV)}</button>
        <button class="spanbtn wide" data-sp="p">${esc(L.spanP)}</button>
      </div></div>
    <div class="hl-hint" style="margin:-2px 0 10px">${esc(L.spanHint)}</div>
    <textarea class="hlsheet-ta" placeholder="${esc(L.hlNote)}">${esc(h.n || '')}</textarea>
    <div class="hlsheet-acts">
      <button class="btn primary" data-a="save">${esc(L.save)}</button>
      <button class="btn" data-a="ask">${esc(L.ask)}</button>
      <button class="btn" data-a="ttsFrom">${esc(L.ttsFrom)}</button>
    </div>
    <div class="hlsheet-acts2">
      <button class="btn gold" data-a="card">🖼 ${esc(L.card)}</button>
      <button class="btn danger" data-a="del">${esc(L.del)}</button>
      <button class="btn" data-a="close">${esc(L.close)}</button>
    </div></div>`;
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  let color = h.c;
  /* 點色票就立刻換色並存檔——不必再按「儲存」（使用者反映「換顏色沒有作用」） */
  $$('.hlswatch', mask).forEach(b => b.onclick = () => {
    color = b.dataset.c;
    $$('.hlswatch', mask).forEach(x => x.classList.toggle('active', x === b));
    h.c = color; saveUser();
    paintHl(cno);
  });
  /* 範圍：往下多畫一句、少畫一句，或一次畫整節／整段 */
  const quote = $('.hlsheet-quote', mask), num = $('#spanNum', mask);
  const setSpan = n => {
    spanApply(cno, el, h, n); saveUser();
    paintHl(cno);
    if (quote) quote.textContent = h.t;
    if (num) num.textContent = t().spanUnit(h.sp);
  };
  $$('[data-sp]', mask).forEach(b => b.onclick = () => {
    const v = b.dataset.sp, L2 = t();
    if (v === 'v' || v === 'p'){
      const n = spanTo(cno, el, v), was = h.sp || 1;
      setSpan(n);
      /* 按了之後一定要有回應，不然會以為「沒有作用」 */
      toast(n === was ? (v === 'v' ? L2.spanIsV : L2.spanIsP)
                      : (v === 'v' ? L2.spanDoneV(n) : L2.spanDoneP(n)), 2400);
      return;
    }
    setSpan((h.sp || 1) + (+v));
  });
  const ta = $('.hlsheet-ta', mask);
  const commit = () => {
    h.c = color; h.n = ta.value.trim(); saveUser();
    mask.remove(); paintHl(cno);
  };
  $$('[data-a]', mask).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'save') commit();
    else if (a === 'card'){
      h.c = color; h.n = ta.value.trim(); saveUser();
      mask.remove(); openStudio(h);
    }
    else if (a === 'close') mask.remove();
    else if (a === 'del'){ delete user.hl[k]; saveUser(); mask.remove(); paintHl(cno); }
    else if (a === 'ask'){
      h.c = color; h.n = ta.value.trim(); saveUser(); mask.remove();
      /* 記下這一題是從哪一節來的，答完才分享得出「經文＋答案」 */
      chatSrc = { t:h.t, b:RD.book, ch:cno, v:h.v || 0, v2:h.v2 || 0 };
      chatPending = isID() ? `Tolong bantu saya merenungkan bagian ini: “${h.t}”` : isJA() ? `この箇所を黙想できるよう助けてください：「${h.t}」` : isKO() ? `이 말씀으로 묵상하도록 도와주세요: “${h.t}”` : isEN() ? `Help me meditate on this verse: “${h.t}”`
                : `${isZS() ? '请就这句经文帮助我默想：' : '請就這句經文幫助我默想：'}「${h.t}」`;
      go('#/companion');
    }
    else if (a === 'ttsFrom'){
      h.c = color; h.n = ta.value.trim(); saveUser(); mask.remove();
      ttsStartAt = { book:RD.book, ch:cno, flow:RD.flow, c:el.dataset.c, p:el.dataset.p, s:el.dataset.s };
      ttsStop();     // 不論本來有沒有在讀，先收乾淨再從指定的地方開始
      ttsStart();
    }
  });
}

/* ================================================================ 免費圖庫（Pexels）
   Pexels 的照片是免費的、可商用、不必註明出處（但我們還是把攝影師的名字寫在挑選畫面上，
   這是該有的禮貌）。要用它必須有一把免費的 API 金鑰：
     https://www.pexels.com/api/ → 登入 → Your API Key → 複製
   把那一串貼到 app.js 最上面 PEXELS_KEY 的引號裡就可以了。 */
const PX_API = 'https://api.pexels.com/v1/';
const PX_PER = 24;
const PIC_L = {
  zh:{ lib:'免費圖庫', libBtn:'🖼 從免費圖庫選', title:'Pexels 免費圖庫',
       ph:'想找什麼樣的畫面…', search:'搜尋', more:'再多一些', loading:'載入中…',
       noKey:'還沒設定 Pexels 金鑰。到 pexels.com/api 免費申請一把，貼進 app.js 最上面的 PEXELS_KEY 就可以用了。',
       err:'連不上圖庫，請稍後再試', none:'找不到相符的照片，換個字試試',
       by:'攝影：', picked:'已選好這張照片', loadingPic:'下載照片中…',
       hint:'照片來自 Pexels，免費可商用。挑一張當卡片背景，字會自動壓上一層遮罩。',
       presets:[['風景','landscape'],['日出','sunrise'],['天空','sky'],['海','ocean'],
                ['山','mountain'],['花','flowers'],['光','light rays'],['樹','tree'],
                ['小路','path'],['麥田','wheat field'],['水','calm water'],['雲','clouds'],
                ['晨霧','morning mist'],['星空','starry sky'],['教堂','church'],['十字架','cross']] },
  zs:{ lib:'免费图库', libBtn:'🖼 从免费图库选', title:'Pexels 免费图库',
       ph:'想找什么样的画面…', search:'搜索', more:'再多一些', loading:'载入中…',
       noKey:'还没设定 Pexels 密钥。到 pexels.com/api 免费申请一把，贴进 app.js 最上面的 PEXELS_KEY 就可以用了。',
       err:'连不上图库，请稍后再试', none:'找不到相符的照片，换个字试试',
       by:'摄影：', picked:'已选好这张照片', loadingPic:'下载照片中…',
       hint:'照片来自 Pexels，免费可商用。挑一张当卡片背景，字会自动压上一层遮罩。',
       presets:[['风景','landscape'],['日出','sunrise'],['天空','sky'],['海','ocean'],
                ['山','mountain'],['花','flowers'],['光','light rays'],['树','tree'],
                ['小路','path'],['麦田','wheat field'],['水','calm water'],['云','clouds'],
                ['晨雾','morning mist'],['星空','starry sky'],['教堂','church'],['十字架','cross']] },
  en:{ lib:'Free photo library', libBtn:'🖼 Pick a free photo', title:'Pexels free photos',
       ph:'What kind of scene…', search:'Search', more:'Load more', loading:'Loading…',
       noKey:'No Pexels key yet. Get a free one at pexels.com/api and paste it into PEXELS_KEY at the top of app.js.',
       err:'Cannot reach the photo library — try again later', none:'Nothing found — try another word',
       by:'Photo: ', picked:'Photo chosen', loadingPic:'Downloading the photo…',
       hint:'Photos from Pexels — free to use. Pick one as the card background; the text gets a soft overlay automatically.',
       presets:[['Landscape','landscape'],['Sunrise','sunrise'],['Sky','sky'],['Ocean','ocean'],
                ['Mountain','mountain'],['Flowers','flowers'],['Light','light rays'],['Tree','tree'],
                ['Path','path'],['Wheat','wheat field'],['Water','calm water'],['Clouds','clouds'],
                ['Mist','morning mist'],['Stars','starry sky'],['Church','church'],['Cross','cross']] }
};
const pl = () => PIC_L[state.lang] || (isX() ? PIC_L.en : PIC_L.zh);

let pxState = { q:'', page:1, items:[], busy:false, end:false };
let photoBy = '';                      // 這張照片的攝影師，掛在挑選畫面上

/* 卡片是直的就找直的，橫的就找橫的——挑到的圖比較不會被裁掉重點 */
function pxOrient(){
  const s = cardSize();
  return s === 'w' ? 'landscape' : (s === 's' ? 'square' : 'portrait');
}
async function pxFetch(reset){
  if (!PEXELS_KEY){ toast(pl().noKey, 6000); return false; }
  if (pxState.busy) return false;
  pxState.busy = true;
  if (reset){ pxState.page = 1; pxState.items = []; pxState.end = false; }
  const q = pxState.q.trim();
  const url = (q ? `${PX_API}search?query=${encodeURIComponent(q)}&orientation=${pxOrient()}&`
                 : `${PX_API}curated?`)
            + `per_page=${PX_PER}&page=${pxState.page}`;
  try{
    const r = await fetch(url, { headers:{ Authorization: PEXELS_KEY } });
    if (!r.ok) throw new Error('http ' + r.status);
    const d = await r.json();
    const got = (d && d.photos) || [];
    pxState.items = pxState.items.concat(got);
    pxState.end = got.length < PX_PER;
    pxState.page++;
    return true;
  }catch(e){
    toast(pl().err + '（' + (e.message || 'network') + '）', 4000);
    return false;
  }finally{ pxState.busy = false; }
}
/* 用 fetch 抓成 blob 再給 Image——這樣畫到 canvas 上不會被瀏覽器判定「污染」，
   之後「存到相簿」「分享」才匯得出來。 */
async function pxLoad(photo){
  const url = (photo.src && (photo.src.large2x || photo.src.large || photo.src.original)) || '';
  if (!url) return false;
  const r = await fetch(url, { mode:'cors' });
  if (!r.ok) throw new Error('http ' + r.status);
  const blob = await r.blob();
  const obj = URL.createObjectURL(blob);
  try{
    const im = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('decode'));
      i.src = obj;
    });
    if (!photoMode) photoMode = 'full';
    setPhoto(im, photo.photographer || '');
    plSave(im, photo.photographer || '');
    return true;
  }finally{ setTimeout(() => { try{ URL.revokeObjectURL(obj); }catch(_){} }, 30000); }
}

/* ================================================================ v2.19.3 AI 生圖：用文字自己生成美圖
   依目前這節經文自動寫好提示詞（可改）→ 複製到免費 AI 生圖工具，或直接在 App 內用 Pollinations 免費生成。
   生成的圖當作相片放進美圖，也會存進「我的相片庫」。 */
const AIG_STYLES = [
  ['sc', ['風景','风景','Landscape'], 'majestic natural landscape, golden hour light, soft clouds, serene and peaceful'],
  ['wc', ['水彩','水彩','Watercolor'], 'soft watercolor painting, gentle pastel colors, dreamy and hopeful'],
  ['oil',['油畫','油画','Oil painting'], 'classic oil painting, rich warm colors, reverent atmosphere'],
  ['lt', ['光影','光影','Heavenly light'], 'rays of heavenly light breaking through clouds, cinematic, glowing, holy atmosphere'],
  ['nt', ['星空','星空','Starry night'], 'peaceful starry night sky, deep blue and gold, calm and awe-inspiring'],
  ['fl', ['花草','花草','Flowers'], 'lush flowers and green pastures, morning dew, soft sunlight, gentle and fresh']
];
const AIG_SHAPES = [['p',['直式 9:16','直式 9:16','Portrait 9:16'],576,1024,'9:16'],['w',['橫式 16:9','横式 16:9','Landscape 16:9'],1024,576,'16:9'],['s',['方形','方形','Square'],1024,1024,'1:1']];
const AIG_TOOLS = () => [
  ['https://gemini.google.com/app', 'Google Gemini', ['免費、需 Google 帳號','免费、需 Google 账号','Free, Google account']],
  ['https://chatgpt.com/', 'ChatGPT', ['免費版有每日張數限制、需登入','免费版有每日张数限制、需登录','Free tier has a daily limit, sign-in']],
  ['https://www.doubao.com/chat/', L3('豆包 Doubao','豆包 Doubao','Doubao (豆包)'), ['免費、中文提示詞很好用（中國大陸常用）','免费、中文提示词很好用（中国大陆常用）','Free; works well with Chinese prompts']],
  ['https://pollinations.ai/', 'Pollinations', ['免費、免註冊','免费、免注册','Free, no sign-up']]
];
let aigSt = 'sc', aigSh = 'p', aigNote = '', aigResumePrompt = '';
/* 去 ChatGPT／Gemini 畫圖時 App 可能被系統收掉重載；先記下經文與提示詞，回來自動接回原位 */
function aiResumeSave(prompt){
  try{ localStorage.setItem('ib_ai_resume', JSON.stringify({ ts:Date.now(), item:studioItem, note:studioNote, st:aigSt, sh:aigSh, sc:aigNote, pr:prompt || '' })); }catch(e){}
}
function camResumeBoot(){
  let o = null;
  try{ o = JSON.parse(localStorage.getItem('ib_cam_resume') || 'null'); localStorage.removeItem('ib_cam_resume'); }catch(e){}
  let framed = false; try{ framed = window.top !== window.self; }catch(_){ framed = true; }
  if (!o || !o.item || framed || Date.now() - o.ts > 10 * 60 * 1000) return false;
  studioItem = o.item; studioNote = o.note || '';
  location.hash = '#/studio';
  setTimeout(() => { if (studioItem && curTab() === 'studio') setRecMode('s'); }, 1200);
  return true;
}
function aiResumeBoot(){
  if (camResumeBoot()) return;
  if (aimResumeBoot()) return;
  let o = null;
  try{ o = JSON.parse(localStorage.getItem('ib_ai_resume') || 'null'); localStorage.removeItem('ib_ai_resume'); }catch(e){}
  if (!o || !o.item || Date.now() - o.ts > 12 * 3600 * 1000) return;
  studioItem = o.item; studioNote = o.note || ''; aigSt = o.st || aigSt; aigSh = o.sh || aigSh; aigNote = o.sc || ''; aigResumePrompt = o.pr || '';
  location.hash = '#/studio';
  setTimeout(() => { if (studioItem && curTab() === 'studio') openAiGen(); }, 900);
}
function aigPrompt(){
  const st = AIG_STYLES.find(x => x[0] === aigSt) || AIG_STYLES[0];
  const sh = AIG_SHAPES.find(x => x[0] === aigSh) || AIG_SHAPES[0];
  const verse = studioItem ? String(studioItem.t || '').replace(/\s+/g, ' ').trim().slice(0, 160) : '';
  const theme = (aigNote || '').trim();
  return 'A beautiful, uplifting Christian inspirational background image, ' + st[2] + '. '
    + (theme ? 'Scene: ' + theme + '. ' : '')
    + (verse ? 'Mood inspired by this Bible verse: "' + verse + '". ' : '')
    + 'No text, no letters, no words, no watermark, no people\'s faces; leave calm open space for verse text. Aspect ratio ' + sh[4] + ', high quality.';
}
function openAiGen(){
  if (!studioItem) return;
  const L = {
    title: L3('✨ 用 AI 生成美圖','✨ 用 AI 生成美图','✨ Make a picture with AI'),
    intro: L3('不用找圖：用文字描述想要的畫面，免費 AI 工具幫你畫。已依這節經文寫好提示詞，可以直接用，也可以改。',
              '不用找图：用文字描述想要的画面，免费 AI 工具帮你画。已依这节经文写好提示词，可以直接用，也可以改。',
              'No need to search: describe the scene and a free AI tool draws it. A prompt based on this verse is ready — use it or edit it.'),
    style: L3('畫風','画风','Style'), shape: L3('尺寸','尺寸','Shape'),
    scene: L3('想要的畫面（選填，可用中文或英文）','想要的画面（选填，可用中文或英文）','Scene you want (optional)'),
    scenePh: L3('例如：清晨的湖邊、牧羊人與羊群、橄欖樹下的光','例如：清晨的湖边、牧羊人与羊群、橄榄树下的光','e.g. a quiet lake at dawn, a shepherd and sheep'),
    pr: L3('提示詞（可修改）','提示词（可修改）','Prompt (editable)'),
    gen: L3('⚡ 在 App 內直接生成（免費）','⚡ 在 App 内直接生成（免费）','⚡ Generate here (free)'),
    copy: L3('📋 複製提示詞','📋 复制提示词','📋 Copy prompt'),
    copied: L3('已複製，到下面任一工具貼上就能生成','已复制，到下面任一工具贴上就能生成','Copied — paste it into any tool below'),
    tools: L3('或到這些免費工具貼上提示詞','或到这些免费工具贴上提示词','Or paste it into these free tools'),
    after: L3('生成後把圖存到相簿，再回到美圖按「從相簿選相片」就能用。','生成后把图存到相册，再回到美图按“从相册选相片”就能用。','Save the result to your album, then choose it with “Choose a photo”.'),
    wait: L3('AI 正在畫圖，約 10–40 秒，請稍候…','AI 正在画图，约 10–40 秒，请稍候…','Drawing… about 10–40 seconds'),
    fail: L3('這次沒有生成成功（免費服務有時很忙）。可以再按一次，或複製提示詞到下面的工具。','这次没有生成成功（免费服务有时很忙）。可以再按一次，或复制提示词到下面的工具。','Could not generate this time (the free service is sometimes busy). Try again or copy the prompt to a tool below.'),
    ok: L3('已放進美圖','已放进美图','Added to your picture'),
    note: L3('AI 生成的圖每次都不同；圖上不要有字，經文由 App 排上去。','AI 生成的图每次都不同；图上不要有字，经文由 App 排上去。','Each result is different. The picture has no text — the app adds the verse.')
  };
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  const chipRow = (id, arr, cur) => `<div class="cardchips" id="${id}">` + arr.map(x => `<button data-v="${x[0]}" class="${x[0] === cur ? 'on' : ''}">${esc(L3(x[1][0], x[1][1], x[1][2]))}</button>`).join('') + '</div>';
  mask.innerHTML = `<div class="hlsheet-card pxsheet" style="max-height:92vh;overflow:auto">
    <div class="hlsheet-title">${esc(L.title)}</div>
    <div class="muted" style="font-size:13px;line-height:1.6;margin-bottom:8px">${esc(L.intro)}</div>
    <div class="muted" style="font-size:12px;margin:8px 0 6px">${esc(L.style)}</div>${chipRow('aigSt', AIG_STYLES, aigSt)}
    <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L.shape)}</div>${chipRow('aigSh', AIG_SHAPES, aigSh)}
    <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L.scene)}</div>
    <input class="cardinput" id="aigScene" placeholder="${esc(L.scenePh)}" value="${esc(aigNote)}">
    <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L.pr)}</div>
    <textarea class="cardinput" id="aigPr" rows="8" style="width:100%;font-size:13px;line-height:1.5"></textarea>
    <div class="hlsheet-acts2" style="margin-top:10px">
      <button class="btn primary" id="aigGen">${esc(L.gen)}</button>
      <button class="btn" id="aigCopy">${esc(L.copy)}</button>
    </div>
    <div class="muted" id="aigMsg" style="font-size:12.5px;margin-top:8px;min-height:18px"></div>
    <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.tools)}</div>
    ${AIG_TOOLS().map(x => `<a class="btn block" data-aitool="1" style="margin-top:6px;text-align:left;text-decoration:none" target="_blank" rel="noopener" href="${x[0]}">${esc(x[1])}<span class="muted" style="font-size:11.5px;margin-left:8px">${esc(L3(x[2][0], x[2][1], x[2][2]))}</span></a>`).join('')}
    <label class="btn primary block" style="cursor:pointer;margin-top:12px">${esc(L3('🖼 圖畫好了：從相簿選這張圖','🖼 图画好了：从相册选这张图','🖼 Picture ready: choose it from Photos'))}<input type="file" accept="image/*" hidden id="aigBack"></label>
    <div class="muted" style="font-size:12px;margin-top:10px;line-height:1.6">${esc(L.after)}<br>${esc(L.note)}</div>
    <div class="hlsheet-acts2" style="margin-top:12px"><button class="btn sm" id="aigClose">${esc(t().close)}</button></div>
  </div>`;
  document.body.appendChild(mask);
  const pr = $('#aigPr', mask), msg = $('#aigMsg', mask);
  let edited = false;
  const fill = () => { if (!edited) pr.value = aigPrompt(); };
  fill(); if (aigResumePrompt){ pr.value = aigResumePrompt; edited = true; aigResumePrompt = ''; }
  pr.oninput = () => { edited = true; };
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  $('#aigClose', mask).onclick = () => mask.remove();
  const chips = (id, set) => $$('#' + id + ' button', mask).forEach(b => b.onclick = () => {
    set(b.dataset.v); edited = false; fill();
    $$('#' + id + ' button', mask).forEach(o => o.classList.toggle('on', o === b));
  });
  chips('aigSt', v => { aigSt = v; }); chips('aigSh', v => { aigSh = v; });
  const sc = $('#aigScene', mask); sc.oninput = () => { aigNote = sc.value; edited = false; fill(); };
  $('#aigCopy', mask).onclick = async () => {
    try{ await navigator.clipboard.writeText(pr.value); }
    catch(e){ pr.focus(); pr.select(); try{ document.execCommand('copy'); }catch(_){} }
    aiResumeSave(pr.value); msg.textContent = L.copied;
  };
  $$('a[data-aitool]', mask).forEach(a => a.addEventListener('click', () => {
    aiResumeSave(pr.value);
    try{ const q = navigator.clipboard.writeText(pr.value); if (q && q.catch) q.catch(() => {}); }catch(e){}
  }));
  const back = $('#aigBack', mask);
  if (back) back.onchange = () => { const f = back.files && back.files[0]; if (!f) return; mask.remove(); pickPhoto(back); };
  let busy = false;
  $('#aigGen', mask).onclick = async () => {
    if (busy) return; busy = true;
    const sh = AIG_SHAPES.find(x => x[0] === aigSh) || AIG_SHAPES[0];
    const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(pr.value) + '?width=' + sh[2] + '&height=' + sh[3]
      + '&nologo=true&model=flux&seed=' + Math.floor(Math.random() * 1e6);
    msg.textContent = L.wait;
    try{
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 90000);
      const r = await fetch(url, { mode:'cors', signal: ctl.signal }); clearTimeout(tm);
      if (!r.ok) throw new Error('http ' + r.status);
      const blob = await r.blob();
      if (!/^image\//.test(blob.type)) throw new Error('type');
      const obj = URL.createObjectURL(blob);
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = obj; });
      if (!photoMode) photoMode = 'full';
      setPhoto(im, 'AI'); plSave(im, 'AI');
      mask.remove(); toast(L.ok); await studioRefresh();
    }catch(e){ msg.textContent = L.fail; }
    busy = false;
  };
}

/* ================================================================ AI 配樂：依經文寫好提示詞，到免費 AI 音樂工具生成，再把音樂檔選回來 */
const AIM_STYLES = [
  ['pi', ['鋼琴','钢琴','Piano'], 'solo piano, soft and warm, gentle arpeggios'],
  ['st', ['弦樂','弦乐','Strings'], 'warm string ensemble with soft piano, cinematic and tender'],
  ['gt', ['木吉他','木吉他','Guitar'], 'fingerstyle acoustic guitar with light ambient pads'],
  ['am', ['空靈','空灵','Ambient'], 'ethereal ambient pads, slow evolving texture, spacious reverb'],
  ['wh', ['敬拜','敬拜','Worship'], 'contemporary worship instrumental, piano, soft drums, warm synth pad, building gently'],
  ['hy', ['聖詩','圣诗','Hymn'], 'reverent hymn-like instrumental, pipe organ and strings, unhurried']
];
const AIM_MOODS = [
  ['pe', ['平安','平安','Peace'], 'peaceful and calm'],
  ['hp', ['盼望','盼望','Hope'], 'hopeful and uplifting'],
  ['jy', ['喜樂','喜乐','Joy'], 'joyful and bright'],
  ['cm', ['安慰','安慰','Comfort'], 'tender and comforting'],
  ['md', ['默想','默想','Meditative'], 'quiet and meditative'],
  ['pr', ['讚美','赞美','Praise'], 'grateful and celebratory']
];
const AIM_LENS = [['30', ['約 30 秒','约 30 秒','~30 sec'], 'about 30 seconds'], ['60', ['約 1 分鐘','约 1 分钟','~1 min'], 'about 1 minute'], ['120', ['約 2 分鐘','约 2 分钟','~2 min'], 'about 2 minutes']];
const AIM_TOOLS = () => [
  ['https://suno.com/', 'Suno', ['每天有免費額度、可下載 MP3（免費方案多半限非商業）','每天有免费额度、可下载 MP3（免费方案多半限非商业）','Daily free credits, MP3 download (free plan is usually non-commercial)']],
  ['https://labs.google/fx/tools/music-fx', 'Google MusicFX', ['免費、需 Google 帳號、英文提示詞、約 70 秒','免费、需 Google 账号、英文提示词、约 70 秒','Free, Google account, English prompts, ~70 s']],
  ['https://stableaudio.com/', 'Stable Audio', ['有免費額度、可下載、適合純音樂','有免费额度、可下载、适合纯音乐','Free credits, download, good for instrumentals']]
];
let aimSt = 'pi', aimMd = 'pe', aimLn = '60', aimNote = '', aimResumePrompt = '';
function aimPrompt(){
  const st = AIM_STYLES.find(x => x[0] === aimSt) || AIM_STYLES[0];
  const md = AIM_MOODS.find(x => x[0] === aimMd) || AIM_MOODS[0];
  const ln = AIM_LENS.find(x => x[0] === aimLn) || AIM_LENS[1];
  const verse = studioItem ? String(studioItem.t || '').replace(/\s+/g, ' ').trim().slice(0, 100) : '';
  const theme = (aimNote || '').trim();
  return 'Instrumental only, no vocals, no lyrics. Gentle Christian worship background music, ' + st[2] + '. Mood: ' + md[2] + '. '
    + (theme ? 'Imagery: ' + theme + '. ' : '')
    + (verse ? 'Inspired by this Bible verse: "' + verse + '". ' : '')
    + 'Slow to medium tempo, soft intro and gentle ending, easy to loop, ' + ln[2] + '.';
}
function aimResumeSave(prompt){
  try{ localStorage.setItem('ib_mu_resume', JSON.stringify({ ts:Date.now(), item:studioItem, note:studioNote, st:aimSt, md:aimMd, ln:aimLn, sc:aimNote, pr:prompt || '' })); }catch(e){}
}
function aimResumeBoot(){
  let o = null;
  try{ o = JSON.parse(localStorage.getItem('ib_mu_resume') || 'null'); localStorage.removeItem('ib_mu_resume'); }catch(e){}
  if (!o || !o.item || Date.now() - o.ts > 12 * 3600 * 1000) return false;
  studioItem = o.item; studioNote = o.note || ''; aimSt = o.st || aimSt; aimMd = o.md || aimMd; aimLn = o.ln || aimLn; aimNote = o.sc || ''; aimResumePrompt = o.pr || '';
  location.hash = '#/studio';
  setTimeout(() => { if (studioItem && curTab() === 'studio') openAiMusic(); }, 900);
  return true;
}
function openAiMusic(){
  if (!studioItem) return;
  const L = {
    title: L3('🎵 用 AI 生成配樂','🎵 用 AI 生成配乐','🎵 Make music with AI'),
    intro: L3('不用找音樂：選曲風與心情，App 依這節經文寫好提示詞，貼到免費 AI 音樂工具，幾十秒就生成一首純音樂。',
              '不用找音乐：选曲风与心情，App 依这节经文写好提示词，贴到免费 AI 音乐工具，几十秒就生成一首纯音乐。',
              'No need to hunt for music: pick a style and mood, the app writes a prompt from this verse; paste it into a free AI music tool and get an instrumental in under a minute.'),
    style: L3('曲風','曲风','Style'), mood: L3('心情','心情','Mood'), len: L3('長度','长度','Length'),
    scene: L3('想要的畫面或感覺（選填，中英文都可以）','想要的画面或感觉（选填，中英文都可以）','Imagery or feeling (optional)'),
    scenePh: L3('例如：清晨的湖邊、慢慢升起的陽光','例如：清晨的湖边、慢慢升起的阳光','e.g. a quiet lake at dawn, slowly rising sunlight'),
    pr: L3('提示詞（可修改，英文效果最好）','提示词（可修改，英文效果最好）','Prompt (editable)'),
    copy: L3('📋 複製提示詞','📋 复制提示词','📋 Copy prompt'),
    copied: L3('已複製，到下面任一工具貼上就能生成','已复制，到下面任一工具贴上就能生成','Copied — paste it into a tool below'),
    tools: L3('到這些免費工具貼上提示詞（點進去會自動複製）','到这些免费工具贴上提示词（点进去会自动复制）','Paste it into these free tools (tapping copies the prompt)'),
    back: L3('🎵 音樂做好了：從檔案選這首','🎵 音乐做好了：从文件选这首','🎵 Music ready: choose the file'),
    after: L3('在工具裡把音樂下載（MP3），存到「檔案」，回到這裡按上面的按鈕選它，就會成為這張美圖的配樂，錄影時自動混進去。',
              '在工具里把音乐下载（MP3），存到“文件”，回到这里按上面的按钮选它，就会成为这张美图的配乐，录影时自动混进去。',
              'Download the MP3 in the tool, save it to Files, then choose it with the button above. It becomes the background music when you record.'),
    note: L3('各工具的免費額度與使用條款會變動；AI 生成的音樂若要公開發布或商用，請先看該工具的條款。',
             '各工具的免费额度与使用条款会变动；AI 生成的音乐若要公开发布或商用，请先看该工具的条款。',
             'Free quotas and terms change. Check each tool’s terms before publishing or commercial use.')
  };
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  const chipRow = (id, arr, cur) => `<div class="cardchips" id="${id}">` + arr.map(x => `<button data-v="${x[0]}" class="${x[0] === cur ? 'on' : ''}">${esc(L3(x[1][0], x[1][1], x[1][2]))}</button>`).join('') + '</div>';
  mask.innerHTML = `<div class="hlsheet-card pxsheet" style="max-height:92vh;overflow:auto">
    <div class="hlsheet-title">${esc(L.title)}</div>
    <div class="muted" style="font-size:13px;line-height:1.6;margin-bottom:8px">${esc(L.intro)}</div>
    <div class="muted" style="font-size:12px;margin:8px 0 6px">${esc(L.style)}</div>${chipRow('aimSt', AIM_STYLES, aimSt)}
    <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L.mood)}</div>${chipRow('aimMd', AIM_MOODS, aimMd)}
    <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L.len)}</div>${chipRow('aimLn', AIM_LENS, aimLn)}
    <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L.scene)}</div>
    <input class="cardinput" id="aimScene" placeholder="${esc(L.scenePh)}" value="${esc(aimNote)}">
    <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L.pr)}</div>
    <textarea class="cardinput" id="aimPr" rows="7" style="width:100%;font-size:13px;line-height:1.5"></textarea>
    <div class="hlsheet-acts2" style="margin-top:10px"><button class="btn primary" id="aimCopy">${esc(L.copy)}</button></div>
    <div class="muted" id="aimMsg" style="font-size:12.5px;margin-top:8px;min-height:18px"></div>
    <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.tools)}</div>
    ${AIM_TOOLS().map(x => `<a class="btn block" data-aimtool="1" style="margin-top:6px;text-align:left;text-decoration:none" target="_blank" rel="noopener" href="${x[0]}">${esc(x[1])}<span class="muted" style="font-size:11.5px;margin-left:8px">${esc(L3(x[2][0], x[2][1], x[2][2]))}</span></a>`).join('')}
    <label class="btn primary block" style="cursor:pointer;margin-top:12px">${esc(L.back)}<input type="file" accept="audio/*,.mp3,.m4a,.wav" hidden id="aimBack"></label>
    <div class="muted" style="font-size:12px;margin-top:10px;line-height:1.6">${esc(L.after)}<br>${esc(L.note)}</div>
    <div class="hlsheet-acts2" style="margin-top:12px"><button class="btn sm" id="aimClose">${esc(t().close)}</button></div>
  </div>`;
  document.body.appendChild(mask);
  const pr = $('#aimPr', mask), msg = $('#aimMsg', mask);
  let edited = false;
  const fill = () => { if (!edited) pr.value = aimPrompt(); };
  fill(); if (aimResumePrompt){ pr.value = aimResumePrompt; edited = true; aimResumePrompt = ''; }
  pr.oninput = () => { edited = true; };
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  $('#aimClose', mask).onclick = () => mask.remove();
  const chips = (id, set) => $$('#' + id + ' button', mask).forEach(b => b.onclick = () => {
    set(b.dataset.v); edited = false; fill();
    $$('#' + id + ' button', mask).forEach(o => o.classList.toggle('on', o === b));
  });
  chips('aimSt', v => { aimSt = v; }); chips('aimMd', v => { aimMd = v; }); chips('aimLn', v => { aimLn = v; });
  const sc = $('#aimScene', mask); sc.oninput = () => { aimNote = sc.value; edited = false; fill(); };
  $('#aimCopy', mask).onclick = async () => {
    try{ await navigator.clipboard.writeText(pr.value); }
    catch(e){ pr.focus(); pr.select(); try{ document.execCommand('copy'); }catch(_){} }
    aimResumeSave(pr.value); msg.textContent = L.copied;
  };
  $$('a[data-aimtool]', mask).forEach(a => a.addEventListener('click', () => {
    aimResumeSave(pr.value);
    try{ const q = navigator.clipboard.writeText(pr.value); if (q && q.catch) q.catch(() => {}); }catch(e){}
  }));
  const back = $('#aimBack', mask);
  back.onchange = () => { const f = back.files && back.files[0]; if (!f) return; mask.remove(); pickBgm(back); };
}

function openPexels(){
  const L = pl();
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card pxsheet">
    <div class="hlsheet-title">${esc(L.title)}</div>
    <div class="pxbar">
      <input class="cardinput" id="pxQ" placeholder="${esc(L.ph)}" value="${esc(pxState.q)}">
      <button class="btn sm primary" id="pxGo">${esc(L.search)}</button>
    </div>
    <div class="cardchips pxchips" id="pxPre">
      ${L.presets.map(([n, q]) => `<button data-q="${esc(q)}">${esc(n)}</button>`).join('')}
    </div>
    <div class="pxgrid" id="pxGrid"></div>
    <div class="hlsheet-acts2" style="margin-top:12px">
      <button class="btn sm" id="pxMore">${esc(L.more)}</button>
      <button class="btn sm" id="pxClose">${esc(t().close)}</button>
    </div>
    <div class="muted" style="font-size:12px;margin-top:10px">${esc(L.hint)}</div>
  </div>`;
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  $('#pxClose', mask).onclick = () => mask.remove();

  const grid = $('#pxGrid', mask);
  const paint = () => {
    if (!pxState.items.length){
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:24px">${esc(pxState.busy ? L.loading : L.none)}</div>`;
      return;
    }
    grid.innerHTML = pxState.items.map((p, i) => `
      <button class="pxcell" data-i="${i}">
        <img src="${esc((p.src && (p.src.tiny || p.src.small)) || '')}" alt="" loading="lazy">
        <span>${esc(p.photographer || '')}</span>
      </button>`).join('');
    $$('.pxcell', grid).forEach(b => b.onclick = async () => {
      const p = pxState.items[+b.dataset.i]; if (!p) return;
      b.classList.add('on'); toast(L.loadingPic);
      try{
        await pxLoad(p);
        mask.remove(); toast(L.picked);
        await studioRefresh();
      }catch(e){ b.classList.remove('on'); toast(t().photoBad, 4000); }
    });
  };
  const run = async reset => {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:24px">${esc(L.loading)}</div>`;
    await pxFetch(reset); paint();
    const mb = $('#pxMore', mask); if (mb) mb.hidden = pxState.end || !pxState.items.length;
  };
  $('#pxGo', mask).onclick = () => { pxState.q = $('#pxQ', mask).value; run(true); };
  $('#pxQ', mask).onkeydown = e => { if (e.key === 'Enter'){ pxState.q = e.target.value; run(true); } };
  $$('#pxPre button', mask).forEach(b => b.onclick = () => {
    pxState.q = b.dataset.q; $('#pxQ', mask).value = b.dataset.q; run(true);
  });
  $('#pxMore', mask).onclick = () => run(false);
  run(true);
}

/* ================================================================ 詩歌庫
   背景音樂除了從手機選檔案，也可以從「詩歌庫」挑——詩歌放在這個網站自己的
   music/ 資料夾裡，清單寫在 music.json。同源，所以不會有跨網域取不到音訊的問題
   （跨網域的音檔若對方沒開 CORS，混音錄出來會是「有畫面、沒聲音」，很難查）。

   怎麼加歌：把 mp3 放進 music/，在 music.json 的 songs 陣列加一筆，就出現在清單裡。
   詳細說明寫在 music.json 最上面。 */
const MUSIC_JSON = 'music.json';
const MUSIC_DIR  = 'music/';
const HYM_L = {
  zh:{ lib:'詩歌庫', btn:'🎵 從詩歌庫選', title:'詩歌庫', ph:'找歌名…',
       loading:'載入中…', close:'關閉', all:'全部', play:'試聽', stop:'停止',
       none:'找不到這首，換個字試試', picked:'已選好這首詩歌', getting:'載入詩歌中…',
       noList:'還沒有建立詩歌庫。把 mp3 放進網站的 music/ 資料夾，並在 music.json 加上清單，這裡就會出現。',
       bad:'這首載入失敗，換一首試試', credit:'詩歌：', srcT:'出處：',
       e404a:'找不到 ', e404b:'（根目錄也找過了）　這個音檔還沒上傳到網站上',
       eNet:'連不到音檔（網路或離線）：', eEmpty:'　這個檔是空的，請重新上傳',
       eHtml:'　抓回來的不是音檔，是網頁（多半是 404 頁面）', again:'找到音檔了，請再按一次 ▶',
       miss:'音檔還沒上傳到網站：',
       hint:'詩歌放在自己的網站上，錄影片時混得進去。下載與使用請遵守各詩歌的授權規定。' },
  zs:{ lib:'诗歌库', btn:'🎵 从诗歌库选', title:'诗歌库', ph:'找歌名…',
       loading:'载入中…', close:'关闭', all:'全部', play:'试听', stop:'停止',
       none:'找不到这首，换个字试试', picked:'已选好这首诗歌', getting:'载入诗歌中…',
       noList:'还没有建立诗歌库。把 mp3 放进网站的 music/ 文件夹，并在 music.json 加上清单，这里就会出现。',
       bad:'这首载入失败，换一首试试', credit:'诗歌：', srcT:'出处：',
       e404a:'找不到 ', e404b:'（根目录也找过了）　这个音档还没上传到网站上',
       eNet:'连不到音档（网络或离线）：', eEmpty:'　这个档是空的，请重新上传',
       eHtml:'　抓回来的不是音档，是网页（多半是 404 页面）', again:'找到音档了，请再按一次 ▶',
       miss:'音档还没上传到网站：',
       hint:'诗歌放在自己的网站上，录视频时混得进去。下载与使用请遵守各诗歌的授权规定。' },
  en:{ lib:'Hymn library', btn:'🎵 Pick a hymn', title:'Hymn library', ph:'Find a hymn…',
       loading:'Loading…', close:'Close', all:'All', play:'Preview', stop:'Stop',
       none:'Not found — try another word', picked:'Hymn selected', getting:'Loading the hymn…',
       noList:'No hymn library yet. Put mp3 files in the site’s music/ folder and list them in music.json.',
       bad:'That hymn could not be loaded — try another', credit:'Hymn: ', srcT:'Source: ',
       e404a:'Not found: ', e404b:' (the site root was checked too) — this file has not been uploaded yet',
       eNet:'Cannot reach the audio file (offline?): ', eEmpty:' — the file is empty, please re-upload',
       eHtml:' — what came back is a web page, not audio (usually a 404 page)', again:'Found it — tap ▶ once more',
       miss:'Not uploaded yet: ',
       hint:'Hymns are hosted on this site, so they mix into recordings properly. Please respect each hymn’s licence.' }
};
const hl_ = () => HYM_L[state.lang] || (isX() ? HYM_L.en : HYM_L.zh);
/* 一首歌的顯示名稱（三語，沒填就用中文那個） */
const songName = s => (isID() ? (s.ni || s.ne || s.n) : isJA() ? (s.nj || s.ne || s.n) : isKO() ? (s.nk || s.ne || s.n) : isEN() ? (s.ne || s.n) : (isZS() ? (s.ns || s.n) : s.n)) || s.f || '';
/* 出處與分類也跟著語言走（music.json 的 bs／be、ts／te；沒填就用中文那個） */
const songBy  = s => (isID() ? (s.bi || s.be || s.by) : isJA() ? (s.bj || s.be || s.by) : isKO() ? (s.bk || s.be || s.by) : isEN() ? (s.be || s.by) : (isZS() ? (s.bs || s.by) : s.by)) || '';
const tagName = (s, tg) => { const L = (hymnList || []).find(x => x.tag === tg) || s || {};
  return (isID() ? (L.ti || L.te || tg) : isJA() ? (L.tj || L.te || tg) : isKO() ? (L.tk || L.te || tg) : isEN() ? (L.te || tg) : (isZS() ? (L.ts || tg) : tg)) || ''; };

let hymnList = null;          // null = 還沒抓過
let bgmCredit = '';           // 「詩歌：〈歌名〉／出處」，會印在影片下緣
let hymnPrev = null;          // 目前正在試聽的那顆按鈕對應的元素
/* iPhone 的規矩（跟朗讀那邊踩過的一模一樣）：
   ① 整個 App 只能有「一個」<audio>，每次換 src 重用它；
   ② play() 必須在使用者按下去的「那一瞬間」同步呼叫，
      只要中間 await 過、或進了 .then()，手勢視窗就過期，Safari 直接擋掉，
      而且不會報錯——按鈕變成暫停、卻一點聲音也沒有，正是這個。 */
let hymnEl = null;
function hymnAudio(){
  if (hymnEl) return hymnEl;
  hymnEl = document.createElement('audio');
  hymnEl.preload = 'auto';
  hymnEl.playsInline = true;
  ['playsinline','webkit-playsinline'].forEach(a => hymnEl.setAttribute(a, ''));
  hymnEl.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(hymnEl);
  return hymnEl;
}
/* 面板一打開就先確定音檔放在 music/ 還是根目錄，
   等到按下去才查就來不及了（查完手勢已經過期）。 */
async function musicProbe(list){
  if (!list || !list.length) return;
  /* v2.16.0：每一首各自探路（並行 HEAD），記在 songBase[檔名]。
     以前只試前十二首、找到一邊就套用全部——結果 m01～m20 還沒上傳、
     後面幾首又放在根目錄時，整份清單都判成「找不到」，一首也放不出來。
     現在 music/ 與根目錄混放也沒關係，沒上傳的那幾首會清楚標示。 */
  await Promise.all(list.map(async s => {
    if (!s || !s.f || songBase[s.f] !== undefined) return;
    const name = encodeURIComponent(s.f);
    for (const b of [MUSIC_DIR, '']){
      try{
        const r = await fetch(b + name + '?v=' + VERSION, { method:'HEAD', cache:'no-cache' });
        if (r.ok && !/(^|,)\s*text\/html/.test(r.headers.get('content-type') || '')){
          songBase[s.f] = b; if (musicBase === null) musicBase = b; return;
        }
      }catch(e){ return; }               /* 離線：不下結論，按的時候再查 */
    }
    songBase[s.f] = false;
  }));
}


async function hymnLoadList(){
  if (hymnList) return hymnList;
  const r = await fetch(MUSIC_JSON + '?v=' + VERSION);
  if (!r.ok) throw new Error('http ' + r.status);
  const d = await r.json();
  hymnList = Array.isArray(d) ? d : ((d && d.songs) || []);
  return hymnList;
}
function hymnStopPrev(){
  if (hymnEl){ try{ hymnEl.pause(); }catch(e){} }
  hymnPrev = null;
  $$('.hymnrow .hymnplay').forEach(b => b.textContent = '▶');
}
/* GitHub 網頁版上傳有個坑：「Upload files」只會把檔案放進你「目前所在」的資料夾，
   在檔名前面打 music/ 是「Create new file」才有的寫法。所以很容易十個 mp3 全部
   掉在根目錄。與其叫人重傳，不如兩個地方都找——先找 music/，沒有就找根目錄，
   找到哪一邊就記起來，後面幾首不必再試。 */
let musicBase = null;                      // null = 還沒試過
const songBase = {};                       // 每首歌在哪裡：'music/'／''／false（沒上傳）
async function hymnFetch(s){
  const name = encodeURIComponent(s.f);
  const sb = songBase[s.f];
  const tries = (typeof sb === 'string') ? [sb] : [MUSIC_DIR, ''];
  let why = '';
  for (const b of tries){
    const path = b + name;
    let r;
    try{ r = await fetch(path + '?v=' + VERSION); }
    catch(e){ why = hl_().eNet + path; continue; }
    if (r.status === 404){ why = why || (hl_().e404a + MUSIC_DIR + name + hl_().e404b); continue; }
    if (!r.ok){ why = path + '：HTTP ' + r.status; continue; }
    const blob = await r.blob();
    if (!blob.size){ why = path + hl_().eEmpty; continue; }
    if (/(^|,)text\/html/.test(blob.type || '')){ why = path + hl_().eHtml; continue; }
    songBase[s.f] = b; if (musicBase === null) musicBase = b;   // 這一首在這一邊，記下來
    return blob;
  }
  throw new Error(why || hl_().bad);
}
/* 選一首：抓成 blob（同源，錄影混得進去），並記下出處 */
async function hymnPick(s){
  bgmBlob = await hymnFetch(s);
  bgmName = songName(s);
  bgmCredit = hl_().credit + songName(s) + (songBy(s) ? (isEN() ? ' / ' : '／') + songBy(s) : '');
}

function openHymns(){
  const L = hl_(), Lb = t();
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card hymnsheet">
    <div class="hlsheet-title">${esc(L.title)}</div>
    <div class="pxbar">
      <input class="cardinput" id="hyQ" placeholder="${esc(L.ph)}">
    </div>
    <div class="cardchips" id="hyTags"></div>
    <div id="hyList"></div>
    <div class="hlsheet-acts" style="margin-top:12px">
      <button class="btn" id="hyClose">${esc(L.close)}</button>
    </div>
    <div class="muted" style="font-size:12px;margin-top:10px">${esc(L.hint)}</div>
  </div>`;
  document.body.appendChild(mask);
  const shut = () => { hymnStopPrev(); mask.remove(); };
  mask.onclick = e => { if (e.target === mask) shut(); };
  $('#hyClose', mask).onclick = shut;

  const box = $('#hyList', mask), tagBox = $('#hyTags', mask), inp = $('#hyQ', mask);
  let tag = '';
  box.innerHTML = `<div class="empty">${esc(L.loading)}</div>`;

  const paint = () => {
    const q = (inp.value || '').trim().toLowerCase();
    const list = (hymnList || []).filter(s => {
      if (tag && (s.tag || '') !== tag) return false;
      if (!q) return true;
      return (songName(s) + ' ' + (s.n || '') + ' ' + (s.ne || '') + ' ' + (s.by || '') + ' ' + tagName(s, s.tag || ''))
             .toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length){ box.innerHTML = `<div class="empty">${esc(L.none)}</div>`; return; }
    box.innerHTML = list.map(function (s){
      const i = hymnList.indexOf(s);
      const miss = songBase[s.f] === false;
      return `<div class="hymnrow${miss ? ' miss' : ''}" data-i="${i}"${miss ? ' style="opacity:.5"' : ''}>
        <button class="hymnplay" data-p="${i}">▶</button>
        <div class="meta"><div class="t">${esc(songName(s))}</div>
        <div class="s">${esc(miss ? L.miss + s.f : [songBy(s), s.tag ? tagName(s, s.tag) : ''].filter(Boolean).join(isEN() ? ' · ' : '　·　'))}</div></div>
        <div class="chev">›</div></div>`;
    }).join('');
    $$('.hymnrow', box).forEach(row => {
      row.onclick = async e => {
        if (e.target.closest('.hymnplay')) return;
        const s = hymnList[+row.dataset.i]; if (!s) return;
        hymnStopPrev(); toast(L.getting, 8000);
        try{ await hymnPick(s); shut(); toast(L.picked); await studioRefresh(); }
        catch(err){ toast((err && err.message) ? err.message : L.bad, 7000); }
      };
    });
    $$('.hymnplay', box).forEach(b => {
      b.onclick = () => {
        const s = hymnList[+b.dataset.p]; if (!s) return;
        const playing = hymnPrev === b;
        hymnStopPrev();
        if (playing) return;
        const a = hymnAudio();
        const sb = songBase[s.f];
        const src = (typeof sb === 'string' ? sb : (musicBase !== null ? musicBase : MUSIC_DIR)) + encodeURIComponent(s.f);
        try{ if (a.src && a.src.indexOf('blob:') === 0) URL.revokeObjectURL(a.src); }catch(e){}
        a.onended = hymnStopPrev;
        a.onerror = null;
        a.src = src;
        hymnPrev = b; b.textContent = '⏸';
        /* 同步呼叫，中間不能有 await */
        const q = a.play();
        if (q && q.catch) q.catch(function (){
          hymnStopPrev();
          /* 放不出來，把真正的原因查清楚再講——順便把位置記起來，下次就對了 */
          hymnFetch(s).then(function (){ toast(L.again, 5000); })
                      .catch(function (err){ toast((err && err.message) || L.bad, 7000); });
        });
      };
    });
  };

  hymnLoadList().then(async function (list){
    if (!list.length){ box.innerHTML = `<div class="empty">${esc(L.noList)}</div>`; return; }
    await musicProbe(list);
    const tags = [];
    list.forEach(s => { if (s.tag && tags.indexOf(s.tag) < 0) tags.push(s.tag); });
    if (tags.length > 1){
      tagBox.innerHTML = `<button class="on" data-t="">${esc(L.all)}</button>`
        + tags.map(x => `<button data-t="${esc(x)}">${esc(tagName(null, x))}</button>`).join('');
      $$('#hyTags button', mask).forEach(b => b.onclick = () => {
        tag = b.dataset.t;
        $$('#hyTags button', mask).forEach(x => x.classList.toggle('on', x === b));
        paint();
      });
    }
    inp.oninput = paint;
    paint();
  }).catch(function (){
    box.innerHTML = `<div class="empty">${esc(L.noList)}</div>`;
  });
}

/* ================================================================ 經文美圖
   把畫線的經文與領受畫成一張圖，直接分享到 LINE／IG／FB。
   作法與《321愛的關懷》相同：canvas 畫好 → navigator.share 傳檔，
   不支援就退回下載，讓使用者自己從相簿分享。 */
const CARD_TPL = {
  navy:  { n:['深藍聖夜','深蓝圣夜','Midnight Navy'], bg:['#123F92','#0D3988','#071A42'], glow:'rgba(212,166,91,.30)',
           ink:'#F2ECDD', accent:'#F7EFDC', gold:'#D4A65B', sub:'#BBA98A', frame:'rgba(212,166,91,.42)' },
  paper: { n:['素樸信箋','素朴信笺','Plain Letter'], bg:['#FBF8F1','#F4EFE3','#EDE6D6'], glow:'rgba(212,166,91,.45)',
           ink:'#3A3122', accent:'#23211C', gold:'#A9762F', sub:'#8A7C63', frame:'rgba(169,118,47,.34)' },
  dawn:  { n:['晨曦盼望','晨曦盼望','Dawn of Hope'], bg:['#FFF6EC','#FBE9D2','#F6D9B8'], glow:'rgba(255,214,150,.6)',
           ink:'#3A2A1A', accent:'#8A4B16', gold:'#C97A22', sub:'#8A6A4A', frame:'rgba(181,101,29,.30)' },
  grace: { n:['青草安歇','青草安歇','Green Pastures'], bg:['#F2F7F1','#E4EFE6','#D6E7DA'], glow:'rgba(160,200,170,.5)',
           ink:'#1C2E26', accent:'#255943', gold:'#3C8A64', sub:'#5C7A6A', frame:'rgba(46,106,80,.28)' },
  rose:  { n:['溫柔玫瑰','温柔玫瑰','Gentle Rose'], bg:['#FCF5F3','#F6E7E3','#EFD8D2'], glow:'rgba(220,160,150,.45)',
           ink:'#33221E', accent:'#8A3D2E', gold:'#B36A54', sub:'#8A6A62', frame:'rgba(154,74,58,.28)' },
  sky:   { n:['平安晴空','平安晴空','Peaceful Sky'], bg:['#F1F7FB','#DFEEF6','#CFE4F0'], glow:'rgba(150,200,230,.5)',
           ink:'#1B2A33', accent:'#1E5270', gold:'#2E7DA0', sub:'#5A7684', frame:'rgba(37,96,128,.28)' },
  linen: { n:['素雅棉麻','素雅棉麻','Soft Linen'], bg:['#F7F4EE','#EFEAE0','#E6DFD2'], glow:'rgba(200,190,170,.4)',
           ink:'#2A2620', accent:'#4A4234', gold:'#8A7A5A', sub:'#7A7263', frame:'rgba(90,80,64,.26)' },
  night: { n:['深夜星光','深夜星光','Starry Night'], bg:['#101E1B','#16302A','#0E2420'], glow:'rgba(232,201,122,.26)',
           ink:'#EDEAE0', accent:'#E8C97A', gold:'#E8C97A', sub:'#9FB0AA', frame:'rgba(232,201,122,.34)' },
  plain: { n:['純白簡潔','纯白简洁','Pure White'], bg:['#FFFFFF','#FFFFFF','#FFFFFF'], glow:'rgba(0,0,0,0)',
           ink:'#23211C', accent:'#0D3988', gold:'#A9762F', sub:'#6B6255', frame:'rgba(13,57,136,.22)' }
};
const CARD_ORDER = ['navy','paper','dawn','grace','rose','sky','linen','night','plain'];
const CARD_SIZES = { p:[1080,1920,['直式 9:16','直式 9:16','Portrait 9:16']],
                     t:[1080,1350,['直式 4:5','直式 4:5','Portrait 4:5']],
                     s:[1080,1080,['方形','方形','Square']],
                     w:[1920,1080,['橫式 16:9','横式 16:9','Landscape 16:9']],
                     f:[1440,1080,['橫式 4:3','横式 4:3','Landscape 4:3']] };
const CARD_BORDERS = [ ['classic',['古典雙框','古典双框','Classic Double']], ['corner',['雅緻角飾','雅致角饰','Elegant Corners']],
                       ['inline',['內斂細線','内敛细线','Fine Line']], ['dots',['珠鏈點框','珠链点框','Beaded Dots']],
                       ['ornate',['華麗花角','华丽花角','Ornate Corners']], ['none',['無邊框','无边框','No Border']] ];
const CARD_FONT_TITLE = () => L3('字體與文字顏色','字体与文字颜色','Font and text colour');
const CARD_FS = [[0.9,['小一點','小一点','Smaller']], [1,['標準','标准','Standard']], [1.2,['大','大','Large']],
                 [1.45,['特大','特大','Extra Large']], [1.7,['超大','超大','Huge']]];
let cardImg = null;
const cardTpl = () => CARD_TPL[state.cardTpl] ? state.cardTpl : 'navy';
const cardSize = () => CARD_SIZES[state.cardSize] ? state.cardSize : 't';
const cardBorder = () => CARD_BORDERS.some(b => b[0] === state.cardBorder) ? state.cardBorder : 'classic';
const cardFs = () => Math.min(1.8, Math.max(.85, +state.cardFs || 1));

/* ---- 相片（作背景／貼在卡片上）---- */
let fullKind = 'verse', fullScale = 1.1, fullBless = '', blessOwn = '';   /* blessOwn：使用者自己想說的話，小智依經文＋這段話寫祝福 */   /* fullBless：小智依經文寫的一兩句祝福，附在經文下面 */   /* 整張原圖：文字用經文或問候語 */
let photoImg = null, photoMode = 'full', suppressSticker = false, selfieLayout = false;
/* v2.16.0：背景與貼紙各一張，可以同時存在。photoImg/photoBy＝背景；stkImg/stkBy＝貼在卡片上。
   photoMode 現在只代表「目前在編輯哪一張」，選相片時放進那一格。 */
let stkImg = null, stkBy = '';
function setPhoto(im, by){
  if (photoMode === 'sticker'){ stkImg = im; stkBy = by || ''; }
  else { photoImg = im; photoBy = by || ''; }
}
let stkSize = 0.30, stkPos = 'br', stkShape = 'p';
/* 原圖模式：相片完整呈現（不裁切），文字另外排在不蓋住相片的空位；
   文字區塊可以拖動，位置存成佔整張卡片寬高的比例 */
let origScale = 1, origDX = 0, origDY = 0, origMove = false;
let origLay = 'auto', origSplit = false, origTarget = 'v', origNX = 0, origNY = 0;   /* 版面：自動／上下／左右；分開移動時 DX/DY 是經文、NX/NY 是領受 */
/* ── 我的相片庫：用過的相片自動留在手機裡（IndexedDB），下次直接挑，不用重找 ── */
const PLIB_MAX = 40;
let pdb = null, plRestored = false;
function plOpen(){
  return new Promise((res, rej) => {
    if (pdb) return res(pdb);
    try{
      const q = indexedDB.open('ib_photos', 1);
      q.onupgradeneeded = e => e.target.result.createObjectStore('p', { keyPath:'id' });
      q.onsuccess = e => { pdb = e.target.result; res(pdb); };
      q.onerror = () => rej(q.error);
    }catch(e){ rej(e); }
  });
}
const plReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function plAll(){
  try{ const db = await plOpen(); return (await plReq(db.transaction('p').objectStore('p').getAll())).sort((a, b) => b.ts - a.ts); }
  catch(e){ return []; }
}
async function plSave(img, by){
  try{
    const db = await plOpen();
    const mk = (max, q, url) => new Promise(r => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      if (url) r(c.toDataURL('image/jpeg', q)); else c.toBlob(b => r(b), 'image/jpeg', q);
    });
    const [blob, thumb] = await Promise.all([mk(1600, .88, false), mk(260, .72, true)]);
    const id = 'p' + Date.now();
    await plReq(db.transaction('p', 'readwrite').objectStore('p').put({ id, ts:Date.now(), blob, thumb, by:by || '', w:img.width, h:img.height }));
    const all = await plAll();
    for (const o of all.slice(PLIB_MAX)) await plReq(db.transaction('p', 'readwrite').objectStore('p').delete(o.id));
    if (photoMode !== 'sticker'){ state.photoLast = id; state.photoMode = photoMode; saveState(); }
  }catch(e){ console.error('photo lib', e); }
}
async function plLoad(rec){
  const url = URL.createObjectURL(rec.blob);
  try{
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url; });
    setPhoto(im, rec.by || '');
    if (photoMode !== 'sticker'){ state.photoLast = rec.id; saveState(); }
    return true;
  }finally{ setTimeout(() => { try{ URL.revokeObjectURL(url); }catch(_){} }, 30000); }
}
/* 進美圖頁時，如果目前沒有相片，就把上次用的那張接回來 */
async function plRestore(){
  if (plRestored || photoImg || !state.photoLast) return;
  plRestored = true;
  try{
    const db = await plOpen();
    const rec = await plReq(db.transaction('p').objectStore('p').get(state.photoLast));
    if (rec){ photoMode = state.photoMode || 'full'; await plLoad(rec); }
  }catch(e){}
}
async function openPhotoLib(){
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card pxsheet">
    <div class="hlsheet-title">${esc(L3('📚 我的相片庫', '📚 我的相片库', '📚 My photos'))}</div>
    <div class="muted" style="font-size:12px;margin-bottom:8px">${esc(L3('從相簿或免費圖庫選過的相片都會自動留在這裡（存在這支手機上，最多 40 張）。點一張就用；右上 × 是移出相片庫。', '从相册或免费图库选过的相片都会自动留在这里（存在这部手机上，最多 40 张）。点一张就用；右上 × 是移出相片库。', 'Photos you pick are kept here automatically (on this device, up to 40). Tap one to use it; × removes it.'))}</div>
    <div class="pxgrid" id="plGrid"></div>
    <div class="hlsheet-acts2" style="margin-top:12px"><button class="btn sm" id="plClose">${esc(t().close)}</button></div>
  </div>`;
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  $('#plClose', mask).onclick = () => mask.remove();
  const grid = $('#plGrid', mask);
  const paint = async () => {
    const all = await plAll();
    if (!all.length){ grid.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:24px">${esc(L3('還沒有相片。先從相簿或免費圖庫選一張，就會留在這裡。', '还没有相片。先从相册或免费图库选一张，就会留在这里。', 'No photos yet. Pick one from your album or the free library and it will be kept here.'))}</div>`; return; }
    grid.innerHTML = all.map(o => `<div class="pxcell" data-id="${o.id}" style="position:relative;cursor:pointer"><img src="${o.thumb}" alt=""><span class="pxdel" data-d="${o.id}" style="position:absolute;right:4px;top:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;text-align:center;line-height:24px;font-size:16px">×</span></div>`).join('');
    $$('.pxcell', grid).forEach(c => c.onclick = async e => {
      const d = e.target.closest('[data-d]');
      const db = await plOpen();
      if (d){ await plReq(db.transaction('p', 'readwrite').objectStore('p').delete(d.dataset.d)); if (state.photoLast === d.dataset.d){ state.photoLast = ''; saveState(); } paint(); return; }
      const rec = await plReq(db.transaction('p').objectStore('p').get(c.dataset.id)); if (!rec) return;
      await plLoad(rec); if (!photoMode) photoMode = 'full'; mask.remove(); await studioRefresh();
    });
  };
  paint();
}
const STK_SIZES  = [[0.22,['小張','小张','Small']],[0.30,['中等','中等','Medium']],[0.38,['大張','大张','Large']],
                    [0.46,['滿版','满版','Full']],[0.62,['超大','超大','Huge']],[0.84,['整排','整排','Full width']]];
const STK_POS    = [['bl',['左下','左下','Bottom left']],['bc',['正下','正下','Bottom centre']],['br',['右下','右下','Bottom right']],
                    ['tl',['左上','左上','Top left']],['tr',['右上','右上','Top right']]];
const STK_SHAPES = [['p',['直式','直式','Portrait']],['w',['橫式 16:9','横式 16:9','Landscape 16:9']],['s',['方形','方形','Square']]];
const stkRatio = () => stkShape === 'w' ? 0.72 : (stkShape === 's' ? 1.06 : 1.12);
/* ---- v2.17.0 內建風景背景：清單在 bg.json，圖檔放根目錄或 bg/ 都可以 ---- */
let bgList = null, bgCats = [], bgCat = 'scenery';
async function bgLoadList(){
  if (bgList) return bgList;
  try{
    const r = await fetch('bg.json?v=' + VERSION);
    const d = r.ok ? await r.json() : {};
    bgList = (d && Array.isArray(d.list)) ? d.list : [];
    bgCats = (d && Array.isArray(d.cats)) ? d.cats : [];
  }catch(e){ bgList = []; bgCats = []; }
  return bgList;
}
const bgCatName = c => (isID() ? (c.ni || c.ne || c.n) : isJA() ? (c.nj || c.ne || c.n) : isKO() ? (c.nk || c.ne || c.n) : isEN() ? (c.ne || c.n) : (isZS() ? (c.ns || c.n) : c.n)) || '';
const bgName = b => (isID() ? (b.ni || b.ne || b.n) : isJA() ? (b.nj || b.ne || b.n) : isKO() ? (b.nk || b.ne || b.n) : isEN() ? (b.ne || b.n) : (isZS() ? (b.ns || b.n) : b.n)) || '';
function bgImgLoad(file){
  return new Promise((res, rej) => {
    const tryAt = (bases) => {
      if (!bases.length) return rej(new Error('missing'));
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => tryAt(bases.slice(1));
      im.src = bases[0] + encodeURIComponent(file) + '?v=' + VERSION;
    };
    tryAt(['', 'bg/']);
  });
}
async function fillBuiltins(){
  const box = $('#pBuilt'); if (!box) return;
  const all = await bgLoadList();
  if (!all.length){ box.parentNode && (box.previousElementSibling.hidden = true); box.remove(); const cb = $('#pBuiltCat'); if (cb) cb.remove(); return; }
  /* 分類：只列出真的有圖的分類；沒設分類的圖算「風景」 */
  const catOf = b => b.c || (bgCats[0] && bgCats[0].id) || '';
  const cats = bgCats.filter(c => all.some(b => catOf(b) === c.id));
  if (cats.length && !cats.some(c => c.id === bgCat)) bgCat = cats[0].id;
  const cbar = $('#pBuiltCat');
  if (cbar){
    cbar.innerHTML = cats.map(c => `<button class="${c.id === bgCat ? 'on' : ''}" data-c="${esc(c.id)}">${esc(bgCatName(c))}</button>`).join('');
    $$('button', cbar).forEach(btn => btn.onclick = () => { bgCat = btn.dataset.c; fillBuiltins(); });
  }
  const list = cats.length ? all.filter(b => catOf(b) === bgCat) : all;
  box.scrollLeft = 0;
  box.innerHTML = list.map((b, i) => `<button class="bgcell" data-i="${i}" title="${esc(bgName(b))}">
      <img alt="" loading="lazy" src="${esc(b.t || b.f)}?v=${VERSION}" data-alt="${esc([b.f, 'bg/' + (b.t || b.f), 'bg/' + b.f].join('|'))}" onerror="bgThumbErr(this)">
      <span>${esc(bgName(b))}</span></button>`).join('');
  $$('.bgcell', box).forEach(btn => btn.onclick = async () => {
    const b = list[+btn.dataset.i]; if (!b) return;
    btn.classList.add('on'); toast(L3('載入圖片中…','载入图片中…','Loading…'), 4000);
    try{
      const im = await bgImgLoad(b.f);
      if (!photoMode) photoMode = 'full';
      setPhoto(im, '');
      await studioRefresh();
    }catch(e){ btn.classList.remove('on'); toast(L3('這張圖還沒上傳到網站：','这张图还没上传到网站：','This picture is not uploaded yet: ') + b.f, 6000); }
  });
}
/* 縮圖沒上傳就改用大圖，再找 bg/ 資料夾；都沒有才把這格拿掉 */
function bgThumbErr(img){
  const alt = (img.dataset.alt || '').split('|').filter(Boolean);
  if (!alt.length){ const c = img.closest('.bgcell'); if (c) c.remove(); return; }
  img.dataset.alt = alt.slice(1).join('|');
  img.src = alt[0] + '?v=' + VERSION;
}
window.bgThumbErr = bgThumbErr;
function bgCss(){
  if ($('#bgcss')) return;
  const st = document.createElement('style'); st.id = 'bgcss';
  st.textContent = '.bgstrip{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 8px;-webkit-overflow-scrolling:touch}'
    + '.bgcell{flex:0 0 auto;width:64px;border:2px solid transparent;border-radius:10px;padding:0;background:none;cursor:pointer;text-align:center}'
    + '.bgcell img{display:block;width:60px;height:96px;object-fit:cover;border-radius:8px}'
    + '.bgcell span{display:block;font-size:10.5px;line-height:1.3;margin-top:3px;color:var(--muted,#6b6455);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.bgcell.on{border-color:#A9762F}'
    + '.bgcats{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 6px}'
    + '.bgcats button{border:1px solid var(--border-strong,#cdbfa0);background:var(--surface,#fff);color:var(--ink,#2a2118);border-radius:999px;padding:5px 13px;font-size:12.5px;font-weight:600;cursor:pointer}'
    + '.bgcats button.on{background:#A9762F;border-color:#A9762F;color:#fff}';
  document.head.appendChild(st);
}
function pickPhoto(inp){
  const f = inp && inp.files && inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => { if (!photoMode) photoMode = 'full'; setPhoto(im, ''); plSave(im, ''); studioRefresh(); };
    im.onerror = () => toast(t().photoBad);
    im.src = rd.result;
  };
  rd.onerror = () => toast(t().photoBad);
  rd.readAsDataURL(f);
}
/* 依相片本身的長寬比，自動挑貼紙的形狀（直／橫／方），不必每次手動調 */
function autoStkShape(){
  if (!photoImg) return;
  const r = photoImg.width / photoImg.height;
  stkShape = r > 1.25 ? 'w' : (r < 0.85 ? 'p' : 's');
  if (stkShape === 'w' && stkSize < .38) stkSize = .46;
}
function coverDraw(ctx, img, x, y, w, h){
  const ir = img.width / img.height, r = w / h;
  let sw, sh, sx, sy;
  if (ir > r){ sh = img.height; sw = sh * r; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / r; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/* ---- 背景音樂 ---- */
let bgmBlob = null, bgmName = '', bgmVol = 0.22, mcLen = 30;
/* v2.17.1：選好的配樂可以先試聽（共用詩歌庫那個唯一的 <audio>，iPhone 才放得出聲） */
let bgmPrevOn = false, bgmPrevURL = null;
function bgmPrevStop(){
  bgmPrevOn = false;
  try{ if (hymnEl){ hymnEl.pause(); hymnEl.onended = null; } }catch(e){}
  try{ if (bgmPrevURL) URL.revokeObjectURL(bgmPrevURL); }catch(e){}
  bgmPrevURL = null;
  const b = $('#bPrev'); if (b) b.textContent = L3('▶ 試聽','▶ 试听','▶ Preview');
}
function bgmPrevToggle(){
  if (bgmPrevOn || !bgmBlob){ bgmPrevStop(); return; }
  hymnStopPrev();
  const a = hymnAudio();
  bgmPrevURL = URL.createObjectURL(bgmBlob);
  a.src = bgmPrevURL; a.volume = 1;
  a.onended = bgmPrevStop;
  bgmPrevOn = true;
  const b = $('#bPrev'); if (b) b.textContent = L3('⏸ 停止試聽','⏸ 停止试听','⏸ Stop preview');
  const q = a.play();                       /* 手勢裡同步呼叫 */
  if (q && q.catch) q.catch(bgmPrevStop);
}
const MC_LENS = [[15,['15 秒','15 秒','15 sec']],[30,['30 秒','30 秒','30 sec']],[60,['1 分鐘','1 分钟','1 min']],[0,['整首','整首','Whole track']]];
const BGM_VOLS = [[0.12,['小聲','小声']],[0.22,['適中','适中']],[0.38,['明顯','明显']]];
const AUD_EXT = /\.(mp3|m4a|aac|wav|aif|aiff|caf|flac|ogg|opus|mp4|mov|webm|wma)$/i;
function pickBgm(inp){
  const f = inp && inp.files && inp.files[0]; if (!f) return;
  const ok = (f.type && (f.type.indexOf('audio') === 0 || f.type.indexOf('video') === 0)) || AUD_EXT.test(f.name || '');
  if (!ok){ toast(t().bgmBad); return; }
  if (f.size > 25 * 1024 * 1024){ toast(t().bgmBig); return; }
  bgmBlob = f; bgmName = f.name || '背景音樂'; bgmCredit = ''; studioRefresh(); toast(t().bgmAdded);
}

const DEF_TOP  = () => L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Online Fellowship');
const DEF_TO = () => L3('親愛的家人：平安！', '亲爱的家人：平安！', 'Dear family, peace be with you!');
const cardToVal = () => { const v = (state.cardTo || '').trim(); return (v === '親愛的家人：平安！' || v === '亲爱的家人：平安！' || v === 'Dear family, peace be with you!') ? DEF_TO() : v; };
const DEF_SIGN = () => L3('願上帝賜福你！', '愿上帝赐福你！', 'God bless you!');
/* 詩篇用「篇」／Psalm，其餘用「章」／Chapter */
function chapLabel(bookId, n){
  if (bookId === 'Psalms') return isID() ? `Mazmur ${n}` : isJA() ? `第${n}篇` : isKO() ? `${n}편` : isEN() ? `Psalm ${n}` : L3(`第 ${n} 篇`, `第 ${n} 篇`, '');
  return t().chapter(n);
}
function cardRef(h){
  if (h && !h.b && h.ref != null) return String(h.ref);   /* 從團契 App 等傳進來的金句：直接用它自己的出處 */
  const b = BOOK[h.b];
  const nm = b ? bname(b) : h.b;
  const vv = (h.v2 && h.v2 > h.v) ? `${h.v}-${h.v2}` : h.v;   // 畫線跨節就寫成 3:16-17
  return h.v ? `${nm} ${h.ch}:${vv}` : (h.b === 'Psalms' ? chapLabel(h.b, h.ch) : `${nm} ${t().chapter(h.ch)}`);
}
function rr(ctx, x, y, w, h, r){
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);         ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
/* 中文避頭尾：標點不落在行首，開引號不落在行尾 */
const NO_START = '，。、；：？！）」』】》〉·…—％‰';
const NO_END   = '（「『【《〈';
function wrapTextEN(ctx, text, maxW){
  const out = [];
  (text || '').split('\n').forEach(par => {
    if (!par){ out.push(''); return; }
    let line = '';
    par.split(/\s+/).forEach(w => {
      if (!w) return;
      const probe = line ? line + ' ' + w : w;
      if (ctx.measureText(probe).width > maxW && line){ out.push(line); line = w; }
      else line = probe;
    });
    if (line) out.push(line);
  });
  return out;
}
function wrapText(ctx, text, maxW){
  if (isEN()) return wrapTextEN(ctx, text, maxW);
  const out = [];
  (text || '').split('\n').forEach(par => {
    if (!par){ out.push(''); return; }
    let line = '';
    for (const ch of par){
      if (ctx.measureText(line + ch).width > maxW && line){
        if (NO_START.indexOf(ch) >= 0){ line += ch; continue; }   // 標點吊在行尾
        let carry = '';
        while (line.length > 1 && NO_END.indexOf(line[line.length - 1]) >= 0){
          carry = line[line.length - 1] + carry; line = line.slice(0, -1);   // 開引號帶到下一行
        }
        out.push(line); line = carry + ch;
      } else line += ch;
    }
    out.push(line);
  });
  return out;
}
/* ---- 邊框 ---- */
function drawCardBorder(ctx, W, H, pad, F, T){
  const B = cardBorder(); if (B === 'none') return;
  const line = T.frame, line2 = T.frame.replace(/[\d.]+\)$/, '0.55)'), gold = T.gold;
  const m = pad * .5, x = m, y = m, w = W - m * 2, h = H - m * 2, R = Math.round(18 * F);
  if (B === 'classic'){
    ctx.strokeStyle = line; ctx.lineWidth = Math.max(2, W * .0022); rr(ctx, x, y, w, h, R); ctx.stroke();
    ctx.strokeStyle = line2; ctx.lineWidth = Math.max(1, W * .0009);
    rr(ctx, x + 9 * F, y + 9 * F, w - 18 * F, h - 18 * F, Math.round(12 * F)); ctx.stroke();
    ctx.fillStyle = gold;
    [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx, cy]) => {
      ctx.beginPath(); ctx.arc(cx, cy, Math.round(5 * F), 0, 7); ctx.fill(); });
  } else if (B === 'corner'){
    ctx.strokeStyle = gold; ctx.lineWidth = Math.max(2, W * .003); ctx.lineCap = 'round';
    const L = Math.round(56 * F);
    const seg = (cx, cy, dx, dy) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * L, cy);
      ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + dy * L); ctx.stroke(); };
    seg(x, y, 1, 1); seg(x + w, y, -1, 1); seg(x, y + h, 1, -1); seg(x + w, y + h, -1, -1);
    ctx.lineCap = 'butt';
  } else if (B === 'inline'){
    ctx.strokeStyle = line2; ctx.lineWidth = Math.max(1, W * .0013);
    rr(ctx, x + 6 * F, y + 6 * F, w - 12 * F, h - 12 * F, Math.round(14 * F)); ctx.stroke();
  } else if (B === 'dots'){
    ctx.fillStyle = line2;
    const r0 = Math.max(2, W * .0026), gap = Math.round(26 * F);
    const ex = x + 6 * F, ey = y + 6 * F, ew = w - 12 * F, eh = h - 12 * F;
    const dot = (px, py) => { ctx.beginPath(); ctx.arc(px, py, r0, 0, 7); ctx.fill(); };
    for (let px = ex; px <= ex + ew; px += gap){ dot(px, ey); dot(px, ey + eh); }
    for (let py = ey; py <= ey + eh; py += gap){ dot(ex, py); dot(ex + ew, py); }
  } else if (B === 'ornate'){
    ctx.strokeStyle = line; ctx.lineWidth = Math.max(2, W * .0022); rr(ctx, x, y, w, h, R); ctx.stroke();
    ctx.strokeStyle = gold; ctx.lineWidth = Math.max(1.5, W * .0016); ctx.lineCap = 'round';
    const L = Math.round(34 * F), o = Math.round(16 * F);
    const flo = (cx, cy, dx, dy) => {
      ctx.beginPath(); ctx.moveTo(cx + dx * o, cy + dy * o); ctx.lineTo(cx + dx * (o + L), cy + dy * o);
      ctx.moveTo(cx + dx * o, cy + dy * o); ctx.lineTo(cx + dx * o, cy + dy * (o + L)); ctx.stroke();
      ctx.fillStyle = gold; ctx.beginPath(); ctx.arc(cx + dx * o, cy + dy * o, Math.round(4.5 * F), 0, 7); ctx.fill(); };
    flo(x, y, 1, 1); flo(x + w, y, -1, 1); flo(x, y + h, 1, -1); flo(x + w, y + h, -1, -1);
    ctx.lineCap = 'butt';
  }
}
/* ---- 自拍圓框（錄影時合成到右下角）---- */
function drawSelfieCircle(cx, vid, W, H, F){
  if (!vid || !vid.videoWidth) return;
  const pad = Math.round(Math.min(W, H) * .085), R = Math.round(Math.min(W, H) * 0.115);
  const cxx = W - pad - R + 4 * F, cyy = H - pad - R + 4 * F;
  cx.save();
  cx.shadowColor = 'rgba(0,0,0,.28)'; cx.shadowBlur = Math.round(22 * F); cx.shadowOffsetY = Math.round(8 * F);
  cx.beginPath(); cx.arc(cxx, cyy, R, 0, 7); cx.fillStyle = '#000'; cx.fill();
  cx.restore();
  cx.save(); cx.beginPath(); cx.arc(cxx, cyy, R, 0, 7); cx.clip();
  const vw = vid.videoWidth, vh = vid.videoHeight, side = Math.min(vw, vh);
  cx.translate(cxx, cyy); cx.scale(-1, 1);
  const sx = (vw - side) / 2, sy = (vh - side) / 2;
  if (state.beauty) drawBeautyFace(cx, vid, sx, sy, side, R);
  else cx.drawImage(vid, sx, sy, side, side, -R, -R, R * 2, R * 2);
  cx.restore();
  cx.beginPath(); cx.arc(cxx, cyy, R, 0, 7);
  cx.lineWidth = Math.max(3, W * .006); cx.strokeStyle = '#F4EFE3'; cx.stroke();
  cx.beginPath(); cx.arc(cxx, cyy, R + 4 * F, 0, 7);
  cx.lineWidth = Math.max(2, W * .003); cx.strokeStyle = 'rgba(212,166,91,.85)'; cx.stroke();
}
/* 美顏：純 Canvas 2D 做的簡易柔膚效果，不需要臉部辨識或 WebGL，手機瀏覽器
   （包含 iOS PWA）都支援。原理是攝影棚常用的「柔焦」手法：
   1) 底層先正常畫一次，順便把亮度/飽和度/對比稍微調得討喜一點；
   2) 上面疊一層「模糊＋提亮」的同一張畫面，用 soft-light 疊加模式蓋上去——
      模糊會抹掉毛孔、細紋這些高頻雜訊，soft-light 疊加不會整個糊掉（保留
      眼睛、眉毛、髮際線這些輪廓的對比），效果類似手機相機的「柔膚」檔位。
   圓形自拍區塊本來就不大，模糊半徑抓得小、只在這個小範圍內運算，
   即時錄影（24fps）也不會卡。 */
function drawBeautyFace(cx, vid, sx, sy, side, R){
  cx.filter = 'brightness(1.06) saturate(1.08) contrast(0.97)';
  cx.drawImage(vid, sx, sy, side, side, -R, -R, R * 2, R * 2);
  cx.filter = 'none';
  cx.save();
  cx.globalAlpha = 0.55;
  cx.globalCompositeOperation = 'soft-light';
  cx.filter = `blur(${Math.max(2, Math.round(R * 0.06))}px) brightness(1.08)`;
  cx.drawImage(vid, sx, sy, side, side, -R, -R, R * 2, R * 2);
  cx.restore();
  cx.filter = 'none';
}

/* 畫布上的字型也要分語言。Noto Serif TC／Sans TC 裡沒有簡體才有的字
   （创、虚、灵、运、开、诸、将、这、结、发、类、树…），canvas 會一個字一個字
   換字型頂替，頂到黑體，卡片上就變成一句話裡粗細不一。 */
const CARD_SERIF0 = () => isZS()
  ? '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",Georgia,serif'
  : (isJA() ? '"Noto Serif JP","Hiragino Mincho ProN","Yu Mincho","YuMincho","MS PMincho",serif' : isKO() ? '"Noto Serif KR","Nanum Myeongjo","AppleMyungjo","Batang",Georgia,serif' : isEN() ? 'Georgia,"Times New Roman",serif'
            : '"Noto Serif TC","Songti TC","STSong","PMingLiU",Georgia,serif');
const CARD_SANS0 = () => isZS()
  ? '"Noto Sans SC","PingFang SC","Microsoft YaHei","Heiti SC",sans-serif'
  : (isJA() ? '"Noto Sans JP","Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo",sans-serif' : isKO() ? '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif' : isEN() ? '-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'
            : '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif');

/* v2.19.3 卡片字體與文字顏色：state.cardFont（auto／mingti／hei／kai／yuan）、state.cardInk（空＝自動，或 #RRGGBB）。
   選了字體，整張卡片（稱呼、經文、內文、署名）都用同一種字體；字體有沒有要看手機裝了什麼，沒有的會退回預設。 */
const CARD_FONTS = [['auto',['自動','自动','Auto']],['mingti',['明體','明体','Serif']],['hei',['黑體','黑体','Sans']],['kai',['楷體','楷体','Script']],['yuan',['圓體','圆体','Rounded']]];
const CARD_INKS = [['',['自動','自动','Auto']],['#FFFFFF',['白','白','White']],['#1F1B16',['黑','黑','Black']],['#D4A65B',['金','金','Gold']],['#123F92',['深藍','深蓝','Navy']],['#6B4423',['咖啡','咖啡','Brown']],['#8A2D2D',['酒紅','酒红','Wine']],['#255943',['深綠','深绿','Green']],['#E8A0B4',['粉紅','粉红','Pink']]];
const cardFontKey = () => CARD_FONTS.some(x => x[0] === state.cardFont) ? state.cardFont : 'auto';
const cardInkVal = () => /^#[0-9a-fA-F]{6}$/.test(state.cardInk || '') ? state.cardInk : '';
/* 楷體、圓體：手機不一定有，所以 App 自帶字體（霞鶩文楷、粉圓，皆為開源字體，只含經文用字）；
   第一次選用時才下載，載完自動重畫卡片 */
const IBF = {};
function fontStatText(){
  const k = cardFontKey();
  if (isEP() || (k !== 'kai' && k !== 'yuan')) return '';
  const st = IBF[k === 'kai' ? 'IBKai' : 'IBYuan'];
  if (!st) return L3('字體準備中…','字体准备中…','Preparing font…');
  if (st === 'loading') return L3('⏳ 字體下載中（約 1–2 MB），請稍候…','⏳ 字体下载中（约 1–2 MB），请稍候…','⏳ Downloading font (1–2 MB)…');
  if (st === 'ok') return L3('✓ 字體已載入','✓ 字体已载入','✓ Font loaded');
  return L3('✗ 字體載入失敗（' + st + '）。請確認網路後，再按一次字體按鈕重試。','✗ 字体载入失败（' + st + '）。请确认网络后，再按一次字体按钮重试。','✗ Font failed to load (' + st + '). Check the network and tap the font button again.');
}
function fontStatShow(){ const el = $('#fontSt'); if (el) el.textContent = fontStatText(); }
function ensureIBFont(name, url){
  if (IBF[name]) return;
  if (!window.FontFace){ IBF[name] = 'no FontFace'; return; }
  IBF[name] = 'loading';
  try{
    const ff = new FontFace(name, 'url(' + url + ')');
    ff.load().then(f => {
      document.fonts.add(f); IBF[name] = 'ok';
      if (curTab() === 'studio' && !(mr && mr.state === 'recording')) studioRefresh();
    }).catch(e => { IBF[name] = String((e && e.message) || e || 'error').slice(0, 60); fontStatShow(); });
  }catch(e){ IBF[name] = String((e && e.message) || e).slice(0, 60); fontStatShow(); }
}
function cardFontStack(){
  const k = cardFontKey();
  if (!isEP() && k === 'kai') ensureIBFont('IBKai', 'fonts/kai2.woff');
  if (!isEP() && k === 'yuan') ensureIBFont('IBYuan', 'fonts/yuan2.woff');
  if (k === 'mingti') return CARD_SERIF0();
  if (k === 'hei') return CARD_SANS0();
  if (isJA() && k === 'kai') return '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
  if (isJA() && k === 'yuan') return '"Hiragino Maru Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif';
  if (k === 'kai') return isZS() ? '"IBKai","Kaiti SC","STKaiti","KaiTi","楷体",serif'
    : (isEN() ? '"Snell Roundhand","Apple Chancery","Brush Script MT",cursive' : '"IBKai","Kaiti TC","BiauKai","DFKai-SB","STKaiti","KaiTi",serif');
  if (k === 'yuan') return isZS() ? '"IBYuan","Yuanti SC","PingFang SC","Noto Sans SC",sans-serif'
    : (isEN() ? '"Avenir Next Rounded","Nunito","Trebuchet MS",sans-serif' : '"IBYuan","Yuanti TC","PingFang TC","Noto Sans TC",sans-serif');
  return '';
}
const CARD_SERIF = () => cardFontStack() || CARD_SERIF0();
const CARD_SANS = () => cardFontStack() || CARD_SANS0();
const cardInkT = T => { const c = cardInkVal(); return c ? Object.assign({}, T, { ink:c, accent:c, sub:c }) : T; };

/* 整張原圖當整張卡片：只有 稱呼／經文或問候語／署名 三樣，排在相片上方最空的地方 */
function drawFullCard(cv, h, W, H){
  const ctx = cv.getContext('2d'); cv.width = W; cv.height = H;
  ctx.drawImage(photoImg, 0, 0, W, H);
  const S = Math.min(W, H) / 1080, sans = CARD_SANS(), serif = CARD_SERIF();
  const toName = cardToVal();
  const sign = (state.cardSign || '').trim() || DEF_SIGN();
  let body, ref = '';
  if (fullKind === 'greet'){
    body = (state.cardGreet || '').trim() || L3('平安喜樂，主愛你！', '平安喜乐，主爱你！', 'Peace and joy to you, the Lord loves you!');
  } else {
    const raw = (h.t || '').replace(/〔[^〕]*〕/g, '').replace(/\[[^\]]*\]/g, '')
      .replace(/\s+/g, ' ').replace(/\s+([,.;:!?”’])/g, '$1').trim().replace(/[，、；：,;]+$/, '');
    body = isEN()
      ? ((/^[“"']/.test(raw) ? '' : '“') + raw + (/[”"']$/.test(raw) ? '' : '”'))
      : ((/^[「『]/.test(raw) ? '' : '「') + raw + (/[」』]$/.test(raw) ? '' : '」'));
    ref = cardRef(h);
  }
  const bless = (fullKind === 'verse' ? (fullBless || '') : '').trim();
  const mg = Math.round(W * .07);
  const tw = Math.min(W - mg * 2, Math.max(H * 1.05, W * .6));
  const roomMax = Math.min(H * .85, H * .46 * Math.max(1, fullScale || 1));
  const FS = fullScale || 1;   /* 使用者自己調的文字大小 */
  const ts = Math.round(44 * S * FS), ss = Math.round(26 * S * FS);
  /* 把相片縮小，算每一列的紋理（邊緣）多寡與亮度，用來找「最空」的一段 */
  let row = null, rl = null; const sh = Math.max(24, Math.round(96 * H / W));
  try{
    const sw = 96, sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
    const sx = sc.getContext('2d'); sx.drawImage(photoImg, 0, 0, sw, sh);
    const d = sx.getImageData(0, 0, sw, sh).data, g = new Float32Array(sw * sh);
    for (let i = 0; i < sw * sh; i++) g[i] = (d[i * 4] * .299 + d[i * 4 + 1] * .587 + d[i * 4 + 2] * .114);
    const x0 = Math.floor((W - tw) / 2 / W * sw), x1 = Math.ceil((W + tw) / 2 / W * sw);
    row = new Float32Array(sh); rl = new Float32Array(sh);
    for (let y = 0; y < sh; y++){
      let e = 0, l = 0, n = 0;
      for (let x = x0; x < x1 - 1; x++){
        e += Math.abs(g[y * sw + x + 1] - g[y * sw + x]) + (y + 1 < sh ? Math.abs(g[(y + 1) * sw + x] - g[y * sw + x]) : 0);
        l += g[y * sw + x]; n++;
      }
      row[y] = e / Math.max(1, n); rl[y] = l / Math.max(1, n) / 255;
    }
  }catch(e){ row = null; }
  /* 由大字試到小字：第一個「找得到夠空的位置」的字級就用它；都不夠空就用最空的那個 */
  let vs = Math.round(58 * S * FS), vl, rs, bs = 0, bl = [], total, ty = mg, lum = .3, pick = null;
  const vsMin = FS !== 1 ? vs : Math.round(22 * S);   /* 使用者指定大小就不再自動縮小 */
  while (true){
    ctx.font = `600 ${vs}px ${serif}`; vl = wrapText(ctx, body, tw);
    rs = Math.min(Math.round(30 * S * FS), Math.round(vs * .8));
    bs = Math.round(vs * .66); bl = [];
    if (bless){ ctx.font = `500 ${bs}px ${sans}`; bl = wrapText(ctx, bless, tw); }
    total = (toName ? ts * 1.9 : 0) + vl.length * vs * 1.5 + (ref ? rs * 2 : 0) + (bl.length ? bs * .9 + bl.length * bs * 1.55 : 0) + ss * 2.2;
    let bestE = 0, bty = mg, blum = .3;
    if (row){
      const hh = Math.max(1, Math.round(total / H * sh)), y0 = Math.round(mg / H * sh);
      const maxY = Math.max(y0, Math.min(sh - hh, Math.round(sh * .55)));
      bestE = 1e9;
      for (let y = y0; y <= maxY; y++){
        let e = 0, l = 0;
        for (let k = y; k < y + hh && k < sh; k++){ e += row[k]; l += rl[k]; }
        const sc2 = e / hh + (y / sh) * 8;
        if (sc2 < bestE){ bestE = sc2; bty = y / sh * H; blum = l / hh; }
      }
    }
    const fits = total <= roomMax;
    if (fits && (!pick || bestE < pick.e)) pick = { e:bestE, vs, vl, rs, bs, bl, total, ty:bty, lum:blum };
    if ((fits && bestE <= 2.2) || vs <= vsMin) break;
    vs -= Math.round(2 * S);
  }
  if (!pick) pick = { e:0, vs, vl, rs, bs, bl, total, ty:mg, lum:.3 };
  ({ vs, vl, rs, bs, bl, total, ty, lum } = pick);
  ty = Math.max(mg, Math.min(ty, H - mg - total));
  /* 手動移動：整塊文字一起動，限制在卡片之內 */
  const x1c = -(W - tw) / 2 + mg * .5, x2c = (W - tw) / 2 - mg * .5;
  origDX = Math.max(x1c / W, Math.min(x2c / W, origDX));
  origDY = Math.max(-(ty - mg) / H, Math.min((H - mg - (ty + total)) / H, origDY));
  const dark = lum > .55;
  let ink = dark ? '#2a2118' : '#ffffff', sub = dark ? 'rgba(42,33,24,.92)' : 'rgba(255,255,255,.95)';
  { const ci = cardInkVal(); if (ci){ ink = ci; sub = ci; } }
  /* 文字底下加很淡的柔光，亮字／暗字都看得清楚，又不遮住相片 */
  ctx.save(); ctx.translate(origDX * W, origDY * H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = dark ? 'rgba(255,255,255,.65)' : 'rgba(0,0,0,.55)'; ctx.shadowBlur = Math.round(10 * S);
  const cx = W / 2; let y = ty;
  if (toName){
    let t2 = ts; ctx.font = `600 ${t2}px ${serif}`;
    while (t2 > Math.round(22 * S) && ctx.measureText(toName).width > tw){ t2 -= 2; ctx.font = `600 ${t2}px ${serif}`; }
    ctx.fillStyle = ink; y += ts * 1.05; ctx.fillText(toName, cx, y); y += ts * .85;
  }
  ctx.fillStyle = ink; ctx.font = `600 ${vs}px ${serif}`;
  y += vs * .1;
  vl.forEach(l => { y += vs * 1.0; ctx.fillText(l, cx, y); y += vs * .5; });
  if (ref){ ctx.font = `${rs}px ${sans}`; ctx.fillStyle = sub; y += rs * .6; ctx.fillText(ref, cx, y); y += rs * 1.4; }
  if (bl.length){ ctx.font = `500 ${bs}px ${sans}`; ctx.fillStyle = sub; y += bs * .3; bl.forEach(l => { y += bs * 1.1; ctx.fillText(l, cx, y); y += bs * .45; }); y += bs * .2; }
  let s2 = ss; ctx.font = `600 ${s2}px ${sans}`;
  while (s2 > Math.round(14 * S) && ctx.measureText(sign).width > tw){ s2 -= 2; ctx.font = `600 ${s2}px ${sans}`; }
  ctx.fillStyle = sub; y += ss * 1.1; ctx.fillText(sign, cx, y);
  ctx.restore();
}
function drawVerseCard(cv, h, W, H){
  if (photoImg && photoMode === 'full') return drawFullCard(cv, h, W, H);
  const ctx = cv.getContext('2d'); cv.width = W; cv.height = H;
  const T = cardInkT(CARD_TPL[cardTpl()]);
  const S = Math.min(W, H), F = S / 1080, pad = Math.round(S * .085), iw = W - pad * 2;   /* 比例用短邊算，橫式字才不會被放大 */
  const wide = W > H * 1.2;
  let colW = wide ? Math.min(iw, Math.round(H * 1.5)) : iw;   /* 橫式文字欄不拉滿全寬 */
  const sans = CARD_SANS(), serif = CARD_SERIF();
  const FB = cardFs();          /* 內文字級——團體名稱、稱呼、經文、署名都跟著這個縮放 */
  /* 原圖模式：先切出「相片區」與「文字區」。橫的卡片左圖右字；直的／方的卡片上圖下字 */
  const orig = !!(photoImg && photoMode === 'orig');
  let TX = 0, TY = 0, TW = W, TH = H, TP = pad, pz = null;
  if (orig){
    /* 自動構圖：同時試「上圖下字」與「左圖右字」，挑相片顯示得比較大、又留得出文字空間的那一種；
       相片區貼著相片本身的比例，不留多餘空白 */
    const gp = Math.round(24 * F), fr = Math.round(9 * F), pa = photoImg.width / photoImg.height;
    const AW = iw, AH = H - pad * 2;
    const shapeCap = W / H > 1.2 ? .55 : (W / H > .9 ? .40 : .46);
    const zhS = Math.min(AH * Math.min(.66, shapeCap * origScale), (AW - fr * 2) / pa + fr * 2);
    const stack = { lay:'stack', pz:{ x:pad, y:pad, w:AW, h:Math.round(zhS) } };
    stack.TX = pad; stack.TY = pad + Math.round(zhS) + gp; stack.TW = AW; stack.TH = H - pad - stack.TY;
    stack.area = Math.min(AW - fr * 2, (zhS - fr * 2) * pa) * Math.min((AW - fr * 2) / pa, zhS - fr * 2);
    stack.ok = stack.TH >= AH * .52;
    const zwS = Math.min(AW * Math.min(.62, .5 * origScale), (AH - fr * 2) * pa + fr * 2);
    const side = { lay:'side', pz:{ x:pad, y:pad, w:Math.round(zwS), h:AH } };
    const gs = Math.round(44 * F);
    side.TX = pad + Math.round(zwS) + gs; side.TY = pad; side.TW = AW - Math.round(zwS) - gs; side.TH = AH;
    side.area = Math.min(zwS - fr * 2, (AH - fr * 2) * pa) * Math.min((zwS - fr * 2) / pa, AH - fr * 2);
    side.ok = side.TW >= AW * .38;
    let pickL;
    if (origLay === 'stack') pickL = stack; else if (origLay === 'side') pickL = side;
    else if (stack.ok && side.ok) pickL = stack.area >= side.area ? stack : side;
    else pickL = stack.ok ? stack : (side.ok ? side : (W >= H * 1.2 ? side : stack));
    pz = pickL.pz; TX = pickL.TX; TY = pickL.TY; TW = pickL.TW; TH = pickL.TH;
    TP = Math.round(W * .02);
  }
  /* 貼紙（可與背景並存）；橫式貼在角落且左右夠寬時，文字欄收窄讓開，不必整段往上擠 */
  const stkW = Math.round(S * stkSize);
  const stkSideInfo = { has: !!(stkImg && !suppressSticker && !orig), side: false };
  if (!orig){
    const sideIw = W - 2 * (pad + stkW + Math.round(28 * F));
    if (wide && stkSideInfo.has && stkPos !== 'bc' && sideIw >= W * .45){ stkSideInfo.side = true; colW = Math.min(colW, sideIw); }
    TW = colW + 2 * pad; TX = Math.round((W - TW) / 2);
  }
  const tiw = TW - TP * 2;

  /* 背景 */
  const g = ctx.createLinearGradient(0, 0, W * .3, H);
  g.addColorStop(0, T.bg[0]); g.addColorStop(.55, T.bg[1]); g.addColorStop(1, T.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  /* 相片當背景時鋪上半透明遮罩，字才看得清楚 */
  if (photoImg && !orig){
    coverDraw(ctx, photoImg, 0, 0, W, H);
    const hx = T.bg[1].replace('#', '');
    const R0 = parseInt(hx.slice(0, 2), 16), G0 = parseInt(hx.slice(2, 4), 16), B0 = parseInt(hx.slice(4, 6), 16);
    const sc = ctx.createLinearGradient(0, 0, 0, H);
    sc.addColorStop(0,  `rgba(${R0},${G0},${B0},0.46)`);
    sc.addColorStop(.5, `rgba(${R0},${G0},${B0},0.66)`);
    sc.addColorStop(1,  `rgba(${R0},${G0},${B0},0.56)`);
    ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H);
  }
  const rg = ctx.createRadialGradient(W * .84, H * .10, 10, W * .84, H * .10, W * .75);
  rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

  drawCardBorder(ctx, W, H, pad, F, T);

  /* 原圖：完整顯示、不裁切，置中放進相片區，外面一圈相紙白框 */
  if (orig){
    const fr = Math.round(9 * F);
    const sc = Math.min((pz.w - fr * 2) / photoImg.width, (pz.h - fr * 2) / photoImg.height);
    const dw = Math.round(photoImg.width * sc), dh = Math.round(photoImg.height * sc);
    const bx = Math.round(pz.x + (pz.w - dw - fr * 2) / 2), by = Math.round(pz.y + (pz.h - dh - fr * 2) / 2);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.26)'; ctx.shadowBlur = Math.round(22 * F); ctx.shadowOffsetY = Math.round(8 * F);
    rr(ctx, bx, by, dw + fr * 2, dh + fr * 2, Math.round(10 * F)); ctx.fillStyle = '#FDFBF6'; ctx.fill();
    ctx.restore();
    ctx.save(); rr(ctx, bx + fr, by + fr, dw, dh, Math.round(4 * F)); ctx.clip();
    ctx.drawImage(photoImg, bx + fr, by + fr, dw, dh); ctx.restore();
  }
  ctx.save(); ctx.translate(TX, TY);

  const FT = F;
  /* 團契名 */
  const grp = (state.cardTop || '').trim() || DEF_TOP();
  const grpSz = Math.round(27 * FT * FB), grpY = TP + Math.round(42 * FT);
  ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `600 ${grpSz}px ${sans}`;
  const gw = ctx.measureText(grp).width;
  ctx.fillText(grp, TW / 2, grpY);
  ctx.strokeStyle = T.frame.replace(/[\d.]+\)$/, '0.6)'); ctx.lineWidth = Math.max(1, 1.5 * FT);
  [[TW / 2 - gw / 2 - 28 * FT, -1], [TW / 2 + gw / 2 + 28 * FT, 1]].forEach(([x0, d]) => {
    ctx.beginPath(); ctx.moveTo(x0, grpY - 9 * FT); ctx.lineTo(x0 + d * 30 * FT, grpY - 9 * FT); ctx.stroke();
  });

  /* 稱呼（若有）畫在團契名底下、經文上面，像一封信的開頭——使用者要求改黑色 */
  const toName = cardToVal();
  if (toName){
    let ts2 = Math.round(40 * FT * FB);
    ctx.textAlign = 'center'; ctx.fillStyle = T.ink;
    while (ts2 > Math.round(22 * FT * FB)){
      ctx.font = `600 ${ts2}px ${serif}`;
      if (ctx.measureText(toName).width <= tiw) break;
      ts2 -= Math.round(2 * FT);
    }
    ctx.font = `600 ${ts2}px ${serif}`;
    ctx.fillText(toName, TW / 2, TP + Math.round(132 * FT));
  }

  /* 版位：經文＋領受垂直置中 */
  const hasSticker = stkSideInfo.has;
  const stkBottom = hasSticker && !stkSideInfo.side && stkPos !== 'tl' && stkPos !== 'tr';
  const liftRoom = stkBottom ? Math.round(stkW * stkRatio()) + Math.round(30 * FT) : 0;
  const topRoom = TP + Math.round((toName ? 176 : 100) * FT), botRoom = TP + Math.round(70 * FT) + liftRoom;
  const room = TH - topRoom - botRoom;
  /* 經文本身可能已經帶了引號（例如神說的話），不要再包一層 */
  /* 句子是在逗號處切開的，尾巴留著逗號放進引號裡很怪，去掉 */
  /* 譯者註不放進美圖——分享出去的是經文本身 */
  const raw = (h.t || '')
    .replace(/〔[^〕]*〕/g, '').replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ').replace(/\s+([,.;:!?”’])/g, '$1')
    .trim().replace(/[，、；：,;]+$/, '');
  const verse = isEN()
    ? ((/^[“"']/.test(raw) ? '' : '\u201c') + raw + (/[”"']$/.test(raw) ? '' : '\u201d'))
    : ((/^[「『]/.test(raw) ? '' : '「') + raw + (/[」』]$/.test(raw) ? '' : '」'));
  const note = (studioNote != null ? studioNote : (h.n || '')).trim();

  let vs = Math.round(58 * FT * FB), vl, fixed, ns, nl, total;   /* 經文也跟著字級放大 */
  const vsMin = Math.round((orig ? 20 : 28) * FT);
  while (true){
    while (true){
      ctx.font = `600 ${vs}px ${serif}`;
      vl = wrapText(ctx, verse, tiw - (orig ? Math.round(vs * .7) : 0));
      if (vl.length <= (isEN() ? 9 : 7) || vs <= vsMin) break;
      vs -= Math.round(3 * FT);
    }
    fixed = vs * .9 + vl.length * vs * 1.52 + Math.round(64 * FT) + (note ? Math.round(86 * FT) : 0);
    ns = Math.min(Math.round(38 * FT * FB), Math.round(vs * .82)); nl = [];   /* 領受字一定比經文小一點 */
    if (note){
      while (true){
        ctx.font = `${ns}px ${sans}`;
        nl = wrapText(ctx, note, tiw);
        if (fixed + nl.length * ns * 1.76 <= room || ns <= Math.round(21 * FT)) break;
        ns -= Math.round(2 * FT);
      }
    }
    total = fixed + (note ? nl.length * ns * 1.76 : 0);
    /* 原圖模式的文字區比較小：整塊放不下就把經文再縮一點，直到放得下 */
    if (!orig || total <= room || vs <= vsMin) break;
    vs -= Math.round(3 * FT);
  }
  /* 縮到最小還放不下：只留放得下的行，最後一行加「…」，絕不壓到署名 */
  if (note && total > room + 1){
    const fit = Math.max(1, Math.floor((room - fixed) / (ns * 1.76)));
    if (nl.length > fit){
      nl = nl.slice(0, fit); let last = nl[fit - 1]; ctx.font = `${ns}px ${sans}`;
      while (last.length > 1 && ctx.measureText(last + '…').width > tiw) last = last.slice(0, -1);
      nl[fit - 1] = last.replace(/[，。、；：,.;:\s]+$/, '') + '…';
      total = fixed + nl.length * ns * 1.76;
    }
  }
  let y = topRoom + Math.max(0, (room - total) / 2);

  /* 原圖模式：經文＋出處（vh）與領受（nh）可整塊一起拖，或分開拖；位置限制在整張卡片之內 */
  const vh = vs * .9 + vl.length * vs * 1.52 + Math.round(64 * FT), nh = total - vh;
  let vx = 0, vy = 0, nx = 0, ny = 0;
  if (orig){
    const mg = Math.round(12 * F);
    const clampMv = (dx, dy, top, hh) => {
      const x1 = -(TX + TP) + mg, x2 = W - (TX + TW - TP) - mg;
      const y1 = -(TY + top) + mg, y2 = H - (TY + top + hh) - mg;
      return [Math.max(x1 / W, Math.min(x2 / W, dx)), Math.max(y1 / H, Math.min(y2 / H, dy))];
    };
    if (origSplit && note){
      [origDX, origDY] = clampMv(origDX, origDY, y, vh);
      [origNX, origNY] = clampMv(origNX, origNY, y + vh, nh);
      nx = origNX * W; ny = origNY * H;
    } else {
      [origDX, origDY] = clampMv(origDX, origDY, y, total);
      origNX = origDX; origNY = origDY; nx = origDX * W; ny = origDY * H;
    }
    vx = origDX * W; vy = origDY * H;
  }
  /* 經文 */
  ctx.save(); ctx.translate(vx, vy);
  ctx.fillStyle = T.accent; ctx.font = `600 ${vs}px ${serif}`;
  y += vs * .9;
  vl.forEach(l => { ctx.fillText(l, TW / 2, y); y += vs * 1.52; });

  /* 出處——使用者要求跟經文同色，不再用金色 */
  ctx.font = `${Math.min(Math.round(30 * FT), Math.round(vs * .85))}px ${sans}`; ctx.fillStyle = T.accent;
  ctx.fillText(cardRef(h), TW / 2, y); y += Math.round(64 * FT);
  ctx.restore();

  /* 領受 */
  if (note){
    ctx.save(); ctx.translate(nx, ny);
    ctx.fillStyle = T.gold;
    ctx.beginPath(); ctx.arc(TW / 2, y, Math.round(5 * FT), 0, 7); ctx.fill();
    ctx.strokeStyle = T.gold; ctx.lineWidth = 2.5 * FT;
    ctx.beginPath(); ctx.moveTo(TW / 2 - 52 * FT, y); ctx.lineTo(TW / 2 - 16 * FT, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(TW / 2 + 16 * FT, y); ctx.lineTo(TW / 2 + 52 * FT, y); ctx.stroke();
    y += Math.round(86 * FT);
    ctx.textAlign = 'left'; ctx.fillStyle = T.ink; ctx.font = `${ns}px ${sans}`;
    nl.forEach(l => { ctx.fillText(l, TP, y); y += ns * 1.76; });
    ctx.textAlign = 'center';
    ctx.restore();
  }

  /* 落款（貼紙或自拍佔住底部時往上讓開） */
  const lift = stkBottom ? Math.round(stkW * stkRatio()) + Math.round(16 * FT) : 0;
  ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `600 ${Math.round(25 * FT * FB)}px ${sans}`;
  const sign = (state.cardSign || '').trim()
            || DEF_SIGN();
  let ss = Math.round(25 * FT * FB);
  while (ss > Math.round(15 * FT * FB)){ ctx.font = `600 ${ss}px ${sans}`; if (ctx.measureText(sign).width <= tiw) break; ss -= 2; }
  ctx.fillText(sign, TW / 2, TH - TP * .72 - Math.round(24 * FT) - lift);
  ctx.restore();   /* 結束文字區的座標平移 */

  /* 相片貼紙（拍立得風格） */
  if (hasSticker){
    const sw = stkW, sh = Math.round(sw * stkRatio());
    const top = stkPos === 'tl' || stkPos === 'tr';
    const bx = (stkPos === 'bl' || stkPos === 'tl') ? pad - 4 * F
             : (stkPos === 'bc') ? Math.round((W - sw) / 2)
             : W - pad - sw + 4 * F;
    const by = top ? pad + Math.round(70 * F) : H - pad - sh + 4 * F;
    ctx.save();
    ctx.translate(bx + sw / 2, by + sh / 2);
    ctx.rotate((stkShape === 'w' ? -1.4 : -3) * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,.30)'; ctx.shadowBlur = Math.round(24 * F); ctx.shadowOffsetY = Math.round(9 * F);
    const fr = Math.round(10 * F), pb = (stkShape === 'p') ? Math.round(26 * F) : fr;
    rr(ctx, -sw / 2, -sh / 2, sw, sh, Math.round(10 * F)); ctx.fillStyle = '#FDFBF6'; ctx.fill();
    ctx.shadowColor = 'transparent';
    const iw2 = sw - fr * 2, ih2 = sh - fr - pb;
    ctx.save(); rr(ctx, -sw / 2 + fr, -sh / 2 + fr, iw2, ih2, Math.round(4 * F)); ctx.clip();
    coverDraw(ctx, stkImg, -sw / 2 + fr, -sh / 2 + fr, iw2, ih2); ctx.restore();
    ctx.restore();
  }
}
function cardBlob(url){
  const b = atob(url.split(',')[1]), a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return new Blob([a], { type:'image/png' });
}
/* 卡片尺寸：「整張原圖」模式下，卡片就是相片本身的比例；其他模式照所選尺寸 */
function cardDims(){
  if (photoImg && photoMode === 'full'){
    const pw = photoImg.width, ph = photoImg.height;
    const long = Math.max(1080, Math.min(1920, Math.max(pw, ph))), k = long / Math.max(pw, ph);
    return [Math.round(pw * k / 2) * 2, Math.round(ph * k / 2) * 2];
  }
  return CARD_SIZES[cardSize()];
}
function renderCard(h){
  const [W, H] = cardDims();
  const cv = document.createElement('canvas');
  drawVerseCard(cv, h, W, H);
  cardImg = cv.toDataURL('image/png');
  const box = $('#cardPv');
  if (box) box.innerHTML = `<img src="${cardImg}" alt="">`;
}
const o3 = (zh, zs, en) => { const x = L3(zh, zs, en); return [x, x]; };
/* 拖動文字時用半尺寸、JPEG 快速重畫預覽；放開手指再畫一張完整的 */
let dragRaf = 0;
function renderCardFast(){
  if (dragRaf) return;
  dragRaf = requestAnimationFrame(() => {
    dragRaf = 0;
    const [W, H] = cardDims();
    const cv = document.createElement('canvas');
    drawVerseCard(cv, studioItem, Math.round(W / 2), Math.round(H / 2));
    const img = $('#cardPv img'); if (img) img.src = cv.toDataURL('image/jpeg', .8);
  });
}
/* 依「整塊／分開」與目前選的對象，決定位移要加到哪一組座標 */
function origShift(dx, dy){
  if (origSplit && origTarget === 'n' && photoMode !== 'full'){ origNX += dx; origNY += dy; }
  else { origDX += dx; origDY += dy; if (!origSplit){ origNX = origDX; origNY = origDY; } }
}
function attachOrigDrag(){
  const box = $('#cardPv'); if (!box) return;
  const on = !!(photoImg && (photoMode === 'orig' || photoMode === 'full') && origMove);
  box.style.touchAction = on ? 'none' : '';
  box.style.outline = on ? '2px dashed var(--gold)' : '';
  if (!on){ box.onpointerdown = null; return; }
  let sx = 0, sy = 0, b0 = [0, 0, 0, 0], act = false;
  const pts = new Map(); let d0 = 0, s0 = 1;   /* 兩指縮放（整張原圖的文字大小） */
  const full = photoMode === 'full';
  const dist = () => { const a = [...pts.values()]; return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1; };
  box.onpointerdown = e => {
    const img = $('img', box); if (!img) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    try{ box.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
    if (full && pts.size === 2){ d0 = dist(); s0 = fullScale; act = false; return; }
    act = true; sx = e.clientX; sy = e.clientY; b0 = [origDX, origDY, origNX, origNY];
  };
  box.onpointermove = e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (full && pts.size >= 2){
      fullScale = Math.max(.5, Math.min(2.5, s0 * dist() / d0));
      const sl = $('#fSz'); if (sl) sl.value = Math.round(fullScale * 100);
      renderCardFast(); return;
    }
    if (!act) return;
    const img = $('img', box); if (!img) return;
    const r = img.getBoundingClientRect(), nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
    const k = Math.min(r.width / nw, r.height / nh), dw = nw * k, dh = nh * k;
    [origDX, origDY, origNX, origNY] = b0;
    origShift((e.clientX - sx) / dw, (e.clientY - sy) / dh);
    renderCardFast();
  };
  const end = e => {
    const was = pts.size; pts.delete(e.pointerId);
    if (was >= 2){ act = false; renderCard(studioItem); return; }
    if (!act) return; act = false; renderCard(studioItem);
  };
  box.onpointerup = end; box.onpointercancel = end;
}
/* iPhone／iPad 的 Safari 不能把檔案直接寫進「相簿」——<a download> 只會存到
   「檔案」App 的下載項目，使用者在相簿裡當然找不到。真正會進相簿的只有兩條路：
   分享面板裡的「儲存影像」，或長按圖片選「加入照片」。 */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
              || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* 退路：把圖放大給使用者長按 */
function openHoldSave(src){
  const L = t();
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card">
    <div class="hlsheet-title">${esc(L.holdT)}</div>
    <div class="hl-hint">${esc(L.holdS)}</div>
    <div class="holdpv"><img src="${src}" alt=""></div>
    <div class="hlsheet-acts" style="margin-top:12px">
      <button class="btn" id="hsClose">${esc(L.close)}</button>
    </div></div>`;
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  $('#hsClose', mask).onclick = () => mask.remove();
}
async function cardDownload(){
  if (!cardImg) return;
  const name = '321bible-' + Date.now() + '.png';
  if (isIOS()){
    const f = new File([cardBlob(cardImg)], name, { type:'image/png' });
    if (navigator.canShare && navigator.canShare({ files:[f] })){
      toast(t().saveIOS, 5000);
      try{ await navigator.share({ files:[f], title: t().app }); return; }
      catch(e){ if (e && e.name === 'AbortError') return; }
    }
    openHoldSave(cardImg); return;
  }
  const a = document.createElement('a');
  a.href = cardImg; a.download = name; a.click();
  toast(t().savedFile, 3200);
}
async function cardShare(){
  if (!cardImg) return;
  const f = new File([cardBlob(cardImg)], '321bible.png', { type:'image/png' });
  if (navigator.canShare && navigator.canShare({ files:[f] })){
    try{ await navigator.share({ files:[f], title: t().app }); return; }
    catch(e){ if (e && e.name === 'AbortError') return; }
  }
  cardDownload();
}
/* ================================================================ 影片修復
   iOS Safari 的 MediaRecorder 產出的是「分段 MP4」，而且把長度寫成 0，
   LINE、相簿與大多數 App 都讀不出來，看起來就像「無法分享」。
   下面整段是《321愛的關懷》驗證過的重新封裝程式（moof/mdat → moov+mdat）。 */

function mx_u32(b,p){return b[p]*16777216+b[p+1]*65536+b[p+2]*256+b[p+3];}
function mx_i32(b,p){const v=mx_u32(b,p);return v>=2147483648?v-4294967296:v;}
function mx_u64(b,p){return mx_u32(b,p)*4294967296+mx_u32(b,p+4);}
function mx_typ(b,p){return String.fromCharCode(b[p],b[p+1],b[p+2],b[p+3]);}

function mx_boxes(b,start,end){
  const out=[];let p=start;
  while(p+8<=end){
    let size=mx_u32(b,p),hs=8;
    if(size===1){size=mx_u64(b,p+8);hs=16;}
    else if(size===0)size=end-p;
    if(size<8||p+size>end)break;
    out.push({type:mx_typ(b,p+4),start:p,size:size,hs:hs,body:p+hs,end:p+size});
    p+=size;
  }
  return out;
}
function mx_find(list,t){return list.filter(x=>x.type===t);}
function mx_one(list,t){const r=mx_find(list,t);return r.length?r[0]:null;}
function mx_children(b,mx_box){return mx_boxes(b,mx_box.body,mx_box.end);}

function mx_parseTrun(b,tr,tfhd,baseOffset){
  const flags=mx_u32(b,tr.body)&0xffffff;
  const cnt=mx_u32(b,tr.body+4);
  let p=tr.body+8;
  let dataOff=0;
  if(flags&0x1){dataOff=mx_i32(b,p);p+=4;}
  let firstFlags=null;
  if(flags&0x4){firstFlags=mx_u32(b,p);p+=4;}
  const samples=[];
  let off=baseOffset+dataOff;
  for(let i=0;i<cnt;i++){
    let dur=tfhd.defDur, size=tfhd.defSize, fl=tfhd.defFlags, cto=0;
    if(flags&0x100){dur=mx_u32(b,p);p+=4;}
    if(flags&0x200){size=mx_u32(b,p);p+=4;}
    if(flags&0x400){fl=mx_u32(b,p);p+=4;}
    if(flags&0x800){cto=mx_i32(b,p);p+=4;}
    if(i===0&&firstFlags!==null)fl=firstFlags;
    samples.push({off:off,size:size,dur:dur,cto:cto,sync:!(fl&0x10000)});
    off+=size;
  }
  return {samples:samples,dataOff:dataOff};
}

function mx_parseTfhd(b,mx_box){
  const flags=mx_u32(b,mx_box.body)&0xffffff;
  const trackId=mx_u32(b,mx_box.body+4);
  let p=mx_box.body+8;
  let base=null;
  if(flags&0x1){base=mx_u64(b,p);p+=8;}
  if(flags&0x2){p+=4;}
  let defDur=0,defSize=0,defFlags=0;
  if(flags&0x8){defDur=mx_u32(b,p);p+=4;}
  if(flags&0x10){defSize=mx_u32(b,p);p+=4;}
  if(flags&0x20){defFlags=mx_u32(b,p);p+=4;}
  return {trackId:trackId,base:base,defDur:defDur,defSize:defSize,defFlags:defFlags,
          defaultBaseIsMoof:!!(flags&0x020000),hasBase:!!(flags&0x1)};
}

/* ---- 產生 mx_box ---- */
function mx_box(type,...parts){
  let len=8;parts.forEach(p=>len+=p.length);
  const head=new Uint8Array(8);
  head[0]=(len>>>24)&255;head[1]=(len>>>16)&255;head[2]=(len>>>8)&255;head[3]=len&255;
  for(let i=0;i<4;i++)head[4+i]=type.charCodeAt(i);
  const out=new Uint8Array(len);out.set(head,0);
  let p=8;parts.forEach(x=>{out.set(x,p);p+=x.length;});
  return out;
}
function mx_b32(v){return new Uint8Array([(v>>>24)&255,(v>>>16)&255,(v>>>8)&255,v&255]);}
function mx_b64(v){const hi=Math.floor(v/4294967296),lo=v>>>0;
  return new Uint8Array([(hi>>>24)&255,(hi>>>16)&255,(hi>>>8)&255,hi&255,
                         (lo>>>24)&255,(lo>>>16)&255,(lo>>>8)&255,lo&255]);}
function mx_cat(arr){let n=0;arr.forEach(a=>n+=a.length);const o=new Uint8Array(n);let p=0;
  arr.forEach(a=>{o.set(a,p);p+=a.length;});return o;}

function mx_remux(bytes){
  const b=bytes;
  const top=mx_boxes(b,0,b.length);
  const ftyp=mx_one(top,"ftyp");
  const moov=mx_one(top,"moov");
  if(!moov)throw new Error("no moov");
  const moofs=mx_find(top,"moof");
  if(!moofs.length)return null;              /* 不是分段 MP4，不用處理 */

  const mvBoxes=mx_children(b,moov);
  const mvhd=mx_one(mvBoxes,"mvhd");
  const mvTimescale=mx_u32(b,mvhd.body+(b[mvhd.body]===1?20:12));
  const traks=mx_find(mvBoxes,"trak");

  /* 收集每個 track 的所有 sample */
  const tracks={};
  traks.forEach(tk=>{
    const tkhd=mx_one(mx_children(b,tk),"tkhd");
    const v=b[tkhd.body];
    const id=mx_u32(b,tkhd.body+(v===1?20:12));
    tracks[id]={trak:tk,samples:[]};
  });

  moofs.forEach(mf=>{
    const trafs=mx_find(mx_children(b,mf),"traf");
    trafs.forEach(tf=>{
      const tfc=mx_children(b,tf);
      const tfhdBox=mx_one(tfc,"tfhd");
      if(!tfhdBox)return;
      const tfhd=mx_parseTfhd(b,tfhdBox);
      const t=tracks[tfhd.trackId];
      if(!t)return;
      /* 基準位移：預設是 moof 起點（default-base-is-moof） */
      const base=tfhd.hasBase?tfhd.base:mf.start;
      let running=null;
      mx_find(tfc,"trun").forEach(tr=>{
        const flags=mx_u32(b,tr.body)&0xffffff;
        const hasOff=!!(flags&0x1);
        const r=mx_parseTrun(b,tr,tfhd,hasOff?base:(running===null?base:running));
        r.samples.forEach(s=>t.samples.push(s));
        if(r.samples.length){
          const last=r.samples[r.samples.length-1];
          running=last.off+last.size;
        }
      });
    });
  });

  /* 依序把 sample 資料集中成一個 mdat */
  const order=[];
  Object.keys(tracks).forEach(id=>{
    tracks[id].samples.forEach((s,i)=>order.push({id:+id,i:i,off:s.off,size:s.size}));
  });
  order.sort((a,b2)=>a.off-b2.off);
  let mdatSize=0;order.forEach(o=>mdatSize+=o.size);

  const newOff={};
  let cur=0;
  order.forEach(o=>{
    if(!newOff[o.id])newOff[o.id]=[];
    newOff[o.id][o.i]=cur;cur+=o.size;
  });

  /* ---- 為每個 track 重建 stbl ---- */
  function buildStbl(id,stblOld,mediaTimescale){
    const ss=tracks[id].samples;
    const offs=newOff[id]||[];
    const old=mx_children(b,stblOld);
    const keep=[];
    ["stsd"].forEach(t=>{const x=mx_one(old,t);if(x)keep.push(b.slice(x.start,x.end));});

    /* stts */
    const stts=[];
    let runDur=-1,runCnt=0;
    ss.forEach(s=>{
      if(s.dur===runDur){runCnt++;}
      else{if(runCnt)stts.push([runCnt,runDur]);runDur=s.dur;runCnt=1;}
    });
    if(runCnt)stts.push([runCnt,runDur]);
    const sttsBody=[mx_b32(0),mx_b32(stts.length)];
    stts.forEach(e=>{sttsBody.push(mx_b32(e[0]));sttsBody.push(mx_b32(e[1]));});
    keep.push(mx_box("stts",mx_cat(sttsBody)));

    /* ctts（若有 composition offset） */
    if(ss.some(s=>s.cto!==0)){
      const ctts=[];let rv=null,rc=0;
      ss.forEach(s=>{if(s.cto===rv){rc++;}else{if(rc)ctts.push([rc,rv]);rv=s.cto;rc=1;}});
      if(rc)ctts.push([rc,rv]);
      const body=[new Uint8Array([1,0,0,0]),mx_b32(ctts.length)];
      ctts.forEach(e=>{body.push(mx_b32(e[0]));body.push(mx_b32(e[1]>>>0));});
      keep.push(mx_box("ctts",mx_cat(body)));
    }

    /* stss（關鍵影格）*/
    const syncs=[];
    ss.forEach((s,i)=>{if(s.sync)syncs.push(i+1);});
    if(syncs.length&&syncs.length!==ss.length){
      const body=[mx_b32(0),mx_b32(syncs.length)];
      syncs.forEach(v=>body.push(mx_b32(v)));
      keep.push(mx_box("stss",mx_cat(body)));
    }

    /* stsc：每個 sample 自成一個 chunk，最單純也最不會出錯 */
    keep.push(mx_box("stsc",mx_cat([mx_b32(0),mx_b32(1),mx_b32(1),mx_b32(1),mx_b32(1)])));

    /* stsz */
    const szBody=[mx_b32(0),mx_b32(0),mx_b32(ss.length)];
    ss.forEach(s=>szBody.push(mx_b32(s.size)));
    keep.push(mx_box("stsz",mx_cat(szBody)));

    /* co64：用 64 位元，長度固定，才好兩段式計算位移 */
    const coBody=[mx_b32(0),mx_b32(ss.length)];
    ss.forEach((s,i)=>coBody.push(mx_b64(offs[i]||0)));
    keep.push({__co:true,data:mx_cat(coBody),count:ss.length});

    return keep;
  }

  /* 兩段式：先算出 moov 長度，再填入真正的 chunk 位移 */
  function assemble(mdatStart){
    const newTraks=[];
    traks.forEach(tk=>{
      const tkc=mx_children(b,tk);
      const tkhd=mx_one(tkc,"tkhd");
      const v=b[tkhd.body];
      const id=mx_u32(b,tkhd.body+(v===1?20:12));
      const mdia=mx_one(tkc,"mdia");
      const mdc=mx_children(b,mdia);
      const mdhd=mx_one(mdc,"mdhd");
      const mv=b[mdhd.body];
      const mts=mx_u32(b,mdhd.body+(mv===1?20:12));
      const ss=tracks[id].samples;
      let dur=0;ss.forEach(s=>dur+=s.dur);

      /* tkhd：填入 movie timescale 的時長 */
      const tkhdBuf=b.slice(tkhd.start,tkhd.end);
      const mvDur=Math.round(dur/mts*mvTimescale);
      if(v===1)writeU64(tkhdBuf,tkhd.body-tkhd.start+28,mvDur);
      else writeU32(tkhdBuf,tkhd.body-tkhd.start+20,mvDur);

      /* mdhd：填入 media timescale 的時長 */
      const mdhdBuf=b.slice(mdhd.start,mdhd.end);
      if(mv===1)writeU64(mdhdBuf,mdhd.body-mdhd.start+24,dur);
      else writeU32(mdhdBuf,mdhd.body-mdhd.start+16,dur);

      const minf=mx_one(mdc,"minf");
      const mic=mx_children(b,minf);
      const stbl=mx_one(mic,"stbl");
      const parts=buildStbl(id,stbl,mts);
      const stblParts=parts.map(x=>x.__co?mx_box("co64",x.data):x);
      const newStbl=mx_box("stbl",...stblParts);
      const minfParts=mic.map(x=>x.type==="stbl"?newStbl:b.slice(x.start,x.end));
      const newMinf=mx_box("minf",...minfParts);
      const mdiaParts=mdc.map(x=>x.type==="minf"?newMinf:(x.type==="mdhd"?mdhdBuf:b.slice(x.start,x.end)));
      const newMdia=mx_box("mdia",...mdiaParts);
      const trakParts=tkc.filter(x=>x.type!=="edts").map(x=>
        x.type==="mdia"?newMdia:(x.type==="tkhd"?tkhdBuf:b.slice(x.start,x.end)));
      newTraks.push(mx_box("trak",...trakParts));
    });

    /* mvhd：填入整體時長 */
    let maxDur=0;
    Object.keys(tracks).forEach(id=>{
      const tk=tracks[id];const trak=tk.trak;
      const mdhd=mx_one(mx_children(b,mx_one(mx_children(b,trak),"mdia")),"mdhd");
      const mv=b[mdhd.body];
      const mts=mx_u32(b,mdhd.body+(mv===1?20:12));
      let d=0;tk.samples.forEach(s=>d+=s.dur);
      maxDur=Math.max(maxDur,Math.round(d/mts*mvTimescale));
    });
    const mvhdBuf=b.slice(mvhd.start,mvhd.end);
    if(b[mvhd.body]===1)writeU64(mvhdBuf,mvhd.body-mvhd.start+24,maxDur);
    else writeU32(mvhdBuf,mvhd.body-mvhd.start+16,maxDur);

    return mx_box("moov",mvhdBuf,...newTraks);
  }

  function writeU32(buf,p,v){buf[p]=(v>>>24)&255;buf[p+1]=(v>>>16)&255;buf[p+2]=(v>>>8)&255;buf[p+3]=v&255;}
  function writeU64(buf,p,v){const hi=Math.floor(v/4294967296),lo=v>>>0;
    writeU32(buf,p,hi);writeU32(buf,p+4,lo);}

  const ftypBuf=ftyp?b.slice(ftyp.start,ftyp.end)
                    :mx_box("ftyp",mx_strBytes("isom"),mx_b32(512),mx_strBytes("isomiso2avc1mp41"));
  const pass1=assemble(0);
  const mdatStart=ftypBuf.length+pass1.length+16;   /* 16 = mdat 的 64 位元表頭 */
  Object.keys(newOff).forEach(id=>{
    newOff[id]=newOff[id].map(v=>v+mdatStart);
  });
  const moovNew=assemble(mdatStart);

  /* 組出 mdat（64 位元長度） */
  const mdatHead=new Uint8Array(16);
  mdatHead[3]=1;
  "mdat".split("").forEach((c,i)=>mdatHead[4+i]=c.charCodeAt(0));
  const total=mdatSize+16;
  const hi=Math.floor(total/4294967296),lo=total>>>0;
  writeU32(mdatHead,8,hi);writeU32(mdatHead,12,lo);

  const out=new Uint8Array(ftypBuf.length+moovNew.length+16+mdatSize);
  let p=0;
  out.set(ftypBuf,p);p+=ftypBuf.length;
  out.set(moovNew,p);p+=moovNew.length;
  out.set(mdatHead,p);p+=16;
  order.forEach(o=>{out.set(b.subarray(o.off,o.off+o.size),p);p+=o.size;});
  return out;
}
function mx_strBytes(s){const a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;}

/* 只處理分段 MP4；其他格式或失敗時原封不動回傳，不影響既有流程 */
async function fixVideoBlob(blob, mime){
  try{
    if (!blob || !/mp4/i.test(mime || blob.type || '')) return blob;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const out = mx_remux(buf);
    if (!out || !out.length) return blob;
    return new Blob([out], { type:'video/mp4' });
  }catch(e){ return blob; }
}




/* ================================================================ 作品庫（IndexedDB） */
let wdb = null;
function openWDB(){
  return new Promise(r => {
    try{
      const q = indexedDB.open('ib_works', 1);
      q.onupgradeneeded = e => { e.target.result.createObjectStore('rec', { keyPath:'id' }); };
      q.onsuccess = e => { wdb = e.target.result; r(wdb); };
      q.onerror = () => r(null);
    }catch(e){ r(null); }
  });
}
function wtx(mode){ return wdb.transaction('rec', mode).objectStore('rec'); }
function putRec(o){ return new Promise(r => { const q = wtx('readwrite').put(o); q.onsuccess = () => r(1); q.onerror = () => r(0); }); }
function allRec(){ return new Promise(r => { if (!wdb) return r([]); const q = wtx('readonly').getAll(); q.onsuccess = () => r(q.result || []); q.onerror = () => r([]); }); }
function delRec(id){ return new Promise(r => { const q = wtx('readwrite').delete(id); q.onsuccess = () => r(1); q.onerror = () => r(0); }); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ================================================================ 錄製 */
let mr = null, chunks = [], recTimer = null, recSec = 0, recAnim = 0;
/* 錄製方式：'a' 只有聲音（純語音檔）｜'c' 卡片畫面（卡片＋聲音的影片）｜'s' 自拍畫面
   本來只有「只有聲音／自拍畫面」兩顆，但按「只有聲音」錄出來的還是影片，
   名實不符，按了像沒作用。現在分成三種，按哪一個就真的錄哪一種。 */
let recMode = 'c', selfieStream = null, __mcGain = null;
const isSelfie = () => recMode === 's';
const sup = m => { try{ return window.MediaRecorder && MediaRecorder.isTypeSupported(m); }catch(e){ return false; } };
const vidMime = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4',
  'video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(sup) || '';
const audMime = () => ['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(sup) || '';
const canVideo = () => !!(vidMime() && HTMLCanvasElement.prototype.captureStream);
const extOf = m => (m || '').indexOf('mp4') >= 0 ? (m.indexOf('video') === 0 ? '.mp4' : '.m4a')
                                                 : (m.indexOf('video') === 0 ? '.webm' : '.webm');

function attachSelfie(){
  const el = $('#selfiePrev');
  if (!el || !selfieStream) return;
  el.muted = true; el.defaultMuted = true; el.playsInline = true;
  ['playsinline','webkit-playsinline','muted','autoplay'].forEach(a => el.setAttribute(a, ''));
  if (el.srcObject !== selfieStream) el.srcObject = selfieStream;
  const go2 = () => { const q = el.play(); if (q && q.catch) q.catch(() => {}); };
  el.onloadedmetadata = go2; go2();
  [80, 300, 800, 1600].forEach(ms => setTimeout(go2, ms));
}
function stopSelfie(){
  try{ if (selfieStream) selfieStream.getTracks().forEach(tr => tr.stop()); }catch(e){}
  const el = $('#selfiePrev');
  if (el){ try{ el.pause(); }catch(e){} el.srcObject = null; }
  selfieStream = null;
}

/* 相機打不開：說清楚原因與辦法；內嵌瀏覽器（LINE、FB 等）常直接擋相機，給「用手機內建相機錄」的備案 */
const inAppBrowser = () => /Line\/|FBAN|FBAV|Instagram|MicroMessenger|Messenger|Telegram|MQQBrowser|Snapchat|TikTok|WhatsApp/i.test(navigator.userAgent || '');
function camFail(e){
  const n = (e && e.name) || '';
  const noAPI = !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  let why;
  let framed = false; try{ framed = window.top !== window.self; }catch(_){ framed = true; }
  if (framed) why = L3('目前是在團契 App 內嵌的視窗裡開的，系統不給內嵌視窗用相機。請按下面「用瀏覽器開啟並允許相機」，會用 Safari 開這個 App，並自動回到這節經文的自拍。',
    '目前是在团契 App 内嵌的窗口里开的，系统不给内嵌窗口用相机。请按下面“用浏览器打开并允许相机”，会用 Safari 开这个 App，并自动回到这节经文的自拍。',
    'This app is open inside an embedded view, where the system blocks the camera. Tap “Open in browser and allow the camera” below to continue in Safari.');
  else if (noAPI || inAppBrowser()) why = L3('這個畫面是在 LINE／內嵌瀏覽器裡開的，相機被擋住了。請點右上角「用瀏覽器開啟」（Safari／Chrome），或把 App 加到主畫面再開。',
    '这个画面是在 LINE／内嵌浏览器里开的，相机被挡住了。请点右上角“用浏览器打开”（Safari／Chrome），或把 App 加到主屏幕再开。',
    'This page is open inside an in-app browser (e.g. LINE) which blocks the camera. Tap “Open in browser” (Safari/Chrome) or add the app to your Home Screen.');
  else if (n === 'NotAllowedError' || n === 'SecurityError') why = L3('相機權限被拒絕。iPhone：設定 › Safari › 相機 選「允許」，或網址列左邊 AA › 網站設定 › 相機 › 允許，再回來按自拍。',
    '相机权限被拒绝。iPhone：设置 › Safari › 相机 选“允许”，或地址栏左边 AA › 网站设置 › 相机 › 允许，再回来按自拍。',
    'Camera permission was denied. On iPhone: Settings › Safari › Camera › Allow, then try Selfie again.');
  else if (n === 'NotReadableError' || n === 'AbortError') why = L3('相機正被其他 App 使用（例如視訊通話），請先關掉再試。','相机正被其他 App 使用（例如视频通话），请先关掉再试。','The camera is in use by another app. Close it and try again.');
  else if (n === 'NotFoundError' || n === 'OverconstrainedError') why = L3('找不到前鏡頭。','找不到前镜头。','No front camera found.');
  else why = L3('相機打不開（' + (n || '未知原因') + '）。','相机打不开（' + (n || '未知原因') + '）。','Could not open the camera (' + (n || 'unknown') + ').');
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card" style="max-height:90vh;overflow:auto">
    <div class="hlsheet-title">${esc(L3('📷 自拍相機打不開','📷 自拍相机打不开','📷 Camera unavailable'))}</div>
    <div style="font-size:14px;line-height:1.7;margin:6px 0 10px">${esc(why)}</div>
    <div class="muted" style="font-size:12.5px;line-height:1.6;margin-bottom:8px">${esc(L3('不想改設定也可以：用手機內建相機直接錄一段自拍影片，錄完會存進「我的作品」。','不想改设置也可以：用手机内建相机直接录一段自拍视频，录完会存进“我的作品”。','Or record a selfie video with the phone’s own camera — it is saved to My works.'))}</div>
    ${framed ? `<button class="btn primary block" id="camTop" style="margin-bottom:8px">${esc(L3('🔓 用瀏覽器開啟並允許相機','🔓 用浏览器打开并允许相机','🔓 Open in browser and allow the camera'))}</button>` : ''}
    <label class="btn ${framed ? '' : 'primary '}block" style="cursor:pointer">${esc(L3('📱 用手機內建相機錄自拍','📱 用手机内建相机录自拍','📱 Record with the phone camera'))}<input type="file" accept="video/*" capture="user" hidden id="camNative"></label>
    <div class="hlsheet-acts2" style="margin-top:10px"><button class="btn sm" id="camClose">${esc(t().close)}</button></div></div>`;
  document.body.appendChild(mask);
  mask.onclick = ev => { if (ev.target === mask) mask.remove(); };
  $('#camClose', mask).onclick = () => mask.remove();
  const ct = $('#camTop', mask);
  if (ct) ct.onclick = () => {
    try{ localStorage.setItem('ib_cam_resume', JSON.stringify({ ts:Date.now(), item:studioItem, note:studioNote })); }catch(_){}
    const u = location.origin + location.pathname + '?cam=1#/studio';
    let w = null; try{ w = window.open(u, '_blank'); }catch(_){}
    if (!w){ try{ window.top.location.href = u; }catch(_){ location.href = u; } }
    mask.remove();
  };
  $('#camNative', mask).onchange = async ev => {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    mask.remove();
    await saveWork(f, f.type || 'video/mp4', 'video', 0, studioItem);
  };
}
async function setRecMode(m){
  if (mr && mr.state === 'recording'){ toast(L3('錄製中不能換，先按「停止並完成」','录制中不能换，先按“停止并完成”','Stop the recording first'), 2400); return; }
  recMode = m;
  if (m !== 's'){ stopSelfie(); await studioRefresh(); toast(t()[m === 'a' ? 'recVoiceD' : 'recCardD'], 2200); return; }
  try{
    selfieStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false });
  }catch(e){ recMode = 'c'; camFail(e); }
  await studioRefresh();
  if (recMode === 's'){
    setTimeout(attachSelfie, 60); toast(t().recSelfieD, 2200);
    setTimeout(() => { const sw = $('#selfieWrap'); if (sw){ try{ sw.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(e){ sw.scrollIntoView(); } } }, 200);
  }
}
/* 卡片＋緩慢掃過的光暈；錄影就是把這張動態畫面錄下來 */
function liveCanvas(W, H, withSelfie, stopBtn){
  const base = document.createElement('canvas');
  selfieLayout = !!withSelfie; suppressSticker = !!withSelfie;
  drawVerseCard(base, studioItem, W, H);
  selfieLayout = false; suppressSticker = false;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'), t0 = performance.now(), F = Math.min(W, H) / 1080;
  const svid = $('#selfiePrev');
  const draw = () => {
    const el = (performance.now() - t0) / 1000;
    cx.drawImage(base, 0, 0);
    const gx = W * (0.12 + 0.76 * (((el / 16) % 2 > 1) ? 2 - (el / 16) % 2 : (el / 16) % 2));
    const rg = cx.createRadialGradient(gx, H * .12, 10, gx, H * .12, W * .55);
    rg.addColorStop(0, 'rgba(255,255,255,.10)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
    if (withSelfie) drawSelfieCircle(cx, svid, W, H, F);
    /* 用了詩歌庫的歌，就在影片最下緣印一行出處——影片會被分享出去，該註明 */
    if (bgmCredit){
      cx.textAlign = 'center';
      cx.font = `${Math.round(19 * F)}px ${CARD_SANS()}`;
      cx.fillStyle = 'rgba(255,255,255,.62)';
      cx.shadowColor = 'rgba(0,0,0,.55)'; cx.shadowBlur = Math.round(6 * F);
      cx.fillText(bgmCredit, W / 2, H - Math.round(22 * F));
      cx.shadowColor = 'transparent';
    }
  };
  const loop = () => { draw(); recAnim = requestAnimationFrame(loop); };
  loop();
  /* 畫面在背景時 requestAnimationFrame 會停，改用計時器補畫，影片才不會凍住 */
  const bgT = setInterval(() => {
    if (document.hidden) draw();
    if (performance.now() - t0 > 4000 && !(mr && mr.state === 'recording')) clearInterval(bgT);
  }, 500);
  const lb = $('#liveBox');
  if (lb){
    cv.style.cssText = 'width:auto;max-width:100%;max-height:50vh;border-radius:14px;display:block;margin:0 auto;box-shadow:0 6px 20px rgba(0,0,0,.14)';
    lb.innerHTML = ''; lb.appendChild(cv); lb.hidden = false;
    /* v2.19.3 預覽正下方就有停止鍵，錄的時候不必再捲動頁面；開始錄就自動捲到預覽置中 */
    if (stopBtn){
      const sb = document.createElement('button');
      sb.className = 'btn primary block danger'; sb.id = 'recStop2'; sb.style.marginTop = '10px';
      sb.textContent = '⏹ ' + t().recStop;
      sb.onclick = () => { if (mr && mr.state === 'recording') recStopNow(); };
      lb.appendChild(sb);
      setTimeout(() => { try{ lb.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(e){ lb.scrollIntoView(); } }, 120);
    }
    /* 自拍時千萬不能把這個 <video> 設成 display:none —— iPhone 一旦把影片元素
       藏起來就停止送畫面，畫布上的臉會凍在那一格。縮到看不見、但還在版面上，
       它才會繼續跑，錄下來的臉才是動的。 */
    const sw = $('#selfieWrap');
    if (sw){
      if (withSelfie) sw.style.cssText = 'position:absolute;width:2px;height:2px;opacity:.01;overflow:hidden;pointer-events:none;z-index:-1';
      else sw.style.display = 'none';
    }
  }
  return cv;
}
function recTick(label){
  const st = $('#recSt'); if (st) st.innerHTML = '<span class="recdot"></span>' + label;
  recTimer = setInterval(() => {
    recSec++;
    const e = $('#recTm');
    if (e) e.textContent = String(Math.floor(recSec / 60)).padStart(2, '0') + ':' + String(recSec % 60).padStart(2, '0');
    mjPill();
  }, 1000);
}
/* 錄完先不要急著存。整理成可以播的檔，打開預覽面板，讓他自己決定
   要留、要重錄、還是不留——這是尊重人的作法，也少了一堆「錄壞了還在裡面」的作品。 */
async function finishRec(blob, type, kind){
  mr = null;
  const dur = recSec;
  try{ if (kind === 'video') blob = await fixVideoBlob(blob, type); }catch(e){ console.error('fix', e); }
  await studioRefresh();
  openReview(blob, blob.type || type, kind, dur);
}
async function saveWork(blob, type, kind, dur, item){
  const it = item || studioItem;
  try{
    if (!wdb) await openWDB();
    if (!wdb) throw new Error('IndexedDB 打不開');
    await putRec({ id:uid(), ts:Date.now(), blob, mime:blob.type || type, kind, dur:dur || 0,
                   v:it.t, r:cardRef(it), n:it.n || '' });
    await studioRefresh();
    toast(kind === 'video' ? t().recDoneV : t().recDoneA, 3600);
    return true;
  }catch(e){
    console.error('saveWork', e);
    toast('存檔失敗：' + (e && e.message || e), 4000);
    return false;
  }
}
/* 直接把還沒存進作品庫的東西分享出去 */
async function shareBlob(blob, mime, kind){
  const name = '321bible-' + (kind === 'video' ? 'video' : 'voice') + extOf(mime);
  const f = new File([blob], name, { type:mime });
  if (navigator.canShare && navigator.canShare({ files:[f] })){
    if (isIOS()) toast(t().saveIOS, 5000);
    try{ await navigator.share({ files:[f], title:t().app }); return; }
    catch(e){ if (e && e.name === 'AbortError') return; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 6000);
  toast(t().savedFile, 3200);
}
/* ---- 錄完的預覽面板：看／聽 → 儲存、分享、重錄、刪掉 ---- */
let rvURL = null;
function openReview(blob, mime, kind, dur){
  const L = t();
  if (rvURL){ try{ URL.revokeObjectURL(rvURL); }catch(e){} }
  rvURL = URL.createObjectURL(blob);
  let kept = false;
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card rvsheet">
    <div class="hlsheet-title">${esc(kind === 'video' ? L.rvTitleV : L.rvTitleA)}</div>
    <div class="rvbox">${kind === 'video'
      ? `<video id="rvMedia" src="${rvURL}" controls playsinline webkit-playsinline autoplay
           style="width:100%;border-radius:14px;display:block;background:#000"></video>`
      : `<audio id="rvMedia" src="${rvURL}" controls autoplay style="width:100%"></audio>`}</div>
    <div class="muted" style="font-size:12px;margin:10px 0 0">${esc(L.rvHint)}</div>
    <div class="rvacts">
      <button class="btn primary block" id="rvSave">${esc(L.rvSave)}</button>
      <button class="btn gold block" id="rvShare">↗ ${esc(L.rvShare)}</button>
      <button class="btn block" id="rvAgain">${esc(L.rvAgain)}</button>
      <button class="btn danger block" id="rvDrop">${esc(L.rvDrop)}</button>
    </div>
  </div>`;
  document.body.appendChild(mask);
  const shut = () => {
    const m = $('#rvMedia', mask); try{ if (m){ m.pause(); m.src = ''; } }catch(e){}
    mask.remove();
    if (rvURL){ try{ URL.revokeObjectURL(rvURL); }catch(e){} rvURL = null; }
  };
  mask.onclick = e => { if (e.target === mask && (kept || confirm(L.rvLeaveAsk))) shut(); };

  $('#rvSave', mask).onclick = async () => {
    const b = $('#rvSave', mask);
    b.disabled = true; b.textContent = L.rvSaving;
    const ok = await saveWork(blob, mime, kind, dur);
    if (ok){ kept = true; shut(); }
    else { b.disabled = false; b.textContent = L.rvSave; }
  };
  $('#rvShare', mask).onclick = () => shareBlob(blob, mime, kind);
  $('#rvAgain', mask).onclick = async () => {
    shut();
    if (recMode === 's'){ await setRecMode('s'); await new Promise(r => setTimeout(r, 450)); }
    toggleRec();
  };
  $('#rvDrop', mask).onclick = () => {
    if (!confirm(L.rvDropAsk)) return;
    shut(); toast(L.rvDropped, 2600);
  };
}
/* 麥克風剛打開的前三、四百毫秒常有一聲爆音或嘶聲——回音消除與自動增益
   還在調整。所以錄音一律：①先等它穩下來 ②收音從靜音淡入 ③音樂也淡入。
   這樣開頭就是乾淨的，不會一開始就「噗」一聲。 */
const REC_WARMUP = 380;      // 等麥克風穩定（毫秒）
const REC_FADEIN = 0.28;     // 人聲淡入（秒）
const BGM_FADEIN = 0.9;      // 音樂淡入（秒）
function fadeIn(g, ac, to, sec){
  if (!g || !ac) return;
  try{
    const t0 = ac.currentTime;
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(to, t0 + sec);
  }catch(e){ try{ g.gain.value = to; }catch(_){} }
}
async function toggleRec(){
  if (mr && mr.state === 'recording'){ recStopNow(); return; }
  if (!studioItem) return;
  bgmPrevStop();
  /* 上一次錄完相機就關了，再按一次自拍要重新開，不然只會錄到靜止的臉 */
  if (recMode === 's' && (!selfieStream || !selfieStream.active)){
    try{ selfieStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false }); }
    catch(e){ recMode = 'c'; camFail(e); await studioRefresh(); }
    if (recMode === 's'){ attachSelfie(); await new Promise(r => setTimeout(r, 500)); }
  }
  let mic;
  /* 明確要求回音消除／雜訊抑制／自動增益，收進來的聲音比較乾淨 */
  try{
    mic = await navigator.mediaDevices.getUserMedia({
      audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
  }catch(e){
    try{ mic = await navigator.mediaDevices.getUserMedia({ audio:true }); }
    catch(e2){ toast(t().micDeny); return; }
  }

  const svid = $('#selfiePrev');
  const useSelfie = isSelfie() && svid && svid.videoWidth;
  let ac = null, bgmEl = null, bgmURL = null, audioStream = mic, micGain = null, bgmGain = null;
  /* 不管有沒有配樂都走 WebAudio，才有地方做淡入 */
  try{
    ac = new (window.AudioContext || window.webkitAudioContext)();
    try{ await ac.resume(); }catch(_){}
    const dst = ac.createMediaStreamDestination();
    micGain = ac.createGain(); micGain.gain.value = 0.0001;
    ac.createMediaStreamSource(mic).connect(micGain).connect(dst);
    if (bgmBlob){
      bgmURL = URL.createObjectURL(bgmBlob);
      bgmEl = new Audio(); bgmEl.src = bgmURL; bgmEl.loop = true; bgmEl.crossOrigin = 'anonymous';
      bgmGain = ac.createGain(); bgmGain.gain.value = 0.0001;
      ac.createMediaElementSource(bgmEl).connect(bgmGain).connect(dst);
    }
    audioStream = dst.stream;
  }catch(e){
    try{ if (ac) ac.close(); }catch(_){}
    ac = null; bgmEl = null; bgmGain = null; micGain = null; audioStream = mic;
  }

  let stream = audioStream, kind = 'audio', mime = audMime();
  /* 按「只有聲音」就真的只錄聲音，不做影片 */
  if (recMode !== 'a' && canVideo()){
    try{
      const [W, H] = cardDims();
      const cv = liveCanvas(W, H, useSelfie, true);
      stream = new MediaStream([...cv.captureStream(24).getVideoTracks(), ...audioStream.getAudioTracks()]);
      kind = 'video'; mime = vidMime();
    }catch(e){ cancelAnimationFrame(recAnim); stream = mic; kind = 'audio'; mime = audMime(); }
  }
  try{
    mr = new MediaRecorder(stream, Object.assign(mime ? { mimeType:mime } : {},
        kind === 'video' ? { videoBitsPerSecond:2200000 } : {}));
  }catch(e){
    cancelAnimationFrame(recAnim);
    try{ mr = new MediaRecorder(mic); kind = 'audio'; }catch(e2){ toast(t().recNo); return; }
  }
  chunks = []; recSec = 0;
  mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mr.onstop = async () => {
    clearInterval(recTimer); cancelAnimationFrame(recAnim); curFade = null; recFading = false;
    mic.getTracks().forEach(tr => tr.stop());
    stopSelfie();
    try{ if (bgmEl){ bgmEl.pause(); bgmEl.src = ''; } }catch(_){}
    try{ if (bgmURL) URL.revokeObjectURL(bgmURL); }catch(_){}
    try{ if (ac) ac.close(); }catch(_){}
    const type = mr.mimeType || mime || (kind === 'video' ? 'video/webm' : 'audio/webm');
    await finishRec(new Blob(chunks, { type }), type, kind);
  };
  /* 等麥克風穩下來再按下錄音鍵，開頭那一聲爆音就被留在外面了 */
  await new Promise(r => setTimeout(r, REC_WARMUP));
  if (!mr) return;
  mr.start(1000);
  curFade = bgmEl ? (() => fadeOutStop(bgmGain, ac, BGM_FADEOUT)) : null;
  fadeIn(micGain, ac, 1, REC_FADEIN);
  if (bgmEl){
    try{ await bgmEl.play(); }catch(_){}
    fadeIn(bgmGain, ac, bgmVol, BGM_FADEIN);
  }
  const bt = $('#recBtn'); if (bt){ bt.textContent = t().recStop; bt.classList.add('danger'); }
  recTick((kind === 'video' ? t().recing : t().recingA) + (bgmBlob ? '　♪' : ''));
}
/* 不開口：卡片配上背景音樂直接合成一支影片 */
async function musicRec(){
  if (mr && mr.state === 'recording'){ recStopNow(); return; }
  if (!studioItem || !bgmBlob){ toast(t().bgmNeed); return; }
  if (!canVideo()){ toast(t().vidNo); return; }
  bgmPrevStop();
  const jobItem = studioItem;
  mjAsk();
  let ac, bgmEl, bgmURL, audioStream;
  try{
    ac = new (window.AudioContext || window.webkitAudioContext)();
    try{ await ac.resume(); }catch(_){}
    bgmURL = URL.createObjectURL(bgmBlob);
    bgmEl = new Audio(); bgmEl.src = bgmURL; bgmEl.loop = false; bgmEl.crossOrigin = 'anonymous';
    const gain = ac.createGain(); gain.gain.value = 0.0001; __mcGain = gain;
    const dst = ac.createMediaStreamDestination();
    ac.createMediaElementSource(bgmEl).connect(gain).connect(dst);
    /* 邊聽邊製作：同一路聲音也送到喇叭；音量跟著淡入淡出一起走 */
    if (state.mcHear !== false) gain.connect(ac.destination);
    audioStream = dst.stream;
  }catch(e){ toast(t().bgmBad); return; }

  const [W, H] = cardDims();
  const cv = liveCanvas(W, H, false);
  const mime = vidMime();
  const stream = new MediaStream([...cv.captureStream(24).getVideoTracks(), ...audioStream.getAudioTracks()]);
  try{ mr = new MediaRecorder(stream, Object.assign(mime ? { mimeType:mime } : {}, { videoBitsPerSecond:2200000 })); }
  catch(e){ cancelAnimationFrame(recAnim); toast(t().vidNo); return; }

  chunks = []; recSec = 0;
  mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mr.onstop = async () => {
    clearInterval(recTimer); cancelAnimationFrame(recAnim); curFade = null; recFading = false;
    try{ if (bgmEl){ bgmEl.pause(); bgmEl.src = ''; } }catch(_){}
    try{ if (bgmURL) URL.revokeObjectURL(bgmURL); }catch(_){}
    try{ if (ac) ac.close(); }catch(_){}
    const type = mr.mimeType || mime || 'video/webm';
    if (!(spk && spk.on)) wlRelease();
    await mjFinish(new Blob(chunks, { type }), type, jobItem);
  };
  mr.start(1000);
  bgJob = { item:jobItem };
  wlAcquire();
  try{ await bgmEl.play(); }catch(e){}
  fadeIn(__mcGain, ac, 1, 0.6);
  curFade = () => fadeOutStop(__mcGain, ac, BGM_FADEOUT);
  bgmEl.onended = () => { if (mr && mr.state === 'recording') mr.stop(); };
  /* 整首：剩 5 秒就開始淡出；固定長度：在「長度－5 秒」開始淡出，淡完剛好結束 */
  bgmEl.ontimeupdate = () => {
    if (mcLen > 0 || recFading || !isFinite(bgmEl.duration)) return;
    const left = bgmEl.duration - bgmEl.currentTime;
    if (left <= BGM_FADEOUT && mr && mr.state === 'recording') fadeOutStop(__mcGain, ac, Math.max(.5, left));
  };
  const lim = mcLen > 0 ? mcLen : 8 * 60;
  setTimeout(() => { if (!recFading && mr && mr.state === 'recording') fadeOutStop(__mcGain, ac, BGM_FADEOUT); },
             Math.max(0, lim - BGM_FADEOUT) * 1000);
  setTimeout(() => { if (mr && mr.state === 'recording') mr.stop(); }, lim * 1000 + 300);
  const bt = $('#mcBtn'); if (bt){ bt.textContent = t().recStop; bt.classList.add('danger'); }
  recTick(t().mcing + '　♪');
}

/* ---- 作品的播放／分享／下載／刪除 ---- */
async function getRec(id){ const a = await allRec(); return a.find(x => x.id === id); }
async function readyBlob(r){
  if (r.kind !== 'video') return r.blob;
  const fixed = await fixVideoBlob(r.blob, r.mime);
  if (fixed !== r.blob){ try{ await putRec(Object.assign({}, r, { blob:fixed, mime:'video/mp4' })); }catch(e){} }
  return fixed;
}
async function dlRec(id){
  const r = await getRec(id); if (!r) return;
  const blob = await readyBlob(r);
  const mime = (r.kind === 'video' && blob !== r.blob) ? 'video/mp4' : r.mime;
  const name = '321bible-' + (r.kind === 'video' ? 'video' : 'voice') + extOf(mime);
  /* 影片也一樣：iPhone 要走分享面板才進得了相簿 */
  if (isIOS()){
    const f = new File([blob], name, { type:mime });
    if (navigator.canShare && navigator.canShare({ files:[f] })){
      toast(t().saveIOS, 5000);
      try{ await navigator.share({ files:[f], title: t().app }); return; }
      catch(e){ if (e && e.name === 'AbortError') return; }
    }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 6000);
  toast(t().savedFile, 3200);
}
async function shareRec(id){
  const r = await getRec(id); if (!r) return;
  const blob = await readyBlob(r);
  const mime = (r.kind === 'video' && blob !== r.blob) ? 'video/mp4' : r.mime;
  const f = new File([blob], '321bible' + extOf(mime), { type:mime });
  if (navigator.canShare && navigator.canShare({ files:[f] })){
    try{ await navigator.share({ files:[f], title:t().app }); return; }
    catch(e){ if (e && e.name === 'AbortError') return; }
  }
  dlRec(id);
}
async function rmRec(id){
  if (!confirm(t().delAsk)) return;
  await delRec(id); studioRefresh(); toast(t().deleted);
}
let playURL = null;
async function playRec(id){
  const r = await getRec(id); if (!r) return;
  if (playURL) URL.revokeObjectURL(playURL);
  playURL = URL.createObjectURL(r.blob);
  const box = $('#play_' + id);
  if (!box) return;
  box.innerHTML = r.kind === 'video'
    ? `<video src="${playURL}" controls playsinline autoplay style="width:100%;border-radius:12px;display:block"></video>`
    : `<audio src="${playURL}" controls autoplay style="width:100%"></audio>`;
}

/* ================================================================ 美圖工作室 */
let studioItem = null, studioNote = null, blessBusy = false;

/* 問小智一次就好（寫祝福、改內文共用），連不上會回 {out:'', why:'原因'} */
async function aiRaw(sys, ask, ms){
  let out = '', why = '';
  for (let a = 0; a <= CHAT_RETRY.length; a++){
    const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const tm = ac ? setTimeout(() => ac.abort(), ms || 60000) : 0;
    try{
      const r = await fetch(API.chat, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ system: koSys(sys), messages:[{ role:'user', content: ask }] }), signal: ac ? ac.signal : undefined });
      if (!r.ok) throw new Error('http ' + r.status);
      out = extractReply(await r.json().catch(() => null));
      if (!out) why = L3('回覆是空的', '回复是空的', 'empty reply');
      clearTimeout(tm);
      break;
    }catch(e){
      clearTimeout(tm);
      why = (e && e.name === 'AbortError') ? L3('逾時', '逾时', 'timeout') : ((e && e.message) ? String(e.message) : 'network');
      if (a === CHAT_RETRY.length) break;
      await new Promise(rs => setTimeout(rs, CHAT_RETRY[a]));
    }
  }
  return { out, why };
}
async function aiOnce(sys, ask){
  const r = await aiRaw(sys, ask);
  return { out: r.out ? r.out.replace(/[*#>`]/g, '').replace(/^「|」$/g, '').trim() : '', why: r.why };
}
/* 寫短文（祝福、改內文、團隊代寫）時，讀者是誰也要照「回答對象」調整口氣。
   這幾處的內文會被畫在卡片上，所以一律不要表情符號。 */
const AUD_WRITE = () => {
  const a = state.audience;
  if (a === 'seeker') return SK_WRITE();
  { const x2 = A2(); if (x2) return x2.write; }
  if (isEP()) return {
    adult:'\nThe reader is an adult: mature, warm and sincere.',
    teen :'\nThe reader is a teenager: light, witty, like a friend chatting; a little humour is fine, but never preachy, flippant, or joking about God or Scripture. No emoji.',
    kid  :'\nThe reader is a young child: very simple words and short sentences, like telling a story, one idea per sentence, no hard terms. No emoji.'
  }[a];
  if (isZS()) return {
    adult:'\n读者是成年人：口吻成熟、温暖、真诚。',
    teen :'\n读者是青少年：口气轻松幽默、像朋友聊天，可以有一点梗，但不说教、不轻浮、不拿神和圣经开玩笑；不要用表情符号。',
    kid  :'\n读者是小朋友：用非常简单的字词和短句，像说故事，一句只讲一件事，不用艰深名词；不要用表情符号。'
  }[a];
  return {
    adult:'\n讀者是成年人：口吻成熟、溫暖、真誠。',
    teen :'\n讀者是青少年：口氣輕鬆幽默、像朋友聊天，可以有一點梗，但不說教、不輕浮、不拿神和聖經開玩笑；不要用表情符號。',
    kid  :'\n讀者是小朋友：用非常簡單的字詞和短句，像說故事，一句只講一件事，不用艱深名詞；不要用表情符號。'
  }[a];
};
/* 寫給誰——祝福與改內文都要帶上 */
function whoLine(){
  const who = cardToVal();
  return who ? L3(`\n這段話是寫給「${who}」的，請直接對他說話，但不要再寫一次稱呼。`,
                  `\n这段话是写给“${who}”的，请直接对他说话，但不要再写一次称呼。`,
                  `\nThis is written for "${who}" — speak directly to them, but do not repeat the greeting.`) : '';
}
/* ---- 改一改：拿目前的內文，照使用者說的方式請小智重寫 ---- */
const TWEAK_L = {
  zh:{ btn:'✨ 改一改', title:'要怎麼改？', ph:'或者自己說，例如：加一句為他的工作禱告',
       go:'改好給我', close:'關閉', busy:'小智修改中…', done:'改好了',
       need:'卡片內文還是空的——先自己寫一段，或請小智寫一段再來改。',
       picks:['短一點','長一點','更溫暖','口語一點','更有力','換個說法'] },
  zs:{ btn:'✨ 改一改', title:'要怎么改？', ph:'或者自己说，例如：加一句为他的工作祷告',
       go:'改好给我', close:'关闭', busy:'小智修改中…', done:'改好了',
       need:'卡片内文还是空的——先自己写一段，或请小智写一段再来改。',
       picks:['短一点','长一点','更温暖','口语一点','更有力','换个说法'] },
  en:{ btn:'✨ Revise', title:'How should it change?', ph:'Or say it yourself, e.g. add a line praying for their work',
       go:'Rewrite it', close:'Close', busy:'Xiaozhi is rewriting…', done:'Rewritten',
       need:'The card text is still empty — write something first, or ask Xiaozhi to write it.',
       picks:['Shorter','Longer','Warmer','More everyday','Stronger','Say it another way'] }
};
const tw_ = () => TWEAK_L[state.lang] || (isX() ? TWEAK_L.en : TWEAK_L.zh);
const isFullV = () => !!(photoImg && photoMode === 'full' && fullKind === 'verse');   /* 整張原圖＋經文：要改的是附在經文下面的祝福 */
function curNote(){
  if (isFullV()) return String(fullBless || '').trim();
  return String(studioNote != null ? studioNote : (studioItem && studioItem.n) || '').trim();
}
async function noteRewrite(instr, mask){
  if (blessBusy || !studioItem) return;
  const cur = curNote();
  if (!cur){ toast(tw_().need, 4200); return; }
  blessBusy = true;
  const go = mask && $('#twGo', mask);
  if (go){ go.disabled = true; go.textContent = tw_().busy; }
  const sys = isEP()
    ? 'You are Xiaozhi from Kingdom 321 Online Fellowship. Rewrite the short blessing the user gives you, following their instruction. Return ONLY the rewritten text — no explanation, no heading, no bullet points, no quotation marks, and do not quote the verse again. Keep it warm and spoken, never preachy. Close with a short blessing ending in just "Amen" — do not write "in the name of Jesus we pray".'
    : isZS()
    ? '你是「小智」，国度321空中团契的属灵同伴。请照使用者的要求，修改他给你的这段祝福。只回传改好的内文本身——不要解释、不要标题、不要条列、不要引号、不要再抄一次经文。保持温暖、口语、不说教。祝福结尾只用「阿们」，不要写「奉主耶稣的名祷告」。'
    : '你是「小智」，國度321空中團契的屬靈同伴。請照使用者的要求，修改他給你的這段祝福。只回傳改好的內文本身——不要解釋、不要標題、不要條列、不要引號、不要再抄一次經文。保持溫暖、口語、不說教。祝福結尾只用「阿們」，不要寫「奉主耶穌的名禱告」。';
  const ask = L3('經文：', '经文：', 'Verse: ') + studioItem.t + '（' + cardRef(studioItem) + '）'
            + whoLine() + AUD_WRITE()
            + L3('\n\n目前的內文：\n', '\n\n目前的内文：\n', '\n\nCurrent text:\n') + cur
            + L3('\n\n要怎麼改：', '\n\n要怎么改：', '\n\nHow to change it: ') + instr;
  const r = await aiOnce(sys, ask);
  blessBusy = false;
  if (r.out){
    const ro = amenBang(r.out);
    if (isFullV()) fullBless = ro.replace(/\s*\n+\s*/g, ''); else studioNote = ro;
    if (mask) mask.remove();
    await studioRefresh();
    toast(tw_().done);
  } else {
    if (go){ go.disabled = false; go.textContent = tw_().go; }
    toast(t().chatErr + (r.why ? '（' + r.why + '）' : ''), 4000);
  }
}
function openTweak(){
  if (!studioItem) return;
  if (!curNote()){ toast(tw_().need, 4200); return; }
  const L = tw_();
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card">
    <div class="hlsheet-title">${esc(L.title)}</div>
    <div class="cardchips" id="twPick">${L.picks.map(p => `<button data-q="${esc(p)}">${esc(p)}</button>`).join('')}</div>
    <input class="cardinput" id="twOwn" placeholder="${esc(L.ph)}" style="margin-top:10px">
    <div class="hlsheet-acts" style="margin-top:12px">
      <button class="btn primary" id="twGo">${esc(L.go)}</button>
      <button class="btn" id="twClose">${esc(L.close)}</button>
    </div></div>`;
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask && !blessBusy) mask.remove(); };
  $('#twClose', mask).onclick = () => { if (!blessBusy) mask.remove(); };
  const own = $('#twOwn', mask);
  $$('#twPick button', mask).forEach(b => b.onclick = () => {
    $$('#twPick button', mask).forEach(x => x.classList.toggle('on', x === b));
    own.value = '';
  });
  $('#twGo', mask).onclick = () => {
    const picked = $('#twPick button.on', mask);
    const instr = (own.value || '').trim() || (picked ? picked.dataset.q : L.picks[0]);
    noteRewrite(instr, mask);
  };
}

/* 請小智照這節經文寫一段關懷祝福，直接放進卡片內文 */
async function blessWrite(){
  if (blessBusy || !studioItem) return;
  blessBusy = true;
  const full = photoMode === 'full' && photoImg;
  const btn = $(full ? '#fBless' : '#blessBtn');
  if (btn){ btn.disabled = true; btn.textContent = t().blessing; }
  const sysFull = isEP()
    ? 'You are Xiaozhi, a spiritual companion from Kingdom 321 Online Fellowship. From the verse the user gives you, write a very short blessing for a brother or sister: one or two sentences, under 35 words, warm and spoken, drawn from what this verse says of God. No headings, no quotation marks, do not quote the verse again, no emoji. If it reads as a prayer, close it with "in the name of the Lord Jesus we pray, Amen".'
    : state.lang === 'zs'
    ? '你是“小智”，国度321空中团契的属灵同伴。请照使用者给的这节经文，写一两句很短的祝福送给弟兄姊妹：总共一到两句、50字以内，口语、温暖，从这节经文所显明的神的心意出发。不要标题、不要引号、不要再抄一次经文、不要表情符号。若结尾写成祷告，要用“奉主耶稣的名祷告，阿们”。'
    : '你是「小智」，國度321空中團契的屬靈同伴。請照使用者給的這節經文，寫一兩句很短的祝福送給弟兄姊妹：總共一到兩句、50字以內，口語、溫暖，從這節經文所顯明的神的心意出發。不要標題、不要引號、不要再抄一次經文、不要表情符號。若結尾寫成禱告，要用「奉主耶穌的名禱告，阿們」。';
  const sys = full ? sysFull : isEP()
    ? 'You are Xiaozhi, a spiritual companion from Kingdom 321 Online Fellowship. From the verse the user gives you, write a short, warm word of encouragement for a brother or sister. First name in one or two sentences what this verse shows of God\'s heart, then one sentence that touches ordinary daily life, then close with a blessing. Three to four sentences, under 60 words. Warm and spoken, never preachy. No headings, no bullet points, no quotation marks, and do not quote the verse again. If it reads as a prayer, close it with "in the name of the Lord Jesus we pray, Amen" — never "in Jesus\' name we ask, Amen."'
    : state.lang === 'zs'
    ? '你是「小智」，国度321空中团契的属灵同伴。请照使用者给的这节经文，写一段温暖的关怀祝福，送给弟兄姊妹。要求：先用一两句点出这节经文里神的心意，再写一句贴近生活的祝福，最后用一句祝福收尾。总共三到四句、120 字以内，口语、温暖、不说教，不要标题、不要条列、不要引号、不要再抄一次经文。若结尾写成祷告，要用「奉主耶稣的名祷告，阿们」，不要用「奉耶稣的名求」。'
    : '你是「小智」，國度321空中團契的屬靈同伴。請照使用者給的這節經文，寫一段溫暖的關懷祝福，送給弟兄姊妹。要求：先用一兩句點出這節經文裡神的心意，再寫一句貼近生活的祝福，最後用一句祝福收尾。總共三到四句、120 字以內，口語、溫暖、不說教，不要標題、不要條列、不要引號、不要再抄一次經文。若結尾寫成禱告，要用「奉主耶穌的名禱告，阿們」，不要用「奉耶穌的名求」。';
  const ask = L3('經文：', '经文：', 'Verse: ') + studioItem.t + ' (' + cardRef(studioItem) + ')' + whoLine() + AUD_WRITE()
    + (blessOwn.trim() ? L3('\n\n使用者自己想說的話（請把這個意思自然融入祝福，仍要依經文來寫）：', '\n\n使用者自己想说的话（请把这个意思自然融入祝福，仍要依经文来写）：', '\n\nThe user\'s own words (weave this meaning naturally into the blessing, still grounded in the verse): ') + blessOwn.trim() : '');
  const rr_ = await aiOnce(sys, ask);
  const out = amenBang(amenOnly(rr_.out)), why = rr_.why;
  blessBusy = false;
  if (out){
    if (full) fullBless = out.replace(/\s*\n+\s*/g, ''); else studioNote = out;
    await studioRefresh();
    toast(t().blessDone);
  } else {
    if (btn){ btn.disabled = false; btn.textContent = full ? L3('✍️ 小智寫祝福（附在經文下面）', '✍️ 小智写祝福（附在经文下面）', '✍️ Xiaozhi writes a blessing') : '✍️ ' + t().bless; }
    toast(t().chatErr + (why ? '（' + why + '）' : ''), 4000);
  }
}
const pick2 = a => isX() ? (a.length > 2 ? koT(a[0], a[2]) : a[0]) : a[isEN() ? (a.length > 2 ? 2 : 0) : (isZS() ? 1 : 0)];
function chips(id, items, cur, attr){
  return `<div class="cardchips" id="${id}">${items.map(([v, n]) =>
    `<button class="${String(cur) === String(v) ? 'on' : ''}" data-${attr}="${v}">${esc(pick2(n))}</button>`).join('')}</div>`;
}
async function studioRefresh(){
  if (curTab() !== 'studio') return;
  const y = window.scrollY;
  await viewStudio($('#view'));
  mjRestore();
  window.scrollTo(0, y);
}
function curTab(){ return (location.hash || '').indexOf('#/studio') === 0 ? 'studio' : ''; }


/* ── 美圖工作室分頁（v2.18.31，照聖經講義與生活操練 App）：
   上面預覽與分享，下面分「文字／相片／版面／配樂與錄製」四頁；選過的分頁會記住 ── */
let studioTabSel = '';
function studioTabs(v, L){
  try {
    if (!document.getElementById('stTabCss')){
      const st = document.createElement('style'); st.id = 'stTabCss';
      st.textContent = `.sttabs{position:sticky;top:110px;z-index:14;display:flex;background:var(--bg);border-bottom:1px solid var(--border);margin:6px -4px 4px;padding:0 4px}
.sttabs button{flex:1;border:0;background:none;padding:12px 2px 10px;font:inherit;font-size:15px;color:var(--ink-soft);border-bottom:3px solid transparent;cursor:pointer;white-space:nowrap}
.sttabs button.on{color:var(--ink);font-weight:700;border-bottom-color:var(--accent)}
.stpane{padding-top:6px}.stpane[hidden]{display:none}
.stpane > .section-title:first-child{margin-top:14px}`;
      document.head.appendChild(st);
    }
    const grp = (txt) => {
      txt = String(txt || '');
      if (txt === L.cardText || txt === L.cardLines || txt === CARD_FONT_TITLE() || txt === EMB_T()) return 'text';
      if (txt === L.cardStyle || txt === L.cardBorder || txt === L.cardSize || txt === L.cardFsL) return 'lay';
      if (txt === L.photo) return 'photo';
      if (txt === L.bgm || txt === L.recSec || txt.indexOf(L.works) === 0) return 'rec';
      return '';
    };
    const kids = Array.prototype.slice.call(v.children);
    const first = kids.findIndex(e => e.classList && e.classList.contains('section-title'));
    if (first < 0) return;
    const panes = { text: [], photo: [], lay: [], rec: [] };
    let cur = '';
    for (let i = first; i < kids.length; i++){
      const e = kids[i];
      if (e.classList && e.classList.contains('section-title')){ const g = grp(e.textContent); if (g) cur = g; }
      if (cur) panes[cur].push(e);
    }
    const TABS = [['text', L3('文字', '文字', 'Text')], ['photo', L3('相片', '相片', 'Photo')], ['lay', L3('版面', '版面', 'Layout')], ['rec', L3('配樂與錄製', '配乐与录制', 'Music & record')]]
      .filter(x => panes[x[0]].length);
    if (!TABS.length) return;
    if (!studioTabSel || !panes[studioTabSel] || !panes[studioTabSel].length) studioTabSel = panes.photo.length ? 'photo' : TABS[0][0];
    const bar = document.createElement('div'); bar.className = 'sttabs';
    bar.innerHTML = TABS.map(x => `<button data-st="${x[0]}" class="${x[0] === studioTabSel ? 'on' : ''}">${esc(x[1])}</button>`).join('');
    v.insertBefore(bar, kids[first]);
    const topPx = () => { const h = document.querySelector('header.topbar'), t = v.querySelector('.chtoolbar'); return Math.round((h ? h.getBoundingClientRect().height : 56) + (t ? t.getBoundingClientRect().height : 0)); };
    bar.style.top = topPx() + 'px';
    const boxes = {};
    TABS.forEach(x => {
      const d = document.createElement('div'); d.className = 'stpane'; d.setAttribute('data-sp', x[0]);
      if (x[0] !== studioTabSel) d.hidden = true;
      panes[x[0]].forEach(e => d.appendChild(e));
      v.appendChild(d); boxes[x[0]] = d;
    });
    bar.querySelectorAll('button').forEach(b => b.onclick = () => {
      studioTabSel = b.getAttribute('data-st');
      bar.querySelectorAll('button').forEach(o => o.classList.toggle('on', o === b));
      Object.keys(boxes).forEach(k => { boxes[k].hidden = k !== studioTabSel; });
      const tp = topPx(); bar.style.top = tp + 'px'; const r = bar.getBoundingClientRect(); if (r.top > innerHeight * 0.6) window.scrollBy(0, r.top - tp);
    });
  } catch (e) { console.warn('studioTabs', e); }
}
async function viewStudio(v){
  const L = t();
  if (!studioItem){ go('#/me'); return; }
  await plRestore();
  const works = wdb ? (await allRec()).sort((a, b) => b.ts - a.ts) : [];
  const vOK = canVideo();
  const FULL = !!(photoImg && photoMode === 'full');
  v.innerHTML = `
    <div class="chtoolbar">
      <button class="chtb-btn navlbl" id="stBack" title="${esc(L3('上一頁', '上一页', 'Back'))}">‹ ${esc(L3('上一頁', '上一页', 'Back'))}</button>
      <div class="chtb-spacer"></div>
      <div class="muted" style="font-size:12.5px">${esc(cardRef(studioItem))}</div>
    </div>
    <div class="cardpv" id="cardPv"></div>
    <div class="hlsheet-acts" style="margin:0 0 6px">
      <button class="btn primary" id="btShare">${esc(L.cardShare)}</button>
      <button class="btn" id="btSave">${esc(L.cardSave)}</button>
    </div>
    <div class="hl-hint" style="margin:8px 0 18px">${esc(L.cardHint)}</div>
    ${EMBED ? `
    <div class="section-title">${esc(EMB_T())}</div>
    <div class="card">
      <textarea class="hlsheet-ta" id="eT">${esc(studioItem.t || '')}</textarea>
      <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L3('出處', '出处', 'Reference'))}</div>
      <input class="cardinput" id="eRef" value="${esc(studioItem.ref || '')}">
    </div>` : ''}

    ${FULL ? '' : `
    <div class="section-title">${esc(L.cardText)}</div>
    <div class="card">
      <textarea class="hlsheet-ta" id="cardNote" placeholder="${esc(L.hlNote)}">${esc(studioNote != null ? studioNote : (studioItem.n || ''))}</textarea>
      <input class="cardinput" id="blessOwn" value="${esc(blessOwn)}" style="margin-bottom:8px" placeholder="${esc(L3('自己說（選填）：想對他說什麼？例如：他最近工作很辛苦', '自己说（选填）：想对他说什么？例如：他最近工作很辛苦', 'Your own words (optional), e.g. he has been working very hard lately'))}">
      <div class="hlsheet-acts2">
        <button class="btn sm gold" id="blessBtn">✍️ ${esc(L.bless)}</button>
        <button class="btn sm gold" id="tweakBtn">${esc(tw_().btn)}</button>
        <button class="btn sm" id="noteMine">${esc(L.useMine)}</button>
        <button class="btn sm" id="noteClear">${esc(L.clearText)}</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.blessHint)}</div>
      <div class="muted" style="font-size:12px;margin-top:4px">${esc(L3('寫給：', '写给：', 'Written for: '))}${AUD_ICON[state.audience]} ${esc(AUD_NAME()[state.audience])}${esc(L3('（到「小智」頁或「我的」設定可以更改）', '（到“小智”页或“我的”设置可以更改）', ' (change it on the Xiaozhi page or in Me → Settings)'))}</div>
    </div>

    `}

    <div class="section-title">${esc(CARD_FONT_TITLE())}</div>
    <div class="card">
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L3('字體', '字体', 'Font'))}</div>
      ${chips('cFont', CARD_FONTS, cardFontKey(), 'f')}
      <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('文字顏色', '文字颜色', 'Text colour'))}</div>
      <div class="cardchips" id="cInk">${CARD_INKS.map(([c, n]) => `<button data-c="${c}" class="${cardInkVal().toLowerCase() === c.toLowerCase() ? 'on' : ''}">${c ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c};border:1px solid rgba(0,0,0,.25);margin-right:5px;vertical-align:-1px"></span>` : ''}${esc(pick2(n))}</button>`).join('')}</div>
      <label class="btn sm" style="margin-top:10px;display:inline-flex;gap:8px;align-items:center;cursor:pointer">${esc(L3('🎨 自選顏色', '🎨 自选颜色', '🎨 Pick a colour'))}<input type="color" id="cInkC" value="${esc(cardInkVal() || '#123F92')}" style="width:34px;height:26px;border:0;padding:0;background:none"></label>
      <div class="muted" id="fontSt" style="font-size:13px;margin-top:8px;color:var(--navy,#123F92);font-weight:600">${esc(fontStatText())}</div>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L3('選了字體，整張卡片都會用同一種字體；楷體與圓體第一次選用時會下載字體（約 1–2 MB），稍等一下卡片就會換上。文字顏色選「自動」就會依版型或相片自動配色。', '选了字体，整张卡片都会用同一种字体；楷体与圆体第一次选用时会下载字体（约 1–2 MB），稍等一下卡片就会换上。文字颜色选“自动”就会依版型或相片自动配色。', 'The chosen font is used across the whole card; Kai and Round download a font the first time (about 1–2 MB), so the card updates after a moment. “Auto” colour follows the style or photo.'))}</div>
    </div>

    <div class="section-title">${esc(L.cardLines)}</div>
    <div class="card">
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.cardToL)}</div>
      <input class="cardinput" id="cardTo" value="${esc(cardToVal())}"
             placeholder="${esc(L.cardToPH)}">
      ${FULL ? '' : `<div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.cardTopL)}</div>
      <input class="cardinput" id="cardTop" value="${esc(state.cardTop || '')}"
             placeholder="${esc(DEF_TOP())}">`}
      <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.cardSignL)}</div>
      <input class="cardinput" id="cardSign" value="${esc(state.cardSign || '')}"
             placeholder="${esc(DEF_SIGN())}">
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.cardLinesHint)}</div>
    </div>

    ${FULL ? '' : `
    <div class="section-title">${esc(L.cardStyle)}</div>
    ${chips('cTpl', CARD_ORDER.map(k => [k, CARD_TPL[k].n]), cardTpl(), 't')}
    <div class="section-title">${esc(L.cardBorder)}</div>
    ${chips('cBrd', CARD_BORDERS, cardBorder(), 'b')}
    <div class="section-title">${esc(L.cardSize)}</div>
    ${chips('cSz', Object.keys(CARD_SIZES).map(k => [k, CARD_SIZES[k][2]]), cardSize(), 'z')}
    <div class="section-title">${esc(L.cardFsL)}</div>
    ${chips('cFs', CARD_FS, cardFs(), 'f')}
    <div class="muted" style="font-size:12px;margin-top:6px">${esc(L.cardFsHint)}</div>
    `}

    <div class="section-title">${esc(L.photo)}</div>
    <div class="card">${(() => {
      const isStk = photoMode === 'sticker';
      const cur = isStk ? stkImg : photoImg, by = isStk ? stkBy : photoBy;
      const mark = (n, on) => on ? n.map(x => x + ' ✓') : n;
      return `${chips('pMode', [['bg', mark(L.photoBg, !!photoImg)], ['sticker', mark(L.photoStk, !!stkImg)], ['orig', o3('原圖', '原图', 'Original')], ['full', o3('整張原圖', '整张原图', 'Full photo')]], photoMode, 'm')}
      <div class="muted" style="font-size:12px;margin:12px 0 4px">${esc(L3('內建圖庫（先選分類，點一下就套用）','内建图库（先选分类，点一下就套用）','Built-in gallery (pick a category, tap to use)'))}</div>
      <div class="bgcats" id="pBuiltCat"></div>
      <div class="bgstrip" id="pBuilt"></div>
      ${cur ? `
      ${photoMode === 'full' ? `
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('整張相片就是整張卡片，不加邊框；只留稱呼、經文（或問候語）與署名，自動排在相片上方最空的地方。', '整张相片就是整张卡片，不加边框；只留称呼、经文（或问候语）与署名，自动排在相片上方最空的地方。', 'The whole photo is the card, no frame. Only the greeting name, verse (or a greeting) and signature, placed in the emptiest spot at the top.'))}</div>
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('文字大小（也可以在預覽圖上用兩指捏合縮放）', '文字大小（也可以在预览图上用两指捏合缩放）', 'Text size (or pinch on the preview with two fingers)'))}　<b id="fSzV">${Math.round(fullScale * 100)}%</b></div>
        <input type="range" id="fSz" min="50" max="250" step="5" value="${Math.round(fullScale * 100)}" style="width:100%">
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('文字內容', '文字内容', 'Text'))}</div>
        ${chips('pFk', [['verse', o3('經文', '经文', 'Verse')], ['greet', o3('問候語', '问候语', 'Greeting')]], fullKind, 'v')}
        ${fullKind === 'verse' ? `<input class="cardinput" id="blessOwn" value="${esc(blessOwn)}" style="margin-top:8px" placeholder="${esc(L3('自己說（選填）：想對他說什麼？例如：他最近工作很辛苦', '自己说（选填）：想对他说什么？例如：他最近工作很辛苦', 'Your own words (optional), e.g. he has been working very hard lately'))}"><div class="hlsheet-acts2" style="margin-top:8px"><button class="btn sm gold" id="fBless">✍️ ${esc(L3('小智寫祝福（附在經文下面）', '小智写祝福（附在经文下面）', 'Xiaozhi writes a blessing (under the verse)'))}</button><button class="btn sm gold" id="fTweak">${esc(tw_().btn)}</button><button class="btn sm" id="fBlessClr">${esc(L3('清除祝福', '清除祝福', 'Clear'))}</button></div>
        <textarea class="hlsheet-ta" id="fullBless" style="margin-top:8px" placeholder="${esc(L3('按上面的鈕，小智會依這節經文寫一兩句短祝福；也可以自己寫。', '按上面的钮，小智会依这节经文写一两句短祝福；也可以自己写。', 'Tap the button for a one- or two-sentence blessing from this verse, or write your own.'))}">${esc(fullBless)}</textarea>` : ''}
        ${fullKind === 'greet' ? `<textarea class="hlsheet-ta" id="cardGreet" style="margin-top:8px" placeholder="${esc(L3('平安喜樂，主愛你！', '平安喜乐，主爱你！', 'Peace and joy to you!'))}">${esc(state.cardGreet || '')}</textarea>` : ''}
        <div class="hlsheet-acts2" style="margin-top:8px">
          <button class="btn sm ${origMove ? 'primary' : ''}" id="omTog">${esc(origMove ? L3('✋ 拖動中：點此鎖定', '✋ 拖动中：点此锁定', '✋ Dragging on — tap to lock') : L3('✋ 用手指拖動文字', '✋ 用手指拖动文字', '✋ Drag the text'))}</button>
          <button class="btn sm" id="omReset">${esc(L3('↺ 回到自動位置', '↺ 回到自动位置', '↺ Auto position'))}</button>
        </div>
        <div class="hlsheet-acts2" style="margin-top:8px;justify-content:flex-start">
          <button class="btn sm" data-nudge="-1,0">←</button><button class="btn sm" data-nudge="0,-1">↑</button>
          <button class="btn sm" data-nudge="0,1">↓</button><button class="btn sm" data-nudge="1,0">→</button>
        </div>` : ''}
      ${photoMode === 'orig' ? `
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('原圖完整呈現、不裁切，文字排在不蓋住相片的空位。', '原图完整呈现、不裁切，文字排在不盖住相片的空位。', 'The photo is shown whole and uncropped; the text sits in the free space beside it.'))}</div>
        <div class="muted" style="font-size:12px;margin:10px 0 6px">${esc(L3('相片大小', '相片大小', 'Photo size'))}</div>
        ${chips('pOSz', [[0.85, o3('小', '小', 'Small')], [1, o3('中', '中', 'Medium')], [1.15, o3('大', '大', 'Large')]], origScale, 'v')}
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('構圖（自動會依相片與卡片尺寸挑最合適的）', '构图（自动会依相片与卡片尺寸挑最合适的）', 'Layout (Auto picks the best fit for your photo and card size)'))}</div>
        ${chips('pOLay', [['auto', o3('自動', '自动', 'Auto')], ['stack', o3('上圖下字', '上图下字', 'Photo on top')], ['side', o3('左圖右字', '左图右字', 'Photo on left')]], origLay, 'v')}
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('文字位置（經文、出處與領受是一個區塊，可自己移動）', '文字位置（经文、出处与领受是一个区块，可自己移动）', 'Text position (verse, reference and note move together)'))}</div>
        ${chips('pOSp', [[0, o3('整塊一起移', '整块一起移', 'Move together')], [1, o3('分開移動', '分开移动', 'Move separately')]], origSplit ? 1 : 0, 'v')}
        ${origSplit ? `<div class="muted" style="font-size:12px;margin:8px 0 6px">${esc(L3('現在要移動哪一塊？', '现在要移动哪一块？', 'Which part to move?'))}</div>
        ${chips('pOTg', [['v', o3('經文與出處', '经文与出处', 'Verse & reference')], ['n', o3('領受', '领受', 'My note')]], origTarget, 'v')}` : ''}
        <div class="hlsheet-acts2" style="margin-top:8px">
          <button class="btn sm ${origMove ? 'primary' : ''}" id="omTog">${esc(origMove ? L3('✋ 拖動中：點此鎖定', '✋ 拖动中：点此锁定', '✋ Dragging on — tap to lock') : L3('✋ 用手指拖動文字', '✋ 用手指拖动文字', '✋ Drag the text'))}</button>
          <button class="btn sm" id="omReset">${esc(L3('↺ 回到預設', '↺ 回到默认', '↺ Reset'))}</button>
        </div>
        <div class="hlsheet-acts2" style="margin-top:8px;justify-content:flex-start">
          <button class="btn sm" data-nudge="-1,0">←</button><button class="btn sm" data-nudge="0,-1">↑</button>
          <button class="btn sm" data-nudge="0,1">↓</button><button class="btn sm" data-nudge="1,0">→</button>
        </div>
        <div class="muted" style="font-size:11.5px;margin-top:6px">${esc(origMove
          ? L3('現在手指在上方預覽圖拖一拖，文字就會跟著移動；移好後按「鎖定」才能再捲動頁面。', '现在手指在上方预览图拖一拖，文字就会跟着移动；移好后按“锁定”才能再滚动页面。', 'Drag on the preview above to move the text. Tap lock when done to scroll the page again.')
          : L3('文字內容可在上面「卡片內文」修改；也可以按方向鍵微調位置。', '文字内容可在上面“卡片内文”修改；也可以按方向键微调位置。', 'Edit the words in “Card text” above; the arrows nudge the position.'))}</div>` : ''}
      ${isStk ? `
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.stkShape)}</div>
        ${chips('pShape', STK_SHAPES, stkShape, 'v')}
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.stkSize)}</div>
        ${chips('pSize', STK_SIZES, stkSize, 'v')}
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.stkPos)}</div>
        ${chips('pPos', STK_POS, stkPos, 'v')}` : ''}
      ${by ? `<div class="muted" style="font-size:11.5px;margin-top:10px">${esc(pl().by + by)}</div>` : ''}
      <div class="hlsheet-acts2" style="margin-top:12px">
        <label class="btn sm" style="cursor:pointer">${esc(L.photoSwap)}<input type="file" accept="image/*" hidden id="pRe"></label>
        <button class="btn sm gold" id="pLib">${esc(pl().libBtn)}</button>
        <button class="btn sm" id="pMy">${esc(L3('📚 我的相片庫', '📚 我的相片库', '📚 My photos'))}</button>
        <button class="btn sm" id="pAi">${esc(L3('✨ AI 生成美圖', '✨ AI 生成美图', '✨ Make with AI'))}</button>
        <button class="btn sm danger" id="pDel">${esc(L.photoDel)}</button>
      </div>` : `
      <button class="btn block gold" id="pLib" style="margin-top:12px">${esc(pl().libBtn)}</button>
      <button class="btn block gold" id="pAi" style="margin-top:8px">${esc(L3('✨ 用 AI 生成美圖（輸入文字就能畫）', '✨ 用 AI 生成美图（输入文字就能画）', '✨ Make a picture with AI (just describe it)'))}</button>
      <button class="btn block" id="pMy" style="margin-top:8px">${esc(L3('📚 我的相片庫（用過的相片都在這裡）', '📚 我的相片库（用过的相片都在这里）', '📚 My photos (everything you used before)'))}</button>
      <label class="btn block" style="cursor:pointer;margin-top:8px">${esc(L.photoPick)}<input type="file" accept="image/*" hidden id="pNew"></label>
      ${isStk && photoImg ? `<button class="btn block" id="pUseBg" style="margin-top:8px">${esc(L.photoUseBg)}</button>` : ''}
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(isStk ? L.photoStkHint : (stkImg ? L.photoHint : L.photoBgHint))}</div>`}`;
    })()}
    </div>

    <div class="section-title">${esc(L.bgm)}</div>
    <div class="card">${bgmBlob ? `
      <div style="font-weight:700;font-size:14px">♪ ${esc(bgmName)}</div>
      ${bgmCredit ? `<div class="muted" style="font-size:11.5px;margin-top:3px">${esc(bgmCredit)}</div>` : ''}
      <button class="btn sm" id="bPrev" style="margin-top:8px">${esc(bgmPrevOn ? L3('⏸ 停止試聽','⏸ 停止试听','⏸ Stop preview') : L3('▶ 試聽','▶ 试听','▶ Preview'))}</button>
      <div class="muted" style="font-size:12px;margin:8px 0 10px">${esc(L.bgmNote)}</div>
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.bgmVol)}</div>
      ${chips('bVol', BGM_VOLS, bgmVol, 'v')}
      <button class="btn block" id="bAi" style="margin-top:12px">${esc(L3('🤖 用 AI 自動生成配樂（免費）','🤖 用 AI 自动生成配乐（免费）','🤖 Make music with AI (free)'))}</button>
      <div class="hlsheet-acts2" style="margin-top:8px">
        <button class="btn sm gold" id="bLib">${esc(hl_().btn)}</button>
        <label class="btn sm" style="cursor:pointer">${esc(L.bgmSwap)}<input type="file" hidden id="bRe"></label>
        <button class="btn sm danger" id="bDel">${esc(L.bgmDel)}</button>
      </div>` : `
      <button class="btn block gold" id="bAi">${esc(L3('🤖 用 AI 自動生成配樂（免費）','🤖 用 AI 自动生成配乐（免费）','🤖 Make music with AI (free)'))}</button>
      <button class="btn block gold" id="bLib" style="margin-top:8px">${esc(hl_().btn)}</button>
      <label class="btn block" style="cursor:pointer;margin-top:8px">${esc(L.bgmPick)}<input type="file" hidden id="bNew"></label>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.bgmHint)}</div>`}
    </div>

    <div class="section-title">${esc(L.recSec)}</div>
    <div class="card" style="text-align:center">
      <div class="muted" style="font-size:12.5px;text-align:left;margin-bottom:10px">${esc(vOK ? L.recIntro : L.recIntroA)}</div>
      ${vOK ? `<div class="cardchips" id="rMode" style="justify-content:center;margin-bottom:6px">
        <button class="${recMode === 'a' ? 'on' : ''}" data-s="a">${esc(L.recVoice)}</button>
        <button class="${recMode === 'c' ? 'on' : ''}" data-s="c">${esc(L.recCard)}</button>
        <button class="${recMode === 's' ? 'on' : ''}" data-s="s">${esc(L.recSelfie)}</button></div>
      <div class="muted" style="font-size:12px;margin-bottom:12px">${esc(
        recMode === 'a' ? L.recVoiceD : recMode === 's' ? L.recSelfieD : L.recCardD)}</div>` : ''}
      <div id="recSt" class="muted" style="font-size:12.5px">${esc(L.recReady)}</div>
      <div id="recTm" style="font-family:var(--f-serif);font-size:30px;margin:6px 0">00:00</div>
      <button class="btn primary block" id="recBtn">${esc(!vOK || recMode === 'a' ? L.recStartA
        : recMode === 's' ? '📷 ' + L.recStartS : L.recStartV)}</button>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.recTip)}</div>
      ${(vOK && bgmBlob) ? `
        <div class="muted" style="font-size:12px;margin:14px 0 6px">${esc(L.mcLen)}</div>
        ${chips('mLen', MC_LENS, mcLen, 'v')}
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L3('製作時','制作时','While making'))}</div>
        ${chips('mHear', [[1, ['邊聽邊製作','边听边制作','Play aloud']], [0, ['靜音製作','静音制作','Silent']]], state.mcHear === false ? 0 : 1, 'v')}
        <button class="btn gold block" id="mcBtn" style="margin-top:10px">🎵 ${esc(L.mcStart)}</button>
        <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.mcHint)}</div>
        <div class="muted" style="font-size:12px;margin-top:6px">${esc(L3('可以先離開這頁去讀經或做別的事（請留在 App 裡、不要鎖屏），做好會通知你，並自動存進「我的作品」。', '可以先离开这页去读经或做别的事（请留在 App 里、不要锁屏），做好会通知你，并自动存进“我的作品”。', 'You can leave this page and keep reading (stay in the app, keep the screen on). You will be notified, and it is saved to My works automatically.'))}</div>` : ''}
      <div id="selfieWrap" style="${isSelfie() ? '' : 'display:none'};margin-top:14px">
        <video id="selfiePrev" playsinline webkit-playsinline muted autoplay
          style="width:150px;height:150px;border-radius:50%;object-fit:cover;transform:scaleX(-1);border:3px solid var(--gold);background:#000"></video>
        <div class="muted" style="font-size:12px;margin-top:6px">${esc(L.selfieHint)}</div>
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.beauty)}</div>
        ${chips('rBeauty', [[1, L.beautyOn], [0, L.beautyOff]], state.beauty ? 1 : 0, 'v')}
        <div class="muted" style="font-size:11.5px;margin-top:6px">${esc(L.beautyHint[state.beauty ? 0 : 1])}</div>
      </div>
      <div id="liveBox" hidden style="margin-top:14px"></div>
    </div>

    <div class="section-title">${esc(L.works)}（${works.length}）</div>
    <div class="card" style="padding:4px 16px">${works.length ? works.map(w => `
      <div class="hitem">
        <div class="q" style="font-size:14px">${esc(w.v || '')}</div>
        <div class="m"><span>${esc(w.r || '')}　${w.kind === 'video' ? '🎬' : '🎙'} ${w.dur || 0}s</span>
          <span><button data-play="${w.id}">▶</button><button data-sh="${w.id}">↗</button><button data-rm="${w.id}">✕</button></span></div>
        <div id="play_${w.id}" style="margin-top:8px"></div>
      </div>`).join('') : `<div class="empty">${esc(L.noWorks)}</div>`}</div>`;

  renderCard(studioItem);
  studioTabs(v, L);
  if (isSelfie()) setTimeout(attachSelfie, 60);

  $('#stBack').onclick = () => { if (EMBED) embedClose(); else appBack(); };
  ['eT', 'eRef'].forEach(id => { const e = $('#' + id); if (!e) return; let tm = null;
    e.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { studioItem[id === 'eT' ? 't' : 'ref'] = e.value; renderCard(studioItem); }, 350); }; });
  $('#btShare').onclick = cardShare;
  $('#btSave').onclick = cardDownload;
  const bind = (sel, fn) => $$(sel, v).forEach(b => b.onclick = () => { fn(b); });
  bind('#cTpl button', b => { state.cardTpl = b.dataset.t; saveState(); studioRefresh(); });
  bind('#cBrd button', b => { state.cardBorder = b.dataset.b; saveState(); studioRefresh(); });
  bind('#cSz  button', b => { state.cardSize = b.dataset.z; saveState(); studioRefresh(); });
  bind('#cFont button', b => { Object.keys(IBF).forEach(k => { if (IBF[k] !== 'ok' && IBF[k] !== 'loading') delete IBF[k]; }); state.cardFont = b.dataset.f; saveState(); studioRefresh(); });
  bind('#cInk button', b => { state.cardInk = b.dataset.c; saveState(); studioRefresh(); });
  const cic = $('#cInkC'); if (cic){
    cic.oninput = () => { state.cardInk = cic.value; renderCardFast(); };
    cic.onchange = () => { state.cardInk = cic.value; saveState(); studioRefresh(); };
  }
  bind('#cFs  button', b => { state.cardFs = +b.dataset.f; saveState(); studioRefresh(); });
  bind('#pMode button', b => { photoMode = b.dataset.m; if (photoMode !== 'orig' && photoMode !== 'full') origMove = false; origDX = origDY = origNX = origNY = 0; studioRefresh(); });
  const fsz = $('#fSz'); if (fsz){
    fsz.oninput = () => { fullScale = fsz.value / 100; const lb = $('#fSzV'); if (lb) lb.textContent = fsz.value + '%'; renderCardFast(); };
    fsz.onchange = () => { renderCard(studioItem); };
  }
  bind('#pFk button', b => { fullKind = b.dataset.v; studioRefresh(); });
  bind('#pShape button', b => { stkShape = b.dataset.v; if (stkShape === 'w' && stkSize < .38) stkSize = .46; studioRefresh(); });
  bind('#pSize button', b => { stkSize = +b.dataset.v; studioRefresh(); });
  bind('#pOSz button', b => { origScale = +b.dataset.v; origDX = origDY = origNX = origNY = 0; studioRefresh(); });
  bind('#pOLay button', b => { origLay = b.dataset.v; origDX = origDY = origNX = origNY = 0; studioRefresh(); });
  bind('#pOSp button', b => { origSplit = b.dataset.v === '1'; if (origSplit){ origNX = origDX; origNY = origDY; } studioRefresh(); });
  bind('#pOTg button', b => { origTarget = b.dataset.v; studioRefresh(); });
  const omT = $('#omTog'); if (omT) omT.onclick = () => { origMove = !origMove; studioRefresh(); };
  const omR = $('#omReset'); if (omR) omR.onclick = () => { origDX = origDY = origNX = origNY = 0; renderCard(studioItem); };
  $$('[data-nudge]', v).forEach(b => b.onclick = () => {
    const [a, c] = b.dataset.nudge.split(',').map(Number);
    origShift(a * 0.025, c * 0.025); renderCard(studioItem); });
  attachOrigDrag();
  bind('#pPos button', b => { stkPos = b.dataset.v; studioRefresh(); });
  bind('#bVol button', b => { bgmVol = +b.dataset.v; studioRefresh(); });
  bind('#mLen button', b => { mcLen = +b.dataset.v; studioRefresh(); });
  bind('#rBeauty button', b => { state.beauty = b.dataset.v === '1'; saveState(); studioRefresh(); });
  bind('#rMode button', b => setRecMode(b.dataset.s));
  const pd = $('#pDel'); if (pd) pd.onclick = () => {
    if (photoMode === 'sticker'){ stkImg = null; stkBy = ''; }
    else { photoImg = null; photoBy = ''; origMove = false; state.photoLast = ''; saveState(); }
    studioRefresh(); };
  const pub = $('#pUseBg'); if (pub) pub.onclick = () => { stkImg = photoImg; stkBy = photoBy; photoImg = null; photoBy = ''; studioRefresh(); };
  const pmy = $('#pMy'); if (pmy) pmy.onclick = openPhotoLib;
  const pl2 = $('#pLib'); if (pl2) pl2.onclick = openPexels;
  const pai = $('#pAi'); if (pai) pai.onclick = openAiGen;
  bgCss(); fillBuiltins();
  const bd = $('#bDel'); if (bd) bd.onclick = () => { bgmPrevStop(); bgmBlob = null; bgmName = ''; bgmCredit = ''; studioRefresh(); };
  const bp = $('#bPrev'); if (bp) bp.onclick = bgmPrevToggle;
  bind('#mHear button', b => { state.mcHear = b.dataset.v === '1'; saveState(); studioRefresh(); });
  const blb = $('#bLib'); if (blb) blb.onclick = openHymns;
  const bai = $('#bAi'); if (bai) bai.onclick = openAiMusic;
  ['pNew','pRe'].forEach(id => { const e = $('#' + id); if (e) e.onchange = () => pickPhoto(e); });
  ['bNew','bRe'].forEach(id => { const e = $('#' + id); if (e) e.onchange = () => pickBgm(e); });
  const nt = $('#cardNote');
  if (nt){
    let tmr = null;
    nt.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { studioNote = nt.value; renderCard(studioItem); }, 400); };
  }
  const on_ = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };   /* 整張原圖模式沒有這些按鈕 */
  on_('blessBtn', blessWrite);
  { const bo = $('#blessOwn'); if (bo) bo.oninput = () => { blessOwn = bo.value; }; }
  on_('fBless', blessWrite);
  on_('fTweak', openTweak);
  on_('fBlessClr', () => { fullBless = ''; studioRefresh(); });
  { const fb = $('#fullBless'); if (fb){ let tm = null; fb.oninput = () => { fullBless = fb.value; clearTimeout(tm); tm = setTimeout(() => renderCard(studioItem), 400); }; } }
  on_('tweakBtn', openTweak);
  on_('noteMine', () => { studioNote = studioItem.n || ''; studioRefresh(); });
  on_('noteClear', () => { studioNote = ''; studioRefresh(); });
  const bindInput = (id, key) => {
    const e = $('#' + id); if (!e) return;
    let tm = null;
    e.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { state[key] = e.value; saveState(); renderCard(studioItem); }, 400); };
  };
  bindInput('cardTo', 'cardTo');
  bindInput('cardGreet', 'cardGreet');
  bindInput('cardTop', 'cardTop');
  bindInput('cardSign', 'cardSign');
  $('#recBtn').onclick = toggleRec;
  const mb = $('#mcBtn'); if (mb) mb.onclick = musicRec;
  bind('[data-play]', b => playRec(b.dataset.play));
  bind('[data-sh]',   b => shareRec(b.dataset.sh));
  bind('[data-rm]',   b => rmRec(b.dataset.rm));
}
function openStudio(h){ studioItem = h; studioNote = h.n || ''; fullBless = ''; blessOwn = ''; go('#/studio');
  setTimeout(() => { try{ document.body.scrollTop = 0; document.documentElement.scrollTop = 0; window.scrollTo(0, 0); }catch(e){} }, 60); }

/* ================================================================ 235 團隊
   兩個人成為屬靈同伴（2），三個人建立屬靈父母兒女的關係（3），
   五重職份成為團隊（5）。一起委身讀經、彼此分享、代禱、關懷問責。
   資料放在自己的 Cloudflare Worker（team-worker.js），只存暱稱、進度數字與文字，
   連不上時就顯示上一次同步下來的內容，讀經本身完全不受影響。 */
const TEAM_L = {
  zh:{
    t235:'235 團隊', mine:'我的團隊', none:'還沒有加入任何團隊',
    intro:'兩個人成為屬靈同伴，三個人建立屬靈父母兒女的關係，五重職份成為團隊。一起委身讀經、彼此分享、代禱、關懷問責。',
    kinds:{ '2':'屬靈同伴', '3':'屬靈父母兒女', '5':'五重職份團隊' },
    kindD:{ '2':'一對一，每天彼此看得見、彼此問責。',
            '3':'屬靈父母帶屬靈兒女，生命傳承。',
            '5':'五重職份的同工團隊，一起服侍。' },
    nick:'我的暱稱', nickPH:'弟兄姊妹怎麼稱呼你', nickHint:'隊友在團隊裡看到的就是這個名字。',
    create:'建立團隊', join:'加入團隊', tname:'團隊名稱', tnamePH:'例：晨光同行',
    ttype:'團隊類型', code:'邀請碼', codePH:'六碼邀請碼', codeHint:'把這六碼給要加入的人，他在「加入團隊」輸入就進來了。',
    copy:'複製邀請碼', copied:'已複製邀請碼', doJoin:'加入', doCreate:'建立',
    needNick:'請先填上你的暱稱', needName:'請填團隊名稱', needCode:'請填六碼邀請碼',
    joined:'已加入團隊', created:'團隊建立好了',
    goal:'讀經目標', noGoal:'還沒有設定共同目標', setGoal:'設定目標', editGoal:'改目標', clearGoal:'取消目標',
    gTypes:{ daily:'每天讀幾章', book:'指定書卷期限', year:'一年讀經計畫', passage:'每天一段共讀' },
    gDailyN:'每天幾章', gBook:'書卷', gDue:'截止日', gPassage:'今天共讀',
    gChapter:'第幾章', gSave:'存下目標', gTitlePH:'目標名稱（可留空）',
    todayDone:'今天讀了', chUnit:n=>`${n} 章`, ofN:(a,b)=>`${a} / ${b}`,
    teamToday:(a,b)=>`全隊 ${b} 人，今天 ${a} 人讀了`,
    tabs:{ feed:'分享', pray:'代禱', wall:'見證牆', reward:'獎勵', member:'成員' },
    shPH:'今天讀到哪一句、神對你說了什麼…', prPH:'寫下代禱事項，隊友會為你禱告…',
    caPH:'寫一句關懷的話…', wiPH:'寫下這次的見證，神在你身上做了什麼…',
    send:'送出', sending:'送出中…', posted:'送出了', amen:'阿們', replyPH:'回應…',
    reply:'回應', delPost:'刪除', delAsk:'要刪掉這一則嗎？',
    noFeed:'還沒有人分享。第一個開口的，往往最蒙恩。',
    noPray:'還沒有代禱事項。', noWall:'見證牆還是空的——達成目標就可以把領受貼上來。',
    careT:'彼此關懷問責', careOk:'全隊這兩天都有讀經，感謝主。',
    careMsg:(n,d)=>`${n} 已經 ${d} 天沒有讀經了`, careGo:'送出關懷', careNew:'今天還沒讀',
    careSent:'關懷送出了', askXZ:'請小智代寫', writing:'小智寫作中…',
    pts:'積分', badge:'徽章', rank:'排行', noBadge:'還沒有徽章，今天讀一章就開始了。',
    reward:'獎勵辦法', addReward:'新增獎勵', rwTitle:'獎勵內容', rwTitlePH:'例：全隊一起吃飯慶祝',
    rwCond:'達成條件', rwCondPH:'例：一個月讀完約翰福音', rwAdd:'加進去', rwGot:'已達成',
    noReward:'隊長還沒有設獎勵。', rwMark:'標記達成',
    owner:'隊長', member:'成員', leave:'離開團隊', leaveAsk:'要離開這個團隊嗎？離開後就看不到團隊的內容了。',
    kick:'請出團隊', kickAsk:'要請這位隊友離開嗎？', rename:'改團隊名稱',
    left:'已離開團隊', syncing:'同步中…', synced:'已同步',
    err:'連不上團隊伺服器', offline:'現在連不上，下面是上次同步的內容。',
    notSet:'團隊功能還沒有設定好：請先照 team-worker.js 的說明建立 Worker。',
    never:'還沒開始讀', dAgo:n=>n===0?'今天':(n===1?'昨天':`${n} 天前`),
    verseFrom:'附上經文', refresh:'重新整理', shareInvite:'邀請隊友'
  },
  zs:{
    t235:'235 团队', mine:'我的团队', none:'还没有加入任何团队',
    intro:'两个人成为属灵同伴，三个人建立属灵父母儿女的关系，五重职份成为团队。一起委身读经、彼此分享、代祷、关怀问责。',
    kinds:{ '2':'属灵同伴', '3':'属灵父母儿女', '5':'五重职份团队' },
    kindD:{ '2':'一对一，每天彼此看得见、彼此问责。',
            '3':'属灵父母带属灵儿女，生命传承。',
            '5':'五重职份的同工团队，一起服侍。' },
    nick:'我的昵称', nickPH:'弟兄姊妹怎么称呼你', nickHint:'队友在团队里看到的就是这个名字。',
    create:'建立团队', join:'加入团队', tname:'团队名称', tnamePH:'例：晨光同行',
    ttype:'团队类型', code:'邀请码', codePH:'六码邀请码', codeHint:'把这六码给要加入的人，他在“加入团队”输入就进来了。',
    copy:'复制邀请码', copied:'已复制邀请码', doJoin:'加入', doCreate:'建立',
    needNick:'请先填上你的昵称', needName:'请填团队名称', needCode:'请填六码邀请码',
    joined:'已加入团队', created:'团队建立好了',
    goal:'读经目标', noGoal:'还没有设定共同目标', setGoal:'设定目标', editGoal:'改目标', clearGoal:'取消目标',
    gTypes:{ daily:'每天读几章', book:'指定书卷期限', year:'一年读经计划', passage:'每天一段共读' },
    gDailyN:'每天几章', gBook:'书卷', gDue:'截止日', gPassage:'今天共读',
    gChapter:'第几章', gSave:'存下目标', gTitlePH:'目标名称（可留空）',
    todayDone:'今天读了', chUnit:n=>`${n} 章`, ofN:(a,b)=>`${a} / ${b}`,
    teamToday:(a,b)=>`全队 ${b} 人，今天 ${a} 人读了`,
    tabs:{ feed:'分享', pray:'代祷', wall:'见证墙', reward:'奖励', member:'成员' },
    shPH:'今天读到哪一句、神对你说了什么…', prPH:'写下代祷事项，队友会为你祷告…',
    caPH:'写一句关怀的话…', wiPH:'写下这次的见证，神在你身上做了什么…',
    send:'送出', sending:'送出中…', posted:'送出了', amen:'阿们', replyPH:'回应…',
    reply:'回应', delPost:'删除', delAsk:'要删掉这一则吗？',
    noFeed:'还没有人分享。第一个开口的，往往最蒙恩。',
    noPray:'还没有代祷事项。', noWall:'见证墙还是空的——达成目标就可以把领受贴上来。',
    careT:'彼此关怀问责', careOk:'全队这两天都有读经，感谢主。',
    careMsg:(n,d)=>`${n} 已经 ${d} 天没有读经了`, careGo:'送出关怀', careNew:'今天还没读',
    careSent:'关怀送出了', askXZ:'请小智代写', writing:'小智写作中…',
    pts:'积分', badge:'徽章', rank:'排行', noBadge:'还没有徽章，今天读一章就开始了。',
    reward:'奖励办法', addReward:'新增奖励', rwTitle:'奖励内容', rwTitlePH:'例：全队一起吃饭庆祝',
    rwCond:'达成条件', rwCondPH:'例：一个月读完约翰福音', rwAdd:'加进去', rwGot:'已达成',
    noReward:'队长还没有设奖励。', rwMark:'标记达成',
    owner:'队长', member:'成员', leave:'离开团队', leaveAsk:'要离开这个团队吗？离开后就看不到团队的内容了。',
    kick:'请出团队', kickAsk:'要请这位队友离开吗？', rename:'改团队名称',
    left:'已离开团队', syncing:'同步中…', synced:'已同步',
    err:'连不上团队服务器', offline:'现在连不上，下面是上次同步的内容。',
    notSet:'团队功能还没有设定好：请先照 team-worker.js 的说明建立 Worker。',
    never:'还没开始读', dAgo:n=>n===0?'今天':(n===1?'昨天':`${n} 天前`),
    verseFrom:'附上经文', refresh:'重新整理', shareInvite:'邀请队友'
  },
  en:{
    t235:'235 Team', mine:'My teams', none:'You have not joined a team yet',
    intro:'Two become spiritual partners, three build the spiritual parent-and-child relationship, and the five-fold ministry becomes a team. Read the Bible together, share, pray for one another, and hold each other in loving accountability.',
    kinds:{ '2':'Spiritual partner', '3':'Spiritual parent & child', '5':'Five-fold team' },
    kindD:{ '2':'One to one — you see each other every day.',
            '3':'A spiritual parent walking with a spiritual child.',
            '5':'A five-fold ministry team serving together.' },
    nick:'My name', nickPH:'What your team calls you', nickHint:'This is the name your team will see.',
    create:'Create a team', join:'Join a team', tname:'Team name', tnamePH:'e.g. Morning Light',
    ttype:'Team type', code:'Invite code', codePH:'6-character code', codeHint:'Give these six characters to whoever is joining.',
    copy:'Copy invite code', copied:'Invite code copied', doJoin:'Join', doCreate:'Create',
    needNick:'Please enter your name first', needName:'Please enter a team name', needCode:'Please enter the 6-character code',
    joined:'Joined the team', created:'Team created',
    goal:'Reading goal', noGoal:'No shared goal yet', setGoal:'Set a goal', editGoal:'Edit goal', clearGoal:'Remove goal',
    gTypes:{ daily:'Chapters per day', book:'A book by a deadline', year:'Bible in a year', passage:'Today’s shared passage' },
    gDailyN:'Chapters a day', gBook:'Book', gDue:'Due date', gPassage:'Read together today',
    gChapter:'Chapter', gSave:'Save goal', gTitlePH:'Goal name (optional)',
    todayDone:'Read today', chUnit:n=>`${n} ch.`, ofN:(a,b)=>`${a} / ${b}`,
    teamToday:(a,b)=>`${a} of ${b} have read today`,
    tabs:{ feed:'Sharing', pray:'Prayer', wall:'Testimony', reward:'Rewards', member:'Members' },
    shPH:'What did God say to you today…', prPH:'Write your prayer request — your team will pray…',
    caPH:'Write a word of care…', wiPH:'Write your testimony — what has God done…',
    send:'Send', sending:'Sending…', posted:'Sent', amen:'Amen', replyPH:'Reply…',
    reply:'Reply', delPost:'Delete', delAsk:'Delete this post?',
    noFeed:'Nothing shared yet. The first to speak is often the most blessed.',
    noPray:'No prayer requests yet.', noWall:'The testimony wall is empty — reach a goal and post what you received.',
    careT:'Caring accountability', careOk:'Everyone has read in the last two days. Praise God.',
    careMsg:(n,d)=>`${n} has not read for ${d} days`, careGo:'Send care', careNew:'Not read today',
    careSent:'Your care was sent', askXZ:'Let Xiaozhi write it', writing:'Xiaozhi is writing…',
    pts:'Points', badge:'Badges', rank:'Ranking', noBadge:'No badges yet — one chapter today starts it.',
    reward:'Rewards', addReward:'Add a reward', rwTitle:'Reward', rwTitlePH:'e.g. A meal together',
    rwCond:'Condition', rwCondPH:'e.g. Finish John in a month', rwAdd:'Add', rwGot:'Achieved',
    noReward:'The leader has not set any rewards yet.', rwMark:'Mark as achieved',
    owner:'Leader', member:'Member', leave:'Leave team', leaveAsk:'Leave this team? You will no longer see its content.',
    kick:'Remove', kickAsk:'Remove this member from the team?', rename:'Rename team',
    left:'You left the team', syncing:'Syncing…', synced:'Synced',
    err:'Cannot reach the team server', offline:'Offline — showing the last synced content.',
    notSet:'The team server is not set up yet — follow the instructions in team-worker.js.',
    never:'Not started', dAgo:n=>n===0?'today':(n===1?'yesterday':`${n} days ago`),
    verseFrom:'Attach the verse', refresh:'Refresh', shareInvite:'Invite'
  }
};
const tl = () => TEAM_L[state.lang] || (isX() ? TEAM_L.en : TEAM_L.zh);

/* 積分：讀經最重，分享代禱關懷次之。全部由紀錄算出來，不另外累加，才不會算錯。 */
const PT = { ch:2, share:5, pray:3, care:3, witness:8 };
/* 徽章：只看得勝的軌跡，不比誰多誰少 */
const BADGES = [
  { id:'d7',    i:'🌱', n:['無己七日','无己七日','Seven Days'],        f:s => s.streak >= 7 },
  { id:'d30',   i:'🌿', n:['同行三十天','同行三十天','Thirty Days'],    f:s => s.streak >= 30 },
  { id:'d100',  i:'🌳', n:['百日不斷','百日不断','A Hundred Days'],      f:s => s.streak >= 100 },
  { id:'ch50',  i:'📖', n:['五十章','五十章','50 Chapters'],            f:s => s.chs >= 50 },
  { id:'ch200', i:'📚', n:['兩百章','两百章','200 Chapters'],           f:s => s.chs >= 200 },
  { id:'chAll', i:'👑', n:['讀完全本','读完全本','Whole Bible'],         f:s => s.chs >= 1189 },
  { id:'sh10',  i:'💬', n:['樂意分享','乐意分享','Ten Shares'],          f:s => (s.acts.share || 0) >= 10 },
  { id:'pr10',  i:'🙏', n:['代禱的手','代祷的手','Ten Prayers'],         f:s => (s.acts.pray || 0) >= 10 },
  { id:'ca10',  i:'🤝', n:['彼此關懷','彼此关怀','Ten Cares'],   f:s => (s.acts.care || 0) >= 10 },
  { id:'wi1',   i:'✨', n:['第一個見證','第一个见证','First Testimony'], f:s => (s.acts.witness || 0) >= 1 }
];
const badgeName = b => isX() ? koT(b.n[0], b.n[2]) : isEN() ? b.n[2] : (isZS() ? b.n[1] : b.n[0]);

let TEAM = { code:null, data:null, err:'', busy:false, sub:'feed' };

function dayKey(ts){
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function daysBetween(a, b){ return Math.floor((b - a) / 86400000); }
/* 我的讀經狀態：全部從 user.progress 的時間戳算出來 */
function myStat(){
  const byDay = {};
  const vals = Object.values(user.progress);
  vals.forEach(ts => { const d = dayKey(ts); byDay[d] = (byDay[d] || 0) + 1; });
  const today = dayKey(Date.now());
  let streak = 0;
  const cur = new Date();
  if (!byDay[today]) cur.setDate(cur.getDate() - 1);
  while (byDay[dayKey(cur.getTime())]){ streak++; cur.setDate(cur.getDate() - 1); }
  const lastTs = vals.length ? Math.max.apply(null, vals) : 0;
  const lb = user.last && BOOK[user.last.book];
  return {
    days: Object.keys(byDay).length, streak, chs: vals.length, today: byDay[today] || 0,
    last: lb ? `${bname(lb)} ${user.last.ch}` : '', lastTs,
    acts: user.acts || {}, goalN: 0,
    plan: myPlanStat()   // v2.15.0 陪讀同步；v2.22.4 起另附 all＝每個計畫的摘要
  };
}
function myPlanStat(){
  const P = user.plan || {};
  const all = {};
  /* 讀經計畫資料已載入就現算（最準），否則用上次記下的摘要 */
  if (PLANS) PLAN_IDS.forEach(id => { const p = PLANS[id]; if (p && (planDoneCount(id) > 0 || (P.starts && P.starts[id]))) all[id] = planSumOf(p); });
  else Object.assign(all, P.sums || {});
  const cur = (P.active && (all[P.active] || (P.sum && P.sum.id === P.active && P.sum))) || null;
  if (!cur && !Object.keys(all).length) return null;
  const base = cur ? Object.assign({}, cur) : { id:'' };
  base.all = all;
  return base;
}
function myPts(){
  const s = myStat(), a = user.acts || {};
  return s.chs * PT.ch + (a.share || 0) * PT.share + (a.pray || 0) * PT.pray
       + (a.care || 0) * PT.care + (a.witness || 0) * PT.witness;
}
function myBadges(){ const s = myStat(); return BADGES.filter(b => b.f(s)).map(b => b.id); }
function bumpAct(kind){
  user.acts = user.acts || {};
  user.acts[kind] = (user.acts[kind] || 0) + 1;
  saveUser();
}
/* 對團隊目標的進度：{done, need, label} */
function goalNow(goal, stat){
  const L = tl();
  if (!goal) return null;
  if (goal.type === 'daily'){
    const need = Math.max(1, goal.n || 1);
    return { done: Math.min(stat.today, need), need, label: `${L.todayDone} ${L.ofN(stat.today, need)}` };
  }
  if (goal.type === 'book'){
    const b = BOOK[goal.book];
    if (!b) return { done:0, need:1, label:'—' };
    let n = 0;
    for (let c = 1; c <= b.ch; c++) if (user.progress[goal.book + '-' + c]) n++;
    return { done:n, need:b.ch, label: `${bname(b)} ${L.ofN(n, b.ch)}` };
  }
  if (goal.type === 'year'){
    const start = goal.ts || Date.now();
    const elapsed = Math.max(1, daysBetween(start, Date.now()) + 1);
    const should = Math.min(1189, Math.round(1189 * elapsed / 365));
    return { done: Math.min(stat.chs, 1189), need: 1189,
             label: `${L.ofN(stat.chs, 1189)}　→ ${should}` };
  }
  if (goal.type === 'passage'){
    const b = BOOK[goal.book], c = Math.max(1, goal.n || 1);
    const done = user.progress[goal.book + '-' + c] ? 1 : 0;
    return { done, need:1, label: b ? `${bname(b)} ${chapLabel(goal.book, c)}` : '—' };
  }
  return null;
}
function goalTitle(goal){
  const L = tl();
  if (!goal) return '';
  if (goal.title) return goal.title;
  if (goal.type === 'daily')   return L.gTypes.daily + '：' + L.chUnit(goal.n || 1);
  if (goal.type === 'book')    return (BOOK[goal.book] ? bname(BOOK[goal.book]) : goal.book)
                                    + (goal.due ? '　→ ' + new Date(goal.due).toLocaleDateString() : '');
  if (goal.type === 'year')    return L.gTypes.year;
  if (goal.type === 'passage') return L.gPassage + '：' + (BOOK[goal.book] ? bname(BOOK[goal.book]) : goal.book)
                                    + ' ' + chapLabel(goal.book, goal.n || 1);
  return '';
}

/* ---- 伺服器 ---- */
async function teamApi(op, extra){
  const body = Object.assign({ op, uid:user.uid, nick:(user.nick || '').trim() }, extra || {});
  let r;
  try{ r = await fetch(API.team, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body), keepalive:true }); }
  catch(e){ throw new Error(tl().err); }
  let j = null;
  try{ j = await r.json(); }catch(e){}
  if (!j) throw new Error(tl().err + '（HTTP ' + r.status + '）');
  if (!j.ok) throw new Error(j.err || ('HTTP ' + r.status));
  return j;
}
/* 進團隊就把自己的進度送上去，順便把整個團隊抓下來 */
async function teamPull(code, op, extra){
  const stat = myStat();
  const j = await teamApi(op || 'sync', Object.assign({
    code, stat, pts: myPts(), badges: myBadges()
  }, extra || {}));
  if (j.team){
    TEAM.code = j.team.code; TEAM.data = j.team; TEAM.err = '';
    teamRemember(j.team);
    try{ localStorage.setItem('ib_team_' + j.team.code, JSON.stringify(j.team)); }catch(e){}
  }
  return j;
}
function teamCached(code){
  if (TEAM.data && TEAM.code === code) return TEAM.data;
  try{ return JSON.parse(localStorage.getItem('ib_team_' + code) || 'null'); }catch(e){ return null; }
}
function teamRemember(tm){
  user.teams = (user.teams || []).filter(x => x.code !== tm.code);
  user.teams.push({ code:tm.code, name:tm.name, kind:tm.kind });
  saveUser();
}
function teamForget(code){
  user.teams = (user.teams || []).filter(x => x.code !== code);
  saveUser();
  try{ localStorage.removeItem('ib_team_' + code); }catch(e){}
}
const defNick = () => (user.nick || '').trim();

/* 讀完一章就悄悄把進度送給隊友（延遲合併，不要一章一次請求）。
   失敗就算了——讀經本身絕不能被團隊功能拖住。 */
let teamPingTimer = null;
function teamPingSoon(ms){
  if (!(user.teams || []).length) return;
  clearTimeout(teamPingTimer);
  teamPingTimer = setTimeout(() => { teamPingTimer = null; teamPingNow(); }, ms || 20000);
}
async function teamPingNow(){
  for (const x of (user.teams || []).slice(0, 8)){
    try{ await teamPull(x.code); }catch(e){}
  }
  if (curTeamCode() && TEAM.data) paintTeam($('#view'));
}

/* ================================================================ 團隊：首頁 */
async function viewTeam(v, code, sub){
  if (code) return viewTeamRoom(v, code.toUpperCase(), sub || 'feed');
  const L = tl(), Lb = t();
  const groups = ['2', '3', '5'].map(k => {
    const list = (user.teams || []).filter(x => String(x.kind) === k);
    return `<div class="section-title">${k}　${esc(L.kinds[k])}</div>
      <div class="card" style="padding:12px 14px">
        <div class="muted" style="font-size:12.5px;margin-bottom:${list.length ? '10px' : '0'}">${esc(L.kindD[k])}</div>
        ${list.map(x => `<div class="rowlink" data-open="${esc(x.code)}">
            <div class="tmavatar">${esc((x.name || '?').slice(0, 1))}</div>
            <div class="meta"><div class="t">${esc(x.name)}</div><div class="s">${esc(x.code)}</div></div>
            <div class="chev">›</div></div>`).join('')}
      </div>`;
  }).join('');

  v.innerHTML = `
    <div class="card" style="background:var(--accent-soft); border-color:var(--accent)">
      <h3 style="color:var(--accent-ink)">${esc(L.t235)}</h3>
      <div class="muted" style="line-height:1.9">${esc(L.intro)}</div>
    </div>

    <div class="section-title">${esc(L.nick)}</div>
    <div class="card">
      <input class="cardinput" id="tmNick" value="${esc(user.nick || '')}" placeholder="${esc(L.nickPH)}">
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.nickHint)}</div>
    </div>

    <div class="section-title">${esc(L.mine)}</div>
    ${(user.teams || []).length ? groups : `<div class="card"><div class="muted">${esc(L.none)}</div></div>${groups}`}

    <div class="section-title">${esc(L.create)}</div>
    <div class="card">
      <input class="cardinput" id="tmName" placeholder="${esc(L.tnamePH)}">
      <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.ttype)}</div>
      <div class="cardchips" id="tmKind">
        ${['2', '3', '5'].map(k => `<button data-k="${k}" class="${k === '5' ? 'on' : ''}">${k}　${esc(L.kinds[k])}</button>`).join('')}
      </div>
      <button class="btn primary block" id="tmCreate" style="margin-top:12px">${esc(L.doCreate)}</button>
    </div>

    <div class="section-title">${esc(L.join)}</div>
    <div class="card">
      <input class="cardinput" id="tmCode" placeholder="${esc(L.codePH)}" maxlength="6"
             style="text-transform:uppercase; letter-spacing:.3em; text-align:center; font-weight:700">
      <button class="btn block" id="tmJoin" style="margin-top:12px">${esc(L.doJoin)}</button>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.codeHint)}</div>
    </div>`;

  const nk = $('#tmNick', v);
  nk.oninput = () => { user.nick = nk.value; saveUser(); };
  $$('[data-open]', v).forEach(e => e.onclick = () => go('#/team/' + e.dataset.open));
  let kind = '5';
  $$('#tmKind button', v).forEach(b => b.onclick = () => {
    kind = b.dataset.k;
    $$('#tmKind button', v).forEach(x => x.classList.toggle('on', x === b));
  });
  $('#tmCreate', v).onclick = async () => {
    if (!defNick()) return toast(L.needNick);
    const name = $('#tmName', v).value.trim();
    if (!name) return toast(L.needName);
    const btn = $('#tmCreate', v); btn.disabled = true; btn.textContent = L.syncing;
    try{
      const j = await teamPull(null, 'create', { name, kind });
      toast(L.created);
      go('#/team/' + j.team.code);
    }catch(e){ toast(e.message, 4000); btn.disabled = false; btn.textContent = L.doCreate; }
  };
  $('#tmJoin', v).onclick = async () => {
    if (!defNick()) return toast(L.needNick);
    const code = ($('#tmCode', v).value || '').trim().toUpperCase();
    if (code.length !== 6) return toast(L.needCode);
    const btn = $('#tmJoin', v); btn.disabled = true; btn.textContent = L.syncing;
    try{
      await teamPull(code, 'join');
      toast(L.joined);
      go('#/team/' + code);
    }catch(e){ toast(e.message, 4000); btn.disabled = false; btn.textContent = L.doJoin; }
  };
}

/* ================================================================ 團隊：團隊裡面 */
const TM_SUBS = ['feed', 'pray', 'wall', 'reward', 'member'];
function memberList(tm){
  return Object.entries(tm.members || {}).map(([uid, m]) => Object.assign({ uid }, m));
}
function memberNick(tm, uid){
  const m = (tm.members || {})[uid];
  return m ? (m.nick || '?') : '？';
}
/* 幾天沒讀了；沒有紀錄就回 999 */
function idleDays(m){
  const ts = (m.stat && m.stat.lastTs) || 0;
  if (!ts) return 999;
  return Math.max(0, daysBetween(+ts, Date.now()));
}

async function viewTeamRoom(v, code, sub){
  const L = tl();
  TEAM.sub = TM_SUBS.includes(sub) ? sub : 'feed';
  const cached = teamCached(code);
  if (cached){ TEAM.code = code; TEAM.data = cached; paintTeam(v); }
  else v.innerHTML = `<div class="empty">${esc(L.syncing)}</div>`;
  try{
    await teamPull(code);
    if (curTeamCode() === code) paintTeam(v);
  }catch(e){
    TEAM.err = e.message;
    if (curTeamCode() === code){
      if (TEAM.data && TEAM.code === code) paintTeam(v);
      else v.innerHTML = `<div class="empty">${esc(e.message)}</div>
        <div class="card"><div class="muted">${esc(L.notSet)}</div></div>`;
    }
  }
}
function curTeamCode(){
  const r = currentRoute();
  return r[0] === 'team' && r[1] ? r[1].toUpperCase() : null;
}
async function teamRefresh(){
  const v = $('#view');
  if (curTeamCode() !== TEAM.code) return;
  try{ await teamPull(TEAM.code); TEAM.err = ''; }catch(e){ TEAM.err = e.message; }
  if (curTeamCode() === TEAM.code) paintTeam(v);
}

function paintTeam(v){
  const L = tl(), tm = TEAM.data;
  if (!tm) return;
  const me = (tm.members || {})[user.uid] || {};
  const owner = tm.owner === user.uid;
  const mem = memberList(tm).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const stat = myStat();
  const g = goalNow(tm.goal, stat);
  const readToday = mem.filter(m => (m.stat && m.stat.today) > 0).length;
  const y = window.scrollY;

  /* 今天還沒讀、或好幾天沒讀的隊友 */
  const idle = mem.filter(m => m.uid !== user.uid && idleDays(m) >= 2)
                  .sort((a, b) => idleDays(b) - idleDays(a));

  v.innerHTML = `
    <div class="chtoolbar">
      <button class="chtb-btn navlbl" id="tmBack" title="${esc(L3('上一頁', '上一页', 'Back'))}">‹ ${esc(L3('上一頁', '上一页', 'Back'))}</button>
      <div class="tmtitle">${esc(tm.name)}<span class="tmkind">${esc(tm.kind)}　${esc(L.kinds[tm.kind] || '')}</span></div>
      <div class="chtb-spacer"></div>
      <button class="chtb-btn" id="tmSync" title="${esc(L.refresh)}">⟳</button>
    </div>
    ${TEAM.err ? `<div class="hl-hint">${esc(L.offline)}</div>` : ''}

    <div class="card tmgoal">
      <div class="tmgoalhead">
        <div class="tmgoalt${tm.goal && tm.goal.book && (tm.goal.type === 'book' || tm.goal.type === 'passage') ? ' link' : ''}"
             ${tm.goal && tm.goal.book ? `id="tmGoalGo" data-b="${esc(tm.goal.book)}" data-c="${tm.goal.type === 'passage' ? (tm.goal.n || 1) : 1}"` : ''}
             >${esc(tm.goal ? goalTitle(tm.goal) : L.noGoal)}</div>
        ${owner ? `<button class="btn sm" id="tmGoalBtn">${esc(tm.goal ? L.editGoal : L.setGoal)}</button>` : ''}
      </div>
      ${g ? `<div class="tmbar"><i style="width:${Math.round(Math.min(1, g.done / Math.max(1, g.need)) * 100)}%"></i></div>
             <div class="muted" style="font-size:12.5px;margin-top:6px">${esc(g.label)}</div>` : ''}
      <div class="tmfaces">
        ${mem.map(m => {
          const on = (m.stat && m.stat.today) > 0;
          return `<div class="tmface ${on ? 'on' : ''}" data-mem="${esc(m.uid)}" title="${esc(m.nick || '')}">
                    <span>${esc((m.nick || '?').slice(0, 1))}</span>
                    <b>${esc((m.nick || '').slice(0, 4))}</b></div>`;
        }).join('')}
      </div>
      <div class="muted" style="font-size:12.5px">${esc(L.teamToday(readToday, mem.length))}</div>
    </div>

    ${idle.length ? `<div class="card tmcare">
      <div class="tmcareT">${esc(L.careT)}</div>
      ${idle.map(m => `<div class="tmcarerow">
          <div>${esc(idleDays(m) > 900 ? `${m.nick || '?'}　${L.never}` : L.careMsg(m.nick || '?', idleDays(m)))}</div>
          <button class="btn sm gold" data-care="${esc(m.uid)}">${esc(L.careGo)}</button>
        </div>`).join('')}
      </div>` : `<div class="card tmcare ok"><div class="muted">${esc(L.careOk)}</div></div>`}

    <div class="cardchips tmsubs" id="tmSubs">
      ${TM_SUBS.map(s => `<button data-s="${s}" class="${s === TEAM.sub ? 'on' : ''}">${esc(L.tabs[s])}</button>`).join('')}
    </div>
    <div id="tmBody"></div>`;

  $('#tmBack').onclick = () => appBack('#/team');
  $('#tmSync').onclick = () => { toast(L.syncing); teamRefresh(); };
  const gb = $('#tmGoalBtn'); if (gb) gb.onclick = () => openGoalSheet(tm);
  const gg = $('#tmGoalGo');
  if (gg && gg.classList.contains('link')) gg.onclick = () => go(`#/read/${gg.dataset.b}/${gg.dataset.c}`);
  $$('#tmSubs button').forEach(b => b.onclick = () => { TEAM.sub = b.dataset.s; paintTeam(v); });
  $$('[data-care]').forEach(b => b.onclick = () => openCareSheet(tm, b.dataset.care));
  $$('[data-mem]').forEach(b => b.onclick = () => { TEAM.sub = 'member'; paintTeam(v); });

  paintTeamBody(tm, owner, mem);
  window.scrollTo(0, y);
}

function composer(kind, ph){
  const L = tl();
  return `<div class="card tmcomp">
    <textarea class="hlsheet-ta" id="tmText" placeholder="${esc(ph)}"></textarea>
    <div class="hlsheet-acts2">
      <button class="btn sm primary" id="tmSend" data-k="${kind}">${esc(L.send)}</button>
      <button class="btn sm gold" id="tmAI">✍️ ${esc(L.askXZ)}</button>
      ${lastHl() ? `<button class="btn sm" id="tmVerse">📖 ${esc(L.verseFrom)}</button>` : ''}
    </div>
  </div>`;
}
/* 最近畫的那一句，可以一鍵附進分享裡 */
function lastHl(){
  const all = Object.values(user.hl || {});
  if (!all.length) return null;
  return all.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
}
function paintTeamBody(tm, owner, mem){
  const L = tl(), box = $('#tmBody');
  if (!box) return;
  const sub = TEAM.sub;

  if (sub === 'member'){
    box.innerHTML = `
      <div class="section-title">${esc(L.rank)}</div>
      <div class="card">${mem.map((m, i) => {
        const bs = (m.badges || []).map(id => BADGES.find(b => b.id === id)).filter(Boolean);
        const idl = idleDays(m);
        return `<div class="tmmem">
          <div class="tmrank">${i + 1}</div>
          <div class="tmavatar">${esc((m.nick || '?').slice(0, 1))}</div>
          <div class="meta">
            <div class="t">${esc(m.nick || '?')}${m.uid === tm.owner ? ` <span class="pill">${esc(L.owner)}</span>` : ''}</div>
            <div class="s">${esc(L.pts)} ${m.pts || 0}　·　${esc(idl > 900 ? L.never : L.dAgo(idl))}${m.stat && m.stat.streak ? `　·　🔥${m.stat.streak}` : ''}</div>
            ${m.stat && m.stat.plan && PLANS && PLANS[m.stat.plan.id] ? `<div class="s">📖 ${esc(planTitle(PLANS[m.stat.plan.id]))}　${m.stat.plan.done}/${m.stat.plan.total}</div>` : ''}
            ${bs.length ? `<div class="tmbadges">${bs.map(b => `<span title="${esc(badgeName(b))}">${b.i}</span>`).join('')}</div>` : ''}
          </div>
          ${owner && m.uid !== user.uid ? `<button class="btn sm" data-kick="${esc(m.uid)}">${esc(L.kick)}</button>` : ''}
        </div>`;
      }).join('')}</div>
      <div class="section-title">${esc(L.badge)}</div>
      <div class="card">${(() => {
        const mine = myBadges();
        return mine.length
          ? `<div class="tmbadgelist">${BADGES.filter(b => mine.includes(b.id))
              .map(b => `<div class="tmbadge"><span>${b.i}</span><b>${esc(badgeName(b))}</b></div>`).join('')}</div>`
          : `<div class="muted">${esc(L.noBadge)}</div>`;
      })()}</div>
      <div class="card">
        <div class="muted" style="font-size:12.5px;margin-bottom:10px">${esc(L.code)}：<b style="letter-spacing:.3em;font-size:16px;color:var(--accent)">${esc(tm.code)}</b></div>
        <div class="hlsheet-acts2">
          <button class="btn sm" id="tmCopy">${esc(L.copy)}</button>
          ${owner ? `<button class="btn sm" id="tmRename">${esc(L.rename)}</button>` : ''}
          <button class="btn sm danger" id="tmLeave">${esc(L.leave)}</button>
        </div>
      </div>`;
    $$('[data-kick]', box).forEach(b => b.onclick = async () => {
      if (!confirm(L.kickAsk)) return;
      try{ await teamPull(tm.code, 'kick', { target:b.dataset.kick }); paintTeam($('#view')); }catch(e){ toast(e.message); }
    });
    $('#tmCopy', box).onclick = () => {
      try{ navigator.clipboard.writeText(tm.code); toast(L.copied); }catch(e){ toast(tm.code); }
    };
    const rn = $('#tmRename', box);
    if (rn) rn.onclick = async () => {
      const name = prompt(L.tname, tm.name);
      if (!name) return;
      try{ await teamPull(tm.code, 'rename', { name }); paintTeam($('#view')); }catch(e){ toast(e.message); }
    };
    $('#tmLeave', box).onclick = async () => {
      if (!confirm(L.leaveAsk)) return;
      try{ await teamApi('leave', { code:tm.code }); }catch(e){}
      teamForget(tm.code); TEAM = { code:null, data:null, err:'', busy:false, sub:'feed' };
      toast(L.left); go('#/team');
    };
    return;
  }

  if (sub === 'reward'){
    const rw = tm.rewards || [];
    box.innerHTML = `
      ${owner ? `<div class="card">
        <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.rwTitle)}</div>
        <input class="cardinput" id="rwT" placeholder="${esc(L.rwTitlePH)}">
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.rwCond)}</div>
        <input class="cardinput" id="rwC" placeholder="${esc(L.rwCondPH)}">
        <button class="btn primary block" id="rwAdd" style="margin-top:12px">${esc(L.rwAdd)}</button>
      </div>` : ''}
      ${rw.length ? rw.map(r => `<div class="card tmrw">
          <div class="tmrwT">🎁 ${esc(r.title || '')}</div>
          ${r.cond ? `<div class="muted" style="font-size:12.5px;margin-top:4px">${esc(r.cond)}</div>` : ''}
          ${(r.got || []).length ? `<div class="tmgot">${esc(L.rwGot)}：${(r.got || []).map(u => esc(memberNick(tm, u))).join('、')}</div>` : ''}
          ${owner ? `<div class="hlsheet-acts2" style="margin-top:10px">
             ${memberList(tm).map(m => `<button class="btn sm ${(r.got || []).includes(m.uid) ? 'gold' : ''}"
                data-got="${esc(r.id)}" data-who="${esc(m.uid)}">${esc(m.nick || '?')}</button>`).join('')}
             <button class="btn sm danger" data-rwdel="${esc(r.id)}">${esc(L.delPost)}</button></div>` : ''}
        </div>`).join('') : `<div class="card"><div class="muted">${esc(L.noReward)}</div></div>`}`;
    const ad = $('#rwAdd', box);
    if (ad) ad.onclick = async () => {
      const title = $('#rwT', box).value.trim();
      if (!title) return toast(L.rwTitlePH);
      try{ await teamPull(tm.code, 'reward', { title, cond: $('#rwC', box).value.trim() }); paintTeam($('#view')); }
      catch(e){ toast(e.message); }
    };
    $$('[data-got]', box).forEach(b => b.onclick = async () => {
      try{ await teamPull(tm.code, 'reward', { done:b.dataset.got, who:b.dataset.who }); paintTeam($('#view')); }
      catch(e){ toast(e.message); }
    });
    $$('[data-rwdel]', box).forEach(b => b.onclick = async () => {
      if (!confirm(L.delAsk)) return;
      try{ await teamPull(tm.code, 'reward', { del:b.dataset.rwdel }); paintTeam($('#view')); }catch(e){ toast(e.message); }
    });
    return;
  }

  /* 分享／代禱／見證牆——同一套動態，只是種類不同 */
  const kind = sub === 'pray' ? 'pray' : (sub === 'wall' ? 'witness' : 'share');
  const ph   = sub === 'pray' ? L.prPH : (sub === 'wall' ? L.wiPH : L.shPH);
  const empty= sub === 'pray' ? L.noPray : (sub === 'wall' ? L.noWall : L.noFeed);
  const list = (tm.feed || []).filter(f => (kind === 'share' ? (f.kind === 'share' || f.kind === 'care' || f.kind === 'sys') : f.kind === kind));

  box.innerHTML = composer(kind, ph) + (list.length ? list.map(f => feedHTML(tm, f)).join('')
                 : `<div class="empty">${esc(empty)}</div>`);
  bindComposer(tm, kind);
  bindFeed(tm);
}
const FEED_ICON = { share:'💬', pray:'🙏', care:'🤝', witness:'✨', sys:'·' };
const feedText = f => (f.kind === 'sys' && (f.text === 'join' || f.text === '加入了團隊'))
                    ? tl().joined : (f.text || '');
function feedHTML(tm, f){
  const L = tl();
  const mine = f.uid === user.uid;
  const when = new Date(f.ts).toLocaleString();
  return `<div class="card tmpost">
    <div class="tmposthead">
      <div class="tmavatar sm">${esc(memberNick(tm, f.uid).slice(0, 1))}</div>
      <div class="meta"><div class="t">${FEED_ICON[f.kind] || ''} ${esc(memberNick(tm, f.uid))}${f.to ? ' → ' + esc(memberNick(tm, f.to)) : ''}</div>
      <div class="s">${esc(when)}</div></div>
    </div>
    ${f.verse ? `<div class="tmverse">${esc(f.verse)}${f.ref ? `<span class="tmref">${esc(f.ref)}</span>` : ''}</div>`
              : (f.ref ? `<div class="tmref solo">${esc(f.ref)}</div>` : '')}
    <div class="tmtext">${esc(feedText(f))}</div>
    <div class="tmacts">
      <button class="tmact ${(f.amen || []).includes(user.uid) ? 'on' : ''}" data-amen="${esc(f.id)}">🙏 ${esc(L.amen)}${(f.amen || []).length ? ' ' + (f.amen || []).length : ''}</button>
      <button class="tmact" data-rep="${esc(f.id)}">💬 ${esc(L.reply)}</button>
      ${(mine || tm.owner === user.uid) ? `<button class="tmact" data-del="${esc(f.id)}">${esc(L.delPost)}</button>` : ''}
    </div>
    ${(f.replies || []).length ? `<div class="tmreplies">${f.replies.map(r =>
        `<div class="tmreply"><b>${esc(memberNick(tm, r.uid))}</b>${esc(r.text)}</div>`).join('')}</div>` : ''}
    <div class="tmrepbox" data-repbox="${esc(f.id)}" hidden>
      <input class="cardinput" placeholder="${esc(L.replyPH)}">
      <button class="btn sm primary">${esc(L.send)}</button>
    </div>
  </div>`;
}
function bindFeed(tm){
  const L = tl();
  $$('[data-amen]').forEach(b => b.onclick = async () => {
    try{ await teamPull(tm.code, 'amen', { pid:b.dataset.amen }); paintTeam($('#view')); }catch(e){ toast(e.message); }
  });
  $$('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm(L.delAsk)) return;
    try{ await teamPull(tm.code, 'delpost', { pid:b.dataset.del }); paintTeam($('#view')); }catch(e){ toast(e.message); }
  });
  $$('[data-rep]').forEach(b => b.onclick = () => {
    const box = $(`[data-repbox="${b.dataset.rep}"]`);
    if (!box) return;
    box.hidden = !box.hidden;
    if (!box.hidden) $('input', box).focus();
  });
  $$('[data-repbox]').forEach(box => {
    const inp = $('input', box), btn = $('button', box);
    const go2 = async () => {
      const text = inp.value.trim(); if (!text) return;
      btn.disabled = true;
      try{ await teamPull(tm.code, 'reply', { pid:box.dataset.repbox, text }); paintTeam($('#view')); }
      catch(e){ toast(e.message); btn.disabled = false; }
    };
    btn.onclick = go2;
    inp.onkeydown = e => { if (e.key === 'Enter') go2(); };
  });
}
function bindComposer(tm, kind){
  const L = tl();
  const ta = $('#tmText'), send = $('#tmSend'), ai = $('#tmAI'), vb = $('#tmVerse');
  let verse = '', ref = '';
  if (vb) vb.onclick = () => {
    const h = lastHl(); if (!h) return;
    verse = (h.t || '').replace(/〔[^〕]*〕/g, '').replace(/\[[^\]]*\]/g, '').trim();
    ref = cardRef(h);
    vb.classList.add('gold'); vb.textContent = '📖 ' + ref;
    toast(ref);
  };
  if (ai) ai.onclick = () => teamAIWrite(ta, ai, kind, verse || (lastHl() || {}).t || '');
  if (send) send.onclick = async () => {
    const text = (ta.value || '').trim();
    if (!text) return toast(L.shPH);
    send.disabled = true; send.textContent = L.sending;
    try{
      await teamPull(tm.code, 'post', { kind, text, verse, ref });
      bumpAct(kind); await teamPull(tm.code);
      toast(L.posted); paintTeam($('#view'));
    }catch(e){ toast(e.message, 4000); send.disabled = false; send.textContent = L.send; }
  };
}
/* 請小智照這個情境寫一段 */
async function teamAIWrite(ta, btn, kind, verse){
  const L = tl();
  if (!ta || !btn) return;
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = L.writing;
  const who = { share:'讀經分享', pray:'代禱事項', care:'關懷的話', witness:'見證' }[kind] || '分享';
  const sys = isEP()
    ? 'You are Xiaozhi, a spiritual companion of Kingdom 321 Online Fellowship. Write a short, warm piece for a small group: three to four sentences, under 70 words, spoken and personal, never preachy. No headings, no bullets, no quotation marks.'
    : `你是「小智」，國度321空中團契的屬靈同伴。請幫使用者寫一段要貼在小組裡的「${who}」，三到四句、120 字以內，口語、溫暖、不說教，不要標題、不要條列、不要引號。`;
  const ask = (verse ? L3('經文：', '经文：', 'Verse: ') + verse + '\n' : '')
            + L3(`請寫一段${who}。`, `请写一段${who}。`, `Please write a short ${kind} note.`)
            + AUD_WRITE()
            + (ta.value.trim() ? L3('\n我想講的重點：', '\n我想讲的重点：', '\nWhat I want to say: ') + ta.value.trim() : '');
  try{
    const r = await fetch(API.chat, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ system: koSys(sys), messages:[{ role:'user', content: ask }] }) });
    if (!r.ok) throw new Error('http ' + r.status);
    const out = extractReply(await r.json().catch(() => null));
    if (!out) throw new Error('empty');
    ta.value = amenOnly(out.replace(/[*#>`]/g, '').replace(/^「|」$/g, '').trim());
  }catch(e){ toast(t().chatErr, 3500); }
  btn.disabled = false; btn.textContent = old;
}

/* ---- 關懷某位隊友 ---- */
function openCareSheet(tm, target){
  const L = tl();
  const nick = memberNick(tm, target);
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card">
    <div class="hlsheet-title">${esc(L.careGo)} → ${esc(nick)}</div>
    <div class="hl-hint">${esc(idleDays((tm.members || {})[target] || {}) > 900 ? `${nick}　${L.never}` : L.careMsg(nick, idleDays((tm.members || {})[target] || {})))}</div>
    <textarea class="hlsheet-ta" id="caText" placeholder="${esc(L.caPH)}"></textarea>
    <div class="hlsheet-acts">
      <button class="btn primary" id="caSend">${esc(L.send)}</button>
      <button class="btn gold" id="caAI">✍️ ${esc(L.askXZ)}</button>
      <button class="btn" id="caClose">${esc(t().close)}</button>
    </div></div>`;
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  $('#caClose', mask).onclick = () => mask.remove();
  $('#caAI', mask).onclick = () => teamAIWrite($('#caText', mask), $('#caAI', mask), 'care', '');
  $('#caSend', mask).onclick = async () => {
    const text = $('#caText', mask).value.trim();
    if (!text) return toast(L.caPH);
    const b = $('#caSend', mask); b.disabled = true; b.textContent = L.sending;
    try{
      await teamPull(tm.code, 'post', { kind:'care', text, to:target });
      bumpAct('care'); await teamPull(tm.code);
      mask.remove(); toast(L.careSent); TEAM.sub = 'feed'; paintTeam($('#view'));
    }catch(e){ toast(e.message, 4000); b.disabled = false; b.textContent = L.send; }
  };
}

/* ---- 設定共同目標（隊長） ---- */
function openGoalSheet(tm){
  const L = tl();
  const g = tm.goal || { type:'daily', n:3 };
  let type = g.type, book = g.book || (user.last && user.last.book) || 'John', n = g.n || 3, due = g.due || 0;
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  const bookOpts = () => TOC.map(b => `<option value="${esc(b.id)}" ${b.id === book ? 'selected' : ''}>${esc(bname(b))}</option>`).join('');
  const draw = () => {
    mask.innerHTML = `<div class="hlsheet-card">
      <div class="hlsheet-title">${esc(L.setGoal)}</div>
      <div class="cardchips" id="gType">
        ${Object.keys(L.gTypes).map(k => `<button data-g="${k}" class="${k === type ? 'on' : ''}">${esc(L.gTypes[k])}</button>`).join('')}
      </div>
      <div style="margin-top:14px">
        ${type === 'daily' ? `<div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.gDailyN)}</div>
           <div class="cardchips" id="gN">${[1, 2, 3, 4, 5, 8, 10].map(x =>
             `<button data-n="${x}" class="${x === n ? 'on' : ''}">${esc(L.chUnit(x))}</button>`).join('')}</div>` : ''}
        ${type === 'book' ? `<div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.gBook)}</div>
           <select class="cardinput" id="gBook">${bookOpts()}</select>
           <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.gDue)}</div>
           <input class="cardinput" type="date" id="gDue" value="${due ? new Date(due).toISOString().slice(0, 10) : ''}">` : ''}
        ${type === 'year' ? `<div class="muted" style="font-size:13px;line-height:1.9">${esc(L.gTypes.year)}　${esc(L.chUnit(1189))}</div>` : ''}
        ${type === 'passage' ? `<div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.gBook)}</div>
           <select class="cardinput" id="gBook">${bookOpts()}</select>
           <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.gChapter)}</div>
           <input class="cardinput" type="number" min="1" id="gCh" value="${n}">` : ''}
      </div>
      <input class="cardinput" id="gTitle" style="margin-top:12px" placeholder="${esc(L.gTitlePH)}" value="${esc(g.title || '')}">
      <div class="hlsheet-acts" style="margin-top:14px">
        <button class="btn primary" id="gSave">${esc(L.gSave)}</button>
        ${tm.goal ? `<button class="btn danger" id="gClear">${esc(L.clearGoal)}</button>` : ''}
        <button class="btn" id="gClose">${esc(t().close)}</button>
      </div></div>`;
    $$('#gType button', mask).forEach(b => b.onclick = () => { type = b.dataset.g; draw(); });
    $$('#gN button', mask).forEach(b => b.onclick = () => { n = +b.dataset.n; draw(); });
    const bs = $('#gBook', mask); if (bs) bs.onchange = () => { book = bs.value; };
    const ds = $('#gDue', mask);  if (ds) ds.onchange = () => { due = ds.value ? new Date(ds.value).getTime() : 0; };
    const cs = $('#gCh', mask);   if (cs) cs.onchange = () => { n = Math.max(1, +cs.value || 1); };
    $('#gClose', mask).onclick = () => mask.remove();
    const gc = $('#gClear', mask);
    if (gc) gc.onclick = async () => {
      try{ await teamPull(tm.code, 'goal', { goal:null }); mask.remove(); paintTeam($('#view')); }catch(e){ toast(e.message); }
    };
    $('#gSave', mask).onclick = async () => {
      const goal = { type, n, book, due, title: $('#gTitle', mask).value.trim() };
      const b = $('#gSave', mask); b.disabled = true; b.textContent = L.syncing;
      try{ await teamPull(tm.code, 'goal', { goal }); mask.remove(); paintTeam($('#view')); }
      catch(e){ toast(e.message, 4000); b.disabled = false; b.textContent = L.gSave; }
    };
  };
  document.body.appendChild(mask);
  mask.onclick = e => { if (e.target === mask) mask.remove(); };
  draw();
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
  const en = isEN(), needle = en ? q.toLowerCase() : q;
  const has = str => (en ? str.toLowerCase() : str).indexOf(needle) >= 0;
  for (let i = 0; i < shards.length; i++){
    const d = await loadShard(state.lang, shards[i]);
    $('i', prog).style.width = Math.round((i + 1) / shards.length * 100) + '%';
    for (const bid in d){
      const b = BOOK[bid]; if (!b) continue;
      d[bid].forEach((chap, ci) => {
        /* curV 要跨區塊延續——詩歌體每一行是獨立區塊，續行的節號是 0，
           不跟著記就會變成「這節是第 0 節」，出處只剩到章沒有節。做法跟 chapterHTML() 一樣。 */
        let curV = 0;
        chap.forEach(bl => {
          if (bl[0] === 'b') return;
          for (let j = 2; j < bl.length; j += 2){
            const vno = bl[j - 1]; if (vno) curV = vno;
            if (!has(bl[j])) continue;
            for (const sx of splitSentences(bl[j])){
              if (has(sx) && res.length < 400)
                res.push({ b:bid, c:ci + 1, v:curV, x:sx });
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
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), isEN() ? 'gi' : 'g');
  out.innerHTML = `<div class="muted" style="margin-bottom:8px">${esc(L.found(res.length))}${res.length >= 400 ? '＋' : ''}</div>` +
    res.map((r, i) => `<div class="sres" data-i="${i}">
      <div class="sr">${esc(cardRef({ b:r.b, ch:r.c, v:r.v }))}</div>
      <div class="sx">${esc(r.x).replace(rx, m => '<em>' + m + '</em>')}</div></div>`).join('');
  $$('.sres', out).forEach(e => e.onclick = () => {
    goSearchHit(res[+e.dataset.i]);
  });
}

/* ================================================================ 陪讀 */
let chatLog = [], chatPending = null, chatBusy = false;
/* 從畫線「問小智」進來時記下來源經文；直接打字提問就沒有，分享時只帶答案 */
let chatSrc = null;
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
       '请用一个比喻帮我明白这段经文的核心。'],
  en: ['What does this passage show me about who God is?',
       'What self-centred old nature does this passage expose in me?',
       'If I let Jesus reign in this situation, what would I do?',
       'What example does Jesus set for me here?',
       'What one step is the Holy Spirit guiding me to take today?',
       'Why did the people here fail — was the root pride, or fear?',
       'How does this passage help me practise a self-emptied life?',
       'Which relationship of mine should I bring this passage into?',
       'How does this connect with “Your Kingdom come” in the Lord\'s Prayer?',
       'Give me one everyday picture that opens up the heart of this passage.']
};
/* 把 markdown 記號拿掉，剩下乾淨的文字（分享與美圖都用這個） */
/* ---- markdown 表格 ----
   小智有時會用表格回答，那在畫面上很好讀；可是同一份內容要分享成文字、
   要唸出來，就不能照抄那些直線與虛線。所以掃出表格之後，三個地方各用各的寫法：
   畫面→真的表格、分享→「甲 → 乙」一行一項、朗讀→一句一句說成人話。 */
const tbRow   = x => /^\s*\|.*\|\s*$/.test(x);
const tbSep   = x => /^\s*\|[\s:|\-]+\|\s*$/.test(x) && x.indexOf('-') >= 0;
const tbCells = x => x.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
function mdTableMap(src, fmt){
  const L = String(src || '').split('\n'), out = [];
  for (let i = 0; i < L.length; ){
    if (tbRow(L[i]) && i + 1 < L.length && tbSep(L[i + 1])){
      const head = tbCells(L[i]); i += 2;
      const rows = [];
      while (i < L.length && tbRow(L[i])){ rows.push(tbCells(L[i])); i++; }
      if (rows.length){ out.push(fmt(head, rows)); continue; }
      out.push(head.join(' '));
      continue;
    }
    out.push(L[i]); i++;
  }
  return out.join('\n');
}
/* 朗讀用：把表格說成一句一句的話，不要唸出直線和虛線 */
function mdStrip(x){
  const arrow = ' → ';
  return mdTableMap(String(x || ''), function (head, rows){
    const ls = [];
    if (head.filter(Boolean).length) ls.push(head.filter(Boolean).join(arrow));
    rows.forEach(r => ls.push('・' + r.filter(Boolean).join(arrow)));
    return ls.join('\n');
  })
    .replace(/^#{1,6} /gm, '')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/\*([\s\S]+?)\*/g, '$1')
    .replace(/\*/g, '')
    .replace(/^&gt; ?/gm, '').replace(/^> ?/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/^[-*] /gm, '・')
    .replace(/`+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function mdToHtml(s){
  let h = esc(s);
  h = mdTableMap(h, (head, rows) =>
    '\n\n<table class="mdtb"><thead><tr>' + head.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'
    + rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('')
    + '</tbody></table>\n\n');
  h = h.replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>')
       .replace(/^#{1,4} (.*)$/gm, '<h4>$1</h4>');
  h = h.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([\s\S]+?)\*/g, '$1<i>$2</i>');
  h = h.replace(/^&gt; ?(.*)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^---+$/gm, '<hr>');
  h = h.replace(/^[-*] (.*)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, m => '<ul>' + m + '</ul>');
  return h.split(/\n{2,}/).map(p => /^<(h\d|ul|blockquote|hr|table)/.test(p.trim()) ? p : '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
}
/* 換長度／換信仰背景＝用新設定把最後一個問題重新回答（舊的那組問答換掉）；成功重答回傳 true */
function reAnswerLast(msg){
  let ui = -1; chatLog.forEach((m, i) => { if (m.role === 'user') ui = i; });
  if (chatBusy || ui < 0 || chatLog.length <= ui + 1) return false;
  const q = chatLog[ui];
  chatLog.splice(ui); chatSrc = q.src || null;
  toast(msg, 2200);
  sendChat(q.text);
  return true;
}
let xzOptsOpen = true, xzResize = null, xzScrollFn = null;
async function viewCompanion(v){
  const L = t();
  const b = RD.book ? BOOK[RD.book] : null;
  v.innerHTML = `<div class="chatwrap">
      <div class="xz-head"><button class="xz-back navlbl" id="xzBack" title="${esc(L3('上一頁', '上一页', 'Back'))}">‹ ${esc(L3('上一頁', '上一页', 'Back'))}</button><img src="icon-72.png" alt=""><span>${esc(L.companionFull)}</span><button class="xz-fold" id="xzFold">${esc(L3('收合', '收合', 'Fold'))}</button></div>
      <button class="xz-sum" id="xzSum"></button>
      <div id="xzOpts">
      <div class="xz-bar" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 6px">
        ${b ? `<span class="chatctx" style="margin:0">${esc(L.ctx(bname(b), RD.ch))}</span>` : ''}
        <button class="qs-toggle" id="audBtn" style="margin:0"></button>
        <button class="qs-toggle" id="qsBtn" style="margin:0">💡 ${esc(L.examples)}</button>
      </div>
      <div class="segbtns" id="lenSeg" style="justify-content:flex-start;align-items:center;margin:0 0 6px"></div>
      <div class="segbtns" id="bgSeg" hidden style="justify-content:flex-start;align-items:center;margin:0 0 6px"></div>
      <div class="aud-panel" id="audPanel" hidden style="margin:0 0 6px">
        <div class="segbtns" id="audSeg" style="justify-content:flex-start"></div>
        <div class="muted" id="audHint" style="font-size:11.5px;line-height:1.6;margin:6px 0 0"></div>
      </div>
      <div class="qs-panel" id="qsPanel" hidden></div>
      </div>
      <div class="chatlog" id="chatlog"></div>
      <div class="chatinput">
        <textarea id="chatIn" rows="1" placeholder="${esc(L.chatPH)}"></textarea>
        <button id="chatSend">${esc(L.send)}</button>
      </div></div>`;
  $('#xzBack', v).onclick = () => {
    /* 從某節經文按「問小智」進來的，直接回讀經那一節；不然就照瀏覽紀錄退回去 */
    appBack(RD.book ? `#/read/${RD.book}/${RD.ch}` : '#/today');
  };
  $('#xzFold', v).onclick = foldAll;
  const panel = $('#qsPanel', v);
  const paintQs = () => {
    panel.innerHTML = qbankNow().map(q => `<button class="qs-chip">${esc(q)}</button>`).join('');
    $$('.qs-chip', panel).forEach(c => c.onclick = () => { panel.hidden = true; sendChat(c.textContent); });
  };
  /* 對象切換：點了立刻換色、換說明、換範例問題，並 toast 一句——設定類的點選必須當場有回饋 */
  const paintAud = () => {
    const nm = AUD_NAME();
    $('#audSeg', v).innerHTML = AUD_KEYS.map(k =>
      `<button class="${state.audience === k ? 'on' : ''}" data-k="${k}">${AUD_ICON[k]} ${esc(nm[k])}</button>`).join('');
    $('#audHint', v).textContent = AUD_HINT()[state.audience];
    $('#audBtn', v).textContent = AUD_ICON[state.audience] + ' ' + L3('對象：', '对象：', 'For: ') + nm[state.audience] + ' ▾';
    $$('#audSeg button', v).forEach(b => b.onclick = () => {
      if (state.audience === b.dataset.k) return;
      state.audience = b.dataset.k; saveState();
      paintAud(); paintQs(); paintBg(); $('#audPanel', v).hidden = true;
      toast(L3('回答對象：', '回答对象：', 'Answering for: ') + AUD_NAME()[state.audience], 2000);
    });
  };
  paintAud(); paintQs();
  $('#qsBtn', v).onclick = () => { panel.hidden = !panel.hidden; if (!panel.hidden) $('#audPanel', v).hidden = true; };
  const paintLen = () => {
    const nm = LEN_NAME();
    $('#lenSeg', v).innerHTML = `<span class="muted" style="font-size:12px;font-weight:700">${esc(L3('長度：', '长度：', 'Length: '))}</span>`
      + LEN_KEYS.map(k => `<button class="${state.alen === k ? 'on' : ''}" data-k="${k}">${esc(nm[k])}</button>`).join('');
    $$('#lenSeg button', v).forEach(b => b.onclick = () => {
      if (state.alen === b.dataset.k) return;
      state.alen = b.dataset.k; saveState(); paintLen();
      if (reAnswerLast(L3('已改成「', '已改成“', 'Switched to “') + nm[state.alen] + L3('」，重新回答中…', '”，重新回答中…', '” — answering again…'))) return;
      toast(L3('回答長度：', '回答长度：', 'Answer length: ') + nm[state.alen], 1800);
    });
  };
  paintLen();
  function paintBg(){
    const el = $('#bgSeg', v); if (!el) return;
    el.hidden = state.audience !== 'seeker';
    if (el.hidden) return;
    const nm = SKBG_NAME();
    el.innerHTML = `<span class="muted" style="font-size:12px;font-weight:700">${esc(L3('信仰背景：', '信仰背景：', 'Background: '))}</span>`
      + SKBG_KEYS.map(k => `<button class="${state.skbg === k ? 'on' : ''}" data-k="${k}">${SKBG_ICON[k]} ${esc(nm[k])}</button>`).join('');
    $$('#bgSeg button', v).forEach(b => b.onclick = () => {
      if (state.skbg === b.dataset.k) return;
      state.skbg = b.dataset.k; saveState(); paintBg(); paintQs();
      if (reAnswerLast(L3('已改成「', '已改成“', 'Switched to “') + nm[state.skbg] + L3('」背景，重新回答中…', '”背景，重新回答中…', '” background — answering again…'))) return;
      toast(L3('信仰背景：', '信仰背景：', 'Background: ') + nm[state.skbg], 1800);
    });
  }
  paintBg();
  /* v2.18.33：上面的選項欄可以收合；往上滑看回答時自動收起，回答區變大 */
  (function(){
    if (!document.getElementById('xzcCss')){
      const st = document.createElement('style'); st.id = 'xzcCss';
      st.textContent = '.xz-sum{display:block;width:100%;text-align:left;border:1px solid var(--border);background:var(--surface-alt);color:var(--ink);border-radius:10px;padding:8px 12px;font:inherit;font-size:13.5px;font-weight:600;margin:0 0 6px;cursor:pointer}'
        + '.chtoolbar.gnav:has(~ .chatwrap.xzc){display:none}';
      document.head.appendChild(st);
    }
    const wrap = $('.chatwrap', v), optsEl = $('#xzOpts', v), sumEl = $('#xzSum', v), cl = $('#chatlog', v);
    if (!wrap || !optsEl || !sumEl || !cl) return;
    const sumTxt = () => AUD_ICON[state.audience] + ' ' + AUD_NAME()[state.audience]
      + (state.audience === 'seeker' ? ' · ' + SKBG_NAME()[state.skbg] : '') + ' · ' + LEN_NAME()[state.alen];
    /* v2.22.1：回答區不再是固定高度的小框（在團契 App 內嵌視窗、iPhone 上常常滑不動），改成整頁一起捲；
       輸入框黏在分頁列上方，畫面空的時候也撐滿一頁 */
    if (!document.getElementById('xzPageCss')){
      const st2 = document.createElement('style'); st2.id = 'xzPageCss';
      st2.textContent = '.chatwrap{height:auto!important}.chatlog{flex:1 0 auto;overflow:visible!important}'
        + '.chatinput{position:fixed;left:0;right:0;margin:0 auto;max-width:640px;bottom:var(--xztb,calc(var(--tabbar-h) + env(safe-area-inset-bottom)));z-index:25;padding:10px 16px 10px!important;box-shadow:0 -6px 14px rgba(0,0,0,.06)}'
        + '.chatwrap{padding-bottom:var(--xzib,84px)}'
        + '.chatlog .msg{scroll-margin-top:calc(var(--header-h,56px) + 12px);scroll-margin-bottom:calc(var(--tabbar-h) + 96px)}';
      document.head.appendChild(st2);
    }
    const fit = () => {
      const tb = document.querySelector('nav.tabbar');
      const tbh = tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect().height : 0;
      const abs = wrap.getBoundingClientRect().top + (document.body.scrollTop || window.pageYOffset || 0);
      wrap.style.height = '';
      wrap.style.minHeight = Math.max(240, Math.floor(innerHeight - abs - tbh - 6)) + 'px';
      /* v2.22.2：問句欄固定在畫面最底下（分頁列上方），回答區底部留出同樣高度，最後一段不會被蓋住 */
      const ci = wrap.querySelector('.chatinput');
      document.documentElement.style.setProperty('--xztb', tbh ? (tbh + 'px') : 'env(safe-area-inset-bottom)');
      if (ci) document.documentElement.style.setProperty('--xzib', (Math.ceil(ci.getBoundingClientRect().height) + 16) + 'px');
    };
    const paint = () => { sumEl.textContent = '⚙ ' + sumTxt() + (xzOptsOpen ? '　▴' : '　▾'); };
    const setOpts = (open) => {
      xzOptsOpen = open; optsEl.hidden = !open;
      wrap.classList.toggle('xzc', !open);
      paint(); fit();
    };
    sumEl.onclick = () => setOpts(!xzOptsOpen);
    optsEl.addEventListener('click', () => setTimeout(paint, 0));
    setOpts(xzOptsOpen);
    setTimeout(fit, 60); setTimeout(fit, 400);
    if (xzResize) window.removeEventListener('resize', xzResize);
    xzResize = () => { if (document.body.contains(wrap)) fit(); };
    window.addEventListener('resize', xzResize);
    let touching = 0;
    const mark = () => { touching = Date.now(); };
    wrap.addEventListener('touchmove', mark, { passive:true }); wrap.addEventListener('wheel', mark, { passive:true });
    const y0 = () => document.body.scrollTop || window.pageYOffset || 0;
    if (xzScrollFn) document.removeEventListener('scroll', xzScrollFn, true);
    xzScrollFn = () => { if (!document.body.contains(wrap)) return; if (xzOptsOpen && Date.now() - touching < 600 && y0() > 30) setOpts(false); };
    document.addEventListener('scroll', xzScrollFn, { capture:true, passive:true });
    const sendB = $('#chatSend', v); if (sendB) sendB.addEventListener('click', () => { if (xzOptsOpen) setOpts(false); });
    const inB = $('#chatIn', v); if (inB) inB.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && xzOptsOpen) setOpts(false); });
  })();
  $('#audBtn', v).onclick = () => { const ap = $('#audPanel', v); ap.hidden = !ap.hidden; if (!ap.hidden) panel.hidden = true; };
  paintChat();
  $('#chatSend', v).onclick = () => sendChat($('#chatIn').value);
  $('#chatIn', v).onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendChat(e.target.value); }
  };
  if (chatPending){ const p = chatPending; chatPending = null; sendChat(p); }
}
/* ---- 小智回答後的「追問」（v2.11.0）：不同方向一鍵追問，把剛才的回答用到婚姻、家庭、職場、生活…
   方向隨「回答對象」換；點下去等於替使用者送出一句完整的追問，不必再打字。 */
const FU_BANK = {"zh": {"adult": [["💍", "婚姻", "請針對你剛才的回答，說明怎麼把它應用在夫妻關係與婚姻裡，並給我一個這個星期可以做的具體小步驟。"], ["👨‍👩‍👧", "家庭", "請針對你剛才的回答，說明怎麼把它應用在家庭與教養孩子（或與父母相處）上，並給我一個這個星期可以做的具體小步驟。"], ["💼", "職場", "請針對你剛才的回答，說明怎麼把它應用在工作與職場上（同事、主管、壓力、誠信），並給我一個這個星期可以做的具體小步驟。"], ["🏡", "日常", "請針對你剛才的回答，說明怎麼把它應用在日常生活的小事上（時間、金錢、習慣），並給我一個這個星期可以做的具體小步驟。"], ["💭", "內心", "請針對你剛才的回答，說明怎麼把它應用在面對內心的情緒與軟弱上（焦慮、憤怒、驕傲），並給我一個這個星期可以做的具體小步驟。"], ["🙏", "禱告", "請把你剛才說的重點，寫成一段簡短、真誠的禱告，讓我可以拿來禱告。"]], "teen": [["🏫", "學校", "用你剛才講的，幫我想想怎麼用在學校與課業上，給我一個今天就能試的小招。"], ["🤝", "朋友", "用你剛才講的，幫我想想怎麼用在朋友相處上，給我一個今天就能試的小招。"], ["🏠", "家人", "用你剛才講的，幫我想想怎麼用在跟爸媽、家人的相處上，給我一個今天就能試的小招。"], ["📱", "手機網路", "用你剛才講的，幫我想想怎麼用在手機、網路與社群上，給我一個今天就能試的小招。"], ["💭", "壓力", "用你剛才講的，幫我想想怎麼用在壓力和情緒上，給我一個今天就能試的小招。"], ["🌟", "未來", "用你剛才講的，幫我想想怎麼用在未來和夢想上，給我一個今天就能試的小招。"], ["🎯", "今天挑戰", "請給我一個跟剛才有關、今天就能完成的小挑戰，要具體、有點好玩。"]], "kid": [["🏠", "在家", "剛剛講的，我在家裡可以怎麼做呢？請用簡單的話告訴我。"], ["🏫", "在學校", "剛剛講的，我在學校可以怎麼做呢？請用簡單的話告訴我。"], ["🤝", "跟朋友", "剛剛講的，我在跟好朋友相處時可以怎麼做呢？請用簡單的話告訴我。"], ["🙏", "小禱告", "請教我一個很短的小禱告，我可以跟耶穌說。"], ["📖", "小故事", "可以再講一個跟這個有關的小故事給我聽嗎？"]], "seeker": [["🤝", "人際", "剛才說的放在人際關係裡（家人、朋友、同事），對一個還不是基督徒的人有什麼實際的幫助？請舉一個生活的例子。"], ["💍", "婚姻家庭", "剛才說的放在婚姻與家庭裡，對一個還不是基督徒的人有什麼實際的幫助？請舉一個生活的例子。"], ["💼", "工作", "剛才說的放在工作與職場裡，對一個還不是基督徒的人有什麼實際的幫助？請舉一個生活的例子。"], ["😟", "壓力焦慮", "剛才說的放在壓力與焦慮裡，對一個還不是基督徒的人有什麼實際的幫助？請舉一個生活的例子。"], ["🌍", "人生意義", "剛才說的放在尋找人生的意義與方向裡，對一個還不是基督徒的人有什麼實際的幫助？請舉一個生活的例子。"], ["❓", "我的疑問", "我心裡還有疑問，請誠實告訴我：信耶穌對一個人的生活到底有什麼實際的幫助？也請告訴我可以怎麼自己去查證。"], ["🌱", "下一步", "如果我想進一步了解，下一步可以做什麼？請給我一兩個不會有壓力的建議。"]]}, "zs": {"adult": [["💍", "婚姻", "请针对你刚才的回答，说明怎么把他应用在夫妻关系与婚姻里，并给我一个这个星期可以做的具体小步驟。"], ["👨‍👩‍👧", "家庭", "请针对你刚才的回答，说明怎么把他应用在家庭与教养孩子（或与父母相处）上，并给我一个这个星期可以做的具体小步驟。"], ["💼", "职场", "请针对你刚才的回答，说明怎么把他应用在工作与职场上（同事、主管、压力、诚信），并给我一个这个星期可以做的具体小步驟。"], ["🏡", "日常", "请针对你刚才的回答，说明怎么把他应用在日常生活的小事上（时间、金钱、习惯），并给我一个这个星期可以做的具体小步驟。"], ["💭", "内心", "请针对你刚才的回答，说明怎么把他应用在面对内心的情緒与软弱上（焦虑、愤怒、骄傲），并给我一个这个星期可以做的具体小步驟。"], ["🙏", "祷告", "请把你刚才说的重点，写成一段簡短、真诚的祷告，让我可以拿来祷告。"]], "teen": [["🏫", "学校", "用你刚才讲的，帮我想想怎么用在学校与课业上，给我一个今天就能试的小招。"], ["🤝", "朋友", "用你刚才讲的，帮我想想怎么用在朋友相处上，给我一个今天就能试的小招。"], ["🏠", "家人", "用你刚才讲的，帮我想想怎么用在跟爸妈、家人的相处上，给我一个今天就能试的小招。"], ["📱", "手机网路", "用你刚才讲的，帮我想想怎么用在手机、网路与社群上，给我一个今天就能试的小招。"], ["💭", "压力", "用你刚才讲的，帮我想想怎么用在压力和情緒上，给我一个今天就能试的小招。"], ["🌟", "未来", "用你刚才讲的，帮我想想怎么用在未来和梦想上，给我一个今天就能试的小招。"], ["🎯", "今天挑战", "请给我一个跟刚才有关、今天就能完成的小挑战，要具体、有点好玩。"]], "kid": [["🏠", "在家", "刚刚讲的，我在家里可以怎么做呢？请用簡单的话告诉我。"], ["🏫", "在学校", "刚刚讲的，我在学校可以怎么做呢？请用簡单的话告诉我。"], ["🤝", "跟朋友", "刚刚讲的，我在跟好朋友相处时可以怎么做呢？请用簡单的话告诉我。"], ["🙏", "小祷告", "请教我一个很短的小祷告，我可以跟耶稣说。"], ["📖", "小故事", "可以再讲一个跟这个有关的小故事给我听吗？"]], "seeker": [["🤝", "人際", "刚才说的放在人際关系里（家人、朋友、同事），对一个还不是基督徒的人有什么实際的帮助？请举一个生活的例子。"], ["💍", "婚姻家庭", "刚才说的放在婚姻与家庭里，对一个还不是基督徒的人有什么实際的帮助？请举一个生活的例子。"], ["💼", "工作", "刚才说的放在工作与职场里，对一个还不是基督徒的人有什么实際的帮助？请举一个生活的例子。"], ["😟", "压力焦虑", "刚才说的放在压力与焦虑里，对一个还不是基督徒的人有什么实際的帮助？请举一个生活的例子。"], ["🌍", "人生意义", "刚才说的放在寻找人生的意义与方向里，对一个还不是基督徒的人有什么实際的帮助？请举一个生活的例子。"], ["❓", "我的疑问", "我心里还有疑问，请诚实告诉我：信耶稣对一个人的生活到底有什么实際的帮助？也请告诉我可以怎么自己去查证。"], ["🌱", "下一步", "如果我想进一步了解，下一步可以做什么？请给我一两个不会有压力的建议。"]]}, "en": {"adult": [["💍", "Marriage", "Based on your answer, explain how to apply it in my marriage, and give me one concrete step I can take this week."], ["👨‍👩‍👧", "Family", "Based on your answer, explain how to apply it in my family and parenting (or with my parents), and give me one concrete step I can take this week."], ["💼", "Work", "Based on your answer, explain how to apply it at work (colleagues, boss, pressure, integrity), and give me one concrete step I can take this week."], ["🏡", "Daily life", "Based on your answer, explain how to apply it in everyday life (time, money, habits), and give me one concrete step I can take this week."], ["💭", "Inner life", "Based on your answer, explain how to apply it in facing my inner struggles (anxiety, anger, pride), and give me one concrete step I can take this week."], ["🙏", "Prayer", "Please turn the key point of your answer into a short, sincere prayer I can pray."]], "teen": [["🏫", "School", "Using what you just said, help me think through how to use it at school and with my studies — give me one small move I can try today."], ["🤝", "Friends", "Using what you just said, help me think through how to use it with my friends — give me one small move I can try today."], ["🏠", "Family", "Using what you just said, help me think through how to use it with my parents and family — give me one small move I can try today."], ["📱", "Phone & online", "Using what you just said, help me think through how to use it on my phone, online and on social media — give me one small move I can try today."], ["💭", "Stress", "Using what you just said, help me think through how to use it with stress and emotions — give me one small move I can try today."], ["🌟", "Future", "Using what you just said, help me think through how to use it for my future and dreams — give me one small move I can try today."], ["🎯", "Challenge", "Give me one small, specific, slightly fun challenge related to this that I can finish today."]], "kid": [["🏠", "At home", "About what you just said — what can I do at home? Please tell me in simple words."], ["🏫", "At school", "About what you just said — what can I do at school? Please tell me in simple words."], ["🤝", "With friends", "About what you just said — what can I do with my friends? Please tell me in simple words."], ["🙏", "Little prayer", "Please teach me a very short little prayer I can say to Jesus."], ["📖", "Story", "Can you tell me another little story about this?"]], "seeker": [["🤝", "Relationships", "Applying what you just said in relationships (family, friends, colleagues), what practical help would it be for someone who is not yet a Christian? Please give an everyday example."], ["💍", "Marriage & family", "Applying what you just said in marriage and family, what practical help would it be for someone who is not yet a Christian? Please give an everyday example."], ["💼", "Work", "Applying what you just said at work, what practical help would it be for someone who is not yet a Christian? Please give an everyday example."], ["😟", "Stress", "Applying what you just said in stress and anxiety, what practical help would it be for someone who is not yet a Christian? Please give an everyday example."], ["🌍", "Meaning", "Applying what you just said in searching for meaning and direction in life, what practical help would it be for someone who is not yet a Christian? Please give an everyday example."], ["❓", "My doubts", "I still have doubts. Please tell me honestly: what practical difference does faith in Jesus make to a person's life? And how could I check it out for myself?"], ["🌱", "Next step", "If I want to learn more, what could my next step be? Please give one or two no-pressure suggestions."]]}};
const FU_LIST = () => { const x2 = A2(); if (x2) return x2.fu; return (FU_BANK[state.lang] || (isX() ? FU_BANK.en : FU_BANK.zh))[state.audience] || []; };
function fuCss(){
  if ($('#fucss')) return;
  const el = document.createElement('style'); el.id = 'fucss';
  el.textContent = '.fu-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;padding-top:8px;border-top:1px dashed var(--border)}'
    + '.fu-t{font-size:12px;font-weight:700;color:var(--gold);margin-right:2px}'
    + '.fu-chip{border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent-ink);border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;line-height:1.3}'
    + '.fu-chip:active{opacity:.7}';
  document.head.appendChild(el);
}
/* 只在「最新一則」成功的回答底下出現追問；舊的回答與連線失敗的不顯示 */
function fuHtml(m, i){
  if (m.role !== 'ai' || !m.ok || m.cont || chatBusy || i !== chatLog.length - 1) return '';
  const l = FU_LIST(); if (!l.length) return '';
  return `<div class="fu-row"><span class="fu-t">${esc(L3('追問：', '追问：', 'Ask more: '))}</span>`
    + l.map(x => `<button class="fu-chip" data-q="${esc(x[2])}">${x[0]} ${esc(x[1])}</button>`).join('') + '</div>';
}
function paintChat(){
  fuCss();
  const log = $('#chatlog'); if (!log) return;
  log.innerHTML = chatLog.map((m, i) => m.role === 'user'
    ? `<div class="msg user">${esc(m.text)}</div>`
    : `<div class="msg ai${msgFoldCls(m)}" id="msg${i}"><div class="msg-body">${mdToHtml(m.text)}</div>${m.cont
          ? `<div class="msg-cont">${esc(L3('小智還在接著寫…', '小智还在接着写…', 'Xiaozhi is still writing…'))}</div>` : msgMoreHtml(m, i)}
        <div class="msg-actions"${m.cont ? ' hidden' : ''}>
          <button class="msg-act ${isFav(m.text) ? 'on' : ''}" data-a="fav" data-i="${i}">★ ${esc(L3('收藏', '收藏', 'Save'))}</button>
          <button class="msg-act" data-a="share" data-i="${i}">↗ ${esc(L3('分享', '分享', 'Share'))}</button>
          <button class="msg-act" data-a="card" data-i="${i}">🖼 ${esc(L3('做成美圖', '做成美图', 'Make a card'))}</button>
          <button class="msg-act ${sayId === i ? 'on' : ''}" data-a="tts" data-i="${i}">${sayId === i ? '⏸' : '🔊'}</button>
          <button class="msg-act" data-a="del" data-i="${i}">✕</button>
        </div>${fuHtml(m, i)}</div>`).join('');
  $$('.fu-chip', log).forEach(b => b.onclick = () => sendChat(b.dataset.q));
  $$('.msg-more', log).forEach(b => b.onclick = () => msgFold(+b.dataset.i));
  $$('.msg-act', log).forEach(b => b.onclick = () => {
    const i = +b.dataset.i, m = chatLog[i];
    if (b.dataset.a === 'fav'){ toggleFav(m.text); paintChat(); }
    else if (b.dataset.a === 'del'){ chatLog.splice(i, 1); paintChat(); }
    else if (b.dataset.a === 'tts'){
      /* 再按一次就停；換一則就把上一則停掉。按下去立刻反白，不必等聲音出來 */
      if (sayId === i){ ttsSayStop(); return; }
      ttsSayStop(); ttsStop();
      sayId = i; paintSay();
      ttsSpeakText(m.text, i);
    }
    else if (b.dataset.a === 'share'){ chatShare(m); }
    else if (b.dataset.a === 'card'){ chatCard(m); }
  });
  /* 整頁一起捲：新的回答從開頭給你看；自己的問題、「思想中」就捲到最下面 */
  const last = log.lastElementChild;
  if (last) setTimeout(() => { try{ last.scrollIntoView({ block: last.classList.contains('ai') && last.querySelector('.msg-actions:not([hidden])') ? 'start' : 'end' }); }catch(e){} }, 30);
}
/* 小智的回答要分享出去時，經文與答案一起帶走——單看答案，別人不知道在講哪一節 */
function chatPack(m){
  const src = m.src || null;
  const ans = mdStrip(m.text);
  const ref = src ? cardRef({ b:src.b, ch:src.ch, v:src.v, v2:src.v2 }) : '';
  return { src, ans, ref, verse: src ? src.t : '' };
}
async function chatShare(m){
  const L = t(), p = chatPack(m);
  const head = p.verse ? (isEN() ? `“${p.verse}”` : `「${p.verse}」`) + (p.ref ? '\n—— ' + p.ref : '') + '\n\n' : '';
  /* 落款只留團契與網址——這是弟兄姊妹之間的分享，不必掛上是誰寫的 */
  const home = location.origin + location.pathname.replace(/index\.html$/, '');
  const foot = '\n\n—— ' + (state.cardTop || L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Online Fellowship'))
             + '\n' + home;
  const text = head + p.ans + foot;
  if (navigator.share){
    try{ await navigator.share({ title: L.app, text }); return; }
    catch(e){ if (e && e.name === 'AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(text); toast(L.copied || L3('已複製，可以貼到群組裡', '已复制，可以贴到群组里', 'Copied — paste it anywhere'), 3200); }
  catch(e){ toast(L3('這台裝置不支援分享，請長按訊息複製', '这台设备不支持分享，请长按讯息复制', 'Sharing is not available — long-press the message to copy'), 4000); }
}
/* 卡片放得下的長度有限，整篇塞進去會小到看不清楚。
   小智的回答裡若有「>」引言，那一句通常就是重點，優先拿它；
   否則從正文取前幾句，到句號為止。完整的一篇仍然可以用「分享」傳文字。 */
function cardText(md){
  const LIMIT = isEN() ? 320 : 150;
  const raw = String(md || '');
  const quote = (raw.match(/^&gt; ?(.+)$/m) || raw.match(/^> ?(.+)$/m) || [])[1];
  if (quote){
    const q = mdStrip(quote);
    if (q.length >= 16 && q.length <= LIMIT + 60) return q;
  }
  const body = mdStrip(raw)
    .split('\n').filter(l => l.trim() && !/^・/.test(l.trim()))
    .join(' ');
  if (body.length <= LIMIT) return body;
  const parts = isEN() ? body.split(/(?<=[.!?])\s+/) : body.split(/(?<=[。！？])/);
  let out = '';
  for (const x of parts){
    if (out && (out + x).length > LIMIT) break;
    out += x;
  }
  return (out || body.slice(0, LIMIT)).trim() + (out.length < body.length ? '…' : '');
}
/* v2.22.1：從小智的回答裡找出最合適的經文——「>」引言裡帶章節的優先，其次是回答裡第一個帶章節的經文 */
let REF_RE = null, REF_MAP = null;
function refRegex(){
  if (REF_RE) return REF_RE;
  REF_MAP = {};
  const RAW = [];
  const add = (n, id) => { const raw = String(n || '').trim(); n = raw.replace(/\s+/g, '').toLowerCase(); if (n && !REF_MAP[n]){ REF_MAP[n] = id; RAW.push(raw); } };
  TOC.forEach(b => { [b.zh, b.zs, b.en, b.azh, b.azs, b.aen, b.ko, b.ako, b.ja, b.aja, b.idn, b.aid].forEach(n => add(n, b.id)); });
  add('Psalm', 'Psalms'); add('Song of Songs', 'SongofSolomon'); add('詩', 'Psalms'); add('诗', 'Psalms');
  const names = RAW.sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*').replace(/^(\d)(?=[A-Za-z])/, '$1\\s*'));
  REF_RE = new RegExp('(' + names.join('|') + ')\\s*(\\d{1,3})\\s*(?:[:：]|[章篇장편]\\s*(?:第\\s*)?)\\s*(\\d{1,3})\\s*[節节절]?(?:\\s*[-–—~～至到]\\s*(\\d{1,3}))?', 'gi');
  return REF_RE;
}
function findRefs(text){
  const re = refRegex(), out = [];
  if (!REF_MAP) return out;
  String(text || '').split('\n').forEach((line, li) => {
    re.lastIndex = 0; let m;
    while ((m = re.exec(line))){
      const id = REF_MAP[m[1].replace(/\s+/g, '').toLowerCase()];
      const b = id && BOOK[id]; if (!b) continue;
      const ch = +m[2], v = +m[3], v2 = m[4] ? +m[4] : 0;
      if (!ch || ch > b.ch || !v) continue;
      out.push({ b:id, ch, v, v2:(v2 > v && v2 - v <= 6) ? v2 : 0, q:/^\s*(&gt;|>)/.test(line), at:li });
    }
  });
  return out;
}
async function verseTextOf(id, ch, v, v2){
  const arr = await getChapter(id, ch); if (!arr) return '';
  const hi = v2 || v, parts = [];
  let cur = 0;
  arr.forEach(seg => {
    if (!Array.isArray(seg)) return;
    for (let i = 1; i + 1 < seg.length; i += 2){
      if (+seg[i] > 0) cur = +seg[i];
      if (cur >= v && cur <= hi && seg[i + 1]) parts.push(String(seg[i + 1]));
    }
  });
  let t = parts.join(isEN() ? ' ' : '').replace(/〔[^〕]*〕/g, '').replace(/\s+/g, ' ').trim();
  /* 從段落中間取出的經文，常帶著前後文的引號（例如『願耶和華賜福給你…）：沒配對的就拿掉 */
  [['「', '」'], ['『', '』'], ['“', '”'], ['‘', '’']].forEach(([o, c]) => {
    const no = t.split(o).length - 1, nc = t.split(c).length - 1;
    if (no > nc) for (let k = no - nc; k > 0 && t.indexOf(o) >= 0; k--) t = t.replace(o, '');
    else if (nc > no) for (let k = nc - no; k > 0 && t.lastIndexOf(c) >= 0; k--){ const i = t.lastIndexOf(c); t = t.slice(0, i) + t.slice(i + 1); }
  });
  return t.trim();
}
async function pickVerse(md){
  try{ await loadTOC(); }catch(e){}
  const refs = findRefs(md);
  if (!refs.length) return null;
  const order = refs.filter(r => r.q).concat(refs.filter(r => !r.q));
  for (const r of order){
    const t = await verseTextOf(r.b, r.ch, r.v, r.v2).catch(() => '');
    if (t) return Object.assign(r, { t });
  }
  return null;
}
/* 直接送進美圖工作室：版型、相片、配樂、錄影全部沿用 */
async function chatCard(m){
  const p = chatPack(m);
  const src = p.src;
  if (src){
    openStudio({ t:p.verse, n:cardText(m.text), b:src.b, ch:src.ch, v:src.v, v2:src.v2 || 0, c:'gold', ts:Date.now() });
    toast(L3('已取回答的重點放進卡片，可以直接改；整篇請用「分享」傳文字',
                   '已取回答的重点放进卡片，可以直接改；整篇请用「分享」传文字',
                   'The key line is on the card — edit it freely; use Share to send the full answer'), 4600);
    return;
  }
  /* 自己問的問題（例如「祝福朋友生日的合適經文」）：把回答裡最合適的那一節經文放上美圖，出處寫章節 */
  const r = await pickVerse(m.text);
  if (r){
    const it = { b:r.b, ch:r.ch, v:r.v, v2:r.v2 || 0 };
    openStudio({ t:r.t, n:'', b:r.b, ch:r.ch, v:r.v, v2:r.v2 || 0, c:'gold', ts:Date.now() });
    toast(L3('已把回答裡最合適的經文放進美圖：', '已把回答里最合适的经文放进美图：', 'The best verse from the answer is on the card: ') + cardRef(it), 4200);
    return;
  }
  openStudio({ t:cardText(m.text), n:'', b:'', ref:'', ch:0, v:0, c:'gold', ts:Date.now() });
  toast(L3('已取回答的重點放進卡片，可以直接改；整篇請用「分享」傳文字',
                 '已取回答的重点放进卡片，可以直接改；整篇请用「分享」传文字',
                 'The key line is on the card — edit it freely; use Share to send the full answer'), 4600);
}
const isFav = txt => user.fav.some(f => f.text === txt);
function toggleFav(txt){
  const i = user.fav.findIndex(f => f.text === txt);
  if (i >= 0) user.fav.splice(i, 1);
  else user.fav.push({ text:txt, b:RD.book, ch:RD.ch, ts:Date.now() });
  saveUser();
}
/* 小智回答的格式規範（三語）。App 已經會把表格畫成表格、唸成人話、
   分享成清單，所以這裡明白地鼓勵它用表格，並要求把重點標成一句引言。 */
const SYS_FMT = () => isEP()
  ? ' Format: you may use a markdown table when comparing or listing things side by side — it renders as a real table, is read aloud as natural sentences, and becomes a clean list when shared. Mark the single most important sentence as a "> " blockquote; that line is what gets turned into a shareable picture. Use short headings. Do not use ASCII art, code blocks or decorative symbols that cannot be read aloud. If you write a prayer, always close it with "in the name of the Lord Jesus we pray, Amen" — never "in Jesus\' name we ask, Amen."'
  : isZS()
  ? ' 回答格式：需要並列或對照时可以用 markdown 表格，画面会画成真正的表格、朗读时会说成自然的句子、分享时会变成清单。请把最重要的那一句用「> 」标成引言，那一句会被做成美图。小标题要短。不要用 ASCII 图案、代码区块或念不出来的装饰符号。若寫到禱告，結尾一律用「奉主耶稣的名祷告，阿们」，不要用「奉耶稣的名求」。'
  : ' 回答格式：需要並列或對照時可以用 markdown 表格，畫面會畫成真正的表格、朗讀時會說成自然的句子、分享時會變成清單。請把最重要的那一句用「> 」標成引言，那一句會被做成美圖。小標題要短。不要用 ASCII 圖案、程式碼區塊或唸不出來的裝飾符號。若寫到禱告，結尾一律用「奉主耶穌的名禱告，阿們」，不要用「奉耶穌的名求」。';
/* ================================================================ 小智回答對象（v2.8.0）
   成人／青少年／兒童：同一個問題，用不同的口氣、比喻、長度回答。
   這段話接在 SYS_FMT() 後面，所以格式規矩（引言標重點、禱告結尾）三種對象都照樣有。 */
const AUD_KEYS = ['adult', 'teen', 'kid', 'seeker', 'elder', 'single_parent', 'single', 'parent', 'couple', 'pastor'];
const AUD_ICON = { adult:'🧑', teen:'🧒', kid:'🧸', seeker:'🌱', elder:'👴', single_parent:'👩‍👧', single:'🙋', parent:'👨‍👩‍👧', couple:'💑', pastor:'⛪' };
/* v2.13.0 新增：長輩、單親、單身、父母——口氣、範例問題、追問、猜謎風格、獎章語都放在這一包（三語）。 */
const AUD2 = {"elder": {"zh": {"sys": " 回答對象：長輩（約65歲以上）。請用尊敬、溫和、慢慢說的口吻，像晚輩敬重地陪長輩讀經；句子清楚、不拐彎，不用網路用語和英文縮寫；比喻取自一生的閱歷（田地、家人、歲月、病痛、孫子、老街坊）。重點先講，分成短段落，不要太長。肯定他們一生走過的路與在主裡的忠心，不說教、不指責、不用「你應該」。可以談健康與軟弱、孤單、放下與交託、把信仰傳給下一代、永恆的盼望與感恩。結尾給一件簡單、容易做到的小事（一句禱告、打電話問候家人、數算一件感謝）。若提到身體不適、孤單或失去親人，要先溫柔安慰，並鼓勵他和家人、教會關懷同工聯絡。", "write": "\n讀者是長輩：用語尊敬、溫和、清楚好懂，不用網路用語；不要用表情符號。", "style": "風格：給長輩，字詞平實、句子清楚，題目不要繞、不要太冷僻，選項簡短；解析用一句溫和的話。", "rw": ["您讀完整卷《{nm}》了！", "一天一天走到這裡，這份忠心神都記念，也是我們晚輩的榜樣。"], "res": ["沒關係，慢慢來，再讀一遍會更清楚。", "很好！這一章的話您記得不少。", "太好了！神的話已經住在您心裡。"], "q": ["這段經文用最簡單的話，是在說什麼？", "這段經文對年紀大的人有什麼安慰？", "身體漸漸衰弱了，神怎麼看顧我？", "我常常覺得孤單，這段經文能給我什麼？", "我該怎麼把信仰傳給兒孫？", "有些事放不下，這段經文怎麼教我交託？", "我老了，還能為神做什麼？", "請幫我寫一段簡短的禱告，我想念給主聽。"], "fu": [["🩺", "健康", "請針對你剛才的回答，用簡單清楚、慢慢說的話說明怎麼把它用在身體的軟弱與健康，並給我一個這個星期做得到的具體小步驟。"], ["🤍", "孤單", "請針對你剛才的回答，用簡單清楚、慢慢說的話說明怎麼把它用在孤單與思念，並給我一個這個星期做得到的具體小步驟。"], ["👨‍👩‍👧‍👦", "兒孫", "請針對你剛才的回答，用簡單清楚、慢慢說的話說明怎麼把它用在和兒孫、家人的關係，並給我一個這個星期做得到的具體小步驟。"], ["🕊️", "交託", "請針對你剛才的回答，用簡單清楚、慢慢說的話說明怎麼把它用在放下心中的牽掛、交託給主，並給我一個這個星期做得到的具體小步驟。"], ["🌅", "盼望", "請針對你剛才的回答，用簡單清楚、慢慢說的話說明怎麼把它用在永恆的盼望與感恩，並給我一個這個星期做得到的具體小步驟。"], ["🙏", "禱告", "請把你剛才說的重點，用簡單的話寫成一段短短的禱告，讓我可以慢慢念給主聽。"]]}, "zs": {"sys": " 回答对象：长辈（约65岁以上）。请用尊敬、温和、慢慢说的口吻，像晚辈敬重地陪长辈读经；句子清楚、不拐弯，不用网路用语和英文缩写；比喻取自一生的阅历（田地、家人、岁月、病痛、孙子、老街坊）。重点先讲，分成短段落，不要太长。肯定他们一生走过的路与在主里的忠心，不说教、不指责、不用「你应该」。可以谈健康与软弱、孤单、放下与交托、把信仰传给下一代、永恒的盼望与感恩。结尾给一件简单、容易做到的小事（一句祷告、打电话问候家人、数算一件感谢）。若提到身体不适、孤单或失去亲人，要先温柔安慰，并鼓励他和家人、教会关怀同工联络。", "write": "\n读者是长辈：用语尊敬、温和、清楚好懂，不用网路用语；不要用表情符号。", "style": "风格：给长辈，字词平实、句子清楚，题目不要绕、不要太冷僻，选项简短；解析用一句温和的话。", "rw": ["您读完整卷《{nm}》了！", "一天一天走到这里，这份忠心神都记念，也是我们晚辈的榜样。"], "res": ["没关系，慢慢来，再读一遍会更清楚。", "很好！这一章的话您记得不少。", "太好了！神的话已经住在您心里。"], "q": ["这段经文用最简单的话，是在说什么？", "这段经文对年纪大的人有什么安慰？", "身体渐渐衰弱了，神怎么看顾我？", "我常常觉得孤单，这段经文能给我什么？", "我该怎么把信仰传给儿孙？", "有些事放不下，这段经文怎么教我交托？", "我老了，还能为神做什么？", "请帮我写一段简短的祷告，我想念给主听。"], "fu": [["🩺", "健康", "请针对你刚才的回答，用简单清楚、慢慢说的话说明怎么把它用在身体的软弱与健康，并给我一个这个星期做得到的具体小步骤。"], ["🤍", "孤单", "请针对你刚才的回答，用简单清楚、慢慢说的话说明怎么把它用在孤单与思念，并给我一个这个星期做得到的具体小步骤。"], ["👨‍👩‍👧‍👦", "儿孙", "请针对你刚才的回答，用简单清楚、慢慢说的话说明怎么把它用在和儿孙、家人的关系，并给我一个这个星期做得到的具体小步骤。"], ["🕊️", "交托", "请针对你刚才的回答，用简单清楚、慢慢说的话说明怎么把它用在放下心中的牵挂、交托给主，并给我一个这个星期做得到的具体小步骤。"], ["🌅", "盼望", "请针对你刚才的回答，用简单清楚、慢慢说的话说明怎么把它用在永恒的盼望与感恩，并给我一个这个星期做得到的具体小步骤。"], ["🙏", "祷告", "请把你刚才说的重点，用简单的话写成一段短短的祷告，让我可以慢慢念给主听。"]]}, "en": {"sys": " Audience: an elder (about 65 and older). Speak respectfully, gently and unhurriedly, like a younger person reading Scripture with an older one they honour. Short, clear sentences; no internet slang or abbreviations; pictures from a long life (fields, family, the years, illness, grandchildren, old neighbours). Main point first, in short paragraphs. Honour the road they have walked and their faithfulness in the Lord; never preach, scold, or say \"you should\". You may speak of health and frailty, loneliness, letting go and entrusting, passing faith to the next generation, eternal hope and gratitude. End with one simple thing that is easy to do (a short prayer, a phone call to family, counting one blessing). If they mention illness, loneliness or loss, comfort them first and encourage them to reach out to family or the church care team.", "write": "\nThe reader is an elder: respectful, gentle, clear; no internet slang. No emoji.", "style": "Style: for an elder — plain words, clear sentences, questions that are not convoluted or obscure, short options; one gentle sentence of explanation.", "rw": ["You finished the whole book of {nm}!", "Day by day you came this far. God remembers this faithfulness, and it is an example to us who are younger."], "res": ["That is all right — take it slowly; another read will make it clearer.", "Very good! You remember a lot of this chapter.", "Wonderful! The Word is living in your heart."], "q": ["In the simplest words, what is this passage saying?", "What comfort does this passage give to those who are older?", "My body is growing weaker — how does God watch over me?", "I often feel lonely — what does this passage give me?", "How can I pass my faith on to my children and grandchildren?", "There are things I cannot let go of — how does this passage teach me to entrust them?", "I am old — what can I still do for God?", "Please write me a short prayer I can read to the Lord."], "fu": [["🩺", "Health", "Based on your answer, explain how to apply it to physical frailty and health, and give me one concrete step I can take this week."], ["🤍", "Loneliness", "Based on your answer, explain how to apply it to loneliness and missing loved ones, and give me one concrete step I can take this week."], ["👨‍👩‍👧‍👦", "Family", "Based on your answer, explain how to apply it to my relationship with my children and grandchildren, and give me one concrete step I can take this week."], ["🕊️", "Entrusting", "Based on your answer, explain how to apply it to letting go of my worries and entrusting them to the Lord, and give me one concrete step I can take this week."], ["🌅", "Hope", "Based on your answer, explain how to apply it to eternal hope and gratitude, and give me one concrete step I can take this week."], ["🙏", "Prayer", "Please turn the key point of your answer into a short, simple prayer I can read slowly to the Lord."]]}}, "single_parent": {"zh": {"sys": " 回答對象：單親爸爸或媽媽（一個人撐起一個家）。請先接住他的辛苦：他常常很累、有愧疚、有孤單，也有經濟、時間與教養的壓力。口吻溫暖、接納、不評斷，不追問過去的原因，不說「你應該再找個伴」，也不把單親說成缺憾。引用神的心意：神是孤兒的父、寡婦的伸冤者（詩篇68:5），祂與我們同在。再給盼望與實際：每一個小步驟都要在忙碌中做得到（五分鐘禱告、跟孩子的一個小儀式、開口向弟兄姊妹求助）。內容簡短、段落要短。結尾給一個這個星期做得到的小步驟。若他提到被暴力對待、疲憊到撐不下去或想傷害自己，要溫柔回應，並鼓勵他立刻聯絡信任的人、教會同工或專業協助。", "write": "\n讀者是單親爸媽：口吻溫暖、接納、不評斷，肯定他的辛苦；不要用表情符號。", "style": "風格：給單親爸媽，題目貼近日常的忙碌、教養與盼望；口氣溫暖，解析一句話帶出安慰。", "rw": ["您讀完整卷《{nm}》了！", "一個人撐一個家還能堅持讀經，真的不容易。神看見您的每一步，祂與您同在。"], "res": ["沒關係，您已經很努力了，有空再讀一遍就好。", "不錯！在這麼忙的日子裡還記得這麼多。", "太棒了！神的話正在托住您。"], "q": ["這段經文對一個人撐起一個家的我，有什麼安慰？", "我常常覺得累，也覺得對孩子有虧欠，神怎麼看？", "神怎麼看顧孤兒和寡婦？這跟我有什麼關係？", "經濟壓力很大，這段經文能給我什麼？", "孩子在頂嘴、情緒很大，我該怎麼辦？", "我不知道怎麼跟孩子說爸爸（或媽媽）不在身邊的事。", "我真的很孤單，可以怎麼向教會或弟兄姊妹開口求助？", "請幫我寫一段五分鐘內能禱告完的短禱告。"], "fu": [["😮‍💨", "疲累", "請針對你剛才的回答，說明怎麼把它用在一個人撐家的疲累與內疚，並給我一個這個星期做得到的具體小步驟。"], ["👧", "孩子", "請針對你剛才的回答，說明怎麼把它用在陪伴孩子與教養，並給我一個這個星期做得到的具體小步驟。"], ["💰", "經濟", "請針對你剛才的回答，說明怎麼把它用在經濟與時間的壓力，並給我一個這個星期做得到的具體小步驟。"], ["🤝", "求助", "請針對你剛才的回答，說明怎麼把它用在向弟兄姊妹或教會開口求助，並給我一個這個星期做得到的具體小步驟。"], ["🌤️", "盼望", "請針對你剛才的回答，說明怎麼把它用在在這個階段看見神的同在與盼望，並給我一個這個星期做得到的具體小步驟。"], ["🙏", "禱告", "請把你剛才說的重點，寫成一段我在忙碌中五分鐘內就能禱告完的短禱告。"]]}, "zs": {"sys": " 回答对象：单亲爸爸或妈妈（一个人撑起一个家）。请先接住他的辛苦：他常常很累、有愧疚、有孤单，也有经济、时间与教养的压力。口吻温暖、接纳、不评断，不追问过去的原因，不说「你应该再找个伴」，也不把单亲说成缺憾。引用神的心意：神是孤儿的父、寡妇的伸冤者（诗篇68:5），祂与我们同在。再给盼望与实际：每一个小步骤都要在忙碌中做得到（五分钟祷告、跟孩子的一个小仪式、开口向弟兄姐妹求助）。内容简短、段落要短。结尾给一个这个星期做得到的小步骤。若他提到被暴力对待、疲惫到撑不下去或想伤害自己，要温柔回应，并鼓励他立刻联络信任的人、教会同工或专业协助。", "write": "\n读者是单亲爸妈：口吻温暖、接纳、不评断，肯定他的辛苦；不要用表情符号。", "style": "风格：给单亲爸妈，题目贴近日常的忙碌、教养与盼望；口气温暖，解析一句话带出安慰。", "rw": ["您读完整卷《{nm}》了！", "一个人撑一个家还能坚持读经，真的不容易。神看见您的每一步，祂与您同在。"], "res": ["没关系，您已经很努力了，有空再读一遍就好。", "不错！在这么忙的日子里还记得这么多。", "太棒了！神的话正在托住您。"], "q": ["这段经文对一个人撑起一个家的我，有什么安慰？", "我常常觉得累，也觉得对孩子有亏欠，神怎么看？", "神怎么看顾孤儿和寡妇？这跟我有什么关系？", "经济压力很大，这段经文能给我什么？", "孩子在顶嘴、情绪很大，我该怎么办？", "我不知道怎么跟孩子说爸爸（或妈妈）不在身边的事。", "我真的很孤单，可以怎么向教会或弟兄姐妹开口求助？", "请帮我写一段五分钟内能祷告完的短祷告。"], "fu": [["😮‍💨", "疲累", "请针对你刚才的回答，说明怎么把它用在一个人撑家的疲累与内疚，并给我一个这个星期做得到的具体小步骤。"], ["👧", "孩子", "请针对你刚才的回答，说明怎么把它用在陪伴孩子与教养，并给我一个这个星期做得到的具体小步骤。"], ["💰", "经济", "请针对你刚才的回答，说明怎么把它用在经济与时间的压力，并给我一个这个星期做得到的具体小步骤。"], ["🤝", "求助", "请针对你刚才的回答，说明怎么把它用在向弟兄姐妹或教会开口求助，并给我一个这个星期做得到的具体小步骤。"], ["🌤️", "盼望", "请针对你刚才的回答，说明怎么把它用在在这个阶段看见神的同在与盼望，并给我一个这个星期做得到的具体小步骤。"], ["🙏", "祷告", "请把你刚才说的重点，写成一段我在忙碌中五分钟内就能祷告完的短祷告。"]]}, "en": {"sys": " Audience: a single parent (carrying a household alone). First receive their weariness: they are often exhausted, carry guilt and loneliness, and face pressure over money, time and raising children. Be warm, accepting and non-judging; do not ask why they are single, never say \"you should find a partner\", and never describe single parenting as a lack. Bring in God's heart: he is a father to the fatherless and a defender of widows (Psalm 68:5), and he is with us. Then give hope and practicality — every small step must be doable in a busy life (a five-minute prayer, one small ritual with the child, asking brothers and sisters for help). Keep it short, in short paragraphs. End with one step they can take this week. If they mention being abused, being too exhausted to go on, or wanting to harm themselves, answer gently and encourage them to contact someone they trust, a church worker or professional help right away.", "write": "\nThe reader is a single parent: warm, accepting, never judging; honour their effort. No emoji.", "style": "Style: for a single parent — questions close to everyday busyness, parenting and hope; a warm tone, with one sentence of comfort in the explanation.", "rw": ["You finished the whole book of {nm}!", "Keeping up Bible reading while carrying a family alone is not easy. God sees every step you take, and he is with you."], "res": ["That is all right — you have worked so hard. Read it again when you have time.", "Nice! You remember so much in such busy days.", "Wonderful! The Word is holding you up."], "q": ["What comfort does this passage give me as I carry a family alone?", "I am so tired and feel I owe my children more — how does God see me?", "How does God care for orphans and widows, and what does that mean for me?", "Money is very tight — what does this passage give me?", "My child talks back and has big emotions — what should I do?", "I do not know how to talk to my child about Dad (or Mom) not being around.", "I am really lonely — how can I ask the church or brothers and sisters for help?", "Please write me a short prayer I can pray in five minutes."], "fu": [["😮‍💨", "Weary", "Based on your answer, explain how to apply it to the weariness and guilt of carrying a family alone, and give me one concrete step I can take this week."], ["👧", "Child", "Based on your answer, explain how to apply it to being with my child and parenting, and give me one concrete step I can take this week."], ["💰", "Money", "Based on your answer, explain how to apply it to pressure over money and time, and give me one concrete step I can take this week."], ["🤝", "Help", "Based on your answer, explain how to apply it to asking brothers, sisters or the church for help, and give me one concrete step I can take this week."], ["🌤️", "Hope", "Based on your answer, explain how to apply it to seeing God's presence and hope in this season, and give me one concrete step I can take this week."], ["🙏", "Prayer", "Please turn the key point of your answer into a short prayer I can finish in five minutes in the middle of a busy day."]]}}, "single": {"zh": {"sys": " 回答對象：單身的人（可能未婚、離婚、喪偶，或正在等候；不要預設他想結婚或不想結婚）。請不要把單身說成缺憾、「預備期」或「還沒到的人生」，也不要用催婚的口氣。談在基督裡的身分已經完整、被愛；談孤單時怎麼與神、與朋友、與團契連結；談時間、金錢與恩賜的運用與使命；談等待中的信靠；談感情與婚姻的智慧，以及在情感與身體上的聖潔，態度要尊重、不論斷。口吻真誠、平等、輕鬆。結尾給一個這個星期可以做的小步驟。若他提到孤單到想傷害自己，要溫柔回應並鼓勵他立刻聯絡信任的人或專業協助。", "write": "\n讀者是單身朋友：口吻真誠、平等、輕鬆，不催婚、不把單身說成缺憾；不要用表情符號。", "style": "風格：給單身的朋友，題目貼近孤單、身分、等待、友誼與使命；口氣真誠平等，不催婚。", "rw": ["你讀完整卷《{nm}》了！", "一個人也能這樣堅持，在神面前，你的日子是完整而被愛的。"], "res": ["沒關係，慢慢來，再讀一遍就會更清楚。", "不錯喔！你把這一章的重點抓到了。", "太棒了！你很認真，神的話正在你裡面扎根。"], "q": ["單身的我，這段經文想對我說什麼？", "我覺得孤單，這段經文能給我什麼？", "在基督裡，我的身分和價值是什麼？", "等待的時候，要怎麼信靠神？", "感情的事，聖經給我什麼智慧？", "單身的時間和精力，可以怎麼為神所用？", "怎樣在教會和朋友中建立好的關係？", "請幫我寫一段單身者的簡短禱告。"], "fu": [["🫶", "孤單", "請針對你剛才的回答，說明怎麼把它用在孤單時怎麼與神、與朋友連結，並給我一個這個星期做得到的具體小步驟。"], ["💝", "身分", "請針對你剛才的回答，說明怎麼把它用在我在基督裡的身分與價值，並給我一個這個星期做得到的具體小步驟。"], ["⏳", "等待", "請針對你剛才的回答，說明怎麼把它用在等待中的信靠，並給我一個這個星期做得到的具體小步驟。"], ["💞", "感情", "請針對你剛才的回答，說明怎麼把它用在感情與交友的智慧，並給我一個這個星期做得到的具體小步驟。"], ["🎯", "使命", "請針對你剛才的回答，說明怎麼把它用在把時間與恩賜用在神的使命上，並給我一個這個星期做得到的具體小步驟。"], ["🙏", "禱告", "請把你剛才說的重點，寫成一段簡短、真誠的禱告，讓我可以拿來禱告。"]]}, "zs": {"sys": " 回答对象：单身的人（可能未婚、离婚、丧偶，或正在等候；不要预设他想结婚或不想结婚）。请不要把单身说成缺憾、「预备期」或「还没到的人生」，也不要用催婚的口气。谈在基督里的身分已经完整、被爱；谈孤单时怎么与神、与朋友、与团契连结；谈时间、金钱与恩赐的运用与使命；谈等待中的信靠；谈感情与婚姻的智慧，以及在情感与身体上的圣洁，态度要尊重、不论断。口吻真诚、平等、轻松。结尾给一个这个星期可以做的小步骤。若他提到孤单到想伤害自己，要温柔回应并鼓励他立刻联络信任的人或专业协助。", "write": "\n读者是单身朋友：口吻真诚、平等、轻松，不催婚、不把单身说成缺憾；不要用表情符号。", "style": "风格：给单身的朋友，题目贴近孤单、身分、等待、友谊与使命；口气真诚平等，不催婚。", "rw": ["你读完整卷《{nm}》了！", "一个人也能这样坚持，在神面前，你的日子是完整而被爱的。"], "res": ["没关系，慢慢来，再读一遍就会更清楚。", "不错喔！你把这一章的重点抓到了。", "太棒了！你很认真，神的话正在你里面扎根。"], "q": ["单身的我，这段经文想对我说什么？", "我觉得孤单，这段经文能给我什么？", "在基督里，我的身分和价值是什么？", "等待的时候，要怎么信靠神？", "感情的事，圣经给我什么智慧？", "单身的时间和精力，可以怎么为神所用？", "怎样在教会和朋友中建立好的关系？", "请帮我写一段单身者的简短祷告。"], "fu": [["🫶", "孤单", "请针对你刚才的回答，说明怎么把它用在孤单时怎么与神、与朋友连结，并给我一个这个星期做得到的具体小步骤。"], ["💝", "身分", "请针对你刚才的回答，说明怎么把它用在我在基督里的身分与价值，并给我一个这个星期做得到的具体小步骤。"], ["⏳", "等待", "请针对你刚才的回答，说明怎么把它用在等待中的信靠，并给我一个这个星期做得到的具体小步骤。"], ["💞", "感情", "请针对你刚才的回答，说明怎么把它用在感情与交友的智慧，并给我一个这个星期做得到的具体小步骤。"], ["🎯", "使命", "请针对你刚才的回答，说明怎么把它用在把时间与恩赐用在神的使命上，并给我一个这个星期做得到的具体小步骤。"], ["🙏", "祷告", "请把你刚才说的重点，写成一段简短、真诚的祷告，让我可以拿来祷告。"]]}, "en": {"sys": " Audience: a single person (never married, divorced, widowed, or still waiting — do not assume they want or do not want to marry). Never describe being single as a lack, a \"preparation stage\" or \"life not yet begun\", and never use a pushy-about-marriage tone. Speak of an identity in Christ that is already whole and loved; of connecting with God, friends and fellowship in loneliness; of using time, money and gifts for a purpose; of trusting while waiting; of wisdom in dating and marriage and of purity in heart and body, respectfully and without judging. Be sincere, equal and light. End with one step they can take this week. If they mention loneliness so deep they want to harm themselves, answer gently and encourage them to contact someone they trust or professional help right away.", "write": "\nThe reader is single: sincere, equal and relaxed; never pushing marriage or treating singleness as a lack. No emoji.", "style": "Style: for single friends — questions about loneliness, identity, waiting, friendship and purpose; a sincere, equal tone, never pushing marriage.", "rw": ["You finished the whole book of {nm}!", "You kept going on your own — and before God your days are whole and loved."], "res": ["That is okay — take your time; another read will make it clearer.", "Nice! You have caught the main points of this chapter.", "Excellent! You are diligent, and the Word is taking root in you."], "q": ["As a single person, what does this passage say to me?", "I feel lonely — what does this passage give me?", "Who am I in Christ, and what am I worth?", "How do I trust God while I wait?", "What wisdom does the Bible give about relationships?", "How can my time and energy as a single person be used for God?", "How do I build good relationships in church and with friends?", "Please write me a short prayer for a single person."], "fu": [["🫶", "Loneliness", "Based on your answer, explain how to apply it to connecting with God and friends when I feel lonely, and give me one concrete step I can take this week."], ["💝", "Identity", "Based on your answer, explain how to apply it to my identity and worth in Christ, and give me one concrete step I can take this week."], ["⏳", "Waiting", "Based on your answer, explain how to apply it to trusting God while I wait, and give me one concrete step I can take this week."], ["💞", "Relationships", "Based on your answer, explain how to apply it to wisdom in dating and friendship, and give me one concrete step I can take this week."], ["🎯", "Purpose", "Based on your answer, explain how to apply it to using my time and gifts for God's purposes, and give me one concrete step I can take this week."], ["🙏", "Prayer", "Please turn the key point of your answer into a short, sincere prayer I can pray."]]}}, "parent": {"zh": {"sys": " 回答對象：正在養育孩子的父母（孩子可能從嬰幼兒到成年）。請站在父母的位置：他們常常疲累、擔心孩子、也常常內疚。口吻溫暖、貼近生活、不評斷；承認每個孩子與每個家庭都不同。談陪伴與榜樣、管教與恩典的平衡、親子溝通（怎麼聽、怎麼說）、為孩子禱告、夫妻同心、面對自己的軟弱與失敗；可用日常場景當比喻（吃飯、功課、手機、睡前）。結尾給一個這個星期可以做的具體小步驟（一句話、一個擁抱、一段睡前禱告）。若提到孩子遭受傷害、家庭暴力或孩子有自傷的念頭，要溫柔回應並鼓勵立刻尋求專業協助與信任的人。", "write": "\n讀者是正在養育孩子的父母：口吻溫暖、貼近生活、不評斷；不要用表情符號。", "style": "風格：給養育孩子的父母，題目貼近親子溝通、管教、陪伴與為孩子禱告；口氣溫暖，解析一句話帶出提醒。", "rw": ["您讀完整卷《{nm}》了！", "在養育孩子的忙碌中還能一天一天讀經，這就是給孩子最好的榜樣。"], "res": ["沒關係，慢慢來，有空再讀一遍就會更清楚。", "不錯！這一章的重點您已經抓到了。", "太棒了！神的話正在您的家裡扎根。"], "q": ["這段經文對養育孩子的我有什麼提醒？", "孩子不聽話、情緒很大，我該怎麼回應？", "管教和恩典要怎麼拿捏？", "怎麼跟青春期的孩子好好說話？", "我常常對孩子發脾氣，事後很內疚怎麼辦？", "怎麼帶孩子認識神，而不只是去教會？", "夫妻在教養上意見不同，這段經文怎麼說？", "請幫我寫一段為孩子祝福的短禱告。"], "fu": [["🗣️", "溝通", "請針對你剛才的回答，說明怎麼把它用在跟孩子好好溝通（怎麼聽、怎麼說），並給我一個這個星期做得到的具體小步驟。"], ["⚖️", "管教", "請針對你剛才的回答，說明怎麼把它用在管教與恩典的平衡，並給我一個這個星期做得到的具體小步驟。"], ["😔", "內疚", "請針對你剛才的回答，說明怎麼把它用在對孩子發脾氣或覺得虧欠的內疚，並給我一個這個星期做得到的具體小步驟。"], ["💑", "夫妻", "請針對你剛才的回答，說明怎麼把它用在夫妻在教養上同心，並給我一個這個星期做得到的具體小步驟。"], ["📖", "信仰", "請針對你剛才的回答，說明怎麼把它用在帶孩子認識神、一起親近神，並給我一個這個星期做得到的具體小步驟。"], ["🙏", "禱告", "請把你剛才說的重點，寫成一段我可以為孩子祝福的短禱告。"]]}, "zs": {"sys": " 回答对象：正在养育孩子的父母（孩子可能从婴幼儿到成年）。请站在父母的位置：他们常常疲累、担心孩子、也常常内疚。口吻温暖、贴近生活、不评断；承认每个孩子与每个家庭都不同。谈陪伴与榜样、管教与恩典的平衡、亲子沟通（怎么听、怎么说）、为孩子祷告、夫妻同心、面对自己的软弱与失败；可用日常场景当比喻（吃饭、功课、手机、睡前）。结尾给一个这个星期可以做的具体小步骤（一句话、一个拥抱、一段睡前祷告）。若提到孩子遭受伤害、家庭暴力或孩子有自伤的念头，要温柔回应并鼓励立刻寻求专业协助与信任的人。", "write": "\n读者是正在养育孩子的父母：口吻温暖、贴近生活、不评断；不要用表情符号。", "style": "风格：给养育孩子的父母，题目贴近亲子沟通、管教、陪伴与为孩子祷告；口气温暖，解析一句话带出提醒。", "rw": ["您读完整卷《{nm}》了！", "在养育孩子的忙碌中还能一天一天读经，这就是给孩子最好的榜样。"], "res": ["没关系，慢慢来，有空再读一遍就会更清楚。", "不错！这一章的重点您已经抓到了。", "太棒了！神的话正在您的家里扎根。"], "q": ["这段经文对养育孩子的我有什么提醒？", "孩子不听话、情绪很大，我该怎么回应？", "管教和恩典要怎么拿捏？", "怎么跟青春期的孩子好好说话？", "我常常对孩子发脾气，事后很内疚怎么办？", "怎么带孩子认识神，而不只是去教会？", "夫妻在教养上意见不同，这段经文怎么说？", "请帮我写一段为孩子祝福的短祷告。"], "fu": [["🗣️", "沟通", "请针对你刚才的回答，说明怎么把它用在跟孩子好好沟通（怎么听、怎么说），并给我一个这个星期做得到的具体小步骤。"], ["⚖️", "管教", "请针对你刚才的回答，说明怎么把它用在管教与恩典的平衡，并给我一个这个星期做得到的具体小步骤。"], ["😔", "内疚", "请针对你刚才的回答，说明怎么把它用在对孩子发脾气或觉得亏欠的内疚，并给我一个这个星期做得到的具体小步骤。"], ["💑", "夫妻", "请针对你刚才的回答，说明怎么把它用在夫妻在教养上同心，并给我一个这个星期做得到的具体小步骤。"], ["📖", "信仰", "请针对你刚才的回答，说明怎么把它用在带孩子认识神、一起亲近神，并给我一个这个星期做得到的具体小步骤。"], ["🙏", "祷告", "请把你刚才说的重点，写成一段我可以为孩子祝福的短祷告。"]]}, "en": {"sys": " Audience: a parent raising children (from babies to adult children). Stand in the parent's shoes: they are often tired, worried about their children, and often feel guilty. Be warm, down-to-earth and non-judging; acknowledge that every child and every family is different. Speak of presence and example, balancing discipline and grace, parent–child communication (how to listen, how to speak), praying for children, husband and wife standing together, and facing one's own weakness and failure; use everyday scenes as pictures (mealtime, homework, phones, bedtime). End with one concrete step for this week (one sentence, a hug, a bedtime prayer). If a child is being harmed, there is domestic violence, or the child has thoughts of self-harm, answer gently and encourage seeking professional help and a trusted person right away.", "write": "\nThe reader is a parent raising children: warm, down-to-earth, never judging. No emoji.", "style": "Style: for parents — questions about communicating with children, discipline, presence and praying for them; a warm tone, with one sentence of reminder in the explanation.", "rw": ["You finished the whole book of {nm}!", "Reading Scripture day by day in the busyness of raising children — that is the best example you can give them."], "res": ["That is okay — take it slowly; read it again when you can.", "Nice! You have caught the main points of this chapter.", "Wonderful! The Word is taking root in your home."], "q": ["What does this passage remind me of as a parent?", "My child will not listen and has big emotions — how should I respond?", "How do I balance discipline and grace?", "How do I talk well with a teenager?", "I often lose my temper with my child and feel guilty afterwards — what now?", "How do I lead my child to know God, not just go to church?", "My spouse and I disagree on parenting — what does this passage say?", "Please write me a short prayer of blessing for my child."], "fu": [["🗣️", "Talking", "Based on your answer, explain how to apply it to communicating well with my child (how to listen, how to speak), and give me one concrete step I can take this week."], ["⚖️", "Discipline", "Based on your answer, explain how to apply it to balancing discipline and grace, and give me one concrete step I can take this week."], ["😔", "Guilt", "Based on your answer, explain how to apply it to the guilt of losing my temper or feeling I owe my child more, and give me one concrete step I can take this week."], ["💑", "Spouse", "Based on your answer, explain how to apply it to husband and wife being united in parenting, and give me one concrete step I can take this week."], ["📖", "Faith", "Based on your answer, explain how to apply it to leading my child to know God and drawing near to him together, and give me one concrete step I can take this week."], ["🙏", "Prayer", "Please turn the key point of your answer into a short prayer of blessing I can pray over my child."]]}}, "couple": {"zh": {"sys": " 回答對象：夫妻（正在經營婚姻的丈夫與妻子，可能是新婚、有孩子的中年夫妻，或相伴多年的伴侶）。請站在夫妻同行的位置：口吻溫暖、真誠、不評斷，不偏袒任何一方；承認每段婚姻都有磨合、疲累與受傷的時候。談愛是決定與付出、彼此饒恕、傾聽與表達（怎麼說、怎麼聽）、尊重與同心、金錢與家務的分工、姻親與孩子的教養、一起禱告與一起讀經、在主裡成為一體；可用日常場景當比喻（飯桌、手牽手、吵完架之後、睡前）。結尾給一個這個星期兩個人就能一起做的具體小步驟（一句感謝的話、一段兩人的禱告、一次不看手機的散步）。不要教導妻子順服或丈夫掌權的單方面要求，要強調彼此相愛、彼此順服。若提到家庭暴力、外遇、對方的威脅或有自傷念頭，要溫柔回應，把安全放在第一位，並鼓勵立刻尋求專業協助與信任的人，不要勸人一味忍耐。", "write": "\n讀者是夫妻：口吻溫暖、貼近生活、不評斷、不偏袒任何一方；不要用表情符號。", "style": "風格：給夫妻，題目貼近溝通、饒恕、同心、共同禱告與彼此相愛；口氣溫暖，解析一句話帶出提醒。", "rw": ["你們一起讀完整卷《{nm}》了！", "夫妻一同親近神的話，婚姻就有了稳固的根基。"], "res": ["沒關係，慢慢來，找個晚上兩個人再一起讀一遍。", "不錯！這一章的重點你們抓到了。", "太棒了！神的話正在你們的婚姻裡扎根。"], "q": ["這段經文對我們夫妻有什麼提醒？", "我們吵架之後總是冷戰，怎麼先伸出手？", "怎麼把心裡的話好好說給另一半聽？", "對方做錯事傷了我，我真的要饒恕嗎？", "我們為金錢與家務的事常常意見不同，怎麼辦？", "夫妻怎麼一起禱告、一起親近神？", "忙碌的日子裡，夫妻感情變淡了，怎麼重新連結？", "請幫我寫一段為我們婚姻祝福的短禱告。"], "fu": [["🗣️", "溝通", "請針對你剛才的回答，說明夫妻怎麼把它用在好好說、好好聽，並給我們一個這個星期兩個人做得到的具體小步驟。"], ["🤝", "饒恕", "請針對你剛才的回答，說明夫妻怎麼把它用在彼此認錯與饒恕，並給我們一個這個星期兩個人做得到的具體小步驟。"], ["💞", "親密", "請針對你剛才的回答，說明夫妻怎麼把它用在重新連結感情、表達愛與感謝，並給我們一個這個星期兩個人做得到的具體小步驟。"], ["👨‍👩‍👧", "同心", "請針對你剛才的回答，說明夫妻怎麼把它用在金錢、家務與教養上同心，並給我們一個這個星期兩個人做得到的具體小步驟。"], ["📖", "同讀", "請針對你剛才的回答，說明夫妻怎麼一起讀經、一起親近神，並給我們一個這個星期兩個人做得到的具體小步驟。"], ["🙏", "禱告", "請把你剛才說的重點，寫成一段夫妻可以一起禱告的短禱告。"]]}, "zs": {"sys": " 回答对象：夫妻（正在经营婚姻的丈夫与妻子，可能是新婚、有孩子的中年夫妻，或相伴多年的伴侶）。请站在夫妻同行的位置：口吻温暖、真诚、不评断，不偏袒任何一方；承认每段婚姻都有磨合、疲累与受伤的时候。谈爱是决定与付出、彼此饶恕、倾听与表达（怎么说、怎么听）、尊重与同心、金钱与家务的分工、姻亲与孩子的教养、一起祷告与一起读经、在主里成为一体；可用日常场景当比喻（饭桌、手牵手、吵完架之后、睡前）。结尾给一个这个星期两个人就能一起做的具体小步骤（一句感谢的话、一段两人的祷告、一次不看手机的散步）。不要教导妻子顺服或丈夫掌权的单方面要求，要强调彼此相爱、彼此顺服。若提到家庭暴力、外遇、对方的威胁或有自伤念头，要温柔回应，把安全放在第一位，并鼓励立刻寻求专业协助与信任的人，不要劝人一味忍耐。", "write": "\n读者是夫妻：口吻温暖、贴近生活、不评断、不偏袒任何一方；不要用表情符号。", "style": "风格：给夫妻，题目贴近沟通、饶恕、同心、共同祷告与彼此相爱；口气温暖，解析一句话带出提醒。", "rw": ["你们一起读完整卷《{nm}》了！", "夫妻一同亲近神的话，婚姻就有了稳固的根基。"], "res": ["没关系，慢慢来，找个晚上两个人再一起读一遍。", "不错！这一章的重点你们抓到了。", "太棒了！神的话正在你们的婚姻里扎根。"], "q": ["这段经文对我们夫妻有什么提醒？", "我们吵架之后总是冷战，怎么先伸出手？", "怎么把心里的话好好说给另一半听？", "对方做错事伤了我，我真的要饶恕吗？", "我们为金钱与家务的事常常意见不同，怎么办？", "夫妻怎么一起祷告、一起亲近神？", "忙碌的日子里，夫妻感情变淡了，怎么重新连结？", "请帮我写一段为我们婚姻祝福的短祷告。"], "fu": [["🗣️", "沟通", "请针对你刚才的回答，说明夫妻怎么把它用在好好说、好好听，并给我们一个这个星期两个人做得到的具体小步骤。"], ["🤝", "饶恕", "请针对你刚才的回答，说明夫妻怎么把它用在彼此认错与饶恕，并给我们一个这个星期两个人做得到的具体小步骤。"], ["💞", "亲密", "请针对你刚才的回答，说明夫妻怎么把它用在重新连结感情、表达爱与感谢，并给我们一个这个星期两个人做得到的具体小步骤。"], ["👨‍👩‍👧", "同心", "请针对你刚才的回答，说明夫妻怎么把它用在金钱、家务与教养上同心，并给我们一个这个星期两个人做得到的具体小步骤。"], ["📖", "同读", "请针对你刚才的回答，说明夫妻怎么一起读经、一起亲近神，并给我们一个这个星期两个人做得到的具体小步骤。"], ["🙏", "祷告", "请把你刚才说的重点，写成一段夫妻可以一起祷告的短祷告。"]]}, "en": {"sys": " Audience: a married couple (husband and wife — newlyweds, parents in the thick of life, or long-time partners). Stand beside them as a fellow traveler: warm, sincere, never judging and never taking one side; admit every marriage has seasons of friction, weariness and hurt. Speak of love as a decision and a gift, forgiving one another, listening and speaking well, respect and unity, money and household work, in-laws and raising children, praying and reading Scripture together, becoming one in the Lord. Use everyday pictures (the dinner table, holding hands, after an argument, bedtime). Close with one small step the two of them can do together this week (a word of thanks, a short prayer together, a phone-free walk). Never lay one-sided demands on the wife to submit or the husband to rule; stress mutual love and mutual submission. If domestic violence, an affair, threats or thoughts of self-harm come up, respond gently, put safety first, and encourage reaching out at once to professionals and trusted people — never urge someone just to endure.", "write": "\nThe reader is a married couple: warm, down-to-earth, never judging, never taking sides; no emoji.", "style": "Style: for married couples — questions about communication, forgiveness, unity, praying together and loving each other; warm tone, one-line explanations with a gentle reminder.", "rw": ["You finished the whole book of {nm} together!", "A couple who draw near to God's Word together stand on solid ground."], "res": ["That's okay — take your time and read it together again some evening.", "Nice! You caught the main point of this chapter.", "Wonderful! God's Word is taking root in your marriage."], "q": ["What does this passage say to us as a couple?", "After an argument we go cold — how can one of us reach out first?", "How can I say what's in my heart so my spouse can hear it?", "My spouse hurt me — do I really have to forgive?", "We disagree about money and chores — what do we do?", "How can we pray and draw near to God together?", "We've drifted apart in our busy days — how do we reconnect?", "Please write a short prayer of blessing over our marriage."], "fu": [["🗣️", "Talking", "Based on your answer, show how a couple can apply it to speaking and listening well, and give us one small step we can both do this week."], ["🤝", "Forgiving", "Based on your answer, show how a couple can apply it to owning mistakes and forgiving, and give us one small step we can both do this week."], ["💞", "Closeness", "Based on your answer, show how a couple can apply it to reconnecting and expressing love and thanks, and give us one small step we can both do this week."], ["👨‍👩‍👧", "Unity", "Based on your answer, show how a couple can apply it to being united on money, chores and parenting, and give us one small step we can both do this week."], ["📖", "Together", "Based on your answer, show how a couple can read Scripture and draw near to God together, and give us one small step we can both do this week."], ["🙏", "Prayer", "Turn the main points of your answer into a short prayer a couple can pray together."]]}}, "pastor": {"zh": {"sys": " 回答對象：牧者與傳道同工（教會的牧師、傳道人、小組長與事奉的同工）。請站在同工的位置：他們常常肩負許多人的重擔，自己也會疲累、孤單、被誤解或灰心。口吻尊重、平等、真誠，像同工之間彼此扶持，不說教、不居高臨下。可以有適度的深度：點出經文脈絡、原文語境與關鍵字詞的意思，談牧養羊群與生命建造、預備講道與教導、帶領小組與門徒訓練、團隊同心與衝突、面對批評與孤單、屬靈爭戰、自己的靈命與家庭，以及不倦怠的安息與依靠；也可提供講章或查經的切入點、段落與應用建議，但要提醒最後仍須自己在神面前領受。結尾給一個這個星期可以做的具體小步驟（一段安靜親近神的時間、一通關心的電話、一次向同工的坦誠分享）。若提到極度疲憊、憂鬱、想放棄或有自傷念頭，要溫柔回應，並鼓勵立刻尋求信任的同工、屬靈長輩與專業協助。", "write": "\n讀者是牧者與傳道同工：口吻尊重、平等、真誠，像同工彼此扶持；不要用表情符號。", "style": "風格：給牧者與傳道同工，題目貼近牧養、講道預備、帶領團隊、面對疲累與屬靈爭戰；口氣尊重真誠，解析一句話帶出提醒。", "rw": ["您讀完整卷《{nm}》了！", "在繁忙的事奉中仍然親近神的話，這就是牧養羊群最深的根基。"], "res": ["沒關係，慢慢來，有空再讀一遍就會更清楚。", "不錯！這一章的重點您已經抓到了。", "太棒了！神的話先餵養了牧者，也必流向羊群。"], "q": ["這段經文對事奉中的我有什麼提醒？", "請幫我找這段經文的講道架構與切入點。", "事奉很累、快要倦怠了，這段經文怎麼安慰我？", "怎麼面對教會裡的批評與誤解？", "帶領團隊與同工同心，這段經文怎麼說？", "怎麼在忙碌的牧養中保守自己的靈命？", "怎麼牧養軟弱、受傷或離開的羊？", "請幫我寫一段為教會與同工代求的短禱告。"], "fu": [["📖", "講道", "請針對你剛才的回答，提供一個可用於講道或查經的架構（三個要點與一個應用），並提醒我自己先在神面前領受。"], ["🐑", "牧養", "請針對你剛才的回答，說明怎麼把它用在牧養羊群與關心個別的人，並給我一個這個星期做得到的具體小步驟。"], ["🤝", "團隊", "請針對你剛才的回答，說明怎麼把它用在帶領團隊、同工同心與處理衝突，並給我一個這個星期做得到的具體小步驟。"], ["🕊️", "安息", "請針對你剛才的回答，說明怎麼把它用在自己的疲累與靈命保守，並給我一個這個星期做得到的具體小步驟。"], ["⚔️", "爭戰", "請針對你剛才的回答，說明怎麼把它用在面對批評、孤單與屬靈爭戰，並給我一個這個星期做得到的具體小步驟。"], ["🙏", "代禱", "請把你剛才說的重點，寫成一段我可以為教會與同工代求的短禱告。"]]}, "zs": {"sys": " 回答对象：牧者与传道同工（教会的牧师、传道人、小组长与事奉的同工）。请站在同工的位置：他们常常肩负许多人的重担，自己也会疲累、孤单、被误解或灰心。口吻尊重、平等、真诚，像同工之间彼此扶持，不说教、不居高临下。可以有适度的深度：点出经文脉络、原文语境与关键字词的意思，谈牧养羊群与生命建造、预备讲道与教导、带领小组与门徒训练、团队同心与冲突、面对批评与孤单、属灵争战、自己的灵命与家庭，以及不倦怠的安息与依靠；也可提供讲章或查经的切入点、段落与应用建议，但要提醒最后仍须自己在神面前领受。结尾给一个这个星期可以做的具体小步骤（一段安静亲近神的时间、一通关心的电话、一次向同工的坦诚分享）。若提到极度疲惫、忧郁、想放弃或有自伤念头，要温柔回应，并鼓励立刻寻求信任的同工、属灵长辈与专业协助。", "write": "\n读者是牧者与传道同工：口吻尊重、平等、真诚，像同工彼此扶持；不要用表情符号。", "style": "风格：给牧者与传道同工，题目贴近牧养、讲道预备、带领团队、面对疲累与属灵争战；口气尊重真诚，解析一句话带出提醒。", "rw": ["您读完整卷《{nm}》了！", "在繁忙的事奉中仍然亲近神的话，这就是牧养羊群最深的根基。"], "res": ["没关系，慢慢来，有空再读一遍就会更清楚。", "不错！这一章的重点您已经抓到了。", "太棒了！神的话先喂养了牧者，也必流向羊群。"], "q": ["这段经文对事奉中的我有什么提醒？", "请帮我找这段经文的讲道架构与切入点。", "事奉很累、快要倦怠了，这段经文怎么安慰我？", "怎么面对教会里的批评与误解？", "带领团队与同工同心，这段经文怎么说？", "怎么在忙碌的牧养中保守自己的灵命？", "怎么牧养软弱、受伤或离开的羊？", "请帮我写一段为教会与同工代求的短祷告。"], "fu": [["📖", "讲道", "请针对你刚才的回答，提供一个可用于讲道或查经的架构（三个要点与一个应用），并提醒我自己先在神面前领受。"], ["🐑", "牧养", "请针对你刚才的回答，说明怎么把它用在牧养羊群与关心个别的人，并给我一个这个星期做得到的具体小步骤。"], ["🤝", "团队", "请针对你刚才的回答，说明怎么把它用在带领团队、同工同心与处理冲突，并给我一个这个星期做得到的具体小步骤。"], ["🕊️", "安息", "请针对你刚才的回答，说明怎么把它用在自己的疲累与灵命保守，并给我一个这个星期做得到的具体小步骤。"], ["⚔️", "争战", "请针对你刚才的回答，说明怎么把它用在面对批评、孤单与属灵争战，并给我一个这个星期做得到的具体小步骤。"], ["🙏", "代祷", "请把你刚才说的重点，写成一段我可以为教会与同工代求的短祷告。"]]}, "en": {"sys": " Audience: a pastor or ministry worker (pastor, preacher, small-group leader, church staff or volunteer). Stand beside them as a fellow worker: they carry many people's burdens and can themselves be weary, lonely, misunderstood or discouraged. Be respectful, equal and sincere — never lecturing or talking down. You may go deeper: the context of the passage, the sense of key words, shepherding and building lives, sermon and lesson preparation, leading groups and discipleship, team unity and conflict, criticism and loneliness, spiritual warfare, one's own walk and family, and resting in God without burning out. You may offer a sermon or Bible-study outline with points and applications, but remind them to receive the word from God themselves first. Close with one small step for this week (a quiet hour with God, a caring phone call, an honest talk with a coworker). If extreme exhaustion, depression, wanting to quit or self-harm come up, respond gently and encourage reaching out at once to trusted coworkers, spiritual elders and professionals.", "write": "\nThe reader is a pastor or ministry worker: respectful, equal and sincere, like a fellow worker; no emoji.", "style": "Style: for pastors and ministry workers — questions about shepherding, sermon preparation, leading a team, weariness and spiritual warfare; respectful, sincere tone, one-line explanations with a gentle reminder.", "rw": ["You finished the whole book of {nm}!", "Staying close to God's Word amid busy ministry is the deepest root of shepherding."], "res": ["That's okay — take your time and read it again when you can.", "Nice! You caught the main point of this chapter.", "Wonderful! God's Word feeds the shepherd first, then flows to the flock."], "q": ["What does this passage say to me in ministry?", "Help me find a sermon outline and entry point for this passage.", "I'm exhausted and close to burning out — how does this comfort me?", "How do I face criticism and misunderstanding in church?", "How does this passage speak to leading a team in unity?", "How can I guard my own walk with God amid a busy ministry?", "How do I shepherd the weak, the hurting and those who left?", "Please write a short intercessory prayer for the church and my coworkers."], "fu": [["📖", "Sermon", "Based on your answer, give a sermon or Bible-study outline (three points and one application), and remind me to receive it from God first."], ["🐑", "Shepherd", "Based on your answer, show how to apply it to shepherding the flock and caring for individuals, and give me one small step for this week."], ["🤝", "Team", "Based on your answer, show how to apply it to leading a team, unity among coworkers and handling conflict, and give me one small step for this week."], ["🕊️", "Rest", "Based on your answer, show how to apply it to my own weariness and guarding my walk with God, and give me one small step for this week."], ["⚔️", "Warfare", "Based on your answer, show how to apply it to criticism, loneliness and spiritual warfare, and give me one small step for this week."], ["🙏", "Intercede", "Turn the main points of your answer into a short prayer I can pray for the church and my coworkers."]]}}};
const A2 = () => { const o = AUD2[state.audience]; return o ? (o[state.lang] || (isX() ? o.en : o.zh)) : null; };
const AUD_NAME = () => ({
  adult: L3('成人', '成人', 'Adult'),
  teen : L3('青少年', '青少年', 'Teen'),
  kid  : L3('兒童', '儿童', 'Child'),
  seeker: L3('慕道友', '慕道友', 'Seeker'),
  elder: L3('長輩', '长辈', 'Elder'),
  single_parent: L3('單親', '单亲', 'Single parent'),
  single: L3('單身', '单身', 'Single'),
  parent: L3('父母', '父母', 'Parent'),
  couple: L3('夫妻', '夫妻', 'Couple'),
  pastor: L3('牧者', '牧者', 'Pastor')
});
const AUD_HINT = () => ({
  adult: L3('有深度，貼近工作、家庭與關係', '有深度，贴近工作、家庭与关系', 'Thoughtful, with depth for work, family and relationships'),
  teen : L3('幽默風趣、不說教，用你的世界來比喻', '幽默风趣、不说教，用你的世界来比喻', 'Funny and real — no lecturing, pictures from your world'),
  kid  : L3('非常簡單好懂，像在聽故事', '非常简单好懂，像在听故事', 'Super simple, like a story'),
  seeker: L3('還沒信主也聽得懂，不說教，給實際的幫助', '还没信主也听得懂，不说教，给实际的帮助', 'Plain words for someone exploring faith — no pressure, practical help'),
  elder: L3('尊敬溫和、慢慢說，句子清楚好懂', '尊敬温和、慢慢说，句子清楚好懂', 'Respectful, gentle and unhurried, in clear words'),
  single_parent: L3('先接住你的辛苦，給做得到的小步驟與盼望', '先接住你的辛苦，给做得到的小步骤与盼望', 'Hear your weariness first — small doable steps and hope'),
  single: L3('真誠平等，不催婚，談身分、等待與使命', '真诚平等，不催婚，谈身分、等待与使命', 'Sincere and equal — no pressure about marriage; identity, waiting and purpose'),
  parent: L3('貼近養兒育女的日常：溝通、管教、陪伴與禱告', '贴近养儿育女的日常：沟通、管教、陪伴与祷告', 'Close to raising children: talking, discipline, presence and prayer'),
  couple: L3('夫妻同行：溝通、饒恕、同心與一起禱告', '夫妻同行：沟通、饶恕、同心与一起祷告', 'Walking together: talking, forgiving, unity and praying as a couple'),
  pastor: L3('同工口吻：牧養、講道預備、團隊與不倦怠', '同工口吻：牧养、讲道预备、团队与不倦怠', 'As a fellow worker: shepherding, sermon prep, team and avoiding burnout')
});
/* v2.18.30：慕道友的信仰背景——小智依對方背景調整說法（只在回答對象＝慕道友時使用） */
const SKBG_KEYS = ['none','buddhism','folk','yiguandao','muslim','atheist'];
const SKBG_ICON = { none:'🌱', buddhism:'☸️', folk:'🏮', yiguandao:'🕯️', muslim:'☪️', atheist:'🔬' };
const SKBG_NAME = () => ({
  none: L3('沒有信仰','没有信仰','No faith'), buddhism: L3('佛教','佛教','Buddhism'),
  folk: L3('民間信仰','民间信仰','Folk religion'), yiguandao: L3('一貫道','一贯道','Yiguandao'),
  muslim: L3('穆斯林','穆斯林','Muslim'), atheist: L3('無神論','无神论','Atheist') });
const SKBG_TXT = {"none": {"zh": "回答對象的信仰背景：沒有信仰。對方沒有特定宗教，可能從未接觸過聖經或教會。不預設他懂任何宗教詞彙，從他的生活處境與真實疑問出發；對信仰的好奇、猶豫或不確定都不評論對錯，用一個簡單的比喻說明，每次只講一個重點，不施壓、不催決志。", "en": "The seeker's faith background: no religious faith. They follow no particular religion and may never have met the Bible or a church. Assume no religious vocabulary; start from their real life situation and questions. Never judge curiosity, hesitation or uncertainty; explain with one simple picture, one main point at a time, with no pressure and no rush to decide.", "zs": "回答对象的信仰背景：没有信仰。对方没有特定宗教，可能从未接触过圣经或教会。不预设他懂任何宗教词汇，从他的生活处境与真实疑问出发；对信仰的好奇、犹豫或不确定都不评论对错，用一个简单的比喻说明，每次只讲一个重点，不施压、不催决志。"}, "buddhism": {"zh": "回答對象的信仰背景：佛教。請全程尊重，不貶低佛陀、佛教或他的修行，不用「拜偶像」「迷信」這類帶責備的字眼。先肯定共同關心的課題（苦、無常、慈悲、放下、心的平安），再溫和說明聖經的觀點：宇宙有位有位格的創造主，神主動愛人；救恩是白白的恩典，不是靠自己累積功德；人有一世的生命，死後要面對神，而不是輪迴。不要亂用佛教專有名詞；不確定他的宗派或想法時，先請他說說自己怎麼理解。", "en": "The seeker's faith background: Buddhism. Be respectful throughout; never belittle the Buddha, Buddhism or their practice, and avoid accusing words such as 'idolatry' or 'superstition'. First affirm what you share — suffering, impermanence, compassion, letting go, peace of heart — then gently explain the Bible's view: a personal Creator who takes the initiative to love people; salvation as a free gift of grace, not merit we accumulate; one life, then facing God, rather than rebirth. Do not misuse Buddhist terms; if unsure of their school or understanding, ask them to share it first.", "zs": "回答对象的信仰背景：佛教。请全程尊重，不贬低佛陀、佛教或他的修行，不用“拜偶像”“迷信”这类带责备的字眼。先肯定共同关心的课题（苦、无常、慈悲、放下、心的平安），再温和说明圣经的观点：宇宙有位有位格的创造主，神主动爱人；救恩是白白的恩典，不是靠自己累积功德；人有一世的生命，死后要面对神，而不是轮回。不要乱用佛教专有名词；不确定他的宗派或想法时，先请他说说自己怎么理解。"}, "folk": {"zh": "回答對象的信仰背景：民間信仰（拜拜、祭祖、神明、媽祖、風水、算命等）。請尊重他對家人、祖先與神明的敬重與孝心，不嘲笑、不恐嚇。先肯定聖經本來就教導孝敬父母，再溫和說明：敬拜只歸給創造天地的獨一真神；並關心他拜拜背後真正的需要，像是平安、保佑、被關愛、對未來的不安。用生活化的例子，回答他實際的疑惑（例如祭祖與追思的差別），不要要求他立刻改變家人的習慣。", "en": "The seeker's faith background: folk religion (temple offerings, ancestor rites, local deities such as Mazu, feng shui, fortune-telling). Honour their respect for family, ancestors and the gods, and their filial devotion; never mock or frighten. First affirm that the Bible itself teaches honouring parents, then gently explain that worship belongs to the one true God who made heaven and earth; care about the real need behind the offerings — peace, protection, being loved, anxiety about the future. Use everyday examples, answer their practical questions (for example, ancestor rites versus remembrance), and do not ask them to change the family's customs at once.", "zs": "回答对象的信仰背景：民间信仰（拜拜、祭祖、神明、妈祖、风水、算命等）。请尊重他对家人、祖先与神明的敬重与孝心，不嘲笑、不恐吓。先肯定圣经本来就教导孝敬父母，再温和说明：敬拜只归给创造天地的独一真神；并关心他拜拜背后真正的需要，像是平安、保佑、被关爱、对未来的不安。用生活化的例子，回答他实际的疑惑（例如祭祖与追思的差别），不要要求他立刻改变家人的习惯。"}, "yiguandao": {"zh": "回答對象的信仰背景：一貫道。請尊重他吃素、重倫理道德、修身行善的認真，不批評他的師尊、道場或儀式。他多半敬畏「天」或「上帝」，也聽過「五教同源、萬教歸一」，可以從這份對天的敬畏與向善的心談起。對一貫道的教義細節（如無極老母、三期末劫、道場規矩）不要自己推斷或批評；不確定時請他說說自己的理解。再溫和、誠實地說明聖經的核心：神是有位格的創造主，藉著耶穌基督主動來到人間；耶穌說：「我就是道路、真理、生命」（約翰福音 14:6），救恩是白白的恩典。", "en": "The seeker's faith background: Yiguandao (Way of Pervading Unity). Respect their vegetarianism, their seriousness about ethics and self-cultivation, and their good deeds; never criticise their teachers, halls or rituals. They typically revere Heaven or the Supreme Lord and have heard 'five religions share one source'; begin from that reverence and desire to do good. Do not guess at or criticise doctrinal details (such as the Eternal Mother, the three ages, hall rules); if unsure, ask them to explain their understanding. Then, gently and honestly, state the Bible's heart: a personal Creator who came to us in Jesus Christ; Jesus said, 'I am the way, the truth and the life' (John 14:6); salvation is a free gift of grace.", "zs": "回答对象的信仰背景：一贯道。请尊重他吃素、重伦理道德、修身行善的认真，不批评他的师尊、道场或仪式。他多半敬畏“天”或“上帝”，也听过“五教同源、万教归一”，可以从这份对天的敬畏与向善的心谈起。对一贯道的教义细节（如无极老母、三期末劫、道场规矩）不要自己推断或批评；不确定时请他说说自己的理解。再温和、诚实地说明圣经的核心：神是有位格的创造主，借着耶稣基督主动来到人间；耶稣说：“我就是道路、真理、生命”（约翰福音 14:6），救恩是白白的恩典。"}, "muslim": {"zh": "回答對象的信仰背景：穆斯林。請以最大的敬意對待他的信仰、古蘭經與先知，不辱罵、不嘲諷、不貶低，也不要用施壓或「勸你改教」的口氣；他可能要為此付出家庭與社群的代價，要體貼。先肯定共同點：信獨一的神，也尊敬亞伯拉罕、摩西、大衛，以及童女所生的先知爾薩（耶穌）。只引用聖經，說明聖經如何看耶穌（神的道成了肉身，是神的兒子），並清楚說明基督徒信的是獨一真神，不是三個神；也溫和比較「靠行為得救」與「靠恩典得救」的不同。避免用豬肉、酒、圖像這類容易冒犯的比喻。不確定他的教派或想法時，先請他分享。", "en": "The seeker's faith background: Muslim. Treat their faith, the Qur'an and the Prophet with the highest respect; never insult, mock or belittle, and never press or urge them to convert — they may pay a heavy price in family and community, so be considerate. First affirm common ground: belief in one God, and respect for Abraham, Moses, David and the virgin-born prophet Isa (Jesus). Quote only the Bible, explain how it sees Jesus (the Word made flesh, the Son of God), make clear that Christians worship the one true God, not three gods, and gently contrast salvation by works with salvation by grace. Avoid illustrations involving pork, alcohol or images that easily offend. If unsure of their tradition or views, ask them to share first.", "zs": "回答对象的信仰背景：穆斯林。请以最大的敬意对待他的信仰、古兰经与先知，不辱骂、不嘲讽、不贬低，也不要用施压或“劝你改教”的口气；他可能要为此付出家庭与社群的代价，要体贴。先肯定共同点：信独一的神，也尊敬亚伯拉罕、摩西、大卫，以及童女所生的先知尔萨（耶稣）。只引用圣经，说明圣经如何看耶稣（神的道成了肉身，是神的儿子），并清楚说明基督徒信的是独一真神，不是三个神；也温和比较“靠行为得救”与“靠恩典得救”的不同。避免用猪肉、酒、图像这类容易冒犯的比喻。不确定他的教派或想法时，先请他分享。"}, "atheist": {"zh": "回答對象的信仰背景：無神論者。請尊重他靠理性、證據與誠實思考的態度，不說教，不說「你只要相信就好」。不把無神論說成稻草人，也不說科學與信仰一定對立。誠實承認哪些質疑很有力（如苦難、惡、宗教歷史上的錯誤），哪些事無法用科學證明，不誇大也不迴避；可以從道德直覺、生命的意義、宇宙的秩序與耶穌的歷史記載談起，引用聖經時也說明它的背景。語氣平等、好奇、不防衛，邀請他一起探索，而不是要他認輸。", "en": "The seeker's faith background: atheist. Respect their reliance on reason, evidence and honest thinking; do not preach or say 'just believe'. Do not caricature atheism or claim science and faith must be at war. Honestly admit which objections are strong (suffering, evil, historical failures of religion) and which things science cannot prove, without exaggerating or dodging; you may start from moral intuition, meaning, the order of the universe and the historical records of Jesus, and explain the background when you cite the Bible. Keep the tone equal, curious and undefensive, inviting them to explore together rather than to concede.", "zs": "回答对象的信仰背景：无神论者。请尊重他靠理性、证据与诚实思考的态度，不说教，不说“你只要相信就好”。不把无神论说成稻草人，也不说科学与信仰一定对立。诚实承认哪些质疑很有力（如苦难、恶、宗教历史上的错误），哪些事无法用科学证明，不夸大也不回避；可以从道德直觉、生命的意义、宇宙的秩序与耶稣的历史记载谈起，引用圣经时也说明他的背景。语气平等、好奇、不防卫，邀请他一起探索，而不是要他认输。"}};
const SKBG_SYS = () => {
  if (state.audience !== 'seeker') return '';
  const t = SKBG_TXT[state.skbg] || SKBG_TXT.none;
  return ' ' + (isEP() ? t.en : isZS() ? t.zs : t.zh) + (isEP()
    ? ' Always speak with respect and love, never mock any belief, never put them under pressure; state Christian convictions honestly but gently, and answer their actual question first.'
    : isZS() ? ' 一律带着尊重与爱心，不嘲笑任何信仰、不施压；诚实而温和地说明基督信仰的立场，并先回答他真正的问题。'
    : ' 一律帶著尊重與愛心，不嘲笑任何信仰、不施壓；誠實而溫和地說明基督信仰的立場，並先回答他真正的問題。');
};
/* v2.18.28：小智回答長度——簡要／適中／詳細 */
const LEN_KEYS = ['brief','mid','full'];
const LEN_NAME = () => ({ brief:L3('簡要','简要','Brief'), mid:L3('適中','适中','Medium'), full:L3('詳細','详细','Detailed') });
const LEN_SYS = () => {
  const k = state.alen || 'mid';
  if (k === 'mid') return '';
  if (isEP()) return k === 'brief'
    ? ' Length: BRIEF. Keep the whole answer to about 3–5 short sentences (roughly 120 words): the core answer, one key verse or picture, and a one-line prayer or step. No tables, no long lists.'
    : ' Length: DETAILED. Give a fuller, well-organised answer (roughly 600–900 words): the passage context, the meaning of key words, cross-references, a clear 3-2-1 application, a practical step for this week, and a closing prayer. Short headings are welcome.';
  if (isZS()) return k === 'brief'
    ? ' 回答长度：简要。整段回答控制在 3～5 句话（约 150 字内）：直接给核心答案、一句关键经文或一个比喻，最后一句祷告或一个小步骤。不用表格、不列长清单。'
    : ' 回答长度：详细。请完整、有条理地回答（约 800～1200 字）：说明经文脉络、关键字词的意思、相关经文对照、清楚的321应用、这星期可以操练的具体步骤，最后以祷告结束。可用简短小标题。';
  return k === 'brief'
    ? ' 回答長度：簡要。整段回答控制在 3～5 句話（約 150 字內）：直接給核心答案、一句關鍵經文或一個比喻，最後一句禱告或一個小步驟。不用表格、不列長清單。'
    : ' 回答長度：詳細。請完整、有條理地回答（約 800～1200 字）：說明經文脈絡、關鍵字詞的意思、相關經文對照、清楚的321應用、這星期可以操練的具體步驟，最後以禱告結束。可用簡短小標題。';
};
const AUD_SYS = () => {
  const a = state.audience;
  if (a === 'seeker') return SK_SYS();
  { const x2 = A2(); if (x2) return x2.sys; }
  if (isEP()) return {
    adult:
      ' Audience: an adult. Speak with a mature, steady and warm voice. You may go a little deeper — note the context and the meaning of key words — and connect the passage to work, marriage, parenting, relationships and spiritual battle. Close with one concrete step the reader can practise this week.',
    teen:
      ' Audience: a teenager (about 12–18). Be funny, witty and real — like a cool older brother or sister chatting, never lecturing or talking down. Use pictures from their world: phone at 1% battery, game levels, binge-watching, likes and followers, exams, peer pressure, sports. A light joke or current slang now and then is welcome, but NEVER joke about God, Jesus or Scripture itself, and never be flippant about sin or pain; after the laugh, land firmly on the truth. Keep it short, put the main point first, use short paragraphs, and end with one small challenge they can try today. If they mention being hurt, bullied, or wanting to harm themselves, answer gently and encourage them to tell a trusted adult (parent, teacher, pastor) right away.',
    kid:
      ' Audience: a young child (about 5–11). Use VERY simple words, like telling a story to a little one. Short sentences, one idea each. Use concrete everyday pictures (a seed, a teddy bear, holding hands, hide-and-seek, a birthday cake). Avoid theological terms; if one is needed, explain it in one simple sentence. Be warm and lively — you may ask "Did you know?" or "Let\'s think!" and add a few cute emojis. Keep the whole answer to about 5–7 short sentences. Do NOT use tables. Quote only one short verse. For violent or frightening passages, tell it gently without graphic detail. End with a tiny prayer or one simple question the child can answer. If the child says someone hurts them or they are very sad, answer kindly and tell them to talk to a trusted grown-up (mom, dad, teacher, pastor) right away.'
  }[a];
  if (isZS()) return {
    adult:
      ' 回答对象：成年人。请用成熟、沉稳而温暖的口吻，可以有适度的深度：点出经文脉络与关键字词的意思，连结工作、婚姻、教养、人际与属灵争战，最后带出一个这星期就能操练的具体步骤。',
    teen:
      ' 回答对象：青少年（约12–18岁）。请用幽默风趣、轻松有梗的口吻，像一位很酷的大哥哥大姐姐在聊天，不说教、不居高临下。多用他们熟悉的世界来比喻：手机剩1%电量、游戏过关、追剧、社交平台点赞与粉丝、考试、同侪压力、打球。可以适度用一点流行说法和小玩笑，但绝不拿圣经、神或耶稣开玩笑，也不轻看罪与伤痛；笑完一定要回到经文的真理上。答案精简，重点先讲，段落要短，结尾给一个今天就能试的小挑战。若他提到被欺负、受伤害或想伤害自己，要温柔回应，并鼓励他马上告诉信任的大人（爸妈、老师、牧者）。',
    kid:
      ' 回答对象：儿童（约5–11岁）。请用非常浅显易懂的话，像说故事给小朋友听。句子要短，一句只讲一件事；用具体的小事当比喻（种子、小熊、手牵手、捉迷藏、生日蛋糕）；不用艰深的神学名词，必须用时马上用一句话解释。语气亲切活泼，可以说「你知道吗？」「一起想一想」，并适度加几个可爱的表情符号。整个回答控制在五到七句短句。不要用表格；只引用一节简短的经文。遇到暴力或可怕的经文，用孩子能承受的方式温柔带过，不渲染细节。最后用一句小祷告或一个孩子答得出来的简单问题作结。若孩子说有人伤害他、或他很难过，要亲切回应，并告诉他马上跟信任的大人（爸爸妈妈、老师、牧者）说。'
  }[a];
  return {
    adult:
      ' 回答對象：成年人。請用成熟、沉穩而溫暖的口吻，可以有適度的深度：點出經文脈絡與關鍵字詞的意思，連結工作、婚姻、教養、人際與屬靈爭戰，最後帶出一個這星期就能操練的具體步驟。',
    teen:
      ' 回答對象：青少年（約12–18歲）。請用幽默風趣、輕鬆有梗的口吻，像一位很酷的大哥哥大姊姊在聊天，不說教、不居高臨下。多用他們熟悉的世界來比喻：手機剩1%電量、遊戲過關、追劇、社群按讚與追蹤數、考試、同儕壓力、打球。可以適度用一點流行說法和小玩笑，但絕不拿聖經、神或耶穌開玩笑，也不輕看罪與傷痛；笑完一定要回到經文的真理上。答案精簡，重點先講，段落要短，結尾給一個今天就能試的小挑戰。若他提到被欺負、受傷害或想傷害自己，要溫柔回應，並鼓勵他馬上告訴信任的大人（爸媽、老師、牧者）。',
    kid:
      ' 回答對象：兒童（約5–11歲）。請用非常淺顯易懂的話，像說故事給小朋友聽。句子要短，一句只講一件事；用具體的小事當比喻（種子、小熊、手牽手、捉迷藏、生日蛋糕）；不用艱深的神學名詞，必須用時馬上用一句話解釋。語氣親切活潑，可以說「你知道嗎？」「一起想一想」，並適度加幾個可愛的表情符號。整個回答控制在五到七句短句。不要用表格；只引用一節簡短的經文。遇到暴力或可怕的經文，用孩子能承受的方式溫柔帶過，不渲染細節。最後用一句小禱告或一個孩子答得出來的簡單問題作結。若孩子說有人傷害他、或他很難過，要親切回應，並告訴他馬上跟信任的大人（爸爸媽媽、老師、牧者）說。'
  }[a];
};
/* 範例問題也跟著對象換：青少年問的是他的世界，兒童問的是故事 */
const QBANK_AUD = {
  seeker: {
    zh: ["這段話跟我現在的生活有什麼關係？", "我還不是基督徒，這段話對我有什麼意義？", "神真的存在嗎？有什麼理由可以相信？", "聖經為什麼說每個人都需要耶穌？", "我壓力很大，聖經能給我什麼實際的幫助？", "這段話裡的「罪」是什麼意思？跟我有關嗎？", "基督徒常說的「恩典」，用白話說是什麼？", "如果我想多了解，可以從哪裡開始？"],
    zs: ["这段话跟我现在的生活有什么关系？", "我还不是基督徒，这段话对我有什么意义？", "神真的存在吗？有什么理由可以相信？", "圣经为什么说每个人都需要耶稣？", "我压力很大，圣经能给我什么实際的帮助？", "这段话里的“罪”是什么意思？跟我有关吗？", "基督徒常说的“恩典”，用白话说是什么？", "如果我想多了解，可以从哪里开始？"],
    en: ["How does this passage connect to my life right now?", "I am not a Christian — what could this mean for me?", "Is there a God? What reasons are there to believe?", "Why does the Bible say everyone needs Jesus?", "I am under a lot of stress — what practical help does the Bible offer?", "What does \"sin\" mean here, and does it apply to me?", "Christians talk about \"grace\" — what does it mean in plain words?", "If I want to know more, where can I start?"]
  },
  teen: {
    zh: ['這段經文跟我的日常（學校、朋友、手機）有什麼關係？',
         '如果這段經文是神傳給我的一則訊息，它想說什麼？',
         '朋友都那樣做，我不跟會不會很怪？經文怎麼看？',
         '用遊戲或電影來比喻這段經文，可以嗎？',
         '這段經文有什麼讓人意外、很少人知道的地方？',
         '考試壓力好大，這段經文能給我什麼力量？',
         '我很難原諒一個人，這段經文能幫我什麼？',
         '神真的看得到我嗎？我哪裡值得被愛？'],
    zs: ['这段经文跟我的日常（学校、朋友、手机）有什么关系？',
         '如果这段经文是神传给我的一则信息，它想说什么？',
         '朋友都那样做，我不跟会不会很怪？经文怎么看？',
         '用游戏或电影来比喻这段经文，可以吗？',
         '这段经文有什么让人意外、很少人知道的地方？',
         '考试压力好大，这段经文能给我什么力量？',
         '我很难原谅一个人，这段经文能帮我什么？',
         '神真的看得到我吗？我哪里值得被爱？'],
    en: ['How does this passage connect to my everyday life — school, friends, my phone?',
         'If this passage were a message from God to me, what would it say?',
         'Everyone is doing it — is it weird if I don\'t? What does Scripture say?',
         'Can you explain this passage with a game or a movie?',
         'What\'s surprising or little-known about this passage?',
         'Exam stress is huge — what strength does this passage give me?',
         'I can\'t forgive someone. How does this passage help?',
         'Does God really see me? What makes me worth loving?']
  },
  kid: {
    zh: ['這段故事在說什麼？請講給我聽。',
         '神在這個故事裡做了什麼事？',
         '耶穌愛我嗎？我怎麼知道？',
         '這個故事裡誰最勇敢？為什麼？',
         '我可以怎樣學習故事裡的人？',
         '請教我一句可以背起來的短經文。',
         '我跟好朋友吵架了，耶穌會怎麼做？',
         '可以教我做一個小禱告嗎？'],
    zs: ['这段故事在说什么？请讲给我听。',
         '神在这个故事里做了什么事？',
         '耶稣爱我吗？我怎么知道？',
         '这个故事里谁最勇敢？为什么？',
         '我可以怎样学习故事里的人？',
         '请教我一句可以背起来的短经文。',
         '我跟好朋友吵架了，耶稣会怎么做？',
         '可以教我做一个小祷告吗？'],
    en: ['What is this story about? Tell it to me.',
         'What did God do in this story?',
         'Does Jesus love me? How do I know?',
         'Who is the bravest in this story? Why?',
         'How can I be like the people in this story?',
         'Teach me one short verse I can remember.',
         'I had a fight with my best friend. What would Jesus do?',
         'Can you teach me a little prayer?']
  }
};
/* v2.18.34：十種對象各 20 題範例問題——各自最實際的情景、能解答疑惑、一步步引向信靠耶穌（三語） */
const QBANK20 = {"adult": {"zh": ["房貸、孩子學費壓得我喘不過氣，這段經文能給我什麼盼望？", "我工作很拚，卻常常覺得空虛，這是為什麼？", "夫妻吵架冷戰好幾天了，這段經文教我先做什麼？", "我很難原諒傷害過我的人，耶穌怎麼幫我放下？", "我不確定神是不是真的存在，有什麼理由可以相信？", "為什麼好人也會遇到苦難？神在哪裡？", "我信主多年，禱告卻像自言自語，怎麼辦？", "耶穌為什麼一定要死在十字架上？跟我有什麼關係？", "我過去做過錯事，神還會接納我嗎？", "孩子叛逆不聽話，我怎麼用這段經文陪伴他？", "面對失業或事業失敗，信靠耶穌的人怎麼走下去？", "父母年老生病，我分身乏術，這段經文怎麼安慰我？", "我常常焦慮、睡不著，耶穌說的平安是什麼？", "我怎麼向不信的家人或同事分享耶穌，又不讓他們反感？", "我想信耶穌，卻怕被朋友笑、被家人反對，怎麼辦？", "信耶穌跟拜別的神明、做個好人，有什麼不同？", "一個人要怎麼開始認識耶穌？今天可以做什麼小步驟？", "我常常發脾氣、改不了壞習慣，耶穌真的能改變一個人嗎？", "死亡讓我害怕，耶穌說的永生是什麼意思？", "如果我今天想把生命交給耶穌，要怎麼禱告？"], "zs": ["房贷、孩子学费压得我喘不过气，这段经文能给我什么盼望？", "我工作很拚，却常常觉得空虚，这是为什么？", "夫妻吵架冷战好几天了，这段经文教我先做什么？", "我很难原谅伤害过我的人，耶稣怎么帮我放下？", "我不确定神是不是真的存在，有什么理由可以相信？", "为什么好人也会遇到苦难？神在哪里？", "我信主多年，祷告却像自言自语，怎么办？", "耶稣为什么一定要死在十字架上？跟我有什么关系？", "我过去做过错事，神还会接纳我吗？", "孩子叛逆不听话，我怎么用这段经文陪伴他？", "面对失业或事业失败，信靠耶稣的人怎么走下去？", "父母年老生病，我分身乏术，这段经文怎么安慰我？", "我常常焦虑、睡不着，耶稣说的平安是什么？", "我怎么向不信的家人或同事分享耶稣，又不让他们反感？", "我想信耶稣，却怕被朋友笑、被家人反对，怎么办？", "信耶稣跟拜别的神明、做个好人，有什么不同？", "一个人要怎么开始认识耶稣？今天可以做什么小步骤？", "我常常发脾气、改不了坏习惯，耶稣真的能改变一个人吗？", "死亡让我害怕，耶稣说的永生是什么意思？", "如果我今天想把生命交给耶稣，要怎么祷告？"], "en": ["Mortgage and school fees are crushing me — what hope does this passage give?", "I work hard but often feel empty. Why?", "My spouse and I have been in a cold war for days. What does this passage tell me to do first?", "I can't forgive someone who hurt me. How does Jesus help me let go?", "I'm not sure God exists. What reasons are there to believe?", "Why do good people suffer? Where is God?", "I've believed for years, yet prayer feels like talking to myself. What should I do?", "Why did Jesus have to die on the cross? What does that have to do with me?", "I've done wrong in my past. Will God still accept me?", "My child is rebellious. How can I use this passage to walk with them?", "Facing job loss or a failed business, how do people who trust Jesus keep going?", "My parents are old and sick and I'm stretched thin. How does this passage comfort me?", "I'm anxious and can't sleep. What is the peace Jesus talks about?", "How can I share Jesus with unbelieving family or coworkers without putting them off?", "I want to follow Jesus but fear being laughed at or opposed by family. What do I do?", "How is trusting Jesus different from worshipping other gods or just being a good person?", "How does a person begin to know Jesus? What small step can I take today?", "I lose my temper and can't break bad habits. Can Jesus really change a person?", "Death frightens me. What does Jesus mean by eternal life?", "If I want to give my life to Jesus today, how do I pray?"]}, "teen": {"zh": ["這段經文跟我的學校生活有什麼關係？", "考試壓力好大，成績不好的我還有價值嗎？", "同學都有自己的圈子，我覺得被孤立，耶穌怎麼看我？", "被霸凌或被朋友背叛，我很生氣，耶穌會怎麼做？", "我覺得自己不夠好、不夠漂亮或帥，神真的愛我嗎？", "爸媽一直吵架或管我很多，我很煩，聖經怎麼說？", "朋友說基督教很迷信、科學才是對的，我怎麼回答？", "我喜歡上一個人，談戀愛可以嗎？聖經有什麼智慧？", "我滑手機、打遊戲停不下來，怎麼辦？", "為什麼要信耶穌？不信會怎麼樣？", "耶穌是真的存在過的人嗎？有什麼證據？", "我做了錯事不敢讓人知道，神會原諒我嗎？", "我常常焦慮、心情低落，耶穌能陪我嗎？", "大家都說「做自己就好」，信耶穌是不是就沒有自由了？", "神如果愛我，為什麼讓我經歷這些難過的事？", "我想交到真朋友，耶穌怎麼教我交朋友？", "如果我想信耶穌，要先做什麼？需要很完美嗎？", "禱告真的有用嗎？可以用我自己的話跟神說嗎？", "我不知道以後要念什麼、做什麼，怎麼面對未來？", "我可以怎麼用自己的話，跟朋友說耶穌是誰？"], "zs": ["这段经文跟我的学校生活有什么关系？", "考试压力好大，成绩不好的我还有价值吗？", "同学都有自己的圈子，我觉得被孤立，耶稣怎么看我？", "被霸凌或被朋友背叛，我很生气，耶稣会怎么做？", "我觉得自己不够好、不够漂亮或帅，神真的爱我吗？", "爸妈一直吵架或管我很多，我很烦，圣经怎么说？", "朋友说基督教很迷信、科学才是对的，我怎么回答？", "我喜欢上一个人，谈恋爱可以吗？圣经有什么智慧？", "我滑手机、打游戏停不下来，怎么办？", "为什么要信耶稣？不信会怎么样？", "耶稣是真的存在过的人吗？有什么证据？", "我做了错事不敢让人知道，神会原谅我吗？", "我常常焦虑、心情低落，耶稣能陪我吗？", "大家都说“做自己就好”，信耶稣是不是就没有自由了？", "神如果爱我，为什么让我经历这些难过的事？", "我想交到真朋友，耶稣怎么教我交朋友？", "如果我想信耶稣，要先做什么？需要很完美吗？", "祷告真的有用吗？可以用我自己的话跟神说吗？", "我不知道以后要念什么、做什么，怎么面对未来？", "我可以怎么用自己的话，跟朋友说耶稣是谁？"], "en": ["How does this passage connect to my school life?", "Exam pressure is huge — am I still worth something if my grades are bad?", "Everyone has their own group and I feel left out. How does Jesus see me?", "I'm being bullied or betrayed by a friend and I'm angry. What would Jesus do?", "I feel I'm not good-looking or good enough. Does God really love me?", "My parents keep fighting or control too much and I'm fed up. What does the Bible say?", "My friends say Christianity is superstition and science is right. How do I answer?", "I like someone — is dating okay? What wisdom does the Bible give?", "I can't stop scrolling or gaming. What can I do?", "Why believe in Jesus at all? What if I don't?", "Was Jesus a real person? What's the evidence?", "I did something wrong and I'm afraid to tell anyone. Will God forgive me?", "I'm often anxious and down. Can Jesus be with me?", "Everyone says 'just be yourself' — does following Jesus mean losing my freedom?", "If God loves me, why does he let sad things happen to me?", "I want real friends. How does Jesus teach me to be a friend?", "If I want to follow Jesus, what do I do first? Do I have to be perfect?", "Does prayer really work? Can I talk to God in my own words?", "I don't know what to study or do later. How do I face the future?", "How can I explain in my own words who Jesus is to my friends?"]}, "kid": {"zh": ["這個故事在說什麼？請講給我聽。", "耶穌是誰？他住在哪裡？", "耶穌真的愛我嗎？我怎麼知道？", "神在哪裡？我看不到他，他怎麼聽得到我說話？", "我做錯事，爸媽生氣了，耶穌會不會也生氣？", "我跟好朋友吵架了，耶穌會怎麼做？", "我晚上怕黑、怕做噩夢，耶穌可以保護我嗎？", "功課好難，我不想上學，耶穌可以幫我嗎？", "為什麼耶穌要死在十字架上？", "耶穌死了以後，為什麼又活過來？", "我的奶奶（或小狗）生病了，耶穌會醫好她嗎？", "天堂是什麼樣子？", "有同學欺負我，我可以怎麼辦？耶穌怎麼說？", "可以教我怎麼禱告嗎？禱告可以說什麼？", "神是誰創造的？", "耶穌可以做我最好的朋友嗎？怎麼做？", "我怎麼可以學會跟小朋友快樂分享？", "什麼是「罪」？我也有罪嗎？", "請教我一句可以背起來的短經文。", "我想請耶穌住在我心裡，要怎麼說？"], "zs": ["这个故事在说什么？请讲给我听。", "耶稣是谁？他住在哪里？", "耶稣真的爱我吗？我怎么知道？", "神在哪里？我看不到他，他怎么听得到我说话？", "我做错事，爸妈生气了，耶稣会不会也生气？", "我跟好朋友吵架了，耶稣会怎么做？", "我晚上怕黑、怕做噩梦，耶稣可以保护我吗？", "功课好难，我不想上学，耶稣可以帮我吗？", "为什么耶稣要死在十字架上？", "耶稣死了以后，为什么又活过来？", "我的奶奶（或小狗）生病了，耶稣会医好她吗？", "天堂是什么样子？", "有同学欺负我，我可以怎么办？耶稣怎么说？", "可以教我怎么祷告吗？祷告可以说什么？", "神是谁创造的？", "耶稣可以做我最好的朋友吗？怎么做？", "我怎么可以学会跟小朋友快乐分享？", "什么是“罪”？我也有罪吗？", "请教我一句可以背起来的短经文。", "我想请耶稣住在我心里，要怎么说？"], "en": ["What is this story about? Please tell it to me.", "Who is Jesus? Where does he live?", "Does Jesus really love me? How do I know?", "Where is God? I can't see him — how can he hear me?", "I did something wrong and Mom and Dad got mad. Is Jesus mad at me too?", "I had a fight with my best friend. What would Jesus do?", "I'm scared of the dark and bad dreams. Can Jesus keep me safe?", "Homework is so hard and I don't want to go to school. Can Jesus help me?", "Why did Jesus die on the cross?", "Why did Jesus come back to life after he died?", "My grandma (or my puppy) is sick. Will Jesus make her better?", "What is heaven like?", "Someone at school is mean to me. What can I do? What does Jesus say?", "Can you teach me how to pray? What can I say?", "Who made God?", "Can Jesus be my very best friend? How?", "How can I learn to share happily with other kids?", "What is 'sin'? Do I have sin too?", "Teach me one short verse I can remember.", "I want Jesus to live in my heart. What do I say?"]}, "seeker": {"zh": ["我沒讀過聖經，這段話跟我現在的生活有什麼關係？", "神真的存在嗎？有什麼理由可以相信？", "為什麼世界上有這麼多苦難？神為什麼不阻止？", "聖經不是人寫的嗎？為什麼我可以相信它？", "耶穌真的存在過嗎？他為什麼是特別的？", "我覺得自己是個好人，為什麼還需要耶穌？", "各種宗教不都是勸人為善嗎？基督信仰的差別在哪裡？", "我壓力很大、心裡很空，聖經能給我什麼實際的幫助？", "我過去做過很糟的事，這樣的人神也會接納嗎？", "我家人拜拜（或有別的信仰），我信耶穌會不會不孝或被排斥？", "科學和信仰是不是互相矛盾？", "聽說信耶穌就要放棄很多快樂，是真的嗎？", "耶穌為什麼要死？他的死跟我有什麼關係？", "耶穌復活是真的嗎？有什麼根據？", "我在教會遇過偽善的人，讓我很猶豫，該怎麼看？", "「信主」是什麼意思？需要先懂很多道理或先改好才能信嗎？", "我沒有信仰也過得不錯，信耶穌會多得到什麼？", "我想先自己認識耶穌，可以怎麼開始讀聖經？", "如果我決定相信耶穌，第一步怎麼做？怎麼禱告？", "我還有很多疑問，可以一邊問一邊慢慢決定嗎？"], "zs": ["我没读过圣经，这段话跟我现在的生活有什么关系？", "神真的存在吗？有什么理由可以相信？", "为什么世界上有这么多苦难？神为什么不阻止？", "圣经不是人写的吗？为什么我可以相信它？", "耶稣真的存在过吗？他为什么是特别的？", "我觉得自己是个好人，为什么还需要耶稣？", "各种宗教不都是劝人为善吗？基督信仰的差别在哪里？", "我压力很大、心里很空，圣经能给我什么实际的帮助？", "我过去做过很糟的事，这样的人神也会接纳吗？", "我家人拜拜（或有别的信仰），我信耶稣会不会不孝或被排斥？", "科学和信仰是不是互相矛盾？", "听说信耶稣就要放弃很多快乐，是真的吗？", "耶稣为什么要死？他的死跟我有什么关系？", "耶稣复活是真的吗？有什么根据？", "我在教会遇过伪善的人，让我很犹豫，该怎么看？", "“信主”是什么意思？需要先懂很多道理或先改好才能信吗？", "我没有信仰也过得不错，信耶稣会多得到什么？", "我想先自己认识耶稣，可以怎么开始读圣经？", "如果我决定相信耶稣，第一步怎么做？怎么祷告？", "我还有很多疑问，可以一边问一边慢慢决定吗？"], "en": ["I've never read the Bible. How does this passage connect to my life right now?", "Does God really exist? What reasons are there to believe?", "Why is there so much suffering in the world? Why doesn't God stop it?", "Wasn't the Bible written by people? Why can I trust it?", "Did Jesus really exist? What makes him special?", "I think I'm a good person. Why would I still need Jesus?", "Don't all religions just teach people to do good? What's different about Christianity?", "I'm under a lot of stress and feel empty. What practical help can the Bible give me?", "I've done some terrible things. Would God accept someone like me?", "My family worships ancestors (or follows another faith). Would trusting Jesus be disrespectful or get me rejected?", "Do science and faith contradict each other?", "I heard following Jesus means giving up a lot of joy. Is that true?", "Why did Jesus have to die? What does his death have to do with me?", "Is the resurrection real? What is it based on?", "I've met hypocrites in church and it makes me hesitate. How should I see that?", "What does 'believing in Jesus' mean? Do I need to understand everything or get my life fixed first?", "I'm doing fine without faith. What would I gain by trusting Jesus?", "I'd like to get to know Jesus for myself. How can I start reading the Bible?", "If I decide to trust Jesus, what's the first step? How do I pray?", "I still have many questions. Can I ask them as I go and decide slowly?"]}, "elder": {"zh": ["年紀大了身體常常痛，這段經文怎麼安慰我？", "孩子都很忙，我常常覺得孤單，耶穌怎麼陪伴我？", "我怕死，也怕走了以後去哪裡，耶穌怎麼說？", "老伴走了，我心裡空空的，聖經有什麼安慰？", "我一輩子拜拜、拜祖先，現在信耶穌來得及嗎？", "兒孫不信耶穌，我可以為他們做什麼？", "我年輕時做過一些後悔的事，神還會原諒我嗎？", "我眼睛花了、不太識字，怎麼聽聖經、怎麼禱告？", "走到這個年紀，人生的意義是什麼？神還要我做什麼？", "我常常睡不著、想東想西，耶穌能給我平安嗎？", "子女不孝或家人關係不好，我怎麼放下心裡的怨氣？", "我怕成為子女的負擔，這段經文怎麼看？", "耶穌說信他的人有永生，永生是什麼意思？", "我身體不好去不了教會，在家怎麼敬拜？", "拜祖先和信耶穌會衝突嗎？怎麼孝敬已過世的父母？", "我怎麼向老朋友、老鄰居分享耶穌的好？", "信耶穌之後，平常的日子要怎麼過？", "我想受洗，需要準備什麼？", "臨終的時候，耶穌會怎麼陪伴我？家人可以怎麼做？", "請教我一句記得住的話，每天用來向耶穌禱告。"], "zs": ["年纪大了身体常常痛，这段经文怎么安慰我？", "孩子都很忙，我常常觉得孤单，耶稣怎么陪伴我？", "我怕死，也怕走了以后去哪里，耶稣怎么说？", "老伴走了，我心里空空的，圣经有什么安慰？", "我一辈子拜拜、拜祖先，现在信耶稣来得及吗？", "儿孙不信耶稣，我可以为他们做什么？", "我年轻时做过一些后悔的事，神还会原谅我吗？", "我眼睛花了、不太识字，怎么听圣经、怎么祷告？", "走到这个年纪，人生的意义是什么？神还要我做什么？", "我常常睡不着、想东想西，耶稣能给我平安吗？", "子女不孝或家人关系不好，我怎么放下心里的怨气？", "我怕成为子女的负担，这段经文怎么看？", "耶稣说信他的人有永生，永生是什么意思？", "我身体不好去不了教会，在家怎么敬拜？", "拜祖先和信耶稣会冲突吗？怎么孝敬已过世的父母？", "我怎么向老朋友、老邻居分享耶稣的好？", "信耶稣之后，平常的日子要怎么过？", "我想受洗，需要准备什么？", "临终的时候，耶稣会怎么陪伴我？家人可以怎么做？", "请教我一句记得住的话，每天用来向耶稣祷告。"], "en": ["I'm older and in pain often. How does this passage comfort me?", "My children are busy and I feel lonely. How does Jesus keep me company?", "I'm afraid of dying and of where I'll go. What does Jesus say?", "My spouse has passed and my heart feels empty. What comfort does the Bible give?", "I've worshipped idols and ancestors all my life. Is it too late to trust Jesus now?", "My children and grandchildren don't believe. What can I do for them?", "I did things when I was young that I regret. Will God forgive me?", "My eyes are weak and I can't read well. How can I listen to the Bible and pray?", "At this age, what is the meaning of life? What does God still want from me?", "I often can't sleep and my mind races. Can Jesus give me peace?", "My children are unkind or the family is strained. How do I let go of resentment?", "I'm afraid of being a burden to my children. How does this passage see that?", "Jesus says those who trust him have eternal life. What does that mean?", "My health keeps me from church. How can I worship at home?", "Does honouring ancestors conflict with following Jesus? How do I honour my late parents?", "How can I share the goodness of Jesus with old friends and neighbours?", "After I trust Jesus, how should ordinary days be lived?", "I'd like to be baptised. What should I prepare?", "At the end of life, how will Jesus be with me? What can my family do?", "Teach me one easy sentence I can use to pray to Jesus every day."]}, "single_parent": {"zh": ["一個人又當爸又當媽，累到喘不過氣，耶穌怎麼幫我？", "我常覺得對孩子有虧欠，這段經文怎麼安慰我？", "經濟壓力很大，月底常常不知道怎麼辦，聖經有什麼盼望？", "前任讓我很受傷，我很難原諒，怎麼放下？", "孩子問「爸爸（媽媽）去哪裡了」，我怎麼回答？", "孩子情緒不穩或叛逆，我怎麼用經文陪伴他？", "我常覺得被人看不起、被貼標籤，神怎麼看我？", "半夜孩子生病，我一個人慌了，禱告有用嗎？", "我很孤單，沒有人可以商量，耶穌能怎麼陪我？", "我還有機會再得到愛、或再婚嗎？聖經有什麼智慧？", "我心裡對神有怨氣，為什麼我的家會破碎？", "在忙碌中，怎麼帶孩子認識耶穌？", "我怎麼教孩子禱告與讀聖經，又不給他壓力？", "工作和照顧孩子分身乏術，怎麼不被愧疚壓垮？", "離過婚的我，神還接納嗎？我有資格信耶穌嗎？", "我想重新振作，耶穌能給我什麼新的開始？", "我可以向誰求助？教會或信仰團體能怎麼支持我？", "我怕孩子重蹈我的覆轍，怎麼給他安全感？", "今天我只想要一句話撐下去，請給我一個盼望。", "我想把這個家交給耶穌，要怎麼禱告？"], "zs": ["一个人又当爸又当妈，累到喘不过气，耶稣怎么帮我？", "我常觉得对孩子有亏欠，这段经文怎么安慰我？", "经济压力很大，月底常常不知道怎么办，圣经有什么盼望？", "前任让我很受伤，我很难原谅，怎么放下？", "孩子问“爸爸（妈妈）去哪里了”，我怎么回答？", "孩子情绪不稳或叛逆，我怎么用经文陪伴他？", "我常觉得被人看不起、被贴标签，神怎么看我？", "半夜孩子生病，我一个人慌了，祷告有用吗？", "我很孤单，没有人可以商量，耶稣能怎么陪我？", "我还有机会再得到爱、或再婚吗？圣经有什么智慧？", "我心里对神有怨气，为什么我的家会破碎？", "在忙碌中，怎么带孩子认识耶稣？", "我怎么教孩子祷告与读圣经，又不给他压力？", "工作和照顾孩子分身乏术，怎么不被愧疚压垮？", "离过婚的我，神还接纳吗？我有资格信耶稣吗？", "我想重新振作，耶稣能给我什么新的开始？", "我可以向谁求助？教会或信仰团体能怎么支持我？", "我怕孩子重蹈我的覆辙，怎么给他安全感？", "今天我只想要一句话撑下去，请给我一个盼望。", "我想把这个家交给耶稣，要怎么祷告？"], "en": ["I'm both mom and dad and exhausted. How does Jesus help me?", "I often feel I've let my child down. How does this passage comfort me?", "Money is tight and I don't know how to get through month's end. What hope does the Bible give?", "My ex hurt me deeply and I can't forgive. How do I let go?", "My child asks, 'Where did Dad (or Mom) go?' How do I answer?", "My child is moody or rebellious. How can I use Scripture to walk with them?", "I often feel looked down on or labelled. How does God see me?", "My child is sick in the middle of the night and I'm alone and panicking. Does prayer help?", "I'm lonely with no one to talk to. How can Jesus be with me?", "Is there still a chance for love or remarriage? What wisdom does the Bible give?", "I'm angry at God — why did my family break apart?", "In all this busyness, how do I help my child know Jesus?", "How do I teach my child to pray and read the Bible without pressuring them?", "Work and childcare stretch me thin. How do I keep guilt from crushing me?", "I'm divorced. Does God still accept me? Am I qualified to trust Jesus?", "I want to start again. What new beginning can Jesus give me?", "Who can I turn to for help? How can a church or faith community support me?", "I'm afraid my child will repeat my mistakes. How do I give them security?", "Today I need just one sentence to get through. Please give me hope.", "I want to hand this home over to Jesus. How do I pray?"]}, "single": {"zh": ["單身讓我有時很孤單，神怎麼看我的孤單？", "家人一直催婚，我壓力很大，怎麼面對？", "我想結婚卻遇不到對的人，神有為我預備嗎？", "感情受過傷，我不敢再相信別人，怎麼療傷？", "信仰不同的對象可以交往嗎？聖經怎麼說？", "我很在意別人的眼光，覺得單身就是失敗，是真的嗎？", "工作忙到沒有自己的生活，人生的意義是什麼？", "我一個人也過得不錯，為什麼還需要神？", "我怎麼分辨一個人適不適合？有什麼智慧？", "我有情慾或網路上的掙扎，耶穌能幫我嗎？", "我很怕老了一個人，聖經給我什麼安全感？", "朋友都結婚生子了，我怎麼不羨慕、不比較？", "單身的這段時間，神要我做什麼？", "我對感情失望，也對神失望，可以誠實告訴他嗎？", "我還不是基督徒，單身的我適合認識耶穌嗎？", "我想信耶穌，但擔心生活被改變太多，會失去什麼？", "怎麼交到真正的朋友，建立一個彼此支持的圈子？", "我很容易焦慮，擔心沒有人愛我，耶穌的愛是什麼樣子？", "神的愛是不需要條件的，我不相信有這種愛，怎麼辦？", "如果我想把自己的人生交給耶穌，要怎麼開始？"], "zs": ["单身让我有时很孤单，神怎么看我的孤单？", "家人一直催婚，我压力很大，怎么面对？", "我想结婚却遇不到对的人，神有为我预备吗？", "感情受过伤，我不敢再相信别人，怎么疗伤？", "信仰不同的对象可以交往吗？圣经怎么说？", "我很在意别人的眼光，觉得单身就是失败，是真的吗？", "工作忙到没有自己的生活，人生的意义是什么？", "我一个人也过得不错，为什么还需要神？", "我怎么分辨一个人适不适合？有什么智慧？", "我有情欲或网路上的挣扎，耶稣能帮我吗？", "我很怕老了一个人，圣经给我什么安全感？", "朋友都结婚生子了，我怎么不羡慕、不比较？", "单身的这段时间，神要我做什么？", "我对感情失望，也对神失望，可以诚实告诉他吗？", "我还不是基督徒，单身的我适合认识耶稣吗？", "我想信耶稣，但担心生活被改变太多，会失去什么？", "怎么交到真正的朋友，建立一个彼此支持的圈子？", "我很容易焦虑，担心没有人爱我，耶稣的爱是什么样子？", "神的爱是不需要条件的，我不相信有这种爱，怎么办？", "如果我想把自己的人生交给耶稣，要怎么开始？"], "en": ["Being single makes me lonely at times. How does God see my loneliness?", "My family keeps pushing me to marry and I feel pressure. How do I face it?", "I want to marry but haven't met the right person. Has God prepared someone?", "I've been hurt in love and I can't trust again. How do I heal?", "Can I date someone of a different faith? What does the Bible say?", "I care too much what others think and feel single means failure. Is that true?", "Work leaves me no life of my own. What is the meaning of life?", "I'm fine on my own — why would I need God?", "How do I tell whether someone is right for me? What wisdom is there?", "I struggle with desire or things online. Can Jesus help me?", "I'm afraid of growing old alone. What security does the Bible give?", "My friends are all married with kids. How do I avoid envy and comparison?", "What does God want me to do in this season of singleness?", "I'm disappointed in love and in God. Can I be honest with him?", "I'm not a Christian yet. Is it okay for me, single, to get to know Jesus?", "I want to follow Jesus but worry my life would change too much. What would I lose?", "How do I find real friends and build a circle that supports me?", "I get anxious that no one will love me. What is Jesus' love like?", "I don't believe love can be unconditional. What do I do with that?", "If I want to give my life to Jesus, how do I begin?"]}, "parent": {"zh": ["孩子不愛讀書、整天滑手機，我很焦慮，怎麼辦？", "孩子頂嘴叛逆，我很容易發火，這段經文怎麼幫我？", "夫妻對教養孩子的意見不同，吵得很兇，怎麼辦？", "我怎麼跟孩子說耶穌，才不會像說教？", "孩子問「神在哪裡」「為什麼人會死」，我怎麼回答？", "我常常對孩子大聲，事後很後悔，神會原諒我嗎？", "擔心孩子被霸凌或交到壞朋友，我怎麼為他禱告？", "孩子成績不理想，我怎麼不比較、不給他壓力？", "工作與家庭很難平衡，我怕錯過孩子的成長，怎麼辦？", "孩子生病或有特殊需要，我很自責，神怎麼看？", "青春期的孩子不跟我說話，我怎麼重新靠近他？", "我自己都做不好，怎麼當孩子的榜樣？", "家裡有人不信耶穌，我怎麼在家中活出信仰？", "怎麼帶孩子禱告、讀經，變成快樂的家庭習慣？", "孩子偏離信仰、離開教會，我可以做什麼？", "孩子問我「爸媽信耶穌，我一定要信嗎」，怎麼回答？", "我怎麼教孩子面對失敗與失望？", "我想給孩子最好的人生，聖經說最重要的是什麼？", "我自己信得很淺，怎麼帶孩子認識耶穌？", "為孩子的一生，我今天可以怎麼為他禱告？"], "zs": ["孩子不爱读书、整天滑手机，我很焦虑，怎么办？", "孩子顶嘴叛逆，我很容易发火，这段经文怎么帮我？", "夫妻对教养孩子的意见不同，吵得很凶，怎么办？", "我怎么跟孩子说耶稣，才不会像说教？", "孩子问“神在哪里”“为什么人会死”，我怎么回答？", "我常常对孩子大声，事后很后悔，神会原谅我吗？", "担心孩子被霸凌或交到坏朋友，我怎么为他祷告？", "孩子成绩不理想，我怎么不比较、不给他压力？", "工作与家庭很难平衡，我怕错过孩子的成长，怎么办？", "孩子生病或有特殊需要，我很自责，神怎么看？", "青春期的孩子不跟我说话，我怎么重新靠近他？", "我自己都做不好，怎么当孩子的榜样？", "家里有人不信耶稣，我怎么在家中活出信仰？", "怎么带孩子祷告、读经，变成快乐的家庭习惯？", "孩子偏离信仰、离开教会，我可以做什么？", "孩子问我“爸妈信耶稣，我一定要信吗”，怎么回答？", "我怎么教孩子面对失败与失望？", "我想给孩子最好的人生，圣经说最重要的是什么？", "我自己信得很浅，怎么带孩子认识耶稣？", "为孩子的一生，我今天可以怎么为他祷告？"], "en": ["My child hates studying and is on the phone all day. I'm anxious — what do I do?", "My child talks back and I lose my temper. How does this passage help me?", "My spouse and I disagree about parenting and fight. What should we do?", "How can I talk about Jesus with my child without sounding preachy?", "My child asks, 'Where is God?' and 'Why do people die?' How do I answer?", "I often shout at my child and regret it. Will God forgive me?", "I fear my child will be bullied or fall in with bad friends. How do I pray for them?", "My child's grades are poor. How do I avoid comparing and adding pressure?", "Work and family are hard to balance and I fear missing my child's growing up. What can I do?", "My child is ill or has special needs and I blame myself. How does God see this?", "My teenager won't talk to me. How do I get close again?", "I can't even get it right myself. How can I be a role model?", "Someone at home doesn't believe. How do I live out my faith at home?", "How do I turn prayer and Bible reading with my child into a happy family habit?", "My child has drifted from faith or left church. What can I do?", "My child asks, 'You believe in Jesus — do I have to?' How do I answer?", "How do I teach my child to face failure and disappointment?", "I want the best life for my child. What does the Bible say matters most?", "My own faith is thin. How can I lead my child to know Jesus?", "For my child's whole life, how can I pray for them today?"]}, "couple": {"zh": ["我們吵架後冷戰，誰該先開口？這段經文怎麼說？", "對方的缺點讓我越來越受不了，怎麼辦？", "錢的事常常吵，聖經給夫妻什麼智慧？", "婆媳或岳父母的問題夾在中間，我該怎麼做？", "另一半不信耶穌，我怎麼愛他，又不給他壓力？", "我們很久沒有好好說話了，怎麼重新連結？", "他（她）曾經傷害我，我真的能原諒嗎？", "育兒讓我們都很累，怎麼不把怨氣發在彼此身上？", "我覺得自己付出比較多、很委屈，耶穌怎麼教我？", "夫妻個性不同，怎麼互補而不是互相消耗？", "我們很不習慣一起禱告，怎麼開始？", "我們對未來很不同調（搬家、工作），怎麼取得同心？", "愛情變淡了，怎麼重新點燃？", "我怕我們走不下去了，聖經對婚姻的盼望是什麼？", "「順服」是不是就要完全聽對方的？", "對方沉迷工作、手機或遊戲，我怎麼表達感受？", "我們想建立一個有耶穌的家，第一步是什麼？", "耶穌真的能改變我們的婚姻嗎？", "兩個人只有一個人信耶穌，怎麼彼此尊重？", "今晚我們可以一起做的一個小禱告是什麼？"], "zs": ["我们吵架后冷战，谁该先开口？这段经文怎么说？", "对方的缺点让我越来越受不了，怎么办？", "钱的事常常吵，圣经给夫妻什么智慧？", "婆媳或岳父母的问题夹在中间，我该怎么做？", "另一半不信耶稣，我怎么爱他，又不给他压力？", "我们很久没有好好说话了，怎么重新连结？", "他（她）曾经伤害我，我真的能原谅吗？", "育儿让我们都很累，怎么不把怨气发在彼此身上？", "我觉得自己付出比较多、很委屈，耶稣怎么教我？", "夫妻个性不同，怎么互补而不是互相消耗？", "我们很不习惯一起祷告，怎么开始？", "我们对未来很不同调（搬家、工作），怎么取得同心？", "爱情变淡了，怎么重新点燃？", "我怕我们走不下去了，圣经对婚姻的盼望是什么？", "“顺服”是不是就要完全听对方的？", "对方沉迷工作、手机或游戏，我怎么表达感受？", "我们想建立一个有耶稣的家，第一步是什么？", "耶稣真的能改变我们的婚姻吗？", "两个人只有一个人信耶稣，怎么彼此尊重？", "今晚我们可以一起做的一个小祷告是什么？"], "en": ["We're in a cold war after a fight. Who should speak first? What does this passage say?", "My spouse's flaws are getting harder to bear. What do I do?", "We often fight about money. What wisdom does the Bible give a couple?", "I'm caught between my spouse and in-laws. What should I do?", "My spouse doesn't believe in Jesus. How do I love them without pressuring them?", "We haven't really talked in a long time. How do we reconnect?", "They hurt me. Can I truly forgive?", "Parenting has exhausted us both. How do we avoid taking it out on each other?", "I feel I give more and I'm resentful. How does Jesus teach me?", "We're very different in temperament. How do we complement instead of drain each other?", "We're not used to praying together. How do we begin?", "We're out of step about the future (moving, work). How do we become one in heart?", "Our love has cooled. How do we rekindle it?", "I'm afraid we won't make it. What hope does the Bible give for marriage?", "Does 'submission' mean I must simply obey my spouse?", "My spouse is consumed by work, phone or games. How do I express how I feel?", "We want a home that has Jesus at the centre. What is the first step?", "Can Jesus really change our marriage?", "Only one of us believes in Jesus. How do we respect each other?", "What is one small prayer we can pray together tonight?"]}, "pastor": {"zh": ["這段經文放進主日講道，怎麼抓出一個清楚的大綱？", "我很疲憊，怎麼在服事中不倦怠？", "同工之間意見不合，我怎麼用經文帶領大家合一？", "會友流失或人數停滯，我怎麼不焦慮、不比較？", "我怎麼關懷一位還沒信、但開始來教會的朋友？", "怎麼向不信的人清楚又溫柔地傳福音？", "遇到對信仰有強烈質疑的慕道友（佛教、民間信仰、無神論），怎麼回應？", "我怎麼預備一次決志的邀請，又不給人壓力？", "我自己的靈命枯乾，怎麼重新得力？", "面對教會的衝突或批評，我怎麼回應？", "我怎麼栽培初信者，帶他們從信主走到成長？", "怎麼培養同工與接班人？", "如何平衡家庭與事奉，不虧欠家人？", "我怎麼為一位臨終的人禱告，並安慰家屬？", "有人想受洗，我怎麼預備受洗班與他的見證？", "講道常被說太深或太淺，怎麼拿捏？", "怎麼帶小組查經，讓還沒信的人也能參與？", "我怎麼回應「為什麼好人受苦」這類難題？", "忙碌的事工裡，我怎麼仍然「先生命、再關係、後事工」？", "請給我一個今天可以帶會友禱告的簡短結尾。"], "zs": ["这段经文放进主日讲道，怎么抓出一个清楚的大纲？", "我很疲惫，怎么在服事中不倦怠？", "同工之间意见不合，我怎么用经文带领大家合一？", "会友流失或人数停滞，我怎么不焦虑、不比较？", "我怎么关怀一位还没信、但开始来教会的朋友？", "怎么向不信的人清楚又温柔地传福音？", "遇到对信仰有强烈质疑的慕道友（佛教、民间信仰、无神论），怎么回应？", "我怎么预备一次决志的邀请，又不给人压力？", "我自己的灵命枯干，怎么重新得力？", "面对教会的冲突或批评，我怎么回应？", "我怎么栽培初信者，带他们从信主走到成长？", "怎么培养同工与接班人？", "如何平衡家庭与事奉，不亏欠家人？", "我怎么为一位临终的人祷告，并安慰家属？", "有人想受洗，我怎么预备受洗班与他的见证？", "讲道常被说太深或太浅，怎么拿捏？", "怎么带小组查经，让还没信的人也能参与？", "我怎么回应“为什么好人受苦”这类难题？", "忙碌的事工里，我怎么仍然“先生命、再关系、后事工”？", "请给我一个今天可以带会友祷告的简短结尾。"], "en": ["How do I draw a clear outline from this passage for Sunday's sermon?", "I'm exhausted. How do I serve without burning out?", "My co-workers disagree. How do I use Scripture to lead us into unity?", "Members are leaving or numbers are flat. How do I avoid anxiety and comparison?", "How do I care for a friend who isn't a believer yet but has started coming to church?", "How do I share the gospel clearly and gently with someone who doesn't believe?", "How do I respond to a seeker with strong objections (Buddhist, folk religion, atheist)?", "How do I prepare an invitation to commit to Christ without pressuring people?", "My own spiritual life is dry. How do I find strength again?", "How do I respond to conflict or criticism in the church?", "How do I disciple new believers from first faith into growth?", "How do I raise up co-workers and successors?", "How do I balance family and ministry without neglecting my family?", "How do I pray for someone who is dying and comfort the family?", "Someone wants to be baptised. How do I prepare the class and their testimony?", "My sermons are said to be too deep or too shallow. How do I find the balance?", "How do I lead a small-group Bible study that non-believers can join?", "How do I answer hard questions like 'why do good people suffer?'", "In busy ministry, how do I still put 'life first, relationships next, ministry last'?", "Give me a short closing I can use today to lead members in prayer."]}};
/* v2.18.35：慕道友依信仰背景（佛教／民間信仰／一貫道／穆斯林／無神論）各 20 題；「沒有信仰」用慕道友通用 20 題 */
const QBANK20SK = {"buddhism": {"zh": ["我習慣誦經、吃素，信耶穌需要放棄這些嗎？", "佛教說苦是來自執著，聖經怎麼看人的苦？", "佛教講因果報應，聖經說的「恩典」跟因果有什麼不同？", "輪迴和聖經說的「人有一次生死，之後面對審判」差在哪裡？", "佛教講眾生平等、慈悲為懷，耶穌也教人愛人嗎？", "我拜佛是為了心安，耶穌給的平安有什麼不一樣？", "佛陀和耶穌都是導師嗎？耶穌為什麼說自己是救主？", "佛教講「放下」，聖經怎麼教人放下憂慮與怨恨？", "我學過靜坐，基督教的默想禱告有什麼不同？", "佛教強調自力修行，聖經為什麼說得救是靠恩典、不是靠行為？", "聖經說神是創造主，跟佛教的「空」「緣起」有什麼不同？", "我家人都信佛，我若信耶穌會讓他們傷心嗎？怎麼溝通？", "親人往生要做功德迴向，基督徒怎麼看亡者與追思？", "我做過不少善事，為什麼還說我需要被拯救？", "佛教說人人有佛性，聖經怎麼看人的本性與罪？", "為什麼耶穌的死能赦免我的罪？跟「業」有什麼關係？", "「涅槃」和聖經說的「永生」「天堂」一樣嗎？", "學佛的人可以同時信耶穌嗎？為什麼聖經強調獨一真神？", "我想了解耶穌，可以先從哪一卷、哪一段讀起？", "如果我願意試著向耶穌禱告，第一句話可以怎麼說？"], "zs": ["我习惯诵经、吃素，信耶稣需要放弃这些吗？", "佛教说苦是来自执着，圣经怎么看人的苦？", "佛教讲因果报应，圣经说的“恩典”跟因果有什么不同？", "轮回和圣经说的“人有一次生死，之后面对审判”差在哪里？", "佛教讲众生平等、慈悲为怀，耶稣也教人爱人吗？", "我拜佛是为了心安，耶稣给的平安有什么不一样？", "佛陀和耶稣都是导师吗？耶稣为什么说自己是救主？", "佛教讲“放下”，圣经怎么教人放下忧虑与怨恨？", "我学过静坐，基督教的默想祷告有什么不同？", "佛教强调自力修行，圣经为什么说得救是靠恩典、不是靠行为？", "圣经说神是创造主，跟佛教的“空”“缘起”有什么不同？", "我家人都信佛，我若信耶稣会让他们伤心吗？怎么沟通？", "亲人往生要做功德回向，基督徒怎么看亡者与追思？", "我做过不少善事，为什么还说我需要被拯救？", "佛教说人人有佛性，圣经怎么看人的本性与罪？", "为什么耶稣的死能赦免我的罪？跟“业”有什么关系？", "“涅槃”和圣经说的“永生”“天堂”一样吗？", "学佛的人可以同时信耶稣吗？为什么圣经强调独一真神？", "我想了解耶稣，可以先从哪一卷、哪一段读起？", "如果我愿意试着向耶稣祷告，第一句话可以怎么说？"], "en": ["I chant and eat vegetarian. Do I have to give these up to follow Jesus?", "Buddhism says suffering comes from attachment. How does the Bible see human suffering?", "Buddhism teaches karma. How is the Bible's 'grace' different from cause and effect?", "How is reincarnation different from the Bible's 'one life, then judgement'?", "Buddhism teaches equality and compassion. Does Jesus teach loving others too?", "I worship the Buddha for peace of mind. How is the peace Jesus gives different?", "Are the Buddha and Jesus both teachers? Why does Jesus call himself Saviour?", "Buddhism speaks of 'letting go'. How does the Bible teach letting go of worry and resentment?", "I've practised meditation. How is Christian contemplative prayer different?", "Buddhism stresses self-effort. Why does the Bible say we're saved by grace, not works?", "The Bible says God is Creator. How is that different from 'emptiness' and 'dependent origination'?", "My family are all Buddhists. Would following Jesus hurt them? How do I talk with them?", "When a loved one dies we do merit-transfer. How do Christians see the dead and remembrance?", "I've done many good deeds. Why does the Bible say I need to be saved?", "Buddhism says everyone has Buddha-nature. How does the Bible see human nature and sin?", "Why can Jesus' death forgive my sins? How does that relate to karma?", "Is 'nirvana' the same as the Bible's 'eternal life' and 'heaven'?", "Can a Buddhist follow Jesus at the same time? Why does the Bible stress one true God?", "I want to know Jesus. Which book or passage should I read first?", "If I'm willing to try praying to Jesus, what can I say as a first sentence?"]}, "folk": {"zh": ["我家拜拜、拜祖先，信耶穌就不能拜了嗎？為什麼？", "我拜神明是求平安、求保佑，耶穌可以給我這些嗎？", "聖經教人孝敬父母，信耶穌會不會變成不孝？", "清明、中元要祭拜祖先，基督徒可以怎麼追思、表達孝心？", "我家神桌上有好多神明，到底哪一位才是真的？", "算命、拜太歲、改運，聖經怎麼看？", "風水和廟裡的籤準不準？信耶穌的人怎麼面對未知的事？", "我生意不順，朋友教我拜財神，耶穌怎麼幫我？", "家裡有人生病，有人說要收驚、問神，我該怎麼做？", "我怕得罪神明、遭報應，信了耶穌，這些恐懼怎麼辦？", "我爸媽反對我去教會，怎麼溝通才不傷感情？", "媽祖、關公這些神明，聖經怎麼看？他們是真的嗎？", "為什麼說只有一位真神？其他的神明難道都是假的？", "過世的親人在另一個世界過得好嗎？我能為他們做什麼？", "我過去拜過很多廟，神會不會嫌棄我？", "家人的婚喪喜慶都要拜拜，我信耶穌怎麼參加才不尷尬？", "我家有神像、符咒，信主後要怎麼處理？", "耶穌能保佑我平安嗎？跟神明保佑有什麼不一樣？", "我想了解耶穌，要先去教會，還是自己先讀聖經？", "我想向耶穌禱告，需要燒香、擺供品嗎？怎麼禱告？"], "zs": ["我家拜拜、拜祖先，信耶稣就不能拜了吗？为什么？", "我拜神明是求平安、求保佑，耶稣可以给我这些吗？", "圣经教人孝敬父母，信耶稣会不会变成不孝？", "清明、中元要祭拜祖先，基督徒可以怎么追思、表达孝心？", "我家神桌上有好多神明，到底哪一位才是真的？", "算命、拜太岁、改运，圣经怎么看？", "风水和庙里的签准不准？信耶稣的人怎么面对未知的事？", "我生意不顺，朋友教我拜财神，耶稣怎么帮我？", "家里有人生病，有人说要收惊、问神，我该怎么做？", "我怕得罪神明、遭报应，信了耶稣，这些恐惧怎么办？", "我爸妈反对我去教会，怎么沟通才不伤感情？", "妈祖、关公这些神明，圣经怎么看？他们是真的吗？", "为什么说只有一位真神？其他的神明难道都是假的？", "过世的亲人在另一个世界过得好吗？我能为他们做什么？", "我过去拜过很多庙，神会不会嫌弃我？", "家人的婚丧喜庆都要拜拜，我信耶稣怎么参加才不尴尬？", "我家有神像、符咒，信主后要怎么处理？", "耶稣能保佑我平安吗？跟神明保佑有什么不一样？", "我想了解耶稣，要先去教会，还是自己先读圣经？", "我想向耶稣祷告，需要烧香、摆供品吗？怎么祷告？"], "en": ["My family worships deities and ancestors. If I follow Jesus can I no longer do that? Why?", "I worship the gods for peace and protection. Can Jesus give me those?", "The Bible teaches honouring parents. Would following Jesus make me unfilial?", "At Qingming and Ghost Month we honour ancestors. How can a Christian remember them and show respect?", "Our altar has many gods. Which one is real?", "Fortune-telling, praying to the Grand Duke, changing luck — what does the Bible say?", "Are feng shui and temple divination accurate? How do people who follow Jesus face the unknown?", "My business is struggling and a friend says worship the wealth god. How does Jesus help me?", "Someone at home is sick and people say do a soul-calling ritual or consult a deity. What should I do?", "I'm afraid of offending the gods and being punished. What happens to that fear if I follow Jesus?", "My parents oppose my going to church. How do I talk with them without hurting them?", "What does the Bible say about Mazu, Guan Gong and such? Are they real?", "Why only one true God? Are all the other gods false?", "Are my departed relatives doing well in the next world? What can I do for them?", "I've worshipped at many temples. Will God reject me?", "Weddings and funerals in my family involve worship. How can I join without awkwardness if I follow Jesus?", "We have idols and charms at home. What do I do with them after I believe?", "Can Jesus protect me? How is that different from the gods' protection?", "I want to know Jesus. Should I go to church first, or read the Bible on my own first?", "I want to pray to Jesus. Do I need incense or offerings? How do I pray?"]}, "yiguandao": {"zh": ["我吃素、重視修身行善，信耶穌需要改變這些嗎？", "一貫道說「五教同源、萬教歸一」，耶穌為什麼說自己是唯一的道路？", "我們敬拜「天」，聖經的「上帝」是同一位嗎？", "一貫道講修道成聖，聖經的「得救」靠修行還是靠恩典？", "道場裡講三期末劫，聖經對末世和審判怎麼說？", "向耶穌禱告需要什麼儀式嗎？跟我們敬天禮神有什麼不同？", "聖經裡的耶穌，跟道場裡說的耶穌（五教聖人之一）一樣嗎？", "我在道場很投入，若轉而認識耶穌，是不是背叛師尊與道親？", "道親都是好人，為什麼聖經還說人人有罪、需要救主？", "我們講「明明上帝」「回天」，聖經的天堂與永生是什麼？", "我們求道、上香，聖經說的敬拜是什麼樣子？", "為什麼聖經說耶穌是神的兒子？這跟人修成神仙有什麼不同？", "我的家人都在道場，我怎麼說出想了解耶穌的心意？", "一貫道重孝道與倫理，聖經在家庭倫理上教導什麼？", "道場有「求道」「點傳」，信耶穌要受洗，兩者有什麼不同？", "我在道場裡曾經感到平安，耶穌給的平安有什麼不同？", "我過去的修持和行善，在神面前算什麼？", "我心裡有疑問，又怕被說信心不夠，可以誠實問嗎？", "我想了解耶穌，從哪一段聖經開始最合適？", "如果我向耶穌禱告，需要先離開道場嗎？第一句可以怎麼說？"], "zs": ["我吃素、重视修身行善，信耶稣需要改变这些吗？", "一贯道说“五教同源、万教归一”，耶稣为什么说自己是唯一的道路？", "我们敬拜“天”，圣经的“上帝”是同一位吗？", "一贯道讲修道成圣，圣经的“得救”靠修行还是靠恩典？", "道场里讲三期末劫，圣经对末世和审判怎么说？", "向耶稣祷告需要什么仪式吗？跟我们敬天礼神有什么不同？", "圣经里的耶稣，跟道场里说的耶稣（五教圣人之一）一样吗？", "我在道场很投入，若转而认识耶稣，是不是背叛师尊与道亲？", "道亲都是好人，为什么圣经还说人人有罪、需要救主？", "我们讲“明明上帝”“回天”，圣经的天堂与永生是什么？", "我们求道、上香，圣经说的敬拜是什么样子？", "为什么圣经说耶稣是神的儿子？这跟人修成神仙有什么不同？", "我的家人都在道场，我怎么说出想了解耶稣的心意？", "一贯道重孝道与伦理，圣经在家庭伦理上教导什么？", "道场有“求道”“点传”，信耶稣要受洗，两者有什么不同？", "我在道场里曾经感到平安，耶稣给的平安有什么不同？", "我过去的修持和行善，在神面前算什么？", "我心里有疑问，又怕被说信心不够，可以诚实问吗？", "我想了解耶稣，从哪一段圣经开始最合适？", "如果我向耶稣祷告，需要先离开道场吗？第一句可以怎么说？"], "en": ["I'm vegetarian and value self-cultivation and good deeds. Must I change these to follow Jesus?", "Yiguandao says 'five religions share one source'. Why does Jesus say he is the only way?", "We worship 'Heaven'. Is the Bible's 'God' the same one?", "Yiguandao speaks of cultivating the Way to become a saint. Is 'salvation' by effort or by grace?", "Our hall teaches the three ages of calamity. What does the Bible say about the end and judgement?", "Does praying to Jesus need rituals? How is it different from how we honour Heaven?", "Is the Jesus of the Bible the same as the Jesus in our hall (one of the five sages)?", "I'm deeply involved in our hall. If I come to know Jesus, am I betraying my teachers and fellow believers?", "My fellow believers are good people. Why does the Bible say everyone has sin and needs a Saviour?", "We speak of 'the Lord on High' and 'returning to Heaven'. What are heaven and eternal life in the Bible?", "We seek the Way and burn incense. What does worship look like in the Bible?", "Why does the Bible say Jesus is the Son of God? How is that different from a person cultivating into a deity?", "My family are all in the hall. How do I tell them I want to understand Jesus?", "Yiguandao values filial piety and ethics. What does the Bible teach about family?", "Our hall has 'seeking the Way' and 'the transmitting master'. Following Jesus involves baptism. What's the difference?", "I once felt peace in the hall. How is the peace Jesus gives different?", "What do my past practice and good deeds count for before God?", "I have doubts but fear being told my faith is weak. May I ask honestly?", "I want to know Jesus. Which part of the Bible is best to start with?", "If I pray to Jesus, must I leave the hall first? What can I say as a first sentence?"]}, "muslim": {"zh": ["我信真主獨一，基督徒說的「三位一體」是不是信三個神？", "我們尊敬爾薩（耶穌），聖經為什麼說他是神的兒子？", "古蘭經和聖經都提到亞伯拉罕、摩西，兩者有什麼不同？", "穆斯林靠五功和行善盼望進天堂，聖經為什麼說得救是靠恩典？", "耶穌真的被釘十字架而死嗎？為什麼需要他的死？", "有人說聖經被更改了，聖經可靠嗎？有什麼根據？", "耶穌復活有什麼歷史根據？", "我每天禮拜五次，基督徒怎麼禱告？一定要固定的方式嗎？", "我犯了罪，真主赦免靠什麼？聖經說的赦免是什麼？", "我若對耶穌有興趣，家人和社群會怎麼看？我怎麼保護自己與家人的關係？", "我可以只讀聖經來認識耶穌，不與家人爭論嗎？", "聖經怎麼說耶穌的身分？只是先知，還是更多？", "聖經說神是愛，我熟悉真主的慈憫，兩者有什麼異同？", "基督徒喝酒、吃豬肉嗎？聖經對飲食的教導是什麼？", "末日審判的時候，我怎麼才有把握得救？", "「道成肉身」是什麼意思？神怎麼可能成為人？", "基督徒怎麼看聖戰與暴力？耶穌怎麼教導人對待仇敵？", "我從小受穆斯林教育，如果我信耶穌，是不是背叛？", "我可以怎麼安靜地讀約翰福音，認識耶穌？", "如果我想向耶穌禱告，可以用自己的話嗎？第一句怎麼說？"], "zs": ["我信真主独一，基督徒说的“三位一体”是不是信三个神？", "我们尊敬尔萨（耶稣），圣经为什么说他是神的儿子？", "古兰经和圣经都提到亚伯拉罕、摩西，两者有什么不同？", "穆斯林靠五功和行善盼望进天堂，圣经为什么说得救是靠恩典？", "耶稣真的被钉十字架而死吗？为什么需要他的死？", "有人说圣经被更改了，圣经可靠吗？有什么根据？", "耶稣复活有什么历史根据？", "我每天礼拜五次，基督徒怎么祷告？一定要固定的方式吗？", "我犯了罪，真主赦免靠什么？圣经说的赦免是什么？", "我若对耶稣有兴趣，家人和社群会怎么看？我怎么保护自己与家人的关系？", "我可以只读圣经来认识耶稣，不与家人争论吗？", "圣经怎么说耶稣的身分？只是先知，还是更多？", "圣经说神是爱，我熟悉真主的慈悯，两者有什么异同？", "基督徒喝酒、吃猪肉吗？圣经对饮食的教导是什么？", "末日审判的时候，我怎么才有把握得救？", "“道成肉身”是什么意思？神怎么可能成为人？", "基督徒怎么看圣战与暴力？耶稣怎么教导人对待仇敌？", "我从小受穆斯林教育，如果我信耶稣，是不是背叛？", "我可以怎么安静地读约翰福音，认识耶稣？", "如果我想向耶稣祷告，可以用自己的话吗？第一句怎么说？"], "en": ["I believe God is one. Isn't the Christian 'Trinity' belief in three gods?", "We honour Isa (Jesus). Why does the Bible say he is the Son of God?", "The Qur'an and the Bible both mention Abraham and Moses. How do they differ?", "Muslims hope for paradise through the five pillars and good deeds. Why does the Bible say salvation is by grace?", "Was Jesus really crucified and killed? Why was his death needed?", "Some say the Bible was altered. Is it reliable? What is the evidence?", "What historical evidence is there for the resurrection of Jesus?", "I pray five times a day. How do Christians pray? Must it be in a fixed form?", "I have sinned. How does God forgive according to my tradition, and what is forgiveness in the Bible?", "If I'm interested in Jesus, how will my family and community see it? How do I protect myself and my family ties?", "Can I read only the Bible to get to know Jesus, without arguing with my family?", "What does the Bible say about Jesus' identity? Only a prophet, or more?", "The Bible says God is love. I know God's mercy well. How are they alike and different?", "Do Christians drink alcohol or eat pork? What does the Bible teach about food?", "On the Day of Judgement, how can I be sure of being saved?", "What does 'the Word became flesh' mean? How could God become a man?", "How do Christians see holy war and violence? How did Jesus teach people to treat enemies?", "I was raised Muslim. If I follow Jesus, is that betrayal?", "How can I quietly read the Gospel of John to get to know Jesus?", "If I want to pray to Jesus, may I use my own words? What is a first sentence?"]}, "atheist": {"zh": ["科學已經能解釋宇宙的起源，為什麼還需要神？", "進化論和聖經的創造是不是互相衝突？", "我沒有看過神，有什麼證據證明神存在？", "如果神是全能又全愛，為什麼有戰爭、疾病和災難？", "道德不靠宗教也可以，為什麼還需要信仰？", "歷史上有十字軍與宗教戰爭，這不是信仰的問題嗎？", "聖經裡有些故事（如神蹟）看起來不合理，我要怎麼讀？", "耶穌在歷史上真的存在嗎？有哪些歷史記載？", "耶穌復活有什麼歷史根據？難道不是門徒編出來的？", "信仰是不是只是心理安慰、逃避現實？", "人死了就結束，不是更簡單嗎？為什麼要談永生？", "人生的意義如果沒有神，是從哪裡來的？", "基督徒怎麼面對自己的疑問與懷疑？可以提出來問嗎？", "我看過一些基督徒言行不一，這是不是證明信仰是假的？", "「信」是不是就是放棄思考？", "如果我想認真認識耶穌，要用什麼態度、先看什麼？", "禱告真的有用嗎？有沒有可以自己驗證的方法？", "為什麼說人有「罪」？我不覺得自己犯了什麼大錯。", "耶穌的教導有什麼獨特之處，值得認真考慮？", "我還在懷疑，但願意試著開口禱告一次，可以怎麼說？"], "zs": ["科学已经能解释宇宙的起源，为什么还需要神？", "进化论和圣经的创造是不是互相冲突？", "我没有看过神，有什么证据证明神存在？", "如果神是全能又全爱，为什么有战争、疾病和灾难？", "道德不靠宗教也可以，为什么还需要信仰？", "历史上有十字军与宗教战争，这不是信仰的问题吗？", "圣经里有些故事（如神迹）看起来不合理，我要怎么读？", "耶稣在历史上真的存在吗？有哪些历史记载？", "耶稣复活有什么历史根据？难道不是门徒编出来的？", "信仰是不是只是心理安慰、逃避现实？", "人死了就结束，不是更简单吗？为什么要谈永生？", "人生的意义如果没有神，是从哪里来的？", "基督徒怎么面对自己的疑问与怀疑？可以提出来问吗？", "我看过一些基督徒言行不一，这是不是证明信仰是假的？", "“信”是不是就是放弃思考？", "如果我想认真认识耶稣，要用什么态度、先看什么？", "祷告真的有用吗？有没有可以自己验证的方法？", "为什么说人有“罪”？我不觉得自己犯了什么大错。", "耶稣的教导有什么独特之处，值得认真考虑？", "我还在怀疑，但愿意试着开口祷告一次，可以怎么说？"], "en": ["Science can explain the origin of the universe. Why do we still need God?", "Does evolution conflict with the Bible's creation?", "I've never seen God. What evidence is there that he exists?", "If God is all-powerful and all-loving, why are there wars, disease and disasters?", "Morality doesn't need religion. Why do we still need faith?", "History has the Crusades and religious wars. Isn't that the problem with faith?", "Some Bible stories (like miracles) seem unreasonable. How should I read them?", "Did Jesus really exist in history? What historical records are there?", "What historical basis is there for the resurrection? Wasn't it invented by the disciples?", "Isn't faith just psychological comfort and escape from reality?", "Isn't it simpler that death is the end? Why talk about eternal life?", "Without God, where does life's meaning come from?", "How do Christians face their own doubts and questions? May I raise them?", "I've seen Christians whose words and actions don't match. Doesn't that prove faith is false?", "Doesn't 'believing' mean giving up thinking?", "If I want to look seriously at Jesus, what attitude should I take and what should I read first?", "Does prayer really work? Is there a way I can test it myself?", "Why does the Bible say people have 'sin'? I don't think I've done anything terrible.", "What is distinctive in Jesus' teaching that's worth taking seriously?", "I'm still doubting, but willing to try praying once. What can I say?"]}};
const qbankNow = () => {
  const lg = state.lang;
  if (state.audience === 'seeker') { const bs = QBANK20SK[state.skbg]; if (bs && (bs[lg] || !isX())) return bs[lg] || bs.zh; }
  { const b20 = QBANK20[state.audience]; if (b20 && (b20[lg] || !isX())) return b20[lg] || b20.zh; }
  { const x2 = A2(); if (x2) return x2.q; }
  const a = QBANK_AUD[state.audience];
  return (a && (a[lg] || a.zh)) || QBANK[lg] || QBANK.zh;
};
/* ---- 慕道友（v2.11.0）：站在還沒信主的人的角度，用生活的話說明聖經的真理，並給實際有用的幫助 ---- */
const SK_SYS   = () => isEP() ? ' Audience: a seeker — a friend who is not yet a believer and is exploring the Christian faith. Stand fully in their shoes: they may never have read the Bible, do not know church language, and may have questions or reservations. (1) Start from their real situation, feelings or question, then bring in the passage, so they feel "this is about me". (2) Use plain everyday words; the 321 vision is only your inner compass — never use insider words like "self-emptied", "let Jesus reign", "overcomer" or "spiritual", and no church or theological jargon; if a word like grace, sin or salvation is unavoidable, explain it at once in everyday terms. (3) Be honest and respectful — no preaching, no pressure, no demand to believe now, no judging; doubts and objections are normal, so acknowledge the weight of the question first, then answer it honestly. (4) State clearly what the Bible says about it (what God is like, what Jesus did for us) through stories, pictures and everyday examples they can understand and remember. (5) Always give practical help: one or two small steps they can try this week by themselves (something to notice, a question to ask, a simple action). (6) When it fits, gently invite them to keep exploring (read a short passage, ask a question) — never force the conversation toward a decision. (7) Never say things like "we Christians all know", which assumes they already believe. Quote the World English Bible and explain it in plain words. If you include a prayer, offer it only as "if you like, you could say something like this to God" — never forced. Keep the whole answer concise, with short paragraphs.' : (isZS() ? ' 回答对象：慕道友（还没有信主、正在了解基督信仰的朋友）。请完全站在他的立场和角度：他可能没读过圣经、不懂教会用语，心里有疑问，甚至有些保留。①先从他真实的生活处境、感受或疑问切入，再带到经文，让他觉得“这跟我有关”。②用最平常的话说；321理念只是你心里的方向，不要在回答里出现“无己、作王、得胜、属灵”这类内部用语，也不用教会与神学术语；一定要提到的词（如恩典、罪、救恩），马上用生活的说法解释。③诚实、尊重、不说教、不施压、不要求他现在就相信，也不论断他；有疑问或质疑很正常，先认真承认那个问题的份量，再诚实回答。④清楚说出圣经在这件事上的真理（神是怎样的神、耶稣为我们做了什么），用故事、比喻和日常例子，让他听得懂、记得住。⑤一定要有实際有用的帮助：给一两个他这个星期就能自己试试看的小步驟（一个观察、一个提问、一个簡单的行动）。⑥合适时，可以温和邀请他继续探索（例如读一小段、问一个问题），不要硬把话题转到决志。⑦不要说“我们基督徒都知道”这类预设他已经信的话。引用经文用和合本，并用白话解释他的意思。若写到祷告，只当作“若你愿意，可以这样对神说”的邀请，不强迫。整个回答要簡明、段落要短。' : ' 回答對象：慕道友（還沒有信主、正在了解基督信仰的朋友）。請完全站在他的立場和角度：他可能沒讀過聖經、不懂教會用語，心裡有疑問，甚至有些保留。①先從他真實的生活處境、感受或疑問切入，再帶到經文，讓他覺得「這跟我有關」。②用最平常的話說；321理念只是你心裡的方向，不要在回答裡出現「無己、作王、得勝、屬靈」這類內部用語，也不用教會與神學術語；一定要提到的詞（如恩典、罪、救恩），馬上用生活的說法解釋。③誠實、尊重、不說教、不施壓、不要求他現在就相信，也不論斷他；有疑問或質疑很正常，先認真承認那個問題的份量，再誠實回答。④清楚說出聖經在這件事上的真理（神是怎樣的神、耶穌為我們做了什麼），用故事、比喻和日常例子，讓他聽得懂、記得住。⑤一定要有實際有用的幫助：給一兩個他這個星期就能自己試試看的小步驟（一個觀察、一個提問、一個簡單的行動）。⑥合適時，可以溫和邀請他繼續探索（例如讀一小段、問一個問題），不要硬把話題轉到決志。⑦不要說「我們基督徒都知道」這類預設他已經信的話。引用經文用和合本，並用白話解釋它的意思。若寫到禱告，只當作「若你願意，可以這樣對神說」的邀請，不強迫。整個回答要簡明、段落要短。');
const SK_WRITE = () => isEP() ? '\nThe reader is a friend who is not yet a believer: everyday, warm, never preachy, no church jargon, never assuming they already believe. No emoji.' : (isZS() ? '\n读者是还没信主的朋友：用生活化、亲切、不说教的话，不用教会术语，不预设他已经信；不要用表情符号。' : '\n讀者是還沒信主的朋友：用生活化、親切、不說教的話，不用教會術語，不預設他已經信；不要用表情符號。');
const SK_STYLE = () => isEP() ? 'Style: for someone who is not a believer and has never read the Bible. State the background in the question itself (name the person or event), assume no Bible or church vocabulary, use plain words, and make the explanation one plain sentence on why it matters to an ordinary person.' : (isZS() ? '风格：给还没信主、没读过圣经的人。题目要把背景交代清楚（人物、事件的名字直接写出来），不假设他懂圣经或教会用语；用字平实，解析用一句白话说明这件事对一般人有什么意义。' : '風格：給還沒信主、沒讀過聖經的人。題目要把背景交代清楚（人物、事件的名字直接寫出來），不假設他懂聖經或教會用語；用字平實，解析用一句白話說明這件事對一般人有什麼意義。');
const SK_RW = nm => [
  L3(`恭喜你！《${nm}》整卷讀完了！`, `恭喜你！《${nm}》整卷读完了！`, `Congratulations — you finished the whole book of ${nm}!`),
  L3('你願意一天一天走進這本書，真不簡單。希望這些話對你有幫助。', '你愿意一天一天走进这本书，真不簡单。希望这些话对你有帮助。', 'You kept walking into this book day by day — that is not easy. I hope these words help you.')
];
const SK_RES = () => [
  L3('沒關係，剛接觸這些內容本來就不容易，再看一遍會更清楚。', '没关系，刚接触这些内容本来就不容易，再看一遍会更清楚。', 'That is okay — it takes time with new material. Another look will make it clearer.'),
  L3('不錯喔！你已經抓到這一章的重點了。', '不错喔！你已经抓到这一章的重点了。', 'Nice! You have caught the main points of this chapter.'),
  L3('太厲害了！你對這一章的內容很清楚。', '太厉害了！你对这一章的内容很清楚。', 'Excellent! You know this chapter really well.')
];
const CHAT_RETRY = [900, 1800];
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
  const srcNow = chatSrc;                     // 這一輪的來源經文
  chatLog.push({ role:'user', text, src:srcNow }); paintChat();
  chatBusy = true;
  chatLog.push({ role:'ai', text: t().thinking, src:srcNow }); paintChat();
  const b = RD.book ? BOOK[RD.book] : null;
  const sys = (isEP()
    ? 'You are Xiaozhi, a Bible companion from Kingdom 321 Online Fellowship. Answer in the spirit of the 3-2-1 ideology — the three foundations: Jesus is my Role Model, the Bible is my Standard, the Holy Spirit is my Guide; the two core values: Let Jesus be King, Let Jesus receive all the glory; the one purpose: to build God’s system. Explain plainly, use everyday pictures, quote the World English Bible, and keep answers short.'
    : isZS()
    ? '你是「小智」，国度321空中团契的圣经陪读。以321理念（耶稣是我的榜样、圣经是我的准则、圣灵是我的引导；让耶稣作王、让耶稣得着一切的荣耀；建立属神的体系）回应，深入浅出、善用比喻，引用和合本圣经，回答简明。'
    : '你是「小智」，國度321空中團契的聖經陪讀。以321理念（耶穌是我的榜樣、聖經是我的準則、聖靈是我的引導；讓耶穌作王、讓耶穌得著一切的榮耀；建立屬神的體系）回應，深入淺出、善用比喻，引用和合本聖經，回答簡明。')
    /* 回答的寫法——使用者定下來的規矩，App 這邊一併配合：
       表格在畫面上畫成真的表格、朗讀時會說成人話、分享時換成清單，
       所以放心用表格；重點用 > 標一句，那一句會被抓去做成美圖。 */
    + SYS_FMT()
    + AUD_SYS() + SKBG_SYS() + LEN_SYS()
    + (b ? (isEP() ? ` (The reader is currently in ${bname(b)} ${RD.ch}.)`
          : isZS() ? `（读者目前在读：${bname(b)} 第 ${RD.ch} 章）`
                   : `（讀者目前在讀：${bname(b)} 第 ${RD.ch} 章）`) : '');
  const msgs = chatLog.filter(m => m.text !== t().thinking).slice(-12)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();    // 第一則一定要是使用者
  /* Worker 冷啟動時第一次呼叫常常會失敗，退幾步再試；真的連不上就把原因寫出來。
     回答被截斷（max_tokens）時，自動把已寫的內容當作上文，請小智從中斷處接著寫完。 */
  let r = await chatCall(sys, msgs);
  let acc = r.out, why = r.why, stop = r.stop, n = 0;
  for (;;){
    const tr = acc ? chatTruncated(acc, stop) : '';
    if (!tr || n >= (tr === 'sure' ? 4 : 1)) break;
    n++;
    chatLog[chatLog.length - 1] = { role:'ai', src:srcNow, ok:false, cont:true, text:acc }; paintChat();
    const r2 = await chatCall(sys, msgs.concat([{ role:'assistant', content:acc }, { role:'user', content:CONT_ASK() }]));
    if (!r2.out) break;
    acc = chatJoin(acc, r2.out); stop = r2.stop;
  }
  chatLog[chatLog.length - 1] = { role:'ai', src:srcNow, ok: !!acc,
    text: acc || (t().chatErr + (why ? '（' + why + '）' : '')) };
  chatBusy = false; foldOld(); paintChat();
}

/* ================================================================ 讀經樂：聖經猜謎＆讀經測驗（v2.9.0）
   題目由小智「照著這一章的經文」現場出，所以每次都不一樣，也會跟著「回答對象」
   （成人／青少年／兒童）調整口氣與難度。答錯的測驗題會收進「錯題本」，之後不用
   連線就能複習——答對一次就從錯題本拿掉，這是加深記憶的重點。 */
const PL_QN = 5, PL_RN = 4;
let PL = null;            // 進行中的一局；null＝在首頁
let plSrc = 'cur';        // 出題範圍：cur 目前這章／rand 隨機一章

const PLAY_CSS = `
.pl-big{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface);box-shadow:var(--shadow);margin-bottom:10px;cursor:pointer;width:100%;text-align:left;color:var(--ink);font-family:inherit}
.pl-big:active{background:var(--accent-soft)}
.pl-big .ic{font-size:30px;flex:0 0 auto}
.pl-big .t{font-weight:800;font-size:16px}
.pl-big .s{font-size:12.5px;color:var(--ink-faint);line-height:1.5}
.pl-bar{height:8px;border-radius:99px;background:var(--surface-alt);overflow:hidden;margin:6px 0 14px}
.pl-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--gold));border-radius:99px;transition:width .3s}
.pl-meta{display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink-faint)}
.pl-q{font-family:var(--f-serif);font-size:18px;line-height:1.8;font-weight:700;margin:6px 0 14px}
.pl-opt{display:block;width:100%;text-align:left;border:1px solid var(--border-strong);background:var(--surface);color:var(--ink);border-radius:12px;padding:12px 14px;margin-bottom:9px;font-size:15px;line-height:1.6;cursor:pointer;font-family:inherit}
.pl-opt:active{background:var(--accent-soft)}
.pl-opt[disabled]{cursor:default}
.pl-opt.ok{border-color:var(--good);box-shadow:inset 0 0 0 1.5px var(--good);font-weight:700}
.pl-opt.bad{border-color:var(--bad);box-shadow:inset 0 0 0 1.5px var(--bad)}
.pl-expl{background:var(--gold-soft);border-radius:10px;padding:10px 12px;font-size:14px;line-height:1.8;margin:4px 0 12px}
.pl-expl b{color:var(--gold)}
.pl-hint{display:flex;gap:8px;align-items:flex-start;background:var(--surface-alt);border-left:3px solid var(--gold);border-radius:8px;padding:9px 12px;margin-bottom:8px;font-size:14.5px;line-height:1.7}
.pl-hint b{color:var(--gold);flex:0 0 auto}
.pl-guess{display:flex;gap:8px;margin:12px 0 8px}
.pl-guess input{flex:1}
.pl-ans{text-align:center;font-family:var(--f-serif);font-size:26px;font-weight:900;color:var(--accent);margin:10px 0 4px;letter-spacing:.06em}
.pl-score{text-align:center;padding:8px 0 2px}
.pl-score .n{font-family:var(--f-serif);font-size:46px;font-weight:900;color:var(--accent)}
.pl-stars{font-size:28px;letter-spacing:6px}
.pl-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.pl-row .btn{flex:1 1 auto}
.pl-shake{animation:plshake .35s}
@keyframes plshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.pl-load{text-align:center;padding:46px 10px;color:var(--ink-soft)}
.pl-load .spin{width:34px;height:34px;margin:0 auto 14px;border-radius:50%;border:3px solid var(--border);border-top-color:var(--accent);animation:spin 1s linear infinite}
`;
function plCss(){
  if ($('#plcss')) return;
  const el = document.createElement('style'); el.id = 'plcss'; el.textContent = PLAY_CSS;
  document.head.appendChild(el);
}

/* ---- 出題範圍 ---- */
function plCurSrc(){
  if (RD.book && RD.ch && BOOK[RD.book]) return { b:RD.book, ch:RD.ch, k:L3('正在讀', '正在读', 'Reading') };
  if (user.last && BOOK[user.last.book]) return { b:user.last.book, ch:user.last.ch, k:L3('上次讀到', '上次读到', 'Last read') };
  const d = dailyPick();
  return { b:d[0], ch:d[1], k:L3('今日經文', '今日经文', 'Today') };
}
function plResolveSrc(){
  if (plSrc === 'rand'){
    const ks = Object.keys(user.progress);
    if (ks.length){
      const k = ks[Math.floor(Math.random() * ks.length)], i = k.lastIndexOf('-');
      const b = k.slice(0, i), ch = parseInt(k.slice(i + 1), 10);
      if (BOOK[b] && ch >= 1 && ch <= BOOK[b].ch) return { b, ch };
    }
    const bk = TOC[Math.floor(Math.random() * TOC.length)];
    return { b:bk.id, ch: 1 + Math.floor(Math.random() * bk.ch) };
  }
  const c = plCurSrc(); return { b:c.b, ch:c.ch };
}
/* 把一章攤成帶節號的純文字；太長就隨機取一段連續的，這樣同一章重玩也會考到不同地方 */
function chapPlain(chap){
  const parts = [];
  (chap || []).forEach(bl => {
    for (let i = 1; i < bl.length; i += 2){
      const vn = bl[i], tx = bl[i + 1];
      if (tx) parts.push((vn ? '[' + vn + ']' : '') + tx);
    }
  });
  const max = isEN() ? 6500 : 2600, glue = isEN() ? ' ' : '';
  let total = 0; parts.forEach(p => total += p.length);
  if (total <= max) return parts.join(glue);
  const s0 = Math.floor(Math.random() * parts.length), out = []; let len = 0;
  for (let j = s0; j < parts.length && len < max; j++){ out.push(parts[j]); len += parts[j].length; }
  for (let j = s0 - 1; j >= 0 && len < max; j--){ out.unshift(parts[j]); len += parts[j].length; }
  return out.join(glue);
}

/* ---- 出題的指示（三語）：只回 JSON；風格跟著「回答對象」走 ---- */
const PL_STYLE = () => {
  const a = state.audience;
  if (a === 'seeker') return SK_STYLE();
  { const x2 = A2(); if (x2) return x2.style; }
  if (isEP()) return {
    adult:'Style: steady and clear; one or two questions should bring out a life application.',
    teen :'Style: the questions and explanations are funny and witty, like friendly banter; the options may be playful, but the correct answer must be unambiguous, and never joke about God or Scripture itself.',
    kid  :'Style: for children aged 5–11 — very simple words, very short sentences, like telling a story; keep options short; one warm sentence of explanation, with at most one cute emoji.'
  }[a];
  if (isZS()) return {
    adult:'风格：沉稳清楚；其中一两题带出生命应用。',
    teen :'风格：题目与解析的口气幽默风趣、轻松有梗（像在跟朋友斗嘴），选项可以有趣，但正确答案必须明确、不含糊，绝不拿神与圣经开玩笑。',
    kid  :'风格：给5到11岁的小朋友，字词非常简单、句子很短，像在说故事；选项要短；解析一句话、亲切，最多加一个可爱的表情符号。'
  }[a];
  return {
    adult:'風格：沉穩清楚；其中一兩題帶出生命應用。',
    teen :'風格：題目與解析的口氣幽默風趣、輕鬆有梗（像在跟朋友鬥嘴），選項可以有趣，但正確答案必須明確、不含糊，絕不拿神與聖經開玩笑。',
    kid  :'風格：給5到11歲的小朋友，字詞非常簡單、句子很短，像在說故事；選項要短；解析一句話、親切，最多加一個可愛的表情符號。'
  }[a];
};
function plSysQuiz(n, k){
  if (isEP()) return `You are a Bible teacher writing a quiz for a Bible-reading app. The goal is to help people remember the KEY POINTS of this chapter.
Method: first decide the ${n} most important points in the passage (the core message, a key person or event, what God does or promises, one command or lesson, one life application) and write one question for each point.
Every question must:
1. Be clear and instantly understandable: one complete sentence under 25 words; name the person, place or event directly — never say "the man in this passage" or "that event" so the reader has to look back.
2. Ask about one thing only, with no tricks or wordplay; never use "which of these is NOT", "all of the above" or "none of the above".
3. Have exactly one correct answer that is found directly in the passage; wrong options must look like reasonable choices yet clearly contradict the passage — never two options that both work.
4. Have short options (under 8 words), similar in length and form; do not make the correct answer longer or more detailed than the others.
5. Avoid obscure numbers, names or guessing games; order from easier to harder.
6. Have a one-sentence explanation (under 25 words): the answer first, then why, in a friendly tone; do not leak the explanation in the question or options.
Write ${n} questions, each with exactly ${k} options. "v" is the verse number(s) holding the answer, e.g. "3" or "3-4". ${PL_STYLE()} Write in English. Reply with JSON ONLY — no explanation, no markdown fence: {"q":[{"q":"question","o":["option","option"],"a":index of the correct option starting at 0,"e":"one-sentence explanation","v":"3"}]}`;
  if (isZS()) return `你是圣经教师，替读经App出测验题，目标是帮人记住这一章的“重点”。
做法：先在心里找出这段经文最重要的 ${n} 个重点（核心信息、关鍵人物或事件、神的作为或应许、一条命令或教训、一个生命应用），每个重点出一题。
每一题都要做到：
1. 清楚明确、一看就懂：用完整的一句话，30字以内；直接写出人名、地名、事件，不要用“这段经文中的他”“文中那件事”这种要回头翻才懂的说法。
2. 一题只问一件事，不绕弯、不玩文字陷阱；不要用“下列何者不是”“以上皆是”“以上皆非”。
3. 只有一个正确答案，必须能直接从这段经文找到；错误选项要像合理的选择，但和经文明显不符，不可以有两个选项都说得通。
4. 选项簡短（12字以内）、长度相近、句型一致，不要把正确答案写得特别长或特别详细。
5. 不考冷僻的数字、人名或要靠猜的细节；由易到难。
6. 解析用一句话（30字以内）：先说答案，再说为什么，口气友善；题目与选项里不要泄漏解析的内容。
共 ${n} 题，每题刚好 ${k} 个选项。v 是答案所在的节号，例如 "3" 或 "3-4"。${PL_STYLE()}请用繁体中文。只回传 JSON，不要任何说明、不要 markdown 围栏：{"q":[{"q":"题目","o":["选项","选项"],"a":正确选项的序号（从0开始）,"e":"一句解析","v":"3"}]}`;
  return `你是聖經教師，替讀經App出測驗題，目標是幫人記住這一章的「重點」。
做法：先在心裡找出這段經文最重要的 ${n} 個重點（核心信息、關鍵人物或事件、神的作為或應許、一條命令或教訓、一個生命應用），每個重點出一題。
每一題都要做到：
1. 清楚明確、一看就懂：用完整的一句話，30字以內；直接寫出人名、地名、事件，不要用「這段經文中的他」「文中那件事」這種要回頭翻才懂的說法。
2. 一題只問一件事，不繞彎、不玩文字陷阱；不要用「下列何者不是」「以上皆是」「以上皆非」。
3. 只有一個正確答案，必須能直接從這段經文找到；錯誤選項要像合理的選擇，但和經文明顯不符，不可以有兩個選項都說得通。
4. 選項簡短（12字以內）、長度相近、句型一致，不要把正確答案寫得特別長或特別詳細。
5. 不考冷僻的數字、人名或要靠猜的細節；由易到難。
6. 解析用一句話（30字以內）：先說答案，再說為什麼，口氣友善；題目與選項裡不要洩漏解析的內容。
共 ${n} 題，每題剛好 ${k} 個選項。v 是答案所在的節號，例如 "3" 或 "3-4"。${PL_STYLE()}請用繁體中文。只回傳 JSON，不要任何說明、不要 markdown 圍欄：{"q":[{"q":"題目","o":["選項","選項"],"a":正確選項的序號（從0開始）,"e":"一句解析","v":"3"}]}`;
}
function plSysRiddle(n){
  if (isEP()) return `You are a Bible teacher designing riddles for a Bible-reading app, to help people remember the key people, places, objects or events of this chapter. From the passage the user gives you, write ${n} riddles.
Every riddle must:
1. Have an answer that is a KEY point of the chapter: a central person, a key place, an important object or the main event; given as the most common short name (1–4 words); no obscure minor characters.
2. Start with "t" (type) — exactly one of "Person", "Place", "Object", "Event" — so the reader knows at once what kind of thing to guess.
3. Give THREE hints, each one simple, clear sentence (under 18 words) stating a concrete fact — no poetic or vague imagery: hint 1 is a true but not-too-obvious feature (it must NOT contain the answer); hint 2 narrows it down; hint 3 gives the most telling feature, almost giving it away without saying the answer.
4. Use only facts that are really in the passage; the three hints must not repeat each other and together must point to one answer only — no second answer may fit.
5. "alt" lists other common ways to say the answer (array, may be empty); "v" is the related verse number, e.g. "3"; "e" is one sentence (under 25 words) shown after it is guessed, saying why this answer matters in the chapter.
${PL_STYLE()} Write in English. Reply with JSON ONLY — no explanation, no markdown fence: {"r":[{"t":"Person","h":["hint 1","hint 2","hint 3"],"a":"answer","alt":["other name"],"v":"3","e":"insight"}]}`;
  if (isZS()) return `你是圣经教师，替读经App设计“猜谜”，帮人记住这一章的重点人物、地点、物件或事件。依使用者提供的经文出 ${n} 个谜题。
每个谜题都要做到：
1. 答案必须是这一章的“重点”：核心人物、关鍵地点、重要物件或主要事件；用最常见的簡短名称（2到6个字）；不要选冷僻的配角。
2. 先给 t（类型），只能是“人物”“地点”“物件”“事件”其中一个，让人一看就知道在猜什么。
3. 三个提示都用簡单明白的一句话（25字以内），讲具体的事实，不要用诗意或模糊的比喻：提示1给一个真实但不太明显的特征（绝不可含有答案）；提示2再缩小范围；提示3说出最关鍵的特征，几乎能让人猜到，但不直接说出答案。
4. 每个提示都必须是这段经文里真有的事，不要超出经文；三个提示不重复；合起来只能指向唯一的答案，不能有第二个也说得通的答案。
5. alt 是答案的其他常见说法（阵列，可为空）；v 是相关的节号，例如 "3"；e 是猜出来之后显示的一句话亮点（30字以内），说明这个答案在这一章的重点。
${PL_STYLE()}请用繁体中文。只回传 JSON，不要任何说明、不要 markdown 围栏：{"r":[{"t":"人物","h":["提示1","提示2","提示3"],"a":"答案","alt":["别名"],"v":"3","e":"亮点"}]}`;
  return `你是聖經教師，替讀經App設計「猜謎」，幫人記住這一章的重點人物、地點、物件或事件。依使用者提供的經文出 ${n} 個謎題。
每個謎題都要做到：
1. 答案必須是這一章的「重點」：核心人物、關鍵地點、重要物件或主要事件；用最常見的簡短名稱（2到6個字）；不要選冷僻的配角。
2. 先給 t（類型），只能是「人物」「地點」「物件」「事件」其中一個，讓人一看就知道在猜什麼。
3. 三個提示都用簡單明白的一句話（25字以內），講具體的事實，不要用詩意或模糊的比喻：提示1給一個真實但不太明顯的特徵（絕不可含有答案）；提示2再縮小範圍；提示3說出最關鍵的特徵，幾乎能讓人猜到，但不直接說出答案。
4. 每個提示都必須是這段經文裡真有的事，不要超出經文；三個提示不重複；合起來只能指向唯一的答案，不能有第二個也說得通的答案。
5. alt 是答案的其他常見說法（陣列，可為空）；v 是相關的節號，例如 "3"；e 是猜出來之後顯示的一句話亮點（30字以內），說明這個答案在這一章的重點。
${PL_STYLE()}請用繁體中文。只回傳 JSON，不要任何說明、不要 markdown 圍欄：{"r":[{"t":"人物","h":["提示1","提示2","提示3"],"a":"答案","alt":["別名"],"v":"3","e":"亮點"}]}`;
}

/* ---- 解析小智回的 JSON；被截斷時盡量救回已經完整的題目 ---- */
function plParse(text){
  let s = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const st = s.indexOf('{'); if (st < 0) return null;
  s = s.slice(st);
  try{ return JSON.parse(s.slice(0, s.lastIndexOf('}') + 1)); }catch(e){}
  const m = s.match(/"(q|r)"\s*:\s*\[/); if (!m) return null;
  let i = m.index + m[0].length; const items = [];
  while (i < s.length){
    while (i < s.length && s[i] !== '{') i++;
    if (i >= s.length) break;
    let depth = 0, inStr = false, esc_ = false, j = i;
    for (; j < s.length; j++){
      const c = s[j];
      if (inStr){ if (esc_) esc_ = false; else if (c === '\\') esc_ = true; else if (c === '"') inStr = false; }
      else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}'){ depth--; if (depth === 0) break; }
    }
    if (depth !== 0) break;
    try{ items.push(JSON.parse(s.slice(i, j + 1))); }catch(e){}
    i = j + 1;
  }
  return items.length ? { [m[1]]: items } : null;
}
const plShuffle = a => { for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function plVerse(v){
  const m = String(v == null ? '' : v).match(/(\d+)(?:\D+(\d+))?/);
  return m ? { v:+m[1], v2: m[2] ? +m[2] : 0 } : { v:0, v2:0 };
}
function plNormQuiz(list, src, k){
  const out = [];
  (list || []).forEach(x => {
    if (!x || typeof x.q !== 'string' || !Array.isArray(x.o)) return;
    let o = x.o.map(z => String(z).trim()).filter(Boolean);
    const ai = /^[A-Da-d]$/.test(String(x.a).trim()) ? 'abcd'.indexOf(String(x.a).trim().toLowerCase()) : (String(x.a).trim() === '' ? NaN : +x.a);
    const right = Number.isInteger(ai) ? o[ai] : null;
    if (!right) return;
    o = o.filter((z, i) => o.indexOf(z) === i);
    if (o.length < 2) return;
    if (o.length > k){ const keep = o.filter(z => z !== right); plShuffle(keep); o = [right].concat(keep.slice(0, k - 1)); }
    plShuffle(o);
    const vv = plVerse(x.v);
    out.push({ q:String(x.q).trim(), o, a:o.indexOf(right), e:String(x.e || '').trim(), b:src.b, ch:src.ch, v:vv.v, v2:vv.v2 });
  });
  return out;
}
/* 提示若不小心把答案洩漏了，前兩個提示裡的答案換成○ */
function plNormRiddle(list, src){
  const out = [];
  (list || []).forEach(x => {
    if (!x || typeof x.a !== 'string' || !x.a.trim() || !Array.isArray(x.h)) return;
    const a = x.a.trim();
    const alt = (Array.isArray(x.alt) ? x.alt : []).map(z => String(z).trim()).filter(Boolean);
    const names = [a].concat(alt).filter(z => z.length >= 2).sort((p, q) => q.length - p.length);
    let h = x.h.map(z => String(z).trim()).filter(Boolean).slice(0, 3);
    if (!h.length) return;
    h = h.map((z, i) => {
      if (i >= h.length - 1 && h.length > 1) return z;
      names.forEach(nm => { z = z.split(nm).join('○'.repeat(Math.min(nm.length, 4))); });
      return z;
    });
    const vv = plVerse(x.v);
    out.push({ h, a, alt, t:String(x.t || '').trim().slice(0, 12), e:String(x.e || '').trim(), b:src.b, ch:src.ch, v:vv.v, v2:vv.v2 });
  });
  return out;
}
const plNorm = s_ => String(s_ || '').toLowerCase().replace(/^the\s+/, '').replace(/[\s，。！？、：；,.!?'"“”‘’「」『』（）()·．\-]/g, '');
function plMatch(guess, it){
  const g = plNorm(guess); if (!g) return false;
  return [it.a].concat(it.alt || []).some(z => {
    const n = plNorm(z); if (!n) return false;
    return g === n || (g.length >= 2 && n.includes(g)) || (n.length >= 2 && g.includes(n));
  });
}
const plRefOf = it => it.v ? cardRef(it) : '';

/* ---- 錯題本 ---- */
const plWid = it => it.b + '-' + it.ch + '|' + it.q.slice(0, 40);
function plAddWrong(it){
  const id = plWid(it);
  user.quizWrong = user.quizWrong.filter(w => w.id !== id);
  user.quizWrong.push({ id, b:it.b, ch:it.ch, v:it.v, v2:it.v2, q:it.q, o:it.o, a:it.a, e:it.e, lang:state.lang, ts:Date.now() });
  if (user.quizWrong.length > 100) user.quizWrong.splice(0, user.quizWrong.length - 100);
}
const plDelWrong = it => { const id = plWid(it); user.quizWrong = user.quizWrong.filter(w => w.id !== id); };

/* ---- 開一局 ---- */
async function plStart(mode, review){
  if (PL && PL.stage === 'loading') return;
  if (review){
    let pool = user.quizWrong.filter(w => w.lang === state.lang);
    if (!pool.length) pool = user.quizWrong.slice();
    if (!pool.length){ toast(L3('錯題本是空的，太棒了！', '错题本是空的，太棒了！', 'No missed questions — great!')); return; }
    const items = plShuffle(pool.slice()).slice(0, PL_QN).map(w => Object.assign({}, w));
    PL = { mode:'quiz', review:true, src:{ b:items[0].b, ch:items[0].ch }, items, i:0, right:0, score:0, picked:null, stage:'q' };
    plPaint(); return;
  }
  const src = plResolveSrc();
  PL = { mode, review:false, src, items:[], i:0, right:0, score:0, picked:null, hints:1, revealed:false, auto:false, judged:false, stage:'loading' };
  plPaint();
  const gen = PL;
  try{
    const chap = await getChapter(src.b, src.ch);
    const text = chapPlain(chap);
    if (!text) throw new Error(L3('找不到這一章', '找不到这一章', 'chapter not found'));
    const b = BOOK[src.b];
    const k = state.audience === 'kid' ? 3 : 4;
    const sys = mode === 'quiz' ? plSysQuiz(PL_QN, k) : plSysRiddle(PL_RN);
    const ask = L3(`經文：${bname(b)} ${src.ch}\n\n`, `经文：${bname(b)} ${src.ch}\n\n`, `Passage: ${bname(b)} ${src.ch}\n\n`) + text;
    const r = await aiRaw(sys, ask, 75000);
    if (PL !== gen) return;                         // 使用者中途離開了
    const data = plParse(r.out);
    const items = mode === 'quiz' ? plNormQuiz(data && data.q, src, k) : plNormRiddle(data && data.r, src);
    if (!items.length) throw new Error(r.why || L3('小智這次沒有出成題目', '小智这次没有出成题目', 'no questions this time'));
    PL.items = items; PL.stage = 'q';
  }catch(e){
    if (PL !== gen) return;
    PL.stage = 'err'; PL.why = (e && e.message) ? String(e.message) : 'error';
  }
  if (PL === gen) plPaint();
}
function plAfterAnswer(ok, it){
  user.play.total++; if (ok) user.play.right++;
  if (PL.mode === 'quiz'){
    if (ok){ if (PL.review) plDelWrong(it); } else plAddWrong(it);
  }
  saveUser();
}
function plFinish(){
  PL.stage = 'end';
  const key = PL.mode, n = PL.items.length, pct = n ? Math.round(PL.right / n * 100) : 0;
  if (!PL.review && (user.play.best[key] || 0) < pct){ PL.newBest = true; user.play.best[key] = pct; saveUser(); }
}

/* ---- 畫面 ---- */
function plAudPicker(v){
  const nm = AUD_NAME();
  const paint = () => {
    $('#plAud', v).innerHTML = AUD_KEYS.map(k => `<button class="${state.audience === k ? 'on' : ''}" data-k="${k}">${AUD_ICON[k]} ${esc(nm[k])}</button>`).join('');
    $('#plAudHint', v).textContent = AUD_HINT()[state.audience];
    $$('#plAud button', v).forEach(b => b.onclick = () => {
      if (state.audience === b.dataset.k) return;
      state.audience = b.dataset.k; saveState(); paint();
      toast(L3('出題對象：', '出题对象：', 'Questions for: ') + AUD_NAME()[state.audience], 1800);
    });
  };
  paint();
}
function plResultMsg(tier){
  const a = state.audience;
  if (a === 'seeker') return SK_RES()[tier];
  { const x2 = A2(); if (x2) return x2.res[tier]; }
  const M = {
    adult:[L3('再讀一遍這章，細細品味，下次會更好。', '再读一遍这章，细细品味，下次会更好。', 'Read the chapter once more, slowly — next time will be better.'),
           L3('不錯！這章的信息已經進到你裡面了。', '不错！这章的信息已经进到你里面了。', 'Well done — this chapter is taking root in you.'),
           L3('太棒了！經文的話已經住在你心裡。', '太棒了！经文的话已经住在你心里。', 'Excellent — the Word is living in you.')],
    teen :[L3('哎呀，這章有點滑溜～再讀一次，下一局你就是王者！', '哎呀，这章有点滑溜～再读一次，下一局你就是王者！', 'Slippery one! Read it again and you\'ll own the next round.'),
           L3('不賴喔！再練幾次就可以去嘲笑你的朋友了（開玩笑的）。', '不赖喔！再练几次就可以去嘲笑你的朋友了（开玩笑的）。', 'Not bad! A few more rounds and you can challenge your friends.'),
           L3('滿分級的操作！聖經達人就是你！', '满分级的操作！圣经达人就是你！', 'Boss-level run! You\'re a Bible pro.')],
    kid  :[L3('沒關係！我們再讀一次故事，再玩一次就會了！🌱', '没关系！我们再读一次故事，再玩一次就会了！🌱', 'That\'s okay! Let\'s read the story again and play once more! 🌱'),
           L3('好棒喔！你記得好多！🌟', '好棒喔！你记得好多！🌟', 'Great job! You remembered so much! 🌟'),
           L3('哇！太厲害了！神一定很高興！🎉', '哇！太厉害了！神一定很高兴！🎉', 'Wow, amazing! God is so happy! 🎉')]
  }[a];
  return M[tier];
}
function plPaint(){
  const body = $('#plBody'); if (!body) return;
  const L = t();
  if (!PL){ plHome(body); return; }
  const mode = PL.mode, n = PL.items.length || (mode === 'quiz' ? PL_QN : PL_RN);
  const b = BOOK[PL.src.b];
  const refTxt = b ? `${bname(b)} ${chapLabel(PL.src.b, PL.src.ch)}` : '';
  if (PL.stage === 'loading'){
    body.innerHTML = `<div class="pl-load"><div class="spin"></div>${esc(L3('小智正在讀「', '小智正在读“', 'Xiaozhi is reading '))}${esc(refTxt)}${esc(L3('」，幫你出題…', '”，帮你出题…', ' and writing your questions…'))}</div>`;
    return;
  }
  if (PL.stage === 'err'){
    body.innerHTML = `<div class="card"><h3>${esc(L3('出題沒成功', '出题没成功', 'Could not make questions'))}</h3>
      <div class="muted">${esc(PL.why || '')}</div>
      <div class="pl-row"><button class="btn primary" id="plRetry">${esc(L3('再試一次', '再试一次', 'Try again'))}</button>
      <button class="btn" id="plHomeBtn">${esc(L3('回首頁', '回首页', 'Back'))}</button></div></div>`;
    $('#plRetry', body).onclick = () => { const m = PL.mode; PL = null; plStart(m); };
    $('#plHomeBtn', body).onclick = () => { PL = null; plPaint(); };
    return;
  }
  if (PL.stage === 'end'){
    const pct = Math.round(PL.right / n * 100), tier = pct >= 90 ? 2 : (pct >= 60 ? 1 : 0);
    const wrongLeft = user.quizWrong.length;
    body.innerHTML = `<div class="card"><div class="pl-score">
        <div class="pl-stars">${'⭐'.repeat(tier + 1)}</div>
        <div class="n">${PL.right} / ${n}</div>
        <div class="muted">${esc(refTxt)}${PL.mode === 'riddle' ? esc(L3(`　得分 ${PL.score} / ${n * 3}`, `　得分 ${PL.score} / ${n * 3}`, `  Points ${PL.score} / ${n * 3}`)) : ''}</div>
        ${PL.newBest ? `<div class="pill" style="margin-top:8px">🏆 ${esc(L3('新紀錄！', '新纪录！', 'New best!'))}</div>` : ''}
      </div>
      <div style="text-align:center;margin:10px 0 4px;line-height:1.8">${esc(plResultMsg(tier))}</div>
      <div class="pl-row">
        <button class="btn primary" id="plAgain">${esc(PL.review ? L3('再複習一輪', '再复习一轮', 'Review more') : L3('再來一局（新題目）', '再来一局（新题目）', 'Play again (new questions)'))}</button>
        <button class="btn" id="plRead">📖 ${esc(L3('回到經文', '回到经文', 'Back to the text'))}</button>
        <button class="btn" id="plShare">↗ ${esc(L3('分享成績', '分享成绩', 'Share score'))}</button>
        ${wrongLeft && !PL.review ? `<button class="btn gold" id="plRev">🔁 ${esc(L3(`複習錯題（${wrongLeft}）`, `复习错题（${wrongLeft}）`, `Review missed (${wrongLeft})`))}</button>` : ''}
        <button class="btn" id="plHomeBtn">🏠 ${esc(L3('回首頁', '回首页', 'Home'))}</button>
      </div></div>`;
    $('#plAgain', body).onclick = () => { const m = PL.mode, rv = PL.review; PL = null; plStart(m, rv); };
    $('#plRead', body).onclick = () => go(`#/read/${PL.src.b}/${PL.src.ch}`);
    $('#plShare', body).onclick = plShare;
    const rv = $('#plRev', body); if (rv) rv.onclick = () => { PL = null; plStart('quiz', true); };
    $('#plHomeBtn', body).onclick = () => { PL = null; plPaint(); };
    return;
  }
  const it = PL.items[PL.i];
  const head = `<div class="pl-meta"><span>${mode === 'quiz' ? '📝 ' + esc(L3('讀經測驗', '读经测验', 'Quiz')) : '🧩 ' + esc(L3('聖經猜謎', '圣经猜谜', 'Riddles'))}${PL.review ? ' · ' + esc(L3('錯題複習', '错题复习', 'Review')) : ''}</span><span>${PL.i + 1} / ${n}</span></div>
    <div class="pl-bar"><i style="width:${Math.round((PL.i + (PL.picked !== null || PL.revealed ? 1 : 0)) / n * 100)}%"></i></div>`;
  if (mode === 'quiz'){
    const done = PL.picked !== null;
    body.innerHTML = head + `<div class="pl-q">${esc(it.q)}</div>`
      + it.o.map((o, i) => {
          const cls = done ? (i === it.a ? 'ok' : (i === PL.picked ? 'bad' : '')) : '';
          const mark = done ? (i === it.a ? '✓ ' : (i === PL.picked ? '✗ ' : '')) : '';
          return `<button class="pl-opt ${cls}" data-i="${i}" ${done ? 'disabled' : ''}>${mark}${esc(o)}</button>`;
        }).join('')
      + (done ? `<div class="pl-expl"><b>${PL.picked === it.a ? esc(L3('答對了！', '答对了！', 'Correct!')) : esc(L3('正確答案是「', '正确答案是“', 'The answer is “')) + esc(it.o[it.a]) + esc(L3('」', '”', '”'))}</b>
          ${it.e ? '<br>' + esc(it.e) : ''}${plRefOf(it) ? `<br><span class="muted">📖 ${esc(plRefOf(it))}</span>` : ''}</div>
          <button class="btn primary block" id="plNext">${esc(PL.i + 1 >= n ? L3('看成績', '看成绩', 'See my score') : L3('下一題', '下一题', 'Next'))}</button>` : '')
      + `<div class="muted" style="font-size:11.5px;margin-top:14px">${esc(L3('題目由小智根據經文出題，若有疑問請以聖經為準。', '题目由小智根据经文出题，若有疑问请以圣经为准。', 'Questions are written by Xiaozhi from the text — when in doubt, trust the Bible.'))}</div>`;
    $$('.pl-opt', body).forEach(bt => bt.onclick = () => {
      if (PL.picked !== null) return;
      const i = +bt.dataset.i; PL.picked = i;
      const ok = i === it.a; if (ok){ PL.right++; PL.score++; }
      plAfterAnswer(ok, it); plPaint();
    });
    const nx = $('#plNext', body);
    if (nx) nx.onclick = () => { PL.picked = null; PL.i++; if (PL.i >= n) plFinish(); plPaint(); scrollToTop(); };
    return;
  }
  /* 猜謎 */
  const shown = PL.hints, canMore = shown < it.h.length;
  const pts = Math.max(1, 4 - shown);
  let html = head + `<div class="muted" style="margin-bottom:8px">${it.t ? esc(L3('這一題的答案是一個「' + it.t + '」', '这一题的答案是一个“' + it.t + '”', 'The answer is a ' + it.t.toLowerCase())) : esc(L3('猜猜看，答案是這一章裡的什麼？', '猜猜看，答案是这一章里的什么？', 'Guess: what is it, from this chapter?'))}</div>`
    + it.h.slice(0, shown).map((h, i) => `<div class="pl-hint"><b>💡${i + 1}</b><span>${esc(h)}</span></div>`).join('');
  if (!PL.revealed){
    html += `<div class="pl-guess"><input class="cardinput" id="plIn" placeholder="${esc(L3('輸入你的答案…', '输入你的答案…', 'Type your answer…'))}" autocomplete="off"><button class="btn primary" id="plGo">${esc(L3('猜', '猜', 'Guess'))}</button></div>
      <div class="pl-row">${canMore ? `<button class="btn" id="plMore">💡 ${esc(L3('再給一個提示', '再给一个提示', 'Another hint'))}</button>` : ''}
      <button class="btn" id="plShow">👀 ${esc(L3('揭曉答案', '揭晓答案', 'Show answer'))}</button></div>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L3(`現在答對可得 ${pts} 分（提示越少分越高）`, `现在答对可得 ${pts} 分（提示越少分越高）`, `Worth ${pts} point${pts > 1 ? 's' : ''} now — fewer hints, more points`))}</div>`;
  } else {
    html += `<div class="pl-ans">${esc(it.a)}</div>
      <div class="pl-expl">${it.e ? esc(it.e) : ''}${plRefOf(it) ? `${it.e ? '<br>' : ''}<span class="muted">📖 ${esc(plRefOf(it))}</span>` : ''}</div>`;
    if (!PL.auto && !PL.judged){
      html += `<div class="muted" style="text-align:center;margin-bottom:6px">${esc(L3('你心裡猜到了嗎？', '你心里猜到了吗？', 'Did you have it in mind?'))}</div>
        <div class="pl-row"><button class="btn primary" id="plYes">🙋 ${esc(L3(`猜到了（+${pts}）`, `猜到了（+${pts}）`, `Yes (+${pts})`))}</button>
        <button class="btn" id="plNo">😅 ${esc(L3('差一點', '差一点', 'Not quite'))}</button></div>`;
    } else {
      html += `<button class="btn primary block" id="plNext">${esc(PL.i + 1 >= n ? L3('看成績', '看成绩', 'See my score') : L3('下一題', '下一题', 'Next'))}</button>`;
    }
  }
  body.innerHTML = html;
  const inp = $('#plIn', body);
  const award = (auto) => { PL.auto = auto; PL.judged = true; PL.right++; PL.score += Math.max(1, 4 - PL.hints); PL.revealed = true; plAfterAnswer(true, it); };
  if (inp){
    const guess = () => {
      const g = inp.value.trim(); if (!g) return;
      if (plMatch(g, it)){ award(true); plPaint(); return; }
      inp.classList.remove('pl-shake'); void inp.offsetWidth; inp.classList.add('pl-shake');
      if (canMore){ PL.hints++; toast(L3('不是喔，再給你一個提示～', '不是喔，再给你一个提示～', 'Not quite — here\'s another hint')); plPaint(); }
      else toast(L3('不是喔，再想想！', '不是喔，再想想！', 'Not quite — think again!'));
    };
    $('#plGo', body).onclick = guess;
    inp.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); guess(); } };
  }
  const mo = $('#plMore', body); if (mo) mo.onclick = () => { PL.hints++; plPaint(); };
  const sh = $('#plShow', body); if (sh) sh.onclick = () => { PL.revealed = true; plPaint(); };
  const yes = $('#plYes', body); if (yes) yes.onclick = () => { award(false); plPaint(); };
  const no = $('#plNo', body); if (no) no.onclick = () => { PL.judged = true; plAfterAnswer(false, it); plPaint(); };
  const nx = $('#plNext', body);
  if (nx) nx.onclick = () => { PL.i++; PL.hints = 1; PL.revealed = false; PL.auto = false; PL.judged = false; if (PL.i >= n) plFinish(); plPaint(); scrollToTop(); };
}
async function plShare(){
  const b = BOOK[PL.src.b], n = PL.items.length;
  const home = location.origin + location.pathname.replace(/index\.html$/, '');
  const text = (PL.mode === 'quiz' ? '📝 ' : '🧩 ')
    + L3(`我在讀經樂${PL.mode === 'quiz' ? '測驗' : '猜謎'}「${bname(b)} ${chapLabel(PL.src.b, PL.src.ch)}」答對了 ${PL.right} / ${n}！`,
         `我在读经乐${PL.mode === 'quiz' ? '测验' : '猜谜'}“${bname(b)} ${chapLabel(PL.src.b, PL.src.ch)}”答对了 ${PL.right} / ${n}！`,
         `I got ${PL.right} / ${n} on the ${PL.mode === 'quiz' ? 'quiz' : 'riddles'} for ${bname(b)} ${chapLabel(PL.src.b, PL.src.ch)}!`)
    + '\n\n—— ' + (state.cardTop || L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Online Fellowship')) + '\n' + home;
  if (navigator.share){
    try{ await navigator.share({ title: t().app, text }); return; }
    catch(e){ if (e && e.name === 'AbortError') return; }
  }
  try{ await navigator.clipboard.writeText(text); toast(L3('已複製，可以貼到群組裡', '已复制，可以贴到群组里', 'Copied — paste it anywhere'), 3000); }
  catch(e){ toast(L3('這台裝置不支援分享', '这台设备不支持分享', 'Sharing is not available here'), 3000); }
}
function plHome(body){
  const L = t();
  const cur = plCurSrc(), cb = BOOK[cur.b];
  const wrong = user.quizWrong.length, P = user.play;
  const rate = P.total ? Math.round(P.right / P.total * 100) : 0;
  body.innerHTML = `
    <div class="card">
      <div class="row" style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="muted" style="font-size:12.5px;white-space:nowrap">${esc(L3('出題對象', '出题对象', 'For'))}</span>
        <div class="segbtns" id="plAud" style="justify-content:flex-start"></div></div>
      <div class="muted" id="plAudHint" style="font-size:11.5px;margin-bottom:10px"></div>
      <div class="muted" style="font-size:12.5px;margin-bottom:6px">${esc(L3('從哪裡出題', '从哪里出题', 'Questions from'))}</div>
      <div class="cardchips" id="plSrc">
        <button class="${plSrc === 'cur' ? 'on' : ''}" data-s="cur">📖 ${esc(cur.k)}：${esc(bname(cb))} ${esc(chapLabel(cur.b, cur.ch))}</button>
        <button class="${plSrc === 'rand' ? 'on' : ''}" data-s="rand">🎲 ${esc(L3('讀過的章（隨機）', '读过的章（随机）', 'A random chapter I read'))}</button>
      </div>
    </div>
    <button class="pl-big" id="plRiddle"><span class="ic">🧩</span><span><div class="t">${esc(L3('聖經猜謎', '圣经猜谜', 'Bible Riddles'))}</div>
      <div class="s">${esc(L3(`${PL_RN} 個謎題，提示一個一個出現，越早猜到分越高`, `${PL_RN} 个谜题，提示一个一个出现，越早猜到分越高`, `${PL_RN} riddles — hints appear one by one; guess early for more points`))}</div></span></button>
    <button class="pl-big" id="plQuiz"><span class="ic">📝</span><span><div class="t">${esc(L3('讀經測驗', '读经测验', 'Bible Quiz'))}</div>
      <div class="s">${esc(L3(`${PL_QN} 題選擇題，答完立刻看解析；答錯的會進錯題本`, `${PL_QN} 题选择题，答完立刻看解析；答错的会进错题本`, `${PL_QN} multiple-choice questions with instant explanations; misses go to your notebook`))}</div></span></button>
    <div class="card">
      <div class="statgrid">
        <div><div class="sv">${P.total}</div><div class="sk">${esc(L3('累計答題', '累计答题', 'Answered'))}</div></div>
        <div><div class="sv">${P.total ? rate + '%' : '—'}</div><div class="sk">${esc(L3('答對率', '答对率', 'Correct'))}</div></div>
        <div><div class="sv">${wrong}</div><div class="sk">${esc(L3('錯題本', '错题本', 'Missed'))}</div></div>
      </div>
      ${wrong ? `<div class="pl-row" style="margin-top:12px"><button class="btn gold" id="plRev">🔁 ${esc(L3('複習錯題（不用連線）', '复习错题（不用联网）', 'Review missed (works offline)'))}</button>
        <button class="btn" id="plClr">${esc(L3('清空錯題本', '清空错题本', 'Clear notebook'))}</button></div>` : ''}
    </div>
    <div class="muted" style="font-size:11.5px;line-height:1.7">${esc(L3('題目由小智「照著這一章的經文」現場出，所以每次都不一樣，需要連線。', '题目由小智“照着这一章的经文”现场出，所以每次都不一样，需要联网。', 'Questions are written live by Xiaozhi from the chapter, so each round is different. Needs a connection.'))}</div>`;
  plAudPicker(body);
  $$('#plSrc button', body).forEach(bt => bt.onclick = () => { plSrc = bt.dataset.s; plPaint(); });
  $('#plRiddle', body).onclick = () => plStart('riddle');
  $('#plQuiz', body).onclick = () => plStart('quiz');
  const rv = $('#plRev', body); if (rv) rv.onclick = () => plStart('quiz', true);
  const cl = $('#plClr', body); if (cl) cl.onclick = () => {
    if (!confirm(L3('清空錯題本？', '清空错题本？', 'Clear the notebook?'))) return;
    user.quizWrong = []; saveUser(); plPaint();
  };
}
async function viewPlay(v){
  plCss();
  v.innerHTML = `<div class="xz-head"><button class="xz-back navlbl" id="plBack">‹ ${esc(L3('上一頁', '上一页', 'Back'))}</button><span>🎯 ${esc(L3('讀經樂', '读经乐', 'Bible Fun'))}</span></div><div id="plBody"></div>`;
  $('#plBack', v).onclick = () => {
    if (PL){ PL = null; plPaint(); return; }
    appBack();
  };
  plPaint();
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

    <div class="card" style="padding:4px 16px">
      <a class="rowlink" href="#/play"><div class="meta"><div class="t">🎯 ${esc(L3('讀經樂：猜謎與測驗', '读经乐：猜谜与测验', 'Bible Fun: Riddles & Quiz'))}</div>
        <div class="s">${esc(user.quizWrong.length ? L3(`錯題本 ${user.quizWrong.length} 題，可以複習`, `错题本 ${user.quizWrong.length} 题，可以复习`, `${user.quizWrong.length} missed questions to review`) : L3('玩一玩，加深對經文的記憶', '玩一玩，加深对经文的记忆', 'Play to remember what you read'))}</div></div><div class="chev">›</div></a>
      <div class="rowlink" id="crRow" onclick="crMenu()"><div class="meta"><div class="t">📡 ${esc(CRT('crTitle'))}</div>
        <div class="s">${esc(CRT('crTile_d'))}</div></div><div class="chev">›</div></div>
      <a class="rowlink" href="#/plan"><div class="meta"><div class="t">${esc(L.plan)}</div>
        <div class="s">${user.plan.active ? esc(L.progress) : esc(L.planEmpty)}</div></div><div class="chev">›</div></a>
    </div>

    <div class="section-title">${esc(L.diag)}</div>
    <div class="card">
      <button class="btn block" id="diagBtn">${esc(L.diagRun)}</button>
      <div id="diagOut" class="muted" style="margin-top:10px;white-space:pre-wrap;font-size:12px;line-height:1.7"></div>
    </div>
    <div class="section-title">${esc(L.settings)}</div>
    <div class="card" style="padding:4px 16px">
      <div class="setrow"><div class="sl">${esc(L.langLabel)}</div><div class="segbtns" id="setLang">
        <button class="${state.lang === 'zh' ? 'on' : ''}" data-l="zh">繁體中文</button>
        <button class="${state.lang === 'zs' ? 'on' : ''}" data-l="zs">简体中文</button>
        <button class="${state.lang === 'en' ? 'on' : ''}" data-l="en">English</button>
        <button class="${state.lang === 'ko' ? 'on' : ''}" data-l="ko">한국어</button>
        <button class="${state.lang === 'ja' ? 'on' : ''}" data-l="ja">日本語</button>
        <button class="${state.lang === 'id' ? 'on' : ''}" data-l="id">Bahasa Indonesia</button>
        </div></div>
      <div class="setrow"><div class="sl">${esc(L3('小智回答對象', '小智回答对象', 'Xiaozhi answers for'))}
        <div class="muted" style="font-size:11.5px;line-height:1.6">${esc(AUD_HINT()[state.audience])}</div></div>
        <div class="segbtns" id="setAud">
        ${AUD_KEYS.map(k => `<button class="${state.audience === k ? 'on' : ''}" data-k="${k}">${AUD_ICON[k]} ${esc(AUD_NAME()[k])}</button>`).join('')}
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
      <div class="setrow"><div class="sl">${esc(L.shCh)}
        <div class="muted" style="font-size:11.5px;line-height:1.6">${esc(L.shChHint[state.shCh ? 0 : 1])}</div></div>
        <div class="segbtns" id="setShCh">
        ${L.onoff.map((m, i) => `<button class="${(state.shCh ? 0 : 1) === i ? 'on' : ''}" data-i="${i}">${esc(m)}</button>`).join('')}
        </div></div>
      <div class="setrow"><div class="sl">${esc(L.shV)}
        <div class="muted" style="font-size:11.5px;line-height:1.6">${esc(L.shVHint[state.shV ? 0 : 1])}</div></div>
        <div class="segbtns" id="setShV">
        ${L.onoff.map((m, i) => `<button class="${(state.shV ? 0 : 1) === i ? 'on' : ''}" data-i="${i}">${esc(m)}</button>`).join('')}
        </div></div>
      <div class="setrow"><div class="sl">${esc(L.note)}〔…〕</div><div class="segbtns" id="setNote">
        <button class="${!state.hidenote ? 'on' : ''}" data-i="0">${esc(L.onoff[0])}</button>
        <button class="${state.hidenote ? 'on' : ''}" data-i="1">${esc(L.onoff[1])}</button></div></div>
      <div class="setrow"><div class="sl">${esc(L.voice)}</div><div class="segbtns" id="setVoice">
        ${VOICES[state.lang].map((v2, i) => `<button class="${state.voice[state.lang] === i ? 'on' : ''}" data-i="${i}">${esc(v2.n)}</button>`).join('')}</div></div>
      <div class="setrow"><div class="sl">${esc(L.ttsAutoNext)}
        <div class="muted" style="font-size:11.5px;line-height:1.6">${esc(L.ttsAutoNextHint[state.ttsAutoNext ? 0 : 1])}</div></div>
        <div class="segbtns" id="setAutoNext">
        ${L.onoff.map((m, i) => `<button class="${(state.ttsAutoNext ? 0 : 1) === i ? 'on' : ''}" data-i="${i}">${esc(m)}</button>`).join('')}
        </div></div>
      <div class="setrow"><div class="sl">${esc(L.upd)}<div class="muted" style="font-size:11.5px;line-height:1.6" id="updOut"></div></div>
        <div class="segbtns"><button id="updBtn">${esc(L.updCheck)}</button><button id="updHardBtn">${esc(L3('強制更新', '强制更新', 'Force update'))}</button></div></div>
    </div>

    <details class="grp">
      <summary><span style="color:var(--gold)">◆</span>${esc(L.myBm)}<span class="cnt">${user.marks.length}</span></summary>
      <div class="card" style="padding:4px 16px;border:none;border-radius:0;margin-bottom:0">${user.marks.length
        ? user.marks.slice().sort((a, b2) => b2.ts - a.ts).map((m, i) => `
        <div class="hitem">
          <div class="q">${markNotes(esc(m.t || ''))}…</div>
          <div class="m"><span>${esc(BOOK[m.b] ? bname(BOOK[m.b]) : m.b)} ${esc(chapLabel(m.b, m.c))}</span>
            <span><button data-bmgo="${i}">↗</button><button data-bmdel="${i}">✕</button></span></div>
        </div>`).join('')
        : `<div class="empty">${esc(L.emptyBm)}</div>`}</div>
    </details>

    <details class="grp">
      <summary><span style="color:var(--gold)">◆</span>${esc(L.myHl)}<span class="cnt">${hls.length}</span></summary>
      <div class="card" style="padding:4px 16px;border:none;border-radius:0;margin-bottom:0">${hls.length ? hls.map(([k, h]) => `
        <div class="hitem">
          <div class="q">${markNotes(esc(h.t))}</div>
          ${h.n ? `<div class="n">${esc(h.n)}</div>` : ''}
          <div class="m"><span>${esc(cardRef(h))}</span>
            <span><button data-card="${esc(k)}">🖼</button><button data-go="${h.b}|${h.ch}">↗</button><button data-del="${esc(k)}">✕</button></span></div>
        </div>`).join('') : `<div class="empty">${esc(L.emptyHl)}</div>`}</div>
    </details>

    <details class="grp">
      <summary><span style="color:var(--gold)">◆</span>${esc(L.myFav)}<span class="cnt">${user.fav.length}</span></summary>
      <div class="card" style="padding:4px 16px;border:none;border-radius:0;margin-bottom:0">${user.fav.length ? user.fav.slice().reverse().map((f, i) => `
        <div class="hitem"><div class="q" style="font-family:inherit;font-size:13.5px">${mdToHtml(f.text)}</div>
          <div class="m"><span>${f.b && BOOK[f.b] ? esc(bname(BOOK[f.b])) + ' ' + esc(chapLabel(f.b, f.ch)) : ''}</span>
          <button data-favdel="${user.fav.length - 1 - i}">✕</button></div></div>`).join('')
        : `<div class="empty">${esc(L.emptyFav)}</div>`}</div>
    </details>

    <div class="muted" style="text-align:center;margin:18px 0 8px">
      ${esc(L.app)} ${VERSION}<br>${esc(L3('和合本聖經屬公有領域，沒有版權限制','和合本圣经属公有领域，没有版权限制','The Chinese Union Version and the World English Bible are in the public domain.'))}</div>`;

  $$('#setLang button', v).forEach(b => b.onclick = () => switchLang(b.dataset.l));
  const dg = $('#diagBtn', v); if (dg) dg.onclick = () => runDiag();
  const uo = $('#updOut', v); if (uo) uo.textContent = VERSION;
  const uh = $('#updHardBtn', v); if (uh) uh.onclick = () => applyUpdate(true);
  const ub = $('#updBtn', v);
  if (ub){
    const setReady = () => { ub.textContent = L.updReadyBar; ub.classList.add('on'); ub.onclick = applyUpdate; };
    if (updReady) setReady();
    else ub.onclick = async () => { await checkForUpdate(true); if (updReady) setReady(); };
  }
  $$('#setAud button', v).forEach(b => b.onclick = () => { state.audience = b.dataset.k; saveState(); render(); });
  $$('#setFont button', v).forEach(b => b.onclick = () => { state.font = +b.dataset.i; saveState(); applyChrome(); render(); });
  $$('#setTheme button', v).forEach(b => b.onclick = () => { state.theme = +b.dataset.i; saveState(); applyChrome(); render(); });
  $$('#setMode button', v).forEach(b => b.onclick = () => { state.flow = b.dataset.i === '1'; saveState(); applyChrome(); render(); });
  $$('#setShCh button', v).forEach(b => b.onclick = () => { state.shCh = b.dataset.i === '0'; saveState(); applyChrome(); render(); });
  $$('#setShV  button', v).forEach(b => b.onclick = () => { state.shV  = b.dataset.i === '0'; saveState(); applyChrome(); render(); });
  $$('#setNote button', v).forEach(b => b.onclick = () => { state.hidenote = b.dataset.i === '1'; saveState(); applyChrome(); render(); });
  $$('#setVoice button', v).forEach(b => b.onclick = () => { state.voice[state.lang] = +b.dataset.i; saveState(); render(); });
  $$('#setAutoNext button', v).forEach(b => b.onclick = () => { state.ttsAutoNext = b.dataset.i === '0'; saveState(); render(); });
  const sortedMarks = user.marks.slice().sort((a, b2) => b2.ts - a.ts);
  $$('[data-bmgo]', v).forEach(b => b.onclick = () => openAt(sortedMarks[+b.dataset.bmgo]));
  $$('[data-bmdel]', v).forEach(b => b.onclick = () => {
    const m = sortedMarks[+b.dataset.bmdel];
    const i = user.marks.findIndex(x => x.b === m.b && x.c === m.c && x.p === m.p && x.s === m.s);
    if (i >= 0) user.marks.splice(i, 1);
    saveUser(); render();
  });
  $$('[data-del]', v).forEach(b => b.onclick = () => { delete user.hl[b.dataset.del]; saveUser(); render(); });
  $$('[data-card]', v).forEach(b => b.onclick = () => { const h = user.hl[b.dataset.card]; if (h) openStudio(h); });
  $$('[data-go]', v).forEach(b => b.onclick = () => { const [x, y] = b.dataset.go.split('|'); go(`#/read/${x}/${y}`); });
  $$('[data-favdel]', v).forEach(b => b.onclick = () => { user.fav.splice(+b.dataset.favdel, 1); saveUser(); render(); });
}

/* ================================================================ 連線測試
   小智／朗讀連不上時，這裡可以看到伺服器實際回了什麼（狀態碼＋回應內容），
   才分得出是「伺服器拒絕」還是「App 送錯東西」。 */
async function probe(url, body){
  const t0 = Date.now();
  try{
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 20000);
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body), signal: ac.signal }).finally(() => clearTimeout(tm));
    const ct = r.headers.get('content-type') || '?';
    let snip = '';
    try{
      if (/json|text/i.test(ct)) snip = (await r.text()).replace(/\s+/g, ' ').slice(0, 180);
      else snip = '(' + (await r.blob()).size + ' bytes)';
    }catch(e){ snip = '(讀不到內容)'; }
    return `HTTP ${r.status} · ${ct} · ${Date.now() - t0}ms\n${snip}`;
  }catch(e){
    return `連不到／逾時（${(e && e.message) || 'network'}）· ${Date.now() - t0}ms`;
  }
}
async function runDiag(){
  const out = $('#diagOut'); const btn = $('#diagBtn');
  if (!out) return;
  if (btn){ btn.disabled = true; btn.textContent = t().diagBusy; }
  out.textContent = t().diagBusy;
  const lines = [];

  lines.push('① 小智（最簡單的一句）');
  lines.push(await probe(API.chat, { system:'你是小智。', messages:[{ role:'user', content:'你好' }] }));

  lines.push('');
  lines.push('② 小智（App 真正送的內容）');
  lines.push(await probe(API.chat, {
    system: (state.lang === 'zs'
      ? '你是「小智」，国度321空中团契的圣经陪读。'
      : '你是「小智」，國度321空中團契的聖經陪讀。'),
    messages:[{ role:'user', content:'請用一句話說明創世記第一章。' }]
  }));

  lines.push('');
  lines.push('③ 朗讀');
  lines.push(await probe(API.tts, { voice: VOICES[state.lang][state.voice[state.lang]].v,
    rate: TTS_RATE, sil: TTS_SIL, silc: TTS_SILC, sile: TTS_SILE, text:'神愛世人。' }));

  lines.push('');
  lines.push('來源：' + location.origin);
  out.textContent = lines.join('\n');
  if (btn){ btn.disabled = false; btn.textContent = t().diagRun; }
}

/* ================================================================ 朗讀 */
const TTS_CHUNK_ZH = 130, TTS_CHUNK_EN = 320, TTS_LOOKAHEAD = 2, TTS_RETRY = [800, 1600];
const TTS_CHUNK = () => isKO() ? 200 : (isEN() ? TTS_CHUNK_EN : TTS_CHUNK_ZH);
const RA_COOLDOWN = 4000;
let spk = { on:false, paused:false, items:[], idx:0, audio:null, cache:{}, native:false, abort:false, gen:0 };
/* 每次「重新開始」一輪朗讀（▶ 開始、或畫線面板「從這裡開始朗讀」先 stop 再 start）就加一。
   舊一輪還在等網路回來的 fetch，回來時只認這個號碼——號碼對不上就直接放手，
   不然舊的那一輪回來會把畫面／音檔搶回它原本要唸的位置，看起來就像「跳的位置沒有作用」。 */
let ttsGen = 0;
let raManualAt = 0;
/* 手動按停時，記下停在哪一句（書卷／章／段／句），下次再按開始從這裡接下去唸，
   不必從頭或從目前捲動位置重來。換了書卷／章節，或整段唸完，就不算數了。 */
let ttsResume = null;
/* 使用者在畫線面板點「從這裡開始朗讀」指定的位置——只用這一次，用過就清掉，
   優先順序比 ttsResume 高（指定位置 > 上次停下的位置 > 目前捲動位置）。 */
let ttsStartAt = null;
/* 一章唸完、設定裡開了「讀完自動接下一章」時，ttsStop(true) 會先翻頁（go），
   翻頁是非同步的（要抓下一章資料），等 render() 把新的一章畫出來之後，
   才看得到這個旗標，決定要不要自動按下 ▶。用完就要清掉，不然一般换頁也會被誤觸發。 */
let ttsAutoNextPending = false;

/* 朗讀發音修正（僅影響語音，不影響畫面文字） */
const TTS_FIX_MORE = [
  [/(與主|與神|與祂|與他|與你|與我|一起|彼此|同心)同行/g, '$1同形'], [/(与主|与神|与祂|与他|与你|与我|一起|彼此|同心)同行/g, '$1同形'],
  [/重生/g, '蟲生'], [/重擔/g, '眾擔'], [/重担/g, '众担'],
  [/差遣/g, '拆遣'], [/差派/g, '拆派'], [/差役/g, '拆役'], [/([主神祂他])差([人我你])/g, '$1拆$2'],
  [/背起/g, '揹起'], [/背負/g, '揹負'], [/背负/g, '揹负'], [/背著/g, '揹著'], [/背着/g, '揹着'],
  [/得著/g, '得着'],
  [/數算/g, '鼠算'], [/數到/g, '鼠到'], [/數一數/g, '鼠一鼠'], [/数算/g, '鼠算'], [/数到/g, '鼠到'], [/数一数/g, '鼠一鼠'],
  [/朝拜/g, '潮拜'], [/朝见/g, '潮见'],
  [/(長者|長輩|長進|長出|長執|成長|生長|年長|師長|兄長)/g, m => m.replace('長', '掌')],
  [/(长者|长辈|长进|长出|长执|成长|生长|年长|师长|兄长|长老|长子|家长|长大)/g, m => m.replace('长', '掌')],
  [/([組團校部首夫牧區會社])長/g, '$1掌'], [/([组团校部首夫牧区会社])长/g, '$1掌'],
  [/行傳/g, '行賺'], [/傳記/g, '賺記'], [/行传/g, '行赚'], [/传记/g, '赚记'],
  [/好施/g, '耗施'], [/年少/g, '年紹'],
  [/行为/g, '行围'], [/为大/g, '围大'], [/教会/g, '叫会'], [/传道/g, '船道'],
  [/应当/g, '英当'], [/应许/g, '英许'], [/相应/g, '相映'], [/种子/g, '肿子'], [/中间/g, '衷间'], [/分开/g, '芬开']
];
const TTS_FIX = [
  [/長老/g, '掌老'], [/長子/g, '掌子'], [/家長/g, '家掌'], [/長大/g, '掌大'],
  [/行為/g, '行圍'], [/為大/g, '圍大'], [/中了/g, '衷了'],
  [/教會/g, '叫會'], [/傳道/g, '船道'], [/朝見/g, '潮見'],
  [/應當/g, '英當'], [/應許/g, '英許'], [/相應/g, '相映'],
  [/看守/g, '刊守'], [/種子/g, '腫子'], [/中間/g, '衷間'],
  [/分開/g, '芬開'],           // 分：這裡要唸 fēn（分開），不是 fèn
  /* 使用者回報：創世記8章「乾了」「鴿子」都唸錯。逐字掃過全本聖經（繁體5個檔案）核對：
     「乾」全本共221次，全部都是「乾燥／枯乾／乾淨／乾渴…」這種唸 gān 的用法，沒有一次
     是「乾坤」那種唸 qián 的用法（零例外，不用另外分情況）——這個字不常用，TTS容易照
     「乾坤」的音誤讀成 qián，用常見同音字「甘」強制唸對。
     「鴿」全本共45次，全部都是「鴿子／雛鴿」這種鳥，唸 gē；這個字的聲符是「合」(hé)，
     TTS容易照聲符誤讀成 hé，用常見同音字「哥」強制唸對。
     （這兩個字繁簡分屬不同碼位：簡體版對應的是「干」「鸽」，「干」本身就是常用字沒有
     誤讀風險不用修；「鸽」使用者沒有回報過，先不動，之後真的回報再比照這裡加。） */
  [/乾/g, '甘'], [/鴿/g, '哥']
].concat(TTS_FIX_MORE);
/* 「地」這個字有兩種讀音：當名詞（大地／土地／地方…）要唸 dì；
   接在疊字形容詞或副詞後面、修飾後面動詞的「地」結構助詞（大大地、漸漸地、不住地…）要唸輕聲 de。
   使用者回報好幾處 dì 被唸成了 de（「地發生」「地必為…受咒詛」「從地裡得吃的」…），
   逐字加進 TTS_FIX 補不完──實際統計全本聖經「地」字出現 4683 次，其中唸 de 的疊字/副詞
   用法只佔約一成（541次），dì（名詞）佔約九成，所以整段邏輯反過來做：預設全部強制唸 dì，
   只有匹配到「疊字＋地」（大大地、遠遠地…，中文形容詞疊字是固定用法，結構上不會跟地名/名詞混淆）
   或下面這個副詞清單（掃過全本聖經逐一核對過例句）的才保留原本的「地」讓 TTS 唸 de。
   TTS_DE_OVERRIDE 是掃出來的兩個例外──「加利利地」（地名 Galilee）、「迦南南地」（南地＝
   尼革夫地區的地名）剛好疊字規則會誤判成「利利地」「南南地」的疊字副詞，要先排除。
   以後如果又抓到 dì／de 讀錯，優先考慮：是不是新的疊字或副詞用法要加進 TTS_DE_KEEP，
   還是新的地名剛好疊字巧合要加進 TTS_DE_OVERRIDE，不要回頭去改這個開關的方向。 */
const TTS_DE_OVERRIDE = [/加利利地/g, /迦南南地/g];
const TTS_DE_KEEP = ['不住','合意','一味','何等','再三','極力','確實','無故','四次','加倍','殷勤',
                      '樂意','同音','盡性','竭力','盡力','非常','不斷','分外','一直','成群','自語',
                      '據實','急促','無理','無懼','無事','多方','戰兢','這樣','怎樣','同樣','照樣'];
const TTS_DE_KEEP_RE = new RegExp('(' + TTS_DE_KEEP.join('|') + ')地', 'g');
function ttsDiFix(s){
  const MARK = '\u0001';
  TTS_DE_OVERRIDE.forEach(re => { s = s.replace(re, m => m.replace('地', '第')); });
  s = s.replace(/([一-龥])\1地/g, (m, c) => c + c + MARK);           // 疊字＋地：保留 de（大大地、漸漸地…）
  s = s.replace(/([〇一二三四五六七八九十百千兩幾])(.)[〇一二三四五六七八九十百千兩幾]\2地/g,
    (m, a, b) => m.slice(0, -1) + MARK);                                     // 數字＋量詞重疊＋地：保留 de（一對一對地、一次兩次地…）
  s = s.replace(TTS_DE_KEEP_RE, (m, w) => w + MARK);                         // 副詞清單＋地：保留 de
  s = s.replace(/地/g, '第');                                                // 其餘一律強制 dì
  return s.replace(new RegExp(MARK, 'g'), '地');
}
/* 「長」在「長＋數字＋肘／尺…度量衡單位」這種描述尺寸的地方（要長三百肘、長二十肘），
   要唸長度的長（ㄔㄤˊ），不是族長／官長那種頭銜的長（ㄓㄤˇ）——使用者回報「要長三百肘」
   （創世記6:15方舟的尺寸）唸錯了。
   跟「地」字同一套方法：先掃過全本聖經驗證，全本「長」後面緊接數字的用法共96次，其中
   89次後面接著肘／尺／丈／寸／虎口／竿等度量衡單位，全部是描述長度（要唸ㄔㄤˊ）；
   另外7次（千夫長、百夫長、族長二十二人、祭司長十二人、官長一百五十人、膳長二人、
   總長三人）後面接的是「人」，是頭銜＋人數不是長度——這條規則要求數字後面要緊接
   度量衡單位才觸發，天然排除了這7個，不用另外列清單。 */
const TTS_CHANG_RE = /長(?=[〇一二三四五六七八九十百千萬兩幾]+(?:肘|尺|丈|寸|虎口|竿|掌))/g;
function ttsChangFix(s){ return s.replace(TTS_CHANG_RE, '常'); }
/* 「創 1:26」唸成「創世記第1章第26節」。
   縮寫直接唸出來很怪（而且「創」「約」單獨一個字根本聽不懂），
   所以送去合成之前先還原成完整書名與章節。只處理「書名 章:節」這種明確的寫法，
   才不會把「大約 3 個」之類的字誤判成經文出處。 */
let _refRe = null, _refMap = null, _refLang = '';
function refTable(){
  if (_refRe && _refLang === state.lang) return { re:_refRe, map:_refMap };
  const map = {};
  (TOC || []).forEach(b => {
    const full = isID() ? (b.idn || b.en) : isJA() ? (b.ja || b.en) : isKO() ? (b.ko || b.en) : isEN() ? b.en : (isZS() ? b.zs : b.zh);
    const val = { full, ps: b.id === 'Psalms' };
    const keys = isID() ? [b.idn, b.aid] : isJA() ? [b.ja, b.aja] : isKO() ? [b.ko, b.ako] : isEN() ? [b.en, b.aen] : [(isZS() ? b.zs : b.zh), (isZS() ? b.azs : b.azh)];
    keys.forEach(k => { if (k) map[k] = val; });
  });
  const ks = Object.keys(map).sort((a, b) => b.length - a.length)
                   .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  _refRe = ks.length
    ? new RegExp('(' + ks.join('|') + ')\\s*\\.?\\s*(\\d+)\\s*[:：]\\s*(\\d+)(?:\\s*[-–—~～至]\\s*(\\d+))?', 'g')
    : /(?!)/g;
  _refMap = map; _refLang = state.lang;
  return { re:_refRe, map:_refMap };
}
/* 唸法照使用者定的：
     創 1:26   → 創世記1章26節
     詩 23:1-3 → 詩篇23篇1到3節      ← 詩篇用「篇」不用「章」，而且不加「第」
   數字保留阿拉伯數字，語音引擎會自己唸成「一章二十六節」。 */
const CJK_RE = /[\u3400-\u9FFF\uF900-\uFAFF]/;
function ttsRef(x){
  const r = refTable();
  r.re.lastIndex = 0;
  const src = String(x || '');
  return src.replace(r.re, function (m, bk, c, v, v2, off){
    /* 單字縮寫（創、約、詩…）若緊接在另一個中文字後面，多半是別的詞的一部分
       ——「大約 3:2 個人」不能變成「大約翰福音3章2節」。整個書名寫全的就不必顧慮。 */
    if (bk.length === 1 && off > 0 && (CJK_RE.test(src.charAt(off - 1)) || /[\u3040-\u30FF]/.test(src.charAt(off - 1)) || /[\uAC00-\uD7A3]/.test(src.charAt(off - 1)))) return m;
    if (isEN() && off > 0 && /[A-Za-z]/.test(src.charAt(off - 1))) return m;
    const it = r.map[bk] || { full:bk, ps:false };
    if (isID()){ const head = it.ps ? ('Mazmur ' + c) : (it.full + ' pasal ' + c); return head + (v2 ? ' ayat ' + v + ' sampai ' + v2 : ' ayat ' + v); }
    if (isJA()) return it.full + c + (it.ps ? '篇' : '章') + v + (v2 ? '節から' + v2 : '') + '節';
    if (isKO()) return it.full + ' ' + c + (it.ps ? '편' : '장') + ' ' + v + (v2 ? '절에서 ' + v2 : '') + '절';
    if (isEN()){
      const head = it.ps ? ('Psalm ' + c) : (it.full + ' chapter ' + c);
      return head + (v2 ? ' verses ' + v + ' to ' + v2 : ' verse ' + v);
    }
    const unit = it.ps ? '篇' : '章';
    const jie  = isZS() ? '节' : '節';
    return it.full + c + unit + v + (v2 ? '到' + v2 : '') + jie;
  });
}
/* 表情符號不要唸出來——語音引擎會把它唸成「笑臉」「祈禱的手」，很突兀 */
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}\u{20E3}]/gu;
const noEmoji = x => String(x || '').replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ');

/* ═══════════════════════════════════════════════════════════════════
   PRON321 · 真人朗讀發音修正（依技能 321-reading-pronunciation）
   只改「送去語音的文字」，畫面、分享、美圖的字一個都不動。
   · SHARED：兩版共用的指定讀音（繁、简兩種寫法都列）
   · TW：臺灣版（繁體介面）卻用了大陸口音語音（zh-CN）時才套
   · CN：大陸版（简体介面）卻用了臺灣口音語音（zh-TW）時才套
   規則一律帶上下文、長詞先；每條替代字只有一個讀音，套兩次也不會變（可重複套用）。
   ═══════════════════════════════════════════════════════════════════ */
var PRON321 = (function () {
  'use strict';
  var NUM = '[〇零一二三四五六七八九十百千萬万兩两幾几]+';
  var UNIT = '(?:肘|尺|丈|寸|虎口|竿|掌|里|步)';
  function R(s) { return new RegExp(s, 'g'); }
  /* [pattern, 替代] —— 繁、简各一條（同形的只寫一次） */
  var SHARED = [
    /* 重 chóng／zhòng */
    [R('重生'), '蟲生'], [R('重新'), '蟲新'], [R('重建'), '蟲建'],
    [R('重擔'), '眾擔'], [R('重担'), '众担'],
    /* 長 zhǎng：職稱、成長；長＋數字＋度量衡 cháng */
    [R('長(?=' + NUM + UNIT + ')'), '常'], [R('长(?=' + NUM + UNIT + ')'), '常'],
    [R('長(老|子|大|進|輩|執)'), '掌$1'],
    [R('长(老|子|大|进|辈|执)'), '掌$1'],
    [R('(成|生|年|家|族|官|兄|師|师|首|牧|夫|組|组|團|团|校|部|區|区|社)(長|长)(?![久遠远存期])'), '$1掌'],
    /* 差 chāi */
    [R('差(遣|派|役)'), '拆$1'],
    [R('([主神祂他我])差(?=[人你我他門门使])'), '$1拆'],
    /* 得著 dé zhuó */
    [R('得[著着](?![急涼凉迷火慌])'), '得酌'],
    /* 為 wèi：為主而活、為人禱告…（「成為」「以…為主」不在這些組合裡） */
    [R('(^|[^成作行認认稱称以視视])([為为])(?=(?:主|神|祂|基督|耶穌|耶稣)(?:而活|而死|作工|做工|擺上|摆上|受苦|犧牲|牺牲|捨命|舍命|捨己|舍己|發熱心|发热心))'), '$1衛'],
    [R('([為为])(?=(?:人|別人|别人|眾人|众人|你|你們|你们|我們|我们|他們|他们|弟兄姊妹)(?:禱告|祷告|代禱|代祷|代求|捨命|舍命))'), '衛'],
    /* 給 jǐ */
    [R('(供|補|补)[給给]'), '$1己'], [R('[給给]予'), '己予'],
    /* 應 yìng／yīng */
    [R('應許'), '映許'], [R('应许'), '映许'], [R('應驗'), '映驗'], [R('应验'), '映验'],
    [R('應當'), '英當'], [R('应当'), '英当'],
    /* 傳 chuán／zhuàn */
    [R('傳道'), '船道'], [R('传道'), '船道'],
    [R('(行|自)傳'), '$1賺'], [R('(行|自)传'), '$1赚'], [R('傳記'), '賺記'], [R('传记'), '赚记'],
    /* 專名與聖經特殊詞 */
    [R('沒藥'), '莫藥'], [R('没药'), '莫药'],
    [R('嗎哪'), '馬哪'], [R('吗哪'), '马哪'],
    [R('撒種'), '撒腫'], [R('撒种'), '撒肿'],
    [R('撒但'), '仨但'],
    [R('數一數'), '鼠一鼠'], [R('数一数'), '鼠一鼠'],
    [R('數(點|算)'), '鼠$1'], [R('数(点|算)'), '鼠$1'],
    [R('參孫'), '餐孫'], [R('参孙'), '餐孙'],
    [R('阿們'), '阿門'], [R('阿们'), '阿门'],
    [R('冠冕'), '官冕'],
    [R('朝(見|拜)'), '潮$1'], [R('朝(见|拜)'), '潮$1'],
    [R('背(起|負|负)'), '揹$1'],
    [R('看守'), '刊守'],
    [R('說客'), '稅客'], [R('说客'), '税客'],
    [R('年少'), '年紹'], [R('(^|[^多不減减缺很太至最])少年'), '$1紹年'],
    [R('盛(滿|满)'), '成$1'],
    [R('([一兩两三那這这])宿(?![舍])'), '$1朽'],
    [R('乾(?!坤)'), '甘'],
    [R('鴿'), '哥']
  ];
  /* 臺灣國語（繁體介面＋大陸口音語音） */
  var TW = [
    [R('[說说]服'), '稅服'], [R('[遊游][說说]'), '遊稅'],
    [R('期'), '奇'], [R('企'), '器'],
    [R('[危微]'), '圍'], [R('寂'), '疾'],
    [R('(^|[^人])[質质]'), '$1直'],
    [R('[暫暂]'), '站'], [R('[攜携]'), '西'], [R('曝'), '瀑'],
    [R('垃圾'), '樂色'], [R('[蝸蜗]'), '瓜'],
    [R('[結结]果子'), '節果子']
  ];
  /* 普通話（简体介面＋臺灣口音語音）——講義 App 在简体模式送出的可能仍是繁體原文，所以兩種字形都要認 */
  var CN = [
    [R('期'), '七'], [R('企'), '起'],
    [R('[危微]'), '威'], [R('寂'), '寄'],
    [R('(^|[^人])[质質]'), '$1至'],
    [R('[暂暫]'), '赞'], [R('[携攜]'), '鞋'], [R('曝光'), '爆光'],
    [R('垃圾'), '拉鸡'], [R('[蜗蝸]'), '窝']
  ];
  function run(list, s) {
    for (var i = 0; i < list.length; i++) s = s.replace(list[i][0], list[i][1]);
    return s;
  }
  /* std：'tw'（臺灣國語）或 'cn'（普通話）；voice：語音名稱（zh-TW-… / zh-CN-…）或語系 */
  function fix(s, std, voice) {
    s = String(s == null ? '' : s);
    if (!/[㐀-鿿]/.test(s)) return s;            // 英文不動
    s = run(SHARED, s);
    var v = String(voice || '');
    var vTW = /zh[-_]TW|zh[-_]HK/i.test(v), vCN = /zh[-_]CN|cmn/i.test(v);
    if (std === 'tw' && vCN) s = run(TW, s);
    else if (std === 'cn' && vTW) s = run(CN, s);
    return s;
  }
  /* 裝置內建語音（speechSynthesis）也走同一套 */
  var stdNow = function () { return 'tw'; };
  function hookNative(getStd) {
    if (getStd) stdNow = getStd;
    try {
      var ss = window.speechSynthesis;
      if (!ss || ss.__pron) return;
      var sp = ss.speak.bind(ss);
      ss.speak = function (u) {
        try { if (u && u.text) u.text = fix(u.text, stdNow(), u.lang || ''); } catch (e) {}
        return sp(u);
      };
      ss.__pron = 1;
    } catch (e) {}
  }
  /* 只做兩岸差異那一段（給已經自己套過共用規則的引擎用，例如創世記的 TTS321） */
  function fixDiff(s, std, voice) {
    s = String(s == null ? '' : s);
    var v = String(voice || '');
    if (std === 'tw' && /zh[-_]CN|cmn/i.test(v)) return run(TW, s);
    if (std === 'cn' && /zh[-_]TW|zh[-_]HK/i.test(v)) return run(CN, s);
    return s;
  }
  return { fix: fix, fixDiff: fixDiff, hookNative: hookNative, SHARED: SHARED, TW: TW, CN: CN };
})();

PRON321.hookNative(() => isZS() ? 'cn' : 'tw');
function ttsPrep(s){
  let x = noEmoji(ttsRef(dropRefParens(s)));
  x = x.replace(/〔[^〕]*〕/g, '').replace(/\[[^\]]*\]/g, '');   // 譯者註不朗讀
  if (isEP()) return x.replace(/\s+/g, ' ').trim();                  // 英文／日文不做華語破音字修正
  x = x.replace(/[「」『』（）]/g, '');
  /* 真人朗讀發音（技能 321-reading-pronunciation）：先套共用指定讀音與兩岸差異，再套下面的舊表 */
  x = PRON321.fix(x, isZS() ? 'cn' : 'tw', ((VOICES[state.lang] || [])[state.voice[state.lang]] || {}).v || '');
  TTS_FIX.forEach(([re, to]) => { x = x.replace(re, to); });
  x = ttsDiFix(x);
  x = ttsChangFix(x);
  return x.trim();
}
/* 一次送出去的語音仍然是好幾句接在一起（少一點請求、語氣才連得順），
   但畫面上的顏色標示要「一句一句」跟著走，不是整段一起亮。
   所以每一段都記下裡面每一句各佔多少字，播放時依進度比例算出正在讀哪一句。 */
function buildQueue(all){
  let els = $$('#reader .sent');
  if (!all){
    const from = els.findIndex(el => el.getBoundingClientRect().bottom > 0);
    if (from > 0) els = els.slice(from);
  }
  const items = []; let cur = { text:'', els:[], segs:[], lens:[], at:-1 };
  const push = () => { if (cur.text) items.push(cur); cur = { text:'', els:[], segs:[], lens:[], at:-1 }; };
  /* 先併成「完整句」，再切段送語音——一句話絕不會被切成兩段 */
  sentGroups(els).forEach(g => {
    const txt = g.map(e => e.textContent).join('');
    if (cur.text.length + txt.length > TTS_CHUNK() && cur.text) push();
    cur.text += txt;
    cur.els = cur.els.concat(g);
    cur.segs.push(g);
    cur.lens.push(Math.max(1, ttsPrep(txt).length));
  });
  push();
  return items.filter(i => ttsPrep(i.text).length > 0);
}
function raClear(){ $$('.tts-reading').forEach(e => e.classList.remove('tts-reading')); }
/* 只標亮這一段裡的第 k 個「完整句」（詩歌體可能是連著的兩三行） */
function raSeg(item, k){
  if (!item || !item.segs || !item.segs.length) return;
  k = Math.max(0, Math.min(k, item.segs.length - 1));
  if (item.at === k && $('.tts-reading')) return;
  item.at = k;
  raClear();
  const g = item.segs[k].filter(e => e && e.isConnected);
  if (!g.length) return;
  g.forEach(e => e.classList.add('tts-reading'));
  crTts(g[0]);
  if (Date.now() - raManualAt > RA_COOLDOWN){
    try{ g[0].scrollIntoView({ behavior:'smooth', block:'center' }); }catch(_){}
  }
}
/* ratio = 這一段唸到幾成（0～1），換算成第幾句 */
function raProgress(item, ratio){
  if (!item || !item.lens || item.lens.length < 2) return;
  if (!(ratio >= 0)) return;
  const total = item.lens.reduce((a, b) => a + b, 0);
  let acc = 0, k = 0;
  const target = Math.min(ratio, 1) * total;
  for (let j = 0; j < item.lens.length; j++){
    acc += item.lens[j];
    if (target < acc){ k = j; break; }
    k = j;
  }
  raSeg(item, k);
}
/* 畫面重畫過（換章以外的情形，例如換字級、切模式）之後，
   朗讀佇列裡記的還是舊的 DOM。重新接回新的句子，顏色標示才不會不見。 */
function ttsRebind(){
  if (!spk.on || !spk.items.length) return;
  let ok = 0;
  const again = old => {
    const e = $(`#reader .sent[data-c="${old.dataset.c}"][data-p="${old.dataset.p}"][data-s="${old.dataset.s}"]`);
    if (e) ok++;
    return e || old;
  };
  spk.items.forEach(it => {
    it.segs = (it.segs || []).map(g => g.map(again));
    it.els = it.segs.reduce((a, g) => a.concat(g), []);
  });
  if (!ok) return;                       // 已經換到別章了，就不要亂標
  const cur = spk.items[spk.idx];
  if (!cur) return;
  const k = cur.at >= 0 ? cur.at : 0;
  cur.at = -1; raSeg(cur, k);
}
function raShow(item){
  if (!item || !item.els.length){ raClear(); return; }
  item.at = -1;
  raSeg(item, 0);
}
['wheel','touchmove'].forEach(ev => window.addEventListener(ev, () => { raManualAt = Date.now(); }, { passive:true }));

/* 開始／暫停／停止三顆各自的可按狀態。st：'' 閒置、'loading' 抓語音中、'playing' 播放中、'paused' 暫停中 */
function ttsBtn(st){
  ttsSys(st);
  const play = $('#rdPlay'), pause = $('#rdPause'), stop = $('#rdStop');
  if (!play || !pause || !stop) return;
  [play, pause, stop].forEach(b => b.removeAttribute('data-state'));
  if (st === 'loading'){
    play.setAttribute('data-state', 'loading'); play.disabled = true;
    pause.disabled = true; stop.disabled = false;
  } else if (st === 'playing'){
    play.disabled = true;
    pause.disabled = false; pause.setAttribute('data-state', 'playing');
    stop.disabled = false;
  } else if (st === 'paused'){
    play.disabled = false; play.setAttribute('data-state', 'paused');
    pause.disabled = true; stop.disabled = false;
  } else {
    play.disabled = false; pause.disabled = true; stop.disabled = true;
  }
}

/* iOS/Safari 兩個坑，都要照《321領導力》的作法避開：
   ① 整個 App 只能有「一個」<audio> 元素，而且必須在使用者按下按鈕的那一瞬間
      （還在 user gesture 裡）就先 play() 過一次，之後才准程式自己播。
      如果等 fetch 回來再 new Audio()，手勢早就過期了，play() 會被擋下來，
      看起來就像「真人語音壞掉、自動改用裝置語音」。
   ② Worker 回傳的 Content-Type 不一定是 audio/mpeg；直接拿 response.blob()
      交給 <audio> 會解不出來。改成自己讀 arrayBuffer 再指定 audio/mpeg。 */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
let ttsEl = null, ttsUnlocked = false, ttsLastErr = '';
/* 保命看門狗：WKWebView（iOS 上的 PWA）的 speechSynthesis 有個很有名的老毛病——
   偶爾唸完最後一句卻不觸發 onend／onerror，程式就卡住等一個永遠不會來的事件，
   使用者感覺「讀完自動接下一章」完全沒反應（其實是連「自然唸完」這一步都沒偵測到，
   ttsStop(true) 根本沒被呼叫過）。網路語音的 <audio> 理論上比較穩，但背景/鎖屏時
   同樣可能吃到瀏覽器悄悄丟掉事件，兩條路都掛一個保底計時器：
   等太久還沒等到 onend／onended，就當作已經唸完，自己往下一段推進。 */
let ttsWatchdog = null;
function ttsClearWatchdog(){ if (ttsWatchdog){ clearTimeout(ttsWatchdog); ttsWatchdog = null; } }
function ttsArmWatchdog(text, gen, cb){
  ttsClearWatchdog();
  const ms = Math.min(120000, Math.max(15000, ttsPrep(text).length * 480 + 10000));
  ttsWatchdog = setTimeout(() => {
    ttsWatchdog = null;
    if (gen === spk.gen && spk.on && !spk.abort) cb();
  }, ms);
}
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
/* 日文／印尼文的雲端語音尚未驗證：第一次逾時或失敗後，本次開啟 App 期間直接改用裝置內建語音，不再讓每一句都等 */
const TTS_BAD = {};
async function ttsFetch(text, voice){
  const lg = state.lang, unverified = false;   // Worker 已支援各語言語音（v2.26.4），不再另外縮短逾時
  if (unverified && TTS_BAD[lg]) throw new Error('cloud voice skipped');
  const body = JSON.stringify({ voice, rate: TTS_RATE, sil: TTS_SIL, silc: TTS_SILC, sile: TTS_SILE, text });
  for (let a = 0; a <= TTS_RETRY.length; a++){
    try{
      const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), unverified ? 6000 : 15000);
      const r = await fetch(API.tts, { method:'POST', headers:{'Content-Type':'application/json'}, body, signal: ac.signal }).finally(() => clearTimeout(tm));
      if (!r.ok) throw new Error('http ' + r.status);
      const buf = await r.arrayBuffer();
      if (!buf || buf.byteLength < 128) throw new Error('empty audio');
      return URL.createObjectURL(new Blob([buf], { type:'audio/mpeg' }));
    }catch(e){
      ttsLastErr = (e && e.message) ? String(e.message) : 'network';
      if (unverified){ TTS_BAD[lg] = true; throw e; }
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
async function ttsPrefetch(i, gen){
  const it = spk.items[i]; if (!it || spk.cache[i]) return;
  if (gen !== spk.gen) return;      // 這一輪已經被换掉了，抓回來的東西不要再塞進新的一輪
  const voice = VOICES[state.lang][state.voice[state.lang]].v;
  try{ const url = await ttsFetch(ttsPrep(it.text), voice); if (gen === spk.gen) spk.cache[i] = url; }
  catch(e){ if (gen === spk.gen) spk.cache[i] = null; }
}
async function ttsPlayFrom(i, gen){
  if (!spk.on || spk.abort || gen !== spk.gen) return;
  if (i >= spk.items.length){ ttsStop(true); return; }
  spk.idx = i; raShow(spk.items[i]);
  /* 先排這一段自己的請求，再排後面的預抓——否則第一聲會等在後面兩段的後面 */
  if (spk.cache[i] === undefined) await ttsPrefetch(i, gen);
  for (let k = i + 1; k <= i + TTS_LOOKAHEAD; k++) ttsPrefetch(k, gen);
  /* 上面兩次 await 的空檔，使用者可能已經按了「從這裡開始朗讀」或再按一次「開始」
     開啟了新的一輪——這裡的 i 是舊一輪的位置，gen 對不上就整個放手，
     不然舊的位置會在新的一輪播到一半時把畫面／音檔搶回去，變成「跳的地方沒有作用」。 */
  if (!spk.on || spk.abort || gen !== spk.gen) return;
  const url = spk.cache[i];
  if (!url){ return ttsNativeFrom(i, gen); }
  ttsBtn('playing');
  const a = ttsAudio(); spk.audio = a;
  const old = a.src;
  a.onended = null; a.onerror = null; a.ontimeupdate = null;
  a.src = url;
  if (old && old.startsWith('blob:')){ try{ URL.revokeObjectURL(old); }catch(e){} }
  /* 依播放進度把顏色標示往下一句移——聲音還是整段連著唸，畫面是一句一句 */
  a.ontimeupdate = () => {
    if (!spk.on || spk.abort || spk.idx !== i || gen !== spk.gen) return;
    const d = a.duration;
    if (d && isFinite(d) && d > 0) raProgress(spk.items[i], a.currentTime / d);
  };
  a.onended = () => { ttsClearWatchdog(); a.ontimeupdate = null; if (spk.on && !spk.abort && gen === spk.gen) ttsPlayFrom(i + 1, gen); };
  /* 這一段音檔明明抓下來了（ttsFetch 已經檢查過大小、不是空檔），
     卻在播放這一步出錯（例如解碼失敗、瀏覽器自動播放限制擋下 play()）——
     以前這裡只有第 0 段會退回裝置語音朗讀，其他段落直接跳到下一段，
     等於這一段完全沒有被唸出來，使用者反應「前面一段沒有讀出來」就是這個原因。
     改成不管是第幾段，播放失敗都退回裝置語音朗讀「這一段」，不要整段跳過不讀。 */
  a.onerror = () => {
    ttsClearWatchdog();
    if (gen !== spk.gen) return;
    if (spk.on && !spk.abort) ttsNativeFrom(i, gen);
  };
  try{
    const p = a.play();
    /* 保底：背景／鎖屏時瀏覽器偶爾會悄悄不觸發 onended，等太久就當作唸完自己往下推 */
    ttsArmWatchdog(spk.items[i].text, gen, () => {
      if (spk.idx !== i) return;
      a.onended = null; a.onerror = null;
      try{ a.pause(); }catch(e){}
      ttsPlayFrom(i + 1, gen);
    });
    if (p && p.catch) await p;
  }catch(e){
    ttsClearWatchdog();
    if (gen !== spk.gen) return;
    if (spk.on && !spk.abort) ttsNativeFrom(i, gen);
  }
}
function ttsNativeFrom(i, gen){
  if (gen !== spk.gen) return;
  if (!('speechSynthesis' in window)){ toast(t().ttsErr); ttsStop(true); return; }
  if (!spk.native){ spk.native = true;
    let msg = t().ttsFallback + (ttsLastErr ? '（' + ttsLastErr + '）' : '');
    try{
      const want = isID() ? 'id' : isJA() ? 'ja' : isKO() ? 'ko' : '';
      const vs = speechSynthesis.getVoices() || [];
      if (want && vs.length && !vs.some(v => (v.lang || '').toLowerCase().replace('_', '-').indexOf(want) === 0))
        msg = (isID() ? 'Perangkat ini belum punya suara bahasa Indonesia. Unduh di Pengaturan → Aksesibilitas → Konten Lisan → Suara → Indonesia.' : isJA() ? 'この端末に日本語の音声がありません。設定→アクセシビリティ→読み上げコンテンツ→声 から日本語を追加してください。' : '이 기기에 한국어 음성이 없습니다. 설정 → 손쉬운 사용 → 음성 콘텐츠 → 음성에서 추가하세요.');
    }catch(e){}
    toast(msg); }
  if (!spk.on || spk.abort || i >= spk.items.length){ ttsStop(i >= spk.items.length); return; }
  spk.idx = i; raShow(spk.items[i]); ttsBtn('playing');
  const say = ttsPrep(spk.items[i].text);
  const u = new SpeechSynthesisUtterance(say);
  u.lang = isID() ? 'id-ID' : isJA() ? 'ja-JP' : isKO() ? 'ko-KR' : (isEN() ? 'en-US' : (isZS() ? 'zh-CN' : 'zh-TW')); u.rate = .95;
  /* 裝置語音給得到字元位置，就直接照位置換句子 */
  u.onboundary = e => {
    if (!spk.on || spk.abort || spk.idx !== i || gen !== spk.gen) return;
    if (say.length) raProgress(spk.items[i], (e.charIndex || 0) / say.length);
  };
  u.onend = () => { ttsClearWatchdog(); if (spk.on && !spk.abort && gen === spk.gen) ttsNativeFrom(i + 1, gen); };
  u.onerror = () => { ttsClearWatchdog(); if (spk.on && !spk.abort && gen === spk.gen) ttsNativeFrom(i + 1, gen); };
  try{
    speechSynthesis.speak(u);
    /* 保底：WKWebView（iOS PWA）的 speechSynthesis 偶爾唸完不觸發 onend，
       等太久就當作唸完自己往下推——不然「讀完自動接下一章」永遠等不到自然結束。 */
    ttsArmWatchdog(say, gen, () => {
      if (spk.idx !== i) return;
      u.onend = null; u.onerror = null;
      try{ speechSynthesis.cancel(); }catch(e){}
      ttsNativeFrom(i + 1, gen);
    });
  }catch(e){ ttsClearWatchdog(); ttsStop(); }
}
/* ▶ 開始／接續：暫停中就直接接續播放；閒置就照優先順序決定從哪裡開始
   （使用者指定的段落 > 上次按停的位置，兩者都要同一書卷／章節／連讀模式才算數 > 目前捲動位置）。*/
function ttsStart(){
  if (spk.on && spk.paused){ ttsResumePlaying(); return; }
  if (spk.on) return;                 // 正在播放時 ▶ 是 disabled，這裡多一層保險
  ttsUnlock();                        // 一定要在這裡（還在使用者的點擊手勢裡）
  let items, startIdx = 0;
  const mark = ttsStartAt || ttsResume;
  ttsStartAt = null;
  const sameSpot = mark && mark.book === RD.book && mark.flow === RD.flow && (RD.flow || mark.ch === RD.ch);
  if (sameSpot){
    items = buildQueue(true);          // 接續播放要看得到整段內容，不能只從目前捲動位置切
    const idx = items.findIndex(it => it.segs.some(g => g.some(e =>
      e.dataset.c === mark.c && e.dataset.p === mark.p && e.dataset.s === mark.s)));
    if (idx >= 0) startIdx = idx;
  } else {
    items = buildQueue();
  }
  if (!items.length) return;
  const myGen = ++ttsGen;   // 開新的一輪，舊一輪不管做到哪裡，回來時號碼對不上就自動放手
  spk = { on:true, paused:false, items, idx:startIdx, audio:null, cache:{}, native:false, abort:false, gen:myGen };
  ttsBtn('loading');
  ttsPlayFrom(startIdx, myGen);
}
/* ⏸ 暫停：原地停住聲音（不是重新抓一段），保留精確的播放位置，方便馬上接回去 */
function ttsPauseNow(){
  if (!spk.on || spk.paused) return;
  spk.paused = true;
  ttsClearWatchdog();
  try{ if (spk.audio) spk.audio.pause(); }catch(e){}
  try{ if (spk.native && 'speechSynthesis' in window) speechSynthesis.pause(); }catch(e){}
  ttsBtn('paused');
}
function ttsResumePlaying(){
  if (!spk.on || !spk.paused) return;
  spk.paused = false;
  ttsBtn('playing');
  try{
    if (spk.native){ if ('speechSynthesis' in window) speechSynthesis.resume(); }
    else if (spk.audio){ const p = spk.audio.play(); if (p && p.catch) p.catch(() => {}); }
  }catch(e){}
}
/* ⏹ 停止：natural=true 表示唸到整段結尾自然結束，不是使用者按停——這時候沒有「接續點」可言 */
function ttsStop(natural){
  ttsClearWatchdog();
  if (sayId !== null){ sayId = null; paintSay(); }
  if (spk.on && !natural){
    const it = spk.items[spk.idx];
    const seg = it && it.segs && it.at >= 0 ? it.segs[it.at] : null;
    const el = seg && seg.find(e => e && e.isConnected);
    if (el) ttsResume = { book:RD.book, ch:RD.ch, flow:RD.flow, c:el.dataset.c, p:el.dataset.p, s:el.dataset.s };
  } else if (natural){
    ttsResume = null;
  }
  spk.on = false; spk.paused = false; spk.abort = true;
  try{ if (ttsEl){ ttsEl.pause(); } }catch(e){}
  spk.audio = null;
  try{ if ('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
  raClear(); ttsBtn('');
  if (natural) ttsMaybeAutoNext();
}
/* 一章自然唸完時（不是使用者按停），看設定要不要自動接下一章：
   整卷連讀本來就整卷唸完才會停，不需要再翻頁；分章模式才適用。
   跨書卷比照 ▶「下一章」按鈕的規則，唸到啟示錄 22 章就自然停下。 */
function ttsMaybeAutoNext(){
  if (!state.ttsAutoNext || RD.flow || !RD.book) return;
  const b = BOOK[RD.book]; if (!b) return;
  let nb = b.i, nc = RD.ch + 1;
  if (nc > b.ch){ nb = b.i + 1; nc = 1; }
  if (nb < 0 || nb > 65) return;
  ttsAutoNextPending = true;
  go(`#/read/${TOC[nb].id}/${nc}`);
}
/* 目前正在唸第幾則小智的回答（null＝沒有在唸） */
let sayId = null;
function paintSay(){
  $$('.msg-act[data-a="tts"]').forEach(b => {
    const on = sayId === +b.dataset.i;
    b.classList.toggle('on', on);
    b.textContent = on ? '⏸' : '🔊';
  });
}
function ttsSayStop(){
  if (sayId === null) return;
  try{ if (ttsEl){ ttsEl.pause(); ttsEl.currentTime = 0; } }catch(e){}
  try{ if ('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
  sayId = null; paintSay();
}
async function ttsSpeakText(text, id){
  ttsUnlock();
  const clean = ttsPrep(mdSpeak(text));   // 表格先說成人話，再送去合成
  if (!clean) return;
  const voice = VOICES[state.lang][state.voice[state.lang]].v;
  const done = () => { if (id == null || sayId === id) ttsSayStop(); };
  try{
    const url = await ttsFetch(clean.slice(0, 900), voice);
    if (id != null && sayId !== id) return;          // 等的時候他已經按停了
    const a = ttsAudio();
    const old = a.src;
    a.onended = null; a.onerror = null;
    a.src = url;
    if (old && old.startsWith('blob:')){ try{ URL.revokeObjectURL(old); }catch(e){} }
    a.onended = done;
    a.onerror = done;
    const p = a.play(); if (p && p.catch) await p;
  }catch(e){
    if ('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = isID() ? 'id-ID' : isJA() ? 'ja-JP' : isKO() ? 'ko-KR' : (isEN() ? 'en-US' : (isZS() ? 'zh-CN' : 'zh-TW'));
      u.onend = done; u.onerror = done;
      speechSynthesis.speak(u); toast(t().ttsFallback);
    } else { toast(t().ttsErr); done(); }
  }
}

/* ================================================================ v2.12.0 補強（依 321 互動聖經功能套件）
   小智：長回答收合、回答被截斷自動接著寫完；朗讀：鎖屏顯示與防休眠、括號出處不唸、小智回答說成口語；
   錄製：配樂結束一律淡出 5 秒；祝福結尾只留「阿們」。 */

/* ---------- 小智回答：收合 ---------- */
const msgLong = m => m && m.role === 'ai' && !m.cont && mdStrip(m.text || '').length > (isEN() ? 420 : 200);
const msgFoldCls = m => (m.fold && msgLong(m)) ? ' fold' : '';
function msgMoreHtml(m, i){
  if (!msgLong(m)) return '';
  return `<button class="msg-more" data-i="${i}">${esc(m.fold ? L3('展開全文 ▾', '展开全文 ▾', 'Read more ▾') : L3('收合 ▴', '收合 ▴', 'Collapse ▴'))}</button>`;
}
/* 只改這一則的 class 與按鈕字，不重畫整個對話——才不會打斷正在朗讀的那一則 */
function msgFold(i){
  const m = chatLog[i]; if (!m || !msgLong(m)) return;
  m.fold = !m.fold;
  const el = document.getElementById('msg' + i); if (!el) return;
  el.classList.toggle('fold', !!m.fold);
  const b = el.querySelector('.msg-more');
  if (b) b.textContent = m.fold ? L3('展開全文 ▾', '展开全文 ▾', 'Read more ▾') : L3('收合 ▴', '收合 ▴', 'Collapse ▴');
  if (m.fold) try{ el.scrollIntoView({ block:'nearest' }); }catch(e){}
}
/* 新回答抵達：之前的長回答自動收起，只留最新一則展開 */
function foldOld(){
  let last = -1;
  chatLog.forEach((m, i) => { if (m.role === 'ai') last = i; });
  chatLog.forEach((m, i) => { if (m.role === 'ai' && msgLong(m)) m.fold = (i !== last); });
}
function foldAll(){
  let n = 0;
  chatLog.forEach(m => { if (msgLong(m)){ m.fold = true; n++; } });
  if (!n){ toast(L3('目前沒有需要收合的回答', '目前没有需要收合的回答', 'No long answers to collapse')); return; }
  paintChat();
  toast(L3('已收合所有長回答', '已收合所有长回答', 'All long answers collapsed'));
}

/* ---------- 小智回答：呼叫＋被截斷時自動接著寫 ---------- */
async function chatCall(sys, msgs){
  let out = '', why = '', stop = '';
  for (let a = 0; a <= CHAT_RETRY.length; a++){
    try{
      const r = await fetch(API.chat, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ system: koSys(sys), messages: msgs }) });
      if (!r.ok) throw new Error('http ' + r.status);
      const d = await r.json().catch(() => null);
      out = extractReply(d);
      stop = (d && (d.stop_reason || d.finish_reason ||
             (d.choices && d.choices[0] && d.choices[0].finish_reason))) || '';
      if (!out) why = L3('回覆是空的', '回复是空的', 'empty reply');
      break;
    }catch(e){
      why = (e && e.message) ? String(e.message) : 'network';
      if (a === CHAT_RETRY.length) break;
      await new Promise(rs => setTimeout(rs, CHAT_RETRY[a]));
    }
  }
  return { out, why, stop };
}
/* 回傳 stop_reason 為 max_tokens／length 就是被截斷；沒有 stop_reason 時，只在長文又沒有結束標點時才猜是被截斷 */
function chatTruncated(text, stop){
  if (stop === 'max_tokens' || stop === 'length') return 'sure';
  if (stop) return '';
  const x = String(text || '').trim();
  if (x.length < 280) return '';
  if (/[。！？.!?」』）)”"…~|]$/.test(x) || /(阿們|阿门|amen\.?)$/i.test(x)) return '';
  return 'guess';
}
function chatJoin(acc, piece){
  piece = String(piece || '').replace(/^\s*(好的|好|OK|Okay|Sure)[，,。.!！]?\s*/i, '');
  const max = Math.min(40, acc.length, piece.length);
  for (let k = max; k >= 4; k--){
    if (acc.slice(-k) === piece.slice(0, k)){ piece = piece.slice(k); break; }
  }
  const head = piece.replace(/^\s+/, '');
  if (/^(#{1,6} |&gt;|>|---)/.test(head)) return acc.replace(/\s+$/, '') + '\n\n' + head;
  if (/^([-*] |\d+[.)] |\|)/.test(head)) return acc.replace(/\s+$/, '') + '\n' + head;
  return acc + piece;
}
const CONT_ASK = () => L3('請從中斷的地方直接接著寫完，不要重複前面已經寫過的內容，也不要加開場白。',
  '请从中断的地方直接接着写完，不要重复前面已经写过的内容，也不要加开场白。',
  'Please continue exactly where you stopped and finish. Do not repeat anything already written and do not add an opening line.');

/* ---------- 朗讀：鎖屏顯示與防休眠 ---------- */
let wakeLock = null;
async function wlAcquire(){
  try{
    if (!navigator.wakeLock || wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  }catch(e){ wakeLock = null; }
}
function wlRelease(){ try{ if (wakeLock) wakeLock.release(); }catch(e){} wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && spk && spk.on && !spk.paused) wlAcquire();
});
let msInit = false;
function msSet(){
  if (!('mediaSession' in navigator)) return;
  try{
    const b = RD.book ? BOOK[RD.book] : null;
    const title = b ? bname(b) + (RD.flow ? '' : ' ' + RD.ch) : t().app;
    navigator.mediaSession.metadata = new MediaMetadata({
      title, artist: L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Online Fellowship'), album: t().app,
      artwork: [{ src:'icon-512.png', sizes:'512x512', type:'image/png' }] });
    if (!msInit){
      msInit = true;
      navigator.mediaSession.setActionHandler('play', () => { try{ ttsStart(); }catch(e){} });
      navigator.mediaSession.setActionHandler('pause', () => { try{ ttsPauseNow(); }catch(e){} });
      navigator.mediaSession.setActionHandler('stop', () => { try{ ttsStop(); }catch(e){} });
    }
    navigator.mediaSession.playbackState = 'playing';
  }catch(e){}
}
function ttsSys(st){
  if (st === 'playing' || st === 'loading'){ wlAcquire(); msSet(); }
  else if (st === 'paused'){
    wlRelease();
    try{ if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; }catch(e){}
  } else {
    wlRelease();
    try{ if ('mediaSession' in navigator){ navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; } }catch(e){}
  }
}

/* ---------- 朗讀：括號裡只有經文出處的整段不唸 ---------- */
let _refPartRe = null, _refPartLang = '';
function refPartRe(){
  if (_refPartRe && _refPartLang === state.lang) return _refPartRe;
  const ks = Object.keys(refTable().map).sort((a, b) => b.length - a.length)
               .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const nums = '\\d+(?:\\s*[:：]\\s*\\d+(?:\\s*[-–—~～至]\\s*\\d+)?)?';
  _refPartRe = new RegExp('^(?:' + (ks.length ? '(?:' + ks.join('|') + ')\\s*\\.?\\s*' + nums + '|' : '') + '\\d+\\s*[:：]\\s*\\d+(?:\\s*[-–—~～至]\\s*\\d+)?)$', 'i');
  _refPartLang = state.lang;
  return _refPartRe;
}
function dropRefParens(s){
  const re = refPartRe();
  return String(s || '').replace(/[（(]([^（）()]{1,80})[）)]/g, (m, inner) => {
    const x = inner.replace(/^\s*(?:另見|參看|參見|参看|参见|參|参|見|见|cf\.?|see)\s*/i, '').trim();
    if (!x) return m;
    const parts = x.split(/[；;、，,]/).map(p => p.trim()).filter(Boolean);
    return parts.length && parts.every(p => re.test(p)) ? '' : m;
  });
}

/* ---------- 祝福結尾只留「阿們」 ---------- */
/* 小智寫的祝福若以「阿們」收尾，一律寫成「阿們！」 */
function amenBang(s){
  return String(s || '').replace(/(阿們|阿们|Amen)\s*[。.！!]*\s*$/i, (m, a) => a + '！'.replace('！', /Amen/i.test(a) ? '!' : '！'));
}
function amenOnly(s){
  let x = String(s || '');
  x = x.replace(/[，,、]?\s*奉\s*(?:主\s*)?(?:耶穌|耶稣)\s*(?:基督\s*)?的\s*名\s*(?:禱告|祈禱|祈求|祷告|祈祷|求)\s*[，,]?\s*/g, m => /^[，,、]/.test(m) ? '。' : '');
  x = x.replace(/[,，]?\s*in\s+(?:the\s+name\s+of\s+)?(?:the\s+Lord\s+)?Jesus(?:\s+Christ)?(?:['’]s\s+name)?(?:\s+we\s+(?:pray|ask))?\s*[,，]?\s*/gi, ' ');
  return x.replace(/。。+/g, '。').replace(/\s{2,}/g, ' ').replace(/\s+([。！？.!?])/g, '$1').trim();
}

/* ---------- 小智回答說成自然口吻（朗讀用） ---------- */
function mdSpeak(md){
  const zh = !isEN(), ja = isJA(), idn = isID();
  const tbl = mdTableMap(String(md || ''), function (head, rows){
    const lead = L3('我們用一個對照來整理。', '我们用一个对照来整理。', 'Here is a quick comparison.');
    const body = rows.map((r, ri) => {
      const cells = r.map((c, j) => {
        const h = (head[j] || '').trim();
        if (!c) return '';
        return h ? (zh ? h + (ja ? 'は' : '是') + c : h + (idn ? ' adalah ' : ' is ') + c) : c;
      }).filter(Boolean).join(ja ? '、' : zh ? '，' : ', ');
      const pre = (rows.length > 1 && ri === rows.length - 1) ? (ja ? '最後に、' : zh ? '最後，' : idn ? 'Terakhir, ' : 'Finally, ') : '';
      return pre + cells + (zh ? '。' : '.');
    }).join('\n');
    return lead + '\n' + body;
  });
  const clean = s => mdStrip(String(s || '').replace(/&gt;/g, '>')).replace(/\s+/g, ' ').trim();
  const NUMS = '零一二三四五六七八九十';
  const blocks = [];
  tbl.split('\n').forEach(line => {
    const l = line.replace(/\s+$/, '');
    if (!l.trim()){ blocks.push({ k:'br' }); return; }
    let m;
    if ((m = l.match(/^\s*#{1,6}\s+(.*)$/))){ blocks.push({ k:'h', t:clean(m[1]) }); return; }
    if ((m = l.match(/^\s*(?:&gt;|>)\s?(.*)$/))){ blocks.push({ k:'q', t:clean(m[1]) }); return; }
    if (/^\s*---+\s*$/.test(l)){ blocks.push({ k:'br' }); return; }
    if ((m = l.match(/^\s*\*\*(\d{1,2})[.)、]\s*([^*]*)\*\*\s*(.*)$/))){
      blocks.push({ k:'li', num:+m[1], t:clean(m[2] + (m[3] ? '：' + m[3] : '')) }); return; }
    if ((m = l.match(/^\s*(?:[-*・•]\s+|(\d{1,2})[.)、]\s+|([一二三四五六七八九十])、|[（(]([一二三四五六七八九十])[）)]\s*)(.*)$/))){
      const num = m[1] ? +m[1] : ((m[2] || m[3]) ? NUMS.indexOf(m[2] || m[3]) : 0);
      const body = m[4], lb = body.match(/^\*\*([^*]+)\*\*\s*[:：]?\s*(.*)$/);
      blocks.push({ k:'li', num, lab: lb ? clean(lb[1]) : '', desc: lb ? clean(lb[2]) : '', t:clean(body) }); return; }
    blocks.push({ k:'p', t:clean(l) });
  });
  /* 分組：連續的條列算一組；有編號的清單中間夾說明段也算同一組 */
  let cur = null, gid = 0;
  const groups = [];
  blocks.forEach((b, bi) => {
    if (b.k === 'li'){
      if (!cur || (cur.numbered !== !!b.num)){ cur = { id:gid++, items:[], numbered:!!b.num, prev:'' }; groups.push(cur);
        for (let j = bi - 1; j >= 0 && j >= bi - 3; j--) if (blocks[j].k === 'p'){ cur.prev = blocks[j].t; break; } }
      cur.items.push(b); b.g = cur; b.gi = cur.items.length - 1;
    } else if (b.k === 'p'){ if (!(cur && cur.numbered)) cur = null; }
    else if (b.k !== 'br'){ cur = null; }
  });
  const isKW = /想更多|延伸|多想|再想|深思|もっと考え|さらに考え|思いを深め|think more|renungkan lebih|pikirkan lebih/i, isPR = /禱告|祷告|祈り|pray|berdoa|doa\b/i;
  const normalH = blocks.filter(b => b.k === 'h' && !isKW.test(b.t) && !isPR.test(b.t));
  let hn = 0, qn = 0;
  const startsLead = /^(首先|其次|另外|最後|最后|第[一二三四五六七八九十]|まず|次に|つぎに|最後に|さらに|pertama|kedua|ketiga|terakhir|selanjutnya|first|second|third|finally|next)/i;
  const scripture = t => /[「“”"]|\d+\s*[:：]\s*\d+/.test(t);
  const endP = s => { s = s.trim(); if (!s) return s; return zh ? (/[。！？：；，、」』）…]$/.test(s) ? s : s + '。') : (/[.!?:;,)"”]$/.test(s) ? s : s + '.'); };
  const modeOf = g => {
    const its = g.items, n = its.length;
    if (n === 1) return 'none';
    if (its.every(i => scripture(i.t))) return 'none';
    if (g.numbered) return 'num';
    if (/步驟|步骤|方法|做法|如何|幾個|几个|幾件事|几件事|手順|やり方|どうすれば|ステップ|langkah|cara|bagaimana|steps?|ways?|how to/i.test(g.prev)) return 'num';
    if (its.filter(i => i.lab).length * 2 > n) return 'label';
    if (its.every(i => (zh ? i.t.length <= 14 : i.t.length <= 28) && !/[，。；,;]/.test(i.t))) return 'short';
    return 'plain';
  };
  groups.forEach(g => { g.mode = modeOf(g); });
  const LEAD = idn
    ? { first:'Pertama, ', mid:['Selanjutnya, ', 'Lalu, '], last:'Terakhir, ', only2last:'Terakhir, ' }
    : ja
    ? { first:'まず、', mid:['次に、', 'また、'], last:'最後に、', only2last:'最後に、' }
    : zh
    ? { first:'首先，', mid:['另外，', '還有，'], last:'最後，', only2last:'最後，' }
    : { first:'First, ', mid:['Next, ', 'Also, '], last:'Finally, ', only2last:'Finally, ' };
  const out = [];
  blocks.forEach(b => {
    if (b.k === 'br') return;
    if (b.k === 'h'){
      if (isKW.test(b.t)) out.push(idn ? 'Jika Anda ingin merenungkannya lebih jauh, ada satu pemikiran.' : ja ? 'もう少し考えてみたい方へ、こんな見方もあります。' : zh ? '如果想更多一點，可以這樣想。' : 'If you want to think a little further, here is a thought.');
      else if (isPR.test(b.t)) out.push(idn ? 'Marilah kita berdoa bersama.' : ja ? 'いっしょに祈りましょう。' : zh ? '讓我們一起禱告。' : 'Let us pray together.');
      else {
        const n = normalH.length, i = hn++, t = b.t.replace(/^\d+[.)、]\s*/, '');
        if (idn){
          const w = n === 1 ? 'Mari kita bicarakan ' : (i === 0 ? 'Mari kita mulai dengan ' : ((n >= 3 && i === n - 1) ? 'Terakhir, ' : ['Selanjutnya, mari kita lihat ', 'Kemudian, ', 'Sekarang, '][(i - 1) % 3]));
          out.push(w + t + '.');
        } else if (ja){
          const w = n === 1 ? '' : (i === 0 ? 'まず、' : ((n >= 3 && i === n - 1) ? '最後に、' : ['次に、', 'つづいて、', 'さらに、'][(i - 1) % 3]));
          out.push(w + t + 'についてです。');
        } else if (zh){
          const w = n === 1 ? '我們來談' : (i === 0 ? '先談' : ((n >= 3 && i === n - 1) ? '最後談' : ['接下來談', '再來看', '我們再看'][(i - 1) % 3]));
          out.push(w + t + '。');
        } else {
          const w = n === 1 ? 'Let us talk about ' : (i === 0 ? 'Let us start with ' : ((n >= 3 && i === n - 1) ? 'Finally, ' : ['Next, let us look at ', 'Then, ', 'Now, '][(i - 1) % 3]));
          out.push(w + t + '.');
        }
      }
      return;
    }
    if (b.k === 'q'){
      const i = qn++;
      const lead = idn ? (i === 0 ? (scripture(b.t) ? 'Alkitab berkata: ' : 'Ada satu kalimat yang layak diingat: ') : 'Dan satu lagi: ') : ja ? (i === 0 ? (scripture(b.t) ? '聖書にはこうあります。' : '心に留めたい言葉があります。') : 'もうひとつ。') : zh ? (i === 0 ? (scripture(b.t) ? '聖經說：' : '有一句話特別要記住：') : '還有一句：')
                      : (i === 0 ? (scripture(b.t) ? 'The Bible says: ' : 'One line is worth remembering: ') : 'And another: ');
      out.push(lead + endP(b.t)); return;
    }
    if (b.k === 'li'){
      const g = b.g, n = g.items.length, i = b.gi;
      if (g.mode === 'short'){
        if (i > 0) return;
        const ts = g.items.map(x => x.t);
        out.push(endP(ts.length === 2 ? ts.join(ja ? 'と' : zh ? '和' : idn ? ' dan ' : ' and ') : ts.slice(0, -1).join(zh ? '、' : ', ') + (ja ? '、そして' : zh ? '，還有' : idn ? ', dan ' : ', and ') + ts[ts.length - 1]));
        return;
      }
      let lead = '', text = b.t;
      if (g.mode === 'num'){
        const k = b.num || (i + 1);
        lead = idn ? (['', 'Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima', 'Keenam', 'Ketujuh', 'Kedelapan', 'Kesembilan', 'Kesepuluh'][k] || 'Nomor ' + k) + ', ' : ja ? (k <= 10 ? NUMS.charAt(k) + 'つ目、' : k + '番目、') : zh ? '第' + (k <= 10 ? NUMS.charAt(k) : k) + '，' : (['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'][k] || 'Number ' + k) + ', ';
      } else if (g.mode === 'label'){
        if (b.lab){
          const w = idn ? (i === 0 ? 'Pertama adalah ' : (i === n - 1 ? 'Terakhir adalah ' : 'Lalu ')) : ja ? (i === 0 ? 'まずは' : (i === n - 1 ? '最後は' : '次は')) : zh ? (i === 0 ? '首先是' : (i === n - 1 ? '最後是' : '再來是')) : (i === 0 ? 'First is ' : (i === n - 1 ? 'Last is ' : 'Then '));
          out.push(w + b.lab + (b.desc ? (ja ? '、' : zh ? '，' : ', ') + endP(b.desc) : (zh ? '。' : '.'))); return;
        }
      } else if (g.mode === 'plain'){
        lead = i === 0 ? LEAD.first : (i === n - 1 ? LEAD.last : LEAD.mid[(i - 1) % 2]);
      }
      if (startsLead.test(text)) lead = '';
      out.push(lead + endP(text)); return;
    }
    out.push(endP(b.t));
  });
  return mdStrip(out.join('\n'));
}

/* ---------- 錄製：配樂結束一律淡出 5 秒 ---------- */
const BGM_FADEOUT = 5;
let curFade = null, recFading = false;
function fadeOutStop(g, ac, sec){
  if (recFading) return;
  if (!g || !ac){ if (mr && mr.state === 'recording') mr.stop(); return; }
  recFading = true;
  try{
    const t0 = ac.currentTime;
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t0);
    g.gain.linearRampToValueAtTime(0.0001, t0 + sec);
  }catch(e){}
  const st = $('#recSt');
  if (st) st.innerHTML = '<span class="recdot"></span>' + L3('音樂淡出中…（再按一次立即停止）', '音乐淡出中…（再按一次立即停止）', 'Music fading out… (tap again to stop now)');
  setTimeout(() => { if (mr && mr.state === 'recording') mr.stop(); }, sec * 1000 + 150);
}
/* 有配樂：第一次按「停止」先淡出；淡出中再按就立即停；沒有配樂就直接停 */
function recStopNow(){
  if (!(mr && mr.state === 'recording')) return;
  if (recFading || !curFade) mr.stop(); else curFade();
}

/* ================================================================ v2.13.0 音樂卡片背景製作
   配上音樂做卡片影片要等好幾分鐘（整首更久），不必盯著畫面：
   ・錄製是全域的，離開美圖頁（去讀經、問小智…）不會中斷，畫面下方有一條進度列，點一下回到美圖頁。
   ・做好時：人還在美圖頁 → 照舊跳預覽；人已離開（或 App 在背景）→ 自動存進「我的作品」，
     跳出提示、震動，有允許通知的話再發系統通知。
   ・畫面在背景時用計時器補畫，並要求螢幕不休眠；iPhone 離開 App 或鎖屏可能被系統暫停，所以提示「請留在 App 裡」。 */
let bgJob = null, mjDoneItem = null;
function mjAsk(){ try{ if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }catch(e){} }
function mjCss(){
  if ($('#mjcss')) return;
  const s = document.createElement('style'); s.id = 'mjcss';
  s.textContent = '.mjpill{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(128px + env(safe-area-inset-bottom));z-index:88;'
    + 'background:var(--accent,#123F92);color:#fff;padding:9px 16px;border-radius:999px;font-weight:600;font-size:13.5px;'
    + 'box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis;cursor:pointer}'
    + '.mjpill.done{background:#2E7D4F}';
  document.head.appendChild(s);
}
const mmss = n => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
const MJ_FADE = () => L3('音樂淡出中…（再按一次立即停止）', '音乐淡出中…（再按一次立即停止）', 'Music fading out… (tap again to stop now)');
function mjPill(){
  let d = $('#mjpill');
  const running = !!(bgJob && mr && mr.state === 'recording' && curTab() !== 'studio');
  const done = !running && !!mjDoneItem;
  if (!running && !done){ if (d) d.remove(); return; }
  mjCss();
  if (!d){ d = document.createElement('div'); d.id = 'mjpill'; d.onclick = mjPillGo; document.body.appendChild(d); }
  if (running){
    d.className = 'mjpill';
    d.textContent = '🎵 ' + (recFading ? L3('音樂淡出中…', '音乐淡出中…', 'Fading out…') : t().mcing) + ' ' + mmss(recSec) + '　›';
  } else {
    d.className = 'mjpill done';
    d.textContent = '✓ ' + L3('音樂卡片完成了，已存入「我的作品」，點此查看', '音乐卡片完成了，已存入“我的作品”，点此查看', 'Your music card is ready and saved to My works — tap to view');
  }
}
function mjPillGo(){
  const it = (bgJob && bgJob.item) || mjDoneItem;
  if (it) studioItem = it;
  mjDoneItem = null; mjPill(); go('#/studio');
}
/* 回到美圖頁時，把「製作中」的狀態與按鈕接回來 */
function mjRestore(){
  if (!(bgJob && mr && mr.state === 'recording')) return;
  const st = $('#recSt');
  if (st) st.innerHTML = '<span class="recdot"></span>' + (recFading ? MJ_FADE() : t().mcing + '　♪');
  const tm = $('#recTm'); if (tm) tm.textContent = mmss(recSec);
  const bt = $('#mcBtn'); if (bt){ bt.textContent = t().recStop; bt.classList.add('danger'); }
}
function mjNotify(ok){
  const title = L3('音樂卡片完成了 🎵', '音乐卡片完成了 🎵', 'Your music card is ready 🎵');
  const body = ok ? L3('已存進「我的作品」，點一下回來看看。', '已存进“我的作品”，点一下回来看看。', 'Saved to My works — tap to take a look.')
                  : L3('存檔失敗，請回到 App 看一下。', '存档失败，请回到 App 看一下。', 'Saving failed — please open the app.');
  try{ if (navigator.vibrate) navigator.vibrate([120, 80, 120]); }catch(e){}
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted'){
    try{
      if (swReg && swReg.showNotification) swReg.showNotification(title, { body, icon:'icon-192.png', badge:'icon-96.png', tag:'mjob' });
      else new Notification(title, { body, icon:'icon-192.png' });
    }catch(e){}
  }
}
async function mjFinish(blob, type, item){
  const away = curTab() !== 'studio' || document.hidden;
  bgJob = null;
  if (!away){ mjPill(); await finishRec(blob, type, 'video'); return; }
  mr = null;
  const dur = recSec;
  try{ blob = await fixVideoBlob(blob, type); }catch(e){ console.error('fix', e); }
  const ok = await saveWork(blob, blob.type || type, 'video', dur, item);
  mjDoneItem = ok ? item : null;
  mjPill();
  mjNotify(ok);
}

/* ================================================================ 自動更新
   發佈新版後，已安裝的舊版（含主畫面 PWA）要自動換成新版，靠三道保險：
   ① version.json 輪詢：開 App 後 2.5 秒、每 30 分鐘、回到前景、從 bfcache 回來、恢復連線時，
      讀一次 version.json（帶時間戳、不快取），版本和 VERSION 不同就是有新版。
   ② Service Worker 更新：register 用 updateViaCache:'none'，每次檢查也呼叫 reg.update()。
   ③ 新 SW 啟用時通知所有視窗，背景中的頁面直接被帶到新版（見 sw.js）。
   朗讀、錄影、小智回答中、打字中、讀經樂進行中都不打斷：只顯示更新條，空閒後自動套用。
   同一個新版只自動重整一次；第二次改硬更新（清快取）；硬更新過還是舊版就只留更新條。 */
let swReg = null, updReady = false;
const UPD = { target:'', pending:false };
function ssGet(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
function ssSet(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} }
function updBusy(){
  if (spk && spk.on) return true;
  if (mr && mr.state === 'recording') return true;
  if (chatBusy || blessBusy) return true;
  if (PL) return true;
  const ae = document.activeElement;
  if (ae && /^(TEXTAREA|INPUT)$/.test(ae.tagName) && ae.value) return true;
  if (document.querySelector('.hlsheet-mask, .rw-mask')) return true;
  return false;
}
function updBar(show){
  let d = $('#updbar');
  if (show){
    if (!d){
      d = document.createElement('div'); d.id = 'updbar'; d.className = 'updbar';
      d.onclick = () => applyUpdate(ssGet('updTry') === UPD.target);
      document.body.appendChild(d);
    }
    d.textContent = t().updReadyBar;
  } else if (d) d.remove();
}
function reloadFresh(){
  if (window.__reloading) return;
  window.__reloading = true;
  location.replace(location.pathname + '?u=' + Date.now() + location.hash);
}
function applyUpdate(hard){
  hard = (hard === true);
  UPD.pending = false; updBar(false); toast(t().updApplying);
  (async () => {
    /* 先要求瀏覽器重新下載主要檔案、換掉 HTTP 快取裡的舊檔，免得重整後又讀到舊的 app.js */
    try{ await Promise.all(['app.js', 'index.html', 'sw.js'].map(f => fetch(f, { cache:'reload' }).catch(() => {}))); }catch(e){}
    try{
      if (hard){
        if ('caches' in window){ const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
        if (navigator.serviceWorker){ const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); }
      } else if (swReg){
        try{ if (swReg.waiting) swReg.waiting.postMessage('skip'); }catch(e){}
        try{ await swReg.update(); }catch(e){}
      }
    }catch(e){}
    setTimeout(reloadFresh, hard ? 100 : 900);
  })();
}
function onNewVersion(v){
  updReady = true; UPD.target = v; UPD.pending = true;
  updBar(true);
  updIdle();
}
/* 空閒時才套用；防無限重整：第一次一般更新，第二次硬更新，硬更新過還是舊版就只顯示更新條 */
function updIdle(){
  if (!UPD.pending || updBusy()) return;
  const v = UPD.target;
  if (ssGet('updHard') === v) return;
  if (ssGet('updTry') === v){ ssSet('updHard', v); applyUpdate(true); }
  else { ssSet('updTry', v); applyUpdate(false); }
}
/* 回傳 true＝有新版、false＝已是最新、null＝讀不到 version.json（離線或沒上傳） */
async function checkVersion(){
  try{
    const r = await fetch('version.json?t=' + Date.now(), { cache:'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    if (d && d.v && d.v !== VERSION){ onNewVersion(d.v); return true; }
    return false;
  }catch(e){ return null; }
}
function watchForUpdate(reg){
  const track = w => { if (w) w.addEventListener('statechange', () => {
    if (w.state === 'installed' && navigator.serviceWorker.controller){
      checkVersion().then(r => { if (!r && !UPD.pending){ onNewVersion(UPD.target || 'sw'); } });
    }
  }); };
  track(reg.installing); track(reg.waiting);
  reg.addEventListener('updatefound', () => track(reg.installing));
}
async function checkForUpdate(manual){
  const out = manual ? $('#updOut') : null;
  if (out) out.textContent = t().updChecking;
  const r = await checkVersion();
  if (swReg){ try{ await swReg.update(); }catch(e){} }
  if (manual){
    await new Promise(rs => setTimeout(rs, 400));   // 讓 statechange 有時間跑完
    const has = r === true || updReady;
    if (out) out.textContent = has ? t().updFound : (r === null && !swReg ? t().updFail : t().updLatest);
    if (!has) toast(r === null && !swReg ? t().updFail : t().updLatest);
  }
}

/* ================================================================ 啟動 */
/* ===== 嵌入模式：國度321空中團契等 App 用 iframe 開「經文美圖工作室」（?embed=studio，iframe name=k321studio） =====
   ‧ 外層 App 先把 {ts,item:{t,ref,n},lang} 存進 localStorage['ib_card_in']（同一個網域），再開這一頁
   ‧ 只顯示美圖工作室：隱藏頂列、分頁列、導覽鈕；「‹」或離開工作室 → postMessage 通知外層關閉 */
const EMBED = (() => { try{ return new URLSearchParams(location.search).get('embed') === 'studio' || window.name === 'k321studio'; }catch(e){ return false; } })();
const EMB_T = () => L3('經文／金句', '经文／金句', 'Verse / quote');
function embedClose(){ try{ parent.postMessage({ k321:'studioClose' }, '*'); }catch(e){} }
function embedBoot(){
  if (!EMBED) return false;
  try{ window.name = 'k321studio'; }catch(e){}
  document.documentElement.classList.add('embed');
  const st = document.createElement('style');
  st.textContent = '.embed header.topbar,.embed nav.tabbar,.embed .gnavb,.embed #langswitch{display:none!important}'
    + '.embed body{padding-bottom:env(safe-area-inset-bottom)!important}.embed main#view{padding-top:8px;padding-bottom:40px}'
    + '.embed .chtoolbar{top:0!important}';
  document.head.appendChild(st);
  let o = null; try{ o = JSON.parse(localStorage.getItem('ib_card_in') || 'null'); }catch(e){}
  if (o && o.item){
    const it = o.item;
    studioItem = { b:'', ch:0, v:0, t:String(it.t || ''), ref:String(it.ref || ''), n:String(it.n || ''), x:1 };
    studioNote = studioItem.n; fullBless = ''; blessOwn = '';
    if (['zh', 'zs', 'en', 'ko', 'ja', 'id'].includes(o.lang) && state.lang !== o.lang){ state.lang = o.lang; saveState(); applyChrome(); }
  }
  /* 外層換了文字來源（經文／亮光／宣告…）就直接換，不重新載入 */
  window.addEventListener('message', e => {
    const d = e.data; if (!d || d.k321 !== 'studioItem' || !d.item || e.origin !== location.origin) return;
    studioItem = { b:'', ch:0, v:0, t:String(d.item.t || ''), ref:String(d.item.ref || ''), n:String(d.item.n || ''), x:1 };
    studioNote = studioItem.n; fullBless = '';
    if (curTab() === 'studio') studioRefresh();
  });
  location.hash = '#/studio';
  return true;
}
const CR_TX = {"zh":{"crTitle":"一起共讀","crCopyB":"複製連結","crTile_d":"帶領或加入：讓大家的手機跟著同一章、同一節走","crHostB":"我來帶領共讀","crHostD":"大家的手機會跟著我翻到同一章、捲到同一處、看我點的那一節、聽我朗讀到哪裡","crJoinB":"加入共讀","crJoinD":"輸入帶領者給你的6碼代碼（或直接點他傳來的連結、掃 QR）","crCodePh":"6碼代碼","crJoinGo":"加入","crNamePh":"你的稱呼（讓帶領者知道你來了）","crBadCode":"請輸入6碼共讀代碼","crStarting":"正在建立共讀…","crJoining":"正在加入共讀…","crCode":"共讀代碼","crScan":"請對方用手機相機掃描 QR，或在閱讀頁按 📡 輸入代碼","crShareLink":"傳送邀請連結","crInviteMsg":"邀請你和我一起用《321互動聖經》共讀，點下面的連結就能加入（共讀代碼 {0}）：","crMembers":"已加入 {0} 人","crNone":"還沒有人加入，把連結或 QR 給大家吧","crEnd":"結束共讀","crLeaveB":"離開","crInv":"邀請","crHostBar":"帶領共讀 {0}","crGuestBar":"跟著 {0} 共讀","crWait":"正在連線共讀…","crOff":"目前不在閱讀頁","crFollow":"回到帶領者","crFree":"自己瀏覽一下","crFollowB":"自己瀏覽一下","crFreeB":"回到帶領者","crFollowOn":"跟著帶領者走","crFreeOn":"你可以自己瀏覽，按「回到帶領者」即可跳回","crJoined":"{0} 加入了共讀","crLeft":"{0} 離開了共讀","crEnded":"帶領者已結束共讀，願主祝福你！","crNoRoom":"找不到這個共讀，請確認代碼，或請帶領者重新開始","crLostT":"共讀連線中斷了，可以重新加入","crLibErr":"共讀元件載入失敗，請檢查網路後再試","crSent":"已送給帶領者","crAway":"帶領者在其他頁面","crGuest":"朋友","crLeader":"帶領者","crCopied":"已複製連結","crNoShare":"這台裝置不支援分享","crGuestTip":"你可以隨時「自己瀏覽一下」，再按「回到帶領者」就會跳回帶領者所在的地方。你的畫線與書籤只存在自己的手機。","crTip":"大家進入共讀後，帶領者翻到哪一章、捲到哪一段、點哪一節、朗讀到哪裡，所有人的手機都會一起跟著走；每個人看到的是自己設定的語言與字級（帶領者看繁體、你看英文，也會是同一章同一節）。想投影到電視，可用手機的螢幕鏡像（AirPlay／Chromecast）。"},"zs":{"crTitle":"一起共读","crCopyB":"复制连结","crTile_d":"带领或加入：让大家的手机跟着同一章、同一节走","crHostB":"我来带领共读","crHostD":"大家的手机会跟着我翻到同一章、卷到同一处、看我点的那一节、听我朗读到哪里","crJoinB":"加入共读","crJoinD":"输入带领者给你的6码代码（或直接点他传来的连结、扫 QR）","crCodePh":"6码代码","crJoinGo":"加入","crNamePh":"你的称呼（让带领者知道你来了）","crBadCode":"请输入6码共读代码","crStarting":"正在建立共读…","crJoining":"正在加入共读…","crCode":"共读代码","crScan":"请对方用手机相机扫描 QR，或在阅读页按 📡 输入代码","crShareLink":"传送邀请连结","crInviteMsg":"邀请你和我一起用《321互动圣经》共读，点下面的连结就能加入（共读代码 {0}）：","crMembers":"已加入 {0} 人","crNone":"还没有人加入，把连结或 QR 给大家吧","crEnd":"结束共读","crLeaveB":"离开","crInv":"邀请","crHostBar":"带领共读 {0}","crGuestBar":"跟着 {0} 共读","crWait":"正在连线共读…","crOff":"目前不在阅读页","crFollow":"回到带领者","crFree":"自己浏览一下","crFollowB":"自己浏览一下","crFreeB":"回到带领者","crFollowOn":"跟着带领者走","crFreeOn":"你可以自己浏览，按「回到带领者」即可跳回","crJoined":"{0} 加入了共读","crLeft":"{0} 离开了共读","crEnded":"带领者已结束共读，愿主祝福你！","crNoRoom":"找不到这个共读，请确认代码，或请带领者重新开始","crLostT":"共读连线中断了，可以重新加入","crLibErr":"共读元件载入失败，请检查网路后再试","crSent":"已送给带领者","crAway":"带领者在其他页面","crGuest":"朋友","crLeader":"带领者","crCopied":"已复制连结","crNoShare":"这台装置不支援分享","crGuestTip":"你可以随时「自己浏览一下」，再按「回到带领者」就会跳回带领者所在的地方。你的画线与书签只存在自己的手机。","crTip":"大家进入共读后，带领者翻到哪一章、卷到哪一段、点哪一节、朗读到哪里，所有人的手机都会一起跟着走；每个人看到的是自己设定的语言与字级（带领者看繁体、你看英文，也会是同一章同一节）。想投影到电视，可用手机的荧幕镜像（AirPlay／Chromecast）。"},"en":{"crTitle":"Read Together","crCopyB":"Copy link","crTile_d":"Lead or join: everyone’s phone follows the same chapter and verse","crHostB":"I’ll lead","crHostD":"Everyone’s phone follows me to the same chapter, scroll position, the verse I tap and where read-aloud is","crJoinB":"Join","crJoinD":"Enter the leader’s 6-character code (or tap their link / scan the QR)","crCodePh":"6-character code","crJoinGo":"Join","crNamePh":"Your name (so the leader knows you’re here)","crBadCode":"Please enter the 6-character code","crStarting":"Starting Read Together…","crJoining":"Joining…","crCode":"Code","crScan":"Ask them to scan the QR with a phone camera, or tap 📡 on the reading page and enter the code","crShareLink":"Send invite link","crInviteMsg":"I invite you to read together with me in 321 Interactive Bible. Tap the link below to join (code {0}):","crMembers":"{0} joined","crNone":"No one yet—share the link or QR","crEnd":"End","crLeaveB":"Leave","crInv":"Invite","crHostBar":"Leading {0}","crGuestBar":"Following {0}","crWait":"Connecting…","crOff":"not on a reading page","crFollow":"Back to leader","crFree":"Browse on my own","crFollowB":"Browse on my own","crFreeB":"Back to leader","crFollowOn":"Following the leader","crFreeOn":"You can browse freely—tap “Back to leader” to jump back","crJoined":"{0} joined","crLeft":"{0} left","crEnded":"The leader ended Read Together. God bless you!","crNoRoom":"Couldn’t find this session. Check the code, or ask the leader to start again","crLostT":"Connection lost—you can join again","crLibErr":"Couldn’t load the Read Together component—check your connection","crSent":"Sent to the leader","crAway":"leader is on another page","crGuest":"Friend","crLeader":"Leader","crCopied":"Link copied","crNoShare":"Sharing is not available here","crGuestTip":"You can “Browse on my own” anytime, then tap “Back to leader” to jump to where the leader is. Your highlights and bookmarks stay on your own phone.","crTip":"Once everyone joins, wherever the leader goes—which chapter, scroll position, tapped verse, read-aloud—every phone follows, in each person’s own language and text size (the leader on Traditional Chinese and you on English still see the same chapter and verse). To show it on a TV, use your phone’s screen mirroring (AirPlay / Chromecast)."}};
/* ================================================================ 一起共讀（帶領者的閱讀畫面同步到大家的手機）
   傳輸：PeerJS／WebRTC 點對點，沒有自己的伺服器；帶領者的手機就是房間主機（Peer id = bb321-代碼）。
   協定與《321真理點心》《321舊約導讀》同一套：st（頁面）／pos（捲動）／mk（點的那一句或朗讀到的那一句）／re（🙏🙋）／end。
   定位用「章＋節＋該節第幾句」，所以帶領者看繁體、你看英文，也會對到同一章同一節。 */
const CR = { role:'', code:'', peer:null, conns:[], conn:null, host:'', n:0, follow:true, last:{}, tries:0, scrollT:0, stT:0, away:false, hostPage:null };
const CR_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', CR_PFX = 'bb321-';
const CR_JOIN = ((location.search.match(/[?&]join=([A-Za-z0-9]{6})/) || [])[1] || '').toUpperCase();
if (CR_JOIN){ try{ history.replaceState(null, '', location.pathname + location.hash); }catch(e){} }
(function(){
  const st = document.createElement('style'); st.id = 'crcss';
  st.textContent = '.crbar{position:fixed;left:0;right:0;top:0;z-index:60;display:flex;align-items:center;gap:6px;padding:calc(6px + env(safe-area-inset-top)) 10px 6px;background:linear-gradient(90deg,#14336F,#6C4BA3);color:#fff;font-size:12.5px;line-height:1.4;box-shadow:0 2px 10px rgba(0,0,0,.2)}'
    + '.crbar .crt{flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;cursor:pointer}'
    + '.crbar button{flex:0 0 auto;border:0;border-radius:999px;background:rgba(255,255,255,.18);color:#fff;padding:5px 9px;font:inherit;font-weight:600;cursor:pointer}'
    + 'body.crOn{padding-top:calc(34px + env(safe-area-inset-top))}body.crOn header.topbar{top:calc(34px + env(safe-area-inset-top))}'
    + 'body.crOn .chtoolbar{top:calc(var(--header-h,56px) + 34px + env(safe-area-inset-top))}'
    + '.chtb-btn.crlive{background:#6C4BA3;border-color:#6C4BA3;color:#fff}'
    + '.cr-pt{box-shadow:inset 0 0 0 999px rgba(108,75,163,.2);outline:2px solid rgba(108,75,163,.6);border-radius:4px;animation:crp 1.6s ease-out 1}'
    + '@keyframes crp{0%{outline-color:rgba(108,75,163,1);outline-width:5px}100%{outline-color:rgba(108,75,163,.6);outline-width:2px}}'
    + '.crqr{display:flex;justify-content:center}.crqr svg{width:200px;height:200px;max-width:70vw;background:#fff;border-radius:12px}'
    + '.crcode{font-size:2em;font-weight:800;letter-spacing:.25em;color:var(--accent);font-family:ui-monospace,Menlo,monospace}'
    + '.crsheet .opt{display:flex;flex-direction:column;gap:4px;width:100%;text-align:left;border:1px solid var(--border);background:var(--surface);border-radius:14px;padding:14px;margin-bottom:10px;color:var(--ink);font:inherit;box-sizing:border-box}'
    + '.crsheet.c{text-align:center}.crsheet .h2{font-size:1.15em;font-weight:800;color:var(--ink);margin:0 0 4px}.crsheet .sm{font-size:.88em;color:var(--ink-soft);margin:0 0 12px}'
    + '.crsheet .xs{font-size:.8em;color:var(--ink-soft);overflow-wrap:anywhere}.crsheet .full{width:100%}'
    + '.crsheet .pill{display:inline-block;background:var(--surface-alt);border-radius:999px;padding:3px 10px;margin:2px;font-size:.85em}'
    + '.crsheet input[type=text]{border:1px solid var(--border-strong);background:var(--surface-alt);border-radius:12px;padding:11px 12px;font:inherit;color:var(--ink);width:100%;box-sizing:border-box}'
    + '.crsheet .row{display:flex;align-items:center}.crsheet .grow{flex:1 1 0;min-width:0}.crsheet .eyebrow{font-size:.8em;color:var(--ink-faint);margin:8px 0 0}'
    + '.crsheet .btn{white-space:normal;line-height:1.35}';
  document.head.appendChild(st);
})();
function CRT(k){
  let s = (CR_TX[state.lang] || (isX() ? CR_TX.en : CR_TX.zh))[k]; if (s == null) s = CR_TX.zh[k] || k;
  for (let i = 1; i < arguments.length; i++) s = s.replace('{' + (i - 1) + '}', arguments[i]);
  return s;
}
function crLoad(src, test, cb){
  if (test()) return cb();
  const s = document.createElement('script'); s.src = src + '?v=' + VERSION;
  s.onload = () => { if (test()) cb(); else toast(CRT('crLibErr')); };
  s.onerror = () => toast(CRT('crLibErr'));
  document.body.appendChild(s);
}
function crOpt(){ return window.CR_PEER_OPT || { debug:0, config:{ iceServers:[{ urls:'stun:stun.l.google.com:19302' }, { urls:'stun:stun1.l.google.com:19302' }, { urls:'stun:stun.cloudflare.com:3478' }] } }; }
function crGen(){ let c = ''; for (let i = 0; i < 6; i++) c += CR_CH.charAt(Math.floor(Math.random() * CR_CH.length)); return c; }
function crUrl(){ return location.origin + location.pathname.replace(/index\.html$/, '') + '?join=' + CR.code; }
function crMe(){ return String(state.crName || '').trim() || CRT(CR.role === 'host' ? 'crLeader' : 'crGuest'); }
function crSheet(html){
  crSheetClose();
  const m = document.createElement('div'); m.className = 'hlsheet-mask crmask';
  m.innerHTML = '<div class="hlsheet-card">' + html + '</div>';
  m.onclick = e => { if (e.target === m) m.remove(); };
  document.body.appendChild(m); return m;
}
function crSheetClose(){ $$('.crmask').forEach(e => e.remove()); }
function crBtn(){ return `<button class="chtb-btn${CR.role ? ' crlive' : ''}" id="rdCr" title="${esc(CRT('crTitle'))}" aria-label="${esc(CRT('crTitle'))}" onclick="crMenu()">📡</button>`; }
function crMenu(){
  if (CR.role) return crPanel();
  crSheet('<div class="crsheet"><p class="h2">📡 ' + esc(CRT('crTitle')) + '</p><p class="sm">' + esc(CRT('crTip')) + '</p>'
    + '<button class="opt" id="crHostBtn"><b>' + esc(CRT('crHostB')) + '</b><span class="xs">' + esc(CRT('crHostD')) + '</span></button>'
    + '<div class="opt"><b>' + esc(CRT('crJoinB')) + '</b><span class="xs">' + esc(CRT('crJoinD')) + '</span>'
    + '<div class="row" style="gap:8px;margin-top:8px"><input type="text" id="crc" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="' + esc(CRT('crCodePh')) + '" style="flex:1 1 0;width:0;min-width:0;text-transform:uppercase;letter-spacing:.2em"><button class="btn primary" id="crJoinBtn" style="flex:0 0 auto">' + esc(CRT('crJoinGo')) + '</button></div>'
    + '<input type="text" id="crn" maxlength="20" placeholder="' + esc(CRT('crNamePh')) + '" value="' + esc(state.crName || '') + '" style="margin-top:8px"></div>'
    + '<button class="btn full" id="crCloseBtn">' + esc(t().close) + '</button></div>');
  $('#crHostBtn').onclick = () => { crSheetClose(); crHost(); };
  $('#crJoinBtn').onclick = crJoinUi;
  $('#crCloseBtn').onclick = crSheetClose;
  $('#crc').onkeydown = e => { if (e.key === 'Enter') crJoinUi(); };
}
function crJoinUi(){
  const n = String(($('#crn') || {}).value || '').trim();
  if (n){ state.crName = n.slice(0, 20); saveState(); }
  const c = ($('#crc') || {}).value || '';
  crSheetClose(); crJoin(c);
}
function crHost(code){
  crLoad('peerjs.min.js', () => !!window.Peer, () => {
    crKill(); CR.role = 'host'; CR.code = code || crGen(); CR.conns = []; toast(CRT('crStarting'));
    const p = new Peer(CR_PFX + CR.code, crOpt()); CR.peer = p;
    p.on('open', () => { CR.tries = 0; crBar(); crPanel(); });
    p.on('connection', c => {
      c.on('open', () => { CR.conns.push(c); crBar(); });
      c.on('data', d => crHostData(c, d));
      c.on('close', () => crDrop(c)); c.on('error', () => crDrop(c));
    });
    p.on('disconnected', () => { if (CR.role === 'host' && CR.peer === p){ try{ p.reconnect(); }catch(e){} } });
    p.on('error', e => {
      if (e && e.type === 'unavailable-id' && !code){ crHost(); return; }
      if (e && e.type === 'unavailable-id'){ if (CR.tries++ < 5) setTimeout(() => { if (CR.role === 'host') crHost(CR.code); }, 3000); return; }
      crErr(e);
    });
  });
}
function crHostData(c, d){
  if (!d || !d.t) return;
  if (d.t === 'hi'){ c._nm = String(d.name || CRT('crGuest')).slice(0, 20); toast(CRT('crJoined', c._nm)); crSend(c, crState()); crBar(); if ($('.crmask .crhp')) crPanel(); }
  else if (d.t === 're') toast((c._nm || '') + ' ' + String(d.e || '').slice(0, 4));
}
function crDrop(c){
  const a = CR.conns.filter(x => x !== c);
  if (a.length !== CR.conns.length && c._nm) toast(CRT('crLeft', c._nm));
  CR.conns = a; crBar(); if ($('.crmask .crhp')) crPanel();
}
function crSend(c, m){ try{ if (c && c.open) c.send(m); }catch(e){} }
function crCast(m){ if (CR.role !== 'host') return; CR.conns.forEach(c => crSend(c, m)); }
function crPage(){ return crTab() === 'read' && typeof RD !== 'undefined' && RD && RD.book ? { b:RD.book, c:RD.ch } : null; }
function crState(){ return { t:'st', page:crPage(), name:crMe(), n:CR.conns.length + 1, pos:CR.last.pos || null, mk:CR.last.mk || null }; }
function crJoin(code){
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (code.length < 6) return toast(CRT('crBadCode'));
  crLoad('peerjs.min.js', () => !!window.Peer, () => {
    crKill(); CR.role = 'guest'; CR.code = code; CR.follow = true; CR.tries = 0; CR.hostPage = null; toast(CRT('crJoining')); crConnect(); crBar();
  });
}
function crConnect(){
  if (CR.peer){ try{ CR.peer.destroy(); }catch(e){} }
  const p = new Peer(crOpt()); CR.peer = p; CR.host = '';
  p.on('open', () => {
    const c = p.connect(CR_PFX + CR.code, { reliable:true }); CR.conn = c;
    const to = setTimeout(() => { if (CR.role === 'guest' && !CR.host) crLost(); }, 15000);
    c.on('open', () => crSend(c, { t:'hi', name:crMe() }));
    c.on('data', d => { clearTimeout(to); CR.tries = 0; crGuestData(d); });
    c.on('close', () => { if (CR.role === 'guest' && CR.peer === p) crLost(); });
    c.on('error', () => { if (CR.role === 'guest' && CR.peer === p) crLost(); });
  });
  p.on('error', e => {
    if (CR.peer !== p) return;
    if (e && e.type === 'peer-unavailable'){ if (CR.tries === 0 && !CR.host){ toast(CRT('crNoRoom')); crLeave(); } else crLost(); return; }
    crLost();
  });
}
function crErr(e){ toast(CRT('crLostT')); crLeave(); }
function crLost(){
  CR.host = ''; crBar(); if (CR.role !== 'guest') return;
  if (CR.tries++ < 6) setTimeout(() => { if (CR.role === 'guest') crConnect(); }, 1500 * CR.tries);
  else { toast(CRT('crLostT')); crLeave(); }
}
function crGuestData(d){
  if (!d || !d.t) return;
  if (d.t === 'end'){ toast(CRT('crEnded')); crLeave(); return; }
  if (d.t === 'st'){
    CR.host = String(d.name || CRT('crLeader')).slice(0, 20); CR.n = d.n || 0; CR.away = !d.page;
    if (d.page) CR.hostPage = d.page;
    if (d.pos) CR.last.pos = d.pos; if (d.mk) CR.last.mk = d.mk;
    crBar();
    if (CR.follow && d.page) crGo(d.page); else crApply();
    return;
  }
  if (d.t === 'pos'){
    CR.last.pos = d; if (!CR.follow) return;
    if (d.b && d.c && crNeedNav({ b:d.b, c:d.c })){ CR.hostPage = { b:d.b, c:d.c }; crGo(CR.hostPage, true); } else crScroll(d);
    return;
  }
  if (d.t === 'mk'){
    CR.last.mk = d; if (!CR.follow) return;
    if (d.b && d.c && crNeedNav({ b:d.b, c:d.c })){ CR.hostPage = { b:d.b, c:d.c }; crGo(CR.hostPage, true); } else crMark(d, 1);
  }
}
/* 我這邊要不要換頁才看得到帶領者所在的章：整卷連讀模式整卷都在畫面上，同一卷就不必換 */
function crNeedNav(pg){
  if (!pg || crTab() !== 'read' || typeof RD === 'undefined' || !RD) return true;
  if (RD.book !== pg.b) return true;
  return !state.flow && RD.ch !== pg.c;
}
function crGo(pg, keep){
  if (!crNeedNav(pg)){ crApply(); return; }
  if (!keep){ CR.last.pos = null; CR.last.mk = null; }
  ttsStop(); go(`#/read/${pg.b}/${pg.c}`);
}
/* ---- 定位：章＋節＋該節第幾句（同語系用原本的段落／句序，不同語系靠節號對齊） ---- */
const crGrp = lg => lg === 'en' ? 'en' : (lg === 'ko' ? 'ko' : (lg === 'ja' ? 'ja' : (lg === 'id' ? 'id' : 'zh')));
function crWhere(el){
  const c = +el.dataset.c, v = +el.dataset.v || 0;
  const same = v ? $$('#reader .sent').filter(e => +e.dataset.c === c && (+e.dataset.v || 0) === v) : [el];
  return { b:RD.book, c, p:+el.dataset.p, s:+el.dataset.s, v, vi:Math.max(0, same.indexOf(el)), vk:same.length, lg:state.lang };
}
function crFindSent(d){
  if (!d || !d.c) return null;
  const cs = $$('#reader .sent').filter(e => +e.dataset.c === +d.c);
  if (!cs.length) return null;
  if (crGrp(d.lg) === crGrp(state.lang)){
    const e = cs.find(x => +x.dataset.p === +d.p && +x.dataset.s === +d.s); if (e) return e;
  }
  if (d.v){
    const vs = cs.filter(x => (+x.dataset.v || 0) === +d.v);
    if (vs.length){ const k = d.vk > 1 ? Math.round(d.vi / (d.vk - 1) * (vs.length - 1)) : 0; return vs[Math.min(Math.max(k, 0), vs.length - 1)]; }
  }
  return cs.find(x => +x.dataset.p === +d.p) || cs[0];
}
function crScroll(d){
  if (Date.now() - raManualAt < 5000) return;
  if (d.top0){ scrollToTop(); return; }
  const el = crFindSent(d); if (!el) return;
  el.style.scrollMarginTop = '150px';
  try{ el.scrollIntoView({ behavior:'smooth', block:'start' }); }catch(e){ el.scrollIntoView(); }
  setTimeout(() => { el.style.scrollMarginTop = ''; }, 1500);
}
function crClearMk(){ $$('.cr-pt').forEach(e => e.classList.remove('cr-pt')); }
function crMark(d, move){
  crClearMk();
  const el = crFindSent(d); if (!el) return;
  el.classList.add('cr-pt');
  if (move && Date.now() - raManualAt > 5000){ try{ el.scrollIntoView({ behavior:'smooth', block:'center' }); }catch(e){} }
}
function crApply(){
  if (CR.role !== 'guest' || !CR.follow) return;
  setTimeout(() => { if (crTab() !== 'read') return; if (CR.last.pos) crScroll(CR.last.pos); if (CR.last.mk) crMark(CR.last.mk, 0); }, 150);
}
/* render() 每次畫完都會呼叫：帶領者把新頁面廣播出去，跟隨者把位置與標記套回來 */
function crAfter(){
  if (CR.role === 'host'){ clearTimeout(CR.stT); CR.stT = setTimeout(() => { CR.last.pos = null; CR.last.mk = null; crCast(crState()); }, 150); }
  else if (CR.role === 'guest') crApply();
  crBar();
}
function crTab(){ return currentRoute()[0] || 'today'; }
function crTopSent(){
  const hd = $('header.topbar'), th = (hd ? hd.offsetHeight : 56) + 58 + (CR.role ? 34 : 0);
  return $$('#reader .sent').find(e => e.getBoundingClientRect().bottom > th) || null;
}
function crSendPos(){
  if (CR.role !== 'host' || !CR.conns.length || crTab() !== 'read' || !$('#reader')) return;
  const y = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  if (y < 12){ CR.last.pos = { t:'pos', top0:1, b:RD.book, c:state.flow ? 1 : RD.ch }; crCast(CR.last.pos); return; }
  const e = crTopSent(); if (!e) return;
  CR.last.pos = Object.assign({ t:'pos' }, crWhere(e)); crCast(CR.last.pos);
}
window.addEventListener('scroll', () => {
  if (CR.role !== 'host' || !CR.conns.length) return;
  clearTimeout(CR.scrollT); CR.scrollT = setTimeout(crSendPos, 220);
}, { passive:true, capture:true });
function crMk(el, k){
  if (CR.role !== 'host' || !CR.conns.length || !el || !el.dataset || el.dataset.s == null || crTab() !== 'read') return;
  const m = Object.assign({ t:'mk', k }, crWhere(el)); CR.last.mk = m; crCast(m);
}
function crPoint(el){ try{ crMk(el, 'pt'); }catch(e){} }
function crTts(el){ try{ crMk(el, 'tts'); }catch(e){} }
function crReact(e){ if (CR.conn) crSend(CR.conn, { t:'re', e }); toast(CRT('crSent')); }
function crToggle(){
  CR.follow = !CR.follow; toast(CRT(CR.follow ? 'crFollowOn' : 'crFreeOn')); crBar();
  if (CR.follow && CR.hostPage) crGo(CR.hostPage, true); else crApply();
}
function crKill(){
  if (CR.peer){ try{ CR.peer.destroy(); }catch(e){} }
  CR.peer = null; CR.conn = null; CR.conns = []; CR.host = ''; CR.last = {};
}
function crLeave(){
  if (CR.role === 'host') crCast({ t:'end' });
  const r = CR.role; setTimeout(crKill, r === 'host' ? 300 : 0);
  CR.role = ''; CR.code = ''; crClearMk(); crBar(); crSheetClose();
  const b = $('#rdCr'); if (b) b.classList.remove('crlive');
}
function crEndAsk(){ if (confirm(CRT('crEnd') + '？')) crLeave(); }
function crBar(){
  let el = $('#crbar'); document.body.className = document.body.className.replace(/\s*crOn/g, '') + (CR.role ? ' crOn' : '');
  const b = $('#rdCr'); if (b) b.classList.toggle('crlive', !!CR.role);
  if (!CR.role){ if (el) el.remove(); return; }
  if (!el){ el = document.createElement('div'); el.id = 'crbar'; el.className = 'crbar'; document.body.appendChild(el); }
  if (CR.role === 'host'){
    el.innerHTML = '<span class="crt" id="crbT">📡 ' + esc(CRT('crHostBar', CR.code)) + ' · 👥' + (CR.conns.length + 1) + (crPage() ? '' : ' · ' + esc(CRT('crOff'))) + '</span>'
      + '<button id="crbI">' + esc(CRT('crInv')) + '</button><button id="crbE">' + esc(CRT('crEnd')) + '</button>';
    $('#crbT').onclick = $('#crbI').onclick = crPanel; $('#crbE').onclick = crEndAsk;
  } else {
    el.innerHTML = '<span class="crt" id="crbT">📡 ' + esc(CR.host ? CRT('crGuestBar', CR.host) + ' · 👥' + CR.n + (CR.away ? ' · ' + CRT('crAway') : '') : CRT('crWait')) + '</span>'
      + '<button id="crbF">' + esc(CRT(CR.follow ? 'crFollowB' : 'crFreeB')) + '</button><button id="crbP">🙏</button><button id="crbQ">🙋</button><button id="crbL">' + esc(CRT('crLeaveB')) + '</button>';
    $('#crbT').onclick = crPanel; $('#crbF').onclick = crToggle;
    $('#crbP').onclick = () => crReact('🙏'); $('#crbQ').onclick = () => crReact('🙋'); $('#crbL').onclick = crLeave;
  }
}
async function crShare(){
  const text = CRT('crInviteMsg', CR.code) + '\n' + crUrl();
  if (navigator.share){ try{ await navigator.share({ title:t().app, text }); return; }catch(e){ if (e && e.name === 'AbortError') return; } }
  crCopy(text);
}
async function crCopy(s){
  try{ await navigator.clipboard.writeText(s || crUrl()); toast(CRT('crCopied')); }
  catch(e){ toast(CRT('crNoShare')); }
}
function crPanel(){
  if (!CR.role) return crMenu();
  if (CR.role === 'guest'){
    crSheet('<div class="crsheet c"><p class="h2">📡 ' + esc(CRT('crTitle')) + '</p><p>' + esc(CR.host ? CRT('crGuestBar', CR.host) : CRT('crWait')) + '</p><p class="xs">' + esc(CRT('crGuestTip')) + '</p>'
      + '<button class="btn primary full" id="crpT">' + esc(CRT(CR.follow ? 'crFree' : 'crFollow')) + '</button>'
      + '<button class="btn danger full" id="crpL" style="margin-top:8px">' + esc(CRT('crLeaveB')) + '</button></div>');
    $('#crpT').onclick = () => { crSheetClose(); crToggle(); }; $('#crpL').onclick = crLeave;
    return;
  }
  crLoad('qrcode.js', () => !!window.qrcode, () => {
    const q = qrcode(0, 'M'); q.addData(crUrl()); q.make();
    const ms = CR.conns.map(c => '<span class="pill">' + esc(c._nm || CRT('crGuest')) + '</span>').join(' ');
    crSheet('<div class="crsheet c crhp"><p class="h2">📡 ' + esc(CRT('crTitle')) + '</p><p class="xs">' + esc(CRT('crScan')) + '</p><div class="crqr">' + q.createSvgTag(5, 8) + '</div>'
      + '<p class="eyebrow">' + esc(CRT('crCode')) + '</p><div class="crcode">' + esc(CR.code) + '</div>'
      + '<div class="row" style="gap:8px;margin:10px 0"><button class="btn primary grow" id="crpS">' + esc(CRT('crShareLink')) + '</button><button class="btn grow" id="crpC">' + esc(CRT('crCopyB')) + '</button></div>'
      + '<p class="eyebrow" style="text-align:left">' + esc(CRT('crMembers', CR.conns.length)) + '</p><div style="text-align:left;min-height:24px">' + (ms || '<span class="xs">' + esc(CRT('crNone')) + '</span>') + '</div>'
      + '<p class="xs" style="text-align:left">' + esc(CRT('crTip')) + '</p>'
      + '<div class="row" style="gap:8px"><button class="btn grow" id="crpX">' + esc(t().close) + '</button><button class="btn danger grow" id="crpE">' + esc(CRT('crEnd')) + '</button></div></div>');
    $('#crpS').onclick = crShare; $('#crpC').onclick = () => crCopy(); $('#crpX').onclick = crSheetClose; $('#crpE').onclick = crEndAsk;
  });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (CR.role === 'guest' && (!CR.conn || !CR.conn.open)){ CR.tries = 0; crConnect(); }
  if (CR.role === 'host' && CR.peer && CR.peer.disconnected){ try{ CR.peer.reconnect(); }catch(e){} }
});
/* 開機完成後：如果是點邀請連結（?join=代碼）進來的，自動加入 */
function crBoot(){ if (CR_JOIN) setTimeout(() => crJoin(CR_JOIN), 400); }

async function switchLang(l){
  if (l === state.lang) return;
  ttsStop();
  state.lang = l; saveState(); applyChrome();
  searchState = { q:searchState.q, results:[], busy:false };
  await render();
}
async function boot(){
  if (/[?&]u=\d+/.test(location.search)) try{ history.replaceState(null, '', location.pathname + location.hash); }catch(e){}
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
    openWDB();                       // 作品庫（不擋開機）
    embedBoot();
    if (!location.hash) location.hash = '#/today';
    await render();
    crBoot();
  }catch(e){
    $('#bootText').textContent = '載入失敗：' + (e.message || e);
    $('#boot-diag').style.display = 'flex';
    return;
  }
  clearTimeout(diagTimer);
  const b = $('#boot'); if (b) b.remove();
  window.addEventListener('hashchange', () => { ttsStop(); render(); });
  aiResumeBoot();
  window.addEventListener('resize', syncHeaderH);
  window.addEventListener('orientationchange', () => setTimeout(syncHeaderH, 200));
  if ('serviceWorker' in navigator){
    try{
      swReg = await navigator.serviceWorker.register('sw.js', { updateViaCache:'none' });
      watchForUpdate(swReg);
      navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.t === 'sw-updated') checkVersion(); });
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (UPD.target && !updBusy()) reloadFresh(); });
    }catch(e){}
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(false); });
  window.addEventListener('pageshow', e => { if (e.persisted) checkForUpdate(false); });
  window.addEventListener('online', () => checkForUpdate(false));
  setInterval(() => checkForUpdate(false), 30 * 60 * 1000);   // 背景每 30 分鐘問一次
  setInterval(updIdle, 15000);                                 // 忙完了就套用等著的更新
  setTimeout(() => checkForUpdate(false), 2500);
  setTimeout(ttsWarmUp, 1200);
  if ((user.teams || []).length) setTimeout(teamPingNow, 2500);   // 開 App 就把今天的進度同步給隊友
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkPlanRemind(); });
  setInterval(checkPlanRemind, 15 * 60 * 1000);   // 背景每 15 分鐘看一次，時間到了、今天還沒讀完才會真的跳通知
  setTimeout(checkPlanRemind, 3000);              // 開 App 當下也順便檢查一次
}
/* ---- 한국어 팩: lang-ko.js 의 내용을 각 언어 표에 연결 (파일이 없으면 통째로 건너뜀) ---- */
(function attachID(){
  const P = window.ID_PACK; if (!P) return;
  I18N.id = P.I18N.id;
  PIC_L.id = P.PIC; HYM_L.id = P.HYM; TWEAK_L.id = P.TWEAK; TEAM_L.id = P.TEAM; CR_TX.id = P.CR;
  QBANK.id = P.QBANK;
  Object.keys(P.Q20||{}).forEach(k => { if (QBANK20[k]) QBANK20[k].id = P.Q20[k]; });
  Object.keys(P.Q20SK||{}).forEach(k => { if (QBANK20SK[k]) QBANK20SK[k].id = P.Q20SK[k]; });
  Object.keys(P.QAUD).forEach(k => { if (QBANK_AUD[k]) QBANK_AUD[k].id = P.QAUD[k]; });
  Object.keys(P.AUD2).forEach(k => {
    const o = AUD2[k], kp = P.AUD2[k]; if (!o || !o.en) return;
    o.id = Object.assign({}, o.en, { q:kp.q, rw:kp.rw, res:kp.res, fu:o.en.fu.map((f, i) => [f[0], kp.fu[i] || f[1], f[2]]) });
  });
  FU_BANK.id = {};
  Object.keys(FU_BANK.en).forEach(a => { const lab = P.FU[a]; FU_BANK.id[a] = FU_BANK.en[a].map((f, i) => [f[0], (lab && lab[i]) || f[1], f[2]]); });
  GROUPS.forEach((g, i) => { g.idn = P.groups[i]; });
})();
(function attachJA(){
  const P = window.JA_PACK; if (!P) return;
  I18N.ja = P.I18N.ja;
  PIC_L.ja = P.PIC; HYM_L.ja = P.HYM; TWEAK_L.ja = P.TWEAK; TEAM_L.ja = P.TEAM; CR_TX.ja = P.CR;
  QBANK.ja = P.QBANK;
  Object.keys(P.Q20||{}).forEach(k => { if (QBANK20[k]) QBANK20[k].ja = P.Q20[k]; });
  Object.keys(P.Q20SK||{}).forEach(k => { if (QBANK20SK[k]) QBANK20SK[k].ja = P.Q20SK[k]; });
  Object.keys(P.QAUD).forEach(k => { if (QBANK_AUD[k]) QBANK_AUD[k].ja = P.QAUD[k]; });
  Object.keys(P.AUD2).forEach(k => {
    const o = AUD2[k], kp = P.AUD2[k]; if (!o || !o.en) return;
    o.ja = Object.assign({}, o.en, { q:kp.q, rw:kp.rw, res:kp.res, fu:o.en.fu.map((f, i) => [f[0], kp.fu[i] || f[1], f[2]]) });
  });
  FU_BANK.ja = {};
  Object.keys(FU_BANK.en).forEach(a => { const lab = P.FU[a]; FU_BANK.ja[a] = FU_BANK.en[a].map((f, i) => [f[0], (lab && lab[i]) || f[1], f[2]]); });
  GROUPS.forEach((g, i) => { g.ja = P.groups[i]; });
})();
(function attachKO(){
  const P = window.KO_PACK; if (!P) return;
  I18N.ko = P.I18N.ko;
  PIC_L.ko = P.PIC; HYM_L.ko = P.HYM; TWEAK_L.ko = P.TWEAK; TEAM_L.ko = P.TEAM; CR_TX.ko = P.CR;
  QBANK.ko = P.QBANK;
  Object.keys(P.Q20||{}).forEach(k => { if (QBANK20[k]) QBANK20[k].ko = P.Q20[k]; });
  Object.keys(P.Q20SK||{}).forEach(k => { if (QBANK20SK[k]) QBANK20SK[k].ko = P.Q20SK[k]; });
  Object.keys(P.QAUD).forEach(k => { if (QBANK_AUD[k]) QBANK_AUD[k].ko = P.QAUD[k]; });
  Object.keys(P.AUD2).forEach(k => {
    const o = AUD2[k], kp = P.AUD2[k]; if (!o || !o.en) return;
    o.ko = Object.assign({}, o.en, { q:kp.q, rw:kp.rw, res:kp.res, fu:o.en.fu.map((f, i) => [f[0], kp.fu[i] || f[1], f[2]]) });
  });
  FU_BANK.ko = {};
  Object.keys(FU_BANK.en).forEach(a => { const lab = P.FU[a]; FU_BANK.ko[a] = FU_BANK.en[a].map((f, i) => [f[0], (lab && lab[i]) || f[1], f[2]]); });
  GROUPS.forEach((g, i) => { g.ko = P.groups[i]; });
})();
boot();
