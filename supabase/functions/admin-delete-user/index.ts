import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

function parseAdminEmails(raw: string | null): Set<string> {
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase env vars." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authData.user) return json({ error: "Unauthorized." }, 401);

    const allowedAdminEmails = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));
    if (!allowedAdminEmails.size) {
      return json({
        error: "Admin delete is not configured. Set ADMIN_EMAILS in Supabase secrets.",
      }, 403);
    }

    const adminEmail = (authData.user.email || "").trim().toLowerCase();
    if (!adminEmail || !allowedAdminEmails.has(adminEmail)) {
      return json({ error: "Forbidden. Admin access required." }, 403);
    }

    const payload = await req.json().catch(() => null) as { userId?: string } | null;
    const userId = payload?.userId?.trim();
    if (!userId) return json({ error: "userId is required." }, 400);
    if (userId === authData.user.id) {
      return json({ error: "You cannot delete your own admin account from this screen." }, 400);
    }

    const service = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetUser, error: getUserError } = await service.auth.admin.getUserById(userId);
    if (getUserError) {
      return json({ error: `Could not load account: ${getUserError.message}` }, 404);
    }

    const targetEmail = (targetUser.user?.email || "").trim().toLowerCase();
    if (targetEmail && allowedAdminEmails.has(targetEmail)) {
      return json({ error: "Admin accounts cannot be deleted from this screen." }, 400);
    }

    const { error: deleteError } = await service.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ error: `Could not delete account: ${deleteError.message}` }, 500);
    }

    return json({
      success: true,
      deletedUserId: userId,
      deletedEmail: targetUser.user?.email || null,
    });
  } catch (error) {
    console.error("admin-delete-user error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
