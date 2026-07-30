import {
  COURT_LENGTH_METERS,
  COURT_WIDTH_METERS,
  rinkDistanceMeters,
} from './movementMetrics';

const EXPLICIT_OPPONENT_ROLES = new Set(['LW', 'C', 'RW', 'LD', 'RD', 'G']);
const HOME_ROLES = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];
const MINIMUM_TEAMMATE_SPACING_METERS = 0.75;
const MINIMUM_PRIMARY_LANE_CLEARANCE_METERS = 1.35;
const MINIMUM_GOAL_SIDE_LEAD_METERS = 0.75;
const MINIMUM_INSIDE_LEAD_METERS = 0.2;

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

function activeFloorPlayer(player, role) {
  return role !== 'G'
    && player?.inactive !== true
    && player?.status !== 'penalty-box';
}

function direction(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsCross(a, b, c, d) {
  return direction(a, b, c) * direction(a, b, d) < 0
    && direction(c, d, a) * direction(c, d, b) < 0;
}

function rinkPointMeters(point) {
  return {
    x: (point.x / 100) * COURT_WIDTH_METERS,
    y: (point.y / 100) * COURT_LENGTH_METERS,
  };
}

function pointToSegmentDistanceMeters(point, segmentStart, segmentEnd) {
  const target = rinkPointMeters(point);
  const start = rinkPointMeters(segmentStart);
  const end = rinkPointMeters(segmentEnd);
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
  const projection = segmentLengthSquared === 0
    ? 0
    : ((target.x - start.x) * segmentX + (target.y - start.y) * segmentY)
      / segmentLengthSquared;
  const clampedProjection = Math.max(0, Math.min(1, projection));
  const closest = {
    x: start.x + segmentX * clampedProjection,
    y: start.y + segmentY * clampedProjection,
  };
  return Math.hypot(target.x - closest.x, target.y - closest.y);
}

export function auditPhaseRosterAndSpacing(phases, source, homeKey = 'pos') {
  const issues = [];
  phases.forEach((phase, phaseIndex) => {
    const home = phase?.[homeKey] ?? {};
    const opponents = phase?.opp ?? [];
    const missingRoles = HOME_ROLES.filter((role) => !home[role]);
    if (missingRoles.length > 0) {
      issues.push(issue(source, phaseIndex, `missing home roles: ${missingRoles.join(', ')}`));
    }
    if (opponents.length !== 6) {
      issues.push(issue(source, phaseIndex, `needs 6 opponent slots, found ${opponents.length}`));
    }

    const teams = [
      HOME_ROLES
        .map((role) => ({ id: role, role, player: home[role] }))
        .filter(({ player, role }) => activeFloorPlayer(player, role)),
      opponents
        .map((player) => ({
          id: player.id,
          role: opponentRole(player),
          player,
        }))
        .filter(({ player, role }) => activeFloorPlayer(player, role)),
    ];

    teams.forEach((players) => {
      for (let first = 0; first < players.length; first += 1) {
        for (let second = first + 1; second < players.length; second += 1) {
          const gap = rinkDistanceMeters(players[first].player, players[second].player);
          if (gap < MINIMUM_TEAMMATE_SPACING_METERS) {
            issues.push(issue(
              source,
              phaseIndex,
              `${players[first].id} and ${players[second].id} overlap at ${gap.toFixed(2)}m`,
            ));
          }
        }
      }
    });
  });
  return issues;
}

export function auditCoverageGeometry(
  phases,
  source,
  sceneCoverage = null,
  homeKey = 'our',
) {
  const issues = [];
  phases.forEach((phase, phaseIndex) => {
    const coverage = phase.coverage ?? sceneCoverage ?? {};
    const assignments = Object.entries(coverage).map(([role, opponentId]) => ({
      role,
      opponentId,
      home: phase[homeKey]?.[role],
      opponent: phase.opp?.find((player) => player.id === opponentId),
    }));
    const duplicateTargets = assignments
      .map(({ opponentId }) => opponentId)
      .filter((opponentId, index, all) => all.indexOf(opponentId) !== index);
    if (duplicateTargets.length > 0) {
      issues.push(issue(
        source,
        phaseIndex,
        `duplicate coverage targets: ${[...new Set(duplicateTargets)].join(', ')}`,
      ));
    }

    assignments.forEach(({ role, opponentId, home, opponent }) => {
      if (!home) issues.push(issue(source, phaseIndex, `coverage references missing home role ${role}`));
      if (!opponent) issues.push(issue(source, phaseIndex, `coverage references missing opponent ${opponentId}`));
    });

    const valid = assignments.filter(({ home, opponent }) => home && opponent);
    for (let first = 0; first < valid.length; first += 1) {
      for (let second = first + 1; second < valid.length; second += 1) {
        if (segmentsCross(
          valid[first].home,
          valid[first].opponent,
          valid[second].home,
          valid[second].opponent,
        )) {
          issues.push(issue(
            source,
            phaseIndex,
            `coverage lines cross: ${valid[first].role} and ${valid[second].role}`,
          ));
        }
      }
    }
  });
  return issues;
}

export function auditDefensiveCarrierContainment(
  phases,
  source,
  sceneCoverage = null,
  homeKey = 'pos',
) {
  const issues = [];

  phases.forEach((phase, phaseIndex) => {
    const carrier = phase.opp?.find((player) => (
      player.id === phase.ballOwner || player.hasBall
    ));
    if (!carrier || !isOnFloor(carrier) || opponentRole(carrier) === 'G') return;

    const coverage = phase.coverage ?? sceneCoverage ?? {};
    const coverageEntries = Object.entries(coverage);
    if (coverageEntries.length === 0) return;

    const assignment = coverageEntries
      .find(([, opponentId]) => opponentId === carrier.id);
    if (!assignment) {
      issues.push(issue(
        source,
        phaseIndex,
        `opponent carrier ${carrier.id} has no assigned defender`,
      ));
      return;
    }

    const [role] = assignment;
    const defender = phase[homeKey]?.[role];
    if (!defender || !activeFloorPlayer(defender, role)) return;

    const goalSideLeadMeters = (
      (carrier.y - defender.y) / 100
    ) * COURT_LENGTH_METERS;
    if (goalSideLeadMeters < MINIMUM_GOAL_SIDE_LEAD_METERS) {
      issues.push(issue(
        source,
        phaseIndex,
        `${role} gives ${carrier.id} the forward lane with only `
          + `${goalSideLeadMeters.toFixed(2)}m of goal-side leverage`,
      ));
    }

    const carrierIsOnRight = carrier.x >= 55;
    const carrierIsOnLeft = carrier.x <= 45;
    if (!carrierIsOnRight && !carrierIsOnLeft) return;

    const insideLeadRinkUnits = carrierIsOnRight
      ? carrier.x - defender.x
      : defender.x - carrier.x;
    const insideLeadMeters = (
      insideLeadRinkUnits / 100
    ) * COURT_WIDTH_METERS;
    if (insideLeadMeters < MINIMUM_INSIDE_LEAD_METERS) {
      issues.push(issue(
        source,
        phaseIndex,
        `${role} is outside ${carrier.id} instead of protecting the middle`,
      ));
    }
  });

  return issues;
}

export function auditPrimaryPassingLanes(phases, source, homeKey = 'pos') {
  const issues = [];
  phases.forEach((phase, phaseIndex) => {
    const home = phase?.[homeKey] ?? {};
    const opponents = (phase?.opp ?? []).filter((player) => (
      isOnFloor(player) && opponentRole(player) !== 'G'
    ));

    (phase?.lanes ?? [])
      .filter((lane) => lane.ty === 'primary')
      .forEach((lane) => {
        const from = home[lane.f];
        const to = home[lane.t];
        if (!from || !to) return;

        opponents.forEach((opponent) => {
          const clearance = pointToSegmentDistanceMeters(opponent, from, to);
          if (clearance < MINIMUM_PRIMARY_LANE_CLEARANCE_METERS) {
            issues.push(issue(
              source,
              phaseIndex,
              `${lane.f} to ${lane.t} primary lane is blocked by ${opponent.id} at ${clearance.toFixed(2)}m`,
            ));
          }
        });
      });
  });
  return issues;
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
    ...plays.flatMap((play) => [
      ...auditOpponentGeometry(play.phases ?? [], `play ${play.id}`),
      ...auditPhaseRosterAndSpacing(play.phases ?? [], `play ${play.id}`),
      ...auditCoverageGeometry(play.phases ?? [], `play ${play.id}`, null, 'pos'),
      ...auditDefensiveCarrierContainment(
        play.phases ?? [],
        `play ${play.id}`,
        null,
        'pos',
      ),
      ...auditPrimaryPassingLanes(play.phases ?? [], `play ${play.id}`),
    ]),
    ...tactics.flatMap((tactic) => [
      ...auditOpponentGeometry(
        tactic.mistakeScene?.phases ?? [],
        `strategy ${tactic.id} mistake`,
      ),
      ...auditPhaseRosterAndSpacing(
        tactic.mistakeScene?.phases ?? [],
        `strategy ${tactic.id} mistake`,
        'our',
      ),
      ...auditCoverageGeometry(
        tactic.mistakeScene?.phases ?? [],
        `strategy ${tactic.id} mistake`,
        tactic.mistakeScene?.coverage,
      ),
      ...auditPrimaryPassingLanes(
        tactic.mistakeScene?.phases ?? [],
        `strategy ${tactic.id} mistake`,
        'our',
      ),
      ...auditOpponentGeometry(
        tactic.correctScene?.phases ?? [],
        `strategy ${tactic.id} correct`,
      ),
      ...auditPhaseRosterAndSpacing(
        tactic.correctScene?.phases ?? [],
        `strategy ${tactic.id} correct`,
        'our',
      ),
      ...auditCoverageGeometry(
        tactic.correctScene?.phases ?? [],
        `strategy ${tactic.id} correct`,
        tactic.correctScene?.coverage,
      ),
      ...auditDefensiveCarrierContainment(
        tactic.correctScene?.phases ?? [],
        `strategy ${tactic.id} correct`,
        tactic.correctScene?.coverage,
        'our',
      ),
      ...auditPrimaryPassingLanes(
        tactic.correctScene?.phases ?? [],
        `strategy ${tactic.id} correct`,
        'our',
      ),
    ]),
  ];
}
