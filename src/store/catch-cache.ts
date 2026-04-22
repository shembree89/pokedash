import { useSyncExternalStore } from "react";
import type { CatchInfo } from "../lib/pokeapi-catch";

const KEY = "pokedash.catchCache.v2";
const NEG_TTL_MS = 24 * 60 * 60 * 1000;

interface Cache {
  entries: Record<string, CatchInfo>;
  misses: Record<string, number>;
}

function read(): Cache {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { entries: {}, misses: {} };
    return JSON.parse(raw) as Cache;
  } catch {
    return { entries: {}, misses: {} };
  }
}

let state: Cache = read();
const listeners = new Set<() => void>();
const inflight = new Set<string>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or private mode — ignore */
  }
}

function emit() {
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCachedCatch(species: string): CatchInfo | undefined {
  return state.entries[species];
}

export function isCatchNegativelyCached(species: string): boolean {
  const ts = state.misses[species];
  return !!ts && Date.now() - ts < NEG_TTL_MS;
}

export function setCachedCatch(species: string, info: CatchInfo): void {
  state = {
    entries: { ...state.entries, [species]: info },
    misses: { ...state.misses },
  };
  delete state.misses[species];
  persist();
  emit();
}

export function setCatchMiss(species: string): void {
  state = {
    entries: state.entries,
    misses: { ...state.misses, [species]: Date.now() },
  };
  persist();
  emit();
}

export function isCatchInflight(species: string): boolean {
  return inflight.has(species);
}

export function markCatchInflight(species: string): void {
  inflight.add(species);
}

export function clearCatchInflight(species: string): void {
  inflight.delete(species);
}

export function useCatchCache(): Cache {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
