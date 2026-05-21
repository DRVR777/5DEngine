from __future__ import annotations

from .engine5d import FiveDEngine
from .graph import Node


class SixDServerEngine:
    def __init__(self, hostname: str):
        self.hostname = hostname
        self.worlds: dict[str, FiveDEngine] = {}
        self.server_node = Node(id=f"server_{hostname}", kind="server", labels=[hostname])

    def add_world(self, world: FiveDEngine) -> None:
        self.worlds[world.name] = world

    def observe(self) -> dict[str, object]:
        return {
            "hostname": self.hostname,
            "mode": "read_only",
            "worlds": sorted(self.worlds),
        }
