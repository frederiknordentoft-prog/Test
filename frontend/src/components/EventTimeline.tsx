import { useSimStore } from "../store/simStore";

export function EventTimeline({ onSelect }: { onSelect?: (eventIndex: number) => void }) {
  const events = useSimStore((s) => s.events);
  return (
    <div className="card">
      <h3>Event timeline {onSelect && <span className="muted">(click an event for reaction analysis)</span>}</h3>
      {events.length === 0 && <div className="muted">No events yet.</div>}
      <div style={{ maxHeight: 300, overflowY: "auto" }}>
        {[...events].reverse().map((e, i) => {
          const originalIndex = events.length - 1 - i;
          return (
            <div
              key={originalIndex}
              className="event-item"
              style={onSelect ? { cursor: "pointer" } : undefined}
              onClick={() => onSelect?.(originalIndex)}
            >
              <span className="event-tick">t={e.tick}</span>
              <span className="event-name">
                {e.name} <span className="muted">({e.type}, ×{e.magnitude})</span>
              </span>
              <span className={`event-phase badge ${e.phase === "start" ? "error" : ""}`}>{e.phase}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
