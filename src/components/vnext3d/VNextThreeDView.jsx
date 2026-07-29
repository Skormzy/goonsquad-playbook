import { lazy, Suspense } from 'react';
import { useApp } from '../../context/AppContext';
import { VNEXT_3D_GATES, VNEXT_3D_RELEASE } from '../../vnext3d/productionReadiness';

const TacticalReplayPreview = import.meta.env.DEV
  ? lazy(() => import('../../tactical3d/TacticalReplayPreview'))
  : null;

const STATUS_LABELS = Object.freeze({
  accepted: 'ACCEPTED',
  review: 'IN REVIEW',
  pending: 'PENDING',
  locked: 'LOCKED',
});

export default function VNextThreeDView() {
  const {
    currentPlay,
    currentReplayScene,
    currentPhase,
    playbackTime,
    selectedPosition,
    setActiveView,
  } = useApp();

  if (import.meta.env.DEV && TacticalReplayPreview) {
    return (
      <Suspense fallback={<main className="vnext3d-preview-empty"><strong>Loading strategy replay...</strong></main>}>
        <TacticalReplayPreview />
      </Suspense>
    );
  }

  return (
    <main
      className="vnext3d-gate-view"
      data-testid="vnext-3d-production-gate"
      data-production-3d-ready={VNEXT_3D_RELEASE.acceptedForPublicRuntime}
    >
      <section className="vnext3d-gate-stage" aria-labelledby="vnext3d-gate-title">
        <div className="vnext3d-gate-content">
          <div className="vnext3d-gate-message">
            <div className="vnext3d-kicker">3D RUNTIME REVIEW</div>
            <h1 id="vnext3d-gate-title">Production replay gate</h1>
            <p>
              Accepted field players and goalies are now running in a private 12-player review scene.
              Public 3D stays locked while court integration, grounding, and cross-device visual review finish.
            </p>
            <button
              type="button"
              className="vnext3d-return-button"
              onClick={() => setActiveView('playbook')}
            >
              Open 2D
            </button>
          </div>

          <div className="vnext3d-gate-ledger" aria-label="3D production gates">
            {VNEXT_3D_GATES.map((gate, index) => (
              <div className="vnext3d-gate-row" key={gate.id} data-status={gate.status}>
                <span className="vnext3d-gate-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="vnext3d-gate-label">{gate.label}</span>
                <strong>{gate.statusLabel ?? STATUS_LABELS[gate.status]}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="vnext3d-session-strip" aria-label="Preserved replay state">
        <div>
          <span>{currentReplayScene?.kind === 'strategy' ? 'STRATEGY' : 'PLAY'}</span>
          <strong>{currentReplayScene?.title ?? currentPlay?.n ?? '3D Replay'}</strong>
        </div>
        <div>
          <span>PHASE</span>
          <strong>{currentPhase + 1}</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong>{playbackTime.toFixed(1)}s</strong>
        </div>
        <div>
          <span>FOCUS</span>
          <strong>{selectedPosition}</strong>
        </div>
      </section>
    </main>
  );
}
