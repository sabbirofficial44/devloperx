/* DeveloperX — pure-JS live proxy rotator (chrome.proxy, MV3)
 * ------------------------------------------------------------------
 * The user asked: fetch live proxies from GitHub in JS, test them FAST,
 * inject the FIRST live one, skip dead ones. No Python, no local server.
 *
 * chrome.proxy (MV3, "proxy" permission) applies the proxy to the whole
 * browser, so a successful google.com/generate_204 round-trip through it
 * proves the proxy is live and reaches Google — exactly what Flow needs.
 *
 * Exposed globally as:  window.DXProxy = { rotate, off, status, available }
 */
(function () {
  if (globalThis.__DX_PROXY_ROTATOR__) return;
  globalThis.__DX_PROXY_ROTATOR__ = true;

  // STRATIFIED sources (tested 2026-08-29): the small, frequently-updated
  // lists hold most of the live proxies (~50-60% hit rate on monosans); the
  // huge bulk lists are ~95% dead. Each source contributes a fixed quota so
  // the good ones are never drowned out.
  const GITHUB_SOURCES = [
    { url: "https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt", quota: 8 },
    { url: "https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt", quota: 4 },
    { url: "https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt", quota: 3 },
    { url: "https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt", quota: 3 },
    { url: "https://raw.githubusercontent.com/proxy4parsing/proxy-list/main/http.txt", quota: 4 },
  ];
  const TEST_URL = "https://www.google.com/generate_204"; // HTTPS tunnel + Google reachability
  const IP_URL = "https://api.ipify.org?format=json"; // CORS-enabled — real reachability check
  const TEST_TIMEOUT_MS = 5000; // per-proxy budget — dead proxies are skipped quickly
  const SETTLE_MS = 700;        // let the new proxy settle before testing

  const available = typeof chrome !== "undefined" && !!chrome.proxy && typeof chrome.proxy.settings !== "undefined";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function fetchText(url, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return "";
      return await r.text();
    } catch {
      clearTimeout(t);
      return "";
    }
  }

  /* Same normalization as proxy_checker.py: ipv4:port (+ scheme), http only. */
  function normalize(line) {
    line = String(line || "").trim();
    if (!line || line.startsWith("#")) return "";
    if (!line.includes("://")) line = "http://" + line;
    try {
      const u = new URL(line);
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname)) return "";
      if (u.username || u.password) return ""; // auth-required proxy → would pop Chrome's login dialog
      const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
      if (!(port >= 1 && port <= 65535)) return "";
      if (u.protocol.startsWith("socks")) return ""; // http only (most reliable for Flow)
      return line;
    } catch {
      return "";
    }
  }

  function setProxy(proxyUrl) {
    return new Promise((resolve) => {
      try {
        const u = new URL(proxyUrl);
        const cfg = {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: u.protocol.replace(":", ""),
              host: u.hostname,
              port: Number(u.port || (u.protocol === "https:" ? 443 : 80)),
            },
            bypassList: ["<local>", "127.0.0.1", "localhost", "::1"],
          },
        };
        chrome.proxy.settings.set({ value: cfg, scope: "regular" }, () => {
          resolve(!chrome.runtime.lastError);
        });
      } catch {
        resolve(false);
      }
    });
  }

  async function testProxy(proxyUrl) {
    const okSet = await setProxy(proxyUrl);
    if (!okSet) return null;
    await sleep(SETTLE_MS);
    // REAL validation through the proxy, CORS mode (no no-cors masking!):
    // api.ipify.org is CORS-enabled and must return JSON. A proxy that needs
    // username/password aborts the request (ERR_PROXY_AUTH_REQUESTED → the
    // fetch rejects → Chrome would show the login dialog), a dead proxy
    // times out. Either way the candidate is rejected.
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TEST_TIMEOUT_MS);
      let ip = null;
      try {
        const r = await fetch(IP_URL, { cache: "no-store", signal: ctrl.signal });
        if (r.ok) ip = (await r.json()).ip;
      } finally {
        clearTimeout(t);
      }
      if (!ip || typeof ip !== "string" || !ip.includes(".")) return null;
      // 2) HTTPS must ALSO reach Google (Flow is a Google service). Some
      //    proxies only do plain HTTP (no CONNECT tunnel) or are blocked
      //    from Google — those would break Flow pages → reject them.
      //    (No-cors is safe here: HTTPS always uses CONNECT, so an auth
      //    proxy fails the tunnel and the fetch rejects regardless.)
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), TEST_TIMEOUT_MS);
        try {
          await fetch(TEST_URL, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
        } finally {
          clearTimeout(t);
        }
      } catch {
        return null;
      }
      return { proxy: proxyUrl, ip };
    } catch {
      return null; // auth wall / dead proxy — skip
    }
  }

  async function rotate() {
    if (!available) return { ok: false, error: "chrome.proxy not available in this browser" };

    // Fetch all lists in parallel (short timeout each).
    const texts = await Promise.all(GITHUB_SOURCES.map((s) => fetchText(s.url, 12000)));
    // Stratified sampling: shuffle each source's own list, then take its
    // quota. Keeps the high-density fresh lists in every rotation.
    const pool = [];
    const seen = new Set();
    for (let i = 0; i < GITHUB_SOURCES.length; i++) {
      const src = GITHUB_SOURCES[i];
      const srcList = [];
      for (const line of String(texts[i] || "").split("\n")) {
        const norm = normalize(line);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          srcList.push(norm);
        }
      }
      for (let j = srcList.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [srcList[j], srcList[k]] = [srcList[k], srcList[j]];
      }
      for (const p of srcList.slice(0, src.quota)) pool.push(p);
    }
    if (!pool.length) return { ok: false, error: "no proxies fetched from GitHub" };

    for (const proxy of pool) {
      try {
        const res = await testProxy(proxy);
        if (res) {
          const info = { proxy: res.proxy, ip: res.ip, appliedAt: Date.now(), poolSize: candidates.length };
          try { await chrome.storage.local.set({ proxyInfo: info }); } catch {}
          return { ok: true, on: true, ...info };
        }
      } catch {
        /* next candidate */
      }
    }
    // Never leave the browser pointed at the last failed candidate — that
    // breaks the internet / pops proxy login dialogs. Reset to direct.
    await off();
    return { ok: false, error: "no live proxy found among " + pool.length + " tested" };
  }

  function off() {
    return new Promise((resolve) => {
      try {
        chrome.proxy.settings.clear({ scope: "regular" }, async () => {
          try { await chrome.storage.local.remove("proxyInfo"); } catch {}
          resolve({ ok: true, on: false });
        });
      } catch {
        resolve({ ok: false, error: "clear failed" });
      }
    });
  }

  async function status() {
    // Authoritative: read the ACTUAL chrome.proxy setting, not just cached
    // storage. If the browser is not proxied (cleared, restarted, or reset by
    // another extension), drop the stale entry so the popup never shows a
    // false "ON".
    const applied = await new Promise((resolve) => {
      try {
        chrome.proxy.settings.get({}, (d) => resolve(d && d.value));
      } catch {
        resolve(null);
      }
    });
    const on =
      !!applied &&
      applied.mode === "fixed_servers" &&
      !!applied.rules &&
      !!applied.rules.singleProxy &&
      !!applied.rules.singleProxy.host;
    const s = await chrome.storage.local.get(["proxyInfo", "proxyHealthAt"]);
    const info = s.proxyInfo || null;
    if (!on) {
      if (info) { try { await chrome.storage.local.remove("proxyInfo"); } catch {} }
      return { ok: true, on: false, proxy: null, ip: null };
    }
    // The proxy IS applied (possibly from an earlier session). Verify it
    // still really works (throttled: one live check per 30s). A proxy that
    // now demands username/password or died would pop Chrome's login dialog
    // / show "no internet" — auto-clear it instead.
    let healthy = true;
    if (!s.proxyHealthAt || Date.now() - s.proxyHealthAt > 30000) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        try {
          const r = await fetch(IP_URL, { cache: "no-store", signal: ctrl.signal });
          healthy = r.ok && typeof (await r.json()).ip === "string";
        } finally {
          clearTimeout(t);
        }
      } catch {
        healthy = false;
      }
      try { await chrome.storage.local.set({ proxyHealthAt: Date.now() }); } catch {}
    }
    if (!healthy) {
      await off(); // never leave a dead / auth-required proxy applied
      return { ok: true, on: false, proxy: null, ip: null, autoCleared: true };
    }
    return { ok: true, on: true, proxy: info?.proxy || null, ip: info?.ip || null };
  }

  globalThis.DXProxy = { rotate, off, status, available };

  // Self-heal on every service-worker start: if a proxy from an earlier
  // session is still applied but is now dead / auth-required, clear it so
  // Chrome never pops the login dialog or shows "no internet" while the
  // user is browsing. (status() throttles the live check to once / 30s.)
  setTimeout(async () => {
    try { await globalThis.DXProxy.status(); } catch {}
  }, 600);
})();
