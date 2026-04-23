import { useEffect, useMemo, useState } from "react";
import { useData } from "../data/useData";
import { useDex } from "../data/useDex";
import { useOwned } from "../store/collection";
import {
  replaceWishlist,
  reorderWishlist,
  useWishlist,
} from "../store/wishlist";
import { speciesKey } from "../lib/species";
import { Card, CardBody } from "../components/Card";
import PokemonTable, { type PokemonTableRow } from "../components/PokemonTable";
import {
  GAMES,
  progressionDetailForSpecies,
  type Game,
} from "../data/game-progression";

type OwnFilter = "all" | "owned" | "unowned";
type SortKey = "order" | "rank" | "name" | "usage" | "progression";

export default function Wishlist() {
  const status = useData();
  const owned = useOwned();
  const wishlist = useWishlist();
  const { lookup, ensureMany } = useDex();
  const [ownFilter, setOwnFilter] = useState<OwnFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [game, setGame] = useState<Game | "">("");
  const [query, setQuery] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [showImport, setShowImport] = useState(false);

  const ownedKeys = useMemo(
    () => new Set(owned.map((o) => speciesKey(o.species))),
    [owned],
  );

  const wishlistArr = useMemo(() => [...wishlist], [wishlist]);

  useEffect(() => {
    ensureMany(wishlistArr);
  }, [wishlistArr, ensureMany]);

  const handleExport = async () => {
    const json = JSON.stringify(wishlistArr, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2000);
  };

  const handleImport = () => {
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch (e) {
      setImportError("Invalid JSON: " + (e as Error).message);
      return;
    }
    if (!Array.isArray(parsed) || !parsed.every((s) => typeof s === "string")) {
      setImportError("Expected an array of species names.");
      return;
    }
    replaceWishlist(parsed as string[]);
    setImportText("");
    setShowImport(false);
  };

  if (status.state === "loading") return <div className="text-[var(--color-muted)]">Loading…</div>;
  if (status.state === "error") return <div className="text-red-400">{status.error.message}</div>;

  const { usage, sets, locations } = status.data;
  const usageByName = new Map(usage.pokemon.map((u) => [u.species, u]));

  type Row = PokemonTableRow & { wishlistIndex: number; stage: number };
  const rows: Row[] = wishlistArr
    .map((species, i): Row => {
      const entry = lookup(species);
      const set = sets.sets[species]?.[0];
      const usageEntry = usageByName.get(species);
      const detail = game
        ? progressionDetailForSpecies(species, game, locations)
        : null;
      const hint = detail
        ? detail.availableInGame
          ? `${detail.earliestLocation ?? "?"}`
          : "Not available in this game"
        : undefined;
      return {
        rank: usageEntry?.rank ?? 999,
        species,
        usage: usageEntry?.usage ?? 0,
        types: entry?.types ?? [],
        item: set?.item ?? "",
        ability: set?.ability ?? "",
        owned: ownedKeys.has(speciesKey(species)),
        wishlistIndex: i,
        stage: detail?.stage ?? Infinity,
        hint,
      };
    })
    .filter((r) => {
      if (ownFilter === "owned" && !r.owned) return false;
      if (ownFilter === "unowned" && r.owned) return false;
      if (query && !r.species.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === "progression" && game) {
        if (a.stage !== b.stage) return a.stage - b.stage;
        return a.species.localeCompare(b.species);
      }
      if (sortKey === "order") return a.wishlistIndex - b.wishlistIndex;
      if (sortKey === "rank") return a.rank - b.rank;
      if (sortKey === "usage") return b.usage - a.usage;
      return a.species.localeCompare(b.species);
    });

  // Drag reorder is only safe when we show every wishlist entry in its
  // natural order — any filter or alternate sort would make row indices
  // diverge from wishlist indices.
  const canReorder =
    sortKey === "order" && ownFilter === "all" && query === "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-sm font-semibold">Wishlist</div>
        <div className="text-xs text-[var(--color-muted)]">
          {wishlist.length} starred
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={wishlist.length === 0}
            className="px-3 min-h-9 rounded text-xs bg-[var(--color-surface-hi)] border border-[var(--color-border)] hover:text-[var(--color-fg)] text-[var(--color-muted)] disabled:opacity-40"
          >
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
                ? "Copy failed"
                : "Export"}
          </button>
          <button
            onClick={() => {
              setShowImport((v) => !v);
              setImportError(null);
            }}
            className="px-3 min-h-9 rounded text-xs bg-[var(--color-surface-hi)] border border-[var(--color-border)] hover:text-[var(--color-fg)] text-[var(--color-muted)]"
          >
            {showImport ? "Cancel import" : "Import"}
          </button>
        </div>
      </div>

      {showImport && (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <label className="text-xs text-[var(--color-muted)]">
              Paste a wishlist JSON (an array of species names) — this replaces
              your current wishlist.
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              placeholder='["Incineroar", "Sneasler", "Kingambit"]'
              className="w-full px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-mono focus:outline-none focus:border-[var(--color-accent)]"
            />
            {importError && (
              <div className="text-xs text-red-400">{importError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="px-3 min-h-9 rounded text-xs bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium disabled:opacity-40"
              >
                Replace wishlist
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {wishlist.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-sm text-[var(--color-muted)]">
              Your wishlist is empty. Tap the star next to any pokemon on the
              Top Mons tab to add it here.
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
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
            <div className="sm:ml-auto flex items-center gap-1 text-xs flex-wrap">
              <span className="text-[var(--color-muted)] mr-1">Sort</span>
              {(["order", "rank", "name", "usage", "progression"] as SortKey[]).map((k) => {
                const disabled = k === "progression" && !game;
                return (
                  <button
                    key={k}
                    onClick={() => !disabled && setSortKey(k)}
                    disabled={disabled}
                    title={disabled ? "Choose a game first" : undefined}
                    className={`px-3 min-h-10 rounded capitalize flex items-center ${
                      sortKey === k
                        ? "bg-[var(--color-surface-hi)] text-[var(--color-fg)]"
                        : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {k === "order" ? "My order" : k === "progression" ? "By game" : k}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[var(--color-muted)]">Playing</span>
            <select
              value={game}
              onChange={(e) => {
                const next = e.target.value as Game | "";
                setGame(next);
                if (next && sortKey !== "progression") setSortKey("progression");
                if (!next && sortKey === "progression") setSortKey("order");
              }}
              className="px-2 min-h-9 rounded bg-[var(--color-surface)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              <option value="">—</option>
              {GAMES.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            {game && (
              <span className="text-[var(--color-muted)]">
                orders wishlist by playthrough progression · species not in this game sink to bottom
              </span>
            )}
          </div>

          {!canReorder && sortKey === "order" && (
            <div className="text-[11px] text-[var(--color-muted)]">
              Drag handles are hidden while filters or search are active —
              clear them to reorder.
            </div>
          )}

          <PokemonTable
            rows={rows}
            emptyMessage="No pokemon in your wishlist match the current filters."
            onReorder={canReorder ? reorderWishlist : undefined}
          />
        </>
      )}
    </div>
  );
}
