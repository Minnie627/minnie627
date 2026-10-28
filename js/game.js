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
    if (!ctx || ctx.state !== "running") return false;
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
    gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.22);
    return true;
  }

  // 「啵啵」两声，音高略不同，更像嘴巴发出的声音
  function playBoopTwice() {
    const ok1 = playBoop(0, 900);
    const ok2 = playBoop(0.19, 760);
    if (ok1 || ok2) state.boopPlayed = true;
    return ok1 || ok2;
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
      gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.02);
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
      if (ctx && ctx.state !== "running") {
        try { ctx.resume(); } catch (e) {}
      }
      state.audioReady = true;
      if (!state.boopPlayed) {
        // 延迟一点点，等 resume 生效
        setTimeout(function () { playBoopTwice(); }, 60);
      }
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
    setTimeout(function () { playBoopTwice(); }, 260);

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
    els.handwrite.style.display = "block";
    els.bouquetBox.classList.remove("show");
    els.flowerInfo.classList.remove("show");
    els.quoteCard.classList.remove("show");

    // 逐笔描边动画（用真实路径长度，避免起点突现）
    const paths = els.handwrite.querySelectorAll(".hw-path");
    paths.forEach(function (p, i) {
      let len = 300;
      try { len = p.getTotalLength(); } catch (e) {}
      p.style.strokeDasharray = len + " " + len;
      p.style.strokeDashoffset = len;
      p.style.animation = "hw-draw 0.85s cubic-bezier(0.45, 0, 0.35, 1) forwards";
      p.style.animationDelay = (i * 0.18) + "s";
    });

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

  // 手写「dc」SVG（两笔字母 + 一颗小爱心收尾）
  function buildHandwriteSVG() {
    return (
      '<svg viewBox="0 0 240 140" class="handwrite-svg" xmlns="http://www.w3.org/2000/svg">' +
        // d：竖笔
        '<path class="hw-path" d="M100 18 L100 98" />' +
        // d：圆碗
        '<path class="hw-path" d="M100 52 A26 26 0 1 0 101 97" />' +
        // c
        '<path class="hw-path" d="M196 46 C172 40 154 58 154 78 C154 98 174 108 196 99" />' +
        // 小爱心
        '<path class="hw-path hw-heart" d="M205 30 C205 25 199 23 196 27 C193 23 187 25 187 30 C187 35 196 41 196 41 C196 41 205 35 205 30 Z" />' +
      "</svg>"
    );
  }

  // ---------- 场景文本 ----------
  function renderScene() {
    els.flowerName.textContent = state.bouquet.name;
    els.moodTag.textContent = state.bouquet.mood;
    els.quote.textContent = "“" + state.quote + "”";
    els.dateLabel.textContent = "今日花语 · " + state.dateKey;
    if (state.collected) setCollectedUI();
  }

  // ============================================================
  // 线条风花束绘制
  // ============================================================
  const f = function (n) { return Math.round(n * 10) / 10; };

  // 统一放大 SVG 里的 stroke-width，让线稿更清晰
  function bumpStroke(svg, k) {
    return svg.replace(/stroke-width="([\d.]+)"/g, function (m, v) {
      return 'stroke-width="' + (parseFloat(v) * k).toFixed(2) + '"';
    });
  }

  function ellipse(cx, cy, rx, ry, rot, line, fill, w) {
    return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) +
      '" transform="rotate(' + f(rot) + ' ' + f(cx) + ' ' + f(cy) + ')" fill="' + fill +
      '" stroke="' + line + '" stroke-width="' + (w || 2) + '" stroke-linejoin="round"/>';
  }

  function dot(cx, cy, r, color) {
    return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + color + '"/>';
  }

  // 各花型绘制器：统一签名 (x, y, s, line, fill, accent, green)
  const FLOWER_RENDERERS = {
    // 玫瑰：外圈花瓣 + 内旋涡
    rose: function (x, y, s, line, fill) {
      let o = "";
      for (let i = 0; i < 5; i++) {
        const a = i * 72;
        const rad = (a * Math.PI) / 180;
        const px = x + Math.cos(rad) * 12 * s;
        const py = y + Math.sin(rad) * 12 * s;
        o += ellipse(px, py, 13 * s, 9.5 * s, a + 90, line, fill, 2);
      }
      o += '<path d="M ' + f(x - 8 * s) + ' ' + f(y + 1 * s) +
        ' a ' + f(8 * s) + ' ' + f(8 * s) + ' 0 1 1 ' + f(13 * s) + ' ' + f(-3 * s) +
        ' a ' + f(6 * s) + ' ' + f(6 * s) + ' 0 1 1 ' + f(-9 * s) + ' ' + f(4 * s) +
        ' a ' + f(3.6 * s) + ' ' + f(3.6 * s) + ' 0 1 1 ' + f(6 * s) + ' ' + f(2 * s) +
        '" fill="none" stroke="' + line + '" stroke-width="' + f(1.8 * s) + '" stroke-linecap="round"/>';
      return o;
    },

    // 小雏菊：多细花瓣 + 圆花心
    daisy: function (x, y, s, line, fill, accent) {
      let o = "";
      for (let i = 0; i < 12; i++) {
        const a = i * 30;
        const rad = (a * Math.PI) / 180;
        const px = x + Math.cos(rad) * 13 * s;
        const py = y + Math.sin(rad) * 13 * s;
        o += ellipse(px, py, 9.5 * s, 4 * s, a + 90, line, fill, 1.7);
      }
      o += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(6.5 * s) + '" fill="' + accent +
        '" stroke="' + line + '" stroke-width="1.7"/>';
      o += dot(x - 2 * s, y - 2 * s, 1.4 * s, line);
      return o;
    },

    // 向日葵：尖花瓣 + 点阵花心
    sunflower: function (x, y, s, line, fill, accent) {
      let o = "";
      for (let i = 0; i < 16; i++) {
        const a = i * 22.5;
        const rad = (a * Math.PI) / 180;
        const x1 = x + Math.cos(rad) * 7 * s;
        const y1 = y + Math.sin(rad) * 7 * s;
        const x2 = x + Math.cos(rad) * 18 * s;
        const y2 = y + Math.sin(rad) * 18 * s;
        const c1x = x + Math.cos(rad + 0.26) * 14 * s;
        const c1y = y + Math.sin(rad + 0.26) * 14 * s;
        const c2x = x + Math.cos(rad - 0.26) * 14 * s;
        const c2y = y + Math.sin(rad - 0.26) * 14 * s;
        o += '<path d="M ' + f(x1) + ' ' + f(y1) + ' Q ' + f(c1x) + ' ' + f(c1y) + ' ' + f(x2) + ' ' + f(y2) +
          ' Q ' + f(c2x) + ' ' + f(c2y) + ' ' + f(x1) + ' ' + f(y1) +
          '" fill="' + fill + '" stroke="' + line + '" stroke-width="1.7" stroke-linejoin="round"/>';
      }
      o += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(8.5 * s) + '" fill="' + accent +
        '" stroke="' + line + '" stroke-width="2"/>';
      for (let i = 0; i < 6; i++) {
        const a = (i * 60 * Math.PI) / 180;
        o += dot(x + Math.cos(a) * 4 * s, y + Math.sin(a) * 4 * s, 1.1 * s, line);
      }
      return o;
    },

    // 郁金香：三瓣杯形（顶部带花瓣尖）
    tulip: function (x, y, s, line, fill) {
      const p = 'M ' + f(x - 13 * s) + ' ' + f(y + 8 * s) +
        ' C ' + f(x - 15 * s) + ' ' + f(y - 6 * s) + ' ' + f(x - 9 * s) + ' ' + f(y - 14 * s) + ' ' + f(x - 4.5 * s) + ' ' + f(y - 12 * s) +
        ' C ' + f(x - 3 * s) + ' ' + f(y - 17 * s) + ' ' + f(x + 3 * s) + ' ' + f(y - 17 * s) + ' ' + f(x + 4.5 * s) + ' ' + f(y - 12 * s) +
        ' C ' + f(x + 9 * s) + ' ' + f(y - 14 * s) + ' ' + f(x + 15 * s) + ' ' + f(y - 6 * s) + ' ' + f(x + 13 * s) + ' ' + f(y + 8 * s) +
        ' C ' + f(x + 7 * s) + ' ' + f(y + 16 * s) + ' ' + f(x - 7 * s) + ' ' + f(y + 16 * s) + ' ' + f(x - 13 * s) + ' ' + f(y + 8 * s) + ' Z';
      let o = '<path d="' + p + '" fill="' + fill + '" stroke="' + line + '" stroke-width="2" stroke-linejoin="round"/>';
      o += '<path d="M ' + f(x) + ' ' + f(y - 13 * s) + ' L ' + f(x) + ' ' + f(y + 11 * s) +
        '" fill="none" stroke="' + line + '" stroke-width="1.4"/>';
      o += '<path d="M ' + f(x - 10 * s) + ' ' + f(y - 7 * s) + ' C ' + f(x - 6 * s) + ' ' + f(y + 2 * s) +
        ' ' + f(x - 6 * s) + ' ' + f(y + 9 * s) + ' ' + f(x - 9 * s) + ' ' + f(y + 13 * s) +
        '" fill="none" stroke="' + line + '" stroke-width="1.4"/>';
      o += '<path d="M ' + f(x + 10 * s) + ' ' + f(y - 7 * s) + ' C ' + f(x + 6 * s) + ' ' + f(y + 2 * s) +
        ' ' + f(x + 6 * s) + ' ' + f(y + 9 * s) + ' ' + f(x + 9 * s) + ' ' + f(y + 13 * s) +
        '" fill="none" stroke="' + line + '" stroke-width="1.4"/>';
      return o;
    },

    // 绣球花：小花簇
    hydrangea: function (x, y, s, line, fill, accent) {
      let o = "";
      const pts = [[0, -13], [-13, -7], [13, -7], [-16, 5], [0, 1], [16, 5], [-9, 15], [9, 15], [0, 21]];
      pts.forEach(function (p) {
        const fx = x + p[0] * s;
        const fy = y + p[1] * s;
        const k = 0.82 * s;
        for (let i = 0; i < 4; i++) {
          const a = i * 90 + 45;
          const rad = (a * Math.PI) / 180;
          o += ellipse(fx + Math.cos(rad) * 4.4 * k, fy + Math.sin(rad) * 4.4 * k, 4.6 * k, 3.4 * k, a, line, fill, 1.5);
        }
        o += dot(fx, fy, 1.7 * k, accent);
      });
      return o;
    },

    // 铃兰 / 风铃草：垂挂小铃
    bell: function (x, y, s, line, fill) {
      let o = "";
      const bells = [[-12, -4, 0.85], [1, -13, 0.95], [14, -1, 0.75], [7, 10, 0.7]];
      bells.forEach(function (b) {
        const bx = x + b[0] * s;
        const by = y + b[1] * s;
        const r = 7.5 * s * b[2];
        o += '<path d="M ' + f(bx) + ' ' + f(by - r * 1.6) + ' L ' + f(bx) + ' ' + f(by - r * 0.7) +
          '" stroke="' + line + '" stroke-width="1.5" fill="none"/>';
        o += '<path d="M ' + f(bx - r) + ' ' + f(by - r * 0.5) +
          ' C ' + f(bx - r * 1.15) + ' ' + f(by + r * 0.9) + ' ' + f(bx - r * 0.45) + ' ' + f(by + r * 1.25) + ' ' + f(bx) + ' ' + f(by + r * 1.25) +
          ' C ' + f(bx + r * 0.45) + ' ' + f(by + r * 1.25) + ' ' + f(bx + r * 1.15) + ' ' + f(by + r * 0.9) + ' ' + f(bx + r) + ' ' + f(by - r * 0.5) +
          ' Q ' + f(bx) + ' ' + f(by - r * 0.1) + ' ' + f(bx - r) + ' ' + f(by - r * 0.5) +
          '" fill="' + fill + '" stroke="' + line + '" stroke-width="1.8" stroke-linejoin="round"/>';
      });
      return o;
    },

    // 满天星：细枝小星点
    starry: function (x, y, s, line, fill, accent) {
      let o = "";
      const pts = [
        [-18, -12, 0.8], [-6, -19, 0.7], [8, -16, 0.9], [18, -8, 0.7],
        [-21, 2, 0.75], [-4, -2, 1.0], [11, 0, 0.8], [20, 8, 0.65],
        [-14, 13, 0.8], [2, 12, 0.9], [15, 16, 0.7], [-2, 22, 0.65],
      ];
      pts.forEach(function (p) {
        const fx = x + p[0] * s;
        const fy = y + p[1] * s;
        const k = p[2] * s;
        for (let i = 0; i < 5; i++) {
          const a = i * 72;
          const rad = (a * Math.PI) / 180;
          o += '<circle cx="' + f(fx + Math.cos(rad) * 3.1 * k) + '" cy="' + f(fy + Math.sin(rad) * 3.1 * k) +
            '" r="' + f(1.9 * k) + '" fill="' + fill + '" stroke="' + line + '" stroke-width="1.1"/>';
        }
        o += dot(fx, fy, 1.2 * k, accent);
      });
      return o;
    },

    // 山茶 / 洋桔梗：多层圆瓣
    camellia: function (x, y, s, line, fill, accent) {
      let o = "";
      for (let i = 0; i < 6; i++) {
        const a = i * 60;
        const rad = (a * Math.PI) / 180;
        o += ellipse(x + Math.cos(rad) * 9 * s, y + Math.sin(rad) * 9 * s, 9.5 * s, 7.5 * s, a, line, fill, 1.9);
      }
      for (let i = 0; i < 5; i++) {
        const a = i * 72 + 30;
        const rad = (a * Math.PI) / 180;
        o += ellipse(x + Math.cos(rad) * 4.6 * s, y + Math.sin(rad) * 4.6 * s, 5.6 * s, 4.4 * s, a, line, fill, 1.6);
      }
      o += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(3.4 * s) + '" fill="' + accent +
        '" stroke="' + line + '" stroke-width="1.5"/>';
      return o;
    },

    // 牡丹：波浪层叠花瓣
    peony: function (x, y, s, line, fill, accent) {
      let o = "";
      // 外圈波浪
      for (let i = 0; i < 7; i++) {
        const a = i * (360 / 7);
        const rad = (a * Math.PI) / 180;
        o += ellipse(x + Math.cos(rad) * 11 * s, y + Math.sin(rad) * 11 * s, 11 * s, 8 * s, a, line, fill, 1.8);
      }
      // 内圈褶皱
      for (let i = 0; i < 6; i++) {
        const a = i * 60 + 20;
        const rad = (a * Math.PI) / 180;
        o += ellipse(x + Math.cos(rad) * 5.6 * s, y + Math.sin(rad) * 5.6 * s, 6 * s, 4.4 * s, a, line, fill, 1.5);
      }
      o += '<path d="M ' + f(x - 3 * s) + ' ' + f(y + 1 * s) + ' a ' + f(3 * s) + ' ' + f(3 * s) + ' 0 1 1 ' + f(5 * s) + ' ' + f(-1 * s) +
        '" fill="none" stroke="' + line + '" stroke-width="1.4" stroke-linecap="round"/>';
      o += dot(x, y, 1.6 * s, accent);
      return o;
    },

    // 栀子花：六瓣 + 旋心
    gardenia: function (x, y, s, line, fill, accent) {
      let o = "";
      for (let i = 0; i < 6; i++) {
        const a = i * 60;
        const rad = (a * Math.PI) / 180;
        o += ellipse(x + Math.cos(rad) * 8.5 * s, y + Math.sin(rad) * 8.5 * s, 9 * s, 6.8 * s, a, line, fill, 1.9);
      }
      o += '<path d="M ' + f(x - 4.5 * s) + ' ' + f(y) + ' a ' + f(4.5 * s) + ' ' + f(4.5 * s) + ' 0 1 1 ' + f(7 * s) + ' ' + f(-2 * s) +
        ' a ' + f(3 * s) + ' ' + f(3 * s) + ' 0 1 1 ' + f(-5 * s) + ' ' + f(2.5 * s) +
        '" fill="none" stroke="' + line + '" stroke-width="1.5" stroke-linecap="round"/>';
      o += dot(x, y, 1.5 * s, accent);
      return o;
    },
  };

  // 花枝 + 叶（线条风）
  function stemsSVG(green) {
    let s = "";
    // 主枝
    s += '<path d="M232 402 C236 350 238 300 240 250 C242 210 244 180 246 158" fill="none" stroke="' + green + '" stroke-width="2.4" stroke-linecap="round"/>';
    s += '<path d="M232 402 C222 340 208 290 196 236" fill="none" stroke="' + green + '" stroke-width="2.2" stroke-linecap="round"/>';
    s += '<path d="M232 402 C244 344 262 296 286 240" fill="none" stroke="' + green + '" stroke-width="2.2" stroke-linecap="round"/>';
    s += '<path d="M232 402 C216 360 196 322 176 282" fill="none" stroke="' + green + '" stroke-width="2" stroke-linecap="round"/>';
    s += '<path d="M232 402 C250 362 276 330 302 300" fill="none" stroke="' + green + '" stroke-width="2" stroke-linecap="round"/>';
    // 叶片（线稿）
    s += '<path d="M236 330 C258 312 260 292 246 286 C232 296 230 316 236 330 Z" fill="none" stroke="' + green + '" stroke-width="2" stroke-linejoin="round"/>';
    s += '<path d="M228 352 C206 342 200 322 212 316 C226 324 230 340 228 352 Z" fill="none" stroke="' + green + '" stroke-width="2" stroke-linejoin="round"/>';
    s += '<path d="M244 292 C266 286 276 268 264 262 C250 270 244 282 244 292 Z" fill="none" stroke="' + green + '" stroke-width="2" stroke-linejoin="round"/>';
    s += '<path d="M220 306 C202 296 194 278 204 272 C218 280 222 294 220 306 Z" fill="none" stroke="' + green + '" stroke-width="2" stroke-linejoin="round"/>';
    return s;
  }

  // 包装纸（线稿）
  function wrapSVG() {
    let o = "";
    o += '<path d="M160 306 C196 288 268 288 304 306 L266 404 C252 412 212 412 198 404 Z" fill="#FFFFFF" fill-opacity="0.55" stroke="#C9A98F" stroke-width="2.2" stroke-linejoin="round"/>';
    o += '<path d="M232 302 L232 404" stroke="#C9A98F" stroke-width="1.6" stroke-dasharray="5 5" fill="none"/>';
    // 蝴蝶结
    o += '<path d="M232 300 C222 286 206 288 208 300 C210 310 224 308 232 300" fill="none" stroke="#E0729A" stroke-width="2" stroke-linejoin="round"/>';
    o += '<path d="M232 300 C242 286 258 288 256 300 C254 310 240 308 232 300" fill="none" stroke="#E0729A" stroke-width="2" stroke-linejoin="round"/>';
    o += '<circle cx="232" cy="301" r="3.2" fill="#E0729A"/>';
    return o;
  }

  // ---------- 花束渲染 ----------
  function renderBouquet() {
    const b = state.bouquet;
    els.bouquetBox.innerHTML = buildBouquetSVG(b);
    const svg = els.bouquetBox.firstElementChild;
    if (svg) svg.classList.add("bloom");
    spawnPetals(b.colors);
  }

  function buildBouquetSVG(b) {
    const line = b.colors[0];
    const fill = b.colors[1];
    const accent = b.colors[2];
    const green = b.colors[3];
    const render = FLOWER_RENDERERS[b.type] || FLOWER_RENDERERS.rose;

    const rnd = UTIL.seededRandom(UTIL.hashCode("bg" + state.dateKey));

    // 花头位置（不同花型大小差异用 s 调整）
    const layout = [
      { x: 232, y: 150, s: 1.26 },
      { x: 176, y: 200, s: 1.06 },
      { x: 290, y: 194, s: 1.1 },
      { x: 204, y: 256, s: 0.94 },
      { x: 274, y: 258, s: 0.9 },
      { x: 250, y: 100, s: 0.86 },
    ];

    let blooms = "";
    layout.forEach(function (p, i) {
      const jx = (rnd() - 0.5) * 14;
      const jy = (rnd() - 0.5) * 12;
      blooms += render(p.x + jx, p.y + jy, p.s, line, fill, accent, green);
      if (i === 0) { /* 主花保持最前 */ }
    });

    // 线条略加粗，让线稿更清晰有质感
    blooms = bumpStroke(blooms, 1.16);

    // 点缀小星（呼吸感）
    let sprinkles = "";
    for (let i = 0; i < 10; i++) {
      const sx = 175 + rnd() * 120;
      const sy = 120 + rnd() * 120;
      sprinkles += '<circle cx="' + f(sx) + '" cy="' + f(sy) + '" r="1.6" fill="' + accent + '" opacity="0.9"/>';
    }

    return (
      '<svg viewBox="0 0 460 460" xmlns="http://www.w3.org/2000/svg" class="bouquet-svg">' +
      '<g class="stems">' + bumpStroke(stemsSVG(green), 1.2) + "</g>" +
      '<g class="bouquet-wrap">' + bumpStroke(wrapSVG(), 1.05) + "</g>" +
      '<g class="flowers">' + blooms + "</g>" +
      '<g class="sprinkles">' + sprinkles + "</g>" +
      "</svg>"
    );
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
      playBoopTwice();
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
