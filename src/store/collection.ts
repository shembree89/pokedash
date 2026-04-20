import { useSyncExternalStore } from "react";
import type { OwnedPokemon, SavedTeam } from "../data/types";

const OWNED_KEY = "pokedash.owned.v1";
const TEAMS_KEY = "pokedash.teams.v1";

type Listener = () => void;

interface State {
  owned: OwnedPokemon[];
  teams: SavedTeam[];
}

function readOwned(): OwnedPokemon[] {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    return raw ? (JSON.parse(raw) as OwnedPokemon[]) : [];
  } catch {
    return [];
  }
}

function readTeams(): SavedTeam[] {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    return raw ? (JSON.parse(raw) as SavedTeam[]) : [];
  } catch {
    return [];
  }
}

let state: State = { owned: readOwned(), teams: readTeams() };
const listeners = new Set<Listener>();

function persist() {
  localStorage.setItem(OWNED_KEY, JSON.stringify(state.owned));
  localStorage.setItem(TEAMS_KEY, JSON.stringify(state.teams));
}

function emit() {
  for (const fn of listeners) fn();
}

function setState(next: State) {
  state = next;
  persist();
  emit();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getOwned(): OwnedPokemon[] {
  return state.owned;
}

export function getTeams(): SavedTeam[] {
  return state.teams;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function addOwned(mon: Omit<OwnedPokemon, "id" | "createdAt">): OwnedPokemon {
  const created: OwnedPokemon = {
    ...mon,
    id: randomId(),
    createdAt: new Date().toISOString(),
  };
  setState({ ...state, owned: [...state.owned, created] });
  return created;
}

export function addManyOwned(mons: OwnedPokemon[]): void {
  setState({ ...state, owned: [...state.owned, ...mons] });
}

export function updateOwned(id: string, patch: Partial<OwnedPokemon>): void {
  setState({
    ...state,
    owned: state.owned.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  });
}

export function removeOwned(id: string): void {
  setState({
    ...state,
    owned: state.owned.filter((m) => m.id !== id),
    teams: state.teams.map((t) => ({ ...t, ownedIds: t.ownedIds.filter((x) => x !== id) })),
  });
}

export function clearOwned(): void {
  setState({ ...state, owned: [], teams: state.teams.map((t) => ({ ...t, ownedIds: [] })) });
}

export function saveTeam(team: Omit<SavedTeam, "id" | "createdAt" | "updatedAt">): SavedTeam {
  const now = new Date().toISOString();
  const created: SavedTeam = { ...team, id: randomId(), createdAt: now, updatedAt: now };
  setState({ ...state, teams: [...state.teams, created] });
  return created;
}

export function useOwned(): OwnedPokemon[] {
  return useSyncExternalStore(subscribe, getOwned, getOwned);
}

export function useTeams(): SavedTeam[] {
  return useSyncExternalStore(subscribe, getTeams, getTeams);
}
