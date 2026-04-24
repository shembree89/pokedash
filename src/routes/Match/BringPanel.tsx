import { useEffect, useMemo, useState } from "react";
import { setMyFour, setPhase, useMatch } from "../../store/match";
import { useOwned, useTeams } from "../../store/collection";
import { useData } from "../../data/useData";
import { useDex } from "../../data/useDex";
import { useMoves } from "../../data/useMoves";
import type { EffectiveMon } from "../../lib/threat";
import { resolveOwned, resolveMeta } from "../../lib/threat";
import { buildMatchupMatrix, type MatchupPair } from "../../lib/matchup-grid";
import { topQuartets, type QuartetScore } from "../../lib/quartet-scorer";
import { Card, CardBody, CardHeader } from "../../components/Card";
import Button from "../../components/Button";
import TypeBadge from "../../components/TypeBadge";
import FieldControls from "./FieldControls";

export default function BringPanel() {
  const match = useMatch();
  const teams = useTeams();
  const owned = useOwned();
  const data = useData();
  const { lookup, ensureMany } = useDex();
  const moves = useMoves();

  const team = useMemo(() => teams.find((t) => t.id === match.myTeamId), [teams, match.myTeamId]);
  const ownedInTeam = useMemo(() => {
    if (!team) return [];
    return team.ownedIds
      .map((id) => owned.find((o) => o.id === id))
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
  }, [team, owned]);

  const oppSpecies = useMemo(() => match.opponents.map((o) => o.species), [match.opponents]);

  useEffect(() => {
    ensureMany(oppSpecies);
  }, [oppSpecies, ensureMany]);

  const myEffective = useMemo<EffectiveMon[]>(
    () => ownedInTeam.map((m) => resolveOwned(m, lookup(m.species))),
    [ownedInTeam, lookup],
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

  const movesByName = moves.byName;
  const attackerMoves = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const mon of myEffective) {
      const own = ownedInTeam.find((o) => o.species === mon.species);
      m.set(mon.species, (own?.moves ?? []).filter(Boolean));
    }
    return m;
  }, [myEffective, ownedInTeam]);

  const [matrix, setMatrix] = useState<MatchupPair[][] | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (
      data.state !== "ready" ||
      myEffective.length !== 6 ||
      oppEffective.length !== 6 ||
      movesByName.size === 0
    ) {
      return;
    }
    setComputing(true);
    const field = {
      gameType: "Doubles" as const,
      isTrickRoom: match.field.trickRoom,
      attackerSide: { isTailwind: match.field.tailwindMine },
      defenderSide: { isTailwind: match.field.tailwindTheirs },
    };
    buildMatchupMatrix(myEffective, oppEffective, attackerMoves, movesByName, { field })
      .then((result) => {
        if (!cancelled) setMatrix(result);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data.state, myEffective, oppEffective, attackerMoves, movesByName, match.field]);

  const quartets: QuartetScore[] = useMemo(() => {
    if (!matrix) return [];
    return topQuartets(myEffective, oppEffective, { matrix, trickRoom: match.field.trickRoom }, 3);
  }, [matrix, myEffective, oppEffective, match.field.trickRoom]);

  const chooseQuartet = (q: QuartetScore) => {
    const ids = q.indices.map((i) => ownedInTeam[i]!.id);
    setMyFour(ids);
  };

  if (!team) {
    return (
      <Card>
        <CardBody>
          <div className="text-sm text-[var(--color-muted)]">No team selected.</div>
          <Button variant="ghost" onClick={() => setPhase("setup")}>
            ← Back to setup
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldControls />
      <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Recommended quartets</div>
            <div className="text-xs text-[var(--color-muted)]">
              Scored against {match.opponents.length} opponents using real damage rolls
            </div>
          </div>
          {computing && (
            <div className="text-xs text-[var(--color-muted)]">Computing…</div>
          )}
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {!matrix && !computing && (
          <div className="text-sm text-[var(--color-muted)]">Preparing matchup matrix…</div>
        )}
        {quartets.map((q, rank) => {
          const label = rank === 0 ? "Best" : rank === 1 ? "Alt" : "Defensive";
          return (
            <div
              key={q.indices.join("-")}
              className="p-3 rounded border border-[var(--color-border)] bg-[var(--color-surface-hi)] flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-[var(--color-accent)] font-semibold">
                    {label}
                  </span>
                  <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                    score {q.total.toFixed(1)}
                  </span>
                </div>
                <Button variant="primary" onClick={() => chooseQuartet(q)}>
                  Bring these →
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {q.team.map((mon) => {
                  const entry = lookup(mon.species);
                  return (
                    <div
                      key={mon.species}
                      className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-border)]"
                    >
                      <span className="text-sm">{mon.species}</span>
                      {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
                    </div>
                  );
                })}
              </div>
              {q.reasons.length > 0 && (
                <ul className="text-xs text-[var(--color-muted)] list-disc list-inside space-y-0.5">
                  {q.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          );
        })}
        <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
          <Button variant="ghost" onClick={() => setPhase("lineup")}>
            ← Back
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              const first4 = ownedInTeam.slice(0, 4).map((m) => m.id);
              setMyFour(first4);
            }}
          >
            Skip — use first 4
          </Button>
        </div>
      </CardBody>
    </Card>
    </div>
  );
}
