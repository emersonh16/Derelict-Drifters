// systems/drill.js

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

  // Hitbox tuning
  const hitboxLengthMult = 1.15; // 1.0 = exact visual length, >1 = longer reach
  const hitboxWidthMult  = 1.35; // 1.0 = exact visual width, >1 = wider hit area

  const halfW = (width * hitboxWidthMult) * 0.5;

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
  const tipX  = px + Math.cos(ang) * (safeOffset + length * hitboxLengthMult);
  const tipY  = py + Math.sin(ang) * (safeOffset + length * hitboxLengthMult);

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

export function carveObstaclesWithDrillTri(state, tri, dt, pad = 2) {
  const t = state.miasma.tile;
  const cols = state.miasma.cols;
  const rows = state.miasma.rows;
  const grid = state.obstacleGrid;
  if (!grid) return;

  const minCol = Math.floor((tri.aabb.minX - pad + state.miasma.halfCols * t) / t);
  const maxCol = Math.floor((tri.aabb.maxX + pad + state.miasma.halfCols * t) / t);
  const minRow = Math.floor((tri.aabb.minY - pad + state.miasma.halfRows * t) / t);
  const maxRow = Math.floor((tri.aabb.maxY + pad + state.miasma.halfRows * t) / t);

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;

      // Tile center point in world coords
      const cx = col * t - state.miasma.halfCols * t + t / 2;
      const cy = row * t - state.miasma.halfRows * t + t / 2;

      // Check if tile center is inside the triangle
      if (pointInTriangle({ x: cx, y: cy }, tri.a, tri.b, tri.c)) {
        if (grid[row * cols + col] === 1) {
          grid[row * cols + col] = 0;
        }
      }
    }
  }
}

// Helper: point-in-triangle test
function pointInTriangle(p, a, b, c) {
  const areaOrig = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  const area1 = Math.abs((a.x - p.x) * (b.y - p.y) - (b.x - p.x) * (a.y - p.y));
  const area2 = Math.abs((b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y));
  const area3 = Math.abs((c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y));
  return Math.abs(area1 + area2 + area3 - areaOrig) < 0.01;
}
