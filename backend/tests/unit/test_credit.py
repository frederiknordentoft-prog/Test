import numpy as np

from simcore.markets.asset import MarketState
from simcore.markets.credit import CreditSystem
from simcore.models.config import AssetConfig, MarketConfig, SimConfig
from tests.unit.test_clearing import make_actor


def setup(n_banks=2):
    cfg = SimConfig()
    banks = [make_actor(i, cash=1_000_000) for i in range(n_banks)]
    borrower = make_actor(n_banks, cash=100.0)
    actors = banks + [borrower]
    credit = CreditSystem(cfg, [b.id for b in banks])
    credit.bind_actors(actors)
    market = MarketState.create([AssetConfig(asset_id="X")], MarketConfig(), 64)
    return cfg, credit, actors, borrower, market


def test_tighter_credit_grants_less():
    _, credit, actors, borrower, market = setup()
    credit.tightness = 0.1
    loose = credit.request_loan(borrower, 10_000, {"X": 100.0})
    borrower2 = make_actor(99, cash=100.0)
    actors.append(borrower2)
    credit.tightness = 0.8
    tight = credit.request_loan(borrower2, 10_000, {"X": 100.0})
    assert loose > tight


def test_default_distributes_losses_to_banks_and_marks_default():
    _, credit, actors, borrower, market = setup()
    credit.request_loan(borrower, 10_000, {"X": 100.0})
    borrower.state.cash = -1.0  # deeply insolvent
    bank_cash_before = sum(a.state.cash for a in actors[:2])
    defaulted = credit.service_loans(actors, {"X": 100.0})
    assert borrower.id in defaulted
    assert credit.defaults_total == 1
    assert sum(a.state.cash for a in actors[:2]) < bank_cash_before


def test_regulatory_intent_moves_margin_and_tightness():
    from simcore.models.actions import Action, ActionIntent, Domain

    _, credit, actors, _, market = setup()
    base_margin = market.maintenance_margin
    intent = ActionIntent(0, Action.SET_CREDIT_CONDITIONS, Domain.CREDIT, None, 0.2,
                          meta={"regulatory": True, "margin_delta": 0.05})
    credit.apply_condition_intents([intent], actors, market)
    assert market.maintenance_margin == base_margin + 0.05
    assert credit.tightness > 0.15


def test_bank_features_reported():
    _, credit, actors, borrower, _ = setup()
    credit.request_loan(borrower, 5_000, {"X": 100.0})
    feats = credit.bank_features(0, actors)
    assert 0 <= feats["capital_ratio"] <= 1
    assert feats["loan_loss_rate"] == 0.0
