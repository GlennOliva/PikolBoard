# PickleBoard

PickleBoard runs open-play pickleball sessions: check players in, build fair
matches, manage courts and scores, and share a read-only Live Board with every
player through one QR code.

## Live Board

Each active session receives its own high-entropy capability URL:

```text
/live/[publicToken]
```

The UUID token is created atomically when the organizer starts the session. It
does not rotate on a duplicate Start submission, is never returned inside the
public board payload, and continues to show final results after the session
ends. Draft sessions have no active token or QR code. Legacy session-id and
club-live routes are not player access paths.

The page displays live courts, running scores, persisted match timers, Up Next,
queue status and wait estimates, and the five-game-qualified podium leaderboard.
Players use a normal phone browser; no account or app download is required.

### QR origin requirement

Never present a `localhost` QR code to players. A phone resolves `localhost` to
the phone itself, not the organizer's computer. Set `NEXT_PUBLIC_APP_URL` to the
deployed origin:

```env
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

If it remains `http://localhost:3000`, the organizer dialog refuses to draw the
QR and explains how to fix it. When the browser is already using a reachable LAN
or production address, that origin is used as a safe fallback.

### Local phone testing

Use a placeholder matching your computer's LAN address; never commit the real
value:

```env
NEXT_PUBLIC_APP_URL=http://10.9.21.83:3000
```

Start Next.js on the network interface:

```bash
npm run dev -- --hostname 0.0.0.0
```

Connect the phone and computer to the same Wi-Fi, open an active public session,
choose **Show QR Code**, and scan. If the address is correct but the phone cannot
connect, the operating-system firewall or Wi-Fi client isolation may need manual
configuration. PickleBoard does not change firewall settings.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The database schema and RLS policies are under `supabase/migrations/`. Apply
forward migrations to the linked project with the Supabase CLI through `npx`.

## Verification

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

The SQL authorization suite is transaction-wrapped and leaves no fixtures:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_verification.sql
```

## Stack

- Next.js 16 App Router and React 19
- Supabase Auth, Postgres, RLS, and Realtime
- Tailwind CSS 3 and shadcn/ui
- Vitest, Testing Library, and Playwright
