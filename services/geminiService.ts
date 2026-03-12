import { GoogleGenAI, Type } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3
].filter(Boolean);

// 最速・最小のモデルを固定
const MODEL_TEXT = 'gemini-1.5-flash-8b';

async function getAIResponse(callback: (ai: any) => Promise<any>) {
  for (const key of API_KEYS) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      return await callback(ai);
    } catch (e) { continue; }
  }
  throw new Error("Retry");
}

export const createChatStream = async function* (h: any[], m: string, i?: string, p?: UserProfile) {
  const result = await getAIResponse(async (ai) => {
    const chat = ai.chats.create({ model: MODEL_TEXT, config: { systemInstruction: "予備校講師として短く回答。" } });
    let msg: any = m;
    if (i) {
      const [head, data] = i.split(',');
      msg = { parts: [{ text: m || "解説" }, { inlineData: { mimeType: head.match(/:(.*?);/)?.[1] || 'image/jpeg', data } }] };
    }
    return await chat.sendMessageStream({ message: msg });
  });
  for await (const chunk of result) { yield chunk.text; }
};

export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 1): Promise<TestQuestion[]> => {
  // ★重要：問題を「1問」だけに絞り、解説も「10文字以内」に制限して、10秒の壁を突破する
  const prompt = `${topic}の4択問題を1問作成。JSON形式で。解説は10文字以内。`;

  const response = await getAIResponse(async (ai) => {
    return await ai.models.generateContent({
      model: MODEL_TEXT,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswerIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswerIndex", "explanation"]
          }
        }
      }
    });
  });

  if (response.text) return JSON.parse(response.text.trim()) as TestQuestion[];
  throw new Error("Err");
};
