import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClubSettingsForm } from "@/components/clubs/club-settings-form";
import { MembersPanel } from "@/components/clubs/members-panel";
import { getClubById, getClubMembers, getClubSettings } from "@/lib/db/queries";
import { canManageClub } from "@/lib/permissions";

export const metadata = { title: "Club settings" };

export default function ClubSettingsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/50" />}
    >
      <Settings params={params} />
    </Suspense>
  );
}

async function Settings({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const club = await getClubById(clubId);
  if (!club) notFound();

  // Owners and admins only. The tab is hidden for plain players, but the check
  // repeats here so a hand-typed URL cannot reach the forms.
  if (!canManageClub(club)) notFound();

  const [settings, members] = await Promise.all([
    getClubSettings(clubId),
    getClubMembers(clubId),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <ClubSettingsForm club={club} settings={settings} />
      <MembersPanel
        clubId={club.id}
        members={members}
        viewerRole={club.viewer_role ?? "admin"}
      />
    </div>
  );
}