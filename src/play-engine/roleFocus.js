import { POSITIONS } from '../data/plays';

export const ROLE_LABELS = Object.freeze({
  LW: 'Left Wing',
  C: 'Center',
  RW: 'Right Wing',
  LD: 'Left Defense',
  RD: 'Right Defense',
  G: 'Goalie',
});

const MIRRORED_ROLES = Object.freeze({
  LW: 'RW',
  RW: 'LW',
  LD: 'RD',
  RD: 'LD',
});

export function normalizeRole(role) {
  return POSITIONS.includes(role) ? role : 'C';
}

export function sourceRoleForFocus(role, isMirrored = false) {
  const normalizedRole = normalizeRole(role);
  return isMirrored ? (MIRRORED_ROLES[normalizedRole] ?? normalizedRole) : normalizedRole;
}

export function resolveRoleFocus(phase, role, isMirrored = false) {
  const normalizedRole = normalizeRole(role);
  const sourceRole = sourceRoleForFocus(normalizedRole, isMirrored);

  return {
    role: normalizedRole,
    roleLabel: ROLE_LABELS[normalizedRole],
    sourceRole,
    responsibility: phase?.pos?.[sourceRole] ?? null,
  };
}
