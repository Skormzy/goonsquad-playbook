import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Check, Columns3, Download, Hash, LoaderCircle, Pencil, RefreshCcw, Search, Users, X } from 'lucide-react';
import { useAccount } from './AccountContext';
import { loadManagedAccounts, updateManagedPlayerNumber, updateManagedPlayerPosition } from './accountAdmin';
import { buildPlayerAdminRows, DEFAULT_PLAYER_COLUMNS, hasPlayerNumber, PLAYER_ADMIN_COLUMNS, playerAdminCsv, selectPlayerAdminRows } from './playerAdminModel';
import './playerAdmin.css';

const POSITION_OPTIONS = [
  { value: 'C', label: 'Center (C)' },
  { value: 'W', label: 'Winger (W)' },
  { value: 'D', label: 'Defence (D)' },
  { value: 'G', label: 'Goalie (G)' },
];

function downloadRows(rows, columns) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', playerAdminCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'goonsquad-players.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PlayerAdminDirectory({ snapshot = {}, loading = false, working = false, error = '', status = '', onRefresh, onSaveNumber, onSavePosition, onClose, onOpenMembers, onOpenPlayer }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [quickFilter, setQuickFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'displayName', direction: 'asc' });
  const [columnKeys, setColumnKeys] = useState(DEFAULT_PLAYER_COLUMNS);
  const [editor, setEditor] = useState(null);
  const [openingId, setOpeningId] = useState('');
  const [navigationError, setNavigationError] = useState('');
  const rows = useMemo(() => buildPlayerAdminRows(snapshot), [snapshot]);
  const visibleRows = useMemo(() => selectPlayerAdminRows(rows, { query, filters, quickFilter, sort }), [rows, query, filters, quickFilter, sort]);
  const columns = PLAYER_ADMIN_COLUMNS.filter(({ key }) => columnKeys.includes(key));
  const columnOptions = { rosterStatus: ['Active', 'Inactive'], linkStatus: ['Linked', 'Pending', 'Unlinked'] };
  const filterCount = Object.values(filters).filter((value) => value.trim()).length;
  const unnumbered = rows.filter((row) => !hasPlayerNumber(row.jerseyNumber)).length;
  const shared = rows.filter((row) => row.sharedNumber).length;
  const busy = loading || working || Boolean(openingId);
  const openPlayer = async (row) => {
    setOpeningId(row.id); setNavigationError('');
    try { await onOpenPlayer(row); }
    catch (requestError) { setNavigationError(requestError.message || 'The player profile could not be opened. Please try again.'); }
    finally { setOpeningId(''); }
  };
  const resetFilters = () => { setQuery(''); setFilters({}); setQuickFilter('all'); };
  const changeSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const editorValueValid = editor?.kind === 'position'
    ? editor.value === '' || POSITION_OPTIONS.some(({ value }) => value === editor.value)
    : Boolean(editor && /^\d{0,3}$/.test(editor.value.trim()));
  const saveEditor = async (event) => {
    event.preventDefault();
    if (!editor || busy || !editorValueValid) return;
    const save = editor.kind === 'position' ? onSavePosition : onSaveNumber;
    if (await save(editor.id, editor.value.trim() || null)) setEditor(null);
  };

  return (
    <section className="player-admin" aria-labelledby="player-admin-title">
      <header className="player-admin-header">
        <div>
          <button type="button" className="player-admin-back" onClick={onClose} disabled={working}><ArrowLeft aria-hidden="true" /> Account</button>
          <span className="player-admin-kicker">SQUAD OPERATIONS</span>
          <h2 id="player-admin-title">Player administration</h2>
          <p>Your roster, numbers, positions, and account links in one place.</p>
        </div>
        <div className="player-admin-actions">
          <button type="button" onClick={onOpenMembers} disabled={working}><Users aria-hidden="true" /> Manage members</button>
          <button type="button" onClick={onRefresh} disabled={busy || Boolean(editor)}><RefreshCcw className={loading ? 'player-admin-spin' : ''} aria-hidden="true" /> Refresh</button>
        </div>
      </header>

      <div className="player-admin-summary" aria-label="Roster views">
        {[
          ['all', rows.length, 'All players'],
          ['active', rows.filter((row) => row.active).length, 'Active players'],
          ['unnumbered', unnumbered, 'Without a number'],
          ['shared', shared, 'Sharing a number'],
        ].map(([key, count, label]) => <button key={key} type="button" aria-pressed={quickFilter === key} onClick={() => setQuickFilter(key)}><strong>{loading && !rows.length ? '—' : count}</strong><span>{label}</span></button>)}
      </div>

      <div className="player-admin-toolbar">
        <label className="player-admin-search"><Search aria-hidden="true" /><span className="sr-only">Search all player information</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search names, numbers, teams, emails…" /></label>
        <details className="player-admin-columns">
          <summary><Columns3 aria-hidden="true" /> Columns <span>{columns.length}</span></summary>
          <div>{PLAYER_ADMIN_COLUMNS.map(({ key, label }) => <label key={key}><input type="checkbox" checked={columnKeys.includes(key)} disabled={key === 'displayName' || key === 'jerseyNumber'} onChange={(event) => setColumnKeys((current) => event.target.checked ? [...current, key] : current.filter((value) => value !== key))} />{label}{filters[key]?.trim() && <small>Filtered</small>}</label>)}</div>
        </details>
        <button type="button" onClick={() => downloadRows(visibleRows, columns)} disabled={!visibleRows.length || busy}><Download aria-hidden="true" /> Export CSV</button>
      </div>

      <div className="player-admin-results" aria-live="polite">
        <span><strong>{visibleRows.length}</strong> of {rows.length} players{filterCount > 0 ? ` · ${filterCount} column filter${filterCount === 1 ? '' : 's'}` : ''}</span>
        {(query || filterCount > 0 || quickFilter !== 'all') && <button type="button" onClick={resetFilters}><X aria-hidden="true" /> Clear filters</button>}
        <small>Click a heading to sort. Filter beneath any heading.</small>
      </div>
      {error && <p className="player-admin-notice" data-tone="error" role="alert">{error}</p>}
      {navigationError && <p className="player-admin-notice" data-tone="error" role="alert">{navigationError}</p>}
      {status && <p className="player-admin-notice" role="status">{status}</p>}

      {editor && <form className="player-admin-number-editor" onSubmit={saveEditor} data-editor={editor.kind}>
        {editor.kind === 'position' ? <Users aria-hidden="true" /> : <Hash aria-hidden="true" />}
        <div><strong>{editor.name}</strong><small>{editor.kind === 'position' ? 'Choose a primary position, or Unassigned to clear it.' : 'Assign 0–999. Leave blank to remove the number.'}</small></div>
        {editor.kind === 'position' ? <label><span>Primary position</span><select autoFocus aria-label={`Position for ${editor.name}`} value={editor.value} disabled={working} onChange={(event) => setEditor({ ...editor, value: event.target.value })}><option value="">Unassigned</option>{editor.original && !POSITION_OPTIONS.some(({ value }) => value === editor.original) && <option value={editor.original} disabled>{editor.original} (current)</option>}{POSITION_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
          : <label><span>Player number</span><input autoFocus aria-label={`Number for ${editor.name}`} type="text" inputMode="numeric" maxLength={3} pattern="[0-9]{0,3}" value={editor.value} disabled={working} onChange={(event) => setEditor({ ...editor, value: event.target.value })} /></label>}
        <button type="submit" className="player-admin-primary" disabled={busy || !editorValueValid || editor.value.trim() === editor.original}>{working ? <LoaderCircle className="player-admin-spin" aria-hidden="true" /> : <Check aria-hidden="true" />} Save {editor.kind === 'position' ? 'position' : 'number'}</button>
        <button type="button" disabled={working} onClick={() => setEditor(null)}>Cancel</button>
        {editor.kind === 'number' && rows.some((row) => row.identityId !== editor.identityId && row.active && hasPlayerNumber(row.jerseyNumber) && hasPlayerNumber(editor.value) && Number(row.jerseyNumber) === Number(editor.value)) && <p role="status">Another active player has this number. Shared numbers are allowed; check the roster before saving.</p>}
      </form>}

      <div className="player-admin-table-scroll" role="region" aria-label="Player directory table, scroll horizontally for more columns" tabIndex={0} aria-busy={loading}>
        <table className="player-admin-table">
          <caption className="sr-only">Player directory. Each column can be sorted and filtered. Edit a number or position to assign it to a player.</caption>
          <thead>
            <tr>{columns.map(({ key, label }) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => changeSort(key)} aria-label={`Sort by ${label}`}><span>{label}</span>{sort.key === key ? sort.direction === 'asc' ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" /> : <ArrowUpDown aria-hidden="true" />}</button>{columnOptions[key] ? <select aria-label={`Filter ${label}`} value={filters[key] || ''} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}><option value="">All {label.toLowerCase()}</option>{columnOptions[key].map((value) => <option key={value}>{value}</option>)}</select> : <input type="search" aria-label={`Filter ${label}`} placeholder={key === 'jerseyNumber' ? '# or unassigned' : `Filter ${label.toLowerCase()}`} value={filters[key] || ''} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })} />}</th>)}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => <tr key={row.id} data-editing={editor?.id === row.id}>{columns.map(({ key }) => <td key={key}>
              {key === 'displayName' ? <button type="button" className="player-admin-name" onClick={() => openPlayer(row)} disabled={busy}>{openingId === row.id && <LoaderCircle className="player-admin-spin" aria-hidden="true" />}{row.displayName}</button>
                : key === 'jerseyNumber' ? <button type="button" className="player-admin-number" aria-label={`Edit number for ${row.displayName}`} disabled={busy} onClick={() => { setEditor({ kind: 'number', id: row.id, identityId: row.identityId, name: row.displayName, value: row.jerseyNumber, original: row.jerseyNumber }); }}><strong>{hasPlayerNumber(row.jerseyNumber) ? `#${row.jerseyNumber}` : 'Assign'}</strong><Pencil aria-hidden="true" />{row.sharedNumber && <small>Shared</small>}</button>
                  : key === 'position' ? <button type="button" className="player-admin-number" aria-label={`Edit position for ${row.displayName}`} disabled={busy} onClick={() => setEditor({ kind: 'position', id: row.id, name: row.displayName, value: row.position || '', original: row.position || '' })}><strong>{row.position || 'Assign'}</strong><Pencil aria-hidden="true" /></button>
                  : key === 'rosterStatus' || key === 'linkStatus' ? <span className="player-admin-badge" data-positive={row[key] === 'Active' || row[key] === 'Linked'}>{row[key]}</span>
                    : row[key] || <span className="player-admin-empty-value">—</span>}
            </td>)}</tr>)}
            {!visibleRows.length && <tr><td colSpan={columns.length} className="player-admin-empty">{loading ? <><LoaderCircle className="player-admin-spin" aria-hidden="true" /> Loading player information…</> : error && !rows.length ? 'Player information could not be loaded. Refresh to try again.' : rows.length ? <>No players match these filters. <button type="button" onClick={resetFilters}>Clear filters</button></> : 'No player records yet. Add players through the stats roster manager.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="player-admin-footnote">Numbers and positions appear on player statistics and individual profiles. Historical roster details stay in the season records. “Sharing a number” counts active player records.</p>
    </section>
  );
}

function AuthorizedPlayerAdmin(props) {
  const [snapshot, setSnapshot] = useState({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const refresh = async () => {
    setLoading(true); setError(''); setStatus('');
    try { setSnapshot(await loadManagedAccounts()); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    loadManagedAccounts().then((data) => { if (!cancelled) setSnapshot(data); }).catch((requestError) => { if (!cancelled) setError(requestError.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const saveNumber = async (playerId, jerseyNumber) => {
    setWorking(true); setError(''); setStatus('');
    try {
      const result = await updateManagedPlayerNumber(playerId, jerseyNumber);
      setSnapshot(result);
      const name = result.players?.find((player) => player.id === playerId)?.displayName || 'Player';
      setStatus(jerseyNumber === null ? `${name}’s number was removed.` : `${name} is now #${jerseyNumber}.`);
      return true;
    } catch (requestError) { setError(requestError.message); return false; }
    finally { setWorking(false); }
  };
  const savePosition = async (playerId, position) => {
    setWorking(true); setError(''); setStatus('');
    try {
      const result = await updateManagedPlayerPosition(playerId, position);
      setSnapshot(result);
      const name = result.players?.find((player) => player.id === playerId)?.displayName || 'Player';
      const label = POSITION_OPTIONS.find(({ value }) => value === position)?.label;
      setStatus(position === null ? `${name}’s position was cleared.` : `${name}’s position is now ${label}.`);
      return true;
    } catch (requestError) { setError(requestError.message); return false; }
    finally { setWorking(false); }
  };
  return <PlayerAdminDirectory {...props} snapshot={snapshot} loading={loading} working={working} error={error} status={status} onRefresh={refresh} onSaveNumber={saveNumber} onSavePosition={savePosition} />;
}

export default function PlayerAdminPage(props) {
  const account = useAccount();
  if (!account.user || account.profile?.role !== 'admin') return <p role="alert">Sign in with an admin account to manage players.</p>;
  return <AuthorizedPlayerAdmin {...props} />;
}
