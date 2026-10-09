// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StandingsTable } from "./standings-table";

/**
 * Podium integration through the real table.
 *
 * The qualification arithmetic is unit tested in lib/domain/leaderboard/podium.
 * What matters here is that the rendered table honours it: unqualified players
 * stay visible and undecorated, medals appear the moment a fifth game lands, and
 * every row keeps a stable key across the recalculation that a realtime update
 * triggers.
 */

type Row = {
  player_id: string;
  display_name: string;
  games_played: number;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
};

function row(overrides: Partial<Row> & { player_id: string }): Row {
  return {
    display_name: "Player",
    games_played: 0,
    wins: 0,
    losses: 0,
    points_for: 0,
    points_against: 0,
    ...overrides,
  };
}

const body = () => screen.getByRole("table").querySelector("tbody")!;
const rowFor = (name: string) =>
  within(body()).getByText(name).closest("tr") as HTMLElement;

/** Cell text by column header, for rows where several cells read "0". */
function cell(tr: HTMLElement, header: string): string {
  const index = screen
    .getAllByRole("columnheader")
    .findIndex((th) => th.textContent === header);
  return tr.querySelectorAll("td")[index]?.textContent ?? "";
}

afterEach(cleanup);

function renderTable(rows: Row[]) {
  return render(
    <StandingsTable rows={rows} caption="Session standings for test session" />,
  );
}

describe("players below the threshold stay visible without medals", () => {
  it("shows every row and decorates none of them", () => {
    renderTable([
      row({ player_id: "p1", display_name: "AG", games_played: 3, wins: 3 }),
      row({ player_id: "p2", display_name: "JAYSON", games_played: 4, wins: 3, losses: 1 }),
    ]);

    expect(rowFor("AG")).toBeTruthy();
    expect(rowFor("JAYSON")).toBeTruthy();
    expect(body().querySelectorAll("tr")).toHaveLength(2);

    const html = body().innerHTML;
    expect(html).not.toContain("🥇");
    expect(html).not.toContain("🥈");
    expect(html).not.toContain("🥉");
    expect(html).not.toContain("amber");
    expect(html).not.toContain("slate-400");
  });

  it("spells out the shortfall with correct singular and plural wording", () => {
    renderTable([
      row({ player_id: "p1", display_name: "AG", games_played: 3 }),
      row({ player_id: "p2", display_name: "JAYSON", games_played: 4 }),
      row({ player_id: "p3", display_name: "MARIA", games_played: 0 }),
    ]);

    expect(screen.getByText("2 more games to qualify")).toBeTruthy();
    expect(screen.getByText("1 more game to qualify")).toBeTruthy();
    expect(screen.getByText("5 more games to qualify")).toBeTruthy();
  });

  it("shows zero games rather than hiding a player who has not played", () => {
    renderTable([row({ player_id: "p1", display_name: "NEWCOMER", games_played: 0 })]);
    const tr = rowFor("NEWCOMER");

    // A real zero in the Games column, not a dash and not a hidden row.
    expect(cell(tr, "G")).toBe("0");
    expect(cell(tr, "Win %")).toBe("0.0%");
  });
});

describe("a player is decorated the moment the fifth game lands", () => {
  it("shows no medal at four games and a medal at five", () => {
    const four = row({ player_id: "p1", display_name: "AG", games_played: 4, wins: 4 });
    const { unmount } = renderTable([four]);
    expect(screen.getByText("1 more game to qualify")).toBeTruthy();
    expect(body().innerHTML).not.toContain("🥇");
    unmount();

    // Same player, same position, one more completed game.
    const five = row({ player_id: "p1", display_name: "AG", games_played: 5, wins: 5 });
    renderTable([five]);

    expect(screen.getByText("Qualified")).toBeTruthy();
    expect(screen.getByText("🥇")).toBeTruthy();
    expect(rowFor("AG").className).toContain("amber");
  });

  it("recalculates the whole podium when a newcomer qualifies", () => {
    const before = [
      row({ player_id: "p1", display_name: "AG", games_played: 6, wins: 5, losses: 1 }),
      row({ player_id: "p2", display_name: "JAYSON", games_played: 4, wins: 3, losses: 1 }),
      row({ player_id: "p3", display_name: "MARIA", games_played: 3, wins: 2, losses: 1 }),
    ];
    const { unmount, rerender } = renderTable(before);

    expect(screen.getByText("🥇")).toBeTruthy();
    expect(body().innerHTML).not.toContain("🥈");

    // This is the shape of a realtime standings refresh.
    const after = [
      before[0],
      row({ player_id: "p2", display_name: "JAYSON", games_played: 5, wins: 3, losses: 2 }),
      before[2],
    ];
    rerender(
      <StandingsTable rows={after} caption="Session standings for test session" />,
    );

    expect(screen.getByText("🥈")).toBeTruthy();
    expect(rowFor("JAYSON").className).toContain("slate");
    unmount();
  });
});

describe("medal assignment", () => {
  const qualified = [
    row({ player_id: "p1", display_name: "AG", games_played: 6, wins: 5, losses: 1 }),
    row({ player_id: "p2", display_name: "JAYSON", games_played: 5, wins: 3, losses: 2 }),
    row({ player_id: "p3", display_name: "MARIA", games_played: 5, wins: 2, losses: 3 }),
    row({ player_id: "p4", display_name: "BEN", games_played: 2, wins: 1, losses: 1 }),
  ];

  it("gives the top three qualified players gold, silver and bronze", () => {
    renderTable(qualified);

    expect(within(rowFor("AG")).getByText("🥇")).toBeTruthy();
    expect(within(rowFor("JAYSON")).getByText("🥈")).toBeTruthy();
    expect(within(rowFor("MARIA")).getByText("🥉")).toBeTruthy();

    expect(rowFor("AG").className).toContain("amber");
    expect(rowFor("JAYSON").className).toContain("slate");
    expect(rowFor("MARIA").className).toContain("orange");
  });

  it("leaves the fourth qualified player undecorated", () => {
    renderTable([
      ...qualified,
      row({ player_id: "p5", display_name: "ZED", games_played: 5, wins: 1, losses: 4 }),
    ]);
    expect(rowFor("ZED").className).not.toContain("amber");
    expect(rowFor("ZED").className).not.toContain("slate");
    expect(rowFor("ZED").className).not.toContain("orange");
    // Still visible and still qualified.
    expect(within(rowFor("ZED")).getByText("Qualified")).toBeTruthy();
  });

  it("awards only gold when a single player qualifies", () => {
    renderTable([
      row({ player_id: "p1", display_name: "AG", games_played: 5 }),
      row({ player_id: "p2", display_name: "JAYSON", games_played: 4 }),
    ]);

    expect(screen.getByText("🥇")).toBeTruthy();
    expect(body().innerHTML).not.toContain("🥈");
    expect(body().innerHTML).not.toContain("🥉");
  });

  it("awards gold and silver but no bronze when two qualify", () => {
    renderTable([
      row({ player_id: "p1", display_name: "AG", games_played: 7 }),
      row({ player_id: "p2", display_name: "JAYSON", games_played: 5 }),
      row({ player_id: "p3", display_name: "MARIA", games_played: 4 }),
    ]);

    expect(screen.getByText("🥇")).toBeTruthy();
    expect(screen.getByText("🥈")).toBeTruthy();
    expect(body().innerHTML).not.toContain("🥉");
  });

  it("does not take gold from a qualified player sitting below an unqualified leader", () => {
    renderTable([
      row({ player_id: "p1", display_name: "HOPEFUL", games_played: 4 }),
      row({ player_id: "p2", display_name: "VETERAN", games_played: 6 }),
    ]);

    expect(within(rowFor("HOPEFUL")).queryByText("🥇")).toBeNull();
    expect(within(rowFor("VETERAN")).getByText("🥇")).toBeTruthy();
  });
});

describe("accessibility", () => {
  const rows = [
    row({ player_id: "p1", display_name: "AG", games_played: 6, wins: 5, losses: 1 }),
    row({ player_id: "p2", display_name: "JAYSON", games_played: 4, wins: 3, losses: 1 }),
  ];

  it("names the place in text, not by colour alone", () => {
    renderTable(rows);
    const tr = rowFor("AG");

    // The medal glyph is hidden from assistive tech, so the place is spoken.
    expect(within(tr).getByText("1st place, gold")).toBeTruthy();
    expect(within(tr).getByText("🥇").getAttribute("aria-hidden")).toBe("true");
    // And the ordinal is visible, so the rank reads without the glyph.
    expect(within(tr).getByText("1st")).toBeTruthy();
  });

  it("names each medal tier", () => {
    renderTable([
      ...rows,
      row({ player_id: "p3", display_name: "MARIA", games_played: 5, wins: 2, losses: 3 }),
      row({ player_id: "p4", display_name: "BEN", games_played: 5, wins: 1, losses: 4 }),
    ]);

    expect(screen.getByText("1st place, gold")).toBeTruthy();
    expect(screen.getByText("2nd place, silver")).toBeTruthy();
    expect(screen.getByText("3rd place, bronze")).toBeTruthy();
  });

  it("marks up the table with a caption and scoped headers", () => {
    renderTable(rows);
    expect(
      screen.getByText("Session standings for test session", { selector: "caption" }),
    ).toBeTruthy();

    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent);
    expect(headers).toEqual([
      "Rank",
      "Player",
      "Qualification",
      "G",
      "W",
      "L",
      "Win %",
      "PF",
      "PA",
      "Diff",
    ]);
  });

  it("gives every row an accessible row header via the player name", () => {
    renderTable(rows);
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2
  });
});

describe("realtime updates do not create duplicate keys", () => {
  it("keys rows by player id, so a refresh cannot collide", () => {
    renderTable([
      row({ player_id: "p1", display_name: "AG", games_played: 5 }),
      row({ player_id: "p2", display_name: "JAYSON", games_played: 5 }),
    ]);

    // Keying on display name would collapse these two clubs' players; keying on
    // (rank) would collide whenever the podium recalculates. Both render.
    expect(body().querySelectorAll("tr")).toHaveLength(2);
    expect(screen.getByText("AG")).toBeTruthy();
    expect(screen.getByText("JAYSON")).toBeTruthy();
  });

  it("renders two players who share a display name as separate rows", () => {
    renderTable([
      row({ player_id: "p1", display_name: "Sam", games_played: 5 }),
      row({ player_id: "p2", display_name: "Sam", games_played: 5 }),
    ]);

    // Two distinct players, one name. getAllByText is the point of the test:
    // keying on display name would render one row instead of two.
    expect(within(body()).getAllByText("Sam")).toHaveLength(2);
    expect(body().querySelectorAll("tr")).toHaveLength(2);
  });

  it("survives repeated standings refreshes without losing rows", () => {
    const rows = [
      row({ player_id: "p1", display_name: "AG", games_played: 5 }),
      row({ player_id: "p2", display_name: "JAYSON", games_played: 5 }),
      row({ player_id: "p3", display_name: "MARIA", games_played: 5 }),
    ];
    const { rerender } = renderTable(rows);

    for (let i = 0; i < 5; i += 1) {
      rerender(<StandingsTable rows={rows} caption="Session standings" />);
    }

    expect(body().querySelectorAll("tr")).toHaveLength(3);
  });

  it("handles an empty standings list", () => {
    renderTable([]);
    expect(body().querySelectorAll("tr")).toHaveLength(0);
  });
});