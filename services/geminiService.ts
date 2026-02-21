
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
  'Знаки and символы': 'Signs/Symbols',
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
        video.playsInline = true;
        video.muted = true;
        const url = URL.createObjectURL(file);
        video.src = url;

        // Timeout to reject if it hangs (e.g. codec issues causing endless loading)
        const timeout = setTimeout(() => {
             URL.revokeObjectURL(url);
             reject(new Error("VIDEO_TIMEOUT")); 
        }, 30000);
        
        video.onloadedmetadata = async () => {
            clearTimeout(timeout);
            const duration = video.duration;
            if (!isFinite(duration) || duration === 0) {
                 URL.revokeObjectURL(url);
                 // Fallback for zero duration or streaming issues
                 reject(new Error("VIDEO_DURATION_INVALID"));
                 return;
            }

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const frames: { data: string, mimeType: string }[] = [];
            
            // Set canvas size based on video aspect ratio, capped at 1280px width
            const aspect = video.videoWidth / video.videoHeight;
            canvas.width = 1280;
            canvas.height = 1280 / aspect;
            
            try {
                for (let i = 0; i < frameCount; i++) {
                    const time = (duration / (frameCount + 1)) * (i + 1);
                    video.currentTime = time;
                    await new Promise((r, rej) => { 
                        video.onseeked = r; 
                        video.onerror = () => rej(new Error("VIDEO_SEEK_ERROR"));
                    });
                    
                    context?.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    frames.push({
                        data: dataUrl.split(',')[1],
                        mimeType: 'image/jpeg'
                    });
                }
                URL.revokeObjectURL(url);
                resolve(frames);
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        
        video.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(new Error("VIDEO_LOAD_ERROR"));
        };

        // Explicitly trigger load
        video.load();
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
        if (msg === "VIDEO_LOAD_ERROR") throw new Error("VIDEO_LOAD_ERROR");
        if (msg === "VIDEO_TIMEOUT") throw new Error("VIDEO_TIMEOUT");
        
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
            case "VIDEO_LOAD_ERROR": return "Ошибка чтения видео. Формат не поддерживается браузером или файл поврежден.";
            case "VIDEO_TIMEOUT": return "Тайм-аут обработки видео. Файл может быть слишком большим или кодек не поддерживается.";
            case "QUOTA_EXCEEDED": return "Превышена квота API (429). Пожалуйста, проверьте биллинг в Google Cloud Console или подождите сброса лимитов.";
            case "RATE_LIMIT_EXCEEDED": return "Слишком много запросов. Подождите немного.";
            case "CONTENT_SAFETY_VIOLATION": return "Контент заблокирован фильтрами безопасности.";
            default: return error.message;
        }
    }
    return "Произошла непредвиденная ошибка.";
}

// Improved metadata prompt matching "Gemini 3 Pro Prompt – Improved Version" with strictly enforced constraints
const metadataPrompt = `You are an elite stock photography metadata expert. Analyze the uploaded images for stock photo optimization (Shutterstock, Adobe Stock, iStock).

Generate the following metadata strictly adhering to these rules:

**ANTI-CANNIBALIZATION STRATEGY 2026:**
- **Cluster Strategy:** Identify the search cluster (e.g., "Green Organic", "Hardscape", "Education").
- **Leader vs Support:** If this is a unique image, create a "Leader" title (universal). If similar to others, create a "Support" title (specific intent).
- **Unique Anchor:** Ensure the first 5 words of the Title are unique.
- **Vary Intent:** Use different commercial intents for similar subjects (e.g., Surface vs Backdrop vs Pattern).

**EDITORIAL CONTENT RULES (IF isEditorial=true):**
- **Title:** Clear, factual, neutral tone. NO marketing phrases ("travel concept", "culture"). NO evaluative words ("famous", "beautiful"). Include Subject + Location.
- **Description:** MUST follow format: "City, Country – Month Day, Year: [Factual Description]". Max 200 chars. NO commercial phrases ("suitable for").
- **Keywords:** Prioritize location, monument name, cultural identity. No speculative historical sub-terms.

**SUBJECT-SPECIFIC RULES:**
- **If Texture/Pattern (CRITICAL):** 
  - **Title:** First 3-5 words MUST contain the primary high-volume search term + "Texture", "Background", "Surface", "Pattern", or "Wall".
  - **Description:** First sentence MUST include the primary search term. Include clear commercial usage intent (eco design, architectural background, branding).
  - **Keywords:** At least 30-40% must differ from similar images in the same cluster.
- **If Person:** Prioritize conceptual keywords (Education, Lifestyle, Business, Development).
- **If Industrial Material:** Avoid geological speculation (e.g., don't name specific rock types unless obvious).
- **If Plant/Nature:** Avoid specific species names unless 100% visually confirmed.

1. Title (60-140 characters):
   - **IMPORTANT: First 3-5 words MUST contain the main high-volume search term.**
   - Include a commercial tag if relevant (background, texture, concept).
   - No repetition of the same word twice.
   - No filler phrases ("for design", "ideal for", "inspired by").
   - No poetic adjectives.
   - Natural professional English.
   - Example: "Green Hedge Texture Background Full Frame Dense Foliage Wall".

2. Description (MAX 200 CHARACTERS):
   - **Structure:** 
     - Sentence 1: Primary term + core visual description.
     - Sentence 2: Commercial usage intent (eco design, architectural background, branding).
   - STRICTLY LIMIT to 200 characters or less.
   - **FORBIDDEN PHRASES:** "close-up of", "detailed view", "perfect for", "ideal for", "image of", "picture of".
   - No speculative or scientific claims.
   - Max 2 sentences.
   - Example: "Green hedge texture background with dense overlapping leaves in full frame. Natural foliage surface suitable for eco design, garden themes, and organic branding."

3. Keywords (Max 50):
   - First 10 must be the strongest search phrases (Buyer Intent).
   - All lowercase, comma-separated.
   - No speculative details (no plant species unless certain).
   - No rare or decorative words.
   - **Anti-Cannibalization:** At least 30-40% keywords must differ from similar images in the same cluster.
   - Focus on commercial intent and search relevance.
   - No duplicates.

4. Category: STRICTLY choose one from: ${STOCK_CATEGORIES.join(', ')}.

5. Suggestions: 30-40 additional niche keywords.

STRICTLY Return ONLY JSON matching the schema.`;

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

export const generateMediaMetadata = async (
    file: File, 
    isVideo: boolean = false, 
    batchContext?: { previousTitles: string[], previousKeywords: string[] }
): Promise<{ metadata: StockMetadata, tokensUsed: number }> => {
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
    
    let prompt = metadataPrompt;
    
    // Apply Batch Mode Instructions if context is provided
    if (batchContext) {
        const { previousTitles, previousKeywords } = batchContext;
        const hasTitles = previousTitles && previousTitles.length > 0;
        const hasKeywords = previousKeywords && previousKeywords.length > 0;

        if (hasTitles || hasKeywords) {
            prompt += `\n\n--- BATCH MODE INSTRUCTIONS ---\nProcess multiple images in the same session. Compare across images and avoid cannibalization.\n`;

            if (hasTitles) {
                // Pass last 10 titles to ensure uniqueness
                const recentTitles = previousTitles.slice(-10).join('; ');
                prompt += `\nPREVIOUS TITLES (Ensure Uniqueness - NO DUPLICATES): [${recentTitles}]`;
                prompt += `\n\n**ANTI-CANNIBALIZATION RULES (CRITICAL):**
1. **Unique Anchor:** The first 5 words of the Title MUST be unique compared to previous titles.
2. **Vary Intent:** If a similar subject exists in previous titles, change the commercial intent (e.g., "Concrete Wall" -> "Industrial Surface" -> "Minimal Backdrop").
3. **Avoid Mirror Constructions:** Do not just swap words (e.g., "Texture Background" vs "Background Texture"). Use synonyms: Surface, Backdrop, Pattern, Wall, Material.
`;
            }

            if (hasKeywords) {
                // Pass recent keywords to avoid excessive repetition
                const recentKeywords = previousKeywords.slice(-150).join(', ');
                prompt += `\nPREVIOUS KEYWORDS (Avoid Cannibalization): [${recentKeywords}]`;
                prompt += `\nINSTRUCTION: If a keyword already appears in the list above, replace it with a synonym, related term, or broader category unless it is critical for Buyer Intent. Maintain consistent style and structure.`;
                prompt += `\n4. **Keyword Diversity:** Ensure at least 40% of keywords are unique compared to previous images in this batch.`;
            }
        }
    }

    parts.push({ text: prompt });

    const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: { responseMimeType: "application/json", responseSchema: metadataSchema },
    });

    const text = response.text || '{}';
    const parsedJson = JSON.parse(text);
    return { metadata: parsedJson, tokensUsed: estimateTokens(prompt) + estimateTokens(text) };
  }, 'generateMediaMetadata');
};

export const translateText = async (textToTranslate: string, targetLanguage: string): Promise<{ translation: string, tokensUsed: number }> => {
    return withApiRetry(async () => {
        const aiClient = getAiClient();
        const prompt = `Translate to ${targetLanguage}. Return JSON with 'translation'. Text: "${textToTranslate}"`;
        const schema = { type: Type.OBJECT, properties: { translation: { type: Type.STRING } } };
        const response = await aiClient.models.generateContent({
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
    const prompt = `Generate a concise, clear, and SEO-friendly stock title (60-140 characters).
Rules:
- **First 3-5 words MUST contain the main high-volume search term.**
- **If Texture:** Prioritize "Texture", "Background", "Surface", "Pattern", or "Wall".
- **If Person:** Prioritize concept (Lifestyle, Business, etc.).
- **IF EDITORIAL:** Factual, neutral tone. NO marketing/evaluative words. Include Subject + Location.
- Include a commercial tag if relevant (non-editorial).
- No repetition of the same word twice.
- No filler phrases ("for design", "ideal for").
- Natural professional English.
- Avoid: Long prepositions, extra details ("Top View of", "during"), subjective evaluations ("Beautiful", "Amazing").
Context: Desc: ${context.description}, Keys: ${context.keywords}.
Return JSON {'title': string}.`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING } } };
    const response = await aiClient.models.generateContent({
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
    const prompt = `Generate a commercially oriented stock description (MAX 200 CHARACTERS).
Rules:
- **Structure:** 
  1. Primary term + core visual description.
  2. Commercial usage intent (eco design, architectural background, branding).
- **IF EDITORIAL:** Must begin with "City, Country – Month Day, Year:". Factual, neutral. NO commercial phrases.
- STRICTLY LIMIT to 200 characters or less.
- **FORBIDDEN:** "close-up of", "detailed view", "perfect for", "ideal for", excessive adjectives.
- No speculative or scientific claims.
- Max 2 sentences.
Context: Title: ${context.title}, Keys: ${context.keywords}.
Return JSON {'description': string}.`;
    const schema = { type: Type.OBJECT, properties: { description: { type: Type.STRING } } };
    const response = await aiClient.models.generateContent({
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
    const prompt = `Generate 50 commercially relevant lowercase stock keywords.
Rules:
- First 10 = strongest search phrases (Buyer Intent).
- **IF EDITORIAL:** Prioritize location, monument name, cultural identity.
- **If Industrial:** Avoid geological speculation.
- **If Plant:** No unconfirmed species names.
- No duplicates.
- No rare or decorative words.
- Focus on commercial intent and search relevance.
Context: Title: ${context.title}, Desc: ${context.description}.
Return JSON {'keywords': string[]}.`;
    const schema = { type: Type.OBJECT, properties: { keywords: { type: Type.ARRAY, items: { type: Type.STRING } } } };
    const response = await aiClient.models.generateContent({
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
      model: 'gemini-3-flash-preview',
      contents: { parts: [imagePart, { text: prompt }] },
      config: { responseMimeType: "application/json", responseSchema: schema },
    });
    const parsed = JSON.parse(response.text || '{}');
    return { analysis: parsed, tokensUsed: estimateTokens(prompt) + estimateTokens(response.text || '') };
}, 'analyzeImage');
