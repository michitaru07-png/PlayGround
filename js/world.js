import { TAU, makeRng, rand, clamp } from './utils.js';

function hexA(hex, alpha) {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildCityTile(opts) {
  const {
    seed = 1,
    width = 2048,
    height = 620,
    body = '#0c1326',
    edge = 'rgba(120, 170, 255, 0.09)',
    windowColors = ['#27406d'],
    windowChance = 0.35,
    minW = 70,
    maxW = 165,
    minH = 230,
    maxH = 540,
    windowW = 9,
    windowH = 12,
    gapX = 14,
    gapY = 20,
  } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const rng = makeRng(seed);
  const r = (a, b) => a + rng() * (b - a);

  let x = -20;
  while (x < width) {
    const w = r(minW, maxW);
    const h = r(minH, maxH);
    const y = height - h;
    g.fillStyle = body;
    g.fillRect(x, y, w, h);

    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.025)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);

    g.fillStyle = edge;
    g.fillRect(x, y, 1, h);
    g.fillRect(x + w - 1, y, 1, h);

    g.fillStyle = 'rgba(255,255,255,0.055)';
    g.fillRect(x, y, w, 1.5);

    if (rng() < 0.55) {
      const rw = r(8, 26);
      g.fillStyle = body;
      g.fillRect(x + r(6, Math.max(8, w - rw - 6)), y - r(4, 16), rw, r(4, 16));
    }
    if (rng() < 0.34) {
      const ax = x + r(10, Math.max(14, w - 14));
      g.strokeStyle = 'rgba(160, 190, 255, 0.14)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(ax, y);
      g.lineTo(ax, y - r(18, 52));
      g.stroke();
      if (rng() < 0.55) {
        g.fillStyle = '#ff4d6a';
        g.globalAlpha = 0.55;
        g.beginPath();
        g.arc(ax, y - r(18, 40), 1.3, 0, TAU);
        g.fill();
        g.globalAlpha = 1;
      }
    }

    const cols = Math.max(1, Math.floor((w - 16) / (windowW + 10)));
    const rows = Math.max(2, Math.floor((h - 24) / (windowH + gapY)));
    const cellW = (w - 16) / cols;
    const startY = y + 16;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        if (rng() > windowChance) continue;
        const wx = x + 9 + cx * cellW;
        const wy = startY + cy * (windowH + gapY);
        const color = windowColors[Math.floor(rng() * windowColors.length)];
        g.globalAlpha = r(0.25, 0.8);
        g.fillStyle = color;
        g.fillRect(wx, wy, windowW * 0.68, windowH * 0.45);
        if (rng() < 0.12) {
          g.globalAlpha = 0.07;
          g.fillRect(wx - 3, wy - 3, windowW * 0.68 + 6, windowH * 0.45 + 6);
        }
      }
    }
    g.globalAlpha = 1;

    if (opts.streetGlow) {
      const sg = g.createLinearGradient(0, height - 46, 0, height);
      sg.addColorStop(0, 'rgba(255, 120, 190, 0)');
      sg.addColorStop(1, opts.streetGlow);
      g.fillStyle = sg;
      g.fillRect(x, height - 46, w, 46);
    }

    x += w + r(2, gapX);
  }
  return canvas;
}

const SIGNS = [
  { x: 260, y: 248, w: 54, h: 136, text: 'HOTEL', color: '#ff3d9a', vertical: true, speed: 1.7 },
  { x: 690, y: 132, w: 118, h: 40, text: 'RAMEN', color: '#41f6ff', vertical: false, speed: 2.6 },
  { x: 1210, y: 268, w: 60, h: 160, text: 'BAR', color: '#ff9d4d', vertical: true, speed: 2.1 },
  { x: 1660, y: 158, w: 92, h: 38, text: '24H', color: '#b8ff63', vertical: false, speed: 1.4 },
  { x: 1960, y: 252, w: 50, h: 126, text: 'INN', color: '#8b7dff', vertical: true, speed: 2.9 },
];

const LAMPS = [
  { x: 340, side: 1 },
  { x: 1640, side: -1 },
];

const BARRELS = [
  { x: 130, seed: 11 },
  { x: 2080, seed: 29 },
];

const PUDDLES = [
  { x: 480, y: 0.3, w: 150, h: 26, color: '65, 246, 255' },
  { x: 910, y: 0.72, w: 210, h: 34, color: '255, 61, 154' },
  { x: 1420, y: 0.22, w: 130, h: 22, color: '255, 157, 77' },
  { x: 1840, y: 0.68, w: 180, h: 30, color: '139, 125, 255' },
  { x: 220, y: 0.86, w: 110, h: 20, color: '65, 246, 255' },
];

const GROUND_MARGIN = 90;

export class World {
  constructor() {
    this.time = 0;
    this.viewKey = '';
    this.skyCanvas = null;
    this.groundCanvas = null;
    this.groundHorizon = 0;
    this.signSprites = null;
    this.menuMode = true;

    this.far = buildCityTile({
      seed: 7, height: 560,
      body: '#0a1020',
      edge: 'rgba(110, 160, 255, 0.05)',
      windowColors: ['#1b2b4c', '#243b63', '#3a5c8e', '#79d8ff'],
      windowChance: 0.14, minW: 60, maxW: 150, minH: 170, maxH: 460,
      windowW: 7, windowH: 9, gapX: 22, gapY: 22,
    });
    this.mid = buildCityTile({
      seed: 23, height: 620,
      body: '#0d152a',
      edge: 'rgba(140, 190, 255, 0.09)',
      windowColors: ['#ffbe7a', '#ff6ea6', '#63e9ff', '#3c5c92', '#ffd9a0'],
      windowChance: 0.22, minW: 80, maxW: 180, minH: 210, maxH: 520,
      windowW: 10, windowH: 13, gapX: 12, gapY: 18,
      streetGlow: 'rgba(255, 90, 160, 0.045)',
    });
    this.fencePattern = this.makeFencePattern();
    this.rain = [];
    for (let i = 0; i < 90; i++) {
      this.rain.push({
        x: Math.random(), y: Math.random(),
        len: rand(7, 20), speed: rand(0.55, 1.25), alpha: rand(0.05, 0.16),
      });
    }
    this.stars = [];
    const rng = makeRng(91);
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: rng(), y: rng() * 0.55, r: 0.5 + rng() * 1.3,
        a: 0.2 + rng() * 0.6, speed: 0.4 + rng() * 1.8, phase: rng() * TAU,
      });
    }
  }

  makeFencePattern() {
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 24;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(150, 185, 235, 0.17)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(24, 24);
    g.moveTo(24, 0); g.lineTo(0, 24);
    g.stroke();
    g.globalAlpha = 0.5;
    g.beginPath();
    g.moveTo(0, 12); g.lineTo(24, 12);
    g.stroke();
    return c;
  }

  update(dt) {
    this.time += dt;
  }

  horizonOf(view) {
    return view.baseline - view.depthPx * 0.5 - 26 * view.s;
  }

  ensureViewport(view) {
    const key = `${Math.round(view.W)}:${Math.round(view.H)}:${view.s.toFixed(3)}:${Math.round(view.baseline)}:${this.menuMode ? 'm' : 'g'}`;
    if (key === this.viewKey) return;
    this.viewKey = key;
    this.buildSky(view);
    this.buildSigns(view);
    if (!this.menuMode) this.buildGround(view);
  }

  setMenuMode(enabled) {
    if (this.menuMode === enabled) return;
    this.menuMode = enabled;
    this.viewKey = '';
  }

  buildSky(view) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(view.W));
    c.height = Math.max(2, Math.ceil(view.H));
    const g = c.getContext('2d');
    this.paintSky(g, { ...view, time: 0 });
    this.skyCanvas = c;
  }

  buildSigns(view) {
    const s = view.s;
    this.signSprites = SIGNS.map((sign) => {
      const pad = 26;
      const w = Math.ceil((sign.w + pad) * s);
      const h = Math.ceil((sign.h + pad) * s);
      const c = document.createElement('canvas');
      c.width = Math.max(4, w);
      c.height = Math.max(4, h);
      const g = c.getContext('2d');
      g.translate((pad * s) / 2, (pad * s) / 2);
      this.paintSign(g, sign, { s, x: (sign.w * s) / 2, y: (sign.h * s) / 2, alpha: 1, bake: true });
      return { canvas: c, sign };
    });
  }

  buildGround(view) {
    const horizon = this.horizonOf(view);
    const stripTop = Math.max(0, horizon);
    const stripHeight = Math.max(40, view.H - stripTop + 110);
    const stripWidth = Math.max(80, (2200 + GROUND_MARGIN * 2) * view.s);
    const c = document.createElement('canvas');
    c.width = Math.ceil(stripWidth);
    c.height = Math.ceil(stripHeight);
    const g = c.getContext('2d');
    const baseY = view.depthPx * 0.5 + 26 * view.s;
    this.paintGround(g, {
      W: stripWidth,
      H: stripHeight,
      s: view.s,
      baseline: baseY,
      depthPx: view.depthPx,
      camX: 1100,
      time: 0,
      bake: true,
    });
    this.groundCanvas = c;
    this.groundHorizon = stripTop;
  }

  // ---------- sky ----------
  drawSky(ctx, view) {
    this.ensureViewport(view);
    if (this.skyCanvas) {
      ctx.drawImage(this.skyCanvas, 0, 0, view.W, view.H);
    } else {
      this.paintSky(ctx, view);
    }
    // a handful of animated stars on top keeps the sky alive cheaply
    for (let i = 0; i < 12; i++) {
      const star = this.stars[i];
      const a = star.a * (0.5 + 0.5 * Math.sin(this.time * star.speed + star.phase));
      ctx.globalAlpha = a * 0.65;
      ctx.fillStyle = '#d9e6ff';
      ctx.beginPath();
      ctx.arc(star.x * view.W, star.y * view.H, star.r * Math.max(0.7, view.s), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  paintSky(ctx, view) {
    const { W, H, s, camX } = view;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#04050d');
    sky.addColorStop(0.34, '#0a0e22');
    sky.addColorStop(0.62, '#161a3d');
    sky.addColorStop(0.82, '#2a1f45');
    sky.addColorStop(1, '#0b0d1c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const hazeY = view.baseline - view.depthPx * 0.5 - 50 * s;
    const haze = ctx.createRadialGradient(W * 0.6, hazeY, 0, W * 0.6, hazeY, Math.max(W * 0.6, 420));
    haze.addColorStop(0, 'rgba(255, 61, 154, 0.15)');
    haze.addColorStop(0.45, 'rgba(120, 70, 200, 0.09)');
    haze.addColorStop(1, 'rgba(20, 20, 50, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    const mx = W * 0.76 - camX * 0.015 * s;
    const my = H * 0.18;
    const mr = Math.max(26, 56 * s);
    const moonGlow = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 4.6);
    moonGlow.addColorStop(0, 'rgba(255, 238, 210, 0.24)');
    moonGlow.addColorStop(0.35, 'rgba(255, 170, 190, 0.1)');
    moonGlow.addColorStop(1, 'rgba(255, 120, 180, 0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);

    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.clip();
    const moonBody = ctx.createLinearGradient(mx, my - mr, mx, my + mr);
    moonBody.addColorStop(0, '#fff6e2');
    moonBody.addColorStop(0.55, '#ffe0c8');
    moonBody.addColorStop(1, '#ffb6b0');
    ctx.fillStyle = moonBody;
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    ctx.fillStyle = 'rgba(150, 110, 140, 0.2)';
    ctx.beginPath(); ctx.arc(mx - mr * 0.32, my - mr * 0.2, mr * 0.22, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * 0.3, my + mr * 0.28, mr * 0.16, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + mr * 0.12, my - mr * 0.42, mr * 0.1, 0, TAU); ctx.fill();
    ctx.restore();

    for (const star of this.stars) {
      const a = star.a * (0.6 + 0.4 * Math.sin(star.phase));
      ctx.globalAlpha = a * 0.75;
      ctx.fillStyle = '#d9e6ff';
      ctx.beginPath();
      ctx.arc(star.x * W, star.y * H, star.r * Math.max(0.7, s), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 3; i++) {
      const cy = H * (0.17 + i * 0.09);
      const cx = W * (0.1 + i * 0.28);
      const cw = 320 + i * 120;
      const ch = 18 + i * 14;
      const cg = ctx.createLinearGradient(cx, cy, cx + cw, cy);
      cg.addColorStop(0, 'rgba(190, 190, 255, 0)');
      cg.addColorStop(0.5, 'rgba(190, 190, 255, 0.65)');
      cg.addColorStop(1, 'rgba(190, 190, 255, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(cx + cw / 2, cy, cw / 2, ch, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const cityGlow = ctx.createRadialGradient(W * 0.35, view.baseline - 40 * s, 10, W * 0.35, view.baseline - 40 * s, W * 0.55);
    cityGlow.addColorStop(0, 'rgba(255, 100, 180, 0.1)');
    cityGlow.addColorStop(0.5, 'rgba(90, 120, 220, 0.05)');
    cityGlow.addColorStop(1, 'rgba(20, 20, 40, 0)');
    ctx.fillStyle = cityGlow;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- city ----------
  drawTile(ctx, tile, view, parallax, bottom, alpha = 1) {
    const { W, s, camX } = view;
    const tw = tile.width * s;
    const th = tile.height * s;
    const shift = ((camX * parallax * s) % tw + tw) % tw;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let x = -shift - tw; x < W + tw; x += tw) {
      ctx.drawImage(tile, x, bottom - th, tw, th);
    }
    ctx.restore();
  }

  drawCity(ctx, view) {
    this.ensureViewport(view);
    const horizon = this.horizonOf(view);
    this.drawTile(ctx, this.far, view, 0.08, horizon + 6 * view.s, 0.9);
    this.drawTile(ctx, this.mid, view, 0.3, horizon + 16 * view.s, 1);

    // atmospheric band that ties the buildings into the street
    const fog = ctx.createLinearGradient(0, horizon - 150 * view.s, 0, horizon + 20 * view.s);
    fog.addColorStop(0, 'rgba(10, 12, 30, 0)');
    fog.addColorStop(0.7, 'rgba(34, 24, 64, 0.22)');
    fog.addColorStop(1, 'rgba(8, 10, 22, 0.6)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 150 * view.s, view.W, 170 * view.s);

    if (this.signSprites) {
      for (const sprite of this.signSprites) {
        const sign = sprite.sign;
        const sx = (sign.x - view.camX * 0.42) * view.s + view.W / 2;
        const sy = horizon - sign.y * view.s;
        if (sx < -260 * view.s || sx > view.W + 260 * view.s) continue;
        const flicker = 0.68 + 0.32 * Math.sin(this.time * sign.speed + sign.x);
        const on = Math.sin(this.time * sign.speed * 2.7 + sign.x) > -0.88;
        ctx.globalAlpha = on ? flicker : 0.14;
        const pad = 13 * view.s;
        ctx.drawImage(sprite.canvas, sx - (sign.w * view.s) / 2 - pad, sy - (sign.h * view.s) / 2 - pad);
      }
      ctx.globalAlpha = 1;
    }
  }

  paintSign(g, sign, opts) {
    const { s, w = sign.w * s, h = sign.h * s } = opts;
    // board
    g.fillStyle = 'rgba(8, 9, 20, 0.94)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = sign.color;
    g.lineWidth = Math.max(1, 1.6 * s);
    g.globalAlpha = 0.74;
    g.strokeRect(0, 0, w, h);
    g.globalAlpha = 0.2;
    g.shadowColor = sign.color;
    g.shadowBlur = 20 * s;
    g.fillStyle = sign.color;
    g.fillRect(3 * s, 3 * s, w - 6 * s, h - 6 * s);
    g.shadowBlur = 0;

    g.globalAlpha = 1;
    g.fillStyle = '#fff7fb';
    g.shadowColor = sign.color;
    g.shadowBlur = 12 * s;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (sign.vertical) {
      const fontSize = Math.min(w * 0.44, h / (sign.text.length + 1.6));
      g.font = `800 ${fontSize}px ui-monospace, Menlo, monospace`;
      const step = h / (sign.text.length + 0.6);
      for (let i = 0; i < sign.text.length; i++) {
        g.fillText(sign.text[i], w / 2, step * (i + 0.8));
      }
    } else {
      const fontSize = Math.min(h * 0.58, w / (sign.text.length * 0.82));
      g.font = `800 ${fontSize}px ui-monospace, Menlo, monospace`;
      g.fillText(sign.text, w / 2, h / 2 + 1 * s);
    }
    g.shadowBlur = 0;
  }

  // ---------- ground ----------
  drawGround(ctx, view) {
    this.ensureViewport(view);
    if (this.menuMode) {
      // Lightweight title-screen floor: no baked world strip, no props.
      const horizon = this.horizonOf(view);
      const g = ctx.createLinearGradient(0, horizon, 0, view.H);
      g.addColorStop(0, '#131a2e');
      g.addColorStop(0.3, '#0c1220');
      g.addColorStop(1, '#04070e');
      ctx.fillStyle = g;
      ctx.fillRect(0, horizon, view.W, view.H - horizon);
      ctx.fillStyle = 'rgba(160, 190, 255, 0.12)';
      ctx.fillRect(0, horizon, view.W, Math.max(1, 2 * view.s));
      const glow = ctx.createRadialGradient(view.W * 0.5, horizon + 120 * view.s, 5, view.W * 0.5, horizon + 120 * view.s, view.W * 0.45);
      glow.addColorStop(0, 'rgba(255, 61, 154, 0.08)');
      glow.addColorStop(1, 'rgba(255, 61, 154, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, horizon, view.W, view.H - horizon);
      return;
    }
    const horizon = this.horizonOf(view);
    if (this.groundCanvas) {
      const srcX = (view.camX - view.W / (2 * view.s) + GROUND_MARGIN) * view.s;
      const maxX = Math.max(0, this.groundCanvas.width - view.W);
      const sx = clamp(srcX, 0, maxX);
      const dy = Math.max(0, horizon);
      ctx.drawImage(
        this.groundCanvas,
        sx, 0, Math.min(view.W, this.groundCanvas.width), this.groundCanvas.height,
        0, dy, view.W, this.groundCanvas.height
      );
    }
    this.drawReflections(ctx, view);
    this.drawDynamicProps(ctx, view);
  }

  paintGround(ctx, view) {
    const { W, H, s, baseline, depthPx, camX } = view;
    const horizon = baseline - depthPx * 0.5 - 26 * s;

    const ground = ctx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, '#151b31');
    ground.addColorStop(0.18, '#101728');
    ground.addColorStop(0.62, '#090e1b');
    ground.addColorStop(1, '#050810');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, W, H - horizon);

    for (let i = 0; i < 4; i++) {
      const y = horizon + (depthPx + 60 * s) * (i / 3);
      ctx.globalAlpha = 0.055;
      ctx.fillStyle = i % 2 === 0 ? '#7f9cff' : '#ff6aa8';
      ctx.fillRect(0, y, W, 1.5 * s);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#0b0f1d';
    ctx.fillRect(0, horizon - 26 * s, W, 30 * s);
    ctx.fillStyle = 'rgba(160, 190, 255, 0.16)';
    ctx.fillRect(0, horizon + 2 * s, W, Math.max(1, 2 * s));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, horizon + 4 * s, W, 7 * s);

    // fence
    ctx.save();
    const fenceTop = horizon - 104 * s;
    const fenceH = 78 * s;
    const pattern = ctx.createPattern(this.fencePattern, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, fenceTop, W, fenceH);
    }
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(170, 200, 255, 0.16)';
    ctx.lineWidth = Math.max(1, 2.2 * s);
    ctx.beginPath();
    ctx.moveTo(0, fenceTop);
    ctx.lineTo(W, fenceTop);
    ctx.stroke();
    for (let wx = 60; wx < 2260; wx += 190) {
      const sx = (wx - camX) * s + W / 2;
      if (sx < -20 || sx > W + 20) continue;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = 'rgba(10, 13, 25, 0.9)';
      ctx.fillRect(sx - 2.4 * s, fenceTop, 4.8 * s, fenceH + 16 * s);
      ctx.fillStyle = 'rgba(160, 190, 255, 0.18)';
      ctx.fillRect(sx - 2.4 * s, fenceTop, Math.max(1, 1.2 * s), fenceH + 16 * s);
    }
    ctx.restore();

    // depth hints
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = '#8bb0ff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = baseline + depthPx * (i / 3 - 0.5) + 26 * s;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // puddles
    for (const p of PUDDLES) {
      const sx = (p.x - camX) * s + W / 2;
      const sy = baseline + (p.y - 0.5) * depthPx;
      if (sx < -p.w * s || sx > W + p.w * s) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(1, 0.18);
      const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, (p.w / 2) * s);
      pg.addColorStop(0, `rgba(${p.color}, 0.2)`);
      pg.addColorStop(0.6, `rgba(${p.color}, 0.06)`);
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(0, 0, (p.w / 2) * s, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = 'rgba(200, 230, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, (p.w / 2) * s * 0.62, 0.2, Math.PI - 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // manholes
    for (const m of [{ x: 720, y: 0.6 }, { x: 1510, y: 0.38 }]) {
      const sx = (m.x - camX) * s + W / 2;
      const sy = baseline + (m.y - 0.5) * depthPx;
      if (sx < -60 || sx > W + 60) continue;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#0a0e19';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 28 * s, 8 * s, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(130, 160, 210, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, (12 + i * 6) * s, (3.4 + i * 1.8) * s, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    // cracks
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    const rng = makeRng(41);
    for (let i = 0; i < 9; i++) {
      const x = rng() * W;
      const y = horizon + 40 * s + rng() * (H - horizon);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 50 * s, y + (rng() - 0.5) * 8 * s);
      ctx.lineTo(x + (rng() - 0.5) * 90 * s, y + (rng() - 0.5) * 12 * s);
      ctx.stroke();
    }
    ctx.restore();

    const front = ctx.createLinearGradient(0, H * 0.72, 0, H);
    front.addColorStop(0, 'rgba(2, 4, 10, 0)');
    front.addColorStop(1, 'rgba(2, 4, 10, 0.72)');
    ctx.fillStyle = front;
    ctx.fillRect(0, H * 0.72, W, H * 0.28);

    this.drawProps(ctx, view, horizon, 0, true);
  }

  drawReflections(ctx, view) {
    const { W, s, baseline, depthPx } = view;
    const horizon = this.horizonOf(view);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sign of SIGNS) {
      const sx = (sign.x - view.camX * 0.42) * s + W / 2;
      if (sx < -220 || sx > W + 220) continue;
      const w = sign.w * 0.55 * s;
      const top = horizon + 18 * s;
      const bottom = horizon + depthPx + 100 * s;
      const rg = ctx.createLinearGradient(0, top, 0, bottom);
      rg.addColorStop(0, hexA(sign.color, 0.1));
      rg.addColorStop(0.45, hexA(sign.color, 0.035));
      rg.addColorStop(1, hexA(sign.color, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(sx, (top + bottom) / 2, w, (bottom - top) / 2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawDynamicProps(ctx, view) {
    const { W, s, depthPx } = view;
    const horizon = this.horizonOf(view);
    const baseline = view.baseline;

    // barrels: animated flames + embers (the barrel body is baked)
    for (const barrel of BARRELS) {
      const sx = (barrel.x - view.camX) * s + W / 2;
      if (sx < -100 * s || sx > W + 100 * s) continue;
      const by = horizon + 18 * s;
      const bw = 20 * s;
      const bh = 26 * s;
      ctx.save();
      const fg = ctx.createRadialGradient(sx, by - bh - 6 * s, 0, sx, by - bh - 6 * s, 52 * s);
      fg.addColorStop(0, 'rgba(255, 160, 60, 0.48)');
      fg.addColorStop(0.4, 'rgba(255, 90, 30, 0.14)');
      fg.addColorStop(1, 'rgba(255, 60, 20, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(sx, by - bh - 6 * s, 52 * s, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const ph = this.time * (5 + i) + barrel.seed + i * 2;
        const fh = (10 + Math.sin(ph) * 4 + i * 3) * s;
        const fx = sx + Math.sin(ph * 0.7) * 5 * s;
        ctx.globalAlpha = 0.6 - i * 0.11;
        ctx.fillStyle = i < 2 ? '#ffcf6a' : '#ff7a3c';
        ctx.beginPath();
        ctx.ellipse(fx, by - bh - fh * 0.55, (6 - i) * s, fh, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = '#ff9d4d';
      for (let i = 0; i < 4; i++) {
        const ph = this.time * 0.9 + i * 2 + barrel.seed;
        ctx.beginPath();
        ctx.arc(sx + Math.sin(ph) * 24 * s, by - bh - (20 + Math.sin(ph * 1.7) * 10) * s, 1.6 * s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // steam vents
    for (const vent of [{ x: 1010 }, { x: 1900 }]) {
      const sx = (vent.x - view.camX) * s + W / 2;
      if (sx < -120 || sx > W + 120) continue;
      const sy = baseline + depthPx * 0.25;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ph = (this.time * 0.2 + i * 0.3) % 1;
        const alpha = (1 - ph) * 0.055;
        const radius = (16 + ph * 46) * s;
        const gy = sy - ph * 130 * s;
        const grad = ctx.createRadialGradient(sx + Math.sin(ph * 6 + i) * 16 * s, gy, 0, sx, gy, radius);
        grad.addColorStop(0, `rgba(170, 200, 255, ${alpha})`);
        grad.addColorStop(1, 'rgba(170, 200, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, gy, radius, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawProps(ctx, view, horizon, depthPx, bake) {
    const { W, s, camX } = view;

    for (const lamp of LAMPS) {
      const sx = (lamp.x - camX) * s + W / 2;
      if (sx < -160 * s || sx > W + 160 * s) continue;
      const baseY = horizon + 10 * s;
      const topY = horizon - 230 * s;
      const armX = sx + lamp.side * 46 * s;
      ctx.save();
      ctx.strokeStyle = '#141b2d';
      ctx.lineWidth = 5 * s;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx, topY);
      ctx.quadraticCurveTo(sx, topY - 26 * s, armX, topY - 30 * s);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(150, 190, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + 2 * s, baseY);
      ctx.lineTo(sx + 2 * s, topY);
      ctx.stroke();
      ctx.fillStyle = '#1a2236';
      ctx.beginPath();
      ctx.ellipse(armX, topY - 30 * s, 12 * s, 6 * s, 0, 0, TAU);
      ctx.fill();
      const lx = armX;
      const ly = topY - 24 * s;
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 110 * s);
      glow.addColorStop(0, 'rgba(190, 235, 255, 0.46)');
      glow.addColorStop(0.25, 'rgba(120, 200, 255, 0.14)');
      glow.addColorStop(1, 'rgba(100, 180, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, ly, 110 * s, 0, TAU);
      ctx.fill();
      const cone = ctx.createLinearGradient(lx, ly, lx, baseY);
      cone.addColorStop(0, 'rgba(160, 220, 255, 0.08)');
      cone.addColorStop(1, 'rgba(160, 220, 255, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(lx - 10 * s, ly);
      ctx.lineTo(lx + 10 * s, ly);
      ctx.lineTo(lx + 120 * s, baseY + 20 * s);
      ctx.lineTo(lx - 120 * s, baseY + 20 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8f8ff';
      ctx.beginPath();
      ctx.ellipse(lx, ly, 6 * s, 3 * s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    for (const barrel of BARRELS) {
      const sx = (barrel.x - camX) * s + W / 2;
      if (sx < -100 * s || sx > W + 100 * s) continue;
      const by = horizon + 18 * s;
      const bw = 20 * s;
      const bh = 26 * s;
      ctx.save();
      const glow = ctx.createRadialGradient(sx, by - bh - 8 * s, 0, sx, by - bh - 8 * s, 52 * s);
      glow.addColorStop(0, 'rgba(255, 140, 60, 0.24)');
      glow.addColorStop(1, 'rgba(255, 90, 30, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, by - bh - 8 * s, 52 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a1a24';
      ctx.beginPath();
      ctx.ellipse(sx, by, bw, bh * 0.45, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#231a1c';
      ctx.fillRect(sx - bw, by - bh, bw * 2, bh);
      ctx.strokeStyle = 'rgba(255, 140, 70, 0.26)';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(sx - bw, by - bh * 0.7);
      ctx.lineTo(sx + bw, by - bh * 0.7);
      ctx.moveTo(sx - bw, by - bh * 0.25);
      ctx.lineTo(sx + bw, by - bh * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#0e0c12';
      ctx.beginPath();
      ctx.ellipse(sx, by - bh, bw, bh * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  drawRain(ctx, view, dt) {
    const { W, H, s } = view;
    const speedScale = clamp(dt * 60, 0.3, 1.4);
    ctx.save();
    ctx.strokeStyle = 'rgba(170, 210, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const drop of this.rain) {
      drop.x += (0.05 * drop.speed * speedScale) / Math.max(0.4, W / 1200);
      drop.y += drop.speed * speedScale * 0.024;
      if (drop.y > 1.02) {
        drop.y = -0.04;
        drop.x = Math.random();
      }
      if (drop.x > 1.02) drop.x -= 1.04;
      const x = drop.x * W;
      const y = drop.y * H;
      const len = drop.len * Math.max(0.7, s);
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * 0.22, y + len);
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.1;
    ctx.stroke();
    ctx.restore();
  }

  drawAtmosphere(ctx, view) {
    const { W, baseline, depthPx } = view;
    const horizon = this.horizonOf(view);
    // one soft fog band hugging the street; small area, additive
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const y = baseline + depthPx * 0.15;
    const grad = ctx.createRadialGradient(W / 2, y, 10, W / 2, y, W * 0.55);
    grad.addColorStop(0, 'rgba(120, 160, 240, 0.035)');
    grad.addColorStop(1, 'rgba(120, 160, 240, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(W / 2, y, W * 0.55, (horizon - y) * -1 + 160, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}
