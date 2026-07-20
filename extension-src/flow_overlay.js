/* DeveloperX Flow overlay — floating badge on labs.google/fx/tools/flow
 * Shows plan, remaining credits and time. Live-updates from this project's server.
 */
(function () {
  if (window.__DX_FLOW_OVERLAY__) return;
  window.__DX_FLOW_OVERLAY__ = true;

  const DEFAULT_API = "https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f-dev.lovable.app";
  const UNLIMITED = new Set(["unlimited", "ultra", "lifetime"]);
  const UPGRADE_URL = "https://t.me/DeveloperX";

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
          color: #eef1f8; width: 190px;
          background:
            linear-gradient(160deg, rgba(20,18,38,.88), rgba(8,9,16,.9));
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 10px; padding: 9px 11px;
          box-shadow: 0 10px 26px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
          user-select: none;
        }
        #dx-flow-overlay .h { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
        #dx-flow-overlay .brand {
          font-size:9.5px; font-weight:800; letter-spacing:.6px;
          background:linear-gradient(90deg,#c4b5fd,#67e8f9);
          -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        }
        #dx-flow-overlay .b {
          padding:2px 7px; font-size:8.5px; border-radius:999px;
          background:rgba(124,92,252,.22); color:#c4b5fd;
          text-transform:uppercase; font-weight:800; letter-spacing:.5px;
          border:1px solid rgba(124,92,252,.4);
        }
        #dx-flow-overlay .b.warn { background:rgba(240,185,11,.2); color:#fbbf24; border-color:rgba(240,185,11,.4); }
        #dx-flow-overlay .b.danger { background:rgba(239,68,68,.22); color:#f87171; border-color:rgba(239,68,68,.4); }
        #dx-flow-overlay .b.ok { background:rgba(34,197,153,.2); color:#34d399; border-color:rgba(34,197,153,.4); }
        #dx-flow-overlay .t { font-size:9px; color:#8b93a8; text-transform:uppercase; letter-spacing:.6px; font-weight:700; }
        #dx-flow-overlay .live { display:inline-flex; align-items:center; gap:4px; font-size:8.5px; color:#34d399; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
        #dx-flow-overlay .live .dot { width:5px; height:5px; border-radius:50%; background:#34d399; box-shadow:0 0 8px #34d399; animation: dxpulse 2s ease-in-out infinite; }
        @keyframes dxpulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        #dx-flow-overlay .time {
          font-size:15px; font-weight:800; letter-spacing:-.2px; margin-top:2px;
          font-variant-numeric: tabular-nums;
          background: linear-gradient(135deg,#67e8f9,#c4b5fd);
          -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
        }
        #dx-flow-overlay .cr { display:flex; justify-content:space-between; align-items:baseline; margin-top:6px; font-size:11px; }
        #dx-flow-overlay .cr b { font-weight:800; color:#eef1f8; font-variant-numeric: tabular-nums; }
        #dx-flow-overlay .pbar { height:4px; background:rgba(255,255,255,.06); border-radius:99px; overflow:hidden; margin-top:6px; }
        #dx-flow-overlay .pbar > i {
          display:block; height:100%;
          background:linear-gradient(90deg,#7c5cfc,#22d3ee,#7c5cfc);
          background-size:200% 100%;
          animation: dxslide 5s linear infinite;
          box-shadow:0 0 8px rgba(124,92,252,.5);
          transition:width .4s;
        }
        @keyframes dxslide { 0%{background-position:100% 0} 100%{background-position:-100% 0} }
        #dx-flow-overlay .msg { font-size:9.5px; margin-top:6px; color:#fbbf24; line-height:1.35; }
        #dx-flow-overlay a.buy {
          display:block; margin-top:7px; padding:6px; text-align:center; font-size:10px; font-weight:800;
          background:linear-gradient(135deg,#25d366,#128c7e); color:#fff;
          border-radius:7px; text-decoration:none; letter-spacing:.3px;
          box-shadow: 0 6px 14px rgba(37,211,102,.3);
        }
      </style>
      <div class="h">
        <span class="brand">DEVELOPERX</span>
        <span id="dx-plan" class="b">—</span>
      </div>
      <div id="dx-signed-out" class="t" style="font-size:10px; text-transform:none; letter-spacing:0; color:#9ba3b4;">Sign in via the extension popup.</div>
      <div id="dx-signed-in" style="display:none">
        <span class="live"><span class="dot"></span> Live time left</span>
        <div class="time" id="dx-time">--:--:--</div>
        <div class="cr"><span class="t">Credits</span><b id="dx-credits">—</b></div>
        <div class="pbar"><i id="dx-bar" style="width:0%"></i></div>
        <div id="dx-msg" class="msg"></div>
        <a id="dx-buy" class="buy" href="${UPGRADE_URL}" target="_blank" style="display:none">💳 Buy more credits</a>
      </div>
    `;
    document.documentElement.appendChild(el);
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
        <p>Your Veo Unlimited credits have run out. Buy more credits to keep using Google Flow.</p>
        <a href="https://wa.me/8801410014442" target="_blank">💳 Buy Credits · WhatsApp</a>
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

  function render(store, live) {
    ensureRoot();
    const signedIn = !!store.userId;
    document.getElementById("dx-signed-out").style.display = signedIn ? "none" : "";
    document.getElementById("dx-signed-in").style.display = signedIn ? "" : "none";
    if (!signedIn) {
      const p = document.getElementById("dx-plan");
      p.textContent = "signed out"; p.className = "b";
      removeBlocker();
      return;
    }
    const user = live?.user || {
      plan: store.userPlan, creditsLeft: store.creditsLeft,
      creditsTotal: store.creditsLeft,
    };
    const plan = (user.plan || "basic").toLowerCase();
    const isUnlimited = UNLIMITED.has(plan);
    const credits = Number(user.creditsLeft ?? 0);
    const total = Number(user.creditsTotal || credits || 1);

    document.getElementById("dx-time").textContent = isUnlimited ? "∞" : fmtTime(credits);
    document.getElementById("dx-credits").textContent = isUnlimited ? "Unlimited" : credits.toLocaleString();
    document.getElementById("dx-bar").style.width = isUnlimited ? "100%" :
      Math.max(0, Math.min(100, (credits / Math.max(total, credits, 1)) * 100)) + "%";

    const badge = document.getElementById("dx-plan");
    badge.textContent = plan;
    badge.className = "b";
    const msg = document.getElementById("dx-msg");
    const buy = document.getElementById("dx-buy");
    msg.textContent = ""; buy.style.display = "none";

    if (isUnlimited) { badge.classList.add("ok"); removeBlocker(); }
    else if (credits <= 0 || live?.blocked || live?.disabled) {
      badge.classList.add("danger");
      msg.textContent = "🚫 Credits exhausted — access blocked.";
      buy.style.display = "";
      ensureBlocker();
      killSession();
    } else if (credits <= 60) {
      badge.classList.add("warn");
      msg.textContent = `⚠ Low: only ${fmtTime(credits)} remaining.`;
      buy.style.display = "";
      removeBlocker();
    } else {
      removeBlocker();
    }
  }

  let timer = null;
  async function tick() {
    const store = await getStore();
    const apiBase = (store.apiBase || DEFAULT_API).replace(/\/$/, "");
    if (!store.userId) { render(store, null); return; }
    const live = await fetchLive(store.userId, apiBase, store.accessToken);
    render(store, live);
  }

  function start() {
    ensureRoot();
    tick();
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 5000);
  }

  // React to storage updates from popup
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.userId || changes.creditsLeft || changes.userPlan)) tick();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
