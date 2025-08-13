// ui/hud.js
var els = null;

export function initHUD(state) {
  var root = document.getElementById('hud-root');
  if (!root) { root = document.createElement('div'); root.id = 'hud-root'; document.body.appendChild(root); }

  root.style.cssText =
    'position:fixed;left:10px;top:10px;z-index:10;' +
    'font:12px system-ui, sans-serif;color:#fff;' +
    'background:rgba(0,0,0,0.5);padding:8px 10px;' +
    'border-radius:8px;line-height:1.2;user-select:none;pointer-events:none;';

  root.innerHTML =
    '<div style="margin-bottom:6px;">HP: <span id="hud-hp-num"></span></div>' +
    '<div style="position:relative;width:180px;height:10px;border-radius:6px;' +
      'background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);overflow:hidden;">' +
      '<div id="hud-hp-fill" style="position:absolute;left:0;top:0;bottom:0;width:0;background:#ff5577cc;"></div>' +
    '</div>';

  els = {
    hpNum:  root.querySelector('#hud-hp-num'),
    hpFill: root.querySelector('#hud-hp-fill')
  };

  updateHUD(state);
}

export function updateHUD(state) {
  if (!els) return;
  var hp = Math.round((state && typeof state.health === 'number') ? state.health : 0);
  var mx = Math.round((state && typeof state.maxHealth === 'number') ? state.maxHealth : (hp || 1));
  els.hpNum.textContent = hp + '/' + mx;

  var denom = (state && typeof state.maxHealth === 'number') ? state.maxHealth : 1;
  if (!denom) denom = 1;
  var num = (state && typeof state.health === 'number') ? state.health : 0;
  var pct = Math.max(0, Math.min(1, num / denom));
  els.hpFill.style.width = (pct * 100).toFixed(1) + '%';
}
