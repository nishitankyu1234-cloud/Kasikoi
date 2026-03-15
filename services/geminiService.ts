import { GoogleGenAI, Type } from "@google/genai";
import { TestQuestion, UserProfile } from "../types";

// 3つのキーを配列で用意
const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3
].filter(Boolean);

const MODEL_TEXT = 'model: "gemini-1.5-pro-latest"';

/**
 * 複数のAPIキーを順番に試して、AIの返答をもらうための共通関数
 */
async function getAIResponse(callback: (ai: any) => Promise<any>) {
  let lastError;
  for (const key of API_KEYS) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      return await callback(ai);
    } catch (error) {
      console.warn("APIキー制限のため、次のキーを試します。");
      lastError = error;
      continue;
    }
  }
  throw lastError || new Error("すべてのAPIキーが制限に達しました。少し待ってから試してください。");
}

/**
 * AI先生のチャット（ストリーミング形式）
 */
export const createChatStream = async function* (
  history: { role: 'user' | 'model'; parts: { text?: string; inlineData?: any }[] }[],
  newMessage: string,
  imageDataUrl?: string,
  userProfile?: UserProfile
) {
  let systemInstruction = `
あなたは日本トップクラスの予備校講師です。以下の指針に従って生徒を指導してください。

【指導方針】
1. **最高品質の解説**: 難解な概念も、本質を突いた平易な言葉で説明し、論理的かつ構造的に回答してください。
2. **誤字脱字の徹底排除**: 生成されたテキストは送信前に必ず校正し、誤字脱字や不自然な日本語がないようにしてください。
3. **誘導的指導**: すぐに答えを教えるのではなく、ソクラテス式問答法を用いて生徒自身が気付けるように誘導してください。
4. **共通テスト・難関大対応**: 共通テストの傾向（思考力・判断力・表現力）を意識し、単なる暗記ではない「使える知識」を授けてください。

【トーン＆マナー】
* 自信に満ち、頼りがいがあるが、威圧的ではない。
* 生徒のモチベーションを高める、温かみのある「です・ます」調。
* 重要なポイントは箇条書きや太字を適切に使用して視認性を高める。
`;

  if (userProfile) {
    if (userProfile.targetUniversity) {
      systemInstruction += `\n\n【生徒の目標】\n第一志望：${userProfile.targetUniversity}\n${userProfile.targetUniversity}の入試傾向を熟知したプロフェッショナルとして振る舞ってください。`;
    }
    if (userProfile.major) {
      const majorText = userProfile.major === 'arts' ? '文系' : userProfile.major === 'science' ? '理系' : '';
      if (majorText) {
        systemInstruction += `\n\n【生徒の属性】\nこの生徒は「${majorText}」です。解説のアプローチを最適化してください。`;
      }
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
        parts: [
          { text: newMessage || "この画像について、入試問題としての視点から詳しく解説してください。" },
          { inlineData: { mimeType, data: base64Data } }
        ]
      };
    }
    return await chat.sendMessageStream({ message: messageContent });
  });

  for await (const chunk of result) {
    yield chunk.text;
  }
};

/**
 * 小テストの自動生成
 */
export const generateTestQuestions = async (topic: string, userProfile?: UserProfile, count: number = 3): Promise<TestQuestion[]> => {
  let prompt = `「${topic}」に関する共通テスト〜難関大レベルの4択問題を作成してください。（全${count}問）`;
  
  if (userProfile) {
    if (userProfile.targetUniversity) {
      prompt += `\n\n【ターゲット：${userProfile.targetUniversity}】\n${userProfile.targetUniversity}の入試傾向を反映させてください。`;
    }
  }
  
  prompt += `\n\n【必須要件】\n・誤字脱字がないか厳重にチェックすること。\n・解説は論理的に説明すること。`;

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
    return JSON.parse(response.text) as TestQuestion[];
  }
  throw new Error("Failed to generate test data");
};
