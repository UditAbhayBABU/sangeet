import React from 'react';

interface AppIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero' | number;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  title?: string;
  showShadow?: boolean;
}

const SIZE_MAP = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 72,
  hero: 104,
};

export const AppIcon: React.FC<AppIconProps> = ({
  size = 'md',
  className = '',
  interactive = false,
  onClick,
  title = 'Sangeet',
  showShadow = true,
}) => {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 40;
  
  // Calculate proportional Apple continuous curvature squircle radius (r ≈ 22.3% of width)
  const borderRadius = Math.max(6, Math.round(pixelSize * 0.223));

  const content = (
    <div
      style={{
        width: pixelSize,
        height: pixelSize,
        borderRadius: `${borderRadius}px`,
      }}
      className={`relative shrink-0 overflow-hidden select-none transition-transform duration-200 bg-black ${
        showShadow ? 'shadow-lg shadow-black/60' : ''
      } ${
        interactive
          ? 'active:scale-95 hover:scale-[1.02] hover:brightness-105 cursor-pointer'
          : ''
      } ${className}`}
      title={title}
      onClick={onClick}
    >
      <img
        src="/icon-512.png"
        alt="Sangeet App Icon"
        width={pixelSize}
        height={pixelSize}
        className="w-full h-full object-cover pointer-events-none"
        loading="eager"
      />
    </div>
  );

  return content;
};

export default AppIcon;
