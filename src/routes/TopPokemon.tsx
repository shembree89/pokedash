import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/useData";
import { useDex } from "../data/useDex";
import { useOwned } from "../store/collection";
import { speciesKey } from "../lib/species";
import { Card, CardBody, CardHeader } from "../components/Card";
import PokemonTable, { type PokemonTableRow } from "../components/PokemonTable";

type OwnFilter = "all" | "owned" | "unowned";
type SortKey = "rank" | "name" | "usage";

export default function TopPokemon() {
  const status = useData();
  const owned = useOwned();
  const { lookup, ensureMany } = useDex();
  const [ownFilter, setOwnFilter] = useState<OwnFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [query, setQuery] = useState("");

  const ownedKeys = useMemo(
    () => new Set(owned.map((o) => speciesKey(o.species))),
    [owned],
  );

  const teamOnlySpecies = useMemo(() => {
    if (status.state !== "ready") return [] as string[];
    const usageKeys = new Set(
      status.data.usage.pokemon.map((u) => speciesKey(u.species)),
    );
    const canonical = new Map<string, string>();
    for (const team of status.data.teams.teams) {
      for (const m of team.pokemon) {
        const key = speciesKey(m.species);
        if (usageKeys.has(key)) continue;
        if (!canonical.has(key)) canonical.set(key, m.species);
      }
    }
    return [...canonical.values()].sort();
  }, [status]);

  const speciesList = useMemo(
    () =>
      status.state === "ready"
        ? [
            ...status.data.usage.pokemon.map((u) => u.species),
            ...teamOnlySpecies,
          ]
        : [],
    [status, teamOnlySpecies],
  );

  useEffect(() => {
    ensureMany(speciesList);
  }, [speciesList, ensureMany]);

  if (status.state === "loading") return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (status.state === "error") return <div className="text-red-400">{status.error.message}</div>;

  const { usage, sets } = status.data;

  const usageRows: PokemonTableRow[] = usage.pokemon.map((u) => {
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
  });

  const teamOnlyRows: PokemonTableRow[] = teamOnlySpecies.map((species) => {
    const entry = lookup(species);
    return {
      rank: Number.MAX_SAFE_INTEGER,
      species,
      usage: 0,
      types: entry?.types ?? [],
      item: "",
      ability: "",
      owned: ownedKeys.has(speciesKey(species)),
      teamOnly: true,
    };
  });

  const rows: PokemonTableRow[] = [...usageRows, ...teamOnlyRows]
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

      <PokemonTable rows={rows} />
    </div>
  );
}
