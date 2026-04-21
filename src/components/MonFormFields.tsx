import { useEffect, useMemo } from "react";
import type { Nature, OwnedPokemon, StatKey } from "../data/types";
import { STAT_KEYS, STAT_LABEL } from "../data/types";
import { useDex } from "../data/useDex";
import { useAutocomplete } from "../data/autocomplete";
import { SP_PER_STAT_MAX, SP_TOTAL_MAX, spTotal, validateSpread } from "../lib/sp-converter";
import { NATURE_MODS, calcAllStats, natureMultiplier } from "../lib/stats";
import TypeBadge from "./TypeBadge";

const NATURES: Nature[] = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty",
  "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive",
  "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

const STAT_SHORT: Record<StatKey, string> = {
  hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe",
};

function natureLabel(n: Nature): string {
  const mod = NATURE_MODS[n];
  if (!mod.plus || !mod.minus) return `${n} (neutral)`;
  return `${n} (+${STAT_SHORT[mod.plus]}, −${STAT_SHORT[mod.minus]})`;
}

export interface MonFormDraft {
  nickname?: string;
  ability: string;
  item: string;
  nature: Nature;
  moves: string[];
  spSpread: OwnedPokemon["spSpread"];
  mega?: boolean;
}

interface Props {
  species: string;
  draft: MonFormDraft;
  onChange: (next: MonFormDraft) => void;
  showNickname?: boolean;
}

export default function MonFormFields({ species, draft, onChange, showNickname = true }: Props) {
  const { lookup, ensure } = useDex();
  useEffect(() => { ensure(species); }, [species, ensure]);
  const entry = lookup(species);
  const auto = useAutocomplete();

  const activeMega = draft.mega
    ? entry?.megas?.find((m) => m.requiredItem.toLowerCase() === draft.item.toLowerCase())
        ?? entry?.megas?.[0]
    : undefined;
  const baseStats = activeMega?.baseStats ?? entry?.baseStats;
  const liveStats = baseStats ? calcAllStats(baseStats, draft.spSpread, draft.nature) : null;
  const megaCapable = (entry?.megas?.length ?? 0) > 0;

  const spValidation = validateSpread(draft.spSpread);

  const abilityOptions = useMemo(() => {
    const opts: string[] = [];
    if (entry) {
      for (const a of entry.abilities) opts.push(a);
      for (const m of entry.megas ?? []) if (!opts.includes(m.ability)) opts.push(m.ability);
    }
    if (draft.ability && !opts.includes(draft.ability)) opts.push(draft.ability);
    return opts;
  }, [entry, draft.ability]);

  const patch = (p: Partial<MonFormDraft>) => onChange({ ...draft, ...p });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
        {megaCapable && (
          <label className="ml-auto flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <input
              type="checkbox"
              checked={!!draft.mega}
              onChange={(e) => patch({ mega: e.target.checked })}
              className="w-5 h-5 accent-[var(--color-accent)]"
            />
            uses mega
          </label>
        )}
      </div>

      {showNickname && (
        <Field label="Nickname">
          <input
            value={draft.nickname ?? ""}
            onChange={(e) => patch({ nickname: e.target.value })}
            className="edit-input"
            placeholder="(optional)"
          />
        </Field>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Ability">
          <select
            value={draft.ability}
            onChange={(e) => patch({ ability: e.target.value })}
            className="edit-input"
          >
            <option value="">—</option>
            {abilityOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Item">
          <input
            value={draft.item}
            onChange={(e) => patch({ item: e.target.value })}
            className="edit-input"
            list="pokedash-items"
            autoComplete="off"
          />
          <datalist id="pokedash-items">
            {auto.items.map((i) => <option key={i} value={i} />)}
          </datalist>
        </Field>
      </div>

      <Field label="Nature">
        <select
          value={draft.nature}
          onChange={(e) => patch({ nature: e.target.value as Nature })}
          className="edit-input"
        >
          {NATURES.map((n) => <option key={n} value={n}>{natureLabel(n)}</option>)}
        </select>
      </Field>

      <Field label="Moves">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              value={draft.moves[i] ?? ""}
              onChange={(e) => {
                const m = [...draft.moves];
                m[i] = e.target.value;
                patch({ moves: m });
              }}
              className="edit-input"
              placeholder={`Move ${i + 1}`}
              list="pokedash-moves"
              autoComplete="off"
            />
          ))}
        </div>
        <datalist id="pokedash-moves">
          {auto.moves.map((m) => <option key={m} value={m} />)}
        </datalist>
      </Field>

      <Field
        label={`SP spread — total ${spTotal(draft.spSpread)}/${SP_TOTAL_MAX}${
          activeMega ? " (mega stats)" : ""
        }`}
      >
        <div className="flex flex-col gap-1.5">
          {STAT_KEYS.map((k) => {
            const nMult = natureMultiplier(draft.nature, k);
            return (
              <SpRow
                key={k}
                statKey={k}
                label={STAT_LABEL[k]}
                value={draft.spSpread[k]}
                max={SP_PER_STAT_MAX}
                base={baseStats?.[k] ?? 0}
                finalStat={liveStats?.[k]}
                natureMult={nMult}
                onChange={(v) =>
                  patch({
                    spSpread: { ...draft.spSpread, [k]: v } as OwnedPokemon["spSpread"],
                  })
                }
              />
            );
          })}
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
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wide text-[var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}

function SpRow({
  statKey,
  label,
  value,
  max,
  base,
  finalStat,
  natureMult,
  onChange,
}: {
  statKey: StatKey;
  label: string;
  value: number;
  max: number;
  base: number;
  finalStat: number | undefined;
  natureMult: number;
  onChange: (v: number) => void;
}) {
  const tag =
    natureMult > 1 ? <span className="text-emerald-400 ml-0.5">+</span>
    : natureMult < 1 ? <span className="text-red-400 ml-0.5">−</span>
    : null;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-xs text-[var(--color-muted)] shrink-0 flex items-center">
        {label}{tag}
      </span>
      <span className="w-10 text-right text-[10px] text-[var(--color-muted)] shrink-0 tabular-nums">
        b{base}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="flex-1 accent-[var(--color-accent)] min-w-0"
        aria-label={`${label} SP`}
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
        className="w-12 edit-input text-right tabular-nums shrink-0"
        aria-label={`${label} SP number`}
      />
      <span
        className={`w-10 text-right text-xs tabular-nums shrink-0 font-medium ${
          natureMult > 1 ? "text-emerald-300" : natureMult < 1 ? "text-red-300" : ""
        }`}
        title={`Final ${statKey.toUpperCase()} at level 50`}
      >
        {finalStat ?? "—"}
      </span>
    </div>
  );
}
