/**
 * main.jsx — נקודת הכניסה של אפליקציית React.
 * מרכיב את רכיב השורש על אלמנט #root ומטעין את העיצוב.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
