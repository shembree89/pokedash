import { useTeams, useOwned } from "../../store/collection";
import { setMyTeam, useMatch } from "../../store/match";
import { Card, CardBody, CardHeader } from "../../components/Card";
import Button from "../../components/Button";

export default function SetupPanel() {
  const teams = useTeams();
  const owned = useOwned();
  const match = useMatch();

  const fullTeams = teams.filter((t) => t.ownedIds.length === 6);

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold">Pick your active team</div>
        <div className="text-xs text-[var(--color-muted)]">
          Only full 6-pokemon teams from your Collection can be used.
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        {fullTeams.length === 0 && (
          <div className="text-sm text-[var(--color-muted)]">
            No teams of 6 in your Collection yet. Build one in the <strong>Builder</strong> tab.
          </div>
        )}
        {fullTeams.map((t) => {
          const mons = t.ownedIds
            .map((id) => owned.find((o) => o.id === id))
            .filter(Boolean)
            .map((m) => m!.species);
          const isActive = match.myTeamId === t.id;
          return (
            <div
              key={t.id}
              className={`flex flex-wrap items-center gap-2 p-2 rounded border ${
                isActive
                  ? "border-[var(--color-accent)] bg-[var(--color-surface-hi)]"
                  : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-[var(--color-muted)] truncate">
                  {mons.join(" · ")}
                </div>
              </div>
              <Button variant="primary" onClick={() => setMyTeam(t.id)}>
                {isActive ? "Continue" : "Use"}
              </Button>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
