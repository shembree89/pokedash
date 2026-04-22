import { useSyncExternalStore } from "react";

const KEY = "pokedash.wishlist.v1";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

let state: readonly string[] = read();
const listeners = new Set<() => void>();

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

export function isWishlisted(species: string): boolean {
  return state.includes(species);
}

export function toggleWishlist(species: string): void {
  state = state.includes(species)
    ? state.filter((s) => s !== species)
    : [...state, species];
  persist();
  emit();
}

export function reorderWishlist(fromIndex: number, toIndex: number): void {
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= state.length) return;
  if (toIndex < 0 || toIndex >= state.length) return;
  const next = state.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  state = next;
  persist();
  emit();
}

export function replaceWishlist(species: readonly string[]): void {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const s of species) {
    if (typeof s === "string" && !seen.has(s)) {
      seen.add(s);
      next.push(s);
    }
  }
  state = next;
  persist();
  emit();
}

export function useWishlist(): readonly string[] {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
