# CLAUDE.md

Personal dashboard for **VGC Pokemon Champions · Regulation M-A**. Static
site hosted on GitHub Pages, data refreshed weekly from Pikalytics and
PokeAPI.

Live: https://shembree89.github.io/pokedash/

## Tech Stack

React 19 · TypeScript 5 · Vite 7 · Tailwind CSS 4 · React Router 7 (HashRouter) · localStorage for user state · GitHub Actions for weekly data refresh.

## Current Status

| Item | Status | Notes |
|---|---|---|
| Obj 3 — Match Assistant | Not started | Biggest remaining feature. See [Record 002](docs/records/002-match-assistant-design.md) |
| Real damage calc (`@smogon/calc`) | Open | Currently using a heuristic type × stat × HP model. Stats pipeline (nature + SP → calcStat) is already plumbed so the integration is mostly an adapter |
| Move DB (type + category + power) | Open | Needed for set prediction display, real damage calc, and better autocomplete UX |
| Item DB expansion | Open | Currently derived from meta-sets distributions. Missing obscure competitive items |
| Sprites / images | Open | All text-based. PokeAPI sprite URLs exist; would help recognition on narrow screen |
| Weather / terrain awareness | Open | Flag when opponent team has a weather setter so threat scores adjust |
| Lead analysis | Open | Which 2 of the 4 to send out first. Relevant to match assistant |
| Scraper: capture all 6 team sets | Open | Pikalytics per-mon pages only record the featured mon's set, so other 5 team slots often show "no set data" in the team detail view. Would need team-specific page scraping |
| Niche DLC catch locations | Open | pokemondb.net doesn't enumerate gift/event-only mons (e.g. Litten via Isle of Armor Master Dojo). Deferred: manual `locations-overrides.json` to layer on top of the scrape |
| Location parser: bare route numbers | Open | pokemondb renders "Routes 1, 2, 3" as separate `<a>` tags where only the first has "Route" prefix. Parser captures "Route 1", then "2", "3" as plain names |

## Recent Decisions

| Decision | Why |
|---|---|
| Target format = VGC Champions Reg M-A | Matches user's current game. Doubles + bring-4 fits the match-assistant description exactly |
| Static site on GitHub Pages + GH Actions data refresh | Free, no server, data stays fresh weekly. Switch to serverless only if we outgrow static |
| Pikalytics AI markdown endpoints as primary meta source | `/ai/pokedex/championstournaments` — robots.txt permits AI crawlers explicitly, markdown is stabler than scraping HTML |
| PokeAPI as pokedex source | Complete data (base stats, types, abilities, mega forms incl. Z-A). Runtime fallback via `useDex` handles any species the user adds, cached in localStorage |
| Types relaxed: `MetaSet.nature` and `spSpread` optional | Pikalytics Champions explicitly exposes no SP/nature data. Sets carry moves/item/ability only |
| Threat model uses calculated stats on both sides | Meta mons get a `defaultCompetitiveSpread` (32 HP / 32 off / rest in bulk+Spe) so symmetry holds. Prevents user's spread-optimized team from looking artificially strong vs raw-base meta |
| Limitless scraper deferred | Pikalytics "Featured Teams" sections provide enough tournament team data for Obj 1/2. Revisit if Obj 3 needs more team variety |
| `MonFormFields` shared between slot editor and add-wizard | Removes ~150 lines of duplication. One place to add features (e.g. sprite, calc display) |
| pokemondb.net as Gen 8+ location source | PokeAPI's encounter data effectively ends at Gen 7. pokemondb's `/pokedex/{mon}` locations table is clean HTML and covers SwSh/BDSP/Legends Arceus/SV/Legends Z-A. Weekly scrape respects a 2.5s crawl-delay |
| Locations scrape walks evolution chains | Users care about pre-evo catch points too (Rookidee for Corviknight). `enrich-locations.ts` pulls every chain member from PokeAPI, scrapes each — ~180 unique species per refresh |
| Wishlist stored as ordered array, not a Set | Insertion order is the user's priority order. Wishlist defaults to "My order" sort with drag-reorder; filters/other sorts hide the drag handle to avoid index desync |
| `PokemonTable` shared across Top Mons + Wishlist | Star toggle, click-to-expand catch info, and optional drag all live in one place. Caller passes rows + optional `onReorder`; table owns its own expansion state |
| Team-only species appended client-side | Computed at render time via `teamSpecies − usageSpecies` (deduped by `speciesKey`). No separate JSON — team-only rows show "team-only" pill, rank/usage as "—" |
| PWA via `vite-plugin-pwa` | Precaches build + data JSONs (~900KB), runtime `StaleWhileRevalidate` cache for pokeapi.co. `autoUpdate` registration so new deploys swap in silently. Makes the app installable + offline-capable on Fold/mobile |

## Development

```bash
npm install
npm run dev              # Vite dev server
npm run build            # tsc -b + vite build
npm run preview          # serve dist (includes PWA service worker for offline testing)

npm run data:refresh        # Pikalytics + PokeAPI + pokemondb.net → public/data/*.json
npm run data:refresh:sample # top-20 only, faster for iteration
npm run data:enrich-megas       # just refresh mega forms
npm run data:enrich-locations   # just re-scrape pokemondb.net locations
```

Deployment is automatic on push to `main` via `.github/workflows/deploy.yml`.
Data refreshes weekly via `.github/workflows/refresh-data.yml` (Sunday 12:00 UTC) + manual dispatch.

## Files

```
pokedash/
├── .github/workflows/
│   ├── deploy.yml            # build → Pages
│   └── refresh-data.yml      # weekly data refresh cron
├── scripts/
│   ├── pikalytics.ts         # AI markdown fetch + parse
│   ├── build-meta-json.ts    # orchestrator → public/data/*.json
│   ├── enrich-pokedex.ts     # PokeAPI base-form enricher
│   ├── enrich-megas.ts       # PokeAPI mega enricher
│   └── enrich-locations.ts   # pokemondb.net → Gen 8+ catch locations
├── public/
│   ├── data/
│   │   ├── pokedex-champions.json  # ~77 species (top-50 usage ∪ team species ∪ chains), 24 megas
│   │   ├── meta-usage.json         # top-50 by usage (Pikalytics AI caps here for Champions)
│   │   ├── meta-sets.json          # synthesized top sets + distributions
│   │   ├── meta-teams.json         # ~150 featured tournament teams
│   │   └── locations.json          # ~160 species Gen 8+ catch locations (SwSh, BDSP, LA, SV, LZA)
│   ├── icon.svg · icon-192.png · icon-512.png · apple-touch-icon.png · favicon-32.png
├── src/
│   ├── lib/
│   │   ├── type-chart.ts     # 18×18 Gen 6+ chart
│   │   ├── threat.ts         # resolveOwned/resolveMeta + coverage + threatScores
│   │   ├── stats.ts          # calcStat / calcAllStats (Champions formula)
│   │   ├── sp-converter.ts   # SP ↔ EV helpers
│   │   ├── team-rules.ts     # Reg M-A validators
│   │   ├── pokepaste.ts      # Showdown text parser/serializer
│   │   ├── species.ts        # speciesKey / sameSpecies helpers
│   │   ├── pokeapi-lookup.ts # client-side PokeAPI fetch + normalize (dex entries)
│   │   └── pokeapi-catch.ts  # PokeAPI evolution chain fetcher
│   ├── data/
│   │   ├── types.ts
│   │   ├── loader.ts          # loads pokedex + usage + sets + teams + locations
│   │   ├── useData.ts
│   │   ├── useDex.ts          # unified pokedex lookup (build-time + runtime)
│   │   ├── useCatchInfo.ts    # lazy PokeAPI evolution chain w/ localStorage cache
│   │   └── autocomplete.ts    # derive species/items/moves lists
│   ├── store/
│   │   ├── collection.ts       # localStorage: owned mons + saved teams
│   │   ├── species-cache.ts    # localStorage: runtime-fetched pokedex entries
│   │   ├── catch-cache.ts      # localStorage: runtime-fetched evolution chains
│   │   └── wishlist.ts         # localStorage: ordered species wishlist
│   ├── components/
│   │   ├── MonFormFields.tsx    # shared set editor
│   │   ├── SlotEditor.tsx
│   │   ├── AddPokemonWizard.tsx # takes optional initialSpecies for pre-filled open
│   │   ├── AnalysisPanels.tsx
│   │   ├── PokemonTable.tsx     # shared: star toggle, click-to-expand, optional drag
│   │   ├── SpeciesCatchInfo.tsx # evo chain + Gen 8+ locations + add-to-collection button
│   │   ├── TeamMemberDetail.tsx # per-member set + nested SpeciesCatchInfo toggle
│   │   ├── Card.tsx · Button.tsx · TypeBadge.tsx · DataFooter.tsx
│   ├── routes/
│   │   ├── Collection.tsx
│   │   ├── TopPokemon.tsx     # top-50 + team-only append
│   │   ├── Wishlist.tsx       # drag-reorder + export/import
│   │   ├── TopTeams.tsx       # click-to-expand per-team detail
│   │   └── TeamBuilder.tsx
│   ├── App.tsx · main.tsx · index.css
```

## Architecture

**Data flow.** Weekly scraper reads Pikalytics markdown, PokeAPI, and pokemondb.net; writes normalized JSON to `public/data/`. App loads those on startup via `useData()`. Any species not in the build-time pokedex triggers a runtime PokeAPI fetch through `useDex().ensure()`, cached in localStorage — so user collections aren't limited to the top-50.

**Catch info.** `SpeciesCatchInfo` expands inline on Top Mons, Wishlist, and Top Teams member detail. Evolution chain comes from PokeAPI at runtime (cached in localStorage via `useCatchInfo`); location data (Sword/Shield and newer only) comes from `public/data/locations.json` populated weekly by `enrich-locations.ts` scraping pokemondb.net. Locations cover the whole evolution chain so users can find pre-evolutions too. See [Record 003](docs/records/003-catch-info-pipeline.md) for data-source decisions, scraper structure, and regional-form fallbacks.

**Stats pipeline.** `resolveOwned(mon, dexEntry)` computes effective stats at level 50 using `calcAllStats(base, spSpread, nature)`. The same pipeline applies to meta opponents via `resolveMeta(entry, useMega)` which uses a default competitive spread — both sides symmetric so threat comparisons are apples-to-apples.

**User data.** `collection.ts` and `species-cache.ts` are `useSyncExternalStore` stores backed by localStorage. Teams reference owned pokemon by id; removing a mon prunes it from saved teams automatically.

**Mega handling.** Pokedex entries carry a `megas` array. A mon on the user's team is considered mega if `mon.mega` is true; `resolveOwned` picks the mega form whose `requiredItem` matches the held item (falls back to the first mega). Reg M-A allows one mega per team — `validateTeam` enforces this.

**Wishlist & shared table.** `store/wishlist.ts` is an ordered `string[]` (insertion order). `PokemonTable` is shared between `TopPokemon` and `Wishlist` routes — it owns click-to-expand state, renders the star toggle, and accepts an optional `onReorder(from, to)`. The Wishlist passes `onReorder` only when sort is "order" and no filter is active so displayed indices match wishlist indices.

**PWA.** `vite-plugin-pwa` emits a Workbox service worker and a `/pokedash/`-scoped manifest. Build-time precache covers the JS/CSS bundle + `public/data/*.json` + icons. Runtime `StaleWhileRevalidate` cache targets `pokeapi.co/api/v2` so runtime-only lookups (unknown species, evolution chains) survive offline. `registerType: "autoUpdate"` swaps in new deploys without user action.

## Next Step

**Start Obj 3 — Match Assistant.** See [Record 002](docs/records/002-match-assistant-design.md) for the planned flow, state model, and iteration plan. Open questions captured there.

Preparatory work (should land before or alongside Obj 3):
1. Wire `@smogon/calc` with an SP→EV adapter — unlocks real damage numbers inside matchup cells (currently heuristic)
2. Add a move database (type + category + base power) — needed for the calc and for displaying opponent's plausible moves with useful metadata

<!-- PROJECT INSTRUCTIONS START -->
<!-- PROJECT INSTRUCTIONS END -->
