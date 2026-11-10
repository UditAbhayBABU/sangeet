import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import ytSearch from 'yt-search';
import CryptoJS from 'crypto-js';
import { GoogleGenAI } from '@google/genai';
import {
  loadDatabase,
  saveDatabase,
  saveAudioFromDataUrl,
  streamAudioFile,
  getCloudStorageStatus,
  DEFAULT_CATEGORIES,
  DEFAULT_PROMOS,
  DEFAULT_STATIONS,
  DEFAULT_SETTINGS,
} from './serverDatabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Initialize Gemini Client for Search-Grounded Music Discovery
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-Memory Cache and Cooldown for AI Music Discovery to protect API Quota
const aiDiscoverCache = new Map<string, { timestamp: number; payload: any }>();
let geminiQuotaCooldownUntil = 0;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------------------------------------------------
// In-Memory State for Sangeet Forecourt Radio
// -------------------------------------------------------------

export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  audioUrl: string;
  artworkUrl?: string;
  source: 'online' | 'local_upload' | 'youtube' | 'jiosaavn';
  youtubeVideoId?: string;
  directAudioUrl?: string;
  isBackgroundOptimized?: boolean;
  requestedBy: string;
  addedAt: number;
  priority: 'admin_instant' | 'admin_high' | 'staff_normal' | 'auto_recommend';
  isOfficial?: boolean;
}

export interface PromoCategory {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface PromoClip {
  id: string;
  title: string;
  categoryId: string;
  audioUrl: string;
  duration: number;
  enabled: boolean;
  playsCount: number;
  lastPlayedAt?: number;
  scriptSnippet?: string;
  isCloudSaved?: boolean;
  fileSizeBytes?: number;
  uploadedAt?: number;
  storageType?: 'cloud' | 'preset' | 'custom';
  fileName?: string;
}

export interface StationItem {
  id: string;
  name: string;
  location?: string;
  promosEnabled: boolean;
  pinRequired?: boolean;
  stationPin?: string;
  adminPassword?: string;
  allowedSources?: 'all' | 'youtube' | 'saavn';
  promoIntervalType: 'songs_count' | 'time_interval';
  promoSongInterval: number;
  promoTimeIntervalMinutes: number;
  activeCategoryFilter: string;
  duckingMode?: 'db' | 'percent';
  duckingDb?: number;
  duckingVolumePercent: number;
  fadeDurationSeconds?: number;
  selectedPromoClipIds?: string[];
  crossfadeSeconds?: number;
  loopMode?: 'none' | 'all' | 'one';
  isShuffleEnabled?: boolean;
}

export interface StationState {
  stationId: string;
  stationName: string;
  adminPin: string;
  stations: StationItem[];
  currentTrack: SongTrack | null;
  playbackState: {
    isPlaying: boolean;
    currentTime: number;
    updatedAt: number;
  };
  adminQueue: SongTrack[];
  staffQueue: SongTrack[];
  recommendations: SongTrack[];
  playedHistory: SongTrack[];
  songsPlayedSinceLastPromo: number;
  lastPromoPlayedAt: number;
  isPromoPlaying: boolean;
  activePromoClip: PromoClip | null;
  categories: PromoCategory[];
  promos: PromoClip[];
  settings: {
    promoIntervalType: 'songs_count' | 'time_interval';
    promoSongInterval: number;
    promoTimeIntervalMinutes: number;
    activeCategoryFilter: string;
    duckingMode?: 'db' | 'percent';
    duckingDb?: number;
    duckingVolumePercent: number;
    fadeDurationSeconds?: number;
    crossfadeSeconds: number;
    promosEnabled: boolean;
    allowedSources?: 'all' | 'youtube' | 'saavn';
    pinRequired?: boolean;
    autoMixEnabled?: boolean;
    moodMixEnabled?: boolean;
    detectedMood?: string;
    selectedPromoClipIds?: string[];
    masterVolume?: number;
    loopMode?: 'none' | 'all' | 'one';
    isShuffleEnabled?: boolean;
  };
  speaker: {
    activeDeviceId: string;
    activeDeviceName: string;
    lastHeartbeat: number;
  };
  connectedDevices?: ConnectedDevice[];
  handoverRequest?: {
    id: string;
    requesterDeviceId: string;
    requesterDeviceName: string;
    requestedAt: number;
    status: 'pending' | 'approved' | 'rejected' | 'admin_takeover';
    targetPreviousSpeakerId?: string;
  } | null;
  isLiveMicActive: boolean;
  liveMicAdminName: string | null;
  liveMicManualMusicVolume?: number | null;
  liveMicMode?: 'auto' | 'manual';
  broadcastMessage?: string | null;
  broadcastTimestamp?: number | null;
  promoTriggerSource?: 'songs_count' | 'time_interval' | 'manual' | null;
  likedTracks?: SongTrack[];
}

export interface ConnectedDevice {
  deviceId: string;
  deviceName: string;
  stationId: string;
  role: 'staff' | 'admin';
  isSpeaker: boolean;
  joinedAt: number;
  lastSeen: number;
}

// Initialize Station State from Persistent Cloud Database on Disk
const initialDatabase = loadDatabase();

// In-Memory map of stationId -> Liked SongTrack[] from Cloud Database
const allStationsLikedTracks = new Map<string, SongTrack[]>();
if (initialDatabase.likedTracks && typeof initialDatabase.likedTracks === 'object') {
  for (const [sId, list] of Object.entries(initialDatabase.likedTracks)) {
    if (Array.isArray(list)) {
      allStationsLikedTracks.set(sId, list as SongTrack[]);
    }
  }
}
const defaultStationId = initialDatabase.stations[0]?.id || 'station-msd';

// Global active station state
let stationState: StationState = {
  stationId: defaultStationId,
  stationName: initialDatabase.stations[0]?.name || 'Maa Sumitra Devi F.S.',
  adminPin: initialDatabase.adminPin || '2006',
  stations: initialDatabase.stations,
  currentTrack: null,
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    updatedAt: Date.now(),
  },
  adminQueue: [],
  staffQueue: [],
  recommendations: [],
  playedHistory: [],
  songsPlayedSinceLastPromo: 0,
  lastPromoPlayedAt: Date.now(),
  isPromoPlaying: false,
  activePromoClip: null,
  categories: initialDatabase.categories,
  promos: initialDatabase.promos,
  settings: initialDatabase.settings,
  speaker: {
    activeDeviceId: '',
    activeDeviceName: '',
    lastHeartbeat: Date.now(),
  },
  connectedDevices: [],
  isLiveMicActive: false,
  liveMicAdminName: null,
  liveMicManualMusicVolume: null,
  liveMicMode: 'auto',
  broadcastMessage: null,
  broadcastTimestamp: null,
  promoTriggerSource: null,
  likedTracks: allStationsLikedTracks.get(defaultStationId) || [],
};

// Sync Station State to Persistent Cloud Database
export function syncStationStateToCloudDatabase() {
  const likedObj: Record<string, SongTrack[]> = {};
  for (const [stId, list] of allStationsLikedTracks.entries()) {
    likedObj[stId] = list;
  }
  saveDatabase({
    version: 1,
    lastSaved: Date.now(),
    adminPin: stationState.adminPin,
    stations: stationState.stations,
    categories: stationState.categories,
    promos: stationState.promos,
    settings: stationState.settings,
    likedTracks: likedObj,
  });
}

// -------------------------------------------------------------
// In-Memory Connected Devices & Station Speaker System
// -------------------------------------------------------------
const stationConnectedDevices = new Map<string, ConnectedDevice>();

// Retrieve currently active devices for a station (seen in last 25 seconds)
export function getStationDevices(stationId: string): ConnectedDevice[] {
  const now = Date.now();
  const list: ConnectedDevice[] = [];
  for (const dev of stationConnectedDevices.values()) {
    if (dev.stationId === stationId && now - dev.lastSeen < 25000) {
      list.push(dev);
    }
  }
  return list;
}

// Elect Speaker for station:
// Rule 1: The first device to join automatically becomes the speaker.
// Rule 2: Subsequent devices join in Remote mode.
// Rule 3: Only 1 Speaker per station at any time.
// Rule 4: If the speaker leaves/disconnects, randomly elect another connected device!
export function electSpeakerForStation(stationId: string, preferredDeviceId?: string): string {
  const aliveDevices = getStationDevices(stationId);
  const now = Date.now();

  // If preferred device is explicitly requested (e.g. approved handover or claim)
  if (preferredDeviceId) {
    const pref = aliveDevices.find((d) => d.deviceId === preferredDeviceId) || stationConnectedDevices.get(preferredDeviceId);
    if (pref) {
      stationState.speaker.activeDeviceId = pref.deviceId;
      stationState.speaker.activeDeviceName = pref.deviceName;
      stationState.speaker.lastHeartbeat = now;
      stationState.handoverRequest = null;
      for (const dev of aliveDevices) {
        dev.isSpeaker = dev.deviceId === pref.deviceId;
      }
      return pref.deviceId;
    }
  }

  // Check if current speaker is still connected and alive (seen in last 30 seconds)
  const currentSpeakerDev = stationState.speaker.activeDeviceId
    ? stationConnectedDevices.get(stationState.speaker.activeDeviceId)
    : null;
  const isCurrentSpeakerAlive = currentSpeakerDev && (now - currentSpeakerDev.lastSeen < 30000);

  // If current speaker is alive and valid, keep it as the single speaker!
  if (isCurrentSpeakerAlive && currentSpeakerDev) {
    for (const dev of aliveDevices) {
      dev.isSpeaker = dev.deviceId === currentSpeakerDev.deviceId;
    }
    stationState.speaker.activeDeviceName = currentSpeakerDev.deviceName;
    return currentSpeakerDev.deviceId;
  }

  // If no devices connected, reset speaker state
  if (aliveDevices.length === 0) {
    stationState.speaker.activeDeviceId = '';
    stationState.speaker.activeDeviceName = '';
    stationState.speaker.lastHeartbeat = now;
    stationState.handoverRequest = null;
    return '';
  }

  // If only 1 device is connected to the station and no alive speaker exists, it becomes speaker
  if (aliveDevices.length === 1) {
    const onlyDev = aliveDevices[0];
    stationState.speaker.activeDeviceId = onlyDev.deviceId;
    stationState.speaker.activeDeviceName = onlyDev.deviceName;
    stationState.speaker.lastHeartbeat = now;
    stationState.handoverRequest = null;
    onlyDev.isSpeaker = true;
    return onlyDev.deviceId;
  }

  // Otherwise: Speaker left or is dead! Randomly elect from remaining alive devices!
  const randomIndex = Math.floor(Math.random() * aliveDevices.length);
  const chosenSpeaker = aliveDevices[randomIndex];

  stationState.speaker.activeDeviceId = chosenSpeaker.deviceId;
  stationState.speaker.activeDeviceName = chosenSpeaker.deviceName;
  stationState.speaker.lastHeartbeat = now;
  stationState.handoverRequest = null;

  for (const dev of aliveDevices) {
    dev.isSpeaker = dev.deviceId === chosenSpeaker.deviceId;
  }

  console.log(`[Speaker System] Station ${stationId}: Randomly elected new Speaker -> ${chosenSpeaker.deviceName} (${chosenSpeaker.deviceId})`);
  return chosenSpeaker.deviceId;
}

// Touch or register a device on a station
export function touchOrRegisterDevice(
  stationId: string,
  deviceId: string,
  deviceName: string,
  role: 'staff' | 'admin' = 'staff'
): ConnectedDevice {
  const now = Date.now();
  let dev = stationConnectedDevices.get(deviceId);

  if (!dev) {
    dev = {
      deviceId,
      deviceName: deviceName || (role === 'admin' ? 'Admin Phone' : 'Staff Phone'),
      stationId,
      role,
      isSpeaker: false,
      joinedAt: now,
      lastSeen: now,
    };
    stationConnectedDevices.set(deviceId, dev);

    // Rule: First device to join station becomes speaker automatically!
    const currentSpeaker = stationState.speaker.activeDeviceId
      ? stationConnectedDevices.get(stationState.speaker.activeDeviceId)
      : null;
    const hasLiveSpeaker = Boolean(
      currentSpeaker &&
      currentSpeaker.deviceId !== deviceId &&
      now - currentSpeaker.lastSeen < 30000
    );

    if (!hasLiveSpeaker || !stationState.speaker.activeDeviceId) {
      stationState.speaker.activeDeviceId = deviceId;
      stationState.speaker.activeDeviceName = dev.deviceName;
      stationState.speaker.lastHeartbeat = now;
      dev.isSpeaker = true;
      console.log(`[Speaker System] First device joined station ${stationId} -> automatically Speaker: ${dev.deviceName} (${deviceId})`);
    } else {
      dev.isSpeaker = false;
      console.log(`[Speaker System] Subsequent device joined station ${stationId} -> Remote mode: ${dev.deviceName} (${deviceId})`);
    }
  } else {
    // Existing device heartbeat
    dev.lastSeen = now;
    if (deviceName) dev.deviceName = deviceName;
    if (role) dev.role = role;
    if (dev.stationId !== stationId) {
      const oldStation = dev.stationId;
      dev.stationId = stationId;
      if (stationState.stationId === oldStation && stationState.speaker.activeDeviceId === deviceId) {
        electSpeakerForStation(oldStation);
      }
      const currentSpeaker = stationState.speaker.activeDeviceId
        ? stationConnectedDevices.get(stationState.speaker.activeDeviceId)
        : null;
      const hasLiveSpeaker = Boolean(
        currentSpeaker &&
        currentSpeaker.deviceId !== deviceId &&
        now - currentSpeaker.lastSeen < 30000
      );
      if (!hasLiveSpeaker || !stationState.speaker.activeDeviceId) {
        stationState.speaker.activeDeviceId = deviceId;
        stationState.speaker.activeDeviceName = dev.deviceName;
        stationState.speaker.lastHeartbeat = now;
        dev.isSpeaker = true;
      } else {
        dev.isSpeaker = false;
      }
    }
    dev.isSpeaker = dev.deviceId === stationState.speaker.activeDeviceId;
  }

  if (stationState.speaker.activeDeviceId === deviceId) {
    stationState.speaker.lastHeartbeat = now;
  }

  return dev;
}

// Remove device when leaving station or closing tab
export function removeDeviceFromStation(deviceId: string, stationId: string) {
  if (!deviceId) return;
  const wasSpeaker = stationState.speaker.activeDeviceId === deviceId;
  stationConnectedDevices.delete(deviceId);

  if (wasSpeaker) {
    console.log(`[Speaker System] Speaker device (${deviceId}) left station ${stationId}. Randomly assigning new speaker...`);
    electSpeakerForStation(stationId);
  }
}

// Background Watchdog: every 3s cleans up stale devices (e.g. closed tabs/network loss > 30s)
setInterval(() => {
  const now = Date.now();
  let speakerDied = false;
  const currentStationId = stationState.stationId || 'station-msd';

  for (const [id, dev] of stationConnectedDevices.entries()) {
    if (now - dev.lastSeen > 30000) {
      if (dev.deviceId === stationState.speaker.activeDeviceId) {
        speakerDied = true;
      }
      stationConnectedDevices.delete(id);
    }
  }

  if (speakerDied) {
    console.log(`[Speaker Watchdog] Active speaker lost connection for >30s. Electing new speaker...`);
    electSpeakerForStation(currentStationId);
  }
}, 3000);

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Get Current Station State & Touch Device
app.get('/api/station/:stationId', (req, res) => {
  const stationId = req.params.stationId;
  const { deviceId, deviceName, role } = req.query as {
    deviceId?: string;
    deviceName?: string;
    role?: 'staff' | 'admin';
  };

  if (deviceId) {
    touchOrRegisterDevice(stationId, deviceId, deviceName || '', role || 'staff');
  }

  const connectedList = getStationDevices(stationId);
  const stationLiked = allStationsLikedTracks.get(stationId) || stationState.likedTracks || [];
  res.json({
    success: true,
    data: {
      ...stationState,
      likedTracks: stationLiked,
      connectedDevices: connectedList,
    },
  });
});

// Explicit Heartbeat Endpoint
app.post('/api/station/:stationId/heartbeat', (req, res) => {
  const stationId = req.params.stationId;
  const { deviceId, deviceName, role } = req.body;

  if (deviceId) {
    touchOrRegisterDevice(stationId, deviceId, deviceName || '', role || 'staff');
  }

  const connectedList = getStationDevices(stationId);
  res.json({
    success: true,
    data: {
      ...stationState,
      connectedDevices: connectedList,
    },
  });
});

// Leave Station Endpoint
app.post('/api/station/:stationId/leave', (req, res) => {
  const stationId = req.params.stationId;
  const { deviceId } = req.body;

  if (deviceId) {
    removeDeviceFromStation(deviceId, stationId);
  }

  const connectedList = getStationDevices(stationId);
  res.json({
    success: true,
    data: {
      ...stationState,
      connectedDevices: connectedList,
    },
  });
});

// 2. Perform Station Actions
app.post('/api/station/:stationId/action', async (req, res) => {
  const { action, payload } = req.body;

  switch (action) {
    case 'UPDATE_PLAYBACK': {
      if (payload.isPlaying !== undefined) stationState.playbackState.isPlaying = payload.isPlaying;
      if (payload.currentTime !== undefined) stationState.playbackState.currentTime = payload.currentTime;
      stationState.playbackState.updatedAt = Date.now();
      break;
    }

    case 'ADD_TO_QUEUE': {
      if (payload.deviceId) {
        touchOrRegisterDevice(req.params.stationId, payload.deviceId, payload.deviceName, 'staff');
        if (!stationState.speaker.activeDeviceId) {
          electSpeakerForStation(req.params.stationId, payload.deviceId);
        }
      }

      const originalId = payload.track.id || '';
      const track: SongTrack = {
        ...payload.track,
        id: `q-${originalId || 'track'}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        youtubeVideoId: payload.track.youtubeVideoId || (originalId.startsWith('yt-') ? originalId.replace('yt-', '') : undefined),
        requestedBy: payload.requestedBy || 'Staff',
        addedAt: Date.now(),
        priority: payload.priority || 'staff_normal',
      };

      if (payload.priority === 'admin_high') {
        stationState.adminQueue.push(track);
      } else {
        stationState.staffQueue.push(track);
      }

      // If nothing is playing currently, start playing this track!
      if (!stationState.currentTrack) {
        if (stationState.adminQueue.length > 0) {
          stationState.currentTrack = stationState.adminQueue.shift()!;
        } else {
          stationState.currentTrack = stationState.staffQueue.shift()!;
        }
        stationState.playbackState.isPlaying = true;
        stationState.playbackState.currentTime = 0;
        if (stationState.currentTrack) {
          refreshAutoPlayMix(stationState.currentTrack);
        }
      }
      break;
    }

    case 'ADMIN_PLAY_NOW': {
      if (payload.deviceId) {
        touchOrRegisterDevice(req.params.stationId, payload.deviceId, payload.deviceName, 'admin');
        if (!stationState.speaker.activeDeviceId) {
          electSpeakerForStation(req.params.stationId, payload.deviceId);
        }
      }

      // Urgent Admin Instant Override:
      const track: SongTrack = {
        ...payload.track,
        id: `track-admin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        requestedBy: 'Admin',
        addedAt: Date.now(),
        priority: 'admin_instant',
      };

      if (stationState.currentTrack) {
        stationState.playedHistory.unshift(stationState.currentTrack);
        if (stationState.playedHistory.length > 50) stationState.playedHistory.pop();
        stationState.staffQueue.unshift(stationState.currentTrack);
      }
      stationState.currentTrack = track;
      stationState.playbackState = {
        isPlaying: true,
        currentTime: 0,
        updatedAt: Date.now(),
      };
      refreshAutoPlayMix(track);
      break;
    }

    case 'PLAY_NEXT': {
      const originalId = payload.track.id || '';
      const track: SongTrack = {
        ...payload.track,
        id: `q-${originalId || 'track'}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        youtubeVideoId: payload.track.youtubeVideoId || (originalId.startsWith('yt-') ? originalId.replace('yt-', '') : undefined),
        requestedBy: payload.requestedBy || (payload.priority === 'admin_high' ? 'Admin' : 'Staff'),
        addedAt: Date.now(),
        priority: payload.priority || 'staff_normal',
      };

      if (payload.priority === 'admin_high' || payload.priority === 'admin_instant') {
        stationState.adminQueue.unshift(track);
      } else {
        // Staff / Remote "Play Next" inserts at top of staffQueue
        stationState.staffQueue.unshift(track);
      }

      // If nothing is playing currently, start playing this track!
      if (!stationState.currentTrack) {
        if (stationState.adminQueue.length > 0) {
          stationState.currentTrack = stationState.adminQueue.shift()!;
        } else {
          stationState.currentTrack = stationState.staffQueue.shift()!;
        }
        stationState.playbackState.isPlaying = true;
        stationState.playbackState.currentTime = 0;
        if (stationState.currentTrack) {
          refreshAutoPlayMix(stationState.currentTrack);
        }
      }
      break;
    }

    case 'PLAY_NOW': {
      if (payload.deviceId) {
        touchOrRegisterDevice(req.params.stationId, payload.deviceId, payload.deviceName, payload.role || 'staff');
        if (!stationState.speaker.activeDeviceId) {
          electSpeakerForStation(req.params.stationId, payload.deviceId);
        }
      }

      // Priority Guard: If an Admin priority track is currently playing, non-admins CANNOT kill it!
      const isCurrentAdminTrack = Boolean(
        stationState.currentTrack &&
        (stationState.currentTrack.priority === 'admin_instant' || stationState.currentTrack.priority === 'admin_high')
      );

      const track: SongTrack = {
        ...payload.track,
        id: payload.track.id || `track-${Date.now()}`,
        requestedBy: payload.requestedBy || 'Staff',
        addedAt: Date.now(),
        priority: payload.priority || 'staff_normal',
      };

      if (isCurrentAdminTrack && payload.requesterRole !== 'admin') {
        // Fallback gracefully: place right at front of staff queue so it plays as soon as admin track ends!
        stationState.staffQueue.unshift(track);
        break;
      }

      if (stationState.currentTrack) {
        stationState.playedHistory.unshift(stationState.currentTrack);
        if (stationState.playedHistory.length > 50) stationState.playedHistory.pop();
      }
      stationState.currentTrack = track;
      stationState.playbackState = {
        isPlaying: true,
        currentTime: 0,
        updatedAt: Date.now(),
      };
      refreshAutoPlayMix(track);
      break;
    }

    case 'SKIP_TRACK': {
      // Priority Guard: If an Admin priority track is currently playing, Speaker/Staff cannot skip it!
      // Only Admin or automatic track finished event can advance.
      const isCurrentAdminTrack = Boolean(
        stationState.currentTrack &&
        (stationState.currentTrack.priority === 'admin_instant' || stationState.currentTrack.priority === 'admin_high')
      );

      if (isCurrentAdminTrack && payload?.requesterRole !== 'admin' && !payload?.autoAdvance) {
        // Blocked: Speaker phone cannot skip an Admin priority track
        break;
      }

      const loopMode: 'none' | 'all' | 'one' = payload?.loopMode || stationState.settings.loopMode || 'none';
      const isShuffle: boolean = payload?.isShuffleEnabled !== undefined
        ? Boolean(payload.isShuffleEnabled)
        : Boolean(stationState.settings.isShuffleEnabled);

      // 1. LOOP-ONE: If single track repeat is active on autoAdvance, replay current track from 0:00
      if (loopMode === 'one' && payload?.autoAdvance && stationState.currentTrack) {
        stationState.playbackState.currentTime = 0;
        stationState.playbackState.isPlaying = true;
        stationState.playbackState.updatedAt = Date.now();
        break;
      }

      const prevTrack = stationState.currentTrack;
      if (prevTrack) {
        stationState.playedHistory.unshift(prevTrack);
        if (stationState.playedHistory.length > 50) stationState.playedHistory.pop();
        if (!payload?.afterPromo) {
          stationState.songsPlayedSinceLastPromo += 1;
        }

        // 2. LOOP-ALL: If loopMode is 'all', append finished track to end of the queue so it cycles continuously!
        // (Only impacts queue or current playlist as requested)
        if (loopMode === 'all') {
          if (prevTrack.priority === 'admin_high' || prevTrack.priority === 'admin_instant') {
            stationState.adminQueue.push(prevTrack);
          } else {
            stationState.staffQueue.push(prevTrack);
          }
        }
      }

      // Priority resolution: Admin Queue ("On Priority") > Staff Queue > YouTube Music Auto-Play Mix!
      // Shuffle only impacts the queue or current playlist as requested!
      if (stationState.adminQueue.length > 0) {
        if (isShuffle && stationState.adminQueue.length > 1) {
          const randIdx = Math.floor(Math.random() * stationState.adminQueue.length);
          stationState.currentTrack = stationState.adminQueue.splice(randIdx, 1)[0];
        } else {
          stationState.currentTrack = stationState.adminQueue.shift()!;
        }
        stationState.playbackState.isPlaying = true;
      } else if (stationState.staffQueue.length > 0) {
        if (isShuffle && stationState.staffQueue.length > 1) {
          const randIdx = Math.floor(Math.random() * stationState.staffQueue.length);
          stationState.currentTrack = stationState.staffQueue.splice(randIdx, 1)[0];
        } else {
          stationState.currentTrack = stationState.staffQueue.shift()!;
        }
        stationState.playbackState.isPlaying = true;
      } else if (stationState.recommendations.length > 0) {
        // Continuous YouTube Music Auto-Play Mix! Music never stops!
        stationState.currentTrack = stationState.recommendations.shift()!;
        stationState.playbackState.isPlaying = true;
      } else if (stationState.playedHistory.length > 0) {
        // Continuous radio loop: recycle played history if queue is exhausted
        const recycled = [...stationState.playedHistory].reverse();
        stationState.currentTrack = recycled.shift()!;
        stationState.recommendations = recycled;
        stationState.playbackState.isPlaying = true;
      } else {
        // No tracks queued and recommendations empty
        stationState.currentTrack = null;
        stationState.playbackState.isPlaying = false;
      }

      stationState.playbackState.currentTime = 0;
      stationState.playbackState.updatedAt = Date.now();

      // Ensure recommendations are refreshed in the background
      refreshAutoPlayMix(stationState.currentTrack);
      break;
    }

    case 'SET_LOOP_MODE': {
      const mode = payload?.loopMode;
      if (mode === 'none' || mode === 'all' || mode === 'one') {
        stationState.settings.loopMode = mode;
        const targetId = req.params.stationId || stationState.stationId;
        for (const st of stationState.stations) {
          if (st.id === targetId || st.id === stationState.stationId) {
            st.loopMode = mode;
          }
        }
        syncStationStateToCloudDatabase();
      }
      break;
    }

    case 'SET_SHUFFLE': {
      const enabled = typeof payload?.enabled === 'boolean'
        ? payload.enabled
        : !Boolean(stationState.settings.isShuffleEnabled);
      stationState.settings.isShuffleEnabled = enabled;
      const targetId = req.params.stationId || stationState.stationId;
      for (const st of stationState.stations) {
        if (st.id === targetId || st.id === stationState.stationId) {
          st.isShuffleEnabled = enabled;
        }
      }
      syncStationStateToCloudDatabase();
      break;
    }

    case 'TOGGLE_MOOD_MIX':
    case 'SET_MOOD_MIX': {
      const isEnabled = typeof payload?.enabled === 'boolean'
        ? payload.enabled
        : !Boolean(stationState.settings.moodMixEnabled);
      stationState.settings.moodMixEnabled = isEnabled;
      console.log(`[Auto-Mix Engine] Mood Mix toggled: ${isEnabled ? 'ON (Current Track Mood & Genre)' : 'OFF (Default 90s Evergreen)'}`);
      await refreshAutoPlayMix(stationState.currentTrack, true);
      syncStationStateToCloudDatabase();
      break;
    }

    case 'REFRESH_AUTO_MIX': {
      await refreshAutoPlayMix(stationState.currentTrack, true);
      break;
    }

    case 'SET_MASTER_VOLUME': {
      // Strictly Admin-only authority
      if (payload?.requesterRole === 'admin' && typeof payload?.volume === 'number') {
        const clamped = Math.max(0, Math.min(100, Math.round(payload.volume)));
        stationState.settings.masterVolume = clamped;
        syncStationStateToCloudDatabase();
      }
      break;
    }

    case 'REMOVE_TRACK': {
      const { trackId, queueType } = payload;
      if (queueType === 'admin') {
        stationState.adminQueue = stationState.adminQueue.filter((t) => t.id !== trackId);
      } else {
        stationState.staffQueue = stationState.staffQueue.filter((t) => t.id !== trackId);
      }
      break;
    }

    case 'CLEAR_QUEUE': {
      const queueType = payload?.queueType || 'staff';
      if (queueType === 'admin') {
        stationState.adminQueue = [];
      } else if (queueType === 'all') {
        stationState.staffQueue = [];
        stationState.adminQueue = [];
      } else {
        stationState.staffQueue = [];
      }
      break;
    }

    case 'PREVIOUS_TRACK': {
      // Apple Music behavior:
      // If current song played > 3 seconds, restart current track to 0:00
      // Else, pop previously played song from playedHistory stack
      const forcePrev = payload?.forcePrev;
      if (stationState.playbackState.currentTime > 3 && !forcePrev) {
        stationState.playbackState.currentTime = 0;
        stationState.playbackState.updatedAt = Date.now();
      } else if (stationState.playedHistory.length > 0) {
        const prevTrack = stationState.playedHistory.shift()!;
        if (stationState.currentTrack) {
          stationState.staffQueue.unshift(stationState.currentTrack);
        }
        stationState.currentTrack = prevTrack;
        stationState.playbackState.isPlaying = true;
        stationState.playbackState.currentTime = 0;
        stationState.playbackState.updatedAt = Date.now();
      } else {
        stationState.playbackState.currentTime = 0;
        stationState.playbackState.updatedAt = Date.now();
      }
      break;
    }

    case 'REORDER_QUEUE': {
      const { queueType, newQueue } = payload;
      if (queueType === 'admin') {
        stationState.adminQueue = newQueue;
      } else {
        stationState.staffQueue = newQueue;
      }
      break;
    }

    case 'PROMO_STARTED': {
      stationState.isPromoPlaying = true;
      stationState.activePromoClip = payload.promoClip || null;
      stationState.promoTriggerSource = payload.triggerSource || 'time_interval';
      stationState.songsPlayedSinceLastPromo = 0;
      stationState.lastPromoPlayedAt = Date.now();
      if (payload.promoClip) {
        const promo = stationState.promos.find((p) => p.id === payload.promoClip.id);
        if (promo) {
          promo.playsCount += 1;
          promo.lastPlayedAt = Date.now();
        }
      }
      break;
    }

    case 'PROMO_FINISHED': {
      stationState.isPromoPlaying = false;
      stationState.activePromoClip = null;
      stationState.promoTriggerSource = null;
      stationState.lastPromoPlayedAt = Date.now();
      break;
    }

    case 'STOP_PROMO': {
      stationState.isPromoPlaying = false;
      stationState.activePromoClip = null;
      stationState.promoTriggerSource = null;
      stationState.lastPromoPlayedAt = Date.now();
      break;
    }

    case 'CLAIM_SPEAKER_MODE': {
      const prevSpeakerId = stationState.speaker.activeDeviceId;
      touchOrRegisterDevice(req.params.stationId, payload.deviceId, payload.deviceName, payload.role);
      electSpeakerForStation(req.params.stationId, payload.deviceId);
      if (payload.role === 'admin' && prevSpeakerId && prevSpeakerId !== payload.deviceId) {
        stationState.handoverRequest = {
          id: `req-${Date.now()}`,
          requesterDeviceId: payload.deviceId,
          targetPreviousSpeakerId: prevSpeakerId,
          requesterDeviceName: 'Malik',
          requestedAt: Date.now(),
          status: 'admin_takeover',
        };
      }
      break;
    }

    case 'ADMIN_ASSIGN_SPEAKER': {
      const prevSpeakerId = stationState.speaker.activeDeviceId;
      const { targetDeviceId, targetDeviceName, myDeviceId } = payload;
      const devList = getStationDevices(req.params.stationId);
      const targetDev = devList.find((d) => d.deviceId === targetDeviceId);
      const chosenName = targetDev?.deviceName || targetDeviceName || 'Staff Phone';

      stationState.speaker.activeDeviceId = targetDeviceId;
      stationState.speaker.activeDeviceName = chosenName;
      stationState.speaker.lastHeartbeat = Date.now();

      for (const dev of devList) {
        dev.isSpeaker = dev.deviceId === targetDeviceId;
      }

      // If target device is Admin/Malik, or if Admin assigned and took over from previous speaker:
      if (targetDeviceId === myDeviceId || targetDev?.role === 'admin') {
        if (prevSpeakerId && prevSpeakerId !== targetDeviceId) {
          stationState.handoverRequest = {
            id: `req-${Date.now()}`,
            requesterDeviceId: targetDeviceId,
            targetPreviousSpeakerId: prevSpeakerId,
            requesterDeviceName: 'Malik',
            requestedAt: Date.now(),
            status: 'admin_takeover',
          };
        }
      } else {
        // Admin assigned another staff device as speaker:
        if (prevSpeakerId && prevSpeakerId !== targetDeviceId) {
          stationState.handoverRequest = {
            id: `req-${Date.now()}`,
            requesterDeviceId: targetDeviceId,
            targetPreviousSpeakerId: prevSpeakerId,
            requesterDeviceName: 'Malik',
            requestedAt: Date.now(),
            status: 'admin_takeover',
          };
        } else {
          stationState.handoverRequest = null;
        }
      }
      break;
    }

    case 'RANDOMIZE_SPEAKER': {
      const prevSpeakerId = stationState.speaker.activeDeviceId;
      const aliveDevices = getStationDevices(req.params.stationId);
      if (aliveDevices.length > 0) {
        // Randomly pick a speaker among all alive devices
        const randomIndex = Math.floor(Math.random() * aliveDevices.length);
        const chosen = aliveDevices[randomIndex];
        stationState.speaker.activeDeviceId = chosen.deviceId;
        stationState.speaker.activeDeviceName = chosen.deviceName;
        stationState.speaker.lastHeartbeat = Date.now();
        for (const dev of aliveDevices) {
          dev.isSpeaker = dev.deviceId === chosen.deviceId;
        }
        if (prevSpeakerId && prevSpeakerId !== chosen.deviceId && payload?.requesterRole === 'admin') {
          stationState.handoverRequest = {
            id: `req-${Date.now()}`,
            requesterDeviceId: chosen.deviceId,
            targetPreviousSpeakerId: prevSpeakerId,
            requesterDeviceName: 'Malik',
            requestedAt: Date.now(),
            status: 'admin_takeover',
          };
        }
      }
      break;
    }

    case 'LEAVE_STATION': {
      if (payload.deviceId) {
        removeDeviceFromStation(payload.deviceId, req.params.stationId);
      }
      break;
    }

    case 'REQUEST_SPEAKER_HANDOVER': {
      const isFromAdmin = payload.role === 'admin' || payload.requesterRole === 'admin';
      const prevSpeakerId = stationState.speaker.activeDeviceId;

      if (isFromAdmin) {
        // Admin immediate takeover: no accept/decline for staff
        touchOrRegisterDevice(req.params.stationId, payload.deviceId, payload.deviceName || 'Admin Phone', 'admin');
        electSpeakerForStation(req.params.stationId, payload.deviceId);
        if (prevSpeakerId && prevSpeakerId !== payload.deviceId) {
          stationState.handoverRequest = {
            id: `req-${Date.now()}`,
            requesterDeviceId: payload.deviceId,
            targetPreviousSpeakerId: prevSpeakerId,
            requesterDeviceName: 'Malik',
            requestedAt: Date.now(),
            status: 'admin_takeover',
          };
        } else {
          stationState.handoverRequest = null;
        }
      } else {
        stationState.handoverRequest = {
          id: `req-${Date.now()}`,
          requesterDeviceId: payload.deviceId,
          targetPreviousSpeakerId: prevSpeakerId,
          requesterDeviceName: payload.deviceName || 'Staff Phone',
          requestedAt: Date.now(),
          status: 'pending',
        };
      }
      break;
    }

    case 'RESPOND_SPEAKER_HANDOVER': {
      if (stationState.handoverRequest) {
        if (payload.approved) {
          stationState.speaker.activeDeviceId = stationState.handoverRequest.requesterDeviceId;
          stationState.speaker.activeDeviceName = stationState.handoverRequest.requesterDeviceName;
          stationState.speaker.lastHeartbeat = Date.now();
          for (const dev of getStationDevices(req.params.stationId)) {
            dev.isSpeaker = dev.deviceId === stationState.speaker.activeDeviceId;
          }
          stationState.handoverRequest = null;
        } else {
          stationState.handoverRequest.status = 'rejected';
          setTimeout(() => {
            if (stationState.handoverRequest?.status === 'rejected') {
              stationState.handoverRequest = null;
            }
          }, 4000);
        }
      }
      break;
    }

    case 'DISMISS_HANDOVER_NOTICE':
    case 'CANCEL_SPEAKER_HANDOVER': {
      stationState.handoverRequest = null;
      break;
    }

    case 'ADMIN_OVERRIDE_SPEAKER': {
      const prevSpeakerId = stationState.speaker.activeDeviceId;
      if (payload.deviceId) {
        touchOrRegisterDevice(req.params.stationId, payload.deviceId, payload.deviceName, 'admin');
        electSpeakerForStation(req.params.stationId, payload.deviceId);
      } else {
        electSpeakerForStation(req.params.stationId);
      }
      if (prevSpeakerId && prevSpeakerId !== stationState.speaker.activeDeviceId) {
        stationState.handoverRequest = {
          id: `req-${Date.now()}`,
          requesterDeviceId: stationState.speaker.activeDeviceId,
          targetPreviousSpeakerId: prevSpeakerId,
          requesterDeviceName: 'Malik',
          requestedAt: Date.now(),
          status: 'admin_takeover',
        };
      }
      break;
    }

    case 'RELEASE_SPEAKER_MODE': {
      if (stationState.speaker.activeDeviceId === payload.deviceId) {
        // Speaker voluntarily released: randomly transfer to another connected device
        const otherDevices = getStationDevices(req.params.stationId).filter(
          (d) => d.deviceId !== payload.deviceId
        );
        if (otherDevices.length > 0) {
          const randomIndex = Math.floor(Math.random() * otherDevices.length);
          const chosen = otherDevices[randomIndex];
          stationState.speaker.activeDeviceId = chosen.deviceId;
          stationState.speaker.activeDeviceName = chosen.deviceName;
          stationState.speaker.lastHeartbeat = Date.now();
          for (const dev of getStationDevices(req.params.stationId)) {
            dev.isSpeaker = dev.deviceId === chosen.deviceId;
          }
        } else {
          stationState.speaker.activeDeviceId = '';
          stationState.speaker.activeDeviceName = '';
        }
      }
      break;
    }

    case 'UPDATE_SETTINGS': {
      if (payload.settings) {
        stationState.settings = { ...stationState.settings, ...payload.settings };
        const targetId = req.params.stationId || stationState.stationId;
        for (const st of stationState.stations) {
          if (st.id === targetId || st.id === stationState.stationId) {
            if (payload.settings.promosEnabled !== undefined) st.promosEnabled = payload.settings.promosEnabled;
            if (payload.settings.promoSongInterval !== undefined) st.promoSongInterval = payload.settings.promoSongInterval;
            if (payload.settings.promoTimeIntervalMinutes !== undefined) st.promoTimeIntervalMinutes = payload.settings.promoTimeIntervalMinutes;
            if (payload.settings.promoIntervalType !== undefined) st.promoIntervalType = payload.settings.promoIntervalType;
            if (payload.settings.duckingVolumePercent !== undefined) st.duckingVolumePercent = payload.settings.duckingVolumePercent;
            if (payload.settings.duckingMode !== undefined) st.duckingMode = payload.settings.duckingMode;
            if (payload.settings.duckingDb !== undefined) st.duckingDb = payload.settings.duckingDb;
            if (payload.settings.fadeDurationSeconds !== undefined) st.fadeDurationSeconds = payload.settings.fadeDurationSeconds;
            if (payload.settings.activeCategoryFilter !== undefined) st.activeCategoryFilter = payload.settings.activeCategoryFilter;
            if (payload.settings.crossfadeSeconds !== undefined) st.crossfadeSeconds = payload.settings.crossfadeSeconds;
            if (payload.settings.loopMode !== undefined) st.loopMode = payload.settings.loopMode;
            if (payload.settings.isShuffleEnabled !== undefined) st.isShuffleEnabled = payload.settings.isShuffleEnabled;
          }
        }
      }
      if (payload.adminPin) {
        stationState.adminPin = payload.adminPin;
      }
      syncStationStateToCloudDatabase();
      break;
    }

    case 'START_LIVE_ANNOUNCEMENT': {
      stationState.isLiveMicActive = true;
      stationState.liveMicAdminName = payload?.adminName || 'Station Admin';
      stationState.liveMicManualMusicVolume = typeof payload?.manualMusicVolume === 'number' ? payload.manualMusicVolume : null;
      stationState.liveMicMode = payload?.mode || 'auto';
      if (payload?.broadcastMessage) {
        stationState.broadcastMessage = payload.broadcastMessage;
        stationState.broadcastTimestamp = Date.now();
      }
      break;
    }

    case 'STOP_LIVE_ANNOUNCEMENT': {
      stationState.isLiveMicActive = false;
      stationState.liveMicAdminName = null;
      stationState.liveMicManualMusicVolume = null;
      stationState.broadcastMessage = null;
      break;
    }

    // Station Management
    case 'ADD_STATION': {
      const newStation: StationItem = {
        id: `station-${Date.now()}`,
        name: payload.name || 'Naya Petrol Pump Station',
        location: payload.location || '',
        promosEnabled: payload.promosEnabled ?? true,
        pinRequired: payload.pinRequired ?? false,
        stationPin: payload.stationPin || '2006',
        adminPassword: payload.adminPassword || payload.stationPin || '2006',
        allowedSources: payload.allowedSources || 'all',
        promoIntervalType: payload.promoIntervalType || 'songs_count',
        promoSongInterval: payload.promoSongInterval || 2,
        promoTimeIntervalMinutes: payload.promoTimeIntervalMinutes || 10,
        activeCategoryFilter: payload.activeCategoryFilter || 'all',
        duckingVolumePercent: payload.duckingVolumePercent || 18,
      };
      stationState.stations.push(newStation);
      syncStationStateToCloudDatabase();
      break;
    }

    case 'UPDATE_STATION': {
      const { id, updates } = payload;
      const st = stationState.stations.find((s) => s.id === id);
      if (st) {
        Object.assign(st, updates);
        if (updates.adminPassword) {
          st.adminPassword = updates.adminPassword;
        }
        if (stationState.stationId === id) {
          if (updates.name) stationState.stationName = updates.name;
          if (updates.adminPassword) stationState.adminPin = updates.adminPassword;
          else if (updates.stationPin) stationState.adminPin = updates.stationPin;
          if (updates.promoSongInterval) stationState.settings.promoSongInterval = updates.promoSongInterval;
          if (updates.promoTimeIntervalMinutes) stationState.settings.promoTimeIntervalMinutes = updates.promoTimeIntervalMinutes;
          if (updates.promoIntervalType) stationState.settings.promoIntervalType = updates.promoIntervalType;
          if (updates.activeCategoryFilter) stationState.settings.activeCategoryFilter = updates.activeCategoryFilter;
          if (updates.promosEnabled !== undefined) stationState.settings.promosEnabled = updates.promosEnabled;
          if (updates.duckingVolumePercent) stationState.settings.duckingVolumePercent = updates.duckingVolumePercent;
          if (updates.allowedSources) stationState.settings.allowedSources = updates.allowedSources;
          if (updates.pinRequired !== undefined) stationState.settings.pinRequired = updates.pinRequired;
          if (updates.selectedPromoClipIds !== undefined) stationState.settings.selectedPromoClipIds = updates.selectedPromoClipIds;
          if (updates.crossfadeSeconds !== undefined) stationState.settings.crossfadeSeconds = updates.crossfadeSeconds;
        }
        syncStationStateToCloudDatabase();
      }
      break;
    }

    case 'DELETE_STATION': {
      if (stationState.stations.length > 1) {
        stationState.stations = stationState.stations.filter((s) => s.id !== payload.id);
        if (stationState.stationId === payload.id) {
          const first = stationState.stations[0];
          stationState.stationId = first.id;
          stationState.stationName = first.name;
        }
        syncStationStateToCloudDatabase();
      }
      break;
    }

    case 'SELECT_STATION': {
      const selected = stationState.stations.find((s) => s.id === payload.id);
      if (selected) {
        stationState.stationId = selected.id;
        stationState.stationName = selected.name;
        stationState.settings.promoSongInterval = selected.promoSongInterval;
        stationState.settings.promoTimeIntervalMinutes = selected.promoTimeIntervalMinutes;
        stationState.settings.promoIntervalType = selected.promoIntervalType;
        stationState.settings.activeCategoryFilter = selected.activeCategoryFilter;
        stationState.settings.promosEnabled = selected.promosEnabled;
        stationState.settings.duckingVolumePercent = selected.duckingVolumePercent;
        if (selected.pinRequired !== undefined) stationState.settings.pinRequired = selected.pinRequired;
        if (selected.adminPassword) stationState.adminPin = selected.adminPassword;
        else if (selected.stationPin) stationState.adminPin = selected.stationPin;
        if (selected.selectedPromoClipIds) stationState.settings.selectedPromoClipIds = selected.selectedPromoClipIds;
        if (selected.crossfadeSeconds) stationState.settings.crossfadeSeconds = selected.crossfadeSeconds;
        stationState.likedTracks = allStationsLikedTracks.get(selected.id) || [];
        syncStationStateToCloudDatabase();
      }
      break;
    }

    case 'TOGGLE_LIVE_MIC': {
      stationState.isLiveMicActive = !!payload.isActive;
      stationState.liveMicAdminName = payload.isActive ? 'Admin PA Announcement' : null;
      break;
    }

    case 'ADD_CATEGORY': {
      const newCat: PromoCategory = {
        id: `cat-${Date.now()}`,
        name: payload.name,
        description: payload.description || '',
        color: payload.color || '#f37021',
      };
      stationState.categories.push(newCat);
      syncStationStateToCloudDatabase();
      break;
    }

    case 'DELETE_CATEGORY': {
      stationState.categories = stationState.categories.filter((c) => c.id !== payload.id);
      syncStationStateToCloudDatabase();
      break;
    }

    case 'ADD_PROMO': {
      // Deduplication Guard: If promo with same ID or exact title already exists, update it rather than duplicating
      const existingIdx = stationState.promos.findIndex(
        (p) => (payload.id && p.id === payload.id) || (payload.title && p.title.trim().toLowerCase() === payload.title.trim().toLowerCase())
      );

      if (existingIdx !== -1) {
        stationState.promos[existingIdx] = {
          ...stationState.promos[existingIdx],
          ...payload,
          id: stationState.promos[existingIdx].id,
        };
        syncStationStateToCloudDatabase();
        break;
      }

      let finalAudioUrl = payload.audioUrl;
      let isCloudSaved = false;
      let fileSizeBytes: number | undefined = undefined;
      let storageType: 'cloud' | 'preset' | 'custom' = 'custom';
      let fileName: string | undefined = undefined;

      if (payload.audioUrl && (payload.audioUrl.startsWith('data:') || payload.audioUrl.length > 500)) {
        try {
          const savedFile = saveAudioFromDataUrl(payload.audioUrl, payload.title || 'promo');
          finalAudioUrl = savedFile.audioUrl;
          isCloudSaved = true;
          fileSizeBytes = savedFile.sizeBytes;
          storageType = 'cloud';
          fileName = savedFile.filename;
        } catch (e) {
          console.error('Error saving audio to cloud storage:', e);
        }
      }

      const newPromo: PromoClip = {
        id: payload.id || `promo-${Date.now()}`,
        title: payload.title,
        categoryId: payload.categoryId,
        audioUrl: finalAudioUrl,
        duration: payload.duration || 15,
        enabled: true,
        playsCount: 0,
        scriptSnippet: payload.scriptSnippet || '',
        isCloudSaved,
        fileSizeBytes,
        storageType,
        fileName,
        uploadedAt: payload.uploadedAt || Date.now(),
      };
      stationState.promos.push(newPromo);
      // Auto-enable promo system for station when user imports custom promo clip
      stationState.settings.promosEnabled = true;
      for (const st of stationState.stations) {
        if (st.id === (req.params.stationId || stationState.stationId)) {
          st.promosEnabled = true;
        }
      }
      syncStationStateToCloudDatabase();
      break;
    }

    case 'UPDATE_PROMO': {
      const { id, ...updates } = payload;
      const promo = stationState.promos.find((p) => p.id === id);
      if (promo) {
        Object.assign(promo, updates);
        syncStationStateToCloudDatabase();
      }
      break;
    }

    case 'DELETE_PROMO': {
      stationState.promos = stationState.promos.filter((p) => p.id !== payload.id);
      syncStationStateToCloudDatabase();
      break;
    }

    case 'TOGGLE_LIKE_TRACK': {
      if (payload?.track) {
        const targetStationId = req.params.stationId || stationState.stationId;
        const currentList = allStationsLikedTracks.get(targetStationId) || [];
        const trackKey = payload.track.youtubeVideoId || payload.track.id;
        const exists = currentList.some((t) => (t.youtubeVideoId || t.id) === trackKey);
        let updated: SongTrack[];
        if (exists) {
          updated = currentList.filter((t) => (t.youtubeVideoId || t.id) !== trackKey);
        } else {
          const newTrack: SongTrack = {
            ...payload.track,
            addedAt: Date.now(),
          };
          updated = [newTrack, ...currentList];
        }
        allStationsLikedTracks.set(targetStationId, updated);
        stationState.likedTracks = updated;
        syncStationStateToCloudDatabase();
      }
      break;
    }

    case 'REMOVE_LIKED_TRACK': {
      if (payload?.trackId) {
        const targetStationId = req.params.stationId || stationState.stationId;
        const currentList = allStationsLikedTracks.get(targetStationId) || [];
        const updated = currentList.filter(
          (t) => t.id !== payload.trackId && t.youtubeVideoId !== payload.trackId
        );
        allStationsLikedTracks.set(targetStationId, updated);
        stationState.likedTracks = updated;
        syncStationStateToCloudDatabase();
      }
      break;
    }

    default:
      break;
  }

  res.json({
    success: true,
    data: {
      ...stationState,
      connectedDevices: getStationDevices(req.params.stationId),
    },
  });
});

// Helper to decode HTML entities from JioSaavn response
function decodeHtmlEntities(str = '') {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// Universal Audio Stream Proxy Endpoint (Overcomes CORS & Referrer Restrictions)
app.get('/api/audio/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).json({ error: 'Valid URL is required' });
  }

  try {
    const range = req.headers.range;
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
    };
    if (range) {
      headers['Range'] = range;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res.status(upstreamRes.status).send('Upstream audio fetch failed');
    }

    const contentType = upstreamRes.headers.get('content-type') || 'audio/mpeg';
    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');
    const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';

    res.set({
      'Content-Type': contentType,
      'Accept-Ranges': acceptRanges,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    });

    if (contentLength) res.set('Content-Length', contentLength);
    if (contentRange) res.set('Content-Range', contentRange);

    res.status(upstreamRes.status);

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!res.write(value)) {
              await new Promise((r) => res.once('drain', r));
            }
          }
          res.end();
        } catch {
          res.end();
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (err) {
    console.warn('Audio proxy notice:', err);
    res.status(500).end();
  }
});

// Decrypt JioSaavn DES-encrypted media URL to high-quality 320kbps MP4/AAC stream
export function decryptSaavnMediaUrl(encryptedMediaUrl?: string): string | null {
  if (!encryptedMediaUrl) return null;
  try {
    const key = CryptoJS.enc.Utf8.parse('38346591');
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(encryptedMediaUrl),
    });
    const decrypted = CryptoJS.DES.decrypt(cipherParams, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    const raw = decrypted.toString(CryptoJS.enc.Utf8);
    if (!raw || !raw.startsWith('http')) return null;
    return raw.replace('_96.mp4', '_320.mp4');
  } catch {
    return null;
  }
}

// Endpoint to resolve direct background-playable audio stream for any track (JioSaavn 320kbps)
app.get('/api/tracks/resolve-audio-stream', async (req, res) => {
  const query = (req.query.q as string) || '';
  const title = (req.query.title as string) || '';
  const artist = (req.query.artist as string) || '';
  const cleanSearch = `${title} ${artist}`.trim() || query;

  if (!cleanSearch) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  try {
    const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&q=${encodeURIComponent(cleanSearch)}&p=1&n=5`;
    const response = await fetch(saavnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json() as any;
      if (data.results && data.results.length > 0) {
        for (const item of data.results) {
          const direct = decryptSaavnMediaUrl(item.encrypted_media_url) || item.media_preview_url;
          if (direct) {
            return res.json({
              success: true,
              directAudioUrl: direct,
              title: cleanTrackTitle(decodeHtmlEntities(item.song || item.title || '')),
              artist: decodeHtmlEntities(item.primary_artists || item.singers || ''),
              artworkUrl: item.image ? item.image.replace('150x150', '500x500') : undefined,
              source: 'jiosaavn',
            });
          }
        }
      }
    }
    return res.json({ success: false, error: 'No direct audio stream found' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Resolution failed' });
  }
});

// -------------------------------------------------------------
// Intelligent Title Normalization & Music De-Cluttering Engine
// Removes repeated uploads, identical songs, and cluttering results
// -------------------------------------------------------------
export function cleanTrackTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let t = rawTitle;
  // Remove emojis
  t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  // Remove hashtags like #shorts
  t = t.replace(/#[\w-]+/g, '');
  // Remove brackets [Official Video], [HD], [4K], [8K], etc.
  t = t.replace(/\[.*?\]/g, '');
  // Remove parentheses with video/audio/remix/song/etc.
  t = t.replace(/\(.*?(official|video|audio|4k|8k|hd|lyric|remastered|full|song|cover|teaser|trailer|crakk|remake).*?\)/gi, '');
  // Remove prefixes like "CRAKK: ", "WAR 2: ", "TEASER: "
  t = t.replace(/^(crakk|movie|teaser|trailer|full video song|video song|8k video song|official video|official song|lyrical video)\s*:\s*/gi, '');
  // Remove tags like "8K Video Song:", "Full Video:", "Official Audio:"
  t = t.replace(/(8k|4k|hd|full)?\s*(video|audio|lyrical)?\s*song\s*:\s*/gi, '');
  // Remove trailing channel trailers "| T-Series", "| Zee Music", etc.
  t = t.replace(/\|\s*(t-?series|zee music|yrf|tips|sony music|saregama|speed records).*$/gi, '');
  t = t.replace(/-\s*(official|lyrical|video|audio|t-?series|zee music).*$/gi, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  // Strip trailing or leading dashes/colons/bars
  t = t.replace(/^[-:|/ ]+|[-:|/ ]+$/g, '').trim();
  return t;
}

export function extractCoreSignature(title: string, artist: string = ''): string {
  let text = (title || '').toLowerCase();
  // Remove emojis
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ');
  // Remove hashtags
  text = text.replace(/#[\w-]+/g, ' ');
  // Remove brackets and parentheses
  text = text.replace(/\[.*?\]/g, ' ').replace(/\(.*?\)/g, ' ');

  const noise = [
    '8k', '4k', '2k', 'hd', 'hq', '1080p', '720p', '480p', '60fps',
    'official', 'video', 'audio', 'song', 'songs', 'full', 'lyric', 'lyrics', 'lyrical',
    'remastered', 'remix', 'dhamaka', 'superhit', 'hit', 'hits', 'gaana', 'gana', 'geet',
    'tseries', 't-series', 'zee music', 'speed records', 'tips official', 'yrf', 'sony music',
    'sonymusic', 'status', 'reels', 'shorts', 'new', 'latest', 'original', 'soundtrack', 'special',
    'song video', 'full track', 'extended', 'music by', 'murvex', 'vidyut jammwal', 'nora fatehi',
    'vidyut', 'nora', 'crakk'
  ];

  for (const n of noise) {
    text = text.replace(new RegExp(`\\b${n}\\b`, 'gi'), ' ');
  }

  // Keep alphanumeric and Indic Unicode scripts
  text = text.replace(/[^a-z0-9\u0900-\u097F]/gi, ' ').replace(/\s+/g, ' ').trim();
  if (text.length < 3) {
    text = (title || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/gi, '').slice(0, 18);
  }
  return text;
}

export function areTracksDuplicate(
  a: { title: string; artist?: string; id?: string; youtubeVideoId?: string },
  b: { title: string; artist?: string; id?: string; youtubeVideoId?: string }
): boolean {
  if (!a || !b) return false;

  // 1. Exact Video ID Match
  const vidA = a.youtubeVideoId || a.id;
  const vidB = b.youtubeVideoId || b.id;
  if (vidA && vidB && vidA === vidB) return true;

  // 2. Normalized Core Signatures
  const sigA = extractCoreSignature(a.title, a.artist);
  const sigB = extractCoreSignature(b.title, b.artist);
  if (!sigA || !sigB) return false;

  if (sigA === sigB) return true;

  // 3. Token-level analysis
  const tokensA = sigA.split(' ').filter((w) => w.length >= 3);
  const tokensB = sigB.split(' ').filter((w) => w.length >= 3);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  // Primary song title tokens (first 2 significant tokens e.g. "dil jhoom")
  const primaryA = tokensA.slice(0, 2).join(' ');
  const primaryB = tokensB.slice(0, 2).join(' ');
  if (primaryA && primaryB && primaryA === primaryB) {
    return true;
  }

  // Token overlap ratio
  const setB = new Set(tokensB);
  const matches = tokensA.filter((t) => setB.has(t));
  const overlapRatio = (matches.length * 2) / (tokensA.length + tokensB.length);
  if (overlapRatio >= 0.5) {
    return true;
  }

  // Substring containment for core strings
  if (sigA.length >= 4 && sigB.length >= 4) {
    if (sigA.includes(sigB) || sigB.includes(sigA)) {
      return true;
    }
  }

  return false;
}

// -------------------------------------------------------------
// Official Music Labels & Verified Channels Whitelist
// Filters out cheap AI-generated remakes and unverified third-party channels
// -------------------------------------------------------------
export const OFFICIAL_LABELS_REGEX = /(tips|saregama|t-?series|venus|ishtar|sony\s*music|zee\s*music|yrf|yash\s*raj|shemaroo|rajshri|ultra\s*bollywood|ultra\s*music|times\s*music|universal\s*music|emi|speed\s*records|white\s*hill|geet\s*mp3|wave\s*music|worldwide\s*records|adishakti|bhojpuriya|khesari\s*music|vevo|\bvevo\b|-?\s*topic$)/i;

export const AI_FAKE_REMAKE_REGEX = /(ai\s*cover|ai\s*remake|ai\s*version|ai\s*voice|ai\s*generated|voice\s*clone|vocal\s*ai|\bsuno\b|\budio\b|fake\s*remake|cheap\s*remake|synthetic\s*voice|slowed\s*\+\s*reverb|slowed\s*reverb|lofi\s*remake|ai\s*song|ai\s*music)/i;

export function isVerifiedOfficialSource(video: { title?: string; author?: { name?: string; url?: string } }): boolean {
  const channelName = (video.author?.name || '').trim();
  const title = (video.title || '').trim();

  // 1. Strict rejection of AI voice clones, fake remakes, and synthetic covers
  if (AI_FAKE_REMAKE_REGEX.test(title) || AI_FAKE_REMAKE_REGEX.test(channelName)) {
    return false;
  }

  // 2. Verified official record labels & YouTube Music official artist topic channels
  if (OFFICIAL_LABELS_REGEX.test(channelName)) {
    return true;
  }

  // 3. Official artist or production company patterns
  const lowerChannel = channelName.toLowerCase();
  if (
    lowerChannel.includes('official') ||
    lowerChannel.includes('records') ||
    lowerChannel.includes('music company') ||
    lowerChannel.includes('classics') ||
    lowerChannel.includes('entertainment') ||
    lowerChannel.includes('music channel')
  ) {
    return true;
  }

  return false;
}

// -------------------------------------------------------------
// Intelligent Query Intent & Relevance Scoring Engine
// Ranks tracks accurately so the Top Result matches the user's intent 100%
// -------------------------------------------------------------
export function calculateTrackRelevance(track: SongTrack, rawQuery: string, originalRankIndex: number = 0): number {
  if (!track) return -999;
  const query = (rawQuery || '').toLowerCase().trim();
  if (!query) return 0;

  const title = (track.title || '').toLowerCase();
  const artist = (track.artist || '').toLowerCase();
  const album = (track.album || '').toLowerCase();
  const combined = `${title} ${artist} ${album}`;

  // 1. YouTube Native Ranking Baseline:
  // YouTube's #1 result starts with 100 points, #2 with 97 points, #3 with 94 points, etc.
  // This guarantees YouTube's native intelligence, view-velocity, and freshness are respected as the primary foundation.
  let score = Math.max(10, 100 - originalRankIndex * 3);

  // 2. Strict Exclusion: AI voice clones, fake remakes, synthetic covers
  if (AI_FAKE_REMAKE_REGEX.test(combined)) {
    return -999;
  }

  // 3. Devotional / Religious Intent Separation
  const devotionalKeywords = [
    'chalisa', 'aarti', 'bhajan', 'bhakti', 'katha', 'mantra', 'stuti', 'amritwani',
    'dhun', 'ramayan', 'hanuman', 'krishna', 'shree ram', 'ram', 'shiv', 'ganesh',
    'mata', 'durga', 'sai baba', 'shyam', 'radha', 'har har mahadev', 'om namah',
    'gayatri', 'devotional', 'sunderkand', 'parvati', 'laxmi', 'saraswati', 'navratri'
  ];
  const isDevotionalQuery = devotionalKeywords.some((w) => query.includes(w));
  const isDevotionalTrack = devotionalKeywords.some((w) => combined.includes(w));

  const secularGenreKeywords = [
    'bollywood', 'movie', 'film', 'filmi', 'cinema', 'romantic', 'love', 'dance',
    'party', 'item', 'sad song', 'pop', 'punjabi', 'bhojpuri', 'rock', 'hip hop',
    'club', 'remix', '90s', '80s', '70s', 'evergreen', 'retro'
  ];
  const hasSecularGenreInQuery = secularGenreKeywords.some((w) => query.includes(w));

  if (hasSecularGenreInQuery && !isDevotionalQuery && isDevotionalTrack) {
    // Severe penalty: User searched Bollywood or party, devotional tracks must not hijack top ranks
    score -= 120;
  } else if (isDevotionalQuery && isDevotionalTrack) {
    // User explicitly searched devotional
    score += 35;
  } else if (isDevotionalQuery && !isDevotionalTrack) {
    // User asked for devotional but track is secular
    score -= 80;
  }

  // 4. Exact Title & Keyword Overlap
  const queryWords = query
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['song', 'songs', 'gaana', 'gana', 'geet', 'music', 'video', 'audio', 'track', 'hits', 'hit'].includes(w));

  if (queryWords.length > 0) {
    let matchedTitleWords = 0;
    let matchedArtistWords = 0;

    for (const w of queryWords) {
      if (title.includes(w)) matchedTitleWords++;
      if (artist.includes(w)) matchedArtistWords++;
    }

    if (title.includes(query)) {
      score += 25;
    } else if (matchedTitleWords === queryWords.length) {
      score += 15;
    } else {
      score += matchedTitleWords * 5;
    }

    if (artist.includes(query)) {
      score += 20;
    } else {
      score += matchedArtistWords * 6;
    }
  }

  // 5. Official Music Label & Verified Source Priority
  // Gives verified channels (T-Series, Sony Music, Zee, Saregama, YRF, Tips, Topic channels) a clean boost
  if (track.isOfficial) {
    score += 15;
  }

  // 6. Reasonable Track Duration
  const duration = track.duration || 0;
  if (duration >= 90 && duration <= 600) {
    score += 5;
  }

  return score;
}

export function deduplicateAndDeclutterTracks(
  tracks: SongTrack[],
  targetLimit = 40,
  currentTrack: SongTrack | null = null,
  excludeQueue: SongTrack[] = []
): SongTrack[] {
  const finalTracks: SongTrack[] = [];
  const seenVideoIds = new Set<string>();

  for (const track of tracks) {
    if (!track) continue;

    const vidId = track.youtubeVideoId || track.id;
    if (seenVideoIds.has(vidId)) continue;

    // 1. Strictly drop if duplicate of current playing track
    if (currentTrack && areTracksDuplicate(track, currentTrack)) {
      continue;
    }

    // 2. Strictly drop if already present in manual queue or played history
    if (excludeQueue.length > 0 && excludeQueue.some((q) => areTracksDuplicate(track, q))) {
      continue;
    }

    // 3. Strictly drop if duplicate of any song already accepted in this batch
    if (finalTracks.some((accepted) => areTracksDuplicate(track, accepted))) {
      continue;
    }

    track.title = cleanTrackTitle(track.title) || track.title;
    seenVideoIds.add(vidId);
    finalTracks.push(track);

    if (finalTracks.length >= targetLimit) break;
  }

  return finalTracks;
}

// Reusable Multi-Engine Music Search Function with Full-Track Guarantees & Max Audio Formats Support
export async function searchTracksInternal(
  query: string,
  requestedSource: string = 'all',
  page: number = 1,
  limit: number = 35
): Promise<SongTrack[]> {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return [];

  const rawCandidatePool: SongTrack[] = [];

  const addCandidate = (track: SongTrack) => {
    rawCandidatePool.push(track);
  };

  // 1. Direct YouTube Link or 11-char Video ID Detection
  const ytMatch = cleanQ.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  const isDirectYtId = !ytMatch && /^[a-zA-Z0-9_-]{11}$/.test(cleanQ);
  const directVideoId = ytMatch ? ytMatch[1] : (isDirectYtId ? cleanQ : null);

  if (directVideoId) {
    try {
      const vidInfo = await ytSearch({ videoId: directVideoId });
      if (vidInfo) {
        return [{
          id: `yt-${directVideoId}`,
          title: cleanTrackTitle(vidInfo.title || 'YouTube Track'),
          artist: vidInfo.author?.name || 'YouTube Music',
          album: 'YouTube',
          duration: vidInfo.seconds || 240,
          audioUrl: `https://www.youtube.com/watch?v=${directVideoId}`,
          youtubeVideoId: directVideoId,
          artworkUrl: vidInfo.thumbnail || `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
          source: 'youtube' as const,
          requestedBy: '',
          addedAt: Date.now(),
          priority: 'staff_normal' as const,
        }];
      }
    } catch {
      return [{
        id: `yt-${directVideoId}`,
        title: `YouTube Video (${directVideoId})`,
        artist: 'YouTube Music',
        album: 'YouTube',
        duration: 240,
        audioUrl: `https://www.youtube.com/watch?v=${directVideoId}`,
        youtubeVideoId: directVideoId,
        artworkUrl: `https://i.ytimg.com/vi/${directVideoId}/hqdefault.jpg`,
        source: 'youtube' as const,
        requestedBy: '',
        addedAt: Date.now(),
        priority: 'staff_normal' as const,
      }];
    }
  }

  // 2. Direct Audio URL Detection (MP3, WAV, AAC, M4A, OGG, FLAC, Live Streams)
  if (/^https?:\/\/.+\.(mp3|wav|ogg|m4a|aac|flac|webm)(\?.*)?$/i.test(cleanQ) || /^https?:\/\/.+\/(stream|radio|live|audio)(\?.*)?$/i.test(cleanQ)) {
    const rawFilename = cleanQ.split('/').pop()?.split('?')[0] || 'Direct Audio';
    const cleanTitle = decodeURIComponent(rawFilename).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ');
    return [{
      id: `audio-${Date.now()}`,
      title: cleanTitle || 'Online Audio Track',
      artist: 'Web Audio Stream',
      album: 'Direct Stream',
      duration: 240,
      audioUrl: cleanQ,
      artworkUrl: '',
      source: 'online' as const,
      requestedBy: '',
      addedAt: Date.now(),
      priority: 'staff_normal' as const,
    }];
  }

  // 3. YouTube Music API Search (yt-search)
  // Exact raw query searched directly — NO artificial suffix tampering!
  const fetchYouTubeMusic = async (): Promise<SongTrack[]> => {
    try {
      // Direct raw query execution for 1:1 parity with YouTube
      let pageQuery = cleanQ;
      if (page === 2) {
        pageQuery = `${cleanQ} songs`;
      } else if (page === 3) {
        pageQuery = `${cleanQ} music`;
      } else if (page === 4) {
        pageQuery = `${cleanQ} hits`;
      } else if (page >= 5) {
        pageQuery = `${cleanQ} tracks`;
      }

      const searchRes = await ytSearch(pageQuery);
      if (searchRes && searchRes.videos && searchRes.videos.length > 0) {
        const isJukeboxRequested = /jukebox|nonstop|non-stop|album|all songs|mashup|medley/i.test(cleanQ);
        const maxSec = isJukeboxRequested ? 7200 : 1800;
        const minSec = 45;

        const validVideos = searchRes.videos.filter((v) => {
          const sec = v.seconds || 0;
          const titleLower = (v.title || '').toLowerCase();
          const isTooShort = sec > 0 && sec < minSec;
          const isTooLong = !isJukeboxRequested && sec > maxSec;
          const isShortsTag = titleLower.includes('#shorts');
          if (isTooShort || isTooLong || isShortsTag) return false;

          // Reject any AI-generated remakes, synthetic voice clones, or fake cover versions
          if (AI_FAKE_REMAKE_REGEX.test(v.title || '') || AI_FAKE_REMAKE_REGEX.test(v.author?.name || '')) {
            return false;
          }

          // Filter out obvious non-music videos (trailers, reviews, reactions, vlogs, gameplay, roast)
          if (/teaser|trailer|review|reaction|vlog|gameplay|roast|behind the scenes|making of/i.test(titleLower)) {
            return false;
          }

          return true;
        });

        // If fewer than 15 videos passed on page 1, fetch additional official songs in parallel to ensure a rich 20-30 track list
        if (page === 1 && validVideos.length < 15) {
          try {
            const extraRes = await ytSearch(`${cleanQ} official`);
            if (extraRes?.videos) {
              for (const v of extraRes.videos) {
                const sec = v.seconds || 0;
                if (
                  sec >= minSec &&
                  (!maxSec || isJukeboxRequested || sec <= maxSec) &&
                  !(v.title || '').toLowerCase().includes('#shorts') &&
                  !AI_FAKE_REMAKE_REGEX.test(v.title || '') &&
                  !/teaser|trailer|review|reaction|vlog|gameplay|roast/i.test((v.title || '').toLowerCase())
                ) {
                  if (!validVideos.some((ev) => ev.videoId === v.videoId)) {
                    validVideos.push(v);
                  }
                }
              }
            }
          } catch {
            // ignore
          }
        }

        // Filter and inspect candidates - expand pool up to 50 candidates
        const candidates = validVideos.slice(0, 50);

        // Verify embeddability via YouTube oembed in parallel
        const checked = await Promise.all(
          candidates.map(async (v) => {
            try {
              const oRes = await fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.videoId}&format=json`,
                { signal: AbortSignal.timeout(1500) }
              );
              return { video: v, allowed: oRes.status === 200 };
            } catch {
              return { video: v, allowed: true };
            }
          })
        );

        return checked
          .filter((item) => item.allowed)
          .map(({ video: v }) => {
            const cleanTitle = cleanTrackTitle(v.title || '');
            return {
              id: `yt-${v.videoId}`,
              title: cleanTitle || v.title,
              artist: v.author?.name || 'YouTube Music',
              album: 'YouTube Music',
              duration: v.seconds && v.seconds >= 30 ? v.seconds : 240,
              audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
              youtubeVideoId: v.videoId,
              artworkUrl: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
              source: 'youtube' as const,
              requestedBy: '',
              addedAt: Date.now(),
              priority: 'staff_normal' as const,
              isOfficial: isVerifiedOfficialSource(v),
            };
          });
      }
    } catch (err) {
      console.warn('YouTube search notice:', err);
    }
    return [];
  };

  // 4. JioSaavn Official Catalog API Search (Fallback Only)
  const fetchJioSaavn = async (): Promise<SongTrack[]> => {
    try {
      const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&cc=in&includeMetaTags=1&q=${encodeURIComponent(cleanQ)}&p=${page}&n=20`;
      const response = await fetch(saavnUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (response.ok) {
        const data = await response.json() as {
          results?: Array<{
            id: string;
            song?: string;
            title?: string;
            primary_artists?: string;
            singers?: string;
            album?: string;
            duration?: string | number;
            media_preview_url?: string;
            encrypted_media_url?: string;
            image?: string;
          }>;
        };

        if (data.results && data.results.length > 0) {
          const items = data.results.slice(0, 15);
          const mapped: (SongTrack | null)[] = await Promise.all(
            items.map(async (item): Promise<SongTrack | null> => {
              const rawTitle = decodeHtmlEntities(item.song || item.title || '');
              const rawArtist = decodeHtmlEntities(item.primary_artists || item.singers || '');
              const cleanImage = item.image ? item.image.replace('150x150', '500x500') : '';
              if (!rawTitle) return null;

              // Extract direct 320kbps audio stream from encrypted media URL
              const directStream = decryptSaavnMediaUrl(item.encrypted_media_url);

              let ytVideoId: string | undefined = undefined;
              let ytThumb: string | undefined = undefined;

              try {
                const labelHint = item.album || '';
                const ytMatchRes = await ytSearch(`${rawTitle} ${rawArtist} ${labelHint} official song`).catch(() => null);
                const bestMatch =
                  ytMatchRes?.videos?.find((v) => (v.seconds || 0) >= 45 && (v.seconds || 0) <= 900 && isVerifiedOfficialSource(v)) ||
                  ytMatchRes?.videos?.find((v) => (v.seconds || 0) >= 45 && (v.seconds || 0) <= 900 && !AI_FAKE_REMAKE_REGEX.test(v.title || '') && !AI_FAKE_REMAKE_REGEX.test(v.author?.name || ''));
                if (bestMatch) {
                  ytVideoId = bestMatch.videoId;
                  ytThumb = bestMatch.thumbnail;
                }
              } catch {
                // fallback
              }

              const finalAudioUrl = directStream || (ytVideoId ? `https://www.youtube.com/watch?v=${ytVideoId}` : item.media_preview_url);
              if (!finalAudioUrl) return null;

              return {
                id: `saavn-${item.id}`,
                title: cleanTrackTitle(rawTitle),
                artist: rawArtist || 'JioSaavn',
                album: decodeHtmlEntities(item.album || 'Single'),
                duration: Number(item.duration) || 240,
                audioUrl: finalAudioUrl,
                directAudioUrl: directStream || item.media_preview_url,
                youtubeVideoId: ytVideoId,
                artworkUrl: cleanImage || ytThumb,
                source: 'jiosaavn' as const,
                requestedBy: '',
                addedAt: Date.now(),
                priority: 'staff_normal' as const,
                isOfficial: true,
                isBackgroundOptimized: Boolean(directStream || item.media_preview_url),
              };
            })
          );

          return mapped.filter((t): t is SongTrack => Boolean(t));
        }
      }
    } catch (err) {
      console.warn('JioSaavn search notice:', err);
    }
    return [];
  };

  if (requestedSource === 'saavn') {
    const saavnOnlyTracks = await fetchJioSaavn();
    saavnOnlyTracks.forEach(addCandidate);
    if (rawCandidatePool.length < 5) {
      const ytTracks = await fetchYouTubeMusic();
      ytTracks.forEach(addCandidate);
    }
  } else {
    // Default 'all' or 'youtube': Fetch both YouTube Music and JioSaavn catalog in parallel for maximum background audio resilience
    const [ytTracks, saavnTracks] = await Promise.all([
      fetchYouTubeMusic().catch(() => [] as SongTrack[]),
      fetchJioSaavn().catch(() => [] as SongTrack[]),
    ]);
    ytTracks.forEach(addCandidate);
    saavnTracks.forEach(addCandidate);
  }

  // 5. Intelligent Relevance Scoring & Sorting
  // Scored against user query intent while strictly preserving YouTube native ranking baseline
  const scoredCandidates = rawCandidatePool.map((track, idx) => ({
    track,
    score: calculateTrackRelevance(track, cleanQ, idx),
  }));

  // Sort descending by relevance score so the BEST match is strictly at index 0 (guaranteeing Top Result accuracy)
  scoredCandidates.sort((a, b) => b.score - a.score);

  // If there are strong matches (score >= 40), prune out severe category clashes (score <= 0)
  const hasStrongMatches = scoredCandidates.some((item) => item.score >= 40);
  const prioritizedCandidates = hasStrongMatches
    ? scoredCandidates.filter((item) => item.score > 0).map((item) => item.track)
    : scoredCandidates.map((item) => item.track);

  // Apply safe deduplication and de-cluttering while strictly preserving top relevance order and versions
  return deduplicateAndDeclutterTracks(prioritizedCandidates, limit);
}

// -------------------------------------------------------------
// YouTube Music "Auto-Play Mix" Endless Queue Algorithm
// Hardcoded Default: Real Online 90s Bollywood Evergreen Hits
// Keeps stationState.recommendations dynamically replenished with
// genuine full-length 90s songs so music NEVER stops.
// -------------------------------------------------------------
const DEFAULT_90S_SEEDS = [
  'Lata Mangeshkar evergreen golden hit songs',
  'Mohammed Rafi classic superhit songs',
  'Kishore Kumar romantic evergreen songs',
  'Lata Rafi evergreen duets superhit songs',
  'Mukesh sadabahar purane gaane',
  'Asha Bhosle RD Burman classic hits',
  'Kishore Kumar Lata Mangeshkar hit songs',
  '90s Bollywood evergreen songs',
  'Kumar Sanu 90s superhit songs',
  'Udit Narayan Alka Yagnik 90s hits',
  '90s romantic hindi love songs',
  'Sonu Nigam 90s superhit songs',
  '90s sadabahar purane gaane',
  'Aashiqui 1990 songs',
  'Dilwale Dulhania Le Jayenge songs',
  'Saajan 1991 songs',
  'Mohra 1994 songs',
  'Hum Dil De Chuke Sanam songs',
  'Kabhie Kabhie Mukesh Lata songs',
];

// -------------------------------------------------------------
// Mood & Genre Detection Engine for Sangeet Forecourt Radio
// Classifies audio into rich Vibe & Genre categories:
// - Devotional / Bhakti (Morning spiritual chants, bhajans)
// - Party / High Energy (Dance, Punjabi, Bollywood beats)
// - Punjabi & Desi Beats
// - Soulful & Sad (Emotional, heartbreak ballads)
// - Sufi & Ghazal (Roohani acoustic, classical ghazals)
// - Romantic Melodies (Love ballads, soothing acoustics)
// - 90s Bollywood Evergreen (Nostalgic golden era)
// -------------------------------------------------------------
export interface DetectedMoodInfo {
  moodLabel: string;
  genre: string;
  searchQuery: string;
}

export function detectTrackMoodAndGenre(track: SongTrack): DetectedMoodInfo {
  const cleanTitle = (track.title || '').replace(/#[a-zA-Z0-9_-]+/g, '').replace(/[|/\\()[\]]/g, ' ').trim();
  const cleanArtist = (track.artist || '').replace(/#[a-zA-Z0-9_-]+/g, '').trim();
  const text = `${cleanTitle} ${cleanArtist} ${track.album || ''}`.toLowerCase();

  // 1. Devotional / Bhakti / Spiritual
  if (/bhajan|aarti|chalisa|shiv|krishna|ram|hanuman|ganesh|mata|kirtan|bhakti|devotional|spiritual|mantra|har har|amritvani|anup jalota|anuradha paudwal|gulshan kumar|lakkha|hansraj/i.test(text)) {
    return {
      moodLabel: '🧘 Devotional & Spiritual',
      genre: 'Bhakti',
      searchQuery: `${cleanArtist || 'Bhakti'} morning devotional bhajan aarti superhits`,
    };
  }

  // 2. Party / Dance / High-Energy
  if (/party|dance|remix|club|bass|dhol|nach|thumka|dhamaka|dj|beat|badshah|honey singh|raftaar|guru randhawa|mika singh|daler mehndi|neha kakkar|tony kakkar|sukhwinder/i.test(text)) {
    return {
      moodLabel: '🔥 Party & Dance Hits',
      genre: 'Party / Dance',
      searchQuery: `${cleanArtist || 'Bollywood'} high energy party dance superhit songs`,
    };
  }

  // 3. Punjabi & Desi Beats
  if (/punjabi|bhangra|pind|jatt|yaari|peg|mitraan|sardar|gabru|sidhu moosewala|karan aujla|diljit|ap dhillon|shubh|amrit maan|sartaaj|sartaj/i.test(text)) {
    return {
      moodLabel: '🥁 Punjabi & Desi Beats',
      genre: 'Punjabi',
      searchQuery: `${cleanArtist || 'Punjabi'} superhit songs Diljit Karan Aujla`,
    };
  }

  // 4. Sad / Soulful / Emotional Heartbreak
  if (/sad|dard|judai|bewafa|tanhai|roye|aansu|broken|heartbreak|alvida|b praak|jaani|altaf raja|channa mereya|agar tum saath ho|lut gaye/i.test(text)) {
    return {
      moodLabel: '🌧️ Soulful & Sad Melodies',
      genre: 'Soulful / Emotional',
      searchQuery: `${cleanArtist || 'Arijit Singh'} soulful emotional heart touching hindi songs`,
    };
  }

  // 5. Sufi / Ghazal / Acoustic
  if (/sufi|ghazal|acoustic|unplugged|tabla|qawwali|afreen|khwaja|roohani|nusrat|rahat|jagjit singh|ghulam ali|mehdi hassan/i.test(text)) {
    return {
      moodLabel: '✨ Sufi & Ghazal Vibe',
      genre: 'Sufi / Ghazal',
      searchQuery: `${cleanArtist || 'Nusrat Fateh'} sufi ghazal acoustic melodies`,
    };
  }

  // 6. Romantic / Love Melodies
  if (/love|ishq|pyaar|mohobbat|dil|romantic|sanam|hamsafar|deewana|tum hi ho|raataan lambiyan|pehla nasha|arijit|shreya ghoshal|atif aslam|jubin|armaan malik|mohit chauhan|kk|kesariya/i.test(text)) {
    return {
      moodLabel: '💖 Romantic Melodies',
      genre: 'Romantic',
      searchQuery: `${cleanArtist || 'Arijit Singh'} romantic hindi love melody songs`,
    };
  }

  // 7. 90s / Retro Evergreen
  if (/90s|80s|70s|purane|evergreen|retro|classic|golden|sadabahar|kishore|lata|rafi|mukesh|kumar sanu|udit narayan|alka yagnik|kavita/i.test(text)) {
    return {
      moodLabel: '📻 Golden Era & 90s Hits',
      genre: '90s Evergreen',
      searchQuery: `${cleanArtist || 'Lata Mangeshkar Kishore Kumar'} evergreen classic superhit songs`,
    };
  }

  // 8. General Vibe Match using artist
  return {
    moodLabel: `🎵 ${cleanArtist || 'Similar'} Vibe Mix`,
    genre: 'Melody Mix',
    searchQuery: `${cleanArtist || 'Bollywood'} popular hit songs radio`,
  };
}

// -------------------------------------------------------------
// YouTube Innertube "Watch Next" / Native Up Next Radio Engine
// Directly queries YouTube's real recommendation pipeline for 1:1 parity
// with YouTube & YouTube Music radio mixes.
// -------------------------------------------------------------
export async function fetchYouTubeWatchNext(videoId: string): Promise<SongTrack[]> {
  const cleanId = (videoId || '').replace(/^yt-/, '').trim();
  if (!cleanId || cleanId.length !== 11) return [];

  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: cleanId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'hi',
            gl: 'IN',
          },
        },
      }),
    });

    if (!res.ok) return [];
    const data: any = await res.json();
    const rawItems: any[] =
      data?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results || [];
    const tracks: SongTrack[] = [];

    for (const item of rawItems) {
      // 1. Modern lockupViewModel
      if (item?.lockupViewModel) {
        const vm = item.lockupViewModel;
        const vId = vm.contentId;
        if (!vId || vId.length !== 11 || vId.startsWith('RD') || vId.startsWith('PL')) continue;

        const meta = vm.metadata?.lockupMetadataViewModel;
        const rawTitle = meta?.title?.content || '';
        const rows = meta?.metadata?.contentMetadataViewModel?.metadataRows || [];
        const author = rows[0]?.metadataParts?.[0]?.text?.content || 'YouTube Music';
        const thumb =
          vm.contentImage?.thumbnailViewModel?.image?.sources?.[0]?.url ||
          `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

        if (rawTitle && vId) {
          tracks.push({
            id: `yt-${vId}`,
            title: cleanTrackTitle(rawTitle),
            artist: author,
            album: 'YouTube Music',
            duration: 240,
            audioUrl: `https://www.youtube.com/watch?v=${vId}`,
            youtubeVideoId: vId,
            artworkUrl: thumb,
            source: 'youtube',
            requestedBy: '',
            addedAt: Date.now(),
            priority: 'staff_normal',
            isOfficial: OFFICIAL_LABELS_REGEX.test(author),
          });
        }
      }
      // 2. Classic compactVideoRenderer
      else if (item?.compactVideoRenderer) {
        const r = item.compactVideoRenderer;
        const vId = r.videoId;
        if (!vId || vId.length !== 11 || vId.startsWith('RD') || vId.startsWith('PL')) continue;

        const rawTitle = r.title?.simpleText || r.title?.runs?.[0]?.text || '';
        const author = r.shortBylineText?.runs?.[0]?.text || 'YouTube Music';
        const thumb = r.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`;

        let durationSec = 240;
        const durText = r.lengthText?.simpleText || '';
        if (durText) {
          const parts = durText.split(':').map(Number);
          if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
          else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        if (rawTitle && vId) {
          tracks.push({
            id: `yt-${vId}`,
            title: cleanTrackTitle(rawTitle),
            artist: author,
            album: 'YouTube Music',
            duration: durationSec,
            audioUrl: `https://www.youtube.com/watch?v=${vId}`,
            youtubeVideoId: vId,
            artworkUrl: thumb,
            source: 'youtube',
            requestedBy: '',
            addedAt: Date.now(),
            priority: 'staff_normal',
            isOfficial: OFFICIAL_LABELS_REGEX.test(author),
          });
        }
      }
    }

    return tracks;
  } catch (err) {
    console.warn('[YouTube Watch Next] Error:', err);
    return [];
  }
}

async function refreshAutoPlayMix(track: SongTrack | null, forceReplace = false) {
  try {
    const isMoodMix = Boolean(stationState.settings.moodMixEnabled);
    const targetTrack = track || (stationState.playedHistory.length > 0 ? stationState.playedHistory[0] : null);

    const manualQueue = [...stationState.adminQueue, ...stationState.staffQueue];
    const excludePool = [...manualQueue, ...stationState.playedHistory];

    let candidates: SongTrack[] = [];

    if (isMoodMix && targetTrack) {
      const cleanTitle = cleanTrackTitle(targetTrack.title || '');
      const isLabel = OFFICIAL_LABELS_REGEX.test(targetTrack.artist || '');
      const displayArtist = isLabel ? '' : (targetTrack.artist || '').trim();

      // Clean, human-readable radio mix label (never display music labels like T-Series)
      if (displayArtist && displayArtist !== 'YouTube Music') {
        stationState.settings.detectedMood = `✨ ${displayArtist} Radio Mix`;
      } else {
        const moodInfo = detectTrackMoodAndGenre(targetTrack);
        stationState.settings.detectedMood = moodInfo.moodLabel;
      }

      // 1. PRIMARY ENGINE: Native YouTube "Watch Next" Radio Pipeline
      const videoId =
        targetTrack.youtubeVideoId ||
        (targetTrack.id?.startsWith('yt-') ? targetTrack.id.replace('yt-', '') : null);

      if (videoId) {
        console.log(`[Auto-Mix Engine] Fetching Real YouTube Watch Next for Video ID "${videoId}" (${cleanTitle})...`);
        const ytNext = await fetchYouTubeWatchNext(videoId);
        if (ytNext && ytNext.length > 0) {
          console.log(`[Auto-Mix Engine] Successfully fetched ${ytNext.length} YouTube native related tracks.`);
          candidates.push(...ytNext);
        }
      }

      // 2. ENRICHMENT ENGINE: If needed, supplement with related mood/artist hits
      if (candidates.length < 15) {
        const moodInfo = detectTrackMoodAndGenre(targetTrack);
        const searchQuery = displayArtist
          ? `${displayArtist} hit songs radio`
          : moodInfo.searchQuery;
        const fetched = await searchTracksInternal(searchQuery, 'youtube', 1, 35);
        candidates.push(...fetched);
      }
    } else {
      // 📻 Default Mode (MIX: OFF): Lata Mangeshkar, Mohd. Rafi, Kishore Kumar & 90s Classics
      stationState.settings.detectedMood = '📻 Golden Era & 90s Classics';
      const randomSeed = DEFAULT_90S_SEEDS[Math.floor(Math.random() * DEFAULT_90S_SEEDS.length)];
      console.log(`[Auto-Mix Engine] Golden Era & 90s Classics (MIX: OFF) -> Query: "${randomSeed}"`);
      const fetched = await searchTracksInternal(randomSeed, 'youtube', 1, 40);
      candidates.push(...fetched);
    }

    // Filter candidate pool with deep deduplicator:
    // - Strips currentTrack completely (NEVER recommend the currently playing track!)
    // - Strips any songs in manual queues or recently played
    // - Strips duplicate uploads / lyrical / 8k versions
    // - Drops short audio (< 60s)
    const validFiltered = candidates.filter((item) => {
      if (!item || !item.id) return false;
      if ((item.duration || 0) < 60) return false;
      if (targetTrack && areTracksDuplicate(item, targetTrack)) return false;
      return true;
    });

    const existingMix = forceReplace ? [] : stationState.recommendations;
    const distinctMix = deduplicateAndDeclutterTracks(
      [...existingMix, ...validFiltered],
      35,
      targetTrack,
      excludePool
    );

    stationState.recommendations = distinctMix;

    // Fallback if low count
    if (stationState.recommendations.length < 12) {
      const fallbackQuery = 'Lata Mangeshkar Mohammed Rafi Kishore Kumar 90s evergreen songs';
      const fallback = await searchTracksInternal(fallbackQuery, 'youtube', 1, 30);
      const cleanFallback = deduplicateAndDeclutterTracks(
        [...stationState.recommendations, ...fallback.filter((f) => (f.duration || 0) >= 60)],
        35,
        targetTrack,
        excludePool
      );
      stationState.recommendations = cleanFallback;
    }

    console.log(`[Auto-Mix Engine] Final Clean Recommendations Pool: ${stationState.recommendations.length} unique tracks.`);
  } catch (err) {
    console.warn('Auto-Play Mix refresh notice:', err);
  }
}

// Kick off initial dynamic 90s recommendations fetch on server boot
setTimeout(() => {
  refreshAutoPlayMix(null);
}, 1000);

// Endpoint to fetch dynamic online recommendations (e.g. 90s Hits for Home tab)
app.get('/api/recommendations/dynamic', async (req, res) => {
  try {
    const genre = (req.query.genre as string || '90s').toLowerCase();
    let query = '90s Bollywood evergreen songs';
    if (genre === 'romantic') query = '90s hindi romantic love songs';
    else if (genre === 'kumarsanu') query = 'Kumar Sanu 90s superhit songs';
    else if (genre === 'udit') query = 'Udit Narayan 90s hit songs';
    else if (genre === 'alka') query = 'Alka Yagnik 90s hit songs';

    const rawTracks = await searchTracksInternal(query, 'youtube', 1, 30);
    const validTracks = deduplicateAndDeclutterTracks(
      rawTracks.filter((t) => (t.duration || 0) >= 60),
      25,
      stationState.currentTrack,
      [...stationState.adminQueue, ...stationState.staffQueue]
    );

    // Split into top picks and golden melodies
    const topPicks = validTracks.slice(0, 10);
    const forgottenFavorites = validTracks.slice(10, 20);

    // Also populate station recommendations if empty
    if (stationState.recommendations.length < 5) {
      stationState.recommendations = validTracks;
    }

    res.json({
      success: true,
      topPicks,
      forgottenFavorites,
      all: validTracks,
      count: validTracks.length,
    });
  } catch (err) {
    console.error('Dynamic recommendations error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
});

// Endpoint to manually or client-triggered refresh of YouTube Music Auto-Mix
app.post('/api/station/:stationId/refresh-mix', async (req, res) => {
  await refreshAutoPlayMix(stationState.currentTrack, true);
  res.json({
    success: true,
    count: stationState.recommendations.length,
    recommendations: stationState.recommendations,
    moodMixEnabled: Boolean(stationState.settings.moodMixEnabled),
    detectedMood: stationState.settings.detectedMood,
  });
});

// Endpoint to toggle or set mood mix mode (Mood & Genre vs 90s Evergreen)
app.post('/api/station/:stationId/mood-mix', async (req, res) => {
  const { enabled } = req.body || {};
  const isEnabled = typeof enabled === 'boolean'
    ? enabled
    : !Boolean(stationState.settings.moodMixEnabled);

  stationState.settings.moodMixEnabled = isEnabled;
  await refreshAutoPlayMix(stationState.currentTrack, true);
  syncStationStateToCloudDatabase();

  res.json({
    success: true,
    moodMixEnabled: isEnabled,
    detectedMood: stationState.settings.detectedMood,
    count: stationState.recommendations.length,
    recommendations: stationState.recommendations,
  });
});

// 3. Live Indian Music Search Endpoint with Full Infinite Pagination
app.get('/api/music/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  const requestedSource = (req.query.source as string || 'all').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.max(5, Math.min(60, parseInt(req.query.limit as string || '35', 10)));

  if (!query) {
    return res.json({ success: true, results: [], count: 0, page, hasMore: false });
  }

  const results = await searchTracksInternal(query, requestedSource, page, limit);
  // Ensure all results are full-length (>= 60s)
  const fullSongsOnly = results.filter((t) => (t.duration || 0) >= 60);

  res.json({
    success: true,
    results: fullSongsOnly,
    count: fullSongsOnly.length,
    hasMore: fullSongsOnly.length > 0 && page < 20,
  });
});

export interface CommunityPlaylistResult {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  videoCount?: number;
  url: string;
}

export async function searchCommunityPlaylistsInternal(query: string): Promise<CommunityPlaylistResult[]> {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return [];

  const map = new Map<string, CommunityPlaylistResult>();

  // 1. YouTube Music direct yt-search playlist lookup
  try {
    const r1 = await ytSearch(`${cleanQ} playlist`);
    if (r1 && Array.isArray(r1.playlists)) {
      for (const pl of r1.playlists) {
        if (pl.listId && !map.has(pl.listId)) {
          const rawTitle = (pl.title || '').replace(/#[\w-]+/g, '').trim();
          map.set(pl.listId, {
            id: pl.listId,
            title: rawTitle,
            author: pl.author?.name || 'YouTube Music',
            thumbnail: pl.thumbnail || pl.image || `https://i.ytimg.com/vi/${pl.listId}/hqdefault.jpg`,
            videoCount: pl.videoCount || undefined,
            url: pl.url || `https://youtube.com/playlist?list=${pl.listId}`,
          });
        }
      }
    }
  } catch (err) {
    console.warn('ytSearch playlists error:', err);
  }

  // 2. YouTube direct sp=EgIQAw%253D%253D filter lookup (Exact "Playlists" search on YouTube)
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}&sp=EgIQAw%253D%253D`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
      if (m) {
        const json = JSON.parse(m[1]);
        const contents = json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
        if (Array.isArray(contents)) {
          for (const item of contents) {
            const vm = item.lockupViewModel;
            if (!vm || !vm.contentId) continue;
            const id = vm.contentId;
            if (map.has(id)) continue;

            const title = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Community Playlist';
            const byline = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || 'YouTube Music';
            const thumb = vm.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

            // Extract video count from metadata
            let count: number | undefined = undefined;
            const metaParts = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows;
            if (Array.isArray(metaParts)) {
              for (const row of metaParts) {
                for (const part of row.metadataParts || []) {
                  const text = part.text?.content || '';
                  const numMatch = text.match(/(\d+)\s*(?:videos|songs|tracks)/i);
                  if (numMatch) {
                    count = parseInt(numMatch[1], 10);
                    break;
                  }
                }
                if (count) break;
              }
            }

            map.set(id, {
              id,
              title,
              author: byline,
              thumbnail: thumb,
              videoCount: count,
              url: `https://youtube.com/playlist?list=${id}`,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('YouTube direct playlist search error:', err);
  }

  return Array.from(map.values());
}

export async function fetchCommunityPlaylistTracksInternal(playlistId: string): Promise<{
  playlist: CommunityPlaylistResult;
  tracks: SongTrack[];
}> {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;
  const fallbackPlaylist: CommunityPlaylistResult = {
    id: playlistId,
    title: 'Community Playlist',
    author: 'YouTube Music',
    thumbnail: `https://i.ytimg.com/vi/${playlistId}/hqdefault.jpg`,
    url,
  };

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { playlist: fallbackPlaylist, tracks: [] };
    }

    const html = await res.text();
    const m = html.match(/var ytInitialData = (\{.+?\});<\/script>/);
    if (!m) {
      return { playlist: fallbackPlaylist, tracks: [] };
    }

    const json = JSON.parse(m[1]);
    const header = json.header?.playlistHeaderRenderer || json.header?.pageHeaderRenderer;
    const plTitle = header?.title?.simpleText || header?.pageTitle || fallbackPlaylist.title;
    const plOwner = header?.ownerText?.runs?.[0]?.text || fallbackPlaylist.author;
    const plThumb = header?.playlistHeaderBanner?.sources?.[0]?.url || fallbackPlaylist.thumbnail;

    const playlistInfo: CommunityPlaylistResult = {
      id: playlistId,
      title: plTitle,
      author: plOwner,
      thumbnail: plThumb,
      url,
    };

    const sec = json.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    const tracks: SongTrack[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(sec)) {
      for (const item of sec) {
        const vm = item.lockupViewModel;
        if (!vm || !vm.contentId) continue;
        const videoId = vm.contentId;
        if (seenIds.has(videoId)) continue;

        const rawTitle = vm.metadata?.lockupMetadataViewModel?.title?.content || 'YouTube Track';
        const title = cleanTrackTitle(rawTitle);

        const thumbs = vm.contentImage?.thumbnailViewModel?.image?.sources || [];
        const artworkUrl = thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        const overlays = vm.contentImage?.thumbnailViewModel?.overlays || [];
        let durationText = '3:30';
        for (const ov of overlays) {
          const t = ov.thumbnailOverlayTimeStatusViewModel?.text;
          if (t) {
            durationText = t;
            break;
          }
        }
        const parts = durationText.split(':').map(Number);
        let secCount = 210;
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          secCount = parts[0] * 60 + parts[1];
        } else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          secCount = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        if (secCount < 45 || rawTitle.toLowerCase().includes('#shorts')) {
          continue;
        }

        seenIds.add(videoId);
        tracks.push({
          id: `yt-${videoId}`,
          title,
          artist: plOwner || 'YouTube Music',
          album: plTitle,
          duration: secCount,
          audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
          youtubeVideoId: videoId,
          artworkUrl,
          source: 'youtube',
          requestedBy: '',
          addedAt: Date.now(),
          priority: 'staff_normal',
          isOfficial: true,
        });
      }
    }

    // Older format fallback
    if (tracks.length === 0) {
      const altSec = json.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;
      if (Array.isArray(altSec)) {
        for (const item of altSec) {
          const pvr = item.playlistVideoRenderer;
          if (!pvr || !pvr.videoId) continue;
          const videoId = pvr.videoId;
          if (seenIds.has(videoId)) continue;

          const rawTitle = pvr.title?.runs?.[0]?.text || pvr.title?.simpleText || 'YouTube Track';
          const title = cleanTrackTitle(rawTitle);
          const author = pvr.shortBylineText?.runs?.[0]?.text || plOwner || 'YouTube Music';
          const secCount = parseInt(pvr.lengthSeconds || '210', 10);
          const artworkUrl = pvr.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

          if (secCount < 45 || rawTitle.toLowerCase().includes('#shorts')) continue;

          seenIds.add(videoId);
          tracks.push({
            id: `yt-${videoId}`,
            title,
            artist: author,
            album: plTitle,
            duration: secCount,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
            youtubeVideoId: videoId,
            artworkUrl,
            source: 'youtube',
            requestedBy: '',
            addedAt: Date.now(),
            priority: 'staff_normal',
            isOfficial: true,
          });
        }
      }
    }

    playlistInfo.videoCount = tracks.length;
    return { playlist: playlistInfo, tracks };
  } catch (err) {
    console.warn('Error parsing playlist tracks:', err);
    return { playlist: fallbackPlaylist, tracks: [] };
  }
}

// 4. YouTube Community Playlists Search Endpoint (Matches YouTube "Community playlists" button)
app.get('/api/music/playlists/search', async (req, res) => {
  const query = (req.query.q as string || '').trim();
  if (!query) {
    return res.json({ success: true, playlists: [] });
  }

  try {
    const playlists = await searchCommunityPlaylistsInternal(query);
    res.json({ success: true, playlists, count: playlists.length });
  } catch (err) {
    console.warn('Playlist search error:', err);
    res.json({ success: false, playlists: [], error: 'Failed to search community playlists' });
  }
});

// 5. YouTube Community Playlist Tracks Endpoint
app.get('/api/music/playlists/:id/tracks', async (req, res) => {
  const playlistId = (req.params.id || '').trim();
  if (!playlistId) {
    return res.json({ success: false, tracks: [], error: 'Missing playlist ID' });
  }

  try {
    const result = await fetchCommunityPlaylistTracksInternal(playlistId);
    res.json({
      success: true,
      playlist: result.playlist,
      tracks: result.tracks,
      count: result.tracks.length,
    });
  } catch (err) {
    console.warn('Playlist tracks fetch error:', err);
    res.json({ success: false, tracks: [], error: 'Failed to load playlist tracks' });
  }
});

// AI Smart Music Discovery with Google Search Grounding (gemini-3.8-flash)
app.post('/api/music/ai-discover', async (req, res) => {
  const { prompt } = req.body;
  const userPrompt = (prompt || '').trim() || 'trending top songs in India today';
  const cacheKey = userPrompt.toLowerCase().trim();

  // 1. Check in-memory cache (valid for 15 minutes)
  const cached = aiDiscoverCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return res.json(cached.payload);
  }

  // 2. If in quota cooldown or missing API key, serve from catalog search gracefully
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyAvailable = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  const isCooldownActive = Date.now() < geminiQuotaCooldownUntil;

  if (!isKeyAvailable || isCooldownActive) {
    try {
      const fallbackTracks = await searchTracksInternal(userPrompt, 'all', 1, 12);
      const fallbackPayload = {
        success: true,
        summary: `Curated trending music for "${userPrompt}"`,
        tracks: fallbackTracks,
      };
      aiDiscoverCache.set(cacheKey, { timestamp: Date.now(), payload: fallbackPayload });
      return res.json(fallbackPayload);
    } catch {
      return res.json({ success: true, tracks: [], summary: 'No results found' });
    }
  }

  try {
    const systemInstruction = `You are a real-time music discovery expert. Use Google Search to find current, trending, accurate, or matching songs for the user's request.
Return a clean JSON array of up to 6 songs with format:
[
  { "title": "Song Title", "artist": "Singer/Composer Name", "description": "Short 1-line vibe or movie context" }
]
Only return the valid JSON array without any markdown formatting or code blocks.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Find popular/trending songs for this request: "${userPrompt}". Search the web for current and accurate info.`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });

    const textOutput = (response.text || '').trim();
    let parsedSongs: Array<{ title: string; artist: string; description?: string }> = [];

    try {
      const cleaned = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedSongs = JSON.parse(cleaned);
    } catch {
      const match = textOutput.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsedSongs = JSON.parse(match[0]);
        } catch {
          // ignore
        }
      }
    }

    if (!Array.isArray(parsedSongs) || parsedSongs.length === 0) {
      const fallbackTracks = await searchTracksInternal(userPrompt, 'all', 1, 10);
      const payload = {
        success: true,
        summary: `Live search results for "${userPrompt}"`,
        tracks: fallbackTracks,
      };
      aiDiscoverCache.set(cacheKey, { timestamp: Date.now(), payload });
      return res.json(payload);
    }

    // Resolve each grounded song to a fully playable track in parallel
    const playableTracks: SongTrack[] = [];
    const seenIds = new Set<string>();
    await Promise.all(
      parsedSongs.slice(0, 6).map(async (item) => {
        const query = `${item.title} ${item.artist}`;
        const searchResults = await searchTracksInternal(query, 'all', 1, 2);
        if (searchResults.length > 0) {
          const track = searchResults[0];
          if (!seenIds.has(track.id)) {
            seenIds.add(track.id);
            if (item.description) {
              track.album = item.description;
            }
            playableTracks.push(track);
          }
        }
      })
    );

    const resultPayload = {
      success: true,
      summary: `Google Search grounded recommendations for "${userPrompt}"`,
      tracks: playableTracks,
      groundedSongs: parsedSongs,
    };
    aiDiscoverCache.set(cacheKey, { timestamp: Date.now(), payload: resultPayload });
    return res.json(resultPayload);
  } catch (err: any) {
    // Graceful handling of 429 quota exhaustion or API rate limits
    const isQuotaError =
      err?.status === 'RESOURCE_EXHAUSTED' ||
      err?.code === 429 ||
      err?.message?.includes('429') ||
      err?.message?.includes('quota');

    if (isQuotaError) {
      // Cooldown for 2 minutes to prevent repeated rejected calls
      geminiQuotaCooldownUntil = Date.now() + 120_000;
    }

    try {
      const fallback = await searchTracksInternal(userPrompt, 'all', 1, 12);
      const fallbackPayload = {
        success: true,
        summary: `Curated music for "${userPrompt}"`,
        tracks: fallback,
      };
      aiDiscoverCache.set(cacheKey, { timestamp: Date.now(), payload: fallbackPayload });
      return res.json(fallbackPayload);
    } catch {
      return res.json({ success: true, tracks: [], summary: 'No results found' });
    }
  }
});

// 4. Promo Audio Upload Endpoint (MP3 / WAV / Base64 Data URL) with Cloud Disk Storage
app.post('/api/promo/upload', (req, res) => {
  try {
    const { id, title, categoryId, audioUrl, duration, scriptSnippet } = req.body;
    if (!title || !audioUrl) {
      return res.status(400).json({ success: false, message: 'Title aur Audio data zaroori hai.' });
    }

    const trimmedTitle = title.trim();

    // Check if promo with same ID or exact title already exists
    const existingPromoIdx = stationState.promos.findIndex(
      (p) => (id && p.id === id) || p.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );

    let finalAudioUrl = audioUrl.trim();
    let isCloudSaved = false;
    let fileSizeBytes: number | undefined = undefined;
    let storageType: 'cloud' | 'preset' | 'custom' = 'custom';
    let fileName: string | undefined = undefined;

    // If Base64 or Data URL, save to persistent storage
    if (finalAudioUrl.startsWith('data:') || finalAudioUrl.length > 500) {
      try {
        const savedFile = saveAudioFromDataUrl(finalAudioUrl, trimmedTitle);
        finalAudioUrl = savedFile.audioUrl;
        isCloudSaved = true;
        fileSizeBytes = savedFile.sizeBytes;
        storageType = 'cloud';
        fileName = savedFile.filename;
      } catch (e) {
        console.error('Error saving audio to cloud storage:', e);
      }
    }

    if (existingPromoIdx !== -1) {
      // Update existing promo instead of creating duplicates
      const updatedPromo: PromoClip = {
        ...stationState.promos[existingPromoIdx],
        title: trimmedTitle,
        categoryId: categoryId || stationState.promos[existingPromoIdx].categoryId,
        audioUrl: finalAudioUrl,
        duration: Number(duration) || stationState.promos[existingPromoIdx].duration || 15,
        scriptSnippet: scriptSnippet?.trim() || stationState.promos[existingPromoIdx].scriptSnippet,
        isCloudSaved: isCloudSaved || stationState.promos[existingPromoIdx].isCloudSaved,
        fileSizeBytes: fileSizeBytes || stationState.promos[existingPromoIdx].fileSizeBytes,
        storageType: storageType || stationState.promos[existingPromoIdx].storageType,
        fileName: fileName || stationState.promos[existingPromoIdx].fileName,
      };

      stationState.promos[existingPromoIdx] = updatedPromo;
      syncStationStateToCloudDatabase();

      return res.json({
        success: true,
        promo: updatedPromo,
        stationState,
        message: 'Promo audio update aur permanently save ho gaya hai.',
      });
    }

    const newPromo: PromoClip = {
      id: id || `promo-upload-${Date.now()}`,
      title: trimmedTitle,
      categoryId: categoryId || stationState.categories[0]?.id || 'cat-xp95',
      audioUrl: finalAudioUrl,
      duration: Number(duration) || 15,
      enabled: true,
      playsCount: 0,
      scriptSnippet: scriptSnippet?.trim() || 'Custom Forecourt Announcement',
      isCloudSaved,
      fileSizeBytes,
      storageType,
      fileName,
      uploadedAt: Date.now(),
    };

    stationState.promos.push(newPromo);
    // User imported audio: automatically enable promos on station
    stationState.settings.promosEnabled = true;
    for (const st of stationState.stations) {
      if (st.id === stationState.stationId) {
        st.promosEnabled = true;
      }
    }
    syncStationStateToCloudDatabase();

    return res.json({
      success: true,
      promo: newPromo,
      stationState,
      message: 'Promo audio cloud storage me permanently save ho gaya hai.',
    });
  } catch (err) {
    console.error('Promo upload error:', err);
    return res.status(500).json({ success: false, message: 'Promo upload fail ho gaya.' });
  }
});

// Dedicated Cloud Storage Restore Sync Endpoint (Self-Healing from IndexedDB)
app.post('/api/storage/promos/sync-restore', (req, res) => {
  try {
    const { promos } = req.body;
    if (!Array.isArray(promos) || promos.length === 0) {
      return res.json({ success: true, restoredCount: 0, promos: stationState.promos });
    }

    let restoredCount = 0;

    for (const item of promos) {
      const existingIdx = stationState.promos.findIndex(
        (p) => (item.id && p.id === item.id) || (item.title && p.title.trim().toLowerCase() === item.title.trim().toLowerCase())
      );

      if (existingIdx !== -1) {
        continue; // Already present on server
      }

      let finalAudioUrl = item.audioUrl || '';
      let isCloudSaved = Boolean(item.isCloudSaved);
      let fileSizeBytes = item.fileSizeBytes;
      let storageType: 'cloud' | 'preset' | 'custom' = item.storageType || 'cloud';
      let fileName = item.fileName;

      // If client provided raw audio data (Base64), write to server disk so streaming works
      if (item.audioData && (item.audioData.startsWith('data:') || item.audioData.length > 500)) {
        try {
          const savedFile = saveAudioFromDataUrl(item.audioData, item.title || 'restored_promo');
          finalAudioUrl = savedFile.audioUrl;
          isCloudSaved = true;
          fileSizeBytes = savedFile.sizeBytes;
          storageType = 'cloud';
          fileName = savedFile.filename;
        } catch (e) {
          console.error('[SyncRestore] Error writing audio to server disk:', e);
        }
      }

      const restoredPromo: PromoClip = {
        id: item.id || `promo-restored-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: item.title,
        categoryId: item.categoryId || stationState.categories[0]?.id || 'cat-xp95',
        audioUrl: finalAudioUrl,
        duration: Number(item.duration) || 15,
        enabled: item.enabled ?? true,
        playsCount: Number(item.playsCount) || 0,
        scriptSnippet: item.scriptSnippet || item.title,
        isCloudSaved,
        fileSizeBytes,
        storageType,
        fileName,
        uploadedAt: item.uploadedAt || Date.now(),
      };

      stationState.promos.push(restoredPromo);
      restoredCount += 1;
    }

    if (restoredCount > 0) {
      stationState.settings.promosEnabled = true;
      for (const st of stationState.stations) {
        st.promosEnabled = true;
      }
      syncStationStateToCloudDatabase();
      console.log(`[SyncRestore] Successfully restored ${restoredCount} promo(s) to server database.`);
    }

    return res.json({
      success: true,
      restoredCount,
      promos: stationState.promos,
      message: `${restoredCount} promo(s) restored to server database successfully.`,
    });
  } catch (err) {
    console.error('[SyncRestore] Error syncing promos to server:', err);
    return res.status(500).json({ success: false, message: 'Restore sync failed.' });
  }
});

// 5. Dedicated Cloud Storage Endpoints
app.post('/api/storage/promos/upload', (req, res) => {
  try {
    const { title, categoryId, dataUrl, duration, scriptSnippet } = req.body;
    if (!dataUrl) {
      return res.status(400).json({ success: false, message: 'Audio data required' });
    }

    const promoTitle = (title || 'Forecourt Promo Audio').trim();
    const saved = saveAudioFromDataUrl(dataUrl, promoTitle);

    const newPromo: PromoClip = {
      id: `promo-cloud-${Date.now()}`,
      title: promoTitle,
      categoryId: categoryId || stationState.categories[0]?.id || 'cat-xp95',
      audioUrl: saved.audioUrl,
      duration: Number(duration) || 15,
      enabled: true,
      playsCount: 0,
      scriptSnippet: (scriptSnippet || promoTitle).trim(),
      isCloudSaved: true,
      fileSizeBytes: saved.sizeBytes,
      storageType: 'cloud',
      fileName: saved.filename,
      uploadedAt: Date.now(),
    };

    stationState.promos.push(newPromo);
    // User imported audio: automatically enable promos on station
    stationState.settings.promosEnabled = true;
    for (const st of stationState.stations) {
      if (st.id === stationState.stationId) {
        st.promosEnabled = true;
      }
    }
    syncStationStateToCloudDatabase();

    res.json({
      success: true,
      promo: newPromo,
      cloudUrl: saved.audioUrl,
      fileSizeBytes: saved.sizeBytes,
      message: 'Cloud Storage me promo audio permanently save ho chuka hai.',
    });
  } catch (err) {
    console.error('Cloud promo upload error:', err);
    res.status(500).json({ success: false, message: 'Upload to cloud storage failed.' });
  }
});

// Stream Stored Cloud Promo Audio File (with HTTP 206 Range requests for seamless playback)
app.get('/api/storage/promos/:filename', (req, res) => {
  try {
    streamAudioFile(req, res, req.params.filename);
  } catch (err) {
    console.error('Audio streaming error:', err);
    res.status(500).end();
  }
});

// Cloud Storage Metrics & Health Status
app.get('/api/storage/status', (_req, res) => {
  const status = getCloudStorageStatus(stationState.promos, stationState.stations.length);
  res.json({ success: true, data: status });
});

// Download Complete Cloud Database Backup
app.get('/api/storage/backup', (_req, res) => {
  res.json({
    success: true,
    timestamp: Date.now(),
    database: {
      version: 1,
      lastSaved: Date.now(),
      adminPin: stationState.adminPin,
      stations: stationState.stations,
      categories: stationState.categories,
      promos: stationState.promos,
      settings: stationState.settings,
    },
  });
});

// Restore Factory Default Promos to Cloud Storage
app.post('/api/storage/restore-defaults', (_req, res) => {
  stationState.categories = DEFAULT_CATEGORIES;
  stationState.promos = DEFAULT_PROMOS;
  stationState.settings = { ...DEFAULT_SETTINGS };
  syncStationStateToCloudDatabase();
  res.json({
    success: true,
    message: 'Default official IndianOil promo announcements restored to cloud storage.',
    data: stationState,
  });
});

// Automatically seed initial 90s Indian music recommendations so queue is always 90s hits by default
async function seedInitialStationRecommendations() {
  try {
    const initialHits = await searchTracksInternal('90s Bollywood evergreen superhit songs', 'youtube', 1, 20);
    if (initialHits.length > 0) {
      stationState.recommendations = initialHits;
      console.log(`[Auto-Mix] Successfully primed ${initialHits.length} 90s evergreen tracks in station recommendations queue.`);
      if (!stationState.currentTrack) {
        stationState.currentTrack = stationState.recommendations.shift()!;
        stationState.playbackState.isPlaying = false;
        stationState.playbackState.currentTime = 0;
      }
    }
  } catch (err) {
    console.warn('[Auto-Mix] Initial recommendations seed notice:', err);
  }
}

// -------------------------------------------------------------
// Vite Server Integration
// -------------------------------------------------------------
async function startServer() {
  const server = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(port, () => {
    console.log(`Sangeet Forecourt Radio Server listening on port ${port}`);
    // Prime station queue in background so tracks are always ready to play
    seedInitialStationRecommendations();
  });
}

startServer();
