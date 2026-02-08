
import { GoogleGenAI } from "@google/genai";

declare const process: { env: { [key: string]: string | undefined } };

export async function POST(request: Request) {
  try {
    const { model, contents, config } = await request.json();
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key not configured on server" }), { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Use the model provided by the client, or fallback
    const usedModel = model || 'gemini-3-flash-preview';

    const response = await ai.models.generateContent({
      model: usedModel,
      contents,
      config
    });

    return new Response(JSON.stringify({ text: response.text }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
  }
}
