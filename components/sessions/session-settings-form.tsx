"use client";

import { useActionState } from "react";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSessionAction } from "@/app/actions/session-actions";

import type { ActionState } from "@/app/actions/session-action-state";

/**
 * Session settings. All of it goes through update_session, which re-locks the
 * session and validates before widening the court count or turning on the
 * public board — so the form does not have to guess whether it is allowed.
 */
export function SessionSettingsForm({
  sessionId,
  name,
  courtCount,
  maxGames,
  starvationMinutes,
  isPublic,
  resultsPublished,
  canManage,
}: {
  sessionId: string;
  name: string;
  courtCount: number;
  maxGames: number | null;
  starvationMinutes: number;
  isPublic: boolean;
  resultsPublished: boolean;
  canManage: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    updateSessionAction,
    { error: null, ok: false },
  );

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Only club organizers can change session settings.
      </p>
    );
  }

  return (
    <form action={action} className="flex max-w-xl flex-col gap-5">
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormError state={state} />
      {state.ok ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Session name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={name}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="courtCount">Courts</Label>
          <Input
            id="courtCount"
            name="courtCount"
            type="number"
            min={1}
            max={12}
            defaultValue={courtCount}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxGames">Max games per player</Label>
          <Input
            id="maxGames"
            name="maxGames"
            type="number"
            min={0}
            max={100}
            defaultValue={maxGames ?? ""}
            placeholder="No cap"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="starvationMinutes">Starve after (min)</Label>
          <Input
            id="starvationMinutes"
            name="starvationMinutes"
            type="number"
            min={1}
            max={120}
            defaultValue={starvationMinutes}
            required
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Adding courts is allowed at any time; the extra courts start as
        available. Lowering the count keeps the highest-numbered courts, and
        refuses if one of them is mid-game.
      </p>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={isPublic}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          Publish a public live board. Anyone with the link can see courts and
          standings.
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="resultsPublished"
          defaultChecked={resultsPublished}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          Publish final results on the public board. Turn this on when the
          session is over.
        </span>
      </label>

      <div>
        <SubmitButton pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  );
}
