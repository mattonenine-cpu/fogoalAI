
import { GoogleGenAI } from "@google/genai";

declare const process: { env: { [key: string]: string | undefined } };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, refImageBase64 } = req.body;
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("API Key missing");
      return res.status(500).json({ error: "API Key not configured on server" });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [{ text: prompt }];
    
    if (refImageBase64) {
        // Extract base64 data if it contains the prefix
        const data = refImageBase64.includes('base64,') 
            ? refImageBase64.split('base64,')[1] 
            : refImageBase64;
            
        const mimeType = refImageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
        
        parts.unshift({ 
            inlineData: { 
                mimeType, 
                data 
            } 
        });
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: { parts }
    });

    let imageUrl = null;
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                break;
            }
        }
    }

    return res.status(200).json({ imageUrl });
  } catch (error: any) {
    console.error("Image API Error:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
