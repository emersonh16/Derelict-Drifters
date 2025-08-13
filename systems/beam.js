// systems/beam.js — half-size beam with distinct laser core

export function initBeam(state, opts = {}) {
  state.beam = {
    // control
    t: clamp(opts.startT ?? 0.7, 0, 1),
    step: opts.wheelStep ?? 0.05,

    // thresholds
    tNoBeamEnd: opts.tNoBeamEnd ?? 0.08,
    tBubbleEnd: opts.tBubbleEnd ?? 0.42,
    tConeEnd:   opts.tConeEnd   ?? 0.88,

    // bubble shape (HALVED)
    bubbleRMin: opts.bubbleRMin ?? 16,  // was 32
    bubbleRMax: opts.bubbleRMax ?? 90,  // was 180

    // cone/laser shape
    coneHalfArcWide:   toRad(opts.coneHalfArcWideDeg   ?? 60),
    coneHalfArcNarrow: toRad(opts.coneHalfArcNarrowDeg ?? 1.6),
    laserMinHalfArc:   toRad(0.22),

    // ranges (HALVED)
    baseRange:  opts.baseRange  ?? 150, // was 300
    laserRange: opts.laserRange ?? 240, // was 480
    bumpRange:  opts.bumpRange  ?? 20,  // was 40

    // laser visual tunables (TOP-LEVEL, not inside color)
    laserCoreWidth:   opts.laserCoreWidth   ?? 8,   // px
    laserOutlineMult: opts.laserOutlineMult ?? 2.0, // halo thickness = core * this
    laserTipRadius:   opts.laserTipRadius   ?? 14,  // px

    // live, published each frame
    mode: 'none',
    range: 0,
    halfArc: 0,
    angle: 0,
    radius: 0,

    // visuals
    color: {
      main0:  'rgba(255, 215, 0, 0.25)',
      main1:  'rgba(255, 215, 0, 0.12)',
      main2:  'rgba(255, 215, 0, 0.00)',
      laser0: 'rgba(255, 250, 210, 0.85)',
      laser1: 'rgba(255, 230, 140, 0.50)',
      laser2: 'rgba(255, 230, 140, 0.00)',
      tip:    'rgba(255, 253, 240, 0.95)',
      core:   'rgba(255, 255, 255, 0.95)', // bright inner line
      halo:   'rgba(255, 220, 120, 0.35)'  // soft outer halo
    }
  };
}

export function onWheelAdjust(state, deltaY) {
  const b = state.beam;
  b.t = clamp(b.t + Math.sign(deltaY) * b.step, 0, 1);
}

export function getBeamGeom(state, cx, cy) {
  const b = state.beam;
  const t = b.t;
  const ang = Math.atan2(state.mouse.y - cy, state.mouse.x - cx);

  if (t <= b.tNoBeamEnd) {
    return Object.assign(b, { mode: 'none', range: 0, halfArc: 0, angle: ang, radius: 0 });
  }

  if (t <= b.tBubbleEnd) {
    const u = invLerp(b.tNoBeamEnd, b.tBubbleEnd, t);
    const R = lerp(b.bubbleRMin, b.bubbleRMax, u);
    return Object.assign(b, { mode: 'bubble', radius: R, range: R, halfArc: Math.PI, angle: ang });
  }

  if (t <= b.tConeEnd) {
    const u = invLerp(b.tBubbleEnd, b.tConeEnd, t);
    const halfArc = lerp(b.coneHalfArcWide, b.coneHalfArcNarrow, u);
    const range = lerp(b.baseRange + b.bumpRange, b.laserRange, u); // narrower → farther
    return Object.assign(b, { mode: 'cone', range, halfArc, angle: ang, radius: 0 });
  }

  // laser
  const halfArc = Math.max(b.laserMinHalfArc, lerp(b.coneHalfArcNarrow, b.laserMinHalfArc, 1));
  return Object.assign(b, { mode: 'laser', range: b.laserRange, halfArc, angle: ang, radius: 0 });
}

export function drawBeam(ctx, state, cx, cy) {
  const b = state.beam;
  if (b.mode === 'none') return;
  if (b.mode === 'bubble') return drawCircle(ctx, cx, cy, b.radius, b);
  if (b.mode === 'cone')   return drawCone(ctx, cx, cy, b.halfArc, b.range, b);
  drawLaser(ctx, cx, cy, b.halfArc, b.range, b);
}

// ---- Drawing helpers ----
function drawCircle(ctx, cx, cy, R, b) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  g.addColorStop(0, b.color.main0);
  g.addColorStop(0.4, b.color.main1);
  g.addColorStop(1, b.color.main2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCone(ctx, cx, cy, halfArc, range, b) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, cy, range * 0.05, cx, cy, range);
  g.addColorStop(0, b.color.main0);
  g.addColorStop(0.4, b.color.main1);
  g.addColorStop(1, b.color.main2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, b.angle - halfArc, b.angle + halfArc);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLaser(ctx, cx, cy, halfArc, range, b) {
  const ang = b.angle;
  const x2 = cx + Math.cos(ang) * range;
  const y2 = cy + Math.sin(ang) * range;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // 1) Soft glow wedge (keeps your overall laser wash)
  const coneGlow = ctx.createRadialGradient(cx, cy, 4, cx, cy, range);
  coneGlow.addColorStop(0.00, b.color.laser0);
  coneGlow.addColorStop(0.35, b.color.laser1);
  coneGlow.addColorStop(1.00, b.color.laser2);
  ctx.fillStyle = coneGlow;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, ang - halfArc, ang + halfArc);
  ctx.closePath();
  ctx.fill();

  // 2) Outer halo line
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = b.color.halo;
  ctx.lineWidth = Math.max(1, b.laserCoreWidth * b.laserOutlineMult);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 3) Bright core line
  const coreGrad = ctx.createLinearGradient(cx, cy, x2, y2);
  coreGrad.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  coreGrad.addColorStop(0.70, 'rgba(255,245,210,0.95)');
  coreGrad.addColorStop(1.00, 'rgba(255,235,160,0.90)');
  ctx.strokeStyle = coreGrad; // or use: b.color.core
  ctx.lineWidth = b.laserCoreWidth;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // 4) Tip bloom
  const tipR = b.laserTipRadius;
  const tipGrad = ctx.createRadialGradient(x2, y2, 0, x2, y2, tipR);
  tipGrad.addColorStop(0.00, b.color.tip);
  tipGrad.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = tipGrad;
  ctx.beginPath();
  ctx.arc(x2, y2, tipR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---- Utils ----
function toRad(d) { return d * Math.PI / 180; }
function clamp(v, a, z) { return Math.max(a, Math.min(z, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function invLerp(a, b, v) { return clamp((v - a) / (b - a), 0, 1); }
