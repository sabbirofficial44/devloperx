import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { getMyProfile } from "@/lib/flow-admin.functions";
import { getSiteSettings } from "@/lib/site-settings.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DeveloperX" },
      { name: "description", content: "DeveloperX dashboard — manage credits, extension, and Google Flow access." },
    ],
  }),
  component: Dashboard,
});

const FLOW_URL = "https://labs.google/fx/tools/flow";
const PLAN_TOTALS: Record<string, number> = {
  unlimited: 99999,
  ultra: 99999,
  lifetime: 99999,
  pro: 6000,
  starter: 1500,
  basic: 300, // 5 hour free trial
  free: 300,
};
const UNLIMITED_PLANS = new Set(["unlimited", "ultra", "lifetime"]);

function normalizeWa(raw: string) {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  const num = !digits
    ? "8801410014442"
    : digits.startsWith("880")
      ? digits
      : `880${digits.replace(/^0/, "")}`;
  // Use wa.me with explicit text so it opens the chat directly and avoids api.whatsapp.com iframe block
  return `https://wa.me/${num}?text=${encodeURIComponent("Hi, I want to upgrade my DeveloperX plan.")}`;
}

function openWhatsApp(url: string) {
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      // Popup blocked or inside iframe — break out to top
      if (window.top) window.top.location.href = url;
      else window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
}

function Dashboard() {
  const fetchProfile = useServerFn(getMyProfile);
  const fetchSettings = useServerFn(getSiteSettings);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "sent" | "missing">("idle");
  const menuRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchProfile(),
    refetchInterval: 15000,
  });

  const { data: siteSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 60_000,
  });
  const UPGRADE_URL = normalizeWa(siteSettings?.whatsappNumber ?? siteSettings?.contactNumber ?? "01410014442");

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (cancelled || !sessionData.session?.access_token) return;
      try {
        localStorage.setItem(
          "__flow_auth__",
          JSON.stringify({
            userId: data.userId,
            name: data.displayName ?? data.email ?? "User",
            email: data.email,
            plan: data.plan,
            creditsLeft: data.credits,
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            apiBase: window.location.origin,
          }),
        );
        window.dispatchEvent(new StorageEvent("storage", { key: "__flow_auth__" }));
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    try {
      localStorage.removeItem("__flow_auth__");
    } catch {
      /* ignore */
    }
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const openFlowWithPrompt = () => {
    const cleanedPrompt = prompt.trim();
    setBridgeStatus("idle");

    let ponged = false;
    const onPong = () => {
      ponged = true;
      window.removeEventListener("FLOW_EXT_PONG", onPong as EventListener);
      window.dispatchEvent(
        new CustomEvent("FLOW_OPEN_FLOW_PROMPT", {
          detail: { prompt: cleanedPrompt, url: FLOW_URL, autoSubmit: false },
        }),
      );
      setBridgeStatus("sent");
    };

    window.addEventListener("FLOW_EXT_PONG", onPong as EventListener, { once: true });
    window.dispatchEvent(new CustomEvent("FLOW_EXT_PING"));

    window.setTimeout(() => {
      window.removeEventListener("FLOW_EXT_PONG", onPong as EventListener);
      if (ponged) return;
      setBridgeStatus("missing");
      if (cleanedPrompt) navigator.clipboard?.writeText(cleanedPrompt).catch(() => undefined);
      window.open(FLOW_URL, "_blank", "noopener,noreferrer");
    }, 700);
  };

  const credits = data?.credits ?? 0;
  const planKey = (data?.plan ?? "free").toLowerCase();
  const totalCredits = PLAN_TOTALS[planKey] ?? Math.max(credits, 1000);
  const pct = Math.min(100, Math.max(0, (credits / totalCredits) * 100));
  const usedCredits = Math.max(0, totalCredits - credits);
  const displayName = data?.displayName || (data?.email ? data.email.split("@")[0] : "User");
  const initial = (displayName[0] || "U").toUpperCase();

  return (
    <div className="dx-page-premium">
      <div className="dx-ambient" />
      <div className="dx-container-premium">
        <nav className="dx-nav-premium">
          <div className="dx-logo dx-logo-premium">DeveloperX</div>
          <div className="dx-nav-links" style={{ fontSize: 13 }}>
            <Link className="dx-nav-link" to="/">Home</Link>
            {data?.isAdmin && <Link className="dx-nav-link" to="/admin">Admin</Link>}
            <button onClick={signOut} className="dx-nav-link" style={{ background: "none", border: 0, cursor: "pointer" }}>Logout</button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="dx-btn dx-btn-premium"
                style={{ width: 38, height: 38, padding: 0, borderRadius: 999 }}
                aria-label="Account menu"
              >
                {initial}
              </button>
              {menuOpen && (
                <div className="dx-dropdown">
                  <div style={{ padding: "18px 20px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{displayName}</div>
                    <div style={{ color: "var(--dx-muted-soft)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>{data?.email}</div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--dx-border)", padding: "14px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "var(--dx-muted-soft)" }}>Credits</span>
                      <strong>{credits.toLocaleString()} / {totalCredits.toLocaleString()}</strong>
                    </div>
                    <div className="dx-pbar"><div className="dx-pbar-fill" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <button
                    onClick={() => {
                      fetch(`/flow-extension.zip?v=${Date.now()}`, { cache: "no-store" })
                        .then((res) => {
                          if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                          return res.blob();
                        })
                        .then((blob) => {
                          const a = document.createElement("a");
                          a.href = URL.createObjectURL(blob);
                          a.download = "flow-extension.zip";
                          a.click();
                          URL.revokeObjectURL(a.href);
                        })
                        .catch((err) => alert(err.message));
                    }}
                    style={{ width: "100%", padding: "12px 20px", textAlign: "left", color: "var(--dx-text-soft)", background: "transparent", border: 0, borderTop: "1px solid var(--dx-border)", cursor: "pointer" }}
                  >
                    📥 Get Extension
                  </button>
                  <button
                    onClick={signOut}
                    style={{ width: "100%", padding: "12px 20px", textAlign: "left", color: "var(--dx-red)", background: "transparent", border: 0, borderTop: "1px solid var(--dx-border)", cursor: "pointer" }}
                  >
                    ↪ Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <main>
          {(() => {
            const isUnlimited = UNLIMITED_PLANS.has(planKey);
            const exhausted = !isUnlimited && credits <= 0;
            const lowTrial = !isUnlimited && credits > 0 && credits <= 60;
            if (exhausted) {
              return (
                <div className="dx-alert" style={{ background: "linear-gradient(135deg,rgba(239,68,68,.18),rgba(220,38,38,.08))", border: "1px solid rgba(239,68,68,.4)" }}>
                  <strong>🚫 Credits exhausted</strong><br />
                  <small>Your free trial has ended. Purchase a credit pack to keep using the extension.</small>
                  <div style={{ marginTop: 10 }}>
                    <a className="dx-btn dx-btn-gold-premium" href={UPGRADE_URL} target="_top" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openWhatsApp(UPGRADE_URL); }}>💳 Buy Credits</a>
                  </div>
                </div>
              );
            }
            if (lowTrial) {
              return (
                <div className="dx-alert" style={{ background: "linear-gradient(135deg,rgba(240,185,11,.18),rgba(240,185,11,.05))", border: "1px solid rgba(240,185,11,.35)" }}>
                  <strong>⚠️ Low on credits — {credits} min left</strong><br />
                  <small>Top up now to avoid interruption. Upgrade plans start with more credits and unlimited use.</small>
                  <div style={{ marginTop: 10 }}>
                    <a className="dx-btn dx-btn-gold-premium" href={UPGRADE_URL} target="_top" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openWhatsApp(UPGRADE_URL); }}>⬆ Upgrade / Buy Credits</a>
                  </div>
                </div>
              );
            }
            return (
              <div className="dx-alert dx-alert-info">
                <strong>⏳ {planKey === "basic" ? "5-hour Trial" : planKey.toUpperCase()} · {isUnlimited ? "Unlimited access" : `${credits} min (${Math.floor(credits / 60)}h ${credits % 60}m) remaining`}</strong><br />
                <small>{isUnlimited ? "You have unrestricted access." : "1 credit = 1 minute of extension usage. Upgrade for more."}</small>
              </div>
            );
          })()}

          <section className="dx-status-cards">
            <div className="dx-stat-card"><div className="dx-stat-label">Plan</div><div className="dx-stat-value dx-value-purple">{planKey.toUpperCase()}</div></div>
            <div className="dx-stat-card"><div className="dx-stat-label">Credits Left</div><div className="dx-stat-value dx-value-gold">{UNLIMITED_PLANS.has(planKey) ? "∞" : credits.toLocaleString()}</div></div>
            <div className="dx-stat-card"><div className="dx-stat-label">Used</div><div className="dx-stat-value">{UNLIMITED_PLANS.has(planKey) ? "—" : usedCredits.toLocaleString()}</div></div>
            <div className="dx-stat-card"><div className="dx-stat-label">Status</div><div className="dx-stat-value dx-value-green">{credits <= 0 && !UNLIMITED_PLANS.has(planKey) ? "Blocked" : "Active"}</div></div>
          </section>

          <section className="dx-main-card dx-fade-in">
            <h2>👋 Welcome, <span>{displayName}</span> <span className="dx-pill">{planKey}</span></h2>
            <div style={{ color: "var(--dx-muted-soft)", fontSize: 13, marginBottom: 10 }}>Account: {data?.email ?? "—"}</div>
            <div className="dx-pbar"><div className="dx-pbar-fill" style={{ width: `${pct}%` }} /></div>
            <div style={{ marginTop: 18, fontSize: 12, color: "var(--dx-muted-soft)" }}>{Math.round(pct)}% credits available</div>
            <div className="dx-btn-group" style={{ marginTop: 18 }}>
              <a className="dx-btn dx-btn-gold-premium" href={UPGRADE_URL} target="_top" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); openWhatsApp(UPGRADE_URL); }}>⬆ Upgrade Plan</a>
              <button className="dx-btn dx-btn-outline" onClick={signOut}>Sign Out</button>
            </div>
          </section>

          <section className="dx-main-card">
            <h2>🎬 Generate Video</h2>
            <textarea
              id="flow-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What do you want to create?"
              className="dx-textarea"
              style={{ minHeight: 120, background: "rgba(0,0,0,.3)", borderColor: "var(--dx-border)", borderRadius: 10 }}
            />
            <div className="dx-btn-group" style={{ marginTop: 14, alignItems: "center" }}>
              <button type="button" onClick={openFlowWithPrompt} className="dx-btn dx-btn-premium">▶ Open & Fill Flow</button>
              {bridgeStatus === "sent" && <span style={{ color: "var(--dx-green)", fontSize: 13 }}>Sent to extension. Google Flow will open and fill the prompt.</span>}
              {bridgeStatus === "missing" && <span style={{ color: "#fbbf24", fontSize: 13 }}>Extension not detected here. Prompt copied; paste it in Google Flow.</span>}
            </div>
          </section>

          <section className="dx-main-card">
            <h2>📦 DeveloperX Extension</h2>
            <div className="dx-extension-steps">
              <ol>
                <li>Open <code>chrome://extensions</code> in Chrome</li>
                <li>Enable <strong>Developer Mode</strong> (toggle top right)</li>
                <li>Click <strong>Load unpacked</strong></li>
                <li>Select the <strong>extension</strong> folder</li>
                <li>Open extension → login → <strong>Open Flow</strong></li>
                <li>Start generating videos!</li>
              </ol>
            </div>
            <button
              className="dx-download-btn"
              onClick={() => {
                fetch(`/flow-extension.zip?v=${Date.now()}`, { cache: "no-store" })
                  .then((res) => {
                    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
                    return res.blob();
                  })
                  .then((blob) => {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "flow-extension.zip";
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                  .catch((err) => alert(err.message));
              }}
            >
              <span className="dx-download-glow" />
              <span className="dx-download-icon">📥</span>
              <span className="dx-download-text">
                <span className="dx-download-title">Download Extension</span>
                <span className="dx-download-sub">Latest build · v3.7.0 · Always fresh</span>
              </span>
              <span className="dx-download-arrow">↓</span>
            </button>
          </section>
        </main>

        <footer className="dx-footer-premium">DeveloperX © 2026 · Made with ❤️</footer>
      </div>

      {showWelcome && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 dx-btn dx-btn-premium">
          ✓ Welcome back!
        </div>
      )}
    </div>
  );
}
