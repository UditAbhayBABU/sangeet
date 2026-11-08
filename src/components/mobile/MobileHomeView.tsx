import React, { useState, useEffect } from 'react';
import {
  Play,
  Plus,
  RefreshCw,
  Check,
  Sparkles,
  ListPlus,
  Radio,
  Flame,
  Crown,
  Compass,
} from 'lucide-react';
import { SongTrack, StationState } from '../../types';
import { getMoodTheme } from '../../utils/moodTheme';
import { deduplicateTrackList } from '../../utils/trackDeduplication';

interface MobileHomeViewProps {
  stationState: StationState;
  userRole: 'staff' | 'admin';
  isSpeakerNode: boolean;
  onPlayTrackNow: (track: SongTrack) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onPlayNext: (track: SongTrack) => void;
  onRefreshMix: () => void;
  onExecuteSearchCategory: (genreQuery: string) => void;
  isMoodMixActive?: boolean;
  detectedMood?: string;
  mixShockwaveKey?: number | null;
  onToggleMoodMix?: () => void;
}

export const MOOD_FILTER_CHIPS = [
  { id: 'all', label: 'All', query: 'Hindi top evergreen songs' },
  { id: 'bollywood', label: 'Bollywood Hits', query: 'Latest Bollywood hit songs' },
  { id: 'punjabi', label: 'Punjabi', query: 'Top Punjabi party hits Diljit' },
  { id: 'energize', label: 'Energize', query: 'High energy bollywood workout songs' },
  { id: 'relax', label: 'Relax / Chill', query: 'Hindi acoustic romantic chill songs' },
  { id: 'bhakti', label: 'Bhakti & Morning', query: 'Morning bhajan aarti bhakti' },
  { id: '90s', label: '90s Nostalgia', query: '90s bollywood evergreen songs Kumar Sanu' },
  { id: 'party', label: 'Party Mashup', query: 'Bollywood dance party mashup' },
  { id: 'lofi', label: 'Lo-Fi Hindi', query: 'Hindi lofi slow chill songs' },
];

export const MobileHomeView: React.FC<MobileHomeViewProps> = ({
  stationState,
  userRole,
  isSpeakerNode,
  onPlayTrackNow,
  onAddTrackToQueue,
  onPlayNext,
  onRefreshMix,
  onExecuteSearchCategory,
  isMoodMixActive = false,
  detectedMood,
  mixShockwaveKey,
  onToggleMoodMix,
}) => {
  const [selectedChip, setSelectedChip] = useState('all');
  const [addedQueueId, setAddedQueueId] = useState<string | null>(null);
  const [playNextId, setPlayNextId] = useState<string | null>(null);
  const [localShockwave, setLocalShockwave] = useState<number | null>(null);
  const moodTheme = getMoodTheme(detectedMood);
  const isShockActive = Boolean(mixShockwaveKey || localShockwave);

  const isAdmin = userRole === 'admin';
  const isSpeaker = isSpeakerNode;
  const isRemote = !isAdmin && !isSpeaker;

  const currentTrackIsAdmin = Boolean(
    stationState.currentTrack &&
      (stationState.currentTrack.priority === 'admin_instant' ||
        stationState.currentTrack.priority === 'admin_high')
  );

  const handleChipClick = (chip: (typeof MOOD_FILTER_CHIPS)[0]) => {
    setSelectedChip(chip.id);
    if (chip.id !== 'all') {
      onExecuteSearchCategory(chip.query);
    }
  };

  const handleAddQueueWithFeedback = (e: React.MouseEvent, track: SongTrack) => {
    e.stopPropagation();
    onAddTrackToQueue(track);
    setAddedQueueId(track.id);
    setTimeout(() => setAddedQueueId(null), 1400);
  };

  const handlePlayNextWithFeedback = (e: React.MouseEvent, track: SongTrack) => {
    e.stopPropagation();
    onPlayNext(track);
    setPlayNextId(track.id);
    setTimeout(() => setPlayNextId(null), 1400);
  };

  // Derive tracks dynamically from recommendations with deep zero-clutter deduplication
  const activeTracks = React.useMemo(() => {
    const raw = stationState.recommendations || [];
    const combinedQueue = [...(stationState.adminQueue || []), ...(stationState.staffQueue || [])];
    return deduplicateTrackList(raw, stationState.currentTrack, combinedQueue, 40);
  }, [stationState.recommendations, stationState.currentTrack, stationState.adminQueue, stationState.staffQueue]);

  const quickPicks = activeTracks.slice(0, 8);
  const mixedForYou = activeTracks.slice(8, 20);

  const formatSecs = (secs: number) => {
    if (!secs || isNaN(secs)) return '3:30';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="space-y-6 pb-36 pt-1 select-none">
      {/* 1. YouTube Music Signature Mood Filter Pills Bar */}
      <div className="overflow-x-auto no-scrollbar px-4 pt-1 pb-1 flex items-center gap-2">
        {MOOD_FILTER_CHIPS.map((chip) => {
          const isSelected = selectedChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => handleChipClick(chip)}
              className={`shrink-0 px-3.5 py-1.5 rounded-lg text-xs transition-all active:scale-95 cursor-pointer font-semibold ${
                isSelected
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-[#212121] text-neutral-300 hover:text-white border border-[#2f2f2f]'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 2. Hero Station Auto-Mix Radio Card */}
      {stationState.currentTrack && (
        <div className="px-4 relative">
          <div className="relative overflow-hidden rounded-2xl bg-[#1c1c1e] border border-[#2e2e2e] p-3.5 flex flex-col gap-2 shadow-xl">
            {/* Ambient Background Swell on Toggle */}
            {stationState.currentTrack.artworkUrl && (
              <div
                key={isShockActive ? `card-surge-${isShockActive}` : 'card-ambient'}
                aria-hidden="true"
                className={`absolute inset-0 blur-2xl pointer-events-none transition-all duration-700 ${
                  isShockActive
                    ? 'animate-ambient-hulchul'
                    : isMoodMixActive
                    ? 'opacity-25'
                    : 'opacity-10'
                }`}
                style={{
                  backgroundImage: isMoodMixActive
                    ? `radial-gradient(circle at 80% 50%, ${moodTheme.glowColor} 0%, transparent 70%)`
                    : `radial-gradient(circle at 80% 50%, #ff0000 0%, transparent 70%)`,
                }}
              />
            )}

            {/* Top row: Status / Vibe on left, Mix & Refresh controls on right */}
            <div className="w-full flex items-center justify-between gap-2 z-10 pb-1 border-b border-white/[0.06]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#10b981] inline-block animate-pulse shrink-0" />
                <span className={`text-[11px] font-bold truncate ${isMoodMixActive ? 'text-amber-400' : 'text-[#ff4444]'}`}>
                  {isMoodMixActive ? `${moodTheme.iconEmoji} Mood Mix: ${detectedMood || moodTheme.name}` : 'Now Playing On Station'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onToggleMoodMix && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocalShockwave(Date.now());
                      setTimeout(() => setLocalShockwave(null), 1250);
                      onToggleMoodMix();
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer z-10 shrink-0 shadow-sm border ${
                      isShockActive ? 'animate-mix-bump' : ''
                    } ${
                      isMoodMixActive
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/20 border-amber-300/40'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] text-neutral-300 hover:text-white border-white/20'
                    }`}
                    title={isMoodMixActive ? 'Mood Mix ON: 90s Hits wapas karein' : 'Mood Mix OFF: Current song mood match karein'}
                  >
                    <Sparkles className={`w-3 h-3 ${isMoodMixActive ? 'text-yellow-200' : 'text-neutral-400'}`} />
                    <span>{isMoodMixActive ? 'MIX: ON' : '90s HITS'}</span>
                  </button>
                )}

                <button
                  onClick={onRefreshMix}
                  className="p-1.5 rounded-lg bg-[#282828] hover:bg-[#333] text-neutral-300 hover:text-white border border-white/[0.08] shrink-0 active:scale-95 transition-transform cursor-pointer z-10"
                  title="Refresh recommendations"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom row: Track Artwork + Details */}
            <div className="w-full flex items-center gap-3 z-10 pt-1">
              <div className="w-13 h-13 rounded-xl overflow-hidden bg-black shrink-0 relative border border-white/10 shadow-md">
                {stationState.currentTrack.artworkUrl ? (
                  <img
                    src={stationState.currentTrack.artworkUrl}
                    alt={stationState.currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#ff0000]/20 text-[#ff0000]">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate leading-tight">
                  {stationState.currentTrack.title}
                </p>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  {stationState.currentTrack.artist}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Section 1: Quick Picks (YouTube Music 4-row Grid) */}
      <section className="space-y-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
              Start Radio From A Song
            </span>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
              <span>Quick Picks</span>
              <Sparkles className="w-4 h-4 text-[#ff0000]" />
            </h2>
          </div>
          <button
            onClick={onRefreshMix}
            className="text-xs font-bold text-[#ff0000] hover:text-[#ff4d4d] active:opacity-70 transition-opacity cursor-pointer"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickPicks.map((track, idx) => {
            const isAddedQueue = addedQueueId === track.id;
            const isAddedNext = playNextId === track.id;

            return (
              <div
                key={`qp-${track.id}-${idx}`}
                className="p-2 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#383838] flex items-center justify-between gap-2.5 transition-colors group"
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    if (isAdmin || isSpeaker) onPlayTrackNow(track);
                    else onPlayNext(track);
                  }}
                >
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-black shrink-0 relative border border-white/10">
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div className="truncate flex-1">
                    <p className="text-xs font-bold text-white truncate leading-tight group-hover:text-[#ff4d4d] transition-colors">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {track.artist} &bull; {formatSecs(track.duration)}
                    </p>
                  </div>
                </div>

                {/* Role Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Play Next */}
                  <button
                    onClick={(e) => handlePlayNextWithFeedback(e, track)}
                    className="p-1.5 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-neutral-300 text-[10px] font-semibold active:scale-95 transition-all cursor-pointer"
                    title="Play Next"
                  >
                    {isAddedNext ? (
                      <Check className="w-3.5 h-3.5 text-[#10b981]" />
                    ) : (
                      <ListPlus className="w-3.5 h-3.5 text-[#ff0000]" />
                    )}
                  </button>

                  {/* Add to Queue */}
                  <button
                    onClick={(e) => handleAddQueueWithFeedback(e, track)}
                    className="p-1.5 rounded-lg bg-[#ff0000]/15 text-[#ff0000] hover:bg-[#ff0000]/25 active:scale-95 transition-all cursor-pointer"
                    title="Add to Queue"
                  >
                    {isAddedQueue ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Section 2: Mixed For You (Recommended Radios) */}
      {mixedForYou.length > 0 && (
        <section className="space-y-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                Continuous Music
              </span>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                <span>Mixed For Your Station</span>
                <Flame className="w-4 h-4 text-[#ff0000]" />
              </h2>
            </div>
          </div>

          <div className="space-y-2">
            {mixedForYou.slice(0, 10).map((track, idx) => (
              <div
                key={`mfy-${track.id}-${idx}`}
                className="p-2.5 rounded-2xl bg-[#141414] border border-[#222] hover:border-[#333] flex items-center justify-between gap-3 transition-colors"
              >
                <div
                  className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  onClick={() => {
                    if (isAdmin || isSpeaker) onPlayTrackNow(track);
                    else onPlayNext(track);
                  }}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 relative">
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </div>

                  <div className="truncate flex-1">
                    <p className="text-xs font-semibold text-white truncate leading-tight">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {track.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handlePlayNextWithFeedback(e, track)}
                    className="px-2 py-1 rounded-lg bg-[#222] hover:bg-[#2c2c2c] text-neutral-300 text-[10px] font-semibold active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <ListPlus className="w-3 h-3 text-[#ff0000]" />
                    <span>Next</span>
                  </button>

                  <button
                    onClick={(e) => handleAddQueueWithFeedback(e, track)}
                    className="w-7 h-7 rounded-lg bg-[#ff0000]/15 text-[#ff0000] hover:bg-[#ff0000]/25 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
