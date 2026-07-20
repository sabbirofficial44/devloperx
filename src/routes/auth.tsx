import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — DeveloperX" },
      { name: "description", content: "Sign in to your DeveloperX account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: siErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (siErr || !data.user) {
      setLoading(false);
      setError("Invalid email or password.");
      return;
    }
    const { data: role } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    navigate({ to: role ? "/admin" : "/dashboard", replace: true });
  };

  return (
    <div className="dx-auth-shell">
      <div className="dx-auth-card">
        <h1>Welcome Back</h1>
        <div className="dx-auth-sub">Sign in to your DeveloperX account</div>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 12 }}>
          <div>
            <label className="dx-label">Email</label>
            <input type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="dx-input" />
          </div>
          <div>
            <label className="dx-label">Password</label>
            <input type="password" autoComplete="current-password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="dx-input" />
          </div>
          {error && <div className="dx-msg-err">{error}</div>}
          <button type="submit" disabled={loading} className="dx-btn dx-btn-purple" style={{ width: "100%", padding: 12 }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <div className="dx-links">
          No account? <Link to="/signup">Create one</Link> · <Link to="/">Home</Link>
        </div>
      </div>
    </div>
  );
}
