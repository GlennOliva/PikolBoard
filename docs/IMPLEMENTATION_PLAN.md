# PickleBoard — Implementation Plan

Status: living document. See `docs/PROGRESS.md` for the current ledger.

## 0. Ground rules taken from PROJECT_SOP.md

- P0 vertical slice only. P1 (`domain/matching/{winners-losers,koc,mixed-doubles,skill-courts}`) is deferred until every P0 acceptance test passes.
- Every schema/RLS/function change ships as an ordered SQL migration. No ad-hoc table editing.
- Authorization is enforced in Postgres (RLS + RPC), never only in the UI.
- Matching, scoring, ranking, and wait-estimate logic live in pure TypeScript in `lib/domain/**` with no React/Supabase imports, and are unit tested.
- Never commit secrets. `.env.example` carries placeholders only.

## 1. Baseline repository facts (verified, not assumed)

| Fact | Value | How verified |
| --- | --- | --- |
| Framework | Next.js **16.3.8**, App Router, React 19.3 | `node_modules/next/package.json` |
| Request hook | `proxy.ts` at repo root (Next 16 renamed `middleware.ts`) | existing `proxy.ts` |
| Config | `next.config.ts` sets `cacheComponents: true` | existing file |
| Tailwind | **v3.4.19** (`@tailwind base` directives, `tailwind.config.ts`) | lockfile + `app/globals.css` |
| UI kit | shadcn/ui `new-york`, Radix, lucide, `cn()` | `components.json` |
| Supabase | `@supabase/ssr` 0.12.7, `supabase-js` 2.117.2, both pinned `"latest"` in `package.json` | lockfile |
| DB target | Cloud project `phidcelejrxbaqsqnmiw` ("PickleBoard") | `.env.local`, `npx supabase projects list` |
| Lint baseline | `npm run lint` fails with **65 pre-existing** errors (64 in generated `.next/types/**`, 1 in `tailwind.config.ts:62`) | `npm run lint` |
| Type check | `npx tsc --noEmit` clean | run |
| No Docker | local `supabase start` unavailable; all DB work targets the cloud project | no docker, port 54321 closed |

Two constraints follow directly:

1. **Lint cannot be used as a pass/fail gate** until `.next` is added to the ESLint ignores. Verification gate is `npx tsc --noEmit` + `npm run build` + `vitest run`.
2. **`cacheComponents: true`** means uncached async work must sit under `<Suspense>`. Every server page that reads Supabase gets an explicit boundary.

## 2. Data model

Detailed in `docs/DATABASE.md`. Migrations in order:

1. `20260101000000_extensions_and_schema.sql` — enum types, tables, constraints, indexes, `updated_at` trigger, `handle_new_user` profile trigger.
2. `20260101000001_functions.sql` — authorization helpers + atomic RPCs (`check_in_player`, `set_attendance`, `stage_match`, `start_match`, `complete_match`, `correct_match_score`, `end_session`, `add_session_player`).
3. `20260101000002_rls.sql` — RLS enabled on every table, policies for member/owner/admin/public, `REVOKE`/`GRANT` tightening, security-definer helpers pinned with `set search_path`.
4. `20260101000003_public_views.sql` — sanitized public read models (no emails, no `auth` ids).
5. `supabase/seed.sql` — fictional demo club/players/sessions for local verification.

Key design decisions:

- **`matches.status`** is `staged | playing | completed | cancelled`. A `staged` match reserves `match_players` rows so a player cannot be double-booked; a partial unique index enforces "one active or staged match per player".
- **`complete_match` is the single write path for results.** It takes the row lock (`select ... for update`), re-validates the score, refuses a second completion, updates `match_players`, rolls players back to the end of the queue, frees the court, and appends `queue_events` + `score_audit_log`, all in one transaction.
- **Idempotency**: `complete_match` rejects when `status <> 'playing'` and returns a friendly error rather than double counting.
- **Winner is computed server-side** from `(score, target_score, win_by)`; clients never send a winning team id.
- `queue_events` is append-only, enforced by a `RAISE EXCEPTION` trigger on `UPDATE`/`DELETE`.

## 3. Matching engine

Pure functions in `lib/domain/matching/`, all deterministic given `(players, rules, recentHistory)`.

- `fifo.ts` — first N eligible, then minimize team skill difference for doubles.
- `balanced.ts` — candidate pool (first 8 doubles / 4 singles), exhaustive group+partition search over the candidate pool, cost function from the SOP, `times_skipped` starvation guard with a large penalty after 2 skips, deterministic tie-break.
- `skill-separated.ts` — smallest skill range, starvation escalation past `starvation_threshold_minutes`, then minimum team difference.
- `shared.ts` — eligibility filter and the documented tie-break chain (queue position → fewest games → longest since last game → stable uuid).
- Every proposal returns an `explanation` string for the UI.

Team partitioning is a separate pure helper so it can be unit tested independently.

## 4. Phase breakdown

| Phase | Work | Gate |
| --- | --- | --- |
| A | deps, `zod` env validation, vitest/playwright config, product-name config | `tsc`, `vitest` boots |
| B | migrations 1–3 (schema, functions, RLS) + public views | SQL parses; `db push` (needs DB password) |
| C | domain modules + unit tests | `vitest run` green |
| D | auth routes, protected dashboard, club create/join, roster CRUD | `tsc`, `npm run build` |
| E | session setup, check-in, queue, courts, stage/start/score/complete | `tsc`, `npm run build` |
| F | realtime, public pages, QR, standings, club leaderboard | `tsc`, `npm run build` |
| G | E2E + RLS verification SQL, docs, polish | full gate |

## 5. Assumptions

1. Cloud Supabase only. No Docker, so `supabase start` / `db reset` are not used; `db push` is the migration path.
2. The publishable key is the only credential the app uses. No service-role key in browser code (SOP rule 5) — the app never needs one because all privileged writes go through RLS-checked RPCs using the caller's JWT.
3. Email confirmation is assumed **off** for the demo project so signup → session is testable end to end; documented in the README because real deployments should enable it.
4. Club slug is globally unique; sessions are public only when `is_public` is set by an organizer.
5. `division` is an organizer-supplied free-text group used only for the deferred Mixed Doubles P1 feature. Gender is never inferred.

## 6. Acceptance criteria (P0)

- [ ] Sign up, sign in, sign out, forgot password, reset password all work.
- [ ] Organizer authorization enforced by RLS (verified by `supabase/tests/rls_verification.sql`).
- [ ] Club create + membership; a user who is not a member cannot read private club data.
- [ ] Roster CRUD with skill constrained to 1–6 (DB check constraint).
- [ ] Session create (draft) → check in ≥4 players (doubles) → activate.
- [ ] Live page shows courts, queue, Up Next, standings; check-in/out/break/return all work.
- [ ] FIFO, Balanced, Skill Separated all produce valid, tested, explained proposals.
- [ ] Staged match → confirm → start → score → complete; players rotate to the back of the queue.
- [ ] A player can never appear in two active/staged matches (partial unique index).
- [ ] Completing the same match twice cannot double count (RPC rejects; verified).
- [ ] Session standings + all-time club leaderboard (min-games filter, period filters).
- [ ] Public live page + QR code, sanitized (no emails/auth ids).
- [ ] Realtime updates courts, queue, Up Next, scores, standings; reconnects.
- [ ] Mobile-first, 44px touch targets, non-color status signals, empty/loading/error states.
- [ ] Unit tests for FIFO, Balanced, repeat-partner avoidance, starvation, Skill Separated, outlier timeout, doubles/singles eligibility, score validation, leaderboard ties, wait estimate.
- [ ] One E2E test: sign in → session → check in 8 → stage → start → score → rotation verified.
- [ ] `npx tsc --noEmit`, `vitest run`, `npm run build` all pass.
- [ ] No real credentials committed.