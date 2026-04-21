# 002 — Match Assistant Design (Obj 3)

The headline feature of the original prompt. Most of the app so far has
been groundwork for this.

## What the user asked for (verbatim intent)

> I basically want to be able to start a match then once I see my
> opponents lineup, enter my opponents pokemon into the app and the app
> will automatically see what the meta suggests each pokemon's moves
> and items are most likely to be, this could include more than 4 moves
> per pokemon, or more than 1 item, the stats would likely be a bit of
> a spread. Then (I would already have my "active" team selected before
> all this) it would show me which 4 of my six pokemon on my team have
> the least weaknesses or the most strength against my opponent. After
> I select my 4 both in game and on the app (maybe I press "start" on
> the app or something) I should be able at any time to select which 2
> pokemon I have out and which 2 my opponent has out. I assume my
> opponents pokemon will be listed with more than 4 moves and more than
> 1 item since I'm sure the meta will not be carbon copies of the same
> pokemon and the app should account for that by showing what is
> possible. But, once I see a move or a held item i can click it on the
> app to verify so once I've seen 4 moves from one pokemon we know what
> it has and, maybe more importantly, doesn't have. Same with held
> items. Depending on my pokemon types and their moves I want to know
> which of my pokemon are strong or weak to each of my opponents
> pokemon.

Expect heavy iteration here — user anticipated that.

## Flow (states)

1. **Setup** — user picks one of their saved teams as active team for
   the match.
2. **Lineup** — user enters opponent's 6 species (autocomplete, supports
   runtime PokeAPI for unknown species).
3. **Bring** — app shows recommended 4-of-6 subsets from user's team,
   ranked by net threat (inbound vs outbound). User selects their 4.
4. **Active** — user marks which 2 of their 4 and which 2 of opponent's
   4 (well, 6 — we never know their final 4) are on field.
5. **Observe** — user clicks plausible moves/items to confirm or rule
   out. Confirmed set locks down the probability distribution.
6. **End** — clear state, reset.

Transition: explicit controls (buttons), not auto-detected.

## State model

```ts
interface Match {
  myTeamId: string;                    // saved team reference
  myActiveFour: string[];              // owned ids (length 4, post-bring)
  mySlotsOnField: [string?, string?];  // owned ids, length up to 2
  opponents: OpponentSlot[];           // length 6
  oppSlotsOnField: [number?, number?]; // indices into opponents
  startedAt?: string;
  megaUsed?: { mine: boolean; theirs: boolean };
}

interface OpponentSlot {
  species: string;
  plausibleMoves: { name: string; usage: number; state: ObservedState }[];
  plausibleItems: { name: string; usage: number; state: ObservedState }[];
  plausibleAbilities: { name: string; usage: number; state: ObservedState }[];
  // Derived on demand, not persisted:
  // - effective stats: computed from default competitive spread until we see anything
  // - bestKnownTypes: actual mon types (or mega types if mega confirmed)
}

type ObservedState = "unknown" | "seen" | "ruled-out";
```

Match state is **ephemeral** (localStorage "draft" slot), not a
persistent log. Clearing is a single button.

## Set prediction algorithm

For each opponent species, pull from `meta-sets.json` `distributions`:

- **Moves**: everything ≥ 3% usage, plus any lower-usage move already
  flagged "seen". Sort by usage desc.
- **Items**: everything ≥ 2% usage, same treatment.
- **Abilities**: everything ≥ 1%, same treatment.

Once 4 moves are marked "seen", remaining "unknown" moves auto-flip to
"ruled-out" (since a mon can only have 4 moves). Same for item at 1
"seen". Ability at 1 "seen".

Stat "spread" (in the user's wording) = a range. Compute both ends:
- Min-attack spread: 32 HP / 32 def+spdef bulk, neutral nature → defensive floor
- Max-attack spread: 32 HP / 32 attacking / rest bulk, Adamant/Modest → offensive ceiling

Display as e.g. "Atk 142–186" next to the mon.

## Bring-4 recommendation

Brute-force all 15 ways to pick 4-of-6 from user's team. For each
quartet, score:

- `offensiveScore` = sum across opponent's 6 of user's quartet's
  best `damageRatio` against them
- `defensiveScore` = sum across opponent's 6 of the negative of
  their best `damageRatio` against user's quartet's worst member
- `speedCoverage` = how many opponent speed tiers user's quartet can
  out-speed (Tailwind-aware)
- `roleBalance` = reward one physical + one special + one support-ish
  presence

Show top 3 quartets with per-quartet reasoning ("2HKOs Sneasler,
survives Kingambit Sucker"). User picks one.

## Live matchup cells

Once in Active: 2 × 2 grid of cells (my A/B × their X/Y). Each cell
shows:
- Type effectiveness from both directions (colored)
- Best move: the highest-`damageRatio` move from the attacker, with
  real damage roll (via `@smogon/calc`, once wired)
- Speed relation (faster / slower / ties)
- "Mega used?" flag if either is mega-capable

## Observation UI

Clicking a move chip in the opponent set toggles "seen" ↔ "unknown".
Long-press (or "×" button) marks "ruled-out". Visual states:
- **seen**: filled accent color, confirmed icon
- **unknown**: muted, normal weight
- **ruled-out**: strike-through

Set locks visually when 4 moves / 1 item / 1 ability seen.

## @smogon/calc integration (prerequisite)

`src/lib/calc.ts` adapter:
- `calcAgainst(attacker: EffectiveMon, defender: EffectiveMon, move: string, opts) → Result`
- Converts SP spread → EV (×8) for both sides
- Sets IV=31 fixed
- Chooses Gen 9 generation (closest to Champions mechanics; adjust
  if @smogon/calc adds a Champions preset)
- Handles mega form substitution via `resolveOwned`/`resolveMeta`

This also lets Obj 2's Threat panel show real "X does Y%" instead of
the ratio heuristic.

## Mobile layout (Fold target)

Single column, sections collapse progressively as user advances state.
Currently-active phase takes most of the viewport; prior phases are
summary chips that expand on tap.

## Open questions

- **Tailwind / speed swing** — does the user want the app to track
  whether Tailwind is up? Affects speed-tier math heavily. Probably
  yes but only as explicit toggles, not auto-detect.
- **Weather / terrain tracking** — flag auto-setter abilities
  (Drought, Drizzle, Grassy Surge) and let user click to declare
  weather active/inactive. Then calc honors it.
- **Dynamic pivoting / switches** — the user's flow assumes a single
  lead pair stays on field; in reality switches happen. Do we let them
  reassign "on field" slots mid-match freely? Probably yes, simple
  select change.
- **Persistence** — should the match state survive refresh? Probably
  yes, single active match in localStorage.

## Iteration anchor

Ship the skeleton first (route, state machine, opponent input, bring
recommendation) with the existing heuristic threat model. Layer in
`@smogon/calc`, observation UI polish, weather tracking, and sprite
rendering as follow-ups.
