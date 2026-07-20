import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SitePlan = {
  name: string;
  credits: string;
  duration: string;
  price: string;
  note?: string;
  cta?: string;
  free?: boolean;
  featured?: boolean;
};

export type SiteSettings = {
  contactNumber: string;
  whatsappNumber: string;
  bkashNumber: string;
  telegramUrl: string;
  offerText: string;
  plans: SitePlan[];
};

const DEFAULTS: SiteSettings = {
  contactNumber: "01410014442",
  whatsappNumber: "01410014442",
  bkashNumber: "01775113977",
  telegramUrl: "https://t.me/DeveloperX",
  offerText: "12 hours FREE trial daily · No card required",
  plans: [
    { name: "FREE TRIAL", credits: "12 hr", duration: "daily free", price: "৳0", note: "auto renews daily", cta: "Start Free", free: true },
    { name: "DAILY", credits: "24 hr", duration: "full-day access", price: "৳50", note: "complete 24 hours", cta: "Get Daily" },
    { name: "WEEKLY", credits: "7 days", duration: "weekly access", price: "৳200", note: "full week unlimited", cta: "Get Weekly" },
    { name: "MONTHLY", credits: "30 days", duration: "monthly access", price: "৳500", note: "Most popular", cta: "Get Monthly", featured: true },
    { name: "PRO", credits: "365 days", duration: "1 full year", price: "৳2,000", note: "Best value yearly" },
    { name: "UNLIMITED", credits: "∞", duration: "lifetime access", price: "৳5,000", note: "One-time payment" },
  ],
};

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async (): Promise<SiteSettings> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("site_settings")
      .select("contact_number, whatsapp_number, bkash_number, telegram_url, offer_text, plans")
      .eq("id", 1)
      .maybeSingle();
    if (!data) return DEFAULTS;
    return {
      contactNumber: data.contact_number ?? DEFAULTS.contactNumber,
      whatsappNumber: data.whatsapp_number ?? DEFAULTS.whatsappNumber,
      bkashNumber: data.bkash_number ?? DEFAULTS.bkashNumber,
      telegramUrl: data.telegram_url ?? DEFAULTS.telegramUrl,
      offerText: data.offer_text ?? DEFAULTS.offerText,
      plans: Array.isArray(data.plans) ? (data.plans as SitePlan[]) : DEFAULTS.plans,
    };
  } catch {
    return DEFAULTS;
  }
});

const planSchema = z.object({
  name: z.string().min(1).max(50),
  credits: z.string().min(1).max(30),
  duration: z.string().min(1).max(60),
  price: z.string().min(1).max(30),
  note: z.string().max(120).optional(),
  cta: z.string().max(40).optional(),
  free: z.boolean().optional(),
  featured: z.boolean().optional(),
});

const updateSchema = z.object({
  contactNumber: z.string().trim().min(3).max(30),
  whatsappNumber: z.string().trim().min(3).max(30),
  bkashNumber: z.string().trim().min(3).max(30),
  telegramUrl: z.string().trim().min(3).max(200),
  offerText: z.string().trim().min(1).max(200),
  plans: z.array(planSchema).min(1).max(20),
});

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => updateSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden: admin only");

    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({
        id: 1,
        contact_number: data.contactNumber,
        whatsapp_number: data.whatsappNumber,
        bkash_number: data.bkashNumber,
        telegram_url: data.telegramUrl,
        offer_text: data.offerText,
        plans: data.plans,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
