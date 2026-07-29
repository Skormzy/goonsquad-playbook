import { resolveRoleFocus } from './roleFocus';

export const ROLE_LENSES = Object.freeze([
  { id: 'team', label: 'Team', roles: [] },
  { id: 'wingers', label: 'Wingers', roles: ['LW', 'RW'] },
  { id: 'center', label: 'Center', roles: ['C'] },
  { id: 'defense', label: 'Defense', roles: ['LD', 'RD'] },
  { id: 'goalie', label: 'Goalie', roles: ['G'] },
]);

const GENERIC_GOALIE_JOB = 'In crease above goal line. Square to ball.';
const ROLE_LENS_BY_ID = new Map(ROLE_LENSES.map((lens) => [lens.id, lens]));

export function normalizeRoleLens(value) {
  return ROLE_LENS_BY_ID.has(value) ? value : 'team';
}

export function rolesForRoleLens(value) {
  return ROLE_LENS_BY_ID.get(normalizeRoleLens(value)).roles;
}

export function roleLensLabel(value) {
  return ROLE_LENS_BY_ID.get(normalizeRoleLens(value)).label;
}

export function roleMatchesLens(role, lensId) {
  return rolesForRoleLens(lensId).includes(role);
}

function uniqueActions(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.text.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function teamJobsFromPhase(phase, isMirrored = false) {
  if (!phase?.pos) return [];

  return ROLE_LENSES.slice(1).map((lens) => {
    const entries = lens.roles.map((role) => {
      const focus = resolveRoleFocus(phase, role, isMirrored);
      const responsibility = focus.responsibility;
      if (!responsibility?.role) return null;
      return {
        callout: responsibility.comm ?? null,
        hasBall: Boolean(responsibility.ball),
        key: responsibility.key ?? null,
        role,
        text: responsibility.role,
        urgency: responsibility.u ?? 'hold',
      };
    }).filter(Boolean);

    if (entries.length === 0) return null;
    if (
      lens.id === 'goalie'
      && entries.every((entry) => (
        entry.text === GENERIC_GOALIE_JOB && !entry.key && !entry.callout
      ))
    ) return null;

    return {
      id: lens.id,
      label: lens.label,
      roles: lens.roles,
      primaryRole: entries.find((entry) => entry.hasBall)?.role ?? entries[0].role,
      actions: uniqueActions(entries),
    };
  }).filter(Boolean);
}

function lensIdForPresentationRole(role) {
  const normalized = role.trim().toLowerCase();
  if (normalized.startsWith('wing')) return 'wingers';
  if (normalized.startsWith('center')) return 'center';
  if (normalized.startsWith('defen')) return 'defense';
  if (normalized.startsWith('goal')) return 'goalie';
  return null;
}

export function teamJobsFromPresentation(responsibilities = []) {
  const jobs = new Map();

  for (const responsibility of responsibilities) {
    const id = lensIdForPresentationRole(responsibility.role ?? '');
    if (!id || !responsibility.action) continue;
    const lens = ROLE_LENS_BY_ID.get(id);
    const job = jobs.get(id) ?? {
      id,
      label: lens.label,
      roles: lens.roles,
      primaryRole: lens.roles[0],
      actions: [],
    };
    job.actions.push({
      callout: null,
      hasBall: false,
      key: null,
      role: lens.roles[0],
      text: responsibility.action,
      urgency: 'hold',
    });
    job.actions = uniqueActions(job.actions);
    jobs.set(id, job);
  }

  return ROLE_LENSES
    .slice(1)
    .map((lens) => jobs.get(lens.id))
    .filter(Boolean);
}
