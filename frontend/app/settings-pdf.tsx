import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/button";
import { Icon, type IconName } from "@/src/components/icon";
import { ScreenHeader } from "@/src/components/header";
import { useToast } from "@/src/components/toast";
import { showInterstitial } from "@/src/ads/ads-module";
import { useAppConfig } from "@/src/config/config-context";
import { useImageSession } from "@/src/session/image-session";
import { useRecentPdfs } from "@/src/pdf/recent-pdfs";
import { getPdfDefaults } from "@/src/pdf/pdf-defaults";
import { defaultPdfName } from "@/src/pdf/file-ops";
import { generatePdf, PdfCancelledError } from "@/src/pdf/generate-pdf";
import type { Orientation, PageSize, Quality } from "@/src/config/defaults";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";
import { pluralize } from "@/src/utils/format";
import { haptics } from "@/src/utils/haptics";

type Opt<T> = { value: T; label: string };

function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: Opt<T>[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[styles.segment, { backgroundColor: colors.surfaceTertiary }]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`${testID}-${o.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptics.light();
              onChange(o.value);
            }}
            style={[
              styles.segmentItem,
              active && { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? colors.onSurface : colors.muted },
                active && { fontWeight: weight.medium },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function PdfSettings() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { config } = useAppConfig();
  const { images } = useImageSession();
  const { add } = useRecentPdfs();

  const [pageSize, setPageSize] = useState<PageSize>(config.defaultPageSize);
  const [orientation, setOrientation] = useState<Orientation>(config.defaultOrientation);
  const [quality, setQuality] = useState<Quality>(config.defaultQuality);
  const [name, setName] = useState(defaultPdfName());

  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

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

  const onCreate = async () => {
    if (creating) return; // prevent duplicate taps
    if (!images.length) {
      toast.show("No images to convert", "error");
      return;
    }
    cancelRef.current = false;
    setProgress(0);
    setCreating(true);
    try {
      const result = await generatePdf({
        images,
        name,
        quality,
        pageSize,
        orientation,
        onProgress: setProgress,
        isCancelled: () => cancelRef.current,
      });
      const record = await add({
        name: result.name,
        uri: result.uri,
        size: result.size,
        pageCount: result.pageCount,
      });
      haptics.success();
      // Opportunistic interstitial at a natural transition. Never blocks.
      if (config.adsEnabled && config.interstitialAdUnitId) {
        void showInterstitial(
          config.interstitialAdUnitId,
          config.interstitialCooldownSec * 1000,
        );
      }
      setCreating(false);
      router.replace({ pathname: "/result", params: { id: record.id } });
    } catch (e) {
      setCreating(false);
      if (e instanceof PdfCancelledError) {
        toast.show("PDF creation cancelled", "info");
      } else {
        toast.show("Couldn't create the PDF. Please try again.", "error");
      }
    }
  };

  const qualityChips: { value: Quality; label: string; icon: IconName }[] = [
    { value: "standard", label: "Standard", icon: "flash-outline" },
    { value: "high", label: "High", icon: "sparkles-outline" },
    { value: "best", label: "Best", icon: "diamond-outline" },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <ScreenHeader
        title="PDF Settings"
        subtitle={pluralize(images.length, "image")}
        showBack
      />

      <KeyboardAwareScrollView
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
      >
        <Text style={[styles.label, { color: colors.onSurface }]}>Page Size</Text>
        <Segmented
          testID="page-size"
          value={pageSize}
          onChange={setPageSize}
          options={[
            { value: "a4", label: "A4" },
            { value: "original", label: "Original" },
          ]}
        />

        <Text style={[styles.label, { color: colors.onSurface }]}>Orientation</Text>
        <Segmented
          testID="orientation"
          value={orientation}
          onChange={setOrientation}
          options={[
            { value: "portrait", label: "Portrait" },
            { value: "landscape", label: "Landscape" },
            { value: "auto", label: "Auto" },
          ]}
        />

        <Text style={[styles.label, { color: colors.onSurface }]}>Image Quality</Text>
        <View style={styles.chips}>
          {qualityChips.map((c) => {
            const active = c.value === quality;
            return (
              <Pressable
                key={c.value}
                testID={`quality-${c.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  haptics.light();
                  setQuality(c.value);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.brandTertiary : colors.surfaceSecondary,
                    borderColor: active ? colors.brandPrimary : colors.border,
                  },
                ]}
              >
                <Icon
                  name={c.icon}
                  size={18}
                  color={active ? colors.brandPrimary : colors.muted}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.onBrandTertiary : colors.onSurfaceTertiary },
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.onSurface }]}>PDF Name</Text>
        <View style={styles.nameRow}>
          <TextInput
            testID="pdf-name-input"
            value={name}
            onChangeText={setName}
            placeholder="File name"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceSecondary,
                color: colors.onSurface,
                borderColor: colors.border,
              },
            ]}
          />
          <Text style={[styles.ext, { color: colors.muted }]}>.pdf</Text>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: colors.surfaceSecondary,
              borderTopColor: colors.divider,
            },
          ]}
        >
          <Button
            label={creating ? "Creating…" : "Create PDF"}
            icon="document-text-outline"
            onPress={onCreate}
            disabled={creating || images.length === 0}
            loading={creating}
            testID="create-pdf-button"
          />
        </View>
      </KeyboardStickyView>

      {creating ? (
        <View style={styles.overlay} testID="generating-overlay">
          <View style={[styles.progressCard, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.progressTitle, { color: colors.onSurface }]}>
              Creating PDF…
            </Text>
            <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.brandPrimary },
                ]}
              />
            </View>
            <Text style={[styles.percent, { color: colors.muted }]}>
              {Math.round(progress * 100)}%
            </Text>
            <View style={{ height: spacing.lg }} />
            <Button
              label="Cancel"
              variant="tertiary"
              onPress={() => {
                cancelRef.current = true;
              }}
              testID="cancel-generation-button"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  label: {
    fontSize: font.base,
    fontWeight: weight.medium,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  segment: {
    flexDirection: "row",
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    height: 42,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: { fontSize: font.base },
  chips: { flexDirection: "row", gap: spacing.md },
  chip: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  chipText: { fontSize: font.base, fontWeight: weight.medium },
  nameRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    fontSize: font.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ext: {
    fontSize: font.lg,
    marginLeft: spacing.sm,
    fontWeight: weight.medium,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    zIndex: 50,
    elevation: 50,
  },
  progressCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },
  progressTitle: {
    fontSize: font.lg,
    fontWeight: weight.medium,
    marginBottom: spacing.lg,
  },
  track: {
    width: "100%",
    height: 8,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: radius.pill },
  percent: { fontSize: font.base, marginTop: spacing.sm },
});
