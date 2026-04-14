import { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = {
  dark: {
    bg: '#0a0e1a', sf: '#111827', bd: '#1e293b', tx: '#e2e8f0', tm: '#94a3b8', td: '#64748b',
    rk: '#0f1729', rs: '#334155', ac: '#22d3ee', ab: '#22d3ee18', cb: '#0f1729',
    pc: { LW: '#3b82f6', C: '#6366f1', RW: '#8b5cf6', LD: '#0ea5e9', RD: '#06b6d4', G: '#64748b' },
    oc: '#ff2d78', sc: '#22d3ee', dt: '#0a0e1a',
  },
  light: {
    bg: '#f0f4f8', sf: '#fff', bd: '#dce3ed', tx: '#1e293b', tm: '#475569', td: '#94a3b8',
    rk: '#dfe6f0', rs: '#bcc8d8', ac: '#0891b2', ab: '#0891b210', cb: '#edf1f7',
    pc: { LW: '#2563eb', C: '#4f46e5', RW: '#7c3aed', LD: '#0284c7', RD: '#0891b2', G: '#64748b' },
    oc: '#dc2626', sc: '#0891b2', dt: '#fff',
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, _setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('theme');
      return Object.hasOwn(THEMES, stored) ? stored : 'dark';
    } catch { return 'dark'; }
  });

  useEffect(() => {
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  const setTheme = next => { if (Object.hasOwn(THEMES, next)) _setTheme(next); };
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
