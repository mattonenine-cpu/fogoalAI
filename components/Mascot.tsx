
import React from 'react';

interface MascotProps {
  size?: number;
  className?: string;
  mood?: 'Great' | 'Good' | 'Okay' | 'Tired' | 'Stress';
  level?: number;
}

export const Mascot: React.FC<MascotProps> = ({ size = 40, className = "", mood = 'Good', level = 1 }) => {
  const isHappy = mood === 'Great' || mood === 'Good';
  const isNeutral = mood === 'Okay';
  const isSad = mood === 'Tired' || mood === 'Stress';

  // Evolution logic
  const tier = level >= 20 ? 'divine' : level >= 10 ? 'master' : level >= 5 ? 'pro' : 'base';

  return (
    <div style={{ width: size, height: size }} className={`relative flex items-center justify-center select-none ${className}`}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Silver-Blue Steel Gradient */}
          <linearGradient id="orb_base" x1="50" y1="0" x2="50" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={tier === 'divine' ? "#FDE047" : tier === 'master' ? "#CBD5E1" : "#B0C4DE"} /> 
            <stop offset="100%" stopColor={tier === 'divine' ? "#EA580C" : tier === 'master' ? "#475569" : "#4682B4"} />
          </linearGradient>

          {/* Inner Depth Glow */}
          <radialGradient id="inner_glow" cx="50" cy="50" r="45" fx="50" fy="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity="0.4" />
            <stop offset="100%" stopColor="black" stopOpacity="0.1" />
          </radialGradient>

          {/* Top Gloss */}
          <linearGradient id="top_shine" x1="50" y1="10" x2="50" y2="50" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          
          {/* Pro Glow (Level 5+) */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Level Aura */}
        {tier !== 'base' && (
          <circle 
            cx="50" cy="50" r="48" 
            fill="none" 
            stroke={tier === 'pro' ? '#93C5FD' : tier === 'master' ? '#F8FAFC' : '#FACC15'} 
            strokeWidth="1" 
            strokeDasharray="4 2"
            opacity="0.3"
            className="animate-spin"
            style={{ animationDuration: '10s' }}
          />
        )}

        {/* 1. Main Orb Body */}
        <circle cx="50" cy="50" r="46" fill="url(#orb_base)" filter={tier !== 'base' ? "url(#glow)" : ""} />
        <circle cx="50" cy="50" r="46" fill="url(#inner_glow)" />
        
        {/* 2. Top Highlight */}
        <ellipse cx="50" cy="28" rx="32" ry="18" fill="url(#top_shine)" />

        {/* 3. Adaptive Face */}
        <g stroke={tier === 'divine' ? "#451a03" : "#2C3E50"} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
            {/* Eyes */}
            {isHappy ? (
              <>
                <path d="M30 48C30 44 38 44 38 48" />
                <path d="M62 48C62 44 70 44 70 48" />
              </>
            ) : (
              <>
                <circle cx="34" cy="48" r="1" fill={tier === 'divine' ? "#451a03" : "#2C3E50"} />
                <circle cx="66" cy="48" r="1" fill={tier === 'divine' ? "#451a03" : "#2C3E50"} />
              </>
            )}

            {/* Mouth */}
            {isHappy && <path d="M34 62C34 62 42 72 50 72C58 72 66 62 66 62" />}
            {isNeutral && <path d="M38 66H62" />}
            {isSad && <path d="M34 72C34 72 42 62 50 62C58 62 66 72 66 72" />}
        </g>
        
        {/* Tier Specific Decoration */}
        {tier === 'pro' && <path d="M45 15 L50 5 L55 15" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" opacity="0.5" />}
        {tier === 'master' && (
          <g transform="translate(42, 5) scale(0.6)" opacity="0.6">
             <path d="M0 10 L8 0 L16 10 L24 0 L32 10" stroke="white" strokeWidth="3" fill="none" />
          </g>
        )}
        {tier === 'divine' && (
           <circle cx="50" cy="50" r="50" fill="none" stroke="#FACC15" strokeWidth="0.5" strokeDasharray="1 3" className="animate-pulse" />
        )}
        
        {/* Sub-Highlights for Glassy Look */}
        <circle cx="75" cy="25" r="3" fill="white" fillOpacity="0.4" />
      </svg>
    </div>
  );
};
