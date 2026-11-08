import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Bell,
  Sliders,
  Info,
  AlertCircle,
  X,
  Zap,
} from 'lucide-react';
import { StationSettings } from '../../types';
import { audioEngine } from '../../services/audioEngine';
import { AppleSlider } from './AppleSlider';

export interface LiveAnnouncementControlProps {
  settings: StationSettings;
  variant?: 'mobile' | 'desktop' | 'modal';
  onStartAnnouncement?: (payload?: {
    adminName?: string;
    mode?: 'automatic' | 'manual' | 'auto';
    manualMusicVolume?: number;
    broadcastMessage?: string;
  }) => void;
  onStopAnnouncement?: () => void;
  onAnnouncementStatusChange?: (isLive: boolean) => void;
}

// Exact Volume Math Helpers for Unit Conversion
const fractionToPercent = (fraction: number): number => {
  return Math.max(0, Math.min(100, Math.round(fraction * 100)));
};

const fractionToDb = (fraction: number): number => {
  if (fraction <= 0.01) return -40; // -40 dB minimum threshold / mute
  const db = 20 * Math.log10(fraction);
  return Math.max(-40, Math.min(0, Math.round(db)));
};

const percentToFraction = (percent: number): number => {
  return Math.max(0, Math.min(1, percent / 100));
};

const dbToFraction = (db: number): number => {
  if (db <= -40) return 0;
  return Math.max(0, Math.min(1, Math.pow(10, db / 20)));
};

export const LiveAnnouncementControl: React.FC<LiveAnnouncementControlProps> = ({
  settings,
  variant = 'mobile',
  onStartAnnouncement,
  onStopAnnouncement,
  onAnnouncementStatusChange,
}) => {
  // Calculate default auto-duck target fraction from station settings
  const getAutoDuckTargetFraction = (): number => {
    if (settings.duckingMode === 'db') {
      const db = settings.duckingDb ?? -25;
      return Math.pow(10, db / 20);
    }
    return Math.max(0.01, Math.min(1.0, (settings.duckingVolumePercent || 18) / 100));
  };

  const autoDuckFraction = getAutoDuckTargetFraction();

  // 1. liveAnnounceMode State ('automatic' | 'manual')
  const [liveAnnounceMode, setLiveAnnounceMode] = useState<'automatic' | 'manual'>('automatic');

  // 2. Volume Slider Unit: '%' | 'dB'
  const [sliderUnit, setSliderUnit] = useState<'percent' | 'db'>(() => {
    return settings.duckingMode === 'db' ? 'db' : 'percent';
  });

  // 3. Audio & Mic States
  const [isMicLive, setIsMicLive] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [isPlayingChime, setIsPlayingChime] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);

  // 4. Music Volume Fraction (0.0 to 1.0) and Voice Volume Gain (0 to 200%)
  const [musicFraction, setMusicFraction] = useState<number>(autoDuckFraction);
  const [voiceVolume, setVoiceVolume] = useState<number>(120); // 120% default voice booster

  const micIntervalRef = useRef<number | null>(null);

  // Sync auto-duck target when settings change (only if in 'automatic' mode)
  useEffect(() => {
    if (liveAnnounceMode === 'automatic') {
      const newAutoDuck = getAutoDuckTargetFraction();
      setMusicFraction(newAutoDuck);
    }
  }, [settings.duckingMode, settings.duckingDb, settings.duckingVolumePercent, liveAnnounceMode]);

  // Clean up mic on unmount
  useEffect(() => {
    return () => {
      if (micIntervalRef.current) {
        window.clearInterval(micIntervalRef.current);
        micIntervalRef.current = null;
      }
      if (audioEngine.isLiveMicActiveNow()) {
        audioEngine.stopLiveMic();
        onStopAnnouncement?.();
        onAnnouncementStatusChange?.(false);
      }
    };
  }, []);

  // Handle Mode Switch ('automatic' vs 'manual')
  const handleSetMode = (mode: 'automatic' | 'manual') => {
    setLiveAnnounceMode(mode);
    if (mode === 'automatic') {
      const target = getAutoDuckTargetFraction();
      setMusicFraction(target);
      if (isMicLive || audioEngine.isDuckingActive()) {
        audioEngine.resetLiveMusicToAutoDucking({
          duckingMode: settings.duckingMode || 'db',
          duckingDb: settings.duckingDb ?? -25,
          duckingPercent: settings.duckingVolumePercent ?? 18,
          fadeDurationSeconds: settings.fadeDurationSeconds ?? 1.0,
        });
      }
    } else {
      // Manual mode: immediately link current music and voice levels
      if (isMicLive || audioEngine.isDuckingActive()) {
        audioEngine.setLiveMusicVolume(musicFraction);
        audioEngine.setLiveVoiceVolume(voiceVolume / 100);
      }
    }
  };

  // Handle Live Mic Open / Close
  const handleToggleLiveMic = async () => {
    setMicError(null);
    if (isMicLive) {
      // Mic Close: Stop mic and smoothly restore music back to normal full volume
      audioEngine.stopLiveMic();
      setIsMicLive(false);
      setMicLevel(0);
      if (micIntervalRef.current) {
        window.clearInterval(micIntervalRef.current);
        micIntervalRef.current = null;
      }
      onStopAnnouncement?.();
      onAnnouncementStatusChange?.(false);
    } else {
      // Mic Open:
      onStartAnnouncement?.({
        mode: liveAnnounceMode,
        manualMusicVolume: liveAnnounceMode === 'manual' ? musicFraction : undefined,
      });

      // Start live mic with either automatic ducking or manual levels
      const started = await audioEngine.startLiveMic({
        duckingMode: settings.duckingMode || 'db',
        duckingDb: settings.duckingDb ?? -25,
        duckingPercent: settings.duckingVolumePercent ?? 18,
        fadeDurationSeconds: settings.fadeDurationSeconds ?? 1.0,
        manualMusicVolume: liveAnnounceMode === 'manual' ? musicFraction : undefined,
        manualMicVolume: liveAnnounceMode === 'manual' ? voiceVolume / 100 : 1.2,
      });

      if (started) {
        setIsMicLive(true);
        onAnnouncementStatusChange?.(true);

        // When in manual mode, ensure audioEngine levels are precisely set
        if (liveAnnounceMode === 'manual') {
          audioEngine.setLiveMusicVolume(musicFraction);
          audioEngine.setLiveVoiceVolume(voiceVolume / 100);
        }

        micIntervalRef.current = window.setInterval(() => {
          setMicLevel(audioEngine.getMicLevel());
        }, 100);
      } else {
        setIsMicLive(false);
        onStopAnnouncement?.();
        onAnnouncementStatusChange?.(false);
        const err =
          audioEngine.getLastMicError() ||
          'Microphone connect nahi ho paya. Kripya browser me mic permission allow karein.';
        setMicError(err);
      }
    }
  };

  // Handle Music Volume Change from Slider -> Directly calls audioEngine.setLiveMusicVolume
  const handleMusicSliderChange = (val: number) => {
    let fraction = 0;
    if (sliderUnit === 'percent') {
      fraction = percentToFraction(val);
    } else {
      fraction = dbToFraction(val);
    }

    setMusicFraction(fraction);

    // Real-time link to audioEngine.setLiveMusicVolume
    audioEngine.setLiveMusicVolume(fraction);
  };

  // Direct Preset Handler for Music Volume
  const handleApplyMusicPreset = (fraction: number) => {
    setMusicFraction(fraction);
    audioEngine.setLiveMusicVolume(fraction);
  };

  // Handle Voice Volume Change from Slider -> Directly calls audioEngine.setLiveVoiceVolume
  const handleVoiceVolumeChange = (newVoiceGain: number) => {
    setVoiceVolume(newVoiceGain);

    // Real-time link to audioEngine.setLiveVoiceVolume
    audioEngine.setLiveVoiceVolume(newVoiceGain / 100);
  };

  // Play Forecourt Airport Attention Chime
  const handlePlayChime = async () => {
    setIsPlayingChime(true);
    try {
      await audioEngine.playChime();
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsPlayingChime(false), 900);
    }
  };

  // Formatted display values
  const currentPercent = fractionToPercent(musicFraction);
  const currentDb = fractionToDb(musicFraction);
  const autoPercent = fractionToPercent(autoDuckFraction);
  const autoDb = settings.duckingDb ?? -25;
  const configuredDuckingSummary =
    settings.duckingMode === 'db'
      ? `${autoDb} dB (~${autoPercent}%)`
      : `${autoPercent}% (${fractionToDb(autoDuckFraction)} dB)`;

  return (
    <div
      className={`rounded-2xl transition-all ${
        variant === 'desktop'
          ? 'bg-black/50 border border-white/[0.08] p-6 space-y-4 max-w-2xl mx-auto'
          : variant === 'modal'
          ? 'bg-black/40 border border-white/[0.08] p-5 space-y-4'
          : 'bg-[#1c1c1e] border border-white/[0.08] p-4 space-y-4 shadow-sm'
      }`}
    >
      {/* 1. TOP HEADER: Title, ON AIR indicator, (i) Info Icon, and Chime */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
              isMicLive
                ? 'bg-[#ff453a] text-white shadow-lg shadow-[#ff453a]/50 animate-pulse'
                : 'bg-[#ff453a]/15 text-[#ff453a] border border-[#ff453a]/25'
            }`}
          >
            {isMicLive ? <Mic className="w-5 h-5 animate-bounce" /> : <Mic className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Live Forecourt PA Announcement
              </h3>
              {isMicLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ff453a]/25 text-[#ff453a] border border-[#ff453a]/40 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff453a] animate-ping" />
                  <span>ON AIR</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#86868b] mt-0.5">
              {isMicLive
                ? 'Aapki aawaz forecourt speakers par live broadcast ho rahi hai'
                : 'Forecourt Live PA System'}
            </p>
          </div>
        </div>

        {/* Action Header Buttons: (i) Info + Attention Chime */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {/* (i) Info Icon Button */}
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
              showInfo
                ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-md shadow-blue-500/20'
                : 'bg-white/[0.06] text-neutral-300 hover:text-white border-white/[0.1] hover:bg-white/10'
            }`}
            title="Extra Information & Guidelines"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Attention Chime Button */}
          <button
            type="button"
            onClick={handlePlayChime}
            disabled={isPlayingChime}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              isPlayingChime
                ? 'bg-[#ff9500]/25 text-[#ff9500] border-[#ff9500]/50'
                : 'bg-white/[0.06] text-neutral-300 hover:text-white border-white/[0.1] hover:bg-white/10'
            }`}
            title="Airport/Forecourt 2-Tone Attention Chime"
          >
            <Bell className={`w-3.5 h-3.5 ${isPlayingChime ? 'animate-bounce text-[#ff9500]' : 'text-neutral-400'}`} />
            <span>Chime</span>
          </button>
        </div>
      </div>

      {/* 2. EXPANDABLE INFO CALLOUT (Triggered by (i) icon - All Extra Info Stored Here) */}
      {showInfo && (
        <div className="p-4 rounded-2xl bg-black/90 border border-white/[0.15] space-y-3 animate-in fade-in duration-200 text-xs text-[#86868b] leading-relaxed shadow-2xl relative">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <span className="font-bold text-white flex items-center gap-2 text-sm">
              <Info className="w-4 h-4 text-[#0071e3]" />
              Live Announcement System Details
            </span>
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.08] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 pt-1">
            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#30d158] fill-[#30d158]" />
                Automatic Mode (Auto-Duck)
              </span>
              <p className="text-[11px] text-neutral-300">
                Start Mic open karte hi background music apne aap <strong className="text-white">{configuredDuckingSummary}</strong> par smoothly duck ho jayega ({settings.fadeDurationSeconds ?? 1.0}s fade). Stop Mic dabate hi music wapas normal full volume par restore ho jayega.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#ff9500]" />
                Manual Mode (Audio Mixer)
              </span>
              <p className="text-[11px] text-neutral-300">
                Hardware mixing console ki tarah 2 independent sliders milte hain: <strong className="text-white">Music Volume</strong> (audioEngine.setLiveMusicVolume se linked) aur <strong className="text-white">Voice Volume</strong> (audioEngine.setLiveVoiceVolume se linked). Start Mic dabane par prescribed settings par aawaz niklegi.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                % aur dB Unit Toggle
              </span>
              <p className="text-[11px] text-neutral-300">
                Music Volume slider me % (linear scale 0% se 100%) aur dB (broadcast standard -40 dB se 0 dB) ka toggle switch diya gaya hai taaki aap apne pasand ke units me volume set kar sakein.
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                Attention Chime
              </span>
              <p className="text-[11px] text-neutral-300">
                Ailaan shuru karne se pehle 2-tone airport/pump attention chime bajakar pump par aane wale grahako aur staff ka dhyan aakarshit kar sakte hain.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. PROMINENT MODE TOGGLE SWITCH: [⚡ Automatic] | [🎛️ Manual] */}
      <div className="p-1.5 rounded-2xl bg-black/60 border border-white/[0.08]">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleSetMode('automatic')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              liveAnnounceMode === 'automatic'
                ? 'bg-gradient-to-r from-[#30d158] to-[#28b54c] text-black shadow-md shadow-green-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${liveAnnounceMode === 'automatic' ? 'fill-black' : ''}`} />
            <span>Automatic</span>
          </button>

          <button
            type="button"
            onClick={() => handleSetMode('manual')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              liveAnnounceMode === 'manual'
                ? 'bg-gradient-to-r from-[#ff9500] to-[#e08300] text-black shadow-md shadow-orange-500/20'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Manual</span>
          </button>
        </div>
      </div>

      {/* 4. REAL-TIME VU METER (Active during Live Mic Broadcast) */}
      {isMicLive && (
        <div className="p-3.5 rounded-2xl bg-black/85 border border-[#ff453a]/40 space-y-2 animate-in fade-in shadow-lg shadow-red-950/20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff453a] animate-ping" />
              Microphone Speech Input Level
            </span>
            <span className="font-mono font-bold text-[#ff453a] text-sm">{micLevel}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-black/90 border border-white/[0.12] overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#30d158] via-[#ff9500] to-[#ff453a] transition-all duration-75 rounded-full"
              style={{ width: `${Math.max(4, micLevel)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-neutral-400">
            <span>Broadcasting live to forecourt speaker system</span>
            <span className="text-[#30d158] font-bold">
              {liveAnnounceMode === 'automatic'
                ? `Auto-Duck: ${configuredDuckingSummary}`
                : `Manual: Music at ${sliderUnit === 'percent' ? `${currentPercent}%` : `${currentDb} dB`} • Voice at ${voiceVolume}%`}
            </span>
          </div>
        </div>
      )}

      {/* Mic Permission Error Notice */}
      {micError && (
        <div className="p-3.5 rounded-xl bg-[#ff453a]/15 border border-[#ff453a]/30 text-xs text-[#ff453a] leading-relaxed space-y-1 animate-in fade-in flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Microphone Permission Notice</p>
            <p className="text-[11px] opacity-90 mt-0.5">{micError}</p>
          </div>
        </div>
      )}

      {/* 5. AUTOMATIC MODE VIEW: Direct Action Without Extra Clutter */}
      {liveAnnounceMode === 'automatic' && (
        <div className="space-y-3 animate-in fade-in">
          {/* Automatic Primary Start/Stop Mic Button */}
          <button
            type="button"
            onClick={handleToggleLiveMic}
            className={`w-full py-3.5 px-4 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer ${
              isMicLive
                ? 'bg-[#ff453a] hover:bg-red-700 text-white shadow-red-500/40 ring-4 ring-red-500/25 animate-pulse'
                : 'bg-gradient-to-r from-[#ff453a] via-[#ff3b30] to-[#e02e24] hover:brightness-110 text-white shadow-red-600/30'
            }`}
          >
            {isMicLive ? (
              <>
                <MicOff className="w-5 h-5" />
                <span>Stop Mic (Music Back to Normal)</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Start Mic (Auto-Duck Music)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 6. MANUAL MODE VIEW: Audio Mixing Sliders + Start Mic Button */}
      {liveAnnounceMode === 'manual' && (
        <div className="space-y-4 animate-in fade-in">
          {/* DUAL SLIDERS: Music Volume & Voice Volume (Linked to audioEngine) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* SLIDER 1: Music Volume with % vs dB Toggle (Linked to audioEngine.setLiveMusicVolume) */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#ff9500]/15 flex items-center justify-center text-[#ff9500]">
                    {musicFraction === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Music Volume</span>
                    <span className="text-[10px] text-[#86868b]">Background song volume</span>
                  </div>
                </div>

                {/* % vs dB Unit Toggle + Value Badge */}
                <div className="flex items-center gap-2">
                  <div className="p-0.5 rounded-lg bg-black border border-white/[0.1] inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setSliderUnit('percent')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        sliderUnit === 'percent'
                          ? 'bg-[#ff9500] text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      title="Percentage (%) Unit"
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setSliderUnit('db')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                        sliderUnit === 'db'
                          ? 'bg-[#ff9500] text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                      title="Decibels (dB) Unit"
                    >
                      dB
                    </button>
                  </div>

                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                      musicFraction === 0
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-[#ff9500]/20 text-[#ff9500] border border-[#ff9500]/30'
                    }`}
                  >
                    {musicFraction === 0
                      ? 'Muted'
                      : sliderUnit === 'percent'
                      ? `${currentPercent}%`
                      : `${currentDb} dB`}
                  </span>
                </div>
              </div>

              {/* Interactive Music Slider */}
              <div className="pt-1">
                {sliderUnit === 'percent' ? (
                  <AppleSlider
                    value={currentPercent}
                    min={0}
                    max={100}
                    step={1}
                    onChange={handleMusicSliderChange}
                    accentColor="orange"
                    size="md"
                    minLabel="0% (Mute)"
                    maxLabel="100% (Full)"
                  />
                ) : (
                  <AppleSlider
                    value={currentDb}
                    min={-40}
                    max={0}
                    step={1}
                    onChange={handleMusicSliderChange}
                    accentColor="orange"
                    size="md"
                    minLabel="-40 dB (Mute)"
                    maxLabel="0 dB (Full)"
                  />
                )}
              </div>

              {/* Quick Presets for Music Volume */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {sliderUnit === 'percent'
                  ? [
                      { label: 'Mute', fraction: 0 },
                      { label: '10%', fraction: 0.10 },
                      { label: '20%', fraction: 0.20 },
                      { label: '35%', fraction: 0.35 },
                      { label: '50%', fraction: 0.50 },
                    ].map((p) => {
                      const isSelected = Math.abs(musicFraction - p.fraction) < 0.02;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => handleApplyMusicPreset(p.fraction)}
                          className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#ff9500] text-black font-bold shadow-sm'
                              : 'bg-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })
                  : [
                      { label: 'Mute', fraction: 0 },
                      { label: '-30dB', fraction: Math.pow(10, -30 / 20) },
                      { label: '-25dB', fraction: Math.pow(10, -25 / 20) },
                      { label: '-18dB', fraction: Math.pow(10, -18 / 20) },
                      { label: '-10dB', fraction: Math.pow(10, -10 / 20) },
                    ].map((p) => {
                      const isSelected = Math.abs(musicFraction - p.fraction) < 0.02;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => handleApplyMusicPreset(p.fraction)}
                          className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#ff9500] text-black font-bold shadow-sm'
                              : 'bg-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
              </div>
            </div>

            {/* SLIDER 2: Voice Volume (Linked to audioEngine.setLiveVoiceVolume) */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#ff453a]/15 flex items-center justify-center text-[#ff453a]">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Voice Volume</span>
                    <span className="text-[10px] text-[#86868b]">Microphone booster gain</span>
                  </div>
                </div>

                <span
                  className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                    voiceVolume === 0
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : voiceVolume > 140
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-[#ff453a]/20 text-[#ff453a] border border-[#ff453a]/30'
                  }`}
                >
                  {voiceVolume === 0 ? 'Muted' : `${voiceVolume}%`}
                </span>
              </div>

              {/* Interactive Voice Volume Slider */}
              <div className="pt-1">
                <AppleSlider
                  value={voiceVolume}
                  min={0}
                  max={200}
                  step={5}
                  onChange={handleVoiceVolumeChange}
                  accentColor="red"
                  size="md"
                  minLabel="Mute (0%)"
                  maxLabel="200% (High Boost)"
                />
              </div>

              {/* Quick Presets for Voice Volume */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {[
                  { label: 'Mute', val: 0 },
                  { label: 'Normal (100%)', val: 100 },
                  { label: 'Boost (120%)', val: 120 },
                  { label: 'Max (160%)', val: 160 },
                ].map((p) => {
                  const isSelected = voiceVolume === p.val;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleVoiceVolumeChange(p.val)}
                      className={`flex-1 py-1 px-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#ff453a] text-white font-bold shadow-sm'
                          : 'bg-white/[0.06] text-neutral-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Primary Mic Button in Manual Mode */}
          <button
            type="button"
            onClick={handleToggleLiveMic}
            className={`w-full py-3.5 px-4 rounded-2xl text-sm font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer ${
              isMicLive
                ? 'bg-[#ff453a] hover:bg-red-700 text-white shadow-red-500/40 ring-4 ring-red-500/25 animate-pulse'
                : 'bg-gradient-to-r from-[#ff9500] via-[#ff8800] to-[#e07700] hover:brightness-110 text-black shadow-orange-500/25 font-extrabold'
            }`}
          >
            {isMicLive ? (
              <>
                <MicOff className="w-5 h-5" />
                <span>Stop Mic (Music Back to Normal)</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Start Mic (Broadcast at Prescribed Settings)</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
