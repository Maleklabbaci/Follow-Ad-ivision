
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats, IntegrationSecret } from '../types';

interface AdminSqlEditorProps {
  clients: Client[];
  campaigns: CampaignStats[];
  secrets: IntegrationSecret[];
}

const AdminSqlEditor: React.FC<AdminSqlEditorProps> = ({ clients, campaigns, secrets }) => {
  const navigate = useNavigate();
  const dbSecret = secrets.find(s => s.type === 'DATABASE');
  const isLinked = dbSecret && dbSecret.status === 'VALID';

  const [query, setQuery] = useState('SELECT * FROM clients WHERE name LIKE "%Elite%"');
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Simulated tables mapping
  const tables: Record<string, any[]> = {
    clients: clients,
    campaigns: campaigns,
    secrets: secrets.map(s => ({ ...s, value: '******** (encrypted)' }))
  };

  const runQuery = () => {
    if (!isLinked) {
      alert("Database is not linked. Please provide a valid access token in Settings first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);
    
    // Fake latency to feel like a real DB
    setTimeout(() => {
      try {
        const lowerQuery = query.toLowerCase().trim();
        
        if (!lowerQuery.startsWith('select')) {
          throw new Error('Only SELECT queries are supported in this simulation.');
        }

        // Basic table detection
        let targetTable = '';
        if (lowerQuery.includes('from clients')) targetTable = 'clients';
        else if (lowerQuery.includes('from campaigns')) targetTable = 'campaigns';
        else if (lowerQuery.includes('from secrets')) targetTable = 'secrets';
        else {
          throw new Error('Unknown table. Available: clients, campaigns, secrets');
        }

        let data = [...tables[targetTable]];

        // Basic Filter Simulation
        if (lowerQuery.includes('where')) {
          // This is a very primitive parser for demo purposes
          if (lowerQuery.includes('status = "active"') || lowerQuery.includes("status = 'active'")) {
            data = data.filter((item: any) => item.status === 'ACTIVE');
          }
          if (lowerQuery.includes('roas > 3')) {
            data = data.filter((item: any) => item.roas > 3);
          }
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
    }, 600);
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">SQL Advanced Console</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isLinked ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
            <p className={`text-sm font-medium ${isLinked ? 'text-emerald-600' : 'text-red-600'}`}>
              {isLinked ? 'Linked to Live Database' : 'Database Disconnected'}
            </p>
          </div>
        </div>
        {!isLinked && (
          <button 
            onClick={() => navigate('/admin/settings')}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-black transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Link Access Token
          </button>
        )}
        {isLinked && (
          <div className="flex gap-2">
              <button 
                  onClick={() => setQuery('SELECT * FROM campaigns WHERE roas > 3')}
                  className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                  Find High ROAS
              </button>
              <button 
                  onClick={() => setQuery('SELECT * FROM clients')}
                  className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                  List All Clients
              </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
        {/* Sidebar Schema */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-4 overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Schema Explorer</h3>
          {!isLinked ? (
            <div className="text-center py-8">
              <p className="text-xs text-slate-400 italic">Connect your database token to view schema.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.keys(tables).map(tableName => (
                <div key={tableName}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    {tableName}
                  </div>
                  <div className="pl-6 space-y-1">
                    {Object.keys(tables[tableName][0] || {}).map(col => (
                      <div key={col} className="text-xs text-slate-500 flex justify-between">
                        <span>{col}</span>
                        <span className="text-[10px] text-slate-300 font-mono italic">any</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-3 flex flex-col space-y-4 min-h-0">
          <div className="bg-slate-900 rounded-xl overflow-hidden flex flex-col shadow-inner">
            <div className="bg-slate-800 px-4 py-2 flex justify-between items-center border-b border-slate-700">
              <span className="text-xs font-mono text-slate-400">query_console.sql</span>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
            </div>
            <textarea
              className={`w-full h-40 bg-slate-900 text-blue-400 font-mono p-4 outline-none resize-none placeholder-slate-700 text-sm leading-relaxed ${!isLinked && 'opacity-50 grayscale'}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
              disabled={!isLinked}
              placeholder={isLinked ? "Write your SQL here..." : "Link your database to start writing queries."}
            />
            <div className="bg-slate-800 p-3 flex justify-end">
              <button
                onClick={runQuery}
                disabled={isLoading || !isLinked}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
                Run Query
              </button>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-xl border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700">Query Results {results.length > 0 && `(${results.length})`}</h3>
              {results.length > 0 && (
                  <button 
                    onClick={() => alert(JSON.stringify(results, null, 2))}
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                      Export JSON
                  </button>
              )}
            </div>
            
            <div className="flex-1 overflow-auto">
              {!isLinked ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="max-w-xs mx-auto">
                    <p className="text-sm font-bold text-slate-800">Connection Required</p>
                    <p className="text-xs text-slate-500 mt-1">Please provide your database access token in the settings panel to enable the SQL query console.</p>
                  </div>
                </div>
              ) : error ? (
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-red-600">SQL Error</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">{error}</p>
                    </div>
                </div>
              ) : results.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-mono sticky top-0">
                    <tr>
                      {columns.map(col => (
                        <th key={col} className="px-4 py-3 border-b border-slate-200 uppercase tracking-wider">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        {columns.map(col => (
                          <td key={col} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-slate-400 italic text-sm">
                    No results to display. Run a query to start analyzing.
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
