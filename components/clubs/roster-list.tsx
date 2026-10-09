"use client";

import { useActionState, useEffect, useState } from "react";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archivePlayerAction,
  updatePlayerAction,
} from "@/app/actions/session-actions";

import type { ActionState } from "@/app/actions/session-action-state";
import { Button } from "@/components/ui/button";
import { initialsOf } from "@/lib/format";
import type { Player } from "@/lib/db/types";

const SKILL_LABELS: Record<number, string> = {
  1: "1 · Beginner",
  2: "2 · Improving",
  3: "3 · Intermediate",
  4: "4 · Advanced",
  5: "5 · Competitive",
  6: "6 · Tournament",
};

/**
 * One row per player with inline edit. Editing in place beats a separate edit
 * page when the roster is a couple of dozen names and you are fixing a typo.
 *
 * `editable` is a UX hint only: the update/archive RPCs re-check the caller's
 * role, so a forged form submission still fails.
 */
export function RosterList({
  players,
  editable = false,
}: {
  players: Player[];
  editable?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {players.map((player) => (
        <RosterRow key={player.id} player={player} editable={editable} />
      ))}
    </ul>
  );
}

function RosterRow({ player, editable }: { player: Player; editable: boolean }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="p-4">
        <EditPlayerForm player={player} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li
      className={
        "flex flex-wrap items-center gap-3 px-4 py-3 " +
        (player.is_active ? "" : "opacity-60")
      }
    >
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold"
      >
        {initialsOf(player.display_name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{player.display_name}</p>
        <p className="text-sm text-muted-foreground">
          Level {player.skill_level}
          {player.division ? ` · ${player.division}` : ""}
          {player.is_active ? "" : " · archived"}
        </p>
      </div>
      {editable ? (
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
      ) : null}
    </li>
  );
}

function EditPlayerForm({
  player,
  onDone,
}: {
  player: Player;
  onDone: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updatePlayerAction,
    { error: null, ok: false },
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="playerId" value={player.id} />
      <input
        type="hidden"
        name="isActive"
        value={player.is_active ? "false" : "true"}
      />
      <FormError state={state} />

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`name-${player.id}`}>Name</Label>
          <Input
            id={`name-${player.id}`}
            name="displayName"
            required
            maxLength={80}
            defaultValue={player.display_name}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`skill-${player.id}`}>Skill level</Label>
          <select
            id={`skill-${player.id}`}
            name="skillLevel"
            defaultValue={String(player.skill_level)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {Object.entries(SKILL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`division-${player.id}`}>Division</Label>
          <Input
            id={`division-${player.id}`}
            name="division"
            maxLength={40}
            defaultValue={player.division ?? ""}
            className="sm:w-36"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Saving…" size="sm">
          Save
        </SubmitButton>
        <Button size="sm" variant="ghost" onClick={onDone} type="button">
          Cancel
        </Button>
        <ArchiveButton playerId={player.id} />
      </div>
    </form>
  );
}

/**
 * Archiving keeps the player's history intact, so it needs its own pending
 * state instead of sharing the edit form's useActionState.
 */
function ArchiveButton({ playerId }: { playerId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(
    archivePlayerAction,
    { error: null, ok: false },
  );

  return (
    <form action={action} className="ml-auto">
      <input type="hidden" name="playerId" value={playerId} />
      {state.error ? (
        <span role="alert" className="mr-2 text-sm text-destructive">
          {state.error}
        </span>
      ) : null}
      <SubmitButton pendingLabel="Archiving…" size="sm" variant="outline">
        Archive
      </SubmitButton>
    </form>
  );
}
