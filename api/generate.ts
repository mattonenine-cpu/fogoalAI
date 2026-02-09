
import { GoogleGenAI } from "@google/genai";

declare const process: { env: { [key: string]: string | undefined } };

// Allow longer execution for streaming responses
export const config = {
  maxDuration: 60,
  supportsResponseStreaming: true,
};

export default async function handler(req: any, res: any) {
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

  const { model, contents, config: reqConfig, stream } = req.body || {};
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("CRITICAL: API_KEY is missing in environment variables.");
    return res.status(500).json({ 
        error: "Server Configuration Error: API_KEY is missing. Please add it in Vercel Settings -> Environment Variables." 
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const usedModel = model || 'gemini-3-flash-preview';

  // Streaming mode for chat responses
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const response = await ai.models.generateContentStream({
        model: usedModel,
        contents,
        config: reqConfig
      });

      for await (const chunk of response) {
        const text = chunk.text || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (streamError: any) {
      console.error("Stream error:", streamError);
      // If headers already sent, send error as SSE event, then close
      res.write(`data: ${JSON.stringify({ error: streamError.message || "Stream error" })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
    return;
  }

  // Non-streaming mode for structured JSON responses (tasks, schedules, etc.)
  try {
    const response = await ai.models.generateContent({
      model: usedModel,
      contents,
      config: reqConfig
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
