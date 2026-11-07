import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SessionSettingsForm } from "@/components/sessions/session-settings-form";
import { Button } from "@/components/ui/button";
import { getClubById, getSessionBundle } from "@/lib/db/queries";
import { canManageClub } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Session settings" };

export default function SessionSettingsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return (
    <Suspense fallback={<PageSkeleton label="Loading session settings" />}>
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const bundle = await getSessionBundle(sessionId);
  if (!bundle) notFound();

  const { session } = bundle;
  const club = await getClubById(session.club_id);
  if (!club) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/sessions/${session.id}`}
          className="retro-back-link -ml-2"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to session
        </Link>
        <p className="retro-kicker mt-4">Session configuration</p>
        <h1 className="retro-heading mt-3 text-3xl sm:text-4xl">
          {session.name} settings
        </h1>
      </div>

      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <SessionSettingsForm
            sessionId={session.id}
            name={session.name}
            courtCount={session.court_count}
            maxGames={session.max_games}
            starvationMinutes={session.starvation_threshold_minutes}
            isPublic={session.is_public}
            resultsPublished={session.results_published}
            canManage={canManageClub(club)}
          />
        </CardContent>
      </Card>

      {session.is_public ? (
        <div>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/s/${session.id}`}>
              View public board
              <ExternalLink className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
