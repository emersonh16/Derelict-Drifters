// ui/devhud.js
// Pause-time developer HUD for tweaking wind and miasma.
import { config } from '../core/config.js';

/** @typedef {import('../core/state.js').GameState} GameState */

let root = null;
let els = null;

/** @param {GameState} state */
export function initDevHUD(state) {
  state.dev = state.dev || { show: false };
  root = document.getElementById('devhud-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'devhud-root';
    document.body.appendChild(root);
  }
  root.style.cssText =
    'position:fixed;right:10px;top:10px;z-index:20;' +
    'background:rgba(0,0,0,0.7);color:#fff;padding:10px;font:12px monospace;' +
    'border-radius:8px;line-height:1.4;user-select:none;';
  root.innerHTML =
    `<div style="margin-bottom:4px;">Dir <input type="range" id="dev-wind-dir" min="0" max="360" step="1"></div>` +
    `<div style="margin-bottom:4px;">Speed <input type="range" id="dev-wind-speed" min="${config.wind.minSpeed}" max="${config.wind.maxSpeed}" step="1"></div>` +
    `<div style="margin-bottom:6px;">Spawn <input type="range" id="dev-miasma-spawn" min="0" max="1" step="0.01"></div>` +
    `<label><input type="checkbox" id="dev-wind-auto" checked> Auto Wind</label>`;
  els = {
    dir: root.querySelector('#dev-wind-dir'),
    speed: root.querySelector('#dev-wind-speed'),
    spawn: root.querySelector('#dev-miasma-spawn'),
    auto: root.querySelector('#dev-wind-auto')
  };
  root.style.display = 'none';
}

/** @param {GameState} state */
export function toggleDevHUD(state) {
  state.dev = state.dev || {};
  state.dev.show = !state.dev.show;
}

/** @param {GameState} state */
export function updateDevHUD(state) {
  if (!els || !root) return;
  const show = state.dev?.show && state.paused;
  root.style.display = show ? 'block' : 'none';
  if (!show) return;
  const dirDeg = ((state.wind?.direction ?? 0) * 180 / Math.PI + 360) % 360;
  els.dir.value = dirDeg;
  els.speed.value = state.wind?.speed ?? 0;
  els.spawn.value = state.miasma?.spawnProb ?? 0;
  els.auto.checked = state.wind?.mode === 'auto';
  const dis = els.auto.checked;
  els.dir.disabled = dis;
  els.speed.disabled = dis;
}

/** @param {GameState} state */
export function applyDevHUD(state) {
  if (!els) return;
  if (els.auto.checked) {
    state.wind.mode = 'auto';
  } else {
    state.wind.mode = 'manual';
    state.wind.direction = parseFloat(els.dir.value) * Math.PI / 180;
    state.wind.speed = parseFloat(els.speed.value);
  }
  state.miasma.spawnProb = parseFloat(els.spawn.value);
}

export function drawDevHUD() {}
