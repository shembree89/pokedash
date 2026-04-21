import { useEffect, useMemo, useState } from "react";
import type { OwnedPokemon } from "../data/types";
import { updateOwned } from "../store/collection";
import { useData } from "../data/useData";
import MonFormFields, { type MonFormDraft } from "./MonFormFields";

interface Props {
  mon: OwnedPokemon;
  onClose: () => void;
  onRemoveFromTeam: () => void;
  onAddToFirstEmpty: (id: string) => void;
}

function toDraft(mon: OwnedPokemon): MonFormDraft {
  return {
    nickname: mon.nickname,
    ability: mon.ability,
    item: mon.item,
    nature: mon.nature,
    moves: [...mon.moves],
    spSpread: { ...mon.spSpread },
    mega: mon.mega,
  };
}

export default function SlotEditor({ mon, onClose, onRemoveFromTeam }: Props) {
  const [draft, setDraft] = useState<MonFormDraft>(toDraft(mon));
  const status = useData();

  useEffect(() => { setDraft(toDraft(mon)); }, [mon]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dirty = useMemo(() => {
    return JSON.stringify({ ...toDraft(mon) }) !== JSON.stringify(draft);
  }, [mon, draft]);

  const sets = status.state === "ready" ? status.data.sets : null;
  const metaSet = sets?.sets[mon.species]?.[0];

  const metaDiff = useMemo(() => {
    if (!metaSet) return null;
    const diffs: string[] = [];
    if (metaSet.item && draft.item && metaSet.item.toLowerCase() !== draft.item.toLowerCase()) {
      diffs.push(`item: ${metaSet.item}`);
    }
    if (metaSet.ability && draft.ability && metaSet.ability.toLowerCase() !== draft.ability.toLowerCase()) {
      diffs.push(`ability: ${metaSet.ability}`);
    }
    if (metaSet.nature && metaSet.nature !== draft.nature) {
      diffs.push(`nature: ${metaSet.nature}`);
    }
    const metaMoves = new Set(metaSet.moves.map((m) => m.toLowerCase()));
    const ownMoves = new Set(draft.moves.filter(Boolean).map((m) => m.toLowerCase()));
    const missing = metaSet.moves.filter((m) => !ownMoves.has(m.toLowerCase()));
    const extra = draft.moves.filter((m) => m && !metaMoves.has(m.toLowerCase()));
    if (missing.length) diffs.push(`+${missing.join(", ")}`);
    if (extra.length) diffs.push(`−${extra.join(", ")}`);
    return { set: metaSet, diffs };
  }, [metaSet, draft]);

  const save = () => {
    updateOwned(mon.id, {
      nickname: draft.nickname || undefined,
      item: draft.item,
      ability: draft.ability,
      nature: draft.nature,
      moves: draft.moves,
      spSpread: draft.spSpread,
      mega: draft.mega,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto flex flex-col"
      >
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-3 sticky top-0 bg-[var(--color-surface)] z-10">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{mon.species}</div>
            <div className="text-xs text-[var(--color-muted)]">Editing owned pokemon</div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-lg px-2 min-h-11"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          <MonFormFields species={mon.species} draft={draft} onChange={setDraft} />

          {metaDiff && (
            <div className="mt-4 border border-[var(--color-border)] rounded p-3 bg-[var(--color-bg)]">
              <div className="text-xs text-[var(--color-muted)] mb-1">
                Meta diff vs "{metaDiff.set.name ?? "most common"}"
              </div>
              {metaDiff.diffs.length === 0 ? (
                <div className="text-xs text-[var(--color-accent)]">Matches meta set.</div>
              ) : (
                <div className="text-xs flex flex-wrap gap-1.5">
                  {metaDiff.diffs.map((d, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-[var(--color-surface-hi)] rounded">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surface)]">
          <button
            onClick={save}
            disabled={!dirty}
            className="flex-1 min-h-11 px-4 rounded bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="min-h-11 px-4 rounded border border-[var(--color-border)] text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onRemoveFromTeam}
            className="min-h-11 px-3 rounded border border-red-800/60 text-red-300 text-sm"
          >
            Remove from team
          </button>
        </div>
      </div>
    </div>
  );
}
