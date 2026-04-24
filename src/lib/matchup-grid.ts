import type { MoveMeta, PokemonType } from "../data/types";
import type { EffectiveMon } from "./threat";
import { bandFor, typeMult, type EffectivenessBand } from "./type-chart";
import { calcDamage, type MatchField } from "./calc-adapter";

export type SpeedRelation = "faster" | "slower" | "tied";

export interface MatchupPair {
  attacker: EffectiveMon;
  defender: EffectiveMon;
  effectiveness: { mult: number; band: EffectivenessBand };
  speedRelation: SpeedRelation;
  bestMove?: BestMoveResult;
}

export interface BestMoveResult {
  move: MoveMeta;
  pctMin: number;
  pctMax: number;
  desc: string;
  koChance: number;
  koChanceText: string;
  effectiveness: number;
}

function typeMatch(move: MoveMeta, attacker: EffectiveMon): boolean {
  return move.category !== "Status" && attacker.types.includes(move.type as PokemonType);
}

function speedRelation(a: EffectiveMon, b: EffectiveMon, trickRoom: boolean): SpeedRelation {
  const aSpe = a.stats.spe;
  const bSpe = b.stats.spe;
  if (aSpe === bSpe) return "tied";
  const faster = trickRoom ? aSpe < bSpe : aSpe > bSpe;
  return faster ? "faster" : "slower";
}

export interface MatchupOptions {
  field?: MatchField;
  attackerItem?: string;
  defenderItem?: string;
  candidateMoves?: string[];
}

export async function bestMoveAgainst(
  attacker: EffectiveMon,
  defender: EffectiveMon,
  candidateMoveNames: string[],
  movesByName: Map<string, MoveMeta>,
  opts: MatchupOptions = {},
): Promise<BestMoveResult | undefined> {
  const seen = new Set<string>();
  const ranked: { meta: MoveMeta; priority: number }[] = [];

  for (const name of candidateMoveNames) {
    const meta = movesByName.get(name);
    if (!meta) continue;
    if (meta.category === "Status") continue;
    if (seen.has(meta.name)) continue;
    seen.add(meta.name);
    const eff = typeMult(meta.type as PokemonType, defender.types);
    const stab = typeMatch(meta, attacker) ? 1.5 : 1;
    ranked.push({ meta, priority: meta.basePower * eff * stab });
  }
  ranked.sort((a, b) => b.priority - a.priority);

  const topN = ranked.slice(0, 5);
  let best: BestMoveResult | undefined;
  for (const { meta } of topN) {
    const result = await calcDamage({
      attacker,
      defender,
      move: meta.name,
      attackerItem: opts.attackerItem,
      defenderItem: opts.defenderItem,
      field: opts.field,
    });
    if (!result) continue;
    const eff = typeMult(meta.type as PokemonType, defender.types);
    const candidate: BestMoveResult = {
      move: meta,
      pctMin: result.pctMin,
      pctMax: result.pctMax,
      desc: result.desc,
      koChance: result.koChance,
      koChanceText: result.koChanceText,
      effectiveness: eff,
    };
    if (!best || candidate.pctMax > best.pctMax) best = candidate;
  }
  return best;
}

export function effectivenessOf(attacker: EffectiveMon, defender: EffectiveMon): { mult: number; band: EffectivenessBand } {
  const hits = attacker.types.map((t) => typeMult(t, defender.types));
  const mult = Math.max(0, ...hits);
  return { mult, band: bandFor(mult) };
}

export async function buildMatchupPair(
  attacker: EffectiveMon,
  defender: EffectiveMon,
  attackerMoves: string[],
  movesByName: Map<string, MoveMeta>,
  opts: MatchupOptions = {},
): Promise<MatchupPair> {
  const trickRoom = opts.field?.isTrickRoom ?? false;
  const bestMove = await bestMoveAgainst(attacker, defender, attackerMoves, movesByName, opts);
  return {
    attacker,
    defender,
    effectiveness: effectivenessOf(attacker, defender),
    speedRelation: speedRelation(attacker, defender, trickRoom),
    bestMove,
  };
}

export async function buildMatchupMatrix(
  attackers: EffectiveMon[],
  defenders: EffectiveMon[],
  attackerMoves: Map<string, string[]>,
  movesByName: Map<string, MoveMeta>,
  opts: MatchupOptions = {},
): Promise<MatchupPair[][]> {
  const out: MatchupPair[][] = [];
  for (const a of attackers) {
    const row: MatchupPair[] = [];
    for (const d of defenders) {
      const moves = attackerMoves.get(a.species) ?? [];
      row.push(await buildMatchupPair(a, d, moves, movesByName, opts));
    }
    out.push(row);
  }
  return out;
}
