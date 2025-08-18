// core/iso.js

/**
 * Project world coordinates into screen space using a simple
 * 45° isometric-like transform relative to the provided camera.
 *
 * @param {number} x world x coordinate
 * @param {number} y world y coordinate
 * @param {{x:number,y:number,isoX?:number,isoY?:number,cx:number,cy:number}} cam camera with iso offsets
 * @returns {{x:number,y:number}}
 */
export function isoProject(x, y, cam) {
  const dx = x - cam.x;
  const dy = y - cam.y;
  const isoX = dx - dy;
  const isoY = dx + dy;
  return {
    x: isoX + (cam.isoX || 0) + cam.cx,
    y: isoY + (cam.isoY || 0) + cam.cy,
  };
}

/**
 * Project a tile coordinate (column/row) into screen space.
 *
 * @param {number} col tile column
 * @param {number} row tile row
 * @param {number} tileSize size of a tile in world units
 * @param {{x:number,y:number,isoX?:number,isoY?:number,cx:number,cy:number}} cam camera with iso offsets
 * @returns {{x:number,y:number}}
 */
export function isoProjectTile(col, row, tileSize, cam) {
  const wx = col * tileSize;
  const wy = row * tileSize;
  return isoProject(wx, wy, cam);
}

/**
 * Reverse an isometric projection back into world space.
 *
 * @param {number} screenX screen x coordinate
 * @param {number} screenY screen y coordinate
 * @param {{x:number,y:number,isoX?:number,isoY?:number,cx:number,cy:number}} cam camera with iso offsets
 * @returns {{x:number,y:number}}
 */
export function worldFromIso(screenX, screenY, cam) {
  const isoX = screenX - (cam.isoX || 0) - cam.cx;
  const isoY = screenY - (cam.isoY || 0) - cam.cy;
  const dx = (isoX + isoY) * 0.5;
  const dy = (isoY - isoX) * 0.5;
  return {
    x: cam.x + dx,
    y: cam.y + dy,
  };
}

/**
 * Convert a screen position into world tile coordinates.
 *
 * @param {number} screenX screen x coordinate
 * @param {number} screenY screen y coordinate
 * @param {number} tileSize size of a tile in world units
 * @param {{x:number,y:number,isoX?:number,isoY?:number,cx:number,cy:number}} cam camera with iso offsets
 * @returns {{col:number,row:number}}
 */
export function worldTileFromScreen(screenX, screenY, tileSize, cam) {
  const w = worldFromIso(screenX, screenY, cam);
  return {
    col: Math.floor(w.x / tileSize),
    row: Math.floor(w.y / tileSize),
  };
}

export default { isoProject, isoProjectTile, worldFromIso, worldTileFromScreen };
