import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

// Guarded haptics — no-ops on web and never throws.
function safe(fn: () => Promise<unknown> | void) {
  if (Platform.OS === "web") return;
  try {
    void fn();
  } catch {
    // ignore
  }
}

export const haptics = {
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () =>
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
