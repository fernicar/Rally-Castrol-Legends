# Rally-Legends: Endless-Touge Mode Implementation

## Overview

The **Endless-Touge** mode introduces a classic Japanese mountain road downhill racing experience. The track continuously generates tight S-bend hairpin sequences, mimicking the famous touge roads found in Japanese mountain passes.

### Key Characteristics

- **Vertical Descent**: Track always flows from top to bottom of screen (simulating downhill)
- **S-Bend Sequences**: 3-9 tight hairpin turns per sequence
- **Irregular Straights**: Variable-length sections between hairpin sequences
- **No Backtracking**: Road never turns upward (always progressing "downhill")
- **Realtime Generation**: Front of track above screen, tail below screen
- **Mountain Aesthetic**: Guardrails, cliff edges, and elevation visual cues

---

## Implementation Steps

### Step 1: Update Types (types.ts)

Add the new `TOUGE` track type to the enum:

```typescript
export enum TrackType {
  LOOP = 'LOOP',
  INFINITE = 'INFINITE',
  URBAN = 'URBAN',
  TOUGE = 'TOUGE'  // NEW: Endless downhill mountain road
}
```

---

### Step 2: Create Touge Generator Service (services/tougeGenerator.ts)

Create a new file `services/tougeGenerator.ts`:

```typescript
import { Point } from '../types';

/**
 * Touge Generation State Machine
 * 
 * The touge track generates in a specific pattern:
 * 1. Straight descent section (variable length)
 * 2. S-bend hairpin sequence (3-9 alternating turns)
 * 3. Repeat
 * 
 * The track always descends (positive Y direction in screen space)
 * and never turns back upward.
 */

export interface TougeGenState {
  // Current generation phase
  phase: 'DESCENT' | 'HAIRPIN_SEQUENCE';
  
  // Descent state
  descentRemaining: number;  // Segments left in current descent
  
  // Hairpin sequence state
  hairpinsInSequence: number;     // Total hairpins planned (3-9)
  hairpinsCompleted: number;      // Hairpins completed in current sequence
  currentHairpinDirection: -1 | 1; // -1 = left, 1 = right
  hairpinProgress: number;        // 0-1 progress through current hairpin
  
  // Track angle (always generally downward)
  currentAngle: number;  // Radians, π/2 = straight down
  
  // Curvature for smooth transitions
  targetCurvature: number;
  currentCurvature: number;
}

// Constants for touge generation
export const TOUGE_CONFIG = {
  // Segment length in pixels
  SEGMENT_LENGTH: 50,
  
  // Descent (straight) section parameters
  DESCENT_MIN_SEGMENTS: 15,
  DESCENT_MAX_SEGMENTS: 40,
  DESCENT_WOBBLE: 0.03,  // Slight variation to feel natural
  
  // Hairpin parameters
  HAIRPIN_MIN_COUNT: 3,
  HAIRPIN_MAX_COUNT: 9,
  HAIRPIN_SEGMENTS: 25,        // Segments per hairpin turn
  HAIRPIN_ANGLE: Math.PI * 0.85, // How sharp the turn is (~153 degrees)
  HAIRPIN_TRANSITION: 8,       // Segments to transition into/out of turn
  
  // Angle constraints (keep track going "downhill")
  ANGLE_CENTER: Math.PI / 2,   // Straight down
  ANGLE_MAX_DEVIATION: Math.PI / 3,  // Max 60 degrees from vertical
  
  // Road width (wider for touge)
  ROAD_WIDTH: 280,
  
  // Visual: Guardrail spacing
  GUARDRAIL_POST_SPACING: 100,
};

/**
 * Create initial touge generation state
 */
export function createTougeGenState(): TougeGenState {
  return {
    phase: 'DESCENT',
    descentRemaining: randomRange(TOUGE_CONFIG.DESCENT_MIN_SEGMENTS, TOUGE_CONFIG.DESCENT_MAX_SEGMENTS),
    hairpinsInSequence: 0,
    hairpinsCompleted: 0,
    currentHairpinDirection: Math.random() > 0.5 ? 1 : -1,
    hairpinProgress: 0,
    currentAngle: Math.PI / 2, // Start heading straight down
    targetCurvature: 0,
    currentCurvature: 0,
  };
}

/**
 * Generate the next track segment for touge mode
 */
export function generateTougeSegment(
  lastPoint: Point,
  state: TougeGenState
): { point: Point; state: TougeGenState } {
  const newState = { ...state };
  let angle = state.currentAngle;
  
  if (state.phase === 'DESCENT') {
    // === DESCENT PHASE ===
    // Mostly straight with slight natural wobble
    
    newState.descentRemaining--;
    
    // Add slight random wobble for natural feel
    const wobble = (Math.random() - 0.5) * TOUGE_CONFIG.DESCENT_WOBBLE;
    angle += wobble;
    
    // Gradually return toward center if we've drifted
    const deviation = angle - TOUGE_CONFIG.ANGLE_CENTER;
    angle -= deviation * 0.05;
    
    // Check if descent is complete
    if (newState.descentRemaining <= 0) {
      // Transition to hairpin sequence
      newState.phase = 'HAIRPIN_SEQUENCE';
      newState.hairpinsInSequence = randomRange(
        TOUGE_CONFIG.HAIRPIN_MIN_COUNT,
        TOUGE_CONFIG.HAIRPIN_MAX_COUNT
      );
      newState.hairpinsCompleted = 0;
      newState.hairpinProgress = 0;
      // Alternate starting direction randomly, but consider current angle
      newState.currentHairpinDirection = angle > TOUGE_CONFIG.ANGLE_CENTER ? -1 : 1;
    }
    
  } else {
    // === HAIRPIN SEQUENCE PHASE ===
    
    newState.hairpinProgress++;
    
    const segmentsPerHairpin = TOUGE_CONFIG.HAIRPIN_SEGMENTS;
    const transitionSegs = TOUGE_CONFIG.HAIRPIN_TRANSITION;
    
    if (newState.hairpinProgress <= transitionSegs) {
      // Entry transition: ease into turn
      const t = newState.hairpinProgress / transitionSegs;
      const easeT = easeInOutCubic(t);
      newState.targetCurvature = newState.currentHairpinDirection * 
        (TOUGE_CONFIG.HAIRPIN_ANGLE / segmentsPerHairpin) * easeT;
    } else if (newState.hairpinProgress <= segmentsPerHairpin - transitionSegs) {
      // Full turn
      newState.targetCurvature = newState.currentHairpinDirection * 
        (TOUGE_CONFIG.HAIRPIN_ANGLE / segmentsPerHairpin);
    } else if (newState.hairpinProgress <= segmentsPerHairpin) {
      // Exit transition: ease out of turn
      const remaining = segmentsPerHairpin - newState.hairpinProgress;
      const t = remaining / transitionSegs;
      const easeT = easeInOutCubic(t);
      newState.targetCurvature = newState.currentHairpinDirection * 
        (TOUGE_CONFIG.HAIRPIN_ANGLE / segmentsPerHairpin) * easeT;
    }
    
    // Smooth curvature transition
    newState.currentCurvature += (newState.targetCurvature - newState.currentCurvature) * 0.3;
    angle += newState.currentCurvature;
    
    // Complete hairpin?
    if (newState.hairpinProgress >= segmentsPerHairpin) {
      newState.hairpinsCompleted++;
      newState.hairpinProgress = 0;
      newState.currentHairpinDirection *= -1; // Alternate direction for S-bend
      
      // Complete sequence?
      if (newState.hairpinsCompleted >= newState.hairpinsInSequence) {
        newState.phase = 'DESCENT';
        newState.descentRemaining = randomRange(
          TOUGE_CONFIG.DESCENT_MIN_SEGMENTS,
          TOUGE_CONFIG.DESCENT_MAX_SEGMENTS
        );
        newState.targetCurvature = 0;
        newState.currentCurvature = 0;
      }
    }
  }
  
  // Clamp angle to prevent track from going "uphill"
  angle = clampAngle(angle);
  newState.currentAngle = angle;
  
  // Generate new point
  const newPoint: Point = {
    x: lastPoint.x + Math.cos(angle) * TOUGE_CONFIG.SEGMENT_LENGTH,
    y: lastPoint.y + Math.sin(angle) * TOUGE_CONFIG.SEGMENT_LENGTH,
  };
  
  return { point: newPoint, state: newState };
}

/**
 * Clamp angle to valid touge range (always heading "downward")
 */
function clampAngle(angle: number): number {
  const minAngle = TOUGE_CONFIG.ANGLE_CENTER - TOUGE_CONFIG.ANGLE_MAX_DEVIATION;
  const maxAngle = TOUGE_CONFIG.ANGLE_CENTER + TOUGE_CONFIG.ANGLE_MAX_DEVIATION;
  return Math.max(minAngle, Math.min(maxAngle, angle));
}

/**
 * Random integer in range [min, max]
 */
function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Cubic ease in/out for smooth transitions
 */
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Generate initial touge track points (starting line)
 * Creates a lead-in section heading downward
 */
export function generateInitialTougePoints(): Point[] {
  const points: Point[] = [];
  const startX = 400; // Start centered-ish
  const startY = -500; // Start above screen
  
  // Generate initial descent
  for (let i = 0; i < 30; i++) {
    points.push({
      x: startX + (Math.random() - 0.5) * 10, // Slight wobble
      y: startY + i * TOUGE_CONFIG.SEGMENT_LENGTH,
    });
  }
  
  return points;
}
```

---

### Step 3: Update Track Service (services/trackService.ts)

Add the Touge track entry:

```typescript
// Add import at top
import { TrackData, TrackType, Point } from '../types';

// ... existing code ...

// Add new track entry to TRACKS array (after Urban Freeroam):
{ 
  id: 7, 
  name: "Endless Touge", 
  type: TrackType.TOUGE, 
  points: [
    { x: 400, y: -500 }, 
    { x: 400, y: -450 }, 
    { x: 400, y: -400 }, 
    { x: 400, y: -350 }, 
    { x: 400, y: -300 },
    { x: 400, y: -250 },
    { x: 400, y: -200 },
    { x: 400, y: -150 },
    { x: 400, y: -100 },
    { x: 400, y: -50 },
    { x: 400, y: 0 },
    { x: 400, y: 50 },
    { x: 400, y: 100 },
  ], 
  controlPoints: [], 
  width: 280, 
  lapsToWin: 999 
},
```

---

### Step 4: Update GameEngine.tsx

The GameEngine needs significant updates to handle the Touge track type. Here are the key changes:

#### 4.1 Add Imports

```typescript
import {
  createTougeGenState,
  generateTougeSegment,
  TougeGenState,
  TOUGE_CONFIG
} from '../services/tougeGenerator';
```

#### 4.2 Update Initial Position Logic

```typescript
const initialPos = track.type === TrackType.URBAN
  ? { x: TILE_SIZE / 2, y: TILE_SIZE / 2 }
  : track.type === TrackType.TOUGE
    ? { x: track.points[5]?.x || 400, y: track.points[5]?.y || 0 } // Start mid-track
    : { x: track.points[1]?.x || 0, y: track.points[1]?.y || 0 };
```

#### 4.3 Update Initial Car Angle

```typescript
// In carRef initial state, set angle based on track type:
angle: track.type === TrackType.TOUGE ? Math.PI / 2 : 0, // Touge faces down
```

#### 4.4 Add Touge State to gameStateRef

```typescript
const gameStateRef = useRef({
  // ... existing properties ...
  
  // Touge Gen State (for TOUGE mode)
  tougeState: track.type === TrackType.TOUGE ? createTougeGenState() : null,
  
  // Distance traveled (for scoring in Touge mode)
  distanceTraveled: 0,
});
```

#### 4.5 Add Touge Generation Logic in Main Loop

Inside the main loop, add a new section for `TrackType.TOUGE`:

```typescript
if (track.type === TrackType.TOUGE && state.tougeState) {
  const tougeState = state.tougeState;
  const lastP = state.trackPoints[state.trackPoints.length - 1];
  const distToEnd = Math.sqrt((car.x - lastP.x) ** 2 + (car.y - lastP.y) ** 2);
  
  // Generate new track ahead (when car is within 3000px of end)
  while (distToEnd < 3000 || state.trackPoints.length < 100) {
    const lastPoint = state.trackPoints[state.trackPoints.length - 1];
    const result = generateTougeSegment(lastPoint, tougeState);
    state.trackPoints.push(result.point);
    state.tougeState = result.state;
    
    // Safety: don't generate infinite in one frame
    if (state.trackPoints.length > 500) break;
  }
  
  // Remove old track points (behind the car)
  const firstP = state.trackPoints[0];
  const distFromStart = Math.sqrt((car.x - firstP.x) ** 2 + (car.y - firstP.y) ** 2);
  
  if (state.trackPoints.length > 300 && distFromStart > 2000) {
    const p0 = state.trackPoints[0];
    const p1 = state.trackPoints[1];
    const dist = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
    
    state.dashOffset = (state.dashOffset + dist) % 40;
    state.trackPoints.shift();
    state.lastCheckpointIndex = Math.max(0, state.lastCheckpointIndex - 1);
    state.distanceTraveled += dist;
  }
  
  // Update checkpoint progress (find closest point ahead)
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < 50; i++) {
    const idx = state.lastCheckpointIndex + i;
    if (idx >= state.trackPoints.length) break;
    const p = state.trackPoints[idx];
    const d = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  }
  
  if (bestIdx > state.lastCheckpointIndex) {
    state.lastCheckpointIndex = bestIdx;
  }
}
```

#### 4.6 Add Touge Visual Rendering

Add new rendering for the mountain road aesthetic:

```typescript
// Inside rendering section, after standard track rendering:

if (track.type === TrackType.TOUGE) {
  // === TOUGE MOUNTAIN ROAD RENDERING ===
  
  const TOUGE_COLORS = {
    CLIFF_DARK: '#2a1a0a',
    CLIFF_LIGHT: '#4a3a2a',
    GUARDRAIL: '#cccccc',
    GUARDRAIL_POST: '#888888',
    ROAD_ASPHALT: '#3a3a3a',
    ROAD_EDGE: '#222222',
    CENTER_LINE: '#ffff00',
    SHADOW: 'rgba(0,0,0,0.4)',
  };
  
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const drawPoints = state.trackPoints;
  
  // 1. Outer cliff/mountain edge (left side - "cliff" side)
  ctx.lineWidth = track.width + 120;
  ctx.strokeStyle = TOUGE_COLORS.CLIFF_DARK;
  ctx.beginPath();
  ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
  for (let i = 1; i < drawPoints.length; i++) {
    ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
  }
  ctx.stroke();
  
  // 2. Inner mountain edge (right side - "mountain" side)
  ctx.lineWidth = track.width + 80;
  ctx.strokeStyle = TOUGE_COLORS.CLIFF_LIGHT;
  ctx.stroke();
  
  // 3. Road shoulder
  ctx.lineWidth = track.width + 30;
  ctx.strokeStyle = TOUGE_COLORS.ROAD_EDGE;
  ctx.stroke();
  
  // 4. Road surface
  ctx.lineWidth = track.width;
  ctx.strokeStyle = TOUGE_COLORS.ROAD_ASPHALT;
  ctx.stroke();
  
  // 5. Center line (yellow dashed)
  ctx.lineWidth = 4;
  ctx.strokeStyle = TOUGE_COLORS.CENTER_LINE;
  ctx.setLineDash([15, 25]);
  ctx.lineDashOffset = -state.dashOffset;
  ctx.beginPath();
  ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
  for (let i = 1; i < drawPoints.length; i++) {
    ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  
  // 6. Guardrails (on cliff side)
  ctx.strokeStyle = TOUGE_COLORS.GUARDRAIL;
  ctx.lineWidth = 6;
  
  // Calculate offset points for guardrail
  for (let i = 1; i < drawPoints.length - 1; i++) {
    const p = drawPoints[i];
    const prev = drawPoints[i - 1];
    const next = drawPoints[i + 1];
    
    // Calculate perpendicular direction
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    
    // Perpendicular (left side = cliff side)
    const perpX = -dy / len;
    const perpY = dx / len;
    
    // Guardrail offset
    const offset = track.width / 2 + 15;
    
    // Draw guardrail posts every GUARDRAIL_POST_SPACING pixels
    if (i % Math.floor(TOUGE_CONFIG.GUARDRAIL_POST_SPACING / TOUGE_CONFIG.SEGMENT_LENGTH) === 0) {
      ctx.fillStyle = TOUGE_COLORS.GUARDRAIL_POST;
      const postX = p.x + perpX * offset;
      const postY = p.y + perpY * offset;
      ctx.fillRect(postX - 3, postY - 3, 6, 6);
    }
  }
  
  // Draw continuous guardrail line
  ctx.beginPath();
  for (let i = 1; i < drawPoints.length - 1; i++) {
    const p = drawPoints[i];
    const prev = drawPoints[i - 1];
    const next = drawPoints[i + 1];
    
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) continue;
    
    const perpX = -dy / len;
    const perpY = dx / len;
    const offset = track.width / 2 + 15;
    
    const gx = p.x + perpX * offset;
    const gy = p.y + perpY * offset;
    
    if (i === 1) {
      ctx.moveTo(gx, gy);
    } else {
      ctx.lineTo(gx, gy);
    }
  }
  ctx.stroke();
}
```

#### 4.7 Update HUD for Touge Mode

```typescript
// In HUD rendering section:
{track.type === TrackType.TOUGE && (
  <div className="bg-black/50 p-2 rounded border-l-4 border-blue-500">
    <span className="text-gray-400 text-sm">DISTANCE</span><br/>
    {Math.floor(state.distanceTraveled / 10)} <span className="text-xs">M</span>
  </div>
)}
```

---

### Step 5: Update App.tsx Menu

Update the track selection display:

```typescript
<p className="text-xs text-gray-400 relative z-10">
  {track.type === TrackType.INFINITE
    ? '∞ PROCEDURAL'
    : track.type === TrackType.URBAN
      ? '🏙️ OPEN WORLD'
      : track.type === TrackType.TOUGE
        ? '⛰️ DOWNHILL TOUGE'
        : `${track.lapsToWin} LAPS • TECHNICAL`}
</p>
```

---

## Complete File Changes Summary

### Files to Modify:
1. **types.ts** - Add `TOUGE` to `TrackType` enum
2. **services/trackService.ts** - Add Endless Touge track entry
3. **components/GameEngine.tsx** - Add Touge generation, rendering, and HUD
4. **App.tsx** - Add Touge track type display in menu

### Files to Create:
1. **services/tougeGenerator.ts** - New Touge track generation service

---

## Algorithm Explanation

### Touge Generation State Machine

```
┌─────────────┐    descent complete    ┌───────────────────┐
│   DESCENT   │ ────────────────────▶  │ HAIRPIN_SEQUENCE │
│ (straight)  │ ◀──────────────────── │  (S-bend turns)   │
└─────────────┘    sequence complete   └───────────────────┘
```

**DESCENT Phase:**
- Generates mostly straight track heading downward
- Adds slight natural wobble for realism
- Length: 15-40 segments (750-2000 pixels)

**HAIRPIN_SEQUENCE Phase:**
- Generates 3-9 alternating tight turns
- Each hairpin is ~25 segments with smooth entry/exit
- Turns alternate left-right creating S-bend pattern
- Turn angle: ~153 degrees (tight hairpin)

### Visual Hierarchy

```
Layer 1: Cliff edge (dark brown) - Outer
Layer 2: Mountain edge (light brown)
Layer 3: Road shoulder (dark gray)
Layer 4: Road surface (asphalt gray)
Layer 5: Center line (yellow dashed)
Layer 6: Guardrails (white/silver posts and rail)
```

---

## Testing Checklist

- [ ] Track generates continuously as player descends
- [ ] Track never turns "uphill" (always progresses downward)
- [ ] S-bend hairpin sequences feel challenging but fair
- [ ] Guardrails render correctly on cliff side
- [ ] Old track segments are cleaned up properly
- [ ] Distance counter increments correctly
- [ ] Minimap shows correct track preview
- [ ] No memory leaks from infinite generation

---

## Future Enhancements

1. **Elevation Visual Effects**: Add gradient shading to simulate slope
2. **Scenic Elements**: Trees, rocks, tunnels along the route
3. **Speed Sections**: Longer straights with speed trap scoring
4. **Weather Effects**: Rain, fog for increased difficulty
5. **Rival Ghost**: Race against AI or ghost replay
6. **Scoring System**: Points for clean driving, drift sections
