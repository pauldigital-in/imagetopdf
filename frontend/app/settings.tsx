import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/src/components/icon";
import { ScreenHeader } from "@/src/components/header";
import { Segmented } from "@/src/components/segmented";
import { useToast } from "@/src/components/toast";
import { useAppConfig } from "@/src/config/config-context";
import { getPdfDefaults, savePdfDefaults } from "@/src/pdf/pdf-defaults";
import type { Orientation, PageSize, Quality } from "@/src/config/defaults";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";

function LinkRow({
  icon,
  label,
  value,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.divider },
        pressed && onPress && { backgroundColor: colors.surfaceTertiary },
      ]}
    >
      <Icon name={icon} size={20} color={colors.brandPrimary} />
      <Text style={[styles.rowLabel, { color: colors.onSurface }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={[styles.rowValue, { color: colors.muted }]}>{value}</Text> : null}
      {onPress ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

export default function Settings() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { config } = useAppConfig();

  const [pageSize, setPageSize] = useState<PageSize>(config.defaultPageSize);
  const [orientation, setOrientation] = useState<Orientation>(config.defaultOrientation);
  const [quality, setQuality] = useState<Quality>(config.defaultQuality);

  useEffect(() => {
    (async () => {
      const d = await getPdfDefaults({
        quality: config.defaultQuality,
        pageSize: config.defaultPageSize,
        orientation: config.defaultOrientation,
      });
      setPageSize(d.pageSize);
      setOrientation(d.orientation);
      setQuality(d.quality);
    })();
  }, [config]);

  const persist = (next: { pageSize?: PageSize; orientation?: Orientation; quality?: Quality }) => {
    const merged = {
      pageSize: next.pageSize ?? pageSize,
      orientation: next.orientation ?? orientation,
      quality: next.quality ?? quality,
    };
    void savePdfDefaults(merged);
  };

  const openPrivacy = async () => {
    const url = config.privacyPolicyUrl;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      try {
        await Linking.openURL(url);
      } catch {
        toast.show("Couldn't open the link", "error");
      }
    }
  };

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <ScreenHeader title="Settings" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
      >
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>DEFAULT PDF SETTINGS</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Page Size</Text>
          <Segmented
            testID="default-page-size"
            value={pageSize}
            onChange={(v) => {
              setPageSize(v);
              persist({ pageSize: v });
            }}
            options={[
              { value: "a4", label: "A4" },
              { value: "original", label: "Original" },
            ]}
          />
          <View style={{ height: spacing.lg }} />
          <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Orientation</Text>
          <Segmented
            testID="default-orientation"
            value={orientation}
            onChange={(v) => {
              setOrientation(v);
              persist({ orientation: v });
            }}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
              { value: "auto", label: "Auto" },
            ]}
          />
          <View style={{ height: spacing.lg }} />
          <Text style={[styles.fieldLabel, { color: colors.onSurface }]}>Image Quality</Text>
          <Segmented
            testID="default-quality"
            value={quality}
            onChange={(v) => {
              setQuality(v);
              persist({ quality: v });
            }}
            options={[
              { value: "standard", label: "Standard" },
              { value: "high", label: "High" },
              { value: "best", label: "Best" },
            ]}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>ABOUT</Text>
        <View style={[styles.card, styles.listCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <LinkRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={openPrivacy}
            testID="privacy-policy-row"
          />
          <LinkRow icon="person-outline" label="Developer" value="Paul Digital" />
          <LinkRow icon="information-circle-outline" label="Version" value={version} />
        </View>

        <Text style={[styles.footerNote, { color: colors.muted }]}>
          Your images and PDFs are processed entirely on your device. Nothing is uploaded.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  sectionLabel: {
    fontSize: font.sm,
    fontWeight: weight.medium,
    letterSpacing: 0.4,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  listCard: { paddingVertical: 0, paddingHorizontal: spacing.lg },
  fieldLabel: {
    fontSize: font.base,
    fontWeight: weight.medium,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: font.lg },
  rowValue: { fontSize: font.base },
  footerNote: {
    fontSize: font.sm,
    lineHeight: 18,
    marginTop: spacing.xl,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
  },
});
