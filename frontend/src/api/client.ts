const BASE = "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`${r.status}: ${body.slice(0, 300)}`);
  }
  return r.json();
}

export const api = {
  presets: () => req<import("./types").Preset[]>("/api/presets"),
  scenarios: () => req<import("./types").ScenarioInfo[]>("/api/scenarios"),
  eventTypes: () => req<string[]>("/api/event-types"),
  createRun: (body: unknown) =>
    req<{ run_id: string }>("/api/runs", { method: "POST", body: JSON.stringify(body) }),
  control: (runId: string, action: "start" | "pause" | "resume" | "stop") =>
    req(`/api/runs/${runId}/${action}`, { method: "POST" }),
  step: (runId: string, n: number) =>
    req(`/api/runs/${runId}/step`, { method: "POST", body: JSON.stringify({ n }) }),
  speed: (runId: string, tps: number) =>
    req(`/api/runs/${runId}/speed`, { method: "POST", body: JSON.stringify({ tps }) }),
  reset: (runId: string) =>
    req<{ run_id: string }>(`/api/runs/${runId}/reset`, { method: "POST" }),
  actors: (runId: string) => req<import("./types").ActorsResponse>(`/api/runs/${runId}/actors`),
  decisions: (runId: string, limit = 30) =>
    req<import("./types").DecisionLogEntry[]>(`/api/runs/${runId}/decisions?limit=${limit}`),
  events: (runId: string) => req<import("./types").EventMarker[]>(`/api/runs/${runId}/events`),
  exportRun: (runId: string, fmt: string) =>
    req<{ files: string[]; directory: string }>(`/api/runs/${runId}/export?fmt=${fmt}`),
  runs: () => req<import("./types").RunListEntry[]>("/api/runs"),
  metrics: (runId: string, names: string[]) =>
    req<{ ticks: number[]; series: Record<string, number[]> }>(
      `/api/runs/${runId}/metrics?names=${names.join(",")}`,
    ),
  network: (runId: string, layer: string) =>
    req<import("./types").NetworkResponse>(`/api/runs/${runId}/network?layer=${layer}`),
  reactions: (runId: string, eventIndex: number, window = 15) =>
    req<import("./types").ReactionsResponse>(
      `/api/runs/${runId}/events/${eventIndex}/reactions?window=${window}`,
    ),
  createMonteCarlo: (body: unknown) =>
    req<{ mc_id: string }>("/api/montecarlo", { method: "POST", body: JSON.stringify(body) }),
  getMonteCarlo: (mcId: string) => req<import("./types").MonteCarloStatus>(`/api/montecarlo/${mcId}`),
  trends: () =>
    req<{ id: string; name: string; desc: string; kind: string; realism: string;
          default: number }[]>("/api/trends"),
  forecastValidation: () => req<import("./types").ForecastValidation>("/api/forecast-validation"),
  competitorIntelligence: () =>
    req<import("./types").CompetitorIntelligence>("/api/competitor-intelligence"),
  createInvestment: (body: unknown) =>
    req<{ inv_id: string; total: number }>("/api/investment",
      { method: "POST", body: JSON.stringify(body) }),
  getInvestment: (invId: string) =>
    req<import("./types").InvestmentStatus>(`/api/investment/${invId}`),
  savedConfigs: () => req<import("./types").SavedConfig[]>("/api/configs"),
  saveConfig: (body: unknown) =>
    req<{ id: string; name: string }>("/api/configs", { method: "POST", body: JSON.stringify(body) }),
};
