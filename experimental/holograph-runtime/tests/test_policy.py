import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from policy import Policy

def test_policy_defaults_to_propose_only():
    assert Policy("p", "server", "true", "observe").mode == "propose_only"
