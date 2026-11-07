"use client";

import { useActionState, useEffect, useState } from "react";
import { Link2, Unlink } from "lucide-react";
import {
  createPartnerLockAction,
  releasePartnerLockAction,
} from "@/app/actions/session-actions";
import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  MatchWithPlayers,
  PartnerLock,
  SessionPlayer,
} from "@/lib/db/queries";
import {
  averageSkill,
  eligibleLockPlayers,
  unresolvedPlayerIds,
} from "@/lib/domain/session/partner-locks";

export function PartnerLocksPanel({
  sessionId,
  roster,
  matches,
  locks,
  canManage,
}: {
  sessionId: string;
  roster: SessionPlayer[];
  matches: MatchWithPlayers[];
  locks: PartnerLock[];
  canManage: boolean;
}) {
  const eligible = eligibleLockPlayers(roster, matches, locks);
  const rosterByPlayer = new Map(
    roster.map((player) => [player.player_id, player]),
  );
  const reserved = unresolvedPlayerIds(matches);

  return (
    <Card className="retro-preparing">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4 text-pikol-purple" aria-hidden />
            Partner locks
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Locked partners enter doubles lineups together on the same team.
          </p>
        </div>
        <Badge variant="preparing">
          {locks.length} active
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {locks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-background/35 px-3 py-4 text-sm text-muted-foreground">
            No active partner locks. Unlocked players rotate normally.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border bg-background/35">
            {locks.map((lock) => {
              const playerA = rosterByPlayer.get(lock.player_a_id);
              const playerB = rosterByPlayer.get(lock.player_b_id);
              const ready =
                playerA?.attendance_status === "waiting" &&
                playerA.queue_position !== null &&
                playerB?.attendance_status === "waiting" &&
                playerB.queue_position !== null;
              const inLineup =
                reserved.has(lock.player_a_id) &&
                reserved.has(lock.player_b_id);

              return (
                <li
                  key={lock.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-3"
                >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-md border border-pikol-purple/40 bg-pikol-purple/10 text-pikol-purple"
                  aria-hidden
                >
                  <Link2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {lock.player_a_name} + {lock.player_b_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Levels {lock.player_a_skill} + {lock.player_b_skill} · average {averageSkill(lock.player_a_skill, lock.player_b_skill)}
                  </p>
                  <p className="mt-1 text-xs font-medium text-pikol-purple">
                    {ready
                      ? "Ready to enter the next valid lineup together"
                      : inLineup
                        ? "Reserved in a lineup together"
                      : "Waiting for partner to check in"}
                  </p>
                </div>
                {canManage ? (
                  <UnlockButton sessionId={sessionId} lock={lock} />
                ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {canManage ? (
          <CreatePartnerLockDialog
            sessionId={sessionId}
            eligible={eligible}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function CreatePartnerLockDialog({
  sessionId,
  eligible,
}: {
  sessionId: string;
  eligible: SessionPlayer[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={eligible.length < 2}
        >
          <Link2 className="mr-2 size-4" aria-hidden />
          Lock a pair
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create partner lock</DialogTitle>
          <DialogDescription>
            Choose two waiting players. Review the pair, then confirm that they
            should always be selected together on the same team.
          </DialogDescription>
        </DialogHeader>
        <CreatePartnerLockForm
          sessionId={sessionId}
          eligible={eligible}
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CreatePartnerLockForm({
  sessionId,
  eligible,
  onCreated,
}: {
  sessionId: string;
  eligible: SessionPlayer[];
  onCreated: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createPartnerLockAction,
    idleState,
  );
  const [playerAId, setPlayerAId] = useState("");
  const [playerBId, setPlayerBId] = useState("");

  useEffect(() => {
    if (state.ok) onCreated();
  }, [state.ok, onCreated]);

  const playerA = eligible.find((player) => player.player_id === playerAId);
  const playerB = eligible.find((player) => player.player_id === playerBId);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormError state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="partner-lock-player-a">Player A</Label>
          <select
            id="partner-lock-player-a"
            name="playerAId"
            className="retro-select"
            value={playerAId}
            required
            onChange={(event) => {
              const next = event.target.value;
              setPlayerAId(next);
              if (next === playerBId) setPlayerBId("");
            }}
          >
            <option value="">Choose player</option>
            {eligible.map((player) => (
              <option key={player.player_id} value={player.player_id}>
                {player.display_name} · Level {player.skill_level}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="partner-lock-player-b">Player B</Label>
          <select
            id="partner-lock-player-b"
            name="playerBId"
            className="retro-select"
            value={playerBId}
            required
            onChange={(event) => setPlayerBId(event.target.value)}
          >
            <option value="">Choose player</option>
            {eligible
              .filter((player) => player.player_id !== playerAId)
              .map((player) => (
                <option key={player.player_id} value={player.player_id}>
                  {player.display_name} · Level {player.skill_level}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div
        className="rounded-lg border border-pikol-purple/35 bg-pikol-purple/10 px-4 py-3"
        aria-live="polite"
      >
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-pikol-purple">
          Pair review
        </p>
        {playerA && playerB ? (
          <>
            <p className="mt-1 text-sm font-semibold">
              {playerA.display_name} + {playerB.display_name}
            </p>
            <p className="text-xs text-muted-foreground">
              Combined level {playerA.skill_level + playerB.skill_level} · average {averageSkill(playerA.skill_level, playerB.skill_level)}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Select both players to review this lock.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCreated}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Locking partners…">
          <Link2 className="mr-2 size-4" aria-hidden />
          Confirm partner lock
        </SubmitButton>
      </div>
    </form>
  );
}

function UnlockButton({
  sessionId,
  lock,
}: {
  sessionId: string;
  lock: PartnerLock;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    releasePartnerLockAction,
    idleState,
  );

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Unlock ${lock.player_a_name} and ${lock.player_b_name}? They will rotate independently again.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="lockId" value={lock.id} />
      {state.error ? (
        <span role="alert" className="mr-2 text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      <SubmitButton
        pendingLabel="Unlocking…"
        size="sm"
        variant="ghost"
      >
        <Unlink className="mr-1.5 size-3.5" aria-hidden />
        Unlock
      </SubmitButton>
    </form>
  );
}
