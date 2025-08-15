// systems/world.js

export function initWorld(state, opts = {}) {
  const s = state.miasma, t = s.tile;
  state.world = {
    minX: -s.halfCols * t,
    maxX:  s.halfCols * t,
    minY: -s.halfRows * t,
    maxY:  s.halfRows * t,
    borderThickness: opts.borderThickness ?? 80,
    borderColor: opts.borderColor ?? 'rgba(120, 60, 160, 0.7)'
  };

  // --- Obstacles ---
  state.obstacles = [];
  spawnObstacles(state, opts.obstacleCount ?? 40, t);
}

function spawnObstacles(state, count, tileSize) {
  const w = state.world;
  for (let i = 0; i < count; i++) {
    const shape = Math.random() < 0.5 ? "circle" : "rect";
    const x = randRange(w.minX + 50, w.maxX - 50);
    const y = randRange(w.minY + 50, w.maxY - 50);

if (shape === "circle") {
  state.obstacles.push({
    shape,
    x, y,
    // Bigger base size + more variation
    r: tileSize * (8 + Math.random() * 6) // 8–14 tiles in radius
  });
} else {
  // Random rectangles with bigger min/max
  const rectW = tileSize * (10 + Math.random() * 8); // 10–18 tiles wide
  const rectH = tileSize * (10 + Math.random() * 8); // 10–18 tiles tall
  state.obstacles.push({
    shape,
    x, y,
    w: rectW,
    h: rectH
  });

}

  }
}

export function clampToWorld(state) {
  const w = state.world; if (!w) return;
  const r = state.player?.r ?? 18;

  state.camera.x = clamp(state.camera.x, w.minX + r, w.maxX - r);
  state.camera.y = clamp(state.camera.y, w.minY + r, w.maxY - r);
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

// --- Drawing ---
export function drawWorldBorder(ctx, state, cx, cy) {
  const w = state.world;
  if (!w) return;

  const thickness = w.borderThickness;
  const color = w.borderColor;

  ctx.save();
  ctx.fillStyle = color;

  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.minY - thickness - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );

  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.maxY - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );

  ctx.fillRect(
    w.minX - thickness - state.camera.x + cx,
    w.minY - state.camera.y + cy,
    thickness,
    (w.maxY - w.minY)
  );

  ctx.fillRect(
    w.maxX - state.camera.x + cx,
    w.minY - state.camera.y + cy,
    thickness,
    (w.maxY - w.minY)
  );

  ctx.restore();
}

export function drawObstacles(ctx, state, cx, cy) {
  const px = state.camera.x;
  const py = state.camera.y;

  ctx.save();
  ctx.fillStyle = "#444";

  for (const o of state.obstacles) {
    const sx = o.x - px + cx;
    const sy = o.y - py + cy;

    if (o.shape === "circle") {
      ctx.beginPath();
      ctx.arc(sx, sy, o.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(sx - o.w / 2, sy - o.h / 2, o.w, o.h);
    }
  }

  ctx.restore();
}

// --- Collision ---
export function collideWithObstacles(state, entity, radius) {
  for (const o of state.obstacles) {
    if (o.shape === "circle") {
      const dx = entity.x - o.x;
      const dy = entity.y - o.y;
      const dist = Math.hypot(dx, dy);
      const minDist = radius + o.r;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        entity.x += nx * overlap;
        entity.y += ny * overlap;
      }
    } else {
      // rectangle collision
      const halfW = o.w / 2;
      const halfH = o.h / 2;
      const nearestX = clamp(entity.x, o.x - halfW, o.x + halfW);
      const nearestY = clamp(entity.y, o.y - halfH, o.y + halfH);
      const dx = entity.x - nearestX;
      const dy = entity.y - nearestY;
      const distSq = dx * dx + dy * dy;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq) || 1;
        const overlap = radius - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        entity.x += nx * overlap;
        entity.y += ny * overlap;
      }
    }
  }
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}
