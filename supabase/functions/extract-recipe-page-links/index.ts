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

function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  try {
    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function decodeHtml(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(input: string) {
  return decodeHtml(input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? stripTags(match[1]) : "Recipe page";
}

function titleFromUrl(url: URL) {
  const tail = url.pathname.split("/").filter(Boolean).pop() || "";
  const cleaned = decodeURIComponent(tail)
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Recipe Link";
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function hasIgnoredPath(pathname: string) {
  const value = pathname.toLowerCase();
  if (!value || value === "/") return true;
  if (/\.(jpg|jpeg|png|webp|svg|gif|pdf|zip|xml|rss|txt|css|js)$/i.test(value)) return true;
  if (value.startsWith("/wp-")) return true;
  if (value.includes("/tag/")) return true;
  if (value.includes("/author/")) return true;
  if (value.includes("/feed")) return true;
  if (value.includes("/search/")) return true;
  if (value.includes("/privacy")) return true;
  if (value.includes("/terms")) return true;
  return false;
}

function scoreRecipeCandidate(url: URL, text: string): number {
  const keywords =
    /(recipe|dinner|lunch|breakfast|meal|protein|chicken|beef|turkey|pasta|salad|taco|bowl|soup|skillet|slow cooker|crockpot|air fryer|sheet pan|meal prep)/i;
  const pathname = url.pathname.toLowerCase();
  const textLower = text.toLowerCase();
  const segments = pathname.split("/").filter(Boolean);

  let score = 0;
  if (keywords.test(pathname)) score += 3;
  if (keywords.test(textLower)) score += 3;
  if (segments.length >= 1) score += 1;
  if (segments.length >= 2) score += 1;
  if (text.length >= 8 && text.length <= 120) score += 1;
  if (!url.search) score += 1;
  if (pathname.includes("/category/")) score -= 2;
  if (pathname.includes("/page/")) score -= 2;

  return score;
}

type Candidate = { url: string; title: string; score: number };

function extractAnchorCandidates(sourceUrl: URL, html: string): Candidate[] {
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates: Candidate[] = [];
  const sourcePath = sourceUrl.pathname.replace(/\/+$/, "") || "/";
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1]?.trim();
    const textRaw = match[2] || "";
    if (!href) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, sourceUrl.toString());
    } catch {
      continue;
    }

    if (!["http:", "https:"].includes(resolved.protocol)) continue;
    if (resolved.hostname !== sourceUrl.hostname) continue;
    if (hasIgnoredPath(resolved.pathname)) continue;

    const normalizedPath = resolved.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath === sourcePath) continue;

    const title = stripTags(textRaw) || titleFromUrl(resolved);
    const score = scoreRecipeCandidate(resolved, title);
    if (score < 3) continue;

    resolved.hash = "";
    resolved.searchParams.forEach((_, key) => {
      if (key.toLowerCase().startsWith("utm_")) resolved.searchParams.delete(key);
    });

    candidates.push({
      url: resolved.toString(),
      title,
      score,
    });
  }

  return candidates;
}

function dedupeAndSort(candidates: Candidate[], limit: number): Candidate[] {
  const byUrl = new Map<string, Candidate>();

  for (const candidate of candidates) {
    const existing = byUrl.get(candidate.url);
    if (!existing || candidate.score > existing.score) {
      byUrl.set(candidate.url, candidate);
    }
  }

  return Array.from(byUrl.values())
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
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
    const sourceUrlRaw = typeof body?.url === "string" ? body.url : "";
    const limitRaw = typeof body?.limit === "number" ? body.limit : 40;
    const limit = Math.max(1, Math.min(120, Math.floor(limitRaw)));

    const sourceUrl = normalizeUrl(sourceUrlRaw);
    if (!sourceUrl) {
      return json({ success: false, error: "Enter a valid recipe page URL." });
    }

    const response = await fetch(sourceUrl.toString(), {
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
        error: `Could not open that page (${response.status}).`,
      });
    }

    const html = await response.text();
    const candidates = dedupeAndSort(extractAnchorCandidates(sourceUrl, html), limit);

    if (!candidates.length) {
      return json({
        success: false,
        error: "No recipe links found on that page. Try another page or paste links manually.",
      });
    }

    return json({
      success: true,
      pageUrl: sourceUrl.toString(),
      pageTitle: extractTitle(html),
      links: candidates.map((candidate) => ({
        url: candidate.url,
        title: candidate.title,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ success: false, error: message });
  }
});
