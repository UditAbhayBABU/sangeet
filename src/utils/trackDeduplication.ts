import { SongTrack } from '../types';

/**
 * Strips all superficial clutter from raw song titles (8K, 4K, hashtags, brackets, channel trailers, emojis).
 */
export function cleanTrackTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let t = rawTitle;
  // Remove emojis
  t = t.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  // Remove hashtags
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

/**
 * Extracts a normalized core phonetic/token signature of a song.
 * Strips noise, video formats, actors, channels, and special characters.
 * E.g., "Dil Jhoom 8K Video Song: Vidyut Jammwal, Nora Fatehi" -> "dil jhoom"
 */
export function extractCoreSignature(title: string, artist: string = ''): string {
  let text = (title || '').toLowerCase();
  // Remove emojis
  text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ');
  // Remove hashtags
  text = text.replace(/#[\w-]+/g, ' ');
  // Remove brackets and parentheses
  text = text.replace(/\[.*?\]/g, ' ').replace(/\(.*?\)/g, ' ');

  const noiseWords = [
    '8k', '4k', '2k', 'hd', 'hq', '1080p', '720p', '480p', '60fps',
    'video', 'audio', 'song', 'songs', 'lyrical', 'lyrics', 'lyric', 'official',
    'teaser', 'trailer', 'promo', 'full', 'extended', 'original', 'remix', 'dj',
    'slowed', 'reverb', 'status', 'reels', 'shorts', 'remake', 'cover', 'mashup',
    'jukebox', 'nonstop', 'non stop', 'visualizer', 'soundtrack', 'tseries', 't-series',
    'zee music', 'tips', 'sony music', 'yrf', 'saregama', 'music by', 'murvex',
    'vidyut jammwal', 'nora fatehi', 'vidyut', 'nora', 'crakk'
  ];

  for (const n of noiseWords) {
    text = text.replace(new RegExp(`\\b${n}\\b`, 'gi'), ' ');
  }

  // Keep alphanumeric and Indic Unicode scripts
  text = text.replace(/[^a-z0-9\u0900-\u097F]/gi, ' ').replace(/\s+/g, ' ').trim();

  if (text.length < 3) {
    text = (title || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F]/gi, '').slice(0, 18);
  }

  return text;
}

/**
 * Checks if two tracks represent the same underlying song or duplicate upload.
 */
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

/**
 * Deduplicates and de-clutters a track list, strictly excluding the currently playing track
 * and any tracks already present in the active manual queues.
 */
export function deduplicateTrackList(
  tracks: SongTrack[],
  currentTrack?: SongTrack | null,
  existingQueue?: SongTrack[],
  limit = 40
): SongTrack[] {
  const result: SongTrack[] = [];

  for (const track of tracks) {
    if (!track) continue;

    // Never include the track currently playing!
    if (currentTrack && areTracksDuplicate(track, currentTrack)) {
      continue;
    }

    // Never include tracks already in manual queues!
    if (existingQueue && existingQueue.some((q) => areTracksDuplicate(track, q))) {
      continue;
    }

    // Never include a duplicate of an already accepted track in this list!
    if (result.some((r) => areTracksDuplicate(track, r))) {
      continue;
    }

    result.push(track);
    if (result.length >= limit) break;
  }

  return result;
}
