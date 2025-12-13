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

  // Angle constraints (keep track going "uphill" - driving up the screen)
  ANGLE_CENTER: -Math.PI / 2,   // Straight up (negative Y)
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
    currentAngle: -Math.PI / 2, // Start heading straight up
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
      // Alternate starting direction randomly
      newState.currentHairpinDirection = Math.random() > 0.5 ? -1 : 1;
      console.log(`TOUGE: Starting hairpin sequence with ${newState.hairpinsInSequence} hairpins, direction: ${newState.currentHairpinDirection}`);
    }

  } else {
    // === HAIRPIN SEQUENCE PHASE ===

    newState.hairpinProgress++;

    if (newState.hairpinProgress === 1) {
      console.log(`TOUGE: Starting hairpin ${newState.hairpinsCompleted + 1}/${newState.hairpinsInSequence}`);
    }

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
        console.log(`TOUGE: Completed hairpin sequence, back to descent for ${newState.descentRemaining} segments`);
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
 * Creates a lead-in section heading upward
 */
export function generateInitialTougePoints(): Point[] {
  const points: Point[] = [];
  const startX = 400; // Start centered-ish
  const startY = 500; // Start below screen

  // Generate initial ascent (going upward = negative Y)
  for (let i = 0; i < 30; i++) {
    points.push({
      x: startX + (Math.random() - 0.5) * 10, // Slight wobble
      y: startY - i * TOUGE_CONFIG.SEGMENT_LENGTH, // Negative to go upward
    });
  }

  return points;
}
