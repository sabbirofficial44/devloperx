import { createServerFn } from "@tanstack/react-start";

const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_PASSWORD = "admin1122";

export const ensureDefaultAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Find existing user
  let userId: string | null = null;
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL);
  if (existing) {
    userId = existing.id;
    // Ensure password is correct
    await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create admin");
    userId = created.user.id;
  }

  // Ensure admin role
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  return { ok: true };
});
