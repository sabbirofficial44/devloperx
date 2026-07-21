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
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("tab") === "signup") setTab("signup");
    }
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
    setInfo("");
  };

  const resendVerification = async () => {
    if (!pendingEmail || cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    const { error: rErr } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    setResending(false);
    if (rErr) {
      const m = rErr.message?.toLowerCase() ?? "";
      if (m.includes("rate") || m.includes("seconds")) {
        setError("Too many requests. Please wait a moment before trying again.");
        setCooldown(60);
      } else {
        setError(rErr.message);
      }
      return;
    }
    setInfo(`✉️ Verification link re-sent to ${pendingEmail}. Check your Gmail (including Spam).`);
    setCooldown(60);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    if (tab === "signin") {
      const { data, error: siErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (siErr || !data.user) {
        setLoading(false);
        const msg = siErr?.message?.toLowerCase() ?? "";
        if (msg.includes("not confirmed") || msg.includes("confirm")) {
          setError("Please confirm your email first. Check your Gmail inbox for the verification link.");
        } else {
          setError("Invalid email or password.");
        }
        return;
      }
      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      navigate({ to: role ? "/admin" : "/dashboard", replace: true });
      return;
    }

    // signup — hard validation (only enforced on public signup, not admin-created)
    const em = email.trim().toLowerCase();
    if (!em.endsWith("@gmail.com")) {
      setLoading(false);
      setError("Only @gmail.com addresses are allowed.");
      return;
    }
    const local = em.slice(0, em.indexOf("@"));
    if (!local || local.includes(".") || local.includes("+")) {
      setLoading(false);
      setError("Gmail address cannot contain dots (.) or plus (+).");
      return;
    }
    if (!/^[a-z0-9_-]{3,}$/i.test(local)) {
      setLoading(false);
      setError("Gmail username must be at least 3 letters/numbers, no special chars.");
      return;
    }
    if (password.length < 6) {
      setLoading(false);
      setError("Password must be at least 6 characters.");
      return;
    }

    const { data, error: sErr } = await supabase.auth.signUp({
      email: em,
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
    // Email verification required — do NOT auto sign-in
    setLoading(false);
    setError("");
    setInfo(`✉️ A confirmation link has been sent to ${em}. Please open your Gmail and click the link to activate your account, then sign in below.`);
    setTab("signin");
    setPassword("");
    return;
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
            {info && <div className="dx-msg-err" style={{ background: "rgba(34,197,94,.12)", borderColor: "rgba(34,197,94,.35)", color: "#86efac" }}>{info}</div>}

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
