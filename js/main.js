import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';

const audio = new AudioEngine();
const input = new Input();
const ui = new UI(audio);
const canvas = document.getElementById('game');
const game = new Game(canvas, ui, input, audio);

ui.bind(game, input);
input.bindTouch(document.getElementById('joystick'), document.getElementById('stickKnob'));

// Any first interaction unlocks WebAudio on mobile and desktop.
window.addEventListener('pointerdown', () => audio.resume(), { passive: true });
window.addEventListener('keydown', () => audio.resume(), { passive: true });

let last = performance.now();
let lastRenderState = '';
let crashed = false;
let smoothFrames = 0;
let previousFrameAt = performance.now();
let lastSeenState = '';
let menuSceneShown = false;
const bootAt = performance.now();
// The first paint of the canvas is the one thing that can lock up software
// renderers for seconds. Hold the painted backdrop back briefly so the page
// and its Play control are responsive immediately; the scene is already on
// screen by the time a human has read the logo.
const MENU_SCENE_DELAY = 1400;

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  // Consider the UI "warmed up" once frames start arriving at a sane pace.
  // Under software rendering the first composite can block for seconds, so
  // the Play button advertises itself as not-ready until this clears.
  if (now - previousFrameAt < 140) smoothFrames += 1;
  else smoothFrames = 0;
  previousFrameAt = now;
  if (smoothFrames >= 4) ui.markReady();

  input.pollGamepad();

  if (input.pressed('mute')) {
    const muted = audio.toggleMute();
    ui.setMuted(muted);
  }
  if (input.pressed('pause')) {
    if (game.state === 'playing' || game.state === 'paused') game.togglePause();
  }
  if (input.pressed('start')) {
    if (game.state === 'menu') game.startGame();
    else if (game.state === 'gameover') game.restart();
    else if (game.state === 'victory') game.restart();
  }

  game.update(dt);

  if (game.state !== lastSeenState) {
    lastSeenState = game.state;
    if (game.state === 'menu') menuSceneShown = false;
  }
  if (game.state === 'menu' && !menuSceneShown && now - bootAt >= MENU_SCENE_DELAY) {
    menuSceneShown = true;
    lastRenderState = '';
  }

  canvas.classList.toggle('is-veiled', game.state === 'menu' && !menuSceneShown);

  // Outside live combat the scene is static. Draw it once per state instead
  // of every frame: repeated full-screen composites are what make
  // software-rendered browsers crawl (and they can starve UI clicks).
  const still = game.state !== 'playing' && game.state !== 'dying';
  const readyToDraw = game.state !== 'menu' || menuSceneShown;
  if (readyToDraw && (!still || game.state !== lastRenderState)) {
    game.render();
    lastRenderState = game.state;
  }

  audio.updateMusic();
  input.endFrame();

  if (!crashed) requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Expose a small debug surface for automated verification without affecting play.
window.__stickSmash = {
  game,
  start: () => game.startGame(),
  pause: () => game.pause(),
  resume: () => game.resume(),
  state: () => game.state,
  snapshot: () => ({
    state: game.state,
    wave: game.waveIndex + 1,
    waveState: game.waveState,
    score: game.score,
    combo: game.combo,
    enemies: game.enemies.length,
    playerHp: game.player?.hp ?? null,
    playerState: game.player?.state ?? null,
    fps: Math.round(1000 / Math.max(1, performance.now() - last)),
  }),
};

window.addEventListener('error', () => { crashed = false; });
