import { config } from "./config.js";

export function worldToScreenIso(x, y, camera) {
  const w = config.game.tileW;
  const h = config.game.tileH;
  const wx = x - camera.x;
  const wy = y - camera.y;
  return {
    x: (wx - wy) * w,
    y: (wx + wy) * h
  };
}

export function screenToWorldIso(sx, sy, camera) {
  const w = config.game.tileW;
  const h = config.game.tileH;
  const wx = 0.5 * (sx / w + sy / h);
  const wy = 0.5 * (sy / h - sx / w);
  return {
    x: wx + camera.x,
    y: wy + camera.y
  };
}
