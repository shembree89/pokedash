// Enrich public/data/pokedex-champions.json with base-form entries from
// PokeAPI. Seeds from PokeAPI's `champions` pokedex (the in-game Reg M-A
// legal list) plus anything in meta-usage and meta-teams.
// Preserves existing entries (including hand-curated mega forms).

import { readFile, writeFile } from "node:fs/promises";
import { sleep, USER_AGENT } from "./pikalytics.ts";

const POKEAPI = "https://pokeapi.co/api/v2";
const REQUEST_DELAY_MS = 200;
const CHAMPIONS_POKEDEX_SLUG = "champions";

interface PokedexResponse {
  pokemon_entries: { pokemon_species: { name: string } }[];
}

async function fetchChampionsList(): Promise<string[]> {
  const res = await fetch(`${POKEAPI}/pokedex/${CHAMPIONS_POKEDEX_SLUG}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    console.warn(`[enrich] champions pokedex fetch failed (${res.status}); falling back to usage-only seed`);
    return [];
  }
  const data = (await res.json()) as PokedexResponse;
  return data.pokemon_entries.map((e) => e.pokemon_species.name);
}

// Slugs that have a non-default English display name. Add as needed.
const SLUG_TO_DISPLAY: Record<string, string> = {
  "mr-mime": "Mr. Mime",
  "mime-jr": "Mime Jr.",
  "mr-rime": "Mr. Rime",
  "type-null": "Type: Null",
  farfetchd: "Farfetch'd",
  sirfetchd: "Sirfetch'd",
  "ho-oh": "Ho-Oh",
  "porygon-z": "Porygon-Z",
  "jangmo-o": "Jangmo-o",
  "hakamo-o": "Hakamo-o",
  "kommo-o": "Kommo-o",
  "nidoran-f": "Nidoran-F",
  "nidoran-m": "Nidoran-M",
  "tapu-koko": "Tapu Koko",
  "tapu-lele": "Tapu Lele",
  "tapu-bulu": "Tapu Bulu",
  "tapu-fini": "Tapu Fini",
};

function displayFromSlug(slug: string): string {
  if (SLUG_TO_DISPLAY[slug]) return SLUG_TO_DISPLAY[slug];
  // Default: title-case each hyphen-separated part, join with spaces.
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

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
  Mimikyu: "mimikyu-disguised",
  Gourgeist: "gourgeist-average",
  Meowstic: "meowstic-male",
  Lycanroc: "lycanroc-midday",
  Morpeko: "morpeko-full-belly",
  Toxtricity: "toxtricity-amped",
  Indeedee: "indeedee-male",
  Oricorio: "oricorio-baile",
  Wishiwashi: "wishiwashi-solo",
  Eiscue: "eiscue-ice",
  Mimejr: "mime-jr", // safety
  Pumpkaboo: "pumpkaboo-average",
  Minior: "minior-red-meteor",
  Tatsugiri: "tatsugiri-curly",
  // Pikalytics/team-data form names that map to specific PokeAPI slugs:
  "Tauros-Paldea-Aqua": "tauros-paldea-aqua-breed",
  "Tauros-Paldea-Blaze": "tauros-paldea-blaze-breed",
  "Tauros-Paldea-Combat": "tauros-paldea-combat-breed",
  "Maushold-Four": "maushold-family-of-four",
  // Sinistcha-Masterpiece is gameplay-only — fall back to base entry.
  "Sinistcha-Masterpiece": "sinistcha",
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
  const teams = JSON.parse(
    await readFile("public/data/meta-teams.json", "utf8"),
  ) as { teams: { pokemon: { species: string }[] }[] };
  const dex = JSON.parse(
    await readFile("public/data/pokedex-champions.json", "utf8"),
  ) as {
    refreshedAt: string;
    source: string;
    pokemon: Record<string, Record<string, unknown>>;
  };

  // Canonicalize species names case-insensitively so variant spellings
  // like "Kommo-o" vs "Kommo-O" don't both end up in the pokedex.
  const canonKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

  console.log(`[enrich] fetching legal species list from /pokedex/${CHAMPIONS_POKEDEX_SLUG}…`);
  const legalSlugs = await fetchChampionsList();
  console.log(`[enrich] ${legalSlugs.length} legal species in Champions pokedex`);

  // Map every species we want in the pokedex to (display, slug). Higher
  // priority sources (Pikalytics, existing dex, teams) win on display
  // name; the champions list only adds species the others didn't cover.
  type Wanted = { display: string; slug?: string };
  const wanted = new Map<string, Wanted>();

  for (const s of usage.pokemon.map((p) => p.species)) {
    wanted.set(canonKey(s), { display: s });
  }
  for (const s of Object.keys(dex.pokemon)) {
    if (!wanted.has(canonKey(s))) wanted.set(canonKey(s), { display: s });
  }
  for (const t of teams.teams) {
    for (const m of t.pokemon) {
      if (!wanted.has(canonKey(m.species))) {
        wanted.set(canonKey(m.species), { display: m.species });
      }
    }
  }
  for (const slug of legalSlugs) {
    const display = displayFromSlug(slug);
    const k = canonKey(display);
    if (!wanted.has(k)) {
      wanted.set(k, { display, slug });
    } else {
      // Existing entry from a higher-priority source — record the slug
      // so we use it for PokeAPI lookups instead of guessing.
      const existing = wanted.get(k)!;
      if (!existing.slug) existing.slug = slug;
    }
  }

  const needed = [...wanted.values()]
    .filter((w) => !dex.pokemon[w.display] && !Object.keys(dex.pokemon).some((k) => canonKey(k) === canonKey(w.display)));

  if (needed.length === 0) {
    console.log("[enrich] nothing missing");
    return;
  }

  console.log(`[enrich] fetching ${needed.length} missing species from PokeAPI…`);
  for (const [i, w] of needed.entries()) {
    const species = w.display;
    // Form-specific overrides win over the bare slug from /pokedex/champions
    // (e.g. Mimikyu base 404s — needs mimikyu-disguised).
    const api = POKEAPI_NAME_OVERRIDE[species] ?? w.slug ?? species.toLowerCase();
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
