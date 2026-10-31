import { AudioEngine } from './audio.js';
import { FX } from './fx.js';
import { Input } from './input.js';
import { Scene } from './scene.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { UI } from './ui.js';
import { drawStickman } from './stickman.js';
import { TAU, clamp, damp, formatTime, rand, randInt, pick, sign } from './utils.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.audio = new AudioEngine();
    this.fx = new FX();
    this.scene = new Scene();
    this.input = new Input();
    this.ui = new UI(this);

    this.state = 'menu';
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.unit = 1;
    this.groundY = this.height * 0.76;
    this.ceilingY = 40;
    this.left = 40;
    this.right = this.width - 40;
    this.dpr = 1;

    this.enemies = [];
    this.player = null;
    this.wave = 1;
    this.kills = 0;
    this.deathCount = 0;
    this.specialGameOver = false;
    this.runTime = 0;
    this.waveState = 'fighting';
    this.waveClearTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnCap = 4;
    this.spawnSide = 'left';
    this.waveKills = 0;
    this.waveSpawned = 0;

    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.slowmoRemaining = 0;
    this.hitstopTimer = 0;
    this.shakeMagnitude = 0;
    this.shakeDuration = 0.001;
    this.shakeTimer = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.realTime = 0;
    this.renderTime = 0;
    this.deathDelay = 0;
    this.pendingGameOver = false;
    this.adTimer = 0;
    this.adDuration = 5;
    this.adDone = false;
    this.lastTip = '';
    this.ambientTimer = 0;
    this.firstRun = true;

    this.resize();
    this.player = new Player(this, this.width * 0.5);
    this.player.facing = -1;
    this.input.onPause(() => {
      if (this.state === 'playing') this.togglePause();
      else if (this.state === 'paused') this.resume();
    });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 120));
    this.ui.showMenu();
    this.scene.resize(this.width, this.height, this.groundY, this.left, this.right);
    window.__neonFist = this;
  }

  resize() {
    // Read the app shell, not the canvas: the canvas has an inline width/height
    // set by this method, so measuring it would keep the old viewport forever.
    const rect = (this.canvas.parentElement || document.documentElement).getBoundingClientRect();
    const width = Math.max(320, rect.width || window.innerWidth);
    const height = Math.max(320, rect.height || window.innerHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const portrait = width < 760 && height > width;
    const unit = clamp(Math.min(width / 1100, height / 680), 0.7, 1.22);
    this.unit = portrait ? clamp(width / 500, 0.72, 0.92) : unit;
    this.groundY = portrait
      ? height - clamp(height * 0.29, 230, 305)
      : height - clamp(height * 0.235, 140, 220);
    this.ceilingY = Math.max(18, height * 0.055);
    this.left = Math.max(24, width * 0.035);
    this.right = width - this.left;
    this.scene.resize(width, height, this.groundY, this.left, this.right);

    if (this.player) {
      this.player.unit = this.unit;
      this.player.scale = 1.06 * this.unit;
      this.player.radius = 16 * this.unit;
      this.player.x = clamp(this.player.x, this.left + this.player.radius, this.right - this.player.radius);
      if (this.player.onGround || this.player.state === 'idle') this.player.y = this.groundY;
    }
    for (const enemy of this.enemies) {
      enemy.unit = this.unit;
      enemy.scale = (enemy.heavy ? 1.2 : 0.98) * this.unit;
      enemy.radius = (enemy.heavy ? 20 : 15) * this.unit;
      enemy.x = clamp(enemy.x, this.left - 30 * this.unit, this.right + 30 * this.unit);
      if (enemy.onGround || enemy.state === 'approach' || enemy.state === 'idle') enemy.y = this.groundY;
    }
    if (this.state === 'menu' && this.player) {
      this.player.x = width * 0.5;
      this.player.y = this.groundY;
    }
  }

  // ---------------------------------------------------------------- flow

  startRun() {
    this.audio.ensure();
    this.ui.showScreen(null);
    this.state = 'playing';
    this.firstRun = false;
    this.kills = 0;
    this.wave = 1;
    this.runTime = 0;
    this.waveState = 'fighting';
    this.waveClearTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0.3;
    this.spawnCap = 4;
    this.spawnSide = 'left';
    this.waveKills = 0;
    this.waveSpawned = 0;
    this.specialGameOver = false;
    this.pendingGameOver = false;
    this.deathDelay = 0;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.slowmoRemaining = 0;
    this.hitstopTimer = 0;
    this.enemies.length = 0;
    this.fx.reset();
    this.player = new Player(this, this.width * 0.5);
    this.player.facing = 1;
    this.player.y = this.groundY;
    this.ui.setWave(1);
    this.ui.setKills(0);
    this.ui.setCombo(0, 0);
    this.ui.banner('OLEADA 01', 'SOBREVIVE', 'Los rojos atacan por ambos lados · usa la pared', '', 2.5);
    this.audio.wave();
    this.startWave(1, false);
    this.fx.ring(this.width * 0.5, this.groundY, {
      color: '#39f5ff',
      maxRadius: 160,
      life: 0.6,
      width: 3,
      squash: 0.25,
    });
  }

  restart() {
    if (this.specialGameOver) {
      this.deathCount = 0;
      this.specialGameOver = false;
    }
    this.startRun();
  }

  retry() {
    if (this.specialGameOver) {
      this.deathCount = 0;
      this.specialGameOver = false;
    }
    this.startRun();
  }

  toMenu(fromGameOver = false) {
    if (fromGameOver && this.specialGameOver) {
      this.deathCount = 0;
      this.specialGameOver = false;
    }
    this.state = 'menu';
    this.enemies.length = 0;
    this.fx.reset();
    this.spawnQueue = [];
    this.waveState = 'fighting';
    this.pendingGameOver = false;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.slowmoRemaining = 0;
    this.player = new Player(this, this.width * 0.5);
    this.player.facing = -1;
    this.player.y = this.groundY;
    this.player.alpha = 0.85;
    this.ui.showMenu();
    this.ui.setCombo(0, 0);
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.ui.showPause();
      this.ui.showContextTip('', 0);
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.input.clear();
  }

  openHow() {
    if (this.state !== 'menu') return;
    this.ui.showHow();
  }

  closeHow() {
    if (this.state !== 'menu') return;
    this.ui.showMenu();
  }

  toggleSound() {
    this.audio.ensure();
    this.audio.toggleMuted();
    this.ui.syncSound();
    if (!this.audio.muted) this.audio.ui();
  }

  // ---------------------------------------------------------------- waves

  startWave(wave, announce = true) {
    this.wave = wave;
    this.waveState = 'fighting';
    this.waveClearTimer = 0;
    this.waveKills = 0;
    this.waveSpawned = 0;
    this.spawnCap = Math.min(7, 3 + Math.floor(wave / 2));
    this.spawnTimer = announce ? 0.75 : 0.32;

    const quota = 4 + wave * 2;
    const heavies = wave >= 2 ? Math.min(4, 1 + Math.floor((wave - 2) / 2)) : 0;
    const types = [];
    for (let i = 0; i < quota; i += 1) types.push('red');
    for (let i = 0; i < heavies; i += 1) {
      const index = Math.min(types.length, 1 + i * 2);
      types.splice(index, 0, 'heavy');
    }
    this.spawnQueue = types.map((type, index) => ({
      type,
      variant: type === 'heavy' ? (index % 2 === 0 ? 'gold' : 'green') : 'red',
    }));
    this.ui.setWave(wave);
    if (announce) {
      const title = wave === 1 ? 'SOBREVIVE' : wave === 2 ? 'REFUERZOS' : pick(['SIN PAUSA', 'MÁS RÁPIDO', 'LA ARENA ARDE', 'SIGUE EN PIE']);
      const sub = wave === 2
        ? 'Llegan los blindados: agarra, lanza o usa la pared'
        : wave >= 3
          ? `${quota} enemigos · ${heavies} blindados · sin descanso`
          : 'Los rojos atacan por ambos lados · usa la pared';
      this.ui.banner(`OLEADA ${String(wave).padStart(2, '0')}`, title, sub, wave >= 4 ? 'alert' : '', 2.3);
      this.audio.wave();
    }
  }

  spawnEnemy(type, variant) {
    const heavy = type === 'heavy';
    const side = this.spawnSide;
    this.spawnSide = side === 'left' ? 'right' : 'left';
    let enemy;
    if (heavy) {
      const x = clamp(this.player.x + rand(-250, 250) * this.unit, this.left + 90 * this.unit, this.right - 90 * this.unit);
      enemy = new Enemy(this, type, {
        variant,
        side,
        spawnMode: 'drop',
        x,
        y: -40,
      });
      this.fx.ring(x, this.groundY, {
        color: enemy.palette.main,
        maxRadius: 110 * this.unit,
        life: 0.75,
        width: 3,
        squash: 0.24,
        delay: 0.38,
      });
      this.fx.text(x, this.groundY - 200 * this.unit, 'PESADO ENTRANDO', {
        color: enemy.palette.main,
        size: 11,
        life: 0.9,
        vy: -22,
      });
      this.audio.whoosh(1.5);
    } else {
      const x = side === 'left' ? this.left - 42 * this.unit : this.right + 42 * this.unit;
      enemy = new Enemy(this, type, { variant: 'red', side, spawnMode: 'walk', x });
    }
    this.enemies.push(enemy);
    this.waveSpawned += 1;
  }

  get aliveEnemies() {
    return this.enemies.filter((enemy) => enemy && !enemy.countedDead && enemy.state !== 'dead');
  }

  updateWaves(dt) {
    if (this.state !== 'playing' || this.pendingGameOver) return;
    if (this.waveState === 'cleared') {
      this.waveClearTimer -= dt;
      if (this.waveClearTimer <= 0) {
        this.startWave(this.wave + 1, true);
        this.player?.heal(8);
      }
      return;
    }

    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      const alive = this.aliveEnemies.length;
      if (this.spawnTimer <= 0 && alive < this.spawnCap) {
        const next = this.spawnQueue.shift();
        this.spawnEnemy(next.type, next.variant);
        this.spawnTimer = clamp(0.95 - this.wave * 0.035, 0.38, 0.95) * rand(0.82, 1.18);
      }
    }

    if (this.spawnQueue.length === 0 && this.aliveEnemies.length === 0) {
      this.waveState = 'cleared';
      this.waveClearTimer = 2.35;
      this.ui.banner(
        `OLEADA ${String(this.wave).padStart(2, '0')} LIMPIA`,
        'SIGUE EN PIE',
        `+8 HP · BATERÍA +12 · siguiente oleada`,
        'alert',
        2.1,
      );
      this.player?.heal(8);
      this.player?.addBattery(12);
      this.audio.wave();
      this.fx.ring(this.player.x, this.groundY, {
        color: '#ffd34d',
        maxRadius: 190 * this.unit,
        life: 0.65,
        width: 3,
        squash: 0.25,
      });
    }
  }

  // ---------------------------------------------------------------- combat

  hitEnemy(enemy, options = {}) {
    if (!enemy || enemy.state === 'dead' || enemy.countedDead) return false;
    const result = enemy.takeHit(options.damage ?? 10, options.kind || 'light', options);
    if (!result.hit) return false;
    if (result.absorbed) {
      this.shake(3, 0.12);
      return false;
    }
    const hitX = options.hitX ?? enemy.x;
    const hitY = options.hitY ?? enemy.y - 65 * this.unit;
    if (!options.silent && options.damage > 0) {
      const color = options.kind === 'dragon' ? '#ffd34d'
        : options.kind === 'special' || options.kind === 'specialWave' ? '#aefcff'
          : options.kind === 'throw' || options.kind === 'thrownBody' ? '#ff9ecf'
            : options.kind === 'dive' ? '#bffcff'
              : '#ffffff';
      this.fx.text(hitX + rand(-6, 6), hitY - 16, `-${Math.round(options.damage)}`, {
        color,
        size: options.dramatic ? 20 : 15,
        life: 0.7,
        vy: -72,
        vx: rand(-22, 22),
      });
    }
    if (result.killed) {
      this.fx.text(hitX, hitY - 64, 'K.O.', {
        color: '#ffd34d',
        size: 30,
        life: 1.1,
        vy: -44,
      });
      this.fx.screenFlash('#ffffff', 0.12, 5);
      this.shake(10, 0.24);
    }
    return true;
  }

  registerKill(enemy) {
    this.kills += 1;
    this.waveKills += 1;
    this.ui.setKills(this.kills);
    this.audio.combo(Math.min(9, 4 + Math.floor(this.kills / 3)));
    this.fx.text(enemy.x, enemy.y - 120 * this.unit, '+1', {
      color: enemy.palette.main,
      size: 12,
      life: 0.6,
      vy: -55,
    });
    if (this.player) {
      this.player.bestCombo = Math.max(this.player.bestCombo, this.player.combo);
    }
  }

  removeEnemy(enemy) {
    const index = this.enemies.indexOf(enemy);
    if (index >= 0) this.enemies.splice(index, 1);
  }

  onPlayerDeath() {
    if (this.pendingGameOver) return;
    this.pendingGameOver = true;
    this.deathDelay = 1.55;
    this.timeScaleTarget = 0.58;
    this.shake(20, 0.5);
    this.fx.screenFlash('#ff1f45', 0.25, 2.4);
    this.audio.death();
    this.ui.setCombo(0, 0);
    this.ui.showContextTip('', 0);
    this.fx.ring(this.player.x, this.player.y - 60 * this.unit, {
      color: '#ff3b4e',
      maxRadius: 190 * this.unit,
      life: 0.8,
      width: 4,
      squash: 0.7,
    });
  }

  showGameOver() {
    this.deathCount += 1;
    this.specialGameOver = this.deathCount >= 2;
    this.state = 'gameover';
    this.pendingGameOver = false;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.ui.showGameOver({
      special: this.specialGameOver,
      deathCount: this.deathCount,
      stats: {
        wave: this.wave,
        kills: this.kills,
        bestCombo: this.player?.bestCombo || 0,
        deathCount: this.deathCount,
        time: formatTime(this.runTime),
      },
    });
    this.audio.wave();
  }

  acceptRevive() {
    if (this.state !== 'gameover' || !this.specialGameOver) return;
    this.deathCount = 0;
    this.specialGameOver = false;
    this.state = 'ad';
    this.adTimer = 0;
    this.adDone = false;
    this.ui.showAd();
    this.audio.ui();
  }

  finishAd() {
    if (this.state !== 'ad') return;
    this.deathCount = 0;
    this.specialGameOver = false;
    this.adDone = true;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.player.revive();
    this.player.x = this.width * 0.5;
    this.player.y = this.groundY;
    this.player.facing = 1;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = true;
    this.player.invuln = 2.8;
    this.pendingGameOver = false;
    this.deathDelay = 0;
    this.hitstopTimer = 0;
    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.slowmoRemaining = 0;
    this.fx.ring(this.player.x, this.groundY, {
      color: '#ffd34d',
      maxRadius: 240 * this.unit,
      life: 0.8,
      width: 5,
      squash: 0.3,
    });
    this.fx.burst(this.player.x, this.groundY - 60 * this.unit, {
      count: 30,
      color: '#ffd34d',
      speed: 520,
      spread: TAU,
      gravity: 400,
      size: 3.2,
      life: 0.9,
    });
    this.fx.screenFlash('#fff3b8', 0.2, 3);
    this.shake(14, 0.4);
    this.audio.revive();
    this.ui.banner('REVIVIDO', '50% DE VIDA', 'La arena te da otra oportunidad', 'alert', 2.0);
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      if (Math.abs(enemy.x - this.player.x) < 260 * this.unit) {
        this.hitEnemy(enemy, {
          damage: 14,
          kind: 'reviveBlast',
          vx: (enemy.x < this.player.x ? -1 : 1) * 780 * this.unit,
          vy: -540 * this.unit,
          batteryGain: 0,
          source: 'revive',
          dramatic: true,
          allowArmorBreak: true,
          hitY: enemy.y - 55 * this.unit,
        });
      }
    }
    this.spawnTimer = Math.max(this.spawnTimer, 0.7);
  }

  // ---------------------------------------------------------------- time / camera

  shake(magnitude, duration) {
    if (magnitude >= this.shakeMagnitude || this.shakeTimer <= 0) {
      this.shakeMagnitude = magnitude;
      this.shakeDuration = duration;
      this.shakeTimer = duration;
    }
  }

  hitstop(duration) {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
  }

  startSlowMo(duration = 3.2) {
    this.slowmoRemaining = Math.max(this.slowmoRemaining, duration);
    this.timeScaleTarget = 0.4;
  }

  endSlowMo() {
    this.slowmoRemaining = 0;
    this.timeScaleTarget = 1;
  }

  showContextTip(html, duration = 1.6) {
    this.ui.showContextTip(html, duration);
  }

  updateCamera(realDt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= realDt;
      const ratio = clamp(this.shakeTimer / this.shakeDuration, 0, 1);
      const intensity = this.shakeMagnitude * ratio * ratio;
      const phase = this.realTime * 83;
      this.shakeX = Math.sin(phase) * intensity * 0.65 + Math.sin(phase * 1.9) * intensity * 0.25;
      this.shakeY = Math.cos(phase * 1.23) * intensity * 0.5;
      if (this.shakeTimer <= 0) {
        this.shakeMagnitude = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }
    } else {
      this.shakeX *= 0.8;
      this.shakeY *= 0.8;
    }
  }

  // ---------------------------------------------------------------- loop

  update(realDt) {
    const dt = Math.min(realDt, 0.05);
    this.realTime += dt;
    this.updateCamera(dt);
    this.ui.update(dt);

    if (this.state === 'menu' || this.state === 'how') {
      this.scene.update(dt * 0.7);
      this.player.animTime += dt;
      this.player.state = 'idle';
      this.fx.update(dt);
      return;
    }

    if (this.state === 'paused') {
      return;
    }

    if (this.state === 'gameover') {
      this.scene.update(dt * 0.25);
      this.fx.update(dt * 0.25);
      return;
    }

    if (this.state === 'ad') {
      this.scene.update(dt * 0.2);
      this.fx.update(dt * 0.2);
      this.adTimer += dt;
      this.ui.updateAd(this.adTimer / this.adDuration, this.adDuration - this.adTimer);
      if (this.adTimer >= this.adDuration && !this.adDone) {
        this.ui.updateAd(1, 0);
      }
      if (this.adTimer >= this.adDuration + 2.2 && !this.adDone) {
        this.finishAd();
      }
      return;
    }

    // Slow motion timing is real-time so the effect always feels snappy.
    if (this.slowmoRemaining > 0) {
      this.slowmoRemaining -= dt;
      if (this.slowmoRemaining <= 0) this.timeScaleTarget = 1;
    }
    this.timeScale = damp(this.timeScale, this.timeScaleTarget, 11, dt);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.fx.update(dt * 0.15);
      return;
    }

    const scaled = dt * this.timeScale;
    this.runTime += scaled;
    this.scene.update(scaled);
    this.fx.update(scaled);

    if (this.pendingGameOver) {
      this.player.updateDead(scaled);
      for (const enemy of this.enemies) enemy.update(scaled, this.player);
      this.deathDelay -= dt;
      if (this.deathDelay <= 0) this.showGameOver();
      return;
    }

    this.player.update(scaled, this.input);
    for (const enemy of this.enemies) {
      enemy.update(scaled, this.player);
    }
    this.separateEnemies();
    this.updateWaves(scaled);
    this.updateComboUi();

    // Remove dead entities that faded out
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (!this.enemies[i] || this.enemies[i].alpha <= 0) this.enemies.splice(i, 1);
    }

    if (this.player.combo > 0) {
      this.player.bestCombo = Math.max(this.player.bestCombo, this.player.combo);
    }
  }

  separateEnemies() {
    const active = this.enemies.filter((enemy) => enemy && !['grabbed', 'ragdoll', 'dead'].includes(enemy.state) && enemy.onGround);
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        const a = active[i];
        const b = active[j];
        const dx = b.x - a.x;
        const minDistance = (a.radius + b.radius) * 1.4;
        if (Math.abs(dx) < minDistance) {
          const push = (minDistance - Math.abs(dx)) * 0.5;
          const dir = dx === 0 ? (a.id < b.id ? 1 : -1) : sign(dx);
          a.x -= dir * push;
          b.x += dir * push;
          a.x = clamp(a.x, this.left + a.radius, this.right - a.radius);
          b.x = clamp(b.x, this.left + b.radius, this.right - b.radius);
        }
      }
      const playerDistance = Math.abs(active[i].x - this.player.x);
      if (playerDistance < (active[i].radius + this.player.radius) * 0.9 && Math.abs(active[i].y - this.player.y) < 40) {
        const dir = active[i].x < this.player.x ? -1 : 1;
        active[i].x += dir * 2.4 * this.unit;
        active[i].x = clamp(active[i].x, this.left + active[i].radius, this.right - active[i].radius);
      }
    }
  }

  updateComboUi() {
    if (!this.player) return;
    if (this.player.combo > 0 && this.player.comboTimer > 0) {
      this.ui.updateCombo(this.player.combo, this.player.comboTimer / 1.7);
    } else {
      if (this.player.combo > 0) this.player.combo = 0;
      this.ui.setCombo(0, 0);
    }
  }

  draw() {
    const ctx = this.ctx;
    const { width, height } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const shakeRatio = this.shakeTimer > 0 ? clamp(this.shakeTimer / this.shakeDuration, 0, 1) : 0;
    const zoom = 1.004 + (this.shakeMagnitude * shakeRatio * shakeRatio) * 0.0009;
    ctx.save();
    ctx.translate(width / 2 + this.shakeX, height / 2 + this.shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    this.scene.draw(ctx);

    if (this.state === 'menu' || this.state === 'how') {
      if (this.player) {
        this.player.alpha = 0.5;
        this.player.animTime += 0.003;
        drawStickman(ctx, this.player, { groundY: this.groundY });
        this.player.alpha = 1;
      }
    } else {
      const entities = this.enemies.filter(Boolean).slice();
      if (this.player) entities.push(this.player);
      entities.sort((a, b) => a.y - b.y);
      for (const entity of entities) {
        drawStickman(ctx, entity, { groundY: this.groundY });
      }
    }

    this.scene.drawForeground(ctx);
    this.fx.draw(ctx, this.groundY);

    // Bullet-time tint sits over the action, under the flash
    if (this.timeScale < 0.94 && this.state === 'playing') {
      const intensity = 1 - this.timeScale;
      ctx.save();
      ctx.globalAlpha = 0.12 * intensity;
      ctx.fillStyle = '#1a6dff';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 0.45 * intensity;
      ctx.strokeStyle = 'rgba(140, 235, 255, 0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 14; i += 1) {
        const y = ((i * 97 + this.realTime * 190) % (height * 0.8)) + height * 0.05;
        const length = 30 + ((i * 37) % 90);
        const side = i % 2 === 0 ? 0 : width;
        ctx.beginPath();
        ctx.moveTo(side, y);
        ctx.lineTo(side + (i % 2 === 0 ? length : -length), y + 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    this.fx.drawScreen(ctx, width, height);
    this.drawFrameOverlay(ctx);
    ctx.restore();
  }

  drawFrameOverlay(ctx) {
    const { width, height } = this;
    if (this.state === 'playing' || this.state === 'dying') {
      const hpRatio = this.player ? this.player.hp / this.player.maxHp : 1;
      if (hpRatio < 0.3) {
        const danger = (1 - hpRatio / 0.3) * (0.09 + Math.sin(this.realTime * 6) * 0.025);
        const gradient = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.65);
        gradient.addColorStop(0, 'rgba(255, 20, 50, 0)');
        gradient.addColorStop(1, `rgba(255, 20, 50, ${clamp(danger, 0, 0.3)})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    }

    // Top & bottom cinematic edges, subtle
    const top = ctx.createLinearGradient(0, 0, 0, 70);
    top.addColorStop(0, 'rgba(0, 3, 10, 0.5)');
    top.addColorStop(1, 'rgba(0, 3, 10, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, 70);
    const bottom = ctx.createLinearGradient(0, height - 90, 0, height);
    bottom.addColorStop(0, 'rgba(0, 3, 10, 0)');
    bottom.addColorStop(1, 'rgba(0, 3, 10, 0.45)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height - 90, width, 90);
  }
}
