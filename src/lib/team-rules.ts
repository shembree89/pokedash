import type { OwnedPokemon } from "../data/types";
import { validateSpread } from "./sp-converter";

export const TEAM_SIZE = 6;
export const BRING_SIZE = 4;

export type TeamViolation =
  | { kind: "duplicate-species"; species: string }
  | { kind: "duplicate-item"; item: string }
  | { kind: "too-many-megas"; count: number }
  | { kind: "invalid-spread"; index: number; species: string }
  | { kind: "wrong-size"; actual: number };

export function validateTeam(mons: OwnedPokemon[]): TeamViolation[] {
  const violations: TeamViolation[] = [];
  if (mons.length !== TEAM_SIZE) {
    violations.push({ kind: "wrong-size", actual: mons.length });
  }
  const speciesSeen = new Map<string, number>();
  const itemSeen = new Map<string, number>();
  let megaCount = 0;
  mons.forEach((m, i) => {
    const sKey = m.species.toLowerCase();
    speciesSeen.set(sKey, (speciesSeen.get(sKey) ?? 0) + 1);
    if (m.item) {
      const iKey = m.item.toLowerCase();
      itemSeen.set(iKey, (itemSeen.get(iKey) ?? 0) + 1);
    }
    if (m.mega) megaCount += 1;
    const spread = validateSpread(m.spSpread);
    if (!spread.ok) {
      violations.push({ kind: "invalid-spread", index: i, species: m.species });
    }
  });
  for (const [species, count] of speciesSeen) {
    if (count > 1) violations.push({ kind: "duplicate-species", species });
  }
  for (const [item, count] of itemSeen) {
    if (count > 1) violations.push({ kind: "duplicate-item", item });
  }
  if (megaCount > 1) violations.push({ kind: "too-many-megas", count: megaCount });
  return violations;
}
