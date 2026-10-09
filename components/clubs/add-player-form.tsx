"use client";

import { useActionState, useEffect, useRef } from "react";

import { createPlayerAction } from "@/app/actions/session-actions";
import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";

import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SKILL_LABELS: Record<number, string> = {
  1: "1 · Beginner",
  2: "2 · Improving",
  3: "3 · Intermediate",
  4: "4 · Advanced",
  5: "5 · Competitive",
  6: "6 · Tournament",
};

interface AddPlayerFormProps {
  clubId: string;
}

export function AddPlayerForm({ clubId }: AddPlayerFormProps) {
  const [state, action] = useActionState<ActionState, FormData>(
    createPlayerAction,
    idleState,
  );

  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after successfully adding a player.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="clubId" value={clubId} />

      <FormError state={state} />

      <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">Name</Label>

          <Input
            id="displayName"
            name="displayName"
            required
            maxLength={80}
            placeholder="Alex Chen"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="skillLevel">Skill level</Label>

          <select
            id="skillLevel"
            name="skillLevel"
            defaultValue="3"
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
          <Label htmlFor="division">Division (optional)</Label>

          <Input
            id="division"
            name="division"
            maxLength={40}
            placeholder="3.0 mixed"
            className="sm:w-36"
          />
        </div>
      </div>

      <div>
        <SubmitButton pendingLabel="Adding…" size="sm">
          Add player
        </SubmitButton>
      </div>
    </form>
  );
}