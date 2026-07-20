import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign In — DeveloperX" },
      { name: "description", content: "Sign in or create your DeveloperX account." },
    ],
  }),
  component: AuthPage,
});

type Tab = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tab") === "signup") setTab("signup");
    }
  }, [navigate]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (tab === "signin") {
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
      return;
    }

    // signup
    const { data, error: sErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name.trim() },
      },
    });
    if (sErr || !data.user) {
      setLoading(false);
      setError(sErr?.message ?? "Signup failed");
      return;
    }
    if (!data.session) {
      const { error: siErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (siErr) {
        setLoading(false);
        setError("Account created. Please sign in.");
        setTab("signin");
        return;
      }
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
      </div>
      <div className="dx-auth-body">
        <div className="dx-auth-card">
          <div className="dx-tabs" role="tablist">
            <div className={`dx-tabs-indicator ${tab === "signup" ? "right" : "left"}`} />
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signin"}
              className={`dx-tab ${tab === "signin" ? "active" : ""}`}
              onClick={() => switchTab("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signup"}
              className={`dx-tab ${tab === "signup" ? "active" : ""}`}
              onClick={() => switchTab("signup")}
            >
              Sign Up
            </button>
          </div>

          <div className="dx-tab-header">
            <h1 key={tab}>{tab === "signin" ? "Welcome Back" : "Create Account"}</h1>
            <div className="dx-auth-sub">
              {tab === "signin" ? "Sign in to your DeveloperX account" : "Join DeveloperX in seconds"}
            </div>
          </div>

          <form onSubmit={onSubmit} className="dx-auth-form">
            <div key={tab} className="dx-form-fields">
              {tab === "signup" && (
                <div className="dx-field">
                  <label className="dx-label">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="dx-input"
                  />
                </div>
              )}
              <div className="dx-field">
                <label className="dx-label">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="dx-input"
                />
              </div>
              <div className="dx-field">
                <label className="dx-label">Password</label>
                <input
                  type="password"
                  autoComplete={tab === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === "signin" ? "Password" : "Choose a password"}
                  className="dx-input"
                />
              </div>
            </div>

            {error && <div className="dx-msg-err">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="dx-btn dx-btn-purple"
              style={{ width: "100%", padding: 12, marginTop: 4 }}
            >
              {loading
                ? tab === "signin" ? "Signing in…" : "Creating…"
                : tab === "signin" ? "Sign In" : "Create Account"}
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
