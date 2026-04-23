import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/useData";
import { useDex } from "../data/useDex";
import { useOwned } from "../store/collection";
import { speciesKey } from "../lib/species";
import { Card, CardBody, CardHeader } from "../components/Card";
import TypeBadge from "../components/TypeBadge";
import TeamMemberDetail from "../components/TeamMemberDetail";

type BuildFilter = "all" | "full" | "close" | "nearly";

export default function TopTeams() {
  const status = useData();
  const owned = useOwned();
  const { lookup, ensureMany } = useDex();
  const [filter, setFilter] = useState<BuildFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ownedKeys = useMemo(
    () => new Set(owned.map((o) => speciesKey(o.species))),
    [owned],
  );

  const teamSpecies = useMemo(
    () =>
      status.state === "ready"
        ? status.data.teams.teams.flatMap((t) => t.pokemon.map((p) => p.species))
        : [],
    [status],
  );

  useEffect(() => {
    ensureMany(teamSpecies);
  }, [teamSpecies, ensureMany]);

  if (status.state === "loading") return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (status.state === "error") return <div className="text-red-400">{status.error.message}</div>;

  const { teams } = status.data;
  const scored = teams.teams
    .map((t) => {
      const ownedCount = t.pokemon.filter((p) => ownedKeys.has(speciesKey(p.species))).length;
      const missing = t.pokemon.filter((p) => !ownedKeys.has(speciesKey(p.species)));
      return { team: t, ownedCount, missing };
    })
    .filter((x) => {
      const missing = x.team.pokemon.length - x.ownedCount;
      if (filter === "full") return missing === 0;
      if (filter === "close") return missing <= 1;
      if (filter === "nearly") return missing <= 2;
      return true;
    })
    .sort((a, b) => b.ownedCount - a.ownedCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {([
          { key: "all", label: "All teams" },
          { key: "nearly", label: "≤2 missing" },
          { key: "close", label: "≤1 missing" },
          { key: "full", label: "Can build now" },
        ] as { key: BuildFilter; label: string }[]).map((o) => (
          <button
            key={o.key}
            onClick={() => setFilter(o.key)}
            className={`px-3 min-h-10 rounded text-xs flex items-center ${
              filter === o.key
                ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium"
                : "bg-[var(--color-surface-hi)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scored.map(({ team, ownedCount, missing }) => {
          const pct = team.pokemon.length === 0 ? 0 : ownedCount / team.pokemon.length;
          const isOpen = expandedId === team.id;
          return (
            <Card
              key={team.id}
              className={isOpen ? "md:col-span-2" : undefined}
            >
              <CardHeader>
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : team.id)}
                  aria-expanded={isOpen}
                  className="w-full text-left flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <span
                        className={`inline-block text-[var(--color-muted)] transition-transform ${
                          isOpen ? "rotate-90" : ""
                        }`}
                      >
                        ›
                      </span>
                      {team.name ?? team.id}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {[team.placement, team.tournament, team.player, team.date]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      {ownedCount}/{team.pokemon.length}
                    </div>
                    <div className="text-[10px] text-[var(--color-muted)] uppercase tracking-wide">
                      buildable
                    </div>
                  </div>
                </button>
                <div className="mt-2 h-1.5 bg-[var(--color-surface-hi)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-all"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </CardHeader>
              {!isOpen ? (
                <CardBody className="flex flex-col gap-1.5">
                  {team.pokemon.map((p, i) => {
                    const entry = lookup(p.species);
                    const ownedThis = ownedKeys.has(speciesKey(p.species));
                    return (
                      <div
                        key={i}
                        className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${
                          ownedThis ? "" : "opacity-60"
                        }`}
                      >
                        <span className="w-4 text-center">
                          {ownedThis ? (
                            <span className="text-[var(--color-accent)]">✓</span>
                          ) : (
                            <span className="text-[var(--color-muted)]">·</span>
                          )}
                        </span>
                        <span className="font-medium">{p.species}</span>
                        <div className="flex gap-1">
                          {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
                        </div>
                        <span className="text-xs text-[var(--color-muted)] ml-auto basis-full sm:basis-auto">
                          {[p.item, p.mega ? "(mega)" : ""].filter(Boolean).join(" ")}
                        </span>
                      </div>
                    );
                  })}
                  {missing.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                      Missing: {missing.map((m) => m.species).join(", ")}
                    </div>
                  )}
                </CardBody>
              ) : (
                <CardBody className="flex flex-col">
                  {(() => {
                    const teamMoves = team.pokemon.flatMap((p) => p.moves ?? []);
                    return team.pokemon.map((p, i) => (
                      <TeamMemberDetail key={i} member={p} teamMoves={teamMoves} />
                    ));
                  })()}
                  {missing.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-xs text-[var(--color-muted)]">
                      Missing from your collection: {missing.map((m) => m.species).join(", ")}
                    </div>
                  )}
                </CardBody>
              )}
            </Card>
          );
        })}
        {scored.length === 0 && (
          <div className="text-sm text-[var(--color-muted)]">No teams match this filter.</div>
        )}
      </div>
    </div>
  );
}
