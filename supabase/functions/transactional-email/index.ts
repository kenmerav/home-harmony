import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

type Action = "send_welcome" | "send_family_invite" | "send_onboarding_preview";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_ADMIN_EMAILS = ["kroberts035@gmail.com"];

function parseAdminEmails(raw: string | null): Set<string> {
  if (!raw) return new Set(DEFAULT_ADMIN_EMAILS);
  const parsed = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
  if (!parsed.length) return new Set(DEFAULT_ADMIN_EMAILS);
  return new Set([...parsed, ...DEFAULT_ADMIN_EMAILS]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appUrlFromPayload(payload: Record<string, unknown>): string {
  const fromPayload = typeof payload.appUrl === "string" ? payload.appUrl.trim() : "";
  const fromEnv = (Deno.env.get("APP_URL") || "").trim();
  const fallback = "http://localhost:4173";
  return fromPayload || fromEnv || fallback;
}

async function sendViaResend(args: SendEmailArgs) {
  const apiKey = (Deno.env.get("RESEND_API_KEY") || "").trim();
  if (!apiKey) {
    throw new Error("Email service not configured. Add RESEND_API_KEY to Edge Function secrets.");
  }

  const from = (Deno.env.get("EMAIL_FROM") || "Home Harmony <no-reply@homeharmony.app>").trim();
  const replyTo = (Deno.env.get("EMAIL_REPLY_TO") || "").trim();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Email provider failed (${response.status}): ${details || "Unknown error"}`);
  }

  return await response.json().catch(() => ({}));
}

function welcomeTemplate(userName: string, appUrl: string) {
  const safeName = escapeHtml(userName || "there");
  const settingsUrl = `${appUrl.replace(/\/$/, "")}/settings`;
  const mealsUrl = `${appUrl.replace(/\/$/, "")}/meals`;
  const familyUrl = `${appUrl.replace(/\/$/, "")}/family`;
  const calendarUrl = `${appUrl.replace(/\/$/, "")}/calendar`;

  return {
    subject: "Welcome to Home Harmony - your setup is ready",
    text:
      `Hi ${userName || "there"}, your Home Harmony account is ready.\n\n` +
      `Start here:\n` +
      `1) Add recipes and set your meal week: ${mealsUrl}\n` +
      `2) Invite family members: ${familyUrl}\n` +
      `3) Set text reminders and phone number: ${settingsUrl}\n` +
      `4) Review your weekly calendar: ${calendarUrl}\n`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937;">
        <h1 style="font-size:24px;margin:0 0 12px;">Welcome to Home Harmony, ${safeName}</h1>
        <p style="margin:0 0 16px;line-height:1.55;">Your account is live. Here is the fastest path to a useful first week.</p>
        <ol style="margin:0 0 20px;padding-left:18px;line-height:1.7;">
          <li><a href="${mealsUrl}">Set your weekly meals</a> and confirm recipes.</li>
          <li><a href="${familyUrl}">Invite your family</a> so everyone sees tasks, meals, and chores.</li>
          <li><a href="${settingsUrl}">Add your phone number</a> to enable SMS reminders and daily updates.</li>
          <li>Review your <a href="${calendarUrl}">calendar plan</a> for the week.</li>
        </ol>
        <a href="${appUrl}" style="display:inline-block;background:#2f7d5b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open Home Harmony</a>
        <p style="margin:18px 0 0;color:#6b7280;font-size:13px;">You can update reminder preferences anytime in Settings.</p>
      </div>
    `,
  };
}

function familyInviteTemplate(args: {
  recipientEmail: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  householdName?: string | null;
}) {
  const householdLabel = args.householdName?.trim() || "a Home Harmony household";
  const roleLabel = args.role === "kid" ? "kid" : "family member";
  return {
    subject: `You're invited to join ${householdLabel} on Home Harmony`,
    text:
      `${args.inviterName || "A family member"} invited you to join ${householdLabel} as a ${roleLabel}.\n\n` +
      `Accept invite: ${args.inviteLink}\n`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937;">
        <h1 style="font-size:24px;margin:0 0 12px;">You're invited to Home Harmony</h1>
        <p style="margin:0 0 16px;line-height:1.55;">
          ${escapeHtml(args.inviterName || "A family member")} invited you to join
          <strong>${escapeHtml(householdLabel)}</strong> as a ${escapeHtml(roleLabel)}.
        </p>
        <p style="margin:0 0 20px;line-height:1.55;">Accept the invite to collaborate on meals, groceries, tasks, and chores.</p>
        <a href="${args.inviteLink}" style="display:inline-block;background:#2f7d5b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Accept Invite</a>
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">If the button doesn't work, open this link: ${escapeHtml(args.inviteLink)}</p>
      </div>
    `,
  };
}

function onboardingPreviewTemplate(args: { userName: string; appUrl: string }) {
  const safeName = escapeHtml(args.userName || "there");
  const base = args.appUrl.replace(/\/$/, "");
  const familyUrl = `${base}/family`;
  const recipesUrl = `${base}/recipes`;
  const mealsUrl = `${base}/meals`;
  const groceryUrl = `${base}/grocery`;
  const settingsUrl = `${base}/settings`;
  const workoutsUrl = `${base}/workouts`;

  return {
    subject: "Welcome to Home Harmony - your setup starts here",
    text:
      `Hi ${args.userName || "there"},\n\n` +
      `Welcome to Home Harmony.\n\n` +
      `Fast setup path:\n` +
      `1) Set up household and invite spouse/kids: ${familyUrl}\n` +
      `2) Add recipes: ${recipesUrl}\n` +
      `3) Build this week's meal plan: ${mealsUrl}\n` +
      `4) Confirm grocery list: ${groceryUrl}\n` +
      `5) Add phone number for SMS reminders: ${settingsUrl}\n` +
      `6) Optional: set macro goals and workout tracking: ${workoutsUrl}\n\n` +
      `Open app: ${base}\n`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937;">
        <h1 style="font-size:24px;margin:0 0 12px;">Welcome to Home Harmony, ${safeName}</h1>
        <p style="margin:0 0 16px;line-height:1.55;">
          Welcome aboard. Here is the fastest path to get real value in your first week.
        </p>
        <ol style="margin:0 0 20px;padding-left:18px;line-height:1.7;">
          <li><a href="${familyUrl}">Set up your household</a> and invite spouse/kids.</li>
          <li><a href="${recipesUrl}">Add recipes</a> so planning uses your real meals.</li>
          <li><a href="${mealsUrl}">Build this week's meal plan</a> (generate or assign manually).</li>
          <li><a href="${groceryUrl}">Confirm grocery list</a> with rolled-up quantities.</li>
          <li><a href="${settingsUrl}">Add your phone number</a> to enable SMS reminders.</li>
          <li>Optional: track macros/workouts and family progress in one place.</li>
        </ol>
        <a href="${base}" style="display:inline-block;background:#2f7d5b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Open Home Harmony</a>
        <p style="margin:18px 0 0;color:#6b7280;font-size:13px;">
          Reply to this email anytime if you want help with setup.
        </p>
      </div>
    `,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Missing Supabase env vars." }, 500);

    const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = (payload.action || "") as Action;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceRoleToken = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    const isServiceRoleAuth = Boolean(serviceRoleToken && bearerToken === serviceRoleToken);

    let authUser: { email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
    if (!isServiceRoleAuth) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) return json({ error: "Unauthorized." }, 401);
      authUser = authData.user;
    }

    const appUrl = appUrlFromPayload(payload);
    const inviterName =
      typeof authUser?.user_metadata?.full_name === "string" && authUser.user_metadata.full_name.trim()
        ? authUser.user_metadata.full_name.trim()
        : authUser?.email || "Home Harmony user";

    if (action === "send_welcome") {
      const recipient = authUser?.email || "";
      if (!recipient) return json({ error: "No email found for signed-in user." }, 400);

      const template = welcomeTemplate(inviterName, appUrl);
      const provider = await sendViaResend({
        to: recipient,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return json({ success: true, provider });
    }

    if (action === "send_family_invite") {
      const recipientEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const inviteLink = typeof payload.inviteLink === "string" ? payload.inviteLink.trim() : "";
      const role = typeof payload.role === "string" ? payload.role.trim().toLowerCase() : "kid";
      const householdName = typeof payload.householdName === "string" ? payload.householdName.trim() : null;

      if (!recipientEmail) return json({ error: "Invite email is required." }, 400);
      if (!inviteLink) return json({ error: "Invite link is required." }, 400);

      const template = familyInviteTemplate({
        recipientEmail,
        inviterName,
        role,
        inviteLink,
        householdName,
      });

      const provider = await sendViaResend({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return json({ success: true, provider });
    }

    if (action === "send_onboarding_preview") {
      const recipientEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const userName = typeof payload.userName === "string" ? payload.userName.trim() : "there";
      if (!recipientEmail) return json({ error: "Recipient email is required." }, 400);
      if (!isServiceRoleAuth) {
        const allowedRecipients = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));
        if (!allowedRecipients.has(recipientEmail)) {
          return json({ error: "Forbidden." }, 403);
        }
      }

      const template = onboardingPreviewTemplate({ userName, appUrl });
      const provider = await sendViaResend({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      return json({ success: true, provider });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("transactional-email error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown email error." },
      500,
    );
  }
});
