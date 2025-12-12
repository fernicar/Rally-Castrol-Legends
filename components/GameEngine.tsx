import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CarState, TuningConfig, TrackData, Point, TrackType } from '../types';
import { generateNextSegment } from '../services/trackService';

interface GameEngineProps {
  track: TrackData;
  tuning: TuningConfig;
  onFinish: (win: boolean, time: number) => void;
  onExit: () => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ track, tuning, onFinish, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs (Mutable for loop performance)
  const carRef = useRef<CarState>({
    x: track.points[1].x, // Start at index 1 (0,0) usually, index 0 is lead-in
    y: track.points[1].y,
    speed: 0,
    angle: 0, // Facing East initially
    velocity: { x: 0, y: 0 },
    steeringAngle: 0,
    driftFactor: 0
  });

  const inputsRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    space: false
  });

  const gameStateRef = useRef({
    startTime: Date.now(),
    currentLap: 1,
    lastCheckpointIndex: 1, // Start a bit into the array
    trackPoints: [...track.points], // Clone points for infinite modification
    infiniteSeed: 0,
    checkpointsCrossed: 0,
    finished: false,
    dashOffset: 0,
    // Infinite Gen State Machine
    genState: {
      mode: 'STRAIGHT' as 'STRAIGHT' | 'CURVE',
      remainingSteps: 20,
      targetCurvature: 0,
      currentCurvature: 0
    }
  });

  // UI State (synced less frequently if needed, but here simple enough)
  const [hud, setHud] = useState({ lap: 1, time: 0, speed: 0 });

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

  // Main Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const loop = () => {
      if (gameStateRef.current.finished) return;

      const car = carRef.current;
      const inputs = inputsRef.current;
      const state = gameStateRef.current;

      // --- PHYSICS UPDATE ---
      
      // 1. Steering Logic
      let targetSteer = 0;
      if (inputs.left) targetSteer = -tuning.maxSteerAngle;
      if (inputs.right) targetSteer = tuning.maxSteerAngle;

      // Move current steer towards target
      if (targetSteer !== 0) {
        if (targetSteer > car.steeringAngle) car.steeringAngle = Math.min(targetSteer, car.steeringAngle + tuning.steerSpeed);
        else car.steeringAngle = Math.max(targetSteer, car.steeringAngle - tuning.steerSpeed);
      } else {
        if (car.steeringAngle > 0) car.steeringAngle = Math.max(0, car.steeringAngle - tuning.steerReturn);
        else if (car.steeringAngle < 0) car.steeringAngle = Math.min(0, car.steeringAngle + tuning.steerReturn);
      }

      // 2. Acceleration / Braking
      let engineForce = 0;
      if (inputs.up) {
        engineForce = tuning.acceleration;
      }
      if (inputs.down) {
        const movingForward = (car.velocity.x * Math.cos(car.angle) + car.velocity.y * Math.sin(car.angle)) > 0.1;
        if (movingForward) {
           engineForce = -tuning.brakePower; 
        } else {
           engineForce = -tuning.reversePower;
        }
      }

      // 3. Apply Forces to Velocity
      car.velocity.x += Math.cos(car.angle) * engineForce;
      car.velocity.y += Math.sin(car.angle) * engineForce;

      // 4. Update Position
      car.x += car.velocity.x;
      car.y += car.velocity.y;

      // 5. Friction & Drag & Offroad
      const speed = Math.sqrt(car.velocity.x ** 2 + car.velocity.y ** 2);
      
      // Detect Offroad
      let minDist = Infinity;
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
          
          // Infinite track doesn't wrap last to first
          if (track.type === TrackType.INFINITE && idx === totalPoints - 1) continue;

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
      
      const isOffroad = minDist > (track.width / 2);
      const currentFriction = isOffroad ? tuning.offRoadFriction : tuning.friction;

      // Apply Drag 
      car.velocity.x *= (1 - tuning.drag);
      car.velocity.y *= (1 - tuning.drag);

      // Apply Friction 
      if (speed > 0) {
        car.velocity.x *= (1 - currentFriction);
        car.velocity.y *= (1 - currentFriction);
      }

      // 6. Angular Physics 
      if (speed > 0.5) {
        car.angle += car.steeringAngle * (speed / tuning.maxSpeed) * 0.5;

        const currentSpeed = Math.sqrt(car.velocity.x**2 + car.velocity.y**2);
        const velocityAngle = Math.atan2(car.velocity.y, car.velocity.x);
        
        let diff = car.angle - velocityAngle;
        while (diff <= -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        const grip = tuning.corneringStiffness * (isOffroad ? 0.5 : 1.0);
        const newVelocityAngle = velocityAngle + diff * grip;

        car.velocity.x = Math.cos(newVelocityAngle) * currentSpeed;
        car.velocity.y = Math.sin(newVelocityAngle) * currentSpeed;

        car.driftFactor = Math.abs(diff);
      }

      // Cap max speed
      const newSpeed = Math.sqrt(car.velocity.x**2 + car.velocity.y**2);
      if (newSpeed > tuning.maxSpeed) {
        const ratio = tuning.maxSpeed / newSpeed;
        car.velocity.x *= ratio;
        car.velocity.y *= ratio;
      }
      car.speed = newSpeed;


      // --- GAMEPLAY UPDATE ---

      if (track.type === TrackType.INFINITE) {
        const lastP = state.trackPoints[state.trackPoints.length-1];
        const distToEnd = Math.sqrt((car.x - lastP.x)**2 + (car.y - lastP.y)**2);
        
        // Generate new track ahead
        if (distToEnd < 4000) {
            const gs = state.genState;
            
            if (gs.remainingSteps <= 0) {
              // Pick new state
              const rand = Math.random();
              if (gs.mode === 'CURVE') {
                // After curve, likely go straight
                gs.mode = 'STRAIGHT';
                gs.targetCurvature = 0;
                gs.remainingSteps = 20 + Math.floor(Math.random() * 20); // Longer straights
              } else {
                // After straight, turn
                gs.mode = 'CURVE';
                const direction = Math.random() > 0.5 ? 1 : -1;
                // Harder curves: 0.05 to 0.15 radians per segment
                gs.targetCurvature = direction * (0.05 + Math.random() * 0.1); 
                gs.remainingSteps = 30 + Math.floor(Math.random() * 30);
              }
            }

            // Smooth transition of curvature
            if (gs.currentCurvature < gs.targetCurvature) gs.currentCurvature += 0.005;
            if (gs.currentCurvature > gs.targetCurvature) gs.currentCurvature -= 0.005;
            // Snap if close
            if (Math.abs(gs.currentCurvature - gs.targetCurvature) < 0.005) gs.currentCurvature = gs.targetCurvature;

            // Calculate current track angle
            const prevP = state.trackPoints[state.trackPoints.length-2];
            const currentAngle = Math.atan2(lastP.y - prevP.y, lastP.x - prevP.x);
            
            // Add segment
            const newP = generateNextSegment(lastP, currentAngle + gs.currentCurvature, 60);
            state.trackPoints.push(newP);
            gs.remainingSteps--;
        }
        
        // Remove old track points to manage memory ("forgetting" old track)
        // AND Update dashed line offset to avoid glitching
        if (state.trackPoints.length > 400) {
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

      } else {
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

      if (Math.random() > 0.8) {
        setHud({
            lap: state.currentLap,
            time: Date.now() - state.startTime,
            speed: Math.floor(car.speed * 10)
        });
      }

      // --- RENDERING ---
      
      // Clear
      ctx.fillStyle = '#2d3728'; // Dark grass color
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Camera Follow
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.translate(-car.x, -car.y);

      // 1. Draw Track
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

      // 2. Draw Car (Toyota Celica Castrol Style)
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      
      // Upscale Car based on tuning config, default to 4 if missing
      const carModelScale = tuning.carScale || 4;
      ctx.scale(carModelScale, carModelScale);

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
      
      ctx.restore(); // Undo camera translation
      ctx.restore(); // Undo camera center

      // --- MINI-MAP ---
      const mapSize = 200;
      const mapX = canvas.width - mapSize - 20;
      const mapY = 20;

      // Map Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(mapX, mapY, mapSize, mapSize);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.strokeRect(mapX, mapY, mapSize, mapSize);

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
      
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [track, tuning, onFinish]);

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
            <div className="bg-black/50 p-2 rounded border-l-4 border-yellow-500">
                <span className="text-gray-400 text-sm">SPEED</span><br/>
                {hud.speed} <span className="text-xs">KM/H</span>
            </div>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 text-white/50 text-sm font-sans select-none pointer-events-none text-right">
        CONTROLS<br/>
        W / UP : ACCELERATE<br/>
        S / DOWN : BRAKE/REVERSE<br/>
        A / LEFT : TURN LEFT<br/>
        D / RIGHT : TURN RIGHT<br/>
        ESC : MENU
      </div>
    </div>
  );
};

export default GameEngine;