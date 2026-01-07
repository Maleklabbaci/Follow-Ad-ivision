import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

export const getGeminiClient = (apiKey?: string) => {
  const cleanedKey = apiKey?.trim();
  const finalKey = (cleanedKey && cleanedKey !== 'managed_by_env') ? cleanedKey : process.env.API_KEY;
  if (!finalKey) throw new Error("Clé API IA manquante.");
  return new GoogleGenAI({ apiKey: finalKey });
};

// Fix: Added missing testGeminiConnection export for API key validation in AdminSettings.tsx
/**
 * Tests the Gemini API connection with a simple prompt.
 */
export const testGeminiConnection = async (apiKey?: string): Promise<boolean> => {
  try {
    const ai = getGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: 'ping' }] }],
    });
    return !!response.text;
  } catch (error) {
    console.error("Gemini connection test failed:", error);
    return false;
  }
};

/**
 * AGENT STRATÈGE : Audit structuré ultra-précis
 */
export const getCampaignInsights = async (
  campaigns: CampaignStats[], 
  apiKey?: string, 
  lang: 'fr' | 'en' | 'ar' = 'fr'
): Promise<string> => {
  const ai = getGeminiClient(apiKey);
  const dataSummary = campaigns.map(c => 
    `- [${c.name}] Dépense: ${c.spend}, Convs: ${c.conversions}, CTR: ${(c.ctr * 100).toFixed(2)}%, Statut: ${c.status}`
  ).join('\n');

  const systemInstructions = {
    fr: `Tu es un Growth Strategist de classe mondiale. Tes audits sont célèbres pour leur structure rigoureuse.
    INTERDICTION : Utiliser du jargon technique (CTR, CPC). Parle de RÉSULTATS.
    
    STRUCTURE OBLIGATOIRE :
    1. 📊 BILAN DE VITALITÉ : Une analyse globale en une phrase choc.
    2. 🚀 ACCÉLÉRATEURS : Ce qui fonctionne et doit être "scalé".
    3. ⚠️ FUITES BUDGÉTAIRES : Où l'argent est brûlé inutilement.
    4. ⚡ PROTOCOLE 24H : 3 actions immédiates avec impact financier direct.`,
    en: `World-class Growth Strategist. Professional, structured audits only. 
    STRUCTURE: 1. Vitality Check 2. Accelerators 3. Budget Leaks 4. 24h Action Plan.`,
    ar: `خبير استراتيجي عالمي. تدقيق هيكلي احترافي فقط.
    الهيكل: 1. فحص الحيوية 2. المسرعات 3. تسرب الميزانية 4. خطة عمل 24 ساعة.`
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `Données:\n${dataSummary}\n\nProduis l'audit stratégique.` }] }],
    config: { systemInstruction: systemInstructions[lang] }
  });
  return response.text || "Échec de l'analyse.";
};

/**
 * AGENT PULSEBOT : Onboarding & Vente
 */
export const getChatbotResponse = async (
  message: string, 
  history: {role: string, content: string}[], 
  apiKey?: string
): Promise<string> => {
  const ai = getGeminiClient(apiKey);
  const systemPrompt = `Tu es PulseBot, l'IA Onboarding d'AdPulse.
  TON RÔLE : Expliquer pourquoi AdPulse est 10x supérieur aux agences classiques.
  ARGUMENTS CLÉS :
  - Extraction DIRECTE via API Meta (zéro erreur humaine).
  - Audits IA instantanés (pas besoin d'attendre un rapport hebdo).
  - Transparence totale : Les clients voient ce que l'admin voit.
  - Scalabilité : On identifie les gagnants en 1 seconde.
  STYLE : Direct, enthousiaste, expert. Utilise des emojis de fusée et de graphiques. Max 3 phrases.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: { systemInstruction: systemPrompt }
  });
  return response.text || "Je suis prêt à vous guider !";
};

/**
 * AGENT CRÉATIF : Hooks & Copywriting
 */
export const getCopywritingSuggestions = async (campaigns: CampaignStats[], apiKey?: string): Promise<string> => {
  const ai = getGeminiClient(apiKey);
  const winners = campaigns.filter(c => c.conversions > 0).map(c => c.name).join(', ');
  const prompt = `Basé sur ces campagnes gagnantes : ${winners}, génère 3 concepts de publicité (Hooks) et 2 textes de vente courts. Style agressif et orienté bénéfice.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
    config: { systemInstruction: "Tu es un Copywriter Direct Response expert en psychologie de vente." }
  });
  return response.text || "Incapable de générer des hooks pour le moment.";
};

/**
 * AGENT SENTINELLE : Détection d'Anomalies
 */
export const getAnomalyDetection = async (campaigns: CampaignStats[], apiKey?: string): Promise<string> => {
  const ai = getGeminiClient(apiKey);
  const data = campaigns.map(c => `${c.name}: Spend ${c.spend}, Convs ${c.conversions}`).join('\n');
  const prompt = `Analyse les anomalies : ${data}. Cherche les dépenses sans conversion ou les chutes de perf. Liste max 3 alertes rouges.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
  });
  return response.text || "Tout semble sous contrôle.";
};