import { act, render, waitFor } from "@testing-library/react-native";

import LiveBoardScreen from "@/app/live/[publicToken]";
import { LEADERBOARD_EMPTY_MESSAGE } from "@/components/live/live-leaderboard";
import { getPlayerLiveBoard } from "@/lib/queries";
import type { PlayerLiveBoardPayload, PublicSessionStanding } from "@/types/database";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ publicToken: "token-1" }),
  router: { canGoBack: () => false, back: jest.fn(), replace: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View, SafeAreaProvider: View };
});

jest.mock("@/lib/queries", () => ({ getPlayerLiveBoard: jest.fn() }));

const mockedBoard = getPlayerLiveBoard as jest.MockedFunction<typeof getPlayerLiveBoard>;

function standing(
  player_id: string,
  display_name: string,
  overrides: Partial<PublicSessionStanding> = {},
): PublicSessionStanding {
  return {
    session_id: "s1",
    club_id: "c1",
    player_id,
    display_name,
    skill_level: 3,
    games_played: 0,
    wins: 0,
    losses: 0,
    points_for: 0,
    points_against: 0,
    first_game_at: null,
    last_game_at: null,
    ...overrides,
  };
}

function payload(
  overrides: Partial<PlayerLiveBoardPayload> = {},
): PlayerLiveBoardPayload {
  return {
    session: {
      id: "s1",
      club_id: "c1",
      name: "Friday Night",
      status: "active",
      format: "doubles",
      matching_mode: "balanced",
      target_score: 11,
      win_by: 2,
      court_count: 2,
      started_at: "2026-01-01T18:00:00Z",
      ended_at: null,
      results_published: false,
      club_slug: "pickle",
      club_name: "Pickle Club",
      club_location: null,
      avg_match_minutes: 12,
      completed_match_count: 0,
      club_logo_url: null,
      player_live_enabled: true,
    },
    courts: [],
    lineups: [],
    up_next: [],
    preparation: [],
    presence: [],
    standings: [],
    ...overrides,
  };
}

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("LiveBoardScreen leaderboard", () => {
  it("renders live standings during an active, unpublished session", async () => {
    mockedBoard.mockResolvedValue(
      payload({
        standings: [
          standing("p1", "Alice Wong", {
            games_played: 2,
            wins: 2,
            losses: 0,
            points_for: 22,
            points_against: 10,
          }),
        ],
      }),
    );

    const { getByText } = await render(<LiveBoardScreen />);

    await waitFor(() => expect(getByText("Alice Wong")).toBeTruthy());
    expect(getByText("Live Leaderboard")).toBeTruthy();
  });

  it("shows the empty message instead of hiding the section", async () => {
    mockedBoard.mockResolvedValue(payload({ standings: [] }));

    const { getByText } = await render(<LiveBoardScreen />);

    await waitFor(() => expect(getByText("Live Leaderboard")).toBeTruthy());
    expect(getByText(LEADERBOARD_EMPTY_MESSAGE)).toBeTruthy();
  });

  it("shows a retry state when the board query fails", async () => {
    mockedBoard.mockRejectedValue(new Error("network down"));

    const { getByText } = await render(<LiveBoardScreen />);

    await waitFor(() => expect(getByText("Board unavailable")).toBeTruthy());
    expect(getByText("Retry")).toBeTruthy();
  });

  it("refreshes standings on the polling interval", async () => {
    jest.useFakeTimers();
    mockedBoard.mockResolvedValueOnce(
      payload({ standings: [standing("p1", "Alice")] }),
    );
    mockedBoard.mockResolvedValueOnce(
      payload({ standings: [standing("p2", "Bob", { games_played: 1, wins: 1 })] }),
    );

    const { getByText, queryByText } = await render(<LiveBoardScreen />);
    await waitFor(() => expect(getByText("Alice")).toBeTruthy());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    await waitFor(() => expect(getByText("Bob")).toBeTruthy());
    expect(queryByText("Alice")).toBeNull();
  });
});
