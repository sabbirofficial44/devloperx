import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getPromptHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prompt_history")
      .select("id, prompt, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ id: r.id, prompt: r.prompt, createdAt: r.created_at }));
  });

export const savePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ prompt: z.string().trim().min(1).max(2000) }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prompt_history")
      .insert({ user_id: context.userId, prompt: data.prompt });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prompt_history")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("announcements")
      .select("id, title, body, kind, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      kind: r.kind as "info" | "success" | "warn" | "danger",
      createdAt: r.created_at,
    }));
  });

export const getUsageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await context.supabase
      .from("credit_ledger")
      .select("amount, created_at")
      .eq("user_id", context.userId)
      .lt("amount", 0)
      .gte("created_at", since)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // Group by day (last 7 days)
    const buckets: { day: string; used: number }[] = [];
    const map = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, 0);
      buckets.push({ day: key, used: 0 });
    }
    let total = 0;
    for (const row of data ?? []) {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      const abs = Math.abs(Number(row.amount));
      total += abs;
      if (map.has(key)) map.set(key, (map.get(key) ?? 0) + abs);
    }
    for (const b of buckets) b.used = map.get(b.day) ?? 0;

    // today
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = map.get(todayKey) ?? 0;

    return { buckets, total7d: total, today };
  });

export const getVideoHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("video_history")
      .select("id, prompt, video_url, thumbnail_url, model, status, created_at, external_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      prompt: r.prompt,
      videoUrl: r.video_url,
      thumbnailUrl: r.thumbnail_url,
      model: r.model,
      status: r.status,
      externalId: r.external_id,
      createdAt: r.created_at,
    }));
  });

export const deleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("video_history")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
