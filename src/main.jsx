import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { AccountProvider } from './account/AccountContext';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <AccountProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </AccountProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
