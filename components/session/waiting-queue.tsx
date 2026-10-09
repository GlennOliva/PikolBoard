import { Card, CardContent } from "@/components/ui/card";
import type { PublicSessionQueueRow } from "@/lib/db/types";
import { initialsOf } from "@/lib/format";

/**
 * Who is waiting, in queue order.
 *
 * Backed by public_session_queue, which is publish-gated and carries no user or
 * player id -- a spectator learns who is next and in what order, and nothing that
 * identifies them beyond a display name and skill level.
 *
 * Rows are keyed on `queue_entry_id`, the surrogate id of the queue row. The key
 * used to be `${queue_position}-${display_name}`, which collides twice over:
 * queue positions are reused as players cycle through matches, so a recycled
 * position paired with a returning name reused the previous occupant's element;
 * and display names are not unique on a club.
 */
export function WaitingQueue({
  rows,
}: {
  rows: PublicSessionQueueRow[];
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Nobody is waiting.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ol>
          {rows.map((row) => (
            <li
              key={row.queue_entry_id}
              className="flex items-center gap-3 border-b border-border/60 px-4 py-2 text-sm last:border-0"
            >
              <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold tabular-nums"
              >
                {row.queue_position}
              </span>
              <span
                aria-hidden
                className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold"
              >
                {initialsOf(row.display_name)}
              </span>
              <span className="flex-1 truncate">{row.display_name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                Level {row.skill_level}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}