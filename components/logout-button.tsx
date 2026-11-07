"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button onClick={logout} size="sm" variant="ghost">
      <LogOut className="size-4" aria-hidden />
      <span className="hidden sm:inline">Log out</span>
      <span className="sr-only sm:hidden">Log out</span>
    </Button>
  );
}
