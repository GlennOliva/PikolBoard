import "react-native-url-polyfill/auto";
import "expo-sqlite/localStorage/install";

import { AppState, type AppStateStatus } from "react-native";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The single Supabase client for the app.
 *
 * The session is persisted in the SQLite-backed `localStorage` polyfill so a
 * signed-in organizer stays signed in across launches. Tokens are refreshed
 * only while the app is foregrounded: Supabase's auto-refresh keeps a timer
 * running, and leaving it on in the background drains the battery and can
 * fire against a stale session. The AppState listener is registered once, at
 * module load, and never removed because this module lives for the process's
 * lifetime.
 *
 * There is deliberately no module-level mutable auth state beyond the client
 * itself, and no service-role key anywhere: every write is an RPC that
 * re-checks authorization in the database.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase environment variables. Copy .env.example to .env and set " +
      "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

function handleAppStateChange(state: AppStateStatus) {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
}

AppState.addEventListener("change", handleAppStateChange);
