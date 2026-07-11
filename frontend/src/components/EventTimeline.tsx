import { useSimStore } from "../store/simStore";

export function EventTimeline() {
  const events = useSimStore((s) => s.events);
  return (
    <div className="card">
      <h3>Event timeline</h3>
      {events.length === 0 && <div className="muted">No events yet.</div>}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {[...events].reverse().map((e, i) => (
          <div key={i} className="event-item">
            <span className="event-tick">t={e.tick}</span>
            <span className="event-name">
              {e.name} <span className="muted">({e.type}, ×{e.magnitude})</span>
            </span>
            <span className={`event-phase badge ${e.phase === "start" ? "error" : ""}`}>{e.phase}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
