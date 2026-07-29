import { useState } from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'front' | 'back' | 'standard';
}

export default function Logo({ className = '', size = 48, variant = 'standard' }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Logo AD Boas Novas"
      referrerPolicy="no-referrer"
      className={`${className} object-cover rounded-full bg-transparent`}
      style={{ 
        width: size, 
        height: size, 
        minWidth: size, 
        minHeight: size,
        background: 'none',
        backgroundColor: 'transparent'
      }}
    />
  );
}
