import type { DecisionLogEntry } from "../api/types";

export function DecisionLog({ decisions }: { decisions: DecisionLogEntry[] }) {
  return (
    <div className="card">
      <h3>Decision log (why actors acted)</h3>
      {decisions.length === 0 && <div className="muted">No decisions logged yet.</div>}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Tick</th>
              <th>Actor</th>
              <th>Model</th>
              <th>Action</th>
              <th>Qty</th>
              <th>p</th>
              <th>Main drivers</th>
            </tr>
          </thead>
          <tbody>
            {[...decisions].reverse().map((d, i) => (
              <tr key={i}>
                <td>{d.tick}</td>
                <td>
                  {d.actor_type}_{d.actor_id}
                </td>
                <td>{d.model}</td>
                <td>
                  {d.action}
                  {d.asset_id ? ` ${d.asset_id}` : ""}
                </td>
                <td>{d.qty ? d.qty.toFixed(1) : ""}</td>
                <td>{d.explanation ? d.explanation.decision_probability.toFixed(2) : ""}</td>
                <td>
                  {d.explanation?.main_drivers.map((dr) => (
                    <span
                      key={dr.driver}
                      className={`driver-chip ${dr.contribution < 0 ? "neg" : "pos"}`}
                      title={`contribution ${dr.contribution}`}
                    >
                      {dr.driver} {dr.contribution >= 0 ? "+" : ""}
                      {dr.contribution.toFixed(2)}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
