/** @typedef {import('../core/state.js').GameState} GameState */

let root, els = null;

/** @param {GameState} state */
export function initDevHUD(state) {
  root = document.createElement("div");
  root.id = "devhud-root";
  root.style.cssText = `
    position:fixed;right:12px;top:12px;z-index:100;
    background:rgba(0,0,0,0.6);color:#fff;
    font:12px system-ui,sans-serif;
    padding:8px;border-radius:8px;
    pointer-events:auto;user-select:none;
    display:none;
  `;
  document.body.appendChild(root);

  root.innerHTML = `
    <div style="margin-bottom:6px;font-weight:bold;">DevHUD</div>

    <label>Mode:
      <select id="dev-wind-mode">
        <option value="auto">auto</option>
        <option value="manual">manual</option>
      </select>
    </label><br><br>

    <label>Direction:
      <input type="range" id="dev-wind-dir" min="0" max="360" step="1">
      <span id="dev-wind-dir-val"></span>
    </label><br>

    <label>Speed:
      <input type="range" id="dev-wind-speed" min="0" max="10" step="0.1">
      <span id="dev-wind-speed-val"></span>
    </label><br><br>

    <label>Fog spawn:
      <input type="range" id="dev-fog-spawn" min="0" max="1" step="0.01">
      <span id="dev-fog-spawn-val"></span>
    </label>
  `;

  els = {
    mode: root.querySelector("#dev-wind-mode"),
    dir: root.querySelector("#dev-wind-dir"),
    dirVal: root.querySelector("#dev-wind-dir-val"),
    speed: root.querySelector("#dev-wind-speed"),
    speedVal: root.querySelector("#dev-wind-speed-val"),
    spawn: root.querySelector("#dev-fog-spawn"),
    spawnVal: root.querySelector("#dev-fog-spawn-val"),
  };

  updateDevHUD(state, 0);
}

/** Toggle visibility */
export function toggleDevHUD(state) {
  if (!root) return;
  root.style.display = (root.style.display === "none") ? "block" : "none";
}

/** @param {GameState} state */
export function updateDevHUD(state, dt = 0) {
  if (!els || !state.wind || !state.miasma) return;

  // only live-update when paused
  if (!state.paused) return;

  els.mode.value = state.wind.mode;

  // direction degrees
  const deg = (state.wind.direction * 180 / Math.PI) % 360;
  els.dir.value = Math.round(deg);
  els.dirVal.textContent = els.dir.value + "°";

  // speed
  els.speed.value = state.wind.speed.toFixed(1);
  els.speedVal.textContent = els.speed.value;

  // fog
  els.spawn.value = state.miasma.spawnProb.toFixed(2);
  els.spawnVal.textContent = els.spawn.value;
}

/** Commit values back when unpausing */
export function applyDevHUD(state) {
  if (!els || !state.wind || !state.miasma) return;

  state.wind.mode = els.mode.value;
  const dirRad = (parseFloat(els.dir.value) || 0) * Math.PI / 180;
  state.wind.direction = dirRad;
  state.wind.targetDir = dirRad;

  const spd = parseFloat(els.speed.value) || 0;
  state.wind.speed = spd;
  state.wind.targetSpeed = spd;

  const fog = parseFloat(els.spawn.value) || 0;
  state.miasma.spawnProb = fog;
}

/** @param {CanvasRenderingContext2D} ctx @param {GameState} state */
export function drawDevHUD(ctx, state) {
  // nothing fancy; DOM already handles it
}
