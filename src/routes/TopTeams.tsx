import { useMemo, useState } from "react";
import { useData } from "../data/useData";
import { useOwned } from "../store/collection";
import { speciesKey } from "../lib/species";
import { Card, CardBody, CardHeader } from "../components/Card";
import TypeBadge from "../components/TypeBadge";

type BuildFilter = "all" | "full" | "close";

export default function TopTeams() {
  const status = useData();
  const owned = useOwned();
  const [filter, setFilter] = useState<BuildFilter>("all");

  const ownedKeys = useMemo(
    () => new Set(owned.map((o) => speciesKey(o.species))),
    [owned],
  );

  if (status.state === "loading") return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (status.state === "error") return <div className="text-red-400">{status.error.message}</div>;

  const { teams, pokedex } = status.data as typeof status.data;
  const scored = teams.teams
    .map((t) => {
      const ownedCount = t.pokemon.filter((p) => ownedKeys.has(speciesKey(p.species))).length;
      const missing = t.pokemon.filter((p) => !ownedKeys.has(speciesKey(p.species)));
      return { team: t, ownedCount, missing };
    })
    .filter((x) => {
      if (filter === "full") return x.ownedCount === x.team.pokemon.length;
      if (filter === "close") return x.team.pokemon.length - x.ownedCount <= 1;
      return true;
    })
    .sort((a, b) => b.ownedCount - a.ownedCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        {([
          { key: "all", label: "All teams" },
          { key: "close", label: "≤1 missing" },
          { key: "full", label: "Can build now" },
        ] as { key: BuildFilter; label: string }[]).map((o) => (
          <button
            key={o.key}
            onClick={() => setFilter(o.key)}
            className={`px-3 py-1.5 rounded text-xs ${
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
          return (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{team.name ?? team.id}</div>
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
                </div>
                <div className="mt-2 h-1.5 bg-[var(--color-surface-hi)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-all"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
              </CardHeader>
              <CardBody className="flex flex-col gap-1.5">
                {team.pokemon.map((p, i) => {
                  const entry = pokedex.pokemon[p.species];
                  const ownedThis = ownedKeys.has(speciesKey(p.species));
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-sm ${
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
                      <span className="font-medium min-w-32">{p.species}</span>
                      <div className="flex gap-1">
                        {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
                      </div>
                      <span className="text-xs text-[var(--color-muted)] ml-auto">
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
