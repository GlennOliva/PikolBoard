"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PublicSessionPresenceRow } from "@/lib/db/types";
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
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Nobody has checked in yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">Player queue and attendance status</caption>
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2">Position</th>
              <th scope="col" className="px-3 py-2">Player</th>
              <th scope="col" className="px-3 py-2">Skill</th>
              <th scope="col" className="px-3 py-2 text-right">Games</th>
              <th scope="col" className="px-3 py-2 text-right">Waiting time</th>
              <th scope="col" className="px-3 py-2 text-right">Estimated wait</th>
              <th scope="col" className="px-3 py-2">Status</th>
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
                <tr key={row.presence_id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 tabular-nums">{row.queue_position ?? "—"}</td>
                  <th scope="row" className="px-3 py-2 text-left font-medium">{row.display_name}</th>
                  <td className="px-3 py-2 text-muted-foreground">Level {row.skill_level}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.games_played}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <WaitingTime row={row} waiting={waiting} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatEstimatedWait(estimate)}</td>
                  <td className="px-3 py-2"><PresenceBadge status={row.attendance_status} /></td>
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

function PresenceBadge({ status }: { status: PublicSessionPresenceRow["attendance_status"] }) {
  const active = status === "playing" || status === "staged";
  return <Badge variant={active ? "default" : "secondary"}>{attendanceLabel(status)}</Badge>;
}
