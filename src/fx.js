import { TAU, clamp, rand, easeOutCubic, easeOutBack, pick } from './utils.js';

const MAX_PARTICLES = 440;

export class FX {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.bolts = [];
    this.arcs = [];
    this.flashes = [];
    this.screen = { alpha: 0, color: '#ffffff', decay: 1 };
    this.time = 0;
  }

  reset() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.bolts.length = 0;
    this.arcs.length = 0;
    this.flashes.length = 0;
    this.screen.alpha = 0;
  }

  addParticle(particle) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(particle);
  }

  burst(x, y, options = {}) {
    const {
      count = 12,
      color = '#66f5ff',
      speed = 380,
      angle = null,
      spread = Math.PI,
      gravity = 900,
      size = 3,
      life = 0.45,
      shape = 'spark',
      drag = 0.92,
    } = options;
    const baseAngle = angle === null ? rand(0, TAU) : angle;
    for (let i = 0; i < count; i += 1) {
      const a = baseAngle + rand(-spread / 2, spread / 2);
      const velocity = rand(speed * 0.35, speed);
      this.addParticle({
        type: shape,
        x: x + rand(-3, 3),
        y: y + rand(-3, 3),
        px: x,
        py: y,
        vx: Math.cos(a) * velocity,
        vy: Math.sin(a) * velocity,
        gravity,
        drag,
        size: rand(size * 0.45, size),
        color,
        life: rand(life * 0.55, life),
        maxLife: life,
        rot: rand(0, TAU),
        rotVel: rand(-12, 12),
      });
    }
  }

  dust(x, y, count = 8, direction = 0, color = '#7f9dc8') {
    for (let i = 0; i < count; i += 1) {
      const a = -Math.PI / 2 + rand(-0.9, 0.9) + (direction ? direction * 0.35 : 0);
      const speed = rand(30, 145);
      this.addParticle({
        type: 'dust',
        x: x + rand(-12, 12),
        y: y + rand(-3, 2),
        px: x,
        py: y,
        vx: Math.cos(a) * speed + direction * rand(10, 60),
        vy: Math.sin(a) * speed * 0.55,
        gravity: -80,
        drag: 0.9,
        size: rand(3, 9),
        color,
        life: rand(0.35, 0.75),
        maxLife: 0.75,
        rot: 0,
        rotVel: 0,
      });
    }
  }

  shards(x, y, count = 6, color = '#8ffbff', direction = 0) {
    for (let i = 0; i < count; i += 1) {
      this.addParticle({
        type: 'shard',
        x,
        y,
        px: x,
        py: y,
        vx: direction * rand(70, 350) + rand(-100, 100),
        vy: rand(-360, -120),
        gravity: 1400,
        drag: 0.98,
        size: rand(4, 11),
        color,
        life: rand(0.4, 0.8),
        maxLife: 0.8,
        rot: rand(0, TAU),
        rotVel: rand(-10, 10),
      });
    }
  }

  trail(x, y, color = '#39f5ff', size = 5, life = 0.28) {
    this.addParticle({
      type: 'trail',
      x,
      y,
      px: x,
      py: y,
      vx: rand(-8, 8),
      vy: rand(-8, 8),
      gravity: 0,
      drag: 1,
      size,
      color,
      life,
      maxLife: life,
      rot: 0,
      rotVel: 0,
    });
  }

  ring(x, y, options = {}) {
    const {
      color = '#39f5ff',
      maxRadius = 90,
      life = 0.4,
      width = 3,
      fill = false,
      squash = 0.45,
      delay = 0,
    } = options;
    this.rings.push({ x, y, r: 3, maxRadius, life, maxLife: life, width, color, fill, squash, delay });
  }

  text(x, y, value, options = {}) {
    const {
      color = '#ffffff',
      size = 19,
      life = 0.85,
      vy = -80,
      vx = 0,
      stroke = 'rgba(0,5,15,.85)',
      weight = 900,
      pop = true,
      glow = true,
    } = options;
    this.texts.push({
      x, y, value: String(value), color, size, life, maxLife: life,
      vy, vx, stroke, weight, pop, glow,
    });
  }

  bolt(x1, y1, x2, y2, options = {}) {
    const { color = '#8ffbff', life = 0.16, width = 2.2, segments = 8, jitter = 16 } = options;
    const points = [{ x: x1, y: y1 }];
    for (let i = 1; i < segments; i += 1) {
      const t = i / segments;
      points.push({
        x: x1 + (x2 - x1) * t + rand(-jitter, jitter),
        y: y1 + (y2 - y1) * t + rand(-jitter, jitter),
      });
    }
    points.push({ x: x2, y: y2 });
    this.bolts.push({ points, color, life, maxLife: life, width });
  }

  arc(x, y, options = {}) {
    const {
      angle = 0,
      radius = 70,
      spread = Math.PI * 0.8,
      color = '#8ffbff',
      life = 0.2,
      width = 5,
      inner = 0.25,
    } = options;
    this.arcs.push({ x, y, angle, radius, spread, color, life, maxLife: life, width, inner });
  }

  flash(x, y, radius = 60, color = '#e8ffff', life = 0.18) {
    this.flashes.push({ x, y, radius, color, life, maxLife: life });
  }

  screenFlash(color = '#ffffff', alpha = 0.25, decay = 4.5) {
    this.screen.color = color;
    this.screen.alpha = Math.max(this.screen.alpha, alpha);
    this.screen.decay = decay;
  }

  impact(x, y, angle, power = 1, color = '#8ffbff') {
    const strength = clamp(power, 0.35, 2.4);
    this.flash(x, y, 34 + 45 * strength, color, 0.12 + strength * 0.035);
    this.ring(x, y, { color, maxRadius: 60 + 55 * strength, life: 0.32, width: 2 + strength * 1.4, squash: 0.65 });
    this.burst(x, y, {
      count: Math.round(6 + 10 * strength),
      color,
      speed: 260 + 220 * strength,
      angle,
      spread: 1.8,
      gravity: 850,
      size: 2.6 + strength,
      life: 0.35 + strength * 0.1,
    });
    this.arc(x - Math.cos(angle) * 10, y - Math.sin(angle) * 10, {
      angle,
      radius: 26 + 34 * strength,
      spread: 1.9,
      color,
      life: 0.14,
      width: 2 + strength * 2.4,
      inner: 0.15,
    });
  }

  update(dt) {
    this.time += dt;
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.px = p.x;
      p.py = p.y;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.rotVel * dt;
      if (p.type === 'shard' && p.y > 0) {
        // shards are cut short by the caller's world floor via bounds; keep them cheap
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      if (ring.delay > 0) {
        ring.delay -= dt;
        continue;
      }
      ring.life -= dt;
      ring.r += ((ring.maxRadius - ring.r) * 10) * dt;
      if (ring.life <= 0) this.rings.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i -= 1) {
      const text = this.texts[i];
      text.life -= dt;
      if (text.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      text.x += text.vx * dt;
      text.y += text.vy * dt;
      text.vy += 150 * dt;
    }

    for (let i = this.bolts.length - 1; i >= 0; i -= 1) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }

    for (let i = this.arcs.length - 1; i >= 0; i -= 1) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }

    for (let i = this.flashes.length - 1; i >= 0; i -= 1) {
      const flash = this.flashes[i];
      flash.life -= dt;
      if (flash.life <= 0) this.flashes.splice(i, 1);
    }

    this.screen.alpha = Math.max(0, this.screen.alpha - this.screen.decay * dt);
  }

  draw(ctx, groundY) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const flash of this.flashes) {
      const t = 1 - flash.life / flash.maxLife;
      const radius = flash.radius * (0.4 + easeOutCubic(t) * 1.1);
      const gradient = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
      gradient.addColorStop(0, flash.color);
      gradient.addColorStop(0.25, `${flash.color}99`);
      gradient.addColorStop(1, `${flash.color}00`);
      ctx.globalAlpha = (1 - t) * 0.8;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(flash.x, flash.y, radius, 0, TAU);
      ctx.fill();
    }

    for (const ring of this.rings) {
      const t = 1 - ring.life / ring.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - t) * 0.8;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.width * (1 - t * 0.5);
      ctx.beginPath();
      ctx.ellipse(ring.x, ring.y, ring.r, ring.r * ring.squash, 0, 0, TAU);
      if (ring.fill) {
        ctx.fillStyle = `${ring.color}18`;
        ctx.fill();
      }
      ctx.stroke();
    }

    for (const arc of this.arcs) {
      const t = 1 - arc.life / arc.maxLife;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = arc.color;
      ctx.lineWidth = arc.width * (1 - t * 0.6);
      ctx.beginPath();
      const inner = arc.radius * arc.inner;
      ctx.arc(arc.x, arc.y, arc.radius, arc.angle - arc.spread / 2, arc.angle + arc.spread / 2);
      ctx.stroke();
      ctx.globalAlpha *= 0.3;
      ctx.beginPath();
      ctx.arc(arc.x, arc.y, inner, arc.angle - arc.spread / 2, arc.angle + arc.spread / 2);
      ctx.stroke();
    }

    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.type === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.type === 'trail') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, TAU);
        ctx.fill();
      } else if (p.type === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.1, p.size, p.size * 0.2);
        ctx.restore();
      } else if (p.type === 'dust') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a * 0.28;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.5), 0, TAU);
        ctx.fill();
      } else if (p.type === 'ember') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, TAU);
        ctx.fill();
      }
    }

    for (const bolt of this.bolts) {
      const a = clamp(bolt.life / bolt.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.strokeStyle = bolt.color;
      ctx.lineWidth = bolt.width;
      ctx.beginPath();
      ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
      for (let i = 1; i < bolt.points.length; i += 1) {
        ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = bolt.width * 4;
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
    for (const text of this.texts) {
      const t = 1 - text.life / text.maxLife;
      const pop = text.pop ? (t < 0.18 ? easeOutBack(t / 0.18) : 1) : 1;
      const alpha = t > 0.72 ? 1 - (t - 0.72) / 0.28 : 1;
      ctx.save();
      ctx.translate(text.x, text.y);
      ctx.scale(pop, pop);
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.font = `${text.weight} ${text.size}px "Bahnschrift", "Arial Black", "Liberation Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (text.glow && ctx.shadowBlur !== undefined) {
        ctx.shadowColor = text.color;
        ctx.shadowBlur = 12;
      }
      ctx.lineWidth = Math.max(3, text.size * 0.16);
      ctx.strokeStyle = text.stroke;
      ctx.strokeText(text.value, 0, 0);
      ctx.fillStyle = text.color;
      ctx.fillText(text.value, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  drawScreen(ctx, width, height) {
    if (this.screen.alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = clamp(this.screen.alpha, 0, 0.7);
    ctx.fillStyle = this.screen.color;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
