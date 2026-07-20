/* DeveloperX — Veu Unlimited popup
 * Fully connected to this project's server.
 */
const DEFAULT_API = "https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f-dev.lovable.app";
const FLOW_URL = "https://labs.google/fx/tools/flow";
const UNLIMITED = new Set(["unlimited", "ultra", "lifetime"]);

const $ = (id) => document.getElementById(id);

async function getApiBase() {
  const { apiBase } = await chrome.storage.local.get("apiBase");
  return (apiBase && apiBase.trim().replace(/\/$/, "")) || DEFAULT_API;
}
async function setApiBase(v) {
  await chrome.storage.local.set({ apiBase: (v || "").trim().replace(/\/$/, "") || DEFAULT_API });
}

function fmtTime(mins) {
  if (mins == null || isNaN(mins)) return "—";
  mins = Math.max(0, Math.floor(mins));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

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
  // broadcast to background so overlay picks it up
  try { chrome.runtime.sendMessage({ type: "DX_SESSION_UPDATED" }); } catch {}
}

async function clearSession() {
  await chrome.storage.local.remove([
    "userId","userName","userEmail","userPlan","creditsLeft","accessToken","refreshToken","loggedInAt",
  ]);
  try { chrome.runtime.sendMessage({ type: "DX_SESSION_CLEARED" }); } catch {}
}

function renderStatus(user, serverUrl) {
  $("view-login").classList.add("hidden");
  $("view-status").classList.remove("hidden");
  $("s-name").textContent = user.name || user.email || "User";
  $("s-email").textContent = user.email || "";
  const plan = (user.plan || "basic").toLowerCase();
  const isUnlimited = UNLIMITED.has(plan);
  $("s-plan").textContent = plan;

  const credits = Number(user.creditsLeft ?? 0);
  $("s-credits").textContent = isUnlimited ? "∞" : credits.toLocaleString();
  $("s-time").textContent = isUnlimited ? "Unlimited" : fmtTime(credits);

  const total = Number(user.creditsTotal || credits || 1);
  const pct = isUnlimited ? 100 : Math.max(0, Math.min(100, (credits / Math.max(total, credits, 1)) * 100));
  $("s-bar").style.width = pct + "%";

  const alertEl = $("s-alert");
  const upgrade = $("s-upgrade");
  const planBadge = $("s-plan");
  planBadge.classList.remove("warn","danger","ok");
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
    alertEl.textContent = `Low balance — only ${fmtTime(credits)} left.`;
    upgrade.classList.remove("hidden");
  }
}

async function refreshLive() {
  const store = await chrome.storage.local.get(["userId","userEmail","userName","userPlan"]);
  if (!store.userId) return;
  try {
    const { data } = await fetchStatus(store.userId);
    if (data?.user) {
      await chrome.storage.local.set({
        creditsLeft: data.user.creditsLeft,
        userPlan: data.user.plan,
      });
      renderStatus(data.user, await getApiBase());
    }
  } catch { /* offline; keep cached */ }
}

async function init() {
  const base = await getApiBase();
  $("api-base").value = base;

  const store = await chrome.storage.local.get(["userId","userEmail","userName","userPlan","creditsLeft"]);
  if (store.userId) {
    renderStatus({
      id: store.userId, name: store.userName, email: store.userEmail,
      plan: store.userPlan, creditsLeft: store.creditsLeft,
    }, base);
    refreshLive();
    setInterval(refreshLive, 10000);
  }

  $("login-btn").addEventListener("click", async () => {
    const btn = $("login-btn"); const errEl = $("login-err");
    errEl.textContent = "";
    const email = $("email").value.trim();
    const password = $("password").value;
    const apiBase = $("api-base").value.trim();
    if (!email || !password) { errEl.textContent = "Enter email and password"; return; }
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      await setApiBase(apiBase);
      const payload = await login(email, password);
      await saveSession(payload);
      renderStatus(payload.user, await getApiBase());
      refreshLive();
      setInterval(refreshLive, 10000);
    } catch (e) {
      errEl.textContent = e.message || "Login failed";
    } finally {
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    await clearSession();
    $("view-status").classList.add("hidden");
    $("view-login").classList.remove("hidden");
  });

  $("open-flow").addEventListener("click", () => {
    chrome.tabs.create({ url: FLOW_URL });
  });

  $("inject-flow").addEventListener("click", injectAndOpenFlow);
}

const GOOGLE_DOMAINS = [".google.com", ".youtube.com", "accounts.google.com", "labs.google"];

function setStatus(msg, color) {
  const el = $("inject-status");
  el.textContent = msg || "";
  el.style.color = color || "#9ba3b4";
}

async function clearGoogleCookies() {
  const domains = ["google.com", "youtube.com", "labs.google", "accounts.google.com"];
  for (const d of domains) {
    try {
      const all = await chrome.cookies.getAll({ domain: d });
      for (const c of all) {
        const proto = c.secure ? "https://" : "http://";
        const host = c.domain.replace(/^\./, "");
        await chrome.cookies.remove({ url: `${proto}${host}${c.path}`, name: c.name, storeId: c.storeId });
      }
    } catch (e) { /* ignore */ }
  }
}

async function setCookie(c) {
  const domain = c.domain || ".google.com";
  const host = domain.replace(/^\./, "");
  const path = c.path || "/";
  const url = `https://${host}${path}`;
  const details = {
    url,
    name: c.name,
    value: String(c.value ?? ""),
    path,
    secure: c.secure !== false,
    httpOnly: !!c.httpOnly,
  };
  if (domain.startsWith(".")) details.domain = domain;
  if (c.sameSite) {
    const s = String(c.sameSite).toLowerCase();
    details.sameSite = s === "no_restriction" || s === "none" ? "no_restriction"
      : s === "lax" ? "lax" : s === "strict" ? "strict" : "unspecified";
  }
  if (c.expirationDate && !c.session) details.expirationDate = Number(c.expirationDate);
  try { await chrome.cookies.set(details); return true; } catch { return false; }
}

async function injectAndOpenFlow() {
  const btn = $("inject-flow");
  btn.disabled = true;
  setStatus("Verifying account…");
  try {
    const store = await chrome.storage.local.get(["userId"]);
    if (!store.userId) throw new Error("Please sign in first.");

    const { status, data } = await fetchStatus(store.userId);
    if (status === 402 || data?.blocked || data?.disabled) {
      setStatus("🚫 Credits exhausted — buy more via WhatsApp 01410014442", "#f87171");
      $("s-upgrade").classList.remove("hidden");
      btn.disabled = false;
      return;
    }
    if (!data?.valid || !Array.isArray(data.cookies) || data.cookies.length === 0) {
      throw new Error(data?.message || "No live session cookies found. Click Fetch Live in admin panel, then try again.");
    }

    const plan = (data.user?.plan || "basic").toLowerCase();
    const credits = Number(data.user?.creditsLeft ?? 0);
    if (!UNLIMITED.has(plan) && credits <= 0) {
      setStatus("🚫 Credits exhausted — buy more via WhatsApp 01410014442", "#f87171");
      $("s-upgrade").classList.remove("hidden");
      btn.disabled = false;
      return;
    }

    setStatus("Clearing old session…");
    await clearGoogleCookies();

    setStatus(`Injecting ${data.cookies.length} cookies…`);
    let ok = 0;
    for (const c of data.cookies) if (await setCookie(c)) ok++;

    setStatus(`✅ Injected ${ok}/${data.cookies.length} — opening Flow…`, "#34d399");
    await chrome.storage.local.set({ creditsLeft: data.user?.creditsLeft, userPlan: data.user?.plan });
    setTimeout(() => chrome.tabs.create({ url: FLOW_URL }), 500);
  } catch (e) {
    setStatus("❌ " + (e.message || "Injection failed"), "#f87171");
  } finally {
    btn.disabled = false;
  }
}

init();
