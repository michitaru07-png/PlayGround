import { TAU, clamp, rand, randInt, pick, pulse } from './utils.js';

function seeded(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export class Scene {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.groundY = 0;
    this.left = 0;
    this.right = 0;
    this.time = 0;
    this.stars = [];
    this.far = [];
    this.mid = [];
    this.rain = [];
    this.embers = [];
    this.cracks = [];
    this.puddles = [];
    this.cables = [];
    this.wallPulse = { left: 0, right: 0 };
    this.lightning = 0;
    this.nextLightning = rand(8, 20);
  }

  resize(width, height, groundY, left, right) {
    this.w = width;
    this.h = height;
    this.groundY = groundY;
    this.left = left;
    this.right = right;
    const random = seeded(Math.round(width * 13 + height * 7));
    const horizon = groundY - 8;

    this.stars = Array.from({ length: 72 }, () => ({
      x: random() * width,
      y: random() * horizon * 0.62,
      r: 0.4 + random() * 1.2,
      a: 0.18 + random() * 0.55,
      twinkle: random() * TAU,
    }));

    this.far = this.makeCity(random, horizon, 17, 48, 170, width * 0.3);
    this.mid = this.makeCity(random, horizon, 12, 62, 250, width * 0.18);
    this.rain = Array.from({ length: Math.round(clamp(width / 16, 40, 110)) }, () => ({
      x: random() * width,
      y: random() * height,
      len: 7 + random() * 17,
      speed: 260 + random() * 320,
      alpha: 0.04 + random() * 0.13,
    }));
    this.embers = Array.from({ length: Math.round(clamp(width / 28, 18, 46)) }, () => ({
      x: random() * width,
      y: groundY - random() * height * 0.55,
      r: 0.5 + random() * 1.4,
      speed: 5 + random() * 16,
      drift: random() * TAU,
      alpha: 0.08 + random() * 0.3,
      hue: random() > 0.6 ? 'cyan' : random() > 0.4 ? 'pink' : 'gold',
    }));
    this.cracks = Array.from({ length: 9 }, () => ({
      x: left + random() * (right - left),
      y: groundY + 18 + random() * (height - groundY - 20),
      len: 18 + random() * 60,
      angle: random() * TAU,
      fork: random() > 0.5,
    }));
    this.puddles = Array.from({ length: 5 }, () => ({
      x: left + random() * (right - left),
      y: groundY + 25 + random() * Math.max(30, height - groundY - 60),
      rx: 34 + random() * 90,
      ry: 5 + random() * 11,
      color: pick(['#2a7dff', '#ff3ea5', '#39f5ff']),
      alpha: 0.08 + random() * 0.09,
    }));
    this.cables = [
      { x1: -20, y1: height * 0.12, x2: width * 0.52, y2: height * 0.2, sag: 26 + random() * 24 },
      { x1: width * 0.38, y1: height * 0.06, x2: width + 20, y2: height * 0.16, sag: 18 + random() * 34 },
      { x1: width * 0.72, y1: -10, x2: width * 1.04, y2: height * 0.34, sag: 22 },
    ];
  }

  makeCity(random, horizon, count, minWidth, maxHeight, spread) {
    const buildings = [];
    let x = -30;
    for (let i = 0; i < count; i += 1) {
      const width = minWidth * (0.55 + random() * 1.15);
      const height = 40 + Math.pow(random(), 1.7) * maxHeight;
      const building = {
        x,
        y: horizon - height,
        w: width,
        h: height,
        seed: Math.floor(random() * 100000),
        antenna: random() > 0.68,
        tank: random() > 0.82,
        sign: random() > 0.78,
      };
      buildings.push(building);
      x += width + 2 + random() * 13;
    }
    const total = x;
    const scale = (this.w + 60) / total;
    for (const building of buildings) {
      building.x *= scale;
      building.w *= scale * (0.92 + random() * 0.15);
      building.h *= 0.7 + (spread / this.w) * 0.25;
      building.y = horizon - building.h;
    }
    return buildings;
  }

  pulseWall(side, strength = 0.6) {
    if (side === 'left') this.wallPulse.left = Math.max(this.wallPulse.left, strength);
    if (side === 'right') this.wallPulse.right = Math.max(this.wallPulse.right, strength);
  }

  update(dt) {
    this.time += dt;
    const heightSpan = Math.max(120, this.groundY);
    for (const drop of this.rain) {
      drop.y += drop.speed * dt;
      drop.x -= drop.speed * 0.12 * dt;
      if (drop.y > this.h + 20) {
        drop.y = -20;
        drop.x = rand(0, this.w + 100);
      }
      if (drop.x < -30) drop.x = this.w + 20;
    }
    for (const ember of this.embers) {
      ember.y -= ember.speed * dt;
      ember.x += Math.sin(this.time * 0.7 + ember.drift) * 8 * dt;
      if (ember.y < this.groundY - heightSpan) {
        ember.y = this.groundY + rand(-10, 20);
        ember.x = rand(0, this.w);
      }
    }
    this.wallPulse.left = Math.max(0, this.wallPulse.left - dt * 1.7);
    this.wallPulse.right = Math.max(0, this.wallPulse.right - dt * 1.7);
    this.lightning = Math.max(0, this.lightning - dt * 3.2);
    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.nextLightning = rand(11, 26);
      this.lightning = 1;
    }
  }

  draw(ctx) {
    const { w, h, groundY, left, right } = this;
    const horizon = groundY - 6;
    const sway = 0;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#020409');
    sky.addColorStop(0.42, '#061020');
    sky.addColorStop(0.72, '#0a1b36');
    sky.addColorStop(0.9, '#122a4a');
    sky.addColorStop(1, '#173257');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY + 2);

    // Atmospheric bands
    const haze = ctx.createLinearGradient(0, horizon - h * 0.36, 0, horizon);
    haze.addColorStop(0, 'rgba(24, 89, 150, 0)');
    haze.addColorStop(0.6, 'rgba(22, 92, 150, 0.08)');
    haze.addColorStop(1, 'rgba(57, 160, 220, 0.14)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - h * 0.36, w, h * 0.36);

    // Stars
    for (const star of this.stars) {
      const twinkle = 0.55 + Math.sin(this.time * 1.2 + star.twinkle) * 0.45;
      ctx.globalAlpha = star.a * twinkle;
      ctx.fillStyle = star.x > w * 0.55 ? '#c8f6ff' : '#d8e6ff';
      ctx.beginPath();
      ctx.arc(star.x + sway, star.y, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon
    this.drawMoon(ctx, w * 0.76, h * 0.155, clamp(w * 0.044, 30, 64));

    // Lightning flash in distant clouds
    if (this.lightning > 0) {
      ctx.save();
      ctx.globalAlpha = this.lightning * 0.18;
      ctx.fillStyle = '#a8e6ff';
      ctx.fillRect(0, 0, w, horizon);
      ctx.restore();
    }

    // Far skyline
    this.drawSkyline(ctx, this.far, '#061020', 'rgba(76, 180, 255, 0.2)', 0.25);
    this.drawCables(ctx);

    // Mid skyline
    this.drawSkyline(ctx, this.mid, '#040b16', 'rgba(255, 185, 96, 0.22)', 0.55);
    this.drawNeonSigns(ctx);

    // Fog / horizon glow
    const fog = ctx.createLinearGradient(0, horizon - 70, 0, horizon + 8);
    fog.addColorStop(0, 'rgba(30, 108, 178, 0)');
    fog.addColorStop(0.7, 'rgba(30, 108, 178, 0.1)');
    fog.addColorStop(1, 'rgba(44, 146, 214, 0.18)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, horizon - 70, w, 78);

    this.drawFloor(ctx);
    this.drawWalls(ctx);
    this.drawRain(ctx);

    // Floating embers
    for (const ember of this.embers) {
      const color = ember.hue === 'cyan' ? 'rgba(100, 240, 255,' : ember.hue === 'pink' ? 'rgba(255, 100, 180,' : 'rgba(255, 200, 110,';
      ctx.fillStyle = `${color}${ember.alpha})`;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, ember.r, 0, TAU);
      ctx.fill();
    }

    // Ambient vignette glow near arena
    const arenaGlow = ctx.createRadialGradient(w / 2, groundY, 20, w / 2, groundY, w * 0.62);
    arenaGlow.addColorStop(0, 'rgba(60, 180, 255, 0.055)');
    arenaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = arenaGlow;
    ctx.fillRect(0, groundY - h * 0.5, w, h * 0.5 + 20);
  }

  drawMoon(ctx, x, y, radius) {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 3.4);
    glow.addColorStop(0, 'rgba(160, 230, 255, 0.16)');
    glow.addColorStop(0.4, 'rgba(110, 190, 255, 0.06)');
    glow.addColorStop(1, 'rgba(60, 130, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3.4, 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    const body = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    body.addColorStop(0, 'rgba(230, 252, 255, 0.95)');
    body.addColorStop(0.6, 'rgba(158, 222, 244, 0.82)');
    body.addColorStop(1, 'rgba(84, 142, 182, 0.5)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#4b7a9d';
    const craters = [
      [-0.28, -0.15, 0.22],
      [0.2, 0.24, 0.16],
      [0.36, -0.34, 0.1],
      [-0.05, 0.42, 0.09],
    ];
    for (const [cx, cy, cr] of craters) {
      ctx.beginPath();
      ctx.arc(x + cx * radius, y + cy * radius, cr * radius, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawSkyline(ctx, buildings, color, windowColor, heightScale) {
    for (const building of buildings) {
      ctx.fillStyle = color;
      ctx.fillRect(building.x, building.y, building.w, building.h + 10);

      // Top edge highlight
      ctx.fillStyle = 'rgba(90, 180, 255, 0.12)';
      ctx.fillRect(building.x, building.y, building.w, 1);

      if (building.antenna) {
        ctx.strokeStyle = 'rgba(80, 140, 200, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(building.x + building.w * 0.6, building.y);
        ctx.lineTo(building.x + building.w * 0.6, building.y - 12 - building.h * 0.08);
        ctx.stroke();
        if (Math.sin(this.time * 2 + building.seed) > 0.2) {
          ctx.fillStyle = 'rgba(255, 70, 80, 0.8)';
          ctx.fillRect(building.x + building.w * 0.6 - 1, building.y - 14 - building.h * 0.08, 2, 2);
        }
      }

      if (building.tank) {
        ctx.fillStyle = 'rgba(5, 13, 26, 0.85)';
        const tw = building.w * 0.3;
        ctx.fillRect(building.x + building.w * 0.2, building.y - 10, tw, 10);
        ctx.fillRect(building.x + building.w * 0.23, building.y - 2, 2, 12);
        ctx.fillRect(building.x + building.w * 0.2 + tw - 4, building.y - 2, 2, 12);
      }

      const random = seeded(building.seed);
      const cols = Math.max(1, Math.floor(building.w / 13));
      const rows = Math.max(1, Math.floor(building.h / 16));
      const winW = Math.max(1.5, building.w / cols * 0.36);
      const winH = Math.max(1.4, building.h / rows * 0.3);
      ctx.fillStyle = windowColor;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (random() > 0.78) {
            const x = building.x + (col + 0.32) * (building.w / cols);
            const y = building.y + (row + 0.34) * (building.h / rows);
            ctx.globalAlpha = 0.25 + random() * 0.65;
            ctx.fillRect(x, y, winW, winH);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  drawCables(ctx) {
    for (const cable of this.cables) {
      const midX = (cable.x1 + cable.x2) / 2;
      const midY = (cable.y1 + cable.y2) / 2 + cable.sag;
      ctx.strokeStyle = 'rgba(2, 4, 8, 0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cable.x1, cable.y1);
      ctx.quadraticCurveTo(midX, midY, cable.x2, cable.y2);
      ctx.stroke();
      for (let i = 1; i < 5; i += 1) {
        const t = i / 5;
        const x = (1 - t) * (1 - t) * cable.x1 + 2 * (1 - t) * t * midX + t * t * cable.x2;
        const y = (1 - t) * (1 - t) * cable.y1 + 2 * (1 - t) * t * midY + t * t * cable.y2;
        ctx.fillStyle = i % 2 ? 'rgba(57, 245, 255, 0.5)' : 'rgba(255, 62, 165, 0.4)';
        ctx.beginPath();
        ctx.arc(x, y + 4, 1.4, 0, TAU);
        ctx.fill();
      }
    }
  }

  drawNeonSigns(ctx) {
    const { w, groundY } = this;
    const bob = Math.sin(this.time * 1.4) * 2;

    // Vertical magenta kanji-style sign
    this.drawVerticalSign(ctx, w * 0.135, groundY - 322 + bob, 42, 142, ['雷', '光', '拳'], '#ff3ea5', 0.85);
    // Vertical cyan sign
    this.drawVerticalSign(ctx, w * 0.845, groundY - 260 - bob, 34, 108, ['N', 'E', 'O', 'N'], '#39f5ff', 0.5);

    // Horizontal billboard
    const bx = w * 0.62;
    const by = groundY - 270;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(4, 8, 16, 0.9)';
    ctx.fillRect(bx, by, 132, 34);
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, 131, 33);
    ctx.font = '800 12px "Bahnschrift", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 211, 77, 0.85)';
    ctx.shadowColor = 'rgba(255, 180, 40, 0.8)';
    ctx.shadowBlur = 12;
    ctx.fillText('FIGHT / 24H', bx + 66, by + 18);
    ctx.restore();

    // Small red panes
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = 'rgba(255, 60, 90, 0.22)';
      const x = w * (0.29 + i * 0.035);
      ctx.fillRect(x, groundY - 185 - i * 9, 4, 4);
    }
  }

  drawVerticalSign(ctx, x, y, width, height, glyphs, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(3, 6, 13, 0.92)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    ctx.font = `700 ${width * 0.58}px "Bahnschrift", "Arial Black", "Noto Sans CJK JP", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    const step = height / glyphs.length;
    glyphs.forEach((glyph, index) => {
      const flicker = Math.sin(this.time * 9 + index * 2.3) > 0.94 ? 0.3 : 1;
      ctx.globalAlpha = alpha * flicker;
      ctx.fillText(glyph, x + width / 2, y + step * (index + 0.55));
    });
    ctx.restore();
  }

  drawFloor(ctx) {
    const { w, h, groundY, left, right } = this;

    // Floor base
    const floor = ctx.createLinearGradient(0, groundY, 0, h);
    floor.addColorStop(0, '#10192b');
    floor.addColorStop(0.12, '#0a1221');
    floor.addColorStop(0.65, '#060b15');
    floor.addColorStop(1, '#03060d');
    ctx.fillStyle = floor;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Warm reflected light from city
    const reflected = ctx.createLinearGradient(0, groundY, 0, h);
    reflected.addColorStop(0, 'rgba(52, 130, 200, 0.13)');
    reflected.addColorStop(0.5, 'rgba(24, 82, 150, 0.03)');
    reflected.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = reflected;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Puddles
    for (const puddle of this.puddles) {
      const gradient = ctx.createRadialGradient(puddle.x, puddle.y, 2, puddle.x, puddle.y, puddle.rx);
      gradient.addColorStop(0, `${puddle.color}${Math.round(puddle.alpha * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, `${puddle.color}00`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(puddle.x, puddle.y, puddle.rx, puddle.ry, 0, 0, TAU);
      ctx.fill();
    }

    // Perspective floor seams
    ctx.strokeStyle = 'rgba(93, 165, 230, 0.055)';
    ctx.lineWidth = 1;
    const vanishingX = w / 2;
    for (let i = 0; i <= 14; i += 1) {
      const t = i / 14;
      const x = left - (w * 0.25) + t * (right - left + w * 0.5);
      ctx.beginPath();
      ctx.moveTo(vanishingX + (x - vanishingX) * 0.08, groundY + 2);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let i = 1; i <= 5; i += 1) {
      const t = i / 6;
      const y = groundY + (h - groundY) * t * t;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Cracks
    ctx.strokeStyle = 'rgba(2, 4, 9, 0.8)';
    ctx.lineWidth = 1.3;
    for (const crack of this.cracks) {
      ctx.beginPath();
      ctx.moveTo(crack.x, crack.y);
      ctx.lineTo(crack.x + Math.cos(crack.angle) * crack.len, crack.y + Math.sin(crack.angle) * crack.len * 0.22);
      if (crack.fork) {
        ctx.moveTo(crack.x + Math.cos(crack.angle) * crack.len * 0.5, crack.y + Math.sin(crack.angle) * crack.len * 0.11);
        ctx.lineTo(crack.x + Math.cos(crack.angle + 0.6) * crack.len * 0.7, crack.y + Math.sin(crack.angle + 0.6) * crack.len * 0.2);
      }
      ctx.stroke();
    }

    // Ground edge line
    const edge = ctx.createLinearGradient(0, groundY, w, groundY);
    edge.addColorStop(0, 'rgba(57, 245, 255, 0.1)');
    edge.addColorStop(0.18, 'rgba(57, 245, 255, 0.7)');
    edge.addColorStop(0.5, 'rgba(140, 250, 255, 0.92)');
    edge.addColorStop(0.82, 'rgba(57, 245, 255, 0.7)');
    edge.addColorStop(1, 'rgba(57, 245, 255, 0.1)');
    ctx.save();
    ctx.shadowColor = 'rgba(57, 245, 255, 0.7)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = edge;
    ctx.fillRect(left - 10, groundY - 1, right - left + 20, 2);
    ctx.restore();

    // Hazard edge strips
    this.drawHazard(ctx, left - 40, groundY + 7, 42, 7);
    this.drawHazard(ctx, right, groundY + 7, 42, 7);

    // Floor reflection of neon
    const centerGlow = ctx.createRadialGradient(w / 2, groundY + 14, 10, w / 2, groundY + 14, w * 0.34);
    centerGlow.addColorStop(0, 'rgba(68, 220, 255, 0.1)');
    centerGlow.addColorStop(1, 'rgba(68, 220, 255, 0)');
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.ellipse(w / 2, groundY + 22, w * 0.34, 34, 0, 0, TAU);
    ctx.fill();
  }

  drawHazard(ctx, x, y, width, height) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 203, 54, 0.22)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = 'rgba(8, 10, 14, 0.7)';
    for (let i = -height; i < width + height; i += 12) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + height);
      ctx.lineTo(x + i + height, y);
      ctx.lineTo(x + i + height + 6, y);
      ctx.lineTo(x + i + 6, y + height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawWalls(ctx) {
    const { w, groundY, left, right } = this;

    // Physical wall blocks on both sides (outside the playable arena)
    const wallGradient = ctx.createLinearGradient(0, 0, left, 0);
    wallGradient.addColorStop(0, 'rgba(4, 8, 16, 0.96)');
    wallGradient.addColorStop(1, 'rgba(9, 18, 34, 0.85)');
    ctx.fillStyle = wallGradient;
    ctx.fillRect(0, groundY - 420, left, 424);
    const wallGradientR = ctx.createLinearGradient(right, 0, w, 0);
    wallGradientR.addColorStop(0, 'rgba(9, 18, 34, 0.85)');
    wallGradientR.addColorStop(1, 'rgba(4, 8, 16, 0.96)');
    ctx.fillStyle = wallGradientR;
    ctx.fillRect(right, groundY - 420, w - right, 424);

    // Wall panels & rivets
    ctx.strokeStyle = 'rgba(120, 170, 220, 0.07)';
    ctx.lineWidth = 1;
    for (let y = groundY - 400; y < groundY; y += 44) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(left, y);
      ctx.moveTo(right, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Energy barrier edges
    this.drawBarrier(ctx, left, groundY, 'left', this.wallPulse.left);
    this.drawBarrier(ctx, right, groundY, 'right', this.wallPulse.right);

    // Inward chevrons make the parkour walls readable at a glance
    this.drawWallChevrons(ctx, left, groundY, 'left', this.wallPulse.left);
    this.drawWallChevrons(ctx, right, groundY, 'right', this.wallPulse.right);

    // Vertical neon rails
    const railLength = Math.min(360, groundY - 40);
    ctx.save();
    ctx.shadowColor = 'rgba(57,245,255,.8)';
    ctx.shadowBlur = 14;
    const railGradient = ctx.createLinearGradient(0, groundY - railLength, 0, groundY);
    railGradient.addColorStop(0, 'rgba(57,245,255,0)');
    railGradient.addColorStop(0.55, 'rgba(57,245,255,.4)');
    railGradient.addColorStop(1, 'rgba(180,255,255,.9)');
    ctx.fillStyle = railGradient;
    ctx.fillRect(left - 2, groundY - railLength, 2, railLength);
    ctx.fillRect(right, groundY - railLength, 2, railLength);
    ctx.restore();

    // Wall graffiti / signage
    ctx.save();
    ctx.translate(left + 13, groundY - 115);
    ctx.rotate(-Math.PI / 2);
    ctx.font = '900 10px "Bahnschrift", "Arial Black", sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillStyle = 'rgba(255, 62, 165, 0.35)';
    ctx.fillText('SALTO DE PARED', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(right - 15, groundY - 150);
    ctx.rotate(Math.PI / 2);
    ctx.font = '900 9px "Bahnschrift", "Arial Black", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillStyle = 'rgba(57, 245, 255, 0.3)';
    ctx.fillText('WALL JUMP', 0, 0);
    ctx.restore();
  }

  drawWallChevrons(ctx, x, groundY, side, pulseAmount) {
    const dir = side === 'left' ? 1 : -1;
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 250, 255, 0.24)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(x + dir * 7, groundY - 26);
    ctx.lineTo(x + dir * 7, groundY - 224);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < 4; i += 1) {
      const y = groundY - 36 - i * 46;
      const flicker = 0.72 + Math.sin(this.time * 2.2 + i * 0.9) * 0.28;
      const alpha = clamp((0.2 + pulseAmount * 0.7) * flicker * (1 - i * 0.12), 0, 1);
      ctx.strokeStyle = `rgba(150, 252, 255, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#39f5ff';
      ctx.shadowBlur = 6 + pulseAmount * 12;
      ctx.beginPath();
      ctx.moveTo(x + dir * 5, y - 8);
      ctx.lineTo(x + dir * 18, y);
      ctx.lineTo(x + dir * 5, y + 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBarrier(ctx, x, groundY, side, pulseAmount) {
    const height = 200;
    const dir = side === 'left' ? 1 : -1;
    const base = 0.1 + pulseAmount * 0.5;
    ctx.save();
    const gradient = ctx.createLinearGradient(x, groundY - height, x, groundY);
    gradient.addColorStop(0, `rgba(57,245,255,0)`);
    gradient.addColorStop(0.7, `rgba(57,245,255,${base * 0.5})`);
    gradient.addColorStop(1, `rgba(120,250,255,${base})`);
    ctx.fillStyle = gradient;
    const width = 22 + pulseAmount * 24;
    ctx.fillRect(x - (side === 'right' ? width : 0), groundY - height, width, height);

    // Energy scan lines
    ctx.strokeStyle = `rgba(120, 250, 255, ${0.08 + pulseAmount * 0.6})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const offset = ((this.time * 60 + i * 34) % height);
      const y = groundY - offset;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * (24 + pulseAmount * 30), y - 4);
      ctx.stroke();
    }

    if (pulseAmount > 0.1) {
      ctx.strokeStyle = `rgba(160, 252, 255, ${pulseAmount * 0.8})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#39f5ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      for (let i = 0; i <= 12; i += 1) {
        const y = groundY - (i / 12) * height;
        const jitter = Math.sin(this.time * 50 + i * 2.7) * pulseAmount * 8;
        if (i === 0) ctx.moveTo(x + jitter, y);
        else ctx.lineTo(x + jitter, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRain(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 205, 255, 0.4)';
    ctx.lineWidth = 0.8;
    for (const drop of this.rain) {
      ctx.globalAlpha = drop.alpha;
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.len * 0.14, drop.y + drop.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawForeground(ctx) {
    const { w, h, groundY } = this;
    // Low foreground haze
    const foreground = ctx.createLinearGradient(0, h - 100, 0, h);
    foreground.addColorStop(0, 'rgba(2, 4, 10, 0)');
    foreground.addColorStop(1, 'rgba(1, 3, 8, 0.62)');
    ctx.fillStyle = foreground;
    ctx.fillRect(0, h - 100, w, 100);

    // Rear guardrail, subtle silhouette
    ctx.strokeStyle = 'rgba(4, 8, 15, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 74);
    ctx.lineTo(w, groundY + 74);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(57, 245, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 66);
    ctx.lineTo(w, groundY + 66);
    ctx.stroke();
    for (let x = 22; x < w; x += 118) {
      ctx.strokeStyle = 'rgba(3, 6, 12, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, groundY + 62);
      ctx.lineTo(x, groundY + 76);
      ctx.stroke();
    }
  }
}
