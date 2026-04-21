import type {
  DexEntry,
  DexMega,
  Nature,
  OwnedPokemon,
  PokemonType,
  SpSpread,
  StatKey,
} from "../data/types";
import { ALL_TYPES, typeMult } from "./type-chart";
import { calcAllStats } from "./stats";

export interface EffectiveMon {
  species: string;
  types: readonly PokemonType[];
  baseStats: Record<StatKey, number>;
  stats: Record<StatKey, number>;
  ability?: string;
  nature?: Nature;
  spSpread?: SpSpread;
}

// Used when building an EffectiveMon from pokedex alone (no user data).
// Represents a generic bulky-offense build so meta mons aren't unfairly
// weak next to users' spread-optimized team members.
export function defaultCompetitiveSpread(base: Record<StatKey, number>): {
  spread: SpSpread;
  nature: Nature;
} {
  const physical = base.atk >= base.spa;
  const spread: SpSpread = {
    hp: 32, atk: 0, def: 4, spa: 0, spd: 4, spe: 26,
  };
  if (physical) spread.atk = 32;
  else spread.spa = 32;
  return {
    spread,
    nature: physical ? "Adamant" : "Modest",
  };
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
    const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    return {
      species: mon.species,
      types: [],
      baseStats: zero,
      stats: zero,
      ability: mon.ability,
      nature: mon.nature,
      spSpread: mon.spSpread,
    };
  }
  let species = entry.name;
  let types = entry.types;
  let baseStats = entry.baseStats;
  let ability = mon.ability || entry.abilities[0];
  if (mon.mega) {
    const mega = dexMegaMatchForItem(entry, mon.item) ?? entry.megas?.[0];
    if (mega) {
      species = mega.name;
      types = mega.types;
      baseStats = mega.baseStats;
      ability = mega.ability;
    }
  }
  const stats = calcAllStats(baseStats, mon.spSpread, mon.nature);
  return {
    species,
    types,
    baseStats,
    stats,
    ability,
    nature: mon.nature,
    spSpread: mon.spSpread,
  };
}

// Build an EffectiveMon for a meta pokemon where we don't know SP/nature.
// Uses defaultCompetitiveSpread heuristic so comparisons against users'
// spread-enabled team members stay apples-to-apples.
export function resolveMeta(entry: DexEntry, useMega = false): EffectiveMon {
  const mega = useMega ? entry.megas?.[0] : undefined;
  const baseStats = mega?.baseStats ?? entry.baseStats;
  const types = mega?.types ?? entry.types;
  const species = mega?.name ?? entry.name;
  const ability = mega?.ability ?? entry.abilities[0];
  const { spread, nature } = defaultCompetitiveSpread(baseStats);
  const stats = calcAllStats(baseStats, spread, nature);
  return { species, types, baseStats, stats, ability, nature, spSpread: spread };
}

// For coverage, assume each mon projects moves of both its STAB types.
// Primary offensive category: whichever attack stat is higher (after
// nature/SP if available).
export type OffenseCategory = "physical" | "special";

export function offenseCategory(mon: EffectiveMon): OffenseCategory {
  return mon.stats.atk >= mon.stats.spa ? "physical" : "special";
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
  const cat = offenseCategory(attacker);
  const best = bestStabMultVsTarget(attacker, defender.types);
  if (best.mult === 0) return 0;
  const stab = best.type ? 1.5 : 1;
  const off = offenseStat(attacker.stats, cat) * stab * best.mult;
  const def = defenseStat(defender.stats, cat);
  if (def === 0) return Infinity;
  // Include HP in denominator so a 255 HP wall looks bulkier than a 70 HP glass cannon.
  const hp = Math.max(defender.stats.hp, 1);
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
