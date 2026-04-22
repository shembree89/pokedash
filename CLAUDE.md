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

## Development

```bash
npm install
npm run dev              # Vite dev server
npm run build            # tsc -b + vite build
npm run preview          # serve dist

npm run data:refresh     # Pikalytics + PokeAPI → public/data/*.json
npm run data:refresh:sample  # top-20 only, faster for iteration
npm run data:enrich-megas    # just refresh mega forms
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
├── public/data/
│   ├── pokedex-champions.json  # 55+ species, 24 megas
│   ├── meta-usage.json         # top-50 by usage
│   ├── meta-sets.json          # synthesized top sets + distributions
│   ├── meta-teams.json         # ~150 featured tournament teams
│   └── locations.json          # per-species Gen 8+ catch locations incl. pre-evos
├── src/
│   ├── lib/
│   │   ├── type-chart.ts     # 18×18 Gen 6+ chart
│   │   ├── threat.ts         # resolveOwned/resolveMeta + coverage + threatScores
│   │   ├── stats.ts          # calcStat / calcAllStats (Champions formula)
│   │   ├── sp-converter.ts   # SP ↔ EV helpers
│   │   ├── team-rules.ts     # Reg M-A validators
│   │   ├── pokepaste.ts      # Showdown text parser/serializer
│   │   ├── species.ts        # speciesKey / sameSpecies helpers
│   │   └── pokeapi-lookup.ts # client-side PokeAPI fetch + normalize
│   ├── data/
│   │   ├── types.ts
│   │   ├── loader.ts
│   │   ├── useData.ts        # loads public/data JSON
│   │   ├── useDex.ts         # unified pokedex lookup (build-time + runtime)
│   │   └── autocomplete.ts   # derive species/items/moves lists
│   ├── store/
│   │   ├── collection.ts     # localStorage: owned mons + saved teams
│   │   └── species-cache.ts  # localStorage: runtime-fetched pokedex
│   ├── components/
│   │   ├── MonFormFields.tsx # shared set editor
│   │   ├── SlotEditor.tsx
│   │   ├── AddPokemonWizard.tsx
│   │   ├── AnalysisPanels.tsx
│   │   ├── Card.tsx · Button.tsx · TypeBadge.tsx · DataFooter.tsx
│   ├── routes/
│   │   ├── Collection.tsx
│   │   ├── TopPokemon.tsx
│   │   ├── TopTeams.tsx
│   │   └── TeamBuilder.tsx
│   ├── App.tsx · main.tsx · index.css
```

## Architecture

**Data flow.** Weekly scraper reads Pikalytics markdown, PokeAPI, and pokemondb.net; writes normalized JSON to `public/data/`. App loads those on startup via `useData()`. Any species not in the build-time pokedex triggers a runtime PokeAPI fetch through `useDex().ensure()`, cached in localStorage — so user collections aren't limited to the top-50.

**Catch info.** `SpeciesCatchInfo` expands inline on the Top Pokemon table when a row is clicked. Evolution chain comes from PokeAPI at runtime (cached in localStorage via `useCatchInfo`); location data (Sword/Shield and newer only) comes from `public/data/locations.json` populated weekly by `enrich-locations.ts` scraping pokemondb.net. Locations cover the whole evolution chain so users can find pre-evolutions too.

**Stats pipeline.** `resolveOwned(mon, dexEntry)` computes effective stats at level 50 using `calcAllStats(base, spSpread, nature)`. The same pipeline applies to meta opponents via `resolveMeta(entry, useMega)` which uses a default competitive spread — both sides symmetric so threat comparisons are apples-to-apples.

**User data.** `collection.ts` and `species-cache.ts` are `useSyncExternalStore` stores backed by localStorage. Teams reference owned pokemon by id; removing a mon prunes it from saved teams automatically.

**Mega handling.** Pokedex entries carry a `megas` array. A mon on the user's team is considered mega if `mon.mega` is true; `resolveOwned` picks the mega form whose `requiredItem` matches the held item (falls back to the first mega). Reg M-A allows one mega per team — `validateTeam` enforces this.

## Next Step

**Start Obj 3 — Match Assistant.** See [Record 002](docs/records/002-match-assistant-design.md) for the planned flow, state model, and iteration plan. Open questions captured there.

Preparatory work (should land before or alongside Obj 3):
1. Wire `@smogon/calc` with an SP→EV adapter — unlocks real damage numbers inside matchup cells (currently heuristic)
2. Add a move database (type + category + base power) — needed for the calc and for displaying opponent's plausible moves with useful metadata

<!-- PROJECT INSTRUCTIONS START -->
<!-- PROJECT INSTRUCTIONS END -->
