import type {
  DexEntry,
  DexMega,
  OwnedPokemon,
  PokemonType,
  StatKey,
} from "../data/types";
import { ALL_TYPES, typeMult } from "./type-chart";

export interface EffectiveMon {
  species: string;
  types: readonly PokemonType[];
  baseStats: Record<StatKey, number>;
  ability?: string;
}

function dexMegaMatchForItem(
  entry: DexEntry,
  item?: string,
): DexMega | undefined {
  if (!item || !entry.megas) return undefined;
  return entry.megas.find((m) => m.requiredItem.toLowerCase() === item.toLowerCase());
}

export function resolveOwned(
  mon: OwnedPokemon,
  entry: DexEntry | undefined,
): EffectiveMon {
  if (!entry) {
    return {
      species: mon.species,
      types: [],
      baseStats: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      ability: mon.ability,
    };
  }
  if (mon.mega) {
    const mega = dexMegaMatchForItem(entry, mon.item) ?? entry.megas?.[0];
    if (mega) {
      return {
        species: mega.name,
        types: mega.types,
        baseStats: mega.baseStats,
        ability: mega.ability,
      };
    }
  }
  return {
    species: entry.name,
    types: entry.types,
    baseStats: entry.baseStats,
    ability: mon.ability || entry.abilities[0],
  };
}

// For coverage, assume each mon projects moves of both its STAB types.
// Primary offensive category: whichever attack stat is higher.
export type OffenseCategory = "physical" | "special";

export function offenseCategory(stats: Record<StatKey, number>): OffenseCategory {
  return stats.atk >= stats.spa ? "physical" : "special";
}

export function bestStabMultVsTarget(
  attacker: EffectiveMon,
  target: readonly PokemonType[],
): { type: PokemonType | null; mult: number } {
  let best: { type: PokemonType | null; mult: number } = { type: null, mult: 0 };
  for (const t of attacker.types) {
    const m = typeMult(t, target);
    if (m > best.mult) best = { type: t, mult: m };
  }
  return best;
}

// Offensive coverage: for each of 18 types, count how many team members
// have at least one SE STAB option against a defender of that type.
// Since we can't know full movesets, we simulate "defender is pure X".
export interface CoverageBuckets {
  byType: Record<PokemonType, number>;
  teamSize: number;
}

export function offensiveCoverage(team: EffectiveMon[]): CoverageBuckets {
  const buckets = Object.fromEntries(ALL_TYPES.map((t) => [t, 0])) as Record<
    PokemonType,
    number
  >;
  for (const defType of ALL_TYPES) {
    for (const mon of team) {
      const best = bestStabMultVsTarget(mon, [defType]);
      if (best.mult > 1) buckets[defType] += 1;
    }
  }
  return { byType: buckets, teamSize: team.length };
}

// Defensive coverage: for each attacking type X, compute how your team
// splits across "weak / neutral / resist / immune".
export interface DefenseBuckets {
  byType: Record<PokemonType, { weak: number; neutral: number; resist: number; immune: number }>;
  teamSize: number;
}

export function defensiveCoverage(team: EffectiveMon[]): DefenseBuckets {
  const byType = {} as DefenseBuckets["byType"];
  for (const atkType of ALL_TYPES) {
    let weak = 0, neutral = 0, resist = 0, immune = 0;
    for (const mon of team) {
      const m = typeMult(atkType, mon.types);
      if (m === 0) immune += 1;
      else if (m < 1) resist += 1;
      else if (m === 1) neutral += 1;
      else weak += 1;
    }
    byType[atkType] = { weak, neutral, resist, immune };
  }
  return { byType, teamSize: team.length };
}

// Threat scoring: for each meta mon M against our team, compute worst-case
// offensive ratio M → each of our mons, then worst-case defensive ratio
// each of our mons → M. Combined threat = worst-case offense against us
// minus our best offense against them.
export interface ThreatScore {
  species: string;
  inboundWorst: number; // how hard M hits our worst matchup (higher = scarier)
  outboundBest: number; // how hard we hit M with our best matchup
  net: number;          // inboundWorst - outboundBest (higher = bigger problem)
}

function offenseStat(stats: Record<StatKey, number>, cat: OffenseCategory): number {
  return cat === "physical" ? stats.atk : stats.spa;
}

function defenseStat(stats: Record<StatKey, number>, cat: OffenseCategory): number {
  return cat === "physical" ? stats.def : stats.spd;
}

// Ratio representing "how hard does attacker hit defender" using:
// (type multiplier × STAB × attacker's relevant attack stat) / defender's relevant defense stat
// × defender HP factor so bulky mons aren't disproportionately favoured by raw numbers.
export function damageRatio(attacker: EffectiveMon, defender: EffectiveMon): number {
  const cat = offenseCategory(attacker.baseStats);
  const best = bestStabMultVsTarget(attacker, defender.types);
  if (best.mult === 0) return 0;
  const stab = best.type ? 1.5 : 1;
  const off = offenseStat(attacker.baseStats, cat) * stab * best.mult;
  const def = defenseStat(defender.baseStats, cat);
  if (def === 0) return Infinity;
  // Include HP in denominator so a 255 HP wall looks bulkier than a 70 HP glass cannon.
  const hp = Math.max(defender.baseStats.hp, 1);
  return off / (def * Math.sqrt(hp));
}

export function threatScores(
  team: EffectiveMon[],
  metaMons: EffectiveMon[],
): ThreatScore[] {
  return metaMons
    .map((m) => {
      const inbound = Math.max(0, ...team.map((p) => damageRatio(m, p)));
      const outbound = Math.max(0, ...team.map((p) => damageRatio(p, m)));
      return {
        species: m.species,
        inboundWorst: inbound,
        outboundBest: outbound,
        net: inbound - outbound,
      };
    })
    .sort((a, b) => b.net - a.net);
}
