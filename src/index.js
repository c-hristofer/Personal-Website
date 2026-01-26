import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app';
import './styles/style.css';
import { themeManager } from './theme';

const container = document.getElementById('root');
const root = createRoot(container);

themeManager.init();

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
