/**
 * AudioEngine: all sound is synthesized with WebAudio — no external assets.
 * SFX + a small procedural synth loop.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicOn = false;
    this.nextNote = 0;
    this.step = 0;
    this.intensity = 0;
    this.ready = false;
    try {
      this.muted = localStorage.getItem('sticksmash.muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.82;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.master);

      const len = this.ctx.sampleRate * 1.2;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
      this.ready = true;
    } catch {
      this.ready = false;
    }
  }

  resume() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(value) {
    this.muted = value;
    try { localStorage.setItem('sticksmash.muted', value ? '1' : '0'); } catch {}
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value ? 0 : 0.82, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------- primitives ----------
  tone({ freq = 220, to = freq, dur = 0.15, type = 'sine', gain = 0.2, attack = 0.005, delay = 0, bus = null }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.now() + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.12, gain = 0.2, freq = 1200, q = 1, type = 'bandpass', delay = 0, sweepTo = null, bus = null }) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const t0 = this.now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.value = q;
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---------- game sounds ----------
  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'whoosh':
        this.noise({ dur: 0.14, gain: 0.1, freq: 620, q: 1.6, sweepTo: 2400, type: 'bandpass' });
        break;
      case 'kickWhoosh':
        this.noise({ dur: 0.2, gain: 0.12, freq: 300, q: 1.2, sweepTo: 1600 });
        break;
      case 'hit':
        this.noise({ dur: 0.1, gain: 0.32, freq: 1400, q: 0.7, type: 'lowpass' });
        this.tone({ freq: 180, to: 70, dur: 0.13, type: 'triangle', gain: 0.28 });
        this.tone({ freq: 68, to: 42, dur: 0.18, type: 'sine', gain: 0.34 });
        break;
      case 'hitHeavy':
        this.noise({ dur: 0.22, gain: 0.42, freq: 900, q: 0.6, type: 'lowpass' });
        this.tone({ freq: 130, to: 38, dur: 0.3, type: 'sawtooth', gain: 0.26 });
        this.tone({ freq: 55, to: 32, dur: 0.34, type: 'sine', gain: 0.44 });
        break;
      case 'block':
        this.tone({ freq: 420, to: 260, dur: 0.12, type: 'square', gain: 0.16 });
        this.noise({ dur: 0.08, gain: 0.12, freq: 3200, q: 2.4 });
        break;
      case 'jump':
        this.tone({ freq: 240, to: 520, dur: 0.16, type: 'sine', gain: 0.14 });
        this.noise({ dur: 0.1, gain: 0.05, freq: 500, sweepTo: 1200 });
        break;
      case 'land':
        this.noise({ dur: 0.1, gain: 0.12, freq: 500, q: 0.7, type: 'lowpass' });
        break;
      case 'dodge':
        this.noise({ dur: 0.22, gain: 0.12, freq: 1400, q: 1.1, sweepTo: 380 });
        break;
      case 'special':
        this.noise({ dur: 0.6, gain: 0.2, freq: 200, q: 1.4, sweepTo: 3800 });
        this.tone({ freq: 90, to: 420, dur: 0.5, type: 'sawtooth', gain: 0.14 });
        break;
      case 'specialHit':
        this.noise({ dur: 0.12, gain: 0.2, freq: 2000, q: 1.2 });
        this.tone({ freq: 230, to: 90, dur: 0.12, type: 'square', gain: 0.1 });
        break;
      case 'ko':
        this.noise({ dur: 0.6, gain: 0.4, freq: 700, q: 0.5, type: 'lowpass' });
        this.tone({ freq: 160, to: 32, dur: 0.7, type: 'sawtooth', gain: 0.32 });
        this.tone({ freq: 60, to: 28, dur: 0.9, type: 'sine', gain: 0.5 });
        break;
      case 'death':
        this.noise({ dur: 0.35, gain: 0.22, freq: 600, q: 0.6, type: 'lowpass' });
        this.tone({ freq: 110, to: 40, dur: 0.4, type: 'triangle', gain: 0.2 });
        break;
      case 'pickup':
        this.tone({ freq: 660, dur: 0.1, type: 'sine', gain: 0.16 });
        this.tone({ freq: 990, dur: 0.16, type: 'sine', gain: 0.13, delay: 0.08 });
        this.tone({ freq: 1320, dur: 0.22, type: 'sine', gain: 0.1, delay: 0.16 });
        break;
      case 'wave':
        this.tone({ freq: 330, dur: 0.18, type: 'triangle', gain: 0.12 });
        this.tone({ freq: 495, dur: 0.22, type: 'triangle', gain: 0.1, delay: 0.1 });
        this.tone({ freq: 660, dur: 0.4, type: 'triangle', gain: 0.08, delay: 0.2 });
        break;
      case 'waveClear':
        [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.09, delay: i * 0.09 }));
        break;
      case 'click':
        this.tone({ freq: 760, to: 980, dur: 0.06, type: 'square', gain: 0.06 });
        break;
      case 'warn':
        this.tone({ freq: 300, to: 220, dur: 0.1, type: 'square', gain: 0.05 });
        break;
      case 'roar':
        this.tone({ freq: 72, to: 46, dur: 1.1, type: 'sawtooth', gain: 0.28 });
        this.tone({ freq: 108, to: 60, dur: 0.9, type: 'square', gain: 0.08 });
        this.noise({ dur: 1.0, gain: 0.16, freq: 380, q: 0.7, type: 'lowpass' });
        break;
      case 'evade':
        this.noise({ dur: 0.14, gain: 0.08, freq: 2200, q: 2, sweepTo: 700 });
        break;
      default:
        break;
    }
    // Tiny random detune variation on impacts keeps them from feeling repetitive.
    if ((name === 'hit' || name === 'hitHeavy') && opts.pitch) {
      this.tone({ freq: 300 * opts.pitch, to: 120 * opts.pitch, dur: 0.05, type: 'square', gain: 0.05 });
    }
  }

  // ---------- music ----------
  startMusic() {
    this.init();
    if (!this.ctx) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.08;
  }

  stopMusic() {
    this.musicOn = false;
  }

  setIntensity(value) {
    this.intensity = Math.max(0, Math.min(1, value));
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(0.14 + this.intensity * 0.08, this.ctx.currentTime, 0.4);
    }
  }

  updateMusic() {
    if (!this.musicOn || !this.ctx || this.muted) return;
    const stepDur = 60 / 104 / 4; // 16th notes @ 104 bpm
    let guard = 0;
    while (this.nextNote < this.ctx.currentTime + 0.2 && guard < 32) {
      this.scheduleStep(this.step, this.nextNote);
      this.step = (this.step + 1) % 32;
      this.nextNote += stepDur;
      guard++;
    }
  }

  scheduleStep(step, t) {
    if (!this.ctx || this.muted) return;
    const bassRoots = [0, 0, 7, 0, 3, 3, 10, 3, 0, 0, 7, 0, 5, 5, 12, 10];
    const semitone = (n) => 55 * Math.pow(2, n / 12);

    // Kick
    if (step % 8 === 0 || step === 14 || step === 22) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.16);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g);
      g.connect(this.musicBus);
      osc.start(t);
      osc.stop(t + 0.22);
    }

    // Snare
    if (step % 16 === 8) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1900;
      f.Q.value = 0.9;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      src.connect(f); f.connect(g); g.connect(this.musicBus);
      src.start(t); src.stop(t + 0.18);
    }

    // Hats
    if (step % 2 === 0) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = this.ctx.createGain();
      const accent = step % 4 === 0 ? 0.1 : 0.05;
      g.gain.setValueAtTime(accent, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      src.connect(f); f.connect(g); g.connect(this.musicBus);
      src.start(t); src.stop(t + 0.05);
    }

    // Bass pluck every other step
    if (step % 2 === 0) {
      const note = bassRoots[(step / 2) % bassRoots.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(520 + this.intensity * 900, t);
      f.Q.value = 6;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(semitone(note), t);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(f); f.connect(g); g.connect(this.musicBus);
      osc.start(t); osc.stop(t + 0.22);
    }

    // Sparse lead on the second half of the loop
    if (this.intensity > 0.3 && step % 4 === 2 && step > 12) {
      const notes = [24, 27, 31, 34, 31, 27];
      const note = notes[(step / 2) % notes.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(semitone(note), t);
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(g); g.connect(this.musicBus);
      osc.start(t); osc.stop(t + 0.28);
    }
  }
}
