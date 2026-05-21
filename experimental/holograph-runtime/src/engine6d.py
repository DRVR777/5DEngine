from graph import Graph, Node
from engine5d import FiveDEngine

class SixDServerEngine:
    def __init__(self, server: Node):
        self.server = server
        self.worlds: list[FiveDEngine] = []
    def add_world(self, world: FiveDEngine):
        self.worlds.append(world)
    def model(self) -> Graph:
        graph = Graph(f"6d:{self.server.id}")
        graph.add_node(self.server)
        for world in self.worlds:
            for node in world.graph.nodes.values():
                graph.add_node(node)
                graph.add_link(self.server.id, node.id, "hosts")
        return graph
