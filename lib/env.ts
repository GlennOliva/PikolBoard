import { z } from "zod";

/**
 * Server-side environment validation.
 *
 * Imported only from Server Components, route handlers, and server actions so
 * the values never reach the browser bundle. Client code reads the
 * NEXT_PUBLIC_* values directly through lib/supabase/client.ts.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("http"), {
      message: "must be an absolute http(s) URL",
    }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),
  E2E_ADMIN_EMAIL: z.string().optional(),
  E2E_ADMIN_PASSWORD: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Returns validated server env, or throws with a friendly, secret-free message.
 * Safe to call repeatedly: parsing happens once per process.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || undefined,
    E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || undefined,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "env"}: ${i.message}`)
      .join("; ");
    throw new Error(
      `Missing or invalid environment configuration (${issues}). ` +
        "Copy .env.example to .env.local and fill in your Supabase values.",
    );
  }

  cached = parsed.data;
  return cached;
}

/** True when Supabase credentials are present. Used to render setup guidance instead of crashing. */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Origin used for share links and QR codes. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}