import { TAU, clamp, rand, pick, easeOutCubic } from './utils.js';

export class Particles {
  constructor(limit = 520) {
    this.list = [];
    this.texts = [];
    this.limit = limit;
  }

  clear() {
    this.list.length = 0;
    this.texts.length = 0;
  }

  add(p) {
    if (this.list.length >= this.limit) this.list.shift();
    this.list.push({
      x: 0, y: 0.5, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0.5, maxLife: 0.5,
      size: 2, grow: 0,
      color: '#ffffff', type: 'spark',
      gravity: 0, drag: 2,
      rot: 0, vr: 0,
      alpha: 1, additive: true,
      width: 2,
      ...p,
    });
  }

  burst(x, y, z, opts = {}) {
    const {
      count = 10,
      speed = 220,
      spread = TAU,
      angle = 0,
      colors = ['#ffffff'],
      size = [2, 4],
      life = [0.2, 0.5],
      gravity = 900,
      drag = 3,
      type = 'spark',
      additive = true,
      grow = 0,
      zSpread = 0.5,
      width = [1.5, 3],
    } = opts;
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-spread / 2, spread / 2);
      const s = speed * rand(0.3, 1.1);
      const l = rand(life[0], life[1]);
      this.add({
        x, y, z,
        vx: Math.cos(a) * s,
        vy: rand(-0.25, 0.25) * s * zSpread,
        vz: Math.sin(a) * s * (type === 'dust' ? 0.3 : 0.85),
        life: l, maxLife: l,
        size: rand(size[0], size[1]),
        grow,
        color: pick(colors),
        type,
        gravity,
        drag,
        additive,
        width: rand(width[0], width[1]),
        rot: rand(0, TAU),
        vr: rand(-12, 12),
      });
    }
  }

  dust(x, y, count = 6, color = 'rgba(170, 190, 220, 0.5)') {
    for (let i = 0; i < count; i++) {
      const a = rand(-Math.PI, 0);
      const s = rand(40, 130);
      const l = rand(0.25, 0.6);
      this.add({
        x: x + rand(-16, 16), y, z: rand(0, 8),
        vx: Math.cos(a) * s,
        vy: rand(-0.02, 0.02),
        vz: rand(30, 110),
        life: l, maxLife: l,
        size: rand(4, 11), grow: 22,
        color, type: 'dust', gravity: -10, drag: 2.5,
        additive: false, alpha: 0.55,
      });
    }
  }

  ring(x, y, z, color, size = 18, life = 0.3, grow = 240) {
    this.add({
      x, y, z, life, maxLife: life, size, grow,
      color, type: 'ring', gravity: 0, drag: 0,
      additive: true, width: 3,
    });
  }

  text(x, y, z, text, opts = {}) {
    const life = opts.life ?? 0.8;
    this.texts.push({
      x, y, z, text,
      life, maxLife: life,
      vy: opts.vy ?? -0.9,
      color: opts.color ?? '#ffffff',
      size: opts.size ?? 22,
      font: opts.font ?? 'display',
      italic: opts.italic ?? true,
      shadow: opts.shadow ?? true,
      drift: opts.drift ?? rand(-0.15, 0.15),
      rot: opts.rot ?? rand(-0.05, 0.05),
    });
    if (this.texts.length > 24) this.texts.shift();
  }

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= p.gravity * dt;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.vz *= drag;
      p.rot += p.vr * dt;
      p.size = Math.max(0.1, p.size + p.grow * dt);
      if (p.z < 0) {
        p.z = 0;
        p.vz *= -0.32;
        p.vx *= 0.7;
        if (Math.abs(p.vz) < 12) p.vz = 0;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.age = (t.age || 0) + dt;
      t.y += t.vy * dt * 0.05;
      t.z += Math.abs(t.vy) * 55 * dt;
      t.x += t.drift * dt * 10;
    }
  }

  draw(ctx, project) {
    ctx.save();
    for (const p of this.list) {
      const { sx, sy, s } = project(p.x, p.y, p.z);
      const k = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = k * p.alpha;
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      if (p.type === 'ring') {
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.5, p.size * s), 0, TAU);
        ctx.lineWidth = Math.max(0.5, p.width * s * k);
        ctx.stroke();
      } else if (p.type === 'spark') {
        const vx = p.vx * 0.03 * s;
        const vy = (-p.vz * 0.03 + p.vy * 10) * s;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - vx, sy - vy);
        ctx.lineWidth = Math.max(0.7, p.width * s * (0.4 + k * 0.8));
        ctx.stroke();
      } else if (p.type === 'shard') {
        const size = p.size * s;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillRect(-size / 2, -size / 6, size, size / 3);
        ctx.restore();
      } else if (p.type === 'dust') {
        ctx.globalAlpha = k * p.alpha * 0.55;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.5, p.size * s), 0, TAU);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.6, p.size * s), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  drawTexts(ctx, project) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const { sx, sy, s } = project(t.x, t.y, t.z);
      const k = clamp(t.life / t.maxLife, 0, 1);
      const pop = t.age < 0.12 ? easeOutCubic(t.age / 0.12) : 1;
      const size = t.size * s * (0.7 + pop * 0.3) * (1 + (1 - k) * 0.12);
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.font = t.font === 'mono'
        ? `700 ${size}px ui-monospace, Menlo, monospace`
        : `italic 900 ${size}px "Arial Black", "Helvetica Neue", sans-serif`;
      if (t.shadow) {
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 12 * s;
      }
      ctx.fillStyle = t.color;
      if (t.italic) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t.rot);
        ctx.fillText(t.text, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(t.text, sx, sy);
      }
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}
