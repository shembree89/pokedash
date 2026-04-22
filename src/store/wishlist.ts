import { useSyncExternalStore } from "react";

const KEY = "pokedash.wishlist.v1";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

let state: ReadonlySet<string> = new Set(read());
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...state]));
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

export function isWishlisted(species: string): boolean {
  return state.has(species);
}

export function toggleWishlist(species: string): void {
  const next = new Set(state);
  if (next.has(species)) next.delete(species);
  else next.add(species);
  state = next;
  persist();
  emit();
}

export function useWishlist(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
