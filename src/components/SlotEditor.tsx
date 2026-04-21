import { useEffect, useMemo, useState } from "react";
import type { Nature, OwnedPokemon, StatKey } from "../data/types";
import { STAT_KEYS, STAT_LABEL } from "../data/types";
import { updateOwned } from "../store/collection";
import { useData } from "../data/useData";
import { SP_PER_STAT_MAX, SP_TOTAL_MAX, spTotal, validateSpread } from "../lib/sp-converter";
import TypeBadge from "../components/TypeBadge";

const NATURES: Nature[] = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

interface Props {
  mon: OwnedPokemon;
  onClose: () => void;
  onRemoveFromTeam: () => void;
  onAddToFirstEmpty: (id: string) => void;
}

export default function SlotEditor({ mon, onClose, onRemoveFromTeam }: Props) {
  const [draft, setDraft] = useState<OwnedPokemon>(mon);
  const status = useData();

  useEffect(() => { setDraft(mon); }, [mon]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const spValidation = validateSpread(draft.spSpread);
  const dirty = JSON.stringify(draft) !== JSON.stringify(mon);

  const pokedex = status.state === "ready" ? status.data.pokedex : null;
  const sets = status.state === "ready" ? status.data.sets : null;
  const entry = pokedex?.pokemon[mon.species];
  const metaSet = sets?.sets[mon.species]?.[0];
  const megaCapable = (entry?.megas?.length ?? 0) > 0;

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

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto flex flex-col"
      >
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-3 sticky top-0 bg-[var(--color-surface)]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold truncate">{mon.species}</div>
              {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
            </div>
            <div className="text-xs text-[var(--color-muted)]">Editing owned pokemon</div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-lg px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          <Field label="Nickname">
            <input
              value={draft.nickname ?? ""}
              onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
              className="edit-input"
              placeholder="(optional)"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Item">
              <input
                value={draft.item}
                onChange={(e) => setDraft({ ...draft, item: e.target.value })}
                className="edit-input"
                list="meta-items"
              />
            </Field>
            <Field label="Ability">
              <select
                value={draft.ability}
                onChange={(e) => setDraft({ ...draft, ability: e.target.value })}
                className="edit-input"
              >
                <option value="">—</option>
                {entry?.abilities.map((a) => <option key={a} value={a}>{a}</option>)}
                {entry?.megas?.map((m) => (
                  <option key={m.ability} value={m.ability}>{m.ability} (mega)</option>
                ))}
                {draft.ability &&
                  !entry?.abilities.includes(draft.ability) &&
                  !entry?.megas?.some((m) => m.ability === draft.ability) && (
                    <option value={draft.ability}>{draft.ability}</option>
                  )}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nature">
              <select
                value={draft.nature}
                onChange={(e) => setDraft({ ...draft, nature: e.target.value as Nature })}
                className="edit-input"
              >
                {NATURES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Mega">
              <label className="flex items-center gap-2 h-9">
                <input
                  type="checkbox"
                  disabled={!megaCapable}
                  checked={!!draft.mega}
                  onChange={(e) => setDraft({ ...draft, mega: e.target.checked })}
                  className="w-5 h-5 accent-[var(--color-accent)]"
                />
                <span className="text-sm">
                  {megaCapable ? "Uses mega" : "No mega form"}
                </span>
              </label>
            </Field>
          </div>

          <Field label="Moves">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  value={draft.moves[i] ?? ""}
                  onChange={(e) => {
                    const m = [...draft.moves];
                    m[i] = e.target.value;
                    setDraft({ ...draft, moves: m });
                  }}
                  className="edit-input"
                  placeholder={`Move ${i + 1}`}
                />
              ))}
            </div>
          </Field>

          <Field label={`SP spread — total ${spTotal(draft.spSpread)}/${SP_TOTAL_MAX}`}>
            <div className="flex flex-col gap-1.5">
              {STAT_KEYS.map((k) => (
                <SpRow
                  key={k}
                  label={STAT_LABEL[k]}
                  value={draft.spSpread[k]}
                  max={SP_PER_STAT_MAX}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      spSpread: { ...draft.spSpread, [k]: v } as typeof draft.spSpread,
                    })
                  }
                />
              ))}
            </div>
            {!spValidation.ok && (
              <div className="text-xs text-red-400 mt-2">
                {spValidation.overTotal && <div>Total exceeds {SP_TOTAL_MAX}.</div>}
                {spValidation.overPerStat.length > 0 && (
                  <div>
                    {spValidation.overPerStat.map((k) => STAT_LABEL[k as StatKey]).join(", ")}{" "}
                    over {SP_PER_STAT_MAX}.
                  </div>
                )}
              </div>
            )}
          </Field>

          {metaDiff && (
            <div className="border border-[var(--color-border)] rounded p-3 bg-[var(--color-bg)]">
              <div className="text-xs text-[var(--color-muted)] mb-1">
                Meta diff vs "{metaDiff.set.name ?? "most common"}"
              </div>
              {metaDiff.diffs.length === 0 ? (
                <div className="text-xs text-[var(--color-accent)]">Matches meta set.</div>
              ) : (
                <div className="text-xs flex flex-wrap gap-1.5">
                  {metaDiff.diffs.map((d, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.5 bg-[var(--color-surface-hi)] rounded"
                    >
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function SpRow({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs text-[var(--color-muted)]">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1 accent-[var(--color-accent)]"
      />
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(Number.isNaN(v) ? 0 : Math.max(0, Math.min(max, v)));
        }}
        className="w-14 edit-input text-right tabular-nums"
      />
    </div>
  );
}
