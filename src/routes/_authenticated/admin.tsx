import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Users, UserPlus, Zap, Cookie, ScrollText,
  BarChart3, Settings, ArrowLeft, Home, RefreshCw, ChevronDown, ChevronRight,
  Circle, Menu, X, LogOut,
} from "lucide-react";

import {
  bulkCreateUsers,
  createUser,
  deleteUser,
  fetchLiveCookies,
  resolveActiveCookieEmails,
  getMyProfile,
  listCreatedUsers,
  listCreditLedger,
  listSessionCookieSets,
  listUsers,
  rotateUserCookies,
  updateAdminCredentials,
  updateUser,
  uploadSessionCookies,
} from "@/lib/flow-admin.functions";
import { getSiteSettings, updateSiteSettings, type SitePlan } from "@/lib/site-settings.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — DeveloperX" },
      { name: "description", content: "DeveloperX admin console: users, credits, cookies, and audit." },
    ],
  }),
  component: AdminPage,
});

type Section = "overview" | "users" | "create" | "bulk" | "cookies" | "history" | "ledger" | "settings";

const NAV: { key: Section; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "users", label: "Users", Icon: Users },
  { key: "create", label: "Create User", Icon: UserPlus },
  { key: "bulk", label: "Bulk Generate", Icon: Zap },
  { key: "cookies", label: "Cookies", Icon: Cookie },
  { key: "history", label: "Created History", Icon: ScrollText },
  { key: "ledger", label: "Credit Ledger", Icon: BarChart3 },
  { key: "settings", label: "Pricing & Contact", Icon: Settings },
];

function dedupeLedgerByUser(rows: Array<{ userId: string; email: string | null; amount: number; createdAt: string }>) {
  const map = new Map<string, { userId: string; email: string | null; totalUsed: number; count: number; lastAt: string }>();
  for (const r of rows) {
    const g = map.get(r.userId) ?? { userId: r.userId, email: r.email, totalUsed: 0, count: 0, lastAt: r.createdAt };
    if (r.amount < 0) g.totalUsed += -r.amount;
    g.count += 1;
    if (new Date(r.createdAt) > new Date(g.lastAt)) g.lastAt = r.createdAt;
    if (!g.email && r.email) g.email = r.email;
    map.set(r.userId, g);
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}


function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchMe = useServerFn(getMyProfile);
  const fetchUsers = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);
  const deleteFn = useServerFn(deleteUser);
  const rotateFn = useServerFn(rotateUserCookies);
  const bulkFn = useServerFn(bulkCreateUsers);
  const uploadCookiesFn = useServerFn(uploadSessionCookies);
  const fetchLiveFn = useServerFn(fetchLiveCookies);
  const listCookieSetsFn = useServerFn(listSessionCookieSets);
  const listLedgerFn = useServerFn(listCreditLedger);
  const fetchCreated = useServerFn(listCreatedUsers);

  const [section, setSection] = useState<Section>("overview");
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { setNavOpen(false); }, [section]);


  const meQuery = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    enabled: !!meQuery.data?.isAdmin,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  });

  const historyQuery = useQuery({
    queryKey: ["created-users"],
    queryFn: () => fetchCreated(),
    enabled: !!meQuery.data?.isAdmin,
  });
  const cookieSetsQuery = useQuery({
    queryKey: ["session-cookie-sets"],
    queryFn: () => listCookieSetsFn(),
    enabled: !!meQuery.data?.isAdmin,
  });

  const [ledgerFilter, setLedgerFilter] = useState("");
  const ledgerQuery = useQuery({
    queryKey: ["credit-ledger", ledgerFilter],
    queryFn: () =>
      listLedgerFn({
        data: {
          limit: 200,
          userId:
            ledgerFilter && /^[0-9a-f-]{36}$/i.test(ledgerFilter) ? ledgerFilter : undefined,
        },
      }),
    enabled: !!meQuery.data?.isAdmin,
    refetchInterval: 15000,
  });

  const [cookieJson, setCookieJson] = useState("");
  const [cookieMsg, setCookieMsg] = useState("");

  const uploadCookiesMut = useMutation({
    mutationFn: (cookies: unknown[]) => uploadCookiesFn({ data: { cookies } }),
    onSuccess: (r) => {
      setCookieMsg(`✅ ${r.count} cookies activated`);
      setCookieJson("");
      qc.invalidateQueries({ queryKey: ["session-cookie-sets"] });
    },
    onError: (e: Error) => setCookieMsg(`❌ ${e.message}`),
  });

  const fetchLiveMut = useMutation({
    mutationFn: () => fetchLiveFn() as Promise<{ ok: true; count: number; source: string; cookiesJson: string; emails: string[] }>,
    onSuccess: (r) => {
      const emailStr = r.emails && r.emails.length > 0 ? ` — 📧 ${r.emails.join(", ")}` : "";
      setCookieMsg(`✅ Fetched ${r.count} live cookies from ${r.source}${emailStr}`);
      setCookieJson(r.cookiesJson);
      qc.invalidateQueries({ queryKey: ["session-cookie-sets"] });
    },
    onError: (e: Error) => setCookieMsg(`❌ ${e.message}`),
  });

  const [autoFetch, setAutoFetch] = useState(true);
  const fetchLiveRef = useRef(fetchLiveMut);
  fetchLiveRef.current = fetchLiveMut;
  const isAdmin = !!meQuery.data?.isAdmin;
  useEffect(() => {
    if (!autoFetch || !isAdmin) return;
    fetchLiveRef.current.mutate();
    const id = setInterval(() => fetchLiveRef.current.mutate(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [autoFetch, isAdmin]);

  useEffect(() => {
    if (meQuery.data && !meQuery.data.isAdmin) {
      navigate({ to: "/admin-login", replace: true });
    }
  }, [meQuery.data, navigate]);


  const submitCookies = () => {
    setCookieMsg("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(cookieJson);
    } catch {
      setCookieMsg("❌ Invalid JSON");
      return;
    }
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { cookies?: unknown[] })?.cookies)
        ? (parsed as { cookies: unknown[] }).cookies
        : null;
    if (!arr || arr.length === 0) {
      setCookieMsg("❌ Expected a JSON array of cookies");
      return;
    }
    uploadCookiesMut.mutate(arr);
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [credits, setCredits] = useState("720"); // minutes — default 12h trial
  const [plan, setPlan] = useState("basic");
  const [msg, setMsg] = useState("");

  const [bulkCount, setBulkCount] = useState("10");
  const [bulkDomain, setBulkDomain] = useState("flowmail.local");
  const [bulkPrefix, setBulkPrefix] = useState("flow");
  const [bulkPlan, setBulkPlan] = useState("basic");
  const [bulkCredits, setBulkCredits] = useState("720"); // minutes
  const [bulkResults, setBulkResults] = useState<
    { email: string; password: string; ok: boolean; error?: string }[]
  >([]);

  const createMut = useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      displayName?: string;
      credits?: number;
      plan?: string;
    }) => createFn({ data: input }),
    onSuccess: () => {
      setEmail(""); setPassword(""); setDisplayName("");
      setCredits("720"); setPlan("basic");
      setMsg("✅ User created");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["created-users"] });
    },
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });

  const updateMut = useMutation({
    mutationFn: (input: { userId: string; credits?: number; plan?: string; displayName?: string }) =>
      updateFn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });

  const rotateMut = useMutation({
    mutationFn: (userId: string) => rotateFn({ data: { userId } }),
    onSuccess: (r) => setMsg(`✅ Cookies rotated (${r.count} cookies assigned)`),
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });

  const bulkMut = useMutation({
    mutationFn: (input: {
      count: number; domain: string; prefix?: string; plan?: string; credits?: number;
    }) => bulkFn({ data: input }),
    onSuccess: (r) => {
      setBulkResults(r.results);
      const ok = r.results.filter((x) => x.ok).length;
      setMsg(`✅ Bulk created ${ok}/${r.results.length}`);
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["created-users"] });
    },
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });

  const downloadBulk = (fmt: "txt" | "csv") => {
    const ok = bulkResults.filter((r) => r.ok);
    if (ok.length === 0) return;
    const body =
      fmt === "csv"
        ? "email,password\n" + ok.map((r) => `${r.email},${r.password}`).join("\n")
        : ok.map((r) => `${r.email}:${r.password}`).join("\n");
    const blob = new Blob([body], { type: fmt === "csv" ? "text/csv" : "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `flow-accounts-${Date.now()}.${fmt}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const users = usersQuery.data ?? [];
  const totalUsers = users.length;
  const basicUsers = users.filter((u) => (u.plan ?? "").toLowerCase() === "basic").length;
  const exhaustedUsers = users.filter(
    (u) => !["unlimited","ultra","lifetime"].includes((u.plan ?? "").toLowerCase()) && Number(u.credits) <= 0,
  ).length;
  const adminUsers = users.filter((u) => u.isAdmin).length;
  const totalCredits = users.reduce((sum, u) => sum + (Number(u.credits) || 0), 0);
  const activeCookieSet = cookieSetsQuery.data?.[0];

  if (meQuery.data && !meQuery.data.isAdmin) {
    return (
      <div className="dx-auth-shell">
        <div className="dx-auth-card" style={{ textAlign: "center" }}>
          <h1>Not authorized</h1>
          <div className="dx-auth-sub">Admin console access only.</div>
          <button onClick={() => navigate({ to: "/dashboard" })} className="dx-btn dx-btn-purple">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentLabel = NAV.find((n) => n.key === section)?.label ?? "";

  return (
    <div className="ax-shell">
      <div className="ax-orbs" aria-hidden>
        <span className="ax-orb ax-orb-a" />
        <span className="ax-orb ax-orb-b" />
        <span className="ax-orb ax-orb-c" />
      </div>
      <aside className={`ax-sidebar ${navOpen ? "is-open" : ""}`} aria-hidden={!navOpen}>
        <div className="ax-brand">
          <div className="ax-brand-mark">DX</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ax-brand-name">DeveloperX</div>
            <div className="ax-brand-sub">Admin Console</div>
          </div>
          <button type="button" className="ax-drawer-close" aria-label="Close menu" onClick={() => setNavOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="ax-nav">
          <div className="ax-nav-label">Management</div>
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              data-active={section === n.key}
              onClick={() => setSection(n.key)}
              className="ax-nav-item"
            >
              <span className="ax-nav-icon"><n.Icon size={16} /></span>
              <span>{n.label}</span>
            </button>
          ))}
          <div className="ax-nav-label">Shortcuts</div>
          <Link to="/dashboard" className="ax-nav-item">
            <span className="ax-nav-icon"><ArrowLeft size={16} /></span>
            <span>User Dashboard</span>
          </Link>
          <Link to="/" className="ax-nav-item">
            <span className="ax-nav-icon"><Home size={16} /></span>
            <span>Home</span>
          </Link>
        </nav>
        <div className="ax-sidebar-foot">v2026 · Console build</div>
      </aside>
      {navOpen && <div className="ax-drawer-backdrop" onClick={() => setNavOpen(false)} aria-hidden />}

      <div className="ax-main">
        <header className="ax-topbar">
          <button
            type="button"
            className="ax-menu-btn"
            aria-label="Open menu"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <Menu size={18} />
          </button>
          <div className="ax-topbar-brand">
            <span className="ax-topbar-mark">DX</span>
            <span className="ax-topbar-title">{currentLabel || "Admin"}</span>
          </div>
          <div className="ax-crumb">
            Admin · <strong>{currentLabel}</strong>
          </div>
          <div className="ax-topbar-right">
            <span className="ax-topbar-email">{meQuery.data?.email}</span>
            <button
              onClick={async () => {
                const { supabase } = await import("@/integrations/supabase/client");
                await supabase.auth.signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="ax-signout"
              aria-label="Sign out"
            >
              <LogOut size={14} />
              <span className="ax-signout-label">Sign out</span>
            </button>
          </div>
        </header>


        <div className="ax-content">
          {section === "overview" && (
            <>
              <h1 className="ax-page-title">System overview</h1>
              <p className="ax-page-sub">Live snapshot of DeveloperX accounts and credit pool.</p>
              <div className="ax-kpi-grid">
                <div className="ax-kpi"><div className="ax-kpi-label">Total users</div><div className="ax-kpi-value info">{totalUsers}</div></div>
                <div className="ax-kpi"><div className="ax-kpi-label">Admins</div><div className="ax-kpi-value pos">{adminUsers}</div></div>
                <div className="ax-kpi"><div className="ax-kpi-label">Basic (trial)</div><div className="ax-kpi-value warn">{basicUsers}</div></div>
                <div className="ax-kpi"><div className="ax-kpi-label">Exhausted</div><div className="ax-kpi-value" style={{ color: "#fca5a5" }}>{exhaustedUsers}</div></div>
                <div className="ax-kpi"><div className="ax-kpi-label">Credits pooled</div><div className="ax-kpi-value">{totalCredits.toLocaleString()}</div></div>
                <div className="ax-kpi"><div className="ax-kpi-label">Active cookie set</div><div className="ax-kpi-value info">{activeCookieSet ? `${activeCookieSet.totalCookies}` : "—"}</div></div>
              </div>

              <section className="ax-panel">
                <div className="ax-panel-head">
                  <div className="ax-panel-title">Recent credit activity</div>
                  <button onClick={() => setSection("ledger")} className="ax-btn ax-btn-ghost">View full ledger →</button>
                </div>
                {(ledgerQuery.data ?? []).length === 0 ? (
                  <div className="ax-empty">No activity yet.</div>
                ) : (
                  <div className="ax-table-wrap">
                    <table className="ax-table">
                      <thead><tr><th>User</th><th>Last activity</th><th>Total used</th><th>Events</th></tr></thead>
                      <tbody>
                        {dedupeLedgerByUser(ledgerQuery.data ?? []).slice(0, 8).map((g) => (
                          <tr key={g.userId} style={{ cursor: "pointer" }} onClick={() => setSection("ledger")}>
                            <td>{g.email ?? "—"}</td>
                            <td style={{ color: "#64748b", whiteSpace: "nowrap" }}>{new Date(g.lastAt).toLocaleString()}</td>
                            <td className="ax-mono" style={{ color: "#fca5a5" }}>-{g.totalUsed}</td>
                            <td className="ax-mono">{g.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <AdminCredentialsPanel currentEmail={meQuery.data?.email ?? ""} />
            </>
          )}

          {section === "users" && (
            <>
              <h1 className="ax-page-title">Users</h1>
              <p className="ax-page-sub">Edit credits and plans, rotate session cookies, or remove accounts.</p>
              <section className="ax-panel">
                <div className="ax-panel-head">
                  <div className="ax-panel-title">All accounts</div>
                  <button className="ax-btn ax-btn-ghost" onClick={() => qc.invalidateQueries({ queryKey: ["users"] })}>🔄 Refresh</button>
                </div>
                {usersQuery.isLoading && <div className="ax-empty">Loading…</div>}
                {usersQuery.data && (
                  <div className="ax-user-list">
                    {usersQuery.data.map((u) => (
                      <UserRow
                        key={u.userId}
                        user={u}
                        isSelf={u.userId === meQuery.data?.userId}
                        rotating={rotateMut.isPending && rotateMut.variables === u.userId}
                        onSave={(p) => updateMut.mutate({ userId: u.userId, ...p })}
                        onRotate={() => rotateMut.mutate(u.userId)}
                        onDelete={() => { if (confirm(`Delete ${u.email}?`)) deleteMut.mutate(u.userId); }}
                      />
                    ))}
                    {usersQuery.data.length === 0 && <div className="ax-empty">No users yet.</div>}
                  </div>
                )}
                {msg && <div className="ax-msg">{msg}</div>}
              </section>

            </>
          )}

          {section === "create" && (
            <>
              <h1 className="ax-page-title">Create user</h1>
              <p className="ax-page-sub">Provision a new account with initial credits and plan.</p>
              <section className="ax-panel">
                <div className="ax-field-grid">
                  <Field label="Email" type="email" value={email} onChange={setEmail} />
                  <Field label="Password" type="password" value={password} onChange={setPassword} />
                  <Field label="Display name" value={displayName} onChange={setDisplayName} />
                  <Field label="Plan" value={plan} onChange={setPlan} />
                </div>
                <TimeInput
                  label="Access time"
                  minutes={Number(credits) || 0}
                  onChange={(m) => setCredits(String(m))}
                />

                <button
                  className="ax-btn ax-btn-primary"
                  disabled={createMut.isPending || !email || !password}
                  onClick={() =>
                    createMut.mutate({
                      email, password,
                      displayName: displayName || undefined,
                      credits: credits ? Number(credits) : undefined,
                      plan: plan || undefined,
                    })
                  }
                >{createMut.isPending ? "Creating…" : "Create user"}</button>
                {msg && <div className="ax-msg">{msg}</div>}
              </section>
            </>
          )}

          {section === "bulk" && (
            <>
              <h1 className="ax-page-title">Bulk generate</h1>
              <p className="ax-page-sub">Auto-generate up to 100 accounts and export credentials.</p>
              <section className="ax-panel">
                <div className="ax-field-grid">
                  <Field label="Count" type="number" value={bulkCount} onChange={setBulkCount} />
                  <Field label="Prefix" value={bulkPrefix} onChange={setBulkPrefix} />
                  <Field label="Domain" value={bulkDomain} onChange={setBulkDomain} />
                  <Field label="Plan" value={bulkPlan} onChange={setBulkPlan} />
                </div>
                <TimeInput
                  label="Access time per account"
                  minutes={Number(bulkCredits) || 0}
                  onChange={(m) => setBulkCredits(String(m))}
                />

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="ax-btn ax-btn-primary"
                    disabled={bulkMut.isPending || !bulkCount || !bulkDomain}
                    onClick={() =>
                      bulkMut.mutate({
                        count: Math.min(100, Math.max(1, Number(bulkCount) || 0)),
                        domain: bulkDomain,
                        prefix: bulkPrefix || undefined,
                        plan: bulkPlan || undefined,
                        credits: bulkCredits ? Number(bulkCredits) : undefined,
                      })
                    }
                  >{bulkMut.isPending ? "Generating…" : "Generate accounts"}</button>
                  {bulkResults.length > 0 && (
                    <>
                      <button onClick={() => downloadBulk("txt")} className="ax-btn ax-btn-ghost">Download .txt</button>
                      <button onClick={() => downloadBulk("csv")} className="ax-btn ax-btn-ghost">Download .csv</button>
                      <button
                        onClick={() => {
                          const ok = bulkResults.filter((r) => r.ok);
                          navigator.clipboard.writeText(ok.map((r) => `${r.email}:${r.password}`).join("\n"));
                        }}
                        className="ax-btn ax-btn-ghost"
                      >Copy all</button>
                    </>
                  )}
                </div>
                {bulkResults.length > 0 && (
                  <pre className="ax-textarea" style={{ marginTop: 16, minHeight: 200 }}>
                    {bulkResults.map((r) => r.ok ? `${r.email}:${r.password}` : `# FAILED ${r.email} — ${r.error}`).join("\n")}
                  </pre>
                )}
              </section>
            </>
          )}

          {section === "cookies" && (
            <>
              <h1 className="ax-page-title">Global cookies</h1>
              <p className="ax-page-sub">Paste a custom JSON cookie array to inject manually, or let auto-fetch keep the session fresh.</p>
              <section className="ax-panel">
                <div className="ax-label">Custom cookie inject</div>
                <textarea
                  value={cookieJson}
                  onChange={(e) => setCookieJson(e.target.value)}
                  placeholder='[{"name":"__Secure-1PSID","value":"...","domain":".google.com"}, ...]'
                  className="ax-textarea"
                />
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={submitCookies}
                    disabled={uploadCookiesMut.isPending || !cookieJson.trim()}
                    className="ax-btn ax-btn-primary"
                  >{uploadCookiesMut.isPending ? "Activating…" : "Activate custom cookies"}</button>
                  <button
                    onClick={() => { setCookieMsg(""); fetchLiveMut.mutate(); }}
                    disabled={fetchLiveMut.isPending}
                    className="ax-btn ax-btn-primary"
                    style={{ background: "linear-gradient(135deg,#7c5cfc,#a855f7)" }}
                  >{fetchLiveMut.isPending ? "Fetching…" : "⚡ Fetch Live now"}</button>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#94a3b8" }}>
                    <input type="checkbox" checked={autoFetch} onChange={(e) => setAutoFetch(e.target.checked)} />
                    Auto-fetch every 5 min {autoFetch && <span style={{ color: "#22d3ee" }}>● live</span>}
                  </label>
                  {cookieMsg && <span className="ax-msg" style={{ margin: 0 }}>{cookieMsg}</span>}
                </div>
              </section>

              <LiveCookiePanel
                onSync={() => { setCookieMsg(""); fetchLiveMut.mutate(); }}
                syncing={fetchLiveMut.isPending}
              />

              {cookieSetsQuery.data && cookieSetsQuery.data.length > 0 && (
                <section className="ax-panel" style={{ marginTop: 16 }}>
                  <div className="ax-label">Recent cookie sets (last 5)</div>
                  <div className="ax-table-wrap">
                    <table className="ax-table">
                      <thead><tr><th>Status</th><th>Cookies</th><th>Updated</th></tr></thead>
                      <tbody>
                        {cookieSetsQuery.data.slice(0, 5).map((s, i) => (
                          <tr key={s.id}>
                            <td>{i === 0 ? <span className="ax-pill">Active</span> : <span style={{ color: "#64748b", fontSize: 11 }}>archived</span>}</td>
                            <td>{s.totalCookies}</td>
                            <td style={{ color: "#64748b" }}>{new Date(s.updatedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}


          {section === "history" && (
            <>
              <h1 className="ax-page-title">Created accounts history</h1>
              <p className="ax-page-sub">Passwords are hashed at rest and not shown here. Save the password shown at creation time.</p>
              <section className="ax-panel">
                {historyQuery.isLoading && <div className="ax-empty">Loading…</div>}
                {historyQuery.data && historyQuery.data.length === 0 && <div className="ax-empty">No accounts created yet.</div>}
                {historyQuery.data && historyQuery.data.length > 0 && (
                  <div className="ax-table-wrap">
                    <table className="ax-table">
                      <thead><tr><th>Email</th><th>Plan</th><th>Credits</th><th>Created</th></tr></thead>
                      <tbody>
                        {historyQuery.data.map((r) => (
                          <tr key={r.id}>
                            <td><span className="ax-mono">{r.email}</span></td>
                            <td>{r.plan ?? "—"}</td>
                            <td>{r.credits ?? "—"}</td>
                            <td style={{ color: "#64748b", fontSize: 11 }}>{new Date(r.createdAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {section === "ledger" && (
            <>
              <h1 className="ax-page-title">Credit ledger</h1>
              <p className="ax-page-sub">Grouped by user — click a row to expand full usage history.</p>
              <section className="ax-panel">
                <div className="ax-panel-head">
                  <div className="ax-panel-title">Users</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={ledgerFilter}
                      onChange={(e) => setLedgerFilter(e.target.value)}
                      placeholder="Filter by user UUID"
                      className="ax-input"
                      style={{ width: 260 }}
                    />
                    <button onClick={() => qc.invalidateQueries({ queryKey: ["credit-ledger"] })} className="ax-btn ax-btn-ghost">Refresh</button>
                  </div>
                </div>
                {ledgerQuery.isLoading && <div className="ax-empty">Loading…</div>}
                {ledgerQuery.data && ledgerQuery.data.length === 0 && <div className="ax-empty">No credit activity yet.</div>}
                {ledgerQuery.data && ledgerQuery.data.length > 0 && (
                  <LedgerGrouped rows={ledgerQuery.data} />
                )}
              </section>
            </>
          )}


          {section === "settings" && <SettingsPanel />}
        </div>
      </div>
    </div>
  );
}

type LedgerRow = {
  id: string;
  userId: string;
  email: string | null;
  amount: number;
  balanceAfter: number | null;
  reason: string | null;
  source: string | null;
  createdAt: string;
};

function LedgerGrouped({ rows }: { rows: LedgerRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      email: string | null;
      rows: LedgerRow[];
      totalUsed: number;
      totalAdded: number;
      lastAt: string;
      lastBalance: number | null;
    }>();
    for (const r of rows) {
      const key = r.userId;
      const g = map.get(key) ?? {
        userId: r.userId,
        email: r.email,
        rows: [],
        totalUsed: 0,
        totalAdded: 0,
        lastAt: r.createdAt,
        lastBalance: r.balanceAfter,
      };
      g.rows.push(r);
      if (r.amount < 0) g.totalUsed += -r.amount;
      else g.totalAdded += r.amount;
      if (new Date(r.createdAt) > new Date(g.lastAt)) {
        g.lastAt = r.createdAt;
        g.lastBalance = r.balanceAfter;
      }
      if (!g.email && r.email) g.email = r.email;
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }, [rows]);

  const nowMs = Date.now();
  return (
    <div className="ax-table-wrap" style={{ maxHeight: 620, overflowY: "auto" }}>
      <table className="ax-table">
        <thead style={{ position: "sticky", top: 0 }}>
          <tr><th></th><th>User</th><th>Total used</th><th>Added</th><th>Last activity</th><th>Current balance</th><th>Events</th></tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const open = expanded === g.userId;
            const lastMs = new Date(g.lastAt).getTime();
            const mins = Math.floor((nowMs - lastMs) / 60000);
            const online = mins < 2;
            return (
              <>
                <tr
                  key={g.userId}
                  onClick={() => setExpanded(open ? null : g.userId)}
                  style={{ cursor: "pointer", background: open ? "rgba(124,92,252,.08)" : undefined }}
                >
                  <td style={{ width: 24, color: "#94a3b8" }}>{open ? "▼" : "▶"}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: online ? "#34d399" : "#64748b",
                        boxShadow: online ? "0 0 8px #34d399" : "none",
                      }} />
                      <span>{g.email ?? "—"}</span>
                    </div>
                    <div className="ax-mono" style={{ color: "#475569", fontSize: 10 }}>{g.userId.slice(0, 8)}…</div>
                  </td>
                  <td className="ax-mono" style={{ color: "#fca5a5" }}>-{g.totalUsed}</td>
                  <td className="ax-mono" style={{ color: "#34d399" }}>{g.totalAdded > 0 ? `+${g.totalAdded}` : "—"}</td>
                  <td style={{ color: "#64748b", whiteSpace: "nowrap" }}>
                    {new Date(g.lastAt).toLocaleString()}
                    <div style={{ fontSize: 10, color: online ? "#34d399" : "#64748b" }}>
                      {online ? "online now" : `${mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`} ago`}
                    </div>
                  </td>
                  <td className="ax-mono">{g.lastBalance ?? "—"}</td>
                  <td className="ax-mono">{g.rows.length}</td>
                </tr>
                {open && (
                  <tr key={g.userId + "-detail"}>
                    <td colSpan={7} style={{ background: "rgba(2,6,23,.4)", padding: 12 }}>
                      <div style={{ maxHeight: 320, overflowY: "auto" }}>
                        <table className="ax-table" style={{ margin: 0 }}>
                          <thead>
                            <tr><th>When</th><th>Amount</th><th>Balance after</th><th>Reason</th><th>Source</th></tr>
                          </thead>
                          <tbody>
                            {g.rows.map((r) => (
                              <tr key={r.id}>
                                <td style={{ color: "#64748b", whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleString()}</td>
                                <td className="ax-mono" style={{ color: r.amount < 0 ? "#fca5a5" : r.amount > 0 ? "#34d399" : "#64748b" }}>
                                  {r.amount > 0 ? `+${r.amount}` : r.amount}
                                </td>
                                <td className="ax-mono">{r.balanceAfter ?? "—"}</td>
                                <td>{r.reason ?? "—"}</td>
                                <td style={{ color: "#64748b" }}>{r.source ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="ax-label">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="ax-input" />
    </div>
  );
}

/**
 * Time-based input for granting access. Users don't see raw credit numbers —
 * they set Days / Hours / Minutes. Internally 1 credit = 1 minute.
 */
function TimeInput({
  label = "Access time",
  minutes,
  onChange,
  presets = [
    { label: "12h", m: 12 * 60 },
    { label: "1d", m: 24 * 60 },
    { label: "7d", m: 7 * 24 * 60 },
    { label: "30d", m: 30 * 24 * 60 },
  ],
}: {
  label?: string;
  minutes: number;
  onChange: (m: number) => void;
  presets?: { label: string; m: number }[];
}) {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const commit = (nd: number, nh: number, nm: number) => {
    const total = Math.max(0, nd * 1440 + nh * 60 + nm);
    onChange(total);
  };
  return (
    <div className="ax-time">
      <label className="ax-label">{label}</label>
      <div className="ax-time-row">
        <div className="ax-time-cell">
          <input
            type="number" min={0}
            value={d}
            onChange={(e) => commit(Math.max(0, Number(e.target.value) || 0), h, m)}
            className="ax-input"
            inputMode="numeric"
          />
          <span className="ax-time-suffix">days</span>
        </div>
        <div className="ax-time-cell">
          <input
            type="number" min={0} max={23}
            value={h}
            onChange={(e) => commit(d, Math.max(0, Math.min(23, Number(e.target.value) || 0)), m)}
            className="ax-input"
            inputMode="numeric"
          />
          <span className="ax-time-suffix">hrs</span>
        </div>
        <div className="ax-time-cell">
          <input
            type="number" min={0} max={59}
            value={m}
            onChange={(e) => commit(d, h, Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
            className="ax-input"
            inputMode="numeric"
          />
          <span className="ax-time-suffix">min</span>
        </div>
      </div>
      <div className="ax-time-presets">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="ax-btn ax-btn-ghost ax-time-preset"
            onClick={() => onChange(p.m)}
          >{p.label}</button>
        ))}
        <span className="ax-time-total">= {minutesToLabel(minutes)}</span>
      </div>
    </div>
  );
}


const PLAN_OPTIONS = ["basic", "starter", "pro", "unlimited"];
const UNLIMITED_PLAN_SET = new Set(["unlimited", "ultra", "lifetime"]);
const QUICK_TOPUPS: { label: string; m: number }[] = [
  { label: "+1h", m: 60 },
  { label: "+12h", m: 12 * 60 },
  { label: "+1d", m: 24 * 60 },
  { label: "+7d", m: 7 * 24 * 60 },
  { label: "+30d", m: 30 * 24 * 60 },
];

function minutesToLabel(mins: number) {
  if (mins <= 0) return "0m";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 && d === 0) parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}


function relativeTime(iso: string | null) {
  if (!iso) return "never";
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ${diffSec % 60}s ago`;
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    return `${h}h ${m}m ago`;
  }
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function isOnline(iso: string | null | undefined) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 60_000;
}

function useLiveTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}


function UserRow({
  user, isSelf, rotating, onSave, onRotate, onDelete,
}: {
  user: {
    userId: string; email: string | null; displayName: string | null; credits: number;
    plan: string; isAdmin: boolean; lastTickAt?: string | null;
    usedLast24h?: number; lastUsedAt?: string | null;
  };
  isSelf: boolean;
  rotating: boolean;
  onSave: (p: { credits?: number; plan?: string; displayName?: string }) => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const [credits, setCredits] = useState(String(user.credits));
  const [plan, setPlan] = useState(user.plan);
  // Keep inputs in sync as server auto-refreshes (unless user is editing).
  useEffect(() => {
    setCredits((prev) => (Number(prev) === user.credits ? prev : String(user.credits)));
  }, [user.credits]);
  useEffect(() => { setPlan((prev) => (prev === user.plan ? prev : user.plan)); }, [user.plan]);

  useLiveTick(1000);
  const dirty = credits !== String(user.credits) || plan !== user.plan;
  const currentCredits = Number(credits) || 0;
  const isUnlimited = UNLIMITED_PLAN_SET.has(plan.toLowerCase());
  const exhausted = !isUnlimited && currentCredits <= 0;
  const options = PLAN_OPTIONS.includes(plan) ? PLAN_OPTIONS : [plan, ...PLAN_OPTIONS];
  const used24h = user.usedLast24h ?? 0;
  const online = isOnline(user.lastTickAt);

  const topUp = (amount: number) => {
    const next = currentCredits + amount;
    setCredits(String(next));
    onSave({ credits: next, plan });
  };

  return (
    <div className="ax-user-card" data-online={online ? "true" : "false"}>
      <div className="ax-user-head">
        <div className="ax-user-ident">
          <span
            className="ax-user-dot"
            title={online ? "Online now" : "Offline"}
            style={{ background: online ? "#22c55e" : "#475569", boxShadow: online ? "0 0 10px #22c55e" : "none" }}
          />
          <div className="ax-user-ident-text">
            <div className="ax-user-email ax-mono">{user.email}</div>
            <div className="ax-user-name">{user.displayName ?? "no name"}</div>
          </div>
        </div>
        <div className="ax-user-tags">
          {user.isAdmin && <span className="ax-pill">admin</span>}
          {exhausted && <span className="ax-pill" style={{ background: "#7f1d1d", color: "#fecaca", borderColor: "rgba(239,68,68,.35)" }}>exhausted</span>}
          <span className="ax-pill" style={{ background: "rgba(148,163,184,.12)", color: "#cbd5e1", borderColor: "rgba(148,163,184,.2)" }}>
            {online ? "● online" : relativeTime(user.lastUsedAt ?? null)}
          </span>
        </div>
      </div>

      <div className="ax-user-grid">
        <div className="ax-user-cell">
          <span className="ax-user-cell-label">Access time</span>
          <TimeInput
            label=""
            minutes={Number(credits) || 0}
            onChange={(m) => setCredits(String(m))}
            presets={[
              { label: "+1h", m: 60 },
              { label: "+1d", m: 1440 },
              { label: "+7d", m: 10080 },
            ]}
          />
          <span className="ax-user-cell-sub">{isUnlimited ? "unlimited" : `≈ ${minutesToLabel(currentCredits)} left`}</span>
        </div>


        <label className="ax-user-cell">
          <span className="ax-user-cell-label">Plan</span>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="ax-input ax-user-input">
            {options.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="ax-user-cell-sub">last seen {relativeTime(user.lastTickAt ?? null)}</span>
        </label>

        <div className="ax-user-cell">
          <span className="ax-user-cell-label">Used 24h</span>
          <div className="ax-user-usage" style={{ color: used24h > 0 ? "#f59e0b" : "#94a3b8" }}>
            {used24h > 0 ? `-${used24h}` : "0"}
          </div>
          <span className="ax-user-cell-sub">{used24h > 0 ? minutesToLabel(used24h) : "idle"}</span>
        </div>
      </div>

      <div className="ax-user-actions">
        <div className="ax-user-topups">
          {QUICK_TOPUPS.map((t) => (
            <button
              key={t.label}
              onClick={() => topUp(t.m)}
              title={`Add ${minutesToLabel(t.m)} access`}
              className="ax-btn ax-btn-ghost ax-user-topup"
            >{t.label}</button>
          ))}

        </div>
        <div className="ax-user-cta">
          <button disabled={!dirty} onClick={() => onSave({ credits: currentCredits, plan })} className="ax-btn ax-btn-primary ax-user-btn">Save</button>
          <button disabled={rotating} onClick={onRotate} className="ax-btn ax-btn-ghost ax-user-btn" style={{ color: "#34d399" }}>{rotating ? "…" : "Rotate"}</button>
          {!isSelf && (
            <button onClick={onDelete} className="ax-btn ax-btn-danger ax-user-btn">Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}



function AdminCredentialsPanel({ currentEmail }: { currentEmail: string }) {
  const updateFn = useServerFn(updateAdminCredentials);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const mut = useMutation({
    mutationFn: (data: { email?: string; password?: string }) => updateFn({ data }),
    onSuccess: () => { setMsg("✅ Updated. Use new credentials next sign-in."); setPassword(""); },
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });
  return (
    <section className="ax-panel" style={{ marginTop: 20 }}>
      <div className="ax-panel-head">
        <div className="ax-panel-title">Admin account</div>
        <span style={{ color: "#64748b", fontSize: 12 }}>Current: {currentEmail}</span>
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", maxWidth: 620 }}>
        <div>
          <label className="ax-label">New email (optional)</label>
          <input className="ax-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={currentEmail} />
        </div>
        <div>
          <label className="ax-label">New password (optional)</label>
          <input className="ax-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 chars" />
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="ax-btn ax-btn-primary"
          disabled={mut.isPending || (!email.trim() && !password.trim())}
          onClick={() => {
            setMsg("");
            const payload: { email?: string; password?: string } = {};
            if (email.trim()) payload.email = email.trim();
            if (password.trim()) payload.password = password.trim();
            mut.mutate(payload);
          }}
        >{mut.isPending ? "Saving…" : "Update admin credentials"}</button>
        {msg && <span className="ax-msg" style={{ margin: 0 }}>{msg}</span>}
      </div>
    </section>
  );
}

function SettingsPanel() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getSiteSettings);
  const saveSettings = useServerFn(updateSiteSettings);
  const q = useQuery({ queryKey: ["site-settings"], queryFn: () => fetchSettings() });

  const [contact, setContact] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bkash, setBkash] = useState("");
  const [telegram, setTelegram] = useState("");
  const [offer, setOffer] = useState("");
  const [plans, setPlans] = useState<SitePlan[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (q.data) {
      setContact(q.data.contactNumber);
      setWhatsapp(q.data.whatsappNumber);
      setBkash(q.data.bkashNumber);
      setTelegram(q.data.telegramUrl);
      setOffer(q.data.offerText);
      setPlans(q.data.plans);
    }
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () =>
      saveSettings({
        data: {
          contactNumber: contact,
          whatsappNumber: whatsapp,
          bkashNumber: bkash,
          telegramUrl: telegram,
          offerText: offer,
          plans,
        },
      }),
    onSuccess: () => {
      setMsg("✅ Saved. Landing page will update within 60s (or refresh).");
      qc.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (e: Error) => setMsg(`❌ ${e.message}`),
  });

  const updatePlan = (i: number, patch: Partial<SitePlan>) => {
    setPlans((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };
  const removePlan = (i: number) => setPlans((prev) => prev.filter((_, idx) => idx !== i));
  const addPlan = () =>
    setPlans((prev) => [
      ...prev,
      { name: "NEW PLAN", credits: "1 day", duration: "access", price: "৳0", note: "" },
    ]);

  if (q.isLoading) return <div className="ax-empty">Loading settings…</div>;

  return (
    <>
      <h1 className="ax-page-title">Pricing & Contact</h1>
      <p className="ax-page-sub">Edit contact numbers, WhatsApp link, bKash, Telegram and all pricing plans. Changes appear on the landing page automatically.</p>

      <section className="ax-panel">
        <div className="ax-panel-title" style={{ marginBottom: 12 }}>Contact & payment</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          <Field label="Contact number (shown on site)" value={contact} onChange={setContact} />
          <Field label="WhatsApp number (upgrade clicks open this)" value={whatsapp} onChange={setWhatsapp} />
          <Field label="bKash number" value={bkash} onChange={setBkash} />
          <Field label="Telegram URL" value={telegram} onChange={setTelegram} />
        </div>
        <div style={{ marginTop: 14 }}>
          <label className="ax-label">Top offer strip text</label>
          <input value={offer} onChange={(e) => setOffer(e.target.value)} className="ax-input" />
        </div>
      </section>

      <section className="ax-panel" style={{ marginTop: 20 }}>
        <div className="ax-panel-head">
          <div className="ax-panel-title">Pricing plans</div>
          <button className="ax-btn ax-btn-ghost" onClick={addPlan}>+ Add plan</button>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {plans.map((p, i) => (
            <div key={i} style={{ padding: 14, border: "1px solid rgba(148,163,184,.2)", borderRadius: 10, background: "rgba(15,23,42,.35)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
                <Field label="Name" value={p.name} onChange={(v) => updatePlan(i, { name: v })} />
                <Field label="Credits / duration text" value={p.credits} onChange={(v) => updatePlan(i, { credits: v })} />
                <Field label="Duration subtitle" value={p.duration} onChange={(v) => updatePlan(i, { duration: v })} />
                <Field label="Price" value={p.price} onChange={(v) => updatePlan(i, { price: v })} />
                <Field label="Note" value={p.note ?? ""} onChange={(v) => updatePlan(i, { note: v })} />
                <Field label="Button text (CTA)" value={p.cta ?? ""} onChange={(v) => updatePlan(i, { cta: v })} />
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "#cbd5e1" }}>
                  <input type="checkbox" checked={!!p.free} onChange={(e) => updatePlan(i, { free: e.target.checked })} />
                  Free plan (routes to /auth)
                </label>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "#cbd5e1" }}>
                  <input type="checkbox" checked={!!p.featured} onChange={(e) => updatePlan(i, { featured: e.target.checked })} />
                  Featured (highlighted)
                </label>
                <button className="ax-btn ax-btn-ghost" style={{ marginLeft: "auto", color: "#fca5a5" }} onClick={() => removePlan(i)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <button className="ax-btn ax-btn-primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Saving…" : "💾 Save changes"}
        </button>
        {msg && <span className="ax-msg">{msg}</span>}
      </div>
    </>
  );
}

function LiveCookiePanel({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  const [data, setData] = useState<{ cookies: unknown[]; totalCookies: number; lastUpdated: string | null } | null>(null);
  const [resolvedEmails, setResolvedEmails] = useState<string[]>([]);
  const [resolvedAccounts, setResolvedAccounts] = useState<Array<{ email: string; status: "active" | "inactive"; source?: string; lastSeen?: string | null }>>([]);
  const [serverActive, setServerActive] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [copyMsg, setCopyMsg] = useState("");
  const resolveFn = useServerFn(resolveActiveCookieEmails);

  const load = React.useCallback(async () => {
    try {
      const e = (await (resolveFn as unknown as () => Promise<{
        emails: string[];
        accounts?: Array<{ email: string; status: "active" | "inactive"; source?: string; lastSeen?: string | null }>;
        active?: boolean;
        cookies?: unknown[];
        totalCookies?: number;
        lastUpdated?: string | null;
      }>)());
      setData({
        cookies: e.cookies ?? [],
        totalCookies: e.totalCookies ?? e.cookies?.length ?? 0,
        lastUpdated: e.lastUpdated ?? null,
      });
      setFetchedAt(Date.now());
      setResolvedEmails(e.emails ?? []);
      setResolvedAccounts(e.accounts ?? []);
      setServerActive(!!e.active);
    } catch {}
  }, [resolveFn]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(id); clearInterval(tick); };
  }, [load]);

  const cookies = (data?.cookies ?? []) as Array<{ name?: string; value?: string; domain?: string }>;
  const json = JSON.stringify(cookies, null, 2);

  const authCookieNames = cookies
    .map((c) => String(c?.name ?? ""))
    .filter((name) => /(^SID$|SIDCC|SAPISID|APISID|HSID|SSID|LSID|OSID|__Secure-\dP.*SID|ACCOUNT_CHOOSER|next-auth\.session-token)/i.test(name));
  const hasGoogleCookies = cookies.some((c) => {
    const domain = String(c?.domain ?? "");
    return domain.includes("google.com") || domain.includes("labs.google") || domain.endsWith(".google");
  });
  const active = serverActive || (cookies.length > 0 && (authCookieNames.length > 0 || hasGoogleCookies));
  const emailFromCookies = (() => {
    for (const c of cookies) {
      let v = "";
      try {
        v = typeof c?.value === "string" ? decodeURIComponent(c.value) : "";
      } catch {
        v = typeof c?.value === "string" ? c.value : "";
      }
      const m = v.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (m) return m[0];
    }
    return null;
  })();
  const email = resolvedEmails[0] ?? emailFromCookies ?? null;
  const nameGuess = email ? email.split("@")[0].replace(/[._\d]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase()) : null;
  const accounts = resolvedAccounts.length > 0
    ? resolvedAccounts
    : email
      ? [{ email, status: active ? "active" as const : "inactive" as const, source: "Google cookies", lastSeen: data?.lastUpdated }]
      : active
        ? [{ email: "Google session detected", status: "active" as const, source: "Email hidden by Google", lastSeen: data?.lastUpdated }]
        : [];
  const activeAccounts = accounts.filter((account) => account.status === "active").length;
  const inactiveAccounts = Math.max(0, accounts.length - activeAccounts);

  const cacheAgeMs = data?.lastUpdated ? now - new Date(data.lastUpdated).getTime() : fetchedAt ? now - fetchedAt : 0;
  const cacheAgeSec = Math.max(0, Math.floor(cacheAgeMs / 1000));
  const lastFetchedTime = data?.lastUpdated ? new Date(data.lastUpdated).toLocaleTimeString([], { hour12: false }) : "—";

  const flash = (m: string) => { setCopyMsg(m); setTimeout(() => setCopyMsg(""), 1500); };
  const copyText = async (t: string, label: string) => {
    try { await navigator.clipboard.writeText(t); flash(`✅ ${label} copied`); } catch { flash("❌ Copy failed"); }
  };
  const exportJson = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `veoly-cookies-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCard = (label: string, value: React.ReactNode) => (
    <div style={{
      padding: 20,
      borderRadius: 16,
      background: "rgba(15,23,42,.6)",
      border: "1px solid rgba(148,163,184,.15)",
    }}>
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: 12, fontSize: 32, color: "#f1f5f9", fontWeight: 700, lineHeight: 1.1 }}>{value}</div>
    </div>
  );

  return (
    <section className="ax-panel" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: "#f1f5f9", fontWeight: 700 }}>Veoly Auto-Sync Cookies</h2>
          <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: 14 }}>
            veoly.netlify.app থেকে auto-fetch হওয়া live cookies — যখন manually assign করা নাই।
          </p>
        </div>
        {copyMsg && <span className="ax-msg" style={{ margin: 0 }}>{copyMsg}</span>}
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={onSync}
          disabled={syncing}
          className="ax-btn ax-btn-primary"
          style={{ background: "linear-gradient(135deg,#7c5cfc,#a855f7)" }}
        >{syncing ? "Syncing…" : "⚡ Sync now"}</button>
        <button onClick={load} className="ax-btn ax-btn-ghost">↻ Reload</button>
        <button onClick={exportJson} disabled={cookies.length === 0} className="ax-btn ax-btn-ghost">↓ Export JSON</button>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        {kpiCard("Status", (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 16, height: 16, borderRadius: "50%", background: active ? "#22c55e" : "#ef4444", boxShadow: active ? "0 0 12px #22c55e" : "0 0 12px #ef4444" }} />
            {active ? "Active" : "Inactive"}
          </span>
        ))}
        {kpiCard("Total cookies", data?.totalCookies ?? 0)}
        {kpiCard("Accounts", <span style={{ fontSize: 26 }}>{activeAccounts} active / {inactiveAccounts} inactive</span>)}
        {kpiCard("Last fetched", <span style={{ fontSize: 26 }}>{lastFetchedTime}</span>)}
        {kpiCard("Cache age", <span style={{ fontSize: 26 }}>{cacheAgeSec}s / 600s</span>)}
      </div>

      <div style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 14,
        background: "rgba(76,29,149,.15)",
        border: "1px solid rgba(139,92,246,.25)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#a855f7", marginTop: 8, flexShrink: 0, boxShadow: "0 0 10px #a855f7" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#a5b4fc", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600 }}>
              Current Flow Account (API Cookies)
            </div>
            <div style={{ marginTop: 6, fontSize: 18, color: "#f1f5f9", fontWeight: 600, wordBreak: "break-all" }}>
              {email ?? (active ? "Google session detected" : "—")}
            </div>
            {nameGuess && <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>{nameGuess}</div>}
            <div style={{ marginTop: 14, display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "thin" }}>
              {accounts.length === 0 ? (
                <div style={{ minWidth: 220, padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.14)", background: "rgba(15,23,42,.45)", color: "#94a3b8" }}>
                  No Google account detected yet
                </div>
              ) : accounts.map((account, idx) => {
                const isActive = account.status === "active";
                return (
                  <div
                    key={`${account.email}-${idx}`}
                    style={{
                      minWidth: 260,
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${isActive ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.28)"}`,
                      background: isActive ? "rgba(20,83,45,.18)" : "rgba(127,29,29,.16)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: isActive ? "#86efac" : "#fca5a5", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                        {isActive ? "● Active" : "● Inactive"}
                      </span>
                      <span style={{ color: "#64748b", fontSize: 11 }}>{account.source ?? "Google cookies"}</span>
                    </div>
                    <div style={{ marginTop: 8, color: "#f8fafc", fontWeight: 700, wordBreak: "break-all" }}>{account.email}</div>
                    <div style={{ marginTop: 5, color: "#94a3b8", fontSize: 12 }}>
                      {isActive ? "Active since" : "Last active"}: {account.lastSeen ? relativeTime(account.lastSeen) : "now"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="ax-btn ax-btn-ghost"
                disabled={!email}
                onClick={() => email && copyText(email, "Gmail")}
              >⧉ Copy Gmail</button>
              <button
                className="ax-btn ax-btn-ghost"
                disabled={!email || cookies.length === 0}
                onClick={() => email && copyText(`${email}\n\n${json}`, "Gmail + Cookies")}
              >⧉ Copy Gmail + Cookies</button>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
