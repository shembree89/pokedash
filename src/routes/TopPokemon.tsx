import { Fragment, useEffect, useMemo, useState } from "react";
import { useData } from "../data/useData";
import { useDex } from "../data/useDex";
import { useOwned } from "../store/collection";
import { speciesKey } from "../lib/species";
import TypeBadge from "../components/TypeBadge";
import { Card, CardBody, CardHeader } from "../components/Card";
import SpeciesCatchInfo from "../components/SpeciesCatchInfo";

type OwnFilter = "all" | "owned" | "unowned";
type SortKey = "rank" | "name" | "usage";

export default function TopPokemon() {
  const status = useData();
  const owned = useOwned();
  const { lookup, ensureMany } = useDex();
  const [ownFilter, setOwnFilter] = useState<OwnFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const ownedKeys = useMemo(
    () => new Set(owned.map((o) => speciesKey(o.species))),
    [owned],
  );

  const speciesList = useMemo(
    () => (status.state === "ready" ? status.data.usage.pokemon.map((u) => u.species) : []),
    [status],
  );

  useEffect(() => {
    ensureMany(speciesList);
  }, [speciesList, ensureMany]);

  if (status.state === "loading") return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (status.state === "error") return <div className="text-red-400">{status.error.message}</div>;

  const { usage, sets } = status.data;

  const rows = usage.pokemon
    .map((u) => {
      const entry = lookup(u.species);
      const set = sets.sets[u.species]?.[0];
      return {
        rank: u.rank,
        species: u.species,
        usage: u.usage,
        types: entry?.types ?? [],
        item: set?.item ?? "",
        ability: set?.ability ?? "",
        owned: ownedKeys.has(speciesKey(u.species)),
      };
    })
    .filter((r) => {
      if (ownFilter === "owned" && !r.owned) return false;
      if (ownFilter === "unowned" && r.owned) return false;
      if (query && !r.species.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "rank") return a.rank - b.rank;
      if (sortKey === "usage") return b.usage - a.usage;
      return a.species.localeCompare(b.species);
    });

  const topUnowned = usage.pokemon
    .filter((u) => !ownedKeys.has(speciesKey(u.species)))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Top pokemon you don't own</div>
              <div className="text-xs text-[var(--color-muted)]">
                The highest-usage meta pokemon missing from your collection.
              </div>
            </div>
            <div className="text-xs text-[var(--color-muted)]">{owned.length} owned</div>
          </div>
        </CardHeader>
        <CardBody>
          {topUnowned.length === 0 ? (
            <div className="text-sm text-[var(--color-muted)]">
              You own every top-{usage.pokemon.length} pokemon in the current meta. Nice.
            </div>
          ) : (
            <ol className="flex flex-wrap gap-2">
              {topUnowned.map((u) => (
                <li
                  key={u.species}
                  className="px-3 py-1.5 bg-[var(--color-surface-hi)] border border-[var(--color-border)] rounded text-sm"
                >
                  <span className="text-[var(--color-muted)] mr-1">#{u.rank}</span>
                  <span className="font-medium">{u.species}</span>
                  <span className="text-[var(--color-muted)] ml-2">
                    {(u.usage * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          type="search"
          placeholder="Search species…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-auto px-3 min-h-10 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex gap-1">
          {(["all", "owned", "unowned"] as OwnFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setOwnFilter(f)}
              className={`px-3 min-h-10 rounded text-xs capitalize flex items-center ${
                ownFilter === f
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium"
                  : "bg-[var(--color-surface-hi)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto flex items-center gap-1 text-xs">
          <span className="text-[var(--color-muted)] mr-1">Sort</span>
          {(["rank", "name", "usage"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-3 min-h-10 rounded capitalize flex items-center ${
                sortKey === k
                  ? "bg-[var(--color-surface-hi)] text-[var(--color-fg)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-hi)] text-[var(--color-muted)] text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-2 sm:px-3 py-2 w-10">#</th>
                <th className="text-left px-2 sm:px-3 py-2">Species</th>
                <th className="text-left px-2 sm:px-3 py-2 hidden md:table-cell">Types</th>
                <th className="text-right px-2 sm:px-3 py-2 w-16">Usage</th>
                <th className="text-left px-2 sm:px-3 py-2 hidden lg:table-cell">Common set</th>
                <th className="text-left px-2 sm:px-3 py-2 w-14">Own</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = expanded === r.species;
                return (
                  <Fragment key={r.species}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : r.species)}
                      aria-expanded={isOpen}
                      className={`border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-hi)]/50 ${
                        isOpen ? "bg-[var(--color-surface-hi)]/50" : ""
                      }`}
                    >
                      <td className="px-2 sm:px-3 py-2 text-[var(--color-muted)] text-xs tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`inline-block text-[var(--color-muted)] transition-transform ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          >
                            ›
                          </span>
                          {r.rank}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-2">
                        <div className="font-medium">{r.species}</div>
                        <div className="flex gap-1 mt-1 md:hidden">
                          {r.types.map((t) => <TypeBadge key={t} type={t} />)}
                        </div>
                        <div className="text-[11px] text-[var(--color-muted)] mt-0.5 lg:hidden">
                          {r.ability ? `${r.ability} · ${r.item}` : ""}
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 py-2 hidden md:table-cell">
                        <div className="flex gap-1">
                          {r.types.map((t) => <TypeBadge key={t} type={t} />)}
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 py-2 text-right tabular-nums text-xs sm:text-sm">
                        {(r.usage * 100).toFixed(0)}%
                      </td>
                      <td className="px-2 sm:px-3 py-2 text-xs text-[var(--color-muted)] hidden lg:table-cell">
                        {r.ability ? `${r.ability} · ${r.item}` : "—"}
                      </td>
                      <td className="px-2 sm:px-3 py-2">
                        {r.owned ? (
                          <span className="text-[var(--color-accent)] text-xs">✓</span>
                        ) : (
                          <span className="text-[var(--color-muted)] text-xs">—</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-hi)]/30">
                        <td colSpan={6} className="px-3 sm:px-5 py-4">
                          <SpeciesCatchInfo species={r.species} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-muted)] text-sm">
                    No pokemon match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
