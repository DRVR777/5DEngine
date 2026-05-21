import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from graph import Graph, Node

g = Graph("sample-7d-os")
for node in [
    Node("server-alpha", "server"),
    Node("world-alpha", "world.5d"),
    Node("process-alpha", "runtime.process"),
    Node("database-alpha", "database.postgres"),
    Node("repo-5dengine", "repo.git"),
    Node("dwrld-peer-alpha", "network.peer"),
    Node("council-agent-alpha", "agent.council"),
    Node("backup-alpha", "storage.backup"),
    Node("dashboard-alpha", "visual.dashboard"),
]:
    g.add_node(node)
g.add_link("server-alpha", "world-alpha", "hosts")
g.add_link("world-alpha", "process-alpha", "runs_as")
g.add_link("world-alpha", "database-alpha", "persists_to")
g.add_link("repo-5dengine", "world-alpha", "defines")
g.add_link("world-alpha", "dwrld-peer-alpha", "communicates_via")
g.add_link("council-agent-alpha", "server-alpha", "observes")
g.add_link("database-alpha", "backup-alpha", "backed_up_by")
g.add_link("dashboard-alpha", "server-alpha", "visualizes")
base = Path(__file__).resolve().parent
(base / "sample_graph.json").write_text(g.to_json(), encoding="utf-8")
(base / "sample_output.md").write_text(g.to_markdown(), encoding="utf-8")
(base / "sample_graph.mmd").write_text(g.to_mermaid(), encoding="utf-8")
print(g.to_markdown())
