import React, { useState } from 'react';
import { Play, Pause, SkipForward, Volume2, Smartphone, Sparkles, X, Radio, Lock } from 'lucide-react';
import { SongTrack } from '../../types';
import { getMoodTheme } from '../../utils/moodTheme';

interface MobileMiniPlayerProps {
  currentTrack: SongTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isSpeakerNode: boolean;
  userRole: 'staff' | 'admin';
  isMoodMixActive?: boolean;
  detectedMood?: string;
  mixShockwaveKey?: number | null;
  isPromoPlaying?: boolean;
  onPlayPause: () => void;
  onSkipNext: () => void;
  onOpenFullPlayer: () => void;
  onToggleMoodMix?: () => void;
  onStopPromo?: () => void;
}

export const MobileMiniPlayer: React.FC<MobileMiniPlayerProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  isSpeakerNode,
  userRole,
  isMoodMixActive = false,
  detectedMood,
  mixShockwaveKey,
  isPromoPlaying,
  onPlayPause,
  onSkipNext,
  onOpenFullPlayer,
  onToggleMoodMix,
  onStopPromo,
}) => {
  if (!currentTrack) return null;

  const [localShockwave, setLocalShockwave] = useState<number | null>(null);
  const moodTheme = getMoodTheme(detectedMood);
  const isShockActive = Boolean(mixShockwaveKey || localShockwave);

  const totalDuration = duration || currentTrack.duration || 180;
  const progressPercent =
    totalDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))
      : 0;

  const isCurrentAdminTrack = Boolean(
    currentTrack &&
    (currentTrack.priority === 'admin_instant' ||
     currentTrack.priority === 'admin_high' ||
     currentTrack.requestedBy === 'Station Admin' ||
     currentTrack.requestedBy === 'Admin')
  );

  // Remote devices cannot control playback.
  // ALSO, if current track is played by Admin, Speaker Mode has NO right to control playback!
  const canControlPlayback = userRole === 'admin' || (isSpeakerNode && !isCurrentAdminTrack);

  return (
    <div
      onClick={onOpenFullPlayer}
      className="fixed bottom-[68px] left-2 right-2 md:max-w-[432px] md:left-1/2 md:-translate-x-1/2 z-40 bg-[#212121] border border-[#333333] rounded-xl shadow-2xl overflow-hidden cursor-pointer active:scale-[0.99] transition-all"
    >
      <div className="px-3 py-2 flex items-center justify-between gap-3">
        {/* Left: Square Thumbnail + Title */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-black relative border border-white/10 shadow-sm">
              {currentTrack.artworkUrl ? (
                <img
                  src={currentTrack.artworkUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#ff0000]/20 text-[#ff0000]">
                  <Play className="w-4 h-4 fill-current" />
                </div>
              )}
            </div>
          </div>

          <div className="truncate flex-1">
            <p className="text-xs font-bold text-white truncate leading-tight">
              {currentTrack.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-400">
              <span className="truncate">{currentTrack.artist}</span>
              <span aria-hidden="true">&#8226;</span>
              {isMoodMixActive ? (
                <span className="text-[10px] text-amber-400 font-semibold truncate">
                  {moodTheme.iconEmoji} {detectedMood || 'Mood Mix'}
                </span>
              ) : (
                <span className="text-[10px] text-[#ff0000] font-semibold">
                  {currentTrack.priority === 'admin_instant' || currentTrack.priority === 'admin_high'
                    ? 'On Priority'
                    : '📻 90s Hits'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dedicated Minimal Stop Promo Pill for Admin when promo is live */}
        {isPromoPlaying && userRole === 'admin' && onStopPromo && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <button
              onClick={onStopPromo}
              className="px-2 py-1 rounded-full bg-red-500/20 hover:bg-red-500/35 text-red-300 border border-red-500/35 text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm"
              title="Stop Promo Audio"
            >
              <X className="w-3 h-3" />
              <span>Stop Promo</span>
            </button>
          </div>
        )}

        {/* Dedicated MIX Toggle Button */}
        {onToggleMoodMix && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            <button
              onClick={() => {
                setLocalShockwave(Date.now());
                setTimeout(() => setLocalShockwave(null), 900);
                onToggleMoodMix();
              }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm ${
                isShockActive ? 'animate-mix-bump' : ''
              } ${
                isMoodMixActive
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md border border-amber-300/40'
                  : 'bg-white/10 text-neutral-300 hover:text-white border border-white/10 hover:bg-white/20'
              }`}
              title={isMoodMixActive ? 'Mood Mix Active: Tap for 90s Hits' : 'Mood Mix OFF: Tap to match track mood'}
            >
              <Sparkles className={`w-3 h-3 ${isMoodMixActive ? 'text-yellow-200 fill-current' : 'text-neutral-400'}`} />
              <span>MIX</span>
            </button>
          </div>
        )}

        {/* Right Controls: Play/Pause and Next ONLY for Admin and Speaker */}
        {canControlPlayback ? (
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onPlayPause}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-black text-black" />
              ) : (
                <Play className="w-4 h-4 fill-black text-black ml-0.5" />
              )}
            </button>

            <button
              onClick={onSkipNext}
              className="w-9 h-9 text-neutral-300 hover:text-white rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              title="Next Track"
              aria-label="Next Track"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        ) : isCurrentAdminTrack && isSpeakerNode ? (
          /* Speaker mode indicator showing Admin lock */
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-300 font-bold shrink-0">
            <Lock className="w-3 h-3 text-amber-400" />
            <span>Admin Track</span>
          </div>
        ) : (
          /* Remote mode status indicator */
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181818] border border-[#333] text-[10px] text-neutral-400 shrink-0">
            <Smartphone className="w-3 h-3 text-[#ff0000]" />
            <span>Remote</span>
          </div>
        )}
      </div>

      {/* Signature YouTube Red Bottom Hairline Progress Bar */}
      <div className="w-full h-[2.5px] bg-white/[0.08]">
        <div
          className="h-full bg-[#ff0000] transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
