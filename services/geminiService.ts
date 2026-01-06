
import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

export const getCampaignInsights = async (campaigns: CampaignStats[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const campaignDataSummary = campaigns.map(c => 
    `- Campaign: ${c.name}, Spend: $${c.spend}, ROAS: ${c.roas.toFixed(2)}, CTR: ${(c.ctr * 100).toFixed(2)}%, Conversions: ${c.conversions}, Source: ${c.dataSource}`
  ).join('\n');

  const prompt = `
    Analyze the following REAL Facebook Ads performance data:
    ${campaignDataSummary}

    Tasks:
    1. Validate the efficiency of each campaign based on its data source.
    2. Suggest budget reallocation from low ROAS to high ROAS campaigns.
    3. Identify potential data discrepancies if stats look unnatural.
    
    Return the response in clear Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional Meta Ads auditor. Focus on data accuracy and ROI optimization."
      }
    });

    return response.text || "Erreur de génération d'insights.";
  } catch (error) {
    console.error("AI Insight Error:", error);
    throw error;
  }
};
