/* DeveloperX Flow overlay — floating logo badge on labs.google/fx/tools/flow
 * Collapsed: small round logo with rotating conic border.
 * Expanded (on click): compact card with live HH:MM:SS timer, credits & buy CTA.
 */
(function () {
  if (window.__DX_FLOW_OVERLAY__) return;
  window.__DX_FLOW_OVERLAY__ = true;

  const _d = (s) => { try { return atob(s); } catch (_) { return ""; } };
  const DEFAULT_API = _d("aHR0cHM6Ly9wcm9qZWN0LS0zMDZhNDk5Ny01ODMwLTQ5MmYtYjhkYi05YmIwYWI0YWVlMWYtZGV2LmxvdmFibGUuYXBw");
  // All backend bases known to the extension — whichever one is live answers.
  const FALLBACK_BASES = [
    DEFAULT_API,
    _d("aHR0cHM6Ly9kZXZsb3BlcngubG92YWJsZS5hcHA="),
    _d("aHR0cHM6Ly9mbG93YWlpdmlkZW8ubG92YWJsZS5hcHA="),
    _d("aHR0cHM6Ly9mbG93Y3JlYXRvcmFpLnNpdGU="),
  ];
  const UNLIMITED = new Set(["unlimited", "ultra", "lifetime"]);
  const UPGRADE_URL = _d("aHR0cHM6Ly93YS5tZS84ODAxNDEwMDE0NDQy");
  const LOGO_URL = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL("logo.png") : "";

  function fmtHMS(mins) {
    if (mins == null || isNaN(mins)) return "--:--:--";
    let total = Math.max(0, Math.floor(Number(mins) * 60));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function ensureRoot() {
    let el = document.getElementById("dx-flow-overlay");
    if (el) return el;
    el = document.createElement("div");
    el.id = "dx-flow-overlay";
    el.innerHTML = `
      <style>
        #dx-flow-overlay {
          position: fixed; top: 14px; right: 14px; z-index: 2147483647;
          font-family: -apple-system,"Inter","Segoe UI",Roboto,sans-serif;
          color: #eef1f8; user-select: none;
        }
        #dx-flow-overlay .dx-logo-wrap {
          position: relative; width: 52px; height: 52px; cursor: pointer;
          border-radius: 50%;
          transition: transform .25s ease;
        }
        #dx-flow-overlay .dx-logo-wrap:hover { transform: scale(1.08); }
        #dx-flow-overlay .dx-ring {
          position: absolute; inset: -3px; border-radius: 50%;
          background: conic-gradient(from 0deg,
            #7c5cfc, #22d3ee, #34d399, #fbbf24, #f472b6, #7c5cfc);
          animation: dxspin 4s linear infinite;
          filter: drop-shadow(0 0 10px rgba(124,92,252,.55));
        }
        #dx-flow-overlay .dx-ring::after {
          content:""; position:absolute; inset:3px; border-radius:50%;
          background: radial-gradient(circle at 30% 30%, #1a1830, #06070c);
        }
        @keyframes dxspin { to { transform: rotate(360deg); } }
        #dx-flow-overlay .dx-logo {
          position: absolute; inset: 6px; border-radius: 50%;
          background-size: cover; background-position: center;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.15);
          z-index: 1;
        }
        #dx-flow-overlay .dx-dot {
          position:absolute; right:-2px; top:-2px; width:12px; height:12px; border-radius:50%;
          background:#34d399; box-shadow: 0 0 10px #34d399; border:2px solid #06070c; z-index:2;
          animation: dxpulse 2s ease-in-out infinite;
        }
        #dx-flow-overlay .dx-dot.warn { background:#fbbf24; box-shadow:0 0 10px #fbbf24; }
        #dx-flow-overlay .dx-dot.danger { background:#ef4444; box-shadow:0 0 10px #ef4444; }
        @keyframes dxpulse { 0%,100%{opacity:1} 50%{opacity:.35} }

        #dx-flow-overlay .dx-card {
          position: absolute; top: 62px; right: 0; width: 220px;
          padding: 12px; border-radius: 14px;
          background: linear-gradient(160deg, rgba(20,18,38,.92), rgba(8,9,16,.94));
          backdrop-filter: blur(20px) saturate(160%);
          -webkit-backdrop-filter: blur(20px) saturate(160%);
          border: 1px solid rgba(255,255,255,.09);
          box-shadow: 0 20px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06);
          transform-origin: top right;
          opacity: 0; transform: scale(.85) translateY(-6px); pointer-events: none;
          transition: opacity .22s ease, transform .22s cubic-bezier(.2,.9,.3,1.2);
        }
        #dx-flow-overlay.open .dx-card { opacity: 1; transform: scale(1) translateY(0); pointer-events: auto; }
        #dx-flow-overlay .h { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        #dx-flow-overlay .brand {
          font-size:10px; font-weight:800; letter-spacing:.7px;
          background:linear-gradient(90deg,#c4b5fd,#67e8f9);
          -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        }
        #dx-flow-overlay .b {
          padding:2px 8px; font-size:9px; border-radius:999px;
          background:rgba(124,92,252,.22); color:#c4b5fd;
          text-transform:uppercase; font-weight:800; letter-spacing:.5px;
          border:1px solid rgba(124,92,252,.4);
        }
        #dx-flow-overlay .b.warn { background:rgba(240,185,11,.2); color:#fbbf24; border-color:rgba(240,185,11,.4); }
        #dx-flow-overlay .b.danger { background:rgba(239,68,68,.22); color:#f87171; border-color:rgba(239,68,68,.4); }
        #dx-flow-overlay .b.ok { background:rgba(34,197,153,.2); color:#34d399; border-color:rgba(34,197,153,.4); }
        #dx-flow-overlay .t { font-size:9px; color:#8b93a8; text-transform:uppercase; letter-spacing:.6px; font-weight:700; }
        #dx-flow-overlay .live { display:inline-flex; align-items:center; gap:5px; font-size:9px; color:#34d399; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
        #dx-flow-overlay .live .d { width:6px; height:6px; border-radius:50%; background:#34d399; box-shadow:0 0 8px #34d399; animation: dxpulse 2s ease-in-out infinite; }
        #dx-flow-overlay .timebox {
          position: relative; margin-top: 6px; padding: 10px 12px;
          border-radius: 12px; overflow: hidden;
          background: rgba(255,255,255,.02);
        }
        #dx-flow-overlay .timebox::before {
          content:""; position:absolute; inset:0; border-radius:12px; padding:1.5px;
          background: conic-gradient(from 0deg,
            #7c5cfc, #22d3ee, #34d399, #fbbf24, #f472b6, #7c5cfc);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
                  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: dxspin 4s linear infinite;
        }
        #dx-flow-overlay .dx-bar {
          position: relative; height: 5px; margin-top: 9px;
          border-radius: 999px; overflow: hidden;
          background: rgba(255,255,255,.07);
          box-shadow: inset 0 1px 2px rgba(0,0,0,.4);
        }
        #dx-flow-overlay .dx-bar i {
          position: absolute; inset: 0 auto 0 0; width: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg,#7c5cfc,#22d3ee,#34d399);
          background-size: 200% 100%;
          box-shadow: 0 0 8px rgba(52,211,153,.55);
          transition: width 1s linear;
        }
        #dx-flow-overlay .dx-bar.warn i { background: linear-gradient(90deg,#fbbf24,#f87171); box-shadow: 0 0 8px rgba(251,191,36,.5); }
        #dx-flow-overlay .dx-bar.danger i { background: linear-gradient(90deg,#f87171,#ef4444); box-shadow: 0 0 10px rgba(239,68,68,.6); }
        #dx-flow-overlay .time {
          position:relative; font-size:20px; font-weight:800; letter-spacing:.5px;
          font-variant-numeric: tabular-nums; text-align:center;
          background: linear-gradient(135deg,#67e8f9,#c4b5fd,#f472b6);
          background-size: 200% 100%;
          -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
          animation: dxshift 6s linear infinite;
        }
        @keyframes dxshift { 0%{background-position:0% 0} 100%{background-position:200% 0} }
        #dx-flow-overlay .cr { display:flex; justify-content:space-between; align-items:baseline; margin-top:8px; font-size:11px; }
        #dx-flow-overlay .cr b { font-weight:800; color:#eef1f8; font-variant-numeric: tabular-nums; }
        #dx-flow-overlay .msg { font-size:10px; margin-top:6px; color:#fbbf24; line-height:1.35; }
        #dx-flow-overlay a.buy {
          display:block; margin-top:9px; padding:7px; text-align:center; font-size:10.5px; font-weight:800;
          background:linear-gradient(135deg,#25d366,#128c7e); color:#fff;
          border-radius:8px; text-decoration:none; letter-spacing:.3px;
          box-shadow: 0 6px 14px rgba(37,211,102,.3);
        }
        #dx-flow-overlay button.dx-inject {
          display:block; width:100%; margin-top:9px; padding:8px; text-align:center;
          font-size:11px; font-weight:800; letter-spacing:.4px; color:#fff;
          background:linear-gradient(135deg,#7c5cfc,#22d3ee);
          border:none; border-radius:8px; cursor:pointer;
          box-shadow: 0 6px 16px rgba(124,92,252,.35);
          transition: transform .15s ease, filter .15s ease;
        }
        #dx-flow-overlay button.dx-inject:hover { filter:brightness(1.1); transform:translateY(-1px); }
        #dx-flow-overlay button.dx-inject:disabled { opacity:.6; cursor:wait; }
        #dx-flow-overlay .dx-inject-status { margin-top:6px; font-size:10px; text-align:center; color:#8b93a8; min-height:12px; }
        #dx-flow-overlay #dx-paywall {
          position: fixed; inset: 0; z-index: 2147483647;
          display: none; align-items: center; justify-content: center;
          background: radial-gradient(circle at 30% 30%, rgba(24,22,44,.97), rgba(6,7,12,.99));
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          font-family: system-ui, -apple-system, sans-serif; text-align: center;
        }
        #dx-flow-overlay #dx-paywall.show { display: flex; }
        #dx-flow-overlay .dx-pay-card {
          padding: 30px 38px; border-radius: 18px; max-width: 320px;
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10);
          box-shadow: 0 20px 60px rgba(0,0,0,.55);
        }
        #dx-flow-overlay .dx-pay-emoji { font-size: 44px; }
        #dx-flow-overlay .dx-pay-title { margin-top: 12px; font-size: 19px; font-weight: 800; color: #eef1f8; letter-spacing:.3px; }
        #dx-flow-overlay .dx-pay-sub { margin-top: 6px; font-size: 12px; color: #9ba3b4; line-height: 1.5; }
        #dx-flow-overlay .dx-pay-btn {
          display: block; margin-top: 18px; padding: 11px 18px;
          background: linear-gradient(135deg,#25d366,#128c7e); color: #fff;
          font-size: 12.5px; font-weight: 800; border-radius: 10px; text-decoration: none;
          box-shadow: 0 8px 20px rgba(37,211,102,.35);
          transition: transform .15s ease, filter .15s ease;
        }
        #dx-flow-overlay .dx-pay-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
      </style>
      <div class="dx-logo-wrap" id="dx-toggle" title="DeveloperX — click for status">
        <div class="dx-ring"></div>
        <div class="dx-logo" id="dx-logo-img" style="background-image:url('${LOGO_URL}')"></div>
        <div class="dx-dot" id="dx-dot"></div>
      </div>
      <div class="dx-card">
        <div class="h">
          <span class="brand">DEVELOPERX</span>
          <span id="dx-plan" class="b">—</span>
        </div>
        <div id="dx-signed-out" class="t" style="font-size:10px; text-transform:none; letter-spacing:0; color:#9ba3b4;">Sign in via the extension popup.</div>
        <div id="dx-signed-in" style="display:none">
          <span class="live"><span class="d"></span> Live time left</span>
          <div class="timebox">
            <div class="time" id="dx-time">--:--:--</div>
            <div class="dx-bar" id="dx-bar"><i id="dx-bar-fill"></i></div>
          </div>
          <div class="cr"><span class="t">Credits</span><b id="dx-credits">—</b></div>
          <div id="dx-msg" class="msg"></div>
          <button id="dx-inject" class="dx-inject" type="button">🍪 Inject Flow · Reload</button>
          <div id="dx-inject-status" class="dx-inject-status"></div>
          <a id="dx-buy" class="buy" href="${UPGRADE_URL}" target="_blank" style="display:none">💳 Buy more credits</a>
        </div>
      </div>
      <div id="dx-paywall">
        <div class="dx-pay-card">
          <div class="dx-pay-emoji">⏰</div>
          <div class="dx-pay-title">Your time has finished</div>
          <div class="dx-pay-sub">Buy more time to keep using Google Flow.</div>
          <a class="dx-pay-btn" href="${UPGRADE_URL}" target="_blank">💬 Buy credits · WhatsApp</a>
        </div>
      </div>
    `;
    document.documentElement.appendChild(el);
    const toggle = el.querySelector("#dx-toggle");

    // Restore saved position
    try {
      const saved = JSON.parse(localStorage.getItem("__dx_overlay_pos__") || "null");
      if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
        el.style.left = saved.left + "px";
        el.style.top = saved.top + "px";
        el.style.right = "auto";
      }
    } catch (_) {}

    // Draggable (mouse + touch)
    let drag = null;
    const onDown = (e) => {
      const p = e.touches ? e.touches[0] : e;
      const rect = el.getBoundingClientRect();
      drag = { dx: p.clientX - rect.left, dy: p.clientY - rect.top, moved: false, startX: p.clientX, startY: p.clientY };
    };
    const onMove = (e) => {
      if (!drag) return;
      const p = e.touches ? e.touches[0] : e;
      const dxm = Math.abs(p.clientX - drag.startX);
      const dym = Math.abs(p.clientY - drag.startY);
      if (!drag.moved && dxm < 4 && dym < 4) return;
      drag.moved = true;
      e.preventDefault();
      const maxL = window.innerWidth - 60;
      const maxT = window.innerHeight - 60;
      const left = Math.max(4, Math.min(maxL, p.clientX - drag.dx));
      const top = Math.max(4, Math.min(maxT, p.clientY - drag.dy));
      el.style.left = left + "px";
      el.style.top = top + "px";
      el.style.right = "auto";
    };
    const onUp = () => {
      if (drag && drag.moved) {
        try {
          localStorage.setItem("__dx_overlay_pos__", JSON.stringify({
            left: parseFloat(el.style.left) || 0,
            top: parseFloat(el.style.top) || 0,
          }));
        } catch (_) {}
        // suppress click if dragged
        setTimeout(() => { drag = null; }, 50);
      } else {
        drag = null;
      }
    };
    toggle.addEventListener("mousedown", onDown);
    toggle.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);

    toggle.addEventListener("click", (e) => {
      if (drag && drag.moved) { e.stopPropagation(); e.preventDefault(); drag = null; return; }
      e.stopPropagation();
      el.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!el.contains(e.target)) el.classList.remove("open");
    });

    const injectBtn = el.querySelector("#dx-inject");
    if (injectBtn) {
      injectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        triggerInject();
      });
    }
    return el;
  }

  function setInjectStatus(msg, color) {
    const s = document.getElementById("dx-inject-status");
    if (!s) return;
    s.textContent = msg || "";
    s.style.color = color || "#8b93a8";
  }

  let injecting = false;
  async function triggerInject() {
    if (injecting) return;
    const btn = document.getElementById("dx-inject");
    const store = await getStore();
    if (!store.userId) {
      setInjectStatus("Sign in via the extension popup first.", "#fbbf24");
      return;
    }
    if (liveBase.blocked || (!liveBase.unlimited && liveBase.credits <= 0)) {
      setInjectStatus("Credits exhausted — top up first.", "#f87171");
      return;
    }
    injecting = true;
    if (btn) btn.disabled = true;
    setInjectStatus("🍪 Injecting fresh session…", "#c4b5fd");
    try {
      const res = await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: "DX_FORCE_LIVE_INJECT" }, (r) => {
            if (chrome.runtime.lastError) return resolve({ success: false, message: chrome.runtime.lastError.message });
            resolve(r || { success: false });
          });
        } catch (err) { resolve({ success: false, message: String(err) }); }
      });
      if (!res || res.success === false) {
        setInjectStatus("❌ " + (res?.message || "Injection failed"), "#f87171");
        injecting = false;
        if (btn) btn.disabled = false;
        return;
      }
      setInjectStatus("✅ Session locked · reloading…", "#34d399");
      setTimeout(() => {
        try { location.reload(); } catch { window.location.href = "https://labs.google/fx/tools/flow"; }
      }, 600);
    } catch (e) {
      setInjectStatus("❌ " + (e.message || "Injection failed"), "#f87171");
      injecting = false;
      if (btn) btn.disabled = false;
    }
  }

  async function getStore() {
    return new Promise((res) => chrome.storage.local.get(
      ["userId","userName","userEmail","userPlan","creditsLeft","apiBase","accessToken","sessionExpiresAt","sessionDurationMin"], res
    ));
  }

  async function fetchLive(userId, apiBase, accessToken) {
    const bases = Array.from(new Set([String(apiBase || "").replace(/\/$/, ""), ...FALLBACK_BASES].filter(Boolean)));
    let lastData = null;
    for (const base of bases) {
      try {
        const headers = { "Content-Type": "application/json", "Accept": "application/json", "Cache-Control": "no-store, no-cache", "Pragma": "no-cache" };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const res = await fetch(`${base}/api/public/extension/verify?_ts=${Date.now()}`, {
          method: "POST",
          headers,
          cache: "no-store",
          body: JSON.stringify({ userId, accessToken, _ts: Date.now() }),
        });
        const data = await res.json().catch(() => null);
        if (!data) continue;
        lastData = data;
        if (data && Array.isArray(data.cookies) && data.cookies.length > 0) {
          try {
            await chrome.storage.local.set({
              cookieData: data.cookies,
              cookieUpdatedAt: data.cookieUpdatedAt || Date.now(),
              lastLiveCookieSync: Date.now(),
              creditsLeft: Number(data.user?.creditsLeft ?? 0),
              userPlan: data.user?.plan || "basic",
            });
          } catch (_) {}
          return data;
        }
        // encryptedCookies can only be decrypted in the SW — ask it to sync.
        if (data.encryptedCookies) {
          try {
            await new Promise((resolve) => {
              chrome.runtime.sendMessage({ type: "DX_FORCE_LIVE_SYNC" }, (r) => {
                if (chrome.runtime.lastError) return resolve(null);
                resolve(r || null);
              });
            });
            const st = await chrome.storage.local.get(["cookieData", "lastLiveCookieSync"]);
            if (Array.isArray(st.cookieData) && st.cookieData.length > 0) return data;
          } catch (_) {}
        }
      } catch (_) {}
    }
    return lastData;
  }

  function ensureBlocker() {
    let b = document.getElementById("dx-block-screen");
    if (b) return b;
    b = document.createElement("div");
    b.id = "dx-block-screen";
    b.innerHTML = `
      <style>
        #dx-block-screen{
          position:fixed; inset:0; z-index:2147483646;
          background:radial-gradient(120% 90% at 0% 0%, rgba(239,68,68,.25), transparent 55%), rgba(6,7,11,.96);
          backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          display:flex; align-items:center; justify-content:center;
          font-family:-apple-system,"Segoe UI",Roboto,sans-serif; color:#fff;
        }
        #dx-block-screen .box{
          max-width:440px; width:90%; padding:32px;
          background:rgba(20,22,30,.92); border:1px solid rgba(255,255,255,.08);
          border-radius:20px; text-align:center;
          box-shadow:0 30px 80px rgba(0,0,0,.6);
        }
        #dx-block-screen h2{ margin:0 0 8px; font-size:22px; font-weight:800; letter-spacing:-.3px; }
        #dx-block-screen p{ margin:0 0 20px; color:#9ba3b4; font-size:14px; line-height:1.55; }
        #dx-block-screen a{
          display:inline-block; padding:12px 22px; border-radius:10px;
          background:linear-gradient(135deg,#f0b90b,#ea8b0b); color:#08090d;
          text-decoration:none; font-weight:800; font-size:14px;
        }
        #dx-block-screen .lock{ font-size:44px; margin-bottom:10px; }
      </style>
      <div class="box">
        <div class="lock">🔒</div>
        <h2>Credits Exhausted</h2>
        <p>Your DeveloperX credits have run out. Buy more credits to keep using Google Flow.</p>
        <a href="${UPGRADE_URL}" target="_blank">💳 Buy Credits · WhatsApp</a>
      </div>
    `;
    document.documentElement.appendChild(b);
    return b;
  }

  function removeBlocker() {
    const b = document.getElementById("dx-block-screen");
    if (b) b.remove();
  }

  async function killSession() {
    try { chrome.runtime.sendMessage({ type: "REMOVE_COOKIES" }, () => {}); } catch {}
    try { chrome.runtime.sendMessage({ type: "CLEAR_FLOW_COOKIES" }, () => {}); } catch {}
  }

  // Live baseline — synced from server, ticked locally each second
  let liveBase = { credits: 0, unlimited: false, plan: "basic", syncedAt: 0, signedIn: false, blocked: false, expiresAt: 0, duration: 0 };

  function paint() {
    ensureRoot();
    const timeEl = document.getElementById("dx-time");
    const credEl = document.getElementById("dx-credits");
    const badge = document.getElementById("dx-plan");
    const dot = document.getElementById("dx-dot");
    const msg = document.getElementById("dx-msg");
    const buy = document.getElementById("dx-buy");
    const outEl = document.getElementById("dx-signed-out");
    const inEl = document.getElementById("dx-signed-in");
    // If the SPA nuked our DOM mid-frame, bail quietly — the watchdog
    // rebuilds the overlay on the next tick.
    if (!timeEl || !credEl || !badge || !dot || !msg || !buy || !outEl || !inEl) return;
    outEl.style.display = liveBase.signedIn ? "none" : "";
    inEl.style.display = liveBase.signedIn ? "" : "none";

    if (!liveBase.signedIn) {
      badge.textContent = "signed out"; badge.className = "b";
      dot.className = "dx-dot warn";
      removeBlocker();
      return;
    }
    badge.textContent = liveBase.plan;
    badge.className = "b";
    msg.textContent = ""; buy.style.display = "none"; dot.className = "dx-dot";

    if (liveBase.unlimited) {
      timeEl.textContent = "∞";
      credEl.textContent = "Unlimited";
      badge.classList.add("ok");
      removeBlocker();
      return;
    }

    const elapsedSec = (Date.now() - liveBase.syncedAt) / 1000;
    const remainingMin = liveBase.expiresAt
      ? Math.max(0, (liveBase.expiresAt - Date.now()) / 60000)
      : Math.max(0, liveBase.credits - elapsedSec / 60);
    timeEl.textContent = fmtHMS(remainingMin);
    credEl.textContent = Math.max(0, Math.floor(remainingMin)).toLocaleString();

    // Linear progress line — depletes as time passes (green → amber → red).
    const barEl = document.getElementById("dx-bar-fill");
    const barWrap = document.getElementById("dx-bar");
    if (barEl && barWrap) {
      const total = liveBase.duration || Math.max(liveBase.credits, 1);
      const pct = Math.max(0, Math.min(100, (remainingMin / total) * 100));
      barEl.style.width = pct + "%";
      barWrap.className = "dx-bar" + (pct <= 10 ? " danger" : pct <= 30 ? " warn" : "");
    }

    // HARD BLOCK: the panel stores only a static number, so the extension
    // itself locks the whole site when the absolute session ends (or the
    // server says blocked) — a full-page paywall with a WhatsApp buy link.
    const expired = !!(
      liveBase.expiresAt && liveBase.duration > 0 &&
      Date.now() >= liveBase.expiresAt && !liveBase.unlimited
    );
    const paywall = document.getElementById("dx-paywall");
    if (paywall) paywall.classList.toggle("show", !!(liveBase.blocked || expired));

    // Only show the hard blocker when the SERVER confirms credits are gone
    // (liveBase.blocked). Never block based on the local ticking counter —
    // a stale sync makes the counter drift to 0 and would falsely lock the
    // page even when the user still has real credits on the backend.
    if (liveBase.blocked) {
      badge.classList.add("danger");
      dot.className = "dx-dot danger";
      msg.textContent = "🚫 Credits exhausted — access blocked.";
      buy.style.display = "";
      ensureBlocker();
    } else if (remainingMin <= 60) {
      badge.classList.add("warn");
      dot.className = "dx-dot warn";
      msg.textContent = `⚠ Low: only ${fmtHMS(remainingMin)} remaining.`;
      buy.style.display = "";
      removeBlocker();
    } else {
      removeBlocker();
    }
  }

  function syncFromStore(store, live) {
    const signedIn = !!store.userId;
    const user = live?.user || { plan: store.userPlan, creditsLeft: store.creditsLeft };
    const plan = (user.plan || "basic").toLowerCase();
    // Absolute-session timer: the server returns the FULL granted minutes on
    // every poll, so a local "credits − elapsed" counter restarts on refresh.
    // Persist an absolute expiry timestamp instead — refresh keeps the true
    // remaining time (same rule as the popup).
    const creditsRaw = user.creditsLeft;
    const credits = creditsRaw == null || isNaN(Number(creditsRaw)) ? 0 : Number(creditsRaw);
    const now = Date.now();
    const prevExp = Number(store.sessionExpiresAt || 0);
    const prevDur = Number(store.sessionDurationMin || 0);
    // Reset ONLY when the granted time changes (or no session yet) — never
    // auto-restart from an expired session (the panel returns the same
    // static number forever).
    const reset = credits > 0 && (!prevExp || credits !== prevDur);
    const expiresAt = reset ? now + credits * 60000 : prevExp;
    const duration = reset ? credits : prevDur;
    liveBase = {
      signedIn,
      plan,
      unlimited: UNLIMITED.has(plan),
      credits,
      blocked: !!(live?.blocked || live?.disabled),
      syncedAt: now,
      expiresAt,
      duration,
    };
    if (reset) {
      try {
        chrome.storage.local.get("sessionTimers", (st) => {
          const timers = (st && st.sessionTimers) || {};
          timers[store.userId] = { expiresAt, duration };
          chrome.storage.local.set({ sessionTimers: timers, sessionExpiresAt: expiresAt, sessionDurationMin: duration });
        });
      } catch {}
    }
    paint();
  }

  let paintTimer = null;
  let syncTimer = null;

  async function sync() {
    const store = await getStore();
    const apiBase = (store.apiBase || DEFAULT_API).replace(/\/$/, "");
    if (!store.userId) { syncFromStore(store, null); return; }
    const live = await fetchLive(store.userId, apiBase, store.accessToken);
    // If the server is unreachable (offline / transient network hiccup / dead
    // fallback endpoint), fall back to the STORED session instead of keeping
    // the initial "signed out" state. The popup and the overlay must agree:
    // a stored userId means the extension IS signed in — show the stored
    // plan/credits until the API comes back. Never flip the badge to
    // "signed out" just because a fetch failed.
    if (!live) { syncFromStore(store, null); return; }
    syncFromStore(store, live);
  }

  let watchdogTimer = null;

  function start() {
    ensureRoot();
    sync();
    if (syncTimer) clearInterval(syncTimer);
    if (paintTimer) clearInterval(paintTimer);
    if (watchdogTimer) clearInterval(watchdogTimer);
    syncTimer = setInterval(sync, 15000);
    paintTimer = setInterval(paint, 1000);
    // Flow is an SPA that re-renders (and sometimes wipes) the DOM on route
    // changes. Re-create the floating badge whenever it disappears so the
    // timer + Inject button are always reachable.
    watchdogTimer = setInterval(() => {
      try {
        if (!document.getElementById("dx-flow-overlay")) {
          ensureRoot();
          paint();
        }
      } catch (_) {}
    }, 1500);
  }

  // SPA navigation hooks — re-assert the overlay right after route changes.
  try {
    const reassert = () => { try { ensureRoot(); paint(); } catch (_) {} };
    const wrap = (fn) => function () { const r = fn.apply(this, arguments); setTimeout(reassert, 300); return r; };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener("popstate", () => setTimeout(reassert, 300));
    window.addEventListener("focus", () => setTimeout(reassert, 100));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) reassert(); });
  } catch (_) {}

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.userId || changes.creditsLeft || changes.userPlan || changes.cookieUpdatedAt || changes.lastLiveCookieSync)) sync();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  // Safety net: if something threw before start() ran, force it shortly after load.
  setTimeout(() => { if (!document.getElementById("dx-flow-overlay")) start(); }, 2500);

})();
