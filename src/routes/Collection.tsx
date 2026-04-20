import { useState } from "react";
import {
  addManyOwned,
  addOwned,
  clearOwned,
  removeOwned,
  useOwned,
} from "../store/collection";
import { parsePokepaste, teamToPokepaste, toOwnedPokemon } from "../lib/pokepaste";
import { useData } from "../data/useData";
import TypeBadge from "../components/TypeBadge";
import { Card, CardBody, CardHeader } from "../components/Card";
import Button from "../components/Button";
import { emptySpread } from "../lib/sp-converter";
import { STAT_KEYS, STAT_LABEL } from "../data/types";
import type { OwnedPokemon, PokemonType } from "../data/types";

export default function Collection() {
  const owned = useOwned();
  const status = useData();
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const pokedex = status.state === "ready" ? status.data.pokedex : null;

  const handleImport = () => {
    try {
      const sets = parsePokepaste(importText);
      if (sets.length === 0) {
        setImportError("No sets parsed. Paste Showdown-format text.");
        return;
      }
      addManyOwned(sets.map(toOwnedPokemon));
      setImportText("");
      setShowImport(false);
      setImportError(null);
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  const handleExport = () => {
    if (owned.length === 0) return;
    const text = teamToPokepaste(owned);
    navigator.clipboard?.writeText(text).catch(() => {});
    // Also download as a file
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pokedash-collection-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addEmpty = () => {
    addOwned({
      species: "Incineroar",
      ability: "",
      item: "",
      nature: "Hardy",
      moves: ["", "", "", ""],
      spSpread: emptySpread(),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Your collection</h1>
        <span className="text-xs text-[var(--color-muted)]">{owned.length} pokemon</span>
        <div className="ml-auto flex gap-2">
          <Button variant="primary" onClick={() => setShowImport(true)}>
            Import pokepaste
          </Button>
          <Button onClick={addEmpty}>Add blank</Button>
          <Button onClick={handleExport} disabled={owned.length === 0}>
            Export
          </Button>
          {owned.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(`Delete all ${owned.length} pokemon from your collection?`)) {
                  clearOwned();
                }
              }}
            >
              Clear all
            </Button>
          )}
        </div>
      </div>

      {showImport && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Import pokepaste</div>
              <button
                onClick={() => setShowImport(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)] text-sm"
              >
                close
              </button>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            <div className="text-xs text-[var(--color-muted)]">
              Paste Showdown-format text below. Sets are separated by blank lines. `SPs:` lines are
              read as Stat Points; `EVs:` lines are converted (÷8).
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={12}
              className="font-mono text-xs p-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder={`Incineroar @ Safety Goggles\nAbility: Intimidate\nSPs: 32 HP / 4 Atk / 8 Def / 22 SpD\nSassy Nature\n- Fake Out\n- Knock Off\n- Parting Shot\n- Flare Blitz`}
            />
            {importError && <div className="text-xs text-red-400">{importError}</div>}
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleImport}>
                Import
              </Button>
              <Button variant="ghost" onClick={() => setShowImport(false)}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {owned.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-sm text-[var(--color-muted)]">
              Your collection is empty. Import from pokepaste or add blanks to start.
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {owned.map((mon) => (
            <OwnedCard
              key={mon.id}
              mon={mon}
              types={pokedex?.pokemon[mon.species]?.types ?? []}
              onDelete={() => removeOwned(mon.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OwnedCard({
  mon,
  types,
  onDelete,
}: {
  mon: OwnedPokemon;
  types: readonly PokemonType[];
  onDelete: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              {mon.species}
              {mon.mega && (
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-accent)] text-[var(--color-accent-ink)] rounded uppercase font-bold">
                  Mega
                </span>
              )}
            </div>
            <div className="flex gap-1 mt-1">
              {types.map((t) => <TypeBadge key={t} type={t} />)}
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm(`Remove ${mon.nickname || mon.species} from your collection?`)) {
                onDelete();
              }
            }}
            className="text-[var(--color-muted)] hover:text-red-400 text-xs"
          >
            remove
          </button>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2 text-xs">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {mon.item && (
            <>
              <span className="text-[var(--color-muted)]">Item</span>
              <span>{mon.item}</span>
            </>
          )}
          {mon.ability && (
            <>
              <span className="text-[var(--color-muted)]">Ability</span>
              <span>{mon.ability}</span>
            </>
          )}
          {mon.nature && (
            <>
              <span className="text-[var(--color-muted)]">Nature</span>
              <span>{mon.nature}</span>
            </>
          )}
        </div>
        <div>
          <div className="text-[var(--color-muted)] mb-1">Moves</div>
          <div className="grid grid-cols-2 gap-x-2">
            {mon.moves.filter(Boolean).map((m, i) => (
              <div key={i}>• {m}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[var(--color-muted)] mb-1">SP spread</div>
          <div className="flex flex-wrap gap-1">
            {STAT_KEYS.map((k) => {
              const v = mon.spSpread[k] ?? 0;
              if (v === 0) return null;
              return (
                <span
                  key={k}
                  className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hi)] tabular-nums"
                >
                  <span className="text-[var(--color-muted)]">{STAT_LABEL[k]}</span> {v}
                </span>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
