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
        error: "Admin feedback updates are not configured. Set ADMIN_EMAILS in Supabase secrets.",
      }, 403);
    }

    const adminEmail = (authData.user.email || "").trim().toLowerCase();
    if (!adminEmail || !allowedAdminEmails.has(adminEmail)) {
      return json({ error: "Forbidden. Admin access required." }, 403);
    }

    const payload = await req.json().catch(() => null) as {
      feedbackId?: string;
      status?: "reviewed" | "resolved";
    } | null;
    const feedbackId = payload?.feedbackId?.trim();
    const status = payload?.status;

    if (!feedbackId) return json({ error: "feedbackId is required." }, 400);
    if (status !== "reviewed" && status !== "resolved") {
      return json({ error: "status must be reviewed or resolved." }, 400);
    }

    const service = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await service
      .from("feedback_submissions")
      .update({ status })
      .eq("id", feedbackId)
      .select("id,status")
      .maybeSingle();

    if (error) {
      return json({ error: `Could not update feedback: ${error.message}` }, 500);
    }
    if (!data) {
      return json({ error: "Feedback item not found." }, 404);
    }

    return json({
      success: true,
      feedbackId: data.id,
      status: data.status,
    });
  } catch (error) {
    console.error("admin-update-feedback-status error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
