
import { GoogleGenAI } from "@google/genai";

declare const process: { env: { [key: string]: string | undefined } };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Vercel parses JSON body automatically if Content-Type is application/json
    const { model, contents, config } = req.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("API Key missing");
      return res.status(500).json({ error: "API Key not configured on server" });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Use the model provided by the client, or fallback
    const usedModel = model || 'gemini-3-flash-preview';

    const response = await ai.models.generateContent({
      model: usedModel,
      contents,
      config
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
