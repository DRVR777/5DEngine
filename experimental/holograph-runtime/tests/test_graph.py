import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from graph import Graph, Node

def test_graph_validates_links():
    g = Graph("test")
    g.add_node(Node("a", "kind"))
    g.add_node(Node("b", "kind"))
    g.add_link("a", "b", "depends_on")
    assert g.validate() == []
