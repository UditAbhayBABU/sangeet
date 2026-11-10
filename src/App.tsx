import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Volume2,
  Smartphone,
  ShieldCheck,
  Disc3,
  ListMusic,
  Plus,
  Trash2,
  Search,
  Sparkles,
  Zap,
  Mic,
  Clock,
  Layers,
  Upload,
  ArrowRight,
  Headphones,
  CheckCircle2,
  Users,
  Shield,
  WifiOff,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Check,
  Flame,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  VolumeX,
  X
} from 'lucide-react';
import { SongTrack, PromoClip, PromoCategory, StationState, StationSettings, StationItem } from './types';
import { audioEngine } from './services/audioEngine';
import { mediaSessionService } from './services/mediaSessionService';
import { HeaderNav } from './components/HeaderNav';
import { ExpandedPlayer } from './components/ExpandedPlayer';
import { AdminConsoleView } from './components/AdminConsoleView';
import { RoleSelectScreen } from './components/RoleSelectScreen';
import { StationSelectScreen } from './components/StationSelectScreen';
import { SpeakerHandoverModal } from './components/SpeakerHandoverModal';
import { MobileAppLayout } from './components/mobile/MobileAppLayout';
import { AppleArtwork } from './components/common/AppleArtwork';
import { AppleSlider } from './components/common/AppleSlider';
import { AppIcon } from './components/common/AppIcon';
import { getMoodTheme } from './utils/moodTheme';
import { useIsMobile } from './hooks/useIsMobile';
import { safeStorage } from './services/storage';
import { healServerPromosFromIndexedDB, savePromoToLocalDB, deletePromoFromLocalDB } from './services/promoStorage';

const DEFAULT_STATION_ID = 'station-msd';

const TREND_GENRES = [
  { label: '🔥 Top Bollywood', query: 'Hindi romantic hits' },
  { label: '🕺 Bhojpuri Hits', query: 'Pawan Singh hit song' },
  { label: '🎤 Punjabi Beats', query: 'Diljit Dosanjh hits' },
  { label: '💫 Arijit Singh', query: 'Arijit Singh songs' },
  { label: '🦁 Pawan Singh', query: 'Pawan Singh Superhit song' },
  { label: '🪔 Bhakti / Morning', query: 'Morning bhajan aarti' },
  { label: '⚡ Party Dhamaka', query: 'Party mashup dance' },
];

export default function App() {
  const { isMobile, toggleMobilePreview } = useIsMobile();

  // 1. Role: 'staff' | 'admin' | null
  const [userRole, setUserRole] = useState<'staff' | 'admin' | null>(() => {
    return (safeStorage.getItem('sangeet_user_role') as 'staff' | 'admin' | null) || 'staff';
  });

  // 2. Selected Station: null until chosen
  const [selectedStationId, setSelectedStationId] = useState<string | null>(() => {
    return safeStorage.getItem('sangeet_selected_station') || null;
  });

  // 3. Persistent Device Identity
  const [myDeviceId] = useState<string>(() => {
    let id = safeStorage.getItem('sangeet_device_id');
    if (!id) {
      id = `device-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      safeStorage.setItem('sangeet_device_id', id);
    }
    return id;
  });

  const [myDeviceName, setMyDeviceName] = useState<string>(() => {
    const saved = safeStorage.getItem('sangeet_device_name');
    if (saved && saved !== 'Staff Phone') return saved;
    // Generate identifiable name e.g. "Staff - Pump 1 (#412)"
    const num = Math.floor(100 + Math.random() * 900);
    const generated = `Staff Mobile (#${num})`;
    safeStorage.setItem('sangeet_device_name', generated);
    return generated;
  });

  // Station State
  const [stationState, setStationState] = useState<StationState | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isAudioContextStarted, setIsAudioContextStarted] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Speaker Modal State
  const [isSpeakerModalOpen, setIsSpeakerModalOpen] = useState(false);

  // Staff Search State
  const [dashSearchQuery, setDashSearchQuery] = useState('');
  const [dashSearchResults, setDashSearchResults] = useState<SongTrack[]>([]);
  const [isSearchingDash, setIsSearchingDash] = useState(false);
  const [dashSourceFilter, setDashSourceFilter] = useState<'all' | 'youtube' | 'saavn'>('all');
  const [addedTrackId, setAddedTrackId] = useState<string | null>(null);
  const staffDragItemRef = useRef<number | null>(null);
  const staffDragOverItemRef = useRef<number | null>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef<number>(0);

  const prevTrackIdRef = useRef<string | null>(null);
  const lastSyncTimeReportRef = useRef<number>(0);
  const wasSpeakerRef = useRef<boolean | null>(null);

  // Determine if THIS device is the designated speaker phone
  // If an active speaker is explicitly set on station, ONLY that device is the speaker!
  // If no speaker has been chosen yet, single device defaults to speaker.
  const activeSpeakerId = stationState?.speaker?.activeDeviceId;
  const connectedCount = stationState?.connectedDevices?.length || 0;
  const isSingleDevice = connectedCount <= 1;
  const isSpeakerNode = Boolean(
    activeSpeakerId
      ? activeSpeakerId === myDeviceId
      : isSingleDevice
  );

  // Check if there is an incoming handover request targeting this speaker device
  // OR an admin takeover notice targeting this device!
  const hasAdminTakeoverNotice = Boolean(
    stationState?.handoverRequest &&
    stationState.handoverRequest.status === 'admin_takeover' &&
    (stationState.handoverRequest.targetPreviousSpeakerId === myDeviceId ||
      (stationState.handoverRequest.requesterDeviceId !== myDeviceId && wasSpeakerRef.current === true))
  );

  const hasIncomingHandover = Boolean(
    hasAdminTakeoverNotice ||
    (isSpeakerNode &&
      stationState?.handoverRequest &&
      stationState.handoverRequest.requesterDeviceId !== myDeviceId &&
      stationState.handoverRequest.status === 'pending')
  );

  // Role Handlers
  const handleSelectRole = (role: 'staff' | 'admin') => {
    setUserRole(role);
    safeStorage.setItem('sangeet_user_role', role);
  };

  const handleSwitchRole = () => {
    setUserRole(null);
    safeStorage.removeItem('sangeet_user_role');
  };

  // Station Handlers (User joins station with assigned role)
  const handleSelectStation = (stationId: string, role: 'staff' | 'admin' = 'staff') => {
    setSelectedStationId(stationId);
    setUserRole(role);
    safeStorage.setItem('sangeet_selected_station', stationId);
    safeStorage.setItem('sangeet_user_role', role);
    dispatchAction('SELECT_STATION', { id: stationId });
  };

  const handleLeaveStation = () => {
    if (selectedStationId) {
      dispatchAction('LEAVE_STATION', { deviceId: myDeviceId });
      try {
        navigator.sendBeacon(
          `/api/station/${selectedStationId}/leave`,
          new Blob([JSON.stringify({ deviceId: myDeviceId })], { type: 'application/json' })
        );
      } catch {
        // ignore
      }
    }
    setSelectedStationId(null);
    safeStorage.removeItem('sangeet_selected_station');
  };

  const handleUpdateDeviceName = (name: string) => {
    setMyDeviceName(name);
    safeStorage.setItem('sangeet_device_name', name);
  };

  // Online / Offline monitor
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Send leave signal on tab close or navigation away
  useEffect(() => {
    const handleUnload = () => {
      if (selectedStationId && myDeviceId) {
        try {
          const blob = new Blob([JSON.stringify({ deviceId: myDeviceId })], { type: 'application/json' });
          navigator.sendBeacon(`/api/station/${selectedStationId}/leave`, blob);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [selectedStationId, myDeviceId]);

  const lastSettingsUpdateTimestampRef = useRef<number>(0);
  const optimisticSettingsRef = useRef<Partial<StationSettings>>({});
  const lastHealCheckRef = useRef<number>(0);

  // -------------------------------------------------------------
  // Poll Station State & Report Device Presence
  // -------------------------------------------------------------
  const fetchState = useCallback(async () => {
    try {
      const activeId = selectedStationId || DEFAULT_STATION_ID;
      const params = new URLSearchParams();
      if (selectedStationId && myDeviceId) {
        params.set('deviceId', myDeviceId);
        params.set('deviceName', myDeviceName || (userRole === 'admin' ? 'Admin Phone' : 'Staff Phone'));
        params.set('role', userRole || 'staff');
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/station/${activeId}${qs}`);
      if (!res.ok) {
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        setStationState((prev) => {
          if (Date.now() - lastSettingsUpdateTimestampRef.current < 4000) {
            return {
              ...json.data,
              settings: {
                ...json.data.settings,
                ...optimisticSettingsRef.current,
              },
            };
          }
          return json.data;
        });

        // Auto-heal: If server container restarted, restore custom promos from IndexedDB automatically
        if (Array.isArray(json.data.promos) && Date.now() - lastHealCheckRef.current > 7000) {
          lastHealCheckRef.current = Date.now();
          healServerPromosFromIndexedDB(activeId, json.data.promos, (_count, updatedPromos) => {
            setStationState((prev) => prev ? { ...prev, promos: updatedPromos } : prev);
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Network sync offline:', e);
    }
  }, [selectedStationId, myDeviceId, myDeviceName, userRole]);

  useEffect(() => {
    fetchState();
    const interval = window.setInterval(fetchState, 1500);
    return () => window.clearInterval(interval);
  }, [fetchState]);

  // Dispatch Action with auto-retry & resilient offline fallback
  const dispatchAction = async (action: string, payload: unknown = {}) => {
    if (action === 'UPDATE_SETTINGS' && (payload as any)?.settings) {
      const updates = (payload as any).settings;
      lastSettingsUpdateTimestampRef.current = Date.now();
      optimisticSettingsRef.current = { ...optimisticSettingsRef.current, ...updates };
      setStationState((prev) => prev ? {
        ...prev,
        settings: { ...prev.settings, ...updates }
      } : prev);
    } else if (action === 'SET_LOOP_MODE' && (payload as any)?.loopMode) {
      const mode = (payload as any).loopMode;
      lastSettingsUpdateTimestampRef.current = Date.now();
      optimisticSettingsRef.current = { ...optimisticSettingsRef.current, loopMode: mode };
      setStationState((prev) => prev ? {
        ...prev,
        settings: { ...prev.settings, loopMode: mode }
      } : prev);
    } else if (action === 'SET_SHUFFLE') {
      const enabled = typeof (payload as any)?.enabled === 'boolean'
        ? (payload as any).enabled
        : !Boolean(stationState?.settings?.isShuffleEnabled);
      lastSettingsUpdateTimestampRef.current = Date.now();
      optimisticSettingsRef.current = { ...optimisticSettingsRef.current, isShuffleEnabled: enabled };
      setStationState((prev) => prev ? {
        ...prev,
        settings: { ...prev.settings, isShuffleEnabled: enabled }
      } : prev);
    }

    const activeId = selectedStationId || DEFAULT_STATION_ID;

    // Retry loop (up to 2 attempts) to survive transient extension probes or brief reconnections
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/station/${activeId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, payload }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.success && json.data) {
          setStationState((prev) => {
            if (Date.now() - lastSettingsUpdateTimestampRef.current < 4000) {
              return {
                ...json.data,
                settings: {
                  ...json.data.settings,
                  ...optimisticSettingsRef.current,
                },
              };
            }
            return json.data;
          });
        }
        return;
      } catch (e) {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        console.warn('Action dispatch offline or queued:', action, e);
      }
    }
  };

  // Synchronize crossfade / fade duration with audioEngine
  useEffect(() => {
    if (stationState?.settings?.crossfadeSeconds !== undefined) {
      audioEngine.setCrossfadeSeconds(stationState.settings.crossfadeSeconds);
    }
  }, [stationState?.settings?.crossfadeSeconds]);

  // Speaker Transition & Notifications
  const [speakerBanner, setSpeakerBanner] = useState<{
    type: 'became_speaker' | 'became_remote';
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    if (!stationState) return;

    if (wasSpeakerRef.current === null) {
      wasSpeakerRef.current = isSpeakerNode;
      return;
    }

    if (!wasSpeakerRef.current && isSpeakerNode) {
      // PROMOTED TO SPEAKER!
      setSpeakerBanner({
        type: 'became_speaker',
        title: '🔊 Speaker Mode Active!',
        description: 'Yeh phone station ka Speaker ban gaya hai. Forecourt audio ab is phone se bajega.',
      });
      // Start music seamlessly if currently playing on station
      if (stationState.currentTrack && stationState.playbackState.isPlaying) {
        audioEngine.playMusic(
          stationState.currentTrack.audioUrl,
          stationState.playbackState.currentTime || 0,
          stationState.currentTrack
        );
      }
      const t = setTimeout(() => setSpeakerBanner(null), 5000);
      return () => clearTimeout(t);
    } else if (wasSpeakerRef.current && !isSpeakerNode) {
      // TRANSFERRED TO REMOTE!
      setSpeakerBanner({
        type: 'became_remote',
        title: '📱 Remote Mode (Silent)',
        description: 'Aap Remote Controller par hain. Gaana station ke doosre speaker phone se baj raha hai.',
      });
      audioEngine.stopAll();
      const t = setTimeout(() => setSpeakerBanner(null), 5000);
      return () => clearTimeout(t);
    }

    wasSpeakerRef.current = isSpeakerNode;
  }, [isSpeakerNode, stationState]);

  const handleRandomizeSpeaker = () => {
    dispatchAction('RANDOMIZE_SPEAKER');
  };

  const handleReleaseSpeaker = () => {
    dispatchAction('RELEASE_SPEAKER_MODE', { deviceId: myDeviceId });
  };

  // -------------------------------------------------------------
  // CRITICAL AUDIO SILENCE GUARD:
  // If this device is NOT the speaker phone, SILENCE all local audio!
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isSpeakerNode) {
      // Remote phone: Completely mute and stop audio
      audioEngine.stopAll();
    }
  }, [isSpeakerNode]);

  // -------------------------------------------------------------
  // Playback & Promo Engine (RUNS ON SPEAKER NODE)
  // -------------------------------------------------------------
  const isAdvancingRef = useRef<boolean>(false);

  const playNextResolvedTrack = useCallback(() => {
    if (!stationState) return;

    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    setTimeout(() => {
      isAdvancingRef.current = false;
    }, 1000);

    const { settings, songsPlayedSinceLastPromo, promos, isPromoPlaying, currentTrack } = stationState;
    const loopMode = settings?.loopMode || 'none';
    const isShuffleEnabled = Boolean(settings?.isShuffleEnabled);

    // 1. Single Track Repeat (LOOP-ONE): Replay the same track from beginning continuously!
    if (loopMode === 'one' && currentTrack) {
      if (isSpeakerNode) {
        audioEngine.seekMusic(0);
        audioEngine.playMusic(currentTrack.audioUrl, 0, currentTrack);
      }
      dispatchAction('UPDATE_PLAYBACK', {
        isPlaying: true,
        currentTime: 0,
      });
      return;
    }

    // 2. Song-Wise Mode: Check if target completed tracks reached since last promo
    const shouldTriggerSongPromo =
      settings.promosEnabled &&
      !isPromoPlaying &&
      settings.promoIntervalType === 'songs_count' &&
      promos.some((p) => p.enabled) &&
      (songsPlayedSinceLastPromo + 1) >= (settings.promoSongInterval || 2);

    if (shouldTriggerSongPromo) {
      const activePromos = promos.filter((p) => {
        if (!p.enabled) return false;
        if (settings.activeCategoryFilter !== 'all' && p.categoryId !== settings.activeCategoryFilter) {
          return false;
        }
        return true;
      });

      const promoToPlay = activePromos.length > 0
        ? activePromos[Math.floor(Math.random() * activePromos.length)]
        : promos.find((p) => p.enabled);

      if (promoToPlay) {
        console.log(`[Promo Engine] Song count interval reached (${songsPlayedSinceLastPromo + 1} tracks). Triggering inter-track promo: ${promoToPlay.title}`);
        dispatchAction('PROMO_STARTED', {
          promoClip: promoToPlay,
          triggerSource: 'songs_count',
        });
        return;
      }
    }

    // 3. Skip to next track in priority order: Admin > Staff > Recommendations
    // Loop-All and Shuffle only impact the queue or current playlist as requested!
    dispatchAction('SKIP_TRACK', {
      autoAdvance: true,
      loopMode,
      isShuffleEnabled,
    });
  }, [stationState, isSpeakerNode]);

  // Hook audio events and track completion
  useEffect(() => {
    audioEngine.setOnTrackEnded(() => {
      playNextResolvedTrack();
    });

    const audio = audioEngine.getMusicAudioElement();
    if (!audio) return;

    let lastUiTimeUpdate = 0;
    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - lastUiTimeUpdate >= 500) {
        lastUiTimeUpdate = now;
        const cur = audioEngine.getCurrentTime();
        setCurrentTime(cur);
        if (now - lastSyncTimeReportRef.current > 3000) {
          lastSyncTimeReportRef.current = now;
          dispatchAction('UPDATE_PLAYBACK', { currentTime: cur });
        }
      }
    };

    const onLoadedMetadata = () => setDuration(audio.duration || audioEngine.getDuration());

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    // Polling interval for YouTube tracks which update time via API
    const ytInterval = window.setInterval(() => {
      if (stationState?.playbackState?.isPlaying) {
        const cur = audioEngine.getCurrentTime();
        if (cur > 0) {
          setCurrentTime(cur);
          if (Date.now() - lastSyncTimeReportRef.current > 3000) {
            lastSyncTimeReportRef.current = Date.now();
            dispatchAction('UPDATE_PLAYBACK', { currentTime: cur });
          }
        }
      }
    }, 1000);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      window.clearInterval(ytInterval);
    };
  }, [playNextResolvedTrack, stationState?.playbackState?.isPlaying]);

  // Register Lockscreen & Notification Media Controls via MediaSession API
  useEffect(() => {
    mediaSessionService.setCallbacks({
      onPlay: () => {
        if (isSpeakerNode) {
          audioEngine.resumeMusic();
        }
        dispatchAction('UPDATE_PLAYBACK', { isPlaying: true });
      },
      onPause: () => {
        if (isSpeakerNode) {
          audioEngine.pauseMusic();
        }
        dispatchAction('UPDATE_PLAYBACK', { isPlaying: false });
      },
      onNext: () => {
        playNextResolvedTrack();
      },
      onPrevious: () => {
        const cur = audioEngine.getCurrentTime();
        if (cur > 4) {
          audioEngine.seekMusic(0);
          dispatchAction('UPDATE_PLAYBACK', { currentTime: 0 });
        } else {
          audioEngine.seekMusic(0);
          dispatchAction('UPDATE_PLAYBACK', { currentTime: 0 });
        }
      },
      onSeek: (timeSec) => {
        audioEngine.seekMusic(timeSec);
        dispatchAction('UPDATE_PLAYBACK', { currentTime: timeSec });
      },
      onStop: () => {
        audioEngine.stopAll();
        dispatchAction('UPDATE_PLAYBACK', { isPlaying: false });
      },
    });
  }, [isSpeakerNode, playNextResolvedTrack, dispatchAction]);

  // Synchronize Track Metadata with Lockscreen & Notification Shade
  useEffect(() => {
    if (!stationState) return;

    if (stationState.isPromoPlaying && stationState.activePromoClip) {
      mediaSessionService.updatePromoMetadata(stationState.activePromoClip, stationState.stationName);
    } else {
      mediaSessionService.updateTrackMetadata(stationState.currentTrack, stationState.stationName);
    }
  }, [
    stationState?.currentTrack,
    stationState?.stationName,
    stationState?.isPromoPlaying,
    stationState?.activePromoClip,
  ]);

  // Synchronize Playback State with Lockscreen & Notification Shade
  useEffect(() => {
    const isPlaying = Boolean(stationState?.playbackState?.isPlaying);
    mediaSessionService.setPlaybackState(isPlaying);
  }, [stationState?.playbackState?.isPlaying]);

  // Synchronize Scrubber Position State with Lockscreen
  useEffect(() => {
    if (duration > 0 && currentTime >= 0) {
      mediaSessionService.updatePositionState(currentTime, duration);
    }
  }, [currentTime, duration]);

  // Sync Audio Playback ON SPEAKER NODE ONLY
  useEffect(() => {
    if (!stationState) return;

    // Remote mode devices: Estimate scrubber position from server state & keep audio silent
    if (!isSpeakerNode) {
      audioEngine.muteForRemote();
      if (stationState.playbackState.isPlaying) {
        const elapsed = (Date.now() - stationState.playbackState.updatedAt) / 1000;
        setCurrentTime((stationState.playbackState.currentTime || 0) + elapsed);
      } else {
        setCurrentTime(stationState.playbackState.currentTime || 0);
      }
      setDuration(stationState.currentTrack?.duration || 180);
      return;
    }

    // Active Speaker device: unmute & apply station master volume
    // Crucial: Do not force unmute or override ducking if promo announcement or live mic is currently ducked!
    if (!stationState.isPromoPlaying && !audioEngine.isDuckingActive()) {
      audioEngine.unmuteForSpeaker();
    }
    if (typeof stationState.settings?.masterVolume === 'number') {
      audioEngine.setMasterVolume(stationState.settings.masterVolume / 100);
    }

    // Speaker Mode Device: Controls actual HTMLAudio and YouTube output
    const { currentTrack, playbackState } = stationState;
    if (!currentTrack) {
      audioEngine.pauseMusic();
      return;
    }

    if (prevTrackIdRef.current !== currentTrack.id) {
      prevTrackIdRef.current = currentTrack.id;
      if (playbackState.isPlaying) {
        audioEngine.playMusic(currentTrack.audioUrl, playbackState.currentTime || 0, currentTrack);
      } else {
        audioEngine.pauseMusic();
      }

      // Lookahead pre-cache upcoming track
      const nextUpcoming =
        stationState.adminQueue[0] ||
        stationState.staffQueue[0] ||
        stationState.recommendations[0];
      if (nextUpcoming && nextUpcoming.source !== 'youtube') {
        audioEngine.preCacheTrack(nextUpcoming.audioUrl);
      }
    } else {
      if (playbackState.isPlaying) {
        // Do not interrupt ducking or force un-duck while promo announcement or live mic is actively broadcasting
        if (!stationState.isPromoPlaying && !audioEngine.isDuckingActive()) {
          audioEngine.resumeMusic();
        }
      } else {
        audioEngine.pauseMusic();
      }
    }
  }, [stationState, isSpeakerNode]);

  // Ensure Speaker Node plays promo when station promo is started (remotely or locally)
  const activePromoSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isSpeakerNode || !stationState) return;

    if (stationState.isPromoPlaying && stationState.activePromoClip) {
      const clip = stationState.activePromoClip;
      const triggerSource = stationState.promoTriggerSource;
      const sessionKey = `${clip.id}-${stationState.lastPromoPlayedAt || 0}`;
      if (activePromoSessionRef.current === sessionKey) return;
      activePromoSessionRef.current = sessionKey;

      audioEngine.playPromo(
        clip.audioUrl,
        {
          duckingMode: stationState.settings.duckingMode || 'db',
          duckingDb: stationState.settings.duckingDb ?? -25,
          duckingPercent: stationState.settings.duckingVolumePercent ?? 18,
          fadeDurationSeconds: stationState.settings.fadeDurationSeconds ?? 1.0,
          repetitions: stationState.settings.promoRepetitions ?? 2,
        },
        () => {
          activePromoSessionRef.current = null;
          dispatchAction('PROMO_FINISHED');
          // If this promo was triggered by Song-Wise interval between tracks, advance to the next song!
          // If triggered by Time-Wise (mid-track) or Manual trigger, background music smoothly restores and continues playing!
          if (triggerSource === 'songs_count') {
            dispatchAction('SKIP_TRACK', { afterPromo: true });
          }
        }
      );
    } else if (!stationState.isPromoPlaying) {
      if (activePromoSessionRef.current) {
        activePromoSessionRef.current = null;
        audioEngine.stopPromo();
      }
    }
  }, [
    isSpeakerNode,
    stationState?.isPromoPlaying,
    stationState?.activePromoClip,
    stationState?.lastPromoPlayedAt,
    stationState?.promoTriggerSource,
    stationState?.settings,
  ]);

  // -------------------------------------------------------------
  // Real-Time Time-Wise Promo Trigger Engine (Speaker Node)
  // Continuous clock check: triggers mid-track ducked promo as soon as time interval completes
  // -------------------------------------------------------------
  const lastTimeWiseTriggerRef = useRef<number>(0);
  useEffect(() => {
    if (!isSpeakerNode || !stationState) return;

    const intervalId = window.setInterval(() => {
      const { settings, promos, isPromoPlaying, isLiveMicActive, lastPromoPlayedAt } = stationState;

      // 1. Only run in time_interval mode with promos enabled
      if (settings.promoIntervalType !== 'time_interval' || !settings.promosEnabled) return;

      // 2. Never interrupt an ongoing promo or live mic
      if (isPromoPlaying || isLiveMicActive) return;

      // 3. Compute elapsed time since last promo
      const intervalMinutes = Math.max(0.5, settings.promoTimeIntervalMinutes || 1);
      const intervalMs = intervalMinutes * 60 * 1000;
      const now = Date.now();
      const elapsed = now - (lastPromoPlayedAt || 0);

      if (elapsed >= intervalMs) {
        // Prevent rapid repeated dispatches within 8 seconds
        if (now - lastTimeWiseTriggerRef.current < 8000) return;
        lastTimeWiseTriggerRef.current = now;

        const activePromos = promos.filter((p) => {
          if (!p.enabled) return false;
          if (settings.activeCategoryFilter !== 'all' && p.categoryId !== settings.activeCategoryFilter) {
            return false;
          }
          return true;
        });

        const promoToPlay = activePromos.length > 0
          ? activePromos[Math.floor(Math.random() * activePromos.length)]
          : promos.find((p) => p.enabled);

        if (promoToPlay) {
          console.log(
            `[Promo Engine] Real-time interval reached (${(elapsed / 1000).toFixed(0)}s >= ${intervalMinutes * 60}s). Triggering mid-track ducked promo: "${promoToPlay.title}"`
          );
          dispatchAction('PROMO_STARTED', {
            promoClip: promoToPlay,
            triggerSource: 'time_interval',
          });
        }
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isSpeakerNode, stationState]);

  // Ensure Speaker Node ducks music and handles Live PA / Voice Announcement
  const activeAnnouncementSessionRef = useRef<number | null>(null);
  const wasLiveMicActiveRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isSpeakerNode || !stationState) return;

    if (stationState.isLiveMicActive) {
      wasLiveMicActiveRef.current = true;

      // Case A: Broadcast Voice Speech message (e.g. from Remote or Local Admin)
      if (stationState.broadcastMessage && stationState.broadcastTimestamp) {
        if (activeAnnouncementSessionRef.current !== stationState.broadcastTimestamp) {
          activeAnnouncementSessionRef.current = stationState.broadcastTimestamp;

          audioEngine.broadcastSpeechAnnouncement(stationState.broadcastMessage, {
            duckingPercent: stationState.settings.duckingVolumePercent || 15,
            onStart: () => {},
            onEnd: () => {
              activeAnnouncementSessionRef.current = null;
              dispatchAction('STOP_LIVE_ANNOUNCEMENT');
            },
          });
        }
      } else {
        // Case B: Live PA Mic Announcement (Speaker ducks music in real time)
        if (stationState.liveMicMode === 'manual' && typeof stationState.liveMicManualMusicVolume === 'number') {
          audioEngine.setLiveMusicVolume(stationState.liveMicManualMusicVolume);
        } else {
          audioEngine.duckMusic({
            mode: stationState.settings.duckingMode || 'db',
            db: stationState.settings.duckingDb ?? -25,
            percent: stationState.settings.duckingVolumePercent ?? 18,
            rampSeconds: stationState.settings.fadeDurationSeconds ?? 1.0,
          });
        }
      }
    } else {
      // Live announcement turned off -> restore background music on speaker node
      if (wasLiveMicActiveRef.current) {
        wasLiveMicActiveRef.current = false;
        activeAnnouncementSessionRef.current = null;
        if (!stationState.isPromoPlaying) {
          audioEngine.restoreMusic(stationState.settings.fadeDurationSeconds ?? 1.0);
        }
      }
    }
  }, [
    isSpeakerNode,
    stationState?.isLiveMicActive,
    stationState?.liveMicMode,
    stationState?.liveMicManualMusicVolume,
    stationState?.broadcastMessage,
    stationState?.broadcastTimestamp,
    stationState?.settings,
    stationState?.isPromoPlaying,
  ]);

  // -------------------------------------------------------------
  // User Actions
  // -------------------------------------------------------------
  const handleStartAudio = async () => {
    audioEngine.init();
    await audioEngine.resumeContext();
    audioEngine.unMute();
    setIsAudioContextStarted(true);
    if (isSpeakerNode && stationState?.currentTrack) {
      audioEngine.playMusic(
        stationState.currentTrack.audioUrl,
        audioEngine.getCurrentTime() || stationState.playbackState.currentTime || 0,
        stationState.currentTrack
      );
    }
  };

  const handlePlayPause = () => {
    if (!stationState) return;
    const isCurrentAdminTrack = Boolean(
      stationState?.currentTrack &&
      (stationState.currentTrack.priority === 'admin_instant' ||
       stationState.currentTrack.priority === 'admin_high' ||
       stationState.currentTrack.requestedBy === 'Station Admin' ||
       stationState.currentTrack.requestedBy === 'Admin')
    );
    if (userRole !== 'admin' && isCurrentAdminTrack) {
      return;
    }

    const nextState = !stationState.playbackState.isPlaying;
    dispatchAction('UPDATE_PLAYBACK', { isPlaying: nextState });

    if (isSpeakerNode) {
      if (nextState) {
        audioEngine.resumeContext();
        audioEngine.unMute();
        audioEngine.resumeMusic();
      } else {
        audioEngine.pauseMusic();
      }
    }
  };

  const handleSkipNext = () => {
    // If playing track is admin priority, speaker/staff cannot skip it
    const isCurrentAdminTrack = Boolean(
      stationState?.currentTrack &&
      (stationState.currentTrack.priority === 'admin_instant' ||
       stationState.currentTrack.priority === 'admin_high' ||
       stationState.currentTrack.requestedBy === 'Station Admin' ||
       stationState.currentTrack.requestedBy === 'Admin')
    );
    if (isCurrentAdminTrack && userRole !== 'admin') {
      return;
    }
    dispatchAction('SKIP_TRACK', {
      requesterRole: userRole || 'staff',
      autoAdvance: false,
      loopMode: stationState?.settings?.loopMode || 'none',
      isShuffleEnabled: Boolean(stationState?.settings?.isShuffleEnabled),
    });
  };

  const handleSkipPrevious = () => {
    const isCurrentAdminTrack = Boolean(
      stationState?.currentTrack &&
      (stationState.currentTrack.priority === 'admin_instant' ||
       stationState.currentTrack.priority === 'admin_high' ||
       stationState.currentTrack.requestedBy === 'Station Admin' ||
       stationState.currentTrack.requestedBy === 'Admin')
    );
    if (userRole !== 'admin' && isCurrentAdminTrack) {
      return;
    }

    if (currentTime > 3) {
      if (isSpeakerNode) {
        audioEngine.seekMusic(0);
      }
      setCurrentTime(0);
      dispatchAction('UPDATE_PLAYBACK', { currentTime: 0 });
    } else {
      dispatchAction('PREVIOUS_TRACK', { forcePrev: true });
    }
  };

  const handleSeek = (seconds: number) => {
    const isCurrentAdminTrack = Boolean(
      stationState?.currentTrack &&
      (stationState.currentTrack.priority === 'admin_instant' ||
       stationState.currentTrack.priority === 'admin_high' ||
       stationState.currentTrack.requestedBy === 'Station Admin' ||
       stationState.currentTrack.requestedBy === 'Admin')
    );
    if (userRole !== 'admin' && isCurrentAdminTrack) {
      return;
    }

    if (isSpeakerNode) {
      audioEngine.seekMusic(seconds);
    }
    setCurrentTime(seconds);
    dispatchAction('UPDATE_PLAYBACK', { currentTime: seconds });
  };

  const handleAddTrack = (track: SongTrack) => {
    if (isSpeakerNode) {
      audioEngine.resumeContext();
    }
    const isAdmin = userRole === 'admin';
    dispatchAction('ADD_TO_QUEUE', {
      track,
      deviceId: myDeviceId,
      deviceName: myDeviceName,
      requestedBy: isAdmin ? 'Station Admin' : myDeviceName,
      priority: isAdmin ? 'admin_high' : 'staff_normal',
      requesterRole: userRole || 'staff',
    });
  };

  const handlePlayNext = (track: SongTrack) => {
    if (isSpeakerNode) {
      audioEngine.resumeContext();
    }
    const isAdmin = userRole === 'admin';
    dispatchAction('PLAY_NEXT', {
      track,
      deviceId: myDeviceId,
      deviceName: myDeviceName,
      requestedBy: isAdmin ? 'Station Admin' : myDeviceName,
      priority: isAdmin ? 'admin_high' : 'staff_normal',
      requesterRole: userRole || 'staff',
    });
  };

  const handleSetMasterVolume = (volume: number) => {
    if (userRole !== 'admin') return;
    dispatchAction('SET_MASTER_VOLUME', {
      volume,
      requesterRole: 'admin',
    });
  };

  const handleClearQueue = (queueType: 'staff' | 'admin' | 'all' = 'staff') => {
    dispatchAction('CLEAR_QUEUE', { queueType });
  };

  const handleReorderQueue = (newQueue: SongTrack[], queueType: 'staff' | 'admin' = 'staff') => {
    dispatchAction('REORDER_QUEUE', { queueType, newQueue });
  };

  const handleRemoveTrack = (trackId: string, queueType: 'admin' | 'staff') => {
    dispatchAction('REMOVE_TRACK', { trackId, queueType });
  };

  const handlePlayTrackNow = (track: SongTrack) => {
    if (isSpeakerNode) {
      audioEngine.resumeContext();
    }
    const isAdmin = userRole === 'admin';

    // Tier 1: Administrator (Can play anything immediately)
    if (isAdmin) {
      dispatchAction('ADMIN_PLAY_NOW', {
        track,
        deviceId: myDeviceId,
        deviceName: myDeviceName,
        requestedBy: 'Station Admin',
        requesterRole: 'admin',
      });
      return;
    }

    // Tier 2: Speaker Phone (Can play now, UNLESS current track was requested by Admin)
    if (isSpeakerNode) {
      const isCurrentAdminTrack = Boolean(
        stationState?.currentTrack &&
        (stationState.currentTrack.priority === 'admin_instant' || stationState.currentTrack.priority === 'admin_high')
      );
      if (isCurrentAdminTrack) {
        // Fallback: put right at top of queue (Play Next)
        handlePlayNext(track);
        return;
      }

      dispatchAction('PLAY_NOW', {
        track,
        deviceId: myDeviceId,
        deviceName: myDeviceName,
        requestedBy: myDeviceName,
        priority: 'staff_normal',
        requesterRole: 'staff',
      });
      return;
    }

    // Tier 3: Remote Device (Cannot stop/interrupt current music -> Play Next instead)
    handlePlayNext(track);
  };

  const handleExecuteDashSearch = async (
    q: string = dashSearchQuery,
    source: 'all' | 'youtube' | 'saavn' = dashSourceFilter
  ) => {
    const trimmed = q.trim();

    // 1. Abort previous pending search request immediately
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }

    if (!trimmed) {
      searchRequestIdRef.current += 1;
      setDashSearchResults([]);
      setIsSearchingDash(false);
      return;
    }

    // 2. Track unique Request ID for this specific search invocation
    const currentRequestId = ++searchRequestIdRef.current;

    // 3. Create fresh AbortController for this search
    const controller = new AbortController();
    searchAbortControllerRef.current = controller;

    setDashSearchQuery(trimmed);
    setIsSearchingDash(true);

    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(trimmed)}&source=${source}`,
        { signal: controller.signal }
      );

      // Verify that this is still the latest initiated search request
      if (currentRequestId !== searchRequestIdRef.current) {
        return;
      }

      const data = await res.json();

      // Only update state if this request is still the active one
      if (currentRequestId === searchRequestIdRef.current && data.success) {
        const rawResults: SongTrack[] = data.results || [];
        const isJukeboxSearch = /jukebox|nonstop|non-stop|album|all songs|mashup|medley/i.test(trimmed);

        // Strict client-side validation check:
        // 1. Filter out results that exceed reasonable duration (> 15 minutes / 900 seconds) unless explicit jukebox query
        // 2. Filter out results that appear to be non-official re-uploads or AI remakes
        const validatedResults = rawResults.filter((track) => {
          if (!track) return false;

          // Duration check: Max 15 minutes (900s) for individual single songs
          const sec = track.duration || 0;
          if (!isJukeboxSearch && sec > 900) {
            return false;
          }

          // Anti-AI / Non-official re-upload filter
          const combined = `${track.title || ''} ${track.artist || ''} ${track.album || ''}`.toLowerCase();
          const isAiOrSuspicious = /(ai\s*cover|ai\s*remake|ai\s*version|ai\s*voice|ai\s*generated|voice\s*clone|vocal\s*ai|\bsuno\b|\budio\b|fake\s*remake|cheap\s*remake|slowed\s*\+\s*reverb|fan\s*made|re-upload|reupload)/i.test(combined);
          if (isAiOrSuspicious) {
            return false;
          }

          return true;
        });

        setDashSearchResults(validatedResults);
      }
    } catch (e: unknown) {
      const err = e as { name?: string };
      // Normal abort cancellation: Ignore quietly
      if (err?.name === 'AbortError') {
        return;
      }
      console.warn('Dashboard search notice:', e);
    } finally {
      // Only turn off loading if this is the latest request
      if (currentRequestId === searchRequestIdRef.current) {
        setIsSearchingDash(false);
        if (searchAbortControllerRef.current === controller) {
          searchAbortControllerRef.current = null;
        }
      }
    }
  };

  const isMoodMixActive = Boolean(stationState?.settings?.moodMixEnabled);
  const detectedMood = stationState?.settings?.detectedMood;
  const moodTheme = getMoodTheme(detectedMood);
  const [mixHulchulKey, setMixHulchulKey] = useState<number | null>(null);

  const handleToggleMoodMix = async () => {
    const nextVal = !isMoodMixActive;
    // Ambient background hulchul surge on click (both ON and OFF)
    setMixHulchulKey(Date.now());
    setTimeout(() => {
      setMixHulchulKey(null);
    }, 1250);

    if (stationState) {
      setStationState((prev) =>
        prev
          ? {
              ...prev,
              settings: {
                ...prev.settings,
                moodMixEnabled: nextVal,
              },
            }
          : null
      );
    }
    dispatchAction('SET_MOOD_MIX', { enabled: nextVal });
  };

  const handleRefreshAutoMix = async () => {
    try {
      const activeId = selectedStationId || DEFAULT_STATION_ID;
      const res = await fetch(`/api/station/${activeId}/refresh-mix`, { method: 'POST' });
      const data = await res.json();
      if (data.success && stationState) {
        setStationState(prev => prev ? {
          ...prev,
          recommendations: data.recommendations,
          settings: {
            ...prev.settings,
            moodMixEnabled: data.moodMixEnabled !== undefined ? data.moodMixEnabled : prev.settings.moodMixEnabled,
            detectedMood: data.detectedMood || prev.settings.detectedMood,
          }
        } : null);
      }
    } catch (err) {
      console.warn('Auto-mix refresh notice:', err);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTriggerUrgentPromo = () => {
    if (!stationState) return;
    const enabledPromos = stationState.promos.filter((p) => p.enabled);
    if (enabledPromos.length === 0) return;

    const promo = enabledPromos[Math.floor(Math.random() * enabledPromos.length)];
    dispatchAction('PROMO_STARTED', { promoClip: promo, triggerSource: 'manual' });
  };

  const handleStopPromo = async () => {
    if (isSpeakerNode) {
      await audioEngine.stopPromo();
    }
    dispatchAction('STOP_PROMO');
  };

  // Handover actions
  const handleClaimSpeakerDirectly = () => {
    dispatchAction('CLAIM_SPEAKER_MODE', {
      deviceId: myDeviceId,
      deviceName: myDeviceName,
      role: userRole || 'staff',
    });
  };

  const handleRequestSpeakerHandover = () => {
    dispatchAction('REQUEST_SPEAKER_HANDOVER', {
      deviceId: myDeviceId,
      deviceName: myDeviceName,
      role: userRole || 'staff',
      requesterRole: userRole || 'staff',
    });
  };

  const handleRespondSpeakerHandover = (approved: boolean) => {
    dispatchAction('RESPOND_SPEAKER_HANDOVER', { approved });
  };

  const handleAssignSpeakerDevice = (targetDeviceId: string, targetDeviceName: string) => {
    dispatchAction('ADMIN_ASSIGN_SPEAKER', {
      targetDeviceId,
      targetDeviceName,
      myDeviceId,
      myDeviceName,
      requesterRole: 'admin',
    });
  };

  const handleDismissHandoverNotice = () => {
    dispatchAction('DISMISS_HANDOVER_NOTICE');
  };

  const handleStartLiveAnnouncement = useCallback((payload?: {
    adminName?: string;
    mode?: 'auto' | 'manual';
    manualMusicVolume?: number;
    broadcastMessage?: string;
  }) => {
    dispatchAction('START_LIVE_ANNOUNCEMENT', {
      adminName: payload?.adminName || myDeviceName || (userRole === 'admin' ? 'Station Admin' : 'Staff Phone'),
      ...payload,
    });
  }, [dispatchAction, myDeviceName, userRole]);

  const handleStopLiveAnnouncement = useCallback(() => {
    dispatchAction('STOP_LIVE_ANNOUNCEMENT');
  }, [dispatchAction]);

  // -------------------------------------------------------------
  // STATION SELECTION (First screen when opening app or switching station)
  // -------------------------------------------------------------
  if (!selectedStationId) {
    return (
      <StationSelectScreen
        stations={stationState?.stations || []}
        onSelectStation={(stId, role) => handleSelectStation(stId, role)}
        onAddStation={(newSt) => dispatchAction('ADD_STATION', newSt)}
      />
    );
  }

  // -------------------------------------------------------------
  // LOADING STATE (While initial station state is fetching)
  // -------------------------------------------------------------
  if (!stationState) {
    return (
      <div className="min-h-screen bg-[#030303] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#ff0000] flex items-center justify-center shadow-xl shadow-[#ff0000]/30 animate-pulse">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white ml-0.5" aria-hidden="true">
              <path d="M10 8.64L15.27 12 10 15.36V8.64M8 5v14l11-7L8 5z" />
            </svg>
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-black text-white tracking-tight">Sangeet</h2>
            <p className="text-xs text-neutral-400 font-normal">Connecting to station jukebox &amp; radio...</p>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // DEDICATED MOBILE LAYOUT (Runs on Mobile < 768px, Touch, or Mobile Mode)
  // -------------------------------------------------------------
  if (isMobile) {
    return (
      <MobileAppLayout
        stationState={stationState}
        userRole={userRole || 'staff'}
        isSpeakerNode={isSpeakerNode}
        myDeviceId={myDeviceId}
        myDeviceName={myDeviceName}
        currentTime={currentTime}
        duration={duration}
        isAudioContextStarted={isAudioContextStarted}
        isSpeakerModalOpen={isSpeakerModalOpen}
        hasIncomingHandover={hasIncomingHandover}
        onSetIsSpeakerModalOpen={setIsSpeakerModalOpen}
        onLeaveStation={handleLeaveStation}
        onSwitchRole={handleSwitchRole}
        onUpdateDeviceName={handleUpdateDeviceName}
        onPlayPause={handlePlayPause}
        onSkipNext={handleSkipNext}
        onSkipPrevious={handleSkipPrevious}
        onSeek={handleSeek}
        onPlayTrackNow={handlePlayTrackNow}
        onAddTrackToQueue={handleAddTrack}
        onPlayNext={handlePlayNext}
        onRemoveTrack={handleRemoveTrack}
        onReorderStaffQueue={(newQueue) => handleReorderQueue(newQueue, 'staff')}
        onReorderAdminQueue={(newQueue) => handleReorderQueue(newQueue, 'admin')}
        onClearQueue={handleClearQueue}
        onRefreshMix={handleRefreshAutoMix}
        onUpdateSettings={(settings) => dispatchAction('UPDATE_SETTINGS', { settings })}
        onUpdateAdminPin={(adminPin) => dispatchAction('UPDATE_SETTINGS', { adminPin })}
        onAddPromo={(promo) => {
          savePromoToLocalDB(promo as any, (promo as any).audioUrl || (promo as any).audioData).catch(() => {});
          const alreadyInList = stationState?.promos?.some(
            (p) => (promo as any).id && p.id === (promo as any).id
          );
          if (!alreadyInList) {
            dispatchAction('ADD_PROMO', promo);
          }
        }}
        onTogglePromo={(id, enabled) => dispatchAction('UPDATE_PROMO', { id, enabled })}
        onDeletePromo={(id) => {
          deletePromoFromLocalDB(id).catch(() => {});
          dispatchAction('DELETE_PROMO', { id });
        }}
        onAddCategory={(cat) => dispatchAction('ADD_CATEGORY', cat)}
        onDeleteCategory={(id) => dispatchAction('DELETE_CATEGORY', { id })}
        onAddStation={(station) => dispatchAction('ADD_STATION', station)}
        onUpdateStation={(id, updates) => dispatchAction('UPDATE_STATION', { id, updates })}
        onDeleteStation={(id) => dispatchAction('DELETE_STATION', { id })}
        onSelectStation={(id, role) => handleSelectStation(id, role)}
        onTriggerUrgentPromo={handleTriggerUrgentPromo}
        onStopPromo={handleStopPromo}
        onClaimSpeakerDirectly={handleClaimSpeakerDirectly}
        onRequestSpeakerHandover={handleRequestSpeakerHandover}
        onRespondSpeakerHandover={handleRespondSpeakerHandover}
        onRandomizeSpeaker={handleRandomizeSpeaker}
        onReleaseSpeaker={handleReleaseSpeaker}
        onToggleDesktopPreview={toggleMobilePreview}
        onStartLiveAnnouncement={handleStartLiveAnnouncement}
        onStopLiveAnnouncement={handleStopLiveAnnouncement}
        onSetMasterVolume={handleSetMasterVolume}
        isMoodMixActive={isMoodMixActive}
        detectedMood={detectedMood}
        mixShockwaveKey={mixHulchulKey}
        onToggleMoodMix={handleToggleMoodMix}
        onToggleLikeTrack={(track) => dispatchAction('TOGGLE_LIKE_TRACK', { track })}
        onRemoveLikedTrack={(trackId) => dispatchAction('REMOVE_LIKED_TRACK', { trackId })}
        onAssignSpeakerDevice={handleAssignSpeakerDevice}
        onDismissHandoverNotice={handleDismissHandoverNotice}
      />
    );
  }

  // -------------------------------------------------------------
  // DESKTOP SCREEN 3: ADMIN CONSOLE VIEW (PC Only)
  // -------------------------------------------------------------
  if (userRole === 'admin') {
    return (
      <>
        <AdminConsoleView
          stationName={stationState.stationName}
          stationId={stationState.stationId}
          adminPin={stationState.adminPin}
          stations={stationState.stations}
          settings={stationState.settings}
          categories={stationState.categories}
          promos={stationState.promos}
          currentTrack={stationState.currentTrack}
          adminQueue={stationState.adminQueue}
          staffQueue={stationState.staffQueue}
          recommendations={stationState.recommendations}
          playedHistory={stationState.playedHistory || []}
          isPlaying={stationState.playbackState.isPlaying}
          currentTime={currentTime}
          duration={duration}
          isPromoPlaying={stationState.isPromoPlaying}
          activePromoClip={stationState.activePromoClip}
          isSpeakerNode={isSpeakerNode}
          onPlayPause={handlePlayPause}
          onSkipNext={handleSkipNext}
          onSkipPrevious={handleSkipPrevious}
          onSeek={handleSeek}
          onVolumeChange={(vol) => audioEngine.setMasterVolume(vol)}
          onUpdateSettings={(settings) => dispatchAction('UPDATE_SETTINGS', { settings })}
          onUpdateAdminPin={(adminPin) => dispatchAction('UPDATE_SETTINGS', { adminPin })}
          onAddStation={(station) => dispatchAction('ADD_STATION', station)}
          onUpdateStation={(id, updates) => dispatchAction('UPDATE_STATION', { id, updates })}
          onDeleteStation={(id) => dispatchAction('DELETE_STATION', { id })}
          onSelectStation={(id) => handleSelectStation(id)}
          onAddCategory={(cat) => dispatchAction('ADD_CATEGORY', cat)}
          onDeleteCategory={(id) => dispatchAction('DELETE_CATEGORY', { id })}
          onAddPromo={(promo) => {
            savePromoToLocalDB(promo as any, (promo as any).audioUrl || (promo as any).audioData).catch(() => {});
            const alreadyInList = stationState?.promos?.some(
              (p) => (promo as any).id && p.id === (promo as any).id
            );
            if (!alreadyInList) {
              dispatchAction('ADD_PROMO', promo);
            }
          }}
          onTogglePromo={(id, enabled) => dispatchAction('UPDATE_PROMO', { id, enabled })}
          onDeletePromo={(id) => {
            deletePromoFromLocalDB(id).catch(() => {});
            dispatchAction('DELETE_PROMO', { id });
          }}
          onAdminPlayNow={(track) => dispatchAction('ADMIN_PLAY_NOW', { track, requestedBy: 'Station Admin' })}
          onAddAdminQueue={(track) => dispatchAction('ADD_TO_QUEUE', { track, requestedBy: 'Station Admin', priority: 'admin_high' })}
          onAddStaffQueue={(track) => dispatchAction('ADD_TO_QUEUE', { track, requestedBy: 'Station Admin', priority: 'staff_normal' })}
          onRemoveTrack={handleRemoveTrack}
          onTriggerUrgentPromo={handleTriggerUrgentPromo}
          onStopPromo={handleStopPromo}
          onLeaveStation={handleLeaveStation}
          onSwitchToStaff={handleSwitchRole}
          onOpenSpeakerModal={() => setIsSpeakerModalOpen(true)}
          onStartLiveAnnouncement={handleStartLiveAnnouncement}
          onStopLiveAnnouncement={handleStopLiveAnnouncement}
          isMoodMixActive={isMoodMixActive}
          detectedMood={detectedMood}
          onToggleMoodMix={handleToggleMoodMix}
        />

        {/* Speaker Handover Modal */}
        {/* Speaker Handover Modal */}
        <SpeakerHandoverModal
          isOpen={isSpeakerModalOpen || hasIncomingHandover}
          onClose={() => setIsSpeakerModalOpen(false)}
          isSpeakerNode={isSpeakerNode}
          activeSpeakerDeviceId={stationState.speaker?.activeDeviceId || ''}
          activeSpeakerName={stationState.speaker?.activeDeviceName || ''}
          myDeviceId={myDeviceId}
          myDeviceName={myDeviceName}
          userRole={userRole || 'admin'}
          connectedDevices={stationState.connectedDevices || []}
          onSetMyDeviceName={handleUpdateDeviceName}
          handoverRequest={stationState.handoverRequest || null}
          onRequestHandover={handleRequestSpeakerHandover}
          onRespondHandover={handleRespondSpeakerHandover}
          onClaimDirectly={handleClaimSpeakerDirectly}
          onRandomizeSpeaker={handleRandomizeSpeaker}
          onReleaseSpeaker={handleReleaseSpeaker}
          onAssignSpeakerDevice={handleAssignSpeakerDevice}
          onDismissHandoverNotice={handleDismissHandoverNotice}
        />

        {/* Speaker Role Transition Banner */}
        {speakerBanner && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] p-3.5 rounded-2xl bg-[#141416]/95 backdrop-blur-xl border border-orange-500/40 text-white shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                speakerBanner.type === 'became_speaker'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white/[0.08] text-slate-300'
              }`}
            >
              {speakerBanner.type === 'became_speaker' ? (
                <Volume2 className="w-4 h-4 animate-pulse" />
              ) : (
                <Smartphone className="w-4 h-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">{speakerBanner.title}</p>
              <p className="text-[11px] text-slate-300 mt-0.5">{speakerBanner.description}</p>
            </div>
            <button
              onClick={() => setSpeakerBanner(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.08]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // SCREEN 4: STREAMLINED STAFF FORECOURT JUKEBOX VIEW
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] flex flex-col font-sans antialiased selection:bg-[#ff9500] selection:text-black pb-28 md:pb-32">
      {/* 1. Header Navigation */}
      <HeaderNav
        stationName={stationState?.stationName || 'Maa Sumitra Devi F.S.'}
        userRole="staff"
        isSpeakerNode={isSpeakerNode}
        activeSpeakerName={stationState?.speaker?.activeDeviceName}
        connectedDevicesCount={stationState?.connectedDevices?.length || 1}
        onOpenSpeakerModal={() => setIsSpeakerModalOpen(true)}
        onLeaveStation={handleLeaveStation}
        onToggleMobilePreview={toggleMobilePreview}
      />

      {/* Speaker Role Transition Banner */}
      {speakerBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] p-3.5 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-[#ff9500]/40 text-white shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-2 rounded-xl shrink-0 ${
              speakerBanner.type === 'became_speaker'
                ? 'bg-[#ff9500] text-black shadow-md shadow-[#ff9500]/30'
                : 'bg-white/[0.08] text-neutral-300'
            }`}
          >
            {speakerBanner.type === 'became_speaker' ? (
              <Volume2 className="w-4 h-4 animate-pulse" />
            ) : (
              <Smartphone className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">{speakerBanner.title}</p>
            <p className="text-[11px] text-neutral-300 mt-0.5">{speakerBanner.description}</p>
          </div>
          <button
            onClick={() => setSpeakerBanner(null)}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.08]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Offline Alert */}
      {isOffline && (
        <div className="bg-amber-600 text-black px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline Mode &bull; Cached gaane uninterrupted chal rahe hain.</span>
        </div>
      )}

      {/* Autoplay Unlock Banner for Speaker Phone */}
      {isSpeakerNode && !isAudioContextStarted && (
        <div className="bg-gradient-to-r from-[#ff9500] to-[#ff453a] text-black px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-2">
            <Headphones className="w-4 h-4 shrink-0 text-black" />
            <span>
              Forecourt Speaker aawaz activate karne ke liye tap karein.
            </span>
          </div>
          <button
            onClick={handleStartAudio}
            className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-neutral-900 text-white font-bold text-xs uppercase tracking-wider shrink-0 transition-all shadow cursor-pointer"
          >
            Aawaz Chalu Karein
          </button>
        </div>
      )}

      {/* Main Staff Body with Apple Music Desktop Architecture */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto flex flex-col md:flex-row min-h-0">
        {/* ========================================================= */}
        {/* DESKTOP-ONLY: Apple Music Left Navigation & Control Bar */}
        {/* ========================================================= */}
        <aside className="hidden md:flex flex-col w-72 lg:w-80 shrink-0 border-r border-white/[0.08] bg-[#121214]/80 backdrop-blur-2xl p-5 space-y-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          {/* macOS Apple Music Window Controls Header */}
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-sm" />
            <span className="text-xs font-semibold text-neutral-400 pl-2 tracking-tight">Sangeet macOS</span>
          </div>

          {/* Apple Music Navigation Links */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block px-3 mb-1">
              Jukebox & Radio
            </span>

            <a
              href="#now-playing-section"
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#ff9500]/15 text-[#ff9500] font-semibold text-xs border border-[#ff9500]/25 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Disc3 className={`w-4 h-4 ${stationState?.playbackState?.isPlaying ? 'animate-spin' : ''}`} />
                <span>Suno Abhi</span>
              </div>
              {stationState?.playbackState?.isPlaying && (
                <span className="w-2 h-2 rounded-full bg-[#30d158] inline-block" />
              )}
            </a>

            <a
              href="#queue-section"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-neutral-300 hover:text-white hover:bg-white/[0.05] font-medium text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ListMusic className="w-4 h-4 text-neutral-400" />
                <span>Agle Gaane</span>
              </div>
              <span className="text-[10px] font-mono tabular-nums font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-neutral-300">
                {(stationState?.adminQueue.length || 0) + (stationState?.staffQueue.length || 0)}
              </span>
            </a>

            <a
              href="#auto-mix-section"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.04] font-medium text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-red-400" />
                <span>Sangeet Auto-Mix</span>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                Non-Stop
              </span>
            </a>

            <a
              href="#search-section"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.04] font-medium text-xs transition-colors"
            >
              <Search className="w-4 h-4 text-slate-400" />
              <span>Gaana Khojein</span>
            </a>
          </div>

          {/* Active Station Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Petrol Pump
            </span>
            <div className="flex items-center justify-between gap-2">
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{stationState?.stationName || 'Forecourt Radio'}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span>Online & Synchronized</span>
                </div>
              </div>
              <button
                onClick={handleLeaveStation}
                className="text-[10px] font-bold text-orange-400 hover:text-orange-300 hover:underline shrink-0"
              >
                Badlein
              </button>
            </div>
          </div>

          {/* Forecourt PA Speaker Hardware Controller */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Forecourt Speaker Phone
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isSpeakerNode
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                  : 'bg-white/[0.06] text-slate-400 border-white/[0.08]'
              }`}>
                {isSpeakerNode ? 'Speaker Active' : 'Remote'}
              </span>
            </div>

            <p className="text-xs font-medium text-slate-300 truncate">
              {stationState?.speaker.activeDeviceName || 'Koi Speaker Phone Active Nahi'}
            </p>

            {/* Direct Master Volume Slider on Desktop Sidebar */}
            <div className="pt-1">
              <AppleSlider
                value={audioEngine.getMasterVolume ? audioEngine.getMasterVolume() : 1}
                min={0}
                max={1}
                step={0.01}
                onChange={(val) => audioEngine.setMasterVolume(val)}
                accentColor="orange"
                size="sm"
                label="Master Volume"
                valueDisplay={`${Math.round((audioEngine.getMasterVolume ? audioEngine.getMasterVolume() : 1) * 100)}%`}
                leftIcon={<Volume2 className="w-3.5 h-3.5 text-orange-400" />}
              />
            </div>

            <button
              onClick={() => setIsSpeakerModalOpen(true)}
              className="w-full py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-orange-400" />
              <span>Speaker Handover</span>
            </button>
          </div>

          {/* Quick Actions (Admin Mode & Leave Station) */}
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <button
              onClick={() => handleSelectRole('admin')}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-2 border border-white/[0.06]"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Console (PIN)</span>
            </button>

            <button
              onClick={handleLeaveStation}
              className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 transition-colors flex items-center gap-2 border border-red-500/20"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Station Chhodein</span>
            </button>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN DESKTOP & MOBILE CONTENT CANVAS */}
        {/* ========================================================= */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 space-y-6 overflow-y-auto">
          {/* 1. APPLE MUSIC HERO NOW PLAYING STAGE */}
          <section id="now-playing-section" className="relative p-6 sm:p-8 rounded-3xl bg-[#1c1c1e] border border-white/[0.08] overflow-hidden shadow-2xl backdrop-blur-2xl">
            {/* Ambient artwork reflection backdrop glow with Click Feedback Hulchul */}
            {stationState?.currentTrack?.artworkUrl && (
              <div
                key={mixHulchulKey ? `hero-surge-${mixHulchulKey}` : 'hero-ambient'}
                aria-hidden="true"
                className={`absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
                  mixHulchulKey
                    ? 'animate-ambient-hulchul'
                    : isMoodMixActive
                    ? 'opacity-35 scale-110'
                    : 'opacity-20 scale-100'
                }`}
                style={{
                  backgroundImage: isMoodMixActive
                    ? `radial-gradient(circle, ${moodTheme.glowColor} 0%, transparent 70%)`
                    : `radial-gradient(circle, #ff9500 0%, transparent 70%)`,
                }}
              />
            )}

            <div className="relative flex flex-col md:flex-row items-center md:items-start gap-6 lg:gap-8">
              {/* AppleArtwork Component */}
              <div className="relative shrink-0 flex items-center justify-center p-2">

                <AppleArtwork
                  src={stationState?.currentTrack?.artworkUrl}
                  alt={stationState?.currentTrack?.title || 'Cover'}
                  size="xl"
                  showAmbientGlow={true}
                  isPlaying={stationState?.playbackState?.isPlaying}
                  className="shrink-0 relative z-10"
                />
              </div>

              {/* Track Details & Apple Music Playback Transport */}
              <div className="flex-1 text-center md:text-left space-y-4 min-w-0 w-full">
                {/* Meta Header */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-[#ff9500] bg-[#ff9500]/15 border border-[#ff9500]/25 px-2.5 py-0.5 rounded-full inline-block">
                    Now Playing
                  </span>

                  {isMoodMixActive && (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border bg-white/[0.06] border-white/10 text-neutral-300">
                      <span>{moodTheme.iconEmoji}</span>
                      <span>Mood Mix: {detectedMood || moodTheme.name}</span>
                    </span>
                  )}

                  {stationState?.currentTrack?.source === 'youtube' ? (
                    <span className="text-[11px] font-medium text-neutral-400">
                      &bull; Sangeet
                    </span>
                  ) : stationState?.currentTrack?.source === 'jiosaavn' ? (
                    <span className="text-[11px] font-medium text-neutral-400">
                      &bull; JioSaavn
                    </span>
                  ) : null}
                </div>

                {/* Song Title & Artist in Apple Music Display Typography */}
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight truncate leading-tight">
                    {stationState?.currentTrack?.title || 'Koi Gaana Nahi Chal Raha'}
                  </h1>
                  <p className="text-base sm:text-lg font-medium text-neutral-400 truncate">
                    {stationState?.currentTrack?.artist || 'Neeche search se gaana chunein ya Sangeet Auto-Mix sunein'}
                  </p>
                </div>

                {/* Zero-Pill Quiet Metadata */}
                {stationState?.currentTrack && (
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-neutral-400 font-normal">
                    <span>{formatTime(stationState.currentTrack.duration)}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span>{stationState.currentTrack.album || 'Single'}</span>
                    {stationState.currentTrack.requestedBy && (
                      <>
                        <span aria-hidden="true">&bull;</span>
                        <span>Added by {stationState.currentTrack.requestedBy}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Active Commercial Promo Notice */}
                {stationState?.isPromoPlaying && (
                  <div className="p-3 rounded-2xl bg-[#ff9500]/15 border border-[#ff9500]/30 text-xs text-[#ff9500] flex items-center justify-center md:justify-start gap-2.5 shadow-sm">
                    <Radio className="w-4 h-4 text-[#ff9500] animate-pulse shrink-0" />
                    <span className="font-semibold truncate">
                      Official Promo Announcement: {stationState.activePromoClip?.title}
                    </span>
                  </div>
                )}

                {/* Apple Music Sleek Desktop Player Controls */}
                <div className="pt-2 space-y-3">
                  {/* Apple Music Hero Scrubber Timeline */}
                  <div className="pt-1">
                    <AppleSlider
                      value={currentTime}
                      min={0}
                      max={duration || stationState?.currentTrack?.duration || 100}
                      step={1}
                      onChange={(val) => handleSeek(val)}
                      accentColor="orange"
                      size="md"
                      minLabel={formatTime(currentTime)}
                      maxLabel={`-${formatTime(Math.max(0, (duration || stationState?.currentTrack?.duration || 0) - currentTime))}`}
                    />
                  </div>

                  {/* Transport Buttons */}
                  <div className="flex items-center justify-center md:justify-start gap-4 sm:gap-6 pt-1">
                    {/* Previous Button */}
                    <button
                      onClick={handleSkipPrevious}
                      className="p-3 rounded-full text-neutral-300 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                      title="Pichhla Gaana / 0:00"
                    >
                      <SkipBack className="w-5 h-5 fill-current" />
                    </button>

                    {/* Apple Music Iconic Center Play/Pause Button */}
                    <button
                      onClick={handlePlayPause}
                      className="w-14 h-14 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-2xl transition-transform cursor-pointer"
                      title={stationState?.playbackState?.isPlaying ? 'Pause' : 'Play'}
                    >
                      {stationState?.playbackState?.isPlaying ? (
                        <Pause className="w-6 h-6 fill-black text-black" />
                      ) : (
                        <Play className="w-6 h-6 fill-black text-black translate-x-0.5" />
                      )}
                    </button>

                    {/* Next Button */}
                    <button
                      onClick={handleSkipNext}
                      className="p-3 rounded-full text-neutral-300 hover:text-white hover:bg-white/[0.08] active:scale-95 transition-all cursor-pointer"
                      title="Agla Gaana"
                    >
                      <SkipForward className="w-5 h-5 fill-current" />
                    </button>

                    {/* Dedicated Forecourt MIX Toggle Pill Button */}
                    <button
                      onClick={handleToggleMoodMix}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer border ${
                        mixHulchulKey ? 'animate-mix-bump' : ''
                      } ${
                        isMoodMixActive
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/25 border-amber-300/40'
                          : 'bg-white/[0.08] hover:bg-white/[0.14] text-neutral-300 hover:text-white border-white/20'
                      }`}
                      title={
                        isMoodMixActive
                          ? `Mood Mix Active: ${detectedMood || moodTheme.name}. Click karke 90s Hits wapas karein.`
                          : 'Mood Mix OFF: Current song mood match karein'
                      }
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isMoodMixActive ? 'text-yellow-200' : 'text-neutral-400'}`} />
                      <span>{isMoodMixActive ? 'MIX: ON' : '📻 90s HITS (MIX: OFF)'}</span>
                      {isMoodMixActive && (
                        <span className="hidden xl:inline text-[10px] font-semibold bg-black/40 px-2 py-0.5 rounded-full border border-white/20 text-white flex items-center gap-1 max-w-[150px] truncate">
                          <span>{moodTheme.iconEmoji}</span>
                          <span className="truncate">{detectedMood || moodTheme.name}</span>
                        </span>
                      )}
                    </button>

                    {/* Quick Instant Promo Broadcast Button */}
                    <button
                      onClick={handleTriggerUrgentPromo}
                      className="ml-auto hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-[#ff9500] border border-[#ff9500]/25 active:scale-95 transition-all cursor-pointer"
                      title="Forecourt Announcement abhi bajayein"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Instant Promo</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. DUAL-COLUMN DESKTOP WORKSPACE (Search & YT Auto-Mix on Left, Agle Gaane Queue on Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ======================================================= */}
            {/* LEFT COLUMN (7 Cols on desktop): Search & YouTube Music Auto-Mix */}
            {/* ======================================================= */}
            <div className="lg:col-span-7 space-y-6">
              {/* TRACK SEARCH SECTION (With Dedicated Search Button & Enter Key Only) */}
              <section id="search-section" className="p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-4 shadow-xl backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Search className="w-4 h-4 text-orange-400" />
                    <span>Gaana Khojein Aur Jodein</span>
                  </h2>

                  {/* Music Catalog Source Switcher */}
                  <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-white/[0.08] self-start sm:self-auto">
                    {(
                      [
                        { id: 'all', label: 'Sabhi' },
                        { id: 'youtube', label: 'Sangeet' },
                        { id: 'saavn', label: 'JioSaavn' },
                      ] as const
                    ).map((src) => (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => {
                          setDashSourceFilter(src.id);
                          if (dashSearchQuery) {
                            handleExecuteDashSearch(dashSearchQuery, src.id);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          dashSourceFilter === src.id
                            ? src.id === 'youtube'
                              ? 'bg-red-600 text-white shadow-sm'
                              : src.id === 'saavn'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-orange-500 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {src.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search Bar with Dedicated Search Button (Executes ONLY on Click or Enter) */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={dashSearchQuery}
                      onChange={(e) => setDashSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleExecuteDashSearch();
                        }
                      }}
                      placeholder="Gaana Khojein: Hindi, Punjabi, Bhojpuri, Pop, Arijit, Pawan Singh..."
                      className="w-full bg-black border border-white/[0.12] focus:border-orange-500 rounded-2xl pl-11 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                    />
                    {dashSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setDashSearchQuery('');
                          setDashSearchResults([]);
                        }}
                        className="absolute right-3 top-3 p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.08]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Dedicated Search Button (Requested by User) */}
                  <button
                    type="button"
                    onClick={() => handleExecuteDashSearch()}
                    disabled={!dashSearchQuery.trim() || isSearchingDash}
                    className="px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-orange-500/20 shrink-0 cursor-pointer"
                    title="Gaane khojein"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </button>
                </div>

                {/* 1-Tap Genre Trend Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                  {TREND_GENRES.map((g) => (
                    <button
                      key={g.label}
                      type="button"
                      onClick={() => handleExecuteDashSearch(g.query, dashSourceFilter)}
                      className="px-2.5 py-1 rounded-full bg-white/[0.04] hover:bg-orange-500/20 text-slate-300 hover:text-orange-300 border border-white/[0.08] hover:border-orange-500/30 text-[11px] font-semibold whitespace-nowrap active:scale-95 transition-all cursor-pointer"
                    >
                      {g.label}
                    </button>
                  ))}
                </div>

                {isSearchingDash && (
                  <p className="text-xs text-slate-400 text-center py-2 animate-pulse">
                    Gaane khoje ja rahe hain...
                  </p>
                )}

                {/* Search Results List */}
                {dashSearchResults.length > 0 && (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1 pt-1 border-t border-white/[0.06]">
                    {dashSearchResults.map((track) => (
                      <div
                        key={track.id}
                        className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-between gap-3 hover:border-white/[0.12] transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                          <AppleArtwork
                            src={track.artworkUrl}
                            alt={track.title}
                            size="sm"
                            className="shrink-0"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                              {(track.isOfficial || track.source === 'jiosaavn' || track.source === 'youtube') && (
                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 shrink-0" title="Sourced from official music channel / label">
                                  ✓ Official
                                </span>
                              )}
                              {track.source === 'youtube' ? (
                                <span className="text-[10px] text-neutral-400">
                                  &bull; Sangeet
                                </span>
                              ) : track.source === 'jiosaavn' ? (
                                <span className="text-[10px] text-neutral-400">
                                  &bull; JioSaavn
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-neutral-400 truncate mt-0.5">{track.artist}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* 1-Tap Play Now Button */}
                          <button
                            onClick={() => handlePlayTrackNow(track)}
                            className="px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-[#ff9500] text-neutral-200 hover:text-black text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-sm cursor-pointer"
                            title="Is gaane ko abhi turant bajayein"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span className="hidden sm:inline">Abhi</span>
                          </button>

                          {/* Add to Queue Button */}
                          <button
                            onClick={() => {
                              handleAddTrack(track);
                              setAddedTrackId(track.id);
                              setTimeout(() => setAddedTrackId(null), 1500);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                              addedTrackId === track.id
                                ? 'bg-[#30d158] text-black shadow-md shadow-[#30d158]/20'
                                : 'bg-[#ff9500] hover:bg-[#ff9500]/90 text-black shadow-md shadow-[#ff9500]/20'
                            }`}
                          >
                            {addedTrackId === track.id ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Jud Gaya</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Jodein</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* YOUTUBE MUSIC AUTO-MIX (NON-STOP CONTINUOUS RADIO) */}
              <section id="auto-mix-section" className="p-5 sm:p-6 rounded-3xl bg-[#1c1c1e] border border-white/[0.08] space-y-4 shadow-xl backdrop-blur-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                      </div>
                      <h2 className="text-sm font-semibold text-white">Sangeet Auto-Mix</h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isMoodMixActive ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {isMoodMixActive ? `✨ Mood: ${detectedMood || 'Active'}` : '📻 90s Hits Default'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">
                      {isMoodMixActive
                        ? 'Current track ke genre aur mood ke matching gaane autoplay mix me queue ho rahe hain.'
                        : 'Default 90s evergreen Bollywood hits queue me hain. MIX button se current track mood on karein.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      onClick={handleToggleMoodMix}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                        mixHulchulKey ? 'animate-mix-bump' : ''
                      } ${
                        isMoodMixActive
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/25 border-amber-300/40'
                          : 'bg-white/[0.08] hover:bg-white/[0.14] text-neutral-300 hover:text-white border-white/20'
                      }`}
                      title={isMoodMixActive ? 'Mood Mix ON: 90s Hits wapas karein' : 'Mood Mix OFF: Current song mood match karein'}
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isMoodMixActive ? 'text-yellow-200' : 'text-neutral-400'}`} />
                      <span>{isMoodMixActive ? 'MIX: ON' : '📻 90s HITS (MIX: OFF)'}</span>
                    </button>

                    <button
                      onClick={handleRefreshAutoMix}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Auto-Mix Tracks List */}
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {stationState?.recommendations && stationState.recommendations.length > 0 ? (
                    stationState.recommendations.map((track) => (
                      <div
                        key={track.id}
                        className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-3 hover:border-white/[0.14] transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                          <AppleArtwork
                            src={track.artworkUrl}
                            alt={track.title}
                            size="sm"
                            className="shrink-0"
                          />
                          <div className="truncate">
                            <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
                              <span className="truncate">{track.artist}</span>
                              <span aria-hidden="true">&bull;</span>
                              <span className="font-mono tabular-nums">{formatTime(track.duration)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Play Now */}
                          <button
                            onClick={() => handlePlayTrackNow(track)}
                            className="px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-[#ff9500] text-neutral-200 hover:text-black text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            title="Abhi bajayein"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play</span>
                          </button>

                          {/* Add to Staff Queue */}
                          <button
                            onClick={() => {
                              handleAddTrack(track);
                              setAddedTrackId(track.id);
                              setTimeout(() => setAddedTrackId(null), 1500);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                            title="Queue me aage karein"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Queue</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-2xl bg-black/30 border border-white/[0.06] text-center text-xs text-neutral-400">
                      Sangeet Auto-Mix load ho raha hai...
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ======================================================= */}
            {/* RIGHT COLUMN (5 Cols on desktop): Agle Gaane Queue */}
            {/* ======================================================= */}
            <div id="queue-section" className="lg:col-span-5 space-y-4">
              <section className="p-5 sm:p-6 rounded-3xl bg-[#1c1c1e] border border-white/[0.08] space-y-4 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-[#ff9500]" />
                    <h2 className="text-sm font-semibold text-white">Agle Gaane (Up Next)</h2>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono tabular-nums text-neutral-400 font-medium">
                      {(stationState?.adminQueue.length || 0) + (stationState?.staffQueue.length || 0)} Gaane
                    </span>

                    {/* Clear All Queue Button */}
                    {stationState?.staffQueue && stationState.staffQueue.length > 0 && (
                      <button
                        onClick={() => handleClearQueue('staff')}
                        className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-[11px] font-semibold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm cursor-pointer"
                        title="Poori Staff Queue Khaali Karein"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Queue Track List with Drag & Drop and Mobile Arrows */}
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {(stationState?.adminQueue.length || 0) + (stationState?.staffQueue.length || 0) > 0 ? (
                    <>
                      {/* Admin VIP Priority Queue */}
                      {stationState?.adminQueue.map((track, idx) => (
                        <div
                          key={track.id}
                          className="p-3 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/20 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                            <span className="text-xs font-mono tabular-nums text-[#ff9500] w-4">{idx + 1}</span>
                            <AppleArtwork
                              src={track.artworkUrl}
                              alt={track.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                              <p className="text-[11px] text-neutral-400 truncate mt-0.5">{track.artist}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ff9500]/20 text-[#ff9500] border border-[#ff9500]/30 shrink-0">
                            VIP
                          </span>
                        </div>
                      ))}

                      {/* Staff Queue with Drag & Drop and Up/Down Arrows */}
                      {stationState?.staffQueue.map((track, idx) => (
                        <div
                          key={track.id}
                          draggable
                          onDragStart={() => {
                            staffDragItemRef.current = idx;
                          }}
                          onDragEnter={() => {
                            staffDragOverItemRef.current = idx;
                          }}
                          onDragEnd={() => {
                            if (
                              staffDragItemRef.current !== null &&
                              staffDragOverItemRef.current !== null &&
                              staffDragItemRef.current !== staffDragOverItemRef.current &&
                              stationState
                            ) {
                              const newQueue = [...stationState.staffQueue];
                              const [dragged] = newQueue.splice(staffDragItemRef.current, 1);
                              newQueue.splice(staffDragOverItemRef.current, 0, dragged);
                              handleReorderQueue(newQueue, 'staff');
                            }
                            staffDragItemRef.current = null;
                            staffDragOverItemRef.current = null;
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-3 hover:border-white/[0.15] transition-all cursor-move active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden min-w-0 flex-1">
                            <GripVertical className="w-4 h-4 text-neutral-500 shrink-0 cursor-grab active:cursor-grabbing" />
                            <span className="text-xs font-mono tabular-nums text-neutral-500 w-4">
                              {(stationState?.adminQueue.length || 0) + idx + 1}
                            </span>
                            <AppleArtwork
                              src={track.artworkUrl}
                              alt={track.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-semibold text-white truncate">{track.title}</p>
                              <p className="text-[11px] text-neutral-400 truncate mt-0.5">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Reorder Up */}
                            <button
                              onClick={() => {
                                if (idx > 0 && stationState) {
                                  const newQ = [...stationState.staffQueue];
                                  const [moved] = newQ.splice(idx, 1);
                                  newQ.splice(idx - 1, 0, moved);
                                  handleReorderQueue(newQ, 'staff');
                                }
                              }}
                              disabled={idx === 0}
                              className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/[0.06]"
                              title="Upar Karein"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Reorder Down */}
                            <button
                              onClick={() => {
                                if (idx < (stationState?.staffQueue.length || 0) - 1 && stationState) {
                                  const newQ = [...stationState.staffQueue];
                                  const [moved] = newQ.splice(idx, 1);
                                  newQ.splice(idx + 1, 0, moved);
                                  handleReorderQueue(newQ, 'staff');
                                }
                              }}
                              disabled={idx === (stationState?.staffQueue.length || 0) - 1}
                              className="p-1.5 text-neutral-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/[0.06]"
                              title="Neeche Karein"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove */}
                            <button
                              onClick={() => handleRemoveTrack(track.id, 'staff')}
                              className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"
                              title="Hataayein"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-2">
                      <p className="text-xs text-white font-semibold">
                        Agle gaane ki queue khaali hai.
                      </p>
                      <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                        Search bar se gaana jodein ya automatic non-stop Sangeet Auto-Mix chalne dein.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>

      {/* 2. Apple Music / YT Music Style Expanding Player */}
      <ExpandedPlayer
        currentTrack={stationState?.currentTrack || null}
        isPlaying={stationState?.playbackState?.isPlaying || false}
        currentTime={currentTime}
        duration={duration}
        isPromoPlaying={stationState?.isPromoPlaying || false}
        activePromoClip={stationState?.activePromoClip || null}
        adminQueue={stationState?.adminQueue || []}
        staffQueue={stationState?.staffQueue || []}
        recommendations={stationState?.recommendations || []}
        playedHistory={stationState?.playedHistory || []}
        settings={stationState?.settings || {
          promoIntervalType: 'songs_count',
          promoSongInterval: 2,
          promoTimeIntervalMinutes: 10,
          promoRepetitions: 2,
          activeCategoryFilter: 'all',
          duckingVolumePercent: 18,
          crossfadeSeconds: 2,
          promosEnabled: true,
        }}
        isSpeakerNode={isSpeakerNode}
        onPlayPause={handlePlayPause}
        onSkipNext={handleSkipNext}
        onSkipPrevious={handleSkipPrevious}
        onSeek={handleSeek}
        onVolumeChange={(vol) => audioEngine.setMasterVolume(vol)}
        onAddTrackToQueue={handleAddTrack}
        onRemoveTrackFromQueue={handleRemoveTrack}
        onReorderStaffQueue={(newQueue) => handleReorderQueue(newQueue, 'staff')}
        onClearQueue={handleClearQueue}
        onPlayTrackNow={handlePlayTrackNow}
        onTriggerInstantPromo={handleTriggerUrgentPromo}
        onStopPromo={handleStopPromo}
        userRole={userRole}
        isMoodMixActive={isMoodMixActive}
        detectedMood={detectedMood}
        onToggleMoodMix={handleToggleMoodMix}
        onUpdateSettings={(settings) => dispatchAction('UPDATE_SETTINGS', { settings })}
      />

      {/* 3. Speaker Handover Modal */}
      <SpeakerHandoverModal
        isOpen={isSpeakerModalOpen || hasIncomingHandover}
        onClose={() => setIsSpeakerModalOpen(false)}
        isSpeakerNode={isSpeakerNode}
        activeSpeakerDeviceId={stationState?.speaker?.activeDeviceId || ''}
        activeSpeakerName={stationState?.speaker?.activeDeviceName || ''}
        myDeviceId={myDeviceId}
        myDeviceName={myDeviceName}
        userRole={userRole || 'staff'}
        connectedDevices={stationState?.connectedDevices || []}
        onSetMyDeviceName={handleUpdateDeviceName}
        handoverRequest={stationState?.handoverRequest || null}
        onRequestHandover={handleRequestSpeakerHandover}
        onRespondHandover={handleRespondSpeakerHandover}
        onClaimDirectly={handleClaimSpeakerDirectly}
        onRandomizeSpeaker={handleRandomizeSpeaker}
        onReleaseSpeaker={handleReleaseSpeaker}
        onAssignSpeakerDevice={handleAssignSpeakerDevice}
        onDismissHandoverNotice={handleDismissHandoverNotice}
      />
    </div>
  );
}
