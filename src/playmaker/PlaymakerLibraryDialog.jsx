import { useRef } from 'react';
import {
  Download,
  FileUp,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { PLAYMAKER_TEMPLATES } from './playmakerModel';

function formatUpdatedAt(value) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Saved locally';
  }
}

export default function PlaymakerLibraryDialog({
  drafts,
  onClose,
  onCreate,
  onDelete,
  onExport,
  onImport,
  onOpen,
  open,
}) {
  const fileInputRef = useRef(null);
  if (!open) return null;

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await onImport(file);
  };

  return (
    <div className="playmaker-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="playmaker-modal playmaker-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playmaker-library-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="playmaker-modal-header">
          <div>
            <span className="playmaker-eyebrow">PLAYMAKER</span>
            <h2 id="playmaker-library-title">Play library</h2>
          </div>
          <button type="button" className="playmaker-icon-button" onClick={onClose} aria-label="Close library" title="Close">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="playmaker-library-actions">
          <div className="playmaker-template-row" aria-label="Create a play from a starting shape">
            {PLAYMAKER_TEMPLATES.map((template) => (
              <button key={template.id} type="button" onClick={() => onCreate(template.id)}>
                <Plus aria-hidden="true" />
                {template.label}
              </button>
            ))}
          </div>
          <button type="button" className="playmaker-secondary-button" onClick={() => fileInputRef.current?.click()}>
            <FileUp aria-hidden="true" />
            Import play
          </button>
          <input
            ref={fileInputRef}
            className="playmaker-visually-hidden"
            type="file"
            accept=".json,.gsplay.json,application/json"
            onChange={importFile}
          />
        </div>

        <div className="playmaker-library-list">
          {drafts.length === 0 && (
            <div className="playmaker-empty-state">
              <FolderOpen aria-hidden="true" />
              <strong>No saved plays yet</strong>
            </div>
          )}
          {drafts.map((draft) => (
            <article key={draft.id} className="playmaker-library-item">
              <button type="button" className="playmaker-library-open" onClick={() => onOpen(draft)}>
                <strong>{draft.title}</strong>
                <span>{draft.frames.length} moments · {formatUpdatedAt(draft.updatedAt)}</span>
              </button>
              <div className="playmaker-library-item-actions">
                <button type="button" className="playmaker-icon-button" onClick={() => onExport(draft)} aria-label={`Export ${draft.title}`} title="Export">
                  <Download aria-hidden="true" />
                </button>
                <button type="button" className="playmaker-icon-button is-danger" onClick={() => onDelete(draft.id)} aria-label={`Delete ${draft.title}`} title="Delete">
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
