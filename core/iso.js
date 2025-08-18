// core/iso.js

/**
 * Project world coordinates into screen space using a simple
 * isometric transform relative to the provided camera.
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
  const isoY = (dx + dy) * 0.5;
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

export default { isoProject, isoProjectTile };
