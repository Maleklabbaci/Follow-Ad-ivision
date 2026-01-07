import React, { useState, useEffect } from 'react';

const SHAKE_THRESHOLD = 15; // Seuil de sensibilité pour le secouement
const WHATSAPP_NUMBER = "213542586904"; // Numéro de support configuré

const ShakeReporter: React.FC = () => {
  const [showDialog, setShowDialog] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [lastX, setLastX] = useState<number | null>(null);
  const [lastY, setLastY] = useState<number | null>(null);
  const [lastZ, setLastZ] = useState<number | null>(null);

  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity;
      if (!current) return;

      const currentTime = Date.now();
      if ((currentTime - lastUpdate) > 100) {
        const diffTime = currentTime - lastUpdate;
        setLastUpdate(currentTime);

        const x = current.x || 0;
        const y = current.y || 0;
        const z = current.z || 0;

        if (lastX !== null && lastY !== null && lastZ !== null) {
          const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;

          if (speed > SHAKE_THRESHOLD * 50) { 
            if (!showDialog) {
              setShowDialog(true);
              // Retour haptique si supporté
              if (window.navigator.vibrate) {
                window.navigator.vibrate(200);
              }
            }
          }
        }

        setLastX(x);
        setLastY(y);
        setLastZ(z);
      }
    };

    // Pour les navigateurs mobiles modernes
    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [lastUpdate, lastX, lastY, lastZ, showDialog]);

  if (!showDialog) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center">
               <svg className="w-10 h-10 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Problème Technique ?</h3>
            <p className="text-sm font-bold text-slate-500 leading-relaxed">
              Il semble que vous ayez secoué votre appareil. Rencontrez-vous un problème avec ADiVISION ?
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a 
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=Bonjour%20ADiVISION%2C%20j'ai%20rencontré%20un%20problème%20technique%20sur%20mon%20dashboard.`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#128C7E] transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-3 active:scale-95"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Signaler sur WhatsApp
            </a>
            <button 
              onClick={() => setShowDialog(false)}
              className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-200 active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShakeReporter;