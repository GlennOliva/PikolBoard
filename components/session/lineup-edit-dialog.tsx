"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  courtLabel,
  moveSelection,
  selectionFromMatch,
  selectableRoster,
  selectionToArrays,
  validateSelection,
  type CourtLike,
  type LineupMatchLike,
  type LineupSelection,
  type RosterRowLike,
  type SessionFormat,
} from "@/lib/domain/session/lineups";

/**
 * Editing who is on a lineup that has not been played yet.
 *
 * The dialog owns the selection; the database owns the truth. Every rule the RPC
 * enforces -- exact size, no duplicate player, two slots per team, checked-in
 * players only, nobody already reserved elsewhere -- is checked here first so the
 * organizer gets the reason in the dialog instead of a round trip, but the save
 * still goes through update_lineup_players, which re-checks all of it.
 *
 * Players are offered per slot rather than as two team lists. That is what makes
 * swapping partners possible: with one list per team, moving a player means
 * emptying a slot first and hoping the organizer notices the gap.
 */

export interface LineupEditTarget {
  match: LineupMatchLike;
  label: string;
}

export function LineupEditDialog({
  target,
  roster,
  matches,
  courts,
  format,
  onClose,
  onSave,
}: {
  target: LineupEditTarget | null;
  roster: RosterRowLike[];
  matches: LineupMatchLike[];
  courts: CourtLike[];
  format: SessionFormat;
  onClose: () => void;
  onSave: (input: {
    matchId: string;
    playerIds: string[];
    teamNumbers: number[];
    slotNumbers: number[];
  }) => Promise<{ ok: boolean; error: string | null }>;
}) {
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selections, setSelections] = useState<LineupSelection[] | null>(null);
  const [targetSlot, setTargetSlot] = useState<{ team: 1 | 2; slot: number }>({
    team: 1,
    slot: 1,
  });

  const match = target?.match ?? null;
  const current =
    selections ??
    (match ? selectionFromMatch(match, format) : []);

  const options = useMemo(
    () => (match ? selectableRoster(roster, matches, match.id) : []),
    [roster, matches, match],
  );

  const matchesSearch = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle.length === 0) return options;
    return options.filter((row) =>
      row.display_name.toLowerCase().includes(needle),
    );
  }, [options, search]);

  if (!match) return null;
  const matchId = match.id;

  const slots = current
    .slice()
    .sort((a, b) => a.team - b.team || a.slot - b.slot);

  function occupy(team: 1 | 2, slot: number, playerId: string) {
    const from = current.find(
      (selection) => selection.player_id === playerId,
    );
    setSelections(
      from
        ? moveSelection(current, { team: from.team, slot: from.slot }, { team, slot })
        : current.map((selection) =>
            selection.team === team && selection.slot === slot
              ? { ...selection, player_id: playerId }
              : selection,
          ),
    );
    setError(null);
  }

  function clearSlot(team: 1 | 2, slot: number) {
    setSelections(
      current.map((selection) =>
        selection.team === team && selection.slot === slot
          ? { ...selection, player_id: null }
          : selection,
      ),
    );
    setError(null);
  }

  async function save() {
    const problem = validateSelection(current, format);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    const arrays = selectionToArrays(current);
    const result = await onSave({
      matchId,
      playerIds: arrays.playerIds,
      teamNumbers: arrays.teamNumbers,
      slotNumbers: arrays.slotNumbers,
    });
    setSaving(false);
    if (result.ok) {
      onClose();
    } else {
      setError(result.error);
    }
  }

  const nameOf = (playerId: string | null) =>
    playerId ? (roster.find((row) => row.player_id === playerId)?.display_name ?? "Unknown") : null;

  const stagedCourt = courts.find((court) => court.id === match.court_id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${target?.label ?? "lineup"}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4"
    >
      <div className="mt-10 w-full max-w-xl rounded-lg border bg-card p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-medium">Edit lineup</h2>
            <p className="text-sm text-muted-foreground">
              {target?.label}
              {stagedCourt ? ` · ${courtLabel(stagedCourt)}` : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {slots.map((slot) => {
            const playerId = current.find(
              (selection) =>
                selection.team === slot.team && selection.slot === slot.slot,
            )?.player_id ?? null;
            return (
              <div
                key={`${slot.team}-${slot.slot}`}
                className={
                  "rounded-md border p-3 " +
                  (targetSlot.team === slot.team && targetSlot.slot === slot.slot
                    ? "border-primary bg-primary/5"
                    : "border-border")
                }
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Team {slot.team} · Slot {slot.slot}
                </p>
                <p className="mt-1 text-sm font-medium">
                  {playerId ? (
                    nameOf(playerId)
                  ) : (
                    <span className="text-muted-foreground">Select checked-in player</span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-1 px-0 text-xs text-muted-foreground"
                    onClick={() => setTargetSlot({ team: slot.team, slot: slot.slot })}
                  >
                    {playerId ? "Change" : "Choose"}
                  </Button>
                  {playerId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 px-0 text-xs text-muted-foreground"
                      onClick={() => {
                        clearSlot(slot.team, slot.slot);
                        setTargetSlot({ team: slot.team, slot: slot.slot });
                      }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="lineup-player-search" className="text-sm font-medium">
            Assign a player to Team {targetSlot.team} · Slot {targetSlot.slot}
          </label>
          <Input
            id="lineup-player-search"
            value={search}
            placeholder="Search by name"
            onChange={(event) => setSearch(event.target.value)}
          />
          {matchesSearch.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No checked-in player matches that.
            </p>
          ) : (
            <ul className="max-h-56 overflow-y-auto rounded-md border border-border">
              {matchesSearch.map((row) => {
                const assigned = current.find(
                  (selection) => selection.player_id === row.player_id,
                );
                return (
                  <li key={row.player_id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60"
                      onClick={() => {
                        occupy(targetSlot.team, targetSlot.slot, row.player_id);
                      }}
                    >
                      <span>{row.display_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {assigned
                          ? `Team ${assigned.team} · Slot ${assigned.slot}`
                          : `Skill ${row.skill_level}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Choosing a player who is already on the lineup swaps the two slots.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save lineup"}
          </Button>
        </div>
      </div>
    </div>
  );
}
