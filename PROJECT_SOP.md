# PickleBoard — Full OpenCode SOP Prompt

> Copy everything below this line and paste it into OpenCode.

## ROLE

You are a senior full-stack product engineer, database architect, UI/UX designer, QA engineer, and security reviewer. Build a production-minded, mobile-first pickleball open-play queue, scoring, and leaderboard web application.

The product may be inspired by the general workflow of PickleQ, but it must have its own name, visual identity, source code, database design, wording, and assets. Do not copy proprietary code, logos, screenshots, text, or branding. The working product name is **PickleBoard**. Make the name easy to change from one configuration file.

The working deadline is **two days**, so finish the complete core workflow before adding optional features. Do not merely generate mockups or static pages. Implement a working vertical slice backed by Supabase.

## PRIMARY GOAL

Create a responsive web app where an organizer can:

1. Create an account and sign in securely.
2. Create and manage a pickleball club.
3. Maintain a reusable player roster.
4. Create an open-play session with one or more courts.
5. Check players in and out.
6. Place checked-in players into a fair live queue.
7. Generate matches using Balanced, Skill Separated, or First-Come-First-Out matching.
8. Review an “Up Next” match before sending it to a court.
9. Record game scores and winners.
10. Automatically rotate players back into the queue.
11. Display live courts, queue position, estimated waiting time, scores, and standings.
12. Show session and all-time leaderboards.
13. Share a public, read-only live-session page using a URL and QR code.

## REQUIRED TECHNOLOGY

- Next.js using the App Router
- TypeScript with `strict: true`
- Supabase Postgres, Auth, Realtime, and Row Level Security
- Tailwind CSS
- A consistent accessible component system such as shadcn/ui
- Zod for input and environment validation
- React Hook Form for forms
- Vitest for unit tests
- Playwright for a small number of critical end-to-end tests
- npm as the package manager unless the repository already uses another package manager

Use the latest stable mutually compatible versions. Do not upgrade an existing project blindly. Inspect the repository and preserve its conventions when reasonable.

## NON-NEGOTIABLE ENGINEERING RULES

1. First inspect the repository, package configuration, existing files, and Git status.
2. Do not delete or overwrite unrelated user work.
3. Before coding, create `docs/IMPLEMENTATION_PLAN.md` with phases, file changes, database migrations, assumptions, and acceptance criteria.
4. Work in small verified increments. After each phase, run the relevant type check, lint, and tests.
5. Never expose the Supabase service-role key in browser code.
6. Never authorize a sensitive action only in the UI. Enforce authorization with RLS and server-side checks.
7. Use SQL migrations for every schema, RLS, policy, function, index, or seed change.
8. Do not hardcode production credentials, secrets, user IDs, club IDs, or Supabase URLs.
9. Add `.env.example` with safe placeholder values. Do not place real secrets in it.
10. Use database-generated UUIDs and UTC timestamps.
11. Use transactions or atomic Postgres functions for operations that change a match, court, queue, and statistics together.
12. Make matching deterministic when the same inputs and tie-breakers are supplied, so it can be unit-tested.
13. Prefer a finished, tested MVP over partially built advanced features.
14. Do not claim success until the app builds, migrations apply, and the critical workflow has been tested.
15. Keep a concise `docs/PROGRESS.md` showing completed, pending, blocked, and deferred items.

## TWO-DAY SCOPE

### P0 — Must be complete within two days

- Supabase email/password authentication
- Sign up, sign in, sign out, forgot password, reset password
- Organizer and player roles
- Club creation and club membership
- Organizer dashboard
- Player roster CRUD
- Player skill level from 1 to 6
- Session creation and ending
- Singles or doubles setting
- Configurable number of courts
- Player check-in, check-out, break, and return
- Live waiting queue
- Balanced matching
- Skill Separated matching
- First-Come-First-Out matching
- Up Next staging and organizer confirmation
- Active court cards
- Score entry, winner recording, and match completion
- Automatic post-match queue rotation
- Session standings and leaderboard
- All-time club leaderboard
- Public read-only live page
- QR code for the public live page
- Supabase Realtime updates
- RLS for all private and club-owned data
- Responsive mobile, tablet, and desktop UI
- Empty, loading, error, and confirmation states
- Unit tests for matching and leaderboard logic
- At least one end-to-end test covering sign-in through score completion

### P1 — Implement only after every P0 acceptance test passes

- Winners / Losers matching
- King/Queen of the Court
- Mixed Doubles
- Dedicated Skill Courts
- Fixed partner locking
- Manual player swapping in Up Next
- Browser alerts or sounds when a player moves to Up Next
- Shareable player result card
- CSV export

### Deferred backlog — Do not allow these to delay the two-day MVP

- DUPR integration or export
- Tournaments, pools, and playoffs
- Club-vs-club competitions
- Payments or subscriptions
- Venue booking
- Native mobile apps
- Offline-first synchronization
- SMS or email notifications

## USER ROLES AND AUTHORIZATION

### Public visitor

- Can open the landing page.
- Can view a published club leaderboard.
- Can view a published live session, active courts, queue, Up Next, and standings.
- Cannot view private email addresses, account IDs, audit data, or unpublished clubs/sessions.

### Player

- Has a profile and belongs to one or more clubs when invited or added.
- Can view their own profile, session history, and statistics.
- Can view public club and session data.
- Cannot manage another player, club, court, match, or score.

### Organizer/Admin

- Can manage only clubs where they have an organizer/admin membership.
- Can manage the club roster, sessions, courts, check-ins, queues, matches, scores, and publishing settings.
- Cannot access another club without membership.

Use Supabase Auth email/password credentials. Include forgot-password and reset-password flows. Do not create a shared hardcoded admin password. For local automated tests, use environment variables such as `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`, and document how to create the test user safely.

## CORE USER FLOWS

### Organizer onboarding

1. User signs up with name, email, and password.
2. After authentication, the user creates a club with name, unique slug, location, timezone, and optional logo.
3. The creator becomes the club owner.
4. The app opens the organizer dashboard.

### Create a session

1. Organizer clicks **New Session**.
2. Enter session name, date, number of courts, Singles/Doubles, scoring target, win-by rule, and matching mode.
3. Matching modes for P0: Balanced, Skill Separated, and First-Come-First-Out.
4. Save the session in `draft` status.
5. Add or select players from the reusable roster.
6. Check players in.
7. Require at least 2 checked-in players for singles or 4 for doubles before starting.
8. Start the session and set it to `active`.

### Run the live session

1. Checked-in players enter the waiting queue in check-in order.
2. The matchmaker proposes an Up Next match for every available court.
3. The organizer reviews the proposal.
4. The organizer may confirm it, regenerate it, or use a P1 manual adjustment if implemented.
5. Confirming sends the match to the selected court, marks players as `playing`, and records the start time.
6. When the game ends, the organizer enters the two team scores.
7. The server validates the scoring rule and determines the winner.
8. Completing the match updates player results atomically, frees the court, and places participants at the back of the queue.
9. The next staged match is generated, but it must not start until the organizer confirms it.

### End a session

1. Warn the organizer if matches are still active.
2. Mark the session as `completed`.
3. Freeze its final results while allowing an authorized organizer to correct a recorded score through a controlled action.
4. Display session standings, match history, and player summaries.
5. Update the club’s all-time leaderboard from completed matches only.

## MATCHING ENGINE

Place matching logic in pure TypeScript functions in a domain module, separate from UI and database code. Add unit tests with fixed fixtures. Every generated match must include a human-readable explanation such as “selected for longest wait and closest team balance.”

### Shared eligibility rules

A player is eligible only when:

- checked into the active session;
- queue status is `waiting`;
- not already playing or staged in another Up Next match;
- not on break or checked out;
- below the optional maximum-games limit;
- not part of a conflicting locked pair.

Use these deterministic tie-breakers in order: queue position, fewest games played, longest time since last game, then stable player UUID.

### First-Come-First-Out

- Singles: take the first 2 eligible players.
- Doubles: take the first 4 eligible players.
- For doubles, create teams that minimize the difference between team total skill.

### Balanced mode

Fair waiting time is the first priority; team quality is the second priority.

1. Build a candidate pool from the earliest eligible players. For doubles, examine the first 8 eligible players when possible; for singles, examine the first 4.
2. Do not bypass an early player repeatedly. Track `times_skipped`; apply a very large penalty after two skips so the player is included in the next valid match.
3. Evaluate valid player groups and team partitions using this cost function:

```text
total_cost =
  queue_displacement * 100
  + games_played_spread * 60
  + consecutive_game_penalty * 80
  + team_skill_difference * 30
  + repeat_partner_count_last_5 * 25
  + repeat_opponent_count_last_5 * 10
```

4. Choose the valid proposal with the lowest cost.
5. If proposals tie, use the shared deterministic tie-breakers.
6. A player who just finished should normally return behind players who were already waiting.

### Skill Separated mode

1. Start from the earliest waiting players.
2. Find 2 players for singles or 4 for doubles with the smallest skill range.
3. Use this cost function:

```text
total_cost =
  queue_displacement * 70
  + skill_range * 100
  + games_played_spread * 40
  + consecutive_game_penalty * 80
  + repeat_partner_count_last_5 * 20
```

4. Do not starve outliers. If a player waits longer than the session’s configurable threshold, default 15 minutes, increase their priority until they are selected.
5. In doubles, after selecting four players, choose the team partition that minimizes team skill difference and recent repeat partners.

### P1 mode rules

- **Winners / Losers:** after each game, winners join the winner pool and losers join the loser pool; match within the same pool when enough players exist, otherwise fall back to queue fairness.
- **King/Queen of the Court:** courts have ladder positions; winners move up one court, losers move down one court, with safe handling at the top and bottom court. Allow rotating or fixed partners only if the core workflow remains stable.
- **Mixed Doubles:** each doubles team must contain one player from each configured division/gender group. Never infer gender; use organizer-provided optional data and show an actionable error when a valid match cannot be formed.
- **Skill Courts:** assign configured skill bands to courts and maintain a fair queue inside each band.

## SCORING RULES

For P0, support:

- Game target: 11, 15, or 21
- Win by: 1 or 2
- Singles and doubles
- Non-negative integer scores
- Organizer correction before and after completion, with an audit entry

A completed score is valid only when the winning score reaches the target and the score difference satisfies `win_by`. Determine the winner on the server; do not trust a client-supplied winner ID. Reject invalid or tied completed scores.

## LEADERBOARDS

### Session leaderboard fields

- Rank
- Player name
- Skill level
- Games played
- Wins
- Losses
- Points for
- Points against
- Point differential
- Win percentage
- Current win streak
- Average partner skill
- Strength of schedule

### Ranking order

Rank players using:

1. Wins descending
2. Exact win percentage descending
3. Strength of schedule descending
4. Point differential descending
5. Player name ascending for stable display

Players with exact equality through point differential share the same displayed competition rank. Do not use rounded percentages for comparisons.

Define strength of schedule as the average pre-match or current win percentage of all opponents faced in the session. If an opponent has no completed games, treat their percentage as zero for the calculation. Implement this consistently in one tested domain function.

### All-time club leaderboard

- Use completed matches only.
- Add a configurable minimum-games filter, default 5.
- Provide filters for all time, current month, and custom date range.
- Do not expose private profile information.

## DATABASE DESIGN

Create normalized SQL migrations. Use these tables as the baseline and adjust only when documented:

### Identity and clubs

- `profiles`: `id` references `auth.users`, `display_name`, `avatar_url`, `default_skill_level`, `created_at`, `updated_at`
- `clubs`: `id`, `name`, `slug`, `location`, `timezone`, `logo_url`, `is_public`, `created_by`, timestamps
- `club_members`: `club_id`, `user_id`, `role` (`owner`, `admin`, `player`), status, timestamps
- `players`: reusable club roster record with optional `user_id`, `club_id`, `display_name`, `skill_level` 1–6, optional division/gender field, active flag, timestamps

### Sessions and queue

- `sessions`: `id`, `club_id`, `name`, `status` (`draft`, `active`, `completed`, `cancelled`), format (`singles`, `doubles`), matching mode, target score, win-by, court count, maximum games, starvation threshold, public flag, start/end timestamps, created_by
- `courts`: `id`, `session_id`, court number, name, ladder position, status (`available`, `staged`, `playing`, `disabled`)
- `session_players`: `session_id`, `player_id`, attendance status (`checked_out`, `waiting`, `staged`, `playing`, `break`, `finished`), queue position, checked-in time, last-enqueued time, last-played time, games played, times skipped, optional pool/band
- `queue_events`: append-only event log with session, player, event type, old/new status, actor, metadata, timestamp

### Matches and teams

- `matches`: `id`, `session_id`, `court_id`, match number, status (`staged`, `playing`, `completed`, `cancelled`), scoring fields, winning team number, matching mode, explanation, staged/start/completed timestamps, created_by
- `match_players`: `match_id`, `player_id`, team number 1 or 2, slot number, skill snapshot, result (`win`, `loss`, `cancelled`), points for/against
- `score_audit_log`: match, old score, new score, reason, actor, timestamp

### Optional support

- `club_settings`
- `notifications`
- materialized view or SQL view for safe leaderboard reads if useful

Add foreign keys, unique constraints, check constraints, and indexes for common filters. Important examples include unique club slug, unique `(club_id, user_id)` membership, unique `(session_id, player_id)`, unique `(match_id, player_id)`, unique `(session_id, court_number)`, and indexes on live session statuses and queue order.

## ROW LEVEL SECURITY

Enable RLS on every exposed table.

Policies must enforce:

- Users can read and update only their own private profile fields.
- Public users can read only sanitized public club, public live session, public match, queue-display, and leaderboard data.
- Club owners/admins can manage data only for their club.
- Players cannot promote themselves or change club roles.
- Players cannot write scores or move other players in the queue.
- Service-role access is server-only.
- Public views must never reveal emails, recovery data, auth IDs when avoidable, or audit metadata.

Use helper SQL functions such as `is_club_admin(club_uuid)` only if they are safe, stable, and avoid recursive RLS. Set secure `search_path` values on security-definer functions. Do not grant more privileges than required.

## ATOMIC SERVER OPERATIONS

Implement secure server actions, route handlers, or Postgres RPC functions for these operations:

- Check a player in
- Check a player out or place them on break
- Stage a match
- Start a staged match on an available court
- Complete a match and rotate players
- Correct a completed score
- End a session

`complete_match` must lock the target match/court records, reject duplicate completion, validate the score, update match and participant results, update session-player statistics, return players to the queue, free the court, create queue/audit events, and commit everything as one transaction. Design it to be idempotent or safely reject a repeated request.

## REALTIME BEHAVIOR

Subscribe only to the active club/session data needed by the current page. Live updates should refresh:

- court status;
- waiting queue;
- Up Next matches;
- completed scores;
- session standings.

Unsubscribe on route change. Avoid duplicate subscriptions and full-page reloads. If Realtime disconnects, show a small reconnecting indicator and recover using a fresh server query.

## ROUTES AND SCREENS

Use route groups and server/client boundaries appropriately.

### Public

- `/` — landing page and product explanation
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/club/[slug]` — public club leaderboard
- `/club/[slug]/live` — public active-session view
- `/club/[slug]/session/[sessionId]` — public completed results when published

### Authenticated organizer

- `/dashboard`
- `/dashboard/clubs/new`
- `/dashboard/clubs/[clubId]`
- `/dashboard/clubs/[clubId]/players`
- `/dashboard/clubs/[clubId]/settings`
- `/dashboard/clubs/[clubId]/sessions/new`
- `/dashboard/sessions/[sessionId]/setup`
- `/dashboard/sessions/[sessionId]/live`
- `/dashboard/sessions/[sessionId]/results`

### Main live-session layout

- Header: session name, mode, format, live status, elapsed time, share/QR, and End Session
- Summary cards: waiting, playing, completed matches, average wait
- Live Courts: one card per court with teams, score controls, elapsed game time, and complete/cancel actions
- Up Next: staged match cards with explanation and Start button
- Waiting Queue: position, player, skill, games, win rate, wait time, and status
- Standings: compact live ranking table
- Mobile: use tabs or a bottom navigation pattern so courts, queue, and standings remain easy to operate

## DESIGN DIRECTION

Create an original, energetic pickleball identity. Do not visually clone PickleQ.

- Mobile-first and touch-friendly
- Clean sports-dashboard appearance
- High-contrast court green, deep navy, warm yellow accent, and neutral backgrounds
- Minimum comfortable touch target of approximately 44px
- Clear badges for Waiting, Up Next, Playing, Break, and Finished
- Use subtle animation only for state changes
- Accessible focus states, labels, keyboard navigation, and semantic tables
- Do not use color as the only status signal
- Provide skeletons for live data and useful empty states
- Confirm destructive or irreversible actions

## COMPONENTS AND DOMAIN MODULES

Prefer reusable components such as:

- `AuthForm`
- `ClubSwitcher`
- `SessionSetupForm`
- `PlayerRosterTable`
- `CheckInPanel`
- `CourtCard`
- `UpNextCard`
- `QueueTable`
- `ScoreDialog`
- `LeaderboardTable`
- `PlayerStatsCard`
- `LiveConnectionStatus`
- `ShareQrDialog`

Keep business logic in modules such as:

- `domain/matching/balanced.ts`
- `domain/matching/skill-separated.ts`
- `domain/matching/fifo.ts`
- `domain/scoring/validate-score.ts`
- `domain/leaderboard/rank-players.ts`
- `domain/queue/estimate-wait.ts`

Exact paths may follow the repository’s conventions, but UI components must not contain the core algorithm.

## WAIT-TIME ESTIMATE

Use a simple transparent estimate for P0:

```text
estimated_wait_minutes =
  ceil(players_ahead / players_per_match / available_courts)
  * rolling_average_match_minutes
```

Use a sensible default match duration, such as 15 minutes, until enough completed matches exist. Clearly label it as an estimate.

## VALIDATION AND ERROR HANDLING

- Validate every form with Zod on both client and server where appropriate.
- Map database errors to friendly messages without exposing SQL or secrets.
- Prevent double submissions.
- Handle a player leaving while staged or playing.
- Handle an organizer closing and reopening the live page.
- Handle simultaneous score submissions.
- Handle fewer eligible players than required.
- Handle invalid session state transitions.
- Handle disabled courts.
- Show a recoverable error state if Realtime is unavailable.

## TESTING REQUIREMENTS

### Unit tests

Cover at minimum:

- FIFO selection
- Balanced selection and team partitioning
- avoidance of repeat partners
- no starvation after repeated skips
- Skill Separated selection
- skill outlier timeout
- doubles and singles eligibility
- score validation for target and win-by rules
- leaderboard tie-breakers and shared ranks
- wait-time calculation

### Database/RLS tests or verification SQL

Prove that:

- an unauthenticated user cannot read private club data;
- a player cannot edit a score;
- an admin of Club A cannot modify Club B;
- a club admin can run their own session;
- public users can read only published sanitized views;
- completing the same match twice cannot double-count statistics.

### End-to-end happy path

1. Sign in as organizer.
2. Open or create a club.
3. Create a doubles session with one court.
4. Add and check in at least eight players.
5. Start the session.
6. Generate and confirm an Up Next match.
7. Start the match.
8. Record a valid score.
9. Confirm the court becomes available and players rejoin the queue correctly.
10. Confirm session standings and the public live page update.

## REQUIRED DELIVERABLES

The finished repository must contain:

- Working Next.js application
- Supabase client/server configuration
- Ordered SQL migration files
- RLS policies and secure RPC functions
- Seed script with clearly fictional demo data
- `.env.example`
- `README.md` with setup, Supabase configuration, migration, development, test, and deployment instructions
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PROGRESS.md`
- `docs/DATABASE.md` describing schema and RLS
- `docs/MATCHING_ENGINE.md` explaining formulas, tie-breakers, and limitations
- Unit and end-to-end tests
- Final verification report in `docs/FINAL_REPORT.md`

The README must explain how the developer creates a local organizer test account. Never commit a real password. If seed authentication users cannot be created safely through SQL, provide a small server-side setup script or clear Supabase Dashboard steps.

## TWO-DAY EXECUTION PLAN

### Day 1 — Foundation and complete basic session flow

**Hours 1–2**

- Inspect repository and confirm package manager.
- Create implementation plan and progress tracker.
- Initialize or repair Next.js, TypeScript, Tailwind, and Supabase configuration.
- Add environment validation.

**Hours 3–5**

- Create database migrations, constraints, indexes, RLS, and organizer authorization helpers.
- Implement authentication and protected routes.
- Implement club creation and membership.

**Hours 6–8**

- Build roster CRUD and session setup.
- Build check-in/out and queue state.
- Implement FIFO matching first as the working baseline.
- Build court, Up Next, start-match, and score-completion flow.

**Day 1 exit criteria**

- Organizer can sign in, create/open a club, create a session, check in four players, start a doubles game, enter a score, and see players rotate.
- RLS blocks obvious cross-club access.
- Type check and build pass.

### Day 2 — Smart matching, live views, leaderboards, tests, and polish

**Hours 1–3**

- Implement and unit-test Balanced and Skill Separated algorithms.
- Add deterministic explanations and starvation protection.

**Hours 4–5**

- Implement Realtime updates, public live page, QR sharing, session standings, and all-time leaderboard.

**Hours 6–7**

- Add responsive polish, loading/error/empty states, accessibility, and score correction audit.
- Run RLS verification and concurrency checks.

**Hour 8**

- Run lint, type check, unit tests, E2E test, and production build.
- Fix failures.
- Complete README and final report.
- Record deferred P1 items honestly.

**Day 2 exit criteria**

- All P0 acceptance tests pass.
- A second browser can watch live changes without refreshing.
- No real credentials are committed.
- Database policies prevent cross-club writes.
- Production build succeeds.

## DEFINITION OF DONE

The MVP is done only when all statements below are true:

- Authentication and password recovery work.
- Organizer authorization is enforced in the database.
- Club, roster, session, queue, court, match, and scoring data persist in Supabase.
- Balanced, Skill Separated, and FIFO modes are functional and tested.
- No player appears in two active or staged matches.
- Completing a match is atomic and cannot be counted twice.
- Queue rotation is fair and visible.
- Session and club leaderboards use verified completed match data.
- Public viewers see only explicitly published sanitized data.
- Realtime updates work across two browser windows.
- The UI is usable on a phone.
- Lint, TypeScript, tests, and production build pass.
- Setup and deployment steps are documented.

## FINAL RESPONSE FORMAT

When implementation is complete, respond with:

1. **Outcome** — what is working.
2. **Files and migrations changed** — concise list.
3. **Database and RLS summary** — what is protected.
4. **Matching modes completed** — include test evidence.
5. **Verification results** — exact commands and pass/fail counts.
6. **How to run** — concise local setup steps.
7. **Test credentials setup** — explain environment-based setup without revealing secrets.
8. **Deferred items** — any P1/backlog features not completed.
9. **Known limitations** — honest and specific.

Do not say “complete” if any P0 item is missing. If blocked by missing Supabase credentials or project access, finish all code and migrations possible, state the exact blocker, and provide the exact next command or configuration step required.

## START NOW

Begin by inspecting the repository and Git status. Then write `docs/IMPLEMENTATION_PLAN.md` and `docs/PROGRESS.md`. After that, implement the P0 vertical slice in the order specified above. Do not stop after planning, do not ask for confirmation for ordinary reversible development decisions, and do not spend time on P1 until the full P0 workflow is verified.
