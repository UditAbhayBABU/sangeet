import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Smartphone,
  ListMusic,
  Sparkles,
  Radio,
  X,
  Heart,
  Crown,
  Lock,
} from 'lucide-react';
import { StationState, StationSettings } from '../../types';
import { audioEngine } from '../../services/audioEngine';
import { getMoodTheme } from '../../utils/moodTheme';

interface MobileFullPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  stationState: StationState;
  currentTime: number;
  duration: number;
  isSpeakerNode: boolean;
  userRole: 'staff' | 'admin';
  onPlayPause: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onSeek: (seconds: number) => void;
  onOpenQueueDrawer: (tab?: 'queue' | 'mix') => void;
  onTriggerUrgentPromo: () => void;
  onOpenSpeakerModal: () => void;
  onUpdateSettings?: (settings: Partial<StationSettings>) => void;
  onSetMasterVolume?: (vol: number) => void;
  isMoodMixActive?: boolean;
  detectedMood?: string;
  mixShockwaveKey?: number | null;
  onToggleMoodMix?: () => void;
  onStopPromo?: () => void;
  isLiked?: boolean;
  onToggleLike?: () => void;
}

export const MobileFullPlayer: React.FC<MobileFullPlayerProps> = ({
  isOpen,
  onClose,
  stationState,
  currentTime,
  duration,
  isSpeakerNode,
  userRole,
  onPlayPause,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  onOpenQueueDrawer,
  onOpenSpeakerModal,
  onSetMasterVolume,
  onUpdateSettings,
  isMoodMixActive = false,
  detectedMood,
  mixShockwaveKey,
  onToggleMoodMix,
  onStopPromo,
  isLiked = false,
  onToggleLike,
}) => {
  const isShuffle = Boolean(stationState.settings?.isShuffleEnabled);
  const loopMode: 'none' | 'all' | 'one' = stationState.settings?.loopMode || 'none';
  const [localHulchul, setLocalHulchul] = useState<number | null>(null);
  const moodTheme = getMoodTheme(detectedMood);
  const isHulchulActive = Boolean(mixShockwaveKey || localHulchul);

  // Master volume state (local copy for smooth sliding)
  const [localVolume, setLocalVolume] = useState<number>(() => {
    return stationState.settings.masterVolume !== undefined ? stationState.settings.masterVolume : 90;
  });

  const currentTrack = stationState.currentTrack;
  const isPlaying = stationState.playbackState.isPlaying;

  if (!isOpen || !currentTrack) return null;

  const totalDuration = duration || currentTrack.duration || 180;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

  const isAdmin = userRole === 'admin';
  const isSpeaker = isSpeakerNode;
  const isRemote = !isAdmin && !isSpeaker;

  const isCurrentAdminTrack = Boolean(
    currentTrack.priority === 'admin_instant' ||
    currentTrack.priority === 'admin_high' ||
    currentTrack.requestedBy === 'Station Admin' ||
    currentTrack.requestedBy === 'Admin'
  );

  const canSkipTrack = isAdmin || (isSpeaker && !isCurrentAdminTrack);
  const canPlayPause = isAdmin || (isSpeaker && !isCurrentAdminTrack);
  const canSeek = isAdmin || (isSpeaker && !isCurrentAdminTrack);

  const handleVolumeChange = (newVal: number) => {
    if (!isAdmin) return;
    setLocalVolume(newVal);
    audioEngine.setMasterVolume(newVal / 100);
    if (onSetMasterVolume) {
      onSetMasterVolume(newVal);
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSeconds = Math.round(progress * totalDuration);
    onSeek(targetSeconds);
  };

  const totalUpcomingCount = stationState.adminQueue.length + stationState.staffQueue.length;

  return (
    <div className="fixed inset-0 z-50 bg-[#030303] text-white flex flex-col justify-between p-4 sm:p-5 pb-5 max-h-[100dvh] h-[100dvh] overflow-hidden select-none animate-in fade-in slide-in-from-bottom duration-300 md:max-w-md md:left-1/2 md:-translate-x-1/2 md:border-x md:border-white/10 md:shadow-2xl">
      {/* Dynamic Ambient Background Glow */}
      {currentTrack.artworkUrl && (
        <div
          key={isHulchulActive ? `ambient-${localHulchul || mixShockwaveKey}` : 'ambient-rest'}
          aria-hidden="true"
          className="absolute inset-0 blur-3xl pointer-events-none transition-all duration-700 opacity-20 scale-125"
          style={{
            backgroundImage: isMoodMixActive
              ? `radial-gradient(circle at 50% 20%, ${moodTheme.glowColor} 0%, transparent 65%)`
              : `radial-gradient(circle at 50% 20%, #ff0000 0%, transparent 65%)`,
          }}
        />
      )}

      {/* Top Header Row with Minimize Affordance & Repositioned MIX Button */}
      <div className="relative z-10 shrink-0 space-y-2">
        <div
          className="w-10 h-1 rounded-full bg-white/20 mx-auto cursor-pointer hover:bg-white/40 transition-colors"
          onClick={onClose}
        />

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {/* Minimize Chevron */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
            title="Minimize"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          {/* Clean Station Name & Audio Target */}
          <div className="text-center truncate px-2 flex-1 min-w-0">
            <span className="text-[11px] uppercase font-bold tracking-widest text-neutral-400 block truncate">
              {stationState.stationName || 'Forecourt Radio'}
            </span>
            <span className="text-[11px] font-medium text-neutral-400 truncate block">
              {isSpeaker ? 'Station Speaker' : isRemote ? 'Remote Controller' : 'Now Playing'}
            </span>
          </div>

          {/* Right Controls: Repositioned Glow MIX Toggle + Speaker Router */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleMoodMix && (
              <button
                onClick={() => {
                  setLocalHulchul(Date.now());
                  setTimeout(() => setLocalHulchul(null), 1200);
                  onToggleMoodMix();
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase transition-all duration-300 active:scale-90 cursor-pointer flex items-center gap-1.5 ${
                  isMoodMixActive
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-[0_0_14px_rgba(245,158,11,0.7)] border border-amber-300/80 animate-pulse'
                    : 'bg-white/[0.06] text-neutral-400 hover:text-neutral-200 border border-white/10 hover:border-white/20'
                }`}
                title={isMoodMixActive ? 'Auto-Mix is ON: Tap to turn OFF' : 'Auto-Mix is OFF: Tap to turn ON'}
              >
                <Sparkles className={`w-3 h-3 ${isMoodMixActive ? 'text-yellow-100 fill-current' : 'text-neutral-500'}`} />
                <span>MIX</span>
              </button>
            )}

            {/* Audio Output Router Button */}
            <button
              onClick={onOpenSpeakerModal}
              className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer border shrink-0 ${
                isSpeakerNode
                  ? 'bg-[#ff0000]/15 border-[#ff0000]/40 text-[#ff4d4d]'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-neutral-400'
              }`}
              title="Audio Output Routing"
            >
              {isSpeakerNode ? <Volume2 className="w-4 h-4 animate-pulse" /> : <Smartphone className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Minimal Clean Promo Status Pill / Stop Banner for Admin */}
        {stationState.isPromoPlaying && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-xs text-amber-300 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 truncate">
              <Radio className="w-3.5 h-3.5 animate-pulse text-amber-400 shrink-0" />
              <span className="truncate font-semibold">Promo: {stationState.activePromoClip?.title || 'Commercial'}</span>
            </div>
            {isAdmin && onStopPromo && (
              <button
                type="button"
                onClick={onStopPromo}
                className="ml-2 px-2.5 py-0.5 rounded-full bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/35 text-[10px] font-bold active:scale-95 transition-all shrink-0 cursor-pointer shadow-sm flex items-center gap-1"
                title="Stop Promo"
              >
                <X className="w-3 h-3" />
                <span>Stop Promo</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Artwork Canvas with Dynamic Aspect Ratio & Generous Breathing Room */}
      <div className="relative z-10 flex-1 min-h-0 w-full flex items-center justify-center px-4 py-2 sm:py-3 my-auto">
        <div className="relative flex items-center justify-center max-h-[34vh] max-w-[340px] w-auto h-auto">
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.85)] bg-neutral-950 border border-white/10 flex items-center justify-center transition-all duration-300">
            {currentTrack.artworkUrl ? (
              <img
                src={currentTrack.artworkUrl}
                alt={currentTrack.title}
                className="max-h-[32vh] sm:max-h-[34vh] max-w-[85vw] sm:max-w-[340px] w-auto h-auto object-contain rounded-2xl sm:rounded-3xl block"
              />
            ) : (
              <div className="w-48 h-48 flex flex-col items-center justify-center text-neutral-600 gap-2 p-6">
                <Play className="w-10 h-10 fill-current" />
                <span className="text-xs font-semibold">Sangeet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Track Controls Area (No vertical clutter, spacious layout) */}
      <div className="relative z-10 space-y-3.5 shrink-0 max-w-md mx-auto w-full pt-1">
        {/* Track Title & Artist + Like/Save Heart Button (Matches red box in user screenshot) */}
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0 flex-1 space-y-0.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate leading-tight">
              {currentTrack.title}
            </h1>
            <p className="text-sm font-medium text-neutral-400 truncate">
              {currentTrack.artist}
            </p>
          </div>

          {onToggleLike && (
            <button
              onClick={onToggleLike}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-80 cursor-pointer shrink-0 ${
                isLiked
                  ? 'text-[#ff0000] bg-[#ff0000]/15 border border-[#ff0000]/30 shadow-[0_0_16px_rgba(255,0,0,0.35)]'
                  : 'text-neutral-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10'
              }`}
              title={isLiked ? 'Remove from Liked tracks' : 'Save to Liked tracks'}
              aria-label="Save track"
            >
              <Heart
                className={`w-6 h-6 transition-transform ${
                  isLiked ? 'fill-[#ff0000] stroke-[#ff0000] scale-110' : 'stroke-[2px]'
                }`}
              />
            </button>
          )}
        </div>

        {/* Admin Track Lock Banner if played by admin and current user is not admin */}
        {isCurrentAdminTrack && !isAdmin && (
          <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold mx-auto">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Admin Track &bull; Playback Controls Locked</span>
          </div>
        )}

        {/* YouTube Red Scrubber Bar */}
        <div className="space-y-1.5 px-1">
          <div
            onClick={handleScrubberClick}
            className={`group relative w-full h-2 bg-neutral-800/90 rounded-full flex items-center ${
              canSeek ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
            title={canSeek ? 'Seek' : 'Admin Track Playing: Seeking Locked'}
          >
            <div
              className="h-1 bg-[#ff0000] rounded-full transition-all duration-150 relative group-hover:h-1.5"
              style={{
                width: `${totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0}%`,
              }}
            >
              {canSeek && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
              )}
            </div>
          </div>
          <div className="flex justify-between text-xs font-medium tabular-nums text-neutral-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Primary YouTube Music Playback Controls */}
        <div className="flex items-center justify-between px-3">
          <button
            onClick={handleToggleShuffle}
            className={`p-2 rounded-full transition-colors active:scale-90 ${
              isShuffle ? 'text-[#ff0000]' : 'text-neutral-400 hover:text-white'
            }`}
            title={isShuffle ? 'Shuffle: ON (Queue & Playlists)' : 'Shuffle: OFF'}
            aria-label="Toggle Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Track */}
          <button
            onClick={canPlayPause ? onSkipPrevious : undefined}
            disabled={!canPlayPause}
            className={`p-2 rounded-full active:scale-90 transition-transform ${
              canPlayPause ? 'text-white cursor-pointer hover:text-neutral-200' : 'text-neutral-600 cursor-not-allowed opacity-40'
            }`}
            title="Previous Track"
          >
            <SkipBack className="w-7 h-7 fill-current" />
          </button>

          {/* Big Center Play/Pause Circle */}
          <button
            onClick={canPlayPause ? onPlayPause : undefined}
            disabled={!canPlayPause}
            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              canPlayPause
                ? 'bg-white text-black hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-black text-black" />
            ) : (
              <Play className="w-7 h-7 fill-black text-black ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={canSkipTrack ? onSkipNext : undefined}
            disabled={!canSkipTrack}
            className={`p-2 rounded-full active:scale-90 transition-transform ${
              canSkipTrack ? 'text-white cursor-pointer hover:text-neutral-200' : 'text-neutral-600 cursor-not-allowed opacity-40'
            }`}
            title="Next Track"
          >
            <SkipForward className="w-7 h-7 fill-current" />
          </button>

          {/* Repeat / Loop */}
          <button
            onClick={handleToggleRepeat}
            className={`p-2 rounded-full transition-colors active:scale-90 relative ${
              loopMode !== 'none' ? 'text-[#ff0000]' : 'text-neutral-400 hover:text-white'
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
              <span className="absolute top-1 right-1 text-[8px] font-bold text-[#ff0000]">1</span>
            )}
          </button>
        </div>

        {/* Master Volume Slider (Clean & minimal) */}
        {isAdmin && (
          <div className="pt-0.5 px-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-medium text-neutral-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-neutral-400" />
                <span>Master Volume</span>
              </span>
              <span className="font-mono tabular-nums text-neutral-300">{localVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={localVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-full accent-[#ff0000] cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
            />
          </div>
        )}

        {/* Authentic YouTube Music Up Next Trigger */}
        <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-center">
          <button
            onClick={() => onOpenQueueDrawer('queue')}
            className="w-full py-2 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-neutral-300 active:scale-[0.99] transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-[#ff0000]" />
              <span>UP NEXT</span>
            </div>
            <span className="text-[11px] font-mono text-neutral-400 normal-case tracking-normal">
              {totalUpcomingCount > 0 ? `${totalUpcomingCount} in queue` : 'Auto-mix queue'} &rarr;
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
