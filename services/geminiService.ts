
import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

export const getCampaignInsights = async (campaigns: CampaignStats[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const campaignDataSummary = campaigns.map(c => 
    `- Campaign: ${c.name}, Spend: $${c.spend}, ROAS: ${c.roas.toFixed(2)}, CTR: ${(c.ctr * 100).toFixed(2)}%, Conversions: ${c.conversions}, Source: ${c.dataSource}`
  ).join('\n');

  const prompt = `
    Analyze the following REAL Facebook Ads performance data and provide a strategic audit:
    ${campaignDataSummary}

    Your analysis should include:
    1. Performance Winners: Which campaigns are over-performing?
    2. Budget Leaks: Where is money being wasted (low ROAS, high CPC)?
    3. Actionable Recommendations: Precise instructions on what to change.
    
    Format the response in professional Markdown with sections.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a senior Meta Ads performance architect and data auditor. Your mission is to maximize client ROI and detect data integrity issues. Be concise, expert, and direct."
      }
    });

    return response.text || "Erreur de génération d'insights.";
  } catch (error) {
    console.error("AI Insight Error:", error);
    throw error;
  }
};
