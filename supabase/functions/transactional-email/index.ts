import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { estimateEmailSendCostUsd, logUsageCostEvent } from "../_shared/costMeter.ts";

type Action =
  | "send_welcome"
  | "send_family_invite"
  | "send_onboarding_preview"
  | "send_welcome_preview"
  | "send_email_preview"
  | "send_lifecycle_email"
  | "send_admin_new_user_notice"
  | "send_subscription_canceled_notice"
  | "send_admin_subscription_canceled_notice";

type LifecycleTemplateKey =
  | "welcome"
  | "plan_meals"
  | "review_grocery"
  | "invite_household"
  | "set_reminders"
  | "calendar_setup"
  | "power_up";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_ADMIN_EMAILS = ["kroberts035@gmail.com"];
const OWNER_NOTIFICATION_EMAIL = "ken@homeharmonyhq.com";

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

async function logEmailCost(userId: string | null, meter: string, metadata?: Record<string, unknown>) {
  await logUsageCostEvent({
    userId,
    category: "email",
    provider: "resend",
    meter,
    estimatedCostUsd: estimateEmailSendCostUsd(1),
    quantity: 1,
    metadata,
  });
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
  const safeName = escapeHtml(userName || "there");

  return {
    subject: "Welcome to Home Harmony 🏡 You're going to love it here",
    text:
      `Hi ${userName || "there"},\n\n` +
      `Welcome to Home Harmony — we're so glad you're here!\n\n` +
      `You just took the first step toward a calmer, more organized home life. Whether it's getting dinner on the table without the daily scramble or finally staying on top of chores and household tasks, Home Harmony is here to make it all a little easier.\n\n` +
      `Here's what you can do right now:\n` +
      `- Set up your household — add your family members so everyone can stay in the loop.\n` +
      `- Plan your first week of meals — use the meal lists or weekly grid, then review the grocery list built from your plan.\n` +
      `- Create your first task — assign chores, reminders, and to-dos to the right person.\n\n` +
      `Get Started: ${base}\n\n` +
      `Over the next few days, we'll share a few tips to help you get the most out of Home Harmony. But for now, just explore and make it your own.\n\n` +
      `Welcome to the family,\n\n` +
      `Ken and the Home Harmony HQ Team\n` +
      `www.homeharmonyhq.com\n\n` +
      `P.S. Have questions? Just reply to this email — we're real people and we'd love to help.\n`,
    html: `
      <div style="background:#f6f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9dfcf;border-radius:20px;overflow:hidden;">
          <div style="padding:32px 28px;background:linear-gradient(180deg,#fbf7f1 0%,#ffffff 100%);">
            <h1 style="font-size:32px;line-height:1.15;margin:0 0 18px;font-family:Georgia,serif;font-weight:700;color:#1f1a17;">
              Welcome to Home Harmony
            </h1>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Hi ${safeName},
            </p>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Welcome to Home Harmony — we're so glad you're here!
            </p>
            <p style="margin:0 0 22px;line-height:1.75;font-size:16px;color:#5f554c;">
              You just took the first step toward a calmer, more organized home life. Whether it's getting dinner on the table without the daily scramble or finally staying on top of chores and household tasks, Home Harmony is here to make it all a little easier.
            </p>

            <div style="margin:0 0 22px;padding:18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1f1a17;">Here's what you can do right now:</p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                👉 <strong>Set up your household</strong> — add your family members so everyone can stay in the loop.
              </p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                👉 <strong>Plan your first week of meals</strong> — use the meal lists or weekly grid, then review the grocery list built from your plan.
              </p>
              <p style="margin:0;line-height:1.7;color:#5f554c;">
                👉 <strong>Create your first task</strong> — assign chores, reminders, and to-dos to the right person.
              </p>
            </div>

            <a href="${base}" style="display:inline-block;background:#2f7d5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              Get Started →
            </a>

            <p style="margin:24px 0 0;line-height:1.75;font-size:16px;color:#5f554c;">
              Over the next few days, we'll share a few tips to help you get the most out of Home Harmony. But for now, just explore and make it your own.
            </p>
            <p style="margin:24px 0 0;line-height:1.75;font-size:16px;color:#5f554c;">
              Welcome to the family 💛
            </p>
            <p style="margin:18px 0 0;line-height:1.7;font-size:15px;color:#5f554c;">
              Ken and the Home Harmony HQ Team<br />
              <a href="https://www.homeharmonyhq.com" style="color:#2f7d5b;text-decoration:none;">www.homeharmonyhq.com</a>
            </p>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#7a6f64;">
              P.S. Have questions? Just reply to this email — we're real people and we'd love to help.
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

function subscriptionCanceledTemplate(args: {
  userName: string;
  accessEndsOn: string;
  isTrial: boolean;
  appUrl: string;
}) {
  const safeName = escapeHtml(args.userName || "there");
  const billingUrl = `${args.appUrl.replace(/\/$/, "")}/billing`;
  const accessLine = args.isTrial
    ? `You can keep using Home Harmony until your free trial ends on ${escapeHtml(args.accessEndsOn)}.`
    : `You can keep using Home Harmony until your current billing period ends on ${escapeHtml(args.accessEndsOn)}.`;

  return {
    subject: "Your Home Harmony subscription has been canceled",
    text:
      `Hi ${args.userName || "there"},\n\n` +
      `Your Home Harmony subscription has been canceled.\n\n` +
      `${args.isTrial ? "You can keep using Home Harmony until your free trial ends" : "You can keep using Home Harmony until your current billing period ends"} on ${args.accessEndsOn}.\n\n` +
      `You can review your billing any time here: ${billingUrl}\n\n` +
      `Ken and the Home Harmony HQ Team\n`,
    html: `
      <div style="background:#f6f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9dfcf;border-radius:20px;overflow:hidden;">
          <div style="padding:32px 28px;background:linear-gradient(180deg,#fbf7f1 0%,#ffffff 100%);">
            <h1 style="font-size:30px;line-height:1.15;margin:0 0 18px;font-family:Georgia,serif;font-weight:700;color:#1f1a17;">
              Your subscription has been canceled
            </h1>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Hi ${safeName},
            </p>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Your Home Harmony subscription has been canceled.
            </p>
            <div style="margin:0 0 22px;padding:18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
              <p style="margin:0;line-height:1.7;color:#5f554c;">
                ${accessLine}
              </p>
            </div>
            <a href="${billingUrl}" style="display:inline-block;background:#2f7d5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              View Billing
            </a>
            <p style="margin:24px 0 0;line-height:1.7;font-size:15px;color:#5f554c;">
              Ken and the Home Harmony HQ Team
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

function adminNewUserTemplate(args: {
  userName: string;
  email: string;
  roleLabel: string;
  onboardingMode: string;
  householdName?: string | null;
}) {
  return {
    subject: `New Home Harmony user: ${args.userName || args.email}`,
    text:
      `A new user just completed Home Harmony onboarding.\n\n` +
      `Name: ${args.userName || "Unknown"}\n` +
      `Email: ${args.email}\n` +
      `Role: ${args.roleLabel}\n` +
      `Onboarding mode: ${args.onboardingMode}\n` +
      `Household: ${args.householdName || "Not provided"}\n`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937;">
        <h1 style="font-size:24px;margin:0 0 12px;">New Home Harmony user</h1>
        <p style="margin:0 0 16px;line-height:1.6;">A new user just completed onboarding.</p>
        <div style="padding:16px 18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
          <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(args.userName || "Unknown")}</p>
          <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(args.email)}</p>
          <p style="margin:0 0 8px;"><strong>Role:</strong> ${escapeHtml(args.roleLabel)}</p>
          <p style="margin:0 0 8px;"><strong>Onboarding mode:</strong> ${escapeHtml(args.onboardingMode)}</p>
          <p style="margin:0;"><strong>Household:</strong> ${escapeHtml(args.householdName || "Not provided")}</p>
        </div>
      </div>
    `,
  };
}

function adminCancellationTemplate(args: {
  userName: string;
  email: string;
  accessEndsOn: string;
  isTrial: boolean;
}) {
  return {
    subject: `Canceled: ${args.userName || args.email}`,
    text:
      `A Home Harmony customer canceled.\n\n` +
      `Name: ${args.userName || "Unknown"}\n` +
      `Email: ${args.email}\n` +
      `Access through: ${args.accessEndsOn}\n` +
      `Canceled during trial: ${args.isTrial ? "Yes" : "No"}\n`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1f2937;">
        <h1 style="font-size:24px;margin:0 0 12px;">Subscription canceled</h1>
        <div style="padding:16px 18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
          <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(args.userName || "Unknown")}</p>
          <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(args.email)}</p>
          <p style="margin:0 0 8px;"><strong>Access through:</strong> ${escapeHtml(args.accessEndsOn)}</p>
          <p style="margin:0;"><strong>Canceled during trial:</strong> ${args.isTrial ? "Yes" : "No"}</p>
        </div>
      </div>
    `,
  };
}

function planMealsTemplate(args: { userName: string; appUrl: string }) {
  const base = args.appUrl.replace(/\/$/, "");
  const mealsUrl = `${base}/meals`;
  const safeName = escapeHtml(args.userName || "there");

  return {
    subject: "What’s for dinner? Let’s make that question easy 🍽️",
    text:
      `Hi ${args.userName || "there"},\n\n` +
      `Now that you're all set up, let's talk about one of the most popular features in Home Harmony — meal planning.\n\n` +
      `For a lot of families, the hardest question of the day is "What's for dinner?" With Home Harmony, you can answer that question for the whole week in just a few minutes.\n\n` +
      `Here's how to make meal planning work for you:\n` +
      `- Browse recipes and save your favorites so they’re easy to reuse.\n` +
      `- Add meals to your week in Breakfast List, Lunch List, Snack List, Dinner List, or Weekly Meal Grid.\n` +
      `- Open Grocery and your shopping list is already built from your planned meals.\n` +
      `- Mark your order handled, then keep adding staples and next-order items through the week.\n\n` +
      `Pro tip: Plan your meals on Sunday and you'll save an average of 2–3 hours and a lot of stress during the week.\n\n` +
      `Start Planning This Week's Meals: ${mealsUrl}\n\n` +
      `Have a family recipe you love? You can add your own recipe too and keep it in your library for later.\n\n` +
      `More good stuff coming your way soon!\n\n` +
      `Warmly,\n` +
      `Ken and the Home Harmony HQ Team\n` +
      `www.homeharmonyhq.com\n`,
    html: `
      <div style="background:#f6f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9dfcf;border-radius:20px;overflow:hidden;">
          <div style="padding:32px 28px;background:linear-gradient(180deg,#fbf7f1 0%,#ffffff 100%);">
            <h1 style="font-size:32px;line-height:1.15;margin:0 0 18px;font-family:Georgia,serif;font-weight:700;color:#1f1a17;">
              What’s for dinner? Let’s make that question easy
            </h1>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Hi ${safeName},
            </p>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Now that you're all set up, let's talk about one of the most popular features in Home Harmony — meal planning.
            </p>
            <p style="margin:0 0 22px;line-height:1.75;font-size:16px;color:#5f554c;">
              For a lot of families, the hardest question of the day is "What's for dinner?" With Home Harmony, you can answer that question for the whole week in just a few minutes.
            </p>

            <div style="margin:0 0 22px;padding:18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1f1a17;">Here's how to make meal planning work for you:</p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                ✅ Browse recipes and save your favorites so they’re easy to reuse.
              </p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                ✅ Add meals to your week in Breakfast List, Lunch List, Snack List, Dinner List, or Weekly Meal Grid.
              </p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                ✅ Open Grocery and your shopping list is already built from your planned meals.
              </p>
              <p style="margin:0;line-height:1.7;color:#5f554c;">
                ✅ Mark your order handled, then keep adding staples and next-order items through the week.
              </p>
            </div>

            <div style="margin:0 0 22px;padding:16px 18px;border:1px solid #efe7da;border-radius:14px;background:#fffdf9;">
              <p style="margin:0;line-height:1.7;font-size:15px;color:#5f554c;">
                <strong>Pro tip:</strong> Plan your meals on Sunday and you'll save an average of 2–3 hours and a lot of stress during the week.
              </p>
            </div>

            <a href="${mealsUrl}" style="display:inline-block;background:#2f7d5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              Start Planning This Week's Meals →
            </a>

            <p style="margin:24px 0 0;line-height:1.75;font-size:16px;color:#5f554c;">
              Have a family recipe you love? You can add your own recipe too and keep it in your library for later.
            </p>
            <p style="margin:24px 0 0;line-height:1.75;font-size:16px;color:#5f554c;">
              More good stuff coming your way soon!
            </p>
            <p style="margin:24px 0 0;line-height:1.7;font-size:15px;color:#5f554c;">
              Warmly,<br />
              Ken and the Home Harmony HQ Team<br />
              <a href="https://www.homeharmonyhq.com" style="color:#2f7d5b;text-decoration:none;">www.homeharmonyhq.com</a>
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

function reviewGroceryTemplate(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const groceryUrl = `${base}/grocery`;
  const mealsUrl = `${base}/meals`;
  const recipesUrl = `${base}/recipes`;

  return lifecycleEmailTemplate({
    userName,
    subject: "Your grocery list can save time now",
    badge: "Grocery flow",
    title: "Review your grocery list, {name}",
    intro: "Once meals are in, the grocery list becomes one of the most useful parts of Home Harmony. This is where you catch bad quantities, add staples, and prep the next order.",
    ctaLabel: "Open Grocery List",
    ctaUrl: groceryUrl,
    stepsTitle: "Use it like this",
    steps: [
      `<a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Check quantities</a> and make sure the rollup looks right.`,
      `<a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Add weekly staples</a> for things you always buy.`,
      `<a href="${groceryUrl}" style="color:#2f7d5b;font-weight:600;">Mark ordered when checkout is done</a> so the list resets into your next order.`,
    ],
    helpfulTitle: "Helpful if it looks thin",
    helpfulItems: [
      `<a href="${mealsUrl}" style="color:#2f7d5b;font-weight:600;">Add more meals</a> if the grocery list feels too light.`,
      `<a href="${recipesUrl}" style="color:#2f7d5b;font-weight:600;">Tighten recipe ingredients</a> if quantities look off.`,
    ],
  });
}

function inviteHouseholdTemplate(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const familyUrl = `${base}/family`;
  const safeName = escapeHtml(userName || "there");

  return {
    subject: "The secret to a smoother home (it’s easier than you think) 🧹",
    text:
      `Hi ${userName || "there"},\n\n` +
      `Meals sorted — now let’s talk about keeping the rest of the house running smoothly.\n\n` +
      `Home Harmony’s household hub is designed to take the mental load off your shoulders. No more trying to remember who was supposed to clean the bathroom, or whether the car service is overdue.\n\n` +
      `Here are a few ways families are using it:\n` +
      `- Shared chore lists — assign tasks to family members and everyone can see what’s done and what’s not.\n` +
      `- Recurring reminders — set tasks like "Change AC filter" or "Pay rent" to repeat automatically so nothing slips through the cracks.\n` +
      `- A shared family calendar — appointments, school events, and deadlines all in one place.\n` +
      `- Shared household setup — keep adults, kids, chores, tasks, and reminders organized in one place.\n\n` +
      `The secret to a smoother home? Getting everyone on the same page. Home Harmony makes it easy to invite your partner, roommates, or older kids so the whole household is in sync.\n\n` +
      `Set Up Your Household Hub: ${familyUrl}\n\n` +
      `You’ve got this 😊\n\n` +
      `Ken and the Home Harmony HQ Team\n` +
      `www.homeharmonyhq.com\n`,
    html: `
      <div style="background:#f6f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9dfcf;border-radius:20px;overflow:hidden;">
          <div style="padding:32px 28px;background:linear-gradient(180deg,#fbf7f1 0%,#ffffff 100%);">
            <h1 style="font-size:32px;line-height:1.15;margin:0 0 18px;font-family:Georgia,serif;font-weight:700;color:#1f1a17;">
              The secret to a smoother home
            </h1>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Hi ${safeName},
            </p>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Meals sorted — now let’s talk about keeping the rest of the house running smoothly.
            </p>
            <p style="margin:0 0 22px;line-height:1.75;font-size:16px;color:#5f554c;">
              Home Harmony’s household hub is designed to take the mental load off your shoulders. No more trying to remember who was supposed to clean the bathroom, or whether the car service is overdue.
            </p>

            <div style="margin:0 0 22px;padding:18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1f1a17;">Here are a few ways families are using it:</p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                🏠 <strong>Shared chore lists</strong> — assign tasks to family members and everyone can see what’s done and what’s not.
              </p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                🔔 <strong>Recurring reminders</strong> — set tasks like "Change AC filter" or "Pay rent" to repeat automatically so nothing slips through the cracks.
              </p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                📅 <strong>A shared family calendar</strong> — appointments, school events, and deadlines all in one place.
              </p>
              <p style="margin:0;line-height:1.7;color:#5f554c;">
                📝 <strong>Shared household setup</strong> — keep adults, kids, chores, tasks, and reminders organized in one place.
              </p>
            </div>

            <p style="margin:0 0 22px;line-height:1.75;font-size:16px;color:#5f554c;">
              The secret to a smoother home? Getting everyone on the same page. Home Harmony makes it easy to invite your partner, roommates, or older kids so the whole household is in sync.
            </p>

            <a href="${familyUrl}" style="display:inline-block;background:#2f7d5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              Set Up Your Household Hub →
            </a>

            <p style="margin:24px 0 0;line-height:1.75;font-size:16px;color:#5f554c;">
              You’ve got this 😊
            </p>
            <p style="margin:24px 0 0;line-height:1.7;font-size:15px;color:#5f554c;">
              Ken and the Home Harmony HQ Team<br />
              <a href="https://www.homeharmonyhq.com" style="color:#2f7d5b;text-decoration:none;">www.homeharmonyhq.com</a>
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

function setRemindersTemplate(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const settingsUrl = `${base}/settings`;
  const calendarUrl = `${base}/calendar`;
  const tasksUrl = `${base}/tasks`;

  return lifecycleEmailTemplate({
    userName,
    subject: "Set the reminders that actually help",
    badge: "Reminders",
    title: "Make reminders useful, not noisy, {name}",
    intro: "The best reminder setup is light and practical. A few good texts are much better than getting pinged about everything.",
    ctaLabel: "Open Settings",
    ctaUrl: settingsUrl,
    stepsTitle: "Good reminder setup",
    steps: [
      `<a href="${settingsUrl}" style="color:#2f7d5b;font-weight:600;">Add your phone number</a> so texts can route correctly.`,
      `<a href="${calendarUrl}" style="color:#2f7d5b;font-weight:600;">Keep useful calendar reminders</a> like events and arrival timing.`,
      `<a href="${tasksUrl}" style="color:#2f7d5b;font-weight:600;">Assign tasks to adults</a> if you want reminders to follow ownership.`,
    ],
    helpfulTitle: "Keep it light",
    helpfulItems: [
      "You can skip reminder types that feel noisy.",
      "Home Harmony works best when reminders are the ones you’ll actually act on.",
    ],
  });
}

function calendarSetupTemplate(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const calendarUrl = `${base}/calendar`;
  const appleCalendarUrl = `${base}/apple-calendar-connect`;
  const settingsUrl = `${base}/settings`;

  return lifecycleEmailTemplate({
    userName,
    subject: "Set up the shared calendar without making it messy",
    badge: "Calendar",
    title: "Make the calendar useful, {name}",
    intro: "The calendar works best when it shows the real family schedule and only the reminders you actually want to see.",
    ctaLabel: "Open Calendar",
    ctaUrl: calendarUrl,
    stepsTitle: "Best calendar setup",
    steps: [
      `<a href="${calendarUrl}" style="color:#2f7d5b;font-weight:600;">Add your real family events</a> and use Family, Ken, Katie, or other filters where helpful.`,
      `<a href="${calendarUrl}" style="color:#2f7d5b;font-weight:600;">Use arrive-by timing</a> when you care about being somewhere by a certain time.`,
      `<a href="${appleCalendarUrl}" style="color:#2f7d5b;font-weight:600;">Connect Apple Calendar</a> if you want the feed outside the app.`,
    ],
    helpfulTitle: "Good cleanup moves",
    helpfulItems: [
      "Keep clutter low by only turning on the reminder/event types you actually want surfaced.",
      `<a href="${settingsUrl}" style="color:#2f7d5b;font-weight:600;">Use settings and filters</a> to keep the calendar calm.`,
    ],
  });
}

function powerUpTemplate(userName: string, appUrl: string) {
  const base = appUrl.replace(/\/$/, "");
  const mealsUrl = `${base}/meals`;
  const safeName = escapeHtml(userName || "there");

  return {
    subject: "Your meals are planned — your macros are already mostly done too 💪",
    text:
      `Hi ${userName || "there"},\n\n` +
      `Here’s something a lot of Home Harmony users don’t realize right away: once your meals are planned, a big part of your macro tracking is already mapped out.\n\n` +
      `Because your meals are already in the planner, Home Harmony can show the nutritional breakdown for the day — calories, protein, carbs, and fat — without you having to rebuild the math from scratch every time.\n\n` +
      `Here’s how to make the most of it:\n` +
      `- Open Macro Budget Planner in Meals to see your projected day and week totals.\n` +
      `- Set your targets in the built-in Macro Calculator so Home Harmony can compare each day against your goal.\n` +
      `- Swap meals or change servings and watch the projected numbers update.\n` +
      `- Use adult dashboards if different people in the household have different goals.\n\n` +
      `The part that really makes a difference is this: planned meals reduce decision fatigue. When breakfast, lunch, dinner, and snacks are already mapped out, it’s much easier to stay consistent and not fall back on whatever is easiest at the last minute.\n\n` +
      `Home Harmony makes that easier by keeping your meals, projected macros, and grocery plan working together. Then if you eat something different, you can still log or adjust it.\n\n` +
      `See My Macro Breakdown: ${mealsUrl}\n\n` +
      `Eat well and feel good 🙌\n\n` +
      `Ken and the Home Harmony HQ Team\n` +
      `www.homeharmonyhq.com\n\n` +
      `P.S. Not sure what macro targets to set? The built-in Macro Calculator gives you a starting point based on your details.\n`,
    html: `
      <div style="background:#f6f1e8;padding:32px 16px;font-family:Arial,sans-serif;color:#1f2937;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e9dfcf;border-radius:20px;overflow:hidden;">
          <div style="padding:32px 28px;background:linear-gradient(180deg,#fbf7f1 0%,#ffffff 100%);">
            <h1 style="font-size:32px;line-height:1.15;margin:0 0 18px;font-family:Georgia,serif;font-weight:700;color:#1f1a17;">
              Your meals are planned — your macros are already mostly done too
            </h1>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Hi ${safeName},
            </p>
            <p style="margin:0 0 18px;line-height:1.75;font-size:16px;color:#5f554c;">
              Here’s something a lot of Home Harmony users don’t realize right away: once your meals are planned, a big part of your macro tracking is already mapped out.
            </p>
            <p style="margin:0 0 22px;line-height:1.75;font-size:16px;color:#5f554c;">
              Because your meals are already in the planner, Home Harmony can show the nutritional breakdown for the day — calories, protein, carbs, and fat — without you having to rebuild the math from scratch every time.
            </p>

            <div style="margin:0 0 22px;padding:18px;border:1px solid #efe7da;border-radius:14px;background:#fcfaf7;">
              <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1f1a17;">Here’s how to make the most of it:</p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                🥗 <strong>Open Macro Budget Planner in Meals</strong> to see your projected day and week totals.
              </p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                📊 <strong>Set your targets</strong> in the built-in Macro Calculator so Home Harmony can compare each day against your goal.
              </p>
              <p style="margin:0 0 10px;line-height:1.7;color:#5f554c;">
                🔄 <strong>Swap meals or change servings</strong> and watch the projected numbers update.
              </p>
              <p style="margin:0;line-height:1.7;color:#5f554c;">
                ⚖️ <strong>Use adult dashboards</strong> if different people in the household have different goals.
              </p>
            </div>

            <p style="margin:0 0 22px;line-height:1.75;font-size:16px;color:#5f554c;">
              The part that really makes a difference is this: planned meals reduce decision fatigue. When breakfast, lunch, dinner, and snacks are already mapped out, it’s much easier to stay consistent and not fall back on whatever is easiest at the last minute.
            </p>
            <p style="margin:0 0 22px;line-height:1.75;font-size:16px;color:#5f554c;">
              Home Harmony makes that easier by keeping your meals, projected macros, and grocery plan working together. Then if you eat something different, you can still log or adjust it.
            </p>

            <a href="${mealsUrl}" style="display:inline-block;background:#2f7d5b;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">
              See My Macro Breakdown →
            </a>

            <p style="margin:24px 0 0;line-height:1.75;font-size:16px;color:#5f554c;">
              Eat well and feel good 🙌
            </p>
            <p style="margin:24px 0 0;line-height:1.7;font-size:15px;color:#5f554c;">
              Ken and the Home Harmony HQ Team<br />
              <a href="https://www.homeharmonyhq.com" style="color:#2f7d5b;text-decoration:none;">www.homeharmonyhq.com</a>
            </p>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#7a6f64;">
              P.S. Not sure what macro targets to set? The built-in Macro Calculator gives you a starting point based on your details.
            </p>
          </div>
        </div>
      </div>
    `,
  };
}

function getLifecycleTemplate(templateKey: LifecycleTemplateKey, userName: string, appUrl: string) {
  switch (templateKey) {
    case "plan_meals":
      return planMealsTemplate({ userName, appUrl });
    case "review_grocery":
      return reviewGroceryTemplate(userName, appUrl);
    case "invite_household":
      return inviteHouseholdTemplate(userName, appUrl);
    case "set_reminders":
      return setRemindersTemplate(userName, appUrl);
    case "calendar_setup":
      return calendarSetupTemplate(userName, appUrl);
    case "power_up":
      return powerUpTemplate(userName, appUrl);
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

    let authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null = null;
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
      await logEmailCost(authUser?.id || null, "welcome_email", { action, to: recipient });

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
      await logEmailCost(authUser?.id || null, "welcome_email_preview", { action, to: recipientEmail });

      return json({ success: true, provider });
    }

    if (action === "send_email_preview") {
      const recipientEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const userName = typeof payload.userName === "string" ? payload.userName.trim() : inviterName;
      const templateKeyRaw = typeof payload.templateKey === "string" ? payload.templateKey.trim().toLowerCase() : "welcome";
      const templateKey: LifecycleTemplateKey = (
        templateKeyRaw === "plan_meals"
        || templateKeyRaw === "review_grocery"
        || templateKeyRaw === "invite_household"
        || templateKeyRaw === "set_reminders"
        || templateKeyRaw === "calendar_setup"
        || templateKeyRaw === "power_up"
      )
        ? templateKeyRaw as LifecycleTemplateKey
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
      await logEmailCost(authUser?.id || null, "lifecycle_email_preview", { action, templateKey, to: recipientEmail });

      return json({ success: true, provider });
    }

    if (action === "send_lifecycle_email") {
      if (!isServiceRoleAuth) return json({ error: "Forbidden." }, 403);

      const recipientEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const userName = typeof payload.userName === "string" ? payload.userName.trim() : inviterName;
      const userId = typeof payload.userId === "string" ? payload.userId.trim() : null;
      const templateKeyRaw = typeof payload.templateKey === "string" ? payload.templateKey.trim().toLowerCase() : "welcome";
      const templateKey: LifecycleTemplateKey = (
        templateKeyRaw === "plan_meals"
        || templateKeyRaw === "review_grocery"
        || templateKeyRaw === "invite_household"
        || templateKeyRaw === "set_reminders"
        || templateKeyRaw === "calendar_setup"
        || templateKeyRaw === "power_up"
      )
        ? templateKeyRaw as LifecycleTemplateKey
        : "welcome";
      if (!recipientEmail) return json({ error: "Recipient email is required." }, 400);

      const template = getLifecycleTemplate(templateKey, userName, appUrl);
      const provider = await sendViaResend({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      await logEmailCost(userId, "lifecycle_email", { action, templateKey, to: recipientEmail });

      return json({ success: true, provider });
    }

    if (action === "send_admin_new_user_notice") {
      const recipientEmail = OWNER_NOTIFICATION_EMAIL;
      const userName = typeof payload.userName === "string" ? payload.userName.trim() : inviterName;
      const userEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : authUser?.email?.trim().toLowerCase() || "";
      const roleLabel = typeof payload.roleLabel === "string" ? payload.roleLabel.trim() : "user";
      const onboardingMode = typeof payload.onboardingMode === "string" ? payload.onboardingMode.trim() : "unknown";
      const householdName = typeof payload.householdName === "string" ? payload.householdName.trim() : null;
      if (!userEmail) return json({ error: "User email is required." }, 400);

      const template = adminNewUserTemplate({
        userName,
        email: userEmail,
        roleLabel,
        onboardingMode,
        householdName,
      });
      const provider = await sendViaResend({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      await logEmailCost(authUser?.id || null, "admin_new_user_notice", {
        action,
        to: recipientEmail,
        userEmail,
        roleLabel,
      });

      return json({ success: true, provider });
    }

    if (action === "send_subscription_canceled_notice") {
      if (!isServiceRoleAuth) return json({ error: "Forbidden." }, 403);

      const recipientEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const userName = typeof payload.userName === "string" ? payload.userName.trim() : "there";
      const accessEndsOn = typeof payload.accessEndsOn === "string" ? payload.accessEndsOn.trim() : "";
      const isTrial = Boolean(payload.isTrial);
      const userId = typeof payload.userId === "string" ? payload.userId.trim() : null;
      if (!recipientEmail || !accessEndsOn) return json({ error: "Recipient email and access end date are required." }, 400);

      const template = subscriptionCanceledTemplate({
        userName,
        accessEndsOn,
        isTrial,
        appUrl,
      });
      const provider = await sendViaResend({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      await logEmailCost(userId, "subscription_canceled_notice", { action, to: recipientEmail, isTrial });

      return json({ success: true, provider });
    }

    if (action === "send_admin_subscription_canceled_notice") {
      if (!isServiceRoleAuth) return json({ error: "Forbidden." }, 403);

      const userName = typeof payload.userName === "string" ? payload.userName.trim() : "Unknown";
      const userEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const accessEndsOn = typeof payload.accessEndsOn === "string" ? payload.accessEndsOn.trim() : "";
      const isTrial = Boolean(payload.isTrial);
      const userId = typeof payload.userId === "string" ? payload.userId.trim() : null;
      if (!userEmail || !accessEndsOn) return json({ error: "User email and access end date are required." }, 400);

      const template = adminCancellationTemplate({
        userName,
        email: userEmail,
        accessEndsOn,
        isTrial,
      });
      const provider = await sendViaResend({
        to: OWNER_NOTIFICATION_EMAIL,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      await logEmailCost(userId, "admin_subscription_canceled_notice", {
        action,
        to: OWNER_NOTIFICATION_EMAIL,
        userEmail,
        isTrial,
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
      await logEmailCost(authUser?.id || null, "family_invite_email", { action, role, to: recipientEmail });

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

      const template = planMealsTemplate({ userName, appUrl });
      const provider = await sendViaResend({
        to: recipientEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
      await logEmailCost(authUser?.id || null, "onboarding_preview_email", { action, to: recipientEmail });

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
