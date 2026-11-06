"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { endSessionAction } from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";

/**
 * End-session control. Starting lives in the setup card beside the roster, so
 * the organizer does not see two competing Start buttons.
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
  const [end, endAction] = useActionState<ActionState, FormData>(
    endSessionAction,
    idleState,
  );
  const [confirmEnd, setConfirmEnd] = useState(false);

  // The action revalidates this path; refresh the router too so the ladder and
  // queue repaint without a full page load.
  useEffect(() => {
    if (end.ok) router.refresh();
  }, [end, router]);

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
        <p className="text-sm text-muted-foreground">
          Add the roster below, then start the session.
        </p>
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
