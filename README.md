# Image to PDF — Paul Digital

A fast, private, offline-first **Image → PDF** converter for Android, plus a remotely
controllable ad/config system and a secure admin panel.

- **Android app** (Expo / React Native) — `frontend/`
- **Cloudflare Worker** (remote config + secure admin API) — `deliverables/cloudflare-worker/`
- **Admin Panel** (static site for Cloudflare Pages) — `deliverables/admin-panel/`
- **Privacy Policy** page (static site for Cloudflare Pages) — `deliverables/privacy-policy/`

> **Core promise:** *Select your photos and create a PDF quickly.* All image processing and
> PDF creation happen **on-device**. No images are ever uploaded. The app works fully offline;
> Cloudflare is used only for lightweight, non-personal ad/config values.

---

## 0. Key facts

| Item | Value |
|---|---|
| App name (visible) | **Image to PDF** |
| Developer | **Paul Digital** |
| Android package / iOS bundle | **`com.pauldigital.imagetopdf`** |
| AdMob **App ID** (native, in `app.json`) | `ca-app-pub-5048291410050597~8128736566` |
| Banner Ad Unit ID (remote) | `ca-app-pub-5048291410050597/6939420157` |
| Interstitial Ad Unit ID (remote) | `ca-app-pub-5048291410050597/1687093471` |

The AdMob **App ID** is compiled natively (it cannot be remote). The **Banner** and
**Interstitial Ad Unit IDs**, ads on/off, app name, privacy URL and basic defaults are all
**remotely configurable** through the admin panel — no new APK/AAB release needed to change them.

---

## 1. Architecture

```
Android App  ──GET /config──►  Cloudflare Worker  ──►  KV ("app_config")
   (cached, offline-safe)

Admin Panel  ──POST /admin/login──►  Cloudflare Worker  (PBKDF2 verify, signed token)
             ──PUT  /admin/config─►  Cloudflare Worker  ──►  KV
                 (Bearer token)
```

- The app caches the last-known-good config locally and refreshes at most every 6 hours.
- If Cloudflare is unreachable / slow / returns invalid data, the app keeps working with safe
  defaults (`frontend/src/config/defaults.ts`). **PDF creation never depends on the network.**

---

## 2. Deploy the Cloudflare Worker (remote config + admin API)

```bash
cd deliverables/cloudflare-worker
npm i -g wrangler            # or use: npx wrangler ...
wrangler login

# 1) Create the KV namespace and paste its id into wrangler.toml
wrangler kv namespace create CONFIG_KV

# 2) Generate an admin password hash (keeps your password out of code/GitHub)
node scripts/hash-password.mjs "YourStrongAdminPassword"

# 3) Set secrets (stored in Cloudflare, never in the repo)
wrangler secret put ADMIN_EMAIL            # e.g. paul@pauldigital.com
wrangler secret put ADMIN_PASSWORD_HASH    # from step 2
wrangler secret put ADMIN_PASSWORD_SALT    # from step 2
wrangler secret put ADMIN_SESSION_SECRET   # from step 2 (or your own long random string)

# 4) (recommended) lock admin CORS: edit [vars] ADMIN_ORIGIN in wrangler.toml

# 5) Deploy
wrangler deploy
```

Your Worker URL will look like `https://image-to-pdf-config.<subdomain>.workers.dev`.

**Endpoints**
- `GET  /config` — public, read-only app config (`{ "config": { ... } }`)
- `POST /admin/login` — `{ email, password }` → `{ token }`
- `GET  /admin/config` — Bearer token → current config
- `PUT  /admin/config` — Bearer token → validated update (auto-increments `configVersion`)

---

## 3. Deploy the Admin Panel (Cloudflare Pages)

Static site (`index.html`, `app.js`, `styles.css`).

- **Dashboard → Workers & Pages → Create → Pages → Connect to Git**, choose this repo,
  set the **build output directory** to `deliverables/admin-panel` (no build command), deploy.
- Or drag-and-drop the folder in **Pages → Upload assets**.

On first load, enter your **API Base URL** (the Worker URL) and log in. Edit values and press
**Save Changes** (a confirmation appears). Then set `ADMIN_ORIGIN` in the Worker to your Pages
URL and redeploy to lock down CORS.

---

## 4. Deploy the Privacy Policy (Cloudflare Pages)

Deploy `deliverables/privacy-policy/` the same way (output dir = that folder). You'll get a
public URL like `https://image-to-pdf.pages.dev/`. Set it as your Privacy Policy URL in the
admin panel so the app links to it.

---

## 5. Connect the Android app to the Cloudflare API

The app reads the config URL from a public (non-secret) env var:

```
# frontend/.env
EXPO_PUBLIC_CONFIG_URL="https://image-to-pdf-config.<subdomain>.workers.dev/config"
```

If empty, the app uses its built-in safe defaults (still fully functional). Rebuild/restart
after changing it.

---

## 6. Build & release the Android app

Built and released through **Emergent's Publish button** (top-right):

1. Click **Publish** to deploy.
2. Generate the **Android build** (APK/AAB) from the deployment panel with the requested
   credentials. AdMob ads + Android share/open only work in a real build, **not** in Expo Go /
   web preview.
3. Publish the AAB to Google Play.

> Don't create/edit `eas.json` — build config is platform-managed. The AdMob App ID is wired via
> the `react-native-google-mobile-ads` config plugin in `frontend/app.json`.

---

## 7. How to change things remotely (no app release)

Open the **Admin Panel**, log in, then:

- **Ads ON/OFF** → toggle *Ads Enabled* → **Save**.
- **Banner Ad Unit ID** → edit → **Save**.
- **Interstitial Ad Unit ID** → edit → **Save**.
- **Privacy Policy URL** → edit → **Save**.
- Also: app name, default quality/page size/orientation, interstitial cooldown, max image count.

Devices apply changes on their next config refresh (~6h, or next cold start after cache expiry).
Each save increments `configVersion`. Invalid values are rejected server-side and ignored
client-side (last-known-good is kept).

---

## 8. Environment variables & secrets — where each goes

| Name | Where | Secret? | Purpose |
|---|---|---|---|
| `EXPO_PUBLIC_CONFIG_URL` | `frontend/.env` | No | App → Worker `/config` URL |
| `ADMIN_EMAIL` | Worker secret | Yes | Admin login email |
| `ADMIN_PASSWORD_HASH` | Worker secret | Yes | PBKDF2 hash of admin password |
| `ADMIN_PASSWORD_SALT` | Worker secret | Yes | Salt for the hash |
| `ADMIN_SESSION_SECRET` | Worker secret | Yes | Signs admin session tokens |
| `ADMIN_ORIGIN` | `wrangler.toml` `[vars]` | No | Restrict admin CORS to panel origin |
| KV `CONFIG_KV` id | `wrangler.toml` | No | Config storage binding |

**Never commit** admin passwords, hashes, salts, session secrets, or private keys. AdMob IDs are
public identifiers (not secrets) and are fine to include.

---

## 9. GitHub → Cloudflare

- Push this repo to GitHub (editor's **Save to GitHub**).
- In Cloudflare **Pages**, connect the repo and create two Pages projects (admin panel +
  privacy policy) with their output directories.
- For the **Worker**, run `wrangler deploy` from CI, or connect the repo with a Workers Build
  using `deliverables/cloudflare-worker` as the root.

---

## 10. Security

- No admin PIN/password in the app, APK/AAB, or public files.
- Admin auth is **server-side** (PBKDF2 verification + signed, expiring tokens).
- Admin write endpoints require a valid Bearer token and **validate all input**.
- Per-IP login rate limiting in the Worker. HTTPS only. Public `/config` is read-only, no PII.

---

## 11. Project layout

```
frontend/                     # Expo Android app
  app/                        # expo-router screens (Home, Selected, Editor, PDF Settings, Result, Settings, Preview)
  src/
    ads/                      # AdMob wrapper (guarded; no-op in Expo Go/web)
    config/                   # remote config client + safe defaults
    pdf/                      # on-device PDF generation, file ops, recent list
    components/               # shared UI (button, header, sheet, toast, ...)
deliverables/
  cloudflare-worker/          # remote config + secure admin API
  admin-panel/                # static admin SPA (Cloudflare Pages)
  privacy-policy/             # static privacy policy page (Cloudflare Pages)
```
