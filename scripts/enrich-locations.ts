// Enrich public/data/locations.json by scraping Bulbapedia for catch
// locations across Gen 8+ games (SwSh + DLC, BDSP, Legends Arceus, SV
// + DLC, Legends Z-A). Bulbapedia is currently the only source with
// reliable Z-A and DLC coverage.
//
// For each species in pokedex-champions.json we walk its evolution
// chain (via PokeAPI) so users see pre-evolution catch points too.

import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import * as cheerio from "cheerio";
import { sleep, USER_AGENT } from "./pikalytics.ts";

const POKEAPI = "https://pokeapi.co/api/v2";
const BULBAPEDIA_BASE = "https://bulbapedia.bulbagarden.net/wiki";
const POKEAPI_DELAY_MS = 200;
const BULBAPEDIA_DELAY_MS = 3000;
const CACHE_DIR = ".cache/bulbapedia";
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Game name → canonical display label. Order also defines display order.
const GAME_PATTERNS: { regex: RegExp; canonical: string }[] = [
  { regex: /^Sword$/i, canonical: "Sword" },
  { regex: /^Shield$/i, canonical: "Shield" },
  { regex: /^Expansion Pass$/i, canonical: "Expansion Pass" },
  { regex: /^The Isle of Armor$/i, canonical: "The Isle of Armor" },
  { regex: /^The Crown Tundra$/i, canonical: "The Crown Tundra" },
  { regex: /^Brilliant Diamond$/i, canonical: "Brilliant Diamond" },
  { regex: /^Shining Pearl$/i, canonical: "Shining Pearl" },
  { regex: /^Legends:\s*Arceus$/i, canonical: "Legends: Arceus" },
  { regex: /^Scarlet$/i, canonical: "Scarlet" },
  { regex: /^Violet$/i, canonical: "Violet" },
  { regex: /^The Hidden Treasure of Area Zero$/i, canonical: "Hidden Treasure of Area Zero" },
  { regex: /^The Teal Mask$/i, canonical: "The Teal Mask" },
  { regex: /^The Indigo Disk$/i, canonical: "The Indigo Disk" },
  { regex: /^Legends:\s*Z-A$/i, canonical: "Legends: Z-A" },
];

const GAME_ORDER = GAME_PATTERNS.map((p) => p.canonical);

// Wiki paths that are NOT locations: items, mechanics, navigation aids.
const DENY = /^\/wiki\/(?:Pok%C3%A9mon_|List_of_|Tera_Raid|Trade$|Generation_|Old_Amber|Hard_Stone|Soft_Sand|Mossy_Rock|Icy_Rock|Magnetic_Field|Sun_Stone|Moon_Stone|Fire_Stone|Water_Stone|Thunder_Stone|Leaf_Stone|Ice_Stone|Dawn_Stone|Dusk_Stone|Shiny_Stone|Tera_Orb|Mega_Stone|Friendship|Pickup|Outbreak|Mass_Outbreak|HOME|Pok%C3%A9mon_HOME|Evolution$|Evolve|Breeding|Egg$|Pok%C3%A9mon_egg|Pal_Park|Mystery_Gift|Walking|DexNav|Wild_Area_News)/i;

// Species pages end in _(Pokémon) — those aren't locations.
const SPECIES_PAGE = /_\(Pok%C3%A9mon\)$/;

function isDeniedHref(href: string): boolean {
  return DENY.test(href) || SPECIES_PAGE.test(href);
}

function matchGame(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  for (const p of GAME_PATTERNS) {
    if (p.regex.test(t)) return p.canonical;
  }
  return null;
}

function pathToDisplayName(href: string): string {
  const slug = decodeURIComponent(href.replace(/^\/wiki\//, ""));
  return slug.replace(/_/g, " ").trim();
}

// Bulbapedia uses Title_Case_With_Underscores in URLs.
function toBulbapediaPath(display: string): string {
  return `${display.replace(/\s+/g, "_")}_(Pok%C3%A9mon)`;
}

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

type CheerioRoot = cheerio.CheerioAPI;
type CheerioElement = ReturnType<CheerioRoot>;

function pickLocation($: CheerioRoot, $cell: CheerioElement): Location | null {
  // Prefer bolded link (Bulbapedia's primary-location convention).
  const $bold = $cell.find("b > a[href^='/wiki/']").first();
  if ($bold.length) {
    const href = $bold.attr("href") ?? "";
    if (href && !isDeniedHref(href)) {
      return { name: pathToDisplayName(href), path: href };
    }
  }
  // Fallback: first non-denylisted wiki link in the cell.
  let pick: Location | null = null;
  $cell.find("a[href^='/wiki/']").each((_, a) => {
    if (pick) return;
    const $a = $(a);
    const href = $a.attr("href") ?? "";
    if (!href || isDeniedHref(href)) return;
    pick = { name: pathToDisplayName(href), path: href };
  });
  return pick;
}

export function parseBulbapediaLocations(html: string): GameLocationGroup[] {
  const $ = cheerio.load(html);
  const startSpan = $("#Game_locations").parent()[0];
  const endSpan = $("#In_side_games").parent()[0];
  if (!startSpan) return [];

  const all = $("body").find("*").toArray();
  const startIdx = all.indexOf(startSpan);
  const endIdx = endSpan ? all.indexOf(endSpan) : all.length;
  const section = all.slice(startIdx, endIdx);

  const seenRows = new Set<unknown>();
  const groups: GameLocationGroup[] = [];

  for (const el of section) {
    if ((el as { tagName?: string }).tagName !== "th") continue;
    const $th = $(el);
    if (!matchGame($th.text())) continue;
    const tr = $th.parent("tr")[0];
    if (!tr || seenRows.has(tr)) continue;
    seenRows.add(tr);
    const $tr = $(tr);
    const games: string[] = [];
    $tr.children("th").each((_, th) => {
      const g = matchGame($(th).text());
      if (g && !games.includes(g)) games.push(g);
    });
    if (games.length === 0) continue;
    const $td = $tr.children("td").first();
    if (!$td.length) continue;

    const seenPath = new Set<string>();
    const locations: Location[] = [];
    const $innerTrs = $td.find("table tr");
    const innerCells = $innerTrs.length > 0 ? $innerTrs.toArray() : [tr];
    for (const innerTr of innerCells) {
      const $innerTd = $(innerTr).children("td").first();
      const $cell = $innerTd.length ? $innerTd : $(innerTr);
      const pick = pickLocation($, $cell);
      if (!pick) continue;
      const k = pick.path ?? pick.name;
      if (seenPath.has(k)) continue;
      seenPath.add(k);
      locations.push(pick);
    }
    if (locations.length === 0) continue;
    groups.push({ games, locations });
  }

  // Sort each group's games into canonical order.
  for (const g of groups) {
    g.games.sort((a, b) => GAME_ORDER.indexOf(a) - GAME_ORDER.indexOf(b));
  }
  return groups;
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

async function fetchBulbapedia(species: string): Promise<string | null> {
  const path = toBulbapediaPath(species);
  const url = `${BULBAPEDIA_BASE}/${path}`;
  // Cache filename: replace percent-encoded bytes for filesystem-safe naming.
  const cacheName = path.replace(/%[0-9A-Fa-f]{2}/g, "_").replace(/[()]/g, "");
  return fetchCached(url, join(CACHE_DIR, `${cacheName}.html`));
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

function toPokeapiSpecies(species: string): string {
  return POKEAPI_SPECIES_OVERRIDE[species] ?? species.toLowerCase();
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
    `[locations] fetching Bulbapedia for ${chainSlugs.size} unique species (${BULBAPEDIA_DELAY_MS}ms delay)…`,
  );
  const result: Record<string, SpeciesLocations> = {};
  const slugList = [...chainSlugs].sort();
  for (const [i, slug] of slugList.entries()) {
    const display = prettyFromSlug(slug);
    process.stdout.write(
      `\r[locations] ${i + 1}/${slugList.length} ${display}          `,
    );
    try {
      const html = await fetchBulbapedia(display);
      if (!html) {
        if (prev.species[display]) result[display] = prev.species[display];
        continue;
      }
      const groups = parseBulbapediaLocations(html);
      if (groups.length > 0) {
        result[display] = { species: display, groups };
      } else if (prev.species[display]) {
        result[display] = prev.species[display];
      }
    } catch (e) {
      console.warn(`\n[locations] ${display}: ${(e as Error).message}`);
      if (prev.species[display]) result[display] = prev.species[display];
    }
    await sleep(BULBAPEDIA_DELAY_MS);
  }
  process.stdout.write("\n");

  const file: LocationsFile = {
    refreshedAt: new Date().toISOString().slice(0, 10),
    source: "bulbapedia.bulbagarden.net (Gen 8+ catch locations)",
    species: result,
  };
  await writeFile(outPath, JSON.stringify(file, null, 2) + "\n", "utf8");
  console.log(
    `[locations] wrote ${Object.keys(result).length} species to locations.json`,
  );
}

const isMain = (() => {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    return argv1.endsWith("enrich-locations.ts");
  } catch {
    return false;
  }
})();

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
