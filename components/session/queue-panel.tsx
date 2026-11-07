"use client";

import { useActionState } from "react";
import { Coffee, LogIn, LogOut, PlayCircle, UserMinus } from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  checkInAction,
  checkInSessionPlayersAction,
  checkOutAction,
  removeSessionPlayerAction,
  setBreakAction,
} from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
import { AddPlayersDialog } from "@/components/session/add-players-dialog";
import { initialsOf } from "@/lib/format";
import type { Player, SessionPlayer } from "@/lib/db/types";
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
  availablePlayers,
  canManage,
}: {
  sessionId: string;
  roster: SessionPlayer[];
  availablePlayers: Player[];
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
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60">
        <CardTitle className="text-base">Queue and attendance</CardTitle>
        {canManage ? (
          <AddPlayersDialog
            sessionId={sessionId}
            availablePlayers={availablePlayers}
          />
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {roster.length === 0 ? (
          <EmptyState
            title="Nobody is on this session roster"
            body="Use Add players to bring somebody in, then check them into the rotation."
          />
        ) : null}

        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <section key={group.key} aria-label={group.title}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.title}
                </h3>
                {group.key === "off" && canManage ? (
                  <BulkCheckInButton
                    sessionId={sessionId}
                    players={group.rows.filter(
                      (player) =>
                        needsCheckIn(player.attendance_status) &&
                        !player.player_missing,
                    )}
                  />
                ) : null}
              </div>
              <ul
                className={
                  "mt-2 flex flex-col divide-y divide-border overflow-hidden rounded-lg border bg-background/35 " +
                  (group.key === "waiting"
                    ? "border-pikol-cyan/30"
                    : group.key === "break"
                      ? "border-pikol-warning/30"
                      : "border-border")
                }
              >
                {group.rows.map((player) => (
                  <li
                    key={player.id}
                    className="flex flex-wrap items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/35"
                  >
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-[10px] font-semibold text-pikol-cyan"
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
                      <Badge variant="up-next">#{player.queue_position}</Badge>
                    ) : null}

                    {canManage ? (
                      <RowActions
                        sessionId={sessionId}
                        // players.id, not player.id: attendance RPCs take the
                        // club player, while player.id is the session_players
                        // row key used for the <li> above.
                        playerId={attendancePlayerId(player)}
                        displayName={player.display_name}
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
  displayName,
  status,
  playerMissing,
}: {
  sessionId: string;
  playerId: string;
  displayName: string;
  status: Attendance;
  playerMissing: boolean;
}) {
  if (status === "playing" || status === "staged") {
    return <p className="text-xs text-muted-foreground">On a court</p>;
  }

  // A roster row with no club player behind it cannot be checked in: every
  // attendance RPC resolves the player first. It can still be removed, which
  // is how an organizer cleans up the dangling row.
  if (playerMissing) {
    return (
      <div className="flex items-center gap-1">
        <p className="text-xs text-muted-foreground">Record unavailable</p>
        <RemoveButton
          sessionId={sessionId}
          playerId={playerId}
          displayName={displayName}
        />
      </div>
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

      <RemoveButton
        sessionId={sessionId}
        playerId={playerId}
        displayName={displayName}
      />
    </div>
  );
}

function BulkCheckInButton({
  sessionId,
  players,
}: {
  sessionId: string;
  players: SessionPlayer[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    checkInSessionPlayersAction,
    idleState,
  );

  if (players.length === 0) return null;

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      {players.map((player) => (
        <input
          key={player.id}
          type="hidden"
          name="playerIds"
          value={attendancePlayerId(player)}
        />
      ))}
      {state.error ? (
        <span role="alert" className="text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      <SubmitButton pendingLabel="Checking in…" size="sm" variant="ghost">
        <LogIn className="mr-1.5 size-3.5" aria-hidden />
        Check in all {players.length}
      </SubmitButton>
    </form>
  );
}

function RemoveButton({
  sessionId,
  playerId,
  displayName,
}: {
  sessionId: string;
  playerId: string;
  displayName: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    removeSessionPlayerAction,
    idleState,
  );

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${displayName} from this session?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="playerId" value={playerId} />
      {state.error ? (
        <span role="alert" className="mr-2 text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      <SubmitButton pendingLabel="Removing…" size="sm" variant="ghost">
        <UserMinus className="mr-1.5 size-3.5" aria-hidden />
        Remove
      </SubmitButton>
    </form>
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
