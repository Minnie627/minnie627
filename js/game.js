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
    greetHint: $("#greetHint"),
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
    btnHistory: $("#btnHistory"),
    btnShare: $("#btnShare"),
    historySheet: $("#historySheet"),
    historyList: $("#historyList"),
    historyStats: $("#historyStats"),
    historyClose: $("#historyClose"),
    btnData: $("#btnData"),
    btnCopyData: $("#btnCopyData"),
    dataSheet: $("#dataSheet"),
    dataCode: $("#dataCode"),
    dataClose: $("#dataClose"),
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

  // 一声「啵」：频率快速下坠 + 低通，模拟唇齿轻碰的可爱音
  function playBoop(delay, pitch) {
    const ctx = ensureAudio();
    if (!ctx) return false;
    if (ctx.state !== "running") {
      // 首次手势时 resume() 是异步的，此时立刻播放会被丢弃 —— 恢复后再补播
      try {
        const pr = ctx.resume();
        if (pr && typeof pr.then === "function") {
          pr.then(function () { playBoop((delay || 0) + 0.02, pitch); });
          return true;
        }
      } catch (e) {}
      return false;
    }
    const t0 = ctx.currentTime + (delay || 0);
    const base = pitch || 880;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(base, t0);
    osc.frequency.exponentialRampToValueAtTime(base * 0.22, t0 + 0.13);
    // 轻微的音高上扬，更俏皮
    osc.frequency.setValueAtTime(base * 0.9, t0);
    osc.frequency.exponentialRampToValueAtTime(base, t0 + 0.02);
    osc.frequency.exponentialRampToValueAtTime(base * 0.2, t0 + 0.14);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, t0);
    filter.frequency.exponentialRampToValueAtTime(600, t0 + 0.15);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.42, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);

    // 极轻的气声起音：让「啵」像唇齿轻碰，而不是电子滴声
    try {
      const len = Math.ceil(ctx.sampleRate * 0.028);
      const nb = ctx.createBuffer(1, len, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < len; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const ns = ctx.createBufferSource();
      ns.buffer = nb;
      const nf = ctx.createBiquadFilter();
      nf.type = "bandpass";
      nf.frequency.setValueAtTime(1300, t0);
      nf.Q.setValueAtTime(1.2, t0);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.13, t0 + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.026);
      ns.connect(nf);
      nf.connect(ng);
      ng.connect(ctx.destination);
      ns.start(t0);
    } catch (e) {}

    return true;
  }

  // 「啵啵」两声，音高略不同，更像嘴巴发出的声音（语音不可用时的兜底）
  function playBoopTwice() {
    const ok1 = playBoop(0, 900);
    const ok2 = playBoop(0.19, 760);
    if (ok1 || ok2) state.boopPlayed = true;
    return ok1 || ok2;
  }

  // ---------- 稚幼童声朗读「bō」「bó」 ----------
  let voiceList = [];

  function refreshVoices() {
    if (!window.speechSynthesis) return;
    try { voiceList = speechSynthesis.getVoices() || []; } catch (e) { voiceList = []; }
  }

  // 优先中文女声/童声音色 —— 更接近「啵啵」的奶音
  function pickZhVoice() {
    if (!voiceList.length) refreshVoices();
    if (!voiceList.length) return null;
    const zh = voiceList.filter(function (v) { return /^zh/i.test(v.lang || ""); });
    if (!zh.length) return null;
    const prefer = /xiaoyi|xiaoxiao|xiaohan|xiaomeng|xiaoshuang|huihui|yaoyao|ting|mei|female|女|童|child|kid|girl|junior/i;
    return zh.find(function (v) { return prefer.test(v.name || ""); }) || zh[0];
  }

  // 完全没有中文音色时，退而求其次挑一个女声，并用 "bo" 让它至少能发出声音
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

  function utter(text, pitch, rate, delay) {
    const sy = window.speechSynthesis;
    const run = function () {
      const v = pickZhVoice() || pickAnyVoice();
      // 有中文音色 → 读「啵」；只有外语音色 → 用 "bo" 发近似音（否则会静默失败）
      const noZh = !!(v && !/^zh/i.test(v.lang || ""));
      try {
        const u = new SpeechSynthesisUtterance(noZh ? "bo" : text);
        u.lang = noZh ? "en-US" : "zh-CN";
        u.pitch = pitch;   // 抬高音高 → 奶音童声
        u.rate = rate;
        u.volume = 1;      // 拉满
        if (v) u.voice = v;
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
    refreshVoices();
    try { sy.cancel(); } catch (e) {}
    try { if (sy.paused) sy.resume(); } catch (e) {}

    utter("啵", 1.72, 0.72, 60);
    utter("啵", 1.9, 0.58, 660);

    // 兜底：若 1.6s 后完全没在播放，用最朴素的方式再读一次
    setTimeout(function () {
      if (!sy.speaking && !sy.pending) {
        utter("啵啵", 1.7, 0.8, 0);
      }
    }, 1600);
    return true;
  }

  // 统一入口：先发合成「啵」音（必定有声），再叠加童声朗读
  // 说明：部分设备的语音合成缺中文音色时会静默失败，所以不能被它挡住
  function sayBo() {
    const now = Date.now();
    if (now - state.lastBoAt < 700) return true;   // 一次手势里 pointerdown + click 会连发，去重
    state.lastBoAt = now;
    playBoopTwice();
    speakBo();            // 同步调用：iOS 要求语音在手势栈内启动
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

  // 首次手势解锁音频（移动端自动播放限制）
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
      // 预热语音引擎：先静音说一句，避免第一次真正朗读被浏览器吞掉
      try {
        const warm = new SpeechSynthesisUtterance(" ");
        warm.volume = 0;
        warm.lang = "zh-CN";
        speechSynthesis.speak(warm);
      } catch (e) {}
      if (!state.boopPlayed) sayBo();
      if (els.greetHint) els.greetHint.classList.add("hide");
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("pointerdown", unlock, { once: true, passive: true });
    document.addEventListener("touchstart", unlock, { once: true, passive: true });
  }

  // ---------- 初始化 ----------
  function init() {
    const idx = UTIL.bouquetIndexFor(state.dateKey);
    state.bouquet = CFG.bouquets[idx];
    state.quote = CFG.quotes[UTIL.quoteIndexFor(state.dateKey)];

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
    if (els.greetHint) els.greetHint.textContent = CFG.greetHint;

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
    els.handwrite.innerHTML = buildHandwriteSVG();
    els.handwrite.classList.remove("hw-out");
    els.handwrite.style.display = "flex";
    els.bouquetBox.classList.remove("show");
    els.flowerInfo.classList.remove("show");
    els.quoteCard.classList.remove("show");

    // 从左到右一笔写出
    const hwSvg = els.handwrite.querySelector(".handwrite-svg");
    if (hwSvg) {
      hwSvg.classList.remove("on");
      void hwSvg.getBoundingClientRect();
      hwSvg.classList.add("on");
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

  // ============================================================
  // 毛笔体「dc」：用可变宽度的填充轮廓模拟笔锋（对照参考图）
  // 参考图的字形不是等宽线，而是毛笔书写：起笔粗、收笔细、端点圆润
  // ============================================================
  function hwSample(seg, steps) {
    var p0 = seg[0], c1 = seg[1], c2 = seg[2], p3 = seg[3], out = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1]
      ]);
    }
    return out;
  }

  function hwRibbon(pts, wFn) {
    var L = [], R = [], i, p, a, b, dx, dy, m, nx, ny, w, d;
    for (i = 0; i < pts.length; i++) {
      p = pts[i];
      a = pts[Math.max(0, i - 1)];
      b = pts[Math.min(pts.length - 1, i + 1)];
      dx = b[0] - a[0];
      dy = b[1] - a[1];
      m = Math.sqrt(dx * dx + dy * dy) || 1;
      nx = -dy / m;
      ny = dx / m;
      w = wFn(i / (pts.length - 1)) / 2;
      L.push([p[0] + nx * w, p[1] + ny * w]);
      R.push([p[0] - nx * w, p[1] - ny * w]);
    }
    d = "M" + L[0][0].toFixed(1) + " " + L[0][1].toFixed(1);
    for (i = 1; i < L.length; i++) d += " L" + L[i][0].toFixed(1) + " " + L[i][1].toFixed(1);
    for (i = R.length - 1; i >= 0; i--) d += " L" + R[i][0].toFixed(1) + " " + R[i][1].toFixed(1);
    return d + " Z";
  }

  function hwCap(x, y, w) {
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (w / 2).toFixed(1) + '"/>';
  }

  function hwStroke(seg, wFn, steps) {
    var pts = hwSample(seg, steps || 24);
    var last = pts[pts.length - 1];
    return '<path d="' + hwRibbon(pts, wFn) + '"/>' +
      hwCap(pts[0][0], pts[0][1], wFn(0)) + hwCap(last[0], last[1], wFn(1));
  }

  function hwArcPts(cx, cy, rx, ry, a0, a1, steps) {
    var pts = [], i, a;
    for (i = 0; i <= steps; i++) {
      a = a0 + (a1 - a0) * (i / steps);
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
  }

  function hwArc(cx, cy, rx, ry, a0, a1, wFn, steps) {
    var pts = [], i, t, a;
    for (i = 0; i <= steps; i++) {
      t = i / steps;
      a = a0 + (a1 - a0) * t;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    var last = pts[pts.length - 1];
    return '<path d="' + hwRibbon(pts, wFn) + '"/>' +
      hwCap(pts[0][0], pts[0][1], wFn(0)) + hwCap(last[0], last[1], wFn(1));
  }

  function hwPoly(pts, wFn) {
    var last = pts[pts.length - 1];
    return '<path d="' + hwRibbon(pts, wFn) + '"/>' +
      hwCap(pts[0][0], pts[0][1], wFn(0)) + hwCap(last[0], last[1], wFn(1));
  }

  function buildHandwriteSVG() {
    // 淡淡的细笔锋：整字很轻，只在转折处略粗
    var C = "#CFD9C4";
    var body = "";

    // ---- d：先绕碗一圈，收笔时顺势向上提成竖（一条笔路走完）----
    var cx = 72, cy = 116, rx = 42, ry = 39, a0 = -0.30;
    var bowl = hwArcPts(cx, cy, rx, ry, a0, a0 - Math.PI * 2, 108);
    var p0 = bowl[bowl.length - 1];                       // ≈(113.9, 104.5) 2:30 处
    var asc = hwSample([[p0[0], p0[1]], [112, 78], [110, 46], [113, 12]], 44);
    var dPts = bowl.concat(asc.slice(1));
    var dEnd = dPts[dPts.length - 1];
    var dW = function (t) {
      return 6.3 + 0.45 * Math.sin(t * Math.PI * 2) - 0.95 * Math.max(0, t - 0.86) / 0.14;
    };
    body += '<path d="' + hwRibbon(dPts, dW) + '"/>' + hwCap(dEnd[0], dEnd[1], dW(1));

    // ---- c：右侧开口，两端自然收细 ----
    var cArc = hwArcPts(176, 120, 31, 33, -1.05, -1.05 - Math.PI * 2 * 0.84, 96);
    body += hwPoly(cArc, function (t) {
      return 4.9 + 1.9 * Math.sin(t * Math.PI);
    });

    // 内容包围盒 x 28~209 / y 15~158，居中到 (110, 88) 后整体微倾
    return (
      '<svg viewBox="0 0 220 176" class="handwrite-svg" xmlns="http://www.w3.org/2000/svg">' +
        '<g fill="' + C + '" transform="translate(110 88) rotate(-2) skewX(-5) translate(-118.5 -86.5)">' +
        body +
        "</g>" +
      "</svg>"
    );
  }

  // ---------- 场景文本 ----------
  function renderScene() {
    els.flowerName.textContent = state.bouquet.name;
    els.moodTag.textContent = state.bouquet.mood;
    els.quote.textContent = "“" + state.quote + "”";
    els.dateLabel.textContent = state.dateKey.replace(/-/g, "  ·  ");
    if (state.collected) setCollectedUI();
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
    // 水彩粉色飘落花瓣
    spawnPetals(["#F7CEDB", "#F2B4C6", "#FBE3EA"]);
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

  // 数据查询面板：展示原始数据 + 今日详情
  function openDataPanel() {
    const payload = {
      storageKey: STORAGE_KEY,
      today: {
        date: state.dateKey,
        flower: state.bouquet.name,
        mood: state.bouquet.mood,
        quote: state.quote,
        collected: state.collected,
      },
      stats: computeStats(),
      records: state.history,
    };
    els.dataCode.textContent = JSON.stringify(payload, null, 2);
    els.dataSheet.classList.add("show");
  }
  function closeDataPanel() {
    els.dataSheet.classList.remove("show");
  }

  function copyData() {
    const text = els.dataCode.textContent || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("数据已复制 📋");
      }).catch(function () { showToast("复制失败，请长按选择文本"); });
    } else {
      showToast("请长按选择文本复制");
    }
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
    els.historyClose.addEventListener("click", function (e) {
      e.preventDefault();
      closeHistory();
    });
    els.historySheet.addEventListener("click", function (e) {
      if (e.target === els.historySheet) closeHistory();
    });
    if (els.btnData) {
      els.btnData.addEventListener("click", function (e) {
        e.preventDefault();
        openDataPanel();
      });
    }
    if (els.btnCopyData) {
      els.btnCopyData.addEventListener("click", function (e) {
        e.preventDefault();
        copyData();
      });
    }
    if (els.dataClose) {
      els.dataClose.addEventListener("click", function (e) {
        e.preventDefault();
        closeDataPanel();
      });
    }
    if (els.dataSheet) {
      els.dataSheet.addEventListener("click", function (e) {
        if (e.target === els.dataSheet) closeDataPanel();
      });
    }
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
    getToday: function () {
      return {
        date: state.dateKey,
        flower: state.bouquet.name,
        mood: state.bouquet.mood,
        quote: state.quote,
        collected: state.collected,
      };
    },
    getHistory: function () {
      return state.history.slice();
    },
    getStats: function () { return computeStats(); },
    lookup: function (dateKey) { return UTIL.lookup(dateKey); },
    exportJSON: function () {
      return JSON.stringify({
        storageKey: STORAGE_KEY,
        today: this.getToday(),
        stats: this.getStats(),
        records: this.getHistory(),
      }, null, 2);
    },
    clear: function () {
      state.history = [];
      state.collected = false;
      saveHistory();
      els.btnCollect.classList.remove("done");
      els.btnCollectText.textContent = "领取今日花束";
      return "已清空本地领取记录";
    },
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
