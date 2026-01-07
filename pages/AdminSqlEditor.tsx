
import React, { useState } from 'react';
import { Client, CampaignStats, IntegrationSecret, User, AuditLog, AiReport, CreativePerformance, MarketBenchmark, PredictiveForecast } from '../types';

interface AdminSqlEditorProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
  users: User[];
  auditLogs: AuditLog[];
  aiReports: AiReport[];
  creativePerformance?: CreativePerformance[];
  marketBenchmarks?: MarketBenchmark[];
  predictiveForecasts?: PredictiveForecast[];
}

const AdminSqlEditor: React.FC<AdminSqlEditorProps> = (props) => {
  const [query, setQuery] = useState('SELECT * FROM creative_performance ORDER BY roas DESC');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tables: Record<string, any[]> = {
    clients: props.clients,
    campaigns: props.campaigns,
    users: props.users.map(u => ({ ...u, password: '••••••••', password_hash: '••••••••' })),
    audit_logs: props.auditLogs,
    ai_reports: props.aiReports,
    historical_trends: [
      { date: '2024-10-01', spend: 1200, roas: 3.2, conversions: 45 },
      { date: '2024-10-02', spend: 1500, roas: 4.1, conversions: 62 },
      { date: '2024-10-03', spend: 1100, roas: 2.9, conversions: 38 }
    ],
    creative_performance: props.creativePerformance || [
        { id: 'crea_1', name: 'Video_Product_Launch', type: 'VIDEO', spend: 4500, roas: 4.2, hook_rate: 0.35, hold_rate: 0.12 },
        { id: 'crea_2', name: 'Image_Static_Discount', type: 'IMAGE', spend: 1200, roas: 2.8, hook_rate: 0.15, hold_rate: 0.05 }
    ],
    market_benchmarks: props.marketBenchmarks || [
        { id: 'm_1', industry: 'E-commerce', avg_cpc: 0.85, avg_cpm: 12.50, region: 'FR' },
        { id: 'm_2', industry: 'SaaS B2B', avg_cpc: 4.20, avg_cpm: 45.00, region: 'US' }
    ],
    predictive_forecasts: props.predictiveForecasts || [
        { id: 'f_1', clientId: 'c_1', predicted_spend: 15000, predicted_conversions: 450, confidence_score: 0.88, month: '2024-10' }
    ],
    secrets: props.secrets.map(s => ({ ...s, value: '********' }))
  };

  const runQuery = () => {
    setIsLoading(true);
    setError(null);
    setResults([]);
    
    setTimeout(() => {
      try {
        const q = query.toLowerCase().trim();
        if (!q.startsWith('select')) throw new Error('Seules les requêtes SELECT sont autorisées.');

        let tableName = Object.keys(tables).find(t => q.includes(`from ${t}`)) || '';
        if (!tableName) throw new Error('Table non trouvée.');

        let data = [...tables[tableName]];

        if (q.includes('where')) {
            if (q.includes("type = 'video'")) data = data.filter(d => d.type === 'VIDEO');
            if (q.includes("industry = 'e-commerce'")) data = data.filter(d => d.industry === 'E-commerce');
        }

        if (q.includes('order by')) {
            if (q.includes('roas desc')) data.sort((a,b) => b.roas - a.roas);
            if (q.includes('spend desc')) data.sort((a,b) => b.spend - a.spend);
            if (q.includes('timestamp desc')) data.sort((a,b) => b.timestamp?.localeCompare(a.timestamp));
        }

        if (data.length > 0) {
          setColumns(Object.keys(data[0]));
          setResults(data);
        } else {
          setColumns([]);
          setResults([]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }, 400);
  };

  return (
    <div className="flex h-full flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Cloud Data Intelligence</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              SaaS Analytics Engine • Benchmarks & Predictions Active
            </p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setQuery("SELECT * FROM creative_performance WHERE type = 'VIDEO' ORDER BY roas DESC")} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase border border-blue-100">Creative ROI</button>
            <button onClick={() => setQuery("SELECT * FROM market_benchmarks WHERE industry = 'E-commerce'")} className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase border border-emerald-100">Market Check</button>
            <button onClick={() => setQuery("SELECT * FROM historical_trends")} className="px-3 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase border border-amber-100">History</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 min-h-0">
        <div className="lg:col-span-1 bg-white rounded-[2rem] border border-slate-200 p-8 overflow-y-auto shadow-sm custom-scrollbar">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 italic">Object Explorer</h3>
          <div className="space-y-6">
            {Object.keys(tables).map(tableName => (
              <div key={tableName} className="group cursor-pointer" onClick={() => setQuery(`SELECT * FROM ${tableName} LIMIT 25`)}>
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 mb-2 uppercase italic group-hover:text-blue-600 transition-colors">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500"></div>
                   {tableName}
                </div>
                <div className="pl-4 space-y-1 border-l-2 border-slate-100 ml-0.5 group-hover:border-blue-100 transition-all">
                  {Object.keys(tables[tableName][0] || { empty: true }).map(col => (
                    <div key={col} className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{col}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col space-y-6 min-h-0">
          <div className="bg-slate-900 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl border border-white/5 ring-8 ring-slate-100">
            <div className="bg-slate-800/80 px-8 py-4 flex justify-between items-center">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">query_workspace.sql</span>
              <div className="flex gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
              </div>
            </div>
            <textarea
              className="w-full h-40 bg-slate-900 text-emerald-400 font-mono p-10 outline-none resize-none text-sm leading-relaxed"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
            <div className="bg-slate-800/50 p-6 px-10 flex justify-between items-center border-t border-white/5">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic">Simulation : Creative Performance & Historical trends supportés</p>
                <button
                    onClick={runQuery}
                    disabled={isLoading}
                    className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3 active:scale-95"
                >
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'EXECUTE SQL'}
                </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0 shadow-sm">
            <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Query Results {results.length > 0 && `(${results.length})`}</h3>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
              {error ? (
                <div className="p-16 text-center space-y-4">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto font-black italic">!</div>
                    <p className="text-xs font-black text-red-600 uppercase tracking-widest">{error}</p>
                </div>
              ) : results.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400 font-black text-[9px] uppercase tracking-widest sticky top-0 z-10">
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="px-10 py-5 border-b border-slate-100">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[10px]">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                        {columns.map(col => (
                          <td key={col} className="px-10 py-4 text-slate-600 whitespace-nowrap group-hover:text-blue-700">
                            {typeof row[col] === 'object' ? 'JSON' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-20 text-center text-slate-300 italic font-black text-[10px] uppercase tracking-widest">
                    No data in result set
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSqlEditor;
