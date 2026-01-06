import React, { useState } from 'react';
import { User, CampaignStats, IntegrationSecret } from '../types';
import { getCampaignInsights } from '../services/geminiService';

interface ClientInsightsProps {
  user: User;
  campaigns: CampaignStats[];
  secrets?: IntegrationSecret[];
}

const ClientInsights: React.FC<ClientInsightsProps> = ({ user, campaigns, secrets = [] }) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('#')) return <h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.replace(/#/g, '')}</h3>;
      if (line.startsWith('-') || line.startsWith('*')) return <li key={i} className="ml-4 list-disc text-slate-700">{line.slice(1).trim()}</li>;
      return <p key={i} className="mb-2 text-slate-600">{line}</p>;
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const clientCampaigns = campaigns.filter(c => 
        user.name.toLowerCase().includes('bloom') ? c.name.toLowerCase().includes('bloom') : c.name.toLowerCase().includes('fitness')
      );
      
      // The service now handles process.env.API_KEY internally
      const result = await getCampaignInsights(clientCampaigns);
      setInsights(result);
    } catch (err: any) {
      alert(`Error generating insights: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Strategy Advisor
          </h2>
          <p className="text-slate-500">Automated performance analysis using Gemini 3 Pro reasoning.</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-100"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing Performance...
            </>
          ) : (
            'Analyze Performance'
          )}
        </button>
      </div>

      {!insights && !loading && (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Ready to boost your results?</h3>
          <p className="text-slate-500 max-w-sm">
            Click the button above to let our AI scan your Facebook campaigns for inefficiencies and growth opportunities.
          </p>
        </div>
      )}

      {insights && (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm prose prose-slate max-w-none animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analysis Report - {new Date().toLocaleDateString()}</span>
            <button className="text-blue-600 text-sm font-medium hover:underline">Download PDF</button>
          </div>
          <div className="space-y-4">
            {renderMarkdown(insights)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientInsights;
