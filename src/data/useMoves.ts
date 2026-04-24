import { useMemo } from "react";
import { useData } from "./useData";
import type { MoveMeta } from "./types";

export interface MovesLookup {
  all: MoveMeta[];
  byName: Map<string, MoveMeta>;
  get(name: string): MoveMeta | undefined;
}

const EMPTY: MovesLookup = {
  all: [],
  byName: new Map(),
  get: () => undefined,
};

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function useMoves(): MovesLookup {
  const status = useData();
  return useMemo(() => {
    if (status.state !== "ready" || !status.data.moves) return EMPTY;
    const { moves } = status.data.moves;
    const byName = new Map<string, MoveMeta>();
    for (const m of moves) {
      byName.set(m.name, m);
      byName.set(normalizeKey(m.name), m);
    }
    return {
      all: moves,
      byName,
      get: (name: string) => byName.get(name) ?? byName.get(normalizeKey(name)),
    };
  }, [status]);
}
