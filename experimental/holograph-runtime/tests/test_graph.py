import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src import Graph, Link, Node


def test_graph_exports_all_formats():
    graph = Graph({"x": "identity"})
    graph.add_node(Node(id="server", kind="server", labels=["Server"]))
    graph.add_node(Node(id="world", kind="world", labels=["World"]))
    graph.add_link(Link("server", "world", "hosts"))

    assert '"nodes"' in graph.to_json()
    assert "`server` --hosts--> `world`" in graph.to_markdown()
    assert "server -- hosts --> world" in graph.to_mermaid()
