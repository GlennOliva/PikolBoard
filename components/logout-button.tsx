"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const submittingRef = useRef(false);
  const router = useRouter();

  const logout = async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    let message: string | null = null;

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        message = "We could not sign you out. Please try again.";
      }
    } catch {
      message = "We could not sign you out. Please try again.";
    }

    if (message) {
      setError(message);
      setIsLoading(false);
      submittingRef.current = false;
      return;
    }

    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={logout}
        size="sm"
        variant="ghost"
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label={isLoading ? "Signing out…" : "Log out"}
      >
        <LogOut className="size-4" aria-hidden />
        {isLoading ? (
          <span>Signing out…</span>
        ) : (
          <>
            <span className="hidden sm:inline">Log out</span>
            <span className="sr-only sm:hidden">Log out</span>
          </>
        )}
      </Button>
      {error ? (
        <span role="alert" className="max-w-44 text-xs leading-tight text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
