// ui/devhud.js
// Ultra-light Dev HUD: FPS + dt only, drawn at top-right.
// Toggle with "P" (hooked up in core/game.js).
/** @typedef {import('../core/state.js').GameState} GameState */

/** @param {GameState} state */
export function initDevHUD(state) {
  state.dev = state.dev || {};
  state.dev.show = state.dev.show ?? false; // starts hidden
  state.dev.perf = {
    fps: 0,
    frames: 0,
    acc: 0,
    sampleEvery: 0.5, // seconds; coarse = cheaper
    dt: 0
  };
}

/** @param {GameState} state */
export function toggleDevHUD(state) {
  state.dev = state.dev || {};
  state.dev.show = !state.dev.show;
}

/** @param {GameState} state */
export function updateDevHUD(state, dt) {
  const p = state.dev?.perf;
  if (!p) return;

  p.dt = dt;
  p.frames += 1;
  p.acc += dt;

  if (p.acc >= p.sampleEvery) {
    p.fps = Math.round(p.frames / p.acc);
    p.frames = 0;
    p.acc = 0;
  }
}

/** @param {GameState} state */
export function drawDevHUD(ctx, state) {
  const dev = state?.dev;
  if (!dev?.show) return;

  // If perf is missing for any reason, create a safe default on the fly
  dev.perf = dev.perf || { fps: 0, frames: 0, acc: 0, sampleEvery: 0.5, dt: 0 };
  const p = dev.perf;

  const lines = [
    "DEV (P toggles)",
    `FPS: ${p.fps ?? 0}`,
    `dt:  ${(p.dt ?? 0).toFixed ? p.dt.toFixed(3) : p.dt}s`,
  ];

  const pad = 8, lineH = 16, w = 200, h = pad * 2 + lines.length * lineH;
  const x = ctx.canvas.width - w - 10;
  const y = 10;

  ctx.save();
  ctx.globalAlpha = 0.85; ctx.fillStyle = "#0d0c12";
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.strokeStyle = "rgba(140,120,200,0.8)";
  ctx.lineWidth = 2; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.font = "12px monospace"; ctx.textBaseline = "top";
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillText(text, x + pad + 1, y + pad + i * lineH + 1);
    ctx.fillStyle = i === 0 ? "#c7b5ff" : "#e6e6e6"; ctx.fillText(text, x + pad, y + pad + i * lineH);
  }
}

