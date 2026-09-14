// Real AdMob implementation (Android/iOS native builds only).
// Guarded so it NEVER crashes in Expo Go / web preview: the native module is
// loaded lazily via require() and every failure is absorbed. Ads must never
// block or break the core Image -> PDF flow.
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { isRunningInExpoGo } from "expo";

let ads: any = null;
let checked = false;
let initialized = false;

function getAds(): any {
  if (checked) return ads;
  if (Platform.OS === "web" || isRunningInExpoGo()) {
    checked = true;
    return null;
  }
  checked = true;
  try {
    // Bundled by Metro but only present in a native (dev/prod) build.
    ads = require("react-native-google-mobile-ads");
  } catch {
    ads = null;
  }
  return ads;
}

export function initMobileAds(): void {
  const native = getAds();
  if (!native || initialized) return;
  initialized = true;
  try {
    native.default?.().initialize?.();
  } catch {
    // ignore
  }
}

export function AdsBanner({
  unitId,
  enabled = true,
}: {
  unitId?: string;
  enabled?: boolean;
}) {
  const [native, setNative] = useState<any>(null);

  useEffect(() => {
    if (enabled && unitId) setNative(getAds());
  }, [enabled, unitId]);

  if (!enabled || !unitId || !native?.BannerAd || !native?.BannerAdSize) {
    return null;
  }

  return (
    <View accessible accessibilityLabel="Advertisement" testID="home-banner-ad">
      <native.BannerAd
        unitId={unitId}
        size={native.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={() => {}}
      />
    </View>
  );
}

let interstitial: any = null;
let unsubscribe: (() => void) | undefined;
let lastShownAt = 0;
let loading = false;

export function prepareInterstitial(unitId: string): void {
  const native = getAds();
  if (!native?.InterstitialAd || !unitId || loading || interstitial) return;
  loading = true;
  try {
    const ad = native.InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    unsubscribe?.();
    const offLoaded = ad.addAdEventListener(native.AdEventType.LOADED, () => {
      loading = false;
    });
    const offError = ad.addAdEventListener(native.AdEventType.ERROR, () => {
      loading = false;
      interstitial = null;
    });
    const offClosed = ad.addAdEventListener(native.AdEventType.CLOSED, () => {
      interstitial = null;
    });
    unsubscribe = () => {
      offLoaded?.();
      offError?.();
      offClosed?.();
    };
    interstitial = ad;
    ad.load();
  } catch {
    loading = false;
    interstitial = null;
  }
}

// Opportunistic show: never waits for a load. Returns whether an ad was shown.
export async function showInterstitial(
  unitId: string,
  cooldownMs = 60_000,
): Promise<boolean> {
  const native = getAds();
  if (!native || !unitId) return false;
  if (Date.now() - lastShownAt < cooldownMs) return false;

  const ad = interstitial;
  if (!ad || !ad.loaded) {
    prepareInterstitial(unitId);
    return false;
  }

  try {
    await ad.show();
    lastShownAt = Date.now();
    interstitial = null;
    prepareInterstitial(unitId); // preload the next one
    return true;
  } catch {
    interstitial = null;
    prepareInterstitial(unitId);
    return false;
  }
}
