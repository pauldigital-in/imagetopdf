import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/theme";
import { radius, spacing, font, weight } from "@/src/tokens";
import { Icon, type IconName } from "./icon";

type ToastType = "success" | "error" | "info";

type ToastContextValue = {
  show: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, t: ToastType = "info") => {
      setMessage(msg);
      setType(t);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start();
      }, 2600);
    },
    [opacity],
  );

  const iconFor: Record<ToastType, IconName> = {
    success: "checkmark-circle",
    error: "alert-circle",
    info: "information-circle",
  };
  const colorFor: Record<ToastType, string> = {
    success: colors.success,
    error: colors.error,
    info: colors.brandPrimary,
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wrap,
          { bottom: insets.bottom + spacing.xxl, opacity },
        ]}
      >
        {message ? (
          <View
            testID="app-toast"
            style={[styles.toast, { backgroundColor: colors.surfaceInverse }]}
          >
            <Icon name={iconFor[type]} size={20} color={colorFor[type]} />
            <Text
              style={[styles.text, { color: colors.onSurfaceInverse }]}
              numberOfLines={2}
            >
              {message}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    maxWidth: 480,
  },
  text: {
    flexShrink: 1,
    fontSize: font.base,
    fontWeight: weight.medium,
  },
});
