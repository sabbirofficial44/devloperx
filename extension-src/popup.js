/* DeveloperX — popup */
// Server endpoints are stored base64-encoded so casual inspection / string
// scans of the extension bundle do not reveal our backend hosts.
const _d = (s) => { try { return atob(s); } catch (_) { return ""; } };
const API_ENDPOINTS = [
  _d("aHR0cHM6Ly9wcm9qZWN0LS0zMDZhNDk5Ny01ODMwLTQ5MmYtYjhkYi05YmIwYWI0YWVlMWYtZGV2LmxvdmFibGUuYXBw"),
  _d("aHR0cHM6Ly9kZXZsb3BlcngubG92YWJsZS5hcHA="),
  _d("aHR0cHM6Ly9wcm9qZWN0LS0zMDZhNDk5Ny01ODMwLTQ5MmYtYjhkYi05YmIwYWI0YWVlMWYubG92YWJsZS5hcHA="),
  _d("aHR0cHM6Ly9mbG93YWlpdmlkZW8ubG92YWJsZS5hcHA="),
  _d("aHR0cHM6Ly9mbG93Y3JlYXRvcmFpLnNpdGU="),
];
const DEFAULT_API = API_ENDPOINTS[0];
const TRUSTED_APP_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?(lovable\.(app|dev)|flowcreatorai\.site)$/i;
// Backend auth is proxied through our own /api/public/auth/login — no direct DB creds in the extension.
const FLOW_URL = "https://labs.google/fx/tools/flow";
// Google serves Flow from several shapes: /fx/tools/flow, locale-prefixed
// /<lang>/fx/tools/flow, and the newer flow.google domain.
const FLOW_MATCH = /^https:\/\/(labs\.google\/(.*\/)?fx\/.*tools\/flow|([a-z0-9-]+\.)?flow\.google\/)/i;
const UNLIMITED = new Set(["unlimited", "ultra", "lifetime"]);

const $ = (id) => document.getElementById(id);

/* ---------------- live proxy (chrome.proxy, pure JS) ---------------- */
function sendToBackground(type, payload) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, ...(payload || {}) }, (r) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(r || null);
      });
    } catch {
      resolve(null);
    }
  });
}

let proxyOn = false;

function renderProxy(st) {
  const el = $("s-proxy");
  const btn = $("btn-proxy-toggle");
  const label = $("px-toggle-label");
  if (!el) return;
  proxyOn = !!(st && (st.on !== undefined ? st.on : st.proxy));
  if (proxyOn) {
    el.textContent = st.ip ? `🌐 ${st.ip}` : `🌐 ${String(st.proxy || "").replace(/^https?:\/\//, "") || "ON"}`;
    el.style.color = "#34d399";
  } else {
    el.textContent = "OFF";
    el.style.color = "";
  }
  if (btn) {
    btn.classList.toggle("on", proxyOn);
    btn.title = proxyOn ? "Click to turn proxy OFF" : "Click to turn proxy ON";
  }
  if (label) label.textContent = proxyOn ? "ON" : "OFF";
}

async function refreshProxy() {
  const st = await sendToBackground("DX_PROXY_STATUS");
  if (st && st.ok) {
    renderProxy(st);
    if (st.autoCleared) {
      setStatus("⚠️ Old proxy stopped working — cleared automatically. Turn ON for a fresh one.", "#fbbf24");
    }
    return;
  }
  const store = await chrome.storage.local.get("proxyInfo");
  renderProxy(store.proxyInfo || null);
}

async function rotateProxy() {
  const st = await sendToBackground("DX_ROTATE_PROXY");
  if (st && st.ok) { renderProxy(st); return st; }
  renderProxy(null);
  return null;
}

/* ---------------- storage ---------------- */
async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  const clean = (apiBase && apiBase.trim().replace(/\/$/, "")) || "";
  // Accept the dashboard origin pushed by site_bridge, otherwise fall back.
  if (!clean || (!API_ENDPOINTS.includes(clean) && !TRUSTED_APP_ORIGIN.test(clean))) {
    await chrome.storage.local.set({ apiBase: DEFAULT_API });
    return DEFAULT_API;
  }
  return clean;
}
async function setApiBase(v) {
  const clean = (v || "").trim().replace(/\/$/, "") || DEFAULT_API;
  await chrome.storage.local.set({ apiBase: clean });
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
  const preferred = await getApiBase();
  const tryOrder = [preferred, ...API_ENDPOINTS.filter((u) => u !== preferred)];
  let lastErr = null;
  let credentialErr = null;
  let unconfirmedErr = null;
  const failures = [];
  for (const base of tryOrder) {
    try {
      const res = await fetch(`${base}/api/public/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: email.trim(), password, version: chrome.runtime?.getManifest?.().version || "popup" }),
      });
      const type = (res.headers.get("content-type") || "").toLowerCase();
      const data = type.includes("application/json") ? await res.json().catch(() => ({})) : {};
      failures.push(`${base.replace(/^https:\/\//, "")}: ${res.status}`);
      if (!type.includes("application/json")) {
        lastErr = new Error("Server returned app page instead of login API");
        continue;
      }
      if (res.ok) {
        const normalized = normalizeLoginPayload(data, email);
        if (!normalized?.user?.id) {
          lastErr = new Error(data.message || "Login response missing user profile. Try again in a moment.");
          continue;
        }
        await setApiBase(base);
        return normalized;
      }
      // A published endpoint can be stale while the preview endpoint is current,
      // so do not stop on the first 401. Try every known server first.
      if (res.status === 401) {
        const message = data.message || "Invalid email or password";
        if (/confirm|verified|verification/i.test(message)) unconfirmedErr = new Error(message);
        else credentialErr = new Error(message);
        continue;
      }
      lastErr = new Error(data.message || `Login failed (${res.status})`);
    } catch (e) {
      failures.push(`${base.replace(/^https:\/\//, "")}: network`);
      lastErr = new Error(`${e.message || "Network error"}. Check extension update / internet.`);
    }
  }

  if (unconfirmedErr) throw unconfirmedErr;
  if (credentialErr) throw credentialErr;
  throw lastErr || new Error(`Cannot reach server (${failures.join(" | ")})`);
}


function decodeJwtPayload(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(Array.from(json, (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")));
  } catch {
    return null;
  }
}

function normalizeLoginPayload(payload, typedEmail) {
  const src = payload && typeof payload === "object" ? payload : {};
  const nested = src.data && typeof src.data === "object" ? src.data : {};
  const session = src.session || nested.session || {};
  const accessToken = src.accessToken || src.access_token || session.access_token || "";
  const tokenUser = decodeJwtPayload(accessToken);
  const rawUser =
    src.user && typeof src.user === "object"
      ? src.user
      : nested.user && typeof nested.user === "object"
        ? nested.user
        : session.user && typeof session.user === "object"
          ? session.user
          : {};
  const id = rawUser.id || src.userId || src.user_id || nested.userId || nested.user_id || src.id || tokenUser?.sub || null;
  if (!id) return null;
  const email = rawUser.email || src.email || nested.email || tokenUser?.email || typedEmail || "";
  const plan = rawUser.plan || src.plan || src.userPlan || nested.plan || nested.userPlan || "basic";
  const creditsLeft = Number(rawUser.creditsLeft ?? rawUser.credits ?? src.creditsLeft ?? src.credits ?? nested.creditsLeft ?? nested.credits ?? 0);
  return {
    accessToken,
    refreshToken: src.refreshToken || src.refresh_token || session.refresh_token || "",
    user: {
      id,
      name: rawUser.name || rawUser.displayName || rawUser.user_metadata?.display_name || src.name || src.displayName || nested.name || nested.displayName || email || "DeveloperX User",
      email,
      plan,
      creditsTotal: Number(rawUser.creditsTotal ?? src.creditsTotal ?? nested.creditsTotal ?? creditsLeft),
      creditsUsed: Number(rawUser.creditsUsed ?? src.creditsUsed ?? nested.creditsUsed ?? 0),
      creditsLeft,
    },
  };
}


async function fetchStatusForToken(userId, accessToken) {
  const preferred = await getApiBase();
  const tryOrder = [preferred, ...API_ENDPOINTS.filter((u) => u !== preferred)];
  let last = { status: 0, data: { valid: false, message: "Cannot reach server" } };
  let authFail = null;
  let currentToken = accessToken;
  for (const base of tryOrder) {
    try {
      const headers = { "Content-Type": "application/json", "Accept": "application/json" };
      if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
      const res = await fetch(`${base}/api/public/extension/verify?_ts=${Date.now()}`, {
        method: "POST",
        headers: { ...headers, "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" },
        cache: "no-store",
        body: JSON.stringify({ userId, accessToken: currentToken, _ts: Date.now() }),
      });

      const type = (res.headers.get("content-type") || "").toLowerCase();
      const data = type.includes("application/json") ? await res.json().catch(() => ({})) : { message: "Server returned app page instead of API" };
      last = { status: res.status, data };
      if (type.includes("application/json") && (res.ok || res.status === 402)) {
        await setApiBase(base);
        return last;
      }
      if (type.includes("application/json") && res.status === 401) {
        const freshToken = await refreshAccessToken(base);
        if (freshToken && freshToken !== currentToken) {
          currentToken = freshToken;
          const retryHeaders = { "Content-Type": "application/json", "Accept": "application/json", Authorization: `Bearer ${freshToken}` };
          const retry = await fetch(`${base}/api/public/extension/verify?_ts=${Date.now()}`, {
            method: "POST",
            headers: { ...retryHeaders, "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" },
            cache: "no-store",
            body: JSON.stringify({ userId, accessToken: freshToken, _ts: Date.now() }),
          });
          const retryType = (retry.headers.get("content-type") || "").toLowerCase();
          const retryData = retryType.includes("application/json") ? await retry.json().catch(() => ({})) : { message: "Server returned app page instead of API" };
          last = { status: retry.status, data: retryData };
          if (retryType.includes("application/json") && (retry.ok || retry.status === 402)) {
            await setApiBase(base);
            return last;
          }
        }
      }
      // Do not stop on a 401 from a stale/cached app endpoint. Try every known
      // server first so a valid website login still reaches the current backend.
      if (type.includes("application/json") && res.status === 401) authFail = last;
    } catch (e) {
      last = { status: 0, data: { valid: false, message: e.message || "Network error" } };
    }
  }
  return authFail || last;
}

async function fetchStatus(userId) {
  const { accessToken } = await chrome.storage.local.get("accessToken");
  return fetchStatusForToken(userId, accessToken);
}

function looksJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

async function refreshAccessToken(base) {
  try {
    const { refreshToken } = await chrome.storage.local.get("refreshToken");
    if (!refreshToken) return null;
    const res = await fetch(`${base}/api/public/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json", "Cache-Control": "no-store" },
      cache: "no-store",
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !looksJwt(data.accessToken)) return null;
    await chrome.storage.local.set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      authRefreshedAt: Date.now(),
    });
    return data.accessToken;
  } catch {
    return null;
  }
}

async function restoreSessionTimer(userId) {
  // Per-account session timer: each panel account keeps its OWN remaining
  // time across logout → login, so a customer can never reset an expired
  // timer by simply signing out and back in.
  try {
    const st = await chrome.storage.local.get("sessionTimers");
    const timers = (st && st.sessionTimers) || {};
    const own = timers[userId] || { expiresAt: 0, duration: 0 };
    return { sessionExpiresAt: Number(own.expiresAt || 0), sessionDurationMin: Number(own.duration || 0) };
  } catch {
    return { sessionExpiresAt: 0, sessionDurationMin: 0 };
  }
}

async function saveSession(payload) {
  const safe = normalizeLoginPayload(payload, payload?.user?.email || payload?.email || "");
  if (!safe?.user?.id) throw new Error("Login successful, but user profile was not returned. Please sign in again.");
  await chrome.storage.local.set({
    userId: safe.user.id,
    userName: safe.user.name,
    userEmail: safe.user.email,
    userPlan: safe.user.plan,
    creditsLeft: safe.user.creditsLeft,
    accessToken: safe.accessToken,
    refreshToken: safe.refreshToken,
    apiBase: await getApiBase(),
    loggedInAt: Date.now(),
    // Restore THIS account's own timer — never reset it on login.
    ...(await restoreSessionTimer(safe.user.id)),
  });
  try { chrome.runtime.sendMessage({ type: "DX_SESSION_UPDATED" }); } catch {}
}

async function clearSession() {
  await chrome.storage.local.remove([
    "userId","userName","userEmail","userPlan","creditsLeft","accessToken","refreshToken","loggedInAt",
    "sessionExpiresAt","sessionDurationMin",
  ]);
  try { chrome.runtime.sendMessage({ type: "DX_SESSION_CLEARED" }); } catch {}
}

/* ---------------- live countdown ---------------- */
let liveTimer = null;
let liveState = { credits: 0, unlimited: false, total: 1, syncedAt: 0, unknown: false, expiresAt: 0, duration: 0 };

// Absolute-session timer: the server returns the FULL granted minutes on
// every poll, so a local "credits − elapsed" counter restarts on refresh.
// Persist an absolute expiry timestamp instead — a refresh keeps showing
// the true remaining time instead of resetting to the full quota.
function calcExpiresAt(now, credits, prevExpiresAt, prevDuration) {
  // Reset ONLY when the granted time actually changes (the panel number
  // changed) or when no session exists yet. NEVER auto-restart from an
  // expired session — the server returns the same static number forever,
  // which used to make the timer "restart" and the site stay unlocked.
  if (credits > 0 && (!prevExpiresAt || credits !== prevDuration)) {
    return now + credits * 60000;
  }
  return prevExpiresAt || 0;
}

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
  if (liveState.unknown) {
    $("s-time").textContent = "--:--:--";
    $("s-credits").textContent = "—";
    return;
  }
  const elapsedSec = (Date.now() - liveState.syncedAt) / 1000;
  const remainingMin = liveState.expiresAt
    ? Math.max(0, (liveState.expiresAt - Date.now()) / 60000)
    : Math.max(0, liveState.credits - elapsedSec / 60);
  $("s-time").textContent = fmtHMS(remainingMin);
  $("s-credits").textContent = Math.max(0, Math.floor(remainingMin)).toLocaleString();
  const total = liveState.duration || Math.max(liveState.total, liveState.credits, 1);
  const pct = Math.max(0, Math.min(100, (remainingMin / total) * 100));
  const bar = $("s-bar");
  bar.style.width = pct + "%";
  bar.style.background =
    pct <= 10 ? "linear-gradient(90deg,#f87171,#ef4444)" :
    pct <= 30 ? "linear-gradient(90deg,#fbbf24,#f87171)" : "";
  // Time finished → show the buy CTA (client-side lock).
  if (remainingMin <= 0 && !liveState.unlimited) {
    $("s-upgrade").classList.remove("hidden");
  }

  if (remainingMin <= 0) {
    $("s-plan").className = "badge danger";
    $("s-alert").style.color = "#f87171";
    $("s-alert").textContent = "Credits exhausted. Top up to continue.";
    $("s-upgrade").classList.remove("hidden");
    stopLive();
  }
}

/* ---------------- render ---------------- */
function renderStatus(user, expiresAt, duration) {
  $("view-login").classList.add("hidden");
  $("view-status").classList.remove("hidden");
  $("s-name").textContent = user.name || user.email || "User";
  $("s-email").textContent = user.email || "";
  const plan = (user.plan || "basic").toLowerCase();
  const isUnlimited = UNLIMITED.has(plan);
  $("s-plan").textContent = plan;

  // null/undefined credits = unknown (e.g. partial site-auth session) —
  // never render a false "exhausted" state from missing data.
  const creditsRaw = user.creditsLeft;
  const credits = creditsRaw == null || isNaN(Number(creditsRaw)) ? null : Number(creditsRaw);
  const total = Number(user.creditsTotal || credits || 1);

  liveState = {
    credits: credits == null ? 0 : credits,
    unlimited: isUnlimited,
    total,
    syncedAt: Date.now(),
    unknown: credits == null,
    expiresAt: Number(expiresAt || 0),
    duration: Number(duration || 0),
  };

  const alertEl = $("s-alert");
  const upgrade = $("s-upgrade");
  const planBadge = $("s-plan");
  planBadge.className = "badge";
  alertEl.textContent = "";
  upgrade.classList.add("hidden");

  if (isUnlimited) {
    planBadge.classList.add("ok");
  } else if (credits == null) {
    // Session is live but credits haven't arrived yet — show placeholder, not danger.
    $("s-time").textContent = "--:--:--";
    $("s-credits").textContent = "—";
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
  const store = await chrome.storage.local.get(["userId", "sessionExpiresAt", "sessionDurationMin", "sessionTimers"]);
  if (!store.userId) return;
  try {
    const { data } = await fetchStatus(store.userId);
    if (data?.user) {
      const creditsRaw = data.user.creditsLeft;
      const credits = creditsRaw == null || isNaN(Number(creditsRaw)) ? 0 : Number(creditsRaw);
      const now = Date.now();
      // This account's own persisted timer (survives logout → login).
      const timers = store.sessionTimers || {};
      const own = timers[store.userId] || { expiresAt: 0, duration: 0 };
      const prevExp = Number(own.expiresAt || 0);
      const prevDur = Number(own.duration || 0);
      const expiresAt = calcExpiresAt(now, credits, prevExp, prevDur);
      const reset = credits > 0 && (!prevExp || credits !== prevDur);
      const duration = reset ? credits : prevDur;
      const next = {
        creditsLeft: data.user.creditsLeft,
        userPlan: data.user.plan,
        sessionExpiresAt: expiresAt,
        sessionDurationMin: duration,
        sessionTimers: { ...timers, [store.userId]: { expiresAt, duration } },
        lastLiveCookieSync: now,
      };
      if (Array.isArray(data.cookies)) next.cookieData = data.cookies;
      if (data.cookieUpdatedAt) next.cookieUpdatedAt = data.cookieUpdatedAt;
      await chrome.storage.local.set(next);
      renderStatus(data.user, expiresAt, duration);
      // Keep the background pool fresh too, so Inject Flow / re-inject works
      // straight from the popup without touching the extension page.
      try { chrome.runtime.sendMessage({ type: "DX_FORCE_LIVE_SYNC" }); } catch {}
    }
  } catch { /* offline */ }
}

/* ---------------- init ---------------- */
async function init() {
  const base = await getApiBase();
  $("api-base").value = base;

  const store = await chrome.storage.local.get(["userId","userEmail","userName","userPlan","creditsLeft","sessionExpiresAt","sessionDurationMin"]);
  let liveBound = false;
  const bindLive = () => {
    if (liveBound) return;
    liveBound = true;
    setInterval(() => { refreshLive(); refreshProxy(); }, 15000);
    // Re-sync the admin-set time/credits whenever the popup regains focus.
    window.addEventListener("focus", () => { refreshLive(); refreshProxy(); });
  };
  if (store.userId) {
    renderStatus(
      {
        id: store.userId, name: store.userName, email: store.userEmail,
        plan: store.userPlan, creditsLeft: store.creditsLeft,
      },
      store.sessionExpiresAt,
      store.sessionDurationMin
    );
    refreshLive();
    refreshProxy();
    bindLive();
  }
  // Live proxy ON/OFF switch — one click toggles the REAL browser proxy.
  $("btn-proxy-toggle")?.addEventListener("click", async () => {
    const btn = $("btn-proxy-toggle");
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    try {
      const st = await sendToBackground("DX_PROXY_STATUS");
      const wasOn = !!(st && (st.on !== undefined ? st.on : st.proxy));
      if (wasOn) {
        await sendToBackground("DX_PROXY_OFF"); // clears chrome.proxy — real OFF
      } else {
        // Turning ON — rotate to a LIVE proxy (GitHub pool, fast test, skips dead)
        const r = await rotateProxy();
        if (!r || !r.ok) setStatus("⚠️ No live proxy found — proxy stayed OFF", "#f87171");
      }
      refreshProxy();
    } finally {
      btn.disabled = false;
    }
  });

  // Reconcile with the service worker: the popup must mirror the REAL session
  // even when its own storage read is stale/partial (e.g. site-auth sessions,
  // or after the background refreshed tokens). This is the source of truth for
  // "extension is signed in but popup says signed out".
  try {
    const session = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "DX_GET_SESSION" }, (r) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(r || null);
        });
      } catch {
        resolve(null);
      }
    });
    if (session && session.signedIn) {
      if (!store.userId) {
        await chrome.storage.local.set({
          userId: session.userId,
          userName: session.userName,
          userEmail: session.userEmail,
          userPlan: session.userPlan,
          creditsLeft: session.creditsLeft,
          lastLiveCookieSync: session.lastLiveCookieSync || Date.now(),
        });
      }
      renderStatus({
        id: session.userId, name: session.userName, email: session.userEmail,
        plan: session.userPlan, creditsLeft: session.creditsLeft,
      });
      refreshLive();
      bindLive();
      if (session.extensionUpdateRequired) {
        const n = $("inject-status");
        if (n) n.textContent = "⚠️ Update required — get the latest build from your provider.";
      } else if (session.cookieCount > 0) {
        const n = $("inject-status");
        if (n) n.textContent = `Live pool ready · ${session.cookieCount} cookies cached`;
      }
    }
  } catch { /* SW unavailable — keep the storage-based view */ }

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
      renderStatus(normalizeLoginPayload(payload, email).user);
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

  /* STORY MODE DISABLED (per user request) — uncomment to re-enable
  // ---- Story Mode ----
  const storyArea = $("story-prompts");
  const storyCount = $("story-count");
  const countPrompts = () => {
    if (!storyArea || !storyCount) return;
    const n = storyArea.value.split("\n").map((s) => s.trim()).filter(Boolean).length;
    storyCount.textContent = n ? `${n} prompts` : "0 prompts";
  };
  storyArea?.addEventListener("input", countPrompts);
  countPrompts();

  $("btn-story-start")?.addEventListener("click", async () => {
    if (storyState.running) return;
    if (!storyArea) return;
    const prompts = storyArea.value.split("\n").map((s) => s.trim()).filter(Boolean);
    const s = $("story-status");
    if (!prompts.length) {
      if (s) { s.textContent = "Paste at least one prompt (one per line)."; s.style.color = "#f87171"; }
      return;
    }
    const res = await sendToBackground("DX_STORY_START", { prompts });
    if (res && res.ok) {
      renderStoryStatus({ state: "running", index: 0, total: prompts.length, clips: 0, failed: 0, step: "▶️ starting — opening Flow…" });
    } else if (s) {
      s.textContent = "⚠️ " + ((res && res.error) || "Could not start — reload the extension and retry");
      s.style.color = "#f87171";
    }
  });

  $("btn-story-stop")?.addEventListener("click", async () => {
    await sendToBackground("DX_STORY_STOP");
    const s = $("story-status");
    if (s) { s.textContent = "⏹ stopping after the current clip…"; s.style.color = "#fbbf24"; }
  });

  // Live progress while the popup is open; storage sync when it reopens.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "DX_STORY_PROGRESS") renderStoryStatus(msg);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.storyStatus) renderStoryStatus(changes.storyStatus.newValue);
  });
  (async () => {
    const res = await sendToBackground("DX_STORY_STATUS");
    renderStoryStatus(res && res.ok ? res.status : null);
  })();
  */
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

  const sourceExpiry = Number(c.expirationDate || 0);
  if (sourceExpiry > Math.floor(Date.now() / 1000)) {
    details.expirationDate = sourceExpiry;
  }
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
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) [tab] = await chrome.tabs.query({ active: true });
    return tab || null;
  } catch { return null; }
}

async function injectAndOpenFlow() {
  const btn = $("inject-flow");
  btn.disabled = true;
  setStatus("🔄 Injecting live cookies…");
  try {
    const store = await chrome.storage.local.get(["userId"]);
    if (!store.userId) throw new Error("Please sign in first.");

    // The panel validates the account/credits; live COOKIES come from the
    // service worker's DIRECT upstream fetch (veoly.netlify.app) with the
    // panel only as fallback — the extension no longer depends on the panel
    // for live cookies.
    let data = null;
    try {
      const r = await fetchStatus(store.userId);
      data = r.data || null;
      if (r.status === 402 || data?.blocked || data?.disabled) {
        setStatus("🚫 Credits exhausted — top up via WhatsApp", "#f87171");
        $("s-upgrade").classList.remove("hidden");
        btn.disabled = false;
        return;
      }
      if (!data?.valid) {
        throw new Error(data?.message || "Session invalid — sign in to the panel again.");
      }
    } catch (e) {
      // Panel unreachable or session expired — still inject with DIRECT
      // upstream cookies (best effort). Credits stay enforced when the
      // panel is reachable.
      data = { valid: true, user: null, panelError: String((e && e.message) || e) };
      setStatus("⚠️ Panel: " + data.panelError + " — using direct upstream cookies…", "#fbbf24");
    }

    setStatus("🔑 Fetching live cookies…");
    const res = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "DX_FORCE_LIVE_INJECT" }, (r) => {
          if (chrome.runtime.lastError) return resolve({ success: false, message: chrome.runtime.lastError.message });
          resolve(r || { success: false });
        });
      } catch (err) {
        resolve({ success: false, message: String(err) });
      }
    });
    if (!res || res.success === false) {
      throw new Error(res?.message || "Background injection failed.");
    }
    // The live cookies may be present but their Google token already dead
    // (session pool expired) — injecting them would just sign the user out
    // again, so tell them exactly what to fix instead.
    if (res.sessionHealth === "expired") {
      setStatus(
        "⚠️ Session pool expired — the Google token inside the live cookies is dead, so Flow keeps signing out. Refresh the pool from the panel (Live Fetch / re-login the source account), then inject again.",
        "#f87171"
      );
      btn.disabled = false;
      return;
    }
    // Background already fetched and applied the live session (upstream
    // first). Refresh the local pool copy for re-injects, then reload.
    const synced = await chrome.storage.local.get(["cookieData"]);
    const delegatedCookies = Array.isArray(synced.cookieData) ? synced.cookieData : [];
    if (delegatedCookies.length === 0) {
      throw new Error("Background applied the session but no cookies were stored.");
    }
    data.cookies = delegatedCookies;
    await chrome.storage.local.set({
      cookieData: data.cookies,
      cookieUpdatedAt: Date.now(),
      lastLiveCookieSync: Date.now(),
    });

    if (data.user) {
      const plan = (data.user.plan || "basic").toLowerCase();
      const credits = Number(data.user.creditsLeft ?? 0);
      if (!UNLIMITED.has(plan) && credits <= 0) {
        setStatus("🚫 Credits exhausted — top up via WhatsApp", "#f87171");
        $("s-upgrade").classList.remove("hidden");
        btn.disabled = false;
        return;
      }
    }

    // Client-side expiry lock: the panel stores only a static number, so the
    // extension itself refuses to inject once the absolute session ended
    // (unless the plan is unlimited). Buy more time → panel re-sets the
    // number → refreshLive picks it up and unlocks.
    const expStore = await chrome.storage.local.get(["sessionExpiresAt"]);
    const expAt = Number(expStore.sessionExpiresAt || 0);
    const userPlan = String(data?.user?.plan || "").toLowerCase();
    if (expAt && Date.now() >= expAt && !UNLIMITED.has(userPlan)) {
      setStatus("⏰ Time finished — buy more time via WhatsApp to continue", "#f87171");
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

/* STORY MODE DISABLED (per user request) — uncomment to re-enable
// ---------------- story mode ----------------
const storyState = { running: false };

function renderStoryStatus(st) {
  const statusEl = $("story-status");
  const startBtn = $("btn-story-start");
  const stopBtn = $("btn-story-stop");
  if (!statusEl) return;
  const runningNow = !!(st && st.state === "running");
  storyState.running = runningNow;
  if (startBtn) { startBtn.disabled = runningNow; startBtn.style.display = runningNow ? "none" : ""; }
  if (stopBtn) { stopBtn.style.display = runningNow ? "" : "none"; }
  if (!st || !st.state) { statusEl.textContent = ""; return; }
  const prefix = st.total ? `Clip ${Math.min((st.index || 0) + 1, st.total)}/${st.total} · ` : "";
  if (st.state === "running") {
    statusEl.textContent = prefix + (st.step || "working…");
    statusEl.style.color =
      st.step && st.step.includes("❌") ? "#f87171" : (st.step && st.step.includes("⚠️") ? "#fbbf24" : "#c4b5fd");
  } else if (st.state === "done" || st.state === "stopped") {
    statusEl.textContent =
      (st.step || (st.state === "done" ? "Story complete" : "Stopped")) +
      (st.clips ? ` · ${st.clips} clips downloaded` : "") +
      (st.failed ? ` · ${st.failed} failed` : "");
    statusEl.style.color = st.state === "done" ? "#34d399" : "#fbbf24";
  }
}
*/

init();
