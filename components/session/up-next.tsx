import { Card, CardContent } from "@/components/ui/card";

export interface LineupCardPlayer {
  team_number: 1 | 2;
  slot_number: number;
  display_name: string;
  lineup_id: string;
}

export interface LineupCardGroup {
  id: string;
  label: string;
  players: LineupCardPlayer[];
}

/** Shared public-board cards for Ready on Court, Up Next, and Preparation. */
export function LineupCards({
  groups,
  emptyText,
}: {
  groups: LineupCardGroup[];
  emptyText: string;
}) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          {emptyText}
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => (
        <li key={group.id}>
          <Card>
            <CardContent>
              <p className="text-sm font-medium">{group.label}</p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {([1, 2] as const).map((team) => (
                  <div key={team}>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Team {team}
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {group.players
                        .filter((row) => row.team_number === team)
                        .sort((a, b) => a.slot_number - b.slot_number)
                        .map((row) => (
                          <li key={row.lineup_id} className="text-sm">
                            {row.display_name}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
