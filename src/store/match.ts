import { useSyncExternalStore } from "react";
import type { ObservedState } from "../lib/set-predictor";

const KEY = "pokedash.match.v1";

export type MatchPhase = "setup" | "lineup" | "bring" | "active" | "observe" | "end";

export interface ObservedFeature {
  name: string;
  state: ObservedState;
}

export interface OpponentSlot {
  species: string;
  observedMoves: ObservedFeature[];
  observedItems: ObservedFeature[];
  observedAbilities: ObservedFeature[];
  isMegaConfirmed?: boolean;
}

export interface MatchState {
  phase: MatchPhase;
  myTeamId?: string;
  myActiveFour: string[];
  mySlotsOnField: [string | null, string | null];
  opponents: OpponentSlot[];
  oppSlotsOnField: [number | null, number | null];
  startedAt?: string;
  field: {
    trickRoom: boolean;
    tailwindMine: boolean;
    tailwindTheirs: boolean;
    weather: "Sun" | "Rain" | "Sand" | "Snow" | null;
    terrain: "Electric" | "Grassy" | "Misty" | "Psychic" | null;
  };
}

const DEFAULT: MatchState = {
  phase: "setup",
  myActiveFour: [],
  mySlotsOnField: [null, null],
  opponents: [],
  oppSlotsOnField: [null, null],
  field: {
    trickRoom: false,
    tailwindMine: false,
    tailwindTheirs: false,
    weather: null,
    terrain: null,
  },
};

type Listener = () => void;

function read(): MatchState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<MatchState>;
    return { ...DEFAULT, ...parsed, field: { ...DEFAULT.field, ...(parsed.field ?? {}) } };
  } catch {
    return DEFAULT;
  }
}

let state: MatchState = read();
const listeners = new Set<Listener>();

function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function emit() {
  for (const fn of listeners) fn();
}

function setState(next: MatchState) {
  state = next;
  persist();
  emit();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getMatch(): MatchState {
  return state;
}

export function useMatch(): MatchState {
  return useSyncExternalStore(subscribe, getMatch, getMatch);
}

export function setPhase(phase: MatchPhase) {
  setState({ ...state, phase });
}

export function setMyTeam(teamId: string) {
  setState({ ...state, myTeamId: teamId, phase: "lineup" });
}

export function addOpponent(species: string) {
  if (state.opponents.length >= 6) return;
  const slot: OpponentSlot = {
    species,
    observedMoves: [],
    observedItems: [],
    observedAbilities: [],
  };
  setState({ ...state, opponents: [...state.opponents, slot] });
}

export function removeOpponent(index: number) {
  const opponents = state.opponents.filter((_, i) => i !== index);
  setState({ ...state, opponents });
}

export function setOpponents(species: string[]) {
  const opponents: OpponentSlot[] = species.map((sp) => ({
    species: sp,
    observedMoves: [],
    observedItems: [],
    observedAbilities: [],
  }));
  setState({ ...state, opponents });
}

export function setMyFour(ownedIds: string[]) {
  setState({
    ...state,
    myActiveFour: ownedIds,
    phase: "active",
    startedAt: state.startedAt ?? new Date().toISOString(),
  });
}

export function setMySlot(slot: 0 | 1, ownedId: string | null) {
  const next: [string | null, string | null] = [...state.mySlotsOnField];
  next[slot] = ownedId;
  setState({ ...state, mySlotsOnField: next });
}

export function setOppSlot(slot: 0 | 1, opponentIdx: number | null) {
  const next: [number | null, number | null] = [...state.oppSlotsOnField];
  next[slot] = opponentIdx;
  setState({ ...state, oppSlotsOnField: next });
}

export function toggleFeature(
  opponentIdx: number,
  category: "moves" | "items" | "abilities",
  name: string,
  state_: ObservedState,
) {
  const key = `observed${category.charAt(0).toUpperCase() + category.slice(1)}` as
    | "observedMoves"
    | "observedItems"
    | "observedAbilities";
  const opponents = state.opponents.map((opp, i) => {
    if (i !== opponentIdx) return opp;
    const without = opp[key].filter((f) => f.name !== name);
    const next = state_ === "unknown" ? without : [...without, { name, state: state_ }];
    return { ...opp, [key]: next };
  });
  setState({ ...state, opponents });
}

export function setField(field: Partial<MatchState["field"]>) {
  setState({ ...state, field: { ...state.field, ...field } });
}

export function resetMatch() {
  setState(DEFAULT);
}
