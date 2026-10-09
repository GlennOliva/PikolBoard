"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Keeps the anonymous live board current.
 *
 * Subscribes to base tables, never to views. Postgres change events are only
 * emitted for tables in the realtime publication, so subscribing to
 * public_live_courts or public_match_lineups silently never fires -- the socket
 * connects, the indicator turns green, and the board is still stale twenty
 * seconds later. Every subscription here is therefore on a real table.
 *
 * The tables are in the publication and readable by anon only for a session
 * whose Player Live View is enabled. The callback consumes no payload; it only
 * refreshes the token-scoped sanitized RPC, so the database remains the source
 * of truth and the socket cannot become a parallel read model.
 */
export function PublicLiveRefresh({
  sessionId,
  intervalMs = 20_000,
}: {
  sessionId: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const pending = useRef(false);
  const connectedOnce = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const bump = () => {
      if (pending.current) return;
      pending.current = true;
      timer.current = setTimeout(() => {
        pending.current = false;
        router.refresh();
        setLastUpdated(new Date());
      }, 400);
    };

    let channel = supabase.channel(`public-live:${sessionId}`);
    for (const table of ["courts", "matches", "match_players", "session_players"]) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `session_id=eq.${sessionId}`,
        },
        bump,
      );
    }

    // Session status uses `id`, not `session_id`. Without this subscription an
    // ended session remains LIVE on the phone until the fallback poll fires.
    channel = channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      bump,
    );

    channel = channel.subscribe((status) => {
      const subscribed = status === "SUBSCRIBED";
      setLive(subscribed);
      if (subscribed) {
        // Re-fetch after reconnecting because changes emitted while the socket
        // was down cannot be replayed by this lightweight subscription.
        if (connectedOnce.current) router.refresh();
        connectedOnce.current = true;
        setLastUpdated(new Date());
      }
    });

    // Fallback poll: spectators are often on venue wifi where the websocket is
    // blocked, so the board must still advance on its own.
    const poll = setInterval(bump, intervalMs);

    return () => {
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, intervalMs, router]);

  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs",
        live ? "text-muted-foreground" : "text-muted-foreground/70",
      )}
      role="status"
      aria-live="polite"
      title={live ? "Live updates connected" : "Trying to reconnect to live updates"}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            live ? "bg-emerald-500" : "animate-pulse bg-amber-500",
          )}
        />
        {live ? "Live" : "Reconnecting…"}
      </span>
      {lastUpdated ? (
        <span>Last updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      ) : null}
      {!live ? (
        <span className="basis-full">Live updates are temporarily unavailable. Trying to reconnect…</span>
      ) : null}
    </span>
  );
}
