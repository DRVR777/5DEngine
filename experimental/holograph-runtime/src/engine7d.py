from graph import Graph, Node
from engine6d import SixDServerEngine

class SevenDEngine:
    def __init__(self):
        self.servers: list[SixDServerEngine] = []
        self.storage_boxes: list[Node] = []
        self.p2p_links = []
        self.repos: list[Node] = []
        self.agents: list[Node] = []
    def add_server(self, server: SixDServerEngine):
        self.servers.append(server)
    def observe(self):
        return self.model()
    def preserve(self):
        return [{"mode": "propose_only", "action": "verify_backups"}]
    def model(self) -> Graph:
        graph = Graph("7d-operating-system")
        for server in self.servers:
            sub = server.model()
            for node in sub.nodes.values():
                graph.add_node(node)
            for link in sub.links:
                graph.links.append(link)
        for node in self.storage_boxes + self.repos + self.agents:
            graph.add_node(node)
        return graph
    def render_manifest(self):
        return self.model().to_dict()
    def propose_actions(self):
        return [{"mode": "propose_only", "action": "observe_more"}]
    def verify_backups(self):
        return [{"mode": "read_only", "check": "backup_metadata_present"}]
