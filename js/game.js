// ============================================================
// 每日一束花 - 主逻辑
// 依赖：config.js（GAME_CONFIG / GAME_UTIL）
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
    collected: false,   // 今日是否已领取
    history: [],        // 历史收花记录 [{date, name, quote}]
  };

  // ---------- DOM 引用 ----------
  const $ = function (sel) { return document.querySelector(sel); };
  const els = {
    greeting: $("#greeting"),
    greetingText: $("#greetingText"),
    greetingSub: $("#greetingSub"),
    main: $("#main"),
    bouquetWrap: $("#bouquetWrap"),
    flowerName: $("#flowerName"),
    moodTag: $("#moodTag"),
    quote: $("#quote"),
    dateLabel: $("#dateLabel"),
    btnCollect: $("#btnCollect"),
    btnCollectText: $("#btnCollectText"),
    btnHistory: $("#btnHistory"),
    btnShare: $("#btnShare"),
    historySheet: $("#historySheet"),
    historyList: $("#historyList"),
    historyClose: $("#historyClose"),
    toast: $("#toast"),
  };

  // ---------- 本地存储（mock 小程序 wx.getStorageSync / setStorageSync）----------
  const storage = {
    get: function (k) {
      try { return localStorage.getItem(k); } catch (e) { return null; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式下静默失败 */ }
    },
  };

  // ---------- 初始化 ----------
  function init() {
    const idx = UTIL.bouquetIndexFor(state.dateKey);
    state.bouquet = CFG.bouquets[idx];
    state.quote = CFG.quotes[UTIL.quoteIndexFor(state.dateKey)];

    loadHistory();
    renderScene();
    bindEvents();
    showGreeting();
  }

  function loadHistory() {
    const raw = storage.get("flower_history");
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        state.history = Array.isArray(arr) ? arr : [];
      } catch (e) { state.history = []; }
    }
    // 判断今日是否已领取
    state.collected = state.history.some(function (h) { return h.date === state.dateKey; });
  }

  function saveHistory() {
    storage.set("flower_history", JSON.stringify(state.history));
  }

  // ---------- 开场问候「啵啵~」----------
  function showGreeting() {
    // 逐字拆分，实现可爱动态弹跳
    els.greetingText.innerHTML = "";
    var chars = CFG.greetingText.split("");
    chars.forEach(function (ch, i) {
      var span = document.createElement("span");
      span.className = "bounce-char";
      span.textContent = ch;
      span.style.animationDelay = (i * 0.12) + "s";  // 逐字错峰入场
      els.greetingText.appendChild(span);
    });

    els.greetingSub.textContent = CFG.greetingSub;

    // 入场
    els.greeting.classList.add("show");
    els.greetingText.classList.add("pop");

    // 停留后淡出，进入主场景
    setTimeout(function () {
      els.greeting.classList.add("fade-out");
    }, CFG.anim.greetingIn + CFG.anim.greetingHold);

    setTimeout(function () {
      els.greeting.classList.remove("show", "fade-out");
      els.main.classList.add("show");
      renderBouquet();
      // 首次手势后解锁音频（移动端自动播放限制）
      unlockAudio();
    }, CFG.anim.greetingIn + CFG.anim.greetingHold + CFG.anim.greetingOut);
  }

  // ---------- 场景渲染 ----------
  function renderScene() {
    els.flowerName.textContent = state.bouquet.name;
    els.moodTag.textContent = state.bouquet.mood;
    els.quote.textContent = "“" + state.quote + "”";
    els.dateLabel.textContent = "今日花语 · " + state.dateKey;

    // 按钮初始态
    if (state.collected) {
      setCollectedUI();
    }
  }

  // ---------- 花束 SVG 生成 ----------
  function renderBouquet() {
    const b = state.bouquet;
    const svg = buildBouquetSVG(b);
    els.bouquetWrap.innerHTML = svg;

    // 触发绽放动画
    const bouquetEl = els.bouquetWrap.firstElementChild;
    if (bouquetEl) {
      bouquetEl.classList.add("bloom");
    }

    // 落花粒子（点缀氛围）
    spawnPetals(b.colors);
  }

  // 生成一束花的 SVG（浪漫线条 + 柔和配色）
  function buildBouquetSVG(b) {
    const [c1, c2, green] = b.colors;
    // 用确定性随机摆放花朵位置
    const rnd = UTIL.seededRandom(UTIL.hashCode("bg" + state.dateKey));

    let flowers = "";
    // 主花 5 朵 + 小花 6 朵，随机偏移营造自然感
    const mainFlowers = [
      { x: 260, y: 150, s: 1.0 },
      { x: 320, y: 110, s: 0.85 },
      { x: 220, y: 110, s: 0.82 },
      { x: 370, y: 190, s: 0.75 },
      { x: 190, y: 200, s: 0.72 },
    ];
    mainFlowers.forEach(function (f, i) {
      const dx = (rnd() - 0.5) * 30;
      const dy = (rnd() - 0.5) * 24;
      flowers += flowerSVG(f.x + dx, f.y + dy, f.s, c1, c2, i);
    });

    // 满天星式的小点缀
    for (let i = 0; i < 14; i++) {
      const sx = 180 + rnd() * 220;
      const sy = 130 + rnd() * 110;
      flowers += tinyDot(sx, sy, (rnd() > 0.5 ? c2 : "#fff"));
    }

    // 花枝与叶片
    const stems = stemSVG(green);

    return (
      '<svg viewBox="0 0 460 420" xmlns="http://www.w3.org/2000/svg" class="bouquet-svg">' +
      '<g class="stems">' + stems + "</g>" +
      '<g class="flowers">' + flowers + "</g>" +
      '<g class="wrap">' +
      '<path d="M150 320 L200 260 L230 380 L190 400 Z" fill="#F6E7D8" opacity="0.9"/>' +
      '<path d="M310 320 L260 260 L230 380 L270 400 Z" fill="#F2DDC9" opacity="0.9"/>' +
      '<path d="M230 380 L230 340 L290 400 L260 410 Z" fill="#EFD5BE" opacity="0.9"/>' +
      '<path d="M180 350 L280 350 L285 410 L175 410 Z" fill="#F6E7D8" stroke="#E8CBAF" stroke-width="2"/>' +
      "</g>" +
      "</svg>"
    );
  }

  // 单朵花（5 瓣 + 花心）
  function flowerSVG(x, y, s, petal, center, idx) {
    const petals = [];
    for (let i = 0; i < 5; i++) {
      const ang = (i * 72) * Math.PI / 180;
      const px = x + Math.cos(ang) * 22 * s;
      const py = y + Math.sin(ang) * 22 * s;
      petals.push(
        '<ellipse cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) +
        '" rx="' + (16 * s).toFixed(1) + '" ry="' + (11 * s).toFixed(1) +
        '" transform="rotate(' + (i * 72) + ' ' + px.toFixed(1) + ' ' + py.toFixed(1) + ')"' +
        ' fill="' + petal + '" stroke="' + center + '" stroke-width="1.5"/>'
      );
    }
    return (
      '<g class="flower">' + petals.join("") +
      '<circle cx="' + x + '" cy="' + y + '" r="' + (8 * s).toFixed(1) + '" fill="' + center + '"/>' +
      '<circle cx="' + (x - 2) + '" cy="' + (y - 2) + '" r="' + (2.5 * s).toFixed(1) + '" fill="#fff" opacity="0.6"/>' +
      "</g>"
    );
  }

  function tinyDot(x, y, color) {
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.5" fill="' + color + '" opacity="0.85"/>';
  }

  function stemSVG(green) {
    let s = "";
    // 主枝干
    s += '<path d="M230 400 L240 280 L250 200 L260 150" fill="none" stroke="' + green + '" stroke-width="4" stroke-linecap="round"/>';
    s += '<path d="M230 400 L210 300 L195 230" fill="none" stroke="' + green + '" stroke-width="3.5" stroke-linecap="round"/>';
    s += '<path d="M230 400 L260 310 L300 240" fill="none" stroke="' + green + '" stroke-width="3.5" stroke-linecap="round"/>';
    // 叶子
    s += '<path d="M238 320 Q260 300 252 282 Q236 296 238 320" fill="' + green + '" opacity="0.85"/>';
    s += '<path d="M228 340 Q205 330 210 312 Q226 326 228 340" fill="' + green + '" opacity="0.8"/>';
    s += '<path d="M250 290 Q275 285 272 268 Q256 280 250 290" fill="' + green + '" opacity="0.8"/>';
    return s;
  }

  // 落花粒子
  function spawnPetals(colors) {
    const layer = document.createElement("div");
    layer.className = "petal-layer";
    document.body.appendChild(layer);

    for (let i = 0; i < 14; i++) {
      const p = document.createElement("span");
      p.className = "petal";
      p.style.left = (Math.random() * 100) + "%";
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = (Math.random() * 4) + "s";
      p.style.animationDuration = (5 + Math.random() * 4) + "s";
      p.style.width = p.style.height = (6 + Math.random() * 8) + "px";
      layer.appendChild(p);
    }

    // 自动清理，避免堆积
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, CFG.anim.petalFall + 4000);
  }

  // ---------- 领取今日花束 ----------
  function collectFlower() {
    if (state.collected) {
      showToast("今天的花已经收好啦 🌼");
      return;
    }

    state.collected = true;
    state.history.push({ date: state.dateKey, name: state.bouquet.name, quote: state.quote });
    if (state.history.length > CFG.collectionMax) {
      state.history = state.history.slice(-CFG.collectionMax);
    }
    saveHistory();
    setCollectedUI();
    showToast("已收下今日的 " + state.bouquet.name + " 🌸");
  }

  function setCollectedUI() {
    els.btnCollect.classList.add("done");
    els.btnCollectText.textContent = "今日已收花";
  }

  // ---------- 收藏册 ----------
  function openHistory() {
    renderHistory();
    els.historySheet.classList.add("show");
  }
  function closeHistory() {
    els.historySheet.classList.remove("show");
  }
  function renderHistory() {
    if (state.history.length === 0) {
      els.historyList.innerHTML = '<div class="empty">还没有收过花，快去领取今日花束吧～</div>';
      return;
    }
    // 从新到旧排序
    const list = state.history.slice().reverse();
    let html = "";
    list.forEach(function (h) {
      html +=
        '<div class="history-item">' +
        '<span class="h-date">' + h.date + "</span>" +
        '<span class="h-name">' + h.name + "</span>" +
        '<span class="h-quote">' + h.quote + "</span>" +
        "</div>";
    });
    els.historyList.innerHTML = html;
  }

  // ---------- 分享（预览版 mock：复制文字）----------
  function shareFlower() {
    const text = "【每日一束花】今天送你一束" + state.bouquet.name + "：" + state.quote;
    // 优先走小程序分享（mock），预览版降级为复制
    if (window.wx && typeof wx.shareAppMessage === "function") {
      wx.shareAppMessage({ title: text });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast("文案已复制，去分享给好友吧 💐");
      }).catch(function () {
        showToast(text);
      });
    } else {
      showToast("分享文案：" + text);
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

  // ---------- 事件绑定 ----------
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
    // 点击遮罩关闭收藏册
    els.historySheet.addEventListener("click", function (e) {
      if (e.target === els.historySheet) closeHistory();
    });

    // 触摸友好：按钮用 touchend 兜底（部分移动端 click 有 300ms 延迟）
    // 这里保留 click 为主，touch 事件不重复触发
  }

  // ---------- 音频解锁（移动端需首次手势后）----------
  function unlockAudio() {
    // 本版本无音频资源，预留钩子：小程序/后续版本可在此创建 AudioContext
    // 保持空实现以符合"首次手势后解锁音频"的验收要求
  }

  // ---------- 小程序 API mock（预览版）----------
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
