import {
  TileType, EdgeType, TileEdges, RoadZone, CityTile,
  BuildingFootprint, UrbanWorldState
} from '../types';

// Constants
export const TILE_SIZE = 800;
export const ROAD_WIDTH = 200;
export const SIDEWALK_WIDTH = 40;
export const BUILDING_MARGIN = 20;
export const LOAD_RADIUS = 3;

// Tile Definitions
const TILE_DEFINITIONS: Record<TileType, { edges: TileEdges; roadZones: RoadZone[] }> = {
  [TileType.CROSSROADS]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.ROAD, south: EdgeType.ROAD, west: EdgeType.ROAD },
    roadZones: [
      // Vertical road
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: TILE_SIZE },
      // Horizontal road
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: TILE_SIZE, height: ROAD_WIDTH }
    ]
  },
  [TileType.STRAIGHT_NS]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.BUILDING, south: EdgeType.ROAD, west: EdgeType.BUILDING },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: TILE_SIZE }
    ]
  },
  [TileType.STRAIGHT_EW]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.ROAD, south: EdgeType.BUILDING, west: EdgeType.ROAD },
    roadZones: [
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: TILE_SIZE, height: ROAD_WIDTH }
    ]
  },
  [TileType.CORNER_NE]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.ROAD, south: EdgeType.BUILDING, west: EdgeType.BUILDING },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 },
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.CORNER_ES]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.ROAD, south: EdgeType.ROAD, west: EdgeType.BUILDING },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 },
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.CORNER_SW]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.BUILDING, south: EdgeType.ROAD, west: EdgeType.ROAD },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 },
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.CORNER_NW]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.BUILDING, south: EdgeType.BUILDING, west: EdgeType.ROAD },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 },
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.T_JUNCTION_NES]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.ROAD, south: EdgeType.ROAD, west: EdgeType.BUILDING },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: TILE_SIZE },
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.T_JUNCTION_ESW]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.ROAD, south: EdgeType.ROAD, west: EdgeType.ROAD },
    roadZones: [
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: TILE_SIZE, height: ROAD_WIDTH },
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 }
    ]
  },
  [TileType.T_JUNCTION_NSW]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.BUILDING, south: EdgeType.ROAD, west: EdgeType.ROAD },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: TILE_SIZE },
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.T_JUNCTION_NEW]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.ROAD, south: EdgeType.BUILDING, west: EdgeType.ROAD },
    roadZones: [
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: TILE_SIZE, height: ROAD_WIDTH },
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 }
    ]
  },
  [TileType.DEAD_END_N]: {
    edges: { north: EdgeType.ROAD, east: EdgeType.BUILDING, south: EdgeType.BUILDING, west: EdgeType.BUILDING },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: 0, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 }
    ]
  },
  [TileType.DEAD_END_E]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.ROAD, south: EdgeType.BUILDING, west: EdgeType.BUILDING },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.DEAD_END_S]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.BUILDING, south: EdgeType.ROAD, west: EdgeType.BUILDING },
    roadZones: [
      { x: (TILE_SIZE - ROAD_WIDTH) / 2, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: ROAD_WIDTH, height: (TILE_SIZE + ROAD_WIDTH) / 2 }
    ]
  },
  [TileType.DEAD_END_W]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.BUILDING, south: EdgeType.BUILDING, west: EdgeType.ROAD },
    roadZones: [
      { x: 0, y: (TILE_SIZE - ROAD_WIDTH) / 2, width: (TILE_SIZE + ROAD_WIDTH) / 2, height: ROAD_WIDTH }
    ]
  },
  [TileType.EMPTY]: {
    edges: { north: EdgeType.BUILDING, east: EdgeType.BUILDING, south: EdgeType.BUILDING, west: EdgeType.BUILDING },
    roadZones: []
  }
};

// Seeded random number generator
export const seedRandom = (gx: number, gy: number, worldSeed: number): number => {
  const seed = (gx * 73856093) ^ (gy * 19349663) ^ (worldSeed * 83492791);
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Get all tile types that match given edge constraints
export const getValidTileTypes = (constraints: {
  north: EdgeType | null;
  east: EdgeType | null;
  south: EdgeType | null;
  west: EdgeType | null;
}): TileType[] => {
  return Object.entries(TILE_DEFINITIONS)
    .filter(([_, def]) => {
      if (constraints.north !== null && def.edges.north !== constraints.north) return false;
      if (constraints.east !== null && def.edges.east !== constraints.east) return false;
      if (constraints.south !== null && def.edges.south !== constraints.south) return false;
      if (constraints.west !== null && def.edges.west !== constraints.west) return false;
      return true;
    })
    .map(([type, _]) => type as TileType);
};

// Generate a tile at given grid coordinates
export const generateTile = (
  gx: number,
  gy: number,
  worldSeed: number,
  loadedTiles: Map<string, CityTile>
): CityTile => {
  // Special case: spawn point is always crossroads
  if (gx === 0 && gy === 0) {
    const def = TILE_DEFINITIONS[TileType.CROSSROADS];
    return {
      type: TileType.CROSSROADS,
      edges: def.edges,
      roadZones: def.roadZones,
      buildings: generateBuildings(TileType.CROSSROADS, gx, gy, worldSeed)
    };
  }

  // Get constraints from neighbors
  const northTile = loadedTiles.get(`${gx},${gy - 1}`);
  const eastTile = loadedTiles.get(`${gx + 1},${gy}`);
  const southTile = loadedTiles.get(`${gx},${gy + 1}`);
  const westTile = loadedTiles.get(`${gx - 1},${gy}`);

  const constraints = {
    north: northTile?.edges.south ?? null,
    east: eastTile?.edges.west ?? null,
    south: southTile?.edges.north ?? null,
    west: westTile?.edges.east ?? null
  };

  // Get valid tile types
  let validTypes = getValidTileTypes(constraints);

  // Fallback if no valid types (shouldn't happen with proper constraints)
  if (validTypes.length === 0) {
    validTypes = [TileType.CROSSROADS];
  }

  // Select tile using seeded random
  const rand = seedRandom(gx, gy, worldSeed);
  const selectedType = validTypes[Math.floor(rand * validTypes.length)];
  const def = TILE_DEFINITIONS[selectedType];

  return {
    type: selectedType,
    edges: def.edges,
    roadZones: def.roadZones,
    buildings: generateBuildings(selectedType, gx, gy, worldSeed)
  };
};

// Generate buildings for a tile
const BUILDING_COLORS = ['#8b4513', '#696969', '#2f4f4f', '#8b0000', '#556b2f'];

export const generateBuildings = (
  tileType: TileType,
  gx: number,
  gy: number,
  worldSeed: number
): BuildingFootprint[] => {
  const buildings: BuildingFootprint[] = [];
  const def = TILE_DEFINITIONS[tileType];
  let randCounter = 0;
  const rand = () => seedRandom(gx + randCounter++, gy + randCounter * 7, worldSeed);

  // Define potential building areas (quadrants without roads)
  const quadrants = [
    { x: BUILDING_MARGIN, y: BUILDING_MARGIN, w: TILE_SIZE / 2 - BUILDING_MARGIN * 2, h: TILE_SIZE / 2 - BUILDING_MARGIN * 2 },
    { x: TILE_SIZE / 2 + BUILDING_MARGIN, y: BUILDING_MARGIN, w: TILE_SIZE / 2 - BUILDING_MARGIN * 2, h: TILE_SIZE / 2 - BUILDING_MARGIN * 2 },
    { x: BUILDING_MARGIN, y: TILE_SIZE / 2 + BUILDING_MARGIN, w: TILE_SIZE / 2 - BUILDING_MARGIN * 2, h: TILE_SIZE / 2 - BUILDING_MARGIN * 2 },
    { x: TILE_SIZE / 2 + BUILDING_MARGIN, y: TILE_SIZE / 2 + BUILDING_MARGIN, w: TILE_SIZE / 2 - BUILDING_MARGIN * 2, h: TILE_SIZE / 2 - BUILDING_MARGIN * 2 }
  ];

  for (const quad of quadrants) {
    // Check if quadrant overlaps with any road zone
    const overlapsRoad = def.roadZones.some(zone =>
      !(quad.x + quad.w < zone.x || quad.x > zone.x + zone.width ||
        quad.y + quad.h < zone.y || quad.y > zone.y + zone.height)
    );

    if (!overlapsRoad) {
      // Add 1-4 buildings in this quadrant
      const buildingCount = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < buildingCount; i++) {
        const bw = quad.w / 2 - 10;
        const bh = quad.h / 2 - 10;
        buildings.push({
          x: quad.x + (i % 2) * (quad.w / 2) + rand() * 10,
          y: quad.y + Math.floor(i / 2) * (quad.h / 2) + rand() * 10,
          width: bw + rand() * 20 - 10,
          height: bh + rand() * 20 - 10,
          color: BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)]
        });
      }
    }
  }

  return buildings;
};

// Initialize urban world state
export const createUrbanWorldState = (): UrbanWorldState => {
  const worldSeed = Date.now();
  const loadedTiles = new Map<string, CityTile>();

  // Generate initial tiles around spawn
  for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      const tile = generateTile(dx, dy, worldSeed, loadedTiles);
      loadedTiles.set(`${dx},${dy}`, tile);
    }
  }

  return {
    loadedTiles,
    worldSeed,
    playerGridPos: { gx: 0, gy: 0 }
  };
};

// Update loaded tiles based on player position
export const updateLoadedTiles = (
  playerX: number,
  playerY: number,
  state: UrbanWorldState
): void => {
  const newGx = Math.floor(playerX / TILE_SIZE);
  const newGy = Math.floor(playerY / TILE_SIZE);

  // Check if player moved to new grid cell
  if (newGx !== state.playerGridPos.gx || newGy !== state.playerGridPos.gy) {
    state.playerGridPos = { gx: newGx, gy: newGy };

    // Unload distant tiles
    const keysToRemove: string[] = [];
    for (const key of state.loadedTiles.keys()) {
      const [gx, gy] = key.split(',').map(Number);
      if (Math.abs(gx - newGx) > LOAD_RADIUS + 1 || Math.abs(gy - newGy) > LOAD_RADIUS + 1) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      state.loadedTiles.delete(key);
    }

    // Load new tiles
    for (let dy = -LOAD_RADIUS; dy <= LOAD_RADIUS; dy++) {
      for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
        const tileGx = newGx + dx;
        const tileGy = newGy + dy;
        const key = `${tileGx},${tileGy}`;
        if (!state.loadedTiles.has(key)) {
          const tile = generateTile(tileGx, tileGy, state.worldSeed, state.loadedTiles);
          state.loadedTiles.set(key, tile);
        }
      }
    }
  }
};

// Check if a world position is on a road
export const isPositionOnRoad = (
  worldX: number,
  worldY: number,
  state: UrbanWorldState
): boolean => {
  const gx = Math.floor(worldX / TILE_SIZE);
  const gy = Math.floor(worldY / TILE_SIZE);
  const tile = state.loadedTiles.get(`${gx},${gy}`);

  if (!tile) return false;

  const localX = worldX - gx * TILE_SIZE;
  const localY = worldY - gy * TILE_SIZE;

  for (const zone of tile.roadZones) {
    if (
      localX >= zone.x &&
      localX <= zone.x + zone.width &&
      localY >= zone.y &&
      localY <= zone.y + zone.height
    ) {
      return true;
    }
  }

  return false;
};

// Find nearest road position (for boundary bounce)
export const findNearestRoadPosition = (
  worldX: number,
  worldY: number,
  state: UrbanWorldState
): { x: number; y: number } => {
  const gx = Math.floor(worldX / TILE_SIZE);
  const gy = Math.floor(worldY / TILE_SIZE);
  const tile = state.loadedTiles.get(`${gx},${gy}`);

  if (!tile || tile.roadZones.length === 0) {
    // No tile or no roads, return current position
    return { x: worldX, y: worldY };
  }

  const localX = worldX - gx * TILE_SIZE;
  const localY = worldY - gy * TILE_SIZE;

  let nearestDist = Infinity;
  let nearestPoint = { x: worldX, y: worldY };

  for (const zone of tile.roadZones) {
    // Find closest point on this zone
    const clampedX = Math.max(zone.x, Math.min(zone.x + zone.width, localX));
    const clampedY = Math.max(zone.y, Math.min(zone.y + zone.height, localY));

    const dist = Math.sqrt((localX - clampedX) ** 2 + (localY - clampedY) ** 2);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPoint = {
        x: gx * TILE_SIZE + clampedX,
        y: gy * TILE_SIZE + clampedY
      };
    }
  }

  return nearestPoint;
};
