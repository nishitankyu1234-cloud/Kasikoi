import { GoogleGenAI, Type } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3
].filter(Boolean);

// 速さと賢さのバランスが良い8bモデル
const MODEL_TEXT = 'gemini-1.5-flash-8b';

async function getAIResponse(callback: (ai: any) => Promise<any>) {
  let lastError;
  for (const key of API_KEYS) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      return await callback(ai);
    } catch (error) {
      console.warn("APIキー制限またはエラーのため、次のキーを試します。");
      lastError = error;
      continue;
    }
  }
  throw lastError || new Error("すべてのAPIキーで失敗しました。");
}

export const createChatStream = async function* (
  history: any[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  // ★ここにあなたの「指導方針」を完全に復活させました！
  let systemInstruction = `
あなたは日本トップクラスの予備校講師です。以下の指針に従って生徒を指導してください。

【指導方針】
1. **最高品質の解説**: 難解な概念も、本質を突いた平易な言葉で説明し、論理的かつ構造的に回答してください。
2. **誤字脱字の徹底排除**: 生成されたテキストは送信前に必ず校正してください。
3. **誘導的指導**: すぐに答えを教えるのではなく、生徒自身が気付けるように誘導してください。
4. **共通テスト・難関大対応**: 思考力・判断力・表現力を意識した「使える知識」を授けてください。

【トーン＆マナー】
* 自信に満ち、頼りがいがあるが、威圧的ではない温かみのある「です・ます」調。
* 重要なポイントは箇条書きや太字を適切に使用して視認性を高める。
`;

  if (userProfile) {
    if (userProfile.targetUniversity) {
      systemInstruction += `\n\n【目標：${userProfile.targetUniversity}】\nこの大学の入試傾向を熟知したプロとして振る舞ってください。`;
    }
  }

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
        parts: [{ text: newMessage || "解説してください。" }, { inlineData: { mimeType, data: base64Data } }]
      };
    }
    return await chat.sendMessageStream({ message: messageContent });
  });

  for await (const chunk of result) {
    yield chunk.text;
  }
};

export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3): Promise<TestQuestion[]> => {
  // テスト作成時も「予備校講師」としてのプライドを持って作らせます
  let prompt = `予備校講師として「${topic}」に関する質の高い4択問題を${count}問作成してください。
  【重要ルール】
  1. 共通テスト〜難関大レベルの良問にすること。
  2. JSON形式のみで回答し、解説は要点を突いて論理的に記述すること。
  3. 数式は可能な限りプレーンテキストで表現し、複雑なLaTeXは避けること。`;

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
  throw new Error("Failed to generate test data");
};
