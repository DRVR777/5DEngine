from __future__ import annotations

from .graph import Graph


def verify_graph(graph: Graph) -> dict[str, object]:
    graph.validate()
    return {"valid": True, "nodes": len(graph.nodes), "links": len(graph.links)}
