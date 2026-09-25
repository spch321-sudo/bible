/* ============================================================================
   321互動聖經 — 和合本．去章節．只留經文
   國度321空中團契 ／ 架構沿用《321領導力》App
   ----------------------------------------------------------------------------
   ⚙ 端點與請求格式：與《321領導力》／《晨讀321》共用同一組 Cloudflare Worker，
      request/response 契約已照 321領導力 app.js 實際使用的格式對齊。
   ========================================================================== */
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
const VERSION = 'v2.7.15';

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
        cardBorder:'邊框', cardFsL:'內文字級', cardFsHint:'團體名稱、稱呼、內文與署名都會跟著放大，經文本身維持不變。',
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
        planEmpty:'還沒有開始讀經計畫。選一個計畫，就會從第一天開始為你排好進度。' },
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
        cardBorder:'边框', cardFsL:'内文字级', cardFsHint:'团体名称、称呼、内文与署名都会跟着放大，经文本身维持不变。',
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
        planEmpty:'还没有开始读经计划。选一个计划，就会从第一天开始为你排好进度。' },
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
        cardBorder:'Border', cardFsL:'Body text size', cardFsHint:'The group name, greeting, body text and signature all scale together; the verse itself stays as it is.',
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
        planEmpty:"You haven't started a reading plan yet. Pick one and it will lay out a day-by-day pace for you, starting from day one." }
};
const t = () => I18N[state.lang] || I18N.zh;
const isEN = () => state.lang === 'en';
const isZS = () => state.lang === 'zs';
/* 三語挑字：L3(繁, 简, 英) */
const L3 = (zh, zs, en) => isEN() ? en : (isZS() ? zs : zh);

/* ---------------------------------------------------------------- 狀態 */
const FONT_CLASS = ['', 'fs-lg', 'fs-xl', 'fs-xxl'];
const THEMES = ['auto', 'light', 'dark', 'sepia'];
const HL_COLORS = ['gold','green','blue','pink','purple','maroon','brown','charcoal'];
const HL_SWATCH = {gold:'#D9B168', green:'#6FAE71', blue:'#6C93D1', pink:'#E58FA0',
                   purple:'#A48AC9', maroon:'#8C4A4E', brown:'#8A6740', charcoal:'#54534E'};
/* 與姊妹App共用的 Azure 真人語音；順序＝預設值在最前（zh 雲哲、zs 云帆） */
const VOICES = {
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
                   cardTpl:'navy', cardSize:'t', cardBorder:'classic', cardFs:1,
                   cardTop:'', cardSign:'', cardTo:'',
                   voice:{zh:0, zs:0, en:0}, ttsAutoNext:false };
/* 「淨」鍵依序切換的四種組合：[整卷連讀?, 顯示章號?] */
/* 「淨」鍵循環的四種常用讀法：[整卷連讀, 顯示章, 顯示節] */
const VIEW_CYCLE = [[false, true, true], [false, true, false], [false, false, false], [true, false, false]];
let state = Object.assign({}, DEFAULTS);
let user  = { progress:{}, hl:{}, fav:[], marks:[], last:null,
               uid:'', nick:'', teams:[], pts:0, badges:[], acts:{},
               plan:{ active:null, starts:{}, done:{} } };
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
  h.setAttribute('lang', isEN() ? 'en' : (isZS() ? 'zh-Hans' : 'zh-Hant'));
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
const bname = b => isEN() ? (b.en || b.zh) : (isZS() ? b.zs : b.zh);
const babbr = b => isEN() ? (b.aen || b.azh) : (isZS() ? b.azs : b.azh);

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
const gname = g => isEN() ? g.en : (isZS() ? g.zs : g.zh);

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
function currentRoute(){
  const h = (location.hash || '#/today').replace(/^#/, '');
  return h.split('/').filter(Boolean);
}
async function render(){
  const r = currentRoute();
  const tab = r[0] || 'today';
  $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === (tab === 'read' ? 'books' : (tab === 'plan' ? 'today' : tab))));
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
  if (tab !== 'read' && tab !== 'studio') window.scrollTo(0, 0);
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
        <div class="hc-sub">${esc(L3('新標點和合本 · 去章節 · 只留經文', '新标点和合本 · 去章节 · 只留经文', 'World English Bible · no chapters · just the text'))}</div>
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
      <div class="dailyref">${esc(bname(BOOK[db]))} ${esc(chapLabel(db, dc))}</div>
      <div style="margin-top:12px"><a class="btn gold block" href="#/read/${db}/${dc}">${esc(L.read)}</a></div>
    </div>

    <div class="section-title">${esc(L3('快速進入', '快速进入', 'Jump to'))}</div>
    <div class="card" style="padding:4px 16px">
      <a class="rowlink" href="#/plan"><div class="meta"><div class="t">${esc(L.plan)}</div>
        <div class="s">${user.plan.active ? esc(L.progress) : esc(L.planTitle)}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/read/Psalms/${(new Date().getDate() % 150) + 1}">
        <div class="meta"><div class="t">${esc(bname(BOOK['Psalms']))}</div><div class="s">${esc(chapLabel('Psalms', (new Date().getDate() % 150) + 1))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/read/John/1"><div class="meta"><div class="t">${esc(bname(BOOK['John']))}</div><div class="s">${esc(L.chapter(1))}</div></div><div class="chev">›</div></a>
      <a class="rowlink" href="#/books"><div class="meta"><div class="t">${esc(L.books)}</div><div class="s">66 ${esc(L.bookUnit)}</div></div><div class="chev">›</div></a>
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
      <summary><span style="color:var(--gold)">◆</span>${esc(gname(g))}<span class="cnt">${bs.length} ${esc(t().bookUnit)}</span></summary>
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
      <div style="flex:1"><div style="font-family:var(--f-serif);font-weight:900;font-size:19px">${esc(bname(b))}</div>
      <div class="muted">${b.ch} ${esc(L.ch)} · ${b.v} ${esc(L.verses)}</div></div></div>
    <div class="chgrid">${Array.from({length: b.ch}, (_, i) => {
      const n = i + 1, read = user.progress[bookId + '-' + n];
      return `<button class="chbtn ${n === cur ? 'now' : (read ? 'read' : '')}" data-c="${n}">${n}</button>`;
    }).join('')}</div>`;
  $('#backBooks', v).onclick = () => go('#/books');
  $$('.chbtn', v).forEach(x => x.onclick = () => go(`#/read/${bookId}/${x.dataset.c}`));
}

/* ================================================================ 讀經計畫
   三個現成計畫（一年／兩年／沉浸式三年，資料在 plans.json）都是同一套資料形狀：
   { totalDays, title:{zh,zs,en}, subtitle:{zh,zs,en}, days:[{day,book,start,end,week[,vol,volNo,year]}] }
   進度存法比照 user.progress 的「鍵存在即代表做過」慣例：
   user.plan = { active: 'y1'|'y2'|'immerse3'|null, starts:{[planId]:ts}, done:{[planId+'-'+day]:ts} } */
let PLANS = null;
const PLAN_IDS = ['y1', 'y2', 'immerse3'];
async function loadPlans(){
  if (PLANS) return PLANS;
  PLANS = await fetchJSON('plans.json');
  return PLANS;
}
const planTitle = p => (p.title[state.lang] || p.title.zh);
const planSubtitle = p => (p.subtitle[state.lang] || p.subtitle.zh);
const planDayKey = (pid, day) => pid + '-' + day;
function planDoneCount(pid){
  let n = 0; const pfx = pid + '-';
  for (const k in user.plan.done) if (k.indexOf(pfx) === 0) n++;
  return n;
}
function planTodayIndex(p){
  const st = user.plan.starts[p.id];
  if (!st) return 1;
  const d = Math.floor((Date.now() - st) / 86400000) + 1;
  return Math.min(Math.max(1, d), p.totalDays);
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
  render();
}
function switchPlan(){
  user.plan.active = null;
  saveUser();
  render();
}
function restartPlan(pid){
  if (!confirm(t().planRestartAsk)) return;
  user.plan.starts[pid] = Date.now();
  const pfx = pid + '-';
  Object.keys(user.plan.done).forEach(k => { if (k.indexOf(pfx) === 0) delete user.plan.done[k]; });
  saveUser();
  render();
}
function togglePlanDone(pid, day){
  const k = planDayKey(pid, day);
  if (user.plan.done[k]) delete user.plan.done[k]; else user.plan.done[k] = Date.now();
  saveUser();
  render();
}
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
function planWeeksHtml(rows, pid, todayIdx){
  let html = '', i = 0;
  while (i < rows.length){
    const wk = rows[i].week;
    let j = i; while (j < rows.length && rows[j].week === wk) j++;
    const seg = rows.slice(i, j);
    const open = seg.some(d => d.day === todayIdx);
    html += `<details class="grp" ${open ? 'open' : ''}>
      <summary><span style="color:var(--gold)">◆</span>${esc(t().planWeek(wk))}<span class="cnt">${seg.length} ${esc(t().planDaysUnit)}</span></summary>
      <div>${seg.map(d => planRowHtml(d, pid, todayIdx)).join('')}</div></details>`;
    i = j;
  }
  return html;
}
function planGroupsHtml(p, pid, todayIdx){
  const rows = p.days;
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
async function viewPlan(v){
  const L = t();
  const P = await loadPlans();
  if (!user.plan.active){
    v.innerHTML = `
      <div class="section-title">${esc(L.planTitle)}</div>
      ${PLAN_IDS.map(pid => {
        const p = P[pid];
        return `<div class="card plancard">
          <div class="pill">${p.totalDays} ${esc(L.planDaysUnit)}</div>
          <h3>${esc(planTitle(p))}</h3>
          <div class="muted" style="font-size:13px;line-height:1.6;margin-bottom:12px">${esc(planSubtitle(p))}</div>
          <button class="btn gold block" data-start="${pid}">${esc(L.planStart)}</button>
        </div>`;
      }).join('')}`;
    $$('[data-start]', v).forEach(b => b.onclick = () => startPlan(b.dataset.start));
    return;
  }
  const pid = user.plan.active, p = P[pid];
  const doneN = planDoneCount(pid);
  const todayIdx = planTodayIndex(p);
  const today = p.days[todayIdx - 1];
  const todayDone = !!user.plan.done[planDayKey(pid, todayIdx)];
  const pct = Math.round(doneN / p.totalDays * 100);
  const C = 2 * Math.PI * 25;

  v.innerHTML = `
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
    <div style="display:flex;gap:18px;margin:2px 4px 14px;font-size:12.5px">
      <button id="planSwitchBtn" style="background:none;border:none;color:var(--accent);font-weight:600;cursor:pointer;padding:0">${esc(L.planSwitch)}</button>
      <button id="planRestartBtn" style="background:none;border:none;color:var(--ink-faint);font-weight:600;cursor:pointer;padding:0">${esc(L.planRestart)}</button>
    </div>
    ${planGroupsHtml(p, pid, todayIdx)}`;

  $('#todayToggle', v).onclick = () => togglePlanDone(pid, todayIdx);
  $('#planSwitchBtn', v).onclick = () => switchPlan();
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
      <button class="chtb-btn" id="rdPrev">‹</button>
      <button class="chtb-btn" id="rdNext">›</button>
      <div class="chtb-spacer"></div>
      <button class="chtb-btn ${bmMode ? 'on' : ''}" id="rdBm" title="${esc(L.bm)}">🔖</button>
      <button class="chtb-btn ${(state.flow || !state.shCh || !state.shV) ? 'on' : ''}" id="rdMode" title="${esc(L.pure)}">${esc(L3('淨', '净', '¶'))}</button>
      <button class="chtb-btn" id="rdFont">A⁺</button>
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
    <div class="readend" id="readEnd"></div>`;

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

  if (!(spk.on && spk.items.length)) window.scrollTo(0, 0);
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
  if (!user.progress[k]){ user.progress[k] = Date.now(); saveUser(); teamPingSoon(); }
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
      chatPending = isEN() ? `Help me meditate on this verse: “${h.t}”`
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
const pl = () => PIC_L[state.lang] || PIC_L.zh;

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
    photoImg = im;
    photoBy = photo.photographer || '';
    if (!photoMode) photoMode = 'bg';
    return true;
  }finally{ setTimeout(() => { try{ URL.revokeObjectURL(obj); }catch(_){} }, 30000); }
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
       hint:'詩歌放在自己的網站上，錄影片時混得進去。下載與使用請遵守各詩歌的授權規定。' },
  zs:{ lib:'诗歌库', btn:'🎵 从诗歌库选', title:'诗歌库', ph:'找歌名…',
       loading:'载入中…', close:'关闭', all:'全部', play:'试听', stop:'停止',
       none:'找不到这首，换个字试试', picked:'已选好这首诗歌', getting:'载入诗歌中…',
       noList:'还没有建立诗歌库。把 mp3 放进网站的 music/ 文件夹，并在 music.json 加上清单，这里就会出现。',
       bad:'这首载入失败，换一首试试', credit:'诗歌：', srcT:'出处：',
       e404a:'找不到 ', e404b:'（根目录也找过了）　这个音档还没上传到网站上',
       eNet:'连不到音档（网络或离线）：', eEmpty:'　这个档是空的，请重新上传',
       eHtml:'　抓回来的不是音档，是网页（多半是 404 页面）', again:'找到音档了，请再按一次 ▶',
       hint:'诗歌放在自己的网站上，录视频时混得进去。下载与使用请遵守各诗歌的授权规定。' },
  en:{ lib:'Hymn library', btn:'🎵 Pick a hymn', title:'Hymn library', ph:'Find a hymn…',
       loading:'Loading…', close:'Close', all:'All', play:'Preview', stop:'Stop',
       none:'Not found — try another word', picked:'Hymn selected', getting:'Loading the hymn…',
       noList:'No hymn library yet. Put mp3 files in the site’s music/ folder and list them in music.json.',
       bad:'That hymn could not be loaded — try another', credit:'Hymn: ', srcT:'Source: ',
       e404a:'Not found: ', e404b:' (the site root was checked too) — this file has not been uploaded yet',
       eNet:'Cannot reach the audio file (offline?): ', eEmpty:' — the file is empty, please re-upload',
       eHtml:' — what came back is a web page, not audio (usually a 404 page)', again:'Found it — tap ▶ once more',
       hint:'Hymns are hosted on this site, so they mix into recordings properly. Please respect each hymn’s licence.' }
};
const hl_ = () => HYM_L[state.lang] || HYM_L.zh;
/* 一首歌的顯示名稱（三語，沒填就用中文那個） */
const songName = s => (isEN() ? (s.ne || s.n) : (isZS() ? (s.ns || s.n) : s.n)) || s.f || '';

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
  if (musicBase !== null || !list || !list.length) return;
  /* 只探第一首是不夠的：萬一那一首剛好還沒上傳，整份清單就都判成「找不到」，
     連已經傳好的歌也跟著放不出來。所以從頭往下一首一首試，有一首通就算數
     （HEAD 很輕，最多試十二首就停）。 */
  const max = Math.min(list.length, 12);
  for (let i = 0; i < max; i++){
    const name = encodeURIComponent(list[i].f);
    for (const b of [MUSIC_DIR, '']){
      try{
        const r = await fetch(b + name + '?v=' + VERSION, { method:'HEAD' });
        if (r.ok){ musicBase = b; return; }
      }catch(e){}
    }
  }
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
async function hymnFetch(s){
  const name = encodeURIComponent(s.f);
  const tries = (musicBase !== null) ? [musicBase] : [MUSIC_DIR, ''];
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
    musicBase = b;                          // 這一邊有，記下來
    return blob;
  }
  throw new Error(why || hl_().bad);
}
/* 選一首：抓成 blob（同源，錄影混得進去），並記下出處 */
async function hymnPick(s){
  bgmBlob = await hymnFetch(s);
  bgmName = songName(s);
  bgmCredit = hl_().credit + songName(s) + (s.by ? '／' + s.by : '');
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
      return (songName(s) + ' ' + (s.n || '') + ' ' + (s.ne || '') + ' ' + (s.by || ''))
             .toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length){ box.innerHTML = `<div class="empty">${esc(L.none)}</div>`; return; }
    box.innerHTML = list.map(function (s){
      const i = hymnList.indexOf(s);
      return `<div class="hymnrow" data-i="${i}">
        <button class="hymnplay" data-p="${i}">▶</button>
        <div class="meta"><div class="t">${esc(songName(s))}</div>
        <div class="s">${esc([s.by, s.tag].filter(Boolean).join('　·　'))}</div></div>
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
        const src = (musicBase !== null ? musicBase : MUSIC_DIR) + encodeURIComponent(s.f);
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
        + tags.map(x => `<button data-t="${esc(x)}">${esc(x)}</button>`).join('');
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
  navy:  { n:['深藍聖夜','深蓝圣夜'], bg:['#123F92','#0D3988','#071A42'], glow:'rgba(212,166,91,.30)',
           ink:'#F2ECDD', accent:'#F7EFDC', gold:'#D4A65B', sub:'#BBA98A', frame:'rgba(212,166,91,.42)' },
  paper: { n:['素樸信箋','素朴信笺'], bg:['#FBF8F1','#F4EFE3','#EDE6D6'], glow:'rgba(212,166,91,.45)',
           ink:'#3A3122', accent:'#23211C', gold:'#A9762F', sub:'#8A7C63', frame:'rgba(169,118,47,.34)' },
  dawn:  { n:['晨曦盼望','晨曦盼望'], bg:['#FFF6EC','#FBE9D2','#F6D9B8'], glow:'rgba(255,214,150,.6)',
           ink:'#3A2A1A', accent:'#8A4B16', gold:'#C97A22', sub:'#8A6A4A', frame:'rgba(181,101,29,.30)' },
  grace: { n:['青草安歇','青草安歇'], bg:['#F2F7F1','#E4EFE6','#D6E7DA'], glow:'rgba(160,200,170,.5)',
           ink:'#1C2E26', accent:'#255943', gold:'#3C8A64', sub:'#5C7A6A', frame:'rgba(46,106,80,.28)' },
  rose:  { n:['溫柔玫瑰','温柔玫瑰'], bg:['#FCF5F3','#F6E7E3','#EFD8D2'], glow:'rgba(220,160,150,.45)',
           ink:'#33221E', accent:'#8A3D2E', gold:'#B36A54', sub:'#8A6A62', frame:'rgba(154,74,58,.28)' },
  sky:   { n:['平安晴空','平安晴空'], bg:['#F1F7FB','#DFEEF6','#CFE4F0'], glow:'rgba(150,200,230,.5)',
           ink:'#1B2A33', accent:'#1E5270', gold:'#2E7DA0', sub:'#5A7684', frame:'rgba(37,96,128,.28)' },
  linen: { n:['素雅棉麻','素雅棉麻'], bg:['#F7F4EE','#EFEAE0','#E6DFD2'], glow:'rgba(200,190,170,.4)',
           ink:'#2A2620', accent:'#4A4234', gold:'#8A7A5A', sub:'#7A7263', frame:'rgba(90,80,64,.26)' },
  night: { n:['深夜星光','深夜星光'], bg:['#101E1B','#16302A','#0E2420'], glow:'rgba(232,201,122,.26)',
           ink:'#EDEAE0', accent:'#E8C97A', gold:'#E8C97A', sub:'#9FB0AA', frame:'rgba(232,201,122,.34)' },
  plain: { n:['純白簡潔','纯白简洁'], bg:['#FFFFFF','#FFFFFF','#FFFFFF'], glow:'rgba(0,0,0,0)',
           ink:'#23211C', accent:'#0D3988', gold:'#A9762F', sub:'#6B6255', frame:'rgba(13,57,136,.22)' }
};
const CARD_ORDER = ['navy','paper','dawn','grace','rose','sky','linen','night','plain'];
const CARD_SIZES = { p:[1080,1920,['直式 9:16','直式 9:16']],
                     t:[1080,1350,['直式 4:5','直式 4:5']],
                     s:[1080,1080,['方形','方形']],
                     w:[1920,1080,['橫式','横式']] };
const CARD_BORDERS = [ ['classic',['古典雙框','古典双框']], ['corner',['雅緻角飾','雅致角饰']],
                       ['inline',['內斂細線','内敛细线']], ['dots',['珠鏈點框','珠链点框']],
                       ['ornate',['華麗花角','华丽花角']], ['none',['無邊框','无边框']] ];
const CARD_FS = [[0.9,['小一點','小一点']], [1,['標準','标准']], [1.2,['大','大']],
                 [1.45,['特大','特大']], [1.7,['超大','超大']]];
let cardImg = null;
const cardTpl = () => CARD_TPL[state.cardTpl] ? state.cardTpl : 'navy';
const cardSize = () => CARD_SIZES[state.cardSize] ? state.cardSize : 't';
const cardBorder = () => CARD_BORDERS.some(b => b[0] === state.cardBorder) ? state.cardBorder : 'classic';
const cardFs = () => Math.min(1.8, Math.max(.85, +state.cardFs || 1));

/* ---- 相片（作背景／貼在卡片上）---- */
let photoImg = null, photoMode = 'bg', suppressSticker = false, selfieLayout = false;
let stkSize = 0.30, stkPos = 'br', stkShape = 'p';
const STK_SIZES  = [[0.22,['小張','小张']],[0.30,['中等','中等']],[0.38,['大張','大张']],
                    [0.46,['滿版','满版']],[0.62,['超大','超大']],[0.84,['整排','整排']]];
const STK_POS    = [['bl',['左下','左下']],['bc',['正下','正下']],['br',['右下','右下']],
                    ['tl',['左上','左上']],['tr',['右上','右上']]];
const STK_SHAPES = [['p',['直式','直式']],['w',['橫式 16:9','横式 16:9']],['s',['方形','方形']]];
const stkRatio = () => stkShape === 'w' ? 0.72 : (stkShape === 's' ? 1.06 : 1.12);
function pickPhoto(inp){
  const f = inp && inp.files && inp.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => { photoImg = im; photoBy = ''; if (!photoMode) photoMode = 'bg'; studioRefresh(); };
    im.onerror = () => toast(t().photoBad);
    im.src = rd.result;
  };
  rd.onerror = () => toast(t().photoBad);
  rd.readAsDataURL(f);
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
const MC_LENS = [[15,['15 秒','15 秒']],[30,['30 秒','30 秒']],[60,['1 分鐘','1 分钟']],[0,['整首','整首']]];
const BGM_VOLS = [[0.12,['小聲','小声']],[0.22,['適中','适中']],[0.38,['明顯','明显']]];
const AUD_EXT = /\.(mp3|m4a|aac|wav|aif|aiff|caf|flac|ogg|opus|mp4|mov|webm|wma)$/i;
function pickBgm(inp){
  const f = inp && inp.files && inp.files[0]; if (!f) return;
  const ok = (f.type && (f.type.indexOf('audio') === 0 || f.type.indexOf('video') === 0)) || AUD_EXT.test(f.name || '');
  if (!ok){ toast(t().bgmBad); return; }
  if (f.size > 25 * 1024 * 1024){ toast(t().bgmBig); return; }
  bgmBlob = f; bgmName = f.name || '背景音樂'; bgmCredit = ''; studioRefresh(); toast(t().bgmAdded);
}

const DEF_TOP  = () => L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Fellowship');
const DEF_SIGN = () => isEN() ? '321 Interactive Bible　World English Bible'
                              : (t().app + '　' + L3('新標點和合本', '新标点和合本', ''));
/* 詩篇用「篇」／Psalm，其餘用「章」／Chapter */
function chapLabel(bookId, n){
  if (bookId === 'Psalms') return isEN() ? `Psalm ${n}` : L3(`第 ${n} 篇`, `第 ${n} 篇`, '');
  return t().chapter(n);
}
function cardRef(h){
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
  const pad = Math.round(W * .085), R = Math.round(Math.min(W, H) * 0.115);
  const cxx = W - pad - R + 4 * F, cyy = H - pad - R + 4 * F;
  cx.save();
  cx.shadowColor = 'rgba(0,0,0,.28)'; cx.shadowBlur = Math.round(22 * F); cx.shadowOffsetY = Math.round(8 * F);
  cx.beginPath(); cx.arc(cxx, cyy, R, 0, 7); cx.fillStyle = '#000'; cx.fill();
  cx.restore();
  cx.save(); cx.beginPath(); cx.arc(cxx, cyy, R, 0, 7); cx.clip();
  const vw = vid.videoWidth, vh = vid.videoHeight, side = Math.min(vw, vh);
  cx.translate(cxx, cyy); cx.scale(-1, 1);
  cx.drawImage(vid, (vw - side) / 2, (vh - side) / 2, side, side, -R, -R, R * 2, R * 2);
  cx.restore();
  cx.beginPath(); cx.arc(cxx, cyy, R, 0, 7);
  cx.lineWidth = Math.max(3, W * .006); cx.strokeStyle = '#F4EFE3'; cx.stroke();
  cx.beginPath(); cx.arc(cxx, cyy, R + 4 * F, 0, 7);
  cx.lineWidth = Math.max(2, W * .003); cx.strokeStyle = 'rgba(212,166,91,.85)'; cx.stroke();
}

/* 畫布上的字型也要分語言。Noto Serif TC／Sans TC 裡沒有簡體才有的字
   （创、虚、灵、运、开、诸、将、这、结、发、类、树…），canvas 會一個字一個字
   換字型頂替，頂到黑體，卡片上就變成一句話裡粗細不一。 */
const CARD_SERIF = () => isZS()
  ? '"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",Georgia,serif'
  : (isEN() ? 'Georgia,"Times New Roman",serif'
            : '"Noto Serif TC","Songti TC","STSong","PMingLiU",Georgia,serif');
const CARD_SANS = () => isZS()
  ? '"Noto Sans SC","PingFang SC","Microsoft YaHei","Heiti SC",sans-serif'
  : (isEN() ? '-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif'
            : '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif');

function drawVerseCard(cv, h, W, H){
  const ctx = cv.getContext('2d'); cv.width = W; cv.height = H;
  const T = CARD_TPL[cardTpl()];
  const F = W / 1080, pad = Math.round(W * .085), iw = W - pad * 2;
  const sans = CARD_SANS(), serif = CARD_SERIF();
  const FB = cardFs();          /* 內文字級——團體名稱、稱呼、署名跟著這個縮放，經文本身維持不變 */

  /* 背景 */
  const g = ctx.createLinearGradient(0, 0, W * .3, H);
  g.addColorStop(0, T.bg[0]); g.addColorStop(.55, T.bg[1]); g.addColorStop(1, T.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  /* 相片當背景時鋪上半透明遮罩，字才看得清楚 */
  if (photoImg && photoMode === 'bg'){
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

  /* 團契名 */
  const grp = (state.cardTop || '').trim() || DEF_TOP();
  const grpSz = Math.round(27 * F * FB), grpY = pad + Math.round(42 * F);
  ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `600 ${grpSz}px ${sans}`;
  const gw = ctx.measureText(grp).width;
  ctx.fillText(grp, W / 2, grpY);
  ctx.strokeStyle = T.frame.replace(/[\d.]+\)$/, '0.6)'); ctx.lineWidth = Math.max(1, 1.5 * F);
  [[W / 2 - gw / 2 - 28 * F, -1], [W / 2 + gw / 2 + 28 * F, 1]].forEach(([x0, d]) => {
    ctx.beginPath(); ctx.moveTo(x0, grpY - 9 * F); ctx.lineTo(x0 + d * 30 * F, grpY - 9 * F); ctx.stroke();
  });

  /* 稱呼（若有）畫在團契名底下、經文上面，像一封信的開頭——使用者要求改黑色 */
  const toName = (state.cardTo || '').trim();
  if (toName){
    let ts2 = Math.round(40 * F * FB);
    ctx.textAlign = 'center'; ctx.fillStyle = T.ink;
    while (ts2 > Math.round(22 * F * FB)){
      ctx.font = `600 ${ts2}px ${serif}`;
      if (ctx.measureText(toName).width <= iw) break;
      ts2 -= Math.round(2 * F);
    }
    ctx.font = `600 ${ts2}px ${serif}`;
    ctx.fillText(toName, W / 2, pad + Math.round(132 * F));
  }

  /* 版位：經文＋領受垂直置中 */
  const hasSticker = photoImg && photoMode === 'sticker' && !suppressSticker;
  const stkBottom = hasSticker && stkPos !== 'tl' && stkPos !== 'tr';
  const liftRoom = stkBottom ? Math.round(W * stkSize * stkRatio()) + Math.round(30 * F) : 0;
  const topRoom = pad + Math.round((toName ? 176 : 100) * F), botRoom = pad + Math.round(70 * F) + liftRoom;
  const room = H - topRoom - botRoom;
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

  let vs = Math.round(58 * F), vl;
  while (true){
    ctx.font = `600 ${vs}px ${serif}`;
    vl = wrapText(ctx, verse, iw);
    if (vl.length <= (isEN() ? 9 : 7) || vs <= Math.round(28 * F)) break;
    vs -= Math.round(3 * F);
  }
  const fixed = vs * .9 + vl.length * vs * 1.52 + Math.round(64 * F) + (note ? Math.round(86 * F) : 0);
  let ns = Math.round(38 * F * FB), nl = [];
  if (note){
    while (true){
      ctx.font = `${ns}px ${sans}`;
      nl = wrapText(ctx, note, iw);
      if (fixed + nl.length * ns * 1.76 <= room || ns <= Math.round(21 * F)) break;
      ns -= Math.round(2 * F);
    }
  }
  const total = fixed + (note ? nl.length * ns * 1.76 : 0);
  let y = topRoom + Math.max(0, (room - total) / 2);

  /* 經文 */
  ctx.fillStyle = T.accent; ctx.font = `600 ${vs}px ${serif}`;
  y += vs * .9;
  vl.forEach(l => { ctx.fillText(l, W / 2, y); y += vs * 1.52; });

  /* 出處——使用者要求跟經文同色，不再用金色 */
  ctx.font = `${Math.round(30 * F)}px ${sans}`; ctx.fillStyle = T.accent;
  ctx.fillText(cardRef(h), W / 2, y); y += Math.round(64 * F);

  /* 領受 */
  if (note){
    ctx.fillStyle = T.gold;
    ctx.beginPath(); ctx.arc(W / 2, y, Math.round(5 * F), 0, 7); ctx.fill();
    ctx.strokeStyle = T.gold; ctx.lineWidth = 2.5 * F;
    ctx.beginPath(); ctx.moveTo(W / 2 - 52 * F, y); ctx.lineTo(W / 2 - 16 * F, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 16 * F, y); ctx.lineTo(W / 2 + 52 * F, y); ctx.stroke();
    y += Math.round(86 * F);
    ctx.textAlign = 'left'; ctx.fillStyle = T.ink; ctx.font = `${ns}px ${sans}`;
    nl.forEach(l => { ctx.fillText(l, pad, y); y += ns * 1.76; });
    ctx.textAlign = 'center';
  }

  /* 落款（貼紙或自拍佔住底部時往上讓開） */
  const lift = stkBottom ? Math.round(W * stkSize * stkRatio()) + Math.round(16 * F) : 0;
  ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `600 ${Math.round(25 * F * FB)}px ${sans}`;
  const sign = (state.cardSign || '').trim()
            || DEF_SIGN();
  let ss = Math.round(25 * F * FB);
  while (ss > Math.round(15 * F * FB)){ ctx.font = `600 ${ss}px ${sans}`; if (ctx.measureText(sign).width <= iw) break; ss -= 2; }
  ctx.fillText(sign, W / 2, H - pad * .72 - Math.round(24 * F) - lift);

  /* 相片貼紙（拍立得風格） */
  if (hasSticker){
    const sw = Math.round(W * stkSize), sh = Math.round(sw * stkRatio());
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
    coverDraw(ctx, photoImg, -sw / 2 + fr, -sh / 2 + fr, iw2, ih2); ctx.restore();
    ctx.restore();
  }
}
function cardBlob(url){
  const b = atob(url.split(',')[1]), a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return new Blob([a], { type:'image/png' });
}
function renderCard(h){
  const [W, H] = CARD_SIZES[cardSize()];
  const cv = document.createElement('canvas');
  drawVerseCard(cv, h, W, H);
  cardImg = cv.toDataURL('image/png');
  const box = $('#cardPv');
  if (box) box.innerHTML = `<img src="${cardImg}" alt="">`;
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
async function setRecMode(m){
  if (mr && mr.state === 'recording'){ toast(L3('錄製中不能換，先按「停止並完成」','录制中不能换，先按“停止并完成”','Stop the recording first'), 2400); return; }
  recMode = m;
  if (m !== 's'){ stopSelfie(); await studioRefresh(); toast(t()[m === 'a' ? 'recVoiceD' : 'recCardD'], 2200); return; }
  try{
    selfieStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false });
  }catch(e){ recMode = 'c'; toast(t().camDeny); }
  await studioRefresh();
  if (recMode === 's'){ setTimeout(attachSelfie, 60); toast(t().recSelfieD, 2200); }
}
/* 卡片＋緩慢掃過的光暈；錄影就是把這張動態畫面錄下來 */
function liveCanvas(W, H, withSelfie){
  const base = document.createElement('canvas');
  selfieLayout = !!withSelfie; suppressSticker = !!withSelfie;
  drawVerseCard(base, studioItem, W, H);
  selfieLayout = false; suppressSticker = false;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d'), t0 = performance.now(), F = W / 1080;
  const svid = $('#selfiePrev');
  const loop = () => {
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
    recAnim = requestAnimationFrame(loop);
  };
  loop();
  const lb = $('#liveBox');
  if (lb){
    cv.style.cssText = 'width:100%;max-width:300px;border-radius:14px;display:block;margin:0 auto;box-shadow:0 6px 20px rgba(0,0,0,.14)';
    lb.innerHTML = ''; lb.appendChild(cv); lb.hidden = false;
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
async function saveWork(blob, type, kind, dur){
  try{
    if (!wdb) await openWDB();
    if (!wdb) throw new Error('IndexedDB 打不開');
    await putRec({ id:uid(), ts:Date.now(), blob, mime:blob.type || type, kind, dur:dur || 0,
                   v:studioItem.t, r:cardRef(studioItem), n:studioItem.n || '' });
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
  if (mr && mr.state === 'recording'){ mr.stop(); return; }
  if (!studioItem) return;
  /* 上一次錄完相機就關了，再按一次自拍要重新開，不然只會錄到靜止的臉 */
  if (recMode === 's' && (!selfieStream || !selfieStream.active)){
    try{ selfieStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false }); }
    catch(e){ recMode = 'c'; toast(t().camDeny); await studioRefresh(); }
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
      const [W, H] = CARD_SIZES[cardSize()];
      const cv = liveCanvas(W, H, useSelfie);
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
    clearInterval(recTimer); cancelAnimationFrame(recAnim);
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
  if (mr && mr.state === 'recording'){ mr.stop(); return; }
  if (!studioItem || !bgmBlob){ toast(t().bgmNeed); return; }
  if (!canVideo()){ toast(t().vidNo); return; }
  let ac, bgmEl, bgmURL, audioStream;
  try{
    ac = new (window.AudioContext || window.webkitAudioContext)();
    try{ await ac.resume(); }catch(_){}
    bgmURL = URL.createObjectURL(bgmBlob);
    bgmEl = new Audio(); bgmEl.src = bgmURL; bgmEl.loop = false; bgmEl.crossOrigin = 'anonymous';
    const gain = ac.createGain(); gain.gain.value = 0.0001; __mcGain = gain;
    const dst = ac.createMediaStreamDestination();
    ac.createMediaElementSource(bgmEl).connect(gain).connect(dst);
    audioStream = dst.stream;
  }catch(e){ toast(t().bgmBad); return; }

  const [W, H] = CARD_SIZES[cardSize()];
  const cv = liveCanvas(W, H, false);
  const mime = vidMime();
  const stream = new MediaStream([...cv.captureStream(24).getVideoTracks(), ...audioStream.getAudioTracks()]);
  try{ mr = new MediaRecorder(stream, Object.assign(mime ? { mimeType:mime } : {}, { videoBitsPerSecond:2200000 })); }
  catch(e){ cancelAnimationFrame(recAnim); toast(t().vidNo); return; }

  chunks = []; recSec = 0;
  mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  mr.onstop = async () => {
    clearInterval(recTimer); cancelAnimationFrame(recAnim);
    try{ if (bgmEl){ bgmEl.pause(); bgmEl.src = ''; } }catch(_){}
    try{ if (bgmURL) URL.revokeObjectURL(bgmURL); }catch(_){}
    try{ if (ac) ac.close(); }catch(_){}
    const type = mr.mimeType || mime || 'video/webm';
    await finishRec(new Blob(chunks, { type }), type, 'video');
  };
  mr.start(1000);
  try{ await bgmEl.play(); }catch(e){}
  fadeIn(__mcGain, ac, 1, 0.6);
  bgmEl.onended = () => { if (mr && mr.state === 'recording') mr.stop(); };
  const lim = mcLen > 0 ? mcLen : 8 * 60;
  if (mcLen > 0){
    setTimeout(() => { try{ __mcGain && __mcGain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.8); }catch(_){} },
               Math.max(0, lim - 2) * 1000);
  }
  setTimeout(() => { if (mr && mr.state === 'recording') mr.stop(); }, lim * 1000);
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
async function aiOnce(sys, ask){
  let out = '', why = '';
  for (let a = 0; a <= CHAT_RETRY.length; a++){
    try{
      const r = await fetch(API.chat, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ system: sys, messages:[{ role:'user', content: ask }] }) });
      if (!r.ok) throw new Error('http ' + r.status);
      out = extractReply(await r.json().catch(() => null));
      if (!out) why = L3('回覆是空的', '回复是空的', 'empty reply');
      break;
    }catch(e){
      why = (e && e.message) ? String(e.message) : 'network';
      if (a === CHAT_RETRY.length) break;
      await new Promise(rs => setTimeout(rs, CHAT_RETRY[a]));
    }
  }
  return { out: out ? out.replace(/[*#>`]/g, '').replace(/^「|」$/g, '').trim() : '', why };
}
/* 寫給誰——祝福與改內文都要帶上 */
function whoLine(){
  const who = (state.cardTo || '').trim();
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
const tw_ = () => TWEAK_L[state.lang] || TWEAK_L.zh;
function curNote(){
  return String(studioNote != null ? studioNote : (studioItem && studioItem.n) || '').trim();
}
async function noteRewrite(instr, mask){
  if (blessBusy || !studioItem) return;
  const cur = curNote();
  if (!cur){ toast(tw_().need, 4200); return; }
  blessBusy = true;
  const go = mask && $('#twGo', mask);
  if (go){ go.disabled = true; go.textContent = tw_().busy; }
  const sys = isEN()
    ? 'You are Xiaozhi from Kingdom 321 Fellowship. Rewrite the short blessing the user gives you, following their instruction. Return ONLY the rewritten text — no explanation, no heading, no bullet points, no quotation marks, and do not quote the verse again. Keep it warm and spoken, never preachy. If it reads as a prayer, close it with "in the name of the Lord Jesus we pray, Amen" — never "in Jesus\' name we ask, Amen."'
    : isZS()
    ? '你是「小智」，国度321空中团契的属灵同伴。请照使用者的要求，修改他给你的这段祝福。只回传改好的内文本身——不要解释、不要标题、不要条列、不要引号、不要再抄一次经文。保持温暖、口语、不说教。若结尾写成祷告，要用「奉主耶稣的名祷告，阿们」，不要用「奉耶稣的名求」。'
    : '你是「小智」，國度321空中團契的屬靈同伴。請照使用者的要求，修改他給你的這段祝福。只回傳改好的內文本身——不要解釋、不要標題、不要條列、不要引號、不要再抄一次經文。保持溫暖、口語、不說教。若結尾寫成禱告，要用「奉主耶穌的名禱告，阿們」，不要用「奉耶穌的名求」。';
  const ask = L3('經文：', '经文：', 'Verse: ') + studioItem.t + '（' + cardRef(studioItem) + '）'
            + whoLine()
            + L3('\n\n目前的內文：\n', '\n\n目前的内文：\n', '\n\nCurrent text:\n') + cur
            + L3('\n\n要怎麼改：', '\n\n要怎么改：', '\n\nHow to change it: ') + instr;
  const r = await aiOnce(sys, ask);
  blessBusy = false;
  if (r.out){
    studioNote = r.out;
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
  const btn = $('#blessBtn');
  if (btn){ btn.disabled = true; btn.textContent = t().blessing; }
  const sys = isEN()
    ? 'You are Xiaozhi, a spiritual companion from Kingdom 321 Fellowship. From the verse the user gives you, write a short, warm word of encouragement for a brother or sister. First name in one or two sentences what this verse shows of God\'s heart, then one sentence that touches ordinary daily life, then close with a blessing. Three to four sentences, under 60 words. Warm and spoken, never preachy. No headings, no bullet points, no quotation marks, and do not quote the verse again. If it reads as a prayer, close it with "in the name of the Lord Jesus we pray, Amen" — never "in Jesus\' name we ask, Amen."'
    : state.lang === 'zs'
    ? '你是「小智」，国度321空中团契的属灵同伴。请照使用者给的这节经文，写一段温暖的关怀祝福，送给弟兄姊妹。要求：先用一两句点出这节经文里神的心意，再写一句贴近生活的祝福，最后用一句祝福收尾。总共三到四句、120 字以内，口语、温暖、不说教，不要标题、不要条列、不要引号、不要再抄一次经文。若结尾写成祷告，要用「奉主耶稣的名祷告，阿们」，不要用「奉耶稣的名求」。'
    : '你是「小智」，國度321空中團契的屬靈同伴。請照使用者給的這節經文，寫一段溫暖的關懷祝福，送給弟兄姊妹。要求：先用一兩句點出這節經文裡神的心意，再寫一句貼近生活的祝福，最後用一句祝福收尾。總共三到四句、120 字以內，口語、溫暖、不說教，不要標題、不要條列、不要引號、不要再抄一次經文。若結尾寫成禱告，要用「奉主耶穌的名禱告，阿們」，不要用「奉耶穌的名求」。';
  const ask = L3('經文：', '经文：', 'Verse: ') + studioItem.t + ' (' + cardRef(studioItem) + ')' + whoLine();
  const rr_ = await aiOnce(sys, ask);
  const out = rr_.out, why = rr_.why;
  blessBusy = false;
  if (out){
    studioNote = out;
    await studioRefresh();
    toast(t().blessDone);
  } else {
    if (btn){ btn.disabled = false; btn.textContent = '✍️ ' + t().bless; }
    toast(t().chatErr + (why ? '（' + why + '）' : ''), 4000);
  }
}
const pick2 = a => a[isEN() ? (a.length > 2 ? 2 : 0) : (isZS() ? 1 : 0)];
function chips(id, items, cur, attr){
  return `<div class="cardchips" id="${id}">${items.map(([v, n]) =>
    `<button class="${String(cur) === String(v) ? 'on' : ''}" data-${attr}="${v}">${esc(pick2(n))}</button>`).join('')}</div>`;
}
async function studioRefresh(){
  if (curTab() !== 'studio') return;
  const y = window.scrollY;
  await viewStudio($('#view'));
  window.scrollTo(0, y);
}
function curTab(){ return (location.hash || '').indexOf('#/studio') === 0 ? 'studio' : ''; }

async function viewStudio(v){
  const L = t();
  if (!studioItem){ go('#/me'); return; }
  const works = wdb ? (await allRec()).sort((a, b) => b.ts - a.ts) : [];
  const vOK = canVideo();
  v.innerHTML = `
    <div class="chtoolbar">
      <button class="chtb-btn" id="stBack">‹</button>
      <div class="chtb-spacer"></div>
      <div class="muted" style="font-size:12.5px">${esc(cardRef(studioItem))}</div>
    </div>
    <div class="cardpv" id="cardPv"></div>
    <div class="hlsheet-acts" style="margin:0 0 6px">
      <button class="btn primary" id="btShare">${esc(L.cardShare)}</button>
      <button class="btn" id="btSave">${esc(L.cardSave)}</button>
    </div>
    <div class="hl-hint" style="margin:8px 0 18px">${esc(L.cardHint)}</div>

    <div class="section-title">${esc(L.cardText)}</div>
    <div class="card">
      <textarea class="hlsheet-ta" id="cardNote" placeholder="${esc(L.hlNote)}">${esc(studioNote != null ? studioNote : (studioItem.n || ''))}</textarea>
      <div class="hlsheet-acts2">
        <button class="btn sm gold" id="blessBtn">✍️ ${esc(L.bless)}</button>
        <button class="btn sm gold" id="tweakBtn">${esc(tw_().btn)}</button>
        <button class="btn sm" id="noteMine">${esc(L.useMine)}</button>
        <button class="btn sm" id="noteClear">${esc(L.clearText)}</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.blessHint)}</div>
    </div>

    <div class="section-title">${esc(L.cardLines)}</div>
    <div class="card">
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.cardToL)}</div>
      <input class="cardinput" id="cardTo" value="${esc(state.cardTo || '')}"
             placeholder="${esc(L.cardToPH)}">
      <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.cardTopL)}</div>
      <input class="cardinput" id="cardTop" value="${esc(state.cardTop || '')}"
             placeholder="${esc(DEF_TOP())}">
      <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.cardSignL)}</div>
      <input class="cardinput" id="cardSign" value="${esc(state.cardSign || '')}"
             placeholder="${esc(DEF_SIGN())}">
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.cardLinesHint)}</div>
    </div>

    <div class="section-title">${esc(L.cardStyle)}</div>
    ${chips('cTpl', CARD_ORDER.map(k => [k, CARD_TPL[k].n]), cardTpl(), 't')}
    <div class="section-title">${esc(L.cardBorder)}</div>
    ${chips('cBrd', CARD_BORDERS, cardBorder(), 'b')}
    <div class="section-title">${esc(L.cardSize)}</div>
    ${chips('cSz', Object.keys(CARD_SIZES).map(k => [k, CARD_SIZES[k][2]]), cardSize(), 'z')}
    <div class="section-title">${esc(L.cardFsL)}</div>
    ${chips('cFs', CARD_FS, cardFs(), 'f')}
    <div class="muted" style="font-size:12px;margin-top:6px">${esc(L.cardFsHint)}</div>

    <div class="section-title">${esc(L.photo)}</div>
    <div class="card">${photoImg ? `
      ${chips('pMode', [['bg', L.photoBg], ['sticker', L.photoStk]], photoMode, 'm')}
      ${photoMode === 'sticker' ? `
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.stkShape)}</div>
        ${chips('pShape', STK_SHAPES, stkShape, 'v')}
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.stkSize)}</div>
        ${chips('pSize', STK_SIZES, stkSize, 'v')}
        <div class="muted" style="font-size:12px;margin:12px 0 6px">${esc(L.stkPos)}</div>
        ${chips('pPos', STK_POS, stkPos, 'v')}` : ''}
      ${photoBy ? `<div class="muted" style="font-size:11.5px;margin-top:10px">${esc(pl().by + photoBy)}</div>` : ''}
      <div class="hlsheet-acts2" style="margin-top:12px">
        <label class="btn sm" style="cursor:pointer">${esc(L.photoSwap)}<input type="file" accept="image/*" hidden id="pRe"></label>
        <button class="btn sm gold" id="pLib">${esc(pl().libBtn)}</button>
        <button class="btn sm danger" id="pDel">${esc(L.photoDel)}</button>
      </div>` : `
      <button class="btn block gold" id="pLib">${esc(pl().libBtn)}</button>
      <label class="btn block" style="cursor:pointer;margin-top:8px">${esc(L.photoPick)}<input type="file" accept="image/*" hidden id="pNew"></label>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.photoHint)}</div>`}
    </div>

    <div class="section-title">${esc(L.bgm)}</div>
    <div class="card">${bgmBlob ? `
      <div style="font-weight:700;font-size:14px">♪ ${esc(bgmName)}</div>
      ${bgmCredit ? `<div class="muted" style="font-size:11.5px;margin-top:3px">${esc(bgmCredit)}</div>` : ''}
      <div class="muted" style="font-size:12px;margin:4px 0 10px">${esc(L.bgmNote)}</div>
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.bgmVol)}</div>
      ${chips('bVol', BGM_VOLS, bgmVol, 'v')}
      <div class="hlsheet-acts2" style="margin-top:12px">
        <button class="btn sm gold" id="bLib">${esc(hl_().btn)}</button>
        <label class="btn sm" style="cursor:pointer">${esc(L.bgmSwap)}<input type="file" hidden id="bRe"></label>
        <button class="btn sm danger" id="bDel">${esc(L.bgmDel)}</button>
      </div>` : `
      <button class="btn block gold" id="bLib">${esc(hl_().btn)}</button>
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
        <button class="btn gold block" id="mcBtn" style="margin-top:10px">🎵 ${esc(L.mcStart)}</button>
        <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.mcHint)}</div>` : ''}
      <div id="selfieWrap" style="${isSelfie() ? '' : 'display:none'};margin-top:14px">
        <video id="selfiePrev" playsinline webkit-playsinline muted autoplay
          style="width:150px;height:150px;border-radius:50%;object-fit:cover;transform:scaleX(-1);border:3px solid var(--gold);background:#000"></video>
        <div class="muted" style="font-size:12px;margin-top:6px">${esc(L.selfieHint)}</div>
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
  if (isSelfie()) setTimeout(attachSelfie, 60);

  $('#stBack').onclick = () => history.back();
  $('#btShare').onclick = cardShare;
  $('#btSave').onclick = cardDownload;
  const bind = (sel, fn) => $$(sel, v).forEach(b => b.onclick = () => { fn(b); });
  bind('#cTpl button', b => { state.cardTpl = b.dataset.t; saveState(); studioRefresh(); });
  bind('#cBrd button', b => { state.cardBorder = b.dataset.b; saveState(); studioRefresh(); });
  bind('#cSz  button', b => { state.cardSize = b.dataset.z; saveState(); studioRefresh(); });
  bind('#cFs  button', b => { state.cardFs = +b.dataset.f; saveState(); studioRefresh(); });
  bind('#pMode button', b => { photoMode = b.dataset.m; studioRefresh(); });
  bind('#pShape button', b => { stkShape = b.dataset.v; if (stkShape === 'w' && stkSize < .38) stkSize = .46; studioRefresh(); });
  bind('#pSize button', b => { stkSize = +b.dataset.v; studioRefresh(); });
  bind('#pPos button', b => { stkPos = b.dataset.v; studioRefresh(); });
  bind('#bVol button', b => { bgmVol = +b.dataset.v; studioRefresh(); });
  bind('#mLen button', b => { mcLen = +b.dataset.v; studioRefresh(); });
  bind('#rMode button', b => setRecMode(b.dataset.s));
  const pd = $('#pDel'); if (pd) pd.onclick = () => { photoImg = null; photoBy = ''; studioRefresh(); };
  const pl2 = $('#pLib'); if (pl2) pl2.onclick = openPexels;
  const bd = $('#bDel'); if (bd) bd.onclick = () => { bgmBlob = null; bgmName = ''; bgmCredit = ''; studioRefresh(); };
  const blb = $('#bLib'); if (blb) blb.onclick = openHymns;
  ['pNew','pRe'].forEach(id => { const e = $('#' + id); if (e) e.onchange = () => pickPhoto(e); });
  ['bNew','bRe'].forEach(id => { const e = $('#' + id); if (e) e.onchange = () => pickBgm(e); });
  const nt = $('#cardNote');
  if (nt){
    let tmr = null;
    nt.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { studioNote = nt.value; renderCard(studioItem); }, 400); };
  }
  $('#blessBtn').onclick = blessWrite;
  $('#tweakBtn').onclick = openTweak;
  $('#noteMine').onclick  = () => { studioNote = studioItem.n || ''; studioRefresh(); };
  $('#noteClear').onclick = () => { studioNote = ''; studioRefresh(); };
  const bindInput = (id, key) => {
    const e = $('#' + id); if (!e) return;
    let tm = null;
    e.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { state[key] = e.value; saveState(); renderCard(studioItem); }, 400); };
  };
  bindInput('cardTo', 'cardTo');
  bindInput('cardTop', 'cardTop');
  bindInput('cardSign', 'cardSign');
  $('#recBtn').onclick = toggleRec;
  const mb = $('#mcBtn'); if (mb) mb.onclick = musicRec;
  bind('[data-play]', b => playRec(b.dataset.play));
  bind('[data-sh]',   b => shareRec(b.dataset.sh));
  bind('[data-rm]',   b => rmRec(b.dataset.rm));
}
function openStudio(h){ studioItem = h; studioNote = h.n || ''; go('#/studio'); }

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
const tl = () => TEAM_L[state.lang] || TEAM_L.zh;

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
const badgeName = b => isEN() ? b.n[2] : (isZS() ? b.n[1] : b.n[0]);

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
    acts: user.acts || {}, goalN: 0
  };
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
  try{ r = await fetch(API.team, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); }
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
function teamPingSoon(){
  if (!(user.teams || []).length) return;
  clearTimeout(teamPingTimer);
  teamPingTimer = setTimeout(teamPingNow, 20000);
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
      <button class="chtb-btn" id="tmBack">‹</button>
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

  $('#tmBack').onclick = () => go('#/team');
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
  const sys = isEN()
    ? 'You are Xiaozhi, a spiritual companion of Kingdom 321 Fellowship. Write a short, warm piece for a small group: three to four sentences, under 70 words, spoken and personal, never preachy. No headings, no bullets, no quotation marks.'
    : `你是「小智」，國度321空中團契的屬靈同伴。請幫使用者寫一段要貼在小組裡的「${who}」，三到四句、120 字以內，口語、溫暖、不說教，不要標題、不要條列、不要引號。`;
  const ask = (verse ? L3('經文：', '经文：', 'Verse: ') + verse + '\n' : '')
            + L3(`請寫一段${who}。`, `请写一段${who}。`, `Please write a short ${kind} note.`)
            + (ta.value.trim() ? L3('\n我想講的重點：', '\n我想讲的重点：', '\nWhat I want to say: ') + ta.value.trim() : '');
  try{
    const r = await fetch(API.chat, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ system: sys, messages:[{ role:'user', content: ask }] }) });
    if (!r.ok) throw new Error('http ' + r.status);
    const out = extractReply(await r.json().catch(() => null));
    if (!out) throw new Error('empty');
    ta.value = out.replace(/[*#>`]/g, '').replace(/^「|」$/g, '').trim();
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
function mdSpeak(md){
  const zh = !isEN();
  const said = mdTableMap(md, function (head, rows){
    const lead = L3('下面用表格整理：', '下面用表格整理：', 'Here is a summary:');
    const body = rows.map(r =>
      r.map((c, j) => {
        const h = (head[j] || '').trim();
        if (!c) return '';
        return h ? (zh ? h + '是' + c : h + ' is ' + c) : c;
      }).filter(Boolean).join(zh ? '，' : ', ') + (zh ? '。' : '.')
    ).join('\n');
    return lead + '\n' + body;
  });
  return mdStrip(said);
}
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
async function viewCompanion(v){
  const L = t();
  const b = RD.book ? BOOK[RD.book] : null;
  v.innerHTML = `<div class="chatwrap">
      <div class="xz-head"><button class="xz-back" id="xzBack" title="${esc(L.back || '返回')}">‹</button><img src="icon-72.png" alt=""><span>${esc(L.companionFull)}</span></div>
      ${b ? `<div class="chatctx">${esc(L.ctx(bname(b), RD.ch))}</div>` : ''}
      <button class="qs-toggle" id="qsBtn">💡 ${esc(L.examples)}</button>
      <div class="qs-panel" id="qsPanel" hidden></div>
      <div class="chatlog" id="chatlog"></div>
      <div class="chatinput">
        <textarea id="chatIn" rows="1" placeholder="${esc(L.chatPH)}"></textarea>
        <button id="chatSend">${esc(L.send)}</button>
      </div></div>`;
  $('#xzBack', v).onclick = () => {
    /* 從某節經文按「問小智」進來的，直接回讀經那一節；不然就照瀏覽紀錄退回去 */
    if (RD.book) go(`#/read/${RD.book}/${RD.ch}`);
    else if (history.length > 1) history.back();
    else go('#/today');
  };
  const panel = $('#qsPanel', v);
  panel.innerHTML = (QBANK[state.lang] || QBANK.zh).map(q => `<button class="qs-chip">${esc(q)}</button>`).join('');
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
          <button class="msg-act ${isFav(m.text) ? 'on' : ''}" data-a="fav" data-i="${i}">★ ${esc(L3('收藏', '收藏', 'Save'))}</button>
          <button class="msg-act" data-a="share" data-i="${i}">↗ ${esc(L3('分享', '分享', 'Share'))}</button>
          <button class="msg-act" data-a="card" data-i="${i}">🖼 ${esc(L3('做成美圖', '做成美图', 'Make a card'))}</button>
          <button class="msg-act ${sayId === i ? 'on' : ''}" data-a="tts" data-i="${i}">${sayId === i ? '⏸' : '🔊'}</button>
          <button class="msg-act" data-a="del" data-i="${i}">✕</button>
        </div></div>`).join('');
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
  log.scrollTop = log.scrollHeight;
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
  const foot = '\n\n—— ' + (state.cardTop || L3('國度321空中團契', '国度321空中团契', 'Kingdom 321 Fellowship'))
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
/* 直接送進美圖工作室：版型、相片、配樂、錄影全部沿用 */
function chatCard(m){
  const p = chatPack(m);
  const src = p.src;
  openStudio({
    t : p.verse || (isEN() ? 'A word from the Word' : L3('與小智的默想', '与小智的默想', '')),
    n : cardText(m.text),
    b : src ? src.b : RD.book, ch : src ? src.ch : RD.ch,
    v : src ? src.v : 0, v2 : src ? src.v2 : 0, c:'gold', ts: Date.now()
  });
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
const SYS_FMT = () => isEN()
  ? ' Format: you may use a markdown table when comparing or listing things side by side — it renders as a real table, is read aloud as natural sentences, and becomes a clean list when shared. Mark the single most important sentence as a "> " blockquote; that line is what gets turned into a shareable picture. Use short headings. Do not use ASCII art, code blocks or decorative symbols that cannot be read aloud. If you write a prayer, always close it with "in the name of the Lord Jesus we pray, Amen" — never "in Jesus\' name we ask, Amen."'
  : isZS()
  ? ' 回答格式：需要並列或對照时可以用 markdown 表格，画面会画成真正的表格、朗读时会说成自然的句子、分享时会变成清单。请把最重要的那一句用「> 」标成引言，那一句会被做成美图。小标题要短。不要用 ASCII 图案、代码区块或念不出来的装饰符号。若寫到禱告，結尾一律用「奉主耶稣的名祷告，阿们」，不要用「奉耶稣的名求」。'
  : ' 回答格式：需要並列或對照時可以用 markdown 表格，畫面會畫成真正的表格、朗讀時會說成自然的句子、分享時會變成清單。請把最重要的那一句用「> 」標成引言，那一句會被做成美圖。小標題要短。不要用 ASCII 圖案、程式碼區塊或唸不出來的裝飾符號。若寫到禱告，結尾一律用「奉主耶穌的名禱告，阿們」，不要用「奉耶穌的名求」。';
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
  const sys = (isEN()
    ? 'You are Xiaozhi, a Bible companion from Kingdom 321 Fellowship. Answer in the spirit of the 321 vision — Jesus is my example, Scripture is my standard, the Holy Spirit is my guide; let Jesus reign, let Jesus receive all the glory; build what belongs to God. Explain plainly, use everyday pictures, quote the World English Bible, and keep answers short.'
    : isZS()
    ? '你是「小智」，国度321空中团契的圣经陪读。以321理念（耶稣是我的榜样、圣经是我的准则、圣灵是我的引导；让耶稣作王、让耶稣得着一切的荣耀；建立属神的体系）回应，深入浅出、善用比喻，引用和合本圣经，回答简明。'
    : '你是「小智」，國度321空中團契的聖經陪讀。以321理念（耶穌是我的榜樣、聖經是我的準則、聖靈是我的引導；讓耶穌作王、讓耶穌得著一切的榮耀；建立屬神的體系）回應，深入淺出、善用比喻，引用和合本聖經，回答簡明。')
    /* 回答的寫法——使用者定下來的規矩，App 這邊一併配合：
       表格在畫面上畫成真的表格、朗讀時會說成人話、分享時換成清單，
       所以放心用表格；重點用 > 標一句，那一句會被抓去做成美圖。 */
    + SYS_FMT()
    + (b ? (isEN() ? ` (The reader is currently in ${bname(b)} ${RD.ch}.)`
          : isZS() ? `（读者目前在读：${bname(b)} 第 ${RD.ch} 章）`
                   : `（讀者目前在讀：${bname(b)} 第 ${RD.ch} 章）`) : '');
  const payload = JSON.stringify({
    system: sys,
    messages: chatLog.filter(m => m.text !== t().thinking).slice(-12)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
  });
  /* Worker 冷啟動時第一次呼叫常常會失敗，跟朗讀一樣退幾步再試。
     真的連不上就把原因寫出來（http 500／逾時…），才知道是哪一邊的問題。 */
  let reply = '', why = '';
  for (let a = 0; a <= CHAT_RETRY.length; a++){
    try{
      const r = await fetch(API.chat, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: payload
      });
      if (!r.ok) throw new Error('http ' + r.status);
      const data = await r.json().catch(() => null);
      reply = extractReply(data);
      if (!reply) why = '回覆是空的';
      break;
    }catch(e){
      why = (e && e.message) ? String(e.message) : 'network';
      if (a === CHAT_RETRY.length) break;
      await new Promise(r => setTimeout(r, CHAT_RETRY[a]));
    }
  }
  chatLog[chatLog.length - 1] = { role:'ai', src:srcNow,
    text: reply || (t().chatErr + (why ? '（' + why + '）' : '')) };
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

    <div class="card" style="padding:4px 16px">
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
        <div class="segbtns"><button id="updBtn">${esc(L.updCheck)}</button></div></div>
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
      ${esc(L.app)} ${VERSION}<br>和合本聖經屬公有領域，沒有版權限制</div>`;

  $$('#setLang button', v).forEach(b => b.onclick = () => switchLang(b.dataset.l));
  const dg = $('#diagBtn', v); if (dg) dg.onclick = () => runDiag();
  const ub = $('#updBtn', v);
  if (ub){
    const setReady = () => { ub.textContent = L.updReadyBar; ub.classList.add('on'); ub.onclick = applyUpdate; };
    if (updReady) setReady();
    else ub.onclick = async () => { await checkForUpdate(true); if (updReady) setReady(); };
  }
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
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const ct = r.headers.get('content-type') || '?';
    let snip = '';
    try{
      if (/json|text/i.test(ct)) snip = (await r.text()).replace(/\s+/g, ' ').slice(0, 180);
      else snip = '(' + (await r.blob()).size + ' bytes)';
    }catch(e){ snip = '(讀不到內容)'; }
    return `HTTP ${r.status} · ${ct} · ${Date.now() - t0}ms\n${snip}`;
  }catch(e){
    return `連不到（${(e && e.message) || 'network'}）· ${Date.now() - t0}ms`;
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
const TTS_CHUNK = () => isEN() ? TTS_CHUNK_EN : TTS_CHUNK_ZH;
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
const TTS_FIX = [
  [/長老/g, '掌老'], [/長子/g, '掌子'], [/家長/g, '家掌'], [/長大/g, '掌大'],
  [/行為/g, '行圍'], [/為大/g, '圍大'], [/中了/g, '衷了'],
  [/教會/g, '叫會'], [/傳道/g, '船道'], [/朝見/g, '潮見'],
  [/應當/g, '英當'], [/應許/g, '英許'], [/相應/g, '相映'],
  [/看守/g, '刊守'], [/種子/g, '腫子'], [/中間/g, '衷間'],
  [/分開/g, '芬開']            // 分：這裡要唸 fēn（分開），不是 fèn
];
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
    const full = isEN() ? b.en : (isZS() ? b.zs : b.zh);
    const val = { full, ps: b.id === 'Psalms' };
    const keys = isEN() ? [b.en, b.aen] : [(isZS() ? b.zs : b.zh), (isZS() ? b.azs : b.azh)];
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
    if (bk.length === 1 && off > 0 && CJK_RE.test(src.charAt(off - 1))) return m;
    if (isEN() && off > 0 && /[A-Za-z]/.test(src.charAt(off - 1))) return m;
    const it = r.map[bk] || { full:bk, ps:false };
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
function ttsPrep(s){
  let x = noEmoji(ttsRef(s));
  x = x.replace(/〔[^〕]*〕/g, '').replace(/\[[^\]]*\]/g, '');   // 譯者註不朗讀
  if (isEN()) return x.replace(/\s+/g, ' ').trim();                  // 英文不做破音字修正
  x = x.replace(/[「」『』（）]/g, '');
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
  a.onerror = () => {
    ttsClearWatchdog();
    if (gen !== spk.gen) return;
    if (i === 0) ttsNativeFrom(i, gen); else if (spk.on && !spk.abort) ttsPlayFrom(i + 1, gen);
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
    if (i === 0) ttsNativeFrom(i, gen); else if (spk.on && !spk.abort) ttsPlayFrom(i + 1, gen);
  }
}
function ttsNativeFrom(i, gen){
  if (gen !== spk.gen) return;
  if (!('speechSynthesis' in window)){ toast(t().ttsErr); ttsStop(true); return; }
  if (!spk.native){ spk.native = true; toast(t().ttsFallback + (ttsLastErr ? '（' + ttsLastErr + '）' : '')); }
  if (!spk.on || spk.abort || i >= spk.items.length){ ttsStop(i >= spk.items.length); return; }
  spk.idx = i; raShow(spk.items[i]); ttsBtn('playing');
  const say = ttsPrep(spk.items[i].text);
  const u = new SpeechSynthesisUtterance(say);
  u.lang = isEN() ? 'en-US' : (isZS() ? 'zh-CN' : 'zh-TW'); u.rate = .95;
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
      u.lang = isEN() ? 'en-US' : (isZS() ? 'zh-CN' : 'zh-TW');
      u.onend = done; u.onerror = done;
      speechSynthesis.speak(u); toast(t().ttsFallback);
    } else { toast(t().ttsErr); done(); }
  }
}

/* ================================================================ 自動更新
   舊版本（已經加到主畫面／之前打開過的）要能自動跟上新版本，靠這裡：
   每次回到前景、以及背景每隔一段時間，都請瀏覽器去問一次新版本有沒有出來；
   找到了就先在背景悄悄下載好，準備好了才提醒「點一下更新」──
   不會沒說一聲就把正在讀經、正在打字的畫面整個重新整理掉。 */
let swReg = null, updReady = false;
function updBar(show){
  let d = $('#updbar');
  if (show){
    if (!d){
      d = document.createElement('div'); d.id = 'updbar'; d.className = 'updbar';
      d.textContent = t().updReadyBar;
      d.onclick = applyUpdate;
      document.body.appendChild(d);
    } else d.textContent = t().updReadyBar;
  } else if (d) d.remove();
}
function applyUpdate(){
  updBar(false);
  toast(t().updApplying);
  let done = false;
  const reload = () => { if (!done){ done = true; location.reload(); } };
  if (navigator.serviceWorker){
    navigator.serviceWorker.addEventListener('controllerchange', reload);
    if (swReg && swReg.waiting) try{ swReg.waiting.postMessage('skipWaiting'); }catch(e){}
  }
  setTimeout(reload, 1500);   // 保底：萬一等不到 controllerchange 就直接重整
}
function watchForUpdate(reg){
  const track = w => { if (w) w.addEventListener('statechange', () => {
    if (w.state === 'installed' && navigator.serviceWorker.controller){ updReady = true; updBar(true); }
  }); };
  track(reg.installing); track(reg.waiting);
  reg.addEventListener('updatefound', () => track(reg.installing));
}
async function checkForUpdate(manual){
  if (manual){
    const out = $('#updOut'); if (out) out.textContent = t().updChecking;
  }
  if (!swReg){ if (manual) toast(t().updFail); return; }
  try{
    await swReg.update();
    if (manual){
      await new Promise(r => setTimeout(r, 400));   // 讓 statechange 有時間跑完，才知道是不是真的有新版本
      const out = $('#updOut');
      if (out) out.textContent = updReady ? t().updFound : t().updLatest;
      if (!updReady) toast(t().updLatest);
    }
  }catch(e){ if (manual) toast(t().updFail); }
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
    openWDB();                       // 作品庫（不擋開機）
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
  window.addEventListener('resize', syncHeaderH);
  window.addEventListener('orientationchange', () => setTimeout(syncHeaderH, 200));
  if ('serviceWorker' in navigator){
    try{
      swReg = await navigator.serviceWorker.register('sw.js');
      watchForUpdate(swReg);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkForUpdate(false); });
      setInterval(() => checkForUpdate(false), 30 * 60 * 1000);   // 背景每 30 分鐘問一次
    }catch(e){}
  }
  setTimeout(ttsWarmUp, 1200);
  if ((user.teams || []).length) setTimeout(teamPingNow, 2500);   // 開 App 就把今天的進度同步給隊友
}
boot();
