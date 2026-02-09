
import { GoogleGenAI } from "@google/genai";

declare const process: { env: { [key: string]: string | undefined } };

export default async function handler(req: any, res: any) {
  // Add diagnostics for GET request to check status
  if (req.method === 'GET') {
      const hasKey = !!process.env.API_KEY;
      return res.status(200).json({ 
          status: 'ok', 
          hasApiKey: hasKey, 
          message: hasKey ? 'API is ready.' : 'API_KEY is missing in Vercel Environment Variables.' 
      });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { model, contents, config } = req.body || {};
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("CRITICAL: API_KEY is missing in environment variables.");
      return res.status(500).json({ 
          error: "Server Configuration Error: API_KEY is missing. Please add it in Vercel Settings -> Environment Variables." 
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const usedModel = model || 'gemini-3-flash-preview';

    const response = await ai.models.generateContent({
      model: usedModel,
      contents,
      config
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ 
        error: error.message || "Internal Server Error",
        details: error.toString()
    });
  }
}
