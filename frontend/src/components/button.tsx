import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";
import { haptics } from "@/src/utils/haptics";
import { Icon, type IconName } from "./icon";

type Variant = "primary" | "secondary" | "tertiary" | "danger" | "ghost";
type Size = "lg" | "md";

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  icon,
  disabled,
  loading,
  fullWidth = true,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();

  const bg: Record<Variant, string> = {
    primary: colors.brandPrimary,
    secondary: colors.brandTertiary,
    tertiary: colors.surfaceTertiary,
    danger: colors.error,
    ghost: "transparent",
  };
  const fg: Record<Variant, string> = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandTertiary,
    tertiary: colors.onSurfaceTertiary,
    danger: colors.onError,
    ghost: colors.brandPrimary,
  };

  const isDisabled = disabled || loading;
  const height = size === "lg" ? 54 : 44;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          backgroundColor: bg[variant],
          borderRadius: radius.md,
          opacity: isDisabled ? 0.45 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: fullWidth ? spacing.lg : spacing.xl,
        },
        variant === "ghost" && { borderWidth: 0 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={20} color={fg[variant]} /> : null}
          <Text
            style={[
              styles.label,
              { color: fg[variant], fontSize: size === "lg" ? font.lg : font.base },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontWeight: weight.medium,
  },
});
