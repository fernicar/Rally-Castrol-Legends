import React from 'react';
import { TuningConfig, DEFAULT_TUNING, TrackData } from '../types';

interface DebugMenuProps {
  config: TuningConfig;
  onConfigChange: (newConfig: TuningConfig) => void;
  tracks?: TrackData[];
  onTracksChange?: (newTracks: TrackData[]) => void;
  onClose: () => void;
}

const DebugMenu: React.FC<DebugMenuProps> = ({ config, onConfigChange, tracks, onTracksChange, onClose }) => {
  const handleChange = (key: keyof TuningConfig, value: string) => {
    onConfigChange({
      ...config,
      [key]: parseFloat(value)
    });
  };

  const handleExport = (filename: string, data: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>, callback: (data: any) => void) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = (e) => {
        try {
          if (e.target?.result) {
            const parsed = JSON.parse(e.target.result as string);
            callback(parsed);
          }
        } catch (error) {
          console.error("Invalid JSON", error);
          alert("Failed to load JSON");
        }
      };
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-black/80 text-white overflow-y-auto p-4 backdrop-blur-md border-l border-green-500 z-50 shadow-2xl">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-black/80 pb-2 border-b border-gray-700 pt-2 -mt-2">
        <h2 className="text-xl font-bold text-green-400">Debug / Tuning</h2>
        <button onClick={onClose} className="text-red-400 font-bold hover:text-red-200 px-2">X</button>
      </div>

      <div className="space-y-4 text-sm pb-8">
        
        {/* TRACK MANAGEMENT */}
        {tracks && onTracksChange && (
          <div className="bg-gray-800 p-2 rounded mb-4">
            <h3 className="text-yellow-500 font-bold mb-2">Track Management</h3>
            <div className="flex gap-2 mb-2">
              <button onClick={() => handleExport("rally_tracks.json", tracks)} className="flex-1 bg-yellow-700 hover:bg-yellow-600 py-2 rounded text-xs font-bold uppercase">
                Export Tracks
              </button>
              <label className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-xs font-bold uppercase text-center cursor-pointer">
                 Import Tracks
                 <input type="file" accept=".json" onChange={(e) => handleImport(e, (data) => onTracksChange(data))} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* VISUALS */}
        <h3 className="text-green-400 font-bold border-b border-gray-700 pb-1">Visuals</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Car Scale (x{config.carScale})</label>
          <input type="range" min="1" max="4" step="0.1" 
            value={config.carScale || 4} onChange={(e) => handleChange('carScale', e.target.value)} className="w-full accent-green-500"/>
        </div>

        {/* CAR PHYSICS */}
        <h3 className="text-green-400 font-bold border-b border-gray-700 pb-1 mt-4">Car Physics</h3>

        {/* Speed */}
        <div className="space-y-1">
          <label className="text-gray-400 block">Max Speed ({config.maxSpeed})</label>
          <input type="range" min="5" max="50" step="0.5" 
            value={config.maxSpeed} onChange={(e) => handleChange('maxSpeed', e.target.value)} className="w-full accent-green-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Acceleration ({config.acceleration})</label>
          <input type="range" min="0.01" max="1" step="0.01" 
            value={config.acceleration} onChange={(e) => handleChange('acceleration', e.target.value)} className="w-full accent-green-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Brake Power ({config.brakePower})</label>
          <input type="range" min="0.1" max="2" step="0.1" 
            value={config.brakePower} onChange={(e) => handleChange('brakePower', e.target.value)} className="w-full accent-green-500"/>
        </div>
        
        <hr className="border-gray-700"/>

        {/* Steering */}
        <div className="space-y-1">
          <label className="text-gray-400 block">Steer Speed ({config.steerSpeed})</label>
          <input type="range" min="0.01" max="0.3" step="0.01" 
            value={config.steerSpeed} onChange={(e) => handleChange('steerSpeed', e.target.value)} className="w-full accent-green-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Steer Return ({config.steerReturn})</label>
          <input type="range" min="0.01" max="0.3" step="0.01" 
            value={config.steerReturn} onChange={(e) => handleChange('steerReturn', e.target.value)} className="w-full accent-green-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Max Angle ({config.maxSteerAngle})</label>
          <input type="range" min="0.1" max="1.5" step="0.1" 
            value={config.maxSteerAngle} onChange={(e) => handleChange('maxSteerAngle', e.target.value)} className="w-full accent-green-500"/>
        </div>

        <hr className="border-gray-700"/>

        {/* Drift/Friction */}
        <div className="space-y-1">
          <label className="text-gray-400 block">Grip/Stiffness ({config.corneringStiffness})</label>
          <input type="range" min="0.01" max="0.5" step="0.01" 
            value={config.corneringStiffness} onChange={(e) => handleChange('corneringStiffness', e.target.value)} className="w-full accent-green-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Surface Friction ({config.friction})</label>
          <input type="range" min="0" max="0.2" step="0.005" 
            value={config.friction} onChange={(e) => handleChange('friction', e.target.value)} className="w-full accent-green-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Offroad Drag ({config.offRoadFriction})</label>
          <input type="range" min="0.05" max="0.5" step="0.01" 
            value={config.offRoadFriction} onChange={(e) => handleChange('offRoadFriction', e.target.value)} className="w-full accent-green-500"/>
        </div>

        <div className="pt-4 flex gap-2">
          <button onClick={() => handleExport("rally_tuning.json", config)} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded text-xs font-bold uppercase">Save Config</button>
          <label className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-xs font-bold uppercase text-center cursor-pointer">
             Load Config
             <input type="file" accept=".json" onChange={(e) => handleImport(e, (data) => onConfigChange({ ...DEFAULT_TUNING, ...data }))} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default DebugMenu;