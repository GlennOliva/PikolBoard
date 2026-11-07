import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddPlayerForm } from "@/components/clubs/add-player-form";
import { RosterList } from "@/components/clubs/roster-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/skeleton";
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
      fallback={<PageSkeleton label="Loading club roster" />}
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
          <CardHeader className="border-b border-border/60">
            <p className="retro-kicker">Roster input</p>
            <CardTitle className="text-lg">Add a player</CardTitle>
          </CardHeader>
          <CardContent>
            <AddPlayerForm clubId={clubId} />
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="active-players">
        <h2 id="active-players" className="retro-section-title">
          Players ({active.length})
        </h2>
        {active.length === 0 ? (
          <EmptyState
            className="mt-3"
            title="No players on the roster yet"
            body="Add a player above. They will be available for every future session in this club."
          />
        ) : (
          <div className="mt-3">
            <RosterList players={active} editable={canManage} />
          </div>
        )}
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-players">
          <h2 id="archived-players" className="retro-section-title">
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
