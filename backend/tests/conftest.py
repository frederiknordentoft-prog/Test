import pytest

from simcore.models.config import ActorTypeConfig, AssetConfig, SimConfig


def small_config(seed: int = 42, ticks: int = 40, **overrides) -> SimConfig:
    """~100 actors, 2 assets — fast enough for unit tests."""
    cfg = SimConfig(
        name="test",
        seed=seed,
        ticks=ticks,
        actors={
            "retail": ActorTypeConfig(count=40),
            "institutional": ActorTypeConfig(count=8),
            "hedge_fund": ActorTypeConfig(count=6),
            "bank": ActorTypeConfig(count=2),
            "firm": ActorTypeConfig(count=10),
            "supplier": ActorTypeConfig(count=8),
            "customer": ActorTypeConfig(count=20),
            "media": ActorTypeConfig(count=2),
            "regulator": ActorTypeConfig(count=1),
        },
        assets=[
            AssetConfig(asset_id="A1", initial_price=100.0),
            AssetConfig(asset_id="A2", initial_price=50.0),
        ],
        **overrides,
    )
    return cfg


@pytest.fixture
def config() -> SimConfig:
    return small_config()
