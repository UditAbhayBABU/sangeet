import React from 'react';
import { Music2, Volume2, Smartphone, LogOut, Users, Laptop, Radio } from 'lucide-react';
import { AppIcon } from './common/AppIcon';

interface HeaderNavProps {
  stationName: string;
  userRole: 'staff' | 'admin';
  isSpeakerNode: boolean;
  activeSpeakerName?: string;
  connectedDevicesCount?: number;
  onOpenSpeakerModal: () => void;
  onLeaveStation: () => void;
  onToggleMobilePreview?: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  stationName,
  userRole,
  isSpeakerNode,
  activeSpeakerName,
  connectedDevicesCount = 1,
  onOpenSpeakerModal,
  onLeaveStation,
  onToggleMobilePreview,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-2xl border-b border-white/[0.08] px-4 md:px-8 py-2.5 h-16 flex items-center justify-between gap-4">
      <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Brand & Active Station Name */}
        <div className="flex items-center gap-3 min-w-0">
          <AppIcon
            size="md"
            interactive={false}
            title="Sangeet - Forecourt Radio"
          />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white leading-none">
                Sangeet
              </span>
              <span className="text-[11px] font-medium text-neutral-400 capitalize">
                &bull; {userRole === 'admin' ? 'Station Admin' : 'Staff Jukebox'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-normal truncate mt-0.5">
              {stationName}
            </p>
          </div>
        </div>

        {/* Zone 2: Apple Dynamic Island / Control Center Speaker Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Speaker Routing Control */}
          <button
            onClick={onOpenSpeakerModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
              isSpeakerNode
                ? 'bg-[#ff9500]/15 border-[#ff9500]/40 text-[#ff9500] shadow-sm shadow-[#ff9500]/15'
                : 'bg-white/[0.05] border-white/[0.1] text-neutral-300 hover:text-white hover:bg-white/[0.08]'
            }`}
            title={
              isSpeakerNode
                ? 'Aapka Phone Speaker Hai (Audio forecourt par baj raha hai)'
                : `Remote Mode (Silent) - Speaker: ${activeSpeakerName || 'Koi nahi'}`
            }
          >
            {isSpeakerNode ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-[#ff9500] animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] inline-block shrink-0" />
                <span className="font-semibold">Speaker Output</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-neutral-400">Silent Remote</span>
              </>
            )}
          </button>

          {/* Connected Phones Indicator */}
          <button
            onClick={onOpenSpeakerModal}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-neutral-300 hover:text-white transition-colors"
            title={`${connectedDevicesCount} phones online on this station`}
          >
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            <span className="font-mono text-[11px] tabular-nums font-semibold">{connectedDevicesCount}</span>
            <span className="text-neutral-400 text-[11px]">Online</span>
          </button>
        </div>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Mobile Preview Switcher */}
          {onToggleMobilePreview && (
            <button
              onClick={onToggleMobilePreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-medium text-neutral-300 hover:text-white transition-all active:scale-95"
              title="Switch to Mobile View"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#ff9500]" />
              <span className="hidden md:inline">Mobile View</span>
            </button>
          )}

          {/* Leave Station */}
          <button
            onClick={onLeaveStation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-red-500/15 border border-white/[0.1] hover:border-red-500/30 text-xs font-medium text-neutral-300 hover:text-red-400 transition-all active:scale-95"
            title="Station Chhodein"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Station Chhodein</span>
          </button>
        </div>
      </div>
    </header>
  );
};
