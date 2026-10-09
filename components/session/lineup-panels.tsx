"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDownUp, ArrowUp, CircleSlash, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  assignLineupToCourtAction,
  cancelLineupAction,
  demoteLineupAction,
  promoteLineupAction,
  updateLineupPlayersAction,
} from "@/app/actions/lineup-actions";
import { LineupEditDialog } from "@/components/session/lineup-edit-dialog";
import { initialsOf } from "@/lib/format";
import {
  assignableCourts,
  courtLabel,
  preparationGroups,
  upNextGroup,
  type CourtLike,
  type LineupGroup,
  type LineupMatchLike,
  type RosterRowLike,
  type SessionFormat,
} from "@/lib/domain/session/lineups";

/**
 * The organizer's view of the lineup pipeline.
 *
 * Two panels, because the pipeline has two stages that mean different things. Up
 * Next is the one lineup that goes on a court next, so it carries the court
 * assignment. Preparation is the waiting room, ordered oldest first, and it is what
 * gets promoted when a court frees up.
 *
 * Every button here maps to exactly one RPC and every mutation re-reads the bundle,
 * so the panels never hold a pipeline state of their own. Automatic promotion is
 * FIFO in SQL; while Up Next is empty, the organizer can also explicitly promote
 * one prepared lineup.
 */
export function LineupPanels({
  sessionId,
  matches,
  courts,
  roster,
  format,
  canManage,
}: {
  sessionId: string;
  matches: LineupMatchLike[];
  courts: CourtLike[];
  roster: RosterRowLike[];
  format: SessionFormat;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ match: LineupMatchLike; label: string } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preparing = preparationGroups(matches);
  const upNext = upNextGroup(matches);
  const openCourts = assignableCourts(courts);

  async function mutate(
    key: string,
    run: () => Promise<{ ok: boolean; error: string | null }>,
  ) {
    setBusy(key);
    setError(null);
    const result = await run();
    setBusy(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <section aria-labelledby="up-next-lineup" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="up-next-lineup" className="text-lg font-medium">
            Up Next
          </h2>
          {upNext ? <Badge variant="secondary">plays next</Badge> : null}
        </div>
        {upNext ? (
          <LineupCard
            group={upNext}
            tone="next"
            busy={busy}
            courts={openCourts}
            canManage={canManage}
            onEdit={() => setEditing({ match: upNext.match, label: upNext.label })}
            onAssign={(courtId) =>
              mutate(`assign:${upNext.match.id}`, () =>
                assignLineupToCourtAction({
                  sessionId,
                  matchId: upNext.match.id,
                  courtId,
                }),
              )
            }
            onDemote={() =>
              mutate(`demote:${upNext.match.id}`, () =>
                demoteLineupAction({ sessionId, matchId: upNext.match.id }),
              )
            }
            onCancel={() =>
              mutate(`cancel:${upNext.match.id}`, () =>
                cancelLineupAction({ sessionId, matchId: upNext.match.id }),
              )
            }
          />
        ) : (
          <EmptyPanel
            title="Nothing lined up yet"
            body={
              preparing.length > 0
                ? "Promote the longest-waiting lineup to send it Up Next."
                : "Ask the matchmaker for a suggestion to start the queue."
            }
          />
        )}
      </section>

      <section aria-labelledby="preparation" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="preparation" className="text-lg font-medium">
            Preparation
          </h2>
          {preparing.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {preparing.length} waiting, oldest first
            </span>
          ) : null}
        </div>
        {preparing.length === 0 ? (
          <EmptyPanel
            title="No lineups waiting"
            body="Lineups you create, or that the matchmaker suggests, wait here until a court frees up."
          />
        ) : (
          preparing.map((group) => (
            <LineupCard
              key={group.match.id}
              group={group}
              tone="preparing"
              busy={busy}
              courts={openCourts}
              canManage={canManage}
              onEdit={() => setEditing({ match: group.match, label: group.label })}
              onAssign={(courtId) =>
                mutate(`assign:${group.match.id}`, () =>
                  assignLineupToCourtAction({
                    sessionId,
                    matchId: group.match.id,
                    courtId,
                  }),
                )
              }
              onPromote={
                // The pipeline holds one Up Next. The button is hidden rather than
                // disabled-with-an-error while that slot is occupied.
                upNext ? undefined : () =>
                  mutate(`promote:${group.match.id}`, () =>
                    promoteLineupAction({ sessionId, matchId: group.match.id }),
                  )
              }
              onCancel={() =>
                mutate(`cancel:${group.match.id}`, () =>
                  cancelLineupAction({ sessionId, matchId: group.match.id }),
                )
              }
            />
          ))
        )}
      </section>

      <LineupEditDialog
        key={editing?.match.id ?? "closed"}
        target={editing}
        roster={roster}
        matches={matches}
        courts={courts}
        format={format}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          const result = await updateLineupPlayersAction({
            sessionId,
            ...input,
          });
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </div>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function LineupCard({
  group,
  tone,
  courts,
  canManage,
  busy,
  onEdit,
  onAssign,
  onPromote,
  onDemote,
  onCancel,
}: {
  group: LineupGroup;
  tone: "next" | "preparing";
  courts: CourtLike[];
  canManage: boolean;
  busy: string | null;
  onEdit: () => void;
  onAssign: (courtId: string) => void;
  onPromote?: () => void;
  onDemote?: () => void;
  onCancel: () => void;
}) {
  const { match } = group;
  const keys = {
    assign: `assign:${match.id}`,
    cancel: `cancel:${match.id}`,
    promote: `promote:${match.id}`,
    demote: `demote:${match.id}`,
  };
  const pending = (key: string) => busy === key;

  return (
    <Card className={tone === "next" ? "border-primary/40" : undefined}>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">{group.label}</CardTitle>
        <Badge variant={tone === "next" ? "default" : "outline"}>
          {tone === "next" ? "Up next" : "Preparing"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {([1, 2] as const).map((team) => (
            <div key={team}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Team {team}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {group.entries
                  .filter((entry) => entry.team_number === team)
                  .map((entry) => (
                    <li
                      key={entry.lineup_id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        aria-hidden
                        className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold"
                      >
                        {initialsOf(entry.display_name)}
                      </span>
                      {entry.display_name}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>

        {match.explanation ? (
          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            {match.explanation}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <select
              aria-label={`Send ${group.label} to a court`}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              value=""
              disabled={courts.length === 0 || pending(keys.assign)}
              onChange={(event) => {
                if (event.target.value) onAssign(event.target.value);
              }}
            >
              <option value="">
                {courts.length === 0 ? "No free court" : "Send to court…"}
              </option>
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  {courtLabel(court)}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onEdit}
              disabled={Boolean(busy)}
            >
              <Pencil className="mr-2 size-3.5" aria-hidden />
              Edit
            </Button>

            {onPromote ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onPromote}
                disabled={Boolean(busy)}
              >
                <ArrowUp className="mr-2 size-3.5" aria-hidden />
                {pending(keys.promote) ? "Promoting…" : "Make up next"}
              </Button>
            ) : null}

            {onDemote ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDemote}
                disabled={Boolean(busy)}
              >
                <ArrowDownUp className="mr-2 size-3.5" aria-hidden />
                {pending(keys.demote) ? "Sending back…" : "Send back"}
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={Boolean(busy)}
            >
              <CircleSlash className="mr-2 size-3.5" aria-hidden />
              {pending(keys.cancel) ? "Cancelling…" : "Cancel"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
