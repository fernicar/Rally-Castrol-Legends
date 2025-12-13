import React, { useState, useEffect } from 'react';
import GameEngine from './components/GameEngine';
import DebugMenu from './components/DebugMenu';
import TrackEditor from './components/TrackEditor';
import { GameMode, TrackData, TuningConfig, DEFAULT_TUNING, TrackType } from './types';
import { TRACKS as INITIAL_TRACKS } from './services/trackService';

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [selectedTrack, setSelectedTrack] = useState<TrackData | null>(null);
  const [tuning, setTuning] = useState<TuningConfig>(DEFAULT_TUNING);
  const [tracks, setTracks] = useState<TrackData[]>(INITIAL_TRACKS);
  const [showDebug, setShowDebug] = useState<boolean>(true);
  const [lastResult, setLastResult] = useState<{win: boolean, time: number} | null>(null);

  useEffect(() => {
    // Attempt to load external tuning configuration
    fetch('rally_tuning.json')
      .then(res => {
        if(res.ok) return res.json();
        throw new Error('No external config');
      })
      .then(data => {
        console.log('Loaded custom tuning:', data);
        setTuning(prev => ({ ...prev, ...data }));
      })
      .catch(e => {
        console.log('Using default tuning');
      });

    // Attempt to load external track configuration
    fetch('rally_tracks.json')
      .then(res => {
        if(res.ok) return res.json();
        throw new Error('No external tracks');
      })
      .then(data => {
        console.log('Loaded custom tracks:', data);
        setTracks(data);
      })
      .catch(e => {
        console.log('Using default tracks');
      });
  }, []);

  // Global key handler for Retry
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === GameMode.FINISHED && e.key === 'Enter') {
         if (selectedTrack) startGame(selectedTrack);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedTrack]);

  const startGame = (track: TrackData) => {
    setSelectedTrack(track);
    setMode(GameMode.RACING);
    setLastResult(null);
  };

  const startEditor = (track: TrackData, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTrack(track);
    setMode(GameMode.EDITOR);
  };

  const handleFinish = (win: boolean, time: number) => {
    setLastResult({ win, time });
    setMode(GameMode.FINISHED);
  };

  const handleTrackUpdate = (updatedTrack: TrackData) => {
    setTracks(prev => prev.map(t => t.id === updatedTrack.id ? updatedTrack : t));
    setMode(GameMode.MENU);
    setSelectedTrack(null);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return `${m}:${remS.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-screen bg-neutral-900 text-white overflow-hidden">
      
      {/* Global Debug Toggle */}
      <button 
        className={`absolute top-2 right-2 z-50 px-3 py-1 text-xs font-bold rounded ${showDebug ? 'bg-green-600' : 'bg-gray-600 opacity-50'}`}
        onClick={() => setShowDebug(!showDebug)}
      >
        {showDebug ? 'DEBUG ON' : 'DEBUG OFF'}
      </button>

      {/* DEBUG PANEL */}
      {showDebug && (
        <DebugMenu 
          config={tuning} 
          onConfigChange={setTuning} 
          tracks={tracks}
          onTracksChange={setTracks}
          onClose={() => setShowDebug(false)}
        />
      )}

      {/* MENU MODE */}
      {mode === GameMode.MENU && (
        <div className="flex flex-col items-center justify-center h-full bg-[url('https://picsum.photos/1920/1080?grayscale&blur=2')] bg-cover bg-center">
          <div className="bg-black/80 p-8 rounded-xl backdrop-blur-sm border border-red-600 shadow-2xl max-w-2xl w-full text-center">
            <h1 className="text-5xl font-extrabold italic mb-2 tracking-tighter">
              <span className="text-white">RALLY</span> <span className="text-red-600">CASTROL</span> <span className="text-green-600">LEGENDS</span>
            </h1>
            <p className="text-gray-400 mb-8 uppercase tracking-widest text-sm">Physics Based Top-Down Racing</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tracks.map(track => (
                <div key={track.id} className="relative group">
                  <button 
                    onClick={() => startGame(track)}
                    className="w-full text-left relative overflow-hidden bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 hover:border-white p-4 rounded transition-all duration-200"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 to-green-900/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h3 className="text-xl font-bold relative z-10">{track.name}</h3>
                    <p className="text-xs text-gray-400 relative z-10">{track.type === 'INFINITE' ? '∞ PROCEDURAL' : `${track.lapsToWin} LAPS • TECHNICAL`}</p>
                  </button>
                  
                  {/* EDIT BUTTON (Only for non-infinite tracks in debug mode) */}
                  {showDebug && track.type !== TrackType.INFINITE && (
                    <button 
                      onClick={(e) => startEditor(track, e)}
                      className="absolute top-2 right-2 z-20 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs px-2 py-1 rounded shadow-lg opacity-80 hover:opacity-100"
                    >
                      EDIT
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-8 text-xs text-gray-500">
              WASD / ARROWS to Drive • SPACE to Drift (Handbrake)
            </div>
          </div>
        </div>
      )}

      {/* RACING MODE */}
      {mode === GameMode.RACING && selectedTrack && (
        <GameEngine 
          track={selectedTrack} 
          tuning={tuning} 
          onFinish={handleFinish}
          onExit={() => setMode(GameMode.MENU)}
        />
      )}

      {/* EDITOR MODE */}
      {mode === GameMode.EDITOR && selectedTrack && (
        <TrackEditor 
          track={selectedTrack}
          onSave={handleTrackUpdate}
          onCancel={() => setMode(GameMode.MENU)}
        />
      )}

      {/* FINISHED SCREEN */}
      {mode === GameMode.FINISHED && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-40">
           <div className="text-center">
              <h2 className="text-6xl font-black italic mb-4 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
                {lastResult?.win ? "COURSE CLEAR!" : "FINISHED"}
              </h2>
              <p className="text-3xl text-white mb-8 font-mono">
                TIME: {lastResult ? formatTime(lastResult.time) : '--:--'}
              </p>
              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => selectedTrack && startGame(selectedTrack)}
                  className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded uppercase"
                >
                  Retry <span className="text-xs opacity-50 ml-1">(ENTER)</span>
                </button>
                <button 
                  onClick={() => setMode(GameMode.MENU)}
                  className="px-8 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded uppercase"
                >
                  Menu
                </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;