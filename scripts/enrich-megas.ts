// Extend public/data/pokedex-champions.json with mega-form data from
// PokeAPI. Tries -mega, -mega-x, -mega-y slugs for every species already
// in the pokedex. Preserves hand-curated mega requiredItem names when
// they match the Pikalytics item usage (via meta-sets.json).

import { readFile, writeFile } from "node:fs/promises";
import { sleep, USER_AGENT } from "./pikalytics.ts";

const POKEAPI = "https://pokeapi.co/api/v2";
const REQUEST_DELAY_MS = 150;

type Stat = "hp" | "atk" | "def" | "spa" | "spd" | "spe";

const STAT_MAP: Record<string, Stat> = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

const TYPE_CAP: Record<string, string> = {
  normal: "Normal", fire: "Fire", water: "Water", electric: "Electric", grass: "Grass",
  ice: "Ice", fighting: "Fighting", poison: "Poison", ground: "Ground", flying: "Flying",
  psychic: "Psychic", bug: "Bug", rock: "Rock", ghost: "Ghost", dragon: "Dragon",
  dark: "Dark", steel: "Steel", fairy: "Fairy",
};

const MEGA_STONE_OVERRIDE: Record<string, Record<string, string>> = {
  // Species → mega display name → required item (used when Pikalytics
  // isn't a reliable source e.g. the mon has no Reg M-A usage yet).
};

// Per-species PokeAPI slug overrides (for forms that need a specific
// base slug to reach the mega form).
const BASE_SLUG_OVERRIDE: Record<string, string> = {
  "Kommo-O": "kommo-o",
  "Ninetales-Alola": "ninetales-alola",
  "Arcanine-Hisui": "arcanine-hisui",
  "Typhlosion-Hisui": "typhlosion-hisui",
  "Rotom-Wash": "rotom-wash",
  "Rotom-Heat": "rotom-heat",
  "Floette-Eternal": "floette-eternal",
  "Basculegion": "basculegion-male",
  "Maushold": "maushold-family-of-three",
  "Aegislash": "aegislash-shield",
  "Palafin": "palafin-zero",
};

function baseSlug(species: string): string {
  return BASE_SLUG_OVERRIDE[species] ?? species.toLowerCase();
}

interface PokeApiPokemon {
  types: { slot: number; type: { name: string } }[];
  abilities: { ability: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

interface DexEntry {
  name: string;
  types: string[];
  baseStats: Record<Stat, number>;
  abilities: string[];
  megas?: DexMega[];
}

interface DexMega {
  name: string;
  types: string[];
  baseStats: Record<Stat, number>;
  ability: string;
  requiredItem: string;
}

interface MetaSetEntry {
  item?: string;
  ability?: string;
}

interface MetaSetsFile {
  sets: Record<string, MetaSetEntry[]>;
  distributions?: Record<string, { items: { name: string; usage: number }[] }>;
}

async function fetchApi(slug: string): Promise<PokeApiPokemon | null> {
  const res = await fetch(`${POKEAPI}/pokemon/${slug}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PokeAPI ${slug}: ${res.status}`);
  return (await res.json()) as PokeApiPokemon;
}

function cap(s: string): string {
  return s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function looksLikeMegaStone(item: string): boolean {
  return /(ite|itex|itey)$/i.test(item.replace(/\s+/g, ""));
}

function normalizeMegaFromApi(species: string, variant: string, api: PokeApiPokemon): Omit<DexMega, "requiredItem"> {
  const types = api.types
    .sort((a, b) => a.slot - b.slot)
    .map((t) => TYPE_CAP[t.type.name] ?? t.type.name);
  const baseStats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const s of api.stats) {
    const key = STAT_MAP[s.stat.name];
    if (key) baseStats[key] = s.base_stat;
  }
  const ability = api.abilities[0]?.ability.name ?? "";
  const displayName = variantDisplayName(species, variant);
  return {
    name: displayName,
    types,
    baseStats,
    ability: cap(ability),
  };
}

function variantDisplayName(species: string, variant: string): string {
  if (variant === "mega") return `Mega ${species}`;
  if (variant === "mega-x") return `Mega ${species} X`;
  if (variant === "mega-y") return `Mega ${species} Y`;
  return `Mega ${species}`;
}

function deriveRequiredItem(
  species: string,
  variant: string,
  metaSets: MetaSetsFile,
): string {
  const override = MEGA_STONE_OVERRIDE[species]?.[variantDisplayName(species, variant)];
  if (override) return override;

  const dist = metaSets.distributions?.[species];
  if (dist) {
    // For Charizard with -mega-x/-mega-y we need the matching stone.
    if (variant === "mega-x" || variant === "mega-y") {
      const want = variant === "mega-x" ? "X" : "Y";
      const hit = dist.items.find((i) => looksLikeMegaStone(i.name) && i.name.toUpperCase().endsWith(want));
      if (hit) return hit.name;
    }
    const stone = dist.items.find((i) => looksLikeMegaStone(i.name));
    if (stone) return stone.name;
  }

  // Fallback: synthesize from species name.
  const base = species.replace(/-.+$/, "");
  if (variant === "mega-x") return `${base}ite X`;
  if (variant === "mega-y") return `${base}ite Y`;
  return `${base}ite`;
}

async function main() {
  const dex = JSON.parse(
    await readFile("public/data/pokedex-champions.json", "utf8"),
  ) as { refreshedAt: string; source: string; pokemon: Record<string, DexEntry> };
  const metaSets = JSON.parse(
    await readFile("public/data/meta-sets.json", "utf8"),
  ) as MetaSetsFile;

  const species = Object.keys(dex.pokemon);
  let added = 0;
  let updated = 0;

  for (const [i, name] of species.entries()) {
    const slug = baseSlug(name);
    const variants = ["mega", "mega-x", "mega-y"];
    const found: DexMega[] = [];
    for (const v of variants) {
      process.stdout.write(`\r[mega] ${i + 1}/${species.length} ${name}-${v}           `);
      try {
        const api = await fetchApi(`${slug}-${v}`);
        if (!api) {
          await sleep(REQUEST_DELAY_MS);
          continue;
        }
        const partial = normalizeMegaFromApi(name, v, api);
        const requiredItem = deriveRequiredItem(name, v, metaSets);
        found.push({ ...partial, requiredItem });
      } catch (e) {
        console.warn(`\n[mega] ${name}-${v}: ${(e as Error).message}`);
      }
      await sleep(REQUEST_DELAY_MS);
    }

    if (found.length === 0) continue;
    const existing = dex.pokemon[name].megas ?? [];
    const existingByName = new Map(existing.map((m) => [m.name, m]));
    let changed = false;
    for (const m of found) {
      const prior = existingByName.get(m.name);
      if (!prior) {
        existing.push(m);
        changed = true;
        added += 1;
        continue;
      }
      // Update stats/types from PokeAPI (source of truth), preserve requiredItem if already set.
      const merged: DexMega = {
        name: m.name,
        types: m.types,
        baseStats: m.baseStats,
        ability: prior.ability || m.ability,
        requiredItem: prior.requiredItem || m.requiredItem,
      };
      if (JSON.stringify(merged) !== JSON.stringify(prior)) {
        existingByName.set(m.name, merged);
        const idx = existing.findIndex((e) => e.name === m.name);
        if (idx >= 0) existing[idx] = merged;
        changed = true;
        updated += 1;
      }
    }
    if (changed) dex.pokemon[name].megas = existing;
  }
  process.stdout.write("\n");

  dex.refreshedAt = new Date().toISOString().slice(0, 10);
  if (!dex.source.includes("megas from pokeapi")) {
    dex.source += "; megas from pokeapi.co";
  }
  await writeFile("public/data/pokedex-champions.json", JSON.stringify(dex, null, 2) + "\n", "utf8");
  console.log(`[mega] done: ${added} added, ${updated} updated`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
