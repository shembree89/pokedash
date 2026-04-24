import type { MetaDistribution, MetaUsagePair } from "../data/types";

export type ObservedState = "unknown" | "seen" | "ruled-out";

export interface Observation {
  name: string;
  state: ObservedState;
}

export interface PredictedFeature {
  name: string;
  usage: number;
  state: ObservedState;
  conditional?: number;
}

export interface OpponentPrediction {
  species: string;
  moves: PredictedFeature[];
  items: PredictedFeature[];
  abilities: PredictedFeature[];
  movesLocked: boolean;
  itemLocked: boolean;
  abilityLocked: boolean;
}

export const MAX_MOVES = 4;
export const MAX_ITEM = 1;
export const MAX_ABILITY = 1;

const MOVE_THRESHOLD = 0.03;
const ITEM_THRESHOLD = 0.02;
const ABILITY_THRESHOLD = 0.01;

function mergeObserved(
  all: MetaUsagePair[],
  observed: Observation[],
  minUsage: number,
): { name: string; usage: number; state: ObservedState }[] {
  const obsMap = new Map(observed.map((o) => [o.name, o.state]));
  const out = new Map<string, { name: string; usage: number; state: ObservedState }>();
  for (const pair of all) {
    const state = obsMap.get(pair.name) ?? "unknown";
    if (state === "unknown" && pair.usage < minUsage) continue;
    out.set(pair.name, { name: pair.name, usage: pair.usage, state });
  }
  for (const [name, state] of obsMap) {
    if (!out.has(name) && state !== "unknown") {
      out.set(name, { name, usage: 0, state });
    }
  }
  return [...out.values()].sort((a, b) => b.usage - a.usage);
}

function autoLock(
  features: { name: string; usage: number; state: ObservedState }[],
  limit: number,
): { features: { name: string; usage: number; state: ObservedState }[]; locked: boolean } {
  const seenCount = features.filter((f) => f.state === "seen").length;
  if (seenCount < limit) return { features, locked: false };
  return {
    features: features.map((f) => (f.state === "unknown" ? { ...f, state: "ruled-out" } : f)),
    locked: true,
  };
}

function conditionalUsages(
  features: { name: string; usage: number; state: ObservedState }[],
  limit: number,
): PredictedFeature[] {
  const candidates = features.filter((f) => f.state !== "ruled-out");
  const seenCount = candidates.filter((c) => c.state === "seen").length;
  const remaining = limit - seenCount;
  if (remaining <= 0) {
    return features.map((f) => ({ ...f, conditional: f.state === "seen" ? 1 : 0 }));
  }
  const unknowns = candidates.filter((c) => c.state === "unknown");
  const totalUsage = unknowns.reduce((s, u) => s + u.usage, 0) || 1;
  return features.map((f) => {
    if (f.state === "seen") return { ...f, conditional: 1 };
    if (f.state === "ruled-out") return { ...f, conditional: 0 };
    const share = (f.usage / totalUsage) * remaining;
    return { ...f, conditional: Math.min(1, share) };
  });
}

export interface PredictInput {
  species: string;
  distribution: MetaDistribution | undefined;
  observedMoves?: Observation[];
  observedItems?: Observation[];
  observedAbilities?: Observation[];
}

export function predictOpponent(input: PredictInput): OpponentPrediction {
  const empty: MetaUsagePair[] = [];
  const dist = input.distribution;
  const movesIn = dist?.moves ?? empty;
  const itemsIn = dist?.items ?? empty;
  const abilitiesIn = dist?.abilities ?? empty;

  const mergedMoves = mergeObserved(movesIn, input.observedMoves ?? [], MOVE_THRESHOLD);
  const mergedItems = mergeObserved(itemsIn, input.observedItems ?? [], ITEM_THRESHOLD);
  const mergedAbilities = mergeObserved(abilitiesIn, input.observedAbilities ?? [], ABILITY_THRESHOLD);

  const { features: movesLocked, locked: mLocked } = autoLock(mergedMoves, MAX_MOVES);
  const { features: itemsLocked, locked: iLocked } = autoLock(mergedItems, MAX_ITEM);
  const { features: abilityLocked, locked: aLocked } = autoLock(mergedAbilities, MAX_ABILITY);

  return {
    species: input.species,
    moves: conditionalUsages(movesLocked, MAX_MOVES),
    items: conditionalUsages(itemsLocked, MAX_ITEM),
    abilities: conditionalUsages(abilityLocked, MAX_ABILITY),
    movesLocked: mLocked,
    itemLocked: iLocked,
    abilityLocked: aLocked,
  };
}

export interface SetCandidate {
  name?: string;
  usage: number;
  ability?: string;
  item?: string;
  moves: string[];
  mega?: boolean;
}

export function rankSets(
  sets: SetCandidate[],
  prediction: OpponentPrediction,
): { set: SetCandidate; score: number; reasons: string[] }[] {
  const seenMoves = new Set(prediction.moves.filter((m) => m.state === "seen").map((m) => m.name));
  const ruledMoves = new Set(prediction.moves.filter((m) => m.state === "ruled-out").map((m) => m.name));
  const seenItem = prediction.items.find((i) => i.state === "seen")?.name;
  const ruledItems = new Set(prediction.items.filter((i) => i.state === "ruled-out").map((i) => i.name));
  const seenAbility = prediction.abilities.find((a) => a.state === "seen")?.name;

  return sets
    .map((set) => {
      const setMoves = new Set(set.moves);
      let score = Math.log(Math.max(set.usage, 1e-4));
      const reasons: string[] = [];

      let violated = false;
      for (const m of seenMoves) {
        if (!setMoves.has(m)) {
          violated = true;
          break;
        }
      }
      for (const m of ruledMoves) {
        if (setMoves.has(m)) {
          violated = true;
          break;
        }
      }
      if (seenItem && set.item && set.item !== seenItem) violated = true;
      if (set.item && ruledItems.has(set.item)) violated = true;
      if (seenAbility && set.ability && set.ability !== seenAbility) violated = true;

      if (violated) score = -Infinity;

      if (seenMoves.size > 0 && !violated) {
        reasons.push(`matches ${seenMoves.size} seen move${seenMoves.size === 1 ? "" : "s"}`);
      }
      return { set, score, reasons };
    })
    .filter((x) => x.score > -Infinity)
    .sort((a, b) => b.score - a.score);
}
