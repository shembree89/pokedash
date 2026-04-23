import { Fragment, useState, type DragEvent } from "react";
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
  teamOnly?: boolean;
  hint?: string;
}

interface Props {
  rows: PokemonTableRow[];
  emptyMessage?: string;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export default function PokemonTable({
  rows,
  emptyMessage = "No pokemon match your filters.",
  onReorder,
}: Props) {
  useWishlist();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const draggable = !!onReorder;

  const handleDragStart = (e: DragEvent<HTMLTableRowElement>, index: number) => {
    setDragIndex(index);
    setExpanded(null);
    e.dataTransfer.effectAllowed = "move";
    // Required for Firefox to start drag:
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: DragEvent<HTMLTableRowElement>, index: number) => {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropIndex !== index) setDropIndex(index);
  };

  const handleDrop = () => {
    if (dragIndex !== null && dropIndex !== null && onReorder) {
      onReorder(dragIndex, dropIndex);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const colCount = draggable ? 7 : 6;

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-hi)] text-[var(--color-muted)] text-xs uppercase tracking-wide">
            <tr>
              {draggable && <th className="w-8" aria-label="Reorder" />}
              <th className="text-left px-2 sm:px-3 py-2 w-10">#</th>
              <th className="text-left px-2 sm:px-3 py-2">Species</th>
              <th className="text-left px-2 sm:px-3 py-2 hidden md:table-cell">Types</th>
              <th className="text-right px-2 sm:px-3 py-2 w-16">Usage</th>
              <th className="text-left px-2 sm:px-3 py-2 hidden lg:table-cell">Common set</th>
              <th className="text-left px-2 sm:px-3 py-2 w-14">Own</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = expanded === r.species;
              const starred = isWishlisted(r.species);
              const isDragging = dragIndex === i;
              const isDropTarget = dropIndex === i && dragIndex !== null && dragIndex !== i;
              return (
                <Fragment key={r.species}>
                  <tr
                    draggable={draggable}
                    onDragStart={draggable ? (e) => handleDragStart(e, i) : undefined}
                    onDragOver={draggable ? (e) => handleDragOver(e, i) : undefined}
                    onDrop={draggable ? handleDrop : undefined}
                    onDragEnd={draggable ? handleDragEnd : undefined}
                    onClick={() => setExpanded(isOpen ? null : r.species)}
                    aria-expanded={isOpen}
                    className={`border-t border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-hi)]/50 ${
                      isOpen ? "bg-[var(--color-surface-hi)]/50" : ""
                    } ${isDragging ? "opacity-40" : ""} ${
                      isDropTarget ? "outline outline-2 outline-[var(--color-accent)]" : ""
                    }`}
                  >
                    {draggable && (
                      <td
                        className="px-1 py-2 text-center text-[var(--color-muted)] cursor-grab active:cursor-grabbing select-none"
                        aria-label="Drag to reorder"
                      >
                        ⋮⋮
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-2 text-[var(--color-muted)] text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`inline-block text-[var(--color-muted)] transition-transform ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        >
                          ›
                        </span>
                        {r.teamOnly ? "—" : r.rank}
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
                          className={`text-xl leading-none -m-1 min-h-11 min-w-11 flex items-center justify-center rounded hover:bg-[var(--color-surface-hi)] ${
                            starred
                              ? "text-[var(--color-accent)]"
                              : "text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                          }`}
                        >
                          {starred ? "★" : "☆"}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="font-medium">{r.species}</div>
                            {r.teamOnly && (
                              <span
                                className="px-1.5 py-0.5 text-[10px] uppercase tracking-wide rounded bg-[var(--color-surface-hi)] border border-[var(--color-border)] text-[var(--color-muted)]"
                                title="Appears on featured teams but not in top-50 usage"
                              >
                                team-only
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1 md:hidden">
                            {r.types.map((t) => <TypeBadge key={t} type={t} />)}
                          </div>
                          <div className="text-[11px] text-[var(--color-muted)] mt-0.5 lg:hidden">
                            {r.ability ? `${r.ability} · ${r.item}` : ""}
                          </div>
                          {r.hint && (
                            <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                              {r.hint}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 hidden md:table-cell">
                      <div className="flex gap-1">
                        {r.types.map((t) => <TypeBadge key={t} type={t} />)}
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right tabular-nums text-xs sm:text-sm">
                      {r.teamOnly ? (
                        <span className="text-[var(--color-muted)]">—</span>
                      ) : (
                        `${(r.usage * 100).toFixed(0)}%`
                      )}
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
                      <td colSpan={colCount} className="px-3 sm:px-5 py-4">
                        <SpeciesCatchInfo species={r.species} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-3 py-6 text-center text-[var(--color-muted)] text-sm">
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
