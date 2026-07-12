"""Headless CLI runner: config in, exports out. No frontend required.

Examples:
    python scripts/run_headless.py --preset credit_crunch --seed 7
    python scripts/run_headless.py --config ../configs/my_experiment.yaml --out ../data/exports
    python scripts/run_headless.py --preset stable_market --montecarlo 20
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from simcore.analytics.montecarlo import run_monte_carlo  # noqa: E402
from simcore.config.loader import load_config, load_preset  # noqa: E402
from simcore.engine.simulation import Simulation  # noqa: E402
from simcore.models.config import SimConfig  # noqa: E402
from simcore.persistence.export import export_run  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", type=str, help="path to a YAML/JSON config")
    ap.add_argument("--preset", type=str, help="preset id (see simcore/config/presets)")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--ticks", type=int, default=None)
    ap.add_argument("--out", type=str, default="../data/exports")
    ap.add_argument("--fmt", type=str, default="csv", choices=["csv", "json"])
    ap.add_argument("--db", type=str, default="../data/simulator.db")
    ap.add_argument("--montecarlo", type=int, default=0,
                    help="run N seeds headless and print distribution stats instead")
    args = ap.parse_args()

    if args.config:
        cfg = load_config(args.config)
    elif args.preset:
        cfg = load_preset(args.preset)
    else:
        cfg = SimConfig()
    if args.seed is not None:
        cfg.seed = args.seed
    if args.ticks is not None:
        cfg.ticks = args.ticks

    if args.montecarlo > 0:
        result = run_monte_carlo(
            cfg, seeds=[cfg.seed + i for i in range(args.montecarlo)],
            on_progress=lambda d, t: print(f"  run {d}/{t}", flush=True),
        )
        print(json.dumps(result["percentiles"], indent=2))
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        path = out / f"montecarlo_{cfg.name.replace(' ', '_')}.json"
        path.write_text(json.dumps(result, indent=2))
        print(f"full result -> {path}")
        return

    sim = Simulation(cfg, db_path=args.db)
    print(f"running '{cfg.name}' seed={cfg.seed} ticks={cfg.ticks} actors={cfg.n_actors}")
    sim.run(on_tick=lambda t, m: print(
        f"  tick {t:4d} | idx {m['price_index']:7.2f} | systemic {m['systemic_risk']:4.1f}",
        flush=True) if t % 100 == 0 else None)
    sim.recorder.flush()
    files = export_run(sim.recorder.conn, sim.run_id, args.out, fmt=args.fmt)
    print(f"run {sim.run_id} finished at tick {sim.tick}; exported:")
    for f in files:
        print(f"  {f}")


if __name__ == "__main__":
    main()
