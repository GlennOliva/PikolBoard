import type { Session } from "@/lib/db/types";

/**
 * Formatting helpers shared by the dashboard, club, session, and public pages.
 * Kept dependency-free and locale-stable so server and client render the same
 * string and React does not warn about a hydration mismatch.
 */

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

const TIME_ONLY = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

/** Timestamps are stored and displayed in UTC to keep every client in sync. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_TIME.format(date);
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return TIME_ONLY.format(date);
}

export function formatSessionWindow(session: Session): string {
  const start = formatTime(session.started_at);
  const end = formatTime(session.ended_at);
  if (session.started_at && session.ended_at) return `${start} – ${end} UTC`;
  if (session.started_at) return `Started ${start} UTC`;
  return "Not started yet";
}

/** "7 min" / "42 s" for queue waits and match durations. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "—";
  if (minutes < 1) {
    const seconds = Math.max(0, Math.round(minutes * 60));
    return seconds === 1 ? "1 s" : `${seconds} s`;
  }
  const rounded = Math.round(minutes);
  return rounded === 1 ? "1 min" : `${rounded} min`;
}

/** Initials for the avatar circles in the queue and court cards. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
