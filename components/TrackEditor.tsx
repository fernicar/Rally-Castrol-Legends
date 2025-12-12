import React, { useEffect, useRef, useState } from 'react';
import { TrackData, Point, TrackType } from '../types';
import { generateTrackPoints } from '../services/trackService';

interface TrackEditorProps {
  track: TrackData;
  onSave: (updatedTrack: TrackData) => void;
  onCancel: () => void;
}

const TrackEditor: React.FC<TrackEditorProps> = ({ track, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Editor State
  const [controlPoints, setControlPoints] = useState<Point[]>([...track.controlPoints]);
  const [generatedPoints, setGeneratedPoints] = useState<Point[]>([...track.points]);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.3 }); // Zoomed out by default
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [panning, setPanning] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Regenerate track when control points change
    setGeneratedPoints(generateTrackPoints(controlPoints));
  }, [controlPoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      // Clear
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.save();
      ctx.translate(canvas.width / 2 + camera.x, canvas.height / 2 + camera.y);
      ctx.scale(camera.zoom, camera.zoom);

      // Draw Grid
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2 / camera.zoom;
      const gridSize = 500;
      const viewW = canvas.width / camera.zoom;
      const viewH = canvas.height / camera.zoom;
      // Simple large grid for context
      const startX = Math.floor((-viewW/2 - camera.x/camera.zoom) / gridSize) * gridSize;
      const startY = Math.floor((-viewH/2 - camera.y/camera.zoom) / gridSize) * gridSize;
      
      for(let x = startX; x < startX + viewW + gridSize * 2; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, startY + viewH + gridSize*2); ctx.stroke();
      }
      for(let y = startY; y < startY + viewH + gridSize * 2; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(startX + viewW + gridSize*2, y); ctx.stroke();
      }

      // Draw Axis
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 4 / camera.zoom;
      ctx.beginPath(); ctx.moveTo(-5000, 0); ctx.lineTo(5000, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -5000); ctx.lineTo(0, 5000); ctx.stroke();

      // Draw Track Road
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = track.width;
      ctx.strokeStyle = '#444'; 
      ctx.beginPath();
      if (generatedPoints.length > 0) {
        ctx.moveTo(generatedPoints[0].x, generatedPoints[0].y);
        for (let i = 1; i < generatedPoints.length; i++) {
          ctx.lineTo(generatedPoints[i].x, generatedPoints[i].y);
        }
        if (track.type === TrackType.LOOP) ctx.closePath();
      }
      ctx.stroke();

      // Draw Track Center Line
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      if (generatedPoints.length > 0) {
        ctx.moveTo(generatedPoints[0].x, generatedPoints[0].y);
        for (let i = 1; i < generatedPoints.length; i++) {
          ctx.lineTo(generatedPoints[i].x, generatedPoints[i].y);
        }
        if (track.type === TrackType.LOOP) ctx.closePath();
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Control Points
      controlPoints.forEach((p, idx) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 40 / Math.sqrt(camera.zoom), 0, Math.PI * 2);
        
        if (idx === 1) ctx.fillStyle = '#00ff00'; // Start point approximation
        else ctx.fillStyle = idx === draggingIdx ? '#ffff00' : '#ff0000';
        
        ctx.fill();
        ctx.lineWidth = 2 / camera.zoom;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Label
        ctx.fillStyle = '#fff';
        ctx.font = `${30 / Math.sqrt(camera.zoom)}px monospace`;
        ctx.fillText(idx.toString(), p.x + 20, p.y - 20);
      });

      // Draw Control Lines (Polygon)
      ctx.lineWidth = 1 / camera.zoom;
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
      ctx.beginPath();
      if (controlPoints.length > 0) {
        ctx.moveTo(controlPoints[0].x, controlPoints[0].y);
        for (let i = 1; i < controlPoints.length; i++) {
          ctx.lineTo(controlPoints[i].x, controlPoints[i].y);
        }
        if (track.type === TrackType.LOOP) ctx.closePath();
      }
      ctx.stroke();

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animationId);
  }, [controlPoints, generatedPoints, camera, draggingIdx, track]);

  // Interaction Handlers
  const getMousePos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const screenToWorld = (sx: number, sy: number) => {
    return {
      x: (sx - canvasRef.current!.width / 2 - camera.x) / camera.zoom,
      y: (sy - canvasRef.current!.height / 2 - camera.y) / camera.zoom
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const worldPos = screenToWorld(pos.x, pos.y);
    setLastMouse(pos);

    // Right click or Middle click -> Pan
    if (e.button === 2 || e.button === 1) {
      setPanning(true);
      return;
    }

    // Left click -> Check collision with control points
    // Hitbox radius
    const hitRadius = 50 / camera.zoom;
    let hitIdx = -1;
    for (let i = 0; i < controlPoints.length; i++) {
      const p = controlPoints[i];
      const dist = Math.sqrt((p.x - worldPos.x) ** 2 + (p.y - worldPos.y) ** 2);
      if (dist < hitRadius) {
        hitIdx = i;
        break;
      }
    }

    if (hitIdx !== -1) {
      setDraggingIdx(hitIdx);
    } else {
      // Also allow panning if clicking background
      setPanning(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    
    if (panning) {
      const dx = pos.x - lastMouse.x;
      const dy = pos.y - lastMouse.y;
      setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    } else if (draggingIdx !== null) {
      const worldPos = screenToWorld(pos.x, pos.y);
      setControlPoints(prev => {
        const next = [...prev];
        next[draggingIdx] = { x: worldPos.x, y: worldPos.y };
        return next;
      });
    }

    setLastMouse(pos);
  };

  const handleMouseUp = () => {
    setPanning(false);
    setDraggingIdx(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.001;
    const newZoom = Math.max(0.05, Math.min(5, camera.zoom - e.deltaY * zoomSensitivity));
    setCamera(prev => ({ ...prev, zoom: newZoom }));
  };

  const handleSave = () => {
    const newTrack = {
      ...track,
      points: generatedPoints,
      controlPoints: controlPoints
    };
    onSave(newTrack);
  };

  useEffect(() => {
    const handleResize = () => {
      if(canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full bg-neutral-900" onContextMenu={e => e.preventDefault()}>
      <canvas 
        ref={canvasRef}
        className="block w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      <div className="absolute top-4 left-4 bg-black/80 text-white p-4 rounded shadow-lg pointer-events-none select-none">
        <h2 className="text-xl font-bold mb-2 text-yellow-500">TRACK EDITOR: {track.name.toUpperCase()}</h2>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Left Drag Points to Move</li>
          <li>• Right Drag or Drag Background to Pan</li>
          <li>• Scroll to Zoom</li>
        </ul>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
        <button onClick={handleSave} className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded shadow-lg border border-green-400">
          SAVE CHANGES
        </button>
        <button onClick={onCancel} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg border border-red-400">
          CANCEL / DISCARD
        </button>
      </div>
    </div>
  );
};

export default TrackEditor;