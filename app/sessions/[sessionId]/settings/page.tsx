import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SessionSettingsForm } from "@/components/sessions/session-settings-form";
import { Button } from "@/components/ui/button";
import { getClubById, getSessionBundle } from "@/lib/db/queries";
import { canManageClub } from "@/lib/permissions";

export const metadata = { title: "Session settings" };

export default function SessionSettingsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/50" />}>
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
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Back to session
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {session.name} settings
        </h1>
      </div>

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
