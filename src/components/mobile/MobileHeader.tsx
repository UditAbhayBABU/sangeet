import React, { useState, useRef, useEffect } from 'react';
import { Volume2, LogOut, Shield, ChevronDown } from 'lucide-react';

interface MobileHeaderProps {
  stationName: string;
  userRole: 'staff' | 'admin';
  isSpeakerNode: boolean;
  activeSpeakerName?: string;
  onOpenSpeakerModal: () => void;
  onLeaveStation: () => void;
  onPlayRandomRecommendation: () => void;
  onOpenStationSwitch?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  stationName,
  userRole,
  isSpeakerNode,
  activeSpeakerName,
  onOpenSpeakerModal,
  onLeaveStation,
  onPlayRandomRecommendation,
  onOpenStationSwitch,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close popup menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-[#030303]/95 backdrop-blur-2xl px-4 h-14 flex items-center justify-between border-b border-white/[0.06] select-none">
      {/* 1. Left Slot: YouTube Music Logo + Station Name Below */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* YouTube Music Red Circle Play Icon */}
        <div
          onClick={onPlayRandomRecommendation}
          className="w-7 h-7 rounded-full bg-[#ff0000] flex items-center justify-center shadow-md shadow-[#ff0000]/25 shrink-0 cursor-pointer active:scale-95 transition-transform"
          title="Instant Auto-Play Mix"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white ml-0.5" aria-hidden="true">
            <path d="M10 8.64L15.27 12 10 15.36V8.64M8 5v14l11-7L8 5z" />
          </svg>
        </div>

        {/* Brand & Station Underneath */}
        <div className="flex flex-col justify-center min-w-0">
          <span
            onClick={onPlayRandomRecommendation}
            className="text-base font-black tracking-tight text-white font-sans leading-none cursor-pointer"
          >
            Sangeet
          </span>
          <button
            onClick={onOpenStationSwitch || onLeaveStation}
            className="flex items-center gap-1 mt-0.5 group text-left cursor-pointer transition-colors"
            title="Switch or view station"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] shrink-0" />
            <span className="text-[10px] font-medium text-neutral-400 group-hover:text-white truncate max-w-[150px] tracking-tight">
              {stationName || 'Forecourt Radio'}
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-neutral-500 group-hover:text-neutral-300 shrink-0" />
          </button>
        </div>
      </div>

      {/* 2. Right Slot: Speaker Icon Only + Profile Avatar */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Speaker Button: ONLY icon, no text label */}
        <button
          onClick={onOpenSpeakerModal}
          className={`w-8 h-8 rounded-full border transition-all active:scale-95 flex items-center justify-center cursor-pointer ${
            isSpeakerNode
              ? 'bg-[#ff0000]/15 border-[#ff0000]/40 text-[#ff4d4d] shadow-sm shadow-[#ff0000]/20'
              : 'bg-[#161616] border-white/[0.08] text-neutral-400 hover:text-white hover:border-white/20'
          }`}
          title={isSpeakerNode ? 'Physical Speaker Phone (Audio Active)' : 'Connect as Station Speaker'}
          aria-label="Speaker Audio Status"
        >
          <Volume2 className={`w-4 h-4 ${isSpeakerNode ? 'text-[#ff0000] animate-pulse' : 'text-neutral-400'}`} />
        </button>

        {/* User / Profile Avatar Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-transform active:scale-90 border cursor-pointer ${
              userRole === 'admin'
                ? 'bg-[#1f1f1f] text-white border-white/[0.12] hover:border-white/30'
                : 'bg-[#181818] text-neutral-300 border-white/[0.08] hover:border-white/20'
            }`}
            title={userRole === 'admin' ? 'Station Manager' : 'Staff Member'}
          >
            {userRole === 'admin' ? 'M' : 'S'}
          </button>

          {/* Context Dropdown */}
          {isMenuOpen && (
            <div className="absolute right-0 top-10 w-60 rounded-2xl bg-[#1c1c1c] border border-white/[0.1] p-2 shadow-2xl z-50 text-white animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-2.5 py-2 border-b border-white/[0.08] mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Station Access
                </span>
                <p className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
                  {userRole === 'admin' ? (
                    <>
                      <Shield className="w-3.5 h-3.5 text-[#ff0000]" />
                      <span>Station Manager</span>
                    </>
                  ) : (
                    <span>Staff Member</span>
                  )}
                </p>
                <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                  {stationName}
                </p>
              </div>

              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSpeakerModal();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium text-neutral-200 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#ff0000]" />
                  <span>Speaker Handover</span>
                </button>

                <div className="border-t border-white/[0.08] my-1" />

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLeaveStation();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-[#ff4d4d] hover:bg-[#ff0000]/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch Station</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
