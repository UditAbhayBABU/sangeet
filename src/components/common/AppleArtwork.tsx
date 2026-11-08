import React, { useState, useEffect } from 'react';
import { Music2, Disc3 } from 'lucide-react';

export interface AppleArtworkProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  aspectRatio?: 'square' | 'video' | 'auto' | '1:1' | '16:9';
  source?: 'youtube' | 'jiosaavn' | 'online' | 'local_upload' | string;
  isYouTube?: boolean;
  className?: string;
  showAmbientGlow?: boolean;
  isPlaying?: boolean;
}

// Deterministic gradient palettes inspired by Apple Music album aesthetics
const GRADIENT_PALETTES = [
  'from-orange-600 via-rose-700 to-amber-900',
  'from-indigo-600 via-purple-700 to-slate-950',
  'from-emerald-600 via-teal-700 to-cyan-950',
  'from-rose-600 via-pink-700 to-purple-950',
  'from-blue-600 via-indigo-800 to-slate-950',
  'from-amber-600 via-orange-700 to-red-950',
];

function getPaletteForString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[index];
}

export const AppleArtwork: React.FC<AppleArtworkProps> = ({
  src,
  alt,
  size = 'md',
  aspectRatio = 'auto',
  source,
  isYouTube,
  className = '',
  showAmbientGlow = false,
  isPlaying = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const [fallbackAttempt, setFallbackAttempt] = useState(0);

  // Reset error state on src change
  useEffect(() => {
    setHasError(false);
    setFallbackAttempt(0);
  }, [src]);

  // Determine if this is a YouTube thumbnail dynamically:
  // 16:9 for YouTube thumbnails, 1:1 for standard track artwork
  const isYouTubeThumbnail = Boolean(
    aspectRatio === 'video' ||
    aspectRatio === '16:9' ||
    (aspectRatio !== 'square' &&
      aspectRatio !== '1:1' &&
      (isYouTube ||
        source === 'youtube' ||
        (typeof src === 'string' &&
          (src.includes('ytimg.com') ||
            src.includes('youtube.com') ||
            src.includes('youtu.be') ||
            src.includes('/vi/')))))
  );

  const finalAspect = isYouTubeThumbnail ? 'video' : 'square';

  // Avoid unverified external placeholders
  const isInvalidUrl = !src || src.includes('images.unsplash.com') || src.includes('placeholder.com');
  const shouldUseFallback = hasError || isInvalidUrl;

  const palette = getPaletteForString(alt || 'Music Track');

  // Dynamic responsive sizing classes:
  // 16:9 for YouTube thumbnails adapts naturally without being squashed into square box
  const sizeClasses = {
    sm: isYouTubeThumbnail ? 'h-10 aspect-video rounded-xl' : 'w-10 h-10 aspect-square rounded-xl',
    md: isYouTubeThumbnail ? 'h-12 aspect-video rounded-2xl' : 'w-12 h-12 aspect-square rounded-2xl',
    lg: isYouTubeThumbnail ? 'h-32 sm:h-36 aspect-video rounded-2xl' : 'w-32 h-32 sm:w-36 sm:h-36 aspect-square rounded-2xl',
    xl: isYouTubeThumbnail ? 'w-full max-w-[280px] sm:max-w-sm md:max-w-md aspect-video rounded-3xl' : 'w-48 h-48 sm:w-56 sm:h-56 aspect-square rounded-3xl',
    full: isYouTubeThumbnail ? 'w-full aspect-video rounded-2xl' : 'w-full aspect-square rounded-2xl',
  }[size];

  const aspectClass = isYouTubeThumbnail ? 'aspect-video' : 'aspect-square';

  const handleImageError = () => {
    // If a YouTube maxresdefault thumbnail fails, try hqdefault or mqdefault
    if (src && src.includes('maxresdefault.jpg') && fallbackAttempt === 0) {
      setFallbackAttempt(1);
      return;
    }
    if (src && src.includes('hqdefault.jpg') && fallbackAttempt === 1) {
      setFallbackAttempt(2);
      return;
    }
    setHasError(true);
  };

  const getEffectiveSrc = () => {
    if (!src) return '';
    if (fallbackAttempt === 1) {
      return src.replace('maxresdefault.jpg', 'hqdefault.jpg');
    }
    if (fallbackAttempt === 2) {
      return src.replace('hqdefault.jpg', 'mqdefault.jpg');
    }
    return src;
  };

  const effectiveSrc = getEffectiveSrc();

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {/* Apple Music Ambient Reflection Glow matching dynamic aspect ratio */}
      {showAmbientGlow && !shouldUseFallback && effectiveSrc && (
        <div
          aria-hidden="true"
          className={`absolute -inset-3 rounded-3xl opacity-40 blur-2xl pointer-events-none transition-all duration-700 ${aspectClass}`}
          style={{
            backgroundImage: `url(${effectiveSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Main Artwork Container with Dynamic Aspect Ratio */}
      <div
        className={`relative overflow-hidden bg-neutral-900 border border-white/[0.1] shadow-lg flex items-center justify-center transition-all duration-300 ${sizeClasses} ${aspectClass}`}
      >
        {shouldUseFallback ? (
          /* Apple Music Procedural Gradient Sleeve (Gracefully renders in 16:9 or 1:1) */
          <div
            className={`w-full h-full bg-gradient-to-br ${palette} flex flex-col items-center justify-center p-2 text-white/90 relative overflow-hidden`}
          >
            {/* Subtle Vinyl Grooves */}
            <div className="absolute inset-0 opacity-15 pointer-events-none flex items-center justify-center">
              <div className="absolute w-3/4 h-3/4 rounded-full border border-white" />
              <div className="absolute w-1/2 h-1/2 rounded-full border border-white" />
              <div className="absolute w-1/4 h-1/4 rounded-full border border-white" />
            </div>

            <Music2 className="w-8 h-8 opacity-80 drop-shadow" />
            <span className="text-[10px] font-bold tracking-tight text-center line-clamp-1 mt-1 opacity-90 px-2 max-w-full">
              {alt}
            </span>
            {isYouTubeThumbnail && (
              <span className="text-[8px] font-semibold tracking-wider uppercase text-white/60 bg-black/30 px-1.5 py-0.5 rounded mt-0.5">
                16:9 Video
              </span>
            )}
          </div>
        ) : (
          <img
            src={effectiveSrc}
            alt={alt}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            loading="lazy"
          />
        )}

        {/* Dynamic Aspect Ratio Indicator Badge for full/xl previews */}
        {isYouTubeThumbnail && (size === 'lg' || size === 'xl') && !shouldUseFallback && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-md text-[9px] font-bold tracking-wider text-white/80 border border-white/10 uppercase pointer-events-none">
            16:9
          </div>
        )}

        {/* Animated Visualizer Overlay if Playing */}
        {isPlaying && (
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[1px] flex items-end justify-between p-2 pointer-events-none">
            <div className="flex items-end gap-0.5 h-3">
              <span className="w-0.5 bg-white rounded-full animate-bounce h-2" />
              <span className="w-0.5 bg-white rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
              <span className="w-0.5 bg-white rounded-full animate-bounce h-1.5" style={{ animationDelay: '300ms' }} />
            </div>
            <Disc3 className="w-3.5 h-3.5 text-white/80 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};
