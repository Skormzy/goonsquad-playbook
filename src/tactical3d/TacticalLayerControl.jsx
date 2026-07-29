import { useEffect, useRef, useState } from 'react';
import {
  Layers3,
  MoveRight,
  Route,
  ShieldCheck,
  Target,
  X,
} from 'lucide-react';

const LAYER_OPTIONS = Object.freeze([
  {
    id: 'matchups',
    label: 'Coverage',
    detail: 'Who each player owns',
    icon: <ShieldCheck aria-hidden="true" />,
  },
  {
    id: 'routes',
    label: 'Routes',
    detail: 'Where our shape moves',
    icon: <Route aria-hidden="true" />,
  },
  {
    id: 'passing',
    label: 'Next pass',
    detail: 'Upcoming authored ball lane',
    icon: <MoveRight aria-hidden="true" />,
  },
  {
    id: 'targets',
    label: 'Targets',
    detail: "Each player's next position",
    icon: <Target aria-hidden="true" />,
  },
]);

export default function TacticalLayerControl({ layers, onChange }) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef(null);
  const activeCount = LAYER_OPTIONS.filter(({ id }) => layers[id]).length;

  useEffect(() => {
    if (!open) return undefined;
    const closeFromOutside = (event) => {
      if (!controlRef.current?.contains(event.target)) setOpen(false);
    };
    const closeFromEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [open]);

  return (
    <div ref={controlRef} className="vnext3d-layer-control">
      <button
        type="button"
        className={activeCount > 0 ? 'is-active' : ''}
        aria-label={`Tactical layers${activeCount ? `, ${activeCount} active` : ''}`}
        aria-expanded={open}
        aria-controls="vnext3d-tactical-layer-options"
        onClick={() => setOpen((value) => !value)}
        title="Tactical layers"
      >
        <Layers3 aria-hidden="true" />
        {activeCount > 0 && <span className="vnext3d-layer-count" aria-hidden="true">{activeCount}</span>}
      </button>

      {open && (
        <div
          id="vnext3d-tactical-layer-options"
          className="vnext3d-layer-popover"
          role="group"
          aria-label="Tactical layer options"
        >
          <div className="vnext3d-layer-popover-heading">
            <div>
              <span>TACTICAL LAYERS</span>
              <strong>Show coaching detail</strong>
            </div>
            <button type="button" aria-label="Close tactical layers" onClick={() => setOpen(false)}>
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="vnext3d-layer-options">
            {LAYER_OPTIONS.map(({ id, label, detail, icon }) => (
              <label key={id} className="vnext3d-layer-option">
                <input
                  type="checkbox"
                  checked={Boolean(layers[id])}
                  onChange={(event) => onChange(id, event.target.checked)}
                />
                {icon}
                <span className="vnext3d-layer-option-copy">
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <span className="vnext3d-layer-switch" aria-hidden="true"><i /></span>
              </label>
            ))}
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              className="vnext3d-layer-clear"
              onClick={() => LAYER_OPTIONS.forEach(({ id }) => onChange(id, false))}
            >
              Clear layers
            </button>
          )}
        </div>
      )}
    </div>
  );
}
