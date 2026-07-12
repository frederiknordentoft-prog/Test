import os
import subprocess
import sys

from simcore.engine.simulation import Simulation
from tests.conftest import small_config


def test_same_seed_reproduces_state():
    a = Simulation(small_config(seed=7, ticks=25))
    a.run(25)
    b = Simulation(small_config(seed=7, ticks=25))
    b.run(25)
    assert a.state_hash() == b.state_hash()
    assert a.metrics_history[-1] == b.metrics_history[-1]


def test_different_seed_differs():
    a = Simulation(small_config(seed=7, ticks=15))
    a.run(15)
    b = Simulation(small_config(seed=8, ticks=15))
    b.run(15)
    assert a.state_hash() != b.state_hash()


SNIPPET = (
    "from tests.conftest import small_config;"
    "from simcore.engine.simulation import Simulation;"
    "s=Simulation(small_config(seed=3, ticks=10));s.run(10);print(s.state_hash())"
)


def test_hash_independent_of_pythonhashseed():
    """Guards against dict/set iteration order leaking into the dynamics."""
    outs = []
    for hs in ("0", "424242"):
        env = dict(os.environ, PYTHONHASHSEED=hs)
        r = subprocess.run(
            [sys.executable, "-c", SNIPPET],
            capture_output=True, text=True, env=env,
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        )
        assert r.returncode == 0, r.stderr
        outs.append(r.stdout.strip())
    assert outs[0] == outs[1]
