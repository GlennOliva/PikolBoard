import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Clock3,
  LayoutGrid,
  QrCode,
  Radio,
  Scale,
  Settings,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { PikolgoLogo } from "@/components/brand/pikolgo-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { productConfig } from "@/lib/product-config";

const features = [
  {
    icon: Scale,
    title: "Smart matchmaking",
    description:
      "Build balanced or skill-separated games from the players who are actually ready.",
    size: "lg:col-span-2",
    accent: "text-pikol-cyan",
    surface: "bg-pikol-cyan/10",
  },
  {
    icon: ClipboardList,
    title: "Preparation and Up Next",
    description:
      "Give every player a visible position in the rotation before their court opens.",
    size: "",
    accent: "text-pikol-warning",
    surface: "bg-pikol-warning/10",
  },
  {
    icon: LayoutGrid,
    title: "Live court control",
    description:
      "Start games, adjust lineups, and record scores without leaving the session.",
    size: "",
    accent: "text-pikol-primary",
    surface: "bg-pikol-primary/10",
  },
  {
    icon: QrCode,
    title: "QR live board",
    description:
      "A read-only courtside view that updates on any phone. No account required.",
    size: "lg:col-span-2",
    accent: "text-pikol-secondary",
    surface: "bg-pikol-secondary/10",
  },
  {
    icon: Trophy,
    title: "Honest standings",
    description:
      "Games, wins, point differential, and qualification rules stay visible to everyone.",
    size: "",
    accent: "text-pikol-gold",
    surface: "bg-pikol-gold/10",
  },
  {
    icon: Settings,
    title: "Club operations",
    description:
      "Rosters, session defaults, organizers, and public access in one place.",
    size: "",
    accent: "text-pikol-purple",
    surface: "bg-pikol-purple/10",
  },
] as const;

const steps = [
  {
    number: "01",
    title: "Set the room",
    description:
      "Create a club, add the roster, choose courts and the scoring target.",
    icon: Users,
  },
  {
    number: "02",
    title: "Check in and match",
    description:
      "Mark who is ready, then let PikolGo build the next fair matchup.",
    icon: Zap,
  },
  {
    number: "03",
    title: "Share and run",
    description:
      "Put the QR code on a table. Players follow courts, queues, and standings live.",
    icon: Radio,
  },
] as const;

const tiers = [
  {
    name: "Starter",
    price: "Free",
    description: "For getting one local club out of the spreadsheet.",
    features: [
      "One club",
      "Queue management",
      "Live standings",
      "Public QR board",
    ],
    cta: "Start free",
    href: "/auth/sign-up",
    featured: false,
  },
  {
    name: "Club",
    price: "Coming soon",
    description: "For organizers running a full weekly rotation.",
    features: [
      "Multiple sessions",
      "Balanced matchmaking",
      "Preparation and Up Next",
      "Court management",
      "Performance tracking",
    ],
    cta: "Create a club",
    href: "/auth/sign-up",
    featured: true,
  },
  {
    name: "Community",
    price: "Contact us",
    description: "For larger programs with a team of organizers.",
    features: [
      "Multiple organizers",
      "Advanced controls",
      "Extended reporting",
      "Priority support",
    ],
    cta: "Sign in to connect",
    href: "/auth/login",
    featured: false,
  },
] as const;

export function LandingPage() {
  return (
    <div className="flex flex-col gap-20 pb-6 sm:gap-28">
      <section className="relative isolate overflow-hidden pt-4 sm:pt-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
          <div className="flex flex-col items-start gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="live">
                <span className="retro-live-dot" aria-hidden />
                Courtside ops
              </Badge>
              <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Built for open play
              </span>
            </div>

            <PikolgoLogo
              priority
              sizes="(min-width: 1024px) 360px, 240px"
              className="h-14 sm:h-20 lg:h-24"
            />

            <div className="max-w-xl">
              <h1 className="retro-heading text-4xl leading-[0.98] sm:text-5xl lg:text-6xl">
                Run the courts.
                <span className="retro-glitch block text-pikol-cyan">
                  Keep the line moving.
                </span>
              </h1>
              <p className="retro-subheading mt-5 text-base sm:text-lg">
                {productConfig.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/sign-up">
                  Start a club
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/#live-board">
                  See the live board
                  <Smartphone className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[
                "No paper queue",
                "Public QR view",
                "Permission-checked writes",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-pikol-success" aria-hidden />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <HeroConsole />
        </div>

        <nav
          aria-label="Landing sections"
          className="mt-12 flex flex-wrap items-center gap-2 border-y border-border/70 py-3 text-xs uppercase tracking-[0.12em] text-muted-foreground"
        >
          {[
            ["/#features", "Features"],
            ["/#how-it-works", "Rotation"],
            ["/#live-board", "Live board"],
            ["/#pricing", "Pricing"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-3 py-2 transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </section>

      <section id="features" className="scroll-mt-28">
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="retro-kicker">The control surface</p>
            <h2 className="retro-heading mt-4 text-3xl sm:text-4xl lg:text-5xl">
              Everything the desk needs. Nothing the players do not.
            </h2>
            <p className="retro-subheading mt-4 text-sm sm:text-base">
              One organizer view keeps the rotation honest. One public view
              keeps the room calm. Both read from the same live session.
            </p>
            <Button asChild variant="ghost" className="mt-5 -ml-3">
              <Link href="/auth/sign-up">
                Open your first club
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <article
                key={feature.title}
                className={`retro-panel group p-5 transition-transform duration-200 ease-retro hover:-translate-y-0.5 sm:p-6 ${feature.size}`}
              >
                <div
                  className={`grid size-11 place-items-center rounded-lg border border-border ${feature.surface} ${feature.accent}`}
                >
                  <feature.icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.02em]">
                  {feature.title}
                </h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-pikol-surface/55 p-6 sm:p-8 lg:p-10"
      >
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="retro-kicker">The rotation</p>
            <h2 className="retro-heading mt-4 text-3xl sm:text-4xl">
              From a full room to the next fair game.
            </h2>
            <p className="retro-subheading mt-4 text-sm">
              PikolGo keeps one pipeline: checked in, preparation, up next, on
              court. Nobody has to guess where they stand.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <Stat label="Rotation stages" value="04" />
              <Stat label="Player view" value="Live" />
            </div>
          </div>

          <ol className="relative flex flex-col gap-3">
            {steps.map((step, index) => (
              <li
                key={step.number}
                className="relative grid gap-4 rounded-xl border border-border bg-card/100 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center"
              >
                <span className="text-3xl font-semibold tabular-nums text-pikol-cyan/70">
                  {step.number}
                </span>
                <div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                <span className="grid size-11 place-items-center rounded-lg border border-border bg-muted/45 text-muted-foreground">
                  <step.icon className="size-5" aria-hidden />
                </span>
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute -bottom-3 left-9 hidden h-3 w-px bg-pikol-cyan/30 sm:block"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <LiveBoardPreview />

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="retro-panel retro-corners p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <BarChart3 className="size-3" aria-hidden />
              Transparent by default
            </Badge>
            <Badge variant="outline">Podium rules visible</Badge>
          </div>
          <h2 className="retro-heading mt-5 text-3xl sm:text-4xl">
            Standings people can trust.
          </h2>
          <p className="retro-subheading mt-4 text-sm">
            Every completed game feeds the same standings view. Qualification
            thresholds, point differential, and podium places are explained in
            the interface, not hidden in a spreadsheet formula.
          </p>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              "Wins and exact win percentage",
              "Point differential and games played",
              "Podium qualification shortfall",
              "Published results only when organizers choose",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-pikol-success"
                  aria-hidden
                />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          {[
            {
              icon: Clock3,
              title: "Court-side fast",
              body: "Live data refreshes in place, with timers that survive the first paint.",
            },
            {
              icon: Users,
              title: "Built for a crowd",
              body: "Public boards are anonymous and read-only by design.",
            },
            {
              icon: Sparkles,
              title: "Less admin drag",
              body: "Add players, check them in, and start the next match from one screen.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex gap-4 rounded-xl border border-border bg-card/70 p-4"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-pikol-cyan/10 text-pikol-cyan">
                <item.icon className="size-4" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-28">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="retro-kicker">Plans</p>
            <h2 className="retro-heading mt-4 text-3xl sm:text-4xl">
              Start with the court you have.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            No card required for the starter club. Upgrade when your rotation
            needs more organizers and deeper controls.
          </p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {tiers.map((tier) => (
            <article
              key={tier.name}
              className={`relative flex flex-col rounded-xl border p-6 ${
                tier.featured
                  ? "border-pikol-primary/55 bg-pikol-primary/10 lg:-translate-y-2"
                  : "border-border bg-card/75"
              }`}
            >
              {tier.featured ? (
                <Badge
                  variant="up-next"
                  className="absolute right-4 top-4"
                >
                  Most useful
                </Badge>
              ) : null}
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {tier.name}
              </p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
                {tier.price}
              </p>
              <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                {tier.description}
              </p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-pikol-success"
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6 w-full"
                variant={tier.featured ? "default" : "outline"}
              >
                <Link href={tier.href}>{tier.cta}</Link>
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-pikol-cyan/25 bg-pikol-surface/70 p-6 sm:p-10">
        <div
          aria-hidden
          className="absolute -right-20 -top-24 size-72 rounded-full bg-pikol-cyan/10 blur-3xl"
        />
        <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="retro-kicker">Ready for the next session</p>
            <h2 className="retro-heading mt-4 text-3xl sm:text-4xl">
              Give the room a board it can read.
            </h2>
            <p className="retro-subheading mt-3 text-sm">
              Set up a club, add the roster, and run the first rotation without
              a paper queue.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/auth/sign-up">
                Start a club
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function HeroConsole() {
  const courts = [
    {
      court: "Court 1",
      status: "Live",
      score: "11 – 8",
      team1: "Alex + Jordan",
      team2: "Sam + Taylor",
      detail: "First to 15 · 06:42",
      live: true,
    },
    {
      court: "Court 2",
      status: "Preparation",
      score: "—",
      team1: "Morgan + Casey",
      team2: "Drew + Quinn",
      detail: "Ready when Court 1 clears",
      live: false,
    },
    {
      court: "Court 3",
      status: "Up Next",
      score: "—",
      team1: "Avery + Quinn",
      team2: "Sky + Robin",
      detail: "Queued for the next open court",
      live: false,
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        aria-hidden
        className="absolute -inset-5 -z-10 rounded-full bg-pikol-primary/10 blur-3xl"
      />
      <div className="retro-panel-raised retro-corners overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              Riverside Pickle Club
            </p>
            <p className="mt-0.5 text-sm font-semibold">Friday Open Play</p>
          </div>
          <Badge variant="live">
            <span className="retro-live-dot" aria-hidden />
            Live
          </Badge>
        </div>

        <div className="retro-grid-card space-y-3 p-4 sm:p-5">
          {courts.map((court) => (
            <div
              key={court.court}
              className={`rounded-lg border p-3 ${
                court.live
                  ? "border-pikol-cyan/40 bg-background/75"
                  : "border-border bg-background/55"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {court.court}
                </p>
                <span
                  className={
                    court.live
                      ? "text-xs font-semibold uppercase tracking-[0.12em] text-pikol-cyan"
                      : "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  }
                >
                  {court.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <p className="truncate text-xs font-medium">{court.team1}</p>
                <p className="rounded bg-foreground px-2 py-1 text-sm font-semibold tabular-nums text-background">
                  {court.score}
                </p>
                <p className="truncate text-right text-xs font-medium">
                  {court.team2}
                </p>
              </div>
              <p className="mt-2 text-[0.68rem] text-muted-foreground">
                {court.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t border-border px-4 py-3 sm:px-5">
          <p className="text-xs text-muted-foreground">
            Waiting queue · oldest first
          </p>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold tabular-nums">
            06 ready
          </span>
        </div>
      </div>
    </div>
  );
}

function LiveBoardPreview() {
  const leaderboard = [
    { rank: "1", name: "Alex Chen", record: "5–1", points: "+24", tone: "gold" },
    { rank: "2", name: "Jordan Lee", record: "4–2", points: "+16", tone: "silver" },
    { rank: "3", name: "Sam Rivera", record: "4–2", points: "+11", tone: "bronze" },
    { rank: "4", name: "Taylor Cruz", record: "3–3", points: "+4", tone: "plain" },
  ];

  return (
    <section
      id="live-board"
      className="scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-pikol-surface/60 p-4 sm:p-6 lg:p-8"
      aria-labelledby="preview-heading"
    >
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="retro-kicker">Public QR board · sample data</p>
          <h2 id="preview-heading" className="retro-heading mt-4 text-3xl sm:text-4xl">
            Everyone sees what happens next.
          </h2>
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          A courtside view built for quick glances: current matches, the next
          lineup, the waiting queue, and the live standings.
        </p>
      </div>

      <div className="retro-panel-raised retro-corners overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              Riverside Pickle Club
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Friday Night Board
            </h3>
          </div>
          <Badge variant="live">
            <span className="retro-live-dot" aria-hidden />
            Live
          </Badge>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-pikol-cyan/35 bg-pikol-cyan/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-pikol-cyan">
                    Live match
                  </p>
                  <h4 className="mt-1 text-lg font-semibold">Court 1</h4>
                </div>
                <Clock3 className="size-5 text-pikol-cyan" aria-label="Match in progress" />
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <p className="text-sm font-medium">Alex Chen<br />Jordan Lee</p>
                <p className="rounded-md bg-foreground px-3 py-2 text-xl font-semibold tabular-nums text-background">
                  11<span className="mx-1 text-pikol-cyan">–</span>8
                </p>
                <p className="text-right text-sm font-medium">Sam Rivera<br />Taylor Cruz</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="retro-preparing rounded-xl border p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-pikol-warning">
                  Preparation
                </p>
                <h4 className="mt-1 font-semibold">Court 2 · be ready</h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Jamie Park · Morgan Bell · Casey Hall · Drew Stone
                </p>
              </div>
              <div className="retro-up-next rounded-xl border p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-pikol-primary">
                  Up next
                </p>
                <h4 className="mt-1 font-semibold">Next matchup</h4>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Avery Reed · Quinn James · Sky Kim · Robin West
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/55 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Waiting queue
                  </p>
                  <h4 className="mt-1 font-semibold">6 players checked in</h4>
                </div>
                <Badge variant="outline">est. 12 min</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Riley M.", "Noah B.", "Maya C.", "Devon P."].map((name, index) => (
                  <span
                    key={name}
                    className="rounded-md border border-border bg-card px-2.5 py-1 text-xs"
                  >
                    <span className="mr-1.5 text-muted-foreground">{index + 1}</span>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/55 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Live standings
                </p>
                <h4 className="mt-1 font-semibold">Session leaderboard</h4>
              </div>
              <Trophy className="size-5 text-pikol-gold" aria-hidden />
            </div>
            <ul className="mt-4 flex flex-col gap-2">
              {leaderboard.map((player) => (
                <li
                  key={player.rank}
                  className={`flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 ${
                    player.tone === "gold"
                      ? "retro-podium-gold"
                      : player.tone === "silver"
                        ? "retro-podium-silver"
                        : player.tone === "bronze"
                          ? "retro-podium-bronze"
                          : "bg-card"
                  }`}
                >
                  <span className="w-5 text-xs tabular-nums text-muted-foreground">
                    {player.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {player.name}
                  </span>
                  <span className="text-xs tabular-nums">{player.record}</span>
                  <span className="w-9 text-right text-xs font-semibold tabular-nums text-pikol-cyan">
                    {player.points}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-[0.68rem] leading-relaxed text-muted-foreground">
              Five completed games qualify a player for the podium. The public
              board never shows emails or private session data.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="retro-stat">
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
