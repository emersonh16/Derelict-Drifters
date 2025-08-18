// systems/wind.js
import { smoothNoise } from "./smooth-noise.js";

/**
 * @typedef {Object} WindState
 * @property {number} direction   // radians
 * @property {number} speed       // tiles/sec
 * @property {"manual"|"auto"} mode
 * @property {number} driftTimer
 * @property {number} targetDir
 * @property {number} targetSpeed
 * @property {number} t
 * @property {number} dirSeed
 * @property {number} spdSeed
 */

/**
 * Initialize the wind system.
 * @param {import("../core/config.js").config["weather"]["wind"]} cfg
 * @returns {WindState}
 */
export function initWind(cfg) {
  const dirSeed = Math.random() * 1000;
  const spdSeed = Math.random() * 1000;
  const t = Math.random() * 1000;
  const dir = smoothNoise(t, dirSeed, cfg.dirNoiseScale) * Math.PI;
  const spd = cfg.minSpeed + ((smoothNoise(t, spdSeed, cfg.speedNoiseScale) + 1) * 0.5) * (cfg.maxSpeed - cfg.minSpeed);
  return {
    direction: dir,
    speed: spd,
    mode: "auto",
    driftTimer: 0,
    targetDir: dir,
    targetSpeed: spd,
    t,
    dirSeed,
    spdSeed,
  };
}

/**
 * Wrap angle to (-PI, PI]
 */
function wrapPi(a) {
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

/**
 * Update the wind state.
 * @param {WindState} wind
 * @param {number} dt
 * @param {import("../core/config.js").config["weather"]["wind"]} cfg
 */
export function updateWind(wind, dt, cfg) {
  if (wind.mode === "manual") return;

  wind.t += dt;

  // Noise driven targets
  const nDir = smoothNoise(wind.t, wind.dirSeed, cfg.dirNoiseScale);
  const nSpd = smoothNoise(wind.t, wind.spdSeed, cfg.speedNoiseScale);
  wind.targetDir = nDir * Math.PI;
  wind.targetSpeed = cfg.minSpeed + ((nSpd + 1) * 0.5) * (cfg.maxSpeed - cfg.minSpeed);

  // Rare front shift
  if (Math.random() < cfg.front.probabilityPerSecond * dt) {
    const mag = cfg.front.magnitudeMinRad + Math.random() * (cfg.front.magnitudeMaxRad - cfg.front.magnitudeMinRad);
    wind.targetDir += (Math.random() < 0.5 ? -1 : 1) * mag;
  }

  const k = 1 - Math.exp(-dt / cfg.smoothTime);
  const d = wrapPi(wind.targetDir - wind.direction);
  wind.direction += d * k;
  wind.speed += (wind.targetSpeed - wind.speed) * k;
  wind.speed = Math.max(cfg.minSpeed, Math.min(cfg.maxSpeed, wind.speed));
}
