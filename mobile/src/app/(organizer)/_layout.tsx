import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export default function OrganizerLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <LoadingState label="Loading your account…" />;
  if (!session) return <Redirect href="/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
