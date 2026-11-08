import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  Smartphone,
  ShieldCheck,
  Radio,
  Layers,
  Zap,
  Mic,
  KeyRound,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  LogOut,
  ArrowLeft,
  X,
  Settings,
  Sliders,
  Shield,
  Music2,
  Upload,
  FileAudio,
  Cloud,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  Waves,
  Info,
  Disc3
} from 'lucide-react';
import { SongTrack, PromoClip, PromoCategory, StationSettings, StationItem } from '../types';
import { ExpandedPlayer } from './ExpandedPlayer';
import { AppleArtwork } from './common/AppleArtwork';
import { AppleSlider } from './common/AppleSlider';
import { LiveAnnouncementControl } from './common/LiveAnnouncementControl';
import { audioEngine } from '../services/audioEngine';
import { savePromoToLocalDB, deletePromoFromLocalDB } from '../services/promoStorage';

// Apple HIG Standard iOS Toggle Switch Component
const IOSToggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; color?: string }> = ({
  checked,
  onChange,
  color = '#30d158',
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none"
      style={{ backgroundColor: checked ? color : '#39393d' }}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

interface AdminConsoleViewProps {
  stationName: string;
  stationId: string;
  adminPin: string;
  stations: StationItem[];
  settings: StationSettings;
  categories: PromoCategory[];
  promos: PromoClip[];
  currentTrack: SongTrack | null;
  adminQueue: SongTrack[];
  staffQueue: SongTrack[];
  recommendations: SongTrack[];
  playedHistory?: SongTrack[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isPromoPlaying: boolean;
  activePromoClip: PromoClip | null;
  isSpeakerNode: boolean;
  onPlayPause: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onUpdateSettings: (settings: Partial<StationSettings>) => void;
  onUpdateAdminPin: (newPin: string) => void;
  onAddStation: (station: {
    name: string;
    promosEnabled: boolean;
    pinRequired?: boolean;
    stationPin?: string;
    allowedSources?: 'all' | 'youtube' | 'saavn';
    promoSongInterval: number;
    promoTimeIntervalMinutes: number;
    duckingVolumePercent: number;
  }) => void;
  onUpdateStation: (id: string, updates: Partial<StationItem>) => void;
  onDeleteStation: (id: string) => void;
  onSelectStation: (id: string) => void;
  onAddCategory: (category: { name: string; description: string; color: string }) => void;
  onDeleteCategory: (id: string) => void;
  onAddPromo: (promo: { title: string; categoryId: string; audioUrl: string; duration: number; scriptSnippet: string }) => void;
  onTogglePromo: (id: string, enabled: boolean) => void;
  onDeletePromo: (id: string) => void;
  onAdminPlayNow: (track: SongTrack) => void;
  onAddAdminQueue: (track: SongTrack) => void;
  onAddStaffQueue: (track: SongTrack) => void;
  onRemoveTrack: (trackId: string, queueType: 'admin' | 'staff') => void;
  onTriggerUrgentPromo: () => void;
  onLeaveStation: () => void;
  onSwitchToStaff: () => void;
  onOpenSpeakerModal: () => void;
  onStartLiveAnnouncement?: (payload?: any) => void;
  onStopLiveAnnouncement?: () => void;
  isMoodMixActive?: boolean;
  detectedMood?: string;
  onToggleMoodMix?: () => void;
  onStopPromo?: () => void;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  stationName,
  stationId,
  adminPin,
  stations,
  settings,
  categories,
  promos,
  currentTrack,
  adminQueue,
  staffQueue,
  recommendations,
  playedHistory = [],
  isPlaying,
  currentTime,
  duration,
  isPromoPlaying,
  activePromoClip,
  isSpeakerNode,
  onPlayPause,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  onVolumeChange,
  onUpdateSettings,
  onUpdateAdminPin,
  onAddStation,
  onUpdateStation,
  onDeleteStation,
  onSelectStation,
  onAddCategory,
  onDeleteCategory,
  onAddPromo,
  onTogglePromo,
  onDeletePromo,
  onAdminPlayNow,
  onAddAdminQueue,
  onAddStaffQueue,
  onRemoveTrack,
  onTriggerUrgentPromo,
  onLeaveStation,
  onSwitchToStaff,
  onOpenSpeakerModal,
  onStartLiveAnnouncement,
  onStopLiveAnnouncement,
  isMoodMixActive,
  detectedMood,
  onToggleMoodMix,
  onStopPromo,
}) => {
  // Tabs: Schedule (Default matching Screenshot 2), VIP Play Now, Live PA Mic, Promos, Stations, Security
  const [activeTab, setActiveTab] = useState<'schedule' | 'vip_songs' | 'mic' | 'promos' | 'stations' | 'security'>('schedule');

  // Live PA Mic state
  const [isMicOn, setIsMicOn] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const micIntervalRef = useRef<number | null>(null);

  // VIP Music Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SongTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [adminSourceFilter, setAdminSourceFilter] = useState<'all' | 'youtube' | 'saavn'>('all');
  const adminSearchAbortControllerRef = useRef<AbortController | null>(null);
  const adminSearchRequestIdRef = useRef<number>(0);

  // Station Modal Edit & Create State
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [modalStationId, setModalStationId] = useState<string | null>(null); // null = create new
  const [modalStationName, setModalStationName] = useState('');
  const [modalPinRequired, setModalPinRequired] = useState(false);
  const [modalStationPin, setModalStationPin] = useState('2006');
  const [modalPromosEnabled, setModalPromosEnabled] = useState(true);
  const [modalAllowedSources, setModalAllowedSources] = useState<'all' | 'youtube' | 'saavn'>('all');
  const [modalPromoSongInterval, setModalPromoSongInterval] = useState(2);
  const [modalPromoTimeInterval, setModalPromoTimeInterval] = useState(10);
  const [modalDuckingPercent, setModalDuckingPercent] = useState(18);

  // New Category Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#f37021');

  // New Promo Form
  const [newPromoTitle, setNewPromoTitle] = useState('');
  const [newPromoCatId, setNewPromoCatId] = useState(categories[0]?.id || '');
  const [newPromoUrl, setNewPromoUrl] = useState('');
  const [newPromoScript, setNewPromoScript] = useState('');
  const [newPromoDuration, setNewPromoDuration] = useState<number>(15);
  const [promoInputMode, setPromoInputMode] = useState<'upload' | 'url'>('upload');
  const [uploadedPromoFileName, setUploadedPromoFileName] = useState<string>('');
  const [uploadedPromoFileSize, setUploadedPromoFileSize] = useState<string>('');
  const [isReadingAudio, setIsReadingAudio] = useState<boolean>(false);
  const [promoSaveSuccess, setPromoSaveSuccess] = useState<string | null>(null);
  const [cloudStorageStatus, setCloudStorageStatus] = useState<{
    isCloudReady: boolean;
    totalPromosCount: number;
    totalSizeReadable: string;
    databaseSaved: boolean;
    lastSavedAt: number;
  } | null>(null);
  const promoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch('/api/storage/status')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setCloudStorageStatus(json.data);
        }
      })
      .catch(() => {});
  }, [promos.length]);

  const handlePromoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedPromoFileName(file.name);
    setUploadedPromoFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
    if (!newPromoTitle.trim()) {
      setNewPromoTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    setIsReadingAudio(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setNewPromoUrl(dataUrl);
      setIsReadingAudio(false);

      // Probe audio duration dynamically
      try {
        const audio = new Audio();
        audio.src = dataUrl;
        audio.onloadedmetadata = () => {
          if (audio.duration && !isNaN(audio.duration)) {
            setNewPromoDuration(Math.round(audio.duration));
          }
        };
      } catch {
        // Fallback default
      }
    };
    reader.onerror = () => {
      setIsReadingAudio(false);
    };
    reader.readAsDataURL(file);
  };

  // Password Change Form
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Real-time Strategy & Audio States with Auto-save & Debounce
  const [localPromosEnabled, setLocalPromosEnabled] = useState<boolean>(settings.promosEnabled ?? true);
  const [localIntervalType, setLocalIntervalType] = useState<'songs_count' | 'time_interval'>(settings.promoIntervalType || 'time_interval');
  const [localSongInterval, setLocalSongInterval] = useState<number>(settings.promoSongInterval || 2);
  const [localTimeInterval, setLocalTimeInterval] = useState<number>(settings.promoTimeIntervalMinutes ?? 1);
  const [localPromoRepetitions, setLocalPromoRepetitions] = useState<number>(settings.promoRepetitions ?? 2);

  // Active info tooltip popup key
  const [activeInfoKey, setActiveInfoKey] = useState<string | null>(null);
  const toggleInfo = (key: string) => {
    setActiveInfoKey((prev) => (prev === key ? null : key));
  };

  // Direct Number Tapping / Inline Value Editing States
  const [editingField, setEditingField] = useState<'song' | 'time' | 'repetition' | 'ducking' | 'fade' | 'crossfade' | null>(null);
  const [tempValueInput, setTempValueInput] = useState('');

  // Advanced Audio Settings (Ducking, Fade & Crossfade Engine)
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [localDuckingMode, setLocalDuckingMode] = useState<'db' | 'percent'>(settings.duckingMode || 'db');
  const [localDuckingDb, setLocalDuckingDb] = useState<number>(settings.duckingDb ?? -25);
  const [localDuckingPercent, setLocalDuckingPercent] = useState<number>(settings.duckingVolumePercent || 18);
  const [localFadeDuration, setLocalFadeDuration] = useState<number>(settings.fadeDurationSeconds ?? 1.0);
  const [localCrossfadeSeconds, setLocalCrossfadeSeconds] = useState<number>(settings.crossfadeSeconds ?? 1.5);
  const [savedBadge, setSavedBadge] = useState<string | null>(null);

  const isUserInteractingRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markInteracting = () => {
    isUserInteractingRef.current = true;
    if (interactionReleaseTimerRef.current) clearTimeout(interactionReleaseTimerRef.current);
    interactionReleaseTimerRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 3500);
  };

  const triggerDebouncedUpdate = (updates: Partial<StationSettings>, label: string) => {
    markInteracting();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onUpdateSettings(updates);
      setSavedBadge(label);
      setTimeout(() => setSavedBadge(null), 1800);
    }, 200);
  };

  const triggerImmediateUpdate = (updates: Partial<StationSettings>, label: string) => {
    markInteracting();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onUpdateSettings(updates);
    setSavedBadge(label);
    setTimeout(() => setSavedBadge(null), 1800);
  };

  // Sync draft states when settings change from server ONLY when user is not interacting
  useEffect(() => {
    if (isUserInteractingRef.current) return;
    setLocalPromosEnabled(settings.promosEnabled ?? true);
    setLocalIntervalType(settings.promoIntervalType || 'time_interval');
    setLocalSongInterval(settings.promoSongInterval || 2);
    setLocalTimeInterval(settings.promoTimeIntervalMinutes ?? 1);
    setLocalPromoRepetitions(settings.promoRepetitions ?? 2);
    setLocalDuckingMode(settings.duckingMode || 'db');
    setLocalDuckingDb(settings.duckingDb ?? -25);
    setLocalDuckingPercent(settings.duckingVolumePercent || 18);
    setLocalFadeDuration(settings.fadeDurationSeconds ?? 1.0);
    setLocalCrossfadeSeconds(settings.crossfadeSeconds ?? 1.5);
  }, [settings]);

  // Start direct value editing
  const handleStartEditValue = (field: 'song' | 'time' | 'repetition' | 'ducking' | 'fade' | 'crossfade') => {
    setEditingField(field);
    if (field === 'song') setTempValueInput(String(localSongInterval));
    else if (field === 'time') setTempValueInput(String(localTimeInterval));
    else if (field === 'repetition') setTempValueInput(String(localPromoRepetitions));
    else if (field === 'ducking') setTempValueInput(localDuckingMode === 'db' ? String(localDuckingDb) : String(localDuckingPercent));
    else if (field === 'fade') setTempValueInput(String(localFadeDuration));
    else if (field === 'crossfade') setTempValueInput(String(localCrossfadeSeconds));
  };

  const handleSaveEditedValue = (field: 'song' | 'time' | 'repetition' | 'ducking' | 'fade' | 'crossfade') => {
    const val = parseFloat(tempValueInput);
    if (!isNaN(val)) {
      if (field === 'song') {
        const clamped = Math.max(1, Math.min(15, Math.round(val)));
        setLocalSongInterval(clamped);
        triggerImmediateUpdate({ promoSongInterval: clamped }, 'Saved');
      } else if (field === 'time') {
        const clamped = Math.max(1, Math.min(60, Math.round(val)));
        setLocalTimeInterval(clamped);
        triggerImmediateUpdate({ promoTimeIntervalMinutes: clamped }, 'Saved');
      } else if (field === 'repetition') {
        const clamped = Math.max(1, Math.min(20, Math.round(val)));
        setLocalPromoRepetitions(clamped);
        triggerImmediateUpdate({ promoRepetitions: clamped }, `${clamped}x Repetition`);
      } else if (field === 'ducking') {
        if (localDuckingMode === 'db') {
          const clamped = Math.max(-40, Math.min(-6, Math.round(val)));
          setLocalDuckingDb(clamped);
          triggerImmediateUpdate({ duckingDb: clamped }, 'Saved');
        } else {
          const clamped = Math.max(5, Math.min(50, Math.round(val)));
          setLocalDuckingPercent(clamped);
          triggerImmediateUpdate({ duckingVolumePercent: clamped }, 'Saved');
        }
      } else if (field === 'fade') {
        const clamped = Math.max(0.2, Math.min(5.0, Math.round(val * 10) / 10));
        setLocalFadeDuration(clamped);
        triggerImmediateUpdate({ fadeDurationSeconds: clamped }, 'Saved');
      } else if (field === 'crossfade') {
        const clamped = Math.max(0, Math.min(5.0, Math.round(val * 10) / 10));
        setLocalCrossfadeSeconds(clamped);
        triggerImmediateUpdate({ crossfadeSeconds: clamped }, `${clamped}s Crossfade`);
      }
    }
    setEditingField(null);
  };

  // Audio Preview state
  const [previewingPromoId, setPreviewingPromoId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewPlayPromiseRef = useRef<Promise<void> | null>(null);

  const stopPreviewAudio = async () => {
    if (previewAudioRef.current) {
      const audio = previewAudioRef.current;
      previewAudioRef.current = null;
      if (previewPlayPromiseRef.current) {
        try {
          await previewPlayPromiseRef.current;
        } catch {
          // ignore
        }
      }
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    }
    setPreviewingPromoId(null);
  };

  const handleToggleMic = async () => {
    setMicError(null);
    if (isMicOn) {
      audioEngine.stopLiveMic();
      setIsMicOn(false);
      setMicLevel(0);
      if (micIntervalRef.current) {
        window.clearInterval(micIntervalRef.current);
        micIntervalRef.current = null;
      }
    } else {
      const started = await audioEngine.startLiveMic(settings.duckingVolumePercent);
      if (started) {
        setIsMicOn(true);
        micIntervalRef.current = window.setInterval(() => {
          setMicLevel(audioEngine.getMicLevel());
        }, 100);
      } else {
        setMicError(audioEngine.getLastMicError() || 'Microphone access allow karein ya ensure karein ki mic plugged-in hai.');
      }
    }
  };

  const handleAdminSearch = async (q: string = searchQuery, src: 'all' | 'youtube' | 'saavn' = adminSourceFilter) => {
    const clean = q.trim();

    // 1. Abort previous pending search request immediately
    if (adminSearchAbortControllerRef.current) {
      adminSearchAbortControllerRef.current.abort();
      adminSearchAbortControllerRef.current = null;
    }

    if (!clean) {
      adminSearchRequestIdRef.current += 1;
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // 2. Track unique Request ID for this specific search
    const currentRequestId = ++adminSearchRequestIdRef.current;

    // 3. Create fresh AbortController
    const controller = new AbortController();
    adminSearchAbortControllerRef.current = controller;

    setSearching(true);
    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(clean)}&source=${src}`,
        { signal: controller.signal }
      );

      // Verify that this is still the latest initiated search request
      if (currentRequestId !== adminSearchRequestIdRef.current) {
        return;
      }

      const data = await res.json();
      if (currentRequestId === adminSearchRequestIdRef.current && data.success) {
        const rawResults: SongTrack[] = data.results || [];
        const isJukebox = /jukebox|nonstop|non-stop|album|all songs|mashup|medley/i.test(clean);
        const validList = rawResults.filter((track) => {
          if (!track) return false;
          const sec = track.duration || 0;
          if (!isJukebox && sec > 900) return false;
          const comb = `${track.title || ''} ${track.artist || ''} ${track.album || ''}`.toLowerCase();
          return !/(ai\s*cover|ai\s*remake|ai\s*version|ai\s*voice|ai\s*generated|voice\s*clone|vocal\s*ai|\bsuno\b|\budio\b|fake\s*remake|cheap\s*remake|fan\s*made|re-upload|reupload)/i.test(comb);
        });
        setSearchResults(validList);
      }
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err?.name === 'AbortError') {
        return; // Normal intentional abort
      }
      console.warn('Admin music search error:', e);
    } finally {
      if (currentRequestId === adminSearchRequestIdRef.current) {
        setSearching(false);
        if (adminSearchAbortControllerRef.current === controller) {
          adminSearchAbortControllerRef.current = null;
        }
      }
    }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory({
      name: newCatName.trim(),
      description: newCatName.trim(),
      color: newCatColor,
    });
    setNewCatName('');
  };

  const togglePromoPreview = async (promo: PromoClip) => {
    if (previewingPromoId === promo.id) {
      await stopPreviewAudio();
      setPreviewingPromoId(null);
    } else {
      await stopPreviewAudio();
      const audio = new Audio(promo.audioUrl);
      previewAudioRef.current = audio;
      setPreviewingPromoId(promo.id);
      audio.onerror = () => {
        setPreviewingPromoId(null);
        previewAudioRef.current = null;
        previewPlayPromiseRef.current = null;
      };
      audio.onended = () => {
        setPreviewingPromoId(null);
        previewAudioRef.current = null;
        previewPlayPromiseRef.current = null;
      };

      try {
        const promise = audio.play();
        previewPlayPromiseRef.current = promise;
        await promise;
      } catch (err: unknown) {
        const error = err as { name?: string };
        if (error?.name !== 'AbortError') {
          console.warn('Audio preview notice:', err);
        }
        setPreviewingPromoId(null);
      } finally {
        previewPlayPromiseRef.current = null;
      }
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoTitle.trim() || !newPromoUrl.trim()) return;

    const rawAudioData = newPromoUrl.trim();
    const tempId = `promo-custom-${Date.now()}`;
    const promoPayload = {
      id: tempId,
      title: newPromoTitle.trim(),
      categoryId: newPromoCatId || categories[0]?.id || 'cat-xp95',
      audioUrl: rawAudioData,
      duration: newPromoDuration || 15,
      scriptSnippet: newPromoScript.trim() || newPromoTitle.trim(),
      storageType: 'cloud' as const,
      isCloudSaved: true,
      uploadedAt: Date.now(),
    };

    // 1. Permanently save to client-side IndexedDB FIRST (Guaranteed Zero-Loss)
    try {
      await savePromoToLocalDB(promoPayload as any, rawAudioData);
    } catch (idbErr) {
      console.warn('[AdminConsole] IndexedDB local save notice:', idbErr);
    }

    // 2. Synchronize with Server API
    try {
      const res = await fetch('/api/promo/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoPayload),
      });
      const data = await res.json();
      if (data.success && data.promo) {
        // Update IndexedDB record with server streaming url
        await savePromoToLocalDB(data.promo, rawAudioData);
        onAddPromo(data.promo);
        setPromoSaveSuccess(`"${newPromoTitle.trim()}" promo IndexedDB aur Cloud me permanently save ho gaya hai! Ab kabhi dubara upload nahi karna padega.`);
      } else {
        onAddPromo(promoPayload as any);
        setPromoSaveSuccess(`"${newPromoTitle.trim()}" promo local storage me permanently save ho gaya!`);
      }
    } catch (err) {
      console.warn('Promo upload server sync notice:', err);
      onAddPromo(promoPayload as any);
      setPromoSaveSuccess(`"${newPromoTitle.trim()}" promo device storage me permanently save ho gaya!`);
    }

    setTimeout(() => setPromoSaveSuccess(null), 6000);

    setNewPromoTitle('');
    setNewPromoUrl('');
    setNewPromoScript('');
    setUploadedPromoFileName('');
    setUploadedPromoFileSize('');
    setNewPromoDuration(15);
    if (promoFileInputRef.current) {
      promoFileInputRef.current.value = '';
    }

    // Refresh cloud storage metrics
    try {
      const statRes = await fetch('/api/storage/status');
      const statData = await statRes.json();
      if (statData.success && statData.data) {
        setCloudStorageStatus(statData.data);
      }
    } catch {
      // ignore
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/storage/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sangeet-cloud-database-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Backup download notice:', e);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('Kya aap sabhi official IndianOil promo announcements aur default settings cloud storage me restore karna chahte hain?')) return;
    try {
      const res = await fetch('/api/storage/restore-defaults', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setPromoSaveSuccess('Default official IOCL promos cloud storage me restore ho gaye!');
        setTimeout(() => setPromoSaveSuccess(null), 5000);
      }
    } catch (e) {
      console.warn('Restore defaults notice:', e);
    }
  };

  const handlePinChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);

    if (currentPinInput !== adminPin) {
      setPinChangeMsg({ type: 'error', text: 'Purana password galat hai.' });
      return;
    }

    if (newPinInput.length < 4) {
      setPinChangeMsg({ type: 'error', text: 'Naya password kam se kam 4 characters ka hona chahiye.' });
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinChangeMsg({ type: 'error', text: 'Naya password aur confirm password match nahi kar rahe.' });
      return;
    }

    onUpdateAdminPin(newPinInput);
    setPinChangeMsg({ type: 'success', text: 'Admin Password safaltapoorvak badal diya gaya!' });
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  // Open modal to create a new station
  const openCreateStationModal = () => {
    setModalStationId(null);
    setModalStationName('');
    setModalPinRequired(false);
    setModalStationPin('2006');
    setModalPromosEnabled(true);
    setModalAllowedSources('all');
    setModalPromoSongInterval(2);
    setModalPromoTimeInterval(10);
    setModalDuckingPercent(18);
    setStationModalOpen(true);
  };

  // Open modal to edit an existing station
  const openEditStationModal = (st: StationItem) => {
    setModalStationId(st.id);
    setModalStationName(st.name);
    setModalPinRequired(st.pinRequired ?? false);
    setModalStationPin(st.stationPin || '2006');
    setModalPromosEnabled(st.promosEnabled ?? true);
    setModalAllowedSources(st.allowedSources || 'all');
    setModalPromoSongInterval(st.promoSongInterval || 2);
    setModalPromoTimeInterval(st.promoTimeIntervalMinutes || 10);
    setModalDuckingPercent(st.duckingVolumePercent || 18);
    setStationModalOpen(true);
  };

  const handleSaveStationModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStationName.trim()) return;

    if (modalStationId) {
      // Update existing
      onUpdateStation(modalStationId, {
        name: modalStationName.trim(),
        pinRequired: modalPinRequired,
        stationPin: modalStationPin.trim() || '2006',
        promosEnabled: modalPromosEnabled,
        allowedSources: modalAllowedSources,
        promoSongInterval: modalPromoSongInterval,
        promoTimeIntervalMinutes: modalPromoTimeInterval,
        duckingVolumePercent: modalDuckingPercent,
      });
    } else {
      // Create new station
      onAddStation({
        name: modalStationName.trim(),
        pinRequired: modalPinRequired,
        stationPin: modalStationPin.trim() || '2006',
        promosEnabled: modalPromosEnabled,
        allowedSources: modalAllowedSources,
        promoSongInterval: modalPromoSongInterval,
        promoTimeIntervalMinutes: modalPromoTimeInterval,
        duckingVolumePercent: modalDuckingPercent,
      });
    }
    setStationModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] flex flex-col font-sans selection:bg-[#ff9500] selection:text-white pb-32 antialiased">
      {/* Top Header (macOS / iPadOS Translucent Bar) */}
      <header className="sticky top-0 z-40 bg-[#1c1c1e]/80 backdrop-blur-2xl border-b border-white/[0.08] px-4 md:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#ff9500]/20 border border-[#ff9500]/30 flex items-center justify-center text-[#ff9500] shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base md:text-lg tracking-tight text-white">Sangeet</span>
                <span className="text-[10px] font-semibold text-[#ff9500] bg-[#ff9500]/15 border border-[#ff9500]/30 px-2 py-0.5 rounded-full">
                  Admin Console
                </span>
              </div>
              <span className="text-[11px] text-[#86868b] truncate block">
                {stationName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Speaker Status */}
            <button
              onClick={onOpenSpeakerModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isSpeakerNode
                  ? 'bg-[#ff9500]/15 border-[#ff9500]/40 text-[#ff9500]'
                  : 'bg-white/[0.04] border-white/[0.08] text-[#86868b] hover:text-white'
              }`}
            >
              {isSpeakerNode ? (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Speaker Active</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remote Mode</span>
                </>
              )}
            </button>

            {/* Direct Promo Upload Button */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('promos');
                setPromoInputMode('upload');
                setTimeout(() => {
                  promoFileInputRef.current?.click();
                }, 100);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff9500]/15 hover:bg-[#ff9500]/25 border border-[#ff9500]/30 text-xs font-semibold text-[#ff9500] transition-all active:scale-95 cursor-pointer"
              title="Promo Audio Upload Karein"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload Promo</span>
            </button>

            {/* Switch to Staff */}
            <button
              onClick={onSwitchToStaff}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-semibold text-white transition-all active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Staff Mode</span>
            </button>

            {/* Leave Station */}
            <button
              onClick={onLeaveStation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-[#ff453a] hover:text-white transition-all active:scale-95"
              title="Station Chhodein"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Apple Segmented Tab Control (macOS / iPadOS HIG style) */}
        <div className="p-1 rounded-2xl bg-[#1c1c1e] border border-white/[0.08] flex items-center gap-1 overflow-x-auto shadow-sm">
          {/* 1. Schedule Tab */}
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'schedule'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </button>

          {/* 2. VIP Play Now Tab */}
          <button
            onClick={() => setActiveTab('vip_songs')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'vip_songs'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>VIP Play</span>
          </button>

          {/* 3. Live PA Mic */}
          <button
            onClick={() => setActiveTab('mic')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'mic'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Live Mic</span>
          </button>

          {/* 4. Promos Tab */}
          <button
            onClick={() => setActiveTab('promos')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'promos'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Promos ({promos.length})</span>
          </button>

          {/* 5. Stations Tab */}
          <button
            onClick={() => setActiveTab('stations')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'stations'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Stations ({stations.length})</span>
          </button>

          {/* 6. Settings & PIN */}
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
              activeTab === 'security'
                ? 'bg-white/15 text-white shadow-sm font-semibold'
                : 'text-[#86868b] hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security</span>
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* TAB 1: SCHEDULE (Apple HIG Inset Grouped layout) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            {/* Live Promo Active Banner with Minimal Stop Button */}
            {isPromoPlaying && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 animate-in fade-in duration-200 shadow-md">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                      Commercial Promo Broadcasting Now
                    </span>
                    <span className="text-sm font-bold text-white truncate block">
                      {activePromoClip?.title || 'Announcement'}
                    </span>
                  </div>
                </div>

                {onStopPromo && (
                  <button
                    type="button"
                    onClick={onStopPromo}
                    className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/35 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm"
                    title="Promo rokein aur background gaana un-duck karein"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>STOP PROMO NOW</span>
                  </button>
                )}
              </div>
            )}

            {/* 1. Instant Promo Broadcast Card */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-1.5 max-w-xl">
                <h3 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#ff9500] fill-[#ff9500]" /> Instant Promo Broadcast
                </h3>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Triggers an immediate announcement on the forecourt speakers right now, smoothly ducking current background music.
                </p>
              </div>

              <button
                onClick={onTriggerUrgentPromo}
                className="px-5 py-3 rounded-xl bg-[#ff9500] hover:bg-[#ff9f0a] active:scale-95 text-black font-semibold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                <span>BROADCAST PROMO NOW</span>
              </button>
            </div>

            {/* 1.5. PROMO AUDIO UPLOAD SHORTCUT CARD */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/[0.08] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#ff9500]/15 text-[#ff9500]">
                    <Upload className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm md:text-base font-semibold text-white">Naya Promo Audio Upload Karein</h3>
                </div>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  Apne phone ya computer ki gallery se custom advertisement ya safety announcement audio (MP3, WAV, AAC) upload karein.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('promos');
                  setPromoInputMode('upload');
                  setTimeout(() => {
                    promoFileInputRef.current?.click();
                  }, 100);
                }}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2 border border-white/[0.08] transition-all shrink-0 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>UPLOAD PROMO AUDIO</span>
              </button>
            </div>

            {/* 2. SECTION: PROMO AUDIO STRATEGY (Apple HIG Inset Grouped) */}
            <div className="space-y-2">
              <div className="px-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                    Promo Strategy
                  </span>
                  {savedBadge && (
                    <span className="text-[10px] font-medium text-[#30d158] flex items-center gap-1 animate-in fade-in duration-150">
                      <Check className="w-3 h-3" />
                      <span>{savedBadge}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleInfo('strategy')}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    activeInfoKey === 'strategy' ? 'bg-[#ff9500]/20 text-[#ff9500]' : 'text-[#86868b] hover:text-white'
                  }`}
                  title="Promo strategy guidelines"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              {/* Info Explanatory Sheet / Callout */}
              {activeInfoKey === 'strategy' && (
                <div className="p-3.5 rounded-2xl bg-black/60 border border-white/[0.08] text-xs text-[#86868b] leading-relaxed animate-in fade-in duration-200">
                  <p className="font-semibold text-white mb-0.5">Commercial Promo Broadcasting</p>
                  <strong className="text-white">Song-Wise:</strong> Plays promos between tracks after every N completed songs.<br />
                  <strong className="text-white">Time-Wise:</strong> Continuous real-time timer triggers promos every N minutes with smooth mid-song music ducking without interrupting playback.
                </div>
              )}

              <div className="bg-[#1c1c1e] rounded-2xl border border-white/[0.08] divide-y divide-white/[0.08] overflow-hidden shadow-sm">
                {/* Row 1: Promos Active Switch */}
                <div className="p-4 md:p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#30d158]/15 flex items-center justify-center text-[#30d158]">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Commercial Promos</span>
                      <span className="text-xs text-[#86868b]">Forecourt broadcast injection</span>
                    </div>
                  </div>
                  <IOSToggle
                    checked={localPromosEnabled}
                    onChange={(c) => {
                      setLocalPromosEnabled(c);
                      triggerImmediateUpdate({ promosEnabled: c }, c ? 'Promos Active' : 'Promos Muted');
                    }}
                    color="#30d158"
                  />
                </div>

                {/* Row 2: Interval Mode Segmented Control */}
                <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-semibold text-white block">Interval Type</span>
                    <span className="text-xs text-[#86868b]">Song count (inter-track) or clock schedule (mid-song ducking)</span>
                  </div>
                  <div className="p-1 rounded-xl bg-black/60 border border-white/[0.08] inline-flex items-center gap-1 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setLocalIntervalType('songs_count');
                        triggerImmediateUpdate({ promoIntervalType: 'songs_count' }, 'Song-Wise');
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        localIntervalType === 'songs_count'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-[#86868b] hover:text-white'
                      }`}
                    >
                      Song-Wise
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalIntervalType('time_interval');
                        triggerImmediateUpdate({ promoIntervalType: 'time_interval' }, 'Time-Wise');
                      }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        localIntervalType === 'time_interval'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-[#86868b] hover:text-white'
                      }`}
                    >
                      Time-Wise
                    </button>
                  </div>
                </div>

                {/* Row 3: Interval Slider */}
                <div className="p-4 md:p-5 space-y-2">
                  {localIntervalType === 'songs_count' ? (
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="text-white font-medium">Promo Frequency:</span>
                        {editingField === 'song' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="15"
                              value={tempValueInput}
                              onChange={(e) => setTempValueInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedValue('song')}
                              className="w-16 px-1.5 py-0.5 rounded bg-black border border-[#ff9500] text-center font-bold text-[#ff9500] text-xs focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditedValue('song')}
                              className="p-1 text-[#30d158] hover:bg-[#30d158]/20 rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditValue('song')}
                            className="px-2.5 py-1 rounded-md bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 font-mono text-xs font-semibold hover:bg-[#ff9500]/25 transition-colors cursor-pointer flex items-center gap-1"
                            title="Tap to type number"
                          >
                            <span>Every {localSongInterval} {localSongInterval === 1 ? 'Song' : 'Songs'}</span>
                            <Edit2 className="w-3 h-3 opacity-60" />
                          </button>
                        )}
                      </div>
                      <AppleSlider
                        value={localSongInterval}
                        min={1}
                        max={15}
                        step={1}
                        onChange={(val) => {
                          setLocalSongInterval(val);
                          triggerDebouncedUpdate({ promoSongInterval: val }, `${val} Songs`);
                        }}
                        accentColor="orange"
                        size="md"
                        minLabel="1 Song"
                        maxLabel="15 Songs"
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="text-white font-medium">Promo Interval:</span>
                        {editingField === 'time' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              max="60"
                              value={tempValueInput}
                              onChange={(e) => setTempValueInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedValue('time')}
                              className="w-16 px-1.5 py-0.5 rounded bg-black border border-[#ff9500] text-center font-bold text-[#ff9500] text-xs focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditedValue('time')}
                              className="p-1 text-[#30d158] hover:bg-[#30d158]/20 rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditValue('time')}
                            className="px-2.5 py-1 rounded-md bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 font-mono text-xs font-semibold hover:bg-[#ff9500]/25 transition-colors cursor-pointer flex items-center gap-1"
                            title="Tap to type number"
                          >
                            <span>Every {localTimeInterval} Minutes</span>
                            <Edit2 className="w-3 h-3 opacity-60" />
                          </button>
                        )}
                      </div>
                      <AppleSlider
                        value={localTimeInterval}
                        min={1}
                        max={60}
                        step={1}
                        onChange={(val) => {
                          setLocalTimeInterval(val);
                          triggerDebouncedUpdate({ promoTimeIntervalMinutes: val }, `${val} Mins`);
                        }}
                        accentColor="orange"
                        size="md"
                        minLabel="1 Min"
                        maxLabel="60 Mins"
                      />
                    </div>
                  )}
                </div>

                {/* Row 4: Promo Repetitions */}
                <div className="p-4 md:p-5 space-y-2">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-medium">Repetition:</span>
                        <button
                          type="button"
                          onClick={() => toggleInfo('repetition')}
                          className={`cursor-pointer transition-colors p-0.5 rounded hover:bg-white/[0.08] ${
                            activeInfoKey === 'repetition' ? 'text-[#ff9500]' : 'text-[#86868b] hover:text-white'
                          }`}
                          title="Repetition details"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {editingField === 'repetition' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={tempValueInput}
                            onChange={(e) => setTempValueInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedValue('repetition')}
                            className="w-16 px-1.5 py-0.5 rounded bg-black border border-[#ff9500] text-center font-bold text-[#ff9500] text-xs focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditedValue('repetition')}
                            className="p-1 text-[#30d158] hover:bg-[#30d158]/20 rounded cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEditValue('repetition')}
                          className="px-2.5 py-1 rounded-md bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 font-mono text-xs font-semibold hover:bg-[#ff9500]/25 transition-colors cursor-pointer flex items-center gap-1"
                          title="Tap to type number"
                        >
                          <span>{localPromoRepetitions} {localPromoRepetitions === 1 ? 'Time' : 'Times'}</span>
                          <Edit2 className="w-3 h-3 opacity-60" />
                        </button>
                      )}
                    </div>

                    {/* Explanatory callout inside (i) info toggle */}
                    {activeInfoKey === 'repetition' && (
                      <div className="mb-2.5 p-2.5 rounded-xl bg-black/60 border border-white/[0.08] text-[11px] text-[#86868b] leading-relaxed animate-in fade-in duration-200">
                        Promo trigger hone par audio kitni baar back-to-back play hoga gaane ka volume normal hone se pehle.
                      </div>
                    )}

                    <AppleSlider
                      value={localPromoRepetitions}
                      min={1}
                      max={20}
                      step={1}
                      onChange={(val) => {
                        setLocalPromoRepetitions(val);
                        triggerDebouncedUpdate({ promoRepetitions: val }, `${val}x Repetition`);
                      }}
                      accentColor="orange"
                      size="md"
                      minLabel="1 Time"
                      maxLabel="20 Times"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SECTION: ADVANCED AUDIO SETTINGS (Ducking & Fade Engine) */}
            <div className="space-y-2">
              <div className="bg-[#1c1c1e] rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm">
                {/* Header Accordion Toggle */}
                <div
                  onClick={() => setAudioSettingsOpen(!audioSettingsOpen)}
                  className="p-4 md:p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#0071e3]/15 flex items-center justify-center text-[#0071e3]">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white block">Audio Settings</span>
                      <p className="text-xs text-[#86868b] mt-0.5">
                        {localDuckingMode === 'db' ? `${localDuckingDb} dB` : `${localDuckingPercent}%`} • {localFadeDuration}s Fade • {localCrossfadeSeconds}s Crossfade
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleInfo('audio');
                      }}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                        activeInfoKey === 'audio' ? 'bg-[#0071e3]/20 text-[#0071e3]' : 'text-[#86868b] hover:text-white'
                      }`}
                      title="Audio settings info"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <div className="p-1 rounded bg-white/[0.06] text-[#86868b]">
                      {audioSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Info Explanatory Sheet / Callout */}
                {activeInfoKey === 'audio' && (
                  <div className="mx-4 md:mx-5 mb-4 p-3.5 rounded-xl bg-black/60 border border-white/[0.08] text-xs text-[#86868b] leading-relaxed animate-in fade-in duration-200 space-y-1.5">
                    <p className="font-semibold text-white">Audio Ducking, Fade Lead-In & Crossfade</p>
                    <p>• <strong>Ducking:</strong> Promo start hone se {localFadeDuration}s pehle background music volume smoothly duck hota hai aur promo ke baad normal ho jata hai.</p>
                    <p>• <strong>Song Crossfade:</strong> Gaana khatam hone par agla gaana achanak se bajne ki jagah {localCrossfadeSeconds}s ke smooth audio blend ke sath transition karega (0s = Cut, 5s = Smooth DJ mix).</p>
                  </div>
                )}

                {/* Collapsible Content - Apple Inset Grouped Table */}
                {audioSettingsOpen && (
                  <div className="border-t border-white/[0.08] divide-y divide-white/[0.08] bg-black/20">
                    {/* Row 1: Unit Toggle (dB vs %) */}
                    <div className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-sm font-semibold text-white block">Volume Unit</span>
                      </div>
                      <div className="p-0.5 rounded-lg bg-black/60 border border-white/[0.08] inline-flex items-center gap-0.5 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setLocalDuckingMode('percent');
                            triggerImmediateUpdate({ duckingMode: 'percent' }, '% Unit');
                          }}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            localDuckingMode === 'percent'
                              ? 'bg-[#0071e3] text-white shadow-sm'
                              : 'text-[#86868b] hover:text-white'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLocalDuckingMode('db');
                            triggerImmediateUpdate({ duckingMode: 'db' }, 'dB Unit');
                          }}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            localDuckingMode === 'db'
                              ? 'bg-[#0071e3] text-white shadow-sm'
                              : 'text-[#86868b] hover:text-white'
                          }`}
                        >
                          dB
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Ducking Volume Slider */}
                    <div className="p-4 md:p-5 space-y-2">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="text-white font-medium">Background Music Ducking:</span>
                        {editingField === 'ducking' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={localDuckingMode === 'db' ? -40 : 5}
                              max={localDuckingMode === 'db' ? -6 : 50}
                              value={tempValueInput}
                              onChange={(e) => setTempValueInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedValue('ducking')}
                              className="w-16 px-1.5 py-0.5 rounded bg-black border border-[#0071e3] text-center font-bold text-[#0071e3] text-xs focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditedValue('ducking')}
                              className="p-1 text-[#30d158] hover:bg-[#30d158]/20 rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditValue('ducking')}
                            className="px-2.5 py-1 rounded-md bg-[#0071e3]/15 text-[#0071e3] border border-[#0071e3]/30 font-mono text-xs font-semibold hover:bg-[#0071e3]/25 transition-colors cursor-pointer flex items-center gap-1"
                            title="Tap to type number"
                          >
                            <span>{localDuckingMode === 'db' ? `${localDuckingDb} dB` : `${localDuckingPercent}%`}</span>
                            <Edit2 className="w-3 h-3 opacity-60" />
                          </button>
                        )}
                      </div>

                      {localDuckingMode === 'db' ? (
                        <AppleSlider
                          value={localDuckingDb}
                          min={-40}
                          max={-6}
                          step={1}
                          onChange={(val) => {
                            setLocalDuckingDb(val);
                            triggerDebouncedUpdate({ duckingDb: val }, `${val} dB`);
                          }}
                          accentColor="blue"
                          size="md"
                          minLabel="-40 dB (Deep)"
                          maxLabel="-6 dB (Subtle)"
                        />
                      ) : (
                        <AppleSlider
                          value={localDuckingPercent}
                          min={5}
                          max={50}
                          step={1}
                          onChange={(val) => {
                            setLocalDuckingPercent(val);
                            triggerDebouncedUpdate({ duckingVolumePercent: val }, `${val}%`);
                          }}
                          accentColor="blue"
                          size="md"
                          minLabel="5% (Quiet)"
                          maxLabel="50% (Audible)"
                        />
                      )}
                    </div>

                    {/* Row 3: Promo Ducking Fade Duration */}
                    <div className="p-4 md:p-5 space-y-2">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="text-white font-medium flex items-center gap-1.5">
                          <Waves className="w-3.5 h-3.5 text-[#af52de]" /> Promo Fade Lead Duration:
                        </span>
                        {editingField === 'fade' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0.2"
                              max="5.0"
                              step="0.1"
                              value={tempValueInput}
                              onChange={(e) => setTempValueInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedValue('fade')}
                              className="w-16 px-1.5 py-0.5 rounded bg-black border border-[#af52de] text-center font-bold text-[#af52de] text-xs focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditedValue('fade')}
                              className="p-1 text-[#30d158] hover:bg-[#30d158]/20 rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditValue('fade')}
                            className="px-2.5 py-1 rounded-md bg-[#af52de]/15 text-[#af52de] border border-[#af52de]/30 font-mono text-xs font-semibold hover:bg-[#af52de]/25 transition-colors cursor-pointer flex items-center gap-1"
                            title="Tap to type number"
                          >
                            <span>{localFadeDuration}s</span>
                            <Edit2 className="w-3 h-3 opacity-60" />
                          </button>
                        )}
                      </div>

                      <AppleSlider
                        value={localFadeDuration}
                        min={0.2}
                        max={5.0}
                        step={0.1}
                        onChange={(val) => {
                          const rounded = Math.round(val * 10) / 10;
                          setLocalFadeDuration(rounded);
                          triggerDebouncedUpdate({ fadeDurationSeconds: rounded }, `${rounded}s Fade`);
                        }}
                        accentColor="purple"
                        size="md"
                        minLabel="0.2s (Fast)"
                        maxLabel="5.0s (Smooth)"
                      />
                    </div>

                    {/* Row 4: Song Transition Crossfade Duration Slider (0-5s) */}
                    <div className="p-4 md:p-5 space-y-2">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <div>
                          <span className="text-white font-medium flex items-center gap-1.5">
                            <Disc3 className="w-3.5 h-3.5 text-[#30d158]" /> Song Transition Crossfade:
                          </span>
                        </div>
                        {editingField === 'crossfade' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="5.0"
                              step="0.5"
                              value={tempValueInput}
                              onChange={(e) => setTempValueInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedValue('crossfade')}
                              className="w-16 px-1.5 py-0.5 rounded bg-black border border-[#30d158] text-center font-bold text-[#30d158] text-xs focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditedValue('crossfade')}
                              className="p-1 text-[#30d158] hover:bg-[#30d158]/20 rounded cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditValue('crossfade')}
                            className="px-2.5 py-1 rounded-md bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 font-mono text-xs font-semibold hover:bg-[#30d158]/25 transition-colors cursor-pointer flex items-center gap-1"
                            title="Tap to type number"
                          >
                            <span>{localCrossfadeSeconds}s</span>
                            <Edit2 className="w-3 h-3 opacity-60" />
                          </button>
                        )}
                      </div>

                      <AppleSlider
                        value={localCrossfadeSeconds}
                        min={0}
                        max={5.0}
                        step={0.5}
                        onChange={(val) => {
                          const rounded = Math.round(val * 10) / 10;
                          setLocalCrossfadeSeconds(rounded);
                          triggerDebouncedUpdate({ crossfadeSeconds: rounded }, `${rounded}s Crossfade`);
                        }}
                        accentColor="green"
                        size="md"
                        minLabel="0s (Direct Cut)"
                        maxLabel="5.0s (Smooth Blend)"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. TARGET CAMPAIGN CATEGORY Card */}
            <div className="p-5 md:p-6 rounded-2xl bg-[#1c1c1e] border border-white/[0.08] space-y-3 shadow-sm">
              <div>
                <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
                  Target Campaign Category
                </h3>
                <p className="text-xs text-[#86868b] mt-0.5">
                  Rotate through all promotions or restrict playback to a specific campaign.
                </p>
              </div>

              <select
                value={settings.activeCategoryFilter}
                onChange={(e) => onUpdateSettings({ activeCategoryFilter: e.target.value })}
                className="w-full bg-black/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#ff9500] cursor-pointer"
              >
                <option value="all">Rotate All Categories Evenly (Default)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#1c1c1e] text-white">
                    {c.name} ({c.description})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 2: VIP PLAY NOW (INSTANT ADMIN OVERRIDE) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'vip_songs' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" /> VIP Song Selector (Admin Control)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Admin ka chuna gaana seedhe chalu hoga ya VIP priority par lagega.
                  </p>
                </div>

                {/* Source Filter */}
                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/[0.08] self-start sm:self-auto">
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
                        setAdminSourceFilter(src.id);
                        if (searchQuery) handleAdminSearch(searchQuery, src.id);
                      }}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        adminSourceFilter === src.id
                          ? src.id === 'youtube'
                            ? 'bg-red-600 text-white'
                            : src.id === 'saavn'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-orange-500 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {src.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAdminSearch();
                      }
                    }}
                    placeholder="VIP Gaana Khojein: Hindi, Punjabi, Bhojpuri, Instrumental..."
                    className="w-full bg-black border border-white/[0.12] focus:border-orange-500 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none"
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
                  onClick={() => handleAdminSearch()}
                  disabled={!searchQuery.trim() || searching}
                  className="px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 active:scale-95 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
                  title="Search Karein"
                >
                  <Search className="w-4 h-4" />
                  <span>Search</span>
                </button>
              </div>

              {searching && (
                <div className="text-center py-4 text-xs text-slate-400 animate-pulse">
                  VIP gaane khoje ja rahe hain...
                </div>
              )}

              {/* VIP Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {searchResults.map((track, idx) => (
                    <div
                      key={`admin-vip-${track.id}-${idx}`}
                      className="p-3.5 rounded-2xl bg-black/60 border border-white/[0.08] flex items-center justify-between gap-4 hover:border-white/[0.15] transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <AppleArtwork
                          src={track.artworkUrl}
                          alt={track.title}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-white truncate">{track.title}</p>
                            {(track.isOfficial || track.source === 'jiosaavn' || track.source === 'youtube') && (
                              <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.2 rounded-md inline-flex items-center gap-0.5 shrink-0" title="Official Music Channel">
                                ✓ Official
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{track.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Play Now Override */}
                        <button
                          onClick={() => {
                            onAdminPlayNow(track);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-orange-500/20 active:scale-95"
                          title="Current gaana rokk kar turant bajayein"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>Abhi Bajayein</span>
                        </button>

                        {/* Add to VIP Queue */}
                        <button
                          onClick={() => {
                            onAddAdminQueue(track);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-slate-200 font-bold text-xs flex items-center gap-1 active:scale-95"
                          title="VIP Priority Queue me lagayein"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>VIP Queue</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 3: LIVE PA MIC BROADCASTER */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'mic' && (
          <div className="max-w-2xl mx-auto py-2">
            <LiveAnnouncementControl
              settings={settings}
              variant="desktop"
              onStartAnnouncement={onStartLiveAnnouncement}
              onStopAnnouncement={onStopLiveAnnouncement}
            />
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 4: PROMO AUDIOS & CATEGORIES */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'promos' && (
          <div className="space-y-6">
            {promoSaveSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2.5 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{promoSaveSuccess}</span>
              </div>
            )}

            {/* Cloud Storage Database Permanent Status Banner */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-orange-950/40 via-black to-slate-950 border border-orange-500/30 shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                    <Cloud className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        Cloud Storage Database Engine
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                        ACTIVE &bull; PERMANENT
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Sabhi station settings, PIN, aur promo audio files cloud storage par permanently saved hain. Manager ko har dam admin portal se upload karne ki zaroorat nahi hai.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all"
                    title="Export JSON Database"
                  >
                    <Download className="w-3.5 h-3.5 text-orange-400" />
                    <span>Backup Database</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all"
                    title="Restore IOCL Promos"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Restore Defaults</span>
                  </button>
                </div>
              </div>

              {/* Metric Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-mono">STORED PROMOS</span>
                  <span className="text-sm font-bold text-white font-mono">{promos.length} Clips</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-mono">CLOUD DISK SPACE</span>
                  <span className="text-sm font-bold text-orange-400 font-mono">
                    {cloudStorageStatus?.totalSizeReadable || 'Saved to Disk'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-mono">RE-UPLOAD REQUIRED</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">0 (Zero &bull; Permanent)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/[0.06]">
                  <span className="text-[10px] text-slate-400 block font-mono">AUDIO STREAMING</span>
                  <span className="text-sm font-bold text-sky-400 font-mono">HTTP 206 Range OK</span>
                </div>
              </div>
            </div>

            {/* Promo Upload Form */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-orange-400" /> Naya Promo Audio Jodein
                </h3>

                {/* Input Mode Switcher */}
                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setPromoInputMode('upload')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      promoInputMode === 'upload'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>File Upload</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromoInputMode('url')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      promoInputMode === 'url'
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>URL / Template</span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCreatePromo} className="space-y-4">
                {/* 1. FILE UPLOAD DROPZONE */}
                {promoInputMode === 'upload' ? (
                  <div className="space-y-3">
                    <input
                      ref={promoFileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handlePromoFileUpload}
                      className="hidden"
                      id="promo-file-input"
                    />

                    <label
                      htmlFor="promo-file-input"
                      className="border-2 border-dashed border-white/[0.15] hover:border-orange-500/50 rounded-2xl p-5 text-center cursor-pointer transition-all bg-black/30 hover:bg-orange-500/[0.03] block"
                    >
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400">
                          <Upload className="w-6 h-6 animate-bounce" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {uploadedPromoFileName ? 'Naya audio file badlein' : 'Audio file select karein (MP3, WAV, AAC, M4A)'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Apne phone ya computer ki gallery / files se announcement choose karein
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Uploaded Audio Info & Inline Preview Player */}
                    {newPromoUrl && promoInputMode === 'upload' && (
                      <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileAudio className="w-4 h-4 text-orange-400 shrink-0" />
                            <span className="font-bold text-white truncate">{uploadedPromoFileName || 'Selected Audio'}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-[11px] text-orange-300 font-mono">
                            {uploadedPromoFileSize && <span>{uploadedPromoFileSize}</span>}
                            <span>&bull; {newPromoDuration}s</span>
                          </div>
                        </div>

                        {/* Inline HTML5 Audio Player */}
                        <audio controls src={newPromoUrl} className="w-full h-8 rounded-lg accent-orange-500" />
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2. URL & TEMPLATES MODE */
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newPromoUrl}
                      onChange={(e) => setNewPromoUrl(e.target.value)}
                      placeholder="Audio MP3 URL paste karein (e.g. https://.../safety.mp3)"
                      className="w-full bg-black border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                    />

                    {/* Quick IndianOil Sound Templates */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400">Pre-Loaded IndianOil Templates:</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          {
                            title: 'XP95 High Octane Promo',
                            url: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
                            cat: 'cat-xp95',
                            duration: 15,
                            script: 'Engine ko dein behtareen mileage aur instant pickup with IndianOil XP95 Petrol!',
                          },
                          {
                            title: 'SERVO 4T Engine Oil Offer',
                            url: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
                            cat: 'cat-servo',
                            duration: 18,
                            script: 'Engine ki lambi umar aur smooth ride ke liye chunein SERVO 4T Engine Oil.',
                          },
                          {
                            title: 'Safety - Switch Off Engine',
                            url: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
                            cat: 'cat-safety',
                            duration: 12,
                            script: 'Fuel bharwate samay gaadi ka engine aur mobile phone switch off rakhein.',
                          },
                          {
                            title: 'XTRAREWARDS Points Alert',
                            url: 'https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3',
                            cat: 'cat-rewards',
                            duration: 15,
                            script: 'Har fuel refill par payein reward points IndianOil XTRAREWARDS app ke saath.',
                          },
                        ].map((tpl) => (
                          <button
                            key={tpl.title}
                            type="button"
                            onClick={() => {
                              setNewPromoTitle(tpl.title);
                              setNewPromoUrl(tpl.url);
                              setNewPromoCatId(tpl.cat);
                              setNewPromoDuration(tpl.duration);
                              setNewPromoScript(tpl.script);
                            }}
                            className="p-2 rounded-xl bg-white/[0.04] hover:bg-orange-500/20 border border-white/[0.08] hover:border-orange-500/30 text-left transition-all text-[11px]"
                          >
                            <span className="font-bold text-slate-200 block truncate">{tpl.title}</span>
                            <span className="text-[10px] text-slate-400 block">{tpl.duration}s clip</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Metadata Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Promo Title:</label>
                    <input
                      type="text"
                      value={newPromoTitle}
                      onChange={(e) => setNewPromoTitle(e.target.value)}
                      placeholder="e.g. XP95 Super Offer Hindi"
                      className="w-full bg-black border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Category:</label>
                    <select
                      value={newPromoCatId}
                      onChange={(e) => setNewPromoCatId(e.target.value)}
                      className="w-full bg-black border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Announcement Script (Text):</label>
                  <input
                    type="text"
                    value={newPromoScript}
                    onChange={(e) => setNewPromoScript(e.target.value)}
                    placeholder="e.g. Fuel bharwate samay engine aur mobile band rakhein..."
                    className="w-full bg-black border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400">
                    Duration: <span className="text-orange-400 font-mono font-bold">{newPromoDuration} seconds</span>
                  </span>
                  <button
                    type="submit"
                    disabled={!newPromoTitle.trim() || !newPromoUrl.trim() || isReadingAudio}
                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Promo Save Karein</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Existing Promos List */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] space-y-4">
              <h3 className="text-base font-bold text-white">Sabhi Promos ({promos.length})</h3>
              <div className="space-y-3">
                {promos.map((promo) => (
                  <div
                    key={promo.id}
                    className="p-4 rounded-2xl bg-black/40 border border-white/[0.08] flex items-center justify-between gap-3"
                  >
                    <div className="truncate">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-white truncate">{promo.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${promo.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {promo.enabled ? 'ON' : 'OFF'}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          <span>Permanent Storage (Cloud + Local)</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{promo.scriptSnippet}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => togglePromoPreview(promo)}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-bold text-white"
                      >
                        {previewingPromoId === promo.id ? 'Stop' : 'Preview'}
                      </button>
                      <button
                        onClick={() => onTogglePromo(promo.id, !promo.enabled)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold ${promo.enabled ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                      >
                        {promo.enabled ? 'Disable' : 'Enable'}
                      </button>
                      {promos.length > 1 && (
                        <button
                          onClick={() => {
                            deletePromoFromLocalDB(promo.id);
                            onDeletePromo(promo.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 5: STATIONS MANAGEMENT (CLICK ANY STATION TO EDIT) */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'stations' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-orange-400" /> Petrol Pump Stations ({stations.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kisi bhi station par click karke uske naam, PIN, promos aur music sources edit karein.
                </p>
              </div>

              <button
                onClick={openCreateStationModal}
                className="px-4 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white flex items-center gap-1.5 shadow-md shadow-orange-500/20 active:scale-95 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Naya Station Banayein</span>
              </button>
            </div>

            {/* Clickable Stations List */}
            <div className="space-y-3">
              {stations.map((st) => (
                <div
                  key={st.id}
                  onClick={() => openEditStationModal(st)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all hover:border-white/[0.2] ${
                    st.id === stationId
                      ? 'bg-orange-500/10 border-orange-500/40'
                      : 'bg-black/40 border-white/[0.08]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${st.id === stationId ? 'bg-orange-500 text-white' : 'bg-white/[0.06] text-slate-400'}`}>
                        <Radio className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{st.name}</span>
                          {st.id === stationId && (
                            <span className="text-[10px] font-bold text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded-full border border-orange-500/30">
                              Active Abhi
                            </span>
                          )}
                        </div>

                        {/* Meta Tags */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {/* PIN Badge */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.pinRequired ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-white/[0.08]'}`}>
                            {st.pinRequired ? `🔒 PIN: ${st.stationPin || '2006'}` : '🔓 PIN: Off'}
                          </span>

                          {/* Promo Badge */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.promosEnabled ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-red-500/10 text-red-300 border-red-500/30'}`}>
                            {st.promosEnabled ? '📢 Promos ON' : '🔇 Promos OFF'}
                          </span>

                          {/* Allowed Source Badge */}
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                            🎵 {st.allowedSources === 'youtube' ? 'Only Sangeet' : st.allowedSources === 'saavn' ? 'Only JioSaavn' : 'All Sources'}
                          </span>

                          <span className="text-[11px] text-slate-400">
                            Interval: {st.promoSongInterval} Songs ({st.promoTimeIntervalMinutes}m) &bull; Ducking: {st.duckingVolumePercent}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-orange-400 font-bold flex items-center gap-1 hover:underline">
                        <Edit2 className="w-3.5 h-3.5" /> Edit Karein
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* TAB 6: SETTINGS & PASSWORD */}
        {/* ------------------------------------------------------------------ */}
        {activeTab === 'security' && (
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/[0.08] max-w-md mx-auto space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-orange-400" /> Admin Password Badlein
              </h3>
              <p className="text-xs text-slate-400">Current Default Password: {adminPin || '2006'}</p>
            </div>

            <form onSubmit={handlePinChangeSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Purana Password:</label>
                <input
                  type="password"
                  value={currentPinInput}
                  onChange={(e) => setCurrentPinInput(e.target.value)}
                  placeholder="Current Password"
                  className="w-full bg-black border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Naya Password:</label>
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="Naya Password (kam se kam 4 digit)"
                  className="w-full bg-black border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Naya Password Confirm Karein:</label>
                <input
                  type="password"
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value)}
                  placeholder="Confirm Password"
                  className="w-full bg-black border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              {pinChangeMsg && (
                <p className={`text-xs ${pinChangeMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pinChangeMsg.text}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs uppercase text-white transition-all shadow-md active:scale-95"
              >
                Password Save Karein
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* STATION EDIT / CREATE MODAL (Requested by user) */}
      {/* ------------------------------------------------------------- */}
      {stationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#121214] border border-white/[0.12] rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-orange-400" />
                {modalStationId ? 'Station Options Edit Karein' : 'Naya Forecourt Station Banayein'}
              </h3>
              <button
                onClick={() => setStationModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.08]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStationModal} className="space-y-4">
              {/* 1. Station Name */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Station Ka Naam:</label>
                <input
                  type="text"
                  value={modalStationName}
                  onChange={(e) => setModalStationName(e.target.value)}
                  placeholder="e.g. Maa Sumitra Devi F.S., Highway Pump 2"
                  className="w-full bg-black border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  required
                />
              </div>

              {/* 2. Station Entering PIN Option */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">Station Entering PIN:</span>
                    <span className="text-[11px] text-slate-400">Staff entry ke waqt password maangein</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalPinRequired(!modalPinRequired)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      modalPinRequired
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/[0.08] text-slate-400'
                    }`}
                  >
                    {modalPinRequired ? 'ON' : 'OFF'}
                  </button>
                </div>

                {modalPinRequired && (
                  <div className="pt-2">
                    <label className="text-[11px] text-slate-400 block mb-1">Station Passcode (PIN):</label>
                    <input
                      type="text"
                      value={modalStationPin}
                      onChange={(e) => setModalStationPin(e.target.value)}
                      placeholder="e.g. 2006"
                      className="w-full bg-black border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                )}
              </div>

              {/* 3. Promo Broadcast On/Off */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Automated Promos:</span>
                  <span className="text-[11px] text-slate-400">Pump par commercial / safety promos</span>
                </div>
                <button
                  type="button"
                  onClick={() => setModalPromosEnabled(!modalPromosEnabled)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    modalPromosEnabled
                      ? 'bg-emerald-500 text-white'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {modalPromosEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* 4. Allowed Music Sources */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/[0.08] space-y-2">
                <span className="text-xs font-semibold text-white block">Allowed Music Sources:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalAllowedSources('all')}
                    className={`py-2 px-2 rounded-xl text-center text-xs font-bold border transition-all ${
                      modalAllowedSources === 'all'
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-black text-slate-400 border-white/[0.08]'
                    }`}
                  >
                    Dono (All)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAllowedSources('youtube')}
                    className={`py-2 px-2 rounded-xl text-center text-xs font-bold border transition-all ${
                      modalAllowedSources === 'youtube'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-black text-slate-400 border-white/[0.08]'
                    }`}
                  >
                    Only Sangeet
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAllowedSources('saavn')}
                    className={`py-2 px-2 rounded-xl text-center text-xs font-bold border transition-all ${
                      modalAllowedSources === 'saavn'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-black text-slate-400 border-white/[0.08]'
                    }`}
                  >
                    Only JioSaavn
                  </button>
                </div>
              </div>

              {/* 5. Sliders: Songs Interval, Time Interval & Ducking */}
              <div className="space-y-4 pt-1">
                <AppleSlider
                  value={modalPromoSongInterval}
                  min={1}
                  max={15}
                  step={1}
                  onChange={(val) => setModalPromoSongInterval(val)}
                  accentColor="orange"
                  size="sm"
                  label="Har kitne gaano baad promo"
                  valueDisplay={`${modalPromoSongInterval} Gaane`}
                  minLabel="1 Song"
                  maxLabel="15 Songs"
                />

                <AppleSlider
                  value={modalPromoTimeInterval}
                  min={1}
                  max={60}
                  step={1}
                  onChange={(val) => setModalPromoTimeInterval(val)}
                  accentColor="orange"
                  size="sm"
                  label="Ya kitne minute interval par promo"
                  valueDisplay={`${modalPromoTimeInterval} Mins`}
                  minLabel="1 Min"
                  maxLabel="60 Mins"
                />

                <AppleSlider
                  value={modalDuckingPercent}
                  min={5}
                  max={50}
                  step={1}
                  onChange={(val) => setModalDuckingPercent(val)}
                  accentColor="blue"
                  size="sm"
                  label="Music Ducking Volume"
                  valueDisplay={`${modalDuckingPercent}%`}
                  minLabel="5% (Quiet)"
                  maxLabel="50% (Audible)"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/[0.08]">
                {modalStationId && modalStationId !== stationId ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectStation(modalStationId);
                      setStationModalOpen(false);
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-bold text-white"
                  >
                    Is Station Me Jayein
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  {modalStationId && stations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteStation(modalStationId);
                        setStationModalOpen(false);
                      }}
                      className="px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white shadow-md active:scale-95"
                  >
                    {modalStationId ? 'Settings Save Karein' : 'Station Banayein'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Apple Music / YT Music Style Player in Admin Panel */}
      {/* ------------------------------------------------------------- */}
      <ExpandedPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        isPromoPlaying={isPromoPlaying}
        activePromoClip={activePromoClip}
        adminQueue={adminQueue}
        staffQueue={staffQueue}
        recommendations={recommendations}
        playedHistory={playedHistory}
        settings={settings}
        isSpeakerNode={isSpeakerNode}
        onPlayPause={onPlayPause}
        onSkipNext={onSkipNext}
        onSkipPrevious={onSkipPrevious}
        onSeek={onSeek}
        onVolumeChange={onVolumeChange}
        onAddTrackToQueue={onAddStaffQueue}
        onRemoveTrackFromQueue={onRemoveTrack}
        onReorderStaffQueue={() => {}}
        onClearQueue={() => {}}
        onPlayTrackNow={onAdminPlayNow}
        onTriggerInstantPromo={onTriggerUrgentPromo}
        isMoodMixActive={isMoodMixActive}
        detectedMood={detectedMood}
        onToggleMoodMix={onToggleMoodMix}
      />
    </div>
  );
};
