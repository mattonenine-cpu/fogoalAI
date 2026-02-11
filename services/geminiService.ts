
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

// FAST: Ultra-low latency for chat and quick checks
const FAST_MODEL = 'gemini-2.0-flash-lite-preview-02-05';
// COMPLEX: High intelligence for planning and creation, kept on 2.0 Flash for speed/quality balance
const COMPLEX_MODEL = 'gemini-2.0-flash-001';

export const getLocalISODate = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

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
                // Handle 503/429 specifically if needed, otherwise throw generic
                throw new Error(data.error || data.message || `Server error: ${response.status}`);
            }
            return data;
        } else {
            const text = await response.text();
            console.error(`Non-JSON response from ${endpoint}:`, text.substring(0, 200));
            throw new Error(`Connection Error (${response.status}). Please check Vercel logs and ensure API_KEY is set.`);
        }
    } catch (error: any) {
        console.error(`Error calling ${endpoint}:`, error);
        throw error;
    }
}

/**
 * Creates a helper session for contextual advice
 * OPTIMIZED: Strict constraints on length and structure.
 */
export function createHelpSession(context: HelpContext, profile: UserProfile, lang: Language) {
    const localHistory: any[] = [];
    const systemInstruction = `Role: Productivity Expert. 
    Context: User is working on "${context.blockName}". Task: "${context.taskText}".
    Language: ${lang}.
    
    STRICT RULES:
    1. Answer in 1-2 short sentences.
    2. Be actionable immediately.
    3. No fluff ("Here is advice...").
    4. Use Markdown bolding for key verbs.`;

    return {
        sendMessage: async ({ message }: { message: string }) => {
            localHistory.push({ role: 'user', parts: [{ text: message }] });
            
            const result = await callApi('/api/generate', {
                model: FAST_MODEL,
                contents: localHistory,
                config: { 
                    systemInstruction,
                    temperature: 0.6, // Lower temperature for more focused answers
                    maxOutputTokens: 150 // Hard limit to force brevity
                }
            });

            const text = result.text || "";
            localHistory.push({ role: 'model', parts: [{ text }] });
            
            return { text };
        }
    };
}

/**
 * Creates a chat session for ecosystem-specific coaching or general chat
 * OPTIMIZED: Structural formatting enforced.
 */
export function createChatSession(user: UserProfile, history: any[], lang: Language, tasks: Task[], type: string = 'General') {
    const localHistory = [...history];
    const systemInstruction = `You are FoGoal, an elite AI coach for ${type}.
    User: ${user.name || 'User'}. Lang: ${lang}.
    Context: ${JSON.stringify(tasks.slice(0, 5).map(t => t.title))}.

    RESPONSE GUIDELINES:
    1. **Structure:** Use bullet points (•) and bold text (**bold**) heavily.
    2. **Brevity:** Keep paragraphs under 2 lines.
    3. **Tone:** Professional, energetic, direct.
    4. **Formatting:** Never use plain text blocks. Break it down.
    5. **No filler:** Start directly with the answer. Avoid "Hello", "Sure", "I can help".`;

    return {
        sendMessage: async (payload: { message?: string, parts?: any[] }) => {
            let newParts: any[] = [];
            
            if (payload.parts) {
                newParts = payload.parts;
            } else if (payload.message) {
                if (typeof payload.message === 'string') {
                    newParts = [{ text: payload.message }];
                } else if (Array.isArray(payload.message)) {
                    newParts = payload.message;
                }
            }

            if (newParts.length > 0) {
                localHistory.push({ role: 'user', parts: newParts });
            }
            
            const result = await callApi('/api/generate', {
                model: FAST_MODEL,
                contents: localHistory,
                config: { 
                    systemInstruction,
                    temperature: 0.7 
                }
            });

            const text = result.text || "";
            if (text) {
                localHistory.push({ role: 'model', parts: [{ text }] });
            }
            
            return result;
        }
    };
}

export async function decomposeTask(task: Task, profile: UserProfile, lang: Language): Promise<Partial<Task>[]> {
    const prompt = `Decompose task: "${task.title}" (${task.durationMinutes} min).
    Output: JSON Array of subtasks.
    Rules:
    1. Total time must equal ${task.durationMinutes}.
    2. Titles must be action-oriented verbs.
    Language: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: FAST_MODEL,
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
    const prompt = `Create optimal schedule.
    Tasks: ${JSON.stringify(tasksToSchedule)}.
    Peaks: ${profile.energyProfile?.energyPeaks.join(', ')}.
    Lang: ${lang}.
    Return JSON only.`;

    const result = await callApi('/api/generate', {
        model: COMPLEX_MODEL,
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
    const prompt = `Analyze user: ${JSON.stringify(profile)}. 
    Recommend 3-5 ecosystems (work, sport, study, health, creativity).
    Return JSON. Lang: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: COMPLEX_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['work', 'sport', 'study', 'health', 'creativity'] },
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

export async function generateFocuVisual(prompt: string, refImageBase64?: string): Promise<string | null> {
    try {
        const result = await callApi('/api/generate-image', {
            prompt,
            refImageBase64
        });
        return result.imageUrl;
    } catch (e) {
        console.error("Image generation failed", e);
        return null;
    }
}

export async function evaluateProgress(logText: string, tasks: Task[], goals: Goal[], type: EcosystemType, lang: Language) {
    const prompt = `Analyze progress log: "${logText}" for ${type}.
    Context: Tasks [${tasks.map(t => t.title).join(', ')}], Goals [${goals.map(g => g.title).join(', ')}].
    
    Return JSON:
    - productivityScore: 0-100 based on impact.
    - feedback: 1 sentence, encouraging but factual.
    - updatedTaskIds: list of IDs if completed.
    - goalUpdates: list of {id, progressAdd}.
    Lang: ${lang}`;
    
    const result = await callApi('/api/generate', {
        model: FAST_MODEL,
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
    const contentPrompt = `Create drawing tutorial for "${prompt}". Style: ${style}, Material: ${material}, Difficulty: ${difficulty}.
    Lang: ${lang}.
    Structure: Title, Time, 4-6 concise steps (visualPrompt + text), 3 tips.`;
    
    const result = await callApi('/api/generate', {
        model: COMPLEX_MODEL,
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
    const prompt = `Extract exam questions from text. Max 5000 chars processed.
    Input: "${text.substring(0, 5000)}".
    Lang: ${lang}.
    Return JSON array of {number, question}.`;
    
    const result = await callApi('/api/generate', { 
        model: COMPLEX_MODEL, 
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
    const prompt = `Write a structured study note for "${question}" (Subject: ${subject}).
    Lang: ${lang}.
    Format: Markdown.
    Structure:
    # Main Concept
    - Key point 1
    - Key point 2
    ## Details
    Concise explanation.
    **Keywords**: Term1, Term2.`;
    
    const result = await callApi('/api/generate', { 
        model: COMPLEX_MODEL, 
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text || "";
}

export async function generateGlossaryAndCards(tickets: Ticket[], subject: string, lang: Language) {
    const prompt = `Generate study materials for ${subject}.
    Questions: ${JSON.stringify(tickets.map(t => t.question))}.
    Lang: ${lang}.
    Return: 
    1. Glossary (5 key terms).
    2. Flashcards (2 per question, VERY short answers).`;
    
    const result = await callApi('/api/generate', { 
        model: COMPLEX_MODEL, 
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
    const prompt = `Create ${count} multiple-choice questions for "${question}".
    Lang: ${lang}.
    Format: JSON.`;
    
    const result = await callApi('/api/generate', { 
        model: FAST_MODEL,
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
    const muscleContext = muscleGroups.length > 0 ? `Focus: ${muscleGroups.join(', ')}.` : 'Full Body.';
    const prompt = `Create workout. Goal: ${user.fitnessGoal}, Level: ${user.fitnessLevel}, Equip: ${user.fitnessEquipment?.join(', ')}. ${muscleContext}
    Lang: ${lang}.
    Return JSON.`;
    
    const result = await callApi('/api/generate', { 
        model: COMPLEX_MODEL, 
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
    const prompt = `Technique guide for "${exerciseName}" (${equipment}).
    Lang: ${lang}.
    Format: Markdown. 
    Structure: 
    # Setup
    - step 1
    # Execution
    - step 2
    **Safety**: Key warning.`;
    
    const result = await callApi('/api/generate', { 
        model: FAST_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    return result.text || "";
}

export async function analyzeHealthLog(log: { sleep: number, stress: number, energy: number }, user: UserProfile, lang: Language): Promise<HealthDailyLog> {
    const prompt = `Analyze health: Sleep ${log.sleep}, Stress ${log.stress}, Energy ${log.energy}.
    Lang: ${lang}.
    Return JSON with scores and brief recommendations.`;
    
    const result = await callApi('/api/generate', { 
        model: FAST_MODEL, 
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
