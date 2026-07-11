export interface Frame {
  run_id: string;
  tick: number;
  ticks_target: number;
  status: string;
  prices: Record<string, number>;
  fundamentals: Record<string, number>;
  volatility: Record<string, number>;
  spread: Record<string, number>;
  volume: Record<string, number>;
  metrics: Record<string, number>;
  new_events: EventMarker[];
}

export interface EventMarker {
  tick: number;
  name: string;
  type: string;
  phase: string;
  magnitude: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
}

export interface ScenarioInfo {
  id: string;
  events: {
    name: string;
    type: string;
    start_tick: number | null;
    duration: number;
    magnitude: number;
    description: string;
  }[];
}

export interface TypeSummary {
  count: number;
  alive: number;
  bankrupt: number;
  total_wealth: number;
  mean_wealth: number;
  mean_sentiment: number;
  mean_stress: number;
  mean_leverage: number;
}

export interface ActorsResponse {
  types: Record<string, TypeSummary>;
  top: ActorSummary[];
  sample: ActorSummary[];
  wealth_histogram: { counts: number[]; log10_edges: number[] };
}

export interface ActorSummary {
  id: number;
  type: string;
  name: string;
  wealth: number;
  cash: number;
  leverage: number;
  sentiment: number;
  stress: number;
  alive: boolean;
  strategy: string;
}

export interface DecisionLogEntry {
  tick: number;
  actor_id: number;
  actor_type: string;
  model: string;
  action: string;
  asset_id: string | null;
  qty: number;
  explanation: {
    model: string;
    main_drivers: { driver: string; contribution: number }[];
    decision_probability: number;
    stress_level: number;
    score: number;
  } | null;
}

export interface CustomEvent {
  name: string;
  event_type: string;
  start_tick: number;
  duration: number;
  magnitude: number;
}
