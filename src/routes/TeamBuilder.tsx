import { useEffect, useMemo, useState } from "react";
import {
  createTeam,
  duplicateTeam,
  removeTeam,
  renameTeam,
  setTeamSlots,
  useOwned,
  useTeams,
} from "../store/collection";
import { useDex } from "../data/useDex";
import type { OwnedPokemon } from "../data/types";
import { validateTeam, TEAM_SIZE, type TeamViolation } from "../lib/team-rules";
import { resolveOwned } from "../lib/threat";
import { Card, CardBody, CardHeader } from "../components/Card";
import Button from "../components/Button";
import TypeBadge from "../components/TypeBadge";
import SlotEditor from "../components/SlotEditor";
import AnalysisPanels from "../components/AnalysisPanels";
import StressTest from "../components/StressTest";
import { teamToPokepaste } from "../lib/pokepaste";

function violationLabel(v: TeamViolation): string {
  switch (v.kind) {
    case "duplicate-species": return `duplicate species: ${v.species}`;
    case "duplicate-item": return `duplicate item: ${v.item}`;
    case "too-many-megas": return `${v.count} megas (max 1)`;
    case "invalid-spread": return `SP spread invalid on ${v.species}`;
    case "wrong-size": return `team has ${v.actual}/${TEAM_SIZE} slots filled`;
  }
}

export default function TeamBuilder() {
  const teams = useTeams();
  const owned = useOwned();
  const { lookup, ensureMany } = useDex();
  const [activeId, setActiveId] = useState<string | null>(teams[0]?.id ?? null);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    if (activeId && !teams.some((t) => t.id === activeId)) {
      setActiveId(teams[0]?.id ?? null);
    }
  }, [teams, activeId]);

  useEffect(() => {
    ensureMany(owned.map((m) => m.species));
  }, [owned, ensureMany]);

  const active = teams.find((t) => t.id === activeId);
  const slotMons: (OwnedPokemon | null)[] = useMemo(() => {
    const arr: (OwnedPokemon | null)[] = [];
    const ids = active?.ownedIds ?? [];
    for (let i = 0; i < TEAM_SIZE; i += 1) {
      const id = ids[i];
      arr.push(id ? owned.find((m) => m.id === id) ?? null : null);
    }
    return arr;
  }, [active, owned]);

  const filledMons = slotMons.filter((m): m is OwnedPokemon => m != null);
  const violations = useMemo(() => validateTeam(filledMons), [filledMons]);

  const addToFirstEmpty = (id: string) => {
    if (!active) return;
    const ids = [...active.ownedIds];
    if (ids.length >= TEAM_SIZE) return;
    ids.push(id);
    setTeamSlots(active.id, ids);
  };

  const swapSlot = (index: number, id: string | null) => {
    if (!active) return;
    const ids = [...active.ownedIds];
    while (ids.length <= index) ids.push("");
    if (id) ids[index] = id;
    else ids.splice(index, 1);
    setTeamSlots(active.id, ids.filter(Boolean));
  };

  const handleNewTeam = () => {
    const t = createTeam(`Team ${teams.length + 1}`);
    setActiveId(t.id);
  };

  const handleDuplicate = () => {
    if (!active) return;
    const t = duplicateTeam(active.id);
    if (t) setActiveId(t.id);
  };

  const handleDelete = () => {
    if (!active) return;
    if (confirm(`Delete team "${active.name}"?`)) {
      removeTeam(active.id);
    }
  };

  const handleExport = () => {
    if (!active || filledMons.length === 0) return;
    const text = teamToPokepaste(filledMons);
    navigator.clipboard?.writeText(text).catch(() => {});
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = active.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `${safe || "team"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resolved = filledMons.map((m) => resolveOwned(m, lookup(m.species)));

  if (teams.length === 0) {
    return (
      <div className="flex flex-col gap-4 items-center py-12">
        <div className="text-sm text-[var(--color-muted)]">No teams yet.</div>
        <Button variant="primary" onClick={handleNewTeam}>
          Create your first team
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <select
          value={active?.id ?? ""}
          onChange={(e) => setActiveId(e.target.value)}
          className="w-full px-3 py-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)] min-h-11"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.ownedIds.length}/{TEAM_SIZE})
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={handleNewTeam}>+ New</Button>
          {active && (
            <>
              <Button onClick={() => setRenameOpen(true)}>Rename</Button>
              <Button onClick={handleDuplicate}>Duplicate</Button>
              <Button onClick={handleExport} disabled={filledMons.length === 0}>Export</Button>
              <Button variant="danger" onClick={handleDelete}>Delete</Button>
            </>
          )}
        </div>
      </div>

      {renameOpen && active && (
        <RenameRow
          initial={active.name}
          onSave={(name) => { renameTeam(active.id, name); setRenameOpen(false); }}
          onCancel={() => setRenameOpen(false)}
        />
      )}

      {violations.length > 0 && active && filledMons.length === TEAM_SIZE && (
        <Card className="border-red-800/60">
          <CardBody className="text-xs text-red-300 flex flex-wrap gap-2">
            {violations.map((v, i) => (
              <span key={i} className="px-2 py-0.5 bg-red-900/40 rounded">
                {violationLabel(v)}
              </span>
            ))}
          </CardBody>
        </Card>
      )}

      {active && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Slots</div>
              <div className="text-xs text-[var(--color-muted)]">
                {filledMons.length}/{TEAM_SIZE} filled
              </div>
            </div>
          </CardHeader>
          <div>
            {Array.from({ length: TEAM_SIZE }).map((_, i) => {
              const mon = slotMons[i];
              return (
                <SlotRow
                  key={i}
                  index={i}
                  mon={mon}
                  onEdit={() => setEditingSlot(i)}
                  onAdd={(id) => {
                    swapSlot(i, id);
                  }}
                  availableOwned={owned.filter(
                    (o) => !active.ownedIds.includes(o.id),
                  )}
                />
              );
            })}
          </div>
        </Card>
      )}

      {active && filledMons.length > 0 && (
        <AnalysisPanels team={resolved} />
      )}

      {active && filledMons.length === TEAM_SIZE && (
        <StressTest
          team={resolved}
          teamOwnedMoves={
            new Map(
              filledMons.map((m) => [
                m.species,
                (m.moves ?? []).filter(Boolean),
              ]),
            )
          }
        />
      )}

      {editingSlot !== null && slotMons[editingSlot] && (
        <SlotEditor
          mon={slotMons[editingSlot]!}
          onClose={() => setEditingSlot(null)}
          onRemoveFromTeam={() => {
            if (!active) return;
            swapSlot(editingSlot, null);
            setEditingSlot(null);
          }}
          onAddToFirstEmpty={addToFirstEmpty}
        />
      )}
    </div>
  );
}

function RenameRow({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <Card>
      <CardBody className="flex gap-2">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
          className="flex-1 px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <Button variant="primary" onClick={() => onSave(val.trim() || initial)}>
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </CardBody>
    </Card>
  );
}

function SlotRow({
  index,
  mon,
  onEdit,
  onAdd,
  availableOwned,
}: {
  index: number;
  mon: OwnedPokemon | null;
  onEdit: () => void;
  onAdd: (id: string) => void;
  availableOwned: OwnedPokemon[];
}) {
  const { lookup, ensure } = useDex();
  useEffect(() => {
    if (mon) ensure(mon.species);
  }, [mon, ensure]);
  const entry = mon ? lookup(mon.species) : undefined;
  const resolved = mon ? resolveOwned(mon, entry) : null;
  const [picking, setPicking] = useState(false);

  if (!mon) {
    return (
      <div className="border-t border-[var(--color-border)] first:border-t-0">
        {picking ? (
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-muted)] w-6">{index + 1}.</span>
              <select
                autoFocus
                className="flex-1 px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm"
                onChange={(e) => {
                  if (e.target.value) onAdd(e.target.value);
                  setPicking(false);
                }}
                defaultValue=""
              >
                <option value="" disabled>Choose a pokemon…</option>
                {availableOwned.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nickname ? `${o.nickname} — ${o.species}` : o.species}
                    {o.item ? ` @ ${o.item}` : ""}
                  </option>
                ))}
              </select>
              <Button variant="ghost" onClick={() => setPicking(false)}>Cancel</Button>
            </div>
            {availableOwned.length === 0 && (
              <div className="text-xs text-[var(--color-muted)] pl-8">
                No more owned pokemon available. Add to your collection first.
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setPicking(true)}
            className="w-full text-left px-3 py-3 flex items-center gap-3 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hi)]/50 transition-colors"
          >
            <span className="w-6 text-right">{index + 1}.</span>
            <span className="flex-1">+ Add pokemon</span>
          </button>
        )}
      </div>
    );
  }

  const types = resolved?.types ?? entry?.types ?? [];

  return (
    <button
      onClick={onEdit}
      className="w-full text-left border-t border-[var(--color-border)] first:border-t-0 px-3 py-3 flex items-center gap-3 hover:bg-[var(--color-surface-hi)]/50 transition-colors"
    >
      <span className="text-xs text-[var(--color-muted)] w-6 text-right">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {mon.nickname ? `${mon.nickname} — ${mon.species}` : mon.species}
          </span>
          {mon.mega && (
            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-accent)] text-[var(--color-accent-ink)] rounded uppercase font-bold">
              Mega
            </span>
          )}
          <div className="flex gap-1">
            {types.map((t) => <TypeBadge key={t} type={t} />)}
          </div>
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5 truncate">
          {[mon.item, mon.ability, mon.nature].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className="text-[var(--color-muted)] text-xs">edit ▶</span>
    </button>
  );
}
