from graph import Graph

class FiveDEngine:
    def __init__(self, graph: Graph):
        self.graph = graph
    def observe(self):
        return self.graph
    def render_manifest(self):
        return self.graph.to_dict()
