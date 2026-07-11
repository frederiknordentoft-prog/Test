"""Multi-layer relationship network.

Layers built in the MVP:
- ``social``       all actors; media actors are wired as extra hubs
- ``information``  investors, firms, banks, media, regulators (small-world by default)
- ``customer``     customer -> firm relations (who buys where)
- ``supplier``     firm -> supplier relations (who sources where)
- ``credit``       borrower (firm / hedge fund) -> bank relations

The social layer keeps a cached sparse CSR adjacency for vectorized signal /
sentiment propagation; it is rebuilt only when topology changes (bankruptcy,
switching).
"""
from __future__ import annotations

import networkx as nx
import numpy as np
from scipy import sparse

from simcore.agents.actor import Actor
from simcore.models.actor_state import ActorType
from simcore.models.config import NetworkLayerConfig, SimConfig
from simcore.networks.generators import build_network


def actors_by_id(actors: list[Actor], actor_id: int) -> Actor:
    return actors[actor_id]


class MultiLayerNetwork:
    def __init__(self, n_actors: int):
        self.n = n_actors
        self.layers: dict[str, nx.Graph] = {}
        self._csr_cache: dict[str, sparse.csr_matrix] = {}

    # ------------------------------------------------------------------ #
    @classmethod
    def build(cls, config: SimConfig, actors: list[Actor], rng: np.random.Generator) -> "MultiLayerNetwork":
        net = cls(len(actors))
        by_type: dict[ActorType, list[int]] = {}
        for a in actors:
            by_type.setdefault(a.actor_type, []).append(a.id)

        all_ids = [a.id for a in actors]
        investors = (
            by_type.get(ActorType.RETAIL, [])
            + by_type.get(ActorType.INSTITUTIONAL, [])
            + by_type.get(ActorType.HEDGE_FUND, [])
        )
        firms = by_type.get(ActorType.FIRM, [])
        suppliers = by_type.get(ActorType.SUPPLIER, [])
        customers = by_type.get(ActorType.CUSTOMER, [])
        banks = by_type.get(ActorType.BANK, [])
        media = by_type.get(ActorType.MEDIA, [])
        regulators = by_type.get(ActorType.REGULATOR, [])

        # configurable layers
        social_cfg = config.networks.get("social", NetworkLayerConfig(kind="scale_free", params={"m": 3}))
        info_cfg = config.networks.get(
            "information", NetworkLayerConfig(kind="small_world", params={"k": 6, "p": 0.1})
        )
        net.layers["social"] = build_network(social_cfg.kind, all_ids, rng, **social_cfg.params)
        info_nodes = investors + firms + banks + media + regulators
        net.layers["information"] = build_network(info_cfg.kind, info_nodes, rng, **info_cfg.params)

        # media actors become hubs in the social layer
        social = net.layers["social"]
        for m in media:
            reach = 0.5
            for a in actors:
                if a.id == m:
                    reach = float(a.state.internal_state.get("reach", 0.5))
                    break
            k = int(reach * 0.4 * len(all_ids))
            targets = rng.choice(all_ids, size=min(k, len(all_ids)), replace=False)
            for t in targets:
                if t != m and not social.has_edge(m, t):
                    social.add_edge(m, t, strength=float(rng.uniform(0.4, 0.9)), trust=float(rng.uniform(0.3, 0.8)),
                                    exposure=0.0, dependency=0.0)

        # bipartite economic layers; customers attach to firms weighted by firm
        # capacity so big (listed) firms serve proportionally more customers
        firm_capacity = np.array(
            [actors_by_id(actors, f).econ.capacity if actors_by_id(actors, f).econ else 1.0 for f in firms]
        ) if firms else np.array([])
        net.layers["customer"] = cls._bipartite(customers, firms, rng, k_min=1, k_max=3,
                                                right_weights=firm_capacity)
        # big firms need more supplier links: k scales with firm capacity
        supplier_capacity = np.array(
            [actors_by_id(actors, s).econ.capacity if actors_by_id(actors, s).econ else 1.0 for s in suppliers]
        ) if suppliers else np.array([])
        mean_cap = float(firm_capacity.mean()) if firm_capacity.size else 1.0
        left_k = {
            f: int(np.clip(1 + round(2.0 * c / max(mean_cap, 1e-9)), 1, min(8, len(suppliers) or 1)))
            for f, c in zip(firms, firm_capacity)
        }
        net.layers["supplier"] = cls._bipartite(firms, suppliers, rng, k_min=1, k_max=3,
                                                right_weights=supplier_capacity, left_k=left_k)
        net.layers["credit"] = cls._bipartite(
            firms + by_type.get(ActorType.HEDGE_FUND, []), banks, rng, k_min=1, k_max=2
        )
        return net

    @staticmethod
    def _bipartite(
        left: list[int], right: list[int], rng: np.random.Generator, k_min: int, k_max: int,
        right_weights: np.ndarray | None = None,
        left_k: dict[int, int] | None = None,
    ) -> nx.Graph:
        g = nx.Graph()
        g.add_nodes_from(left)
        g.add_nodes_from(right)
        if not left or not right:
            return g
        probs = None
        if right_weights is not None and right_weights.size == len(right) and right_weights.sum() > 0:
            probs = right_weights / right_weights.sum()
        for u in left:
            if left_k is not None:
                k = min(left_k.get(u, k_min), len(right))
            else:
                k = int(rng.integers(k_min, min(k_max, len(right)) + 1))
            targets = rng.choice(right, size=k, replace=False, p=probs)
            weights = rng.dirichlet(np.ones(k))
            for v, w in zip(targets, weights):
                g.add_edge(u, v, strength=float(w), trust=float(rng.uniform(0.4, 0.9)),
                           exposure=float(w), dependency=float(w))
        return g

    # ------------------------------------------------------------------ #
    def adjacency(self, layer: str) -> sparse.csr_matrix:
        if layer not in self._csr_cache:
            g = self.layers[layer]
            m = sparse.lil_matrix((self.n, self.n))
            for u, v, data in g.edges(data=True):
                w = data.get("strength", 0.5)
                m[u, v] = w
                m[v, u] = w
            self._csr_cache[layer] = m.tocsr()
        return self._csr_cache[layer]

    def invalidate(self, layer: str) -> None:
        self._csr_cache.pop(layer, None)

    def neighbors(self, layer: str, actor_id: int) -> list[int]:
        g = self.layers.get(layer)
        if g is None or actor_id not in g:
            return []
        return list(g.neighbors(actor_id))

    def remove_actor(self, actor_id: int) -> None:
        for name, g in self.layers.items():
            if actor_id in g:
                g.remove_node(actor_id)
                g.add_node(actor_id)  # keep the node, drop the edges
                self.invalidate(name)

    def rewire_customer(self, customer_id: int, old_firm: int | None, new_firm: int, rng: np.random.Generator) -> None:
        g = self.layers["customer"]
        if old_firm is not None and g.has_edge(customer_id, old_firm):
            g.remove_edge(customer_id, old_firm)
        g.add_edge(customer_id, new_firm, strength=float(rng.uniform(0.3, 0.8)),
                   trust=float(rng.uniform(0.4, 0.9)), exposure=0.5, dependency=0.5)
        self.invalidate("customer")

    def degree_centrality(self, layer: str) -> dict[int, float]:
        g = self.layers.get(layer)
        if g is None or g.number_of_nodes() == 0:
            return {}
        return nx.degree_centrality(g)
