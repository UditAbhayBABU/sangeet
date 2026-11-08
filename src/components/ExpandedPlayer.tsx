import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ChevronDown,
  Volume2,
  VolumeX,
  Search,
  Plus,
  Trash2,
  Radio,
  Disc3,
  ListMusic,
  Sparkles,
  GripVertical,
  ArrowUp,
  ArrowDown,
  History,
  Check,
  X,
  Shuffle,
  Repeat
} from 'lucide-react';
import { SongTrack, PromoClip, StationSettings } from '../types';
import { AppleArtwork } from './common/AppleArtwork';
import { AppleSlider } from './common/AppleSlider';
import { getMoodTheme } from '../utils/moodTheme';
import { deduplicateTrackList } from '../utils/trackDeduplication';

interface ExpandedPlayerProps {
  currentTrack: SongTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isPromoPlaying: boolean;
  activePromoClip: PromoClip | null;
  songsUntilNextPromo?: number;
  adminQueue: SongTrack[];
  staffQueue: SongTrack[];
  recommendations: SongTrack[];
  playedHistory?: SongTrack[];
  settings: StationSettings;
  isSpeakerNode: boolean;
  onPlayPause: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onRemoveTrackFromQueue: (trackId: string, queueType: 'admin' | 'staff') => void;
  onReorderStaffQueue: (newQueue: SongTrack[]) => void;
  onClearQueue?: (queueType?: 'staff' | 'admin' | 'all') => void;
  onPlayTrackNow?: (track: SongTrack) => void;
  onTriggerInstantPromo: () => void;
  isMoodMixActive?: boolean;
  detectedMood?: string;
  onToggleMoodMix?: () => void;
  userRole?: 'staff' | 'admin' | null;
  onStopPromo?: () => void;
  onUpdateSettings?: (settings: Partial<StationSettings>) => void;
}

export const ExpandedPlayer: React.FC<ExpandedPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  isPromoPlaying,
  activePromoClip,
  adminQueue,
  staffQueue,
  recommendations,
  playedHistory = [],
  settings,
  isSpeakerNode,
  onPlayPause,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  onVolumeChange,
  onAddTrackToQueue,
  onRemoveTrackFromQueue,
  onReorderStaffQueue,
  onClearQueue,
  onPlayTrackNow,
  isMoodMixActive = false,
  detectedMood,
  onToggleMoodMix,
  userRole,
  onStopPromo,
  onUpdateSettings,
}) => {
  const isShuffle = Boolean(settings?.isShuffleEnabled);
  const loopMode: 'none' | 'all' | 'one' = settings?.loopMode || 'none';

  const handleToggleShuffle = () => {
    if (onUpdateSettings) {
      onUpdateSettings({ isShuffleEnabled: !isShuffle });
    }
  };

  const handleToggleRepeat = () => {
    let nextMode: 'none' | 'all' | 'one' = 'none';
    if (loopMode === 'none') nextMode = 'all';
    else if (loopMode === 'all') nextMode = 'one';
    else nextMode = 'none';

    if (onUpdateSettings) {
      onUpdateSettings({ loopMode: nextMode });
    }
  };

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<'queue' | 'history' | 'search' | 'recommendations'>('queue');
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [addedTrackId, setAddedTrackId] = useState<string | null>(null);
  const [artworkAspect, setArtworkAspect] = useState<'square' | 'video'>('square');
  const moodTheme = getMoodTheme(detectedMood);

  const cleanRecommendations = React.useMemo(() => {
    return deduplicateTrackList(recommendations || [], currentTrack, [...adminQueue, ...staffQueue], 40);
  }, [recommendations, currentTrack, adminQueue, staffQueue]);

  // Accurately determine if artwork is rectangular (16:9 / 4:3) or square (1:1)
  useEffect(() => {
    if (!currentTrack?.artworkUrl) {
      setArtworkAspect('square');
      return;
    }

    const isYoutube =
      currentTrack.source === 'youtube' ||
      currentTrack.artworkUrl.includes('ytimg.com') ||
      Boolean(currentTrack.youtubeVideoId);

    setArtworkAspect(isYoutube ? 'video' : 'square');

    const img = new Image();
    img.src = currentTrack.artworkUrl;
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setArtworkAspect(img.naturalWidth / img.naturalHeight >= 1.25 ? 'video' : 'square');
      }
    };
  }, [currentTrack?.artworkUrl, currentTrack?.source, currentTrack?.youtubeVideoId]);

  // Search state inside player
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SongTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'youtube' | 'saavn'>('all');

  // Drag and drop state for queue reordering
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);
  const playerSearchDebounceRef = useRef<number | null>(null);
  const [localHulchul, setLocalHulchul] = useState<number | null>(null);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleVolumeSlider = (val: number) => {
    setVolume(val);
    setIsMuted(val === 0);
    onVolumeChange(val);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(volume || 0.8);
    } else {
      setIsMuted(true);
      onVolumeChange(0);
    }
  };

  const handleSearchMusic = async (
    q: string = searchQuery,
    src: 'all' | 'youtube' | 'saavn' = sourceFilter
  ) => {
    const clean = q.trim();
    if (!clean) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(clean)}&source=${src}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  // Reorder queue functions
  const moveQueueItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= staffQueue.length) return;
    const newQueue = [...staffQueue];
    const [moved] = newQueue.splice(index, 1);
    newQueue.splice(targetIndex, 0, moved);
    onReorderStaffQueue(newQueue);
  };

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItemRef.current = index;
  };

  const handleDragEnd = () => {
    if (dragItemRef.current !== null && dragOverItemRef.current !== null && dragItemRef.current !== dragOverItemRef.current) {
      const newQueue = [...staffQueue];
      const [dragged] = newQueue.splice(dragItemRef.current, 1);
      newQueue.splice(dragOverItemRef.current, 0, dragged);
      onReorderStaffQueue(newQueue);
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  };

  const handleAddWithFeedback = (track: SongTrack) => {
    onAddTrackToQueue(track);
    setAddedTrackId(track.id);
    setTimeout(() => {
      setAddedTrackId(null);
    }, 1500);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* 1. COLLAPSED MINI PLAYER (Sticky Bottom, Apple Music Style) */}
      {/* ------------------------------------------------------------- */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#1c1c1e]/95 backdrop-blur-2xl border-t border-white/[0.1] px-4 py-2.5 shadow-2xl transition-all cursor-pointer md:hidden"
        onClick={() => setIsExpanded(true)}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Mini Track Artwork & Metadata */}
          <div className="flex items-center gap-3 overflow-hidden min-w-0">
            <AppleArtwork
              src={currentTrack?.artworkUrl}
              alt={currentTrack?.title || 'Now Playing'}
              size="sm"
              isPlaying={isPlaying}
              className="shrink-0"
            />

            <div className="truncate">
              <p className="text-xs md:text-sm font-semibold text-white truncate">
                {currentTrack ? currentTrack.title : 'Gaana chunein'}
              </p>
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                {currentTrack ? currentTrack.artist : 'Search karein ya list me jodein'}
              </p>
            </div>
          </div>

          {/* Mini Center: Speaker / Promo Status with Minimal Stop Promo Pill */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px]">
            {isPromoPlaying ? (
              <div className="flex items-center gap-2 text-[#ff9500] font-semibold">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Promo Live</span>
                {userRole === 'admin' && onStopPromo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStopPromo();
                    }}
                    className="ml-1 px-2 py-0.5 rounded-full bg-red-500/20 hover:bg-red-500/35 text-red-300 border border-red-500/35 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
                    title="Promo rokein aur music un-duck karein"
                  >
                    <X className="w-3 h-3" />
                    <span>Stop Promo</span>
                  </button>
                )}
              </div>
            ) : isSpeakerNode ? (
              <span className="text-[#30d158] font-medium">🔊 Speaker Output Active</span>
            ) : (
              <span className="text-neutral-400">📱 Silent Remote Phone</span>
            )}
          </div>

          {/* Mini Playback Controls with 44px Hitboxes */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Quick MIX Toggle Pill */}
            {onToggleMoodMix && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMoodMix();
                }}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                  isMoodMixActive
                    ? `bg-gradient-to-r ${moodTheme.gradient} text-white shadow-md ring-1 ring-white/40 animate-mood-glow-subtle`
                    : 'bg-white/[0.08] hover:bg-white/[0.15] text-neutral-300 border border-white/[0.08]'
                }`}
                style={isMoodMixActive ? { boxShadow: `0 0 12px ${moodTheme.glowColor}` } : undefined}
                title={isMoodMixActive ? `Mood Mix ON (${detectedMood || moodTheme.name})` : 'Mood Mix OFF: 90s Hits'}
              >
                <span className="text-[10px]">{isMoodMixActive ? moodTheme.iconEmoji : '📻'}</span>
                <span>{isMoodMixActive ? 'MIX' : '90s'}</span>
              </button>
            )}

            <button
              onClick={onPlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 rounded-full bg-white text-black hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg transition-transform cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black translate-x-0.5" />}
            </button>

            <button
              onClick={onSkipNext}
              aria-label="Agla Gaana"
              className="w-10 h-10 rounded-full text-neutral-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mini Audio Scrubber Line - Smooth Linear Animation */}
        <div className="w-full bg-white/[0.08] h-1 mt-2 rounded-full overflow-hidden">
          <div
            className={`bg-[#ff9500] h-full ${isPlaying ? 'transition-[width] duration-1000 ease-linear' : 'transition-all duration-300'}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. EXPANDED FULL-SCREEN SHEET (Apple Music Signature Design) */}
      {/* ------------------------------------------------------------- */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-black/98 backdrop-blur-3xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
          {/* Ambient Album Art / Mood Glow Background with Click Feedback Hulchul */}
          {currentTrack?.artworkUrl && (
            <div
              key={localHulchul ? `exp-surge-${localHulchul}` : 'exp-ambient'}
              className={`absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-[130px] ${
                localHulchul
                  ? 'animate-ambient-hulchul'
                  : isMoodMixActive
                  ? 'opacity-40'
                  : 'opacity-25'
              } pointer-events-none transition-all duration-1000`}
              style={{
                backgroundImage: isMoodMixActive
                  ? `radial-gradient(circle, ${moodTheme.glowColor} 0%, transparent 70%), url(${currentTrack.artworkUrl})`
                  : `url(${currentTrack.artworkUrl})`,
                backgroundSize: 'cover',
              }}
            />
          )}

          {/* Top Collapse Navigation */}
          <div className="p-4 flex items-center justify-between border-b border-white/[0.08] shrink-0 relative z-10">
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors active:scale-95"
            >
              <ChevronDown className="w-6 h-6" />
            </button>

            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-[#ff9500] uppercase tracking-widest">
                Sangeet Forecourt Player
              </span>
              <span className="text-xs text-neutral-400">
                {isSpeakerNode ? '🔊 Speaker Active (Pump Output)' : '📱 Remote Phone (Silent)'}
              </span>
            </div>

            <div className="w-8" />
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-6 max-w-4xl mx-auto w-full relative z-10">
            {/* Promo Live Banner with Minimal Clean Stop Button */}
            {isPromoPlaying && (
              <div className="flex items-center justify-between p-2.5 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 animate-in fade-in duration-200 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold truncate">
                  <Radio className="w-4 h-4 animate-pulse shrink-0" />
                  <span className="truncate">Commercial Broadcasting: {activePromoClip?.title || 'Announcement'}</span>
                </div>
                {userRole === 'admin' && onStopPromo && (
                  <button
                    type="button"
                    onClick={onStopPromo}
                    className="px-3 py-1 rounded-full bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/30 text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0 ml-2 cursor-pointer shadow-sm"
                    title="Promo rokein aur music restore karein"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Stop Promo</span>
                  </button>
                )}
              </div>
            )}

            {/* Upper Player: Artwork & Controls */}
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 pt-2">
              {/* AppleArtwork Component */}
              <div className="relative shrink-0 flex items-center justify-center p-2">

                <AppleArtwork
                  src={currentTrack?.artworkUrl}
                  alt={currentTrack?.title || 'Cover'}
                  size="xl"
                  showAmbientGlow={true}
                  isPlaying={isPlaying}
                  className="shrink-0 relative z-10"
                />
              </div>

              {/* Track Title, Artist, & Player Controls */}
              <div className="flex-1 w-full space-y-4 text-center md:text-left">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white truncate">
                    {currentTrack?.title || 'Koi Gaana Nahi Chuna'}
                  </h2>
                  <p className="text-sm font-semibold text-slate-300 truncate mt-1">
                    {currentTrack?.artist || 'Neeche search se gaana jodein'}
                  </p>
                </div>

                {/* Scrubber Progress Slider - Apple HIG Touch Scrubber */}
                <div className="pt-2">
                  <AppleSlider
                    value={currentTime}
                    min={0}
                    max={duration || 100}
                    step={1}
                    onChange={(val) => onSeek(val)}
                    accentColor="orange"
                    size="md"
                    minLabel={formatTime(currentTime)}
                    maxLabel={`-${formatTime(Math.max(0, (duration || 0) - currentTime))}`}
                  />
                </div>

                {/* Main Controls Buttons */}
                <div className="flex items-center justify-center md:justify-start gap-4 sm:gap-6 pt-2">
                  <button
                    onClick={handleToggleShuffle}
                    className={`p-2.5 rounded-full transition-colors active:scale-95 cursor-pointer ${
                      isShuffle ? 'text-orange-500 bg-orange-500/15 border border-orange-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'
                    }`}
                    title={isShuffle ? 'Shuffle: ON (Queue & Playlists)' : 'Shuffle: OFF'}
                    aria-label="Toggle Shuffle"
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>

                  <button
                    onClick={onSkipPrevious}
                    aria-label="Pichla Gaana"
                    className="p-3 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-full transition-colors active:scale-95 cursor-pointer"
                    title="Pichla Gaana (Double tap for history)"
                  >
                    <SkipBack className="w-6 h-6" />
                  </button>

                  <button
                    onClick={onPlayPause}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="w-16 h-16 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white flex items-center justify-center shadow-xl shadow-orange-500/30 transition-all cursor-pointer"
                  >
                    {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                  </button>

                  <button
                    onClick={onSkipNext}
                    aria-label="Agla Gaana"
                    className="p-3 text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-full transition-colors active:scale-95 cursor-pointer"
                  >
                    <SkipForward className="w-6 h-6" />
                  </button>

                  <button
                    onClick={handleToggleRepeat}
                    className={`p-2.5 rounded-full transition-colors active:scale-95 relative cursor-pointer ${
                      loopMode !== 'none' ? 'text-orange-500 bg-orange-500/15 border border-orange-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.08]'
                    }`}
                    title={
                      loopMode === 'one'
                        ? 'Loop: Repeat Current Track (One)'
                        : loopMode === 'all'
                        ? 'Loop: Queue & Playlists (All)'
                        : 'Loop: OFF'
                    }
                    aria-label="Toggle Loop"
                  >
                    <Repeat className="w-5 h-5" />
                    {loopMode === 'one' && (
                      <span className="absolute top-1 right-1 text-[8px] font-bold text-orange-400 bg-orange-500/30 rounded-full w-3.5 h-3.5 flex items-center justify-center">1</span>
                    )}
                  </button>
                </div>

                {/* Dedicated Forecourt MIX Toggle Pill */}
                {onToggleMoodMix && (
                  <div className="flex items-center justify-center md:justify-start gap-2 pt-1">
                    <button
                      onClick={() => {
                        setLocalHulchul(Date.now());
                        setTimeout(() => setLocalHulchul(null), 1250);
                        onToggleMoodMix();
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer ${
                        localHulchul ? 'animate-mix-bump' : ''
                      } ${
                        isMoodMixActive
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/25 border border-amber-300/40'
                          : 'bg-white/[0.08] hover:bg-white/[0.14] text-neutral-300 hover:text-white border border-white/[0.12]'
                      }`}
                      title={isMoodMixActive ? 'Mood Mix ON: 90s Hits par switch karein' : 'Mood Mix OFF: Current song mood match karein'}
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isMoodMixActive ? 'text-yellow-200' : 'text-neutral-400'}`} />
                      <span>{isMoodMixActive ? '✨ MIX: ON' : '📻 90s HITS (MIX: OFF)'}</span>
                      {isMoodMixActive && detectedMood && (
                        <span className="text-[10px] font-medium bg-black/40 px-2 py-0.5 rounded-full border border-white/20 text-white truncate max-w-[130px]">
                          {detectedMood}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {/* Master Volume Slider (Always Visible & Interactive) */}
                <div className="pt-2 max-w-xs mx-auto md:mx-0">
                  <AppleSlider
                    value={isMuted ? 0 : volume}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(val) => handleVolumeSlider(val)}
                    accentColor="orange"
                    size="sm"
                    label={isSpeakerNode ? "Speaker Output Volume" : "Station Remote Volume"}
                    valueDisplay={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
                    leftIcon={
                      <button onClick={toggleMute} className="hover:text-white cursor-pointer" title="Mute/Unmute">
                        {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-orange-400" />}
                      </button>
                    }
                  />
                </div>
              </div>
            </div>

            {/* Lower Section Tabs: Agle Gaane / History / Sujhav / Gaana Khojein */}
            <div className="pt-4 border-t border-white/[0.08] space-y-4">
              <div className="p-1 rounded-2xl bg-[#1c1c1e] border border-white/[0.08] flex items-center gap-1 overflow-x-auto shadow-sm">
                <button
                  onClick={() => setActiveBottomTab('queue')}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    activeBottomTab === 'queue'
                      ? 'bg-white/15 text-white shadow-sm font-semibold'
                      : 'text-[#86868b] hover:text-white'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue ({adminQueue.length + staffQueue.length})</span>
                </button>

                <button
                  onClick={() => setActiveBottomTab('history')}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    activeBottomTab === 'history'
                      ? 'bg-white/15 text-white shadow-sm font-semibold'
                      : 'text-[#86868b] hover:text-white'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>History ({playedHistory.length})</span>
                </button>

                <button
                  onClick={() => setActiveBottomTab('search')}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    activeBottomTab === 'search'
                      ? 'bg-white/15 text-white shadow-sm font-semibold'
                      : 'text-[#86868b] hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </button>

                <button
                  onClick={() => setActiveBottomTab('recommendations')}
                  className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    activeBottomTab === 'recommendations'
                      ? 'bg-white/15 text-white shadow-sm font-semibold'
                      : 'text-[#86868b] hover:text-white'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-[#ff9500]" />
                  <span>Auto-Mix ({cleanRecommendations.length})</span>
                </button>
              </div>

              {/* TAB 1: AGLE GAANE (QUEUE) WITH CLEAR ALL & DRAG REORDER */}
              {activeBottomTab === 'queue' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-300">
                      Line me lage gaane ({adminQueue.length + staffQueue.length})
                    </span>
                    {staffQueue.length > 0 && onClearQueue && (
                      <button
                        onClick={() => onClearQueue('staff')}
                        className="px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear All ({staffQueue.length})</span>
                      </button>
                    )}
                  </div>

                  {adminQueue.length + staffQueue.length > 0 ? (
                    <div className="space-y-2">
                      {/* Admin VIP queue items */}
                      {adminQueue.map((track, idx) => (
                        <div
                          key={`exp-admin-${track.id}-${idx}`}
                          className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-xs font-mono text-orange-400 w-4">{idx + 1}</span>
                            <AppleArtwork
                              src={track.artworkUrl}
                              alt={track.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{track.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0">
                            VIP
                          </span>
                        </div>
                      ))}

                      {/* Staff queue items with Drag and Arrow Reorder */}
                      {staffQueue.map((track, idx) => (
                        <div
                          key={`exp-staff-${track.id}-${idx}`}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragEnter={() => handleDragEnter(idx)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3 hover:border-white/[0.15] transition-all cursor-move active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            {/* Drag handle */}
                            <GripVertical className="w-4 h-4 text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" />
                            <span className="text-xs font-mono text-slate-500 w-4">
                              {adminQueue.length + idx + 1}
                            </span>
                            <AppleArtwork
                              src={track.artworkUrl}
                              alt={track.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{track.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Reorder Up */}
                            <button
                              onClick={() => moveQueueItem(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/[0.06]"
                              title="Upar Karein"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Reorder Down */}
                            <button
                              onClick={() => moveQueueItem(idx, 'down')}
                              disabled={idx === staffQueue.length - 1}
                              className="p-1.5 text-slate-400 hover:text-white disabled:opacity-20 rounded-lg hover:bg-white/[0.06]"
                              title="Neeche Karein"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove */}
                            <button
                              onClick={() => onRemoveTrackFromQueue(track.id, 'staff')}
                              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10"
                              title="Hataayein"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        Koi agla gaana queue me nahi hai.
                      </p>
                      <button
                        onClick={() => setActiveBottomTab('search')}
                        className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold active:scale-95 transition-all shadow-md shadow-orange-500/20"
                      >
                        Gaana Search Karein
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: HISTORY (PEHLE BAJE GAANE) */}
              {activeBottomTab === 'history' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300">
                    Station shuru hone se ab tak baje gaane ({playedHistory.length})
                  </span>
                  {playedHistory.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {playedHistory.map((track, idx) => (
                        <div
                          key={`hist-${track.id}-${idx}`}
                          className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3 hover:border-white/[0.12] transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <span className="text-xs font-mono text-slate-500 w-4">{idx + 1}</span>
                            <AppleArtwork
                              src={track.artworkUrl}
                              alt={track.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{track.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onPlayTrackNow && (
                              <button
                                onClick={() => onPlayTrackNow(track)}
                                className="px-2.5 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-white border border-orange-500/30 text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                                title="Is gaane ko abhi bajayein"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Bajayein</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleAddWithFeedback(track)}
                              className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] text-slate-200 text-xs font-bold flex items-center gap-1 transition-all shrink-0 active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Dobara</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
                      <p className="text-xs text-slate-400">
                        Station par abhi koi pichla gaana record nahi hua hai.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: GAANA KHOJEIN (SEARCH) */}
              {activeBottomTab === 'search' && (
                <div className="space-y-4">
                  {/* Source Switcher Pills */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-400">Search Engine:</span>
                    <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/[0.08]">
                      {(
                        [
                          { id: 'all', label: 'Sabhi' },
                          { id: 'youtube', label: 'Sangeet' },
                          { id: 'saavn', label: 'JioSaavn' },
                        ] as const
                      ).map((src) => (
                        <button
                          key={src.id}
                          onClick={() => {
                            setSourceFilter(src.id);
                            if (searchQuery) {
                              handleSearchMusic(searchQuery, src.id);
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                            sourceFilter === src.id
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

                  {/* Search Input with Search Button */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchMusic();
                          }
                        }}
                        placeholder="Gaana Khojein: Hindi, Punjabi, Bhojpuri, Pop, Arijit..."
                        className="w-full bg-black border border-white/[0.12] focus:border-orange-500 rounded-2xl pl-11 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="absolute right-3 top-3 p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/[0.08]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSearchMusic()}
                      disabled={!searchQuery.trim() || searching}
                      className="px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
                      title="Search Karein"
                    >
                      <Search className="w-4 h-4" />
                      <span>Search</span>
                    </button>
                  </div>

                  {searching && (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Gaane dhoonde ja rahe hain...
                    </div>
                  )}

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {searchResults.map((track, idx) => (
                        <div
                          key={`exp-search-${track.id}-${idx}`}
                          className="p-3 rounded-2xl bg-black/60 border border-white/[0.08] flex items-center justify-between gap-3 hover:border-white/[0.15] transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <AppleArtwork
                              src={track.artworkUrl}
                              alt={track.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-white truncate">{track.title}</p>
                                {track.source === 'youtube' ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                                    Sangeet
                                  </span>
                                ) : track.source === 'jiosaavn' ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                    JioSaavn
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                                    Official
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onPlayTrackNow && (
                              <button
                                onClick={() => onPlayTrackNow(track)}
                                className="px-2.5 py-1.5 rounded-xl bg-white/[0.08] hover:bg-orange-500 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                                title="Is gaane ko abhi bajayein"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span className="hidden sm:inline">Abhi</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleAddWithFeedback(track)}
                              className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
                                addedTrackId === track.id
                                  ? 'bg-emerald-600 shadow-emerald-600/30'
                                  : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
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
                </div>
              )}

              {/* TAB 4: YOUTUBE MUSIC AUTO-MIX (NON-STOP RADIO) */}
              {activeBottomTab === 'recommendations' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-600/15 via-orange-500/10 to-transparent border border-red-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                        <span className="text-xs font-bold text-white">Auto-Mix Queue Engine</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300">
                          {isMoodMixActive ? '✨ Mood Mix Active' : '📻 90s Hits Default'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {isMoodMixActive
                          ? `Currently matched to: ${detectedMood || 'Current track vibe'}. Current gaane ke genre aur mood ke gaane.`
                          : 'Default 90s Bollywood Evergreen Hits. MIX button dabakar current gaane ka mood match karein.'}
                      </p>
                    </div>

                    {onToggleMoodMix && (
                      <button
                        onClick={onToggleMoodMix}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95 cursor-pointer self-start sm:self-auto ${
                          isMoodMixActive
                            ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md shadow-red-500/30'
                            : 'bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.1]'
                        }`}
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isMoodMixActive ? 'text-yellow-200' : 'text-neutral-400'}`} />
                        <span>{isMoodMixActive ? 'Mix: Mood Mode' : 'Mix: 90s Mode'}</span>
                      </button>
                    )}
                  </div>

                  {cleanRecommendations.length > 0 ? (
                    <div className="space-y-2">
                      {cleanRecommendations.map((track, idx) => (
                        <div
                          key={`exp-rec-${track.id}-${idx}`}
                          className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3 hover:border-white/[0.12] transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <AppleArtwork
                              src={track.artworkUrl}
                              alt={track.title}
                              size="sm"
                              className="shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{track.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onPlayTrackNow && (
                              <button
                                onClick={() => onPlayTrackNow(track)}
                                className="px-2.5 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-white border border-orange-500/30 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                                title="Is gaane ko abhi bajayein"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Bajayein</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleAddWithFeedback(track)}
                              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.15] text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Queue</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center">
                      <p className="text-xs text-slate-400">
                        Koi recommendations available nahi hain.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
