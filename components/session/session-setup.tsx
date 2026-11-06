"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { startSessionAction } from "@/app/actions/session-actions";
import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Session, SessionPlayer } from "@/lib/db/types";
import { needsCheckIn } from "@/lib/domain/queue/attendance";

export function SessionSetup({
  session,
  roster,
}: {
  session: Pick<Session, "id" | "format" | "court_count" | "status">;
  roster: SessionPlayer[];
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(
    startSessionAction,
    idleState,
  );
  const [browserOrigin, setBrowserOrigin] = useState("");

  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const requiredPlayers = session.format === "singles" ? 2 : 4;
  const checkedIn = roster.filter(
    (player) => !needsCheckIn(player.attendance_status),
  ).length;
  const ready =
    roster.length >= requiredPlayers && checkedIn >= requiredPlayers;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Session setup</CardTitle>
        <CardDescription>
          Check people in, then start the session when the group is ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="On roster" value={roster.length} />
          <Stat label="Checked in" value={checkedIn} />
          <Stat label="Per match" value={requiredPlayers} />
          <Stat label="Courts" value={session.court_count} />
        </dl>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{
              width: `${Math.min(100, (checkedIn / requiredPlayers) * 100)}%`,
            }}
            role="progressbar"
            aria-label="Checked-in players"
            aria-valuemin={0}
            aria-valuemax={requiredPlayers}
            aria-valuenow={Math.min(checkedIn, requiredPlayers)}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {ready
            ? "There are enough checked-in players for every court to start a game."
            : `Check in at least ${requiredPlayers} players for a ${session.format} game.`}
        </p>

        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="sessionId" value={session.id} />
          <input type="hidden" name="browserOrigin" value={browserOrigin} />
          <FormError state={state} />
          <SubmitButton pendingLabel="Starting…">
            <PlayCircle className="mr-2 size-4" aria-hidden />
            Start session
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
