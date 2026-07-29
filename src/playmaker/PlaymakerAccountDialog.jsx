import { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useAccount } from '../account/AccountContext';
import {
  createCloudPlaymakerShareUrl,
  deletePlaymakerDraftFromCloud,
  loadPlaymakerDraftRecordsFromCloud,
  playmakerCloudConfigured,
  savePlaymakerDraftToCloud,
  updatePlaymakerDraftVisibility,
} from './playmakerCloud';
import {
  currentPlaymakerStorageOwnerId,
  inspectGuestPlaymakerMigration,
  isPlaymakerDraftOwnedBy,
  migrateGuestPlaymakerDraftsToAccount,
  setPlaymakerStorageOwner,
} from './playmakerStorage';

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

export default function PlaymakerAccountDialog({ draft, onClose, onOpenDraft, open }) {
  const account = useAccount();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [cloudDrafts, setCloudDrafts] = useState([]);
  const [guestMigration, setGuestMigration] = useState({ alreadyClaimed: false, draftCount: 0 });
  const storageOwnerRef = useRef(currentPlaymakerStorageOwnerId());

  useEffect(() => {
    if (account.busy) return;
    const nextOwnerId = account.user?.id ?? null;
    const previousOwnerId = storageOwnerRef.current;
    setPlaymakerStorageOwner(nextOwnerId);
    storageOwnerRef.current = nextOwnerId;

    if (previousOwnerId !== nextOwnerId && typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [account.busy, account.user?.id]);

  useEffect(() => {
    if (!open || !account.user) return;
    setGuestMigration(inspectGuestPlaymakerMigration(account.user.id));
    loadPlaymakerDraftRecordsFromCloud()
      .then(setCloudDrafts)
      .catch((error) => setStatus(error.message));
  }, [account.user, open]);

  if (!open) return null;

  const run = async (operation, successMessage) => {
    setBusy(true);
    setStatus('');
    try {
      await operation();
      setStatus(successMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Cloud request failed.');
    } finally {
      setBusy(false);
    }
  };

  const refreshCloud = () => run(async () => {
    setCloudDrafts(await loadPlaymakerDraftRecordsFromCloud());
  }, 'Cloud library refreshed.');

  const publish = (record) => run(async () => {
    await updatePlaymakerDraftVisibility(record.id, record.visibility === 'public' ? 'private' : 'public');
    setCloudDrafts(await loadPlaymakerDraftRecordsFromCloud());
  }, record.visibility === 'public' ? 'Play is private.' : 'Share link is live.');

  const copyShareLink = (record) => run(async () => {
    const shareUrl = createCloudPlaymakerShareUrl(window.location.href, record.shareSlug);
    await copyText(shareUrl);
  }, 'Share link copied.');

  const removeCloudDraft = (record) => run(async () => {
    await deletePlaymakerDraftFromCloud(record.id);
    setCloudDrafts(await loadPlaymakerDraftRecordsFromCloud());
  }, 'Cloud play removed.');

  const claimGuestDrafts = () => run(async () => {
    const result = migrateGuestPlaymakerDraftsToAccount(account.user.id);
    setGuestMigration(inspectGuestPlaymakerMigration(account.user.id));
    if (result.activeDraft) onOpenDraft(result.activeDraft);
  }, 'Guest plays moved into your account workspace.');

  const currentDraftOwned = Boolean(
    account.user && isPlaymakerDraftOwnedBy(draft.id, account.user.id),
  );

  return (
    <div className="playmaker-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="playmaker-modal playmaker-account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playmaker-account-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="playmaker-modal-header">
          <div>
            <span className="playmaker-eyebrow">ACCOUNT</span>
            <h2 id="playmaker-account-title">Your created plays</h2>
          </div>
          <button type="button" className="playmaker-icon-button" onClick={onClose} aria-label="Close account" title="Close">
            <X aria-hidden="true" />
          </button>
        </header>

        {!playmakerCloudConfigured && (
          <div className="playmaker-cloud-unavailable">
            <CloudOff aria-hidden="true" />
            <div>
              <strong>Local workspace active</strong>
              <p>Cloud accounts are not connected in this deployment. Local saves, play files, and share links remain available.</p>
            </div>
          </div>
        )}

        {playmakerCloudConfigured && !account.user && (
          <div className="playmaker-cloud-unavailable">
            <Cloud aria-hidden="true" />
            <div>
              <strong>Sign in from the team account button</strong>
              <p>Your local drafts are safe. Sign in from the header to sync, update, and publish them across devices.</p>
            </div>
          </div>
        )}

        {playmakerCloudConfigured && account.user && (
          <div className="playmaker-cloud-session">
            <div className="playmaker-cloud-user">
              <Cloud aria-hidden="true" />
              <div>
                <strong>{account.displayName}</strong>
                <span>Cloud sync connected</span>
              </div>
            </div>
            <div className="playmaker-cloud-actions">
              <button type="button" disabled={busy || !currentDraftOwned} onClick={() => run(
                async () => {
                  await savePlaymakerDraftToCloud(draft);
                  setCloudDrafts(await loadPlaymakerDraftRecordsFromCloud());
                },
                'Current play updated in your cloud library.',
              )}>
                <Save aria-hidden="true" />
                Sync current play
              </button>
              <button type="button" className="playmaker-icon-button" disabled={busy} onClick={refreshCloud} aria-label="Refresh cloud library" title="Refresh">
                <RefreshCw aria-hidden="true" />
              </button>
            </div>

            {!guestMigration.alreadyClaimed && guestMigration.draftCount > 0 && (
              <div className="playmaker-cloud-unavailable">
                <Save aria-hidden="true" />
                <div>
                  <strong>{guestMigration.draftCount} guest {guestMigration.draftCount === 1 ? 'play is' : 'plays are'} waiting</strong>
                  <p>Move them once into this account before syncing. They will no longer appear for other people using this browser.</p>
                  <button type="button" disabled={busy} onClick={claimGuestDrafts}>
                    Move guest plays to my account
                  </button>
                </div>
              </div>
            )}

            {!currentDraftOwned && (
              <p className="playmaker-modal-status">
                Sync is locked until this play is saved in your account workspace.
              </p>
            )}

            <div className="playmaker-cloud-library" aria-label="Cloud play library">
              {cloudDrafts.length === 0 && <p>No cloud plays yet.</p>}
              {cloudDrafts.map((record) => (
                <article key={record.id} className="playmaker-cloud-item">
                  <button type="button" className="playmaker-cloud-open" onClick={() => onOpenDraft(record.draft)}>
                    <strong>{record.title}</strong>
                    <span>{record.draft.frames.length} moments · version {record.revision}</span>
                  </button>
                  <div className="playmaker-cloud-item-actions">
                    <button type="button" className="playmaker-icon-button" onClick={() => publish(record)} aria-label={record.visibility === 'public' ? `Make ${record.title} private` : `Publish ${record.title}`} title={record.visibility === 'public' ? 'Make private' : 'Publish'}>
                      {record.visibility === 'public' ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                    {record.visibility === 'public' && (
                      <button type="button" className="playmaker-icon-button" onClick={() => copyShareLink(record)} aria-label={`Copy share link for ${record.title}`} title="Copy public link">
                        <Copy aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" className="playmaker-icon-button is-danger" onClick={() => removeCloudDraft(record)} aria-label={`Delete ${record.title} from cloud`} title="Delete from cloud">
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {status && <p className="playmaker-modal-status" role="status">{status}</p>}
      </section>
    </div>
  );
}
