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
};
