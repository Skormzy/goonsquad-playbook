import { useState } from 'react';

export default function SkipLink({ targetId = 'main-content' }) {
  const [focused, setFocused] = useState(false);

  const focusTarget = () => {
    requestAnimationFrame(() => {
      document.getElementById(targetId)?.focus({ preventScroll: true });
    });
  };

  return (
    <a
      href={`#${targetId}`}
      onBlur={() => setFocused(false)}
      onClick={focusTarget}
      onFocus={() => setFocused(true)}
      style={{
        position: 'fixed',
        top: focused ? 10 : -80,
        left: 10,
        zIndex: 10000,
        padding: '10px 14px',
        border: '2px solid currentColor',
        borderRadius: 4,
        background: '#ffffff',
        color: '#111827',
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: 0,
        textDecoration: 'none',
        transition: 'top 120ms ease-out',
      }}
    >
      Skip to content
    </a>
  );
}
