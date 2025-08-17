// systems/drill.js
/** @typedef {import('../core/state.js').DrillState} DrillState */

export function initDrill(player, opts = {}) {
  const r = player?.r ?? 18;
  /** @type {DrillState} */
  const drill = {
    length: opts.length ?? 55,                       // short & stout
    width:  opts.width  ?? Math.min(40, r * 1.8),    // chunky base
    offset: opts.offset ?? 0,

    // Damage per second (tune this!)
    dps:    opts.dps    ?? 700,

    fill:   opts.fill   ?? "#9ca3af",                // gray fill
    stroke: opts.stroke ?? "#4b5563",                // dark gray outline
    capFill:   opts.capFill   ?? "#6b7280",          // base cap fill
    capStroke: opts.capStroke ?? "#374151",          // base cap outline
    playerRadius: r
  };
  return drill;
}

export function drawDrill(ctx, drill, mouse, activeWeapon, cx, cy, overheated = false) {
  if (!drill || activeWeapon !== "drill") return;

  const { length, width, offset, fill, stroke, capFill, capStroke, playerRadius } = drill;
  const bodyFill = overheated ? "#ff5555" : fill;
  const bodyStroke = overheated ? "#aa0000" : stroke;
  const baseFill = overheated ? "#ff7777" : capFill;
  const baseStroke = overheated ? "#aa2222" : capStroke;

  // Aim in SCREEN space
  const ang = Math.atan2(mouse.y - cy, mouse.x - cx);

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
  ctx.fillStyle = bodyFill;
  ctx.fill();

  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = bodyStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Base cap
  const capR = width * 0.4; // slightly bigger for chunky look
  ctx.beginPath();
  ctx.arc(baseX, baseY, capR, 0, Math.PI * 2);
  ctx.fillStyle = baseFill;
  ctx.fill();
  ctx.strokeStyle = baseStroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/**
 * Returns the drill triangle in WORLD coordinates + its AABB.
 * Used for obstacle carving and enemy damage checks.
 */
export function getDrillTriangleWorld(drill, camera, mouse) {
  const { length, width, offset, playerRadius } = drill;

  // Hitbox tuning (visual helpers)
  const hitboxLengthMult = 1.15; // >1 = longer reach than visual
  const hitboxWidthMult  = 1.35; // >1 = wider than visual

  const halfW = (width * hitboxWidthMult) * 0.5;

  // Player world position
  const px = camera.x, py = camera.y;

  // Use window size for screen center (drill aims in screen space)
  const cx = (typeof window !== "undefined" ? window.innerWidth  * 0.5 : 0);
  const cy = (typeof window !== "undefined" ? window.innerHeight * 0.5 : 0);
  const ang = Math.atan2(mouse.y - cy, mouse.x - cx);

  // Keep base inside circle
  const safeOffset = Math.max(offset, playerRadius - halfW - 1);

  const baseX = px + Math.cos(ang) * safeOffset;
  const baseY = py + Math.sin(ang) * safeOffset;
  const tipX  = px + Math.cos(ang) * (safeOffset + length * hitboxLengthMult);
  const tipY  = py + Math.sin(ang) * (safeOffset + length * hitboxLengthMult);

  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const a = { x: baseX + nx * halfW, y: baseY + ny * halfW }; // left base
  const b = { x: tipX, y: tipY };                              // tip
  const c = { x: baseX - nx * halfW, y: baseY - ny * halfW };  // right base

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

