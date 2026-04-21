import type { DexEntry, PokemonType, StatKey } from "../data/types";

const POKEAPI = "https://pokeapi.co/api/v2";

const NAME_OVERRIDE: Record<string, string> = {
  Basculegion: "basculegion-male",
  Maushold: "maushold-family-of-three",
  Aegislash: "aegislash-shield",
  Palafin: "palafin-zero",
};

const STAT_MAP: Record<string, StatKey> = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

const TYPE_CAP: Record<string, PokemonType> = {
  normal: "Normal", fire: "Fire", water: "Water", electric: "Electric", grass: "Grass",
  ice: "Ice", fighting: "Fighting", poison: "Poison", ground: "Ground", flying: "Flying",
  psychic: "Psychic", bug: "Bug", rock: "Rock", ghost: "Ghost", dragon: "Dragon",
  dark: "Dark", steel: "Steel", fairy: "Fairy",
};

function apiName(species: string): string {
  if (NAME_OVERRIDE[species]) return NAME_OVERRIDE[species];
  return species.toLowerCase();
}

function cap(s: string): string {
  return s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

interface PokeApiPokemon {
  types: { slot: number; type: { name: string } }[];
  abilities: { ability: { name: string }; is_hidden: boolean }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

export async function fetchSpecies(species: string): Promise<DexEntry | null> {
  const res = await fetch(`${POKEAPI}/pokemon/${apiName(species)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PokeAPI ${species}: ${res.status}`);
  const data = (await res.json()) as PokeApiPokemon;
  const types = data.types
    .sort((a, b) => a.slot - b.slot)
    .map((t) => TYPE_CAP[t.type.name])
    .filter(Boolean);
  const baseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const s of data.stats) {
    const key = STAT_MAP[s.stat.name];
    if (key) baseStats[key] = s.base_stat;
  }
  const abilities = data.abilities
    .sort((a, b) => Number(a.is_hidden) - Number(b.is_hidden))
    .map((a) => cap(a.ability.name));
  if (types.length === 0) return null;
  return {
    name: species,
    types: types as DexEntry["types"],
    baseStats,
    abilities,
  };
}
