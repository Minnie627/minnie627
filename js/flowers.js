// ============================================================
// 水彩花卉绘制引擎
// 质感要点（对照参考图）：
//   1. feTurbulence + feDisplacementMap 让每块色面边缘不规则 —— 湿画法的自然扩散
//   2. 同色多次薄涂叠加（半透明），重叠处自然加深 —— 颜料沉积
//   3. 色块边缘一道深色水线（颜料向边缘聚集），内部留白 —— 花瓣透光
//   4. 整幅覆盖极淡纸纹颗粒 —— 水彩纸肌理
//   5. 背景为大片淡绿晕染 + 飞溅点
// 对外接口：window.FLOWERS.build(bouquet, seededRandom)
// ============================================================
(function () {
  "use strict";

  // 取色自参考图
  var WC = {
    petalLight: "#FFFDFC",
    petalMid: "#F9CBD8",
    petalDeep: "#EF9BB2",
    petalEdge: "#DC7A96",
    center: "#FCF6DE",
    anther: "#DFC468",
    pistil: "#8FB063",
    stem: "#A9C383",
    stemDeep: "#7E9E58",
    leafLight: "#C6DBA0",
    leafMid: "#A3C077",
    leafDeep: "#7FA35C",
    wash: "#CFE0B5"
  };

  var uidSeq = 0;
  function n(v) { return Math.round(v * 10) / 10; }

  // ---------------- 造型 ----------------

  function petalPath(len, wid, shape) {
    if (shape === "cup") {
      return "M0 0 C " + n(-wid * 1.05) + " " + n(-len * 0.26) + " " + n(-wid * 1.02) + " " + n(-len * 0.74) + " " + n(-wid * 0.52) + " " + n(-len * 0.94) +
        " C " + n(-wid * 0.26) + " " + n(-len * 1.04) + " " + n(wid * 0.26) + " " + n(-len * 1.04) + " " + n(wid * 0.52) + " " + n(-len * 0.94) +
        " C " + n(wid * 1.02) + " " + n(-len * 0.74) + " " + n(wid * 1.05) + " " + n(-len * 0.26) + " 0 0 Z";
    }
    if (shape === "narrow") {
      return "M0 0 C " + n(-wid * 0.62) + " " + n(-len * 0.34) + " " + n(-wid * 0.50) + " " + n(-len * 0.76) + " 0 " + n(-len) +
        " C " + n(wid * 0.50) + " " + n(-len * 0.76) + " " + n(wid * 0.62) + " " + n(-len * 0.34) + " 0 0 Z";
    }
    if (shape === "round") {
      return "M0 0 C " + n(-wid * 1.02) + " " + n(-len * 0.18) + " " + n(-wid * 1.0) + " " + n(-len * 0.70) + " " + n(-wid * 0.58) + " " + n(-len * 0.93) +
        " C " + n(-wid * 0.30) + " " + n(-len * 1.04) + " " + n(wid * 0.30) + " " + n(-len * 1.04) + " " + n(wid * 0.58) + " " + n(-len * 0.93) +
        " C " + n(wid * 1.0) + " " + n(-len * 0.70) + " " + n(wid * 1.02) + " " + n(-len * 0.18) + " 0 0 Z";
    }
    if (shape === "ruffle") {
      return "M0 0 C " + n(-wid) + " " + n(-len * 0.22) + " " + n(-wid * 1.05) + " " + n(-len * 0.52) + " " + n(-wid * 0.74) + " " + n(-len * 0.74) +
        " C " + n(-wid * 0.56) + " " + n(-len * 0.88) + " " + n(-wid * 0.34) + " " + n(-len * 0.84) + " " + n(-wid * 0.18) + " " + n(-len * 0.99) +
        " C " + n(-wid * 0.06) + " " + n(-len * 1.02) + " " + n(wid * 0.06) + " " + n(-len * 1.02) + " " + n(wid * 0.18) + " " + n(-len * 0.99) +
        " C " + n(wid * 0.34) + " " + n(-len * 0.84) + " " + n(wid * 0.56) + " " + n(-len * 0.88) + " " + n(wid * 0.74) + " " + n(-len * 0.74) +
        " C " + n(wid * 1.05) + " " + n(-len * 0.52) + " " + n(wid) + " " + n(-len * 0.22) + " 0 0 Z";
    }
    // 参考图主花瓣：阔卵形，顶端微凹的两瓣扇
    return "M0 0 C " + n(-wid * 1.04) + " " + n(-len * 0.14) + " " + n(-wid * 1.10) + " " + n(-len * 0.64) + " " + n(-wid * 0.60) + " " + n(-len * 0.90) +
      " C " + n(-wid * 0.32) + " " + n(-len * 1.05) + " " + n(-wid * 0.13) + " " + n(-len * 0.96) + " 0 " + n(-len * 0.97) +
      " C " + n(wid * 0.13) + " " + n(-len * 0.96) + " " + n(wid * 0.32) + " " + n(-len * 1.05) + " " + n(wid * 0.60) + " " + n(-len * 0.90) +
      " C " + n(wid * 1.10) + " " + n(-len * 0.64) + " " + n(wid * 1.04) + " " + n(-len * 0.14) + " 0 0 Z";
  }

  function leafPath(len, wid) {
    return "M0 0 C " + n(-wid * 0.86) + " " + n(-len * 0.24) + " " + n(-wid * 0.94) + " " + n(-len * 0.58) + " " + n(-wid * 0.28) + " " + n(-len * 0.86) +
      " C " + n(-wid * 0.14) + " " + n(-len * 0.96) + " " + n(-wid * 0.06) + " " + n(-len * 0.99) + " 0 " + n(-len) +
      " C " + n(wid * 0.06) + " " + n(-len * 0.99) + " " + n(wid * 0.14) + " " + n(-len * 0.96) + " " + n(wid * 0.28) + " " + n(-len * 0.86) +
      " C " + n(wid * 0.94) + " " + n(-len * 0.58) + " " + n(wid * 0.86) + " " + n(-len * 0.24) + " 0 0 Z";
  }

  // 不规则水渍形体
  function blobPath(cx, cy, rx, ry, seed) {
    var pts = [], i, a, rr, d;
    for (i = 0; i < 12; i++) {
      a = (i / 12) * Math.PI * 2;
      rr = 0.74 + 0.26 * Math.sin(i * 2.7 + seed) + 0.08 * Math.cos(i * 4.1 + seed * 2);
      pts.push([cx + Math.cos(a) * rx * rr, cy + Math.sin(a) * ry * rr]);
    }
    d = "M" + n(pts[0][0]) + " " + n(pts[0][1]);
    for (i = 1; i <= pts.length; i++) {
      var q = pts[i - 1], p = pts[i % pts.length];
      d += " Q" + n(q[0]) + " " + n(q[1]) + " " + n((p[0] + q[0]) / 2) + " " + n((p[1] + q[1]) / 2);
    }
    return d + " Z";
  }

  // ---------------- SVG 资源 ----------------

  function defs(id) {
    return "<defs>" +
      '<radialGradient id="' + id + 'gPetal" cx="50%" cy="100%" r="92%">' +
        '<stop offset="0%" stop-color="' + WC.petalLight + '"/>' +
        '<stop offset="38%" stop-color="' + WC.petalMid + '"/>' +
        '<stop offset="86%" stop-color="' + WC.petalDeep + '"/>' +
        '<stop offset="100%" stop-color="' + WC.petalEdge + '"/>' +
      "</radialGradient>" +
      '<radialGradient id="' + id + 'gBud" cx="50%" cy="88%" r="84%">' +
        '<stop offset="0%" stop-color="' + WC.leafMid + '"/>' +
        '<stop offset="40%" stop-color="' + WC.petalMid + '"/>' +
        '<stop offset="100%" stop-color="' + WC.petalDeep + '"/>' +
      "</radialGradient>" +
      '<linearGradient id="' + id + 'gLeaf" x1="0" y1="1" x2="0.25" y2="0">' +
        '<stop offset="0%" stop-color="' + WC.leafDeep + '"/>' +
        '<stop offset="46%" stop-color="' + WC.leafMid + '"/>' +
        '<stop offset="100%" stop-color="' + WC.leafLight + '"/>' +
      "</linearGradient>" +
      '<radialGradient id="' + id + 'gLeafDeep">' +
        '<stop offset="0%" stop-color="' + WC.leafDeep + '" stop-opacity="0.42"/>' +
        '<stop offset="100%" stop-color="' + WC.leafDeep + '" stop-opacity="0"/>' +
      "</radialGradient>" +
      '<linearGradient id="' + id + 'gStem" x1="0" y1="1" x2="0" y2="0">' +
        '<stop offset="0%" stop-color="' + WC.stemDeep + '"/>' +
        '<stop offset="55%" stop-color="' + WC.stem + '"/>' +
        '<stop offset="100%" stop-color="' + WC.leafMid + '"/>' +
      "</linearGradient>" +
      // 湿画法：湍流扰动，让色面边缘自然不规则
      '<radialGradient id="' + id + 'gDeep">' +
        '<stop offset="0%" stop-color="' + WC.petalDeep + '" stop-opacity="0.55"/>' +
        '<stop offset="100%" stop-color="' + WC.petalDeep + '" stop-opacity="0"/>' +
      "</radialGradient>" +
      '<radialGradient id="' + id + 'gLight">' +
        '<stop offset="0%" stop-color="' + WC.petalLight + '" stop-opacity="0.8"/>' +
        '<stop offset="100%" stop-color="' + WC.petalLight + '" stop-opacity="0"/>' +
      "</radialGradient>" +
      '<filter id="' + id + 'wet" x="-30%" y="-30%" width="160%" height="160%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.045 0.05" numOctaves="2" seed="9" result="t"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="t" scale="12" xChannelSelector="R" yChannelSelector="G" result="d"/>' +
        '<feGaussianBlur in="d" stdDeviation="0.22"/>' +
      "</filter>" +
      // 大片晕染：更强扰动 + 模糊
      '<filter id="' + id + 'wash" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.010 0.013" numOctaves="4" seed="3" result="t2"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="t2" scale="26" xChannelSelector="R" yChannelSelector="G" result="d2"/>' +
        '<feGaussianBlur in="d2" stdDeviation="4"/>' +
      "</filter>" +
      '<filter id="' + id + 'blur" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feGaussianBlur stdDeviation="0.7"/>' +
      "</filter>" +
      '<filter id="' + id + 'soft" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feGaussianBlur stdDeviation="4.5"/>' +
      "</filter>" +
      // 纸纹颗粒
      '<filter id="' + id + 'grain" x="0" y="0" width="100%" height="100%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" seed="11" result="g"/>' +
        '<feColorMatrix type="saturate" values="0"/>' +
      "</filter>" +
      "</defs>";
  }

  // 一片花瓣：平涂底色 + 渐变浓淡（无滤镜，性能更好）+ 边缘聚色水线
  var petalSeq = 0;
  function petalShape(len, wid, ang, id) {
    var d = petalPath(len, wid, "petal");
    var cid = id + "pc" + (++petalSeq);
    return '<g transform="rotate(' + n(ang) + ')" filter="url(#' + id + 'wet)">' +
      "<defs><clipPath id=\"" + cid + "\"><path d=\"" + d + "\"/></clipPath></defs>" +
      '<path d="' + d + '" fill="' + WC.petalMid + '" opacity="0.80"/>' +
      '<g clip-path="url(#' + cid + ')">' +
        '<ellipse cx="0" cy="' + n(-len * 0.70) + '" rx="' + n(wid * 1.12) + '" ry="' + n(len * 0.44) +
        '" fill="url(#' + id + 'gDeep)"/>' +
        '<ellipse cx="' + n(wid * 0.10) + '" cy="' + n(-len * 0.30) + '" rx="' + n(wid * 0.74) + '" ry="' + n(len * 0.36) +
        '" fill="url(#' + id + 'gLight)"/>' +
      "</g>" +
      '<path d="' + d + '" fill="none" stroke="' + WC.petalEdge + '" stroke-width="3.4" opacity="0.14"/>' +
      '<path d="' + d + '" fill="none" stroke="' + WC.petalEdge + '" stroke-width="1.6" opacity="0.58"/>' +
      "</g>";
  }

  // 花心：淡黄晕 + 花粉点 + 青绿雌蕊（尺寸随花朵半径等比缩放）
  function stamen(r, id) {
    var dr = Math.max(0.55, r * 0.042);
    var o = '<circle r="' + n(r * 0.30) + '" fill="' + WC.center + '" opacity="0.55" filter="url(#' + id + 'soft)"/>';
    var i, a, rad;
    for (i = 0; i < 15; i++) {
      a = i * 0.92 + 0.4;
      rad = r * (0.06 + 0.22 * Math.sqrt(i / 15));
      o += '<circle cx="' + n(Math.cos(a) * rad) + '" cy="' + n(Math.sin(a) * rad) + '" r="' +
        n(dr * (1 + (i % 3) * 0.28)) + '" fill="' + WC.anther + '" opacity="0.88"/>';
    }
    for (i = 0; i < 6; i++) {
      a = (i * 60 + 12) * Math.PI / 180;
      o += '<path d="M0 0 Q ' + n(Math.cos(a) * r * 0.08) + ' ' + n(Math.sin(a) * r * 0.08) +
        ' ' + n(Math.cos(a) * r * 0.17) + ' ' + n(Math.sin(a) * r * 0.17) + '" fill="none" stroke="' +
        WC.pistil + '" stroke-width="' + n(Math.max(0.9, r * 0.035)) + '" stroke-linecap="round" opacity="0.7"/>';
    }
    o += '<circle r="' + n(Math.max(1.1, r * 0.05)) + '" fill="' + WC.pistil + '" opacity="0.85"/>';
    return '<g filter="url(#' + id + 'blur)">' + o + "</g>";
  }

  function blossom(r, P, rot, id, rnd) {
    var o = "", i, step = 360 / P.petals, jitter, len, wid;
    for (i = 0; i < P.petals; i++) {
      jitter = P.wobble ? (rnd() - 0.5) * P.wobble : 0;
      len = r * (1.0 + jitter * 0.09);
      wid = r * P.petalW * (1 + jitter * 0.06);
      o += petalShape(len, wid, rot + i * step + jitter * 5, id);
    }
    o += stamen(r, id);
    return o;
  }

  function domeCluster(r, P, rot, id, rnd) {
    var o = "", ring, i, cnt, places = [[0, 0]];
    for (ring = 0; ring < 2; ring++) {
      cnt = ring === 0 ? 4 : 6;
      for (i = 0; i < cnt; i++) {
        var a = rot + i * (360 / cnt) + ring * 26;
        var rad = r * (ring === 0 ? 0.44 : 0.76);
        places.push([Math.cos(a * Math.PI / 180) * rad, Math.sin(a * Math.PI / 180) * rad * 0.9]);
      }
    }
    for (i = 0; i < places.length; i++) {
      o += '<g transform="translate(' + n(places[i][0]) + ' ' + n(places[i][1]) + ')">' +
        blossom(r * (i === 0 ? 0.42 : 0.36), { petals: 4, petalW: 0.52 }, rot + i * 37, id, rnd) + "</g>";
    }
    return o;
  }

  function spray(r, P, rot, id, rnd) {
    var o = "", k, i, tt;
    for (k = 0; k < 3; k++) {
      var a = rot + (k - 1) * 42 + (rnd() - 0.5) * 16;
      var lx = Math.cos(a * Math.PI / 180) * r * 0.94;
      var ly = Math.sin(a * Math.PI / 180) * r * 0.94;
      o += '<path d="M0 0 Q ' + n(lx * 0.55) + ' ' + n(ly * 0.55 - 8) + ' ' + n(lx) + ' ' + n(ly) +
        '" fill="none" stroke="' + WC.stem + '" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>';
      for (i = 0; i < 4; i++) {
        tt = 0.34 + i * 0.22;
        o += '<g transform="translate(' + n(lx * tt + (rnd() - 0.5) * r * 0.34) + ' ' +
          n(ly * tt + (rnd() - 0.5) * r * 0.34 - i * r * 0.03) + ')">' +
          blossom(r * 0.28, { petals: 5, petalW: 0.46 }, rnd() * 360, id, rnd) + "</g>";
      }
    }
    return o;
  }

  function bellRaceme(r, P, rot, id, rnd) {
    var o = "", i, n1 = 4;
    var ax = r * 0.42, ay = r * 0.62;
    o += '<path d="M0 0 C ' + n(r * 0.10) + ' ' + n(-r * 0.24) + ' ' + n(r * 0.40) + ' ' + n(-r * 0.06) + ' ' + n(ax) + ' ' + n(ay) +
      '" fill="none" stroke="' + WC.stem + '" stroke-width="2.4" stroke-linecap="round"/>';
    for (i = 0; i < n1; i++) {
      var t = i / (n1 - 1);
      var bx = ax * (0.55 + t * 0.95);
      var by = ay * (0.55 + t * 0.85) + Math.sin(t * 3.0) * r * 0.10;
      var rr = r * 0.40 * (1 - t * 0.14);
      o += '<path d="M' + n(bx) + ' ' + n(by - rr * 1.5) + ' L' + n(bx) + ' ' + n(by - rr * 0.62) +
        '" stroke="' + WC.stem + '" stroke-width="1.8" stroke-linecap="round"/>';
      o += '<g filter="url(#' + id + 'wet)">' +
        '<path d="M' + n(bx - rr * 0.52) + ' ' + n(by - rr * 0.60) +
        ' C ' + n(bx - rr * 1.06) + ' ' + n(by + rr * 0.34) + ' ' + n(bx - rr * 0.92) + ' ' + n(by + rr * 1.02) + ' ' + n(bx) + ' ' + n(by + rr * 1.08) +
        ' C ' + n(bx + rr * 0.92) + ' ' + n(by + rr * 1.02) + ' ' + n(bx + rr * 1.06) + ' ' + n(by + rr * 0.34) + ' ' + n(bx + rr * 0.52) + ' ' + n(by - rr * 0.60) +
        ' Q ' + n(bx) + ' ' + n(by - rr * 0.14) + ' ' + n(bx - rr * 0.52) + ' ' + n(by - rr * 0.60) + ' Z"' +
        ' fill="url(#' + id + 'gPetal)" opacity="0.8"/>' +
        '<path d="M' + n(bx - rr * 0.90) + ' ' + n(by + rr * 0.80) + ' Q ' + n(bx) + ' ' + n(by + rr * 1.18) + ' ' + n(bx + rr * 0.90) + ' ' + n(by + rr * 0.80) + '"' +
        ' fill="' + WC.petalDeep + '" opacity="0.5"/></g>';
    }
    return o;
  }

  function head(kind, r, P, id, rnd) {
    if (kind === "dome") return domeCluster(r, P, rnd() * 360, id, rnd);
    if (kind === "spray") return spray(r, P, rnd() * 360, id, rnd);
    if (kind === "bell") return bellRaceme(r, P, rnd() * 360, id, rnd);
    return blossom(r, P, rnd() * 360, id, rnd);
  }

  // 花苞
  function bud(x, y, len, wid, ang, id) {
    var d = "M0 0 C " + n(-wid * 0.52) + " " + n(-len * 0.12) + " " + n(-wid) + " " + n(-len * 0.46) + " " + n(-wid * 0.60) + " " + n(-len * 0.78) +
      " C " + n(-wid * 0.36) + " " + n(-len * 0.96) + " " + n(wid * 0.36) + " " + n(-len * 0.96) + " " + n(wid * 0.60) + " " + n(-len * 0.78) +
      " C " + n(wid) + " " + n(-len * 0.46) + " " + n(wid * 0.52) + " " + n(-len * 0.12) + " 0 0 Z";
    return '<g transform="translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(ang) + ')" filter="url(#' + id + 'wet)">' +
      '<path d="M0 ' + n(len * 0.34) + ' L0 ' + n(-len * 0.02) + '" stroke="' + WC.stem + '" stroke-width="2" stroke-linecap="round"/>' +
      '<g filter="url(#' + id + 'wet)">' +
      '<path d="' + d + '" fill="url(#' + id + 'gBud)" opacity="0.85"/>' +
      '<path d="' + d + '" fill="none" stroke="' + WC.petalEdge + '" stroke-width="1.6" opacity="0.28" filter="url(#' + id + 'blur)"/>' +
      '<path d="M' + n(-wid * 0.46) + ' ' + n(-len * 0.02) + ' Q 0 ' + n(len * 0.22) + ' ' + n(wid * 0.46) + ' ' + n(-len * 0.02) +
      ' Q 0 ' + n(-len * 0.30) + ' ' + n(-wid * 0.46) + ' ' + n(-len * 0.02) + ' Z" fill="' + WC.leafMid + '" opacity="0.9"/>' +
      "</g>" +
      '<path d="M0 ' + n(-len * 0.12) + ' L0 ' + n(-len * 0.80) + '" stroke="' + WC.petalDeep + '" stroke-width="1" opacity="0.25"/>' +
      "</g>";
  }

  function budGroup(x, y, size, ang, count, id, rnd) {
    var o = "", rad = ang * Math.PI / 180, i;
    for (i = 0; i < count; i++) {
      var s = i - (count - 1) / 2;
      o += bud(
        x + Math.cos(rad + Math.PI / 2) * s * size * 0.32,
        y + Math.sin(rad + Math.PI / 2) * s * size * 0.32 + Math.abs(s) * size * 0.08,
        size * (1 - Math.abs(s) * 0.12) * (0.9 + rnd() * 0.2),
        size * 0.38,
        ang + s * 13 + (rnd() - 0.5) * 8,
        id
      );
    }
    return o;
  }

  // 叶片：平涂 + 内部浓淡（渐变）+ 留白叶脉
  function leaf(x, y, len, wid, ang, id) {
    var d = leafPath(len, wid);
    var cid = id + "lc" + (++petalSeq);
    return '<g transform="translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(ang) + ')" filter="url(#' + id + 'wet)">' +
      "<defs><clipPath id=\"" + cid + "\"><path d=\"" + d + "\"/></clipPath></defs>" +
      '<path d="' + d + '" fill="' + WC.leafMid + '" opacity="0.9"/>' +
      '<g clip-path="url(#' + cid + ')">' +
        '<ellipse cx="' + n(wid * 0.18) + '" cy="' + n(-len * 0.30) + '" rx="' + n(wid * 0.95) + '" ry="' + n(len * 0.36) +
        '" fill="url(#' + id + 'gLeafDeep)"/>' +
        '<ellipse cx="' + n(-wid * 0.20) + '" cy="' + n(-len * 0.68) + '" rx="' + n(wid * 0.72) + '" ry="' + n(len * 0.32) +
        '" fill="url(#' + id + 'gLight)"/>' +
      "</g>" +
      '<path d="' + d + '" fill="none" stroke="' + WC.leafDeep + '" stroke-width="1.2" opacity="0.45"/>' +
      '<path d="M0 ' + n(-len * 0.06) + ' L0 ' + n(-len * 0.84) + '" stroke="' + WC.leafLight + '" stroke-width="2.2" opacity="0.6"/>' +
      '<path d="M0 ' + n(-len * 0.40) + ' Q ' + n(-wid * 0.34) + ' ' + n(-len * 0.52) + ' ' + n(-wid * 0.46) + ' ' + n(-len * 0.62) +
      '" fill="none" stroke="' + WC.leafLight + '" stroke-width="1.4" opacity="0.42"/>' +
      '<path d="M0 ' + n(-len * 0.56) + ' Q ' + n(wid * 0.34) + ' ' + n(-len * 0.68) + ' ' + n(wid * 0.44) + ' ' + n(-len * 0.76) +
      '" fill="none" stroke="' + WC.leafLight + '" stroke-width="1.4" opacity="0.42"/>' +
      "</g>";
  }

  function stem(d, w, id) {
    return '<path d="' + d + '" fill="none" stroke="url(#' + id + 'gStem)" stroke-width="' + w +
      '" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>' +
      '<path d="' + d + '" fill="none" stroke="' + WC.stemDeep + '" stroke-width="' + (w + 3) +
      '" stroke-linecap="round" opacity="0.14" filter="url(#' + id + 'blur)"/>';
  }

  // 背景水彩晕 + 飞溅
  function washLayer(id, rnd) {
    var o = "";
    var blobs = [
      [300, 296, 104, 122, 1.2],
      [212, 424, 92, 108, 2.6],
      [334, 448, 84, 96, 4.1],
      [256, 236, 62, 72, 0.4],
      [366, 340, 44, 56, 5.2]
    ];
    var i;
    for (i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      o += '<path d="' + blobPath(b[0] + (rnd() - 0.5) * 12, b[1] + (rnd() - 0.5) * 12,
        b[2] * (0.9 + rnd() * 0.2), b[3] * (0.9 + rnd() * 0.2), b[4] + rnd()) +
        '" fill="' + WC.wash + '" opacity="0.52" filter="url(#' + id + 'wash)"/>';
    }
    for (i = 0; i < 10; i++) {
      o += '<circle cx="' + n(130 + rnd() * 260) + '" cy="' + n(190 + rnd() * 380) + '" r="' +
        n(1.2 + rnd() * 2.4) + '" fill="' + WC.leafMid + '" opacity="' + n(0.16 + rnd() * 0.22) + '" filter="url(#' + id + 'blur)"/>';
    }
    return o;
  }

  // ---------------- 花型 ----------------

  var TYPE = {
    rose:      { kind: "simple", petals: 5, petalW: 0.52, wobble: 1.0 },
    tulip:     { kind: "simple", petals: 5, petalW: 0.46, wobble: 0.8 },
    daisy:     { kind: "simple", petals: 8, petalW: 0.30, wobble: 1.4 },
    sunflower: { kind: "simple", petals: 10, petalW: 0.26, wobble: 1.4 },
    hydrangea: { kind: "dome",   petals: 4, petalW: 0.52, wobble: 0.8 },
    bell:      { kind: "bell",   petals: 5, petalW: 0.44, wobble: 0.4 },
    starry:    { kind: "spray",  petals: 5, petalW: 0.44, wobble: 1.0 },
    camellia:  { kind: "simple", petals: 6, petalW: 0.50, wobble: 0.9 },
    peony:     { kind: "simple", petals: 7, petalW: 0.48, wobble: 1.6 },
    gardenia:  { kind: "simple", petals: 5, petalW: 0.54, wobble: 0.9 }
  };

  // ---------------- 构图 ----------------

  var MAIN = [
    "M240 634 C226 556 234 486 244 414 C252 352 246 250 250 176",
    "M230 520 C198 476 176 436 168 392 C163 362 163 332 166 306",
    "M242 476 C296 444 328 408 346 364 C356 338 360 316 364 296"
  ];

  var PEDICEL = [
    "M248 344 C268 332 284 316 294 304",
    "M178 400 C182 392 186 386 190 382",
    "M342 396 C344 412 340 426 336 436",
    "M250 232 C251 222 251 210 251 202"
  ];

  var HEADS = [
    [294, 300, 66],
    [188, 382, 52],
    [336, 440, 56],
    [250, 200, 38]
  ];

  var BUDS = [
    [166, 300, 34, -134, 2],
    [250, 168, 32, -4, 2],
    [364, 292, 32, 30, 2],
    [398, 474, 30, 24, 1],
    [296, 520, 28, -22, 1]
  ];

  var LEAVES = [
    [238, 600, 100, 28, 54],
    [230, 548, 94, 26, -56],
    [240, 496, 88, 25, 46],
    [176, 434, 80, 23, -64],
    [236, 452, 82, 23, 58],
    [320, 414, 76, 22, -46],
    [346, 340, 66, 20, 40],
    [252, 272, 60, 18, -54]
  ];

  function build(bouquet, rnd) {
    rnd = rnd || Math.random;
    var P = TYPE[bouquet && bouquet.type] || TYPE.rose;
    var id = "wc" + (++uidSeq) + "_";
    var i;
    var take = P.kind === "bell" || P.kind === "dome" ? 3 : 4;
    take = Math.min(take, HEADS.length, PEDICEL.length);

    var stems = "";
    for (i = 0; i < MAIN.length; i++) {
      stems += stem(MAIN[i], i === 0 ? 5.2 : 4.0, id);
    }
    for (i = 0; i < take; i++) {
      stems += stem(PEDICEL[i], 3.4, id);
    }

    var leaves = "";
    for (i = 0; i < LEAVES.length; i++) {
      var L = LEAVES[i];
      leaves += leaf(
        L[0] + (rnd() - 0.5) * 4, L[1] + (rnd() - 0.5) * 4,
        L[2] * (0.94 + rnd() * 0.12), L[3] * (0.92 + rnd() * 0.14),
        L[4] + (rnd() - 0.5) * 8, id
      );
    }

    var buds = "";
    for (i = 0; i < BUDS.length; i++) {
      var B = BUDS[i];
      buds += budGroup(B[0], B[1], B[2] * (0.94 + rnd() * 0.12), B[3] + (rnd() - 0.5) * 8, B[4], id, rnd);
    }

    var flowers = "";
    for (i = 0; i < take; i++) {
      var h = HEADS[i];
      var r = h[2] * (0.95 + rnd() * 0.10);
      flowers += '<g class="bloom"><g transform="translate(' +
        n(h[0] + (rnd() - 0.5) * 6) + ' ' + n(h[1] + (rnd() - 0.5) * 6) + ')" filter="url(#' + id + 'wet)">' +
        head(P.kind, r, P, id, rnd) + "</g></g>";
    }

    // 纸纹颗粒（最上层，极淡）
    var grain = '<rect x="100" y="110" width="340" height="560" filter="url(#' + id + 'grain)" ' +
      'opacity="0.13" style="mix-blend-mode:multiply"/>';

    return (
      '<svg viewBox="112 132 310 522" xmlns="http://www.w3.org/2000/svg" class="bouquet-svg" preserveAspectRatio="xMidYMid meet">' +
      defs(id) +
      '<g class="wash">' + washLayer(id, rnd) + "</g>" +
      '<g class="leaves">' + leaves + "</g>" +
      '<g class="stems">' + stems + "</g>" +
      '<g class="buds">' + buds + "</g>" +
      '<g class="flowers">' + flowers + "</g>" +
      grain +
      "</svg>"
    );
  }

  window.FLOWERS = { build: build, WC: WC, TYPE: TYPE };
})();
