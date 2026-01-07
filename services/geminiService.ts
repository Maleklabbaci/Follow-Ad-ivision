
import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

/**
 * Service d'intelligence artificielle multi-modulaire pour ADiVISION.
 * Centralise toutes les interactions avec Gemini 3.
 */
// FIX: The SDK guidelines mandate obtaining the API key exclusively from process.env.API_KEY.
export const getGeminiClient = () => {
  if (!process.env.API_KEY) throw new Error("Clé API IA manquante.");
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Audit stratégique : Analyse profonde des performances actuelles.
 */
export const getCampaignInsights = async (
  campaigns: CampaignStats[], 
  lang: 'fr' | 'en' | 'ar' = 'fr'
): Promise<string> => {
  const ai = getGeminiClient();
  const dataSummary = campaigns.map(c => 
    `- Campagne: ${c.name}, Dépense: ${c.spend}, Conversions: ${c.conversions}, Statut: ${c.status}, CTR: ${(c.ctr * 100).toFixed(2)}%`
  ).join('\n');

  const systemInstructions = {
    fr: `Tu es un Expert en Croissance (Growth Strategist) de classe mondiale. Fournis un audit ultra-structuré : 1. Bilan 2. Accélérateurs 3. Fuites 4. Action 24h.`,
    en: `You are a world-class Growth Strategist. Provide a highly structured audit: 1. Health 2. Accelerators 3. Leaks 4. 24h Action.`,
    ar: `أنت خبير استراتيجي عالمي في النمو. قدم تدقيقًا عالي التنظيم: 1. الصحة 2. المسرعات 3. التسريبات 4. خطة عمل.`
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `Données: ${dataSummary}\nEffectue un audit global.` }] }],
    config: { systemInstruction: systemInstructions[lang] }
  });
  return response.text || "Erreur de génération.";
};

/**
 * Chatbot d'onboarding, de vente et support.
 * Explique la valeur ajoutée d'ADiVISION vs la concurrence.
 */
export const getChatbotResponse = async (
  message: string, 
  history: {role: string, content: string}[]
): Promise<string> => {
  const ai = getGeminiClient();
  const systemPrompt = `Tu es VisionBot, l'assistant intelligent d'ADiVISION AI. 
  Ta mission : Expliquer comment ADiVISION aide les agences à scaler leurs Meta Ads.
  
  POURQUOI NOUS (LA VALEUR) :
  1. Transparence : Extraction directe API Meta, zéro saisie manuelle.
  2. Vitesse : Audits IA instantanés là où une agence met 4h.
  3. Précision : CPA calculé au centime près, pas d'estimations vagues.
  4. Accessibilité : Dashboard client ultra-pro inclus.
  
  NOTRE DIFFÉRENCE : On n'est pas juste un dashboard, on est un "Growth Engine" qui réfléchit.
  
  TON : Dynamique, professionnel, un peu tech-savvy, utilise des emojis. Max 2-3 phrases par réponse.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: { systemInstruction: systemPrompt }
  });
  return response.text || "Je suis à votre service pour booster vos campagnes !";
};

/**
 * IA de Prédiction Budgétaire : Analyse les tendances pour prévoir le futur.
 */
export const getBudgetForecast = async (campaigns: CampaignStats[]): Promise<string> => {
  const ai = getGeminiClient();
  const data = campaigns.map(c => `${c.name}: Spend ${c.spend}, Conv ${c.conversions}`).join('\n');
  const prompt = `Données :\n${data}\nPrédis les performances du mois prochain (Spend +20%). Donne 3 KPIs et 1 conseil phare.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
  });
  return response.text || "Prédiction indisponible.";
};

/**
 * IA Copywriting Assistant : Génère des accroches publicitaires basées sur les performances.
 */
export const getCopywritingSuggestions = async (campaigns: CampaignStats[]): Promise<string> => {
  const ai = getGeminiClient();
  const bestCampaigns = campaigns.filter(c => c.conversions > 0).sort((a, b) => (b.conversions / b.spend) - (a.conversions / a.spend));
  const context = bestCampaigns.map(c => `- ${c.name}`).join('\n');
  
  const prompt = `Basé sur ces noms de campagnes performantes :\n${context}\nGénère 3 accroches publicitaires "Hook" irrésistibles et 2 descriptions pour Meta Ads. Style: Direct, bénéfice client, urgent.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
  });
  return response.text || "Suggestions indisponibles.";
};

/**
 * Détecteur d'Anomalies : Identifie les comportements suspects de l'algorithme Meta.
 */
export const getAnomalyDetection = async (campaigns: CampaignStats[]): Promise<string> => {
  const ai = getGeminiClient();
  const data = campaigns.map(c => `${c.name}: Spend ${c.spend}, CTR ${(c.ctr*100).toFixed(2)}%, Conv ${c.conversions}`).join('\n');
  
  const prompt = `Analyse ces données pour détecter des anomalies :\n${data}\nCherche : Spend élevé sans conversions, CTR anormalement bas, ou campagnes "mortes" qui consomment du budget. Liste max 3 alertes critiques.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: prompt }] }],
  });
  return response.text || "Aucune anomalie détectée.";
};

export const testGeminiConnection = async (): Promise<boolean> => {
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: 'Ping' }] }],
    });
    return !!response.text;
  } catch { return false; }
};
