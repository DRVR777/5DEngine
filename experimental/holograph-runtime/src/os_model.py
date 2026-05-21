from __future__ import annotations

from .adapter import Adapter
from .engine7d import SevenDEngine


class SevenDOperatingSystem:
    def __init__(self, engine: SevenDEngine):
        self.engine = engine
        self.adapters: list[Adapter] = []

    def add_adapter(self, adapter: Adapter) -> None:
        if adapter.mode != "read_only":
            raise ValueError("prototype adapters must be read_only")
        self.adapters.append(adapter)

    def observe(self) -> dict[str, object]:
        return {
            "mode": "read_only",
            "adapters": [adapter.describe() for adapter in self.adapters],
            "engine": self.engine.observe(),
        }

    def propose(self) -> list[str]:
        return self.engine.propose_actions()
