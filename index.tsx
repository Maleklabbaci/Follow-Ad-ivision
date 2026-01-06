
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

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
    <div style="padding: 20px; color: red; font-family: sans-serif; background: white; border: 1px solid #ccc; margin: 20px; border-radius: 8px;">
      <h1 style="margin-top: 0;">Application Error</h1>
      <p>The application failed to start. This is usually due to a module loading issue.</p>
      <pre style="background: #f4f4f4; padding: 10px; border-radius: 4px; overflow: auto;">${error instanceof Error ? error.message : String(error)}</pre>
      <button onclick="window.location.reload()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Reload Page</button>
    </div>
  `;
}
