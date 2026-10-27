"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#live-board", label: "Live Board" },
  { href: "/auth/login", label: "Sign In" },
] as const;

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="neo-icon-button"
        aria-expanded={isOpen}
        aria-controls="landing-mobile-menu"
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {isOpen ? (
        <div
          id="landing-mobile-menu"
          className="absolute inset-x-0 top-full border-b-[3px] border-black bg-[#FFFDF2] p-4 text-black dark:bg-[#111111] dark:text-[#FFFDF2]"
        >
          <nav aria-label="Mobile navigation" className="mx-auto grid max-w-7xl gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="neo-nav-link min-h-11 border-2 border-transparent px-3 py-2 text-base hover:border-black hover:bg-[#FFDB58] hover:text-black dark:hover:border-[#FFFDF2]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/auth/sign-up"
              onClick={closeMenu}
              className="neo-button neo-button-yellow mt-2 justify-center"
            >
              Create a Club
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
