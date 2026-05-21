import json
from pathlib import Path

def test_sample_manifest_exists():
    path = Path(__file__).resolve().parents[1] / "examples" / "sample_graph.json"
    assert json.loads(path.read_text())["name"] == "sample-7d-os"
