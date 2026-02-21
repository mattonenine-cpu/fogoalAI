
import { UserProfile, Task, Language, Goal, EcosystemType, HelpContext, EcosystemConfig, HealthDailyLog, WorkoutPlan, Ticket } from '../types';

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
    reply: 'I can break tasks into steps, design your day, assist with study, workouts and health.'
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
                model: 'gemini-3-flash-preview',
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
            // 1) Ecosystem‑specific canned replies (for sport / study / health / work)
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
                model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-flash-preview',
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
    return JSON.parse(cleanTextOutput(result.text || "[]"));
}

export async function optimizeDailySchedule(tasks: Task[], profile: UserProfile, lang: Language): Promise<any> {
    const tasksToSchedule = tasks.map(t => ({ id: t.id, title: t.title, duration: t.durationMinutes, priority: t.priority }));
    const prompt = `Organize these tasks into a logical daily schedule.
    Tasks: ${JSON.stringify(tasksToSchedule)}.
    User Energy Profile: Peaks at ${profile.energyProfile?.energyPeaks.join(', ')}.
    Language: ${lang}.
    Return a schedule mapping IDs to times.`;

    const result = await callApi('/api/generate', {
        model: 'gemini-3-flash-preview',
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
    return JSON.parse(cleanTextOutput(result.text || "{}"));
}

export async function analyzeEcosystemSignals(profile: Partial<UserProfile>, lang: Language): Promise<EcosystemConfig[]> {
    const prompt = `Analyze this user profile to recommend life ecosystems. User: ${JSON.stringify(profile)}. Return JSON array of recommendations. Language: ${lang}`;
    const result = await callApi('/api/generate', {
        model: 'gemini-3-flash-preview',
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
    return JSON.parse(cleanTextOutput(result.text || "[]"));
}

export async function evaluateProgress(logText: string, tasks: Task[], goals: Goal[], type: EcosystemType, lang: Language) {
    const prompt = `Evaluate progress log for the ${type} ecosystem: "${logText}". 
    Reference current tasks: ${JSON.stringify(tasks.map(t => ({ id: t.id, title: t.title })))}. 
    Reference current goals: ${JSON.stringify(goals.map(g => ({ id: g.id, title: g.title })))}. 
    Lang: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: 'gemini-3-flash-preview',
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
    return JSON.parse(cleanTextOutput(result.text || "{}"));
}

export async function generateDrawingTutorial(prompt: string, lang: Language, style: string, difficulty: string, material: string) {
    const contentPrompt = `Create a step-by-step drawing tutorial for "${prompt}" in ${style} style using ${material}. Difficulty: ${difficulty}. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: 'gemini-3-flash-preview',
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
    return JSON.parse(cleanTextOutput(result.text || "{}"));
}

export async function parseTicketsFromText(text: string, lang: Language) {
    const prompt = `Extract exam tickets/questions from this text: "${text.substring(0, 5000)}". Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: 'gemini-3-flash-preview', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        number: { type: Type.NUMBER },
                        question: { type: Type.STRING }
                    },
                    required: ['number', 'question']
                }
            }
        } 
    });
    return JSON.parse(cleanTextOutput(result.text || "[]"));
}

export async function generateTicketNote(question: string, subject: string, lang: Language) {
    const prompt = `Write a comprehensive study note for the exam question: "${question}" in the subject: "${subject}". 
    Format using Markdown. Lang: ${lang}. Focus on being educational and well-structured.`;
    
    const result = await callApi('/api/generate', { 
        model: 'gemini-3-flash-preview', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text || "";
}

export async function generateGlossaryAndCards(tickets: Ticket[], subject: string, lang: Language) {
    const prompt = `Create a glossary and flashcards for studying the subject: "${subject}". 
    IMPORTANT: Flashcard answers MUST be extremly concise (max 15 words).
    For EACH question in the provided list, generate between 2 to 5 flashcards depending on the complexity and volume of the topic. Ensure comprehensive coverage.
    Questions: ${JSON.stringify(tickets.map(t => t.question))}. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: 'gemini-3-flash-preview', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    glossary: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                word: { type: Type.STRING },
                                definition: { type: Type.STRING }
                            },
                            required: ['word', 'definition']
                        }
                    },
                    flashcards: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                answer: { type: Type.STRING }
                            },
                            required: ['question', 'answer']
                        }
                    }
                },
                required: ['glossary', 'flashcards']
            }
        } 
    });
    return JSON.parse(cleanTextOutput(result.text || "{}"));
}

export async function generateQuiz(question: string, subject: string, lang: Language, count: number) {
    const prompt = `Generate ${count} multiple-choice quiz questions for the topic: "${question}". Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: 'gemini-3-flash-preview', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctIndex: { type: Type.NUMBER }
                    },
                    required: ['question', 'options', 'correctIndex']
                }
            }
        } 
    });
    return JSON.parse(cleanTextOutput(result.text || "[]"));
}

export async function generateWorkout(user: UserProfile, lang: Language, muscleGroups: string[] = []): Promise<WorkoutPlan> {
    const muscleContext = muscleGroups.length > 0 ? `Focus ONLY on these muscle groups: ${muscleGroups.join(', ')}.` : 'Create a balanced full-body workout.';
    const prompt = `Generate a workout plan for a user with goal: ${user.fitnessGoal}, level: ${user.fitnessLevel}, and equipment: ${user.fitnessEquipment?.join(', ')}. ${muscleContext} Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: 'gemini-3-flash-preview', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    durationMinutes: { type: Type.NUMBER },
                    exercises: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                name: { type: Type.STRING },
                                sets: { type: Type.NUMBER },
                                reps: { type: Type.STRING },
                                restSeconds: { type: Type.NUMBER },
                                notes: { type: Type.STRING },
                                equipment: { type: Type.STRING }
                            },
                            required: ['id', 'name', 'sets', 'reps']
                        }
                    }
                },
                required: ['title', 'exercises']
            }
        } 
    });
    const data = JSON.parse(cleanTextOutput(result.text || "{}"));
    return { ...data, date: getLocalISODate() };
}

export async function getExerciseTechnique(exerciseName: string, equipment: string, lang: Language): Promise<string> {
    const prompt = `Explain the proper technique and safety tips for the exercise: "${exerciseName}" using ${equipment}. Format using Markdown. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: 'gemini-3-flash-preview', 
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text || "";
}

export async function analyzeHealthLog(log: { sleep: number, stress: number, energy: number }, user: UserProfile, lang: Language): Promise<HealthDailyLog> {
    const prompt = `Analyze health log: Sleep ${log.sleep}/10, Stress ${log.stress}/10, Energy ${log.energy}/10. User Profile: ${JSON.stringify(user.energyProfile)}. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', { 
        model: 'gemini-3-flash-preview', 
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
    const data = JSON.parse(cleanTextOutput(result.text || "{}"));
    return { ...data, date: getLocalISODate(), sleep: log.sleep, stress: log.stress, energy: log.energy };
}
