import type {
  LocationsFile,
  MetaSets,
  MetaTeams,
  MetaUsage,
  MovesFile,
  Pokedex,
} from "./types";

const base = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${base}data/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return (await res.json()) as T;
}

async function fetchJsonOptional<T>(path: string): Promise<T | null> {
  const url = `${base}data/${path}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return (await res.json()) as T;
}

export interface DataBundle {
  pokedex: Pokedex;
  usage: MetaUsage;
  sets: MetaSets;
  teams: MetaTeams;
  locations: LocationsFile | null;
  moves: MovesFile | null;
}

let cache: Promise<DataBundle> | null = null;

export function loadData(): Promise<DataBundle> {
  if (!cache) {
    cache = Promise.all([
      fetchJson<Pokedex>("pokedex-champions.json"),
      fetchJson<MetaUsage>("meta-usage.json"),
      fetchJson<MetaSets>("meta-sets.json"),
      fetchJson<MetaTeams>("meta-teams.json"),
      fetchJsonOptional<LocationsFile>("locations.json"),
      fetchJsonOptional<MovesFile>("moves.json"),
    ]).then(([pokedex, usage, sets, teams, locations, moves]) => ({
      pokedex,
      usage,
      sets,
      teams,
      locations,
      moves,
    }));
  }
  return cache;
}
