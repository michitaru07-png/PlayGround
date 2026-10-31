import { World } from './world.js';
import { Particles } from './particles.js';
import { createPlayer, createEnemy, WAVES, WORLD_WIDTH, PLAYER_ATTACKS } from './fighters.js';
import { drawStickman, drawGroundShadow } from './stickman.js';
import { clamp, damp, rand, chance, pick, formatScore, formatTime, TAU } from './utils.js';

const COMBO_RANKS = [
  { at: 0, text: '' },
  { at: 5, text: '¡BIEN!' },
  { at: 10, text: '¡BRUTAL!' },
  { at: 18, text: '¡IMPARABLE!' },
  { at: 30, text: '¡LEGENDARIO!' },
];

const COMBO_CALLOUTS = {
  10: '¡BRUTAL!',
  18: '¡IMPARABLE!',
  30: '¡DEMOLICIÓN!',
};

export class Game {
  constructor(canvas, ui, input, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.input = input;
    this.audio = audio;
    this.world = new World();
    this.particles = new Particles();

    this.state = 'menu';
    this.time = 0;
    this.elapsed = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.trauma = 0;
    this.flashValue = 0;
    this.player = null;
    this.enemies = [];
    this.pickups = [];
    this.callouts = [];
    this.tokens = new Set();
    this.attackTokens = 0;
    this.waveIndex = -1;
    this.waveTotal = WAVES.length;
    this.waveState = 'idle';
    this.wave = null;
    this.waveNum = 1;
    this.spawnQueue = [];
    this.spawnClock = 0;
    this.introTimer = 0;
    this.clearTimer = 0;
    this.victoryPending = false;
    this.deathTimer = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboBest = 0;
    this.score = 0;
    this.kills = 0;
    this.bossRef = null;
    this.pickupTimer = 0;
    this.specialFxTimer = 0;
    this.hintTimer = 0;

    try {
      this.best = Number(localStorage.getItem('sticksmash.best') || 0);
    } catch {
      this.best = 0;
    }

    this.resize();
    this.makeMenuScene();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
  }

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The title screen only needs the canvas as a soft painted backdrop; a
    // half-resolution backing store keeps software renderers responsive so
    // the JUGAR button stays clickable.
    const renderScale = this.state === 'menu' ? 0.5 : 1;
    this.W = W;
    this.H = H;
    this.dpr = dpr * renderScale;
    this.canvas.width = Math.round(W * dpr * renderScale);
    this.canvas.height = Math.round(H * dpr * renderScale);
    this.canvas.style.width = `${W}px`;
    this.canvas.style.height = `${H}px`;
    this.s = clamp(Math.min(W / 1120, H / 720), 0.48, 1.55);
    const touch = this.input?.usingTouch || matchMedia('(hover: none) and (pointer: coarse)').matches ||
      'ontouchstart' in window;
    this.baseline = Math.round(H * (touch ? 0.63 : 0.71));
    this.depthPx = 150 * this.s;
    if (this.player) this.updateCamera(1, true);
    if (this.state === 'menu') this.camX = 1690;
  }

  makeMenuScene() {
    this.menuActors = [];
    const p = createPlayer(this);
    p.x = 1730;
    p.y = 0.62;
    p.facing = 1;
    const g1 = createEnemy(this, 'grunt', 1838, 0.62, 0);
    g1.facing = -1;
    const g2 = createEnemy(this, 'ninja', 1872, 0.3, 0);
    g2.facing = -1;
    this.menuActors = [g2, p, g1];
    this.menuTimer = 1.2;
    this.camX = 1690;
  }

  clearFighters() {
    for (const e of this.enemies) e.releaseToken();
    this.enemies = [];
    this.player = null;
    this.tokens.clear();
    this.attackTokens = 0;
    this.bossRef = null;
  }

  startGame() {
    this.audio.resume();
    this.audio.startMusic();
    this.ui.hideTitle();
    this.ui.hidePause();
    this.ui.hideGameOver();
    this.ui.hideVictory();
    this.ui.showHud(true);
    this.ui.showTouch(this.input.usingTouch || matchMedia('(hover: none) and (pointer: coarse)').matches);
    this.ui.flash('rgba(65, 246, 255, 0.16)', 0.3);
    this.input.clearVirtual();

    this.clearFighters();
    this.particles.clear();
    this.pickups.length = 0;
    this.callouts.length = 0;
    this.player = createPlayer(this);
    this.player.x = 660;
    this.player.y = 0.62;
    this.camX = this.player.x;
    this.enemies = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboBest = 0;
    this.kills = 0;
    this.elapsed = 0;
    this.best = this.best || 0;
    this.startBest = this.best;
    this.runId = (this.runId || 0) + 1;
    this.waveIndex = -1;
    this.waveState = 'idle';
    this.spawnQueue = [];
    this.victoryPending = false;
    this.bossRef = null;
    this.trauma = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.state = 'playing';
    this.world.setMenuMode(false);
    this.ui.setBoss(false);
    this.ui.setWave(1, WAVES.length);
    this.ui.updateHud(this);
    this.resize();
    this.startWave(0);
    this.spawnOpeningCrew();
  }

  // The first wave is already waiting in the street when the fight begins,
  // so the opening frame has a full tableau instead of an empty stage.
  spawnOpeningCrew() {
    const p = this.player;
    const spots = [
      { dx: -140, y: 0.64, side: -1, slot: 0, depth: -0.02 },
      { dx: 205, y: 0.60, side: 1, slot: 0, depth: 0.03 },
      { dx: -245, y: 0.48, side: -1, slot: 52, depth: -0.12 },
    ];
    for (const spot of spots) {
      const enemy = createEnemy(this, 'grunt', p.x + spot.dx, spot.y, 0);
      enemy.state = 'idle';
      enemy.spawnFrom = spot.side;
      enemy.facing = enemy.x < p.x ? 1 : -1;
      enemy.sideBias = spot.side;
      enemy.slotOffset = spot.slot;
      enemy.depthBias = spot.depth;
      this.enemies.push(enemy);
    }
    this.spawnQueue.length = 0;
    this.waveState = 'active';
  }

  restart() {
    this.startGame();
  }

  toMenu() {
    this.audio.stopMusic();
    this.state = 'menu';
    this.clearFighters();
    this.pickups.length = 0;
    this.particles.clear();
    this.makeMenuScene();
    this.world.setMenuMode(true);
    this.resize();
    this.ui.hidePause();
    this.ui.hideGameOver();
    this.ui.hideVictory();
    this.ui.showHud(false);
    this.ui.showTouch(false);
    this.ui.setBoss(false);
    this.ui.showTitle(this.best);
    this.ui.hint(false);
    this.combo = 0;
    this.trauma = 0;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.clearVirtual();
    this.ui.showPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hidePause();
    this.audio.resume();
    this.input.clearVirtual();
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  // ---------- wave flow ----------
  startWave(index) {
    this.waveIndex = index;
    this.wave = WAVES[index];
    this.waveState = 'intro';
    this.introTimer = index === 0 ? 0.35 : 1.7;
    this.spawnClock = 0;
    this.spawnQueue = [];
    let t = 0;
    let spawnIndex = 0;
    for (const [kind, count] of this.wave.spawns) {
      for (let i = 0; i < count; i++) {
        const delay = kind === 'boss' ? 0.1 : index === 0 ? 0.3 : 0.55;
        this.spawnQueue.push({ kind, at: t, side: spawnIndex++ % 2 === 0 ? -1 : 1 });
        t += delay;
      }
    }
    if (!this.wave.boss) {
      // Randomize the arrival order a little, keeping waves readable.
      for (let i = this.spawnQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.spawnQueue[i], this.spawnQueue[j]] = [this.spawnQueue[j], this.spawnQueue[i]];
        this.spawnQueue[i].at = i === 0 ? 0 : this.spawnQueue[i].at;
      }
      this.spawnQueue.sort((a, b) => a.at - b.at);
      this.spawnQueue[0].at = 0;
    }
    this.ui.setWave(index + 1, WAVES.length);
    this.ui.banner(
      this.wave.title.replace(/(\d+)/, '<em>$1</em>'),
      this.wave.sub,
      false
    );
    this.audio.play('wave');
    if (!this.wave.boss) this.ui.setBoss(false);
    this.tokens.clear();
    this.attackTokens = 0;
  }

  spawnEnemy(kind, preferredSide = null) {
    const half = this.W / (2 * this.s);
    let x;
    let side = preferredSide ?? (chance(0.5) ? -1 : 1);
    let y = rand(0.26, 0.86);
    if (kind === 'boss') {
      x = this.camX + 260;
      if (x > WORLD_WIDTH - 160) x = this.camX - 260;
      y = 0.6;
      side = x > this.player.x ? 1 : -1;
    } else {
      // The opening wave walks in from just inside the frame so the first
      // seconds read as a fight instead of an empty street.
      const spread = this.waveIndex === 0 ? half * 0.52 : half + 90;
      x = this.camX + side * spread;
      // At the stage edges there is no room outside the camera; let the
      // fighter fade in at the boundary instead of teleporting to the far side.
      x = clamp(x, 40, WORLD_WIDTH - 40);
      side = x >= this.player.x ? 1 : -1;
    }
    x = clamp(x, 80, WORLD_WIDTH - 80);
    const enemy = createEnemy(this, kind, x, y, this.waveIndex);
    enemy.spawnFrom = side;
    enemy.spawnTimer = kind === 'boss' ? 0.9 : this.waveIndex === 0 ? 0.35 : 0.55;
    enemy.state = 'spawn';
    enemy.facing = x > this.player.x ? -1 : 1;
    enemy.sideBias = side;
    if (kind === 'boss') {
      enemy.slotOffset = 0;
      enemy.depthBias = 0;
    } else {
      // Stack allies that share a side into staggered range lanes, and
      // alternate their depth so a pair reads as two fighters, not one.
      const sameSide = this.enemies.filter((e) => !e.dead && e.sideBias === side).length;
      enemy.slotOffset = rand(-2, 12) + sameSide * 54;
      enemy.depthBias = (sameSide % 2 === 0 ? -1 : 1) * rand(0.06, 0.16);
    }
    this.enemies.push(enemy);

    if (kind === 'boss') {
      this.bossRef = enemy;
      this.ui.setBoss(true);
      this.ui.updateBoss(enemy);
      this.audio.play('roar');
      this.shake(0.75);
      this.slowmo = Math.max(this.slowmo, 0.55);
      this.ui.banner('EL <em>REY</em>', 'JEFE FINAL', true);
    } else {
      this.particles.dust(x, y, 6);
    }
  }

  updateWaves(dt) {
    if (this.waveState === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) {
        this.waveState = 'spawning';
        this.spawnClock = 0;
      }
      return;
    }

    if (this.waveState === 'spawning' || this.waveState === 'active') {
      this.spawnClock += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].at <= this.spawnClock) {
        const next = this.spawnQueue.shift();
        this.spawnEnemy(next.kind, next.side);
      }
      if (this.spawnQueue.length === 0 && this.waveState === 'spawning') this.waveState = 'active';
      if (
        this.waveState === 'active' &&
        this.enemies.every((e) => e.dead) &&
        !this.victoryPending &&
        !this.wave.boss
      ) {
        this.waveState = 'clear';
        this.clearTimer = 2.2;
        this.player.hp = clamp(this.player.hp + 18, 0, this.player.maxHp);
        this.ui.banner('OLEADA <em>SUPERADA</em>', '+18 VIDA · PREPARA EL SIGUIENTE GOLPE', true);
        this.audio.play('waveClear');
        this.spawnPickup(this.camX + rand(-120, 120), rand(0.35, 0.8));
      }
      return;
    }

    if (this.waveState === 'clear') {
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) {
        if (this.waveIndex + 1 < WAVES.length) this.startWave(this.waveIndex + 1);
        else this.startVictory();
      }
    }
  }

  startVictory() {
    if (this.victoryPending || this.state === 'victory') return;
    this.victoryPending = true;
    const runId = this.runId;
    this.slowmo = Math.max(this.slowmo, 1.1);
    this.ui.setBoss(false);
    for (const e of this.enemies) {
      if (!e.dead) {
        e.die(this, this.player);
      }
    }
    setTimeout(() => {
      if (runId !== this.runId) return;
      if (this.state !== 'playing' && this.state !== 'dying') return;
      this.state = 'victory';
      this.audio.stopMusic();
      this.audio.play('waveClear');
      this.saveBest();
      this.ui.showVictory(this);
    }, 1900);
  }

  // ---------- combat ----------
  requestAttackSlot(enemy) {
    const max = this.bossRef && !this.bossRef.dead ? 3 : 2;
    if (this.attackTokens >= max) return false;
    this.attackTokens++;
    this.tokens.add(enemy);
    return true;
  }

  releaseAttackSlot(enemy) {
    if (this.tokens.delete(enemy)) {
      this.attackTokens = Math.max(0, this.attackTokens - 1);
    }
  }

  onPlayerAttackStart(player) {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.state === 'hurt' || enemy.state === 'down') continue;
      const d = Math.abs(enemy.x - player.x);
      if (d > 200) continue;
      if (Math.abs(enemy.y - player.y) > 0.3) continue;
      const facing = (enemy.x - player.x) * player.facing > 0;
      if (facing) enemy.maybeBlock(this);
    }
  }

  onPlayerAttackEnd() {}

  resolveHits() {
    const p = this.player;
    if (p && p.state === 'attack') {
      const def = p.getActiveAttack();
      if (def) {
        for (const enemy of this.enemies) {
          if (enemy.dead || p.hitTargets.has(enemy)) continue;
          if (!enemy.canBeHitBy(p, def)) continue;
          p.hitTargets.add(enemy);
          const result = enemy.takeHit(def, p, this);
          if (result === 'miss') continue;
          const blocked = result === 'block';
          this.impact(enemy, p, def, blocked);
          if (!blocked) {
            p.meter = clamp(p.meter + def.meter, 0, 100);
            this.registerHit(enemy, def, result === 'ko');
          }
        }
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const def = enemy.getActiveAttack();
      if (!def) continue;
      if (enemy.hitTargets.has(p)) continue;
      if (!p || !p.canBeHitBy(enemy, def)) continue;
      enemy.hitTargets.add(p);
      const result = p.takeHit(def, enemy, this);
      if (result === 'miss') continue;
      this.impact(p, enemy, def, result === 'block');
      if (def.aoe) {
        this.particles.ring(enemy.x, enemy.y, 2, '#ff2f5e', 20, 0.55, 700);
        this.particles.dust(enemy.x, enemy.y, 16, 'rgba(255, 120, 140, 0.5)');
        this.shake(0.6);
        this.hitstop = Math.max(this.hitstop, 0.09);
      }
    }
  }

  specialTick(player) {
    const def = {
      id: 'specialTick', kind: 'kick', damage: 4.2, range: 172, depth: 0.62,
      reachZ: 220, knock: 130, launch: 0, stun: 0.18, heavy: false, unblockable: true,
    };
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (!enemy.canBeHitBy(player, def)) continue;
      const result = enemy.takeHit(def, player, this);
      if (result === 'miss') continue;
      this.particles.burst(enemy.x, enemy.y, 62, {
        count: 5, speed: 190, colors: ['#41f6ff', '#8cfbff', '#ffffff'],
        size: [1.5, 3.5], gravity: 200, drag: 3,
      });
      this.particles.ring(enemy.x, enemy.y, 46, '#41f6ff', 10, 0.25, 260);
      this.audio.play('specialHit');
      if (result !== 'block') this.registerHit(enemy, def, result === 'ko');
      this.shake(0.1);
    }
    this.particles.ring(player.x, player.y, 4, '#41f6ff', 26, 0.4, 420);
  }

  impact(target, attacker, def, blocked) {
    const color = blocked ? '#ffffff' : (attacker.colors?.accent || '#ffd66b');
    const z = 55 + rand(-18, 26);
    this.particles.burst(target.x, target.y, target.z + z, {
      count: blocked ? 6 : def.heavy ? 16 : 9,
      speed: blocked ? 160 : def.heavy ? 380 : 260,
      colors: blocked
        ? ['#ffffff', '#9fe9ff']
        : [color, '#ffffff', attacker.colors?.eye || '#ffe28a'],
      size: def.heavy ? [2, 5] : [1.5, 3.5],
      gravity: 720,
      drag: 3.2,
      angle: attacker.facing >= 0 ? 0 : Math.PI,
      spread: Math.PI * 0.8,
      zSpread: 0.9,
    });
    this.particles.ring(target.x, target.y, target.z + z, color, def.heavy ? 16 : 10, 0.28, def.heavy ? 300 : 210);
    if (!blocked && def.heavy) {
      this.particles.burst(target.x, target.y, target.z + z, {
        count: 5, speed: 90, colors: ['#ffffff'], size: [4, 9], gravity: -20,
        type: 'dust', additive: false, alpha: 0.3, drag: 2,
      });
    }
    this.audio.play(blocked ? 'block' : def.heavy ? 'hitHeavy' : 'hit', { pitch: rand(0.9, 1.12) });
    this.shake(blocked ? 0.08 : def.heavy ? 0.42 : 0.2);
    this.hitstop = Math.max(this.hitstop, blocked ? 0.035 : def.heavy ? 0.08 : 0.05);
    if (def.heavy && !blocked) {
      this.flashValue = Math.max(this.flashValue, 0.22);
      this.ui.flash('rgba(255, 255, 255, 0.28)', 0.35);
    }
    if (blocked) {
      this.particles.text(target.x, target.y, target.z + 100, 'BLOQUEO', {
        color: '#bfefff', size: 13, font: 'mono', italic: false, life: 0.45,
      });
    } else {
      const dmg = Math.round(def.damage * attacker.damageMul);
      this.particles.text(target.x + rand(-10, 10), target.y, target.z + 92, `-${dmg}`, {
        color: def.heavy ? '#ffb44d' : '#f5fbff',
        size: def.heavy ? 25 : 18,
        life: def.heavy ? 0.75 : 0.55,
      });
    }
  }

  registerHit(target, def, ko) {
    this.combo++;
    this.comboTimer = 2.4;
    this.comboBest = Math.max(this.comboBest, this.combo);
    const mult = this.comboMultiplier();
    this.score += Math.round(def.damage * 10 * mult) + (ko ? Math.round((target.scoreValue || 0) * (1 + mult * 0.35)) : 0);
    if (this.score > this.best) {
      this.best = this.score;
      this.saveBest();
    }
    if (!ko) {
      this.particles.text(target.x, target.y, target.z + 150, `${this.combo}`, {
        color: `hsl(${clamp(190 - this.combo * 2.5, 15, 190)}, 100%, 68%)`,
        size: 12 + Math.min(10, this.combo * 0.25),
        font: 'mono', italic: false, life: 0.35, shadow: false,
      });
    }
    if (COMBO_CALLOUTS[this.combo]) {
      const rank = COMBO_RANKS.filter((r) => r.at <= this.combo).pop();
      this.showCallout(COMBO_CALLOUTS[this.combo], rank?.text || '', this.combo >= 30 ? '#ff9d4d' : '#ff3d9a', 1.3);
      this.shake(0.22);
    }
  }

  comboMultiplier() {
    return 1 + Math.min(4, Math.floor(this.combo / 5) * 0.5);
  }

  comboRank() {
    return COMBO_RANKS.filter((r) => r.at <= this.combo).pop()?.text || '';
  }

  onEnemyDeath(enemy, attacker) {
    this.kills++;
    const isBoss = enemy.isBoss;
    this.particles.burst(enemy.x, enemy.y, enemy.z + 80, {
      count: isBoss ? 40 : 18,
      speed: isBoss ? 520 : 320,
      colors: [enemy.colors.accent, '#ffffff', '#8cfbff', enemy.colors.body],
      size: isBoss ? [3, 8] : [2, 5],
      gravity: 900, drag: 1.6, type: 'shard', additive: false,
      width: [2, 4],
    });
    this.particles.ring(enemy.x, enemy.y, 3, enemy.colors.accent, isBoss ? 40 : 18, isBoss ? 0.9 : 0.45, isBoss ? 800 : 380);
    this.audio.play(isBoss ? 'ko' : 'death');
    this.shake(isBoss ? 0.95 : 0.28);
    if (isBoss) {
      this.slowmo = Math.max(this.slowmo, 1.35);
      this.flashValue = 0.7;
      this.ui.flash('rgba(255, 61, 154, 0.32)', 0.7);
      this.ui.setBoss(false);
      this.bossRef = null;
      this.showCallout('K.O.', 'EL REY HA CAÍDO', '#ff2f5e', 2.6);
      this.startVictory();
    } else {
      this.spawnPickup(enemy.x, enemy.y);
      if (chance(0.25)) {
        this.particles.text(enemy.x, enemy.y, enemy.z + 130, '+100', {
          color: '#b8ff63', size: 14, font: 'mono', italic: false, life: 0.6,
        });
      }
    }
  }

  onPlayerDeath(player) {
    if (this.state !== 'playing') return;
    this.state = 'dying';
    this.deathTimer = 2.1;
    this.slowmo = Math.max(this.slowmo, 1.0);
    this.shake(0.9);
    this.audio.stopMusic();
    this.audio.play('ko');
    this.ui.flash('rgba(255, 77, 94, 0.45)', 0.6);
  }

  onPlayerHurt(player, dmg) {
    this.combo = 0;
    this.comboTimer = 0;
    this.shake(0.3);
    this.ui.flash('rgba(255, 77, 94, 0.2)', 0.4);
  }

  spawnPickup(x, y) {
    if (this.pickups.length > 2) return;
    this.pickups.push({
      x: clamp(x, 100, WORLD_WIDTH - 100),
      y: clamp(y, 0.15, 0.9),
      bob: rand(0, TAU),
      life: 22,
    });
  }

  updatePickups(dt) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dt;
      pk.bob += dt * 4;
      if (pk.life <= 0) { this.pickups.splice(i, 1); continue; }
      if (!p || p.state === 'dead') continue;
      if (Math.abs(pk.x - p.x) < 42 && Math.abs(pk.y - p.y) < 0.22) {
        p.hp = clamp(p.hp + 20, 0, p.maxHp);
        p.meter = clamp(p.meter + 10, 0, 100);
        this.audio.play('pickup');
        this.particles.burst(pk.x, pk.y, 40, {
          count: 14, speed: 160, colors: ['#b8ff63', '#37ffb0', '#ffffff'],
          size: [2, 4], gravity: -80, drag: 2,
        });
        this.particles.text(pk.x, pk.y, 100, '+20 VIDA', {
          color: '#b8ff63', size: 15, font: 'mono', italic: false, life: 0.8,
        });
        this.ui.flash('rgba(184, 255, 99, 0.12)', 0.25);
        this.pickups.splice(i, 1);
      }
    }
  }

  // ---------- update ----------
  update(realDt) {
    const dt = Math.min(realDt, 0.05);
    this.time += dt;
    this.world.update(dt);
    this.updateCamera(dt);

    if (this.state === 'menu') {
      this.updateMenu(dt);
      this.particles.update(dt);
      this.flashValue = Math.max(0, this.flashValue - dt * 2.8);
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.particles.update(dt * 0.25);
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
      return;
    }

    if (this.slowmo > 0) this.slowmo = Math.max(0, this.slowmo - dt);
    const simDt = dt * (this.slowmo > 0 ? 0.34 : 1);
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    this.flashValue = Math.max(0, this.flashValue - dt * 3);

    if (this.state === 'paused' || this.state === 'gameover' || this.state === 'victory') {
      this.particles.update(dt * 0.2);
      return;
    }

    if (this.state === 'playing') {
      this.elapsed += simDt;
      this.comboTimer -= simDt;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
      }
      this.player?.updatePlayer(this.input, simDt, this);
      for (const enemy of this.enemies) enemy.updateEnemy(simDt, this);
      this.resolveHits();
      this.separate();
      this.updatePickups(simDt);
      this.updateWaves(simDt);
      this.cleanup();

      if (this.player?.state === 'special') {
        this.specialFxTimer -= simDt;
        if (this.specialFxTimer <= 0) {
          this.specialFxTimer = 0.035;
          const a = rand(0, TAU);
          this.particles.add({
            x: this.player.x + Math.cos(a) * rand(40, 110),
            y: this.player.y + Math.sin(a) * 0.12,
            z: 30 + Math.sin(a) * 50,
            vx: -Math.cos(a) * 260, vy: 0, vz: 90,
            life: 0.3, maxLife: 0.3, size: rand(1.5, 3.5),
            color: chance(0.5) ? '#41f6ff' : '#ff3d9a',
            type: 'spark', gravity: 0, drag: 2, additive: true,
          });
        }
      }

      // Aura particles for the boss keep the finale loud.
      if (this.bossRef && !this.bossRef.dead && this.bossRef.state !== 'spawn' && chance(0.35)) {
        const b = this.bossRef;
        this.particles.add({
          x: b.x + rand(-30, 30), y: b.y + rand(-0.04, 0.04), z: rand(20, 180),
          vx: rand(-20, 20), vy: 0, vz: rand(20, 60),
          life: 0.5, maxLife: 0.5, size: rand(1, 2.4),
          color: '#ff2f5e', type: 'spark', gravity: -30, drag: 1.5, additive: true,
        });
      }
    } else if (this.state === 'dying') {
      this.deathTimer -= dt;
      for (const enemy of this.enemies) enemy.updateEnemy(simDt, this);
      this.updatePickups(simDt);
      this.cleanup();
      if (this.deathTimer <= 0) {
        this.state = 'gameover';
        this.saveBest();
        this.ui.showGameOver(this);
      }
    }

    this.particles.update(simDt);
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
    this.ui.updateHud(this);
    if (this.bossRef && !this.bossRef.dead) this.ui.updateBoss(this.bossRef);
  }

  updateMenu(dt) {
    this.menuTimer -= dt;
    for (const actor of this.menuActors) {
      actor.baseUpdate(dt);
      if (actor.state === 'idle') {
        actor.facing = this.menuActors[1].x >= actor.x ? 1 : -1;
      }
    }
    if (this.menuTimer <= 0) {
      this.menuTimer = rand(1.2, 2.4);
      const candidates = this.menuActors.filter((a) => a.state === 'idle');
      if (candidates.length) {
        const actor = pick(candidates);
        actor.facing = this.menuActors[1].x >= actor.x ? 1 : -1;
        actor.state = 'attack';
        actor.attack = pick([PLAYER_ATTACKS.punch1, PLAYER_ATTACKS.punch2, PLAYER_ATTACKS.kick]);
        actor.attackTime = 0;
        actor.hitTargets.clear();
        actor.stateTime = 0;
        const other = this.menuActors[1];
        this.particles.burst(
          (actor.x + other.x) / 2, actor.y, 70,
          { count: 5, speed: 160, colors: [actor.colors.accent, '#ffffff'], size: [1.4, 3], gravity: 300, drag: 3 }
        );
      }
    }
  }

  updateCamera(dt, immediate = false) {
    if (!this.player) return;
    const half = this.W / (2 * this.s);
    const look = this.player.facing * 46 + clamp(this.player.vx * 0.12, -60, 60);
    let target = this.player.x + look;
    if (this.state === 'menu') target = 1690 + Math.sin(this.time * 0.13) * 46;
    target = clamp(target, Math.min(half, WORLD_WIDTH / 2), Math.max(WORLD_WIDTH - half, WORLD_WIDTH / 2));
    if (immediate) this.camX = target;
    else this.camX = damp(this.camX, target, 4.2, dt);
  }

  separate() {
    const alive = this.enemies.filter((e) => !e.dead && !e.remove && e.state !== 'down');
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i];
        const b = alive[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) < 46 && Math.abs(dy) < 0.15) {
          const dir = dx >= 0 ? 1 : -1;
          const depthDir = dy >= 0 ? 1 : -1;
          const pushX = (46 - Math.abs(dx)) * 0.22;
          const pushY = (0.15 - Math.abs(dy)) * 0.3;
          a.x -= dir * pushX;
          b.x += dir * pushX;
          a.y -= depthDir * pushY;
          b.y += depthDir * pushY;
        }
      }
      const p = this.player;
      if (p && !p.dead) {
        const dx = alive[i].x - p.x;
        const dy = alive[i].y - p.y;
        if (Math.abs(dx) < 38 && Math.abs(dy) < 0.15) {
          const dir = dx >= 0 ? 1 : -1;
          const depthDir = dy >= 0 ? 1 : -1;
          alive[i].x += dir * 0.8;
          alive[i].y += depthDir * 0.0015;
        }
      }
    }
  }

  cleanup() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].remove) this.enemies.splice(i, 1);
    }
    for (const e of this.enemies) {
      e.x = clamp(e.x, 60, WORLD_WIDTH - 60);
      e.y = clamp(e.y, 0.06, 0.94);
    }
  }

  saveBest() {
    if (this.score > this.best) this.best = this.score;
    try { localStorage.setItem('sticksmash.best', String(this.best)); } catch {}
  }

  shake(amount) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  showCallout(text, sub, color, life = 1.4) {
    this.callouts.push({ text, sub, color, life, maxLife: life });
  }

  project(x, y, z) {
    const depthScale = 0.86 + 0.14 * y;
    return {
      sx: (x - this.camX) * this.s + this.W / 2,
      sy: this.baseline + (y - 0.5) * this.depthPx - z * this.s,
      s: this.s * depthScale,
      depthScale,
    };
  }

  // ---------- render ----------
  render() {
    const ctx = this.ctx;
    const { W, H, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#03050c';
    ctx.fillRect(0, 0, W, H);

    const intensity = this.trauma * this.trauma;
    const shakeX = rand(-1, 1) * 13 * intensity;
    const shakeY = rand(-1, 1) * 9 * intensity;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const view = {
      W, H, s: this.s, baseline: this.baseline, depthPx: this.depthPx,
      camX: this.camX, time: this.time,
    };

    this.world.drawSky(ctx, view);
    this.world.drawCity(ctx, view);
    this.world.drawGround(ctx, view);
    this.world.drawAtmosphere(ctx, view);
    const actors = this.state === 'menu' ? this.menuActors : [this.player, ...this.enemies].filter(Boolean);
    const alive = actors.filter((f) => !f.remove && f.alpha > 0.01);

    // shadows first
    for (const f of alive) {
      if (f.z > 260) continue;
      const p = this.project(f.x, f.y, 0);
      const shadowWidth = f.height * 0.44 * p.depthScale * (1 - clamp(f.z / 520, 0, 0.7));
      const alpha = 0.38 * (1 - clamp(f.z / 420, 0, 0.78)) * f.alpha;
      drawGroundShadow(ctx, p.sx, p.sy, shadowWidth, alpha);
    }

    // pickups glow on the ground
    this.drawPickups(ctx);

    // sort by depth so front rows overlap correctly
    alive.sort((a, b) => a.y - b.y || a.x - b.x);

    for (const f of alive) {
      this.drawFighter(ctx, f);
    }

    this.particles.draw(ctx, (x, y, z) => this.project(x, y, z));
    this.particles.drawTexts(ctx, (x, y, z) => this.project(x, y, z));

    this.world.drawRain(ctx, view, 1 / 60);
    this.drawOverlays(ctx);
    this.drawCallouts(ctx);

    ctx.restore();
  }

  drawFighter(ctx, f) {
    const p = this.project(f.x, f.y, f.z);

    // trails (dodge / special)
    for (const tr of f.trails) {
      const tp = this.project(tr.x, tr.y, tr.z);
      const k = clamp(tr.life / tr.maxLife, 0, 1);
      drawStickman(ctx, {
        x: tp.sx, y: tp.sy,
        scale: f.height * this.s * tp.depthScale,
        facing: f.facing, pose: tr.pose, rot: tr.rot,
        colors: {
          body: f.colors.accent, far: f.colors.accent,
          accent: f.colors.accent, eye: f.colors.accent,
          dark: 'rgba(0, 0, 0, 0)',
        },
        alpha: k * 0.22, lineWidth: f.lineWidth * 0.9,
        phase: f.animPhase, eyes: 'none',
      });
    }

    // special aura
    if (f.state === 'special') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const aura = ctx.createRadialGradient(p.sx, p.sy, 4, p.sx, p.sy, 150 * p.depthScale);
      aura.addColorStop(0, 'rgba(65, 246, 255, 0.28)');
      aura.addColorStop(0.5, 'rgba(255, 61, 154, 0.1)');
      aura.addColorStop(1, 'rgba(65, 246, 255, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy + 4 * this.s, 150 * p.depthScale, 34 * this.s, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // telegraph for enemy wind-ups
    if (!f.isPlayer && f.state === 'attack' && f.attack && f.attackTime < f.attack.startup) {
      const prog = clamp(f.attackTime / f.attack.startup, 0, 1);
      const topY = p.sy - f.height * this.s * 1.18;
      ctx.save();
      ctx.globalAlpha = 0.35 + prog * 0.55;
      ctx.fillStyle = f.attack.aoe ? '#ff2f5e' : f.colors.accent;
      ctx.font = `900 ${Math.max(12, 18 * this.s)}px "Arial Black", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('!', p.sx, topY - (6 + Math.sin(this.time * 28) * 3) * this.s);
      if (f.attack.aoe) {
        const r = f.attack.range * this.s;
        ctx.globalAlpha = 0.16 + prog * 0.2;
        ctx.strokeStyle = '#ff2f5e';
        ctx.lineWidth = 2 * this.s;
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, r, r * 0.24, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 0.06 + prog * 0.1;
        ctx.fillStyle = '#ff2f5e';
        ctx.fill();
      }
      ctx.restore();
    }

    // low-health boss halo
    if (f.isBoss) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(p.sx, p.sy - 80 * this.s, 8, p.sx, p.sy - 80 * this.s, 150 * this.s);
      halo.addColorStop(0, 'rgba(255, 47, 94, 0.09)');
      halo.addColorStop(1, 'rgba(255, 47, 94, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(p.sx - 160 * this.s, p.sy - 250 * this.s, 320 * this.s, 320 * this.s);
      ctx.restore();
    }

    const attack = f.state === 'attack' ? f.attack : null;
    let swoosh = null;
    if (attack) {
      const t = (f.attackTime - attack.startup * 0.35) / (attack.active + attack.recover * 0.6);
      if (t > 0 && t < 1) {
        swoosh = {
          type: attack.kind === 'punch' || attack.kind === 'slam' ? 'punch' : 'kick',
          t,
          color: f.colors.accent,
        };
      }
    }

    // A quiet cyan ring keeps the player legible in a crowded brawl.
    if (f.isPlayer && f.alpha > 0.5) {
      const pulse = 0.5 + Math.sin(this.time * 3.4) * 0.12;
      ctx.save();
      ctx.globalAlpha = 0.3 * f.alpha;
      ctx.strokeStyle = f.colors.accent;
      ctx.lineWidth = Math.max(1, 1.6 * this.s);
      ctx.beginPath();
      ctx.ellipse(p.sx, p.sy + 2 * this.s, 30 * p.depthScale * this.s, 8 * p.depthScale * this.s, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.1 * pulse;
      ctx.fillStyle = f.colors.accent;
      ctx.fill();
      ctx.restore();
    }

    drawStickman(ctx, {
      x: p.sx, y: p.sy,
      scale: f.height * this.s * p.depthScale,
      facing: f.facing, pose: f.pose, rot: f.rot,
      colors: f.colors,
      alpha: f.alpha * (0.9 + 0.1 * f.y),
      flash: f.hitFlash > 0 ? clamp(f.hitFlash / 0.1, 0, 1) : 0,
      lineWidth: f.lineWidth,
      phase: f.animPhase,
      eyes: f.eyes,
      showScarf: f.showScarf,
      showBand: f.showBand,
      swoosh,
    });

    // small overhead health bar for wounded enemies
    if (!f.isPlayer && !f.isBoss && f.hp < f.maxHp && f.hp > 0 && f.alpha > 0.4) {
      const width = 48 * this.s * p.depthScale;
      const height = 4 * this.s;
      const bx = p.sx - width / 2;
      const by = p.sy - f.height * this.s * 1.16;
      ctx.save();
      ctx.globalAlpha = 0.85 * f.alpha;
      ctx.fillStyle = 'rgba(3, 6, 14, 0.8)';
      ctx.fillRect(bx - 1, by - 1, width + 2, height + 2);
      const ratio = clamp(f.hp / f.maxHp, 0, 1);
      const grad = ctx.createLinearGradient(bx, 0, bx + width, 0);
      grad.addColorStop(0, f.colors.accent);
      grad.addColorStop(1, '#ff8a8a');
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, width * ratio, height);
      ctx.restore();
    }

    // nameplate for the boss (small, above the big top bar)
    if (f.isBoss && !f.dead) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#ffc2df';
      ctx.font = `700 ${Math.max(8, 9 * this.s)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('EL REY', p.sx, p.sy - f.height * this.s * 1.15);
      ctx.restore();
    }
  }

  drawPickups(ctx) {
    for (const pk of this.pickups) {
      const z = 18 + Math.sin(pk.bob) * 5;
      const p = this.project(pk.x, pk.y, z);
      const shadow = this.project(pk.x, pk.y, 0);
      drawGroundShadow(ctx, shadow.sx, shadow.sy, 34 * shadow.depthScale, 0.3);
      ctx.save();
      ctx.translate(p.sx, p.sy);
      ctx.rotate(Math.sin(pk.bob * 0.5) * 0.14);
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 30 * p.depthScale);
      glow.addColorStop(0, 'rgba(184, 255, 99, 0.45)');
      glow.addColorStop(1, 'rgba(184, 255, 99, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 30 * p.depthScale, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      const size = 11 * p.depthScale;
      ctx.fillStyle = '#0a1710';
      ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.strokeStyle = '#b8ff63';
      ctx.lineWidth = Math.max(1, 1.6 * this.s);
      ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.fillStyle = '#d6ff9e';
      ctx.fillRect(-size * 0.24, -size * 0.72, size * 0.48, size * 1.44);
      ctx.fillRect(-size * 0.72, -size * 0.24, size * 1.44, size * 0.48);
      ctx.restore();
    }
  }

  drawOverlays(ctx) {
    const { W, H } = this;
    const p = this.player;
    if (!p) return;
    // hurt / low health vignette
    const hurt = clamp(p.hitFlash / 0.1, 0, 1);
    const low = p.hp > 0 && p.hp / p.maxHp < 0.3
      ? 0.1 + Math.sin(this.time * 5) * 0.04 + (0.3 - p.hp / p.maxHp) * 0.4
      : 0;
    const danger = clamp(hurt * 0.55 + low, 0, 0.65);
    if (danger > 0.01) {
      const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.18, W / 2, H / 2, Math.max(W, H) * 0.72);
      grad.addColorStop(0, 'rgba(255, 30, 60, 0)');
      grad.addColorStop(1, `rgba(255, 30, 60, ${danger})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flashValue > 0.01) {
      ctx.fillStyle = `rgba(255, 255, 255, ${clamp(this.flashValue, 0, 0.55)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawCallouts(ctx) {
    const { W, H } = this;
    for (const c of this.callouts) {
      const k = clamp(c.life / c.maxLife, 0, 1);
      const age = c.maxLife - c.life;
      const pop = age < 0.16 ? age / 0.16 : 1;
      const alpha = Math.min(1, k * 2.4);
      const size = Math.max(26, Math.min(72, W * 0.06)) * (0.8 + pop * 0.2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.translate(W / 2, H * 0.29 - (1 - k) * 18);
      ctx.rotate(-0.035);
      ctx.font = `italic 900 ${size}px "Arial Black", "Helvetica Neue", sans-serif`;
      ctx.fillStyle = c.color;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 22;
      ctx.fillText(c.text, 0, 0);
      ctx.shadowBlur = 0;
      if (c.sub) {
        ctx.font = `700 ${Math.max(8, size * 0.18)}px ui-monospace, monospace`;
        ctx.fillStyle = 'rgba(242, 247, 255, 0.8)';
        ctx.fillText(c.sub, 0, size * 0.55);
      }
      ctx.restore();
    }
  }
}
