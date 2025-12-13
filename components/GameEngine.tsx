import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CarState, TuningConfig, TrackData, Point, TrackType, UrbanWorldState, CityTile } from '../types';
import { generateNextSegment } from '../services/trackService';
import { getCarSkin } from '../services/carSkinStorage';
import {
  createUrbanWorldState,
  updateLoadedTiles,
  isPositionOnRoad,
  findNearestRoadPosition,
  TILE_SIZE,
  ROAD_WIDTH
} from '../services/urbanGenerator';
import {
  createTougeGenState,
  generateTougeSegment,
  TougeGenState,
  TOUGE_CONFIG
} from '../services/tougeGenerator';

interface GameEngineProps {
  track: TrackData;
  tuning: TuningConfig;
  onFinish: (win: boolean, time: number) => void;
  onExit: () => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ track, tuning, onFinish, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs (Mutable for loop performance)
  const initialPos = track.type === TrackType.URBAN
    ? { x: TILE_SIZE / 2, y: TILE_SIZE / 2 } // Urban mode spawns at center of tile (0,0)
    : track.type === TrackType.TOUGE
      ? { x: track.points[5]?.x || 400, y: track.points[5]?.y || 0 } // Touge starts mid-track
      : { x: track.points[1]?.x || 0, y: track.points[1]?.y || 0 }; // Other modes use point 1

  const carRef = useRef<CarState>({
    x: initialPos.x,
    y: initialPos.y,
    speed: 0,
    angle: track.type === TrackType.TOUGE ? -Math.PI / 2 : 0, // Touge faces up, others face East
    velocity: { x: 0, y: 0 },
    steeringAngle: 0,
    angularVelocity: 0, // Phase 1: rotation rate
    frontWeight: tuning.weightDistribution || 0.5, // Phase 1: dynamic weight
    rearWeight: 1 - (tuning.weightDistribution || 0.5),
    slipAngle: 0, // Phase 2: overall slip
    frontSlipAngle: 0, // Phase 2: front axle slip
    rearSlipAngle: 0, // Phase 2: rear axle slip
    frontGrip: 1.0, // Phase 2: front grip coefficient
    rearGrip: 1.0, // Phase 2: rear grip coefficient
    driftFactor: 0
  });

  const inputsRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    space: false
  });

  // Gamepad State Management
  const gamepadRef = useRef<{
    connected: boolean;
    index: number;
    lastTimestamp: number;
  }>({
    connected: false,
    index: -1,
    lastTimestamp: 0
  });

  // Keyboard Activity Tracking (for seamless input switching)
  const keyboardActivityRef = useRef({
    lastKeyTime: 0,
    timeout: 500 // Consider keyboard inactive after 500ms
  });

  const isKeyboardActive = () => {
    return Date.now() - keyboardActivityRef.current.lastKeyTime < keyboardActivityRef.current.timeout;
  };

  // Biome selection for Endless Rally
  const selectRandomBiome = () => {
    const biomes = [
      { name: 'GRASS', color: '#2d3728' },
      { name: 'DIRT', color: '#c17f4a' },
      { name: 'SAND', color: '#e8d4a0' },
      { name: 'SNOW', color: '#f0f0f0' }
    ];
    return biomes[Math.floor(Math.random() * biomes.length)];
  };

  const gameStateRef = useRef({
    startTime: Date.now(),
    currentLap: 1,
    lastCheckpointIndex: 1, // Start a bit into the array
    trackPoints: [...track.points], // Clone points for infinite modification
    infiniteSeed: 0,
    checkpointsCrossed: 0,
    finished: false,
    dashOffset: 0,
    // Biome for Endless Rally
    biome: track.type === TrackType.INFINITE ? selectRandomBiome() : { name: 'GRASS', color: '#2d3728' },
    // Enhanced Infinite Gen State Machine
    genState: {
      mode: 'LONG_STRAIGHT' as 'LONG_STRAIGHT' | 'HAIRPIN' | 'SLIGHT_TURN_SEQUENCE',
      remainingSteps: 60, // Start with a long straight
      targetCurvature: 0,
      currentCurvature: 0,
      turnSequenceCount: 0, // Counter for slight turn sequences
      patternPhase: 0, // 0=LONG_STRAIGHT, 1=HAIRPIN, 2=LONG_STRAIGHT, 3=SLIGHT_TURN_SEQUENCE
      cumulativeAngle: 0, // Track total angle deviation to prevent loops
      lastHairpinDirection: 0 // Track last hairpin direction: -1=left, 1=right, 0=none
    },
    // Touge Gen State (for TOUGE mode)
    tougeState: track.type === TrackType.TOUGE ? createTougeGenState() : null,
    // Distance traveled (for scoring in Touge mode)
    distanceTraveled: 0
  });

  // Urban state ref for Endless Urban mode
  const urbanStateRef = useRef<UrbanWorldState | null>(null);

  // Initialize urban state if track type is URBAN
  useEffect(() => {
    if (track.type === TrackType.URBAN) {
      urbanStateRef.current = createUrbanWorldState();
    }
  }, [track.type]);

  // UI State (synced less frequently if needed, but here simple enough)
  const [hud, setHud] = useState({ lap: 1, time: 0, speed: 0 });
  const [isGamepadConnected, setIsGamepadConnected] = useState(false);

  // Car Skin Image State
  const [carImage, setCarImage] = useState<HTMLImageElement | null>(null);
  
  // Load car skin image when tuning changes
  useEffect(() => {
    const loadCarImage = async () => {
      if (tuning.carSkinMode === 'image' && tuning.carSkinImage) {
        const img = new Image();
        
        // Check if it's a file path or IndexedDB key
        if (tuning.carSkinImage.startsWith('cars/')) {
          // Load from file path (BMW default or other assets)
          img.src = tuning.carSkinImage;
          img.onload = () => setCarImage(img);
          img.onerror = () => {
            console.error('Failed to load car image from path:', tuning.carSkinImage);
            setCarImage(null);
          };
        } else {
          // Load from IndexedDB
          try {
            const dataUrl = await getCarSkin(tuning.carSkinImage);
            if (dataUrl) {
              img.src = dataUrl;
              img.onload = () => setCarImage(img);
              img.onerror = () => {
                console.error('Failed to load car image from IndexedDB');
                setCarImage(null);
              };
            }
          } catch (error) {
            console.error('Error loading car skin from IndexedDB:', error);
            setCarImage(null);
          }
        }
      } else {
        setCarImage(null);
      }
    };
    
    loadCarImage();
  }, [tuning.carSkinMode, tuning.carSkinImage]);

  // Physics Helper: Distance to Line Segment
  const distToSegment = (p: Point, v: Point, w: Point) => {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = v.x + t * (w.x - v.x);
    const projY = v.y + t * (w.y - v.y);
    return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
  };

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keyboardActivityRef.current.lastKeyTime = Date.now();
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': inputsRef.current.up = true; break;
        case 's': case 'arrowdown': inputsRef.current.down = true; break;
        case 'a': case 'arrowleft': inputsRef.current.left = true; break;
        case 'd': case 'arrowright': inputsRef.current.right = true; break;
        case ' ': inputsRef.current.space = true; break;
        case 'escape': onExit(); break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keyboardActivityRef.current.lastKeyTime = Date.now();
      switch (e.key.toLowerCase()) {
        case 'w': case 'arrowup': inputsRef.current.up = false; break;
        case 's': case 'arrowdown': inputsRef.current.down = false; break;
        case 'a': case 'arrowleft': inputsRef.current.left = false; break;
        case 'd': case 'arrowright': inputsRef.current.right = false; break;
        case ' ': inputsRef.current.space = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onExit]);

  // Gamepad Connection Detection
  useEffect(() => {
    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
      gamepadRef.current.connected = true;
      gamepadRef.current.index = e.gamepad.index;
      setIsGamepadConnected(true);
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log('Gamepad disconnected');
      gamepadRef.current.connected = false;
      gamepadRef.current.index = -1;
      setIsGamepadConnected(false);
    };

    window.addEventListener('gamepadconnected', handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected);

    // Check for already connected gamepads on mount
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        console.log('Gamepad already connected:', gamepads[i]?.id);
        gamepadRef.current.connected = true;
        gamepadRef.current.index = i;
        setIsGamepadConnected(true);
        break;
      }
    }

    return () => {
      window.removeEventListener('gamepadconnected', handleGamepadConnected);
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected);
    };
  }, []);

  // Main Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Gamepad Polling Function
    const pollGamepad = () => {
      if (!gamepadRef.current.connected) return;

      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[gamepadRef.current.index];

      if (!gamepad) {
        gamepadRef.current.connected = false;
        return;
      }

      // Deadzone configuration
      const STICK_DEADZONE = tuning.gamepadSteeringDeadzone || 0.15;
      const TRIGGER_DEADZONE = tuning.gamepadTriggerDeadzone || 0.05;

      // --- STEERING (Left Stick X-Axis) ---
      const stickX = gamepad.axes[0] || 0;
      if (Math.abs(stickX) > STICK_DEADZONE) {
        if (stickX < 0) {
          inputsRef.current.left = true;
          inputsRef.current.right = false;
        } else {
          inputsRef.current.right = true;
          inputsRef.current.left = false;
        }
      } else {
        // Only clear if no keyboard input
        if (!isKeyboardActive()) {
          inputsRef.current.left = false;
          inputsRef.current.right = false;
        }
      }

      // --- ACCELERATION (Right Trigger - Analog) ---
      // Modern gamepads use axes[4] for RT analog value (0.0 to 1.0)
      const rightTrigger = gamepad.buttons[7]?.value || 0;
      if (rightTrigger > TRIGGER_DEADZONE) {
        inputsRef.current.up = true;
      } else {
        if (!isKeyboardActive()) {
          inputsRef.current.up = false;
        }
      }

      // --- BRAKING (Left Trigger - Analog) ---
      // Modern gamepads use axes[5] for LT analog value (0.0 to 1.0)
      const leftTrigger = gamepad.buttons[6]?.value || 0;
      if (leftTrigger > TRIGGER_DEADZONE) {
        inputsRef.current.down = true;
      } else {
        if (!isKeyboardActive()) {
          inputsRef.current.down = false;
        }
      }

      // --- HANDBRAKE (A Button or RB) ---
      const aButton = gamepad.buttons[0]?.pressed || false;
      const rbButton = gamepad.buttons[5]?.pressed || false;
      if (aButton || rbButton) {
        inputsRef.current.space = true;
      } else {
        if (!isKeyboardActive()) {
          inputsRef.current.space = false;
        }
      }

      // --- D-PAD FALLBACK CONTROLS ---
      if (gamepad.buttons[12]?.pressed) inputsRef.current.up = true;
      if (gamepad.buttons[13]?.pressed) inputsRef.current.down = true;
      if (gamepad.buttons[14]?.pressed) inputsRef.current.left = true;
      if (gamepad.buttons[15]?.pressed) inputsRef.current.right = true;

      // --- MENU BUTTON (Start Button) ---
      if (gamepad.buttons[9]?.pressed) {
        onExit();
      }
    };

    const loop = () => {
      if (gameStateRef.current.finished) return;

      // Poll gamepad at start of frame
      pollGamepad();

      const car = carRef.current;
      const inputs = inputsRef.current;
      const state = gameStateRef.current;

      // --- PHASE 1: PHYSICS UPDATE ---
      
      // Get Phase 1 & 2 parameters with defaults for backward compatibility
      const mass = tuning.mass || 1100;
      const inertiaMultiplier = tuning.inertiaMultiplier || 1.2;
      const weightDistribution = tuning.weightDistribution || 0.5;
      const weightTransferAccel = tuning.weightTransferAccel || 0.4;
      const weightTransferBrake = tuning.weightTransferBrake || 0.5;
      const angularDamping = tuning.angularDamping || 0.95;
      const angularVelocityMax = tuning.angularVelocityMax || 0.15;
      
      // Phase 2: Tire Model Parameters
      const tractionPeak = tuning.tractionPeak || 1.0;
      const tractionSliding = tuning.tractionSliding || 0.7;
      const slipAngleOptimal = tuning.slipAngleOptimal || 10;
      const slipAnglePeak = tuning.slipAnglePeak || 25;
      const tractionFalloff = tuning.tractionFalloff || 1.5;
      const tractionBiasFront = tuning.tractionBiasFront || 0.5;
      const tractionLossMult = tuning.tractionLossMult || 1.0;
      const lowSpeedTractionLoss = tuning.lowSpeedTractionLoss || 0.0;
      
      // Phase 3: Drivetrain & Braking Parameters
      const driveBiasFront = tuning.driveBiasFront !== undefined ? tuning.driveBiasFront : 0.0;
      const driveInertia = tuning.driveInertia || 0.9;
      const engineBraking = tuning.engineBraking || 0.3;
      const brakeForce = tuning.brakeForce || (tuning.brakePower * 2); // Scale legacy
      const brakeBiasFront = tuning.brakeBiasFront || 0.55;
      const handbrakePower = tuning.handbrakePower || 0.8;
      const handbrakeSlipAngle = tuning.handbrakeSlipAngle || 35;
      const brakeLockupRotation = tuning.brakeLockupRotation || 0.5;
      
      // Phase 4: Steering & Assists Parameters
      const steeringLock = tuning.steeringLock || 45;
      const steeringSpeedScale = tuning.steeringSpeedScale !== undefined ? tuning.steeringSpeedScale : 0.4;
      const steeringLinearity = tuning.steeringLinearity || 1.0;
      const counterSteerAssist = tuning.counterSteerAssist || 0.0;
      const stabilityControl = tuning.stabilityControl || 0.0;
      const tractionControl = tuning.tractionControl || 0.0;
      const absEnabled = tuning.absEnabled || false;
      const driftAssist = tuning.driftAssist || 0.0;
      
      // Phase 2: Tire Grip Curve Function
      const calculateTireGrip = (slipAngleDeg: number): number => {
        const absSlip = Math.abs(slipAngleDeg);
        
        if (absSlip <= slipAngleOptimal) {
          // Linear buildup to peak
          return tractionPeak * (absSlip / slipAngleOptimal);
        } else if (absSlip <= slipAnglePeak) {
          // At peak grip
          return tractionPeak;
        } else {
          // Falloff toward sliding grip
          const excess = absSlip - slipAnglePeak;
          const falloffRange = 90 - slipAnglePeak;
          const t = Math.min(1, excess / falloffRange);
          const falloffCurve = Math.pow(t, tractionFalloff);
          return tractionPeak - (tractionPeak - tractionSliding) * falloffCurve;
        }
      };
      
      // 1. Phase 4: Advanced Steering Logic
      const DEG_TO_RAD = Math.PI / 180;
      
      // Calculate raw input (-1 to 1)
      let rawSteerInput = 0;
      if (inputs.left) rawSteerInput = -1;
      if (inputs.right) rawSteerInput = 1;
      
      // Apply steering linearity curve
      const curvedInput = Math.sign(rawSteerInput) * Math.pow(Math.abs(rawSteerInput), steeringLinearity);
      
      // Speed-sensitive steering lock
      const currentSpeedForSteering = Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);
      const speedFactor = 1 - (currentSpeedForSteering / tuning.maxSpeed) * steeringSpeedScale;
      const effectiveMaxAngle = steeringLock * DEG_TO_RAD * Math.max(0.2, speedFactor);
      
      // Calculate target steering angle
      let targetSteer = curvedInput * effectiveMaxAngle;
      
      // Counter-steer assist (helps maintain drift angle)
      if (counterSteerAssist > 0 && Math.abs(car.slipAngle) > 15) {
        const driftDirection = Math.sign(car.angularVelocity);
        const counterForce = -driftDirection * counterSteerAssist * (Math.abs(car.slipAngle) / 90);
        targetSteer += counterForce * effectiveMaxAngle;
      }
      
      // Drift assist (helps maintain drift angle by adjusting steering)
      if (driftAssist > 0 && Math.abs(car.slipAngle) > 20) {
        const targetSlipAngle = 30; // Ideal drift angle
        const slipError = Math.abs(car.slipAngle) - targetSlipAngle;
        if (slipError > 0) {
          // Too much slip, counter-steer more
          targetSteer -= Math.sign(car.slipAngle) * slipError * 0.01 * driftAssist;
        }
      }

      // Move current steer towards target
      if (targetSteer !== 0 || car.steeringAngle !== 0) {
        const steerRate = targetSteer !== 0 ? tuning.steerSpeed : tuning.steerReturn;
        if (Math.abs(targetSteer - car.steeringAngle) < steerRate) {
          car.steeringAngle = targetSteer;
        } else if (targetSteer > car.steeringAngle) {
          car.steeringAngle += steerRate;
        } else {
          car.steeringAngle -= steerRate;
        }
      }

      // 2. Calculate Weight Transfer (Phase 1)
      car.frontWeight = weightDistribution;
      car.rearWeight = 1 - weightDistribution;
      
      // Longitudinal weight transfer (using new scaled values)
      const currentSpeed = Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);
      const gravity = 9.81; // m/s²
      const ACCEL_SCALE = 400;
      const BRAKE_FORCE_SCALE = 150;
      
      if (inputs.up && !inputs.down) {
        // Acceleration shifts weight rearward (use scaled acceleration)
        const accelForce = (tuning.acceleration * ACCEL_SCALE) / mass;
        const transfer = weightTransferAccel * (accelForce / gravity) * 0.01;
        car.frontWeight = Math.max(0.2, weightDistribution - transfer);
        car.rearWeight = Math.min(0.8, 1 - car.frontWeight);
      }
      
      if (inputs.down) {
        // Braking shifts weight forward (use scaled brake force)
        const scaledBrakeForce = (brakeForce * BRAKE_FORCE_SCALE) / mass;
        const transfer = weightTransferBrake * (scaledBrakeForce / gravity) * 0.01;
        car.frontWeight = Math.min(0.8, weightDistribution + transfer);
        car.rearWeight = Math.max(0.2, 1 - car.frontWeight);
      }
      
      // 3. Phase 3 & 4: Drivetrain - Power Distribution & Wheelspin with Assists
      let frontDriveForce = 0;
      let rearDriveForce = 0;
      let isBraking = false;
      let isHandbraking = inputs.space;
      
      // Determine braking/reverse FIRST (before acceleration logic)
      if (inputs.down) {
        const movingForward = (car.velocity.x * Math.cos(car.angle) + car.velocity.y * Math.sin(car.angle)) > 0.1;
        if (movingForward) {
          isBraking = true;
        } else {
          // Reverse
          const REVERSE_SCALE = 300; // Scale reverse power
          const reversePower = tuning.reversePower * REVERSE_SCALE;
          frontDriveForce = -reversePower * driveBiasFront;
          rearDriveForce = -reversePower * (1 - driveBiasFront);
        }
      }
      
      // Phase 4: Stability Control reduces throttle when spinning
      let stabilityIntervention = 1.0;
      if (stabilityControl > 0 && Math.abs(car.angularVelocity) > 0.08) {
        const spinRate = Math.abs(car.angularVelocity);
        const spinThreshold = 0.08;
        const intervention = Math.min(1, (spinRate - spinThreshold) * 10 * stabilityControl);
        stabilityIntervention = 1 - intervention;
      }
      
      if (inputs.up && !isBraking) {
        // Distribute engine power based on drive bias
        // SCALING: Legacy acceleration values (0.3) need to be scaled for mass-based physics
        const ACCEL_SCALE = 400; // Converts legacy 0.3 to ~120 force units
        let totalPower = tuning.acceleration * ACCEL_SCALE * stabilityIntervention;
        
        // Phase 4: Traction Control limits wheelspin
        if (tractionControl > 0) {
          const wheelspinThreshold = 0.3;
          const avgGrip = (car.frontGrip + car.rearGrip) / 2;
          if (avgGrip < wheelspinThreshold) {
            const tcIntervention = (wheelspinThreshold - avgGrip) * tractionControl;
            totalPower *= (1 - tcIntervention);
          }
        }
        
        frontDriveForce = totalPower * driveBiasFront;
        rearDriveForce = totalPower * (1 - driveBiasFront);
      } else if (!inputs.down && !isBraking) {
        // Engine braking when coasting
        const BRAKE_SCALE = 50; // Scale engine braking
        const coastingDecel = -engineBraking * BRAKE_SCALE;
        const forwardVel = car.velocity.x * Math.cos(car.angle) + car.velocity.y * Math.sin(car.angle);
        if (forwardVel > 0.5) {
          frontDriveForce = coastingDecel * driveBiasFront;
          rearDriveForce = coastingDecel * (1 - driveBiasFront);
        }
      }

      // 4. Phase 3: Apply Drive Forces with Wheelspin Effects
      if (!isBraking) {
        // Calculate available grip for drive forces (will be calculated properly after slip angles)
        // For now, use a temporary grip estimate
        const tempFrontGrip = car.frontGrip;
        const tempRearGrip = car.rearGrip;
        const currentSpeedCheck = Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);
        
        // Apply front drive force
        if (Math.abs(frontDriveForce) > 0) {
          const frontAccel = frontDriveForce / mass;
          car.velocity.x += Math.cos(car.angle) * frontAccel;
          car.velocity.y += Math.sin(car.angle) * frontAccel;
          
          // FWD wheelspin reduces steering effectiveness
          if (driveBiasFront > 0.5 && frontDriveForce > 0) {
            const wheelspinFactor = Math.max(0, (frontDriveForce / mass) - tempFrontGrip * 2);
            if (wheelspinFactor > 0) {
              // Reduce steering angle due to front wheelspin
              car.steeringAngle *= (1 - wheelspinFactor * 0.3);
            }
          }
        }
        
        // Apply rear drive force
        if (Math.abs(rearDriveForce) > 0) {
          const rearAccel = rearDriveForce / mass;
          car.velocity.x += Math.cos(car.angle) * rearAccel;
          car.velocity.y += Math.sin(car.angle) * rearAccel;
          
          // RWD wheelspin causes oversteer
          if (driveBiasFront < 0.5 && rearDriveForce > 0 && currentSpeedCheck > 2) {
            const wheelspinFactor = Math.max(0, (rearDriveForce / mass) - tempRearGrip * 2);
            if (wheelspinFactor > 0) {
              // Induce rotation based on steering direction and wheelspin
              const steerSign = Math.sign(car.steeringAngle) || (Math.random() > 0.5 ? 1 : -1);
              car.angularVelocity += steerSign * wheelspinFactor * 0.02;
            }
          }
        }
      }

      // 5. Calculate current speed (needed for braking and handbrake logic)
      const speed = Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);
      
      // 5a. Phase 3 & 4: Braking System with Bias, Handbrake & ABS
      if (isBraking && speed > 0.1) {
        // Calculate brake deceleration with bias
        const BRAKE_FORCE_SCALE = 150; // Scale brake force for mass-based physics
        let totalBrakeDecel = (brakeForce * BRAKE_FORCE_SCALE) / mass;
        let frontBrake = totalBrakeDecel * brakeBiasFront;
        let rearBrake = totalBrakeDecel * (1 - brakeBiasFront);
        
        // Phase 4: ABS prevents lockup
        if (absEnabled) {
          // Limit brake force to prevent exceeding grip
          frontBrake = Math.min(frontBrake, car.frontGrip * 4);
          rearBrake = Math.min(rearBrake, car.rearGrip * 4);
        }
        
        // Apply braking force
        const brakeAccel = -(frontBrake + rearBrake);
        const brakeVelX = Math.cos(car.angle) * brakeAccel;
        const brakeVelY = Math.sin(car.angle) * brakeAccel;
        
        car.velocity.x += brakeVelX;
        car.velocity.y += brakeVelY;
        
        // Rear brake lockup causes rotation (trail braking) - unless ABS prevents it
        if (!absEnabled && rearBrake > car.rearGrip * 3 && speed > 3) {
          const lockupAmount = (rearBrake - car.rearGrip * 3) * brakeLockupRotation;
          const steerSign = Math.sign(car.steeringAngle) || 0;
          if (steerSign !== 0) {
            car.angularVelocity += steerSign * lockupAmount * 0.01;
          }
        }
      }
      
      // Phase 3: Handbrake
      if (isHandbraking && speed > 1) {
        // Handbrake directly induces rear slip and reduces rear grip
        car.rearGrip *= (1 - handbrakePower * 0.5);
        
        // Induce rear slip angle
        const targetRearSlip = handbrakeSlipAngle * Math.sign(car.steeringAngle || 1);
        car.rearSlipAngle = car.rearSlipAngle + (targetRearSlip - car.rearSlipAngle) * 0.3;
        
        // Handbrake also applies some deceleration
        const HANDBRAKE_SCALE = 10; // Scale handbrake deceleration
        const handbrakeDecel = -handbrakePower * HANDBRAKE_SCALE;
        car.velocity.x += Math.cos(car.angle) * handbrakeDecel;
        car.velocity.y += Math.sin(car.angle) * handbrakeDecel;
      }

      // 6. Update Position
      car.x += car.velocity.x;
      car.y += car.velocity.y;

      // Urban Mode: Road Boundary Collision
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

      // 7. Friction & Drag & Offroad

      // Detect Offroad (skip for urban mode)
      let minDist = Infinity;
      let isOffroad = false;

      if (track.type !== TrackType.URBAN) {
        // Optimize: For infinite, check end of array. For Loop, check window around current checkpoint.
        let pointsToCheck: Point[] = [];
        let checkStartIndex = 0;

        if (track.type === TrackType.INFINITE) {
        // Just check the last 40 points in the buffer for offroad collision
        // This assumes the car is roughly keeping up
        pointsToCheck = state.trackPoints;
        // Optimization: slice relevant part if array is huge, but we cap it at 300
      } else {
        pointsToCheck = state.trackPoints;
      }
      
      // For loop tracks, we need to handle wrapping segments, but usually distToSegment on the array is okay
      // We will search a window around lastCheckpointIndex to be efficient
      const searchRadius = 40; 
      const totalPoints = state.trackPoints.length;
      
      // Only check nearby segments to save perf
      for (let i = -10; i < searchRadius; i++) {
          let idx = state.lastCheckpointIndex + i;
          // Handle wrap
          if (track.type === TrackType.LOOP) {
             idx = (idx + totalPoints * 2) % totalPoints; // Ensure positive
          } else {
             if (idx < 0 || idx >= totalPoints - 1) continue;
          }
          
          const p1 = state.trackPoints[idx];
          const p2 = state.trackPoints[(idx + 1) % totalPoints];

          // Infinite and Touge tracks don't wrap last to first
          if ((track.type === TrackType.INFINITE || track.type === TrackType.TOUGE) && idx === totalPoints - 1) continue;

          const d = distToSegment(car, p1, p2);
          if (d < minDist) minDist = d;
      }
      
        // Fallback: if we are lost (minDist still Infinity), check everything
        if (minDist === Infinity) {
            for (let i = 0; i < state.trackPoints.length - 1; i++) {
               const d = distToSegment(car, state.trackPoints[i], state.trackPoints[i+1]);
               if (d < minDist) minDist = d;
            }
        }

        isOffroad = minDist > (track.width / 2);
      }

      const currentFriction = isOffroad ? tuning.offRoadFriction : tuning.friction;

      // Recalculate speed after braking (before applying friction/drag)
      let updatedSpeed = Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);

      // Apply Drag 
      car.velocity.x *= (1 - tuning.drag);
      car.velocity.y *= (1 - tuning.drag);

      // Apply Friction (use updatedSpeed after braking, not old speed)
      if (updatedSpeed > 0) {
        car.velocity.x *= (1 - currentFriction);
        car.velocity.y *= (1 - currentFriction);
      }

      // Recalculate speed after all longitudinal forces (braking, friction, drag) have been applied
      updatedSpeed = Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);

      // 8. Phase 2: Calculate Slip Angles
      if (updatedSpeed > 0.5) {
        const velocityAngle = Math.atan2(car.velocity.y, car.velocity.x);
        
        // Overall slip angle (difference between heading and velocity)
        let slipAngleRad = car.angle - velocityAngle;
        while (slipAngleRad <= -Math.PI) slipAngleRad += Math.PI * 2;
        while (slipAngleRad > Math.PI) slipAngleRad -= Math.PI * 2;
        
        car.slipAngle = slipAngleRad * (180 / Math.PI); // Convert to degrees for display
        
        // Simplified front/rear slip angle calculation
        // Front slip influenced by steering angle
        car.frontSlipAngle = car.slipAngle + (car.steeringAngle * (180 / Math.PI) * 0.5);
        
        // Rear slip is primarily the overall slip
        car.rearSlipAngle = car.slipAngle;
        
      // 9. Phase 2: Calculate Grip from Slip Angles
        const baseFrontGrip = calculateTireGrip(car.frontSlipAngle);
        const baseRearGrip = calculateTireGrip(car.rearSlipAngle);
        
        // Apply traction bias
        const frontTraction = baseFrontGrip * tractionBiasFront;
        const rearTraction = baseRearGrip * (1 - tractionBiasFront);
        
        // Apply weight transfer effects
        car.frontGrip = frontTraction * car.frontWeight * tractionLossMult;
        car.rearGrip = rearTraction * car.rearWeight * tractionLossMult;
        
        // Apply surface effects
        if (isOffroad) {
          car.frontGrip *= 0.6;
          car.rearGrip *= 0.6;
        }
        
        // Low-speed traction loss (wheelspin simulation)
        if (speed < 5 && lowSpeedTractionLoss > 0) {
          const lowSpeedFactor = 1 - (lowSpeedTractionLoss * (1 - speed / 5));
          car.rearGrip *= lowSpeedFactor;
        }
        
      // 10. Angular Physics with Phase 2 Grip
        // Calculate steering torque (affected by speed and inertia)
        const steerTorque = car.steeringAngle * (speed / tuning.maxSpeed) * 0.5;
        
        // Angular acceleration based on inertia (torque / inertia)
        const angularAcceleration = steerTorque / (mass * inertiaMultiplier * 0.001);
        
        // Update angular velocity
        car.angularVelocity += angularAcceleration;
        
        // Apply angular damping
        car.angularVelocity *= angularDamping;
        
        // Clamp angular velocity
        car.angularVelocity = Math.max(-angularVelocityMax, Math.min(angularVelocityMax, car.angularVelocity));
        
        // Update car angle from angular velocity
        car.angle += car.angularVelocity;

      // 11. Phase 2: Apply Tire Forces (Pure Physics - No Legacy Blending)
        // Calculate average grip for velocity correction
        const averageGrip = (car.frontGrip + car.rearGrip) / 2;
        
        // Apply realistic grip to align velocity with car angle
        const newVelocityAngle = velocityAngle + slipAngleRad * averageGrip;
        
        // Use updatedSpeed (after braking) instead of old speed
        car.velocity.x = Math.cos(newVelocityAngle) * updatedSpeed;
        car.velocity.y = Math.sin(newVelocityAngle) * updatedSpeed;

        car.driftFactor = Math.abs(slipAngleRad);
      } else {
        // At low speed, decay angular velocity faster
        car.angularVelocity *= 0.9;
        car.slipAngle = 0;
        car.frontSlipAngle = 0;
        car.rearSlipAngle = 0;
        car.frontGrip = 1.0;
        car.rearGrip = 1.0;
      }

      // 12. Cap max speed
      const finalSpeed = Math.sqrt(car.velocity.x**2 + car.velocity.y**2);
      if (finalSpeed > tuning.maxSpeed) {
        const ratio = tuning.maxSpeed / finalSpeed;
        car.velocity.x *= ratio;
        car.velocity.y *= ratio;
      }
      car.speed = finalSpeed;


      // --- GAMEPLAY UPDATE ---

      if (track.type === TrackType.INFINITE) {
        // === ENDLESS RALLY LOGIC ===
        const gs = state.genState;
        const lastP = state.trackPoints[state.trackPoints.length-1];
        const distToEnd = Math.sqrt((car.x - lastP.x)**2 + (car.y - lastP.y)**2);
        
        // Calculate viewport distance (track should generate outside visible area)
        // Approximate viewport size from car position
        const viewportGenDistance = 2000; // Generate when track endpoint is within 2000px
        
        // Speed-matched generation: only generate if car is moving
        const isMoving = car.speed > 0.5;
        
        // Generate new track ahead (viewport-aware and speed-matched)
        if (distToEnd < viewportGenDistance && isMoving) {
            // Check if we need to switch pattern phase
            if (gs.remainingSteps <= 0) {
              // Progress through the pattern: LONG_STRAIGHT → HAIRPIN → LONG_STRAIGHT → SLIGHT_TURN_SEQUENCE
              gs.patternPhase = (gs.patternPhase + 1) % 4;
              
              if (gs.patternPhase === 0 || gs.patternPhase === 2) {
                // LONG_STRAIGHT phase
                gs.mode = 'LONG_STRAIGHT';
                gs.targetCurvature = 0;
                gs.remainingSteps = 40 + Math.floor(Math.random() * 40); // 40-80 segments
                gs.currentCurvature = 0;
              } else if (gs.patternPhase === 1) {
                // HAIRPIN phase (tight 90 degree turn, limited to prevent loops)
                gs.mode = 'HAIRPIN';
                
                // ANTI-LOOP: Force direction alternation
                let direction: number;
                if (gs.lastHairpinDirection === 0) {
                  // First hairpin, choose randomly
                  direction = Math.random() > 0.5 ? 1 : -1;
                } else {
                  // Force opposite direction from last hairpin
                  direction = -gs.lastHairpinDirection;
                }
                
                // ANTI-LOOP: Limit hairpin to 90 degrees (π/2 radians)
                // Using 25-35 segments with 0.04-0.05 rad/segment = ~90 degrees total
                const segments = 25 + Math.floor(Math.random() * 10); // 25-35 segments
                const maxAngle = Math.PI / 2; // 90 degrees in radians
                const curvaturePerSegment = maxAngle / segments;
                
                gs.targetCurvature = direction * curvaturePerSegment;
                gs.remainingSteps = segments;
                gs.lastHairpinDirection = direction; // Remember for next hairpin
              } else {
                // SLIGHT_TURN_SEQUENCE phase (3 gentle turns)
                gs.mode = 'SLIGHT_TURN_SEQUENCE';
                gs.turnSequenceCount = 0;
                const direction = Math.random() > 0.5 ? 1 : -1;
                // Gentle curvature: 0.02 to 0.04 radians per segment
                gs.targetCurvature = direction * (0.02 + Math.random() * 0.02);
                gs.remainingSteps = 15 + Math.floor(Math.random() * 10); // Each turn is 15-25 segments
              }
            }

            // Handle slight turn sequence progression (3 turns)
            if (gs.mode === 'SLIGHT_TURN_SEQUENCE' && gs.remainingSteps === 0) {
              gs.turnSequenceCount++;
              if (gs.turnSequenceCount < 3) {
                // Create next turn in sequence (possibly opposite direction)
                const shouldReverse = Math.random() > 0.3; // 70% chance to continue, 30% to reverse
                const direction = shouldReverse ? -Math.sign(gs.targetCurvature) : Math.sign(gs.targetCurvature);
                gs.targetCurvature = direction * (0.02 + Math.random() * 0.02);
                gs.remainingSteps = 15 + Math.floor(Math.random() * 10);
              }
            }

            // Smooth transition of curvature for all modes
            const curvatureTransitionSpeed = gs.mode === 'HAIRPIN' ? 0.01 : 0.005;
            if (Math.abs(gs.currentCurvature - gs.targetCurvature) > 0.001) {
              if (gs.currentCurvature < gs.targetCurvature) {
                gs.currentCurvature += curvatureTransitionSpeed;
              } else {
                gs.currentCurvature -= curvatureTransitionSpeed;
              }
            } else {
              gs.currentCurvature = gs.targetCurvature;
            }

            // ANTI-LOOP: Decay cumulative angle during straights
            if (gs.mode === 'LONG_STRAIGHT') {
              // Gradually reset cumulative angle toward zero during straights
              const decayRate = 0.01; // Decay 0.01 radians per segment
              if (Math.abs(gs.cumulativeAngle) > decayRate) {
                gs.cumulativeAngle -= Math.sign(gs.cumulativeAngle) * decayRate;
              } else {
                gs.cumulativeAngle = 0;
              }
            }

            // Calculate current track angle
            const prevP = state.trackPoints[state.trackPoints.length-2];
            const currentAngle = Math.atan2(lastP.y - prevP.y, lastP.x - prevP.x);
            
            // Add segment with current curvature
            const segmentLength = 60;
            const newP = generateNextSegment(lastP, currentAngle + gs.currentCurvature, segmentLength);
            state.trackPoints.push(newP);
            gs.remainingSteps--;
            
            // ANTI-LOOP: Track cumulative angle change
            gs.cumulativeAngle += gs.currentCurvature;
        }
        
        // Speed-matched removal: remove track behind car based on distance
        const firstP = state.trackPoints[0];
        const distFromStart = Math.sqrt((car.x - firstP.x)**2 + (car.y - firstP.y)**2);
        
        // Remove old segments when they're far behind AND outside viewport
        const removalDistance = 1500; // Remove when 1500px behind car
        
        if (state.trackPoints.length > 300 && distFromStart > removalDistance) {
            const p0 = state.trackPoints[0];
            const p1 = state.trackPoints[1];
            // Calculate distance of the segment being removed
            const dist = Math.sqrt((p1.x - p0.x)**2 + (p1.y - p0.y)**2);
            
            // Accumulate offset (40 is the pattern length: 20 dash + 20 gap)
            state.dashOffset = (state.dashOffset + dist) % 40;

            state.trackPoints.shift();
            // Crucial: adjust checkpoint index because the array shifted
            state.lastCheckpointIndex = Math.max(0, state.lastCheckpointIndex - 1);
            state.checkpointsCrossed++;
        }
        
        // Update checkpoint progress
        // Find closest point ahead
        let bestIdx = -1;
        let bestDist = Infinity;
        // Look ahead 50 points
        for(let i = 0; i < 50; i++) {
             const idx = state.lastCheckpointIndex + i;
             if (idx >= state.trackPoints.length) break;
             const p = state.trackPoints[idx];
             const d = (car.x - p.x)**2 + (car.y - p.y)**2;
             if (d < bestDist) {
                 bestDist = d;
                 bestIdx = idx;
             }
        }
        
        if (bestIdx > state.lastCheckpointIndex) {
            state.lastCheckpointIndex = bestIdx;
        }

      } else if (track.type === TrackType.TOUGE && state.tougeState) {
        // === TOUGE LOGIC ===
        // Since we're driving upward (negative Y), we generate track at the front (index 0)
        // and remove track at the back (last index)
        const tougeState = state.tougeState;

        // Generate new track ahead (at the front when car is within 3000px)
        let generatedCount = 0;
        while (generatedCount < 200) { // Generate up to 200 segments per frame
          const firstP = state.trackPoints[0];
          const distToFront = Math.sqrt((car.x - firstP.x) ** 2 + (car.y - firstP.y) ** 2);

          // Stop if we have enough track ahead
          if (distToFront >= 3000 && state.trackPoints.length >= 100) break;

          const currentFirstPoint = state.trackPoints[0];
          const result = generateTougeSegment(currentFirstPoint, tougeState);
          state.trackPoints.unshift(result.point); // Add to front
          state.tougeState = result.state;
          state.lastCheckpointIndex++; // Adjust index since we added at front

          generatedCount++;

          // Safety: don't generate infinite in one frame
          if (state.trackPoints.length > 500) break;
        }

        // Remove old track points (behind the car at the end of the array)
        const lastP = state.trackPoints[state.trackPoints.length - 1];
        const distFromEnd = Math.sqrt((car.x - lastP.x) ** 2 + (car.y - lastP.y) ** 2);

        if (state.trackPoints.length > 300 && distFromEnd > 2000) {
          const p0 = state.trackPoints[state.trackPoints.length - 1];
          const p1 = state.trackPoints[state.trackPoints.length - 2];
          const dist = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);

          state.dashOffset = (state.dashOffset + dist) % 40;
          state.trackPoints.pop(); // Remove from end
          state.distanceTraveled += dist;
        }

        // Update checkpoint progress (find closest point ahead - toward front of array)
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < 50; i++) {
          const idx = state.lastCheckpointIndex - i; // Look backward in array (ahead in direction)
          if (idx < 0) break;
          const p = state.trackPoints[idx];
          const d = (car.x - p.x) ** 2 + (car.y - p.y) ** 2;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        }

        if (bestIdx >= 0 && bestIdx < state.lastCheckpointIndex) {
          state.lastCheckpointIndex = bestIdx;
        }

      } else if (track.type === TrackType.LOOP) {
        // LOOP LOGIC
        // Scan a window ahead of current checkpoint to find closer points
        const searchWindow = 50;
        let bestIdx = -1;
        let minD = Infinity;

        for (let i = 1; i <= searchWindow; i++) {
           const idx = (state.lastCheckpointIndex + i) % state.trackPoints.length;
           const p = state.trackPoints[idx];
           const d = (car.x - p.x)**2 + (car.y - p.y)**2;
           if (d < minD) {
              minD = d;
              bestIdx = idx;
           }
        }

        const currentP = state.trackPoints[state.lastCheckpointIndex];
        const currentD = (car.x - currentP.x)**2 + (car.y - currentP.y)**2;

        if (minD < currentD && minD < (track.width * 1.5)**2) {
             let advance = bestIdx - state.lastCheckpointIndex;
             if (advance < 0) advance += state.trackPoints.length;

             if (advance > 0 && advance < searchWindow) {
                 if (state.lastCheckpointIndex > state.trackPoints.length - searchWindow && bestIdx < searchWindow) {
                     state.currentLap++;
                 }
                 state.lastCheckpointIndex = bestIdx;
             }
        }

        if (state.currentLap > track.lapsToWin) {
            state.finished = true;
            onFinish(true, Date.now() - state.startTime);
        }
      }
      // URBAN mode has no gameplay logic (freeroam)

      if (Math.random() > 0.8) {
        setHud({
            lap: state.currentLap,
            time: Date.now() - state.startTime,
            speed: Math.floor(car.speed * 10)
        });
      }

      // --- RENDERING ---

      // Clear with biome-appropriate background color
      let bgColor = '#2d3728'; // Default grass
      if (track.type === TrackType.URBAN) {
        bgColor = '#3d5c3d'; // Urban grass
      } else if (track.type === TrackType.INFINITE) {
        bgColor = state.biome.color; // Use randomly selected biome for Endless Rally
      }
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Camera Follow
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.translate(-car.x, -car.y);

      // 1. Draw Track or Urban World
      if (track.type === TrackType.URBAN && urbanStateRef.current) {
        // Urban rendering
        const URBAN_COLORS = {
          ROAD_ASPHALT: '#4a4a4a',
          ROAD_MARKING_WHITE: '#ffffff',
          SIDEWALK: '#8b8b8b',
          GRASS: '#3d5c3d',
          SHADOW: 'rgba(0,0,0,0.3)'
        };

        // Render all loaded tiles
        for (const [key, tile] of urbanStateRef.current.loadedTiles) {
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
            ctx.strokeRect(
              worldX + building.x,
              worldY + building.y,
              building.width,
              building.height
            );
          }
        }
      } else if (track.type === TrackType.TOUGE) {
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

          // Draw guardrail posts every GUARDRAIL_POST_SPACING pixels
          if (i % Math.floor(TOUGE_CONFIG.GUARDRAIL_POST_SPACING / TOUGE_CONFIG.SEGMENT_LENGTH) === 0) {
            ctx.fillStyle = TOUGE_COLORS.GUARDRAIL_POST;
            const postX = p.x + perpX * offset;
            const postY = p.y + perpY * offset;
            ctx.fillRect(postX - 3, postY - 3, 6, 6);
          }
        }
        ctx.stroke();

      } else {
        // Standard track rendering
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Road Border
        ctx.lineWidth = track.width + 20;
        ctx.strokeStyle = '#5c4e38'; // Dirt/Gravel border
        ctx.beginPath();
        const drawPoints = state.trackPoints;
        ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
        for (let i = 1; i < drawPoints.length; i++) {
          ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
        }
        if (track.type === TrackType.LOOP) ctx.closePath();
        ctx.stroke();

        // Road Surface
        ctx.lineWidth = track.width;
        ctx.strokeStyle = '#808080'; // Asphalt
        ctx.stroke();

        // Center Line
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.setLineDash([20, 20]);
        if (track.type === TrackType.INFINITE) {
          ctx.lineDashOffset = -state.dashOffset;
        }
        ctx.beginPath();
        ctx.moveTo(drawPoints[0].x, drawPoints[0].y);
        for (let i = 1; i < drawPoints.length; i++) {
          ctx.lineTo(drawPoints[i].x, drawPoints[i].y);
        }
        if (track.type === TrackType.LOOP) ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Start/Finish Line
        if (track.type === TrackType.LOOP) {
            ctx.save();
            // We expect index 1 to be (0,0) or start, index 0 is lead-in.
            // Let's assume the start line is between point 1 and 2
            const startIdx = 1;
            if (drawPoints.length > startIdx + 1) {
                const pStart = drawPoints[startIdx];
                const pNext = drawPoints[startIdx+1];

                ctx.translate(pStart.x, pStart.y);
                const angle = Math.atan2(pNext.y - pStart.y, pNext.x - pStart.x);
                ctx.rotate(angle);

                // Checkered Line
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-10, -track.width/2, 20, track.width);
                ctx.fillStyle = '#000000';
                for(let i=0; i<10; i++) {
                  if(i%2===0) ctx.fillRect(-10, -track.width/2 + i*(track.width/10), 10, track.width/10);
                  else ctx.fillRect(0, -track.width/2 + i*(track.width/10), 10, track.width/10);
                }
            }
            ctx.restore();
        }
      }

      // 2. Draw Car
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      
      // Upscale Car based on tuning config, default to 4 if missing
      const carModelScale = tuning.carScale || 4;
      ctx.scale(carModelScale, carModelScale);

      // Check if we're using image mode and have an image loaded
      if (tuning.carSkinMode === 'image' && carImage) {
        // IMAGE MODE: Render PNG car skin
        const rotationOffset = (tuning.carSkinRotationOffset || 0) * (Math.PI / 180);
        ctx.rotate(rotationOffset);
        
        // Calculate size (scale down from 1024x1024 to fit)
        const imgSize = 32; // Base size for car
        ctx.drawImage(carImage, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
      } else {
        // VECTOR MODE: Classic Castrol livery car
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-18, -8, 36, 16);

        // Wheels
        ctx.fillStyle = '#111';
        ctx.save();
        ctx.translate(14, -10);
        ctx.rotate(car.steeringAngle);
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
        
        ctx.save();
        ctx.translate(14, 10);
        ctx.rotate(car.steeringAngle);
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();

        ctx.fillRect(-14, -12, 8, 4);
        ctx.fillRect(-14, 8, 8, 4);

        // Body (White)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(20, 0); 
        ctx.lineTo(15, -10); 
        ctx.lineTo(-18, -10); 
        ctx.lineTo(-20, -5); 
        ctx.lineTo(-20, 5); 
        ctx.lineTo(-18, 10); 
        ctx.lineTo(15, 10); 
        ctx.closePath();
        ctx.fill();

        // Castrol Livery (Red/Green Swooshes)
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#d40000';
        ctx.beginPath();
        ctx.moveTo(-15, -10);
        ctx.quadraticCurveTo(0, -5, 15, -2);
        ctx.stroke();
        
        ctx.strokeStyle = '#00853f';
        ctx.beginPath();
        ctx.moveTo(-15, 10);
        ctx.quadraticCurveTo(0, 5, 15, 2);
        ctx.stroke();

        // Spoiler
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-22, -10, 4, 20);
        ctx.fillStyle = '#d40000';
        ctx.fillRect(-22, -10, 4, 5);
        ctx.fillRect(-22, 5, 4, 5);

        // Windshield
        ctx.fillStyle = '#1a2b3c';
        ctx.beginPath();
        ctx.moveTo(5, -7);
        ctx.lineTo(-5, -8);
        ctx.lineTo(-5, 8);
        ctx.lineTo(5, 7);
        ctx.fill();

        // Brake Lights
        if (inputs.down && car.speed > 0.1) {
          ctx.fillStyle = '#ff0000';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#ff0000';
          ctx.fillRect(-21, -8, 2, 4);
          ctx.fillRect(-21, 4, 2, 4);
          ctx.shadowBlur = 0;
        }
      }
      
      ctx.restore(); // Undo camera translation
      ctx.restore(); // Undo camera center

      // --- MINI-MAP ---
      const mapSize = 200;
      const mapX = canvas.width - mapSize - 20;
      const mapY = 20;

      // Map Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.strokeRect(mapX, mapY, mapSize, mapSize);

      if (track.type === TrackType.URBAN && urbanStateRef.current) {
        // Urban minimap - show nearby tiles
        const urbanState = urbanStateRef.current;
        const mapScale = mapSize / (TILE_SIZE * 5); // Show 5x5 tile area
        const centerX = mapX + mapSize / 2;
        const centerY = mapY + mapSize / 2;

        // Draw tiles
        for (const [key, tile] of urbanState.loadedTiles) {
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
      } else {
        // Standard track minimap
        // Find bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        // Sampling points for performance if array is huge, but < 1000 is fine
        const mapPoints = state.trackPoints;
        mapPoints.forEach(p => {
           if (p.x < minX) minX = p.x;
           if (p.x > maxX) maxX = p.x;
           if (p.y < minY) minY = p.y;
           if (p.y > maxY) maxY = p.y;
        });
        // Ensure car is in bounds (it should be near track)
        minX = Math.min(minX, car.x);
        maxX = Math.max(maxX, car.x);
        minY = Math.min(minY, car.y);
        maxY = Math.max(maxY, car.y);

        const padding = track.width + 500;
        minX -= padding; maxX += padding; minY -= padding; maxY += padding;
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const mapScale = Math.min(mapSize / rangeX, mapSize / rangeY);

        const toMapX = (x: number) => mapX + (x - minX) * mapScale + (mapSize - rangeX * mapScale) / 2;
        const toMapY = (y: number) => mapY + (y - minY) * mapScale + (mapSize - rangeY * mapScale) / 2;

        // Draw Mini Track
        ctx.beginPath();
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 3;
        if (mapPoints.length > 0) {
          ctx.moveTo(toMapX(mapPoints[0].x), toMapY(mapPoints[0].y));
          for (let i = 1; i < mapPoints.length; i++) {
             ctx.lineTo(toMapX(mapPoints[i].x), toMapY(mapPoints[i].y));
          }
        }
        if (track.type === TrackType.LOOP) ctx.closePath();
        ctx.stroke();

        // Draw Mini Car
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(toMapX(car.x), toMapY(car.y), 4, 0, Math.PI * 2);
        ctx.fill();

        // Mini Car Direction
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(toMapX(car.x), toMapY(car.y));
        ctx.lineTo(toMapX(car.x + Math.cos(car.angle) * 500), toMapY(car.y + Math.sin(car.angle) * 500));
        ctx.stroke();
      }
      
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [track, tuning, onFinish, onExit]);

  // Canvas Resize
  useEffect(() => {
    const handleResize = () => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    const dec = Math.floor((ms % 1000) / 100);
    return `${m}:${remS.toString().padStart(2, '0')}.${dec}`;
  };

  return (
    <div className="relative w-full h-full cursor-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* HUD */}
      <div className="absolute top-4 left-4 text-white font-mono text-2xl drop-shadow-md select-none pointer-events-none">
        <div className="flex flex-col gap-2">
            {isGamepadConnected && (
                <div className="bg-black/50 p-2 rounded border-l-4 border-purple-500">
                    <span className="text-gray-400 text-sm">INPUT</span><br/>
                    <span className="text-lg">🎮 GAMEPAD</span>
                </div>
            )}
            <div className="bg-black/50 p-2 rounded border-l-4 border-red-500">
                <span className="text-gray-400 text-sm">TIME</span><br/>
                {formatTime(hud.time)}
            </div>
            {track.type === TrackType.LOOP && (
                <div className="bg-black/50 p-2 rounded border-l-4 border-green-500">
                    <span className="text-gray-400 text-sm">LAP</span><br/>
                    {hud.lap} / {track.lapsToWin}
                </div>
            )}
            {track.type === TrackType.TOUGE && (
                <div className="bg-black/50 p-2 rounded border-l-4 border-blue-500">
                    <span className="text-gray-400 text-sm">DISTANCE</span><br/>
                    {Math.floor(gameStateRef.current.distanceTraveled / 10)} <span className="text-xs">M</span>
                </div>
            )}
            <div className="bg-black/50 p-2 rounded border-l-4 border-yellow-500">
                <span className="text-gray-400 text-sm">SPEED</span><br/>
                {hud.speed} <span className="text-xs">KM/H</span>
            </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 text-white/50 text-sm font-sans select-none pointer-events-none text-right">
        {isGamepadConnected ? (
          <>
            GAMEPAD CONTROLS<br/>
            RT : ACCELERATE<br/>
            LT : BRAKE/REVERSE<br/>
            LEFT STICK : STEER<br/>
            A / RB : HANDBRAKE<br/>
            START : MENU
          </>
        ) : (
          <>
            CONTROLS<br/>
            W / UP : ACCELERATE<br/>
            S / DOWN : BRAKE/REVERSE<br/>
            A / LEFT : TURN LEFT<br/>
            D / RIGHT : TURN RIGHT<br/>
            ESC : MENU
          </>
        )}
      </div>
    </div>
  );
};

export default GameEngine;
