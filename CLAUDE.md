<!-- project-template: 48 -->
# CLAUDE.md

## About

Personal dashboard for **VGC Pokemon Champions · Regulation M-A**. Static
site hosted on GitHub Pages, data refreshed daily from Pikalytics, PokeAPI,
and Bulbapedia.

Live: https://shembree89.github.io/pokedash/

## Tech Stack

React 19 · TypeScript 5 · Vite 7 · Tailwind CSS 4 · React Router 7 (HashRouter) · localStorage for user state · GitHub Actions for weekly data refresh.

## Current Status

| Item | Status | Notes |
|---|---|---|
| Sprites / images | Open | All text-based. PokeAPI sprite URLs exist; would help recognition on narrow screen |
| Lead analysis | Open | Which 2 of the 4 to send out first. The Match Assistant 2×2 grid hints at this but doesn't recommend explicitly |
| Item DB expansion | Open | Currently derived from meta-sets distributions. Missing obscure competitive items |
| Scraper: capture all 6 team sets | Open | Pikalytics per-mon pages only record the featured mon's set, so other 5 team slots often show "no set data" in the team detail view. Would need team-specific page scraping |
| Niche gift/event-only catch locations | Open | Bulbapedia covers the regular wild/Pokédex catch table. Gift mons (e.g. Litten via Isle of Armor Master Dojo, starters, fossils) appear in event/walkthrough sections we don't scrape yet. Deferred: manual `locations-overrides.json` |
| `game-progression.ts` ↔ Bulbapedia naming | Open | Hardcoded location names in `src/data/game-progression.ts` were keyed to pokemondb spelling. Now that `locations.json` comes from Bulbapedia, the wishlist "By game" sort might show "Not available" for species whose location names diverge between sources. Needs verification per-game |
| Trusted full-EV team source | Waiting | No public source publishes EVs/nature for Reg M-A today (tournament reporting is open-teamsheet by policy). Daily watcher (`scripts/watch-sources.ts`) probes Smogon Sample Teams / Strategy Dex / subforum threads — fires a GH issue when curated content appears |

**Next Step:** Open. Match Assistant + supporting libs are shipped. Likely next directions: sprites in opponent slots / collection rows, lead-pair recommendation on top of the existing Bring quartet scorer, or fixing the `game-progression.ts` ↔ Bulbapedia naming drift if the wishlist sort regresses.

### Future

| Todo | Priority | Problem | Solution |
|------|----------|---------|----------|

## Recent Decisions

| Decision | Why |
|---|---|
| Target format = VGC Champions Reg M-A | Matches user's current game. Doubles + bring-4 fits the match-assistant description exactly |
| Static site on GitHub Pages + GH Actions data refresh | Free, no server, data stays fresh. Switch to serverless only if we outgrow static |
| Pikalytics AI markdown endpoints as primary meta source | `/ai/pokedex/championstournaments` — robots.txt permits AI crawlers explicitly, markdown is stabler than scraping HTML |
| Pokedex seeded from PokeAPI `/pokedex/champions` | Authoritative Reg M-A legal list (184 species). Combined with usage + team data the bundled dex now has 199 entries (was 77) — autocomplete suggests every legal mon. Runtime PokeAPI fallback via `useDex` still handles unknowns |
| Bulbapedia as Gen 8+ catch-location source | Replaced pokemondb (2026-04-30) — pokemondb produced misleading "Trade/migrate" entries for SwSh/BDSP, had no Z-A data, and patchy DLC coverage. Bulbapedia covers SwSh + Expansion Pass, BDSP, Legends Arceus, SV + DLC, and Z-A. 3s crawl-delay. ~20 min full refresh. Cache in `.cache/bulbapedia` invalidated weekly |
| Locations scrape walks evolution chains | Users care about pre-evo catch points too. `enrich-locations.ts` pulls every chain member from PokeAPI, scrapes each on Bulbapedia — ~390 unique species per refresh |
| Daily refresh cron at 19:00 UTC (3pm Eastern) | Bumped from weekly Sundays. Refresh script no-ops cleanly if data hasn't changed, so daily is cheap |
| Threat model uses calculated stats on both sides | Meta mons get a `defaultCompetitiveSpread` (32 HP / 32 off / rest in bulk+Spe) so symmetry holds. Prevents user's spread-optimized team from looking artificially strong vs raw-base meta |
| Role-inferred SP spread + nature for meta team members | All public Champions data sources (Pikalytics AI markdown, vrpastes backend, Limitless) publish open-teamsheet only — no EVs/nature. `src/lib/role.ts` classifies each member into ~9 canonical roles and returns a spread. UI labels these "inferred" so users know it's a guess |
| `@smogon/calc` + `@pkmn/data` for damage + move metadata | `@smogon/calc@0.11.0` provides Doubles-aware damage rolls (incl. Tailwind, Helping Hand, screens, Friend Guard, Ruin abilities). `@pkmn/data` exports a pruned `moves.json` (685 Gen 9 moves with type/category/BP/priority/target). `calc-adapter.ts` dynamic-imports calc so it's a separate ~480KB chunk loaded only on Match/Builder routes |
| Match Assistant infra factored as shared libs in `src/lib/` | `calc-adapter.ts`, `matchup-grid.ts`, `quartet-scorer.ts`, `set-predictor.ts`. TeamBuilder reuses them via `<StressTest>` panel: pick any meta team, get the same top-3 bring-4 quartets + per-opponent worst matchup. Match-specific state machine and observation UI stay in `src/routes/Match/` |
| Daily source watcher (`scripts/watch-sources.ts` + GH Actions) | Probes Smogon VGC subforum, Reg M-A metagame discussion, Strategy Dex daily; opens GH issue only on curated-content HIT. Community pastes are surfaced as `info`-level and deliberately not ingested — waiting for trusted-EV source |
| Wishlist game-progression sort | User picks a game on Wishlist; species sort by earliest catchable location. `src/data/game-progression.ts` hardcodes ~85 locations/game × 5 games. Names were keyed to pokemondb spelling — Bulbapedia switch (2026-04-30) means some names may now diverge; verify per-game if the sort regresses |
| Wishlist stored as ordered array, not a Set | Insertion order is the user's priority order. Wishlist defaults to "My order" sort with drag-reorder; filters/other sorts hide the drag handle to avoid index desync |

## Development

```bash
npm install
npm run dev              # Vite dev server
npm run build            # tsc -b + vite build
npm run preview          # serve dist (includes PWA service worker for offline testing)

npm run data:refresh        # Pikalytics + PokeAPI + Bulbapedia + @pkmn/data → public/data/*.json
npm run data:refresh:sample # top-20 only, faster for iteration
npm run data:enrich-megas       # just refresh mega forms
npm run data:enrich-locations   # just re-scrape Bulbapedia locations (~20 min)
npm run data:build-moves        # just regenerate moves.json from @pkmn/data

npm run watch:sources    # one-off probe of trusted Reg M-A data sources
```

Deployment is automatic on push to `main` via `.github/workflows/deploy.yml`.
Data refreshes daily via `.github/workflows/refresh-data.yml` (19:00 UTC = 3pm Eastern) + manual dispatch.
Source watcher runs daily via `.github/workflows/watch-sources.yml` (12:00 UTC) and opens a GH issue when a curated Reg M-A source goes live.

## Files

```
pokedash/
├── .github/workflows/
│   ├── deploy.yml            # build → Pages
│   ├── refresh-data.yml      # daily data refresh cron (19:00 UTC)
│   └── watch-sources.yml     # daily probe for trusted Reg M-A sources
├── scripts/
│   ├── pikalytics.ts         # AI markdown fetch + parse
│   ├── build-meta-json.ts    # orchestrator → public/data/*.json
│   ├── enrich-pokedex.ts     # seeds from PokeAPI /pokedex/champions, fills via /pokemon
│   ├── enrich-megas.ts       # PokeAPI mega enricher
│   ├── enrich-locations.ts   # Bulbapedia → Gen 8+ catch locations (incl. DLC + Z-A)
│   ├── build-moves-json.ts   # @pkmn/data → public/data/moves.json (Gen 9 moves)
│   └── watch-sources.ts      # probes Smogon/etc for curated Reg M-A content
├── public/
│   ├── data/
│   │   ├── pokedex-champions.json  # ~199 species (full Reg M-A legal list ∪ usage ∪ teams), 58 megas
│   │   ├── meta-usage.json         # top-50 by usage (Pikalytics AI caps here for Champions)
│   │   ├── meta-sets.json          # synthesized top sets + distributions
│   │   ├── meta-teams.json         # ~150 featured tournament teams
│   │   ├── locations.json          # ~366 species Gen 8+ catch locations (Bulbapedia)
│   │   └── moves.json              # 685 Gen 9 moves: type, category, BP, accuracy, priority, target, flags
│   ├── icon.svg · icon-192.png · icon-512.png · apple-touch-icon.png · favicon-32.png
├── src/
│   ├── lib/                  # shared between TeamBuilder + Match Assistant
│   │   ├── type-chart.ts     # 18×18 Gen 6+ chart
│   │   ├── threat.ts         # resolveOwned/resolveMeta + coverage + threatScores
│   │   ├── stats.ts          # calcStat / calcAllStats (Champions formula)
│   │   ├── sp-converter.ts   # SP ↔ EV helpers
│   │   ├── team-rules.ts     # Reg M-A validators
│   │   ├── pokepaste.ts      # Showdown text parser/serializer
│   │   ├── species.ts        # speciesKey / sameSpecies helpers
│   │   ├── role.ts           # role classifier → canonical SP spread + nature
│   │   ├── pokeapi-lookup.ts # client-side PokeAPI fetch + normalize (dex entries)
│   │   ├── pokeapi-catch.ts  # PokeAPI evolution chain fetcher
│   │   ├── calc-adapter.ts   # @smogon/calc wrapper (dynamic-imported, ~480KB chunk)
│   │   ├── matchup-grid.ts   # bestMoveAgainst + per-pair grid + matrix builder
│   │   ├── quartet-scorer.ts # rank 4-of-6 subsets vs opponent-6 with reasoning
│   │   └── set-predictor.ts  # Bayesian opponent set inference + auto-lock at 4/1/1
│   ├── data/
│   │   ├── types.ts
│   │   ├── loader.ts          # loads pokedex + usage + sets + teams + locations + moves
│   │   ├── useData.ts
│   │   ├── useDex.ts          # unified pokedex lookup (build-time + runtime)
│   │   ├── useMoves.ts        # moves.json lookup with normalized-name resolver
│   │   ├── useCatchInfo.ts    # lazy PokeAPI evolution chain w/ localStorage cache
│   │   ├── autocomplete.ts    # derive species/items/moves lists
│   │   └── game-progression.ts # hardcoded playthrough order per game (wishlist sort)
│   ├── store/
│   │   ├── collection.ts       # localStorage: owned mons + saved teams
│   │   ├── species-cache.ts    # localStorage: runtime-fetched pokedex entries
│   │   ├── catch-cache.ts      # localStorage: runtime-fetched evolution chains
│   │   ├── wishlist.ts         # localStorage: ordered species wishlist
│   │   └── match.ts            # localStorage: live Match state machine + observations
│   ├── components/
│   │   ├── MonFormFields.tsx    # shared set editor
│   │   ├── SlotEditor.tsx
│   │   ├── AddPokemonWizard.tsx # takes optional initialSpecies for pre-filled open
│   │   ├── AnalysisPanels.tsx
│   │   ├── StressTest.tsx       # TeamBuilder panel: pick meta team → reuse matchup libs
│   │   ├── PokemonTable.tsx     # shared: star toggle, click-to-expand, optional drag
│   │   ├── SpeciesCatchInfo.tsx # evo chain + Gen 8+ locations + add-to-collection button
│   │   ├── TeamMemberDetail.tsx # per-member set + nested SpeciesCatchInfo toggle
│   │   ├── Card.tsx · Button.tsx · TypeBadge.tsx · DataFooter.tsx
│   ├── routes/
│   │   ├── Collection.tsx
│   │   ├── TopPokemon.tsx     # top-50 + team-only append
│   │   ├── Wishlist.tsx       # drag-reorder + export/import
│   │   ├── TopTeams.tsx       # click-to-expand per-team detail
│   │   ├── TeamBuilder.tsx
│   │   └── Match/
│   │       ├── index.tsx              # phase orchestrator
│   │       ├── SetupPanel.tsx         # pick saved team
│   │       ├── LineupPanel.tsx        # enter opponent's 6
│   │       ├── BringPanel.tsx         # top-3 quartets via real damage rolls
│   │       ├── ActivePanel.tsx        # 2×2 matchup grid + slot pickers
│   │       ├── OpponentSlotPanel.tsx  # observation chips (seen/ruled-out)
│   │       └── FieldControls.tsx      # Tailwind/TR/weather/terrain toggles
│   ├── App.tsx · main.tsx · index.css
```

## Architecture

**Data flow.** Daily scraper reads Pikalytics markdown, PokeAPI (incl. `/pokedex/champions` for legal list), Bulbapedia (catch locations), and `@pkmn/data` (move metadata); writes normalized JSON to `public/data/`. App loads those on startup via `useData()`. Any species not in the build-time pokedex triggers a runtime PokeAPI fetch through `useDex().ensure()`, cached in localStorage.

**Catch info.** `SpeciesCatchInfo` expands inline on Top Mons, Wishlist, and Top Teams member detail. Evolution chain comes from PokeAPI at runtime (cached in localStorage via `useCatchInfo`); location data (Gen 8+ only) comes from `public/data/locations.json` populated daily by `enrich-locations.ts` scraping Bulbapedia. Locations cover the whole evolution chain so users can find pre-evolutions too. See [Record 003](docs/records/003-catch-info-pipeline.md) for the original (pokemondb-era) decisions; the current source is Bulbapedia, see "Recent Decisions".

**Stats pipeline.** `resolveOwned(mon, dexEntry)` computes effective stats at level 50 using `calcAllStats(base, spSpread, nature)`. The same pipeline applies to meta opponents via `resolveMeta(entry, useMega)` which uses a default competitive spread — both sides symmetric so threat comparisons are apples-to-apples.

**Role inference.** `src/lib/role.ts` classifies a meta team member into one of 9 canonical roles (fast-physical, fast-special, slow-physical, slow-special, assault-vest, phys-wall, spec-wall, bulky-support, tailwind-support) using item + move list + base stats + optional team-moves hint (Trick Room detection). Each role maps to a canonical 66-SP spread + nature. `TeamMemberDetail` displays the calculated stats as "inferred · <Role>" when no real SP data is present, and `AddPokemonWizard` uses the inferred spread as its prefill so the user can add the team member to their collection with one click. `resolveMeta` in `threat.ts` still uses the simpler `defaultCompetitiveSpread` for the broader threat model — extension is plumbing-only.

**Source watcher.** `scripts/watch-sources.ts` probes Smogon's VGC subforum, the Reg M-A metagame discussion thread, and the Strategy Dex daily via GH Actions. Fires a GitHub issue only on curated-content HIT; community pastes are surfaced as `info`-level and don't trigger the issue. Designed to go silent until the trusted-EV Reg M-A era begins.

**Wishlist progression.** `src/data/game-progression.ts` hardcodes ~85 locations/game across Sw/Sh, BDSP, SV, Legends Arceus, Legends Z-A. Location names match pokemondb.net verbatim so they join `locations.json` without special-casing. Wishlist's "By game" sort picks the earliest stage across each wishlisted species' locations in the selected game; species unavailable in that game sink to the bottom. Each row shows its earliest catch location as a hint.

**User data.** `collection.ts` and `species-cache.ts` are `useSyncExternalStore` stores backed by localStorage. Teams reference owned pokemon by id; removing a mon prunes it from saved teams automatically.

**Mega handling.** Pokedex entries carry a `megas` array. A mon on the user's team is considered mega if `mon.mega` is true; `resolveOwned` picks the mega form whose `requiredItem` matches the held item (falls back to the first mega). Reg M-A allows one mega per team — `validateTeam` enforces this.

**Wishlist & shared table.** `store/wishlist.ts` is an ordered `string[]` (insertion order). `PokemonTable` is shared between `TopPokemon` and `Wishlist` routes — it owns click-to-expand state, renders the star toggle, and accepts an optional `onReorder(from, to)`. The Wishlist passes `onReorder` only when sort is "order" and no filter is active so displayed indices match wishlist indices.

**PWA.** `vite-plugin-pwa` emits a Workbox service worker and a `/pokedash/`-scoped manifest. Build-time precache covers the JS/CSS bundle + `public/data/*.json` + icons. Runtime `StaleWhileRevalidate` cache targets `pokeapi.co/api/v2` so runtime-only lookups (unknown species, evolution chains) survive offline. `registerType: "autoUpdate"` swaps in new deploys without user action.

**Match Assistant.** `/match` route is a state machine (Setup → Lineup → Bring → Active) backed by `store/match.ts` (localStorage `pokedash.match.v1`). Bring uses `quartet-scorer` against a pre-computed 6×6 matchup matrix (`buildMatchupMatrix` in `matchup-grid.ts`) — each cell asks `calc-adapter` for real `@smogon/calc` damage rolls. Active renders a 2×2 grid (my A/B × their X/Y) showing both directions of damage, speed relation, and effectiveness; `OpponentSlotPanel` shows plausible moves/items/abilities as click-to-toggle chips that auto-lock at 4/1/1 seen via `set-predictor`. `FieldControls` toggles Tailwind (both sides), Trick Room, weather, terrain — these flow through to the calc.

**Stress Test (TeamBuilder).** `<StressTest>` reuses `matchup-grid` + `quartet-scorer` against any meta team from `meta-teams.json`. Same algorithms as Match's Bring phase, no observation/state-machine UI. Validates the "shared lib" factoring decision: implementing this was ~one component on top of existing libs.

**Calc & moves bundling.** `@smogon/calc` is dynamic-imported inside `calc-adapter.ts`, so it ships as a separate ~480KB chunk loaded only when entering Match or stress-testing in TeamBuilder. `moves.json` (~220KB, 685 Gen 9 entries) is loaded eagerly with the rest of the data bundle and read via `useMoves()` with normalized-name lookups.

**Pokedex seed.** `enrich-pokedex.ts` first calls PokeAPI's `/pokedex/champions` for the authoritative Reg M-A legal list (184 species), unions with Pikalytics top-50 + featured-team rosters + existing entries (Pikalytics names take spelling priority). Form-specific PokeAPI slug overrides handle species whose base form 404s (Mimikyu → mimikyu-disguised, Lycanroc → lycanroc-midday, Tatsugiri → tatsugiri-curly, etc.) and Pikalytics form names (Tauros-Paldea-* breeds, Maushold-Four).

## Project Instructions

<!-- PROJECT INSTRUCTIONS START -->
<!-- PROJECT INSTRUCTIONS END -->
