import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePinterestBoardUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(url.protocol)) return null;

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("pinterest.com")) return null;

  // Typical board path: /<username>/<board-name>/
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  url.hash = "";
  return url;
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function extractBoardTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return "Pinterest board";
  return match[1]
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPinLinks(html: string): string[] {
  const absolute = Array.from(html.matchAll(/https:\/\/www\.pinterest\.com\/pin\/(\d+)\/?/gi)).map(
    (match) => `https://www.pinterest.com/pin/${match[1]}/`,
  );
  const relative = Array.from(html.matchAll(/["'](\/pin\/(\d+)\/?)["']/gi)).map(
    (match) => `https://www.pinterest.com/pin/${match[2]}/`,
  );

  return dedupe([...absolute, ...relative]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceUrl = typeof body?.url === "string" ? body.url : "";
    const limitRaw = typeof body?.limit === "number" ? body.limit : 40;
    const limit = Math.max(1, Math.min(80, Math.floor(limitRaw)));

    const boardUrl = normalizePinterestBoardUrl(sourceUrl);
    if (!boardUrl) {
      return json({ success: false, error: "Enter a valid Pinterest board URL." });
    }

    const response = await fetch(boardUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return json({
        success: false,
        error: `Could not open that board (${response.status}). Try again or paste pin links directly.`,
      });
    }

    const html = await response.text();
    const links = extractPinLinks(html).slice(0, limit);

    if (!links.length) {
      return json({
        success: false,
        error: "No pin links found on that board page. Try a different board or paste links manually.",
      });
    }

    return json({
      success: true,
      boardUrl: boardUrl.toString(),
      boardTitle: extractBoardTitle(html),
      links,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message });
  }
});
