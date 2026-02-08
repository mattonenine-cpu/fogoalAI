import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Language, TRANSLATIONS, AppTheme } from '../types';
import { GlassCard, GlassInput } from './GlassCard';
import { getLocalISODate } from '../services/geminiService';
import { 
  Heart, Moon, Zap, Activity, Settings, 
  TrendingUp, TrendingDown, 
  Plus, Save, Droplet, 
  Smile, AlertCircle, Brain, Coffee, BarChart3, Check,
  ChevronLeft, ChevronRight, Calendar, Circle, Target, CheckCircle2
} from 'lucide-react';
import { 
  LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

interface HealthAppProps {
  user: UserProfile;
  lang: Language;
  onUpdateProfile: (profile: UserProfile) => void;
  theme: AppTheme;
}

// --- Local Types ---
interface HealthMetricConfig {
  id: string;
  label: string;
  description?: string;
  color: string;
  icon: any;
  isDefault?: boolean;
}

interface DailyLogExtended {
  date: string;
  values: Record<string, number>;
}

// --- Constants ---
// Reordered to fit: 1. Condition, 2. Mood, 3. Focus
const DEFAULT_METRICS: HealthMetricConfig[] = [
  // Block 1: Condition (Состояние)
  { id: 'energy', label: 'Energy', color: '#fbbf24', icon: Zap, description: '1 (Low) - 10 (High)' },
  { id: 'sleep', label: 'Sleep', color: '#818cf8', icon: Moon, description: '1 (Insomnia) - 10 (Deep)' },
  { id: 'hydration', label: 'Hydration', color: '#22d3ee', icon: Droplet, description: '1 (Thirsty) - 10 (Hydrated)' },
  
  // Block 2: Mood (Настроение)
  { id: 'mood', label: 'Mood', color: '#a78bfa', icon: Smile, description: '1 (Bad) - 10 (Great)' },
  { id: 'stress', label: 'Calmness', color: '#f472b6', icon: AlertCircle, description: '1 (Panic) - 10 (Zen)' }, 
  { id: 'rest', label: 'Recovery', color: '#2dd4bf', icon: Coffee, description: '1 (None) - 10 (Full)' },

  // Block 3: Focus (Фокус)
  { id: 'focus', label: 'Focus', color: '#38bdf8', icon: Brain, description: '1 (Distracted) - 10 (Flow)' },
  { id: 'discipline', label: 'Discipline', color: '#f97316', icon: Target, description: '1 (Lazy) - 10 (Strict)' },
  { id: 'productivity', label: 'Productivity', color: '#10b981', icon: CheckCircle2, description: '1 (Low) - 10 (High)' },
];

const METRIC_TRANSLATIONS: any = {
    en: {
        energy: "Energy Level",
        sleep: "Sleep Quality",
        hydration: "Hydration",
        mood: "Mood",
        stress: "Calmness",
        rest: "Recovery",
        focus: "Focus",
        discipline: "Discipline",
        productivity: "Productivity"
    },
    ru: {
        energy: "Уровень энергии",
        sleep: "Качество сна",
        hydration: "Гидратация",
        mood: "Настроение",
        stress: "Спокойствие",
        rest: "Восстановление",
        focus: "Фокус",
        discipline: "Дисциплина",
        productivity: "Продуктивность"
    }
};

const BLOCK_TITLES: any = {
    en: ["Condition", "Mood", "Focus"],
    ru: ["Состояние", "Настроение", "Фокус"]
};

const TRANSLATIONS_EXT: any = {
  en: {
    setupTitle: "Health Dashboard",
    setupDesc: "Select metrics to track daily.",
    addMetric: "Add Custom",
    todayTitle: "Daily Vitals",
    saveDay: "Log Entries",
    week: "Week",
    month: "Month",
    year: "Year",
    trends: "Trends",
    avg: "Avg",
    noData: "No data yet",
    scoreBad: "Low",
    scoreOk: "Ok",
    scoreGood: "Good",
    configure: "Configure",
    today: "Today"
  },
  ru: {
    setupTitle: "График Здоровья",
    setupDesc: "Выберите показатели для отслеживания.",
    addMetric: "Добавить метрику",
    todayTitle: "Показатели",
    saveDay: "Сохранить запись",
    week: "Неделя",
    month: "Месяц",
    year: "Год",
    trends: "Тренды",
    avg: "Ср.",
    noData: "Нет данных",
    scoreBad: "Плохо",
    scoreOk: "Норм",
    scoreGood: "Супер",
    configure: "Настроить",
    today: "Сегодня"
  }
};

// Gradient & Color Helpers
const getColorForScore = (score: number) => {
  if (score <= 3) return '#f87171'; // Red
  if (score <= 6) return '#facc15'; // Yellow
  return '#4ade80'; // Green
};

const getScoreLabel = (score: number, t: any) => {
  if (score === 0) return '-';
  if (score <= 3) return t.scoreBad;
  if (score <= 6) return t.scoreOk;
  return t.scoreGood;
};

// Helper to restore icons lost during JSON serialization
const hydrateConfig = (savedConfig: HealthMetricConfig[]): HealthMetricConfig[] => {
    return savedConfig.map(c => {
        const defaultMetric = DEFAULT_METRICS.find(d => d.id === c.id);
        if (defaultMetric) {
            // Restore icon and other potentially static props from default
            return { ...c, icon: defaultMetric.icon };
        }
        // Fallback for custom or unknown metrics that lost their icon
        if (!c.icon) {
             return { ...c, icon: Activity };
        }
        return c;
    });
};

const ITEMS_PER_PAGE = 3;

export const HealthApp: React.FC<HealthAppProps> = ({ user, lang, onUpdateProfile, theme }) => {
  // Ensure we have valid translations, fallback to English if current lang missing
  const tExt = TRANSLATIONS_EXT[lang] || TRANSLATIONS_EXT['en'];
  const t = { ...TRANSLATIONS[lang], ...tExt };
  const blockTitles = BLOCK_TITLES[lang] || BLOCK_TITLES['en'];
  
  const todayISO = getLocalISODate();

  // --- State ---
  const [config, setConfig] = useState<HealthMetricConfig[]>([]);
  const [logs, setLogs] = useState<DailyLogExtended[]>([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  // Date Navigation State
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [inputValues, setInputValues] = useState<Record<string, number>>({});
  const [analyticsRange, setAnalyticsRange] = useState<'week' | 'month' | 'year'>('week');
  const [customMetricName, setCustomMetricName] = useState('');
  
  // Pagination State (Synchronized for Input and Charts)
  const [currentPage, setCurrentPage] = useState(0);

  // --- Init ---
  useEffect(() => {
    // Safe parsing for config
    const savedConfig = localStorage.getItem('focu_health_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (Array.isArray(parsed) && parsed.length > 0) {
            let restored = hydrateConfig(parsed);
            
            // FORCE SORT ORDER based on DEFAULT_METRICS indices to enforce grouping (Condition, Mood, Focus)
            // even if local storage has old order
            restored.sort((a, b) => {
                const idxA = DEFAULT_METRICS.findIndex(d => d.id === a.id);
                const idxB = DEFAULT_METRICS.findIndex(d => d.id === b.id);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB; // Both defaults
                if (idxA !== -1) return -1; // A is default
                if (idxB !== -1) return 1; // B is default
                return 0; // Both custom
            });

            setConfig(restored);
        } else {
            setConfig(DEFAULT_METRICS);
        }
      } catch (e) {
        console.error("Failed to parse health config", e);
        setConfig(DEFAULT_METRICS);
      }
    } else {
      setConfig(DEFAULT_METRICS);
    }

    // Safe parsing for logs
    const savedLogs = localStorage.getItem('focu_health_logs');
    if (savedLogs) {
      try {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed)) {
            setLogs(parsed);
        } else {
            setLogs([]);
        }
      } catch (e) {
        console.error("Failed to parse health logs", e);
        setLogs([]);
      }
    } else {
      setLogs([]);
    }
    
    setIsReady(true);
  }, []);

  // --- Load Data for Selected Date ---
  useEffect(() => {
    if (!isReady) return;

    // 1. Try to find existing log for the selected date
    const existingLog = logs.find(l => l.date === selectedDate);
    
    if (existingLog) {
        setInputValues(existingLog.values || {});
        return;
    }

    // 2. If no log exists...
    let newValues: Record<string, number> = {};

    // Only auto-sync from main stats if it's TODAY
    if (selectedDate === todayISO && user) {
        const stats = user.statsHistory?.find(s => s.date === todayISO);
        
        // Sync Mood
        const moodMap: Record<string, number> = { 'Happy': 9, 'Neutral': 6, 'Sad': 3 };
        if (config.find(c => c.id === 'mood')) {
            const mood = stats?.mood;
            if (mood && moodMap[mood]) newValues['mood'] = moodMap[mood];
        }

        // Sync Sleep
        if (config.find(c => c.id === 'sleep')) {
            const sleepHours = stats?.sleepHours;
            if (sleepHours !== undefined && sleepHours > 0) {
                let score = 5;
                if (sleepHours < 5) score = 3;
                else if (sleepHours < 6) score = 5;
                else if (sleepHours < 7) score = 7;
                else if (sleepHours < 8) score = 9;
                else score = 10;
                newValues['sleep'] = score;
            }
        }
    }
    
    setInputValues(newValues);
  }, [selectedDate, isReady, logs, user?.statsHistory, config]);

  // --- Hooks ---
  const chartData = useMemo(() => {
    if (!logs || !Array.isArray(logs)) return [];
    
    const sorted = [...logs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const now = new Date();
    
    const rangeLogs = sorted.filter(l => {
      if (!l.date) return false;
      const d = new Date(l.date);
      const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
      if (analyticsRange === 'week') return diffDays <= 7;
      if (analyticsRange === 'month') return diffDays <= 30;
      return diffDays <= 365;
    });

    return rangeLogs.map(l => {
      // Safe date formatting fallback
      let displayDate = l.date;
      try {
          displayDate = new Date(l.date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });
      } catch (e) { /* ignore */ }

      const point: any = { 
          date: l.date, 
          displayDate
      };
      config.forEach(c => {
        if (l.values && l.values[c.id]) {
          point[c.id] = l.values[c.id] * 10; // Scale 1-10 to 10-100 for graph
        }
      });
      return point;
    });
  }, [logs, analyticsRange, config, lang]);

  const allAvailableMetrics = useMemo(() => {
      const combined = [...DEFAULT_METRICS];
      // Add custom metrics from config if they aren't in default
      config.forEach(c => {
          if (!combined.find(def => def.id === c.id)) {
              combined.push(c);
          }
      });
      return combined;
  }, [config]);

  const totalPages = Math.ceil(config.length / ITEMS_PER_PAGE);
  
  const currentMetrics = useMemo(() => {
      const start = currentPage * ITEMS_PER_PAGE;
      return config.slice(start, start + ITEMS_PER_PAGE);
  }, [config, currentPage]);

  const currentBlockTitle = blockTitles[currentPage] || (lang === 'ru' ? 'Другое' : 'Other');

  const calculateTrend = (metricId: string) => {
    if (chartData.length < 2) return 0;
    const last = Number(chartData[chartData.length - 1][metricId]);
    const prev = Number(chartData[chartData.length - 2][metricId]);
    if (isNaN(last) || isNaN(prev) || prev === 0) return 0;
    return Math.round(((last - prev) / prev) * 100);
  };

  // --- Handlers ---
  const handleSaveConfig = () => {
    // When saving, we only save the data structure. React components (icons) are lost.
    localStorage.setItem('focu_health_config', JSON.stringify(config));
    setIsConfiguring(false);
    setCurrentPage(0); // Reset to first page
  };

  const toggleMetricInConfig = (metric: HealthMetricConfig) => {
    const exists = config.find(c => c.id === metric.id);
    if (exists) {
      setConfig(prev => prev.filter(c => c.id !== metric.id));
    } else {
      setConfig(prev => [...prev, metric]);
    }
  };

  const handleAddCustomMetric = () => {
    if (!customMetricName.trim()) return;
    const newMetric: HealthMetricConfig = {
      id: `custom_${Date.now()}`,
      label: customMetricName,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      icon: Activity, // Default icon for custom
      description: 'Custom'
    };
    // Add to config immediately
    setConfig(prev => [...prev, newMetric]);
    setCustomMetricName('');
  };

  const handleSaveDay = () => {
    const newLog: DailyLogExtended = { date: selectedDate, values: inputValues };
    const newLogs = [...logs.filter(l => l.date !== selectedDate), newLog];
    setLogs(newLogs);
    localStorage.setItem('focu_health_logs', JSON.stringify(newLogs));
    
    // XP Boost if today
    if (selectedDate === todayISO) {
        const scores = Object.values(inputValues) as number[];
        if (scores.length > 0) {
            onUpdateProfile({ ...user, totalExperience: (user.totalExperience || 0) + 15 });
        }
    }
  };

  const getMetricLabel = (m: HealthMetricConfig) => {
      // Metric translations fallback
      const transMap = METRIC_TRANSLATIONS[lang] || METRIC_TRANSLATIONS['en'];
      const translated = transMap?.[m.id];
      if (translated) return translated;
      return m.label;
  };

  // Date Navigation Handlers
  const handlePrevDay = () => {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(getLocalISODate(d));
  };

  const handleNextDay = () => {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      const newDate = getLocalISODate(d);
      // Prevent going to future
      if (newDate <= todayISO) setSelectedDate(newDate);
  };

  // Date Display Text
  const displayDate = selectedDate === todayISO 
    ? t.today 
    : new Date(selectedDate).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });

  // --- Views ---

  if (isConfiguring) {
    return (
      <div className="pb-32 animate-fadeIn">
        <GlassCard className="p-8 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[40px] space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="text-center space-y-2 relative z-10">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.2)] mb-4">
                <Settings size={28} className="text-[var(--theme-accent)]" />
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tight">{t.setupTitle}</h2>
            <p className="text-sm text-[var(--text-secondary)] font-medium max-w-xs mx-auto">{t.setupDesc}</p>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide pr-1 relative z-10">
            {allAvailableMetrics.map(m => {
              const isSelected = !!config.find(c => c.id === m.id);
              const Icon = m.icon;
              return (
                <div 
                  key={m.id} 
                  onClick={() => toggleMetricInConfig(m)}
                  className={`p-4 rounded-[24px] border transition-all duration-300 cursor-pointer flex items-center justify-between group ${isSelected ? 'bg-gradient-to-r from-white/10 to-white/5 border-white/20 shadow-lg' : 'bg-white/5 border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-inner" style={{ backgroundColor: `${m.color}20`, color: m.color }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)] tracking-wide">{getMetricLabel(m)}</p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-medium">{m.description}</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-[var(--theme-accent)] border-[var(--theme-accent)] text-white' : 'border-white/20'}`}>
                      {isSelected && <Check size={14} strokeWidth={4}/>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-6 border-t border-[var(--border-glass)] relative z-10 space-y-4">
             <div className="relative">
               <GlassInput 
                  value={customMetricName} 
                  onChange={e => setCustomMetricName(e.target.value)} 
                  placeholder={lang === 'ru' ? "Своя метрика (напр. Боль в спине)" : "Custom Metric"}
                  className="pr-14"
               />
               <button onClick={handleAddCustomMetric} disabled={!customMetricName} className="absolute right-2 top-2 w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center text-[var(--text-primary)] disabled:opacity-30 hover:bg-white/20 transition-all"><Plus size={18}/></button>
             </div>
             <button onClick={handleSaveConfig} className="w-full h-14 bg-[var(--bg-active)] text-[var(--bg-active-text)] rounded-full font-black uppercase text-[12px] tracking-widest shadow-[0_10px_40px_rgba(0,0,0,0.3)] active:scale-95 transition-all">
               {t.save}
             </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  // --- Main Render ---
  return (
    <div className="space-y-8 animate-fadeIn pb-32">
        {/* Header */}
        <header className="flex justify-between items-center px-2">
          <div>
              <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase leading-none mb-1">{t.healthHubTitle}</h1>
              <p className="text-[10px] font-bold text-[var(--theme-accent)] uppercase tracking-[0.3em] pl-0.5">{t.healthHubSub}</p>
          </div>
          <button onClick={() => setIsConfiguring(true)} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 active:scale-90 transition-all shadow-lg backdrop-blur-md">
            <Settings size={20} />
          </button>
        </header>

        {/* Liquid Input Card with Pagination */}
        <GlassCard className="p-6 sm:p-8 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[40px] shadow-2xl relative overflow-hidden transition-all duration-300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
            
            <div className="flex justify-between items-center mb-8">
                <div className="flex flex-col">
                    <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
                        <Activity size={16} className="text-[var(--theme-accent)]" /> {t.todayTitle}
                    </h3>
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-6 mt-1">{currentBlockTitle}</p>
                </div>
                
                {/* Date Navigator */}
                <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                    <button onClick={handlePrevDay} className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-white/10 active:scale-90 transition-all"><ChevronLeft size={14}/></button>
                    <span className="text-[10px] font-bold text-[var(--text-primary)] w-16 text-center">{displayDate}</span>
                    <button onClick={handleNextDay} disabled={selectedDate >= todayISO} className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30"><ChevronRight size={14}/></button>
                </div>
            </div>

            <div className="min-h-[280px]">
                {currentMetrics.length > 0 ? (
                    <div className="space-y-10 animate-fade-in-up">
                        {currentMetrics.map(m => {
                            const value = inputValues[m.id] || 5; 
                            const Icon = m.icon;
                            // Min = 1, Max = 10. So (value - 1) / 9
                            const percent = ((value - 1) / 9); 
                            
                            return (
                                <div key={m.id} className="space-y-3">
                                    <div className="flex justify-between items-end px-1 mb-2">
                                        <label className="text-[11px] font-black text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
                                            <Icon size={14} style={{ color: m.color }} /> 
                                            <span style={{ color: m.color }} className="opacity-90">{getMetricLabel(m)}</span>
                                        </label>
                                        <span className={`text-sm font-black transition-colors duration-500`} style={{ color: getColorForScore(value) }}>
                                            {getScoreLabel(value, t)}
                                        </span>
                                    </div>
                                    
                                    <div className="relative h-12 flex items-center group">
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="10" 
                                            step="1"
                                            value={value}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setInputValues(prev => ({ ...prev, [m.id]: val }));
                                            }}
                                            className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer"
                                        />
                                        
                                        {/* Track */}
                                        <div className="w-full h-4 bg-black/20 rounded-full overflow-hidden border border-white/5 relative shadow-inner backdrop-blur-sm">
                                            <div 
                                                className="h-full rounded-full transition-all duration-200 ease-out relative"
                                                style={{ 
                                                    width: `calc(${percent * 100}% + 12px)`,
                                                    backgroundColor: getColorForScore(value),
                                                    boxShadow: `0 0 15px ${getColorForScore(value)}40`
                                                }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                            </div>
                                        </div>

                                        {/* Thumb */}
                                        <div 
                                            className="absolute h-10 w-10 bg-white rounded-full shadow-[0_5px_20px_rgba(0,0,0,0.3)] border-4 border-[var(--bg-card)] flex items-center justify-center z-10 pointer-events-none transition-all duration-200 ease-out"
                                            style={{ 
                                                left: `calc(${percent * 100}% - ${percent * 40}px)`, 
                                                borderColor: getColorForScore(value)
                                            }}
                                        >
                                            <span className="text-xs font-black" style={{ color: getColorForScore(value) }}>{value}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-[280px] flex items-center justify-center text-[var(--text-secondary)] opacity-50">
                        No metrics selected
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8 mb-4">
                    {Array.from({ length: totalPages }).map((_, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => setCurrentPage(idx)} 
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentPage ? 'bg-[var(--text-primary)] w-6' : 'bg-[var(--text-secondary)] opacity-30 hover:opacity-100 hover:bg-[var(--text-primary)]'}`}
                        />
                    ))}
                </div>
            )}

            <button onClick={handleSaveDay} className="w-full h-16 bg-[var(--theme-accent)] rounded-[24px] mt-2 font-black uppercase text-[12px] text-white shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group">
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Save size={18} strokeWidth={2.5}/> {t.saveDay}
            </button>
        </GlassCard>

        {/* Analytics Section (Synced with Input Page) */}
        <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
                <div className="flex flex-col">
                    <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 size={16} className="text-indigo-400" /> {t.trends}
                    </h3>
                    <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] ml-6 mt-1">{currentBlockTitle}</p>
                </div>
                <div className="flex bg-white/5 p-1 rounded-full border border-white/10">
                    {(['week', 'month', 'year'] as const).map(range => (
                        <button 
                            key={range}
                            onClick={() => setAnalyticsRange(range)}
                            className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${analyticsRange === range ? 'bg-[var(--text-primary)] text-[var(--bg-main)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {t[range]}
                        </button>
                    ))}
                </div>
            </div>

            <GlassCard className="p-6 bg-[var(--bg-card)] border-[var(--border-glass)] rounded-[40px] overflow-hidden shadow-2xl h-[280px] relative">
                {chartData.length > 0 && currentMetrics.length > 0 ? (
                    <div className="absolute inset-0 pt-6 pr-2 pb-2 animate-fade-in-up">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    {currentMetrics.map(c => (
                                        <linearGradient key={c.id} id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={c.color} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={c.color} stopOpacity={0}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                                <XAxis dataKey="displayDate" stroke="rgba(255,255,255,0.2)" tick={{fontSize: 9, fontWeight: 700}} tickLine={false} axisLine={false} dy={10} />
                                <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.2)" tick={{fontSize: 9, fontWeight: 700}} tickLine={false} axisLine={false} dx={-5} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(20,20,25,0.9)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', backdropFilter: 'blur(10px)' }}
                                    itemStyle={{ fontSize: '11px', fontWeight: 'bold', padding: 0 }}
                                    labelStyle={{ fontSize: '10px', color: '#9ca3af', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '1px' }}
                                />
                                {currentMetrics.map(c => (
                                    <Area
                                        key={c.id} 
                                        type="monotone" 
                                        dataKey={c.id} 
                                        stroke={c.color} 
                                        strokeWidth={3} 
                                        fill={`url(#grad-${c.id})`}
                                        name={getMetricLabel(c)}
                                        dot={false}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: c.color }}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-xs font-bold uppercase tracking-widest opacity-50">
                        {t.noData}
                    </div>
                )}
            </GlassCard>

            <div className="grid grid-cols-1 gap-3">
                {currentMetrics.map(c => {
                    const values = chartData.map((d: any) => d[c.id]).filter((v: any) => v !== undefined) as number[];
                    const avg = values.length ? Math.round(values.reduce((a,b) => a+b, 0) / values.length) : 0;
                    const trend = calculateTrend(c.id);
                    if (values.length === 0) return null;

                    return (
                        <GlassCard key={c.id} className="px-5 py-4 rounded-[28px] border-[var(--border-glass)] bg-white/5 flex items-center justify-between hover:bg-white/10 transition-colors group animate-fade-in-up">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-white/5 shadow-inner group-hover:scale-110 transition-transform" style={{ backgroundColor: `${c.color}20`, color: c.color }}>
                                    {React.createElement(c.icon, { size: 18 })}
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase text-[var(--text-primary)] tracking-wide">{getMetricLabel(c)}</p>
                                    <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">{t.avg}: {avg / 10}/10</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-black tracking-tight" style={{ color: getColorForScore(avg / 10) }}>{avg}%</div>
                                {trend !== 0 && (
                                    <div className={`text-[9px] font-black flex items-center justify-end gap-1 ${trend > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {trend > 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>} {Math.abs(trend)}%
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    );
                })}
            </div>
        </div>
    </div>
  );
};