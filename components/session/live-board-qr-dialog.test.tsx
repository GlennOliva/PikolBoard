// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveBoardQrDialog } from "./live-board-qr-dialog";
import { LOOPBACK_WARNING } from "@/lib/domain/live-board/live-board-url";

const toDataURL = vi.fn(() => Promise.resolve("data:image/png;base64,qr-code"));
vi.mock("qrcode", () => ({ toDataURL }));

const props = {
  clubSlug: "riverside",
  publicToken: "550e8400-e29b-41d4-a716-446655440000",
  sessionName: "Friday Open Play",
  clubName: "Riverside Pickleball",
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://pickle.example.com");
  toDataURL.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("LiveBoardQrDialog", () => {
  it("encodes the absolute canonical URL locally", async () => {
    render(<LiveBoardQrDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Show Player QR Code" }));

    await screen.findByAltText(/QR code linking to/);
    expect(toDataURL).toHaveBeenCalledWith(
      "https://pickle.example.com/live/550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ margin: 4, errorCorrectionLevel: "H" }),
    );
    expect(screen.getByText("https://pickle.example.com/live/550e8400-e29b-41d4-a716-446655440000")).toBeTruthy();
  });

  it("shows every organizer control and the session identity", async () => {
    render(<LiveBoardQrDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Show Player QR Code" }));
    await screen.findByAltText(/QR code linking to/);

    expect(screen.getAllByText("Copy Link").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open Player View").length).toBeGreaterThan(0);
    expect(screen.getByText("Download QR Code")).toBeTruthy();
    expect(screen.getByText("Full Screen")).toBeTruthy();
    expect(screen.getByText("Friday Open Play")).toBeTruthy();
    expect(screen.getByText("Riverside Pickleball")).toBeTruthy();
  });

  it("downloads a PNG generated inside the application", async () => {
    render(<LiveBoardQrDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Show Player QR Code" }));
    const link = await screen.findByText("Download QR Code");
    const anchor = link.closest("a")!;
    expect(anchor.getAttribute("href")).toBe("data:image/png;base64,qr-code");
    expect(anchor.getAttribute("download")).toBe("riverside-friday-open-play-qr.png");
  });

  it("never draws a localhost QR and shows the cross-device warning", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    render(<LiveBoardQrDialog {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Show Player QR Code" }));

    expect(await screen.findByText(LOOPBACK_WARNING)).toBeTruthy();
    await waitFor(() => expect(toDataURL).not.toHaveBeenCalled());
    expect(screen.queryByAltText(/QR code linking to/)).toBeNull();
  });
});
