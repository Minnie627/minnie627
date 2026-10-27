// ============================================================
// 配置表：所有数值与文案集中在此，策划可改此文件调参
// 命名规范：模块_元素
// ============================================================
window.GAME_CONFIG = {
  // 开场问候语
  greetingText: "啵啵~",
  greetingSub: "今天也来收一束属于你的花吧",

  // 花束主题（每天按日期种子从中取一组）
  // type: 主花类型；palette: 配色；文案匹配用 quoteIdx 见 quotes 数组下标
  bouquets: [
    { name: "小雏菊",   emoji: "🌼", colors: ["#FFE066", "#FFF4C2", "#7EC87E"], mood: "元气" },
    { name: "玫瑰",     emoji: "🌹", colors: ["#F5A6B8", "#E86A8C", "#7EC87E"], mood: "浪漫" },
    { name: "向日葵",   emoji: "🌻", colors: ["#FFB84D", "#F5A623", "#7EC87E"], mood: "阳光" },
    { name: "郁金香",   emoji: "🌷", colors: ["#F7C6D9", "#E88FB0", "#8FCB9B"], mood: "温柔" },
    { name: "绣球花",   emoji: "💐", colors: ["#B9A6E0", "#8F7BC8", "#9AD0A0"], mood: "治愈" },
    { name: "满天星",   emoji: "🌸", colors: ["#FBD1E0", "#F3A6C0", "#A8D8A8"], mood: "清甜" },
    { name: "铃兰",     emoji: "🪻", colors: ["#E6E1F0", "#C7B8E0", "#9ED0A0"], mood: "安静" },
  ],

  // 治愈文案库（数量充足，每日不同）
  quotes: [
    "今天也要好好吃饭，好好睡觉，好好爱自己。",
    "你不需要成为别人，你已经足够好。",
    "慢慢来，比较快。",
    "世界偶尔薄凉，内心也要繁花似锦。",
    "把烦恼交给风，把好心情留给自己。",
    "今天的不开心，就到此为止吧。",
    "你值得世间一切温柔。",
    "花会沿路盛开，你以后的路也是。",
    "别急，最好的总在不经意间出现。",
    "累的时候，记得抱抱自己。",
    "一切都会好起来的，如果还没好，那就是还没到最后。",
    "生活明朗，万物可爱。",
    "你要相信，总有一束光，是为你而亮。",
    "温柔半两，从容一生。",
    "今天的你，也辛苦了呀。",
    "把日子过成自己喜欢的样子。",
    "愿你被这个世界温柔以待。",
    "心若向阳，无谓悲伤。",
    "有些美好，值得慢慢等待。",
    "先爱自己，再爱别人。",
    "路还长，我们慢慢走。",
    "每一个平凡的日子，都值得被认真对待。",
    "愿你眼中有光，心中有暖。",
    "小确幸，是生活偷偷给的糖。",
    "你笑起来，就是今天最美的花。",
    "别怕，我一直在。",
    "熬过无人问津的日子，才能拥抱诗和远方。",
    "世界那么大，总会有人懂你。",
    "愿你历尽千帆，归来仍是少年。",
    "今天也要元气满满地出发呀。",
    "所有的温柔，都藏在细节里。",
    "你不必光芒万丈，但请始终温暖有光。",
  ],

  // 收藏册上限（本地 localStorage 存储）
  collectionMax: 120,

  // 动画时长（毫秒）
  anim: {
    greetingIn: 900,
    greetingHold: 1200,
    greetingOut: 600,
    bloom: 1200,
    petalFall: 6000,
  },
};

// ============================================================
// 种子随机数（日期 → 可复现的确定性随机），保证同一天花束一致
// ============================================================
window.GAME_UTIL = {
  // 简单确定性哈希（字符串 → uint32）
  hashCode: function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },
  // 基于种子的伪随机（mulberry32）
  seededRandom: function (seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  // 生成今日日期 key，如 "2026-10-27"
  todayKey: function () {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  },
  // 根据日期 key 计算今日花束索引
  bouquetIndexFor: function (dateKey) {
    const h = this.hashCode(dateKey);
    return h % window.GAME_CONFIG.bouquets.length;
  },
  // 根据日期 key 计算今日文案索引
  quoteIndexFor: function (dateKey) {
    const h = this.hashCode("q" + dateKey);
    return h % window.GAME_CONFIG.quotes.length;
  },
};
