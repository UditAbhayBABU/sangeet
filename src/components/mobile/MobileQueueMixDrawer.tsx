import React, { useState } from 'react';
import {
  X,
  ListMusic,
  Radio,
  Play,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Sparkles,
  Shield,
  Clock,
  Check,
  Crown,
  Lock,
} from 'lucide-react';
import { SongTrack } from '../../types';
import { deduplicateTrackList, cleanTrackTitle } from '../../utils/trackDeduplication';

interface MobileQueueMixDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: SongTrack | null;
  adminQueue: SongTrack[];
  staffQueue: SongTrack[];
  mixTracks: SongTrack[];
  isPlaying: boolean;
  userRole: 'staff' | 'admin';
  isSpeakerNode: boolean;
  initialTab?: 'queue' | 'mix';
  onPlayTrackNow: (track: SongTrack) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onPlayNext: (track: SongTrack) => void;
  onRemoveTrack: (trackId: string, queueType: 'admin' | 'staff') => void;
  onReorderStaffQueue: (newQueue: SongTrack[]) => void;
  onReorderAdminQueue?: (newQueue: SongTrack[]) => void;
  onClearQueue: (queueType?: 'staff' | 'admin' | 'all') => void;
  isMoodMixActive?: boolean;
  detectedMood?: string;
  onToggleMoodMix?: () => void;
}

export const MobileQueueMixDrawer: React.FC<MobileQueueMixDrawerProps> = ({
  isOpen,
  onClose,
  currentTrack,
  adminQueue,
  staffQueue,
  mixTracks,
  isPlaying,
  userRole,
  isSpeakerNode,
  initialTab = 'queue',
  onPlayTrackNow,
  onAddTrackToQueue,
  onPlayNext,
  onRemoveTrack,
  onReorderStaffQueue,
  onReorderAdminQueue,
  onClearQueue,
  isMoodMixActive = false,
  detectedMood,
  onToggleMoodMix,
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'mix'>(initialTab);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [addedTrackId, setAddedTrackId] = useState<string | null>(null);

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

  if (!isOpen) return null;

  const isAdmin = userRole === 'admin';
  const isSpeaker = isSpeakerNode;
  const isRemote = !isAdmin && !isSpeaker;

  const totalManualQueue = adminQueue.length + staffQueue.length;

  const formatSecs = (secs: number) => {
    if (!secs || isNaN(secs)) return '3:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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

  const handleAddTrackFeedback = (track: SongTrack) => {
    onAddTrackToQueue(track);
    setAddedTrackId(track.id);
    setTimeout(() => setAddedTrackId(null), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Backdrop Dismiss */}
      <div className="flex-1" onClick={onClose} />

      {/* YouTube Music Up Next Bottom Sheet */}
      <div className="bg-[#181818] border-t border-[#2d2d2d] rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 md:max-w-md md:mx-auto md:w-full">
        {/* Grab Handle */}
        <div className="pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-4 py-2.5 border-b border-[#262626] flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#ff0000] block">
              Up Next &bull; Queue
            </span>
            <p className="text-xs font-bold text-white truncate">
              {currentTrack ? currentTrack.title : 'No track active'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Clear Queue if Admin or Speaker */}
            {(isAdmin || isSpeaker) && totalManualQueue > 0 && (
              <button
                onClick={() => onClearQueue(isAdmin ? 'all' : 'staff')}
                className="text-[11px] text-neutral-400 hover:text-[#ff4d4d] font-semibold px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-neutral-400 hover:text-white bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector: [ Up Next Queue ] & [ Auto-Mix Radio ] */}
        <div className="p-3 border-b border-[#242424] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-xl border border-[#2b2b2b]">
            <button
              onClick={() => setActiveTab('queue')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'queue' ? 'bg-[#ff0000] text-white shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" />
              <span>Queue ({totalManualQueue})</span>
            </button>

            <button
              onClick={() => setActiveTab('mix')}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mix' ? 'bg-[#ff0000] text-white shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Autoplay Mix ({distinctMixTracks.length})</span>
            </button>
          </div>

          {/* Autoplay Toggle Switch */}
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 pr-1">
            <span className="text-[11px] font-medium">Autoplay</span>
            <button
              onClick={() => setAutoplayEnabled(!autoplayEnabled)}
              className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${
                autoplayEnabled ? 'bg-[#ff0000]' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.25 transition-transform ${
                  autoplayEnabled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-[320px]">
          {/* 1. NOW PLAYING CARD */}
          {currentTrack && (
            <div className="p-3 rounded-2xl bg-[#222222] border border-[#333] flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-black shrink-0 relative">
                  {currentTrack.artworkUrl ? (
                    <img src={currentTrack.artworkUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#ff0000]/20 text-[#ff0000]">
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
                      <span className="w-1 h-3 bg-[#ff0000] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-2 bg-[#ff0000] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>

                <div className="truncate">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#ff0000] flex items-center gap-1">
                    <span>Now Playing</span>
                    {currentTrack.priority === 'admin_instant' || currentTrack.priority === 'admin_high' ? (
                      <span className="text-white bg-[#ff0000] px-1 py-0.2 rounded text-[8px]">On Priority</span>
                    ) : null}
                  </span>
                  <p className="text-xs font-bold text-white truncate leading-tight mt-0.5">
                    {currentTrack.title}
                  </p>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {currentTrack.artist} &bull; {formatSecs(currentTrack.duration)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queue' ? (
            <>
              {/* 2. ON PRIORITY (ADMIN QUEUE) SECTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <Crown className="w-4 h-4 text-[#ff0000]" />
                    <span className="text-[#ff4d4d]">On Priority</span>
                    <span className="text-[10px] text-neutral-500 font-normal">
                      ({adminQueue.length})
                    </span>
                  </div>

                  {!isAdmin && adminQueue.length > 0 && (
                    <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>Priority Lock</span>
                    </span>
                  )}
                </div>

                {adminQueue.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#121212] border border-dashed border-[#282828] text-center text-xs text-neutral-500">
                    No songs currently on priority.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {adminQueue.map((track, idx) => (
                      <div
                        key={`drawer-admin-${track.id}-${idx}`}
                        className="p-2.5 rounded-xl bg-[#201414] border border-[#ff0000]/30 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-xs font-mono font-bold text-[#ff0000] w-4 text-center">
                            {idx + 1}
                          </span>
                          <div className="w-9 h-9 rounded-md overflow-hidden bg-black shrink-0">
                            {track.artworkUrl ? (
                              <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="truncate flex-1">
                            <p className="text-xs font-bold text-white truncate leading-tight">
                              {track.title}
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              {track.artist} &bull; <span className="text-[#ff4d4d] font-semibold">Priority</span>
                            </p>
                          </div>
                        </div>

                        {/* Admin Reorder / Delete Controls */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMoveAdminQueueItem(idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1 text-neutral-400 hover:text-white disabled:opacity-20"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveAdminQueueItem(idx, idx + 1)}
                              disabled={idx === adminQueue.length - 1}
                              className="p-1 text-neutral-400 hover:text-white disabled:opacity-20"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRemoveTrack(track.id, 'admin')}
                              className="p-1 text-neutral-400 hover:text-[#ff4d4d]"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. UP NEXT (STAFF / REMOTE QUEUE) SECTION */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <ListMusic className="w-4 h-4 text-neutral-400" />
                    <span>Up Next</span>
                    <span className="text-[10px] text-neutral-500 font-normal">
                      (Staff Queue &bull; {staffQueue.length})
                    </span>
                  </div>
                </div>

                {staffQueue.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#121212] border border-dashed border-[#282828] text-center text-xs text-neutral-500 space-y-1">
                    <p>Staff queue is currently empty.</p>
                    <p className="text-[11px] text-neutral-600">
                      Search se gaana dhoond kar <span className="text-white font-semibold">"Play Next"</span> ya <span className="text-white font-semibold">"Add to Queue"</span> karein.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {staffQueue.map((track, idx) => (
                      <div
                        key={`drawer-staff-${track.id}-${idx}`}
                        className="p-2.5 rounded-xl bg-[#1a1a1a] border border-[#2b2b2b] flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-xs font-mono font-bold text-neutral-400 w-4 text-center">
                            {idx + 1}
                          </span>
                          <div className="w-9 h-9 rounded-md overflow-hidden bg-black shrink-0">
                            {track.artworkUrl ? (
                              <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="truncate flex-1">
                            <p className="text-xs font-semibold text-white truncate leading-tight">
                              {track.title}
                            </p>
                            <p className="text-[10px] text-neutral-400 truncate">
                              {track.artist} &bull; {track.requestedBy || 'Staff'}
                            </p>
                          </div>
                        </div>

                        {/* Reorder / Delete for Admin or Speaker */}
                        {(isAdmin || isSpeaker) && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMoveStaffQueueItem(idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveStaffQueueItem(idx, idx + 1)}
                              disabled={idx === staffQueue.length - 1}
                              className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onRemoveTrack(track.id, 'staff')}
                              className="p-1 text-neutral-400 hover:text-[#ff4d4d] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          {/* 4. AUTOPLAY RADIO RECOMMENDATIONS */}
          {(activeTab === 'mix' || staffQueue.length === 0) && (
            <div className="space-y-2 pt-2 border-t border-[#242424]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-gradient-to-r from-red-600/10 via-orange-500/10 to-transparent border border-red-500/20">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#ff0000]" />
                    <span className="text-xs font-bold text-white">Autoplay Mix Engine</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-neutral-300">
                      {isMoodMixActive ? '✨ Mood Match' : '📻 90s Hits'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    {isMoodMixActive
                      ? `Matching: ${displayMood}`
                      : 'Default 90s Bollywood Evergreen Hits'}
                  </p>
                </div>

                {onToggleMoodMix && (
                  <button
                    onClick={onToggleMoodMix}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer self-start sm:self-auto border ${
                      isMoodMixActive
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md border-amber-300/40'
                        : 'bg-white/[0.08] hover:bg-white/[0.14] text-neutral-300 hover:text-white border-white/20'
                    }`}
                    title={isMoodMixActive ? 'Mood Mix ON: 90s Hits wapas karein' : 'Mood Mix OFF: Current song mood match karein'}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isMoodMixActive ? 'text-yellow-200' : 'text-neutral-400'}`} />
                    <span>{isMoodMixActive ? 'MIX: ON' : '📻 90s HITS (MIX: OFF)'}</span>
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                {distinctMixTracks.map((track, idx) => (
                  <div
                    key={`drawer-mix-${track.id}-${idx}`}
                    className="p-2 rounded-xl bg-[#141414] border border-[#242424] hover:border-[#383838] flex items-center justify-between gap-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md overflow-hidden bg-black shrink-0">
                        {track.artworkUrl ? (
                          <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="truncate flex-1">
                        <p className="text-xs font-medium text-white truncate leading-tight">
                          {track.title}
                        </p>
                        <p className="text-[10px] text-neutral-400 truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Play Next Button */}
                      <button
                        onClick={() => onPlayNext(track)}
                        className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 text-[10px] font-semibold active:scale-95 transition-all cursor-pointer"
                        title="Play Next"
                      >
                        Play Next
                      </button>

                      {/* Add to Queue Button */}
                      <button
                        onClick={() => handleAddTrackFeedback(track)}
                        className="w-7 h-7 rounded-lg bg-[#ff0000]/15 text-[#ff0000] hover:bg-[#ff0000]/25 flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                        title="Queue mein dalein"
                      >
                        {addedTrackId === track.id ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
