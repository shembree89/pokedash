# 001 — Architecture Overview

This is a snapshot of how the app fits together after Obj 1 + Obj 2 + the
data pipeline shipped. Future sessions should read this before touching
the data flow or the stats pipeline.

## Why it looks this way

**Static site + GH Actions data refresh.** The original plan weighed a
backend but rejected it: we only need read-only meta data, and that data
refreshes monthly-ish. GitHub Pages is free, no ops, no auth surface.
Scheduled Actions write `public/data/*.json` into the repo, which
triggers a deploy.

**Pikalytics AI endpoints over HTML scraping.** Pikalytics advertises
AI-friendly markdown at `/ai/pokedex/{format}` (slug
`championstournaments` for Reg M-A). Their robots.txt explicitly allows
ClaudeBot/GPTBot/etc. Parsing markdown is stabler than CSS selectors and
they're unlikely to break it without warning.

**PokeAPI for pokedex.** PokeAPI is complete, free, CORS-enabled, and
includes Z-A megas (Meganium, Dragonite, Greninja, etc.). Using it
twice: once at enrichment time (seed `pokedex-champions.json` with base
forms for every top-N meta mon, plus a mega-form sweep), and once at
runtime through `useDex` for species users add to their own collections
outside the top-N (Azumarill, Orthworm, etc.).

## Key abstractions

- **`useData()`** — one-shot fetch of `public/data/*.json`. Cached in
  module scope so re-renders don't refetch.
- **`useDex()`** — unified pokedex lookup. `lookup(species)` synchronously
  returns the DexEntry from the built-in pokedex or the runtime
  localStorage cache. `ensure(species)` kicks off a PokeAPI fetch if
  we've never seen this species. Inflight dedupe + 24h negative cache
  for 404s.
- **`MonFormFields`** — shared React form for a single mon's set.
  Consumed by both `SlotEditor` (edit existing owned mon) and
  `AddPokemonWizard` (create new owned mon). Changes to the set editor
  happen here — don't duplicate.
- **`resolveOwned(mon, entry)` + `resolveMeta(entry, useMega)`** — both
  produce an `EffectiveMon` with `stats` (calculated at level 50 using
  `calcAllStats`) and raw `baseStats`. The threat model uses `.stats`
  so owned and meta sides are comparable.
- **`calcAllStats(base, spSpread, nature)`** — Champions stat formula
  (IVs fixed at 31, level 50, SP × 8 = EV, nature ±10%). Source of
  truth for any stat-adjacent display.

## Data model

- `public/data/pokedex-champions.json` — species dex, build-time output
  of `enrich-pokedex.ts` and `enrich-megas.ts`.
- `public/data/meta-usage.json` — ranked top-50 by Champions ladder
  usage, from Pikalytics index page.
- `public/data/meta-sets.json` — synthesized "most common" set per mon
  (`sets`) plus full per-field distributions (`distributions`). The
  distribution is the match-assistant fuel for "more than 4 plausible
  moves, more than 1 plausible item."
- `public/data/meta-teams.json` — ~150 tournament teams aggregated
  from Pikalytics featured-team sections, deduplicated by player+event.

User-local data (localStorage):
- `pokedash.owned.v1` — owned pokemon (collection)
- `pokedash.teams.v1` — saved teams (reference owned ids)
- `pokedash.dexCache.v1` — runtime-fetched species + negative cache

## Champions-specific gotchas

1. **No IVs.** All mons are 31/31/31/31/31/31 by default.
2. **SP, not EVs.** 66 total, 32 per stat. 1 SP = 8 EVs, so @smogon/calc
   (which takes EVs) will consume `sp × 8`.
3. **Mega, not Tera.** One per team per battle. Required-item names
   derived from Pikalytics usage data.
4. **No SP/nature in public data.** Pikalytics' FAQ block explicitly
   states this. Our types mark those fields optional; UI renders "—"
   when absent.

## What intentionally isn't built

- Server-side rendering or any backend
- Accounts / multi-user
- Replay / battle history storage
- Move database (needed soon for Obj 3 and real damage calc)
- Item database (partial, derived from meta-sets)

## Known stale-bait

If a memory or Record says "use X function," grep first — refactors
happen and file paths change. The architecture *shape* in this Record
is stabler than specific function names.
