import { TAU, clamp, rand, randInt, sign, approach, easeOutCubic } from './utils.js';

const PALETTES = {
  red: {
    main: '#ff4a5e',
    light: '#ffd0d6',
    accent: '#ff1744',
    back: '#9d1026',
    glow: '#ff3b4e',
    outline: 'rgba(26, 1, 6, 0.96)',
  },
  gold: {
    main: '#ffd34d',
    light: '#fff6c4',
    accent: '#ff9a1f',
    back: '#b47c12',
    glow: '#ffc400',
    outline: 'rgba(27, 17, 1, 0.96)',
  },
  green: {
    main: '#53ff9a',
    light: '#d4ffe6',
    accent: '#c9ff4d',
    back: '#157c4b',
    glow: '#53ff9a',
    outline: 'rgba(1, 24, 12, 0.96)',
  },
};

let NEXT_ID = 1;

export class Enemy {
  constructor(game, type, options = {}) {
    this.game = game;
    this.unit = game.unit;
    this.id = `enemy-${NEXT_ID++}`;
    this.type = type;
    this.heavy = type === 'heavy';
    this.variant = options.variant || (this.heavy ? 'gold' : 'red');
    this.player = false;
    this.isPlayer = false;
    this.scale = (this.heavy ? 1.2 : 0.98) * this.unit;
    this.radius = (this.heavy ? 20 : 15) * this.unit;
    this.maxHp = this.heavy ? 108 + game.wave * 7 : 34 + game.wave * 4;
    this.hp = this.maxHp;
    this.damage = this.heavy ? 12 + Math.min(5, game.wave * 0.4) : 6 + Math.min(3, game.wave * 0.25);
    this.attackRange = (this.heavy ? 96 : 72) * this.unit;
    this.speed = (this.heavy ? 92 : 160 + Math.random() * 22) * this.unit;
    this.windup = (this.heavy ? 0.72 : 0.34) * (options.variant ? 1 : 1);
    this.attackDuration = this.heavy ? 0.42 : 0.3;
    this.recovery = this.heavy ? 0.62 : 0.28;
    this.cooldown = rand(0.2, 0.9);
    this.x = options.x ?? game.width / 2;
    this.y = options.y ?? game.groundY;
    this.spawnSide = options.side || (Math.random() > 0.5 ? 'left' : 'right');
    this.spawnMode = options.spawnMode || 'walk';
    this.vx = 0;
    this.vy = 0;
    this.facing = this.spawnSide === 'left' ? 1 : -1;
    this.onGround = this.spawnMode !== 'drop';
    this.state = 'spawn';
    this.stateTime = 0;
    this.stateDuration = this.spawnMode === 'drop' ? 0 : 0.8;
    this.animTime = rand(0, 10);
    this.flash = 0;
    this.shieldFlash = 0;
    this.alpha = 1;
    this.rot = 0;
    this.rotVel = 0;
    this.ragdollTimer = 0;
    this.settleTimer = 0;
    this.deadTimer = 0;
    this.countedDead = false;
    this.armored = this.heavy;
    this.grabbedBy = null;
    this.thrown = false;
    this.hitCooldown = 0;
    this.hitSet = new Set();
    this.palette = PALETTES[this.variant] || PALETTES.red;
    this.seed = rand(0, 100);
    this.attackHit = false;
    this.lastHitKind = null;
    this.taunt = 0;
    this.armoredPulse = rand(0, TAU);
    this.deathY = 0;
    this.spawnRing = 0;
  }

  setState(name, duration = 0) {
    this.state = name;
    this.stateTime = 0;
    this.stateDuration = duration;
    if (name === 'ragdoll') {
      this.hitSet.clear();
      this.settleTimer = 0;
    }
  }

  get height() {
    return (this.heavy ? 165 : 140) * this.scale;
  }

  update(dt, player) {
    this.animTime += dt;
    this.stateTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 4);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    if (this.state === 'grabbed') {
      this.alpha = 1;
      return;
    }

    if (this.state === 'ragdoll' || this.state === 'dead') {
      this.updateRagdoll(dt);
      return;
    }

    if (this.state === 'spawn') {
      this.updateSpawn(dt, player);
      return;
    }

    if (this.state === 'hurt') {
      this.vx *= Math.pow(0.02, dt);
      this.gravity(dt);
      if (this.stateTime >= this.stateDuration) this.setState('approach');
      this.integrate(dt);
      return;
    }

    if (this.state === 'windup') {
      this.vx *= Math.pow(0.03, dt);
      this.facing = player.x >= this.x ? 1 : -1;
      this.gravity(dt);
      this.integrate(dt);
      if (this.stateTime >= this.stateDuration) {
        this.state = 'attack';
        this.stateTime = 0;
        this.stateDuration = this.attackDuration;
        this.attackHit = false;
        this.attackKind = this.heavy ? 'heavy' : 'light';
        this.vx = this.facing * (this.heavy ? 170 : 360) * this.unit;
        this.game.audio.whoosh(this.heavy ? 1.1 : 0.5);
      }
      return;
    }

    if (this.state === 'attack') {
      this.updateAttack(dt, player);
      return;
    }

    if (this.state === 'recover') {
      this.vx *= Math.pow(0.02, dt);
      this.gravity(dt);
      this.integrate(dt);
      if (this.stateTime >= this.stateDuration) {
        this.cooldown = this.heavy ? rand(1.1, 1.8) : rand(0.55, 1.3);
        this.setState('approach');
      }
      return;
    }

    if (this.state === 'approach' || this.state === 'idle') {
      this.updateApproach(dt, player);
    }
  }

  gravity(dt) {
    if (!this.onGround) this.vy += 2100 * this.unit * dt;
  }

  integrate(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= this.game.groundY) {
      this.y = this.game.groundY;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this.x = clamp(this.x, this.game.left - 30 * this.unit, this.game.right + 30 * this.unit);
  }

  updateSpawn(dt, player) {
    if (this.spawnMode === 'drop') {
      this.vy += 2600 * this.unit * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.y >= this.game.groundY) {
        this.y = this.game.groundY;
        this.vy = 0;
        this.onGround = true;
        this.setState('approach');
        this.cooldown = 0.9;
        const color = this.palette.main;
        this.game.fx.ring(this.x, this.game.groundY, {
          color,
          maxRadius: 140 * this.unit,
          life: 0.55,
          width: 4,
          squash: 0.24,
        });
        this.game.fx.dust(this.x, this.game.groundY, 20, 0, '#a3c9e8');
        this.game.fx.shards(this.x, this.game.groundY, 8, color, 0);
        this.game.shake(12, 0.3);
        this.game.audio.slam();
        this.game.fx.text(this.x, this.y - 185 * this.unit, 'PESADO', {
          color,
          size: 15,
          life: 0.9,
          vy: -35,
        });
      }
      return;
    }

    const targetX = this.game.width / 2;
    const dir = targetX >= this.x ? 1 : -1;
    this.facing = dir;
    this.x += dir * this.speed * 1.25 * dt;
    this.vx = dir * this.speed;
    if (this.x > this.game.left + 65 * this.unit && this.x < this.game.right - 65 * this.unit) {
      this.setState('approach');
      this.cooldown = rand(0.15, 0.55);
    }
    if (this.stateTime > 2.5) this.setState('approach');
  }

  updateApproach(dt, player) {
    this.cooldown -= dt;
    const dx = player.x - this.x;
    const distance = Math.abs(dx);
    const dir = sign(dx) || 1;
    this.facing = dir;

    if (this.grabbedBy) return;

    const desired = this.attackRange * 0.82;
    if (distance > desired) {
      const speed = this.speed * (this.heavy ? 0.9 : 1);
      this.vx = approach(this.vx, dir * speed, 2600 * this.unit * dt);
      this.state = 'approach';
    } else {
      this.vx = approach(this.vx, 0, 2400 * this.unit * dt);
      if (this.cooldown <= 0) {
        this.setState('windup', this.windup);
        this.vx = 0;
        this.attackHit = false;
        this.game.audio.grab();
      }
    }

    // hop over a downed ally rarely
    if (this.onGround && Math.random() < 0.0007) this.vy = -350 * this.unit;

    this.gravity(dt);
    this.integrate(dt);
    if (this.onGround) {
      const phase = this.animTime * 10;
      if (Math.abs(this.vx) > 10) this.animTime += dt * 0.35;
      this.walkPhase = phase;
    }
  }

  updateAttack(dt, player) {
    const progress = this.stateTime / this.attackDuration;
    this.facing = player.x >= this.x ? 1 : -1;
    this.vx *= Math.pow(0.05, dt);
    this.gravity(dt);
    this.integrate(dt);
    if (!this.attackHit && progress > 0.28 && progress < 0.64) {
      const dx = player.x - this.x;
      const dy = Math.abs(player.y - this.y);
      const reach = this.attackRange + (this.heavy ? 34 : 22) * this.unit;
      if (Math.abs(dx) < reach && dy < 95 * this.unit && dx * this.facing >= -8 * this.unit) {
        this.attackHit = true;
        const landed = player.takeDamage(this.damage, this.x, { source: 'enemy' });
        if (landed) {
          this.game.fx.impact(player.x, player.y - 62 * this.unit, this.facing > 0 ? 0 : Math.PI, this.heavy ? 1.2 : 0.7, this.heavy ? '#ffd34d' : '#ff6c7d');
          this.game.fx.text(player.x, player.y - 135 * this.unit, this.heavy ? '¡PESADO!' : 'GOLPE', {
            color: this.heavy ? '#ffd34d' : '#ff9aa7',
            size: 12,
            life: 0.55,
            vy: -40,
          });
        }
      }
    }
    if (this.stateTime >= this.stateDuration) {
      this.setState('recover', this.recovery);
    }
  }

  takeHit(damage, kind, options = {}) {
    if (this.state === 'dead') return { hit: false };
    const absorbed = this.armored && !options.allowArmorBreak && ['light', 'heavy', 'spin', 'finisher'].includes(kind);
    if (absorbed) {
      this.shieldFlash = 1;
      this.game.audio.shield();
      this.game.fx.burst(this.x, this.y - 90 * this.unit, {
        count: 6,
        color: '#fff3b8',
        speed: 230,
        spread: TAU,
        gravity: 500,
        size: 2,
        life: 0.32,
      });
      this.game.fx.text(this.x, this.y - 178 * this.unit, 'INMUNE', {
        color: '#ffd34d',
        size: 13,
        life: 0.65,
        vy: -35,
      });
      this.game.showContextTip('<b>BLINDADO</b> · usa AGARRE, ESPECIAL, GOLPE DEL DRAGÓN o SALTO DE PARED', 1.6);
      return { hit: true, damaged: false, absorbed: true };
    }

    const wasAlive = this.hp > 0;
    this.hp = Math.max(0, this.hp - damage);
    this.flash = 0.16;
    this.lastHitKind = kind;
    if (options.batteryGain) this.game.player?.addBattery(options.batteryGain);
    this.game.player?.comboHit(kind);

    // Every armored enemy hit is a launch. Reds launch too, because ragdoll is the point.
    const launchVx = options.vx ?? 420 * this.unit;
    const launchVy = options.vy ?? -420 * this.unit;
    if (this.state === 'grabbed' && this.grabbedBy) this.grabbedBy.grabTarget = null;
    this.grabbedBy = null;
    this.state = this.hp > 0 ? 'ragdoll' : 'dead';
    this.stateTime = 0;
    this.stateDuration = this.hp > 0 ? 1 : 1.8;
    this.vy = launchVy;
    this.vx = launchVx;
    this.onGround = false;
    this.rotVel = rand(-15, 15) + launchVx * 0.018;
    this.ragdollTimer = 0;
    this.settleTimer = 0;
    this.deadTimer = 0;

    if (this.hp <= 0 && wasAlive) this.die();
    return { hit: true, damaged: true, killed: this.hp <= 0 };
  }

  die() {
    if (this.countedDead) return;
    this.countedDead = true;
    this.state = 'dead';
    this.stateTime = 0;
    this.stateDuration = 1.8;
    this.alpha = 1;
    this.rotVel = rand(-14, 14);
    this.game.registerKill(this);
    this.game.fx.burst(this.x, this.y - 70 * this.unit, {
      count: 18,
      color: this.palette.main,
      speed: 440,
      spread: TAU,
      gravity: 900,
      size: 3.2,
      life: 0.6,
      shape: 'shard',
    });
    this.game.fx.ring(this.x, this.y - 60 * this.unit, {
      color: this.palette.main,
      maxRadius: 80,
      life: 0.4,
      width: 2.4,
      squash: 0.8,
    });
    this.game.audio.death();
  }

  updateRagdoll(dt) {
    const gravity = 2180 * this.unit;
    this.vy += gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.rotVel * dt;

    const minX = this.game.left + 8;
    const maxX = this.game.right - 8;
    if (this.x < minX) {
      this.x = minX;
      if (Math.abs(this.vx) > 190) {
        this.game.scene.pulseWall('left', clamp(Math.abs(this.vx) / 900, 0.2, 1));
        this.game.fx.burst(this.x, this.y - 55 * this.unit, {
          count: 12,
          color: this.palette.main,
          speed: 350,
          angle: 0,
          spread: 1.8,
          gravity: 800,
          size: 2.8,
          life: 0.4,
        });
        this.game.fx.ring(this.x, this.y - 55 * this.unit, { color: this.palette.main, maxRadius: 55, life: 0.3, width: 2, squash: 0.8 });
        this.game.shake(clamp(Math.abs(this.vx) / 80, 3, 11), 0.18);
        this.game.audio.hitHeavy();
      }
      this.vx = Math.abs(this.vx) * 0.68;
      this.rotVel *= -0.65;
    } else if (this.x > maxX) {
      this.x = maxX;
      if (Math.abs(this.vx) > 190) {
        this.game.scene.pulseWall('right', clamp(Math.abs(this.vx) / 900, 0.2, 1));
        this.game.fx.burst(this.x, this.y - 55 * this.unit, {
          count: 12,
          color: this.palette.main,
          speed: 350,
          angle: Math.PI,
          spread: 1.8,
          gravity: 800,
          size: 2.8,
          life: 0.4,
        });
        this.game.fx.ring(this.x, this.y - 55 * this.unit, { color: this.palette.main, maxRadius: 55, life: 0.3, width: 2, squash: 0.8 });
        this.game.shake(clamp(Math.abs(this.vx) / 80, 3, 11), 0.18);
        this.game.audio.hitHeavy();
      }
      this.vx = -Math.abs(this.vx) * 0.68;
      this.rotVel *= -0.65;
    }

    if (this.y >= this.game.groundY) {
      this.y = this.game.groundY;
      if (Math.abs(this.vy) > 220) {
        this.game.fx.dust(this.x, this.game.groundY, 9, sign(this.vx), '#86a9c8');
        this.game.fx.shards(this.x, this.game.groundY, 3, this.palette.main, sign(this.vx));
        this.game.audio.land();
        this.game.shake(clamp(Math.abs(this.vy) / 160, 2, 8), 0.16);
        this.vy = -Math.abs(this.vy) * (this.state === 'dead' ? 0.42 : 0.35);
        this.vx *= 0.76;
        this.rotVel *= 0.72;
      } else {
        this.vy = 0;
        this.vx *= Math.pow(0.04, dt);
        this.rotVel *= Math.pow(0.1, dt);
        this.onGround = true;
      }
    } else {
      this.onGround = false;
    }

    if (this.y < this.game.ceilingY + 40 * this.unit) {
      this.y = this.game.ceilingY + 40 * this.unit;
      if (this.vy < 0) {
        this.vy = Math.abs(this.vy) * 0.6;
        this.game.fx.ring(this.x, this.game.ceilingY + 35 * this.unit, {
          color: this.palette.main,
          maxRadius: 50,
          life: 0.25,
          width: 2,
          squash: 0.9,
        });
      }
    }

    this.checkEnemyCollisions();

    if (this.state === 'dead') {
      this.deadTimer += dt;
      if (this.onGround && this.deadTimer > 1.05) {
        this.alpha = Math.max(0, this.alpha - dt * 1.6);
        if (this.alpha <= 0) this.game.removeEnemy(this);
      }
    } else {
      const speed = Math.hypot(this.vx, this.vy);
      if (this.onGround && speed < 24) {
        this.settleTimer += dt;
        if (this.settleTimer > 0.72) this.getUp();
      } else {
        this.settleTimer = 0;
      }
    }
  }

  checkEnemyCollisions() {
    if (this.hitCooldown > 0) return;
    const speed = Math.hypot(this.vx, this.vy);
    if (speed < 300) return;
    for (const other of this.game.enemies) {
      if (!other || other === this || other.state === 'dead' || other.state === 'grabbed') continue;
      if (Math.hypot(other.x - this.x, other.y - this.y) > (this.radius + other.radius) * 1.9) continue;
      if (this.hitSet.has(other.id)) continue;
      this.hitSet.add(other.id);
      this.hitCooldown = 0.16;
      const dir = sign(this.vx) || 1;
      const damage = this.thrown ? 18 : 7;
      const result = this.game.hitEnemy(other, {
        damage,
        kind: this.thrown ? 'thrownBody' : 'bodySlam',
        vx: dir * 430 * this.unit,
        vy: -330 * this.unit,
        batteryGain: this.thrown ? 5 : 0,
        source: 'enemyCollision',
        dramatic: true,
        allowArmorBreak: this.thrown,
        hitY: other.y - 55 * this.unit,
      });
      if (result) {
        this.game.fx.impact(other.x, other.y - 55 * this.unit, dir > 0 ? 0 : Math.PI, 0.9, this.palette.main);
        this.game.shake(6, 0.16);
        this.game.audio.hitLight();
      }
    }
  }

  getUp() {
    if (this.hp <= 0) {
      this.state = 'dead';
      return;
    }
    this.state = 'approach';
    this.stateTime = 0;
    this.stateDuration = 0;
    this.rot = 0;
    this.rotVel = 0;
    this.vx = 0;
    this.vy = 0;
    this.y = this.game.groundY;
    this.hitCooldown = 0.35;
    this.cooldown = rand(0.45, 1.0);
    this.game.fx.dust(this.x, this.game.groundY, 5, 0, '#7d9fbe');
    this.game.fx.ring(this.x, this.game.groundY, { color: this.palette.main, maxRadius: 32, life: 0.25, width: 1.2, squash: 0.3 });
  }

  // Called by the player when held
  struggle() {
    this.stateTime += 0;
  }
}
