import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  LayoutGrid,
  Link2,
  QrCode,
  Timer,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { productConfig } from "@/lib/product-config";

const features = [
  {
    icon: Timer,
    title: "A queue that keeps its promises",
    body: "Check players in, let them enqueue, and the matchmaker builds the next game. Nobody gets parked: players who are starved or skipped twice get pulled in first, and every suggested game explains why those four were picked.",
  },
  {
    icon: LayoutGrid,
    title: "Every court, at a glance",
    body: "Court status, the lineup on each court, and the running score live in one screen. Suggested, staged, playing, done — the ladder of games is always visible so nobody asks whether the next game is ready.",
  },
  {
    icon: BarChart3,
    title: "Scores that count once",
    body: "Finish a game and the match RPC locks the session, writes the result, and updates the leaderboard in the same transaction. Fix a mistyped score with a correction that records the change instead of overwriting it.",
  },
  {
    icon: Link2,
    title: "Share the live board",
    body: "Publish a session and send a link or a QR code to the group chat. Spectators watch the courts and the standings update live, with no account and no access to anything private.",
  },
  {
    icon: QrCode,
    title: "Built for the phone in your hand",
    body: "Big tap targets, high contrast, and controls that work one-handed while you are holding a paddle and not looking at your phone.",
  },
  {
    icon: Trophy,
    title: "Honest leaderboards",
    body: "Ranks come from recorded games, not from who types the loudest. Win rate, point differential, and streaks are computed from the same match results the organizers saw.",
  },
];

const steps = [
  {
    step: "1",
    title: "Create a club and add the roster",
    body: "Name the club, pick a shareable slug, and add players with a skill level. Rosters are private to your club.",
  },
  {
    step: "2",
    title: "Start a session",
    body: "Choose the format, target score, and how many courts are free. Sessions start paused, so you can check people in first.",
  },
  {
    step: "3",
    title: "Check players in and let the queue work",
    body: "Tap a name to check them in, then send them to the queue. The matchmaker proposes the next game whenever a court opens.",
  },
  {
    step: "4",
    title: "Publish, share, and play",
    body: "Share the live board with a link or QR code and keep scores as games finish. End the session when the last court clears.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-16 sm:gap-24">
      <section className="flex flex-col items-start gap-6 pt-6 sm:pt-12">
        <p className="rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Open play, without the group-chat chaos
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          {productConfig.name}: {productConfig.tagline}
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          {productConfig.description}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/auth/sign-up">
              Start a club
              <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
          How a session runs
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2">
          {steps.map((item) => (
            <li key={item.step}>
              <Card className="h-full">
                <CardContent className="flex gap-4">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  >
                    {item.step}
                  </span>
                  <div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="built-in">
        <h2 id="built-in" className="text-2xl font-semibold tracking-tight">
          What you get
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="h-full">
              <CardContent>
                <feature.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-medium">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {feature.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
