import { useState } from "react";
import type { MetaTeamMember } from "../data/types";
import { useDex } from "../data/useDex";
import TypeBadge from "./TypeBadge";
import SpeciesCatchInfo from "./SpeciesCatchInfo";

export default function TeamMemberDetail({ member }: { member: MetaTeamMember }) {
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

      {metaBits.length === 0 && moves.length === 0 && (
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
          <SpeciesCatchInfo species={member.species} />
        </div>
      )}
    </div>
  );
}
