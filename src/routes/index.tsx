import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSiteSettings } from "@/lib/site-settings.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DeveloperX — Unlimited AI Video Generation" },
      { name: "description", content: "Get unlimited Google Flow (Veo 3, Omni, Flash) access. 12-hour free trial daily, then daily / weekly / monthly plans starting from ৳50." },
      { property: "og:title", content: "DeveloperX — Unlimited AI Video Generation" },
      { property: "og:description", content: "12-hour daily free trial, then affordable daily/weekly/monthly plans." },
    ],
  }),
  component: Index,
});

const FALLBACK_PLANS = [
  { name: "FREE TRIAL", credits: "12 hr", duration: "daily free", price: "৳0", note: "auto renews daily", cta: "Start Free", free: true },
  { name: "DAILY", credits: "24 hr", duration: "full-day access", price: "৳50", note: "complete 24 hours", cta: "Get Daily" },
  { name: "WEEKLY", credits: "7 days", duration: "weekly access", price: "৳200", note: "full week unlimited", cta: "Get Weekly" },
  { name: "MONTHLY", credits: "30 days", duration: "monthly access", price: "৳500", note: "Most popular", cta: "Get Monthly", featured: true },
  { name: "PRO", credits: "365 days", duration: "1 full year", price: "৳2,000", note: "Best value yearly" },
  { name: "UNLIMITED", credits: "∞", duration: "lifetime access", price: "৳5,000", note: "One-time payment" },
];

function normalizeWa(raw: string) {
  const digits = (raw || "").replace(/[^0-9]/g, "");
  const num = !digits
    ? "8801410014442"
    : digits.startsWith("880")
      ? digits
      : `880${digits.replace(/^0/, "")}`;
  return `https://wa.me/${num}?text=${encodeURIComponent("Hi, I want to upgrade my DeveloperX plan.")}`;
}

function openWa(url: string) {
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      if (window.top) window.top.location.href = url;
      else window.location.href = url;
    }
  } catch {
    window.location.href = url;
  }
}

function Index() {
  const fetchSettings = useServerFn(getSiteSettings);
  const settingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 60_000,
  });
  const s = settingsQuery.data;
  const CONTACT_NUMBER = s?.contactNumber ?? "01410014442";
  const BKASH_NUMBER = s?.bkashNumber ?? "01775113977";
  const WA_LINK = normalizeWa(s?.whatsappNumber ?? CONTACT_NUMBER);
  const TELEGRAM_URL = s?.telegramUrl ?? "https://t.me/DeveloperX";
  const OFFER_TEXT = s?.offerText ?? "12 hours FREE trial daily · No card required";
  const plans = s?.plans && s.plans.length > 0 ? s.plans : FALLBACK_PLANS;


  const features = [
    { title: "🎬 All Models Unlocked", copy: "Veo 3, Omni, Flash — every Google AI video model, no watermarks, no gates." },
    { title: "⚡ Instant Access", copy: "Install extension, login, generate. 30-second setup." },
    { title: "🔐 Managed Sessions", copy: "Auto cookie injection & rotation — you never touch Google Flow auth." },
    { title: "📊 Live Credit HUD", copy: "Floating overlay on Google Flow shows credits + minutes left in real-time." },
    { title: "💰 Affordable BDT", copy: "Local pricing from ৳50/day. Pay via bKash — no cards needed." },
    { title: "💬 24/7 Bangla Support", copy: "Direct call, WhatsApp, or Telegram. Real human, real fast." },
  ];

  const marqueeItems = ["Veo 3", "Omni", "Flash", "1080p", "No Watermark", "Bangla Support", "bKash Payment", "Instant Activation"];

  return (
    <div className="dx-page">
      <div className="dx-ambient" aria-hidden />

      {/* Top offer strip */}
      <div className="dx-offer-strip">
        <div className="dx-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 13, fontWeight: 600 }}>
          <span className="dx-shimmer-text" style={{ fontWeight: 800 }}>🔥 LAUNCH OFFER</span>
          <span style={{ color: "#e2e8f0" }}>{OFFER_TEXT}</span>
          <a href={WA_LINK} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(WA_LINK); }} style={{ color: "#f0b90b", textDecoration: "underline" }}>Talk to us →</a>
        </div>
      </div>


      <div className="dx-container">
        <nav className="dx-nav">
          <div className="dx-logo dx-rise" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/developerx-logo.png" alt="DeveloperX" width={36} height={36} style={{ borderRadius: 10, boxShadow: "0 4px 16px rgba(240,185,11,0.4)" }} />
            <span>DeveloperX</span>
          </div>
          <div className="dx-nav-links">
            <a className="dx-nav-link" href="#pricing">Pricing</a>
            <a className="dx-nav-link" href="#features">Features</a>
            <a className="dx-nav-link" href="#contact">Contact</a>
            <Link className="dx-nav-link" to="/auth">Login</Link>
            <Link className="dx-btn dx-btn-purple" to="/auth">Get Started</Link>
          </div>
        </nav>

        <main>
          {/* HERO */}
          <section className="dx-hero" style={{ position: "relative", paddingTop: 60, paddingBottom: 40 }}>
            <div className="dx-hero-orbs">
              <div className="dx-orb dx-float" style={{ width: 380, height: 380, top: -80, left: "-8%", background: "radial-gradient(circle,#7c5cfc,transparent)" }} />
              <div className="dx-orb" style={{ width: 320, height: 320, bottom: -60, right: "-6%", background: "radial-gradient(circle,#f0b90b,transparent)", animationDelay: "2s" }} />
              <div className="dx-orb dx-float" style={{ width: 200, height: 200, top: "40%", right: "20%", background: "radial-gradient(circle,#22d3ee,transparent)", animationDelay: "1s" }} />
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div className="dx-free-ribbon dx-rise" style={{ marginBottom: 22 }}>
                <span>✨</span> 12-Hour Daily FREE Trial · No credit card
              </div>
              <h1 className="dx-hero-mega dx-rise-2">
                Unlimited AI Video<br />with Google Flow
              </h1>
              <p className="dx-hero-copy dx-rise-3" style={{ maxWidth: 640, margin: "24px auto 0" }}>
                Access <strong style={{ color: "#f0b90b" }}>Veo 3</strong>, <strong style={{ color: "#a78bfa" }}>Omni</strong> & <strong style={{ color: "#22d3ee" }}>Flash</strong> through one Chrome extension. Live credit tracking, floating HUD on Flow, and Bangla support.
              </p>
              <div className="dx-badges dx-rise-3" style={{ marginTop: 22 }}>
                {["Veo 3", "Omni", "Flash", "24/7 Bangla Support", "bKash Payment"].map((b) => (
                  <span className="dx-badge" key={b}><span className="dx-dot" /> {b}</span>
                ))}
              </div>
              <div className="dx-rise-4" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 34 }}>
                <Link className="dx-btn dx-btn-gold dx-cta-glow" style={{ fontSize: 16, padding: "16px 38px" }} to="/auth">
                  🚀 Start 12-Hour Free Trial
                </Link>
                <a className="dx-btn dx-btn-outline" style={{ fontSize: 15, padding: "16px 32px" }} href="#pricing">
                  View Plans
                </a>
              </div>
              <div className="dx-rise-4" style={{ marginTop: 26, fontSize: 13, color: "var(--dx-muted-soft,#94a3b8)" }}>
                💳 Payment via <strong style={{ color: "#e2136e" }}>bKash</strong> {BKASH_NUMBER} ·
                Contact: <a href={WA_LINK} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(WA_LINK); }} style={{ color: "#f0b90b", fontWeight: 700 }}>{CONTACT_NUMBER}</a>
              </div>

            </div>
          </section>

          {/* Marquee */}
          <section style={{ padding: "40px 0" }}>
            <div className="dx-marquee-wrap">
              <div className="dx-marquee-track">
                {[...marqueeItems, ...marqueeItems].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, fontWeight: 700, color: "rgba(226,232,240,.5)", whiteSpace: "nowrap" }}>
                    <span style={{ color: "#f0b90b" }}>✦</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* STATS BAR */}
          <section className="dx-section" style={{ paddingTop: 20, paddingBottom: 20 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
              gap: 18,
              padding: "34px 26px",
              borderRadius: 22,
              background: "linear-gradient(135deg,rgba(124,92,252,.12),rgba(240,185,11,.08))",
              border: "1px solid rgba(124,92,252,.25)",
              backdropFilter: "blur(14px)",
            }}>
              {[
                ["2,400+", "Active Users", "#a78bfa"],
                ["180K+", "Videos Generated", "#f0b90b"],
                ["99.9%", "Uptime", "#4ade80"],
                ["24/7", "Bangla Support", "#22d3ee"],
              ].map(([n, l, c], i) => (
                <div key={i} className="dx-rise" style={{ textAlign: "center", animationDelay: `${i * 80}ms` }}>
                  <div style={{ fontSize: 34, fontWeight: 900, color: c, lineHeight: 1 }}>{n}</div>
                  <div style={{ marginTop: 8, fontSize: 13, color: "#cbd5e1", letterSpacing: ".5px", textTransform: "uppercase" }}>{l}</div>
                </div>
              ))}
            </div>
          </section>


          {/* PRICING */}
          <section className="dx-section" id="pricing">
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <span className="dx-free-ribbon" style={{ background: "linear-gradient(135deg,rgba(124,92,252,.2),rgba(124,92,252,.08))", borderColor: "rgba(124,92,252,.4)", color: "#a78bfa" }}>
                💎 CHOOSE YOUR PLAN
              </span>
            </div>
            <h2 className="dx-section-title" style={{ marginTop: 14 }}>Simple, Affordable Pricing</h2>
            <p className="dx-section-subtitle">
              Start with a <strong style={{ color: "#4ade80" }}>12-hour daily free trial</strong>. To unlock daily / weekly / monthly plans,
              bKash <strong style={{ color: "#e2136e" }}>{BKASH_NUMBER}</strong> এ payment করে contact করুন <a href={WA_LINK} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(WA_LINK); }} style={{ color: "#f0b90b", fontWeight: 700 }}>{CONTACT_NUMBER}</a>
            </p>


            <div className="dx-pricing-grid" style={{ marginTop: 40 }}>
              {plans.map((plan, i) => (
                <div
                  className={`dx-price-card-premium ${plan.featured ? "featured" : ""} dx-rise`}
                  key={plan.name}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {plan.featured && <div className="dx-plan-badge-top">★ POPULAR</div>}
                  {plan.free && <div className="dx-plan-badge-top" style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" }}>FREE</div>}
                  <div className="dx-plan-name" style={{ color: plan.free ? "#4ade80" : plan.featured ? "#f0b90b" : "#a78bfa" }}>{plan.name}</div>
                  <div className="dx-plan-credits" style={{ fontSize: plan.credits.length > 5 ? 38 : 46, fontWeight: 800, margin: "8px 0 4px" }}>{plan.credits}</div>
                  <div className="dx-plan-duration">{plan.duration}</div>
                  <div className="dx-plan-price" style={{ margin: "18px 0 6px" }}>{plan.price}</div>
                  <div style={{ fontSize: 12, color: "var(--dx-muted-soft,#94a3b8)", marginBottom: 18 }}>{plan.note}</div>
                  {plan.free ? (
                    <Link className="dx-btn dx-btn-gold" style={{ width: "100%" }} to="/auth">
                      {plan.cta ?? "Start Free"}
                    </Link>
                  ) : (
                    <a
                      className="dx-btn dx-btn-purple"
                      style={{ width: "100%" }}
                      href={WA_LINK}
                      target="_blank"
                      rel="noreferrer"
                    >
                      💬 Contact — {CONTACT_NUMBER}
                    </a>
                  )}

                </div>
              ))}
            </div>

            <div style={{ marginTop: 30, textAlign: "center", fontSize: 13, color: "var(--dx-muted-soft,#94a3b8)" }}>
              Free trial: 1 credit = 1 minute · Paid plans: full duration unlimited access · bKash: <strong style={{ color: "#e2136e" }}>{BKASH_NUMBER}</strong> · Contact: <strong>{CONTACT_NUMBER}</strong>
            </div>


          </section>

          {/* CONTACT / bKash section */}
          <section className="dx-section" id="contact">
            <div className="dx-contact-card dx-rise">
              <div style={{ fontSize: 40, marginBottom: 10 }}>💳</div>
              <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 10px", color: "#fff" }}>
                Ready to <span className="dx-shimmer-text">Upgrade?</span>
              </h2>
              <p style={{ color: "#cbd5e1", maxWidth: 520, margin: "0 auto 22px" }}>
                Free trial-এর পর daily / weekly / monthly plan নিতে চাইলে bKash payment করে আমাদের সাথে যোগাযোগ করুন। Instant activation।
              </p>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <a className="dx-bkash-btn" href={WA_LINK} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(WA_LINK); }}>
                  📱 bKash: {BKASH_NUMBER}
                </a>
                <a className="dx-btn dx-btn-outline" href={WA_LINK} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(WA_LINK); }} style={{ padding: "14px 28px", fontSize: 15 }}>
                  💬 WhatsApp {CONTACT_NUMBER}
                </a>
                <a className="dx-btn dx-btn-outline" href={TELEGRAM_URL} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(TELEGRAM_URL); }} style={{ padding: "14px 28px", fontSize: 15 }}>
                  ✈ Telegram
                </a>
              </div>
              <div style={{ marginTop: 20, fontSize: 12, color: "var(--dx-muted-soft,#94a3b8)" }}>
                bKash Send Money → <strong style={{ color: "#e2136e" }}>{BKASH_NUMBER}</strong> (Personal) · Screenshot পাঠান WhatsApp <strong>{CONTACT_NUMBER}</strong> এ
              </div>

            </div>
          </section>

          {/* FEATURES */}
          <section className="dx-section" id="features">
            <h2 className="dx-section-title">Why DeveloperX?</h2>
            <p className="dx-section-subtitle">Everything you need for AI video creation in one place.</p>
            <div className="dx-features-grid">
              {features.map((feature, i) => (
                <article className="dx-feature-card dx-rise" key={feature.title} style={{ animationDelay: `${i * 70}ms` }}>
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                </article>
              ))}
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="dx-section">
            <h2 className="dx-section-title">How It Works</h2>
            <p className="dx-section-subtitle">Three simple steps to start creating AI videos.</p>
            <div className="dx-steps">
              {[
                ["1", "Sign Up Free", "Create account in 20 seconds. Get 12 hours (720 credits) instantly, daily."],
                ["2", "Install Extension", "Download from dashboard, load unpacked in Chrome. Login with same account."],
                ["3", "Generate on Flow", "Open Google Flow — floating HUD shows live credits. Generate away."],
              ].map(([num, title, copy], i) => (

                <div className="dx-step dx-rise" key={num} style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="dx-step-num">{num}</div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </section>

          {/* TESTIMONIALS */}
          <section className="dx-section">
            <h2 className="dx-section-title">Loved by <span className="dx-shimmer-text">Creators</span></h2>
            <p className="dx-section-subtitle">Real feedback from Bangladeshi creators & agencies.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, marginTop: 34 }}>
              {[
                { name: "Rafiq H.", role: "YouTuber · 120K subs", quote: "Veo 3 access at ৳500/month? Insanely worth it. Cookie inject just works.", color: "#a78bfa" },
                { name: "Nusrat A.", role: "Content Agency", quote: "We generate 40+ ads a week. The floating HUD saves us from surprise limits.", color: "#f0b90b" },
                { name: "Tanvir R.", role: "Freelance Editor", quote: "12 ঘণ্টা free daily দিয়েই আমার ছোট client work হয়ে যায়। bKash এ payment, instant activation.", color: "#22d3ee" },
              ].map((t, i) => (
                <div key={i} className="dx-feature-card dx-rise" style={{ animationDelay: `${i * 90}ms` }}>
                  <div style={{ fontSize: 22, color: t.color, marginBottom: 10 }}>★★★★★</div>
                  <p style={{ fontStyle: "italic", color: "#e2e8f0", lineHeight: 1.6 }}>"{t.quote}"</p>
                  <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${t.color},#7c5cfc)`, display: "grid", placeItems: "center", fontWeight: 800, color: "#0b0b16" }}>{t.name[0]}</div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#fff" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="dx-section">
            <h2 className="dx-section-title">Frequently Asked</h2>
            <p className="dx-section-subtitle">Everything you need to know before starting.</p>
            <div style={{ maxWidth: 780, margin: "34px auto 0", display: "grid", gap: 14 }}>
              {[
                ["কিভাবে shuru korbo?", "Sign up করুন → dashboard থেকে extension download → Chrome-এ load unpacked → same account দিয়ে login → Google Flow এ generate করুন।"],
                ["Free trial এ কি সব model use করা যাবে?", "হ্যাঁ। Veo 3, Omni, Flash — সব unlock। প্রতিদিন 12 ঘণ্টা (720 credits) auto-refresh হয়।"],
                ["Payment কিভাবে করব?", `bKash Send Money → ${BKASH_NUMBER} (Personal)। Screenshot পাঠান WhatsApp ${CONTACT_NUMBER} এ। Instant activation।`],
                ["Credit শেষ হলে কী হয়?", "Extension automatically block করে দিবে। Upgrade করলে সাথে সাথে চালু।"],
                ["Multiple device এ use করা যাবে?", "একই account দিয়ে যেকোনো Chrome device এ login করে use করতে পারবেন।"],
              ].map(([q, a], i) => (
                <details key={i} className="dx-rise" style={{
                  padding: "18px 22px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,.03)",
                  border: "1px solid rgba(124,92,252,.2)",
                  animationDelay: `${i * 60}ms`,
                  cursor: "pointer",
                }}>
                  <summary style={{ fontWeight: 700, color: "#fff", fontSize: 15, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{q}</span>
                    <span style={{ color: "#f0b90b" }}>+</span>
                  </summary>
                  <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.65, fontSize: 14 }}>{a}</p>
                </details>
              ))}
            </div>
          </section>


          {/* Final CTA */}
          <section className="dx-section" style={{ textAlign: "center" }}>
            <div style={{ padding: "50px 20px", borderRadius: 24, background: "linear-gradient(135deg,rgba(124,92,252,.15),rgba(240,185,11,.1))", border: "1px solid rgba(124,92,252,.3)" }}>
              <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 14 }}>Start creating in <span className="dx-shimmer-text">60 seconds</span></h2>
              <p style={{ color: "#cbd5e1", maxWidth: 520, margin: "0 auto 26px" }}>
                No credit card. No commitment. 12 hours of unlimited AI video, every day.
              </p>
              <Link className="dx-btn dx-btn-gold dx-cta-glow" to="/auth" style={{ fontSize: 16, padding: "16px 40px" }}>
                🚀 Claim Your Free Trial
              </Link>

            </div>
          </section>
        </main>

        <footer className="dx-footer">
          <p>DeveloperX © 2026. All rights reserved.</p>
          <p style={{ marginTop: 6 }}>
            💳 bKash: <strong style={{ color: "#e2136e" }}>{BKASH_NUMBER}</strong> ·
            💬 WhatsApp: <a href={WA_LINK} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(WA_LINK); }} style={{ color: "#f0b90b" }}>{CONTACT_NUMBER}</a> ·
            ✈ Telegram: <a href={TELEGRAM_URL} target="_top" rel="noreferrer" onClick={(e) => { e.preventDefault(); openWa(TELEGRAM_URL); }} style={{ color: "#f0b90b" }}>Join channel</a>
          </p>

        </footer>
      </div>
    </div>
  );
}
