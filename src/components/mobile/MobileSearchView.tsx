import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Play,
  Plus,
  Clock,
  Check,
  Music2,
  Sparkles,
  TrendingUp,
  Loader2,
  ListPlus,
  Crown,
  ChevronRight,
  Disc3,
  Flame,
  Volume2,
  Radio,
  ArrowRight,
  Heart,
} from 'lucide-react';
import { SongTrack } from '../../types';

interface MobileSearchViewProps {
  onPlayTrackNow: (track: SongTrack) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onPlayNext: (track: SongTrack) => void;
  userRole: 'staff' | 'admin';
  isSpeakerNode: boolean;
  initialQuery?: string;
  currentTrackIsAdmin?: boolean;
  likedTracks?: SongTrack[];
  onOpenLikedPlaylist?: () => void;
}

// YouTube Music Browse Category Cards
const YT_BROWSE_CATEGORIES = [
  {
    id: 'bhakti',
    title: 'Bhakti & Aarti',
    subtitle: 'Morning spiritual chants',
    query: 'Morning bhajan aarti bhakti',
    gradient: 'from-[#b45309] to-[#78350f]',
    emoji: '🪔',
  },
  {
    id: 'bollywood',
    title: 'Bollywood Hits',
    subtitle: 'Latest chartbusters',
    query: 'Latest Bollywood hit songs',
    gradient: 'from-[#b91c1c] to-[#7f1d1d]',
    emoji: '🎬',
  },
  {
    id: 'punjabi',
    title: 'Punjabi Beats',
    subtitle: 'Diljit, Karan Aujla, Shubh',
    query: 'Top Punjabi superhit songs',
    gradient: 'from-[#6d28d9] to-[#4c1d95]',
    emoji: '🎤',
  },
  {
    id: '90s',
    title: '90s Evergreen',
    subtitle: 'Kumar Sanu, Alka, Udit',
    query: '90s bollywood evergreen songs',
    gradient: 'from-[#047857] to-[#064e3b]',
    emoji: '💫',
  },
  {
    id: 'romantic',
    title: 'Romantic Hits',
    subtitle: 'Arijit Singh, Mohit Chauhan',
    query: 'Arijit Singh romantic hits',
    gradient: 'from-[#be185d] to-[#831843]',
    emoji: '❤️',
  },
  {
    id: 'party',
    title: 'Party & Dance',
    subtitle: 'High energy dance mixes',
    query: 'Bollywood dance party superhit mashup',
    gradient: 'from-[#ea580c] to-[#9a3412]',
    emoji: '⚡',
  },
  {
    id: 'lofi',
    title: 'Lo-Fi Hindi Chill',
    subtitle: 'Relaxing ambient beats',
    query: 'Hindi lofi chill songs',
    gradient: 'from-[#1e3a8a] to-[#0f172a]',
    emoji: '🌙',
  },
  {
    id: 'sufi',
    title: 'Sufi & Ghazals',
    subtitle: 'Nusrat, Jagjit Singh',
    query: 'Sufi songs and ghazals',
    gradient: 'from-[#4338ca] to-[#312e81]',
    emoji: '🕊️',
  },
];

const SEARCH_FILTER_PILLS = ['All', 'Songs', 'Artists', 'Albums'];

// Client-side Title Normalizer to ensure zero repetitive audio clutter
function getNormalizedSignature(title: string): string {
  let text = (title || '').toLowerCase();
  text = text
    .replace(/#[\w-]+/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\|\s*.*?$/g, '');

  const noiseWords = [
    'official', 'video', 'audio', 'song', 'full', 'lyric', 'lyrics', 'lyrical',
    'hd', '4k', 'remastered', 'remix', 'dhamaka', 'superhit', 'hit', 'hits',
    'gaana', 'gana', 'geet', 'tseries', 't-series', 'zee music', 'speed records',
    'tips official', 'yrf', 'sony music', 'status', 'reels', 'shorts'
  ];
  for (const n of noiseWords) {
    text = text.replace(new RegExp(`\\b${n}\\b`, 'gi'), ' ');
  }
  return text.replace(/[^a-z0-9\u0900-\u097F]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function deduplicateClientResults(tracks: SongTrack[], existingTracks: SongTrack[] = []): SongTrack[] {
  const result: SongTrack[] = [...existingTracks];
  const seenIds = new Set<string>(existingTracks.map((t) => t.youtubeVideoId || t.id));
  const seenSignatures = new Set<string>(
    existingTracks.map((t) => `${(t.title || '').toLowerCase().trim()}:::${(t.artist || '').toLowerCase().trim()}`)
  );

  for (const t of tracks) {
    if (!t) continue;
    const id = t.youtubeVideoId || t.id;
    if (seenIds.has(id)) continue;

    const signature = `${(t.title || '').toLowerCase().trim()}:::${(t.artist || '').toLowerCase().trim()}`;
    if (seenSignatures.has(signature)) continue;

    seenIds.add(id);
    seenSignatures.add(signature);
    result.push(t);
  }
  return result;
}

export const MobileSearchView: React.FC<MobileSearchViewProps> = ({
  onPlayTrackNow,
  onAddTrackToQueue,
  onPlayNext,
  userRole,
  isSpeakerNode,
  initialQuery = '',
  currentTrackIsAdmin = false,
  likedTracks = [],
  onOpenLikedPlaylist,
}) => {
  const [inputText, setInputText] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [results, setResults] = useState<SongTrack[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sangeet_yt_recents');
      return stored
        ? JSON.parse(stored)
        : ['Morning bhajan aarti bhakti', 'Latest Bollywood hit songs', 'Arijit Singh romantic hits'];
    } catch {
      return ['Morning bhajan aarti bhakti', 'Arijit Singh'];
    }
  });

  const [addedQueueId, setAddedQueueId] = useState<string | null>(null);
  const [playNextId, setPlayNextId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef<number>(0);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = userRole === 'admin';
  const isSpeaker = isSpeakerNode;
  const canPlayNow = isAdmin || isSpeaker;

  // Execute search only when initialQuery is provided from outside navigation
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      setInputText(initialQuery);
      setSubmittedQuery(initialQuery);
      performSearch(initialQuery, 1, false);
    }
  }, [initialQuery]);

  const performSearch = async (searchTerm: string, pageNum: number = 1, append: boolean = false) => {
    const trimmed = searchTerm.trim();

    // 1. Abort previous pending search request immediately if not appending
    if (!append && searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
      searchAbortControllerRef.current = null;
    }

    if (!trimmed) {
      searchRequestIdRef.current += 1;
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setIsLoadingMore(false);
      setCurrentPage(1);
      setHasMore(false);
      return;
    }

    if (!append) {
      const currentRequestId = ++searchRequestIdRef.current;
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      setSubmittedQuery(trimmed);
      setHasSearched(true);
      setIsSearching(true);
      setCurrentPage(1);

      try {
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(trimmed)}&source=all&page=1&limit=35`,
          { signal: controller.signal }
        );

        if (currentRequestId !== searchRequestIdRef.current) return;

        const data = await res.json();

        if (currentRequestId === searchRequestIdRef.current && data.success && Array.isArray(data.results)) {
          const isJukebox = /jukebox|nonstop|non-stop|album|all songs|mashup|medley/i.test(trimmed);
          const validList = (data.results as SongTrack[]).filter((t) => {
            if (!t) return false;
            const sec = t.duration || 0;
            if (!isJukebox && sec > 900) return false;
            const comb = `${t.title || ''} ${t.artist || ''} ${t.album || ''}`.toLowerCase();
            return !/(ai\s*cover|ai\s*remake|ai\s*version|ai\s*voice|ai\s*generated|voice\s*clone|vocal\s*ai|\bsuno\b|\budio\b|fake\s*remake|cheap\s*remake|fan\s*made|re-upload|reupload)/i.test(comb);
          });
          const distinctTracks = deduplicateClientResults(validList);
          setResults(distinctTracks);
          setHasMore(Boolean(data.hasMore));

          // Update recents
          setRecentSearches((prev) => {
            const updated = [
              trimmed,
              ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
            ].slice(0, 8);
            try {
              localStorage.setItem('sangeet_yt_recents', JSON.stringify(updated));
            } catch {
              // ignore
            }
            return updated;
          });
        }
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error?.name === 'AbortError') return;
        console.warn('Search error:', err);
      } finally {
        if (currentRequestId === searchRequestIdRef.current) {
          setIsSearching(false);
          if (searchAbortControllerRef.current === controller) {
            searchAbortControllerRef.current = null;
          }
        }
      }
    } else {
      // Append mode for Infinite Scroll / Load More (Page 2, 3, etc.)
      setIsLoadingMore(true);
      try {
        const res = await fetch(
          `/api/music/search?q=${encodeURIComponent(trimmed)}&source=all&page=${pageNum}&limit=35`
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          const isJukebox = /jukebox|nonstop|non-stop|album|all songs|mashup|medley/i.test(trimmed);
          const validList = (data.results as SongTrack[]).filter((t) => {
            if (!t) return false;
            const sec = t.duration || 0;
            if (!isJukebox && sec > 900) return false;
            const comb = `${t.title || ''} ${t.artist || ''} ${t.album || ''}`.toLowerCase();
            return !/(ai\s*cover|ai\s*remake|ai\s*version|ai\s*voice|ai\s*generated|voice\s*clone|vocal\s*ai|\bsuno\b|\budio\b|fake\s*remake|cheap\s*remake|fan\s*made|re-upload|reupload)/i.test(comb);
          });

          setResults((prev) => {
            const merged = deduplicateClientResults(validList, prev);
            return merged;
          });
          setCurrentPage(pageNum);
          setHasMore(Boolean(data.hasMore) && validList.length > 0);
        } else {
          setHasMore(false);
        }
      } catch (e) {
        console.warn('Error loading more tracks:', e);
        setHasMore(false);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  // YouTube-Style True Infinite Scroll: Automatically fetches next page when scrolled near bottom
  useEffect(() => {
    if (!hasMore || isSearching || isLoadingMore || !submittedQuery.trim()) {
      return;
    }

    const target = observerRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoadingMore && !isSearching) {
          performSearch(submittedQuery, currentPage + 1, true);
        }
      },
      {
        root: null,
        rootMargin: '350px', // Pre-fetches next page 350px BEFORE user reaches bottom for zero stutter
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoadingMore, isSearching, submittedQuery, currentPage]);

  // User explicitly submits search (via Search button or Enter key)
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputText.trim()) {
      inputRef.current?.blur();
      performSearch(inputText);
    }
  };

  const handleClear = () => {
    setInputText('');
    setSubmittedQuery('');
    setResults([]);
    setHasSearched(false);
    setIsSearching(false);
    inputRef.current?.focus();
  };

  const handleSelectRecent = (term: string) => {
    setInputText(term);
    performSearch(term);
  };

  const handleRemoveRecent = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter((item) => item !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem('sangeet_yt_recents', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handlePlayNextWithFeedback = (track: SongTrack) => {
    onPlayNext(track);
    setPlayNextId(track.id);
    setTimeout(() => setPlayNextId(null), 1400);
  };

  const handleAddToQueueWithFeedback = (track: SongTrack) => {
    onAddTrackToQueue(track);
    setAddedQueueId(track.id);
    setTimeout(() => setAddedQueueId(null), 1400);
  };

  const formatSecs = (secs: number) => {
    if (!secs || isNaN(secs)) return '3:30';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredResults = results.filter((track) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Artists') {
      return (
        track.artist.toLowerCase().includes(submittedQuery.toLowerCase()) ||
        track.title.toLowerCase().includes('artist')
      );
    }
    if (activeFilter === 'Albums') {
      return (
        Boolean(track.album) &&
        track.album !== 'YouTube' &&
        track.album !== 'YouTube Music' &&
        track.album !== 'Single'
      );
    }
    return true;
  });

  const topResult = filteredResults.length > 0 ? filteredResults[0] : null;
  const remainingResults = filteredResults.length > 1 ? filteredResults.slice(1) : [];

  return (
    <div className="pb-36 select-none bg-[#030303] min-h-[calc(100vh-140px)]">
      {/* 1. Sleek YouTube Music Search Header (Sticky Top-0 with no top void) */}
      <div className="sticky top-0 z-20 bg-[#030303]/95 backdrop-blur-2xl px-4 py-3 border-b border-white/[0.06]">
        <form onSubmit={handleSubmit} className="relative w-full">
          {/* Integrated YouTube Music Pill Input */}
          <div className="w-full flex items-center bg-[#1c1c1c] rounded-full border border-white/[0.08] focus-within:border-white/30 focus-within:bg-[#242424] transition-all shadow-sm pl-3.5 pr-1.5 py-1.5">
            <Search className="w-4 h-4 text-neutral-400 shrink-0 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Search songs, artists, albums..."
              className="w-full pl-3 pr-2 py-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none"
              autoComplete="off"
              spellCheck="false"
            />

            {/* Clear Button (Shown when text is typed) */}
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 active:scale-90 transition-all cursor-pointer shrink-0"
                title="Clear query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Clean Integrated Search Submit Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isSearching}
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer ml-1 ${
                inputText.trim()
                  ? 'bg-[#ff0000] hover:bg-[#e60000] text-white shadow-md shadow-[#ff0000]/30'
                  : 'bg-white/5 text-neutral-600 cursor-not-allowed'
              }`}
              title="Search"
            >
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Before Search / Idle State: Clean Recents Chips & Browse Genres */}
      {!hasSearched && (
        <div className="px-4 space-y-5 pt-3">
          {/* Recent Searches (Horizontal sleek pills, zero clutter) */}
          {recentSearches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Recent Searches</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRecentSearches([]);
                    try {
                      localStorage.removeItem('sangeet_yt_recents');
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              {/* Horizontal scrollable chips: clean, compact, non-intrusive */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4">
                {recentSearches.map((term, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectRecent(term)}
                    className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-[#161616] hover:bg-[#222] border border-white/[0.08] shrink-0 text-xs text-neutral-200 transition-all cursor-pointer group active:scale-95 shadow-sm"
                  >
                    <Clock className="w-3 h-3 text-neutral-500 group-hover:text-white transition-colors shrink-0" />
                    <span className="max-w-[130px] truncate font-medium">{term}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveRecent(e, term)}
                      className="p-1 rounded-full text-neutral-500 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liked Tracks Auto Playlist Row (Matches user screenshot 1) */}
          <div
            onClick={onOpenLikedPlaylist}
            className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#161616] hover:bg-[#1f1f1f] border border-white/[0.08] hover:border-red-500/30 transition-all active:scale-[0.98] cursor-pointer shadow-md group relative overflow-hidden"
          >
            {/* Ambient Red Glow on hover */}
            <div className="absolute -left-4 -top-4 w-20 h-20 rounded-full bg-red-600/10 blur-xl pointer-events-none group-hover:bg-red-600/20 transition-all" />

            {/* Artwork Thumbnail (Matches screenshot exactly) */}
            <div className="w-13 h-13 rounded-xl overflow-hidden bg-gradient-to-br from-[#7f1d1d] to-[#260505] border border-red-500/30 flex items-center justify-center shrink-0 shadow-md relative">
              <Heart className="w-6 h-6 text-red-500 fill-red-500/80" />
              {/* Floating Mini Heart Badge */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center border-2 border-black shadow">
                <Heart className="w-2.5 h-2.5 fill-white" />
              </div>
            </div>

            {/* Title & Metadata */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">
                  Liked tracks
                </h3>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  Playlist
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate mt-0.5 font-medium">
                Auto playlist &bull; {likedTracks.length} {likedTracks.length === 1 ? 'song' : 'songs'}
              </p>
            </div>

            {/* Right Chevron Indicator */}
            <div className="w-8 h-8 rounded-full bg-white/[0.05] group-hover:bg-[#ff0000] text-neutral-400 group-hover:text-white flex items-center justify-center transition-all shrink-0">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>

          {/* YouTube Music Browse Cards */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#ff0000]" />
                <span>Explore Music Genres</span>
              </span>
              <span className="text-[11px] text-neutral-500 font-medium">Tap genre to play</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {YT_BROWSE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setInputText(cat.query);
                    performSearch(cat.query);
                  }}
                  className={`p-3.5 rounded-2xl bg-gradient-to-br ${cat.gradient} border border-white/10 hover:border-white/30 text-left transition-all active:scale-[0.97] shadow-md group relative overflow-hidden cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl">{cat.emoji}</span>
                    <Search className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-xs font-bold text-white leading-tight">
                    {cat.title}
                  </h3>
                  <p className="text-[10px] text-white/70 line-clamp-1 mt-0.5 font-medium">
                    {cat.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Search Results State */}
      {hasSearched && (
        <div className="space-y-4 px-4">
          {/* YouTube Music Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {SEARCH_FILTER_PILLS.map((pill) => (
              <button
                key={pill}
                onClick={() => setActiveFilter(pill)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-pointer ${
                  activeFilter === pill
                    ? 'bg-white text-black font-bold shadow'
                    : 'bg-[#212121] text-neutral-300 hover:text-white border border-[#2d2d2d]'
                }`}
              >
                {pill}
              </button>
            ))}
          </div>

          {/* Results Status Header */}
          <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
            <span className="font-semibold truncate">
              Results for &ldquo;<span className="text-white">{submittedQuery}</span>&rdquo;
            </span>
            {!isSearching && (
              <span className="shrink-0 text-[11px] font-mono bg-[#1c1c1c] px-2 py-0.5 rounded-full border border-[#2a2a2a]">
                {filteredResults.length} tracks
              </span>
            )}
          </div>

          {/* Loading Skeleton Indicator */}
          {isSearching && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 text-[#ff0000] animate-spin" />
              <p className="text-xs text-neutral-400 font-medium">
                Searching...
              </p>
            </div>
          )}

          {/* No Results Fallback */}
          {!isSearching && filteredResults.length === 0 && (
            <div className="py-16 text-center space-y-3">
              <Disc3 className="w-10 h-10 text-neutral-600 mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-white">No tracks found</h3>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                Try searching with another keyword or explore trending genres.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => performSearch('Top Punjabi superhit songs')}
                  className="px-4 py-2 rounded-full bg-[#212121] border border-[#333] text-xs font-semibold text-neutral-200 hover:text-white active:scale-95 transition-all"
                >
                  Search &ldquo;Top Punjabi Superhit Songs&rdquo;
                </button>
              </div>
            </div>
          )}

          {/* Top Result Card */}
          {!isSearching && topResult && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#ff0000] block">
                Top Result
              </span>

              <div className="p-3.5 rounded-2xl bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] transition-all shadow-md flex flex-col gap-3">
                {/* Upper: Thumbnail & Full Title/Details */}
                <div className="flex items-start gap-3.5 min-w-0 w-full">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0 relative border border-white/10 group shadow-inner">
                    {topResult.artworkUrl ? (
                      <img
                        src={topResult.artworkUrl}
                        alt={topResult.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#ff0000]/20 text-[#ff0000]">
                        <Play className="w-6 h-6 fill-current" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-sm sm:text-base font-bold text-white leading-snug line-clamp-2 break-words">
                      {topResult.title}
                    </p>
                    <p className="text-xs text-neutral-300 truncate mt-1">
                      {topResult.artist}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-neutral-400 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-[#ff0000]/15 text-[#ff4d4d] text-[10px] font-bold">
                        Song
                      </span>
                      {(topResult.isOfficial || topResult.source === 'jiosaavn' || topResult.source === 'youtube') && (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                          ✓ Official
                        </span>
                      )}
                      <span>&bull;</span>
                      <span className="font-mono text-[10px]">{formatSecs(topResult.duration)}</span>
                      <span>&bull;</span>
                      <span className="text-neutral-400 truncate">Sangeet</span>
                    </div>
                  </div>
                </div>

                {/* Lower: Horizontal Action Buttons (Play Now, Play Next, Add to Queue) */}
                <div className="pt-2.5 border-t border-white/[0.08] flex items-center gap-2 w-full">
                  {canPlayNow && (
                    <button
                      onClick={() => onPlayTrackNow(topResult)}
                      disabled={!isAdmin && currentTrackIsAdmin}
                      className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isAdmin
                          ? 'bg-[#ff0000] hover:bg-[#e60000] text-white shadow-md shadow-[#ff0000]/25'
                          : currentTrackIsAdmin
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                            : 'bg-white text-black hover:bg-neutral-200 shadow-md'
                      }`}
                      title={!isAdmin && currentTrackIsAdmin ? 'Priority track playing' : 'Play Now'}
                    >
                      <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                      <span className="truncate">Play Now</span>
                    </button>
                  )}

                  <button
                    onClick={() => handlePlayNextWithFeedback(topResult)}
                    className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                      playNextId === topResult.id
                        ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                        : 'bg-[#222] hover:bg-[#2b2b2b] text-neutral-200 border-[#333]'
                    }`}
                    title="Play Next (Queue Top)"
                  >
                    {playNextId === topResult.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                        <span className="truncate">Added Next!</span>
                      </>
                    ) : (
                      <>
                        <ListPlus className="w-3.5 h-3.5 text-[#ff0000] shrink-0" />
                        <span className="truncate">Play Next</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleAddToQueueWithFeedback(topResult)}
                    className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                      addedQueueId === topResult.id
                        ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                        : 'bg-[#222] hover:bg-[#2b2b2b] text-neutral-200 border-[#333]'
                    }`}
                    title="Add to Station Queue"
                  >
                    {addedQueueId === topResult.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                        <span className="truncate">Added!</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-white shrink-0" />
                        <span className="truncate">Add Queue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Distinct Songs List */}
          {!isSearching && remainingResults.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                Songs &bull; Catalog Tracks ({remainingResults.length})
              </span>

              <div className="space-y-1.5">
                {remainingResults.map((track, idx) => {
                  const isAddedQueue = addedQueueId === track.id;
                  const isAddedNext = playNextId === track.id;

                  return (
                    <div
                      key={`search-${track.id}-${idx}`}
                      className="p-2.5 rounded-xl bg-[#121212] hover:bg-[#1a1a1a] border border-[#212121] hover:border-[#333] flex items-center justify-between gap-3 transition-colors shadow-sm"
                    >
                      {/* Left: Thumbnail & Info (Clickable for instant playback Spotify/YT style) */}
                      <div
                        onClick={() => {
                          if (canPlayNow && !(!isAdmin && currentTrackIsAdmin)) {
                            onPlayTrackNow(track);
                          } else {
                            handleAddToQueueWithFeedback(track);
                          }
                        }}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer group"
                        title={canPlayNow ? "Tap to play song" : "Tap to add to queue"}
                      >
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-black shrink-0 relative border border-white/10 group-hover:border-white/30 transition-colors">
                          {track.artworkUrl ? (
                            <img
                              src={track.artworkUrl}
                              alt={track.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-[#ff0000]/20 text-[#ff0000]">
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-4 h-4 fill-white text-white drop-shadow" />
                          </div>
                        </div>

                        <div className="truncate flex-1 min-w-0">
                          <p className="text-xs font-bold text-white group-hover:text-red-400 truncate leading-tight transition-colors">
                            {track.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-400 flex-wrap">
                            <span className="truncate">{track.artist}</span>
                            {(track.isOfficial || track.source === 'jiosaavn' || track.source === 'youtube') && (
                              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded-md inline-flex items-center gap-0.5 shrink-0">
                                ✓ Official
                              </span>
                            )}
                            <span>&bull;</span>
                            <span className="font-mono text-[10px]">{formatSecs(track.duration)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Instant Play */}
                        {canPlayNow && (
                          <button
                            onClick={() => onPlayTrackNow(track)}
                            disabled={!isAdmin && currentTrackIsAdmin}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold active:scale-95 transition-all flex items-center gap-1 cursor-pointer ${
                              isAdmin
                                ? 'bg-[#ff0000] hover:bg-[#e60000] text-white shadow'
                                : currentTrackIsAdmin
                                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                                  : 'bg-white text-black hover:bg-neutral-200 shadow'
                            }`}
                            title={!isAdmin && currentTrackIsAdmin ? 'Priority track playing' : 'Play Now'}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span className="hidden sm:inline">Play</span>
                          </button>
                        )}

                        {/* Play Next */}
                        <button
                          onClick={() => handlePlayNextWithFeedback(track)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                            isAddedNext
                              ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                              : 'bg-[#1e1e1e] hover:bg-[#282828] text-neutral-200 border-[#2d2d2d]'
                          }`}
                          title="Play Next (Queue Top)"
                        >
                          {isAddedNext ? (
                            <>
                              <Check className="w-3 h-3 text-[#10b981]" />
                              <span className="text-[10px]">Next!</span>
                            </>
                          ) : (
                            <>
                              <ListPlus className="w-3 h-3 text-[#ff0000]" />
                              <span className="hidden sm:inline">Next</span>
                            </>
                          )}
                        </button>

                        {/* Add to Queue */}
                        <button
                          onClick={() => handleAddToQueueWithFeedback(track)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all active:scale-95 cursor-pointer ${
                            isAddedQueue
                              ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                              : 'bg-[#1e1e1e] hover:bg-[#282828] text-neutral-300 border-[#2d2d2d]'
                          }`}
                          title="Add to Queue (Queue End)"
                        >
                          {isAddedQueue ? (
                            <Check className="w-3 h-3 text-[#10b981]" />
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-white" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* YouTube-Style Automatic Infinite Scroll Sentinel */}
                {hasMore && (
                  <div
                    ref={observerRef}
                    className="py-6 flex flex-col items-center justify-center gap-2 min-h-[50px]"
                  >
                    {isLoadingMore && (
                      <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 bg-[#161618] px-4 py-2 rounded-full border border-white/[0.08] shadow-sm animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 text-[#ff0000] animate-spin" />
                        <span>Loading more tracks...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* End of results subtle notice */}
                {!hasMore && remainingResults.length > 0 && (
                  <div className="pt-6 pb-12 text-center">
                    <p className="text-[11px] text-neutral-500 font-medium">
                      All {filteredResults.length} matching tracks loaded
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
