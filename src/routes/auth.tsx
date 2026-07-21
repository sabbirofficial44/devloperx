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

type Tab = "signin" | "signup" | "forgot";

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
  const [forgotCooldown, setForgotCooldown] = useState(0);

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

  useEffect(() => {
    if (forgotCooldown <= 0) return;
    const t = setInterval(() => setForgotCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [forgotCooldown]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
    setInfo("");
  };

  const resendVerification = async () => {
    if (!pendingEmail || cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    try {
      const res = await fetch("/api/public/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.message || "Could not resend. Try again later.");
        setCooldown(30);
      } else {
        setInfo(`✉️ Verification link re-sent to ${pendingEmail}. Check your Gmail (Inbox + Spam).`);
        setCooldown(60);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    if (tab === "forgot") {
      const em = email.trim().toLowerCase();
      if (!em || !em.includes("@")) {
        setLoading(false);
        setError("Enter a valid email.");
        return;
      }
      try {
        const res = await fetch("/api/public/auth/reset-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: em }),
        });
        const j = await res.json().catch(() => ({}));
        setLoading(false);
        if (!res.ok) {
          setError(j.message || "Could not send reset link. Try again.");
          return;
        }
        setInfo(`✉️ If an account exists for ${em}, a reset link has been sent. Check your Gmail (Inbox + Spam). Link expires in 1 hour.`);
        setForgotCooldown(60);
      } catch {
        setLoading(false);
        setError("Network error. Try again.");
      }
      return;
    }

    if (tab === "signin") {
      const { data, error: siErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (siErr || !data.user) {
        setLoading(false);
        const msg = siErr?.message?.toLowerCase() ?? "";
        if (msg.includes("not confirmed") || msg.includes("confirm")) {
          setPendingEmail(email.trim().toLowerCase());
          setError("Please confirm your email first. Check your Gmail inbox (and Spam folder) for the verification link.");
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

    // signup — hard validation
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

    try {
      const res = await fetch("/api/public/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password, name: name.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      setLoading(false);
      if (!res.ok) {
        setError(j.message || "Signup failed. Try again.");
        return;
      }
      setPendingEmail(em);
      setCooldown(60);
      setInfo(`✉️ A confirmation link has been sent to ${em}. Open your Gmail (check Spam too), click the link, then sign in below.`);
      setTab("signin");
      setPassword("");
    } catch {
      setLoading(false);
      setError("Network error. Try again.");
    }
    return;
  };


  return (
    <div className="dx-auth-shell">
      <div className="dx-auth-topbar">
        <Link to="/" className="dx-auth-brand">
          <img src="/developerx-logo.png" alt="DeveloperX" width={36} height={36} style={{ borderRadius: 10, boxShadow: "0 4px 16px rgba(240,185,11,0.4)" }} />
          <span>DeveloperX</span>
        </Link>
      </div>
      <div className="dx-auth-body">
        <div className="dx-auth-card">
          <div className="dx-tabs" role="tablist">
            <div className={`dx-tabs-indicator ${tab === "signup" ? "right" : tab === "forgot" ? "left" : "left"}`} />
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signin" || tab === "forgot"}
              className={`dx-tab ${tab === "signin" || tab === "forgot" ? "active" : ""}`}
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
            <h1 key={tab}>
              {tab === "signin" ? "Welcome Back" : tab === "signup" ? "Create Account" : "Forgot Password"}
            </h1>
            <div className="dx-auth-sub">
              {tab === "signin"
                ? "Sign in to your DeveloperX account"
                : tab === "signup"
                ? "Join DeveloperX in seconds"
                : "We'll email you a secure reset link"}
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
              {tab !== "forgot" && (
                <div className="dx-field">
                  <label className="dx-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Password</span>
                    {tab === "signin" && (
                      <button
                        type="button"
                        onClick={() => switchTab("forgot")}
                        style={{ background: "none", border: 0, color: "#a78bfa", fontSize: 12, cursor: "pointer", padding: 0, fontWeight: 600 }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </label>
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
              )}
            </div>

            {error && <div className="dx-msg-err">{error}</div>}
            {info && <div className="dx-msg-err" style={{ background: "rgba(34,197,94,.12)", borderColor: "rgba(34,197,94,.35)", color: "#86efac" }}>{info}</div>}

            <button
              type="submit"
              disabled={loading || (tab === "forgot" && forgotCooldown > 0)}
              className="dx-btn dx-btn-purple"
              style={{ width: "100%", padding: 12, marginTop: 4 }}
            >
              {loading
                ? tab === "signin" ? "Signing in…" : tab === "signup" ? "Creating…" : "Sending…"
                : tab === "signin"
                ? "Sign In"
                : tab === "signup"
                ? "Create Account"
                : forgotCooldown > 0
                ? `Resend in ${forgotCooldown}s`
                : "✉️ Send Reset Link"}
            </button>

            {tab === "forgot" && (
              <button
                type="button"
                onClick={() => switchTab("signin")}
                className="dx-btn"
                style={{
                  width: "100%", padding: 10, marginTop: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#e5e7eb", cursor: "pointer", fontSize: 13,
                }}
              >
                ← Back to Sign In
              </button>
            )}

            {tab === "signin" && pendingEmail && (
              <button
                type="button"
                onClick={resendVerification}
                disabled={cooldown > 0 || resending}
                className="dx-btn"
                style={{
                  width: "100%",
                  padding: 10,
                  marginTop: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: cooldown > 0 ? "#9ca3af" : "#e5e7eb",
                  cursor: cooldown > 0 || resending ? "not-allowed" : "pointer",
                  fontSize: 13,
                }}
              >
                {resending
                  ? "Sending…"
                  : cooldown > 0
                  ? `Resend Verification in ${cooldown}s`
                  : `✉️ Resend Verification Email`}
              </button>
            )}
          </form>

          <div className="dx-links">
            <Link to="/">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
