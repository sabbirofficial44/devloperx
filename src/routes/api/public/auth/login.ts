import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const loginSchema = z.object({
  email: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(500),
  version: z.string().optional(),
});

// Mirror the admin normalizer in flow-admin.functions.ts so a user created
// with a bare "x" username can sign in with "x" on the extension.
function normalizeLoginEmail(raw: string): string {
  const trimmed = raw.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed.toLowerCase();
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9._-]/g, "-").replace(/^-+|-+$/g, "") || "user";
  return `${slug}@dx.local`;
}


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createPublicClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Backend auth is not configured");
  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

export const Route = createFileRoute("/api/public/auth/login")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: z.infer<typeof loginSchema>;
        try {
          body = loginSchema.parse(await request.json());
        } catch {
          return json({ message: "Enter a valid email and password" }, 400);
        }

        const loginEmail = normalizeLoginEmail(body.email);
        const authClient = createPublicClient();
        const { data: auth, error: authError } = await authClient.auth.signInWithPassword({
          email: loginEmail,
          password: body.password,
        });


        if (authError || !auth.user || !auth.session) {
          return json({ message: "Invalid email or password" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Start trial countdown on first extension login (idempotent).
        await supabaseAdmin.rpc("start_trial_if_needed", { _user_id: auth.user.id });
        await supabaseAdmin.rpc("tick_trial_credits", { _user_id: auth.user.id });
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, email, credits, user_plan")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        const name =
          profile?.display_name ||
          profile?.email ||
          auth.user.email ||
          body.email.split("@")[0] ||
          "Flow User";

        const credits = Number(profile?.credits ?? 0);

        return json({
          accessToken: auth.session.access_token,
          refreshToken: auth.session.refresh_token,
          user: {
            id: auth.user.id,
            name,
            email: auth.user.email ?? body.email,
            plan: profile?.user_plan ?? "free",
            creditsTotal: credits,
            creditsUsed: 0,
            creditsLeft: credits,
          },
        });
      },
    },
  },
});