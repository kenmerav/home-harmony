export interface TrafficEstimate {
  durationMinutes: number;
  trafficDurationMinutes: number;
}

function toRoundedMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

export async function fetchGoogleDriveTrafficEstimate(input: {
  origin: string;
  destination: string;
  departureEpochSeconds?: number | null;
}): Promise<TrafficEstimate> {
  const apiKey = String(Deno.env.get("GOOGLE_MAPS_API_KEY") || "").trim();
  if (!apiKey) {
    throw new Error("Google Maps key is not configured.");
  }

  const departure = Number.isFinite(input.departureEpochSeconds)
    ? Math.max(Math.floor(Number(input.departureEpochSeconds)), Math.floor(Date.now() / 1000))
    : Math.floor(Date.now() / 1000);

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", input.origin);
  url.searchParams.set("destination", input.destination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("departure_time", String(departure));
  url.searchParams.set("traffic_model", "best_guess");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Directions request failed (${response.status}): ${text || "unknown error"}`);
  }

  const payload = await response.json().catch(() => ({})) as {
    status?: string;
    error_message?: string;
    routes?: Array<{
      legs?: Array<{
        duration?: { value?: number };
        duration_in_traffic?: { value?: number };
      }>;
    }>;
  };

  if (payload.status && payload.status !== "OK") {
    throw new Error(payload.error_message || `Directions error: ${payload.status}`);
  }

  const leg = payload.routes?.[0]?.legs?.[0];
  const baseSeconds = Number(leg?.duration?.value || 0);
  const trafficSeconds = Number(leg?.duration_in_traffic?.value || 0);

  if (!Number.isFinite(baseSeconds) || baseSeconds <= 0) {
    throw new Error("Could not estimate drive time for this route.");
  }

  const durationMinutes = toRoundedMinutes(baseSeconds);
  const trafficDurationMinutes = toRoundedMinutes(
    Number.isFinite(trafficSeconds) && trafficSeconds > 0 ? trafficSeconds : baseSeconds,
  );

  return {
    durationMinutes,
    trafficDurationMinutes,
  };
}
