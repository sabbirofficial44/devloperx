import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create Account — DeveloperX" },
      { name: "description", content: "Create your DeveloperX account." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
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
    const { data, error: sErr } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (sErr || !data.user) {
      setLoading(false);
      setError(sErr?.message ?? "Signup failed");
      return;
    }
    if (!data.session) {
      const { error: siErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (siErr) { setLoading(false); setError("Account created. Please sign in."); navigate({ to: "/auth" }); return; }
    }
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="dx-auth-shell">
      <div className="dx-auth-topbar">
        <Link to="/" className="dx-auth-brand">
          <span className="dx-auth-brand-mark">D</span>
          <span>DeveloperX</span>
        </Link>
        <Link to="/auth" className="dx-auth-topcta">Sign In →</Link>
      </div>
      <div className="dx-auth-body">
        <div className="dx-auth-card">
          <h1>Create Account</h1>
          <div className="dx-auth-sub">Get started with DeveloperX</div>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 14, marginTop: 12 }}>
            <div>
              <label className="dx-label">Email</label>
              <input type="email" autoComplete="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="dx-input" />
            </div>
            <div>
              <label className="dx-label">Password</label>
              <input type="password" autoComplete="new-password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Choose a password" className="dx-input" />
            </div>
            {error && <div className="dx-msg-err">{error}</div>}
            <button type="submit" disabled={loading} className="dx-btn dx-btn-purple" style={{ width: "100%", padding: 12 }}>
              {loading ? "Creating…" : "Create Account"}
            </button>
          </form>
          <div className="dx-links">
            <Link to="/">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
