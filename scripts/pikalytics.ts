import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const PIKALYTICS_FORMAT_SLUG = "championstournaments";
export const PIKALYTICS_BASE = "https://www.pikalytics.com";
export const USER_AGENT = "pokedash-data-pipeline/0.1 (+https://github.com/shembree89/pokedash)";
export const CACHE_DIR = ".cache/pikalytics";

export interface UsagePair {
  name: string;
  usage: number;
}

export interface Teammate {
  species: string;
  usage: number;
}

export interface FeaturedTeamEntry {
  player: string;
  event: string;
  record?: string;
  pokemon: string[];
  setFor: {
    species: string;
    ability?: string;
    item?: string;
    moves: string[];
  };
}

export interface MonReport {
  species: string;
  rank?: number;
  usage: number;
  moves: UsagePair[];
  items: UsagePair[];
  abilities: UsagePair[];
  teammates: Teammate[];
  featuredTeams: FeaturedTeamEntry[];
  dataDate?: string;
}

export interface IndexEntry {
  rank: number;
  species: string;
  usage: number;
}

async function writeCache(path: string, body: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
}

async function readCacheIfFresh(path: string, maxAgeMs: number): Promise<string | null> {
  if (!existsSync(path)) return null;
  try {
    const { mtimeMs } = await (await import("node:fs/promises")).stat(path);
    if (Date.now() - mtimeMs > maxAgeMs) return null;
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function fetchMarkdown(url: string, cachePath: string, maxAgeMs = 6 * 60 * 60 * 1000): Promise<string> {
  const cached = await readCacheIfFresh(cachePath, maxAgeMs);
  if (cached) return cached;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/markdown, text/plain, */*" } });
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status} ${res.statusText}`);
  const body = await res.text();
  await writeCache(cachePath, body);
  return body;
}

export async function fetchFormatIndex(slug = PIKALYTICS_FORMAT_SLUG): Promise<{
  dataDate?: string;
  entries: IndexEntry[];
  raw: string;
}> {
  const url = `${PIKALYTICS_BASE}/ai/pokedex/${slug}`;
  const md = await fetchMarkdown(url, join(CACHE_DIR, slug, "_index.md"));
  const entries = parseIndexTable(md);
  const dataDate = parseDataDate(md);
  return { dataDate, entries, raw: md };
}

export async function fetchMon(species: string, slug = PIKALYTICS_FORMAT_SLUG): Promise<MonReport> {
  const url = `${PIKALYTICS_BASE}/ai/pokedex/${slug}/${encodeURIComponent(species)}`;
  const md = await fetchMarkdown(url, join(CACHE_DIR, slug, `${slugify(species)}.md`));
  return parseMonMarkdown(species, md);
}

function parseDataDate(md: string): string | undefined {
  // Two source formats: pipe-table rows and bullet list entries.
  const pipe = md.match(/\*\*Data Date\*\*\s*\|\s*([0-9-]+)\s*\|/);
  if (pipe) return pipe[1];
  const bullet = md.match(/\*\*Data Date\*\*:\s*([0-9-]+)/);
  return bullet?.[1];
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function parseIndexTable(md: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const rowRe = /^\|\s*(\d+)\s*\|\s*\*\*([^|*]+?)\*\*\s*\|\s*([\d.]+)%\s*\|/gm;
  for (const m of md.matchAll(rowRe)) {
    const [, rank, species, usage] = m;
    entries.push({ rank: parseInt(rank, 10), species: species.trim(), usage: round4(parseFloat(usage) / 100) });
  }
  return entries;
}

const SECTION_HEADERS = {
  moves: "## Common Moves",
  items: "## Common Items",
  abilities: "## Common Abilities",
  teammates: "## Common Teammates",
  featured: "## Featured Teams",
} as const;

function extractSection(md: string, header: string): string {
  const idx = md.indexOf(header);
  if (idx === -1) return "";
  const rest = md.slice(idx + header.length);
  const nextHeader = rest.search(/^\s*##\s+/m);
  return nextHeader === -1 ? rest : rest.slice(0, nextHeader);
}

function parseUsageList(block: string): UsagePair[] {
  const out: UsagePair[] = [];
  const re = /^-\s+\*\*(.+?)\*\*:\s*([\d.]+)%/gm;
  for (const m of block.matchAll(re)) {
    out.push({ name: m[1].trim(), usage: round4(parseFloat(m[2]) / 100) });
  }
  return out;
}

function parseFeaturedTeams(block: string, owningSpecies: string): FeaturedTeamEntry[] {
  const teams: FeaturedTeamEntry[] = [];
  const sections = block.split(/^###\s+/m).slice(1);
  for (const section of sections) {
    const headLine = section.split(/\r?\n/, 1)[0];
    const headMatch = headLine.match(/^Team\s+\d+\s+by\s+(.+?)\s*$/i);
    if (!headMatch) continue;
    const player = headMatch[1].trim();
    const record = section.match(/^\*Record:\s*(.+?)\*/m)?.[1].trim();
    const event = section.match(/^\*Event:\s*(.+?)\*/m)?.[1].trim() ?? "";
    const pokemonLine = section.match(/^\*\*Pokemon\*\*:\s*(.+?)$/m)?.[1];
    if (!pokemonLine) continue;
    const pokemon = pokemonLine.split(",").map((p) => p.trim()).filter(Boolean);
    const setBlockMatch = section.match(
      new RegExp(`\\*\\*${escapeRegex(owningSpecies)}\\s+Set\\*\\*:[\\s\\S]*?(?=\\n\\n|$)`, "i"),
    );
    const setBlock = setBlockMatch?.[0] ?? "";
    const ability = setBlock.match(/\*\*Ability\*\*:\s*(.+?)$/m)?.[1].trim();
    const item = setBlock.match(/\*\*Item\*\*:\s*(.+?)$/m)?.[1].trim();
    const movesLine = setBlock.match(/\*\*Moves\*\*:\s*(.+?)$/m)?.[1];
    const moves = movesLine ? movesLine.split(",").map((s) => s.trim()).filter(Boolean) : [];
    teams.push({
      player,
      event,
      record,
      pokemon,
      setFor: { species: owningSpecies, ability, item, moves },
    });
  }
  return teams;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseMonMarkdown(species: string, md: string): MonReport {
  const usageMatch = md.match(/>\s*Competitive usage data for/);
  // Usage total not consistently exposed in per-mon markdown; pull from header quick info if present.
  const dataDate = parseDataDate(md);
  const totalUsageMatch = md.match(/Usage\s*\|\s*([\d.]+)%/);
  const moves = parseUsageList(extractSection(md, SECTION_HEADERS.moves));
  const items = parseUsageList(extractSection(md, SECTION_HEADERS.items));
  const abilities = parseUsageList(extractSection(md, SECTION_HEADERS.abilities));
  const teammatesRaw = parseUsageList(extractSection(md, SECTION_HEADERS.teammates));
  const teammates = teammatesRaw.map((t) => ({ species: t.name, usage: t.usage }));
  const featuredTeams = parseFeaturedTeams(extractSection(md, SECTION_HEADERS.featured), species);
  void usageMatch;
  return {
    species,
    usage: totalUsageMatch ? round4(parseFloat(totalUsageMatch[1]) / 100) : 0,
    moves,
    items,
    abilities,
    teammates,
    featuredTeams,
    dataDate,
  };
}

export function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9-]+/g, "-").toLowerCase();
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
