# 003 — Catch Info Pipeline

Evolution chains + per-game catch locations shown inline on Top Mons,
Wishlist, and the Top Teams member detail view. Covers Sword/Shield
and newer (SwSh, BDSP, Legends Arceus, SV, Legends Z-A).

## What users see

Clicking a pokemon row expands a panel with:

1. **Evolution chain** — every pre- and post-evolution with the
   trigger summarized in human form ("Level 32", "Use Fire Stone",
   "Level up holding Razor Claw (night)", etc.).
2. **Where to catch** — per-species, grouped by game, with location
   lists from pokemondb.net's "Where to find" tables. Covers the
   whole evolution chain so users can also find the pre-evolution.

## Data sources (and why)

### PokeAPI for evolution chains

- `pokemon-species/{slug}` → `evolution_chain.url`
- `evolution-chain/{id}` → full tree with trigger metadata (level,
  item, time of day, held item, friendship, etc.)
- Used at **runtime**, cached in localStorage via
  `useCatchInfo(species)` + `store/catch-cache.ts`
- Why runtime: evolution data doesn't change and PokeAPI is well-cached
  publicly; no need to bake it into our JSON

### pokemondb.net for Gen 8+ catch locations

- `/pokedex/{slug}` contains a "Where to find" table: each row is a
  game group (e.g. Sword/Shield, Scarlet/Violet, Legends Arceus) with
  a `<td>` listing `<a href="/location/…">Name</a>` entries.
- Used at **build time**, baked into `public/data/locations.json` by
  `scripts/enrich-locations.ts` weekly.
- Why build-time: CORS blocks direct client calls to pokemondb.net,
  and 2.5s crawl delays × ~180 species = ~8 minutes — not acceptable
  at page load.

### Why pokemondb.net over alternatives

| Source | Pros | Why not |
|---|---|---|
| **PokeAPI** `/pokemon/{id}/encounters` | JSON, no scraping | Zero Gen 8+ coverage. Data effectively stops at USUM/Let's Go |
| **Bulbapedia** | Official, comprehensive, lists gift/event mons | MediaWiki templates are heavy to parse reliably |
| **Serebii** | Most complete for DLC/niche | Script-tag data, JS-heavy pages, fragile to scrape |
| **pokemondb.net** | Clean HTML tables, consistent structure, covers every modern game, user already references it manually | Scrape is HTML-fragile; relies on class names like `igame {slug}` |

## Filter: Gen 8+ only

User decision, explicit. Anything older (Black, Crystal, etc.) would
require running the mon through Pokémon HOME via a legacy path — not
useful info for a Champions player. Gen 8+ captures every HOME-
compatible modern title.

Allowed `igame` slugs:

```
sword, shield,
brilliant-diamond, shining-pearl,
legends-arceus,
scarlet, violet,
legends-z-a
```

DLC expansions (Isle of Armor, Crown Tundra, Teal Mask, Indigo Disk)
surface under their parent game's slug.

## Scraper structure (`scripts/enrich-locations.ts`)

1. Load `public/data/pokedex-champions.json` — authoritative meta mon
   list (top-50 usage ∪ team species ∪ their chain members after
   `enrich-pokedex.ts` runs).
2. For each meta species, fetch `pokemon-species/{slug}` + walk the
   evolution chain via PokeAPI. 200ms delay.
3. Union all chain members into `allSpecies` (~180 unique).
4. For each unique species, fetch pokemondb.net `/pokedex/{slug}`.
   2.5s delay (respects pokemondb's `Crawl-delay: 2`). 7-day disk
   cache at `.cache/pokemondb/`.
5. Parse the "Where to find" table with cheerio:
   - Group games per row via `<span class="igame ..."/>`.
   - Filter to the allow-list. Skip rows whose `<td>` contains
     "Not available in this game" / "Unobtainable" / "Location data
     not yet available".
   - Extract `<a href="/location/…">` link text.
6. Write `public/data/locations.json`. Preserve previous entries on
   per-species fetch failure so transient pokemondb errors don't
   wipe data.

Total runtime for a full refresh: ~8 min uncached, ~15s with warm
disk cache.

## Regional form handling

Some meta mons (Ninetales-Alola, Arcanine-Hisui, Rotom-Wash,
Floette-Eternal, Indeedee-F) have no `pokemon-species/{slug}` entry —
they're varieties of the base species. Two fallbacks:

- **Scraper** (`POKEAPI_SPECIES_OVERRIDE` in `enrich-locations.ts`):
  maps meta form → base species slug so the chain walk succeeds.
- **Client** (`fetchSpeciesWithFallback` in `src/lib/pokeapi-catch.ts`):
  if the first `pokemon-species` call 404s, retries with the first
  dash-segment as the base slug.

pokemondb URL fallback handled similarly via `SLUG_OVERRIDE`. The
consequence is that regional-form locations show the *base species*
catch data (SwSh locations for Kantonian Ninetales, etc.) — the form
lives inside the same pokemondb page but isn't per-form filtered.

## Known limitations

- **Niche DLC / gift / event mons** — pokemondb's own "Where to find"
  table doesn't list them (Litten in Isle of Armor Master Dojo gift;
  Alolan starters gift; etc.). Deferred: manual
  `locations-overrides.json` that layers on top of the scrape, maintained
  by the user since they're the domain expert.
- **Bare route numbers** — pokemondb writes "Routes 1, 2, 3" as
  distinct `<a>` tags; only the first has "Route" in its text. Parser
  captures "Route 1" + "2" + "3" — readable but cosmetic defect.
- **No per-form encounter filtering** — Hisuian Arcanine shares the
  Arcanine page; user has to read the game column ("Legends: Arceus")
  to infer which form.

## Integration points

- `src/lib/pokeapi-catch.ts` — evolution chain fetcher, cached by…
- `src/data/useCatchInfo.ts` — hook backed by…
- `src/store/catch-cache.ts` — localStorage, key `pokedash.catchCache.v2`
- `src/data/loader.ts` — loads `locations.json` (optional; missing file
  doesn't block app load)
- `src/components/SpeciesCatchInfo.tsx` — renders evo tree + locations
  for every chain member; also hosts the "+ Add to collection" button
  that opens `AddPokemonWizard` pre-filled
- Embedded in `PokemonTable` (Top Mons + Wishlist) and
  `TeamMemberDetail` (Top Teams)
