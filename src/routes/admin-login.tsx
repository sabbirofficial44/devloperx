import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDefaultAdmin } from "@/lib/ensure-admin.functions";

const DEFAULT_ADMIN_EMAIL = "admin@gmail.com";
const DEFAULT_ADMIN_PASSWORD = "admin1122";

export const Route = createFileRoute("/admin-login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Admin Login — DeveloperX" },
      { name: "description", content: "Restricted admin access for DeveloperX." },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try { await ensureDefaultAdmin(); } catch {}
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (role) navigate({ to: "/admin", replace: true });
    })();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try { await ensureDefaultAdmin(); } catch {}
    const { data, error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signErr || !data.user) {
      setLoading(false);
      setError(signErr?.message ?? "Invalid credentials");
      return;
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("This account is not an admin.");
      return;
    }
    navigate({ to: "/admin", replace: true });
  };

  return (
    <div className="dx-auth-shell">
      <div className="dx-auth-topbar">
        <a href="/" className="dx-auth-brand">
          <span className="dx-auth-brand-mark">D</span>
          <span>DeveloperX</span>
        </a>
        <a href="/auth" className="dx-auth-topcta">User Login →</a>
      </div>
      <div className="dx-auth-card">
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 2, color: "#67e8f9", fontWeight: 700, padding: "4px 12px", background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", borderRadius: 999 }}>
            🔒 RESTRICTED
          </div>
        </div>
        <h1>Admin Console</h1>
        <div className="dx-auth-sub">Sign in with your admin credentials</div>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <div>
            <label className="dx-label">Email</label>
            <input type="email" required placeholder="admin@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} className="dx-input" />
          </div>
          <div>
            <label className="dx-label">Password</label>
            <input type="password" required placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} className="dx-input" />
          </div>
          {error && <div className="dx-msg-err">{error}</div>}
          <button type="submit" disabled={loading} className="dx-btn dx-btn-purple" style={{ width: "100%", padding: 12, marginTop: 4 }}>
            {loading ? "Signing in…" : "Enter Admin Console"}
          </button>
        </form>
        <div className="dx-links">
          Regular user? <a href="/auth">User login</a>
        </div>
      </div>
    </div>
  );
}

