
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
}

const Login: React.FC<LoginProps> = ({ onLogin, users = [] }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    // Authentification
    setTimeout(() => {
      setLoading(false);
      
      const userList = Array.isArray(users) ? users : [];
      
      if (userList.length === 0) {
        setError("Base de données vide ou inaccessible. Vérifiez votre clé API.");
        return;
      }

      const foundUser = userList.find(u => 
        u.email.toLowerCase().trim() === email.toLowerCase().trim() && 
        (u.password === password || u.password_hash === password)
      );

      if (foundUser) {
        onLogin(foundUser);
      } else {
        setError('Email ou mot de passe incorrect.');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-emerald-600/10 blur-[120px] rounded-full"></div>

      <div className="max-w-md w-full bg-white p-12 rounded-[3rem] shadow-2xl space-y-10 relative z-10 border border-white/10">
        <div className="text-center">
          <div className="inline-flex p-4 bg-slate-900 rounded-[1.5rem] mb-6 shadow-2xl shadow-blue-200">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">AdPulse SaaS</h1>
          <p className="text-slate-400 mt-2 text-xs font-bold uppercase tracking-widest">Marketing Control Suite</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Email Address</label>
            <input
              type="email"
              required
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-blue-600 outline-none transition-all font-bold text-sm"
              placeholder="admin@ivision.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Password</label>
            <input
              type="password"
              required
              className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-2 focus:ring-blue-600 outline-none transition-all font-bold text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight text-center border ${error.includes('Vérifiez votre clé') ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Sign In To Dashboard'}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-slate-50">
          <div className="flex flex-col gap-2">
            <p className="text-[8px] text-slate-300 font-black uppercase tracking-[0.3em]">
              Authorized Access Only • Cloud Sync Active
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full ${users?.length > 0 ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">
                Database Users Loaded: <span className="text-slate-900">{users?.length || 0}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
