import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

/**
 * Service d'analyse IA pour les campagnes Meta Ads.
 * Utilise Gemini 3 Pro pour transformer les données brutes en conseils stratégiques.
 */
export const getCampaignInsights = async (campaigns: CampaignStats[]): Promise<string> => {
  // Initialisation à chaque appel pour garantir l'utilisation de la clé API la plus récente (process.env.API_KEY)
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Préparation du contexte de données pour le modèle
  const campaignDataSummary = campaigns.map(c => 
    `- Nom: ${c.name}, Spend: ${c.spend}, CPM: ${c.cpm.toFixed(2)}, CTR: ${(c.ctr * 100).toFixed(2)}%, Conv. Démarrées: ${c.conversations_started}, CPA Started: ${c.cpa_conversation_started.toFixed(2)}, Etat: ${c.status}`
  ).join('\n');

  const prompt = `
    DÉPÊCHE AUDIT : ANALYSE DES FLUX DE MESSAGERIE
    
    Voici les données brutes de performance (pour ton analyse interne uniquement) :
    ${campaignDataSummary}

    MISSION :
    Tu es un consultant expert en stratégie Meta Ads spécialisé dans les tunnels de messagerie. 
    Analyse ces données mais NE CITE ABSOLUMENT AUCUN CHIFFRE, AUCUN POURCENTAGE, AUCUN MONTANT dans ton rapport final.
    Parle en termes de "vitesse", de "fatigue", de "résonance" ou de "coût de l'attention".

    STRUCTURE DU RAPPORT (Markdown) :
    1. VITALITÉ DU COMPTE : Le flux global est-il sain, stagnant ou en surchauffe ?
    2. LE LEVIER GAGNANT : Quelle approche ou angle créatif semble avoir la meilleure résonance actuellement ?
    3. LE POINT DE FRICTION : Où se situe le blocage (Coût de l'attention trop haut, créas qui lassent, ou offre qui ne convertit pas) ?
    4. SANTÉ CRÉATIVE : Est-ce le moment de renouveler les visuels ou le message ? 
    5. PLAN D'ACTION IMMÉDIAT : La seule chose à changer demain matin pour booster les conversations.

    TON : Complice, direct, expert et minimaliste.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Passage au modèle Pro pour une meilleure analyse stratégique
      contents: prompt,
      config: {
        systemInstruction: "Tu es un Growth Coach pour agences média. Ta spécialité est de traduire les métriques complexes (CPM, CTR, CPA) en instincts business. Tu ne parles jamais de chiffres bruts, uniquement de tendances de santé créative et d'opportunités de croissance."
      }
    });

    // Utilisation de la propriété .text pour extraire le contenu généré
    return response.text || "Le diagnostic IA est momentanément indisponible.";
  } catch (error) {
    console.error("Gemini AI Insight Error:", error);
    throw error;
  }
};