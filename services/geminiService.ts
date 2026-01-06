
import { GoogleGenAI } from "@google/genai";
import { CampaignStats } from "../types";

export const getCampaignInsights = async (campaigns: CampaignStats[], customApiKey?: string): Promise<string> => {
  // Priority: Custom API key from settings > process.env.API_KEY
  const apiKey = customApiKey || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const campaignDataSummary = campaigns.map(c => 
    `- Campaign: ${c.name}, Spend: $${c.spend}, ROAS: ${c.roas.toFixed(2)}, CTR: ${(c.ctr * 100).toFixed(2)}%, Conversions: ${c.conversions}`
  ).join('\n');

  const prompt = `
    Analyze the following Facebook Ads campaign performance data for the last 30 days:
    ${campaignDataSummary}

    Please provide:
    1. A summary of overall performance.
    2. Detection of any anomalies (e.g., rising CPC, falling CTR).
    3. Actionable recommendations for budget, targeting, and creatives.
    
    Return the response in clear Markdown. Keep it professional and concise for a marketing client.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert digital marketing analyst with 15 years of experience in Facebook Ads performance optimization."
      }
    });

    return response.text || "No insights could be generated at this time.";
  } catch (error) {
    console.error("AI Insight Error:", error);
    throw error;
  }
};
