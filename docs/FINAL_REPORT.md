# PickleBoard Live Board Final Report

## Delivered

- Session-specific anonymous route: `/live/[publicToken]`.
- The database creates a unique UUID capability in the atomic Start Session
  transaction; draft sessions have no active token or QR.
- Duplicate Start submissions return the existing token instead of rotating it.
- Legacy session-id and ambiguous club-live routes are not player access paths.
- Organizer QR dialog with copy, open, PNG download, presentation-size QR, and
  readable URL controls.
- QR generation is local through `qrcode`; no URL is sent to an image service.
- Loopback origins are never encoded into a QR. The exact cross-device warning
  is rendered instead.
- Mobile-first public header, live courts, persisted timers, running scores, Up
  Next, queue order/status/wait estimates, and full zero-game leaderboard.
- Five-game podium qualification with accessible gold, silver, and bronze rows.
- One scoped Realtime channel per board, reconnect refresh, 20-second fallback
  polling, last-updated time, and channel/timer cleanup.
- Sanitized public attendance view and publish-gated public aggregates; no auth
  id, email, membership, audit, or private settings fields.
- Anonymous Realtime base-table grants are column-scoped, and session lifecycle
  changes are included in the Realtime publication.
- Organizer-only `set_running_score` RPC with a safe search path and final-score
  protection. Final results still go through `complete_match` atomically.
- Public sessions atomically publish their final results when ended, so scanned
  phones transition to the completed message instead of losing the board.
- `get_player_live_board(uuid)` returns the complete sanitized board payload and
  never includes the capability token, auth ids, membership, or audit data.

## Automated Verification

| Check | Result |
| --- | --- |
| Session-specific QR | PASS |
| Absolute LAN/public URL | PASS |
| QR excludes localhost in production | PASS |
| Localhost warning and QR suppression | PASS |
| Public access without login | PASS |
| Live Courts and running score | PASS |
| Persisted match timer | PASS |
| Up Next | PASS |
| Waiting queue and estimates | PASS |
| Zero-game leaderboard players | PASS |
| Podium qualification | PASS |
| Realtime subscriptions/reconnect refresh | PASS |
| Public RLS/Realtime/token protection, local SQL | PASS: 167 assertions |
| Public RLS/Realtime/token protection, cloud SQL | PASS: 167 assertions |
| No organizer controls exposed | PASS |
| No duplicate React key warnings | PASS |
| TypeScript | PASS |
| Lint | PASS |
| Tests | PASS: 297 tests across 20 files |
| Production build | PASS |

A deliberately false assertion was injected into a copy of the SQL suite to
confirm the harness fails loudly instead of silently passing; it exited non-zero
on the expected line, locally and against the cloud database.

## Manual Cross-Device Verification

Phone scan is **NOT RUN** in this workspace: no physical phone, published test
session, or organizer test credentials are available to the coding agent. Run:

```bash
npm run dev -- --hostname 0.0.0.0
```

with a non-loopback `NEXT_PUBLIC_APP_URL`, then follow the checklist in the
README. Do not change firewall settings automatically; a blocked connection can
require a manual firewall rule or disabling Wi-Fi client isolation.

## Cloud Status

The linked cloud project now matches local. Applied and verified there:

- `20260101000010_public_live_board.sql`
- `20260101000012_public_realtime_column_grants.sql`
- `20260101000013_session_player_live_tokens.sql`

`20260101000011_keep_public_board_after_end.sql` is intentionally **not** applied
on cloud. It only replaced `end_session` to publish final results, and migration
13 replaced the same function with a version that publishes when
`player_live_enabled or is_public`. Applying 11 afterwards would silently roll the
token behaviour back, so the later definition is the one that ships. Local
migrations are untouched.

Cloud verification confirmed: token columns, the unique token index, the four
public RPCs, the `sessions` Realtime publication, `public_session_presence`, and
that `anon` still cannot select `public_live_token`, update `matches`, or run the
organizer RPCs — while `anon` can execute `get_player_live_board(uuid)`. The full
RLS/token suite passes on cloud as well as locally.

Cloud applies were run with `supabase db query --linked`, which does not write to
`supabase_migrations.schema_migrations`. Recorded history on cloud therefore still
lists only the migrations applied before that approach, and a future `db push`
would try to re-apply 10, 12, and 13. Those scripts are written to be safe to
re-run (the additive parts use `if not exists` and the function/view definitions
use `create or replace`), but the cleanest resolution is to reconcile history
with `supabase db push` once a direct database password is available.
