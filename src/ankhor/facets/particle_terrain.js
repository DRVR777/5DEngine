/** particle_terrain — terrain config from legacy mountParticleAndTerrain */
export default {
  priority: 50,
  init(_t, data) {
    data.gridSize = 100;
    data.terrainSize = 200;
    data.terrainSegments = 96;
    data.terrainMaxHeight = 6;
    data.terrainSeed = 42;
  }
};
