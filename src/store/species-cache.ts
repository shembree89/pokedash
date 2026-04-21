import { useSyncExternalStore } from "react";
import type { DexEntry } from "../data/types";

const KEY = "pokedash.dexCache.v1";
const NEG_TTL_MS = 24 * 60 * 60 * 1000;

interface Cache {
  entries: Record<string, DexEntry>;
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

export function getCached(species: string): DexEntry | undefined {
  return state.entries[species];
}

export function isNegativelyCached(species: string): boolean {
  const ts = state.misses[species];
  return !!ts && Date.now() - ts < NEG_TTL_MS;
}

export function setCached(species: string, entry: DexEntry): void {
  state = {
    entries: { ...state.entries, [species]: entry },
    misses: { ...state.misses },
  };
  delete state.misses[species];
  persist();
  emit();
}

export function setMiss(species: string): void {
  state = {
    entries: state.entries,
    misses: { ...state.misses, [species]: Date.now() },
  };
  persist();
  emit();
}

export function isInflight(species: string): boolean {
  return inflight.has(species);
}

export function markInflight(species: string): void {
  inflight.add(species);
}

export function clearInflight(species: string): void {
  inflight.delete(species);
}

export function useDexCache(): Cache {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
