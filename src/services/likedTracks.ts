import { SongTrack } from '../types';
import { safeStorage } from './storage';

const STORAGE_PREFIX = 'sangeet_liked_tracks_';

export function getLikedTracksKey(stationId?: string): string {
  return `${STORAGE_PREFIX}${stationId || 'default'}`;
}

export function loadLikedTracks(stationId?: string): SongTrack[] {
  try {
    const raw = safeStorage.getItem(getLikedTracksKey(stationId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error loading liked tracks:', err);
  }
  return [];
}

export function saveLikedTracks(tracks: SongTrack[], stationId?: string): void {
  try {
    safeStorage.setItem(getLikedTracksKey(stationId), JSON.stringify(tracks));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sangeet_liked_tracks_changed', {
          detail: { stationId, count: tracks.length },
        })
      );
    }
  } catch (err) {
    console.error('Error saving liked tracks:', err);
  }
}

export function toggleLikedTrack(
  track: SongTrack,
  stationId?: string
): { liked: boolean; tracks: SongTrack[] } {
  const current = loadLikedTracks(stationId);
  const trackKey = track.youtubeVideoId || track.id;
  const exists = current.some((t) => (t.youtubeVideoId || t.id) === trackKey);

  let updated: SongTrack[];
  if (exists) {
    updated = current.filter((t) => (t.youtubeVideoId || t.id) !== trackKey);
  } else {
    // Add to the front of list
    const newTrack: SongTrack = {
      ...track,
      addedAt: Date.now(),
    };
    updated = [newTrack, ...current];
  }

  saveLikedTracks(updated, stationId);
  return { liked: !exists, tracks: updated };
}

export function isTrackLiked(
  trackIdOrVideoId: string | undefined,
  stationId?: string
): boolean {
  if (!trackIdOrVideoId) return false;
  const current = loadLikedTracks(stationId);
  return current.some(
    (t) => t.id === trackIdOrVideoId || t.youtubeVideoId === trackIdOrVideoId
  );
}
