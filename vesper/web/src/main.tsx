import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import './index.css';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyUi, useUi } from './store/ui';

applyUi(useUi.getState().ui);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyUi(useUi.getState().ui));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
);
