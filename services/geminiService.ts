
import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

export const getCampaignInsights = async (campaigns: CampaignStats[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const campaignDataSummary = campaigns.map(c => 
    `- Nom: ${c.name}, ROAS: ${c.roas.toFixed(2)}, CTR: ${(c.ctr * 100).toFixed(2)}%, Conv. Démarrées: ${c.conversations_started}, CPA Conv: ${c.cpa_conversation_started.toFixed(2)}, Etat: ${c.status}`
  ).join('\n');

  const prompt = `
    Tu es un consultant expert en stratégie Meta Ads. Analyse ces données de campagnes mais NE CITE AUCUN CHIFFRE, AUCUN POURCENTAGE, AUCUN MONTANT dans ton rapport final.
    
    Données de contexte (pour ton analyse uniquement) :
    ${campaignDataSummary}

    Produis un audit "SENTIMENT & SANTÉ" très concis structuré comme suit :
    1. L'ÉTAT D'ESPRIT : Globalement, est-ce que le compte respire la santé ou est-ce qu'il est en apnée ?
    2. LE TOP : Ce qui fonctionne vraiment bien en termes de message ou d'approche (ex: "L'approche directe vers la messagerie cartonne").
    3. LE FLOP : Ce qui commence à fatiguer ou qui ne résonne pas (ex: "Ton offre actuelle semble ignorée").
    4. SANTÉ CRÉATIVE : Est-ce que les photos/vidéos sont "mortes" (fatigue publicitaire) ou encore fraîches ? 
    5. LE CONSEIL : Une seule action concrète à faire demain matin pour améliorer le volume de conversations.

    Ton ton doit être complice, direct et élégant. Utilise des puces (•).
    Format Markdown simple. Pas de tableaux.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "Tu es un coach de croissance. Tu simplifies la donnée complexe en conseils humains et instinctifs. Tu ne parles jamais de chiffres bruts, uniquement de tendances et de santé créative."
      }
    });

    return response.text || "L'IA n'a pas pu analyser les données pour le moment.";
  } catch (error) {
    console.error("AI Insight Error:", error);
    throw error;
  }
};
