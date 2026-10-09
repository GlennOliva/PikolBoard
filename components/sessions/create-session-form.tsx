"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSessionAction } from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";

const FORMATS = [
  { value: "doubles", label: "Doubles (4 players)" },
  { value: "singles", label: "Singles (2 players)" },
] as const;

const MODES = [
  {
    value: "balanced",
    label: "Balanced",
    hint: "Best mix of skill, fairness, and turn-taking across courts.",
  },
  {
    value: "fifo",
    label: "First in, first out",
    hint: "Strict queue order, skipping only players who cannot play yet.",
  },
  {
    value: "skill_separated",
    label: "Skill separated",
    hint: "Group similar skill levels together, rotate the top players.",
  },
] as const;

const SCORES = [11, 15, 21];
const WIN_BY = [2, 3];

export function CreateSessionForm({ clubId }: { clubId: string }) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(
    createSessionAction,
    idleState,
  );
  const [format, setFormat] = useState<string>("doubles");
  const [mode, setMode] = useState<string>("balanced");

  useEffect(() => {
    if (state.ok && state.id) router.push(`/sessions/${state.id}`);
  }, [state, router]);

  const modeHint = MODES.find((m) => m.value === mode)?.hint;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="clubId" value={clubId} />
      <FormError state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Session name</Label>
          <Input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue="Thursday open play"
            placeholder="Thursday open play"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="format">Format</Label>
          <select
            id="format"
            name="format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="matchingMode">Matchmaking</Label>
        <select
          id="matchingMode"
          name="matchingMode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {modeHint ? (
          <p className="text-xs text-muted-foreground">{modeHint}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="targetScore">Play to</Label>
          <select
            id="targetScore"
            name="targetScore"
            defaultValue="11"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {SCORES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="winBy">Win by</Label>
          <select
            id="winBy"
            name="winBy"
            defaultValue="2"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {WIN_BY.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="courtCount">Courts</Label>
          <Input
            id="courtCount"
            name="courtCount"
            type="number"
            min={1}
            max={12}
            defaultValue={4}
            required
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
            defaultValue={15}
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="maxGames">Max games per player (optional)</Label>
        <Input
          id="maxGames"
          name="maxGames"
          type="number"
          min={0}
          max={100}
          placeholder="Leave empty for no cap"
          className="sm:max-w-40"
        />
        <p className="text-xs text-muted-foreground">
          When someone hits the cap they stay checked in but stop being proposed
          until the session is updated.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublic"
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          Publish a shareable live board for this session. You can turn it on
          later from session settings.
        </span>
      </label>

      <div>
        <SubmitButton pendingLabel="Creating…">Create session</SubmitButton>
      </div>
    </form>
  );
}
