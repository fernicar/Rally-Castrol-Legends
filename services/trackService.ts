import { TrackData, TrackType, Point } from '../types';

const TRACK_WIDTH = 300;

// Catmull-Rom Spline Interpolation
// Calculates a point on the curve segment between p1 and p2 based on t [0, 1]
const catmullRom = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const t2 = t * t;
  const t3 = t2 * t;

  const f1 = -0.5 * t3 + t2 - 0.5 * t;
  const f2 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const f3 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const f4 = 0.5 * t3 - 0.5 * t2;

  return {
    x: p0.x * f1 + p1.x * f2 + p2.x * f3 + p3.x * f4,
    y: p0.y * f1 + p1.y * f2 + p2.y * f3 + p3.y * f4
  };
};

export const generateTrackPoints = (controlPoints: Point[], resolution: number = 20): Point[] => {
  const points: Point[] = [];
  const len = controlPoints.length;

  for (let i = 0; i < len; i++) {
    // Catmull-Rom requires 4 points: p0 (prev), p1 (start), p2 (end), p3 (next)
    const p0 = controlPoints[(i - 1 + len) % len];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % len];
    const p3 = controlPoints[(i + 2) % len];

    for (let j = 0; j < resolution; j++) {
      const t = j / resolution;
      points.push(catmullRom(p0, p1, p2, p3, t));
    }
  }
  // Close the loop
  points.push(points[0]);
  
  return points;
};

// --- Track Definitions ---
// Updated based on rally_tracks.json provided by user

// Track 1: Speedway Oval
const track1Controls: Point[] = [
  { x: -476.66, y: 151.669 },
  { x: -133.33, y: 148.33 },
  { x: 670, y: 148.33 },
  { x: 1280, y: 151.669 },
  { x: 1703.33, y: 218.33 },
  { x: 1976.66, y: 621.66 },
  { x: 1720, y: 1075 },
  { x: 1260, y: 1138.33 },
  { x: 380, y: 1151.66 },
  { x: -476.66, y: 1141.66 },
  { x: -960, y: 1035 },
  { x: -1166.66, y: 648.334 },
  { x: -993.334, y: 255 }
];

// Track 2: Figure Eight
const track2Controls: Point[] = [
  { x: -339.99, y: 616.66 },
  { x: 163.33, y: 288.337 },
  { x: 500, y: 0 },
  { x: 1093.33, y: -423.33 },
  { x: 1599.99, y: -869.99 },
  { x: 2293.33, y: -1209.99 },
  { x: 2473.33, y: -996.66 },
  { x: 2153.33, y: -549.99 },
  { x: 2246.66, y: 449.99 },
  { x: 1819.99, y: 883.33 },
  { x: 1093.33, y: 523.33 },
  { x: -106.666, y: -489.99 },
  { x: -919.99, y: -456.66 },
  { x: -1673.33, y: -23.33 },
  { x: -1523.33, y: 571.66 },
  { x: -899.99, y: 649.99 }
];

// Track 3: Kidney Park
const track3Controls: Point[] = [
  { x: -500, y: 0 },
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 1500, y: 200 },
  { x: 2000, y: 800 },
  { x: 1800, y: 1400 },
  { x: 1200, y: 1600 },
  { x: 600, y: 1200 },
  { x: 0, y: 1400 },
  { x: -600, y: 1000 },
  { x: -800, y: 400 }
];

// Track 4: Hairpin Valley
const track4Controls: Point[] = [
  { x: -600, y: -28.336 },
  { x: 0, y: 0 },
  { x: 500, y: 0 },
  { x: 1200, y: 0 },
  { x: 1800, y: 300 },
  { x: 2000, y: 800 },
  { x: 1500, y: 1200 },
  { x: -466.66, y: 1056.66 },
  { x: -619.99, y: 1496.66 },
  { x: 366.663, y: 2309.99 },
  { x: 1633.33, y: 1843.33 },
  { x: 3153.33, y: 1129.99 },
  { x: 3619.99, y: 803.33 },
  { x: 3293.33, y: 383.33 },
  { x: 1766.66, y: -383.33 },
  { x: -500, y: -400 }
];

export const TRACKS: TrackData[] = [
  { id: 1, name: "Speedway Oval", type: TrackType.LOOP, points: generateTrackPoints(track1Controls), controlPoints: track1Controls, width: TRACK_WIDTH, lapsToWin: 2 },
  { id: 2, name: "Figure Eight", type: TrackType.LOOP, points: generateTrackPoints(track2Controls), controlPoints: track2Controls, width: TRACK_WIDTH, lapsToWin: 2 },
  { id: 3, name: "Kidney Park", type: TrackType.LOOP, points: generateTrackPoints(track3Controls), controlPoints: track3Controls, width: TRACK_WIDTH, lapsToWin: 2 },
  { id: 4, name: "Hairpin Valley", type: TrackType.LOOP, points: generateTrackPoints(track4Controls), controlPoints: track4Controls, width: TRACK_WIDTH, lapsToWin: 2 },
  // Infinite start points (straight line to begin)
  { id: 5, name: "Endless Rally", type: TrackType.INFINITE, points: [{x: -400, y: 0}, {x: -200, y: 0}, {x: 0, y: 0}, {x: 200, y: 0}, {x: 400, y: 0}], controlPoints: [], width: TRACK_WIDTH, lapsToWin: 999 },
  // Urban Freeroam (ID 6)
  { id: 6, name: "Urban Freeroam", type: TrackType.URBAN, points: [{ x: 400, y: 400 }], controlPoints: [], width: 200, lapsToWin: 999 },
];

export const generateNextSegment = (lastPoint: Point, angle: number, length: number): Point => {
  return {
    x: lastPoint.x + Math.cos(angle) * length,
    y: lastPoint.y + Math.sin(angle) * length
  };
};

export const interpolatePoints = (p1: Point, p2: Point, fraction: number): Point => {
  return {
    x: p1.x + (p2.x - p1.x) * fraction,
    y: p1.y + (p2.y - p1.y) * fraction
  };
};