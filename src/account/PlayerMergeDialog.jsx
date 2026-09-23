import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GitMerge, LoaderCircle, Search, ShieldCheck, X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { mergeFieldOptions, mergePreviewCountItems, mergePreviewMessages, playerMergeTargets } from './playerMergeModel';

const positionLabels = { C: 'Center (C)', W: 'Winger (W)', D: 'Defence (D)', G: 'Goalie (G)' };
const present = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const fieldLabel = (value, field) => !present(value) ? 'Unassigned' : field === 'jerseyNumber' ? `#${value}` : positionLabels[value] || value;

function PlayerIdentityCard({ player, retained = false }) {
  return <article className="player-merge-identity" data-retained={retained}>
    <span>{retained ? <Check aria-hidden="true" /> : <GitMerge aria-hidden="true" />}{retained ? 'Player that remains' : 'Player being merged'}</span>
    <h4>{player.displayName}</h4>
    <p>{present(player.jerseyNumber) ? `#${player.jerseyNumber}` : 'No number'} · {positionLabels[player.position] || player.position || 'No position'}</p>
    {(player.teams || player.seasons) && <small>{[player.teams, player.seasons].filter(Boolean).join(' · ')}</small>}
    <strong>{retained ? 'Keeps this name and profile' : 'Combined into the retained player'}</strong>
  </article>;
}

export function PlayerMergeReview({ preview, number, position, onNumberChange, onPositionChange, disabled = false }) {
  const blockers = mergePreviewMessages(preview.blockers);
  const warnings = mergePreviewMessages(preview.warnings);
  return <>
    <div className="player-merge-direction">
      <PlayerIdentityCard player={preview.source} />
      <ArrowRight aria-hidden="true" />
      <PlayerIdentityCard player={preview.target} retained />
    </div>
    <div className="player-merge-outcome">
      <ShieldCheck aria-hidden="true" />
      <p><strong>{preview.target.displayName} will be the single player shown.</strong> Statistics, season history, account links, and original league records are kept together. Old profile links lead to this player.</p>
    </div>
    <dl className="player-merge-counts" aria-label="Combined information">{mergePreviewCountItems(preview.counts).map(({ key, label, count }) => <div key={key}><dt>{label}</dt><dd>{count}</dd></div>)}</dl>
    <fieldset className="player-merge-fields" disabled={disabled}>
      <legend>Details on the combined profile</legend>
      <p>The remaining player’s assigned details are kept by default. Missing details are filled from the other player. Historical roster entries stay intact.</p>
      {[
        ['jerseyNumber', 'Player number', number, onNumberChange],
        ['position', 'Primary position', position, onPositionChange],
      ].map(([field, label, value, onChange]) => <label key={field}><span>{label}{preview.conflicts?.[field] && <small>Different values — choose which to keep</small>}</span>
        <select aria-label={`${label} after merge`} value={value} onChange={(event) => onChange(event.target.value)}>{mergeFieldOptions(preview.source, preview.target, field).map((option) => <option key={option || 'unassigned'} value={option}>{fieldLabel(option, field)}</option>)}</select>
        {preview.conflicts?.[field] && <small>{preview.target.displayName}: {fieldLabel(preview.target[field], field)}<br />{preview.source.displayName}: {fieldLabel(preview.source[field], field)}</small>}
      </label>)}
    </fieldset>
    {warnings.length > 0 && <div className="player-merge-warning" role="status">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    {blockers.length > 0 && <div className="player-merge-warning" data-blocked="true" role="alert"><strong>These players cannot be merged yet</strong><ul>{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
  </>;
}

export default function PlayerMergeDialog({ source, rows, onPreview, onMerge, onClose }) {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [number, setNumber] = useState('');
  const [position, setPosition] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const searchRef = useRef(null);
  const previewHeadingRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const close = () => { if (!requestInFlightRef.current) onClose(); };
  const dialogRef = useDialogFocus({ active: true, initialFocusRef: searchRef, onClose: close });
  const targets = playerMergeTargets(rows, source, query);
  const blockers = mergePreviewMessages(preview?.blockers);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [dialogRef]);

  useEffect(() => {
    if (preview) previewHeadingRef.current?.focus({ preventScroll: true });
  }, [preview]);

  const loadPreview = async (player) => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setBusy(true); setError(''); setTarget(player); setConfirmed(false); setNeedsRefresh(false);
    try {
      const response = await onPreview(source.id, player.id);
      const result = response.preview || response;
      if (!result.source?.id || !result.target?.id || !result.previewToken) throw new Error('The merge preview could not be verified. Refresh and try again.');
      setPreview(result);
      setNumber(present(result.defaults?.jerseyNumber) ? String(result.defaults.jerseyNumber) : '');
      setPosition(result.defaults?.position || '');
    } catch (requestError) { setError(requestError.message || 'The merge preview could not be loaded.'); setNeedsRefresh(true); }
    finally { requestInFlightRef.current = false; setBusy(false); }
  };

  const merge = async (event) => {
    event.preventDefault();
    if (requestInFlightRef.current || !confirmed || !preview || blockers.length || needsRefresh) return;
    requestInFlightRef.current = true;
    setBusy(true); setError('');
    try {
      await onMerge({ sourcePlayerId: source.id, targetPlayerId: target.id, previewToken: preview.previewToken, jerseyNumber: number || null, position: position || null }, preview);
      requestInFlightRef.current = false;
      onClose();
    } catch (requestError) {
      setError(requestError.message || 'The merge could not be completed. Refresh the preview before trying again.');
      setConfirmed(false); setNeedsRefresh(true);
    } finally { requestInFlightRef.current = false; setBusy(false); }
  };

  return <dialog ref={dialogRef} className="player-merge-modal" role="dialog" aria-modal="true" aria-labelledby="player-merge-title" aria-describedby="player-merge-description" tabIndex={-1} onCancel={(event) => { event.preventDefault(); close(); }}>
    <form onSubmit={merge}>
      <header className="player-merge-header"><div><span className="player-admin-kicker">PLAYER IDENTITY · {preview ? '2 / 2' : '1 / 2'}</span><h3 id="player-merge-title">{preview ? 'Confirm player merge' : 'Merge to…'}</h3><p id="player-merge-description">{preview ? 'Check the direction and details before combining these players.' : <>Choose the correctly named player who should keep <strong>{source.displayName}’s</strong> statistics and history.</>}</p></div><button type="button" aria-label="Close player merge" disabled={busy} onClick={close}><X aria-hidden="true" /></button></header>
      <div className="player-merge-content" aria-busy={busy}>
        {error && <p className="player-admin-notice" data-tone="error" role="alert">{error}</p>}
        {!preview ? <>
          <div className="player-merge-source"><GitMerge aria-hidden="true" /><span>Player being merged <strong>{source.displayName}</strong></span></div>
          <label className="player-admin-search"><Search aria-hidden="true" /><span className="sr-only">Search for the player that remains</span><input ref={searchRef} type="search" value={query} disabled={busy} onChange={(event) => setQuery(event.target.value)} placeholder="Search the correct name, number, team, or source ID…" /></label>
          <p className="player-merge-search-help">{targets.length} possible target{targets.length === 1 ? '' : 's'}. Similar names appear first; select only if they are the same person.</p>
          <ul className="player-merge-targets" aria-label="Choose the player that remains">{targets.map((player) => <li key={player.id}><button type="button" disabled={busy} onClick={() => loadPreview(player)} aria-label={`Merge to ${player.displayName}`}><span><strong>{player.displayName}</strong><small>{[present(player.jerseyNumber) ? `#${player.jerseyNumber}` : 'No number', positionLabels[player.position] || player.position || 'No position', player.teams, player.seasons].filter(Boolean).join(' · ')}</small><small>{player.externalId || player.id}</small></span>{player.suggested && <em>Similar name</em>}{busy && target?.id === player.id ? <LoaderCircle className="player-admin-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}</button></li>)}</ul>
          {!targets.length && <p className="player-merge-empty">No other players match. Try a different name, number, or team.</p>}
        </> : <>
          <h4 className="sr-only" ref={previewHeadingRef} tabIndex={-1}>Review merge from {preview.source.displayName} to {preview.target.displayName}</h4>
          <PlayerMergeReview preview={preview} number={number} position={position} onNumberChange={(value) => { setNumber(value); setConfirmed(false); }} onPositionChange={(value) => { setPosition(value); setConfirmed(false); }} disabled={busy} />
          {!blockers.length && <label className="player-merge-confirm"><input type="checkbox" checked={confirmed} disabled={busy || needsRefresh} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm these are the same person. <strong>{preview.target.displayName}</strong> will remain, and <strong>{preview.source.displayName}</strong> will no longer appear as a separate player.</span></label>}
          <p className="player-merge-audit-note">This action is recorded for the admin team. Review carefully: there is no self-service undo.</p>
        </>}
      </div>
      <footer className="player-merge-footer">
        {preview ? <button type="button" disabled={busy} onClick={() => { setPreview(null); setTarget(null); setConfirmed(false); setError(''); setNeedsRefresh(false); requestAnimationFrame(() => searchRef.current?.focus()); }}><ArrowLeft aria-hidden="true" /> Choose another player</button> : <button type="button" disabled={busy} onClick={close}>Cancel</button>}
        {needsRefresh && target && <button type="button" disabled={busy} onClick={() => loadPreview(target)}>Refresh preview</button>}
        {preview && <button type="submit" className="player-merge-submit" disabled={busy || !confirmed || Boolean(blockers.length) || needsRefresh}>{busy ? <LoaderCircle className="player-admin-spin" aria-hidden="true" /> : <GitMerge aria-hidden="true" />}{busy ? 'Combining players…' : `Merge into ${preview.target.displayName}`}</button>}
      </footer>
    </form>
  </dialog>;
}
