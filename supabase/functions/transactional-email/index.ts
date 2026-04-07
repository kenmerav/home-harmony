import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

type Action =
  | "send_welcome"
  | "send_family_invite"
  | "send_onboarding_preview"
  | "send_welcome_preview"
  | "send_email_preview";

type LifecycleTemplateKey = "welcome" | "quickstart" | "day2" | "day4" | "day7";

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

function lifecycleEmailTemplate(args: {
  userName: string;
  subject: string;
  badge: string;
  title: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  stepsTitle: string;
  steps: string[];
  helpfulTitle?: string;
  helpfulItems?: string[];
  footer?: string;
}) {
  const safeName = escapeHtml(args.userName || "there");
  const stepListText = args.steps.map((step, index) => `${index + 1}) ${step.replace(/<[^>]+>/g, "")}`).join("\n");
  const helpfulItemsText = (args.helpfulItems || []).map((item) => `- ${item.replace(/<[^>]+>/g, "")}`).join("\n");

  return {
    subject: args.subject,
    text:
      `Hi ${args.userName || "there"},\n\n` +
      `${args.intro}\n\n` +
      `${args.stepsTitle}:\n${stepListText}\n\n` +
      `${args.helpfulItems?.length ? `${args.helpfulTitle || "Helpful next"}:\n${helpfulItemsText}\n\n` : ""}` +
      `${args.ctaLabel}: ${args.ctaUrl}\n`,
    html: `
      <div style="background:#f6f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9dfcf;border-radius:20px;overflow:hidden;">
          <div style="padding:28px 28px 16px;background:linear-gradient(180deg,#fbf7f1 0%,#ffffff 100%);border-bottom:1px solid #efe7da;">
            <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#eef6f1;color:#2f7d5b;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
              ${escapeHtml(args.badge)}
            </div>
            <h1 style="font-size:30px;line-height:1.15;margin:16px 0 12px;font-family:Georgia,serif;font-weight:700;color:#1f1a17;">
              ${args.title.replace("{name}", safeName)}
            </h1>
            <p style="margin:0 0 18px;line-height:1.65;font-size:16px;color:#5f554c;">
              ${args.intro}
            </p>
            <a href="${args.ctaUrl}" style="display:inline-block;background:#2f7d5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              ${escapeHtml(args.ctaLabel)}
            </a>
          </div>

          <div style="padding:24px 28px;">
            <div style="margin:0 0 18px;padding:16px 18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b7d70;">
                ${escapeHtml(args.stepsTitle)}
              </p>
              <ol style="margin:0;padding-left:20px;line-height:1.8;color:#2e2a26;">
                ${args.steps.map((step) => `<li>${step}</li>`).join("")}
              </ol>
            </div>

            ${args.helpfulItems?.length ? `
              <div style="margin:0 0 18px;padding:16px 18px;border:1px solid #efe7da;border-radius:14px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8b7d70;">
                  ${escapeHtml(args.helpfulTitle || "Helpful next")}
                </p>
                <ul style="margin:0;padding-left:18px;line-height:1.8;color:#5f554c;">
                  ${args.helpfulItems.map((item) => `<li>${item}</li>`).join("")}
                </ul>
              </div>
            ` : ""}

            <p style="margin:0;color:#7a6f64;font-size:13px;line-height:1.6;">
              ${escapeHtml(args.footer || "You can reply to this email anytime if you want help getting set up.")}
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

function welcomeTemplate(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const settingsUrl = `${base}/settings`;
  const mealsUrl = `${base}/meals`;
  const familyUrl = `${base}/family`;
  const groceryUrl = `${base}/grocery`;
  const calendarUrl = `${base}/calendar`;

  return lifecycleEmailTemplate({
    userName,
    subject: "Welcome to Home Harmony - let’s set up your first week",
    badge: "Your account is ready",
    title: "Welcome to Home Harmony, {name}",
    intro: "The easiest way to get value this week is to set up meals, confirm groceries, and make sure your household is connected.",
    ctaLabel: "Open Home Harmony",
    ctaUrl: base,
    stepsTitle: "Start with these 3 steps",
    steps: [
      `<a href="${mealsUrl}" style="color:#2f7d5b;font-weight:600;">Build your first meal plan</a> so Home Harmony can create a real grocery list.`,
      `<a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Review your grocery list</a> and make sure the quantities look right.`,
      `<a href="${familyUrl}" style="color:#2f7d5b;font-weight:600;">Invite your spouse or family</a> so everyone shares meals, tasks, and reminders.`,
    ],
    helpfulTitle: "Helpful next",
    helpfulItems: [
      `<a href="${settingsUrl}" style="color:#2f7d5b;font-weight:600;">Add your phone number</a> for reminder texts and daily updates.`,
      `<a href="${calendarUrl}" style="color:#2f7d5b;font-weight:600;">Review your calendar</a> so meals and events line up with your week.`,
    ],
    footer: "You can reply to this email anytime if you want help getting your first week set up.",
  });
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
  const base = args.appUrl.replace(/\/$/, "");
  const familyUrl = `${base}/family`;
  const recipesUrl = `${base}/recipes`;
  const mealsUrl = `${base}/meals`;
  const groceryUrl = `${base}/grocery`;
  const settingsUrl = `${base}/settings`;
  const workoutsUrl = `${base}/workouts`;

  return lifecycleEmailTemplate({
    userName: args.userName,
    subject: "Welcome to Home Harmony - your setup starts here",
    badge: "Quick start",
    title: "Here’s the fastest setup path, {name}",
    intro: "If you want Home Harmony to feel useful right away, these are the setup steps that matter most.",
    ctaLabel: "Finish Setup",
    ctaUrl: base,
    stepsTitle: "Fast setup path",
    steps: [
      `<a href="${familyUrl}" style="color:#2f7d5b;font-weight:600;">Set up your household</a> and invite spouse or kids.`,
      `<a href="${recipesUrl}" style="color:#2f7d5b;font-weight:600;">Add recipes</a> so planning uses your real meals.`,
      `<a href="${mealsUrl}" style="color:#2f7d5b;font-weight:600;">Build this week's meal plan</a> by generating or assigning meals manually.`,
      `<a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Confirm your grocery list</a> with rolled-up quantities.`,
    ],
    helpfulTitle: "Worth doing next",
    helpfulItems: [
      `<a href="${settingsUrl}" style="color:#2f7d5b;font-weight:600;">Add your phone number</a> to enable SMS reminders.`,
      `<a href="${workoutsUrl}" style="color:#2f7d5b;font-weight:600;">Optional: set macro goals</a> and workout tracking when you’re ready.`,
    ],
    footer: "Reply to this email anytime if you want help with setup.",
  });
}

function onboardingDay2Template(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const recipesUrl = `${base}/recipes`;
  const mealsUrl = `${base}/meals`;
  const groceryUrl = `${base}/grocery`;

  return lifecycleEmailTemplate({
    userName,
    subject: "Need a quick win? Build one real meal week",
    badge: "Day 2",
    title: "One good week makes the app click, {name}",
    intro: "The biggest unlock is simple: give Home Harmony real meals to work with, and it can take over the grocery planning for you.",
    ctaLabel: "Plan This Week",
    ctaUrl: mealsUrl,
    stepsTitle: "Do this next",
    steps: [
      `<a href="${recipesUrl}" style="color:#2f7d5b;font-weight:600;">Add 5-8 real recipes</a> your family actually eats.`,
      `<a href="${mealsUrl}" style="color:#2f7d5b;font-weight:600;">Set dinners for the week</a> so the plan reflects your real schedule.`,
      `<a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Check the grocery list</a> and make sure it looks usable.`,
    ],
    helpfulTitle: "Why this matters",
    helpfulItems: [
      "Once the meals are real, the grocery list stops feeling generic and starts saving time.",
      "You can still add breakfasts, lunches, snacks, and quick food logs later.",
    ],
  });
}

function onboardingDay4Template(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const familyUrl = `${base}/family`;
  const calendarUrl = `${base}/calendar`;
  const settingsUrl = `${base}/settings`;
  const tasksUrl = `${base}/tasks`;

  return lifecycleEmailTemplate({
    userName,
    subject: "Get your household synced so reminders go to the right people",
    badge: "Day 4",
    title: "Bring the rest of the household in, {name}",
    intro: "Home Harmony works best when the right people see the right meals, calendar items, and reminders.",
    ctaLabel: "Open Family Setup",
    ctaUrl: familyUrl,
    stepsTitle: "Best next setup steps",
    steps: [
      `<a href="${familyUrl}" style="color:#2f7d5b;font-weight:600;">Invite your spouse or family</a> so everyone shares the same household plan.`,
      `<a href="${settingsUrl}" style="color:#2f7d5b;font-weight:600;">Set phone numbers and reminder preferences</a> so texts go to the right person.`,
      `<a href="${calendarUrl}" style="color:#2f7d5b;font-weight:600;">Review calendar filters</a> for Family, Ken, Katie, or anyone else you’ve set up.`,
    ],
    helpfulTitle: "Optional cleanup",
    helpfulItems: [
      `<a href="${tasksUrl}" style="color:#2f7d5b;font-weight:600;">Assign tasks to adults</a> so reminders are more useful.`,
      "If you only want reminders by text and not on calendar feeds, you can control that in settings.",
    ],
  });
}

function onboardingDay7Template(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const mealsUrl = `${base}/meals`;
  const groceryUrl = `${base}/grocery`;
  const settingsUrl = `${base}/settings`;
  const calendarUrl = `${base}/calendar`;

  return lifecycleEmailTemplate({
    userName,
    subject: "A few smart tweaks can make Home Harmony feel automatic",
    badge: "Day 7",
    title: "Ready to make this run smoother, {name}?",
    intro: "Once your first week is in place, a few small settings make the app feel much more automatic from here on out.",
    ctaLabel: "Tune Your Setup",
    ctaUrl: settingsUrl,
    stepsTitle: "Good week-two upgrades",
    steps: [
      `<a href="${mealsUrl}" style="color:#2f7d5b;font-weight:600;">Set recurring meals</a> for breakfasts, lunches, or dinners you repeat often.`,
      `<a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Add weekly staples</a> so they show up automatically each order.`,
      `<a href="${calendarUrl}" style="color:#2f7d5b;font-weight:600;">Fine-tune calendar filters and reminders</a> so only the useful stuff surfaces.`,
    ],
    helpfulTitle: "Keep it simple",
    helpfulItems: [
      "You do not need every feature turned on at once to get value.",
      "The best setup is the one your household will actually keep using.",
    ],
  });
}

function getLifecycleTemplate(templateKey: LifecycleTemplateKey, userName: string, appUrl: string) {
  switch (templateKey) {
    case "quickstart":
      return onboardingPreviewTemplate({ userName, appUrl });
    case "day2":
      return onboardingDay2Template(userName, appUrl);
    case "day4":
      return onboardingDay4Template(userName, appUrl);
    case "day7":
      return onboardingDay7Template(userName, appUrl);
    case "welcome":
    default:
      return welcomeTemplate(userName, appUrl);
  }
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

    if (action === "send_email_preview") {
      const recipientEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const userName = typeof payload.userName === "string" ? payload.userName.trim() : inviterName;
      const templateKeyRaw = typeof payload.templateKey === "string" ? payload.templateKey.trim().toLowerCase() : "welcome";
      const templateKey: LifecycleTemplateKey = (
        templateKeyRaw === "quickstart"
        || templateKeyRaw === "day2"
        || templateKeyRaw === "day4"
        || templateKeyRaw === "day7"
      )
        ? templateKeyRaw
        : "welcome";
      if (!recipientEmail) return json({ error: "Recipient email is required." }, 400);
      if (!isServiceRoleAuth) {
        const allowedRecipients = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));
        if (!allowedRecipients.has(recipientEmail)) {
          return json({ error: "Forbidden." }, 403);
        }
      }

      const template = getLifecycleTemplate(templateKey, userName, appUrl);
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
