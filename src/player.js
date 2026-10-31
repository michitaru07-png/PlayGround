import { TAU, clamp, approach, easeOutCubic, rand } from './utils.js';

const PALETTE = {
  main: '#39f5ff',
  light: '#e2ffff',
  accent: '#78d9ff',
  glow: '#39f5ff',
  outline: 'rgba(1, 9, 20, 0.96)',
  back: '#178bb8',
};

export class Player {
  constructor(game, x) {
    this.game = game;
    this.unit = game.unit;
    this.player = true;
    this.isPlayer = true;
    this.id = 'player';
    this.x = x;
    this.y = game.groundY;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.scale = 1.06 * this.unit;
    this.maxHp = 100;
    this.hp = 100;
    this.battery = 0;
    this.onGround = true;
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDuration = 0;
    this.animTime = 0;
    this.attackKind = null;
    this.attackChain = 0;
    this.chainTimer = 0;
    this.attackHitSet = new Set();
    this.attackLungeApplied = false;
    this.wallSide = null;
    this.wallTimer = 0;
    this.invuln = 0;
    this.flash = 0;
    this.alpha = 1;
    this.alive = true;
    this.grabTarget = null;
    this.grabTimer = 0;
    this.grabThrowReady = false;
    this.suplexTarget = null;
    this.suplexSlammed = false;
    this.specialWaveDone = false;
    this.specialHits = new Set();
    this.diveHits = new Set();
    this.diveBounces = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.trailTimer = 0;
    this.landedFrom = 0;
    this.palette = PALETTE;
    this.charged = false;
    this.aura = true;
    this.auraScale = 1;
    this.seed = 7;
    this.radius = 16 * this.unit;
    this.lastState = 'idle';
    this.stunTimer = 0;
  }

  get moveSpeed() {
    return 355 * this.unit;
  }

  get airSpeed() {
    return 300 * this.unit;
  }

  get gravity() {
    return 2180 * this.unit;
  }

  get height() {
    return 140 * this.scale;
  }

  setState(name, duration = 0) {
    this.lastState = this.state;
    this.state = name;
    this.stateTime = 0;
    this.stateDuration = duration;
  }

  addBattery(amount) {
    if (amount <= 0) return;
    const wasCharged = this.battery >= 100;
    this.battery = clamp(this.battery + amount, 0, 100);
    this.charged = this.battery >= 100;
    if (!wasCharged && this.charged) {
      this.game.audio.charged?.();
      this.game.ui.flashBattery();
      this.game.fx.ring(this.x, this.y - 68 * this.unit, {
        color: '#ffd34d',
        maxRadius: 82 * this.unit,
        life: 0.5,
        width: 2.5,
        squash: 0.45,
      });
      this.game.fx.text(this.x, this.y - 160 * this.unit, 'BATERÍA AL 100%', {
        color: '#ffd34d',
        size: 13,
        life: 1.1,
        vy: -35,
      });
    }
  }

  heal(amount) {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  comboHit(kind = 'light') {
    this.combo += 1;
    this.comboTimer = 1.7;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.game.ui.comboHit(this.combo, 1);
    this.game.audio.combo(this.combo - 1);
  }

  resetPosition(x) {
    this.x = x;
    this.y = this.game.groundY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDuration = 0;
    this.grabTarget = null;
    this.suplexTarget = null;
    this.wallSide = null;
    this.invuln = 2;
  }

  revive() {
    this.alive = true;
    this.hp = Math.max(1, Math.round(this.maxHp * 0.5));
    this.battery = Math.max(this.battery, 35);
    this.charged = this.battery >= 100;
    this.y = this.game.groundY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.state = 'idle';
    this.stateTime = 0;
    this.stateDuration = 0;
    this.invuln = 2.5;
    this.alpha = 1;
    this.flash = 0;
    this.grabTarget = null;
    this.suplexTarget = null;
    this.combo = 0;
    this.comboTimer = 0;
  }

  update(dt, input) {
    if (!this.alive) {
      this.updateDead(dt);
      return;
    }

    this.animTime += dt;
    this.stateTime += dt;
    if (this.state === 'spin' && this.stateDuration > 0) {
      this.spinAngle = (this.stateTime / this.stateDuration) * TAU;
    }
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.chainTimer = Math.max(0, this.chainTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.auraScale = 1 + (this.charged ? Math.sin(this.animTime * 5) * 0.08 : 0);
    if (this.comboTimer <= 0 && this.combo > 0) {
      this.combo = 0;
      this.game.ui.setCombo(0, 0);
    }

    // Timed visual invulnerability flicker
    if (this.invuln > 0 && this.state !== 'special') {
      this.alpha = 0.55 + Math.abs(Math.sin(this.animTime * 28)) * 0.45;
    } else {
      this.alpha = 1;
    }

    this.updateStateLogic(dt, input);
    this.handleInput(dt, input);
    this.updatePhysics(dt, input);
    this.updateAttackHits();
    this.updateHeldEnemy();
    this.updateVisualTrail(dt);

    if (this.state === 'wall') {
      this.game.showContextTip('<b>SALTO DE PARED</b> · pulsa SALTO para la patada descendente', 0.18);
    }
  }

  updateStateLogic(dt, input) {
    const state = this.state;

    if (state === 'wall') {
      this.wallTimer -= dt;
      if (this.wallTimer <= 0 || (this.wallSide === 'left' && input.move > 0) || (this.wallSide === 'right' && input.move < 0)) {
        this.leaveWall();
      }
    }

    if (state === 'grab') {
      this.grabTimer -= dt;
      if (!this.grabTarget || this.grabTarget.state === 'dead' || this.grabTarget.hp <= 0) {
        this.releaseGrab();
      } else if (this.grabTimer <= 0) {
        this.releaseGrab();
      }
      const throwPressed = input.wasPressed('light') || input.wasPressed('heavy') || input.wasPressed('grab') || input.wasPressed('down');
      if (this.grabTarget && throwPressed) {
        this.throwGrab();
      }
      return;
    }

    if (state === 'suplex') {
      this.updateSuplex(dt);
      return;
    }

    if (state === 'special') {
      this.updateSpecial(dt);
      return;
    }

    if (state === 'hurt') {
      if (this.stateTime >= this.stateDuration) {
        this.setState(this.onGround ? 'idle' : 'fall');
      }
      return;
    }

    if (state === 'attack' || state === 'heavy' || state === 'dragon' || state === 'spin' || state === 'throw') {
      const progress = this.stateDuration > 0 ? this.stateTime / this.stateDuration : 1;
      if (this.stateTime >= this.stateDuration) {
        this.chainTimer = 0.68;
        this.setState(this.onGround ? 'idle' : 'fall');
        this.vx *= 0.35;
        this.attackHitSet.clear();
        return;
      }
      // allow a cancel into the next attack or jump late in the recovery
      if (progress < 0.55) return;
    }

    // Crouch handling
    if (this.onGround && input.isDown('down') && ['idle', 'run', 'crouch'].includes(this.state)) {
      if (this.state !== 'crouch') this.setState('crouch');
      this.vx = approach(this.vx, 0, 2800 * this.unit * dt);
      return;
    }
    if (this.state === 'crouch' && !input.isDown('down')) {
      this.setState('idle');
    }
  }

  handleInput(dt, input) {
    if (this.state === 'hurt' || this.state === 'dead' || this.state === 'grab' || this.state === 'suplex') return;
    if (this.state === 'special') return;

    if (this.state === 'wall') {
      if (input.wasPressed('jump')) {
        this.wallJump();
      }
      return;
    }

    // Wall jump can also be triggered if the player is pressed against a wall midair
    if (!this.onGround && (input.wasPressed('jump')) && this.nearWall()) {
      this.wallJump(true);
      return;
    }

    const attacking = ['attack', 'heavy', 'dragon', 'spin', 'throw'].includes(this.state);
    const canAct = ['idle', 'run', 'crouch', 'jump', 'fall', 'dive'].includes(this.state) || attacking;
    if (!canAct) return;

    if (input.wasPressed('special') && this.battery >= 100) {
      this.startSpecial();
      return;
    }

    if (input.wasPressed('grab')) {
      if (this.tryGrab()) return;
      if (!attacking) {
        this.setState('attack', 0.22);
        this.attackKind = 'grabWhiff';
        this.attackHitSet.clear();
        this.game.audio.whoosh(0.5);
      }
      return;
    }

    if (input.wasPressed('jump')) {
      if (this.onGround || this.state === 'crouch') {
        this.jump();
        return;
      }
    }

    if (input.wasPressed('heavy')) {
      if (!this.onGround) {
        this.startAttack('airspin');
      } else if (input.isDown('down')) {
        this.startAttack('dragon');
      } else {
        this.startAttack('heavy');
      }
      return;
    }

    if (input.wasPressed('light')) {
      this.startAttack('light');
    }
  }

  jump() {
    if (!this.onGround) return;
    this.vy = -800 * this.unit;
    this.onGround = false;
    this.setState('jump');
    this.vx = clamp(this.vx * 0.7, -this.moveSpeed, this.moveSpeed);
    this.game.audio.jump();
    this.game.fx.dust(this.x, this.y, 5, 0, '#58c8ff');
    this.game.fx.ring(this.x, this.y, { color: '#39f5ff', maxRadius: 28, life: 0.24, width: 1.4, squash: 0.35 });
  }

  nearWall() {
    const margin = 10 * this.unit;
    return this.x <= this.game.left + this.radius + margin || this.x >= this.game.right - this.radius - margin;
  }

  enterWall(side) {
    if (!this.onGround) return;
    this.wallSide = side;
    this.wallTimer = 1.35;
    this.setState('wall', 1.35);
    this.vx = 0;
    this.facing = side === 'left' ? 1 : -1;
    this.game.showContextTip('<b>SALTO DE PARED</b> · pulsa SALTO para la patada descendente', 2.2);
    this.game.audio.grab();
    const wallX = side === 'left' ? this.game.left : this.game.right;
    this.game.fx.burst(wallX, this.y - 72 * this.unit, {
      count: 8,
      color: '#39f5ff',
      speed: 240,
      angle: side === 'left' ? 0 : Math.PI,
      spread: 1.7,
      gravity: 500,
      size: 2.4,
      life: 0.35,
    });
  }

  leaveWall() {
    if (this.state !== 'wall') return;
    this.setState('idle');
    this.wallSide = null;
    this.wallTimer = 0;
    if (this.x <= this.game.left + this.radius) this.x += 3 * this.unit;
    if (this.x >= this.game.right - this.radius) this.x -= 3 * this.unit;
  }

  wallJump(midair = false) {
    const side = this.wallSide || (this.x < this.game.width / 2 ? 'left' : 'right');
    const toward = side === 'left' ? 1 : -1;
    this.facing = toward;
    this.vy = -640 * this.unit;
    this.vx = toward * 560 * this.unit;
    if (midair) this.y = Math.min(this.y, this.game.groundY - 12);
    this.onGround = false;
    this.wallSide = null;
    this.setState('dive', 4);
    this.diveHits.clear();
    this.diveBounces = 0;
    this.invuln = Math.max(this.invuln, 0.55);
    this.game.audio.whoosh(1.6);
    this.game.audio.jump();
    this.game.fx.ring(this.x, this.y - 55 * this.unit, {
      color: '#d8ffff',
      maxRadius: 74 * this.unit,
      life: 0.3,
      width: 2.6,
      squash: 0.8,
    });
    this.game.fx.burst(this.x, this.y - 55 * this.unit, {
      count: 16,
      color: '#39f5ff',
      speed: 420,
      angle: toward > 0 ? -0.6 : Math.PI + 0.6,
      spread: 1.5,
      gravity: 600,
      size: 3,
      life: 0.45,
    });
    this.game.shake(9, 0.2);
    this.game.hitstop(0.045);
    this.game.ui.banner('SALTO DE PARED', 'PATADA DE REBOTE', 'IMPACTO DESCENDENTE · REBOTE AUTOMÁTICO', 'alert', 0.95);
  }

  startAttack(kind) {
    const air = !this.onGround;
    const alreadyAttacking = ['attack', 'heavy'].includes(this.state) && this.stateTime > this.stateDuration * 0.45;
    let duration = 0.26;
    if (kind === 'light') {
      const chaining = this.chainTimer > 0 || (alreadyAttacking && this.attackKind === 'light');
      this.attackChain = chaining ? (this.attackChain + 1) % 3 : 0;
      duration = [0.24, 0.23, 0.34][this.attackChain];
      this.setState('attack', duration);
      this.facing = this.facing || 1;
      // small forward step
      this.vx = this.facing * (air ? 80 : 170) * this.unit;
    } else if (kind === 'heavy') {
      this.attackChain = 0;
      duration = 0.46;
      this.setState('heavy', duration);
      this.vx = this.facing * 210 * this.unit;
    } else if (kind === 'dragon') {
      this.attackChain = 0;
      duration = 0.64;
      this.setState('dragon', duration);
      this.vy = -280 * this.unit;
      this.onGround = false;
      this.vx = this.facing * 110 * this.unit;
    } else if (kind === 'airspin') {
      this.attackChain = 0;
      duration = 0.52;
      this.setState('spin', duration);
      this.spinAngle = 0;
      this.vx *= 0.55;
    }
    this.attackKind = kind;
    this.attackHitSet.clear();
    this.attackLungeApplied = false;
    this.game.audio.whoosh(kind === 'heavy' || kind === 'dragon' ? 1.5 : 0.8);
    if (kind === 'dragon') {
      this.game.fx.ring(this.x, this.y, { color: '#ffd34d', maxRadius: 54, life: 0.3, width: 2, squash: 0.35 });
      this.game.fx.burst(this.x, this.y, { count: 9, color: '#ffe47a', speed: 220, angle: -Math.PI / 2, spread: 1.1, gravity: 240, size: 2.4, life: 0.4 });
    }
  }

  updateAttackHits() {
    const state = this.state;
    if (!['attack', 'heavy', 'dragon', 'spin', 'dive'].includes(state)) return;
    const progress = this.stateDuration > 0 ? this.stateTime / this.stateDuration : 1;
    if (state === 'attack' && this.attackKind === 'grabWhiff') return;

    let active = false;
    if (state === 'attack') active = progress > 0.14 && progress < 0.7;
    else if (state === 'heavy') active = progress > 0.24 && progress < 0.72;
    else if (state === 'dragon') active = progress > 0.1 && progress < 0.68;
    else if (state === 'spin') active = progress > 0.05 && progress < 0.8;
    else if (state === 'dive') active = true;
    if (!active) return;

    const unit = this.unit;
    const enemies = this.game.enemies;
    for (const enemy of enemies) {
      if (!enemy || enemy.state === 'dead' || enemy.state === 'grabbed' || this.attackHitSet.has(enemy.id)) continue;

      let hit = false;
      let damage = 0;
      let vx = 0;
      let vy = 0;
      let kind = 'light';
      let batteryGain = 0;
      let hitY = this.y - 66 * unit;

      if (state === 'attack') {
        const reach = (this.attackChain === 2 ? 98 : 86) * unit;
        const hitX = this.x + this.facing * reach * 0.5;
        if (Math.abs(enemy.x - hitX) < reach * 0.5 + 22 * unit && enemy.y > this.y - 160 * unit && enemy.y < this.y + 40 * unit) {
          hit = true;
          if (this.attackChain === 2) {
            damage = 13;
            vx = this.facing * 690 * unit;
            vy = -540 * unit;
            kind = 'finisher';
            batteryGain = 7;
          } else {
            damage = 7 + this.attackChain;
            vx = this.facing * (240 + this.attackChain * 90) * unit;
            vy = -190 * unit;
            kind = 'light';
            batteryGain = 4;
          }
          hitY = enemy.y - 64 * unit;
        }
      } else if (state === 'heavy') {
        const reach = 116 * unit;
        const hitX = this.x + this.facing * reach * 0.48;
        if (Math.abs(enemy.x - hitX) < reach * 0.5 + 24 * unit && enemy.y > this.y - 168 * unit && enemy.y < this.y + 42 * unit) {
          hit = true;
          damage = 19;
          vx = this.facing * 760 * unit;
          vy = -570 * unit;
          kind = 'heavy';
          batteryGain = 9;
          hitY = enemy.y - 62 * unit;
        }
      } else if (state === 'dragon') {
        const reach = 98 * unit;
        const hitX = this.x + this.facing * reach * 0.35;
        if (Math.abs(enemy.x - hitX) < reach * 0.68 + 20 * unit && enemy.y > this.y - 245 * unit && enemy.y < this.y + 50 * unit) {
          hit = true;
          damage = 27;
          vx = this.facing * 210 * unit;
          vy = -1980 * unit;
          kind = 'dragon';
          batteryGain = 13;
          hitY = enemy.y - 66 * unit;
        }
      } else if (state === 'spin') {
        const radius = 138 * unit;
        if (Math.abs(enemy.x - this.x) < radius + 20 * unit && enemy.y > this.y - 170 * unit && enemy.y < this.y + 230 * unit) {
          hit = true;
          damage = 16;
          vx = (enemy.x < this.x ? -1 : 1) * 620 * unit;
          vy = -410 * unit;
          kind = 'spin';
          batteryGain = 6;
          hitY = enemy.y - 62 * unit;
        }
      } else if (state === 'dive') {
        if (Math.abs(enemy.x - this.x) < 92 * unit && enemy.y > this.y - 45 * unit && enemy.y < this.y + 220 * unit) {
          hit = true;
          damage = 34;
          vx = (enemy.x < this.x ? -1 : 1) * 420 * unit;
          vy = 690 * unit;
          kind = 'dive';
          batteryGain = 15;
          hitY = enemy.y - 54 * unit;
        }
      }

      if (!hit) continue;
      this.attackHitSet.add(enemy.id);

      const landed = this.game.hitEnemy(enemy, {
        damage,
        kind,
        vx,
        vy,
        batteryGain,
        source: 'player',
        hitX: enemy.x,
        hitY,
        dramatic: kind !== 'light',
        allowArmorBreak: ['dragon', 'dive'].includes(state),
      });

      if (landed) {
        const hitAngle = Math.atan2(hitY - (this.y - 70 * unit), enemy.x - this.x);
        this.game.fx.impact(enemy.x, hitY, hitAngle, kind === 'heavy' || kind === 'dragon' || kind === 'dive' ? 1.5 : 1, kind === 'dragon' ? '#ffe47a' : '#8ffbff');
        this.game.hitstop(kind === 'heavy' || kind === 'dragon' ? 0.075 : kind === 'dive' ? 0.09 : 0.035);
        this.game.shake(kind === 'dive' ? 13 : kind === 'dragon' ? 11 : 5, 0.18);
        this.game.audio[kind === 'dive' || kind === 'dragon' ? 'hitHeavy' : 'hitLight']();

        if (state === 'dragon') {
          this.game.fx.text(enemy.x, enemy.y - 170 * unit, '¡AL TECHO!', {
            color: '#ffd34d',
            size: 14,
            life: 0.8,
            vy: -30,
          });
          this.game.fx.bolt(enemy.x, enemy.y - 60 * unit, enemy.x + rand(-14, 14), this.game.ceilingY + 30, {
            color: '#ffe47a',
            life: 0.22,
            width: 2,
            segments: 7,
            jitter: 16 * unit,
          });
        }

        if (state === 'dive') {
          this.diveBounces += 1;
          if (this.diveBounces < 3) {
            this.vy = -430 * unit;
            this.vx *= 0.82;
          }
        }
      }
    }
  }

  updateSpecial(dt) {
    const progress = this.stateDuration > 0 ? this.stateTime / this.stateDuration : 1;
    this.attackHitSet.clear();
    this.invuln = Math.max(this.invuln, 0.1);

    if (progress > 0.1 && progress < 0.86) {
      this.vx = this.facing * 280 * this.unit;
    } else {
      this.vx *= 0.82;
    }

    if (progress > 0.08 && progress < 0.92) {
      const unit = this.unit;
      for (const enemy of this.game.enemies) {
        if (!enemy || enemy.state === 'dead' || enemy.state === 'grabbed' || this.specialHits.has(enemy.id)) continue;
        const inFront = (enemy.x - this.x) * this.facing > -34 * unit;
        if (Math.abs(enemy.x - this.x) < 185 * unit && inFront && enemy.y > this.y - 180 * unit && enemy.y < this.y + 60 * unit) {
          this.specialHits.add(enemy.id);
          const hitY = enemy.y - 66 * unit;
          const landed = this.game.hitEnemy(enemy, {
            damage: 36,
            kind: 'special',
            vx: this.facing * 910 * this.unit,
            vy: -680 * this.unit,
            batteryGain: 0,
            source: 'player',
            hitX: enemy.x,
            hitY,
            dramatic: true,
            allowArmorBreak: true,
          });
          if (landed) {
            this.game.fx.bolt(this.x + this.facing * 40 * unit, this.y - 72 * unit, enemy.x, hitY, {
              color: '#bffcff',
              life: 0.2,
              width: 2.6,
              segments: 9,
              jitter: 22 * unit,
            });
            this.game.fx.impact(enemy.x, hitY, 0, 2, '#bffcff');
            this.game.audio.electric(0.3);
            this.game.shake(8, 0.14);
          }
        }
      }
      // Electric aura ticks
      if (Math.random() < 0.45) {
        const angle = rand(0, TAU);
        this.game.fx.bolt(
          this.x + Math.cos(angle) * 26 * unit,
          this.y - 68 * unit + Math.sin(angle) * 26 * unit,
          this.x + Math.cos(angle) * 120 * unit,
          this.y - 68 * unit + Math.sin(angle) * 90 * unit,
          { color: '#8ffbff', life: 0.12, width: 1.4, segments: 5, jitter: 13 * unit },
        );
      }
    }

    if (progress > 0.42 && !this.specialWaveDone) {
      this.specialWaveDone = true;
      const unit = this.unit;
      this.game.fx.ring(this.x, this.y - 50 * unit, {
        color: '#bffcff',
        maxRadius: 240 * unit,
        life: 0.6,
        width: 5,
        squash: 0.55,
      });
      this.game.fx.screenFlash('#bffcff', 0.22, 3);
      this.game.shake(20, 0.35);
      this.game.audio.special();
      for (const enemy of this.game.enemies) {
        if (!enemy || enemy.state === 'dead' || enemy.state === 'grabbed' || this.specialHits.has(enemy.id)) continue;
        if (Math.abs(enemy.x - this.x) < 245 * unit && Math.abs(enemy.y - this.y) < 180 * unit) {
          this.specialHits.add(enemy.id);
          this.game.hitEnemy(enemy, {
            damage: 18,
            kind: 'specialWave',
            vx: (enemy.x < this.x ? -1 : 1) * 760 * unit,
            vy: -540 * unit,
            batteryGain: 0,
            source: 'player',
            dramatic: true,
            allowArmorBreak: true,
          });
        }
      }
    }

    if (this.stateTime >= this.stateDuration) {
      this.setState(this.onGround ? 'idle' : 'fall');
      this.specialHits.clear();
      this.specialWaveDone = false;
      this.invuln = Math.max(this.invuln, 0.4);
      this.vx *= 0.3;
      this.game.endSlowMo();
    }
  }

  startSpecial() {
    this.battery = 0;
    this.charged = false;
    this.setState('special', 1.36);
    this.specialHits.clear();
    this.specialWaveDone = false;
    this.attackHitSet.clear();
    this.invuln = 2.1;
    this.facing = this.facing || 1;
    this.vx = 0;
    this.game.startSlowMo(3.5);
    this.game.audio.special();
    this.game.audio.electric(1.2);
    this.game.fx.screenFlash('#bffcff', 0.3, 2.5);
    this.game.fx.ring(this.x, this.y - 62 * this.unit, {
      color: '#39f5ff',
      maxRadius: 170 * this.unit,
      life: 0.55,
      width: 4,
      squash: 0.65,
    });
    this.game.fx.burst(this.x, this.y - 62 * this.unit, {
      count: 28,
      color: '#bffcff',
      speed: 620,
      spread: TAU,
      gravity: 100,
      size: 3.6,
      life: 0.65,
      shape: 'spark',
    });
    this.game.shake(18, 0.45);
    this.game.ui.banner('BULLET TIME', 'PATADA ELÉCTRICA', '40% DE VELOCIDAD · DESTELLOS NEÓN', 'alert', 1.3);
    this.game.ui.flashBattery();
  }

  updateSuplex(dt) {
    const target = this.suplexTarget;
    if (!target || target.state === 'dead') {
      this.setState(this.onGround ? 'idle' : 'fall');
      this.suplexTarget = null;
      return;
    }
    this.vx *= 0.9;
    if (this.stateTime > 0.16) {
      this.vy = Math.max(this.vy, 900 * this.unit);
      this.onGround = false;
    }
    const progress = this.stateTime / this.stateDuration;
    target.x = this.x - this.facing * 8 * this.unit;
    target.y = this.y + 18 * this.unit;
    target.facing = this.facing;

    if (!this.suplexSlammed && (progress > 0.46 || this.y >= this.game.groundY - 1)) {
      this.suplexSlammed = true;
      this.slamSuplex();
    }

    if (this.stateTime >= this.stateDuration) {
      this.setState(this.onGround ? 'idle' : 'fall');
      this.suplexTarget = null;
    }
  }

  slamSuplex() {
    const target = this.suplexTarget;
    const unit = this.unit;
    this.y = this.game.groundY;
    this.vy = 0;
    this.onGround = true;
    this.vx = 0;
    target.state = 'ragdoll';
    target.grabbedBy = null;
    target.ragdollTimer = 0.9;
    target.vy = -260 * unit;
    target.vx = (target.x < this.x ? -1 : 1) * 300 * unit;
    target.rotVel = rand(-14, 14);
    target.blackout = 0.35;
    this.game.hitEnemy(target, {
      damage: 29,
      kind: 'suplex',
      vx: (target.x < this.x ? -1 : 1) * 260 * unit,
      vy: -240 * unit,
      batteryGain: 18,
      source: 'player',
      dramatic: true,
      allowArmorBreak: true,
      silent: true,
      hitY: target.y - 30,
    });
    for (const enemy of this.game.enemies) {
      if (!enemy || enemy === target || enemy.state === 'dead' || enemy.state === 'grabbed') continue;
      const distance = Math.abs(enemy.x - this.x);
      if (distance < 190 * unit && Math.abs(enemy.y - this.y) < 120 * unit) {
        this.game.hitEnemy(enemy, {
          damage: 20,
          kind: 'suplexAoe',
          vx: (enemy.x < this.x ? -1 : 1) * (360 + (190 * unit - distance)) * unit,
          vy: -460 * unit,
          batteryGain: 7,
          source: 'player',
          dramatic: true,
          allowArmorBreak: true,
          hitY: enemy.y - 45 * unit,
        });
      }
    }
    this.game.fx.ring(this.x, this.game.groundY, {
      color: '#8ffbff',
      maxRadius: 240 * unit,
      life: 0.62,
      width: 6,
      squash: 0.22,
    });
    this.game.fx.dust(this.x, this.game.groundY, 26, 0, '#9cc8ff');
    this.game.fx.shards(this.x, this.game.groundY, 12, '#8ffbff', this.facing);
    this.game.fx.screenFlash('#ffffff', 0.16, 5);
    this.game.audio.slam();
    this.game.shake(24, 0.45);
    this.game.hitstop(0.1);
    this.game.ui.banner('SUPLEX AÉREO', 'IMPACTO SÍSMICO', 'DAÑO EN ÁREA · ONDA DE CHOQUE', 'alert', 0.95);
    this.game.player.bestCombo = Math.max(this.game.player.bestCombo, this.game.player.combo);
  }

  tryGrab() {
    const unit = this.unit;
    if (!this.onGround) {
      let candidate = null;
      let best = Infinity;
      for (const enemy of this.game.enemies) {
        if (!enemy || enemy.state === 'dead' || enemy.state === 'grabbed') continue;
        const dx = Math.abs(enemy.x - this.x);
        const dy = enemy.y - this.y;
        if (dx < 125 * unit && dy > -180 * unit && dy < 110 * unit) {
          const score = dx + Math.abs(dy) * 0.35;
          if (score < best) {
            best = score;
            candidate = enemy;
          }
        }
      }
      if (candidate) {
        this.startSuplex(candidate);
        return true;
      }
      return false;
    }

    let candidate = null;
    let best = Infinity;
    for (const enemy of this.game.enemies) {
      if (!enemy || enemy.state === 'dead' || enemy.state === 'grabbed') continue;
      const dx = enemy.x - this.x;
      const dy = Math.abs(enemy.y - this.y);
      const inFront = dx * this.facing >= -16 * unit;
      if (inFront && Math.abs(dx) < 88 * unit && dy < 80 * unit) {
        const score = Math.abs(dx);
        if (score < best) {
          best = score;
          candidate = enemy;
        }
      }
    }
    if (!candidate) return false;

    this.grabTarget = candidate;
    candidate.state = 'grabbed';
    candidate.grabbedBy = this;
    candidate.stateTime = 0;
    candidate.vx = 0;
    candidate.vy = 0;
    candidate.onGround = false;
    this.setState('grab', 1.4);
    this.grabTimer = 1.25;
    this.vx = 0;
    this.game.audio.grab();
    this.game.fx.ring(candidate.x, candidate.y - 60 * unit, {
      color: candidate.heavy ? '#ffd34d' : '#ff3ea5',
      maxRadius: 52,
      life: 0.3,
      width: 2,
      squash: 0.8,
    });
    this.game.showContextTip('<b>AGARRE</b> · pulsa RÁPIDO, FUERTE o AGARRE para lanzarlo', 2.2);
    return true;
  }

  startSuplex(target) {
    this.suplexTarget = target;
    this.suplexSlammed = false;
    target.state = 'grabbed';
    target.grabbedBy = this;
    target.vx = 0;
    target.vy = 0;
    target.onGround = false;
    this.setState('suplex', 0.78);
    this.vy = 250 * this.unit;
    this.vx = 0;
    this.game.audio.grab();
    this.game.audio.whoosh(1.4);
    this.game.showContextTip('<b>AGARRE AÉREO</b> · suplex devastador en camino', 1.4);
  }

  throwGrab() {
    const target = this.grabTarget;
    if (!target) return;
    const unit = this.unit;
    this.grabTarget = null;
    this.grabTimer = 0;
    target.grabbedBy = null;
    target.thrown = true;
    target.thrownBy = 'player';
    target.onGround = false;
    this.game.hitEnemy(target, {
      damage: 16,
      kind: 'throw',
      vx: this.facing * 1120 * unit,
      vy: -360 * unit,
      batteryGain: 6,
      source: 'player',
      dramatic: true,
      allowArmorBreak: true,
      hitY: target.y - 55 * unit,
    });
    target.hitSet.clear();
    target.rotVel = rand(-18, -9) * this.facing;
    target.thrown = true;
    target.thrownBy = 'player';
    target.ragdollTimer = 1.1;
    this.game.audio.throwEnemy();
    this.game.audio.hitHeavy();
    this.game.fx.impact(target.x, target.y - 55 * unit, this.facing > 0 ? 0 : Math.PI, 1.3, '#ffb3d9');
    this.game.fx.text(target.x, target.y - 130 * unit, '¡LANZADO!', { color: '#ff9ecf', size: 13, life: 0.65, vy: -30 });
    this.game.shake(8, 0.2);
    this.game.hitstop(0.04);
    this.setState('throw', 0.4);
    this.vx = this.facing * 70 * unit;
    this.game.showContextTip('', 0);
  }

  releaseGrab() {
    if (this.grabTarget) {
      const target = this.grabTarget;
      target.state = target.hp > 0 ? 'idle' : 'dead';
      target.grabbedBy = null;
      target.onGround = true;
      target.y = this.game.groundY;
      target.x = clamp(target.x, this.game.left + 20, this.game.right - 20);
      target.vx = (target.x < this.x ? -1 : 1) * 160 * this.unit;
      target.vy = 0;
      this.grabTarget = null;
    }
    this.grabTimer = 0;
    if (this.state === 'grab') this.setState('idle');
  }

  updateHeldEnemy() {
    if (!this.grabTarget) return;
    const target = this.grabTarget;
    if (target.state !== 'grabbed') {
      this.grabTarget = null;
      return;
    }
    const unit = this.unit;
    target.x = this.x + this.facing * 45 * unit;
    target.y = this.y - 62 * unit;
    target.facing = -this.facing;
    target.stateTime += 0;
  }

  updatePhysics(dt, input) {
    const unit = this.unit;
    const grounded = this.onGround;
    const state = this.state;
    const locked = ['attack', 'heavy', 'dragon', 'spin', 'throw', 'hurt', 'grab', 'suplex', 'special', 'wall', 'dive'].includes(state);

    if (!locked) {
      if (grounded) {
        const targetSpeed = this.state === 'crouch' ? 0 : input.move * this.moveSpeed;
        this.vx = approach(this.vx, targetSpeed, (targetSpeed !== 0 ? 3900 : 2700) * unit * dt);
        if (input.move !== 0) this.facing = input.move > 0 ? 1 : -1;
        if (Math.abs(this.vx) > 24 && this.state !== 'crouch') {
          if (this.state !== 'run') this.setState('run');
        } else if (this.state === 'run') {
          this.setState('idle');
        }
      } else {
        this.vx = approach(this.vx, input.move * this.airSpeed, 1400 * unit * dt);
        if (input.move !== 0) this.facing = input.move > 0 ? 1 : -1;
      }
    } else if (state === 'attack' || state === 'heavy') {
      // keep momentum but bleed it
      this.vx *= Math.pow(0.03, dt);
    } else if (state === 'hurt') {
      this.vx *= Math.pow(0.2, dt);
    } else if (state === 'dive') {
      this.vx = approach(this.vx, this.facing * 520 * unit, 900 * unit * dt);
    } else if (state === 'special') {
      // handled in updateSpecial
    } else {
      this.vx *= Math.pow(0.02, dt);
    }

    // Gravity
    if (!this.onGround) {
      this.vy += this.gravity * dt;
      if (state === 'suplex') this.vy += 1500 * unit * dt;
      if (state === 'dive') this.vy += 900 * unit * dt;
      if (state === 'dragon') this.vy += 300 * unit * dt;
    }

    // Integrate
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const minX = this.game.left + this.radius;
    const maxX = this.game.right - this.radius;
    if (this.x < minX) {
      this.x = minX;
      if (this.vx < -160 && !this.onGround) this.game.scene.pulseWall('left', 0.5);
      this.vx = 0;
      if (this.onGround && state !== 'wall' && !locked && input.move < 0) this.enterWall('left');
    } else if (this.x > maxX) {
      this.x = maxX;
      if (this.vx > 160 && !this.onGround) this.game.scene.pulseWall('right', 0.5);
      this.vx = 0;
      if (this.onGround && state !== 'wall' && !locked && input.move > 0) this.enterWall('right');
    }

    // Ceiling
    const ceilingY = this.game.ceilingY;
    if (this.y - 128 * this.scale < ceilingY) {
      this.y = ceilingY + 128 * this.scale;
      if (this.vy < 0) {
        this.vy = 0;
        this.game.fx.burst(this.x, this.y, { count: 5, color: '#39f5ff', speed: 90, angle: Math.PI / 2, spread: 1.2, gravity: 500, size: 2, life: 0.3 });
      }
    }

    // Ground
    if (this.y >= this.game.groundY) {
      const wasAirborne = !this.onGround;
      this.y = this.game.groundY;
      if (wasAirborne) {
        if (this.vy > 380) {
          this.game.fx.dust(this.x, this.game.groundY, 8, 0, '#88b7e7');
          this.game.audio.land();
          this.game.shake(clamp(this.vy / 120, 2, 7), 0.16);
        }
        if (state === 'dive') {
          this.diveLand();
        } else if (state === 'special') {
          // continue special on ground
        } else if (state === 'suplex') {
          // keep suplexing
        } else if (state === 'jump' || state === 'fall') {
          this.setState('idle');
        }
      }
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
      if (this.state === 'idle' || this.state === 'run' || this.state === 'crouch') {
        this.setState('fall');
      }
    }

    // Wall cling visual detection
    if (this.onGround && (this.x <= minX + 0.6 || this.x >= maxX - 0.6) && !locked) {
      if ((this.x <= minX + 0.6 && input.move < 0) || (this.x >= maxX - 0.6 && input.move > 0)) {
        this.enterWall(this.x <= minX + 0.6 ? 'left' : 'right');
      }
    }
  }

  diveLand() {
    const unit = this.unit;
    this.setState('idle');
    this.vx *= 0.2;
    this.onGround = true;
    this.diveHits.clear();
    this.game.fx.ring(this.x, this.game.groundY, {
      color: '#8ffbff',
      maxRadius: 190 * unit,
      life: 0.5,
      width: 4,
      squash: 0.2,
    });
    this.game.fx.dust(this.x, this.game.groundY, 20, 0, '#9cc8ff');
    this.game.audio.slam();
    this.game.shake(16, 0.3);
    this.game.hitstop(0.06);
    for (const enemy of this.game.enemies) {
      if (!enemy || enemy.state === 'dead' || enemy.state === 'grabbed') continue;
      if (Math.abs(enemy.x - this.x) < 190 * unit && Math.abs(enemy.y - this.game.groundY) < 80 * unit) {
        this.game.hitEnemy(enemy, {
          damage: 18,
          kind: 'diveLand',
          vx: (enemy.x < this.x ? -1 : 1) * 680 * unit,
          vy: -520 * unit,
          batteryGain: 6,
          source: 'player',
          dramatic: true,
          allowArmorBreak: true,
          hitY: enemy.y - 40 * unit,
        });
      }
    }
  }

  updateVisualTrail(dt) {
    this.trailTimer -= dt;
    const fast = Math.abs(this.vx) > 220 || this.state === 'dive' || this.state === 'special' || this.state === 'suplex';
    if (fast && this.trailTimer <= 0) {
      this.trailTimer = this.state === 'special' ? 0.02 : 0.035;
      this.game.fx.trail(
        this.x - this.facing * 12 * this.unit + rand(-4, 4),
        this.y - (58 + rand(-18, 18)) * this.unit,
        this.state === 'special' ? '#bffcff' : '#39f5ff',
        this.state === 'special' ? 7 : 4.4,
        this.state === 'special' ? 0.4 : 0.24,
      );
      if (this.state === 'special' || this.state === 'dive') {
        this.game.fx.burst(this.x, this.y - 60 * this.unit, {
          count: 1,
          color: '#bffcff',
          speed: 80,
          spread: TAU,
          gravity: 0,
          size: 2,
          life: 0.2,
        });
      }
    }

    if (this.onGround && Math.abs(this.vx) > 300 && this.state === 'run' && this.trailTimer <= 0) {
      this.game.fx.dust(this.x - this.facing * 10, this.game.groundY, 1, -this.facing, '#4b7ea6');
    }
  }

  takeDamage(amount, sourceX, options = {}) {
    if (!this.alive || this.invuln > 0 || this.state === 'special') return false;
    if (this.state === 'dive' && options.ignoreInvuln !== true) return false;
    this.hp = clamp(this.hp - amount, 0, this.maxHp);
    this.flash = 0.18;
    this.invuln = 0.82;
    this.combo = 0;
    this.comboTimer = 0;
    this.game.ui.setCombo(0, 0);
    this.state = 'hurt';
    this.stateTime = 0;
    this.stateDuration = 0.34;
    this.vy = -260 * this.unit;
    this.vx = (this.x < sourceX ? -1 : 1) * 320 * this.unit;
    this.onGround = false;
    this.game.fx.text(this.x, this.y - 145 * this.unit, `-${Math.round(amount)}`, { color: '#ff7588', size: 17, life: 0.8, vy: -60 });
    this.game.fx.burst(this.x, this.y - 70 * this.unit, {
      count: 10,
      color: '#ff5577',
      speed: 300,
      spread: TAU,
      gravity: 900,
      size: 2.6,
      life: 0.4,
    });
    this.game.fx.screenFlash('#ff3050', 0.12, 6);
    this.game.audio.hurt();
    this.game.shake(10, 0.25);
    this.game.hitstop(0.045);
    if (this.hp <= 0) {
      this.die();
    }
    return true;
  }

  die() {
    this.alive = false;
    this.state = 'dead';
    this.stateTime = 0;
    this.stateDuration = 10;
    this.vy = -420 * this.unit;
    this.vx = -this.facing * 220 * this.unit;
    this.onGround = false;
    this.invuln = 999;
    this.rot = 0;
    this.rotVel = rand(-8, 8);
    this.game.onPlayerDeath();
  }

  updateDead(dt) {
    this.animTime += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.vy += this.gravity * 0.55 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot = (this.rot || 0) + (this.rotVel || 0) * dt;
    if (this.y >= this.game.groundY) {
      this.y = this.game.groundY;
      if (this.vy > 200) {
        this.vy *= -0.32;
        this.rotVel *= 0.6;
        this.game.fx.dust(this.x, this.game.groundY, 8, 0, '#7ea5ca');
      } else {
        this.vy = 0;
        this.vx *= 0.85;
        this.rotVel *= 0.8;
      }
    }
    this.x = clamp(this.x, this.game.left + 20, this.game.right - 20);
  }
}
