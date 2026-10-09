# PickleBoard Implementation Progress

_Last updated: Fri Oct 02 2026 09:40 UTC_

## Summary
- Overall progress: 90%
- Current task: Authenticated end-to-end verification once a test account can be created
- Tests passed: 106 unit tests across 7 files, plus 75 SQL authorization assertions
- TypeScript: Passing (`npx tsc --noEmit`)
- Lint: Passing (`npm run lint`)
- Production build: Passing
- Current errors/blockers: No build or type errors. Authenticated E2E blocked: no test account can be created.


## Detailed Status

### 1. Foundation and configuration

- ✅ Completed Inspect repository and conventions
- ✅ Completed Create docs/IMPLEMENTATION_PLAN.md
- ✅ Completed Set up product config (PickleBoard name)
- ✅ Completed Update metadata/layout and shell
- ✅ Completed .env.example (safe placeholders)

### 2. Supabase database and migrations

- ✅ Completed Link cloud project
- ✅ Completed Core schema + enums + constraints
- ✅ Completed RPC functions (atomic writes)
- ✅ Completed RLS policies + grants + Realtime
- ✅ Completed Public views (clubs/sessions/results/standings)
- ✅ Completed Public live courts and lineups views
- ✅ Completed Migrations 00–05 applied (local + cloud)

### 3. Authentication

- ✅ Completed Supabase Auth email/password flows
- ✅ Completed Auth gating via proxy (Next 16)
- ✅ Completed Sign in/up/reset/update/error pages

### 4. Club and player management

- ✅ Completed Create club (server action + RPC)
- ✅ Completed Club dashboard + roster CRUD
- ✅ Completed Player skill 1–6 + archive

### 5. Session and court management

- ✅ Completed Create/update sessions
- ✅ Completed Session list + settings
- ✅ Completed Courts, ladder, stage/start games
- ✅ Completed Live session screen (organizer)

### 6. Queue system

- ✅ Completed Check in/out/break/requeue
- ✅ Completed Queue positions and wait helpers
- ✅ Completed Starvation: timesSkipped >= 2 enforced

### 7. Matching algorithms

- ✅ Completed FIFO, Balanced, Skill-Separated engines
- ✅ Completed Deterministic tie-breakers + tests
- ✅ Completed Matchmaker UI with explanation

### 8. Scoring

- ✅ Completed Score validation + tests
- ✅ Completed Complete/cancel/correct match RPCs
- ✅ Completed Record score UI

### 9. Leaderboards

- ✅ Completed Session standings + all-time club leaderboard
- ✅ Completed Ranking logic + tests

### 10. Realtime public view

- ✅ Completed Public club page (/c/[slug])
- ✅ Completed Public live board (/s/[sessionId])
- ✅ Completed Live QR/share + live refresh (organizer + public)

### 11. Security and RLS

- ✅ Completed RLS suite passes locally + runs against cloud
- ✅ Completed Anon cannot read private data; only public views
- ✅ Completed Writes behind RPCs with auth checks

### 12. Testing and production build

- ✅ Completed Unit tests: 98 passed across 6 files
- ✅ Completed TypeScript: no errors
- ✅ Completed Production build: succeeds (24 pages, clean cache)
- 🔄 In Progress Playwright E2E: blocked, `./e2e` dir still to be created
- ✅ Completed Lint: `npm run lint` passes with 0 errors
- ❌ Blocked Authenticated E2E run: no test account can be created

## Notes

- Migrations 00–05 pushed to linked cloud Supabase.
- All domain logic covered by Vitest (matching, scoring, queue, leaderboard).

## Server Action import correction

### Original cause

A `"use server"` module may only export async functions. `app/actions/session-actions.ts`
also exported `idleState`, a plain object literal, so Next's runtime guard
`ensureServerEntryExports` raised:

    A "use server" file can only export async functions, found object.

The shared state was moved to `app/actions/session-action-state.ts`, which has no
`"use server"` directive, so its exports stay ordinary runtime values. The action
module now imports the type and re-exports neither symbol.

### Files changed

Action modules (already migrated before this pass, verified here):

- `app/actions/session-action-state.ts` - holds `ActionState` and `idleState`
- `app/actions/session-actions.ts` - 22 async Server Actions, no runtime exports
- `app/actions/matchmaking-actions.ts` - 2 async Server Actions, no runtime exports

Components corrected in this pass (9 files, 14 TypeScript errors):

- `components/clubs/members-panel.tsx`
- `components/clubs/roster-list.tsx`
- `components/forms/form-error.tsx`
- `components/session/court-card.tsx`
- `components/session/queue-panel.tsx`
- `components/session/session-controls.tsx`
- `components/sessions/add-session-players.tsx`
- `components/sessions/create-session-form.tsx`
- `components/sessions/session-settings-form.tsx`

Already correct, no change needed (3 of the 12 originally listed):
`add-player-form.tsx`, `club-settings-form.tsx`, `create-club-form.tsx`.

Lint baseline fixes, both pre-existing and unrelated to the import change:

- `eslint.config.mjs` - ignore `.next/**` so generated build output is not linted
- `tailwind.config.ts` - ESM import for `tailwindcss-animate` instead of `require()`

### The import correction

Each component now keeps two separate imports. Action functions stay sourced from
the `"use server"` module, and the shared state moves to the plain module:

```ts
import { createClubAction } from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
```

Type-only consumers use
`import type { ActionState } from "@/app/actions/session-action-state";`
(`roster-list.tsx`, `form-error.tsx`, `add-session-players.tsx`,
`session-settings-form.tsx`).

No `useActionState` call, form field, validation rule, Supabase RPC call, RLS
policy, matching rule, scoring rule, or UI behaviour was altered.

### Verification results

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript | `npx tsc --noEmit` | PASS, 0 errors (was 14) |
| Lint | `npm run lint` | PASS, 0 errors, 0 warnings (was 15998) |
| Unit tests | `npx vitest run` | PASS, 98 tests in 6 files |
| Production build | `rm -rf .next && npm run build` | PASS, 24 pages generated |
| Dev server | `npm run dev` | PASS, no `use server` error in log |

Runtime route check against the dev server:

| Route | Result |
| --- | --- |
| `/` | 200 |
| `/auth/login` | 200 |
| `/auth/sign-up` | 200 |
| `/protected` | 307 to `/auth/login` |
| `/clubs/new` | 307 to `/auth/login` |
| `/clubs/<id>/settings` | 307 to `/auth/login` |

Proof the export error is gone: the compiled runtime export table for
`session-actions` in `.next/server/chunks/ssr/_1uy5cm1._.js` lists 21 entries, all
function bindings, with neither `idleState` nor `ActionState` present. That table
is the argument to `ensureServerEntryExports`, the guard that raised the original
error, so an object export would appear there and throw.

### Runtime Create Club test

Not completed. `createClubAction` was invoked over the wire against the
production server using its server-reference id; the request returned
`307 -> /auth/login`, because `lib/supabase/proxy.ts` correctly gates the POST
before the action module loads. Reaching the form requires a signed-in organizer,
which needs a test account, and the project cannot create one:

- `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` in `.env.local` are empty placeholders.
- `POST /auth/v1/signup` returns `429 email rate limit exceeded`, then
  `400 email_address_invalid` once the limit is hit. No account can be created.

The action module is confirmed to compile and export only async functions, so the
original error cannot recur; only the authenticated round trip is unproven.

### Remaining blocker

- ❌ Blocked: authenticated end-to-end verification. Needs one of: the Supabase
  email rate limit reset, an account created in the Supabase Dashboard, a
  service-role key for test-account setup, or real credentials in `.env.local`.
- 📌 Deferred: `stageMatchAction` in `session-actions.ts` is not referenced by any
  page or component, so the bundler tree-shakes it out. Dead code, unrelated to
  this fix, left in place.
- ⏳ Pending: Playwright specs. `playwright.config.ts` points at `./e2e`, which does
  not exist, so `npm run test:e2e` currently fails for want of any spec.

## Session roster relationship fix

### Symptom
On draft session `86b50636-a64d-49bd-843a-12cbb9fd4d04` (club `gpt`), AG and
JAYSON showed "not here yet" and their Check In button failed with "That player
is not on this club roster".

### Cause
Not a data, RLS, or query problem. The database was correct: all nine roster
rows belonged to the owning club, and the nested join in `getSessionBundle` was
already right.

`session_players` carries two ids: `id` (the row's own primary key) and
`player_id` (the club player). `components/session/queue-panel.tsx` passed
`player.id` to the attendance actions, which forward it as `p_player_id`. The
RPCs resolve `players.id`, so every write failed. `check_in`, `check_out`, and
`set_break` all shared the same prop and were all broken.

Cloud data confirmed the split on every row, for example AG:
`players.id = ceae9a1a-e751-4875-8ce0-40192dd3e8ce` but
`session_players.id = 1dc6daa2-84e9-4ac7-b683-101fcc841674`.

### Files changed
- `components/session/queue-panel.tsx` — pass `attendancePlayerId(player)`
  (`player_id`) instead of `player.id`; use the shared labels; suppress actions
  for an unresolvable roster row.
- `lib/domain/queue/attendance.ts` (new) — label map, `rosterStateLabel`,
  `needsCheckIn`, and `attendancePlayerId`.
- `lib/domain/queue/attendance.test.ts` (new) — 13 unit tests.
- `lib/db/types.ts` — `SessionPlayer.player_missing`.
- `lib/db/queries.ts` — set `player_missing` from the left join instead of
  substituting a fake `"Unknown"` name.
- `supabase/migrations/20260101000006_add_session_players_club_guard.sql` (new).
- `supabase/tests/rls_verification.sql` — new section 8b, plus a fix to every
  pre-existing expect-failure assertion (see below).

### Migration and RLS status
No RLS policy was changed. Migration 06 redefines `add_session_players` so it
raises `22023` when any requested id is not a player of the owning club. The
old version filtered cross-club ids out of the insert and returned a smaller
count with no explanation, which read as "already on the session".

Applied to the linked cloud project and verified present.

### State labels
`checked_out` was labelled "not here yet", which is what made a correct roster
look broken. It now reads "Not checked in". Also corrected: "Waiting",
"Getting ready", "Playing", "On break", "Done for the day". A roster row whose
player does not resolve now reads "Player record unavailable" and offers no
button, instead of a Check In that is guaranteed to fail.

### Test suite defect found and fixed
While adding the regression, all 21 "this must be rejected" assertions turned
out to be reporting `PASS` unconditionally. The idiom was:

    begin
      perform some_rpc(...);
      perform pg_temp.pb_assert(false, 'should have been rejected');
    exception when others then
      perform pg_temp.pb_assert(true, 'is rejected');
    end;

`pb_assert(false, ...)` raises its own exception, so the enclosing
`exception when others` swallowed the failure and the second assert confirmed a
pass. Every RLS and rejection check in the file, including 10 security
assertions, could not fail.

Rewritten to set a flag that only a genuine raise can set:

    v_raised := false;
    begin
      perform some_rpc(...);
    exception when others then
      v_raised := true;
    end;
    perform pg_temp.pb_assert(v_raised, 'is rejected');

Also scoped the `handle_new_user` profile count to the four fixture users, which
is what lets the suite run against the cloud project where real rows exist.

### Regression coverage added
Section 8b of `supabase/tests/rls_verification.sql`, run as the club owner:
same-club player added to a draft session; appears as not checked in with no
queue position; `session_players.id` is rejected by `check_in_player` while
`players.id` succeeds; status becomes `waiting` with queue position 1;
cross-club id rejected and not inserted; a batch containing a cross-club id is
rejected in full.

Both halves were mutation-tested, because the original version of this test
passed against the broken code:
- installing the pre-fix `add_session_players` produced `FAIL: a cross-club
  player is rejected`
- granting a permissive insert policy on `players` produced `FAIL: a non-member
  cannot insert a roster player`

### Verification results
| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passing |
| `npm run lint` | Passing |
| `npm test` | 106 passed across 7 files |
| `npm run build` | Passing |
| SQL suite, local Postgres | 75 assertions, all passing |
| SQL suite, linked cloud | Completes with no failure |

Target session data re-read after the change: all nine rows unchanged, still
`checked_out`, still same-club. Nothing was deleted or recreated.

## Notes

- Migrations 00-06 pushed to the linked cloud Supabase project.
- All domain logic is covered by Vitest; the SQL authorization suite passes locally.
- `npm run lint` now passes outright. The `.next/**` ignore is what makes that possible.

## Live board: zero-stat standings and working public updates

### Symptom

Starting a draft session produced no Live Courts, no Up Next, no Waiting Queue and
no leaderboard, and the public board never refreshed.

### Cause

Four separate defects, only the first of which was the attendance bug from the
previous entry.

1. **Start Session was refused.** `start_session` requires at least four checked-in
   players and the session screen was sending `session_players.id` where
   `check_in_player` wanted `players.id`, so nobody was ever checked in. The target
   session stayed a `draft` with no courts and no board. This was the fix already
   recorded above.

2. **The standings view only counted completed games.**
   `public_session_standings` was `select ... from public_match_results group by`.
   `public_match_results` holds one row per player per *completed* match, so a
   checked-in player with no finished game produced no row at all. On a freshly
   started session that is every player, which is why the board looked empty until
   the first score was entered. Both standings views now start from
   `public.session_players` and LEFT JOIN the completed-match totals, so a zero-game
   player is a genuine row of zeroes rather than a missing row.

3. **The UI had no place to show any of it.** The organizer screen had no standings
   section at all, and the public board had no Up Next or Waiting Queue. The public
   standings also hid behind a "No games recorded yet." empty state, which is the
   same bug wearing a different hat.

4. **The public realtime subscription could never fire.**
   `PublicLiveRefresh` subscribed to `public_live_courts` and
   `public_match_lineups`. Both are views, and Postgres only emits `postgres_changes`
   for tables in the realtime publication, so the websocket connected, the
   indicator turned green, and the board stayed stale until the 20-second fallback
   poll. It now subscribes to the four published base tables —
   `courts`, `matches`, `match_players`, `session_players` — which is what the
   board is actually built from. This widens no exposure: all four are already
   readable by `anon`, and the sanitized views are themselves derived from them.

### A second bug found while fixing the first

`session_standings` was declared `security_invoker = true` but read its totals from
an ungranted `private.session_match_totals` helper. A `security_invoker` view
checks the *caller's* privileges on every relation it reads, so every signed-in
organizer query failed with `permission denied for view session_match_totals` —
while the SQL suite passed, because it read the view as the database owner, and an
owner bypasses privilege checks entirely. The suite proved nothing about the path
that was broken.

Fixed by inlining the totals aggregate directly over `matches` / `match_players` in
the `security_invoker` view. That keeps every row of the aggregate inside the
caller's RLS reach. Granting `authenticated` on the private helper would also have
worked but would have handed every signed-in user an unfiltered per-player,
per-session history for sessions they are not a member of. The `private` helper
stays, for the owner-privilege public view that does not have this constraint.

### Start Session still does not start a match

Unchanged and now asserted directly: `start_session` only flips the session to
`active` and creates the courts. Staging a match remains a separate organizer
action, and a score cannot be recorded until the match is actually started.

### Files changed

| Area | File |
| --- | --- |
| Migration | `supabase/migrations/20260101000007_session_standings_and_public_queue.sql` |
| SQL suite | `supabase/tests/rls_verification.sql` |
| Queries | `lib/db/queries.ts` — `getSessionStandings`, `getPublicSessionQueue` |
| Types | `lib/db/types.ts` — `SessionStanding`, `PublicSessionQueueRow` |
| Public board | `app/s/[sessionId]/page.tsx` |
| Organizer board | `app/sessions/[sessionId]/page.tsx` |
| Shared UI | `components/session/standings-table.tsx`, `up-next.tsx`, `waiting-queue.tsx` |
| Public realtime | `components/session/public-live-refresh.tsx` |
| Organizer realtime | `components/session/live-refresh.tsx` |
| Domain logic | `lib/domain/leaderboard/standing-rows.ts`, `lib/domain/session/up-next.ts` |

### Migration and RLS status

Three read models, two deliberately different mechanisms:

| View | Access | Mechanism |
| --- | --- | --- |
| `session_standings` | `authenticated` only | `security_invoker`, RLS filters it, totals inlined |
| `public_session_standings` | `anon`, `authenticated` | plain view, its own `is_public` filter is the boundary |
| `public_session_queue` | `anon`, `authenticated` | plain view, publish-gated, no `player_id` |

Verified on the linked project: `anon` has no grant at all on `session_standings`,
and the private helper is granted to neither role.

### Regression coverage added

Section 10 of the SQL suite covers the live board end to end: a refused start
leaves the session a draft; check-ins flip it to `active` without creating a match;
all arrived players are waiting, nobody got checked in automatically; standings show
every arrived player at zero before any game; staging does not make a match playing
and a score before starting is refused; after one completed doubles match the four
players on it have one game with correct wins, losses and points while the waiting
player stays at zero and the player who never checked in is absent entirely.

Section 11 reads `session_standings` **as `authenticated`** — the assertion that was
missing — and also proves the inline aggregate does not leak a private session's
standings to another club's member, plus that the owner still reads their own.

New assertions were mutation-tested rather than trusted:

- restoring the pre-fix completed-matches-only `public_session_standings` produced
  `FAIL: the public standings view shows one row per arrived player, played or not`
- rebuilding `session_standings` to read the ungranted private helper produced
  `ERROR: permission denied for view session_match_totals`

Two pre-existing test defects were also fixed: a section-10 scenario that reused
players already held by an unresolved staged match (the one-unresolved-match-per-player
index is global, not per session, so it now uses its own fixture players), and an
unscoped `count(*) from public.courts = 0` assertion that failed on cloud simply
because the database has real courts.

### Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passing |
| `npm run lint` | Passing |
| `npm test` | 127 passed across 9 files |
| `npm run build` | Passing, routes unchanged (◐ partial prerender) |
| SQL suite, local Postgres | 106 assertions, all passing |
| SQL suite, linked cloud | Completes with no failure |

Target session data re-read after the change: all nine roster rows still
`checked_out`, still same-club. Nothing was deleted or recreated.

### Browser verification

Rendered both public boards in headless Chromium with no console errors. Both
correctly show the "This board is not available" state: the only active session on
the linked project belongs to a club that is not published, and there is no session
with both the session and its club published, so the publish gate is doing its job.

What could **not** be verified in a browser, and why:

- The rendered board itself, because that needs a published session and a published
  club. Creating them on the linked project means writing to real data, so it was
  left for an explicit decision rather than done unasked.
- The organizer screen, because the proxy redirects to `/auth/login` without a
  session and no test credentials are configured.
- Two windows updating live, for the same reason.

The data layer underneath all three is covered by the SQL assertions above, run
against both the local database and the linked project.

---

## Duplicate React keys on "Up next" and the public court cards

### Symptom

The board logged duplicate keys `1-1` and `2-2` from `components/session/up-next.tsx:66`,
where the key was:

```
key={`${row.team_number}-${row.slot_number}`}
```

Every other key on the public board was derived from a display name, which is
also not unique on a club.

### Cause

Two separate defects, both real:

**1. `stage_match` numbered slots off the wrong thing.** The RPC derived the slot
from the player's ordinality in the *whole* incoming array:

```sql
((sel.ord - 1) % 2) + 1
```

That is only correct if the array arrives grouped by team. It does not:
`lib/domain/matching/shared.ts:toProposalPlayers` counts slots per team over
queue order, so the teams come out interleaved:

```
[A(team 1), B(team 2), C(team 1), D(team 2)]
```

which the formula stored as `(1,1) (2,2) (1,1) (2,2)`. Both of team 1's players
were in slot 1 and both of team 2's in slot 2, so two list children shared each
key. `app/actions/matchmaking-actions.ts` drops `slotNumber` when calling the
RPC, so the caller could not correct this.

**2. Nothing in the database prevented it.** `match_players` was unique on
`(match_id, player_id)`, which stops one player appearing twice in a match, but
not two *different* players sharing a slot.

The join was not at fault. `public_match_lineups` is a plain join and
`courts` is unique on `(session_id, court_number)`, so no query fanned out and no
row was duplicated. The rows really were in the database that way.

### Fix

`supabase/migrations/20260101000008_match_player_slot_uniqueness.sql`, forward-only:

1. **Repair.** Renumber slots per team, ordered by row id so it is deterministic.
   Matches that were already correct come out identical. Matches with a team
   holding more than two players abort the migration rather than push a row past
   the `slot_number` check. `complete_match` and `cancel_match` both read slots
   only for ordering, and `stage_match` is the only writer, so no other code
   changes behaviour.
2. **Constrain.** `unique (match_id, team_number, slot_number)`, added after the
   repair so it cannot fail on existing rows.
3. **Fix the writer.** The slot is now the player's ordinality *within its team*:

   ```sql
   row_number() over (partition by sel.team order by sel.ord)::smallint
   ```

   The function is reproduced from `0001` apart from that one expression, so
   `security definer`, the `search_path`, the court-status update, the queue event
   log, and the `times_skipped` increment all carry over unchanged.

Deriving the column from array position was the actual defect. Sorting the
caller's arrays by team would have hidden it and left the RPC one refactor away
from corrupting slots again.

4. **Stable list keys.** The public views deliberately expose no user, player, or
   auth id, which left no stable way to key a React list. Two surrogate keys on
   join tables resolve to no person, so the views now also expose:

   - `public_match_lineups.lineup_id` = `match_players.id`
   - `public_session_queue.queue_entry_id` = `session_players.id`

   The existing sanitizing assertion still passes: neither column is a `user_id`,
   `created_by`, `email`, or audit actor, and a new assertion checks that a
   `lineup_id` resolves to neither a player nor a profile.

Keys now used:

| List | Was | Now |
| --- | --- | --- |
| `Up next` players | `team_number-slot_number` | `lineup_id` (`match_players.id`) |
| `Waiting queue` rows | `queue_position-display_name` | `queue_entry_id` (`session_players.id`) |
| Public court players | `display_name` | `lineup_id` |

`queue_position` was not usable as a key on its own: positions are reused as
players cycle through matches, so a returning player could inherit the previous
occupant's element. `display_name` was not usable at all.

### Cloud data repaired

Twelve rows across three matches, before and after:

| Match | Status | Repair |
| --- | --- | --- |
| `09979730-a782-44f4-b69e-278b42b9a0f9` | completed | 4 players, slots renumbered 1/2 per team |
| `e09d993d-d16e-4edf-bbaa-81bab88d2f0d` | completed | 4 players, slots renumbered 1/2 per team |
| `a3422a49-b5e9-42e6-a9cd-7c4aa7763e39` | playing | 4 players, slots renumbered 1/2 per team |

Every `result`, `points_for`, and `points_against` is unchanged. Only the slot
label moved, so no recorded game was rewritten. Post-migration: zero duplicate
`(match_id, team_number, slot_number)` triples, 32 `match_players` rows retained.

### Regression coverage

`supabase/tests/rls_verification.sql` section 10a and 10b:

- `stage_match` given deliberately **interleaved** `[1,2,1,2]` produces zero
  duplicate slots. Ordering the arrays by team instead would have hidden the bug
  rather than fixed it.
- Each team gets exactly one slot 1 and one slot 2, and all four players stay on
  the match.
- A direct insert that would double-occupy a slot is rejected by the constraint,
  so the guarantee is in the database and not only in the RPC.
- No match anywhere holds two players in one slot, which also covers pre-existing
  rows.
- Both public views expose their surrogate key, every row's key is non-null, and
  a `lineup_id` resolves to no player or profile.

Verified against local Postgres and the linked project. The cloud run was also
checked with a deliberately broken assertion to confirm the suite fails loudly
there rather than passing silently.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passing |
| `npm run lint` | Passing |
| `npm test` | 129 passed across 9 files |
| `npm run build` | Passing, routes unchanged (◐ partial prerender) |
| SQL suite, local Postgres | 117 assertions, all passing |
| SQL suite, linked cloud | Completes with no failure |
| Cloud duplicate slots after migration | 0 |

### Browser verification

Not performed for this fix. It is a data and identity correction covered by the
assertions above; rendering it in a browser needs the same published session,
organizer credentials, and two-window setup that were unavailable earlier.

## Elapsed game timer and five-game podium

Two features on the live board: a per-court elapsed game timer, and medal
decoration on the standings that only appears once a player has actually
finished five games.

### Elapsed game timer

Both timestamp columns already existed. `matches.started_at` and
`matches.completed_at` were written by `start_match` and `complete_match`, and
`public_live_courts` already exposed them as `match_started_at` and
`match_completed_at`. So the read path needed nothing new. What was missing was
anything keeping the pair honest:

- `start_match` wrote `started_at = now()` unconditionally. It returned early
  when the match was already playing, so the column was safe in practice, but a
  repeated start was one refactor away from resetting a running clock. Now it
  writes `coalesce(started_at, now())`, which makes the first start win
  regardless.
- Nothing stopped `completed_at` from landing before `started_at`.
- No constraint stopped it either, so a future write path could introduce it.

Migration `20260101000009_match_timing.sql` addresses all three: the coalesce
above, `greatest(now(), coalesce(v_match.started_at, now()))` in
`complete_match`, and a `matches_completed_after_started` check constraint. It is
forward-only and rewrites no existing row.

`started_at` is deliberately still nullable. Legacy rows predate the column
being populated, and the board renders "Timer unavailable" for a playing match
with no start time instead of inventing one. Making it NOT NULL would have turned
a visible anomaly into unreadable rows.

The clock itself is derived, not stored. `MatchTimer` reads `started_at`, ticks
locally every second, and re-derives from the timestamp rather than incrementing
a counter. Three consequences follow directly: a reload resumes rather than
restarts, two devices agree, and a stale tab corrects itself on its next tick
instead of drifting. No timer writes to the database at all -- the per-second
cost is zero, and the component test asserts `fetch` is never called while
ticking.

Formatting is `mm:ss` under an hour and `h:mm:ss` past it. A completed match
freezes at `completed_at - started_at`, a cancelled one reads "Cancelled", and a
playing match with no start reads "Timer unavailable" and logs an error.

Completed-match history renders the same `formatElapsed` output, so the final
duration in the history matches the clock that was on screen.

### Five-game podium

`PODIUM_REQUIRED_GAMES = 5`. Players below it stay in the table, in place, with
the exact shortfall spelled out ("1 more game to qualify"), because a leaderboard
that hides the people you are about to play looks broken.

Medals are assigned by position among qualified players in the leaderboard's own
order, tracked by `player_id`. Ties on rank share the ordinal ("1st", "1st") but
not the medal -- three players tied for first and none for second take gold,
silver and bronze. That is the decision worth stating plainly, since the
alternative (one medal per distinct rank) meant three tied leaders could take
only gold and nobody took bronze.

A single qualified player takes gold even if unqualified players sit above them.
The medal is recognition for playing enough games, not a reflection of overall
position.

Accessibility: the medal glyph and the visible ordinal are both `aria-hidden`
when a podium place is shown, and a single `sr-only` label announces
"1st place, gold". Colour is never the only cue -- the row tint is backed by a
left border in the same hue, and non-medal rows keep a muted ordinal.

### Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passing |
| `npm run lint` | Passing |
| `npm test` | 228 passed across 13 files |
| `npm run build` | Passing, routes unchanged (◐ partial prerender) |
| SQL suite, local Postgres | 128 assertions, all passing |
| SQL suite, linked cloud | Completes with no failure |
| Cloud migration 09 | Both RPCs and the check constraint present |

Component tests are new. `vitest.config.mts` now includes `components/**/*.test.tsx`
and loads `@vitejs/plugin-react`; per-file `// @vitest-environment jsdom` pragmas
keep the pure helpers under `lib/` on the faster node environment. 37 new tests
cover timer ticking, reload, completion, per-court independence, interval
cleanup, podium qualification at the fifth game, tie handling, and stable keys
under repeated realtime refreshes.

Two fixture problems surfaced while writing the SQL section and are worth
recording. Section 10b leaves its four players on an unresolved match, and
`match_players_one_unresolved_per_player` is unique per player rather than per
session, so section 10c needed four new players instead of reusing them. And
`complete_match` credits a win to each player on the winning team, so a doubles
match banks 2 wins, not 1 -- an assertion expecting 1 failed and the expectation
was wrong, not the function.

The cloud run was checked with a deliberately false assertion to confirm the
suite fails loudly there rather than passing silently; it exits non-zero and
names the failing assertion.

### Browser verification

Not performed for either feature. Both need the same published session,
organizer credentials, and two-window setup that were unavailable earlier, and
the timer additionally needs two devices to confirm the two views agree. The
component tests cover the reload and multi-court properties directly with fake
timers, but they are not a substitute for watching a real game on a real clock.

## QR Code Player Live Board

The public board uses one session-specific capability URL:
`/live/[publicToken]`. The token is a random UUID created by the database when
Start succeeds; neither club discovery nor a session id grants the player view.

The organizer dashboard now provides **Show QR Code**, **Copy Link**, and **Open
Player View**. The dialog generates a high-error-correction PNG locally, can fill
the screen, downloads the same PNG, and displays the session, club, and readable
URL. A loopback origin is never encoded. With no reachable configured/browser
origin, the dialog displays the required `NEXT_PUBLIC_APP_URL` warning instead.

The player page is mobile-first and read-only: session facts and elapsed time,
connection/last-updated state, active court cards with running score and persisted
timer, staged Up Next lineups, sanitized attendance/queue rows with wait clocks
and estimates, and the full zero-game-inclusive podium leaderboard. It imports
none of the organizer mutation controls.

Migration `20260101000010_public_live_board.sql` appends aggregate duration and
score fields to existing publish-gated views, adds `public_session_presence`,
starts public standings from every session roster row, and adds organizer-only
`set_running_score`. The RPC locks session then match like the final-score path,
uses a safe search path, rejects non-organizers and non-playing matches, and
refuses a legal final score so `complete_match` remains the atomic results path.
Migration `20260101000011_keep_public_board_after_end.sql` keeps an already-public
session published as final results when it ends, which lets every connected phone
transition to the completed message instead of losing the board.
Migration `20260101000012_public_realtime_column_grants.sql` adds session lifecycle
changes to the Realtime publication and narrows anonymous base-table grants to
the columns required for scoped subscriptions. Player ids, creator ids, auth
data, membership data, and internal queue metadata are not readable through the
socket's base-table permissions.

Realtime uses one session-scoped channel over sessions, courts, matches,
match_players, and session_players. Reconnection triggers a full Server Component
refresh; fallback polling covers venue Wi-Fi that blocks WebSockets; unmounting
removes the channel and every timer.

### Verification

| Check | Result |
| --- | --- |
| URL/domain/component tests | Passing |
| `npx tsc --noEmit` | Passing |
| `npm run lint` | Passing |
| `npm test` | 297 tests across 20 files |
| `npm run build` | Passing; `/live/[publicToken]` is partial prerendered |
| SQL suite, local Postgres | 167 assertions, all passing |
| SQL suite, linked cloud | 167 assertions, all passing |
| Phone scan | Not run: physical phone and published test fixture unavailable |

Local phone and production origin instructions are in `README.md` and
`.env.example`. The requested private-LAN example is documented; no credential or
production secret was committed.

## Session-specific Player Live View token

The QR target is now session-specific: `/live/[publicToken]`. Migration
`20260101000013_session_player_live_tokens.sql` adds a partial unique index over
UUID capability tokens and creates/enables the token in the same locked
`start_session` transaction that validates organizer permission, draft state,
minimum attendance, court creation, status, and database `started_at`.

Repeated Start submissions are idempotent: an already-active session returns the
same token and does not move `started_at`. Draft sessions have a null token and a
disabled Player Live View, and the organizer page displays “Start the session to
activate the Player Live View and QR code.”

The anonymous route calls `get_player_live_board(uuid)`, one security-definer RPC
with a fixed search path and explicit token/status checks. It returns session
facts, courts, active lineups, sanitized attendance, and zero-game-inclusive
standings in one JSON payload. It returns no token, email, auth id, membership,
audit data, or private settings. Invalid/revoked tokens render their own safe
message; draft, active, and completed states remain distinct.

The older `/c/[slug]/live` discovery route was removed and `/s/[sessionId]` no
longer grants player access. QR URLs are always absolute and use the configured
origin (the current LAN test is `http://10.9.21.83:3000`) or a reachable browser
origin. Loopback and `0.0.0.0` are never encoded.

One shared resolver decides that, and the Start action uses it too, so the link
the organizer copies and the link the QR encodes come from the same rules. A
wildcard bind address (`0.0.0.0`, `::`) is rewritten to `localhost` rather than
returned, because it is a bind address rather than a destination and would
produce a code that resolves nowhere.

`canShowPlayerLiveQr` gates the dialog on the token and the enabled flag, and
allows `active` and `completed` but never `draft` or `cancelled`. Completed is
included because `end_session` keeps the token and the published results, so the
organizer can still hand the same link to somebody who missed the session.

### Token verification

| Check | Result |
| --- | --- |
| Draft session has no token and no QR | PASS |
| Start creates and enables the token atomically | PASS |
| Repeated Start does not rotate the token | PASS |
| Token opens the board as `anon` with no login | PASS |
| Unknown token resolves nothing | PASS |
| Payload excludes token, auth id, creator, email, membership, recovery | PASS |
| Zero-game players present in the anonymous payload | PASS |
| Same token shows final results after the session ends | PASS |
| Disabling the feature retires the old token | PASS |
| `anon` holds no insert/update/delete on session tables | PASS |
| `anon` cannot execute organizer RPCs | PASS |
| `anon` cannot read the `public_live_token` column | PASS |
| SQL suite, local Postgres | PASS: 167 assertions |
| SQL suite, linked cloud | PASS: 167 assertions |
| Cloud migration 10, 12, 13 applied and verified | PASS |
| Cloud migration 11 skipped by design (13 supersedes `end_session`) | PASS |
| Phone scan | NOT RUN: no physical phone or published fixture in this environment |

Cloud applies used `supabase db query --linked`, which does not update
`supabase_migrations.schema_migrations`; see `docs/FINAL_REPORT.md` for the
history caveat and the `db push` reconciliation step.
