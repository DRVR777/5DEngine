from dataclasses import dataclass

@dataclass
class Adapter:
    name: str
    observes: str
    emits_kind: str
    command: str | None = None
    mode: str = "read_only"
