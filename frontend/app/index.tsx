import { useCallback, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/button";
import { Icon } from "@/src/components/icon";
import { AppSheet } from "@/src/components/sheet";
import { PdfActionsSheet } from "@/src/components/pdf-actions";
import { useToast } from "@/src/components/toast";
import { AdsBanner } from "@/src/ads/ads-module";
import { useAppConfig } from "@/src/config/config-context";
import { useImageSession } from "@/src/session/image-session";
import { useRecentPdfs, type PdfRecord } from "@/src/pdf/recent-pdfs";
import {
  captureFromCamera,
  getCameraPermission,
  pickFromGallery,
  requestCameraPermission,
  type PickedImage,
} from "@/src/media/pick";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";
import { formatBytes, formatDate, pluralize } from "@/src/utils/format";
import { haptics } from "@/src/utils/haptics";

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1449247709967-d4461a6a6103?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2MzR8MHwxfHNlYXJjaHwxfHxjbGVhbiUyMG1pbmltYWxpc3QlMjBlbXB0eSUyMHRyYXklMjBvciUyMGRlc2t8ZW58MHx8fHwxNzg5Mzc0NjQyfDA&ixlib=rb-4.1.0&q=85";

export default function Home() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { config } = useAppConfig();
  const { clear, add } = useImageSession();
  const { pdfs, refresh } = useRecentPdfs();

  const [selected, setSelected] = useState<PdfRecord | null>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [camSheet, setCamSheet] = useState<null | "explain" | "blocked">(null);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const startSession = useCallback(
    (imgs: PickedImage[]) => {
      if (!imgs.length) return;
      clear();
      add(imgs);
      router.push("/selected");
    },
    [clear, add, router],
  );

  const onSelectImages = useCallback(async () => {
    try {
      const imgs = await pickFromGallery(config.maxImageCount);
      if (imgs.length > config.maxImageCount) {
        toast.show(`You can add up to ${config.maxImageCount} images`, "info");
      }
      startSession(imgs.slice(0, config.maxImageCount));
    } catch {
      toast.show("Couldn't open the gallery", "error");
    }
  }, [config.maxImageCount, startSession, toast]);

  const doCapture = useCallback(async () => {
    try {
      const shot = await captureFromCamera();
      if (shot) startSession([shot]);
    } catch {
      toast.show("Camera isn't available", "error");
    }
  }, [startSession, toast]);

  const onTakePhoto = useCallback(async () => {
    const perm = await getCameraPermission();
    if (perm.granted) {
      void doCapture();
      return;
    }
    if (perm.canAskAgain) {
      setCamSheet("explain");
    } else {
      setCamSheet("blocked");
    }
  }, [doCapture]);

  const requestThenCapture = useCallback(async () => {
    setCamSheet(null);
    const res = await requestCameraPermission();
    if (res.granted) void doCapture();
    else if (!res.canAskAgain) setCamSheet("blocked");
    else toast.show("Camera permission is needed to take photos", "info");
  }, [doCapture, toast]);

  const renderHeader = () => (
    <View>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.appName, { color: colors.onSurface }]}>
            {config.appName || "Image to PDF"}
          </Text>
          <Text style={[styles.tagline, { color: colors.muted }]}>
            Convert Images to PDF
          </Text>
        </View>
        <Pressable
          testID="settings-button"
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={12}
          onPress={() => {
            haptics.light();
            router.push("/settings");
          }}
          style={({ pressed }) => [
            styles.gear,
            { backgroundColor: colors.surfaceSecondary },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Icon name="settings-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Button
          label="Select Images"
          icon="images-outline"
          onPress={onSelectImages}
          testID="select-images-button"
        />
        <Button
          label="Take Photo"
          icon="camera-outline"
          variant="secondary"
          onPress={onTakePhoto}
          testID="take-photo-button"
        />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
        Recent PDFs
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty} testID="recent-empty">
      <View style={[styles.emptyImgWrap, { borderColor: colors.border }]}>
        <Image
          source={{ uri: EMPTY_IMG }}
          style={styles.emptyImg}
          contentFit="cover"
          transition={200}
        />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
        No PDFs yet
      </Text>
      <Text style={[styles.emptyText, { color: colors.muted }]}>
        Select images or take a photo to create your first PDF.
      </Text>
    </View>
  );

  const renderItem = ({ item }: { item: PdfRecord }) => (
    <Pressable
      testID={`recent-pdf-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`PDF ${item.name}`}
      onPress={() => {
        haptics.light();
        setSelected(item);
        setActionsVisible(true);
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
        pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 },
      ]}
    >
      <View style={[styles.docIcon, { backgroundColor: colors.brandTertiary }]}>
        <Icon
          name={item.missing ? "alert-circle" : "document-text"}
          size={24}
          color={item.missing ? colors.warning : colors.brandPrimary}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardName, { color: colors.onSurface }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.muted }]} numberOfLines={1}>
          {item.missing
            ? "File missing"
            : `${formatDate(item.createdAt)}  ·  ${formatBytes(item.size)}  ·  ${pluralize(
                item.pageCount,
                "page",
              )}`}
        </Text>
      </View>
      <Icon name="ellipsis-horizontal" size={22} color={colors.muted} />
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <FlatList
        data={pdfs}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />

      {config.adsEnabled ? (
        <View
          style={[
            styles.bannerWrap,
            {
              paddingBottom: insets.bottom,
              backgroundColor: colors.surface,
              borderTopColor: colors.divider,
            },
          ]}
        >
          <AdsBanner unitId={config.bannerAdUnitId} enabled={config.adsEnabled} />
        </View>
      ) : null}

      <PdfActionsSheet
        visible={actionsVisible}
        record={selected}
        onClose={() => setActionsVisible(false)}
      />

      <AppSheet
        visible={camSheet !== null}
        onClose={() => setCamSheet(null)}
        title={camSheet === "blocked" ? "Camera access needed" : "Use the camera?"}
        testID="camera-permission-sheet"
      >
        <Text style={[styles.permText, { color: colors.onSurfaceSecondary }]}>
          {camSheet === "blocked"
            ? "Camera access is turned off. Enable it in Settings to take photos for your PDF."
            : "We use the camera only to capture pages you add to your PDF. Images stay on your device."}
        </Text>
        <View style={{ height: spacing.lg }} />
        {camSheet === "blocked" ? (
          <Button
            label="Open Settings"
            icon="settings-outline"
            onPress={() => {
              setCamSheet(null);
              void Linking.openSettings();
            }}
            testID="open-settings-button"
          />
        ) : (
          <Button
            label="Continue"
            onPress={requestThenCapture}
            testID="camera-continue-button"
          />
        )}
        <View style={{ height: spacing.md }} />
        <Button
          label="Not now"
          variant="tertiary"
          onPress={() => setCamSheet(null)}
          testID="camera-cancel-button"
        />
      </AppSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  appName: {
    fontSize: font.display,
    fontWeight: weight.medium,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: font.base,
    marginTop: 2,
  },
  gear: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: weight.medium,
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  docIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: {
    fontSize: font.lg,
    fontWeight: weight.medium,
  },
  cardMeta: {
    fontSize: font.sm,
    marginTop: 3,
  },
  empty: {
    alignItems: "center",
    paddingTop: spacing.xl,
  },
  emptyImgWrap: {
    width: 160,
    height: 160,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.xl,
  },
  emptyImg: { width: "100%", height: "100%" },
  emptyTitle: {
    fontSize: font.xl,
    fontWeight: weight.medium,
  },
  emptyText: {
    fontSize: font.base,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 260,
    lineHeight: 20,
  },
  bannerWrap: {
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 0,
  },
  permText: {
    fontSize: font.base,
    lineHeight: 21,
  },
});
