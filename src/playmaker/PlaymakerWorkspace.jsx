import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Download,
  FolderOpen,
  GraduationCap,
  Move,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Share2,
  SkipBack,
  Trash2,
  Undo2,
  UserRound,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { useWorkspaceLayout } from '../hooks/useWorkspaceLayout';
import { samplePlayScene } from '../play-engine/samplePlayScene';
import { playmakerReadiness } from './compilePlaymakerScene';
import Playmaker3DPreview from './Playmaker3DPreview';
import PlaymakerAccountDialog from './PlaymakerAccountDialog';
import PlaymakerCourt from './PlaymakerCourt';
import PlaymakerContextHelp from './PlaymakerContextHelp';
import PlaymakerLibraryDialog from './PlaymakerLibraryDialog';
import PlaymakerTutorial from './PlaymakerTutorial';
import {
  clonePlaymakerFrame,
  createPlaymakerDraft,
  createPlaymakerId,
  normalizePlaymakerDraft,
  PLAYMAKER_BALL_TRANSITIONS,
  PLAYMAKER_PLAYER_ACTIONS,
  PLAYMAKER_ROSTER,
  playmakerFrameTimes,
  playmakerPlayerById,
} from './playmakerModel';
import { loadPublishedPlaymakerDraft } from './playmakerCloud';
import {
  createPlaymakerShareUrl,
  playmakerDraftFromUrl,
  playmakerExportFilename,
} from './playmakerShare';
import {
  deletePlaymakerDraft,
  loadActivePlaymakerDraft,
  loadPlaymakerDrafts,
  savePlaymakerDraft,
} from './playmakerStorage';

const HISTORY_LIMIT = 60;

function copyDraft(value) {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function updateDraft(value, recipe) {
  const next = copyDraft(value);
  recipe(next);
  next.updatedAt = new Date().toISOString();
  return normalizePlaymakerDraft(next);
}

function initialDraft() {
  if (typeof window !== 'undefined') {
    const shared = playmakerDraftFromUrl(window.location.href);
    if (shared) return shared;
  }
  return loadActivePlaymakerDraft() ?? createPlaymakerDraft('breakout');
}

function downloadDraft(draft) {
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = playmakerExportFilename(draft);
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement('textarea');
  field.value = value;
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  document.execCommand('copy');
  field.remove();
}

function teamLabel(team) {
  return team === 'us' ? 'Goonsquad' : 'Opponent';
}

function transitionTarget(currentOwnerId) {
  const owner = playmakerPlayerById(currentOwnerId);
  return owner?.team === 'opponent' ? { x: 50, y: 6 } : { x: 50, y: 94 };
}

export default function PlaymakerWorkspace() {
  const { theme, themes } = useTheme();
  const { playmakerTutorialOpen, setPlaymakerTutorialOpen } = useApp();
  const t = themes[theme];
  const workspaceLayout = useWorkspaceLayout();
  const [history, setHistory] = useState(() => ({ past: [], present: initialDraft(), future: [] }));
  const [selectedFrameIndexState, setSelectedFrameIndex] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState('US_C');
  const [viewMode, setViewMode] = useState('edit');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [targetMode, setTargetMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [libraryDrafts, setLibraryDrafts] = useState(loadPlaymakerDrafts);
  const [notice, setNotice] = useState('');
  const dragOriginRef = useRef(null);
  const sharedCloudPlayRef = useRef(false);
  const playbackTimeRef = useRef(0);
  const bodyRef = useRef(null);
  const draft = history.present;
  const times = useMemo(() => playmakerFrameTimes(draft), [draft]);
  const readiness = useMemo(() => playmakerReadiness(draft), [draft]);
  const scene = readiness.scene;
  const selectedFrameIndex = Math.min(selectedFrameIndexState, draft.frames.length - 1);
  const safePlaybackTime = Math.min(playbackTime, scene.duration);
  const currentFrame = draft.frames[selectedFrameIndex] ?? draft.frames[0];
  const previousFrame = draft.frames[selectedFrameIndex - 1] ?? null;
  const nextFrame = draft.frames[selectedFrameIndex + 1] ?? null;
  const selectedPlayer = playmakerPlayerById(selectedPlayerId) ?? PLAYMAKER_ROSTER[0];
  const sampled = useMemo(
    () => samplePlayScene(scene, safePlaybackTime),
    [safePlaybackTime, scene],
  );

  const themeVars = {
    '--pm-bg': t.bg,
    '--pm-surface': t.sf,
    '--pm-panel': t.cb,
    '--pm-border': t.bd,
    '--pm-text': t.tx,
    '--pm-muted': t.tm,
    '--pm-dim': t.td,
    '--pm-accent': t.ac,
    '--pm-accent-bg': t.ab,
    '--pm-opponent': t.oc,
  };

  const syncPlaybackTime = useCallback((value) => {
    const nextTime = Math.max(0, Math.min(Number(value) || 0, scene.duration));
    setPlaybackTime(nextTime);
    let activeIndex = 0;
    times.forEach((time, index) => {
      if (nextTime >= time) activeIndex = index;
    });
    setSelectedFrameIndex(activeIndex);
  }, [scene.duration, times]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('draft')) return;
    url.searchParams.delete('draft');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    playbackTimeRef.current = safePlaybackTime;
  }, [safePlaybackTime]);

  useEffect(() => {
    if (viewMode !== '3d') return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [viewMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      savePlaymakerDraft(draft);
      setLibraryDrafts(loadPlaymakerDrafts());
    }, 350);
    return () => clearTimeout(timer);
  }, [draft]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!isPlaying || viewMode === '3d') return undefined;
    let frameId = 0;
    const startWallTime = performance.now();
    const startReplayTime = playbackTimeRef.current;
    const tick = (now) => {
      const next = Math.min(
        scene.duration,
        startReplayTime + ((now - startWallTime) / 1000) * speed,
      );
      playbackTimeRef.current = next;
      syncPlaybackTime(next);
      if (next >= scene.duration) {
        setIsPlaying(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, scene.duration, speed, syncPlaybackTime, viewMode]);

  const commit = useCallback((recipe) => {
    setHistory((current) => {
      const next = updateDraft(current.present, recipe);
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const replace = useCallback((recipe) => {
    setHistory((current) => ({
      ...current,
      present: updateDraft(current.present, recipe),
    }));
  }, []);

  const openDraft = useCallback((value) => {
    const normalized = normalizePlaymakerDraft(value);
    setHistory({ past: [], present: normalized, future: [] });
    setSelectedFrameIndex(0);
    setSelectedPlayerId('US_C');
    setPlaybackTime(0);
    setIsPlaying(false);
    setTargetMode(false);
    setLibraryOpen(false);
    setAccountOpen(false);
    savePlaymakerDraft(normalized);
    setLibraryDrafts(loadPlaymakerDrafts());
  }, []);

  useEffect(() => {
    if (sharedCloudPlayRef.current || typeof window === 'undefined') return;
    const shareSlug = new URL(window.location.href).searchParams.get('cloudPlay');
    if (!shareSlug) return;
    sharedCloudPlayRef.current = true;
    loadPublishedPlaymakerDraft(shareSlug)
      .then((record) => {
        if (!record) {
          setNotice('This shared play is unavailable.');
          return;
        }
        const now = new Date().toISOString();
        openDraft({
          ...record.draft,
          id: createPlaymakerId('play'),
          title: `${record.title} (copy)`,
          visibility: 'private',
          createdAt: now,
          updatedAt: now,
        });
        setNotice('Shared play opened as your editable copy.');
      })
      .catch(() => setNotice('This shared play could not be loaded.'));
  }, [openDraft]);

  const undo = () => {
    setHistory((current) => {
      if (!current.past.length) return current;
      return {
        past: current.past.slice(0, -1),
        present: current.past.at(-1),
        future: [current.present, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
    setIsPlaying(false);
    setTargetMode(false);
  };

  const redo = () => {
    setHistory((current) => {
      if (!current.future.length) return current;
      return {
        past: [...current.past, current.present].slice(-HISTORY_LIMIT),
        present: current.future[0],
        future: current.future.slice(1),
      };
    });
    setIsPlaying(false);
    setTargetMode(false);
  };

  const movePlayer = (playerId, position, { transient }) => {
    if (transient) {
      if (!dragOriginRef.current) dragOriginRef.current = history.present;
      replace((next) => {
        next.frames[selectedFrameIndex].players[playerId] = {
          ...next.frames[selectedFrameIndex].players[playerId],
          ...position,
        };
      });
      return;
    }

    setHistory((current) => {
      const next = updateDraft(current.present, (value) => {
        value.frames[selectedFrameIndex].players[playerId] = {
          ...value.frames[selectedFrameIndex].players[playerId],
          ...position,
        };
      });
      const origin = dragOriginRef.current ?? current.present;
      dragOriginRef.current = null;
      return {
        past: [...current.past, origin].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  };

  const moveLooseBall = (position, { transient }) => {
    if (transient) {
      if (!dragOriginRef.current) dragOriginRef.current = history.present;
      replace((next) => {
        const ballState = next.frames[selectedFrameIndex].ball;
        if (!ballState.ownerId) ballState.target = { ...ballState.target, ...position };
      });
      return;
    }

    setHistory((current) => {
      const next = updateDraft(current.present, (value) => {
        const ballState = value.frames[selectedFrameIndex].ball;
        if (!ballState.ownerId) ballState.target = { ...ballState.target, ...position };
      });
      const origin = dragOriginRef.current ?? current.present;
      dragOriginRef.current = null;
      return {
        past: [...current.past, origin].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  };

  const goToMoment = (index) => {
    const safeIndex = Math.max(0, Math.min(index, draft.frames.length - 1));
    setSelectedFrameIndex(safeIndex);
    setPlaybackTime(times[safeIndex]);
    setIsPlaying(false);
    setTargetMode(false);
  };

  const addMoment = () => {
    const nextIndex = selectedFrameIndex + 1;
    commit((value) => {
      const source = value.frames[selectedFrameIndex];
      value.frames.splice(nextIndex, 0, clonePlaymakerFrame(source, {
        label: `Moment ${nextIndex + 1}`,
        seconds: 2,
        ball: {
          ownerId: source.ball.ownerId,
          receiverId: source.ball.ownerId,
          transition: 'carry',
        },
      }));
    });
    setSelectedFrameIndex(nextIndex);
    setIsPlaying(false);
  };

  const deleteMoment = () => {
    if (draft.frames.length <= 2) return;
    const nextIndex = Math.max(0, selectedFrameIndex - 1);
    commit((value) => {
      value.frames.splice(selectedFrameIndex, 1);
      value.frames[0].seconds = 0;
      value.frames[0].ball.transition = 'carry';
      value.frames[0].ball.receiverId = null;
    });
    setSelectedFrameIndex(nextIndex);
    setTargetMode(false);
  };

  const changeTransition = (transition) => {
    if (!nextFrame) return;
    const sourceOwner = currentFrame.ball.ownerId;
    commit((value) => {
      const destination = value.frames[selectedFrameIndex + 1];
      destination.ball.transition = transition;
      if (transition === 'shot') {
        destination.ball.ownerId = null;
        destination.ball.receiverId = null;
        destination.ball.target = transitionTarget(sourceOwner);
      } else if (transition === 'loose') {
        destination.ball.ownerId = null;
        destination.ball.receiverId = null;
      } else if (transition === 'carry') {
        destination.ball.ownerId = sourceOwner;
        destination.ball.receiverId = sourceOwner;
      } else {
        const owner = playmakerPlayerById(sourceOwner);
        const validReceiver = playmakerPlayerById(destination.ball.receiverId);
        if (!validReceiver || validReceiver.team !== owner?.team || validReceiver.id === sourceOwner) {
          destination.ball.ownerId = null;
          destination.ball.receiverId = null;
        } else {
          destination.ball.ownerId = validReceiver.id;
          destination.ball.receiverId = validReceiver.id;
        }
      }
    });
    setTargetMode(transition === 'shot' || transition === 'loose');
  };

  const placeTarget = (position) => {
    if (!nextFrame) return;
    commit((value) => {
      value.frames[selectedFrameIndex + 1].ball.target = position;
    });
    setTargetMode(false);
  };

  const editorFrame = targetMode && nextFrame
    ? { ...currentFrame, ball: { ...currentFrame.ball, target: nextFrame.ball.target } }
    : currentFrame;

  const togglePlayback = () => {
    if (!isPlaying && playbackTime >= scene.duration - 0.02) {
      setPlaybackTime(0);
      setSelectedFrameIndex(0);
    }
    setTargetMode(false);
    setIsPlaying((value) => !value);
  };

  const restart = ({ play = false } = {}) => {
    setPlaybackTime(0);
    setSelectedFrameIndex(0);
    setIsPlaying(play);
    setTargetMode(false);
  };

  const saveNow = () => {
    savePlaymakerDraft(draft);
    setLibraryDrafts(loadPlaymakerDrafts());
    setNotice('Saved locally.');
  };

  const share = async () => {
    try {
      await copyText(createPlaymakerShareUrl(window.location.href, draft));
      setNotice('Share link copied.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to create share link.');
    }
  };

  const importDraft = async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      openDraft(parsed);
      setNotice('Play imported.');
    } catch {
      setNotice('That play file could not be opened.');
    }
  };

  const deleteSavedDraft = (draftId) => {
    deletePlaymakerDraft(draftId);
    setLibraryDrafts(loadPlaymakerDrafts());
    if (draftId === draft.id) {
      openDraft(createPlaymakerDraft('breakout'));
    }
  };

  const assignCurrentBallOwner = (ownerId) => {
    commit((value) => {
      const current = value.frames[selectedFrameIndex];
      const currentOwnerPosition = current.ball.ownerId
        ? current.players[current.ball.ownerId]
        : null;
      const source = value.frames[selectedFrameIndex - 1];
      const sourceOwner = playmakerPlayerById(source?.ball.ownerId);
      const nextOwner = playmakerPlayerById(ownerId);

      current.ball.ownerId = ownerId;
      if (!source) {
        current.ball.receiverId = null;
      } else if (!ownerId) {
        current.ball.transition = 'loose';
        current.ball.receiverId = null;
      } else if (sourceOwner?.id === ownerId) {
        current.ball.transition = 'carry';
        current.ball.receiverId = ownerId;
      } else if (sourceOwner && nextOwner?.team === sourceOwner.team) {
        current.ball.transition = 'pass';
        current.ball.receiverId = ownerId;
      } else {
        current.ball.transition = 'loose';
        current.ball.receiverId = null;
        current.ball.target = { ...current.players[ownerId] };
      }
      if (!ownerId && currentOwnerPosition) {
        current.ball.target = { x: currentOwnerPosition.x, y: currentOwnerPosition.y };
      }

      const destination = value.frames[selectedFrameIndex + 1];
      if (destination?.ball.transition === 'carry') {
        destination.ball.ownerId = ownerId;
        destination.ball.receiverId = ownerId;
      }
      if (destination?.ball.transition === 'pass' || destination?.ball.transition === 'board-pass') {
        const receiver = playmakerPlayerById(destination.ball.receiverId);
        if (!nextOwner || !receiver || receiver.team !== nextOwner.team || receiver.id === ownerId) {
          destination.ball.ownerId = null;
          destination.ball.receiverId = null;
        }
      }
    });
  };

  const receiverOptions = currentFrame.ball.ownerId
    ? PLAYMAKER_ROSTER.filter((player) => {
      const source = playmakerPlayerById(currentFrame.ball.ownerId);
      return player.team === source?.team && player.id !== source.id;
    })
    : [];
  const ballIssue = readiness.report.errors.find((error) => error.startsWith('Ball'));

  return (
    <main className="playmaker-workspace" style={themeVars} data-view-mode={viewMode} data-tutorial="workspace">
      <div className="playmaker-toolbar">
        <div className="playmaker-title-block" data-tutorial="identity">
          <input
            className="playmaker-title-input"
            aria-label="Play title"
            value={draft.title}
            onChange={(event) => commit((value) => { value.title = event.target.value; })}
          />
          <textarea
            className="playmaker-description-input"
            aria-label="Play purpose"
            rows="2"
            value={draft.description}
            onChange={(event) => commit((value) => { value.description = event.target.value; })}
          />
        </div>

        <div className="playmaker-toolbar-actions" role="toolbar" aria-label="Playmaker actions" data-tutorial="actions">
          <button type="button" className="playmaker-icon-button" onClick={() => setLibraryOpen(true)} aria-label="Open play library" title="Library">
            <FolderOpen aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`playmaker-icon-button ${playmakerTutorialOpen ? 'is-active' : ''}`}
            onClick={() => setPlaymakerTutorialOpen(true)}
            aria-label="Open Create tutorial"
            title="Create tutorial"
          >
            <GraduationCap aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button" disabled={!history.past.length} onClick={undo} aria-label="Undo" title="Undo">
            <Undo2 aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button" disabled={!history.future.length} onClick={redo} aria-label="Redo" title="Redo">
            <Redo2 aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button" onClick={saveNow} aria-label="Save locally" title="Save locally">
            <Save aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button" onClick={share} aria-label="Copy share link" title="Copy share link">
            <Share2 aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button" onClick={() => downloadDraft(draft)} aria-label="Export play file" title="Export play file">
            <Download aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button" onClick={() => setAccountOpen(true)} aria-label="Open account and cloud sync" title="Account and cloud sync">
            <UserRound aria-hidden="true" />
          </button>
        </div>

        <div className="playmaker-view-switch" role="group" aria-label="Playmaker view" data-tutorial="preview">
          <button type="button" aria-pressed={viewMode === 'edit'} onClick={() => { setViewMode('edit'); setIsPlaying(false); }}>
            <Box aria-hidden="true" />
            Edit 2D
          </button>
          <button type="button" aria-pressed={viewMode === '3d'} onClick={() => { setViewMode('3d'); setTargetMode(false); }}>
            <span className="playmaker-3d-glyph" aria-hidden="true">3D</span>
            Preview
          </button>
        </div>
      </div>

      <div className="playmaker-body" ref={bodyRef}>
        <section className={`playmaker-stage ${viewMode === '3d' ? 'is-3d' : ''}`} aria-label={viewMode === 'edit' ? '2D play editor' : '3D play preview'}>
          {viewMode === 'edit' ? (
            <div className="playmaker-court-shell" data-tutorial="court">
              <PlaymakerCourt
                ball={isPlaying ? sampled.ball : null}
                frame={editorFrame}
                interactive={!isPlaying}
                nextFrame={nextFrame}
                onMoveBall={moveLooseBall}
                onMovePlayer={movePlayer}
                onPlaceBallTarget={placeTarget}
                onSelectPlayer={setSelectedPlayerId}
                previousFrame={previousFrame}
                sampledPlayers={isPlaying ? sampled.players : null}
                selectedPlayerId={selectedPlayerId}
                targetMode={targetMode}
              />
              {targetMode && <div className="playmaker-target-banner" role="status">Select the ball target on the court</div>}
            </div>
          ) : (
            <>
              <Playmaker3DPreview
                currentMomentIndex={selectedFrameIndex}
                isPlaying={isPlaying}
                moments={draft.frames}
                onMomentChange={goToMoment}
                onPlayingChange={setIsPlaying}
                onRestart={() => restart({ play: false })}
                onSpeedChange={setSpeed}
                onTimeChange={syncPlaybackTime}
                scene={scene}
                speed={speed}
                time={safePlaybackTime}
                workspaceLayout={workspaceLayout}
              />
              <div className="playmaker-preview-caption" aria-live="polite">
                <span>MOMENT {selectedFrameIndex + 1}</span>
                <strong>{sampled.event?.label ?? currentFrame.label}</strong>
              </div>
            </>
          )}
        </section>

        <aside className="playmaker-inspector" aria-label="Moment and player controls">
          <section className="playmaker-inspector-section" data-tutorial="moment">
            <div className="playmaker-section-heading">
              <div>
                <span className="playmaker-eyebrow">MOMENT {selectedFrameIndex + 1}</span>
                <h2>{currentFrame.label}</h2>
              </div>
              <div className="playmaker-heading-tools">
                <PlaymakerContextHelp label="About authored moments">
                  A moment is one complete team shape. Duplicate it, move every player, and use travel time to control the blend into this moment.
                </PlaymakerContextHelp>
                <div className="playmaker-moment-actions">
                  <button type="button" className="playmaker-icon-button" onClick={addMoment} aria-label="Duplicate this moment" title="Duplicate moment">
                    <Plus aria-hidden="true" />
                  </button>
                  <button type="button" className="playmaker-icon-button is-danger" disabled={draft.frames.length <= 2} onClick={deleteMoment} aria-label="Delete this moment" title="Delete moment">
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <label className="playmaker-field">
              <span>Coaching cue</span>
              <input value={currentFrame.label} maxLength="80" onChange={(event) => commit((value) => { value.frames[selectedFrameIndex].label = event.target.value; })} />
            </label>
            {selectedFrameIndex > 0 && (
              <label className="playmaker-field">
                <span>Travel time from prior moment</span>
                <div className="playmaker-number-field">
                  <input
                    type="number"
                    min="0.5"
                    max="8"
                    step="0.1"
                    value={currentFrame.seconds}
                    onChange={(event) => commit((value) => { value.frames[selectedFrameIndex].seconds = Number(event.target.value); })}
                  />
                  <span>sec</span>
                </div>
              </label>
            )}
          </section>

          <section className="playmaker-inspector-section" data-tutorial="player">
            <div className="playmaker-section-heading">
              <div>
                <span className="playmaker-eyebrow">PLAYER</span>
                <h2>{teamLabel(selectedPlayer.team)} · {selectedPlayer.label}</h2>
              </div>
              <PlaymakerContextHelp label="About player intent">
                Place the player at this moment, then select the tactical intent that best explains the route. Repeat for all 12 players.
              </PlaymakerContextHelp>
            </div>
            <div className="playmaker-roster-grid" role="group" aria-label="Select player">
              {PLAYMAKER_ROSTER.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  className={`is-${player.team}`}
                  aria-pressed={selectedPlayerId === player.id}
                  onClick={() => setSelectedPlayerId(player.id)}
                >
                  {player.label}
                </button>
              ))}
            </div>
            <label className="playmaker-field">
              <span>Intent at this moment</span>
              <select
                value={currentFrame.players[selectedPlayerId].action}
                onChange={(event) => commit((value) => { value.frames[selectedFrameIndex].players[selectedPlayerId].action = event.target.value; })}
              >
                {PLAYMAKER_PLAYER_ACTIONS.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
              </select>
            </label>
            <div className="playmaker-position-fields">
              <label className="playmaker-field">
                <span>Width</span>
                <input type="number" min="2" max="98" value={Math.round(currentFrame.players[selectedPlayerId].x)} onChange={(event) => movePlayer(selectedPlayerId, { x: Number(event.target.value) }, { transient: false })} />
              </label>
              <label className="playmaker-field">
                <span>Depth</span>
                <input type="number" min="2" max="98" value={Math.round(currentFrame.players[selectedPlayerId].y)} onChange={(event) => movePlayer(selectedPlayerId, { y: Number(event.target.value) }, { transient: false })} />
              </label>
            </div>
          </section>

          <section className="playmaker-inspector-section playmaker-ball-section" data-tutorial="ball">
            <div className="playmaker-section-heading">
              <div>
                <span className="playmaker-eyebrow">BALL</span>
                <h2>Possession and next decision</h2>
              </div>
              <PlaymakerContextHelp label="About ball decisions">
                Set the carrier now, then define the move into the next moment. A pass is incomplete until its exact receiving teammate is selected.
              </PlaymakerContextHelp>
            </div>
            <label className="playmaker-field">
              <span>Carrier at this moment</span>
              <select
                value={currentFrame.ball.ownerId ?? ''}
                onChange={(event) => assignCurrentBallOwner(event.target.value || null)}
              >
                <option value="">Loose ball</option>
                {PLAYMAKER_ROSTER.map((player) => <option key={player.id} value={player.id}>{teamLabel(player.team)} · {player.label}</option>)}
              </select>
            </label>
            <button type="button" className="playmaker-secondary-button playmaker-give-ball" onClick={() => assignCurrentBallOwner(selectedPlayerId)}>
              Give ball to {selectedPlayer.label}
            </button>
            {!currentFrame.ball.ownerId && (
              <div className="playmaker-loose-ball-controls" aria-label="Loose ball position">
                <strong><Move aria-hidden="true" /> Loose ball position</strong>
                <div className="playmaker-position-fields">
                  <label className="playmaker-field">
                    <span>Ball width</span>
                    <input
                      type="number"
                      min="2"
                      max="98"
                      value={Math.round(currentFrame.ball.target.x)}
                      onChange={(event) => moveLooseBall({ x: Number(event.target.value) }, { transient: false })}
                    />
                  </label>
                  <label className="playmaker-field">
                    <span>Ball depth</span>
                    <input
                      type="number"
                      min="2"
                      max="98"
                      value={Math.round(currentFrame.ball.target.y)}
                      onChange={(event) => moveLooseBall({ y: Number(event.target.value) }, { transient: false })}
                    />
                  </label>
                </div>
              </div>
            )}

            {nextFrame ? (
              <>
                <label className="playmaker-field">
                  <span>Decision into next moment</span>
                  <select value={nextFrame.ball.transition} onChange={(event) => changeTransition(event.target.value)}>
                    {PLAYMAKER_BALL_TRANSITIONS.map((transition) => <option key={transition.id} value={transition.id}>{transition.label}</option>)}
                  </select>
                </label>
                {(nextFrame.ball.transition === 'pass' || nextFrame.ball.transition === 'board-pass') && (
                  <label className="playmaker-field">
                    <span>Receiver</span>
                    <select
                      value={nextFrame.ball.receiverId ?? ''}
                      onChange={(event) => commit((value) => {
                        const receiverId = event.target.value || null;
                        value.frames[selectedFrameIndex + 1].ball.receiverId = receiverId;
                        value.frames[selectedFrameIndex + 1].ball.ownerId = receiverId;
                      })}
                    >
                      <option value="">Select receiver</option>
                      {receiverOptions.map((player) => <option key={player.id} value={player.id}>{player.label}</option>)}
                    </select>
                  </label>
                )}
                {(nextFrame.ball.transition === 'shot' || nextFrame.ball.transition === 'loose') && (
                  <button type="button" className={targetMode ? 'playmaker-target-button is-active' : 'playmaker-target-button'} onClick={() => setTargetMode((value) => !value)}>
                    {targetMode ? 'Cancel target' : 'Place target on court'}
                  </button>
                )}
              </>
            ) : (
              <p className="playmaker-last-moment">End of play</p>
            )}
          </section>

          <div className={`playmaker-readiness ${readiness.valid ? 'is-ready' : ''}`} data-tutorial="readiness">
            <strong>{readiness.valid ? 'Replay ready' : `${readiness.movingCount}/12 players moving`}</strong>
            <span>{readiness.ballValid ? 'Ball path valid' : ballIssue ?? 'Ball decision needs attention'}</span>
          </div>
        </aside>
      </div>

      <footer className="playmaker-timeline" data-tutorial="timeline">
        <div className="playmaker-transport" role="toolbar" aria-label="Play playback">
          <button type="button" className="playmaker-icon-button" onClick={() => restart({ play: false })} aria-label="Start over" title="Start over">
            <SkipBack aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button playmaker-play-button" onClick={togglePlayback} aria-label={isPlaying ? 'Pause play' : 'Play authored play'} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button type="button" className="playmaker-icon-button" disabled={selectedFrameIndex === 0} onClick={() => goToMoment(selectedFrameIndex - 1)} aria-label="Previous moment" title="Previous moment">
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="playmaker-icon-button" disabled={selectedFrameIndex >= draft.frames.length - 1} onClick={() => goToMoment(selectedFrameIndex + 1)} aria-label="Next moment" title="Next moment">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <div className="playmaker-scrubber">
          <input
            type="range"
            min="0"
            max={scene.duration}
            step="0.01"
            value={safePlaybackTime}
            aria-label="Play timeline"
            onChange={(event) => {
              syncPlaybackTime(Number(event.target.value));
              setIsPlaying(false);
              setTargetMode(false);
            }}
          />
          <span>{safePlaybackTime.toFixed(1)} / {scene.duration.toFixed(1)}</span>
        </div>
        <label className="playmaker-speed-control">
          <span>Speed</span>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            <option value="0.25">0.25×</option>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
          </select>
        </label>
        <div className="playmaker-moments" aria-label="Authored moments">
          {draft.frames.map((frame, index) => (
            <button
              key={frame.id}
              type="button"
              aria-pressed={selectedFrameIndex === index}
              onClick={() => goToMoment(index)}
            >
              <span>{index + 1}</span>
              <strong>{frame.label}</strong>
            </button>
          ))}
          <button type="button" className="playmaker-add-moment" onClick={addMoment} aria-label="Add moment">
            <Plus aria-hidden="true" />
          </button>
        </div>
      </footer>

      {notice && <div className="playmaker-toast" role="status">{notice}</div>}
      <PlaymakerLibraryDialog
        drafts={libraryDrafts}
        onClose={() => setLibraryOpen(false)}
        onCreate={(templateId) => openDraft(createPlaymakerDraft(templateId))}
        onDelete={deleteSavedDraft}
        onExport={downloadDraft}
        onImport={importDraft}
        onOpen={openDraft}
        open={libraryOpen}
      />
      <PlaymakerAccountDialog
        draft={draft}
        onClose={() => setAccountOpen(false)}
        onOpenDraft={openDraft}
        open={accountOpen}
      />
      <PlaymakerTutorial
        open={playmakerTutorialOpen}
        onClose={() => setPlaymakerTutorialOpen(false)}
        colors={{
          surface: t.sf,
          panel: t.cb,
          border: t.bd,
          text: t.tx,
          muted: t.tm,
          accent: t.ac,
          accentBackground: t.ab,
        }}
      />
    </main>
  );
}
