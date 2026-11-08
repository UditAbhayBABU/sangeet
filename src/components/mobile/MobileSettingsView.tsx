import React, { useState, useRef } from 'react';
import {
  Shield,
  Volume2,
  Radio,
  Clock,
  Music,
  Upload,
  Plus,
  Trash2,
  Mic,
  Zap,
  Sliders,
  CheckCircle2,
  Lock,
  Layers,
  FileAudio,
  Check,
  Building,
  KeyRound,
  Edit2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Waves,
  Sparkles,
  Info,
  Disc3,
  MicOff,
  Bell
} from 'lucide-react';
import { PromoClip, PromoCategory, StationSettings, StationState, StationItem } from '../../types';
import { AppleSlider } from '../common/AppleSlider';
import { LiveAnnouncementControl } from '../common/LiveAnnouncementControl';
import { audioEngine } from '../../services/audioEngine';

interface MobileSettingsViewProps {
  stationState: StationState;
  onUpdateSettings: (settings: Partial<StationSettings>) => void;
  onUpdateAdminPin: (newPin: string) => void;
  onAddPromo: (promo: { title: string; categoryId: string; audioUrl: string; duration: number; scriptSnippet: string }) => void;
  onTogglePromo: (id: string, enabled: boolean) => void;
  onDeletePromo: (id: string) => void;
  onAddCategory: (category: { id?: string; name: string; description: string; color: string }) => void;
  onDeleteCategory: (id: string) => void;
  onAddStation: (station: {
    name: string;
    promosEnabled: boolean;
    pinRequired?: boolean;
    stationPin?: string;
    promoSongInterval: number;
    promoTimeIntervalMinutes: number;
    duckingVolumePercent: number;
    activeCategoryFilter?: string;
    selectedPromoClipIds?: string[];
    crossfadeSeconds?: number;
  }) => void;
  onUpdateStation: (id: string, updates: Partial<StationItem>) => void;
  onDeleteStation: (id: string) => void;
  onSelectStation: (id: string) => void;
  onTriggerUrgentPromo: () => void;
  onSwitchToStaff: () => void;
  onStartAnnouncement?: (payload?: any) => void;
  onStopAnnouncement?: () => void;
}

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

export const MobileSettingsView: React.FC<MobileSettingsViewProps> = ({
  stationState,
  onUpdateSettings,
  onUpdateAdminPin,
  onAddPromo,
  onTogglePromo,
  onDeletePromo,
  onAddCategory,
  onDeleteCategory,
  onAddStation,
  onUpdateStation,
  onDeleteStation,
  onSelectStation,
  onTriggerUrgentPromo,
  onSwitchToStaff,
  onStartAnnouncement,
  onStopAnnouncement,
}) => {
  const { settings, promos, categories, stations, stationId } = stationState;

  // Active info tooltip popup key
  const [activeInfoKey, setActiveInfoKey] = useState<string | null>(null);

  const toggleInfo = (key: string) => {
    setActiveInfoKey((prev) => (prev === key ? null : key));
  };

  // 1. Promo Audio Form State & File Upload
  const [showAddPromo, setShowAddPromo] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(categories[0]?.id || 'cat-xp95');
  const [newAudioUrl, setNewAudioUrl] = useState('');
  const [newDuration, setNewDuration] = useState(15);
  const [newSnippet, setNewSnippet] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inline Category Creator inside Add Promo form
  const [isCreatingInlineCat, setIsCreatingInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState('');
  const [inlineCatDesc, setInlineCatDesc] = useState('');
  const [inlineCatColor, setInlineCatColor] = useState('#ff9500');

  // 2. Category Form State (Outside)
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('#ff9500');

  // 3. Station Management Drawer / Modal State
  const [showStationsModal, setShowStationsModal] = useState(false);
  const [showAddStationForm, setShowAddStationForm] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newStationPin, setNewStationPin] = useState('2006');
  const [newStationPinRequired, setNewStationPinRequired] = useState(true);
  const [newStationPromosEnabled, setNewStationPromosEnabled] = useState(true);
  const [newStationDucking, setNewStationDucking] = useState(18);

  // Expanded station ID for in-depth per-station management
  const [expandedStationId, setExpandedStationId] = useState<string | null>(stationId || null);

  // Direct Number Tapping / Inline Value Editing States
  const [editingField, setEditingField] = useState<'song' | 'time' | 'repetition' | 'ducking' | 'fade' | 'crossfade' | null>(null);
  const [tempValueInput, setTempValueInput] = useState('');

  // 4. Live PA Mic State
  const [isMicLive, setIsMicLive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [isPlayingChime, setIsPlayingChime] = useState(false);
  const micIntervalRef = useRef<number | null>(null);

  // Real-time Strategy & Audio States with Auto-save & Debounce
  const [localPromosEnabled, setLocalPromosEnabled] = useState<boolean>(settings.promosEnabled ?? true);
  const [localIntervalType, setLocalIntervalType] = useState<'songs_count' | 'time_interval'>(settings.promoIntervalType || 'time_interval');
  const [localSongInterval, setLocalSongInterval] = useState<number>(settings.promoSongInterval || 2);
  const [localTimeInterval, setLocalTimeInterval] = useState<number>(settings.promoTimeIntervalMinutes ?? 1);
  const [localPromoRepetitions, setLocalPromoRepetitions] = useState<number>(settings.promoRepetitions ?? 2);

  // Audio Settings (Ducking & Fade Engine)
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

  // Sync from server settings ONLY when user is not actively interacting
  React.useEffect(() => {
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

  // Handle Real Audio File Upload
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    if (!newTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setNewTitle(cleanName);
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const audioDataUrl = uploadEvent.target?.result as string;
      setNewAudioUrl(audioDataUrl);

      const tempAudio = new Audio();
      tempAudio.src = audioDataUrl;
      tempAudio.onloadedmetadata = () => {
        if (tempAudio.duration && isFinite(tempAudio.duration)) {
          setNewDuration(Math.round(tempAudio.duration));
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const audioToUse =
      newAudioUrl ||
      'https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/win.ogg';

    onAddPromo({
      title: newTitle.trim(),
      categoryId: newCategoryId,
      audioUrl: audioToUse,
      duration: newDuration || 15,
      scriptSnippet: newSnippet.trim() || newTitle.trim(),
    });

    setNewTitle('');
    setNewAudioUrl('');
    setNewSnippet('');
    setUploadedFileName(null);
    setShowAddPromo(false);
    setIsCreatingInlineCat(false);
  };

  const handleCreateInlineCategory = () => {
    if (!inlineCatName.trim()) return;
    const generatedId = `cat-${Date.now()}`;
    onAddCategory({
      id: generatedId,
      name: inlineCatName.trim(),
      description: inlineCatDesc.trim() || 'Custom Promo Category',
      color: inlineCatColor,
    });
    setNewCategoryId(generatedId);
    setInlineCatName('');
    setInlineCatDesc('');
    setIsCreatingInlineCat(false);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    onAddCategory({
      name: catName.trim(),
      description: catDesc.trim() || 'Promo Audio Category',
      color: catColor,
    });

    setCatName('');
    setCatDesc('');
    setShowAddCategory(false);
  };

  const handleCreateNewStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationName.trim()) return;

    onAddStation({
      name: newStationName.trim(),
      promosEnabled: newStationPromosEnabled,
      pinRequired: newStationPinRequired,
      stationPin: newStationPin.trim() || '2006',
      promoSongInterval: 2,
      promoTimeIntervalMinutes: 10,
      duckingVolumePercent: newStationDucking,
      activeCategoryFilter: 'all',
      crossfadeSeconds: 2.0,
    });

    setNewStationName('');
    setShowAddStationForm(false);
  };

  // Live Announcement Handlers
  const handleToggleLiveMic = async () => {
    setMicError(null);
    if (isMicLive) {
      audioEngine.stopLiveMic();
      setIsMicLive(false);
      setMicLevel(0);
      if (micIntervalRef.current) {
        window.clearInterval(micIntervalRef.current);
        micIntervalRef.current = null;
      }
    } else {
      const started = await audioEngine.startLiveMic(settings.duckingVolumePercent || 18);
      if (started) {
        setIsMicLive(true);
        micIntervalRef.current = window.setInterval(() => {
          setMicLevel(audioEngine.getMicLevel());
        }, 100);
      } else {
        setIsMicLive(false);
        const err = audioEngine.getLastMicError() || 'Microphone access block hai. Niche diye gaye Voice Announcement ya Chime se seedhe broadcast karein.';
        setMicError(err);
      }
    }
  };

  const handlePlayChimeOnly = async () => {
    setIsPlayingChime(true);
    try {
      await audioEngine.playChime();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsPlayingChime(false), 900);
    }
  };

  // Clean up mic on unmount
  React.useEffect(() => {
    return () => {
      if (micIntervalRef.current) {
        window.clearInterval(micIntervalRef.current);
      }
      audioEngine.stopLiveMic();
    };
  }, []);

  return (
    <div className="min-h-full bg-black text-[#f5f5f7] px-4 pt-4 pb-36 font-sans">
      {/* 1. Large Title & Navigation Status Bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="text-xs text-[#86868b]">{stationState.stationName} &bull; Station Manager</p>
        </div>
        <button
          onClick={onSwitchToStaff}
          className="px-3.5 py-1.5 rounded-full bg-[#1c1c1e] text-xs font-semibold text-white border border-white/[0.08] hover:bg-white/10 active:scale-95 transition-all"
        >
          Staff Mode
        </button>
      </div>

      {/* 2. Instant Broadcast Action Card (Apple HIG Focus Card) */}
      <div className="mb-6 p-4 rounded-2xl bg-[#1c1c1e] border border-[#ff9500]/30 shadow-lg relative overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ff9500]/15 flex items-center justify-center text-[#ff9500] shrink-0">
              <Zap className="w-5 h-5 fill-[#ff9500]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Instant Broadcast</p>
              <p className="text-xs text-[#86868b]">Forecourt speakers par turant promo play karein</p>
            </div>
          </div>
          <button
            onClick={() => toggleInfo('instant-promo')}
            className="p-1 text-[#86868b] hover:text-white"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {activeInfoKey === 'instant-promo' && (
          <p className="mt-3 text-xs text-[#86868b] bg-black/40 p-2.5 rounded-xl border border-white/[0.06] leading-relaxed">
            Current music duck hokar forecourt speakers par turant announcement promo play hoga.
          </p>
        )}

        <button
          onClick={onTriggerUrgentPromo}
          className="mt-3.5 w-full py-3 rounded-xl bg-[#ff9500] hover:bg-[#ff9f0a] active:scale-[0.98] text-black font-semibold text-xs tracking-wide flex items-center justify-center gap-2 transition-transform shadow-md"
        >
          <Zap className="w-4 h-4 fill-black" />
          <span>BROADCAST PROMO NOW</span>
        </button>
      </div>

      {/* 3. SECTION: PROMO AUDIO STRATEGY (Apple HIG Inset Grouped) */}
      <div className="mb-6">
        <div className="px-1 pb-2 flex items-center justify-between">
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
            className={`p-1.5 rounded-full transition-colors ${
              activeInfoKey === 'strategy' ? 'bg-[#ff9500]/20 text-[#ff9500]' : 'text-[#86868b] hover:text-white'
            }`}
            title="Promo strategy guidelines"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Info Explanatory Sheet / Callout */}
        {activeInfoKey === 'strategy' && (
          <div className="mb-3 p-3 rounded-2xl bg-black/60 border border-white/[0.08] text-xs text-[#86868b] leading-relaxed animate-in fade-in duration-200">
            <p className="font-semibold text-white mb-0.5">Commercial Promo Broadcasting</p>
            <strong className="text-white">Song-Wise:</strong> Plays promos between tracks after every N completed songs.<br />
            <strong className="text-white">Time-Wise:</strong> Continuous real-time timer triggers promos every N minutes with smooth mid-song music ducking without interrupting playback.
          </div>
        )}

        <div className="bg-[#1c1c1e] rounded-2xl border border-white/[0.08] divide-y divide-white/[0.08] overflow-hidden shadow-sm">
          {/* Row 1: Promos Active Switch */}
          <div className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#30d158]/15 flex items-center justify-center text-[#30d158]">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium text-white block">Commercial Promos</span>
                <span className="text-[11px] text-[#86868b]">Forecourt broadcast injection</span>
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
          <div className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-white block">Interval Type</span>
              <span className="text-[11px] text-[#86868b]">Song count (inter-track) or clock schedule (mid-song ducking)</span>
            </div>
            <div className="p-1 rounded-xl bg-black/60 border border-white/[0.08] inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setLocalIntervalType('songs_count');
                  triggerImmediateUpdate({ promoIntervalType: 'songs_count' }, 'Song-Wise');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
          <div className="p-3.5 space-y-2">
            {localIntervalType === 'songs_count' ? (
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
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
                      className="px-2 py-0.5 rounded-md bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 font-mono text-xs font-semibold hover:bg-[#ff9500]/25 transition-colors cursor-pointer"
                      title="Tap to type number"
                    >
                      Every {localSongInterval} {localSongInterval === 1 ? 'Song' : 'Songs'}
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
                <div className="flex justify-between items-center text-xs mb-1">
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
                      className="px-2 py-0.5 rounded-md bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 font-mono text-xs font-semibold hover:bg-[#ff9500]/25 transition-colors cursor-pointer"
                      title="Tap to type number"
                    >
                      Every {localTimeInterval} Minutes
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
          <div className="p-3.5 space-y-2">
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-white font-medium">Repetition:</span>
                  <button
                    type="button"
                    onClick={() => setActiveInfoKey((prev) => (prev === 'repetition' ? null : 'repetition'))}
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
                    className="px-2 py-0.5 rounded-md bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 font-mono text-xs font-semibold hover:bg-[#ff9500]/25 transition-colors cursor-pointer flex items-center gap-1"
                    title="Tap to type number"
                  >
                    <span>{localPromoRepetitions} {localPromoRepetitions === 1 ? 'Time' : 'Times'}</span>
                    <Edit2 className="w-3 h-3 opacity-60" />
                  </button>
                )}
              </div>

              {/* Explanatory callout inside (i) info toggle */}
              {activeInfoKey === 'repetition' && (
                <div className="mb-2 p-2.5 rounded-xl bg-black/60 border border-white/[0.08] text-[11px] text-[#86868b] leading-relaxed animate-in fade-in duration-200">
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

      {/* 3.5 SECTION: ADVANCED AUDIO SETTINGS (Ducking & Fade Engine) */}
      <div className="mb-6">
        <div className="bg-[#1c1c1e] rounded-2xl border border-white/[0.08] overflow-hidden shadow-sm">
          {/* Header Accordion Toggle */}
          <div
            onClick={() => setAudioSettingsOpen(!audioSettingsOpen)}
            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#0071e3]/15 flex items-center justify-center text-[#0071e3]">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-medium text-white block">Audio Settings</span>
                <p className="text-[11px] text-[#86868b] mt-0.5">
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
                className={`p-1.5 rounded-full transition-colors ${
                  activeInfoKey === 'audio' ? 'bg-[#0071e3]/20 text-[#0071e3]' : 'text-[#86868b] hover:text-white'
                }`}
                title="Audio settings info"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="p-1 rounded bg-white/[0.06] text-[#86868b]">
                {audioSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </div>

          {/* Info Explanatory Sheet / Callout */}
          {activeInfoKey === 'audio' && (
            <div className="mx-3.5 mb-3 p-3 rounded-xl bg-black/60 border border-white/[0.08] text-xs text-[#86868b] leading-relaxed animate-in fade-in duration-200 space-y-1.5">
              <p className="font-semibold text-white mb-0.5">Audio Ducking, Fade & Crossfade</p>
              <p>• <strong>Ducking:</strong> Promo start hone se {localFadeDuration}s pehle background music duck hota hai.</p>
              <p>• <strong>Song Crossfade:</strong> Gaane ke beech {localCrossfadeSeconds}s ka smooth volume blend transition hoga (0s = Direct Cut, 5.0s = Smooth DJ Mix).</p>
            </div>
          )}

          {/* Collapsible Content - Apple Inset Grouped List without nested boxes */}
          {audioSettingsOpen && (
            <div className="border-t border-white/[0.08] divide-y divide-white/[0.08] bg-black/20">
              {/* Row 1: Unit Toggle (dB vs %) */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-white block">Volume Unit</span>
                </div>
                <div className="p-0.5 rounded-lg bg-black/60 border border-white/[0.08] inline-flex items-center gap-0.5">
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
              <div className="p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
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
                      className="px-2 py-0.5 rounded-md bg-[#0071e3]/15 text-[#0071e3] border border-[#0071e3]/30 font-mono text-xs font-semibold hover:bg-[#0071e3]/25 transition-colors cursor-pointer"
                      title="Tap to type number"
                    >
                      {localDuckingMode === 'db' ? `${localDuckingDb} dB` : `${localDuckingPercent}%`}
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

              {/* Row 3: Promo Ducking Fade-In Duration */}
              <div className="p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white font-medium flex items-center gap-1.5">
                    <Waves className="w-3.5 h-3.5 text-[#af52de]" /> Fade Lead Duration:
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
                      className="px-2 py-0.5 rounded-md bg-[#af52de]/15 text-[#af52de] border border-[#af52de]/30 font-mono text-xs font-semibold hover:bg-[#af52de]/25 transition-colors cursor-pointer"
                      title="Tap to type number"
                    >
                      {localFadeDuration}s
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
              <div className="p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
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
                      className="px-2 py-0.5 rounded-md bg-[#30d158]/15 text-[#30d158] border border-[#30d158]/30 font-mono text-xs font-semibold hover:bg-[#30d158]/25 transition-colors cursor-pointer flex items-center gap-1"
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

      {/* 4. SECTION: LIVE ANNOUNCEMENTS & FORECOURT PA */}
      <div className="mb-6">
        <div className="px-1 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Live Announcements
            </span>
            {isMicLive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff453a]/20 text-[#ff453a] border border-[#ff453a]/40 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff453a] animate-ping" />
                <span>ON AIR</span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => toggleInfo('announcements')}
            className={`p-1.5 rounded-full transition-colors ${
              activeInfoKey === 'announcements' ? 'bg-[#ff9500]/20 text-[#ff9500]' : 'text-[#86868b] hover:text-white'
            }`}
            title="Live Announcement Guidelines"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeInfoKey === 'announcements' && (
          <div className="mb-3 p-3 rounded-2xl bg-black/60 border border-white/[0.08] text-xs text-[#86868b] leading-relaxed animate-in fade-in duration-200">
            <p className="font-semibold text-white mb-0.5">Forecourt PA Microphone</p>
            Live Mic se bolkar forecourt speakers par seedhe ailaan karein. Background gaana automatically duck hokar quiet ho jayega.
          </div>
        )}

        <LiveAnnouncementControl
          settings={settings}
          variant="mobile"
          onStartAnnouncement={onStartAnnouncement}
          onStopAnnouncement={onStopAnnouncement}
        />
      </div>

      {/* 5. SECTION: PROMO CLIPS & CATEGORIES */}
      <div className="mb-6">
        <div className="px-1 pb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
            Clips & Categories ({promos.length})
          </span>
          <button
            onClick={() => setShowAddPromo(true)}
            className="text-xs font-semibold text-[#ff9500] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload Audio</span>
          </button>
        </div>

        <div className="bg-[#1c1c1e] rounded-2xl border border-white/[0.08] divide-y divide-white/[0.08] overflow-hidden">
          {promos.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#86868b]">
              Koi promo audio nahi hai. Naya audio upload karein.
            </div>
          ) : (
            promos.map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <div key={p.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#86868b]">
                      {cat && (
                        <span className="font-medium" style={{ color: cat.color }}>
                          {cat.name}
                        </span>
                      )}
                      <span>&bull;</span>
                      <span className="font-mono">{p.duration}s</span>
                      <span>&bull;</span>
                      <span>{p.playsCount} plays</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <IOSToggle
                      checked={p.enabled}
                      onChange={(c) => onTogglePromo(p.id, c)}
                      color="#ff9500"
                    />
                    <button
                      onClick={() => onDeletePromo(p.id)}
                      className="p-1.5 text-[#86868b] hover:text-[#ff453a] transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. SECTION: PROMO CATEGORIES MANAGER */}
      <div className="mb-6">
        <div className="px-1 pb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
            Categories ({categories.length})
          </span>
          <button
            onClick={() => setShowAddCategory(!showAddCategory)}
            className="text-xs font-semibold text-[#0071e3] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nayi Category</span>
          </button>
        </div>

        {/* Inline Add Category Form */}
        {showAddCategory && (
          <form onSubmit={handleCreateCategory} className="mb-3 p-3.5 rounded-2xl bg-[#1c1c1e] border border-[#0071e3]/30 space-y-2.5 animate-in fade-in">
            <span className="text-xs font-semibold text-[#0071e3] block">Nayi Category Banayein</span>
            <input
              type="text"
              placeholder="Category Name (e.g. Speed Diesel / Safety)"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/[0.08] text-xs text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3]"
              required
            />
            <input
              type="text"
              placeholder="Short Description"
              value={catDesc}
              onChange={(e) => setCatDesc(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/[0.08] text-xs text-white placeholder-[#86868b] focus:outline-none"
            />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#86868b]">Tag Color:</span>
                <input
                  type="color"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  className="w-6 h-6 rounded-md border-0 bg-transparent cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="px-2.5 py-1 rounded-lg text-xs text-[#86868b] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-[#0071e3] text-white font-semibold text-xs"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="bg-[#1c1c1e] rounded-2xl border border-white/[0.08] divide-y divide-white/[0.08] overflow-hidden">
          {categories.map((c) => (
            <div key={c.id} className="p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="truncate">
                  <p className="text-xs font-semibold text-white truncate">{c.name}</p>
                  <p className="text-[11px] text-[#86868b] truncate mt-0.5">{c.description}</p>
                </div>
              </div>

              {categories.length > 1 && (
                <button
                  onClick={() => onDeleteCategory(c.id)}
                  className="p-1.5 text-[#86868b] hover:text-[#ff453a] transition-colors shrink-0"
                  title="Delete Category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 7. SECTION: ALL FORECOURT STATIONS (Apple Navigation Link Style) */}
      <div className="mb-6">
        <div className="px-1 pb-2">
          <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
            Multi-Station Forecourt
          </span>
        </div>
        <button
          onClick={() => setShowStationsModal(true)}
          className="w-full bg-[#1c1c1e] hover:bg-[#2c2c2e] active:scale-[0.99] rounded-2xl border border-white/[0.08] p-3.5 flex items-center justify-between gap-3 text-left transition-all shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#0071e3]/15 flex items-center justify-center text-[#0071e3] shrink-0">
              <Building className="w-4 h-4" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-white truncate">All Stations ({stations.length})</p>
              <p className="text-xs text-[#86868b] truncate mt-0.5">
                Manage, PIN security, volume control & promos setup
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#86868b] shrink-0" />
        </button>
      </div>



      {/* ======================================================= */}
      {/* ADD PROMO SHEET (Apple iOS Style Sheet) */}
      {/* ======================================================= */}
      {showAddPromo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-0 animate-in fade-in">
          <div className="bg-[#1c1c1e] border-t border-white/[0.12] rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Grab Bar */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-white">Upload Promo Audio</h3>
              <button
                onClick={() => {
                  setShowAddPromo(false);
                  setIsCreatingInlineCat(false);
                }}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[#86868b] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="p-4 overflow-y-auto space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border border-dashed border-[#ff9500]/50 hover:border-[#ff9500] bg-[#ff9500]/5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
              >
                <FileAudio className="w-8 h-8 text-[#ff9500] mb-1.5" />
                <p className="text-xs font-semibold text-white">
                  {uploadedFileName || 'Select Audio File from Device'}
                </p>
                <p className="text-[11px] text-[#86868b] mt-0.5">MP3, WAV, M4A, OGG supported</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileUpload}
                  className="hidden"
                />
              </div>

              <div>
                <label className="text-xs text-[#86868b] mb-1 block">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Servo 4T Oil Special Offer"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/[0.08] text-xs text-white placeholder-[#86868b] focus:outline-none focus:border-[#ff9500]"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-[#86868b] mb-1 block">Category</label>
                {!isCreatingInlineCat ? (
                  <div className="flex gap-2">
                    <select
                      value={newCategoryId}
                      onChange={(e) => {
                        if (e.target.value === '__create_new__') setIsCreatingInlineCat(true);
                        else setNewCategoryId(e.target.value);
                      }}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#ff9500]"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#1c1c1e] text-white">
                          {c.name}
                        </option>
                      ))}
                      <option value="__create_new__" className="bg-[#1c1c1e] text-[#ff9500] font-bold">
                        + Create New Category...
                      </option>
                    </select>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white">New Category</span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingInlineCat(false)}
                        className="text-[#86868b] hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Category name"
                      value={inlineCatName}
                      onChange={(e) => setInlineCatName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-black/60 border border-white/[0.08] text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreateInlineCategory}
                      className="w-full py-1.5 rounded-lg bg-[#ff9500] text-black font-semibold text-xs"
                    >
                      Save Category
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#ff9500] hover:bg-[#ff9f0a] active:scale-[0.98] text-black font-semibold text-xs tracking-wide transition-all shadow-md"
                >
                  Save Promo Audio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* ALL STATIONS SHEET (Apple iOS Style Sheet) */}
      {/* ======================================================= */}
      {showStationsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-0 animate-in fade-in">
          <div className="bg-[#1c1c1e] border-t border-white/[0.12] rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Grab Bar */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#0071e3]" />
                <h3 className="text-base font-bold text-white">Forecourt Stations</h3>
              </div>
              <button
                onClick={() => setShowStationsModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[#86868b] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4">
              <div className="bg-black/50 rounded-2xl border border-white/[0.08] divide-y divide-white/[0.08] overflow-hidden">
                {stations.map((st) => {
                  const isCurrent = st.id === stationId;
                  const isExpanded = expandedStationId === st.id;
                  const stationCatFilter = st.activeCategoryFilter || 'all';
                  const eligiblePromos = promos.filter(
                    (p) => stationCatFilter === 'all' || p.categoryId === stationCatFilter
                  );
                  const stationSelectedClips: string[] = st.selectedPromoClipIds || eligiblePromos.map((p) => p.id);

                  return (
                    <div key={st.id} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div
                          onClick={() => setExpandedStationId(isExpanded ? null : st.id)}
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                        >
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-white truncate">{st.name}</p>
                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#30d158]/20 text-[#30d158]">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#86868b]">
                              Ducking: {st.duckingVolumePercent}% &bull; {st.promosEnabled ? 'Promos ON' : 'Promos OFF'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isCurrent && (
                            <button
                              onClick={() => onSelectStation(st.id)}
                              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
                            >
                              Switch
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedStationId(isExpanded ? null : st.id)}
                            className="p-1 text-[#86868b] hover:text-white"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>
                          {stations.length > 1 && (
                            <button
                              onClick={() => onDeleteStation(st.id)}
                              className="p-1 text-[#86868b] hover:text-[#ff453a]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-white/[0.06] space-y-3.5">
                          {/* 1. PIN Security */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#86868b]">Require PIN on Entry</span>
                              <IOSToggle
                                checked={Boolean(st.pinRequired)}
                                onChange={(c) => onUpdateStation(st.id, { pinRequired: c })}
                                color="#ff9500"
                              />
                            </div>
                            {st.pinRequired && (
                              <input
                                type="text"
                                maxLength={6}
                                defaultValue={st.stationPin || '2006'}
                                onBlur={(e) => onUpdateStation(st.id, { stationPin: e.target.value.trim() })}
                                placeholder="4-digit PIN"
                                className="w-full px-3 py-1.5 rounded-lg bg-black border border-white/[0.08] text-xs text-white font-mono"
                              />
                            )}
                          </div>

                          {/* 2. Station Ducking Volume */}
                          <div className="pt-1 border-t border-white/[0.04]">
                            <AppleSlider
                              value={st.duckingVolumePercent}
                              min={5}
                              max={50}
                              step={1}
                              onChange={(val) => onUpdateStation(st.id, { duckingVolumePercent: val })}
                              accentColor="blue"
                              size="sm"
                              label="Station Ducking Volume"
                              valueDisplay={`${st.duckingVolumePercent}%`}
                            />
                          </div>

                          {/* 2.5 Station Crossfade Seconds */}
                          <div className="pt-1 border-t border-white/[0.04]">
                            <AppleSlider
                              value={st.crossfadeSeconds ?? 2.0}
                              min={0}
                              max={5.0}
                              step={0.5}
                              onChange={(val) => onUpdateStation(st.id, { crossfadeSeconds: val })}
                              accentColor="green"
                              size="sm"
                              label="Song Transition Crossfade"
                              valueDisplay={`${st.crossfadeSeconds ?? 2.0}s`}
                            />
                          </div>

                          {/* 3. Station Promos Enabled */}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                            <span className="text-[#86868b]">Station Commercial Promos</span>
                            <IOSToggle
                              checked={Boolean(st.promosEnabled)}
                              onChange={(c) => onUpdateStation(st.id, { promosEnabled: c })}
                              color="#30d158"
                            />
                          </div>

                          {/* 4. Target Promo Category */}
                          <div className="space-y-1 pt-1 border-t border-white/[0.04]">
                            <span className="text-[11px] text-[#86868b] block">Target Promo Category</span>
                            <select
                              value={st.activeCategoryFilter || 'all'}
                              onChange={(e) => onUpdateStation(st.id, { activeCategoryFilter: e.target.value })}
                              className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/[0.08] text-xs text-white focus:outline-none"
                            >
                              <option value="all">All Categories (Sabhi Promos)</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* 5. Station Promo Tracks Checklist */}
                          {eligiblePromos.length > 0 && (
                            <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                              <span className="text-[11px] text-[#86868b] block">Active Promo Clips Checklist</span>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {eligiblePromos.map((clip) => {
                                  const isClipSelected = stationSelectedClips.includes(clip.id);
                                  return (
                                    <label key={clip.id} className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/[0.06] text-xs cursor-pointer">
                                      <span className="truncate text-white text-[11px]">{clip.title} ({clip.duration}s)</span>
                                      <input
                                        type="checkbox"
                                        checked={isClipSelected}
                                        onChange={(e) => {
                                          const updated = e.target.checked
                                            ? [...stationSelectedClips, clip.id]
                                            : stationSelectedClips.filter((id) => id !== clip.id);
                                          onUpdateStation(st.id, { selectedPromoClipIds: updated });
                                        }}
                                        className="accent-[#ff9500] w-3.5 h-3.5"
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Station Button */}
              {!showAddStationForm ? (
                <button
                  onClick={() => setShowAddStationForm(true)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Station</span>
                </button>
              ) : (
                <form onSubmit={handleCreateNewStation} className="p-3.5 rounded-2xl bg-black/60 border border-white/[0.08] space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-white">New Station Name</span>
                    <button
                      type="button"
                      onClick={() => setShowAddStationForm(false)}
                      className="text-[#86868b] hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Downtown Forecourt"
                    value={newStationName}
                    onChange={(e) => setNewStationName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black border border-white/[0.08] text-xs text-white focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-[#ff9500] text-black font-semibold text-xs"
                  >
                    Create Station
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
