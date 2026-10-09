"use client";

import { useActionState } from "react";

import {
  updateClubAction,
  updateClubSettingsAction,
} from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";

import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { Club, ClubSettings } from "@/lib/db/types";

interface ClubSettingsFormProps {
  club: Club;
  settings: ClubSettings | null;
}

export function ClubSettingsForm({
  club,
  settings,
}: ClubSettingsFormProps) {
  const [details, detailAction] = useActionState<ActionState, FormData>(
    updateClubAction,
    idleState,
  );

  const [defaults, defaultAction] = useActionState<ActionState, FormData>(
    updateClubSettingsAction,
    idleState,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={detailAction} className="flex flex-col gap-5">
        <FormError state={details} />

        <input type="hidden" name="clubId" value={club.id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Club details</CardTitle>

            <CardDescription>
              How your club appears on public pages and shared links.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Club name</Label>

              <Input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={club.name}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>

              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                maxLength={300}
                defaultValue={club.logo_url ?? ""}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="location">Location</Label>

              <Input
                id="location"
                name="location"
                maxLength={160}
                defaultValue={club.location ?? ""}
                placeholder="Harbour Park, Pier 4"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="timezone">Timezone</Label>

              <Input
                id="timezone"
                name="timezone"
                required
                maxLength={64}
                defaultValue={club.timezone}
                placeholder="Asia/Manila"
              />

              <p className="text-xs text-muted-foreground">
                IANA timezone name used to display session times for spectators.
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="isPublic"
                name="isPublic"
                defaultChecked={club.is_public}
              />

              <div className="flex flex-col gap-1">
                <Label htmlFor="isPublic">Public club page</Label>

                <p className="text-xs text-muted-foreground">
                  When disabled, only signed-in members can open{" "}
                  <span className="font-mono">/c/{club.slug}</span>. Public live
                  session links can still work separately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <SubmitButton pendingLabel="Saving…">
            Save club details
          </SubmitButton>
        </div>
      </form>

      <form action={defaultAction} className="flex flex-col gap-5">
        <FormError state={defaults} />

        <input type="hidden" name="clubId" value={club.id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Session defaults</CardTitle>

            <CardDescription>
              These values are pre-filled when creating a new session.
              Individual sessions can override them.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="minGames">
                Minimum games for leaderboard
              </Label>

              <Input
                id="minGames"
                name="minGames"
                type="number"
                min={0}
                max={100}
                defaultValue={settings?.min_games_for_leaderboard ?? 5}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="matchMinutes">
                Default match minutes
              </Label>

              <Input
                id="matchMinutes"
                name="matchMinutes"
                type="number"
                min={5}
                max={60}
                defaultValue={settings?.default_match_minutes ?? 15}
              />
            </div>
          </CardContent>
        </Card>

        <div>
          <SubmitButton pendingLabel="Saving…">
            Save session defaults
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}