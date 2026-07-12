import numpy as np

from simcore.agents.population import PopulationFactory
from simcore.engine.rng import RngHub
from simcore.networks.generators import build_network
from simcore.networks.layers import MultiLayerNetwork
from tests.conftest import small_config


def test_generators_cover_all_kinds():
    rng = np.random.default_rng(0)
    nodes = list(range(20))
    for kind in ("random", "small_world", "scale_free", "clustered"):
        g = build_network(kind, nodes, rng, )
        assert set(g.nodes) == set(nodes)
        if kind != "random":
            assert g.number_of_edges() > 0
        for _, _, d in g.edges(data=True):
            assert 0 <= d["strength"] <= 1
            assert "trust" in d and "dependency" in d


def build_net():
    cfg = small_config()
    hub = RngHub(cfg.seed, cfg.n_actors, len(cfg.assets))
    actors, _ = PopulationFactory(cfg, hub).build()
    net = MultiLayerNetwork.build(cfg, actors, hub.population)
    return cfg, actors, net


def test_all_layers_built():
    _, _, net = build_net()
    for layer in ("social", "information", "customer", "supplier", "credit"):
        assert layer in net.layers


def test_economic_layers_are_bipartite_and_connected():
    _, actors, net = build_net()
    from simcore.models.actor_state import ActorType

    customers = [a.id for a in actors if a.actor_type == ActorType.CUSTOMER]
    for c in customers:
        assert len(net.neighbors("customer", c)) >= 1
    firms = [a.id for a in actors if a.actor_type == ActorType.FIRM]
    for f in firms:
        assert len(net.neighbors("supplier", f)) >= 1


def test_remove_actor_drops_edges_and_invalidates_cache():
    _, actors, net = build_net()
    node = actors[0].id
    _ = net.adjacency("social")
    assert "social" in net._csr_cache
    net.remove_actor(node)
    assert net.neighbors("social", node) == []
    assert "social" not in net._csr_cache, "cache must be invalidated on topology change"


def test_media_actors_are_social_hubs():
    _, actors, net = build_net()
    from simcore.models.actor_state import ActorType

    g = net.layers["social"]
    degrees = dict(g.degree())
    media_deg = np.mean([degrees[a.id] for a in actors if a.actor_type == ActorType.MEDIA])
    all_deg = np.mean(list(degrees.values()))
    assert media_deg > all_deg * 2, "media must be network hubs"
