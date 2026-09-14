# PRD — Image to PDF (Paul Digital)

## Original Problem Statement
Production-ready Android "Image to PDF" converter. Simple, lightweight, fast, private,
user-friendly. Flow: Select Images → Arrange → Optional Edit → PDF Settings → Create PDF →
Result. Fully offline, on-device processing, no login, minimal permissions. Google AdMob
(real IDs) with remote on/off + remotely swappable Banner/Interstitial IDs via a Cloudflare
Worker + secure server-authenticated Admin Panel. Privacy policy hosted on Cloudflare. No
admin secrets in the app/APK/GitHub. Package name professional for Paul Digital.

## Key Decisions / Architecture
- **Platform reality:** Emergent builds an **Expo (React Native) Android app**; it cannot host
  Cloudflare. User chose "Cloudflare only" for backend → the app talks directly to a
  **Cloudflare Worker** for remote config, with safe local defaults so it never depends on the
  network. Complete Worker + Admin Panel + Privacy Policy source delivered under `deliverables/`.
- **App name:** "Image to PDF". **Package/bundle:** `com.pauldigital.imagetopdf`.
- **On-device PDF:** `pdf-lib` (UMD dist build to avoid Metro/tslib interop) + `expo-image-manipulator`
  (resize/compress/crop/rotate) + `expo-file-system/legacy` (write/size) + `expo-sharing` /
  `expo-intent-launcher` (share/open on Android).
- **AdMob:** `react-native-google-mobile-ads` via config plugin (native App ID). Wrapper is guarded
  (`ads-module.tsx` no-op / `ads-module.native.tsx` real) so Expo Go/web never crash. Banner on Home
  bottom only; interstitial only after successful PDF creation with cooldown; never blocks core flow.
- **Remote config:** `EXPO_PUBLIC_CONFIG_URL` → Worker `/config`. Validated + merged over defaults,
  cached (last-known-good), 6h refresh, 5s timeout, offline fallback. `configVersion` supported.
- **Admin security:** PBKDF2 password verify + HMAC signed expiring tokens, per-IP login rate limit,
  server-side validation. Secrets are Cloudflare Worker secrets (never in app/repo).
- **Design:** iOS-native clean, Moss Green (#4A7B59) accent, light theme, Ionicons via
  `@react-native-vector-icons/ionicons`, tokens in `src/theme.ts` + `src/tokens.ts`.

## User Personas
- Everyday Android user scanning receipts/notes/photos into a shareable PDF, fast, no signup.
- Publisher (Paul Digital) adjusting ads/config remotely without shipping a new build.

## Core Requirements (static)
Offline image→PDF; multi-select + camera; reorder (drag), delete, add, preview, crop/rotate/flip;
PDF settings (A4/Original, Portrait/Landscape/Auto, Standard/High/Best, custom name); progress +
cancel + duplicate-tap guard; result (open/share/rename/delete); recent PDFs (persisted, missing-file
safe); settings/about + privacy link; remote ad control; secure admin; Play-policy compliant.

## Implemented (2026-06)
- [x] Home (Select Images, Take Photo, Recent PDFs + empty state, settings, banner area)
- [x] Selected Images: drag-reorder, order badges, add/delete, preview, edit entry
- [x] Image Editor: crop (draggable box), rotate L/R, flip H/V, reset, done
- [x] PDF Settings: segmented controls + quality chips + filename + Create, progress overlay + cancel
- [x] PDF generation on-device (pdf-lib), quality-based resize/compress, A4/Original + orientation
- [x] Result: success, filename/size/pages, open/share/rename/delete, return home, back→home
- [x] Recent PDFs store (AsyncStorage), rename/delete/open/share, missing-file handling
- [x] Settings/About with persisted default PDF settings + privacy policy link + version
- [x] Remote config client with safe defaults, caching, timeout, validation
- [x] AdMob wrapper (guarded), native App ID in app.json, banner Home-only, interstitial post-create + cooldown
- [x] Camera permission contract (pre-permission sheet, denial → Open Settings)
- [x] Deliverables: Cloudflare Worker, Admin Panel, Privacy Policy, README, password-hash script
- [x] Frontend smoke tested (all web-testable flows pass)

## Native-build-only (validate on device/emulator, NOT Expo Go/web)
- AdMob banner/interstitial, gallery/camera capture, PDF file write, Open/Share via Android intents.

## Backlog / Next
- P1: Reorder as 2-col grid (currently reliable single-column list).
- P2: Multi-image single-page layouts / margins presets; PDF page reordering after creation.
- P2: Optional passcode lock for Recent PDFs.
- Ops: user deploys Worker + Pages, sets EXPO_PUBLIC_CONFIG_URL, generates Android build via Publish.
