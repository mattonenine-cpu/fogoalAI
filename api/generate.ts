/**
 * Text generation API — Groq (Llama 3.1 8B Instant).
 * Accepts the same request shape as before (contents + config) for compatibility.
 */

declare const process: { env: { [key: string]: string | undefined } };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "llama-3.1-8b-instant";

function geminiContentsToGroqMessages(
  contents: any[],
  systemInstruction?: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  if (systemInstruction && systemInstruction.trim()) {
    messages.push({ role: "system", content: systemInstruction.trim() });
  }
  for (const entry of contents || []) {
    const role =
      entry.role === "model" ? "assistant" : entry.role === "user" ? "user" : "assistant";
    const text = (entry.parts || [])
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n");
    if (text) messages.push({ role, content: text });
  }
  return messages;
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    const apiKey = process.env.GROQ_API_KEY || process.env.API_KEY;
    const hasKey = !!apiKey;
    return res.status(200).json({
      status: "ok",
      hasApiKey: hasKey,
      message: hasKey
        ? "API is ready (Groq)."
        : "GROQ_API_KEY or API_KEY is missing in Vercel Environment Variables.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { model, contents, config } = req.body || {};
    const apiKey = process.env.GROQ_API_KEY || process.env.API_KEY;

    if (!apiKey) {
      console.error("CRITICAL: GROQ_API_KEY / API_KEY missing in environment.");
      return res.status(500).json({
        error:
          "Server Configuration Error: GROQ_API_KEY or API_KEY is missing. Add it in Vercel Settings -> Environment Variables.",
      });
    }

    const systemInstruction = config?.systemInstruction;
    const messages = geminiContentsToGroqMessages(contents || [], systemInstruction);
    if (messages.length === 0) {
      return res.status(400).json({
        error: "At least one message (or systemInstruction) is required.",
      });
    }

    const useJson =
      config?.responseMimeType === "application/json" ||
      (config?.responseSchema && Object.keys(config.responseSchema).length > 0);

    const usedModel =
      model && typeof model === "string" && model.includes("llama") ? model : DEFAULT_MODEL;
    const body: any = {
      model: usedModel,
      messages,
      temperature: useJson ? 0.2 : 0.7,
    };
    if (useJson) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg =
        data?.error?.message || data?.error || response.statusText || "Groq API error";
      console.error("Groq API Error:", response.status, errMsg);
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: errMsg,
        details: data?.error?.code || "",
      });
    }

    const text = data?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("Groq API Error:", error);
    return res.status(500).json({
      error: error.message || "Internal Server Error",
      details: error.toString(),
    });
  }
}
