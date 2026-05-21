from dataclasses import dataclass

@dataclass
class Policy:
    name: str
    applies_to: str
    condition: str
    proposal: str
    mode: str = "propose_only"
