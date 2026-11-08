import React, { useState } from 'react';
import {
  Volume2,
  Smartphone,
  ShieldAlert,
  Check,
  X,
  Users,
  Shuffle,
  Edit2,
  CheckCircle2,
  RadioTower,
  MoreVertical,
} from 'lucide-react';
import { HandoverRequest, ConnectedDevice } from '../types';

interface SpeakerHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSpeakerNode: boolean;
  activeSpeakerDeviceId: string;
  activeSpeakerName: string;
  myDeviceId: string;
  myDeviceName: string;
  userRole?: 'staff' | 'admin';
  connectedDevices?: ConnectedDevice[];
  onSetMyDeviceName: (name: string) => void;
  handoverRequest: HandoverRequest | null;
  onRequestHandover: () => void;
  onRespondHandover: (approved: boolean) => void;
  onClaimDirectly: () => void;
  onRandomizeSpeaker?: () => void;
  onReleaseSpeaker?: () => void;
  onAssignSpeakerDevice?: (targetDeviceId: string, targetDeviceName: string) => void;
  onDismissHandoverNotice?: () => void;
}

export const SpeakerHandoverModal: React.FC<SpeakerHandoverModalProps> = ({
  isOpen,
  onClose,
  isSpeakerNode,
  activeSpeakerDeviceId,
  activeSpeakerName,
  myDeviceId,
  myDeviceName,
  userRole = 'staff',
  connectedDevices = [],
  onSetMyDeviceName,
  handoverRequest,
  onRequestHandover,
  onRespondHandover,
  onClaimDirectly,
  onRandomizeSpeaker,
  onReleaseSpeaker,
  onAssignSpeakerDevice,
  onDismissHandoverNotice,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(myDeviceName);
  const [requestSent, setRequestSent] = useState(false);
  const [activeMenuDevId, setActiveMenuDevId] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  // Check if Admin took over speaker mode and this device is receiving the forced takeover notice
  const isAdminTakeoverNotice = Boolean(
    handoverRequest &&
    handoverRequest.status === 'admin_takeover' &&
    (handoverRequest.targetPreviousSpeakerId === myDeviceId ||
      (handoverRequest.requesterDeviceId !== myDeviceId && isSpeakerNode))
  );

  // Normal staff-to-speaker handover request
  const isIncomingForMe = Boolean(
    !isAdminTakeoverNotice &&
    isSpeakerNode &&
    handoverRequest &&
    handoverRequest.requesterDeviceId !== myDeviceId &&
    handoverRequest.status === 'pending'
  );

  const isMyRequestPending =
    !isSpeakerNode &&
    handoverRequest &&
    handoverRequest.requesterDeviceId === myDeviceId &&
    handoverRequest.status === 'pending';

  const isMyRequestRejected =
    !isSpeakerNode &&
    handoverRequest &&
    handoverRequest.requesterDeviceId === myDeviceId &&
    handoverRequest.status === 'rejected';

  if (!isOpen && !isIncomingForMe && !isAdminTakeoverNotice) return null;

  const handleSaveName = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = tempName.trim();
    if (trimmed) {
      onSetMyDeviceName(trimmed);
    }
    setEditingName(false);
  };

  const handleAcknowledgeAdminTakeover = () => {
    if (onDismissHandoverNotice) {
      onDismissHandoverNotice();
    } else {
      onRespondHandover(true);
    }
    onClose();
  };

  return (
    <div
      onClick={() => setActiveMenuDevId(null)}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1c1c1e] border-t sm:border border-white/[0.12] rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 text-[#f5f5f7] space-y-5 no-scrollbar animate-in slide-in-from-bottom duration-300 relative"
      >
        {/* Apple AirPlay Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 flex items-center justify-center">
              <RadioTower className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">
                Forecourt Audio Output
              </h2>
              <p className="text-[11px] text-neutral-400">1 Petrol Pump = 1 Active Speaker Phone</p>
            </div>
          </div>
          {isOpen && !isIncomingForMe && !isAdminTakeoverNotice && (
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-full hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 1. ADMIN TAKEOVER POPUP - NOTICE ONLY (EXACT TEXT & OK BUTTON ONLY) */}
        {isAdminTakeoverNotice ? (
          <div className="p-5 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/30 space-y-4 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-[#ff9500]/20 text-[#ff9500] border border-[#ff9500]/40 flex items-center justify-center mx-auto shadow-md">
              <RadioTower className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5 px-2">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Speaker Status
              </h3>
              <p className="text-sm font-semibold text-neutral-200 leading-relaxed">
                Speaker device ab Malik par transfer ho chuka hai.
              </p>
            </div>
            <button
              onClick={handleAcknowledgeAdminTakeover}
              className="w-full py-3 px-4 rounded-xl bg-[#ff9500] hover:bg-[#ff9500]/90 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-[#ff9500]/25 active:scale-95 transition-all cursor-pointer"
            >
              OK
            </button>
          </div>
        ) : isIncomingForMe && handoverRequest ? (
          /* 2. REGULAR STAFF INCOMING HANDOVER REQUEST BANNER */
          <div className="p-4 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/30 space-y-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#ff9500] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-white">Speaker Handover Request</p>
                <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                  <strong className="text-[#ff9500]">{handoverRequest.requesterDeviceName}</strong> forecourt audio output apne phone par transfer karna chahte hain.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => onRespondHandover(false)}
                className="py-2.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-neutral-200 active:scale-95 transition-all cursor-pointer"
              >
                Decline
              </button>
              <button
                onClick={() => onRespondHandover(true)}
                className="py-2.5 px-3 rounded-xl bg-[#ff9500] hover:bg-[#ff9500]/90 text-black font-bold text-xs shadow-md shadow-[#ff9500]/20 active:scale-95 transition-all cursor-pointer"
              >
                Approve (Allow)
              </button>
            </div>
          </div>
        ) : (
          /* 3. REGULAR APPLE AUDIO ROUTE PICKER & CONNECTED DEVICES */
          <div className="space-y-4">
            {/* Group 1: Device Identity */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  Your Phone Identifier
                </span>
                {!editingName ? (
                  <button
                    onClick={() => {
                      setTempName(myDeviceName);
                      setEditingName(true);
                    }}
                    className="text-xs text-[#ff9500] hover:text-[#ff9500]/80 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Rename</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSaveName}
                    className="text-xs text-[#30d158] hover:text-[#30d158]/80 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Save</span>
                  </button>
                )}
              </div>

              {editingName ? (
                <form onSubmit={handleSaveName} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="e.g. Ramesh (Pump 1) ya Cash Counter"
                    className="flex-1 bg-black/60 border border-white/[0.15] focus:border-[#ff9500] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-[#ff9500] text-black font-semibold text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="truncate">
                    <p className="text-sm font-semibold text-white truncate">{myDeviceName}</p>
                    <p className="text-[11px] text-neutral-400">Yeh naam baaki station staff ko dikhega</p>
                  </div>
                  <span
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-full shrink-0 border ${
                      isSpeakerNode
                        ? 'bg-[#ff9500]/20 text-[#ff9500] border-[#ff9500]/30'
                        : 'bg-white/[0.06] text-neutral-400 border-white/[0.08]'
                    }`}
                  >
                    {isSpeakerNode ? 'Speaker Mode' : 'Silent Remote'}
                  </span>
                </div>
              )}
            </div>

            {/* Group 2: Online Forecourt Devices List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#ff9500]" />
                  <span>Online Forecourt Devices ({connectedDevices.length})</span>
                </span>
                {(isSpeakerNode || isAdmin) && connectedDevices.length > 1 && onRandomizeSpeaker && (
                  <button
                    onClick={onRandomizeSpeaker}
                    className="text-[11px] font-semibold text-[#ff9500] hover:text-[#ff9500]/80 flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                    title="Randomly kisi bhi device par speaker transfer karein"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>Random Route</span>
                  </button>
                )}
              </div>

              <div className="bg-black/50 rounded-2xl border border-white/[0.08] divide-y divide-white/[0.06] overflow-visible max-h-56 overflow-y-auto no-scrollbar">
                {connectedDevices.map((dev) => {
                  const isDevSpeaker = dev.deviceId === activeSpeakerDeviceId;
                  const isMe = dev.deviceId === myDeviceId;
                  const isMenuOpen = activeMenuDevId === dev.deviceId;

                  return (
                    <div
                      key={dev.deviceId}
                      className={`flex items-center justify-between p-3 text-xs transition-colors relative ${
                        isDevSpeaker ? 'bg-[#ff9500]/10 text-white' : 'hover:bg-white/[0.02] text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 pr-2">
                        {isDevSpeaker ? (
                          <Volume2 className="w-4 h-4 text-[#ff9500] shrink-0 animate-pulse" />
                        ) : (
                          <Smartphone className="w-4 h-4 text-neutral-500 shrink-0" />
                        )}
                        <span className="truncate font-semibold">
                          {dev.deviceName}
                          {isMe && ' (Aapka Phone)'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDevSpeaker ? (
                          <div className="flex items-center gap-1.5 text-[#ff9500] font-semibold text-xs">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Active Speaker</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-medium text-neutral-400">
                            Silent
                          </span>
                        )}

                        {/* Admin 3-Dots Menu for Non-Speaker Devices */}
                        {isAdmin && !isDevSpeaker && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuDevId(isMenuOpen ? null : dev.deviceId);
                              }}
                              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                              title="Device options"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-7 z-40 bg-[#252528] border border-white/20 rounded-xl shadow-2xl p-1 w-44 animate-in fade-in zoom-in-95 duration-150"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuDevId(null);
                                    if (onAssignSpeakerDevice) {
                                      onAssignSpeakerDevice(dev.deviceId, dev.deviceName);
                                    }
                                  }}
                                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-white hover:bg-[#ff9500] hover:text-black flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Volume2 className="w-3.5 h-3.5 text-[#ff9500]" />
                                  <span>Speaker device banaye</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending or rejected status */}
            {isMyRequestPending && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 text-center font-medium">
                ⏳ Request bhej di gayi hai. Speaker phone par allow hone ka intezaar hai.
              </div>
            )}
            {isMyRequestRejected && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 text-center font-medium">
                ❌ Speaker phone ne handover decline kar diya.
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2">
              {isSpeakerNode ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-[#30d158]/10 border border-[#30d158]/25 text-[#30d158] text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#30d158] shrink-0" />
                    <span>Aapka phone forecourt par aawaz de raha hai</span>
                  </div>

                  {onReleaseSpeaker && (
                    <button
                      onClick={() => {
                        onReleaseSpeaker();
                        onClose();
                      }}
                      className="w-full py-2.5 rounded-xl text-xs text-neutral-400 hover:text-red-400 active:scale-95 transition-all cursor-pointer"
                    >
                      Speaker Release Karein (Random transfer)
                    </button>
                  )}
                </div>
              ) : !activeSpeakerDeviceId ? (
                <button
                  onClick={() => {
                    onClaimDirectly();
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#ff9500] hover:bg-[#ff9500]/90 active:scale-[0.98] text-black font-semibold text-xs uppercase tracking-wider transition-all shadow-lg shadow-[#ff9500]/20 cursor-pointer"
                >
                  Is Phone Ko Speaker Banao
                </button>
              ) : (
                <button
                  onClick={() => {
                    onRequestHandover();
                    setRequestSent(true);
                  }}
                  disabled={Boolean(isMyRequestPending)}
                  className="w-full py-3 px-4 rounded-xl bg-[#ff9500] hover:bg-[#ff9500]/90 active:scale-[0.98] text-black font-semibold text-xs uppercase tracking-wider transition-all disabled:opacity-50 shadow-lg shadow-[#ff9500]/20 cursor-pointer"
                >
                  {isAdmin ? 'Speaker Mode Claim Karein' : requestSent || isMyRequestPending ? 'Request Bheji Hui Hai...' : 'Speaker Handover Request Bhejo'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
