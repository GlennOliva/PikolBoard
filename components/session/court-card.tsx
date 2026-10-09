"use client";

import { useActionState, useState } from "react";
import { Ban, CircleSlash, Pencil, Play, Trophy } from "lucide-react";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cancelLineupFormAction } from "@/app/actions/lineup-actions";
import {
  completeMatchAction,
  correctScoreAction,
  setCourtStatusAction,
  startMatchAction,
  updateRunningScoreAction,
} from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
import { initialsOf } from "@/lib/format";
import { MatchTimerLabeled } from "@/components/session/match-timer";
import type { MatchWithPlayers } from "@/lib/db/queries";

export interface CourtView {
  id: string;
  court_number: number;
  name: string | null;
  status: "available" | "staged" | "playing" | "disabled";
  ladder_position: number;
  match: MatchWithPlayers | null;
}

/**
 * One court in the session ladder: who is on it, the score if it is finished,
 * and the buttons that move it forward. Every mutation is a server action, so
 * the database re-checks permissions and court state on each one.
 */
export function CourtCard({
  sessionId,
  court,
  canManage,
}: {
  sessionId: string;
  court: CourtView;
  canManage: boolean;
}) {
  const label = court.name
    ? `Court ${court.court_number} · ${court.name}`
    : `Court ${court.court_number}`;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
        <CourtStatusBadge status={court.status} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {court.match ? (
          <MatchBody
            sessionId={sessionId}
            match={court.match}
            canManage={canManage}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {court.status === "disabled"
              ? "Out of service."
              : "Free — pick a lineup for this court."}
          </p>
        )}

        {canManage ? <CourtActions court={court} /> : null}
      </CardContent>
    </Card>
  );
}

function CourtStatusBadge({ status }: { status: CourtView["status"] }) {
  switch (status) {
    case "playing":
      return <Badge>playing</Badge>;
    case "staged":
      return <Badge variant="secondary">staged</Badge>;
    case "disabled":
      return <Badge variant="outline">out of service</Badge>;
    default:
      return <Badge variant="outline">available</Badge>;
  }
}

function MatchBody({
  sessionId,
  match,
  canManage,
}: {
  sessionId: string;
  match: MatchWithPlayers;
  canManage: boolean;
}) {
  const team1 = match.players.filter((p) => p.team_number === 1);
  const team2 = match.players.filter((p) => p.team_number === 2);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {match.display_name?.trim() || `Match ${match.match_number}`}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <TeamList players={team1} align="right" />
        <div className="flex flex-col items-center px-1">
          {match.status === "completed" || match.status === "playing" ? (
            <span className="text-sm font-semibold tabular-nums">
              {match.team1_score ?? 0}–{match.team2_score ?? 0}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">vs</span>
          )}
        </div>
        <TeamList players={team2} align="left" />
      </div>

      {match.explanation ? (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {match.explanation}
        </p>
      ) : null}

      {/* The clock is derived from matches.started_at / completed_at rather than
          component state, so it survives a refresh and reads the same on every
          device watching this session. */}
      <MatchTimerLabeled
        startedAt={match.started_at}
        completedAt={match.completed_at}
        status={match.status === "playing" ? "playing" : "staged"}
      />

      {canManage ? <MatchActions sessionId={sessionId} match={match} /> : null}
    </div>
  );
}

function TeamList({
  players,
  align,
}: {
  players: MatchWithPlayers["players"];
  align: "left" | "right";
}) {
  if (players.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <ul
      className={
        "flex flex-col gap-1 " +
        (align === "right" ? "items-end" : "items-start")
      }
    >
      {players.map((player) => (
        <li key={player.id} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold"
          >
            {initialsOf(player.display_name ?? "?")}
          </span>
          {player.display_name ?? "Unknown"}
        </li>
      ))}
    </ul>
  );
}

function MatchActions({
  sessionId,
  match,
}: {
  sessionId: string;
  match: MatchWithPlayers;
}) {
  const [start, startAction] = useActionState<ActionState, FormData>(
    startMatchAction,
    idleState,
  );
  const [cancel, cancelAction] = useActionState<ActionState, FormData>(
    cancelLineupFormAction,
    idleState,
  );
  const [showScore, setShowScore] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {match.status === "staged" ? (
        <>
          <form
            action={startAction}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <FormError state={start} />
            <SubmitButton pendingLabel="Starting…" size="sm">
              <Play className="mr-2 size-3.5" aria-hidden />
              Start game
            </SubmitButton>
          </form>

          <form
            action={cancelAction}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <FormError state={cancel} />
            <SubmitButton pendingLabel="Cancelling…" size="sm" variant="ghost">
              <CircleSlash className="mr-2 size-3.5" aria-hidden />
              Cancel lineup
            </SubmitButton>
          </form>
        </>
      ) : null}

      {match.status === "playing" ? (
        <>
          <RunningScoreForm sessionId={sessionId} match={match} />
          {showScore ? (
            <ScoreForm
              sessionId={sessionId}
              match={match}
              onDone={() => setShowScore(false)}
            />
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowScore(true)}
              className="self-start"
            >
              <Trophy className="mr-2 size-3.5" aria-hidden />
              Record score
            </Button>
          )}

          <form
            action={cancelAction}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="sessionId" value={sessionId} />
            <FormError state={cancel} />
            <SubmitButton pendingLabel="Cancelling…" size="sm" variant="ghost">
              <CircleSlash className="mr-2 size-3.5" aria-hidden />
              Abort game
            </SubmitButton>
          </form>
        </>
      ) : null}

      {match.status === "completed"
        ? showCorrection
          ? (
            <CorrectionForm
              sessionId={sessionId}
              match={match}
              onDone={() => setShowCorrection(false)}
            />
          )
          : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowCorrection(true)}
              className="self-start"
            >
              <Pencil className="mr-2 size-3.5" aria-hidden />
              Correct score
            </Button>
          )
        : null}
    </div>
  );
}

function RunningScoreForm({
  sessionId,
  match,
}: {
  sessionId: string;
  match: MatchWithPlayers;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateRunningScoreAction,
    idleState,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="flex items-center gap-2">
        <Label htmlFor={`live-t1-${match.id}`} className="sr-only">
          Team 1 live score
        </Label>
        <Input
          id={`live-t1-${match.id}`}
          name="team1Score"
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          defaultValue={match.team1_score ?? 0}
          className="h-8 w-16 text-center tabular-nums"
          required
        />
        <span aria-hidden className="text-muted-foreground">–</span>
        <Label htmlFor={`live-t2-${match.id}`} className="sr-only">
          Team 2 live score
        </Label>
        <Input
          id={`live-t2-${match.id}`}
          name="team2Score"
          type="number"
          min={0}
          max={99}
          inputMode="numeric"
          defaultValue={match.team2_score ?? 0}
          className="h-8 w-16 text-center tabular-nums"
          required
        />
      </div>
      <SubmitButton pendingLabel="Updating…" size="sm" variant="outline">
        Update live score
      </SubmitButton>
      <FormError state={state} />
    </form>
  );
}

/**
 * Fixes a score that was entered on the wrong team. The RPC writes an audit
 * row and reverses the standings impact, so this needs a reason.
 */
function CorrectionForm({
  sessionId,
  match,
  onDone,
}: {
  sessionId: string;
  match: MatchWithPlayers;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    correctScoreAction,
    idleState,
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-md border border-border p-3"
    >
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormError state={state} />

      <p className="text-sm font-medium">Correct to</p>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ct1-${match.id}`}>Team 1</Label>
          <Input
            id={`ct1-${match.id}`}
            name="team1Score"
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            defaultValue={match.team1_score ?? 0}
            required
            className="text-center text-lg font-semibold tabular-nums"
          />
        </div>
        <span className="pb-2 text-muted-foreground">–</span>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ct2-${match.id}`}>Team 2</Label>
          <Input
            id={`ct2-${match.id}`}
            name="team2Score"
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            defaultValue={match.team2_score ?? 0}
            required
            className="text-center text-lg font-semibold tabular-nums"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`reason-${match.id}`}>Reason</Label>
        <Textarea
          id={`reason-${match.id}`}
          name="reason"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          placeholder="Scores were entered on the wrong team"
        />
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…" size="sm">
          Save correction
        </SubmitButton>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={state.ok}
        >
          Close
        </Button>
      </div>
    </form>
  );
}

function ScoreForm({
  sessionId,
  match,
  onDone,
}: {
  sessionId: string;
  match: MatchWithPlayers;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    completeMatchAction,
    idleState,
  );

  const team1 = match.players.filter((p) => p.team_number === 1);
  const team2 = match.players.filter((p) => p.team_number === 2);
  const shortName = (name: string | undefined) =>
    (name ?? "Player").split(" ")[0];
  const team1Name = team1.map((p) => shortName(p.display_name)).join(" & ");
  const team2Name = team2.map((p) => shortName(p.display_name)).join(" & ");

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-md border border-border p-3"
    >
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormError state={state} />

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`t1-${match.id}`}>{team1Name || "Team 1"}</Label>
          <Input
            id={`t1-${match.id}`}
            name="team1Score"
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            defaultValue={0}
            required
            className="text-center text-lg font-semibold tabular-nums"
          />
        </div>
        <span className="pb-2 text-muted-foreground">–</span>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`t2-${match.id}`}>{team2Name || "Team 2"}</Label>
          <Input
            id={`t2-${match.id}`}
            name="team2Score"
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            defaultValue={0}
            required
            className="text-center text-lg font-semibold tabular-nums"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <SubmitButton pendingLabel="Saving…" size="sm">
          Save result
        </SubmitButton>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDone}
          disabled={state.ok}
        >
          Close
        </Button>
      </div>
    </form>
  );
}

function CourtActions({ court }: { court: CourtView }) {
  const [state, action] = useActionState<ActionState, FormData>(
    setCourtStatusAction,
    idleState,
  );
  const busy = court.status === "staged" || court.status === "playing";

  return (
    <form
      action={action}
      className="flex items-center gap-2 border-t border-border pt-3"
    >
      <input type="hidden" name="courtId" value={court.id} />
      <FormError state={state} />
      {busy ? (
        <p className="text-xs text-muted-foreground">
          Court is in use for this game.
        </p>
      ) : court.status === "disabled" ? (
        <>
          <input type="hidden" name="status" value="available" />
          <SubmitButton pendingLabel="Saving…" size="sm" variant="ghost">
            Put back in service
          </SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="status" value="disabled" />
          <SubmitButton
            pendingLabel="Saving…"
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
          >
            <Ban className="mr-2 size-3.5" aria-hidden />
            Take out of service
          </SubmitButton>
        </>
      )}
    </form>
  );
}
