import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { CAT_COLORS } from '../context/ThemeContext';

const MotionDiv = motion.div;

export default function StrategyModal() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { currentPlay, strategyOpen, setStrategyOpen } = useApp();
  const closeButtonRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!strategyOpen) return;
    const handler = (e) => { if (e.key === 'Escape') setStrategyOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [strategyOpen, setStrategyOpen]);

  useEffect(() => {
    if (!strategyOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const frameId = requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      cancelAnimationFrame(frameId);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [strategyOpen]);

  const catColor = CAT_COLORS[currentPlay?.cat] || t.ac;
  const FF = "'Trebuchet MS','Lucida Grande',sans-serif";

  return (
    <AnimatePresence>
      {strategyOpen && (
        <MotionDiv
          key="strategy-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setStrategyOpen(false)}
        >
          <MotionDiv
            key="strategy-panel"
            role="dialog"
            aria-modal="true"
            aria-label={`${currentPlay?.n ?? 'Play'} strategy`}
            initial={{ scale: 0.92, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{
              background: t.sf,
              border: `1px solid ${t.bd}`,
              borderTop: `3px solid ${catColor}`,
              borderRadius: 12,
              maxWidth: 520, width: '100%',
              maxHeight: '80vh', overflow: 'auto',
              padding: 22, fontFamily: FF,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{
                  fontSize: 8.5, color: catColor, fontWeight: 700,
                  letterSpacing: 2, fontFamily: 'monospace', marginBottom: 3,
                }}>
                  STRATEGY
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: t.tx, lineHeight: 1.2 }}>
                  {currentPlay?.n}
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setStrategyOpen(false)}
                title="Close (Esc)"
                aria-label="Close strategy"
                style={{
                  background: 'none', border: `1px solid ${t.bd}`,
                  borderRadius: 6, color: t.tm,
                  width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, cursor: 'pointer', flexShrink: 0, marginTop: 2,
                }}
              >
                ✕
              </button>
            </div>

            {/* Strategy body */}
            <div style={{
              fontSize: 13.5, lineHeight: 1.85, color: t.tx,
            }}>
              {currentPlay?.strat}
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
