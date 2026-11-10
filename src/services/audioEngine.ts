/**
 * Web Audio Engine for IOCL Forecourt Radio & PA Broadcasting
 * Supports both HTML5 Audio (JioSaavn, Uploads, Promos) and YouTube Music Player
 * with hardware-accelerated audio ducking, crossfading, pre-caching, and live PA mic.
 */

import { getLocalPromoAudio } from './promoStorage';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicAudio: HTMLAudioElement | null = null;
  private promoAudio: HTMLAudioElement | null = null;

  private musicSourceNode: MediaElementAudioSourceNode | null = null;
  private promoSourceNode: MediaElementAudioSourceNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  private musicGain: GainNode | null = null;
  private promoGain: GainNode | null = null;
  private micGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;

  private preCacheBlobUrls: Map<string, string> = new Map();
  private normalVolume: number = 1.0;
  private currentDuckingMode: 'db' | 'percent' = 'db';
  private currentDuckingDb: number = -25;
  private currentDuckingPercent: number = 0.18;
  private manualDuckedMusicVolume: number | null = null;
  private manualMicGainMultiplier: number = 1.2;
  private isDucked: boolean = false;
  private isLiveMicActive: boolean = false;
  private ytRampInterval: any = null;

  private musicPlayPromise: Promise<void> | null = null;
  private isMusicPlayingRequested: boolean = false;
  private promoPlayPromise: Promise<void> | null = null;
  private isPromoPlayingRequested: boolean = false;
  private promoSafetyTimer: any = null;
  private promoEndCleanup: (() => void) | null = null;

  // Background Audio Keep-Alive Carrier & Direct Hardware Ramp
  private carrierAudio: HTMLAudioElement | null = null;
  private musicVolumeRampInterval: any = null;

  // YouTube Music Player integration
  private ytPlayer: any = null;
  private ytReady: boolean = false;
  private activeSource: 'html' | 'youtube' = 'html';
  private onTrackEndedCallback: (() => void) | null = null;
  private ytPendingVideoId: string | null = null;
  private ytPendingStartTime: number = 0;
  private currentPlayingVideoId: string | null = null;
  private lastTrackFinishedTime: number = 0;
  private trackLoadedAt: number = 0;
  private hasPlayedCurrentTrack: boolean = false;
  private consecutiveErrorCount: number = 0;
  private watchdogInterval: any = null;
  private watchdogLastTime: number = 0;
  private watchdogStuckSeconds: number = 0;

  public handleTrackFinished(): void {
    const now = Date.now();
    // Guard against multiple rapid calls (minimum 3 seconds between track finishes)
    if (now - this.lastTrackFinishedTime < 3000) return;
    this.lastTrackFinishedTime = now;
    this.hasPlayedCurrentTrack = false;
    this.currentPlayingVideoId = null;
    this.watchdogStuckSeconds = 0;

    if (this.onTrackEndedCallback) {
      try {
        this.onTrackEndedCallback();
      } catch (err) {
        console.warn('Track ended callback error:', err);
      }
    }
  }

  /**
   * YouTube Music Style Watchdog Timer System
   * - Stall & Silence Detection: Detects playback freeze even if browser doesn't throw error
   * - 3-Stage Self-Healing:
   *     Stage 1 (3s): Unmute, ensure AudioContext running, call play()
   *     Stage 2 (6s): Buffer nudge seek to unstall network pipeline
   *     Stage 3 (10s): Graceful auto-advance so station NEVER stays silent!
   * - End-of-track guard: Guarantees song advancement if iframe drops 'ended' event
   */
  private startWatchdog() {
    if (this.watchdogInterval) return;
    this.watchdogInterval = window.setInterval(() => {
      if (!this.isMusicPlayingRequested) {
        this.watchdogStuckSeconds = 0;
        return;
      }

      const cur = this.getCurrentTime();
      const dur = this.getDuration();
      const now = Date.now();

      // Ensure AudioContext is active
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      // Check Mute integrity on YouTube player
      if (this.activeSource === 'youtube' && this.ytPlayer) {
        try {
          if (typeof this.ytPlayer.isMuted === 'function' && this.ytPlayer.isMuted()) {
            this.ytPlayer.unMute();
            const factor = this.manualDuckedMusicVolume !== null ? this.manualDuckedMusicVolume : this.currentDuckingPercent;
            const targetVol = this.isDucked
              ? Math.max(0, Math.round(this.normalVolume * 100 * factor))
              : Math.round(this.normalVolume * 100);
            this.ytPlayer.setVolume(targetVol);
          }
        } catch {
          // ignore
        }
      }

      // End-of-track detection (handles missing ended events from browser iframe)
      if (dur > 15 && cur > 10 && cur >= dur - 1.2) {
        this.handleTrackFinished();
        return;
      }

      // Guard: Give track 5 seconds to buffer after initial load before checking stall
      if (now - this.trackLoadedAt < 5000) {
        this.watchdogLastTime = cur;
        this.watchdogStuckSeconds = 0;
        return;
      }

      // Watchdog Stall Detection: If playhead has NOT progressed while requested to play
      if (Math.abs(cur - this.watchdogLastTime) < 0.15) {
        this.watchdogStuckSeconds += 1;

        // Stage 1: Soft Recovery (3 seconds stall)
        if (this.watchdogStuckSeconds === 3) {
          console.warn(`[YT Watchdog] Playhead stall detected at ${cur.toFixed(1)}s. Triggering soft self-heal.`);
          if (this.activeSource === 'youtube' && this.ytPlayer) {
            try {
              this.ytPlayer.unMute();
              this.ytPlayer.playVideo();
              const factor = this.manualDuckedMusicVolume !== null ? this.manualDuckedMusicVolume : this.currentDuckingPercent;
              const targetVol = this.isDucked
                ? Math.max(0, Math.round(this.normalVolume * 100 * factor))
                : Math.round(this.normalVolume * 100);
              this.ytPlayer.setVolume(targetVol);
            } catch (e) {
              console.warn('[YT Watchdog] YouTube soft recovery error:', e);
            }
          } else if (this.musicAudio) {
            try {
              this.musicAudio.play().catch(() => {});
            } catch {
              // ignore
            }
          }
        }

        // Stage 2: Buffer Nudge (6 seconds stall)
        if (this.watchdogStuckSeconds === 6) {
          console.warn(`[YT Watchdog] Continued stall at ${cur.toFixed(1)}s. Applying buffer nudge.`);
          if (this.activeSource === 'youtube' && this.ytPlayer) {
            try {
              const nudgeTime = Math.max(0, cur + 0.2);
              if (typeof this.ytPlayer.seekTo === 'function') {
                this.ytPlayer.seekTo(nudgeTime, true);
              }
              this.ytPlayer.playVideo();
            } catch (e) {
              console.warn('[YT Watchdog] YouTube nudge error:', e);
            }
          } else if (this.musicAudio) {
            try {
              this.musicAudio.currentTime = Math.max(0, cur + 0.2);
              this.musicAudio.play().catch(() => {});
            } catch {
              // ignore
            }
          }
        }

        // Stage 3: Auto-Skip Failover (10 seconds stall)
        // Ensures the petrol pump station speakers NEVER stay frozen or silent!
        if (this.watchdogStuckSeconds >= 10) {
          console.warn(`[YT Watchdog] Unrecoverable stall for 10s. Advancing to next track to keep station alive!`);
          this.watchdogStuckSeconds = 0;
          this.handleTrackFinished();
        }
      } else {
        // Playhead is actively progressing normally!
        this.watchdogLastTime = cur;
        this.watchdogStuckSeconds = 0;
      }
    }, 1000);
  }

  private initCarrierAudio() {
    if (this.carrierAudio || typeof window === 'undefined') return;
    try {
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      this.carrierAudio = new Audio(silentWav);
      this.carrierAudio.loop = true;
      this.carrierAudio.volume = 0.001;
      this.carrierAudio.setAttribute('playsinline', 'true');
      (this.carrierAudio as any).playsInline = true;
    } catch {
      // ignore
    }
  }

  public startCarrierAudio() {
    this.initCarrierAudio();
    if (this.carrierAudio && this.carrierAudio.paused) {
      try {
        this.carrierAudio.play().catch(() => {});
      } catch {
        // ignore
      }
    }
  }

  public stopCarrierAudio() {
    if (this.carrierAudio && !this.carrierAudio.paused) {
      try {
        this.carrierAudio.pause();
      } catch {
        // ignore
      }
    }
  }

  private rampAudioElementVolume(targetVolume: number, rampSeconds: number) {
    if (!this.musicAudio) return;
    if (this.musicVolumeRampInterval) {
      clearInterval(this.musicVolumeRampInterval);
      this.musicVolumeRampInterval = null;
    }
    const startVol = this.musicAudio.volume;
    const target = Math.max(0.001, Math.min(1, targetVolume));
    const startTime = Date.now();
    const durationMs = Math.max(50, rampSeconds * 1000);

    this.musicVolumeRampInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const curVol = startVol + progress * (target - startVol);
      if (this.musicAudio) {
        try {
          this.musicAudio.volume = Math.max(0.001, Math.min(1, curVol));
        } catch {
          // ignore
        }
      }
      if (progress >= 1) {
        clearInterval(this.musicVolumeRampInterval);
        this.musicVolumeRampInterval = null;
        if (this.musicAudio) {
          try {
            this.musicAudio.volume = target;
          } catch {
            // ignore
          }
        }
      }
    }, 25);
  }

  public init() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.musicAudio = new Audio();
    this.musicAudio.preload = 'auto';
    this.musicAudio.setAttribute('playsinline', 'true');
    this.musicAudio.setAttribute('webkit-playsinline', 'true');
    (this.musicAudio as any).playsInline = true;
    this.musicAudio.addEventListener('playing', () => {
      this.hasPlayedCurrentTrack = true;
      this.consecutiveErrorCount = 0;
    });
    this.musicAudio.addEventListener('ended', () => {
      if (Date.now() - this.trackLoadedAt > 3000 && this.hasPlayedCurrentTrack) {
        this.handleTrackFinished();
      }
    });
    this.musicAudio.addEventListener('error', (e) => {
      console.warn('HTML audio stream error event caught:', e);
      const currentSrc = this.musicAudio?.src || '';
      // If direct audio URL failed (e.g. CORS block or remote host restriction), retry via server audio proxy!
      if (currentSrc && !currentSrc.includes('/api/audio/proxy') && currentSrc.startsWith('http')) {
        console.log('[AudioEngine] Retrying unplayable direct stream via server audio proxy...');
        if (this.musicAudio) {
          this.musicAudio.src = `/api/audio/proxy?url=${encodeURIComponent(currentSrc)}`;
          this.musicAudio.play().catch(() => {
            this.handleTrackFinished();
          });
          return;
        }
      }

      this.consecutiveErrorCount++;
      // Never kill the station! Reset count if too many errors and smoothly advance to next song
      if (this.consecutiveErrorCount > 4) {
        console.warn('Auto-recovering from multiple stream issues; advancing to next available song.');
        this.consecutiveErrorCount = 0;
      }
      setTimeout(() => {
        this.handleTrackFinished();
      }, 800);
    });

    // Auto-unlock AudioContext on first user interaction anywhere
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.resumeContext();
      };
      window.addEventListener('click', unlock, { once: true, passive: true });
      window.addEventListener('touchstart', unlock, { once: true, passive: true });
    }

    this.promoAudio = new Audio();
    this.promoAudio.crossOrigin = 'anonymous';
    this.promoAudio.preload = 'auto';
    this.promoAudio.addEventListener('error', (e) => {
      e.stopPropagation?.();
    });

    // Master Compressor prevents clipping when forecourt PA amplifiers are driven hard
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.promoGain = this.ctx.createGain();
    this.promoGain.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.micGain = this.ctx.createGain();
    this.micGain.gain.setValueAtTime(1.2, this.ctx.currentTime);

    // Master audio bus routing - guaranteed independent connection
    try {
      this.musicGain.connect(this.compressor);
      this.promoGain.connect(this.compressor);
      this.micGain.connect(this.compressor);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio master bus routing warning:', e);
    }

    // Direct Native Audio Pipeline for Android/iOS Lock-screen & Background Playback:
    // We intentionally DO NOT route musicAudio through AudioContext createMediaElementSource!
    // Untethered HTMLAudioElement outputs directly to the system audio daemon.
    // When the phone is locked or minimized to Recent Apps, mobile browsers (Android Chrome,
    // iOS Safari, PWA) keep HTMLAudioElement running continuously without suspending or muting!
    // Volume ducking and crossfades are handled directly on musicAudio.volume via rampAudioElementVolume.

    try {
      if (!this.promoSourceNode && this.promoAudio) {
        this.promoSourceNode = this.ctx.createMediaElementSource(this.promoAudio);
        this.promoSourceNode.connect(this.promoGain);
      }
    } catch (e) {
      console.warn('promoSourceNode routing warning:', e);
    }

    // Initialize Background Carrier Keep-Alive Loop
    this.initCarrierAudio();

    // Visibility Change Listener: Ensures AudioContext resumes on app return and keeps carrier active in background
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          if (this.isMusicPlayingRequested) {
            this.resumeMusic();
          }
        } else {
          // Screen locked or app minimized to Recent Apps:
          // Activate silent carrier audio loop so phone OS doesn't sleep the media process
          if (this.isMusicPlayingRequested) {
            this.startCarrierAudio();
          }
        }
      });
    }

    // Initialize YouTube IFrame Player
    this.initYouTubePlayer();
    this.startWatchdog();
  }

  private initYouTubePlayer() {
    if (typeof window === 'undefined') return;

    // Create background container for YouTube player inside viewport boundary
    // Keeps iframe active in Chromium & WebKit without throttling/muting
    let container = document.getElementById('sangeet-yt-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'sangeet-yt-player-container';
      container.style.position = 'fixed';
      container.style.bottom = '0px';
      container.style.right = '0px';
      container.style.width = '4px';
      container.style.height = '4px';
      container.style.opacity = '0.01';
      container.style.pointerEvents = 'none';
      container.style.zIndex = '-1';
      document.body.appendChild(container);
    }

    const setupYT = () => {
      if (!window.YT || !window.YT.Player) return;
      if (this.ytPlayer) return;

      try {
        this.ytPlayer = new window.YT.Player('sangeet-yt-player-container', {
          height: '180',
          width: '320',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              this.ytReady = true;
              try {
                this.ytPlayer.unMute();
                this.ytPlayer.setVolume(Math.round(this.normalVolume * 100));
              } catch {
                // ignore
              }
              if (this.ytPendingVideoId) {
                this.trackLoadedAt = Date.now();
                this.hasPlayedCurrentTrack = false;
                this.ytPlayer.loadVideoById({
                  videoId: this.ytPendingVideoId,
                  startSeconds: this.ytPendingStartTime || 0,
                });
                this.ytPlayer.unMute();
                this.ytPlayer.playVideo();
                this.ytPlayer.setVolume(Math.round(this.normalVolume * 100));
                this.ytPendingVideoId = null;
              }
            },
            onStateChange: (event: { data: number }) => {
              // 1 = YT.PlayerState.PLAYING
              if (event.data === 1) {
                this.hasPlayedCurrentTrack = true;
                this.consecutiveErrorCount = 0;
                this.watchdogStuckSeconds = 0;
                try {
                  this.ytPlayer.unMute();
                } catch {
                  // ignore
                }
              }
              // 0 = YT.PlayerState.ENDED
              if (event.data === 0) {
                // Guard: Only advance if track was loaded at least 5s ago and actually played
                if (Date.now() - this.trackLoadedAt > 5000 && this.hasPlayedCurrentTrack) {
                  this.handleTrackFinished();
                }
              }
            },
            onError: (err: any) => {
              console.warn('YouTube player warning:', err);
              const errCode = err?.data;
              const isEmbedRestricted = errCode === 101 || errCode === 150 || errCode === 100;

              this.consecutiveErrorCount++;
              if (this.consecutiveErrorCount > 4) {
                console.warn('Recovering from consecutive YouTube stream errors; cycling to next track.');
                this.consecutiveErrorCount = 0;
              }

              // Restricted embed: immediately advance without stalling station
              if (isEmbedRestricted) {
                this.handleTrackFinished();
              } else {
                setTimeout(() => {
                  this.handleTrackFinished();
                }, 800);
              }
            },
          },
        });
      } catch (e) {
        console.warn('YouTube init exception:', e);
      }
    };

    if (window.YT && window.YT.Player) {
      setupYT();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        setupYT();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }
  }

  public setOnTrackEnded(callback: () => void) {
    this.onTrackEndedCallback = callback;
  }

  public async resumeContext(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  private crossfadeSeconds: number = 2.0;

  public setCrossfadeSeconds(seconds: number) {
    this.crossfadeSeconds = Math.max(0, Math.min(10, seconds));
  }

  public getCrossfadeSeconds(): number {
    return this.crossfadeSeconds;
  }

  /**
   * Smooth YouTube volume interpolation helper (prevents sudden cut / jhatka)
   */
  private rampYouTubeVolume(options: {
    mode: 'db' | 'percent';
    targetDb: number;
    targetPercent: number;
    rampSeconds: number;
    isDucking: boolean;
  }) {
    if (this.ytRampInterval) {
      clearInterval(this.ytRampInterval);
      this.ytRampInterval = null;
    }

    if (!this.ytPlayer || typeof this.ytPlayer.setVolume !== 'function') return;

    const startVol = typeof this.ytPlayer.getVolume === 'function' ? this.ytPlayer.getVolume() : Math.round(this.normalVolume * 100);
    let targetVol = 100;

    if (options.isDucking) {
      if (options.mode === 'db') {
        const factor = Math.pow(10, options.targetDb / 20);
        targetVol = Math.max(0, Math.min(100, Math.round(this.normalVolume * 100 * factor)));
      } else {
        targetVol = Math.max(0, Math.min(100, Math.round(this.normalVolume * options.targetPercent)));
      }
    } else {
      targetVol = Math.max(0, Math.min(100, Math.round(this.normalVolume * 100)));
    }

    const durationMs = Math.max(100, options.rampSeconds * 1000);
    const startTime = Date.now();

    this.ytRampInterval = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      if (options.mode === 'db') {
        // Interpolate along logarithmic decibels (Image 2 standard)
        const startDb = startVol > 0 ? 20 * Math.log10(startVol / (this.normalVolume * 100 || 1)) : -60;
        const curDb = startDb + progress * (options.targetDb - startDb);
        const curGain = Math.pow(10, curDb / 20);
        const curVol = Math.max(0, Math.min(100, Math.round(this.normalVolume * 100 * curGain)));
        try {
          this.ytPlayer.setVolume(curVol);
        } catch {
          // ignore
        }
      } else {
        // Interpolate linearly in percentage
        const curVol = Math.round(startVol + progress * (targetVol - startVol));
        try {
          this.ytPlayer.setVolume(Math.max(0, Math.min(100, curVol)));
        } catch {
          // ignore
        }
      }

      if (progress >= 1) {
        clearInterval(this.ytRampInterval);
        this.ytRampInterval = null;
        try {
          this.ytPlayer.setVolume(targetVol);
        } catch {
          // ignore
        }
      }
    }, 35);
  }

  /**
   * Smoothly duck background music down when promo announcements or live PA mic activates
   * Supports both Decibels (dB - logarithmic curve) and Percentage (% - linear curve)
   */
  public duckMusic(
    duckConfig: number | {
      mode?: 'db' | 'percent';
      db?: number;
      percent?: number;
      rampSeconds?: number;
    } = 18,
    legacyRamp?: number
  ) {
    this.init();
    if (!this.ctx || !this.musicGain) return;
    this.resumeContext();

    let mode: 'db' | 'percent' = 'percent';
    let db: number = -20;
    let percent: number = 18;
    let rampSeconds: number = legacyRamp ?? Math.max(0.3, this.crossfadeSeconds * 0.5);

    if (typeof duckConfig === 'number') {
      percent = duckConfig;
      rampSeconds = legacyRamp ?? Math.max(0.3, this.crossfadeSeconds * 0.5);
    } else if (typeof duckConfig === 'object') {
      mode = duckConfig.mode ?? 'percent';
      db = duckConfig.db ?? -20;
      percent = duckConfig.percent ?? 18;
      rampSeconds = duckConfig.rampSeconds ?? Math.max(0.3, this.crossfadeSeconds * 0.5);
    }

    this.currentDuckingMode = mode;
    this.currentDuckingDb = db;
    const duckFactor = mode === 'db'
      ? Math.pow(10, db / 20)
      : Math.max(0.01, Math.min(1.0, percent / 100));
    this.currentDuckingPercent = duckFactor;

    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    const curVal = Math.max(0.0001, this.musicGain.gain.value);
    this.musicGain.gain.setValueAtTime(curVal, now);

    const targetGain = mode === 'db'
      ? Math.max(0.0001, this.normalVolume * Math.pow(10, db / 20))
      : this.normalVolume * this.currentDuckingPercent;

    if (mode === 'db') {
      this.musicGain.gain.exponentialRampToValueAtTime(targetGain, now + rampSeconds);
    } else {
      this.musicGain.gain.linearRampToValueAtTime(targetGain, now + rampSeconds);
    }
    this.isDucked = true;

    // Direct hardware volume clamp on HTML Audio Element with smooth studio fade
    if (this.musicAudio) {
      try {
        this.rampAudioElementVolume(Math.max(0.001, Math.min(1, targetGain)), rampSeconds);
      } catch {
        // ignore
      }
    }

    // Smooth YouTube volume ramp
    this.rampYouTubeVolume({
      mode,
      targetDb: db,
      targetPercent: percent,
      rampSeconds,
      isDucking: true,
    });
  }

  /**
   * Smoothly restore background music to standard volume after promo or announcement completes
   */
  public restoreMusic(rampSeconds?: number) {
    if (!this.ctx || !this.musicGain) return;
    this.resumeContext();

    // Guard: Never force restore if live mic is actively ON AIR
    if (this.isLiveMicActive && this.micStream && this.micStream.active) {
      return;
    }

    // Guard: Never force restore if promotional clip is actively playing
    if (
      this.isPromoPlayingRequested &&
      this.promoAudio &&
      !this.promoAudio.paused &&
      !this.promoAudio.ended
    ) {
      return;
    }

    this.manualDuckedMusicVolume = null;
    const finalRamp = rampSeconds ?? Math.max(0.5, this.crossfadeSeconds * 0.7);
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    const curVal = Math.max(0.0001, this.musicGain.gain.value);
    this.musicGain.gain.setValueAtTime(curVal, now);

    if (this.currentDuckingMode === 'db') {
      // Smooth exponential restore matching dB curve
      this.musicGain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, this.normalVolume),
        now + finalRamp
      );
    } else {
      // Smooth linear restore
      this.musicGain.gain.linearRampToValueAtTime(this.normalVolume, now + finalRamp);
    }
    this.isDucked = false;

    // Direct hardware volume restore on HTML Audio Element with smooth studio fade
    if (this.musicAudio) {
      try {
        this.rampAudioElementVolume(Math.max(0.001, Math.min(1, this.normalVolume)), finalRamp);
      } catch {
        // ignore
      }
    }

    // Restore YouTube volume smoothly
    this.rampYouTubeVolume({
      mode: this.currentDuckingMode,
      targetDb: 0,
      targetPercent: 100,
      rampSeconds: finalRamp,
      isDucking: false,
    });
  }

  private extractYouTubeId(url: string = ''): string | null {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
    return null;
  }

  /**
   * Play a music track through the high-bitrate audio engine (HTML5 or YouTube)
   */
  public async playMusic(
    url: string,
    startTime: number = 0,
    trackInfo?: {
      id?: string;
      source?: string;
      youtubeVideoId?: string;
      directAudioUrl?: string;
      title?: string;
      artist?: string;
    }
  ): Promise<void> {
    this.init();
    await this.resumeContext();

    // Prefer direct audio stream (320kbps MP4/AAC) for 100% background playback immunity
    const directAudio = trackInfo?.directAudioUrl || (url && !url.includes('youtube.com') && !url.includes('youtu.be') ? url : null);

    // Check if this track is from YouTube Music
    const extractedFromId = trackInfo?.id?.startsWith('yt-') ? trackInfo.id.replace('yt-', '') : null;
    const extractedYtId = trackInfo?.youtubeVideoId || this.extractYouTubeId(url) || extractedFromId;
    const finalVideoId = trackInfo?.youtubeVideoId || (extractedYtId && /^[a-zA-Z0-9_-]{11}$/.test(extractedYtId) ? extractedYtId : null);
    const isYouTube = !directAudio && (
      Boolean(finalVideoId) ||
      trackInfo?.source === 'youtube' ||
      url.includes('youtube.com') ||
      url.includes('youtu.be')
    );

    this.isMusicPlayingRequested = true;
    this.startCarrierAudio();

    if (isYouTube && finalVideoId) {
      this.activeSource = 'youtube';

      // Background resolution of direct audio stream for fallback / background resilience
      if (trackInfo?.title && !trackInfo.directAudioUrl) {
        fetch(`/api/tracks/resolve-audio-stream?title=${encodeURIComponent(trackInfo.title)}&artist=${encodeURIComponent(trackInfo.artist || '')}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.success && data.directAudioUrl) {
              trackInfo.directAudioUrl = data.directAudioUrl;
              console.log(`[AudioEngine] Resolved direct background audio stream for "${trackInfo.title}"`);
            }
          })
          .catch(() => {});
      }

      // Pause HTML audio
      if (this.musicAudio && !this.musicAudio.paused) {
        try {
          this.musicAudio.pause();
        } catch {
          // ignore
        }
      }

      // If the SAME video is already loaded, DO NOT reload it!
      if (this.currentPlayingVideoId === finalVideoId) {
        if (this.ytReady && this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
          try {
            this.ytPlayer.unMute();
            const state = typeof this.ytPlayer.getPlayerState === 'function' ? this.ytPlayer.getPlayerState() : -1;
            if (state !== 1 && state !== 3) {
              this.ytPlayer.playVideo();
            }
            const targetVol = this.isDucked
              ? Math.round(this.currentDuckingPercent * 100)
              : Math.round(this.normalVolume * 100);
            this.ytPlayer.setVolume(targetVol);
          } catch (e) {
            console.warn('YouTube resume exception:', e);
          }
        }
        return;
      }

      // New video: record current video ID and load
      this.currentPlayingVideoId = finalVideoId;
      this.trackLoadedAt = Date.now();
      this.hasPlayedCurrentTrack = false;
      this.lastTrackFinishedTime = Date.now();

      if (this.ytReady && this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
        try {
          this.ytPlayer.loadVideoById({
            videoId: finalVideoId,
            startSeconds: startTime || 0,
          });
          this.ytPlayer.unMute();
          this.ytPlayer.playVideo();
          const targetVol = this.isDucked
            ? Math.round(this.currentDuckingPercent * 100)
            : Math.round(this.normalVolume * 100);

          if (this.crossfadeSeconds > 0 && (!startTime || startTime === 0)) {
            try {
              this.ytPlayer.setVolume(0);
            } catch {
              // ignore
            }
            this.rampYouTubeVolume({
              mode: 'percent',
              targetDb: 0,
              targetPercent: this.isDucked ? this.currentDuckingPercent * 100 : 100,
              rampSeconds: Math.min(3, this.crossfadeSeconds),
              isDucking: this.isDucked,
            });
          } else {
            this.ytPlayer.setVolume(targetVol);
          }
        } catch (e) {
          console.warn('YouTube load exception:', e);
          setTimeout(() => {
            this.handleTrackFinished();
          }, 1500);
        }
      } else {
        this.ytPendingVideoId = finalVideoId;
        this.ytPendingStartTime = startTime;
        this.initYouTubePlayer();
      }
      return;
    }

    // Direct HTML5 Audio playback (JioSaavn 320kbps or Uploaded)
    const effectiveUrl = directAudio || url;
    this.currentPlayingVideoId = null;
    this.activeSource = 'html';
    this.trackLoadedAt = Date.now();
    this.hasPlayedCurrentTrack = false;
    this.lastTrackFinishedTime = Date.now();
    // Pause YouTube audio if playing
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch {
        // ignore
      }
    }

    if (!this.musicAudio) return;

    // Check pre-cache lookup first
    const resolvedUrl = this.preCacheBlobUrls.get(effectiveUrl) || effectiveUrl;

    // Guard: Prevent setting empty or unplayable URL on HTML Audio Element
    if (!resolvedUrl || resolvedUrl.trim() === '' || resolvedUrl.includes('youtube.com') || resolvedUrl.includes('youtu.be')) {
      console.warn('HTML audio stream skipped: empty or invalid source, advancing');
      this.handleTrackFinished();
      return;
    }

    if (this.musicAudio.src !== resolvedUrl) {
      if (this.musicPlayPromise) {
        try {
          await this.musicPlayPromise;
        } catch {
          // ignore previous interruption
        }
      }
      this.musicAudio.src = resolvedUrl;
      if (startTime > 0) {
        this.musicAudio.currentTime = startTime;
      }
    }

    if (!this.isMusicPlayingRequested) return;

    try {
      const targetVol = this.isDucked
        ? (this.currentDuckingMode === 'db'
          ? Math.max(0.001, this.normalVolume * Math.pow(10, this.currentDuckingDb / 20))
          : Math.max(0.001, this.normalVolume * this.currentDuckingPercent))
        : this.normalVolume;

      if (this.crossfadeSeconds > 0 && (!startTime || startTime === 0) && !this.isDucked) {
        this.musicAudio.volume = 0.001;
        this.rampAudioElementVolume(targetVol, Math.min(3, this.crossfadeSeconds));
      } else {
        this.musicAudio.volume = targetVol;
      }

      this.musicPlayPromise = this.musicAudio.play();
      await this.musicPlayPromise;
      this.startCarrierAudio();
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error?.name === 'AbortError' || error?.message?.includes('interrupted')) {
        // Intentionally interrupted by pause() - gracefully handled
      } else {
        // Attempt server audio proxy fallback for CORS / network format restrictions
        if (resolvedUrl && !resolvedUrl.includes('/api/audio/proxy') && resolvedUrl.startsWith('http') && this.musicAudio) {
          console.warn('[AudioEngine] Direct play failed, retrying via server audio proxy fallback...');
          try {
            this.musicAudio.src = `/api/audio/proxy?url=${encodeURIComponent(resolvedUrl)}`;
            if (startTime > 0) this.musicAudio.currentTime = startTime;
            this.musicPlayPromise = this.musicAudio.play();
            await this.musicPlayPromise;
            this.startCarrierAudio();
            return;
          } catch (retryErr) {
            console.warn('[AudioEngine] Proxy fallback also failed:', retryErr);
          }
        }
        console.warn('Playback error encountered, advancing to next song:', err);
        this.handleTrackFinished();
      }
    } finally {
      this.musicPlayPromise = null;
    }
  }

  public async pauseMusic(): Promise<void> {
    this.isMusicPlayingRequested = false;
    this.stopCarrierAudio();

    // Pause YouTube
    if (this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch {
        // ignore
      }
    }

    // Pause HTML Audio
    if (!this.musicAudio) return;

    if (this.musicPlayPromise) {
      try {
        await this.musicPlayPromise;
      } catch {
        // ignore
      }
    }

    if (this.musicAudio && !this.musicAudio.paused) {
      try {
        this.musicAudio.pause();
      } catch {
        // ignore
      }
    }
  }

  public async stopMusic(): Promise<void> {
    this.currentPlayingVideoId = null;
    return this.pauseMusic();
  }

  public isMusicPlaying(): boolean {
    if (this.activeSource === 'youtube') {
      return Boolean(this.ytPlayer && typeof this.ytPlayer.getPlayerState === 'function' && this.ytPlayer.getPlayerState() === 1);
    }
    return Boolean(this.musicAudio && !this.musicAudio.paused && !this.musicAudio.ended && this.musicAudio.currentTime > 0);
  }

  public resumeMusic(): void {
    const factor = this.manualDuckedMusicVolume !== null ? this.manualDuckedMusicVolume : this.currentDuckingPercent;
    if (this.activeSource === 'youtube') {
      if (this.ytPlayer && typeof this.ytPlayer.playVideo === 'function') {
        try {
          this.ytPlayer.unMute();
          const state = typeof this.ytPlayer.getPlayerState === 'function' ? this.ytPlayer.getPlayerState() : -1;
          if (state !== 1 && state !== 3) {
            this.ytPlayer.playVideo();
          }
          const targetVol = this.isDucked
            ? Math.max(0, Math.round(this.normalVolume * 100 * factor))
            : Math.round(this.normalVolume * 100);
          this.ytPlayer.setVolume(targetVol);
        } catch {
          // ignore
        }
      }
    } else {
      if (
        this.musicAudio &&
        this.musicAudio.paused &&
        this.musicAudio.src &&
        !this.musicAudio.src.endsWith('/') &&
        typeof window !== 'undefined' &&
        this.musicAudio.src !== window.location.href
      ) {
        try {
          const targetVol = this.isDucked ? Math.max(0, this.normalVolume * factor) : this.normalVolume;
          this.musicAudio.volume = Math.max(0.01, Math.min(1, targetVol));
          this.musicAudio.play().catch(() => {});
        } catch {
          // ignore
        }
      }
    }
  }

  public unMute(): void {
    if (this.activeSource === 'youtube' && this.ytPlayer && typeof this.ytPlayer.unMute === 'function') {
      try {
        this.ytPlayer.unMute();
        this.ytPlayer.setVolume(Math.round(this.normalVolume * 100));
      } catch {
        // ignore
      }
    }
  }

  public getWatchdogStatus() {
    return {
      isPlayingRequested: this.isMusicPlayingRequested,
      activeSource: this.activeSource,
      stuckSeconds: this.watchdogStuckSeconds,
      currentTime: this.getCurrentTime(),
      duration: this.getDuration(),
    };
  }

  public seekMusic(timeSeconds: number) {
    if (this.activeSource === 'youtube' && this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      try {
        this.ytPlayer.seekTo(timeSeconds, true);
        return;
      } catch {
        // ignore
      }
    }

    if (this.musicAudio) {
      this.musicAudio.currentTime = timeSeconds;
    }
  }

  public getCurrentTime(): number {
    if (this.activeSource === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
      try {
        return this.ytPlayer.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    }
    return this.musicAudio?.currentTime || 0;
  }

  public getDuration(): number {
    if (this.activeSource === 'youtube' && this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') {
      try {
        return this.ytPlayer.getDuration() || 0;
      } catch {
        return 0;
      }
    }
    return this.musicAudio?.duration || 0;
  }

  public getMasterVolume(): number {
    return this.normalVolume;
  }

  public setMasterVolume(volume: number) {
    this.normalVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.normalVolume, this.ctx.currentTime);
    }

    if (this.isDucked) {
      // Maintain ducked level during promo/mic
      const factor = this.manualDuckedMusicVolume !== null ? this.manualDuckedMusicVolume : this.currentDuckingPercent;
      const duckedGain = this.currentDuckingMode === 'db'
        ? Math.max(0.0001, this.normalVolume * Math.pow(10, this.currentDuckingDb / 20))
        : Math.max(0.0001, this.normalVolume * factor);

      if (this.ctx && this.musicGain) {
        this.musicGain.gain.setValueAtTime(duckedGain, this.ctx.currentTime);
      }
      if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
        try {
          this.ytPlayer.setVolume(Math.round(duckedGain * 100));
        } catch {
          // ignore
        }
      }
      if (this.musicAudio) {
        try {
          this.musicAudio.volume = Math.max(0.01, Math.min(1, duckedGain));
        } catch {
          // ignore
        }
      }
    } else {
      if (this.ctx && this.musicGain) {
        this.musicGain.gain.setValueAtTime(this.normalVolume, this.ctx.currentTime);
      }
      if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
        try {
          this.ytPlayer.setVolume(Math.round(this.normalVolume * 100));
        } catch {
          // ignore
        }
      }
      if (this.musicAudio) {
        try {
          this.musicAudio.volume = Math.max(0.01, Math.min(1, this.normalVolume));
        } catch {
          // ignore
        }
      }
    }
  }

  public muteForRemote(): void {
    if (this.ytPlayer && typeof this.ytPlayer.mute === 'function') {
      try {
        this.ytPlayer.mute();
      } catch {
        // ignore
      }
    }
    if (this.musicAudio) {
      this.musicAudio.muted = true;
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public unmuteForSpeaker(): void {
    const factor = this.manualDuckedMusicVolume !== null ? this.manualDuckedMusicVolume : this.currentDuckingPercent;
    const duckedGain = this.currentDuckingMode === 'db'
      ? Math.max(0.0001, this.normalVolume * Math.pow(10, this.currentDuckingDb / 20))
      : Math.max(0.0001, this.normalVolume * factor);
    const targetVolume = this.isDucked ? duckedGain : this.normalVolume;

    if (this.ytPlayer && typeof this.ytPlayer.unMute === 'function') {
      try {
        this.ytPlayer.unMute();
        this.ytPlayer.setVolume(Math.round(targetVolume * 100));
      } catch {
        // ignore
      }
    }
    if (this.musicAudio) {
      this.musicAudio.muted = false;
      this.musicAudio.volume = Math.max(0.01, Math.min(1, targetVolume));
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.normalVolume, this.ctx.currentTime);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(targetVolume, this.ctx.currentTime);
    }
  }

  public getMusicAudioElement(): HTMLAudioElement | null {
    return this.musicAudio;
  }

  /**
   * Play Promotional Audio with automated Ducking and Completion Callback
   * Implements Image 2 Broadcast Standard:
   * Smoothly ducks background music over fadeDurationSeconds, and ONLY AFTER ducking reaches
   * the quiet level does the promotional clip start playing.
   */
  public async playPromo(
    url: string,
    options?: {
      duckingMode?: 'db' | 'percent';
      duckingDb?: number;
      duckingPercent?: number;
      fadeDurationSeconds?: number;
      repetitions?: number;
    } | number,
    onEnded?: () => void
  ): Promise<void> {
    this.init();
    await this.resumeContext();
    if (!this.promoAudio) return;

    this.isPromoPlayingRequested = true;
    let resolvedUrl = this.preCacheBlobUrls.get(url) || url;

    // Check if local IndexedDB has the audio blob (instant zero-latency playback & offline resilience)
    try {
      const localAudio = await getLocalPromoAudio(url);
      if (localAudio) {
        resolvedUrl = localAudio;
      }
    } catch {
      // ignore
    }

    if (this.promoPlayPromise) {
      try {
        await this.promoPlayPromise;
      } catch {
        // ignore previous
      }
    }

    this.promoAudio.src = resolvedUrl;
    this.promoAudio.currentTime = 0;
    this.promoAudio.volume = 1.0;
    if (this.ctx && this.promoGain) {
      this.promoGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    let mode: 'db' | 'percent' = 'db';
    let db = -25;
    let percent = 18;
    let fadeSeconds = 1.0;
    let repetitions = 1;

    if (typeof options === 'number') {
      percent = options;
      fadeSeconds = 1.0;
    } else if (typeof options === 'object') {
      mode = options.duckingMode || 'db';
      db = options.duckingDb ?? -25;
      percent = options.duckingPercent ?? 18;
      fadeSeconds = Math.max(0.2, Math.min(5.0, options.fadeDurationSeconds ?? 1.0));
      repetitions = Math.max(1, Math.min(20, Math.floor(options.repetitions ?? 1)));
    }

    const totalRepetitions = repetitions;
    let currentIteration = 1;

    // STEP 1: Duck background music smoothly along the exact curve (dB log or percent linear)
    this.duckMusic({
      mode,
      db,
      percent,
      rampSeconds: fadeSeconds,
    });

    // Clean up any stale promo watchdog timer or listeners
    if (this.promoSafetyTimer) {
      clearTimeout(this.promoSafetyTimer);
      this.promoSafetyTimer = null;
    }
    if (this.promoEndCleanup) {
      this.promoEndCleanup();
      this.promoEndCleanup = null;
    }

    // STEP 2: Wait for exact fadeDurationSeconds so music is quiet BEFORE promo voice begins (Image 2)
    await new Promise((resolve) => setTimeout(resolve, fadeSeconds * 1000));

    if (!this.isPromoPlayingRequested) return;

    let didEndOrError = false;
    const cleanupListeners = () => {
      if (this.promoSafetyTimer) {
        clearTimeout(this.promoSafetyTimer);
        this.promoSafetyTimer = null;
      }
      this.promoAudio?.removeEventListener('ended', handleEnded);
      this.promoAudio?.removeEventListener('error', handleError);
      this.promoAudio?.removeEventListener('loadedmetadata', handleMetadata);
      this.promoEndCleanup = null;
    };
    this.promoEndCleanup = cleanupListeners;

    const handleEnded = () => {
      if (didEndOrError) return;

      // Handle Repetition: Loop back to start if current iteration < total repetitions
      if (currentIteration < totalRepetitions && this.isPromoPlayingRequested && this.promoAudio) {
        currentIteration++;
        console.log(`[AudioEngine] Promo Repetition: Loop ${currentIteration} of ${totalRepetitions} starting.`);
        this.promoAudio.currentTime = 0;
        armSafetyTimer(this.promoAudio.duration);
        const loopPromise = this.promoAudio.play();
        if (loopPromise) {
          loopPromise.catch((err) => {
            console.warn('[AudioEngine] Promo repetition play interrupted:', err);
            handleError(err);
          });
        }
        return;
      }

      didEndOrError = true;
      this.isPromoPlayingRequested = false;
      cleanupListeners();
      this.restoreMusic(fadeSeconds);
      onEnded?.();
    };

    const handleError = async (e: unknown) => {
      // If server streaming failed (e.g. 404 after server restart) and we haven't tried local IndexedDB yet:
      if (!resolvedUrl.startsWith('blob:') && !resolvedUrl.startsWith('data:')) {
        try {
          const fallback = await getLocalPromoAudio(url);
          if (fallback && fallback !== resolvedUrl && this.promoAudio) {
            console.log('[AudioEngine] Server audio failed, switching to local IndexedDB fallback audio:', url);
            resolvedUrl = fallback;
            this.promoAudio.src = fallback;
            this.promoAudio.currentTime = 0;
            this.promoAudio.play().catch(() => {});
            return;
          }
        } catch {
          // fallback failed
        }
      }

      if (didEndOrError) return;
      didEndOrError = true;
      this.isPromoPlayingRequested = false;
      console.warn('Promo audio playback failed or stalled:', e);
      cleanupListeners();
      this.restoreMusic(0.5);
      onEnded?.();
    };

    const armSafetyTimer = (durationSec?: number) => {
      if (this.promoSafetyTimer) {
        clearTimeout(this.promoSafetyTimer);
        this.promoSafetyTimer = null;
      }
      const safeDuration = (durationSec && isFinite(durationSec) && durationSec > 0)
        ? Math.max(12, Math.ceil(durationSec) + 12)
        : 60; // 60s fallback, giving plenty of room
      this.promoSafetyTimer = setTimeout(() => {
        // Guard: Do not restore if promoAudio is actively progressing and playing
        if (this.promoAudio && !this.promoAudio.paused && !this.promoAudio.ended && this.promoAudio.currentTime > 0) {
          const remaining = (this.promoAudio.duration || 0) - this.promoAudio.currentTime;
          if (remaining > 2) {
            console.log('Promo audio still actively playing, extending safety watchdog');
            armSafetyTimer(remaining + 6);
            return;
          }
        }
        console.warn('Promo playback watchdog timer expired. Auto-restoring station music.');
        handleEnded();
      }, safeDuration * 1000);
    };

    const handleMetadata = () => {
      if (this.promoAudio?.duration && isFinite(this.promoAudio.duration)) {
        armSafetyTimer(this.promoAudio.duration);
      }
    };

    this.promoAudio.addEventListener('ended', handleEnded);
    this.promoAudio.addEventListener('error', handleError, { once: true });
    this.promoAudio.addEventListener('loadedmetadata', handleMetadata, { once: true });

    armSafetyTimer(this.promoAudio.duration);

    try {
      this.promoPlayPromise = this.promoAudio.play();
      await this.promoPlayPromise;
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error?.name === 'AbortError' || error?.message?.includes('interrupted')) {
        // Intentionally interrupted - gracefully handled
      } else {
        console.warn('Promo playback notice:', err);
      }
      handleError(err);
    } finally {
      this.promoPlayPromise = null;
    }
  }

  public async stopPromo(): Promise<void> {
    this.isPromoPlayingRequested = false;
    if (this.promoSafetyTimer) {
      clearTimeout(this.promoSafetyTimer);
      this.promoSafetyTimer = null;
    }
    if (this.promoEndCleanup) {
      this.promoEndCleanup();
      this.promoEndCleanup = null;
    }

    if (!this.promoAudio) {
      this.restoreMusic(0.8);
      return;
    }

    if (this.promoPlayPromise) {
      try {
        await this.promoPlayPromise;
      } catch {
        // ignore
      }
    }

    // Smooth 350ms hardware fadeout of promo audio (no abrupt clicks or jhatka)
    if (this.ctx && this.promoGain) {
      const now = this.ctx.currentTime;
      this.promoGain.gain.cancelScheduledValues(now);
      this.promoGain.gain.setValueAtTime(this.promoGain.gain.value, now);
      this.promoGain.gain.linearRampToValueAtTime(0.0001, now + 0.35);
    }

    if (this.promoAudio && !this.promoAudio.paused) {
      try {
        let curVol = this.promoAudio.volume;
        const fadeStep = curVol / 7;
        const fadeTimer = setInterval(() => {
          curVol = Math.max(0, curVol - fadeStep);
          if (this.promoAudio) this.promoAudio.volume = curVol;
          if (curVol <= 0.02) clearInterval(fadeTimer);
        }, 50);
      } catch {
        // ignore
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 350));

    if (this.promoAudio && !this.promoAudio.paused) {
      try {
        this.promoAudio.pause();
        this.promoAudio.currentTime = 0;
        this.promoAudio.volume = 1.0;
      } catch {
        // ignore
      }
    }

    if (this.ctx && this.promoGain) {
      this.promoGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
    }

    // Smoothly restore background music volume
    this.restoreMusic(0.8);
  }

  private lastMicError: string | null = null;
  private isSpeechAnnouncing: boolean = false;

  public getLastMicError(): string | null {
    return this.lastMicError;
  }

  /**
   * Broadcast airport/forecourt dual-tone chime
   */
  public async playChime(): Promise<void> {
    this.init();
    await this.resumeContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(this.masterGain || this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Tone 2: 880.00 Hz (A5)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.22);
    gain2.gain.setValueAtTime(0.3, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(this.masterGain || this.ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.8);
  }

  /**
   * Text-to-Speech Voice Announcement with Automated Forecourt Chime & Music Ducking
   */
  public async broadcastSpeechAnnouncement(
    text: string,
    options?: {
      duckingPercent?: number;
      lang?: string;
      onStart?: () => void;
      onEnd?: () => void;
    }
  ): Promise<boolean> {
    this.init();
    await this.resumeContext();

    this.isSpeechAnnouncing = true;
    const duckPercent = options?.duckingPercent ?? 12;
    this.duckMusic({ mode: 'percent', percent: duckPercent, rampSeconds: 0.5 });

    // Play chime first
    try {
      await this.playChime();
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 650));

    options?.onStart?.();

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = options?.lang || 'hi-IN';
        utterance.rate = 0.92;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(
          (v) => v.lang.includes('hi') || v.lang.includes('hi-IN') || v.lang.includes('en-IN')
        );
        if (preferredVoice) utterance.voice = preferredVoice;

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          this.isSpeechAnnouncing = false;
          this.restoreMusic(0.8);
          options?.onEnd?.();
        };

        utterance.onend = finish;
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis announcement error:', e);
          finish();
        };

        // Safety watchdog: restore music if speech synthesis stalls
        const maxDurationMs = Math.max(5000, text.length * 160);
        setTimeout(finish, maxDurationMs);

        window.speechSynthesis.speak(utterance);
        return true;
      } catch (e) {
        console.warn('Failed to speak speech announcement:', e);
        this.isSpeechAnnouncing = false;
        this.restoreMusic(0.8);
        options?.onEnd?.();
        return false;
      }
    } else {
      setTimeout(() => {
        this.isSpeechAnnouncing = false;
        this.restoreMusic(0.8);
        options?.onEnd?.();
      }, 1500);
      return false;
    }
  }

  public stopSpeechAnnouncement() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeechAnnouncing = false;
    this.restoreMusic(0.8);
  }

  /**
   * Manual Live Announcement Background Music Volume Adjustment (0.0 to 1.0)
   * Real-time hardware slider response for both HTML Audio and YouTube Music Player
   */
  public setLiveMusicVolume(volume: number) {
    this.init();
    this.resumeContext();
    const clamped = Math.max(0, Math.min(1.0, volume));
    this.manualDuckedMusicVolume = clamped;
    this.currentDuckingPercent = clamped;
    this.isDucked = true;

    const targetGain = Math.max(0, this.normalVolume * clamped);

    if (this.ctx && this.musicGain) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.setValueAtTime(Math.max(0.0001, targetGain), now);
    }

    if (this.musicAudio) {
      try {
        this.musicAudio.volume = Math.max(0, Math.min(1, targetGain));
      } catch {
        // ignore
      }
    }

    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      try {
        this.ytPlayer.setVolume(Math.round(targetGain * 100));
      } catch {
        // ignore
      }
    }
  }

  public getLiveMusicVolume(): number {
    return this.manualDuckedMusicVolume !== null ? this.manualDuckedMusicVolume : this.currentDuckingPercent;
  }

  /**
   * Reset Live Music Volume back to configured Station Audio Settings auto-ducking target
   */
  public resetLiveMusicToAutoDucking(config?: {
    duckingMode?: 'db' | 'percent';
    duckingDb?: number;
    duckingPercent?: number;
    fadeDurationSeconds?: number;
  }) {
    this.manualDuckedMusicVolume = null;
    const mode = config?.duckingMode || this.currentDuckingMode || 'db';
    const db = config?.duckingDb ?? this.currentDuckingDb ?? -25;
    const percent = config?.duckingPercent ?? Math.round(this.currentDuckingPercent * 100);
    const ramp = config?.fadeDurationSeconds ?? 0.6;

    this.duckMusic({
      mode,
      db,
      percent,
      rampSeconds: ramp,
    });
  }

  /**
   * Manual Live Microphone Gain / Sensitivity Adjustment (0.0 to 2.5x multiplier)
   */
  public setLiveMicVolume(volume: number) {
    this.init();
    this.resumeContext();
    const clamped = Math.max(0, Math.min(2.5, volume));
    this.manualMicGainMultiplier = clamped;
    if (this.ctx && this.micGain) {
      const now = this.ctx.currentTime;
      this.micGain.gain.cancelScheduledValues(now);
      this.micGain.gain.setValueAtTime(clamped, now);
    }
  }

  public getLiveMicVolume(): number {
    return this.manualMicGainMultiplier;
  }

  /**
   * Alias for setLiveMicVolume to control Live Voice Volume
   */
  public setLiveVoiceVolume(volume: number) {
    this.setLiveMicVolume(volume);
  }

  public getLiveVoiceVolume(): number {
    return this.getLiveMicVolume();
  }

  public isLiveMicActiveNow(): boolean {
    return Boolean(this.isLiveMicActive && this.micStream && this.micStream.active);
  }

  public isDuckingActive(): boolean {
    return this.isDucked;
  }

  /**
   * Live PA Microphone Announcement
   * Ducks background music using exact Station Audio Settings (mode, dB/percent, fade duration)
   * while supporting manual volume override sliders.
   */
  public async startLiveMic(
    options?: {
      duckingMode?: 'db' | 'percent';
      duckingDb?: number;
      duckingPercent?: number;
      fadeDurationSeconds?: number;
      manualMusicVolume?: number; // 0.0 to 1.0 (if user set manual slider)
      manualMicVolume?: number;   // 0.0 to 2.5 (mic boost slider)
    } | number
  ): Promise<boolean> {
    this.init();
    await this.resumeContext();
    this.lastMicError = null;

    if (!this.ctx || !this.micGain) {
      this.lastMicError = 'Audio system initialize nahi ho paya. Screen par kahin tap karein.';
      return false;
    }

    // Step 1: Duck background music immediately on user gesture so pump speakers dip smoothly
    if (typeof options === 'object' && typeof options?.manualMusicVolume === 'number') {
      this.setLiveMusicVolume(options.manualMusicVolume);
    } else {
      let mode: 'db' | 'percent' = 'db';
      let db = -25;
      let percent = 18;
      let fadeSecs = 1.0;

      if (typeof options === 'number') {
        mode = 'percent';
        percent = options;
      } else if (typeof options === 'object') {
        mode = options.duckingMode || 'db';
        db = options.duckingDb ?? -25;
        percent = options.duckingPercent ?? 18;
        fadeSecs = Math.max(0.2, Math.min(5.0, options.fadeDurationSeconds ?? 1.0));
      }

      this.duckMusic({
        mode,
        db,
        percent,
        rampSeconds: fadeSecs,
      });
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      this.lastMicError = 'Microphone access is not supported on this browser/connection (HTTPS or browser permission required).';
      return false;
    }

    if (this.micStream) {
      this.stopLiveMic();
    }

    try {
      // Step 2: Request microphone stream with high-speech-clarity parameters
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // Prevents mobile browsers from over-filtering human speech into silence
            autoGainControl: true,
          },
        });
      } catch (streamErr) {
        console.warn('Advanced mic constraints failed, falling back to basic audio:', streamErr);
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      // Step 3: Create visualizer and media stream source
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 64;

      this.micSourceNode = this.ctx.createMediaStreamSource(this.micStream);

      // Connect source to micGain
      this.micSourceNode.connect(this.micGain);

      // Ensure robust routing from micGain to forecourt speaker output
      try {
        this.micGain.connect(this.masterGain || this.ctx.destination);
      } catch {
        // already connected
      }
      this.micGain.connect(this.micAnalyser);

      // Set microphone gain
      let initialMicGain = 1.2;
      if (typeof options === 'object' && typeof options?.manualMicVolume === 'number') {
        initialMicGain = options.manualMicVolume;
      }
      this.setLiveMicVolume(initialMicGain);

      this.isLiveMicActive = true;
      return true;
    } catch (err: any) {
      console.warn('Microphone permission or hardware error:', err);
      const isPermissionDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.name === 'SecurityError' ||
        err?.message?.toLowerCase().includes('permission') ||
        err?.message?.toLowerCase().includes('denied');

      this.lastMicError = isPermissionDenied
        ? 'Microphone permission block hai. Browser settings ya address bar me Mic allow karein, ya Instant Voice Announcement use karein.'
        : (err?.message || 'Microphone connect nahi ho paya.');

      this.isLiveMicActive = false;
      this.restoreMusic(0.5);
      return false;
    }
  }

  public stopLiveMic() {
    this.isLiveMicActive = false;
    if (this.micStream) {
      try {
        this.micStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.micStream = null;
    }
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {
        // ignore
      }
      this.micSourceNode = null;
    }
    this.manualDuckedMusicVolume = null;
    this.restoreMusic(0.8);
  }

  public getMicLevel(): number {
    if (!this.micAnalyser) return 0;
    const dataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / (dataArray.length || 1);
    // Human voice speech has peak power in 300-3000 Hz; boost so VU meter reacts visibly to human speech
    return Math.min(100, Math.round((avg / 115) * 100));
  }

  /**
   * Pre-cache upcoming songs silently into memory
   */
  public async preCacheTrack(url: string): Promise<void> {
    if (this.preCacheBlobUrls.has(url) || !url.startsWith('http')) return;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      this.preCacheBlobUrls.set(url, blobUrl);
    } catch {
      // Ignore cache failures
    }
  }

  public stopAll() {
    this.stopCarrierAudio();
    this.stopMusic();
    this.stopPromo();
    // Do not kill an active user live mic broadcast
    if (!this.isLiveMicActive) {
      this.stopLiveMic();
    }
  }

  public isTrackPreCached(url: string): boolean {
    return this.preCacheBlobUrls.has(url);
  }
}

export const audioEngine = new AudioEngine();
