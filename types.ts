
export type Language = 'en' | 'ru';

export type AppTheme = 'ice' | 'dark' | 'white';

export type AppFontSize = 'small' | 'normal' | 'medium' | 'large' | 'xlarge';

export enum AppView {
  DASHBOARD = 'dashboard',
  SCHEDULER = 'scheduler',
  SMART_PLANNER = 'smart_planner',
  CHAT = 'chat',
  ECOSYSTEM = 'ecosystem',
  NOTES = 'notes'
}

export type EcosystemType = 'work' | 'sport' | 'study' | 'health' | 'creativity';

export type AiPersona = 'balanced' | 'concise' | 'professional' | 'friendly' | 'academic';

export type GoalTimeframe = 'Week' | 'Month' | 'Year' | 'Long-term';

export enum Category {
  WORK = 'work',
  SPORT = 'sport',
  STUDY = 'study',
  HEALTH = 'health',
  CREATIVITY = 'creativity'
}

export type ZoneId = 'morning' | 'midday' | 'evening' | 'night' | 'unassigned';

export type EnergyLevel = 'low' | 'medium' | 'high';

export enum FitnessLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

export enum FitnessGoal {
  WEIGHT_LOSS = 'weight loss',
  MUSCLE_GAIN = 'muscle gain',
  GENERAL = 'general fitness',
  ENDURANCE = 'endurance'
}

export interface Practice {
  id: string;
  name: string;
  description: string;
}

export type NoteSortMode = 'date_created' | 'date_modified' | 'alpha' | 'color' | 'linked_date';

export interface UserSettings {
  aiPersona: AiPersona;
  aiDetailLevel: 'low' | 'medium' | 'high';
  visibleViews: string[]; 
  fontSize: AppFontSize;
}

export interface CreditsSystem {
  totalCredits: number;
  availableCredits: number;
  usedCredits: number;
  lastResetDate: string;
  hasUnlimitedAccess: boolean;
}

export interface UserProfile {
  username?: string; 
  name: string;
  occupation: string;
  level: number;
  totalExperience: number;
  goals: Goal[];
  bedtime: string;
  wakeTime: string;
  activityHistory: string[];
  energyProfile: EnergyProfile;
  isOnboarded: boolean;
  enabledEcosystems: EcosystemConfig[];
  statsHistory: DailyStats[];
  dayColors?: Record<string, string>;
  dayNotes?: Record<string, string>;
  exams?: Exam[];
  weight?: number;
  height?: number;
  gender?: 'male' | 'female' | 'other';
  fitnessLevel?: FitnessLevel;
  fitnessGoal?: FitnessGoal;
  fitnessEquipment?: string[];
  fitnessOnboarded?: boolean;
  healthHistory?: HealthDailyLog[];
  settings?: UserSettings;
  /** Привязка Telegram: данные приходят из Telegram Login Widget или WebApp initData */
  telegramId?: number;
  telegramUsername?: string;
  telegramPhotoUrl?: string;
  /** Напоминания в Telegram: время в формате "HH:mm", регулярность */
  telegramReminderEnabled?: boolean;
  telegramReminderTime?: string;
  telegramReminderFrequency?: 'daily' | 'weekdays' | 'weekends';
  credits?: CreditsSystem;
}

export interface Goal {
  id: string;
  title: string;
  progress: number;
  target: number;
  unit: string;
  color?: string;
  completed: boolean;
  timeframe?: GoalTimeframe;
}

export interface EnergyProfile {
  energyPeaks: ('morning' | 'midday' | 'evening' | 'night')[];
  energyDips: ('morning' | 'midday' | 'evening' | 'night')[];
  recoverySpeed: 'fast' | 'average' | 'slow';
  resistanceTriggers: string[];
}

export interface EcosystemConfig {
  type: EcosystemType;
  label: string;
  icon: string;
  enabled: boolean;
  justification: string;
}

export interface DailyStats {
  date?: string;
  focusScore: number;
  tasksCompleted: number;
  streakDays: number;
  mood: 'Happy' | 'Neutral' | 'Sad';
  sleepHours: number;
  activityHistory: string[];
  apiRequestsCount: number;
  lastRequestDate: string;
}

export interface HealthDailyLog {
  date: string;
  sleep: number;
  stress: number;
  energy: number;
  notes?: string;
  energyScore: number;
  recoveryScore: number;
  burnoutRisk: 'Low' | 'Medium' | 'High';
  recommendations: {
    morning: string;
    day: string;
    evening: string;
  };
}

export type SmartTaskType = 'ROUTINE' | 'ONE_OFF' | 'EVENT' | 'RECURRING';
export type PreferredTime = 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  durationMinutes: number;
  completed: boolean;
  priority: 'High' | 'Medium' | 'Low';
  energyRequired: 'low' | 'medium' | 'high';
  date?: string;
  scheduledTime?: string;
  status: 'planned' | 'done';
  zoneId?: 'morning' | 'midday' | 'evening' | 'night' | 'unassigned';
  cognitiveLoad?: 'low' | 'medium' | 'high';
  emotionalResistance?: 'low' | 'medium' | 'high';
  flexibility?: 'rigid' | 'flexible';
  emoji?: string;
  color?: string;
  // Smart Planner Specifics
  smartType?: SmartTaskType;
  preferredTime?: PreferredTime;
}

export interface Term {
  id: string;
  word: string;
  definition: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  status?: 'new' | 'mastered';
  ticketId?: string;
}

export interface Ticket {
  id: string;
  number: number;
  question: string;
  confidence: number;
  note?: string;
  lastScore?: number;
}

export interface Exam {
  id: string;
  subject: string;
  date: string;
  tickets: Ticket[];
  calendar: any[];
  glossary: Term[];
  flashcards: Flashcard[];
  progress: number;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes: string;
  equipment: string;
}

export interface WorkoutPlan {
  title: string;
  durationMinutes: number;
  exercises: Exercise[];
  date: string;
}

export interface PlanOption {
  type: string;
  description: string;
  estimatedDuration: string;
  tasks: (Partial<Task> & { dayOffset?: number })[];
}

export interface HelpContext {
  blockName: string;
  taskText: string;
}

export interface NoteFolder {
  id: string;
  title: string;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  linkedDate?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageData?: string;
  timestamp: Date;
}

export const TRANSLATIONS: any = {
  en: {
    navHome: "Home",
    navPlan: "Plan",
    navSmart: "Board",
    navChat: "FoGoal",
    navNotes: "Notes",
    navExpert: "AI Expert",
    thinking: "Thinking...",
    save: "Save",
    cancel: "Cancel",
    logout: "Log Out",
    settingsTitle: "Settings",
    settingsAi: "AI Behavior",
    settingsInterface: "Interface",
    settingsPersona: "AI Persona",
    settingsNav: "Bottom Panel",
    settingsLang: "Language",
    settingsFont: "Font Size",
    settingsDanger: "Account",
    personaBalanced: "Balanced",
    personaConcise: "Concise",
    personaProfessional: "Professional",
    personaFriendly: "Friendly",
    personaAcademic: "Academic",
    detailLow: "Minimal",
    detailMedium: "Balanced",
    detailHigh: "Detailed",
    logoutConfirm: "Log out of your account?",
    viewDay: "Day",
    viewWeek: "Week",
    viewMonth: "Month",
    addTaskPlaceholder: "New task...",
    notesNoTitle: "Untitled Note",
    notesTitle: "My Notes",
    notesSearch: "Search notes...",
    notesPlaceholderTitle: "Title...",
    notesPlaceholderContent: "Write something...",
    notesUndoDelete: "Note deleted",
    notesUndo: "Undo",
    folderDeleted: "Folder deleted",
    folderNew: "New Folder",
    folderName: "Folder Name",
    folderSelect: "Move to Folder",
    folderNone: "None",
    folderEmpty: "Folder is empty",
    folderDelete: "Delete Folder",
    aiBreakdown: "AI Breakdown",
    askFocu: "Ask FoGoal",
    weeklyPlan: "Weekly Plan",
    planGoalTitle: "Plan Your Goal",
    planGoalPlaceholder: "What do you want to achieve?",
    generatePlansBtn: "Generate Plans",
    editTask: "Edit Task",
    title: "Title",
    startTime: "Start Time",
    levelLabel: "Level",
    xpLabel: "XP",
    cognitiveLoadTitle: "Cognitive Load",
    loadOverload: "Overload",
    loadHigh: "High",
    loadMedium: "Medium",
    loadLow: "Low",
    stateBalanced: "Balanced",
    sleepTitle: "Sleep",
    moodTitle: "Mood",
    todaysPriority: "Priority",
    wantHelpPriority: "Help me prioritize",
    goalNameLabel: "Goal Name",
    goalTargetLabel: "Target",
    goalColorLabel: "Color",
    add: "Add",
    knowYou: "Let's get to know you",
    namePlaceholder: "Your Name",
    occupationPlaceholder: "Your Occupation",
    mainGoals: "Main Goals",
    goalPlaceholder: "Add a goal...",
    peakQuestion: "When are your energy peaks?",
    recoveryQuestion: "Recovery speed?",
    drainQuestion: "What drains your energy?",
    morning: "Morning",
    midday: "Midday",
    evening: "Evening",
    night: "Night",
    fast: "Fast",
    average: "Average",
    slow: "Slow",
    longMeetings: "Long Meetings",
    socialInteraction: "Social Interaction",
    decisionMaking: "Decision Making",
    monotony: "Monotony",
    uncertainty: "Uncertainty",
    deadlines: "Deadlines",
    analyzingSignals: "Analyzing Signals",
    signalsDesc: "Recommended ecosystems for you",
    signalsFound: "Ecosystems Found",
    confirmEcosystems: "Confirm Selection",
    welcome: "Welcome",
    energyTitle: "Energy Profile",
    next: "Next",
    back: "Back",
    sortNewest: "Newest First",
    sortModified: "Recently Modified",
    sortAlpha: "Alphabetical",
    sortColor: "By Color",
    sortLinked: "By Date",
    chatInit: "Hello {name}, how can I help you today?",
    chatError: "I'm sorry, I encountered an error.",
    chatPlaceholder: "Ask me anything...",
    ecoState: "State",
    domainProgress: "Progress",
    examResult: "Result",
    ecoLogPlaceholder: "Log your progress...",
    ecoInsightTitle: "FoGoal Insight",
    ecoTasksTitle: "Sphere Tasks",
    ecoHistoryTitle: "Activity Log",
    ecoPractices: "Practices",
    zoneMorning: "Morning",
    zoneMidday: "Day",
    zoneEvening: "Evening",
    zoneNight: "Night",
    zoneUnassigned: "Unassigned",
    examStep: "Step",
    examNewExam: "New Exam",
    examSubject: "Subject",
    examPasteQuestions: "Paste tickets/questions here...",
    examParseAI: "Parse with AI",
    examReady: "Exam set up!",
    examEnterStudy: "Start Studying",
    examAcademy: "Exam Academy",
    examHubDesc: "Master your exams with AI",
    examGenPlan: "Generating study plan",
    healthHubTitle: "Health Hub",
    healthHubSub: "Monitor your vitality",
    healthScore: "Energy Score",
    healthBurnout: "Burnout Risk",
    healthMorning: "Morning",
    healthDay: "Day",
    healthEvening: "Evening",
    healthNoData: "No data today",
    healthCheckin: "Check-in",
    healthSleep: "Sleep Quality",
    healthStress: "Stress Level",
    healthEnergy: "Energy Level",
    healthAnalyze: "Analyze Vitality",
    sportHubTitle: "Sport Hub",
    sportHubSub: "Train smarter",
    sportConfirmProfile: "Save Profile",
    sportOnboardingTitle: "Fitness Profile",
    sportOnboardingSub: "Personalize your journey",
    sportWeight: "Weight (kg)",
    sportHeight: "Height (cm)",
    sportLevel: "Level",
    sportGoal: "Goal",
    sportEquipmentTitle: "Equipment",
    sportAddEquipment: "Add more...",
    sportGenerateBtn: "New Workout",
    sportCoachChat: "AI Coach",
    sportCoachInit: "I'm your AI fitness coach. What's the plan?",
    sportDone: "Done",
    sportComplete: "Complete",
    sportFinishBtn: "Finish Workout",
    sportTechniqueClose: "Close",
    sportWorkoutCompleted: "Workout '{title}' finished!",
    riskLow: "Low",
    riskMedium: "Medium",
    riskHigh: "High",
    updateProgress: "Update Progress",
    addProgress: "Add Progress (%)",
    authLogin: "Log In",
    authSignup: "Sign Up",
    authUsername: "Username",
    authPassword: "Password",
    authError: "Invalid credentials",
    authSuccess: "Welcome back!",
    authExists: "Username already taken",
    authCreate: "Create Account",
    smartPlannerTitle: "Smart Planner",
    autoPlan: "Auto-Plan",
    backlog: "Backlog"
  },
  ru: {
    navHome: "Главная",
    navPlan: "План",
    navSmart: "Доска",
    navChat: "FoGoal",
    navNotes: "Заметки",
    navExpert: "ИИ Эксперт",
    thinking: "Думаю...",
    save: "Сохранить",
    cancel: "Отмена",
    logout: "Выйти",
    settingsTitle: "Настройки",
    settingsAi: "Поведение ИИ",
    settingsInterface: "Интерфейс",
    settingsPersona: "Личность ИИ",
    settingsNav: "Нижняя панель",
    settingsLang: "Язык",
    settingsFont: "Размер шрифта",
    settingsDanger: "Аккаунт",
    personaBalanced: "Баланс",
    personaConcise: "Лаконичный",
    personaProfessional: "Профи",
    personaFriendly: "Друг",
    personaAcademic: "Ученый",
    detailLow: "Минимум",
    detailMedium: "Баланс",
    detailHigh: "Подробно",
    logoutConfirm: "Выйти из аккаунта?",
    viewDay: "День",
    viewWeek: "Неделя",
    viewMonth: "Месяц",
    addTaskPlaceholder: "Новая задача...",
    notesNoTitle: "Без названия",
    notesTitle: "Мои Заметки",
    notesSearch: "Поиск заметок...",
    notesPlaceholderTitle: "Заголовок...",
    notesPlaceholderContent: "Напишите что-нибудь...",
    notesUndoDelete: "Заметка удалена",
    notesUndo: "Вернуть",
    folderDeleted: "Папка удалена",
    folderNew: "Новая папка",
    folderName: "Имя папки",
    folderSelect: "Переместить в папку",
    folderNone: "Нет",
    folderEmpty: "Папка пуста",
    folderDelete: "Удалить папку",
    aiBreakdown: "AI Анализ",
    askFocu: "Спросить FoGoal",
    weeklyPlan: "План на неделю",
    planGoalTitle: "Спланируй цель",
    planGoalPlaceholder: "Чего ты хочешь достичь?",
    generatePlansBtn: "Создать планы",
    editTask: "Правка задачи",
    title: "Название",
    startTime: "Начало",
    levelLabel: "Уровень",
    xpLabel: "XP",
    cognitiveLoadTitle: "Когн. нагрузка",
    loadOverload: "Перегрузка",
    loadHigh: "Высокая",
    loadMedium: "Средняя",
    loadLow: "Низкая",
    stateBalanced: "Сбалансировано",
    sleepTitle: "Сон",
    moodTitle: "Настроение",
    todaysPriority: "Приоритет",
    wantHelpPriority: "Помоги расставить приоритеты",
    goalNameLabel: "Название цели",
    goalTargetLabel: "Цель",
    goalColorLabel: "Цвет",
    add: "Add",
    knowYou: "Давай познакомимся",
    namePlaceholder: "Твое имя",
    occupationPlaceholder: "Твоя профессия",
    mainGoals: "Основные цели",
    goalPlaceholder: "Добавить цель...",
    peakQuestion: "Когда у тебя пики энергии?",
    recoveryQuestion: "Скорость восстановления?",
    drainQuestion: "Что отнимает энергию?",
    morning: "Утро",
    midday: "День",
    evening: "Вечер",
    night: "Ночь",
    fast: "Быстро",
    average: "Средне",
    slow: "Медленно",
    longMeetings: "Долгие встречи",
    socialInteraction: "Общение",
    decisionMaking: "Принятие решений",
    monotony: "Монотонность",
    uncertainty: "Неопределенность",
    deadlines: "Дедлайны",
    analyzingSignals: "Анализ сигналов",
    signalsDesc: "Рекомендуемые экосистемы",
    signalsFound: "Экосистемы найдены",
    confirmEcosystems: "Подтвердить выбор",
    welcome: "Добро пожаловать",
    energyTitle: "Профиль энергии",
    next: "Далее",
    back: "Назад",
    sortNewest: "Сначала новые",
    sortModified: "Недавно измененные",
    sortAlpha: "По алфавиту",
    sortColor: "По цвету",
    sortLinked: "По дате",
    chatInit: "Привет, {name}, чем я могу помочь сегодня?",
    chatError: "Извините, произошла ошибка.",
    chatPlaceholder: "Спросите о чем угодно...",
    ecoState: "Состояние",
    domainProgress: "Прогресс",
    examResult: "Результат",
    ecoLogPlaceholder: "Запиши прогресс...",
    ecoInsightTitle: "Инсайт FoGoal",
    ecoTasksTitle: "Задачи сферы",
    ecoHistoryTitle: "Активность",
    ecoPractices: "Практики",
    zoneMorning: "Утро",
    zoneMidday: "День",
    zoneEvening: "Вечер",
    zoneNight: "Ночь",
    zoneUnassigned: "Без зоны",
    examStep: "Шаг",
    examNewExam: "Новый экзамен",
    examSubject: "Предмет",
    examPasteQuestions: "Вставьте вопросы здесь...",
    examParseAI: "Обработать ИИ",
    examReady: "Экзамен создан!",
    examEnterStudy: "Начать обучение",
    examAcademy: "Академия Экзаменов",
    examHubDesc: "Мастер экзаменов с ИИ",
    examGenPlan: "Создание плана обучения",
    healthHubTitle: "Здоровье",
    healthHubSub: "Ваша витальность",
    healthScore: "Уровень энергии",
    healthBurnout: "Риск выгорания",
    healthMorning: "Утро",
    healthDay: "День",
    healthEvening: "Вечер",
    healthNoData: "Нет данных",
    healthCheckin: "Чек-ин",
    healthSleep: "Качество сна",
    healthStress: "Уровень стресса",
    healthEnergy: "Уровень энергии",
    healthAnalyze: "Анализ",
    sportHubTitle: "Спорт Хаб",
    sportHubSub: "Тренируйся с ИИ",
    sportConfirmProfile: "Сохранить профиль",
    sportOnboardingTitle: "Фитнес Профиль",
    sportOnboardingSub: "Персонализируйте путь",
    sportWeight: "Вес (кг)",
    sportHeight: "Рост (см)",
    sportLevel: "Уровень",
    sportGoal: "Цель",
    sportEquipmentTitle: "Инвентарь",
    sportAddEquipment: "Добавить...",
    sportGenerateBtn: "Новая тренировка",
    sportCoachChat: "ИИ Тренер",
    sportCoachInit: "Я твой ИИ-тренер. Какой план?",
    sportDone: "Готово",
    sportComplete: "Завершить",
    sportFinishBtn: "Закончить",
    sportTechniqueClose: "Закрыть",
    sportWorkoutCompleted: "Тренировка '{title}' окончена!",
    riskLow: "Низкий",
    riskMedium: "Средний",
    riskHigh: "Высокий",
    updateProgress: "Обновить прогресс",
    addProgress: "Добавить прогресс (%)",
    authLogin: "Вход",
    authSignup: "Регистрация",
    authUsername: "Логин",
    authPassword: "Пароль",
    authError: "Неверный логин или пароль",
    authSuccess: "Добро пожаловать!",
    authExists: "Логин уже занят",
    authCreate: "Создать аккаунт",
    smartPlannerTitle: "Умный Планер",
    autoPlan: "Авто-план",
    backlog: "Задачи"
  }
};
