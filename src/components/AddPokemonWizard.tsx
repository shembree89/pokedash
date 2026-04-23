import { useEffect, useMemo, useRef, useState } from "react";
import { addOwned } from "../store/collection";
import { useDex } from "../data/useDex";
import { useAutocomplete } from "../data/autocomplete";
import { emptySpread } from "../lib/sp-converter";
import MonFormFields, { type MonFormDraft } from "./MonFormFields";
import TypeBadge from "./TypeBadge";

interface Props {
  onClose: () => void;
  initialSpecies?: string;
  initialDraft?: MonFormDraft;
}

function emptyDraft(): MonFormDraft {
  return {
    nickname: "",
    ability: "",
    item: "",
    nature: "Hardy",
    moves: ["", "", "", ""],
    spSpread: emptySpread(),
  };
}

export default function AddPokemonWizard({ onClose, initialSpecies, initialDraft }: Props) {
  const [species, setSpecies] = useState<string>(initialSpecies ?? "");
  const [typed, setTyped] = useState<string>("");
  const [draft, setDraft] = useState<MonFormDraft>(() => initialDraft ?? emptyDraft());
  const inputRef = useRef<HTMLInputElement>(null);
  const { lookup, ensure } = useDex();
  const auto = useAutocomplete();

  useEffect(() => {
    if (initialSpecies) {
      ensure(initialSpecies);
      if (!initialDraft) {
        const entry = lookup(initialSpecies);
        setDraft((d) => ({ ...d, ability: entry?.abilities[0] ?? d.ability }));
      }
    }
    // Intentionally only on mount to prefill once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!species) inputRef.current?.focus();
  }, [species]);

  const matches = useMemo(() => {
    const q = typed.trim().toLowerCase();
    if (!q) return auto.species.slice(0, 12);
    return auto.species.filter((s) => s.toLowerCase().includes(q)).slice(0, 20);
  }, [typed, auto.species]);

  const pickSpecies = (name: string) => {
    setSpecies(name);
    ensure(name);
    const entry = lookup(name);
    setDraft({
      ...emptyDraft(),
      ability: entry?.abilities[0] ?? "",
    });
  };

  const add = () => {
    if (!species) return;
    addOwned({
      species,
      nickname: draft.nickname || undefined,
      ability: draft.ability,
      item: draft.item,
      nature: draft.nature,
      moves: draft.moves,
      spSpread: draft.spSpread,
      mega: draft.mega,
    });
    onClose();
  };

  const entry = lookup(species);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-xl sm:rounded-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto flex flex-col"
      >
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center gap-3 sticky top-0 bg-[var(--color-surface)] z-10">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">
              {species ? species : "Add pokemon"}
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              {species ? "Fill in the set, then save." : "Choose a species to start."}
            </div>
          </div>
          {species && (
            <button
              onClick={() => { setSpecies(""); setTyped(""); setDraft(emptyDraft()); }}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] min-h-11 px-2"
            >
              change
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-lg px-2 min-h-11"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {!species ? (
          <div className="p-4 flex flex-col gap-3">
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && matches[0]) pickSpecies(matches[0]);
              }}
              className="edit-input"
              placeholder="Search species…"
              autoFocus
              autoComplete="off"
            />
            <div className="text-[11px] text-[var(--color-muted)] uppercase tracking-wide">
              {typed ? `${matches.length} matches` : "Top entries"}
            </div>
            <ul className="flex flex-col gap-1 max-h-[48vh] overflow-y-auto">
              {matches.map((s) => (
                <li key={s}>
                  <SpeciesRow name={s} onPick={() => pickSpecies(s)} />
                </li>
              ))}
              {typed && !matches.some((s) => s.toLowerCase() === typed.trim().toLowerCase()) && (
                <li>
                  <button
                    onClick={() => pickSpecies(typed.trim())}
                    className="w-full text-left px-3 py-2 rounded bg-[var(--color-surface-hi)]/50 hover:bg-[var(--color-surface-hi)] text-sm border border-dashed border-[var(--color-border)]"
                  >
                    Use "{typed.trim()}" — I'll fetch data on save
                  </button>
                </li>
              )}
              {matches.length === 0 && !typed && (
                <li className="text-xs text-[var(--color-muted)]">No species loaded yet.</li>
              )}
            </ul>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-sm font-medium">{species}</span>
              {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
            </div>
            <MonFormFields species={species} draft={draft} onChange={setDraft} />
          </div>
        )}

        {species && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex flex-wrap gap-2 sticky bottom-0 bg-[var(--color-surface)]">
            <button
              onClick={add}
              className="flex-1 min-h-11 px-4 rounded bg-[var(--color-accent)] text-[var(--color-accent-ink)] font-medium"
            >
              Add to collection
            </button>
            <button
              onClick={onClose}
              className="min-h-11 px-4 rounded border border-[var(--color-border)] text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SpeciesRow({ name, onPick }: { name: string; onPick: () => void }) {
  const { lookup } = useDex();
  const entry = lookup(name);
  return (
    <button
      onClick={onPick}
      className="w-full text-left px-3 py-2 rounded hover:bg-[var(--color-surface-hi)]/50 flex items-center gap-2 min-h-11"
    >
      <span className="text-sm font-medium flex-1">{name}</span>
      <div className="flex gap-1">
        {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
      </div>
    </button>
  );
}
