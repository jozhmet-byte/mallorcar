import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import PropertySearch from './PropertySearch.tsx';
import Prototipos from './Prototipos.tsx';
import Historial from './Historial.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/buscar" element={<PropertySearch />} />
        <Route path="/prototipos" element={<Prototipos />} />
        <Route path="/historial" element={<Historial />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
