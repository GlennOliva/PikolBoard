// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LineupPanels } from "./lineup-panels";
import type {
  CourtLike,
  LineupMatchLike,
  RosterRowLike,
} from "@/lib/domain/session/lineups";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  assign: vi.fn(),
  cancel: vi.fn(),
  demote: vi.fn(),
  promote: vi.fn(),
  update: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/lineup-actions", () => ({
  assignLineupToCourtAction: mocks.assign,
  cancelLineupAction: mocks.cancel,
  demoteLineupAction: mocks.demote,
  promoteLineupAction: mocks.promote,
  updateLineupPlayersAction: mocks.update,
}));

const sessionId = "10000000-0000-4000-8000-000000000001";
const courtId = "20000000-0000-4000-8000-000000000001";

function player(id: number, team: 1 | 2, slot: number) {
  return {
    id: `30000000-0000-4000-8000-00000000000${id}`,
    player_id: `40000000-0000-4000-8000-00000000000${id}`,
    team_number: team,
    slot_number: slot,
    display_name: `Player ${id}`,
  };
}

function lineup(
  id: number,
  status: "preparing" | "up_next",
  firstPlayer: number,
): LineupMatchLike {
  return {
    id: `50000000-0000-4000-8000-00000000000${id}`,
    status,
    match_number: id,
    display_name: status === "up_next" ? "Friday Feature" : "Saturday Warmup",
    explanation: "Balanced by skill and wait time.",
    staged_at: `2026-01-01T10:0${id}:00Z`,
    court_id: null,
    players: [
      player(firstPlayer, 1, 1),
      player(firstPlayer + 1, 1, 2),
      player(firstPlayer + 2, 2, 1),
      player(firstPlayer + 3, 2, 2),
    ],
  };
}

const upNext = lineup(1, "up_next", 1);
const preparing = lineup(2, "preparing", 5);

const courts: CourtLike[] = [
  { id: courtId, court_number: 1, name: "Center", status: "available" },
];

const roster: RosterRowLike[] = Array.from({ length: 9 }, (_, index) => {
  const id = index + 1;
  return {
    id: `60000000-0000-4000-8000-00000000000${id}`,
    player_id: `40000000-0000-4000-8000-00000000000${id}`,
    display_name: id === 9 ? "Nina Newcomer" : `Player ${id}`,
    attendance_status: id === 9 ? "waiting" : "staged",
    skill_level: 3,
    player_missing: false,
  };
});

function result() {
  return Promise.resolve({
    ok: true,
    error: null,
    matchId: null,
    status: null,
    promotedMatchId: null,
    courtNumber: null,
  });
}

function panels(overrides: Partial<Parameters<typeof LineupPanels>[0]> = {}) {
  return (
    <LineupPanels
      sessionId={sessionId}
      matches={[upNext, preparing]}
      courts={courts}
      roster={roster}
      format="doubles"
      canManage
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assign.mockImplementation(result);
  mocks.cancel.mockImplementation(result);
  mocks.demote.mockImplementation(result);
  mocks.promote.mockImplementation(result);
  mocks.update.mockImplementation(result);
});

afterEach(cleanup);

describe("LineupPanels", () => {
  it("shows Up Next and Preparation as separate real-name lineups", () => {
    render(panels());
    expect(screen.getByText("Friday Feature")).toBeTruthy();
    expect(screen.getByText("Saturday Warmup")).toBeTruthy();
    expect(screen.getByText("Player 1")).toBeTruthy();
    expect(screen.getByText("Player 8")).toBeTruthy();
    expect(screen.getByText("1 waiting, oldest first")).toBeTruthy();
  });

  it("assigns the Up Next lineup to the chosen available court", async () => {
    render(panels());
    fireEvent.change(
      screen.getByRole("combobox", { name: "Send Friday Feature to a court" }),
      { target: { value: courtId } },
    );

    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith({
        sessionId,
        matchId: upNext.id,
        courtId,
      });
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("searches checked-in players and saves a targeted replacement", async () => {
    render(panels());
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    const dialog = screen.getByRole("dialog", { name: "Edit Friday Feature" });
    expect(within(dialog).getAllByText("Player 1").length).toBeGreaterThan(0);
    fireEvent.change(within(dialog).getByPlaceholderText("Search by name"), {
      target: { value: "Nina" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /Nina Newcomer/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save lineup" }));

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith({
        sessionId,
        matchId: upNext.id,
        playerIds: [
          roster[8].player_id,
          roster[1].player_id,
          roster[2].player_id,
          roster[3].player_id,
        ],
        teamNumbers: [1, 1, 2, 2],
        slotNumbers: [1, 2, 1, 2],
      });
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("offers promotion only when the Up Next slot is empty", async () => {
    render(panels({ matches: [preparing] }));
    fireEvent.click(screen.getByRole("button", { name: "Make up next" }));

    await waitFor(() => {
      expect(mocks.promote).toHaveBeenCalledWith({
        sessionId,
        matchId: preparing.id,
      });
    });
  });
});
