
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage, Language, TRANSLATIONS, Task, Category } from '../types';
import { getLocalISODate, generateFocuVisual, createChatSession, cleanTextOutput } from '../services/geminiService';
import { Bot, User, Loader2, X, AlertTriangle, Key, ArrowUp, Trash2 } from 'lucide-react';

interface ChatInterfaceProps {
  userProfile: UserProfile;
  lang: Language;
  tasks: Task[];
  onSetTasks: React.Dispatch<React.SetStateAction<Task[]>>;
}

// --- Text Rendering Helpers ---
const parseBold = (text: string, isUser: boolean) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={idx} className={isUser ? 'text-white font-black' : 'text-[var(--theme-accent)] font-black'}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

const renderMessageContent = (text: string, isUser: boolean) => {
    return text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
            const content = trimmed.replace(/^#+\s+/, '');
            return <h3 key={i} className={`text-xs font-black uppercase tracking-widest mt-3 mb-1 ${isUser ? 'text-white' : 'text-[var(--theme-accent)]'}`}>{parseBold(content, isUser)}</h3>;
        }
        
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
             return (
                <div key={i} className="flex gap-2 pl-2 mb-1">
                    <span className={`font-black ${isUser ? 'text-white/60' : 'text-[var(--theme-accent)]'}`}>•</span>
                    <span className="text-[13px] leading-relaxed">{parseBold(trimmed.replace(/^[\-\*]\s+/, ''), isUser)}</span>
                </div>
            );
        }

        return <p key={i} className="text-[13px] leading-relaxed mb-1">{parseBold(line, isUser)}</p>;
    });
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ userProfile, lang, tasks, onSetTasks }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const MAX_HISTORY = 50;
  
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('focu_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })).slice(-MAX_HISTORY);
      }
    } catch (e) { console.error("Chat history recovery failed", e); }
    return [];
  });

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatSessionRef = useRef<any>(null);

  useEffect(() => {
    if (messages.length === 0) {
      const name = userProfile.name?.trim();
      let initText = t.chatInit.replace('{name}', name || (lang === 'ru' ? 'друг' : 'friend'));
      setMessages([{ id: 'init', role: 'model', text: initText, timestamp: new Date() }]);
    }
  }, [userProfile.name, lang, t.chatInit, messages.length]);

  useEffect(() => {
    try {
        localStorage.setItem('focu_chat_history', JSON.stringify(messages));
    } catch (e) {
        console.warn('Failed to save chat history');
    }
  }, [messages]);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading]);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  const handleClearHistory = () => {
    if (window.confirm(lang === 'ru' ? "Очистить историю чата?" : "Clear chat history?")) {
      const name = userProfile.name?.trim() || (lang === 'ru' ? 'друг' : 'friend');
      setMessages([{ id: 'init', role: 'model', text: t.chatInit.replace('{name}', name), timestamp: new Date() }]);
      try { 
          localStorage.removeItem('focu_chat_history'); 
          chatSessionRef.current = null;
      } catch(e){}
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;
    const textToSend = inputValue.trim();
    
    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend, timestamp: new Date() };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsLoading(true);
    setQuotaError(false);

    try {
        // Initialize or reuse session
        if (!chatSessionRef.current) {
            const historyForSdk = messages
                .filter(msg => msg.text && msg.text.trim().length > 0)
                .map(msg => ({ 
                    role: msg.role === 'user' ? 'user' : 'model', 
                    parts: [{ text: msg.text }] 
                }));
            chatSessionRef.current = createChatSession(userProfile, historyForSdk, lang, tasks);
        }

        const result = await chatSessionRef.current.sendMessage({ message: textToSend });

        if (result.text) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: result.text, timestamp: new Date() }]);
        }
    } catch (error: any) {
        console.error("Chat Error:", error);
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: t.chatError, timestamp: new Date() }]);
    } finally { 
        setIsLoading(false); 
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="h-full flex flex-col animate-fadeIn">
       <div className="flex justify-end px-2 py-1">
          <button onClick={handleClearHistory} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all text-[10px] font-bold uppercase tracking-wider active:scale-95">
            <Trash2 size={12} /> {lang === 'ru' ? 'Очистить' : 'Clear'}
          </button>
       </div>

       <div className="flex-1 overflow-y-auto space-y-4 pr-1 pt-2 scrollbar-hide pb-32">
         {messages.map((msg) => (
           <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'model' ? 'bg-[var(--theme-accent)]/20 text-[var(--theme-accent)]' : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'}`}>
               {msg.role === 'model' ? <Bot size={16} /> : <User size={16} />}
             </div>
             <div className="flex flex-col gap-1 max-w-[85%]">
                 {msg.text && (
                    <div className={`px-4 py-3 rounded-[20px] shadow-sm ${msg.role === 'user' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-tr-md' : 'bg-[var(--bg-card)] text-[var(--text-primary)] rounded-tl-md border border-[var(--border-glass)]'}`}>
                        {renderMessageContent(msg.text, msg.role === 'user')}
                    </div>
                 )}
                 {msg.imageData && (
                     <div className="rounded-[24px] overflow-hidden border border-[var(--border-glass)] bg-[var(--bg-card)] shadow-2xl animate-fade-in-up mt-1">
                         <img src={msg.imageData} className="w-full h-auto object-cover" alt="AI Generated" />
                     </div>
                 )}
                 <span className={`text-[8px] uppercase tracking-widest font-bold opacity-30 mt-0.5 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                 </span>
             </div>
           </div>
         ))}
         
         {isLoading && (
            <div className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-card)] flex items-center justify-center"><Bot size={16} className="text-[var(--theme-accent)]"/></div>
                <div className="bg-[var(--bg-card)] px-4 py-3 rounded-[20px] rounded-tl-md flex items-center gap-2 text-[10px] text-[var(--theme-accent)] border border-[var(--border-glass)]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>{t.thinking}</span>
                </div>
            </div>
         )}
         <div ref={messagesEndRef} className="h-1" />
       </div>

       <div className="fixed bottom-[100px] left-0 right-0 z-50 px-4 w-full flex justify-center pointer-events-none">
         <div className="relative flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] p-1 shadow-2xl focus-within:border-white/20 transition-all max-w-[340px] w-full pointer-events-auto backdrop-blur-xl">
           <textarea 
             ref={textareaRef} 
             value={inputValue} 
             onChange={e => setInputValue(e.target.value)} 
             onKeyDown={handleKeyDown} 
             placeholder={t.chatPlaceholder} 
             className="w-full bg-transparent border-none focus:ring-0 resize-none text-[13px] leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] py-2.5 text-center px-4 focus:outline-none scrollbar-hide font-medium" 
             rows={1} 
           />
           <div className="flex shrink-0 items-center justify-center h-full pr-1.5">
             <button onClick={handleSend} disabled={isLoading || !inputValue.trim()} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${inputValue.trim() ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] opacity-50'}`}>
               <ArrowUp size={16} strokeWidth={3} />
             </button>
           </div>
         </div>
       </div>
    </div>
  );
};
