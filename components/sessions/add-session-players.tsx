"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSessionPlayersAction } from "@/app/actions/session-actions";

import type { ActionState } from "@/app/actions/session-action-state";

/**
 * Adds a batch of roster players to one session. A session is created before
 * the roster is known, so the organizer picks people here rather than during
 * session creation.
 */
export function AddSessionPlayers({
  clubId,
  players,
  sessions,
}: {
  clubId: string;
  players: Array<{ id: string; display_name: string }>;
  sessions: Array<{ id: string; name: string; status: string }>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    addSessionPlayersAction,
    { error: null, ok: false },
  );
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      if (listRef.current) {
        for (const box of listRef.current.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"]',
        )) {
          box.checked = false;
        }
      }
    }
  }, [state]);

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Create a session first, then add players to it.
      </p>
    );
  }

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? players.filter((p) => p.display_name.toLowerCase().includes(needle))
    : players;

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="clubId" value={clubId} />
      <FormError state={state} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="sessionId">Session</Label>
        <select
          id="sessionId"
          name="sessionId"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-xs"
        >
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.status})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="playerFilter">Filter</Label>
        <Input
          id="playerFilter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Type a name"
          className="sm:max-w-xs"
          autoComplete="off"
        />
      </div>

      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto rounded-md border border-border p-2"
      >
        {visible.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No matches.</p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((player) => (
              <li key={player.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                  <Checkbox
                    id={`add-${player.id}`}
                    name="playerIds"
                    value={player.id}
                  />
                  <span className="text-sm">{player.display_name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SubmitButton pendingLabel="Adding…" size="sm">
          Add to session
        </SubmitButton>
      </div>
    </form>
  );
}
