
import { UserProfile, Task, Language, Goal, EcosystemType, HelpContext, EcosystemConfig, HealthDailyLog, WorkoutPlan, Ticket } from '../types';

// Groq model (change here to switch model, e.g. llama-3.3-70b-versatile)
const AI_MODEL = 'llama-3.1-8b-instant';

// Helper for type compatibility without importing the full SDK
export const Type = {
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
  ARRAY: 'ARRAY',
  OBJECT: 'OBJECT'
};

export const getLocalISODate = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

// ---------------------------------------------------------------------------
// Lightweight caching & basic auto‑responses to reduce unnecessary AI calls
// ---------------------------------------------------------------------------

type ChatScope = 'general' | 'ecosystem' | 'help';

// Simple in‑memory cache for text responses.
// Key format: `${scope}|${context}|${lang}|${normalizedMessage}`
const responseCache = new Map<string, string>();

const normalizeMessage = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:()«»"'`]+/g, '')
    .replace(/\s+/g, ' ');

const makeCacheKey = (scope: ChatScope, context: string, lang: Language, message: string): string =>
  `${scope}|${context}|${lang}|${normalizeMessage(message)}`;

// Basic canned replies for greetings / thanks / small talk / simple FAQ.
// These are returned instantly without any AI call.
const BASIC_PATTERNS: { lang: Language; patterns: RegExp[]; reply: string }[] = [
  // RU greetings / small talk
  {
    lang: 'ru',
    patterns: [
      /^привет$/,
      /^приветик$/,
      /^здравствуй$/,
      /^добрый день$/,
      /^добрый вечер$/,
      /^доброе утро$/,
      /^хай$/,
      /^йо$/
    ],
    reply: 'Привет! Я FoGoal ИИ‑ассистент. Чем могу помочь прямо сейчас?'
  },
  {
    lang: 'ru',
    patterns: [/^как дела$/, /^как ты$/, /^ты тут$/, /^ты здесь$/],
    reply: 'Я всегда на связи и готов помочь. Расскажи, над чем сейчас работаешь.'
  },
  {
    lang: 'ru',
    patterns: [/^спасибо$/, /^спс$/, /^благодарю$/, /^огромное спасибо$/],
    reply: 'Всегда пожалуйста! Если нужно, можем продолжить или перейти к новой задаче.'
  },
  {
    lang: 'ru',
    patterns: [/^(кто ты|кто ты такой|что ты умеешь)$/],
    reply: 'Я FoGoal AI: помогаю планировать день, учёбу, спорт, здоровье и творчество с помощью ИИ.'
  },
  {
    lang: 'ru',
    patterns: [/^(что ты можешь|чем ты можешь помочь|как ты мне поможешь)$/],
    reply: 'Я могу разбить задачи на шаги, спланировать день, помочь с учёбой, тренировками, здоровьем и творческими идеями.'
  },
  {
    lang: 'ru',
    patterns: [/^(помоги|мне нужна помощь|помоги мне)$/],
    reply: 'Конечно. Коротко опиши ситуацию или задачу, и я предложу конкретные шаги.'
  },
  {
    lang: 'ru',
    patterns: [/^(что ты за приложение|что такое fogoal|что такое fo?goal|что за фогоал)$/],
    reply: 'FoGoal — это ИИ‑ассистент, который объединяет планирование задач, учёбу, спорт, здоровье и творчество в одном месте.'
  },

  // EN greetings / small talk
  {
    lang: 'en',
    patterns: [
      /^hi$/,
      /^hello$/,
      /^hey$/,
      /^hey there$/,
      /^good (morning|afternoon|evening)$/,
      /^yo$/
    ],
    reply: 'Hi! I am FoGoal AI assistant. How can I help you right now?'
  },
  {
    lang: 'en',
    patterns: [/^how are you$/, /^how are u$/, /^are you there$/, /^you there$/],
    reply: "I'm here and ready to help. Tell me what you're working on."
  },
  {
    lang: 'en',
    patterns: [/^thanks?$/, /^thank you$/, /^thx$/, /^many thanks$/],
    reply: "You're welcome! We can continue with this topic or start something new."
  },
  {
    lang: 'en',
    patterns: [/^(who are you|what can you do|what do you do)$/],
    reply: 'I am FoGoal AI: I help you plan your day, study, workouts and health with smart guidance.'
  },
  {
    lang: 'en',
    patterns: [/^(how can you help me|what can you help with)$/],
    reply: 'I can break tasks into steps, design your day, assist with study, workouts, health and creative ideas.'
  },
  {
    lang: 'en',
    patterns: [/^(help me|i need help|can you help me)$/],
    reply: 'Sure. Briefly describe your situation or task and I will suggest concrete next steps.'
  },
  {
    lang: 'en',
    patterns: [/^(what is fogoal|what is fo goal|what is this app)$/],
    reply: 'FoGoal is an AI assistant that combines planning, study, workouts and health in one workspace.'
  }
];

// Ecosystem-specific canned replies (work / sport / study / health)
// These are also instant and scoped by ecosystem "type" in createChatSession.
const ECOSYSTEM_PATTERNS: {
  lang: Language;
  ecosystem: string; // matches `type` argument from createChatSession (e.g. 'work', 'sport')
  patterns: RegExp[];
  reply: string;
}[] = [
  // ---------- WORK ----------
  {
    lang: 'ru',
    ecosystem: 'work',
    patterns: [/^план на работу$/, /^план по работе$/, /^что делать по работе$/, /^с чего начать работу$/],
    reply: 'Для работы начни с 1–2 самых важных задач на сегодня. Напиши коротко, что главное — и я помогу разбить это на шаги.'
  },
  {
    lang: 'en',
    ecosystem: 'work',
    patterns: [/^work plan$/, /^plan for work$/, /^what should i do at work$/, /^where to start work$/],
    reply: 'For work, start with 1–2 most important tasks today. Type them briefly and I will break them into steps.'
  },

  // ---------- SPORT ----------
  {
    lang: 'ru',
    ecosystem: 'sport',
    patterns: [/^дай тренировку$/, /^тренировка на сегодня$/, /^план тренировки$/, /^что потренировать сегодня$/],
    reply: 'Давай составим простую тренировку. Напиши, где тренируешься (дом/зал) и сколько минут есть — я предложу план.'
  },
  {
    lang: 'en',
    ecosystem: 'sport',
    patterns: [/^workout for today$/, /^give me a workout$/, /^training plan$/, /^what should i train today$/],
    reply: 'Let’s build a workout. Tell me where you train (home/gym) and how many minutes you have — I will propose a plan.'
  },

  // ---------- STUDY ----------
  {
    lang: 'ru',
    ecosystem: 'study',
    patterns: [/^план по учебе$/, /^план по учёбе$/, /^как готовиться к экзамену$/, /^помоги с учебой$/, /^помоги с учёбой$/],
    reply: 'Для учёбы давай выберем один предмет и экзамен/тему. Напиши предмет и ближайший дедлайн — я помогу спланировать подготовку.'
  },
  {
    lang: 'en',
    ecosystem: 'study',
    patterns: [/^study plan$/, /^plan for study$/, /^how to prepare for exam$/, /^help with study$/],
    reply: 'For study, choose one subject and exam/topic. Tell me the subject and nearest deadline — I will help you plan.'
  },

  // ---------- HEALTH ----------
  {
    lang: 'ru',
    ecosystem: 'health',
    patterns: [/^как восстановиться$/, /^я выгорел$/, /^я выгорела$/, /^я устал$/, /^я устала$/, /^совет по сну$/, /^проблемы со сном$/],
    reply: 'Сначала оценим состояние. Напиши: сон (0–10), стресс (0–10) и энергию (0–10) — я дам аккуратные рекомендации по режиму и восстановлению.'
  },
  {
    lang: 'en',
    ecosystem: 'health',
    patterns: [/^how to recover$/, /^i am burned out$/, /^im burned out$/, /^i am tired$/, /^im tired$/, /^sleep advice$/, /^problems with sleep$/],
    reply: 'Let’s evaluate your state. Send me: sleep (0–10), stress (0–10) and energy (0–10) — I will give focused recovery suggestions.'
  },

  {
    lang: 'en',
    ecosystem: 'x',
    patterns: [/^never-match$/],
    reply: 'Let’s find an idea to draw. Send 2–3 words about mood or theme (e.g. space, rain, cat) — I will suggest options.'
  }
];

function getBasicAutoReply(message: string, lang: Language): string | null {
  const norm = normalizeMessage(message);
  for (const entry of BASIC_PATTERNS) {
    if (entry.lang !== lang) continue;
    if (entry.patterns.some((re) => re.test(norm))) {
      return entry.reply;
    }
  }
  return null;
}

function getEcosystemAutoReply(message: string, lang: Language, type: string): string | null {
  const norm = normalizeMessage(message);
  const eco = type.toLowerCase();
  for (const entry of ECOSYSTEM_PATTERNS) {
    if (entry.lang !== lang) continue;
    if (entry.ecosystem.toLowerCase() !== eco) continue;
    if (entry.patterns.some((re) => re.test(norm))) {
      return entry.reply;
    }
  }
  return null;
}

export const cleanTextOutput = (text: string = "") => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/** Safely parse JSON from API (Groq may wrap in text or add markdown). Returns default on failure. */
function parseJsonResponse<T>(rawText: string, defaultVal: T): T {
    const text = cleanTextOutput(rawText || '');
    if (!text) return defaultVal;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        try {
            const startObj = text.indexOf('{');
            const startArr = text.indexOf('[');
            let start = -1;
            let isArray = false;
            if (startObj >= 0 && (startArr < 0 || startObj < startArr)) {
                start = startObj;
            } else if (startArr >= 0) {
                start = startArr;
                isArray = true;
            }
            if (start >= 0) {
                let depth = 0;
                const open = isArray ? '[' : '{';
                const close = isArray ? ']' : '}';
                let end = start;
                for (let i = start; i < text.length; i++) {
                    if (text[i] === open) depth++;
                    else if (text[i] === close) {
                        depth--;
                        if (depth === 0) {
                            end = i + 1;
                            break;
                        }
                    }
                }
                parsed = JSON.parse(text.slice(start, end));
            } else {
                return defaultVal;
            }
        } catch (_e) {
            return defaultVal;
        }
    }
    return normalizeParsedForGroq(parsed, defaultVal) as T;
}

/** Groq sometimes returns object when we need array, or different key names. Unwrap to match expected shape. */
function normalizeParsedForGroq(parsed: unknown, defaultVal: any): any {
    if (parsed == null) return defaultVal;
    if (Array.isArray(defaultVal)) {
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === 'object' && parsed !== null) {
            const obj = parsed as Record<string, unknown>;
            for (const k of ['tickets', 'questions', 'items', 'data', 'results', 'array']) {
                if (Array.isArray(obj[k])) return obj[k];
            }
            const firstArr = Object.values(obj).find(v => Array.isArray(v));
            if (firstArr) return firstArr;
        }
        return defaultVal;
    }
    if (typeof defaultVal === 'object' && defaultVal !== null && !Array.isArray(defaultVal)) {
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return parsed as any;
        const obj = parsed as Record<string, unknown>;
        if (defaultVal.glossary !== undefined && defaultVal.flashcards !== undefined) {
            const glossary = Array.isArray(obj.glossary) ? obj.glossary : (Array.isArray(obj.glossary_terms) ? obj.glossary_terms : []);
            const flashcards = Array.isArray(obj.flashcards) ? obj.flashcards : (Array.isArray(obj.cards) ? obj.cards : []);
            return { glossary, flashcards };
        }
        if (defaultVal.exercises !== undefined) {
            const exercises = Array.isArray(obj.exercises) ? obj.exercises : (Array.isArray(obj.workout) ? obj.workout : (Array.isArray(obj.items) ? obj.items : []));
            return { ...obj, exercises };
        }
    }
    return parsed;
}

/**
 * Helper to call the Vercel API endpoints
 */
async function callApi(endpoint: string, body: any) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Server error: ${response.status}`);
            }
            return data;
        } else {
            // If response is not JSON (e.g., Vercel 500 HTML error page)
            const text = await response.text();
            console.error(`Non-JSON response from ${endpoint}:`, text.substring(0, 200));
            throw new Error(`Connection Error (${response.status}). Please check Vercel logs and ensure API_KEY is set in Settings.`);
        }
    } catch (error: any) {
        console.error(`Error calling ${endpoint}:`, error);
        throw error;
    }
}

/**
 * Creates a helper session for contextual advice
 */
export function createHelpSession(context: HelpContext, profile: UserProfile, lang: Language) {
    const localHistory: any[] = [];
    const systemInstruction = `You are a helpful assistant providing contextual help for ${context.blockName}. Task: ${context.taskText}. User: ${profile.name || 'User'}. Lang: ${lang}. Be extremely concise.`;

    return {
        sendMessage: async ({ message }: { message: string }) => {
            // 1) Basic canned reply (no AI call)
            const basic = getBasicAutoReply(message, lang);
            if (basic) {
                const text = basic;
                localHistory.push({ role: 'user', parts: [{ text: message }] });
                localHistory.push({ role: 'model', parts: [{ text }] });
                return { text };
            }

            // 2) Check cache for repeated questions within contextual help
            const cacheKey = makeCacheKey('help', context.blockName, lang, message);
            if (responseCache.has(cacheKey)) {
                const cached = responseCache.get(cacheKey) as string;
                localHistory.push({ role: 'user', parts: [{ text: message }] });
                localHistory.push({ role: 'model', parts: [{ text: cached }] });
                return { text: cached };
            }

            localHistory.push({ role: 'user', parts: [{ text: message }] });
            
            const result = await callApi('/api/generate', {
                model: AI_MODEL,
                contents: localHistory,
                config: { systemInstruction }
            });

            const text = result.text || "";
            localHistory.push({ role: 'model', parts: [{ text }] });
            responseCache.set(cacheKey, text);
            
            return { text };
        }
    };
}

/**
 * Creates a chat session for ecosystem-specific coaching or general chat
 */
export function createChatSession(user: UserProfile, history: any[], lang: Language, tasks: Task[], type: string = 'General', currentDate?: string) {
    const localHistory = [...history];
    const todayDate = currentDate || getLocalISODate();
    const todayFormatted = new Date(todayDate + 'T12:00:00').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { 
        day: 'numeric', 
        month: 'long', 
        weekday: 'long',
        year: 'numeric'
    });
    const systemInstruction = `You are FoGoal AI, an expert AI coach for the ${type} ecosystem. User: ${user.name || 'User'}. Lang: ${lang}. TODAY'S DATE: ${todayDate} (${todayFormatted}). IMPORTANT: Always use this exact date when answering questions about dates, schedules, or time. Recent tasks context: ${JSON.stringify(tasks.slice(0, 5))}. Be concise and motivating.`;

    return {
        sendMessage: async ({ message }: { message: string }) => {
            // 1) Ecosystem‑specific canned replies (for sport / study / health / creativity / work)
            if (type && type !== 'General') {
                const ecoReply = getEcosystemAutoReply(message, lang, type);
                if (ecoReply) {
                    const text = ecoReply;
                    localHistory.push({ role: 'user', parts: [{ text: message }] });
                    localHistory.push({ role: 'model', parts: [{ text }] });
                    return { text };
                }
            }

            // 2) Generic basic replies (greetings / thanks / simple FAQ)
            const basic = getBasicAutoReply(message, lang);
            if (basic) {
                const text = basic;
                localHistory.push({ role: 'user', parts: [{ text: message }] });
                localHistory.push({ role: 'model', parts: [{ text }] });
                return { text };
            }

            // 3) Cache lookup scoped by chat type (general vs specific ecosystem)
            const scope: ChatScope = type === 'General' ? 'general' : 'ecosystem';
            const cacheKey = makeCacheKey(scope, type, lang, message);
            if (responseCache.has(cacheKey)) {
                const cached = responseCache.get(cacheKey) as string;
                localHistory.push({ role: 'user', parts: [{ text: message }] });
                localHistory.push({ role: 'model', parts: [{ text: cached }] });
                return { text: cached };
            }

            localHistory.push({ role: 'user', parts: [{ text: message }] });
            
            const result = await callApi('/api/generate', {
                model: AI_MODEL,
                contents: localHistory,
                config: { systemInstruction }
            });

            const text = result.text || "";
            localHistory.push({ role: 'model', parts: [{ text }] });
            responseCache.set(cacheKey, text);
            
            return { text };
        }
    };
}

export async function decomposeTask(task: Task, profile: UserProfile, lang: Language): Promise<Partial<Task>[]> {
    const prompt = `Break down the task "${task.title}" into smaller, actionable subtasks. 
    The original task has a duration of ${task.durationMinutes} minutes. 
    Assign a realistic, specific duration (in minutes) to each subtask. 
    Lang: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        durationMinutes: { type: Type.NUMBER }
                    },
                    required: ['title', 'durationMinutes']
                }
            }
        }
    });
    return parseJsonResponse<Partial<Task>[]>(result.text ?? '', []);
}

export async function optimizeDailySchedule(tasks: Task[], profile: UserProfile, lang: Language): Promise<any> {
    const tasksToSchedule = tasks.map(t => ({ id: t.id, title: t.title, duration: t.durationMinutes, priority: t.priority }));
    const prompt = `Organize these tasks into a logical daily schedule.
    Tasks: ${JSON.stringify(tasksToSchedule)}.
    User Energy Profile: Peaks at ${profile.energyProfile?.energyPeaks.join(', ')}.
    Language: ${lang}.
    Return a schedule mapping IDs to times.`;

    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    schedule: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                taskId: { type: Type.STRING },
                                time: { type: Type.STRING }
                            },
                            required: ['taskId', 'time']
                        }
                    }
                },
                required: ['schedule']
            }
        }
    });
    return parseJsonResponse<{ schedule: { taskId: string; time: string }[] }>(result.text ?? '', { schedule: [] });
}

export async function analyzeEcosystemSignals(profile: Partial<UserProfile>, lang: Language): Promise<EcosystemConfig[]> {
    const prompt = `Analyze this user profile to recommend life ecosystems. User: ${JSON.stringify(profile)}. Return JSON array of recommendations. Language: ${lang}`;
    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['work', 'sport', 'study', 'health'] },
                        enabled: { type: Type.BOOLEAN },
                        justification: { type: Type.STRING }
                    },
                    required: ['type', 'enabled', 'justification']
                }
            }
        }
    });
    return parseJsonResponse<EcosystemConfig[]>(result.text ?? '', []);
}

export async function generateFocuVisual(_prompt: string, _refImageBase64?: string): Promise<string | null> {
    // Image generation disabled (Groq is text-only).
    return null;
}

export async function evaluateProgress(logText: string, tasks: Task[], goals: Goal[], type: EcosystemType, lang: Language) {
    const prompt = `Evaluate progress log for the ${type} ecosystem: "${logText}". 
    Reference current tasks: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title })))}. 
    Reference current goals: ${JSON.stringify(goals.map(g => ({ id: g.id, title: g.title })))}. 
    Lang: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    productivityScore: { type: Type.NUMBER },
                    feedback: { type: Type.STRING },
                    generalProgressAdd: { type: Type.NUMBER },
                    updatedTaskIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    goalUpdates: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                progressAdd: { type: Type.NUMBER }
                            },
                            required: ['id', 'progressAdd']
                        }
                    }
                },
                required: ['productivityScore', 'feedback', 'updatedTaskIds', 'goalUpdates']
            }
        }
    });
    const defaultEval = {
        productivityScore: 0,
        feedback: '',
        generalProgressAdd: 0,
        updatedTaskIds: [] as string[],
        goalUpdates: [] as { id: string; progressAdd: number }[],
    };
    const data = parseJsonResponse<typeof defaultEval>(result.text ?? '', defaultEval);
    return {
        productivityScore: typeof data.productivityScore === 'number' ? data.productivityScore : 0,
        feedback: typeof data.feedback === 'string' ? data.feedback : '',
        generalProgressAdd: typeof data.generalProgressAdd === 'number' ? data.generalProgressAdd : 0,
        updatedTaskIds: Array.isArray(data.updatedTaskIds) ? data.updatedTaskIds : [],
        goalUpdates: Array.isArray(data.goalUpdates) ? data.goalUpdates : [],
    };
}

export async function generateDrawingTutorial(prompt: string, lang: Language, style: string, difficulty: string, material: string) {
    const contentPrompt = `Create a step-by-step drawing tutorial for "${prompt}" in ${style} style using ${material}. Difficulty: ${difficulty}. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: contentPrompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    estimatedTime: { type: Type.STRING },
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                visualPrompt: { type: Type.STRING }
                            },
                            required: ['text', 'visualPrompt']
                        }
                    },
                    tips: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['title', 'steps']
            }
        }
    });
    return parseJsonResponse<{ title?: string; difficulty?: string; estimatedTime?: string; steps?: { text: string; visualPrompt: string }[]; tips?: string[] }>(result.text ?? '', { title: '', steps: [] });
}

export async function parseTicketsFromText(text: string, lang: Language) {
    const prompt = `Extract exam tickets (questions) from the text below. Return ONLY a valid JSON array. Each element must be an object with exactly two keys: "number" (integer, 1-based) and "question" (string).

Rules:
- Each "question" must be a clear, self-contained exam question or topic (as a student would see on a ticket). Prefer full questions, not one-word topics.
- Preserve the order and numbering implied by the text. If the text has numbers (1., 2., etc.), use them; otherwise assign 1, 2, 3...
- Lang: ${lang}. Keep question text in the same language as the source.

Text: ${text.substring(0, 5000)}

Example output shape: [{"number":1,"question":"What is..."},{"number":2,"question":"Explain..."}]. No other text, no markdown.`;

    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });
    const arr = parseJsonResponse<{ number?: number; question?: string }[]>(result.text ?? '', []);
    return Array.isArray(arr) ? arr.filter((t: any) => t && (t.question != null && String(t.question).trim() !== '')) : [];
}

export async function generateTicketNote(question: string, subject: string, lang: Language) {
    const prompt = `You are an expert examiner and teacher. Write a full, detailed study note (конспект) for this exam ticket so the student can understand the topic deeply and pass the exam.

Exam subject: "${subject}"
Exam question / ticket: "${question}"

CRITICAL — ACCURACY AND SOURCES
- Base the note ONLY on standard curricula, widely used textbooks, and commonly accepted definitions in this field. Do not invent facts, dates, or definitions.
- Reason as if you had verified key facts against authoritative educational sources: include ONLY what would hold up in a textbook or official curriculum. If in doubt about a fact, omit it or phrase it cautiously (e.g. "often defined as...").
- The goal is that after reading this note, the student can safely reproduce the material on an exam without spreading errors.

LENGTH AND DEPTH (topic-adaptive)
- Simple or narrow topic: aim for 500–900 words (or equivalent in ${lang}). One clear definition, 2–3 main points, 1–2 examples, short conclusion.
- Medium topic (several concepts, cause-effect): 900–1400 words. Full structure: definition, main sections, causes and consequences, 2–4 examples, links between ideas, typical exam follow-ups.
- Broad or complex topic (theory, multi-part question): 1400–2200 words. Exhaustive but structured: multiple ## sections, subsections ###, definitions of all key terms, step-by-step or chronological logic where needed, several examples, "What is often asked" / "Common mistakes" / "Typical follow-up questions" at the end.
- Every paragraph must add information the student might need to reproduce or recognize on the exam. No filler. Prefer complete, structured content.

STRUCTURE (strict Markdown)
- Exactly one # for the main title (topic or question in short form).
- ## for major sections (e.g. Definition, Main points, Causes and effects, Examples, Conclusion).
- ### for subsections. Use - or * for bullet lists; numbered lists only when order matters (steps, chronology).
- Bold only key terms and definitions with **term**. Do not bold whole sentences. No raw asterisks for emphasis; only **...** for bold. No extra markdown (no inline code unless necessary).

CLARITY AND LANGUAGE
- Write in ${lang}. Tone: clear, educational, exam-oriented. Explain so a student can follow without prior knowledge of this exact topic.
- End with a short block (if useful): "Что часто спрашивают" / "Typical exam follow-ups" or "Common mistakes" — 2–4 concrete points only.

Output only the Markdown note, no preamble or closing.`;
    
    const result = await callApi('/api/generate', { 
        model: AI_MODEL, 
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text || "";
}

export async function generateGlossaryAndCards(tickets: Ticket[], subject: string, lang: Language) {
    const ticketsList = tickets.slice(0, 80).map((t, i) => ({ number: i + 1, question: t.question })).filter(t => t.question);
    const prompt = `You are an expert teacher preparing a student for an exam. Create a glossary and flashcards that maximize exam success. All content must be accurate and exam-relevant.

Subject: "${subject}"

Tickets (each has a number 1, 2, 3, ...). For EACH ticket you MUST generate exactly 2, 3, or 4 flashcards depending on topic complexity:
- Simple / narrow topic → 2 flashcards
- Medium topic → 3 flashcards
- Broad or complex topic → 4 flashcards

ACCURACY AND USEFULNESS
- Glossary: Include only terms that are central to these tickets. Definitions must be short, precise, and match standard curricula or textbooks. Do not invent or guess definitions — only include terms you are confident you can define correctly.
- Flashcards: Each question–answer pair must test knowledge that is actually required for the exam and that you are sure is correct. Prefer exam-style formulations (definitions, "What is...?", "Why...?", "How does...?"). One question per card; no compound questions. Answers: maximum 15 words; only key facts the student must reproduce.

Tickets list (number + question):
${JSON.stringify(ticketsList, null, 0)}

Output requirements:
1) "glossary" – array of objects with "word" and "definition". Definitions exam-ready and accurate. No filler.
2) "flashcards" – array of objects. Each MUST have:
   - "question" (string): one clear question for active recall.
   - "answer" (string): concise answer, max 15 words.
   - "ticketNumber" (number): the ticket number (1-based) this card belongs to. Every card must be assigned to exactly one ticket.

Rules:
- Total flashcards = sum over all tickets: each ticket gets 2, 3, or 4 cards (never 1 or 5+). So if there are 10 tickets, between 20 and 40 cards.
- Prioritize high-yield information: what is most likely to be asked or required in a good answer.
- Language: ${lang}.

Return ONLY a valid JSON object with exactly two keys: "glossary" and "flashcards". No other text, no markdown.
Example shape: {"glossary":[{"word":"X","definition":"..."}],"flashcards":[{"question":"...?","answer":"...","ticketNumber":1},...]}`;

    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });
    const def = { glossary: [] as { word: string; definition: string }[], flashcards: [] as { question: string; answer: string; ticketNumber?: number }[] };
    const data = parseJsonResponse<typeof def>(result.text ?? '', def);
    return {
        glossary: Array.isArray(data.glossary) ? data.glossary : [],
        flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
    };
}

export async function generateQuiz(question: string, subject: string, lang: Language, count: number) {
    const prompt = `You are an expert examiner. Generate exactly ${count} multiple-choice quiz questions to check knowledge that is USEFUL for the exam and that you are CERTAIN is correct.

Subject: "${subject}"
This ticket only (do not go beyond this topic): "${question}"

MANDATORY QUALITY RULES
1) CORRECTNESS: For every question you must be 100% sure that the indicated correct answer is factually right according to standard curricula and textbooks. Do not include questions where the "correct" answer is debatable or differs between sources. If you are not certain, do not add that question — produce fewer questions but all correct.
2) USEFULNESS: Each question must test knowledge that is actually needed for the exam: definitions, key facts, cause-effect, or application that a student would be expected to know. Do not ask trivial details, trick questions, or things that would never appear on a real exam. Ask what matters for passing.
3) ONE TOPIC: Every question must be strictly about this ticket's topic only. Base questions on content that would appear in a solid study note for this exact question. No tangents.

QUESTION DESIGN
- Be concrete: specific facts, terms, or reasoning (e.g. "What is the definition of X?", "Why does Y happen?", "Which of the following is an example of Z?"). Avoid vague or generic questions.
- Exactly 4 options per question; one correct. correctIndex is 0-based (0, 1, 2, or 3). Options must be clear, distinct, and plausible; wrong answers must be clearly wrong to someone who knows the material.
- Vary difficulty: about 1/3 easy (direct recall), 1/3 medium (understanding, cause-effect), 1/3 hard (application, interpretation). All must still be on this ticket and correct.
- Language: ${lang}.

Before outputting, mentally verify: (a) the correct answer is indisputable, (b) testing this knowledge helps the student for the exam.

Return ONLY a JSON array. Each object: "question" (string), "options" (array of 4 strings), "correctIndex" (number 0-3), "difficulty" (string: "easy" | "medium" | "hard"). No other text.`;
    
    const result = await callApi('/api/generate', { 
        model: AI_MODEL, 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });
    const arr = parseJsonResponse<{ question: string; options: string[]; correctIndex: number; difficulty?: string }[]>(result.text ?? '', []);
    return Array.isArray(arr) ? arr : [];
}

/** Приводит названия упражнений к нормальным русским (без смешения с английским и опечаток). */
function normalizeExerciseNameRu(name: string): string {
    if (!name || !name.trim()) return name;
    const raw = name.trim();
    // Сначала точные соответствия для типичных кривых названий от API
    const lower = raw.toLowerCase();
    if (/\b(cable|кабел|блок).*(biceps|бісер|бицепс).*(curl|сгибание)/i.test(raw) || /бісер[sѕ].*curl|кабельный.*curl/i.test(raw))
        return 'Сгибание рук на блоке (бицепс)';
    if (/\b(cable|кабел).*(crossover|кроссовер).*(fly|сведение)/i.test(raw) || /crossover\s*fly|сведение.*кроссовер/i.test(raw))
        return 'Сведение рук в кроссовере';
    if (/\b(cable|кабел).*(chest|груд).*(press|жим)/i.test(raw) || /chest\s*press/i.test(raw))
        return 'Жим в кроссовере';
    if (/triceps.*pushdown|разгибание.*трицепс|разгибание.*канат/i.test(raw))
        return 'Разгибание рук на блоке (трицепс)';
    if (/lat\s*pulldown|тяга.*верхнего блока/i.test(raw))
        return 'Тяга верхнего блока';
    if (/leg\s*press|жим ногами/i.test(raw))
        return 'Жим ногами';
    if (/bent[- ]?over\s*row|тяга в наклоне/i.test(raw))
        return 'Тяга в наклоне';
    if (/pull[- ]?up|подтягиван/i.test(raw))
        return 'Подтягивания';
    if (/\bdip\b|отжимания на брусьях/i.test(raw))
        return 'Отжимания на брусьях';
    if (/bench\s*press|жим лёжа|жим лежа/i.test(raw))
        return 'Жим лёжа';
    if (/deadlift|становая тяга/i.test(raw))
        return 'Становая тяга';
    if (/squat|приседан/i.test(raw) && /штанг|barbell/i.test(raw))
        return 'Приседания со штангой';
    if (/goblet\s*squat|гоблет/i.test(raw))
        return 'Гоблет-присед';
    if (/dumbbell.*row|тяга гантел/i.test(raw))
        return 'Тяга гантели в наклоне';
    if (/lateral\s*raise|махи в стороны/i.test(raw))
        return 'Махи гантелями в стороны';
    if (/romanian|румынская/i.test(raw))
        return 'Румынская тяга';
    if (/plank|планка/i.test(raw))
        return 'Планка';
    if (/crunch|скручиван/i.test(raw))
        return 'Скручивания';
    // Опечатка БІСЕРЅ и прочие латинские вкрапления
    let s = raw.replace(/бісерѕ|бісерs|БІСЕРЅ/gi, 'бицепс').replace(/Biceps|Curl|Crossover|Fly|Chest\s+Press|Press|Cable/gi, (m) => {
        const map: Record<string, string> = { biceps: 'бицепс', curl: 'сгибание рук на блоке', crossover: 'в кроссовере', fly: 'сведение рук', chest: 'грудь', press: 'жим', cable: 'на блоке' };
        return map[m.toLowerCase()] || m;
    });
    s = s.replace(/\s+/g, ' ').trim();
    if (s.length > 0) s = s[0].toUpperCase() + s.slice(1).toLowerCase();
    return s || raw;
}

export async function generateWorkout(user: UserProfile, lang: Language, muscleGroups: string[] = []): Promise<WorkoutPlan> {
    const level = user.fitnessLevel || 'beginner';
    const goal = user.fitnessGoal || 'general fitness';
    const equipmentList = (user.fitnessEquipment && user.fitnessEquipment.length) ? user.fitnessEquipment : ['bodyweight'];
    const equipmentStr = equipmentList.join(', ');

    const levelRules: Record<string, string> = {
        beginner: 'Beginner: 4-5 exercises only, basic movements, 2-3 sets, simple progressions. No complex combinations.',
        intermediate: 'Intermediate: 5-7 exercises, 3 sets. Include at least 1-2 classic real-gym exercises (e.g. bench press, barbell/dumbbell row, leg press, pull-ups, dips) that people actually do in gyms. Mix with simpler ones.',
        advanced: 'Advanced: 6-8 exercises, 3-4 sets. Include several challenging gym standards: compound lifts (bench, squat, deadlift, row), pull-ups/dips, isolation with proper form. Exercises that real trainees do in the gym, not only basics.',
    };
    const goalRules: Record<string, string> = {
        'weight loss': 'Goal WEIGHT LOSS: higher reps (12-15), shorter rest (45-60s), include cardio-style or circuit if possible. Burn focus.',
        'muscle gain': 'Goal MUSCLE GAIN: hypertrophy style, 8-12 reps, 3-4 sets, rest 60-90s. Compound then isolation. Strength focus.',
        'general fitness': 'Goal GENERAL FITNESS: balanced, 10-12 reps, 3 sets, 60s rest. Mix compound and isolation.',
        'endurance': 'Goal ENDURANCE: higher reps (15-20), shorter rest (30-45s), lighter load emphasis. Stamina focus.',
    };

    const focusRule = muscleGroups.length > 0
        ? `Target ONLY these muscle groups: ${muscleGroups.join(', ')}. 4-6 exercises.`
        : 'Full body: legs, push, pull, core. 5-7 exercises, compound first then isolation.';

    const langRule = lang === 'ru'
        ? `LANGUAGE: ONLY RUSSIAN. Title and every exercise "name" must be 100% in Russian. FORBIDDEN: English words (Curl, Fly, Press, Cable, Crossover, Biceps, etc.), mixed names like "Кабельный Curl" or "Cable Biceps". Use ONLY these style names:
Штанга: Жим лёжа, Становая тяга, Приседания со штангой, Тяга штанги в наклоне, Жим стоя, Сгибание рук со штангой.
Гантели: Тяга гантели в наклоне, Жим гантелей лёжа, Сгибание рук с гантелями, Махи гантелями в стороны, Разводка гантелей, Румынская тяга с гантелями, Выпады с гантелями, Гоблет-присед.
Блок/кабель/кроссовер: Сгибание рук на блоке (бицепс), Разгибание рук на блоке (трицепс), Тяга верхнего блока, Тяга горизонтального блока, Сведение рук в кроссовере, Разгибание рук с канатом на блоке, Жим в кроссовере.
Турник/брусья: Подтягивания, Отжимания на брусьях, Подъём ног в висе.
Ноги: Жим ногами, Разгибание ног в тренажёре, Сгибание ног лёжа.
Кор: Планка, Скручивания, Подъём корпуса.
Write "бицепс" and "трицепс" in Russian only, no Biceps/Curl.`
        : `LANGUAGE: English. Title and exercise names in English (e.g. Barbell Bench Press, Lat Pulldown).`;

    const prompt = `You are a fitness coach. Create ONE workout plan as JSON.

RULES:
1) ${levelRules[level] ?? levelRules.beginner}
2) ${goalRules[goal] ?? goalRules['general fitness']}
3) ${focusRule}
4) Use ONLY equipment the user has: ${equipmentStr}. Set "equipment" to the piece used.
5) ${langRule}

Output: JSON with "title", "durationMinutes", "exercises". Each: "name" (only in the required language, no mixing), "sets", "reps", "restSeconds", "notes", "equipment". Max 8 exercises.

Return ONLY valid JSON. Example for Russian: {"title":"Грудь и бицепс","durationMinutes":45,"exercises":[{"name":"Жим лёжа","sets":3,"reps":"10","restSeconds":60,"notes":"","equipment":"barbell"},{"name":"Сгибание рук на блоке","sets":3,"reps":"12","restSeconds":60,"notes":"","equipment":"cable"}]}`;

    const result = await callApi('/api/generate', {
        model: AI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
    });
    const def = { title: '', durationMinutes: 30, exercises: [] as WorkoutPlan['exercises'] };
    const data = parseJsonResponse<{ title?: string; durationMinutes?: number; exercises?: any[] }>(result.text ?? '', def);
    const rawExercises = Array.isArray(data.exercises) ? data.exercises : [];
    const exercises = rawExercises.map((e: any, i: number) => {
        let name = (e?.name ?? e?.title ?? e?.exercise ?? '').toString().trim() || `Exercise ${i + 1}`;
        if (lang === 'ru') name = normalizeExerciseNameRu(name);
        return {
            id: (e?.id ?? e?.name ?? name ?? `ex_${i}`).toString().replace(/\s+/g, '_'),
            name,
            sets: typeof e?.sets === 'number' ? e.sets : (typeof e?.sets === 'string' ? parseInt(e.sets, 10) : 3) || 3,
            reps: (e?.reps ?? e?.rep_range ?? e?.repetitions ?? '10').toString(),
            restSeconds: typeof e?.restSeconds === 'number' ? e.restSeconds : (typeof e?.rest === 'number' ? e.rest : 60),
            notes: (e?.notes ?? e?.description ?? '').toString(),
            equipment: (e?.equipment ?? e?.equipment_needed ?? '').toString(),
        };
    }).filter((e: { name: string }) => e.name.length > 0);
    return {
        title: typeof data.title === 'string' && data.title.length ? data.title : (lang === 'ru' ? 'Тренировка' : 'Workout'),
        durationMinutes: typeof data.durationMinutes === 'number' ? data.durationMinutes : 30,
        exercises,
        date: getLocalISODate(),
    };
}

export async function getExerciseTechnique(exerciseName: string, equipment: string, lang: Language): Promise<string> {
    const prompt = `Explain the proper technique and safety tips for the exercise: "${exerciseName}" using ${equipment}. Format using Markdown. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: AI_MODEL, 
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text || "";
}

export async function analyzeHealthLog(log: { sleep: number, stress: number, energy: number }, user: UserProfile, lang: Language): Promise<HealthDailyLog> {
    const prompt = `Analyze health log: Sleep ${log.sleep}/10, Stress ${log.stress}/10, Energy ${log.energy}/10. User Profile: ${JSON.stringify(user.energyProfile)}. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: AI_MODEL, 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    energyScore: { type: Type.NUMBER },
                    recoveryScore: { type: Type.NUMBER },
                    burnoutRisk: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                    recommendations: {
                        type: Type.OBJECT,
                        properties: {
                            morning: { type: Type.STRING },
                            day: { type: Type.STRING },
                            evening: { type: Type.STRING }
                        },
                        required: ['morning', 'day', 'evening']
                    },
                    notes: { type: Type.STRING }
                },
                required: ['energyScore', 'burnoutRisk', 'recommendations']
            }
        } 
    });
    const def = {
        energyScore: 5,
        recoveryScore: 5,
        burnoutRisk: 'Low' as const,
        recommendations: { morning: '', day: '', evening: '' },
        notes: '',
    };
    const data = parseJsonResponse<{ energyScore?: number; recoveryScore?: number; burnoutRisk?: string; recommendations?: { morning?: string; day?: string; evening?: string }; notes?: string }>(result.text ?? '', def);
    return {
        date: getLocalISODate(),
        sleep: log.sleep,
        stress: log.stress,
        energy: log.energy,
        energyScore: typeof data.energyScore === 'number' ? data.energyScore : 5,
        recoveryScore: typeof data.recoveryScore === 'number' ? data.recoveryScore : 5,
        burnoutRisk: (data.burnoutRisk === 'Low' || data.burnoutRisk === 'Medium' || data.burnoutRisk === 'High') ? data.burnoutRisk : 'Low',
        recommendations: {
            morning: data.recommendations?.morning ?? '',
            day: data.recommendations?.day ?? '',
            evening: data.recommendations?.evening ?? '',
        },
        notes: typeof data.notes === 'string' ? data.notes : '',
    };
}
