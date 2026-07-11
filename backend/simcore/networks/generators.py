"""Network generators. All return NetworkX graphs whose nodes are actor ids;
edge attributes carry {strength, trust, exposure, dependency}."""
from __future__ import annotations

import networkx as nx
import numpy as np


def _decorate_edges(g: nx.Graph, rng: np.random.Generator) -> nx.Graph:
    for u, v in g.edges():
        g.edges[u, v]["strength"] = float(rng.uniform(0.3, 1.0))
        g.edges[u, v]["trust"] = float(rng.uniform(0.3, 0.9))
        g.edges[u, v]["exposure"] = float(rng.uniform(0.0, 1.0))
        g.edges[u, v]["dependency"] = float(rng.uniform(0.0, 1.0))
    return g


def _relabel(g: nx.Graph, nodes: list[int]) -> nx.Graph:
    return nx.relabel_nodes(g, dict(enumerate(nodes)))


def random_network(nodes: list[int], rng: np.random.Generator, p: float = 0.05, **_) -> nx.Graph:
    seed = int(rng.integers(0, 2**31 - 1))
    g = nx.gnp_random_graph(len(nodes), p, seed=seed)
    return _decorate_edges(_relabel(g, nodes), rng)


def small_world_network(
    nodes: list[int], rng: np.random.Generator, k: int = 6, p: float = 0.1, **_
) -> nx.Graph:
    seed = int(rng.integers(0, 2**31 - 1))
    k = min(k, max(len(nodes) - 1, 1))
    if k % 2 == 1:
        k -= 1
    k = max(k, 2)
    g = nx.watts_strogatz_graph(len(nodes), k, p, seed=seed)
    return _decorate_edges(_relabel(g, nodes), rng)


def scale_free_network(nodes: list[int], rng: np.random.Generator, m: int = 3, **_) -> nx.Graph:
    seed = int(rng.integers(0, 2**31 - 1))
    m = min(m, max(len(nodes) - 1, 1))
    g = nx.barabasi_albert_graph(len(nodes), m, seed=seed)
    return _decorate_edges(_relabel(g, nodes), rng)


def clustered_network(
    nodes: list[int], rng: np.random.Generator, clusters: int = 6, p_in: float = 0.25, p_out: float = 0.01, **_
) -> nx.Graph:
    seed = int(rng.integers(0, 2**31 - 1))
    n = len(nodes)
    clusters = max(1, min(clusters, n))
    sizes = [n // clusters] * clusters
    sizes[0] += n - sum(sizes)
    g = nx.stochastic_block_model(
        sizes, [[p_in if i == j else p_out for j in range(clusters)] for i in range(clusters)], seed=seed
    )
    g = nx.Graph(g)  # drop SBM metadata / multi edges
    return _decorate_edges(_relabel(g, nodes), rng)


GENERATORS = {
    "random": random_network,
    "small_world": small_world_network,
    "scale_free": scale_free_network,
    "clustered": clustered_network,
}


def build_network(kind: str, nodes: list[int], rng: np.random.Generator, **params) -> nx.Graph:
    if kind not in GENERATORS:
        raise KeyError(f"unknown network kind '{kind}' (available: {sorted(GENERATORS)})")
    if not nodes:
        return nx.Graph()
    return GENERATORS[kind](nodes, rng, **params)
