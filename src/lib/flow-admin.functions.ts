import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import bcrypt from "bcryptjs";

async function hashPw(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Drain all trial users' credits based on elapsed time before reading.
    const { data: trialUsers } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .not("trial_started_at", "is", null);
    await Promise.all(
      (trialUsers ?? []).map((u) =>
        supabaseAdmin.rpc("tick_trial_credits", { _user_id: u.user_id }),
      ),
    );
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email, display_name, credits, user_plan, created_at, last_tick_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const adminSet = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

    // Aggregate usage from credit_ledger (last 24h) per user.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: ledger } = await supabaseAdmin
      .from("credit_ledger")
      .select("user_id, amount, created_at")
      .lt("amount", 0)
      .gte("created_at", since);
    const used24h: Record<string, number> = {};
    const lastUse: Record<string, string> = {};
    for (const row of ledger ?? []) {
      used24h[row.user_id] = (used24h[row.user_id] ?? 0) + Math.abs(Number(row.amount));
      if (!lastUse[row.user_id] || row.created_at > lastUse[row.user_id]) {
        lastUse[row.user_id] = row.created_at;
      }
    }

    return (profiles ?? []).map((p) => ({
      userId: p.user_id,
      email: p.email,
      displayName: p.display_name,
      credits: Number(p.credits),
      plan: p.user_plan,
      isAdmin: adminSet.has(p.user_id),
      createdAt: p.created_at,
      lastTickAt: p.last_tick_at,
      usedLast24h: used24h[p.user_id] ?? 0,
      lastUsedAt: lastUse[p.user_id] ?? null,
    }));
  });


// Admin-created accounts bypass end-user validation rules — admin can create
// literally anything (e.g. email="x", password="x"). Only public signups on
// /auth enforce the strict @gmail.com + 6-char rules.
const createUserSchema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(200),
  displayName: z.string().trim().max(100).optional(),
  credits: z.number().int().nonnegative().max(1_000_000_000).optional(),
  plan: z.string().trim().max(50).optional(),
});

// Supabase Auth requires a syntactically valid email. If the admin types a
// bare username like "x" we synthesize a stable placeholder address so the
// admin can still log the user in with that exact string on the extension.
function normalizeAdminEmail(raw: string): { email: string; loginAlias: string } {
  const trimmed = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { email: trimmed.toLowerCase(), loginAlias: trimmed.toLowerCase() };
  }
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/^-+|-+$/g, "") || "user";
  return { email: `${slug}@dx.local`, loginAlias: trimmed };
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createUserSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { email, loginAlias } = normalizeAdminEmail(data.email);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.displayName
        ? { display_name: data.displayName, login_alias: loginAlias }
        : { login_alias: loginAlias },
    });
    if (error) throw new Error(error.message);

    const userId = created.user?.id;
    if (!userId) throw new Error("User creation failed");

    // Profile row is auto-created by trigger; patch credits/plan if provided.
    const patch: {
      credits?: number;
      user_plan?: string;
      display_name?: string;
    } = {};
    if (data.credits !== undefined) patch.credits = data.credits;
    if (data.plan) patch.user_plan = data.plan;
    if (data.displayName) patch.display_name = data.displayName;
    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update(patch)
        .eq("user_id", userId);
      if (upErr) throw new Error(upErr.message);
    }
    await supabaseAdmin.from("admin_created_users").insert({
      created_by: context.userId,
      user_id: userId,
      email: data.email,
      password: data.password,
      display_name: data.displayName ?? null,
      plan: data.plan ?? null,
      credits: data.credits ?? null,
    });
    return { ok: true, userId };
  });

const bulkCreateSchema = z.object({
  count: z.number().int().min(1).max(100),
  domain: z.string().trim().min(3).max(80),
  prefix: z.string().trim().max(30).optional(),
  plan: z.string().trim().max(50).optional(),
  credits: z.number().int().nonnegative().max(1_000_000_000).optional(),
});

function randStr(len: number, alphabet: string) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export const bulkCreateUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => bulkCreateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const domain = data.domain.replace(/^@+/, "");
    const prefix = (data.prefix || "flow").toLowerCase().replace(/[^a-z0-9]/g, "");
    const results: { email: string; password: string; ok: boolean; error?: string }[] = [];
    const lowerAlpha = "abcdefghijklmnopqrstuvwxyz0123456789";
    const pwAlpha =
      "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
    for (let i = 0; i < data.count; i++) {
      const email = `${prefix}_${randStr(6, lowerAlpha)}@${domain}`;
      const password = randStr(12, pwAlpha);
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !created.user) {
        results.push({ email, password, ok: false, error: error?.message ?? "unknown" });
        continue;
      }
      const userId = created.user.id;
      const patch: { credits?: number; user_plan?: string } = {};
      if (data.credits !== undefined) patch.credits = data.credits;
      if (data.plan) patch.user_plan = data.plan;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("profiles").update(patch).eq("user_id", userId);
      }
      await supabaseAdmin.from("admin_created_users").insert({
        created_by: context.userId,
        user_id: userId,
        email,
        password,
        plan: data.plan ?? null,
        credits: data.credits ?? null,
      });
      results.push({ email, password, ok: true });
    }
    return { results };
  });

export const listCreatedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("admin_created_users")
      .select("id, email, password, display_name, plan, credits, created_at, user_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      password: r.password,
      displayName: r.display_name,
      plan: r.plan,
      credits: r.credits === null ? null : Number(r.credits),
      createdAt: r.created_at,
      userId: r.user_id,
    }));
  });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  credits: z.number().int().nonnegative().max(1_000_000_000).optional(),
  plan: z.string().trim().max(50).optional(),
  displayName: z.string().trim().max(100).optional(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateUserSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Fetch current state so we can compute delta + log ledger entry.
    const { data: before } = await supabaseAdmin
      .from("profiles")
      .select("credits, user_plan")
      .eq("user_id", data.userId)
      .maybeSingle();
    const prevCredits = Number(before?.credits ?? 0);
    const prevPlan = String(before?.user_plan ?? "");

    const patch: { credits?: number; user_plan?: string; display_name?: string; last_tick_at?: string } = {};
    if (data.credits !== undefined) patch.credits = data.credits;
    if (data.plan) patch.user_plan = data.plan;
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    // Reset trial timer baseline when credits or plan changes (top-up)
    if (data.credits !== undefined || data.plan) patch.last_tick_at = new Date().toISOString();
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    // Audit trail: log admin adjustments into credit_ledger so history is preserved.
    const entries: Array<{
      user_id: string; amount: number; reason: string; source: string; balance_after: number | null;
      metadata: Record<string, string | number | boolean | null>;
    }> = [];
    if (data.credits !== undefined && data.credits !== prevCredits) {
      const delta = data.credits - prevCredits;
      entries.push({
        user_id: data.userId,
        amount: delta,
        reason: delta > 0
          ? `Admin top-up (+${delta})`
          : `Admin deduction (${delta})`,
        source: "admin",
        balance_after: data.credits,
        metadata: { admin_id: context.userId, before: prevCredits, after: data.credits },
      });
    }
    if (data.plan && data.plan !== prevPlan) {
      entries.push({
        user_id: data.userId,
        amount: 0,
        reason: `Plan changed: ${prevPlan || "—"} → ${data.plan}`,
        source: "admin",
        balance_after: data.credits ?? prevCredits,
        metadata: { admin_id: context.userId, before_plan: prevPlan, after_plan: data.plan },
      });
    }
    if (entries.length > 0) {
      await supabaseAdmin.from("credit_ledger").insert(entries);
    }
    return { ok: true };
  });

const rotateCookiesSchema = z.object({ userId: z.string().uuid() });

export const rotateUserCookies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => rotateCookiesSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: latest, error: fetchErr } = await supabaseAdmin
      .from("session_cookies")
      .select("cookies, total_cookies, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!latest || !Array.isArray(latest.cookies) || latest.cookies.length === 0) {
      throw new Error("No cookies available in session_cookies");
    }
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({
        assigned_cookies: latest.cookies,
        cookies_rotated_at: new Date().toISOString(),
      })
      .eq("user_id", data.userId);
    if (upErr) throw new Error(upErr.message);
    return {
      ok: true,
      count: Array.isArray(latest.cookies) ? latest.cookies.length : 0,
    };
  });

const deleteUserSchema = z.object({ userId: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => deleteUserSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const uploadCookiesSchema = z.object({
  cookies: z.array(z.any()).min(1).max(500),
});

export const uploadSessionCookies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => uploadCookiesSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("session_cookies").insert({
      cookies: data.cookies,
      total_cookies: data.cookies.length,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ assigned_cookies: data.cookies, cookies_rotated_at: new Date().toISOString() })
      .not("user_id", "is", null);
    return { ok: true, count: data.cookies.length };
  });

export const fetchLiveCookies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    let cookies: unknown[] = [];
    let source = "veoly.netlify.app";
    try {
      const r = await fetch("https://veoly.netlify.app/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "admin", sessionToken: "admin:admin@developerx.dev" }),
      });
      if (!r.ok) throw new Error(`External server returned ${r.status}`);
      const j = (await r.json()) as { cookies?: unknown[] };
      cookies = Array.isArray(j.cookies) ? j.cookies : [];
    } catch (e) {
      throw new Error(`Fetch failed: ${(e as Error).message}`);
    }
    if (cookies.length === 0) throw new Error("No cookies returned from external source");

    // Resolve Google account email(s) from cookies
    const emails: string[] = [];
    try {
      const cookieHeader = (cookies as Array<{ name?: string; value?: string; domain?: string }>)
        .filter((c) => c && c.name && c.value && (c.domain ?? "").includes("google.com"))
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");
      if (cookieHeader) {
        const gr = await fetch(
          "https://accounts.google.com/ListAccounts?gpsia=1&source=ChromiumBrowser&json=standard",
          { headers: { Cookie: cookieHeader, "User-Agent": "Mozilla/5.0" } },
        );
        const txt = await gr.text();
        const re = /"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})"/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(txt))) {
          if (!emails.includes(m[1])) emails.push(m[1]);
        }
      }
    } catch { /* ignore */ }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("session_cookies").insert({
      cookies: cookies as never,
      total_cookies: cookies.length,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ assigned_cookies: cookies as never, cookies_rotated_at: new Date().toISOString() })
      .not("user_id", "is", null);
    return {
      ok: true as const,
      count: cookies.length,
      source,
      emails,
      cookiesJson: JSON.stringify(cookies, null, 2),
    };
  });

export const listSessionCookieSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("session_cookies")
      .select("id, total_cookies, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      totalCookies: r.total_cookies,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
    }));
  });

export const resolveActiveCookieEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("session_cookies")
      .select("cookies, total_cookies, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cookies = (data?.cookies ?? []) as Array<{ name?: string; value?: string; domain?: string }>;
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return {
        emails: [] as string[],
        accounts: [] as Array<{ email: string; status: "active" | "inactive"; source: string; lastSeen: string | null }>,
        active: false,
        totalCookies: 0,
        lastUpdated: data?.updated_at ?? null,
      };
    }
    const authCookieNames = cookies
      .map((c) => String(c?.name ?? ""))
      .filter((name) => /(^SID$|SIDCC|SAPISID|APISID|HSID|SSID|LSID|OSID|__Secure-\dP.*SID|ACCOUNT_CHOOSER|next-auth\.session-token)/i.test(name));
    const hasGoogleCookies = cookies.some((c) => {
      const domain = String(c?.domain ?? "");
      return domain.includes("google.com") || domain.includes("labs.google") || domain.endsWith(".google");
    });
    const active = cookies.length > 0 && (authCookieNames.length > 0 || hasGoogleCookies);
    const cookieHeader = cookies
      .filter((c) => {
        const domain = String(c?.domain ?? "");
        return c && c.name && c.value && (domain.includes("google.com") || domain.includes("labs.google") || domain.endsWith(".google"));
      })
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    if (!cookieHeader) {
      return {
        emails: [] as string[],
        accounts: [] as Array<{ email: string; status: "active" | "inactive"; source: string; lastSeen: string | null }>,
        active,
        totalCookies: Number(data?.total_cookies ?? cookies.length),
        lastUpdated: data?.updated_at ?? null,
      };
    }
    const emails: string[] = [];
    const pushEmail = (e: string) => {
      const lower = e.toLowerCase();
      if (lower.endsWith("@google.com") || lower.endsWith("@gserviceaccount.com")) return;
      if (!emails.some((x) => x.toLowerCase() === lower)) emails.push(e);
    };

    for (const c of cookies) {
      try {
        const value = decodeURIComponent(String(c?.value ?? ""));
        const matches = value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
        for (const match of matches) pushEmail(match);
      } catch {
        // Some cookie values are not URI encoded; ignore malformed values.
      }
    }

    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    const endpoints = [
      "https://accounts.google.com/ListAccounts?listPages=0&gpsia=1&source=ChromiumBrowser&json=standard",
      "https://accounts.google.com/ListAccounts?gpsia=1&source=GoogleUserContent&json=standard",
      "https://accounts.google.com/CheckCookie?continue=https%3A%2F%2Fflow.google.com%2F&chtml=LoginDoneHtml",
      "https://labs.google/fx/api/auth/session",
    ];
    for (const url of endpoints) {
      try {
        const gr = await fetch(url, {
          headers: {
            Cookie: cookieHeader,
            "User-Agent": ua,
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        const txt = await gr.text();
        const re = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
        const matches = txt.match(re) ?? [];
        for (const m of matches) pushEmail(m);
        if (emails.length > 0) break;
      } catch { /* try next */ }
    }

    const accounts = emails.map((email) => ({
      email,
      status: active ? "active" as const : "inactive" as const,
      source: "Google cookies",
      lastSeen: data?.updated_at ?? null,
    }));

    return {
      emails,
      accounts,
      active,
      totalCookies: Number(data?.total_cookies ?? cookies.length),
      lastUpdated: data?.updated_at ?? null,
      authCookieCount: authCookieNames.length,
    };
  });

const listCreditLedgerSchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export const listCreditLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listCreditLedgerSchema.parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("credit_ledger")
      .select("id, user_id, amount, reason, source, metadata, balance_after, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const emails: Record<string, string | null> = {};
    if (ids.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email")
        .in("user_id", ids);
      for (const p of profs ?? []) emails[p.user_id] = p.email;
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      email: emails[r.user_id] ?? null,
      amount: Number(r.amount),
      reason: r.reason,
      source: r.source,
      metadata: r.metadata,
      balanceAfter: r.balance_after === null ? null : Number(r.balance_after),
      createdAt: r.created_at,
    }));
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("user_id, email, display_name, credits, user_plan")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return {
      userId: context.userId,
      email: data?.email ?? null,
      displayName: data?.display_name ?? null,
      credits: Number(data?.credits ?? 0),
      plan: data?.user_plan ?? "free",
      isAdmin: !!roleRow,
    };
  });

const updateAdminCredsSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).max(200).optional(),
}).refine((v) => v.email || v.password, { message: "Provide email or password" });

export const updateAdminCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateAdminCredsSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const attrs: { email?: string; password?: string } = {};
    if (data.email) attrs.email = data.email;
    if (data.password) attrs.password = data.password;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      ...attrs,
      email_confirm: true,
    } as never);
    if (error) throw new Error(error.message);
    if (data.email) {
      await supabaseAdmin.from("profiles").update({ email: data.email }).eq("user_id", context.userId);
    }
    return { ok: true };
  });
