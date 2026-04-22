import { Fragment, useState } from "react";
import type { PokemonType } from "../data/types";
import { isWishlisted, toggleWishlist, useWishlist } from "../store/wishlist";
import TypeBadge from "./TypeBadge";
import { Card } from "./Card";
import SpeciesCatchInfo from "./SpeciesCatchInfo";

export interface PokemonTableRow {
  rank: number;
  species: string;
  usage: number;
  types: PokemonType[];
  item: string;
  ability: string;
  owned: boolean;
}

export default function PokemonTable({
  rows,
  emptyMessage = "No pokemon match your filters.",
}: {
  rows: PokemonTableRow[];
  emptyMessage?: string;
}) {
  useWishlist(); // subscribe so stars re-render on toggle
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
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
              const starred = isWishlisted(r.species);
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={starred ? `Remove ${r.species} from wishlist` : `Add ${r.species} to wishlist`}
                          aria-pressed={starred}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(r.species);
                          }}
                          className={`text-base leading-none px-1 -mx-1 min-h-8 min-w-8 flex items-center justify-center rounded hover:bg-[var(--color-surface-hi)] ${
                            starred
                              ? "text-[var(--color-accent)]"
                              : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                          }`}
                        >
                          {starred ? "★" : "☆"}
                        </button>
                        <div className="min-w-0">
                          <div className="font-medium">{r.species}</div>
                          <div className="flex gap-1 mt-1 md:hidden">
                            {r.types.map((t) => <TypeBadge key={t} type={t} />)}
                          </div>
                          <div className="text-[11px] text-[var(--color-muted)] mt-0.5 lg:hidden">
                            {r.ability ? `${r.ability} · ${r.item}` : ""}
                          </div>
                        </div>
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
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
