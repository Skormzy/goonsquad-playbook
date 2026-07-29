const EXPLICIT_OPPONENT_ROLES = new Set(['LW', 'C', 'RW', 'LD', 'RD', 'G']);

export function opponentRole(player) {
  const role = String(player?.l ?? player?.label ?? '').trim().toUpperCase();
  return EXPLICIT_OPPONENT_ROLES.has(role) ? role : null;
}

function isOnFloor(player) {
  return player?.inactive !== true
    && player?.status !== 'penalty-box'
    && Number(player?.x) < 96;
}

function issue(source, phaseIndex, message) {
  return `${source} phase ${phaseIndex + 1}: ${message}`;
}

export function auditOpponentGeometry(phases, source) {
  const issues = [];
  const roleById = new Map();

  phases.forEach((phase, phaseIndex) => {
    const opponents = phase?.opp ?? [];

    opponents.forEach((player) => {
      if (!player?.id || player.id === 'og' || player.id === 'op-g') return;
      const role = String(player.l ?? player.label ?? '').trim().toUpperCase();
      const priorRole = roleById.get(player.id);
      if (priorRole && priorRole !== role) {
        issues.push(issue(
          source,
          phaseIndex,
          `${player.id} changes identity from ${priorRole} to ${role}`,
        ));
      } else if (!priorRole) {
        roleById.set(player.id, role);
      }
    });

    const byRole = Object.fromEntries(
      opponents
        .filter(isOnFloor)
        .map((player) => [opponentRole(player), player])
        .filter(([role]) => role),
    );

    if (byRole.RW && byRole.LW && byRole.RW.x >= byRole.LW.x) {
      issues.push(issue(
        source,
        phaseIndex,
        `opponent right/left wing orientation is reversed (RW ${byRole.RW.x}, LW ${byRole.LW.x})`,
      ));
    }

    if (byRole.RD && byRole.LD && byRole.RD.x >= byRole.LD.x) {
      issues.push(issue(
        source,
        phaseIndex,
        `opponent right/left defense orientation is reversed (RD ${byRole.RD.x}, LD ${byRole.LD.x})`,
      ));
    }
  });

  return issues;
}

export function auditTacticalCatalog(plays, tactics) {
  return [
    ...plays.flatMap((play) => auditOpponentGeometry(play.phases ?? [], `play ${play.id}`)),
    ...tactics.flatMap((tactic) => [
      ...auditOpponentGeometry(
        tactic.mistakeScene?.phases ?? [],
        `strategy ${tactic.id} mistake`,
      ),
      ...auditOpponentGeometry(
        tactic.correctScene?.phases ?? [],
        `strategy ${tactic.id} correct`,
      ),
    ]),
  ];
}
