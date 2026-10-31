import { clamp } from './utils.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: document.getElementById('hud'),
      controls: document.getElementById('controls'),
      hpFill: document.getElementById('hpFill'),
      hpGhost: document.getElementById('hpGhost'),
      hpText: document.getElementById('hpText'),
      batteryFill: document.getElementById('batteryFill'),
      batteryText: document.getElementById('batteryText'),
      batteryMeter: document.getElementById('batteryMeter'),
      batteryState: document.getElementById('batteryState'),
      specialBtn: document.getElementById('specialBtn'),
      specialCharge: document.getElementById('specialCharge'),
      waveValue: document.getElementById('waveValue'),
      killValue: document.getElementById('killValue'),
      comboDisplay: document.getElementById('comboDisplay'),
      comboCount: document.getElementById('comboCount'),
      comboRank: document.getElementById('comboRank'),
      comboTimer: document.getElementById('comboTimer'),
      banner: document.getElementById('banner'),
      bannerKicker: document.getElementById('bannerKicker'),
      bannerTitle: document.getElementById('bannerTitle'),
      bannerSub: document.getElementById('bannerSub'),
      contextTip: document.getElementById('contextTip'),
      menuScreen: document.getElementById('menuScreen'),
      howScreen: document.getElementById('howScreen'),
      pauseScreen: document.getElementById('pauseScreen'),
      gameoverScreen: document.getElementById('gameoverScreen'),
      adScreen: document.getElementById('adScreen'),
      pauseWave: document.getElementById('pauseWave'),
      pauseKills: document.getElementById('pauseKills'),
      pauseCombo: document.getElementById('pauseCombo'),
      goKicker: document.getElementById('goKicker'),
      goTitle: document.getElementById('goTitle'),
      goCopy: document.getElementById('goCopy'),
      goWave: document.getElementById('goWave'),
      goKills: document.getElementById('goKills'),
      goCombo: document.getElementById('goCombo'),
      goTime: document.getElementById('goTime'),
      reviveOffer: document.getElementById('reviveOffer'),
      offerDeaths: document.getElementById('offerDeaths'),
      goAdNote: document.getElementById('goAdNote'),
      menuSoundBtn: document.getElementById('menuSoundBtn'),
      adProgress: document.getElementById('adProgress'),
      adCountdown: document.getElementById('adCountdown'),
      adSkip: document.getElementById('adSkip'),
      adClaim: document.getElementById('adClaim'),
      startBtn: document.getElementById('startBtn'),
      soundBtn: document.getElementById('soundBtn'),
    };
    this.contextTimer = 0;
    this.contextText = '';
    this.bannerToken = 0;
    this.comboLast = 0;
    this.bind();
    this.syncSound();
  }

  bind() {
    const click = (id, handler) => {
      const element = document.getElementById(id);
      if (!element) return;
      element.addEventListener('click', (event) => {
        event.preventDefault();
        this.game.audio.click();
        handler(event);
      });
    };

    click('startBtn', () => this.game.startRun());
    click('howBtn', () => this.game.openHow());
    click('howClose', () => this.game.closeHow());
    click('howBack', () => this.game.closeHow());
    click('pauseBtn', () => this.game.togglePause());
    click('resumeBtn', () => this.game.resume());
    click('pauseRestart', () => this.game.restart());
    click('pauseMenu', () => this.game.toMenu());
    click('retryBtn', () => this.game.retry());
    click('goMenuBtn', () => this.game.toMenu(true));
    click('reviveBtn', () => this.game.acceptRevive());
    click('adSkip', () => this.game.finishAd());
    click('adClaim', () => this.game.finishAd());
    click('soundBtn', () => this.game.toggleSound());
    click('menuSoundBtn', () => this.game.toggleSound());
  }

  syncSound() {
    const muted = this.game.audio.muted;
    document.body.classList.toggle('muted', muted);
    if (this.el.menuSoundBtn) this.el.menuSoundBtn.textContent = muted ? 'SONIDO: NO' : 'SONIDO: SÍ';
    const soundBtn = this.el.soundBtn;
    if (soundBtn) {
      soundBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
      soundBtn.setAttribute('aria-pressed', String(muted));
    }
  }

  showScreen(name) {
    const screens = {
      menu: this.el.menuScreen,
      how: this.el.howScreen,
      pause: this.el.pauseScreen,
      gameover: this.el.gameoverScreen,
      ad: this.el.adScreen,
    };
    for (const [key, element] of Object.entries(screens)) {
      if (!element) continue;
      element.classList.toggle('hidden', key !== name);
    }
    const inGame = !name;
    this.el.hud.classList.toggle('is-hidden', ['menu', 'how'].includes(name));
    this.el.hud.classList.toggle('is-dimmed', ['pause', 'gameover', 'ad'].includes(name));
    this.el.controls.classList.toggle('is-hidden', Boolean(name));
    if (name) {
      this.el.banner.classList.remove('show');
      this.el.contextTip.classList.remove('show');
      this.contextTimer = 0;
    }
    if (name === 'pause') {
      this.el.pauseWave.textContent = String(this.game.wave).padStart(2, '0');
      this.el.pauseKills.textContent = String(this.game.kills).padStart(2, '0');
      this.el.pauseCombo.textContent = String(this.game.player?.bestCombo || 0);
    }
    if (name === 'menu' || name === 'how') {
      this.el.comboDisplay.classList.remove('show');
    }
    if (name === 'gameover') {
      this.el.contextTip.classList.remove('show');
    }
    if (!inGame) this.game.input?.clear();
    this.game.input?.setEnabled(!name || name === 'pause');
  }

  update(dt) {
    const player = this.game.player;
    if (!player) return;
    const hpRatio = clamp(player.hp / player.maxHp, 0, 1);
    this.el.hpFill.style.transform = `scaleX(${hpRatio})`;
    this.el.hpGhost.style.transform = `scaleX(${hpRatio})`;
    this.el.hpText.textContent = String(Math.max(0, Math.ceil(player.hp)));
    this.el.hpFill.classList.toggle('low', hpRatio <= 0.3);
    this.el.hpGhost.style.transitionDelay = hpRatio < 0.3 ? '0s' : '.35s';

    const batteryRatio = clamp(player.battery / 100, 0, 1);
    this.el.batteryFill.style.transform = `scaleX(${batteryRatio})`;
    this.el.batteryText.textContent = `${Math.floor(player.battery)}%`;
    this.el.batteryMeter.classList.toggle('is-full', batteryRatio >= 1);
    this.el.batteryState.textContent = batteryRatio >= 1 ? 'LISTA' : batteryRatio > 0 ? 'CARGANDO' : 'VACÍA';
    this.el.batteryState.classList.toggle('ready', batteryRatio >= 1);
    this.el.specialBtn.classList.toggle('ready', batteryRatio >= 1);
    this.el.specialBtn.classList.toggle('locked', batteryRatio < 1);
    this.el.specialCharge.textContent = `${Math.floor(player.battery)}%`;
    this.el.specialBtn.style.setProperty('--charge', `${batteryRatio * 360}deg`);
    this.el.waveValue.textContent = String(this.game.wave).padStart(2, '0');
    this.el.killValue.textContent = String(this.game.kills).padStart(2, '0');

    if (this.contextTimer > 0) {
      this.contextTimer -= dt;
      if (this.contextTimer <= 0) this.el.contextTip.classList.remove('show');
    }
  }

  setWave(wave) {
    this.el.waveValue.textContent = String(wave).padStart(2, '0');
  }

  setKills(kills) {
    this.el.killValue.textContent = String(kills).padStart(2, '0');
  }

  comboRank(count) {
    if (count >= 30) return 'LEYENDA NEÓN';
    if (count >= 18) return 'ANIME MODE';
    if (count >= 10) return 'SALVAJE';
    if (count >= 5) return 'IMPARABLE';
    return 'EN RACHA';
  }

  renderCombo(count, timerRatio) {
    if (this.comboLast !== count) {
      this.comboLast = count;
      this.el.comboCount.textContent = String(count);
      this.el.comboRank.textContent = this.comboRank(count);
    }
    this.el.comboTimer.style.transform = `scaleX(${clamp(timerRatio, 0, 1)})`;
  }

  comboHit(count, timerRatio) {
    if (count <= 0) {
      this.setCombo(0, 0);
      return;
    }
    this.renderCombo(count, timerRatio);
    this.el.comboDisplay.classList.add('show');
  }

  setCombo(count, timerRatio = 0) {
    if (count <= 0) {
      this.comboLast = 0;
      this.el.comboDisplay.classList.remove('show');
      return;
    }
    this.renderCombo(count, timerRatio);
    this.el.comboDisplay.classList.add('show');
  }

  updateCombo(count, timerRatio) {
    if (count <= 0) {
      this.setCombo(0, 0);
      return;
    }
    this.renderCombo(count, timerRatio);
    this.el.comboDisplay.classList.add('show');
  }

  banner(kicker, title, sub = '', variant = '', duration = 1.8) {
    this.bannerToken += 1;
    const token = this.bannerToken;
    const banner = this.el.banner;
    this.el.bannerKicker.textContent = kicker;
    this.el.bannerTitle.textContent = title;
    this.el.bannerSub.textContent = sub;
    banner.classList.remove('alert', 'danger');
    if (variant === 'alert') banner.classList.add('alert');
    if (variant === 'danger') banner.classList.add('danger');
    banner.classList.add('show');
    window.setTimeout(() => {
      if (token === this.bannerToken) banner.classList.remove('show');
    }, duration * 1000);
  }

  hideBanner() {
    this.bannerToken += 1;
    this.el.banner.classList.remove('show');
  }

  showContextTip(html, duration = 1.6) {
    if (!html) {
      this.el.contextTip.classList.remove('show');
      this.contextTimer = 0;
      this.contextText = '';
      return;
    }
    if (this.contextText !== html) {
      this.contextText = html;
      this.el.contextTip.innerHTML = html;
    }
    this.el.contextTip.classList.add('show');
    this.contextTimer = duration;
  }

  flashBattery() {
    this.el.batteryMeter.classList.remove('flash');
    // force reflow to replay the animation
    void this.el.batteryMeter.offsetWidth;
    this.el.batteryMeter.classList.add('flash');
    window.setTimeout(() => this.el.batteryMeter.classList.remove('flash'), 450);
  }

  showPause() {
    this.showScreen('pause');
  }

  showGameOver({ special, stats }) {
    this.el.goKicker.textContent = special ? 'SEGUNDA CAÍDA CONSECUTIVA' : 'FIN DEL COMBATE';
    this.el.goTitle.textContent = special ? 'LA ARENA TE LLAMA' : 'HAS CAÍDO';
    this.el.goCopy.textContent = special
      ? 'Dos caídas. El neón aún no ha terminado contigo. La decisión es tuya.'
      : 'La arena reclama otro nombre. Pero los neones siguen encendidos.';
    this.el.goWave.textContent = String(stats.wave).padStart(2, '0');
    this.el.goKills.textContent = String(stats.kills).padStart(2, '0');
    this.el.goCombo.textContent = String(stats.bestCombo || 0);
    this.el.goTime.textContent = stats.time;
    this.el.reviveOffer.classList.toggle('hidden', !special);
    this.el.offerDeaths.textContent = `${stats.deathCount} CAÍDAS CONSECUTIVAS`;
    this.el.goAdNote.classList.toggle('hidden', special);
    this.el.goAdNote.textContent = 'Sin anuncios en esta caída.';
    this.showScreen('gameover');
  }

  showAd() {
    this.el.adProgress.style.width = '0%';
    this.el.adCountdown.textContent = '5';
    this.el.adSkip.classList.remove('hidden');
    this.el.adClaim.classList.add('hidden');
    this.showScreen('ad');
  }

  updateAd(progress, secondsLeft) {
    this.el.adProgress.style.width = `${clamp(progress, 0, 1) * 100}%`;
    this.el.adCountdown.textContent = String(Math.max(0, Math.ceil(secondsLeft)));
    if (progress >= 1) {
      this.el.adSkip.classList.add('hidden');
      this.el.adClaim.classList.remove('hidden');
    }
  }

  showMenu() {
    this.showScreen('menu');
  }

  showHow() {
    this.showScreen('how');
  }
}
