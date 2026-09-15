// Safe, offline-first defaults for the remotely-controlled configuration.
// These values guarantee the app is fully functional even when the Cloudflare
// Worker (remote config) is unreachable or returns invalid data.
//
// NOTE: The AdMob *App ID* is NOT here — it is native-only and lives in app.json.
// Only the Banner / Interstitial *Ad Unit IDs* are remotely controllable.

export type Quality = "standard" | "high" | "best";
export type PageSize = "a4" | "original";
export type Orientation = "portrait" | "landscape" | "auto";

export type AppConfig = {
  configVersion: number;
  adsEnabled: boolean;
  bannerAdUnitId: string;
  interstitialAdUnitId: string;
  appName: string;
  privacyPolicyUrl: string;
  defaultQuality: Quality;
  defaultPageSize: PageSize;
  defaultOrientation: Orientation;
  maxImageCount: number;
  interstitialCooldownSec: number;
};

export const DEFAULT_CONFIG: AppConfig = {
  configVersion: 1,
  adsEnabled: true,
  bannerAdUnitId: "ca-app-pub-5048291410050597/6939420157",
  interstitialAdUnitId: "ca-app-pub-5048291410050597/1687093471",
  appName: "Image to PDF",
  privacyPolicyUrl: "https://imagetopdf-9n5.pages.dev/privacy",
  defaultQuality: "high",
  defaultPageSize: "a4",
  defaultOrientation: "auto",
  maxImageCount: 50,
  interstitialCooldownSec: 60,
};

const AD_UNIT_RE = /^ca-app-pub-\d{10,}\/\d{6,}$/;

function isHttpsUrl(v: unknown): v is string {
  return typeof v === "string" && /^https:\/\/.+/i.test(v);
}

// Validate & merge an untrusted remote payload over the current known-good
// config. Any invalid field is ignored (falls back to the previous value).
export function mergeValidConfig(
  base: AppConfig,
  raw: unknown,
): AppConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const next: AppConfig = { ...base };

  if (typeof r.configVersion === "number") next.configVersion = r.configVersion;
  if (typeof r.adsEnabled === "boolean") next.adsEnabled = r.adsEnabled;
  if (typeof r.bannerAdUnitId === "string" && AD_UNIT_RE.test(r.bannerAdUnitId))
    next.bannerAdUnitId = r.bannerAdUnitId;
  if (
    typeof r.interstitialAdUnitId === "string" &&
    AD_UNIT_RE.test(r.interstitialAdUnitId)
  )
    next.interstitialAdUnitId = r.interstitialAdUnitId;
  if (typeof r.appName === "string" && r.appName.trim().length > 0)
    next.appName = r.appName.trim().slice(0, 60);
  if (isHttpsUrl(r.privacyPolicyUrl)) next.privacyPolicyUrl = r.privacyPolicyUrl;
  if (r.defaultQuality === "standard" || r.defaultQuality === "high" || r.defaultQuality === "best")
    next.defaultQuality = r.defaultQuality;
  if (r.defaultPageSize === "a4" || r.defaultPageSize === "original")
    next.defaultPageSize = r.defaultPageSize;
  if (
    r.defaultOrientation === "portrait" ||
    r.defaultOrientation === "landscape" ||
    r.defaultOrientation === "auto"
  )
    next.defaultOrientation = r.defaultOrientation;
  if (typeof r.maxImageCount === "number" && r.maxImageCount > 0 && r.maxImageCount <= 500)
    next.maxImageCount = Math.floor(r.maxImageCount);
  if (
    typeof r.interstitialCooldownSec === "number" &&
    r.interstitialCooldownSec >= 0 &&
    r.interstitialCooldownSec <= 3600
  )
    next.interstitialCooldownSec = Math.floor(r.interstitialCooldownSec);

  return next;
}
