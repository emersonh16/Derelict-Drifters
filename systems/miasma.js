// systems/miasma.js
// Weather-like rolling fog banks driven by wind.

// ---- Public API -----------------------------------------------------------

export function initMiasma(state, opts = {}) {
  // World dimensions kept for compatibility with previous grid system
  const cols = opts.cols ?? 400;
  const rows = opts.rows ?? 400;
  const tile = opts.tile ?? 14;
  const halfCols = Math.floor(cols / 2);
  const halfRows = Math.floor(rows / 2);

  state.miasma = {
    // world metrics (used by other systems)
    tile, cols, rows, halfCols, halfRows,

    // damage when in dense fog
    dps: opts.dps ?? 35,

    // view size (updated each draw)
    viewW: 0,
    viewH: 0,

    // wind
    windAngle: Math.random() * Math.PI * 2,
    windSpeed: opts.windSpeed ?? 20,
    _windTimer: randRange(10, 30),

    // fog banks
    banks: [],
    bankMinRadius: opts.bankMinRadius ?? 200,
    bankMaxRadius: opts.bankMaxRadius ?? 400,
    baseAlpha: opts.baseAlpha ?? 0.4,
    denseThreshold: opts.denseThreshold ?? 0.6,

    // initial + growth hooks
    baseBankCount: opts.bankCount ?? 8,
    bankCountGrowth: opts.bankCountGrowth ?? 0, // banks per second (hook)
    spawnInterval: opts.spawnInterval ?? 0,     // hook for future spawn tuning
    spawnIntervalGrowth: opts.spawnIntervalGrowth ?? 0, // hook

    age: 0,
  };

  // spawn initial banks upwind/off-screen
  const s = state.miasma;
  for (let i = 0; i < s.baseBankCount; i++) {
    spawnBank(s, state, true);
  }
}

export function updateMiasma(state, dt) {
  const s = state.miasma; if (!s) return;
  s.age += dt;

  // ---- Wind direction changes ----
  s._windTimer -= dt;
  if (s._windTimer <= 0) {
    s._windTimer = randRange(10, 30);
    const roll = Math.random();
    let delta;
    if (roll < 0.80) {
      delta = randSign() * degToRad(randRange(20, 40));
    } else if (roll < 0.95) {
      delta = randSign() * degToRad(90);
    } else {
      delta = degToRad(180);
    }
    s.windAngle = normalizeAngle(s.windAngle + delta);
  }

  // ---- Move banks ----
  const vx = Math.cos(s.windAngle) * s.windSpeed;
  const vy = Math.sin(s.windAngle) * s.windSpeed;

  const w = s.viewW;
  const h = s.viewH;
  const halfDiag = Math.sqrt(w * w + h * h) / 2;

  for (let i = s.banks.length - 1; i >= 0; i--) {
    const b = s.banks[i];
    b.x += vx * dt;
    b.y += vy * dt;

    const dPar = (b.x - state.camera.x) * Math.cos(s.windAngle) +
                 (b.y - state.camera.y) * Math.sin(s.windAngle);
    const limit = halfDiag + Math.max(b.rx, b.ry);
    if (dPar > limit) {
      s.banks.splice(i, 1);
      spawnBank(s, state, true);
    }
  }

  // ---- Increase bank count over time (hook) ----
  const desired = Math.floor(s.baseBankCount + s.bankCountGrowth * s.age);
  while (s.banks.length < desired) {
    spawnBank(s, state, true);
  }
}

export function drawMiasma(state, ctx) {
  const s = state.miasma; if (!s) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const cx = w / 2, cy = h / 2;
  s.viewW = w;
  s.viewH = h;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';

  for (const b of s.banks) {
    const x = b.x - state.camera.x + cx;
    const y = b.y - state.camera.y + cy;
    const maxR = Math.max(b.rx, b.ry);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, maxR);
    grad.addColorStop(0, `rgba(120,60,160,${b.alpha})`);
    grad.addColorStop(1, 'rgba(120,60,160,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, b.rx, b.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---- Compatibility No-Ops -----------------------------------------------

export function clearWithBeam(state, cx, cy) {}
export function worldToIdx(miasma, wx, wy) { return -1; }
export function isFog(miasma, idx) { return false; }

// ---- Density Query -------------------------------------------------------

export function isDenseFogAt(state, x, y) {
  const s = state.miasma; if (!s) return false;
  let opacity = 0;
  for (const b of s.banks) {
    const dx = (x - b.x) / b.rx;
    const dy = (y - b.y) / b.ry;
    const d = dx * dx + dy * dy;
    if (d <= 1) {
      const contrib = (1 - d) * b.alpha;
      opacity += contrib;
      if (opacity >= s.denseThreshold) return true;
    }
  }
  return false;
}

// ---- Internals -----------------------------------------------------------

function spawnBank(s, state, upwind) {
  const angle = s.windAngle;
  const w = s.viewW || 800;
  const h = s.viewH || 600;
  const maxR = s.bankMaxRadius;
  const dist = Math.sqrt(w * w + h * h) / 2 + maxR;
  const offset = upwind ? -dist : dist;
  const perp = angle + Math.PI / 2;
  const spread = Math.max(w, h);
  const cx = state.camera.x + Math.cos(angle) * offset +
             Math.cos(perp) * (Math.random() - 0.5) * spread;
  const cy = state.camera.y + Math.sin(angle) * offset +
             Math.sin(perp) * (Math.random() - 0.5) * spread;
  const rx = randRange(s.bankMinRadius, s.bankMaxRadius);
  const ry = randRange(s.bankMinRadius, s.bankMaxRadius);
  s.banks.push({ x: cx, y: cy, rx, ry, alpha: s.baseAlpha });
}

function randRange(min, max) { return Math.random() * (max - min) + min; }
function randSign() { return Math.random() < 0.5 ? -1 : 1; }
function degToRad(d) { return d * Math.PI / 180; }
function normalizeAngle(a) { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; }

