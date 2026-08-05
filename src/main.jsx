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

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let activeController = navigator.serviceWorker.controller;
  let reloadingForRelease = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!activeController) {
      activeController = navigator.serviceWorker.controller;
      return;
    }
    if (reloadingForRelease) return;
    reloadingForRelease = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      const checkForRelease = () => registration.update().catch(() => undefined);
      await checkForRelease();
      window.setInterval(checkForRelease, 30 * 60 * 1000);
      window.addEventListener('focus', checkForRelease);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForRelease();
      });
    } catch {
      // The online app remains fully usable when service workers are unavailable.
    }
  }, { once: true });
}
