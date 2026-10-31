import { TAU, clamp, lerp, easeOutCubic, easeOutQuint, easeInCubic, span } from './utils.js';

const BASE_HIP = -54;
const TORSO = 43;
const NECK = 51;
const HEAD_RADIUS = 13;
const UPPER_ARM = 24;
const FOREARM = 23;
const THIGH = 28;
const SHIN = 28;

function basePose() {
  return {
    hipX: 0,
    hipY: BASE_HIP,
    lean: 0.03,
    headTilt: 0,
    armFront: [0.2, 0.06],
    armBack: [-0.15, 0.1],
    legFront: [0.18, -0.15],
    legBack: [-0.18, 0.13],
    rotation: 0,
    rotationPivot: -58,
    scarf: 0,
    headScale: 1,
  };
}

function poseFor(char) {
  const pose = basePose();
  const t = char.animTime;
  let state = char.state;
  if (state === 'approach' || state === 'recover') state = Math.abs(char.vx) > 15 ? 'run' : 'idle';
  else if (state === 'spawn') state = char.spawnMode === 'drop' ? 'fall' : 'run';
  else if (state === 'idle') state = 'idle';
  const p = char.stateDuration > 0 ? clamp(char.stateTime / char.stateDuration, 0, 1) : 0;

  if (state === 'idle') {
    const breath = Math.sin(t * 2.8) * 0.9;
    pose.hipY = BASE_HIP + breath * 0.35;
    pose.lean = 0.03 + Math.sin(t * 2.8) * 0.008;
    pose.armFront = [0.22 + Math.sin(t * 2.8) * 0.035, 0.05];
    pose.armBack = [-0.14 - Math.sin(t * 2.8) * 0.035, 0.13];
    pose.headTilt = Math.sin(t * 1.7) * 0.03;
  } else if (state === 'run') {
    const phase = t * 13.2;
    const swing = Math.sin(phase);
    pose.hipY = BASE_HIP - 7 + Math.abs(Math.cos(phase)) * 2.2;
    pose.lean = 0.22;
    pose.headTilt = 0.06;
    pose.legFront = [0.72 * swing, -0.42 - Math.max(0, -swing) * 0.55];
    pose.legBack = [-0.72 * swing, -0.42 - Math.max(0, swing) * 0.55];
    pose.armFront = [-0.85 * swing, -0.85 * swing + 0.85];
    pose.armBack = [0.85 * swing, 0.85 * swing + 0.85];
    pose.scarf = clamp(-swing, 0, 1);
  } else if (state === 'jump' || state === 'fall') {
    const rising = state === 'jump';
    pose.hipY = BASE_HIP - 4;
    pose.lean = rising ? 0.14 : -0.05;
    pose.legFront = rising ? [0.85, -0.72] : [0.5, -0.35];
    pose.legBack = rising ? [-0.35, 0.45] : [-0.45, 0.35];
    pose.armFront = rising ? [0.85, 1.25] : [0.55, 0.8];
    pose.armBack = rising ? [-0.55, -0.85] : [-0.7, -0.5];
    pose.scarf = 1;
  } else if (state === 'crouch') {
    pose.hipY = -36;
    pose.lean = 0.36;
    pose.headTilt = 0.13;
    pose.legFront = [1.02, 0.72];
    pose.legBack = [-0.98, -0.7];
    pose.armFront = [0.55, 1.2];
    pose.armBack = [-0.25, -0.7];
    pose.headScale = 1.02;
  } else if (state === 'wall') {
    pose.hipY = BASE_HIP - 1;
    pose.lean = -0.18;
    pose.legFront = [0.5, 0.12];
    pose.legBack = [-0.22, 0.42];
    pose.armFront = [1.05, 1.45];
    pose.armBack = [-1.75, -1.35];
    pose.headTilt = -0.1;
    pose.scarf = 0.5;
  } else if (state === 'attack' || state === 'heavy') {
    const kind = char.attackKind || state;
    const strike = kind === 'heavy' ? span(p, 0.42, 0.58) : span(p, 0.18, 0.42);
    const recover = kind === 'heavy' ? span(p, 0.62, 1) : span(p, 0.5, 1);
    const windup = kind === 'heavy' ? span(p, 0, 0.4) : span(p, 0, 0.18);
    const extend = easeOutCubic(strike) * (1 - easeInCubic(recover));
    const coil = easeOutCubic(windup) * (1 - easeOutCubic(strike));
    const alternate = (char.attackChain || 0) % 2;
    const isFront = alternate === 0;
    const punchAngle = kind === 'heavy' ? 1.5 : 1.56;
    const windAngle = kind === 'heavy' ? -1.25 : -0.85;

    pose.lean = 0.08 + coil * -0.2 + extend * 0.3;
    pose.hipY = BASE_HIP + extend * 2;
    const punchingArm = [lerp(windAngle, punchAngle, extend), lerp(windAngle + 0.6, punchAngle, extend)];
    const guardArm = [lerp(-0.1, -0.55, extend), lerp(0.5, -0.2, extend)];
    if (isFront) {
      pose.armFront = punchingArm;
      pose.armBack = guardArm;
    } else {
      pose.armBack = punchingArm;
      pose.armFront = guardArm;
    }
    if (kind === 'heavy') {
      pose.hipY = BASE_HIP + 1;
      pose.legFront = [0.35 + extend * 0.2, -0.15];
      pose.legBack = [-0.45 - extend * 0.25, 0.1];
      pose.rotation = 0;
      pose.headTilt = 0.08;
    } else {
      pose.legFront = [0.22, -0.2];
      pose.legBack = [-0.25, 0.14];
    }
    pose.scarf = extend;
  } else if (state === 'dragon') {
    const rise = easeOutQuint(span(p, 0.12, 0.58));
    const land = easeInCubic(span(p, 0.7, 1));
    pose.hipY = BASE_HIP + 8 - rise * 4 + land * 2;
    pose.lean = -0.25 + rise * 0.1;
    pose.armFront = [lerp(-0.5, 2.55, rise), lerp(0.2, 2.62, rise)];
    pose.armBack = [lerp(-0.8, -0.25, rise), lerp(-1.3, -0.7, rise)];
    pose.legFront = [0.15 + rise * 0.4, -0.4 - rise * 0.3];
    pose.legBack = [-0.4, 0.55];
    pose.headTilt = -0.08 * rise;
    pose.scarf = 1;
  } else if (state === 'spin') {
    pose.rotation = char.spinAngle || 0;
    pose.rotationPivot = -58;
    pose.hipY = BASE_HIP - 6;
    pose.lean = 0.16;
    pose.armFront = [1.55, 1.75];
    pose.armBack = [-1.5, -1.72];
    pose.legFront = [0.75, 0.35];
    pose.legBack = [-0.9, -0.5];
    pose.scarf = 1;
  } else if (state === 'dive') {
    pose.rotation = 0.42;
    pose.rotationPivot = -60;
    pose.hipY = BASE_HIP - 2;
    pose.lean = 0.22;
    pose.armFront = [1.8, 2.15];
    pose.armBack = [-1.4, -1.05];
    pose.legFront = [1.22, 1.5];
    pose.legBack = [-0.8, -0.35];
    pose.headTilt = 0.1;
    pose.scarf = 1;
  } else if (state === 'grab' || state === 'airgrab') {
    pose.hipY = BASE_HIP - 1;
    pose.lean = 0.15;
    pose.armFront = [1.5, 1.62];
    pose.armBack = [1.1, 1.5];
    pose.legFront = [0.35, -0.3];
    pose.legBack = [-0.4, 0.2];
    pose.headTilt = 0.04;
  } else if (state === 'throw') {
    const wind = span(p, 0, 0.24);
    const launch = span(p, 0.24, 0.48);
    const follow = span(p, 0.55, 1);
    pose.lean = 0.1 - easeOutCubic(wind) * 0.3 + easeOutCubic(launch) * 0.55 - follow * 0.2;
    pose.armFront = [lerp(-1.2, 1.75, easeOutQuint(launch)), lerp(-0.8, 1.7, easeOutQuint(launch))];
    pose.armBack = [-0.6, -0.2];
    pose.legFront = [0.35 + launch * 0.25, -0.2];
    pose.legBack = [-0.5, 0.2];
    pose.headTilt = 0.1;
    pose.scarf = 1;
  } else if (state === 'suplex') {
    pose.rotation = lerp(0.05, -0.55, easeOutCubic(span(p, 0, 0.5)));
    pose.rotationPivot = -58;
    pose.hipY = BASE_HIP;
    pose.lean = 0.35;
    pose.armFront = [2.5, 2.8];
    pose.armBack = [2.35, 2.7];
    pose.legFront = [0.75, 0.5];
    pose.legBack = [-0.5, -0.2];
    pose.headTilt = 0.1;
    pose.scarf = 1;
  } else if (state === 'special') {
    const charge = easeOutCubic(span(p, 0, 0.18));
    const kick = easeOutCubic(span(p, 0.14, 0.42));
    const settle = easeInCubic(span(p, 0.72, 1));
    pose.hipY = BASE_HIP - 14 * kick + settle * 6;
    pose.lean = -0.18 + kick * 0.45;
    pose.rotation = charge * 0.06;
    pose.armFront = [lerp(-1.0, -0.35, kick), lerp(0.8, 1.1, kick)];
    pose.armBack = [lerp(1.2, -1.4, kick), lerp(1.5, -1.0, kick)];
    pose.legFront = [lerp(0.2, 1.55, kick), lerp(-0.2, 1.62, kick)];
    pose.legBack = [lerp(-0.3, -0.55, kick), lerp(0.1, -0.25, kick)];
    pose.headTilt = 0.12;
    pose.scarf = 1;
  } else if (state === 'hurt') {
    const recoil = 1 - easeOutCubic(span(p, 0, 0.7));
    pose.hipY = BASE_HIP + recoil * 3;
    pose.lean = -0.45 * recoil;
    pose.armFront = [-0.8, -1.25];
    pose.armBack = [-1.1, -1.5];
    pose.legFront = [0.5, 0.25];
    pose.legBack = [-0.35, -0.15];
    pose.headTilt = -0.18 * recoil;
  } else if (state === 'windup') {
    const coil = easeOutCubic(clamp(p, 0, 1));
    pose.hipY = BASE_HIP + 3 + coil * 3;
    pose.lean = -0.16 - coil * 0.1;
    pose.armFront = [-0.4 - coil * 0.9, 0.3 - coil * 0.5];
    pose.armBack = [-0.75 - coil * 0.45, -0.4 - coil * 0.4];
    pose.legFront = [0.35, -0.25];
    pose.legBack = [-0.5, 0.3];
    pose.headTilt = -0.1;
  } else if (state === 'ragdoll' || state === 'dead') {
    const flail = t * 18 + (char.seed || 0);
    pose.hipY = BASE_HIP;
    pose.lean = 0.1;
    pose.rotation = char.rot || 0;
    pose.rotationPivot = -58;
    pose.armFront = [0.8 + Math.sin(flail) * 0.7, 1.2 + Math.sin(flail + 1.7) * 0.9];
    pose.armBack = [-0.9 + Math.sin(flail + 2.1) * 0.65, -1.4 + Math.sin(flail + 0.8) * 0.8];
    pose.legFront = [0.65 + Math.sin(flail + 1.2) * 0.55, 0.25 + Math.sin(flail + 2.6) * 0.6];
    pose.legBack = [-0.7 + Math.sin(flail + 2.5) * 0.5, -0.25 + Math.sin(flail + 0.3) * 0.55];
  } else if (state === 'grabbed') {
    const struggle = Math.sin(t * 24 + (char.seed || 0));
    pose.hipY = -52;
    pose.lean = -0.15 + struggle * 0.08;
    pose.armFront = [1.1 + struggle * 0.4, 1.8 + struggle * 0.3];
    pose.armBack = [-1.2 - struggle * 0.3, -1.8 - struggle * 0.2];
    pose.legFront = [0.7 + struggle * 0.25, 0.9];
    pose.legBack = [-0.6 + struggle * 0.25, 0.7];
    pose.headTilt = -0.15;
  } else if (state === 'taunt') {
    pose.hipY = BASE_HIP;
    pose.lean = -0.08;
    pose.armFront = [2.3, 2.8];
    pose.armBack = [-0.4, -0.1];
    pose.legFront = [0.25, -0.2];
    pose.legBack = [-0.25, 0.15];
    pose.headTilt = -0.08;
  }

  return pose;
}

function pointFrom(origin, angle, length) {
  return {
    x: origin.x + Math.sin(angle) * length,
    y: origin.y + Math.cos(angle) * length,
  };
}

function buildSkeleton(char, pose) {
  const hip = { x: pose.hipX, y: pose.hipY };
  const chest = { x: hip.x + pose.lean * 20, y: hip.y - TORSO * 0.66 };
  const neck = { x: hip.x + pose.lean * TORSO, y: hip.y - NECK };
  const head = { x: neck.x + pose.lean * 11 + pose.headTilt * 8, y: neck.y - 16 };
  const shoulder = { x: neck.x, y: neck.y + 1 };

  const kneeF = pointFrom(hip, pose.legFront[0], THIGH);
  const footF = pointFrom(kneeF, pose.legFront[1], SHIN);
  const kneeB = pointFrom(hip, pose.legBack[0], THIGH);
  const footB = pointFrom(kneeB, pose.legBack[1], SHIN);

  const elbowF = pointFrom(shoulder, pose.armFront[0], UPPER_ARM);
  const handF = pointFrom(elbowF, pose.armFront[1], FOREARM);
  const elbowB = pointFrom(shoulder, pose.armBack[0], UPPER_ARM);
  const handB = pointFrom(elbowB, pose.armBack[1], FOREARM);

  return { hip, chest, neck, head, shoulder, kneeF, footF, kneeB, footB, elbowF, handF, elbowB, handB };
}

function polyline(ctx, points, width, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawLimb(ctx, a, b, c, width, color, outline, alpha, jointColor) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = outline;
  ctx.lineWidth = width + 4.5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();

  if (jointColor) {
    ctx.fillStyle = jointColor;
    ctx.beginPath();
    ctx.arc(b.x, b.y, width * 0.46, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawStickman(ctx, char, view = {}) {
  const scale = char.scale || 1;
  const groundY = view.groundY || 0;
  const heightAbove = Math.max(0, groundY - char.y);
  const shadowScale = clamp(1 - heightAbove / 430, 0.3, 1);
  const airborne = char.y < groundY - 1 || (!char.onGround && char.state !== 'ragdoll' && char.state !== 'dead');

  // Ground shadow
  if (char.state !== 'grabbed') {
    ctx.save();
    ctx.globalAlpha = 0.35 * shadowScale;
    ctx.fillStyle = '#00040c';
    ctx.beginPath();
    ctx.ellipse(char.x, groundY + 2, 28 * scale * shadowScale, 6.2 * scale * shadowScale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  if (char.state === 'dead' && char.alpha <= 0.01) return;

  const palette = char.palette;
  const flash = char.flash > 0;
  const main = flash ? '#ffffff' : palette.main;
  const light = flash ? '#ffffff' : palette.light;
  const dark = palette.outline;
  const accent = flash ? '#ffffff' : palette.accent;
  const pose = poseFor(char);
  const joints = buildSkeleton(char, pose);
  const alpha = char.alpha === undefined ? 1 : char.alpha;

  // Aura / glow behind body
  if (char.aura !== false) {
    const auraRadius = 56 * scale * (char.auraScale || 1);
    const aura = ctx.createRadialGradient(char.x, char.y - 58 * scale, 2, char.x, char.y - 58 * scale, auraRadius);
    aura.addColorStop(0, `${palette.glow}${char.player ? '38' : '18'}`);
    aura.addColorStop(1, `${palette.glow}00`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = aura;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(char.x, char.y - 58 * scale, auraRadius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(char.x, char.y);
  ctx.scale((char.facing || 1) * scale, scale);
  ctx.globalAlpha = alpha;
  if ((char.state === 'ragdoll' || char.state === 'dead') && char.y >= groundY - 2) {
    ctx.translate(0, Math.abs(Math.sin(pose.rotation || 0)) * 40);
  }
  if (pose.rotation) {
    ctx.translate(0, pose.rotationPivot);
    ctx.rotate(pose.rotation);
    ctx.translate(0, -pose.rotationPivot);
  }

  // Energy scarf: two thin trailing strands, only while the player is in motion.
  const scarfStates = ['run', 'jump', 'fall', 'dive', 'special', 'suplex', 'spin', 'dragon', 'throw', 'wall', 'hurt'];
  const scarfSpeed = clamp(Math.abs(char.vx || 0) / 400, 0, 1);
  if (char.scarf !== false && (char.player || char.state === 'special') && (scarfSpeed > 0.06 || scarfStates.includes(char.state))) {
    const wave = Math.sin((char.animTime || 0) * 9) * 3.4;
    const length = 26 + scarfSpeed * 40 + (scarfStates.includes(char.state) ? 8 : 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.shadowColor = accent;
    ctx.shadowBlur = 9;

    // Long upper strand
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.55 + scarfSpeed * 0.35;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(joints.neck.x - 1, joints.neck.y + 4);
    ctx.quadraticCurveTo(-length * 0.32, joints.neck.y + 6 + wave * 0.5, -length, joints.neck.y + 11 + wave);
    ctx.stroke();

    // Short lower strand, slightly offset for a ribbon silhouette
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.4 + scarfSpeed * 0.3;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(joints.neck.x - 2, joints.neck.y + 10);
    ctx.quadraticCurveTo(-length * 0.26, joints.neck.y + 15 - wave * 0.4, -length * 0.72, joints.neck.y + 20 + wave * 0.7);
    ctx.stroke();

    // Faint tapered tip
    ctx.globalAlpha = 0.25 + scarfSpeed * 0.25;
    ctx.lineWidth = 1;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-length * 0.78, joints.neck.y + 12 + wave * 0.8);
    ctx.lineTo(-length * 1.04, joints.neck.y + 15 + wave * 1.25);
    ctx.stroke();
    ctx.restore();
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const bodyWidth = char.heavy ? 7.2 : 6.2;
  const backAlpha = char.state === 'dead' ? 0.65 : 0.82;

  // Back arm & leg
  drawLimb(ctx, joints.shoulder, joints.elbowB, joints.handB, bodyWidth * 0.82, dark, dark, backAlpha);
  drawLimb(ctx, joints.hip, joints.kneeB, joints.footB, bodyWidth * 0.98, palette.back, dark, backAlpha);

  // Torso
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.lineWidth = bodyWidth + 5;
  ctx.beginPath();
  ctx.moveTo(joints.hip.x, joints.hip.y);
  ctx.lineTo(joints.chest.x, joints.chest.y);
  ctx.lineTo(joints.neck.x, joints.neck.y);
  ctx.stroke();
  if (char.player) {
    ctx.strokeStyle = main;
    ctx.lineWidth = bodyWidth + 1;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 13;
  } else {
    ctx.strokeStyle = main;
    ctx.lineWidth = bodyWidth;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 7;
  }
  ctx.beginPath();
  ctx.moveTo(joints.hip.x, joints.hip.y);
  ctx.lineTo(joints.chest.x, joints.chest.y);
  ctx.lineTo(joints.neck.x, joints.neck.y);
  ctx.stroke();
  ctx.restore();

  // Chest core light
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.5 + Math.sin((char.animTime || 0) * 5) * 0.12;
  ctx.beginPath();
  ctx.arc(joints.chest.x + 2, joints.chest.y + 1, char.heavy ? 3.4 : 2.6, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Front leg
  drawLimb(ctx, joints.hip, joints.kneeF, joints.footF, bodyWidth * 1.04, main, dark, 1, accent);

  // Head
  ctx.save();
  ctx.translate(joints.head.x, joints.head.y);
  ctx.rotate(pose.headTilt * 0.5);
  ctx.scale(pose.headScale, pose.headScale);
  ctx.fillStyle = char.player ? 'rgba(3, 22, 32, 0.95)' : 'rgba(8, 6, 12, 0.95)';
  ctx.strokeStyle = dark;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, HEAD_RADIUS + 2.2, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = palette.glow;
  ctx.shadowBlur = char.player ? 16 : 8;
  ctx.strokeStyle = light;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(0, 0, HEAD_RADIUS, 0, TAU);
  ctx.stroke();

  // Visor / eye
  ctx.shadowBlur = 10;
  ctx.fillStyle = light;
  if (char.player) {
    ctx.beginPath();
    ctx.roundRect(1.5, -3.8, 8.5, 2.6, 1.3);
    ctx.fill();
  } else if (char.heavy) {
    ctx.beginPath();
    ctx.moveTo(-4.5, -3.5);
    ctx.lineTo(6.5, -1.5);
    ctx.lineTo(-4.5, 1.2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(4.2, -2.2, 1.9, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Front arm
  drawLimb(ctx, joints.shoulder, joints.elbowF, joints.handF, bodyWidth, main, dark, 1, accent);

  // Hand energy for player attacks
  if (char.player && (char.state === 'attack' || char.state === 'heavy' || char.state === 'dragon' || char.state === 'throw')) {
    const progress = char.stateDuration ? char.stateTime / char.stateDuration : 0;
    if (progress > 0.25 && progress < 0.75) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = ctx.createRadialGradient(joints.handF.x, joints.handF.y, 0, joints.handF.x, joints.handF.y, 18);
      glow.addColorStop(0, 'rgba(220,255,255,.9)');
      glow.addColorStop(0.3, 'rgba(57,245,255,.5)');
      glow.addColorStop(1, 'rgba(57,245,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(joints.handF.x, joints.handF.y, 18, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // Heavy armor shield
  if (char.armored && char.state !== 'ragdoll' && char.state !== 'dead' && char.state !== 'grabbed') {
    const pulse = 0.5 + Math.sin((char.animTime || 0) * 3.4) * 0.2;
    ctx.save();
    ctx.translate(0, -64);
    ctx.strokeStyle = `rgba(255, 211, 77, ${0.2 + pulse * 0.25})`;
    ctx.fillStyle = `rgba(255, 211, 77, ${(char.shieldFlash > 0 ? 0.18 : 0.035) + pulse * 0.02})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const x = Math.cos(angle) * 38;
      const y = Math.sin(angle) * 53;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (char.shieldFlash > 0) {
      ctx.globalAlpha = char.shieldFlash;
      ctx.strokeStyle = '#fff6c8';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Electric arcs around player when charged / special
  if (char.player && (char.state === 'special' || char.charged)) {
    const count = char.state === 'special' ? 4 : 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(140,250,255,.8)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < count; i += 1) {
      const angle = (char.animTime || 0) * 9 + i * 2.1;
      const radius = 28 + (i % 2) * 10;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius, -62 + Math.sin(angle) * radius * 0.8);
      ctx.lineTo(Math.cos(angle + 0.7) * (radius + 9), -62 + Math.sin(angle + 0.7) * (radius + 9));
      ctx.lineTo(Math.cos(angle + 1.2) * radius, -62 + Math.sin(angle + 1.2) * radius * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();

  // Status UI above enemies
  if (!char.player && char.state !== 'dead' && char.state !== 'grabbed') {
    const barW = char.heavy ? 58 : 43;
    const y = char.y - (char.heavy ? 176 : 148) * scale;
    const x = char.x;
    if (char.state !== 'ragdoll') {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(2, 5, 12, 0.82)';
      ctx.fillRect(x - barW / 2 - 1, y - 1, barW + 2, 6);
      const health = clamp(char.hp / char.maxHp, 0, 1);
      ctx.fillStyle = char.heavy ? '#ffd34d' : '#ff445c';
      ctx.shadowColor = char.heavy ? '#ffd34d' : '#ff445c';
      ctx.shadowBlur = 7;
      ctx.fillRect(x - barW / 2, y, barW * health, 4);
      if (char.heavy) {
        ctx.strokeStyle = 'rgba(255,211,77,.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - barW / 2 - 0.5, y - 0.5, barW + 1, 5);
      }
      ctx.restore();
    }

    if (char.state === 'windup') {
      const bob = Math.sin((char.animTime || 0) * 17) * 2;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = '900 19px "Bahnschrift", "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = char.heavy ? '#ffd34d' : '#ff5566';
      ctx.shadowColor = char.heavy ? '#ffb800' : '#ff2040';
      ctx.shadowBlur = 14;
      ctx.fillText('!', x, y - 18 + bob);
      ctx.restore();
    }
  }
}
