import type { User } from "@supabase/supabase-js";

type AdminClient = {
  auth: { admin: { listUsers: (o: { page: number; perPage: number }) => Promise<{ data: { users: User[] }; error: unknown }> } };
};

/**
 * Find an auth user by email address.
 *
 * The previous implementation called `listUsers({ page: 1, perPage: 200 })` and
 * searched the first page only — once the project passed 200 accounts, any user
 * beyond page 1 became invisible (duplicate signups, silently dropped password
 * resets / verification resends). This pages through the whole list instead.
 */
export async function findUserByEmail(
  supabaseAdmin: unknown,
  email: string,
): Promise<{ user: User | null; error: string | null }> {
  const admin = supabaseAdmin as AdminClient;
  const target = email.trim().toLowerCase();
  if (!target) return { user: null, error: null };

  const perPage = 200;
  const maxPages = 50; // hard stop: 10k accounts
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error: String((error as { message?: string })?.message ?? error) };
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").trim().toLowerCase() === target);
    if (hit) return { user: hit, error: null };
    if (users.length < perPage) break; // last page
  }
  return { user: null, error: null };
}
