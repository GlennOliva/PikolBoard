"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import {
  createClubAction,
} from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";

/** Slugs end up in the public URL, so offer a suggestion as they type. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function CreateClubForm() {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(
    createClubAction,
    idleState,
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  // The action returns the new club id; go straight to it.
  useEffect(() => {
    if (state.ok && state.id) router.push(`/clubs/${state.id}`);
  }, [state, router]);

  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <FormError state={state} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Club name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Harbour Pickleball Club"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Share link</Label>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-muted-foreground">/c/</span>
          <Input
            id="slug"
            name="slug"
            required
            minLength={2}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="harbour-club"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and dashes. This is the link you share
          with spectators.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location (optional)</Label>
        <Input
          id="location"
          name="location"
          maxLength={160}
          placeholder="Harbour Park, Pier 4"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          name="timezone"
          defaultValue="UTC"
          required
          maxLength={64}
          placeholder="America/Vancouver"
        />
        <p className="text-xs text-muted-foreground">
          Used for session start times on the public board.
        </p>
      </div>

      <div>
        <SubmitButton pendingLabel="Creating…">Create club</SubmitButton>
      </div>
    </form>
  );
}
