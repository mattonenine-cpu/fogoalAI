
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EcosystemType, UserProfile, Task, Language, TRANSLATIONS, Practice, Goal, AppView, AppTheme } from '../types';
import { GlassCard, GlassInput, GlassTextArea } from './GlassCard';
import { createChatSession, cleanTextOutput, evaluateProgress, generateFocuVisual, generateDrawingTutorial } from '../services/geminiService';
import { ExamPrepApp } from './ExamPrepApp';
import { SportApp } from './SportApp';
import { HealthApp } from './HealthApp'; 
import { Activity, Bot, Sparkles, Loader2, Send, Brain, CheckCircle, X, ChevronRight, Trophy, Star, TrendingUp, ListTodo, History, Lightbulb, Clock, Check, Dumbbell, Heart, Palette, Image as ImageIcon, Download, Wand2, Share2, Upload, PenTool, LayoutTemplate, Camera, RefreshCcw, Droplet, Pencil, Brush, Highlighter, Quote } from 'lucide-react';

interface EcosystemViewProps {
  type: EcosystemType;
  user: UserProfile;
  tasks: Task[];
  lang: Language;
  onUpdateTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onUpdateProfile: (profile: UserProfile) => void;
  onNavigate: (view: AppView) => void;
  theme: AppTheme;
}

const GET_DRAW_MATERIALS = (lang: Language) => [
    { id: 'Pencil', label: lang === 'ru' ? 'Карандаш' : 'Pencil', icon: <Pencil size={12}/> },
    { id: 'Colored Pencils', label: lang === 'ru' ? 'Цв. карандаши' : 'Colored Pencils', icon: <Palette size={12}/> },
    { id: 'Marker', label: lang === 'ru' ? 'Маркер' : 'Marker', icon: <Highlighter size={12}/> },
    { id: 'Watercolor', label: lang === 'ru' ? 'Акварель' : 'Watercolor', icon: <Droplet size={12}/> },
    { id: 'Charcoal', label: lang === 'ru' ? 'Уголь' : 'Charcoal', icon: <span className="w-3 h-3 bg-black rounded-sm block"/> },
    { id: 'Oil Paint', label: lang === 'ru' ? 'Масло' : 'Oil Paint', icon: <Brush size={12}/> }
];

const GET_ART_STYLES = (lang: Language) => [
    { label: lang === 'ru' ? 'Реализм' : 'Realism', value: 'photorealistic, 8k, highly detailed, realistic texture, photography' },
    { label: lang === 'ru' ? 'Киберпанк' : 'Cyberpunk', value: 'cyberpunk style, neon lights, futuristic, night city, high contrast' },
    { label: lang === 'ru' ? 'Масло' : 'Oil Painting', value: 'oil painting texture, visible brushstrokes, artistic, impressionism' },
    { label: lang === 'ru' ? '3D Рендер' : '3D Render', value: '3D render, blender, octane render, isometric, unreal engine 5' },
    { label: lang === 'ru' ? 'Аниме' : 'Anime', value: 'anime style, studio ghibli, vibrant colors, detailed background' },
    { label: lang === 'ru' ? 'Пиксель-арт' : 'Pixel Art', value: 'pixel art, 16-bit, retro game style, low res' },
    { label: lang === 'ru' ? 'Акварель' : 'Watercolor', value: 'watercolor painting, soft edges, artistic, paper texture, wet on wet' },
    { label: lang === 'ru' ? 'Студийное фото' : 'Studio', value: 'studio lighting, professional photography, clean background, sharp focus' },
    { label: lang === 'ru' ? 'Кинематограф' : 'Cinematic', value: 'cinematic shot, movie scene, dramatic lighting, 35mm film, anamorphic lens' },
    { label: lang === 'ru' ? 'Винтаж' : 'Vintage', value: 'vintage photo, polaroid style, film grain, retro filter, 1990s' },
    { label: lang === 'ru' ? 'Макро' : 'Macro', value: 'macro photography, extreme close-up, depth of field, bokeh, detailed insects/plants' },
    { label: lang === 'ru' ? 'Концепт-арт' : 'Concept Art', value: 'digital concept art, fantasy landscape, epic scale, matte painting' },
    { label: lang === 'ru' ? 'Карандаш' : 'Pencil', value: 'pencil sketch, charcoal drawing, monochrome, hand drawn, rough lines' },
    { label: lang === 'ru' ? 'Поп-арт' : 'Pop Art', value: 'pop art, warhol style, vibrant colors, halftone dots, comic book style' },
    { label: lang === 'ru' ? 'Минимализм' : 'Minimalism', value: 'minimalist, simple lines, clean composition, pastel colors, flat design' },
    { label: lang === 'ru' ? 'Нуар' : 'Noir', value: 'film noir, black and white, high contrast, dramatic shadows, detective style' },
    { label: lang === 'ru' ? 'Стимпанк' : 'Steampunk', value: 'steampunk, gears, brass, victorian era, steam engine, copper' },
    { label: lang === 'ru' ? 'Вейпорвейв' : 'Vaporwave', value: 'vaporwave, aesthetics, glitch art, pastel pink and blue, greek statues, 90s internet' }
];

export const EcosystemView: React.FC<EcosystemViewProps> = ({ type, user, tasks, lang, onUpdateTasks, onUpdateProfile, onNavigate, theme }) => {
  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  
  // -- STATES --
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  const [logValue, setLogValue] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logFeedback, setLogFeedback] = useState<string | null>(null);
  const [productivityScore, setProductivityScore] = useState<number | null>(null);
  
  const [momentum, setMomentum] = useState(() => {
    const saved = localStorage.getItem(`focu_momentum_${type}`);
    return saved ? parseFloat(saved) : 0;
  });

  const [showDomainChat, setShowDomainChat] = useState(false);
  const [domainMessages, setDomainMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [domainInputValue, setDomainInputValue] = useState('');
  const [domainLoading, setDomainLoading] = useState(false);

  // -- CREATIVITY SPECIFIC STATES --
  const [activeTab, setActiveTab] = useState<'canvas' | 'tutorial'>('canvas');
  const [genPrompt, setGenPrompt] = useState('');
  const [genImage, setGenImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [isGenLoading, setIsGenLoading] = useState(false);
  
  const [tutorialPrompt, setTutorialPrompt] = useState('');
  const [tutorialData, setTutorialData] = useState<any | null>(null);
  const [isTutorialLoading, setIsTutorialLoading] = useState(false);
  
  // States for Drawing Tutor
  const [drawStyle, setDrawStyle] = useState<'bw' | 'color'>('bw');
  const [drawDifficulty, setDrawDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [drawMaterial, setDrawMaterial] = useState<string>('Pencil');
  
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [loadingStepImages, setLoadingStepImages] = useState<Record<number, boolean>>({});

  const artStyles = useMemo(() => GET_ART_STYLES(lang), [lang]);
  const drawMaterials = useMemo(() => GET_DRAW_MATERIALS(lang), [lang]);

  // Load history from localStorage
  const [genHistory, setGenHistory] = useState<string[]>(() => {
      try {
          const saved = localStorage.getItem('focu_gen_history');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  // Save history to localStorage whenever it changes, with quota handling
  useEffect(() => {
      try {
          localStorage.setItem('focu_gen_history', JSON.stringify(genHistory));
      } catch (e) {
          console.warn("Storage quota exceeded, trimming history...");
          // Keep only the latest 2 images to stay within limits
          try {
              const trimmed = genHistory.slice(0, 2);
              localStorage.setItem('focu_gen_history', JSON.stringify(trimmed));
          } catch (e2) {
              console.error("Failed to save history subset", e2);
          }
      }
  }, [genHistory]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const practiceSessionRef = useRef<any>(null);
  const domainSessionRef = useRef<any>(null);

  // ... (keeping existing computed logic for progress, etc.) ...
  const domainTasks = useMemo(() => tasks.filter(task => task.category.toLowerCase() === type.toLowerCase()), [tasks, type]);
  const pendingDomainTasks = useMemo(() => domainTasks.filter(task => !task.completed), [domainTasks]);
  
  const progress = useMemo(() => {
      const taskWeight = 0.4;
      const goalWeight = 0.4;
      const momentumWeight = 0.2;

      const completedCount = domainTasks.filter(task => task.completed).length;
      const totalCount = domainTasks.length;
      const taskProgress = totalCount > 0 ? (completedCount / totalCount) : 0;

      const relevantGoals = (user.goals || []).filter(g => {
        const title = g.title.toLowerCase();
        const category = type.toLowerCase();
        return title.includes(category) || 
               (category === 'sport' && (title.includes('зал') || title.includes('трени') || title.includes('фит'))) ||
               (category === 'work' && (title.includes('раб') || title.includes('дел') || title.includes('проект'))) ||
               (category === 'study' && (title.includes('уч') || title.includes('кур') || title.includes('чит')));
      });
      
      const goalProgress = relevantGoals.length > 0 
        ? relevantGoals.reduce((acc, g) => acc + (g.progress / g.target), 0) / relevantGoals.length
        : taskProgress;

      if (totalCount === 0 && relevantGoals.length === 0) {
          const activityBonus = Math.min(0.5, (user.activityHistory || []).filter(h => h.startsWith(`${type.toUpperCase()}: `)).length * 0.05);
          return Math.min(100, (momentum + activityBonus) * 100);
      }

      const finalProgress = (taskProgress * taskWeight + goalProgress * goalWeight + momentum * momentumWeight) * 100;
      return Math.min(100, finalProgress);
  }, [domainTasks, user.goals, type, momentum, user.activityHistory]);

  useEffect(() => {
    localStorage.setItem(`focu_momentum_${type}`, momentum.toString());
  }, [momentum, type]);

  const domainInsight = useMemo(() => {
      const insights: Record<string, string[]> = {
          work: [
              lang === 'ru' ? "Начните с самой сложной задачи, пока когнитивный ресурс на пике." : "Start with your hardest task while your cognitive resource is at its peak.",
              lang === 'ru' ? "Глубокая работа требует минимум 90 минут без уведомлений." : "Deep work requires at least 90 minutes without notifications."
          ],
          sport: [
              lang === 'ru' ? "Сегодня отличный день для работы над техникой, а не весом." : "Today is a great day to focus on technique over weight.",
              lang === 'ru' ? "Восстановление — это часть тренировки. Не пренебрегайте сном." : "Recovery is part of training. Don't neglect sleep."
          ],
          study: [
              lang === 'ru' ? "Попробуйте метод Фейнмана: объясните тему вслух воображаемому ученику." : "Try the Feynman technique: explain the topic aloud to an imaginary student.",
              lang === 'ru' ? "Активное припоминание эффективнее простого чтения конспектов." : "Active recall is more effective than just reading notes."
          ],
          health: [
              lang === 'ru' ? "Маленькие шаги в питании дают огромный эффект через год." : "Small dietary changes lead to massive effects in a year.",
              lang === 'ru' ? "Медитация на 5 минут лучше, чем отсутствие медитации." : "5 minutes of meditation is better than no meditation at all."
          ],
          creativity: [
              lang === 'ru' ? "Количество рождает качество. Просто начните творить." : "Quantity breeds quality. Just start creating.",
              lang === 'ru' ? "Смена обстановки может разблокировать новые идеи." : "A change of environment can unlock new ideas."
          ]
      };
      const list = insights[type] || [lang === 'ru' ? "Фокус — это мышца. Тренируйте её каждый день." : "Focus is a muscle. Train it every day."];
      return list[Math.floor(Math.random() * list.length)];
  }, [type, lang]);

  const workQuotes = useMemo(() => {
    if (lang === 'ru') {
        return [
            { text: "Ваше время ограничено, не тратьте его, живя чужой жизнью.", author: "Стив Джобс" },
            { text: "Успех — это способность идти от поражения к поражению, не теряя энтузиазма.", author: "Уинстон Черчилль" },
            { text: "Лучший способ предсказать будущее — создать его.", author: "Питер Друкер" },
            { text: "Не бойтесь отказаться от хорошего, ради великого.", author: "Джон Д. Рокфеллер" },
            { text: "Гений — это 1% вдохновения и 99% пота.", author: "Томас Эдисон" },
            { text: "Логика приведет вас из пункта А в пункт Б. Воображение приведет вас куда угодно.", author: "Альберт Эйнштейн" }
        ];
    }
    return [
        { text: "Your time is limited, so don't waste it living someone else's life.", author: "Steve Jobs" },
        { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
        { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
        { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },
        { text: "Genius is 1% inspiration and 99% perspiration.", author: "Thomas Edison" },
        { text: "Logic will get you from A to B. Imagination will take you everywhere.", author: "Albert Einstein" }
    ];
  }, [lang]);

  const randomQuote = useMemo(() => workQuotes[Math.floor(Math.random() * workQuotes.length)], [workQuotes]);

  const practices = useMemo((): Practice[] => {
      const isRu = lang === 'ru';
      const data: Record<string, Practice[]> = {
          sport: [
              { id: 'ar', name: isRu ? "Активное восстановление" : "Active Recovery", description: isRu ? "Легкая активность для восстановления." : "Light activity to recover." },
              { id: 'tr', name: isRu ? "Тренировочный сброс" : "Training Reset", description: isRu ? "Фокус на технике." : "Focus on technique." }
          ],
          work: [
              { id: 'dw', name: isRu ? "Глубокая работа" : "Deep Work", description: isRu ? "Блок полной тишины." : "Total focus block." },
              { id: 'fs', name: isRu ? "Спринт фокуса" : "Focus Sprint", description: isRu ? "25 минут без отвлечений." : "25 min focus." }
          ]
      };
      return data[type] || [
          { id: 'dr', name: isRu ? "Ежедневная рутина" : "Daily Routine", description: isRu ? "Поддержание порядка." : "Maintain order." }
      ];
  }, [type, lang]);

  // -- HANDLERS --

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  
                  // Max dimension 1024 to save bandwidth and fit model constraints if any
                  const MAX_SIZE = 1024;
                  if (width > height) {
                      if (width > MAX_SIZE) {
                          height *= MAX_SIZE / width;
                          width = MAX_SIZE;
                      }
                  } else {
                      if (height > MAX_SIZE) {
                          width *= MAX_SIZE / height;
                          height = MAX_SIZE;
                      }
                  }
                  
                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                      ctx.drawImage(img, 0, 0, width, height);
                      // Use jpeg for better compression
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                      setRefImage(dataUrl);
                  } else {
                      // Fallback
                      setRefImage(event.target?.result as string);
                  }
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  const handleGenerateArt = async () => {
      if (!genPrompt.trim() || isGenLoading) return;
      setIsGenLoading(true);
      try {
          const image = await generateFocuVisual(genPrompt, refImage || undefined);
          if (image) {
              setGenImage(image);
              setGenHistory(prev => [image, ...prev].slice(0, 10)); // Limit in-memory history too
              
              let newXp = (user.totalExperience || 0) + 15;
              onUpdateProfile({ 
                  ...user, 
                  totalExperience: newXp,
                  activityHistory: [...(user.activityHistory || []), `CREATIVITY: Generated art`]
              });
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsGenLoading(false);
      }
  };

  const generateAllStepImages = async (steps: any[]) => {
      let previousImage: string | null = null;
      
      for (let i = 0; i < steps.length; i++) {
          setLoadingStepImages(prev => ({ ...prev, [i]: true }));
          
          const step = steps[i];
          const stylePrompt = drawStyle === 'color' 
            ? `${drawMaterial} drawing on white background. Vivid colors.` 
            : `Monochrome ${drawMaterial} drawing on pure white background. Sharp lines.`;
            
          const prompt = `A drawing on a PURE WHITE BACKGROUND. NO table, NO pencils, NO hands, NO background elements. Only the drawing itself. Material: ${drawMaterial}. Instruction: ${step.visualPrompt}. Strictly cumulative additive progression.`;
          
          try {
              const image = await generateFocuVisual(prompt, previousImage || undefined);
              if (image) {
                  setStepImages(prev => ({ ...prev, [i]: image }));
                  previousImage = image; // Chaining for consistency
              }
          } catch (e) {
              console.error(`Failed to generate step ${i}`, e);
          } finally {
              setLoadingStepImages(prev => ({ ...prev, [i]: false }));
          }
      }
  };

  const handleGenerateTutorial = async () => {
      if (!tutorialPrompt.trim() || isTutorialLoading) return;
      setIsTutorialLoading(true);
      setStepImages({});
      try {
          const data = await generateDrawingTutorial(tutorialPrompt, lang, drawStyle, drawDifficulty, drawMaterial);
          setTutorialData(data);
          
          let newXp = (user.totalExperience || 0) + 20;
          onUpdateProfile({ 
              ...user, 
              totalExperience: newXp,
              activityHistory: [...(user.activityHistory || []), `CREATIVITY: Drawing Tutorial: ${tutorialPrompt}`]
          });

          if (data && data.steps && data.steps.length > 0) {
              generateAllStepImages(data.steps);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsTutorialLoading(false);
      }
  };

  const downloadImage = (base64Data: string) => {
      const link = document.createElement('a');
      link.href = base64Data;
      link.download = `focu-art-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handlePracticeSend = async () => {
    if (!inputValue.trim() || chatLoading) return;
    const text = inputValue.trim();
    setMessages(prev => [...prev, {role: 'user', text}]);
    setInputValue('');
    setChatLoading(true);

    const streamIdx = Date.now();
    setMessages(prev => [...prev, {role: 'model', text: '', _streamId: streamIdx} as any]);

    try {
        if (!practiceSessionRef.current) {
            practiceSessionRef.current = createChatSession(user, [], lang, domainTasks, type);
        }
        await practiceSessionRef.current.sendMessage({ 
            message: text,
            onChunk: (fullText: string) => {
                setMessages(prev => prev.map((m: any) => m._streamId === streamIdx ? {...m, text: cleanTextOutput(fullText)} : m));
            }
        });
    } catch (e) {
        setMessages(prev => prev.map((m: any) => m._streamId === streamIdx ? {...m, text: t.chatError} : m));
    } finally {
        setChatLoading(false);
    }
  };

  const handleDomainSend = async () => {
    if (!domainInputValue.trim() || domainLoading) return;
    const text = domainInputValue.trim();
    setDomainMessages(prev => [...prev, {role: 'user', text}]);
    setDomainInputValue('');
    setDomainLoading(true);

    const streamIdx = Date.now();
    setDomainMessages(prev => [...prev, {role: 'model', text: '', _streamId: streamIdx} as any]);

    try {
        if (!domainSessionRef.current) {
            domainSessionRef.current = createChatSession(user, [], lang, domainTasks, type);
        }
        await domainSessionRef.current.sendMessage({ 
            message: text,
            onChunk: (fullText: string) => {
                setDomainMessages(prev => prev.map((m: any) => m._streamId === streamIdx ? {...m, text: cleanTextOutput(fullText)} : m));
            }
        });
    } catch (e) {
        setDomainMessages(prev => prev.map((m: any) => m._streamId === streamIdx ? {...m, text: t.chatError} : m));
    } finally {
        setDomainLoading(false);
    }
  };

  const handleLogProgress = async () => {
      if (!logValue.trim() || isLogging) return;
      setIsLogging(true);
      setLogFeedback(null);
      setProductivityScore(null);

      try {
          const evalResult = await evaluateProgress(logValue, domainTasks, user.goals || [], type, lang);
          // ... (Progress evaluation logic)
          const isUseful = evalResult.productivityScore > 0 || 
                           evalResult.generalProgressAdd > 0 || 
                           evalResult.updatedTaskIds.length > 0 || 
                           evalResult.goalUpdates.length > 0;

          if (!isUseful) {
              setLogFeedback(evalResult.feedback || (lang === 'ru' ? "Действие не распознано как полезное для этой сферы." : "Action not recognized as productive for this sphere."));
              setLogValue('');
              setTimeout(() => setLogFeedback(null), 4000);
              return;
          }

          if (evalResult.updatedTaskIds.length > 0) {
              onUpdateTasks(prev => prev.map(tk => evalResult.updatedTaskIds.includes(tk.id) ? { ...tk, completed: true } : tk));
          }
          
          const updatedGoals = (user.goals || []).map(g => {
              const update = evalResult.goalUpdates.find((u: any) => u.id === g.id);
              if (update) {
                  const newProgress = Math.min(g.target, g.progress + update.progressAdd);
                  return { ...g, progress: newProgress, completed: newProgress >= g.target };
              }
              return g;
          });
          
          if (evalResult.generalProgressAdd > 0) {
              setMomentum(prev => Math.min(1, prev + evalResult.generalProgressAdd));
          }

          let newXp = (user.totalExperience || 0) + (evalResult.productivityScore || 0);
          let newLevel = user.level || 1;
          
          while (newXp >= newLevel * 100) {
              newXp -= newLevel * 100;
              newLevel += 1;
          }

          onUpdateProfile({ 
              ...user, 
              goals: updatedGoals,
              activityHistory: [...(user.activityHistory || []), `${type.toUpperCase()}: ${logValue}`],
              totalExperience: newXp,
              level: newLevel
          });
          
          setLogFeedback(evalResult.feedback);
          setProductivityScore(evalResult.productivityScore);
          setLogValue('');
          
          setTimeout(() => {
              setLogFeedback(null);
              setProductivityScore(null);
          }, 6000);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLogging(false);
      }
  };

  const handleToggleTask = (id: string) => {
    onUpdateTasks(prev => prev.map(tk => tk.id === id ? { ...tk, completed: !tk.completed } : tk));
  };

  const ecoLabel = t[`eco_${type}` as keyof typeof t] || type;

  // -- RENDERERS --

  if (type === 'study') {
      return (
          <div className="animate-fadeIn pb-32">
              <ExamPrepApp 
                user={user} 
                lang={lang} 
                onUpdateProfile={onUpdateProfile} 
                theme={theme}
              />
          </div>
      );
  }

  if (type === 'sport') {
      return (
        <div className="animate-fadeIn pb-32">
            <header className="flex justify-between items-center px-1 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase">{lang === 'ru' ? 'Атлетика' : 'Athletics'}</h1>
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-[0.2em]">{t.sportHubSub}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-400 shadow-xl border border-orange-500/20">
                    <Dumbbell size={24} />
                </div>
            </header>
            <SportApp user={user} lang={lang} onUpdateProfile={onUpdateProfile} onAddTasks={(newTasks) => onUpdateTasks(prev => [...prev, ...newTasks])} theme={theme} />
        </div>
      );
  }

  if (type === 'health') {
      return (
        <div className="animate-fadeIn pb-32">
            <HealthApp user={user} lang={lang} onUpdateProfile={onUpdateProfile} theme={theme} />
        </div>
      );
  }

  if (type === 'creativity') {
      return (
          <div className="animate-fadeIn pb-32 space-y-6">
              <header className="flex justify-between items-center px-1 mb-2">
                  <div>
                      <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase">{lang === 'ru' ? 'Арт Студия' : 'Art Studio'}</h1>
                      <p className="text-[10px] text-purple-500 font-black uppercase tracking-[0.2em]">{lang === 'ru' ? 'Воображение без границ' : 'Limitless Imagination'}</p>
                  </div>
                   <button 
                    onClick={() => { setShowDomainChat(true); setDomainMessages([{role: 'model', text: lang === 'ru' ? `Привет! Я твой муза. Что создадим?` : `Hello! I'm your muse. What shall we create?`}]); }}
                    className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20"
                  >
                      <Bot size={20} />
                  </button>
              </header>

              <div className="flex bg-white/5 p-1 rounded-full border border-[var(--border-glass)]">
                  <button 
                    onClick={() => setActiveTab('canvas')}
                    className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'canvas' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                      {lang === 'ru' ? 'ИИ Холст' : 'AI Canvas'}
                  </button>
                  <button 
                    onClick={() => setActiveTab('tutorial')}
                    className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'tutorial' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                  >
                      {lang === 'ru' ? 'Туториал' : 'Tutor'}
                  </button>
              </div>

              {activeTab === 'canvas' ? (
                  <>
                    <GlassCard className="p-6 border-[var(--border-glass)] rounded-[32px] bg-[var(--bg-card)] shadow-2xl relative overflow-hidden">
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                        
                        {genImage ? (
                            <div className="space-y-4 animate-fade-in-up">
                                <div className="relative rounded-[24px] overflow-hidden shadow-xl border border-white/10 group">
                                    <img src={genImage} alt="Generated Art" className="w-full h-auto object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                                        <button onClick={() => downloadImage(genImage)} className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all border border-white/20"><Download size={20}/></button>
                                        <button onClick={() => setGenImage(null)} className="p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all border border-white/20"><X size={20}/></button>
                                    </div>
                                </div>
                                <button onClick={() => setGenImage(null)} className="w-full py-3 text-[10px] font-bold text-purple-400 uppercase tracking-widest border border-purple-500/20 rounded-xl hover:bg-purple-500/10 transition-colors">
                                    {lang === 'ru' ? 'Создать еще' : 'Create New'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{lang === 'ru' ? 'ПРОМПТ' : 'PROMPT'}</label>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                                    <button onClick={() => fileInputRef.current?.click()} className={`flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider transition-all ${refImage ? 'text-purple-400' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                                        {refImage ? (lang === 'ru' ? 'Изображение выбрано' : 'Image Selected') : (lang === 'ru' ? '+ Референс' : '+ Reference')}
                                    </button>
                                </div>
                                
                                {refImage && (
                                    <div className="relative w-full h-20 rounded-xl overflow-hidden border border-white/10 group">
                                        <img src={refImage} className="w-full h-full object-cover opacity-60" alt="Reference" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <button onClick={() => { setRefImage(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 bg-black/50 rounded-full text-white"><X size={14} /></button>
                                        </div>
                                    </div>
                                )}

                                <GlassTextArea 
                                    value={genPrompt} 
                                    onChange={e => setGenPrompt(e.target.value)} 
                                    placeholder={lang === 'ru' ? "Опишите вашу идею..." : "Describe your idea..."} 
                                    className="h-32 rounded-[20px] text-sm resize-none bg-black/5 focus:bg-black/10" 
                                />
                                
                                <div>
                                    <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'СТИЛЬ' : 'STYLE'}</label>
                                    <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto scrollbar-hide">
                                        {artStyles.map(style => {
                                            const isSelected = genPrompt.includes(style.value);
                                            return (
                                                <button 
                                                    key={style.label} 
                                                    onClick={() => {
                                                        setGenPrompt(prev => {
                                                            if (prev.includes(style.value)) {
                                                                return prev.replace(style.value, '').replace(/,\s*,/g, ', ').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                                                            } else {
                                                                return prev + (prev.trim() && !prev.trim().endsWith(',') ? ', ' : '') + style.value;
                                                            }
                                                        });
                                                    }} 
                                                    className={`px-3 py-1.5 rounded-xl border text-[9px] font-bold uppercase tracking-wider transition-all ${
                                                        isSelected 
                                                        ? 'bg-purple-600 border-purple-600 text-white' 
                                                        : 'bg-white/5 border-transparent text-[var(--text-secondary)] hover:bg-white/10'
                                                    }`}
                                                >
                                                    {style.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button 
                                    onClick={handleGenerateArt} 
                                    disabled={!genPrompt.trim() || isGenLoading} 
                                    className="w-full h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-[20px] font-black uppercase text-[11px] shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                                >
                                    {isGenLoading ? <Loader2 className="animate-spin" size={18}/> : (lang === 'ru' ? 'СГЕНЕРИРОВАТЬ' : 'GENERATE')}
                                </button>
                            </div>
                        )}
                    </GlassCard>

                    {genHistory.length > 0 && (
                        <div className="space-y-3 animate-fade-in-up">
                            <div className="flex items-center gap-2 px-2">
                                <ImageIcon size={14} className="text-slate-500" />
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{lang === 'ru' ? 'Галерея' : 'Gallery'}</h3>
                            </div>
                            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-4 px-1">
                                {genHistory.map((img, i) => (
                                    <div key={i} className="relative shrink-0 w-24 h-24 rounded-2xl overflow-hidden border border-white/10 group cursor-pointer" onClick={() => setGenImage(img)}>
                                        <img src={img} className="w-full h-full object-cover" alt="History" />
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                  </>
              ) : (
                  <div className="space-y-6 animate-fadeIn">
                      <GlassCard className="p-6 border-[var(--border-glass)] rounded-[32px] bg-[var(--bg-card)] shadow-2xl space-y-6">
                          <div className="space-y-4">
                              <div>
                                  <label className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'ЗАПРОС' : 'QUERY'}</label>
                                  <div className="flex gap-2">
                                      <GlassInput 
                                        value={tutorialPrompt} 
                                        onChange={e => setTutorialPrompt(e.target.value)} 
                                        placeholder={lang === 'ru' ? 'Напр: Кот' : 'e.g. Cat'} 
                                        onKeyDown={e => e.key === 'Enter' && handleGenerateTutorial()} 
                                        className="rounded-[18px]"
                                      />
                                      <button onClick={handleGenerateTutorial} disabled={isTutorialLoading || !tutorialPrompt.trim()} className="w-14 h-12 rounded-[18px] bg-[var(--bg-active)] text-[var(--bg-active-text)] flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-50">
                                          {isTutorialLoading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                                      </button>
                                  </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'СЛОЖНОСТЬ' : 'DIFFICULTY'}</label>
                                      <div className="relative">
                                        <select value={drawDifficulty} onChange={e => setDrawDifficulty(e.target.value as any)} className="w-full h-12 bg-white/5 border border-[var(--border-glass)] rounded-[18px] px-4 text-[11px] font-bold text-[var(--text-primary)] outline-none appearance-none">
                                            <option value="Easy" className="bg-[#18181b]">Easy</option>
                                            <option value="Medium" className="bg-[#18181b]">Medium</option>
                                            <option value="Hard" className="bg-[#18181b]">Hard</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]">▼</div>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'РЕЖИМ' : 'MODE'}</label>
                                      <div className="flex bg-white/5 p-1 rounded-[18px] border border-[var(--border-glass)] h-12">
                                          <button onClick={() => setDrawStyle('bw')} className={`flex-1 rounded-[14px] text-[9px] font-black uppercase transition-all ${drawStyle === 'bw' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)]' : 'text-[var(--text-secondary)]'}`}>B&W</button>
                                          <button onClick={() => setDrawStyle('color')} className={`flex-1 rounded-[14px] text-[9px] font-black uppercase transition-all ${drawStyle === 'color' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)]' : 'text-[var(--text-secondary)]'}`}>COL</button>
                                      </div>
                                  </div>
                              </div>

                              <div>
                                  <label className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-2 block">{lang === 'ru' ? 'МАТЕРИАЛ' : 'MATERIAL'}</label>
                                  <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
                                      {drawMaterials.map(m => (
                                          <button 
                                            key={m.id} 
                                            onClick={() => setDrawMaterial(m.id)} 
                                            className={`shrink-0 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all ${drawMaterial === m.id ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] border-transparent' : 'bg-white/5 border-[var(--border-glass)] text-[var(--text-secondary)]'}`}
                                          >
                                              {m.label}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      </GlassCard>

                      {tutorialData && (
                          <div className="space-y-4 animate-fade-in-up">
                              <div className="flex items-center justify-between px-2">
                                  <h3 className="text-lg font-black text-[var(--text-primary)] uppercase">{tutorialData.title}</h3>
                                  <div className="flex items-center gap-2">
                                      <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-slate-400 border border-white/5">{tutorialData.difficulty}</span>
                                      <span className="px-3 py-1 rounded-full bg-white/5 text-[9px] font-black uppercase tracking-widest text-indigo-400 border border-white/5">{tutorialData.estimatedTime}</span>
                                  </div>
                              </div>

                              <div className="space-y-3">
                                  {tutorialData.steps.map((step: any, i: number) => (
                                      <GlassCard key={i} className="p-5 rounded-[24px] bg-[var(--bg-card)] border-[var(--border-glass)] flex flex-col gap-4">
                                          <div className="flex gap-4 items-start">
                                              <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-black text-sm border border-purple-500/20 shrink-0">
                                                  {i + 1}
                                              </div>
                                              <p className="text-[13px] font-bold text-[var(--text-primary)] leading-relaxed mt-1">{step.text}</p>
                                          </div>
                                          
                                          {stepImages[i] ? (
                                              <div className="rounded-[20px] overflow-hidden border border-white/10 mt-2 shadow-lg animate-fade-in-up bg-white">
                                                  <img src={stepImages[i]} alt={`Step ${i+1}`} className="w-full h-auto object-cover" />
                                              </div>
                                          ) : (
                                              <div className="w-full h-48 bg-black/20 rounded-[20px] border border-white/5 flex flex-col items-center justify-center gap-3 animate-pulse">
                                                  {loadingStepImages[i] ? (
                                                      <>
                                                          <Loader2 size={24} className="animate-spin text-purple-400"/>
                                                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{lang === 'ru' ? 'Генерация...' : 'Generating...'}</p>
                                                      </>
                                                  ) : (
                                                      <button onClick={() => generateAllStepImages(tutorialData.steps)} className="text-slate-500 hover:text-white transition-colors flex flex-col items-center gap-2">
                                                          <RefreshCcw size={20} />
                                                          <span className="text-[9px] font-bold uppercase tracking-widest">{lang === 'ru' ? 'Пересчитать' : 'Recalculate'}</span>
                                                      </button>
                                                  )}
                                              </div>
                                          )}
                                      </GlassCard>
                                  ))}
                              </div>

                              {tutorialData.tips && tutorialData.tips.length > 0 && (
                                  <div className="p-5 rounded-[24px] bg-indigo-500/10 border border-indigo-500/20">
                                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Lightbulb size={12}/> {lang === 'ru' ? 'Советы' : 'Pro Tips'}</h4>
                                      <ul className="space-y-2">
                                          {tutorialData.tips.map((tip: string, i: number) => (
                                              <li key={i} className="text-[11px] font-medium text-indigo-100 flex items-start gap-2">
                                                  <span className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0"/>
                                                  {tip}
                                              </li>
                                          ))}
                                      </ul>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              )}
          </div>
      );
  }

  // DEFAULT VIEW (Work) - EXPERT CHAT IS HERE
  return (
    <div className="space-y-6 animate-fadeIn pb-6">
      <header className="flex justify-between items-center px-1">
          <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight uppercase">{ecoLabel}</h1>
              <p className="text-sm text-[var(--text-secondary)] font-medium">{t.ecoState}: {t.stateBalanced}</p>
          </div>
          <button 
            onClick={() => { setShowDomainChat(true); setDomainMessages([{role: 'model', text: lang === 'ru' ? `Привет! Я ИИ-эксперт в сфере ${ecoLabel}. Что обсудим?` : `Hello! I'm an AI expert for ${ecoLabel}. What's on your mind?`}]); }}
            className="px-5 py-2.5 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)] flex items-center gap-2 hover:bg-white/10 transition-all active:scale-95 shadow-lg"
          >
              <Bot size={14} className="text-indigo-400"/>
              {t.navExpert}
          </button>
      </header>

      <section className="space-y-3">
          <GlassCard className="p-6 bg-[var(--bg-card)] border-[var(--border-glass)] shadow-2xl relative overflow-hidden rounded-[32px]">
              <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-amber-400" />
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t.domainProgress}</span>
                  </div>
                  <span className="text-xl font-bold text-[var(--text-primary)] tracking-tighter">{Math.round(progress)}%</span>
              </div>
              <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden mb-6 ring-1 ring-white/5">
                  <div className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.6)]" style={{width: `${progress}%`}} />
              </div>

              {(logFeedback || productivityScore !== null) && (
                  <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-[24px] flex flex-col gap-2 animate-fade-in-up">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Star size={14} className="text-indigo-400" />
                            <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">{t.examResult}</span>
                        </div>
                        {productivityScore !== null && productivityScore > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/20 rounded-full">
                                <TrendingUp size={10} className="text-indigo-400" />
                                <span className="text-[10px] font-bold text-indigo-400">+{productivityScore} XP</span>
                            </div>
                        )}
                      </div>
                      <p className="text-[12px] text-indigo-100 italic leading-snug">{logFeedback}</p>
                  </div>
              )}

              <div className="flex gap-2">
                  <input 
                    value={logValue} 
                    onChange={e => setLogValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogProgress()}
                    placeholder={t.ecoLogPlaceholder}
                    disabled={isLogging}
                    className="flex-1 bg-black/10 border border-[var(--border-glass)] rounded-full px-6 py-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500/20 transition-all placeholder:text-[var(--text-secondary)]"
                  />
                  <button 
                    onClick={handleLogProgress}
                    disabled={isLogging || !logValue.trim()}
                    className="w-12 h-12 bg-[var(--bg-active)] rounded-full flex items-center justify-center text-[var(--bg-active-text)] active:scale-90 transition-all disabled:opacity-30 shadow-2xl"
                  >
                    {isLogging ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} strokeWidth={2.5} />}
                  </button>
              </div>
          </GlassCard>
      </section>

      <section className="animate-fade-in-up delay-100">
          <GlassCard className="p-4 bg-indigo-500/5 border-indigo-500/10 rounded-[28px] flex gap-4 items-center">
              <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Lightbulb size={20} />
              </div>
              <div>
                  <h4 className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1">{t.ecoInsightTitle}</h4>
                  <p className="text-[12px] text-[var(--text-secondary)] leading-snug font-medium italic">"{domainInsight}"</p>
              </div>
          </GlassCard>
      </section>

      <section className="animate-fade-in-up delay-150">
          <GlassCard className="p-6 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-[var(--border-glass)] rounded-[28px] relative overflow-hidden group">
              <Quote className="absolute top-4 right-4 text-[var(--text-secondary)] opacity-10 rotate-180" size={64} />
              <div className="relative z-10">
                  <p className="text-[13px] font-bold text-[var(--text-primary)] leading-relaxed italic mb-3">"{randomQuote.text}"</p>
                  <div className="flex items-center gap-2 justify-end">
                      <div className="h-px w-8 bg-[var(--theme-accent)] opacity-50" />
                      <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{randomQuote.author}</p>
                  </div>
              </div>
          </GlassCard>
      </section>

      {pendingDomainTasks.length > 0 && (
          <section className="animate-fade-in-up delay-200">
              <div className="flex items-center gap-2 mb-3 px-2">
                <ListTodo size={14} className="text-[var(--text-secondary)]" />
                <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t.ecoTasksTitle}</h3>
              </div>
              <div className="space-y-2">
                  {pendingDomainTasks.slice(0, 3).map(tk => (
                      <div 
                        key={tk.id} 
                        onClick={() => handleToggleTask(tk.id)}
                        className="p-4 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border-glass)] flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer"
                      >
                          <div className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full border border-[var(--border-glass)] group-hover:border-indigo-400 flex items-center justify-center transition-all">
                                  {tk.completed && <Check size={12} className="text-indigo-400" />}
                              </div>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{tk.title}</span>
                          </div>
                          {tk.scheduledTime && (
                              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] font-bold uppercase">
                                  <Clock size={12} />
                                  {tk.scheduledTime}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </section>
      )}

      <section className="animate-fade-in-up delay-300">
          <div className="flex items-center gap-2 mb-3 px-2">
            <History size={14} className="text-[var(--text-secondary)]" />
            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t.ecoHistoryTitle}</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
              {(user.activityHistory || []).filter(h => h.startsWith(type.toUpperCase())).slice(-3).reverse().map((entry, idx) => (
                  <div key={idx} className="px-5 py-3 rounded-[22px] bg-white/2 border border-[var(--border-glass)] text-[11px] text-[var(--text-secondary)] font-medium flex items-center gap-3">
                      <CheckCircle size={14} className="text-emerald-500/50 shrink-0" />
                      <span className="truncate">{entry.split(': ')[1]}</span>
                  </div>
              ))}
          </div>
      </section>

      <section className="animate-fade-in-up delay-400">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Activity size={14} className="text-[var(--text-secondary)]" />
            <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em]">{t.ecoPractices}</h3>
          </div>
          <div className="grid gap-4">
              {practices.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => { setSelectedPractice(p); setMessages([{role: 'model', text: p.description}]); }}
                    className="w-full p-6 rounded-[32px] bg-[var(--bg-card)] border border-[var(--border-glass)] hover:bg-white/5 transition-all flex items-center justify-between group shadow-xl active:scale-[0.98]"
                  >
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 transition-all">
                            <Sparkles size={20} />
                        </div>
                        <div className="text-left">
                          <span className="text-[16px] font-bold text-[var(--text-primary)] block group-hover:text-indigo-400 transition-colors">{p.name}</span>
                          <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest opacity-60">FoGoal Core</span>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all transform group-hover:translate-x-1" />
                  </button>
              ))}
          </div>
      </section>
      
      {showDomainChat && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex flex-col p-4 animate-fadeIn">
            <div className="flex-1 flex flex-col pb-[110px] w-full max-w-lg mx-auto">
                <header className="flex justify-between items-center p-6 bg-[var(--bg-main)] border border-[var(--border-glass)] rounded-t-[40px] shadow-2xl">
                    <div className="flex items-center gap-3">
                        <Bot size={24} className="text-indigo-400" />
                        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest">{lang === 'ru' ? 'Эксперт' : 'Expert'} {ecoLabel}</h3>
                    </div>
                    <button onClick={() => setShowDomainChat(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"><X size={20}/></button>
                </header>
                <div className="flex-1 overflow-y-auto space-y-4 px-6 py-6 bg-[var(--bg-main)] border-x border-[var(--border-glass)] scrollbar-hide">
                    {domainMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-5 py-3.5 rounded-[24px] text-[13px] leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[var(--bg-active)] text-[var(--bg-active-text)] font-medium' : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-glass)]'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {domainLoading && (
                        <div className="flex justify-start animate-pulse">
                            <div className="bg-[var(--bg-card)] px-5 py-3 rounded-[24px] flex items-center gap-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest border border-[var(--border-glass)]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{t.thinking}</span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-[var(--bg-main)] border-x border-b border-[var(--border-glass)] rounded-b-[40px]">
                    <div className="relative flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] p-1 shadow-2xl focus-within:border-white/20 transition-all w-full">
                        <input 
                            value={domainInputValue} 
                            onChange={e => setDomainInputValue(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleDomainSend()}
                            placeholder={lang === 'ru' ? 'Спросить эксперта...' : 'Ask expert...'} 
                            className="flex-1 bg-transparent border-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] py-3 px-5 focus:outline-none"
                        />
                        <button onClick={handleDomainSend} disabled={domainLoading || !domainInputValue.trim()} className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-indigo-500 text-white active:scale-90">
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
