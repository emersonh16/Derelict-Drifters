// systems/world.js

// Initialize world bounds and spawn obstacles
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

  // Obstacles live on state.obstacles (not state.world)
  state.obstacles = [];
  spawnObstacles(state, opts.obstacleCount ?? 40, t);
}

// Random obstacle generation (circles + rects centered on x,y)
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
        r: tileSize * (8 + Math.random() * 6) // 8–14 tiles radius
      });
    } else {
      const rectW = tileSize * (10 + Math.random() * 8); // 10–18 tiles
      const rectH = tileSize * (10 + Math.random() * 8);
      state.obstacles.push({
        shape,
        x, y,
        w: rectW,
        h: rectH
      });
    }
  }
}

// Keep player/camera within world box
export function clampToWorld(state) {
  const w = state.world; if (!w) return;
  const r = state.player?.r ?? 18;
  state.camera.x = clamp(state.camera.x, w.minX + r, w.maxX - r);
  state.camera.y = clamp(state.camera.y, w.minY + r, w.maxY - r);
}

// --- Drawing ---------------------------------------------------------------

export function drawWorldBorder(ctx, state, cx, cy) {
  const w = state.world; if (!w) return;

  const thickness = w.borderThickness;
  const color = w.borderColor;

  ctx.save();
  ctx.fillStyle = color;

  // top
  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.minY - thickness - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );
  // bottom
  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.maxY - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );
  // left
  ctx.fillRect(
    w.minX - thickness - state.camera.x + cx,
    w.minY - state.camera.y + cy,
    thickness,
    (w.maxY - w.minY)
  );
  // right
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

// --- Collision (circle vs circle / circle vs rect) -------------------------

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

// --- Drill carving ---------------------------------------------------------
// Treat the drill as a capsule (segment + radius) and remove any obstacle hit.
export function carveObstaclesWithDrill(state, segA, segB, radius) {
  const obs = state.obstacles;
  if (!obs || !obs.length) return;

  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    let hit = false;

    if (o.shape === "rect") {
      // our rects are centered; convert to x/y/width/height
      const rx = o.x - o.w / 2;
      const ry = o.y - o.h / 2;
      hit = capsuleIntersectsRect(segA.x, segA.y, segB.x, segB.y, radius, rx, ry, o.w, o.h);
    } else if (o.shape === "circle") {
      hit = capsuleIntersectsCircle(segA.x, segA.y, segB.x, segB.y, radius, o.x, o.y, o.r);
    }

    if (hit) obs.splice(i, 1);
  }
}

function capsuleIntersectsCircle(x1, y1, x2, y2, rad, cx, cy, cr) {
  const d2 = pointToSegmentDistSq(cx, cy, x1, y1, x2, y2);
  const R = rad + cr;
  return d2 <= R * R;
}

function capsuleIntersectsRect(x1, y1, x2, y2, rad, rx, ry, rw, rh) {
  // quick reject: segment vs inflated AABB
  const inflX = rx - rad, inflY = ry - rad, inflW = rw + 2 * rad, inflH = rh + 2 * rad;
  if (!segmentIntersectsAABB(x1, y1, x2, y2, inflX, inflY, inflW, inflH)) return false;

  // precise: min distance rect->segment
  const d2 = rectToSegmentDistSq(rx, ry, rw, rh, x1, y1, x2, y2);
  return d2 <= rad * rad;
}

function pointToSegmentDistSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy;
  let t = 0;
  if (len2 > 0) t = ((px - x1) * dx + (py - y1) * dy) / len2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const sx = x1 + dx * t, sy = y1 + dy * t;
  const ox = px - sx, oy = py - sy;
  return ox*ox + oy*oy;
}

function segmentIntersectsAABB(x1, y1, x2, y2, rx, ry, rw, rh) {
  // slab method
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;

  function clip(p, q) {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else       { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  }

  if (!clip(-dx, x1 - rx)) return false;
  if (!clip( dx, rx + rw - x1)) return false;
  if (!clip(-dy, y1 - ry)) return false;
  if (!clip( dy, ry + rh - y1)) return false;
  return t0 <= t1;
}

function rectToSegmentDistSq(rx, ry, rw, rh, x1, y1, x2, y2) {
  // project segment toward rect and measure closest distance
  const cx = clamp01Projection(rx, rx + rw, x1, x2);
  const cy = clamp01Projection(ry, ry + rh, y1, y2);
  const px = x1 + (x2 - x1) * cx;
  const py = y1 + (y2 - y1) * cy;

  const qx = clamp(px, rx, rx + rw);
  const qy = clamp(py, ry, ry + rh);

  const dx = px - qx, dy = py - qy;
  return dx * dx + dy * dy;
}

function clamp01Projection(a, b, p0, p1) {
  const denom = (p1 - p0);
  if (denom === 0) return 0;
  let t = ((a + b) * 0.5 - p0) / denom;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return t;
}



export function carveObstaclesWithDrillTri(state, tri, dt, pad = 2) {
  const obs = state.obstacles;
  if (!obs || !obs.length || !tri) return;

  const cut = {
    minX: tri.aabb.minX - pad,
    maxX: tri.aabb.maxX + pad,
    minY: tri.aabb.minY - pad,
    maxY: tri.aabb.maxY + pad
  };

  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    if (o.shape === "rect") {
      const rx = o.x - o.w / 2;
      const ry = o.y - o.h / 2;
      if (!aabbOverlap(rx, ry, o.w, o.h, cut.minX, cut.minY, cut.maxX - cut.minX, cut.maxY - cut.minY))
        continue;

      const pieces = subtractRectByAABB(rx, ry, o.w, o.h, cut.minX, cut.minY, cut.maxX - cut.minX, cut.maxY - cut.minY);
      obs.splice(i, 1, ...pieces.map(p => ({
        shape: "rect",
        x: p.x + p.w / 2,
        y: p.y + p.h / 2,
        w: p.w,
        h: p.h
      })));
    }
    else if (o.shape === "circle") {
      if (aabbCircleOverlap(cut.minX, cut.minY, cut.maxX - cut.minX, cut.maxY - cut.minY, o.x, o.y, o.r)) {
        o.r -= 60 * dt; // grind speed
        if (o.r <= 6) obs.splice(i, 1);
      }
    }
  }
}

// helpers...
function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function aabbCircleOverlap(ax, ay, aw, ah, cx, cy, r) {
  const nx = Math.max(ax, Math.min(cx, ax + aw));
  const ny = Math.max(ay, Math.min(cy, ay + ah));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}
function subtractRectByAABB(rx, ry, rw, rh, cx, cy, cw, ch) {
  const left   = Math.max(rx, Math.min(rx + rw, cx));
  const right  = Math.max(rx, Math.min(rx + rw, cx + cw));
  const top    = Math.max(ry, Math.min(ry + rh, cy));
  const bottom = Math.max(ry, Math.min(ry + rh, cy + ch));
  if (left >= right || top >= bottom) return [{ x: rx, y: ry, w: rw, h: rh }];
  const out = [];
  if (top > ry) out.push({ x: rx, y: ry, w: rw, h: top - ry });
  if (ry + rh > bottom) out.push({ x: rx, y: bottom, w: rw, h: (ry + rh) - bottom });
  if (left > rx) out.push({ x: rx, y: top, w: left - rx, h: bottom - top });
  if (rx + rw > right) out.push({ x: right, y: top, w: (rx + rw) - right, h: bottom - top });
  return out.filter(r => r.w > 2 && r.h > 2);
}

// --- Utils -----------------------------------------------------------------

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
