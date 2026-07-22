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