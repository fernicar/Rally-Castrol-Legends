# Rally Legends: Realistic Handling System Enhancement Plan

> **Document Version:** 1.0  
> **Date:** December 2025  
> **Reference:** GTA V handling.meta (Mazda FC3S RX7 Drift Spec)  
> **Target:** 2D Top-Down Rally Racing Game

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Reference Parameter Mapping](#reference-parameter-mapping)
4. [Phase 1: Core Physics Foundation](#phase-1-core-physics-foundation)
5. [Phase 2: Tire & Traction Model](#phase-2-tire--traction-model)
6. [Phase 3: Drivetrain & Braking System](#phase-3-drivetrain--braking-system)
7. [Phase 4: Advanced Handling Dynamics](#phase-4-advanced-handling-dynamics)
8. [Phase 5: Preset System & Community Features](#phase-5-preset-system--community-features)
9. [Implementation Details](#implementation-details)
10. [Default Presets](#default-presets)
11. [Migration Guide](#migration-guide)

---

## Executive Summary

This document outlines a comprehensive enhancement plan for the Rally Castrol Legends handling system. By analyzing AAA handling implementations (specifically GTA V's `handling.meta` format), we will adapt and translate 3D vehicle physics concepts into our 2D top-down context, exposing new parameters that enable emergent gameplay and community-driven preset discovery.

### Goals

- **Expand tunable parameters** from ~13 to 35+ meaningful values
- **Enable three distinct driving styles**: Track (grip), Rally (balanced), Drift (slip)
- **Create emergent handling characteristics** through parameter interaction
- **Support community preset sharing** via JSON export/import
- **Maintain backward compatibility** with existing tuning configs

---

## Current System Analysis

### Existing Parameters (TuningConfig)

```typescript
interface TuningConfig {
  // Movement (5 params)
  maxSpeed: number;           // Top speed cap
  acceleration: number;       // Engine force
  reversePower: number;       // Reverse thrust
  brakePower: number;         // Brake deceleration
  friction: number;           // Surface rolling resistance
  drag: number;               // Air resistance
  
  // Steering (3 params)
  maxSteerAngle: number;      // Maximum wheel angle (radians)
  steerSpeed: number;         // Wheel turn rate
  steerReturn: number;        // Wheel center rate
  
  // Physics (2 params)
  corneringStiffness: number; // Single grip/drift value
  offRoadFriction: number;    // Increased resistance off-track
  
  // Visual (2 params)
  cameraSmoothness: number;
  carScale: number;
}
```

### Current Physics Implementation

```
1. Steering Input → steeringAngle (clamped to maxSteerAngle)
2. Engine Input → Force applied in car.angle direction
3. Position Update: car += velocity
4. Friction/Drag: velocity *= (1 - friction) * (1 - drag)
5. Angular Physics:
   - car.angle += steeringAngle * (speed/maxSpeed) * 0.5
   - velocityAngle lerps toward car.angle by corneringStiffness
```

### Limitations

| Current Behavior | Missing Realism |
|------------------|-----------------|
| Single grip value | No front/rear balance |
| Instant power delivery | No drivetrain inertia |
| Linear friction | No slip angle dynamics |
| No mass simulation | No momentum/weight transfer |
| Uniform braking | No brake bias effects |
| Binary handbrake | No progressive rear slip |

---

## Reference Parameter Mapping

### GTA V handling.meta → 2D Translation

| GTA V Parameter | Value (FC3S) | 2D Equivalent | Notes |
|-----------------|--------------|---------------|-------|
| **Mass & Inertia** ||||
| `fMass` | 1150.0 | `mass` | Affects acceleration, momentum |
| `vecInertiaMultiplier` | (1.2, 1.4, 2.0) | `inertiaMultiplier` | Z-axis = rotation resistance |
| `vecCentreOfMassOffset` | (0, -0.1, -0.1) | `centerOfMassOffset` | Y-axis = front/rear bias |
| **Drivetrain** ||||
| `fDriveBiasFront` | 0.0 | `driveBiasFront` | 0=RWD, 0.5=AWD, 1=FWD |
| `fInitialDriveForce` | 1.55 | `enginePower` | Acceleration force |
| `fDriveInertia` | 0.9 | `driveInertia` | Flywheel/engine momentum |
| `fInitialDriveMaxFlatVel` | 220.0 | `maxSpeed` | Top speed (km/h) |
| **Braking** ||||
| `fBrakeForce` | 1.0 | `brakeForce` | Brake strength |
| `fBrakeBiasFront` | 0.6 | `brakeBiasFront` | Front brake distribution |
| `fHandBrakeForce` | 0.9 | `handbrakePower` | Handbrake strength |
| **Steering** ||||
| `fSteeringLock` | 65.0 | `maxSteerAngle` | Max wheel angle (degrees) |
| **Traction** ||||
| `fTractionCurveMax` | 0.97 | `tractionPeak` | Peak grip before slip |
| `fTractionCurveMin` | 1.50 | `tractionSliding` | Grip while sliding |
| `fTractionCurveLateral` | 24.5 | `slipAngleOptimal` | Optimal slip angle |
| `fTractionBiasFront` | 0.47 | `tractionBiasFront` | Front/rear grip split |
| `fTractionLossMult` | 0.8 | `tractionLossMult` | Grip loss multiplier |
| `fLowSpeedTractionLossMult` | 0.0 | `lowSpeedTractionLoss` | Wheelspin at low speed |
| **Suspension (Simplified)** ||||
| `fSuspensionBiasFront` | 0.46 | `weightDistribution` | Static weight balance |
| `fAntiRollBarForce` | 0.8 | `stabilityFactor` | Roll resistance → lateral grip |

---

## Phase 1: Core Physics Foundation

### 1.1 Mass & Inertia System

**Objective:** Implement proper mass-based physics for realistic momentum and rotation.

#### New Parameters

```typescript
// Mass Properties
mass: number;              // Vehicle mass in kg (800-2000)
inertiaMultiplier: number; // Rotation resistance (0.5-3.0)
centerOfMassOffset: number; // Front(-1) to Rear(+1) bias
```

#### Physics Implementation

```typescript
// Force-based acceleration (F = ma → a = F/m)
const acceleration = engineForce / mass;
velocity.x += Math.cos(angle) * acceleration;
velocity.y += Math.sin(angle) * acceleration;

// Rotational inertia affects turn rate
const angularAcceleration = steerTorque / (mass * inertiaMultiplier);
angularVelocity += angularAcceleration;
angle += angularVelocity;
angularVelocity *= angularDamping;
```

#### 2D Interpretation

In a top-down view:
- **Mass** determines how quickly the car accelerates and decelerates
- **Inertia** determines how resistant the car is to rotation (high = boat-like, low = twitchy)
- **Center of Mass** shifts weight distribution, affecting oversteer/understeer tendency

### 1.2 Weight Transfer Model

**Objective:** Simulate dynamic weight shift during acceleration/braking/cornering.

#### New Parameters

```typescript
weightTransferAccel: number;   // Weight shift under acceleration (0-1)
weightTransferBrake: number;   // Weight shift under braking (0-1)
weightTransferLateral: number; // Weight shift in corners (0-1)
weightDistribution: number;    // Static front/rear balance (0-1, 0.5=even)
```

#### Physics Implementation

```typescript
// Calculate dynamic weight distribution
let frontWeight = weightDistribution;
let rearWeight = 1 - weightDistribution;

// Longitudinal transfer (acceleration/braking)
if (accelerating) {
  frontWeight -= weightTransferAccel * (throttle * acceleration / gravity);
  rearWeight += weightTransferAccel * (throttle * acceleration / gravity);
}
if (braking) {
  frontWeight += weightTransferBrake * (brakeForce / gravity);
  rearWeight -= weightTransferBrake * (brakeForce / gravity);
}

// Lateral transfer (cornering) - affects inside/outside tire grip
const lateralTransfer = weightTransferLateral * lateralG;
```

#### Emergent Behaviors

| Condition | Effect |
|-----------|--------|
| Hard acceleration (RWD) | Weight shifts rear → more rear grip → less understeer |
| Hard braking | Weight shifts front → rear gets light → easier rotation |
| Mid-corner throttle lift | Weight shifts front → snap oversteer (lift-off oversteer) |

---

## Phase 2: Tire & Traction Model

### 2.1 Slip Angle-Based Grip Curve

**Objective:** Replace linear grip with realistic tire behavior where grip peaks then falls off.

#### New Parameters

```typescript
// Traction Curve
tractionPeak: number;       // Maximum grip coefficient (0.5-1.5)
tractionSliding: number;    // Grip when fully sliding (0.3-1.0)
slipAngleOptimal: number;   // Angle of peak grip in degrees (5-20)
slipAnglePeak: number;      // Angle where sliding begins (15-45)
tractionFalloff: number;    // How sharply grip drops (0.5-2.0)

// Traction Distribution
tractionBiasFront: number;  // Front grip ratio (0-1, 0.5=even)
```

#### Tire Model Curve

```
  Grip
   ^
   |     ____
   |    /    \____
   |   /          \____
   |  /                \____
   | /                      \____
   |/                             \____
   +---------------------------------> Slip Angle
   0   optimal   peak          sliding
       (max grip) (breakaway)  (drift zone)
```

#### Implementation

```typescript
function calculateTireGrip(slipAngle: number, params: TuningConfig): number {
  const absSlip = Math.abs(slipAngle);
  
  if (absSlip <= params.slipAngleOptimal) {
    // Linear buildup to peak
    return params.tractionPeak * (absSlip / params.slipAngleOptimal);
  } else if (absSlip <= params.slipAnglePeak) {
    // At peak grip
    return params.tractionPeak;
  } else {
    // Falloff toward sliding grip
    const excess = absSlip - params.slipAnglePeak;
    const falloffRange = 90 - params.slipAnglePeak;
    const t = Math.min(1, excess / falloffRange);
    const falloffCurve = Math.pow(t, params.tractionFalloff);
    return params.tractionPeak - (params.tractionPeak - params.tractionSliding) * falloffCurve;
  }
}
```

### 2.2 Front/Rear Traction Split

**Objective:** Enable understeer/oversteer tuning through traction balance.

#### Implementation

```typescript
// Calculate effective grip for each axle
const baseFrontGrip = calculateTireGrip(frontSlipAngle, params) * params.tractionBiasFront;
const baseRearGrip = calculateTireGrip(rearSlipAngle, params) * (1 - params.tractionBiasFront);

// Apply weight transfer effects
const frontGrip = baseFrontGrip * frontWeight;
const rearGrip = baseRearGrip * rearWeight;
```

#### Tuning Effects

| Traction Bias | Behavior |
|---------------|----------|
| Front > 0.5 | Understeer tendency (front grips more) |
| Front = 0.5 | Neutral balance |
| Front < 0.5 | Oversteer tendency (rear more likely to break loose) |

### 2.3 Surface-Specific Traction

**Objective:** Different surfaces affect grip characteristics.

#### New Parameters

```typescript
// Surface Multipliers
surfaceTractionMult: {
  asphalt: number;     // 1.0 (baseline)
  gravel: number;      // 0.7
  dirt: number;        // 0.6
  grass: number;       // 0.4
  ice: number;         // 0.2
  wet: number;         // 0.8
}

// Surface detection affects both grip and slide behavior
tractionLossMult: number;      // Overall grip reduction (0-1)
lowSpeedTractionLoss: number;  // Wheelspin potential (0-1)
```

---

## Phase 3: Drivetrain & Braking System

### 3.1 Drive Configuration

**Objective:** Simulate FWD/RWD/AWD handling characteristics.

#### New Parameters

```typescript
driveBiasFront: number;    // 0=RWD, 0.5=AWD, 1=FWD
driveInertia: number;      // Engine/flywheel momentum (0.5-2.0)
engineBraking: number;     // Deceleration when off-throttle (0-1)
```

#### Drive Bias Effects

```typescript
function applyDriveForce(car: CarState, throttle: number, params: TuningConfig) {
  const driveForce = throttle * params.enginePower / params.mass;
  
  // Split force between front and rear
  const frontDrive = driveForce * params.driveBiasFront;
  const rearDrive = driveForce * (1 - params.driveBiasFront);
  
  // Apply with grip limits
  const frontForceApplied = Math.min(frontDrive, frontGrip);
  const rearForceApplied = Math.min(rearDrive, rearGrip);
  
  // Excess force causes wheelspin (reduced forward thrust, increased rotation)
  const frontWheelspin = Math.max(0, frontDrive - frontGrip);
  const rearWheelspin = Math.max(0, rearDrive - rearGrip);
  
  // RWD oversteer: rear wheelspin induces rotation
  if (rearWheelspin > 0 && params.driveBiasFront < 0.5) {
    car.angularVelocity += rearWheelspin * steerSign * wheelspinRotationFactor;
  }
  
  // FWD understeer: front wheelspin reduces steering effectiveness
  if (frontWheelspin > 0 && params.driveBiasFront > 0.5) {
    effectiveSteerAngle *= (1 - frontWheelspin * steerReductionFactor);
  }
}
```

#### Drivetrain Characteristics

| Drive Type | Throttle Oversteer | Lift-Off | Power Slides | Trail Braking |
|------------|-------------------|----------|--------------|---------------|
| RWD (0.0) | Yes (rear spins) | Yes | Easy | Very effective |
| AWD (0.5) | Mild | Mild | Moderate | Moderate |
| FWD (1.0) | No (understeer) | No | Difficult | Less effective |

### 3.2 Braking System

**Objective:** Enable brake bias tuning for rotation control.

#### New Parameters

```typescript
brakeForce: number;        // Overall brake strength (0-3)
brakeBiasFront: number;    // Front brake distribution (0-1)
handbrakePower: number;    // Handbrake force (0-2)
handbrakeSlipAngle: number; // Induced slip angle (10-90 degrees)
```

#### Implementation

```typescript
function applyBrakes(car: CarState, brake: number, handbrake: number, params: TuningConfig) {
  // Standard braking with bias
  const brakeDecel = brake * params.brakeForce;
  const frontBrake = brakeDecel * params.brakeBiasFront;
  const rearBrake = brakeDecel * (1 - params.brakeBiasFront);
  
  // Apply braking force (respecting grip limits)
  const frontBrakeApplied = Math.min(frontBrake, frontGrip);
  const rearBrakeApplied = Math.min(rearBrake, rearGrip);
  
  // Rear brake lockup causes rotation
  const rearLockup = rearBrake > rearGrip;
  if (rearLockup) {
    car.rearSlipAngle += (rearBrake - rearGrip) * params.brakeLockupRotation;
  }
  
  // Handbrake: directly induces rear slip
  if (handbrake > 0) {
    const handbrakeEffect = handbrake * params.handbrakePower;
    car.rearGrip *= (1 - handbrakeEffect);
    car.rearSlipAngle = Math.max(car.rearSlipAngle, params.handbrakeSlipAngle * handbrake);
  }
}
```

#### Trail Braking Physics

Trail braking (braking while turning) is now emergent:
1. Braking shifts weight forward
2. Rear becomes light
3. Rear brake bias + light rear = rear rotation
4. Progressive brake release controls rotation

---

## Phase 4: Advanced Handling Dynamics

### 4.1 Steering Geometry (2D Ackermann Effect)

**Objective:** Speed-sensitive steering response.

#### New Parameters

```typescript
steeringLock: number;           // Maximum steering angle (degrees)
steeringSpeed: number;          // Input to wheel angle rate
steeringReturn: number;         // Center return rate
steeringSpeedScale: number;     // High-speed steering reduction (0-1)
steeringLinearity: number;      // Input curve (0.5-2.0)
counterSteerAssist: number;     // Auto counter-steer strength (0-1)
```

#### Implementation

```typescript
function processSteeringInput(input: number, speed: number, car: CarState, params: TuningConfig) {
  // Apply linearity (>1 = more sensitive in center, <1 = more linear)
  const curvedInput = Math.sign(input) * Math.pow(Math.abs(input), params.steeringLinearity);
  
  // Reduce lock at high speed
  const speedFactor = 1 - (speed / params.maxSpeed) * params.steeringSpeedScale;
  const effectiveMaxAngle = params.steeringLock * speedFactor;
  
  const targetAngle = curvedInput * effectiveMaxAngle * DEG_TO_RAD;
  
  // Smooth input
  if (Math.abs(targetAngle) > Math.abs(car.steeringAngle)) {
    car.steeringAngle = moveToward(car.steeringAngle, targetAngle, params.steeringSpeed);
  } else {
    car.steeringAngle = moveToward(car.steeringAngle, targetAngle, params.steeringReturn);
  }
  
  // Counter-steer assist (helps maintain drift angle)
  if (params.counterSteerAssist > 0 && isSliding(car)) {
    const driftDirection = Math.sign(car.angularVelocity);
    const counterForce = driftDirection * params.counterSteerAssist;
    car.steeringAngle += counterForce * (car.slipAngle / 90);
  }
}
```

### 4.2 Stability Control Systems (Optional Assists)

**Objective:** Provide assist options for different skill levels.

#### New Parameters

```typescript
stabilityControl: number;     // Anti-spin intervention (0-1)
tractionControl: number;      // Anti-wheelspin intervention (0-1)
absEnabled: boolean;          // Anti-lock braking
driftAssist: number;          // Helps maintain drift angle (0-1)
```

#### Implementation Philosophy

Assists should be **subtractive** - they reduce grip/power to maintain control, trading laptime for stability.

```typescript
// Stability Control: Reduces power when detecting spin
if (params.stabilityControl > 0) {
  const spinRate = Math.abs(car.angularVelocity);
  const spinThreshold = 0.1;
  if (spinRate > spinThreshold) {
    const intervention = (spinRate - spinThreshold) * params.stabilityControl;
    effectiveThrottle *= (1 - intervention);
  }
}

// Traction Control: Limits wheelspin
if (params.tractionControl > 0) {
  const wheelspinAmount = calculateWheelspin(car, params);
  if (wheelspinAmount > 0) {
    effectiveThrottle *= (1 - wheelspinAmount * params.tractionControl);
  }
}
```

### 4.3 Angular Velocity & Damping

**Objective:** Smooth, realistic rotation behavior.

#### New Parameters

```typescript
angularDamping: number;       // Rotation slowdown rate (0.9-0.99)
angularVelocityMax: number;   // Maximum rotation speed (radians/frame)
yawResponseTime: number;      // How quickly car responds to steering (0.1-1.0)
```

---

## Phase 5: Preset System & Community Features

### 5.1 Handling Preset Structure

#### Enhanced TuningConfig Schema

```typescript
interface TuningConfig {
  // === META ===
  presetName: string;
  presetAuthor: string;
  presetVersion: string;
  presetDescription: string;
  
  // === MASS & INERTIA ===
  mass: number;                    // kg (800-2000)
  inertiaMultiplier: number;       // (0.5-3.0)
  centerOfMassOffset: number;      // (-1 to 1) front/rear
  
  // === DRIVETRAIN ===
  enginePower: number;             // (0.1-3.0)
  driveBiasFront: number;          // (0-1) 0=RWD, 1=FWD
  driveInertia: number;            // (0.5-2.0)
  engineBraking: number;           // (0-1)
  maxSpeed: number;                // (10-50)
  
  // === BRAKING ===
  brakeForce: number;              // (0.5-3.0)
  brakeBiasFront: number;          // (0-1)
  handbrakePower: number;          // (0-2.0)
  handbrakeSlipAngle: number;      // degrees (10-90)
  
  // === STEERING ===
  steeringLock: number;            // degrees (20-90)
  steeringSpeed: number;           // (0.02-0.2)
  steeringReturn: number;          // (0.05-0.3)
  steeringSpeedScale: number;      // (0-0.8)
  steeringLinearity: number;       // (0.5-2.0)
  counterSteerAssist: number;      // (0-1)
  
  // === TRACTION ===
  tractionPeak: number;            // (0.5-1.5)
  tractionSliding: number;         // (0.2-1.0)
  slipAngleOptimal: number;        // degrees (5-20)
  slipAnglePeak: number;           // degrees (15-45)
  tractionFalloff: number;         // (0.5-2.0)
  tractionBiasFront: number;       // (0-1)
  tractionLossMult: number;        // (0-1)
  lowSpeedTractionLoss: number;    // (0-1)
  
  // === WEIGHT TRANSFER ===
  weightDistribution: number;      // (0-1) 0.5=even
  weightTransferAccel: number;     // (0-1)
  weightTransferBrake: number;     // (0-1)
  weightTransferLateral: number;   // (0-1)
  
  // === DYNAMICS ===
  angularDamping: number;          // (0.9-0.99)
  angularVelocityMax: number;      // (0.1-0.5)
  yawResponseTime: number;         // (0.1-1.0)
  
  // === RESISTANCES ===
  friction: number;                // Rolling resistance on-road
  drag: number;                    // Air resistance  
  offRoadFrictionMult: number;     // Off-road multiplier
  
  // === ASSISTS ===
  stabilityControl: number;        // (0-1)
  tractionControl: number;         // (0-1)
  absEnabled: boolean;
  driftAssist: number;             // (0-1)
  
  // === VISUAL ===
  carScale: number;
  cameraSmoothness: number;
}
```

### 5.2 Preset Library

```typescript
interface PresetLibrary {
  builtIn: TuningPreset[];      // Default presets (Track, Rally, Drift)
  community: TuningPreset[];    // Imported presets
  custom: TuningPreset[];       // User-created presets
}

interface TuningPreset {
  id: string;
  name: string;
  author: string;
  category: 'TRACK' | 'RALLY' | 'DRIFT' | 'CUSTOM';
  config: TuningConfig;
  createdAt: Date;
  downloads?: number;
}
```

### 5.3 Enhanced Tuning UI

#### Category Organization

```
┌─────────────────────────────────────────────┐
│ TUNING MENU                            [X]  │
├─────────────────────────────────────────────┤
│ [PRESETS] [ENGINE] [BRAKES] [STEERING]      │
│ [TRACTION] [WEIGHT] [ASSISTS] [ADVANCED]    │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─ ENGINE & DRIVETRAIN ─────────────────┐  │
│  │                                       │  │
│  │ Engine Power    [====|----] 1.55      │  │
│  │ Drive Type      [RWD ▼]               │  │
│  │ Drive Inertia   [==|------] 0.90      │  │
│  │ Engine Braking  [===|-----] 0.45      │  │
│  │ Max Speed       [=====|---] 220       │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [EXPORT JSON]  [IMPORT]  [RESET DEFAULT]   │
└─────────────────────────────────────────────┘
```

### 5.4 Real-Time Physics Debug Overlay

```
┌─────────────────────────────────────────────┐
│  PHYSICS DEBUG                              │
│                                             │
│  Speed: 145 km/h    Angle: 12.4°            │
│  Slip (F): 8.2°     Slip (R): 24.6°         │
│  Grip (F): 0.87     Grip (R): 0.43   *DRIFT*│
│  Weight (F): 42%    Weight (R): 58%         │
│  Angular V: 0.034   Throttle: 78%           │
│                                             │
│  [===========] Front Grip                   │
│  [====      ] Rear Grip                     │
└─────────────────────────────────────────────┘
```

---

## Implementation Details

### New CarState Interface

```typescript
interface CarState {
  // Position
  x: number;
  y: number;
  angle: number;              // Facing direction (radians)
  
  // Velocity
  velocity: Point;            // World-space velocity vector
  speed: number;              // Magnitude of velocity
  localVelocity: Point;       // Car-space velocity (x=forward, y=lateral)
  
  // Angular
  angularVelocity: number;    // Rotation rate (radians/frame)
  steeringAngle: number;      // Current wheel angle
  
  // Slip & Grip
  slipAngle: number;          // Overall slip angle
  frontSlipAngle: number;     // Front axle slip
  rearSlipAngle: number;      // Rear axle slip
  frontGrip: number;          // Current front grip (0-1)
  rearGrip: number;           // Current rear grip (0-1)
  
  // Weight
  frontWeight: number;        // Dynamic front weight (0-1)
  rearWeight: number;         // Dynamic rear weight (0-1)
  
  // State Flags
  isSliding: boolean;         // Rear slip > threshold
  isDrifting: boolean;        // Controlled slide
  isWheelspinning: boolean;   // Drive wheels exceeding grip
  
  // Visual
  driftFactor: number;        // For effects (smoke, trails)
  wheelspinAmount: number;    // For effects
}
```

### Physics Loop Structure

```typescript
function physicsUpdate(car: CarState, inputs: InputState, params: TuningConfig) {
  // 1. Process Inputs
  processSteeringInput(inputs.steer, car.speed, car, params);
  
  // 2. Calculate Weight Transfer
  updateWeightTransfer(car, inputs, params);
  
  // 3. Calculate Slip Angles
  updateSlipAngles(car, params);
  
  // 4. Calculate Grip
  updateGrip(car, params);
  
  // 5. Apply Forces
  if (inputs.throttle > 0) {
    applyDriveForce(car, inputs.throttle, params);
  }
  if (inputs.brake > 0) {
    applyBrakes(car, inputs.brake, inputs.handbrake, params);
  }
  
  // 6. Apply Tire Forces
  applyTireForces(car, params);
  
  // 7. Apply Resistances
  applyFrictionAndDrag(car, params, surface);
  
  // 8. Integrate
  car.angularVelocity *= params.angularDamping;
  car.angle += car.angularVelocity;
  car.x += car.velocity.x;
  car.y += car.velocity.y;
  
  // 9. Update State Flags
  updateStateFlags(car, params);
}
```

---

## Default Presets

### Track Preset (Maximum Grip)

```json
{
  "presetName": "Track",
  "presetDescription": "Maximum grip for hot laps. High downforce, responsive handling.",
  
  "mass": 1200,
  "inertiaMultiplier": 1.0,
  "centerOfMassOffset": 0.0,
  
  "enginePower": 1.8,
  "driveBiasFront": 0.4,
  "driveInertia": 0.7,
  "maxSpeed": 22,
  
  "brakeForce": 1.5,
  "brakeBiasFront": 0.55,
  "handbrakePower": 0.5,
  
  "steeringLock": 45,
  "steeringSpeed": 0.12,
  "steeringSpeedScale": 0.4,
  
  "tractionPeak": 1.3,
  "tractionSliding": 0.9,
  "slipAngleOptimal": 8,
  "slipAnglePeak": 18,
  "tractionBiasFront": 0.52,
  
  "weightDistribution": 0.48,
  "weightTransferAccel": 0.3,
  "weightTransferBrake": 0.4,
  
  "stabilityControl": 0.3,
  "tractionControl": 0.2
}
```

### Rally Preset (Balanced)

```json
{
  "presetName": "Rally",
  "presetDescription": "Balanced for mixed surfaces. Controllable slides, good recovery.",
  
  "mass": 1100,
  "inertiaMultiplier": 1.3,
  "centerOfMassOffset": -0.1,
  
  "enginePower": 1.4,
  "driveBiasFront": 0.35,
  "driveInertia": 0.85,
  "maxSpeed": 18,
  
  "brakeForce": 1.2,
  "brakeBiasFront": 0.5,
  "handbrakePower": 0.8,
  
  "steeringLock": 55,
  "steeringSpeed": 0.1,
  "steeringSpeedScale": 0.3,
  
  "tractionPeak": 1.0,
  "tractionSliding": 0.7,
  "slipAngleOptimal": 12,
  "slipAnglePeak": 28,
  "tractionBiasFront": 0.48,
  
  "weightDistribution": 0.46,
  "weightTransferAccel": 0.5,
  "weightTransferBrake": 0.5,
  
  "stabilityControl": 0.1,
  "tractionControl": 0.0
}
```

### Drift Preset (FC3S Inspired)

```json
{
  "presetName": "Drift",
  "presetDescription": "Tail-happy drift machine. Based on Mazda FC3S handling.",
  
  "mass": 1150,
  "inertiaMultiplier": 2.0,
  "centerOfMassOffset": -0.1,
  
  "enginePower": 1.55,
  "driveBiasFront": 0.0,
  "driveInertia": 0.9,
  "maxSpeed": 15,
  
  "brakeForce": 1.0,
  "brakeBiasFront": 0.6,
  "handbrakePower": 0.9,
  "handbrakeSlipAngle": 45,
  
  "steeringLock": 65,
  "steeringSpeed": 0.08,
  "steeringSpeedScale": 0.2,
  "counterSteerAssist": 0.3,
  
  "tractionPeak": 0.97,
  "tractionSliding": 0.65,
  "slipAngleOptimal": 15,
  "slipAnglePeak": 35,
  "tractionBiasFront": 0.47,
  "tractionLossMult": 0.8,
  
  "weightDistribution": 0.46,
  "weightTransferAccel": 0.6,
  "weightTransferBrake": 0.6,
  
  "stabilityControl": 0.0,
  "tractionControl": 0.0
}
```

---

## Migration Guide

### Backward Compatibility

The system will support loading old `rally_tuning.json` files by mapping old parameters:

```typescript
function migrateOldConfig(old: OldTuningConfig): TuningConfig {
  return {
    // Map old values to new structure
    mass: 1100, // Default
    enginePower: old.acceleration * 3, // Scale factor
    maxSpeed: old.maxSpeed,
    brakeForce: old.brakePower * 1.5,
    
    // Old single grip → new traction curve
    tractionPeak: 0.8 + old.corneringStiffness * 2,
    tractionSliding: 0.5 + old.corneringStiffness,
    
    // Old steering
    steeringLock: old.maxSteerAngle * 180 / Math.PI,
    steeringSpeed: old.steerSpeed,
    steeringReturn: old.steerReturn,
    
    // ... defaults for new parameters
    ...DEFAULT_TUNING_V2
  };
}
```

### Version Detection

```typescript
interface TuningConfig {
  _version?: number; // 1 = old, 2 = new
  // ... rest of config
}

function loadConfig(json: any): TuningConfig {
  if (!json._version || json._version === 1) {
    return migrateOldConfig(json);
  }
  return json as TuningConfig;
}
```

---

## Implementation Phases Summary

| Phase | Focus | New Parameters | Effort |
|-------|-------|----------------|--------|
| 1 | Core Physics | 7 | Medium |
| 2 | Tire Model | 10 | High |
| 3 | Drivetrain/Brakes | 8 | Medium |
| 4 | Advanced Dynamics | 6 | Medium |
| 5 | Presets & UI | 4 + UI work | Low-Medium |

**Total New Parameters:** ~35 (vs current 13)

### Recommended Implementation Order

1. **Phase 1** - Foundation (Mass, Inertia, Weight Transfer)
2. **Phase 3** - Drivetrain (Drive Bias is critical for feel differences)
3. **Phase 2** - Tire Model (Complex but high impact)
4. **Phase 4** - Polish (Steering refinements, assists)
5. **Phase 5** - Community (Presets, UI, sharing)

---

## Appendix A: Reference Values from FC3S handling.meta

```xml
<!-- Key values from drift-spec Mazda RX7 -->
<fMass value="1150.000000" />
<fDriveBiasFront value="0.000000" />           <!-- Pure RWD -->
<fInitialDriveForce value="1.550000" />
<fDriveInertia value="0.900000" />
<fInitialDriveMaxFlatVel value="220.000000" />
<fBrakeForce value="1.00000" />
<fBrakeBiasFront value="0.600000" />           <!-- 60% front brake bias -->
<fHandBrakeForce value="0.900000" />
<fSteeringLock value="65.000000" />            <!-- 65° max steering -->
<fTractionCurveMax value="0.970000" />         <!-- Low peak grip -->
<fTractionCurveMin value="1.500000" />         <!-- Sliding grip -->
<fTractionCurveLateral value="24.500000" />
<fTractionBiasFront value="0.470000" />        <!-- Slight rear bias -->
<fTractionLossMult value="0.800000" />
<vecInertiaMultiplier x="1.200000" y="1.400000" z="2.000000" />
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Slip Angle** | Angle between tire heading and travel direction |
| **Understeer** | Front tires lose grip first, car goes wide |
| **Oversteer** | Rear tires lose grip first, car rotates |
| **Trail Braking** | Braking while turning to rotate the car |
| **Weight Transfer** | Load shift during acceleration/braking/cornering |
| **Traction Circle** | Total grip available split between acceleration and cornering |
| **Drive Bias** | Front/rear power distribution |
| **Brake Bias** | Front/rear brake force distribution |

---

*Document prepared for Rally Castrol Legends development team.*  
*Reference handling data © Rockstar Games (educational analysis only)*
