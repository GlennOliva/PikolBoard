import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Thrown when a read or write fails so screens can render a real message
 * instead of an empty state. Mirrors the web app's DataError.
 */
export class DataError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "DataError";
    this.hint = hint;
  }
}

/** Turns a PostgREST error into a DataError, or passes when there is none. */
export function fail(error: PostgrestError | null): void {
  if (error) throw new DataError(error.message, error.details ?? undefined);
}

/** A message safe to show a user for any thrown value. */
export function messageFrom(error: unknown): string {
  if (error instanceof DataError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
