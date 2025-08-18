// systems/smooth-noise.js
// Lightweight 1-D value noise returning [-1,1]
export function smoothNoise(t, seed = 0, scale = 1) {
  const x = t * scale + seed * 1000;
  const i0 = Math.floor(x);
  const i1 = i0 + 1;
  const v0 = pseudoRand(i0);
  const v1 = pseudoRand(i1);
  const f = x - i0;
  const u = f * f * (3 - 2 * f); // smoothstep interpolation
  return (v0 + (v1 - v0) * u) * 2 - 1;
}

function pseudoRand(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
