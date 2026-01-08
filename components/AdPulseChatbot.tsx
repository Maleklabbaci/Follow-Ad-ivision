
import React, { useState, useRef, useEffect } from 'react';
import { getChatbotResponse } from '../services/geminiService';
import { IntegrationSecret, CampaignStats } from '../types';
import { decryptSecret } from '../services/cryptoService';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

interface AdPulseChatbotProps {
  secrets: IntegrationSecret[];
  campaigns?: CampaignStats[];
  activeClientName?: string;
}

const AdPulseChatbot: React.FC<AdPulseChatbotProps> = ({ secrets, campaigns = [], activeClientName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: "Bienvenue sur AdPulse AI ! 🚀 Je suis votre guide. Voulez-vous savoir pourquoi nous sommes plus efficaces qu'une agence traditionnelle ?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (customMsg?: string) => {
    const msg = customMsg || input.trim();
    if (!msg || isLoading) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);

    try {
      const aiSecret = secrets.find(s => s.type === 'AI');
      const apiKey = aiSecret && aiSecret.value !== 'managed_by_env' ? await decryptSecret(aiSecret.value) : undefined;
      const history = messages.slice(-4).map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.content }));
      
      const response = await getChatbotResponse(msg, history, apiKey, campaigns, activeClientName);
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: "L'IA est en cours de recalibrage. Posez-moi une autre question !" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = activeClientName 
    ? ["Analyse mes perfs", "Budget gaspillé ?", "Conseils créas"]
    : ["Pourquoi AdPulse ?", "Est-ce sécurisé ?", "Parler à un expert"];

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-[350px] md:w-[400px] h-[550px] bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <p className="font-black italic uppercase tracking-tighter text-sm">PulseBot Agent</p>
                <div className="flex items-center gap-1">
                   <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                     {activeClientName ? `Analyste: ${activeClientName}` : 'Active Analyser'}
                   </span>
                   <span className="w-1 h-1 rounded-full bg-blue-400"></span>
                   <span className="text-[7px] font-bold text-slate-400 uppercase">Context Aware</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold leading-relaxed shadow-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {suggestedQuestions.map(q => (
                <button key={q} onClick={() => handleSend(q)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all">
                  {q}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Posez votre question..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button onClick={() => handleSend()} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all border-4 border-white ring-8 ring-blue-500/10"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </button>
    </div>
  );
};

export default AdPulseChatbot;
