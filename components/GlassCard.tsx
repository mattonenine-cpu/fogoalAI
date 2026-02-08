
import React, { forwardRef } from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, ...props }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        glass-liquid
        rounded-[32px]
        p-4
        text-[var(--text-primary)]
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const GlassInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input
    ref={ref}
    {...props}
    className={`
      w-full bg-black/5 border border-white/10 rounded-2xl px-4 py-3
      text-[var(--text-primary)] placeholder-slate-400 text-[13px] focus:outline-none focus:bg-black/10 focus:border-[var(--theme-accent)]
      transition-all duration-300 backdrop-blur-3xl
      hover:bg-black/10
      ${props.className}
    `}
  />
));
GlassInput.displayName = 'GlassInput';

export const GlassTextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>((props, ref) => (
  <textarea
    ref={ref}
    {...props}
    className={`
      w-full bg-black/5 border border-white/10 rounded-2xl px-4 py-3
      text-[var(--text-primary)] placeholder-slate-400 text-[13px] focus:outline-none focus:bg-black/10 focus:border-[var(--theme-accent)]
      transition-all duration-300 backdrop-blur-3xl resize-none
      hover:bg-black/10
      ${props.className}
    `}
  />
));
GlassTextArea.displayName = 'GlassTextArea';

export const GlassButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }> = ({ variant = 'primary', className, ...props }) => {
  const baseStyles = "px-5 py-3 rounded-full font-black transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 btn-liquid backdrop-blur-3xl text-[11px] uppercase tracking-widest border border-white/10 shadow-lg";
  
  const variants = {
    primary: "bg-[var(--theme-gradient)] text-white hover:opacity-95 shadow-[0_10px_30px_rgba(0,0,0,0.2)]",
    secondary: "bg-white/10 hover:bg-white/20 text-[var(--text-primary)]",
    danger: "bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-rose-500/20"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {props.children}
    </button>
  );
};
