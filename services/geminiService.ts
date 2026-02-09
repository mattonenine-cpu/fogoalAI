
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

export const cleanTextOutput = (text: string = "") => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * Helper to call the Vercel API endpoints (non-streaming)
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
 * Streaming helper -- reads SSE from the API and calls onChunk for each piece of text
 */
async function callApiStream(
    endpoint: string, 
    body: any, 
    onChunk: (text: string) => void
): Promise<string> {
    console.log("[v0] callApiStream: starting stream request to", endpoint);
    
    let response: Response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...body, stream: true })
        });
    } catch (fetchErr: any) {
        console.error("[v0] callApiStream: fetch failed", fetchErr);
        throw fetchErr;
    }

    console.log("[v0] callApiStream: response status", response.status, "content-type", response.headers.get("content-type"));

    if (!response.ok) {
        let errMsg = `Connection Error (${response.status}).`;
        try {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();
                errMsg = data.error || errMsg;
                console.error("[v0] callApiStream: server error JSON", data);
            } else {
                const text = await response.text();
                console.error("[v0] callApiStream: server error text", text.substring(0, 500));
            }
        } catch (parseErr) {
            console.error("[v0] callApiStream: could not parse error response", parseErr);
        }
        throw new Error(errMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        console.error("[v0] callApiStream: no response body reader");
        throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                const payload = trimmed.slice(6);
                if (payload === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(payload);
                    if (parsed.error) {
                        console.error("[v0] callApiStream: server sent error event", parsed.error);
                        throw new Error(parsed.error);
                    }
                    if (parsed.text) {
                        fullText += parsed.text;
                        onChunk(fullText);
                    }
                } catch (jsonErr: any) {
                    if (jsonErr.message && !jsonErr.message.includes('JSON')) {
                        throw jsonErr; // re-throw error events
                    }
                    console.warn("[v0] callApiStream: could not parse chunk", payload.substring(0, 100));
                }
            }
        }
    } catch (readErr: any) {
        console.error("[v0] callApiStream: read error", readErr);
        // If we already have some text, return it; otherwise rethrow
        if (fullText) {
            console.warn("[v0] callApiStream: returning partial text after error");
            return fullText;
        }
        throw readErr;
    }

    console.log("[v0] callApiStream: complete, total length", fullText.length);
    return fullText;
}

/**
 * Creates a helper session for contextual advice
 */
export function createHelpSession(context: HelpContext, profile: UserProfile, lang: Language) {
    const localHistory: any[] = [];
    const systemInstruction = `You are a helpful assistant providing contextual help for ${context.blockName}. Task: ${context.taskText}. User: ${profile.name || 'User'}. Lang: ${lang}. Be extremely concise.`;
    const chatConfig = { systemInstruction, thinkingConfig: { thinkingLevel: 'low' } };

    return {
        sendMessage: async ({ message, onChunk }: { message: string; onChunk?: (text: string) => void }) => {
            localHistory.push({ role: 'user', parts: [{ text: message }] });
            
            let text: string;
            if (onChunk) {
                text = await callApiStream('/api/generate', {
                    model: 'gemini-3-flash-preview',
                    contents: localHistory,
                    config: chatConfig
                }, onChunk);
            } else {
                const result = await callApi('/api/generate', {
                    model: 'gemini-3-flash-preview',
                    contents: localHistory,
                    config: chatConfig
                });
                text = result.text || "";
            }

            localHistory.push({ role: 'model', parts: [{ text }] });
            return { text };
        }
    };
}

/**
 * Creates a chat session for ecosystem-specific coaching or general chat
 */
export function createChatSession(user: UserProfile, history: any[], lang: Language, tasks: Task[], type: string = 'General') {
    const localHistory = [...history];
    const systemInstruction = `You are FoGoal AI, an expert AI coach for the ${type} ecosystem. User: ${user.name || 'User'}. Lang: ${lang}. Recent tasks context: ${JSON.stringify(tasks.slice(0, 5))}. Be concise and motivating.`;
    const chatConfig = { systemInstruction, thinkingConfig: { thinkingLevel: 'low' } };

    return {
        sendMessage: async ({ message, onChunk }: { message: string; onChunk?: (text: string) => void }) => {
            localHistory.push({ role: 'user', parts: [{ text: message }] });
            
            let text: string;
            if (onChunk) {
                text = await callApiStream('/api/generate', {
                    model: 'gemini-3-flash-preview',
                    contents: localHistory,
                    config: chatConfig
                }, onChunk);
            } else {
                const result = await callApi('/api/generate', {
                    model: 'gemini-3-flash-preview',
                    contents: localHistory,
                    config: chatConfig
                });
                text = result.text || "";
            }

            localHistory.push({ role: 'model', parts: [{ text }] });
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
    IMPORTANT: Flashcard answers MUST be very short (maximum 10-12 words) to fit on a mobile card.
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

export async function generateWorkout(user: UserProfile, lang: Language): Promise<WorkoutPlan> {
    const prompt = `Generate a workout plan for a user with goal: ${user.fitnessGoal}, level: ${user.fitnessLevel}, and equipment: ${user.fitnessEquipment?.join(', ')}. Lang: ${lang}`;
    
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
