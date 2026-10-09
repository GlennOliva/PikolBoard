import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { PublicLiveBoard } from "@/components/session/public-live-board";
import { DraftLiveView, UnavailableLiveView } from "@/components/session/player-live-notice";
import { getPlayerLiveBoard } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Player Live View" };

export default function PlayerLivePage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted/50" />}>
      <PlayerLiveContent params={params} />
    </Suspense>
  );
}

async function PlayerLiveContent({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = await params;
  if (!z.string().uuid().safeParse(publicToken).success) {
    console.warn("[player-live] unavailable", { reason: "malformed token" });
    return <UnavailableLiveView />;
  }

  const board = await getPlayerLiveBoard(publicToken);
  if (!board) {
    // Do not log the capability itself. The reason is useful; the token is not.
    console.warn("[player-live] unavailable", {
      reason: "unknown, revoked, disabled, or unpublished token",
    });
    return <UnavailableLiveView />;
  }

  if (board.session.status === "draft") {
    console.info("[player-live] waiting", { reason: "session still draft" });
    return <DraftLiveView sessionName={board.session.name} />;
  }

  return (
    <PublicLiveBoard
      session={board.session}
      courts={board.courts}
      lineups={board.lineups}
      upNext={board.up_next}
      preparation={board.preparation}
      presence={board.presence}
      standings={board.standings}
    />
  );
}
