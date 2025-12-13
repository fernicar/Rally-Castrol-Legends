# Rally Legends: Urban Freeroam Update Plan

> **Document Version:** 1.0  
> **Date:** December 2025  
> **Mode Name:** Urban Freeroam  
> **Target:** Infinite Procedural City with Grid-Based Road System

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Tile System Design](#tile-system-design)
4. [Grid Coordinate System](#grid-coordinate-system)
5. [Procedural Generation Algorithm](#procedural-generation-algorithm)
6. [Road Collision & Boundaries](#road-collision--boundaries)
7. [Placeholder Rendering System](#placeholder-rendering-system)
8. [Integration with Existing Systems](#integration-with-existing-systems)
9. [Implementation Steps](#implementation-steps)
10. [Future Enhancements](#future-enhancements)

---

## Executive Summary

This update introduces **Urban Freeroam** mode - an infinite procedural city landscape where players can drive freely through an American-style grid-based urban environment. The city is generated using a tileset of pre-defined city blocks that connect seamlessly, creating endless streets to explore.

### Key Features

- **Infinite Procedural City** - City generates endlessly in all directions
- **American Grid Layout** - Orthogonal roads (N/S/E/W) with rectangular blocks
- **Tile-Based Generation** - 8 core tile types covering all road configurations
- **Road-Constrained Driving** - Invisible barriers keep player on roads
- **Placeholder Graphics** - Simple colored shapes (rectangles, polygons) for rapid development
- **Empty Streets** - Player car only, no AI traffic (Phase 1)
- **Seamless Loading** - Tiles spawn ahead, despawn behind for memory efficiency

### Design Goals

| Goal | Description |
|------|-------------|
| **Simplicity** | Placeholder graphics allow fast iteration |
| **Performance** | Only nearby tiles loaded in memory |
| **Extensibility** | Easy to add PNG textures, buildings, traffic later |
| **Immersion** | Continuous world with no visible boundaries |
| **Reuse** | Leverages existing car physics from GameEngine |

---

## System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        URBAN FREEROAM MODE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Tile        │    │  Grid        │    │  Collision   │       │
│  │  Definitions │───▶│  Manager     │───▶│  System      │       │
│  │  (8 types)   │    │  (spawning)  │    │  (road walls)│       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                   RENDERER                            │       │
│  │  • Roads (gray rectangles)                           │       │
│  │  • Sidewalks (light gray strips)                     │       │
│  │  • Buildings (colored rectangles)                    │       │
│  │  • Intersections (road junction markers)             │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              EXISTING CAR PHYSICS                     │       │
│  │              (from GameEngine.tsx)                    │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### New Files Required

| File | Purpose |
|------|---------|
| `services/urbanGenerator.ts` | Tile definitions, grid management, procedural generation |
| `types.ts` (modified) | Add `TrackType.URBAN`, `CityTile`, `UrbanWorldState` interfaces |
| `components/GameEngine.tsx` (modified) | Add urban rendering and collision logic |
| `services/trackService.ts` (modified) | Add Urban Freeroam track entry |
| `App.tsx` (modified) | Menu integration (minimal changes) |

---

## Tile System Design

### Core Concept

The city is built from **tiles** - square sections representing one city block. Each tile is 800x800 pixels and contains:
- Road sections on 0-4 edges
- Sidewalks along roads
- Building footprints filling non-road areas

### Tile Dimensions

```typescript
const TILE_SIZE = 800;       // Pixels per tile side
const ROAD_WIDTH = 200;      // Road width (same as track width)
const SIDEWALK_WIDTH = 40;   // Sidewalk on each side of road
const BUILDING_MARGIN = 20;  // Gap between sidewalk and building
```

### The 8 Core Tile Types

Each tile is defined by which edges have road connections (North, East, South, West).

```
┌─────────────────────────────────────────────────────────────────┐
│                        TILE TYPE REFERENCE                       │
├─────────────────────────────────────────────────────────────────┤

TILE 0: DEAD_END_N (Road connects North only)
┌────────────────┐
│   ┃      ┃     │
│   ┃  R   ┃     │   R = Road
│   ┃  O   ┃     │   B = Building
│   ┃  A   ┃     │
│ B ┃  D   ┃ B   │
│   ┗━━━━━━┛     │
│  BUILDING      │
└────────────────┘

TILE 1: DEAD_END_E (Road connects East only)
┌────────────────┐
│   BUILDING     │
│                │
│━━━━━━━━━━━━━━━▶│
│    ROAD        │
│━━━━━━━━━━━━━━━▶│
│                │
│   BUILDING     │
└────────────────┘

TILE 2: DEAD_END_S (Road connects South only)
┌────────────────┐
│   BUILDING     │
│   ┏━━━━━━┓     │
│ B ┃  R   ┃ B   │
│   ┃  O   ┃     │
│   ┃  A   ┃     │
│   ┃  D   ┃     │
│   ┃      ┃     │
└────────────────┘

TILE 3: DEAD_END_W (Road connects West only)
┌────────────────┐
│   BUILDING     │
│                │
│◀━━━━━━━━━━━━━━━│
│    ROAD        │
│◀━━━━━━━━━━━━━━━│
│                │
│   BUILDING     │
└────────────────┘

TILE 4: STRAIGHT_NS (Road connects North-South)
┌────────────────┐
│   ┃      ┃     │
│   ┃      ┃     │
│ B ┃ ROAD ┃ B   │
│   ┃      ┃     │
│   ┃      ┃     │
│   ┃      ┃     │
│   ┃      ┃     │
└────────────────┘

TILE 5: STRAIGHT_EW (Road connects East-West)
┌────────────────┐
│   BUILDING     │
│                │
│━━━━━━━━━━━━━━━━│
│     ROAD       │
│━━━━━━━━━━━━━━━━│
│                │
│   BUILDING     │
└────────────────┘

TILE 6: CORNER_NE (Road connects North-East, L-turn)
┌────────────────┐
│   ┃      ┃━━━━▶│
│   ┃      ┗━━━━▶│
│ B ┃ ROAD       │
│   ┃      ┏━━━━ │
│   ┃      ┃  B  │
│   ┗━━━━━━┛     │
│   BUILDING     │
└────────────────┘

TILE 7: CORNER_ES (Road connects East-South, L-turn)
┌────────────────┐
│   BUILDING     │
│   ┏━━━━━━┓     │
│   ┃      ┃ B   │
│   ┃ ROAD ┗━━━━▶│
│ B ┃      ┏━━━━▶│
│   ┃      ┃     │
│   ┃      ┃     │
└────────────────┘

TILE 8: CORNER_SW (Road connects South-West, L-turn)
┌────────────────┐
│   ┃      ┃     │
│   ┃      ┃     │
│   ┃ ROAD ┃ B   │
│◀━━┛      ┃     │
│◀━━┓      ┃     │
│   ┗━━━━━━┛     │
│   BUILDING     │
└────────────────┘

TILE 9: CORNER_NW (Road connects North-West, L-turn)
┌────────────────┐
│   ┃      ┃     │
│◀━━┛      ┃     │
│◀━━┓ ROAD ┃ B   │
│   ┃      ┃     │
│   ┃      ┃     │
│   ┃━━━━━━┛     │
│   BUILDING     │
└────────────────┘

TILE 10: T_JUNCTION_NES (T-junction, no West)
┌────────────────┐
│   ┃      ┃━━━━▶│
│   ┃      ┗━━━━▶│
│ B ┃ ROAD ┏━━━━▶│
│   ┃      ┃━━━━▶│
│   ┃      ┃     │
│   ┃      ┃     │
│   ┃      ┃     │
└────────────────┘

TILE 11: T_JUNCTION_ESW (T-junction, no North)
┌────────────────┐
│   BUILDING     │
│   ┏━━━━━━┓     │
│◀━━┛      ┗━━━━▶│
│◀━━━ ROAD ━━━━▶│
│◀━━┓      ┏━━━━▶│
│   ┃      ┃     │
│   ┃      ┃     │
└────────────────┘

TILE 12: T_JUNCTION_NSW (T-junction, no East)
┌────────────────┐
│   ┃      ┃     │
│◀━━┛      ┃     │
│◀━━┓ ROAD ┃ B   │
│◀━━┛      ┃     │
│   ┃      ┃     │
│   ┃      ┃     │
│   ┃      ┃     │
└────────────────┘

TILE 13: T_JUNCTION_NEW (T-junction, no South)
┌────────────────┐
│   ┃      ┃     │
│◀━━┛      ┗━━━━▶│
│◀━━━ ROAD ━━━━▶│
│◀━━┓      ┏━━━━▶│
│   ┗━━━━━━┛     │
│   BUILDING     │
│                │
└────────────────┘

TILE 14: CROSSROADS (4-way intersection)
┌────────────────┐
│   ┃      ┃     │
│◀━━┛      ┗━━━━▶│
│◀━━━ ROAD ━━━━▶│
│◀━━┓      ┏━━━━▶│
│   ┃      ┃     │
│   ┃      ┃     │
│   ┃      ┃     │
└────────────────┘

TILE 15: EMPTY (No roads - all building, used for block interiors)
┌────────────────┐
│                │
│   BUILDING     │
│                │
│   (Full block) │
│                │
│                │
│                │
└────────────────┘

└─────────────────────────────────────────────────────────────────┘
```

### Tile Connection System

Each tile edge can be either ROAD or BUILDING:

```typescript
enum EdgeType {
  ROAD = 'ROAD',
  BUILDING = 'BUILDING'
}

interface TileEdges {
  north: EdgeType;
  east: EdgeType;
  south: EdgeType;
  west: EdgeType;
}
```

**Connection Rule:** Adjacent tiles must have matching edge types where they connect.

```
Tile A (East edge = ROAD) ←→ Tile B (West edge = ROAD)  ✓ VALID
Tile A (East edge = ROAD) ←→ Tile B (West edge = BUILDING)  ✗ INVALID
```

---

## Grid Coordinate System

### World Space vs. Grid Space

```typescript
// Grid coordinates (integer tile positions)
interface GridCoord {
  gx: number;  // Grid X (column)
  gy: number;  // Grid Y (row)
}

// World coordinates (pixel positions)
interface WorldCoord {
  x: number;   // World X (pixels)
  y: number;   // World Y (pixels)
}

// Conversion functions
const worldToGrid = (world: WorldCoord): GridCoord => ({
  gx: Math.floor(world.x / TILE_SIZE),
  gy: Math.floor(world.y / TILE_SIZE)
});

const gridToWorld = (grid: GridCoord): WorldCoord => ({
  x: grid.gx * TILE_SIZE,
  y: grid.gy * TILE_SIZE
});

const gridToWorldCenter = (grid: GridCoord): WorldCoord => ({
  x: grid.gx * TILE_SIZE + TILE_SIZE / 2,
  y: grid.gy * TILE_SIZE + TILE_SIZE / 2
});
```

### Tile Loading Zone

Only tiles within a certain radius of the player are loaded:

```
┌───────────────────────────────────────────────────┐
│                                                   │
│     ┌───┬───┬───┬───┬───┐                        │
│     │   │   │   │   │   │                        │
│     ├───┼───┼───┼───┼───┤                        │
│     │   │   │   │   │   │     LOAD_RADIUS = 3    │
│     ├───┼───┼───┼───┼───┤     (loads 7x7 grid)   │
│     │   │   │ P │   │   │     P = Player         │
│     ├───┼───┼───┼───┼───┤                        │
│     │   │   │   │   │   │                        │
│     ├───┼───┼───┼───┼───┤                        │
│     │   │   │   │   │   │                        │
│     └───┴───┴───┴───┴───┘                        │
│                                                   │
│     Tiles outside this zone are unloaded         │
│                                                   │
└───────────────────────────────────────────────────┘
```

```typescript
const LOAD_RADIUS = 3;  // Tiles in each direction from player
const UNLOAD_PADDING = 1;  // Extra buffer before unloading

// Total loaded area: (2 * LOAD_RADIUS + 1)² = 49 tiles max
```

---

## Procedural Generation Algorithm

### Seeded Random for Determinism

Using the grid coordinates as a seed ensures the same tile appears at the same location every time:

```typescript
// Simple seeded random using grid coordinates
const seedRandom = (gx: number, gy: number, worldSeed: number): number => {
  const seed = (gx * 73856093) ^ (gy * 19349663) ^ (worldSeed * 83492791);
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);  // Returns 0.0 - 1.0
};
```

### Wave Function Collapse (Simplified)

The generation ensures adjacent tiles always connect properly:

```typescript
interface TileSlot {
  coord: GridCoord;
  tile: CityTile | null;
  possibleTiles: TileType[];  // Constraint propagation
}

// 1. When a new tile needs to be generated:
function generateTile(coord: GridCoord, neighbors: NeighborInfo): CityTile {
  // Get constraints from existing neighbors
  const constraints = {
    north: neighbors.north?.tile?.edges.south ?? null,
    east: neighbors.east?.tile?.edges.west ?? null,
    south: neighbors.south?.tile?.edges.north ?? null,
    west: neighbors.west?.tile?.edges.east ?? null
  };
  
  // Filter tiles that satisfy all constraints
  const validTiles = ALL_TILE_TYPES.filter(tile => 
    matchesConstraints(tile, constraints)
  );
  
  // Pick one using seeded random
  const rand = seedRandom(coord.gx, coord.gy, WORLD_SEED);
  const index = Math.floor(rand * validTiles.length);
  return validTiles[index];
}
```

### Generation Strategy: Road Network First

To create a more natural city feel, we bias the generator:

```typescript
// Probability weights for tile selection
const TILE_WEIGHTS = {
  CROSSROADS: 0.15,      // 4-way intersections
  T_JUNCTION: 0.25,      // T-junctions (combined)
  STRAIGHT: 0.35,        // Straight roads
  CORNER: 0.15,          // Corner turns
  DEAD_END: 0.05,        // Dead ends (rare)
  EMPTY: 0.05            // Building-only blocks (rare in streets)
};

// Apply weights during selection
function selectWeightedTile(validTiles: TileType[], rand: number): TileType {
  const weighted = validTiles.map(tile => ({
    tile,
    weight: TILE_WEIGHTS[getTileCategory(tile)] || 0.1
  }));
  
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let threshold = rand * totalWeight;
  
  for (const { tile, weight } of weighted) {
    threshold -= weight;
    if (threshold <= 0) return tile;
  }
  
  return validTiles[0];  // Fallback
}
```

### Spawn Point Generation

The player always starts at grid (0, 0) which is always a CROSSROADS:

```typescript
const SPAWN_TILE = TileType.CROSSROADS;
const SPAWN_GRID: GridCoord = { gx: 0, gy: 0 };
const SPAWN_POSITION: WorldCoord = {
  x: SPAWN_GRID.gx * TILE_SIZE + TILE_SIZE / 2,  // Center of tile
  y: SPAWN_GRID.gy * TILE_SIZE + TILE_SIZE / 2
};
```

---

## Road Collision & Boundaries

### Collision Strategy

Instead of traditional track spline collision, urban mode uses **rectangular road zones**:

```typescript
interface RoadZone {
  x: number;      // World X of zone top-left
  y: number;      // World Y of zone top-left
  width: number;  // Zone width
  height: number; // Zone height
}

// Each tile defines its driveable road zones
interface CityTile {
  type: TileType;
  edges: TileEdges;
  roadZones: RoadZone[];  // Areas where car can drive
}
```

### Road Zone Definitions

For each tile type, define the driveable areas:

```typescript
// Example: STRAIGHT_NS (North-South road)
const STRAIGHT_NS_ROADS: RoadZone[] = [
  {
    x: (TILE_SIZE - ROAD_WIDTH) / 2,  // Centered horizontally
    y: 0,
    width: ROAD_WIDTH,
    height: TILE_SIZE
  }
];

// Example: CROSSROADS (4-way intersection)
const CROSSROADS_ROADS: RoadZone[] = [
  // Vertical road
  {
    x: (TILE_SIZE - ROAD_WIDTH) / 2,
    y: 0,
    width: ROAD_WIDTH,
    height: TILE_SIZE
  },
  // Horizontal road
  {
    x: 0,
    y: (TILE_SIZE - ROAD_WIDTH) / 2,
    width: TILE_SIZE,
    height: ROAD_WIDTH
  }
];

// Example: CORNER_NE (North-East corner)
const CORNER_NE_ROADS: RoadZone[] = [
  // Vertical segment (North)
  {
    x: (TILE_SIZE - ROAD_WIDTH) / 2,
    y: 0,
    width: ROAD_WIDTH,
    height: TILE_SIZE / 2 + ROAD_WIDTH / 2
  },
  // Horizontal segment (East)
  {
    x: (TILE_SIZE - ROAD_WIDTH) / 2,
    y: (TILE_SIZE - ROAD_WIDTH) / 2,
    width: TILE_SIZE / 2 + ROAD_WIDTH / 2,
    height: ROAD_WIDTH
  }
];
```

### Collision Detection

Check if car is within any road zone:

```typescript
function isOnRoad(carPos: WorldCoord, loadedTiles: Map<string, CityTile>): boolean {
  // Find which tile the car is in
  const gridCoord = worldToGrid(carPos);
  const tileKey = `${gridCoord.gx},${gridCoord.gy}`;
  const tile = loadedTiles.get(tileKey);
  
  if (!tile) return false;  // No tile loaded = off road
  
  // Get local position within tile
  const localX = carPos.x - gridCoord.gx * TILE_SIZE;
  const localY = carPos.y - gridCoord.gy * TILE_SIZE;
  
  // Check each road zone
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
}
```

### Boundary Response

When car leaves road, apply resistance force:

```typescript
function applyRoadBoundary(car: CarState, loadedTiles: Map<string, CityTile>) {
  if (!isOnRoad({ x: car.x, y: car.y }, loadedTiles)) {
    // Find nearest road point
    const nearestRoad = findNearestRoadPoint(car, loadedTiles);
    
    // Apply strong resistance (like hitting a curb/wall)
    const pushDir = {
      x: nearestRoad.x - car.x,
      y: nearestRoad.y - car.y
    };
    const dist = Math.sqrt(pushDir.x ** 2 + pushDir.y ** 2);
    
    if (dist > 0) {
      // Normalize and apply push force
      const pushStrength = 0.5;  // Adjust for feel
      car.velocity.x += (pushDir.x / dist) * pushStrength;
      car.velocity.y += (pushDir.y / dist) * pushStrength;
      
      // Reduce speed (friction from curb)
      car.velocity.x *= 0.9;
      car.velocity.y *= 0.9;
    }
  }
}
```

---

## Placeholder Rendering System

### Color Palette

```typescript
const URBAN_COLORS = {
  // Roads
  ROAD_ASPHALT: '#4a4a4a',      // Dark gray road surface
  ROAD_MARKING_WHITE: '#ffffff', // Lane markings
  ROAD_MARKING_YELLOW: '#ffd700', // Center line
  
  // Sidewalks
  SIDEWALK: '#8b8b8b',          // Light gray concrete
  CURB: '#6b6b6b',              // Darker curb edge
  
  // Buildings (variety for visual interest)
  BUILDING_1: '#8b4513',        // Brown (brick)
  BUILDING_2: '#696969',        // Gray (concrete)
  BUILDING_3: '#2f4f4f',        // Dark slate (office)
  BUILDING_4: '#8b0000',        // Dark red (warehouse)
  BUILDING_5: '#556b2f',        // Olive (older building)
  
  // Environment
  GRASS: '#3d5c3d',             // Grass patches
  SHADOW: 'rgba(0,0,0,0.3)',    // Building shadows
  
  // Debug
  DEBUG_TILE_BORDER: '#ff00ff', // Magenta tile boundaries
  DEBUG_ROAD_ZONE: 'rgba(0,255,0,0.2)', // Green road zones
};
```

### Rendering Order (Back to Front)

```
1. Ground/Grass (base layer)
2. Road surfaces
3. Road markings (dashed lines, crosswalks)
4. Sidewalks
5. Building footprints
6. Building shadows (offset)
7. Debug overlays (if enabled)
```

### Tile Rendering Function

```typescript
function renderTile(
  ctx: CanvasRenderingContext2D,
  tile: CityTile,
  worldX: number,
  worldY: number
) {
  // 1. Base ground
  ctx.fillStyle = URBAN_COLORS.GRASS;
  ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
  
  // 2. Road surfaces
  ctx.fillStyle = URBAN_COLORS.ROAD_ASPHALT;
  for (const zone of tile.roadZones) {
    ctx.fillRect(
      worldX + zone.x,
      worldY + zone.y,
      zone.width,
      zone.height
    );
  }
  
  // 3. Road markings
  renderRoadMarkings(ctx, tile, worldX, worldY);
  
  // 4. Sidewalks
  renderSidewalks(ctx, tile, worldX, worldY);
  
  // 5. Buildings
  renderBuildings(ctx, tile, worldX, worldY);
}

function renderRoadMarkings(
  ctx: CanvasRenderingContext2D,
  tile: CityTile,
  worldX: number,
  worldY: number
) {
  ctx.strokeStyle = URBAN_COLORS.ROAD_MARKING_WHITE;
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 20]);
  
  // Draw center line for each road segment
  if (tile.edges.north === EdgeType.ROAD && tile.edges.south === EdgeType.ROAD) {
    // Vertical center line
    const centerX = worldX + TILE_SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(centerX, worldY);
    ctx.lineTo(centerX, worldY + TILE_SIZE);
    ctx.stroke();
  }
  
  if (tile.edges.east === EdgeType.ROAD && tile.edges.west === EdgeType.ROAD) {
    // Horizontal center line
    const centerY = worldY + TILE_SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(worldX, centerY);
    ctx.lineTo(worldX + TILE_SIZE, centerY);
    ctx.stroke();
  }
  
  ctx.setLineDash([]);
}

function renderSidewalks(
  ctx: CanvasRenderingContext2D,
  tile: CityTile,
  worldX: number,
  worldY: number
) {
  ctx.fillStyle = URBAN_COLORS.SIDEWALK;
  
  // Draw sidewalk strips along each road edge
  for (const zone of tile.roadZones) {
    // Top sidewalk
    ctx.fillRect(
      worldX + zone.x - SIDEWALK_WIDTH,
      worldY + zone.y,
      SIDEWALK_WIDTH,
      zone.height
    );
    // Bottom sidewalk
    ctx.fillRect(
      worldX + zone.x + zone.width,
      worldY + zone.y,
      SIDEWALK_WIDTH,
      zone.height
    );
  }
}

function renderBuildings(
  ctx: CanvasRenderingContext2D,
  tile: CityTile,
  worldX: number,
  worldY: number
) {
  // Generate building positions based on tile type
  const buildings = generateBuildingFootprints(tile);
  
  for (const building of buildings) {
    // Shadow
    ctx.fillStyle = URBAN_COLORS.SHADOW;
    ctx.fillRect(
      worldX + building.x + 5,
      worldY + building.y + 5,
      building.width,
      building.height
    );
    
    // Building
    ctx.fillStyle = building.color;
    ctx.fillRect(
      worldX + building.x,
      worldY + building.y,
      building.width,
      building.height
    );
    
    // Outline
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      worldX + building.x,
      worldY + building.y,
      building.width,
      building.height
    );
  }
}
```

### Building Footprint Generation

```typescript
interface BuildingFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

function generateBuildingFootprints(tile: CityTile): BuildingFootprint[] {
  const buildings: BuildingFootprint[] = [];
  const buildingColors = [
    URBAN_COLORS.BUILDING_1,
    URBAN_COLORS.BUILDING_2,
    URBAN_COLORS.BUILDING_3,
    URBAN_COLORS.BUILDING_4,
    URBAN_COLORS.BUILDING_5
  ];
  
  // Define quadrants that can have buildings
  const quadrants = [
    { x: 0, y: 0 },                                    // NW
    { x: TILE_SIZE / 2, y: 0 },                        // NE
    { x: 0, y: TILE_SIZE / 2 },                        // SW
    { x: TILE_SIZE / 2, y: TILE_SIZE / 2 }            // SE
  ];
  
  // Check each quadrant
  for (const quad of quadrants) {
    // Skip if quadrant overlaps with any road zone
    if (quadrantHasRoad(quad, tile.roadZones)) continue;
    
    // Generate 1-4 buildings in this quadrant
    const buildingCount = 1 + Math.floor(Math.random() * 3);
    const quadSize = TILE_SIZE / 2;
    
    for (let i = 0; i < buildingCount; i++) {
      const margin = BUILDING_MARGIN + SIDEWALK_WIDTH;
      const maxWidth = (quadSize - margin * 2) / 2;
      const maxHeight = (quadSize - margin * 2) / 2;
      
      buildings.push({
        x: quad.x + margin + (i % 2) * maxWidth,
        y: quad.y + margin + Math.floor(i / 2) * maxHeight,
        width: maxWidth - 10 + Math.random() * 10,
        height: maxHeight - 10 + Math.random() * 10,
        color: buildingColors[Math.floor(Math.random() * buildingColors.length)]
      });
    }
  }
  
  return buildings;
}
```

---

## Integration with Existing Systems

### New TrackType Enum Value

```typescript
// types.ts
export enum TrackType {
  LOOP = 'LOOP',
  INFINITE = 'INFINITE',
  URBAN = 'URBAN'  // NEW
}
```

### New Type Definitions

```typescript
// types.ts - Add these new interfaces

export enum TileType {
  DEAD_END_N = 'DEAD_END_N',
  DEAD_END_E = 'DEAD_END_E',
  DEAD_END_S = 'DEAD_END_S',
  DEAD_END_W = 'DEAD_END_W',
  STRAIGHT_NS = 'STRAIGHT_NS',
  STRAIGHT_EW = 'STRAIGHT_EW',
  CORNER_NE = 'CORNER_NE',
  CORNER_ES = 'CORNER_ES',
  CORNER_SW = 'CORNER_SW',
  CORNER_NW = 'CORNER_NW',
  T_JUNCTION_NES = 'T_JUNCTION_NES',
  T_JUNCTION_ESW = 'T_JUNCTION_ESW',
  T_JUNCTION_NSW = 'T_JUNCTION_NSW',
  T_JUNCTION_NEW = 'T_JUNCTION_NEW',
  CROSSROADS = 'CROSSROADS',
  EMPTY = 'EMPTY'
}

export enum EdgeType {
  ROAD = 'ROAD',
  BUILDING = 'BUILDING'
}

export interface TileEdges {
  north: EdgeType;
  east: EdgeType;
  south: EdgeType;
  west: EdgeType;
}

export interface RoadZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CityTile {
  type: TileType;
  edges: TileEdges;
  roadZones: RoadZone[];
  buildings: BuildingFootprint[];
}

export interface BuildingFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface UrbanWorldState {
  loadedTiles: Map<string, CityTile>;
  worldSeed: number;
  playerGridPos: { gx: number; gy: number };
}
```

### Track Service Addition

```typescript
// services/trackService.ts - Add Urban Freeroam track

export const TRACKS: TrackData[] = [
  // ... existing tracks ...
  
  // Urban Freeroam (ID 6)
  {
    id: 6,
    name: "Urban Freeroam",
    type: TrackType.URBAN,
    points: [{ x: 0, y: 0 }],  // Spawn point (center of grid 0,0)
    controlPoints: [],
    width: 200,  // ROAD_WIDTH
    lapsToWin: 999
  }
];
```

### GameEngine Modifications

The GameEngine.tsx needs modifications to handle URBAN track type:

```typescript
// In the main loop, add urban-specific logic:

if (track.type === TrackType.URBAN) {
  // Update loaded tiles based on car position
  updateLoadedTiles(car, urbanState, track);
  
  // Apply road boundary collision
  applyRoadBoundary(car, urbanState.loadedTiles);
  
  // Urban-specific rendering
  renderUrbanWorld(ctx, car, urbanState, canvas);
} else {
  // Existing LOOP and INFINITE logic
  // ...
}
```

---

## Implementation Steps

### Step 1: Create Urban Generator Service

**File:** `services/urbanGenerator.ts`

```typescript
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
  // ... define all other tile types ...
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
  const rand = () => seedRandom(gx + buildings.length, gy + buildings.length * 7, worldSeed);
  
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
```

### Step 2: Update Types

**File:** `types.ts` (add new content)

```typescript
// Add to existing TrackType enum:
export enum TrackType {
  LOOP = 'LOOP',
  INFINITE = 'INFINITE',
  URBAN = 'URBAN'  // NEW
}

// Add new interfaces for Urban mode:

export enum TileType {
  DEAD_END_N = 'DEAD_END_N',
  DEAD_END_E = 'DEAD_END_E',
  DEAD_END_S = 'DEAD_END_S',
  DEAD_END_W = 'DEAD_END_W',
  STRAIGHT_NS = 'STRAIGHT_NS',
  STRAIGHT_EW = 'STRAIGHT_EW',
  CORNER_NE = 'CORNER_NE',
  CORNER_ES = 'CORNER_ES',
  CORNER_SW = 'CORNER_SW',
  CORNER_NW = 'CORNER_NW',
  T_JUNCTION_NES = 'T_JUNCTION_NES',
  T_JUNCTION_ESW = 'T_JUNCTION_ESW',
  T_JUNCTION_NSW = 'T_JUNCTION_NSW',
  T_JUNCTION_NEW = 'T_JUNCTION_NEW',
  CROSSROADS = 'CROSSROADS',
  EMPTY = 'EMPTY'
}

export enum EdgeType {
  ROAD = 'ROAD',
  BUILDING = 'BUILDING'
}

export interface TileEdges {
  north: EdgeType;
  east: EdgeType;
  south: EdgeType;
  west: EdgeType;
}

export interface RoadZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BuildingFootprint {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface CityTile {
  type: TileType;
  edges: TileEdges;
  roadZones: RoadZone[];
  buildings: BuildingFootprint[];
}

export interface UrbanWorldState {
  loadedTiles: Map<string, CityTile>;
  worldSeed: number;
  playerGridPos: { gx: number; gy: number };
}
```

### Step 3: Update Track Service

**File:** `services/trackService.ts` (add new track)

```typescript
// Add to TRACKS array:
{
  id: 6,
  name: "Urban Freeroam",
  type: TrackType.URBAN,
  points: [{ x: 400, y: 400 }],  // Spawn at center of tile (0,0)
  controlPoints: [],
  width: 200,  // Road width
  lapsToWin: 999
}
```

### Step 4: Update GameEngine for Urban Mode

**File:** `components/GameEngine.tsx` (modifications)

```typescript
// Add imports at top:
import { 
  createUrbanWorldState, 
  updateLoadedTiles, 
  isPositionOnRoad, 
  findNearestRoadPosition,
  TILE_SIZE,
  ROAD_WIDTH
} from '../services/urbanGenerator';
import { UrbanWorldState, TrackType, CityTile } from '../types';

// Add urban state ref in component:
const urbanStateRef = useRef<UrbanWorldState | null>(null);

// Initialize urban state if track type is URBAN:
useEffect(() => {
  if (track.type === TrackType.URBAN) {
    urbanStateRef.current = createUrbanWorldState();
    // Set initial car position to center of spawn tile
    carRef.current.x = TILE_SIZE / 2;
    carRef.current.y = TILE_SIZE / 2;
  }
}, [track.type]);

// In the main loop, add urban-specific logic:

// After physics update, before rendering:
if (track.type === TrackType.URBAN && urbanStateRef.current) {
  const urbanState = urbanStateRef.current;
  
  // Update loaded tiles
  updateLoadedTiles(car.x, car.y, urbanState);
  
  // Road boundary collision
  if (!isPositionOnRoad(car.x, car.y, urbanState)) {
    const nearestRoad = findNearestRoadPosition(car.x, car.y, urbanState);
    const pushDir = {
      x: nearestRoad.x - car.x,
      y: nearestRoad.y - car.y
    };
    const dist = Math.sqrt(pushDir.x ** 2 + pushDir.y ** 2);
    
    if (dist > 1) {
      // Push car back toward road
      const pushStrength = 0.3;
      car.velocity.x += (pushDir.x / dist) * pushStrength;
      car.velocity.y += (pushDir.y / dist) * pushStrength;
      
      // Reduce speed (curb friction)
      car.velocity.x *= 0.85;
      car.velocity.y *= 0.85;
    }
  }
}

// In rendering section, add urban rendering:
if (track.type === TrackType.URBAN && urbanStateRef.current) {
  renderUrbanWorld(ctx, car, urbanStateRef.current, canvas);
} else {
  // Existing track rendering...
}
```

### Step 5: Add Urban Rendering Function

**Add to GameEngine.tsx:**

```typescript
const URBAN_COLORS = {
  ROAD_ASPHALT: '#4a4a4a',
  ROAD_MARKING_WHITE: '#ffffff',
  ROAD_MARKING_YELLOW: '#ffd700',
  SIDEWALK: '#8b8b8b',
  CURB: '#6b6b6b',
  GRASS: '#3d5c3d',
  SHADOW: 'rgba(0,0,0,0.3)'
};

const renderUrbanWorld = (
  ctx: CanvasRenderingContext2D,
  car: CarState,
  state: UrbanWorldState,
  canvas: HTMLCanvasElement
) => {
  // Clear with grass color
  ctx.fillStyle = URBAN_COLORS.GRASS;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Camera follow
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.translate(-car.x, -car.y);
  
  // Render all loaded tiles
  for (const [key, tile] of state.loadedTiles) {
    const [gx, gy] = key.split(',').map(Number);
    const worldX = gx * TILE_SIZE;
    const worldY = gy * TILE_SIZE;
    
    // Only render tiles visible on screen (optimization)
    const screenX = worldX - car.x + canvas.width / 2;
    const screenY = worldY - car.y + canvas.height / 2;
    if (
      screenX + TILE_SIZE < 0 || screenX > canvas.width ||
      screenY + TILE_SIZE < 0 || screenY > canvas.height
    ) continue;
    
    // Render tile
    renderUrbanTile(ctx, tile, worldX, worldY);
  }
  
  // Render car (same as existing car rendering code)
  renderCar(ctx, car);
  
  ctx.restore();
  
  // Render minimap
  renderUrbanMinimap(ctx, car, state, canvas);
};

const renderUrbanTile = (
  ctx: CanvasRenderingContext2D,
  tile: CityTile,
  worldX: number,
  worldY: number
) => {
  // 1. Road surfaces
  ctx.fillStyle = URBAN_COLORS.ROAD_ASPHALT;
  for (const zone of tile.roadZones) {
    ctx.fillRect(
      worldX + zone.x,
      worldY + zone.y,
      zone.width,
      zone.height
    );
    
    // Sidewalks on each side
    ctx.fillStyle = URBAN_COLORS.SIDEWALK;
    
    // Determine sidewalk placement based on zone orientation
    if (zone.height > zone.width) {
      // Vertical road - sidewalks on left and right
      ctx.fillRect(worldX + zone.x - 40, worldY + zone.y, 40, zone.height);
      ctx.fillRect(worldX + zone.x + zone.width, worldY + zone.y, 40, zone.height);
    } else {
      // Horizontal road - sidewalks on top and bottom
      ctx.fillRect(worldX + zone.x, worldY + zone.y - 40, zone.width, 40);
      ctx.fillRect(worldX + zone.x, worldY + zone.y + zone.height, zone.width, 40);
    }
    
    ctx.fillStyle = URBAN_COLORS.ROAD_ASPHALT;
  }
  
  // 2. Road markings
  ctx.strokeStyle = URBAN_COLORS.ROAD_MARKING_WHITE;
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 20]);
  
  for (const zone of tile.roadZones) {
    ctx.beginPath();
    if (zone.height > zone.width) {
      // Vertical road - vertical center line
      const centerX = worldX + zone.x + zone.width / 2;
      ctx.moveTo(centerX, worldY + zone.y);
      ctx.lineTo(centerX, worldY + zone.y + zone.height);
    } else {
      // Horizontal road - horizontal center line
      const centerY = worldY + zone.y + zone.height / 2;
      ctx.moveTo(worldX + zone.x, centerY);
      ctx.lineTo(worldX + zone.x + zone.width, centerY);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  
  // 3. Buildings
  for (const building of tile.buildings) {
    // Shadow
    ctx.fillStyle = URBAN_COLORS.SHADOW;
    ctx.fillRect(
      worldX + building.x + 5,
      worldY + building.y + 5,
      building.width,
      building.height
    );
    
    // Building
    ctx.fillStyle = building.color;
    ctx.fillRect(
      worldX + building.x,
      worldY + building.y,
      building.width,
      building.height
    );
    
    // Outline
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(
      worldX + building.x,
      worldY + building.y,
      building.width,
      building.height
    );
  }
  
  // Debug: tile borders (optional)
  // ctx.strokeStyle = '#ff00ff';
  // ctx.lineWidth = 1;
  // ctx.strokeRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
};

const renderUrbanMinimap = (
  ctx: CanvasRenderingContext2D,
  car: CarState,
  state: UrbanWorldState,
  canvas: HTMLCanvasElement
) => {
  const mapSize = 200;
  const mapX = canvas.width - mapSize - 20;
  const mapY = 20;
  const mapScale = mapSize / (TILE_SIZE * 5); // Show 5x5 tile area
  
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(mapX, mapY, mapSize, mapSize);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapSize, mapSize);
  
  // Center on car
  const centerX = mapX + mapSize / 2;
  const centerY = mapY + mapSize / 2;
  
  // Draw tiles
  for (const [key, tile] of state.loadedTiles) {
    const [gx, gy] = key.split(',').map(Number);
    const tileScreenX = centerX + (gx * TILE_SIZE - car.x) * mapScale;
    const tileScreenY = centerY + (gy * TILE_SIZE - car.y) * mapScale;
    
    // Roads
    ctx.fillStyle = '#666';
    for (const zone of tile.roadZones) {
      ctx.fillRect(
        tileScreenX + zone.x * mapScale,
        tileScreenY + zone.y * mapScale,
        zone.width * mapScale,
        zone.height * mapScale
      );
    }
  }
  
  // Draw car
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Car direction
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(car.angle) * 15,
    centerY + Math.sin(car.angle) * 15
  );
  ctx.stroke();
};
```

### Step 6: Update App.tsx Menu

The menu should automatically show "Urban Freeroam" when the track is added to trackService.ts. However, we may want to add distinctive styling:

```typescript
// In App.tsx, update the track card rendering:
<p className="text-xs text-gray-400 relative z-10">
  {track.type === TrackType.INFINITE 
    ? '∞ PROCEDURAL' 
    : track.type === TrackType.URBAN 
      ? '🏙️ OPEN WORLD' 
      : `${track.lapsToWin} LAPS • TECHNICAL`}
</p>
```

---

## Future Enhancements

### Phase 2: Visual Upgrades
- **PNG Textures** - Replace colored rectangles with actual road/building textures
- **Building Variety** - Different building shapes (L-shapes, skyscrapers, houses)
- **Props** - Streetlights, signs, benches, trash cans
- **Parallax Layers** - Distant skyline, clouds for depth

### Phase 3: Traffic System
- **AI Vehicles** - Procedural traffic following roads
- **Traffic Lights** - Intersection timing
- **Pedestrians** - Simple AI pedestrians on sidewalks
- **Parking** - Parked cars along streets

### Phase 4: Gameplay Features
- **Collectibles** - Coins/pickups scattered on roads
- **Challenges** - Time trials, checkpoint races
- **Police Chase** - Wanted system with pursuit AI
- **Leaderboards** - Distance traveled, top speed records

### Phase 5: World Variation
- **Districts** - Downtown (tall buildings), Suburbs (houses), Industrial (warehouses)
- **Day/Night Cycle** - Lighting changes, headlights
- **Weather** - Rain effects on traction, visual effects
- **Seasons** - Snow, autumn leaves

---

## Summary

This update adds a new **Urban Freeroam** mode featuring:

| Feature | Implementation |
|---------|----------------|
| Infinite City | Procedural tile generation using grid-based Wave Function Collapse |
| Road Network | 16 tile types covering all road configurations |
| Road Boundaries | Rectangular collision zones with bounce physics |
| Placeholder Graphics | Simple colored shapes for fast development |
| Menu Integration | Appears under existing track selection |
| Physics Reuse | Uses existing car handling from GameEngine |

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `services/urbanGenerator.ts` | CREATE | Tile definitions, generation, collision |
| `types.ts` | MODIFY | Add TrackType.URBAN, tile interfaces |
| `services/trackService.ts` | MODIFY | Add Urban Freeroam track entry |
| `components/GameEngine.tsx` | MODIFY | Add urban rendering and collision |
| `App.tsx` | MODIFY | Update menu labels (optional) |

---

*Document prepared for Rally Castrol Legends development team.*  
*Urban Freeroam Update - Phase 1 (Placeholder Graphics)*
