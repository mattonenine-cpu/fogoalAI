
import React, { useState, useEffect } from 'react';
import { Exam, Ticket, UserProfile, Language, TRANSLATIONS, AppTheme } from '../types';
import { GlassCard, GlassInput, GlassTextArea } from './GlassCard';
import { parseTicketsFromText, generateTicketNote, generateGlossaryAndCards, getLocalISODate, generateQuiz } from '../services/geminiService';
import { X, BookOpen, ChevronLeft, Sparkles, FileText, Trophy, Loader2, CheckCircle2, Plus, Layers, BrainCircuit } from 'lucide-react';

const getDaysLeft = (dateStr: string) => {
  const target = new Date(dateStr);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

const renderBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-indigo-400 font-bold px-0.5">{part.slice(2, -2)}</strong>;
        return part;
    });
};

const NoteRenderer: React.FC<{ text: string; lang: Language }> = ({ text }) => {
    const lines = text.split('\n');
    return (
        <div className="space-y-6 text-[var(--text-primary)] leading-relaxed font-medium">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-2" />;
                if (trimmed.startsWith('# ')) {
                    return (
                        <h1 key={idx} className="text-3xl font-black text-[var(--text-primary)] tracking-tight pt-2 border-b border-[var(--border-glass)] pb-6 mb-8 uppercase text-center">
                            {trimmed.substring(2)}
                        </h1>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <div key={idx} className="pt-8 mt-4 mb-4">
                            <h2 className="text-xl font-black text-indigo-400 tracking-wide uppercase flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-indigo-500 rounded-full"></span>
                                {trimmed.substring(3)}
                            </h2>
                        </div>
                    );
                }
                if (trimmed.startsWith('### ')) return <h3 key={idx} className="text-lg font-bold text-[var(--text-primary)] tracking-tight mt-4 opacity-90">{trimmed.substring(4)}</h3>;
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    return (
                        <div key={idx} className="flex items-start gap-3 pl-2 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0 group-hover:scale-125 transition-transform" />
                            <p className="text-[16px] leading-relaxed text-[var(--text-secondary)] flex-1">{renderBoldText(trimmed.substring(2))}</p>
                        </div>
                    );
                }
                return <p key={idx} className="text-[17px] leading-8 text-[var(--text-primary)] opacity-90 font-normal tracking-wide">{renderBoldText(trimmed)}</p>;
            })}
        </div>
    );
};

interface ExamPrepAppProps {
  user: UserProfile;
  lang: Language;
  onUpdateProfile: (profile: UserProfile) => void;
  theme: AppTheme;
}

export const ExamPrepApp: React.FC<ExamPrepAppProps> = ({ user, lang, onUpdateProfile }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  
  const [showWizard, setShowWizard] = useState(false);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [ticketMode, setTicketMode] = useState<'note' | 'quiz' | 'result'>('note');
  
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newExam, setNewExam] = useState<Partial<Exam>>({ id: Date.now().toString(), subject: '', date: getLocalISODate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)), tickets: [], progress: 0 });
  const [rawTicketsText, setRawTicketsText] = useState('');
  const [isWizardProcessing, setIsWizardProcessing] = useState(false);
  
  // Flashcard States
  const [isFlashcardSession, setIsFlashcardSession] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz States
  const [quizQuestions, setQuizQuestions] = useState<{question: string, options: string[], correctIndex: number}[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [currentQuizStep, setCurrentQuizStep] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null);

  useEffect(() => {
      if (user.exams && user.exams.length === 0) {
          setShowWizard(true);
      }
  }, []);

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

  const handleWizardParse = async () => {
      if (!rawTicketsText.trim()) return;
      setIsWizardProcessing(true);
      try {
          const tickets = await parseTicketsFromText(rawTicketsText, lang);
          const mappedTickets = tickets.map((t: any) => ({ ...t, id: Math.random().toString(), confidence: 0 }));
          setNewExam(prev => ({ ...prev, tickets: mappedTickets }));
          setWizardStep(3);
      } catch (e) {
          console.error(e);
      } finally {
          setIsWizardProcessing(false);
      }
  };

  const handleWizardFinalize = async () => {
      setIsWizardProcessing(true);
      try {
          const { glossary, flashcards } = await generateGlossaryAndCards(newExam.tickets as Ticket[], newExam.subject || "General", lang);
          
          const finalExam: Exam = {
              ...(newExam as Exam),
              glossary: glossary.map((g: any) => ({ ...g, id: Math.random().toString() })),
              flashcards: flashcards.map((f: any) => ({ ...f, id: Math.random().toString(), confidence: 0, status: 'new' })),
              progress: 0,
              calendar: []
          };

          const updatedExams = [...(user.exams || []), finalExam];
          onUpdateProfile({ ...user, exams: updatedExams });
          setActiveExam(finalExam);
          setShowWizard(false);
          setWizardStep(1);
          setNewExam({ id: Date.now().toString(), subject: '', date: getLocalISODate(), tickets: [], progress: 0 });
          setRawTicketsText('');
      } catch(e) {
          console.error(e);
      } finally {
          setIsWizardProcessing(false);
      }
  };

  const openTicket = async (ticket: Ticket) => {
      setActiveTicket(ticket);
      setTicketMode('note');
      if (!ticket.note) {
          setIsGeneratingNote(true);
          try {
              const note = await generateTicketNote(ticket.question, activeExam?.subject || "", lang);
              const updatedExams = (user.exams || []).map(e => {
                  if (e.id === activeExam?.id) {
                      return {
                          ...e,
                          tickets: e.tickets.map(t => t.id === ticket.id ? { ...t, note } : t)
                      };
                  }
                  return e;
              });
              onUpdateProfile({ ...user, exams: updatedExams });
              if (activeExam) {
                  setActiveExam(updatedExams.find(e => e.id === activeExam.id) || null);
                  setActiveTicket({ ...ticket, note });
              }
          } catch(e) {
              console.error(e);
          } finally {
              setIsGeneratingNote(false);
          }
      }
  };

  const startQuiz = async () => {
      if (!activeTicket) return;
      setIsGeneratingQuiz(true);
      try {
          const questions = await generateQuiz(activeTicket.question, activeExam?.subject || "", lang, 5);
          setQuizQuestions(questions);
          setTicketMode('quiz');
          setCurrentQuizStep(0);
          setQuizScore(0);
      } catch (e) {
          console.error(e);
      } finally {
          setIsGeneratingQuiz(false);
      }
  };

  const handleAnswer = (index: number) => {
      if (currentQuizStep === null) return;
      setSelectedAnswer(index);
      const isCorrect = index === quizQuestions[currentQuizStep].correctIndex;
      setAnswerFeedback(isCorrect ? 'correct' : 'incorrect');
      
      setTimeout(() => {
          if (isCorrect) setQuizScore(s => s + 1);
          
          if (currentQuizStep < quizQuestions.length - 1) {
              setCurrentQuizStep(s => (s !== null ? s + 1 : null));
              setSelectedAnswer(null);
              setAnswerFeedback(null);
          } else {
              finishQuiz(isCorrect ? quizScore + 1 : quizScore);
          }
      }, 1000);
  };

  const finishQuiz = (finalScore: number) => {
      if (!activeTicket || !activeExam) return;
      const percentage = (finalScore / quizQuestions.length) * 100;
      
      const updatedExams = (user.exams || []).map(e => {
          if (e.id === activeExam.id) {
              return {
                  ...e,
                  tickets: e.tickets.map(t => t.id === activeTicket.id ? { ...t, lastScore: percentage } : t)
              };
          }
          return e;
      });
      onUpdateProfile({ ...user, exams: updatedExams });
      setActiveExam(updatedExams.find(e => e.id === activeExam.id) || null);
      setTicketMode('result');
  };

  if (showWizard) {
      return (
          <div className="animate-fadeIn pb-32">
              <div className="flex justify-between items-center mb-6 px-1">
                  <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t.examNewExam}</h2>
                  <button onClick={() => setShowWizard(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)]"><X size={20}/></button>
              </div>
              <GlassCard className="p-6 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[32px]">
                  {wizardStep === 1 && (
                      <div className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t.examSubject}</label>
                              <GlassInput value={newExam.subject} onChange={e => setNewExam({...newExam, subject: e.target.value})} placeholder="e.g. History" />
                          </div>
                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t.date || "Date"}</label>
                              <input type="date" value={newExam.date} onChange={e => setNewExam({...newExam, date: e.target.value})} className="w-full h-12 bg-black/5 border border-white/10 rounded-2xl px-4 text-[var(--text-primary)] text-sm" />
                          </div>
                          <button onClick={() => setWizardStep(2)} disabled={!newExam.subject} className="w-full h-14 bg-[var(--bg-active)] rounded-2xl text-[var(--bg-active-text)] font-black uppercase tracking-widest text-[11px] mt-4 disabled:opacity-50">{t.next}</button>
                      </div>
                  )}
                  {wizardStep === 2 && (
                      <div className="space-y-6">
                          <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t.examPasteQuestions}</label>
                              <GlassTextArea value={rawTicketsText} onChange={e => setRawTicketsText(e.target.value)} placeholder="1. Question... 2. Question..." className="h-48" />
                          </div>
                          <button onClick={handleWizardParse} disabled={isWizardProcessing} className="w-full h-14 bg-[var(--bg-active)] rounded-2xl text-[var(--bg-active-text)] font-black uppercase tracking-widest text-[11px] mt-4 flex items-center justify-center gap-2">
                              {isWizardProcessing ? <Loader2 className="animate-spin" /> : <><Sparkles size={16}/> {t.examParseAI}</>}
                          </button>
                      </div>
                  )}
                  {wizardStep === 3 && (
                      <div className="space-y-6">
                          <div className="flex items-center justify-between">
                              <h3 className="text-sm font-bold text-[var(--text-primary)]">{newExam.tickets?.length} tickets found</h3>
                          </div>
                          <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
                              {newExam.tickets?.map((t, i) => (
                                  <div key={i} className="p-3 bg-white/5 rounded-xl text-[12px] font-medium text-[var(--text-secondary)]">
                                      <span className="font-bold text-indigo-400 mr-2">#{t.number}</span> {t.question}
                                  </div>
                              ))}
                          </div>
                          <button onClick={handleWizardFinalize} disabled={isWizardProcessing} className="w-full h-14 bg-[var(--bg-active)] rounded-2xl text-[var(--bg-active-text)] font-black uppercase tracking-widest text-[11px] mt-4 flex items-center justify-center gap-2">
                              {isWizardProcessing ? <Loader2 className="animate-spin" /> : t.save}
                          </button>
                      </div>
                  )}
              </GlassCard>
          </div>
      );
  }

  if (activeTicket) {
      return (
          <div className="animate-fadeIn pb-32 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4 px-1">
                  <button onClick={() => setActiveTicket(null)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)]"><ChevronLeft size={20}/></button>
                  <h2 className="text-sm font-bold text-[var(--text-primary)] line-clamp-1 flex-1">{activeTicket.question}</h2>
              </div>

              {ticketMode === 'note' && (
                  <GlassCard className="flex-1 overflow-hidden flex flex-col p-0 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[32px]">
                      {isGeneratingNote ? (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4">
                              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t.thinking}</p>
                          </div>
                      ) : (
                          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                              {activeTicket.note ? <NoteRenderer text={activeTicket.note} lang={lang} /> : <div className="text-center opacity-50 mt-10">No content</div>}
                          </div>
                      )}
                      <div className="p-4 border-t border-[var(--border-glass)] bg-black/20 backdrop-blur-md">
                          <button onClick={startQuiz} className="w-full h-14 bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                              <BrainCircuit size={18} /> {lang === 'ru' ? 'Проверить себя' : 'Take Quiz'}
                          </button>
                      </div>
                  </GlassCard>
              )}

              {ticketMode === 'quiz' && (
                  <GlassCard className="flex-1 flex flex-col p-6 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[32px] relative overflow-hidden">
                      {isGeneratingQuiz ? (
                          <div className="flex-1 flex flex-col items-center justify-center gap-4">
                              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{lang === 'ru' ? 'Готовлю вопросы...' : 'Preparing questions...'}</p>
                          </div>
                      ) : (
                          currentQuizStep !== null && quizQuestions[currentQuizStep] && (
                              <div className="flex-1 flex flex-col gap-6 animate-fade-in-up">
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'ВОПРОС' : 'QUESTION'} {currentQuizStep + 1}/{quizQuestions.length}</span>
                                      <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-black border border-indigo-500/20">{quizScore} pts</span>
                                  </div>
                                  <h3 className="text-lg font-bold text-[var(--text-primary)] leading-snug">{quizQuestions[currentQuizStep].question}</h3>
                                  <div className="grid gap-3 mt-auto">
                                      {quizQuestions[currentQuizStep].options.map((opt, idx) => {
                                          let stateClass = "bg-white/5 border-[var(--border-glass)] text-[var(--text-primary)]";
                                          if (selectedAnswer !== null) {
                                              if (idx === quizQuestions[currentQuizStep].correctIndex) stateClass = "bg-emerald-500 text-white border-emerald-600";
                                              else if (idx === selectedAnswer) stateClass = "bg-rose-500 text-white border-rose-600";
                                              else stateClass = "opacity-50 bg-white/5 border-transparent";
                                          }
                                          return (
                                              <button 
                                                key={idx} 
                                                onClick={() => handleAnswer(idx)}
                                                disabled={selectedAnswer !== null}
                                                className={`p-4 rounded-xl text-[13px] font-medium text-left transition-all border ${stateClass}`}
                                              >
                                                  {opt}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          )
                      )}
                  </GlassCard>
              )}

              {ticketMode === 'result' && (
                  <GlassCard className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[32px] text-center gap-6">
                      <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                          <Trophy size={48} className="text-indigo-400" />
                      </div>
                      <div>
                          <h2 className="text-3xl font-black text-[var(--text-primary)]">{quizScore} / {quizQuestions.length}</h2>
                          <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mt-2">{lang === 'ru' ? 'Результат' : 'Result'}</p>
                      </div>
                      <button onClick={() => setTicketMode('note')} className="px-8 py-4 bg-white/10 rounded-full text-[var(--text-primary)] font-bold text-xs hover:bg-white/20 transition-all">{t.back}</button>
                  </GlassCard>
              )}
          </div>
      );
  }

  // --- FLASHCARDS MODE ---
  if (isFlashcardSession && activeExam && activeExam.flashcards && activeExam.flashcards.length > 0) {
      const card = activeExam.flashcards[currentCardIndex];
      return (
          <div className="animate-fadeIn pb-32 h-full flex flex-col">
              <div className="flex justify-between items-center mb-6 px-2">
                  <button onClick={() => setIsFlashcardSession(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)]"><X size={20}/></button>
                  <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{currentCardIndex + 1} / {activeExam.flashcards.length}</span>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center perspective-1000 relative">
                  <div 
                    onClick={() => setIsFlipped(!isFlipped)}
                    className={`w-full aspect-[3/4] relative transition-all duration-500 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                  >
                      {/* Front */}
                      <GlassCard className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[40px] text-center">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Question</span>
                          <p className="text-xl font-bold text-[var(--text-primary)]">{card.question}</p>
                          <p className="absolute bottom-8 text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-50">Tap to flip</p>
                      </GlassCard>

                      {/* Back */}
                      <GlassCard className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center p-8 bg-indigo-600 border-indigo-500 rounded-[40px] text-center shadow-2xl">
                          <span className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-4">Answer</span>
                          <p className="text-lg font-medium text-white leading-relaxed">{card.answer}</p>
                      </GlassCard>
                  </div>
              </div>

              <div className="flex gap-4 mt-8 px-4">
                  <button 
                    onClick={() => {
                        setIsFlipped(false);
                        setCurrentCardIndex(prev => Math.max(0, prev - 1));
                    }}
                    disabled={currentCardIndex === 0}
                    className="flex-1 h-14 rounded-2xl bg-white/5 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-secondary)] disabled:opacity-30"
                  >
                      <ChevronLeft />
                  </button>
                  <button 
                    onClick={() => {
                        if (currentCardIndex < activeExam.flashcards.length - 1) {
                            setIsFlipped(false);
                            setTimeout(() => setCurrentCardIndex(prev => prev + 1), 150);
                        } else {
                            setIsFlashcardSession(false);
                        }
                    }}
                    className="flex-1 h-14 rounded-2xl bg-[var(--bg-active)] text-[var(--bg-active-text)] font-black uppercase tracking-widest text-[11px] shadow-lg active:scale-95 transition-all"
                  >
                      {currentCardIndex < activeExam.flashcards.length - 1 ? t.next : 'Finish'}
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-32">
        <header className="flex justify-between items-center px-1">
            <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{t.examAcademy}</h1>
                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.2em]">{t.examHubDesc}</p>
            </div>
            <button onClick={() => setShowWizard(true)} className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20"><Plus size={20}/></button>
        </header>

        {activeExam ? (
            <>
                <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-[var(--border-glass)] overflow-x-auto">
                    {(user.exams || []).map(ex => (
                        <button 
                            key={ex.id} 
                            onClick={() => setActiveExam(ex)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${activeExam.id === ex.id ? 'bg-indigo-500 text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {ex.subject}
                        </button>
                    ))}
                </div>

                <GlassCard className="p-6 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[32px] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-10">
                        <BookOpen size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">{activeExam.subject}</h2>
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mt-1">{getDaysLeft(activeExam.date)} days left</p>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-black text-xs border-4 border-[var(--bg-card)] shadow-xl">
                                {calculateExamProgress(activeExam)}%
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => { setIsFlashcardSession(true); setCurrentCardIndex(0); setIsFlipped(false); }}
                                className="flex-1 h-12 bg-white/10 rounded-xl flex items-center justify-center gap-2 text-[var(--text-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5"
                            >
                                <Layers size={14} /> Flashcards
                            </button>
                            {/* More actions can go here */}
                        </div>
                    </div>
                </GlassCard>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <FileText size={14} className="text-[var(--text-secondary)]" />
                        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">{lang === 'ru' ? 'БИЛЕТЫ' : 'TICKETS'}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {activeExam.tickets.map(ticket => (
                            <div 
                                key={ticket.id} 
                                onClick={() => openTicket(ticket)}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group active:scale-[0.98] ${getTicketColor(ticket.lastScore)}`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-[10px] font-black text-indigo-400 min-w-[24px]">#{ticket.number}</span>
                                    <span className="text-[12px] font-bold text-[var(--text-primary)] truncate">{ticket.question}</span>
                                </div>
                                {ticket.lastScore !== undefined && (
                                    <div className="px-2 py-1 rounded-md bg-black/20 text-[9px] font-black text-[var(--text-primary)]">
                                        {Math.round(ticket.lastScore)}%
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)] opacity-50 gap-4">
                <BookOpen size={40} />
                <p className="text-xs font-bold uppercase tracking-widest">No active exams</p>
            </div>
        )}
    </div>
  );
};
