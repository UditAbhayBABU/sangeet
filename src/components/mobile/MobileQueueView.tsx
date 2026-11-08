import React, { useState } from 'react';
import {
  Crown,
  ListMusic,
  Radio,
  Play,
  Pause,
  SkipForward,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Sparkles,
  RefreshCw,
  Check,
  Search,
  Music,
} from 'lucide-react';
import { SongTrack, StationState } from '../../types';
import { getMoodTheme } from '../../utils/moodTheme';
import { deduplicateTrackList, cleanTrackTitle } from '../../utils/trackDeduplication';

interface MobileQueueViewProps {
  stationState: StationState;
  userRole: 'staff' | 'admin';
  isSpeakerNode: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSkipNext: () => void;
  onPlayTrackNow: (track: SongTrack) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onPlayNext: (track: SongTrack) => void;
  onRemoveTrack: (trackId: string, queueType: 'admin' | 'staff') => void;
  onReorderStaffQueue: (newQueue: SongTrack[]) => void;
  onReorderAdminQueue?: (newQueue: SongTrack[]) => void;
  onClearQueue: (queueType?: 'staff' | 'admin' | 'all') => void;
  onRefreshMix: () => void;
  onNavigateToSearch: () => void;
  isMoodMixActive?: boolean;
  detectedMood?: string;
  mixShockwaveKey?: number | null;
  onToggleMoodMix?: () => void;
}

export const MobileQueueView: React.FC<MobileQueueViewProps> = ({
  stationState,
  userRole,
  isSpeakerNode,
  currentTime,
  duration,
  onPlayPause,
  onSkipNext,
  onPlayTrackNow,
  onAddTrackToQueue,
  onPlayNext,
  onRemoveTrack,
  onReorderStaffQueue,
  onReorderAdminQueue,
  onClearQueue,
  onRefreshMix,
  onNavigateToSearch,
  isMoodMixActive = false,
  detectedMood,
  mixShockwaveKey,
  onToggleMoodMix,
}) => {
  const [filterView, setFilterView] = useState<'all' | 'queue' | 'mix'>('all');
  const [addedTrackId, setAddedTrackId] = useState<string | null>(null);
  const [localShockwave, setLocalShockwave] = useState<number | null>(null);

  const isAdmin = userRole === 'admin';
  const isCurrentAdminTrack = Boolean(
    stationState.currentTrack &&
    (stationState.currentTrack.priority === 'admin_instant' ||
     stationState.currentTrack.priority === 'admin_high' ||
     stationState.currentTrack.requestedBy === 'Station Admin' ||
     stationState.currentTrack.requestedBy === 'Admin')
  );
  const canControlPlayback = isAdmin || (isSpeakerNode && !isCurrentAdminTrack);

  const currentTrack = stationState.currentTrack;
  const isPlaying = stationState.playbackState?.isPlaying;
  const adminQueue = stationState.adminQueue || [];
  const staffQueue = stationState.staffQueue || [];
  const mixTracks = stationState.recommendations || [];
  const totalManualQueue = adminQueue.length + staffQueue.length;

  const moodTheme = getMoodTheme(detectedMood);
  const isShockActive = Boolean(mixShockwaveKey || localShockwave);

  // Robust Deep Music De-Cluttering & Deduplication for Mix Queue
  // Guaranteed: NEVER shows currently playing track, NEVER duplicates tracks, NEVER repeats queue songs
  const distinctMixTracks = React.useMemo(() => {
    const combinedManualQueue = [...adminQueue, ...staffQueue];
    return deduplicateTrackList(mixTracks, currentTrack, combinedManualQueue, 40);
  }, [mixTracks, currentTrack, adminQueue, staffQueue]);

  const displayMood = React.useMemo(() => {
    if (!detectedMood) return '✨ YouTube Radio Mix';
    if (/t-?series|zee\s*music|tips|yrf|sony|saregama|speed\s*records/i.test(detectedMood)) {
      return currentTrack ? `✨ ${cleanTrackTitle(currentTrack.title).slice(0, 24)} Radio Mix` : '✨ YouTube Radio Mix';
    }
    return detectedMood;
  }, [detectedMood, currentTrack]);

  const formatSecs = (secs: number) => {
    if (!secs || isNaN(secs)) return '3:30';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAddTrackFeedback = (track: SongTrack) => {
    onAddTrackToQueue(track);
    setAddedTrackId(track.id);
    setTimeout(() => setAddedTrackId(null), 1200);
  };

  const handleMoveStaffQueueItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= staffQueue.length) return;
    const updated = [...staffQueue];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onReorderStaffQueue(updated);
  };

  const handleMoveAdminQueueItem = (fromIndex: number, toIndex: number) => {
    if (!isAdmin || !onReorderAdminQueue) return;
    if (toIndex < 0 || toIndex >= adminQueue.length) return;
    const updated = [...adminQueue];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onReorderAdminQueue(updated);
  };

  return (
    <div className="p-4 space-y-5 pb-36 select-none animate-in fade-in duration-200">
      {/* 1. Header & Summary Strip */}
      <div className="bg-[#141416] border border-[#26262a] rounded-2xl p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#ff0000] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-[#ff4444]">
                Station Playback Manager
              </span>
            </div>
            <h1 className="text-xl font-black text-white mt-0.5 tracking-tight">
              Up Next &bull; Priority Queue
            </h1>
            <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{totalManualQueue} songs queued</span>
              <span className="text-neutral-600">&bull;</span>
              <span>{distinctMixTracks.length} auto-mix standby</span>
              {isMoodMixActive && (
                <>
                  <span className="text-neutral-600">&bull;</span>
                  <span className="text-amber-400 font-semibold">{displayMood}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canControlPlayback && totalManualQueue > 0 && (
              <button
                onClick={() => onClearQueue(isAdmin ? 'all' : 'staff')}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800/80 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-700/60 text-[11px] font-semibold transition-all active:scale-95 cursor-pointer"
                title="Clear queued tracks"
              >
                Clear Queue
              </button>
            )}

            <button
              onClick={onNavigateToSearch}
              className="px-3 py-1.5 rounded-lg bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              title="Add song to queue"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Structured Segmented View Controls */}
        <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterView('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              filterView === 'all'
                ? 'bg-white text-black shadow-sm'
                : 'bg-[#212124] text-neutral-400 hover:text-white border border-[#2f2f34]'
            }`}
          >
            All Stream ({totalManualQueue + (currentTrack ? 1 : 0)})
          </button>

          <button
            onClick={() => setFilterView('queue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              filterView === 'queue'
                ? 'bg-white text-black shadow-sm'
                : 'bg-[#212124] text-neutral-400 hover:text-white border border-[#2f2f34]'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Priority & Queue ({totalManualQueue})</span>
          </button>

          <button
            onClick={() => setFilterView('mix')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              filterView === 'mix'
                ? 'bg-white text-black shadow-sm'
                : 'bg-[#212124] text-neutral-400 hover:text-white border border-[#2f2f34]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Auto-Mix Radar ({distinctMixTracks.length})</span>
          </button>
        </div>
      </div>

      {/* 2. SECTION: NOW PLAYING / ON AIR */}
      {currentTrack && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                Broadcasting Live On Station
              </span>
            </div>
            {currentTrack.priority === 'admin_instant' || currentTrack.priority === 'admin_high' ? (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Crown className="w-3 h-3" />
                <span>Priority Override</span>
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-neutral-400">
                {isMoodMixActive ? 'Mood Mix' : 'Station Radio'}
              </span>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c1c20] to-[#141416] border border-[#2d2d34] p-3.5 shadow-xl">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0 relative border border-white/10 shadow-md">
                {currentTrack.artworkUrl ? (
                  <img
                    src={currentTrack.artworkUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#ff0000]/20 text-[#ff0000]">
                    <Music className="w-6 h-6" />
                  </div>
                )}
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center gap-0.5 backdrop-blur-[1px]">
                    <span className="w-1 h-3.5 bg-[#ff0000] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-3 bg-[#ff0000] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-black text-white truncate leading-tight">
                  {currentTrack.title}
                </h3>
                <p className="text-xs text-neutral-300 truncate mt-1">
                  {currentTrack.artist}
                </p>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-neutral-400">
                  <span className="font-mono text-white/80">
                    {formatSecs(currentTime)} / {formatSecs(duration || currentTrack.duration)}
                  </span>
                  <span>&bull;</span>
                  <span className="truncate">
                    {currentTrack.requestedBy ? `Req by ${currentTrack.requestedBy}` : 'Station Stream'}
                  </span>
                </div>
              </div>

              {canControlPlayback && (
                <div className="flex items-center gap-1.5 shrink-0 pl-1">
                  <button
                    onClick={onPlayPause}
                    className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-black text-black" />
                    ) : (
                      <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                    )}
                  </button>

                  <button
                    onClick={onSkipNext}
                    className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer border border-neutral-700"
                    title="Skip to next track"
                  >
                    <SkipForward className="w-4 h-4 fill-current" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. SECTION: ADMIN / HIGH PRIORITY QUEUE (If 'all' or 'queue') */}
      {(filterView === 'all' || filterView === 'queue') && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-400">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Priority Queue (Plays First)</span>
              <span className="text-[10px] text-neutral-400 font-bold ml-1 px-1.5 py-0.2 rounded bg-amber-400/10 border border-amber-400/20">
                {adminQueue.length}
              </span>
            </div>

            {isAdmin && (
              <span className="text-[10px] text-amber-300 font-medium">Admin Managed</span>
            )}
          </div>

          {adminQueue.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-[#141417] border border-dashed border-[#2d2d34] text-center text-xs text-neutral-500">
              No priority tracks queued. Regular queue or Auto-Mix plays next.
            </div>
          ) : (
            <div className="space-y-2">
              {adminQueue.map((track, idx) => (
                <div
                  key={`admin-q-${track.id}-${idx}`}
                  className="rounded-xl bg-[#19191d] border border-amber-500/30 p-2.5 flex items-center justify-between gap-3 shadow-md hover:border-amber-400/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 text-center text-xs font-black text-amber-400 shrink-0">
                      #{idx + 1}
                    </span>

                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-black shrink-0 relative border border-white/10">
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-amber-500/20 text-amber-400">
                          <Play className="w-4 h-4 fill-current" />
                        </div>
                      )}
                    </div>

                    <div className="truncate flex-1">
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.artist} &bull; {formatSecs(track.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {canControlPlayback && (
                      <button
                        onClick={() => onPlayTrackNow(track)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white text-neutral-200 hover:text-black transition-colors cursor-pointer"
                        title="Play right now"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    {isAdmin && onReorderAdminQueue && (
                      <>
                        <button
                          disabled={idx === 0}
                          onClick={() => handleMoveAdminQueueItem(idx, idx - 1)}
                          className={`p-1.5 rounded-lg border border-neutral-700 ${
                            idx === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-700 text-neutral-300 cursor-pointer'
                          }`}
                          title="Move Up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          disabled={idx === adminQueue.length - 1}
                          onClick={() => handleMoveAdminQueueItem(idx, idx + 1)}
                          className={`p-1.5 rounded-lg border border-neutral-700 ${
                            idx === adminQueue.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-700 text-neutral-300 cursor-pointer'
                          }`}
                          title="Move Down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </>
                    )}

                    {(isAdmin || isSpeakerNode) && (
                      <button
                        onClick={() => onRemoveTrack(track.id, 'admin')}
                        className="p-1.5 rounded-lg hover:bg-red-950/40 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Remove from Priority"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 4. SECTION: STAFF & LISTENER QUEUE (If 'all' or 'queue') */}
      {(filterView === 'all' || filterView === 'queue') && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-neutral-300">
              <ListMusic className="w-4 h-4 text-[#ff0000]" />
              <span>Staff & Listener Queue</span>
              <span className="text-[10px] text-neutral-400 font-bold ml-1 px-1.5 py-0.2 rounded bg-neutral-800 border border-neutral-700">
                {staffQueue.length}
              </span>
            </div>

            <button
              onClick={onNavigateToSearch}
              className="text-[11px] font-semibold text-[#ff4444] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Search className="w-3 h-3" />
              <span>Search & Add</span>
            </button>
          </div>

          {staffQueue.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#141417] border border-[#26262c] text-center space-y-2">
              <p className="text-xs text-neutral-400">
                Queue is empty. Songs requested by staff or listeners appear here.
              </p>
              <button
                onClick={onNavigateToSearch}
                className="px-3.5 py-1.5 rounded-lg bg-[#222226] hover:bg-[#2c2c32] text-xs font-semibold text-neutral-200 border border-neutral-700/60 inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#ff0000]" />
                <span>Add Songs from Catalog</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {staffQueue.map((track, idx) => (
                <div
                  key={`staff-q-${track.id}-${idx}`}
                  className="rounded-xl bg-[#19191d] border border-[#2b2b32] p-2.5 flex items-center justify-between gap-3 shadow-md hover:border-[#3d3d46] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 text-center text-xs font-bold text-neutral-500 shrink-0">
                      #{idx + 1}
                    </span>

                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-black shrink-0 relative border border-white/10">
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#ff0000]/20 text-[#ff0000]">
                          <Play className="w-4 h-4 fill-current" />
                        </div>
                      )}
                    </div>

                    <div className="truncate flex-1">
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.artist} &bull; {formatSecs(track.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {canControlPlayback && (
                      <button
                        onClick={() => onPlayTrackNow(track)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white text-neutral-200 hover:text-black transition-colors cursor-pointer"
                        title="Play right now"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    <button
                      disabled={idx === 0}
                      onClick={() => handleMoveStaffQueueItem(idx, idx - 1)}
                      className={`p-1.5 rounded-lg border border-neutral-700 ${
                        idx === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-700 text-neutral-300 cursor-pointer'
                      }`}
                      title="Move Up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      disabled={idx === staffQueue.length - 1}
                      onClick={() => handleMoveStaffQueueItem(idx, idx + 1)}
                      className={`p-1.5 rounded-lg border border-neutral-700 ${
                        idx === staffQueue.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-neutral-700 text-neutral-300 cursor-pointer'
                      }`}
                      title="Move Down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    <button
                      onClick={() => onRemoveTrack(track.id, 'staff')}
                      className="p-1.5 rounded-lg hover:bg-red-950/40 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove from Queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 5. SECTION: STATION AUTO-MIX RADAR (If 'all' or 'mix') */}
      {(filterView === 'all' || filterView === 'mix') && (
        <section className="space-y-3">
          {/* Section Header with Smart Mix Controls */}
          <div className="p-3.5 rounded-2xl bg-[#17171a] border border-[#2c2c34] space-y-3 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#ff4444]" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-white">
                    Station Auto-Mix Radar
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Streams seamlessly when queue finishes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onToggleMoodMix && (
                  <button
                    onClick={() => {
                      setLocalShockwave(Date.now());
                      setTimeout(() => setLocalShockwave(null), 1200);
                      onToggleMoodMix();
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border ${
                      isShockActive ? 'animate-mix-bump' : ''
                    } ${
                      isMoodMixActive
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/20 border-amber-300/40'
                        : 'bg-white/10 hover:bg-white/15 text-neutral-300 hover:text-white border-white/15'
                    }`}
                    title={isMoodMixActive ? 'Mood Mix ON: Tap to switch to 90s Hits' : 'Mood Mix OFF: Tap to match track mood'}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isMoodMixActive ? 'text-yellow-200' : 'text-neutral-400'}`} />
                    <span>{isMoodMixActive ? 'MIX: ON' : '90s HITS'}</span>
                  </button>
                )}

                <button
                  onClick={onRefreshMix}
                  className="p-2 rounded-xl bg-[#25252b] hover:bg-[#303038] text-neutral-300 hover:text-white border border-white/10 shrink-0 active:scale-95 transition-transform cursor-pointer"
                  title="Generate fresh upcoming tracks"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Current Vibe indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs">
              <span className="text-neutral-400">Station Vibe Mode:</span>
              <span className={`font-semibold ${isMoodMixActive ? 'text-amber-400' : 'text-neutral-200'}`}>
                {isMoodMixActive
                  ? `${moodTheme.iconEmoji} ${detectedMood || moodTheme.name}`
                  : '📻 90s Evergreen Bollywood Hits'}
              </span>
            </div>
          </div>

          {/* Upcoming Track List Header Info */}
          <div className="flex items-center justify-between px-1 text-[11px] text-neutral-400">
            <span>Upcoming Continuous Stream</span>
            <span className="font-mono bg-neutral-800/90 text-neutral-200 px-2 py-0.5 rounded-full border border-neutral-700 text-[10px] font-bold">
              {distinctMixTracks.length} tracks ready
            </span>
          </div>

          {/* Upcoming Track List */}
          <div className="space-y-2">
            {distinctMixTracks.map((track, idx) => {
              const isAdded = addedTrackId === track.id;
              return (
                <div
                  key={`mix-radar-${track.id}-${idx}`}
                  className="rounded-xl bg-[#17171a] border border-[#27272e] p-2.5 flex items-center justify-between gap-3 hover:border-neutral-700 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-5 text-center text-xs font-semibold text-neutral-600 shrink-0">
                      {idx + 1}
                    </span>

                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-black shrink-0 relative border border-white/10">
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-neutral-400">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="truncate flex-1">
                      <p className="text-xs font-bold text-white truncate leading-tight">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.artist} &bull; {formatSecs(track.duration)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAddTrackFeedback(track)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                        isAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#26262e] hover:bg-[#34343e] text-neutral-300 hover:text-white border border-white/10'
                      }`}
                      title="Add to queue"
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Queued</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Queue</span>
                        </>
                      )}
                    </button>

                    {canControlPlayback && (
                      <button
                        onClick={() => onPlayTrackNow(track)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white text-neutral-300 hover:text-black transition-colors cursor-pointer"
                        title="Play immediately"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
