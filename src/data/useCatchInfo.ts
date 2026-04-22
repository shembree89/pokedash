import { useCallback, useEffect, useState } from "react";
import type { CatchInfo } from "../lib/pokeapi-catch";
import { fetchCatchInfo } from "../lib/pokeapi-catch";
import {
  clearCatchInflight,
  getCachedCatch,
  isCatchInflight,
  isCatchNegativelyCached,
  markCatchInflight,
  setCachedCatch,
  setCatchMiss,
  useCatchCache,
} from "../store/catch-cache";

export type CatchStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; data: CatchInfo }
  | { state: "missing" }
  | { state: "error"; error: Error };

export function useCatchInfo(species: string | null): CatchStatus {
  useCatchCache();
  const [error, setError] = useState<Error | null>(null);

  const ensure = useCallback((s: string) => {
    if (getCachedCatch(s)) return;
    if (isCatchNegativelyCached(s)) return;
    if (isCatchInflight(s)) return;
    markCatchInflight(s);
    fetchCatchInfo(s)
      .then((info) => {
        if (info) setCachedCatch(s, info);
        else setCatchMiss(s);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error(String(e)));
        setCatchMiss(s);
      })
      .finally(() => clearCatchInflight(s));
  }, []);

  useEffect(() => {
    if (species) ensure(species);
  }, [species, ensure]);

  if (!species) return { state: "idle" };
  const cached = getCachedCatch(species);
  if (cached) return { state: "ready", data: cached };
  if (error) return { state: "error", error };
  if (isCatchNegativelyCached(species)) return { state: "missing" };
  return { state: "loading" };
}
