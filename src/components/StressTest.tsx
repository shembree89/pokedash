import { useEffect, useMemo, useState } from "react";
import type { EffectiveMon } from "../lib/threat";
import { resolveMeta } from "../lib/threat";
import { useData } from "../data/useData";
import { useDex } from "../data/useDex";
import { useMoves } from "../data/useMoves";
import { buildMatchupMatrix, type MatchupPair } from "../lib/matchup-grid";
import { topQuartets, type QuartetScore } from "../lib/quartet-scorer";
import { Card, CardBody, CardHeader } from "./Card";
import TypeBadge from "./TypeBadge";
import type { MetaTeam } from "../data/types";

interface Props {
  team: EffectiveMon[];
  teamOwnedMoves: Map<string, string[]>;
}

export default function StressTest({ team, teamOwnedMoves }: Props) {
  const data = useData();
  const { lookup, ensureMany } = useDex();
  const moves = useMoves();
  const [teamId, setTeamId] = useState<string>("");

  const metaTeams = data.state === "ready" ? data.data.teams.teams : [];
  const selected: MetaTeam | undefined = metaTeams.find((t) => t.id === teamId);

  useEffect(() => {
    if (selected) ensureMany(selected.pokemon.map((p) => p.species));
  }, [selected, ensureMany]);

  const oppEffective = useMemo<EffectiveMon[]>(() => {
    if (!selected) return [];
    return selected.pokemon.map((p) => {
      const entry = lookup(p.species);
      if (!entry) {
        const zero = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        return { species: p.species, types: [], baseStats: zero, stats: zero };
      }
      return resolveMeta(entry);
    });
  }, [selected, lookup]);

  const [matrix, setMatrix] = useState<MatchupPair[][] | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (
      !selected ||
      team.length !== 6 ||
      oppEffective.length < 4 ||
      moves.byName.size === 0
    ) {
      setMatrix(null);
      return;
    }
    setComputing(true);
    buildMatchupMatrix(team, oppEffective, teamOwnedMoves, moves.byName, {
      field: { gameType: "Doubles" },
    })
      .then((m) => {
        if (!cancelled) setMatrix(m);
      })
      .finally(() => {
        if (!cancelled) setComputing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, team, oppEffective, teamOwnedMoves, moves.byName]);

  const quartets: QuartetScore[] = useMemo(() => {
    if (!matrix || team.length !== 6 || oppEffective.length < 4) return [];
    return topQuartets(team, oppEffective, { matrix }, 3);
  }, [matrix, team, oppEffective]);

  if (team.length !== 6) {
    return (
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold">Stress test</div>
          <div className="text-xs text-[var(--color-muted)]">
            Fill all 6 slots to stress-test against a meta team.
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Stress test vs meta team</div>
            <div className="text-xs text-[var(--color-muted)]">
              Simulates the match-assistant bring phase against a known tournament team.
            </div>
          </div>
          {computing && (
            <div className="text-xs text-[var(--color-muted)]">Computing…</div>
          )}
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="edit-input w-full"
        >
          <option value="">Pick a meta team…</option>
          {metaTeams.map((t) => {
            const label = [t.player, t.placement, t.tournament]
              .filter(Boolean)
              .join(" · ") || t.id;
            return (
              <option key={t.id} value={t.id}>
                {label} — {t.pokemon.map((p) => p.species).join(", ")}
              </option>
            );
          })}
        </select>

        {selected && (
          <div className="flex flex-wrap gap-2">
            {selected.pokemon.map((p, i) => {
              const entry = lookup(p.species);
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-surface-hi)] border border-[var(--color-border)]"
                >
                  <span className="text-sm">{p.species}</span>
                  {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
                </div>
              );
            })}
          </div>
        )}

        {quartets.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Recommended quartets
            </div>
            {quartets.map((q, rank) => {
              const label = rank === 0 ? "Best" : rank === 1 ? "Alt" : "Defensive";
              return (
                <div
                  key={q.indices.join("-")}
                  className="p-2 rounded border border-[var(--color-border)] flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-accent)]">
                      {label}
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                      score {q.total.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-sm flex flex-wrap gap-1">
                    {q.team.map((m) => (
                      <span
                        key={m.species}
                        className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)]"
                      >
                        {m.species}
                      </span>
                    ))}
                  </div>
                  {q.reasons.length > 0 && (
                    <ul className="text-[11px] text-[var(--color-muted)] list-disc list-inside">
                      {q.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {matrix && (
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] mb-1">
              Worst matchup per opponent
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              {oppEffective.map((opp, j) => {
                let best = { mon: "—", pct: 0, move: "", ko: "" };
                for (let i = 0; i < team.length; i++) {
                  const pair = matrix[i]?.[j];
                  const pct = pair?.bestMove?.pctMax ?? 0;
                  if (pct > best.pct) {
                    best = {
                      mon: team[i]!.species,
                      pct,
                      move: pair?.bestMove?.move.name ?? "",
                      ko: pair?.bestMove?.koChanceText ?? "",
                    };
                  }
                }
                return (
                  <div key={j} className="flex gap-2">
                    <span className="text-[var(--color-muted)] w-28 truncate">{opp.species}</span>
                    <span className="flex-1 truncate">
                      {best.mon} · {best.move} {best.pct.toFixed(0)}%
                    </span>
                    <span className="text-[var(--color-muted)] tabular-nums">{best.ko}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
