import { useMemo, useState } from "react";
import type { PokemonType } from "../data/types";
import { ALL_TYPES } from "../lib/type-chart";
import {
  defensiveCoverage,
  offensiveCoverage,
  threatScores,
  type EffectiveMon,
} from "../lib/threat";
import { useData } from "../data/useData";
import { Card, CardBody } from "../components/Card";
import TypeBadge from "../components/TypeBadge";

export default function AnalysisPanels({ team }: { team: EffectiveMon[] }) {
  const [open, setOpen] = useState<string>("threats");

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Threats" id="threats" open={open} setOpen={setOpen}>
        <ThreatTable team={team} />
      </Panel>
      <Panel title="Offensive coverage" id="off" open={open} setOpen={setOpen}>
        <OffensiveGrid team={team} />
      </Panel>
      <Panel title="Defensive coverage" id="def" open={open} setOpen={setOpen}>
        <DefensiveGrid team={team} />
      </Panel>
      <Panel title="Speed tiers" id="spd" open={open} setOpen={setOpen}>
        <SpeedTiers team={team} />
      </Panel>
    </div>
  );
}

function Panel({
  title, id, open, setOpen, children,
}: {
  title: string;
  id: string;
  open: string;
  setOpen: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = open === id;
  return (
    <Card>
      <button
        onClick={() => setOpen(isOpen ? "" : id)}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[var(--color-surface-hi)]/40"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[var(--color-muted)]">{isOpen ? "▾" : "▸"}</span>
      </button>
      {isOpen && <div className="border-t border-[var(--color-border)]"><CardBody>{children}</CardBody></div>}
    </Card>
  );
}

function OffensiveGrid({ team }: { team: EffectiveMon[] }) {
  const cov = useMemo(() => offensiveCoverage(team), [team]);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-[var(--color-muted)]">
        For each defender type, the number of team members with a STAB move that hits it super-effectively (based on the mon's own types).
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {ALL_TYPES.map((t) => {
          const n = cov.byType[t];
          const bg = n === 0
            ? "bg-red-900/30 text-red-300"
            : n === 1
              ? "bg-yellow-900/30 text-yellow-200"
              : "bg-emerald-900/30 text-emerald-200";
          return (
            <div key={t} className={`rounded px-2 py-1 text-[11px] flex items-center justify-between ${bg}`}>
              <span>{t}</span>
              <span className="font-semibold tabular-nums">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DefensiveGrid({ team }: { team: EffectiveMon[] }) {
  const cov = useMemo(() => defensiveCoverage(team), [team]);
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-[var(--color-muted)]">
        For each attacking type, how your team splits: resist/immune (green), neutral (gray), weak (red).
      </div>
      <div className="flex flex-col gap-1">
        {ALL_TYPES.map((t) => {
          const b = cov.byType[t];
          return (
            <div key={t} className="flex items-center gap-2 text-xs">
              <div className="w-16 text-right">
                <TypeBadge type={t as PokemonType} />
              </div>
              <div className="flex-1 flex h-4 rounded overflow-hidden border border-[var(--color-border)]">
                {b.immune > 0 && (
                  <div className="bg-emerald-700/50 flex items-center justify-center text-[10px] text-emerald-100" style={{ flex: b.immune }}>
                    {b.immune}×
                  </div>
                )}
                {b.resist > 0 && (
                  <div className="bg-emerald-900/50 flex items-center justify-center text-[10px] text-emerald-200" style={{ flex: b.resist }}>
                    {b.resist}
                  </div>
                )}
                {b.neutral > 0 && (
                  <div className="bg-[var(--color-surface-hi)] flex items-center justify-center text-[10px] text-[var(--color-muted)]" style={{ flex: b.neutral }}>
                    {b.neutral}
                  </div>
                )}
                {b.weak > 0 && (
                  <div className="bg-red-900/50 flex items-center justify-center text-[10px] text-red-200" style={{ flex: b.weak }}>
                    {b.weak}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpeedTiers({ team }: { team: EffectiveMon[] }) {
  const status = useData();
  const pokedex = status.state === "ready" ? status.data.pokedex : null;
  const usage = status.state === "ready" ? status.data.usage : null;

  const rows = useMemo(() => {
    if (!pokedex || !usage) return [];
    const metaTop = usage.pokemon
      .slice(0, 8)
      .map((u) => {
        const entry = pokedex.pokemon[u.species];
        return entry ? {
          label: entry.name,
          speed: entry.baseStats.spe,
          source: "meta" as const,
        } : null;
      })
      .filter((x): x is { label: string; speed: number; source: "meta" } => x != null);
    const teamRows = team.map((m) => ({
      label: m.species,
      speed: m.baseStats.spe,
      source: "team" as const,
    }));
    return [...teamRows, ...metaTop].sort((a, b) => b.speed - a.speed);
  }, [pokedex, usage, team]);

  const maxSpeed = rows.reduce((m, r) => Math.max(m, r.speed), 1);

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-[var(--color-muted)] mb-1">
        Base speed of your team (yellow) vs top meta (gray).
      </div>
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`} className="flex items-center gap-2 text-xs">
          <div className="w-28 truncate">{r.label}</div>
          <div className="flex-1 h-3 bg-[var(--color-bg)] rounded overflow-hidden">
            <div
              className={`h-full ${r.source === "team" ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-hi)]"}`}
              style={{ width: `${(r.speed / maxSpeed) * 100}%` }}
            />
          </div>
          <div className="w-8 text-right tabular-nums">{r.speed}</div>
        </div>
      ))}
    </div>
  );
}

function ThreatTable({ team }: { team: EffectiveMon[] }) {
  const status = useData();
  const pokedex = status.state === "ready" ? status.data.pokedex : null;
  const usage = status.state === "ready" ? status.data.usage : null;
  const sets = status.state === "ready" ? status.data.sets : null;

  const scores = useMemo(() => {
    if (!pokedex || !usage) return [];
    const metaMons: EffectiveMon[] = [];
    for (const u of usage.pokemon) {
      const entry = pokedex.pokemon[u.species];
      if (!entry) continue;
      const topSet = sets?.sets[u.species]?.[0];
      const usesMega = topSet?.mega && (entry.megas?.length ?? 0) > 0;
      if (usesMega && entry.megas?.[0]) {
        const m = entry.megas[0];
        metaMons.push({
          species: m.name,
          types: m.types,
          baseStats: m.baseStats,
          ability: m.ability,
        });
      } else {
        metaMons.push({
          species: entry.name,
          types: entry.types,
          baseStats: entry.baseStats,
          ability: entry.abilities[0],
        });
      }
    }
    return threatScores(team, metaMons).slice(0, 12);
  }, [pokedex, usage, sets, team]);

  const maxNet = Math.max(1, ...scores.map((s) => Math.abs(s.net)));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-xs text-[var(--color-muted)] mb-1">
        Ranked by type-chart × stat model. Red bars = they threaten you more than you threaten them.
        This is a heuristic, not a real damage calc.
      </div>
      {scores.map((s) => {
        const ratio = s.net / maxNet;
        const threatening = ratio > 0;
        return (
          <div key={s.species} className="flex items-center gap-2 text-xs">
            <div className="w-28 truncate">{s.species}</div>
            <div className="flex-1 flex items-center h-4">
              <div className="flex-1 flex justify-end">
                {!threatening && (
                  <div
                    className="h-full bg-emerald-800/60 rounded-l"
                    style={{ width: `${Math.abs(ratio) * 100}%` }}
                  />
                )}
              </div>
              <div className="w-px h-full bg-[var(--color-border)]" />
              <div className="flex-1">
                {threatening && (
                  <div
                    className="h-full bg-red-800/60 rounded-r"
                    style={{ width: `${ratio * 100}%` }}
                  />
                )}
              </div>
            </div>
            <div className="w-14 text-right tabular-nums text-[var(--color-muted)]">
              {s.net > 0 ? "+" : ""}{s.net.toFixed(1)}
            </div>
          </div>
        );
      })}
      {scores.length === 0 && (
        <div className="text-xs text-[var(--color-muted)]">No data.</div>
      )}
    </div>
  );
}
