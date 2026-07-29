import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpenCheck, PlayCircle, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import {
  GUIDE_TOPIC_ORDER,
  GUIDE_TOPICS,
  guideTopicForView,
} from '../help/guideContent';

const MotionDiv = motion.div;

function workspaceLabel(activeView, search = '') {
  if (activeView === 'playmaker') return 'Create';
  if (activeView === 'stats') {
    const topic = guideTopicForView(activeView, search);
    if (topic === 'game') return 'Game result';
    if (topic === 'matchup') return 'Opponent matchup';
    if (topic === 'player-stats') return 'Player stats';
    return 'Stats';
  }
  if (activeView === 'profile') return 'Profile';
  if (activeView === 'account') return 'Account';
  if (activeView === 'tactics') return 'Strategy 2D';
  if (activeView === 'strategy3d') return 'Strategy 3D';
  if (activeView === 'replay3d') return 'Plays 3D';
  return 'Plays 2D';
}

export default function KeyboardHelp() {
  const { theme } = useTheme();
  const {
    activeView,
    keyboardHelpOpen,
    setActiveView,
    setIsPlaying,
    setKeyboardHelpOpen,
    setPlaymakerTutorialOpen,
  } = useApp();
  const [selectedTopicOverride, setSelectedTopicOverride] = useState(null);
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const restoreFocusRef = useRef(true);
  const routeSearch = typeof window === 'undefined' ? '' : window.location.search;
  const selectedTopic = selectedTopicOverride ?? guideTopicForView(activeView, routeSearch);
  const topic = GUIDE_TOPICS[selectedTopic] ?? GUIDE_TOPICS.start;
  const closeGuide = useCallback(() => {
    setSelectedTopicOverride(null);
    setKeyboardHelpOpen(false);
  }, [setKeyboardHelpOpen]);

  useEffect(() => {
    if (keyboardHelpOpen) restoreFocusRef.current = true;
  }, [keyboardHelpOpen]);

  useEffect(() => {
    if (!keyboardHelpOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const frameId = requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeGuide();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handler);
      if (restoreFocusRef.current && previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [closeGuide, keyboardHelpOpen]);

  const startCreateTutorial = () => {
    restoreFocusRef.current = false;
    setIsPlaying(false);
    setSelectedTopicOverride(null);
    setKeyboardHelpOpen(false);
    setActiveView('playmaker');
    setPlaymakerTutorialOpen(true);
  };

  return (
    <AnimatePresence>
      {keyboardHelpOpen && (
        <MotionDiv
          key="guide-backdrop"
          className="guide-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={closeGuide}
        >
          <MotionDiv
            key="guide-panel"
            ref={panelRef}
            className={`guide-panel is-${theme}`}
            role="dialog"
            aria-modal="true"
            aria-label="Goonsquad product guide"
            initial={{ scale: 0.97, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="guide-header">
              <div className="guide-heading-lockup">
                <BookOpenCheck aria-hidden="true" />
                <div>
                  <span>GOONSQUAD GUIDE</span>
                  <h1>Learn in the workspace</h1>
                </div>
              </div>
              <div className="guide-header-actions">
                <span className="guide-context">{workspaceLabel(activeView, routeSearch)}</span>
                <button
                  ref={closeButtonRef}
                  type="button"
                  className="guide-icon-button"
                  onClick={closeGuide}
                  aria-label="Close product guide"
                  title="Close guide"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="guide-layout">
              <nav className="guide-nav" role="tablist" aria-label="Guide topics">
                {GUIDE_TOPIC_ORDER.map((topicId) => (
                  <button
                    key={topicId}
                    type="button"
                    id={`guide-tab-${topicId}`}
                    role="tab"
                    aria-controls={`guide-panel-${topicId}`}
                    aria-selected={selectedTopic === topicId}
                    onClick={() => setSelectedTopicOverride(topicId)}
                  >
                    {GUIDE_TOPICS[topicId].label}
                  </button>
                ))}
              </nav>

              <section
                className="guide-content"
                id={`guide-panel-${selectedTopic}`}
                role="tabpanel"
                aria-labelledby={`guide-tab-${selectedTopic}`}
                tabIndex="0"
              >
                <div className="guide-topic-heading">
                  <span>{topic.eyebrow}</span>
                  <h2>{topic.title}</h2>
                  <p>{topic.intro}</p>
                </div>

                <div className="guide-sections">
                  {topic.sections.map((section) => (
                    <article key={section.title} className="guide-section">
                      <h3>{section.title}</h3>
                      {section.body && <p>{section.body}</p>}
                      {section.shortcuts && (
                        <dl className="guide-shortcuts">
                          {section.shortcuts.map(([keys, description]) => (
                            <div key={`${keys}-${description}`}>
                              <dt>{keys}</dt>
                              <dd>{description}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </article>
                  ))}
                </div>

                <aside className="guide-note" aria-label="Coaching note">
                  <span>KEEP IN MIND</span>
                  <p>{topic.note}</p>
                </aside>

                {topic.action && (
                  <button type="button" className="guide-primary-action" onClick={startCreateTutorial}>
                    <PlayCircle aria-hidden="true" />
                    {topic.action}
                  </button>
                )}
              </section>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
