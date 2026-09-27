/** Small deterministic PRNG (mulberry32) so simulations and tests are reproducible. */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted<T extends { weight: number }>(items: T[], rng: Rng): T | undefined {
  const total = items.reduce((a, i) => a + Math.max(0, i.weight), 0);
  if (total <= 0) return undefined;
  let r = rng() * total;
  for (const item of items) {
    r -= Math.max(0, item.weight);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}
