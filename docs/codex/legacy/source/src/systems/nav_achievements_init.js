// Initialises AStar pathfinding from WorldData and wires Achievements to EventBus.
// Both calls are guarded so missing globals are silently skipped.
export function mountNavAndAchievements({ WD }) {
  if (typeof AStar !== "undefined") {
    AStar.build(WD, { halfSize: 60, cellSize: 1 });
  }
  if (typeof Achievements !== "undefined" && typeof EventBus !== "undefined") {
    Achievements.wireEventBus(EventBus);
  }
}
