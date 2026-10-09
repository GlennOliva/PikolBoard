import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar, Badge, Button, EmptyState } from "@/components/ui";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { lineupInputFromSelection, type LineupInput } from "@/lib/lineup";
import type { Player, SessionPlayer } from "@/types/database";
import type { SessionBundleCourt } from "@/types/session";

function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
            <Button label="Close" variant="ghost" onPress={onClose} />
          </View>
          <View style={styles.sheetBody}>{children}</View>
          {footer ? <View style={[styles.sheetFooter, { borderTopColor: theme.border }]}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export function AssignCourtModal({
  visible,
  courts,
  onClose,
  onSelect,
  busy,
}: {
  visible: boolean;
  courts: SessionBundleCourt[];
  onClose: () => void;
  onSelect: (courtId: string) => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const free = courts.filter((c) => !c.match && c.status !== "disabled");

  return (
    <Sheet visible={visible} title="Assign to a court" onClose={onClose}>
      {free.length === 0 ? (
        <EmptyState title="No open courts" message="Finish a match to free a court." />
      ) : (
        <View style={styles.list}>
          {free.map((court) => (
            <Pressable
              key={court.id}
              onPress={() => onSelect(court.id)}
              disabled={busy}
              style={[styles.pickRow, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Text style={[styles.pickLabel, { color: theme.text }]}>
                {court.name ?? `Court ${court.court_number}`}
              </Text>
              <Badge label="Open" tone="neutral" />
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

export function AddPlayersModal({
  visible,
  roster,
  sessionPlayerIds,
  onClose,
  onAdd,
  busy,
}: {
  visible: boolean;
  roster: Player[];
  sessionPlayerIds: Set<string>;
  onClose: () => void;
  onAdd: (playerIds: string[]) => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const available = useMemo(
    () => roster.filter((p) => !sessionPlayerIds.has(p.id)),
    [roster, sessionPlayerIds],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function reset() {
    setSelected(new Set());
  }

  return (
    <Sheet
      visible={visible}
      title="Add players"
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <Button
          label={`Add ${selected.size || ""}`.trim()}
          onPress={() => {
            onAdd([...selected]);
            reset();
          }}
          disabled={selected.size === 0 || busy}
          loading={busy}
        />
      }
    >
      {available.length === 0 ? (
        <EmptyState title="Everyone is already in" message="All club players are on this session." />
      ) : (
        <FlatList
          data={available}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                style={[styles.pickRow, { borderColor: theme.border, backgroundColor: isSelected ? theme.primarySoft : theme.card }]}
              >
                <Avatar name={item.display_name} size={32} />
                <Text style={[styles.pickLabel, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                  {item.display_name}
                </Text>
                <Badge label={`Skill ${item.skill_level}`} tone="neutral" />
              </Pressable>
            );
          }}
        />
      )}
    </Sheet>
  );
}

export function EditLineupModal({
  visible,
  title,
  candidates,
  format,
  initialSelectedIds,
  onClose,
  onSave,
  busy,
}: {
  visible: boolean;
  title: string;
  candidates: SessionPlayer[];
  format: "singles" | "doubles";
  initialSelectedIds: string[];
  onClose: () => void;
  onSave: (input: LineupInput) => void;
  busy?: boolean;
}) {
  const theme = useTheme();
  const required = format === "singles" ? 2 : 4;
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);

  const selectedPlayers = useMemo(() => {
    const byId = new Map(candidates.map((p) => [p.player_id, p]));
    return selected.map((id) => byId.get(id)).filter((p): p is SessionPlayer => Boolean(p));
  }, [candidates, selected]);

  function toggle(playerId: string) {
    setSelected((prev) => {
      if (prev.includes(playerId)) return prev.filter((id) => id !== playerId);
      if (prev.length >= required) return prev;
      return [...prev, playerId];
    });
  }

  return (
    <Sheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <Button
          label={`Save lineup (${selected.length}/${required})`}
          onPress={() => onSave(lineupInputFromSelection(selectedPlayers, format))}
          disabled={selected.length !== required || busy}
          loading={busy}
        />
      }
    >
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        Pick {required} players in order. The first {required / 2} form team 1.
      </Text>
      <FlatList
        data={candidates}
        keyExtractor={(item) => item.player_id}
        renderItem={({ item }) => {
          const index = selected.indexOf(item.player_id);
          const isSelected = index >= 0;
          return (
            <Pressable
              onPress={() => toggle(item.player_id)}
              style={[styles.pickRow, { borderColor: theme.border, backgroundColor: isSelected ? theme.primarySoft : theme.card }]}
            >
              {isSelected ? (
                <View style={[styles.order, { backgroundColor: theme.primary }]}>
                  <Text style={{ color: theme.primaryText, fontWeight: "700" }}>{index + 1}</Text>
                </View>
              ) : (
                <Avatar name={item.display_name} size={32} />
              )}
              <Text style={[styles.pickLabel, { color: theme.text, flex: 1 }]} numberOfLines={1}>
                {item.display_name}
              </Text>
              <Badge label={`Skill ${item.skill_level}`} tone="neutral" />
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState title="No available players" />}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  sheetBody: { padding: Spacing.three, flexShrink: 1 },
  sheetFooter: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  list: { gap: Spacing.two },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.two,
  },
  pickLabel: { fontSize: 16, fontWeight: "600" },
  order: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 13, marginBottom: Spacing.two },
});
