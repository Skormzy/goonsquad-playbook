import { createContext, useContext, useState, useEffect } from 'react';

// Category color palette — used in sidebar cards and phase badges
export const CAT_COLORS = {
  defensive:  '#0ea5e9',
  neutral:    '#a78bfa',
  offensive:  '#fb923c',
  special:    '#facc15',
  transition: '#34d399',
  systems:    '#818cf8',
};

export const THEMES = {
  dark: {
    bg: '#08090b', sf: '#111317', bd: '#2a2e34',
    tx: '#f4f6f7', tm: '#9aa3ad', td: '#626c77',
    rk: '#171a1f', rs: '#2b3037',
    ac: '#38d7ff', ab: '#38d7ff14', br: '#e3263f', cb: '#0c0e11',
    pc: { LW: '#3b82f6', C: '#7dd3fc', RW: '#a5b4fc', LD: '#22d3ee', RD: '#06b6d4', G: '#8b95a3' },
    oc: '#e3263f', sc: '#38d7ff', dt: '#08090b',
  },
  light: {
    bg: '#f1f2f3', sf: '#ffffff', bd: '#cfd3d8',
    tx: '#14171b', tm: '#59616a', td: '#87909a',
    rk: '#e1e4e7', rs: '#bac1c8',
    ac: '#007f9d', ab: '#007f9d12', br: '#c91835', cb: '#e9ebed',
    pc: { LW: '#2563eb', C: '#0369a1', RW: '#4f46e5', LD: '#007f9d', RD: '#0284c7', G: '#606a75' },
    oc: '#c91835', sc: '#007f9d', dt: '#ffffff',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const validThemes = Object.keys(THEMES);
  const [theme, _setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('theme');
      return validThemes.includes(stored) ? stored : 'light';
    } catch { return 'light'; }
  });

  useEffect(() => {
    try { localStorage.setItem('theme', theme); } catch { /* localStorage unavailable */ }
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.body.dataset.theme = theme;
    document.body.style.backgroundColor = THEMES[theme].bg;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', THEMES[theme].bg);
  }, [theme]);

  const setTheme = next => {
    _setTheme(prev => {
      const val = typeof next === 'function' ? next(prev) : next;
      return validThemes.includes(val) ? val : prev;
    });
  };
  const toggleTheme = () => _setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
