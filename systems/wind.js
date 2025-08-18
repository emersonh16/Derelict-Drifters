// systems/wind.js

/**
 * @typedef {Object} WindState
 * @property {number} direction   // radians
 * @property {number} speed       // tiles/sec
 * @property {"manual"|"auto"} mode
 * @property {number} driftTimer
 * @property {number} targetDir
 * @property {number} targetSpeed
 */

/**
 * Initialize the wind system.
 * @param {import("../core/config.js").config["wind"]} cfg
 * @returns {WindState}
 */
// systems/wind.js
export function initWind(cfg) {
  // Seed immediate motion so wind is alive from frame 1.
  const dir = Math.random() * Math.PI * 2;
  const spd = cfg.minSpeed + Math.random() * Math.max(0, cfg.maxSpeed - cfg.minSpeed);
  return {
    direction: dir,
    speed: spd,
    mode: "auto",
    driftTimer: 0,
    targetDir: dir,
    targetSpeed: spd,
  };
}


/**
 * Update the wind state.
 * @param {WindState} wind
 * @param {number} dt
 * @param {import("../core/config.js").config["wind"]} cfg
 */
// systems/wind.js

/**
 * Wrap angle to (-PI, PI]
 */
function wrapPi(a) {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a >   Math.PI) a -= Math.PI * 2;
  return a;
}

/**
 * Update the wind state (no small per-frame jitter).
 * Smoothly ease direction on the shortest arc to avoid wobble at 2π wrap.
 * @param {import("./wind.js").WindState} wind
 * @param {number} dt
 * @param {import("../core/config.js").config["wind"]} cfg
 */
export function updateWind(wind, dt, cfg) {
  if (wind.mode === "manual") return;

  wind.driftTimer += dt;

  // Occasional big shift only
  if (wind.driftTimer >= cfg.bigShiftInterval) {
    wind.driftTimer = 0;
    wind.targetDir   += (Math.random() * 2 - 1) * cfg.bigShiftMagnitude;
    wind.targetSpeed  = cfg.minSpeed + Math.random() * (cfg.maxSpeed - cfg.minSpeed);
    // (Optional) comment this out once tuned:
    // console.log("[wind] big shift:", wind.targetDir.toFixed(2), wind.targetSpeed.toFixed(2));
  }

  // Smoothly interpolate current toward target
  const lerp = Math.min(1, dt / cfg.smoothTime);

  // --- angle-aware direction easing (shortest arc) ---
  const d = wrapPi(wind.targetDir - wind.direction);
  wind.direction = wind.direction + d * lerp;

  // Speed easing
  wind.speed += (wind.targetSpeed - wind.speed) * lerp;
}

