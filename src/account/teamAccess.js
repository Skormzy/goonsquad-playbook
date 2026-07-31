export const PRIVATE_TEAM_VIEWS = Object.freeze([
  'playbook',
  'replay3d',
  'tactics',
  'strategy3d',
  'playmaker',
]);

export function isPrivateTeamView(view) {
  return PRIVATE_TEAM_VIEWS.includes(view);
}

export function teamAccessPromptCopy(state, destination = 'team workspace') {
  if (state === 'loading') {
    return {
      eyebrow: 'CHECKING ACCESS',
      title: 'Confirming your team access',
      detail: 'One moment while we check your account.',
      action: '',
    };
  }
  if (state === 'pending') {
    return {
      eyebrow: 'REQUEST PENDING',
      title: 'An admin needs to approve your link',
      detail: `${destination} will unlock as soon as your player-profile request is approved.`,
      action: 'View request',
    };
  }
  if (state === 'unrequested') {
    return {
      eyebrow: 'MEMBERS AREA',
      title: 'Request access through your player profile',
      detail: `${destination} is reserved for approved Goonsquad members.`,
      action: 'Request player access',
    };
  }
  if (state === 'unavailable') {
    return {
      eyebrow: 'ACCESS UNAVAILABLE',
      title: 'Team accounts are temporarily unavailable',
      detail: 'Public schedules, results, standings, and player statistics remain available on Home.',
      action: '',
    };
  }
  return {
    eyebrow: 'MEMBERS AREA',
    title: 'Create an account to request access',
    detail: `${destination} is reserved for approved Goonsquad members.`,
    action: 'Create account or sign in',
  };
}
