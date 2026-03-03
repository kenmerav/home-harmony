interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid: string | null;
  fromNumber: string | null;
}

export interface TwilioSendResult {
  sid: string;
  status: string;
}

function loadConfig(): TwilioConfig {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || null;
  const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER") || null;

  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.");
  }
  if (!messagingServiceSid && !fromNumber) {
    throw new Error("Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER.");
  }

  return {
    accountSid,
    authToken,
    messagingServiceSid,
    fromNumber,
  };
}

export function normalizePhone(raw: string): string {
  return raw.trim().replace(/[^\d+]/g, "");
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export async function sendTwilioSms(to: string, body: string): Promise<TwilioSendResult> {
  const cfg = loadConfig();
  const params = new URLSearchParams();
  params.set("To", to);
  params.set("Body", body);
  if (cfg.messagingServiceSid) {
    params.set("MessagingServiceSid", cfg.messagingServiceSid);
  } else if (cfg.fromNumber) {
    params.set("From", cfg.fromNumber);
  }

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const message = data?.message || `Twilio send failed (${resp.status}).`;
    throw new Error(message);
  }

  return {
    sid: String(data?.sid || ""),
    status: String(data?.status || "queued"),
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function verifyTwilioSignature(
  requestUrl: string,
  rawBody: string,
  headerSignature: string | null,
): Promise<boolean> {
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!authToken) return true;
  if (!headerSignature) return false;

  const params = new URLSearchParams(rawBody);
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));

  let payload = requestUrl;
  for (const [key, value] of sorted) {
    payload += `${key}${value}`;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = toBase64(new Uint8Array(signature));
  return expected === headerSignature;
}
