
import React, { useState, useEffect, useRef } from 'react';
import { HelpContext, UserProfile, Language, TRANSLATIONS } from '../types';
import { createHelpSession, cleanTextOutput } from '../services/geminiService';
import { GlassCard } from './GlassCard';
import { X, Loader2, Bot, Send, Split, Sparkles, Feather, User, ArrowUp } from 'lucide-react';

interface ContextHelpOverlayProps {
  context: HelpContext;
  profile: UserProfile;
  lang: Language;
  onClose: () => void;
}

interface ThreadMessage {
  role: 'model' | 'user';
  text: string;
}

export const ContextHelpOverlay: React.FC<ContextHelpOverlayProps> = ({ context, profile, lang, onClose }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions = lang === 'ru' ? [
    { text: "На шаги", icon: <Split size={8}/> },
    { text: "Проще", icon: <Feather size={8}/> },
    { text: "Начать?", icon: <Sparkles size={8}/> }
  ] : [
    { text: "Steps", icon: <Split size={8}/> },
    { text: "Easier", icon: <Feather size={8}/> },
    { text: "Start?", icon: <Sparkles size={8}/> }
  ];

  useEffect(() => {
    const initSession = async () => {
      setLoading(true);
      try {
        const session = createHelpSession(context, profile, lang);
        sessionRef.current = session;
        const result = await session.sendMessage({ message: "Привет. Дай ОЧЕНЬ короткий совет (1 предложение) по этой задаче." });
        setMessages([{ role: 'model', text: cleanTextOutput(result.text || "") }]);
      } catch (e) {
        setMessages([{ role: 'model', text: "Error." }]);
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, [context, profile, lang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || inputValue.trim();
    if (!text || loading || !sessionRef.current) return;
    
    setMessages(prev => [...prev, { role: 'user', text: text }]);
    setInputValue('');
    setLoading(true);

    try {
        const result = await sessionRef.current.sendMessage({ message: text + " (Ответь кратко)" });
        setMessages(prev => [...prev, { role: 'model', text: cleanTextOutput(result.text || "") }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "Error." }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div 
        onClick={onClose}
        className="fixed inset-0 z-[700] flex flex-col items-center pointer-events-auto"
    >
      {/* Invisible backdrop to catch clicks outside */}
      <div className="absolute inset-0 bg-transparent" />

      <style>{`
        @keyframes popUp {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-pop-up {
          animation: popUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      
      {/* 
         Positioning logic based on user request:
         "Top boundary MANDATORY at 3/4 screen" -> top-[65%] (approx 3/4 visual start)
         "Shrink 1.5x" -> w-[240px] h-[200px]
         "Input after 1/4 screen" -> naturally falls at bottom of this window
      */}
      <div 
        onClick={e => e.stopPropagation()}
        className="fixed top-[60%] left-1/2 -translate-x-1/2 w-[240px] h-[210px] animate-pop-up shadow-2xl z-[710]"
      >
        <GlassCard className="w-full h-full bg-[var(--bg-main)]/95 border-[var(--border-glass)] flex flex-col overflow-hidden rounded-[20px] p-0 shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
            {/* Ultra Compact Header */}
            <div className="flex justify-between items-center px-2 py-1.5 border-b border-[var(--border-glass)] bg-white/5 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Bot size={10} className="text-[var(--theme-accent)]" />
                    <span className="text-[9px] font-black text-[var(--text-primary)] uppercase tracking-wider truncate max-w-[150px]">{context.blockName}</span>
                </div>
                <button onClick={onClose} className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-white"><X size={10} /></button>
            </div>

            {/* Chat Content - Dense */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-hide bg-black/20">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                        <div className={`max-w-[95%] px-2 py-1 rounded-[8px] text-[10px] leading-snug whitespace-pre-wrap shadow-sm border ${
                            msg.role === 'user' 
                            ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] border-transparent' 
                            : 'bg-[#1A1A1E] text-[var(--text-primary)] border-white/5'
                        }`}>
                            {msg.text}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start px-1">
                         <div className="bg-[#1A1A1E] px-2 py-1 rounded-[8px] border border-white/5 flex items-center gap-1.5">
                            <Loader2 className="w-2.5 h-2.5 animate-spin text-[var(--theme-accent)]" />
                            <span className="text-[8px] text-[var(--text-secondary)]">...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Action Area - Compact */}
            <div className="p-1.5 bg-[var(--bg-main)] border-t border-[var(--border-glass)] shrink-0 space-y-1.5">
                <div className="flex flex-wrap gap-1 justify-center">
                    {quickActions.map((action, i) => (
                    <button 
                        key={i} 
                        onClick={() => handleSend(action.text)}
                        disabled={loading}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-[var(--border-glass)] text-[7px] text-[var(--text-secondary)] font-bold uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap"
                    >
                        {action.icon}
                        {action.text}
                    </button>
                    ))}
                </div>

                <div className="relative flex items-center gap-1 bg-black/20 border border-[var(--border-glass)] rounded-[12px] px-1 py-0.5 shadow-inner focus-within:border-[var(--theme-accent)]/50 transition-all w-full">
                    <input 
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder={lang === 'ru' ? "Вопрос..." : "Ask..."}
                        className="flex-1 bg-transparent border-none text-[10px] text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-secondary)]/50 py-1 px-2 font-medium h-6"
                    />
                    <button 
                        onClick={() => handleSend()}
                        disabled={!inputValue.trim() || loading}
                        className={`w-5 h-5 rounded-[8px] flex items-center justify-center transition-all ${
                            inputValue.trim() ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)]' : 'text-[var(--text-secondary)] opacity-50'
                        }`}
                    >
                        {inputValue.trim() ? <ArrowUp size={10} strokeWidth={3} /> : <Send size={8} />}
                    </button>
                </div>
            </div>
        </GlassCard>
      </div>
    </div>
  );
};
