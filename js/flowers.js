// ============================================================
// 复古植物学墨线花卉绘制引擎
// 风格参考：陈旧纸张 + 深墨绿细线 + 白色花朵 + 实心绿叶
// 对外接口：window.FLOWERS.build(bouquet, seededRandom)
// ============================================================
(function () {
  "use strict";

  // 墨色调
  const INK = {
    line: "#3F4C39",     // 线稿墨绿
    leaf: "#4E6347",     // 叶片实心绿
    vein: "#F3EEDF",     // 叶脉（纸色）
    flower: "#FCFAF3",   // 花瓣奶白
    stamen: "#6B7A5E",   // 花蕊
  };

  const f = function (n) { return Math.round(n * 10) / 10; };

  // 各花型的绘制参数
  const TYPE_PARAMS = {
    rose:      { shape: "round",   petals: 9,  layers: 3, center: "swirl",  size: 1.0,  count: 3, cluster: false },
    tulip:     { shape: "cup",     petals: 3,  layers: 1, center: "none",   size: 1.05, count: 3, cluster: false },
    daisy:     { shape: "narrow",  petals: 14, layers: 2, center: "dot",    size: 0.95, count: 3, cluster: false },
    sunflower: { shape: "pointed", petals: 16, layers: 2, center: "seed",   size: 1.05, count: 2, cluster: false },
    hydrangea: { shape: "round",   petals: 5,  layers: 1, center: "dot",    size: 0.52, count: 9, cluster: true  },
    bell:      { shape: "bell",    petals: 1,  layers: 1, center: "none",   size: 1.15, count: 2, cluster: true  },
    starry:    { shape: "tiny",    petals: 5,  layers: 1, center: "dot",    size: 0.4,  count: 11, cluster: true },
    camellia:  { shape: "round",   petals: 6,  layers: 2, center: "stamen", size: 1.0,  count: 3, cluster: false },
    peony:     { shape: "ruffle",  petals: 10, layers: 3, center: "stamen", size: 1.08, count: 2, cluster: false },
    gardenia:  { shape: "round",   petals: 6,  layers: 2, center: "swirl",  size: 1.0,  count: 3, cluster: false },
  };

  // ---------------- 基础图形 ----------------

  // 单片花瓣（局部坐标：以花心为原点，向上伸展）
  function petal(cx, cy, len, wid, ang, shape, fill) {
    let d = "";
    if (shape === "narrow") {
      d = "M0 0 C " + f(-wid * 0.55) + " " + f(-len * 0.4) + " " + f(-wid * 0.45) + " " + f(-len * 0.86) + " 0 " + f(-len) +
          " C " + f(wid * 0.45) + " " + f(-len * 0.86) + " " + f(wid * 0.55) + " " + f(-len * 0.4) + " 0 0 Z";
    } else if (shape === "pointed") {
      d = "M0 0 C " + f(-wid) + " " + f(-len * 0.28) + " " + f(-wid * 0.52) + " " + f(-len * 0.78) + " 0 " + f(-len) +
          " C " + f(wid * 0.52) + " " + f(-len * 0.78) + " " + f(wid) + " " + f(-len * 0.28) + " 0 0 Z";
    } else if (shape === "ruffle") {
      d = "M0 0 C " + f(-wid * 1.12) + " " + f(-len * 0.26) + " " + f(-wid * 1.02) + " " + f(-len * 0.6) + " " + f(-wid * 0.6) + " " + f(-len * 0.7) +
          " C " + f(-wid * 0.56) + " " + f(-len * 0.9) + " " + f(-wid * 0.22) + " " + f(-len * 0.92) + " 0 " + f(-len) +
          " C " + f(wid * 0.22) + " " + f(-len * 0.92) + " " + f(wid * 0.56) + " " + f(-len * 0.9) + " " + f(wid * 0.6) + " " + f(-len * 0.7) +
          " C " + f(wid * 1.02) + " " + f(-len * 0.6) + " " + f(wid * 1.12) + " " + f(-len * 0.26) + " 0 0 Z";
    } else if (shape === "cup") {
      d = "M0 0 C " + f(-wid * 1.25) + " " + f(-len * 0.35) + " " + f(-wid * 1.35) + " " + f(-len * 0.92) + " " + f(-wid * 0.55) + " " + f(-len) +
          " C " + f(-wid * 0.18) + " " + f(-len * 1.06) + " " + f(wid * 0.18) + " " + f(-len * 1.06) + " " + f(wid * 0.55) + " " + f(-len) +
          " C " + f(wid * 1.35) + " " + f(-len * 0.92) + " " + f(wid * 1.25) + " " + f(-len * 0.35) + " 0 0 Z";
    } else if (shape === "tiny") {
      d = "M0 0 C " + f(-wid) + " " + f(-len * 0.5) + " " + f(-wid * 0.95) + " " + f(-len * 0.95) + " 0 " + f(-len) +
          " C " + f(wid * 0.95) + " " + f(-len * 0.95) + " " + f(wid) + " " + f(-len * 0.5) + " 0 0 Z";
    } else {
      d = "M0 0 C " + f(-wid) + " " + f(-len * 0.34) + " " + f(-wid * 0.96) + " " + f(-len * 0.8) + " 0 " + f(-len) +
          " C " + f(wid * 0.96) + " " + f(-len * 0.8) + " " + f(wid) + " " + f(-len * 0.34) + " 0 0 Z";
    }
    return '<path d="' + d + '" transform="translate(' + f(cx) + ' ' + f(cy) + ') rotate(' + f(ang) + ')"' +
      ' fill="' + fill + '" stroke="' + INK.line + '" stroke-width="1.5" stroke-linejoin="round"/>';
  }

  // 花心
  function bloomCenter(cx, cy, r, P) {
    if (P.center === "none") return "";
    if (P.center === "swirl") {
      return '<path d="M ' + f(cx - r * 0.85) + ' ' + f(cy) +
        ' a ' + f(r * 0.85) + ' ' + f(r * 0.85) + ' 0 1 1 ' + f(r * 1.35) + ' ' + f(r * 0.12) +
        ' a ' + f(r * 0.5) + ' ' + f(r * 0.5) + ' 0 1 1 ' + f(-r * 0.82) + ' ' + f(r * 0.16) +
        '" fill="none" stroke="' + INK.line + '" stroke-width="1.3" stroke-linecap="round"/>';
    }
    if (P.center === "dot") {
      let o = '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r * 0.8) + '" fill="' + INK.leaf +
        '" stroke="' + INK.line + '" stroke-width="1.1"/>';
      for (let i = 0; i < 5; i++) {
        const a = (i * 72 * Math.PI) / 180;
        o += '<circle cx="' + f(cx + Math.cos(a) * r * 0.36) + '" cy="' + f(cy + Math.sin(a) * r * 0.36) +
          '" r="' + f(r * 0.16) + '" fill="' + INK.flower + '"/>';
      }
      return o;
    }
    if (P.center === "seed") {
      let o = '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r * 1.15) + '" fill="' + INK.leaf +
        '" stroke="' + INK.line + '" stroke-width="1.2"/>';
      for (let i = 0; i < 12; i++) {
        const a = (i * 30 * Math.PI) / 180;
        const rad = r * (i % 2 === 0 ? 0.42 : 0.78);
        o += '<circle cx="' + f(cx + Math.cos(a) * rad) + '" cy="' + f(cy + Math.sin(a) * rad) +
          '" r="1.5" fill="' + INK.stamen + '"/>';
      }
      return o;
    }
    if (P.center === "stamen") {
      let o = "";
      for (let i = 0; i < 9; i++) {
        const a = ((i * 40 + 8) * Math.PI) / 180;
        const x2 = cx + Math.cos(a) * r * 1.65;
        const y2 = cy + Math.sin(a) * r * 1.65;
        o += '<path d="M ' + f(cx) + ' ' + f(cy) + ' L ' + f(x2) + ' ' + f(y2) +
          '" stroke="' + INK.stamen + '" stroke-width="1.1" stroke-linecap="round"/>';
        o += '<circle cx="' + f(x2) + '" cy="' + f(y2) + '" r="1.7" fill="' + INK.stamen + '"/>';
      }
      o += '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r * 0.45) + '" fill="' + INK.flower +
        '" stroke="' + INK.line + '" stroke-width="1.1"/>';
      return o;
    }
    return "";
  }

  // 铃兰：垂挂小铃
  function bellCluster(cx, cy, r, rot) {
    let o = "";
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const bx = cx + (t - 0.5) * r * 2.1;
      const by = cy + Math.sin(t * Math.PI) * r * 0.45 + t * r * 0.25;
      const rr = r * (0.36 - t * 0.06);
      o += '<path d="M ' + f(bx - rr) + ' ' + f(by - rr * 0.3) +
        ' C ' + f(bx - rr * 1.3) + ' ' + f(by + rr * 0.95) + ' ' + f(bx - rr * 0.5) + ' ' + f(by + rr * 1.4) + ' ' + f(bx) + ' ' + f(by + rr * 1.4) +
        ' C ' + f(bx + rr * 0.5) + ' ' + f(by + rr * 1.4) + ' ' + f(bx + rr * 1.3) + ' ' + f(by + rr * 0.95) + ' ' + f(bx + rr) + ' ' + f(by - rr * 0.3) +
        ' Q ' + f(bx) + ' ' + f(by + rr * 0.08) + ' ' + f(bx - rr) + ' ' + f(by - rr * 0.3) +
        '" fill="' + INK.flower + '" stroke="' + INK.line + '" stroke-width="1.4" stroke-linejoin="round"/>';
      o += '<path d="M ' + f(bx) + ' ' + f(by - rr * 1.5) + ' L ' + f(bx) + ' ' + f(by - rr * 0.35) +
        '" stroke="' + INK.leaf + '" stroke-width="1.3" stroke-linecap="round"/>';
    }
    return o;
  }

  // 一朵完整的花
  function bloom(cx, cy, r, P, rot) {
    if (P.shape === "bell") {
      return '<g class="bloom">' + bellCluster(cx, cy, r, rot) + "</g>";
    }
    let o = "";
    if (P.shape === "cup") {
      const len = r * 0.98;
      const wid = len * 0.4;
      [-26, 0, 26].forEach(function (a) {
        o += petal(cx, cy, len, wid, a + rot, "cup", INK.flower);
      });
      o += '<path d="M ' + f(cx) + ' ' + f(cy - len * 0.1) + ' L ' + f(cx) + ' ' + f(cy - len * 0.86) +
        '" stroke="' + INK.line + '" stroke-width="1.1" fill="none" opacity="0.85"/>';
      return '<g class="bloom">' + o + "</g>";
    }

    const layers = Math.max(1, P.layers);
    for (let L = 0; L < layers; L++) {
      const len = r * (1 - L * 0.27);
      const wid = len * (P.shape === "narrow" || P.shape === "tiny" ? 0.25 : 0.43);
      const n = P.petals;
      const off = (360 / n) * 0.5 * L + rot;
      for (let i = 0; i < n; i++) {
        o += petal(cx, cy, len, wid, off + (360 / n) * i, P.shape, INK.flower);
      }
    }
    o += bloomCenter(cx, cy, r * (P.center === "seed" ? 0.3 : 0.34), P);
    return '<g class="bloom">' + o + "</g>";
  }

  // 叶片（实心绿 + 纸色叶脉）
  function leaf(x, y, len, wid, ang) {
    const d = "M0 0 C " + f(-wid) + " " + f(-len * 0.3) + " " + f(-wid * 0.88) + " " + f(-len * 0.72) + " 0 " + f(-len) +
      " C " + f(wid * 0.88) + " " + f(-len * 0.72) + " " + f(wid) + " " + f(-len * 0.3) + " 0 0 Z";
    return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(ang) + ')">' +
      '<path d="' + d + '" fill="' + INK.leaf + '" stroke="' + INK.line + '" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<path d="M0 ' + f(-len * 0.12) + ' L0 ' + f(-len * 0.86) + '" stroke="' + INK.vein + '" stroke-width="1.1" opacity="0.9"/>' +
      '<path d="M0 ' + f(-len * 0.4) + ' L ' + f(-wid * 0.42) + ' ' + f(-len * 0.56) + '" stroke="' + INK.vein + '" stroke-width="0.9" opacity="0.7"/>' +
      '<path d="M0 ' + f(-len * 0.55) + ' L ' + f(wid * 0.42) + ' ' + f(-len * 0.7) + '" stroke="' + INK.vein + '" stroke-width="0.9" opacity="0.7"/>' +
      "</g>";
  }

  // 花苞
  function bud(x, y, h, w, ang) {
    // 细长水滴形花苞 + 花萼
    const d = "M0 0 C " + f(-w) + " " + f(-h * 0.1) + " " + f(-w * 0.96) + " " + f(-h * 0.66) + " 0 " + f(-h) +
      " C " + f(w * 0.96) + " " + f(-h * 0.66) + " " + f(w) + " " + f(-h * 0.1) + " 0 0 Z";
    return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(ang) + ')">' +
      '<path d="' + d + '" fill="' + INK.flower + '" stroke="' + INK.line + '" stroke-width="1.4" stroke-linejoin="round"/>' +
      '<path d="M ' + f(-w * 0.92) + ' ' + f(-h * 0.06) + ' C ' + f(-w * 0.45) + ' ' + f(-h * 0.3) + ' ' + f(w * 0.45) + ' ' + f(-h * 0.3) +
      ' ' + f(w * 0.92) + ' ' + f(-h * 0.06) + '" fill="none" stroke="' + INK.line + '" stroke-width="1.1"/>' +
      '<path d="M ' + f(-w * 0.5) + ' ' + f(0) + ' L ' + f(-w * 0.95) + ' ' + f(h * 0.3) + '" stroke="' + INK.leaf + '" stroke-width="1.1" stroke-linecap="round"/>' +
      '<path d="M ' + f(w * 0.5) + ' ' + f(0) + ' L ' + f(w * 0.95) + ' ' + f(h * 0.3) + '" stroke="' + INK.leaf + '" stroke-width="1.1" stroke-linecap="round"/>' +
      "</g>";
  }

  function stem(d, w) {
    return '<path d="' + d + '" fill="none" stroke="' + INK.leaf + '" stroke-width="' + w +
      '" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  // ---------------- 构图 ----------------

  function build(bouquet, rnd) {
    const P = TYPE_PARAMS[bouquet.type] || TYPE_PARAMS.rose;

    // 主枝：底部中点向上，略呈 S 形
    const bx = 232, by = 592;
    const tx = 244, ty = 100;

    let stems = "";
    stems += stem("M " + bx + " " + by +
      " C " + (bx - 10) + " " + (by - 130) + " " + (bx + 16) + " " + (by - 250) + " " + (bx + 2) + " " + (by - 350) +
      " C " + (bx - 8) + " " + (by - 430) + " " + (tx + 8) + " " + (by - 470) + " " + tx + " " + ty, 5);

    // 侧枝
    const br = [
      "M " + (bx + 2) + " " + (by - 262) + " C " + (bx - 62) + " " + (by - 312) + " " + (bx - 94) + " " + (by - 352) + " " + (bx - 100) + " " + (by - 404),
      "M " + (bx - 4) + " " + (by - 366) + " C " + (bx + 58) + " " + (by - 408) + " " + (bx + 90) + " " + (by - 438) + " " + (bx + 100) + " " + (by - 486),
      "M " + (bx + 4) + " " + (by - 424) + " C " + (bx - 46) + " " + (by - 462) + " " + (bx - 72) + " " + (by - 492) + " " + (bx - 76) + " " + (by - 534),
    ];
    br.forEach(function (d) { stems += stem(d, 3.4); });

    // 叶片
    const leafSpecs = [
      [bx - 14, by - 150, 108, 29, -126],
      [bx + 20, by - 112, 96, 26, -54],
      [bx - 74, by - 344, 98, 26, -142],
      [bx + 76, by - 424, 94, 25, -38],
      [bx - 62, by - 486, 86, 23, -156],
      [bx + 30, by - 274, 80, 22, -64],
      [bx - 40, by - 250, 74, 20, -116],
    ];
    let leaves = leafSpecs.map(function (s) {
      return leaf(s[0], s[1], s[2], s[3], s[4]);
    }).join("");

    // 花头
    let flowers = "";
    const rBase = 50 * P.size;

    if (P.cluster) {
      // 簇生：在主枝顶端聚成半圆花球
      const n = P.count;
      const cx0 = tx;
      const cy0 = ty + 146;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const ang = Math.PI * (1.02 - t * 1.04);
        const ring = 0.5 + 0.5 * Math.sin(t * Math.PI);
        const rad = (38 + rnd() * 22) * (0.72 + ring * 0.38);
        const fxp = cx0 + Math.cos(ang) * rad;
        const fyp = cy0 - Math.sin(ang) * rad * 1.12 + rnd() * 10;
        flowers += bloom(fxp, fyp, rBase * (0.82 + rnd() * 0.36), P, rnd() * 360);
      }
    } else {
      const spots = [
        [tx - 4, ty + 74, 1.0],
        [bx - 100, by - 404, 0.84],
        [bx + 100, by - 486, 0.88],
        [bx - 76, by - 534, 0.66],
        [bx + 2, by - 330, 0.52],
      ];
      const n = Math.max(2, P.count);
      for (let i = 0; i < Math.min(n, spots.length); i++) {
        const s = spots[i];
        flowers += bloom(s[0], s[1], rBase * s[2], P, (rnd() - 0.5) * 34);
      }
    }

    // 花苞（点缀枝梢）
    const budSpecs = [
      [bx - 104, by - 412, 30, 12, 150],
      [bx + 104, by - 496, 28, 11, 26],
      [bx - 78, by - 546, 24, 10, 172],
      [tx + 46, ty + 34, 26, 10, 40],
    ];
    let buds = budSpecs.map(function (s) {
      return bud(s[0], s[1], s[2], s[3], s[4]);
    }).join("");

    return (
      '<svg viewBox="0 0 470 640" xmlns="http://www.w3.org/2000/svg" class="bouquet-svg">' +
      '<g class="stems">' + stems + "</g>" +
      '<g class="leaves">' + leaves + "</g>" +
      '<g class="buds">' + buds + "</g>" +
      '<g class="flowers">' + flowers + "</g>" +
      "</svg>"
    );
  }

  window.FLOWERS = { build: build, INK: INK, TYPE_PARAMS: TYPE_PARAMS };
})();
