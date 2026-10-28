// ============================================================
// 每日一束花 · 主逻辑
// 依赖 config.js（GAME_CONFIG / GAME_UTIL）
// 小程序 API 在预览版用本地 mock 替代（见文末 wx mock）
// ============================================================
(function () {
  "use strict";

  const CFG = window.GAME_CONFIG;
  const UTIL = window.GAME_UTIL;

  // ---------- 状态 ----------
  const state = {
    dateKey: UTIL.todayKey(),
    bouquet: null,
    palette: null,
    quote: null,
    collected: false,
    history: [],
    audioReady: false,
    boopPlayed: false,
    lastBoAt: 0,
  };

  // ---------- DOM ----------
  const $ = function (sel) { return document.querySelector(sel); };
  const els = {
    greeting: $("#greeting"),
    greetingText: $("#greetingText"),
    greetingSub: $("#greetingSub"),
    main: $("#main"),
    bouquetWrap: $("#bouquetWrap"),
    handwrite: $("#handwrite"),
    bouquetBox: $("#bouquetBox"),
    flowerInfo: $("#flowerInfo"),
    flowerName: $("#flowerName"),
    moodTag: $("#moodTag"),
    quoteCard: $("#quoteCard"),
    quote: $("#quote"),
    dateLabel: $("#dateLabel"),
    btnCollect: $("#btnCollect"),
    btnCollectText: $("#btnCollectText"),
    btnReplay: $("#btnReplay"),
    btnReset: $("#btnReset"),
    btnHistory: $("#btnHistory"),
    btnShare: $("#btnShare"),
    historySheet: $("#historySheet"),
    historyList: $("#historyList"),
    historyStats: $("#historyStats"),
    historyClose: $("#historyClose"),
    loveModal: $("#loveModal"),
    loveText: $("#loveText"),
    loveClose: $("#loveClose"),
    toast: $("#toast"),
  };

  // ---------- 本地存储 ----------
  const storage = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const STORAGE_KEY = "flower_history";

  // ============================================================
  // 音频：Web Audio 合成可爱「啵啵」声（零资源依赖）
  // 移动端需首次手势后才有声音 —— 见 bindAudioUnlock()
  // ============================================================
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { audioCtx = new AC(); } catch (e) { return null; }
    }
    if (audioCtx.state === "suspended") {
      try { audioCtx.resume(); } catch (e) {}
    }
    return audioCtx;
  }

  // 一声「啵」：双唇爆破 + /o/ 元音共振峰，高音高 → 奶音童声
  // 完全由 Web Audio 合成，不依赖系统中文语音包，任何浏览器都发得出声
  function playBoop(delay, pitchScale) {
    const ctx = ensureAudio();
    if (!ctx) return false;
    if (ctx.state !== "running") {
      // 首次手势时 resume() 是异步的，此时立刻播放会被丢弃 —— 恢复后再补播
      try {
        const pr = ctx.resume();
        if (pr && typeof pr.then === "function") {
          pr.then(function () { playBoop((delay || 0) + 0.02, pitchScale); });
          return true;
        }
      } catch (e) {}
      return false;
    }
    const s = pitchScale || 1;
    const t0 = ctx.currentTime + (delay || 0);
    const dur = 0.30;
    const f0 = 355 * s;                       // 童声音高（约 350Hz）

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.50, t0 + 0.022);
    out.gain.setValueAtTime(0.50, t0 + 0.10);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(ctx.destination);

    // 声门源：锯齿波，音高轻微下滑，像说话不像电子音
    const src = ctx.createOscillator();
    src.type = "sawtooth";
    src.frequency.setValueAtTime(f0 * 1.08, t0);
    src.frequency.exponentialRampToValueAtTime(f0 * 0.80, t0 + dur);

    // 三个共振峰（儿童声道更短 → 频率偏高）
    [[600, 6, 1.0], [1150, 8, 0.55], [2650, 10, 0.16]].forEach(function (f) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(f[0] * s, t0);
      bp.frequency.exponentialRampToValueAtTime(f[0] * s * 0.94, t0 + dur);
      bp.Q.setValueAtTime(f[1], t0);
      const g = ctx.createGain();
      g.gain.value = f[2];
      src.connect(bp);
      bp.connect(g);
      g.connect(out);
    });
    src.start(t0);
    src.stop(t0 + dur + 0.02);

    // 双唇爆破的气声起音
    try {
      const len = Math.ceil(ctx.sampleRate * 0.022);
      const nb = ctx.createBuffer(1, len, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const ns = ctx.createBufferSource();
      ns.buffer = nb;
      const nf = ctx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.setValueAtTime(900 * s, t0);
      nf.Q.setValueAtTime(0.9, t0);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.17, t0 + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.022);
      ns.connect(nf);
      nf.connect(ng);
      ng.connect(ctx.destination);
      ns.start(t0);
    } catch (e) {}

    return true;
  }

  // 「啵啵」两声，第二声略高，更像小孩说话的语调
  function playBoopTwice() {
    const ok1 = playBoop(0, 1.0);
    const ok2 = playBoop(0.23, 1.14);
    if (ok1 || ok2) state.boopPlayed = true;
    return ok1 || ok2;
  }

  // ---------- 系统语音：有中文音色时再叠一层真·童声朗读 ----------
  let voiceList = [];
  let ttsStarted = false;

  function refreshVoices() {
    if (!window.speechSynthesis) return;
    try { voiceList = speechSynthesis.getVoices() || []; } catch (e) { voiceList = []; }
  }

  // 童声优先：Windows 的 Yaoyao、iOS 的 Ting-Ting 儿童版都在这类命名里
  const CHILD_RE = /yaoyao|xiaoshuang|童|child|kid|girl|junior|小新|宝宝/i;
  const FEMALE_RE = /xiaoyi|xiaoxiao|xiaohan|xiaomeng|huihui|ting|mei|female|女/i;

  function pickZhVoice() {
    if (!voiceList.length) refreshVoices();
    if (!voiceList.length) return null;
    const zh = voiceList.filter(function (v) { return /^zh/i.test(v.lang || ""); });
    if (!zh.length) return null;
    // 1) 童声  2) 女声  3) 任意中文音色
    return zh.find(function (v) { return CHILD_RE.test(v.name || ""); }) ||
           zh.find(function (v) { return FEMALE_RE.test(v.name || ""); }) ||
           zh[0];
  }

  function isChildVoice(v) {
    return !!(v && CHILD_RE.test(v.name || ""));
  }

  // 没有中文音色时，退而求其次挑一个女声，用 "bo" 发音（否则中文会被静默丢弃）
  function pickAnyVoice() {
    if (!voiceList.length) refreshVoices();
    if (!voiceList.length) return null;
    const female = /female|woman|zira|samantha|karen|moira|tessa|susan|hazel|google uk english female|google us english/i;
    return voiceList.find(function (v) { return female.test(v.name || ""); }) || voiceList[0];
  }

  if (window.speechSynthesis) {
    refreshVoices();
    try { speechSynthesis.onvoiceschanged = refreshVoices; } catch (e) {}
  }

  // 音色表在 Chrome 里是异步加载的，首屏常为空 —— 等一小会儿再决定要不要走 TTS
  function whenVoices(cb, timeout) {
    if (voiceList.length) { cb(); return; }
    let done = false;
    const fire = function () {
      if (done) return;
      done = true;
      refreshVoices();
      cb();
    };
    try { speechSynthesis.addEventListener("voiceschanged", fire, { once: true }); } catch (e) {}
    setTimeout(fire, timeout || 700);
  }

  function utter(text, pitch, rate, delay) {
    const sy = window.speechSynthesis;
    const run = function () {
      const v = pickZhVoice() || pickAnyVoice();
      const noZh = !!(v && !/^zh/i.test(v.lang || ""));
      try {
        const u = new SpeechSynthesisUtterance(noZh ? "bo" : text);
        u.lang = noZh ? "en-US" : "zh-CN";
        u.pitch = pitch;   // 抬高音高 → 奶音童声
        u.rate = rate;
        u.volume = 1;      // 拉满
        if (v) u.voice = v;
        u.onstart = function () { ttsStarted = true; };
        u.onerror = function () {};
        sy.speak(u);
      } catch (e) {}
    };
    if (delay) setTimeout(run, delay); else run();
  }

  // 第一声 bō（高而平），第二声 bó（更扬、尾音更长）
  function speakBo() {
    const sy = window.speechSynthesis;
    if (!sy || typeof window.SpeechSynthesisUtterance === "undefined") return false;
    const v0 = pickZhVoice() || pickAnyVoice();
    if (!v0) return false;                                  // 系统里一个音色都没有 → 交给合成音
    refreshVoices();
    try { sy.cancel(); } catch (e) {}
    try { if (sy.paused) sy.resume(); } catch (e) {}

    // 本身就是童声的音色不需要再拉高那么多，否则会失真
    const child = isChildVoice(v0) || !/^zh/i.test(v0.lang || "");
    const p1 = child ? 1.12 : 1.72;
    const p2 = child ? 1.22 : 1.9;
    utter("啵", p1, child ? 0.86 : 0.72, 60);
    utter("啵", p2, child ? 0.74 : 0.58, 660);
    return true;
  }

  // 统一入口：优先真·童声（TTS），900ms 内没起播就用合成童声兜底 —— 保证一定有「啵啵」
  function startBoVoice() {
    const hasVoice = !!(pickZhVoice() || pickAnyVoice());
    if (!hasVoice) { playBoopTwice(); return; }        // 系统无音色 → 直接合成
    ttsStarted = false;
    speakBo();
    setTimeout(function () {
      if (!ttsStarted) playBoopTwice();                // TTS 没起来 → 合成兜底
    }, 1200);
  }

  function sayBo() {
    const now = Date.now();
    if (now - state.lastBoAt < 700) return true;   // 一次手势里 pointerdown + click 会连发，去重
    state.lastBoAt = now;
    if (voiceList.length) startBoVoice();          // 音色已就绪 → 同步在手势栈内朗读
    else whenVoices(startBoVoice, 700);
    return true;
  }

  // 领取时的小音符（上行三音）
  function playChime() {
    const ctx = ensureAudio();
    if (!ctx || ctx.state !== "running") return;
    [660, 880, 1180].forEach(function (f, i) {
      const t0 = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.40, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  }

  // 首次手势解锁音频（浏览器强制：没有交互就不许出声，语音合成同样如此）
  function bindAudioUnlock() {
    const unlock = function () {
      const ctx = ensureAudio();
      if (ctx) {
        // iOS 需要一次静音播放来真正解锁音频
        try {
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        } catch (e) {}
        if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
      }
      state.audioReady = true;
      sayBo();                     // 首次手势必定补播一次（throttle 会去重）
      OFF.forEach(function (ev) { document.removeEventListener(ev, unlock); });
    };
    const OFF = ["pointerdown", "touchstart", "click", "keydown", "wheel"];
    OFF.forEach(function (ev) {
      document.addEventListener(ev, unlock, { once: true, passive: true });
    });
  }

  // ---------- 初始化 ----------
  function init() {
    const idx = UTIL.bouquetIndexFor(state.dateKey);
    state.bouquet = CFG.bouquets[idx];
    state.quote = CFG.quotes[UTIL.quoteIndexFor(state.dateKey)];
    // 颜色主题：由当天这束花的 colors 派生，换花即换色
    state.palette = window.FLOWERS.paletteFor(state.bouquet);

    loadHistory();
    renderScene();
    bindEvents();
    bindAudioUnlock();
    showGreeting();
  }

  function loadHistory() {
    const raw = storage.get(STORAGE_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        state.history = Array.isArray(arr) ? arr : [];
      } catch (e) { state.history = []; }
    }
    state.collected = state.history.some(function (h) { return h.date === state.dateKey; });
  }

  function saveHistory() {
    storage.set(STORAGE_KEY, JSON.stringify(state.history));
  }

  // ============================================================
  // 开场「啵啵~」：透明果冻立体字 + 俏皮弹跳 + 语音
  // ============================================================
  function showGreeting() {
    els.greetingText.innerHTML = "";
    const chars = CFG.greetingText.split("");
    chars.forEach(function (ch, i) {
      const span = document.createElement("span");
      span.className = "bounce-char";
      span.textContent = ch;
      span.setAttribute("data-char", ch);
      // 每个字不同的弹跳节奏：延迟错峰、略微不同的入场幅度
      span.style.animationDelay = (i * 0.16) + "s, " + (0.78 + i * 0.16) + "s";
      span.style.setProperty("--rot", (i % 2 === 0 ? -7 : 7) + "deg");
      els.greetingText.appendChild(span);
    });

    els.greetingSub.textContent = CFG.greetingSub;

    els.greeting.classList.add("show");
    els.greetingText.classList.add("pop");

    // 尝试自动播放「啵啵」（桌面端通常成功，移动端会被拦截 → 由手势解锁补播）
    setTimeout(function () { sayBo(); }, 320);

    setTimeout(function () {
      els.greeting.classList.add("fade-out");
    }, CFG.anim.greetingIn + CFG.anim.greetingHold);

    setTimeout(function () {
      els.greeting.classList.remove("show", "fade-out");
      els.main.classList.add("show");
      startReveal();
    }, CFG.anim.greetingIn + CFG.anim.greetingHold + CFG.anim.greetingOut);
  }

  // ============================================================
  // 每日揭示：手写「dc」→ 淡出 → 鲜花淡入绽放
  // ============================================================
  function startReveal() {
    // 1) 手写字
    els.handwrite.innerHTML = '<span class="hw-de">dc</span>';
    els.handwrite.classList.remove("hw-out");
    els.handwrite.style.display = "flex";
    els.bouquetBox.classList.remove("show");
    els.flowerInfo.classList.remove("show");
    els.quoteCard.classList.remove("show");

    // 从左到右一笔写出
    const hwDe = els.handwrite.querySelector(".hw-de");
    if (hwDe) {
      hwDe.classList.remove("on");
      void hwDe.getBoundingClientRect();
      hwDe.classList.add("on");
    }

    // 2) 手写淡出
    setTimeout(function () {
      els.handwrite.classList.add("hw-out");
    }, CFG.anim.handwrite);

    // 3) 鲜花淡入
    setTimeout(function () {
      els.handwrite.style.display = "none";
      renderBouquet();
      els.bouquetBox.classList.add("show");
    }, CFG.anim.handwrite + CFG.anim.handwriteOut);

    // 4) 花名 / 文案依次浮现
    setTimeout(function () {
      els.flowerInfo.classList.add("show");
    }, CFG.anim.handwrite + CFG.anim.handwriteOut + 420);

    setTimeout(function () {
      els.quoteCard.classList.add("show");
    }, CFG.anim.handwrite + CFG.anim.handwriteOut + 720);
  }

  // 十六进制色 + 透明度 → rgba()（让 mood 标签跟着当天主题色走）
  function hexA(hex, a) {
    const h = String(hex || "").replace("#", "");
    const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
    const v = parseInt(full, 16);
    if (isNaN(v)) return "rgba(78, 99, 71, " + a + ")";
    return "rgba(" + ((v >> 16) & 255) + ", " + ((v >> 8) & 255) + ", " + (v & 255) + ", " + a + ")";
  }

  // ---------- 场景文本 ----------
  function renderScene() {
    els.flowerName.textContent = state.bouquet.name;
    els.moodTag.textContent = state.bouquet.mood;
    els.quote.textContent = "“" + state.quote + "”";
    els.dateLabel.textContent = state.dateKey.replace(/-/g, "  ·  ");
    applyTheme();
    if (state.collected) setCollectedUI();
  }

  // 把当天主题色铺到 UI 上：心情标签、日期下的小色点
  function applyTheme() {
    const pal = state.palette || window.FLOWERS.paletteFor(state.bouquet);
    if (!pal) return;
    els.moodTag.style.color = pal.petalEdge;
    els.moodTag.style.borderColor = hexA(pal.petalEdge, 0.42);
    els.moodTag.style.background = hexA(pal.petalEdge, 0.07);
    document.documentElement.style.setProperty("--theme", pal.petalEdge);
  }

  // ============================================================
  // 花束渲染（水彩风格，绘制逻辑在 flowers.js）
  // ============================================================
  function renderBouquet() {
    const b = state.bouquet;
    const rnd = UTIL.seededRandom(UTIL.hashCode("bg" + state.dateKey));
    els.bouquetBox.innerHTML = window.FLOWERS.build(b, rnd);
    const svg = els.bouquetBox.firstElementChild;
    if (svg) svg.classList.add("bloom");
    // 落花粒子也跟着当天色板走
    const pal = state.palette || window.FLOWERS.paletteFor(b);
    spawnPetals([pal.petalLight, pal.petalMid, pal.petalDeep]);
  }
  // 落花粒子
  function spawnPetals(colors) {
    const layer = document.createElement("div");
    layer.className = "petal-layer";
    document.body.appendChild(layer);
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("span");
      p.className = "petal";
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[Math.floor(Math.random() * 3)];
      p.style.animationDelay = Math.random() * 4 + "s";
      p.style.animationDuration = 6 + Math.random() * 4 + "s";
      p.style.width = p.style.height = 5 + Math.random() * 7 + "px";
      layer.appendChild(p);
    }
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, 11000);
  }

  // ============================================================
  // 领取今日鲜花
  // ============================================================
  function collectFlower() {
    if (state.collected) {
      showToast("今天的花已经收好啦 🌸");
      showLoveModal();
      return;
    }
    state.collected = true;
    state.history.push({
      date: state.dateKey,
      flower: state.bouquet.name,
      mood: state.bouquet.mood,
      quote: state.quote,
      ts: Date.now(),
    });
    if (state.history.length > CFG.collectionMax) {
      state.history = state.history.slice(-CFG.collectionMax);
    }
    saveHistory();
    setCollectedUI();
    playChime();
    showLoveModal();
  }

  function setCollectedUI() {
    els.btnCollect.classList.add("done");
    els.btnCollectText.textContent = "今日已收花";
  }

  // ============================================================
  // 体验入口：再走一遍「领取」的完整反馈（不重复记账）
  // ============================================================
  function replayCollect() {
    if (!state.collected) {
      collectFlower();                 // 还没领过 → 直接走真实领取
      return;
    }
    const pal = state.palette || window.FLOWERS.paletteFor(state.bouquet);
    spawnPetals([pal.petalLight, pal.petalMid, pal.petalDeep]);
    playChime();
    showLoveModal();
    showToast("再收一次花，也一样心动 🌸");
  }

  // ============================================================
  // 全部恢复默认设置
  // ============================================================
  let resetArmedAt = 0;
  let resetTimer = null;

  function disarmReset() {
    resetArmedAt = 0;
    clearTimeout(resetTimer);
    if (els.btnReset) {
      els.btnReset.classList.remove("armed");
      els.btnReset.textContent = "全部恢复默认设置";
    }
  }

  function handleResetClick() {
    const now = Date.now();
    if (now - resetArmedAt > 3200) {   // 第一次点：进入待确认，不删任何东西
      resetArmedAt = now;
      els.btnReset.classList.add("armed");
      els.btnReset.textContent = "再点一次，确认全部重置";
      showToast("再次点击将清空领取记录");
      clearTimeout(resetTimer);
      resetTimer = setTimeout(disarmReset, 3400);
      return;
    }
    resetAll();
  }

  function resetAll() {
    disarmReset();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    state.history = [];
    state.collected = false;
    els.btnCollect.classList.remove("done");
    els.btnCollectText.textContent = "领取今日鲜花";
    renderScene();
    renderHistory();
    hideLoveModal();
    showToast("已恢复默认设置 ✨");
    return "已恢复默认设置";
  }

  // 「亲爱的，我爱你」弹跳小窗
  let loveTimer = null;
  function showLoveModal() {
    els.loveText.textContent = CFG.loveMessage;
    els.loveModal.classList.add("show");
    clearTimeout(loveTimer);
    loveTimer = setTimeout(hideLoveModal, 3600);
  }
  function hideLoveModal() {
    els.loveModal.classList.remove("show");
    clearTimeout(loveTimer);
  }

  // ============================================================
  // 收藏册 + 数据查询
  // ============================================================
  function openHistory() {
    renderHistory();
    els.historySheet.classList.add("show");
  }
  function closeHistory() {
    els.historySheet.classList.remove("show");
  }

  function computeStats() {
    const set = new Set(state.history.map(function (h) { return h.date; }));
    const total = set.size;
    let streak = 0;
    const d = new Date();
    if (!set.has(UTIL.fmtDate(d))) d.setDate(d.getDate() - 1);
    while (set.has(UTIL.fmtDate(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return { total: total, streak: streak };
  }

  function renderHistory() {
    const st = computeStats();
    els.historyStats.innerHTML =
      '<span class="stat-item">今日<b>' + (state.collected ? "已领取" : "未领取") + "</b></span>" +
      '<span class="stat-item">累计<b>' + st.total + " 天</b></span>" +
      '<span class="stat-item">连续<b>' + st.streak + " 天</b></span>";

    if (state.history.length === 0) {
      els.historyList.innerHTML = '<div class="empty">还没有收过花，快去领取今日花束吧～</div>';
      return;
    }
    const list = state.history.slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    let html = "";
    list.forEach(function (h) {
      html +=
        '<div class="history-item">' +
        '<span class="h-date">' + h.date + "</span>" +
        '<span class="h-name">' + h.flower + "</span>" +
        '<span class="h-mood">' + (h.mood || "") + "</span>" +
        '<span class="h-quote">' + h.quote + "</span>" +
        "</div>";
    });
    els.historyList.innerHTML = html;
  }

  // ---------- 分享 ----------
  function shareFlower() {
    const text = "【每日一束花】今天送你一束" + state.bouquet.name + "：" + state.quote;
    if (window.wx && typeof wx.shareAppMessage === "function") {
      wx.shareAppMessage({ title: text });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("文案已复制，去分享给 TA 吧 💐");
      }).catch(function () { showToast(text); });
    } else {
      showToast(text);
    }
  }

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove("show");
    }, 2200);
  }

  // ---------- 事件 ----------
  function bindEvents() {
    els.btnCollect.addEventListener("click", function (e) {
      e.preventDefault();
      collectFlower();
    });
    els.btnHistory.addEventListener("click", function (e) {
      e.preventDefault();
      openHistory();
    });
    els.btnShare.addEventListener("click", function (e) {
      e.preventDefault();
      shareFlower();
    });
    if (els.btnReplay) {
      els.btnReplay.addEventListener("click", function (e) {
        e.preventDefault();
        replayCollect();
      });
    }
    if (els.btnReset) {
      els.btnReset.addEventListener("click", function (e) {
        e.preventDefault();
        handleResetClick();
      });
    }
    els.historyClose.addEventListener("click", function (e) {
      e.preventDefault();
      closeHistory();
    });
    els.historySheet.addEventListener("click", function (e) {
      if (e.target === els.historySheet) closeHistory();
    });
    els.loveClose.addEventListener("click", function (e) {
      e.preventDefault();
      hideLoveModal();
    });
    els.loveModal.addEventListener("click", function (e) {
      if (e.target === els.loveModal) hideLoveModal();
    });
    // 开场时点击任意处：解锁音频并立刻播放啵啵
    els.greeting.addEventListener("click", function () {
      ensureAudio();
      sayBo();
    });
  }

  // ============================================================
  // 数据查询 API（控制台 / 外部调用）
  // window.FlowerGame.getToday()       今日花束与文案
  // window.FlowerGame.getHistory()     历史领取记录
  // window.FlowerGame.lookup('2026-10-01') 查询任意一天的花与文案
  // window.FlowerGame.exportJSON()     导出全部数据（字符串）
  // window.FlowerGame.clear()          清空本地记录
  // ============================================================
  window.FlowerGame = {
    storageKey: STORAGE_KEY,
    // 语音自查：控制台执行 FlowerGame.debug() 可看到音色数量与播放状态
    debug: function () {
      const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
      const zh = vs.filter(function (v) { return /^zh/i.test(v.lang || ""); });
      return {
        voices: vs.length,
        zhVoices: zh.length,
        zhNames: zh.slice(0, 6).map(function (v) { return v.name + "(" + v.lang + ")"; }),
        picked: (pickZhVoice() || pickAnyVoice() || {}).name || "none",
        ttsStarted: ttsStarted,
        boopPlayed: state.boopPlayed,
        audioState: audioCtx ? audioCtx.state : "none",
        lastBoAt: state.lastBoAt,
      };
    },
    replayBo: function () { state.lastBoAt = 0; return sayBo(); },
    getToday: function () {
      return {
        date: state.dateKey,
        flower: state.bouquet.name,
        mood: state.bouquet.mood,
        quote: state.quote,
        colors: state.bouquet.colors,
        collected: state.collected,
      };
    },
    getHistory: function () {
      return state.history.slice();
    },
    getStats: function () { return computeStats(); },
    lookup: function (dateKey) { return UTIL.lookup(dateKey); },
    // 换一天看看：返回那天的花与文案（不改变当前页面状态）
    preview: function (dateKey) {
      const i = UTIL.bouquetIndexFor(dateKey);
      return {
        date: dateKey,
        bouquet: CFG.bouquets[i],
        quote: CFG.quotes[UTIL.quoteIndexFor(dateKey)],
      };
    },
    replay: function () { replayCollect(); return "已重播领取流程"; },
    reset: function () { return resetAll(); },
    exportJSON: function () {
      return JSON.stringify({
        storageKey: STORAGE_KEY,
        today: this.getToday(),
        stats: this.getStats(),
        records: this.getHistory(),
      }, null, 2);
    },
    clear: function () { return resetAll(); },
  };

  // ---------- 小程序 API mock ----------
  if (typeof window.wx === "undefined") {
    window.wx = {
      getStorageSync: function (k) { try { return localStorage.getItem(k); } catch (e) { return ""; } },
      setStorageSync: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
      shareAppMessage: function (opts) { console.log("[mock] shareAppMessage", opts); },
      vibrateShort: function () {},
    };
  }

  // ---------- 启动 ----------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
