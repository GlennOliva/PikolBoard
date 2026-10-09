"use client";

import { useActionState } from "react";
import { Coffee, LogIn, LogOut, PlayCircle } from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  checkInAction,
  checkOutAction,
  setBreakAction,
} from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
import { initialsOf } from "@/lib/format";
import type { SessionPlayer } from "@/lib/db/types";
import {
  attendancePlayerId,
  needsCheckIn,
  rosterStateLabel,
} from "@/lib/domain/queue/attendance";

type Attendance = SessionPlayer["attendance_status"];

/**
 * The organizer view of everyone in the session and where they are. Each
 * transition is its own server action, so the database stays the source of truth
 * for who is on a court — the UI never moves a player itself. Attendance is an
 * enum (checked_out, waiting, staged, playing, break, finished), which is why
 * "on a court" covers both staged and playing.
 */
export function QueuePanel({
  sessionId,
  roster,
  canManage,
}: {
  sessionId: string;
  roster: SessionPlayer[];
  canManage: boolean;
}) {
  const groups: Array<{ key: string; title: string; rows: SessionPlayer[] }> = [
    {
      key: "waiting",
      title: `Queue (${roster.filter((p) => p.attendance_status === "waiting").length})`,
      rows: sortByQueue(roster.filter((p) => p.attendance_status === "waiting")),
    },
    {
      key: "break",
      title: "On break",
      rows: roster.filter((p) => p.attendance_status === "break"),
    },
    {
      key: "off",
      title: "Not in the rotation",
      rows: roster.filter(
        (p) =>
          p.attendance_status === "checked_out" ||
          p.attendance_status === "finished",
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Queue and attendance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {roster.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody is on this session&apos;s roster yet. Add players from the
            club&apos;s Sessions tab.
          </p>
        ) : null}

        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <section key={group.key} aria-label={group.title}>
              <h3 className="text-sm font-medium text-muted-foreground">
                {group.title}
              </h3>
              <ul className="mt-2 flex flex-col divide-y divide-border rounded-lg border border-border">
                {group.rows.map((player) => (
                  <li
                    key={player.id}
                    className="flex flex-wrap items-center gap-2 px-3 py-2"
                  >
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold"
                    >
                      {initialsOf(player.display_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {player.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Level {player.skill_level} ·{" "}
                        {rosterStateLabel(
                          player.attendance_status,
                          player.player_missing,
                        )}
                        {player.games_played > 0
                          ? ` · ${player.games_played} ${
                              player.games_played === 1 ? "game" : "games"
                            }`
                          : ""}
                        {player.times_skipped > 0
                          ? ` · skipped ${player.times_skipped}×`
                          : ""}
                      </p>
                    </div>

                    {player.queue_position ? (
                      <Badge variant="outline">#{player.queue_position}</Badge>
                    ) : null}

                    {canManage ? (
                      <RowActions
                        sessionId={sessionId}
                        // players.id, not player.id: attendance RPCs take the
                        // club player, while player.id is the session_players
                        // row key used for the <li> above.
                        playerId={attendancePlayerId(player)}
                        status={player.attendance_status}
                        playerMissing={player.player_missing}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </CardContent>
    </Card>
  );
}

function sortByQueue(rows: SessionPlayer[]): SessionPlayer[] {
  return [...rows].sort(
    (a, b) => (a.queue_position ?? 999) - (b.queue_position ?? 999),
  );
}

function RowActions({
  sessionId,
  playerId,
  status,
  playerMissing,
}: {
  sessionId: string;
  playerId: string;
  status: Attendance;
  playerMissing: boolean;
}) {
  if (status === "playing" || status === "staged") {
    return <p className="text-xs text-muted-foreground">On a court</p>;
  }

  // A roster row with no club player behind it cannot be written to: every
  // attendance RPC resolves the player first. Say so instead of offering a
  // button that is guaranteed to fail.
  if (playerMissing) {
    return (
      <p className="text-xs text-muted-foreground">
        Re-add them from the club roster.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {needsCheckIn(status) ? (
        <CheckInButton sessionId={sessionId} playerId={playerId} />
      ) : null}

      {status === "waiting" ? (
        <>
          <MoveButton
            sessionId={sessionId}
            playerId={playerId}
            to="break"
            label="Break"
            icon={<Coffee className="size-3.5" aria-hidden />}
          />
          <LeaveButton sessionId={sessionId} playerId={playerId} />
        </>
      ) : null}

      {status === "break" ? (
        <MoveButton
          sessionId={sessionId}
          playerId={playerId}
          to="queue"
          label="Re-queue"
          icon={<PlayCircle className="size-3.5" aria-hidden />}
        />
      ) : null}
    </div>
  );
}

function CheckInButton({
  sessionId,
  playerId,
}: {
  sessionId: string;
  playerId: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    checkInAction,
    idleState,
  );

  return (
    <form action={action}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="playerId" value={playerId} />
      {state.error ? (
        <span role="alert" className="mr-2 text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      <SubmitButton pendingLabel="…" size="sm">
        <LogIn className="mr-1.5 size-3.5" aria-hidden />
        Check in
      </SubmitButton>
    </form>
  );
}

function MoveButton({
  sessionId,
  playerId,
  to,
  label,
  icon,
}: {
  sessionId: string;
  playerId: string;
  to: "queue" | "break";
  label: string;
  icon: React.ReactNode;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    setBreakAction,
    idleState,
  );

  return (
    <form action={action}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="playerId" value={playerId} />
      <input type="hidden" name="to" value={to} />
      {state.error ? (
        <span role="alert" className="mr-2 text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      <SubmitButton pendingLabel="…" size="sm" variant="outline">
        {icon}
        {label}
      </SubmitButton>
    </form>
  );
}

function LeaveButton({
  sessionId,
  playerId,
}: {
  sessionId: string;
  playerId: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    checkOutAction,
    idleState,
  );

  return (
    <form action={action}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="playerId" value={playerId} />
      {state.error ? (
        <span role="alert" className="mr-2 text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      <SubmitButton pendingLabel="…" size="sm" variant="ghost">
        <LogOut className="mr-1.5 size-3.5" aria-hidden />
        Done
      </SubmitButton>
    </form>
  );
}
