import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

/**
 * Subscribes the organizer's device to the tables that change during a live
 * session. RLS applies to Realtime, so this only delivers rows the signed-in
 * user may read; there is no separate authorization here.
 *
 * Returns an unsubscribe function. The callback fires for any insert/update/
 * delete on the watched tables filtered to the session, and is debounced by
 * the caller's refetch rather than here so a burst of score writes does not
 * fan out into a burst of reads.
 */
export function subscribeToSession(
  sessionId: string,
  onChange: () => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`session:${sessionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "matches",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "match_players",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "courts",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "session_players",
        filter: `session_id=eq.${sessionId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
