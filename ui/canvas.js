import { config } from "../core/config.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

function initCanvas(state, { onWheel, onTogglePause, onRestart, onToggleDevHUD }) {
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
    state.mouse.x = w / 2;
    state.mouse.y = h / 2;
    state.pendingMouse.x = state.mouse.x;
    state.pendingMouse.y = state.mouse.y;
    state.camera.cx = w / 2;
    state.camera.cy = h / 2;
  }
  window.addEventListener("resize", resize);
  resize();

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (state.paused) {
      state.pendingMouse.x = x;
      state.pendingMouse.y = y;
    } else {
      state.mouse.x = x;
      state.mouse.y = y;
    }
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      if (state.paused || state.gameOver) return;
      onWheel && onWheel(e);
      e.preventDefault();
    },
    { passive: false }
  );

  const keyActions = {
    r: () => state.gameOver && onRestart && onRestart(),
    "1": () => {
      state.activeWeapon = "beam";
    },
    "2": () => {
      state.activeWeapon = "drill";
    },
    m: () => {
      state.miasmaEnabled = !state.miasmaEnabled;
    },
    n: () => {
      config.dynamicMiasma.regrowEnabled = !config.dynamicMiasma.regrowEnabled;
    },
    p: () => onToggleDevHUD && onToggleDevHUD(),
  };

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (!state.gameOver) onTogglePause && onTogglePause();
      return;
    }
    const key = e.key.toLowerCase();
    const action = keyActions[key];
    if (action) action();
    state.keys.add(key);
  });

  window.addEventListener("keyup", (e) => {
    state.keys.delete(e.key.toLowerCase());
  });
}

export { ctx, initCanvas };
