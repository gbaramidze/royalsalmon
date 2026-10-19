import React from 'react';

export interface RoyalSalmonLogoProps {
  size?: number; // legacy alias for height
  height?: number | string;
  width?: number | string;
  className?: string;
  style?: React.CSSProperties;
  showText?: boolean; // backwards compatibility
  alt?: string;
}

/**
 * Official Royal Salmon Logo
 * Uses the official brand logo from public/images/logo/logo.png
 * Features the signature teal crown emblem and bilingual brand typography.
 */
export function RoyalSalmonLogo({ 
  size, 
  height, 
  className = '', 
  style, 
  alt = 'Royal Salmon • Батуми'
}: RoyalSalmonLogoProps) {
  const resolvedHeight = height !== undefined ? height : (size !== undefined ? size : 34);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/logo/logo.png"
      alt={alt}
      className={`royal-salmon-official-logo ${className}`}
      style={{
        height: resolvedHeight,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'block',
        ...style,
      }}
    />
  );
}

export default RoyalSalmonLogo;
