
import React, { useState, useRef, useEffect } from 'react';
import { getChatbotResponse } from '../services/geminiService';
import { IntegrationSecret } from '../types';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

const ADiVISIONChatbot: React.FC<{ secrets: IntegrationSecret[] }> = ({ secrets }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: "Hello ! Je suis VisionBot. Comment puis-je vous aider à scaler vos Meta Ads aujourd'hui ?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Hide teaser after some time or interaction
  useEffect(() => {
    const timer = setTimeout(() => setShowTeaser(false), 8000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const history = messages.slice(-5).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      const response = await getChatbotResponse(userMsg, history);
      
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: "Oups, petit bug technique. Demandez-moi autre chose !" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {/* Styles for the floating and wobble animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }
        @keyframes eye-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-blink {
          animation: eye-blink 4s infinite;
        }
      `}</style>

      {/* Teaser Bubble */}
      {showTeaser && !isOpen && (
        <div className="mb-4 bg-white border-2 border-blue-500 px-4 py-3 rounded-2xl shadow-xl animate-bounce flex items-center gap-3 relative max-w-[200px]">
          <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
            Coucou ! Je peux t'aider ? 🚀
          </span>
          <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r-2 border-b-2 border-blue-500 rotate-45"></div>
          <button onClick={() => setShowTeaser(false)} className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center text-[8px] font-black border-2 border-white">
            X
          </button>
        </div>
      )}

      {/* Main Chat Window */}
      {isOpen && (
        <div className="mb-4 w-[350px] sm:w-[400px] h-[550px] bg-white rounded-[2.5rem] border-2 border-slate-900 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 zoom-in-95 duration-300">
          <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg border border-white/20">
                 <RobotIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="font-black italic uppercase tracking-tighter text-lg">VisionBot v3</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Neural Mode: Active</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-3xl text-xs font-bold leading-relaxed shadow-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-3xl border border-slate-100 rounded-tl-none flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
            <input 
              type="text" 
              placeholder="Écrivez un message..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-xs font-bold outline-none focus:border-blue-600 transition-all placeholder:text-slate-300"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} className="bg-slate-900 text-white px-5 rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Robot Trigger */}
      <button 
        onClick={() => { setIsOpen(!isOpen); setShowTeaser(false); }}
        className={`w-20 h-20 bg-slate-950 rounded-3xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-90 transition-all border-4 border-white ring-8 ring-slate-100/50 relative group ${!isOpen ? 'animate-float' : ''}`}
      >
        <div className="relative">
          <RobotHeadGraphic className={`w-14 h-14 ${isOpen ? 'text-blue-500' : 'text-white'}`} />
          {!isOpen && (
             <div className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse"></div>
          )}
        </div>
      </button>
    </div>
  );
};

// Modern Robot Head Component
const RobotHeadGraphic = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {/* Head Outline */}
    <rect x="3" y="11" width="18" height="10" rx="2" fill="currentColor" fillOpacity="0.1" />
    <path d="M12 11V7" />
    <circle cx="12" cy="5" r="2" fill="currentColor" />
    <path d="M8 11V10a4 4 0 0 1 8 0v1" />
    {/* Eyes */}
    <circle className="animate-blink" cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
    <circle className="animate-blink" cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
    {/* Mouth */}
    <path d="M10 18h4" strokeWidth="1.5" />
  </svg>
);

const RobotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

export default ADiVISIONChatbot;
