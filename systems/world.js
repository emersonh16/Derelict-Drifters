// Subtle grid + rocks to show motion
export function initWorld(state, opts = {}) {
  const rng = (seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2**32)(opts.seed ?? 12345);
  state.world = {
    grid: opts.grid ?? 80,
    rocks: Array.from({ length: opts.rocks ?? 60 }, () => {
      const x = (rng() - 0.5) * (opts.span ?? 4000);
      const y = (rng() - 0.5) * (opts.span ?? 4000);
      const r = 6 + Math.floor(rng() * 16);
      return { x, y, r };
    })
  };
}

export function drawWorld(ctx, state, cx, cy, w, h) {
  const { grid, rocks } = state.world;

  ctx.fillStyle = '#121017';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  const ox = - (state.camera.x % grid);
  const oy = - (state.camera.y % grid);
  ctx.beginPath();
  for (let x = ox; x < w; x += grid) { ctx.moveTo(x,0); ctx.lineTo(x,h); }
  for (let y = oy; y < h; y += grid) { ctx.moveTo(0,y); ctx.lineTo(w,y); }
  ctx.stroke();

  ctx.fillStyle = '#3e5b39';
  for (const r of rocks) {
    const sx = Math.floor(r.x - state.camera.x + cx);
    const sy = Math.floor(r.y - state.camera.y + cy);
    if (sx + r.r < 0 || sy + r.r < 0 || sx - r.r > w || sy - r.r > h) continue;
    ctx.beginPath(); ctx.arc(sx, sy, r.r, 0, Math.PI*2); ctx.fill();
  }
}
