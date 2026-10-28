// ============================================================
// 复古植物学图谱 · 墨线花卉绘制引擎
// 风格：陈年米白纸上的一株植物标本插画
//   · 单根主茎，细枝三两，留白通透
//   · 白色薄瓣花朵，细墨线勾边
//   · 细长花苞成簇生于枝梢
//   · 实心墨绿叶片 + 纸色叶脉
// 对外接口：window.FLOWERS.build(bouquet, seededRandom)
// ============================================================
(function () {
  "use strict";

  // 墨色调（整体偏淡的墨绿）
  var INK = {
    line: "#5C6850",    // 勾线墨绿
    leaf: "#6C7A62",    // 叶片实心绿
    leafD: "#5E6C55",   // 花萼 / 花茎深一档
    vein: "#F8F4E8",    // 叶脉（纸色）
    flower: "#FDFBF3",  // 花瓣奶白
    stamen: "#7E8B70"   // 花蕊
  };

  function n(v) { return Math.round(v * 10) / 10; }
  function p2(p) { return n(p[0]) + " " + n(p[1]); }

  // ---------------- 曲线与茎 ----------------

  // 三次贝塞尔采样
  function sample(seg, steps) {
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

  // 由粗到细的实体茎（沿曲线生成左右两条偏移线）
  function ribbon(seg, w0, w1, fill) {
    var pts = sample(seg, 18), L = [], R = [], i;
    for (i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var m = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / m, ny = dx / m;
      var w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    var d = "M" + p2(L[0]);
    for (i = 1; i < L.length; i++) d += " L" + p2(L[i]);
    for (i = R.length - 1; i >= 0; i--) d += " L" + p2(R[i]);
    d += " Z";
    return '<path d="' + d + '" fill="' + (fill || INK.leafD) + '" stroke="' + INK.line +
      '" stroke-width="0.8" stroke-linejoin="round"/>';
  }

  // ---------------- 花瓣 ----------------

  function petalPath(len, wid, shape) {
    if (shape === "pointed") {
      return "M0 0 C " + n(-wid) + " " + n(-len * 0.30) + " " + n(-wid * 0.62) + " " + n(-len * 0.74) + " 0 " + n(-len) +
        " C " + n(wid * 0.62) + " " + n(-len * 0.74) + " " + n(wid) + " " + n(-len * 0.30) + " 0 0 Z";
    }
    if (shape === "spoon") {
      return "M0 0 C " + n(-wid * 0.55) + " " + n(-len * 0.30) + " " + n(-wid * 0.92) + " " + n(-len * 0.62) + " " + n(-wid * 0.86) + " " + n(-len * 0.82) +
        " C " + n(-wid * 0.76) + " " + n(-len * 0.99) + " " + n(-wid * 0.30) + " " + n(-len * 1.02) + " 0 " + n(-len) +
        " C " + n(wid * 0.30) + " " + n(-len * 1.02) + " " + n(wid * 0.76) + " " + n(-len * 0.99) + " " + n(wid * 0.86) + " " + n(-len * 0.82) +
        " C " + n(wid * 0.92) + " " + n(-len * 0.62) + " " + n(wid * 0.55) + " " + n(-len * 0.30) + " 0 0 Z";
    }
    if (shape === "narrow") {
      return "M0 0 C " + n(-wid * 0.60) + " " + n(-len * 0.34) + " " + n(-wid * 0.46) + " " + n(-len * 0.78) + " 0 " + n(-len) +
        " C " + n(wid * 0.46) + " " + n(-len * 0.78) + " " + n(wid * 0.60) + " " + n(-len * 0.34) + " 0 0 Z";
    }
    if (shape === "round") {
      return "M0 0 C " + n(-wid * 1.06) + " " + n(-len * 0.20) + " " + n(-wid * 1.0) + " " + n(-len * 0.74) + " " + n(-wid * 0.54) + " " + n(-len * 0.94) +
        " C " + n(-wid * 0.28) + " " + n(-len * 1.02) + " " + n(wid * 0.28) + " " + n(-len * 1.02) + " " + n(wid * 0.54) + " " + n(-len * 0.94) +
        " C " + n(wid * 1.0) + " " + n(-len * 0.74) + " " + n(wid * 1.06) + " " + n(-len * 0.20) + " 0 0 Z";
    }
    if (shape === "ruffle") {
      return "M0 0 C " + n(-wid) + " " + n(-len * 0.22) + " " + n(-wid * 1.04) + " " + n(-len * 0.52) + " " + n(-wid * 0.72) + " " + n(-len * 0.72) +
        " C " + n(-wid * 0.52) + " " + n(-len * 0.86) + " " + n(-wid * 0.30) + " " + n(-len * 0.84) + " " + n(-wid * 0.16) + " " + n(-len * 0.98) +
        " C " + n(-wid * 0.06) + " " + n(-len * 1.0) + " " + n(wid * 0.06) + " " + n(-len * 1.0) + " " + n(wid * 0.16) + " " + n(-len * 0.98) +
        " C " + n(wid * 0.30) + " " + n(-len * 0.84) + " " + n(wid * 0.52) + " " + n(-len * 0.86) + " " + n(wid * 0.72) + " " + n(-len * 0.72) +
        " C " + n(wid * 1.04) + " " + n(-len * 0.52) + " " + n(wid) + " " + n(-len * 0.22) + " 0 0 Z";
    }
    if (shape === "cup") {
      return "M0 0 C " + n(-wid * 1.1) + " " + n(-len * 0.30) + " " + n(-wid * 1.15) + " " + n(-len * 0.78) + " " + n(-wid * 0.62) + " " + n(-len * 0.94) +
        " C " + n(-wid * 0.36) + " " + n(-len * 1.02) + " " + n(-wid * 0.16) + " " + n(-len * 0.90) + " 0 " + n(-len * 1.0) +
        " C " + n(wid * 0.16) + " " + n(-len * 0.90) + " " + n(wid * 0.36) + " " + n(-len * 1.02) + " " + n(wid * 0.62) + " " + n(-len * 0.94) +
        " C " + n(wid * 1.15) + " " + n(-len * 0.78) + " " + n(wid * 1.1) + " " + n(-len * 0.30) + " 0 0 Z";
    }
    // 默认：卵形薄瓣（参考图茉莉花）
    return "M0 0 C " + n(-wid) + " " + n(-len * 0.18) + " " + n(-wid * 0.96) + " " + n(-len * 0.64) + " " + n(-wid * 0.44) + " " + n(-len * 0.88) +
      " C " + n(-wid * 0.18) + " " + n(-len * 1.0) + " " + n(wid * 0.18) + " " + n(-len * 1.0) + " " + n(wid * 0.44) + " " + n(-len * 0.88) +
      " C " + n(wid * 0.96) + " " + n(-len * 0.64) + " " + n(wid) + " " + n(-len * 0.18) + " 0 0 Z";
  }

  function petal(len, wid, ang, shape, crease) {
    var d = petalPath(len, wid, shape);
    var o = '<g transform="rotate(' + n(ang) + ')">' +
      '<path d="' + d + '" fill="' + INK.flower + '" stroke="' + INK.line +
      '" stroke-width="1.35" stroke-linejoin="round"/>';
    if (crease !== false) {
      o += '<path d="M0 ' + n(-len * 0.08) + ' L0 ' + n(-len * 0.74) + '" stroke="' + INK.line +
        '" stroke-width="0.6" opacity="0.26" stroke-linecap="round"/>';
    }
    o += "</g>";
    return o;
  }

  // ---------------- 花心 ----------------

  function center(r, P) {
    var k = P.center || "dots", o = "", i, a, rr;
    if (k === "none") return "";
    if (k === "disc" || k === "seed") {
      o += '<circle r="' + n(r * (k === "seed" ? 0.30 : 0.24)) + '" fill="' + INK.leafD +
        '" stroke="' + INK.line + '" stroke-width="0.9"/>';
      var cnt = k === "seed" ? 16 : 9;
      for (i = 0; i < cnt; i++) {
        a = (i * (360 / cnt) + 12) * Math.PI / 180;
        rr = r * (i % 2 ? 0.11 : 0.20);
        o += '<circle cx="' + n(Math.cos(a) * rr) + '" cy="' + n(Math.sin(a) * rr) +
          '" r="1.4" fill="' + INK.vein + '" opacity="0.85"/>';
      }
      return o;
    }
    if (k === "stamen") {
      for (i = 0; i < 11; i++) {
        a = (i * 33 + 9) * Math.PI / 180;
        var x2 = Math.cos(a) * r * 0.40, y2 = Math.sin(a) * r * 0.40;
        o += '<path d="M' + n(Math.cos(a) * r * 0.08) + ' ' + n(Math.sin(a) * r * 0.08) +
          ' L' + n(x2) + ' ' + n(y2) + '" stroke="' + INK.stamen + '" stroke-width="0.95"/>';
        o += '<circle cx="' + n(x2) + '" cy="' + n(y2) + '" r="1.6" fill="' + INK.stamen + '"/>';
      }
      o += '<circle r="' + n(r * 0.10) + '" fill="' + INK.flower + '" stroke="' + INK.line + '" stroke-width="0.85"/>';
      return o;
    }
    if (k === "dotOnly") {
      return '<circle r="' + n(r * 0.16) + '" fill="' + INK.flower + '" stroke="' + INK.line + '" stroke-width="1"/>';
    }
    // dots：细碎花蕊簇（茉莉/栀子）
    o += '<circle r="' + n(r * 0.14) + '" fill="' + INK.flower + '" stroke="' + INK.line + '" stroke-width="0.85"/>';
    for (i = 0; i < 7; i++) {
      a = (i * 51.4 + 14) * Math.PI / 180;
      rr = r * (i % 2 ? 0.15 : 0.21);
      o += '<circle cx="' + n(Math.cos(a) * rr) + '" cy="' + n(Math.sin(a) * rr) + '" r="1.45" fill="' + INK.stamen + '"/>';
    }
    return o;
  }

  // ---------------- 花头 ----------------

  function blossom(r, P, rot) {
    var o = "", petals = P.petals, layers = P.layers || 1, L, i;
    for (L = layers - 1; L >= 0; L--) {
      var len = r * (1 - L * 0.24);
      var wid = len * P.petalW;
      var off = rot + L * (360 / petals) * 0.5;
      for (i = 0; i < petals; i++) {
        o += petal(len, wid, off + i * (360 / petals), P.shape);
      }
    }
    o += center(r, P);
    return o;
  }

  // 绣球：圆顶花球，小花四瓣，均匀铺满
  function domeCluster(r, P, rot, rnd) {
    var o = "", ring, i, cnt;
    var places = [[0, 0]];
    for (ring = 0; ring < 2; ring++) {
      cnt = ring === 0 ? 6 : 7;
      for (i = 0; i < cnt; i++) {
        var a = rot + i * (360 / cnt) + ring * 26;
        var rad = r * (ring === 0 ? 0.44 : 0.76);
        places.push([Math.cos(a * Math.PI / 180) * rad, Math.sin(a * Math.PI / 180) * rad * 0.9]);
      }
    }
    for (i = 0; i < places.length; i++) {
      var fr = r * (i === 0 ? 0.34 : 0.30);
      o += '<g transform="translate(' + n(places[i][0]) + ' ' + n(places[i][1]) + ')">' +
        blossom(fr, { petals: 4, petalW: 0.50, shape: "round", center: "dotOnly" }, rot + i * 37) + "</g>";
    }
    return o;
  }

  // 满天星：细枝散落的小花
  function spray(r, P, rot, rnd) {
    var o = "", i, k, tt;
    for (k = 0; k < 3; k++) {
      var a = rot + (k - 1) * 42 + (rnd() - 0.5) * 16;
      var lx = Math.cos(a * Math.PI / 180) * r * 0.92;
      var ly = Math.sin(a * Math.PI / 180) * r * 0.92;
      o += '<path d="M0 0 Q ' + n(lx * 0.55) + ' ' + n(ly * 0.55 - 8) + ' ' + n(lx) + ' ' + n(ly) +
        '" fill="none" stroke="' + INK.leafD + '" stroke-width="1.2" stroke-linecap="round"/>';
      for (i = 0; i < 4; i++) {
        tt = 0.34 + i * 0.22;
        var px = lx * tt + (rnd() - 0.5) * r * 0.34;
        var py = ly * tt + (rnd() - 0.5) * r * 0.34 - i * r * 0.03;
        o += '<g transform="translate(' + n(px) + ' ' + n(py) + ')">' +
          blossom(r * 0.30, { petals: 5, petalW: 0.42, shape: "pointed", center: "disc" }, rnd() * 360) + "</g>";
      }
    }
    return o;
  }

  // 铃兰：垂挂小铃
  function bellRaceme(r, P, rot, rnd) {
    var o = "", i, n1 = 4;
    var ax = r * 0.42, ay = r * 0.62;
    o += '<path d="M0 0 C ' + n(r * 0.10) + ' ' + n(-r * 0.22) + ' ' + n(r * 0.40) + ' ' + n(-r * 0.06) + ' ' + n(ax) + ' ' + n(ay) +
      '" fill="none" stroke="' + INK.leafD + '" stroke-width="1.8" stroke-linecap="round"/>';
    for (i = 0; i < n1; i++) {
      var t = i / (n1 - 1);
      var bx = ax * (0.55 + t * 0.95);
      var by = ay * (0.55 + t * 0.85) + Math.sin(t * 3.0) * r * 0.10;
      var rr = r * 0.40 * (1 - t * 0.14);
      // 花梗
      o += '<path d="M' + n(bx) + ' ' + n(by - rr * 1.5) + ' L' + n(bx) + ' ' + n(by - rr * 0.62) +
        '" stroke="' + INK.leafD + '" stroke-width="1.1" stroke-linecap="round"/>';
      // 铃身
      o += '<path d="M' + n(bx - rr * 0.52) + ' ' + n(by - rr * 0.60) +
        ' C ' + n(bx - rr * 1.06) + ' ' + n(by + rr * 0.34) + ' ' + n(bx - rr * 0.92) + ' ' + n(by + rr * 1.02) + ' ' + n(bx) + ' ' + n(by + rr * 1.08) +
        ' C ' + n(bx + rr * 0.92) + ' ' + n(by + rr * 1.02) + ' ' + n(bx + rr * 1.06) + ' ' + n(by + rr * 0.34) + ' ' + n(bx + rr * 0.52) + ' ' + n(by - rr * 0.60) +
        ' Q ' + n(bx) + ' ' + n(by - rr * 0.14) + ' ' + n(bx - rr * 0.52) + ' ' + n(by - rr * 0.60) + ' Z"' +
        ' fill="' + INK.flower + '" stroke="' + INK.line + '" stroke-width="1.3" stroke-linejoin="round"/>';
      // 铃口
      o += '<path d="M' + n(bx - rr * 0.84) + ' ' + n(by + rr * 0.86) + ' Q ' + n(bx) + ' ' + n(by + rr * 1.24) + ' ' + n(bx + rr * 0.84) + ' ' + n(by + rr * 0.86) + '"' +
        ' fill="none" stroke="' + INK.line + '" stroke-width="0.95" opacity="0.75"/>';
    }
    return o;
  }

  function head(kind, r, P, rnd) {
    if (kind === "dome") return domeCluster(r, P, rnd() * 360, rnd);
    if (kind === "spray") return spray(r, P, rnd() * 360, rnd);
    if (kind === "bell") return bellRaceme(r, P, rnd() * 360, rnd);
    return blossom(r, P, rnd() * 360);
  }

  // ---------------- 花苞 ----------------

  function bud(x, y, len, wid, ang) {
    var d = "M0 0 C " + n(-wid * 0.5) + " " + n(-len * 0.10) + " " + n(-wid) + " " + n(-len * 0.44) + " " + n(-wid * 0.64) + " " + n(-len * 0.76) +
      " C " + n(-wid * 0.40) + " " + n(-len * 0.94) + " " + n(wid * 0.40) + " " + n(-len * 0.94) + " " + n(wid * 0.64) + " " + n(-len * 0.76) +
      " C " + n(wid) + " " + n(-len * 0.44) + " " + n(wid * 0.5) + " " + n(-len * 0.10) + " 0 0 Z";
    var o = '<g transform="translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(ang) + ')">';
    o += '<path d="M0 ' + n(len * 0.30) + ' L0 ' + n(-len * 0.04) + '" stroke="' + INK.leafD + '" stroke-width="1.1" stroke-linecap="round"/>';
    o += '<path d="' + d + '" fill="' + INK.flower + '" stroke="' + INK.line + '" stroke-width="1.3" stroke-linejoin="round"/>';
    o += '<path d="M0 ' + n(-len * 0.02) + ' L0 ' + n(-len * 0.86) + '" stroke="' + INK.line + '" stroke-width="0.6" opacity="0.28"/>';
    o += '<path d="M' + n(-wid * 0.46) + ' ' + n(-len * 0.02) + ' L' + n(-wid * 0.78) + ' ' + n(len * 0.26) +
      '" stroke="' + INK.leafD + '" stroke-width="1.15" stroke-linecap="round"/>';
    o += '<path d="M' + n(wid * 0.46) + ' ' + n(-len * 0.02) + ' L' + n(wid * 0.78) + ' ' + n(len * 0.26) +
      '" stroke="' + INK.leafD + '" stroke-width="1.15" stroke-linecap="round"/>';
    o += "</g>";
    return o;
  }

  // 一簇花苞：沿垂直于朝向的方向并排
  function budGroup(x, y, size, ang, count, rnd) {
    var o = "", rad = ang * Math.PI / 180, i;
    for (i = 0; i < count; i++) {
      var s = i - (count - 1) / 2;
      var px = x + Math.cos(rad + Math.PI / 2) * s * size * 0.30;
      var py = y + Math.sin(rad + Math.PI / 2) * s * size * 0.30 + Math.abs(s) * size * 0.10;
      var l = size * (1 - Math.abs(s) * 0.13) * (0.88 + rnd() * 0.26);
      o += bud(px, py, l, l * 0.31, ang + s * 15 + (rnd() - 0.5) * 10);
    }
    return o;
  }

  // ---------------- 叶片 ----------------

  function leaf(x, y, len, wid, ang) {
    var d = "M0 0 C " + n(-wid) + " " + n(-len * 0.26) + " " + n(-wid * 0.84) + " " + n(-len * 0.64) + " 0 " + n(-len) +
      " C " + n(wid * 0.84) + " " + n(-len * 0.64) + " " + n(wid) + " " + n(-len * 0.26) + " 0 0 Z";
    var o = '<g transform="translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(ang) + ')">';
    o += '<path d="' + d + '" fill="' + INK.leaf + '" stroke="' + INK.line + '" stroke-width="1.1" stroke-linejoin="round"/>';
    o += '<path d="M0 ' + n(-len * 0.04) + ' L0 ' + n(-len * 0.88) + '" stroke="' + INK.vein + '" stroke-width="1.1" opacity="0.7"/>';
    var t;
    for (t = 0.28; t < 0.78; t += 0.18) {
      var sw = wid * 0.52 * (1 - t * 0.55);
      o += '<path d="M0 ' + n(-len * t) + ' Q ' + n(-sw * 0.7) + ' ' + n(-len * (t + 0.10)) + ' ' + n(-sw) + ' ' + n(-len * (t + 0.14)) +
        '" fill="none" stroke="' + INK.vein + '" stroke-width="0.85" opacity="0.55"/>';
      o += '<path d="M0 ' + n(-len * t) + ' Q ' + n(sw * 0.7) + ' ' + n(-len * (t + 0.10)) + ' ' + n(sw) + ' ' + n(-len * (t + 0.14)) +
        '" fill="none" stroke="' + INK.vein + '" stroke-width="0.85" opacity="0.55"/>';
    }
    o += "</g>";
    return o;
  }

  // ---------------- 各花型参数 ----------------

  // kind: simple | dome | spray | bell
  var TYPE = {
    rose:      { kind: "simple", petals: 7, layers: 3, petalW: 0.46, shape: "round",   center: "swirlDots", scale: 1.00 },
    tulip:     { kind: "simple", petals: 3, layers: 1, petalW: 0.40, shape: "cup",     center: "none",      scale: 1.04 },
    daisy:     { kind: "simple", petals: 15, layers: 1, petalW: 0.19, shape: "spoon",  center: "disc",      scale: 0.92 },
    sunflower: { kind: "simple", petals: 15, layers: 2, petalW: 0.24, shape: "pointed", center: "seed",     scale: 1.00 },
    hydrangea: { kind: "dome",   petals: 4, layers: 1, petalW: 0.46, shape: "round",    center: "disc",      scale: 1.05 },
    bell:      { kind: "bell",   petals: 5, layers: 1, petalW: 0.40, shape: "cup",      center: "none",      scale: 1.00 },
    starry:    { kind: "spray",  petals: 5, layers: 1, petalW: 0.40, shape: "pointed",  center: "disc",      scale: 1.10 },
    camellia:  { kind: "simple", petals: 6, layers: 2, petalW: 0.48, shape: "round",    center: "stamen",    scale: 0.98 },
    peony:     { kind: "simple", petals: 9, layers: 3, petalW: 0.52, shape: "ruffle",   center: "stamen",    scale: 1.02 },
    gardenia:  { kind: "simple", petals: 6, layers: 2, petalW: 0.46, shape: "oval",     center: "dots",      scale: 1.00 }
  };

  // ---------------- 构图 ----------------

  // 主茎（下粗上细，自底部微微摆动向上）
  var MAIN = [
    [[240, 632], [222, 548], [228, 468], [238, 396]],
    [[238, 396], [246, 328], [244, 220], [250, 126]]
  ];

  // 侧枝
  var BRANCH = [
    [[240, 330], [202, 308], [178, 270], [168, 212]],   // 左上 → 花苞
    [[238, 406], [300, 400], [350, 380], [384, 346]]    // 右下 → 花苞
  ];

  // 花梗：[茎上起点…, 花心落点]
  var PEDICEL = [
    [[248, 282], [268, 278], [288, 282], [302, 286]],
    [[246, 330], [290, 326], [330, 326], [356, 326]],
    [[244, 380], [280, 378], [316, 380], [334, 382]],
    [[250, 210], [258, 214], [268, 218], [274, 222]]
  ];

  // 花头 [x, y, 半径]
  var HEADS = [
    [300, 278, 40],
    [360, 322, 34],
    [334, 388, 29],
    [264, 210, 26]
  ];

  // 花苞簇 [x, y, 尺寸, 朝向, 数量]（角度：正=向右倾斜）
  var BUDS = [
    [250, 124, 42, 2, 4],
    [168, 212, 38, -34, 4],
    [384, 346, 32, 46, 2]
  ];

  // 叶片 [x, y, 长, 宽, 角度]（角度：正=向右倾，负=向左倾）
  var LEAVES = [
    [248, 610, 110, 23, 58],
    [240, 556, 96, 21, -50],
    [246, 498, 88, 20, 64],
    [238, 442, 78, 18, -56],
    [332, 370, 64, 16, -16],
    [246, 394, 60, 16, 54]
  ];

  function build(bouquet, rnd) {
    rnd = rnd || Math.random;
    var P = TYPE[bouquet && bouquet.type] || TYPE.rose;
    var i;
    // 铃兰/绣球体量大，只留前三处落点，留白更透气
    var take = P.kind === "bell" || P.kind === "dome" ? 3 : 4;
    take = Math.min(take, HEADS.length, PEDICEL.length);

    // 茎
    var stems = ribbon(MAIN[0], 7.8, 4.8);
    stems += ribbon(MAIN[1], 4.8, 2.2);
    for (i = 0; i < BRANCH.length; i++) {
      stems += ribbon(BRANCH[i], 3.4, 1.2);
    }
    // 花梗（只画有花头的）
    for (i = 0; i < take; i++) {
      stems += ribbon(PEDICEL[i], 2.6, 1.4);
    }

    // 叶
    var leaves = "";
    for (i = 0; i < LEAVES.length; i++) {
      var L = LEAVES[i];
      leaves += leaf(
        L[0] + (rnd() - 0.5) * 4,
        L[1] + (rnd() - 0.5) * 4,
        L[2] * (0.94 + rnd() * 0.12),
        L[3] * (0.92 + rnd() * 0.16),
        L[4] + (rnd() - 0.5) * 7
      );
    }

    // 花苞
    var buds = "";
    for (i = 0; i < BUDS.length; i++) {
      var B = BUDS[i];
      buds += budGroup(B[0], B[1], B[2] * (0.94 + rnd() * 0.12), B[3] + (rnd() - 0.5) * 8, B[4], rnd);
    }

    // 花头
    var flowers = "";
    for (i = 0; i < take; i++) {
      var h = HEADS[i];
      var r = h[2] * P.scale * (0.95 + rnd() * 0.12);
      flowers += '<g class="bloom"><g transform="translate(' +
        n(h[0] + (rnd() - 0.5) * 5) + ' ' + n(h[1] + (rnd() - 0.5) * 5) + ')">' +
        head(P.kind, r, P, rnd) + "</g></g>";
    }

    return (
      '<svg viewBox="89 70 400 580" xmlns="http://www.w3.org/2000/svg" class="bouquet-svg" preserveAspectRatio="xMidYMid meet">' +
      '<g class="stems">' + stems + "</g>" +
      '<g class="leaves">' + leaves + "</g>" +
      '<g class="buds">' + buds + "</g>" +
      '<g class="flowers">' + flowers + "</g>" +
      "</svg>"
    );
  }

  window.FLOWERS = { build: build, INK: INK, TYPE: TYPE };
})();
