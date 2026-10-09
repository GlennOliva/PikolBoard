import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getClubById } from "@/lib/db/queries";
import { canManageClub, roleLabel } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { ClubTabs } from "@/components/clubs/club-tabs";

/**
 * `params` is a promise under Next 16 + cacheComponents, and it must not be
 * awaited outside a Suspense boundary or the route cannot be prerendered. So the
 * layout stays synchronous and hands the promise to ClubShell, which resolves it
 * inside the boundary.
 */
export default function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubId: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-muted/50" />}>
      <ClubShell params={params}>{children}</ClubShell>
    </Suspense>
  );
}

async function ClubShell({
  params,
  children,
}: {
  params: Promise<{ clubId: string }>;
  children: React.ReactNode;
}) {
  const { clubId } = await params;
  const club = await getClubById(clubId);
  if (!club) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {club.name}
          </h1>
          {club.viewer_role ? (
            <Badge variant={club.viewer_role === "owner" ? "default" : "secondary"}>
              {roleLabel(club.viewer_role)}
            </Badge>
          ) : null}
          {club.is_public ? (
            <Badge variant="outline">public board</Badge>
          ) : (
            <Badge variant="outline">private</Badge>
          )}
        </div>
        {club.location ? (
          <p className="text-sm text-muted-foreground">{club.location}</p>
        ) : null}
      </div>

      <ClubTabs clubId={club.id} canManage={canManageClub(club)} />

      {children}
    </div>
  );
}