/**
 * Image to PDF — Remote Config + Admin API (Cloudflare Worker)
 * Developer: Paul Digital
 *
 * Responsibilities:
 *  - Serve PUBLIC read-only app configuration to the Android app  (GET /config)
 *  - Provide a SECURE, server-authenticated Admin API to edit that config
 *
 * Security model (see README):
 *  - No admin password is ever stored in the app or in this source.
 *  - Admin credentials live ONLY in Cloudflare secrets:
 *      ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_PASSWORD_SALT, ADMIN_SESSION_SECRET
 *  - Password verified server-side with PBKDF2 (WebCrypto).
 *  - Sessions are stateless signed tokens (HMAC-SHA256) with an expiry.
 *  - All admin write endpoints validate input server-side.
 *
 * Storage: a single KV entry ("app_config") in the CONFIG_KV namespace.
 */

const CONFIG_KEY = "app_config";
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8h admin session
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_ATTEMPTS = 10;

const AD_UNIT_RE = /^ca-app-pub-\d{10,}\/\d{6,}$/;

const DEFAULT_CONFIG = {
  configVersion: 1,
  adsEnabled: true,
  bannerAdUnitId: "ca-app-pub-5048291410050597/6939420157",
  interstitialAdUnitId: "ca-app-pub-5048291410050597/1687093471",
  appName: "Image to PDF",
  privacyPolicyUrl: "https://image-to-pdf.pages.dev/privacy",
  defaultQuality: "high",
  defaultPageSize: "a4",
  defaultOrientation: "auto",
  maxImageCount: 50,
  interstitialCooldownSec: 60,
};

/* ------------------------------- helpers -------------------------------- */

const enc = new TextEncoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function b64urlEncode(bytes) {
  let str = "";
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) str += String.fromCharCode(b[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecodeToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2Hex(password, saltHex, iterations = 100000, length = 32) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: hexToBytes(saltHex), iterations, hash: "SHA-256" },
    keyMaterial,
    length * 8,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64urlEncode(sig);
}

async function issueToken(email, secret) {
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64urlEncode(
    enc.encode(
      JSON.stringify({ sub: email, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }),
    ),
  );
  const body = `${header}.${payload}`;
  const sig = await hmacSign(secret, body);
  return `${body}.${sig}`;
}

// A secret that is missing or too short is treated as "server not configured".
// This fails CLOSED so tokens can never be signed/verified with a predictable key.
function serverConfigured(env) {
  return typeof env.ADMIN_SESSION_SECRET === "string" && env.ADMIN_SESSION_SECRET.length >= 16;
}

async function verifyToken(token, secret) {
  if (!secret || secret.length < 16) return null; // fail closed if unset/weak
  if (!token || token.split(".").length !== 3) return null;
  try {
    const [header, payload, sig] = token.split(".");
    const expected = await hmacSign(secret, `${header}.${payload}`);
    if (!timingSafeEqual(b64urlDecodeToBytes(sig), b64urlDecodeToBytes(expected))) return null;
    const data = JSON.parse(new TextDecoder().decode(b64urlDecodeToBytes(payload)));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

async function readConfig(env) {
  const raw = await env.CONFIG_KV.get(CONFIG_KEY, "json");
  return { ...DEFAULT_CONFIG, ...(raw || {}) };
}

function validateConfig(input, current) {
  const next = { ...current };
  const errors = [];

  if (typeof input.adsEnabled === "boolean") next.adsEnabled = input.adsEnabled;

  if (input.bannerAdUnitId !== undefined) {
    if (typeof input.bannerAdUnitId === "string" && AD_UNIT_RE.test(input.bannerAdUnitId))
      next.bannerAdUnitId = input.bannerAdUnitId;
    else errors.push("bannerAdUnitId must look like ca-app-pub-XXXX/YYYY");
  }
  if (input.interstitialAdUnitId !== undefined) {
    if (typeof input.interstitialAdUnitId === "string" && AD_UNIT_RE.test(input.interstitialAdUnitId))
      next.interstitialAdUnitId = input.interstitialAdUnitId;
    else errors.push("interstitialAdUnitId must look like ca-app-pub-XXXX/YYYY");
  }
  if (input.appName !== undefined) {
    if (typeof input.appName === "string" && input.appName.trim().length > 0 && input.appName.length <= 60)
      next.appName = input.appName.trim();
    else errors.push("appName must be 1–60 characters");
  }
  if (input.privacyPolicyUrl !== undefined) {
    if (typeof input.privacyPolicyUrl === "string" && /^https:\/\/.+/i.test(input.privacyPolicyUrl))
      next.privacyPolicyUrl = input.privacyPolicyUrl;
    else errors.push("privacyPolicyUrl must be a valid https URL");
  }
  if (input.defaultQuality !== undefined) {
    if (["standard", "high", "best"].includes(input.defaultQuality)) next.defaultQuality = input.defaultQuality;
    else errors.push("defaultQuality must be standard|high|best");
  }
  if (input.defaultPageSize !== undefined) {
    if (["a4", "original"].includes(input.defaultPageSize)) next.defaultPageSize = input.defaultPageSize;
    else errors.push("defaultPageSize must be a4|original");
  }
  if (input.defaultOrientation !== undefined) {
    if (["portrait", "landscape", "auto"].includes(input.defaultOrientation))
      next.defaultOrientation = input.defaultOrientation;
    else errors.push("defaultOrientation must be portrait|landscape|auto");
  }
  if (input.maxImageCount !== undefined) {
    const n = Number(input.maxImageCount);
    if (Number.isInteger(n) && n > 0 && n <= 500) next.maxImageCount = n;
    else errors.push("maxImageCount must be an integer 1–500");
  }
  if (input.interstitialCooldownSec !== undefined) {
    const n = Number(input.interstitialCooldownSec);
    if (Number.isInteger(n) && n >= 0 && n <= 3600) next.interstitialCooldownSec = n;
    else errors.push("interstitialCooldownSec must be an integer 0–3600");
  }

  return { next, errors };
}

/* --------------------------------- routes -------------------------------- */

async function handleLogin(request, env, cors) {
  // Fail closed: never authenticate if the server is misconfigured.
  if (!serverConfigured(env) || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_SALT) {
    return json({ error: "Server not configured" }, 503, cors);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const attemptKey = `login_attempts:${ip}`;
  const attempts = parseInt((await env.CONFIG_KV.get(attemptKey)) || "0", 10);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    return json({ error: "Too many attempts. Try again later." }, 429, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400, cors);
  }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  const configuredEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  const okEmail = configuredEmail && email === configuredEmail;

  let okPassword = false;
  if (okEmail && env.ADMIN_PASSWORD_HASH && env.ADMIN_PASSWORD_SALT) {
    const computed = await pbkdf2Hex(password, env.ADMIN_PASSWORD_SALT);
    okPassword = timingSafeEqual(hexToBytes(computed), hexToBytes(env.ADMIN_PASSWORD_HASH));
  }

  if (!okEmail || !okPassword) {
    await env.CONFIG_KV.put(attemptKey, String(attempts + 1), {
      expirationTtl: LOGIN_WINDOW_SECONDS,
    });
    return json({ error: "Invalid email or password" }, 401, cors);
  }

  await env.CONFIG_KV.delete(attemptKey);
  const token = await issueToken(email, env.ADMIN_SESSION_SECRET);
  return json({ token, expiresIn: TOKEN_TTL_SECONDS }, 200, cors);
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return verifyToken(token, env.ADMIN_SESSION_SECRET);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const adminOrigin = env.ADMIN_ORIGIN || "*";
    const publicCors = corsHeaders("*");
    const adminCors = corsHeaders(adminOrigin === "*" ? origin || "*" : adminOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: adminCors });
    }

    // ---- PUBLIC read-only config for the Android app ----
    if (url.pathname === "/config" && request.method === "GET") {
      const config = await readConfig(env);
      return json(
        { config },
        200,
        { ...publicCors, "Cache-Control": "public, max-age=300" },
      );
    }

    // ---- Admin: login ----
    if (url.pathname === "/admin/login" && request.method === "POST") {
      return handleLogin(request, env, adminCors);
    }

    // ---- Admin: read full config ----
    if (url.pathname === "/admin/config" && request.method === "GET") {
      const session = await requireAuth(request, env);
      if (!session) return json({ error: "Unauthorized" }, 401, adminCors);
      const config = await readConfig(env);
      return json({ config }, 200, adminCors);
    }

    // ---- Admin: update config ----
    if (url.pathname === "/admin/config" && request.method === "PUT") {
      const session = await requireAuth(request, env);
      if (!session) return json({ error: "Unauthorized" }, 401, adminCors);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid request body" }, 400, adminCors);
      }
      const current = await readConfig(env);
      const { next, errors } = validateConfig(body, current);
      if (errors.length) return json({ error: "Validation failed", details: errors }, 422, adminCors);

      next.configVersion = (current.configVersion || 1) + 1;
      await env.CONFIG_KV.put(CONFIG_KEY, JSON.stringify(next));
      return json({ config: next, saved: true }, 200, adminCors);
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "image-to-pdf-config" }, 200, publicCors);
    }

    return json({ error: "Not found" }, 404, publicCors);
  },
};
