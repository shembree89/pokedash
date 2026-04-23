import { useState } from "react";
import type { MetaTeamMember, Nature, SpSpread, StatKey } from "../data/types";
import { STAT_KEYS, STAT_LABEL } from "../data/types";
import { useDex } from "../data/useDex";
import { calcAllStats } from "../lib/stats";
import { emptySpread } from "../lib/sp-converter";
import { ROLE_LABEL, inferSpread, roleBaseStats } from "../lib/role";
import TypeBadge from "./TypeBadge";
import SpeciesCatchInfo from "./SpeciesCatchInfo";
import type { MonFormDraft } from "./MonFormFields";

function mergeSpread(partial: Partial<SpSpread> | undefined): SpSpread {
  const out = emptySpread();
  if (!partial) return out;
  for (const k of STAT_KEYS) out[k] = partial[k] ?? 0;
  return out;
}

export default function TeamMemberDetail({
  member,
  teamMoves,
}: {
  member: MetaTeamMember;
  teamMoves?: string[];
}) {
  const { lookup } = useDex();
  const [catchOpen, setCatchOpen] = useState(false);

  const entry = lookup(member.species);
  const moves = (member.moves ?? []).filter(Boolean);
  const metaBits = [
    member.ability,
    member.item,
    member.nature,
    member.mega ? "Mega" : undefined,
  ].filter(Boolean);

  const baseStats = entry ? roleBaseStats(entry, member) : undefined;

  const hasRealSpread = !!(member.spSpread && member.nature);
  const inferred = entry && !hasRealSpread ? inferSpread(member, entry, teamMoves) : null;

  const effectiveSpread: SpSpread | null = hasRealSpread
    ? mergeSpread(member.spSpread)
    : inferred?.spread ?? null;
  const effectiveNature: Nature | null = hasRealSpread
    ? (member.nature as Nature)
    : inferred?.nature ?? null;

  const calcStats =
    baseStats && effectiveSpread && effectiveNature
      ? calcAllStats(baseStats, effectiveSpread, effectiveNature)
      : null;

  const statsLabel = hasRealSpread
    ? `Lvl 50 · ${effectiveNature}`
    : inferred
      ? `Lvl 50 · inferred ${ROLE_LABEL[inferred.role]} · ${inferred.nature}`
      : "Lvl 50";

  const prefill: MonFormDraft = {
    nickname: "",
    ability: member.ability ?? "",
    item: member.item ?? "",
    nature: effectiveNature ?? "Hardy",
    moves: [0, 1, 2, 3].map((i) => member.moves?.[i] ?? ""),
    spSpread: effectiveSpread ?? emptySpread(),
    mega: member.mega,
  };

  return (
    <div className="flex flex-col gap-2 py-2 border-t border-[var(--color-border)] first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-sm">{member.species}</span>
        <div className="flex gap-1">
          {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
        </div>
      </div>

      {metaBits.length > 0 && (
        <div className="text-xs text-[var(--color-muted)]">
          {metaBits.join(" · ")}
        </div>
      )}

      {moves.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {moves.map((m, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 text-[11px] rounded bg-[var(--color-surface-hi)] border border-[var(--color-border)]"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      {baseStats && (
        <StatsRow
          label={member.mega ? "Base (mega)" : "Base"}
          stats={baseStats}
        />
      )}
      {calcStats && (
        <StatsRow label={statsLabel} stats={calcStats} accent />
      )}

      {metaBits.length === 0 && moves.length === 0 && !baseStats && (
        <div className="text-[11px] text-[var(--color-muted)] italic">
          No set data captured for this slot.
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setCatchOpen((v) => !v);
        }}
        className="self-start text-[11px] uppercase tracking-wide text-[var(--color-muted)] hover:text-[var(--color-fg)] min-h-8 px-2 -ml-2 rounded"
      >
        {catchOpen ? "▾ Hide catch info" : "▸ Catch info"}
      </button>

      {catchOpen && (
        <div className="pl-2 border-l-2 border-[var(--color-border)]">
          <SpeciesCatchInfo species={member.species} prefill={prefill} />
        </div>
      )}
    </div>
  );
}

function StatsRow({
  label,
  stats,
  accent,
}: {
  label: string;
  stats: Record<StatKey, number>;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
      <span className="uppercase tracking-wide text-[var(--color-muted)] shrink-0">
        {label}
      </span>
      {STAT_KEYS.map((k) => (
        <span key={k} className="tabular-nums">
          <span className="text-[var(--color-muted)]">{STAT_LABEL[k]}</span>{" "}
          <span className={accent ? "text-[var(--color-fg)] font-medium" : ""}>
            {stats[k]}
          </span>
        </span>
      ))}
    </div>
  );
}
