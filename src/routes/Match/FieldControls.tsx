import { setField, useMatch } from "../../store/match";

type Weather = "Sun" | "Rain" | "Sand" | "Snow" | null;
type Terrain = "Electric" | "Grassy" | "Misty" | "Psychic" | null;

const WEATHERS: { value: Weather; label: string }[] = [
  { value: null, label: "—" },
  { value: "Sun", label: "Sun" },
  { value: "Rain", label: "Rain" },
  { value: "Sand", label: "Sand" },
  { value: "Snow", label: "Snow" },
];

const TERRAINS: { value: Terrain; label: string }[] = [
  { value: null, label: "—" },
  { value: "Electric", label: "Electric" },
  { value: "Grassy", label: "Grassy" },
  { value: "Misty", label: "Misty" },
  { value: "Psychic", label: "Psychic" },
];

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded text-xs border transition-colors ${
        active
          ? "bg-[var(--color-accent)] text-[var(--color-accent-ink)] border-[var(--color-accent)] font-medium"
          : "bg-[var(--color-surface)] text-[var(--color-muted)] border-[var(--color-border)] hover:text-[var(--color-fg)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function FieldControls() {
  const match = useMatch();
  const f = match.field;

  return (
    <div className="flex flex-wrap gap-3 items-center text-xs p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-muted)] uppercase tracking-wide">Tailwind</span>
        <Pill active={f.tailwindMine} onClick={() => setField({ tailwindMine: !f.tailwindMine })}>
          you
        </Pill>
        <Pill
          active={f.tailwindTheirs}
          onClick={() => setField({ tailwindTheirs: !f.tailwindTheirs })}
        >
          opp
        </Pill>
      </div>
      <Pill active={f.trickRoom} onClick={() => setField({ trickRoom: !f.trickRoom })}>
        Trick Room
      </Pill>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-muted)] uppercase tracking-wide">Weather</span>
        {WEATHERS.map((w) => (
          <Pill
            key={w.label}
            active={f.weather === w.value}
            onClick={() => setField({ weather: w.value })}
          >
            {w.label}
          </Pill>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--color-muted)] uppercase tracking-wide">Terrain</span>
        {TERRAINS.map((t) => (
          <Pill
            key={t.label}
            active={f.terrain === t.value}
            onClick={() => setField({ terrain: t.value })}
          >
            {t.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}
