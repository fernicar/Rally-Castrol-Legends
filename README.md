# Rally Castrol Legends
<img width="1326" height="759" alt="image" src="https://github.com/user-attachments/assets/824ac2e1-ac51-49d0-a514-1c061d86415b" />

## Description

**Rally Castrol Legends** is a top-down, physics-based rally racing game built with React and the HTML5 Canvas API. Unlike simple arcade racers, this engine implements a vector-based drift physics model that simulates grip, inertia, and surface friction (asphalt vs. off-road).

The game features a classic rally car sporting the iconic Castrol livery (white, red, green), capable of racing on pre-defined loop tracks or a procedurally generated infinite track. It includes a robust developer ecosystem with a built-in track editor and a real-time physics tuning menu.

## Functionality

### Game Modes
1.  **Menu**: A visual entry screen allowing track selection.
2.  **Racing**: The core gameplay loop where the user drives the car to complete laps or survive the infinite mode.
3.  **Finished**: A summary screen displaying the result (Win/Time) with options to Retry or return to Menu.
4.  **Editor**: A visual tool to manipulate track control points (available in Debug mode).

### Core Features
*   **Physics Engine**: Custom 2D rigid body physics handling velocity, acceleration, drag, surface friction, and "drifting" (separation of facing angle vs. velocity vector).
*   **Track System**: Supports closed loops (lap-based) and infinite procedural generation.
*   **Off-Road Detection**: The car slows down and loses grip when leaving the track width.
*   **Camera System**: Smoothly follows the player car, centering it on the screen.
*   **Debug/Tuning**: A slide-out panel to adjust physics variables (grip, speed, steer rate) in real-time.

### Controls
*   **W / Up Arrow**: Accelerate
*   **S / Down Arrow**: Brake / Reverse
*   **A / Left Arrow**: Steer Left
*   **D / Right Arrow**: Steer Right
*   **Space**: Handbrake / Drift initiation
*   **Esc**: Return to Menu (during race)
*   **Debug Toggle**: Button in top-right to toggle Debug Menu.

## User Interface

### Main Menu
*   **Background**: Dark, blurred, rally-themed imagery.
*   **Title**: Large typography. "RALLY" (White), "CASTROL" (Red), "LEGENDS" (Green).
*   **Track Selection**: A grid of cards displaying track names and types (e.g., "2 LAPS • TECHNICAL" or "∞ PROCEDURAL").
*   **Edit Button**: Appears on track cards when Debug Mode is active.

### Heads Up Display (HUD)
*   **Top Left**:
    *   **Time**: `MM:SS.ms` format.
    *   **Lap**: Current / Total (hidden in Infinite mode).
    *   **Speed**: Current speed in KM/H (derived from pixel velocity).
*   **Mini-Map**: Top right. Displays the full track geometry and a dot representing the player.
*   **Controls Overlay**: Bottom right, semi-transparent text listing key bindings.

### Debug Menu
A translucent sidebar (glassmorphism effect) on the right containing sliders for:
*   **Visuals**: Car Scale.
*   **Movement**: Max Speed, Acceleration, Brake Power.
*   **Steering**: Steer Speed, Steer Return, Max Angle.
*   **Physics**: Cornering Stiffness (Grip), Surface Friction, Offroad Drag.
*   **I/O**: Buttons to Export/Import JSON configs for Tracks and Tuning.

## Technical Implementation

### Architecture
*   **Framework**: React (Functional Components, Hooks).
*   **Rendering**: HTML5 `<canvas>` via `requestAnimationFrame`. No external game libraries (like Phaser) allowed; raw Context2D calls only.
*   **State Management**: `useRef` for high-frequency game loop data (physics, car position), `useState` for UI and Game Modes.

### Game Loop & Physics Algorithms

The physics update must run every frame.

#### 1. Car Physics Model
The car is defined by:
*   `Position (x, y)`
*   `Velocity (vx, vy)`
*   `Angle` (Facing direction in radians)
*   `SteeringAngle` (Current wheel turn)

**Update Logic:**
1.  **Steering Input**: Increment/decrement `SteeringAngle` based on input, clamped to `maxSteerAngle`. If no input, linearly decay `SteeringAngle` to 0 based on `steerReturn`.
2.  **Engine Force**: Apply acceleration vector based on `Angle` if throttle is pressed. Apply braking force against velocity if braking.
3.  **Friction**: Apply global friction (multiply velocity by `1 - friction`).
4.  **Off-Road**: Check distance from track center spline. If `distance > trackWidth / 2`, use `offRoadFriction` (higher drag) instead of standard friction.
5.  **Drift / Cornering**:
    *   Calculate `VelocityAngle` (`atan2(vy, vx)`).
    *   Calculate `Diff` between `Angle` and `VelocityAngle`.
    *   Adjust velocity vector towards `Angle` by `corneringStiffness`.
    *   *Note*: Low stiffness results in the car "sliding" (velocity vector changing direction slower than the car rotates).

#### 2. Track Generation (Splines)
Tracks are defined by a set of **Control Points**.
*   **Algorithm**: Catmull-Rom Spline interpolation.
*   **Resolution**: Generate ~20 interpolated points between each control point to create smooth curves.
*   **Looping**: Connect the last control point back to the first.
*   **Infinite Mode**:
    *   Start with a straight segment.
    *   Procedurally append points to the array as the car advances.
    *   Remove points behind the car to conserve memory.
    *   Use a state machine to alternate between "Straight" sections and "Curved" sections (randomized curvature).

### Rendering Details (Canvas)

#### The Track
1.  **Border**: Draw the generated spline points with a thick line (`width + 20`). Color: `#5c4e38` (Dirt/Gravel).
2.  **Surface**: Draw the same points with `width`. Color: `#808080` (Asphalt).
3.  **Center Line**: White dashed line (`context.setLineDash`). In infinite mode, animate the `lineDashOffset` to prevent visual "crawling" as points are removed.

#### The Car (Procedural Graphics)
Do not use sprite images. The car must be drawn using Canvas primitives (`rect`, `moveTo`, `quadraticCurveTo`) to resemble a **Toyota Celica GT-Four**.

*   **Body**: White base.
*   **Livery**: Red (`#d40000`) and Green (`#00853f`) swooshes/stripes on the sides.
*   **Details**:
    *   Black wheels (rotating based on steering angle).
    *   Rear spoiler (White with red tips).
    *   Brake lights (Red, glow when braking).
    *   Windshield (Dark Blue/Grey).
    *   Drop shadow beneath the car.

### Track Editor
*   **Interaction**:
    *   Left Click & Drag: Move control points.
    *   Right Click / Middle Click: Pan camera.
    *   Scroll: Zoom.
*   **Visuals**: Render the track line, grid background, and visible handles for control points.

## Data Structures

### Tuning Configuration
The application must use a configuration object for physics tuning. Default values:

```typescript
interface TuningConfig {
  maxSpeed: number;          // Default: 18
  acceleration: number;      // Default: 0.3
  reversePower: number;      // Default: 0.15
  brakePower: number;        // Default: 0.6
  friction: number;          // Default: 0.02 (Surface resistance)
  drag: number;              // Default: 0.005 (Air resistance)
  maxSteerAngle: number;     // Default: 0.6 (Radians)
  steerSpeed: number;        // Default: 0.08
  steerReturn: number;       // Default: 0.1
  corneringStiffness: number;// Default: 0.12 (Lower = More Drift)
  offRoadFriction: number;   // Default: 0.15
  carScale: number;          // Default: 4
}
```

### Track Data
```typescript
enum TrackType { LOOP, INFINITE }

interface Point { x: number; y: number; }

interface TrackData {
  id: number;
  name: string;
  type: TrackType;
  points: Point[];        // Generated spline points
  controlPoints: Point[]; // User-editable nodes
  width: number;          // Default: 300
  lapsToWin: number;
}
```

## Assets & Style Guide

*   **Color Palette**:
    *   Primary Red: `#d40000`
    *   Primary Green: `#00853f`
    *   Asphalt: `#808080`
    *   Dirt/Grass Background: `#2d3728`
    *   UI Backgrounds: `rgba(0, 0, 0, 0.8)` with backdrop blur.

*   **Typography**:
    *   System fonts (`Segoe UI`, `Roboto`, sans-serif).
    *   Headers should be bold, italicized to imply speed.

## Initial Content

The game must initialize with these 4 tracks:
1.  **Speedway Oval**: Simple oval loop.
2.  **Figure Eight**: A track that crosses over itself (logic must handle the crossover without collision errors, purely 2D).
3.  **Kidney Park**: A technical track with varying curve tightness.
4.  **Hairpin Valley**: A difficult track with sharp 180-degree turns.
5.  **Endless Rally**: Infinite procedural mode.

<!-- ZS:COMPLEXITY:HIGH -->
<!-- ZS:PRIORITY:HIGH -->
<!-- ZS:PLATFORM:WEB -->
<!-- ZS:LANGUAGE:TYPESCRIPT -->
<!-- ZS:FRAMEWORK:REACT -->
# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Cs60NqdLY1xB49cUYyBpYMdeFBbmx3jw

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

[LICENSE](LICENSE)
