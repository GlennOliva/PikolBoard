"use client";

import { useActionState } from "react";
import { FormError } from "@/components/forms/form-error";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addMemberAction,
  setMemberRoleAction,
} from "@/app/actions/session-actions";

import {
  idleState,
  type ActionState,
} from "@/app/actions/session-action-state";
import type { ClubMemberRow } from "@/lib/db/queries";
import type { ClubRole } from "@/lib/db/types";

const ROLES: { value: ClubRole; label: string; blurb: string }[] = [
  { value: "owner", label: "Owner", blurb: "Full control, including owners" },
  { value: "admin", label: "Admin", blurb: "Can manage roster and sessions" },
  { value: "player", label: "Player", blurb: "Plays and views standings" },
];

export function MembersPanel({
  clubId,
  members,
  viewerRole,
}: {
  clubId: string;
  members: ClubMemberRow[];
  viewerRole: ClubRole;
}) {
  const [addState, addAction] = useActionState<ActionState, FormData>(
    addMemberAction,
    idleState,
  );
  const [roleState, roleAction] = useActionState<ActionState, FormData>(
    setMemberRoleAction,
    idleState,
  );

  const isOwner = viewerRole === "owner";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
          <CardDescription>
            Roles decide who can change the roster, sessions, and scoring.
            Names come from the roster, so add players there first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormError state={roleState} />

          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active members yet.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {member.display_name ?? "Player without a roster entry"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.linked_player_id
                        ? ROLES.find((r) => r.value === member.role)?.blurb
                        : "Not linked to a roster player"}
                    </p>
                  </div>

                  <form action={roleAction} className="flex items-center gap-2">
                    <input type="hidden" name="clubId" value={clubId} />
                    <input type="hidden" name="userId" value={member.user_id} />
                    <Select name="role" defaultValue={member.role}>
                      <SelectTrigger
                        className="h-9 w-32"
                        aria-label={`Role for ${member.display_name ?? "member"}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem
                            key={role.value}
                            value={role.value}
                            // Only an owner may hand out owner; the RPC enforces
                            // it too, but hiding it avoids a guaranteed failure.
                            disabled={role.value === "owner" && !isOwner}
                          >
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a member</CardTitle>
          <CardDescription>
            Adds the person as a player. Members can be linked to a roster
            player later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addAction} className="flex flex-col gap-4">
            <FormError state={addState} />
            <input type="hidden" name="clubId" value={clubId} />

            <div className="flex flex-col gap-2">
              <Label htmlFor="userId">Account id</Label>
              <Input
                id="userId"
                name="userId"
                required
                pattern="[0-9a-fA-F-]{36}"
                placeholder="00000000-0000-0000-0000-000000000000"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                The other person finds their id in their profile settings.
              </p>
            </div>

            <div>
              <SubmitButton pendingLabel="Adding…">Add member</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}