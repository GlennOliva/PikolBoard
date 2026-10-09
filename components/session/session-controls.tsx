"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  endSessionAction,
  startSessionAction,
} from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";

/**
 * Start/end controls. The session is created in draft, so the organizer
 * explicitly starts it once the roster is in; ending is destructive enough to
 * ask for confirmation in the UI.
 */
export function SessionControls({
  sessionId,
  status,
  canManage,
}: {
  sessionId: string;
  status: "draft" | "active" | "completed" | "cancelled";
  canManage: boolean;
}) {
  const router = useRouter();
  const [start, startAction] = useActionState<ActionState, FormData>(
    startSessionAction,
    idleState,
  );
  const [end, endAction] = useActionState<ActionState, FormData>(
    endSessionAction,
    idleState,
  );
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [browserOrigin, setBrowserOrigin] = useState("");

  // The server cannot know which address the organizer is looking at, so it
  // needs the browser origin to build a scannable link. This is the same value
  // the QR dialog prefers as a fallback, which keeps one set of rules for what
  // counts as a reachable URL.
  useEffect(() => {
    setBrowserOrigin(window.location.origin);
  }, []);

  // The actions revalidate this path; refresh the router too so the ladder and
  // queue repaint without a full page load.
  useEffect(() => {
    if (start.ok || end.ok) router.refresh();
  }, [start, end, router]);

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        {status === "active"
          ? "This session is live. Only organizers can change it."
          : "Only organizers can start or end this session."}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "draft" ? (
        <form action={startAction} className="flex items-center gap-2">
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="browserOrigin" value={browserOrigin} />
          <FormError state={start} />
          <SubmitButton pendingLabel="Starting…">Start session</SubmitButton>
        </form>
      ) : null}

      {status === "active" ? (
        <form action={endAction} className="flex items-center gap-2">
          <input type="hidden" name="sessionId" value={sessionId} />
          <FormError state={end} />
          {confirmEnd ? (
            <>
              <span className="text-sm text-muted-foreground">
                End the session for everyone?
              </span>
              <input type="hidden" name="force" value="on" />
              <SubmitButton
                pendingLabel="Ending…"
                variant="destructive"
                size="sm"
              >
                Yes, end it
              </SubmitButton>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmEnd(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirmEnd(true)}
            >
              End session
            </Button>
          )}
        </form>
      ) : null}

      {status === "completed" || status === "cancelled" ? (
        <p className="text-sm text-muted-foreground">
          This session is {status}.
        </p>
      ) : null}

      {status === "active" ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Radio className="size-3" aria-hidden />
          Session is Live
        </span>
      ) : null}
    </div>
  );
}
