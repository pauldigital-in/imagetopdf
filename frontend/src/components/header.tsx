import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "@/src/theme";
import { spacing, font, weight } from "@/src/tokens";
import { haptics } from "@/src/utils/haptics";
import { Icon } from "./icon";

// Sticky, safe-area-aware screen header (solid, iOS-native clean).
export function ScreenHeader({
  title,
  showBack = false,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: colors.surface,
          borderBottomColor: colors.divider,
        },
      ]}
    >
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            testID="header-back-button"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => {
              haptics.light();
              if (onBack) onBack();
              else router.back();
            }}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
          >
            <Icon name="chevron-back" size={26} color={colors.brandPrimary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.center}>
        <Text
          style={[styles.title, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    minWidth: 44,
    justifyContent: "center",
  },
  right: {
    alignItems: "flex-end",
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    fontSize: font.lg,
    fontWeight: weight.medium,
  },
  subtitle: {
    fontSize: font.sm,
    marginTop: 2,
  },
});
