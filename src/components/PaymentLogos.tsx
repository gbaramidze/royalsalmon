import React from 'react';

interface LogoProps {
  width?: number;
  height?: number;
}

function CardBrandBadge({ src, title, width, height, inset }: Required<LogoProps> & { src: string; title: string; inset: number }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FFFFFF',
        borderRadius: 6,
        border: '1px solid rgba(0,0,0,0.1)',
        padding: '3px 8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}
      title={title}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title}
        width={width}
        height={height}
        style={{ width, height, objectFit: 'contain', padding: inset, boxSizing: 'border-box', display: 'block' }}
      />
    </div>
  );
}

export function VisaLogo({ width = 48, height = 30 }: LogoProps) {
  return <CardBrandBadge src="/images/payments/visa.svg" title="Visa" width={width} height={height} inset={3} />;
}

export function MastercardLogo({ width = 48, height = 30 }: LogoProps) {
  return <CardBrandBadge src="/images/payments/mastercard.svg" title="Mastercard" width={width} height={height} inset={3} />;
}

export function PaymentBadges({ className = '' }: { className?: string }) {
  return (
    <div className={`payment-badges-row ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <VisaLogo />
      <MastercardLogo />
    </div>
  );
}
