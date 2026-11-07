import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getClubById } from "@/lib/db/queries";
import { canManageClub, roleLabel } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
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
    <Suspense fallback={<PageSkeleton label="Loading club" />}>
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
      <div className="retro-panel-raised retro-corners flex flex-col gap-3 p-5 sm:p-6">
        <p className="retro-kicker">Club control</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="retro-heading text-3xl sm:text-4xl">
            {club.name}
          </h1>
          {club.viewer_role ? (
            <Badge variant={club.viewer_role === "owner" ? "up-next" : "secondary"}>
              {roleLabel(club.viewer_role)}
            </Badge>
          ) : null}
          {club.is_public ? (
            <Badge variant="success">public board</Badge>
          ) : (
            <Badge variant="warning">private</Badge>
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
