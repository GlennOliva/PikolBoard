# Pickleboard Mobile

The native companion to the Pickleboard web app, built with Expo and Expo
Router. Organizers run sessions and keep score; players and spectators follow
the anonymous Live Board from a QR code. It shares the same Supabase project as
the web app: every write goes through an RPC, and RLS decides what a device may
see.

## Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and set:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   # Optional, used to build Live Board QR links:
   EXPO_PUBLIC_APP_URL=https://pickleboard.example.com
   ```

   Only the publishable key is ever used. Never put a service-role key in the app.

3. Start the app

   ```bash
   npx expo start
   ```

## Commands

```bash
npx expo start          # dev server
npx expo run:ios        # local development build (needed: expo-camera)
npx expo run:android
npm run typecheck       # tsc --noEmit
npm run lint            # expo lint
npm test                # jest (jest-expo + React Native Testing Library)
```

`expo-camera` and `expo-sqlite` ship native code, so the app needs a development
build rather than Expo Go once those are exercised.

## Routes

Routes live in `src/app/` (Expo Router). Group folders do not appear in URLs.

| Route | Purpose |
| --- | --- |
| `/` | Home: scan a Live Board, sign in as an organizer |
| `/scanner` | Camera QR scanner; resolves a Live Board token |
| `/live/[publicToken]` | Anonymous Live Board (courts, queue, rankings) |
| `/login` | `(auth)` group: organizer sign in / sign up |
| `/clubs` | `(organizer)` group: the organizer's clubs |
| `/sessions` | Sessions for a club; create a session |
| `/session/[sessionId]` | Run a session: pipeline, courts, attendance, standings |
| `/match/[matchId]` | One match: edit lineup, score, complete |

## Architecture

- `src/app/` — screens and navigators only.
- `src/components/` — presentation components (`ui/`, `session/`, `live/`).
- `src/lib/` — Supabase client, auth context, queries, mutations, realtime,
  and `lib/domain/` pure logic ported from the web app (matchmaking, queue
  estimates, leaderboards, score validation).
- `src/types/` — hand-written database row types.
- `src/hooks/` — data-loading and theme hooks.

Domain logic is pure and unit tested; the Supabase client, RPC wrappers, and
screens stay thin around it.
