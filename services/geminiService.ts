
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, Task, Language, Goal, EcosystemType, HelpContext, EcosystemConfig, HealthDailyLog, WorkoutPlan, Ticket } from '../types';

// Declare process for client-side environment variable access if needed by bundler
declare const process: { env: { [key: string]: string | undefined } };

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-2.5-flash-lite-preview-02-05';

export const getLocalISODate = (date: Date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

/**
 * Ensures text is clean of markdown code blocks before parsing
 */
export const cleanTextOutput = (text: string = "") => {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * Creates a helper session for contextual advice
 */
export function createHelpSession(context: HelpContext, profile: UserProfile, lang: Language) {
    const systemInstruction = `You are a helpful assistant providing contextual help for ${context.blockName}. Task: ${context.taskText}. User: ${profile.name || 'User'}. Lang: ${lang}. Be extremely concise.`;

    const chat = ai.chats.create({
        model: MODEL_NAME,
        config: { 
            systemInstruction,
            thinkingConfig: { thinkingBudget: 0 } 
        }
    });

    return {
        sendMessage: async ({ message }: { message: string }) => {
            const result = await chat.sendMessage({ message });
            return { text: result.text };
        }
    };
}

/**
 * Creates a chat session for ecosystem-specific coaching or general chat
 */
export function createChatSession(user: UserProfile, history: any[], lang: Language, tasks: Task[], type: string = 'General') {
    const systemInstruction = `You are FoGoal AI, an expert AI coach for the ${type} ecosystem. User: ${user.name || 'User'}. Lang: ${lang}. Recent tasks context: ${JSON.stringify(tasks.slice(0, 10))}.`;

    const chat = ai.chats.create({
        model: MODEL_NAME,
        config: { 
            systemInstruction,
            thinkingConfig: { thinkingBudget: 0 }
        },
        history: history
    });

    return {
        sendMessage: async ({ message }: { message: string }) => {
            const result = await chat.sendMessage({ message });
            return { text: result.text };
        }
    };
}

export async function decomposeTask(task: Task, profile: UserProfile, lang: Language): Promise<Partial<Task>[]> {
    const prompt = `Break down the task "${task.title}" into smaller, actionable subtasks. 
    The original task has a duration of ${task.durationMinutes} minutes. 
    Assign a realistic, specific duration (in minutes) to each subtask. 
    Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "[]"));
    } catch (e) {
        console.error("Task decomposition error", e);
        return [];
    }
}

export async function optimizeDailySchedule(tasks: Task[], profile: UserProfile, lang: Language): Promise<any> {
    const tasksToSchedule = tasks.map(t => ({ id: t.id, title: t.title, duration: t.durationMinutes, priority: t.priority }));
    const prompt = `Organize these tasks into a logical daily schedule.
    Tasks: ${JSON.stringify(tasksToSchedule)}.
    User Energy Profile: Peaks at ${profile.energyProfile?.energyPeaks.join(', ')}.
    Language: ${lang}.
    Return a schedule mapping IDs to times.`;

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "{}"));
    } catch (e) {
        console.error("Schedule optimization error", e);
        return {};
    }
}

export async function analyzeEcosystemSignals(profile: Partial<UserProfile>, lang: Language): Promise<EcosystemConfig[]> {
    const prompt = `Analyze this user profile to recommend life ecosystems. User: ${JSON.stringify(profile)}. Return JSON array of recommendations. Language: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "[]"));
    } catch (e) {
        console.error("Signal analysis error", e);
        return [];
    }
}

export async function generateFocuVisual(prompt: string, refImageBase64?: string): Promise<string | null> {
    const parts: any[] = [];
    
    if (refImageBase64) {
        // Extract base64 data if it contains the prefix
        const data = refImageBase64.includes('base64,') 
            ? refImageBase64.split('base64,')[1] 
            : refImageBase64;
            
        const mimeType = refImageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        
        parts.push({ 
            inlineData: { 
                mimeType, 
                data 
            } 
        });
    }
    
    parts.push({ text: prompt });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
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
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "{}"));
    } catch (e) {
        console.error("Evaluate progress error", e);
        return { productivityScore: 0, feedback: "Error evaluating progress", updatedTaskIds: [], goalUpdates: [] };
    }
}

export async function generateDrawingTutorial(prompt: string, lang: Language, style: string, difficulty: string, material: string) {
    const contentPrompt = `Create a step-by-step drawing tutorial for "${prompt}" in ${style} style using ${material}. Difficulty: ${difficulty}. Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: contentPrompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "{}"));
    } catch (e) {
        console.error("Tutorial generation error", e);
        return null;
    }
}

export async function parseTicketsFromText(text: string, lang: Language) {
    const prompt = `Extract exam tickets/questions from this text: "${text.substring(0, 5000)}". Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({ 
            model: MODEL_NAME, 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "[]"));
    } catch (e) {
        console.error("Ticket parsing error", e);
        return [];
    }
}

export async function generateTicketNote(question: string, subject: string, lang: Language) {
    const prompt = `Write a comprehensive study note for the exam question: "${question}" in the subject: "${subject}". 
    Format using Markdown. Lang: ${lang}. Focus on being educational and well-structured.`;
    
    try {
        const response = await ai.models.generateContent({ 
            model: MODEL_NAME, 
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    } catch (e) {
        console.error("Note generation error", e);
        return "Failed to generate note.";
    }
}

export async function generateGlossaryAndCards(tickets: Ticket[], subject: string, lang: Language) {
    const prompt = `Create a glossary and flashcards for studying the subject: "${subject}". 
    Questions: ${JSON.stringify(tickets.map(t => t.question))}. Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({ 
            model: MODEL_NAME, 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "{}"));
    } catch (e) {
        console.error("Glossary/Cards error", e);
        return { glossary: [], flashcards: [] };
    }
}

export async function generateQuiz(question: string, subject: string, lang: Language, count: number) {
    const prompt = `Generate ${count} multiple-choice quiz questions for the topic: "${question}". Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({ 
            model: MODEL_NAME, 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        return JSON.parse(cleanTextOutput(response.text || "[]"));
    } catch (e) {
        console.error("Quiz generation error", e);
        return [];
    }
}

export async function generateWorkout(user: UserProfile, lang: Language): Promise<WorkoutPlan> {
    const prompt = `Generate a workout plan for a user with goal: ${user.fitnessGoal}, level: ${user.fitnessLevel}, and equipment: ${user.fitnessEquipment?.join(', ')}. Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({ 
            model: MODEL_NAME, 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        const data = JSON.parse(cleanTextOutput(response.text || "{}"));
        return { ...data, date: getLocalISODate() };
    } catch (e) {
        console.error("Workout generation error", e);
        throw e;
    }
}

export async function getExerciseTechnique(exerciseName: string, equipment: string, lang: Language): Promise<string> {
    const prompt = `Explain the proper technique and safety tips for the exercise: "${exerciseName}" using ${equipment}. Format using Markdown. Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({ 
            model: MODEL_NAME, 
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || "";
    } catch (e) {
        console.error("Technique generation error", e);
        return "Info unavailable.";
    }
}

export async function analyzeHealthLog(log: { sleep: number, stress: number, energy: number }, user: UserProfile, lang: Language): Promise<HealthDailyLog> {
    const prompt = `Analyze health log: Sleep ${log.sleep}/10, Stress ${log.stress}/10, Energy ${log.energy}/10. User Profile: ${JSON.stringify(user.energyProfile)}. Lang: ${lang}`;
    
    try {
        const response = await ai.models.generateContent({ 
            model: MODEL_NAME, 
            contents: prompt,
            config: { 
                thinkingConfig: { thinkingBudget: 0 },
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
        const data = JSON.parse(cleanTextOutput(response.text || "{}"));
        return { ...data, date: getLocalISODate(), sleep: log.sleep, stress: log.stress, energy: log.energy };
    } catch (e) {
        console.error("Health analysis error", e);
        throw e;
    }
}
