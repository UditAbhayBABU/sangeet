export interface MoodTheme {
  name: string;
  gradient: string;
  borderGradient: string;
  glowColor: string;
  accentColor: string;
  badgeBg: string;
  iconEmoji: string;
  textColor: string;
}

export function getMoodTheme(detectedMood?: string): MoodTheme {
  const m = (detectedMood || '').toLowerCase();

  // 1. Party / Dance / Upbeat
  if (m.includes('party') || m.includes('dance') || m.includes('beat')) {
    return {
      name: 'Party & Dance',
      gradient: 'from-amber-400 via-rose-500 to-purple-600',
      borderGradient: 'from-amber-400 via-rose-500 to-purple-600',
      glowColor: 'rgba(244, 63, 94, 0.45)',
      accentColor: '#f43f5e',
      badgeBg: 'bg-rose-500/25 text-rose-200 border-rose-500/40',
      iconEmoji: '🔥',
      textColor: 'text-rose-400',
    };
  }

  // 2. Romantic / Love Melodies
  if (m.includes('romantic') || m.includes('love') || m.includes('melody')) {
    return {
      name: 'Romantic Melody',
      gradient: 'from-pink-500 via-rose-500 to-red-400',
      borderGradient: 'from-pink-400 via-rose-500 to-red-500',
      glowColor: 'rgba(236, 72, 153, 0.45)',
      accentColor: '#ec4899',
      badgeBg: 'bg-pink-500/25 text-pink-200 border-pink-500/40',
      iconEmoji: '💖',
      textColor: 'text-pink-400',
    };
  }

  // 3. Devotional / Bhakti / Spiritual
  if (m.includes('devotional') || m.includes('spiritual') || m.includes('bhakti')) {
    return {
      name: 'Devotional & Calm',
      gradient: 'from-amber-400 via-orange-500 to-yellow-500',
      borderGradient: 'from-amber-300 via-orange-400 to-yellow-400',
      glowColor: 'rgba(245, 158, 11, 0.45)',
      accentColor: '#f59e0b',
      badgeBg: 'bg-amber-500/25 text-amber-200 border-amber-500/40',
      iconEmoji: '🧘',
      textColor: 'text-amber-400',
    };
  }

  // 4. Sad / Soulful / Heartbreak
  if (m.includes('sad') || m.includes('soulful') || m.includes('heartbreak')) {
    return {
      name: 'Soulful & Melancholic',
      gradient: 'from-blue-500 via-indigo-500 to-cyan-400',
      borderGradient: 'from-blue-400 via-indigo-400 to-cyan-400',
      glowColor: 'rgba(59, 130, 246, 0.45)',
      accentColor: '#3b82f6',
      badgeBg: 'bg-blue-500/25 text-blue-200 border-blue-500/40',
      iconEmoji: '🌧️',
      textColor: 'text-blue-400',
    };
  }

  // 5. Sufi / Ghazal / Acoustic
  if (m.includes('sufi') || m.includes('ghazal')) {
    return {
      name: 'Sufi & Ghazal Vibe',
      gradient: 'from-teal-400 via-emerald-500 to-cyan-500',
      borderGradient: 'from-teal-300 via-emerald-400 to-cyan-400',
      glowColor: 'rgba(20, 184, 166, 0.45)',
      accentColor: '#14b8a6',
      badgeBg: 'bg-teal-500/25 text-teal-200 border-teal-500/40',
      iconEmoji: '✨',
      textColor: 'text-teal-400',
    };
  }

  // 6. Punjabi / Desi Beats
  if (m.includes('punjabi') || m.includes('desi')) {
    return {
      name: 'Punjabi & Desi Beats',
      gradient: 'from-amber-500 via-orange-600 to-red-600',
      borderGradient: 'from-amber-400 via-orange-500 to-red-500',
      glowColor: 'rgba(249, 115, 22, 0.45)',
      accentColor: '#f97316',
      badgeBg: 'bg-orange-500/25 text-orange-200 border-orange-500/40',
      iconEmoji: '🥁',
      textColor: 'text-orange-400',
    };
  }

  // Default / 90s Hits Mix:
  return {
    name: '90s Hits / Forecourt Mix',
    gradient: 'from-red-600 via-orange-500 to-amber-500',
    borderGradient: 'from-red-500 via-orange-400 to-amber-400',
    glowColor: 'rgba(255, 149, 0, 0.45)',
    accentColor: '#ff9500',
    badgeBg: 'bg-orange-500/25 text-orange-200 border-orange-500/40',
    iconEmoji: '📻',
    textColor: 'text-orange-400',
  };
}
