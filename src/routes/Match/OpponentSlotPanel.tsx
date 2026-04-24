import { useMemo } from "react";
import type { MetaDistribution } from "../../data/types";
import { predictOpponent, type OpponentPrediction, type PredictedFeature } from "../../lib/set-predictor";
import { toggleFeature, type OpponentSlot } from "../../store/match";
import { useDex } from "../../data/useDex";
import { Card, CardBody } from "../../components/Card";
import TypeBadge from "../../components/TypeBadge";

interface Props {
  index: number;
  slot: OpponentSlot;
  distribution: MetaDistribution | undefined;
}

function nextState(curr: "unknown" | "seen" | "ruled-out"): "unknown" | "seen" | "ruled-out" {
  if (curr === "unknown") return "seen";
  if (curr === "seen") return "ruled-out";
  return "unknown";
}

function chipClass(state: PredictedFeature["state"], locked: boolean): string {
  if (state === "seen")
    return "bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)] font-medium";
  if (state === "ruled-out")
    return "line-through text-[var(--color-muted)] border-[var(--color-border)] opacity-60";
  if (locked) return "text-[var(--color-muted)] border-[var(--color-border)] opacity-50";
  return "bg-[var(--color-surface)] text-[var(--color-fg)] border-[var(--color-border)] hover:border-[var(--color-accent)]";
}

export default function OpponentSlotPanel({ index, slot, distribution }: Props) {
  const { lookup } = useDex();
  const entry = lookup(slot.species);

  const prediction: OpponentPrediction = useMemo(
    () =>
      predictOpponent({
        species: slot.species,
        distribution,
        observedMoves: slot.observedMoves,
        observedItems: slot.observedItems,
        observedAbilities: slot.observedAbilities,
      }),
    [slot, distribution],
  );

  const click = (
    category: "moves" | "items" | "abilities",
    feature: PredictedFeature,
    locked: boolean,
  ) => {
    if (locked && feature.state === "unknown") return;
    toggleFeature(index, category, feature.name, nextState(feature.state));
  };

  const section = (
    label: string,
    category: "moves" | "items" | "abilities",
    features: PredictedFeature[],
    locked: boolean,
  ) => {
    if (features.length === 0) return null;
    return (
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{label}</div>
          {locked && (
            <span className="text-[10px] text-[var(--color-accent)] uppercase">locked</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {features.map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => click(category, f, locked)}
              className={`px-2 py-1 rounded border text-xs transition-colors ${chipClass(f.state, locked)}`}
              title={
                f.state === "unknown" && f.conditional !== undefined
                  ? `base ${Math.round(f.usage * 100)}% · now ~${Math.round(f.conditional * 100)}%`
                  : `${Math.round(f.usage * 100)}%`
              }
            >
              <span>{f.name}</span>
              <span className="ml-1 text-[10px] opacity-70 tabular-nums">
                {f.state === "unknown" && f.conditional !== undefined && f.conditional !== f.usage
                  ? `${Math.round(f.conditional * 100)}%`
                  : `${Math.round(f.usage * 100)}%`}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{slot.species}</span>
          {entry?.types.map((t) => <TypeBadge key={t} type={t} />)}
          <span className="ml-auto text-[10px] text-[var(--color-muted)]">
            click: seen → ruled out → reset
          </span>
        </div>
        {section("Moves", "moves", prediction.moves, prediction.movesLocked)}
        {section("Item", "items", prediction.items, prediction.itemLocked)}
        {section("Ability", "abilities", prediction.abilities, prediction.abilityLocked)}
      </CardBody>
    </Card>
  );
}
