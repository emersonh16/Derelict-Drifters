// Simple translucent beam: no beam → bubble → cone → laser

export function initBeam(state, opts = {}) {
  state.beam = {
    t: clamp(opts.startT ?? 0.7, 0, 1),
    step: opts.wheelStep ?? 0.05,
    tNoBeamEnd: opts.tNoBeamEnd ?? 0.08,
    tBubbleEnd: opts.tBubbleEnd ?? 0.42,
    tConeEnd:   opts.tConeEnd   ?? 0.88,
    bubbleRMin: opts.bubbleRMin ?? 32,
    bubbleRMax: opts.bubbleRMax ?? 180,
    coneHalfArcWide:   toRad(opts.coneHalfArcWideDeg   ?? 60),
    coneHalfArcNarrow: toRad(opts.coneHalfArcNarrowDeg ?? 1.6),
    baseRange:  opts.baseRange  ?? 300,
    laserRange: opts.laserRange ?? 480,
    // shared translucent look
    color: {
      main0: 'rgba(255, 215, 0, 0.25)', // light gold, faint
      main1: 'rgba(255, 215, 0, 0.12)',
      main2: 'rgba(255, 215, 0, 0.00)',
      laser0: 'rgba(255, 250, 210, 0.85)',
      laser1: 'rgba(255, 230, 140, 0.50)',
      laser2: 'rgba(255, 230, 140, 0.00)',
      tip:    'rgba(255, 253, 240, 0.95)'
    },
    laserMinHalfArc: toRad(0.22),
    laserPulseAmp: 0.06,
    laserPulseHz: 7.0
  };
}

export function onWheelAdjust(state, deltaY) {
  const b = state.beam; if (!b) return;
  b.t = clamp(b.t + Math.sign(deltaY) * b.step, 0, 1);
}

export function drawBeam(ctx, state, cx, cy) {
  const b = state.beam; if (!b) return;
  const t = b.t;

  if (t <= b.tNoBeamEnd) return;

  if (t <= b.tBubbleEnd) {
    const u = invLerp(b.tNoBeamEnd, b.tBubbleEnd, t);
    const R = lerp(b.bubbleRMin, b.bubbleRMax, u);
    drawCircle(ctx, cx, cy, R, b);
    return;
  }

  if (t <= b.tConeEnd) {
    const u = invLerp(b.tBubbleEnd, b.tConeEnd, t);
    const halfArc = lerp(b.coneHalfArcWide, b.coneHalfArcNarrow, u);
    drawCone(ctx, state, cx, cy, halfArc, b.baseRange, b);
    return;
  }

  const u = invLerp(b.tConeEnd, 1, t);
  const halfArc = Math.max(b.laserMinHalfArc, lerp(b.coneHalfArcNarrow, b.laserMinHalfArc, 0.8 + 0.2*u));
  const range   = lerp(b.baseRange, b.laserRange, 0.9);
  drawLaser(ctx, state, cx, cy, halfArc, range, b, state.time);
}

// ---- Shapes ----
function drawCircle(ctx, cx, cy, R, b) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
  grad.addColorStop(0.00, b.color.main0);
  grad.addColorStop(0.40, b.color.main1);
  grad.addColorStop(1.00, b.color.main2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCone(ctx, state, cx, cy, halfArc, range, b) {
  const ang = Math.atan2(state.mouse.y - cy, state.mouse.x - cx);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(cx, cy, range * 0.05, cx, cy, range);
  grad.addColorStop(0.00, b.color.main0);
  grad.addColorStop(0.40, b.color.main1);
  grad.addColorStop(1.00, b.color.main2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, ang - halfArc, ang + halfArc);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawLaser(ctx, state, cx, cy, halfArc, range, b, time) {
  const ang = Math.atan2(state.mouse.y - cy, state.mouse.x - cx);
  const pulse = 1 + b.laserPulseAmp * Math.sin(time * Math.PI * 2 * b.laserPulseHz);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, range);
  grad.addColorStop(0.00, withA(b.color.laser0, 0.95 * pulse));
  grad.addColorStop(0.35, withA(b.color.laser1, 0.70 * pulse));
  grad.addColorStop(1.00, withA(b.color.laser2, 1.00));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, ang - halfArc, ang + halfArc);
  ctx.closePath();
  ctx.fill();
  const tipX = cx + Math.cos(ang) * range;
  const tipY = cy + Math.sin(ang) * range;
  const tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 16);
  tipGrad.addColorStop(0.00, b.color.tip);
  tipGrad.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = tipGrad;
  ctx.beginPath();
  ctx.arc(tipX, tipY, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Utils ----
function toRad(deg) { return (deg * Math.PI) / 180; }
function clamp(v, a, z) { return Math.max(a, Math.min(z, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function invLerp(a, b, v) { return clamp((v - a) / (b - a), 0, 1); }
function withA(rgba, a) {
  return rgba.replace(/rgba\(([^)]+),\s*([0-9.]+)\)/, `rgba($1,${a})`);
}
