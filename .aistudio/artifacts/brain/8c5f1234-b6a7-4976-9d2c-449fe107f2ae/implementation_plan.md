# IOCL Forecourt Radio & Collaborative Staff Jukebox

Automated background music and promotional announcement broadcasting system engineered specifically for Indian Oil (IOCL) Retail Outlets (Petrol Pumps). It blends seamless staff music queueing with automated, tamper-proof promo audio injection, professional Web Audio ducking, two-track offline lookahead buffering, and an administrative priority override hierarchy.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following system choices were aligned with the user during clarification and govern the design:
>
> - **Music Source**: Hybrid online Indian music search (Bollywood, Punjabi, Regional, Indie tracks via open streaming proxies) combined with direct MP3 audio file imports/uploads.
> - **Multi-Device Playback**: Any staff phone can easily toggle between **Speaker Node** (the phone physically wired/paired to the forecourt amplifier/Bluetooth speaker) and **Remote Controller** (staff on the pump island managing the queue from their pockets).
> - **Dual Tier Queue**: Admin selections carry absolute priority. Admin can choose between instant **PLAY NOW** (smoothly pauses/fades current track and plays Admin song immediately, saving staff queue for later), **Add to Priority Queue** (plays before all staff tracks), or standard **Add to Staff Queue**.
> - **Zero PC Burden**: 100% web-accessible without requiring a dedicated office computer, complex server installs, or paid streaming subscriptions.

---

## 1. Overview & Core Concept

### What It Does
An in-store forecourt radio web application that solves repetitive announcement fatigue at fuel stations. Pump attendants and forecourt staff can search and queue their favorite tracks, while the automated broadcast engine silently ensures that IOCL promotional audios (XP95 high-octane fuel, SERVO lubricants, IndianOil ONE loyalty, and Forecourt Safety advisories) are injected at configured intervals (e.g. every 1–2 songs or every $N$ minutes).

### Autoplay Queue & Dynamic Mood Mix System
* **Default Mode (90s Hits)**: By default upon loading, the station plays and queues timeless 90s Evergreen Bollywood Hits so the forecourt always stays grounded in familiar, evergreen music.
* **MIX Toggle Button**: Prominently accessible on Mobile Mini Player, Mobile Home Card, Mobile Full-Screen Player, and Desktop Transport Bar.
* **Clean Artwork UI**: All overlay animations (aura, shockwave frame, and linear wipe) over the artwork have been removed. The artwork remains 100% clean, crisp, and undisturbed. Tapping MIX provides clean tactile button feedback while toggling autoplay between 90s Evergreen Hits and dynamic mood/genre matching.

### Target Audience & Persona
* **Pump Attendants / Forecourt Staff**: Mobile users on 4G/WiFi who want to quickly queue songs, see what's playing, and enjoy continuous music during shifts without repetitive promo boredom.
* **RO Manager / Dealer (Admin)**: Controls promotional campaigns, announcement timing, station audio presets, and has VIP override authority to play urgent anthems or announcements instantly.

### Key Value
* **Customer Awareness without Staff Resistance**: Commercial promotions run on strict schedules while attendants stay engaged through their shared jukebox.
* **Zero Infrastructure Overhead**: Runs in standard mobile/desktop browsers across Android and iOS devices.
* **Network Drop Resilience**: Two-track lookahead pre-caching ensures playback never cuts out during 15–30 second forecourt connectivity fluctuations.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow 1: Staff Queuing & Station Playback (Mobile Forecourt View)
1. Staff member opens the station link on their mobile browser (`/station/iocl-ro-main`).
2. Staff sees the current track, live audio visualizer, and an upcoming indicator showing when the next promo announcement is scheduled.
3. Staff searches for a song (e.g., Bollywood, Punjabi, Retro hits) or taps an MP3 upload button.
4. Tapping **Add to Queue** places the song into the shared queue. The queue dynamically displays song order with clear tag indicators (`Staff Pick`, `Admin Priority`, `Promo Break`).
5. If this phone is plugged into the pump amplifier, staff taps **"Activate as Station Speaker"**; otherwise, it remains in remote control mode.

#### Flow 2: Automated Promo Injection & Audio Ducking
1. While Track 1 is playing, the internal scheduler counts tracks or elapsed time toward the next promo window.
2. When the promo interval triggers, the Web Audio Ducking engine smoothly attenuates the music volume to 18% over 1.2 seconds (or crossfades into the promo).
3. The IOCL promotional clip (e.g., "SERVO 4T Engine Oil" or "XP95 Mileage Guarantee") plays at crisp 100% announcement volume.
4. As the promo finishes, the music volume seamlessly ramps back up to normal volume, and the next song in the queue begins.

#### Flow 3: Admin Priority Override (PIN Protected)
1. Dealer/Manager taps **"Admin Panel"** in the top navigation and enters the 4-digit PIN (default `1959` or user-defined).
2. Admin searches for a track and is presented with three distinct actions:
   * **PLAY NOW (Instant Override)**: Fades out the currently playing staff track immediately and starts the Admin track. Staff queue shifts to "Up Next".
   * **Add to Priority Queue**: Injects the track ahead of all regular staff tracks.
   * **Add to Staff Queue**: Standard insertion at the tail of the queue.
3. Admin configures the promo injection rule (e.g., "Play promo every 2 songs" or "Every 12 minutes").
4. Admin can upload new custom promo audio files, adjust ducking ratio (10% to 30%), or trigger the **"Broadcast Urgent Promo Now"** button.

### Visual Identity & Theme
* **Aesthetic Direction**: Industrial Commercial Forecourt styling. High contrast, clean surfaces, daylight legibility for bright outdoor forecourt conditions, avoiding dark low-contrast slop.
* **Color Palette (IOCL Identity)**:
  * Primary Accent: IOCL Saffron / Indian Oil Orange (`#F37021`)
  * Deep Foundation: IOCL Heritage Navy (`#0C2340`)
  * Neutral Surfaces: Slate Gray (`#F8FAFC` background in light mode, `#0B1120` in dark mode)
  * Priority Accent: Royal Amber (`#D97706` for Admin tracks)
  * Promo Indicator: Emerald Forest (`#059669` for Official Announcements)
* **Typography**:
  * Display & UI: `Plus Jakarta Sans` for clean, modern readability.
  * Time, Bitrate & Audio Metrics: `JetBrains Mono` with `tabular-nums` for rock-solid layout stability.
* **Ergonomics**:
  * Minimum touch target size $\ge 48 \times 48\text{px}$ on all mobile controls.
  * Natural thumb-zone bottom navigation and floating quick-player bar.
  * Sticky bottom player height strictly under 15% of mobile viewport.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Browser Web Audio API for Professional Ducking vs Simple HTMLAudio
* **Chosen Approach**: Build a dual-gain Web Audio Graph (`MusicGainNode` and `PromoGainNode`) interconnected through a master compressor.
* **Why**: Native HTML5 `<audio>` volume fading produces choppy, stepped volume transitions on mobile devices. The Web Audio API provides hardware-accelerated, linear/exponential ramp curves (`exponentialRampToValueAtTime`) for studio-grade radio ducking.
* **Alternatives Considered**: Playing promo in an overlay `<video>` or separate tab — rejected due to poor audio mixing and OS backgrounding issues.

### Decision 2: 2-Track Lookahead Buffer via IndexedDB & CacheStorage
* **Chosen Approach**: When track $N$ starts, track $N+1$ and the upcoming scheduled promo are fetched in the background and stored as `Blob` objects in client memory / CacheStorage.
* **Why**: Addresses the user's specific requirement where pump Wi-Fi/4G occasionally experiences 10–20 second drops. With 2 full tracks cached ahead, the pump has a 3–5 minute uninterrupted buffer.
* **Alternatives Considered**: Streaming only chunk-by-chunk — fails abruptly if network drops mid-chorus.

### Decision 3: Single Shared Station State with Active Speaker Election
* **Chosen Approach**: Centralized station room state with a clearly designated "Active Speaker Node" token. Any phone can click "Take Over as Speaker" or "Listen / Control Only".
* **Why**: Prevents multiple phones from simultaneously blasting audio over the pump forecourt while allowing every attendant to search and reorder the shared queue.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        IOCL FORECOURT RADIO                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   STAFF MOBILE CLIENT                 ADMIN CONSOLE (PIN PROTECTED)    │
│  ┌───────────────────────┐           ┌───────────────────────────────┐ │
│  │ • Song Search Engine  │           │ • Schedule Rules (N songs/min)│ │
│  │ • Add to Queue        │           │ • PLAY NOW Instant Override   │ │
│  │ • Speaker / Remote    │           │ • Priority Queue Manager      │ │
│  │ • Upvote & Reorder    │           │ • Custom Promo Uploader       │ │
│  └───────────┬───────────┘           └───────────────┬───────────────┘ │
│              │                                       │                 │
│              ▼                                       ▼                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                    SHARED STATION QUEUE STORE                     │ │
│  │  - Active Track (Playing)                                         │ │
│  │  - Admin Priority Queue [AFGAAN JALEBI, RAP GOD] (Priority: 100)  │ │
│  │  - Staff Regular Queue [SAFAL, REHEM, ...]       (Priority: 10)   │ │
│  │  - Injected Promo Rotation Pointer                                │ │
│  └───────────────────────────────────┬───────────────────────────────┘ │
│                                      │                                 │
│                                      ▼                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │              HIGH-BITRATE AUDIO ENGINE (WEB AUDIO API)            │ │
│  │                                                                   │ │
│  │    [ Music Stream ] ──► [ Music Gain ] ──────┐                    │ │
│  │                                              ├──► [ Master Comp ] │ │
│  │    [ Promo Stream ] ──► [ Promo Gain ] ──────┘          │         │ │
│  │                                                         ▼         │ │
│  │                                                   [ Speaker Out ] │ │
│  │   • Automatic Ducking: Music Gain fades to 18% during Promo       │ │
│  │   • Seamless Crossfade: 2.0s exponential crossfade on song finish │ │
│  └───────────────────────────────────┬───────────────────────────────┘ │
│                                      │                                 │
│                                      ▼                                 │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │           OFFLINE PRE-BUFFERING ENGINE (CACHE / INDEXEDDB)        │ │
│  │  - Current Track (Fully buffered)                                 │ │
│  │  - Next Track Lookahead (Pre-fetched in background)               │ │
│  │  - All Official IOCL Promos (Permanently offline cached)          │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

```typescript
interface SongTrack {
  id: string;
  title: string;
  artist: string;
  duration: number; // in seconds
  audioUrl: string;
  source: 'online' | 'local_upload';
  artworkUrl?: string;
  requestedBy: string;
  addedAt: number;
  priority: 'admin_instant' | 'admin_high' | 'staff_normal';
}

interface PromoClip {
  id: string;
  title: string;
  category: 'xp95' | 'servo' | 'xtrarewards' | 'safety' | 'custom';
  audioUrl: string;
  duration: number;
  enabled: boolean;
  playsCount: number;
  lastPlayedAt?: number;
}

interface StationSettings {
  stationName: string; // e.g. "IOCL Retail Outlet - Highway RO"
  adminPin: string;    // 4-digit PIN
  promoIntervalType: 'songs_count' | 'time_interval';
  promoSongInterval: number; // e.g., Every 2 songs
  promoTimeIntervalMinutes: number; // e.g., Every 12 minutes
  duckingLevel: number; // 0.15 to 0.30 (15% to 30%)
  crossfadeDuration: number; // in seconds (e.g. 2s)
  activeSpeakerDeviceId: string;
}
```

### Key Sequences & Handlers
1. **Queue Resolution**: Whenever a track ends or skips, the player checks:
   - Does the promo schedule condition match (songs played count $\ge$ interval OR timer elapsed)?
     $\rightarrow$ Inject next enabled `PromoClip`, trigger smooth audio ducking.
   - Are there tracks in the `admin_high` priority queue?
     $\rightarrow$ Play top `admin_high` track before any staff tracks.
   - Otherwise, play the next track from `staff_normal` queue.
2. **Admin PLAY NOW Handler**:
   - Pauses current audio context, triggers a 0.5s fade down.
   - Installs Admin track at `currentlyPlaying`.
   - Leaves staff queue completely intact to resume right after Admin track.
3. **Pre-Cache Lookahead Worker**:
   - Listens to queue updates; initiates fetch for the subsequent track URL and stores response in local CacheStorage.

---

## 5. Recent System Updates & Polish

- **Full Player UI Overhaul (`MobileFullPlayer.tsx`)**:
  - Restyled to authentic YouTube Music aesthetic with clean typography and generous breathing room.
  - Removed all Like and Dislike buttons.
  - Removed all "👑 Admin Authority" phrases and artwork ribbons.
  - Interactive scrubber bar with hover/touch indicator and timestamps.
  - Signature centered round play/pause button and sleek "UP NEXT" drawer trigger.
- **Removed "Admin" Phrasing across User Interface**:
  - Navigation tab: Changed "Admin PA" to "Broadcast".
  - Search View: Replaced "Admin: Instant Play & Priority Queue" with "Instant Play & Priority Queue" and removed admin mentions from tooltips.
  - Queue Drawer: Replaced "(Admin Queue)" with clean priority indicators.
  - Header: Changed "Station Administrator" to "Station Manager".
- **Audio Ducking Fix (Mid-Promo Un-ducking Solved)**:
  - Root cause resolved: `audioEngine.setMasterVolume` and `audioEngine.unmuteForSpeaker` now respect ducking state, avoiding forced volume resets on polling ticks.
  - Added guards in `restoreMusic` so background music never restores while `promoAudio` is actively playing.
  - Upgraded promo watchdog in `playPromo` to dynamically adapt to actual audio duration and safely extend timeouts if audio is progressing.

---

## 6. Header Redesign & Search Tab Layout Fixes

- **Top Header Redesign (`MobileHeader.tsx`)**:
  - Restructured to authentic YouTube Music aesthetic:
    - **Left**: Official red circular play icon + "Music" title wordmark.
    - **Below Music Wordmark**: Station name rendered in sleek, compact text (`text-[10px] text-neutral-400 font-medium truncate max-w-[150px]`) with a live emerald dot indicator and interactive station switcher trigger.
    - **Right**: Clean circular speaker icon button (`<Volume2 />`) with pulsating red glow when active—all "Speaker" text labels completely removed.
    - Sleek user profile avatar with simplified station access dropdown.
- **Search Tab Blank Space Elimination & De-Cluttering (`MobileSearchView.tsx`)**:
  - Removed the large empty vertical gap caused by `sticky top-14` inside the `<main>` scroll container, resetting search header to `sticky top-0 z-20` so it anchors directly beneath the top bar.
  - Removed the noisy, cluttered mode status banner between the search bar and the search content.
  - Replaced the bulky vertical recent search list with a horizontal scrollable row of compact search chips (`overflow-x-auto no-scrollbar`), complete with a "Clear all" action and individual remove buttons.
  - Aligned search input, recent chips, and the 2-column genre grid cards into a seamless, unified flow matching YouTube Music mobile standards.

