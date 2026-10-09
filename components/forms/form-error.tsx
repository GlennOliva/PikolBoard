import { AlertCircle } from "lucide-react";
import type { ActionState } from "@/app/actions/session-action-state";

/**
 * Renders the error text from a server action. Postgres raises exceptions with
 * a useful message ("Only organizers can start a session"), so the action
 * passes the RPC text straight through and we show it as-is.
 */
export function FormError({ state }: { state: ActionState }) {
  if (!state.error) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{state.error}</span>
    </p>
  );
}
