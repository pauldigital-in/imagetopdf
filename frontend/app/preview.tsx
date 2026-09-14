import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/button";
import { useImageSession } from "@/src/session/image-session";
import { spacing, font, weight } from "@/src/tokens";

export default function Preview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { images } = useImageSession();
  const image = images.find((i) => i.id === id);

  return (
    <View style={styles.screen}>
      <View style={{ flex: 1, justifyContent: "center" }}>
        {image ? (
          <Image
            source={{ uri: image.uri }}
            style={styles.img}
            contentFit="contain"
            testID="preview-full-image"
          />
        ) : (
          <Text style={styles.missing}>Image not available</Text>
        )}
      </View>
      <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Button
          label="Close"
          variant="secondary"
          onPress={() => router.back()}
          testID="preview-close-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000000" },
  img: { width: "100%", height: "100%" },
  missing: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: font.lg,
    fontWeight: weight.regular,
  },
});
