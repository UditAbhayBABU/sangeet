import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  promosEnabled: boolean;
  pinRequired?: boolean;
  stationPin?: string;
  allowedSources?: 'all' | 'youtube' | 'saavn';
  promoIntervalType: 'songs_count' | 'time_interval';
  promoSongInterval: number;
  promoTimeIntervalMinutes: number;
  promoRepetitions?: number;
  activeCategoryFilter: string;
  duckingMode?: 'db' | 'percent';
  duckingDb?: number;
  duckingVolumePercent: number;
  fadeDurationSeconds?: number;
  loopMode?: 'none' | 'all' | 'one';
  isShuffleEnabled?: boolean;
}

export interface StoredDatabaseState {
  version: number;
  lastSaved: number;
  adminPin: string;
  stations: StationItem[];
  categories: PromoCategory[];
  promos: PromoClip[];
  settings: {
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
    loopMode?: 'none' | 'all' | 'one';
    isShuffleEnabled?: boolean;
    masterVolume?: number;
  };
  likedTracks?: Record<string, any[]>;
}

// Storage Directories
export const DATA_DIR = path.resolve(__dirname, 'data');
export const PROMOS_UPLOAD_DIR = path.join(DATA_DIR, 'uploads', 'promos');
export const DB_FILE_PATH = path.join(DATA_DIR, 'station_database.json');

// Ensure directories exist
export function initStorageDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROMOS_UPLOAD_DIR)) {
    fs.mkdirSync(PROMOS_UPLOAD_DIR, { recursive: true });
  }
}

// Initial default categories
export const DEFAULT_CATEGORIES: PromoCategory[] = [
  { id: 'cat-xp95', name: 'XP95 Petrol', description: 'XP95 High Octane Fuel Promotion', color: '#f37021' },
  { id: 'cat-servo', name: 'SERVO 4T Oil', description: 'SERVO Engine Lubricants Promotion', color: '#004b87' },
  { id: 'cat-safety', name: 'Safety Norms', description: 'Forecourt Safety Rules', color: '#dc2626' },
  { id: 'cat-rewards', name: 'XTRAREWARDS', description: 'IndianOil Rewards & Loyalty App', color: '#16a34a' },
  { id: 'cat-services', name: 'Pump Facilities', description: 'Free Air, Water & Clean Toilets', color: '#8b5cf6' },
];

// Initial default official promos (all clips turned OFF by default as requested)
export const DEFAULT_PROMOS: PromoClip[] = [
  {
    id: 'promo-1',
    title: 'XP95 High Octane Promotion',
    categoryId: 'cat-xp95',
    audioUrl: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
    duration: 15,
    enabled: false,
    playsCount: 0,
    scriptSnippet: 'Engine ko dein behtareen mileage aur instant pickup with IndianOil XP95 Petrol!',
    isCloudSaved: true,
    storageType: 'preset',
    uploadedAt: Date.now(),
  },
  {
    id: 'promo-2',
    title: 'SERVO 4T Engine Oil Offer',
    categoryId: 'cat-servo',
    audioUrl: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
    duration: 18,
    enabled: false,
    playsCount: 0,
    scriptSnippet: 'Engine ki lambi umar aur smooth ride ke liye chunein SERVO 4T Engine Oil.',
    isCloudSaved: true,
    storageType: 'preset',
    uploadedAt: Date.now(),
  },
  {
    id: 'promo-3',
    title: 'Forecourt Safety - Switch Off Engine',
    categoryId: 'cat-safety',
    audioUrl: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
    duration: 12,
    enabled: false,
    playsCount: 0,
    scriptSnippet: 'Fuel bharwate samay gaadi ka engine aur mobile phone switch off rakhein.',
    isCloudSaved: true,
    storageType: 'preset',
    uploadedAt: Date.now(),
  },
  {
    id: 'promo-4',
    title: 'XTRAREWARDS App Loyalty Points',
    categoryId: 'cat-rewards',
    audioUrl: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
    duration: 14,
    enabled: false,
    playsCount: 0,
    scriptSnippet: 'Har petrol diesel refill par paiye points aur redeem kijiye attractive discounts!',
    isCloudSaved: true,
    storageType: 'preset',
    uploadedAt: Date.now(),
  },
];

export const DEFAULT_STATIONS: StationItem[] = [
  {
    id: 'station-msd',
    name: 'Maa Sumitra Devi F.S.',
    promosEnabled: true,
    promoIntervalType: 'time_interval',
    promoSongInterval: 2,
    promoTimeIntervalMinutes: 1,
    promoRepetitions: 2,
    activeCategoryFilter: 'all',
    duckingMode: 'db',
    duckingDb: -25,
    duckingVolumePercent: 18,
    fadeDurationSeconds: 1,
    stationPin: '2006',
    pinRequired: false,
    allowedSources: 'all',
    loopMode: 'none' as const,
    isShuffleEnabled: false,
  },
];

export const DEFAULT_SETTINGS = {
  promoIntervalType: 'time_interval' as const,
  promoSongInterval: 2,
  promoTimeIntervalMinutes: 1,
  promoRepetitions: 2,
  activeCategoryFilter: 'all',
  duckingMode: 'db' as const,
  duckingDb: -25,
  duckingVolumePercent: 18,
  fadeDurationSeconds: 1,
  crossfadeSeconds: 1.5,
  promosEnabled: true,
  autoMixEnabled: true,
  moodMixEnabled: false,
  detectedMood: '📻 90s Evergreen Hits (Default)',
  loopMode: 'none' as const,
  isShuffleEnabled: false,
};

/**
 * Load Database from disk. If not found or invalid, returns fresh default state and saves it.
 */
export function loadDatabase(): StoredDatabaseState {
  initStorageDirectories();
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.stations) && Array.isArray(parsed.promos)) {
        console.log(`[Cloud Storage] Successfully loaded database from ${DB_FILE_PATH}. Stored Promos: ${parsed.promos.length}, Stations: ${parsed.stations.length}`);
        return {
          version: parsed.version || 1,
          lastSaved: parsed.lastSaved || Date.now(),
          adminPin: parsed.adminPin || '2006',
          stations: parsed.stations.length > 0 ? parsed.stations : DEFAULT_STATIONS,
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : DEFAULT_CATEGORIES,
          promos: parsed.promos.length > 0 ? parsed.promos : DEFAULT_PROMOS,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          likedTracks: parsed.likedTracks && typeof parsed.likedTracks === 'object' ? parsed.likedTracks : {},
        };
      }
    }
  } catch (err) {
    console.error('[Cloud Storage] Error reading database file, re-initializing defaults:', err);
  }

  const defaultDb: StoredDatabaseState = {
    version: 1,
    lastSaved: Date.now(),
    adminPin: '2006',
    stations: DEFAULT_STATIONS,
    categories: DEFAULT_CATEGORIES,
    promos: DEFAULT_PROMOS,
    settings: DEFAULT_SETTINGS,
    likedTracks: {},
  };

  saveDatabase(defaultDb);
  return defaultDb;
}

/**
 * Atomically writes database to disk
 */
export function saveDatabase(state: StoredDatabaseState): boolean {
  try {
    initStorageDirectories();
    const dataToSave: StoredDatabaseState = {
      ...state,
      lastSaved: Date.now(),
    };
    const tempFile = `${DB_FILE_PATH}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE_PATH);
    return true;
  } catch (err) {
    console.error('[Cloud Storage] Failed to save database to disk:', err);
    return false;
  }
}

/**
 * Save audio binary from Data URL or Base64 string to persistent cloud storage
 */
export function saveAudioFromDataUrl(
  dataUrlOrBase64: string,
  preferredTitle: string
): { filename: string; audioUrl: string; sizeBytes: number; extension: string } {
  initStorageDirectories();

  let base64Data = dataUrlOrBase64;
  let ext = 'mp3';

  if (dataUrlOrBase64.startsWith('data:')) {
    const matches = dataUrlOrBase64.match(/^data:audio\/([a-zA-Z0-9.+_-]+);base64,(.+)$/);
    if (matches && matches[2]) {
      const mimeSub = matches[1].toLowerCase();
      if (mimeSub.includes('wav')) ext = 'wav';
      else if (mimeSub.includes('ogg')) ext = 'ogg';
      else if (mimeSub.includes('aac')) ext = 'aac';
      else if (mimeSub.includes('m4a') || mimeSub.includes('mp4')) ext = 'm4a';
      else ext = 'mp3';
      base64Data = matches[2];
    } else {
      // General base64 split
      const parts = dataUrlOrBase64.split(';base64,');
      if (parts.length === 2) {
        base64Data = parts[1];
      }
    }
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const safeName = preferredTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 24);
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const filename = `promo_${safeName}_${uniqueId}.${ext}`;
  const targetPath = path.join(PROMOS_UPLOAD_DIR, filename);

  fs.writeFileSync(targetPath, buffer);
  const sizeBytes = buffer.length;

  console.log(`[Cloud Storage] Saved audio file to disk: ${filename} (${(sizeBytes / 1024).toFixed(1)} KB)`);

  return {
    filename,
    audioUrl: `/api/storage/promos/${filename}`,
    sizeBytes,
    extension: ext,
  };
}

/**
 * Audio streaming with HTTP Range (206 Partial Content) support for smooth mobile/desktop streaming
 */
export function streamAudioFile(req: Request, res: Response, filename: string) {
  const safeFilename = path.basename(filename);
  const filePath = path.join(PROMOS_UPLOAD_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found in cloud storage' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(safeFilename).toLowerCase();

  let contentType = 'audio/mpeg';
  if (ext === '.wav') contentType = 'audio/wav';
  else if (ext === '.ogg') contentType = 'audio/ogg';
  else if (ext === '.m4a') contentType = 'audio/mp4';
  else if (ext === '.aac') contentType = 'audio/aac';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * Calculate total Cloud Storage Metrics
 */
export function getCloudStorageStatus(promos: PromoClip[], stationsCount: number) {
  initStorageDirectories();
  let totalSizeBytes = 0;
  let cloudFilesCount = 0;

  try {
    if (fs.existsSync(PROMOS_UPLOAD_DIR)) {
      const files = fs.readdirSync(PROMOS_UPLOAD_DIR);
      cloudFilesCount = files.length;
      for (const file of files) {
        try {
          const st = fs.statSync(path.join(PROMOS_UPLOAD_DIR, file));
          totalSizeBytes += st.size;
        } catch {
          // ignore individual stat error
        }
      }
    }
  } catch (err) {
    console.error('Error scanning promo upload dir:', err);
  }

  const dbExists = fs.existsSync(DB_FILE_PATH);
  let dbSizeBytes = 0;
  let lastSaved = Date.now();
  if (dbExists) {
    try {
      const dbStat = fs.statSync(DB_FILE_PATH);
      dbSizeBytes = dbStat.size;
      lastSaved = dbStat.mtimeMs;
    } catch {
      // ignore
    }
  }

  return {
    isCloudReady: true,
    storageHealthy: true,
    totalPromosCount: promos.length,
    cloudFilesCount,
    totalSizeBytes,
    totalSizeReadable: totalSizeBytes > 1024 * 1024 
      ? `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(totalSizeBytes / 1024).toFixed(1)} KB`,
    databaseSizeBytes: dbSizeBytes,
    databaseSaved: dbExists,
    stationsCount,
    lastSavedAt: lastSaved,
    statusText: 'All Settings & Promo Audio saved permanently to Cloud Storage. No re-upload required.',
  };
}
