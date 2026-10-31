(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const choose = list => list[(Math.random() * list.length) | 0];
  const pad = value => String(Math.max(0, value | 0)).padStart(2, '0');
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  const canvas = $('#stage');
  const ctx = canvas.getContext('2d', { alpha: false });
  const app = $('#app');
  const els = {
    hpFill: $('#hpFill'), hpGhost: $('#hpGhost'), hpText: $('#hpText'),
    energyText: $('#energyText'), battery: $('#battery'),
    waveText: $('#waveText'), killText: $('#killText'),
    combo: $('#comboReadout'), comboNumber: $('#comboNumber'),
    banner: $('#waveBanner'), bannerKicker: $('#bannerKicker'),
    bannerTitle: $('#bannerTitle'), bannerSub: $('#bannerSub'),
    contextHint: $('#contextHint'), specialBtn: $('.action-special'),
    specialCost: $('#specialCost'), touch: $('#touch'),
    menu: $('#menu'), howPanel: $('#howPanel'), pausePanel: $('#pausePanel'),
    gameover: $('#gameover'), adPanel: $('#adPanel'),
    screenFlash: $('#screenFlash'), speedLines: $('#speedLines'),
    goTitle: $('#goTitle'), goCopy: $('#goCopy'), goKicker: $('#goKicker'),
    goWave: $('#goWave'), goKills: $('#goKills'), goDeath: $('#goDeath'),
    goActions: $('.go-actions'), reviveOffer: $('#reviveOffer'), deathPips: $('#deathPips'),
    adFill: $('#adFill'), adTimer: $('#adTimer'), skipAdBtn: $('#skipAdBtn'),
    toast: $('#toast'), muteBtn: $('#muteBtn')
  };

  const view = {
    w: 0, h: 0, dpr: 1, groundY: 600, left: 28, right: 900,
    actorScale: 1, wallTop: 0, floorH: 220
  };

  const PALETTE = {
    player: { core: '#35e9ff', bright: '#e1feff', deep: '#0b7cff', dark: '#03101f', aura: '#23d9ff' },
    red: { core: '#ff4d61', bright: '#ffd4d8', deep: '#c31535', dark: '#1a050b', aura: '#ff3152' },
    green: { core: '#53ff9a', bright: '#dcffe9', deep: '#0b9a54', dark: '#03150c', aura: '#36ff8f' },
    gold: { core: '#efff55', bright: '#ffffdc', deep: '#b4c400', dark: '#171700', aura: '#e9ff44' }
  };

  const state = {
    screen: 'menu', paused: false, dying: false,
    realTime: 0, time: 0, shake: 0, hitStop: 0, flash: 0,
    bulletTime: 0, bulletMax: 0, slow: 1,
    wave: 1, kills: 0, deaths: 0, combo: 0, comboTimer: 0,
    score: 0, spawnQueue: [], spawnTimer: 0, waveClearTimer: 0,
    waveActive: false, bannerTimer: 0, goTimer: 0, deadTimer: 0,
    adTime: 0, adDuration: 4, adDone: false, adStartedAt: 0,
    hintTimer: 0, toastTimer: 0, lastHp: -1,
    enemies: [], particles: [], floaters: [], decals: [], portals: [],
    ambient: [], menuFighters: [], menuMode: true,
    settings: { sound: true }
  };

  const player = {
    kind: 'player', x: 500, y: 600, vx: 0, vy: 0, facing: 1,
    hp: 100, maxHp: 100, energy: 35, action: 'idle', actionTime: 0,
    actionDur: .4, comboStep: 0, comboQueued: false, grounded: true,
    invuln: 0, wallSide: 0, wallCooldown: 0, grabTarget: null,
    grabTimer: 0, attackHit: new Set(), hitFlash: 0, animTime: 0,
    scale: 1, dead: false, ragdoll: false, angle: 0, angleVel: 0,
    sparkTimer: 0, specialHits: new Set(), wallKickHits: new Set(), suplexTarget: null,
    introGrace: 0, deadShown: false, specialSlam: false
  };

  let bgCanvas = null;
  const held = { left: false, right: false, down: false, up: false };
  const buffered = { quick: 0, heavy: 0, grab: 0, special: 0, jump: 0 };
  const keysDown = new Set();

  function setScreen(screen) {
    state.screen = screen;
    app.dataset.screen = screen;
  }

  function makeBattery() {
    els.battery.innerHTML = '';
    for (let i = 0; i < 10; i++) els.battery.appendChild(document.createElement('b'));
  }

  function resetPlayer() {
    player.x = view.w * .49;
    player.y = view.groundY;
    player.vx = 0; player.vy = 0; player.facing = 1;
    player.hp = 100; player.energy = 35;
    player.action = 'idle'; player.actionTime = 0; player.actionDur = .4;
    player.comboStep = 0; player.comboQueued = false; player.grounded = true;
    player.invuln = 0; player.wallSide = 0; player.wallCooldown = 0;
    player.grabTarget = null; player.grabTimer = 0;
    player.attackHit = new Set(); player.hitFlash = 0; player.animTime = 0;
    player.dead = false; player.ragdoll = false; player.angle = 0; player.angleVel = 0;
    player.specialHits = new Set(); player.wallKickHits = new Set(); player.suplexTarget = null;
    player.introGrace = 0; player.deadShown = false; player.specialSlam = false;
  }

  function resetWorld() {
    resetPlayer();
    state.enemies.length = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.decals.length = 0;
    state.portals.length = 0;
    state.wave = 1; state.kills = 0; state.combo = 0; state.comboTimer = 0;
    state.shake = 0; state.hitStop = 0; state.flash = 0;
    state.bulletTime = 0; state.bulletMax = 1; state.slow = 1;
    state.spawnQueue = []; state.spawnTimer = 0; state.waveClearTimer = 0;
    state.waveActive = false; state.bannerTimer = 0; state.dying = false;
    state.deadTimer = 0; state.goTimer = 0; state.paused = false;
    state.menuMode = false;
    resetCombo();
    updateHud(true);
  }

  function makeEnemy(kind, x, entrance = 'flank') {
    const heavy = kind !== 'red';
    const wave = state.wave;
    const palette = kind === 'red' ? PALETTE.red : kind === 'green' ? PALETTE.green : PALETTE.gold;
    const hp = heavy ? 128 + wave * 18 : 38 + wave * 5;
    return {
      kind, role: heavy ? 'heavy' : 'red', palette,
      x, y: view.groundY, vx: 0, vy: 0, facing: x > player.x ? -1 : 1,
      hp, maxHp: hp, speed: heavy ? rand(49, 61) : rand(122, 158),
      damage: heavy ? 19 : 7, reach: heavy ? 76 : 59,
      state: 'spawn', stateTime: 0, timer: rand(.25, .45), cooldown: rand(.45, 1.1),
      animTime: rand(0, 10), hitFlash: 0, grounded: true, scale: heavy ? 1.09 : .96,
      armored: heavy, armorFlash: 0, dead: false, counted: false, angle: 0, angleVel: 0,
      hitSet: new Set(), thrownBy: null, grabbedBy: null, spawnSide: x > player.x ? 1 : -1,
      entrance, fade: 1, bounceCount: 0, downed: false, launchPower: 0,
      strikeDone: false, attackDir: 1, aiPhase: rand(0, TAU), enraged: 0
    };
  }

  function spawnEnemy(kind, x, entrance = 'flank') {
    const e = makeEnemy(kind, clamp(x, view.left + 34, view.right - 34), entrance);
    state.enemies.push(e);
    addPortal(e.x, view.groundY, e.palette.core, kind === 'red' ? 1 : 1.35);
    return e;
  }

  function resize() {
    const oldW = view.w || innerWidth;
    const oldGround = view.groundY;
    view.w = Math.max(320, innerWidth);
    view.h = Math.max(320, innerHeight);
    view.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    canvas.style.width = view.w + 'px';
    canvas.style.height = view.h + 'px';
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    view.floorH = clamp(view.h * .255, 142, 238);
    view.groundY = view.h - view.floorH;
    view.left = Math.max(23, view.w * .022);
    view.right = view.w - view.left;
    view.wallTop = clamp(view.h * .12, 72, 145);
    view.actorScale = clamp(view.h / 775, .84, 1.15);
    if (view.w < 620) view.actorScale *= .98;

    if (player.x) {
      const ratio = oldW ? player.x / oldW : .5;
      player.x = clamp(player.x, view.left + 20, view.right - 20);
      if (player.grounded) player.y = view.groundY;
      else player.y += view.groundY - oldGround;
      state.enemies.forEach(e => {
        e.x = clamp(e.x, view.left + 20, view.right - 20);
        if (e.grounded || e.state === 'spawn') e.y = view.groundY;
      });
    }
    buildBackground();
    buildAmbient();
    if (state.screen === 'menu') positionMenuFighters();
    updateHud(true);
  }

  function buildAmbient() {
    state.ambient.length = 0;
    const count = Math.round(clamp(view.w / 22, 30, 72));
    for (let i = 0; i < count; i++) {
      state.ambient.push({
        x: rand(0, view.w), y: rand(view.h * .16, view.groundY - 20),
        vx: rand(-5, 5), vy: rand(-12, -3), r: rand(.5, 2),
        alpha: rand(.08, .45), phase: rand(0, TAU), tint: Math.random() > .76
      });
    }
  }

  function seeded(seed) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function buildBackground() {
    const c = document.createElement('canvas');
    c.width = Math.round(view.w * view.dpr);
    c.height = Math.round(view.h * view.dpr);
    const b = c.getContext('2d');
    b.scale(view.dpr, view.dpr);
    const W = view.w, H = view.h, G = view.groundY;
    const rnd = seeded(20871007);

    const sky = b.createLinearGradient(0, 0, 0, G);
    sky.addColorStop(0, '#050b18');
    sky.addColorStop(.38, '#08182b');
    sky.addColorStop(.74, '#0b2537');
    sky.addColorStop(1, '#071523');
    b.fillStyle = sky;
    b.fillRect(0, 0, W, G);

    const haze = b.createRadialGradient(W * .56, H * .31, 10, W * .56, H * .31, W * .52);
    haze.addColorStop(0, 'rgba(25,180,210,.18)');
    haze.addColorStop(.34, 'rgba(16,82,132,.11)');
    haze.addColorStop(1, 'rgba(2,6,13,0)');
    b.fillStyle = haze;
    b.fillRect(0, 0, W, G);

    // Distant neon moon / broken arena halo
    const moonX = W * .55, moonY = H * .285, moonR = clamp(W * .12, 95, 190);
    b.save();
    b.strokeStyle = 'rgba(48,208,230,.18)';
    b.lineWidth = 1;
    b.beginPath(); b.arc(moonX, moonY, moonR * 1.32, 0, TAU); b.stroke();
    b.strokeStyle = 'rgba(96,232,255,.28)';
    b.lineWidth = 2;
    b.beginPath(); b.arc(moonX, moonY, moonR, .24, TAU - .7); b.stroke();
    b.strokeStyle = 'rgba(255,62,158,.25)';
    b.beginPath(); b.arc(moonX, moonY, moonR * .87, 2.2, 4.3); b.stroke();
    b.fillStyle = 'rgba(22,132,165,.035)';
    b.beginPath(); b.arc(moonX, moonY, moonR * .86, 0, TAU); b.fill();
    b.restore();

    // Far skyline
    let x = -60;
    while (x < W + 60) {
      const bw = 28 + rnd() * 75;
      const bh = H * (.075 + rnd() * .23);
      const by = G - bh - 18;
      b.fillStyle = rnd() > .5 ? '#06111f' : '#071521';
      b.fillRect(x, by, bw, bh + 24);
      b.fillStyle = 'rgba(31,92,121,.13)';
      b.fillRect(x, by, bw, 1);
      for (let wy = by + 10; wy < by + bh - 5; wy += 12) {
        for (let wx = x + 6; wx < x + bw - 4; wx += 11) {
          if (rnd() > .79) {
            b.fillStyle = rnd() > .78 ? 'rgba(255,75,149,.34)' : 'rgba(79,214,242,.22)';
            b.fillRect(wx, wy, 2, 2);
          }
        }
      }
      if (rnd() > .76) {
        b.fillStyle = 'rgba(54,223,244,.08)';
        b.fillRect(x + bw * .5 - 1, by - 22, 1, 22);
        b.fillStyle = rnd() > .5 ? 'rgba(53,226,248,.25)' : 'rgba(255,63,151,.23)';
        b.beginPath(); b.arc(x + bw * .5, by - 24, 2, 0, TAU); b.fill();
      }
      x += bw + 4 + rnd() * 14;
    }

    // Signs in the industrial distance
    b.save();
    b.textAlign = 'center';
    b.font = '600 10px "Rajdhani", sans-serif';
    b.fillStyle = 'rgba(86,227,250,.21)';
    b.fillText('SECTOR 07', W * .18, G - 108);
    b.fillStyle = 'rgba(255,73,156,.22)';
    b.fillText('NO HEROES', W * .84, G - 140);
    b.fillStyle = 'rgba(72,225,255,.13)';
    b.fillRect(W * .18 - 31, G - 101, 62, 1);
    b.fillRect(W * .84 - 28, G - 133, 56, 1);
    b.restore();

    // Back arena framework
    const backTop = G - 176;
    b.fillStyle = 'rgba(3,9,17,.55)';
    b.fillRect(0, backTop, W, G - backTop);
    b.strokeStyle = 'rgba(75,194,227,.11)';
    b.lineWidth = 1;
    for (let px = 60; px < W; px += 110) {
      b.beginPath(); b.moveTo(px, backTop); b.lineTo(px, G); b.stroke();
    }
    const panelGrad = b.createLinearGradient(0, backTop, 0, G);
    panelGrad.addColorStop(0, 'rgba(12,47,67,.16)');
    panelGrad.addColorStop(1, 'rgba(2,8,15,.58)');
    b.fillStyle = panelGrad;
    b.fillRect(0, backTop, W, G - backTop);

    // Huge arena glyph
    b.save();
    b.globalAlpha = .055;
    b.fillStyle = '#59ecff';
    b.textAlign = 'center';
    b.font = '700 ' + Math.min(W * .19, 230) + 'px "WenQuanYi Zen Hei", sans-serif';
    b.fillText('闘', W * .5, G - 18);
    b.restore();

    // Hanging cables and banners
    b.strokeStyle = 'rgba(102,180,206,.12)';
    b.lineWidth = 1;
    b.beginPath(); b.moveTo(W * .11, 0); b.bezierCurveTo(W * .14, H * .12, W * .08, H * .2, W * .12, backTop - 33); b.stroke();
    b.beginPath(); b.moveTo(W * .89, 0); b.bezierCurveTo(W * .87, H * .14, W * .92, H * .22, W * .88, backTop - 20); b.stroke();
    drawBanner(b, W * .135, 30, 38, 155, '電', 'rgba(49,228,255,.65)');
    drawBanner(b, W * .865, 17, 34, 120, '龍', 'rgba(255,68,156,.55)');

    // Back crowd / silhouettes
    const crowdAlpha = .36;
    for (let i = 0; i < 26; i++) {
      const cx = (i + .5) * W / 26 + (rnd() - .5) * 12;
      const cy = G - 73 + rnd() * 9;
      b.globalAlpha = crowdAlpha + rnd() * .12;
      b.fillStyle = '#030810';
      b.beginPath(); b.arc(cx, cy, 6 + rnd() * 2, 0, TAU); b.fill();
      b.beginPath(); b.ellipse(cx, cy + 18, 8 + rnd() * 3, 12, 0, 0, TAU); b.fill();
      if (i % 4 === 0) {
        b.fillStyle = i % 8 === 0 ? 'rgba(46,221,255,.38)' : 'rgba(255,57,145,.25)';
        b.beginPath(); b.arc(cx + 6, cy + 9, 1.2, 0, TAU); b.fill();
      }
    }
    b.globalAlpha = 1;

    // Crowd rail
    const railY = G - 50;
    b.fillStyle = 'rgba(2,7,13,.9)';
    b.fillRect(0, railY, W, 5);
    b.fillStyle = 'rgba(79,208,234,.14)';
    b.fillRect(0, railY, W, 1);
    b.strokeStyle = 'rgba(71,169,196,.11)';
    for (let rx = 20; rx < W; rx += 84) {
      b.beginPath(); b.moveTo(rx, railY); b.lineTo(rx - 4, G); b.stroke();
    }

    // Stage floor
    const floor = b.createLinearGradient(0, G, 0, H);
    floor.addColorStop(0, '#0b2332');
    floor.addColorStop(.1, '#071822');
    floor.addColorStop(.55, '#040d16');
    floor.addColorStop(1, '#02060c');
    b.fillStyle = floor;
    b.fillRect(0, G, W, H - G);

    // Floor rim light
    const rim = b.createLinearGradient(0, G - 16, 0, G + 9);
    rim.addColorStop(0, 'rgba(29,205,241,0)');
    rim.addColorStop(.6, 'rgba(45,221,255,.28)');
    rim.addColorStop(1, 'rgba(45,221,255,0)');
    b.fillStyle = rim;
    b.fillRect(0, G - 16, W, 25);
    b.fillStyle = 'rgba(136,246,255,.72)';
    b.fillRect(0, G, W, 1);

    // Reflective perspective grid
    b.save();
    b.strokeStyle = 'rgba(40,156,194,.08)';
    b.lineWidth = 1;
    const vpX = W * .5, vpY = G - 45;
    for (let gx = -W; gx < W * 2; gx += 74) {
      b.beginPath(); b.moveTo(vpX, vpY); b.lineTo(gx, H); b.stroke();
    }
    for (let i = 1; i < 14; i++) {
      const t = i / 14;
      const gy = G + Math.pow(t, 2.3) * (H - G);
      b.globalAlpha = .25 + t * .55;
      b.beginPath(); b.moveTo(0, gy); b.lineTo(W, gy); b.stroke();
    }
    b.globalAlpha = 1;
    b.restore();

    // Central stage marking
    b.save();
    b.translate(W * .5, G + 34);
    b.scale(1, .17);
    b.strokeStyle = 'rgba(65,215,241,.16)';
    b.lineWidth = 2;
    b.beginPath(); b.arc(0, 0, W * .3, 0, TAU); b.stroke();
    b.strokeStyle = 'rgba(255,62,158,.08)';
    b.beginPath(); b.arc(0, 0, W * .36, 0, TAU); b.stroke();
    b.restore();

    // Side walls
    drawSideWall(b, 0, 0, Math.max(31, W * .022), H, 'L');
    drawSideWall(b, W - Math.max(31, W * .022), 0, Math.max(31, W * .022), H, 'R');

    // Overhead arena trusses
    b.strokeStyle = 'rgba(70,157,186,.1)';
    b.lineWidth = 3;
    b.beginPath(); b.moveTo(0, H * .085); b.lineTo(W, H * .085); b.stroke();
    b.strokeStyle = 'rgba(56,205,235,.18)';
    b.beginPath(); b.moveTo(W * .08, H * .085); b.lineTo(W * .22, 0); b.stroke();
    b.beginPath(); b.moveTo(W * .92, H * .085); b.lineTo(W * .78, 0); b.stroke();

    bgCanvas = c;
  }

  function drawBanner(b, x, y, w, h, glyph, color) {
    b.save();
    b.fillStyle = 'rgba(3,12,22,.78)';
    b.fillRect(x, y, w, h);
    b.strokeStyle = 'rgba(90,206,234,.18)';
    b.strokeRect(x, y, w, h);
    b.fillStyle = color;
    b.globalAlpha = .28;
    b.fillRect(x, y + h - 3, w, 2);
    b.globalAlpha = .75;
    b.font = '700 ' + Math.round(w * .62) + 'px "WenQuanYi Zen Hei", sans-serif';
    b.textAlign = 'center';
    b.fillText(glyph, x + w / 2, y + h * .61);
    b.globalAlpha = .25;
    b.font = '500 7px "Rajdhani", sans-serif';
    b.fillText('NEON DISTRICT', x + w / 2, y + h * .84);
    b.restore();
  }

  function drawSideWall(b, x, y, w, h, side) {
    b.save();
    const grad = b.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#02060d');
    grad.addColorStop(.55, '#09121d');
    grad.addColorStop(1, '#050b13');
    b.fillStyle = grad;
    b.fillRect(x, y, w, h);
    b.strokeStyle = 'rgba(78,209,239,.15)';
    b.lineWidth = 1;
    for (let py = h * .15; py < h; py += 56) {
      b.beginPath(); b.moveTo(x, py); b.lineTo(x + w, py); b.stroke();
    }
    const edgeX = side === 'L' ? x + w - 1 : x;
    const edge = b.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, 'rgba(46,221,255,.04)');
    edge.addColorStop(.35, 'rgba(46,221,255,.42)');
    edge.addColorStop(.75, 'rgba(46,221,255,.15)');
    edge.addColorStop(1, 'rgba(46,221,255,.28)');
    b.fillStyle = edge;
    b.fillRect(edgeX, 0, 1.5, h);
    b.strokeStyle = 'rgba(111,230,255,.1)';
    b.beginPath();
    b.moveTo(side === 'L' ? x + 8 : x + w - 8, 0);
    b.lineTo(side === 'L' ? x + 8 : x + w - 8, h);
    b.stroke();
    b.fillStyle = 'rgba(4,8,15,.85)';
    b.fillRect(x, h * .18, w, 2);
    b.font = '500 6px "Rajdhani", sans-serif';
    b.fillStyle = 'rgba(105,201,224,.28)';
    b.textAlign = 'center';
    b.fillText(side === 'L' ? 'L-01' : 'R-01', x + w / 2, h * .18 - 5);
    b.restore();
  }

  function positionMenuFighters() {
    player.x = view.w * (view.w < 620 ? .64 : .63);
    player.y = view.groundY;
    player.facing = -1;
    player.action = 'idle';
    player.grounded = true;
    state.menuFighters = [];
    const spots = [
      ['red', view.w * .81, 1],
      ['green', view.w * .41, -1]
    ];
    for (const [kind, x, facing] of spots) {
      const e = makeEnemy(kind, x, 'flank');
      e.state = 'menu'; e.facing = facing; e.scale *= .9;
      state.menuFighters.push(e);
    }
  }

  function prepareMenu() {
    setScreen('menu');
    state.menuMode = true;
    resetPlayer();
    player.x = view.w * (view.w < 620 ? .64 : .63);
    player.facing = -1;
    positionMenuFighters();
    els.menu.hidden = false;
    els.gameover.hidden = true;
    els.pausePanel.hidden = true;
    els.adPanel.hidden = true;
    els.speedLines.classList.remove('on');
    updateHud(true);
  }

  /* ---------------- Audio ---------------- */
  class SoundSystem {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.muted = false;
      this.step = 0;
      this.timer = null;
      this.noiseBuffer = null;
    }
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : .34;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 15;
        comp.ratio.value = 5;
        this.master.connect(comp).connect(this.ctx.destination);
        const length = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        this.timer = setInterval(() => this.beat(), 485);
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      } catch (error) { this.ctx = null; }
    }
    now() { return this.ctx ? this.ctx.currentTime : 0; }
    setMuted(muted) {
      this.muted = muted;
      if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .34, this.now(), .03);
    }
    tone(freq, duration, type = 'sine', volume = .1, slide = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.now();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      osc.connect(gain).connect(this.master);
      osc.start(t); osc.stop(t + duration + .02);
    }
    noise(duration = .12, cutoff = 1200, volume = .1, type = 'bandpass') {
      if (!this.ctx || this.muted || !this.noiseBuffer) return;
      const t = this.now();
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(cutoff, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * .32), t + duration);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(.0001, t + duration);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t); src.stop(t + duration + .02);
    }
    hit(power = 1, armored = false) {
      if (armored) {
        this.tone(310, .09, 'square', .05, -110);
        this.noise(.07, 4200, .06, 'highpass');
        return;
      }
      this.tone(96 * power, .16, 'sine', .15, -48);
      this.noise(.1, 1500 * power, .1);
      this.tone(230, .06, 'triangle', .04, 80);
    }
    whoosh() { this.noise(.13, 2300, .035, 'bandpass'); }
    jump() { this.tone(210, .12, 'triangle', .04, 170); }
    special() {
      this.tone(54, .6, 'sawtooth', .16, -18);
      this.tone(420, .32, 'square', .055, 900);
      this.noise(.45, 5000, .12, 'highpass');
    }
    zap() {
      this.tone(820, .08, 'square', .05, -500);
      this.noise(.06, 5200, .05, 'highpass');
    }
    hurt() {
      this.tone(110, .24, 'sawtooth', .08, -55);
      this.noise(.14, 500, .08);
    }
    ko() {
      this.tone(72, .44, 'sawtooth', .13, -36);
      this.noise(.32, 650, .12);
      setTimeout(() => this.tone(44, .5, 'sine', .12, -8), 50);
    }
    grab() { this.tone(150, .08, 'square', .05, 90); this.noise(.08, 900, .04); }
    immune() { this.tone(630, .1, 'square', .055, -180); this.noise(.06, 3300, .05, 'highpass'); }
    wave() {
      this.tone(220, .2, 'triangle', .07, 220);
      setTimeout(() => this.tone(330, .22, 'triangle', .07, 220), 130);
      setTimeout(() => this.tone(440, .35, 'triangle', .06, 110), 260);
    }
    revive() {
      this.tone(130, .5, 'sine', .12, 520);
      setTimeout(() => this.tone(520, .35, 'triangle', .07, 320), 160);
    }
    beat() {
      if (!this.ctx || this.muted || state.screen !== 'playing' || state.paused) return;
      const step = this.step++ % 16;
      if (step % 4 === 0) this.tone(54, .24, 'sine', .08, -14);
      if (step === 4 || step === 12) this.noise(.11, 1300, .035);
      if (step % 2 === 1) this.noise(.035, 6500, .012, 'highpass');
      const notes = [55, 55, 65.4, 49, 55, 73.4, 65.4, 49];
      if (step % 2 === 0) this.tone(notes[(step / 2) | 0], .22, 'triangle', .018, -2);
    }
  }
  const sfx = new SoundSystem();

  /* ---------------- HUD / messages ---------------- */
  function updateHud(force = false) {
    const hp = Math.max(0, Math.ceil(player.hp));
    const hpRatio = clamp(player.hp / player.maxHp, 0, 1);
    if (force || hp !== state.lastHp) {
      els.hpFill.style.transform = `scaleX(${hpRatio})`;
      els.hpGhost.style.transform = `scaleX(${hpRatio})`;
      els.hpText.textContent = String(hp);
      els.hpFill.parentElement.classList.toggle('low', hpRatio <= .28);
      state.lastHp = hp;
    }
    const energy = Math.max(0, Math.min(100, Math.round(player.energy)));
    els.energyText.textContent = energy + '%';
    const cells = els.battery.children;
    for (let i = 0; i < cells.length; i++) {
      cells[i].classList.toggle('full', i < Math.round(energy / 10));
      cells[i].classList.toggle('flick', energy >= 100 && i % 2 === 0);
    }
    els.specialBtn.classList.toggle('ready', energy >= 100);
    els.specialCost.textContent = energy >= 100 ? 'LISTO' : '100%';
    els.waveText.textContent = pad(state.wave);
    els.killText.textContent = pad(state.kills);
    if (state.combo > 1) {
      els.comboNumber.textContent = String(state.combo);
      els.combo.classList.add('show');
    } else {
      els.combo.classList.remove('show');
    }
  }

  function resetCombo() {
    state.combo = 0;
    state.comboTimer = 0;
    if (els.combo) els.combo.classList.remove('show');
  }

  function addCombo() {
    state.combo++;
    state.comboTimer = 2.7;
    if (state.combo === 5 || state.combo === 10 || state.combo === 20) {
      addFloater(`COMBO ×${state.combo}`, player.x, player.y - 155, '#7cf5ff', 24);
    }
  }

  function showBanner(kicker, title, sub, duration = 1.9) {
    els.bannerKicker.textContent = kicker;
    els.bannerTitle.textContent = title;
    els.bannerSub.textContent = sub;
    els.banner.classList.add('show');
    state.bannerTimer = duration;
  }

  function showToast(message, type = '', duration = 1.8) {
    els.toast.textContent = message;
    els.toast.className = 'toast show ' + type;
    state.toastTimer = duration;
  }

  function flashScreen(red = false) {
    els.screenFlash.classList.toggle('red', red);
    els.screenFlash.classList.add('on');
    clearTimeout(flashScreen.timer);
    flashScreen.timer = setTimeout(() => els.screenFlash.classList.remove('on'), 90);
  }

  function setHint(html, duration = 2.5) {
    els.contextHint.innerHTML = html;
    els.contextHint.classList.add('show');
    state.hintTimer = duration;
  }

  /* ---------------- Input ---------------- */
  function queueAction(name) {
    if (state.screen !== 'playing' || state.paused || player.dead) return;
    buffered[name] = .2;
    if (name === 'jump' && state.screen === 'playing') sfx.init();
  }

  function bindInput() {
    $$('[data-hold]').forEach(button => {
      const name = button.dataset.hold;
      const down = event => {
        event.preventDefault();
        button.classList.add('held');
        held[name] = true;
        try { button.setPointerCapture(event.pointerId); } catch (error) {}
        if (name === 'up') buffered.jump = .16;
        sfx.init();
        if (name === 'down') held.down = true;
      };
      const up = event => {
        event.preventDefault();
        button.classList.remove('held');
        held[name] = false;
      };
      button.addEventListener('pointerdown', down);
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
      button.addEventListener('lostpointercapture', up);
      button.addEventListener('contextmenu', event => event.preventDefault());
    });

    $$('[data-press]').forEach(button => {
      const name = button.dataset.press;
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        button.classList.add('held');
        try { button.setPointerCapture(event.pointerId); } catch (error) {}
        queueAction(name);
      });
      const release = () => button.classList.remove('held');
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', event => event.preventDefault());
    });

    window.addEventListener('keydown', event => {
      const code = event.code;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) event.preventDefault();
      if (event.repeat) return;
      keysDown.add(code);
      if (code === 'KeyA' || code === 'ArrowLeft') held.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') held.right = true;
      if (code === 'KeyS' || code === 'ArrowDown') held.down = true;
      if (code === 'KeyW' || code === 'ArrowUp') { held.up = true; queueAction('jump'); }
      if (code === 'KeyJ') queueAction('quick');
      if (code === 'KeyK') queueAction('heavy');
      if (code === 'KeyL') queueAction('grab');
      if (code === 'Space') queueAction('special');
      if (code === 'KeyP' || code === 'Escape') {
        if (state.screen === 'playing') togglePause(true);
        else if (state.screen === 'paused') togglePause(false);
      }
      if (code === 'Enter' || code === 'NumpadEnter') {
        if (state.screen === 'menu' && !els.menu.hidden) startGame();
      }
      sfx.init();
    });

    window.addEventListener('keyup', event => {
      const code = event.code;
      keysDown.delete(code);
      if (code === 'KeyA' || code === 'ArrowLeft') held.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') held.right = false;
      if (code === 'KeyS' || code === 'ArrowDown') held.down = false;
      if (code === 'KeyW' || code === 'ArrowUp') held.up = false;
    });

    window.addEventListener('blur', () => {
      held.left = held.right = held.down = held.up = false;
      keysDown.clear();
      if (state.screen === 'playing' && !player.dead) togglePause(true);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.screen === 'playing' && !player.dead) togglePause(true);
    });
  }

  function bindUi() {
    $('#startBtn').addEventListener('click', () => { sfx.init(); startGame(); });
    $('#howBtn').addEventListener('click', () => {
      els.howPanel.hidden = false;
      setScreen('how');
    });
    $('#closeHow').addEventListener('click', () => {
      els.howPanel.hidden = true;
      setScreen('menu');
    });
    $('#muteBtn').addEventListener('click', () => {
      state.settings.sound = !state.settings.sound;
      sfx.setMuted(!state.settings.sound);
      els.muteBtn.classList.toggle('muted', !state.settings.sound);
      showToast(state.settings.sound ? 'AUDIO ACTIVADO' : 'AUDIO SILENCIADO', '', 1.1);
    });
    $('#pauseBtn').addEventListener('click', () => togglePause(true));
    $('#resumeBtn').addEventListener('click', () => togglePause(false));
    $('#restartPauseBtn').addEventListener('click', () => {
      els.pausePanel.hidden = true;
      setScreen('playing');
      state.paused = false;
      resetWorld();
      startWave(1);
    });
    $('#menuPauseBtn').addEventListener('click', () => {
      els.pausePanel.hidden = true;
      state.paused = false;
      prepareMenu();
    });
    $('#restartBtn').addEventListener('click', () => {
      els.gameover.hidden = true;
      state.dying = false;
      setScreen('playing');
      state.paused = false;
      resetWorld();
      startWave(1);
    });
    $('#menuBtn').addEventListener('click', () => {
      els.gameover.hidden = true;
      prepareMenu();
    });
    $('#watchAdBtn').addEventListener('click', beginAd);
    $('#declineAdBtn').addEventListener('click', declineRevive);
    $('#skipAdBtn').addEventListener('click', () => {
      if (state.adTime >= 2) finishAd();
    });
  }

  /* ---------------- Flow ---------------- */
  function startGame() {
    sfx.init();
    els.menu.hidden = true;
    els.howPanel.hidden = true;
    els.gameover.hidden = true;
    els.adPanel.hidden = true;
    els.pausePanel.hidden = true;
    state.menuMode = false;
    state.paused = false;
    state.dying = false;
    resetWorld();
    setScreen('playing');
    startWave(1);
    player.introGrace = 1.75;
    setTimeout(() => setHint('<kbd>J</kbd> RÁPIDO · <kbd>K</kbd> FUERTE · <kbd>L</kbd> AGARRE · <kbd>ESPACIO</kbd> ESPECIAL', 5.5), 300);
  }

  function startWave(number) {
    state.wave = number;
    state.waveClearTimer = 0;
    state.waveActive = true;
    const reds = Math.min(16, 3 + number * 2);
    const heavies = number < 2 ? 0 : Math.min(4, Math.floor((number + 1) / 2));
    state.spawnQueue = [];
    for (let i = 0; i < reds; i++) state.spawnQueue.push({ kind: 'red', side: i % 2 ? -1 : 1 });
    for (let i = 0; i < heavies; i++) state.spawnQueue.push({ kind: i % 2 ? 'green' : 'gold', side: i % 2 ? 1 : -1 });
    for (let i = state.spawnQueue.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
    }
    state.spawnTimer = number === 1 ? 1.35 : .7;
    state.waveActive = true;

    if (number === 1) {
      const spread = view.w < 620 ? 138 : 178;
      const first = spawnEnemy('red', player.x - spread, 'flank');
      const second = spawnEnemy('red', player.x + spread * .9, 'flank');
      first.timer = .22; second.timer = .28;
      first.cooldown = 2.1; second.cooldown = 1.65;
      state.spawnQueue.splice(state.spawnQueue.findIndex(e => e.kind === 'red'), 1);
      state.spawnQueue.splice(state.spawnQueue.findIndex(e => e.kind === 'red'), 1);
      showBanner('OLEADA 01', 'ENTRAN LOS ESPECTROS', 'SOBREVIVE. CARGA. RESPONDE.', 2.3);
      sfx.wave();
    } else {
      const names = ['', '', 'ACERO Y FURIA', 'SIN RETIRADA', 'EL MURO RESPONDE', 'PROTOCOLO ROJO', 'ÚLTIMA SEÑAL'];
      showBanner('OLEADA ' + pad(number), names[Math.min(number, names.length - 1)] || 'SIN LÍMITE', heavies ? 'BLINDADOS DETECTADOS' : 'NO BAJES LA GUARDIA', 2.2);
      sfx.wave();
      player.hp = Math.min(player.maxHp, player.hp + 7);
      player.energy = Math.min(100, player.energy + 8);
      addFloater('+7 VITALIDAD', player.x, player.y - 145, '#72ffc0', 15);
    }
    updateHud(true);
  }

  function togglePause(pause) {
    if (pause && state.screen === 'playing' && !player.dead) {
      state.paused = true;
      setScreen('paused');
      els.pausePanel.hidden = false;
      held.left = held.right = held.down = held.up = false;
    } else if (!pause && state.screen === 'paused') {
      state.paused = false;
      setScreen('playing');
      els.pausePanel.hidden = true;
    }
  }

  function beginGameOver() {
    if (state.screen === 'gameover') return;
    state.deaths++;
    state.dying = false;
    state.paused = true;
    setScreen('gameover');
    const second = state.deaths >= 2;
    els.gameover.hidden = false;
    els.goWave.textContent = pad(state.wave);
    els.goKills.textContent = pad(state.kills);
    els.goDeath.textContent = pad(state.deaths);
    els.deathPips.textContent = second ? '◆ ◆' : '◆ ◇';
    els.goKicker.innerHTML = second ? '<i></i> ALERTA DE RECUPERACIÓN' : '<i></i> SEÑAL PERDIDA';
    els.goTitle.innerHTML = second ? 'SEGUNDA<br><em>CAÍDA</em>' : 'FUERA<br><em>DE COMBATE</em>';
    els.goCopy.textContent = second
      ? 'Dos caídas consecutivas. La arena ofrece una segunda señal, pero la decisión sigue siendo tuya.'
      : 'La arena reclamó esta ronda. Respira, ajusta la guardia y vuelve a entrar.';
    els.reviveOffer.hidden = !second;
    els.goActions.hidden = second;
    els.goActions.style.display = second ? 'none' : 'flex';
    els.gameover.querySelector('.go-foot span').textContent = second
      ? 'OPCIÓN ÉTICA: ANUNCIO CORTO OPCIONAL PARA REVIVIR'
      : 'PROTOCOLO ÉTICO: SIN ANUNCIOS EN LA PRIMERA CAÍDA';
    els.speedLines.classList.remove('on');
    sfx.ko();
  }

  function declineRevive() {
    state.deaths = 0;
    els.reviveOffer.hidden = true;
    els.goActions.hidden = false;
    els.goActions.style.display = 'flex';
    els.deathPips.textContent = '◇ ◇';
    els.gameover.querySelector('.go-foot span').textContent = 'DECISIÓN REGISTRADA · CONTADOR REINICIADO';
    showToast('RECHAZADO · REINICIA O VUELVE AL MENÚ', '', 2.2);
  }

  function beginAd() {
    if (state.deaths < 2) return;
    els.gameover.hidden = true;
    els.adPanel.hidden = false;
    setScreen('ad');
    state.adTime = 0;
    state.adStartedAt = performance.now();
    state.adDone = false;
    state.paused = true;
    els.adFill.style.width = '0%';
    els.adTimer.textContent = '4.0s';
    els.skipAdBtn.disabled = true;
    els.skipAdBtn.textContent = 'SALTAR · 2s';
    sfx.tone(180, .4, 'triangle', .04, 200);
  }

  function updateAd() {
    if (els.adPanel.hidden) return;
    state.adTime = (performance.now() - state.adStartedAt) / 1000;
    const progress = clamp(state.adTime / state.adDuration, 0, 1);
    els.adFill.style.width = (progress * 100).toFixed(1) + '%';
    els.adTimer.textContent = Math.max(0, state.adDuration - state.adTime).toFixed(1) + 's';
    if (state.adTime >= 2 && els.skipAdBtn.disabled) {
      els.skipAdBtn.disabled = false;
      els.skipAdBtn.textContent = 'SALTAR ANUNCIO · →';
    }
    if (state.adTime >= state.adDuration && !state.adDone) finishAd();
  }

  function finishAd() {
    if (state.adDone) return;
    state.adDone = true;
    reviveGame();
  }

  function reviveGame() {
    state.deaths = 0;
    els.adPanel.hidden = true;
    els.gameover.hidden = true;
    state.dying = false;
    state.paused = false;
    state.deadTimer = 0;
    setScreen('playing');
    player.dead = false;
    player.ragdoll = false;
    player.hp = 50;
    player.energy = 28;
    player.x = view.w * .5;
    player.y = view.groundY;
    player.vx = 0; player.vy = 0;
    player.grounded = true;
    player.action = 'idle';
    player.actionTime = 0;
    player.invuln = 2.8;
    player.introGrace = 0;
    player.deadShown = false;
    player.angle = 0;
    player.grabTarget = null;
    player.suplexTarget = null;
    state.enemies.forEach(e => {
      if (!e.dead && e.state !== 'spawn' && e.state !== 'grabbed') {
        e.state = 'tumble';
        e.timer = .75;
        e.vx = (e.x < player.x ? -1 : 1) * rand(380, 680);
        e.vy = rand(-560, -230);
        e.grounded = false;
        e.angleVel = rand(-9, 9);
      }
    });
    state.hitStop = .05;
    state.shake = 16;
    state.bulletTime = 0;
    els.speedLines.classList.remove('on');
    showBanner('SEÑAL RESTAURADA', '50% DE VITALIDAD', 'LA ARENA TE DA OTRA RONDA', 2.4);
    addFloater('REVIVIDO +50 HP', player.x, player.y - 150, '#8dffcf', 22);
    flashScreen(false);
    shockwave(player.x, view.groundY - 10, '#36e9ff', 170);
    sfx.revive();
    updateHud(true);
  }

  /* ---------------- Effects ---------------- */
  function addPortal(x, y, color, scale = 1) {
    state.portals.push({ x, y, color, scale, life: .55, maxLife: .55, seed: Math.random() * 100 });
  }

  function addFloater(text, x, y, color = '#dffcff', size = 18, life = .85) {
    state.floaters.push({ text, x, y, color, size, life, maxLife: life, vy: -42 });
    if (state.floaters.length > 32) state.floaters.shift();
  }

  function spawnHit(x, y, color, power = 1, facing = 1, amount = 18) {
    for (let i = 0; i < amount; i++) {
      const angle = rand(-Math.PI, Math.PI);
      const speed = rand(80, 520) * power;
      state.particles.push({
        type: 'spark', x, y, vx: Math.cos(angle) * speed + facing * rand(20, 130),
        vy: Math.sin(angle) * speed - rand(20, 160), life: rand(.16, .42),
        maxLife: .42, size: rand(1.2, 3.4), color, gravity: 900, drag: .96
      });
    }
    state.particles.push({
      type: 'ring', x, y, vx: 0, vy: 0, life: .28, maxLife: .28,
      radius: 7, endRadius: 52 * power, color, line: 2.2
    });
    if (power > 1.1) {
      state.particles.push({
        type: 'slash', x, y, vx: 0, vy: 0, life: .22, maxLife: .22,
        angle: rand(-.5, .5) + (facing > 0 ? -.2 : Math.PI + .2), size: 74 * power, color
      });
    }
  }

  function shockwave(x, y, color, radius = 110) {
    state.particles.push({
      type: 'ring', x, y, vx: 0, vy: 0, life: .46, maxLife: .46,
      radius: 8, endRadius: radius, color, line: 3.4
    });
    for (let i = 0; i < 16; i++) {
      const angle = rand(Math.PI, TAU);
      state.particles.push({
        type: 'dust', x: x + rand(-25, 25), y: y + rand(-2, 3),
        vx: Math.cos(angle) * rand(40, 160), vy: Math.sin(angle) * rand(30, 110),
        life: rand(.3, .7), maxLife: .7, size: rand(2, 7), color, gravity: 120, drag: .94
      });
    }
  }

  function addDust(x, y, color = '#7fd9e9', amount = 8, power = 1) {
    for (let i = 0; i < amount; i++) {
      state.particles.push({
        type: 'dust', x: x + rand(-15, 15), y: y + rand(-2, 2),
        vx: rand(-130, 130) * power, vy: rand(-120, -20),
        life: rand(.2, .55), maxLife: .55, size: rand(1.5, 5), color,
        gravity: 300, drag: .93
      });
    }
  }

  function addElectricArc(x1, y1, x2, y2, color = '#7af7ff', width = 2, life = .18) {
    state.particles.push({
      type: 'arc', x: x1, y: y1, vx: 0, vy: 0, tx: x2, ty: y2,
      life, maxLife: life, color, line: width, seed: rand(0, 100)
    });
  }

  function addDecal(x, y, kind, color = '#5fe8ff', angle = 0) {
    state.decals.push({ x, y, kind, color, angle, life: 12, maxLife: 12, seed: rand(0, 100) });
    if (state.decals.length > 24) state.decals.shift();
  }

  function updateFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) { state.particles.splice(i, 1); continue; }
      if (p.type === 'spark' || p.type === 'dust') {
        p.vy += (p.gravity || 0) * dt;
        p.vx *= Math.pow(p.drag || .97, dt * 60);
        p.vy *= Math.pow(p.drag || .97, dt * 60);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'dust' && p.y > view.groundY) { p.y = view.groundY; p.vy *= -.2; }
      } else if (p.type === 'ring') {
        p.radius += (p.endRadius - p.radius) * Math.min(1, dt * 12);
      } else if (p.type === 'slash') {
        p.x += p.vx * dt;
      }
    }
    for (let i = state.floaters.length - 1; i >= 0; i--) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= .96;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    for (let i = state.portals.length - 1; i >= 0; i--) {
      const p = state.portals[i];
      p.life -= dt;
      if (p.life <= 0) state.portals.splice(i, 1);
    }
    for (let i = state.decals.length - 1; i >= 0; i--) {
      state.decals[i].life -= dt;
      if (state.decals[i].life <= 0) state.decals.splice(i, 1);
    }
    if (state.particles.length > 560) state.particles.splice(0, state.particles.length - 560);
  }

  function updateAmbient(dt) {
    for (const p of state.ambient) {
      p.phase += dt * .6;
      p.x += (p.vx + Math.sin(p.phase) * 4) * dt;
      p.y += p.vy * dt;
      if (p.y < view.h * .1) { p.y = view.groundY; p.x = rand(0, view.w); }
      if (p.x < -10) p.x = view.w + 10;
      if (p.x > view.w + 10) p.x = -10;
    }
  }

  /* ---------------- Wave flow ---------------- */
  function updateWave(dt) {
    if (!state.waveActive || player.dead) return;
    const alive = state.enemies.filter(e => !e.dead).length;
    if (state.spawnQueue.length && alive < 6) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const next = state.spawnQueue.shift();
        const x = next.side < 0 ? view.left + 14 : view.right - 14;
        spawnEnemy(next.kind, x, next.side < 0 ? 'left' : 'right');
        state.spawnTimer = state.wave < 4 ? .72 : .52;
      }
    }
    if (!state.spawnQueue.length && alive === 0) {
      state.waveClearTimer += dt;
      if (state.waveClearTimer > 1.5) {
        state.waveActive = false;
        addFloater('OLEADA LIMPIA', view.w / 2, view.groundY - 210, '#83ffe0', 26, 1.2);
        startWave(state.wave + 1);
      }
    } else {
      state.waveClearTimer = 0;
    }
  }

  /* ---------------- Player combat ---------------- */
  const ACTIONS = ['quick', 'heavy', 'grab', 'special', 'jump'];

  function isFree() {
    return ['idle', 'run', 'crouch', 'jump'].includes(player.action);
  }

  function consume(name) {
    if (buffered[name] > 0) { buffered[name] = 0; return true; }
    return false;
  }

  function startQuick(step = 0) {
    player.comboStep = step;
    player.comboQueued = false;
    player.action = 'quick';
    player.actionTime = 0;
    player.actionDur = step === 2 ? .38 : .28 + step * .02;
    player.attackHit = new Set();
    player.vx = player.facing * (step === 2 ? 135 : 92);
    sfx.whoosh();
  }

  function startHeavy() {
    player.action = 'heavy';
    player.actionTime = 0;
    player.actionDur = .56;
    player.attackHit = new Set();
    player.vx = player.facing * 115;
    sfx.whoosh();
  }

  function startDragon() {
    player.action = 'dragon';
    player.actionTime = 0;
    player.actionDur = .66;
    player.attackHit = new Set();
    player.vx = player.facing * 100;
    player.vy = -250;
    player.grounded = false;
    sfx.whoosh();
    addFloater('GOLPE DEL DRAGÓN', player.x + player.facing * 30, player.y - 165, '#9dfbff', 18, .95);
  }

  function startSpin() {
    player.action = 'spin';
    player.actionTime = 0;
    player.actionDur = .68;
    player.attackHit = new Set();
    player.vx = 0;
    sfx.whoosh();
    addFloater('PATADA GIRATORIA DE VIENTO · 360°', player.x, player.y - 150, '#c9faff', 17, .9);
  }

  function startSpecial() {
    if (player.energy < 100) {
      showToast('BATERÍA INCOMPLETA · GOLPEA PARA CARGAR', 'warn', 1.7);
      sfx.immune();
      return false;
    }
    player.energy = 0;
    player.action = 'special';
    player.actionTime = 0;
    player.actionDur = 1.2;
    player.specialHits = new Set();
    player.specialSlam = false;
    player.invuln = 1.55;
    player.vx = 0;
    state.bulletTime = 1.55;
    state.bulletMax = 1.55;
    state.slow = .4;
    state.hitStop = .06;
    state.shake = 14;
    els.speedLines.classList.add('on');
    showBanner('BATERÍA 100%', 'BULLET TIME', 'PATADA ELÉCTRICA // 40% DE VELOCIDAD', 1.45);
    addFloater('¡DESCARGA!', player.x, player.y - 155, '#99faff', 26, 1);
    flashScreen(false);
    sfx.special();
    updateHud(true);
    return true;
  }

  function tryGrab() {
    let best = null, bestDist = 1e9;
    const airborne = !player.grounded;
    for (const e of state.enemies) {
      if (e.dead || e.state === 'spawn' || e.state === 'grabbed' || e.state === 'thrown' || e.state === 'suplexed') continue;
      const dx = e.x - player.x;
      const dy = (e.y - 55 * e.scale) - (player.y - 58 * player.scale);
      if (airborne) {
        if (Math.abs(dx) < 126 * view.actorScale && Math.abs(dy) < 120 && Math.abs(dx) < bestDist) {
          best = e; bestDist = Math.abs(dx);
        }
      } else if (Math.abs(dx) < 108 * view.actorScale && Math.abs(dy) < 92 && Math.abs(dx) < bestDist) {
        best = e; bestDist = Math.abs(dx);
      }
    }
    if (!best) {
      showToast(airborne ? 'SUPLEX: ACÉRCATE A UN ENEMIGO EN EL AIRE' : 'SIN OBJETIVO AL ALCANCE', 'warn', 1.05);
      sfx.whoosh();
      return false;
    }
    if (airborne) startSuplex(best);
    else startGrab(best);
    return true;
  }

  function startGrab(enemy) {
    player.action = 'grab';
    player.actionTime = 0;
    player.actionDur = 1.35;
    player.grabTarget = enemy;
    player.grabTimer = 1.28;
    player.facing = enemy.x >= player.x ? 1 : -1;
    enemy.state = 'grabbed';
    enemy.grabbedBy = player;
    enemy.vx = 0; enemy.vy = 0; enemy.timer = 0;
    enemy.facing = -player.facing;
    sfx.grab();
    setHint('<kbd>J</kbd> <kbd>K</kbd> o <kbd>L</kbd> PARA LANZARLO CONTRA LA MULTITUD', 2.4);
  }

  function startSuplex(enemy) {
    player.action = 'suplex';
    player.actionTime = 0;
    player.actionDur = .78;
    player.grabTarget = enemy;
    player.suplexTarget = enemy;
    player.suplexImpact = false;
    player.facing = enemy.x >= player.x ? 1 : -1;
    player.vx = 0; player.vy = 0;
    enemy.state = 'suplexed';
    enemy.grabbedBy = player;
    enemy.facing = -player.facing;
    sfx.grab();
    setHint('SUPLEX AÉREO · IMPACTO EN ÁREA', 1.6);
  }

  function releaseGrab() {
    if (player.grabTarget && player.grabTarget.state === 'grabbed') {
      player.grabTarget.state = 'tumble';
      player.grabTarget.timer = .5;
      player.grabTarget.vy = -260;
      player.grabTarget.grounded = false;
      player.grabTarget = null;
    }
    player.grabTarget = null;
    player.suplexTarget = null;
  }

  function throwGrab() {
    const e = player.grabTarget;
    if (!e) return;
    player.action = 'throw';
    player.actionTime = 0;
    player.actionDur = .3;
    player.grabTarget = null;
    player.grabTimer = 0;
    e.state = 'thrown';
    e.thrownBy = player;
    e.grabbedBy = null;
    e.grounded = false;
    e.vx = player.facing * rand(1080, 1270);
    e.vy = -rand(330, 470);
    e.angleVel = player.facing * rand(11, 15);
    e.hitSet = new Set();
    e.damage = 15;
    e.hp -= 13;
    e.hitFlash = .14;
    e.stunTimer = 1.2;
    state.shake = 9;
    state.hitStop = .03;
    addFloater('¡LANZAMIENTO!', player.x + player.facing * 50, player.y - 150, '#ffdf70', 20, .9);
    spawnHit(e.x, e.y - 60, e.palette.core, 1.1, player.facing, 10);
    sfx.whoosh();
    if (e.hp <= 0) killEnemy(e, player.facing * 1100, -430, true);
  }

  function executeQuick(step) {
    const reach = (step === 2 ? 80 : 67) * view.actorScale;
    for (const e of state.enemies) {
      if (e.dead || player.attackHit.has(e) || e.state === 'spawn' || e.state === 'grabbed') continue;
      const dx = (e.x - player.x) * player.facing;
      const dy = Math.abs((e.y - 58 * e.scale) - (player.y - 63 * player.scale));
      if (dx > -18 && dx < reach && dy < 92 && Math.random() > 0) {
        player.attackHit.add(e);
        const damage = 8 + step * 2 + Math.floor(state.wave * .5);
        const hit = damageEnemy(e, damage, {
          normal: true, energy: 12, knockX: player.facing * (step === 2 ? 470 : 210),
          knockY: step === 2 ? -275 : -40, launch: step === 2, hitStop: .035,
          source: 'quick', power: step === 2 ? 1.3 : .8
        });
        if (hit) {
          player.vx = player.facing * (step === 2 ? 120 : 40);
          if (step === 2) state.shake = Math.max(state.shake, 7);
          if (step < 2 && buffered.quick > 0) { player.comboQueued = true; buffered.quick = 0; }
        }
      }
    }
  }

  function executeHeavy() {
    const reach = 88 * view.actorScale;
    for (const e of state.enemies) {
      if (e.dead || player.attackHit.has(e) || e.state === 'spawn' || e.state === 'grabbed') continue;
      const dx = (e.x - player.x) * player.facing;
      const dy = Math.abs((e.y - 58 * e.scale) - (player.y - 56 * player.scale));
      if (dx > -22 && dx < reach && dy < 105) {
        player.attackHit.add(e);
        const hit = damageEnemy(e, 19 + state.wave, {
          normal: true, energy: 18, knockX: player.facing * 830, knockY: -430,
          launch: true, hitStop: .075, source: 'heavy', power: 1.55
        });
        if (hit) { state.shake = 10; player.vx = player.facing * 80; }
      }
    }
    if (!player.attackHit.size) sfx.whoosh();
  }

  function executeDragon() {
    const reach = 78 * view.actorScale;
    for (const e of state.enemies) {
      if (e.dead || player.attackHit.has(e) || e.state === 'spawn' || e.state === 'grabbed') continue;
      const dx = (e.x - player.x) * player.facing;
      const dy = (e.y - 58 * e.scale) - (player.y - 75 * player.scale);
      if (dx > -35 && dx < reach && dy > -120 && dy < 95) {
        player.attackHit.add(e);
        const hit = damageEnemy(e, 27 + state.wave, {
          normal: true, energy: 22, knockX: player.facing * 170, knockY: -1620,
          launch: true, hitStop: .085, source: 'dragon', power: 1.9, special: true
        });
        if (hit) {
          state.shake = 13;
          spawnHit(e.x, e.y - 60, '#8ff7ff', 1.8, player.facing, 25);
          shockwave(player.x, view.groundY - 2, '#52e9ff', 110);
          flashScreen(false);
          addFloater('¡DRAGÓN!', player.x + player.facing * 25, player.y - 180, '#a8fbff', 24, .9);
          sfx.special();
        }
      }
    }
  }

  function executeSpin() {
    const radius = 138 * view.actorScale;
    let hits = 0;
    for (const e of state.enemies) {
      if (e.dead || player.attackHit.has(e) || e.state === 'spawn' || e.state === 'grabbed') continue;
      const dx = e.x - player.x;
      const dy = Math.abs((e.y - 55 * e.scale) - (player.y - 55 * player.scale));
      if (Math.abs(dx) < radius && dy < 95) {
        player.attackHit.add(e);
        const dir = dx === 0 ? player.facing : Math.sign(dx);
        const hit = damageEnemy(e, 18 + state.wave, {
          normal: true, energy: 12, knockX: dir * 760, knockY: -360,
          launch: true, hitStop: .05, source: 'spin', power: 1.35
        });
        if (hit) hits++;
      }
    }
    if (hits) {
      state.shake = Math.max(state.shake, 8);
      shockwave(player.x, view.groundY - 45, '#b7f6ff', 150);
    }
  }

  function executeSpecial() {
    const radius = 190 * view.actorScale;
    let hitAny = false;
    for (const e of state.enemies) {
      if (e.dead || player.specialHits.has(e) || e.state === 'spawn' || e.state === 'grabbed') continue;
      const dx = e.x - player.x;
      const dy = Math.abs((e.y - 55 * e.scale) - (player.y - 55 * player.scale));
      if (Math.abs(dx) < radius && dy < 150) {
        player.specialHits.add(e);
        const dir = Math.sign(dx) || player.facing;
        damageEnemy(e, 74 + state.wave * 3, {
          normal: false, energy: 0, knockX: dir * rand(1250, 1640), knockY: -rand(760, 1030),
          launch: true, hitStop: .1, source: 'special', power: 2.4, armorPierce: true
        });
        addElectricArc(player.x, player.y - 65, e.x, e.y - 58, '#b5fcff', 3, .26);
        hitAny = true;
      }
    }
    if (hitAny) {
      state.shake = Math.max(state.shake, 16);
      flashScreen(false);
      sfx.zap();
    }
  }

  function updatePlayer(dt) {
    const p = player;
    p.animTime += dt;
    p.actionTime += dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.introGrace = Math.max(0, p.introGrace - dt);
    p.wallCooldown = Math.max(0, p.wallCooldown - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.sparkTimer += dt;

    for (const key of ACTIONS) if (buffered[key] > 0) buffered[key] = Math.max(0, buffered[key] - dt);

    if (p.dead) {
      updatePlayerDeath(dt);
      return;
    }

    if (p.action === 'special') {
      updateSpecial(dt);
      return;
    }
    if (p.action === 'suplex') {
      updateSuplex(dt);
      return;
    }
    if (p.action === 'grab') {
      updateGrab(dt);
      return;
    }
    if (p.action === 'wallcling') {
      updateWallCling(dt);
      return;
    }
    if (p.action === 'wallkick') {
      updateWallKick(dt);
      return;
    }
    if (p.action === 'quick') {
      const t = p.actionTime;
      if (t > .065 && t < .18 && p.attackHit.size === 0) executeQuick(p.comboStep);
      if (t > .09 && buffered.quick > 0 && p.comboStep < 2) {
        p.comboQueued = true;
        buffered.quick = 0;
      }
      if (t > .16 && buffered.heavy > 0) {
        buffered.heavy = 0;
        if (p.comboStep < 2) p.comboQueued = false;
      }
      applyPlayerPhysics(dt, .88, false);
      if (t >= p.actionDur) {
        if (p.comboQueued && p.comboStep < 2) startQuick(p.comboStep + 1);
        else { p.action = 'idle'; p.actionTime = 0; p.comboStep = 0; }
      }
      return;
    }
    if (p.action === 'heavy') {
      const t = p.actionTime;
      if (t > .19 && t < .34 && p.attackHit.size === 0) executeHeavy();
      applyPlayerPhysics(dt, .84, false);
      if (t >= p.actionDur) { p.action = 'idle'; p.actionTime = 0; }
      return;
    }
    if (p.action === 'dragon') {
      const t = p.actionTime;
      if (t > .1 && t < .3 && p.attackHit.size === 0) executeDragon();
      if (t > .32) p.vy = Math.min(p.vy, 220);
      applyPlayerPhysics(dt, .9, false);
      if (t >= p.actionDur && p.grounded) { p.action = 'idle'; p.actionTime = 0; }
      else if (t >= p.actionDur + .4) { p.action = 'idle'; p.grounded = true; p.y = view.groundY; }
      return;
    }
    if (p.action === 'spin') {
      const t = p.actionTime;
      if (t > .11 && t < .5) executeSpin();
      applyPlayerPhysics(dt, .72, false);
      if (t >= p.actionDur) { p.action = 'idle'; p.actionTime = 0; }
      return;
    }
    if (p.action === 'throw') {
      applyPlayerPhysics(dt, .8, false);
      if (p.actionTime >= p.actionDur) { p.action = 'idle'; p.actionTime = 0; }
      return;
    }
    if (p.action === 'hurt') {
      applyPlayerPhysics(dt, 1, true);
      if (p.actionTime >= p.actionDur && p.grounded) { p.action = 'idle'; p.actionTime = 0; }
      return;
    }

    // Free movement and command buffering
    let move = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (p.grounded) {
      if (held.down) {
        p.action = 'crouch';
        p.vx *= Math.pow(.0008, dt);
      } else if (move) {
        p.facing = move;
        p.action = 'run';
        p.vx += (move * 328 - p.vx) * Math.min(1, dt * 15);
      } else {
        p.action = 'idle';
        p.vx *= Math.pow(.001, dt);
      }
    } else {
      p.action = 'jump';
      if (move) {
        p.facing = move;
        p.vx += (move * 285 - p.vx) * Math.min(1, dt * 4.5);
      }
    }

    if (buffered.special > 0) {
      buffered.special = 0;
      if (startSpecial()) return;
    }
    if (buffered.grab > 0) { buffered.grab = 0; if (tryGrab()) return; }
    if (buffered.jump > 0) {
      buffered.jump = 0;
      if (p.grounded) jumpPlayer();
    }
    if (buffered.heavy > 0) {
      buffered.heavy = 0;
      if (p.grounded && held.down) startDragon();
      else if (countFlankers() >= 2) startSpin();
      else startHeavy();
      return;
    }
    if (buffered.quick > 0) {
      buffered.quick = 0;
      startQuick(0);
      return;
    }

    if (!p.grounded && p.wallCooldown <= 0 && p.y > view.wallTop + 60) {
      const near = p.x < view.left + 38 ? -1 : p.x > view.right - 38 ? 1 : 0;
      if (near && ((near < 0 && held.left) || (near > 0 && held.right))) startWallCling(near);
    }

    applyPlayerPhysics(dt, 1, true);
  }

  function countFlankers() {
    let left = 0, right = 0;
    for (const e of state.enemies) {
      if (e.dead || e.state === 'spawn' || e.state === 'grabbed') continue;
      if (Math.abs(e.x - player.x) > 150 * view.actorScale) continue;
      if (e.x < player.x) left++; else right++;
    }
    return Math.min(left, right) >= 1 ? 2 : 0;
  }

  function jumpPlayer() {
    player.vy = -830;
    player.grounded = false;
    player.action = 'jump';
    player.actionTime = 0;
    addDust(player.x, view.groundY, '#62ddeb', 6, .7);
    sfx.jump();
  }

  function applyPlayerPhysics(dt, friction = 1, allowLanding = true) {
    const p = player;
    if (!p.grounded) {
      p.vy += 2380 * dt;
      p.y += p.vy * dt;
    }
    p.x += p.vx * dt;
    if (friction !== 1 && p.grounded) p.vx *= Math.pow(friction, dt * 9);
    if (allowLanding && p.y >= view.groundY) {
      if (p.vy > 240) addDust(p.x, view.groundY, '#67ddec', 8, 1);
      p.y = view.groundY;
      p.vy = 0;
      p.grounded = true;
      if (p.action === 'jump') { p.action = 'idle'; p.actionTime = 0; }
    }
    const minX = view.left + 18;
    const maxX = view.right - 18;
    if (p.x < minX) {
      p.x = minX;
      if (p.vx < -40) tryWallContact(-1);
      p.vx = Math.max(0, p.vx);
    } else if (p.x > maxX) {
      p.x = maxX;
      if (p.vx > 40) tryWallContact(1);
      p.vx = Math.min(0, p.vx);
    }
  }

  function tryWallContact(side) {
    const p = player;
    if (p.wallCooldown > 0 || p.action === 'wallcling' || p.action === 'wallkick') return;
    if (p.action === 'special' || p.action === 'hurt' || p.action === 'suplex') return;
    if (!isFree() && p.action !== 'wallcling') return;
    startWallCling(side);
  }

  function startWallCling(side) {
    const p = player;
    p.action = 'wallcling';
    p.actionTime = 0;
    p.actionDur = .7;
    p.wallSide = side;
    p.facing = side;
    p.vx = 0;
    p.vy = 0;
    p.grounded = p.y >= view.groundY - 1;
    p.wallCooldown = 1.1;
    addDust(p.x - side * 14, p.y - 55, '#6deeff', 8, .7);
    shockwave(p.x - side * 8, p.y - 55, '#39dcff', 28);
    sfx.grab();
    setHint('<kbd>SALTO</kbd> DESDE EL MURO · PATADA COMETA HACIA EL CENTRO', 2.2);
    addFloater('MURO', p.x - side * 28, p.y - 120, '#7fefff', 15, .65);
  }

  function updateWallCling(dt) {
    const p = player;
    if (buffered.jump > 0) { buffered.jump = 0; wallJump(); return; }
    if (!p.grounded) {
      p.vy = Math.min(190, p.vy + 460 * dt);
      p.y += p.vy * dt;
      if (p.y >= view.groundY) { p.y = view.groundY; p.vy = 0; p.grounded = true; }
    }
    p.x = p.wallSide < 0 ? view.left + 18 : view.right - 18;
    if (p.actionTime >= p.actionDur) {
      p.action = p.grounded ? 'idle' : 'jump';
      p.actionTime = 0;
      p.wallCooldown = .6;
      if (!p.grounded) p.vx = -p.wallSide * 90;
    }
    if (p.sparkTimer > .045) {
      p.sparkTimer = 0;
      addElectricArc(p.x - p.wallSide * 13, p.y - rand(20, 110), p.x - p.wallSide * 16, p.y - rand(5, 80), '#50e9ff', 1.4, .1);
    }
  }

  function wallJump() {
    const p = player;
    p.action = 'wallkick';
    p.actionTime = 0;
    p.actionDur = 2.4;
    p.vx = -p.wallSide * rand(720, 810);
    p.vy = -860;
    p.facing = -p.wallSide;
    p.grounded = false;
    p.wallKickHits = new Set();
    p.invuln = Math.max(p.invuln, .18);
    state.shake = 10;
    state.hitStop = .035;
    addDust(p.x, p.y - 45, '#72f1ff', 12, 1.1);
    shockwave(p.x, p.y - 50, '#46e6ff', 60);
    addFloater('PATADA COMETA', p.x, p.y - 145, '#8ff7ff', 18, .85);
    sfx.jump();
  }

  function updateWallKick(dt) {
    const p = player;
    applyPlayerPhysics(dt, 1, false);
    if (p.actionTime > .12) {
      for (const e of state.enemies) {
        if (e.dead || p.wallKickHits.has(e) || e.state === 'spawn' || e.state === 'grabbed') continue;
        const dx = Math.abs(e.x - p.x);
        const below = e.y > p.y - 20;
        if (dx < 94 * view.actorScale && below && e.y < p.y + 150) {
          p.wallKickHits.add(e);
          damageEnemy(e, 48 + state.wave * 2, {
            normal: false, energy: 20, knockX: Math.sign(e.x - p.x || p.facing) * 250,
            knockY: 900, launch: true, hitStop: .085, source: 'wall', power: 2, armorPierce: true
          });
          p.vy = -500;
          p.vx *= .62;
          state.shake = 14;
          flashScreen(false);
          spawnHit(e.x, e.y - 40, '#8ef5ff', 2, p.facing, 28);
          shockwave(e.x, view.groundY - 5, '#3be6ff', 120);
          sfx.zap();
          break;
        }
      }
    }
    if (p.y >= view.groundY) {
      p.y = view.groundY;
      p.vy = 0;
      p.grounded = true;
      p.action = 'idle';
      p.actionTime = 0;
      p.wallCooldown = .5;
      addDust(p.x, view.groundY, '#79e8f4', 14, 1.35);
      shockwave(p.x, view.groundY - 3, '#45e7ff', 88);
      state.shake = Math.max(state.shake, 6);
    } else if (p.actionTime >= p.actionDur) {
      p.action = 'jump';
      p.actionTime = 0;
    }
  }

  function updateGrab(dt) {
    const p = player;
    const e = p.grabTarget;
    if (!e || e.dead || e.state !== 'grabbed') {
      p.grabTarget = null;
      p.action = 'idle';
      p.actionTime = 0;
      return;
    }
    p.grabTimer -= dt;
    e.x = p.x + p.facing * 52 * view.actorScale;
    e.y = p.y;
    if (p.grounded) e.y = p.y;
    e.facing = -p.facing;
    if (buffered.quick > 0 || buffered.heavy > 0 || buffered.grab > 0) {
      buffered.quick = buffered.heavy = buffered.grab = 0;
      throwGrab();
      return;
    }
    if (p.grabTimer <= 0) throwGrab();
  }

  function updateSuplex(dt) {
    const p = player;
    const e = p.suplexTarget;
    if (!e || e.dead) {
      p.action = 'idle';
      p.suplexTarget = null;
      p.grabTarget = null;
      return;
    }
    const t = p.actionTime;
    if (t < .28) {
      e.x = p.x + p.facing * 34;
      e.y = Math.max(view.wallTop + 130, p.y - 70);
      e.angle = Math.sin(t * 18) * .5;
      p.vy = 0;
      p.y = Math.max(view.groundY - 130, p.y - 70 * dt);
    }
    if (t >= .3 && !p.suplexImpact) {
      p.suplexImpact = true;
      const ix = p.x + p.facing * 22;
      p.y = view.groundY;
      p.grounded = true;
      p.vy = 0;
      e.y = view.groundY;
      e.angle = 0;
      e.state = 'tumble';
      e.grounded = true;
      e.vy = -80;
      e.vx = 0;
      damageEnemy(e, 54 + state.wave * 2, {
        normal: false, energy: 24, knockX: 0, knockY: -170, launch: true,
        hitStop: .085, source: 'suplex', power: 2.2, armorPierce: true, noLaunchOverride: true
      });
      aoeDamage(ix, view.groundY - 10, 156, 30 + state.wave, {
        armorPierce: true, knockX: 460, knockY: -300, energy: 0, source: 'suplex-area', power: 1.4
      });
      shockwave(ix, view.groundY - 4, '#ffe86c', 190);
      spawnHit(ix, view.groundY - 34, '#ffef7e', 2.4, p.facing, 32);
      addFloater('SUPLEX · ÁREA', ix, view.groundY - 175, '#fff19a', 23, 1);
      state.shake = 18;
      state.flash = .7;
      flashScreen(false);
      sfx.ko();
    }
    if (t >= p.actionDur) {
      p.action = 'idle';
      p.actionTime = 0;
      p.grabTarget = null;
      p.suplexTarget = null;
    }
  }

  function updateSpecial(dt) {
    const p = player;
    const t = p.actionTime;
    p.invuln = Math.max(p.invuln, .1);
    if (t > .12 && t < .7) {
      p.vx = p.facing * 720;
      p.x += p.vx * dt;
      executeSpecial();
      if (p.sparkTimer > .025) {
        p.sparkTimer = 0;
        const ex = p.x - p.facing * rand(15, 110);
        addElectricArc(ex, p.y - rand(15, 110), p.x, p.y - rand(20, 100), '#a7fbff', 1.8, .12);
        addElectricArc(p.x + p.facing * 45, p.y - 55, p.x + p.facing * rand(50, 150), p.y - rand(30, 90), '#76ecff', 1.3, .09);
      }
    } else {
      p.vx *= Math.pow(.01, dt);
      p.x += p.vx * dt;
    }
    if (t > .62 && !p.specialSlam) {
      p.specialSlam = true;
      shockwave(p.x, view.groundY - 4, '#85f7ff', 235);
      aoeDamage(p.x, view.groundY - 20, 205, 25 + state.wave * 2, {
        armorPierce: true, knockX: 660, knockY: -380, energy: 0, source: 'special-slam', power: 1.8
      });
      state.shake = Math.max(state.shake, 20);
      flashScreen(false);
      sfx.ko();
    }
    if (p.y < view.groundY) {
      p.vy += 1600 * dt;
      p.y += p.vy * dt;
      if (p.y >= view.groundY) { p.y = view.groundY; p.vy = 0; p.grounded = true; }
    }
    p.x = clamp(p.x, view.left + 18, view.right - 18);
    if (t >= p.actionDur) {
      p.action = 'idle';
      p.actionTime = 0;
      p.specialSlam = false;
      p.grounded = p.y >= view.groundY - 1;
    }
  }

  function hurtPlayer(damage, sourceX, heavy = false) {
    const p = player;
    if (p.invuln > 0 || p.introGrace > 0 || p.dead || state.dying) return;
    if (p.action === 'special') return;
    let amount = damage;
    if (p.action === 'crouch') amount = Math.round(amount * .8);
    p.hp -= amount;
    p.invuln = .72;
    p.hitFlash = .16;
    p.action = 'hurt';
    p.actionTime = 0;
    p.actionDur = heavy ? .44 : .3;
    p.vx = Math.sign(p.x - sourceX || 1) * (heavy ? 430 : 230);
    p.vy = heavy ? -190 : 0;
    p.grounded = false;
    state.shake = Math.max(state.shake, heavy ? 15 : 8);
    state.hitStop = .045;
    addFloater('-' + amount, p.x, p.y - 135, '#ff7588', heavy ? 22 : 16, .65);
    spawnHit(p.x, p.y - 60, '#ff4d63', heavy ? 1.5 : .8, -Math.sign(p.vx), heavy ? 20 : 10);
    flashScreen(true);
    sfx.hurt();
    if (p.grabTarget) releaseGrab();
    if (p.hp <= 0) diePlayer();
    updateHud(true);
  }

  function diePlayer() {
    const p = player;
    p.hp = 0;
    p.dead = true;
    p.ragdoll = true;
    p.action = 'dead';
    p.vy = -680;
    p.vx = -p.facing * 430;
    p.grounded = false;
    p.angle = 0;
    p.angleVel = rand(-8, 8);
    state.dying = true;
    state.deadTimer = 0;
    state.deaths = Math.max(0, state.deaths);
    state.bulletTime = 0;
    state.slow = 1;
    els.speedLines.classList.remove('on');
    state.shake = 22;
    state.hitStop = .12;
    spawnHit(p.x, p.y - 60, '#ff5068', 2.2, -1, 34);
    shockwave(p.x, view.groundY - 2, '#ff526d', 180);
    sfx.ko();
    updateHud(true);
  }

  function updatePlayerDeath(dt) {
    const p = player;
    p.vy += 2100 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.angleVel * dt;
    if (p.y >= view.groundY) {
      p.y = view.groundY;
      if (p.vy > 250) {
        p.vy *= -.35;
        p.vx *= .72;
        p.angleVel *= .7;
        addDust(p.x, view.groundY, '#ff5670', 10, 1);
      } else {
        p.vy = 0;
        p.vx *= .9;
      }
    }
    p.x = clamp(p.x, view.left + 20, view.right - 20);
    state.deadTimer += dt;
    if (state.deadTimer > 1.15 && !p.deadShown) {
      p.deadShown = true;
      beginGameOver();
    }
  }

  /* ---------------- Damage & enemies ---------------- */
  function damageEnemy(enemy, damage, options = {}) {
    if (!enemy || enemy.dead) return false;
    if (enemy.state === 'grabbed' || enemy.state === 'suplexed') return false;
    if (enemy.armored && options.normal && !options.armorPierce) {
      enemy.armorFlash = .32;
      enemy.hitFlash = .1;
      state.hitStop = Math.max(state.hitStop, .035);
      state.shake = Math.max(state.shake, 3);
      spawnHit(enemy.x - (player.x > enemy.x ? -1 : 1) * 10, enemy.y - 62, enemy.palette.bright, .7, options.source === 'dragon' ? 1 : -1, 12);
      addFloater('BLINDADO', enemy.x, enemy.y - 132, '#efff8d', 15, .7);
      sfx.immune();
      return false;
    }
    const actual = Math.round(damage);
    enemy.hp -= actual;
    enemy.hitFlash = .14;
    enemy.stateTime = 0;
    const dir = Math.sign(options.knockX || (enemy.x - player.x) || 1);
    state.hitStop = Math.max(state.hitStop, options.hitStop || .04);
    state.shake = Math.max(state.shake, options.power ? 3.5 + options.power * 4 : 5);
    player.energy = Math.min(100, player.energy + (options.energy || 0));
    if (options.energy) {
      state.particles.push({ type: 'spark', x: player.x, y: player.y - 58, vx: rand(-30, 30), vy: -rand(60, 160), life: .32, maxLife: .32, size: 2, color: '#79f5ff', gravity: -50, drag: .96 });
    }
    addCombo();
    spawnHit(enemy.x, enemy.y - 64 * enemy.scale, enemy.palette.core, options.power || 1, dir, Math.round(10 + (options.power || 1) * 9));
    addFloater(String(actual), enemy.x + rand(-8, 8), enemy.y - 118, options.launch ? '#d6fdff' : '#ffe6e9', options.launch ? 20 : 16, .72);
    if (options.launch) {
      enemy.state = options.noLaunchOverride ? enemy.state : 'tumble';
      if (!options.noLaunchOverride) enemy.state = 'tumble';
      enemy.timer = Math.max(enemy.timer || 0, .72);
      enemy.stunTimer = .78;
      enemy.grounded = false;
      enemy.vx = options.knockX ?? dir * 420;
      enemy.vy = options.knockY ?? -380;
      enemy.angleVel = (Math.random() > .5 ? 1 : -1) * rand(7, 14);
      enemy.hitSet = new Set();
      addDust(enemy.x, enemy.y - 6, enemy.palette.core, 6, .7);
      sfx.hit(options.power || 1);
    } else {
      if (enemy.state !== 'tumble' && enemy.state !== 'thrown' && enemy.state !== 'dead') {
        enemy.state = 'hurt';
        enemy.timer = .22;
        enemy.vx = options.knockX ?? dir * 180;
        enemy.vy = options.knockY ?? 0;
      }
      sfx.hit(.8);
    }
    if (enemy.hp <= 0) {
      killEnemy(enemy, options.knockX ?? dir * 700, options.knockY ?? -520);
    } else if (options.power >= 1.2) {
      addDust(enemy.x, enemy.y - 4, enemy.palette.core, 4, 1);
    }
    updateHud();
    return true;
  }

  function killEnemy(enemy, knockX = 700, knockY = -500, quiet = false) {
    if (!enemy || enemy.dead) return;
    enemy.dead = true;
    enemy.hp = 0;
    enemy.state = 'dead';
    enemy.deadTime = 0;
    enemy.grounded = false;
    enemy.vy = knockY;
    enemy.vx = knockX;
    enemy.angleVel = (Math.random() > .5 ? 1 : -1) * rand(9, 16);
    enemy.hitSet = new Set();
    state.kills++;
    state.hitStop = Math.max(state.hitStop, .085);
    state.shake = Math.max(state.shake, 12);
    spawnHit(enemy.x, enemy.y - 58, enemy.palette.core, 1.9, Math.sign(knockX), 28);
    shockwave(enemy.x, enemy.y - 52, enemy.palette.core, 105);
    addFloater(quiet ? 'FUERA' : '¡K.O.!', enemy.x, enemy.y - 150, enemy.palette.bright, quiet ? 17 : 24, .9);
    addElectricArc(enemy.x - 40, enemy.y - 70, enemy.x + rand(-55, 55), enemy.y - rand(20, 120), enemy.palette.core, 1.5, .16);
    if (!quiet) sfx.ko();
    updateHud(true);
  }

  function aoeDamage(x, y, radius, damage, options = {}) {
    let hits = 0;
    for (const e of state.enemies) {
      if (e.dead || e.state === 'grabbed' || e.state === 'suplexed' || e.state === 'spawn') continue;
      const dx = Math.abs(e.x - x);
      const dy = Math.abs((e.y - 55 * e.scale) - y);
      if (dx < radius && dy < radius * .78) {
        const dir = Math.sign(e.x - x) || 1;
        if (damageEnemy(e, damage, {
          ...options,
          normal: false,
          knockX: (options.knockX || 500) * dir,
          knockY: options.knockY ?? -330
        })) hits++;
      }
    }
    return hits;
  }

  function updateEnemies(dt) {
    for (const e of state.enemies) {
      e.animTime += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.armorFlash = Math.max(0, e.armorFlash - dt);

      if (e.dead) {
        updateEnemyPhysics(e, dt);
        e.deadTime = (e.deadTime || 0) + dt;
        if (e.deadTime > 2.7) e.fade = Math.max(0, 1 - (e.deadTime - 2.7) / 1.05);
        continue;
      }

      if (e.state === 'spawn') {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = 'chase';
          e.timer = 0;
          e.fade = 1;
          e.cooldown = rand(.6, 1.2);
        }
        continue;
      }

      if (e.state === 'grabbed' || e.state === 'suplexed') continue;

      if (e.state === 'thrown') {
        e.stunTimer -= dt;
        updateEnemyPhysics(e, dt);
        checkThrownCollision(e);
        if (e.grounded && (e.stunTimer <= 0 || Math.abs(e.vx) < 260)) {
          e.state = 'tumble';
          e.timer = .6;
          e.angleVel *= .4;
        }
        continue;
      }

      if (e.state === 'tumble') {
        updateEnemyPhysics(e, dt);
        e.timer -= dt;
        if (e.timer <= 0 && e.grounded) {
          e.state = 'hurt';
          e.timer = .24;
          e.angle = 0;
          e.angleVel = 0;
          e.vx = 0;
        }
        continue;
      }

      if (e.state === 'hurt') {
        e.timer -= dt;
        if (e.timer <= 0) { e.state = 'chase'; e.cooldown = rand(.25, .7); e.angle = 0; }
        if (!e.grounded) updateEnemyPhysics(e, dt);
        else e.vx *= Math.pow(.001, dt);
        e.x += e.vx * dt;
        continue;
      }

      if (player.dead) {
        e.state = 'chase';
        e.vx *= .9;
        continue;
      }

      const dx = player.x - e.x;
      const dist = Math.abs(dx);
      const dir = Math.sign(dx) || 1;
      e.facing = dir;
      e.cooldown -= dt;

      if (e.state === 'windup') {
        e.timer -= dt;
        e.vx *= .8;
        if (e.timer <= 0) {
          e.state = 'strike';
          e.timer = e.role === 'heavy' ? .2 : .14;
          e.vx = dir * (e.role === 'heavy' ? 240 : 330);
          const strikeRange = e.reach + (e.role === 'heavy' ? 24 : 15);
          const vertical = Math.abs((player.y - 60 * player.scale) - (e.y - 58 * e.scale));
          if (dist < strikeRange * view.actorScale && vertical < 105 && player.invuln <= 0) {
            hurtPlayer(e.damage + Math.min(5, Math.floor(state.wave / 2)), e.x, e.role === 'heavy');
            if (e.role === 'heavy') {
              state.shake = Math.max(state.shake, 10);
              shockwave(e.x, view.groundY - 4, e.palette.core, 78);
            }
          } else {
            sfx.whoosh();
          }
        }
        continue;
      }

      if (e.state === 'strike') {
        e.timer -= dt;
        e.vx *= Math.pow(.02, dt);
        e.x += e.vx * dt;
        if (e.timer <= 0) {
          e.state = 'chase';
          e.cooldown = e.role === 'heavy' ? rand(1.25, 2.1) : rand(.85, 1.5);
          e.vx = 0;
        }
        continue;
      }

      // Chase / spacing
      if (dist > e.reach * .72 * view.actorScale) {
        e.vx += (dir * e.speed - e.vx) * Math.min(1, dt * 6);
      } else {
        e.vx *= Math.pow(.002, dt);
        if (e.cooldown <= 0) {
          const attackerBusy = state.enemies.some(other => other !== e && !other.dead && (other.state === 'windup' || other.state === 'strike'));
          if (attackerBusy && e.role !== 'heavy') { e.cooldown = .32; }
          else {
          e.state = 'windup';
          e.timer = e.role === 'heavy' ? .64 : .34;
          e.attackDir = dir;
          if (e.role === 'heavy') {
            addFloater('PESADO', e.x, e.y - 132, '#eaff75', 12, .55);
            sfx.tone(92, .18, 'square', .035, -20);
          }
          }
        }
      }
      e.x += e.vx * dt;
      e.x = clamp(e.x, view.left + 18, view.right - 18);
      if (!e.grounded) updateEnemyPhysics(e, dt);
      else e.y = view.groundY;
    }

    separateEnemies();
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (e.fade !== undefined && e.fade <= 0.02) state.enemies.splice(i, 1);
    }
  }

  function separateEnemies() {
    for (let i = 0; i < state.enemies.length; i++) {
      const a = state.enemies[i];
      if (a.dead || !a.grounded || ['grabbed', 'thrown', 'suplexed', 'spawn'].includes(a.state)) continue;
      for (let j = i + 1; j < state.enemies.length; j++) {
        const b = state.enemies[j];
        if (b.dead || !b.grounded || ['grabbed', 'thrown', 'suplexed', 'spawn'].includes(b.state)) continue;
        const d = b.x - a.x;
        if (Math.abs(d) < 26) {
          const push = (26 - Math.abs(d)) * .08 * Math.sign(d || 1);
          a.x -= push; b.x += push;
        }
      }
    }
  }

  function updateEnemyPhysics(e, dt) {
    e.vy += 2240 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.angle += e.angleVel * dt;
    const minX = view.left + 15;
    const maxX = view.right - 15;

    if (e.x < minX) {
      e.x = minX;
      if (Math.abs(e.vx) > 170) {
        addDust(minX, e.y - 55, e.palette.core, 7, 1);
        addDecal(minX + 3, e.y - rand(20, 100), 'wall', e.palette.core, rand(-.7, .7));
        if (Math.abs(e.vx) > 500) { state.shake = Math.max(state.shake, 6); sfx.hit(.6); }
      }
      e.vx = Math.abs(e.vx) * .62;
      e.angleVel *= -.7;
    } else if (e.x > maxX) {
      e.x = maxX;
      if (Math.abs(e.vx) > 170) {
        addDust(maxX, e.y - 55, e.palette.core, 7, 1);
        addDecal(maxX - 3, e.y - rand(20, 100), 'wall', e.palette.core, rand(-.7, .7));
        if (Math.abs(e.vx) > 500) { state.shake = Math.max(state.shake, 6); sfx.hit(.6); }
      }
      e.vx = -Math.abs(e.vx) * .62;
      e.angleVel *= -.7;
    }

    if (e.y < view.wallTop + 118) {
      e.y = view.wallTop + 118;
      e.vy = Math.abs(e.vy) * .34 + 160;
      e.angleVel *= .65;
      addDecal(e.x, view.wallTop + 7, 'ceiling', e.palette.core, 0);
      spawnHit(e.x, view.wallTop + 12, e.palette.core, 1.2, 1, 12);
      state.shake = Math.max(state.shake, 7);
      if (!e.dead) {
        e.hp -= 6;
        if (e.hp <= 0) killEnemy(e, (Math.random() - .5) * 500, 320);
      }
    }

    if (e.y >= view.groundY) {
      e.y = view.groundY;
      e.grounded = true;
      if (e.vy > 230) {
        e.vy *= -.39;
        e.vx *= .72;
        e.angleVel *= .74;
        e.bounceCount++;
        addDust(e.x, view.groundY, e.palette.core, e.dead ? 9 : 5, .8);
        if (e.vy < -100) sfx.hit(.4);
      } else {
        e.vy = 0;
        e.vx *= Math.pow(.12, dt);
        if (e.dead) {
          e.angle = Math.sign(e.angle || 1) * 1.35;
          e.angleVel = 0;
        }
      }
    } else {
      e.grounded = false;
    }
  }

  function checkThrownCollision(e) {
    const speed = Math.hypot(e.vx, e.vy);
    if (speed < 280) return;
    for (const other of state.enemies) {
      if (other === e || other.dead || other.state === 'spawn' || other.state === 'grabbed' || other.state === 'suplexed') continue;
      if (e.hitSet && e.hitSet.has(other)) continue;
      if (Math.abs(other.x - e.x) < 48 * view.otherScale && Math.abs((other.y - 55) - (e.y - 55)) < 90) {
        if (!e.hitSet) e.hitSet = new Set();
        e.hitSet.add(other);
        const dir = Math.sign(other.x - e.x) || 1;
        damageEnemy(other, 25 + state.wave * 2, {
          normal: false, armorPierce: true, energy: 9, knockX: dir * 760,
          knockY: -380, launch: true, source: 'throw-projectile', power: 1.8, hitStop: .07
        });
        e.vx *= .36;
        e.vy = -Math.abs(e.vy) * .2 - 160;
        e.hp -= 9;
        state.shake = Math.max(state.shake, 11);
        shockwave(e.x, e.y - 55, '#ffdf77', 100);
        spawnHit(e.x, e.y - 55, '#fff0a6', 1.6, dir, 18);
        addFloater('¡BOLO!', e.x, e.y - 140, '#ffec82', 18, .7);
        sfx.ko();
        if (e.hp <= 0) killEnemy(e, dir * 600, -350, true);
        break;
      }
    }
  }

  // Compatibility value used by thrown collision on very narrow screens.
  Object.defineProperty(view, 'otherScale', { get() { return this.actorScale; } });

  /* ---------------- Skeleton & poses ---------------- */
  function makeSkeleton(o) {
    const hip = { x: o.hipX || 0, y: o.hipY ?? -56 };
    const lean = o.lean || 0;
    const chest = { x: hip.x + lean, y: o.chestY ?? -92 };
    const neck = { x: chest.x + lean * .16, y: (o.headY ?? -110) + 10 };
    const head = { x: chest.x + lean * .32 + (o.headX || 0), y: o.headY ?? -110 };
    const shoulderF = { x: chest.x + 2.4, y: chest.y + 4 };
    const shoulderB = { x: chest.x - 3.1, y: chest.y + 4.5 };
    const hipF = { x: hip.x + 3, y: hip.y + 1 };
    const hipB = { x: hip.x - 3, y: hip.y + 1 };

    const arm = (shoulder, angles) => {
      const a1 = angles[0], a2 = angles[1];
      const elbow = { x: shoulder.x + Math.sin(a1) * 20.5, y: shoulder.y + Math.cos(a1) * 20.5 };
      const hand = { x: elbow.x + Math.sin(a2) * 18.5, y: elbow.y + Math.cos(a2) * 18.5 };
      return { shoulder, elbow, hand };
    };
    const leg = (hipPoint, angles) => {
      const a1 = angles[0], a2 = angles[1];
      const knee = { x: hipPoint.x + Math.sin(a1) * 28, y: hipPoint.y + Math.cos(a1) * 28 };
      const foot = { x: knee.x + Math.sin(a2) * 27, y: knee.y + Math.cos(a2) * 27 };
      return { hip: hipPoint, knee, foot };
    };
    return {
      hip, chest, neck, head, headR: o.headR || 11.5,
      armF: arm(shoulderF, o.armF), armB: arm(shoulderB, o.armB),
      legF: leg(hipF, o.legF), legB: leg(hipB, o.legB),
      lean, phase: o.phase || 0
    };
  }

  function poseFor(f) {
    const anim = f.animTime || 0;
    const t = f.actionTime || 0;
    const dur = f.actionDur || 1;
    const phase = clamp(t / dur, 0, 1);
    let action = f.kind === 'player' ? f.action : f.state;

    if (f.kind !== 'player') {
      if (action === 'chase') action = Math.abs(f.vx || 0) > 22 ? 'run' : 'idle';
      if (action === 'menu') action = 'idle';
      if (action === 'spawn') action = 'idle';
      if (action === 'windup') action = f.role === 'heavy' ? 'enemyWindupHeavy' : 'enemyWindup';
      if (action === 'strike') action = f.role === 'heavy' ? 'enemyHeavyStrike' : 'enemyStrike';
      if (action === 'hurt') action = 'hurt';
      if (action === 'dead' || action === 'tumble' || action === 'thrown') action = 'ragdoll';
    }

    const breath = Math.sin(anim * 2.2 + (f.aiPhase || 0)) * 1.35;
    if (action === 'idle') {
      return makeSkeleton({
        hipY: -56 + breath, chestY: -92 + breath, headY: -110 + breath, lean: 1.4,
        armF: [.45 + Math.sin(anim * 1.8) * .04, -.92], armB: [-.2, -.38],
        legF: [.06, -.04], legB: [-.07, .05]
      });
    }
    if (action === 'run') {
      const ph = anim * (f.kind === 'player' ? 13.5 : 10.5);
      const s = Math.sin(ph), c = Math.cos(ph);
      return makeSkeleton({
        hipY: -55 + Math.abs(c) * 4, chestY: -91 + Math.abs(c) * 3.4, headY: -109 + Math.abs(c) * 3,
        lean: 7.5 + (f.kind === 'player' ? 1 : 2),
        armF: [-s * .72 - .15, -.85 + s * .12], armB: [s * .72 - .12, -.85 - s * .12],
        legF: [s * .68, s * .6 - .22], legB: [-s * .68, -s * .6 - .22]
      });
    }
    if (action === 'jump') {
      const fall = clamp((f.vy || 0) / 900, -.4, 1);
      return makeSkeleton({
        hipY: -58, chestY: -94, headY: -112, lean: 3,
        armF: [-1.0 - fall * .2, -.35], armB: [-1.18 - fall * .1, -.15],
        legF: [-.45 + fall * .25, .92], legB: [.34 - fall * .1, .82]
      });
    }
    if (action === 'crouch') {
      return makeSkeleton({
        hipY: -37 + breath * .3, chestY: -67, headY: -84, lean: 7,
        armF: [.85, -1.45], armB: [.5, -1.15],
        legF: [.92, -.28], legB: [-.75, .52]
      });
    }
    if (action === 'quick') {
      const strike = t < .06 ? 0 : t < .17 ? ease((t - .06) / .11) : 1 - ease((t - .17) / Math.max(.1, dur - .17)) * .88;
      const step = f.comboStep || 0;
      if (step === 1) {
        return makeSkeleton({
          hipY: -56, chestY: -92, headY: -110, lean: 8 * strike,
          armF: [.78, -1.2], armB: [lerp(.3, 1.56, strike), lerp(-1.2, 1.52, strike)],
          legF: [.18, -.1], legB: [-.26, .18]
        });
      }
      if (step === 2) {
        return makeSkeleton({
          hipY: -57, chestY: -93, headY: -111, lean: 10 * strike,
          armF: [lerp(.55, 1.95, strike), lerp(-.9, 1.15, strike)],
          armB: [lerp(.55, 1.35, strike), lerp(-.8, 1.4, strike)],
          legF: [.25, -.15], legB: [-.3, .2]
        });
      }
      return makeSkeleton({
        hipY: -56, chestY: -92, headY: -110, lean: 5 * strike,
        armF: [lerp(.5, 1.57, strike), lerp(-.9, 1.55, strike)],
        armB: [.72, -1.22],
        legF: [.13, -.08], legB: [-.2, .13]
      });
    }
    if (action === 'heavy') {
      const kick = t < .18 ? ease(t / .18) : t < .34 ? 1 : 1 - ease((t - .34) / Math.max(.08, dur - .34)) * .8;
      return makeSkeleton({
        hipY: -60, chestY: -95, headY: -113, lean: -8 - 7 * kick,
        armF: [-.7 - kick * .5, -.8], armB: [-1.0 - kick * .4, -.5],
        legF: [lerp(-.35, 1.3, kick), lerp(.56, 1.62, kick)],
        legB: [-.18, .15]
      });
    }
    if (action === 'dragon') {
      const rise = clamp((t - .07) / .2, 0, 1);
      const fall = clamp((t - .4) / Math.max(.1, dur - .4), 0, 1);
      return makeSkeleton({
        hipY: -43 - 18 * rise + 18 * fall, chestY: -78 - 21 * rise + 18 * fall,
        headY: -96 - 22 * rise + 19 * fall, lean: 5 + 4 * rise,
        armF: [lerp(1.2, Math.PI, rise), lerp(-.3, Math.PI + .05, rise)],
        armB: [lerp(.7, 2.6, rise), lerp(-1.1, 2.9, rise)],
        legF: [-.25 + .2 * rise, .52 + .2 * rise], legB: [.34, .28]
      });
    }
    if (action === 'spin') {
      const spin = Math.sin(t * 24) * .16;
      return makeSkeleton({
        hipY: -58, chestY: -93, headY: -111, lean: 1 + spin,
        armF: [-1.1 + spin, -.3], armB: [-1.2 - spin, -.2],
        legF: [1.4, 1.58], legB: [-1.25, -1.5]
      });
    }
    if (action === 'special') {
      const lift = clamp((t - .04) / .16, 0, 1);
      return makeSkeleton({
        hipY: -60 - lift * 3, chestY: -96 - lift * 3, headY: -114 - lift * 3, lean: 17,
        armF: [-1.2, -.7], armB: [-1.38, -.4],
        legF: [1.32, 1.62], legB: [.42, 1.05]
      });
    }
    if (action === 'grab') {
      return makeSkeleton({
        hipY: -55, chestY: -92, headY: -110, lean: 9,
        armF: [1.48, 1.55], armB: [1.3, 1.45],
        legF: [.28, -.18], legB: [-.3, .22]
      });
    }
    if (action === 'throw') {
      const burst = Math.sin(phase * Math.PI);
      return makeSkeleton({
        hipY: -57, chestY: -94, headY: -112, lean: 12 - burst * 4,
        armF: [1.9, 1.85], armB: [1.72, 1.7],
        legF: [.35, -.16], legB: [-.38, .24]
      });
    }
    if (action === 'suplex') {
      const slam = clamp((t - .24) / .12, 0, 1);
      return makeSkeleton({
        hipY: -55 - (1 - slam) * 18, chestY: -92 - (1 - slam) * 18,
        headY: -110 - (1 - slam) * 16, lean: 4 + slam * 9,
        armF: [1.5, 1.2 - slam * .8], armB: [1.4, 1.1 - slam * .7],
        legF: [.65, 1.15], legB: [-.62, .95]
      });
    }
    if (action === 'hurt') {
      return makeSkeleton({
        hipY: -54, chestY: -88, headY: -105, lean: -13,
        armF: [-.6, -1.5], armB: [-.9, -1.2],
        legF: [.24, -.2], legB: [-.35, .32]
      });
    }
    if (action === 'wallcling') {
      const slide = Math.sin(anim * 12) * .04;
      return makeSkeleton({
        hipY: -56, chestY: -92, headY: -110, lean: 4,
        armF: [2.34 + slide, 2.25], armB: [2.08, 2.5],
        legF: [.54, -.75], legB: [-.36, .7]
      });
    }
    if (action === 'wallkick') {
      return makeSkeleton({
        hipY: -59, chestY: -95, headY: -113, lean: 15,
        armF: [-1.15, -.6], armB: [-1.3, -.4],
        legF: [1.18, 1.48], legB: [.22, .85]
      });
    }
    if (action === 'enemyWindup') {
      const charge = clamp(t / Math.max(.01, dur), 0, 1);
      return makeSkeleton({
        hipY: -55, chestY: -91, headY: -109, lean: -8 - charge * 4,
        armF: [-.7, -.5], armB: [-.9, -.2],
        legF: [.28, -.15], legB: [-.36, .28]
      });
    }
    if (action === 'enemyWindupHeavy') {
      const charge = clamp(t / Math.max(.01, dur), 0, 1);
      return makeSkeleton({
        hipY: -55, chestY: -91, headY: -109, lean: -12 - charge * 5,
        armF: [-1.05, -.35], armB: [-1.25, -.2],
        legF: [.38, -.2], legB: [-.48, .35], headR: 12.4
      });
    }
    if (action === 'enemyStrike') {
      return makeSkeleton({
        hipY: -56, chestY: -92, headY: -110, lean: 8,
        armF: [1.55, 1.58], armB: [.78, -1.15],
        legF: [.38, -.2], legB: [-.3, .24]
      });
    }
    if (action === 'enemyHeavyStrike') {
      return makeSkeleton({
        hipY: -58, chestY: -94, headY: -112, lean: 12,
        armF: [1.5, 1.55], armB: [1.2, 1.4],
        legF: [.45, -.22], legB: [-.38, .3], headR: 12.4
      });
    }
    if (action === 'ragdoll') {
      const s = Math.sin(anim * 10), c = Math.cos(anim * 8);
      return makeSkeleton({
        hipY: -55, chestY: -90 + s * 3, headY: -107 + c * 4, lean: s * 7,
        armF: [1.2 + s, 1.6 + c], armB: [-1.3 + c, -1.8 + s],
        legF: [.8 + s * .7, .25 - c * .9], legB: [-.7 - c * .5, .5 + s * .8]
      });
    }
    return makeSkeleton({
      hipY: -56, chestY: -92, headY: -110, lean: 1,
      armF: [.45, -.92], armB: [-.2, -.38], legF: [.06, -.04], legB: [-.07, .05]
    });
  }

  function drawPath(points, width, color, glow = 0) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawSkeleton(pose, pal, options = {}) {
    const heavy = options.heavy;
    const flash = options.flash;
    const core = flash ? '#ffffff' : pal.core;
    const bright = flash ? '#ffffff' : pal.bright;
    const lw = heavy ? 6.2 : 5.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const backAlpha = .62;
    ctx.globalAlpha = options.alpha ?? 1;

    // Dark silhouette / separation
    ctx.strokeStyle = '#02070d';
    ctx.lineWidth = lw + 5;
    ctx.beginPath();
    ctx.moveTo(pose.armB.shoulder.x, pose.armB.shoulder.y);
    ctx.lineTo(pose.armB.elbow.x, pose.armB.elbow.y);
    ctx.lineTo(pose.armB.hand.x, pose.armB.hand.y);
    ctx.moveTo(pose.legB.hip.x, pose.legB.hip.y);
    ctx.lineTo(pose.legB.knee.x, pose.legB.knee.y);
    ctx.lineTo(pose.legB.foot.x, pose.legB.foot.y);
    ctx.moveTo(pose.hip.x, pose.hip.y);
    ctx.lineTo(pose.chest.x, pose.chest.y);
    ctx.lineTo(pose.neck.x, pose.neck.y);
    ctx.moveTo(pose.legF.hip.x, pose.legF.hip.y);
    ctx.lineTo(pose.legF.knee.x, pose.legF.knee.y);
    ctx.lineTo(pose.legF.foot.x, pose.legF.foot.y);
    ctx.moveTo(pose.armF.shoulder.x, pose.armF.shoulder.y);
    ctx.lineTo(pose.armF.elbow.x, pose.armF.elbow.y);
    ctx.lineTo(pose.armF.hand.x, pose.armF.hand.y);
    ctx.stroke();

    // Back limbs
    ctx.globalAlpha = backAlpha * (options.alpha ?? 1);
    drawPath([pose.armB.shoulder, pose.armB.elbow, pose.armB.hand], lw * .82, core, 9);
    drawPath([pose.legB.hip, pose.legB.knee, pose.legB.foot], lw * .88, core, 9);
    ctx.globalAlpha = options.alpha ?? 1;

    // Torso glow
    if (!options.noGlow) {
      ctx.shadowColor = pal.aura;
      ctx.shadowBlur = 13;
    }
    drawPath([pose.hip, pose.chest, pose.neck], lw * 1.27, core, 0);
    ctx.shadowBlur = 0;
    drawPath([pose.hip, pose.chest, pose.neck], lw * .52, bright);

    // Front limbs
    drawPath([pose.legF.hip, pose.legF.knee, pose.legF.foot], lw, core, options.noGlow ? 0 : 12);
    drawPath([pose.armF.shoulder, pose.armF.elbow, pose.armF.hand], lw * .9, core, options.noGlow ? 0 : 12);
    ctx.globalAlpha = options.alpha ?? 1;

    // Highlights
    ctx.globalAlpha = .75 * (options.alpha ?? 1);
    drawPath([pose.legF.knee, pose.legF.foot], 1.5, bright);
    drawPath([pose.armF.elbow, pose.armF.hand], 1.4, bright);
    drawPath([pose.chest, pose.neck], 1.2, bright);
    ctx.globalAlpha = options.alpha ?? 1;

    // Head
    ctx.beginPath();
    ctx.arc(pose.head.x, pose.head.y, pose.headR, 0, TAU);
    ctx.fillStyle = pal.dark;
    ctx.fill();
    ctx.shadowColor = pal.aura;
    ctx.shadowBlur = options.noGlow ? 0 : 16;
    ctx.strokeStyle = core;
    ctx.lineWidth = heavy ? 4.5 : 3.8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Visor / eyes
    ctx.strokeStyle = bright;
    ctx.lineWidth = 1.65;
    ctx.beginPath();
    ctx.moveTo(pose.head.x - 1, pose.head.y - 1);
    ctx.lineTo(pose.head.x + pose.headR * .68, pose.head.y - 1.4);
    ctx.stroke();
    if (heavy) {
      ctx.strokeStyle = pal.core;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(pose.head.x + 3, pose.head.y - 5);
      ctx.lineTo(pose.head.x + 7, pose.head.y - 1.5);
      ctx.lineTo(pose.head.x + 3, pose.head.y + 2);
      ctx.stroke();
    }

    // Chest core
    ctx.beginPath();
    ctx.arc(pose.chest.x + 1, pose.chest.y + 4, heavy ? 3.3 : 2.5, 0, TAU);
    ctx.fillStyle = bright;
    ctx.shadowColor = pal.aura; ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (heavy) {
      ctx.strokeStyle = pal.core;
      ctx.globalAlpha = .5;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(pose.armF.shoulder.x, pose.armF.shoulder.y, 5.2, 0, TAU);
      ctx.arc(pose.armB.shoulder.x, pose.armB.shoulder.y, 4.8, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(pose.chest.x - 5, pose.chest.y + 15);
      ctx.lineTo(pose.chest.x + 6, pose.chest.y + 15);
      ctx.lineTo(pose.chest.x + 3, pose.chest.y + 23);
      ctx.lineTo(pose.chest.x - 2, pose.chest.y + 23);
      ctx.closePath();
      ctx.stroke();
    }

    // Player scarf / electric ribbon
    if (options.scarf) {
      const wave = Math.sin((options.anim || 0) * 7) * 4;
      ctx.globalAlpha = .55;
      ctx.strokeStyle = pal.core;
      ctx.shadowColor = pal.aura;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 2, pose.neck.y + 5);
      ctx.quadraticCurveTo(pose.neck.x - 34, pose.neck.y + 12 + wave, pose.neck.x - 58, pose.neck.y + 2 - wave);
      ctx.stroke();
      ctx.globalAlpha = .26;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 2, pose.neck.y + 8);
      ctx.quadraticCurveTo(pose.neck.x - 28, pose.neck.y + 25 - wave, pose.neck.x - 47, pose.neck.y + 19 + wave * .5);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }

  function drawShadow(f) {
    const scale = view.actorScale * (f.scale || 1);
    const height = Math.max(0, view.groundY - f.y);
    const shrink = clamp(1 - height / 520, .38, 1);
    const alpha = .42 * shrink * (f.state === 'spawn' ? .3 : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#010409';
    ctx.beginPath();
    ctx.ellipse(f.x, view.groundY + 2, 33 * scale * shrink, 7.5 * scale * shrink, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha * .3;
    ctx.fillStyle = f.palette?.aura || '#2bd9ff';
    ctx.beginPath();
    ctx.ellipse(f.x, view.groundY + 3, 43 * scale * shrink, 9.5 * scale * shrink, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawFighter(f, options = {}) {
    if (!f) return;
    const pal = f.palette || PALETTE.player;
    const scale = view.actorScale * (f.scale || 1);
    let alpha = f.fade ?? 1;
    if (f.state === 'spawn') alpha = clamp(1 - f.timer / .42, 0, 1);
    if (f.kind === 'player' && f.invuln > 0 && !f.dead) alpha *= .72 + Math.sin(state.realTime * 32) * .12;
    if (options.alpha !== undefined) alpha *= options.alpha;

    if (!options.reflection) drawShadow(f);

    // Floor reflection (player only keeps the scene fast and readable)
    if (!options.reflection && !f.dead && f.kind === 'player') {
      ctx.save();
      ctx.translate(f.x, view.groundY * 2 - f.y);
      ctx.scale(f.facing * scale, -scale);
      if (f.ragdoll || ['tumble', 'thrown', 'dead'].includes(f.state)) ctx.rotate(-(f.angle || 0) * .5);
      drawSkeleton(poseFor(f), pal, {
        heavy: f.role === 'heavy', flash: false,
        scarf: f.kind === 'player', anim: f.animTime, alpha: .09, noGlow: true
      });
      ctx.restore();
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    const ragdoll = f.ragdoll || ['tumble', 'thrown', 'dead'].includes(f.state);
    if (ragdoll) {
      ctx.translate(0, -58 * scale);
      ctx.rotate(f.angle || 0);
      ctx.translate(0, 58 * scale);
    }
    ctx.scale(f.facing * scale, scale);
    drawSkeleton(poseFor(f), pal, {
      heavy: f.role === 'heavy', flash: f.hitFlash > 0,
      scarf: f.kind === 'player', anim: f.animTime, alpha: clamp(alpha, 0, 1)
    });
    ctx.restore();

    if (f.kind !== 'player' && !f.dead && f.state !== 'spawn' && !options.reflection) {
      drawEnemyHealth(f);
    }
  }

  function drawEnemyHealth(e) {
    if (e.hp >= e.maxHp || e.kind === 'menu') return;
    const scale = view.actorScale * (e.scale || 1);
    const w = e.role === 'heavy' ? 52 : 38;
    const y = e.y - 144 * scale;
    const x = e.x - w / 2;
    ctx.save();
    ctx.globalAlpha = .82;
    ctx.fillStyle = 'rgba(1,5,11,.75)';
    ctx.fillRect(x - 1, y - 1, w + 2, 5);
    ctx.fillStyle = e.palette.core;
    ctx.shadowColor = e.palette.core;
    ctx.shadowBlur = 5;
    ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 3);
    ctx.shadowBlur = 0;
    if (e.role === 'heavy') {
      ctx.fillStyle = e.palette.bright;
      ctx.font = '600 6px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BLINDADO', e.x, y - 4);
    }
    if (e.state === 'windup') {
      ctx.fillStyle = e.palette.core;
      ctx.font = '700 15px Bebas, sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = .7 + Math.sin(state.realTime * 20) * .3;
      ctx.fillText('!', e.x, y - 12);
    }
    ctx.restore();
  }

  /* ---------------- Scene rendering ---------------- */
  function drawBackground() {
    if (!bgCanvas) return;
    ctx.drawImage(bgCanvas, 0, 0, view.w, view.h);

    // Pulsing ambient light pools
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const focusX = player.x || view.w * .5;
    const pool = ctx.createRadialGradient(focusX, view.groundY - 70, 8, focusX, view.groundY - 70, 270);
    pool.addColorStop(0, 'rgba(27,154,205,.08)');
    pool.addColorStop(.5, 'rgba(17,102,155,.035)');
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(focusX - 280, view.groundY - 350, 560, 410);

    const pulse = .5 + Math.sin(state.realTime * 1.5) * .16;
    const leftGlow = ctx.createLinearGradient(0, 0, 76, 0);
    leftGlow.addColorStop(0, `rgba(41,216,255,${.14 * pulse})`);
    leftGlow.addColorStop(1, 'rgba(41,216,255,0)');
    ctx.fillStyle = leftGlow;
    ctx.fillRect(0, 0, 76, view.h);
    const rightGlow = ctx.createLinearGradient(view.w, 0, view.w - 76, 0);
    rightGlow.addColorStop(0, `rgba(41,216,255,${.14 * pulse})`);
    rightGlow.addColorStop(1, 'rgba(41,216,255,0)');
    ctx.fillStyle = rightGlow;
    ctx.fillRect(view.w - 76, 0, 76, view.h);
    ctx.restore();

    // Atmospheric motes
    ctx.save();
    for (const p of state.ambient) {
      const glow = .55 + Math.sin(p.phase * 2 + state.realTime) * .45;
      ctx.globalAlpha = p.alpha * glow;
      ctx.fillStyle = p.tint ? '#ff5ba6' : '#66e9ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Wall proximity energy
    const nearWall = player.x < view.left + 75 ? -1 : player.x > view.right - 75 ? 1 : 0;
    if (nearWall) {
      const wx = nearWall < 0 ? view.left + 1 : view.right - 1;
      const strength = nearWall < 0 ? 1 - (player.x - view.left) / 75 : 1 - (view.right - player.x) / 75;
      ctx.save();
      ctx.globalAlpha = clamp(strength, 0, 1) * .42;
      ctx.strokeStyle = '#7af3ff';
      ctx.shadowColor = '#2edcff';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const start = (state.realTime * 150) % 170;
      for (let y = start; y < view.groundY; y += 37) {
        ctx.moveTo(wx, y);
        ctx.lineTo(wx + (Math.random() - .5) * 5, y + 17);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Distant scanning bands
    const sweep = ((state.realTime * 26) % (view.h + 220)) - 110;
    const beam = ctx.createLinearGradient(0, sweep - 30, 0, sweep + 30);
    beam.addColorStop(0, 'rgba(63,220,255,0)');
    beam.addColorStop(.5, 'rgba(63,220,255,.018)');
    beam.addColorStop(1, 'rgba(63,220,255,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, sweep - 30, view.w, 60);
  }

  function drawDecals() {
    ctx.save();
    ctx.lineCap = 'round';
    for (const d of state.decals) {
      const a = clamp(d.life / d.maxLife, 0, 1) * .7;
      ctx.globalAlpha = a;
      ctx.strokeStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (d.kind === 'ceiling') {
        const len = 28;
        ctx.moveTo(d.x - len, view.wallTop + 4);
        ctx.lineTo(d.x - len * .4, view.wallTop + 7);
        ctx.lineTo(d.x, view.wallTop + 2);
        ctx.lineTo(d.x + len * .35, view.wallTop + 8);
        ctx.lineTo(d.x + len, view.wallTop + 3);
      } else {
        ctx.moveTo(d.x, d.y - 18);
        ctx.lineTo(d.x + 4, d.y - 5);
        ctx.lineTo(d.x + 1, d.y + 7);
        ctx.moveTo(d.x + 1, d.y - 8);
        ctx.lineTo(d.x + 12, d.y - 14);
        ctx.moveTo(d.x + 1, d.y + 2);
        ctx.lineTo(d.x - 9, d.y + 10);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPortals() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of state.portals) {
      const t = 1 - clamp(p.life / p.maxLife, 0, 1);
      const alpha = Math.sin(t * Math.PI);
      const h = 145 * p.scale * view.actorScale;
      const w = 28 * p.scale * view.actorScale;
      ctx.globalAlpha = alpha * .7;
      const grad = ctx.createRadialGradient(p.x, p.y - h * .48, 1, p.x, p.y - h * .48, h * .52);
      grad.addColorStop(0, p.color);
      grad.addColorStop(.35, p.color + '55');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - h * .45, w, h * .5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.1;
      ctx.globalAlpha = alpha * .8;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - h * .45, w * 1.6, h * .52, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - h * .96);
      ctx.lineTo(p.x, p.y - h * .04);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAura() {
    const p = player;
    if (p.dead) return;
    const scale = view.actorScale;
    const active = p.energy >= 100 || p.action === 'special';
    if (!active && p.action !== 'wallcling' && p.action !== 'wallkick') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = .55 + Math.sin(state.realTime * 9) * .25;
    if (active) {
      ctx.globalAlpha = .12 * pulse;
      ctx.strokeStyle = '#55efff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 2, 37 * scale, 10 * scale, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = .42 * pulse;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = state.realTime * 3 + i * 2.1;
        const x = p.x + Math.cos(a) * 27 * scale;
        const y = p.y - 54 * scale + Math.sin(a * 1.3) * 35 * scale;
        ctx.globalAlpha = .28;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand(-9, 9), y + rand(-10, 10));
        ctx.stroke();
      }
    }
    if (p.action === 'wallcling') {
      ctx.globalAlpha = .5;
      ctx.strokeStyle = '#82f6ff';
      ctx.lineWidth = 1.6;
      const wx = p.wallSide < 0 ? view.left + 4 : view.right - 4;
      for (let i = 0; i < 3; i++) {
        const y = p.y - 30 - i * 28 + Math.sin(state.realTime * 17 + i) * 5;
        ctx.beginPath();
        ctx.moveTo(wx, y);
        ctx.lineTo(wx + p.wallSide * rand(8, 23), y + rand(-8, 8));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawCombatFx() {
    const p = player;
    if (p.dead) return;
    const s = view.actorScale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (p.action === 'quick' || p.action === 'heavy') {
      const t = p.actionTime;
      const active = p.action === 'quick' ? t > .05 && t < .24 : t > .19 && t < .4;
      if (active) {
        const heavy = p.action === 'heavy';
        const cx = p.x + p.facing * (heavy ? 75 : 58) * s;
        const cy = p.y - (heavy ? 58 : 85) * s;
        ctx.globalAlpha = heavy ? .55 : .36;
        ctx.strokeStyle = heavy ? '#ff9fd0' : '#a7f8ff';
        ctx.shadowColor = heavy ? '#ff4f9d' : '#55eaff';
        ctx.shadowBlur = 14;
        ctx.lineWidth = heavy ? 6 : 3.5;
        ctx.beginPath();
        const base = p.facing > 0 ? -.65 : Math.PI - .65;
        ctx.arc(cx, cy, (heavy ? 53 : 38) * s, base, base + 1.3);
        ctx.stroke();
      }
    }

    if (p.action === 'spin') {
      const t = p.actionTime / p.actionDur;
      ctx.globalAlpha = .46 * Math.sin(clamp(t, 0, 1) * Math.PI);
      ctx.strokeStyle = '#c5fdff';
      ctx.shadowColor = '#65edff';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 54 * s, 122 * s, 38 * s, .05, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha *= .6;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 54 * s, 95 * s, 27 * s, -.08, 0, TAU);
      ctx.stroke();
    }

    if (p.action === 'dragon') {
      const t = clamp((p.actionTime - .08) / .35, 0, 1);
      const alpha = Math.sin(t * Math.PI);
      ctx.globalAlpha = alpha * .55;
      const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y - 190 * s);
      g.addColorStop(0, 'rgba(55,229,255,0)');
      g.addColorStop(.6, 'rgba(153,252,255,.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 18 * s, p.y - 190 * s, 36 * s, 190 * s);
      ctx.strokeStyle = '#c2fdff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + rand(-8, 8), p.y);
      ctx.lineTo(p.x + rand(-6, 6), p.y - 100 * s);
      ctx.lineTo(p.x + rand(-6, 6), p.y - 190 * s);
      ctx.stroke();
    }

    if (p.action === 'special') {
      const t = p.actionTime;
      ctx.globalAlpha = .4;
      ctx.strokeStyle = 'rgba(174,250,255,.65)';
      ctx.lineWidth = 6;
      for (let i = 0; i < 4; i++) {
        const y = p.y - 35 - i * 19;
        ctx.beginPath();
        ctx.moveTo(p.x - p.facing * (85 + i * 20), y + Math.sin(state.realTime * 20 + i) * 5);
        ctx.lineTo(p.x + p.facing * (35 + t * 45), y - 2);
        ctx.stroke();
      }
      ctx.globalAlpha = .55;
      ctx.strokeStyle = '#e0ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 50, p.y - 20 * s);
      ctx.lineTo(p.x + p.facing * 120, p.y - 55 * s);
      ctx.stroke();
    }

    if (p.action === 'wallkick') {
      ctx.globalAlpha = .45;
      const g = ctx.createLinearGradient(p.x - p.vx * .05, p.y, p.x + p.vx * .04, p.y - 80);
      g.addColorStop(0, 'rgba(58,228,255,0)');
      g.addColorStop(.7, 'rgba(100,241,255,.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * .04, p.y - 18);
      ctx.lineTo(p.x - p.vx * .012, p.y - 118);
      ctx.lineTo(p.x, p.y - 64);
      ctx.closePath();
      ctx.fill();
    }

    if (p.action === 'grab' && p.grabTarget) {
      const e = p.grabTarget;
      ctx.globalAlpha = .35;
      ctx.strokeStyle = '#99f4ff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 75);
      ctx.lineTo(e.x, e.y - 70);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Enemy warning and strike swipes
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (e.state === 'windup') {
        const s2 = clamp(e.timer / (e.role === 'heavy' ? .64 : .34), 0, 1);
        ctx.globalAlpha = .24 + (1 - s2) * .25;
        ctx.strokeStyle = e.palette.core;
        ctx.lineWidth = e.role === 'heavy' ? 2 : 1.2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(e.x + e.facing * e.reach * .55, e.y - 57, e.reach * .58, -.6, .75);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (e.state === 'strike') {
        ctx.globalAlpha = .33;
        ctx.strokeStyle = e.palette.bright;
        ctx.shadowColor = e.palette.core;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;
        const cx = e.x + e.facing * 48, cy = e.y - 60;
        ctx.beginPath();
        ctx.arc(cx, cy, 33, e.facing > 0 ? -1 : Math.PI - .2, e.facing > 0 ? .2 : Math.PI + 1);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sparkGroups = new Map();
    const dustGroups = new Map();
    const singles = [];
    for (const p of state.particles) {
      if (p.type === 'spark') {
        if (!sparkGroups.has(p.color)) sparkGroups.set(p.color, []);
        sparkGroups.get(p.color).push(p);
      } else if (p.type === 'dust') {
        if (!dustGroups.has(p.color)) dustGroups.set(p.color, []);
        dustGroups.get(p.color).push(p);
      } else {
        singles.push(p);
      }
    }

    // Batch thousands of possible spark segments into one stroke per colour.
    for (const [color, list] of sparkGroups) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = .16;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (const p of list) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * .023, p.y - p.vy * .023);
      }
      ctx.stroke();
      ctx.globalAlpha = .7;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    for (const [color, list] of dustGroups) {
      ctx.fillStyle = color;
      ctx.globalAlpha = .14;
      ctx.beginPath();
      for (const p of list) {
        const a = clamp(p.life / (p.maxLife || .3), 0, 1);
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size * (1.2 - a * .2), 0, TAU);
      }
      ctx.fill();
    }

    for (const p of singles) {
      const a = clamp(p.life / (p.maxLife || .3), 0, 1);
      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a * .16;
        ctx.lineWidth = p.line * 3.4 + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.lineWidth = p.line * a + .3;
        ctx.stroke();
      } else if (p.type === 'slash') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a * .18;
        ctx.lineWidth = 9 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * .6, p.angle - .5, p.angle + .8);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.lineWidth = 3 * a + .3;
        ctx.stroke();
      } else if (p.type === 'arc') {
        const segments = 7;
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const nx = -dy, ny = dx;
        const len = Math.hypot(nx, ny) || 1;
        const points = [];
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const jitter = i === 0 || i === segments ? 0 : (Math.random() - .5) * 13;
          points.push([p.x + dx * t + nx / len * jitter, p.y + dy * t + ny / len * jitter]);
        }
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a * .2;
        ctx.lineWidth = p.line * 4 + .5;
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.lineWidth = p.line * a + .2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFloaters() {
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = Math.min(1, a * 1.7);
      ctx.font = `400 ${Math.round(f.size * view.actorScale)}px Bebas, sans-serif`;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 13;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawBulletTimeOverlay() {
    if (state.bulletTime <= 0) return;
    const a = clamp(state.bulletTime / Math.max(.001, state.bulletMax), 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(6,53,92,${.04 + a * .035})`;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.strokeStyle = `rgba(100,235,255,${.13 * a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const y = ((state.realTime * 190 + i * 113) % view.h);
      const len = 60 + (i % 5) * 58;
      ctx.moveTo(0, y);
      ctx.lineTo(len, y + 1);
      ctx.moveTo(view.w, view.h - y);
      ctx.lineTo(view.w - len, view.h - y - 1);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGameScene() {
    drawBackground();
    ctx.save();
    const amp = Math.min(17, state.shake);
    const sx = Math.sin(state.realTime * 91) * amp + Math.sin(state.realTime * 53) * amp * .35;
    const sy = Math.cos(state.realTime * 77) * amp * .7;
    ctx.translate(sx, sy);
    if (state.bulletTime > 0) {
      ctx.translate(view.w / 2, view.h / 2);
      ctx.scale(1.006, 1.006);
      ctx.translate(-view.w / 2, -view.h / 2);
    }

    drawDecals();
    drawPortals();
    drawAura();

    const actors = [player, ...state.enemies];
    actors.sort((a, b) => (a.y - b.y) || (a.kind === 'player' ? 1 : -1));
    for (const actor of actors) drawFighter(actor);
    drawCombatFx();
    drawParticles();
    drawFloaters();
    ctx.restore();

    drawBulletTimeOverlay();
  }

  function drawMenuScene() {
    drawBackground();
    ctx.save();
    ctx.globalAlpha = .96;
    const actors = [player, ...state.menuFighters];
    for (const a of actors) drawFighter(a, { noHealth: true });
    ctx.restore();
    drawCombatFx();
    drawParticles();
    drawFloaters();
    // Cinematic edge for the menu
    const side = ctx.createLinearGradient(0, 0, view.w, 0);
    side.addColorStop(0, 'rgba(2,6,13,.05)');
    side.addColorStop(.65, 'rgba(2,6,13,.15)');
    side.addColorStop(1, 'rgba(2,6,13,.55)');
    ctx.fillStyle = side;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function render() {
    if (!bgCanvas) return;
    if (state.screen === 'menu' || state.screen === 'how') drawMenuScene();
    else drawGameScene();
  }

  /* ---------------- Main loop ---------------- */
  function updateMenu(dt) {
    player.animTime += dt;
    for (const e of state.menuFighters) e.animTime += dt;
    updateAmbient(dt);
    updateFx(dt);
  }

  function updateGame(dt) {
    if (state.paused) return;

    // Interface timers continue through hit-stop
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) els.banner.classList.remove('show');
    }
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) els.toast.classList.remove('show');
    }
    if (state.hintTimer > 0) {
      state.hintTimer -= dt;
      if (state.hintTimer <= 0) els.contextHint.classList.remove('show');
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) resetCombo();
    }

    state.shake *= Math.pow(.06, dt);
    if (state.shake < .12) state.shake = 0;
    state.flash = Math.max(0, state.flash - dt * 3.2);

    if (state.bulletTime > 0) {
      state.bulletTime -= dt;
      state.slow = .4;
      if (state.bulletTime <= 0) {
        state.bulletTime = 0;
        state.slow = 1;
        els.speedLines.classList.remove('on');
      }
    } else {
      state.slow = 1;
    }

    if (state.hitStop > 0) {
      state.hitStop -= dt;
      updateFx(dt * .22);
      updateHud();
      return;
    }

    state.time += dt;
    updateAmbient(dt);
    updatePlayer(dt);
    updateEnemies(dt * state.slow);
    updateWave(dt * state.slow);
    updateFx(dt * (state.slow === 1 ? 1 : .7));
    updateHud();
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = clamp((now - lastTime) / 1000, 0, .036);
    lastTime = now;
    state.realTime += dt;

    if (state.screen === 'playing') updateGame(dt);
    else if (state.screen === 'menu' || state.screen === 'how') updateMenu(dt);
    else if (state.screen === 'ad') {
      updateAd();
      updateAmbient(dt);
      updateFx(dt);
    }

    render();
    requestAnimationFrame(loop);
  }

  window.NeonStick = {
    state, player, startGame, startWave, spawnEnemy, hurtPlayer, diePlayer,
    beginGameOver, resetWorld, prepareMenu, get enemies() { return state.enemies; }
  };

  function init() {
    makeBattery();
    resize();
    bindInput();
    bindUi();
    prepareMenu();
    updateHud(true);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        buildBackground();
        render();
      }).catch(() => {});
    }
    requestAnimationFrame(loop);
  }

  init();
})();





