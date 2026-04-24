import { useState } from "react";
import { addOpponent, removeOpponent, setPhase, useMatch } from "../../store/match";
import { useAutocomplete } from "../../data/autocomplete";
import { useDex } from "../../data/useDex";
import { Card, CardBody, CardHeader } from "../../components/Card";
import Button from "../../components/Button";
import TypeBadge from "../../components/TypeBadge";

export default function LineupPanel() {
  const match = useMatch();
  const auto = useAutocomplete();
  const { lookup, ensure } = useDex();
  const [input, setInput] = useState("");

  const addFromInput = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (!auto.species.includes(trimmed) && !lookup(trimmed)) {
      ensure(trimmed);
    }
    addOpponent(trimmed);
    setInput("");
  };

  const full = match.opponents.length >= 6;

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Enter opponent's 6</div>
        <div className="text-xs text-[var(--color-muted)]">
          Type or pick species. Add all 6 to continue.
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {match.opponents.map((opp, i) => {
            const entry = lookup(opp.species);
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--color-surface-hi)] border border-[var(--color-border)]"
              >
                <span className="text-sm font-medium">{opp.species}</span>
                {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
                <button
                  type="button"
                  onClick={() => removeOpponent(i)}
                  className="text-[var(--color-muted)] hover:text-red-400 px-1"
                  aria-label={`Remove ${opp.species}`}
                >
                  ×
                </button>
              </div>
            );
          })}
          {Array.from({ length: 6 - match.opponents.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="px-2 py-1 rounded border border-dashed border-[var(--color-border)] text-xs text-[var(--color-muted)]"
            >
              slot {match.opponents.length + i + 1}
            </div>
          ))}
        </div>

        {!full && (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addFromInput();
              }}
              placeholder="Species name"
              list="pokedash-species-match"
              autoComplete="off"
              className="edit-input flex-1"
            />
            <datalist id="pokedash-species-match">
              {auto.species.map((s) => <option key={s} value={s} />)}
            </datalist>
            <Button variant="primary" onClick={addFromInput} disabled={!input.trim()}>
              Add
            </Button>
          </div>
        )}

        <div className="flex justify-between pt-2 border-t border-[var(--color-border)]">
          <Button variant="ghost" onClick={() => setPhase("setup")}>
            ← Back
          </Button>
          <Button
            variant="primary"
            disabled={!full}
            onClick={() => setPhase("bring")}
          >
            {full ? "Continue to bring →" : `Need ${6 - match.opponents.length} more`}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
