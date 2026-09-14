import { useEffect, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/button";
import { Icon } from "@/src/components/icon";
import { PdfActionsSheet } from "@/src/components/pdf-actions";
import { useToast } from "@/src/components/toast";
import { useImageSession } from "@/src/session/image-session";
import { useRecentPdfs } from "@/src/pdf/recent-pdfs";
import { openPdf, sharePdf } from "@/src/pdf/file-ops";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";
import { formatBytes, pluralize } from "@/src/utils/format";

export default function Result() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { getById } = useRecentPdfs();
  const { clear } = useImageSession();

  const record = getById(id);
  const [sheetMode, setSheetMode] = useState<"actions" | "rename" | "confirmDelete">(
    "actions",
  );
  const [sheetVisible, setSheetVisible] = useState(false);

  const goHome = () => router.replace("/");

  useEffect(() => {
    // The image session is done once the PDF is created.
    clear();
  }, [clear]);

  useEffect(() => {
    // Android hardware back should go home, not back to the settings screen.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goHome();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!record) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Icon name="document-outline" size={56} color={colors.muted} />
          <Text style={[styles.title, { color: colors.onSurface }]}>PDF not found</Text>
          <View style={{ height: spacing.xl }} />
          <Button label="Return to Home" onPress={goHome} testID="result-home-button" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={[styles.successCircle, { backgroundColor: colors.brandTertiary }]}>
          <Icon name="checkmark" size={48} color={colors.success} />
        </View>
        <Text style={[styles.title, { color: colors.onSurface }]}>PDF Created</Text>

        <View style={[styles.infoCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.fileName, { color: colors.onSurface }]} numberOfLines={2}>
            {record.name}.pdf
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Icon name="save-outline" size={16} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {formatBytes(record.size)}
              </Text>
            </View>
            <View style={[styles.dot, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.metaItem}>
              <Icon name="documents-outline" size={16} color={colors.muted} />
              <Text style={[styles.metaText, { color: colors.muted }]}>
                {pluralize(record.pageCount, "page")}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          label="Open PDF"
          icon="open-outline"
          onPress={async () => {
            const ok = await openPdf(record.uri);
            if (!ok) toast.show("Couldn't open this PDF", "error");
          }}
          testID="open-pdf-button"
        />
        <Button
          label="Share"
          icon="share-outline"
          variant="secondary"
          onPress={async () => {
            const ok = await sharePdf(record.uri);
            if (!ok) toast.show("Sharing isn't available", "error");
          }}
          testID="share-pdf-button"
        />
        <View style={styles.secondaryRow}>
          <View style={{ flex: 1 }}>
            <Button
              label="Rename"
              icon="create-outline"
              variant="tertiary"
              onPress={() => {
                setSheetMode("rename");
                setSheetVisible(true);
              }}
              testID="rename-pdf-button"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Delete"
              icon="trash-outline"
              variant="tertiary"
              onPress={() => {
                setSheetMode("confirmDelete");
                setSheetVisible(true);
              }}
              testID="delete-pdf-button"
            />
          </View>
        </View>
        <Button
          label="Return to Home"
          variant="ghost"
          onPress={goHome}
          testID="result-home-button"
        />
      </View>

      <PdfActionsSheet
        visible={sheetVisible}
        record={record}
        initialMode={sheetMode}
        onClose={() => setSheetVisible(false)}
        onDeleted={goHome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { fontSize: font.xxl, fontWeight: weight.medium },
  infoCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    marginTop: spacing.xl,
    alignItems: "center",
  },
  fileName: { fontSize: font.lg, fontWeight: weight.medium, textAlign: "center" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  metaText: { fontSize: font.base },
  dot: { width: 3, height: 3, borderRadius: 2 },
  actions: { paddingHorizontal: spacing.lg, gap: spacing.md },
  secondaryRow: { flexDirection: "row", gap: spacing.md },
});
