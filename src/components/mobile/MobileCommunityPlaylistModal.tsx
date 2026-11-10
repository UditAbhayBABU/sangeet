import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Play,
  Shuffle,
  ListPlus,
  ArrowRightToLine,
  Loader2,
  ListMusic,
  Disc3,
  Clock,
  Sparkles,
  Check,
  Share2,
} from 'lucide-react';
import { SongTrack, CommunityPlaylist } from '../../types';

interface MobileCommunityPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: CommunityPlaylist | null;
  onPlayTrackNow: (track: SongTrack) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onPlayNext: (track: SongTrack) => void;
  userRole: 'staff' | 'admin';
  currentTrackIsAdmin?: boolean;
}

export const MobileCommunityPlaylistModal: React.FC<MobileCommunityPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onPlayTrackNow,
  onAddTrackToQueue,
  onPlayNext,
  userRole,
  currentTrackIsAdmin = false,
}) => {
  const [tracks, setTracks] = useState<SongTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [addedQueueId, setAddedQueueId] = useState<string | null>(null);
  const [playNextId, setPlayNextId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';
  const canPlayNow = isAdmin || !currentTrackIsAdmin;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  useEffect(() => {
    if (!isOpen || !playlist?.id) {
      setTracks([]);
      setError(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/music/playlists/${encodeURIComponent(playlist.id)}/tracks`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setTracks(data.tracks);
        } else {
          setError('Unable to load tracks for this playlist');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Error fetching playlist tracks:', err);
        setError('Network error loading playlist');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, playlist?.id]);

  const totalDurationMinutes = useMemo(() => {
    const totalSecs = tracks.reduce((acc, t) => acc + (t.duration || 210), 0);
    const mins = Math.floor(totalSecs / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours} hr ${remMins} min`;
    }
    return `${mins} min`;
  }, [tracks]);

  const formatSecs = (secs?: number) => {
    if (!secs || isNaN(secs)) return '3:30';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePlayAll = () => {
    if (!tracks.length) return;
    onPlayTrackNow(tracks[0]);
    if (tracks.length > 1) {
      tracks.slice(1).forEach((t) => onAddTrackToQueue(t));
      showToast(`Playing playlist (${tracks.length} songs added)`);
    } else {
      showToast('Playing track');
    }
  };

  const handleShufflePlay = () => {
    if (!tracks.length) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    onPlayTrackNow(shuffled[0]);
    if (shuffled.length > 1) {
      shuffled.slice(1).forEach((t) => onAddTrackToQueue(t));
      showToast(`Shuffle playing (${shuffled.length} songs)`);
    } else {
      showToast('Playing track');
    }
  };

  const handleAddAllToQueue = () => {
    if (!tracks.length) return;
    tracks.forEach((t) => onAddTrackToQueue(t));
    showToast(`Added all ${tracks.length} songs to queue`);
  };

  const handlePlayNextWithFeedback = (track: SongTrack) => {
    onPlayNext(track);
    setPlayNextId(track.id);
    showToast('Will play next');
    setTimeout(() => setPlayNextId(null), 1400);
  };

  const handleAddToQueueWithFeedback = (track: SongTrack) => {
    onAddTrackToQueue(track);
    setAddedQueueId(track.id);
    showToast('Added to queue');
    setTimeout(() => setAddedQueueId(null), 1400);
  };

  if (!isOpen || !playlist) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#030303] flex flex-col md:max-w-md md:mx-auto select-none overflow-hidden animate-in fade-in duration-200">
      {/* 1. Sticky Navigation Header */}
      <div className="sticky top-0 z-20 bg-[#030303]/95 backdrop-blur-xl px-4 py-3.5 flex items-center justify-between border-b border-white/[0.08]">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-neutral-300 hover:text-white transition-all cursor-pointer"
          title="Back to search"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 mx-3 text-center min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#ff0000] flex items-center justify-center gap-1">
            <ListMusic className="w-3 h-3 text-[#ff0000]" />
            <span>Community Playlist</span>
          </p>
          <h2 className="text-sm font-bold text-white truncate">
            {playlist.title}
          </h2>
        </div>

        <button
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(playlist.url || window.location.href);
              showToast('Playlist link copied!');
            }
          }}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer"
          title="Share Playlist"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-6">
        {/* Playlist Hero Artwork & Meta */}
        <div className="pt-4 flex flex-col items-center text-center">
          {/* Layered Stacked Artwork (YouTube Signature Look) */}
          <div className="relative group mb-4">
            {/* Background layered card 1 */}
            <div className="absolute -top-2 inset-x-3 h-4 bg-white/10 rounded-2xl blur-[1px] transform -translate-y-1 scale-95" />
            {/* Background layered card 2 */}
            <div className="absolute -top-1 inset-x-1.5 h-3 bg-white/15 rounded-2xl transform -translate-y-0.5 scale-[0.98]" />

            {/* Main Cover */}
            <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-[#181818] border border-white/15 shadow-2xl relative">
              <img
                src={playlist.thumbnail || `https://i.ytimg.com/vi/${playlist.id}/hqdefault.jpg`}
                alt={playlist.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* YouTube Style Overlay Badge */}
              <div className="absolute inset-x-0 bottom-0 py-1.5 px-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/90 font-bold flex items-center gap-1">
                  <ListMusic className="w-3.5 h-3.5 text-[#ff0000]" />
                  <span>{tracks.length > 0 ? `${tracks.length} songs` : playlist.videoCount ? `${playlist.videoCount} songs` : 'Playlist'}</span>
                </span>
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#ff4d4d] bg-[#ff0000]/20 px-1.5 py-0.5 rounded border border-[#ff0000]/30">
                  YouTube
                </span>
              </div>
            </div>
          </div>

          {/* Title & Curator Info */}
          <h1 className="text-lg sm:text-xl font-extrabold text-white leading-snug max-w-sm px-2">
            {playlist.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 font-medium flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-neutral-200 font-semibold">{playlist.author}</span>
            <span>&bull;</span>
            <span className="text-[#ff4d4d] font-semibold">Community playlist</span>
            {tracks.length > 0 && (
              <>
                <span>&bull;</span>
                <span className="text-neutral-400">{totalDurationMinutes}</span>
              </>
            )}
          </p>

          {/* Primary Action Buttons: Play All, Shuffle, Add All */}
          <div className="flex items-center justify-center gap-2.5 mt-5 w-full max-w-sm">
            <button
              onClick={handlePlayAll}
              disabled={isLoading || tracks.length === 0}
              className="flex-1 py-2.5 px-4 rounded-full bg-white hover:bg-neutral-200 active:scale-95 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-black" />
              <span>Play All</span>
            </button>

            <button
              onClick={handleShufflePlay}
              disabled={isLoading || tracks.length === 0}
              className="flex-1 py-2.5 px-4 rounded-full bg-[#212121] hover:bg-[#2a2a2a] active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shuffle className="w-4 h-4 text-neutral-300" />
              <span>Shuffle</span>
            </button>

            <button
              onClick={handleAddAllToQueue}
              disabled={isLoading || tracks.length === 0}
              className="w-10 h-10 rounded-full bg-[#212121] hover:bg-[#2a2a2a] active:scale-95 text-neutral-300 hover:text-white flex items-center justify-center border border-white/10 shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add all to queue"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. Track List Section */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs text-neutral-400 pb-1 border-b border-white/[0.06]">
            <span className="font-bold uppercase tracking-wider text-[11px] text-neutral-300 flex items-center gap-1.5">
              <Disc3 className="w-3.5 h-3.5 text-[#ff0000]" />
              <span>Tracks in this Playlist</span>
            </span>
            <span className="font-mono text-[11px] text-neutral-400">
              {isLoading ? 'Loading...' : `${tracks.length} songs`}
            </span>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-[#ff0000] animate-spin" />
              <p className="text-xs text-neutral-400 font-medium">
                Fetching community tracks from YouTube...
              </p>
            </div>
          )}

          {/* Error Fallback */}
          {!isLoading && error && (
            <div className="py-10 text-center space-y-3 bg-[#121212] rounded-2xl border border-white/5 p-4">
              <Disc3 className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs text-neutral-300 font-medium">{error}</p>
              <button
                onClick={() => {
                  setIsLoading(true);
                  setError(null);
                  fetch(`/api/music/playlists/${encodeURIComponent(playlist.id)}/tracks`)
                    .then((r) => r.json())
                    .then((d) => {
                      if (d.success && d.tracks) setTracks(d.tracks);
                      else setError('Failed to load playlist');
                    })
                    .catch(() => setError('Network error'))
                    .finally(() => setIsLoading(false));
                }}
                className="px-4 py-1.5 rounded-full bg-[#ff0000] text-white text-xs font-bold active:scale-95 transition-all"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty Playlist Notice */}
          {!isLoading && !error && tracks.length === 0 && (
            <div className="py-10 text-center text-xs text-neutral-400">
              No playable songs found in this community playlist.
            </div>
          )}

          {/* Tracks List */}
          {!isLoading && tracks.length > 0 && (
            <div className="space-y-1.5">
              {tracks.map((track, idx) => {
                const isAdded = addedQueueId === track.id;
                const isNext = playNextId === track.id;

                return (
                  <div
                    key={track.id || idx}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-[#181818] active:bg-[#202020] transition-colors group cursor-pointer border border-transparent hover:border-white/5"
                    onClick={() => {
                      if (canPlayNow) {
                        onPlayTrackNow(track);
                        showToast(`Playing "${track.title}"`);
                      } else {
                        handleAddToQueueWithFeedback(track);
                      }
                    }}
                  >
                    {/* Track Number / Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 relative border border-white/10 group-hover:border-[#ff0000]/40 transition-colors">
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-neutral-500">
                          {idx + 1}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>

                    {/* Title & Artist */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-red-400 transition-colors">
                        {track.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                        {track.artist}
                      </p>
                    </div>

                    {/* Duration */}
                    <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                      {formatSecs(track.duration)}
                    </span>

                    {/* Actions: Play Next & Queue Buttons */}
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handlePlayNextWithFeedback(track)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isNext
                            ? 'bg-amber-500 text-black'
                            : 'bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white'
                        }`}
                        title="Play Next"
                      >
                        {isNext ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <ArrowRightToLine className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddToQueueWithFeedback(track)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isAdded
                            ? 'bg-emerald-500 text-black'
                            : 'bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white'
                        }`}
                        title="Add to Queue"
                      >
                        {isAdded ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <ListPlus className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-white/20 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#ff0000]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
