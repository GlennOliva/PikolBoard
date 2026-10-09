# AGENTS.md

Stock `create-next-app --example with-supabase` (Next.js 16.3.8, React 19.3, Tailwind **v3.4**, shadcn/ui `new-york`) with almost no product code yet. Treat the starter kit's demo pieces as scaffolding to replace, not as existing features: `components/tutorial/*`, `components/deploy-button.tsx`, the "Next.js Supabase Starter" nav labels, `app/layout.tsx` metadata, and the README (which documents the template, not this app).

## Commands

```bash
npm run dev                 # localhost:3000
npm run build               # also runs tsc; prints "Cache Components enabled"
npm run lint                # eslint .  — SEE BASELINE BELOW, fails on a clean checkout
npx tsc --noEmit            # clean, use this as the typecheck gate
npx supabase <cmd>          # CLI is NOT installed globally, always go through npx
```

No test framework, no formatter, no CI, no pre-commit hooks. Don't invent a test command or add a formatter config. Verification = `npx tsc --noEmit` + `npm run build`.

**Lint baseline:** `npm run lint` fails out of the box with 65 pre-existing errors — 64 from generated `.next/types/{validator,routes}.d.ts` (`eslint.config.mjs` has no ignore for `.next/`) and 1 real one at `tailwind.config.ts:62` (`require("tailwindcss-animate")`). Ignore those. Only errors in files you authored are yours.

## Next.js 16 specifics

- **The request hook is `proxy.ts` at the repo root, exporting `export async function proxy(request: NextRequest)`** — Next 16 renamed `middleware.ts`. Do not create a `middleware.ts`; it will be ignored. Its matcher covers everything except static assets. Auth/session refresh lives in `lib/supabase/proxy.ts:updateSession`, not in `proxy.ts`.
- `next.config.ts` sets `cacheComponents: true`. Uncached async work (Supabase calls, `cookies()`, awaiting `searchParams`) must sit inside a `<Suspense>` boundary or the build fails. That's why `AuthButton`, `UserDetails`, and `ErrorContent` are all wrapped. `searchParams` and `params` are Promises.
- No `"use cache"` directives anywhere yet. If you add one, verify with `npm run build` — partial prerender (◐) vs static (○) output changes.
- `next-env.d.ts` is gitignored and generated; `tsconfig.json` also includes `.next/dev/types/**/*.ts`.

## Supabase

- Env vars: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the new publishable-key name, not `..._ANON_KEY`). `.env.local` is committed-workflow-ignored but present and points at a **cloud** project — there is no local Supabase stack running.
- `supabase/` is only `supabase init` output (`project_id = "pickleboard"`). **There are no migrations and no tables yet** — any schema work is greenfield; do not assume a table exists.
- `hasEnvVars` (`lib/utils.ts`) short-circuits the proxy and swaps in tutorial UI when env is missing, so a misconfigured app renders as a working demo instead of erroring. Check `.env.local` before debugging phantom "logged out" behavior.

### Invariants that silently break sessions

- Never store a Supabase client in a module-level global (Fluid compute). Create a new one per call/req — see the comment in `lib/supabase/server.ts`.
- In `updateSession`, put **no code between `createServerClient(...)` and `supabase.auth.getClaims()`**, and **return the `supabaseResponse` object** as-is. Deviating causes random logouts.
- Server Components: use `@/lib/supabase/server` (`createClient`, async). Client Components: `@/lib/supabase/client` (sync). All auth mutations live in `"use client"` form components — there are **no server actions** in this repo; don't assume the `app/auth/**/actions.ts` convention.
- Auth gating is done in the proxy, not per-page: everything except `/`, `/login*`, and `/auth*` requires a session and redirects to `/auth/login`. `app/protected/` is just a demo route.

## Conventions

- `@/*` maps to the repo root (not `src/`) — there is no `src/`.
- New shadcn components: `npx shadcn@latest add <name>` → `components/ui/`, lucide icons, `cn()` from `@/lib/utils`. `components.json` declares a `@/hooks` alias but the directory doesn't exist.
- Styling is Tailwind v3 with HSL CSS variables in `app/globals.css`; dark mode is class-based via `next-themes`. Use semantic tokens (`bg-background`, `text-muted-foreground`), not raw colors.
- The Supabase deps are pinned to `"latest"`, so `package-lock.json` is the only record of the real versions — read it rather than `package.json` when versions matter.
