import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { ToastProvider } from "@/src/components/toast";
import { ConfigProvider } from "@/src/config/config-context";
import { ImageSessionProvider } from "@/src/session/image-session";
import { RecentPdfsProvider } from "@/src/pdf/recent-pdfs";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";
import { initMobileAds } from "@/src/ads/ads-module";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Ionicons: require("@react-native-vector-icons/ionicons/fonts/Ionicons.ttf"),
  });

  useEffect(() => {
    // Safe no-op unless running in a native build with the AdMob module present.
    initMobileAds();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ConfigProvider>
              <RecentPdfsProvider>
                <ImageSessionProvider>
                  <ToastProvider>
                    <StatusBar style="dark" />
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.surface },
                        animation: "slide_from_right",
                      }}
                    >
                      <Stack.Screen
                        name="editor"
                        options={{ animation: "slide_from_bottom" }}
                      />
                      <Stack.Screen
                        name="preview"
                        options={{ presentation: "modal", animation: "slide_from_bottom" }}
                      />
                    </Stack>
                  </ToastProvider>
                </ImageSessionProvider>
              </RecentPdfsProvider>
            </ConfigProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
