import type { AttendanceStatus } from "@/lib/db/types";

export const DEFAULT_MATCH_MINUTES = 15;

/** Whole-minute estimate for the queue position, spread across usable courts. */
export function estimatedWaitMinutes({
  queuePosition,
  courtCount,
  averageMatchMinutes,
}: {
  queuePosition: number | null;
  courtCount: number;
  averageMatchMinutes: number | null;
}): number | null {
  if (queuePosition == null || queuePosition < 1) return null;
  const courts = Math.max(1, courtCount);
  const matchMinutes =
    averageMatchMinutes && averageMatchMinutes > 0
      ? averageMatchMinutes
      : DEFAULT_MATCH_MINUTES;
  return Math.max(1, Math.ceil(queuePosition / courts) * matchMinutes);
}

export function formatEstimatedWait(minutes: number | null): string {
  return minutes == null ? "—" : `About ${minutes} min`;
}

export function waitingDurationMs(
  lastEnqueuedAt: string | null,
  checkedInAt: string | null,
  nowMs: number,
): number | null {
  const timestamp = lastEnqueuedAt ?? checkedInAt;
  if (!timestamp) return null;
  const start = Date.parse(timestamp);
  if (!Number.isFinite(start)) return null;
  return Math.max(0, nowMs - start);
}

export function formatWaitingTime(ms: number | null): string {
  if (ms == null) return "—";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function attendanceLabel(status: AttendanceStatus): string {
  switch (status) {
    case "staged":
      return "Up Next";
    case "playing":
      return "Playing";
    case "break":
      return "On Break";
    case "checked_out":
      return "Checked Out";
    case "finished":
      return "Finished";
    default:
      return "Waiting";
  }
}
