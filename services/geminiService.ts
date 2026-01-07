import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

/**
 * Service d'analyse IA pour les campagnes Meta Ads.
 */
export const getCampaignInsights = async (campaigns: CampaignStats[], apiKey?: string): Promise<string> => {
  // On nettoie la clé pour éviter les erreurs de copier-coller
  const cleanedKey = apiKey?.trim();
  const finalKey = (cleanedKey && cleanedKey !== 'managed_by_env') ? cleanedKey : process.env.API_KEY;
  
  if (!finalKey) {
    throw new Error("Clé API IA manquante. Veuillez la configurer dans les réglages.");
  }

  const ai = new GoogleGenAI({ apiKey: finalKey });
  
  const campaignDataSummary = campaigns.map(c => 
    `- Nom: ${c.name}, Spend: ${c.spend}, CPM: ${c.cpm.toFixed(2)}, CTR: ${(c.ctr * 100).toFixed(2)}%, Conv. Démarrées: ${c.conversations_started}, CPA Started: ${c.cpa_conversation_started.toFixed(2)}, Etat: ${c.status}`
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
      model: 'gemini-3-flash-preview', // Utilisation d'un modèle ultra-rapide et compatible
      contents: prompt,
      config: {
        systemInstruction: "Tu es un Growth Coach. Traduis les stats en instincts business sans jamais citer de chiffres."
      }
    });

    return response.text || "Le diagnostic IA est momentanément indisponible.";
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    if (error.message?.includes('API key not valid')) {
      throw new Error("La clé API fournie n'est pas valide pour ce moteur IA.");
    }
    throw error;
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
    
    // Test minimaliste pour valider la clé
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Bonjour, réponds juste par "OK"',
    });
    
    return !!response.text;
  } catch (error) {
    console.error("AI connection test failed:", error);
    return false;
  }
};