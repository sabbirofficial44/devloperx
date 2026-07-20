/* DeveloperX Flow overlay — floating badge on labs.google/fx/tools/flow
 * Shows plan, remaining credits and time. Live-updates from this project's server.
 */
(function () {
  if (window.__DX_FLOW_OVERLAY__) return;
  window.__DX_FLOW_OVERLAY__ = true;

  const DEFAULT_API = "https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f-dev.lovable.app";
  const UNLIMITED = new Set(["unlimited", "ultra", "lifetime"]);
  const UPGRADE_URL = "https://t.me/DeveloperX";

  function fmtTime(mins) {
    if (mins == null || isNaN(mins)) return "—";
    mins = Math.max(0, Math.floor(mins));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function ensureRoot() {
    let el = document.getElementById("dx-flow-overlay");
    if (el) return el;
    el = document.createElement("div");
    el.id = "dx-flow-overlay";
    el.innerHTML = `
      <style>
        #dx-flow-overlay {
          position: fixed; top: 16px; right: 16px; z-index: 2147483647;
          font-family: -apple-system,"Segoe UI",Roboto,sans-serif;
          color: #f5f6fa; width: 240px;
          background: rgba(12,14,20,.85);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px; padding: 12px 14px;
          box-shadow: 0 16px 40px rgba(0,0,0,.45);
          user-select: none;
        }
        #dx-flow-overlay .h { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        #dx-flow-overlay .b {
          padding:2px 8px; font-size:10px; border-radius:999px;
          background:rgba(124,92,252,.2); color:#a78bfa;
          text-transform:uppercase; font-weight:700; letter-spacing:.5px;
        }
        #dx-flow-overlay .b.warn { background:rgba(240,185,11,.2); color:#fbbf24; }
        #dx-flow-overlay .b.danger { background:rgba(239,68,68,.2); color:#f87171; }
        #dx-flow-overlay .b.ok { background:rgba(34,211,153,.2); color:#34d399; }
        #dx-flow-overlay .t { font-size:11px; color:#9ba3b4; }
        #dx-flow-overlay .v { font-size:20px; font-weight:800; letter-spacing:-.5px; }
        #dx-flow-overlay .r { display:flex; justify-content:space-between; align-items:baseline; }
        #dx-flow-overlay .pbar { height:5px; background:rgba(255,255,255,.06); border-radius:99px; overflow:hidden; margin-top:8px; }
        #dx-flow-overlay .pbar > i { display:block; height:100%; background:linear-gradient(90deg,#7c5cfc,#22d3ee); transition:width .4s; }
        #dx-flow-overlay .msg { font-size:11px; margin-top:8px; color:#fbbf24; }
        #dx-flow-overlay a.buy {
          display:block; margin-top:8px; padding:7px; text-align:center; font-size:11px; font-weight:800;
          background:linear-gradient(135deg,#f0b90b,#ea8b0b); color:#08090d;
          border-radius:8px; text-decoration:none;
        }
        #dx-flow-overlay .brand { font-size:11px; font-weight:800; color:#7c5cfc; }
        #dx-flow-overlay .x {
          cursor:pointer; color:#6b7280; font-size:14px; background:transparent; border:0; padding:0 4px;
        }
      </style>
      <div class="h">
        <span class="brand">DEVELOPERX</span>
        <span id="dx-plan" class="b">—</span>
      </div>
      <div id="dx-signed-out" class="t">Sign in via the extension popup to see your credits.</div>
      <div id="dx-signed-in" style="display:none">
        <div class="r"><span class="t">Time left</span><span class="v" id="dx-time">—</span></div>
        <div class="r"><span class="t">Credits</span><span id="dx-credits">—</span></div>
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
