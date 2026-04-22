import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/useData";
import { useDex } from "../data/useDex";
import { useOwned } from "../store/collection";
import { useWishlist } from "../store/wishlist";
import { speciesKey } from "../lib/species";
import { Card, CardBody } from "../components/Card";
import PokemonTable, { type PokemonTableRow } from "../components/PokemonTable";

type OwnFilter = "all" | "owned" | "unowned";
type SortKey = "rank" | "name" | "usage";

export default function Wishlist() {
  const status = useData();
  const owned = useOwned();
  const wishlist = useWishlist();
  const { lookup, ensureMany } = useDex();
  const [ownFilter, setOwnFilter] = useState<OwnFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [query, setQuery] = useState("");

  const ownedKeys = useMemo(
    () => new Set(owned.map((o) => speciesKey(o.species))),
    [owned],
  );

  const wishlistArr = useMemo(() => [...wishlist], [wishlist]);

  useEffect(() => {
    ensureMany(wishlistArr);
  }, [wishlistArr, ensureMany]);

  if (status.state === "loading") return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (status.state === "error") return <div className="text-red-400">{status.error.message}</div>;

  const { usage, sets } = status.data;
  const usageByName = new Map(usage.pokemon.map((u) => [u.species, u]));

  const rows: PokemonTableRow[] = wishlistArr
    .map((species): PokemonTableRow => {
      const entry = lookup(species);
      const set = sets.sets[species]?.[0];
      const usageEntry = usageByName.get(species);
      return {
        rank: usageEntry?.rank ?? 999,
        species,
        usage: usageEntry?.usage ?? 0,
        types: entry?.types ?? [],
        item: set?.item ?? "",
        ability: set?.ability ?? "",
        owned: ownedKeys.has(speciesKey(species)),
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

  if (wishlist.size === 0) {
    return (
      <Card>
        <CardBody>
          <div className="text-sm text-[var(--color-muted)]">
            Your wishlist is empty. Tap the star next to any pokemon on the Top
            Mons tab to add it here.
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline gap-2">
        <div className="text-sm font-semibold">Wishlist</div>
        <div className="text-xs text-[var(--color-muted)]">
          {wishlist.size} starred
        </div>
      </div>

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

      <PokemonTable
        rows={rows}
        emptyMessage="No pokemon in your wishlist match the current filters."
      />
    </div>
  );
}
