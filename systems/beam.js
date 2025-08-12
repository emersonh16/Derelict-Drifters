// Golden cone that scroll-adjusts width; hold LMB to force Laser Mode.

export function initBeam(state, opts = {}) {
  const halfArcDeg = opts.halfArcDeg ?? 16;
  state.beam = {
    // angular width
    halfArc: toRad(halfArcDeg),
    minHalfArc: toRad(opts.minHalfArcDeg ?? 1.0),   // narrow limit (~2° full cone)
    maxHalfArc: toRad(opts.maxHalfArcDeg ?? 60.0),  // wide limit (~120° full cone)
    stepDeg: opts.stepDeg ?? 2,                      // wheel sensitivity (degrees)

    // ranges
    baseRange: opts.range ?? 300,
    laserRange: opts.laserRange ?? 420,

    // colors
    color: {
      core: opts.color?.core ?? 'rgba(255,232,140,1)',
      glow: opts.color?.glow ?? 'rgba(255,215,0,1)',
      fill0: 'rgba(255,215,0,0.65)',
      fill1: 'rgba(255,215,0,0.35)',
      fill2: 'rgba(255,215,0,0.00)'
    },

    // mode
    laser: false
  };
}

export function onWheelAdjust(state, deltaY) {
  const b = state.beam;
  if (!b) return;
  // deltaY > 0 -> scroll down -> widen; deltaY < 0 -> tighten
  const dir = Math.sign(deltaY); // 1 widen, -1 tighten
  const next = b.halfArc + dir * toRad(b.stepDeg);
  b.halfArc = clamp(next, b.minHalfArc, b.maxHalfArc);
}

export function setLaser(state, on) {
  if (!state.beam) return;
  state.beam.laser = !!on;
}

export function drawBeam(ctx, state, cx, cy) {
  const b = state.beam;
  if (!b) return;

  // Effective params per mode
  const isLaser = b.laser || b.halfArc <= b.minHalfArc + 1e-6;
  const halfArc = isLaser ? Math.max(toRad(0.4), b.minHalfArc * 0.5) : b.halfArc;
  const range = isLaser ? b.laserRange : b.baseRange;

  const dx = state.mouse.x - cx;
  const dy = state.mouse.y - cy;
  const ang = Math.atan2(dy, dx);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Soft golden wedge
  const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, range);
  grad.addColorStop(0.00, b.color.fill0);
  grad.addColorStop(0.25, b.color.fill1);
  grad.addColorStop(1.00, b.color.fill2);
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, ang - halfArc, ang + halfArc);
  ctx.closePath();
  ctx.fill();

  // Bright core line
  ctx.shadowBlur = isLaser ? 18 : 12;
  ctx.shadowColor = b.color.glow;
  ctx.strokeStyle = b.color.core;
  ctx.lineWidth = isLaser ? 3.2 : 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ang) * range, cy + Math.sin(ang) * range);
  ctx.stroke();

  ctx.restore();
}

// ---- utils ----
function toRad(deg) { return (deg * Math.PI) / 180; }
function clamp(v, a, z) { return Math.max(a, Math.min(z, v)); }
