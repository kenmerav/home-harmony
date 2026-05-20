import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";

type QuotePayload = {
  symbol?: string;
};

type ParsedQuote = { price: number; asOf: string; source: string };

function parseStooqCsv(csv: string): { price: number; asOf: string } | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 1) return null;
  const firstRow = lines[0].split(",").map((item) => item.trim());
  const hasHeader = firstRow.some((item) => item.toLowerCase() === "close");
  const headers = hasHeader ? firstRow.map((item) => item.toLowerCase()) : [];
  const values = hasHeader && lines[1]
    ? lines[1].split(",").map((item) => item.trim())
    : firstRow;
  const closeIndex = hasHeader ? headers.indexOf("close") : 6;
  const dateIndex = hasHeader ? headers.indexOf("date") : 1;
  const timeIndex = hasHeader ? headers.indexOf("time") : 2;
  const price = Number.parseFloat(values[closeIndex]);
  if (!Number.isFinite(price) || price <= 0) return null;
  const date = dateIndex >= 0 ? values[dateIndex] : "";
  const time = timeIndex >= 0 ? values[timeIndex] : "";
  return {
    price,
    asOf: date ? `${date}${time ? `T${time}` : ""}` : new Date().toISOString(),
  };
}

function parseYahooChart(input: unknown): { price: number; asOf: string } | null {
  const chart = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>).chart
    : null;
  const chartRecord = chart && typeof chart === "object" && !Array.isArray(chart)
    ? chart as Record<string, unknown>
    : null;
  const result = Array.isArray(chartRecord?.result) ? chartRecord.result[0] : null;
  const resultRecord = result && typeof result === "object" && !Array.isArray(result)
    ? result as Record<string, unknown>
    : null;
  const meta = resultRecord?.meta && typeof resultRecord.meta === "object" && !Array.isArray(resultRecord.meta)
    ? resultRecord.meta as Record<string, unknown>
    : null;
  const price = Number(meta?.regularMarketPrice);
  const marketTime = Number(meta?.regularMarketTime);
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    price,
    asOf: Number.isFinite(marketTime) ? new Date(marketTime * 1000).toISOString() : new Date().toISOString(),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStooqQuote(): Promise<ParsedQuote | null> {
  const response = await fetchWithTimeout("https://stooq.com/q/l/?s=voo.us&i=d", {
    headers: { "User-Agent": "HomeHarmonyHQ/1.0" },
  });
  if (!response.ok) return null;
  const parsed = parseStooqCsv(await response.text());
  return parsed ? { ...parsed, source: "stooq" } : null;
}

async function fetchYahooQuote(): Promise<ParsedQuote | null> {
  const response = await fetchWithTimeout("https://query1.finance.yahoo.com/v8/finance/chart/VOO?range=1d&interval=1d", {
    headers: { "User-Agent": "HomeHarmonyHQ/1.0" },
  });
  if (!response.ok) return null;
  const parsed = parseYahooChart(await response.json().catch(() => null));
  return parsed ? { ...parsed, source: "yahoo" } : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({})) as QuotePayload;
    const symbol = String(payload.symbol || "VOO").trim().toUpperCase();
    if (symbol !== "VOO") return json({ error: "Only VOO is supported right now." }, 400);

    const parsed = await fetchStooqQuote().catch(() => null)
      || await fetchYahooQuote().catch(() => null);
    if (!parsed) return json({ error: "Could not load VOO quote from market data providers." }, 502);

    return json({
      symbol: "VOO",
      price: parsed.price,
      asOf: parsed.asOf,
      source: parsed.source,
    });
  } catch (error) {
    console.error("market-quote error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
