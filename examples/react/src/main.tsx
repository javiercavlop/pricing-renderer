import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import 'pricing-renderer/styles.css';
import './styles.css';
import './pricing-config';
import { App } from './app';

// Client-side only: no server render and no hydration, so the router can read the URL directly.
createRoot(document.querySelector('#root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
