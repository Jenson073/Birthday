/* Canvas scene: seed drop -> trunk & branches -> heart-shaped canopy -> falling petals.

   The tree is modelled in "tree units" (1 unit = k CSS px) with the origin at
   the trunk base and y pointing up (negative y on screen). That keeps the
   geometry resolution-independent: on resize we only recompute k and offsets.

   The canopy is bounded by the parametric heart
       x = 16 sin^3(t)
       y = 13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t)
*/
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  };

  function mulberry32(a) {           // small seeded PRNG -> same tree every visit
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- geometry constants (tree units) ----
  const TRUNK_H = 11;
  const OVERLAP = 1.5;                         // canopy tip overlaps trunk top
  const HEART_MIN = -17, HEART_MAX = 12;       // extent of the parametric heart in y
  const HEART_CY = -(TRUNK_H - OVERLAP - HEART_MIN); // y of the heart's math origin
  const TREE_H = TRUNK_H - OVERLAP + (HEART_MAX - HEART_MIN);
  const TREE_W = 32;

  const INTRO_Y = 0.42;                        // fraction of viewport height (matches CSS #intro)
  const PALETTE = [
    '#ff3b7f', '#ff3b7f', '#ff5c93', '#f06292',      // hot pinks
    '#e8173f', '#ff4b4b',                             // crimson / red
    '#ff8a50', '#ff7043',                             // coral / orange
    '#ffab91', '#ffccbc',                             // peach
    '#ffd54f', '#ffca28', '#ffe082',                  // warm yellows
  ];
  const TRUNK_COLOR = '#f4a6b9';

  function heartPoint(t) {
    return {
      x: 16 * Math.pow(Math.sin(t), 3),
      y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t),
    };
  }

  // Heart outline centred on its bounding box, `scale` px per math unit.
  function heartPath(ctx, cx, cy, scale) {
    const mid = (HEART_MAX + HEART_MIN) / 2;
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const p = heartPoint((i / 90) * TAU);
      const x = cx + p.x * scale, y = cy - (p.y - mid) * scale;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function mixWhite(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(lerp(v, 255, amt)));
    return 'rgb(' + c.join(',') + ')';
  }

  const SPRITE_PX = 64;
  const SPRITE_FILL = (32 * (SPRITE_PX / 36)) / SPRITE_PX; // heart width as fraction of sprite
  function makeSprite(color) {
    const c = document.createElement('canvas');
    c.width = c.height = SPRITE_PX;
    const g = c.getContext('2d');
    const sc = SPRITE_PX / 36;
    heartPath(g, SPRITE_PX / 2, SPRITE_PX / 2, sc);
    const grad = g.createRadialGradient(SPRITE_PX * 0.38, SPRITE_PX * 0.32, 2, SPRITE_PX / 2, SPRITE_PX / 2, SPRITE_PX * 0.55);
    grad.addColorStop(0, mixWhite(color, 0.38));
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fill();
    return c;
  }

  // ---- tree structure ----
  function buildBranches() {
    const rnd = mulberry32(11);
    const list = [];
    const DUR = [0.36, 0.22, 0.18, 0.15];
    const N = 18;

    function add(x, y, ang, len, w0, w1, depth, start) {
      const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
      const bend = (rnd() - 0.5) * 0.5 * len;
      const mx = (x + ex) / 2 + Math.cos(ang) * bend, my = (y + ey) / 2 + Math.sin(ang) * bend;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t;
        pts.push({ x: u * u * x + 2 * u * t * mx + t * t * ex, y: u * u * y + 2 * u * t * my + t * t * ey });
      }
      list.push({ pts, w0, w1, start, dur: DUR[depth], N });
      if (depth < 3) {
        // keep branch tips inside the heart silhouette so no bare twigs poke out
        const spreads = depth === 0 ? [-0.5, 0.05, 0.5] : [-0.45, 0.45];
        spreads.forEach((sp) => {
          add(ex, ey, ang + sp + (rnd() - 0.5) * 0.2, len * (depth === 0 ? 0.72 : 0.7),
              w1, w1 * 0.62, depth + 1, start + DUR[depth] * 0.8);
        });
      }
    }
    add(0, 0.8, 0, TRUNK_H + 0.8, 3.6, 2.2, 0, 0);

    const end = Math.max.apply(null, list.map((b) => b.start + b.dur));
    list.forEach((b) => { b.start /= end; b.dur /= end; });
    return list;
  }

  function buildLeaves(count) {
    const rnd = mulberry32(2024);
    const leaves = [];
    for (let i = 0; i < count; i++) {
      const edge = rnd() < 0.28;                                  // crisp silhouette
      const sc = edge ? 0.9 + 0.1 * rnd() : Math.sqrt(rnd()) * 0.92;
      const p = heartPoint(rnd() * TAU);
      leaves.push({
        x: p.x * sc,
        y: HEART_CY - p.y * sc,
        size: (edge ? 1.35 : 1.5) + rnd() * 1.1,
        rot: (rnd() - 0.5) * 1.8,
        sprite: Math.floor(rnd() * PALETTE.length),
        phase: rnd() * TAU,
        edge: edge,
        delay: 0,
        regrowAt: 0,
      });
    }
    // bloom spreads outward from the top of the trunk
    const ox = 0, oy = -TRUNK_H;
    let maxD = 0;
    leaves.forEach((l) => { l.d = Math.hypot(l.x - ox, l.y - oy); maxD = Math.max(maxD, l.d); });
    leaves.forEach((l) => { l.delay = (l.d / maxD) * 0.78 + rnd() * 0.1; });
    return leaves;
  }

  // ---- scene ----
  function createScene(canvas, options) {
    const cfg = Object.assign({ timeScale: 1, onLayout: function () {} }, options);
    const ctx = canvas.getContext('2d');
    const sprites = PALETTE.map(makeSprite);
    const branches = buildBranches();
    const leaves = buildLeaves(1150);
    let petals = [];

    const s = { drop: 0, grow: 0, bloom: 0, slide: 0, time: 0, petalsOn: false };
    const L = { k: 1, ground: 0, cx0: 0, cx1: 0, introY: 0, introSize: 56, narrow: false };
    let W = 0, H = 0, dpr = 1;
    let tweens = [];
    let petalAcc = 0, petalNext = 0.4;

    function layout() {
      W = window.innerWidth; H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);      // high-DPI crispness, capped for speed
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);

      L.narrow = W < 720 || H > W * 1.15;
      L.ground = H - Math.max(14, H * 0.035);
      let availW, availH;
      if (L.narrow) {
        availW = W * 0.94; availH = H * 0.6;
        L.cx0 = L.cx1 = W / 2;
      } else {
        availW = W * 0.5 * 0.92; availH = H * 0.9;           // right half of the viewport
        L.cx0 = W / 2; L.cx1 = W * 0.74;
      }
      L.k = Math.min(availW / (TREE_W + 2), availH / (TREE_H + 1));
      L.introY = H * INTRO_Y;
      L.introSize = clamp(Math.min(W, H) * 0.1, 46, 76);
      document.documentElement.dataset.layout = L.narrow ? 'narrow' : 'wide';
      cfg.onLayout(L.narrow ? 'narrow' : 'wide');
    }

    // ---- tweens (promise based timeline) ----
    function tween(key, to, ms, easing) {
      return new Promise(function (resolve) {
        tweens.push({ key: key, from: s[key], to: to, ms: Math.max(1, ms * cfg.timeScale), t: 0, easing: easing || ease.linear, resolve: resolve });
      });
    }
    function updateTweens(dtMs) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t += dtMs;
        const p = clamp(tw.t / tw.ms);
        s[tw.key] = lerp(tw.from, tw.to, tw.easing(p));
        if (p >= 1) { tweens.splice(i, 1); tw.resolve(); }
      }
    }

    // ---- petals ----
    function addPetal(x, y, vx, vy, src) {
      petals.push({
        x: x, y: y, vx: vx, vy: vy,
        term: 2.2 + Math.random() * 1.4,
        sprite: src.sprite, size: src.size,
        rot: src.rot, vr: (Math.random() - 0.5) * 2.4,
        phase: Math.random() * TAU,
        landY: -Math.random() * 1.1,
        landed: false, fade: 1,
      });
    }
    function detachLeaf() {
      for (let tries = 0; tries < 14; tries++) {
        const lf = leaves[Math.floor(Math.random() * leaves.length)];
        if (!(lf.edge || Math.random() < 0.2)) continue;
        if (lf.regrowAt && s.time < lf.regrowAt + 1) continue;
        lf.regrowAt = s.time + 2.5 + Math.random() * 2;
        addPetal(lf.x, lf.y, 0, 0.6, lf);
        return;
      }
    }
    function burst(px, py, n) {
      if (s.bloom < 1) return;
      const cx = lerp(L.cx0, L.cx1, s.slide);
      const ux = (px - cx) / L.k, uy = (py - L.ground) / L.k;
      for (let i = 0; i < (n || 22); i++) {
        const a = Math.random() * TAU, sp = 2 + Math.random() * 5;
        addPetal(ux, uy, Math.cos(a) * sp, Math.sin(a) * sp - 3, leaves[Math.floor(Math.random() * leaves.length)]);
      }
    }
    function updatePetals(dt) {
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        if (!p.landed) {
          p.vy += (p.term - p.vy) * Math.min(1, 2 * dt);
          p.vx *= Math.max(0, 1 - 1.5 * dt);
          p.x += (p.vx + Math.cos(s.time * 1.6 + p.phase) * 1.4) * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.y >= p.landY) { p.y = p.landY; p.landed = true; }
        } else {
          p.fade -= dt / 1.6;
          if (p.fade <= 0) petals.splice(i, 1);
        }
      }
      if (s.petalsOn) {
        petalAcc += dt;
        if (petalAcc > petalNext) { petalAcc = 0; petalNext = 0.25 + Math.random() * 0.45; detachLeaf(); }
      }
    }

    // ---- drawing ----
    function seedPose(d) {
      const seedW = Math.max(8, L.k * 0.75);
      const size = lerp(L.introSize, seedW, ease.outCubic(d));
      const ySeed = L.ground - seedW * 0.4;
      return { size: size, x: L.cx0, y: lerp(L.introY, ySeed, d * d) };
    }
    function drawHeartIcon(x, y, size, alpha, glow) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = 'rgba(255, 70, 120, .85)';
      ctx.shadowBlur = glow;
      heartPath(ctx, x, y, size / 34);
      const g = ctx.createLinearGradient(x, y - size / 2, x, y + size / 2);
      g.addColorStop(0, '#ff7aa2'); g.addColorStop(1, '#ff2f62');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }
    function drawSeed() {
      const a = 1 - clamp((s.grow - 0.02) / 0.12);
      if (a <= 0) return;
      const d = s.drop;
      const pulse = 1 + 0.09 * Math.sin(s.time * 5.5) * (1 - Math.min(1, d * 8));
      if (d > 0 && d < 1) {                                   // motion trail while falling
        for (let i = 6; i >= 1; i--) {
          const q = seedPose(Math.max(0, d - i * 0.035));
          drawHeartIcon(q.x, q.y, q.size * 0.9, 0.22 * (1 - i / 7), 0);
        }
      }
      const q = seedPose(d);
      drawHeartIcon(q.x, q.y, q.size * pulse, a, lerp(26, 6, d));
    }

    function drawGround(cx) {
      const a = clamp((s.drop - 0.85) / 0.15);
      if (a <= 0) return;
      ctx.save();
      ctx.translate(cx, L.ground);
      ctx.scale(1, 0.1);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L.k * 15);
      g.addColorStop(0, 'rgba(255, 140, 175, .55)');
      g.addColorStop(1, 'rgba(255, 140, 175, 0)');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, L.k * 15, 0, TAU); ctx.fill();
      ctx.restore();
    }

    function drawBranches() {
      ctx.strokeStyle = TRUNK_COLOR;
      ctx.lineCap = 'round';
      for (let b = 0; b < branches.length; b++) {
        const br = branches[b];
        const p = clamp((s.grow - br.start) / br.dur);
        if (p <= 0) continue;
        const segs = ease.inOutCubic(p) * br.N;
        for (let i = 0; i < br.N; i++) {
          const sp = clamp(segs - i);
          if (sp <= 0) break;
          const a = br.pts[i], c = br.pts[i + 1];
          ctx.lineWidth = lerp(br.w0, br.w1, (i + 0.5) / br.N);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(lerp(a.x, c.x, sp), lerp(a.y, c.y, sp));
          ctx.stroke();
        }
      }
    }

    function drawLeaves(cx) {
      const kd = L.k * dpr, ex = cx * dpr, ey = L.ground * dpr;
      for (let i = 0; i < leaves.length; i++) {
        const lf = leaves[i];
        const p = clamp((s.bloom - lf.delay) / 0.14);
        if (p <= 0) continue;
        let f = 1;
        if (lf.regrowAt) f = s.time < lf.regrowAt ? 0 : clamp(s.time - lf.regrowAt);
        if (f <= 0) continue;
        const sway = Math.sin(s.time * 1.1 + lf.phase);
        const rot = lf.rot + sway * 0.07 * p;
        const size = (ease.outBack(p) * ease.outCubic(f) * lf.size) / SPRITE_FILL;
        const cs = Math.cos(rot) * kd, sn = Math.sin(rot) * kd;
        ctx.setTransform(cs, sn, -sn, cs, ex + (lf.x + sway * 0.12 * p) * kd, ey + lf.y * kd);
        ctx.drawImage(sprites[lf.sprite], -size / 2, -size / 2, size, size);
      }
    }

    function drawPetals(cx) {
      const kd = L.k * dpr, ex = cx * dpr, ey = L.ground * dpr;
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        const size = p.size / SPRITE_FILL;
        const cs = Math.cos(p.rot) * kd, sn = Math.sin(p.rot) * kd;
        ctx.globalAlpha = clamp(p.fade);
        ctx.setTransform(cs, sn, -sn, cs, ex + p.x * kd, ey + p.y * kd);
        ctx.drawImage(sprites[p.sprite], -size / 2, -size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      const cx = lerp(L.cx0, L.cx1, s.slide);
      drawSeed();
      drawGround(cx);

      // soft glow behind the canopy once it blooms
      if (s.bloom > 0) {
        ctx.setTransform(L.k * dpr, 0, 0, L.k * dpr, cx * dpr, L.ground * dpr);
        const g = ctx.createRadialGradient(0, HEART_CY - 2, 0, 0, HEART_CY - 2, 26);
        g.addColorStop(0, 'rgba(255, 70, 120, .16)');
        g.addColorStop(1, 'rgba(255, 70, 120, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(-30, HEART_CY - 32, 60, 64);
      }

      ctx.setTransform(L.k * dpr, 0, 0, L.k * dpr, cx * dpr, L.ground * dpr);
      drawBranches();
      drawLeaves(cx);
      drawPetals(cx);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.time += dt;
      updateTweens(dt * 1000);
      updatePetals(dt);
      draw();
      requestAnimationFrame(frame);
    }

    window.addEventListener('resize', layout);
    canvas.addEventListener('pointerdown', function (e) { burst(e.clientX, e.clientY); });
    layout();
    requestAnimationFrame(frame);

    return {
      dropSeed: function () { return tween('drop', 1, 1000, ease.inQuad); },
      growTree: function () { return tween('grow', 1, 2700, ease.linear); },
      bloom: function () { return tween('bloom', 1, 3800, ease.linear); },
      slide: function () { return tween('slide', 1, 1800, ease.inOutCubic); },
      startPetals: function () { s.petalsOn = true; },
      reset: function () {
        tweens = []; petals = [];
        s.drop = s.grow = s.bloom = s.slide = 0; s.petalsOn = false;
        leaves.forEach(function (l) { l.regrowAt = 0; });
      },
      state: s,
    };
  }

  global.Birthday = global.Birthday || {};
  global.Birthday.createScene = createScene;
})(window);
