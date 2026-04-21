# Data files

**Source:** [Pikalytics](https://www.pikalytics.com) Champions AI endpoint
(`/ai/pokedex/championstournaments`) for meta usage, sets, and featured
tournament teams. [PokeAPI](https://pokeapi.co) for species base stats /
types / abilities.

Refreshed weekly via `.github/workflows/refresh-data.yml`. Manual refresh:
`npm run data:refresh`.

## Files

- `pokedex-champions.json` — species base stats, types, abilities, and
  hand-curated mega forms. Auto-extended from PokeAPI when top-50 meta adds
  new species. Megas are not auto-populated.
- `meta-usage.json` — top-50 pokemon by Champions ranked usage.
- `meta-sets.json` — synthesized "most common" set per pokemon (top item,
  top ability, top 4 moves) plus the full distribution for richer UI.
- `meta-teams.json` — tournament teams aggregated from Pikalytics
  "Featured Teams" sections (deduplicated by player + event).

## Champions mechanics notes

- **SP**: Reg M-A uses Stat Points, not EVs. Total ≤ 66, per-stat ≤ 32.
  Pikalytics does not expose SP spreads; meta sets omit spread/nature.
- **Mega Evolution** is the battle gimmick. One mega per team per battle.
  Mega item on a set implies that mon is the team's mega user.
- **No IVs** in Champions; fixed at 31 by default.
- **Roster**: ~269 pokemon, no legendaries.

## Known gaps

- SP spreads and natures are unavailable from Pikalytics Champions data.
- Mega forms need manual entry in `pokedex-champions.json`; the auto-enrich
  script only fetches base forms.
- Tournament team placement is "Record W-L", not "Top N" — Pikalytics
  featured teams don't expose ladder placement.
