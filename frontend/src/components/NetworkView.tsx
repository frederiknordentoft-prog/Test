import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { api } from "../api/client";
import type { NetworkResponse } from "../api/types";
import { useSimStore } from "../store/simStore";

const LAYERS = ["social", "information", "customer", "supplier", "credit"];

// type colors: validated categorical palette (dark mode), fixed assignment order
const TYPE_COLORS: Record<string, string> = {
  retail: "#3987e5",
  institutional: "#199e70",
  hedge_fund: "#c98500",
  bank: "#008300",
  firm: "#9085e9",
  supplier: "#e66767",
  customer: "#d55181",
  media: "#d95926",
  regulator: "#c3c2b7",
};

function sentimentColor(s: number): string {
  // diverging: red (-1) -> gray (0) -> aqua (+1)
  if (s < 0) return `rgb(${180 + 50 * -s}, ${120 * (1 + s)}, ${120 * (1 + s)})`;
  return `rgb(${120 * (1 - s)}, ${140 + 60 * s}, ${120 * (1 - s) + 60 * s})`;
}

export function NetworkView() {
  const { runId, tick } = useSimStore();
  const [layer, setLayer] = useState("social");
  const [colorBy, setColorBy] = useState<"type" | "sentiment">("type");
  const [onlySystemic, setOnlySystemic] = useState(false);
  const [data, setData] = useState<NetworkResponse | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    if (!runId) return;
    api.network(runId, layer).then(setData).catch(() => setData(null));
  }, [runId, layer, Math.floor(tick / 25)]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setWidth(el.clientWidth - 4));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    const nodes = data.nodes
      .filter((n) => !onlySystemic || n.systemic)
      .map((n) => ({ ...n }));
    const keep = new Set(nodes.map((n) => n.id));
    const links = data.edges
      .filter((e) => keep.has(e.source) && keep.has(e.target))
      .map((e) => ({ ...e }));
    return { nodes, links };
  }, [data, onlySystemic]);

  return (
    <div className="card" ref={containerRef}>
      <div className="controls" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Network — {layer}</h3>
        <select style={{ width: 140 }} value={layer} onChange={(e) => setLayer(e.target.value)}>
          {LAYERS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select style={{ width: 160 }} value={colorBy} onChange={(e) => setColorBy(e.target.value as "type" | "sentiment")}>
          <option value="type">color by actor type</option>
          <option value="sentiment">color by sentiment</option>
        </select>
        <label style={{ margin: 0, display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={onlySystemic}
            onChange={(e) => setOnlySystemic(e.target.checked)}
          />
          systemically important only (top-10% centrality)
        </label>
      </div>
      {colorBy === "type" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          {Object.entries(TYPE_COLORS).map(([t, c]) => (
            <span key={t} className="muted" style={{ fontSize: 11 }}>
              <span style={{ color: c }}>●</span> {t}
            </span>
          ))}
        </div>
      )}
      <div style={{ height: 560 }}>
        <ForceGraph2D
          graphData={graphData}
          width={width}
          height={560}
          backgroundColor="#1a1a19"
          nodeLabel={(n: any) =>
            `${n.type}_${n.id} · wealth ${Math.round(n.wealth).toLocaleString()} · ` +
            `sentiment ${n.sentiment} · centrality ${n.centrality}` +
            (n.systemic ? " · SYSTEMIC" : "") + (n.alive ? "" : " · bankrupt")
          }
          nodeVal={(n: any) => 1 + 40 * n.market_power + Math.log10(Math.max(n.wealth, 1)) / 2}
          nodeColor={(n: any) => {
            if (!n.alive) return "#4a4a47";
            return colorBy === "type" ? TYPE_COLORS[n.type] ?? "#8a897f" : sentimentColor(n.sentiment);
          }}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, scale: number) => {
            if (n.systemic && scale > 0.6) {
              ctx.beginPath();
              ctx.arc(n.x, n.y, 6 + 40 * n.market_power, 0, 2 * Math.PI);
              ctx.strokeStyle = "#ffffff88";
              ctx.lineWidth = 1.2 / scale;
              ctx.stroke();
            }
          }}
          linkColor={() => "#3a3a37"}
          linkWidth={(l: any) => 0.4 + 1.6 * l.strength}
          cooldownTicks={80}
        />
      </div>
      <div className="muted" style={{ marginTop: 6 }}>
        Node size = market power &amp; wealth · white ring = systemically important (degree
        centrality) · gray = bankrupt. Graph refreshes every 25 ticks.
      </div>
    </div>
  );
}
