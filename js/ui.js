import { clamp, formatScore, formatTime } from './utils.js';

export class UI {
  constructor(audio) {
    this.audio = audio;
    this.game = null;
    this.input = null;
    this.cache = {};
    this.bannerToken = 0;

    const id = (name) => document.getElementById(name);
    this.el = {
      hud: id('hud'),
      hpFill: id('hpFill'),
      hpGhost: id('hpGhost'),
      hpText: id('hpText'),
      rageFill: id('rageFill'),
      rageHint: id('rageHint'),
      waveNum: id('waveNum'),
      score: id('score'),
      bestScore: id('bestScore'),
      combo: id('combo'),
      comboCount: id('comboCount'),
      comboRank: id('comboRank'),
      bossBar: id('bossBar'),
      bossFill: id('bossFill'),
      banner: id('banner'),
      bannerMain: id('bannerMain'),
      bannerSub: id('bannerSub'),
      hint: id('hint'),
      title: id('title'),
      titleBest: id('titleBest'),
      pause: id('pause'),
      gameover: id('gameover'),
      victory: id('victory'),
      touch: id('touch'),
      flash: id('flash'),
      startBtn: id('startBtn'),
      titleMute: id('titleMute'),
      muteBtn: id('muteBtn'),
      pauseBtn: id('pauseBtn'),
      pauseMute: id('pauseMute'),
      resumeBtn: id('resumeBtn'),
      restartBtn: id('restartBtn'),
      menuBtn: id('menuBtn'),
      retryBtn: id('retryBtn'),
      overMenuBtn: id('overMenuBtn'),
      againBtn: id('againBtn'),
      winMenuBtn: id('winMenuBtn'),
      goWave: id('goWave'),
      goScore: id('goScore'),
      goCombo: id('goCombo'),
      goKos: id('goKos'),
      goRecord: id('goRecord'),
      winScore: id('winScore'),
      winCombo: id('winCombo'),
      winKos: id('winKos'),
      winTime: id('winTime'),
      winRecord: id('winRecord'),
      joystick: id('joystick'),
      stickKnob: id('stickKnob'),
    };

    this.setMuted(audio.muted);
    this.bindTouchButtons();

    // Stay out of the automation/a11y "ready" state until the first frames
    // prove the renderer is not stalled. On normal hardware this clears in
    // a few milliseconds; it only matters on slow software renderers where
    // the first composite can block for a second or two.
    this.el.startBtn?.setAttribute('aria-disabled', 'true');
  }

  markReady() {
    if (this.ready) return;
    this.ready = true;
    this.el.startBtn?.removeAttribute('aria-disabled');
    document.body.classList.add('is-ready');
  }

  bind(game, input) {
    this.game = game;
    this.input = input;

    const click = (el, fn) => el?.addEventListener('click', (event) => {
      event.preventDefault();
      this.audio.resume();
      this.audio.play('click');
      fn();
    });

    click(this.el.startBtn, () => game.startGame());
    click(this.el.pauseBtn, () => game.togglePause());
    click(this.el.resumeBtn, () => game.resume());
    click(this.el.restartBtn, () => game.restart());
    click(this.el.menuBtn, () => game.toMenu());
    click(this.el.retryBtn, () => game.restart());
    click(this.el.overMenuBtn, () => game.toMenu());
    click(this.el.againBtn, () => game.restart());
    click(this.el.winMenuBtn, () => game.toMenu());

    const toggleMute = () => {
      const muted = this.audio.toggleMute();
      this.setMuted(muted);
    };
    for (const btn of [this.el.titleMute, this.el.muteBtn, this.el.pauseMute]) {
      btn?.addEventListener('click', (event) => {
        event.preventDefault();
        this.audio.resume();
        toggleMute();
      });
    }

    // Prevent touch controls from turning into page gestures.
    for (const btn of this.el.touch?.querySelectorAll('.tbtn, .joystick') || []) {
      btn.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    this.setMuted(this.audio.muted);
    this.showTitle(game.best);
  }

  bindTouchButtons() {
    const touch = this.el.touch;
    if (!touch) return;
    const buttons = touch.querySelectorAll('.tbtn');

    for (const btn of buttons) {
      const action = btn.dataset.action;
      let downAt = 0;
      const down = (event) => {
        event.preventDefault();
        event.stopPropagation();
        btn.classList.add('held');
        this.input?.setVirtual(action === 'def' ? 'block' : action, true);
        downAt = performance.now();
        if (action === 'def') this.input?.setVirtual('block', true);
      };
      const up = (event) => {
        event.preventDefault();
        event.stopPropagation();
        btn.classList.remove('held');
        if (action === 'def') {
          this.input?.setVirtual('block', false);
          if (performance.now() - downAt < 220) this.input?.tapVirtual('dodge');
        } else {
          this.input?.setVirtual(action, false);
        }
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', (event) => {
        if (btn.classList.contains('held') && event.pointerType === 'mouse') up(event);
      });
    }
  }

  setMuted(muted) {
    const icon = muted ? '🔇' : '🔊';
    if (this.el.muteBtn) {
      this.el.muteBtn.textContent = icon;
      this.el.muteBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
    }
    for (const btn of [this.el.titleMute, this.el.pauseMute]) {
      if (btn) btn.textContent = `${icon} SONIDO`;
    }
  }

  hideTitle() {
    this.el.title?.classList.add('hidden');
  }

  showTitle(best = 0) {
    if (this.el.titleBest) this.el.titleBest.textContent = formatScore(best);
    this.el.title?.classList.remove('hidden');
    this.el.title?.setAttribute('aria-hidden', 'false');
  }

  showHud(show) {
    this.el.hud?.classList.toggle('hidden', !show);
  }

  showTouch(show) {
    this.el.touch?.classList.toggle('hidden', !show);
  }

  showPause() {
    this.el.pause?.classList.remove('hidden');
  }

  hidePause() {
    this.el.pause?.classList.add('hidden');
  }

  showGameOver(game) {
    const wave = Math.min(game.waveIndex + 1, game.waveTotal || 5);
    if (this.el.goWave) this.el.goWave.textContent = `${wave} / ${game.waveTotal || 5}`;
    if (this.el.goScore) this.el.goScore.textContent = formatScore(game.score);
    if (this.el.goCombo) this.el.goCombo.textContent = String(game.comboBest);
    if (this.el.goKos) this.el.goKos.textContent = String(game.kills);
    if (this.el.goRecord) {
      if (game.score > (game.startBest || 0) && game.score > 0) {
        this.el.goRecord.textContent = 'NUEVO RÉCORD PERSONAL';
      } else {
        this.el.goRecord.textContent = `MEJOR: ${formatScore(game.best)}`;
      }
    }
    this.el.gameover?.classList.remove('hidden');
    this.showHud(true);
  }

  hideGameOver() {
    this.el.gameover?.classList.add('hidden');
  }

  showVictory(game) {
    if (this.el.winScore) this.el.winScore.textContent = formatScore(game.score);
    if (this.el.winCombo) this.el.winCombo.textContent = String(game.comboBest);
    if (this.el.winKos) this.el.winKos.textContent = String(game.kills);
    if (this.el.winTime) this.el.winTime.textContent = formatTime(game.elapsed);
    if (this.el.winRecord) {
      this.el.winRecord.textContent = game.score > (game.startBest || 0)
        ? 'NUEVO RÉCORD PERSONAL'
        : `MEJOR: ${formatScore(game.best)}`;
    }
    this.el.victory?.classList.remove('hidden');
  }

  hideVictory() {
    this.el.victory?.classList.add('hidden');
  }

  banner(main, sub, gold = false) {
    const b = this.el.banner;
    if (!b) return;
    this.bannerToken++;
    if (this.el.bannerMain) this.el.bannerMain.innerHTML = main;
    if (this.el.bannerSub) this.el.bannerSub.textContent = sub || '';
    b.classList.remove('show', 'gold');
    // restart CSS animation reliably
    void b.offsetWidth;
    b.classList.toggle('gold', Boolean(gold));
    b.classList.add('show');
  }

  setWave(current, total) {
    if (this.el.waveNum) this.el.waveNum.textContent = String(current);
    const totalEl = document.querySelector('.wave-total');
    if (totalEl) totalEl.textContent = `/ ${total}`;
  }

  setBoss(visible) {
    this.el.bossBar?.classList.toggle('hidden', !visible);
  }

  updateBoss(boss) {
    if (!this.el.bossFill) return;
    const pct = clamp((boss.hp / boss.maxHp) * 100, 0, 100);
    this.el.bossFill.style.width = `${pct}%`;
  }

  updateHud(game) {
    const p = game.player;
    if (!p) return;
    const hpPct = clamp((p.hp / p.maxHp) * 100, 0, 100);
    const cache = this.cache;

    const hpRounded = Math.round(hpPct * 10) / 10;
    if (cache.hp !== hpRounded) {
      cache.hp = hpRounded;
      if (this.el.hpFill) {
        this.el.hpFill.style.width = `${hpPct}%`;
        this.el.hpFill.classList.toggle('low', hpPct < 34);
      }
      if (this.el.hpGhost) this.el.hpGhost.style.width = `${hpPct}%`;
      if (this.el.hpText) this.el.hpText.textContent = String(Math.ceil(p.hp));
    }

    const rage = Math.round(p.meter);
    if (cache.rage !== rage) {
      cache.rage = rage;
      if (this.el.rageFill) this.el.rageFill.style.width = `${clamp(rage, 0, 100)}%`;
      if (this.el.rageHint) {
        const ready = rage >= 50;
        this.el.rageHint.textContent = ready ? '¡ESPECIAL LISTO!' : 'ESPECIAL · L';
        this.el.rageHint.classList.toggle('ready', ready);
      }
    }

    if (cache.score !== game.score) {
      cache.score = game.score;
      if (this.el.score) this.el.score.textContent = formatScore(game.score);
    }
    if (cache.best !== game.best) {
      cache.best = game.best;
      if (this.el.bestScore) this.el.bestScore.textContent = formatScore(game.best);
      if (this.el.titleBest) this.el.titleBest.textContent = formatScore(game.best);
    }

    if (cache.combo !== game.combo) {
      cache.combo = game.combo;
      const show = game.combo >= 2;
      this.el.combo?.classList.toggle('hidden', !show);
      if (this.el.comboCount) this.el.comboCount.textContent = String(game.combo);
      if (this.el.comboRank) this.el.comboRank.textContent = game.comboRank();
      if (show) {
        const el = this.el.combo;
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
      }
    }

    const wave = game.waveIndex >= 0 ? game.waveIndex + 1 : 1;
    if (cache.wave !== wave) {
      cache.wave = wave;
      this.setWave(wave, game.waveTotal || 5);
    }
  }

  hint(show) {
    if (!this.el.hint) return;
    this.el.hint.classList.toggle('hidden', !show);
    if (show) {
      this.el.hint.style.animation = 'none';
      void this.el.hint.offsetWidth;
      this.el.hint.style.animation = '';
    }
  }

  flash(color = 'rgba(255,255,255,0.3)', strength = 0.4) {
    const el = this.el.flash;
    if (!el) return;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = String(strength);
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 180ms ease-out';
      el.style.opacity = '0';
    });
  }
}
