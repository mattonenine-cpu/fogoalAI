
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const { prompt, refImageBase64 } = await request.json();
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key not configured on server" }), { status: 500 });
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

    return new Response(JSON.stringify({ imageUrl }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error("Image API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
  }
}
