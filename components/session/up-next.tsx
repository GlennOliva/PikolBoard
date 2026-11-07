import { ArrowUpRight, Layers, UsersRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

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

const toneConfig = {
  staged: {
    card: "retro-staged",
    icon: <UsersRound className="size-5" />,
    body: "The organizer has assigned this lineup to a court. Players can head over now.",
  },
  "up-next": {
    card: "retro-up-next",
    icon: <ArrowUpRight className="size-5" />,
    body: "This matchup is queued and will move to a court as soon as one opens.",
  },
  preparing: {
    card: "retro-preparing",
    icon: <Layers className="size-5" />,
    body: "The organizer is still balancing this lineup before it enters the queue.",
  },
} as const;

/** Shared public-board cards for Ready on Court, Up Next, and Preparation. */
export function LineupCards({
  groups,
  emptyText,
  tone = "staged",
}: {
  groups: LineupCardGroup[];
  emptyText: string;
  tone?: "staged" | "up-next" | "preparing";
}) {
  const config = toneConfig[tone];

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={config.icon}
        title={emptyText}
        body={config.body}
        className="border-solid bg-card/70"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {groups.map((group) => (
        <li key={group.id}>
          <Card
            className={cn("overflow-hidden", config.card)}
            data-lineup-stage={tone}
            data-lineup-id={group.id}
          >
            <CardContent className="pt-5 sm:pt-6">
              <p className="text-base font-semibold leading-snug">
                {group.label}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([1, 2] as const).map((team) => {
                  const players = group.players
                    .filter((row) => row.team_number === team)
                    .sort((a, b) => a.slot_number - b.slot_number);

                  return (
                    <div
                      key={team}
                      className={cn(
                        "rounded-lg border p-3",
                        team === 1
                          ? "border-pikol-cyan/25 bg-pikol-cyan/5"
                          : "border-pikol-pink/25 bg-pikol-pink/5",
                      )}
                    >
                      <p
                        className={cn(
                          "text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                          team === 1 ? "text-pikol-cyan" : "text-pikol-pink",
                        )}
                      >
                        Team {team}
                      </p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {players.length === 0 ? (
                          <li className="text-sm text-muted-foreground">
                            Pending
                          </li>
                        ) : (
                          players.map((row) => (
                            <li
                              key={row.lineup_id}
                              className="text-sm font-medium leading-snug"
                            >
                              {row.display_name}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
