import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppSheet } from "./sheet";
import { Button } from "./button";
import { Icon, type IconName } from "./icon";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";
import { useToast } from "./toast";
import { useRecentPdfs, type PdfRecord } from "@/src/pdf/recent-pdfs";
import { openPdf, sharePdf } from "@/src/pdf/file-ops";
import { haptics } from "@/src/utils/haptics";

type Mode = "actions" | "rename" | "confirmDelete";

function ActionRow({
  icon,
  label,
  onPress,
  danger,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const color = danger ? colors.error : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.divider },
        pressed && { backgroundColor: colors.surfaceTertiary, opacity: 0.9 },
      ]}
    >
      <Icon name={icon} size={22} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function PdfActionsSheet({
  visible,
  record,
  onClose,
  onDeleted,
  initialMode = "actions",
}: {
  visible: boolean;
  record: PdfRecord | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
  initialMode?: Mode;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const { rename, remove } = useRecentPdfs();
  const [mode, setMode] = useState<Mode>("actions");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible && record) {
      setMode(initialMode);
      setName(record.name);
    }
  }, [visible, record, initialMode]);

  if (!record) return null;

  const missing = record.missing;

  const handleOpen = async () => {
    onClose();
    const ok = await openPdf(record.uri);
    if (!ok) toast.show("Couldn't open this PDF", "error");
  };

  const handleShare = async () => {
    onClose();
    const ok = await sharePdf(record.uri);
    if (!ok) toast.show("Sharing isn't available", "error");
  };

  const handleRenameSave = async () => {
    if (!name.trim()) {
      toast.show("Enter a file name", "error");
      return;
    }
    setBusy(true);
    const updated = await rename(record.id, name.trim());
    setBusy(false);
    if (updated) {
      haptics.success();
      toast.show("Renamed", "success");
      onClose();
    } else {
      toast.show("Couldn't rename file", "error");
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    await remove(record.id);
    setBusy(false);
    haptics.warning();
    toast.show("PDF deleted", "success");
    onDeleted?.(record.id);
    onClose();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={mode === "rename" ? "Rename PDF" : record.name}
      testID="pdf-actions-sheet"
    >
      {mode === "actions" ? (
        <View>
          {missing ? (
            <Text style={[styles.warn, { color: colors.warning }]}>
              This file is missing and can only be removed.
            </Text>
          ) : (
            <>
              <ActionRow
                icon="open-outline"
                label="Open"
                onPress={handleOpen}
                testID="action-open"
              />
              <ActionRow
                icon="share-outline"
                label="Share"
                onPress={handleShare}
                testID="action-share"
              />
              <ActionRow
                icon="create-outline"
                label="Rename"
                onPress={() => setMode("rename")}
                testID="action-rename"
              />
            </>
          )}
          <ActionRow
            icon="trash-outline"
            label="Delete"
            danger
            onPress={() => setMode("confirmDelete")}
            testID="action-delete"
          />
        </View>
      ) : null}

      {mode === "rename" ? (
        <View style={{ gap: spacing.lg }}>
          <TextInput
            testID="rename-input"
            value={name}
            onChangeText={setName}
            autoFocus
            selectTextOnFocus
            placeholder="File name"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            onSubmitEditing={handleRenameSave}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceTertiary,
                color: colors.onSurface,
                borderColor: colors.border,
              },
            ]}
          />
          <Button
            label="Save"
            onPress={handleRenameSave}
            loading={busy}
            testID="rename-save-button"
          />
          <Button
            label="Cancel"
            variant="tertiary"
            onPress={() => setMode("actions")}
            testID="rename-cancel-button"
          />
        </View>
      ) : null}

      {mode === "confirmDelete" ? (
        <View style={{ gap: spacing.lg }}>
          <Text style={[styles.confirmText, { color: colors.onSurfaceSecondary }]}>
            Delete “{record.name}”? This can’t be undone.
          </Text>
          <Button
            label="Delete PDF"
            variant="danger"
            onPress={handleDelete}
            loading={busy}
            testID="confirm-delete-button"
          />
          <Button
            label="Cancel"
            variant="tertiary"
            onPress={() => setMode("actions")}
            testID="confirm-cancel-button"
          />
        </View>
      ) : null}
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: font.lg,
    fontWeight: weight.regular,
  },
  input: {
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: font.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confirmText: {
    fontSize: font.base,
    lineHeight: 20,
  },
  warn: {
    fontSize: font.base,
    marginBottom: spacing.md,
  },
});
