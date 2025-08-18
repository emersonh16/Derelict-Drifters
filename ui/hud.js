/** @typedef {import('../core/state.js').GameState} GameState */
import { config } from '../core/config.js';

let coverageDisplay = 0;
const prev = {
  hp: -1,
  maxHp: -1,
  hpPct: -1,
  energyPct: -1,
  heatPct: -1,
  heatColor: '',
  scrap: -1,
  windDeg: -1,
  windText: '',
  coverageHeight: '',
  coverageText: -1,
};
let lastUpdate = 0;
const HUD_UPDATE_INTERVAL = 100; // ms

function compassDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

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

    // Wind display
    `<div style="margin-top:6px;display:flex;align-items:center;">` +
      `<span id="hud-wind-arrow" style="display:inline-block;font-size:${fontSize*1.6}px;transform:rotate(0deg);">▲</span>` +
      `<span id="hud-wind-text" style="margin-left:6px;">N</span>` +
    `</div>` +

    // Miasma coverage thermometer
    `<div style="margin-top:6px;display:flex;align-items:flex-end;height:60px;">` +
      `<div style="position:relative;width:16px;height:100%;border:1px solid rgba(255,255,255,0.18);margin-right:6px;">` +
        `<div id="hud-miasma-bar" style="position:absolute;left:0;right:0;bottom:0;height:0;background:#bb88ffcc;"></div>` +
      `</div>` +
      `<span id="hud-miasma-text">0%</span>` +
    `</div>`;

  els = {
    hpNum:      root.querySelector('#hud-hp-num'),
    hpFill:     root.querySelector('#hud-hp-fill'),
    laserFill:  root.querySelector('#hud-laser-fill'),
    heatFill:   root.querySelector('#hud-heat-fill'),
    scrapNum:   root.querySelector('#hud-scrap-num'),
    windArrow:  root.querySelector('#hud-wind-arrow'),
    windText:   root.querySelector('#hud-wind-text'),
    miasmaBar:  root.querySelector('#hud-miasma-bar'),
    miasmaText: root.querySelector('#hud-miasma-text'),
  };

  updateHUD(state);
}

/** @param {GameState} state */
export function updateHUD(state) {
  if (!els) return;
  const now = performance.now();
  if (now - lastUpdate < HUD_UPDATE_INTERVAL) return;
  lastUpdate = now;

  // --- Health ---
  const hp = Math.round((state && typeof state.health === 'number') ? state.health : 0);
  const mx = Math.round((state && typeof state.maxHealth === 'number') ? state.maxHealth : (hp || 1));
  if (hp !== prev.hp || mx !== prev.maxHp) {
    els.hpNum.textContent = hp + '/' + mx;
    prev.hp = hp;
    prev.maxHp = mx;
  }

  let denom = (state && typeof state.maxHealth === 'number') ? state.maxHealth : 1;
  if (!denom) denom = 1;
  const num = (state && typeof state.health === 'number') ? state.health : 0;
  const pct = Math.max(0, Math.min(1, num / denom));
  if (pct !== prev.hpPct) {
    els.hpFill.style.width = (pct * 100).toFixed(1) + '%';
    prev.hpPct = pct;
  }

  // --- Laser Energy ---
  const energyPct = Math.max(0, Math.min(1, state.laserEnergy / state.maxLaserEnergy));
  if (energyPct !== prev.energyPct) {
    els.laserFill.style.width = (energyPct * 100).toFixed(1) + '%';
    prev.energyPct = energyPct;
  }

  // --- Drill Heat ---
  const heatPct = Math.max(0, Math.min(1, state.drillHeat / state.maxDrillHeat));
  if (heatPct !== prev.heatPct) {
    els.heatFill.style.width = (heatPct * 100).toFixed(1) + '%';
    prev.heatPct = heatPct;
  }
  let heatColor = config.drill.heatColorCold;
  if (heatPct > 0.66) heatColor = config.drill.heatColorHot;
  else if (heatPct > 0.33) heatColor = config.drill.heatColorWarm;
  if (heatColor !== prev.heatColor) {
    els.heatFill.style.background = heatColor;
    prev.heatColor = heatColor;
  }

  // --- Scrap ---
  const scrap = Math.round((state && typeof state.scrap === 'number') ? state.scrap : 0);
  if (scrap !== prev.scrap) {
    els.scrapNum.textContent = scrap;
    prev.scrap = scrap;
  }

  // --- Wind ---
  if (els.windArrow && els.windText && state.wind) {
    let deg = (state.wind.direction * 180 / Math.PI) % 360;
    if (deg < 0) deg += 360;
    const rounded = Math.round(deg);
    if (rounded !== prev.windDeg) {
      els.windArrow.style.transform = `rotate(${rounded}deg)`;
      prev.windDeg = rounded;
    }
    const dirTxt = compassDir(rounded);
    if (dirTxt !== prev.windText) {
      els.windText.textContent = dirTxt;
      prev.windText = dirTxt;
    }
  }

  // --- Miasma coverage ---
  if (els.miasmaBar && els.miasmaText && state.miasma) {
    const actual = Math.max(0, Math.min(1, state.miasma.coverage || 0));
    coverageDisplay += (actual - coverageDisplay) * 0.1;
    const barH = (coverageDisplay * 100).toFixed(1);
    if (barH !== prev.coverageHeight) {
      els.miasmaBar.style.height = barH + '%';
      prev.coverageHeight = barH;
    }
    const txt = Math.round(actual * 100);
    if (txt !== prev.coverageText) {
      els.miasmaText.textContent = txt + '%';
      prev.coverageText = txt;
    }
  }
}
