/* ============================================================================
   321互動聖經 — 和合本．去章節．只留經文
   國度321空中團契 ／ 架構沿用《321領導力》App
   ----------------------------------------------------------------------------
   ⚙ 端點與請求格式：與《321領導力》／《晨讀321》共用同一組 Cloudflare Worker，
      request/response 契約已照 321領導力 app.js 實際使用的格式對齊。
   ========================================================================== */
const API = {
  chat: 'https://xiaozhi-proxy.spch321.workers.dev',   // {system, messages:[{role,content}]}
  tts : 'https://azure-tts.spch321.workers.dev'        // {voice, rate, sil, silc, sile, text}
};
const TTS_SIL = 140, TTS_SILC = 140, TTS_SILE = 260, TTS_RATE = '+0%';
const VERSION = 'v1.5.0';

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
        prev:'上一章', next:'下一章', toc:'目錄', pure:'閱讀方式', note:'註釋',
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
        myHl:'我的畫線', myFav:'我的收藏', settings:'設定', font:'字級大小', theme:'主題',
        fonts:['標準','大','特大','超大'], themes:['自動','日','夜','羊皮紙'],
        voice:'朗讀聲音', langLabel:'語言', stats:['已讀章數','畫線','書籤'],
        diag:'連線測試', diagRun:'測試小智與朗讀', diagBusy:'測試中…',
        card:'做成美圖', cardTitle:'做成美圖分享', cardStyle:'版型', cardSize:'尺寸',
        cardBorder:'邊框', cardFsL:'內文字級', cardFsHint:'只放大卡片上的內文，經文與署名維持不變。',
        cardText:'卡片內文', bless:'請小智寫祝福', blessing:'小智寫作中…', blessDone:'小智寫好了',
        blessHint:'可以自己寫，也可以請小智照這節經文寫一段關懷祝福；改完卡片會立刻跟著變。',
        useMine:'用我的領受', clearText:'不要內文',
        cardLines:'卡片上下的署名', cardTopL:'上面（團體名）', cardSignL:'下面（署名）',
        cardLinesHint:'留空就用預設。例如下面改成「愛你的財哥、珍姐　敬上」。',
        cardShare:'分享', cardSave:'存到相簿',
        cardHint:'按「分享」可直接選 LINE／IG／FB 傳出去；也可以長按上面的圖片存起來。',
        cardSaved:'已下載，請從相簿分享',
        photo:'加一張相片（選用）', photoPick:'從相簿選相片', photoSwap:'換一張', photoDel:'移除相片',
        photoBg:['作背景','作背景'], photoStk:['貼在卡片上','贴在卡片上'],
        photoHint:'可以當卡片背景，也可以像貼紙貼上去，大小與位置都能調。',
        photoBad:'這張相片讀不出來，換一張試試',
        stkShape:'相片形狀', stkSize:'相片大小', stkPos:'相片位置',
        bgm:'背景音樂（選用）', bgmPick:'從檔案選音樂', bgmSwap:'換一首', bgmDel:'移除音樂',
        bgmVol:'音樂音量', bgmNote:'錄製時會自動循環，混進影片或錄音裡。',
        bgmHint:'選一首詩歌或輕音樂；若一時找不到，按選擇視窗左下角「瀏覽」，再到 iCloud 雲碟或「我的 iPhone」裡找。',
        bgmBad:'這不是音樂檔，請選 mp3、m4a、wav 等音檔', bgmBig:'音檔太大（超過 25MB），請選短一點的',
        bgmAdded:'已加入背景音樂', bgmNeed:'請先選一首背景音樂',
        recSec:'錄成影片', recVoice:'只有聲音', recSelfie:'自拍畫面',
        recIntro:'按下開始，對著手機把這段經文與領受讀出來。可以只錄聲音，也可以加上自拍畫面，合成一支影片直接傳出去。',
        recIntroA:'這台裝置不支援合成影片，會先錄成語音；播放時可用手機「螢幕錄影」錄成影片。',
        recReady:'按下開始，把想說的話錄進去', recStartV:'開始錄影片', recStartS:'開始自拍錄影',
        recStartA:'開始錄音', recStop:'停止並完成', recing:'錄影中…', recingA:'錄音中…',
        recTip:'建議 30～60 秒：先讀經文，再說這段話對你的意思。',
        recDoneV:'影片做好了！可以分享出去', recDoneA:'錄好了！可以播放或分享',
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
        chatErr:'小智連不上，請稍後再試。' },
  zs: { app:'321互动圣经', today:'今日', books:'经卷', search:'搜索', companion:'小智', companionFull:'小智AI属灵同伴', me:'我的',
        ot:'旧约', nt:'新约', ch:'章', chapter:n=>`第 ${n} 章`, verses:'节', bookUnit:'卷',
        cont:'继续阅读', start:'开始读经', daily:'今日默想', progress:'读经进度',
        prev:'上一章', next:'下一章', toc:'目录', pure:'阅读方式', note:'注释',
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
        myHl:'我的划线', myFav:'我的收藏', settings:'设置', font:'字级大小', theme:'主题',
        fonts:['标准','大','特大','超大'], themes:['自动','日','夜','羊皮纸'],
        voice:'朗读声音', langLabel:'语言', stats:['已读章数','划线','书签'],
        diag:'连线测试', diagRun:'测试小智与朗读', diagBusy:'测试中…',
        card:'做成美图', cardTitle:'做成美图分享', cardStyle:'版型', cardSize:'尺寸',
        cardBorder:'边框', cardFsL:'内文字级', cardFsHint:'只放大卡片上的内文，经文与署名维持不变。',
        cardText:'卡片内文', bless:'请小智写祝福', blessing:'小智写作中…', blessDone:'小智写好了',
        blessHint:'可以自己写，也可以请小智照这节经文写一段关怀祝福；改完卡片会立刻跟着变。',
        useMine:'用我的领受', clearText:'不要内文',
        cardLines:'卡片上下的署名', cardTopL:'上面（团体名）', cardSignL:'下面（署名）',
        cardLinesHint:'留空就用预设。例如下面改成“爱你的财哥、珍姐　敬上”。',
        cardShare:'分享', cardSave:'存到相册',
        cardHint:'按“分享”可直接选 LINE／IG／FB 传出去；也可以长按上面的图片存起来。',
        cardSaved:'已下载，请从相册分享',
        photo:'加一张相片（选用）', photoPick:'从相册选相片', photoSwap:'换一张', photoDel:'移除相片',
        photoBg:['作背景','作背景'], photoStk:['贴在卡片上','贴在卡片上'],
        photoHint:'可以当卡片背景，也可以像贴纸贴上去，大小与位置都能调。',
        photoBad:'这张相片读不出来，换一张试试',
        stkShape:'相片形状', stkSize:'相片大小', stkPos:'相片位置',
        bgm:'背景音乐（选用）', bgmPick:'从文件选音乐', bgmSwap:'换一首', bgmDel:'移除音乐',
        bgmVol:'音乐音量', bgmNote:'录制时会自动循环，混进视频或录音里。',
        bgmHint:'选一首诗歌或轻音乐；若一时找不到，按选择窗口左下角“浏览”，再到 iCloud 云碟或“我的 iPhone”里找。',
        bgmBad:'这不是音乐文件，请选 mp3、m4a、wav 等音频', bgmBig:'音频太大（超过 25MB），请选短一点的',
        bgmAdded:'已加入背景音乐', bgmNeed:'请先选一首背景音乐',
        recSec:'录成视频', recVoice:'只有声音', recSelfie:'自拍画面',
        recIntro:'按下开始，对着手机把这段经文与领受读出来。可以只录声音，也可以加上自拍画面，合成一支视频直接传出去。',
        recIntroA:'这台设备不支持合成视频，会先录成语音；播放时可用手机“录屏”录成视频。',
        recReady:'按下开始，把想说的话录进去', recStartV:'开始录视频', recStartS:'开始自拍录像',
        recStartA:'开始录音', recStop:'停止并完成', recing:'录像中…', recingA:'录音中…',
        recTip:'建议 30～60 秒：先读经文，再说这段话对你的意思。',
        recDoneV:'视频做好了！可以分享出去', recDoneA:'录好了！可以播放或分享',
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
        chatErr:'小智连不上，请稍后再试。' },
  en: { app:'321 Interactive Bible', today:'Today', books:'Books', search:'Search', companion:'Xiaozhi',
        companionFull:'Xiaozhi — AI Companion', me:'Me',
        ot:'Old Testament', nt:'New Testament', ch:'ch', chapter:n=>`Chapter ${n}`, verses:'verses', bookUnit:'books',
        cont:'Continue reading', start:'Start reading', daily:"Today's meditation", progress:'Reading progress',
        prev:'Previous', next:'Next', toc:'Contents', pure:'Reading mode', note:'Notes',
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
        myHl:'My highlights', myFav:'My saved replies', settings:'Settings', font:'Text size', theme:'Theme',
        fonts:['Normal','Large','Larger','Largest'], themes:['Auto','Day','Night','Parchment'],
        voice:'Reading voice', langLabel:'Language', stats:['Chapters read','Highlights','Bookmarks'],
        diag:'Connection test', diagRun:'Test Xiaozhi and read-aloud', diagBusy:'Testing…',
        card:'Make an image', cardTitle:'Make an image to share', cardStyle:'Style', cardSize:'Size',
        cardBorder:'Border', cardFsL:'Body text size', cardFsHint:'Only the body text on the card changes; the verse and the signature stay as they are.',
        cardText:'Card text', bless:'Ask Xiaozhi to write', blessing:'Xiaozhi is writing…', blessDone:'Xiaozhi has written it',
        blessHint:'Write it yourself, or let Xiaozhi write a short blessing from this verse. The card updates as you type.',
        useMine:'Use my reflection', clearText:'No body text',
        cardLines:'Lines above and below', cardTopL:'Top (your fellowship)', cardSignL:'Bottom (signature)',
        cardLinesHint:'Leave blank for the default — for example, “With love, Alex & Joy”.',
        cardShare:'Share', cardSave:'Save to photos',
        cardHint:'Tap Share to send it straight to LINE, Instagram or Facebook — or press and hold the image to save it.',
        cardSaved:'Downloaded — share it from your photos',
        photo:'Add a photo (optional)', photoPick:'Choose a photo', photoSwap:'Change photo', photoDel:'Remove photo',
        photoBg:['As background','As background'], photoStk:['As a sticker','As a sticker'],
        photoHint:'Use it as the card background, or stick it on like a polaroid. Size and position are adjustable.',
        photoBad:"That photo could not be read — try another one",
        stkShape:'Photo shape', stkSize:'Photo size', stkPos:'Photo position',
        bgm:'Background music (optional)', bgmPick:'Choose music', bgmSwap:'Change music', bgmDel:'Remove music',
        bgmVol:'Music volume', bgmNote:'It loops quietly under your voice while you record.',
        bgmHint:'Pick a hymn or something gentle. If you cannot find it, tap Browse at the bottom left and look in iCloud Drive or On My iPhone.',
        bgmBad:'That is not an audio file — choose an mp3, m4a or wav', bgmBig:'That file is too large (over 25MB) — choose a shorter one',
        bgmAdded:'Music added', bgmNeed:'Choose some background music first',
        recSec:'Record a video', recVoice:'Voice only', recSelfie:'With selfie',
        recIntro:'Tap start and read the verse aloud. Record your voice alone, or add your face, and it becomes a video you can send straight to anyone.',
        recIntroA:'This device cannot build a video, so it will record audio only. You can use Screen Recording while it plays.',
        recReady:'Tap start and say what is on your heart', recStartV:'Start recording', recStartS:'Start selfie recording',
        recStartA:'Start recording', recStop:'Stop and finish', recing:'Recording…', recingA:'Recording…',
        recTip:'30–60 seconds works well: read the verse, then say what it means to you.',
        recDoneV:'Your video is ready to share', recDoneA:'Recorded — you can play it or share it',
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
        chatErr:'Xiaozhi is unreachable. Please try again shortly.' }
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
                   cardTop:'', cardSign:'',
                   voice:{zh:0, zs:0, en:0} };
/* 「淨」鍵依序切換的四種組合：[整卷連讀?, 顯示章號?] */
/* 「淨」鍵循環的四種常用讀法：[整卷連讀, 顯示章, 顯示節] */
const VIEW_CYCLE = [[false, true, true], [false, true, false], [false, false, false], [true, false, false]];
let state = Object.assign({}, DEFAULTS);
let user  = { progress:{}, hl:{}, fav:[], marks:[], last:null };
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
    user = Object.assign({progress:{}, hl:{}, fav:[], marks:[], last:null}, u);
    if (!Array.isArray(user.marks)) user.marks = [];
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
  ['today','books','search','companion','me'].forEach(k => { const e = $('#tab-' + k); if (e) e.textContent = t()[k]; });
  $$('#langswitch button').forEach(b => b.classList.toggle('active', b.dataset.lang === state.lang));
}

/* ---------------------------------------------------------------- 資料 */
/* 讀資料檔。少一個檔就直接說出檔名——不要讓瀏覽器把 404 頁面當成 JSON 去解析，
   那樣只會冒出「The string did not match the expected pattern」這種看不懂的訊息。 */
async function fetchJSON(file){
  let r;
  try{ r = await fetch(file); }
  catch(e){ throw new Error(`讀不到 ${file}（網路問題）`); }
  if (!r.ok) throw new Error(`網站上找不到 ${file}（HTTP ${r.status}）──這個檔還沒上傳`);
  try{ return await r.json(); }
  catch(e){ throw new Error(`${file} 的內容不是有效的 JSON，請重新上傳這個檔`); }
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
let bmMode = false;                 // 書籤模式（只存在當下，不寫進設定）
function anchorEl(a){
  return a ? $(`#reader .sent[data-c="${a.c}"][data-p="${a.p}"][data-s="${a.s}"]`) : null;
}
function scrollToAnchor(a){
  const el = anchorEl(a);
  if (!el) return false;
  requestAnimationFrame(() => {
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo(0, Math.max(0, y));
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
  $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === (tab === 'read' ? 'books' : tab)));
  const v = $('#view');
  try{
    if (tab === 'today')          await viewToday(v);
    else if (tab === 'books')     await viewBooks(v, r[1]);
    else if (tab === 'read')      await viewReader(v, r[1], parseInt(r[2] || '1', 10));
    else if (tab === 'search')    await viewSearch(v);
    else if (tab === 'companion') await viewCompanion(v);
    else if (tab === 'me')        await viewMe(v);
    else if (tab === 'studio')    await viewStudio(v);
    else { go('#/today'); return; }
  }catch(e){
    v.innerHTML = `<div class="empty">載入失敗：${esc(e.message || e)}</div>`;
    console.error(e);
  }
  if (tab !== 'read'){ bmMode = false; document.documentElement.classList.remove('bmmode'); }
  if (tab !== 'studio'){ stopSelfie(); recSelfie = false; }
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
      <div style="flex:1"><div style="font-family:'Noto Serif TC',serif;font-weight:900;font-size:19px">${esc(bname(b))}</div>
      <div class="muted">${b.ch} ${esc(L.ch)} · ${b.v} ${esc(L.verses)}</div></div></div>
    <div class="chgrid">${Array.from({length: b.ch}, (_, i) => {
      const n = i + 1, read = user.progress[bookId + '-' + n];
      return `<button class="chbtn ${n === cur ? 'now' : (read ? 'read' : '')}" data-c="${n}">${n}</button>`;
    }).join('')}</div>`;
  $('#backBooks', v).onclick = () => go('#/books');
  $$('.chbtn', v).forEach(x => x.onclick = () => go(`#/read/${bookId}/${x.dataset.c}`));
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
  const body = chap.map((bl, bi) => {
    if (bl[0] === 'b') return '<div class="stanza"></div>';
    let inner = '', notes = '', si = 0, curV = 0;
    for (let j = 1; j < bl.length; j += 2){
      const vno = bl[j], txt = bl[j + 1];
      if (vno){ inner += `<span class="vn">${vno}</span>`; curV = vno; }
      for (const sx of splitSentences(txt)){
        const k = hlKey(bookId, cno, bi, si);
        const h = user.hl[k];
        inner += `<span class="sent" data-c="${cno}" data-p="${bi}" data-s="${si}" data-v="${curV}"`
               + `${h ? ` data-hl="1" data-color="${h.c}"` : ''}${bm.has(k) ? ' data-bm="1"' : ''}`
               + `>${markNotes(esc(sx))}</span>`;
        if (h && h.n) notes += `<div class="hl-note" data-c="${cno}" data-p="${bi}" data-s="${si}" data-color="${h.c}">${esc(h.n)}</div>`;
        si++;
      }
    }
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
      <button class="chtb-btn" id="rdTts">🔊</button>
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
  $('#rdTts').onclick  = () => ttsToggle();

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

  window.scrollTo(0, 0);
  const want = jumpTo; jumpTo = null;
  if (!(want && scrollToAnchor(want)) && flow && ch > 1){
    const target = $(`#reader p[data-c="${ch}"]`);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block:'start' }));
  }
  watchProgress(bookId, flow, b.ch);
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
  if (!user.progress[k]){ user.progress[k] = Date.now(); saveUser(); }
}
/* ================================================================ 畫線 / 默想 */
function onSentTap(el){
  const cno = +el.dataset.c || RD.ch;
  if (bmMode){ toggleBm(el, cno); return; }
  const k = hlKey(RD.book, cno, el.dataset.p, el.dataset.s);
  if (!user.hl[k]){
    user.hl[k] = { c:'gold', n:'', t:el.textContent, b:RD.book, ch:cno, v:+el.dataset.v || 0, ts:Date.now() };
    el.setAttribute('data-hl', '1'); el.setAttribute('data-color', 'gold');
    saveUser();
  } else {
    openHlSheet(el);
  }
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
function openHlSheet(el){
  const L = t();
  const k = hlKey(RD.book, +el.dataset.c || RD.ch, el.dataset.p, el.dataset.s);
  const h = user.hl[k]; if (!h) return;
  const mask = document.createElement('div'); mask.className = 'hlsheet-mask';
  mask.innerHTML = `<div class="hlsheet-card">
    <div class="hlsheet-title">${esc(L.hlTitle)}</div>
    <span class="hlsheet-quote">${esc(h.t)}</span>
    <div class="hlsheet-colorrow"><span class="hlsheet-colorlabel">${esc(L.hlColor)}</span>
      <div class="hlsheet-colors">${HL_COLORS.map(c =>
        `<button class="hlswatch ${h.c === c ? 'active' : ''}" data-c="${c}" style="background:${HL_SWATCH[c]}"></button>`).join('')}</div></div>
    <textarea class="hlsheet-ta" placeholder="${esc(L.hlNote)}">${esc(h.n || '')}</textarea>
    <div class="hlsheet-acts">
      <button class="btn primary" data-a="save">${esc(L.save)}</button>
      <button class="btn" data-a="ask">${esc(L.ask)}</button>
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
    el.setAttribute('data-color', color);
    const nt = $(`#reader .hl-note[data-c="${el.dataset.c}"][data-p="${el.dataset.p}"][data-s="${el.dataset.s}"]`);
    if (nt) nt.setAttribute('data-color', color);
  });
  const ta = $('.hlsheet-ta', mask);
  const commit = () => {
    h.c = color; h.n = ta.value.trim(); saveUser();
    mask.remove(); render();
  };
  $$('[data-a]', mask).forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'save') commit();
    else if (a === 'card'){
      h.c = color; h.n = ta.value.trim(); saveUser();
      mask.remove(); openStudio(h);
    }
    else if (a === 'close') mask.remove();
    else if (a === 'del'){ delete user.hl[k]; saveUser(); mask.remove(); render(); }
    else if (a === 'ask'){
      h.c = color; h.n = ta.value.trim(); saveUser(); mask.remove();
      chatPending = isEN() ? `Help me meditate on this verse: “${h.t}”`
                : `${isZS() ? '请就这句经文帮助我默想：' : '請就這句經文幫助我默想：'}「${h.t}」`;
      go('#/companion');
    }
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
    im.onload = () => { photoImg = im; if (!photoMode) photoMode = 'bg'; studioRefresh(); };
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
  bgmBlob = f; bgmName = f.name || '背景音樂'; studioRefresh(); toast(t().bgmAdded);
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
  return h.v ? `${nm} ${h.ch}:${h.v}` : (h.b === 'Psalms' ? chapLabel(h.b, h.ch) : `${nm} ${t().chapter(h.ch)}`);
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

function drawVerseCard(cv, h, W, H){
  const ctx = cv.getContext('2d'); cv.width = W; cv.height = H;
  const T = CARD_TPL[cardTpl()];
  const F = W / 1080, pad = Math.round(W * .085), iw = W - pad * 2;
  const sans = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  const serif = '"Noto Serif TC","Songti TC","STSong","PMingLiU",serif';

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
  const grpSz = Math.round(27 * F), grpY = pad + Math.round(42 * F);
  ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `600 ${grpSz}px ${sans}`;
  const gw = ctx.measureText(grp).width;
  ctx.fillText(grp, W / 2, grpY);
  ctx.strokeStyle = T.frame.replace(/[\d.]+\)$/, '0.6)'); ctx.lineWidth = Math.max(1, 1.5 * F);
  [[W / 2 - gw / 2 - 28 * F, -1], [W / 2 + gw / 2 + 28 * F, 1]].forEach(([x0, d]) => {
    ctx.beginPath(); ctx.moveTo(x0, grpY - 9 * F); ctx.lineTo(x0 + d * 30 * F, grpY - 9 * F); ctx.stroke();
  });

  /* 版位：經文＋領受垂直置中 */
  const hasSticker = photoImg && photoMode === 'sticker' && !suppressSticker;
  const stkBottom = hasSticker && stkPos !== 'tl' && stkPos !== 'tr';
  const liftRoom = stkBottom ? Math.round(W * stkSize * stkRatio()) + Math.round(30 * F) : 0;
  const topRoom = pad + Math.round(100 * F), botRoom = pad + Math.round(70 * F) + liftRoom;
  const room = H - topRoom - botRoom;
  const FB = cardFs();          /* 領受字級（經文不變，版面才不會被擠掉） */
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

  /* 出處 */
  ctx.font = `${Math.round(30 * F)}px ${sans}`; ctx.fillStyle = T.gold;
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
  ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `600 ${Math.round(25 * F)}px ${sans}`;
  const sign = (state.cardSign || '').trim()
            || DEF_SIGN();
  let ss = Math.round(25 * F);
  while (ss > Math.round(15 * F)){ ctx.font = `600 ${ss}px ${sans}`; if (ctx.measureText(sign).width <= iw) break; ss -= 2; }
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
function cardDownload(){
  if (!cardImg) return;
  const a = document.createElement('a');
  a.href = cardImg; a.download = '321bible-' + Date.now() + '.png'; a.click();
  toast(t().cardSaved, 3200);
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
let recSelfie = false, selfieStream = null, __mcGain = null;
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
async function setSelfie(on){
  recSelfie = !!on;
  if (!on){ stopSelfie(); studioRefresh(); return; }
  try{
    selfieStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false });
  }catch(e){ recSelfie = false; toast(t().camDeny); }
  studioRefresh();
  setTimeout(attachSelfie, 60);
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
    recAnim = requestAnimationFrame(loop);
  };
  loop();
  const lb = $('#liveBox');
  if (lb){
    cv.style.cssText = 'width:100%;max-width:300px;border-radius:14px;display:block;margin:0 auto;box-shadow:0 6px 20px rgba(0,0,0,.14)';
    lb.innerHTML = ''; lb.appendChild(cv); lb.hidden = false;
    const sw = $('#selfieWrap'); if (sw) sw.style.display = 'none';
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
async function saveWork(blob, type, kind){
  try{
    if (kind === 'video') blob = await fixVideoBlob(blob, type);
    if (!wdb) await openWDB();
    if (!wdb) throw new Error('IndexedDB 打不開');
    await putRec({ id:uid(), ts:Date.now(), blob, mime:blob.type || type, kind, dur:recSec,
                   v:studioItem.t, r:cardRef(studioItem), n:studioItem.n || '' });
    mr = null;
    await studioRefresh();
    toast(kind === 'video' ? t().recDoneV : t().recDoneA, 3600);
  }catch(e){
    mr = null;
    console.error('saveWork', e);
    await studioRefresh();
    toast('存檔失敗：' + (e && e.message || e), 4000);
  }
}
async function toggleRec(){
  if (mr && mr.state === 'recording'){ mr.stop(); return; }
  if (!studioItem) return;
  let mic;
  try{ mic = await navigator.mediaDevices.getUserMedia({ audio:true }); }
  catch(e){ toast(t().micDeny); return; }

  const svid = $('#selfiePrev');
  const useSelfie = recSelfie && svid && svid.videoWidth;
  let ac = null, bgmEl = null, bgmURL = null, audioStream = mic;
  if (bgmBlob){
    try{
      ac = new (window.AudioContext || window.webkitAudioContext)();
      try{ await ac.resume(); }catch(_){}
      const micSrc = ac.createMediaStreamSource(mic);
      bgmURL = URL.createObjectURL(bgmBlob);
      bgmEl = new Audio(); bgmEl.src = bgmURL; bgmEl.loop = true; bgmEl.crossOrigin = 'anonymous';
      const gain = ac.createGain(); gain.gain.value = bgmVol;
      const dst = ac.createMediaStreamDestination();
      micSrc.connect(dst);
      ac.createMediaElementSource(bgmEl).connect(gain).connect(dst);
      audioStream = dst.stream;
      await bgmEl.play().catch(() => {});
    }catch(e){ ac = null; bgmEl = null; audioStream = mic; }
  }

  let stream = audioStream, kind = 'audio', mime = audMime();
  if (canVideo()){
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
    await saveWork(new Blob(chunks, { type }), type, kind);
  };
  mr.start(1000);
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
    const gain = ac.createGain(); gain.gain.value = 1; __mcGain = gain;
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
    await saveWork(new Blob(chunks, { type }), type, 'video');
  };
  mr.start(1000);
  try{ await bgmEl.play(); }catch(e){}
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
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = '321bible-' + (r.kind === 'video' ? 'video' : 'voice') + extOf(mime); a.click();
  setTimeout(() => URL.revokeObjectURL(u), 6000);
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
  dlRec(id); toast(t().cardSaved, 3200);
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

/* 請小智照這節經文寫一段關懷祝福，直接放進卡片內文 */
async function blessWrite(){
  if (blessBusy || !studioItem) return;
  blessBusy = true;
  const btn = $('#blessBtn');
  if (btn){ btn.disabled = true; btn.textContent = t().blessing; }
  const sys = isEN()
    ? 'You are Xiaozhi, a spiritual companion from Kingdom 321 Fellowship. From the verse the user gives you, write a short, warm word of encouragement for a brother or sister. First name in one or two sentences what this verse shows of God\'s heart, then one sentence that touches ordinary daily life, then close with a blessing. Three to four sentences, under 60 words. Warm and spoken, never preachy. No headings, no bullet points, no quotation marks, and do not quote the verse again.'
    : state.lang === 'zs'
    ? '你是「小智」，国度321空中团契的属灵同伴。请照使用者给的这节经文，写一段温暖的关怀祝福，送给弟兄姊妹。要求：先用一两句点出这节经文里神的心意，再写一句贴近生活的祝福，最后用一句祝福收尾。总共三到四句、120 字以内，口语、温暖、不说教，不要标题、不要条列、不要引号、不要再抄一次经文。'
    : '你是「小智」，國度321空中團契的屬靈同伴。請照使用者給的這節經文，寫一段溫暖的關懷祝福，送給弟兄姊妹。要求：先用一兩句點出這節經文裡神的心意，再寫一句貼近生活的祝福，最後用一句祝福收尾。總共三到四句、120 字以內，口語、溫暖、不說教，不要標題、不要條列、不要引號、不要再抄一次經文。';
  const ask = L3('經文：', '经文：', 'Verse: ') + studioItem.t + ' (' + cardRef(studioItem) + ')';
  let out = '', why = '';
  for (let a = 0; a <= CHAT_RETRY.length; a++){
    try{
      const r = await fetch(API.chat, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ system: sys, messages:[{ role:'user', content: ask }] }) });
      if (!r.ok) throw new Error('http ' + r.status);
      out = extractReply(await r.json().catch(() => null));
      if (!out) why = '回覆是空的';
      break;
    }catch(e){
      why = (e && e.message) ? String(e.message) : 'network';
      if (a === CHAT_RETRY.length) break;
      await new Promise(rs => setTimeout(rs, CHAT_RETRY[a]));
    }
  }
  blessBusy = false;
  if (out){
    studioNote = out.replace(/[*#>`]/g, '').replace(/^「|」$/g, '').trim();
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
        <button class="btn sm" id="noteMine">${esc(L.useMine)}</button>
        <button class="btn sm" id="noteClear">${esc(L.clearText)}</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.blessHint)}</div>
    </div>

    <div class="section-title">${esc(L.cardLines)}</div>
    <div class="card">
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.cardTopL)}</div>
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
      <div class="hlsheet-acts2" style="margin-top:12px">
        <label class="btn sm" style="cursor:pointer">${esc(L.photoSwap)}<input type="file" accept="image/*" hidden id="pRe"></label>
        <button class="btn sm danger" id="pDel">${esc(L.photoDel)}</button>
      </div>` : `
      <label class="btn block" style="cursor:pointer">${esc(L.photoPick)}<input type="file" accept="image/*" hidden id="pNew"></label>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.photoHint)}</div>`}
    </div>

    <div class="section-title">${esc(L.bgm)}</div>
    <div class="card">${bgmBlob ? `
      <div style="font-weight:700;font-size:14px">♪ ${esc(bgmName)}</div>
      <div class="muted" style="font-size:12px;margin:4px 0 10px">${esc(L.bgmNote)}</div>
      <div class="muted" style="font-size:12px;margin-bottom:6px">${esc(L.bgmVol)}</div>
      ${chips('bVol', BGM_VOLS, bgmVol, 'v')}
      <div class="hlsheet-acts2" style="margin-top:12px">
        <label class="btn sm" style="cursor:pointer">${esc(L.bgmSwap)}<input type="file" hidden id="bRe"></label>
        <button class="btn sm danger" id="bDel">${esc(L.bgmDel)}</button>
      </div>` : `
      <label class="btn block" style="cursor:pointer">${esc(L.bgmPick)}<input type="file" hidden id="bNew"></label>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.bgmHint)}</div>`}
    </div>

    <div class="section-title">${esc(L.recSec)}</div>
    <div class="card" style="text-align:center">
      <div class="muted" style="font-size:12.5px;text-align:left;margin-bottom:10px">${esc(vOK ? L.recIntro : L.recIntroA)}</div>
      ${vOK ? `<div class="cardchips" id="rMode" style="justify-content:center;margin-bottom:12px">
        <button class="${!recSelfie ? 'on' : ''}" data-s="0">${esc(L.recVoice)}</button>
        <button class="${recSelfie ? 'on' : ''}" data-s="1">📷 ${esc(L.recSelfie)}</button></div>` : ''}
      <div id="recSt" class="muted" style="font-size:12.5px">${esc(L.recReady)}</div>
      <div id="recTm" style="font-family:'Noto Serif TC',serif;font-size:30px;margin:6px 0">00:00</div>
      <button class="btn primary block" id="recBtn">${esc(vOK ? (recSelfie ? '📷 ' + L.recStartS : L.recStartV) : L.recStartA)}</button>
      <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.recTip)}</div>
      ${(vOK && bgmBlob) ? `
        <div class="muted" style="font-size:12px;margin:14px 0 6px">${esc(L.mcLen)}</div>
        ${chips('mLen', MC_LENS, mcLen, 'v')}
        <button class="btn gold block" id="mcBtn" style="margin-top:10px">🎵 ${esc(L.mcStart)}</button>
        <div class="muted" style="font-size:12px;margin-top:8px">${esc(L.mcHint)}</div>` : ''}
      <div id="selfieWrap" style="${recSelfie ? '' : 'display:none'};margin-top:14px">
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
  if (recSelfie) setTimeout(attachSelfie, 60);

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
  bind('#rMode button', b => setSelfie(b.dataset.s === '1'));
  const pd = $('#pDel'); if (pd) pd.onclick = () => { photoImg = null; studioRefresh(); };
  const bd = $('#bDel'); if (bd) bd.onclick = () => { bgmBlob = null; bgmName = ''; studioRefresh(); };
  ['pNew','pRe'].forEach(id => { const e = $('#' + id); if (e) e.onchange = () => pickPhoto(e); });
  ['bNew','bRe'].forEach(id => { const e = $('#' + id); if (e) e.onchange = () => pickBgm(e); });
  const nt = $('#cardNote');
  if (nt){
    let tmr = null;
    nt.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { studioNote = nt.value; renderCard(studioItem); }, 400); };
  }
  $('#blessBtn').onclick = blessWrite;
  $('#noteMine').onclick  = () => { studioNote = studioItem.n || ''; studioRefresh(); };
  $('#noteClear').onclick = () => { studioNote = ''; studioRefresh(); };
  const bindInput = (id, key) => {
    const e = $('#' + id); if (!e) return;
    let tm = null;
    e.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { state[key] = e.value; saveState(); renderCard(studioItem); }, 400); };
  };
  bindInput('cardTop', 'cardTop');
  bindInput('cardSign', 'cardSign');
  $('#recBtn').onclick = toggleRec;
  const mb = $('#mcBtn'); if (mb) mb.onclick = musicRec;
  bind('[data-play]', b => playRec(b.dataset.play));
  bind('[data-sh]',   b => shareRec(b.dataset.sh));
  bind('[data-rm]',   b => rmRec(b.dataset.rm));
}
function openStudio(h){ studioItem = h; studioNote = h.n || ''; go('#/studio'); }

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
        chap.forEach(bl => {
          for (let j = 2; j < bl.length; j += 2){
            if (!has(bl[j])) continue;
            for (const sx of splitSentences(bl[j])){
              if (has(sx) && res.length < 400)
                res.push({ b:bid, c:ci + 1, x:sx });
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
      <div class="sr">${esc(bname(BOOK[r.b]))} ${esc(chapLabel(r.b, r.c))}</div>
      <div class="sx">${esc(r.x).replace(rx, m => '<em>' + m + '</em>')}</div></div>`).join('');
  $$('.sres', out).forEach(e => e.onclick = () => {
    const r = res[+e.dataset.i]; go(`#/read/${r.b}/${r.c}`);
  });
}

/* ================================================================ 陪讀 */
let chatLog = [], chatPending = null, chatBusy = false;
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
function mdToHtml(s){
  let h = esc(s);
  h = h.replace(/^###### (.*)$/gm, '<h6>$1</h6>').replace(/^##### (.*)$/gm, '<h5>$1</h5>')
       .replace(/^#{1,4} (.*)$/gm, '<h4>$1</h4>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  h = h.replace(/^&gt; ?(.*)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^---+$/gm, '<hr>');
  h = h.replace(/^[-*] (.*)$/gm, '<li>$1</li>');
  h = h.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, m => '<ul>' + m + '</ul>');
  return h.split(/\n{2,}/).map(p => /^<(h\d|ul|blockquote|hr)/.test(p.trim()) ? p : '<p>' + p.replace(/\n/g, '<br>') + '</p>').join('');
}
async function viewCompanion(v){
  const L = t();
  const b = RD.book ? BOOK[RD.book] : null;
  v.innerHTML = `<div class="chatwrap">
      <div class="xz-head"><img src="icon-72.png" alt=""><span>${esc(L.companionFull)}</span></div>
      ${b ? `<div class="chatctx">${esc(L.ctx(bname(b), RD.ch))}</div>` : ''}
      <button class="qs-toggle" id="qsBtn">💡 ${esc(L.examples)}</button>
      <div class="qs-panel" id="qsPanel" hidden></div>
      <div class="chatlog" id="chatlog"></div>
      <div class="chatinput">
        <textarea id="chatIn" rows="1" placeholder="${esc(L.chatPH)}"></textarea>
        <button id="chatSend">${esc(L.send)}</button>
      </div></div>`;
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
          <button class="msg-act" data-a="tts" data-i="${i}">🔊</button>
          <button class="msg-act" data-a="del" data-i="${i}">✕</button>
        </div></div>`).join('');
  $$('.msg-act', log).forEach(b => b.onclick = () => {
    const i = +b.dataset.i, m = chatLog[i];
    if (b.dataset.a === 'fav'){ toggleFav(m.text); paintChat(); }
    else if (b.dataset.a === 'del'){ chatLog.splice(i, 1); paintChat(); }
    else if (b.dataset.a === 'tts'){ ttsSpeakText(m.text); }
  });
  log.scrollTop = log.scrollHeight;
}
const isFav = txt => user.fav.some(f => f.text === txt);
function toggleFav(txt){
  const i = user.fav.findIndex(f => f.text === txt);
  if (i >= 0) user.fav.splice(i, 1);
  else user.fav.push({ text:txt, b:RD.book, ch:RD.ch, ts:Date.now() });
  saveUser();
}
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
  chatLog.push({ role:'user', text }); paintChat();
  chatBusy = true;
  chatLog.push({ role:'ai', text: t().thinking }); paintChat();
  const b = RD.book ? BOOK[RD.book] : null;
  const sys = (isEN()
    ? 'You are Xiaozhi, a Bible companion from Kingdom 321 Fellowship. Answer in the spirit of the 321 vision — Jesus is my example, Scripture is my standard, the Holy Spirit is my guide; let Jesus reign, let Jesus receive all the glory; build what belongs to God. Explain plainly, use everyday pictures, quote the World English Bible, and keep answers short.'
    : isZS()
    ? '你是「小智」，国度321空中团契的圣经陪读。以321理念（耶稣是我的榜样、圣经是我的准则、圣灵是我的引导；让耶稣作王、让耶稣得着一切的荣耀；建立属神的体系）回应，深入浅出、善用比喻，引用和合本圣经，回答简明。'
    : '你是「小智」，國度321空中團契的聖經陪讀。以321理念（耶穌是我的榜樣、聖經是我的準則、聖靈是我的引導；讓耶穌作王、讓耶穌得著一切的榮耀；建立屬神的體系）回應，深入淺出、善用比喻，引用和合本聖經，回答簡明。')
    + (b ? (isEN() ? ` (The reader is currently in ${bname(b)} ${RD.ch}.)`
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
  chatLog[chatLog.length - 1] = { role:'ai', text: reply || (t().chatErr + (why ? '（' + why + '）' : '')) };
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
    </div>

    <div class="section-title">${esc(L.myBm)}</div>
    <div class="card" style="padding:4px 16px">${user.marks.length
      ? user.marks.slice().sort((a, b2) => b2.ts - a.ts).map((m, i) => `
      <div class="hitem">
        <div class="q">${markNotes(esc(m.t || ''))}…</div>
        <div class="m"><span>${esc(BOOK[m.b] ? bname(BOOK[m.b]) : m.b)} ${esc(chapLabel(m.b, m.c))}</span>
          <span><button data-bmgo="${i}">↗</button><button data-bmdel="${i}">✕</button></span></div>
      </div>`).join('')
      : `<div class="empty">${esc(L.emptyBm)}</div>`}</div>

    <div class="section-title">${esc(L.myHl)}</div>
    <div class="card" style="padding:4px 16px">${hls.length ? hls.map(([k, h]) => `
      <div class="hitem">
        <div class="q">${markNotes(esc(h.t))}</div>
        ${h.n ? `<div class="n">${esc(h.n)}</div>` : ''}
        <div class="m"><span>${esc(cardRef(h))}</span>
          <span><button data-card="${esc(k)}">🖼</button><button data-go="${h.b}|${h.ch}">↗</button><button data-del="${esc(k)}">✕</button></span></div>
      </div>`).join('') : `<div class="empty">${esc(L.emptyHl)}</div>`}</div>

    <div class="section-title">${esc(L.myFav)}</div>
    <div class="card" style="padding:4px 16px">${user.fav.length ? user.fav.slice().reverse().map((f, i) => `
      <div class="hitem"><div class="q" style="font-family:inherit;font-size:13.5px">${mdToHtml(f.text)}</div>
        <div class="m"><span>${f.b && BOOK[f.b] ? esc(bname(BOOK[f.b])) + ' ' + esc(chapLabel(f.b, f.ch)) : ''}</span>
        <button data-favdel="${user.fav.length - 1 - i}">✕</button></div></div>`).join('')
      : `<div class="empty">${esc(L.emptyFav)}</div>`}</div>

    <div class="muted" style="text-align:center;margin:18px 0 8px">
      ${esc(L.app)} ${VERSION}<br>和合本聖經屬公有領域，沒有版權限制</div>`;

  $$('#setLang button', v).forEach(b => b.onclick = () => switchLang(b.dataset.l));
  const dg = $('#diagBtn', v); if (dg) dg.onclick = () => runDiag();
  $$('#setFont button', v).forEach(b => b.onclick = () => { state.font = +b.dataset.i; saveState(); applyChrome(); render(); });
  $$('#setTheme button', v).forEach(b => b.onclick = () => { state.theme = +b.dataset.i; saveState(); applyChrome(); render(); });
  $$('#setMode button', v).forEach(b => b.onclick = () => { state.flow = b.dataset.i === '1'; saveState(); applyChrome(); render(); });
  $$('#setShCh button', v).forEach(b => b.onclick = () => { state.shCh = b.dataset.i === '0'; saveState(); applyChrome(); render(); });
  $$('#setShV  button', v).forEach(b => b.onclick = () => { state.shV  = b.dataset.i === '0'; saveState(); applyChrome(); render(); });
  $$('#setNote button', v).forEach(b => b.onclick = () => { state.hidenote = b.dataset.i === '1'; saveState(); applyChrome(); render(); });
  $$('#setVoice button', v).forEach(b => b.onclick = () => { state.voice[state.lang] = +b.dataset.i; saveState(); render(); });
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
let spk = { on:false, items:[], idx:0, audio:null, cache:{}, native:false, abort:false };
let raManualAt = 0;

/* 朗讀發音修正（僅影響語音，不影響畫面文字） */
const TTS_FIX = [
  [/長老/g, '掌老'], [/長子/g, '掌子'], [/家長/g, '家掌'], [/長大/g, '掌大'],
  [/行為/g, '行圍'], [/為大/g, '圍大'], [/中了/g, '衷了'],
  [/教會/g, '叫會'], [/傳道/g, '船道'], [/朝見/g, '潮見'],
  [/應當/g, '英當'], [/應許/g, '英許'], [/相應/g, '相映'],
  [/看守/g, '刊守'], [/種子/g, '腫子'], [/中間/g, '衷間']
];
function ttsPrep(s){
  let x = s.replace(/〔[^〕]*〕/g, '').replace(/\[[^\]]*\]/g, '');   // 譯者註不朗讀
  if (isEN()) return x.replace(/\s+/g, ' ').trim();                  // 英文不做破音字修正
  x = x.replace(/[「」『』（）]/g, '');
  TTS_FIX.forEach(([re, to]) => { x = x.replace(re, to); });
  return x.trim();
}
function buildQueue(){
  let els = $$('#reader .sent');
  const from = els.findIndex(el => el.getBoundingClientRect().bottom > 0);
  if (from > 0) els = els.slice(from);
  const items = []; let cur = { text:'', els:[] };
  els.forEach(el => {
    const txt = el.textContent;
    if (cur.text.length + txt.length > TTS_CHUNK() && cur.text){ items.push(cur); cur = { text:'', els:[] }; }
    cur.text += txt; cur.els.push(el);
  });
  if (cur.text) items.push(cur);
  return items.filter(i => ttsPrep(i.text).length > 0);
}
function raClear(){ $$('.tts-reading').forEach(e => e.classList.remove('tts-reading')); }
function raShow(item){
  raClear();
  if (!item || !item.els.length) return;
  item.els.forEach(e => e.classList.add('tts-reading'));
  if (Date.now() - raManualAt > RA_COOLDOWN){
    try{ item.els[0].scrollIntoView({ behavior:'smooth', block:'center' }); }catch(e){}
  }
}
['wheel','touchmove'].forEach(ev => window.addEventListener(ev, () => { raManualAt = Date.now(); }, { passive:true }));

function ttsBtn(st){ const b = $('#rdTts'); if (b) b.setAttribute('data-state', st || ''); }

/* iOS/Safari 兩個坑，都要照《321領導力》的作法避開：
   ① 整個 App 只能有「一個」<audio> 元素，而且必須在使用者按下按鈕的那一瞬間
      （還在 user gesture 裡）就先 play() 過一次，之後才准程式自己播。
      如果等 fetch 回來再 new Audio()，手勢早就過期了，play() 會被擋下來，
      看起來就像「真人語音壞掉、自動改用裝置語音」。
   ② Worker 回傳的 Content-Type 不一定是 audio/mpeg；直接拿 response.blob()
      交給 <audio> 會解不出來。改成自己讀 arrayBuffer 再指定 audio/mpeg。 */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
let ttsEl = null, ttsUnlocked = false, ttsLastErr = '';
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
async function ttsPrefetch(i){
  const it = spk.items[i]; if (!it || spk.cache[i]) return;
  const voice = VOICES[state.lang][state.voice[state.lang]].v;
  try{ spk.cache[i] = await ttsFetch(ttsPrep(it.text), voice); }catch(e){ spk.cache[i] = null; }
}
async function ttsPlayFrom(i){
  if (!spk.on || spk.abort) return;
  if (i >= spk.items.length){ ttsStop(); return; }
  spk.idx = i; raShow(spk.items[i]);
  /* 先排這一段自己的請求，再排後面的預抓——否則第一聲會等在後面兩段的後面 */
  if (spk.cache[i] === undefined) await ttsPrefetch(i);
  for (let k = i + 1; k <= i + TTS_LOOKAHEAD; k++) ttsPrefetch(k);
  if (!spk.on || spk.abort) return;
  const url = spk.cache[i];
  if (!url){ return ttsNativeFrom(i); }
  ttsBtn('playing');
  const a = ttsAudio(); spk.audio = a;
  const old = a.src;
  a.onended = null; a.onerror = null;
  a.src = url;
  if (old && old.startsWith('blob:')){ try{ URL.revokeObjectURL(old); }catch(e){} }
  a.onended = () => { if (spk.on && !spk.abort) ttsPlayFrom(i + 1); };
  a.onerror = () => { if (i === 0) ttsNativeFrom(i); else if (spk.on && !spk.abort) ttsPlayFrom(i + 1); };
  try{
    const p = a.play();
    if (p && p.catch) await p;
  }catch(e){
    if (i === 0) ttsNativeFrom(i); else if (spk.on && !spk.abort) ttsPlayFrom(i + 1);
  }
}
function ttsNativeFrom(i){
  if (!('speechSynthesis' in window)){ toast(t().ttsErr); ttsStop(); return; }
  if (!spk.native){ spk.native = true; toast(t().ttsFallback + (ttsLastErr ? '（' + ttsLastErr + '）' : '')); }
  if (!spk.on || spk.abort || i >= spk.items.length){ ttsStop(); return; }
  spk.idx = i; raShow(spk.items[i]); ttsBtn('playing');
  const u = new SpeechSynthesisUtterance(ttsPrep(spk.items[i].text));
  u.lang = isEN() ? 'en-US' : (isZS() ? 'zh-CN' : 'zh-TW'); u.rate = .95;
  u.onend = () => { if (spk.on && !spk.abort) ttsNativeFrom(i + 1); };
  u.onerror = () => { if (spk.on && !spk.abort) ttsNativeFrom(i + 1); };
  try{ speechSynthesis.speak(u); }catch(e){ ttsStop(); }
}
function ttsToggle(){
  if (spk.on){ ttsStop(); return; }
  ttsUnlock();                       // 一定要在這裡（還在使用者的點擊手勢裡）
  const items = buildQueue();
  if (!items.length) return;
  spk = { on:true, items, idx:0, audio:null, cache:{}, native:false, abort:false };
  ttsBtn('loading');
  ttsPlayFrom(0);
}
function ttsStop(){
  spk.on = false; spk.abort = true;
  try{ if (ttsEl){ ttsEl.pause(); } }catch(e){}
  spk.audio = null;
  try{ if ('speechSynthesis' in window) speechSynthesis.cancel(); }catch(e){}
  raClear(); ttsBtn('');
}
async function ttsSpeakText(text){
  ttsUnlock();
  const clean = ttsPrep(text.replace(/[#*>`_\-]/g, ''));
  if (!clean) return;
  const voice = VOICES[state.lang][state.voice[state.lang]].v;
  try{
    const url = await ttsFetch(clean.slice(0, 900), voice);
    const a = ttsAudio();
    const old = a.src;
    a.onended = null; a.onerror = null;
    a.src = url;
    if (old && old.startsWith('blob:')){ try{ URL.revokeObjectURL(old); }catch(e){} }
    const p = a.play(); if (p && p.catch) await p;
  }catch(e){
    if ('speechSynthesis' in window){
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = isEN() ? 'en-US' : (isZS() ? 'zh-CN' : 'zh-TW');
      speechSynthesis.speak(u); toast(t().ttsFallback);
    } else toast(t().ttsErr);
  }
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
  if ('serviceWorker' in navigator){
    try{ navigator.serviceWorker.register('sw.js'); }catch(e){}
  }
  setTimeout(ttsWarmUp, 1200);
}
boot();
