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
  x: number;
  y: number;
  speed: number;
  angle: number; // Car facing direction (radians)
  velocity: Point; // Vector
  steeringAngle: number;
  driftFactor: number; // For visual or physics calculations
}

export interface TuningConfig {
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