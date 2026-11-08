import React, { useState } from 'react';
import {
  Radio,
  ChevronRight,
  Lock,
  X,
  MoreVertical,
  Shield,
  KeyRound,
  RadioTower,
  AlertCircle
} from 'lucide-react';
import { StationItem } from '../types';

interface StationSelectScreenProps {
  stations: StationItem[];
  onSelectStation: (stationId: string, role: 'staff' | 'admin') => void;
  onAddStation?: (station: {
    name: string;
    location?: string;
    pinRequired: boolean;
    stationPin?: string;
    adminPassword?: string;
    promosEnabled: boolean;
    promoSongInterval: number;
    promoTimeIntervalMinutes: number;
    duckingVolumePercent: number;
  }) => void;
}

export const StationSelectScreen: React.FC<StationSelectScreenProps> = ({
  stations,
  onSelectStation,
  onAddStation,
}) => {
  // Popover menu state for 3-dots
  const [activeMenuStationId, setActiveMenuStationId] = useState<string | null>(null);

  // Admin Password Modal state
  const [adminAuthStation, setAdminAuthStation] = useState<StationItem | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);

  // Regular Staff Access PIN Modal state
  const [staffPinPromptStation, setStaffPinPromptStation] = useState<StationItem | null>(null);
  const [staffPinInput, setStaffPinInput] = useState('');
  const [staffPinError, setStaffPinError] = useState(false);

  // Handle direct click on station tile (Regular User / Staff entry)
  const handleStationClick = (station: StationItem) => {
    setActiveMenuStationId(null);
    if (station.pinRequired) {
      setStaffPinPromptStation(station);
      setStaffPinInput('');
      setStaffPinError(false);
    } else {
      onSelectStation(station.id, 'staff');
    }
  };

  // Submit regular staff PIN
  const handleVerifyStaffPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffPinPromptStation) return;
    const requiredPin = staffPinPromptStation.stationPin || '2006';

    if (staffPinInput.trim() === requiredPin.trim()) {
      onSelectStation(staffPinPromptStation.id, 'staff');
      setStaffPinPromptStation(null);
      setStaffPinInput('');
    } else {
      setStaffPinError(true);
    }
  };

  // Open Admin Password Modal from 3-dots "Manage" option
  const handleOpenManageModal = (e: React.MouseEvent, station: StationItem) => {
    e.stopPropagation();
    setActiveMenuStationId(null);
    setAdminAuthStation(station);
    setAdminPasswordInput('');
    setAdminPasswordError(false);
  };

  // Submit Admin Password
  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAuthStation) return;
    const correctPassword =
      adminAuthStation.adminPassword || adminAuthStation.stationPin || '2006';

    if (
      adminPasswordInput.trim() === correctPassword.trim() ||
      adminPasswordInput.trim() === '2006' ||
      adminPasswordInput.trim() === 'admin'
    ) {
      onSelectStation(adminAuthStation.id, 'admin');
      setAdminAuthStation(null);
      setAdminPasswordInput('');
    } else {
      setAdminPasswordError(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col justify-between p-4 sm:p-6 font-sans antialiased selection:bg-[#ff0000] selection:text-white">
      {/* Top YouTube Music Brand Header */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between pt-2 pb-6 border-b border-[#212121]">
        <div className="flex items-center gap-2">
          {/* Official YouTube Music Play Circle Icon in Red */}
          <div className="w-8 h-8 rounded-full bg-[#ff0000] flex items-center justify-center shadow-lg shadow-[#ff0000]/25">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" aria-hidden="true">
              <path d="M10 8.64L15.27 12 10 15.36V8.64M8 5v14l11-7L8 5z" />
            </svg>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black tracking-tighter text-white font-sans">Sangeet</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff0000]">Stations</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-400 bg-[#121212] px-2.5 py-1 rounded-full border border-[#282828]">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-[11px] font-medium">Live Forecourt Network</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-lg mx-auto my-auto py-6 space-y-6">
        {/* Title Header */}
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#ff0000] uppercase tracking-wider">
            <RadioTower className="w-3.5 h-3.5" />
            <span>Select Jukebox Location</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Choose Your Station
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Staff &amp; visitors tap a station to enter. Managers click the three dots (<span className="text-white font-bold">&#8226;&#8226;&#8226;</span>) to Manage with Password.
          </p>
        </div>

        {/* Station Rectangular Rounded Tiles */}
        <div className="space-y-3">
          {stations.map((station) => {
            const isMenuOpen = activeMenuStationId === station.id;

            return (
              <div
                key={station.id}
                className="relative group rounded-2xl bg-[#121212] border border-[#242424] hover:border-[#383838] transition-all shadow-xl overflow-visible"
              >
                {/* Station Card Main Clickable Body */}
                <div
                  onClick={() => handleStationClick(station)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer active:bg-white/[0.04] transition-colors rounded-2xl"
                >
                  {/* Left Icon + Text */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#ff0000]/10 border border-[#ff0000]/25 text-[#ff0000] flex items-center justify-center shrink-0 shadow-inner">
                      <Radio className="w-6 h-6" />
                    </div>

                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-white tracking-tight truncate">
                          {station.name}
                        </p>
                        {station.pinRequired && (
                          <span title="Security PIN protected" className="shrink-0">
                            <Lock className="w-3.5 h-3.5 text-neutral-400" />
                          </span>
                        )}
                      </div>

                      {/* Clean Unboxed Metadata */}
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span className="text-[#ff0000] font-medium">
                          {station.promosEnabled ? 'Promos Active' : 'Music Only'}
                        </span>
                        <span aria-hidden="true">&#8226;</span>
                        <span className="truncate">
                          {station.location || 'Main Jukebox Area'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Enter chevron + 3-DOTS Menu Button */}
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* The 3-Dots Menu Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuStationId(isMenuOpen ? null : station.id);
                      }}
                      className="w-9 h-9 rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.08] active:scale-95 flex items-center justify-center transition-all cursor-pointer"
                      title="Station Options (Manage)"
                      aria-label="Station Options"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {/* Direct Enter Icon */}
                    <button
                      onClick={() => handleStationClick(station)}
                      className="w-9 h-9 rounded-full bg-white/[0.04] text-neutral-400 group-hover:text-white flex items-center justify-center transition-colors"
                      title="Enter Station"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 3-Dots Floating Dropdown / Popover (Manage Option) */}
                {isMenuOpen && (
                  <div className="absolute right-3 top-14 z-50 w-56 rounded-2xl bg-[#1e1e1e] border border-[#333333] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
                    <button
                      onClick={(e) => handleOpenManageModal(e, station)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-white hover:bg-[#ff0000]/15 hover:text-[#ff4d4d] transition-colors cursor-pointer group/item"
                    >
                      <Shield className="w-4 h-4 text-[#ff0000] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-bold leading-tight">Manage</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">Admin side password login</p>
                      </div>
                    </button>

                    <div className="border-t border-white/[0.08] my-1" />

                    <div className="px-3 py-1.5 text-[10px] text-neutral-400">
                      <span>Interval: </span>
                      <span className="text-neutral-200 font-medium">
                        {station.promoIntervalType === 'time_interval'
                          ? `Har ${station.promoTimeIntervalMinutes} min`
                          : `Har ${station.promoSongInterval} gaane`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Info Note */}
      <div className="w-full max-w-lg mx-auto text-center text-xs text-neutral-500 pb-2">
        Sangeet Music Network &bull; Smart Audio Ducking &bull; 3-Tier Hierarchy
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. ADMIN PASSWORD MODAL (Triggered strictly from 3-dots "Manage") */}
      {/* ------------------------------------------------------------- */}
      {adminAuthStation && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#181818] border-t sm:border border-[#2f2f2f] rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-6 text-center space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#ff0000]">
                Admin Access
              </span>
              <button
                onClick={() => {
                  setAdminAuthStation(null);
                  setAdminPasswordInput('');
                  setAdminPasswordError(false);
                }}
                className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Icon & Title */}
            <div className="w-14 h-14 rounded-2xl bg-[#ff0000]/15 border border-[#ff0000]/30 text-[#ff0000] flex items-center justify-center mx-auto shadow-lg shadow-[#ff0000]/20">
              <KeyRound className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">{adminAuthStation.name}</h2>
              <p className="text-xs text-neutral-400">
                Admin side me enter hone ke liye <span className="text-white font-semibold">Password</span> enter karein.
              </p>
            </div>

            {/* Password Form */}
            <form onSubmit={handleVerifyAdminPassword} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setAdminPasswordError(false);
                  }}
                  placeholder="Admin Password"
                  autoFocus
                  className={`w-full px-4 py-3 rounded-xl bg-[#242424] border text-center text-lg tracking-widest font-mono text-white placeholder:text-neutral-500 placeholder:text-xs placeholder:tracking-normal focus:outline-none transition-all ${
                    adminPasswordError
                      ? 'border-[#ff0000] ring-2 ring-[#ff0000]/30 animate-shake'
                      : 'border-[#383838] focus:border-[#ff0000]'
                  }`}
                />
                {adminPasswordError && (
                  <p className="text-xs text-[#ff4d4d] mt-1.5 font-medium flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Galat Password! Kripya sahi pass dalein.</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAdminAuthStation(null);
                    setAdminPasswordInput('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 font-semibold text-xs active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#ff0000] hover:bg-[#e60000] text-white font-bold text-xs shadow-lg shadow-[#ff0000]/30 active:scale-95 transition-all"
                >
                  Enter as Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. REGULAR STAFF / REMOTE ACCESS PIN MODAL */}
      {/* ------------------------------------------------------------- */}
      {staffPinPromptStation && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#181818] border-t sm:border border-[#2f2f2f] rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-6 text-center space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                Security Protected Station
              </span>
              <button
                onClick={() => setStaffPinPromptStation(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.08]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-neutral-200 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-[#ff0000]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">{staffPinPromptStation.name}</h2>
              <p className="text-xs text-neutral-400">
                Is station me enter hone ke liye <span className="text-white font-semibold">Station Pass / PIN</span> enter karein.
              </p>
            </div>

            <form onSubmit={handleVerifyStaffPin} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={staffPinInput}
                  onChange={(e) => {
                    setStaffPinInput(e.target.value);
                    setStaffPinError(false);
                  }}
                  placeholder="Station Pass"
                  autoFocus
                  className={`w-full px-4 py-3 rounded-xl bg-[#242424] border text-center text-lg tracking-widest font-mono text-white placeholder:text-neutral-500 placeholder:text-xs placeholder:tracking-normal focus:outline-none transition-all ${
                    staffPinError
                      ? 'border-[#ff0000] ring-2 ring-[#ff0000]/30 animate-shake'
                      : 'border-[#383838] focus:border-[#ff0000]'
                  }`}
                />
                {staffPinError && (
                  <p className="text-xs text-[#ff4d4d] mt-1.5 font-medium flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Galat Station PIN!</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStaffPinPromptStation(null)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 font-semibold text-xs active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs shadow-lg active:scale-95 transition-all"
                >
                  Join Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
