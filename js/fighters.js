import { TAU, clamp, lerp, damp, rand, chance, pick, easeOutCubic, easeInCubic } from './utils.js';
import { makePose, clonePose, blendPose } from './stickman.js';

export const GRAVITY = 2150;
export const WORLD_WIDTH = 2200;
const FLOOR_MIN = 0.06;
const FLOOR_MAX = 0.94;

const attack = (base) => ({ ...base, duration: base.startup + base.active + base.recover });

export const PLAYER_ATTACKS = {
  punch1: attack({
    id: 'punch1', kind: 'punch', startup: 0.055, active: 0.085, recover: 0.135,
    damage: 6, range: 122, depth: 0.36, reachZ: 150, knock: 150, launch: 0,
    stun: 0.2, heavy: false, meter: 7, chain: 'punch2',
  }),
  punch2: attack({
    id: 'punch2', kind: 'punch', startup: 0.06, active: 0.09, recover: 0.15,
    damage: 7, range: 126, depth: 0.38, reachZ: 150, knock: 180, launch: 0,
    stun: 0.22, heavy: false, meter: 8, chain: 'punch3',
  }),
  punch3: attack({
    id: 'punch3', kind: 'punch', startup: 0.09, active: 0.1, recover: 0.27,
    damage: 13, range: 132, depth: 0.42, reachZ: 165, knock: 320, launch: 360,
    stun: 0.5, heavy: true, meter: 12, chain: null,
  }),
  kick: attack({
    id: 'kick', kind: 'kick', startup: 0.13, active: 0.1, recover: 0.31,
    damage: 15, range: 148, depth: 0.44, reachZ: 160, knock: 430, launch: 0,
    stun: 0.42, heavy: true, meter: 11, chain: null,
  }),
  air: attack({
    id: 'air', kind: 'kick', startup: 0.075, active: 0.17, recover: 0.16,
    damage: 11, range: 132, depth: 0.44, reachZ: 190, knock: 280, launch: 0,
    stun: 0.36, heavy: true, meter: 8, chain: null, air: true,
  }),
};

export const ENEMY_ATTACKS = {
  grunt: attack({
    id: 'swing', kind: 'punch', startup: 0.33, active: 0.11, recover: 0.42,
    damage: 7, range: 112, depth: 0.36, reachZ: 150, knock: 140, launch: 0,
    stun: 0.28, heavy: false, meter: 0, chain: null,
  }),
  ninja: attack({
    id: 'slash', kind: 'kick', startup: 0.21, active: 0.1, recover: 0.34,
    damage: 8, range: 118, depth: 0.4, reachZ: 160, knock: 190, launch: 0,
    stun: 0.3, heavy: false, meter: 0, chain: null,
  }),
  brute: attack({
    id: 'hammer', kind: 'punch', startup: 0.5, active: 0.14, recover: 0.56,
    damage: 14, range: 126, depth: 0.44, reachZ: 170, knock: 380, launch: 300,
    stun: 0.55, heavy: true, meter: 0, chain: null,
  }),
  boss: attack({
    id: 'royal', kind: 'punch', startup: 0.38, active: 0.16, recover: 0.48,
    damage: 15, range: 156, depth: 0.5, reachZ: 180, knock: 330, launch: 220,
    stun: 0.45, heavy: true, meter: 0, chain: null,
  }),
  bossSlam: attack({
    id: 'slam', kind: 'slam', startup: 0.62, active: 0.2, recover: 0.72,
    damage: 19, range: 220, depth: 0.9, reachZ: 170, knock: 430, launch: 330,
    stun: 0.6, heavy: true, meter: 0, chain: null, aoe: true, unblockable: false,
  }),
};

export const ENEMY_TYPES = {
  grunt: {
    hp: 34, speed: 158, depthSpeed: 0.95, height: 172, lineWidth: 0.052,
    score: 100, blockChance: 0.14, armor: 0, idealRange: 96, attackCd: [1.35, 2.4],
    attacks: ENEMY_ATTACKS.grunt, eyes: 'dot', name: 'MATÓN',
    colors: { body: '#eef3ff', far: '#8497b8', accent: '#ff6b6b', eye: '#ff3b4f', dark: '#0a0f1c' },
  },
  ninja: {
    hp: 27, speed: 212, depthSpeed: 1.25, height: 168, lineWidth: 0.046,
    score: 150, blockChance: 0.34, armor: 0, idealRange: 90, attackCd: [1.0, 1.85],
    attacks: ENEMY_ATTACKS.ninja, eyes: 'slit', name: 'SOMBRA', showBand: true,
    colors: { body: '#d9def0', far: '#66739a', accent: '#ff4fd8', eye: '#ff7ce8', dark: '#0b0a18' },
  },
  brute: {
    hp: 82, speed: 112, depthSpeed: 0.72, height: 202, lineWidth: 0.069,
    score: 260, blockChance: 0.26, armor: 1, idealRange: 108, attackCd: [1.9, 3.2],
    attacks: ENEMY_ATTACKS.brute, eyes: 'slit', name: 'MURO',
    colors: { body: '#f5e9d8', far: '#9b8870', accent: '#ffab4d', eye: '#ffb300', dark: '#140e09' },
  },
  boss: {
    hp: 270, speed: 138, depthSpeed: 0.9, height: 228, lineWidth: 0.082,
    score: 1500, blockChance: 0.22, armor: 2, idealRange: 118, attackCd: [1.5, 2.4],
    attacks: ENEMY_ATTACKS.boss, eyes: 'slit', name: 'EL REY', isBoss: true,
    colors: { body: '#f7e7ee', far: '#9b7284', accent: '#ff2f5e', eye: '#ff1744', dark: '#170710' },
  },
};

export const WAVES = [
  { title: 'OLEADA 1', sub: 'LOS DEL CALLEJÓN', spawns: [['grunt', 3]] },
  { title: 'OLEADA 2', sub: 'LLEGAN REFUERZOS', spawns: [['grunt', 4], ['ninja', 1]] },
  { title: 'OLEADA 3', sub: 'SOMBRAS EN LA LLUVIA', spawns: [['ninja', 3], ['grunt', 3]] },
  { title: 'OLEADA 4', sub: 'MUROS DE CARNE', spawns: [['brute', 2], ['grunt', 3], ['ninja', 1]] },
  { title: 'OLEADA FINAL', sub: 'EL REY TE ESPERA', boss: true, spawns: [['boss', 1], ['ninja', 2]] },
];

export class Fighter {
  constructor(game, opts = {}) {
    this.game = game;
    this.kind = opts.kind || 'grunt';
    this.isPlayer = Boolean(opts.isPlayer);
    this.isBoss = Boolean(opts.isBoss);
    this.name = opts.name || (this.isPlayer ? 'TÚ' : '');
    this.x = opts.x ?? WORLD_WIDTH / 2;
    this.y = opts.y ?? 0.62;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.facing = opts.facing ?? 1;
    this.height = opts.height ?? 178;
    this.lineWidth = opts.lineWidth ?? 0.052;
    this.colors = opts.colors || {};
    this.eyes = opts.eyes || 'dot';
    this.showScarf = Boolean(opts.showScarf);
    this.showBand = Boolean(opts.showBand);

    this.maxHp = opts.hp ?? 100;
    this.hp = this.maxHp;
    this.speed = opts.speed ?? 320;
    this.depthSpeed = opts.depthSpeed ?? 1.5;
    this.damageMul = opts.damageMul ?? 1;
    this.scoreValue = opts.score ?? 0;
    this.attackDefs = opts.attacks || null;
    this.blockChance = opts.blockChance ?? 0;
    this.armor = opts.armor ?? 0;
    this.idealRange = opts.idealRange ?? 100;

    this.state = 'idle';
    this.stateTime = 0;
    this.attack = null;
    this.attackTime = 0;
    this.attackCount = 0;
    this.hitTargets = new Set();
    this.queued = null;
    this.comboStep = 0;
    this.comboWindow = 0;
    this.lastAttack = null;
    this.meter = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.hpVisible = 0;
    this.telegraph = 0;
    this.walkPhase = rand(0, TAU);
    this.animPhase = rand(0, TAU);
    this.hurtTimer = 0;
    this.wasLaunched = false;
    this.downTimer = 0;
    this.downRot = 1.4;
    this.dodgeTime = 0;
    this.specialTime = 0;
    this.specialTick = 0;
    this.blockTimer = 0;
    this.blockCooldown = rand(0.4, 1.2);
    this.deadTimer = 0;
    this.deadRot = 1.4;
    this.alpha = 1;
    this.remove = false;
    this.heldToken = false;
    this.attackCooldown = rand(0.5, 1.4);
    this.aiTimer = rand(0.3, 0.9);
    this.aiBias = rand(-0.16, 0.16);
    this.strafe = pick([-1, 0, 1]);
    this.spawnTimer = 0;
    this.spawnFrom = 0;
    // Each enemy claims a small slot around the player so groups fan out
    // instead of collapsing into a single overlapping pile.
    this.sideBias = 0;
    this.slotOffset = rand(-4, 26);
    this.depthBias = rand(-0.16, 0.16);

    this.pose = makePose();
    this.poseTarget = makePose();
    this.rot = 0;
    this.trails = [];
    this.trailTimer = 0;
    this.landedDust = false;

    this.specialAmbient = 0;
  }

  get dead() {
    return this.state === 'dead';
  }

  get grounded() {
    return this.z <= 0.001;
  }

  baseUpdate(dt) {
    this.stateTime += dt;
    this.animPhase += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hpVisible = Math.max(0, this.hpVisible - dt);
    this.telegraph = Math.max(0, this.telegraph - dt);
    this.blockCooldown = Math.max(0, this.blockCooldown - dt);
    if (this.comboWindow > 0) {
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      if (this.comboWindow === 0) this.comboStep = 0;
    }

    // knockback + gravity
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx = damp(this.vx, 0, 6.5, dt);
    this.vy = damp(this.vy, 0, 6.5, dt);

    if (this.z > 0 || this.vz !== 0) {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0;
        const impact = this.vz;
        this.vz = 0;
        this.onLand(impact);
      }
    }

    this.x = clamp(this.x, 60, WORLD_WIDTH - 60);
    this.y = clamp(this.y, FLOOR_MIN, FLOOR_MAX);

    if (this.state === 'attack') {
      this.attackTime += dt;
      if (this.attack && this.attackTime >= this.attack.duration) this.finishAttack();
    } else if (this.state === 'dodge') {
      this.dodgeTime += dt;
      this.rot += dt * 17;
      if (this.dodgeTime > 0.34) {
        this.rot = 0;
        this.state = this.grounded ? 'idle' : 'jump';
      }
    } else if (this.state === 'special') {
      this.specialTime += dt;
      this.specialTick -= dt;
      this.rot += dt * 18;
      this.x += this.facing * 150 * dt;
      if (this.specialTick <= 0) {
        this.specialTick = 0.15;
        this.game.specialTick(this);
      }
      this.specialAmbient += dt;
      if (this.specialTime > 0.95) {
        this.rot = 0;
        this.state = 'idle';
        this.vx = this.facing * 260;
      }
    } else if (this.state === 'hurt') {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0 && this.grounded) {
        this.state = 'idle';
        this.wasLaunched = false;
      }
    } else if (this.state === 'down') {
      this.downTimer -= dt;
      this.rot = damp(this.rot, this.downRot, 9, dt);
      if (this.downTimer <= 0) {
        this.state = 'idle';
        this.invuln = Math.max(this.invuln, 0.55);
        this.rot = 0;
        this.game.particles.dust(this.x, this.y, 5);
      }
    } else if (this.state === 'block') {
      this.blockTimer -= dt;
      if (this.blockTimer <= 0) this.state = 'idle';
    }

    if (this.state === 'dead') {
      this.deadTimer += dt;
      if (this.deadTimer > 1.15) this.alpha = clamp(1 - (this.deadTimer - 1.15) / 0.55, 0, 1);
      if (this.deadTimer > 1.8) this.remove = true;
      this.rot = damp(this.rot, this.deadRot, 5.5, dt);
    }

    // motion trails for the flashy states
    if (this.state === 'special' || this.state === 'dodge') {
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = this.state === 'special' ? 0.045 : 0.05;
        this.trails.push({
          x: this.x, y: this.y, z: this.z, rot: this.rot,
          pose: clonePose(this.pose), life: 0.2, maxLife: 0.2,
        });
      }
    }
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.life -= dt;
      if (tr.life <= 0) this.trails.splice(i, 1);
    }

    this.updatePose(dt);
  }

  updatePose(dt) {
    const t = makePose();
    const phase = this.animPhase;
    const speedFactor = clamp(Math.hypot(this.vx, this.vy) / 220, 0, 1);
    const moving = this.state === 'walk';
    const attackE = this.attackEase();

    if (this.state === 'idle') {
      const breath = Math.sin(phase * 2.1) * 0.006;
      t.torso = 0.055 + breath * 0.5;
      t.bob = breath;
      t.armFar = [0.16 + Math.sin(phase * 2.1 + 0.4) * 0.02, 0.34];
      t.armNear = [0.1 + Math.sin(phase * 2.1) * 0.02, 0.3];
      t.legFar = [0.1, 0.12];
      t.legNear = [-0.1, 0.1];
    } else if (this.state === 'walk') {
      const p = this.walkPhase;
      const sw = Math.sin(p);
      t.torso = 0.13;
      t.bob = Math.abs(Math.cos(p)) * 0.011;
      t.legFar = [sw * 0.55, 0.12 + Math.max(0, -sw) * 0.55];
      t.legNear = [-sw * 0.55, 0.12 + Math.max(0, sw) * 0.55];
      t.armFar = [-sw * 0.38 + 0.06, 0.32];
      t.armNear = [sw * 0.38 + 0.04, 0.3];
    } else if (this.state === 'jump') {
      const rise = clamp(this.vz / 500, -1, 1);
      t.bob = -0.01;
      t.torso = 0.16 + rise * 0.08;
      t.armFar = [1.5 + rise * 0.4, 0.45];
      t.armNear = [1.1 + rise * 0.5, 0.6];
      t.legFar = [0.55, 1.05];
      t.legNear = [-0.15, 0.95];
    } else if (this.state === 'block') {
      t.bob = -0.018;
      t.torso = 0.16;
      t.armFar = [1.08, 1.75];
      t.armNear = [1.28, 1.85];
      t.legFar = [0.28, 0.22];
      t.legNear = [-0.3, 0.18];
    } else if (this.state === 'hurt') {
      const k = clamp(this.stateTime / 0.25, 0, 1);
      t.torso = -0.16 - 0.28 * k;
      t.headTilt = -0.2;
      t.armFar = [-0.55, 0.6];
      t.armNear = [0.9, 1.15];
      t.legFar = [0.32, 0.35];
      t.legNear = [-0.28, 0.25];
      t.bob = -0.02;
    } else if (this.state === 'down') {
      t.torso = 0.02;
      t.armFar = [1.35, 0.35];
      t.armNear = [-1.15, 0.4];
      t.legFar = [0.65, 0.55];
      t.legNear = [-0.55, 0.35];
    } else if (this.state === 'dodge') {
      t.torso = 0.95;
      t.armFar = [1.5, 1.35];
      t.armNear = [1.3, 1.5];
      t.legFar = [1.15, 1.45];
      t.legNear = [0.85, 1.5];
      t.bob = -0.01;
    } else if (this.state === 'special') {
      t.torso = 0.05;
      t.armFar = [1.48, 0.06];
      t.armNear = [1.62, 0.04];
      t.legFar = [0.75, 0.1];
      t.legNear = [-0.45, 0.1];
      t.bob = -0.02 + Math.sin(this.specialTime * 30) * 0.006;
    } else if (this.state === 'dead') {
      t.torso = 0.01;
      t.armFar = [1.2, 0.5];
      t.armNear = [-0.9, 0.55];
      t.legFar = [0.5, 0.4];
      t.legNear = [-0.5, 0.3];
    } else if (this.state === 'attack' && this.attack) {
      const e = attackE;
      if (this.attack.kind === 'punch') {
        t.torso = 0.06 + 0.24 * e;
        t.bob = -0.006 * e;
        t.armNear = [lerp(0.14, 1.5, e), lerp(0.34, 0.05, e)];
        t.armFar = [lerp(0.1, -0.55, e), lerp(0.34, 0.62, e)];
        t.legFar = [0.16 + 0.1 * e, 0.16];
        t.legNear = [-0.16 - 0.12 * e, 0.14];
      } else if (this.attack.kind === 'kick') {
        t.torso = 0.06 - 0.32 * e;
        t.bob = -0.018 * e;
        t.armNear = [lerp(0.1, -0.5, e), 0.55];
        t.armFar = [lerp(0.1, 1.0, e), 0.55];
        t.legNear = [lerp(-0.1, 1.32, e), lerp(0.1, 0.08, e)];
        t.legFar = [lerp(0.1, 0.26, e), 0.24];
      } else if (this.attack.kind === 'slam') {
        t.torso = 0.06 + 0.5 * e;
        t.bob = -0.07 * e;
        t.armFar = [lerp(0.2, 1.55, e), lerp(0.3, 0.1, e)];
        t.armNear = [lerp(0.2, 1.35, e), lerp(0.3, 0.2, e)];
        t.legFar = [0.3 + 0.2 * e, 0.2];
        t.legNear = [-0.3 - 0.2 * e, 0.2];
      }
    }

    if (speedFactor > 0.1 && this.state !== 'hurt' && this.state !== 'down' && this.state !== 'dodge') {
      t.torso += this.vx * 0.0004;
    }

    const smooth = this.state === 'attack' ? 30 : this.state === 'dodge' ? 25 : this.state === 'hurt' ? 22 : 16;
    blendPose(this.pose, t, dt, smooth);
  }

  attackEase() {
    if (!this.attack) return 0;
    const a = this.attack;
    const up = clamp(this.attackTime / Math.max(0.03, a.startup + a.active * 0.65), 0, 1);
    const down = clamp((this.attackTime - a.startup - a.active) / Math.max(0.03, a.recover), 0, 1);
    return easeOutCubic(up) * (1 - easeInCubic(down) * 0.94);
  }

  onLand(impact) {
    if (this.state === 'dead') {
      this.vx *= 0.4;
      return;
    }
    this.game.audio.play('land');
    this.game.particles.dust(this.x, this.y, 5);
    if (this.wasLaunched || this.state === 'hurt' && this.vzWasHigh) {
      this.state = 'down';
      this.downTimer = rand(0.85, 1.1);
      this.wasLaunched = false;
      this.downRot = this.vx >= 0 ? 1.45 : -1.45;
      this.game.particles.ring(this.x, this.y, 2, '#ffffff', 14, 0.35, 220);
      this.game.shake(0.25);
      this.game.audio.play('land');
    } else if (this.state === 'hurt') {
      this.state = 'idle';
    } else if (this.state === 'jump') {
      this.state = 'idle';
    }
  }

  startAttack(def) {
    this.state = 'attack';
    this.attack = def;
    this.attackTime = 0;
    this.hitTargets.clear();
    this.queued = null;
    this.comboWindow = 0;
    this.landedDust = false;
    this.faceTowardNearest(170);
    this.game.audio.play(def.heavy ? 'kickWhoosh' : 'whoosh');
    if (def.air) this.vz = Math.min(this.vz, 60);
    this.stateTime = 0;
    if (this.attackDefs === PLAYER_ATTACKS) {
      this.game.onPlayerAttackStart(this);
      if (def.id === 'punch1') this.comboStep = 1;
      else if (def.id === 'punch2') this.comboStep = 2;
      else if (def.id === 'punch3') this.comboStep = 3;
      else this.comboStep = 0;
      this.lastAttack = def;
    }
  }

  finishAttack() {
    const wasAir = this.attack?.air;
    const next = this.queued;
    this.attack = null;
    this.queued = null;
    this.state = this.z > 0 ? 'jump' : 'idle';

    if (wasAir) {
      this.state = this.z > 0 ? 'jump' : 'idle';
      this.comboStep = 0;
      return;
    }

    if (next === 'punch') {
      if (this.lastAttack && this.lastAttack.chain) {
        this.startAttack(PLAYER_ATTACKS[this.lastAttack.chain]);
        return;
      }
      this.startAttack(PLAYER_ATTACKS.punch1);
      return;
    }
    if (next === 'kick') {
      this.startAttack(PLAYER_ATTACKS.kick);
      return;
    }

    if (this.lastAttack === PLAYER_ATTACKS.punch1 || this.lastAttack === PLAYER_ATTACKS.punch2) {
      this.comboWindow = 0.55;
    } else if (this.lastAttack === PLAYER_ATTACKS.kick) {
      this.comboStep = 0;
      this.comboWindow = 0;
    } else {
      this.comboStep = 0;
    }
    if (this.state === 'idle') this.faceTowardNearest(300);
    if (this.isPlayer) this.game.onPlayerAttackEnd(this);
    else this.releaseToken();
  }

  requestPunch() {
    if (this.state === 'attack') {
      if (this.attackTime > this.attack.startup * 0.4) this.queued = 'punch';
      return;
    }
    if (this.z > 0) {
      this.startAttack(PLAYER_ATTACKS.air);
      return;
    }
    if (this.comboWindow > 0 && this.comboStep > 0 && this.comboStep < 3) {
      this.startAttack(PLAYER_ATTACKS['punch' + (this.comboStep + 1)]);
    } else {
      this.startAttack(PLAYER_ATTACKS.punch1);
    }
  }

  requestKick() {
    if (this.state === 'attack') {
      if (this.attackTime > this.attack.startup * 0.4) this.queued = 'kick';
      return;
    }
    this.startAttack(this.z > 0 ? PLAYER_ATTACKS.air : PLAYER_ATTACKS.kick);
  }

  startDodge(dir) {
    this.state = 'dodge';
    this.dodgeTime = 0;
    this.invuln = 0.34;
    this.vx = dir * 560;
    this.rot = 0;
    this.comboStep = 0;
    this.comboWindow = 0;
    this.attack = null;
    this.game.audio.play('dodge');
    this.game.particles.dust(this.x, this.y, 7);
    this.game.particles.add({
      x: this.x, y: this.y, z: 20, vx: -dir * 160, vy: 0, vz: 60,
      life: 0.3, maxLife: 0.3, size: 2, color: '#8cfbff', type: 'spark', gravity: 0, additive: true,
    });
  }

  startSpecial() {
    if (this.meter < 50) return false;
    this.meter -= 50;
    this.state = 'special';
    this.specialTime = 0;
    this.specialTick = 0;
    this.attack = null;
    this.hitTargets.clear();
    this.invuln = 0.28;
    this.rot = 0;
    this.comboStep = 0;
    this.comboWindow = 0;
    this.faceTowardNearest(400);
    this.game.audio.play('special');
    this.game.shake(0.22);
    this.game.particles.ring(this.x, this.y, 4, '#41f6ff', 24, 0.5, 380);
    return true;
  }

  faceTowardNearest(maxDist = 600) {
    let best = null;
    let bestD = Infinity;
    for (const e of this.game.enemies) {
      if (e.state === 'dead' || e.remove) continue;
      const d = Math.abs(e.x - this.x);
      if (d < bestD && Math.abs(e.y - this.y) < 0.55) { bestD = d; best = e; }
    }
    if (best && bestD < maxDist) {
      this.facing = best.x >= this.x ? 1 : -1;
      return best;
    }
    return null;
  }

  canBeHitBy(attacker, def) {
    if (this.state === 'dead' || this.remove || this.invuln > 0) return false;
    if (def.aoe) {
      const dx = this.x - attacker.x;
      const dy = Math.abs(this.y - attacker.y);
      return Math.abs(dx) <= def.range && dy <= def.depth && Math.abs(this.z - attacker.z) <= def.reachZ;
    }
    const forward = (this.x - attacker.x) * attacker.facing;
    if (forward < -22 || forward > def.range + 20) return false;
    if (Math.abs(this.y - attacker.y) > def.depth) return false;
    if (Math.abs(this.z - attacker.z) > def.reachZ) return false;
    return true;
  }

  takeHit(def, attacker, game) {
    if (this.state === 'dead' || this.remove) return 'dead';
    if (this.invuln > 0) return 'miss';

    const facingHit = (attacker.x - this.x) * this.facing >= 0;
    const blocking = this.state === 'block' && facingHit && !def.unblockable;
    if (blocking) {
      const chip = def.damage * 0.16 * attacker.damageMul;
      this.hp -= chip;
      this.hitFlash = 0.08;
      this.vx = attacker.facing * (def.knock * 0.25);
      this.invuln = Math.max(this.invuln, 0.12);
      if (this.isPlayer) {
        this.meter = clamp(this.meter + 3, 0, 100);
      }
      if (this.hp <= 0) {
        this.hp = 0;
        this.die(game, attacker);
        return 'ko';
      }
      return 'block';
    }

    const dmg = def.damage * attacker.damageMul;
    const noStun = this.armor >= 1 && !def.heavy && !def.launch;
    this.hp -= dmg;
    this.hitFlash = 0.1;
    this.hpVisible = 2.2;
    this.wasLaunched = Boolean(def.launch);
    this.invuln = 0.08;
    this.rot = 0;

    if (!noStun) {
      this.comboStep = 0;
      this.comboWindow = 0;
      this.queued = null;
      this.attack = null;
    }

    if (def.launch) {
      this.vz = def.launch;
      this.z = Math.max(this.z, 1);
      this.state = 'hurt';
      this.hurtTimer = 4;
      this.vy = rand(-0.1, 0.1);
    } else if (noStun) {
      // Armored fighters eat light hits without losing their stance.
      if (!['attack', 'dodge', 'special', 'hurt', 'down', 'dead'].includes(this.state)) this.state = 'idle';
      this.hurtTimer = 0;
    } else {
      this.state = 'hurt';
      this.hurtTimer = Math.max(0.12, def.stun);
    }

    this.vx = attacker.facing * def.knock * (this.armor >= 2 ? 0.62 : 1);
    this.vy = 0;

    if (this.isPlayer) {
      this.meter = clamp(this.meter + dmg * 0.9, 0, 100);
      game.onPlayerHurt(this, dmg);
    } else {
      this.meter = 0;
      this.stateTime = 0;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die(game, attacker);
      return 'ko';
    }
    return 'hit';
  }

  die(game, attacker) {
    this.state = 'dead';
    this.hp = 0;
    this.deadTimer = 0;
    this.deadRot = attacker.facing >= 0 ? 1.5 : -1.5;
    this.vx = attacker.facing * 280;
    this.vz = 300;
    this.z = Math.max(this.z, 1);
    this.attack = null;
    this.releaseToken();
    if (this.isPlayer) game.onPlayerDeath(this);
    else game.onEnemyDeath(this, attacker);
  }

  releaseToken() {
    if (this.heldToken) {
      this.heldToken = false;
      this.game.releaseAttackSlot(this);
    }
  }

  getActiveAttack() {
    if (this.state !== 'attack' || !this.attack) return null;
    const d = this.attack;
    if (this.attackTime < d.startup || this.attackTime > d.startup + d.active) return null;
    return d;
  }

  // ---------- player ----------
  updatePlayer(input, dt, game) {
    this.baseUpdate(dt);
    if (this.state === 'dead') return;
    if (game.state !== 'playing') return;

    const canAct = ['idle', 'walk', 'block'].includes(this.state) && this.grounded;
    const ix = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const iy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);

    if (input.pressed('special') && canAct && this.meter >= 50) {
      this.startSpecial();
      return;
    }
    if (input.pressed('dodge') && canAct) {
      const dir = ix !== 0 ? Math.sign(ix) : -this.facing;
      this.startDodge(dir);
      return;
    }
    if (input.pressed('jump') && canAct) {
      this.vz = 730;
      this.z = 1;
      this.state = 'jump';
      this.game.audio.play('jump');
      this.game.particles.dust(this.x, this.y, 4);
    }
    if (input.pressed('punch')) {
      if (this.state === 'attack') {
        this.requestPunch();
      } else if (canAct || (this.state === 'jump' && this.z > 0)) {
        this.requestPunch();
        return;
      }
    }
    if (input.pressed('kick')) {
      if (this.state === 'attack') {
        this.requestKick();
      } else if (canAct || (this.state === 'jump' && this.z > 0)) {
        this.requestKick();
        return;
      }
    }

    // blocking
    if (this.grounded && !['attack', 'dodge', 'special', 'hurt', 'down', 'dead'].includes(this.state)) {
      if (input.isDown('block')) {
        if (this.state !== 'block') {
          this.state = 'block';
          this.blockTimer = 999;
        }
        this.faceTowardNearest(500);
      } else if (this.state === 'block') {
        this.state = 'idle';
      }
    }

    const canMove = this.grounded && ['idle', 'walk'].includes(this.state);
    if (canMove) {
      if (ix !== 0 || iy !== 0) {
        this.state = 'walk';
        const len = Math.hypot(ix, iy);
        this.x += (ix / len) * this.speed * dt;
        this.y += (iy / len) * this.depthSpeed * dt;
        this.walkPhase += dt * 10.5;
        if (ix !== 0) this.facing = Math.sign(ix);
        else this.faceTowardNearest(300);
      } else {
        this.state = 'idle';
        this.faceTowardNearest(430);
      }
    } else if ((this.state === 'jump' || this.state === 'attack') && this.z > 0) {
      // subtle air control
      this.x += ix * this.speed * 0.55 * dt;
      this.y += iy * this.depthSpeed * 0.55 * dt;
    }
  }

  // ---------- enemy ----------
  updateEnemy(dt, game) {
    this.baseUpdate(dt);
    if (this.state === 'dead') return;

    if (this.state === 'spawn') {
      this.spawnTimer -= dt;
      const dir = this.spawnFrom > 0 ? -1 : 1;
      this.x += dir * this.speed * 0.8 * dt;
      this.y = damp(this.y, 0.62, 2, dt);
      this.facing = dir;
      if (this.spawnTimer <= 0) {
        this.state = 'idle';
        this.spawnFade = 0;
      }
      return;
    }

    if (this.state === 'block') {
      if (this.blockTimer <= 0) this.state = 'idle';
      this.faceTowardNearest(500);
      return;
    }
    if (this.state === 'hurt' || this.state === 'down' || this.state === 'attack' || this.state === 'special') return;

    const player = game.player;
    if (!player || player.state === 'dead' || game.state !== 'playing') {
      this.state = 'idle';
      return;
    }

    this.facing = player.x < this.x ? -1 : 1;
    this.attackCooldown -= dt;
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = rand(0.7, 1.7);
      this.strafe = pick([-1, -1, 0, 1]);
    }

    const dx = player.x - this.x;
    const adx = Math.abs(dx);
    const dy = player.y - this.y;
    const ideal = this.idealRange;

    // Hold a slot at this enemy's own side/depth around the player.
    // If every closer ally on this side is gone, collapse the reserve lane
    // so the last fighter presses the attack instead of loitering.
    if (this.slotOffset > 12) {
      const closerAlly = game.enemies.some((other) => {
        if (other === this || other.dead || other.remove || other.sideBias !== this.sideBias) return false;
        return Math.abs(other.x - player.x) < Math.abs(this.x - player.x) - 18;
      });
      if (!closerAlly) this.slotOffset = Math.max(0, this.slotOffset - dt * 42);
    }
    const targetX = player.x + this.sideBias * (ideal + this.slotOffset);
    const targetY = clamp(player.y + this.depthBias, FLOOR_MIN + 0.03, FLOOR_MAX - 0.03);
    const sdx = targetX - this.x;
    const sdy = targetY - this.y;
    let moveX = 0;
    let moveY = 0;
    let walked = false;

    if (Math.abs(sdx) > 10) {
      moveX = Math.sign(sdx);
      walked = true;
    } else if (adx < ideal - 34) {
      moveX = -Math.sign(dx) * 0.55;
      walked = true;
    }

    if (Math.abs(sdy) > 0.018) {
      moveY = clamp(sdy * 5, -1, 1) * 0.9;
      walked = true;
    } else if (this.strafe !== 0 && adx < ideal + 40) {
      moveY = this.strafe * 0.2;
      walked = true;
    }

    if (walked) {
      this.state = 'walk';
      this.x += moveX * this.speed * dt;
      this.y += moveY * this.depthSpeed * dt;
      this.walkPhase += dt * (this.speed / 26);
    } else {
      this.state = 'idle';
    }

    const canAttack = adx < ideal + 30 && adx > 34 && Math.abs(dy) < 0.18;
    if (canAttack && this.attackCooldown <= 0 && this.grounded && game.requestAttackSlot(this)) {
      this.heldToken = true;
      this.attackCount++;
      let def = this.attackDefs;
      if (this.isBoss && this.attackCount % 3 === 0) def = ENEMY_ATTACKS.bossSlam;
      this.startAttack(def);
      this.attackCooldown = rand(this.attackDefs === ENEMY_ATTACKS.ninja ? 1.1 : 1.5, this.attackDefs === ENEMY_ATTACKS.ninja ? 2.0 : 2.8);
      this.telegraph = def.startup;
      this.game.audio.play('warn');
    }
  }

  maybeBlock(game) {
    if (this.state !== 'idle' && this.state !== 'walk') return false;
    if (this.blockCooldown > 0 || !this.grounded) return false;
    if (this.attackCooldown < 0.35) return false;
    if (!chance(this.blockChance)) return false;
    this.state = 'block';
    this.blockTimer = rand(0.32, 0.6);
    this.blockCooldown = rand(1.6, 3.2);
    this.hitFlash = 0;
    this.game.audio.play('block');
    return true;
  }

  get isBlocking() {
    return this.state === 'block';
  }
}

export function createPlayer(game) {
  return new Fighter(game, {
    isPlayer: true,
    kind: 'player',
    name: 'TÚ',
    x: 640,
    y: 0.62,
    facing: 1,
    hp: 100,
    speed: 335,
    depthSpeed: 1.55,
    height: 178,
    lineWidth: 0.054,
    attacks: PLAYER_ATTACKS,
    colors: { body: '#f6faff', far: '#9fb6d6', accent: '#41f6ff', eye: '#bffcff', dark: '#080e1d' },
    showScarf: true,
    eyes: 'dot',
  });
}

export function createEnemy(game, kind, x, y, waveIndex = 0) {
  const type = ENEMY_TYPES[kind];
  return new Fighter(game, {
    kind,
    isBoss: Boolean(type.isBoss),
    name: type.name,
    x,
    y,
    facing: x > WORLD_WIDTH / 2 ? -1 : 1,
    hp: type.hp,
    speed: type.speed,
    depthSpeed: type.depthSpeed,
    height: type.height,
    lineWidth: type.lineWidth,
    score: type.score,
    blockChance: type.blockChance,
    armor: type.armor,
    idealRange: type.idealRange,
    attacks: type.attacks,
    colors: type.colors,
    eyes: type.eyes,
    showBand: type.showBand,
    damageMul: 1 + waveIndex * 0.07,
    attackCd: type.attackCd,
  });
}
