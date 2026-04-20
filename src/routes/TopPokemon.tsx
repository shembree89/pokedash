import { useMemo, useState } from "react";
import { useData } from "../data/useData";
import { useOwned } from "../store/collection";
import { speciesKey } from "../lib/species";
import TypeBadge from "../components/TypeBadge";
import { Card, CardBody, CardHeader } from "../components/Card";

type OwnFilter = "all" | "owned" | "unowned";
type SortKey = "rank" | "name" | "usage";

export default function TopPokemon() {
  const status = useData();
  const owned = useOwned();
  const [ownFilter, setOwnFilter] = useState<OwnFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [query, setQuery] = useState("");

  const ownedKeys = useMemo(
    () => new Set(owned.map((o) => speciesKey(o.species))),
    [owned],
  );

  if (status.state === "loading") return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (status.state === "error") return <div className="text-red-400">{status.error.message}</div>;

  const { pokedex, usage, sets } = status.data;

  const rows = usage.pokemon
    .map((u) => {
      const entry = pokedex.pokemon[u.species];
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

      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search species…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <div className="flex gap-1">
          {(["all", "owned", "unowned"] as OwnFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setOwnFilter(f)}
              className={`px-2.5 py-1 rounded text-xs capitalize ${
                ownFilter === f
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium"
                  : "bg-[var(--color-surface-hi)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 text-xs">
          <span className="text-[var(--color-muted)] self-center mr-1">Sort</span>
          {(["rank", "name", "usage"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className={`px-2 py-1 rounded capitalize ${
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
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-hi)] text-[var(--color-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 w-12">#</th>
              <th className="text-left px-3 py-2">Species</th>
              <th className="text-left px-3 py-2">Types</th>
              <th className="text-right px-3 py-2 w-20">Usage</th>
              <th className="text-left px-3 py-2">Common set</th>
              <th className="text-left px-3 py-2 w-20">Owned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.species}
                className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hi)]/50"
              >
                <td className="px-3 py-2 text-[var(--color-muted)]">{r.rank}</td>
                <td className="px-3 py-2 font-medium">{r.species}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {r.types.map((t) => <TypeBadge key={t} type={t} />)}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {(r.usage * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-muted)]">
                  {r.ability ? `${r.ability} · ${r.item}` : "—"}
                </td>
                <td className="px-3 py-2">
                  {r.owned ? (
                    <span className="text-[var(--color-accent)] text-xs">✓ owned</span>
                  ) : (
                    <span className="text-[var(--color-muted)] text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-muted)] text-sm">
                  No pokemon match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
