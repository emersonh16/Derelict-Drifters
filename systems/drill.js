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


export function getDrillTriangleWorld(state) {
  const { length, width, offset, playerRadius } = state.drill;
  const halfW = width * 0.5;

  // Player world position
  const px = state.camera.x, py = state.camera.y;

  // Use window size for screen center (drill aims in screen space)
  const cx = (typeof window !== "undefined" ? window.innerWidth  * 0.5 : 0);
  const cy = (typeof window !== "undefined" ? window.innerHeight * 0.5 : 0);
  const ang = Math.atan2(state.mouse.y - cy, state.mouse.x - cx);

  // Keep base inside circle
  const safeOffset = Math.max(offset, playerRadius - halfW - 1);

  const baseX = px + Math.cos(ang) * safeOffset;
  const baseY = py + Math.sin(ang) * safeOffset;
  const tipX  = px + Math.cos(ang) * (safeOffset + length);
  const tipY  = py + Math.sin(ang) * (safeOffset + length);

  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const a = { x: baseX + nx * halfW, y: baseY + ny * halfW };
  const b = { x: tipX, y: tipY };
  const c = { x: baseX - nx * halfW, y: baseY - ny * halfW };

  return {
    a, b, c,
    aabb: {
      minX: Math.min(a.x, b.x, c.x),
      maxX: Math.max(a.x, b.x, c.x),
      minY: Math.min(a.y, b.y, c.y),
      maxY: Math.max(a.y, b.y, c.y)
    }
  };
}

