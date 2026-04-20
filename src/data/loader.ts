import type { MetaSets, MetaTeams, MetaUsage, Pokedex } from "./types";

const base = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${base}data/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return (await res.json()) as T;
}

export interface DataBundle {
  pokedex: Pokedex;
  usage: MetaUsage;
  sets: MetaSets;
  teams: MetaTeams;
}

let cache: Promise<DataBundle> | null = null;

export function loadData(): Promise<DataBundle> {
  if (!cache) {
    cache = Promise.all([
      fetchJson<Pokedex>("pokedex-champions.json"),
      fetchJson<MetaUsage>("meta-usage.json"),
      fetchJson<MetaSets>("meta-sets.json"),
      fetchJson<MetaTeams>("meta-teams.json"),
    ]).then(([pokedex, usage, sets, teams]) => ({ pokedex, usage, sets, teams }));
  }
  return cache;
}
