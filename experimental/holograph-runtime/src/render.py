from __future__ import annotations

from .graph import Graph


def render_all(graph: Graph) -> dict[str, str]:
    return {
        "json": graph.to_json(),
        "markdown": graph.to_markdown(),
        "mermaid": graph.to_mermaid(),
    }
