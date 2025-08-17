// systems/wind.js
// Simple autonomous wind simulation with optional manual override.

/**
 * @typedef {Object} WindState
 * @property {number} direction   // radians, unbounded
 * @property {number} speed       // tiles per second
 * @property {"manual"|"auto"} mode
 * @property {number} driftTimer
 * @property {number} nextShiftAt
 * @property {number} targetDir
 * @property {number} targetSpeed
 */

/**
 * Initialise a new wind state.
 * @param {Object} opts
 * @returns {WindState}
 */
export function initWind(opts = {}) {
  return {
    direction: 0,
    speed: 0,
    mode: "auto",
    driftTimer: 0,
    nextShiftAt: opts.bigShiftInterval ?? 60,
    targetDir: 0,
    targetSpeed: 0,
  };
}

/**
 * Update wind in auto mode. Manual mode does nothing.
 * @param {WindState} w
 * @param {number} dt
 * @param {Object} cfg
 */
export function updateWind(w, dt, cfg = {}) {
  if (!w || w.mode === "manual") return;

  const smooth = cfg.smoothTime ?? 5;
  w.direction += (w.targetDir - w.direction) * dt / smooth;
  w.speed += (w.targetSpeed - w.speed) * dt / smooth;

  w.driftTimer += dt;
  if (w.driftTimer >= w.nextShiftAt) {
    w.driftTimer = 0;
    w.nextShiftAt = cfg.bigShiftInterval ?? 60;
    const dirMag = cfg.bigShiftMagnitude?.direction ?? Math.PI;
    const spdMag = cfg.bigShiftMagnitude?.speed ?? 5;
    w.targetDir = w.direction + (Math.random() - 0.5) * 2 * dirMag;
    const minS = cfg.minSpeed ?? 0;
    const maxS = cfg.maxSpeed ?? 20;
    const newSpeed = w.speed + (Math.random() - 0.5) * 2 * spdMag;
    w.targetSpeed = Math.max(minS, Math.min(maxS, newSpeed));
  }
}

export function setManual(w, direction, speed) {
  if (!w) return;
  w.mode = "manual";
  w.direction = direction;
  w.speed = speed;
}

export function setAuto(w) {
  if (!w) return;
  w.mode = "auto";
  w.targetDir = w.direction;
  w.targetSpeed = w.speed;
}

export {}; // ensure module
