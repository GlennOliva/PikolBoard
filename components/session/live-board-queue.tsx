"use client";

import { ListOrdered } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { PublicSessionPresenceRow } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import {
  attendanceLabel,
  estimatedWaitMinutes,
  formatEstimatedWait,
  formatWaitingTime,
  waitingDurationMs,
} from "@/lib/domain/live-board/wait-time";

export function LiveBoardQueue({
  rows,
  courtCount,
  averageMatchMinutes,
}: {
  rows: PublicSessionPresenceRow[];
  courtCount: number;
  averageMatchMinutes: number | null;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ListOrdered className="size-5" />}
        title="Nobody has checked in yet."
        body="The queue fills as players check in with the organizer."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="overflow-x-auto p-0">
        <table
          className="w-full min-w-[48rem] text-sm"
          data-testid="waiting-queue-table"
        >
          <caption className="sr-only">
            Player queue, attendance status, and estimated wait
          </caption>
          <thead>
            <tr className="retro-table-head border-b text-left text-[0.65rem] uppercase tracking-[0.14em]">
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Position
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Player
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Skill
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Games
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Waiting time
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Estimated wait
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const waiting = row.attendance_status === "waiting";
              const estimate = waiting
                ? estimatedWaitMinutes({
                    queuePosition: row.queue_position,
                    courtCount,
                    averageMatchMinutes,
                  })
                : null;

              return (
                <tr
                  key={row.presence_id}
                  className={cn(
                    "border-b border-pikol-border/60 transition-colors last:border-0",
                    "odd:bg-card/80 even:bg-pikol-surface/40 hover:bg-pikol-cyan/5",
                  )}
                >
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.queue_position ?? "—"}
                  </td>
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-left font-medium"
                  >
                    {row.display_name}
                  </th>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    Level {row.skill_level}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.games_played}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <WaitingTime row={row} waiting={waiting} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatEstimatedWait(estimate)}
                  </td>
                  <td className="px-3 py-2.5">
                    <PresenceBadge status={row.attendance_status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/**
 * Only this cell subscribes to the one-second clock. Keeping the ticker here
 * means a long queue does not repaint its whole table every second; the other
 * columns are derived from server data and change only when the page refreshes.
 */
function WaitingTime({
  row,
  waiting,
}: {
  row: PublicSessionPresenceRow;
  waiting: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!waiting) return;
    const update = () => setNow(Date.now());
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [waiting]);

  if (!waiting) return <>—</>;
  if (now === null) return <>Waiting --:--</>;

  const duration = waitingDurationMs(
    row.last_enqueued_at,
    row.checked_in_at,
    now,
  );

  return <>Waiting {formatWaitingTime(duration)}</>;
}

function PresenceBadge({
  status,
}: {
  status: PublicSessionPresenceRow["attendance_status"];
}) {
  const variant =
    status === "playing"
      ? "playing"
      : status === "staged"
        ? "preparing"
        : status === "waiting"
          ? "up-next"
          : status === "break"
            ? "warning"
            : "completed";
  return <Badge variant={variant}>{attendanceLabel(status)}</Badge>;
}
