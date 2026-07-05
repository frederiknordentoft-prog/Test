// Sting/pivot rigid-body dynamics: I·θ'' = T_aero − k·(θ−θ_rest) − c·θ'.
// All quantities in lattice units (torque from momentum exchange, per-step time).
// Weight matters through inertia: a heavy body filters the oscillating vortex torque
// (and can't resonate), a light one gets thrown around — F=ma made visible.

const K_SPRING = 2.0; // lattice torque per radian
const ZETA = 0.08; // light damping so flutter is possible
const MAX_DEFLECT = 0.9; // rad from rest
const BEND_SCALE = 0.012; // tunnel units per lattice force unit
const BEND_MAX = 0.03;

export class PivotDynamics {
  theta = 0; // absolute angle, rad
  omega = 0;
  bend: [number, number] = [0, 0];
  private inertia = 1e5;
  private damping = 2 * ZETA * Math.sqrt(K_SPRING * 1e5);

  /** polarMomentLat: second polar moment about pivot in lattice units⁴ (per unit density). */
  setMassProperties(polarMomentLat: number, density: number): void {
    this.inertia = Math.max(1e3, polarMomentLat * density);
    this.damping = 2 * ZETA * Math.sqrt(K_SPRING * this.inertia);
  }

  snapTo(restAngle: number): void {
    this.theta = restAngle;
    this.omega = 0;
    this.bend = [0, 0];
  }

  step(torque: number, fx: number, fy: number, restAngle: number, locked: boolean, dtSteps: number): void {
    if (locked) {
      this.theta = restAngle;
      this.omega = 0;
      this.bend = [0, 0];
      return;
    }
    const alpha = (torque - K_SPRING * (this.theta - restAngle) - this.damping * this.omega) / this.inertia;
    this.omega += alpha * dtSteps;
    this.theta += this.omega * dtSteps;
    const lo = restAngle - MAX_DEFLECT;
    const hi = restAngle + MAX_DEFLECT;
    if (this.theta < lo) { this.theta = lo; this.omega = Math.max(0, this.omega); }
    if (this.theta > hi) { this.theta = hi; this.omega = Math.min(0, this.omega); }
    // Sting bend: quasi-static spring, low-pass filtered for calm visuals.
    const bx = Math.max(-BEND_MAX, Math.min(BEND_MAX, fx * BEND_SCALE));
    const by = Math.max(-BEND_MAX, Math.min(BEND_MAX, fy * BEND_SCALE));
    this.bend[0] += (bx - this.bend[0]) * 0.05;
    this.bend[1] += (by - this.bend[1]) * 0.05;
  }
}
