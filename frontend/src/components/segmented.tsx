import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/theme";
import { radius, font, weight } from "@/src/tokens";
import { haptics } from "@/src/utils/haptics";

export type SegmentedOption<T extends string> = { value: T; label: string };

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  testID,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.segment, { backgroundColor: colors.surfaceTertiary }]}>
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
            style={[styles.item, active && { backgroundColor: colors.surfaceSecondary }]}
          >
            <Text
              style={[
                styles.text,
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

const styles = StyleSheet.create({
  segment: { flexDirection: "row", borderRadius: radius.md, padding: 3, gap: 3 },
  item: { flex: 1, height: 42, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  text: { fontSize: font.base },
});
