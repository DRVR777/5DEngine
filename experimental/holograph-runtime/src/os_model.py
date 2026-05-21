from engine7d import SevenDEngine

class SevenDOperatingSystem:
    def __init__(self, engine: SevenDEngine):
        self.engine = engine
        self.mode = "propose_only"
    def observe(self):
        return self.engine.observe()
    def propose(self):
        return self.engine.propose_actions()
