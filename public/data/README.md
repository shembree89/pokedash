# Data files

Sample hand-curated data for **VGC Pokemon Champions · Regulation M-A**.

**This is placeholder data**, not real usage statistics. Replace via the
scheduled scraper workflow (to be added) that pulls from:

- `pikalytics.com/champions` — usage % and common sets
- `limitlessvgc.com` — tournament team lists

## Files

- `pokedex-champions.json` — species metadata (types, base stats, abilities, mega forms)
- `meta-usage.json` — ranked list of pokemon by usage %
- `meta-sets.json` — most common set(s) per pokemon (ability, item, nature, moves, SP spread)
- `meta-teams.json` — tournament/sample teams

## Data model notes

- **Stat Points (SP)**: Reg M-A uses SP instead of EVs. Total ≤ 66, per-stat ≤ 32.
- **No IVs** in the game; all mons have perfect 31s by default.
- **Megas**: one per team per battle. Flag the mega-using mon with `"mega": true`.
- **Natures** still function normally (±10%).
