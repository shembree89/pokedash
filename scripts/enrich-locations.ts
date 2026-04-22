import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as cheerio from "cheerio";
import { sleep, USER_AGENT } from "./pikalytics.ts";

const POKEMONDB_BASE = "https://pokemondb.net";
const POKEAPI = "https://pokeapi.co/api/v2";
const POKEMONDB_DELAY_MS = 2500;
const POKEAPI_DELAY_MS = 200;
const CACHE_DIR = ".cache/pokemondb";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const ALLOWED_GAMES = new Set([
  "sword",
  "shield",
  "brilliant-diamond",
  "shining-pearl",
  "legends-arceus",
  "scarlet",
  "violet",
  "legends-z-a",
]);

const GAME_DISPLAY: Record<string, string> = {
  sword: "Sword",
  shield: "Shield",
  "brilliant-diamond": "Brilliant Diamond",
  "shining-pearl": "Shining Pearl",
  "legends-arceus": "Legends: Arceus",
  scarlet: "Scarlet",
  violet: "Violet",
  "legends-z-a": "Legends: Z-A",
};

const GAME_ORDER = [
  "sword",
  "shield",
  "brilliant-diamond",
  "shining-pearl",
  "legends-arceus",
  "scarlet",
  "violet",
  "legends-z-a",
];

// Meta species with regional/unique forms that pokemondb serves from the base
// slug. Keys are how species appear in meta-usage; values are the pokemondb
// URL slug.
const SLUG_OVERRIDE: Record<string, string> = {
  "Ninetales-Alola": "ninetales",
  "Arcanine-Hisui": "arcanine",
  "Typhlosion-Hisui": "typhlosion",
  "Rotom-Wash": "rotom",
  "Rotom-Heat": "rotom",
  "Floette-Eternal": "floette",
  "Basculegion": "basculegion",
  "Aegislash": "aegislash",
  "Palafin": "palafin",
  "Maushold": "maushold",
};

// Some meta forms have no pokemon-species entry of their own (regional forms,
// unique formes). Map to the base species so the chain walk finds an
// evolution tree.
const POKEAPI_SPECIES_OVERRIDE: Record<string, string> = {
  "Ninetales-Alola": "ninetales",
  "Arcanine-Hisui": "arcanine",
  "Typhlosion-Hisui": "typhlosion",
  "Rotom-Wash": "rotom",
  "Rotom-Heat": "rotom",
  "Floette-Eternal": "floette",
  "Indeedee-F": "indeedee",
  Basculegion: "basculegion",
  Maushold: "maushold",
  Aegislash: "aegislash",
  Palafin: "palafin",
};

export interface Location {
  name: string;
  path?: string;
}

export interface GameLocationGroup {
  games: string[];
  locations: Location[];
}

export interface SpeciesLocations {
  species: string;
  groups: GameLocationGroup[];
}

interface LocationsFile {
  refreshedAt: string;
  source: string;
  species: Record<string, SpeciesLocations>;
}

function toPokemondbSlug(species: string): string {
  if (SLUG_OVERRIDE[species]) return SLUG_OVERRIDE[species];
  return species.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

function toPokeapiSpecies(species: string): string {
  return POKEAPI_SPECIES_OVERRIDE[species] ?? species.toLowerCase();
}

async function fetchCached(url: string, cachePath: string): Promise<string | null> {
  if (existsSync(cachePath)) {
    const { mtimeMs } = await stat(cachePath);
    if (Date.now() - mtimeMs < CACHE_MAX_AGE_MS) {
      return readFile(cachePath, "utf8");
    }
  }
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  const body = await res.text();
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, body, "utf8");
  return body;
}

function parseLocations(html: string): GameLocationGroup[] {
  const $ = cheerio.load(html);
  const heading = $("h2").filter((_, el) => /^\s*Where to find/i.test($(el).text())).first();
  if (!heading.length) return [];
  const table = heading.nextAll("div.resp-scroll").first().find("table.vitals-table").first()
    .add(heading.nextAll("table.vitals-table").first())
    .first();
  if (!table.length) return [];

  const groups: GameLocationGroup[] = [];
  table.find("tbody > tr").each((_, tr) => {
    const row = $(tr);
    const slugs: string[] = [];
    row.find("th span.igame").each((__, span) => {
      const cls = $(span).attr("class") ?? "";
      const m = cls.match(/igame\s+([a-z0-9-]+)/);
      if (m) slugs.push(m[1]);
    });
    const keptSlugs = slugs.filter((s) => ALLOWED_GAMES.has(s));
    if (keptSlugs.length === 0) return;

    const td = row.find("td").first();
    const cellText = td.text().trim();
    if (/Not available in this game|Unobtainable|Location data not yet available/i.test(cellText)) {
      return;
    }

    const locations: Location[] = [];
    td.find("a[href^='/location/']").each((__, a) => {
      const href = $(a).attr("href") ?? "";
      const name = $(a).text().trim();
      if (name) locations.push({ name, path: href });
    });
    if (locations.length === 0 && cellText) {
      locations.push({ name: cellText });
    }
    if (locations.length === 0) return;

    const games = keptSlugs
      .slice()
      .sort((a, b) => GAME_ORDER.indexOf(a) - GAME_ORDER.indexOf(b))
      .map((s) => GAME_DISPLAY[s]);
    groups.push({ games, locations });
  });
  return groups;
}

async function fetchSpeciesLocations(species: string): Promise<SpeciesLocations | null> {
  const slug = toPokemondbSlug(species);
  const url = `${POKEMONDB_BASE}/pokedex/${slug}`;
  const html = await fetchCached(url, join(CACHE_DIR, `${slug}.html`));
  if (!html) return null;
  return { species, groups: parseLocations(html) };
}

interface SpeciesApi {
  name: string;
  evolution_chain: { url: string } | null;
}

interface EvolutionChainApi {
  chain: EvolutionLinkApi;
}

interface EvolutionLinkApi {
  species: { name: string };
  evolves_to: EvolutionLinkApi[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

async function collectChainSpecies(species: string): Promise<string[]> {
  const sp = await fetchJson<SpeciesApi>(
    `${POKEAPI}/pokemon-species/${toPokeapiSpecies(species)}`,
  );
  if (!sp?.evolution_chain) return [];
  const chain = await fetchJson<EvolutionChainApi>(sp.evolution_chain.url);
  if (!chain) return [];
  const names: string[] = [];
  const walk = (n: EvolutionLinkApi) => {
    names.push(n.species.name);
    for (const c of n.evolves_to) walk(c);
  };
  walk(chain.chain);
  return names;
}

function prettyFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

async function main() {
  const root = process.cwd();
  const pokedexPath = join(root, "public/data/pokedex-champions.json");
  const dex = JSON.parse(await readFile(pokedexPath, "utf8")) as {
    pokemon: Record<string, { name: string }>;
  };
  const metaSpecies = Object.keys(dex.pokemon);

  const outPath = join(root, "public/data/locations.json");
  const prev: LocationsFile = existsSync(outPath)
    ? (JSON.parse(await readFile(outPath, "utf8")) as LocationsFile)
    : { refreshedAt: "", source: "", species: {} };

  console.log(
    `[locations] resolving evolution chains for ${metaSpecies.length} meta species…`,
  );
  // Chain members come back as PokeAPI lowercase slugs. The UI looks up
  // locations by the same prettify() transform of those slugs — key everything
  // by prettified slug so the lookup matches without special-casing.
  const chainSlugs = new Set<string>();
  for (const [i, s] of metaSpecies.entries()) {
    process.stdout.write(
      `\r[locations] chain ${i + 1}/${metaSpecies.length} ${s}     `,
    );
    try {
      const members = await collectChainSpecies(s);
      for (const m of members) chainSlugs.add(m);
    } catch (e) {
      console.warn(`\n[locations] chain ${s}: ${(e as Error).message}`);
    }
    await sleep(POKEAPI_DELAY_MS);
  }
  process.stdout.write("\n");

  console.log(
    `[locations] fetching pokemondb for ${chainSlugs.size} unique species (${POKEMONDB_DELAY_MS}ms delay)…`,
  );
  const result: Record<string, SpeciesLocations> = {};
  const slugList = [...chainSlugs].sort();
  for (const [i, slug] of slugList.entries()) {
    const display = prettyFromSlug(slug);
    process.stdout.write(
      `\r[locations] ${i + 1}/${slugList.length} ${display}          `,
    );
    try {
      const info = await fetchSpeciesLocations(display);
      if (info && info.groups.length > 0) {
        result[display] = info;
      } else if (prev.species[display]) {
        result[display] = prev.species[display];
      }
    } catch (e) {
      console.warn(`\n[locations] ${display}: ${(e as Error).message}`);
      if (prev.species[display]) result[display] = prev.species[display];
    }
    await sleep(POKEMONDB_DELAY_MS);
  }
  process.stdout.write("\n");

  const file: LocationsFile = {
    refreshedAt: new Date().toISOString().slice(0, 10),
    source: "pokemondb.net/pokedex (Gen 8+ games only)",
    species: result,
  };
  await writeFile(outPath, JSON.stringify(file, null, 2) + "\n", "utf8");
  console.log(
    `[locations] wrote ${Object.keys(result).length} species to locations.json`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
