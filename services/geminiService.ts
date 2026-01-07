import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

/**
 * Service d'analyse IA pour les campagnes Meta Ads.
 */
export const getCampaignInsights = async (campaigns: CampaignStats[], apiKey?: string): Promise<string> => {
  const cleanedKey = apiKey?.trim();
  const finalKey = (cleanedKey && cleanedKey !== 'managed_by_env') ? cleanedKey : process.env.API_KEY;
  
  if (!finalKey) {
    throw new Error("Clé API IA manquante. Veuillez la configurer dans les réglages.");
  }

  const ai = new GoogleGenAI({ apiKey: finalKey });
  
  if (!campaigns || campaigns.length === 0) {
    throw new Error("Aucune donnée de campagne à analyser.");
  }

  const campaignDataSummary = campaigns.map(c => 
    `- Nom: ${c.name || 'Inconnu'}, Spend: ${Number(c.spend || 0).toFixed(2)}, CPM: ${Number(c.cpm || 0).toFixed(2)}, CTR: ${(Number(c.ctr || 0) * 100).toFixed(2)}%, Conv. Démarrées: ${c.conversations_started || 0}, CPA: ${Number(c.cpa_conversation_started || 0).toFixed(2)}, Etat: ${c.status || 'N/A'}`
  ).join('\n');

  const prompt = `
    DÉPÊCHE AUDIT : ANALYSE DES FLUX DE MESSAGERIE
    
    Voici les données brutes de performance :
    ${campaignDataSummary}

    MISSION :
    Tu es un consultant expert en stratégie Meta Ads. Analyse ces données. 
    NE CITE AUCUN CHIFFRE, AUCUN POURCENTAGE dans ton rapport. 
    Parle en termes de vitalité, de résonance créative et de points de friction.

    STRUCTURE :
    1. VITALITÉ : Flux global.
    2. LEVIER : Ce qui fonctionne.
    3. FRICTION : Le blocage actuel.
    4. ACTION : La chose à changer demain.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "Tu es un Growth Coach senior. Ton rôle est de transformer des chiffres froids en instincts business et actions concrètes sans jamais mentionner les valeurs numériques."
      }
    });

    if (!response.text) {
      throw new Error("L'IA n'a pas retourné de texte. Vérifiez votre crédit ou les limites du modèle.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini AI error details:", error);
    
    // Extraction des erreurs communes
    const msg = error.message || "";
    if (msg.includes('403') || msg.includes('API key not valid')) {
      throw new Error("Clé API invalide ou accès refusé. Vérifiez vos permissions Google Cloud.");
    }
    if (msg.includes('429')) {
      throw new Error("Quota atteint (429). Réessayez dans une minute.");
    }
    if (msg.includes('500')) {
      throw new Error("Le serveur IA rencontre une erreur temporaire (500).");
    }
    
    throw new Error(error.message || "Erreur de connexion aux services d'intelligence.");
  }
};

/**
 * Teste la connectivité avec l'API IA.
 */
export const testGeminiConnection = async (apiKey?: string): Promise<boolean> => {
  const cleanedKey = apiKey?.trim();
  if (!cleanedKey && !process.env.API_KEY) return false;

  try {
    const finalKey = (cleanedKey && cleanedKey !== 'managed_by_env') ? cleanedKey : process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey: finalKey! });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: 'Ping' }] }],
    });
    
    return !!response.text;
  } catch (error) {
    console.error("AI connection test failed:", error);
    return false;
  }
};