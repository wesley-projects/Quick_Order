/**
 * Deterministic pseudo-randomness. The mock adapter needs two checks of the
 * same listing in the same time window to agree — a plain Math.random() would
 * make the demo flicker and make tests impossible.
 */

/** xmur3 string hash → 32-bit seed. */
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Stable float in [0, 1) for a given string key. */
export function seededRandom(key: string): number {
  let t = (hashSeed(key) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Stable integer in [min, max]. */
export function seededInt(key: string, min: number, max: number): number {
  return min + Math.floor(seededRandom(key) * (max - min + 1));
}
