var els = null;

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
    `<div style="margin-bottom:6px;">HP: <span id="hud-hp-num"></span></div>` +
    `<div style="position:relative;width:${barW}px;height:${barH}px;border-radius:6px;` +
      `background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);overflow:hidden;margin-bottom:4px;">` +
      `<div id="hud-hp-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:${hpFillColor};"></div>` +
    `</div>` +

    // New Laser Energy Bar
    `<div style="position:relative;width:${barW}px;height:${barH}px;border-radius:6px;` +
      `background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);overflow:hidden;margin-bottom:8px;">` +
      `<div id="hud-laser-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:yellow;"></div>` +
    `</div>` +

    `<div>Scrap: <span id="hud-scrap-num"></span></div>`;

  els = {
    hpNum:    root.querySelector('#hud-hp-num'),
    hpFill:   root.querySelector('#hud-hp-fill'),
    laserFill: root.querySelector('#hud-laser-fill'), // NEW
    scrapNum: root.querySelector('#hud-scrap-num')
  };

  updateHUD(state);
}

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

  // --- Scrap ---
  var scrap = Math.round((state && typeof state.scrap === 'number') ? state.scrap : 0);
  els.scrapNum.textContent = scrap;
}
