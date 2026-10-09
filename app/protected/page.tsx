import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MapPin, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyClubs } from "@/lib/db/queries";
import { roleLabel } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { productConfig } from "@/lib/product-config";

export const metadata = { title: "Dashboard" };

/** Pulls a first name out of the JWT claims without trusting a shape. */
function firstNameFromClaims(claims: Record<string, unknown>): string | null {
  const meta = claims.user_metadata;
  if (typeof meta !== "object" || meta === null) return null;
  const full = (meta as { full_name?: unknown }).full_name;
  if (typeof full !== "string") return null;
  return full.trim().split(/\s+/)[0] || null;
}

/**
 * Post-login landing page. The proxy already gates this route, so getClaims()
 * only resolves the display name; if it is missing we still send them to login
 * rather than rendering a half-authenticated shell.
 */
async function Dashboard() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/auth/login");

  const clubs = await getMyClubs();
  const email = typeof claims.email === "string" ? claims.email : null;
  const firstName = firstNameFromClaims(claims);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {firstName ? `Welcome back, ${firstName}` : "Your clubs"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {email ?? "Pick where you are playing next."}
          </p>
        </div>
        <Button asChild>
          <Link href="/clubs/new">
            <Plus className="mr-2 size-4" aria-hidden />
            New club
          </Link>
        </Button>
      </div>

      {clubs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <h2 className="text-lg font-medium">No clubs yet</h2>
            <p className="max-w-prose text-sm text-muted-foreground">
              Create a club to get a roster, sessions, and a shareable live
              board. It takes about a minute: a name, a shareable link slug, and
              the players who show up.
            </p>
            <Button asChild className="mt-2">
              <Link href="/clubs/new">Create your first club</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <li key={club.id}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/clubs/${club.id}`}
                      className="text-lg font-medium hover:underline"
                    >
                      {club.name}
                    </Link>
                    <Badge
                      variant={
                        club.viewer_role === "owner" ? "default" : "secondary"
                      }
                    >
                      {roleLabel(club.viewer_role)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {club.location || "No location set"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden />
                      Roster
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {club.is_public ? "Public board" : "Private"}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/clubs/${club.id}/sessions`}>Sessions</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/clubs/${club.id}/players`}>Players</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {productConfig.name} keeps every write behind a permission check in the
        database, so organizers, players, and anonymous spectators each see
        exactly what they should.
      </p>
    </div>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense
      fallback={
        <div
          className="h-40 animate-pulse rounded-lg bg-muted/50"
          aria-hidden
        />
      }
    >
      <Dashboard />
    </Suspense>
  );
}
