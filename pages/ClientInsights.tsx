
import React, { useState } from 'react';
import { User, CampaignStats } from '../types';
import { getCampaignInsights } from '../services/geminiService';

interface ClientInsightsProps {
  user: User;
  campaigns: CampaignStats[];
}

const ClientInsights: React.FC<ClientInsightsProps> = ({ user, campaigns }) => {
  const [insights, setInsights] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // Filtrage des campagnes du client
      const clientCampaigns = campaigns.filter(c => 
        user.name.toLowerCase().includes('bloom') ? c.name.toLowerCase().includes('bloom') : c.name.toLowerCase().includes('fitness')
      );
      
      const result = await getCampaignInsights(clientCampaigns);
      setInsights(result);
    } catch (err) {
      alert("Erreur lors de l'analyse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Conseiller Stratégique Gemini Pro</h2>
        <button 
          onClick={handleGenerate} 
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Analyse en cours...' : 'Générer Insights Stratégiques'}
        </button>
      </div>
      
      {insights && (
        <div className="bg-white p-6 rounded-xl border shadow-sm prose prose-slate max-w-none">
          {insights.split('\n').map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}
    </div>
  );
};

export default ClientInsights;
