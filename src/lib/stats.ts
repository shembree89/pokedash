import type { Nature, SpSpread, StatKey } from "../data/types";
import { STAT_KEYS } from "../data/types";
import { SP_TO_EV } from "./sp-converter";

// Champions: IVs fixed at 31, level auto-scaled to 50.
export const CHAMPIONS_IV = 31;
export const CHAMPIONS_LEVEL = 50;

type NatureMod = { plus: StatKey | null; minus: StatKey | null };

export const NATURE_MODS: Record<Nature, NatureMod> = {
  Hardy: { plus: null, minus: null },
  Docile: { plus: null, minus: null },
  Serious: { plus: null, minus: null },
  Bashful: { plus: null, minus: null },
  Quirky: { plus: null, minus: null },
  Lonely: { plus: "atk", minus: "def" },
  Brave: { plus: "atk", minus: "spe" },
  Adamant: { plus: "atk", minus: "spa" },
  Naughty: { plus: "atk", minus: "spd" },
  Bold: { plus: "def", minus: "atk" },
  Relaxed: { plus: "def", minus: "spe" },
  Impish: { plus: "def", minus: "spa" },
  Lax: { plus: "def", minus: "spd" },
  Timid: { plus: "spe", minus: "atk" },
  Hasty: { plus: "spe", minus: "def" },
  Jolly: { plus: "spe", minus: "spa" },
  Naive: { plus: "spe", minus: "spd" },
  Modest: { plus: "spa", minus: "atk" },
  Mild: { plus: "spa", minus: "def" },
  Quiet: { plus: "spa", minus: "spe" },
  Rash: { plus: "spa", minus: "spd" },
  Calm: { plus: "spd", minus: "atk" },
  Gentle: { plus: "spd", minus: "def" },
  Sassy: { plus: "spd", minus: "spe" },
  Careful: { plus: "spd", minus: "spa" },
};

export function natureMultiplier(nature: Nature, key: StatKey): number {
  if (key === "hp") return 1;
  const mod = NATURE_MODS[nature];
  if (mod.plus === key) return 1.1;
  if (mod.minus === key) return 0.9;
  return 1;
}

export function calcStat(
  key: StatKey,
  base: number,
  sp: number,
  nature: Nature,
  level = CHAMPIONS_LEVEL,
  iv = CHAMPIONS_IV,
): number {
  const ev = sp * SP_TO_EV;
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (key === "hp") return core + level + 10;
  const mult = natureMultiplier(nature, key);
  return Math.floor((core + 5) * mult);
}

export function calcAllStats(
  base: Record<StatKey, number>,
  spread: SpSpread,
  nature: Nature,
  level = CHAMPIONS_LEVEL,
): Record<StatKey, number> {
  const out = {} as Record<StatKey, number>;
  for (const k of STAT_KEYS) {
    out[k] = calcStat(k, base[k] ?? 0, spread[k] ?? 0, nature, level);
  }
  return out;
}

export function isNeutralNature(nature: Nature): boolean {
  const mod = NATURE_MODS[nature];
  return mod.plus === null && mod.minus === null;
}
