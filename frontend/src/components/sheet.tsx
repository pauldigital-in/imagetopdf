import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";

// A bottom sheet rendered as an in-tree absolute overlay (NOT a native Modal),
// so react-native-keyboard-controller can move it above the keyboard when it
// contains a TextInput. No Alert is ever used in this app.
export function AppSheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={styles.root} testID={testID}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        testID="sheet-backdrop"
        accessibilityLabel="Close"
      />
      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surfaceSecondary,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {title ? (
            <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
          ) : null}
          {children}
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 100,
    elevation: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: radius.pill,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: font.xl,
    fontWeight: weight.medium,
    marginBottom: spacing.lg,
  },
});
