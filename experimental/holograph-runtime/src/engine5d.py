from __future__ import annotations

from .graph import Graph, Node


class FiveDEngine:
    def __init__(self, name: str, graph: Graph | None = None):
        self.name = name
        self.graph = graph or Graph()

    def add_entity(self, node: Node) -> Node:
        return self.graph.add_node(node)

    def tick(self) -> dict[str, int | str]:
        return {"engine": self.name, "mode": "model_only", "nodes": len(self.graph.nodes)}
