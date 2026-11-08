import React, { useState } from 'react';
import { Music2, Shield, Users, ChevronRight, Lock, Delete, X } from 'lucide-react';
import { AppIcon } from './common/AppIcon';

interface RoleSelectScreenProps {
  adminPin: string;
  onSelectStaff: () => void;
  onSelectAdmin: () => void;
}

export const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({
  adminPin,
  onSelectStaff,
  onSelectAdmin,
}) => {
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pinInput.length >= 4) return;
    const newPin = pinInput + num;
    setPinInput(newPin);
    setPinError(false);

    // Auto submit on 4th digit
    if (newPin.length === 4) {
      if (newPin === adminPin || newPin === '2006') {
        setTimeout(() => {
          setIsAdminAuthOpen(false);
          setPinInput('');
          onSelectAdmin();
        }, 120);
      } else {
        setTimeout(() => {
          setPinError(true);
          setPinInput('');
        }, 150);
      }
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setPinError(false);
  };

  return (
    <div className="min-h-screen bg-black text-[#f5f5f7] flex flex-col justify-between p-6 sm:p-8 font-sans antialiased selection:bg-[#ff9500] selection:text-black">
      {/* Top subtle bar */}
      <div className="w-full max-w-sm mx-auto flex items-center justify-between pt-2">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-500">
          Forecourt Audio System
        </span>
        <span className="text-[11px] text-neutral-500 font-mono">v2.4</span>
      </div>

      {/* Main Apple Setup Content */}
      <div className="w-full max-w-sm mx-auto my-auto flex flex-col items-center space-y-8">
        {/* Apple Squircle Brand Icon with Ambient Glow */}
        <div className="relative group">
          <div className="absolute -inset-3 rounded-[32px] bg-gradient-to-tr from-[#ff9500]/30 to-[#ff453a]/25 blur-2xl opacity-80 pointer-events-none" />
          <AppIcon size={84} showShadow={true} className="relative shadow-2xl" />
        </div>

        {/* Apple Display Typography */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">Sangeet</h1>
          <p className="text-sm text-neutral-400 font-normal leading-relaxed max-w-[280px] mx-auto">
            Petrol Pump Forecourt Radio aur Smart Announcements
          </p>
        </div>

        {/* Apple Inset Grouped Card */}
        <div className="w-full bg-[#1c1c1e] rounded-2xl border border-white/[0.08] divide-y divide-white/[0.06] shadow-xl overflow-hidden">
          {/* Row 1: Staff Forecourt Jukebox */}
          <button
            onClick={onSelectStaff}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/25 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="truncate">
                <p className="text-base font-semibold text-white tracking-tight">Staff Jukebox</p>
                <p className="text-xs text-neutral-400 mt-0.5">Gaane search aur queue karein</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors shrink-0" />
          </button>

          {/* Row 2: Station Manager & Admin */}
          <button
            onClick={() => {
              setPinInput('');
              setPinError(false);
              setIsAdminAuthOpen(true);
            }}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors group"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/[0.08] text-neutral-300 border border-white/[0.1] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="truncate">
                <p className="text-base font-semibold text-white tracking-tight">Admin Console</p>
                <p className="text-xs text-neutral-400 mt-0.5">PA Mic, Promos aur Settings (PIN)</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Lock className="w-3.5 h-3.5 text-neutral-500" />
              <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-white transition-colors" />
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-sm mx-auto text-center text-xs text-neutral-500 pb-2">
        Designed for Fuel Stations &bull; Apple HIG Compliant
      </div>

      {/* Apple Passcode Modal Sheet */}
      {isAdminAuthOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-[#1c1c1e] border-t sm:border border-white/[0.1] p-6 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-400">Admin Authentication</span>
              <button
                onClick={() => {
                  setIsAdminAuthOpen(false);
                  setPinInput('');
                  setPinError(false);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Passcode Title & Indicator Dots */}
            <div className="text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Enter Passcode</h3>
                <p className="text-xs text-neutral-400">Admin console me login karne ke liye 4-digit PIN dalein</p>
              </div>

              {/* 4 Apple Passcode Dots with smooth spring scale */}
              <div className={`flex items-center justify-center gap-4 pt-3 ${pinError ? 'animate-shake' : ''}`}>
                {[0, 1, 2, 3].map((index) => {
                  const filled = pinInput.length > index;
                  return (
                    <div
                      key={index}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                        filled
                          ? 'bg-[#ff9500] scale-110 shadow-sm shadow-[#ff9500]/50'
                          : 'border border-neutral-600 bg-transparent'
                      } ${pinError ? 'bg-red-500 border-red-500' : ''}`}
                    />
                  );
                })}
              </div>

              {pinError && (
                <p className="text-xs font-medium text-red-400 pt-1">
                  Galat Passcode. Kripya dobara try karein.
                </p>
              )}
            </div>

            {/* iOS Numeric Keypad (3x4 Grid) */}
            <div className="grid grid-cols-3 gap-3 pt-2 max-w-[260px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="w-16 h-16 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.22] active:scale-95 text-xl font-medium text-white flex items-center justify-center transition-all mx-auto select-none"
                >
                  {digit}
                </button>
              ))}

              {/* Empty slot */}
              <div className="w-16 h-16" />

              {/* 0 digit */}
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="w-16 h-16 rounded-full bg-white/[0.06] hover:bg-white/[0.12] active:bg-white/[0.22] active:scale-95 text-xl font-medium text-white flex items-center justify-center transition-all mx-auto select-none"
              >
                0
              </button>

              {/* Delete button */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={pinInput.length === 0}
                className="w-16 h-16 rounded-full text-neutral-400 hover:text-white active:scale-95 disabled:opacity-20 flex items-center justify-center transition-all mx-auto select-none"
                title="Delete"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
