import React, { useState } from 'react';

export interface AppleSliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  accentColor?: 'orange' | 'white' | 'blue' | 'purple' | 'green' | 'red';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
  valueDisplay?: string | React.ReactNode;
  className?: string;
  showValueBadge?: boolean;
  minLabel?: string;
  maxLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

const ACCENT_COLORS = {
  orange: '#ff9500',
  white: '#ffffff',
  blue: '#0a84ff',
  purple: '#af52de',
  green: '#30d158',
  red: '#ff453a',
};

export const AppleSlider: React.FC<AppleSliderProps> = ({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  accentColor = 'orange',
  leftIcon,
  rightIcon,
  label,
  valueDisplay,
  className = '',
  showValueBadge = false,
  minLabel,
  maxLabel,
  size = 'md',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate percentage for CSS background fill
  const range = max - min;
  const safeValue = Number.isFinite(value) ? value : min;
  const percent = range > 0 ? Math.min(100, Math.max(0, ((safeValue - min) / range) * 100)) : 0;
  const colorHex = ACCENT_COLORS[accentColor] || ACCENT_COLORS.orange;

  const trackHeight = size === 'sm' ? 'h-1' : size === 'lg' ? 'h-2.5' : 'h-1.5';
  const thumbSize = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;

  return (
    <div className={`w-full select-none ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}>
      {/* Optional Top Header with Label & Value Badge */}
      {(label || valueDisplay || showValueBadge) && (
        <div className="flex items-center justify-between text-xs mb-1.5">
          {label && (
            <span className="font-medium text-[#86868b] flex items-center gap-1.5">
              {label}
            </span>
          )}
          {valueDisplay ? (
            <span className="font-mono text-xs font-semibold" style={{ color: colorHex }}>
              {valueDisplay}
            </span>
          ) : showValueBadge ? (
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold"
              style={{
                backgroundColor: `${colorHex}20`,
                color: colorHex,
                border: `1px solid ${colorHex}40`,
              }}
            >
              {safeValue}
            </span>
          ) : null}
        </div>
      )}

      {/* Main Slider Track with Icons */}
      <div
        className="flex items-center gap-3 relative py-1"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsDragging(false);
        }}
      >
        {leftIcon && <div className="shrink-0 text-neutral-400">{leftIcon}</div>}

        <div className="relative flex-1 flex items-center">
          {/* Custom Visual Track Background with Dynamic Two-Tone Fill */}
          <div
            className={`w-full ${trackHeight} rounded-full overflow-hidden pointer-events-none transition-all duration-75`}
            style={{
              background: `linear-gradient(to right, ${colorHex} 0%, ${colorHex} ${percent}%, rgba(255, 255, 255, 0.18) ${percent}%, rgba(255, 255, 255, 0.18) 100%)`,
            }}
          />

          {/* Interactive Range Input - invisible surface with cursor pointer */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={safeValue}
            disabled={disabled}
            onChange={(e) => onChange(Number(e.target.value))}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            aria-label={label || 'Range slider'}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            style={{
              margin: 0,
              padding: 0,
            }}
          />

          {/* Apple Tactile Thumb Knob with Ambient Shadow */}
          <div
            className="absolute pointer-events-none transition-transform duration-75 ease-out rounded-full shadow-lg"
            style={{
              left: `${percent}%`,
              transform: `translateX(-50%) scale(${isDragging ? 1.25 : isHovered ? 1.12 : 1})`,
              width: `${thumbSize}px`,
              height: `${thumbSize}px`,
              backgroundColor: '#ffffff',
              boxShadow: isDragging
                ? `0 3px 12px rgba(0, 0, 0, 0.6), 0 0 0 2px ${colorHex}`
                : '0 2px 8px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.1)',
            }}
          />
        </div>

        {rightIcon && <div className="shrink-0 text-neutral-400">{rightIcon}</div>}
      </div>

      {/* Optional Min / Max Bottom Labels */}
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-[11px] font-mono text-[#86868b] mt-1 px-0.5">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
};
