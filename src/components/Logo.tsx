import { useState } from 'react';
import { Church } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'front' | 'back' | 'standard';
}

export default function Logo({ className = '', size = 48, variant = 'standard' }: LogoProps) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div 
        className={`${className} flex items-center justify-center rounded-full bg-gradient-to-br from-church-navy to-slate-900 text-church-gold border border-church-gold/30 shadow-xs font-serif font-black shrink-0`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        title="AD Boas Novas"
      >
        <Church style={{ width: size * 0.55, height: size * 0.55 }} className="text-church-gold" />
      </div>
    );
  }

  return (
    <img
      src="/logo.png"
      alt="Logo AD Boas Novas"
      onError={() => setImgError(true)}
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
