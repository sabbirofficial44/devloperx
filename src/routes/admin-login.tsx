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
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, position: "relative", background: "var(--dx-dashboard-bg, #08090d)" }}>
      <div className="dx-ambient" aria-hidden />
      <div className="dx-auth-card" style={{ maxWidth: 440, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: "#22d3ee", fontWeight: 700 }}>RESTRICTED</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>Admin Console</h1>
          <p style={{ color: "#94a3b8", marginTop: 6, fontSize: 14 }}>
            Sign in with your admin credentials.
          </p>
        </div>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            type="email"
            required
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="ax-input"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="ax-input"
          />
          {error && <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="dx-btn-premium"
            style={{ marginTop: 4 }}
          >
            {loading ? "Signing in…" : "Enter Admin Console"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#64748b" }}>
          Regular user? <a href="/auth" style={{ color: "#22d3ee" }}>User login</a>
        </div>
      </div>
    </div>
  );
}
