import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ButtonHints from './components/ButtonHints';
import './styles.css';
import './theme.css';
import './palette-theme.css';
import './experience.css';
import './h5.css';
import './brand.css';
import './studio-v07.css';
import './three-d-v2.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ButtonHints />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
