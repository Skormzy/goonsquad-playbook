export const PLAYER_ADMIN_COLUMNS = [
  { key: 'displayName', label: 'Player' },
  { key: 'jerseyNumber', label: 'Number', numeric: true },
  { key: 'position', label: 'Position' },
  { key: 'rosterStatus', label: 'Roster status' },
  { key: 'seasons', label: 'Seasons' },
  { key: 'teams', label: 'Teams / schedules' },
  { key: 'linkStatus', label: 'Player link' },
  { key: 'memberNames', label: 'Account name' },
  { key: 'usernames', label: 'Username' },
  { key: 'emails', label: 'Email' },
  { key: 'roles', label: 'Account role' },
  { key: 'accountStatus', label: 'Account status' },
  { key: 'externalId', label: 'Source ID' },
  { key: 'sourceUrl', label: 'Source URL' },
];

export const DEFAULT_PLAYER_COLUMNS = PLAYER_ADMIN_COLUMNS.slice(0, 10).map(({ key }) => key);
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const uniqueText = (values) => [...new Set(values.filter(Boolean))].join(' · ');
const normalized = (value) => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const hasPlayerNumber = (value) => value !== null && value !== undefined && String(value).trim() !== '';

export function buildPlayerAdminRows({ players = [], accounts = [], claims = [] } = {}) {
  const identityIndex = buildPlayerIdentityIndex(players);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const rows = players.map((player) => {
    const playerClaims = claims.filter((claim) => claim.playerId === player.id);
    const linkedClaims = playerClaims.filter((claim) => claim.status === 'approved');
    const members = linkedClaims.map((claim) => accountsById.get(claim.userId) || claim.member).filter(Boolean);
    const roster = player.roster || [];
    return {
      ...player,
      identityId: canonicalPlayerIdentityId(identityIndex, player.id),
      jerseyNumber: hasPlayerNumber(player.jerseyNumber) ? String(player.jerseyNumber) : '',
      rosterStatus: player.active ? 'Active' : 'Inactive',
      seasons: uniqueText(roster.map((entry) => entry.season)),
      teams: uniqueText(roster.map((entry) => entry.schedule)),
      linkStatus: linkedClaims.length || player.linked ? 'Linked' : playerClaims.some((claim) => claim.status === 'pending') ? 'Pending' : 'Unlinked',
      memberNames: uniqueText(members.map((member) => member.displayName)),
      usernames: uniqueText(members.map((member) => member.username)),
      emails: uniqueText(members.map((member) => member.email)),
      roles: uniqueText(members.map((member) => member.isOwner ? 'Owner' : ({ admin: 'Admin', stat_manager: 'Stats manager', member: 'Member' })[member.role])),
      accountStatus: uniqueText(members.map((member) => member.suspended ? 'Suspended' : member.emailConfirmed ? 'Active' : 'Email pending')),
      searchExtra: [player.id, ...roster.map((entry) => [entry.position, entry.jerseyNumber, entry.label].join(' ')), ...playerClaims.map((claim) => [claim.status, claim.member?.displayName, claim.member?.username, claim.member?.email].join(' '))].join(' '),
    };
  });
  const counts = new Map();
  rows.filter((row) => row.active && hasPlayerNumber(row.jerseyNumber)).forEach((row) => {
    const key = Number(row.jerseyNumber);
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key).add(row.identityId);
  });
  return rows.map((row) => ({ ...row, sharedNumber: Boolean(row.active && hasPlayerNumber(row.jerseyNumber) && counts.get(Number(row.jerseyNumber))?.size > 1) }));
}

export function selectPlayerAdminRows(rows, { query = '', filters = {}, quickFilter = 'all', sort = { key: 'displayName', direction: 'asc' } } = {}) {
  const terms = normalized(query).trim().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((row) => {
    if (quickFilter === 'active' && !row.active) return false;
    if (quickFilter === 'unnumbered' && hasPlayerNumber(row.jerseyNumber)) return false;
    if (quickFilter === 'shared' && !row.sharedNumber) return false;
    const haystack = normalized([...PLAYER_ADMIN_COLUMNS.map(({ key }) => key === 'jerseyNumber' && hasPlayerNumber(row[key]) ? `#${row[key]}` : row[key]), row.searchExtra].join(' '));
    return terms.every((term) => haystack.includes(term)) && Object.entries(filters).every(([key, value]) => {
      const needle = normalized(value).trim();
      if (!needle) return true;
      if (key === 'rosterStatus' || key === 'linkStatus') return normalized(row[key]) === needle;
      if (key === 'jerseyNumber') return normalized(row[key] || 'Unassigned').includes(needle.replace(/^#/, ''));
      return normalized(row[key]).includes(needle);
    });
  });
  return filtered.sort((left, right) => {
    const a = left[sort.key];
    const b = right[sort.key];
    const aEmpty = a === '' || a === null || a === undefined;
    const bEmpty = b === '' || b === null || b === undefined;
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    const comparison = sort.key === 'jerseyNumber' && !aEmpty && !bEmpty ? Number(a) - Number(b) : collator.compare(String(a ?? ''), String(b ?? ''));
    return comparison * (sort.direction === 'desc' ? -1 : 1) || collator.compare(left.displayName, right.displayName) || String(left.id).localeCompare(String(right.id));
  });
}

export function playerAdminCsv(rows, columns = PLAYER_ADMIN_COLUMNS) {
  const cell = (value) => {
    let text = String(value ?? '');
    // Prevent spreadsheet programs from interpreting account text as formulas.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [columns.map(({ label }) => cell(label)).join(','), ...rows.map((row) => columns.map(({ key }) => cell(row[key])).join(','))].join('\r\n');
}
import { buildPlayerIdentityIndex, canonicalPlayerIdentityId } from '../stats/playerIdentity';
