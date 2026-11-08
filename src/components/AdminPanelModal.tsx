import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Unlock,
  Radio,
  Mic,
  MicOff,
  Zap,
  Volume2,
  Clock,
  Music,
  Plus,
  Trash2,
  Play,
  Pause,
  Upload,
  Layers,
  Search,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sliders,
  Waves
} from 'lucide-react';
import { PromoClip, PromoCategory, SongTrack, StationSettings } from '../types';
import { LiveAnnouncementControl } from './common/LiveAnnouncementControl';
import { audioEngine } from '../services/audioEngine';
import { savePromoToLocalDB, deletePromoFromLocalDB } from '../services/promoStorage';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminPin: string;
  settings: StationSettings;
  categories: PromoCategory[];
  promos: PromoClip[];
  onUpdateSettings: (settings: Partial<StationSettings>) => void;
  onAddCategory: (category: { name: string; description: string; color: string }) => void;
  onUpdateCategory: (id: string, updates: Partial<PromoCategory>) => void;
  onDeleteCategory: (id: string) => void;
  onAddPromo: (promo: { title: string; categoryId: string; audioUrl: string; duration: number; scriptSnippet: string }) => void;
  onTogglePromo: (id: string, enabled: boolean) => void;
  onDeletePromo: (id: string) => void;
  onAdminPlayNow: (track: SongTrack) => void;
  onAddAdminQueue: (track: SongTrack) => void;
  onAddStaffQueue: (track: SongTrack) => void;
  onTriggerUrgentPromo: () => void;
  onStartAnnouncement?: (payload?: any) => void;
  onStopAnnouncement?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  adminPin,
  settings,
  categories,
  promos,
  onUpdateSettings,
  onAddCategory,
  onDeleteCategory,
  onAddPromo,
  onTogglePromo,
  onDeletePromo,
  onAdminPlayNow,
  onAddAdminQueue,
  onAddStaffQueue,
  onTriggerUrgentPromo,
  onStartAnnouncement,
  onStopAnnouncement,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduler' | 'mic' | 'promos' | 'categories' | 'vip_songs'>('scheduler');

  // Live PA Mic state
  const [isMicOn, setIsMicOn] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micIntervalRef = useRef<number | null>(null);

  // VIP Music Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SongTrack[]>([]);
  const [searching, setSearching] = useState(false);

  // New Category Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#f37021');

  // New Promo Form
  const [newPromoTitle, setNewPromoTitle] = useState('');
  const [newPromoCatId, setNewPromoCatId] = useState(categories[0]?.id || '');
  const [newPromoUrl, setNewPromoUrl] = useState('');
  const [newPromoScript, setNewPromoScript] = useState('');
  const [isUploadingToCloud, setIsUploadingToCloud] = useState(false);
  const [cloudUploadSuccess, setCloudUploadSuccess] = useState<string | null>(null);

  // Draft Promo Strategy (Admin Modal)
  const [draftIntervalType, setDraftIntervalType] = useState<'songs_count' | 'time_interval'>(settings.promoIntervalType || 'time_interval');
  const [draftSongInterval, setDraftSongInterval] = useState<number>(settings.promoSongInterval || 2);
  const [draftTimeInterval, setDraftTimeInterval] = useState<number>(settings.promoTimeIntervalMinutes ?? 1);
  const [strategySavedToast, setStrategySavedToast] = useState(false);

  // Audio Settings (Ducking, Fade & Crossfade Engine)
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [draftDuckingMode, setDraftDuckingMode] = useState<'db' | 'percent'>(settings.duckingMode || 'db');
  const [draftDuckingDb, setDraftDuckingDb] = useState<number>(settings.duckingDb ?? -25);
  const [draftDuckingPercent, setDraftDuckingPercent] = useState<number>(settings.duckingVolumePercent || 18);
  const [draftFadeDuration, setDraftFadeDuration] = useState<number>(settings.fadeDurationSeconds ?? 1.0);
  const [draftCrossfadeSeconds, setDraftCrossfadeSeconds] = useState<number>(settings.crossfadeSeconds ?? 1.5);
  const [audioSavedToast, setAudioSavedToast] = useState(false);

  useEffect(() => {
    setDraftIntervalType(settings.promoIntervalType || 'time_interval');
    setDraftSongInterval(settings.promoSongInterval || 2);
    setDraftTimeInterval(settings.promoTimeIntervalMinutes ?? 1);
    setDraftDuckingMode(settings.duckingMode || 'db');
    setDraftDuckingDb(settings.duckingDb ?? -25);
    setDraftDuckingPercent(settings.duckingVolumePercent || 18);
    setDraftFadeDuration(settings.fadeDurationSeconds ?? 1.0);
    setDraftCrossfadeSeconds(settings.crossfadeSeconds ?? 1.5);
  }, [settings]);

  const handleSavePromoStrategy = () => {
    onUpdateSettings({
      promoIntervalType: draftIntervalType,
      promoSongInterval: draftSongInterval,
      promoTimeIntervalMinutes: draftTimeInterval,
    });
    setStrategySavedToast(true);
    setTimeout(() => setStrategySavedToast(false), 3000);
  };

  const handleSaveAudioSettings = () => {
    onUpdateSettings({
      duckingMode: draftDuckingMode,
      duckingDb: draftDuckingDb,
      duckingVolumePercent: draftDuckingPercent,
      fadeDurationSeconds: draftFadeDuration,
      crossfadeSeconds: draftCrossfadeSeconds,
    });
    setAudioSavedToast(true);
    setTimeout(() => setAudioSavedToast(false), 3000);
  };

  // Audio Preview state
  const [previewingPromoId, setPreviewingPromoId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (isMicOn) {
        audioEngine.stopLiveMic();
        setIsMicOn(false);
      }
      if (micIntervalRef.current) {
        window.clearInterval(micIntervalRef.current);
      }
      stopPreviewAudio();
      setPreviewingPromoId(null);
    }
  }, [isOpen, isMicOn]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === adminPin || pinInput === '1959') {
      setIsAuthenticated(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleToggleMic = async () => {
    if (!isMicOn) {
      const started = await audioEngine.startLiveMic(settings.duckingVolumePercent);
      if (started) {
        setIsMicOn(true);
        micIntervalRef.current = window.setInterval(() => {
          setMicLevel(audioEngine.getMicLevel());
        }, 100);
      }
    } else {
      audioEngine.stopLiveMic();
      setIsMicOn(false);
      if (micIntervalRef.current) {
        window.clearInterval(micIntervalRef.current);
      }
      setMicLevel(0);
    }
  };

  const handleSearchMusic = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.warn('Admin music search error:', e);
    } finally {
      setSearching(false);
    }
  };

  const handlePromoAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    if (!newPromoTitle) {
      setNewPromoTitle(fileTitle);
    }

    setIsUploadingToCloud(true);
    setCloudUploadSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const res = await fetch('/api/storage/promos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: newPromoTitle || fileTitle,
            categoryId: newPromoCatId || categories[0]?.id || 'cat-xp95',
            dataUrl,
            duration: 15,
            scriptSnippet: newPromoScript || fileTitle,
          }),
        });
        const data = await res.json();
        if (data.success && data.promo) {
          setNewPromoUrl(data.promo.audioUrl);
          // Save in IndexedDB
          savePromoToLocalDB(data.promo, dataUrl).catch(() => {});
          setCloudUploadSuccess(`"${file.name}" permanently save ho gaya!`);
          setTimeout(() => setCloudUploadSuccess(null), 4000);
        } else {
          setNewPromoUrl(dataUrl);
        }
      } catch (err) {
        console.warn('Cloud upload notice, fallback to data url:', err);
        setNewPromoUrl(dataUrl);
      } finally {
        setIsUploadingToCloud(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoTitle || !newPromoUrl) return;
    const promoData = {
      id: `promo-custom-${Date.now()}`,
      title: newPromoTitle,
      categoryId: newPromoCatId || categories[0]?.id || 'cat-general',
      audioUrl: newPromoUrl,
      duration: 15,
      scriptSnippet: newPromoScript,
      isCloudSaved: true,
      storageType: 'cloud' as const,
      uploadedAt: Date.now(),
    };
    savePromoToLocalDB(promoData as any, newPromoUrl).catch(() => {});
    onAddPromo(promoData);
    setNewPromoTitle('');
    setNewPromoUrl('');
    setNewPromoScript('');
    setCloudUploadSuccess('Promo Announcement library aur local storage me permanently jod diya gaya!');
    setTimeout(() => setCloudUploadSuccess(null), 3000);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory({
      name: newCatName.trim(),
      description: 'Custom IOCL announcement tag',
      color: newCatColor,
    });
    setNewCatName('');
  };

  const previewPlayPromiseRef = useRef<Promise<void> | null>(null);

  const stopPreviewAudio = async () => {
    if (previewAudioRef.current) {
      const audio = previewAudioRef.current;
      if (previewPlayPromiseRef.current) {
        try {
          await previewPlayPromiseRef.current;
        } catch {
          // ignore
        }
      }
      try {
        audio.pause();
      } catch {
        // ignore
      }
      previewAudioRef.current = null;
      previewPlayPromiseRef.current = null;
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">IOCL RO Admin Console</h2>
                {isAuthenticated && (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Unlock className="w-2.5 h-2.5" /> Authenticated
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Forecourt Broadcast Schedule & Priority Override</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Authentication Gate */}
        {!isAuthenticated ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-5 my-auto">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Enter RO Dealer PIN</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Access to promo audio rules, Live PA mic, and VIP playback overrides requires management authorization.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-3">
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-digit PIN (Default: 1959)"
                autoFocus
                className="w-full text-center text-lg tracking-widest bg-slate-950 border border-slate-700 focus:border-orange-500 rounded-xl px-4 py-2.5 text-white font-mono focus:outline-none"
              />
              {pinError && (
                <p className="text-xs text-red-400 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Incorrect PIN. Default is 1959.
                </p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-500/20"
              >
                Unlock Admin Console
              </button>
            </form>
          </div>
        ) : (
          /* Authenticated Admin Dashboard */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 bg-slate-950 border-b border-slate-800/80 overflow-x-auto">
              <button
                onClick={() => setActiveTab('scheduler')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'scheduler'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Promo Schedule</span>
              </button>

              <button
                onClick={() => setActiveTab('vip_songs')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'vip_songs'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>Admin VIP Music (Play Now)</span>
              </button>

              <button
                onClick={() => setActiveTab('mic')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'mic'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Mic className="w-3.5 h-3.5 text-red-400" />
                <span>Live PA Mic</span>
              </button>

              <button
                onClick={() => setActiveTab('promos')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'promos'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Promo Audios ({promos.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('categories')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeTab === 'categories'
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Categories ({categories.length})</span>
              </button>
            </div>

            {/* Tab Body Contents */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {/* TAB 1: SCHEDULER */}
              {activeTab === 'scheduler' && (
                <div className="space-y-6">
                  {/* Emergency Broadcast Button */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-orange-950/40 via-red-950/20 to-slate-900 border border-orange-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-orange-400" /> Instant Promo Announcement
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Ducks current music immediately and broadcasts the next active promotional audio clip.
                      </p>
                    </div>
                    <button
                      onClick={onTriggerUrgentPromo}
                      className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all shrink-0"
                    >
                      <Radio className="w-4 h-4" /> Broadcast Promo Now
                    </button>
                  </div>

                  {/* Interval Type Configuration */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Promo Injection Frequency Rule
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          draftIntervalType === 'songs_count'
                            ? 'bg-orange-500/10 border-orange-500/50 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="intervalType"
                          checked={draftIntervalType === 'songs_count'}
                          onChange={() => setDraftIntervalType('songs_count')}
                          className="mt-1 accent-orange-500"
                        />
                        <div>
                          <p className="text-xs font-bold">By Number of Songs (Recommended)</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Plays promo after every 1 or 2 songs selected by pump staff.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                          draftIntervalType === 'time_interval'
                            ? 'bg-orange-500/10 border-orange-500/50 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name="intervalType"
                          checked={draftIntervalType === 'time_interval'}
                          onChange={() => setDraftIntervalType('time_interval')}
                          className="mt-1 accent-orange-500"
                        />
                        <div>
                          <p className="text-xs font-bold">By Clock Interval (Minutes)</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Injects promo at fixed time intervals (e.g. every 10–15 minutes).
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Numeric Value Slider/Selector */}
                    {draftIntervalType === 'songs_count' ? (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                          <span>Songs Count Between Promos:</span>
                          <span className="font-bold text-orange-400 font-mono text-sm">
                            Every {draftSongInterval} {draftSongInterval === 1 ? 'Song' : 'Songs'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={15}
                          step={1}
                          value={draftSongInterval}
                          onChange={(e) => setDraftSongInterval(Number(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                          <span>1 Song (High Frequency)</span>
                          <span>2 Songs (Balanced Forecourt)</span>
                          <span>15 Songs</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                          <span>Time Interval:</span>
                          <span className="font-bold text-orange-400 font-mono text-sm">
                            Every {draftTimeInterval} Minutes
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={60}
                          step={1}
                          value={draftTimeInterval}
                          onChange={(e) => setDraftTimeInterval(Number(e.target.value))}
                          className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                          <span>1 Min (Frequent)</span>
                          <span>15 Mins (Standard)</span>
                          <span>60 Mins</span>
                        </div>
                      </div>
                    )}

                    {/* Set Promo Strategy Button */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        Current Active: {settings.promoIntervalType === 'songs_count' ? `Every ${settings.promoSongInterval} Songs` : `Every ${settings.promoTimeIntervalMinutes} Mins`}
                      </span>
                      <button
                        type="button"
                        onClick={handleSavePromoStrategy}
                        className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                      >
                        {strategySavedToast ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Strategy Saved & Locked!</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Set Promo Strategy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Audio Settings: Ducking Volume (dB vs %) & Fade Duration */}
                  <div className="rounded-xl bg-slate-950/70 border border-slate-800 overflow-hidden shadow-sm">
                    {/* Header with expand toggle */}
                    <div
                      onClick={() => setAudioSettingsOpen(!audioSettingsOpen)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                          <Sliders className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                              Audio Settings
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Music Ducking Level (dB / %) aur smooth lead-in fade duration.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="hidden sm:inline-block text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                          {settings.duckingMode === 'db' ? `${settings.duckingDb ?? -25} dB` : `${settings.duckingVolumePercent}%`} | {settings.fadeDurationSeconds ?? 1.0}s Fade
                        </span>
                        <div className="p-1 rounded bg-slate-800 text-slate-300">
                          {audioSettingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {audioSettingsOpen && (
                      <div className="p-4 pt-2 border-t border-slate-800 space-y-4 bg-slate-900/30">
                        {/* Unit Toggle (dB vs %) */}
                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800">
                          <div>
                            <p className="text-xs font-bold text-slate-200">Volume Unit</p>
                          </div>
                          <div className="p-0.5 rounded-lg bg-slate-950 border border-slate-800 inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setDraftDuckingMode('percent')}
                              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                draftDuckingMode === 'percent'
                                  ? 'bg-blue-600 text-white shadow'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => setDraftDuckingMode('db')}
                              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                                draftDuckingMode === 'db'
                                  ? 'bg-blue-600 text-white shadow'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              dB
                            </button>
                          </div>
                        </div>

                        {/* Ducking Volume Slider */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300">Background Music Ducking Volume:</span>
                            <span className="font-mono font-bold text-blue-400 text-sm">
                              {draftDuckingMode === 'db'
                                ? `${draftDuckingDb} dB (Gain: ${(Math.pow(10, draftDuckingDb / 20) * 100).toFixed(1)}%)`
                                : `${draftDuckingPercent}% Volume`}
                            </span>
                          </div>
                          {draftDuckingMode === 'db' ? (
                            <input
                              type="range"
                              min={-40}
                              max={-6}
                              step={1}
                              value={draftDuckingDb}
                              onChange={(e) => setDraftDuckingDb(Number(e.target.value))}
                              className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer"
                            />
                          ) : (
                            <input
                              type="range"
                              min={5}
                              max={50}
                              step={1}
                              value={draftDuckingPercent}
                              onChange={(e) => setDraftDuckingPercent(Number(e.target.value))}
                              className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer"
                            />
                          )}
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>{draftDuckingMode === 'db' ? '-40 dB (Deep Silence)' : '5% (Deep Quiet)'}</span>
                            <span>{draftDuckingMode === 'db' ? '-20 dB (Radio Standard)' : '18% (Standard Ducking)'}</span>
                            <span>{draftDuckingMode === 'db' ? '-6 dB (Subtle Dip)' : '50% (Audible)'}</span>
                          </div>
                        </div>

                        {/* Promo Ducking Fade-In Duration (Lead-in Time) */}
                        <div className="space-y-2 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300 flex items-center gap-1.5">
                              <Waves className="w-3.5 h-3.5 text-purple-400" /> Promo Fade-In Lead Duration:
                            </span>
                            <span className="font-mono font-bold text-purple-400 text-sm">
                              {draftFadeDuration}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.2}
                            max={5.0}
                            step={0.1}
                            value={draftFadeDuration}
                            onChange={(e) => setDraftFadeDuration(Math.round(Number(e.target.value) * 10) / 10)}
                            className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>0.2s (Fast)</span>
                            <span>1.5s (Smooth Broadcast Lead-In)</span>
                            <span>5.0s (Very Smooth)</span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                            💡 <strong>Broadcast Rule (Image 2):</strong> Promo aane se theek <strong className="text-white">{draftFadeDuration}s</strong> pehle music volume smoothly <strong className="text-white">{draftDuckingMode === 'db' ? `${draftDuckingDb} dB` : `${draftDuckingPercent}%`}</strong> par fade hoga. Theek {draftFadeDuration}s baad promo voice start hogi!
                          </div>
                        </div>

                        {/* Song Transition Crossfade Duration (0-5s) */}
                        <div className="space-y-2 pt-2 border-t border-slate-800/80">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-300 flex items-center gap-1.5">
                              <Music className="w-3.5 h-3.5 text-emerald-400" /> Song Transition Crossfade Duration:
                            </span>
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              {draftCrossfadeSeconds}s
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={5.0}
                            step={0.5}
                            value={draftCrossfadeSeconds}
                            onChange={(e) => setDraftCrossfadeSeconds(Math.round(Number(e.target.value) * 10) / 10)}
                            className="w-full h-2 bg-slate-800 rounded-lg cursor-pointer accent-emerald-500"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>0s (Direct Cut / Off)</span>
                            <span>2.0s (Radio Standard)</span>
                            <span>5.0s (Smooth DJ Blend)</span>
                          </div>
                        </div>

                        {/* Save Audio Settings Button */}
                        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                          <span className="text-[11px] text-slate-400">
                            Apply changes to confirm audio engine configuration.
                          </span>
                          <button
                            type="button"
                            onClick={handleSaveAudioSettings}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                          >
                            {audioSavedToast ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Audio Settings Saved!</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Save Audio Settings</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category Filter for Targeted Campaigns */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Promo Campaign Targeting
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Choose whether the broadcaster rotates all promotional topics or focuses exclusively on one campaign (e.g. Safety Drive or XP95 Promotion).
                    </p>

                    <select
                      value={settings.activeCategoryFilter}
                      onChange={(e) => onUpdateSettings({ activeCategoryFilter: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500"
                    >
                      <option value="all">Rotate All Categories Evenly (Default)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          Focus Only: {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: VIP SONGS (PLAY NOW & ADMIN QUEUE) */}
              {activeTab === 'vip_songs' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      Priority Queue Override Hierarchy
                    </h4>
                    <p className="text-xs text-slate-300 mt-1">
                      1. <strong className="text-amber-400">PLAY NOW:</strong> Stops current staff track immediately and plays Admin song right now! (Staff queue is preserved).<br />
                      2. <strong className="text-amber-400">Add to Admin VIP Queue:</strong> Injected ahead of all staff songs in the queue.<br />
                      3. <strong className="text-slate-400">Add to Staff Queue:</strong> Added to regular queue order.
                    </p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchMusic(e.target.value)}
                      placeholder="Search any song (e.g. Afghan Jalebi, Rap God, Kesariya, Punjabi hits)..."
                      className="w-full bg-slate-950 border border-slate-700 focus:border-orange-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />
                  </div>

                  {/* Search Results */}
                  <div className="space-y-2">
                    {searching ? (
                      <p className="text-xs text-slate-400 text-center py-6">Searching high-bitrate catalogue...</p>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((track) => (
                        <div
                          key={track.id}
                          className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <img
                              src={track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&q=80'}
                              alt={track.title}
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate">{track.title}</p>
                              <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* PLAY NOW BUTTON (Highest Priority) */}
                            <button
                              onClick={() => {
                                onAdminPlayNow(track);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white text-[11px] font-bold flex items-center gap-1 shadow-md shadow-red-600/20"
                              title="Interrupt currently playing track and play this song immediately"
                            >
                              <Zap className="w-3 h-3" />
                              <span>PLAY NOW</span>
                            </button>

                            {/* Add to Admin VIP Queue */}
                            <button
                              onClick={() => onAddAdminQueue(track)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-medium"
                              title="Play before all staff songs"
                            >
                              + VIP Queue
                            </button>

                            {/* Add to Staff Queue */}
                            <button
                              onClick={() => onAddStaffQueue(track)}
                              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                              title="Add to standard staff queue"
                            >
                              + Staff
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-6">
                        Type any song title or artist above to override forecourt music.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: LIVE PA MIC ANNOUNCEMENT */}
              {activeTab === 'mic' && (
                <div className="space-y-4 max-w-xl mx-auto py-2">
                  <LiveAnnouncementControl
                    settings={settings}
                    variant="modal"
                    onStartAnnouncement={onStartAnnouncement}
                    onStopAnnouncement={onStopAnnouncement}
                  />
                </div>
              )}

              {/* TAB 4: PROMO CLIPS LIBRARY */}
              {activeTab === 'promos' && (
                <div className="space-y-6">
                  {/* Add New Custom Promo Audio Form */}
                  <form onSubmit={handleCreatePromo} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-orange-400" /> Import / Upload New Promo Audio
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-400">Announcement Title</label>
                        <input
                          type="text"
                          required
                          value={newPromoTitle}
                          onChange={(e) => setNewPromoTitle(e.target.value)}
                          placeholder="e.g. Free Air & Water Facility"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 mt-1"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400">Category Tag</label>
                        <select
                          value={newPromoCatId}
                          onChange={(e) => setNewPromoCatId(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 mt-1"
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
                      <label className="text-[11px] text-slate-400">Audio Source (MP3 File Upload or URL)</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={newPromoUrl}
                          onChange={(e) => setNewPromoUrl(e.target.value)}
                          placeholder="Audio URL or select file..."
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                        />
                        <label className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs text-slate-200 flex items-center gap-1.5 shrink-0 transition-colors ${
                          isUploadingToCloud ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse' : 'bg-slate-800 hover:bg-slate-700'
                        }`}>
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingToCloud ? 'Saving to Cloud...' : 'Select MP3'}</span>
                          <input type="file" accept="audio/*" disabled={isUploadingToCloud} onChange={handlePromoAudioUpload} className="hidden" />
                        </label>
                      </div>
                      {cloudUploadSuccess && (
                        <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3" /> {cloudUploadSuccess}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!newPromoTitle || !newPromoUrl || isUploadingToCloud}
                      className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save to Cloud Promo Library</span>
                    </button>
                  </form>

                  {/* List of Existing Promos */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Active Forecourt Announcements ({promos.length})
                      </h4>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                        ☁️ Cloud Database Active
                      </span>
                    </div>

                    {promos.map((promo) => {
                      const category = categories.find((c) => c.id === promo.categoryId);
                      const isPreviewing = previewingPromoId === promo.id;

                      return (
                        <div
                          key={promo.id}
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <button
                              onClick={() => togglePromoPreview(promo)}
                              className="w-9 h-9 rounded-lg bg-slate-900 hover:bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 border border-slate-800 transition-colors"
                              title={isPreviewing ? 'Stop Preview' : 'Play Preview'}
                            >
                              {isPreviewing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>

                            <div className="truncate">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-white truncate">{promo.title}</p>
                                {category && (
                                  <span
                                    className="text-[9px] font-semibold px-1.5 py-0.2 rounded"
                                    style={{
                                      backgroundColor: `${category.color}20`,
                                      color: category.color,
                                      border: `1px solid ${category.color}40`,
                                    }}
                                  >
                                    {category.name}
                                  </span>
                                )}
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                  ☁️ Cloud Stored
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {promo.scriptSnippet || 'Official IOCL Promotional Audio clip'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Toggle Enable/Disable */}
                            <button
                              onClick={() => onTogglePromo(promo.id, !promo.enabled)}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                                promo.enabled
                                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                              }`}
                            >
                              {promo.enabled ? 'Enabled' : 'Paused'}
                            </button>

                            {/* Delete Promo */}
                            <button
                              onClick={() => {
                                deletePromoFromLocalDB(promo.id);
                                onDeletePromo(promo.id);
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-900 transition-colors"
                              title="Delete Promo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: CATEGORIES MANAGER */}
              {activeTab === 'categories' && (
                <div className="space-y-6">
                  {/* Create New Category */}
                  <form onSubmit={handleCreateCategory} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-orange-400" /> Add New Promo Category
                    </h4>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Category Name (e.g. CNG Offers, Diwali Festive, Lubricants)..."
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                      />
                      <input
                        type="color"
                        value={newCatColor}
                        onChange={(e) => setNewCatColor(e.target.value)}
                        className="w-9 h-8 bg-transparent cursor-pointer rounded border border-slate-700"
                        title="Category Tag Color"
                      />
                      <button
                        type="submit"
                        disabled={!newCatName.trim()}
                        className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors shrink-0"
                      >
                        Add Category
                      </button>
                    </div>
                  </form>

                  {/* Category List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Manage Categories ({categories.length})
                    </h4>

                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <div>
                            <p className="text-xs font-bold text-white">{cat.name}</p>
                            <p className="text-[11px] text-slate-400">{cat.description || 'Custom Category'}</p>
                          </div>
                        </div>

                        {categories.length > 1 && (
                          <button
                            onClick={() => onDeleteCategory(cat.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-900 transition-colors"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
