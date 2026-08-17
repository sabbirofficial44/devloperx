import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home, LogOut, Download, Sparkles, Play, Zap, Crown, Coins,
  Activity, TrendingUp, AlertTriangle, ShieldAlert, Wand2, Package,
  ChevronRight, User as UserIcon, History, Bell, BarChart3, Copy,
  Trash2, ExternalLink, MessageCircle, Clock, Flame, CheckCircle2,
  Film, ShieldCheck,
} from "lucide-react";
import { getMyProfile } from "@/lib/flow-admin.functions";
import { getSiteSettings } from "@/lib/site-settings.functions";
import {
  getPromptHistory, savePrompt, deletePrompt, getAnnouncements, getUsageStats,
  getVideoHistory, deleteVideo,
} from "@/lib/user-dashboard.functions";
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
  const fetchPrompts = useServerFn(getPromptHistory);
  const savePromptFn = useServerFn(savePrompt);
  const deletePromptFn = useServerFn(deletePrompt);
  const fetchAnnouncements = useServerFn(getAnnouncements);
  const fetchUsage = useServerFn(getUsageStats);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "sent" | "missing">("idle");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dx_dismissed_ann") || "[]")); } catch { return new Set(); }
  });
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
  const { data: prompts = [] } = useQuery({
    queryKey: ["prompt-history"],
    queryFn: () => fetchPrompts(),
    staleTime: 30_000,
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => fetchAnnouncements(),
    staleTime: 60_000,
  });
  const { data: usage } = useQuery({
    queryKey: ["usage-stats"],
    queryFn: () => fetchUsage(),
    refetchInterval: 30_000,
  });
  const fetchVideos = useServerFn(getVideoHistory);
  const deleteVideoFn = useServerFn(deleteVideo);
  const { data: videos = [] } = useQuery({
    queryKey: ["video-history"],
    queryFn: () => fetchVideos(),
    refetchInterval: 20_000,
  });
  const deleteVideoMutation = useMutation({
    mutationFn: (id: string) => deleteVideoFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video-history"] }),
  });

  const saveMutation = useMutation({
    mutationFn: (p: string) => savePromptFn({ data: { prompt: p } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompt-history"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePromptFn({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompt-history"] }),
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
    if (cleanedPrompt) saveMutation.mutate(cleanedPrompt);

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

  const copyPrompt = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
    setTimeout(() => setCopiedId((v) => (v === id ? null : v)), 1500);
  };

  const reusePrompt = (text: string) => {
    setPrompt(text);
    document.getElementById("flow-prompt")?.scrollIntoView({ behavior: "smooth", block: "center" });
    (document.getElementById("flow-prompt") as HTMLTextAreaElement | null)?.focus();
  };

  const downloadExtension = () => {
    fetch(`/flow-extension.zip?v=${Date.now()}`, { cache: "no-store" })
      .then((res) => { if (!res.ok) throw new Error(`Download failed: ${res.status}`); return res.blob(); })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "flow-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((err) => alert(err.message));
  };

  const dismissAnn = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem("dx_dismissed_ann", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const visibleAnnouncements = useMemo(
    () => announcements.filter((a) => !dismissed.has(a.id)),
    [announcements, dismissed],
  );
  const maxUsage = useMemo(
    () => Math.max(1, ...(usage?.buckets ?? []).map((b) => b.used)),
    [usage],
  );
  const relTime = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const credits = data?.credits ?? 0;
  const planKey = (data?.plan ?? "free").toLowerCase();
  const totalCredits = PLAN_TOTALS[planKey] ?? Math.max(credits, 1000);
  const pct = Math.min(100, Math.max(0, (credits / totalCredits) * 100));
  const usedCredits = Math.max(0, totalCredits - credits);
  const displayName = data?.displayName || (data?.email ? data.email.split("@")[0] : "User");

  return (
    <div className="dx-page-premium">
      <div className="dx-ambient" />
      <div className="dx-container-premium">
        <nav className="dx-nav-premium dx-nav-dash">
          <Link to="/" className="dx-logo dx-logo-premium dx-nav-brand" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0 }}>
            <img src="/developerx-logo.png" alt="DeveloperX" width={34} height={34} style={{ borderRadius: 10, boxShadow: "0 4px 16px rgba(240,185,11,0.4)", flexShrink: 0 }} />
            <span className="dx-brand-text">DeveloperX</span>
          </Link>
          <div className="dx-nav-actions" style={{ gap: 10 }}>
            <div className="dx-nav-credit-pill" title="Credits remaining">
              <Coins size={14} />
              <span>{UNLIMITED_PLANS.has(planKey) ? "∞" : credits.toLocaleString()}</span>
            </div>
            <div className="relative dx-nav-avatar-wrap" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="dx-nav-avatar-btn"
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
                <UserIcon size={18} strokeWidth={2.2} />
              </button>
              {menuOpen && (
                <div className="dx-dropdown">
                  <div className="dx-dd-head">
                    <div className="dx-dd-avatar"><UserIcon size={20} /></div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="dx-dd-name">{displayName}</div>
                      <div className="dx-dd-email">{data?.email}</div>
                      <span className="dx-dd-plan-pill">{planKey.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="dx-dd-credits">
                    <div className="dx-dd-credits-row">
                      <span>Credits</span>
                      <strong>{UNLIMITED_PLANS.has(planKey) ? "Unlimited" : `${credits.toLocaleString()} / ${totalCredits.toLocaleString()}`}</strong>
                    </div>
                    <div className="dx-pbar"><div className="dx-pbar-fill" style={{ width: `${pct}%` }} /></div>
                  </div>
                  <Link to="/" className="dx-dd-item" onClick={() => setMenuOpen(false)}>
                    <Home size={16} /> <span>Home</span>
                  </Link>
                  {data?.isAdmin && (
                    <Link to="/admin" className="dx-dd-item" onClick={() => setMenuOpen(false)}>
                      <ShieldCheck size={16} /> <span>Admin Panel</span>
                    </Link>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); openWhatsApp(UPGRADE_URL); }}
                    className="dx-dd-item"
                  >
                    <TrendingUp size={16} /> <span>Upgrade Plan</span>
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); downloadExtension(); }}
                    className="dx-dd-item"
                  >
                    <Download size={16} /> <span>Get Extension</span>
                  </button>
                  <button
                    onClick={signOut}
                    className="dx-dd-item dx-dd-item-danger"
                  >
                    <LogOut size={16} /> <span>Sign Out</span>
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
                <div className="dx-alert dx-alert-danger">
                  <div className="dx-alert-icon"><ShieldAlert size={22} /></div>
                  <div className="dx-alert-body">
                    <strong>Credits exhausted</strong>
                    <small>Your trial has ended. Purchase a credit pack to keep using the extension.</small>
                  </div>
                  <button className="dx-btn dx-btn-gold-premium dx-alert-cta" onClick={() => openWhatsApp(UPGRADE_URL)}>
                    <Coins size={16} /> Buy Credits
                  </button>
                </div>
              );
            }
            if (lowTrial) {
              return (
                <div className="dx-alert dx-alert-warn">
                  <div className="dx-alert-icon"><AlertTriangle size={22} /></div>
                  <div className="dx-alert-body">
                    <strong>Low on credits — {credits} min left</strong>
                    <small>Top up now to avoid interruption.</small>
                  </div>
                  <button className="dx-btn dx-btn-gold-premium dx-alert-cta" onClick={() => openWhatsApp(UPGRADE_URL)}>
                    <TrendingUp size={16} /> Upgrade
                  </button>
                </div>
              );
            }
            return (
              <div className="dx-alert dx-alert-info">
                <div className="dx-alert-icon"><Sparkles size={22} /></div>
                <div className="dx-alert-body">
                  <strong>{planKey === "basic" ? "5-hour Trial" : planKey.toUpperCase()} · {isUnlimited ? "Unlimited access" : `${credits} min (${Math.floor(credits / 60)}h ${credits % 60}m) remaining`}</strong>
                  <small>{isUnlimited ? "You have unrestricted access." : "1 credit = 1 minute of extension usage."}</small>
                </div>
              </div>
            );
          })()}

          {visibleAnnouncements.length > 0 && (
            <section className="dx-announcements">
              {visibleAnnouncements.map((a) => (
                <div key={a.id} className={`dx-ann dx-ann-${a.kind}`}>
                  <div className="dx-ann-icon"><Bell size={16} /></div>
                  <div className="dx-ann-body">
                    <div className="dx-ann-title">{a.title}</div>
                    <div className="dx-ann-text">{a.body}</div>
                    <div className="dx-ann-time">{relTime(a.createdAt)}</div>
                  </div>
                  <button className="dx-ann-close" onClick={() => dismissAnn(a.id)} aria-label="Dismiss">×</button>
                </div>
              ))}
            </section>
          )}

          <section className="dx-status-cards">
            <div className="dx-stat-card">
              <div className="dx-stat-head"><Crown size={16} /><span>Plan</span></div>
              <div className="dx-stat-value dx-value-purple">{planKey.toUpperCase()}</div>
            </div>
            <div className="dx-stat-card">
              <div className="dx-stat-head"><Coins size={16} /><span>Credits Left</span></div>
              <div className="dx-stat-value dx-value-gold">{UNLIMITED_PLANS.has(planKey) ? "∞" : credits.toLocaleString()}</div>
            </div>
            <div className="dx-stat-card">
              <div className="dx-stat-head"><Zap size={16} /><span>Used</span></div>
              <div className="dx-stat-value">{UNLIMITED_PLANS.has(planKey) ? "—" : usedCredits.toLocaleString()}</div>
            </div>
            <div className="dx-stat-card">
              <div className="dx-stat-head"><Activity size={16} /><span>Status</span></div>
              <div className="dx-stat-value dx-value-green">{credits <= 0 && !UNLIMITED_PLANS.has(planKey) ? "Blocked" : "Active"}</div>
            </div>
          </section>

          <section className="dx-main-card dx-fade-in">
            <h2><UserIcon size={18} /> Welcome, <span>{displayName}</span> <span className="dx-pill">{planKey}</span></h2>
            <div style={{ color: "var(--dx-muted-soft)", fontSize: 13, marginBottom: 10 }}>Account: {data?.email ?? "—"}</div>
            <div className="dx-pbar"><div className="dx-pbar-fill" style={{ width: `${pct}%` }} /></div>
            <div style={{ marginTop: 18, fontSize: 12, color: "var(--dx-muted-soft)" }}>{Math.round(pct)}% credits available</div>
            <div className="dx-btn-group" style={{ marginTop: 18 }}>
              <button className="dx-btn dx-btn-gold-premium" onClick={() => openWhatsApp(UPGRADE_URL)}>
                <TrendingUp size={16} /> Upgrade Plan
              </button>
            </div>
          </section>

          <section className="dx-main-card">
            <h2><Wand2 size={18} /> Generate Video</h2>
            <textarea
              id="flow-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What do you want to create?"
              className="dx-textarea"
              style={{ minHeight: 120, background: "rgba(0,0,0,.3)", borderColor: "var(--dx-border)", borderRadius: 10 }}
            />
            <div className="dx-btn-group" style={{ marginTop: 14, alignItems: "center" }}>
              <button type="button" onClick={openFlowWithPrompt} className="dx-btn dx-btn-premium">
                <Play size={15} /> Open & Fill Flow
              </button>
              {bridgeStatus === "sent" && <span style={{ color: "var(--dx-green)", fontSize: 13 }}>Sent to extension. Google Flow will open and fill the prompt.</span>}
              {bridgeStatus === "missing" && <span style={{ color: "#fbbf24", fontSize: 13 }}>Extension not detected here. Prompt copied; paste it in Google Flow.</span>}
            </div>
          </section>

          <section className="dx-quick-grid">
            <button className="dx-quick-card" onClick={() => window.open(FLOW_URL, "_blank", "noopener,noreferrer")}>
              <div className="dx-quick-icon dx-quick-blue"><ExternalLink size={20} /></div>
              <div className="dx-quick-label">Open Flow</div>
              <div className="dx-quick-sub">Launch Google Flow</div>
            </button>
            <button className="dx-quick-card" onClick={downloadExtension}>
              <div className="dx-quick-icon dx-quick-gold"><Download size={20} /></div>
              <div className="dx-quick-label">Extension</div>
              <div className="dx-quick-sub">Download latest</div>
            </button>
            <button className="dx-quick-card" onClick={() => openWhatsApp(UPGRADE_URL)}>
              <div className="dx-quick-icon dx-quick-green"><MessageCircle size={20} /></div>
              <div className="dx-quick-label">Support</div>
              <div className="dx-quick-sub">WhatsApp chat</div>
            </button>
            <button className="dx-quick-card" onClick={() => openWhatsApp(UPGRADE_URL)}>
              <div className="dx-quick-icon dx-quick-purple"><Crown size={20} /></div>
              <div className="dx-quick-label">Upgrade</div>
              <div className="dx-quick-sub">More credits</div>
            </button>
          </section>

          <section className="dx-main-card">
            <h2><BarChart3 size={18} /> Usage · Last 7 Days</h2>
            <div className="dx-usage-summary">
              <div className="dx-usage-pill"><Flame size={14} /> Today: <strong>{usage?.today ?? 0} min</strong></div>
              <div className="dx-usage-pill"><Clock size={14} /> 7d total: <strong>{usage?.total7d ?? 0} min</strong></div>
            </div>
            <div className="dx-chart">
              {(usage?.buckets ?? []).map((b) => {
                const h = Math.round((b.used / maxUsage) * 100);
                const label = new Date(b.day + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "short" });
                return (
                  <div key={b.day} className="dx-chart-col" title={`${label}: ${b.used} min`}>
                    <div className="dx-chart-value">{b.used}</div>
                    <div className="dx-chart-bar" style={{ height: `${Math.max(4, h)}%` }} />
                    <div className="dx-chart-label">{label}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="dx-main-card">
            <h2><History size={18} /> Prompt History <span className="dx-pill">{prompts.length}</span></h2>
            {prompts.length === 0 ? (
              <div className="dx-empty">
                <Wand2 size={28} opacity={0.4} />
                <div>No prompts yet. Generate a video above and it'll appear here.</div>
              </div>
            ) : (
              <div className="dx-prompt-list">
                {prompts.map((p) => (
                  <div key={p.id} className="dx-prompt-item">
                    <div className="dx-prompt-text">{p.prompt}</div>
                    <div className="dx-prompt-meta">
                      <span><Clock size={12} /> {relTime(p.createdAt)}</span>
                    </div>
                    <div className="dx-prompt-actions">
                      <button className="dx-icon-btn" title="Reuse" onClick={() => reusePrompt(p.prompt)}>
                        <Play size={14} />
                      </button>
                      <button className="dx-icon-btn" title="Copy" onClick={() => copyPrompt(p.id, p.prompt)}>
                        {copiedId === p.id ? <CheckCircle2 size={14} color="#22c55e" /> : <Copy size={14} />}
                      </button>
                      <button
                        className="dx-icon-btn dx-icon-danger"
                        title="Delete"
                        onClick={() => deleteMutation.mutate(p.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dx-main-card">
            <h2><Film size={18} /> My Videos <span className="dx-pill">{videos.length}</span></h2>
            <div style={{ color: "var(--dx-muted-soft)", fontSize: 12.5, marginTop: -4, marginBottom: 12 }}>
              Every video you generate on Google Flow is auto-saved here.
            </div>
            {videos.length === 0 ? (
              <div className="dx-empty">
                <Film size={28} opacity={0.4} />
                <div>No videos yet. Generate one on Google Flow and it will appear here automatically.</div>
              </div>
            ) : (
              <div className="dx-video-grid">
                {videos.map((v) => (
                  <div key={v.id} className="dx-video-card">
                    <div className="dx-video-thumb">
                      {v.videoUrl ? (
                        <video
                          src={v.videoUrl}
                          poster={v.thumbnailUrl ?? undefined}
                          controls
                          preload="metadata"
                          playsInline
                        />
                      ) : v.thumbnailUrl ? (
                        <img src={v.thumbnailUrl} alt="Video thumbnail" />
                      ) : (
                        <div className="dx-video-placeholder"><Film size={30} /></div>
                      )}
                    </div>
                    <div className="dx-video-body">
                      {v.prompt && <div className="dx-video-prompt">{v.prompt}</div>}
                      <div className="dx-video-meta">
                        <span><Clock size={11} /> {relTime(v.createdAt)}</span>
                        {v.model && <span className="dx-video-model">{v.model}</span>}
                      </div>
                      <div className="dx-video-actions">
                        {v.videoUrl && (
                          <a className="dx-icon-btn" title="Open" href={v.videoUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink size={13} />
                          </a>
                        )}
                        {v.videoUrl && (
                          <a className="dx-icon-btn" title="Download" href={v.videoUrl} download>
                            <Download size={13} />
                          </a>
                        )}
                        <button
                          className="dx-icon-btn dx-icon-danger"
                          title="Delete"
                          onClick={() => deleteVideoMutation.mutate(v.id)}
                          disabled={deleteVideoMutation.isPending}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dx-main-card">
            <h2><Package size={18} /> DeveloperX Extension</h2>
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
              <span className="dx-download-icon"><Download size={22} /></span>
              <span className="dx-download-text">
                <span className="dx-download-title">Download Extension</span>
                <span className="dx-download-sub">Latest build · v2.0.0 · Always fresh</span>
              </span>
              <span className="dx-download-arrow"><ChevronRight size={18} /></span>
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
