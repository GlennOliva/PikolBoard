"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import {
  addPlayersToSessionAction,
  createSessionPlayerAction,
} from "@/app/actions/session-actions";
import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Player } from "@/lib/db/types";

const SKILL_LABELS: Record<number, string> = {
  1: "1 · Beginner",
  2: "2 · Improving",
  3: "3 · Intermediate",
  4: "4 · Advanced",
  5: "5 · Competitive",
  6: "6 · Tournament",
};

type AvailablePlayer = Pick<
  Player,
  "id" | "display_name" | "skill_level" | "division"
>;

export function AddPlayersDialog({
  sessionId,
  availablePlayers,
}: {
  sessionId: string;
  availablePlayers: AvailablePlayer[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-2 size-4" aria-hidden />
          Add players
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add players</DialogTitle>
          <DialogDescription>
            Add people from the club roster or create somebody new. New names
            stay on the club roster for future sessions.
          </DialogDescription>
        </DialogHeader>

        <ExistingPlayersForm
          sessionId={sessionId}
          availablePlayers={availablePlayers}
          onAdded={() => setOpen(false)}
        />

        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or create a new player
          <span className="h-px flex-1 bg-border" />
        </div>

        <CreatePlayerForm
          sessionId={sessionId}
          onAdded={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ExistingPlayersForm({
  sessionId,
  availablePlayers,
  onAdded,
}: {
  sessionId: string;
  availablePlayers: AvailablePlayer[];
  onAdded: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    addPlayersToSessionAction,
    idleState,
  );
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (state.ok) onAdded();
  }, [state, onAdded]);

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? availablePlayers.filter((player) =>
        `${player.display_name} ${player.division ?? ""}`
          .toLowerCase()
          .includes(needle),
      )
    : availablePlayers;

  if (availablePlayers.length === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Everyone on the active club roster is already in this session.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormError state={state} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="session-player-filter">Find on the club roster</Label>
        <Input
          id="session-player-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search by name or division"
          autoComplete="off"
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
        {visible.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">No matches.</p>
        ) : (
          <ul className="flex flex-col">
            {visible.map((player) => (
              <li key={player.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                  <Checkbox
                    id={`session-add-${player.id}`}
                    name="playerIds"
                    value={player.id}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {player.display_name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Level {player.skill_level}
                      {player.division ? ` · ${player.division}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id="add-existing-check-in" name="checkIn" defaultChecked />
        Check them in and add them to the queue now
      </label>

      <div>
        <SubmitButton pendingLabel="Adding…" size="sm">
          Add selected players
        </SubmitButton>
      </div>
    </form>
  );
}

function CreatePlayerForm({
  sessionId,
  onAdded,
}: {
  sessionId: string;
  onAdded: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    createSessionPlayerAction,
    idleState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onAdded();
    }
  }, [state, onAdded]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <FormError state={state} />

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="session-new-player-name">Name</Label>
          <Input
            id="session-new-player-name"
            name="displayName"
            required
            maxLength={60}
            placeholder="Alex Chen"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="session-new-player-skill">Skill level</Label>
          <select
            id="session-new-player-skill"
            name="skillLevel"
            defaultValue="3"
            className="retro-select"
          >
            {Object.entries(SKILL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="session-new-player-division">Division (optional)</Label>
        <Input
          id="session-new-player-division"
          name="division"
          maxLength={40}
          placeholder="3.0 mixed"
          autoComplete="off"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox id="add-new-check-in" name="checkIn" defaultChecked />
        Check them in and add them to the queue now
      </label>

      <div>
        <SubmitButton pendingLabel="Creating…" size="sm">
          Create and add player
        </SubmitButton>
      </div>
    </form>
  );
}
