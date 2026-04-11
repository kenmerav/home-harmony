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
        error: "Admin recipe fixes are not configured. Set ADMIN_EMAILS in Supabase secrets.",
      }, 403);
    }

    const adminEmail = (authData.user.email || "").trim().toLowerCase();
    if (!adminEmail || !allowedAdminEmails.has(adminEmail)) {
      return json({ error: "Forbidden. Admin access required." }, 403);
    }

    const payload = await req.json().catch(() => null) as {
      email?: string;
    } | null;
    const targetEmail = payload?.email?.trim().toLowerCase();

    if (!targetEmail) {
      return json({ error: "email is required." }, 400);
    }

    const service = createClient(supabaseUrl, serviceRoleKey);
    const { data: users, error: usersError } = await service.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (usersError) {
      return json({ error: `Could not load users: ${usersError.message}` }, 500);
    }

    const user = users.users.find((entry) => (entry.email || "").trim().toLowerCase() === targetEmail);
    if (!user) {
      return json({ error: "No user found for that email." }, 404);
    }

    const { data: recipes, error: recipeQueryError } = await service
      .from("recipes")
      .select("id,name,meal_type")
      .eq("owner_id", user.id)
      .ilike("name", "%breakfast%")
      .neq("meal_type", "breakfast");

    if (recipeQueryError) {
      return json({ error: `Could not load recipes: ${recipeQueryError.message}` }, 500);
    }

    const rows = recipes || [];
    if (!rows.length) {
      return json({
        success: true,
        userId: user.id,
        email: targetEmail,
        updatedCount: 0,
        updatedNames: [],
      });
    }

    const recipeIds = rows.map((row) => row.id);
    const { error: updateError } = await service
      .from("recipes")
      .update({ meal_type: "breakfast" })
      .in("id", recipeIds);

    if (updateError) {
      return json({ error: `Could not update recipes: ${updateError.message}` }, 500);
    }

    return json({
      success: true,
      userId: user.id,
      email: targetEmail,
      updatedCount: rows.length,
      updatedNames: rows.map((row) => row.name),
    });
  } catch (error) {
    console.error("admin-normalize-recipe-meal-types error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
