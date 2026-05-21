import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src import Adapter, SevenDEngine, SevenDOperatingSystem, SixDServerEngine
from src.hgrl import read_hgrl


def test_hgrl_world_reader_and_os_observe():
    manifest = ROOT / "hgrl" / "examples" / "generic-7d-os.hgrl"
    parsed = read_hgrl(manifest)
    assert parsed["worlds"] == ["generic-7d-os"]

    engine = SevenDEngine()
    engine.add_server(SixDServerEngine("example-server"))
    os_model = SevenDOperatingSystem(engine)
    os_model.add_adapter(Adapter(name="processes", emits="runtime.process"))
    assert os_model.observe()["mode"] == "read_only"
