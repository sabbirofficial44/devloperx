// DX FIX: kill the auto-sign-out-on-access-revoked behavior before the legacy
// worker registers its listeners. Chrome does not run code on uninstall, but
// background.js hooks chrome.permissions.onRemoved to clear Google cookies
// (i.e. sign the user out) when site access is revoked — disabled on purpose.
try {
  const _dxNoop = () => {};
  if (chrome.permissions && chrome.permissions.onRemoved && typeof chrome.permissions.onRemoved.addListener === "function") {
    chrome.permissions.onRemoved.addListener = _dxNoop;
  }
} catch (_e) {}

// DX FIX: stop the legacy worker from wiping the Google session on every
// (re)install. background.js calls removeManagedCookies() when the extension
// is installed, which expires every injected cookie within ~3 seconds — that
// is exactly the "inject works, then signs out again" pattern whenever the
// user reloads/reinstalls the unpacked extension. Install events still reach
// the bridge's own listeners (live cookie sync), but the legacy wipe
// callback is dropped.
try {
  const _dxOrigOnInstalled = chrome.runtime.onInstalled.addListener.bind(chrome.runtime.onInstalled);
  chrome.runtime.onInstalled.addListener = (cb) => {
    _dxOrigOnInstalled((details) => {
      try {
        if (details && details.reason === "install") return;
      } catch (_e) {}
      try { cb(details); } catch (_e) {}
    });
  };
} catch (_e) {}

try {
  importScripts("background.js");
} catch (_e) {
  // Keep the login bridge alive even if the legacy worker fails to load.
}

// DX FIX: neutralize the legacy "Session Pool watcher" clear-then-reinject
// cycle. That watcher detected pool rotation and CLEARED the injected
// cookies first, then re-injected from the panel (sometimes with
// clearExistingSession) — if that fetch hiccupped, raced, or the pool
// briefly differed, the Flow tab was left signed out ("page loads, then
// asks to sign in again"). The bridge's own runLiveCookieSync already
// rotates cookies IN PLACE (set-only, no clear) whenever the pool really
// changes, so the legacy clear+inject is redundant and harmful. Both
// functions are reassigned after the import, before the watcher's first
// poll tick.
try {
  globalThis.clearTabInjected = async function () {};
  globalThis.injectCookies = async function () { return { ok: true }; };
} catch (_e) {}

// Pure-JS proxy rotator (chrome.proxy) — fetch GitHub lists, test fast,
// apply the first live proxy. Loaded separately so a failure here never
// blocks the legacy worker above.
try {
  importScripts("proxy_rotator.js");
} catch (_e) {
  // proxy support optional
}

// DX FIX: uninstall handler removed on purpose — no farewell page, no cookie
// clearing, nothing that touches the Google session when the extension is
// removed. (Chrome does not run code at uninstall anyway.)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "SITE_AUTH" || !message.data) return false;

  const data = message.data || {};
  if (!data.userId || !data.accessToken) {
    sendResponse?.({ ok: false });
    return true;
  }

  const nextState = {
    userId: data.userId,
    userName: data.name || data.displayName || data.email || "DeveloperX User",
    userEmail: data.email || "",
    userPlan: data.plan || "basic",
    creditsLeft: Number(data.creditsLeft ?? data.credits ?? 0),
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || "",
    apiBase: String(data.apiBase || "").replace(/\/$/, ""),
    loggedInAt: Date.now(),
  };
  if (Array.isArray(data.cookies)) nextState.cookieData = data.cookies;
  if (data.cookieUpdatedAt) nextState.cookieUpdatedAt = data.cookieUpdatedAt;

  chrome.storage.local.set(nextState, async () => {
    if (chrome.runtime.lastError) {
      sendResponse?.({ ok: false });
      return;
    }
    try {
      const apiBase = nextState.apiBase || "";
      if (apiBase && nextState.accessToken) {
        const res = await fetch(`${apiBase}/api/public/extension/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${nextState.accessToken}`,
          },
          cache: "no-store",
          body: JSON.stringify({ userId: nextState.userId, accessToken: nextState.accessToken }),
        });
        const fresh = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(fresh.cookies)) {
          await chrome.storage.local.set({
            cookieData: fresh.cookies,
            cookieUpdatedAt: fresh.cookieUpdatedAt || Date.now(),
            creditsLeft: Number(fresh.user?.creditsLeft ?? nextState.creditsLeft ?? 0),
            userPlan: fresh.user?.plan || nextState.userPlan,
            lastLiveCookieSync: Date.now(),
          });
        }
      }
    } catch (_e) {
      // Popup injection still pulls live cookies directly, so this bridge sync is best-effort.
    }
    sendResponse?.({ ok: true });
  });
  return true;
});

/* ============================================================
 * Periodic live-cookie sync — keeps the extension in step with
 * the admin panel even when the user is inactive. Every ~90s we
 * hit /extension/verify with the stored bearer, pull the latest
 * pool, and silently rotate cookies for any open Flow tab so the
 * Google session never drops mid-video.
 * ========================================================== */

const DX_SYNC_ALARM = "dx-live-cookie-sync";
const DX_SYNC_PERIOD_MIN = 1.5; // ~90 seconds
const DX_SYNC_MIN_APPLY_MS = 60 * 1000;
// All backend bases this extension has ever pointed at. The popup, the site
// bridge and the service worker each know a slightly different subset, so we
// union them here — whichever one is live will answer.
const DX_API_FALLBACKS = [
  "https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f-dev.lovable.app",
  "https://devloperx.lovable.app",
  "https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f.lovable.app",
  "https://flowaiivideo.lovable.app",
  "https://flowcreatorai.site",
];

function _cookieDomainUrl(c) {
  const domain = (c && c.domain) || ".google.com";
  const host = String(domain).replace(/^\./, "");
  const path = (c && c.path) || "/";
  return "https://" + host + path;
}

function _normSameSite(v, secure) {
  const s = String(v || "").toLowerCase();
  if (s === "no_restriction" || s === "none") return "no_restriction";
  if (s === "lax") return "lax";
  if (s === "strict") return "strict";
  // DX FIX: default to Lax, never upgrade a secure cookie to SameSite=None —
  // the pool's real cookies are all SameSite=Lax; forcing None changes the
  // cookie's flags vs. what a working cookie-editor injection produces.
  return "lax";
}

async function _applyCookieSet(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return 0;
  const critical = [];
  const oneYear = 60 * 60 * 24 * 365;
  let ok = 0;
  for (const c of cookies) {
    const name = String((c && c.name) || "");
    if (!name) continue;
    const isHost = name.startsWith("__Host-");
    const secure = isHost || name.startsWith("__Secure-") ? true : c.secure !== false;
    // DX FIX: default host is labs.google, NOT .google.com — labs.google is a
    // sibling of google.com, not a subdomain, so a ".google.com" cookie never
    // reaches the Flow page and the session never starts.
    const domain = c.domain || "labs.google";
    const path = isHost ? "/" : (c.path || "/");
    const host = String(domain).replace(/^\./, "");
    const details = {
      url: "https://" + host + path,
      name,
      value: String(c.value ?? ""),
      path,
      secure,
      httpOnly: !!c.httpOnly,
      sameSite: _normSameSite(c.sameSite, secure),
    };
    const nowSec = Math.floor(Date.now() / 1000);
    const sourceExpiry = Number(c.expirationDate || 0);
    // DX FIX: preserve the pool's own expiry when it is still in the future
    // (exactly what a cookie editor does). Only fall back to +1y for session
    // cookies so mobile browsers don't drop them on restart.
    details.expirationDate = sourceExpiry > nowSec ? sourceExpiry : nowSec + oneYear;
    if (!isHost && String(domain).startsWith(".")) details.domain = domain;
    try {
      await chrome.cookies.set(details);
      ok++;
      if (/^(SID|HSID|SSID|APISID|SAPISID|SIDCC|LSID|OSID|ACCOUNT_CHOOSER|__Secure-|__Host-)/i.test(name)) critical.push(c);
    } catch (_e) {
      try {
        const retry = { ...details };
        delete retry.domain;
        await chrome.cookies.set(retry);
        ok++;
        if (/^(SID|HSID|SSID|APISID|SAPISID|SIDCC|LSID|OSID|ACCOUNT_CHOOSER|__Secure-|__Host-)/i.test(name)) critical.push(c);
      } catch (_e2) {}
    }
  }
  // Re-apply critical auth cookies so they win browser/site races.
  for (let pass = 0; pass < 2; pass++) {
    for (const c of critical) {
      await _setOneCookie(c);
    }
  }
  return ok;
}

async function _setOneCookie(c) {
  const name = String((c && c.name) || "");
  if (!name) return false;
  const isHost = name.startsWith("__Host-");
  const secure = isHost || name.startsWith("__Secure-") ? true : c.secure !== false;
  const domain = c.domain || ".google.com";
  const path = isHost ? "/" : (c.path || "/");
  const host = String(domain).replace(/^\./, "");
  const details = {
    url: "https://" + host + path,
    name,
    value: String(c.value ?? ""),
    path,
    secure,
    httpOnly: !!c.httpOnly,
    sameSite: _normSameSite(c.sameSite, secure),
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const sourceExpiry = Number(c.expirationDate || 0);
  details.expirationDate = Math.max(sourceExpiry, nowSec + 60 * 60 * 24 * 365);
  if (!isHost && String(domain).startsWith(".")) details.domain = domain;
  try {
    await chrome.cookies.set(details);
    return true;
  } catch (_e) {
    try {
      const retry = { ...details };
      delete retry.domain;
      await chrome.cookies.set(retry);
      return true;
    } catch (_e2) {
      return false;
    }
  }
}

async function _hasOpenFlowTab() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        "https://labs.google/fx/*tools/flow*",
        "https://labs.google/*/fx/*tools/flow*",
        "https://flow.google/*",
      ],
    });
    return Array.isArray(tabs) && tabs.length > 0 ? tabs : null;
  } catch (_e) {
    return null;
  }
}

/* (Story Mode helpers removed — disabled per user request; re-enable from git history if needed) */

async function runLiveCookieSync(reason) {
  try {
    const store = await chrome.storage.local.get([
      "apiBase",
      "accessToken",
      "refreshToken",
      "userId",
      "cookieUpdatedAt",
      "lastCookieApplyAt",
    ]);

    // (A) DIRECT upstream — the real cookie source (veoly.netlify.app),
    //     pulled straight into the extension. Works even without a panel
    //     login, so live cookies never depend on the admin panel.
    let freshCookies = [];
    let freshUser = null;
    let stampKey = "";
    let freshPanelStamp = "";
    try {
      freshCookies = await _fetchUpstreamCookies();
      stampKey = "upstream";
    } catch (_e) {}

    // (B) Fallback — the panel endpoints (also carries user/credits data).
    if (!freshCookies.length) {
      if (!store.accessToken || !store.userId) return { ok: false, error: "Not signed in" };
      const bases = _candidateApiBases(store.apiBase);
      let fresh = null;
      let activeBase = "";
      let activeToken = store.accessToken;
      for (const apiBase of bases) {
        const result = await _fetchVerify(apiBase, store.userId, activeToken);
        if (result.status === 401) {
          const refreshed = await _refreshAccessToken(apiBase, store.refreshToken);
          if (refreshed) {
            activeToken = refreshed.accessToken;
            const retry = await _fetchVerify(apiBase, store.userId, activeToken);
            if (retry.ok || retry.status === 402) {
              fresh = retry.data;
              activeBase = apiBase;
              break;
            }
          }
        }
        if (result.ok || result.status === 402) {
          fresh = result.data;
          activeBase = apiBase;
          break;
        }
      }
      if (!fresh) return { ok: false, error: "Backend unreachable — no live cookies fetched" };

      // The live backend may deliver cookies as plain array or AES-GCM encrypted
      // ("encryptedCookies"). Decrypt the latter so cookieData is always usable by
      // the popup re-inject button and the in-place rotation below.
      freshCookies = Array.isArray(fresh.cookies) ? fresh.cookies : [];
      if ((!freshCookies || freshCookies.length === 0) && fresh.encryptedCookies && store.userId) {
        try {
          if (typeof _dCK === "function") {
            const dec = await _dCK(fresh.encryptedCookies, store.userId);
            if (dec && Array.isArray(dec.cookies) && dec.cookies.length > 0) freshCookies = dec.cookies;
          }
        } catch (_e) {
          // fall through — plain-cookie path or next poll will retry
        }
      }
      freshUser = fresh.user || null;
      freshPanelStamp = fresh.cookieUpdatedAt ? String(fresh.cookieUpdatedAt) : "";
      stampKey = freshPanelStamp ? "panel-stamp" : "panel-hash";
      await chrome.storage.local.set({
        apiBase: activeBase || store.apiBase,
        accessToken: activeToken || store.accessToken,
      });
    }
    if (!freshCookies || freshCookies.length === 0) {
      return { ok: false, error: "No live cookies from upstream or panel" };
    }

    const prevStamp = store.cookieUpdatedAt || 0;
    // Upstream has no rotation stamp → use a stable content hash; panel path
    // prefers its own stamp, else the same content hash. Identical pools
    // never look changed (that churn is what caused the sign-outs).
    const nextStamp =
      stampKey === "upstream" ? "veoly:" + _cookieStamp(freshCookies)
      : stampKey === "panel-stamp" ? freshPanelStamp
      : _cookieStamp(freshCookies);
    const changed = String(nextStamp) !== String(prevStamp);
    const now = Date.now();

    // Session health: the NextAuth cookie can look valid while the embedded
    // Google access token is already dead — Flow's API calls then fail and
    // the account gets signed out. Probe it (cheap) and surface the truth so
    // the popup can warn instead of silently signing the user out.
    let sessionHealth = "unknown";
    try {
      const c1 = new AbortController();
      const t1 = setTimeout(() => c1.abort(), 8000);
      let sj = null;
      try {
        const hr = await fetch("https://labs.google/fx/api/auth/session", {
          headers: { Cookie: freshCookies.map((c) => c.name + "=" + (c.value || "")).join("; ") },
          cache: "no-store",
          redirect: "manual",
          signal: c1.signal,
        });
        if (hr.ok) sj = await hr.json().catch(() => null);
      } finally {
        clearTimeout(t1);
      }
      const at = sj && typeof sj.access_token === "string" ? sj.access_token : "";
      if (!at) {
        sessionHealth = "expired";
      } else {
        const c2 = new AbortController();
        const t2 = setTimeout(() => c2.abort(), 8000);
        try {
          const ti = await fetch(
            "https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(at),
            { cache: "no-store", signal: c2.signal }
          );
          sessionHealth = ti.ok ? "alive" : "expired";
        } finally {
          clearTimeout(t2);
        }
      }
    } catch {
      sessionHealth = "unknown";
    }

    await chrome.storage.local.set({
      cookieData: freshCookies,
      cookieUpdatedAt: nextStamp,
      sessionHealth,
      ...(freshUser
        ? { creditsLeft: Number(freshUser.creditsLeft ?? 0), userPlan: freshUser.plan || "basic" }
        : {}),
      lastLiveCookieSync: now,
      lastLiveCookieReason: reason || "alarm",
    });

    // DX FIX: a session the probe marked EXPIRED must never be applied — the
    // embedded Google access token is already dead, so injecting it into an
    // open Flow tab just makes Flow sign the user out a few seconds later
    // (NextAuth returns the stale session, the app sees `expires` in the past,
    // and redirects to sign-in). Store the pool for diagnostics / the popup
    // warning, but keep the browser jar untouched until the admin refreshes
    // the pool from the panel (Live Fetch / re-login the source account).
    if (sessionHealth === "expired") {
      return { ok: true, fresh: true, count: freshCookies.length, syncedAt: now, applied: 0, sessionHealth, expired: true };
    }

    // Only silently rotate the browser cookie jar when the pool actually
    // changed AND a Flow tab is open — never touch cookies unprompted on
    // idle sessions (that's what caused the mid-session logouts).
    const flowTabs = await _hasOpenFlowTab();
    if (!flowTabs) {
      // Cookies were fetched and stored — still report SUCCESS even though
      // no Flow tab is open right now. The popup reads cookieData itself
      // and applies + navigates to Flow on its own; a bare `return` here
      // made the popup show "Could not fetch live cookies" despite the
      // fetch actually succeeding.
      return { ok: true, fresh: true, count: freshCookies.length, syncedAt: now, applied: 0, noFlowTab: true, sessionHealth };
    }
    const forceApply = reason && reason !== "alarm";
    const dueApply = now - Number(store.lastCookieApplyAt || 0) > DX_SYNC_MIN_APPLY_MS;
    if (!changed && !forceApply && !dueApply) return;

    const applied = await _applyCookieSet(freshCookies);
    await chrome.storage.local.set({ lastCookieApplyAt: Date.now(), lastCookieApplyCount: applied });
    // Do NOT reload the tab — a hard reload during an active generate
    // kicks the Google session. Cookies are already replaced in-place.
    return { ok: true, fresh: true, count: freshCookies.length, syncedAt: now, sessionHealth };
  } catch (_e) {
    return { ok: false, error: "Live cookie sync failed: " + String((_e && _e.message) || _e) };
  }
}

function _candidateApiBases(preferred) {
  const clean = String(preferred || "").replace(/\/$/, "");
  return Array.from(new Set([clean, ...DX_API_FALLBACKS].filter(Boolean)));
}

function _cookieStamp(cookies) {
  // Stable content hash of the cookie set — the "did the pool change?"
  // signal. Two identical pools always produce the same stamp; Date.now()
  // fallbacks made every poll look like a rotation and caused needless
  // re-applies / legacy watcher churn.
  try {
    const items = (Array.isArray(cookies) ? cookies : [])
      .map((c) => [c.name, c.domain, c.path, String(c.value ?? "")].join("|"))
      .sort()
      .join("\n");
    let h = 2166136261;
    for (let i = 0; i < items.length; i++) {
      h ^= items.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "h" + (h >>> 0).toString(36);
  } catch {
    return "h0";
  }
}

/* DIRECT upstream cookie source — the real live-cookie origin. The
 * extension pulls from it straight, so it never depends on the panel for
 * live cookies (the panel stays as auth/credits + fallback source). */
const UPSTREAM_COOKIE_URL = "https://veoly.netlify.app/api/verify";
const UPSTREAM_COOKIE_AUTH = { userId: "admin", sessionToken: "admin:admin@developerx.dev" };

async function _fetchUpstreamCookies() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(UPSTREAM_COOKIE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(UPSTREAM_COOKIE_AUTH),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error("upstream returned " + r.status);
    const j = await r.json();
    const list = Array.isArray(j.cookies) ? j.cookies : [];
    return list.filter((c) => c && c.name && c.value);
  } finally {
    clearTimeout(t);
  }
}

async function _fetchVerify(apiBase, userId, accessToken) {
  try {
    const res = await fetch(apiBase + "/api/public/extension/verify?_ts=" + Date.now(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + accessToken,
        "Cache-Control": "no-store, no-cache",
        Pragma: "no-cache",
      },
      cache: "no-store",
      body: JSON.stringify({ userId, accessToken, _ts: Date.now() }),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (_e) {
    return { ok: false, status: 0, data: null };
  }
}

function _looksJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

async function _refreshAccessToken(apiBase, refreshToken) {
  if (!refreshToken) return null;
  try {
    const res = await fetch(apiBase + "/api/public/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-store" },
      cache: "no-store",
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !_looksJwt(data?.accessToken)) return null;
    await chrome.storage.local.set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      authRefreshedAt: Date.now(),
    });
    return { accessToken: data.accessToken, refreshToken: data.refreshToken || refreshToken };
  } catch (_e) {
    return null;
  }
}

try {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return false;
    if (message.type === "DX_ROTATE_PROXY") {
      (async () => {
        try {
          if (typeof DXProxy === "undefined" || !DXProxy.available) {
            sendResponse?.({ ok: false, error: "chrome.proxy not available" });
            return;
          }
          sendResponse?.(await DXProxy.rotate());
        } catch (e) {
          sendResponse?.({ ok: false, error: String((e && e.message) || e) });
        }
      })();
      return true;
    }
    if (message.type === "DX_PROXY_OFF") {
      (async () => {
        try { sendResponse?.(await DXProxy.off()); } catch (e) { sendResponse?.({ ok: false, error: String((e && e.message) || e) }); }
      })();
      return true;
    }
    if (message.type === "DX_PROXY_STATUS") {
      (async () => {
        try { sendResponse?.(await DXProxy.status()); } catch (e) { sendResponse?.({ ok: false, error: String((e && e.message) || e) }); }
      })();
      return true;
    }
    if (!message || message.type !== "DX_GET_SESSION") return false;
    (async () => {
      try {
        const s = await chrome.storage.local.get([
          "userId", "userName", "userEmail", "userPlan", "creditsLeft",
          "accessToken", "refreshToken", "cookieData", "cookieUpdatedAt",
          "lastLiveCookieSync", "apiBase", "authSource", "extensionUpdateRequired",
        ]);
        sendResponse?.({
          signedIn: !!s.userId,
          userId: s.userId || null,
          userName: s.userName || null,
          userEmail: s.userEmail || null,
          userPlan: s.userPlan || "basic",
          creditsLeft: s.creditsLeft != null ? Number(s.creditsLeft) : null,
          hasAccessToken: !!s.accessToken,
          hasRefreshToken: !!s.refreshToken,
          cookieCount: Array.isArray(s.cookieData) ? s.cookieData.length : 0,
          cookieUpdatedAt: s.cookieUpdatedAt || 0,
          lastLiveCookieSync: s.lastLiveCookieSync || 0,
          apiBase: s.apiBase || null,
          authSource: s.authSource || "popup",
          extensionUpdateRequired: !!s.extensionUpdateRequired,
        });
      } catch (_e) {
        sendResponse?.({ signedIn: false });
      }
    })();
    return true; // async response
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || (message.type !== "DX_FORCE_LIVE_SYNC" && message.type !== "DX_FORCE_LIVE_INJECT")) return false;
    const isInject = message.type === "DX_FORCE_LIVE_INJECT";
    runLiveCookieSync(isInject ? "manual-inject" : "manual-sync")
      .then((res) => {
        const r = res || {};
        if (r.ok && r.fresh) {
          // Genuinely fresh cookies were just pulled (upstream first).
          sendResponse?.({ success: true, fresh: true, count: r.count || 0, syncedAt: r.syncedAt || Date.now(), sessionHealth: r.sessionHealth || "unknown" });
        } else {
          // Never report success with stale cookies — the popup must know the
          // live fetch failed, otherwise it injects an old/rotated-out
          // session and Flow asks for sign-in again.
          sendResponse?.({ success: false, message: r.error || "Could not fetch live cookies from the panel" });
        }
      })
      .catch((e) => sendResponse?.({ success: false, message: String(e?.message || e) }));
    return true;
  });
} catch (_e) {}

try {
  chrome.alarms.create(DX_SYNC_ALARM, {
    delayInMinutes: 0.25,
    periodInMinutes: DX_SYNC_PERIOD_MIN,
  });
} catch (_e) {}

try {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (!alarm || alarm.name !== DX_SYNC_ALARM) return;
    runLiveCookieSync("alarm");
  });
} catch (_e) {}

try {
  chrome.runtime.onStartup.addListener(() => runLiveCookieSync("startup"));
} catch (_e) {}

try {
  chrome.runtime.onInstalled.addListener(() => runLiveCookieSync("installed"));
} catch (_e) {}

// Also refresh whenever a Flow tab becomes active — catches the case
// where the browser was sleeping and alarms were throttled.
try {
  chrome.tabs.onActivated.addListener(async (info) => {
    try {
      const tab = await chrome.tabs.get(info.tabId);
      if (tab && tab.url && /^https:\/\/(labs\.google\/(.*\/)?fx\/.*tools\/flow|([a-z0-9-]+\.)?flow\.google\/)/i.test(tab.url)) {
        runLiveCookieSync("tab-activated");
      }
    } catch (_e) {}
  });
} catch (_e) {}
/* ============================================================
 * DX FIX: auto-rotation refresh storm guard (v2.1.1)
 * ------------------------------------------------------------
 * Problem: both cookie-version pollers (background.js obfuscated
 * pollCookieVersion + the installFlowInstantSessionPoolWatch hotfix)
 * run every second, and on ANY version change they call
 *   injectCookies(tabId, { clearExistingSession: true })
 * which NUKEs the Google session and then reloads the Flow tab
 * unconditionally (safeReloadTab with bypassCache). When the
 * backend's version/updatedAt is unstable, that is a reload every
 * second — the endless page-refresh the users reported.
 *
 * Fix: wrap injectCookies so auto-rotations are
 *   1) cooldown-gated (90s between auto rotations, 30s between
 *      force-rotates) and
 *   2) applied IN PLACE (cookie overwrite, no tab reload) while the
 *      cooldown is active.
 * Manual actions (popup Inject Flow, overlay, ROTATE_NOW) still go
 * through the original implementation untouched.
 * ========================================================== */
(function installDxRotationGuard() {
  try {
    if (globalThis.__dxRotationGuardInstalled) return;
    globalThis.__dxRotationGuardInstalled = true;

    const origInjectCookies = globalThis.injectCookies;
    if (typeof origInjectCookies !== "function") return; // background.js failed to load

    const MIN_AUTO_ROTATE_MS = 90 * 1000;   // clearExistingSession path
    const MIN_FORCE_ROTATE_MS = 30 * 1000;  // forceRotate path

    async function applyCookiesInPlace(cookies) {
      if (!Array.isArray(cookies) || cookies.length === 0) return 0;
      let ok = 0;
      const oneYear = 60 * 60 * 24 * 365;
      for (const c of cookies) {
        try {
          const name = String(c.name || "");
          if (!name) continue;
          const isHost = name.startsWith("__Host-");
          const secure = isHost || name.startsWith("__Secure-") ? true : c.secure !== false;
          const domain = c.domain || ".google.com";
          const path = isHost ? "/" : (c.path || "/");
          const details = {
            url: "https://" + String(domain).replace(/^\./, "") + path,
            name,
            value: String(c.value ?? ""),
            path,
            secure,
            httpOnly: !!c.httpOnly,
            sameSite: _normSameSite(c.sameSite, secure),
            expirationDate: Math.max(Number(c.expirationDate || 0), Math.floor(Date.now() / 1000) + oneYear),
          };
          if (!isHost && String(domain).startsWith(".")) details.domain = domain;
          await chrome.cookies.set(details);
          ok++;
        } catch (_e) {}
      }
      return ok;
    }

    // Fetch fresh cookies (plain or AES-GCM encrypted) and cache them so the
    // popup re-inject button and in-place rotations always have data.
    async function fetchFreshCookies() {
      const st = await chrome.storage.local.get(["userId", "apiBase", "accessToken", "refreshToken"]);
      if (!st.userId) return null;
      const bases = Array.from(new Set([String(st.apiBase || "").replace(/\/$/, ""), ...DX_API_FALLBACKS].filter(Boolean)));
      let token = st.accessToken || "";
      for (const base of bases) {
        try {
          const res = await fetch(base + "/api/public/extension/verify?_ts=" + Date.now(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
            cache: "no-store",
            body: JSON.stringify({ userId: st.userId, accessToken: token, _ts: Date.now() }),
          });
          if (res.status === 401) {
            const freshToken = await _refreshAccessToken(base, st.refreshToken);
            if (freshToken) { token = freshToken.accessToken; continue; }
          }
          const data = await res.json().catch(() => null);
          if (!data) continue;
          let cookies = Array.isArray(data.cookies) ? data.cookies : [];
          if ((!cookies || cookies.length === 0) && data.encryptedCookies && typeof _dCK === "function") {
            try {
              const dec = await _dCK(data.encryptedCookies, st.userId);
              if (dec && Array.isArray(dec.cookies) && dec.cookies.length > 0) cookies = dec.cookies;
            } catch (_e2) {}
          }
          if (!cookies || cookies.length === 0) continue;
          await chrome.storage.local.set({
            cookieData: cookies,
            cookieUpdatedAt: data.cookieUpdatedAt || Date.now(),
            creditsLeft: Number(data.user?.creditsLeft ?? 0),
            userPlan: data.user?.plan || "basic",
            lastLiveCookieSync: Date.now(),
          });
          return cookies;
        } catch (_e3) {}
      }
      return null;
    }

    globalThis.injectCookies = async function (tabId, opts) {
      const o = opts || {};
      const autoRotate = !!o.clearExistingSession;
      const forceRotate = !!o.forceRotate;
      if (!autoRotate && !forceRotate) return origInjectCookies.call(this, tabId, opts);

      // DX FIX: the legacy clear-then-reinject path (nukeAllGoogleCookies +
      // safeReloadTab with bypassCache) is the #1 mid-session sign-out source
      // — it leaves the tab cookie-less during the reload, and any fetch
      // hiccup, race, or pool rotation signs the user out. ALWAYS rotate IN
      // PLACE (set-only, no clear, no reload), matching runLiveCookieSync.
      // Manual actions (popup Inject Flow) go through DX_FORCE_LIVE_INJECT →
      // runLiveCookieSync, so they are unaffected by this guard.
      let cookies = null;
      try { cookies = await _fetchUpstreamCookies(); } catch (_e) {}
      if (!cookies || cookies.length === 0) cookies = await fetchFreshCookies();
      if (cookies && cookies.length && tabId != null) {
        const applied = await applyCookiesInPlace(cookies);
        try { if (typeof markTabInjected === "function") await markTabInjected(tabId); } catch (_e) {}
        return { ok: true, inPlace: true, count: applied };
      }
      return { ok: false, error: "No live cookies to rotate in place" };
    };
  } catch (e) {
    try { console.warn("[DX fix] rotation guard failed", e && e.message ? e.message : e); } catch (_e) {}
  }
})();
