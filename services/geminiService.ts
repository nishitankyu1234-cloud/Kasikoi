import { GoogleGenAI, Type } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3
].filter(Boolean);

// 最速モデルを使用
const MODEL_TEXT = 'gemini-1.5-flash-8b';

async function getAIResponse(callback: (ai: any) => Promise<any>) {
  let lastError;
  for (const key of API_KEYS) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      return await callback(ai);
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  throw lastError || new Error("All keys failed.");
}

export const createChatStream = async function* (
  history: any[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  // AI先生の性格を維持
  let systemInstruction = `予備校講師として、論理的かつ温かみのある指導を行ってください。`;

  const result = await getAIResponse(async (ai) => {
    const chat = ai.chats.create({
      model: MODEL_TEXT,
      history: history,
      config: { systemInstruction }
    });
    let messageContent: any = newMessage;
    if (imageDataUrl) {
      const [header, base64Data] = imageDataUrl.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      messageContent = {
        parts: [{ text: newMessage || "解説して。" }, { inlineData: { mimeType, data: base64Data } }]
      };
    }
    return await chat.sendMessageStream({ message: messageContent });
  });

  for await (const chunk of result) {
    yield chunk.text;
  }
};

export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 2): Promise<TestQuestion[]> => {
  // ★ポイント1：問題を「2問」に減らして処理時間を短縮
  // ★ポイント2：解説を「1行」に制限して通信量を最小化
  const prompt = `${topic}の4択問題を${count}問、JSONで作成。解説は1行で。`;

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

  if (response.text) {
    return JSON.parse(response.text.trim()) as TestQuestion[];
  }
  throw new Error("Retry");
};
