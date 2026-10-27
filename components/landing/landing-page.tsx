import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Clock3,
  Crown,
  LayoutGrid,
  QrCode,
  Scale,
  Settings,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { MobileMenu } from "@/components/landing/mobile-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";

const features = [
  {
    icon: Scale,
    title: "Smart Matchmaking",
    description:
      "Create balanced or skill-separated matches from checked-in players.",
    color: "bg-[#FFDB58]",
  },
  {
    icon: ClipboardList,
    title: "Preparation and Up Next",
    description:
      "Show players where they are in the rotation before their court becomes available.",
    color: "bg-[#FF6B6B]",
  },
  {
    icon: LayoutGrid,
    title: "Live Court Control",
    description:
      "Start matches, update lineups, record scores, and manage every court.",
    color: "bg-[#2196F3]",
  },
  {
    icon: QrCode,
    title: "QR Live Board",
    description:
      "Players scan a public QR code to see matches, queues, and standings.",
    color: "bg-[#4ECDC4]",
  },
  {
    icon: Trophy,
    title: "Honest Leaderboards",
    description:
      "Track games, wins, losses, points, and podium qualification.",
    color: "bg-[#FFDB58]",
  },
  {
    icon: Settings,
    title: "Club Management",
    description:
      "Manage rosters, sessions, courts, scoring rules, and club settings.",
    color: "bg-[#FF6B6B]",
  },
] as const;

const highlights = [
  { icon: LayoutGrid, label: "Live court tracking" },
  { icon: Smartphone, label: "Public QR access" },
  { icon: Scale, label: "Balanced matchmaking" },
  { icon: BarChart3, label: "Real-time standings" },
] as const;

const steps = [
  {
    number: "01",
    title: "Create a club and session",
    description:
      "Set your courts, scoring format, and session rules in a few focused steps.",
    color: "bg-[#FFDB58]",
  },
  {
    number: "02",
    title: "Check in players and generate matches",
    description:
      "Build fair games from the players who are ready, without juggling a paper list.",
    color: "bg-[#2196F3]",
  },
  {
    number: "03",
    title: "Share the QR code and run the courts",
    description:
      "Keep everyone synced on live matches, the rotation, and current standings.",
    color: "bg-[#FF6B6B]",
  },
] as const;

const testimonials = [
  {
    quote:
      "The rotation finally makes sense at a glance. I spend less time calling names and more time keeping the night moving.",
    name: "Maya Brooks",
    role: "Club Organizer",
    color: "bg-[#FFDB58]",
  },
  {
    quote:
      "Preparation and Up Next give players a clear signal before a court opens. The whole room feels calmer and faster.",
    name: "Noah Bennett",
    role: "Open Play Coordinator",
    color: "bg-[#2196F3]",
  },
  {
    quote:
      "I can scan once, see my place in line, and get back to talking with friends instead of hovering around the desk.",
    name: "Riley Morgan",
    role: "Pickleball Player",
    color: "bg-[#4ECDC4]",
  },
] as const;

const tiers = [
  {
    name: "Starter",
    price: "Free",
    description: "For getting one local club out of the spreadsheet.",
    features: [
      "One club",
      "Basic queue management",
      "Live leaderboard",
      "Public QR board",
    ],
    cta: "Start Free",
    href: "/auth/sign-up",
    color: "bg-[#FFFDF2] dark:bg-[#171717] dark:text-[#FFFDF2]",
    popular: false,
  },
  {
    name: "Club",
    price: "Coming Soon",
    description: "For organizers running a full weekly rotation.",
    features: [
      "Multiple sessions",
      "Balanced matchmaking",
      "Preparation and Up Next",
      "Court management",
      "Performance tracking",
    ],
    cta: "Create a Club",
    href: "/auth/sign-up",
    color: "bg-[#FFDB58] text-black",
    popular: true,
  },
  {
    name: "Community",
    price: "Contact Us",
    description: "For larger programs with a team of organizers.",
    features: [
      "Multiple organizers",
      "Advanced controls",
      "Extended reporting",
      "Priority support",
    ],
    cta: "Sign In to Connect",
    href: "/auth/login",
    color: "bg-[#4ECDC4] text-black",
    popular: false,
  },
] as const;

function BrandMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid size-10 place-items-center border-[3px] border-black bg-[#FFDB58] shadow-[3px_3px_0_#000] dark:border-[#FFFDF2] dark:shadow-[3px_3px_0_#FFFDF2]">
        <span className="size-5 rounded-full border-2 border-black bg-[#4ECDC4]" />
        <span className="absolute left-[13px] top-[8px] size-1 rounded-full bg-black" />
        <span className="absolute bottom-[8px] right-[9px] size-1 rounded-full bg-black" />
      </span>
      <span className="text-xl font-black tracking-[-0.04em]">PickleBoard</span>
    </span>
  );
}

function LandingHeader() {
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/#features", label: "Features" },
    { href: "/#how-it-works", label: "How It Works" },
    { href: "/#pricing", label: "Pricing" },
    { href: "/#live-board", label: "Live Board" },
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b-[3px] border-black bg-[#FFFDF2] text-black dark:border-[#FFFDF2] dark:bg-[#111111] dark:text-[#FFFDF2]">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="neo-focus cursor-pointer transition-all" aria-label="PickleBoard home">
          <BrandMark />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-5 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="neo-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeSwitcher />
          <Link href="/auth/login" className="neo-nav-link px-2">
            Sign In
          </Link>
          <Link href="/auth/sign-up" className="neo-button neo-button-yellow px-4 py-2.5">
            Create a Club
          </Link>
        </div>
        <div className="flex items-center gap-3 md:hidden">
          <ThemeSwitcher />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

function HeroIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[590px] pb-5 pr-2 pt-4" aria-label="PickleBoard product illustration" role="img">
      <div className="absolute -left-3 top-0 size-16 rotate-[-9deg] border-[3px] border-black bg-[#FF6B6B] dark:border-[#FFFDF2]" aria-hidden="true" />
      <div className="absolute -right-1 bottom-0 size-20 rotate-6 border-[3px] border-black bg-[#FFDB58] dark:border-[#FFFDF2]" aria-hidden="true" />
      <div className="relative border-[3px] border-black bg-[#2196F3] p-3 shadow-[8px_8px_0_#000] dark:border-[#FFFDF2] dark:shadow-[8px_8px_0_#FFFDF2] sm:p-5">
        <div className="mb-3 flex items-center justify-between border-[3px] border-black bg-[#FFFDF2] px-3 py-2 text-black">
          <span className="text-xs font-black uppercase tracking-[0.18em] sm:text-sm">Friday Open Play</span>
          <span className="flex items-center gap-1.5 border-2 border-black bg-[#FF6B6B] px-2 py-1 text-xs font-black">
            <span className="size-2 animate-pulse rounded-full bg-black motion-reduce:animate-none" /> LIVE
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1.35fr_0.85fr]">
          <div className="relative min-h-[300px] overflow-hidden border-[3px] border-black bg-[#4ECDC4] p-4 text-black">
            <div className="absolute inset-5 border-[3px] border-white" aria-hidden="true" />
            <div className="absolute inset-y-5 left-1/2 border-l-[3px] border-white" aria-hidden="true" />
            <div className="absolute inset-x-5 top-1/2 border-t-[3px] border-white" aria-hidden="true" />
            <div className="relative z-10 grid h-full grid-cols-2 gap-3">
              {["Alex", "Jordan", "Sam", "Taylor"].map((name, index) => (
                <div
                  key={name}
                  className={`flex min-h-20 items-end border-[3px] border-black p-2 text-xs font-black shadow-[3px_3px_0_#000] ${index % 2 === 0 ? "bg-[#FFDB58]" : "bg-[#FFFDF2]"}`}
                >
                  {name}
                </div>
              ))}
            </div>
            <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 border-[3px] border-black bg-black px-3 py-2 text-xl font-black text-white">
              <span>11</span><span className="text-[#FFDB58]">:</span><span>8</span>
            </div>
            <svg className="absolute -right-5 -top-4 z-30 h-24 w-24 rotate-12 drop-shadow-[4px_4px_0_#000]" viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="43" fill="#FFDB58" stroke="#000" strokeWidth="4" />
              <g fill="#000">
                <circle cx="35" cy="28" r="4" /><circle cx="58" cy="25" r="4" /><circle cx="72" cy="42" r="4" />
                <circle cx="29" cy="51" r="4" /><circle cx="51" cy="49" r="4" /><circle cx="68" cy="67" r="4" />
                <circle cx="39" cy="73" r="4" />
              </g>
            </svg>
          </div>
          <div className="grid gap-3">
            <div className="border-[3px] border-black bg-[#FFDB58] p-3 text-black">
              <p className="text-xs font-black uppercase tracking-wider">Preparation</p>
              <div className="mt-2 space-y-2">
                <div className="border-2 border-black bg-white px-2 py-1.5 text-xs font-bold">Morgan + Casey</div>
                <div className="border-2 border-black bg-white px-2 py-1.5 text-xs font-bold">Drew + Quinn</div>
              </div>
            </div>
            <div className="border-[3px] border-black bg-[#FF6B6B] p-3 text-black">
              <p className="text-xs font-black uppercase tracking-wider">Up Next</p>
              <div className="mt-2 border-2 border-black bg-white px-2 py-2 text-xs font-bold">Court 2 · 4 ready</div>
            </div>
            <div className="flex items-center justify-between border-[3px] border-black bg-[#FFFDF2] p-3 text-black">
              <span className="text-xs font-black uppercase">Queue</span>
              <span className="border-2 border-black bg-[#4ECDC4] px-2 py-1 text-sm font-black">08</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LiveBoardPreview() {
  const leaderboard = [
    { rank: "1", name: "Alex Chen", record: "5–1", points: "+24", color: "bg-[#FFDB58]" },
    { rank: "2", name: "Jordan Lee", record: "4–2", points: "+16", color: "bg-[#D9D9D9]" },
    { rank: "3", name: "Sam Rivera", record: "4–2", points: "+11", color: "bg-[#CD7F32]" },
    { rank: "4", name: "Taylor Cruz", record: "3–3", points: "+4", color: "bg-white" },
  ] as const;

  return (
    <section id="live-board" className="scroll-mt-24 bg-[#2196F3] px-4 py-20 text-black sm:px-6 sm:py-28 lg:px-8" aria-labelledby="preview-heading">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="neo-kicker bg-[#FFDB58]">Product preview · sample data</p>
            <h2 id="preview-heading" className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              Everyone sees what happens next.
            </h2>
          </div>
          <p className="max-w-xl border-[3px] border-black bg-[#FFFDF2] p-4 text-base font-bold shadow-[5px_5px_0_#000] sm:text-lg">
            A courtside view built for quick glances, clear rotations, and zero mystery.
          </p>
        </div>

        <div className="border-[3px] border-black bg-[#FFFDF2] p-3 shadow-[9px_9px_0_#000] sm:p-5 lg:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-black pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em]">Riverside Pickle Club</p>
              <h3 className="text-2xl font-black sm:text-3xl">Friday Night Board</h3>
            </div>
            <span className="flex items-center gap-2 border-[3px] border-black bg-[#FF6B6B] px-3 py-2 text-sm font-black">
              <span className="size-2.5 rounded-full bg-black" /> LIVE
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="grid gap-5">
              <article className="border-[3px] border-black bg-[#4ECDC4] p-4 shadow-[4px_4px_0_#000] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">Live Match</p>
                    <h4 className="text-xl font-black">Court 1</h4>
                  </div>
                  <Clock3 className="size-7" aria-label="Match in progress" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="border-[3px] border-black bg-white p-3 font-black">Alex Chen<br />Jordan Lee</div>
                  <div className="flex items-center justify-center gap-2 border-[3px] border-black bg-black px-4 py-3 text-2xl font-black text-white">
                    11 <span className="text-[#FFDB58]">–</span> 8
                  </div>
                  <div className="border-[3px] border-black bg-white p-3 text-right font-black">Sam Rivera<br />Taylor Cruz</div>
                </div>
              </article>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="border-[3px] border-black bg-[#FFDB58] p-4">
                  <p className="text-xs font-black uppercase tracking-widest">Preparation</p>
                  <h4 className="mt-1 text-lg font-black">Court 2 · Be ready</h4>
                  <p className="mt-3 border-2 border-black bg-white p-2 text-sm font-bold">Jamie Park · Morgan Bell · Casey Hall · Drew Stone</p>
                </article>
                <article className="border-[3px] border-black bg-[#FF6B6B] p-4">
                  <p className="text-xs font-black uppercase tracking-widest">Up Next</p>
                  <h4 className="mt-1 text-lg font-black">Match queued</h4>
                  <p className="mt-3 border-2 border-black bg-white p-2 text-sm font-bold">Avery Reed · Quinn James · Sky Kim · Robin West</p>
                </article>
              </div>

              <article className="border-[3px] border-black bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest">Waiting Queue</p>
                    <h4 className="text-lg font-black">6 players checked in</h4>
                  </div>
                  <Users className="size-7" aria-label="Waiting players" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
                  {["Chris Wong", "Emery Ross", "Parker Lane", "Devon Fox", "Lee Young", "Sage Cole"].map((name, index) => (
                    <span key={name} className={`border-2 border-black px-2 py-1 ${index % 2 === 0 ? "bg-[#FFDB58]" : "bg-[#4ECDC4]"}`}>{name}</span>
                  ))}
                </div>
              </article>
            </div>

            <article className="border-[3px] border-black bg-[#F4F4F4] p-4 shadow-[4px_4px_0_#000] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Leaderboard</p>
                  <h4 className="text-2xl font-black">Tonight&apos;s podium</h4>
                </div>
                <Crown className="size-8" aria-label="Podium leaders" />
              </div>
              <div className="mt-5 overflow-x-auto pb-1">
                <div className="min-w-[360px] space-y-3">
                  {leaderboard.map((player) => (
                    <div key={player.rank} className={`grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 border-[3px] border-black p-2.5 font-bold ${player.color}`}>
                      <span className="grid size-8 place-items-center border-2 border-black bg-black text-white">{player.rank}</span>
                      <span>{player.name}</span>
                      <span className="text-sm">{player.record}</span>
                      <span className="border-2 border-black bg-white px-2 py-1 text-xs">{player.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuoteIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-12" role="img" aria-label="Quotation mark">
      <path d="M4 28C4 16 10 8 22 4l3 7c-6 3-9 6-10 11h8v20H4V28Zm23 0C27 16 33 8 45 4l3 7c-6 3-9 6-10 11h8v20H27V28Z" fill="currentColor" stroke="#000" strokeWidth="2" />
    </svg>
  );
}

function SocialMarks() {
  return (
    <div className="flex items-center gap-3" aria-label="Social profiles not yet available">
      <span className="neo-social-label" aria-label="Instagram profile coming soon">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2.5" /><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor" /></svg>
      </span>
      <span className="neo-social-label" aria-label="X profile coming soon">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path d="M5 4 19 20M19 4 5 20" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
      </span>
      <span className="neo-social-label" aria-label="YouTube profile coming soon">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path d="M21 8.2a3 3 0 0 0-2.1-2.1C17 5.6 12 5.6 12 5.6s-5 0-6.9.5A3 3 0 0 0 3 8.2 31 31 0 0 0 2.6 12 31 31 0 0 0 3 15.8a3 3 0 0 0 2.1 2.1c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8Z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m10 9 5 3-5 3V9Z" fill="currentColor" /></svg>
      </span>
    </div>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t-[3px] border-black bg-black px-4 py-14 text-[#FFFDF2] dark:border-[#FFFDF2] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.4fr_2fr]">
        <div>
          <BrandMark />
          <p className="mt-5 max-w-sm font-bold leading-relaxed text-[#FFFDF2]/80">
            Pickleball session management for clearer queues, balanced matches, active courts, and live standings.
          </p>
          <div className="mt-6"><SocialMarks /></div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#FFDB58]">Product</h2>
            <nav className="mt-4 grid gap-3" aria-label="Footer product navigation">
              <Link href="/#features" className="neo-footer-link">Features</Link>
              <Link href="/#how-it-works" className="neo-footer-link">How It Works</Link>
              <Link href="/#pricing" className="neo-footer-link">Pricing</Link>
              <Link href="/#live-board" className="neo-footer-link">Live Board</Link>
            </nav>
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#4ECDC4]">Organizers</h2>
            <nav className="mt-4 grid gap-3" aria-label="Footer organizer navigation">
              <Link href="/auth/sign-up" className="neo-footer-link">Create a Club</Link>
              <Link href="/auth/login" className="neo-footer-link">Sign In</Link>
            </nav>
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#FF6B6B]">Support</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold text-[#FFFDF2]/65">
              <span>Privacy Policy · Coming soon</span>
              <span>Terms of Use · Coming soon</span>
              <span>Contact · Not published</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-3 border-t-2 border-[#FFFDF2] pt-5 text-sm font-bold sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 PickleBoard. All rights reserved.</p>
        <p className="text-[#FFFDF2]/65">Built to keep every court moving.</p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="landing-shell overflow-x-clip bg-[#FFFDF2] text-black dark:bg-[#111111] dark:text-[#FFFDF2]">
      <LandingHeader />

      <div>
        <section className="relative px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28" aria-labelledby="hero-heading">
          <div className="absolute left-[8%] top-9 hidden h-4 w-28 rotate-[-5deg] bg-[#4ECDC4] lg:block" aria-hidden="true" />
          <div className="absolute right-[4%] top-16 hidden size-12 rotate-12 border-[3px] border-black bg-[#FF6B6B] dark:border-[#FFFDF2] lg:block" aria-hidden="true" />
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div className="relative z-10">
              <p className="neo-kicker bg-[#4ECDC4] text-black">Open play, finally organized</p>
              <h1 id="hero-heading" className="mt-7 max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[5.25rem]">
                Run pickleball nights without the <span className="relative inline-block"><span className="relative z-10">queue chaos.</span><span className="absolute inset-x-0 bottom-1 h-4 -rotate-1 bg-[#FFDB58] dark:bg-[#FF6B6B]" aria-hidden="true" /></span>
              </h1>
              <p className="mt-7 max-w-2xl text-lg font-bold leading-relaxed text-black/70 dark:text-[#FFFDF2]/75 sm:text-xl">
                Manage check-ins, create balanced matches, track every court, and share live standings with players from one energetic scoreboard.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/auth/sign-up" className="neo-button neo-button-red w-full justify-center sm:w-auto">
                  Create Your Club <ArrowRight className="size-5" aria-hidden="true" />
                </Link>
                <Link href="/#live-board" className="neo-button neo-button-cream w-full justify-center sm:w-auto">
                  View Live Demo <ArrowDownRight className="size-5" aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm font-black uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Check className="size-5 text-[#2196F3]" aria-hidden="true" /> Fast check-ins</span>
                <span className="flex items-center gap-1.5"><Check className="size-5 text-[#FF6B6B]" aria-hidden="true" /> Clear rotations</span>
              </div>
            </div>
            <HeroIllustration />
          </div>
        </section>

        <section className="border-y-[3px] border-black bg-black px-4 py-5 text-white dark:border-[#FFFDF2]" aria-label="Product highlights">
          <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {highlights.map((item, index) => (
              <div key={item.label} className="flex min-h-14 items-center gap-3 border-2 border-white px-3 py-2">
                <item.icon className={`size-6 ${index === 0 ? "text-[#FFDB58]" : index === 1 ? "text-[#FF6B6B]" : index === 2 ? "text-[#4ECDC4]" : "text-[#2196F3]"}`} aria-hidden="true" />
                <span className="text-sm font-black uppercase tracking-wide">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 sm:py-28 lg:px-8" aria-labelledby="features-heading">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="neo-kicker bg-[#2196F3] text-black">Everything in rotation</p>
              <h2 id="features-heading" className="mt-5 text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">One board. Every moving part.</h2>
              <p className="mt-5 text-lg font-bold text-black/65 dark:text-[#FFFDF2]/70">Built for busy organizers and players who just want to know where to be next.</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <article key={feature.title} className={`neo-card group ${index % 2 === 1 ? "lg:translate-y-5" : ""}`}>
                  <div className={`grid size-14 place-items-center border-[3px] border-black ${feature.color}`}>
                    <feature.icon className="size-7 text-black" aria-label={feature.title} />
                  </div>
                  <h3 className="mt-6 text-2xl font-black tracking-tight">{feature.title}</h3>
                  <p className="mt-3 font-bold leading-relaxed text-black/65 dark:text-[#FFFDF2]/70">{feature.description}</p>
                  <Zap className="absolute bottom-4 right-4 size-7 opacity-0 transition-all group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-y-[3px] border-black bg-[#4ECDC4] px-4 py-20 text-black dark:border-[#FFFDF2] sm:px-6 sm:py-28 lg:px-8" aria-labelledby="steps-heading">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
              <div>
                <p className="neo-kicker bg-[#FFFDF2]">Three moves. That&apos;s it.</p>
                <h2 id="steps-heading" className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">From check-in to game on.</h2>
              </div>
              <Sparkles className="hidden size-20 rotate-12 lg:block" aria-hidden="true" />
            </div>
            <ol className="mt-12 grid gap-8 lg:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.number} className="relative">
                  <article className="h-full border-[3px] border-black bg-[#FFFDF2] p-6 shadow-[7px_7px_0_#000] sm:p-8">
                    <span className={`inline-block border-[3px] border-black px-4 py-2 text-5xl font-black leading-none ${step.color}`}>{step.number}</span>
                    <h3 className="mt-8 text-2xl font-black leading-tight">{step.title}</h3>
                    <p className="mt-4 font-bold leading-relaxed text-black/65">{step.description}</p>
                  </article>
                  {index < steps.length - 1 ? <ArrowRight className="absolute -right-6 top-1/2 z-10 hidden size-10 border-2 border-black bg-[#FFDB58] p-1 lg:block" aria-hidden="true" /> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <LiveBoardPreview />

        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8" aria-labelledby="testimonials-heading">
          <div className="mx-auto max-w-7xl">
            <p className="neo-kicker bg-[#FF6B6B] text-black">Fictional early-user stories</p>
            <h2 id="testimonials-heading" className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">Less shouting. More playing.</h2>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure key={testimonial.name} className={`border-[3px] border-black p-6 text-black shadow-[6px_6px_0_#000] dark:border-[#FFFDF2] dark:shadow-[6px_6px_0_#FFFDF2] sm:p-8 ${testimonial.color}`}>
                  <QuoteIcon />
                  <blockquote className="mt-6 text-xl font-black leading-relaxed">“{testimonial.quote}”</blockquote>
                  <figcaption className="mt-8 border-t-[3px] border-black pt-4">
                    <p className="font-black">{testimonial.name}</p>
                    <p className="text-sm font-bold">Fictional sample · {testimonial.role}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 border-y-[3px] border-black bg-[#F4F4F4] px-4 py-20 text-black dark:border-[#FFFDF2] sm:px-6 sm:py-28 lg:px-8" aria-labelledby="pricing-heading">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="neo-kicker bg-[#FFDB58]">Simple starting points</p>
              <h2 id="pricing-heading" className="mt-5 text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">Pick the board that fits.</h2>
              <p className="mt-5 text-lg font-bold text-black/65">No made-up prices. Start free while expanded plans are being prepared.</p>
            </div>
            <div className="mt-12 grid items-stretch gap-7 lg:grid-cols-3">
              {tiers.map((tier) => (
                <article key={tier.name} className={`relative flex flex-col border-[3px] border-black p-6 ${tier.popular ? "shadow-[10px_10px_0_#000] lg:-translate-y-4" : "shadow-[5px_5px_0_#000]"} ${tier.color}`}>
                  {tier.popular ? <span className="absolute -right-2 -top-5 rotate-2 border-[3px] border-black bg-[#FF6B6B] px-3 py-1.5 text-xs font-black uppercase tracking-wider">Most Popular</span> : null}
                  <p className="text-sm font-black uppercase tracking-[0.18em]">{tier.name}</p>
                  <h3 className="mt-3 text-4xl font-black tracking-tight">{tier.price}</h3>
                  <p className="mt-4 min-h-12 font-bold text-black/65 dark:text-inherit">{tier.description}</p>
                  <ul className="my-7 grid gap-3" aria-label={`${tier.name} features`}>
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 font-bold"><Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> {feature}</li>
                    ))}
                  </ul>
                  <Link href={tier.href} className="neo-button mt-auto justify-center bg-black text-white shadow-[5px_5px_0_#FF6B6B] hover:shadow-[7px_7px_0_#FF6B6B]">{tier.cta}</Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#FFDB58] px-4 py-20 text-black sm:px-6 sm:py-28 lg:px-8" aria-labelledby="cta-heading">
          <div className="absolute -left-16 top-8 size-48 rounded-full border-[4px] border-black bg-[#4ECDC4]" aria-hidden="true" />
          <div className="absolute -right-10 bottom-10 h-44 w-72 rotate-[-8deg] border-[4px] border-black bg-[#2196F3]" aria-hidden="true"><span className="absolute inset-y-0 left-1/2 border-l-[4px] border-white" /></div>
          <div className="relative z-10 mx-auto max-w-4xl border-[3px] border-black bg-[#FF6B6B] p-7 text-center shadow-[9px_9px_0_#000] sm:p-12">
            <h2 id="cta-heading" className="text-4xl font-black tracking-[-0.045em] sm:text-5xl lg:text-6xl">Ready to make open play easier?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg font-bold sm:text-xl">Create your PickleBoard club, check in your players, and keep every court moving.</p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/auth/sign-up" className="neo-button bg-black text-white shadow-[5px_5px_0_#FFFDF2] hover:shadow-[7px_7px_0_#FFFDF2]">Create Your Club <ArrowRight className="size-5" aria-hidden="true" /></Link>
              <Link href="/auth/login" className="neo-button bg-[#FFFDF2] text-black">Sign In</Link>
            </div>
          </div>
        </section>
      </div>

      <LandingFooter />
    </div>
  );
}
