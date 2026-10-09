// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DraftLiveView, UnavailableLiveView } from "./player-live-notice";

afterEach(cleanup);

describe("Player Live View non-board states", () => {
  it("tells a spectator an unknown token is invalid or replaced, not 'not found'", () => {
    render(<UnavailableLiveView />);
    expect(screen.getByRole("heading", { name: "Player Live View unavailable" })).toBeTruthy();
    expect(
      screen.getByText(
        "This QR code is invalid or has been replaced. Ask the organizer for the current QR code.",
      ),
    ).toBeTruthy();
  });

  it("shows the session name and a not-started message while the session is draft", () => {
    render(<DraftLiveView sessionName="Thursday Round Robin" />);
    expect(screen.getByRole("heading", { name: "Thursday Round Robin" })).toBeTruthy();
    expect(screen.getByText("This session has not started yet.")).toBeTruthy();
  });

  it("never offers an organizer action from a spectator state", () => {
    const { container } = render(
      <>
        <UnavailableLiveView />
        <DraftLiveView sessionName="Thursday Round Robin" />
      </>,
    );
    expect(container.querySelectorAll("form")).toHaveLength(0);
    expect(screen.queryByText(/start session|end session|check in/i)).toBeNull();
  });
});