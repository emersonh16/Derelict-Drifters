// systems/world.js
export function initWorld(state) {
  const s = state.miasma, t = s.tile;
  state.world = {
    minX: -s.halfCols * t,
    maxX:  s.halfCols * t,
    minY: -s.halfRows * t,
    maxY:  s.halfRows * t
  };
}

// Clamp the player/camera inside the world box
export function clampToWorld(state) {
  const w = state.world; if (!w) return;
  const r = state.player?.r ?? 18;

  state.camera.x = clamp(state.camera.x, w.minX + r, w.maxX - r);
  state.camera.y = clamp(state.camera.y, w.minY + r, w.maxY - r);
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }


// Draw a thick miasma "wall" around the world
export function drawWorldBorder(ctx, state, cx, cy) {
  const w = state.world;
  if (!w) return;

  const thickness = 80; // how "thick" the miasma wall looks
  const color = 'rgba(120, 60, 160, 0.7)'; // same purple as miasma, more opaque

  ctx.save();

  // Top border
  ctx.fillStyle = color;
  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.minY - thickness - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );

  // Bottom border
  ctx.fillRect(
    w.minX - state.camera.x + cx - thickness,
    w.maxY - state.camera.y + cy,
    (w.maxX - w.minX) + thickness * 2,
    thickness
  );

  // Left border
  ctx.fillRect(
    w.minX - thickness - state.camera.x + cx,
    w.minY - state.camera.y + cy,
    thickness,
    (w.maxY - w.minY)
  );

  // Right border
  ctx.fillRect(
    w.maxX - state.camera.x + cx,
    w.minY - state.camera.y + cy,
    thickness,
    (w.maxY - w.minY)
  );

  ctx.restore();
}
