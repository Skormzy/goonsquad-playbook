import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import {
  PLAYMAKER_TUTORIAL_STEPS,
  PLAYMAKER_TUTORIAL_STORAGE_KEY,
} from './playmakerTutorialContent';

const SPOTLIGHT_GAP = 7;
const CARD_GAP = 16;
const DESKTOP_CARD_WIDTH = 368;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function rectForTarget(selector) {
  const target = document.querySelector(selector);
  if (!(target instanceof HTMLElement || target instanceof SVGElement)) return null;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { target, rect };
}

function placeCard(targetRect, cardHeight) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const edge = 12;
  if (viewportWidth <= 720) {
    return targetRect.top > viewportHeight * 0.48
      ? { left: edge, right: edge, top: edge }
      : { left: edge, right: edge, bottom: edge };
  }

  const width = Math.min(DESKTOP_CARD_WIDTH, viewportWidth - edge * 2);
  const maxTop = Math.max(edge, viewportHeight - cardHeight - edge);
  const alignedTop = clamp(targetRect.top, edge, maxTop);
  if (targetRect.right + CARD_GAP + width <= viewportWidth - edge) {
    return { left: targetRect.right + CARD_GAP, top: alignedTop, width };
  }
  if (targetRect.left - CARD_GAP - width >= edge) {
    return { left: targetRect.left - CARD_GAP - width, top: alignedTop, width };
  }
  if (targetRect.bottom + CARD_GAP + cardHeight <= viewportHeight - edge) {
    return {
      left: clamp(targetRect.left, edge, viewportWidth - width - edge),
      top: targetRect.bottom + CARD_GAP,
      width,
    };
  }
  return {
    left: clamp(targetRect.left, edge, viewportWidth - width - edge),
    top: clamp(targetRect.top - cardHeight - CARD_GAP, edge, maxTop),
    width,
  };
}

export default function PlaymakerTutorial({ open, onClose, colors }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const [cardPosition, setCardPosition] = useState({ top: 16, right: 16, width: DESKTOP_CARD_WIDTH });
  const closeButtonRef = useRef(null);
  const step = PLAYMAKER_TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex === PLAYMAKER_TUTORIAL_STEPS.length - 1;

  const closeTutorial = useCallback(() => {
    setStepIndex(0);
    onClose();
  }, [onClose]);
  const cardRef = useDialogFocus({
    active: open,
    initialFocusRef: closeButtonRef,
    onClose: closeTutorial,
  });

  const updateLayout = useCallback(({ reveal = false } = {}) => {
    if (!open || !step) return;
    const result = rectForTarget(step.target) ?? rectForTarget('[data-tutorial="workspace"]');
    if (!result) return;
    if (reveal) result.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const rect = result.target.getBoundingClientRect();
    setSpotlight({
      top: Math.max(0, rect.top - SPOTLIGHT_GAP),
      left: Math.max(0, rect.left - SPOTLIGHT_GAP),
      width: Math.min(window.innerWidth, rect.width + SPOTLIGHT_GAP * 2),
      height: Math.min(window.innerHeight, rect.height + SPOTLIGHT_GAP * 2),
    });
    setCardPosition(placeCard(rect, cardRef.current?.offsetHeight ?? 326));
  }, [cardRef, open, step]);

  useEffect(() => {
    if (!open) return undefined;
    const firstFrame = requestAnimationFrame(() => updateLayout({ reveal: true }));
    const secondFrame = requestAnimationFrame(() => updateLayout());
    const handler = () => updateLayout();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open, stepIndex, updateLayout]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setStepIndex((current) => Math.min(current + 1, PLAYMAKER_TUTORIAL_STEPS.length - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setStepIndex((current) => Math.max(current - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeTutorial, open]);

  if (!open || typeof document === 'undefined') return null;

  const finish = () => {
    try { localStorage.setItem(PLAYMAKER_TUTORIAL_STORAGE_KEY, 'true'); } catch { /* Storage is optional. */ }
    closeTutorial();
  };

  return createPortal(
    <div
      className="playmaker-tutorial-layer"
      style={{
        '--tutorial-surface': colors.surface,
        '--tutorial-panel': colors.panel,
        '--tutorial-border': colors.border,
        '--tutorial-text': colors.text,
        '--tutorial-muted': colors.muted,
        '--tutorial-accent': colors.accent,
        '--tutorial-accent-bg': colors.accentBackground,
      }}
    >
      {spotlight && <div className="playmaker-tutorial-spotlight" style={spotlight} aria-hidden="true" />}
      <section
        ref={cardRef}
        className="playmaker-tutorial-card"
        role="dialog"
        aria-modal="true"
        aria-label="Create tutorial"
        aria-live="polite"
        tabIndex={-1}
        style={cardPosition}
      >
        <div className="playmaker-tutorial-header">
          <div>
            <span>{step.eyebrow}</span>
            <strong>STEP {stepIndex + 1} OF {PLAYMAKER_TUTORIAL_STEPS.length}</strong>
          </div>
          <button ref={closeButtonRef} type="button" onClick={closeTutorial} aria-label="Exit Create tutorial" title="Exit tutorial">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="playmaker-tutorial-progress" aria-hidden="true">
          <span style={{ width: `${((stepIndex + 1) / PLAYMAKER_TUTORIAL_STEPS.length) * 100}%` }} />
        </div>
        <div className="playmaker-tutorial-copy">
          <h2>{step.title}</h2>
          <p>{step.body}</p>
          <aside>{step.detail}</aside>
        </div>
        <div className="playmaker-tutorial-footer">
          <button
            type="button"
            className="playmaker-tutorial-secondary"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            className="playmaker-tutorial-primary"
            onClick={() => {
              if (isLastStep) finish();
              else setStepIndex((current) => current + 1);
            }}
          >
            {isLastStep ? 'Finish' : 'Next'}
            {isLastStep ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
