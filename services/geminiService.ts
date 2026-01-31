
import { GoogleGenAI, Type } from "@google/genai";
import type { StockMetadata, ImageAnalysis } from '../types';

let ai: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY_MISSING");
    }
    if (!ai) {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
};

export const STOCK_CATEGORIES = [
  'Абстракция', 'Животные и дикая природа', 'Искусство', 'Фоны и текстуры', 
  'Красота и мода', 'Здания и достопримечательности', 'Бизнес и финансы', 
  'Знаменитости', 'Образование', 'Еда и напитки', 'Здравоохранение и медицина', 
  'Праздники', 'Промышленность', 'Интерьеры', 'Разное', 'Природа', 'Предметы', 
  'Парки и природа', 'Люди', 'Религия', 'Наука', 'Знаки и символы', 
  'Спорт и отдых', 'Технологии', 'Транспорт', 'Винтаж'
];

export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'Абстракция': 'Abstract',
  'Животные и дикая природа': 'Animals/Wildlife',
  'Искусство': 'The Arts',
  'Фоны и текстуры': 'Backgrounds/Textures',
  'Красота и мода': 'Beauty/Fashion',
  'Здания и достопримечательности': 'Buildings/Landmarks',
  'Бизнес и финансы': 'Business/Finance',
  'Знаменитости': 'Celebrities',
  'Образование': 'Education',
  'Еда и напитки': 'Food and Drink',
  'Здравоохранение и медицина': 'Healthcare/Medical',
  'Праздники': 'Holidays',
  'Промышленность': 'Industrial',
  'Интерьеры': 'Interiors',
  'Разное': 'Miscellaneous',
  'Природа': 'Nature',
  'Предметы': 'Objects',
  'Парки и природа': 'Parks/Outdoor',
  'Люди': 'People',
  'Религия': 'Religion',
  'Наука': 'Science',
  'Знаки и символы': 'Signs/Symbols',
  'Спорт и отдых': 'Sports/Recreation',
  'Технологии': 'Technology',
  'Транспорт': 'Transportation',
  'Винтаж': 'Vintage'
};

/**
 * Converts a File to a Gemini generative part.
 * Normalizes via Canvas to JPEG to support wide range of formats and optimize size.
 */
const fileToGenerativePart = async (file: File) => {
  const supportedDirectly = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  
  return new Promise<{ inlineData: { data: string, mimeType: string } }>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_DIM = 2048;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
          reject(new Error("CANVAS_CONTEXT_FAIL"));
          return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64Data = dataUrl.split(',')[1];
      
      URL.revokeObjectURL(url);
      resolve({
        inlineData: { data: base64Data, mimeType: 'image/jpeg' },
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (supportedDirectly.includes(file.type)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({ inlineData: { data: base64, mimeType: file.type } });
        };
        reader.onerror = () => reject(new Error("FILE_READ_ERROR"));
        reader.readAsDataURL(file);
      } else {
        const isRaw = file.name.toLowerCase().match(/\.(cr2|cr3|nef|arw|dng|orf|rw2|raf)$/);
        reject(new Error(isRaw ? "RAW_NOT_SUPPORTED" : "FORMAT_NOT_SUPPORTED_BY_BROWSER"));
      }
    };
    
    img.src = url;
  });
};

export const extractVideoFrames = async (file: File, frameCount: number = 8): Promise<{ data: string, mimeType: string }[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const url = URL.createObjectURL(file);
        video.src = url;
        video.muted = true;
        
        video.onloadedmetadata = async () => {
            const duration = video.duration;
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const frames: { data: string, mimeType: string }[] = [];
            
            canvas.width = 1280;
            canvas.height = (video.videoHeight / video.videoWidth) * 1280;
            
            for (let i = 0; i < frameCount; i++) {
                const time = (duration / (frameCount + 1)) * (i + 1);
                video.currentTime = time;
                await new Promise((r) => { video.onseeked = r; });
                
                context?.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                frames.push({
                    data: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg'
                });
            }
            
            URL.revokeObjectURL(url);
            resolve(frames);
        };
        
        video.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("VIDEO_LOAD_ERROR"));
        };
    });
};

const estimateTokens = (text: string): number => Math.ceil((text || '').length / 4);

const handleGeminiError = (error: any, functionName: string): never => {
    console.error(`Error in ${functionName}:`, error);
    
    // Check for 429 Resource Exhausted / Quota Limit
    let isQuotaError = false;
    
    if (error.status === 429 || error.code === 429) {
        isQuotaError = true;
    } else if (error.error && (error.error.code === 429 || error.error.status === "RESOURCE_EXHAUSTED")) {
        isQuotaError = true;
    } else if (typeof error === 'string') {
        if (error.includes('429') || error.includes('RESOURCE_EXHAUSTED')) isQuotaError = true;
        try {
            const parsed = JSON.parse(error);
            if (parsed.error && parsed.error.code === 429) isQuotaError = true;
        } catch(e) {}
    } else if (error.message) {
        const lowMsg = error.message.toLowerCase();
        if (lowMsg.includes('429') || lowMsg.includes('quota') || lowMsg.includes('exhausted')) isQuotaError = true;
    }

    if (isQuotaError) {
        throw new Error("QUOTA_EXCEEDED");
    }

    if (error instanceof Error) {
        const msg = error.message;
        if (msg === "RAW_NOT_SUPPORTED") throw new Error("RAW_NOT_SUPPORTED");
        if (msg === "FORMAT_NOT_SUPPORTED_BY_BROWSER") throw new Error("FORMAT_NOT_SUPPORTED");
        
        const lowMsg = msg.toLowerCase();
        if (lowMsg.includes('safety')) throw new Error("CONTENT_SAFETY_VIOLATION");
        throw error; 
    }
    
    throw new Error("UNKNOWN_ERROR");
};

const withApiRetry = async <T>(apiCall: () => Promise<T>, functionName: string): Promise<T> => {
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await apiCall();
        } catch (rawError) {
            let standardized: Error;
            try { handleGeminiError(rawError, functionName); standardized = new Error("UNKNOWN"); } catch (e) { standardized = e as Error; }
            
            if (standardized.message === "QUOTA_EXCEEDED") {
                throw standardized;
            }

            if ((standardized.message === "RATE_LIMIT_EXCEEDED" || standardized.message === "NETWORK_ERROR") && attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1500 * attempt));
            } else { throw standardized; }
        }
    }
    throw new Error("API_RETRY_FAILED");
};

export const getFriendlyErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        switch (error.message) {
            case "RAW_NOT_SUPPORTED": return "RAW форматы не поддерживаются браузером. Используйте JPEG/PNG.";
            case "FORMAT_NOT_SUPPORTED": return "Файл не поддерживается браузером.";
            case "QUOTA_EXCEEDED": return "Превышена квота API (429). Пожалуйста, проверьте биллинг в Google Cloud Console или подождите сброса лимитов.";
            case "RATE_LIMIT_EXCEEDED": return "Слишком много запросов. Подождите немного.";
            case "CONTENT_SAFETY_VIOLATION": return "Контент заблокирован фильтрами безопасности.";
            default: return error.message;
        }
    }
    return "Произошла непредвиденная ошибка.";
}

// Improved metadata prompt using NLP techniques for semantic depth and diverse categorization
const metadataPrompt = `You are a world-class expert in stock media metadata and NLP semantic analysis. 
Analyze the visual and conceptual context deeply.

Generate:
- Title (max 200 chars): High-impact, SEO-optimized, concise.
- Description (max 200 chars): Factual, objective, search-engine friendly.
- Keywords: Exactly 50 lowercase terms. Use semantic NLP clustering to ensure diversity across:
    1. Objects & Subjects: Physical entities present.
    2. Actions & Verbs: Dynamics and behaviors.
    3. Setting & Environment: Time of day, location, weather.
    4. Concepts & Emotions: Abstract themes (solitude, success, joy, connection).
    5. Style & Lighting: Technical metadata (cinematic, minimalist, macro, backlight).
- Category: STRICTLY choose one from: ${STOCK_CATEGORIES.join(', ')}.
- Suggestions: 30-40 additional niche keywords for broad search coverage.

STRICTLY Return ONLY JSON. OBSERVE 200 CHARACTER LIMITS. EXACTLY 50 Keywords. NO synonyms repetition.`;

const metadataSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    category: { type: Type.STRING },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    isEditorial: { type: Type.BOOLEAN },
    editorialCity: { type: Type.STRING },
    editorialRegion: { type: Type.STRING },
    editorialDate: { type: Type.STRING },
    editorialFact: { type: Type.STRING }
  },
  required: ["title", "description", "keywords", "category", "isEditorial"]
};

export const generateMediaMetadata = async (file: File, isVideo: boolean = false): Promise<{ metadata: StockMetadata, tokensUsed: number }> => {
  return withApiRetry(async () => {
    const aiClient = getAiClient();
    let parts: any[] = [];
    if (isVideo) {
        const frames = await extractVideoFrames(file);
        parts = frames.map(f => ({ inlineData: f }));
    } else {
        const imagePart = await fileToGenerativePart(file);
        parts = [imagePart];
    }
    parts.push({ text: metadataPrompt });

    const response = await aiClient.models.generateContent({
      // Fixed: Selection of 'gemini-3-flash-preview' for basic text tasks (summarization, analysis).
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: { responseMimeType: "application/json", responseSchema: metadataSchema },
    });

    const text = response.text || '{}';
    const parsedJson = JSON.parse(text);
    return { metadata: parsedJson, tokensUsed: estimateTokens(metadataPrompt) + estimateTokens(text) };
  }, 'generateMediaMetadata');
};

export const translateText = async (textToTranslate: string, targetLanguage: string): Promise<{ translation: string, tokensUsed: number }> => {
    return withApiRetry(async () => {
        const aiClient = getAiClient();
        const prompt = `Translate to ${targetLanguage}. Return JSON with 'translation'. Text: "${textToTranslate}"`;
        const schema = { type: Type.OBJECT, properties: { translation: { type: Type.STRING } } };
        const response = await aiClient.models.generateContent({
            // Fixed: Selection of 'gemini-3-flash-preview' for translation tasks.
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: schema },
        });
        const parsed = JSON.parse(response.text || '{}');
        return { translation: parsed.translation, tokensUsed: estimateTokens(prompt) + estimateTokens(response.text || '') };
    }, 'translateText');
};

export const generateTitle = async (imageFile: File, context: any) => withApiRetry(async () => {
    const aiClient = getAiClient();
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `NLP-optimized stock title (max 200 chars). Context: Desc: ${context.description}, Keys: ${context.keywords}. Return JSON {'title': string}.`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING } } };
    const response = await aiClient.models.generateContent({
        // Fixed: Selection of 'gemini-3-flash-preview' for title generation.
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const parsed = JSON.parse(response.text || '{}');
    return { title: parsed.title, tokensUsed: estimateTokens(prompt) + estimateTokens(response.text || '') };
}, 'generateTitle');

export const generateDescription = async (imageFile: File, context: any) => withApiRetry(async () => {
    const aiClient = getAiClient();
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `NLP-optimized stock description (max 200 chars). Context: Title: ${context.title}, Keys: ${context.keywords}. Return JSON {'description': string}.`;
    const schema = { type: Type.OBJECT, properties: { description: { type: Type.STRING } } };
    const response = await aiClient.models.generateContent({
        // Fixed: Selection of 'gemini-3-flash-preview' for description generation.
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const parsed = JSON.parse(response.text || '{}');
    return { description: parsed.description, tokensUsed: estimateTokens(prompt) + estimateTokens(response.text || '') };
}, 'generateDescription');

export const generateAltText = async (imageFile: File, context: any) => withApiRetry(async () => {
    const aiClient = getAiClient();
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `Semantic Alt Text (max 125 chars) for accessibility. Return JSON {'altText': string}.`;
    const schema = { type: Type.OBJECT, properties: { altText: { type: Type.STRING } } };
    const response = await aiClient.models.generateContent({
        // Fixed: Selection of 'gemini-3-flash-preview' for alt text generation.
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const parsed = JSON.parse(response.text || '{}');
    return { altText: parsed.altText, tokensUsed: estimateTokens(prompt) + estimateTokens(response.text || '') };
}, 'generateAltText');

export const generateKeywords = async (imageFile: File, context: any) => withApiRetry(async () => {
    const aiClient = getAiClient();
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `Generate exactly 50 relevant lowercase stock keywords using semantic analysis. Categorize by objects, actions, concepts, and mood. No synonyms. Context: Title: ${context.title}, Desc: ${context.description}. Return JSON {'keywords': string[]}.`;
    const schema = { type: Type.OBJECT, properties: { keywords: { type: Type.ARRAY, items: { type: Type.STRING } } } };
    const response = await aiClient.models.generateContent({
        // Fixed: Selection of 'gemini-3-flash-preview' for keyword generation.
        model: 'gemini-3-flash-preview',
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const parsed = JSON.parse(response.text || '{}');
    return { keywords: parsed.keywords, tokensUsed: estimateTokens(prompt) + estimateTokens(response.text || '') };
}, 'generateKeywords');

export const analyzeImageForKeywords = async (imageFile: File) => withApiRetry(async () => {
    const aiClient = getAiClient();
    const imagePart = await fileToGenerativePart(imageFile);
    const prompt = `Perform deep semantic NLP and visual analysis. Extract hierarchical concepts, emotive qualities, and technical identifiers. Return JSON.`;
    const schema = {
      type: Type.OBJECT,
      properties: {
        colors: { type: Type.ARRAY, items: { type: Type.STRING } },
        objects: { type: Type.ARRAY, items: { type: Type.STRING } },
        concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
        style: { type: Type.ARRAY, items: { type: Type.STRING } },
        lighting: { type: Type.ARRAY, items: { type: Type.STRING } }
      }
    };
    const response = await aiClient.models.generateContent({
      // Fixed: Selection of 'gemini-3-flash-preview' for image content analysis.
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const parsed = JSON.parse(response.text || '{}');
    return { analysis: parsed, tokensUsed: estimateTokens(prompt) + estimateTokens(response.text || '') };
}, 'analyzeImage');