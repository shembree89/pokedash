import { useMemo } from "react";
import { useData } from "./useData";
import { useOwned } from "../store/collection";

export interface AutocompleteSource {
  species: string[];
  items: string[];
  moves: string[];
}

const EMPTY: AutocompleteSource = { species: [], items: [], moves: [] };

function unique(values: Iterable<string>): string[] {
  return Array.from(new Set([...values].map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function useAutocomplete(): AutocompleteSource {
  const status = useData();
  const owned = useOwned();

  return useMemo(() => {
    if (status.state !== "ready") return EMPTY;
    const { pokedex, sets } = status.data;
    const speciesSet = new Set<string>(Object.keys(pokedex.pokemon));
    for (const m of owned) speciesSet.add(m.species);
    const items = new Set<string>();
    const moves = new Set<string>();
    if (sets.distributions) {
      for (const dist of Object.values(sets.distributions)) {
        for (const it of dist.items) items.add(it.name);
        for (const mv of dist.moves) moves.add(mv.name);
      }
    }
    for (const specSets of Object.values(sets.sets)) {
      for (const s of specSets) {
        if (s.item) items.add(s.item);
        for (const m of s.moves) moves.add(m);
      }
    }
    // Include items from owned collection so the user sees their typed items.
    for (const m of owned) {
      if (m.item) items.add(m.item);
      for (const mv of m.moves) if (mv) moves.add(mv);
    }
    return {
      species: unique(speciesSet),
      items: unique(items),
      moves: unique(moves),
    };
  }, [status, owned]);
}
