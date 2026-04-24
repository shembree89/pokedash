import { useMatch, resetMatch } from "../../store/match";
import SetupPanel from "./SetupPanel";
import LineupPanel from "./LineupPanel";
import BringPanel from "./BringPanel";
import ActivePanel from "./ActivePanel";
import Button from "../../components/Button";

const PHASE_LABEL: Record<string, string> = {
  setup: "1. Setup",
  lineup: "2. Opponent lineup",
  bring: "3. Bring four",
  active: "4. Active",
  observe: "4. Active",
  end: "Match ended",
};

export default function Match() {
  const match = useMatch();
  const phase = match.phase;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Match assistant
          </div>
          <div className="text-lg font-semibold">{PHASE_LABEL[phase] ?? phase}</div>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Reset the current match?")) resetMatch();
          }}
        >
          Reset
        </Button>
      </div>
      {(phase === "setup" || !match.myTeamId) && <SetupPanel />}
      {phase === "lineup" && <LineupPanel />}
      {phase === "bring" && <BringPanel />}
      {(phase === "active" || phase === "observe") && <ActivePanel />}
    </div>
  );
}
