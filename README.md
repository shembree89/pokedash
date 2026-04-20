# pokedash

A personal dashboard for competitive **Pokemon Champions** — VGC doubles, Regulation M-A.

Live: https://shembree89.github.io/pokedash/

## Status

Phase 1 (collection + meta browser) is the current MVP. See
`docs/` for roadmap once created. Data is currently hand-seeded sample data
until the scraper lands.

## Stack

- Vite + React + TypeScript
- Tailwind CSS v4
- Hash router (GitHub Pages friendly)
- localStorage for collection + saved teams
- Static JSON in `public/data/` for meta data

## Dev

```bash
npm install
npm run dev       # Vite dev server
npm run build     # type-check + production build
npm run preview   # serve dist
```

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml` which builds and
publishes to GitHub Pages. Pages source must be set to "GitHub Actions" in
repo settings.

## Mechanics notes (Reg M-A)

- No IVs — all mons have perfect 31s.
- No EVs — replaced by **Stat Points (SP)**: total ≤ 66, per-stat ≤ 32.
- **Mega Evolution** is the gimmick, not Terastallization.
- One mega per team per battle, no duplicate species, no duplicate items.
- 6-pokemon team → bring 4; doubles (2v2 active).
