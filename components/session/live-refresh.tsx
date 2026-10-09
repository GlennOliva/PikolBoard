"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Keeps an open session screen in sync with other organizers' phones.
 *
 * The match RPCs already write through Postgres, so the only thing left on the
 * client is to notice that something changed and re-render this Server
 * Component tree. We deliberately refresh the router instead of patching state
 * locally: the database is the source of truth, and a refresh cannot drift from
 * it the way hand-maintained optimistic state can.
 *
 * Coalescing matters here — a start of a four-player match touches four
 * session_players rows, so a single action can fire several notifications.
 */
export function LiveRefresh({
  sessionId,
  intervalMs = 30_000,
}: {
  sessionId: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const bump = () => {
      if (pending.current) return;
      pending.current = true;
      // Wait a beat so a burst of row changes turns into one repaint.
      timer.current = setTimeout(() => {
        pending.current = false;
        router.refresh();
      }, 400);
    };

    const channel = supabase
      .channel(`session:${sessionId}`)
      // session_players drives the queue, matches/courts drive the ladder.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_players",
          filter: `session_id=eq.${sessionId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `session_id=eq.${sessionId}`,
        },
        bump,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "courts",
          filter: `session_id=eq.${sessionId}`,
        },
        bump,
      )
      // match_players is where a completed result lands, so it is subscribed to
      // alongside matches rather than relying on the matches update alone.
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_players",
          filter: `session_id=eq.${sessionId}`,
        },
        bump,
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    // Fallback poll: if the socket cannot connect (proxy, flaky venue wifi)
    // the screen still updates rather than silently going stale.
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
        "inline-flex items-center gap-1.5 text-xs",
        live ? "text-muted-foreground" : "text-muted-foreground/70",
      )}
      title={live ? "Live updates connected" : "Reconnecting to live updates"}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          live ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      {live ? "Live" : "Polling"}
    </span>
  );
}
