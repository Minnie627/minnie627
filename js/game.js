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

  // 「啵啵」两声，音高略不同，更像嘴巴发出的声音（语音不可用时的兜底）
  function playBoopTwice() {
    const ok1 = playBoop(0, 900);
    const ok2 = playBoop(0.19, 760);
    if (ok1 || ok2) state.boopPlayed = true;
    return ok1 || ok2;
  }

  // ---------- 稚幼童声朗读「bō」「bó」 ----------
  let cachedVoice = null;

  function pickZhVoice() {
    if (!window.speechSynthesis) return null;
    let list = [];
    try { list = speechSynthesis.getVoices() || []; } catch (e) { return null; }
    if (!list.length) return null;
    const zh = list.filter(function (v) { return /^zh/i.test(v.lang || ""); });
    if (!zh.length) return null;
    // 优先挑选偏童声 / 女声的音色，听起来更稚嫩
    const prefer = /child|kid|girl|junior|xiaoyi|xiaoxiao|xiaohan|ting|huihui|yaoyao|female|女|童/i;
    return zh.find(function (v) { return prefer.test(v.name || ""); }) || zh[0];
  }

  // 预热音色列表（部分浏览器异步加载）
  if (window.speechSynthesis) {
    cachedVoice = pickZhVoice();
    try {
      speechSynthesis.onvoiceschanged = function () { cachedVoice = pickZhVoice(); };
    } catch (e) {}
  }

  // 第一声 bō（阴平：高而平），第二声 bó（阳平：更扬、尾音略长）
  function speakBo() {
    if (!window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") return false;
    try {
      speechSynthesis.cancel();
      const v = cachedVoice || pickZhVoice();
      const mk = function (pitch, rate) {
        const u = new SpeechSynthesisUtterance("啵");
        u.lang = "zh-CN";
        u.pitch = pitch;   // 高音高 → 童声感
        u.rate = rate;
        u.volume = 1;
        if (v) u.voice = v;
        return u;
      };
      speechSynthesis.speak(mk(1.9, 0.92));   // bō
      setTimeout(function () {
        try { speechSynthesis.speak(mk(2.0, 0.62)); } catch (e) {}  // bó：更慢更长，听感上扬
      }, 440);
      state.boopPlayed = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  // 统一入口：优先童声，不可用则退回合成「啵」音
  function sayBo() {
    const ok = speakBo();
    if (!ok) playBoopTwice();
    return ok;
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
        setTimeout(function () { sayBo(); }, 60);
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

    // 用墨迹晕染的方式显现（笔画始终完整，不做部分描边）
    const word = els.handwrite.querySelector(".hw-word");
    if (word) {
      word.classList.remove("hw-in");
      // 强制回流，确保动画每次都重新播放
      void word.getBoundingClientRect();
      word.classList.add("hw-in");
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

  // 手写「dc」：取自参考图的优雅斜体书写风；笔画完整连贯、整体居中，无任何装饰元素
  function buildHandwriteSVG() {
    return (
      '<svg viewBox="0 0 320 200" class="handwrite-svg" xmlns="http://www.w3.org/2000/svg">' +
        '<text class="hw-word" x="160" y="142" text-anchor="middle" ' +
          'font-family="Cormorant Garamond, Playfair Display, Georgia, Times New Roman, serif" ' +
          'font-style="italic" font-weight="400" font-size="148" letter-spacing="3">dc</text>' +
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
  // 花束渲染（复古植物学墨线风格，绘制逻辑在 flowers.js）
  // ============================================================
  function renderBouquet() {
    const b = state.bouquet;
    const rnd = UTIL.seededRandom(UTIL.hashCode("bg" + state.dateKey));
    els.bouquetBox.innerHTML = window.FLOWERS.build(b, rnd);
    const svg = els.bouquetBox.firstElementChild;
    if (svg) svg.classList.add("bloom");
    // 纸色调飘落花瓣，克制不抢戏
    spawnPetals(["#E8E1CC", "#DCD3B8", "#CFC5AA"]);
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
