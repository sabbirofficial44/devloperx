try {
  importScripts("background.js");
} catch (_e) {
  // Keep the login bridge alive even if the legacy worker fails to load.
}

// Farewell page on uninstall. Chrome MV3 does not allow code to run at the
// moment of uninstall, but setUninstallURL is opened by the browser itself,
// so users always land on a friendly Lovable page (and NOT on a Google
// signed-out screen).
try {
  const _b64 = "aHR0cHM6Ly9kZXZsb3BlcngubG92YWJsZS5hcHAvZXh0ZW5zaW9uLXJlbW92ZWQ=";
  chrome.runtime.setUninstallURL(atob(_b64));
} catch (_e) {
  // ignore — non-fatal if the API is unavailable
}


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
  return secure ? "no_restriction" : "lax";
}

async function _applyCookieSet(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0) return 0;
  const oneYear = 60 * 60 * 24 * 365;
  let ok = 0;
  for (const c of cookies) {
    const name = String((c && c.name) || "");
    if (!name) continue;
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
      expirationDate: Math.max(
        Number(c.expirationDate || 0),
        Math.floor(Date.now() / 1000) + oneYear,
      ),
    };
    if (!isHost && String(domain).startsWith(".")) details.domain = domain;
    try {
      await chrome.cookies.set(details);
      ok++;
    } catch (_e) {
      try {
        const retry = { ...details };
        delete retry.domain;
        await chrome.cookies.set(retry);
        ok++;
      } catch (_e2) {}
    }
  }
  return ok;
}

async function _hasOpenFlowTab() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://labs.google/fx/tools/flow*" });
    return Array.isArray(tabs) && tabs.length > 0 ? tabs : null;
  } catch (_e) {
    return null;
  }
}

async function runLiveCookieSync(reason) {
  try {
    const store = await chrome.storage.local.get([
      "apiBase",
      "accessToken",
      "userId",
      "cookieUpdatedAt",
    ]);
    if (!store.accessToken || !store.userId) return;
    const apiBase = String(store.apiBase || "").replace(/\/$/, "");
    if (!apiBase) return;

    const res = await fetch(apiBase + "/api/public/extension/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + store.accessToken,
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      body: JSON.stringify({ userId: store.userId, accessToken: store.accessToken }),
    });

    if (!res.ok) return;
    const fresh = await res.json().catch(() => null);
    if (!fresh || !Array.isArray(fresh.cookies) || fresh.cookies.length === 0) return;

    const prevStamp = store.cookieUpdatedAt || 0;
    const nextStamp = fresh.cookieUpdatedAt || Date.now();
    const changed = String(nextStamp) !== String(prevStamp);

    await chrome.storage.local.set({
      cookieData: fresh.cookies,
      cookieUpdatedAt: nextStamp,
      creditsLeft: Number(fresh.user?.creditsLeft ?? 0),
      userPlan: fresh.user?.plan || "basic",
      lastLiveCookieSync: Date.now(),
      lastLiveCookieReason: reason || "alarm",
    });

    // Only silently rotate the browser cookie jar when the pool actually
    // changed AND a Flow tab is open — never touch cookies unprompted on
    // idle sessions (that's what caused the mid-session logouts).
    if (!changed) return;
    const flowTabs = await _hasOpenFlowTab();
    if (!flowTabs) return;

    await _applyCookieSet(fresh.cookies);
    // Do NOT reload the tab — a hard reload during an active generate
    // kicks the Google session. Cookies are already replaced in-place.
  } catch (_e) {
    // best-effort — retry on next alarm tick
  }
}

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
      if (tab && tab.url && /^https:\/\/labs\.google\/fx\/tools\/flow/i.test(tab.url)) {
        runLiveCookieSync("tab-activated");
      }
    } catch (_e) {}
  });
} catch (_e) {}