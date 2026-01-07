
import React, { useState, useMemo } from 'react';
import { User, CampaignStats, Client } from '../types';
import { getCampaignInsights } from '../services/geminiService';

interface ClientInsightsProps {
  user: User;
  campaigns: CampaignStats[];
}

const ClientInsights: React.FC<ClientInsightsProps> = ({ user, campaigns }) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Retrieve campaigns strictly linked to this client context
  const clientCampaigns = useMemo(() => {
    // If Admin is viewing a specific dashboard, the clientId is passed in some way or we use user.clientId
    // For this component, we rely on the parent providing the context-filtered list or we filter here
    // Let's assume user.clientId is set for the current context
    const savedClients = JSON.parse(localStorage.getItem('app_clients') || '[]');
    const currentClient = savedClients.find((c: any) => c.id === user.clientId);
    
    if (!currentClient) return [];
    return campaigns.filter(c => currentClient.campaignIds.includes(c.campaignId));
  }, [user.clientId, campaigns]);

  const handleGenerate = async () => {
    if (clientCampaigns.length === 0) {
      alert("No active campaigns found to analyze.");
      return;
    }

    setLoading(true);
    try {
      const result = await getCampaignInsights(clientCampaigns);
      setInsights(result);
    } catch (err) {
      console.error(err);
      alert("Error generating insights. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-full">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">AI Campaign Audit</h2>
          <p className="text-sm text-slate-500">Real-time performance optimization powered by Gemini 3.</p>
        </div>
        
        {!insights && !loading && (
          <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
             <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
               </svg>
             </div>
             <p className="text-sm font-medium text-slate-600 px-4">Ready to analyze {clientCampaigns.length} campaigns for ROI optimization.</p>
          </div>
        )}

        <button 
          onClick={handleGenerate} 
          disabled={loading || clientCampaigns.length === 0}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Thinking...
            </>
          ) : 'Generate AI Insights'}
        </button>
      </div>
      
      {insights && (
        <div className="mt-6 p-5 bg-blue-50/50 rounded-2xl border border-blue-100 text-sm text-slate-700 leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 mb-3">
             <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
             <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Strategic Report</span>
          </div>
          {insights.split('\n').map((line, i) => (
            <p key={i} className={line.startsWith('#') ? 'font-bold text-slate-900 mt-4 mb-2' : 'mb-2'}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientInsights;
