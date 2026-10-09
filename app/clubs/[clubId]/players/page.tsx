import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddPlayerForm } from "@/components/clubs/add-player-form";
import { RosterList } from "@/components/clubs/roster-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getClubById, getRoster } from "@/lib/db/queries";
import { canManageClub } from "@/lib/permissions";

export const metadata = { title: "Players" };

export default function RosterPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/50" />}
    >
      <Roster params={params} />
    </Suspense>
  );
}

async function Roster({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const club = await getClubById(clubId);
  if (!club) notFound();

  const players = await getRoster(clubId);
  const canManage = canManageClub(club);
  const active = players.filter((p) => p.is_active);
  const archived = players.filter((p) => !p.is_active);

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add a player</CardTitle>
          </CardHeader>
          <CardContent>
            <AddPlayerForm clubId={clubId} />
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="active-players">
        <h2 id="active-players" className="text-lg font-medium">
          Players ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No players on the roster yet.
          </p>
        ) : (
          <div className="mt-3">
            <RosterList players={active} editable={canManage} />
          </div>
        )}
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-players">
          <h2 id="archived-players" className="text-lg font-medium">
            Archived ({archived.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Archived players keep their past results but no longer appear when
            you build a session roster.
          </p>
          <div className="mt-3">
            <RosterList players={archived} editable={canManage} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
