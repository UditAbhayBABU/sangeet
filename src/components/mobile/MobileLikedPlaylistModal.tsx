import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Play,
  Heart,
  MoreVertical,
  Shuffle,
  Search,
  ListPlus,
  ArrowRightToLine,
  ArrowDownUp,
  X,
  Trash2,
  Check,
  Disc3,
  Sparkles,
} from 'lucide-react';
import { SongTrack } from '../../types';

interface MobileLikedPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  likedTracks: SongTrack[];
  stationName: string;
  onPlayTrackNow: (track: SongTrack) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onPlayNext: (track: SongTrack) => void;
  onRemoveLikedTrack: (trackId: string) => void;
}

export const MobileLikedPlaylistModal: React.FC<MobileLikedPlaylistModalProps> = ({
  isOpen,
  onClose,
  likedTracks,
  stationName,
  onPlayTrackNow,
  onAddTrackToQueue,
  onPlayNext,
  onRemoveLikedTrack,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'az' | 'artist'>('recent');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when activated
  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Filter & sort tracks
  const displayedTracks = useMemo(() => {
    let list = [...likedTracks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'az') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist') {
      list.sort((a, b) => a.artist.localeCompare(b.artist));
    }
    // 'recent' retains original addedAt order (newest first)

    return list;
  }, [likedTracks, searchQuery, sortBy]);

  // Total duration in minutes
  const totalDurationMinutes = useMemo(() => {
    const totalSecs = likedTracks.reduce((acc, t) => acc + (t.duration || 180), 0);
    const mins = Math.floor(totalSecs / 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours} hr ${remMins} min`;
    }
    return `${mins} min`;
  }, [likedTracks]);

  if (!isOpen) return null;

  // Format track duration
  const formatTime = (secs?: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '3:45';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Action 1: Play All (Play first track and queue rest)
  const handlePlayAll = () => {
    if (likedTracks.length === 0) return;
    onPlayTrackNow(likedTracks[0]);
    for (let i = 1; i < likedTracks.length; i++) {
      onAddTrackToQueue(likedTracks[i]);
    }
    showToast(`Playing ${likedTracks.length} liked tracks`);
  };

  // 3-Dot Menu Action 1: Shuffle Play
  const handleShufflePlay = () => {
    if (likedTracks.length === 0) return;
    const shuffled = [...likedTracks].sort(() => Math.random() - 0.5);
    onPlayTrackNow(shuffled[0]);
    for (let i = 1; i < shuffled.length; i++) {
      onAddTrackToQueue(shuffled[i]);
    }
    setIsMenuOpen(false);
    showToast('Shuffle play started');
  };

  // 3-Dot Menu Action 2: Find in playlist
  const handleFindInPlaylist = () => {
    setIsMenuOpen(false);
    setIsSearchActive(true);
  };

  // 3-Dot Menu Action 3: Play next (inserts after current track)
  const handlePlayNextAll = () => {
    if (likedTracks.length === 0) return;
    // Reverse when adding so order remains correct
    for (let i = likedTracks.length - 1; i >= 0; i--) {
      onPlayNext(likedTracks[i]);
    }
    setIsMenuOpen(false);
    showToast(`Added ${likedTracks.length} tracks to play next`);
  };

  // 3-Dot Menu Action 4: Add to queue (appends to end)
  const handleAddToQueueAll = () => {
    if (likedTracks.length === 0) return;
    likedTracks.forEach((t) => onAddTrackToQueue(t));
    setIsMenuOpen(false);
    showToast(`Added ${likedTracks.length} tracks to queue`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#030303] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200 md:max-w-md md:left-1/2 md:-translate-x-1/2 md:border-x md:border-white/10 md:shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e] bg-[#030303]/90 backdrop-blur-xl shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="text-sm font-bold text-neutral-300 tracking-tight truncate max-w-[200px]">
          {stationName || 'Forecourt Radio'}
        </span>

        <button
          onClick={() => setIsMenuOpen(true)}
          className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer"
          title="Playlist Options"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-[#ff0000] text-white text-xs font-bold shadow-2xl flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Playlist Hero Section (Matches Screenshot 2) */}
        <div className="pt-6 pb-4 px-6 flex flex-col items-center text-center">
          {/* Permanent Liked Tracks Artwork Card (Matches screenshot exactly) */}
          <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-3xl overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.85)] border border-white/10 bg-neutral-900 shrink-0 mb-5 relative">
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-950/40 via-neutral-900 to-black text-red-500 gap-2">
              <Heart className="w-16 h-16 fill-red-500/20 stroke-red-500" />
              <span className="text-xs font-semibold text-neutral-400">
                {likedTracks.length === 0 ? 'No Liked Tracks' : `${likedTracks.length} Liked Tracks`}
              </span>
            </div>
          </div>

          {/* Title & Creator Info */}
          <h1 className="text-2xl font-black text-white tracking-tight">
            Liked tracks
          </h1>

          <div className="flex items-center justify-center gap-2 mt-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              S
            </div>
            <span className="text-xs font-semibold text-neutral-300">
              {stationName || 'Station'}
            </span>
          </div>

          {/* Subtitle / Metadata (Matches Screenshot 2) */}
          <div className="text-xs text-neutral-400 mt-1 font-medium">
            <span>Playlist</span> &bull; <span>2026</span> &bull;{' '}
            <span>{likedTracks.length} tracks</span> &bull;{' '}
            <span>{totalDurationMinutes}</span>
          </div>

          {/* Action Row: Bookmark/Heart, Big White Play, 3-Dots Menu (Matches Screenshot 2) */}
          <div className="flex items-center justify-center gap-5 mt-6">
            {/* Heart / Saved Status Indicator */}
            <div
              className="w-11 h-11 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#ff0000] shadow-sm"
              title="Liked Playlist"
            >
              <Heart className="w-5 h-5 fill-[#ff0000] stroke-[#ff0000]" />
            </div>

            {/* Big White Circular Play Button */}
            <button
              onClick={handlePlayAll}
              disabled={likedTracks.length === 0}
              className={`w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_8px_24px_rgba(255,255,255,0.2)] active:scale-90 hover:scale-105 transition-all cursor-pointer ${
                likedTracks.length === 0
                  ? 'opacity-40 cursor-not-allowed'
                  : ''
              }`}
              title="Play All"
            >
              <Play className="w-7 h-7 fill-black ml-1" />
            </button>

            {/* 3-Dots Button */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="w-11 h-11 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer shadow-sm"
              title="More Options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Find in Playlist (Inline Search Box) */}
        {isSearchActive && (
          <div className="px-4 py-2 bg-[#121212] border-y border-white/[0.08] flex items-center gap-2 animate-in fade-in duration-200">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in playlist..."
              className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                setIsSearchActive(false);
                setSearchQuery('');
              }}
              className="text-xs font-bold text-neutral-400 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Section Divider & Sort Row (Matches Screenshot 2) */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-white/[0.06]">
          <button
            onClick={() => setShowSortPicker(!showSortPicker)}
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 hover:text-white cursor-pointer active:scale-95 transition-all"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            <span>Sort</span>
            <span className="text-[10px] text-neutral-500 font-normal">
              ({sortBy === 'recent' ? 'Recent' : sortBy === 'az' ? 'A-Z' : 'Artist'})
            </span>
          </button>

          <span className="text-xs text-neutral-500">
            {displayedTracks.length} of {likedTracks.length}
          </span>
        </div>

        {/* Sort Picker Dropdown */}
        {showSortPicker && (
          <div className="mx-4 mb-3 p-1.5 rounded-2xl bg-[#1c1c1e] border border-white/10 flex gap-1">
            <button
              onClick={() => {
                setSortBy('recent');
                setShowSortPicker(false);
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                sortBy === 'recent'
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Recently Added
            </button>
            <button
              onClick={() => {
                setSortBy('az');
                setShowSortPicker(false);
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                sortBy === 'az'
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Song Title (A-Z)
            </button>
            <button
              onClick={() => {
                setSortBy('artist');
                setShowSortPicker(false);
              }}
              className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                sortBy === 'artist'
                  ? 'bg-white text-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Artist
            </button>
          </div>
        )}

        {/* Tracks List (Matches Screenshot 2) */}
        <div className="px-2 space-y-1">
          {displayedTracks.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 px-6">
              {searchQuery ? (
                <p className="text-sm">No songs match "{searchQuery}"</p>
              ) : (
                <div className="space-y-2">
                  <Heart className="w-10 h-10 mx-auto text-neutral-600 stroke-1" />
                  <p className="text-sm font-semibold text-neutral-300">
                    No liked tracks yet
                  </p>
                  <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                    Play any song on the station and tap ❤️ next to the title to save it for quick one-tap playback.
                  </p>
                </div>
              )}
            </div>
          ) : (
            displayedTracks.map((track, idx) => (
              <div
                key={`liked-${track.youtubeVideoId || track.id}-${idx}`}
                onClick={() => onPlayTrackNow(track)}
                className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors cursor-pointer group"
              >
                {/* Artwork Thumbnail */}
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0 relative flex items-center justify-center">
                  {track.artworkUrl ? (
                    <img
                      src={track.artworkUrl}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Disc3 className="w-5 h-5 text-neutral-600" />
                  )}
                  {/* Subtle play hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Play className="w-4 h-4 fill-white text-white" />
                  </div>
                </div>

                {/* Track Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate leading-tight group-hover:text-red-400 transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {track.artist}
                  </p>
                </div>

                {/* Duration */}
                <span className="text-xs text-neutral-500 tabular-nums shrink-0">
                  {formatTime(track.duration)}
                </span>

                {/* Remove from Liked Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveLikedTrack(track.youtubeVideoId || track.id);
                    showToast('Removed from Liked tracks');
                  }}
                  className="w-8 h-8 rounded-full text-neutral-500 hover:text-red-400 hover:bg-white/10 flex items-center justify-center shrink-0 transition-colors"
                  title="Remove from Liked"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3-DOTS BOTTOM SLIDE-UP SHEET (Matches Screenshot 3 EXACTLY - Only Marked) */}
      {/* ========================================================================= */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="w-full bg-[#212121] text-white rounded-t-3xl border-t border-white/10 p-4 pb-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-250 select-none shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-neutral-600 rounded-full mx-auto mb-4" />

            {/* Menu Header Preview */}
            <div className="px-2 pb-3 mb-2 border-b border-white/[0.08] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-[#7f1d1d] to-[#260505] shrink-0 border border-red-500/30 flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-500 fill-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">
                  Liked tracks
                </h3>
                <p className="text-xs text-neutral-400 truncate">
                  {likedTracks.length} tracks &bull; {stationName}
                </p>
              </div>
            </div>

            {/* ONLY THE 4 MARKED OPTIONS (As strictly instructed by user) */}
            <div className="space-y-1">
              {/* Option 1: Shuffle play */}
              <button
                type="button"
                onClick={handleShufflePlay}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors text-left cursor-pointer"
              >
                <Shuffle className="w-5 h-5 text-white shrink-0" />
                <span className="text-sm font-medium text-white">
                  Shuffle play
                </span>
              </button>

              {/* Option 2: Find in playlist */}
              <button
                type="button"
                onClick={handleFindInPlaylist}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors text-left cursor-pointer"
              >
                <Search className="w-5 h-5 text-white shrink-0" />
                <span className="text-sm font-medium text-white">
                  Find in playlist
                </span>
              </button>

              {/* Option 3: Play next */}
              <button
                type="button"
                onClick={handlePlayNextAll}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors text-left cursor-pointer"
              >
                <ArrowRightToLine className="w-5 h-5 text-white shrink-0" />
                <span className="text-sm font-medium text-white">
                  Play next
                </span>
              </button>

              {/* Option 4: Add to queue */}
              <button
                type="button"
                onClick={handleAddToQueueAll}
                className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors text-left cursor-pointer"
              >
                <ListPlus className="w-5 h-5 text-white shrink-0" />
                <span className="text-sm font-medium text-white">
                  Add to queue
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
