// Enrich public/data/pokedex-champions.json with base-form entries from
// PokeAPI for any species listed in meta-usage.json that are missing.
// Preserves existing entries (including hand-curated mega forms).

import { readFile, writeFile } from "node:fs/promises";
import { sleep, USER_AGENT } from "./pikalytics.ts";

const POKEAPI = "https://pokeapi.co/api/v2";
const REQUEST_DELAY_MS = 200;

type Stat = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

const STAT_MAP: Record<string, Stat> = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

const POKEAPI_NAME_OVERRIDE: Record<string, string> = {
  Basculegion: "basculegion-male",
  Maushold: "maushold-family-of-three",
  Aegislash: "aegislash-shield",
  Palafin: "palafin-zero",
};

function pokeapiName(species: string): string {
  return POKEAPI_NAME_OVERRIDE[species] ?? species.toLowerCase();
}

interface PokeApiPokemon {
  name: string;
  types: { slot: number; type: { name: string } }[];
  abilities: { ability: { name: string }; is_hidden: boolean }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

const TYPE_CAP: Record<string, string> = {
  normal: "Normal", fire: "Fire", water: "Water", electric: "Electric", grass: "Grass",
  ice: "Ice", fighting: "Fighting", poison: "Poison", ground: "Ground", flying: "Flying",
  psychic: "Psychic", bug: "Bug", rock: "Rock", ghost: "Ghost", dragon: "Dragon",
  dark: "Dark", steel: "Steel", fairy: "Fairy",
};

function cap(s: string): string {
  return s.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

async function fetchApi(name: string): Promise<PokeApiPokemon | null> {
  const res = await fetch(`${POKEAPI}/pokemon/${name}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PokeAPI ${name}: ${res.status}`);
  return (await res.json()) as PokeApiPokemon;
}

async function main() {
  const usage = JSON.parse(
    await readFile("public/data/meta-usage.json", "utf8"),
  ) as { pokemon: { species: string }[] };
  const dex = JSON.parse(
    await readFile("public/data/pokedex-champions.json", "utf8"),
  ) as {
    refreshedAt: string;
    source: string;
    pokemon: Record<string, Record<string, unknown>>;
  };

  const needed = usage.pokemon
    .map((p) => p.species)
    .filter((s) => !dex.pokemon[s]);

  if (needed.length === 0) {
    console.log("[enrich] nothing missing");
    return;
  }

  console.log(`[enrich] fetching ${needed.length} missing species from PokeAPI…`);
  for (const [i, species] of needed.entries()) {
    const api = pokeapiName(species);
    process.stdout.write(`\r[enrich] ${i + 1}/${needed.length} ${species}         `);
    try {
      const data = await fetchApi(api);
      if (!data) {
        console.warn(`\n[enrich] ${species} → ${api}: 404, skipping`);
        continue;
      }
      const types = data.types.sort((a, b) => a.slot - b.slot).map((t) => TYPE_CAP[t.type.name] ?? t.type.name);
      const baseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      for (const s of data.stats) {
        const key = STAT_MAP[s.stat.name];
        if (key) baseStats[key] = s.base_stat;
      }
      const abilities = data.abilities
        .sort((a, b) => Number(a.is_hidden) - Number(b.is_hidden))
        .map((a) => cap(a.ability.name));
      dex.pokemon[species] = {
        name: species,
        types,
        baseStats,
        abilities,
      };
    } catch (e) {
      console.warn(`\n[enrich] ${species}: ${(e as Error).message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }
  process.stdout.write("\n");

  dex.refreshedAt = new Date().toISOString().slice(0, 10);
  dex.source = dex.source.includes("pokeapi")
    ? dex.source
    : `${dex.source}; enriched via pokeapi.co/api/v2/pokemon`;
  await writeFile("public/data/pokedex-champions.json", JSON.stringify(dex, null, 2) + "\n", "utf8");
  console.log(`[enrich] wrote pokedex-champions.json with ${Object.keys(dex.pokemon).length} entries`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
