import type { EffectiveMon } from "./threat";
import type { MatchupPair } from "./matchup-grid";
import { damageRatio, offenseCategory } from "./threat";

export interface QuartetScore {
  indices: [number, number, number, number];
  team: EffectiveMon[];
  offense: number;
  defense: number;
  speedCoverage: number;
  roleBalance: number;
  total: number;
  reasons: string[];
}

const PHYSICAL_ICONS = { physical: "phys", special: "spec" } as const;

function subsets4(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let a = 0; a < 3; a++)
    for (let b = a + 1; b < 4; b++)
      for (let c = b + 1; c < 5; c++)
        for (let d = c + 1; d < 6; d++) out.push([a, b, c, d]);
  return out;
}

function outboundScore(
  quartet: number[],
  defenders: EffectiveMon[],
  matrix?: MatchupPair[][],
  attackers?: EffectiveMon[],
): number {
  let total = 0;
  for (let j = 0; j < defenders.length; j++) {
    let best = 0;
    for (const i of quartet) {
      if (matrix) {
        const pair = matrix[i]?.[j];
        const pct = pair?.bestMove?.pctMax ?? 0;
        if (pct > best) best = pct;
      } else if (attackers) {
        const r = damageRatio(attackers[i]!, defenders[j]!);
        if (r > best) best = r;
      }
    }
    total += best;
  }
  return total;
}

function inboundScore(
  quartet: number[],
  defenders: EffectiveMon[],
  matrix?: MatchupPair[][],
  attackers?: EffectiveMon[],
): number {
  let total = 0;
  for (let j = 0; j < defenders.length; j++) {
    let worst = 0;
    for (const i of quartet) {
      if (matrix) {
        const reverse = matrix[j]?.[i];
        const pct = reverse?.bestMove?.pctMax ?? 0;
        if (pct > worst) worst = pct;
      } else if (attackers) {
        const r = damageRatio(defenders[j]!, attackers[i]!);
        if (r > worst) worst = r;
      }
    }
    total += worst;
  }
  return total;
}

function speedCoverage(quartet: number[], attackers: EffectiveMon[], defenders: EffectiveMon[], trickRoom: boolean): number {
  let covered = 0;
  for (const d of defenders) {
    const outspeed = quartet.some((i) => {
      const a = attackers[i]!;
      if (a.stats.spe === d.stats.spe) return false;
      return trickRoom ? a.stats.spe < d.stats.spe : a.stats.spe > d.stats.spe;
    });
    if (outspeed) covered += 1;
  }
  return covered;
}

function roleBalance(quartet: number[], attackers: EffectiveMon[]): number {
  const cats = new Set<string>();
  for (const i of quartet) cats.add(PHYSICAL_ICONS[offenseCategory(attackers[i]!)]);
  return cats.size;
}

function topThreats(
  quartet: number[],
  defenders: EffectiveMon[],
  attackers: EffectiveMon[],
  matrix?: MatchupPair[][],
): string[] {
  const perDefender = defenders.map((d, j) => {
    let best = { mon: "", pct: 0, move: "", eff: 1, koText: "" };
    for (const i of quartet) {
      const pair = matrix?.[i]?.[j];
      const pct = pair?.bestMove?.pctMax ?? 0;
      if (pct > best.pct) {
        best = {
          mon: attackers[i]!.species,
          pct,
          move: pair?.bestMove?.move.name ?? "",
          eff: pair?.bestMove?.effectiveness ?? 1,
          koText: pair?.bestMove?.koChanceText ?? "",
        };
      }
    }
    return { defender: d.species, ...best };
  });

  const wins = perDefender
    .filter((p) => p.pct >= 100 || /OHKO|2HKO/.test(p.koText))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2)
    .map((p) => `${p.mon} ${p.koText || `hits ${Math.round(p.pct)}%`} on ${p.defender}`);

  const struggles = perDefender
    .filter((p) => p.pct < 30)
    .slice(0, 1)
    .map((p) => `weak into ${p.defender}`);

  return [...wins, ...struggles];
}

export interface RankQuartetsOptions {
  matrix?: MatchupPair[][];
  trickRoom?: boolean;
}

export function rankQuartets(
  team: EffectiveMon[],
  opponents: EffectiveMon[],
  opts: RankQuartetsOptions = {},
): QuartetScore[] {
  if (team.length !== 6) throw new Error(`team must have 6 members, got ${team.length}`);
  const { matrix, trickRoom = false } = opts;

  const scores: QuartetScore[] = [];
  for (const indices of subsets4()) {
    const quartet = indices.map((i) => team[i]!);
    const offense = outboundScore(indices, opponents, matrix, team);
    const defense = inboundScore(indices, opponents, matrix, team);
    const speed = speedCoverage(indices, team, opponents, trickRoom);
    const balance = roleBalance(indices, team);

    const oNorm = matrix ? offense / 100 : offense * 10;
    const dNorm = matrix ? defense / 100 : defense * 10;
    const total = oNorm - dNorm + speed * 0.5 + (balance === 2 ? 0.3 : 0);

    const reasons = topThreats(indices, opponents, team, matrix);
    if (speed >= 4) reasons.push(`outspeeds ${speed}/${opponents.length}`);
    else if (speed <= 1) reasons.push(`slow vs ${opponents.length - speed}/${opponents.length}`);

    scores.push({
      indices,
      team: quartet,
      offense,
      defense,
      speedCoverage: speed,
      roleBalance: balance,
      total,
      reasons,
    });
  }
  return scores.sort((a, b) => b.total - a.total);
}

export function topQuartets(
  team: EffectiveMon[],
  opponents: EffectiveMon[],
  opts: RankQuartetsOptions = {},
  n = 3,
): QuartetScore[] {
  return rankQuartets(team, opponents, opts).slice(0, n);
}
