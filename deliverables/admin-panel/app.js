/* Image to PDF — Admin Panel (static SPA for Cloudflare Pages) */
const AD_UNIT_RE = /^ca-app-pub-\d{10,}\/\d{6,}$/;

const $ = (id) => document.getElementById(id);
let token = "";

const FIELDS = [
  "bannerAdUnitId",
  "interstitialAdUnitId",
  "appName",
  "privacyPolicyUrl",
  "defaultQuality",
  "defaultPageSize",
  "defaultOrientation",
  "interstitialCooldownSec",
  "maxImageCount",
];

function apiBase() {
  return ($("api-base").value || localStorage.getItem("apiBase") || "").replace(/\/+$/, "");
}

function setMsg(el, text, ok) {
  el.textContent = text;
  el.className = "msg " + (ok ? "ok" : "error");
}

function show(view) {
  $("login-view").classList.toggle("hidden", view !== "login");
  $("dash-view").classList.toggle("hidden", view !== "dash");
}

/* ------------------------------- login ---------------------------------- */
async function login() {
  const base = apiBase();
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!base) return setMsg($("login-msg"), "Enter the API Base URL", false);
  if (!email || !password) return setMsg($("login-msg"), "Enter email and password", false);

  $("login-btn").disabled = true;
  setMsg($("login-msg"), "Signing in…", true);
  try {
    const res = await fetch(`${base}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    token = data.token;
    localStorage.setItem("apiBase", base);
    sessionStorage.setItem("token", token);
    setMsg($("login-msg"), "", true);
    await loadConfig();
    show("dash");
  } catch (e) {
    setMsg($("login-msg"), e.message, false);
  } finally {
    $("login-btn").disabled = false;
  }
}

/* --------------------------- load & save config ------------------------- */
async function loadConfig() {
  const res = await fetch(`${apiBase()}/admin/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired. Please log in again.");
  }
  const { config } = await res.json();
  $("adsEnabled").checked = !!config.adsEnabled;
  FIELDS.forEach((f) => {
    if ($(f)) $(f).value = config[f] ?? "";
  });
  $("configVersion").textContent = config.configVersion ?? "–";
}

function validateBeforeSave(payload) {
  if (!AD_UNIT_RE.test(payload.bannerAdUnitId)) return "Banner Ad Unit ID is invalid.";
  if (!AD_UNIT_RE.test(payload.interstitialAdUnitId)) return "Interstitial Ad Unit ID is invalid.";
  if (!/^https:\/\/.+/i.test(payload.privacyPolicyUrl)) return "Privacy Policy URL must start with https://";
  if (!payload.appName.trim()) return "App Name is required.";
  return null;
}

async function save() {
  const payload = {
    adsEnabled: $("adsEnabled").checked,
    bannerAdUnitId: $("bannerAdUnitId").value.trim(),
    interstitialAdUnitId: $("interstitialAdUnitId").value.trim(),
    appName: $("appName").value.trim(),
    privacyPolicyUrl: $("privacyPolicyUrl").value.trim(),
    defaultQuality: $("defaultQuality").value,
    defaultPageSize: $("defaultPageSize").value,
    defaultOrientation: $("defaultOrientation").value,
    interstitialCooldownSec: Number($("interstitialCooldownSec").value),
    maxImageCount: Number($("maxImageCount").value),
  };

  const localErr = validateBeforeSave(payload);
  if (localErr) return setMsg($("dash-msg"), localErr, false);

  $("save-btn").disabled = true;
  setMsg($("dash-msg"), "Saving…", true);
  try {
    const res = await fetch(`${apiBase()}/admin/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.status === 401) {
      logout();
      throw new Error("Session expired. Please log in again.");
    }
    if (!res.ok) throw new Error((data.details && data.details.join(" ")) || data.error || "Save failed");
    $("configVersion").textContent = data.config.configVersion;
    setMsg($("dash-msg"), "✓ Saved. Devices will refresh within a few hours.", true);
  } catch (e) {
    setMsg($("dash-msg"), e.message, false);
  } finally {
    $("save-btn").disabled = false;
  }
}

function logout() {
  token = "";
  sessionStorage.removeItem("token");
  show("login");
}

/* --------------------------------- init --------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  const savedBase = localStorage.getItem("apiBase");
  if (savedBase) $("api-base").value = savedBase;
  const savedToken = sessionStorage.getItem("token");
  $("login-btn").addEventListener("click", login);
  $("save-btn").addEventListener("click", save);
  $("logout-btn").addEventListener("click", logout);

  if (savedToken) {
    token = savedToken;
    loadConfig()
      .then(() => show("dash"))
      .catch(() => show("login"));
  } else {
    show("login");
  }
});
