// core/textures.js
export function initTextures(state, opts = {}) {
  const url   = opts.paperUrl   || "assets/paper_source.jpg";
  const scale = opts.paperScale || 1.6;  // how big the “crinkles” read
  const size  = opts.tileSize   || 512;  // tile resolution we’ll build

  state.textures = state.textures || {};
  state.textures.paper = {
    img: null,          // will hold a seamless canvas tile
    ready: false,
    tileSize: size,
    scale
  };

  loadImage(url).then((img) => {
    const tile = makeSeamlessTile(img, size);
    state.textures.paper.img = tile;     // use the seamless tile as the source
    state.textures.paper.ready = true;
    state.textures.paper.tileSize = size;
  }).catch((err) => {
    console.error("[textures] failed to load", url, err);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Build a tileable canvas from an arbitrary photo using a quick
 * “mirror around edges” trick. Great for organic textures like paper.
 */
function makeSeamlessTile(img, size = 512) {
  // Step 1: draw the photo scaled into a square tile
  const base = document.createElement("canvas");
  base.width = size; base.height = size;
  const b = base.getContext("2d");
  // cover-fit into square (center-crop)
  const rImg = img.width / img.height;
  const rOut = 1; // square
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (rImg > rOut) {
    // image wider than tall -> crop sides
    const targetW = img.height * rOut;
    sx = (img.width - targetW) * 0.5; sw = targetW;
  } else {
    // image taller than wide -> crop top/bottom
    const targetH = img.width / rOut;
    sy = (img.height - targetH) * 0.5; sh = targetH;
  }
  b.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

  // Step 2: mirror-tiling to eliminate seams:
  // build a 2x2 canvas of mirrored quadrants, then crop center.
  const big = document.createElement("canvas");
  big.width = size * 2; big.height = size * 2;
  const g = big.getContext("2d");

  // Q1: normal
  g.drawImage(base, 0, 0);
  // Q2: mirrored horizontally
  g.save(); g.translate(size * 2, 0); g.scale(-1, 1); g.drawImage(base, 0, 0); g.restore();
  // Q3: mirrored vertically
  g.save(); g.translate(0, size * 2); g.scale(1, -1); g.drawImage(base, 0, 0); g.restore();
  // Q4: mirrored both
  g.save(); g.translate(size * 2, size * 2); g.scale(-1, -1); g.drawImage(base, 0, 0); g.restore();

  // optional soften at the seams (super light blur by multi-draw)
  g.globalAlpha = 0.25;
  g.drawImage(big, -1, 0); g.drawImage(big, 1, 0);
  g.drawImage(big, 0, -1); g.drawImage(big, 0, 1);
  g.globalAlpha = 1;

  // Crop center back to size×size (this gives symmetric, tileable edges)
  const tile = document.createElement("canvas");
  tile.width = size; tile.height = size;
  tile.getContext("2d").drawImage(big, size / 2, size / 2, size, size, 0, 0, size, size);
  return tile;
}
