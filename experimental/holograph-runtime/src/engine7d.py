from __future__ import annotations

from .engine6d import SixDServerEngine
from .graph import Graph, Link, Node
from .policy import Policy


class SevenDEngine:
    def __init__(self, dimensions: dict[str, str] | None = None):
        self.graph = Graph(dimensions=dimensions)
        self.servers: dict[str, SixDServerEngine] = {}
        self.policies: list[Policy] = []

    def add_server(self, server: SixDServerEngine) -> None:
        self.servers[server.hostname] = server
        if server.server_node.id not in self.graph.nodes:
            self.graph.add_node(server.server_node)

    def add_managed_node(self, node: Node, server_hostname: str | None = None) -> None:
        self.graph.add_node(node)
        if server_hostname:
            server_id = f"server_{server_hostname}"
            if server_id in self.graph.nodes:
                self.graph.add_link(Link(server_id, node.id, "contains"))

    def add_policy(self, policy: Policy) -> None:
        self.policies.append(policy)

    def observe(self) -> dict[str, object]:
        return {"mode": "read_only", "servers": sorted(self.servers)}

    def preserve(self) -> dict[str, object]:
        return {"mode": "propose_only", "actions": ["verify backups before sync"]}

    def model(self) -> dict[str, object]:
        return self.graph.to_dict()

    def render_manifest(self) -> str:
        return self.graph.to_json()

    def propose_actions(self) -> list[str]:
        proposals: list[str] = []
        for node in self.graph.nodes.values():
            for policy in self.policies:
                proposals.extend(policy.evaluate(node))
        return proposals

    def verify_backups(self) -> dict[str, object]:
        backups = [n.id for n in self.graph.nodes.values() if n.kind == "backup"]
        return {"mode": "read_only", "backups": backups}
