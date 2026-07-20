/* DeveloperX — Veo Unlimited popup */
const DEFAULT_API = "https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f-dev.lovable.app";
const FLOW_URL = "https://labs.google/fx/tools/flow";
const FLOW_MATCH = /^https:\/\/labs\.google\/fx\/tools\/flow/i;
const UNLIMITED = new Set(["unlimited", "ultra", "lifetime"]);

const $ = (id) => document.getElementById(id);

/* ---------------- storage ---------------- */
async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  const clean = (apiBase && apiBase.trim().replace(/\/$/, "")) || "";
  if (!clean || clean.includes("419703e7-8466-4d48-adf9-ae7a596f3a61")) {
    await chrome.storage.local.set({ apiBase: DEFAULT_API });
    return DEFAULT_API;
  }
  return clean;
}
async function setApiBase(v) {
  await chrome.storage.local.set({ apiBase: (v || "").trim().replace(/\/$/, "") || DEFAULT_API });
}

/* ---------------- time format ---------------- */
function fmtHMS(mins) {
  if (mins == null || isNaN(mins)) return "--:--:--";
  const totalSec = Math.max(0, Math.floor(Number(mins) * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* ---------------- api ---------------- */
async function login(email, password) {
  const base = await getApiBase();
  const res = await fetch(`${base}/api/public/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Login failed");
  return data;
}

async function fetchStatus(userId) {
  const base = await getApiBase();
  const { accessToken } = await chrome.storage.local.get("accessToken");
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${base}/api/public/extension/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, accessToken }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function saveSession(payload) {
  await chrome.storage.local.set({
    userId: payload.user.id,
    userName: payload.user.name,
    userEmail: payload.user.email,
    userPlan: payload.user.plan,
    creditsLeft: payload.user.creditsLeft,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    apiBase: await getApiBase(),
    loggedInAt: Date.now(),
  });
  try { chrome.runtime.sendMessage({ type: "DX_SESSION_UPDATED" }); } catch {}
}

async function clearSession() {
  await chrome.storage.local.remove([
    "userId","userName","userEmail","userPlan","creditsLeft","accessToken","refreshToken","loggedInAt",
  ]);
  try { chrome.runtime.sendMessage({ type: "DX_SESSION_CLEARED" }); } catch {}
}

/* ---------------- live countdown ---------------- */
let liveTimer = null;
let liveState = { credits: 0, unlimited: false, total: 1, syncedAt: 0 };

function stopLive() { if (liveTimer) { clearInterval(liveTimer); liveTimer = null; } }

function startLive() {
  stopLive();
  tickLive();
  liveTimer = setInterval(tickLive, 1000);
}

function tickLive() {
  if (liveState.unlimited) {
    $("s-time").textContent = "∞ Unlimited";
    $("s-credits").textContent = "∞";
    $("s-bar").style.width = "100%";
    return;
  }
  const elapsedSec = (Date.now() - liveState.syncedAt) / 1000;
  const remainingMin = Math.max(0, liveState.credits - elapsedSec / 60);
  $("s-time").textContent = fmtHMS(remainingMin);
  $("s-credits").textContent = Math.max(0, Math.floor(remainingMin)).toLocaleString();
  const total = Math.max(liveState.total, liveState.credits, 1);
  const pct = Math.max(0, Math.min(100, (remainingMin / total) * 100));
  $("s-bar").style.width = pct + "%";

  if (remainingMin <= 0) {
    $("s-plan").className = "badge danger";
    $("s-alert").style.color = "#f87171";
    $("s-alert").textContent = "Credits exhausted. Top up to continue.";
    $("s-upgrade").classList.remove("hidden");
    stopLive();
  }
}

/* ---------------- render ---------------- */
function renderStatus(user) {
  $("view-login").classList.add("hidden");
  $("view-status").classList.remove("hidden");
  $("s-name").textContent = user.name || user.email || "User";
  $("s-email").textContent = user.email || "";
  const plan = (user.plan || "basic").toLowerCase();
  const isUnlimited = UNLIMITED.has(plan);
  $("s-plan").textContent = plan;

  const credits = Number(user.creditsLeft ?? 0);
  const total = Number(user.creditsTotal || credits || 1);

  liveState = {
    credits,
    unlimited: isUnlimited,
    total,
    syncedAt: Date.now(),
  };

  const alertEl = $("s-alert");
  const upgrade = $("s-upgrade");
  const planBadge = $("s-plan");
  planBadge.className = "badge";
  alertEl.textContent = "";
  upgrade.classList.add("hidden");

  if (isUnlimited) {
    planBadge.classList.add("ok");
  } else if (credits <= 0) {
    planBadge.classList.add("danger");
    alertEl.style.color = "#f87171";
    alertEl.textContent = "Credits exhausted. Extension is blocked until you top up.";
    upgrade.classList.remove("hidden");
  } else if (credits <= 60) {
    planBadge.classList.add("warn");
    alertEl.style.color = "#fbbf24";
    alertEl.textContent = `Low balance — only ${fmtHMS(credits)} left.`;
    upgrade.classList.remove("hidden");
  }

  startLive();
}

async function refreshLive() {
  const store = await chrome.storage.local.get(["userId"]);
  if (!store.userId) return;
  try {
    const { data } = await fetchStatus(store.userId);
    if (data?.user) {
      await chrome.storage.local.set({
        creditsLeft: data.user.creditsLeft,
        userPlan: data.user.plan,
      });
      renderStatus(data.user);
    }
  } catch { /* offline */ }
}

/* ---------------- init ---------------- */
async function init() {
  const base = await getApiBase();
  $("api-base").value = base;

  const store = await chrome.storage.local.get(["userId","userEmail","userName","userPlan","creditsLeft"]);
  if (store.userId) {
    renderStatus({
      id: store.userId, name: store.userName, email: store.userEmail,
      plan: store.userPlan, creditsLeft: store.creditsLeft,
    });
    refreshLive();
    setInterval(refreshLive, 15000);
  }

  $("login-btn").addEventListener("click", async () => {
    const btn = $("login-btn"); const errEl = $("login-err");
    errEl.textContent = "";
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) { errEl.textContent = "Enter email and password"; return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      const payload = await login(email, password);
      await saveSession(payload);
      renderStatus(payload.user);
      refreshLive();
      setInterval(refreshLive, 15000);
    } catch (e) {
      errEl.textContent = e.message || "Login failed";
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await clearSession();
    stopLive();
    $("view-status").classList.add("hidden");
    $("view-login").classList.remove("hidden");
  });

  $("open-flow").addEventListener("click", () => {
    chrome.tabs.create({ url: FLOW_URL });
  });

  $("inject-flow").addEventListener("click", injectAndOpenFlow);
}

/* ---------------- inject flow ---------------- */
function setStatus(msg, color) {
  const el = $("inject-status");
  el.textContent = msg || "";
  el.style.color = color || "#a2acc0";
}

// Cookie injection strategy — MAX PERSISTENCE:
// 1. Never touch unrelated cookies (would trip Google's anti-abuse)
// 2. Overwrite same-name cookies in place, force 1-year expiry
// 3. Triple-pass for critical auth cookies (SID/HSID/SSID/APISID/SAPISID/__Secure-*)
// 4. Verify readback and retry failed critical cookies

const ONE_YEAR = 60 * 60 * 24 * 365;
const AUTH_CRITICAL = /^(SID|HSID|SSID|APISID|SAPISID|SIDCC|LSID|OSID|ACCOUNT_CHOOSER|__Secure-(1?PSID|1?PAPISID|1?PSIDCC|1?PSIDTS|OSID|3PSID|3PAPISID)|__Host-)/i;

function normalizeSameSite(v, secure) {
  const s = String(v || "").toLowerCase();
  if (s === "no_restriction" || s === "none") return "no_restriction";
  if (s === "lax") return "lax";
  if (s === "strict") return "strict";
  return secure ? "no_restriction" : "lax";
}

function buildCookieDetails(c) {
  const rawName = String(c.name || "");
  if (!rawName) return null;
  const isHost = rawName.startsWith("__Host-");
  const isSecurePrefix = rawName.startsWith("__Secure-") || isHost;
  const secure = isSecurePrefix ? true : c.secure !== false;

  const domain = c.domain || ".google.com";
  const path = isHost ? "/" : (c.path || "/");
  const host = domain.replace(/^\./, "");
  const url = `https://${host}${path}`;

  const details = {
    url,
    name: rawName,
    value: String(c.value ?? ""),
    path,
    secure,
    httpOnly: !!c.httpOnly,
    sameSite: normalizeSameSite(c.sameSite, secure),
  };
  if (!isHost && domain.startsWith(".")) details.domain = domain;

  const farFuture = Math.floor(Date.now() / 1000) + ONE_YEAR;
  details.expirationDate = Math.max(Number(c.expirationDate || 0), farFuture);
  return details;
}

async function setCookie(c) {
  const details = buildCookieDetails(c);
  if (!details) return false;
  try {
    await chrome.cookies.set(details);
    return true;
  } catch {
    try {
      const retry = { ...details };
      delete retry.domain;
      await chrome.cookies.set(retry);
      return true;
    } catch {
      return false;
    }
  }
}

async function verifyCookie(c) {
  try {
    const domain = c.domain || ".google.com";
    const host = domain.replace(/^\./, "");
    const url = `https://${host}${c.path || "/"}`;
    const found = await chrome.cookies.get({ url, name: c.name });
    return found && found.value === String(c.value ?? "");
  } catch {
    return false;
  }
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch { return null; }
}

async function injectAndOpenFlow() {
  const btn = $("inject-flow");
  btn.disabled = true;
  setStatus("🔒 Verifying session…");
  try {
    const store = await chrome.storage.local.get(["userId"]);
    if (!store.userId) throw new Error("Please sign in first.");

    const { status, data } = await fetchStatus(store.userId);
    if (status === 402 || data?.blocked || data?.disabled) {
      setStatus("🚫 Credits exhausted — top up via WhatsApp", "#f87171");
      $("s-upgrade").classList.remove("hidden");
      btn.disabled = false;
      return;
    }
    if (!data?.valid || !Array.isArray(data.cookies) || data.cookies.length === 0) {
      throw new Error(data?.message || "No live session cookies found.");
    }

    const plan = (data.user?.plan || "basic").toLowerCase();
    const credits = Number(data.user?.creditsLeft ?? 0);
    if (!UNLIMITED.has(plan) && credits <= 0) {
      setStatus("🚫 Credits exhausted — top up via WhatsApp", "#f87171");
      $("s-upgrade").classList.remove("hidden");
      btn.disabled = false;
      return;
    }

    const total = data.cookies.length;
    setStatus(`🍪 Injecting ${total} cookies…`);

    // Pass 1: set every cookie once
    let ok = 0;
    for (const c of data.cookies) {
      if (await setCookie(c)) ok++;
      await new Promise((r) => setTimeout(r, 8));
    }

    // Pass 2 + 3: re-apply critical auth cookies so they win any race
    const critical = data.cookies.filter((c) => AUTH_CRITICAL.test(c.name || ""));
    for (let pass = 0; pass < 2; pass++) {
      for (const c of critical) {
        await setCookie(c);
        await new Promise((r) => setTimeout(r, 4));
      }
    }

    // Pass 4: verify readback of critical cookies and retry misses
    setStatus(`🔍 Verifying ${critical.length} auth cookies…`);
    let missing = 0;
    for (const c of critical) {
      if (!(await verifyCookie(c))) {
        await setCookie(c);
        if (!(await verifyCookie(c))) missing++;
      }
    }

    await chrome.storage.local.set({ creditsLeft: data.user?.creditsLeft, userPlan: data.user?.plan });
    renderStatus(data.user);

    const okMsg = missing > 0
      ? `⚠ Injected ${ok}/${total} (${missing} missed) — reloading…`
      : `✅ Injected ${ok}/${total} · session locked — reloading…`;

    const tab = await getActiveTab();
    if (tab && tab.id != null && tab.url && FLOW_MATCH.test(tab.url)) {
      setStatus(okMsg, missing > 0 ? "#fbbf24" : "#34d399");
      setTimeout(() => { try { chrome.tabs.reload(tab.id, { bypassCache: true }); } catch {} window.close(); }, 500);
    } else if (tab && tab.id != null) {
      setStatus(okMsg.replace("reloading", "opening Flow here"), missing > 0 ? "#fbbf24" : "#34d399");
      setTimeout(() => { try { chrome.tabs.update(tab.id, { url: FLOW_URL }); } catch { chrome.tabs.create({ url: FLOW_URL }); } window.close(); }, 500);
    } else {
      setStatus(okMsg.replace("reloading", "opening Flow"), missing > 0 ? "#fbbf24" : "#34d399");
      setTimeout(() => chrome.tabs.create({ url: FLOW_URL }), 500);
    }
  } catch (e) {
    setStatus("❌ " + (e.message || "Injection failed"), "#f87171");
  } finally {
    btn.disabled = false;
  }
}

init();
