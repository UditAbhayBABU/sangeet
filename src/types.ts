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
  promoRepetitions?: number;
  activeCategoryFilter: string; // 'all' or categoryId
  duckingMode?: 'db' | 'percent';
  duckingDb?: number; // Decibel ducking, e.g. -20 dB or -26 dB
  duckingVolumePercent: number; // Percentage ducking, e.g. 18%
  fadeDurationSeconds?: number; // Fade lead-in duration in seconds, e.g. 1.5s
  selectedPromoClipIds?: string[];
  crossfadeSeconds?: number;
  loopMode?: 'none' | 'all' | 'one';
  isShuffleEnabled?: boolean;
}

export interface HandoverRequest {
  id: string;
  requesterDeviceId: string;
  requesterDeviceName: string;
  requestedAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'admin_takeover';
  targetPreviousSpeakerId?: string;
}

export interface StationSettings {
  promoIntervalType: 'songs_count' | 'time_interval';
  promoSongInterval: number;
  promoTimeIntervalMinutes: number;
  promoRepetitions?: number;
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
  masterVolume?: number; // 0 to 100%
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
  settings: StationSettings;
  speaker: {
    activeDeviceId: string;
    activeDeviceName: string;
    lastHeartbeat: number;
  };
  connectedDevices?: ConnectedDevice[];
  handoverRequest?: HandoverRequest | null;
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
