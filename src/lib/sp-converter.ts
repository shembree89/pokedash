import { STAT_KEYS, type SpSpread, type StatKey } from "../data/types";

export const SP_TO_EV = 8;
export const SP_TOTAL_MAX = 66;
export const SP_PER_STAT_MAX = 32;

export function emptySpread(): SpSpread {
  return { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export function spTotal(spread: SpSpread): number {
  return STAT_KEYS.reduce((s, k) => s + (spread[k] ?? 0), 0);
}

export function spToEv(sp: number): number {
  return Math.min(252, sp * SP_TO_EV);
}

export function spreadToEvs(spread: SpSpread): SpSpread {
  const out = emptySpread();
  for (const k of STAT_KEYS) out[k] = spToEv(spread[k] ?? 0);
  return out;
}

export type SpValidation = {
  ok: boolean;
  overTotal: boolean;
  overPerStat: StatKey[];
  total: number;
};

export function validateSpread(spread: SpSpread): SpValidation {
  const total = spTotal(spread);
  const overPerStat = STAT_KEYS.filter((k) => (spread[k] ?? 0) > SP_PER_STAT_MAX);
  return {
    total,
    overTotal: total > SP_TOTAL_MAX,
    overPerStat,
    ok: total <= SP_TOTAL_MAX && overPerStat.length === 0,
  };
}
