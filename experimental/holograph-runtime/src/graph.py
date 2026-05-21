from __future__ import annotations

from dataclasses import dataclass, field, asdict
import json
from typing import Any


@dataclass
class Link:
    source: str
    target: str
    meaning: str
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class Node:
    id: str
    kind: str
    labels: list[str] = field(default_factory=list)
    coordinates: dict[str, Any] = field(default_factory=dict)
    state: dict[str, Any] = field(default_factory=dict)
    properties: dict[str, Any] = field(default_factory=dict)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    policies: list[str] = field(default_factory=list)
    links: list[Link] = field(default_factory=list)


class Graph:
    def __init__(self, dimensions: dict[str, str] | None = None):
        self.dimensions = dimensions or {}
        self.nodes: dict[str, Node] = {}
        self.links: list[Link] = []

    def add_node(self, node: Node) -> Node:
        if node.id in self.nodes:
            raise ValueError(f"duplicate node id: {node.id}")
        self.nodes[node.id] = node
        return node

    def add_link(self, link: Link) -> Link:
        if link.source not in self.nodes:
            raise ValueError(f"missing source node: {link.source}")
        if link.target not in self.nodes:
            raise ValueError(f"missing target node: {link.target}")
        self.links.append(link)
        self.nodes[link.source].links.append(link)
        return link

    def validate(self) -> None:
        for link in self.links:
            if link.source not in self.nodes or link.target not in self.nodes:
                raise ValueError(f"broken link: {link.source} -> {link.target}")

    def to_dict(self) -> dict[str, Any]:
        return {
            "dimensions": self.dimensions,
            "nodes": [asdict(node) for node in self.nodes.values()],
            "links": [asdict(link) for link in self.links],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, sort_keys=True)

    def to_markdown(self) -> str:
        lines = ["# Holographic Graph", "", "## Dimensions", ""]
        for key, value in self.dimensions.items():
            lines.append(f"- `{key}` = `{value}`")
        lines.extend(["", "## Nodes", ""])
        for node in self.nodes.values():
            lines.append(f"- `{node.id}` ({node.kind})")
        lines.extend(["", "## Links", ""])
        for link in self.links:
            lines.append(f"- `{link.source}` --{link.meaning}--> `{link.target}`")
        return "\n".join(lines) + "\n"

    def to_mermaid(self) -> str:
        lines = ["graph TD"]
        for node in self.nodes.values():
            label = node.labels[0] if node.labels else node.id
            lines.append(f'  {node.id}["{label}<br/>{node.kind}"]')
        for link in self.links:
            lines.append(f"  {link.source} -- {link.meaning} --> {link.target}")
        return "\n".join(lines) + "\n"
