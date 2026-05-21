from dataclasses import dataclass, field, asdict
from typing import Any
import json

@dataclass
class Link:
    source: str
    target: str
    meaning: str = "relates_to"
    properties: dict[str, Any] = field(default_factory=dict)

@dataclass
class Node:
    id: str
    kind: str
    labels: list[str] = field(default_factory=list)
    coordinates: dict[str, Any] = field(default_factory=dict)
    state: dict[str, Any] = field(default_factory=dict)
    properties: dict[str, Any] = field(default_factory=dict)
    evidence: list[Any] = field(default_factory=list)
    policies: list[str] = field(default_factory=list)
    links: list[Link] = field(default_factory=list)

class Graph:
    def __init__(self, name: str = "world"):
        self.name = name
        self.nodes: dict[str, Node] = {}
        self.links: list[Link] = []

    def add_node(self, node: Node) -> Node:
        self.nodes[node.id] = node
        return node

    def add_link(self, source: str, target: str, meaning: str = "relates_to", **properties: Any) -> Link:
        link = Link(source, target, meaning, properties)
        self.links.append(link)
        return link

    def validate(self) -> list[str]:
        errors = []
        for link in self.links:
            if link.source not in self.nodes:
                errors.append(f"missing source: {link.source}")
            if link.target not in self.nodes:
                errors.append(f"missing target: {link.target}")
        return errors

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "nodes": [asdict(n) for n in self.nodes.values()], "links": [asdict(l) for l in self.links]}

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, sort_keys=True)

    def to_markdown(self) -> str:
        rows = [f"# {self.name}", "", "## Nodes"]
        rows += [f"- `{n.id}` ({n.kind})" for n in self.nodes.values()]
        rows += ["", "## Links"]
        rows += [f"- `{l.source}` --{l.meaning}--> `{l.target}`" for l in self.links]
        return "\n".join(rows) + "\n"

    def to_mermaid(self) -> str:
        rows = ["graph TD"]
        rows += [f'  {n.id.replace("-", "_")}["{n.id}<br/>{n.kind}"]' for n in self.nodes.values()]
        rows += [f'  {l.source.replace("-", "_")} -->|{l.meaning}| {l.target.replace("-", "_")}' for l in self.links]
        return "\n".join(rows) + "\n"
