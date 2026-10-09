import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";

import { LiveLeaderboard } from "@/components/live/live-leaderboard";
import type { PublicSessionStanding } from "@/types/database";

function standing(
  overrides: { player_id: string; display_name: string } & Partial<PublicSessionStanding>,
): PublicSessionStanding {
  return {
    session_id: "s1",
    club_id: "c1",
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

describe("LiveLeaderboard", () => {
  it("renders player names, games, record, win percentage and differential", async () => {
    const rows = [
      standing({
        player_id: "p1",
        display_name: "Alice Wong",
        games_played: 6,
        wins: 5,
        losses: 1,
        points_for: 66,
        points_against: 44,
      }),
    ];

    const { getByText } = await render(<LiveLeaderboard rows={rows} />);

    expect(getByText("Alice Wong")).toBeTruthy();
    expect(getByText("1st")).toBeTruthy();
    expect(getByText("6")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    expect(getByText("1")).toBeTruthy();
    expect(getByText("83.3%")).toBeTruthy();
    expect(getByText("+22")).toBeTruthy();
  });

  it("awards medals to the first three qualified players only", async () => {
    const rows = [
      standing({ player_id: "p1", display_name: "First", games_played: 6, wins: 6 }),
      standing({ player_id: "p2", display_name: "Second", games_played: 6, wins: 5 }),
      standing({ player_id: "p3", display_name: "Third", games_played: 6, wins: 4 }),
      standing({ player_id: "p4", display_name: "Rookie", games_played: 2, wins: 1 }),
    ];

    const { getByText, queryByText } = await render(<LiveLeaderboard rows={rows} />);

    expect(getByText("🥇")).toBeTruthy();
    expect(getByText("🥈")).toBeTruthy();
    expect(getByText("🥉")).toBeTruthy();
    expect(queryByText("4th")).toBeTruthy();
    expect(queryByText("3 more games to qualify")).toBeTruthy();
  });

  it("does not decorate a player short of the qualification threshold", async () => {
    const rows = [
      standing({ player_id: "p1", display_name: "Solo", games_played: 4, wins: 4 }),
    ];

    const { queryByText, getByText } = await render(<LiveLeaderboard rows={rows} />);

    expect(queryByText("🥇")).toBeNull();
    expect(getByText("1 more game to qualify")).toBeTruthy();
  });

  it("tints the podium rows according to qualification, not row order", async () => {
    const rows = [
      standing({ player_id: "p1", display_name: "First", games_played: 6, wins: 6 }),
      standing({ player_id: "p2", display_name: "Rookie", games_played: 1, wins: 1 }),
      standing({ player_id: "p3", display_name: "Second", games_played: 6, wins: 4 }),
    ];

    const { getByTestId } = await render(<LiveLeaderboard rows={rows} />);

    const gold = StyleSheet.flatten(getByTestId("leaderboard-row-p1").props.style);
    const unqualified = StyleSheet.flatten(getByTestId("leaderboard-row-p2").props.style);
    const silver = StyleSheet.flatten(getByTestId("leaderboard-row-p3").props.style);

    expect(gold.backgroundColor).toBe("rgba(245, 197, 24, 0.14)");
    expect(silver.backgroundColor).toBe("rgba(148, 163, 184, 0.16)");
    // The one-game player keeps their position but no podium tint.
    expect(unqualified.backgroundColor).toBeUndefined();
  });

  it("keys rows by stable player id, not display name", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const rows = [
        standing({ player_id: "p1", display_name: "Alex", games_played: 1, wins: 1 }),
        standing({ player_id: "p2", display_name: "Alex", games_played: 1, wins: 0 }),
      ];

      const { getAllByText } = await render(<LiveLeaderboard rows={rows} />);

      expect(getAllByText("Alex")).toHaveLength(2);
      const keyWarning = errorSpy.mock.calls.find((call) =>
        String(call[0]).includes("same key"),
      );
      expect(keyWarning).toBeUndefined();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
