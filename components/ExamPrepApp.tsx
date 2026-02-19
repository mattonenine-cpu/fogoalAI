// ... imports unchanged ...
import React, { useState, useMemo, useEffect } from 'react';
import { Exam, Ticket, Term, UserProfile, Language, TRANSLATIONS, Flashcard, AppTheme } from '../types';
import { GlassCard, GlassInput, GlassTextArea } from './GlassCard';
import { parseTicketsFromText, cleanTextOutput, generateTicketNote, generateGlossaryAndCards, getLocalISODate, generateQuiz } from '../services/geminiService';
import { CreditsService } from '../services/creditsService';
import { ChevronRight, X, BookOpen, Bot, ChevronLeft, Sparkles, FileText, Trophy, Key, Loader2, Play, ArrowRight, Check, Star, CheckCircle2, Plus, Layers, BrainCircuit, RotateCcw, Trash2 } from 'lucide-react';
import { renderTextWithMath } from '../LatexRenderer';

// ... helper functions (getDaysLeft, NoteRenderer, renderBoldText) unchanged ...
const getDaysLeft = (dateStr: string) => {
  const target = new Date(dateStr);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const NoteRenderer: React.FC<{ text: string; lang: Language }> = ({ text }) => {
    const lines = text.split('\n');
    return (
        <div className="space-y-6 text-[var(--text-primary)] leading-relaxed font-medium">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-2" />;
                if (trimmed.startsWith('# ')) {
                    const content = trimmed.substring(2);
                    return (
                        <h1 key={idx} className="text-3xl font-black text-[var(--text-primary)] tracking-tight pt-2 border-b-2 border-indigo-500/30 pb-6 mb-8 text-center bg-gradient-to-r from-indigo-500/10 to-violet-500/10 rounded-2xl px-6 py-4">
                            {renderTextWithMath(content)}
                        </h1>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    const content = trimmed.substring(3);
                    return (
                        <div key={idx} className="pt-8 mt-4 mb-4">
                            <h2 className="text-xl font-black text-indigo-400 tracking-wide uppercase flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.4)]"></span>
                                {renderTextWithMath(content)}
                            </h2>
                        </div>
                    );
                }
                if (trimmed.startsWith('### ')) {
                    const content = trimmed.substring(4);
                    return <h3 key={idx} className="text-lg font-bold text-violet-300/95 tracking-tight mt-4">{renderTextWithMath(content)}</h3>;
                }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={idx} className="flex items-start gap-3 pl-2 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0 group-hover:scale-125 transition-transform shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <p className="text-[16px] leading-relaxed text-[var(--text-secondary)] flex-1">{renderTextWithMath(trimmed.substring(2))}</p>
                        </div>
                    );
                }
                return <p key={idx} className="text-[17px] leading-8 text-[var(--text-primary)] font-normal tracking-wide">{renderTextWithMath(trimmed)}</p>;
            })}
        </div>
    );
};

interface ExamPrepAppProps {
  user: UserProfile;
  lang: Language;
  onUpdateProfile: (profile: UserProfile) => void;
  theme: AppTheme;
  onDeductCredits?: (cost: number) => void;
}

export const ExamPrepApp: React.FC<ExamPrepAppProps> = ({ user, lang, onUpdateProfile, theme, onDeductCredits }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const isLightTheme = theme === 'white' || theme === 'ice';

  const [showWizard, setShowWizard] = useState(user.exams ? user.exams.length === 0 : true);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [ticketMode, setTicketMode] = useState<'note' | 'quiz' | 'result'>('note');
  
  const [hubTab, setHubTab] = useState<'tickets' | 'flashcards' | 'glossary'>('tickets');
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newExam, setNewExam] = useState<Partial<Exam>>({ id: Date.now().toString(), subject: '', date: getLocalISODate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)), tickets: [], progress: 0 });
  const [rawTicketsText, setRawTicketsText] = useState('');
  const [isWizardProcessing, setIsWizardProcessing] = useState(false);
  const [preparedExamData, setPreparedExamData] = useState<Exam | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Flashcard States
  const [showManualCardModal, setShowManualCardModal] = useState(false);
  const [manualCard, setManualCard] = useState({ question: '', answer: '', ticketId: '' });
  const [isFlashcardSession, setIsFlashcardSession] = useState(false);
  const [sessionQueue, setSessionQueue] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startSessionCount, setStartSessionCount] = useState(0);

  // Quiz States
  const [quizQuestions, setQuizQuestions] = useState<{question: string, options: string[], correctIndex: number, difficulty?: 'easy' | 'medium' | 'hard'}[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [currentQuizStep, setCurrentQuizStep] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCount, setQuizCount] = useState<3 | 5 | 10>(5);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [quizResult, setQuizResult] = useState<{ score: number; xp: number } | null>(null);

  const handleOpenKeySelection = async () => {
    if (typeof (window as any).aistudio?.openSelectKey === 'function') {
      await (window as any).aistudio.openSelectKey();
      setErrorStatus(null);
    }
  };

  const calculateExamProgress = (exam: Exam): number => {
    if (!exam || !exam.tickets || exam.tickets.length === 0) return 0;
    const cardsTotal = exam.flashcards?.length || 1;
    const cardsMastered = (exam.flashcards || []).filter(f => f.status === 'mastered').length;
    const cardsWeight = (cardsMastered / cardsTotal) * 30;
    const ticketsTested = (exam.tickets || []).filter(t => t.lastScore !== undefined).length;
    const ticketsWeight = (exam.tickets || []).length > 0 ? (ticketsTested / exam.tickets.length) * 70 : 0;
    return Math.round(cardsWeight + ticketsWeight);
  };

  const getTicketColor = (score?: number) => {
      if (score === undefined) return 'bg-white/5 border-white/5 hover:border-indigo-500/30';
      if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/50';
      if (score >= 50) return 'bg-amber-500/10 border-amber-500/50';
      return 'bg-rose-500/10 border-rose-500/50';
  };

  const handleDeleteExam = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      
      const confirmMessage = lang === 'ru' 
        ? 'Вы уверены, что хотите удалить этот экзамен и все связанные материалы?' 
        : 'Are you sure you want to delete this exam and all related materials?';

      if (window.confirm(confirmMessage)) {
          const updatedExams = (user.exams || []).filter(ex => ex.id !== id);
          onUpdateProfile({ ...user, exams: updatedExams });
      }
  };

  const handleQuickParse = async () => {
    // Check and deduct credits
    const examCost = CreditsService.getActionCost('examCompletion', user.settings?.aiDetailLevel);
    if (user.credits && !user.credits.hasUnlimitedAccess) {
      if (!CreditsService.canAfford(user.credits, examCost)) {
        alert(lang === 'ru' ? '❌ Недостаточно кредитов для генерации экзамена. Введите промокод в настройках для получения безлимитного доступа.' : '❌ Not enough credits to generate exam. Enter promo code in settings for unlimited access.');
        return;
      }
      onDeductCredits?.(examCost);
    }

    setWizardStep(3);
    setIsWizardProcessing(true);
    setErrorStatus(null);
    try {
        const parsed = await parseTicketsFromText(rawTicketsText, lang);
        const tickets: Ticket[] = (parsed || []).filter((p: any) => !!p && p.question).map((p: any, i: number) => ({ 
            id: `t_${Date.now()}_${i}`, 
            number: p.number || (i + 1), 
            question: p.question || '', 
            confidence: 0 
        }));
        
        if (tickets.length === 0) {
            setWizardStep(2);
            return;
        }

        const { glossary, flashcards } = await generateGlossaryAndCards(tickets, newExam.subject!, lang);
        const glossaryTerms: Term[] = (glossary || []).map((g: any, i: number) => ({
            id: g.id ?? `term_${Date.now()}_${i}`,
            word: typeof g.word === 'string' ? g.word : '',
            definition: typeof g.definition === 'string' ? g.definition : '',
        }));
        const fullExam: Exam = { 
            ...(newExam as Exam), 
            tickets, 
            calendar: [], 
            glossary: glossaryTerms, 
            flashcards: (flashcards || []).map((f: any) => ({ ...f, id: `fc_${Date.now()}_${Math.random()}`, status: 'new' })), 
            progress: 0 
        };
        setPreparedExamData(fullExam);
    } catch (e: any) { 
        if (e.status === 429) setErrorStatus(429);
        setWizardStep(2); 
    } finally { setIsWizardProcessing(false); }
  };

  const handleFinalizeExam = () => {
      if (!preparedExamData) return;
      onUpdateProfile({ ...user, exams: [...(user.exams || []), preparedExamData] });
      // DO NOT set active exam here, to go back to list
      // setActiveExam(preparedExamData); 
      setShowWizard(false);
      setWizardStep(1);
      setRawTicketsText('');
  };

  const handleOpenTicket = async (ticket: Ticket) => {
      setActiveTicket(ticket);
      setTicketMode('note');
      setIsGeneratingNote(!ticket.note);
      if (!ticket.note) {
          try {
              const noteRaw = await generateTicketNote(ticket.question, activeExam!.subject, lang);
              const note = cleanTextOutput(noteRaw);
              const updatedTickets = activeExam!.tickets.map(t => t.id === ticket.id ? { ...t, note } : t);
              const updatedExam = { ...activeExam!, tickets: updatedTickets };
              setActiveExam(updatedExam);
              onUpdateProfile({ ...user, exams: user.exams?.map(e => e.id === activeExam!.id ? updatedExam : e) });
              setActiveTicket({ ...ticket, note });
          } catch (e: any) { 
              if (e.status === 429) setErrorStatus(429);
          } finally { setIsGeneratingNote(false); }
      }
  };

  // Flashcard Actions
  const startFlashcardSession = () => {
    if (!activeExam) return;
    const pool = (activeExam.flashcards || []).filter(f => f.status !== 'mastered');
    if (pool.length === 0) return;

    setSessionQueue([...pool]);
    setStartSessionCount(pool.length);
    setCurrentCardIndex(Math.floor(Math.random() * pool.length));
    setIsFlashcardSession(true);
    setIsFlipped(false);
  };

  const processCardResult = (isKnown: boolean) => {
    if (!activeExam || sessionQueue.length === 0) return;
    const currentCard = sessionQueue[currentCardIndex];
    if (!currentCard) return;

    let updatedQueue = [...sessionQueue];
    
    if (isKnown) {
        // PERMANENT UPDATE: Mark as mastered in global state
        const updatedFlashcards = activeExam.flashcards.map(f => 
            f.id === currentCard.id ? { ...f, status: 'mastered' as const } : f
        );
        const updatedExam = { ...activeExam, flashcards: updatedFlashcards };
        setActiveExam(updatedExam);
        onUpdateProfile({ 
            ...user, 
            exams: user.exams?.map(e => e.id === activeExam.id ? updatedExam : e),
            totalExperience: (user.totalExperience || 0) + 5
        });

        // SESSION UPDATE: Remove from current queue
        updatedQueue = sessionQueue.filter(f => f.id !== currentCard.id);
    }

    if (updatedQueue.length === 0) {
        setSessionQueue([]);
        return;
    }

    // Pick next random
    let nextIdx = Math.floor(Math.random() * updatedQueue.length);
    if (!isKnown && updatedQueue.length > 1 && updatedQueue[nextIdx].id === currentCard.id) {
        nextIdx = (nextIdx + 1) % updatedQueue.length;
    }

    setSessionQueue(updatedQueue);
    setCurrentCardIndex(nextIdx);
    setIsFlipped(false);
  };

  const handleAddManualCard = () => {
    if (!manualCard.question || !manualCard.answer || !activeExam) return;
    const newCard: Flashcard = {
        id: `manual_${Date.now()}`,
        question: manualCard.question,
        answer: manualCard.answer,
        confidence: 0,
        status: 'new',
        ticketId: manualCard.ticketId || undefined
    };
    const updatedExam = { ...activeExam, flashcards: [...(activeExam.flashcards || []), newCard] };
    setActiveExam(updatedExam);
    onUpdateProfile({ ...user, exams: user.exams?.map(e => e.id === activeExam.id ? updatedExam : e) });
    setShowManualCardModal(false);
    setManualCard({ question: '', answer: '', ticketId: '' });
  };

  const getActiveCardMetadata = () => {
      const card = sessionQueue[currentCardIndex];
      if (!card || !activeExam) return null;
      const ticket = activeExam.tickets.find(t => t.id === card.ticketId);
      return { 
          ticketNumber: ticket?.number || '?', 
          ticketQuestion: ticket?.question || activeExam.subject 
      };
  };

  const resetCards = () => {
    if (!activeExam) return;
    const reset = (activeExam.flashcards || []).map(f => ({ ...f, status: 'new' as const }));
    const updatedExam = { ...activeExam, flashcards: reset };
    setActiveExam(updatedExam);
    onUpdateProfile({ ...user, exams: user.exams?.map(e => e.id === activeExam.id ? updatedExam : e) });
  };

  // Quiz Actions
  const handleStartQuiz = async () => {
      if (!activeTicket) return;
      setIsGeneratingQuiz(true);
      setErrorStatus(null);
      setQuizScore(0);
      setAnswerFeedback(null); // Fix: Reset feedback state
      setSelectedAnswer(null); // Fix: Reset selected answer state
      try {
          const raw = await generateQuiz(activeTicket.question, activeExam!.subject, lang, quizCount);
          const normalized: { question: string; options: string[]; correctIndex: number; difficulty?: 'easy' | 'medium' | 'hard' }[] = (raw || []).map(q => ({
              question: q.question ?? '',
              options: Array.isArray(q.options) ? q.options : [],
              correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
              difficulty: q.difficulty === 'easy' || q.difficulty === 'medium' || q.difficulty === 'hard' ? q.difficulty : undefined,
          }));
          setQuizQuestions(normalized);
          setCurrentQuizStep(0);
          setTicketMode('quiz');
      } catch (e: any) { 
          if (e.status === 429) setErrorStatus(429);
      } finally { setIsGeneratingQuiz(false); }
  };

  const handleSubmitAnswer = (idx: number) => {
      if (currentQuizStep === null || answerFeedback !== null || !quizQuestions[currentQuizStep]) return;
      setSelectedAnswer(idx);
      const isCorrect = idx === quizQuestions[currentQuizStep].correctIndex;
      setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
      if (isCorrect) setQuizScore(prev => prev + 1);
  };

  const handleNextQuestion = () => {
      if (currentQuizStep === null) return;
      if (currentQuizStep < quizQuestions.length - 1) {
          setAnswerFeedback(null);
          setSelectedAnswer(null);
          setCurrentQuizStep(prev => prev! + 1);
      } else {
          const finalScore = Math.round((quizScore / quizQuestions.length) * 100);
          const earnedXp = Math.round(10 + (finalScore * 0.4));
          const updatedTickets = activeExam!.tickets.map(t => t.id === activeTicket!.id ? { ...t, lastScore: finalScore } : t);
          const updatedExam = { ...activeExam!, tickets: updatedTickets };
          setActiveExam(updatedExam);
          onUpdateProfile({ ...user, exams: user.exams?.map(e => e.id === activeExam!.id ? updatedExam : e), totalExperience: (user.totalExperience || 0) + earnedXp });
          setQuizResult({ score: finalScore, xp: earnedXp });
          setTicketMode('result');
      }
  };

  if (showWizard) {
      return (
          <div className="h-full flex flex-col animate-fadeIn bg-[var(--bg-main)] relative">
                {/* ... Wizard Content (Unchanged) ... */}
                <header className="flex justify-between items-center mb-6 shrink-0 px-2">
                    {user.exams && user.exams.length > 0 ? (
                        <button onClick={() => setShowWizard(false)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400"><X size={20} /></button>
                    ) : <div className="w-10" />}
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">{t.examStep} {wizardStep}/3</span>
                    <div className="w-10" />
                </header>
                <div className="flex-1 space-y-10 animate-fade-in-up px-2 pb-24 overflow-y-auto scrollbar-hide">
                    <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter text-center">{t.examNewExam}</h2>
                    {wizardStep === 1 && (
                        <div className="space-y-6">
                            <GlassInput 
                                value={newExam.subject} 
                                onChange={e => setNewExam({...newExam, subject: e.target.value})} 
                                placeholder={t.examSubject}
                                className="h-14"
                            />
                            <div className="relative">
                                <GlassInput 
                                    type="date" 
                                    value={newExam.date} 
                                    onChange={e => setNewExam({...newExam, date: e.target.value})} 
                                    className="h-14 w-full block text-left min-h-[56px] bg-white/5 px-4 text-[var(--text-primary)]"
                                    style={{ appearance: 'none', WebkitAppearance: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <button onClick={() => setWizardStep(2)} disabled={!newExam.subject || !newExam.date} className="w-full h-16 bg-[var(--bg-active)] text-[var(--bg-active-text)] font-black uppercase tracking-widest rounded-full shadow-2xl active:scale-95 transition-all disabled:opacity-30">{t.next}</button>
                        </div>
                    )}
                    {wizardStep === 2 && (
                        <div className="space-y-6">
                            <GlassTextArea value={rawTicketsText} onChange={e => setRawTicketsText(e.target.value)} placeholder={t.examPasteQuestions} className="h-56" />
                            {errorStatus === 429 && (
                                <button onClick={handleOpenKeySelection} className="w-full p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-400 text-xs font-bold uppercase tracking-widest">
                                    <Key size={16}/> {lang === 'ru' ? 'Лимит исчерпан. Выбрать свой ключ?' : 'Limit reached. Select your own key?'}
                                </button>
                            )}
                            <div className="flex gap-4">
                                <button onClick={() => setWizardStep(1)} className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400"><ChevronLeft size={28} /></button>
                                <button onClick={handleQuickParse} disabled={!rawTicketsText.trim()} className="flex-1 h-16 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-full shadow-2xl active:scale-95">{t.examParseAI} <Sparkles size={16} className="ml-2 inline" /></button>
                            </div>
                        </div>
                    )}
                    {wizardStep === 3 && (
                        <div className="text-center py-10">
                            {isWizardProcessing ? (
                                <div className="space-y-8">
                                    <div className="relative w-28 h-28 mx-auto"><div className="absolute inset-0 rounded-full border-4 border-white/5" /><div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" /><Bot className="absolute inset-0 m-auto text-indigo-500" size={40} /></div>
                                    <h3 className="text-2xl font-black text-[var(--text-primary)]">{t.examGenPlan}...</h3>
                                </div>
                            ) : (
                                <div className="space-y-10">
                                    <div className="w-28 h-28 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20 shadow-2xl"><CheckCircle2 size={56} className="text-green-500" /></div>
                                    <h3 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tight">{t.examReady}</h3>
                                    <button onClick={handleFinalizeExam} className="w-full h-16 bg-[var(--bg-active)] text-[var(--bg-active-text)] font-black uppercase tracking-widest rounded-full shadow-2xl active:scale-95">{t.examEnterStudy}</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
          </div>
      );
  }

  if (activeExam) {
      const mastered = (activeExam.flashcards || []).filter(f => f.status === 'mastered').length;
      const total = (activeExam.flashcards || []).length;
      const remaining = total - mastered;

      return (
          <div className="animate-fadeIn w-full">
                {/* ... Header & Progress ... */}
                <header className="flex justify-between items-center mb-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setActiveExam(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-[var(--text-primary)]"><ChevronLeft size={22} /></button>
                        <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter truncate max-w-[180px]">{activeExam.subject}</h2>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500"><Trophy size={18} /></div>
                </header>

                <div className="space-y-6">
                    <GlassCard className="p-6 bg-indigo-500/10 border-indigo-500/20 rounded-[32px] flex items-center justify-between">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{lang === 'ru' ? 'Ваш прогресс' : 'Your Progress'}</p>
                            <h3 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{calculateExamProgress(activeExam)}%</h3>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                           <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{activeExam.tickets.filter(t => t.lastScore !== undefined).length} / {activeExam.tickets.length} {lang === 'ru' ? 'Билетов' : 'Tickets'}</span>
                           <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${calculateExamProgress(activeExam)}%` }} />
                           </div>
                        </div>
                    </GlassCard>

                    <div className={`flex rounded-full p-1 border border-white/5 bg-white/5 backdrop-blur-md`}>
                        {[
                            { id: 'tickets', icon: <FileText size={16}/>, label: lang === 'ru' ? 'Билеты' : 'Tickets' },
                            { id: 'flashcards', icon: <Layers size={16}/>, label: lang === 'ru' ? 'Карточки' : 'Cards' },
                            { id: 'glossary', icon: <BookOpen size={16}/>, label: lang === 'ru' ? 'Словарь' : 'Glossary' }
                        ].map(tab => (
                            <button key={tab.id} onClick={() => setHubTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${hubTab === tab.id ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-slate-400 hover:text-[var(--text-primary)]'}`}>{tab.icon} <span className="hidden xs:inline">{tab.label}</span></button>
                        ))}
                    </div>

                    {hubTab === 'tickets' && (
                        <div className="space-y-3 animate-fadeIn pb-32">
                            {(activeExam.tickets || []).map(ticket => (
                                <GlassCard key={ticket.id} onClick={() => handleOpenTicket(ticket)} className={`p-5 rounded-[28px] border transition-all flex items-center justify-between group cursor-pointer ${getTicketColor(ticket.lastScore)}`}>
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-black text-sm shadow-inner transition-colors duration-500 ${ticket.lastScore !== undefined ? (ticket.lastScore >= 75 ? 'bg-emerald-500 text-white' : ticket.lastScore >= 50 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white') : 'bg-white/10 text-slate-500'}`}>
                                            {ticket.number}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-[15px] font-bold truncate text-[var(--text-primary)]`}>{ticket.question}</p>
                                            {ticket.lastScore !== undefined && (
                                                <p className={`text-[9px] font-black uppercase mt-1 ${ticket.lastScore >= 75 ? 'text-emerald-500' : ticket.lastScore >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{lang === 'ru' ? 'Результат' : 'Result'}: {ticket.lastScore}%</p>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-[var(--text-secondary)] opacity-30 group-hover:opacity-100" />
                                </GlassCard>
                            ))}
                        </div>
                    )}

                    {hubTab === 'flashcards' && (
                      <div className="space-y-8 animate-fadeIn text-center py-6 pb-32">
                          <BrainCircuit className="mx-auto text-indigo-500" size={64} />
                          <div className="space-y-2">
                            <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{lang === 'ru' ? 'Карточки' : 'Atomic Review'}</h3>
                            <p className="text-xs text-[var(--text-secondary)] font-medium max-w-[240px] mx-auto opacity-70">
                                {lang === 'ru' ? 'Повторяйте факты, даты и формулы.' : 'Review facts, dates, and formulas.'}
                            </p>
                          </div>
                          <GlassCard className="p-6 bg-white/5 border-white/10 rounded-[32px]">
                             <div className="flex justify-between items-center mb-6 px-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{lang === 'ru' ? 'В очереди' : 'In Queue'}</span>
                                <span className="text-2xl font-black text-indigo-400">{remaining}</span>
                             </div>
                             <div className="flex gap-3">
                                 <button 
                                    onClick={startFlashcardSession}
                                    disabled={remaining === 0}
                                    className="flex-[3] h-16 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase tracking-widest text-[12px] shadow-2xl active:scale-[0.98] disabled:opacity-20"
                                 >
                                     {lang === 'ru' ? 'Начать учить' : 'Start Studying'}
                                 </button>
                                 <button 
                                    onClick={() => setShowManualCardModal(true)}
                                    className="flex-1 h-16 bg-white/5 border border-white/10 text-white rounded-full flex items-center justify-center active:scale-95"
                                 >
                                     <Plus size={24} />
                                 </button>
                             </div>
                             {mastered > 0 && (
                                 <button onClick={resetCards} className="mt-4 text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"><RotateCcw size={12}/> {lang === 'ru' ? 'Сбросить прогресс' : 'Reset Progress'}</button>
                             )}
                          </GlassCard>
                      </div>
                    )}
                    
                    {hubTab === 'glossary' && (
                        <div className="space-y-4 pb-32 animate-fadeIn">
                             {(activeExam.glossary || []).map((term, i) => (
                                 <GlassCard key={i} className="p-5 rounded-[24px] border-[var(--border-glass)] bg-[var(--bg-card)] relative overflow-hidden group hover:border-indigo-500/30">
                                     <div className="absolute top-0 right-0 p-3 opacity-5"><BookOpen size={48} /></div>
                                     <h4 className="text-sm font-black text-indigo-400 uppercase tracking-wide mb-2">{term.word}</h4>
                                     <p className="text-xs text-[var(--text-primary)] leading-relaxed font-medium opacity-90">{term.definition}</p>
                                 </GlassCard>
                             ))}
                        </div>
                    )}
                </div>

                {/* Manual Card Adder Modal */}
                {showManualCardModal && (
                    <div className="fixed inset-0 z-[550] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
                        <GlassCard className="w-full max-w-sm p-6 bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] shadow-2xl space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Новая карточка' : 'New Flashcard'}</h3>
                                <button onClick={() => setShowManualCardModal(false)} className="p-2 text-slate-500 hover:text-white transition-all"><X size={20}/></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{lang === 'ru' ? 'Вопрос / Термин' : 'Question / Term'}</label>
                                    <GlassInput value={manualCard.question} onChange={e => setManualCard({...manualCard, question: e.target.value})} placeholder="Напр: Теорема Пифагора" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{lang === 'ru' ? 'Ответ / Определение' : 'Answer / Definition'}</label>
                                    <GlassTextArea value={manualCard.answer} onChange={e => setManualCard({...manualCard, answer: e.target.value})} placeholder="Краткий ответ..." className="h-24" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">{lang === 'ru' ? 'Привязать к билету (опц)' : 'Link to Ticket'}</label>
                                    <select value={manualCard.ticketId} onChange={e => setManualCard({...manualCard, ticketId: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-xl h-10 px-4 text-white text-xs outline-none focus:border-indigo-500/50">
                                        <option value="">{lang === 'ru' ? 'Без билета' : 'No ticket'}</option>
                                        {activeExam.tickets.map(t => <option key={t.id} value={t.id}>{lang === 'ru' ? 'Билет' : 'Ticket'} #{t.number}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleAddManualCard} disabled={!manualCard.question || !manualCard.answer} className="w-full h-14 bg-indigo-500 text-white rounded-full font-black uppercase text-[11px] shadow-lg disabled:opacity-30 active:scale-95 transition-all">{t.save}</button>
                        </GlassCard>
                    </div>
                )}

                {/* FLASHCARD STUDY SESSION OVERLAY - OPTIMIZED LAYOUT */}
                {isFlashcardSession && (
                  <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-3xl flex items-center justify-center p-4 animate-fadeIn">
                      <div className="w-full max-w-md h-[85vh] bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] shadow-2xl flex flex-col relative overflow-hidden">
                          <header className="flex justify-between items-center p-6 shrink-0 bg-[var(--bg-main)] z-20">
                              <button onClick={() => setIsFlashcardSession(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-slate-400 active:scale-90 transition-all hover:text-white"><X size={20} /></button>
                              <div className="text-center">
                                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{lang === 'ru' ? 'Изучение' : 'Studying'}</p>
                                  <p className="text-[10px] font-black text-indigo-400 mt-0.5">{startSessionCount - sessionQueue.length + 1} / {startSessionCount}</p>
                              </div>
                              <div className="w-12" />
                          </header>

                          <div className="flex-1 flex flex-col items-center justify-center p-4">
                              {sessionQueue.length === 0 ? (
                                  <div className="text-center space-y-8 animate-fade-in-up">
                                      <div className="w-28 h-28 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                                          <CheckCircle2 size={56} />
                                      </div>
                                      <h2 className="text-3xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{lang === 'ru' ? 'ОТЛИЧНО!' : 'DONE!'}</h2>
                                      <button onClick={() => setIsFlashcardSession(false)} className="px-12 py-5 bg-indigo-600 text-white rounded-full font-black uppercase tracking-widest text-[11px] shadow-2xl active:scale-95">{t.back}</button>
                                  </div>
                              ) : (
                                  <div 
                                    onClick={() => setIsFlipped(!isFlipped)} 
                                    className="w-full max-w-[300px] aspect-[4/5] bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[44px] shadow-[0_20px_80px_rgba(0,0,0,0.2)] p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:-translate-y-1 relative overflow-hidden group active:scale-[0.98]"
                                  >
                                      {/* Background Decoration */}
                                      <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                                      
                                      {/* Header metadata inside card */}
                                      {!isFlipped && getActiveCardMetadata() && (
                                          <div className="absolute top-10 left-8 right-8 flex flex-col items-center gap-1.5 border-b border-white/5 pb-4">
                                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{lang === 'ru' ? 'Билет' : 'Ticket'} #{getActiveCardMetadata()?.ticketNumber}</span>
                                              <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.1em] truncate w-full px-2 text-center opacity-70">{getActiveCardMetadata()?.ticketQuestion}</p>
                                          </div>
                                      )}

                                      <div className="flex flex-col items-center justify-center h-full relative z-10 pt-16">
                                        <p className={`text-2xl font-black leading-tight tracking-tight ${isFlipped ? 'text-indigo-400' : 'text-[var(--text-primary)]'}`}>
                                            {isFlipped ? sessionQueue[currentCardIndex]?.answer : sessionQueue[currentCardIndex]?.question}
                                        </p>
                                      </div>

                                      {!isFlipped && (
                                          <div className="absolute bottom-10 animate-bounce">
                                              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.3em]">{lang === 'ru' ? 'Нажми для ответа' : 'Tap to reveal'}</span>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </div>

                          {sessionQueue.length > 0 && isFlipped && (
                              <footer className="shrink-0 p-6 flex gap-4 pb-8 animate-fade-in-up bg-[var(--bg-main)] border-t border-[var(--border-glass)] z-20">
                                  <button 
                                    onClick={() => processCardResult(false)} 
                                    className="flex-1 h-16 bg-white/5 text-[var(--text-secondary)] rounded-3xl font-black uppercase text-[10px] active:scale-95 border border-[var(--border-glass)] transition-all hover:bg-white/10"
                                  >
                                      {lang === 'ru' ? 'Не помню' : 'Retry'}
                                  </button>
                                  <button 
                                    onClick={() => processCardResult(true)} 
                                    className="flex-[1.5] h-16 bg-indigo-600 text-white rounded-3xl font-black uppercase text-[10px] shadow-[0_10px_30px_rgba(99,102,241,0.3)] active:scale-95 flex items-center justify-center gap-3 transition-all"
                                  >
                                      <Check size={18} strokeWidth={3} />
                                      {lang === 'ru' ? 'Я знаю' : 'Know it'}
                                  </button>
                              </footer>
                          )}
                      </div>
                  </div>
                )}

                {/* Ticket Overlays (Note/Quiz) */}
                {activeTicket && (
                    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-3xl flex items-center justify-center p-4 animate-fadeIn">
                        <div className="w-full max-w-md h-[85vh] bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-[40px] shadow-2xl flex flex-col relative overflow-hidden">
                          {ticketMode === 'note' && (
                              <div className="flex flex-col h-full">
                                  <header className="p-6 flex justify-between items-center bg-[var(--bg-main)] z-10 border-b border-[var(--border-glass)] shrink-0">
                                       <button onClick={() => setActiveTicket(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><ChevronLeft size={22} /></button>
                                       <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight truncate flex-1 text-center mx-4">{activeTicket.question}</h3>
                                       <div className="w-10 h-10" />
                                  </header>
                                  <div className="flex-1 overflow-y-auto p-8 pb-48 scrollbar-hide">
                                      {isGeneratingNote ? (
                                          <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-pulse">
                                              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                                              <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t.thinking}</p>
                                          </div>
                                      ) : (
                                          <div className="animate-fadeIn">
                                              <NoteRenderer text={activeTicket.note || ''} lang={lang} />
                                              <div className="mt-20 pt-10 border-t border-[var(--border-glass)] text-center">
                                                  <h3 className="text-xl font-black text-[var(--text-primary)] uppercase mb-6">{lang === 'ru' ? 'Проверка знаний' : 'Knowledge Check'}</h3>
                                                  <div className="flex justify-center gap-2 mb-6">
                                                      {[3, 5, 10].map(num => (
                                                          <button key={num} onClick={() => setQuizCount(num as any)} className={`w-10 h-10 rounded-full text-[12px] font-bold border transition-all ${quizCount === num ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-[var(--text-secondary)]'}`}>{num}</button>
                                                      ))}
                                                  </div>
                                                  <button onClick={handleStartQuiz} className="w-full h-16 rounded-[32px] bg-indigo-600 text-white font-black uppercase text-[13px] shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
                                                      {isGeneratingQuiz ? <Loader2 className="animate-spin" size={24} /> : <Play size={22} fill="currentColor" />}
                                                      {lang === 'ru' ? 'Начать Тест' : 'Start Quiz'}
                                                  </button>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          )}

                          {ticketMode === 'quiz' && currentQuizStep !== null && quizQuestions.length > 0 && (
                              <div className="flex flex-col h-full bg-[var(--bg-main)]">
                                  <header className="p-6 flex justify-between items-center bg-[var(--bg-main)] z-10 border-b border-[var(--border-glass)] shrink-0">
                                       <button onClick={() => setTicketMode('note')} className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{t.cancel}</button>
                                       <div className="flex flex-col items-center gap-0.5">
                                         <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">{lang === 'ru' ? 'Вопрос' : 'Question'} {currentQuizStep + 1} / {quizQuestions.length}</span>
                                         {quizQuestions[currentQuizStep]?.difficulty && (
                                           <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 ${
                                             quizQuestions[currentQuizStep].difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-400' :
                                             quizQuestions[currentQuizStep].difficulty === 'hard' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'
                                           }`}>
                                             {lang === 'ru' ? (quizQuestions[currentQuizStep].difficulty === 'easy' ? 'Лёгкий' : quizQuestions[currentQuizStep].difficulty === 'hard' ? 'Сложный' : 'Средний') : quizQuestions[currentQuizStep].difficulty}
                                           </span>
                                         )}
                                       </div>
                                       <div className="w-10 text-right text-[10px] font-black text-[var(--text-secondary)]">{quizScore} pts</div>
                                  </header>
                                  <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center pb-48 scrollbar-hide">
                                      <div className="w-full max-sm space-y-8 pt-4">
                                          <h4 className="text-2xl font-black text-[var(--text-primary)] leading-tight tracking-tight text-center">{quizQuestions[currentQuizStep]?.question || ''}</h4>
                                          <div className="grid gap-3">
                                              {(quizQuestions[currentQuizStep]?.options || []).map((opt, idx) => {
                                                  const isSelected = selectedAnswer === idx;
                                                  const isCorrect = idx === quizQuestions[currentQuizStep].correctIndex;
                                                  let btnClass = "bg-white/5 border-white/10 text-[var(--text-primary)]";
                                                  if (answerFeedback) {
                                                      if (isCorrect) btnClass = "bg-emerald-500/20 border-emerald-500 text-emerald-400";
                                                      else if (isSelected) btnClass = "bg-rose-500/20 border-rose-500 text-rose-400";
                                                      else btnClass = "bg-white/2 border-transparent text-[var(--text-secondary)] opacity-40";
                                                  }
                                                  return (
                                                      <button key={idx} onClick={() => handleSubmitAnswer(idx)} disabled={answerFeedback !== null} className={`w-full p-5 rounded-[24px] border font-bold transition-all text-sm text-left flex items-center justify-between group ${btnClass}`}>
                                                          <span className="flex-1 pr-4">{opt}</span>
                                                          {answerFeedback && isCorrect && <CheckCircle2 size={18} className="text-emerald-500 shrink-0 ml-4" />}
                                                          {answerFeedback && isSelected && !isCorrect && <X size={18} className="text-rose-500 shrink-0 ml-4" />}
                                                      </button>
                                                  );
                                              })}
                                          </div>
                                      </div>
                                  </div>
                                  {answerFeedback && (
                                      <div className="p-6 bg-[var(--bg-main)] border-t border-[var(--border-glass)] animate-fade-in-up pb-32">
                                          <button onClick={handleNextQuestion} className="w-full h-16 rounded-[32px] bg-[var(--bg-active)] text-[var(--bg-active-text)] font-black uppercase text-[12px] shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                                              {currentQuizStep < quizQuestions.length - 1 ? <>{lang === 'ru' ? 'Далее' : 'Next'} <ArrowRight size={18} /></> : <>{lang === 'ru' ? 'Завершить' : 'Finish'} <Check size={18} /></>}
                                          </button>
                                      </div>
                                  )}
                              </div>
                          )}

                          {ticketMode === 'result' && quizResult && (
                              <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-[var(--bg-main)]">
                                  <div className="space-y-8 animate-fade-in-up w-full max-w-sm pb-24">
                                      <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto border border-indigo-500/30 shadow-[0_0_40px_rgba(99,102,241,0.3)]"><Trophy size={64} className="text-indigo-400" /></div>
                                      <div className="space-y-2">
                                          <h2 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{quizResult.score}%</h2>
                                          <p className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'Ваш результат' : 'Quiz Result'}</p>
                                      </div>
                                      <div className="flex items-center justify-center gap-2 bg-white/5 px-6 py-3 rounded-full border border-white/10"><Star className="text-amber-400" size={20} fill="currentColor"/><span className="text-xl font-black text-[var(--text-primary)]">+{quizResult.xp} XP</span></div>
                                      <div className="pt-8 space-y-3">
                                          <button onClick={() => setTicketMode('note')} className="w-full h-14 rounded-full border border-[var(--border-glass)] text-[var(--text-secondary)] font-black uppercase tracking-widest text-[11px] transition-colors hover:bg-white/5">{lang === 'ru' ? 'К конспекту' : 'Back to Note'}</button>
                                          <button onClick={() => setActiveTicket(null)} className="w-full h-14 bg-indigo-600 text-white rounded-full font-black uppercase tracking-widest text-[11px] shadow-xl transition-transform active:scale-95">{lang === 'ru' ? 'Закрыть' : 'Close'}</button>
                                      </div>
                                  </div>
                              </div>
                          )}
                        </div>
                    </div>
                )}
          </div>
      );
  }

  // ... (main return remains similar but layout was fixed in previous steps)
  // Re-pasting just the main return block to ensure consistency if needed, but it was mostly unchanged.
  // Assuming the `handleStartQuiz` fix and flashcard layout fix are key.
  // The logic above includes the full component with changes.
  
  return (
    <div className="animate-fadeIn space-y-6 max-w-md mx-auto h-full flex flex-col">
        <div className="flex justify-between items-center mb-2 px-1">
            <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t.examAcademy}</h1>
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{t.examHubDesc}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20"><Bot size={20} /></div>
        </div>
        
        {user.exams?.map(exam => (
            <GlassCard key={exam.id} onClick={() => setActiveExam(exam)} className="p-6 rounded-[36px] bg-[var(--bg-card)] border-[var(--border-glass)] cursor-pointer hover:border-indigo-500/30 transition-all active:scale-[0.98] shadow-xl relative group">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex-1 min-w-0 pr-4">
                        <h3 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight leading-none mb-2 truncate">{exam.subject}</h3>
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full">{getDaysLeft(exam.date)} {lang === 'ru' ? 'дн. осталось' : 'days left'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={(e) => handleDeleteExam(e, exam.id)} 
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-rose-500 hover:bg-rose-500/20 transition-all active:scale-90 z-20"
                            title={lang === 'ru' ? 'Удалить' : 'Delete'}
                        >
                            <Trash2 size={18} />
                        </button>
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)]"><ChevronRight size={24} /></div>
                    </div>
                </div>
                <div className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${calculateExamProgress(exam)}%` }} />
                </div>
            </GlassCard>
        ))}
        
        <button onClick={() => setShowWizard(true)} className={`w-full py-12 rounded-[40px] border border-dashed flex flex-col items-center justify-center gap-4 transition-all group ${isLightTheme ? 'border-slate-300 text-slate-500 hover:text-slate-800' : 'border-[var(--border-glass)] text-[var(--text-secondary)] hover:text-white hover:bg-white/5'}`}>
            <Plus size={32} strokeWidth={1.5} />
            <span className="text-xs font-black uppercase tracking-[0.3em]">{t.examNewExam}</span>
        </button>
    </div>
  );
};
