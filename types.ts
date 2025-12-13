export enum GameMode {
  MENU = 'MENU',
  RACING = 'RACING',
  FINISHED = 'FINISHED',
  EDITOR = 'EDITOR'
}

export enum TrackType {
  LOOP = 'LOOP',
  INFINITE = 'INFINITE'
}

export interface Point {
  x: number;
  y: number;
}

export interface TrackSegment {
  p1: Point;
  p2: Point;
  width: number;
}

export interface TrackData {
  id: number;
  name: string;
  type: TrackType;
  points: Point[]; // Center line points
  controlPoints: Point[]; // Control points for splines
  width: number;
  lapsToWin: number;
}

export interface CarState {
  // Position
  x: number;
  y: number;
  angle: number; // Car facing direction (radians)
  
  // Velocity
  velocity: Point; // World-space velocity vector
  speed: number; // Magnitude of velocity
  
  // Angular (Phase 1)
  angularVelocity: number; // Rotation rate (radians/frame)
  steeringAngle: number; // Current wheel angle
  
  // Weight (Phase 1)
  frontWeight: number; // Dynamic front weight distribution (0-1)
  rearWeight: number; // Dynamic rear weight distribution (0-1)
  
  // Slip & Grip (Phase 2)
  slipAngle: number; // Overall slip angle (degrees)
  frontSlipAngle: number; // Front axle slip angle (degrees)
  rearSlipAngle: number; // Rear axle slip angle (degrees)
  frontGrip: number; // Current front grip coefficient (0-1)
  rearGrip: number; // Current rear grip coefficient (0-1)
  
  // Visual
  driftFactor: number; // For effects (smoke, trails)
}

export interface TuningConfig {
  // Version control for backward compatibility
  _version?: number; // 1 = old, 2 = Phase 1, 3 = Phase 2, 4 = Phase 3, 5 = Phase 4
  
  // === PRESET METADATA (Phase 5) ===
  presetName?: string;
  presetAuthor?: string;
  presetDescription?: string;
  
  // === PHASE 1: MASS & INERTIA ===
  mass?: number; // Vehicle mass in kg (800-2000)
  inertiaMultiplier?: number; // Rotation resistance (0.5-3.0)
  centerOfMassOffset?: number; // Front(-1) to Rear(+1) bias
  
  // === PHASE 1: WEIGHT TRANSFER ===
  weightDistribution?: number; // Static front/rear balance (0-1, 0.5=even)
  weightTransferAccel?: number; // Weight shift under acceleration (0-1)
  weightTransferBrake?: number; // Weight shift under braking (0-1)
  weightTransferLateral?: number; // Weight shift in corners (0-1)
  
  // === PHASE 1: ANGULAR DYNAMICS ===
  angularDamping?: number; // Rotation slowdown rate (0.9-0.99)
  angularVelocityMax?: number; // Maximum rotation speed (radians/frame)
  
  // === PHASE 2: TRACTION CURVE ===
  tractionPeak?: number; // Maximum grip coefficient (0.5-1.5)
  tractionSliding?: number; // Grip when fully sliding (0.3-1.0)
  slipAngleOptimal?: number; // Angle of peak grip in degrees (5-20)
  slipAnglePeak?: number; // Angle where sliding begins (15-45)
  tractionFalloff?: number; // How sharply grip drops (0.5-2.0)
  
  // === PHASE 2: TRACTION DISTRIBUTION ===
  tractionBiasFront?: number; // Front grip ratio (0-1, 0.5=even)
  tractionLossMult?: number; // Overall grip reduction (0-1)
  lowSpeedTractionLoss?: number; // Wheelspin potential (0-1)
  
  // === PHASE 3: DRIVETRAIN ===
  driveBiasFront?: number; // 0=RWD, 0.5=AWD, 1=FWD
  driveInertia?: number; // Engine/flywheel momentum (0.5-2.0)
  engineBraking?: number; // Deceleration when off-throttle (0-1)
  
  // === PHASE 3: BRAKING ===
  brakeForce?: number; // Overall brake strength (0.5-3.0)
  brakeBiasFront?: number; // Front brake distribution (0-1)
  handbrakePower?: number; // Handbrake force (0-2)
  handbrakeSlipAngle?: number; // Induced slip angle (10-90 degrees)
  brakeLockupRotation?: number; // Rotation from rear lockup (0-1)
  
  // === PHASE 4: STEERING GEOMETRY ===
  steeringLock?: number; // Maximum steering angle in degrees (20-90)
  steeringSpeedScale?: number; // High-speed steering reduction (0-0.8)
  steeringLinearity?: number; // Input curve (0.5-2.0)
  counterSteerAssist?: number; // Auto counter-steer strength (0-1)
  
  // === PHASE 4: STABILITY ASSISTS ===
  stabilityControl?: number; // Anti-spin intervention (0-1)
  tractionControl?: number; // Anti-wheelspin intervention (0-1)
  absEnabled?: boolean; // Anti-lock braking
  driftAssist?: number; // Helps maintain drift angle (0-1)
  
  // === LEGACY PARAMETERS (kept for backward compatibility) ===
  // Movement
  maxSpeed: number;
  acceleration: number;
  reversePower: number;
  brakePower: number;
  friction: number; // Ground resistance
  drag: number; // Air resistance
  
  // Steering
  maxSteerAngle: number;
  steerSpeed: number; // How fast wheel turns
  steerReturn: number; // How fast wheel centers
  
  // Physics / Drift
  corneringStiffness: number; // High = grip, Low = drift
  offRoadFriction: number;
  
  // Camera
  cameraSmoothness: number;

  // Visuals
  carScale: number;
}

export const DEFAULT_TUNING: TuningConfig = {
  // Version
  _version: 5, // Phase 4 implementation
  
  // === PHASE 1: MASS & INERTIA ===
  mass: 1100, // kg (balanced default)
  inertiaMultiplier: 1.2, // Moderate rotation resistance
  centerOfMassOffset: 0.0, // Neutral balance
  
  // === PHASE 1: WEIGHT TRANSFER ===
  weightDistribution: 0.5, // 50/50 front/rear
  weightTransferAccel: 0.4, // Moderate weight shift on throttle
  weightTransferBrake: 0.5, // Higher weight shift on braking
  weightTransferLateral: 0.3, // Moderate lateral transfer
  
  // === PHASE 1: ANGULAR DYNAMICS ===
  angularDamping: 0.95, // Smooth rotation decay
  angularVelocityMax: 0.15, // Reasonable max rotation speed
  
  // === PHASE 2: TRACTION CURVE ===
  tractionPeak: 1.0, // Good balanced grip
  tractionSliding: 0.7, // Moderate sliding grip
  slipAngleOptimal: 10, // 10 degrees for peak grip
  slipAnglePeak: 25, // Starts sliding at 25 degrees
  tractionFalloff: 1.5, // Moderate falloff curve
  
  // === PHASE 2: TRACTION DISTRIBUTION ===
  tractionBiasFront: 0.5, // Neutral front/rear balance
  tractionLossMult: 1.0, // No reduction
  lowSpeedTractionLoss: 0.0, // No low-speed wheelspin by default
  
  // === PHASE 3: DRIVETRAIN ===
  driveBiasFront: 0.0, // RWD by default (fun!)
  driveInertia: 0.9, // Moderate engine inertia
  engineBraking: 0.3, // Moderate engine braking
  
  // === PHASE 3: BRAKING ===
  brakeForce: 1.2, // Good brake strength
  brakeBiasFront: 0.55, // Slight front bias for stability
  handbrakePower: 0.8, // Strong handbrake
  handbrakeSlipAngle: 35, // 35° rear slip on handbrake
  brakeLockupRotation: 0.5, // Moderate rotation from lockup
  
  // === PHASE 4: STEERING GEOMETRY ===
  steeringLock: 45, // 45 degrees max angle
  steeringSpeedScale: 0.4, // Reduce steering 40% at top speed
  steeringLinearity: 1.0, // Linear input (no deadzone)
  counterSteerAssist: 0.0, // No assist by default (manual control)
  
  // === PHASE 4: STABILITY ASSISTS ===
  stabilityControl: 0.0, // No stability control (full manual)
  tractionControl: 0.0, // No traction control
  absEnabled: false, // No ABS
  driftAssist: 0.0, // No drift assist
  
  // === LEGACY PARAMETERS ===
  maxSpeed: 18,
  acceleration: 0.3,
  reversePower: 0.15,
  brakePower: 0.6,
  friction: 0.02,
  drag: 0.005,
  maxSteerAngle: 0.6, // radians
  steerSpeed: 0.08,
  steerReturn: 0.1,
  corneringStiffness: 0.12,
  offRoadFriction: 0.15,
  cameraSmoothness: 0.1,
  carScale: 4
};
