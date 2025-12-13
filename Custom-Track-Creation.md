# Custom Track Creation Guide
## Rally Castrol Legends

> **Create, Edit, and Share Your Own Racing Circuits**

---

## Table of Contents
1. [Introduction](#introduction)
2. [Quick Start Guide](#quick-start-guide)
3. [Understanding Track JSON Structure](#understanding-track-json-structure)
4. [Step-by-Step: Creating Your First Custom Track](#step-by-step-creating-your-first-custom-track)
5. [Generic Track Template](#generic-track-template)
6. [Import/Export Workflow](#importexport-workflow)
7. [Tips & Best Practices](#tips--best-practices)

---

## Introduction

Rally Castrol Legends features a powerful track editor that allows you to create custom racing circuits. Tracks are defined using **control points** which are automatically smoothed into curves using Catmull-Rom spline interpolation.

### What You Can Customize
- ✅ Track shape and layout
- ✅ Number of control points
- ✅ Track name
- ✅ Track width
- ✅ Number of laps to win
- ❌ Track type (custom tracks are always "LOOP" circuits)

---

## Quick Start Guide

### Step 1: Enable Debug Mode
1. Launch the game
2. Click the **"DEBUG ON"** button in the top-right corner
3. The debug panel will appear on the right side

### Step 2: Select a Track to Edit
1. In the main menu, find a track you want to use as a starting point
2. Hover over the track card
3. Click the **yellow "EDIT"** button that appears
4. The Track Editor will open

### Step 3: Edit Your Track
- **Left-click and drag** control points to move them
- **Right-click and drag** the background to pan the view
- **Scroll wheel** to zoom in/out
- The track automatically updates as you move points

### Step 4: Save Your Changes
1. Click **"SAVE CHANGES"** when satisfied
2. The track is now updated in your game

### Step 5: Export Your Track
1. Return to the main menu
2. Scroll to the bottom of the track list
3. Click **"📤 EXPORT TRACKS"**
4. Save the `rally_tracks.json` file

---

## Understanding Track JSON Structure

Here's a breakdown of the track format:

```json
{
  "id": 8,                    // Unique number (7+ for custom tracks)
  "name": "My Custom Track",  // Display name in menu
  "type": "LOOP",             // Always "LOOP" for circuit tracks
  "points": [...],            // Auto-generated smooth curve (100+ points)
  "controlPoints": [...],     // Points you edit (5-15 recommended)
  "width": 300,               // Track width in pixels
  "lapsToWin": 3              // Number of laps for race completion
}
```

### Key Fields Explained

#### `id` (number)
- Must be **unique**
- Official tracks use IDs 1-4
- Endless modes use IDs 5-7
- **Use ID 8 or higher for custom tracks**

#### `name` (string)
- Displayed in the track selection menu
- Keep it under 20 characters for best display
- Examples: "Sunset Circuit", "Dragon Loop", "Tech Park"

#### `type` (string)
- For custom tracks, always use `"LOOP"`
- Other types: `"INFINITE"`, `"URBAN"`, `"TOUGE"` (reserved for special modes)

#### `points` (array)
- **Automatically generated** from controlPoints
- You don't need to edit this manually
- Contains 100+ interpolated points for smooth curves

#### `controlPoints` (array)
- **This is what you edit in the Track Editor**
- Each point has `x` and `y` coordinates
- World coordinates (can be negative)
- Minimum: 5 points, Maximum: ~20 points for best performance

#### `width` (number)
- Track width in pixels
- Standard: `300` (similar to official tracks)
- Narrow: `200`, Wide: `400`

#### `lapsToWin` (number)
- How many laps to complete the race
- Short tracks: `3-5` laps
- Long tracks: `2-3` laps

---

## Step-by-Step: Creating Your First Custom Track

### Example: Creating "Triangle Circuit"

#### Step 1: Start with an Existing Track
1. Enable Debug Mode
2. Select **"Speedway Oval"** from the menu
3. Click the **"EDIT"** button

#### Step 2: Reshape to Triangle
1. The editor opens showing the oval's control points
2. Delete most control points by moving them together (merge them)
3. Position exactly **3 control points** in a triangle shape:
   - Top point: `(0, -500)`
   - Bottom-left: `(-400, 400)`
   - Bottom-right: `(400, 400)`
4. Click **"SAVE CHANGES"**

#### Step 3: Export Tracks
1. Return to main menu
2. Click **"📤 EXPORT TRACKS"** at the bottom
3. Save as `rally_tracks.json`

#### Step 4: Find Your Track in JSON
1. Open `rally_tracks.json` in a text editor
2. Find the track with `"name": "Speedway Oval"` (the one you edited)
3. Copy the entire track object (from opening `{` to closing `}`)

#### Step 5: Customize the Track Entry
```json
{
  "id": 8,                      // ← Changed from 1 to 8
  "name": "Triangle Circuit",   // ← Changed name
  "type": "LOOP",
  "points": [...],              // ← Keep as-is (auto-generated)
  "controlPoints": [            // ← Your 3 triangle points
    { "x": 0, "y": -500 },
    { "x": -400, "y": 400 },
    { "x": 400, "y": 400 }
  ],
  "width": 300,
  "lapsToWin": 4                // ← Adjust lap count
}
```

#### Step 6: Import Your Custom Track
1. Save your modified JSON
2. In the game menu, click **"📥 IMPORT TRACKS"**
3. Select your JSON file
4. Your custom track appears in the **"Custom Tracks"** section!

---

## Generic Track Template

Use this template to create custom tracks from scratch:

```json
{
  "id": 100,
  "name": "My Custom Track",
  "type": "LOOP",
  "points": [
    { "x": -500, "y": 0 },
    { "x": 0, "y": 0 },
    { "x": 500, "y": 0 }
  ],
  "controlPoints": [
    { "x": -500, "y": 0 },
    { "x": -250, "y": -300 },
    { "x": 0, "y": -500 },
    { "x": 250, "y": -300 },
    { "x": 500, "y": 0 },
    { "x": 250, "y": 300 },
    { "x": 0, "y": 500 },
    { "x": -250, "y": 300 }
  ],
  "width": 300,
  "lapsToWin": 3
}
```

### How to Use This Template
1. Copy the template above
2. Modify the `controlPoints` array:
   - Add or remove points to shape your track
   - Each point needs `x` and `y` coordinates
   - Space points 200-500 pixels apart
3. Change the `id` to a unique number (8+)
4. Change the `name` to your track name
5. Adjust `width` and `lapsToWin` as desired
6. Add to a JSON array and import

---

## Import/Export Workflow

### Exporting Tracks
1. Click **"📤 EXPORT TRACKS"** in the main menu
2. File downloads as `rally_tracks.json`
3. Contains ALL current tracks (Official + Endless + Custom)

### Importing Tracks
1. Prepare a valid JSON file with your tracks
2. Click **"📥 IMPORT TRACKS"** in the main menu
3. Select your JSON file
4. Tracks are automatically categorized:
   - **Official Tracks**: Loop tracks with ID 1-4
   - **Endless Modes**: INFINITE, URBAN, TOUGE types
   - **Custom Tracks**: Loop tracks with ID 5+

### Sharing with Friends
1. Export your tracks
2. Send the JSON file to a friend
3. They import it using the Import button
4. Your custom tracks appear in their game!

---

## Tips & Best Practices

### Track Design
- **Control Points**: Use 6-12 points for most tracks (more = more complex)
- **Spacing**: Keep points 200-500 pixels apart for smooth curves
- **Closed Loops**: Ensure first and last points are close together
- **Track Width**: 250-350 pixels works well for most designs
- **Avoid Self-Intersection**: Don't let the track cross itself

### Coordinate System
- **Center**: (0, 0) is the world origin
- **X-axis**: Negative = Left, Positive = Right
- **Y-axis**: Negative = Up, Positive = Down
- **Range**: Keep coordinates between -2000 and +2000 for best results

### Testing Your Track
1. Save and exit the editor
2. Race on your track to test it
3. Check for:
   - Smooth curves (not too sharp)
   - Appropriate difficulty
   - Clear racing line
   - No glitches or overlaps

### ID Assignment
- **Never use IDs 1-7** (reserved for built-in tracks)
- Start custom tracks at ID **8** or higher
- Use **unique IDs** to avoid conflicts
- Recommended: ID 100+ for community tracks

### File Organization
Keep track of your tracks:
```
my-custom-tracks.json    - Your personal collection
community-pack-v1.json   - Downloaded community tracks
tournament-tracks.json   - Special event tracks
```

---

## Example: Complete Custom Track Entry

Here's a ready-to-use example for a simple rectangular circuit:

```json
{
  "id": 50,
  "name": "Rectangle Raceway",
  "type": "LOOP",
  "points": [
    { "x": -600, "y": -400 },
    { "x": -580, "y": -400 },
    { "x": -560, "y": -400 },
    { "x": -540, "y": -400 }
  ],
  "controlPoints": [
    { "x": -600, "y": -400 },
    { "x": 600, "y": -400 },
    { "x": 600, "y": 400 },
    { "x": -600, "y": 400 }
  ],
  "width": 300,
  "lapsToWin": 4
}
```

To use this track:
1. Copy the JSON above
2. Wrap it in an array: `[{ ... }]`
3. Save as `my-track.json`
4. Import via the **"📥 IMPORT TRACKS"** button

---

## Troubleshooting

### Import Failed
- **Error: "Invalid JSON format"**
  - Check for missing commas, brackets, or quotes
  - Validate your JSON at jsonlint.com

- **Error: "No valid tracks found"**
  - Ensure you have at least one track object
  - Verify all required fields are present

### Track Not Appearing
- **Check the ID**: Must be unique and not 1-7
- **Check the type**: Must be "LOOP" for custom tracks
- **Check Custom Tracks section**: May need to scroll down in menu

### Track Looks Wrong
- **Points too close**: Increase spacing between controlPoints
- **Sharp corners**: Add more control points to smooth curves
- **Track crosses itself**: Redesign controlPoints layout

---

## Advanced: Batch Track Creation

Want to create multiple tracks at once? Edit the exported JSON:

```json
[
  {
    "id": 101,
    "name": "Custom Track 1",
    "type": "LOOP",
    "controlPoints": [...]
  },
  {
    "id": 102,
    "name": "Custom Track 2",
    "type": "LOOP",
    "controlPoints": [...]
  }
]
```

Import this file and both tracks will appear in the Custom Tracks section!

---

## Support & Community

- **Report Issues**: Use the game's feedback system
- **Share Tracks**: Export and share JSON files with other players
- **Track Packs**: Organize multiple tracks in themed collections

Happy track creating! 🏁
