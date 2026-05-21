from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Policy:
    name: str
    applies_to: str
    when: str
    propose: str
    mode: str = "propose_only"

    def evaluate(self, node: Any) -> list[str]:
        if self.applies_to not in {node.kind, *node.labels}:
            return []
        if self.when == "always":
            return [self.propose]
        if self.when == "state.disk.percent_used > 95":
            disk = node.state.get("disk", {})
            if disk.get("percent_used", 0) > 95:
                return [self.propose]
        return []
