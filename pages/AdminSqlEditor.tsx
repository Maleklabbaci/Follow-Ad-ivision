
import React, { useState } from 'react';
import { Client, CampaignStats, IntegrationSecret, User, AuditLog, AiReport } from '../types';

interface AdminSqlEditorProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
  users: User[];
  auditLogs: AuditLog[];
  aiReports: AiReport[];
}

const AdminSqlEditor: React.FC<AdminSqlEditorProps> = ({ clients, campaigns, secrets, users, auditLogs, aiReports }) => {
  const [query, setQuery] = useState('SELECT * FROM audit_logs ORDER BY timestamp DESC');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tables: Record<string, any[]> = {
    clients: clients,
    campaigns: campaigns,
    users: users.map(u => ({ ...u, password: '••••••••' })),
    audit_logs: auditLogs,
    ai_reports: aiReports,
    secrets: secrets.map(s => ({ ...s, value: '********' }))
  };

  const runQuery = () => {
    setIsLoading(true);
    setError(null);
    setResults([]);
    
    setTimeout(() => {
      try {
        const q = query.toLowerCase().trim();
        if (!q.startsWith('select')) throw new Error('Seules les requêtes SELECT sont autorisées.');

        // Analyse ultra-simplifiée de la requête
        let tableName = '';
        if (q.includes('from audit_logs')) tableName = 'audit_logs';
        else if (q.includes('from campaigns')) tableName = 'campaigns';
        else if (q.includes('from users')) tableName = 'users';
        else if (q.includes('from clients')) tableName = 'clients';
        else if (q.includes('from ai_reports')) tableName = 'ai_reports';
        else if (q.includes('from secrets')) tableName = 'secrets';
        else throw new Error('Table non trouvée.');

        let data = [...tables[tableName]];

        // --- SIMULATION AGRÉGATIONS ---
        if (q.includes('sum(spend)')) {
          const total = data.reduce((acc, curr) => acc + (curr.spend || 0), 0);
          setColumns(['total_spend_consolidated']);
          setResults([{ total_spend_consolidated: total.toFixed(2) + ' USD' }]);
          setIsLoading(false);
          return;
        }

        if (q.includes('avg(roas)')) {
          const avg = data.reduce((acc, curr) => acc + (curr.roas || 0), 0) / (data.length || 1);
          setColumns(['average_roas']);
          setResults([{ average_roas: avg.toFixed(2) + 'x' }]);
          setIsLoading(false);
          return;
        }

        // --- SIMULATION FILTRES ---
        if (q.includes('where')) {
            if (q.includes("action = 'user_login'")) data = data.filter(d => d.action === 'USER_LOGIN');
            if (q.includes("status = 'active'")) data = data.filter(d => d.status === 'ACTIVE');
        }

        // --- SIMULATION ORDER BY ---
        if (q.includes('order by')) {
            if (q.includes('timestamp desc')) data.sort((a,b) => b.timestamp?.localeCompare(a.timestamp));
            if (q.includes('spend desc')) data.sort((a,b) => b.spend - a.spend);
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
    }, 500);
  };

  return (
    <div className="flex h-full flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Cloud SQL Master</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Instance : adpulse-prod-01 • Multi-Tenant : Active
            </p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setQuery("SELECT SUM(spend) FROM campaigns")} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all">Calc Spend</button>
            <button onClick={() => setQuery("SELECT * FROM audit_logs ORDER BY timestamp DESC")} className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">Security Logs</button>
            <button onClick={() => setQuery("SELECT * FROM ai_reports ORDER BY createdAt DESC")} className="px-3 py-2 bg-purple-50 text-purple-600 rounded-xl text-[10px] font-black uppercase hover:bg-purple-100 transition-all">AI Reports</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 min-h-0">
        {/* Schema Sidebar */}
        <div className="lg:col-span-1 bg-white rounded-[2rem] border border-slate-200 p-8 overflow-y-auto shadow-sm">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Database Schema</h3>
          <div className="space-y-6">
            {Object.keys(tables).map(tableName => (
              <div key={tableName} className="group cursor-pointer" onClick={() => setQuery(`SELECT * FROM ${tableName} LIMIT 50`)}>
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 mb-2 uppercase italic group-hover:text-blue-600">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-blue-500"></div>
                   {tableName}
                </div>
                <div className="pl-4 space-y-1 border-l-2 border-slate-100 ml-0.5">
                  {Object.keys(tables[tableName][0] || {}).map(col => (
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
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">adpulse_saas_query.sql</span>
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
            <div className="bg-slate-800/50 p-6 px-10 flex justify-between items-center">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest italic">Simulation : Agrégations et tris supportés</p>
                <button
                    onClick={runQuery}
                    disabled={isLoading}
                    className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 flex items-center gap-3"
                >
                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'RUN QUERY'}
                </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0 shadow-sm">
            <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Résultats {results.length > 0 && `(${results.length} lignes)`}</h3>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
              {error ? (
                <div className="p-16 text-center space-y-4">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto">!</div>
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
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        {columns.map(col => (
                          <td key={col} className="px-10 py-4 text-slate-600 whitespace-nowrap">
                            {typeof row[col] === 'object' ? 'OBJ' : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-20 text-center text-slate-300 italic font-black text-[10px] uppercase tracking-widest">
                    Aucun résultat cloud trouvé
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
