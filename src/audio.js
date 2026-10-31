import { clamp, rand } from './utils.js';

/**
 * Tiny procedural audio engine. No external assets, no network requests.
 * Sounds are synthesized on demand so the whole game stays one static bundle.
 */
export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('neon-fist-muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 22;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.22;
      this.master.connect(this.compressor).connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
      return true;
    } catch {
      this.context = null;
      return false;
    }
  }

  createNoiseBuffer() {
    const length = this.context.sampleRate * 1.2;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    try { localStorage.setItem('neon-fist-muted', muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.context.currentTime, 0.03);
    }
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  now() {
    return this.context ? this.context.currentTime : 0;
  }

  tone({ frequency = 220, endFrequency = frequency, duration = 0.15, type = 'sine', volume = 0.3, attack = 0.004, delay = 0, detune = 0 }) {
    if (!this.context || this.muted) return;
    const t0 = this.now() + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.detune.value = detune;
    osc.frequency.setValueAtTime(Math.max(20, frequency), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  noise({ duration = 0.12, volume = 0.25, filter = 1400, filterEnd = filter, type = 'bandpass', q = 0.8, delay = 0 }) {
    if (!this.context || this.muted || !this.noiseBuffer) return;
    const t0 = this.now() + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filterNode = this.context.createBiquadFilter();
    filterNode.type = type;
    filterNode.Q.value = q;
    filterNode.frequency.setValueAtTime(filter, t0);
    filterNode.frequency.exponentialRampToValueAtTime(Math.max(60, filterEnd), t0 + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filterNode).connect(gain).connect(this.master);
    source.start(t0);
    source.stop(t0 + duration + 0.02);
  }

  click() {
    if (!this.ensure()) return;
    this.tone({ frequency: 410, endFrequency: 640, duration: 0.06, type: 'triangle', volume: 0.11 });
  }

  ui() {
    if (!this.ensure()) return;
    this.tone({ frequency: 640, endFrequency: 980, duration: 0.09, type: 'sine', volume: 0.1 });
    this.tone({ frequency: 980, endFrequency: 1400, duration: 0.12, type: 'sine', volume: 0.05, delay: 0.04 });
  }

  whoosh(strength = 1) {
    if (!this.ensure()) return;
    this.noise({ duration: 0.16 + strength * 0.08, volume: 0.07 + strength * 0.04, filter: 700, filterEnd: 2400, q: 1.4 });
  }

  hitLight() {
    if (!this.ensure()) return;
    this.noise({ duration: 0.075, volume: 0.24, filter: 2600, filterEnd: 600, type: 'highpass', q: 0.6 });
    this.tone({ frequency: 180, endFrequency: 70, duration: 0.1, type: 'square', volume: 0.1 });
  }

  hitHeavy() {
    if (!this.ensure()) return;
    this.noise({ duration: 0.19, volume: 0.38, filter: 1800, filterEnd: 120, type: 'lowpass', q: 0.8 });
    this.tone({ frequency: 155, endFrequency: 38, duration: 0.3, type: 'sine', volume: 0.32 });
    this.tone({ frequency: 74, endFrequency: 30, duration: 0.36, type: 'triangle', volume: 0.25 });
  }

  shield() {
    if (!this.ensure()) return;
    this.tone({ frequency: 1250, endFrequency: 640, duration: 0.16, type: 'square', volume: 0.07 });
    this.tone({ frequency: 1870, endFrequency: 1320, duration: 0.12, type: 'sine', volume: 0.1 });
    this.noise({ duration: 0.08, volume: 0.1, filter: 3200, filterEnd: 2000, type: 'highpass' });
  }

  grab() {
    if (!this.ensure()) return;
    this.noise({ duration: 0.1, volume: 0.16, filter: 600, filterEnd: 1600, q: 2 });
    this.tone({ frequency: 220, endFrequency: 330, duration: 0.07, type: 'triangle', volume: 0.08 });
  }

  throwEnemy() {
    if (!this.ensure()) return;
    this.noise({ duration: 0.32, volume: 0.2, filter: 350, filterEnd: 2200, q: 0.7 });
    this.tone({ frequency: 110, endFrequency: 250, duration: 0.24, type: 'sawtooth', volume: 0.08 });
  }

  jump() {
    if (!this.ensure()) return;
    this.tone({ frequency: 210, endFrequency: 430, duration: 0.11, type: 'sine', volume: 0.08 });
    this.noise({ duration: 0.06, volume: 0.05, filter: 900, filterEnd: 2600 });
  }

  land() {
    if (!this.ensure()) return;
    this.noise({ duration: 0.12, volume: 0.15, filter: 400, filterEnd: 90, type: 'lowpass' });
    this.tone({ frequency: 90, endFrequency: 45, duration: 0.12, type: 'sine', volume: 0.12 });
  }

  slam() {
    if (!this.ensure()) return;
    this.noise({ duration: 0.38, volume: 0.4, filter: 900, filterEnd: 70, type: 'lowpass', q: 1 });
    this.tone({ frequency: 68, endFrequency: 26, duration: 0.45, type: 'sine', volume: 0.4 });
  }

  electric(duration = 0.5) {
    if (!this.ensure()) return;
    this.tone({ frequency: 1800, endFrequency: 120, duration: duration * 0.8, type: 'sawtooth', volume: 0.09 });
    this.tone({ frequency: 93, endFrequency: 58, duration, type: 'square', volume: 0.06, detune: -12 });
    for (let i = 0; i < 5; i += 1) {
      this.tone({
        frequency: rand(900, 2600),
        endFrequency: rand(180, 900),
        duration: rand(0.04, 0.11),
        type: 'square',
        volume: 0.04,
        delay: i * 0.045,
      });
    }
    this.noise({ duration: duration * 0.9, volume: 0.12, filter: 3000, filterEnd: 400, type: 'bandpass', q: 1.6 });
  }

  special() {
    if (!this.ensure()) return;
    this.tone({ frequency: 60, endFrequency: 600, duration: 0.7, type: 'sawtooth', volume: 0.08 });
    this.tone({ frequency: 880, endFrequency: 110, duration: 0.55, type: 'square', volume: 0.06, delay: 0.08 });
    this.noise({ duration: 0.6, volume: 0.18, filter: 500, filterEnd: 6000, q: 1.2 });
    this.slam();
  }

  hurt() {
    if (!this.ensure()) return;
    this.noise({ duration: 0.16, volume: 0.24, filter: 1200, filterEnd: 240, type: 'lowpass' });
    this.tone({ frequency: 160, endFrequency: 55, duration: 0.2, type: 'sawtooth', volume: 0.12 });
  }

  death() {
    if (!this.ensure()) return;
    this.tone({ frequency: 280, endFrequency: 32, duration: 0.95, type: 'sawtooth', volume: 0.16 });
    this.noise({ duration: 0.8, volume: 0.18, filter: 1600, filterEnd: 70, type: 'lowpass' });
  }

  wave() {
    if (!this.ensure()) return;
    this.tone({ frequency: 146, endFrequency: 146, duration: 0.36, type: 'triangle', volume: 0.08 });
    this.tone({ frequency: 220, endFrequency: 220, duration: 0.5, type: 'triangle', volume: 0.06, delay: 0.11 });
    this.tone({ frequency: 293, endFrequency: 293, duration: 0.62, type: 'triangle', volume: 0.05, delay: 0.22 });
  }

  combo(step = 0) {
    if (!this.ensure()) return;
    const scale = [392, 440, 523, 587, 659, 784, 880, 1046];
    const frequency = scale[clamp(step, 0, scale.length - 1)];
    this.tone({ frequency, endFrequency: frequency * 1.02, duration: 0.07, type: 'sine', volume: 0.045 });
  }

  charged() {
    if (!this.ensure()) return;
    this.tone({ frequency: 660, endFrequency: 1320, duration: 0.28, type: 'triangle', volume: 0.09 });
    this.tone({ frequency: 990, endFrequency: 1980, duration: 0.34, type: 'sine', volume: 0.05, delay: 0.06 });
  }

  revive() {
    if (!this.ensure()) return;
    [330, 440, 554, 660].forEach((frequency, index) => {
      this.tone({ frequency, duration: 0.24, type: 'sine', volume: 0.07, delay: index * 0.07 });
    });
  }
}
