import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateClubForm } from "@/components/clubs/create-club-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "New club" };

export default function NewClubPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/protected"
          className="retro-back-link -ml-2"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Dashboard
        </Link>
        <p className="retro-kicker mt-4">Club initializer</p>
        <h1 className="retro-heading mt-3 text-3xl sm:text-4xl">
          New club
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You become the owner and the first organizer. Everything else —
          roster, sessions, public board — hangs off this club.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <CreateClubForm />
        </CardContent>
      </Card>
    </div>
  );
}
