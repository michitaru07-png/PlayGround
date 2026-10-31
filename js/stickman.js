import { TAU, clamp, lerp } from './utils.js';

export function makePose() {
  return {
    hipX: 0,
    bob: 0,
    torso: 0.06,
    headTilt: 0,
    armFar: [0.16, 0.32],
    armNear: [0.09, 0.28],
    legFar: [0.1, 0.11],
    legNear: [-0.1, 0.09],
  };
}

export function clonePose(p) {
  return {
    hipX: p.hipX,
    bob: p.bob,
    torso: p.torso,
    headTilt: p.headTilt,
    armFar: [p.armFar[0], p.armFar[1]],
    armNear: [p.armNear[0], p.armNear[1]],
    legFar: [p.legFar[0], p.legFar[1]],
    legNear: [p.legNear[0], p.legNear[1]],
  };
}

export function blendPose(pose, target, dt, speed = 20) {
  const k = 1 - Math.exp(-speed * dt);
  pose.hipX = lerp(pose.hipX, target.hipX, k);
  pose.bob = lerp(pose.bob, target.bob, k);
  pose.torso = lerp(pose.torso, target.torso, k);
  pose.headTilt = lerp(pose.headTilt, target.headTilt, k);
  for (const key of ['armFar', 'armNear', 'legFar', 'legNear']) {
    pose[key][0] = lerp(pose[key][0], target[key][0], k);
    pose[key][1] = lerp(pose[key][1], target[key][1], k);
  }
}

function strokePath(ctx, points, width, color, alpha) {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

/**
 * Draws a procedural stick figure.
 * Local space: feet at (0,0), 1 unit ≈ body height, +y is down.
 */
export function drawStickman(ctx, opts) {
  const {
    x, y, scale, facing = 1, pose, rot = 0,
    colors = {},
    alpha = 1,
    flash = 0,
    lineWidth = 0.05,
    phase = 0,
    eyes = 'dot',
    showScarf = false,
    showBand = false,
    swoosh = null,
    scaleY = 1,
  } = opts;

  if (alpha <= 0.01 || !pose) return;

  const body = colors.body || '#f2f7ff';
  const far = colors.far || '#93a9c9';
  const accent = colors.accent || '#41f6ff';
  const dark = colors.dark || '#0a1020';
  const eyeColor = colors.eye || accent;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale * scaleY);
  ctx.translate(0, -0.5);
  ctx.rotate(rot);
  ctx.translate(0, 0.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hip = { x: pose.hipX, y: -0.5 + pose.bob };
  const upDir = (a) => [Math.sin(a), -Math.cos(a)];
  const downDir = (a) => [Math.sin(a), Math.cos(a)];
  const add = (p, [dx, dy], len = 1) => [p[0] + dx * len, p[1] + dy * len];

  const t = pose.torso;
  const neck = add([hip.x, hip.y], upDir(t), 0.345);
  const shoulder = add([hip.x, hip.y], upDir(t), 0.272);
  const head = add(neck, upDir(t + pose.headTilt), 0.113);
  const headR = 0.099;

  const armFarShoulder = [shoulder[0] - 0.008, shoulder[1] + 0.004];
  const elbowFar = add(armFarShoulder, downDir(pose.armFar[0]), 0.185);
  const handFar = add(elbowFar, downDir(pose.armFar[0] + pose.armFar[1]), 0.18);

  const armNearShoulder = [shoulder[0] + 0.008, shoulder[1]];
  const elbowNear = add(armNearShoulder, downDir(pose.armNear[0]), 0.19);
  const handNear = add(elbowNear, downDir(pose.armNear[0] + pose.armNear[1]), 0.187);

  const hipFar = [hip.x - 0.018, hip.y + 0.01];
  const kneeFar = add(hipFar, downDir(pose.legFar[0]), 0.245);
  const footFar = add(kneeFar, downDir(pose.legFar[0] - pose.legFar[1]), 0.275);

  const hipNear = [hip.x + 0.018, hip.y - 0.005];
  const kneeNear = add(hipNear, downDir(pose.legNear[0]), 0.248);
  const footNear = add(kneeNear, downDir(pose.legNear[0] - pose.legNear[1]), 0.278);

  const torsoPath = [[hip.x, hip.y], neck];
  const farArmPath = [armFarShoulder, elbowFar, handFar];
  const nearArmPath = [armNearShoulder, elbowNear, handNear];
  const farLegPath = [hipFar, kneeFar, footFar];
  const nearLegPath = [hipNear, kneeNear, footNear];

  const stepPhase = phase;
  const wobble = Math.sin(stepPhase * 1.3) * 0.012;

  // ---- floor contact shadow handled by the renderer; here only the figure ----

  // Scarves / ribbons behind the body.
  if (showScarf || showBand) {
    const ribbonColor = accent;
    const base = showScarf
      ? [neck[0] - 0.015, neck[1] + 0.012]
      : [head[0] - 0.075, head[1] - 0.012];
    const len = showScarf ? 0.2 : 0.13;
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = ribbonColor;
    ctx.lineWidth = showScarf ? 0.038 : 0.024;
    ctx.beginPath();
    ctx.moveTo(base[0], base[1]);
    for (let i = 1; i <= 3; i++) {
      const px = base[0] - len * (i / 3) + Math.sin(stepPhase * 7 + i * 1.2) * 0.015;
      const py = base[1] + 0.02 + i * 0.016 + Math.sin(stepPhase * 6 + i) * 0.008;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (showBand) {
      ctx.lineWidth = 0.028;
      ctx.beginPath();
      ctx.moveTo(head[0] - headR * 0.92, head[1] - 0.008);
      ctx.lineTo(head[0] + headR * 0.55, head[1] - 0.02);
      ctx.stroke();
    }
  }

  // ---- glow underlay ----
  const glowAlpha = (0.18 + flash * 0.55) * alpha;
  if (glowAlpha > 0.01) {
    const glowColor = flash > 0.25 ? '#ffffff' : accent;
    const gw = lineWidth * 3.1;
    strokePath(ctx, torsoPath, gw, glowColor, glowAlpha * 0.75);
    strokePath(ctx, farArmPath, gw * 0.9, glowColor, glowAlpha * 0.5);
    strokePath(ctx, nearArmPath, gw, glowColor, glowAlpha * 0.75);
    strokePath(ctx, farLegPath, gw * 0.9, glowColor, glowAlpha * 0.5);
    strokePath(ctx, nearLegPath, gw, glowColor, glowAlpha * 0.75);
    ctx.globalAlpha = alpha * glowAlpha * 0.35;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(head[0], head[1], headR * 1.55, 0, TAU);
    ctx.fill();
  }

  // ---- far side limbs ----
  strokePath(ctx, farLegPath, lineWidth * 0.92, far, alpha * 0.62);
  strokePath(ctx, farArmPath, lineWidth * 0.82, far, alpha * 0.62);

  // ---- torso ----
  strokePath(ctx, torsoPath, lineWidth, body, alpha);
  // chest notch for a little silhouette character
  strokePath(ctx, [[hip.x + 0.008, hip.y - 0.005], [shoulder[0], shoulder[1] - 0.01]], lineWidth * 0.55, body, alpha);

  // ---- head ----
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(head[0], head[1], headR, 0, TAU);
  ctx.fillStyle = dark;
  ctx.fill();
  ctx.strokeStyle = body;
  ctx.lineWidth = lineWidth * 0.9;
  ctx.stroke();

  // headband knot (drawn on top of head rim)
  if (showBand) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 0.026;
    ctx.beginPath();
    ctx.arc(head[0], head[1], headR, Math.PI * 1.08, Math.PI * 1.86);
    ctx.stroke();
  }

  // eyes
  if (eyes === 'dot') {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(head[0] + 0.038, head[1] - 0.004, 0.018, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.arc(head[0] + 0.038, head[1] - 0.004, 0.036, 0, TAU);
    ctx.fill();
  } else if (eyes === 'slit') {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 0.017;
    ctx.beginPath();
    ctx.moveTo(head[0] + 0.018, head[1] - 0.005);
    ctx.lineTo(head[0] + 0.065, head[1] - 0.012);
    ctx.stroke();
  }

  // ---- near side limbs ----
  strokePath(ctx, nearLegPath, lineWidth, body, alpha);
  strokePath(ctx, nearArmPath, lineWidth, body, alpha);

  // hands / feet caps add weight
  ctx.globalAlpha = alpha;
  ctx.fillStyle = body;
  for (const p of [handNear, handFar, footNear, footFar]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], lineWidth * 0.52, 0, TAU);
    ctx.fill();
  }

  // ---- attack swoosh ----
  if (swoosh && swoosh.t > 0 && swoosh.t < 1) {
    const tt = swoosh.t;
    const strength = Math.sin(clamp(tt, 0, 1) * Math.PI);
    if (swoosh.type === 'punch') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * strength * 0.5;
      ctx.strokeStyle = swoosh.color || accent;
      ctx.lineWidth = 0.028 + strength * 0.05;
      ctx.beginPath();
      ctx.arc(shoulder[0] + 0.05, shoulder[1], 0.4, -0.65, 0.55);
      ctx.stroke();
      ctx.globalAlpha = alpha * strength * 0.22;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.arc(shoulder[0] + 0.05, shoulder[1], 0.36, -0.55, 0.45);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    } else if (swoosh.type === 'kick') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * strength * 0.48;
      ctx.strokeStyle = swoosh.color || accent;
      ctx.lineWidth = 0.03 + strength * 0.06;
      ctx.beginPath();
      ctx.arc(hip.x, hip.y + 0.02, 0.55, -0.3, 0.9);
      ctx.stroke();
      ctx.globalAlpha = alpha * strength * 0.2;
      ctx.lineWidth = 0.15;
      ctx.beginPath();
      ctx.arc(hip.x, hip.y + 0.02, 0.48, -0.2, 0.8);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  ctx.restore();
}

export function drawGroundShadow(ctx, x, y, width, alpha = 0.32, squash = 1) {
  if (alpha <= 0.005) return;
  const r = width * 0.5;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  gradient.addColorStop(0.55, `rgba(0, 0, 0, ${alpha * 0.55})`);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.26 * squash + 0.04);
  ctx.translate(-x, -y);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}
