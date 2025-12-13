import { TrackData, TrackSection } from '../types';

/**
 * Track Loader Service
 * Loads tracks from individual JSON files and organizes them into sections
 */

// Helper function to load a single track file
const loadTrackFile = async (path: string): Promise<TrackData | null> => {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.warn(`Failed to load track from ${path}:`, error);
    return null;
  }
};

// Load all tracks from a directory
const loadTracksFromDirectory = async (
  directory: string,
  fileNames: string[]
): Promise<TrackData[]> => {
  const tracks: TrackData[] = [];

  for (const fileName of fileNames) {
    const track = await loadTrackFile(`${directory}/${fileName}`);
    if (track) {
      tracks.push(track);
    }
  }

  return tracks;
};

/**
 * Load all track sections (Official, Endless Modes, Custom)
 */
export const loadTrackSections = async (): Promise<TrackSection[]> => {
  const sections: TrackSection[] = [];

  // Official Tracks
  const officialTracks = await loadTracksFromDirectory('tracks/official', [
    'speedway-oval.json',
    'figure-eight.json',
    'kidney-park.json',
    'hairpin-valley.json'
  ]);

  if (officialTracks.length > 0) {
    sections.push({
      title: 'Official Tracks',
      description: 'Classic rally circuits',
      tracks: officialTracks
    });
  }

  // Endless Modes
  const endlessTracks = await loadTracksFromDirectory('tracks/endless', [
    'endless-rally.json',
    'urban-freeroam.json',
    'endless-touge.json'
  ]);

  if (endlessTracks.length > 0) {
    sections.push({
      title: 'Endless Modes',
      description: 'Procedurally generated tracks',
      tracks: endlessTracks
    });
  }

  // Custom Tracks (load all JSON files from custom directory)
  const customTracks = await loadCustomTracks();
  if (customTracks.length > 0) {
    sections.push({
      title: 'Custom Tracks',
      description: 'Community created tracks',
      tracks: customTracks
    });
  }

  return sections;
};

/**
 * Load custom tracks from the custom directory
 * This will attempt to load all .json files found
 */
const loadCustomTracks = async (): Promise<TrackData[]> => {
  // In a browser environment, we can't list directory contents
  // So we'll try to load a manifest file if it exists
  try {
    const manifestResponse = await fetch('tracks/custom/manifest.json');
    if (manifestResponse.ok) {
      const manifest: { files: string[] } = await manifestResponse.json();
      return await loadTracksFromDirectory('tracks/custom', manifest.files);
    }
  } catch (error) {
    // Manifest doesn't exist, which is fine
  }

  return [];
};

/**
 * Export all tracks to a single JSON file (for backwards compatibility)
 * This preserves the easy import/export feature
 */
export const exportAllTracksToJSON = (sections: TrackSection[]): string => {
  const allTracks: TrackData[] = [];

  sections.forEach(section => {
    allTracks.push(...section.tracks);
  });

  return JSON.stringify(allTracks, null, 2);
};

/**
 * Import tracks from a JSON string and organize into sections
 */
export const importTracksFromJSON = (jsonString: string): TrackSection[] => {
  try {
    const tracks: TrackData[] = JSON.parse(jsonString);

    const sections: TrackSection[] = [
      {
        title: 'Official Tracks',
        description: 'Classic rally circuits',
        tracks: tracks.filter(t => t.type === 'LOOP' && t.id <= 4)
      },
      {
        title: 'Endless Modes',
        description: 'Procedurally generated tracks',
        tracks: tracks.filter(t =>
          t.type === 'INFINITE' || t.type === 'URBAN' || t.type === 'TOUGE'
        )
      },
      {
        title: 'Custom Tracks',
        description: 'Community created tracks',
        tracks: tracks.filter(t => t.type === 'LOOP' && t.id > 4)
      }
    ];

    // Filter out empty sections
    return sections.filter(s => s.tracks.length > 0);
  } catch (error) {
    console.error('Failed to import tracks:', error);
    return [];
  }
};

/**
 * Download tracks as a JSON file
 */
export const downloadTracksJSON = (sections: TrackSection[], filename: string = 'rally_tracks.json') => {
  const jsonString = exportAllTracksToJSON(sections);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
};
