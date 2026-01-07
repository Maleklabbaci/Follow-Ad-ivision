
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const clearAndReload = () => {
  localStorage.clear();
  window.location.reload();
};

try {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical rendering error:", error);
  rootElement.innerHTML = `
    <div style="padding: 40px; color: #1e293b; font-family: 'Inter', sans-serif; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 32px; border-radius: 24px; border: 1px solid #e2e8f0; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); max-width: 480px; width: 100%;">
        <h1 style="margin-top: 0; font-weight: 900; font-size: 24px; color: #ef4444;">Platform Error</h1>
        <p style="color: #64748b; line-height: 1.6;">The application encountered a fatal state error. This can happen if local data is out of sync.</p>
        <pre style="background: #f1f5f9; padding: 12px; border-radius: 12px; overflow: auto; font-size: 12px; margin: 16px 0; border: 1px solid #e2e8f0;">${error instanceof Error ? error.message : String(error)}</pre>
        <div style="display: flex; gap: 12px;">
          <button id="reload-btn" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: bold; flex: 1;">Reload</button>
          <button id="reset-btn" style="background: #f1f5f9; color: #64748b; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: bold;">Reset All Data</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('reload-btn')?.addEventListener('click', () => window.location.reload());
  document.getElementById('reset-btn')?.addEventListener('click', clearAndReload);
}
