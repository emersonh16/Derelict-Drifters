export function initDrill(state, opts = {}) {
  const r = state.player?.r ?? 18;
  state.drill = {
    length: opts.length ?? 55,                   // short & stout
    width:  opts.width  ?? Math.min(40, r * 1.8), // chunky base
    offset: opts.offset ?? 0,
    fill:   opts.fill   ?? "#9ca3af",             // gray fill
    stroke: opts.stroke ?? "#4b5563",             // dark gray outline
    capFill:   opts.capFill   ?? "#6b7280",       // base cap fill
    capStroke: opts.capStroke ?? "#374151",       // base cap outline
    playerRadius: r
  };
}

export function drawDrill(ctx, state, cx, cy) {
  if (!state.drill || state.activeWeapon !== "drill") return;

  const { length, width, offset, fill, stroke, capFill, capStroke, playerRadius } = state.drill;

  // Aim in SCREEN space
  const ang = Math.atan2(state.mouse.y - cy, state.mouse.x - cx);

  // Keep base inside derelict circle
  const safeOffset = Math.max(offset, playerRadius - (width / 2) - 1);

  // Geometry
  const baseX = cx + Math.cos(ang) * safeOffset;
  const baseY = cy + Math.sin(ang) * safeOffset;
  const tipX  = cx + Math.cos(ang) * (safeOffset + length);
  const tipY  = cy + Math.sin(ang) * (safeOffset + length);

  const halfW = width * 0.5;
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const bLx = baseX + nx * halfW, bLy = baseY + ny * halfW;
  const bRx = baseX - nx * halfW, bRy = baseY - ny * halfW;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Cone shape
  ctx.beginPath();
  ctx.moveTo(bLx, bLy);
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(bRx, bRy);
  ctx.closePath();

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Base cap
  const capR = width * 0.4; // slightly bigger for chunky look
  ctx.beginPath();
  ctx.arc(baseX, baseY, capR, 0, Math.PI * 2);
  ctx.fillStyle = capFill;
  ctx.fill();
  ctx.strokeStyle = capStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}
