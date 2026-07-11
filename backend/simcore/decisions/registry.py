"""Model registry: mixture keys in type profiles resolve here. Models are
shared singletons — all per-actor learning state lives on the actor itself."""
from __future__ import annotations

from functools import cache

from simcore.decisions.adaptive import AdaptiveModel
from simcore.decisions.base import DecisionModel
from simcore.decisions.economic import (
    BankModel,
    CustomerModel,
    FirmModel,
    MediaModel,
    RegulatorModel,
    SupplierModel,
)
from simcore.decisions.heuristics import (
    ImitationModel,
    MeanReversionModel,
    MomentumModel,
    ValueModel,
)
from simcore.decisions.rule_based import RuleBasedModel
from simcore.decisions.utility import UtilityModel


@cache
def _registry() -> dict[str, DecisionModel]:
    models: list[DecisionModel] = [
        RuleBasedModel(),
        MomentumModel(),
        MeanReversionModel(),
        ValueModel(),
        ImitationModel(),
        UtilityModel(),
        AdaptiveModel(),
        FirmModel(),
        SupplierModel(),
        CustomerModel(),
        BankModel(),
        RegulatorModel(),
        MediaModel(),
    ]
    return {m.name: m for m in models}


def get_model(name: str) -> DecisionModel:
    reg = _registry()
    if name not in reg:
        raise KeyError(f"unknown decision model '{name}' (available: {sorted(reg)})")
    return reg[name]
