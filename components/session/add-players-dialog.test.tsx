// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AddPlayersDialog } from "./add-players-dialog";

vi.mock("@/app/actions/session-actions", () => ({
  addPlayersToSessionAction: vi.fn(),
  createSessionPlayerAction: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(cleanup);

const availablePlayers = [
  {
    id: "player-1",
    display_name: "Alex Chen",
    skill_level: 3,
    division: "3.0 mixed",
  },
  {
    id: "player-2",
    display_name: "Bob Lee",
    skill_level: 4,
    division: null,
  },
];

describe("AddPlayersDialog", () => {
  it("searches the remaining club roster and defaults new players to checked in", async () => {
    render(
      <AddPlayersDialog
        sessionId="session-1"
        availablePlayers={availablePlayers}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add players" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Alex Chen")).toBeTruthy();
    expect(screen.getByText("Bob Lee")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Find on the club roster"), {
      target: { value: "bob" },
    });

    expect(screen.queryByText("Alex Chen")).toBeNull();
    expect(screen.getByText("Bob Lee")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Bob Lee/ })).toBeTruthy();
    expect(screen.getAllByRole("checkbox", { name: /Check them in/ })).toHaveLength(2);
  });

  it("still offers the create-player form when the roster is exhausted", async () => {
    render(
      <AddPlayersDialog sessionId="session-1" availablePlayers={[]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add players" }));

    expect(
      await screen.findByText(
        "Everyone on the active club roster is already in this session.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Skill level")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create and add player" }),
    ).toBeTruthy();
  });
});
