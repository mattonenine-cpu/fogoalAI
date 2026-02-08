
import React from 'react';
import { Mascot } from './Mascot';

interface LogoProps {
  height?: number;
  className?: string;
  mood?: 'Great' | 'Good' | 'Okay' | 'Tired' | 'Stress';
  level?: number;
}

export const Logo: React.FC<LogoProps> = ({ height = 32, className = "", mood = 'Good', level = 1 }) => {
  const gradientStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #B0C4DE 0%, #4682B4 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: height,
    lineHeight: 1,
    display: 'inline-block',
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
    fontWeight: 300,
    letterSpacing: '-0.02em'
  };

  return (
    <div className={`flex items-center gap-0.5 select-none ${className}`}>
      <span 
        className="tracking-tight" 
        style={gradientStyle}
      >
        FoG
      </span>
      
      <div className="relative flex items-center justify-center -mx-1">
        <Mascot size={height * 1.05} mood="Good" level={level} />
      </div>

      <span 
        className="tracking-tight" 
        style={gradientStyle}
      >
        al
      </span>
    </div>
  );
};
