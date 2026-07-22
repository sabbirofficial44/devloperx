/* DeveloperX Flow overlay — floating logo badge on labs.google/fx/tools/flow
 * Collapsed: small round logo with rotating conic border.
 * Expanded (on click): compact card with live HH:MM:SS timer, credits & buy CTA.
 */
(function () {
  if (window.__DX_FLOW_OVERLAY__) return;
  window.__DX_FLOW_OVERLAY__ = true;

  const DEFAULT_API = "https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f-dev.lovable.app";
  const UNLIMITED = new Set(["unlimited", "ultra", "lifetime"]);
  const UPGRADE_URL = "https://wa.me/8801410014442";
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
      </style>
      <div class="dx-logo-wrap" id="dx-toggle" title="Shadhin Digital Store — click for status">
        <div class="dx-ring"></div>
        <div class="dx-logo" id="dx-logo-img" style="background-image:url('${LOGO_URL}')"></div>
        <div class="dx-dot" id="dx-dot"></div>
      </div>
      <div class="dx-card">
        <div class="h">
          <span class="brand">SHADHIN</span>
          <span id="dx-plan" class="b">—</span>
        </div>
        <div id="dx-signed-out" class="t" style="font-size:10px; text-transform:none; letter-spacing:0; color:#9ba3b4;">Sign in via the extension popup.</div>
        <div id="dx-signed-in" style="display:none">
          <span class="live"><span class="d"></span> Live time left</span>
          <div class="timebox"><div class="time" id="dx-time">--:--:--</div></div>
          <div class="cr"><span class="t">Credits</span><b id="dx-credits">—</b></div>
          <div id="dx-msg" class="msg"></div>
          <a id="dx-buy" class="buy" href="${UPGRADE_URL}" target="_blank" style="display:none">💳 Buy more credits</a>
        </div>
      </div>
    `;
    document.documentElement.appendChild(el);
    const toggle = el.querySelector("#dx-toggle");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      el.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!el.contains(e.target)) el.classList.remove("open");
    });
    return el;
  }

  async function getStore() {
    return new Promise((res) => chrome.storage.local.get(
      ["userId","userName","userEmail","userPlan","creditsLeft","apiBase","accessToken"], res
    ));
  }

  async function fetchLive(userId, apiBase, accessToken) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      const res = await fetch(`${apiBase}/api/public/extension/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, accessToken }),
      });
      return await res.json();
    } catch { return null; }
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
        <p>Your Shadhin Digital Store credits have run out. Buy more credits to keep using Google Flow.</p>
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
  let liveBase = { credits: 0, unlimited: false, plan: "basic", syncedAt: 0, signedIn: false, blocked: false };

  function paint() {
    ensureRoot();
    const timeEl = document.getElementById("dx-time");
    const credEl = document.getElementById("dx-credits");
    const badge = document.getElementById("dx-plan");
    const dot = document.getElementById("dx-dot");
    const msg = document.getElementById("dx-msg");
    const buy = document.getElementById("dx-buy");
    document.getElementById("dx-signed-out").style.display = liveBase.signedIn ? "none" : "";
    document.getElementById("dx-signed-in").style.display = liveBase.signedIn ? "" : "none";
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
    const remainingMin = Math.max(0, liveBase.credits - elapsedSec / 60);
    timeEl.textContent = fmtHMS(remainingMin);
    credEl.textContent = Math.max(0, Math.floor(remainingMin)).toLocaleString();

    if (remainingMin <= 0 || liveBase.blocked) {
      badge.classList.add("danger");
      dot.className = "dx-dot danger";
      msg.textContent = "🚫 Credits exhausted — access blocked.";
      buy.style.display = "";
      ensureBlocker();
      killSession();
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
    liveBase = {
      signedIn,
      plan,
      unlimited: UNLIMITED.has(plan),
      credits: Number(user.creditsLeft ?? 0),
      blocked: !!(live?.blocked || live?.disabled),
      syncedAt: Date.now(),
    };
    paint();
  }

  let paintTimer = null;
  let syncTimer = null;

  async function sync() {
    const store = await getStore();
    const apiBase = (store.apiBase || DEFAULT_API).replace(/\/$/, "");
    if (!store.userId) { syncFromStore(store, null); return; }
    const live = await fetchLive(store.userId, apiBase, store.accessToken);
    syncFromStore(store, live);
  }

  function start() {
    ensureRoot();
    sync();
    if (syncTimer) clearInterval(syncTimer);
    if (paintTimer) clearInterval(paintTimer);
    syncTimer = setInterval(sync, 15000);
    paintTimer = setInterval(paint, 1000);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.userId || changes.creditsLeft || changes.userPlan)) sync();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
