import { notFound } from "next/navigation";

/**
 * Legacy session-scoped share URL.
 *
 * Session-id links are intentionally retired. The organizer must share the
 * unguessable `/live/[publicToken]` capability instead.
 */
export default function LegacyPublicSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  void params;
  notFound();
}
