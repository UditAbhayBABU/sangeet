import React, { useState } from 'react';
import { MobileHeader } from './MobileHeader';
import { MobileHomeView } from './MobileHomeView';
import { MobileSearchView } from './MobileSearchView';
import { MobileSettingsView } from './MobileSettingsView';
import { MobileMiniPlayer } from './MobileMiniPlayer';
import { MobileFullPlayer } from './MobileFullPlayer';
import { MobileQueueMixDrawer } from './MobileQueueMixDrawer';
import { MobileQueueView } from './MobileQueueView';
import { MobileBottomNav, MobileTab } from './MobileBottomNav';
import { MobileLikedPlaylistModal } from './MobileLikedPlaylistModal';
import { SpeakerHandoverModal } from '../SpeakerHandoverModal';
import { SongTrack, PromoClip, StationSettings, StationState, StationItem } from '../../types';
import { loadLikedTracks, saveLikedTracks, toggleLikedTrack } from '../../services/likedTracks';

interface MobileAppLayoutProps {
  stationState: StationState;
  userRole: 'staff' | 'admin';
  isSpeakerNode: boolean;
  myDeviceId: string;
  myDeviceName: string;
  currentTime: number;
  duration: number;
  isAudioContextStarted: boolean;
  isSpeakerModalOpen: boolean;
  hasIncomingHandover: boolean;
  onSetIsSpeakerModalOpen: (open: boolean) => void;
  onLeaveStation: () => void;
  onSwitchRole: () => void;
  onUpdateDeviceName: (name: string) => void;
  onPlayPause: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onSeek: (seconds: number) => void;
  onPlayTrackNow: (track: SongTrack) => void;
  onAddTrackToQueue: (track: SongTrack) => void;
  onPlayNext: (track: SongTrack) => void;
  onRemoveTrack: (trackId: string, queueType: 'admin' | 'staff') => void;
  onReorderStaffQueue: (newQueue: SongTrack[]) => void;
  onReorderAdminQueue?: (newQueue: SongTrack[]) => void;
  onClearQueue: (queueType?: 'staff' | 'admin' | 'all') => void;
  onRefreshMix: () => void;
  onUpdateSettings: (settings: Partial<StationSettings>) => void;
  onUpdateAdminPin: (newPin: string) => void;
  onAddPromo: (promo: { title: string; categoryId: string; audioUrl: string; duration: number; scriptSnippet: string }) => void;
  onTogglePromo: (id: string, enabled: boolean) => void;
  onDeletePromo: (id: string) => void;
  onAddCategory: (category: { id?: string; name: string; description: string; color: string }) => void;
  onDeleteCategory: (id: string) => void;
  onAddStation: (station: {
    name: string;
    location?: string;
    promosEnabled: boolean;
    pinRequired?: boolean;
    stationPin?: string;
    adminPassword?: string;
    promoSongInterval: number;
    promoTimeIntervalMinutes: number;
    duckingVolumePercent: number;
  }) => void;
  onUpdateStation: (id: string, updates: Partial<StationItem>) => void;
  onDeleteStation: (id: string) => void;
  onSelectStation: (id: string, role?: 'staff' | 'admin') => void;
  onTriggerUrgentPromo: () => void;
  onClaimSpeakerDirectly: () => void;
  onRequestSpeakerHandover: () => void;
  onRespondSpeakerHandover: (approved: boolean) => void;
  onRandomizeSpeaker: () => void;
  onReleaseSpeaker: () => void;
  onToggleDesktopPreview?: () => void;
  onStartLiveAnnouncement?: (payload?: any) => void;
  onStopLiveAnnouncement?: () => void;
  onSetMasterVolume?: (volume: number) => void;
  isMoodMixActive?: boolean;
  detectedMood?: string;
  mixShockwaveKey?: number | null;
  onToggleMoodMix?: () => void;
  onStopPromo?: () => void;
  onToggleLikeTrack?: (track: SongTrack) => void;
  onRemoveLikedTrack?: (trackId: string) => void;
  onAssignSpeakerDevice?: (targetDeviceId: string, targetDeviceName: string) => void;
  onDismissHandoverNotice?: () => void;
}

export const MobileAppLayout: React.FC<MobileAppLayoutProps> = ({
  stationState,
  userRole,
  isSpeakerNode,
  myDeviceId,
  myDeviceName,
  currentTime,
  duration,
  isAudioContextStarted,
  isSpeakerModalOpen,
  hasIncomingHandover,
  onSetIsSpeakerModalOpen,
  onLeaveStation,
  onSwitchRole,
  onUpdateDeviceName,
  onPlayPause,
  onSkipNext,
  onSkipPrevious,
  onSeek,
  onPlayTrackNow,
  onAddTrackToQueue,
  onPlayNext,
  onRemoveTrack,
  onReorderStaffQueue,
  onReorderAdminQueue,
  onClearQueue,
  onRefreshMix,
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
  onClaimSpeakerDirectly,
  onRequestSpeakerHandover,
  onRespondSpeakerHandover,
  onRandomizeSpeaker,
  onReleaseSpeaker,
  onToggleDesktopPreview,
  onStartLiveAnnouncement,
  onStopLiveAnnouncement,
  onSetMasterVolume,
  isMoodMixActive,
  detectedMood,
  mixShockwaveKey,
  onToggleMoodMix,
  onStopPromo,
  onToggleLikeTrack,
  onRemoveLikedTrack,
  onAssignSpeakerDevice,
  onDismissHandoverNotice,
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);
  const [queueDrawerInitialTab, setQueueDrawerInitialTab] = useState<'queue' | 'mix'>('queue');
  const [searchPrefill, setSearchPrefill] = useState('');
  const [isLikedPlaylistOpen, setIsLikedPlaylistOpen] = useState(false);

  // Station-scoped Liked Tracks State: initialized from Cloud Database or local cache
  const [likedTracks, setLikedTracks] = useState<SongTrack[]>(() => {
    if (stationState?.likedTracks && Array.isArray(stationState.likedTracks)) {
      return stationState.likedTracks;
    }
    return loadLikedTracks(stationState?.stationId);
  });

  // Real-Time Cloud Synchronization: Whenever cloud state updates from server
  React.useEffect(() => {
    if (stationState?.likedTracks && Array.isArray(stationState.likedTracks)) {
      setLikedTracks(stationState.likedTracks);
      saveLikedTracks(stationState.likedTracks, stationState.stationId);
    } else {
      setLikedTracks(loadLikedTracks(stationState?.stationId));
    }
  }, [stationState?.likedTracks, stationState?.stationId]);

  // Synchronous tab/storage event listener
  React.useEffect(() => {
    const handleUpdate = () => {
      if (stationState?.likedTracks && Array.isArray(stationState.likedTracks)) {
        setLikedTracks(stationState.likedTracks);
      } else {
        setLikedTracks(loadLikedTracks(stationState?.stationId));
      }
    };
    window.addEventListener('sangeet_liked_tracks_changed', handleUpdate);
    return () => window.removeEventListener('sangeet_liked_tracks_changed', handleUpdate);
  }, [stationState?.likedTracks, stationState?.stationId]);

  const activeLikedList = (stationState?.likedTracks && stationState.likedTracks.length > 0)
    ? stationState.likedTracks
    : likedTracks;

  // Check if current track is liked
  const isCurrentTrackLiked = Boolean(
    stationState.currentTrack &&
      activeLikedList.some(
        (t) =>
          (t.youtubeVideoId || t.id) ===
          (stationState.currentTrack?.youtubeVideoId || stationState.currentTrack?.id)
      )
  );

  const handleToggleLikeCurrentTrack = () => {
    if (!stationState.currentTrack) return;
    // 1. Optimistic Local Cache Update
    const res = toggleLikedTrack(stationState.currentTrack, stationState.stationId);
    setLikedTracks(res.tracks);
    // 2. Cloud Server Database Dispatch (persists across all devices & restarts)
    if (onToggleLikeTrack) {
      onToggleLikeTrack(stationState.currentTrack);
    }
  };

  const handleRemoveLikedTrack = (trackId: string) => {
    // 1. Optimistic Local Cache Update
    const updated = activeLikedList.filter(
      (t) => t.id !== trackId && t.youtubeVideoId !== trackId
    );
    saveLikedTracks(updated, stationState.stationId);
    setLikedTracks(updated);
    // 2. Cloud Server Database Dispatch
    if (onRemoveLikedTrack) {
      onRemoveLikedTrack(trackId);
    }
  };

  // If role is staff, ensure settings tab is never active
  React.useEffect(() => {
    if (userRole === 'staff' && activeTab === 'settings') {
      setActiveTab('home');
    }
  }, [userRole, activeTab]);

  const handleOpenQueueDrawer = (tab: 'queue' | 'mix' = 'queue') => {
    setQueueDrawerInitialTab(tab);
    setIsQueueDrawerOpen(true);
  };

  const handleExecuteCategorySearch = (genreQuery: string) => {
    setSearchPrefill(genreQuery);
    setActiveTab('search');
  };

  const handlePlayRandomRecommendation = () => {
    const recs = stationState.recommendations || [];
    if (recs.length > 0) {
      const picked = recs[Math.floor(Math.random() * recs.length)];
      onPlayTrackNow(picked);
      return;
    }

    fetch('/api/recommendations/dynamic?genre=90s')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.all) && data.all.length > 0) {
          const picked = data.all[Math.floor(Math.random() * data.all.length)];
          onPlayTrackNow(picked);
        }
      })
      .catch((e) => {
        console.warn('Error fetching random recommendation:', e);
      });
  };

  const totalQueueCount =
    (stationState.adminQueue?.length || 0) + (stationState.staffQueue?.length || 0);

  const currentTrackIsAdmin = Boolean(
    stationState.currentTrack &&
      (stationState.currentTrack.priority === 'admin_instant' ||
        stationState.currentTrack.priority === 'admin_high')
  );

  return (
    <div className="min-h-screen bg-[#030303] text-white flex flex-col font-sans select-none antialiased md:max-w-md md:mx-auto md:border-x md:border-white/10 md:shadow-2xl relative">
      {/* 1. YouTube Music Mobile Header */}
      <MobileHeader
        stationName={stationState.stationName}
        userRole={userRole}
        isSpeakerNode={isSpeakerNode}
        activeSpeakerName={stationState.speaker?.activeDeviceName}
        onOpenSpeakerModal={() => onSetIsSpeakerModalOpen(true)}
        onLeaveStation={onLeaveStation}
        onPlayRandomRecommendation={handlePlayRandomRecommendation}
        onOpenStationSwitch={onLeaveStation}
      />

      {/* 2. Main Tab Views */}
      <main className="flex-1 overflow-y-auto">
        {/* HOME VIEW */}
        {activeTab === 'home' && (
          <MobileHomeView
            stationState={stationState}
            userRole={userRole}
            isSpeakerNode={isSpeakerNode}
            onPlayTrackNow={onPlayTrackNow}
            onAddTrackToQueue={onAddTrackToQueue}
            onPlayNext={onPlayNext}
            onRefreshMix={onRefreshMix}
            onExecuteSearchCategory={handleExecuteCategorySearch}
          />
        )}

        {/* SEARCH VIEW */}
        {activeTab === 'search' && (
          <MobileSearchView
            initialQuery={searchPrefill}
            userRole={userRole}
            isSpeakerNode={isSpeakerNode}
            onPlayTrackNow={onPlayTrackNow}
            onAddTrackToQueue={onAddTrackToQueue}
            onPlayNext={onPlayNext}
            currentTrackIsAdmin={currentTrackIsAdmin}
            likedTracks={activeLikedList}
            onOpenLikedPlaylist={() => setIsLikedPlaylistOpen(true)}
          />
        )}

        {/* QUEUE INLINE VIEW (Tapped from Bottom Nav) */}
        {activeTab === 'queue' && (
          <MobileQueueView
            stationState={stationState}
            userRole={userRole}
            isSpeakerNode={isSpeakerNode}
            currentTime={currentTime}
            duration={duration}
            onPlayPause={onPlayPause}
            onSkipNext={onSkipNext}
            onPlayTrackNow={onPlayTrackNow}
            onAddTrackToQueue={onAddTrackToQueue}
            onPlayNext={onPlayNext}
            onRemoveTrack={onRemoveTrack}
            onReorderStaffQueue={onReorderStaffQueue}
            onReorderAdminQueue={onReorderAdminQueue}
            onClearQueue={onClearQueue}
            onRefreshMix={onRefreshMix}
            onNavigateToSearch={() => setActiveTab('search')}
            isMoodMixActive={isMoodMixActive}
            detectedMood={detectedMood}
            mixShockwaveKey={mixShockwaveKey}
            onToggleMoodMix={onToggleMoodMix}
          />
        )}

        {/* SETTINGS VIEW (Only for Admin) */}
        {activeTab === 'settings' && userRole === 'admin' && (
          <MobileSettingsView
            stationState={stationState}
            onUpdateSettings={onUpdateSettings}
            onUpdateAdminPin={onUpdateAdminPin}
            onAddPromo={onAddPromo}
            onTogglePromo={onTogglePromo}
            onDeletePromo={onDeletePromo}
            onAddCategory={onAddCategory}
            onDeleteCategory={onDeleteCategory}
            onAddStation={onAddStation}
            onUpdateStation={onUpdateStation}
            onDeleteStation={onDeleteStation}
            onSelectStation={(id) => onSelectStation(id, 'admin')}
            onTriggerUrgentPromo={onTriggerUrgentPromo}
            onSwitchToStaff={onSwitchRole}
            onStartAnnouncement={onStartLiveAnnouncement}
            onStopAnnouncement={onStopLiveAnnouncement}
          />
        )}
      </main>

      {/* 3. Floating Mini Player (Docked right above bottom navigation) */}
      {!isFullPlayerOpen && stationState.currentTrack && (
        <MobileMiniPlayer
          currentTrack={stationState.currentTrack}
          isPlaying={stationState.playbackState.isPlaying}
          currentTime={currentTime}
          duration={duration}
          isSpeakerNode={isSpeakerNode}
          userRole={userRole}
          isMoodMixActive={isMoodMixActive}
          detectedMood={detectedMood}
          mixShockwaveKey={mixShockwaveKey}
          isPromoPlaying={stationState.isPromoPlaying}
          onPlayPause={onPlayPause}
          onSkipNext={onSkipNext}
          onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
          onToggleMoodMix={onToggleMoodMix}
          onStopPromo={onStopPromo}
        />
      )}

      {/* 4. Full-Screen YouTube Music Style Player */}
      <MobileFullPlayer
        isOpen={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
        stationState={stationState}
        currentTime={currentTime}
        duration={duration}
        isSpeakerNode={isSpeakerNode}
        userRole={userRole}
        onPlayPause={onPlayPause}
        onSkipNext={onSkipNext}
        onSkipPrevious={onSkipPrevious}
        onSeek={onSeek}
        onOpenQueueDrawer={handleOpenQueueDrawer}
        onTriggerUrgentPromo={onTriggerUrgentPromo}
        onOpenSpeakerModal={() => onSetIsSpeakerModalOpen(true)}
        onUpdateSettings={onUpdateSettings}
        onSetMasterVolume={onSetMasterVolume}
        isMoodMixActive={isMoodMixActive}
        detectedMood={detectedMood}
        mixShockwaveKey={mixShockwaveKey}
        onToggleMoodMix={onToggleMoodMix}
        onStopPromo={onStopPromo}
        isLiked={isCurrentTrackLiked}
        onToggleLike={handleToggleLikeCurrentTrack}
      />

      {/* 5. Queue & Mix Slide-Up Drawer */}
      <MobileQueueMixDrawer
        isOpen={isQueueDrawerOpen}
        onClose={() => setIsQueueDrawerOpen(false)}
        currentTrack={stationState.currentTrack}
        adminQueue={stationState.adminQueue}
        staffQueue={stationState.staffQueue}
        mixTracks={stationState.recommendations}
        isPlaying={stationState.playbackState.isPlaying}
        userRole={userRole}
        isSpeakerNode={isSpeakerNode}
        initialTab={queueDrawerInitialTab}
        onPlayTrackNow={onPlayTrackNow}
        onAddTrackToQueue={onAddTrackToQueue}
        onPlayNext={onPlayNext}
        onRemoveTrack={onRemoveTrack}
        onReorderStaffQueue={onReorderStaffQueue}
        onReorderAdminQueue={onReorderAdminQueue}
        onClearQueue={onClearQueue}
        isMoodMixActive={isMoodMixActive}
        detectedMood={detectedMood}
        onToggleMoodMix={onToggleMoodMix}
      />

      {/* 6. Speaker Handover Modal */}
      <SpeakerHandoverModal
        isOpen={isSpeakerModalOpen || hasIncomingHandover}
        onClose={() => onSetIsSpeakerModalOpen(false)}
        isSpeakerNode={isSpeakerNode}
        activeSpeakerDeviceId={stationState.speaker?.activeDeviceId || ''}
        activeSpeakerName={stationState.speaker?.activeDeviceName || ''}
        myDeviceId={myDeviceId}
        myDeviceName={myDeviceName}
        userRole={userRole}
        connectedDevices={stationState.connectedDevices || []}
        onSetMyDeviceName={onUpdateDeviceName}
        handoverRequest={stationState.handoverRequest || null}
        onRequestHandover={onRequestSpeakerHandover}
        onRespondHandover={onRespondSpeakerHandover}
        onClaimDirectly={onClaimSpeakerDirectly}
        onRandomizeSpeaker={onRandomizeSpeaker}
        onReleaseSpeaker={onReleaseSpeaker}
        onAssignSpeakerDevice={onAssignSpeakerDevice}
        onDismissHandoverNotice={onDismissHandoverNotice}
      />

      {/* 7. Full-Screen YouTube Music Liked Tracks Playlist Modal */}
      <MobileLikedPlaylistModal
        isOpen={isLikedPlaylistOpen}
        onClose={() => setIsLikedPlaylistOpen(false)}
        likedTracks={activeLikedList}
        stationName={stationState.stationName}
        onPlayTrackNow={onPlayTrackNow}
        onAddTrackToQueue={onAddTrackToQueue}
        onPlayNext={onPlayNext}
        onRemoveLikedTrack={handleRemoveLikedTrack}
      />

      {/* 7. YouTube Music Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        userRole={userRole}
        queueCount={totalQueueCount}
      />
    </div>
  );
};
