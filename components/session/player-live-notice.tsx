import { Card, CardContent } from "@/components/ui/card";
import { PikolgoLogo } from "@/components/brand/pikolgo-logo";

/**
 * The states a phone can land on that are not the board.
 *
 * These live in `components/` rather than inline in the route file for one
 * reason: `app/live/[publicToken]/page.tsx` imports the Supabase server client,
 * which cannot be loaded by the test runner. Keeping the copy here makes each
 * message assertable, which matters more than usual here because the copy is
 * the whole UX for a failure — a spectator holding a dead phone needs to be told
 * *which* thing went wrong, not handed a generic "unavailable".
 */
export function PlayerLiveNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="retro-corners mx-auto max-w-xl">
      <CardContent className="flex flex-col items-start gap-4 py-12">
        <PikolgoLogo sizes="150px" className="h-8" />
        <p className="retro-kicker">Player live view</p>
        <h1 className="retro-heading text-2xl sm:text-3xl">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

/** The scanned token does not resolve to any enabled Live View. */
export function UnavailableLiveView() {
  return (
    <PlayerLiveNotice
      title="Player Live View unavailable"
      description="This QR code is invalid or has been replaced. Ask the organizer for the current QR code."
    />
  );
}

/** The token resolves, but the organizer has not started the session yet. */
export function DraftLiveView({ sessionName }: { sessionName: string }) {
  return (
    <Card className="retro-corners mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <PikolgoLogo sizes="150px" className="h-8" />
        <p className="retro-kicker">Waiting for start</p>
        <h1 className="retro-heading text-2xl sm:text-3xl">{sessionName}</h1>
        <p className="mt-3 text-sm text-muted-foreground">This session has not started yet.</p>
      </CardContent>
    </Card>
  );
}
