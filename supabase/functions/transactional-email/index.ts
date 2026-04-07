import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

type Action = "send_welcome" | "send_family_invite" | "send_onboarding_preview" | "send_welcome_preview";

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
  const base = appUrl.replace(/\/$/, "");
  const settingsUrl = `${base}/settings`;
  const mealsUrl = `${base}/meals`;
  const familyUrl = `${base}/family`;
  const groceryUrl = `${base}/grocery`;
  const calendarUrl = `${base}/calendar`;

  return {
    subject: "Welcome to Home Harmony - let’s set up your first week",
    text:
      `Hi ${userName || "there"},\n\n` +
      `Welcome to Home Harmony. Your account is live, and the fastest way to make it useful is to set up your first week.\n\n` +
      `Start here:\n` +
      `1) Add recipes and build your meal plan: ${mealsUrl}\n` +
      `2) Review your grocery list: ${groceryUrl}\n` +
      `3) Invite your spouse or family members: ${familyUrl}\n` +
      `4) Add your phone number for reminders: ${settingsUrl}\n` +
      `5) Review the calendar: ${calendarUrl}\n\n` +
      `Open Home Harmony: ${base}\n`,
    html: `
      <div style="background:#f6f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9dfcf;border-radius:20px;overflow:hidden;">
          <div style="padding:28px 28px 16px;background:linear-gradient(180deg,#fbf7f1 0%,#ffffff 100%);border-bottom:1px solid #efe7da;">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef6f1;color:#2f7d5b;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
              Your account is ready
            </div>
            <h1 style="font-size:30px;line-height:1.15;margin:16px 0 12px;font-family:Georgia,serif;font-weight:700;color:#1f1a17;">
              Welcome to Home Harmony, ${safeName}
            </h1>
            <p style="margin:0 0 18px;line-height:1.65;font-size:16px;color:#5f554c;">
              The easiest way to get value this week is to set up meals, confirm groceries, and make sure your household is connected.
            </p>
            <a href="${base}" style="display:inline-block;background:#2f7d5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              Open Home Harmony
            </a>
          </div>

          <div style="padding:24px 28px;">
            <div style="margin:0 0 18px;padding:16px 18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b7d70;">
                Start with these 3 steps
              </p>
              <ol style="margin:0;padding-left:20px;line-height:1.8;color:#2e2a26;">
                <li><a href="${mealsUrl}" style="color:#2f7d5b;font-weight:600;">Build your first meal plan</a> so Home Harmony can create a real grocery list.</li>
                <li><a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Review your grocery list</a> and make sure the quantities look right.</li>
                <li><a href="${familyUrl}" style="color:#2f7d5b;font-weight:600;">Invite your spouse or family</a> so everyone shares meals, tasks, and reminders.</li>
              </ol>
            </div>

            <div style="margin:0 0 18px;padding:16px 18px;border:1px solid #efe7da;border-radius:14px;">
              <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b7d70;">
                Helpful next
              </p>
              <ul style="margin:0;padding-left:18px;line-height:1.8;color:#5f554c;">
                <li><a href="${settingsUrl}" style="color:#2f7d5b;font-weight:600;">Add your phone number</a> for reminder texts and daily updates.</li>
                <li><a href="${calendarUrl}" style="color:#2f7d5b;font-weight:600;">Review your calendar</a> so meals and events line up with your week.</li>
              </ul>
            </div>

            <p style="margin:0;color:#7a6f64;font-size:13px;line-height:1.6;">
              You can reply to this email anytime if you want help getting your first week set up.
            </p>
          </div>
        </div>
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

    if (action === "send_welcome_preview") {
      const recipientEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const userName = typeof payload.userName === "string" ? payload.userName.trim() : inviterName;
      if (!recipientEmail) return json({ error: "Recipient email is required." }, 400);
      if (!isServiceRoleAuth) {
        const allowedRecipients = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));
        if (!allowedRecipients.has(recipientEmail)) {
          return json({ error: "Forbidden." }, 403);
        }
      }

      const template = welcomeTemplate(userName, appUrl);
      const provider = await sendViaResend({
        to: recipientEmail,
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
