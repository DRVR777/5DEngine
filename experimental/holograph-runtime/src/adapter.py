from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Adapter:
    name: str
    emits: str
    mode: str = "read_only"
    command: str = ""

    def describe(self) -> dict[str, str]:
        return {
            "name": self.name,
            "emits": self.emits,
            "mode": self.mode,
            "command": self.command,
        }
