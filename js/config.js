// ============================================================
// 配置表：所有数值与文案集中在此，策划可改此文件调参
// ============================================================
window.GAME_CONFIG = {
  // 开场问候语
  greetingText: "啵啵~",
  greetingSub: "今天也有一束花，想轻轻送给你",
  greetHint: "轻触屏幕，听一声「啵啵」",

  // 花束主题：每天按日期种子取一组
  // type 决定线条绘制方式；colors = [线稿主色, 花瓣浅填充, 花心点缀, 枝叶绿]
  bouquets: [
    { name: "玫瑰",     type: "rose",        mood: "热恋", colors: ["#D9537A", "#FFF2F6", "#F7A8C4", "#6FA96F"] },
    { name: "郁金香",   type: "tulip",       mood: "心动", colors: ["#E0729A", "#FFF4F8", "#F6B3CC", "#78B378"] },
    { name: "小雏菊",   type: "daisy",       mood: "初恋", colors: ["#E8A33D", "#FFFCF3", "#FFE08A", "#7FBF7F"] },
    { name: "向日葵",   type: "sunflower",   mood: "炽热", colors: ["#D98A24", "#FFF9EC", "#FFC65C", "#6FA96F"] },
    { name: "绣球花",   type: "hydrangea",   mood: "温柔", colors: ["#8B7BC4", "#F7F4FF", "#C3B6EC", "#7BB87B"] },
    { name: "铃兰",     type: "bell",        mood: "纯爱", colors: ["#7FAE86", "#F8FCF8", "#CFE8CF", "#6FA96F"] },
    { name: "满天星",   type: "starry",      mood: "思念", colors: ["#D98BA8", "#FFF8FB", "#F8C9DB", "#86BE86"] },
    { name: "山茶花",   type: "camellia",    mood: "深情", colors: ["#C94B63", "#FFF5F6", "#F09BAA", "#6FA96F"] },
    { name: "牡丹",     type: "peony",       mood: "眷恋", colors: ["#DE6C8C", "#FFF6F9", "#F7B3C7", "#7AB47A"] },
    { name: "栀子花",   type: "gardenia",    mood: "约定", colors: ["#B8A44E", "#FFFDF4", "#F2E6A8", "#74AE74"] },
    { name: "风铃草",   type: "bell",        mood: "守候", colors: ["#7E8FCB", "#F6F8FF", "#BCC7F0", "#79B379"] },
    { name: "洋桔梗",   type: "camellia",    mood: "陪伴", colors: ["#C08AC4", "#FCF6FD", "#E4C0E6", "#7BB47B"] },
  ],

  // 爱情文案库（每日一句，随日期变化）
  quotes: [
    "遇见你之后，我的每个明天都变得值得期待。",
    "你是我平淡日子里，最心动的那一束光。",
    "想和你一起，把春天过成一辈子。",
    "喜欢是乍见之欢，爱你是久处不厌。",
    "世界很大，我的眼里只有你。",
    "你今天有一点可爱，我有一点心动。",
    "我把所有的温柔，都留给了你。",
    "与你有关的每一天，都是好天气。",
    "想牵着你的手，走很长很长的路。",
    "你一笑，我的心就开了一整片花海。",
    "余生很长，请多多指教。",
    "我不擅长说情话，可我说的话都是真的。",
    "你是我藏在心里的，最甜的秘密。",
    "想和你一起看日出，也一起等日落。",
    "有你在的地方，就是我想去的远方。",
    "爱你这件事，我从来没有含糊过。",
    "你是我所有不确定里，唯一的确定。",
    "今天的风很甜，因为想到了你。",
    "我数过了，喜欢你的理由有一万个。",
    "你不需要完美，你只需要是你。",
    "想在你身边，做你最喜欢的那束花。",
    "我把心事种成花，等它开给你看。",
    "与你相遇，是我最好的运气。",
    "你走过的地方，都开满了花。",
    "想和你共享每一个平凡的清晨。",
    "爱你，是我做过最勇敢的事。",
    "你是我心里，最温柔的那一页。",
    "就算世界荒芜，我也会站在你身边。",
    "你今天也在我心里，开了一朵花。",
    "想和你慢慢变老，慢慢把日子过甜。",
    "你是我的心事，也是我的答案。",
    "每次想你，心里都会亮一下。",
    "我的手很冷，可以借你的吗。",
    "你是我想收藏一辈子的人。",
    "想送你的不止这束花，还有我全部的心动。",
    "你不用奔向谁，我会走向你。",
    "喜欢你的日子，连风都是甜的。",
    "你是我漫长岁月里，唯一的偏爱。",
    "想和你一起，把普通的日子过成纪念日。",
    "爱你，是我每天都会重新决定的事。",
    "我把今天的花，和今天的心，都送给你。",
    "你出现的那天，我的世界开始有颜色。",
    "想成为你疲惫时，可以停靠的那盏灯。",
    "你说过的每句晚安，我都偷偷收好了。",
    "这束花会谢，但我不会。",
  ],

  // 手动指定某一天的花束与文案（不改则按日期轮换）
  // 例：{ "2026-10-28": { flower: "玫瑰", quote: "……" } }
  pinned: {
    "2026-10-28": {
      flower: "玫瑰",
      quote: "这束玫瑰，替我说出那句一直没说出口的「我爱你」。",
    },
  },

  // 领取后的俏皮小弹窗
  loveMessage: "亲爱的，我爱你",

  // 收藏册上限（本地存储）
  collectionMax: 365,

  // 动画时长（毫秒）
  anim: {
    greetingIn: 900,
    greetingHold: 1400,
    greetingOut: 600,
    handwrite: 1500,   // 手写 dc
    handwriteOut: 380, // 手写淡出
    bloom: 1200,       // 鲜花淡入绽放
  },
};

// ============================================================
// 种子随机（日期 → 可复现的确定性随机），保证同一天花束一致
// ============================================================
window.GAME_UTIL = {
  hashCode: function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },
  seededRandom: function (seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  // 日期格式化 "2026-10-28"
  fmtDate: function (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  },
  todayKey: function () {
    return this.fmtDate(new Date());
  },
  bouquetIndexFor: function (dateKey) {
    const pin = (window.GAME_CONFIG.pinned || {})[dateKey];
    if (pin && pin.flower) {
      const i = window.GAME_CONFIG.bouquets.findIndex(function (b) { return b.name === pin.flower; });
      if (i >= 0) return i;
    }
    return this.hashCode(dateKey) % window.GAME_CONFIG.bouquets.length;
  },
  quoteIndexFor: function (dateKey) {
    const pin = (window.GAME_CONFIG.pinned || {})[dateKey];
    if (pin && pin.quote) {
      const i = window.GAME_CONFIG.quotes.indexOf(pin.quote);
      if (i >= 0) return i;
      window.GAME_CONFIG.quotes.push(pin.quote);   // 自定义文案临时入表
      return window.GAME_CONFIG.quotes.length - 1;
    }
    return this.hashCode("q" + dateKey) % window.GAME_CONFIG.quotes.length;
  },
  // 查询某一天的花束与文案（供数据查询用）
  lookup: function (dateKey) {
    const C = window.GAME_CONFIG;
    return {
      date: dateKey,
      flower: C.bouquets[this.bouquetIndexFor(dateKey)].name,
      mood: C.bouquets[this.bouquetIndexFor(dateKey)].mood,
      quote: C.quotes[this.quoteIndexFor(dateKey)],
    };
  },
};
