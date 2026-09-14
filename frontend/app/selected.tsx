import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

import { Button } from "@/src/components/button";
import { Icon } from "@/src/components/icon";
import { ScreenHeader } from "@/src/components/header";
import { useToast } from "@/src/components/toast";
import { useAppConfig } from "@/src/config/config-context";
import { useImageSession, type SessionImage } from "@/src/session/image-session";
import { pickFromGallery } from "@/src/media/pick";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";
import { haptics } from "@/src/utils/haptics";

export default function SelectedImages() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { config } = useAppConfig();
  const { images, add, remove, reorder } = useImageSession();

  const [busy, setBusy] = useState(false);

  const onAddMore = useCallback(async () => {
    const remaining = config.maxImageCount - images.length;
    if (remaining <= 0) {
      toast.show(`Limit is ${config.maxImageCount} images`, "info");
      return;
    }
    setBusy(true);
    try {
      const imgs = await pickFromGallery(remaining);
      if (imgs.length) add(imgs.slice(0, remaining));
    } catch {
      toast.show("Couldn't open the gallery", "error");
    } finally {
      setBusy(false);
    }
  }, [config.maxImageCount, images.length, add, toast]);

  const onDelete = useCallback(
    (id: string) => {
      haptics.warning();
      remove(id);
    },
    [remove],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<SessionImage>) => {
      const index = getIndex() ?? 0;
      return (
        <ScaleDecorator activeScale={1.03}>
          <View
            style={[
              styles.row,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: isActive ? colors.brandPrimary : colors.border,
              },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
              <Text style={[styles.badgeText, { color: colors.onBrandPrimary }]}>
                {index + 1}
              </Text>
            </View>

            <Pressable
              testID={`preview-image-${item.id}`}
              accessibilityLabel={`Preview page ${index + 1}`}
              onPress={() => router.push({ pathname: "/preview", params: { id: item.id } })}
              style={styles.thumbWrap}
            >
              <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={[styles.pageLabel, { color: colors.onSurface }]}>
                Page {index + 1}
              </Text>
              <Text style={[styles.tapHint, { color: colors.muted }]}>
                Tap image to preview
              </Text>
            </View>

            <Pressable
              testID={`edit-image-${item.id}`}
              accessibilityLabel={`Edit page ${index + 1}`}
              hitSlop={8}
              onPress={() => router.push({ pathname: "/editor", params: { id: item.id } })}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
            >
              <Icon name="crop-outline" size={22} color={colors.onSurfaceTertiary} />
            </Pressable>

            <Pressable
              testID={`delete-image-${item.id}`}
              accessibilityLabel={`Delete page ${index + 1}`}
              hitSlop={8}
              onPress={() => onDelete(item.id)}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
            >
              <Icon name="trash-outline" size={22} color={colors.error} />
            </Pressable>

            <Pressable
              testID={`drag-image-${item.id}`}
              accessibilityLabel={`Reorder page ${index + 1}`}
              onLongPress={() => {
                haptics.medium();
                drag();
              }}
              delayLongPress={150}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.5 }]}
            >
              <Icon name="reorder-three-outline" size={24} color={colors.muted} />
            </Pressable>
          </View>
        </ScaleDecorator>
      );
    },
    [colors, router, onDelete],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <ScreenHeader
        title="Arrange Images"
        subtitle={images.length ? `${images.length} selected · drag to reorder` : undefined}
        showBack
      />

      {images.length === 0 ? (
        <View style={styles.empty} testID="selected-empty">
          <Icon name="images-outline" size={56} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
            No images selected
          </Text>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Go back and pick images to convert.
          </Text>
          <View style={{ height: spacing.xl }} />
          <Button
            label="Go Back"
            variant="secondary"
            onPress={() => router.back()}
            fullWidth={false}
            testID="empty-go-back"
          />
        </View>
      ) : (
        <DraggableFlatList
          data={images}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          onDragEnd={({ data }) => reorder(data)}
          onDragBegin={() => haptics.medium()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: spacing.xl,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          containerStyle={{ flex: 1 }}
        />
      )}

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.surfaceSecondary,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Button
            label="Add More"
            icon="add"
            variant="secondary"
            loading={busy}
            onPress={onAddMore}
            testID="add-more-button"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Next"
            icon="arrow-forward"
            disabled={images.length === 0}
            onPress={() => router.push("/settings-pdf")}
            testID="next-button"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: font.sm,
    fontWeight: weight.medium,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  pageLabel: {
    fontSize: font.base,
    fontWeight: weight.medium,
  },
  tapHint: {
    fontSize: font.sm,
    marginTop: 2,
  },
  iconBtn: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: font.xl,
    fontWeight: weight.medium,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: font.base,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  bottomBar: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
