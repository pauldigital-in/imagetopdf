// No-op ads implementation used on web and as the safe fallback.
// The real native implementation lives in ads-module.native.tsx.
import type { ReactElement } from "react";

export function AdsBanner(_: { unitId?: string; enabled?: boolean }): ReactElement | null {
  return null;
}

export function initMobileAds(): void {}

export function prepareInterstitial(_: string): void {}

export async function showInterstitial(_: string, __?: number): Promise<boolean> {
  return false;
}
