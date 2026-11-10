/**
 * Native MediaSession & Background Audio Controller
 * Integrates with Android Notification Bar, Lock-Screen Player, iOS Dynamic Island / Control Center,
 * and handles Screen WakeLock and media key controls for 100% uninterrupted background playback.
 */

import { SongTrack, PromoClip } from '../types';

export interface MediaSessionCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSeek?: (timeSeconds: number) => void;
  onStop?: () => void;
}

class MediaSessionService {
  private isSupported: boolean = false;
  private callbacks: MediaSessionCallbacks = {};
  private currentMetadataTrackId: string | null = null;
  private lastPositionReportTime: number = 0;
  private wakeLockSentinel: any = null;
  private isWakeLockRequested: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      this.isSupported = true;
    }
    this.setupWakeLockVisibilityListener();
  }

  public setCallbacks(callbacks: MediaSessionCallbacks) {
    this.callbacks = callbacks;
    if (!this.isSupported) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        console.log('[MediaSession] Hardware Play pressed');
        this.callbacks.onPlay?.();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        console.log('[MediaSession] Hardware Pause pressed');
        this.callbacks.onPause?.();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        console.log('[MediaSession] Hardware Previous pressed');
        this.callbacks.onPrevious?.();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        console.log('[MediaSession] Hardware Next pressed');
        this.callbacks.onNext?.();
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        console.log('[MediaSession] Hardware Stop pressed');
        this.callbacks.onStop?.();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && this.callbacks.onSeek) {
          console.log(`[MediaSession] Hardware Seek to ${details.seekTime}s`);
          this.callbacks.onSeek(details.seekTime);
        }
      });
    } catch (err) {
      console.warn('[MediaSession] Error registering action handlers:', err);
    }
  }

  /**
   * Update Lockscreen / Notification bar player with current song info
   */
  public updateTrackMetadata(track: SongTrack | null, stationName: string = 'IOCL Forecourt Radio') {
    if (!this.isSupported) return;

    if (!track) {
      this.currentMetadataTrackId = null;
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // ignore
      }
      return;
    }

    // Avoid redundant metadata assignments
    this.currentMetadataTrackId = track.id;

    try {
      const defaultIcon = '/icon.svg';
      const defaultPng = '/icon-512.png';
      const artworkSrc = track.artworkUrl || defaultPng;

      const artworkList: MediaImage[] = [
        { src: artworkSrc, sizes: '96x96', type: 'image/jpeg' },
        { src: artworkSrc, sizes: '128x128', type: 'image/jpeg' },
        { src: artworkSrc, sizes: '192x192', type: 'image/jpeg' },
        { src: artworkSrc, sizes: '256x256', type: 'image/jpeg' },
        { src: artworkSrc, sizes: '384x384', type: 'image/jpeg' },
        { src: artworkSrc, sizes: '512x512', type: 'image/jpeg' },
        { src: defaultPng, sizes: '512x512', type: 'image/png' },
        { src: defaultIcon, sizes: 'any', type: 'image/svg+xml' },
      ];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Sangeet Radio',
        artist: track.artist ? `${track.artist} • IndianOil` : 'IndianOil Sangeet',
        album: `${stationName} ${track.album ? `• ${track.album}` : ''}`.trim(),
        artwork: artworkList,
      });

      console.log(`[MediaSession] Metadata updated: "${track.title}" by ${track.artist}`);
    } catch (err) {
      console.warn('[MediaSession] Failed to set MediaMetadata:', err);
    }
  }

  /**
   * Update Lockscreen when a promotional broadcast is playing
   */
  public updatePromoMetadata(promo: PromoClip | null, stationName: string = 'IOCL Forecourt Radio') {
    if (!this.isSupported || !promo) return;

    try {
      const defaultPng = '/icon-512.png';
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `📢 ${promo.title}`,
        artist: 'IOCL Voice Announcement',
        album: `${stationName} • Automated Broadcaster`,
        artwork: [
          { src: defaultPng, sizes: '512x512', type: 'image/png' },
        ],
      });
    } catch (err) {
      console.warn('[MediaSession] Failed to set Promo MediaMetadata:', err);
    }
  }

  /**
   * Sync Play/Pause state to the OS notification bar
   */
  public setPlaybackState(isPlaying: boolean) {
    if (!this.isSupported) return;

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (err) {
      // ignore
    }

    if (isPlaying) {
      this.requestWakeLock();
    } else {
      this.releaseWakeLock();
    }
  }

  /**
   * Update scrub bar on the lockscreen
   */
  public updatePositionState(position: number, duration: number) {
    if (!this.isSupported || !('setPositionState' in navigator.mediaSession)) return;

    const now = Date.now();
    // Throttle position updates to once per 800ms to preserve mobile battery
    if (now - this.lastPositionReportTime < 800) return;
    this.lastPositionReportTime = now;

    if (!duration || duration <= 0 || isNaN(duration)) return;
    const safePos = Math.max(0, Math.min(position || 0, duration));

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.round(duration),
        playbackRate: 1.0,
        position: Math.round(safePos),
      });
    } catch (err) {
      // position state error
    }
  }

  /**
   * Screen Wake Lock API to prevent phone sleep during active playback
   */
  public async requestWakeLock() {
    this.isWakeLockRequested = true;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    try {
      if (!this.wakeLockSentinel && document.visibilityState === 'visible') {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        });
      }
    } catch (err) {
      // Wake lock request error (e.g. low battery)
    }
  }

  public async releaseWakeLock() {
    this.isWakeLockRequested = false;
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {
        // ignore
      }
      this.wakeLockSentinel = null;
    }
  }

  private setupWakeLockVisibilityListener() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isWakeLockRequested) {
        this.requestWakeLock().catch(() => {});
      }
    });
  }
}

export const mediaSessionService = new MediaSessionService();
