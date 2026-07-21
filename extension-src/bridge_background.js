try {
  importScripts("background.js");
} catch (_e) {
  // Keep the login bridge alive even if the legacy worker fails to load.
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

  chrome.storage.local.set(
    nextState,
    () => sendResponse?.({ ok: !chrome.runtime.lastError }),
  );
  return true;
});