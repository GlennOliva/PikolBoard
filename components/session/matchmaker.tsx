"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildProposalAction } from "@/app/actions/matchmaking-actions";
import { createPreparationLineupAction } from "@/app/actions/lineup-actions";
import { initialsOf } from "@/lib/format";

/**
 * The matchmaker panel.
 *
 * The engine runs on the server (buildProposalAction) so the rules stay in one
 * tested place, and the organizer sees the suggested teams plus the reason before
 * committing. Committing creates a Preparation lineup rather than staging one on a
 * court: a lineup has to exist before it has somewhere to play, and the pipeline
 * decides what happens next (Up Next, then a court).
 */
export function Matchmaker({
  sessionId,
  canManage,
  playerNames,
}: {
  sessionId: string;
  canManage: boolean;
  /** players.id -> display name, taken from the roster the page already loaded. */
  playerNames: Record<string, string>;
}) {
  const router = useRouter();
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof buildProposalAction>
  > | null>(null);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setError(null);
    setCreating(false);
    setPending(true);
    const proposal = await buildProposalAction({ sessionId });
    setPending(false);
    setResult(proposal.ok ? proposal : null);
    if (!proposal.ok) setError(proposal.error);
  }

  function clear() {
    setResult(null);
    setError(null);
  }

  async function create() {
    if (!result?.lineup) return;
    setCreating(true);
    const created = await createPreparationLineupAction({
      sessionId,
      playerIds: result.lineup.playerIds,
      teamNumbers: result.lineup.teamNumbers,
      slotNumbers: result.lineup.slotNumbers,
      explanation: result.lineup.explanation,
      matchingMode: result.lineup.matchingMode as
        | "fifo"
        | "balanced"
        | "skill_separated"
        | undefined,
    });
    setCreating(false);
    if (created.ok) {
      clear();
      router.refresh();
    } else {
      setError(created.error);
    }
  }

  if (!canManage) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Matchmaker</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Button type="button" onClick={suggest} disabled={pending || creating}>
            <Wand2 className="mr-2 size-4" aria-hidden />
            {pending ? "Thinking…" : "Suggest a lineup"}
          </Button>
          <p className="text-sm text-muted-foreground">
            The suggestion joins the Preparation queue. Assign it to a court when one
            frees up.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        {result?.lineup ? (
          <SuggestedLineup
            lineup={result.lineup}
            playerNames={playerNames}
            creating={creating}
            onCreate={create}
            onDiscard={clear}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function SuggestedLineup({
  lineup,
  playerNames,
  creating,
  onCreate,
  onDiscard,
}: {
  lineup: NonNullable<
    Awaited<ReturnType<typeof buildProposalAction>>["lineup"]
  >;
  playerNames: Record<string, string>;
  creating: boolean;
  onCreate: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((team) => (
          <div key={team}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Team {team}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {lineup.playerIds
                .map((id, index) => ({
                  id,
                  team: lineup.teamNumbers[index],
                }))
                .filter((player) => player.team === team)
                .map((player) => (
                  <li key={player.id} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden
                      className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold"
                    >
                      {initialsOf(nameOf(playerNames, player.id))}
                    </span>
                    {nameOf(playerNames, player.id)}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {lineup.explanation}
      </p>

      <div className="flex gap-2">
        <Button type="button" onClick={onCreate} disabled={creating}>
          {creating ? "Adding…" : "Add to preparation"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDiscard} disabled={creating}>
          Discard
        </Button>
      </div>
    </div>
  );
}

/**
 * The proposal response carries player ids only, so display names come from the
 * roster the page already rendered rather than being sent back a second time.
 *
 * The keys are players.id, which is what every lineup RPC takes. They are not the
 * session_players row id: keying the map by the row id made every lookup miss and
 * rendered a proposed lineup as four rows all reading "Player", which looked like
 * a placeholder bug rather than a key mismatch.
 */
function nameOf(names: Record<string, string>, id: string): string {
  return names[id] ?? "Unknown";
}