# Rally Castrol Legends - Track System

This folder contains the modular track system for Rally Castrol Legends.

## Directory Structure

```
tracks/
├── official/       Official rally circuits
├── endless/        Procedurally generated endless modes
├── custom/         Community-created tracks
└── README.md       This file
```

## Track Sections

### Official Tracks (`tracks/official/`)
Classic rally circuits with defined lap counts:
- `speedway-oval.json` - High-speed oval circuit
- `figure-eight.json` - Complex figure-8 layout
- `kidney-park.json` - Technical kidney-shaped track
- `hairpin-valley.json` - Challenging hairpin circuit

### Endless Modes (`tracks/endless/`)
Procedurally generated tracks for unlimited racing:
- `endless-rally.json` - Infinite rally stage (procedural)
- `urban-freeroam.json` - Open-world city exploration
- `endless-touge.json` - Downhill mountain pass

### Custom Tracks (`tracks/custom/`)
Community-created tracks can be added here.

## Adding Custom Tracks

1. Create a new JSON file in `tracks/custom/` directory
2. Follow the track data format (see examples in `tracks/official/`)
3. If you want the track to load automatically, create a `manifest.json` file:

```json
{
  "files": [
    "my-custom-track.json",
    "another-track.json"
  ]
}
```

## Track Data Format

Each track JSON file should follow this structure:

```json
{
  "id": 8,
  "name": "My Custom Track",
  "type": "LOOP",
  "points": [...],
  "controlPoints": [...],
  "width": 300,
  "lapsToWin": 3
}
```

### Fields:
- `id`: Unique track identifier (number)
- `name`: Display name
- `type`: One of `"LOOP"`, `"INFINITE"`, `"URBAN"`, `"TOUGE"`
- `points`: Array of generated track points `{x, y}`
- `controlPoints`: Array of spline control points `{x, y}`
- `width`: Track width in pixels
- `lapsToWin`: Number of laps required (use 999 for endless)

## Import/Export Feature

The modular system preserves the easy import/export functionality:

### Export All Tracks
In the game menu (with Debug Mode ON), click "EXPORT ALL TRACKS TO JSON" to download all tracks as a single `rally_tracks.json` file.

### Import Tracks
The game automatically loads tracks from:
1. Individual files in `tracks/official/`, `tracks/endless/`, and `tracks/custom/`
2. Falls back to `rally_tracks.json` if modular files aren't found
3. Uses built-in defaults if no external tracks are available

## Legacy Compatibility

The system maintains full backwards compatibility with the original `rally_tracks.json` format. You can still use a single JSON file with all tracks if preferred.
