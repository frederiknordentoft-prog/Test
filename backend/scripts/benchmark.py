"""Performance benchmark: 300 actors x 5 assets x N ticks.

Usage:  python scripts/benchmark.py [--actors 300] [--ticks 1000] [--seed 42]
"""
from __future__ import annotations

import argparse
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from simcore.engine.simulation import Simulation  # noqa: E402
from simcore.models.config import SimConfig, default_actor_mix  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--actors", type=int, default=300)
    ap.add_argument("--ticks", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    cfg = SimConfig(seed=args.seed, ticks=args.ticks, actors=default_actor_mix(args.actors))
    t0 = time.perf_counter()
    sim = Simulation(cfg)
    init_s = time.perf_counter() - t0
    print(f"init:  {init_s:6.2f}s  ({len(sim.actors)} actors, {len(sim.market.assets)} assets)")

    tick_times: list[float] = []
    t_start = time.perf_counter()
    for _ in range(args.ticks):
        t1 = time.perf_counter()
        sim.step()
        tick_times.append(time.perf_counter() - t1)
    total = time.perf_counter() - t_start

    ms = [t * 1000 for t in tick_times]
    print(f"run:   {total:6.2f}s for {args.ticks} ticks  ->  {args.ticks / total:6.1f} ticks/s")
    print(f"tick:  mean {statistics.mean(ms):6.2f} ms | median {statistics.median(ms):6.2f} ms "
          f"| p95 {sorted(ms)[int(len(ms) * 0.95)]:6.2f} ms | max {max(ms):6.2f} ms")
    m = sim.metrics_history[-1]
    print(f"state: price_index {m['price_index']:.1f} | bankruptcies {m['bankruptcies_total']:.0f} "
          f"| systemic {m['systemic_risk']:.0f}")
    target = 60.0 * args.ticks / 1000 * args.actors / 300
    verdict = "PASS" if total <= target * 1.5 else "SLOW"
    print(f"budget check ({target * 1.5:.0f}s allowance): {verdict}")


if __name__ == "__main__":
    main()
