# Modular Track System - Implementation Guide

## Overview

The Rally Castrol Legends track system has been upgraded to a modular architecture while preserving the easy import/export functionality. Tracks are now organized into sections and stored as individual JSON files.

## What Changed

### Before
- All tracks stored in a single `rally_tracks.json` file
- Flat list of tracks in the menu
- Harder to manage individual tracks

### After
- Tracks split into individual files in organized folders
- Menu organized into sections: "Official Tracks", "Endless Modes", "Custom Tracks"
- Easy to add/remove individual tracks
- Still supports import/export of all tracks as a single JSON file

## Directory Structure

```
tracks/
├── official/              # 4 official rally circuits
│   ├── speedway-oval.json
│   ├── figure-eight.json
│   ├── kidney-park.json
│   └── hairpin-valley.json
├── endless/               # 3 procedural track modes
│   ├── endless-rally.json
│   ├── urban-freeroam.json
│   └── endless-touge.json
├── custom/                # User-created tracks
│   └── manifest.json      # Lists custom track files
└── README.md
```

## New Features

### 1. Sectioned Menu
The main menu now displays tracks organized by category:

- **Official Tracks** - Classic rally circuits (4 tracks)
- **Endless Modes** - Procedural tracks (3 modes)
- **Custom Tracks** - Community content (expandable)

### 2. Track Loader Service (`services/trackLoader.ts`)
New service that handles:
- Loading individual track files
- Organizing tracks into sections
- Import/export functionality
- Custom track manifest support

### 3. Export Feature
In Debug Mode, a new "EXPORT ALL TRACKS TO JSON" button downloads all tracks as a single JSON file, preserving the original import/export workflow.

## API Reference

### Types (`types.ts`)

```typescript
export interface TrackSection {
  title: string;
  description?: string;
  tracks: TrackData[];
}
```

### Track Loader Functions (`services/trackLoader.ts`)

#### `loadTrackSections(): Promise<TrackSection[]>`
Loads all track sections from individual files.

```typescript
const sections = await loadTrackSections();
// Returns: [
//   { title: "Official Tracks", tracks: [...] },
//   { title: "Endless Modes", tracks: [...] },
//   { title: "Custom Tracks", tracks: [...] }
// ]
```

#### `exportAllTracksToJSON(sections: TrackSection[]): string`
Exports all tracks to a JSON string.

```typescript
const jsonString = exportAllTracksToJSON(trackSections);
// Returns: JSON string of all tracks
```

#### `importTracksFromJSON(jsonString: string): TrackSection[]`
Imports tracks from a JSON string and organizes into sections.

```typescript
const sections = importTracksFromJSON(trackJsonString);
```

#### `downloadTracksJSON(sections: TrackSection[], filename?: string)`
Downloads all tracks as a JSON file.

```typescript
downloadTracksJSON(trackSections, 'my_tracks.json');
```

## Backwards Compatibility

The system maintains full backwards compatibility:

1. **Loading Priority:**
   - First tries to load from individual files in `tracks/` folders
   - Falls back to `rally_tracks.json` if modular files not found
   - Uses built-in defaults if no external tracks available

2. **Legacy Format Support:**
   - Still accepts the old `rally_tracks.json` format
   - Automatically converts to sections when loaded

3. **Export Compatibility:**
   - Export function creates the same format as the original `rally_tracks.json`
   - Can be re-imported into older versions

## Adding Custom Tracks

### Method 1: Individual Files

1. Create a JSON file in `tracks/custom/`
2. Add the filename to `tracks/custom/manifest.json`:

```json
{
  "files": [
    "my-awesome-track.json"
  ]
}
```

3. Reload the game

### Method 2: Bulk Import

1. Click "EXPORT ALL TRACKS TO JSON" to get current tracks
2. Edit the downloaded JSON file
3. Add your new tracks to the array
4. Replace `rally_tracks.json` with your edited file

## Track File Format

Each track JSON follows this structure:

```json
{
  "id": 8,
  "name": "Custom Track Name",
  "type": "LOOP",
  "points": [
    { "x": 0, "y": 0 },
    { "x": 100, "y": 50 }
    // ... more points
  ],
  "controlPoints": [
    { "x": 0, "y": 0 },
    { "x": 500, "y": 200 }
    // ... spline control points
  ],
  "width": 300,
  "lapsToWin": 3
}
```

### Field Descriptions:
- `id`: Unique identifier (ensure no duplicates)
- `name`: Display name in menu
- `type`: `"LOOP"`, `"INFINITE"`, `"URBAN"`, or `"TOUGE"`
- `points`: Generated track path points
- `controlPoints`: Spline control points (for LOOP tracks)
- `width`: Track width in pixels
- `lapsToWin`: Laps required (999 for endless modes)

## Benefits

1. **Modularity** - Each track is a separate file
2. **Organization** - Tracks grouped into logical sections
3. **Maintainability** - Easy to add/remove/modify individual tracks
4. **Scalability** - Custom tracks folder can grow indefinitely
5. **Compatibility** - Still supports single-file import/export
6. **User-Friendly** - Clear menu sections improve UX

## Technical Details

### Load Sequence

1. App loads, attempts to fetch track sections
2. Track loader fetches individual files from `tracks/` folders
3. Organizes tracks into sections
4. Updates UI with sectioned menu
5. Maintains flat `tracks[]` array for backwards compatibility

### Error Handling

- Missing files are skipped with console warnings
- Failed sections don't break the entire load
- Graceful fallback to legacy `rally_tracks.json`
- Final fallback to built-in default tracks

## Future Enhancements

Possible additions:
- Track upload UI in Debug Menu
- Track editor saves directly to custom folder
- Track metadata (author, date, difficulty)
- Track preview images
- Community track sharing
