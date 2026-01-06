
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, CampaignStats } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface AdminDashboardProps {
  clients: Client[];
  campaigns: CampaignStats[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ clients, campaigns }) => {
  const navigate = useNavigate();
  
  const totals = useMemo(() => {
    return campaigns.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      conv: acc.conv + c.conversions,
      clicks: acc.clicks + c.clicks
    }), { spend: 0, conv: 0, clicks: 0 });
  }, [campaigns]);

  const chartData = useMemo(() => {
    return [
      { date: 'Mon', spend: 400, conv: 24 },
      { date: 'Tue', spend: 300, conv: 13 },
      { date: 'Wed', spend: 200, conv: 9 },
      { date: 'Thu', spend: 278, conv: 39 },
      { date: 'Fri', spend: 189, conv: 48 },
      { date: 'Sat', spend: 239, conv: 38 },
      { date: 'Sun', spend: 349, conv: 43 },
    ];
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard label="Total Spend" value={`$${totals.spend.toLocaleString()}`} delta="+12.5%" />
        <StatsCard label="Total Conversions" value={totals.conv.toString()} delta="+8.1%" />
        <StatsCard label="Average ROAS" value="3.4x" delta="-2.1%" negative />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Agency Spend Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="spend" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Global Conversion Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="conv" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-800">Active Clients Overview</h3>
          <button 
            onClick={() => navigate('/admin/clients')}
            className="text-sm text-blue-600 font-medium hover:underline px-3 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            View All Clients
          </button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Client Name</th>
              <th className="px-6 py-4">Ad Accounts</th>
              <th className="px-6 py-4">30d Spend</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map(client => (
              <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{client.name}</td>
                <td className="px-6 py-4 text-slate-600">{client.adAccounts.length} Connected</td>
                <td className="px-6 py-4 text-slate-900 font-medium">$4,250</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Active</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatsCard = ({ label, value, delta, negative = false }: { label: string, value: string, delta: string, negative?: boolean }) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${negative ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
        {delta}
      </span>
    </div>
    <div className="text-2xl font-bold text-slate-900">{value}</div>
  </div>
);

export default AdminDashboard;
