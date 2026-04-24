import { useEffect, useMemo, useState } from "react";
import {
  setMySlot,
  setOppSlot,
  setPhase,
  useMatch,
} from "../../store/match";
import { useOwned, useTeams } from "../../store/collection";
import { useData } from "../../data/useData";
import { useDex } from "../../data/useDex";
import { useMoves } from "../../data/useMoves";
import type { EffectiveMon } from "../../lib/threat";
import { resolveMeta, resolveOwned } from "../../lib/threat";
import { bestMoveAgainst, effectivenessOf, type BestMoveResult } from "../../lib/matchup-grid";
import { Card, CardBody, CardHeader } from "../../components/Card";
import Button from "../../components/Button";
import TypeBadge from "../../components/TypeBadge";
import OpponentSlotPanel from "./OpponentSlotPanel";
import FieldControls from "./FieldControls";

interface PairData {
  my: EffectiveMon;
  opp: EffectiveMon;
  fromMe?: BestMoveResult;
  fromOpp?: BestMoveResult;
  speedRelation: "faster" | "slower" | "tied";
  effMe: number;
  effOpp: number;
}

function speedRel(me: EffectiveMon, opp: EffectiveMon, tr: boolean): PairData["speedRelation"] {
  if (me.stats.spe === opp.stats.spe) return "tied";
  const faster = tr ? me.stats.spe < opp.stats.spe : me.stats.spe > opp.stats.spe;
  return faster ? "faster" : "slower";
}

function effBand(mult: number): string {
  if (mult === 0) return "×0";
  if (mult === 0.25) return "¼×";
  if (mult === 0.5) return "½×";
  if (mult === 1) return "1×";
  if (mult === 2) return "2×";
  if (mult === 4) return "4×";
  return `${mult}×`;
}

function effColor(mult: number): string {
  if (mult === 0) return "text-neutral-500";
  if (mult < 1) return "text-blue-400";
  if (mult === 1) return "text-[var(--color-muted)]";
  if (mult >= 2) return "text-orange-400";
  return "";
}

export default function ActivePanel() {
  const match = useMatch();
  const teams = useTeams();
  const owned = useOwned();
  const data = useData();
  const { lookup } = useDex();
  const moves = useMoves();

  const team = teams.find((t) => t.id === match.myTeamId);
  const myMons = useMemo(() => {
    if (!team) return [];
    return match.myActiveFour
      .map((id) => owned.find((o) => o.id === id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
  }, [team, match.myActiveFour, owned]);

  const myEffective = useMemo<EffectiveMon[]>(
    () => myMons.map((m) => resolveOwned(m, lookup(m.species))),
    [myMons, lookup],
  );
  const oppEffective = useMemo<EffectiveMon[]>(
    () =>
      match.opponents.map((o) => {
        const entry = lookup(o.species);
        if (!entry) {
          const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
          return { species: o.species, types: [], baseStats: zero, stats: zero };
        }
        return resolveMeta(entry);
      }),
    [match.opponents, lookup],
  );

  const oppLikelyMoves = useMemo(() => {
    const out = new Map<string, string[]>();
    if (data.state !== "ready") return out;
    const dists = data.data.sets.distributions;
    if (!dists) return out;
    for (const opp of match.opponents) {
      const dist = dists[opp.species];
      if (!dist) {
        out.set(opp.species, []);
        continue;
      }
      const ruled = new Set(
        opp.observedMoves.filter((o) => o.state === "ruled-out").map((o) => o.name),
      );
      const top = dist.moves
        .filter((m) => m.usage >= 0.15 && !ruled.has(m.name))
        .slice(0, 6)
        .map((m) => m.name);
      out.set(opp.species, top);
    }
    return out;
  }, [data, match.opponents]);

  const [pairs, setPairs] = useState<(PairData | null)[][] | null>(null);
  const [computing, setComputing] = useState(false);

  const fieldOpts = useMemo(
    () => ({
      gameType: "Doubles" as const,
      isTrickRoom: match.field.trickRoom,
      weather: match.field.weather ?? undefined,
      terrain: match.field.terrain ?? undefined,
      attackerSide: { isTailwind: match.field.tailwindMine },
      defenderSide: { isTailwind: match.field.tailwindTheirs },
    }),
    [match.field],
  );

  useEffect(() => {
    let cancelled = false;
    if (
      data.state !== "ready" ||
      myEffective.length === 0 ||
      oppEffective.length === 0 ||
      moves.byName.size === 0
    ) {
      return;
    }
    setComputing(true);
    (async () => {
      const rows: (PairData | null)[][] = [];
      for (let i = 0; i < myEffective.length; i++) {
        const row: (PairData | null)[] = [];
        for (let j = 0; j < oppEffective.length; j++) {
          const me = myEffective[i]!;
          const opp = oppEffective[j]!;
          const myMoves = myMons[i]?.moves ?? [];
          const oppMoves = oppLikelyMoves.get(opp.species) ?? [];
          const fromMe = await bestMoveAgainst(me, opp, myMoves, moves.byName, { field: fieldOpts });
          const fromOpp = await bestMoveAgainst(opp, me, oppMoves, moves.byName, {
            field: {
              ...fieldOpts,
              attackerSide: fieldOpts.defenderSide,
              defenderSide: fieldOpts.attackerSide,
            },
          });
          row.push({
            my: me,
            opp,
            fromMe,
            fromOpp,
            speedRelation: speedRel(me, opp, fieldOpts.isTrickRoom ?? false),
            effMe: effectivenessOf(me, opp).mult,
            effOpp: effectivenessOf(opp, me).mult,
          });
        }
        rows.push(row);
        if (cancelled) return;
      }
      if (!cancelled) {
        setPairs(rows);
        setComputing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, myEffective, oppEffective, moves.byName, myMons, oppLikelyMoves, fieldOpts]);

  const my0 = match.mySlotsOnField[0];
  const my1 = match.mySlotsOnField[1];
  const opp0 = match.oppSlotsOnField[0];
  const opp1 = match.oppSlotsOnField[1];

  const myIdx = (ownedId: string | null) =>
    ownedId ? myMons.findIndex((m) => m.id === ownedId) : -1;
  const myIdx0 = myIdx(my0);
  const myIdx1 = myIdx(my1);

  const pairAt = (mi: number, oi: number | null): PairData | null => {
    if (mi < 0 || oi == null || !pairs) return null;
    return pairs[mi]?.[oi] ?? null;
  };

  const cells: { key: string; pair: PairData | null }[] = [
    { key: "A×X", pair: pairAt(myIdx0, opp0) },
    { key: "A×Y", pair: pairAt(myIdx0, opp1) },
    { key: "B×X", pair: pairAt(myIdx1, opp0) },
    { key: "B×Y", pair: pairAt(myIdx1, opp1) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FieldControls />
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">On field</div>
          <div className="text-xs text-[var(--color-muted)]">
            Pick your two and their two to see matchups
          </div>
        </CardHeader>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">
              Your pair
            </div>
            <div className="flex gap-2">
              {[0, 1].map((slot) => {
                const val = match.mySlotsOnField[slot];
                return (
                  <select
                    key={slot}
                    value={val ?? ""}
                    onChange={(e) =>
                      setMySlot(slot as 0 | 1, e.target.value || null)
                    }
                    className="edit-input flex-1"
                  >
                    <option value="">{slot === 0 ? "Slot A" : "Slot B"}</option>
                    {myMons.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.species}
                      </option>
                    ))}
                  </select>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">
              Their pair
            </div>
            <div className="flex gap-2">
              {[0, 1].map((slot) => {
                const val = match.oppSlotsOnField[slot];
                return (
                  <select
                    key={slot}
                    value={val == null ? "" : String(val)}
                    onChange={(e) =>
                      setOppSlot(
                        slot as 0 | 1,
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="edit-input flex-1"
                  >
                    <option value="">{slot === 0 ? "Slot X" : "Slot Y"}</option>
                    {match.opponents.map((o, i) => (
                      <option key={i} value={i}>
                        {o.species}
                      </option>
                    ))}
                  </select>
                );
              })}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-semibold">Matchups</div>
            {computing && (
              <div className="text-xs text-[var(--color-muted)]">Computing…</div>
            )}
          </div>
        </CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cells.map(({ key, pair }) => (
            <MatchupCell key={key} label={key} pair={pair} />
          ))}
        </CardBody>
      </Card>

      <div>
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-2">
          Opponent observations
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {match.opponents.map((o, i) => (
            <OpponentSlotPanel
              key={i}
              index={i}
              slot={o}
              distribution={
                data.state === "ready" ? data.data.sets.distributions?.[o.species] : undefined
              }
            />
          ))}
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setPhase("bring")}>
          ← Back to bring
        </Button>
      </div>
    </div>
  );
}

function MatchupCell({ label, pair }: { label: string; pair: PairData | null }) {
  if (!pair) {
    return (
      <div className="p-3 rounded border border-dashed border-[var(--color-border)] text-xs text-[var(--color-muted)]">
        <div className="font-semibold">{label}</div>
        <div className="mt-1">Pick both slots to see matchup.</div>
      </div>
    );
  }
  return (
    <div className="p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-hi)] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
        <div className="text-[10px] tabular-nums text-[var(--color-muted)]">
          {pair.speedRelation === "faster"
            ? "you first"
            : pair.speedRelation === "slower"
              ? "they first"
              : "tied"}
        </div>
      </div>
      <Direction
        attacker={pair.my}
        defender={pair.opp}
        result={pair.fromMe}
        eff={pair.effMe}
        direction="out"
      />
      <Direction
        attacker={pair.opp}
        defender={pair.my}
        result={pair.fromOpp}
        eff={pair.effOpp}
        direction="in"
      />
    </div>
  );
}

function Direction({
  attacker,
  defender,
  result,
  eff,
  direction,
}: {
  attacker: EffectiveMon;
  defender: EffectiveMon;
  result: BestMoveResult | undefined;
  eff: number;
  direction: "in" | "out";
}) {
  const labelColor = direction === "out" ? "text-[var(--color-accent)]" : "text-orange-300";
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 text-xs">
        <span className={labelColor}>
          {direction === "out" ? "you →" : "opp →"}
        </span>
        <span className="truncate">
          {attacker.species} <span className="text-[var(--color-muted)]">→</span> {defender.species}
        </span>
        <span className={`ml-auto tabular-nums ${effColor(eff)}`}>{effBand(eff)}</span>
      </div>
      {result ? (
        <div className="mt-0.5 flex items-center gap-2">
          <TypeBadge type={result.move.type as never} />
          <span className="text-sm font-medium">{result.move.name}</span>
          <span className="ml-auto text-sm tabular-nums">
            {result.pctMin.toFixed(0)}–{result.pctMax.toFixed(0)}%
          </span>
        </div>
      ) : (
        <div className="text-xs text-[var(--color-muted)] mt-0.5">No damaging moves known</div>
      )}
      {result?.koChanceText && (
        <div className="text-[10px] text-[var(--color-muted)]">{result.koChanceText}</div>
      )}
    </div>
  );
}
