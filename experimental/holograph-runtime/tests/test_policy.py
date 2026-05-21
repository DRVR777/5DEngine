import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src import Node, Policy


def test_high_disk_policy_proposes_action():
    node = Node(id="srv", kind="server", state={"disk": {"percent_used": 99}})
    policy = Policy(
        name="high_disk_usage",
        applies_to="server",
        when="state.disk.percent_used > 95",
        propose="move_artifacts_to_storage",
    )

    assert policy.evaluate(node) == ["move_artifacts_to_storage"]
