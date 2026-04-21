import { useCallback } from "react";
import type { DexEntry } from "./types";
import { useData } from "./useData";
import {
  clearInflight,
  getCached,
  isInflight,
  isNegativelyCached,
  markInflight,
  setCached,
  setMiss,
  useDexCache,
} from "../store/species-cache";
import { fetchSpecies } from "../lib/pokeapi-lookup";

export interface Dex {
  lookup: (species: string) => DexEntry | undefined;
  ensure: (species: string) => void;
  ensureMany: (species: readonly string[]) => void;
}

export function useDex(): Dex {
  const status = useData();
  useDexCache(); // subscribe so lookups re-render when cache updates

  const lookup = useCallback(
    (species: string): DexEntry | undefined => {
      if (!species) return undefined;
      if (status.state === "ready") {
        const built = status.data.pokedex.pokemon[species];
        if (built) return built;
      }
      return getCached(species);
    },
    [status],
  );

  const ensure = useCallback(
    (species: string) => {
      if (!species) return;
      if (lookup(species)) return;
      if (isInflight(species)) return;
      if (isNegativelyCached(species)) return;
      markInflight(species);
      fetchSpecies(species)
        .then((entry) => {
          if (entry) setCached(species, entry);
          else setMiss(species);
        })
        .catch(() => setMiss(species))
        .finally(() => clearInflight(species));
    },
    [lookup],
  );

  const ensureMany = useCallback(
    (species: readonly string[]) => {
      for (const s of species) ensure(s);
    },
    [ensure],
  );

  return { lookup, ensure, ensureMany };
}
