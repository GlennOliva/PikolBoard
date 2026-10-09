import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateClubForm } from "@/components/clubs/create-club-form";

export const metadata = { title: "New club" };

export default function NewClubPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/protected"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          New club
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You become the owner and the first organizer. Everything else —
          roster, sessions, public board — hangs off this club.
        </p>
      </div>

      <CreateClubForm />
    </div>
  );
}
