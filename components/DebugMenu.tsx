import React, { useState } from 'react';
import { TuningConfig, DEFAULT_TUNING, TrackData } from '../types';
import { saveCarSkin, validateImageFile, fileToBlob } from '../services/carSkinStorage';

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

  const loadPreset = async (presetName: string) => {
    try {
      const response = await fetch(`presets/${presetName}.json`);
      if (response.ok) {
        const preset = await response.json();
        onConfigChange({ ...DEFAULT_TUNING, ...preset });
        console.log(`Loaded ${preset.presetName} preset`);
      } else {
        console.error(`Failed to load preset: ${presetName}`);
      }
    } catch (error) {
      console.error(`Error loading preset ${presetName}:`, error);
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-black/80 text-white overflow-y-auto p-4 backdrop-blur-md border-l border-green-500 z-50 shadow-2xl">
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-black/80 pb-2 border-b border-gray-700 pt-2 -mt-2">
        <h2 className="text-xl font-bold text-green-400">Debug / Tuning</h2>
        <button onClick={onClose} className="text-red-400 font-bold hover:text-red-200 px-2">X</button>
      </div>

      <div className="space-y-4 text-sm pb-8">
        
        {/* VERSION INFO */}
        <div className="bg-blue-900/30 p-2 rounded mb-4 text-xs">
          <strong>Physics Version:</strong> {config._version || 1}<br/>
          {(!config._version || config._version === 1) && <span className="text-yellow-400">⚠️ Old config detected - using defaults for new parameters</span>}
          {config._version === 2 && <span className="text-green-400">✓ Phase 1 Active</span>}
          {config._version === 3 && <span className="text-cyan-400">✓ Phase 2 Active (Tire Model)</span>}
          {config._version === 4 && <span className="text-orange-400">✓ Phase 3 Active (Drivetrain & Braking)</span>}
          {config._version === 5 && <span className="text-pink-400">✓ Phase 4 Active (Steering & Assists)</span>}
        </div>
        
        {/* PRESET SELECTOR */}
        <div className="bg-gradient-to-r from-red-900/30 to-green-900/30 p-3 rounded mb-4 border border-red-500/30">
          <h3 className="text-white font-bold mb-2 text-center">📦 QUICK PRESETS</h3>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <button onClick={() => loadPreset('track')} className="bg-blue-600 hover:bg-blue-500 py-2 rounded text-xs font-bold uppercase transition-colors">
              🏁 Track
            </button>
            <button onClick={() => loadPreset('rally')} className="bg-yellow-600 hover:bg-yellow-500 py-2 rounded text-xs font-bold uppercase transition-colors">
              🏔️ Rally
            </button>
            <button onClick={() => loadPreset('drift')} className="bg-red-600 hover:bg-red-500 py-2 rounded text-xs font-bold uppercase transition-colors">
              💨 Drift
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center italic">
            {config.presetName ? `Active: ${config.presetName}` : 'Custom Tuning'}
          </p>
        </div>
        
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

        {/* CAR APPEARANCE */}
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-3 rounded my-4 border border-blue-500/30">
          <h3 className="text-white font-bold mb-3 text-center">🚗 CAR APPEARANCE</h3>
          
          {/* Mode Selector */}
          <div className="space-y-2 mb-3">
            <label className="text-gray-300 block font-semibold">Car Skin Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => onConfigChange({ ...config, carSkinMode: 'vector' })}
                className={`flex-1 py-2 px-3 rounded text-xs font-bold uppercase transition-colors ${
                  config.carSkinMode === 'vector'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                🎨 Vector Car
              </button>
              <button
                onClick={() => onConfigChange({ ...config, carSkinMode: 'image' })}
                className={`flex-1 py-2 px-3 rounded text-xs font-bold uppercase transition-colors ${
                  config.carSkinMode === 'image'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                🖼️ Image Skin
              </button>
            </div>
            <p className="text-xs text-gray-400 italic">
              {config.carSkinMode === 'vector' ? 'Using classic Castrol livery' : 'Using custom PNG image'}
            </p>
          </div>

          {/* Image Mode Controls */}
          {config.carSkinMode === 'image' && (
            <>
              {/* Rotation Offset Selector */}
              <div className="space-y-2 mb-3">
                <label className="text-gray-300 block font-semibold">
                  Image Rotation Offset ({config.carSkinRotationOffset || 0}°)
                </label>
                <select
                  value={config.carSkinRotationOffset || 0}
                  onChange={(e) => onConfigChange({ ...config, carSkinRotationOffset: parseInt(e.target.value) })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="0">0° - East (Right) ➡️</option>
                  <option value="90">90° - South (Down) ⬇️</option>
                  <option value="180">180° - West (Left) ⬅️</option>
                  <option value="270">270° - North (Up) ⬆️</option>
                </select>
                <p className="text-xs text-gray-400">
                  Select the direction your car image faces
                </p>
              </div>

              {/* File Upload */}
              <div className="space-y-2 mb-3">
                <label className="text-gray-300 block font-semibold">Upload Custom Skin</label>
                <label className="block">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const validation = validateImageFile(file);
                        if (!validation.valid) {
                          alert(validation.error);
                          return;
                        }
                        try {
                          const id = `custom_${Date.now()}`;
                          await saveCarSkin(id, file);
                          onConfigChange({
                            ...config,
                            carSkinMode: 'image',
                            carSkinImage: id
                          });
                          alert('Custom skin uploaded successfully!');
                        } catch (error) {
                          console.error('Upload failed:', error);
                          alert('Failed to upload skin');
                        }
                      }
                      e.target.value = ''; // Reset input
                    }}
                    className="hidden"
                  />
                  <div className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded text-center cursor-pointer transition-colors">
                    📁 Choose PNG File
                  </div>
                </label>
                <p className="text-xs text-gray-400">
                  Max 10MB • PNG, JPG, or WebP
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <label className="text-gray-300 block font-semibold">Quick Actions</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onConfigChange({
                      ...config,
                      carSkinMode: 'image',
                      carSkinImage: 'cars/bmw/bmw.png',
                      carSkinRotationOffset: 270
                    })}
                    className="bg-blue-700 hover:bg-blue-600 py-2 px-3 rounded text-xs font-bold uppercase transition-colors"
                  >
                    🏎️ BMW Default
                  </button>
                  <button
                    onClick={() => onConfigChange({
                      ...config,
                      carSkinMode: 'vector'
                    })}
                    className="bg-green-700 hover:bg-green-600 py-2 px-3 rounded text-xs font-bold uppercase transition-colors"
                  >
                    🎨 Classic Vector
                  </button>
                </div>
              </div>

              {/* Current Skin Info */}
              {config.carSkinImage && (
                <div className="mt-3 p-2 bg-gray-800 rounded text-xs">
                  <strong className="text-gray-300">Active Skin:</strong>
                  <p className="text-gray-400 truncate">{config.carSkinImage}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* PHASE 1: MASS & INERTIA */}
        <h3 className="text-cyan-400 font-bold border-b border-cyan-700 pb-1 mt-4">Phase 1: Mass & Inertia</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Mass ({config.mass || 1100} kg)</label>
          <input type="range" min="800" max="2000" step="50" 
            value={config.mass || 1100} onChange={(e) => handleChange('mass', e.target.value)} className="w-full accent-cyan-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Inertia Multiplier ({(config.inertiaMultiplier || 1.2).toFixed(1)})</label>
          <input type="range" min="0.5" max="3.0" step="0.1" 
            value={config.inertiaMultiplier || 1.2} onChange={(e) => handleChange('inertiaMultiplier', e.target.value)} className="w-full accent-cyan-500"/>
          <span className="text-xs text-gray-500">High = boat-like, Low = twitchy</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Center of Mass Offset ({(config.centerOfMassOffset || 0).toFixed(1)})</label>
          <input type="range" min="-1" max="1" step="0.1" 
            value={config.centerOfMassOffset || 0} onChange={(e) => handleChange('centerOfMassOffset', e.target.value)} className="w-full accent-cyan-500"/>
          <span className="text-xs text-gray-500">-1 = front bias, +1 = rear bias</span>
        </div>

        {/* PHASE 1: WEIGHT TRANSFER */}
        <h3 className="text-cyan-400 font-bold border-b border-cyan-700 pb-1 mt-4">Phase 1: Weight Transfer</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Weight Distribution ({((config.weightDistribution || 0.5) * 100).toFixed(0)}% front)</label>
          <input type="range" min="0.3" max="0.7" step="0.01" 
            value={config.weightDistribution || 0.5} onChange={(e) => handleChange('weightDistribution', e.target.value)} className="w-full accent-cyan-500"/>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Accel Transfer ({(config.weightTransferAccel || 0.4).toFixed(2)})</label>
          <input type="range" min="0" max="1" step="0.05" 
            value={config.weightTransferAccel || 0.4} onChange={(e) => handleChange('weightTransferAccel', e.target.value)} className="w-full accent-cyan-500"/>
          <span className="text-xs text-gray-500">Weight shift rearward on throttle</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Brake Transfer ({(config.weightTransferBrake || 0.5).toFixed(2)})</label>
          <input type="range" min="0" max="1" step="0.05" 
            value={config.weightTransferBrake || 0.5} onChange={(e) => handleChange('weightTransferBrake', e.target.value)} className="w-full accent-cyan-500"/>
          <span className="text-xs text-gray-500">Weight shift forward on braking</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Lateral Transfer ({(config.weightTransferLateral || 0.3).toFixed(2)})</label>
          <input type="range" min="0" max="1" step="0.05" 
            value={config.weightTransferLateral || 0.3} onChange={(e) => handleChange('weightTransferLateral', e.target.value)} className="w-full accent-cyan-500"/>
          <span className="text-xs text-gray-500">Weight shift in corners</span>
        </div>

        {/* PHASE 1: ANGULAR DYNAMICS */}
        <h3 className="text-cyan-400 font-bold border-b border-cyan-700 pb-1 mt-4">Phase 1: Angular Dynamics</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Angular Damping ({(config.angularDamping || 0.95).toFixed(2)})</label>
          <input type="range" min="0.90" max="0.99" step="0.01" 
            value={config.angularDamping || 0.95} onChange={(e) => handleChange('angularDamping', e.target.value)} className="w-full accent-cyan-500"/>
          <span className="text-xs text-gray-500">Rotation decay rate</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Max Angular Velocity ({(config.angularVelocityMax || 0.15).toFixed(2)})</label>
          <input type="range" min="0.05" max="0.3" step="0.01" 
            value={config.angularVelocityMax || 0.15} onChange={(e) => handleChange('angularVelocityMax', e.target.value)} className="w-full accent-cyan-500"/>
          <span className="text-xs text-gray-500">Max rotation speed</span>
        </div>

        {/* PHASE 2: TRACTION CURVE */}
        <h3 className="text-purple-400 font-bold border-b border-purple-700 pb-1 mt-4">Phase 2: Traction Curve</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Peak Grip ({(config.tractionPeak || 1.0).toFixed(2)})</label>
          <input type="range" min="0.5" max="1.5" step="0.05" 
            value={config.tractionPeak || 1.0} onChange={(e) => handleChange('tractionPeak', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Maximum grip before slip</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Sliding Grip ({(config.tractionSliding || 0.7).toFixed(2)})</label>
          <input type="range" min="0.3" max="1.0" step="0.05" 
            value={config.tractionSliding || 0.7} onChange={(e) => handleChange('tractionSliding', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Grip while drifting</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Optimal Slip Angle ({(config.slipAngleOptimal || 10).toFixed(0)}°)</label>
          <input type="range" min="5" max="20" step="1" 
            value={config.slipAngleOptimal || 10} onChange={(e) => handleChange('slipAngleOptimal', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Angle for peak grip</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Peak Slip Angle ({(config.slipAnglePeak || 25).toFixed(0)}°)</label>
          <input type="range" min="15" max="45" step="1" 
            value={config.slipAnglePeak || 25} onChange={(e) => handleChange('slipAnglePeak', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Breakaway point</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Falloff Sharpness ({(config.tractionFalloff || 1.5).toFixed(1)})</label>
          <input type="range" min="0.5" max="2.5" step="0.1" 
            value={config.tractionFalloff || 1.5} onChange={(e) => handleChange('tractionFalloff', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">How sharply grip drops</span>
        </div>

        {/* PHASE 2: TRACTION DISTRIBUTION */}
        <h3 className="text-purple-400 font-bold border-b border-purple-700 pb-1 mt-4">Phase 2: Traction Balance</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Front Bias ({((config.tractionBiasFront || 0.5) * 100).toFixed(0)}%)</label>
          <input type="range" min="0.3" max="0.7" step="0.01" 
            value={config.tractionBiasFront || 0.5} onChange={(e) => handleChange('tractionBiasFront', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">&gt;50% = understeer, &lt;50% = oversteer</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Grip Multiplier ({(config.tractionLossMult || 1.0).toFixed(2)})</label>
          <input type="range" min="0.5" max="1.0" step="0.05" 
            value={config.tractionLossMult || 1.0} onChange={(e) => handleChange('tractionLossMult', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Overall grip reduction</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Low-Speed Wheelspin ({(config.lowSpeedTractionLoss || 0.0).toFixed(2)})</label>
          <input type="range" min="0" max="1" step="0.05" 
            value={config.lowSpeedTractionLoss || 0.0} onChange={(e) => handleChange('lowSpeedTractionLoss', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Wheelspin at low speed</span>
        </div>

        {/* PHASE 3: DRIVETRAIN */}
        <h3 className="text-orange-400 font-bold border-b border-orange-700 pb-1 mt-4">Phase 3: Drivetrain</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Drive Type ({config.driveBiasFront !== undefined ? (config.driveBiasFront === 0 ? 'RWD' : config.driveBiasFront === 1 ? 'FWD' : config.driveBiasFront === 0.5 ? 'AWD' : ((config.driveBiasFront * 100).toFixed(0) + '% Front')) : 'RWD'})</label>
          <input type="range" min="0" max="1" step="0.05" 
            value={config.driveBiasFront !== undefined ? config.driveBiasFront : 0.0} onChange={(e) => handleChange('driveBiasFront', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">0=RWD (drift), 0.5=AWD (rally), 1=FWD (grip)</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Drive Inertia ({(config.driveInertia || 0.9).toFixed(2)})</label>
          <input type="range" min="0.5" max="2.0" step="0.05" 
            value={config.driveInertia || 0.9} onChange={(e) => handleChange('driveInertia', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">Engine/flywheel momentum</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Engine Braking ({(config.engineBraking || 0.3).toFixed(2)})</label>
          <input type="range" min="0" max="1" step="0.05" 
            value={config.engineBraking || 0.3} onChange={(e) => handleChange('engineBraking', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">Off-throttle deceleration</span>
        </div>

        {/* PHASE 3: BRAKING */}
        <h3 className="text-orange-400 font-bold border-b border-orange-700 pb-1 mt-4">Phase 3: Braking</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Brake Force ({(config.brakeForce || 1.2).toFixed(2)})</label>
          <input type="range" min="0.5" max="3.0" step="0.1" 
            value={config.brakeForce || 1.2} onChange={(e) => handleChange('brakeForce', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">Overall brake strength</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Brake Bias Front ({((config.brakeBiasFront || 0.55) * 100).toFixed(0)}%)</label>
          <input type="range" min="0.3" max="0.7" step="0.01" 
            value={config.brakeBiasFront || 0.55} onChange={(e) => handleChange('brakeBiasFront', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">Front brake distribution (&lt;50% = tail slides)</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Handbrake Power ({(config.handbrakePower || 0.8).toFixed(2)})</label>
          <input type="range" min="0" max="2.0" step="0.1" 
            value={config.handbrakePower || 0.8} onChange={(e) => handleChange('handbrakePower', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">Handbrake strength</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Handbrake Slip Angle ({(config.handbrakeSlipAngle || 35).toFixed(0)}°)</label>
          <input type="range" min="10" max="90" step="5" 
            value={config.handbrakeSlipAngle || 35} onChange={(e) => handleChange('handbrakeSlipAngle', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">Induced rear slip</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Brake Lockup Rotation ({(config.brakeLockupRotation || 0.5).toFixed(2)})</label>
          <input type="range" min="0" max="1.0" step="0.05" 
            value={config.brakeLockupRotation || 0.5} onChange={(e) => handleChange('brakeLockupRotation', e.target.value)} className="w-full accent-orange-500"/>
          <span className="text-xs text-gray-500">Trail braking rotation</span>
        </div>

        {/* PHASE 4: STEERING GEOMETRY */}
        <h3 className="text-pink-400 font-bold border-b border-pink-700 pb-1 mt-4">Phase 4: Steering Geometry</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Steering Lock ({(config.steeringLock || 45).toFixed(0)}°)</label>
          <input type="range" min="20" max="90" step="5" 
            value={config.steeringLock || 45} onChange={(e) => handleChange('steeringLock', e.target.value)} className="w-full accent-pink-500"/>
          <span className="text-xs text-gray-500">Maximum steering angle</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Speed Scale ({((config.steeringSpeedScale !== undefined ? config.steeringSpeedScale : 0.4) * 100).toFixed(0)}%)</label>
          <input type="range" min="0" max="0.8" step="0.05" 
            value={config.steeringSpeedScale !== undefined ? config.steeringSpeedScale : 0.4} onChange={(e) => handleChange('steeringSpeedScale', e.target.value)} className="w-full accent-pink-500"/>
          <span className="text-xs text-gray-500">Steering reduction at max speed</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Input Linearity ({(config.steeringLinearity || 1.0).toFixed(1)})</label>
          <input type="range" min="0.5" max="2.0" step="0.1" 
            value={config.steeringLinearity || 1.0} onChange={(e) => handleChange('steeringLinearity', e.target.value)} className="w-full accent-pink-500"/>
          <span className="text-xs text-gray-500">&gt;1 = sensitive center, &lt;1 = linear</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Counter-Steer Assist ({(config.counterSteerAssist || 0.0).toFixed(2)})</label>
          <input type="range" min="0" max="1.0" step="0.05" 
            value={config.counterSteerAssist || 0.0} onChange={(e) => handleChange('counterSteerAssist', e.target.value)} className="w-full accent-pink-500"/>
          <span className="text-xs text-gray-500">Auto counter-steer in drifts</span>
        </div>

        {/* PHASE 4: STABILITY ASSISTS */}
        <h3 className="text-pink-400 font-bold border-b border-pink-700 pb-1 mt-4">Phase 4: Stability Assists</h3>
        <div className="space-y-1">
          <label className="text-gray-400 block">Stability Control ({(config.stabilityControl || 0.0).toFixed(2)})</label>
          <input type="range" min="0" max="1.0" step="0.05" 
            value={config.stabilityControl || 0.0} onChange={(e) => handleChange('stabilityControl', e.target.value)} className="w-full accent-pink-500"/>
          <span className="text-xs text-gray-500">Anti-spin (reduces power)</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Traction Control ({(config.tractionControl || 0.0).toFixed(2)})</label>
          <input type="range" min="0" max="1.0" step="0.05" 
            value={config.tractionControl || 0.0} onChange={(e) => handleChange('tractionControl', e.target.value)} className="w-full accent-pink-500"/>
          <span className="text-xs text-gray-500">Anti-wheelspin (reduces power)</span>
        </div>
        <div className="space-y-1 flex items-center gap-2">
          <input type="checkbox" 
            checked={config.absEnabled || false} 
            onChange={(e) => onConfigChange({ ...config, absEnabled: e.target.checked })} 
            className="w-4 h-4 accent-pink-500"/>
          <label className="text-gray-400">ABS Enabled</label>
          <span className="text-xs text-gray-500 ml-auto">Anti-lock braking</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Drift Assist ({(config.driftAssist || 0.0).toFixed(2)})</label>
          <input type="range" min="0" max="1.0" step="0.05"
            value={config.driftAssist || 0.0} onChange={(e) => handleChange('driftAssist', e.target.value)} className="w-full accent-pink-500"/>
          <span className="text-xs text-gray-500">Maintains drift angle</span>
        </div>

        {/* GAMEPAD SETTINGS */}
        <h3 className="text-purple-400 font-bold border-b border-purple-700 pb-1 mt-4">Gamepad Settings</h3>
        <div className="space-y-1 flex items-center gap-2">
          <input type="checkbox"
            checked={config.gamepadEnabled !== undefined ? config.gamepadEnabled : true}
            onChange={(e) => onConfigChange({ ...config, gamepadEnabled: e.target.checked })}
            className="w-4 h-4 accent-purple-500"/>
          <label className="text-gray-400">Gamepad Enabled</label>
          <span className="text-xs text-gray-500 ml-auto">Enable controller input</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Steering Sensitivity ({(config.gamepadSteeringSensitivity || 1.0).toFixed(2)})</label>
          <input type="range" min="0.5" max="2.0" step="0.05"
            value={config.gamepadSteeringSensitivity || 1.0} onChange={(e) => handleChange('gamepadSteeringSensitivity', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Stick sensitivity multiplier</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Steering Deadzone ({(config.gamepadSteeringDeadzone || 0.15).toFixed(2)})</label>
          <input type="range" min="0" max="0.3" step="0.01"
            value={config.gamepadSteeringDeadzone || 0.15} onChange={(e) => handleChange('gamepadSteeringDeadzone', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">Left stick deadzone (0-0.3)</span>
        </div>
        <div className="space-y-1">
          <label className="text-gray-400 block">Trigger Deadzone ({(config.gamepadTriggerDeadzone || 0.05).toFixed(2)})</label>
          <input type="range" min="0" max="0.2" step="0.01"
            value={config.gamepadTriggerDeadzone || 0.05} onChange={(e) => handleChange('gamepadTriggerDeadzone', e.target.value)} className="w-full accent-purple-500"/>
          <span className="text-xs text-gray-500">LT/RT deadzone (0-0.2)</span>
        </div>
        <div className="space-y-1 flex items-center gap-2">
          <input type="checkbox"
            checked={config.gamepadVibration || false}
            onChange={(e) => onConfigChange({ ...config, gamepadVibration: e.target.checked })}
            className="w-4 h-4 accent-purple-500"
            disabled/>
          <label className="text-gray-400">Vibration (Coming Soon)</label>
          <span className="text-xs text-gray-500 ml-auto">Force feedback</span>
        </div>

        {/* CAR PHYSICS */}
        <h3 className="text-green-400 font-bold border-b border-gray-700 pb-1 mt-4">Legacy: Car Physics</h3>

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
