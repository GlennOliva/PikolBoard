"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "players", label: "Players" },
  { segment: "sessions", label: "Sessions" },
] as const;

export function ClubTabs({
  clubId,
  canManage,
}: {
  clubId: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const base = `/clubs/${clubId}`;

  const tabs = canManage
    ? [...TABS, { segment: "settings", label: "Settings" } as const]
    : TABS;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border text-sm">
      {tabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active =
          tab.segment === "" ? pathname === base : pathname.startsWith(href);

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
