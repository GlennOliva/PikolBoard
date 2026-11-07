// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CourtCard, type CourtView } from "./court-card";
import type { MatchWithPlayers } from "@/lib/db/queries";

vi.mock("@/app/actions/lineup-actions", () => ({
  cancelLineupFormAction: vi.fn(),
}));

vi.mock("@/app/actions/session-actions", () => ({
  completeMatchAction: vi.fn(),
  correctScoreAction: vi.fn(),
  setCourtStatusAction: vi.fn(),
  startMatchAction: vi.fn(),
  updateRunningScoreAction: vi.fn(),
}));

afterEach(cleanup);

function match(status: "staged" | "playing"): MatchWithPlayers {
  return {
    id: "match-1",
    session_id: "session-1",
    court_id: "court-1",
    match_number: 1,
    status,
    display_name: "Feature match",
    target_score: 11,
    win_by: 2,
    matching_mode: "balanced",
    explanation: "Balanced by wait time.",
    team1_score: status === "playing" ? 7 : null,
    team2_score: status === "playing" ? 5 : null,
    winning_team: null,
    staged_at: "2026-01-01T10:00:00Z",
    started_at: status === "playing" ? "2026-01-01T10:05:00Z" : null,
    completed_at: null,
    players: [
      { id: "mp-1", match_id: "match-1", session_id: "session-1", player_id: "p1", team_number: 1, slot_number: 1, skill_snapshot: 3, result: null, points_for: null, points_against: null, display_name: "Alex" },
      { id: "mp-2", match_id: "match-1", session_id: "session-1", player_id: "p2", team_number: 2, slot_number: 1, skill_snapshot: 3, result: null, points_for: null, points_against: null, display_name: "Bo" },
    ],
  };
}

function court(status: "staged" | "playing"): CourtView {
  return {
    id: "court-1",
    court_number: 1,
    name: "Championship",
    status,
    ladder_position: 1,
    match: match(status),
  };
}

describe("CourtCard", () => {
  it("keeps the court name, team labels, and live score visible", () => {
    render(<CourtCard sessionId="session-1" court={court("playing")} canManage={false} />);

    expect(screen.getByText("Court 1 · Championship")).toBeTruthy();
    expect(screen.getByText("Team 1")).toBeTruthy();
    expect(screen.getByText("Team 2")).toBeTruthy();
    expect(screen.getByText("7–5")).toBeTruthy();
  });

  it("shows organizer controls for a staged game", () => {
    render(<CourtCard sessionId="session-1" court={court("staged")} canManage />);

    expect(screen.getByRole("button", { name: "Start game" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel lineup" })).toBeTruthy();
  });
});
