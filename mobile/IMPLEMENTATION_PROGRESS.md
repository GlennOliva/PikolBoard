# Mobile Implementation Progress

Native Expo companion app for Pickleboard. This tracks the port of the web app
into `mobile/` and the design decisions behind it.

## Status: feature-complete, pending device verification

All routes, data access, and domain logic are implemented and pass
`tsc --noEmit`, `expo lint`, and `jest`. The remaining work is running the app
on a device/simulator against the live Supabase project (camera permission,
Realtime, and RPC round-trips cannot be exercised in CI here).

## What was built

### Foundation
- `app.json` rewritten: name/slug `pickleboard`, URL scheme `pickleboard`,
  bundle id `app.pickleboard.mobile`, `expo-camera` plugin with a permission
  string, `typedRoutes` disabled so `tsc` is stable without a generated route
  manifest.
- `.env.example` and `.env` (publishable key only). `.env` is git-ignored.
- Jest via `jest-expo` + React Native Testing Library, `moduleNameMapper`
  for the `@/` alias, and an `expo-sqlite` mock in `jest.setup.js`.
- Scripts: `typecheck`, `test`, `test:watch`.

### Data access
- `src/lib/supabase.ts` — one client, session persisted in the SQLite-backed
  `localStorage` polyfill, token auto-refresh paused while backgrounded.
- `src/lib/auth-context.tsx` — session restoration and sign in/up/out.
- `src/lib/queries.ts` — RLS reads (`clubs`, `sessions`, `courts`,
  `session_players`, `matches`, `match_players`, `session_standings`) and the
  public reads (`get_player_live_board` RPC, sanitized public views).
- `src/lib/mutations.ts` — every write is an RPC wrapper; the live tables have
  no client INSERT/UPDATE/DELETE policies, so the database re-checks
  authorization on each call.
- `src/lib/realtime.ts` — per-session Realtime subscription for the organizer;
  the public board polls `get_player_live_board` every 10s.

### Domain (ported from `lib/domain/`, pure and tested)
- Matchmaking (`fifo`, `balanced`, `skill_separated`) with queue displacement,
  starvation, and repeat-partner/opponent avoidance.
- Queue wait estimates, attendance labels, live-board URL resolution, scoring
  validation, session standings/podium ranking, and team grouping helpers.

### Screens
- **Home** — scan a Live Board or sign in.
- **Scanner** — `CameraView` QR scan; resolves a token from a full URL or a bare
  UUID and routes to the Live Board.
- **Live Board** — anonymous, read-only: courts and running scores, up next and
  preparing lineups, queue, off-court players, and published standings.
- **Organizer** (`(organizer)` group, guarded): clubs (with create), sessions
  (with create), and the session runner.
- **Session runner** — start/end, share the Live Board link, suggest a matchup
  (runs the matching engine client-side), promote/demote/assign/cancel lineups,
  edit lineups, manage attendance, and view standings.
- **Match** — edit the lineup before play, tap-to-score with local validation,
  save a running score, and complete the match.

## Decisions and trade-offs

- **typedRoutes off.** The generated route manifest lives in `.expo/`, which is
  git-ignored and only regenerates while the dev server runs. Leaving it on made
  `tsc` fail on a fresh checkout against a stale manifest. Hrefs use canonical
  paths (`/clubs`, not `/(organizer)/clubs`), so turning it back on later is a
  one-line change.
- **Client-side matchmaking.** The web app proposes lineups in a server action.
  On mobile the engine runs on-device (it is pure, and the roster is already
  loaded); `create_preparation_lineup` still re-validates availability, so a
  stale proposal is rejected rather than double-booking a player.
- **QR sharing via the OS share sheet.** The Live Board link is built from
  `EXPO_PUBLIC_APP_URL`; a loopback fallback is flagged as unreachable from
  another device. No in-app QR renderer dependency was added.
- **Public standings come from the RPC, not the view.** The anonymous Live
  Board takes its leaderboard from the standings embedded in the
  `get_player_live_board` RPC payload — the exact source the Next.js live board
  uses. The `public_session_standings` view requires `sessions.is_public` and
  `clubs.is_public`, but `start_session` never sets `is_public` (only
  `player_live_enabled`), so the view would return nothing for a token-enabled
  but non-public session. The authenticated `session_standings` view is only
  used by the organizer session screen.

## Not done / follow-ups

- Logout is a placeholder button; image/logo upload and rich club settings are
  not ported.
- Score correction (`correct_match_score`) has a mutation wrapper but no screen.
- No end-to-end test against the live project; verify camera, Realtime, and the
  RPC surface on a device.
