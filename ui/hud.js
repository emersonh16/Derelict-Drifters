/** @typedef {import('../core/state.js').GameState} GameState */
import { config } from '../core/config.js';

var els = null;

/** @param {GameState} state */
export function initHUD(state, opts = {}) {
  var root = document.getElementById('hud-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'hud-root';
    document.body.appendChild(root);
  }

  const pad = opts.pad ?? 14;
  const fontSize = opts.fontSize ?? 12;
  const barW = opts.barW ?? 180;
  const barH = opts.barH ?? 10;
  const hpFillColor = opts.hpFillColor ?? '#ff5577cc';

  root.style.cssText =
    `position:fixed;left:${pad - 4}px;top:${pad - 4}px;z-index:10;` +
    `font:${fontSize}px system-ui, sans-serif;color:#fff;` +
    `background:rgba(0,0,0,0.5);padding:8px 10px;` +
    `border-radius:8px;line-height:1.2;user-select:none;pointer-events:none;`;

  root.innerHTML =
    // HP number
    `<div style="margin-bottom:6px;">HP: <span id="hud-hp-num"></span></div>` +

    // HP bar
    `<div style="position:relative;width:${barW}px;height:${barH}px;border-radius:6px;` +
      `background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);overflow:hidden;margin-bottom:4px;">` +
      `<div id="hud-hp-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:${hpFillColor};"></div>` +
    `</div>` +

    // Laser Energy Bar
    `<div style="position:relative;width:${barW}px;height:${barH}px;border-radius:6px;` +
      `background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);overflow:hidden;margin-bottom:4px;">` +
      `<div id="hud-laser-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:yellow;"></div>` +
    `</div>` +

    // Drill Heat Bar
    `<div style="position:relative;width:${barW}px;height:${barH}px;border-radius:6px;` +
      `background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);overflow:hidden;margin-bottom:8px;">` +
      `<div id="hud-heat-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:${config.drill.heatColorCold};"></div>` +
    `</div>` +

    // Scrap
    `<div>Scrap: <span id="hud-scrap-num"></span></div>` +

    // Wind (vane + degrees)
    `<div style="margin-top:6px;">
       Wind: <span id="hud-wind-deg">0°</span>
       <span id="hud-wind-vane" style="display:inline-block;transform:rotate(0deg);margin-left:6px;">▲</span>
     </div>` +

    // Miasma intensity bar (spawn probability)
    `<div style="margin-top:4px;">
       <div style="position:relative;width:${barW}px;height:${barH}px;border-radius:6px;
         background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);
         overflow:hidden;">
         <div id="hud-miasma-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:#bb88ffcc;"></div>
       </div>
       <div style="font-size:${Math.max(10, fontSize-2)}px;opacity:0.85;margin-top:2px;">Fog intensity</div>
     </div>`;

  els = {
    hpNum:      root.querySelector('#hud-hp-num'),
    hpFill:     root.querySelector('#hud-hp-fill'),
    laserFill:  root.querySelector('#hud-laser-fill'),
    heatFill:   root.querySelector('#hud-heat-fill'),
    scrapNum:   root.querySelector('#hud-scrap-num'),
    windDeg:    root.querySelector('#hud-wind-deg'),
    windVane:   root.querySelector('#hud-wind-vane'),
    miasmaFill: root.querySelector('#hud-miasma-fill'),
  };

  updateHUD(state);
}

/** @param {GameState} state */
export function updateHUD(state) {
  if (!els) return;

  // --- Health ---
  var hp = Math.round((state && typeof state.health === 'number') ? state.health : 0);
  var mx = Math.round((state && typeof state.maxHealth === 'number') ? state.maxHealth : (hp || 1));
  els.hpNum.textContent = hp + '/' + mx;

  var denom = (state && typeof state.maxHealth === 'number') ? state.maxHealth : 1;
  if (!denom) denom = 1;
  var num = (state && typeof state.health === 'number') ? state.health : 0;
  var pct = Math.max(0, Math.min(1, num / denom));
  els.hpFill.style.width = (pct * 100).toFixed(1) + '%';

  // --- Laser Energy ---
  var energyPct = Math.max(0, Math.min(1, state.laserEnergy / state.maxLaserEnergy));
  els.laserFill.style.width = (energyPct * 100).toFixed(1) + '%';

  // --- Drill Heat ---
  var heatPct = Math.max(0, Math.min(1, state.drillHeat / state.maxDrillHeat));
  els.heatFill.style.width = (heatPct * 100).toFixed(1) + '%';
  var heatColor = config.drill.heatColorCold;
  if (heatPct > 0.66) heatColor = config.drill.heatColorHot;
  else if (heatPct > 0.33) heatColor = config.drill.heatColorWarm;
  els.heatFill.style.background = heatColor;

  // --- Scrap ---
  var scrap = Math.round((state && typeof state.scrap === 'number') ? state.scrap : 0);
  els.scrapNum.textContent = scrap;

  // --- Wind (direction readout + vane) ---
  if (els.windDeg && els.windVane && state.wind) {
    let deg = (state.wind.direction * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    els.windDeg.textContent = Math.round(deg) + '°';
    els.windVane.style.transform = `rotate(${deg}deg)`;
  }

  // --- Miasma intensity (spawn probability) ---
  if (els.miasmaFill) {
    const prob = (state.miasma && typeof state.miasma.spawnProb === 'number')
      ? state.miasma.spawnProb : 0;
    els.miasmaFill.style.width = (Math.max(0, Math.min(1, prob)) * 100).toFixed(1) + '%';
  }
}
