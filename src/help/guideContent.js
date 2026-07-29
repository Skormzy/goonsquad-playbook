export const GUIDE_TOPIC_ORDER = Object.freeze([
  'start',
  'plays',
  'strategy',
  'three-d',
  'create',
  'stats',
  'profile',
  'controls',
  'terms',
]);

export const DEFAULT_GUIDE_TOPIC_BY_VIEW = Object.freeze({
  playbook: 'plays',
  replay3d: 'three-d',
  tactics: 'strategy',
  strategy3d: 'three-d',
  playmaker: 'create',
  stats: 'stats',
  profile: 'profile',
  account: 'profile',
});

export const GUIDE_TOPICS = Object.freeze({
  start: {
    label: 'Start here',
    eyebrow: 'QUICK START',
    title: 'Read the play before memorizing the route',
    intro: 'Use the same three-pass routine for every play and strategy. It keeps the teaching focused on decisions instead of animation.',
    sections: [
      {
        title: '1. See the team shape',
        body: 'Start in 2D and scan all 12 players. Identify the ball carrier, pressure, support, and the open space before pressing play.',
      },
      {
        title: '2. Follow the decision',
        body: 'Play the sequence once at normal speed. Watch when possession changes and why the next route becomes available.',
      },
      {
        title: '3. Inspect the details',
        body: 'Replay, scrub, or switch to 3D. Use camera angles and optional coaching layers only when they answer a specific question.',
      },
    ],
    note: 'The court always shows 5v5 plus both goalies. Our net is at the bottom in 2D.',
  },
  plays: {
    label: 'Plays',
    eyebrow: 'PLAYBOOK',
    title: 'Learn a complete team sequence',
    intro: 'The Core 12 combine the most important team routes, ball decisions, and coaching cues. The 2D and 3D views use the same timeline.',
    sections: [
      {
        title: 'Choose and scan',
        body: 'Open the play library, filter by category, and select a play. In 2D, read the starting shape before moving through the authored moments.',
      },
      {
        title: 'Use the role lens',
        body: 'Team view explains the full shape. A role lens reduces the coaching copy to the selected position while every player remains visible.',
      },
      {
        title: 'Replay with intent',
        body: 'Play once without interruption, then use the timeline and moment controls to review the release, support routes, and final read.',
      },
      {
        title: 'Move between 2D and 3D',
        body: 'Switch modes at any time. Play, moment, role, time, and speed stay synchronized so the second view explains the same decision.',
      },
    ],
    note: 'A route is not a fixed lane. Read pressure first, then preserve the spacing and responsibility the play teaches.',
  },
  strategy: {
    label: 'Strategy',
    eyebrow: 'TACTICAL IQ',
    title: 'Compare the mistake with the right response',
    intro: 'Six essential strategy lessons teach repeatable reads without duplicating the play library. Each principle begins from a comparable setup so the consequence is easy to see.',
    sections: [
      {
        title: 'Start with the mistake',
        body: 'Watch the mistake through its consequence. Identify which responsibility was abandoned and what space or passing lane appeared.',
      },
      {
        title: 'Run the right response',
        body: 'Switch to the correct outcome and compare the same moment. Focus on distance, angle, communication, and recovery order.',
      },
      {
        title: 'Check every job',
        body: 'Use the team responsibilities below the court to connect the principle to Defense, Center, Winger, and Goalie jobs.',
      },
      {
        title: 'Inspect in 3D',
        body: 'Use 3D when depth or sightlines matter. Coverage, routes, ball lanes, and next-position layers are optional and begin off.',
      },
    ],
    note: 'The goal is recognition under pressure: pause before the decision and predict the correct team response.',
  },
  'three-d': {
    label: '3D',
    eyebrow: '3D REVIEW',
    title: 'Inspect spacing without losing the whole play',
    intro: 'Every camera is a starting angle, not a locked view. Orbit, pan, and zoom remain available on desktop and touch interfaces.',
    sections: [
      {
        title: 'Pick the camera for the question',
        body: 'Broadcast shows team structure, Overhead shows lanes, Bench shows depth, and Role starts close to the selected responsibility.',
      },
      {
        title: 'Navigate freely',
        body: 'Drag to orbit, use the secondary drag or modifier controls to pan, and wheel or pinch to zoom. Recenter restores the chosen camera.',
      },
      {
        title: 'Move through the library',
        body: 'Use the arrows beside the current title for the previous or next item. Open the title to search and scan the complete play or strategy library without leaving 3D or full screen.',
      },
      {
        title: 'Use layers deliberately',
        body: 'Open coaching layers to toggle coverage, routes, the next ball lane, or next-position targets. Clear them to return to the clean replay.',
      },
      {
        title: 'Control the replay everywhere',
        body: 'Play, pause, restart, scrub, and speed controls remain available in the workspace and full screen on desktop and mobile.',
      },
    ],
    note: 'If the tactic is hard to read, return to Broadcast or Overhead before adding a coaching layer.',
  },
  create: {
    label: 'Create',
    eyebrow: 'PLAYMAKER',
    title: 'Author decisions as a sequence of moments',
    intro: 'Create is a keyframe workflow. Place every player, name the coaching moment, set the current carrier, then define the ball decision into the next moment.',
    sections: [
      {
        title: 'Build the starting shape',
        body: 'Drag or select all 12 players into the intended setup. Set each player intent so the generated motion communicates the tactical job.',
      },
      {
        title: 'Add the next moment',
        body: 'Duplicate the current moment, move players to their next positions, and set a realistic travel time. The replay blends between moments.',
      },
      {
        title: 'Author the ball contract',
        body: 'Set who has the ball now. Then choose carry, direct pass, boards pass, shot, or loose ball for the move into the next moment.',
      },
      {
        title: 'Select the exact receiver',
        body: 'For a pass, select the receiving teammate explicitly. The same identity drives the 2D intent line, destination possession, and every 3D camera.',
      },
      {
        title: 'Preview and share',
        body: 'Resolve readiness checks, review the full 2D and 3D replay, then save locally, copy a share link, or export a portable play file.',
      },
    ],
    note: 'Use at least three moments for setup, decision, and resolution. Add more only when a new read or responsibility needs to be taught.',
    action: 'Start Create tutorial',
  },
  stats: {
    label: 'Stats',
    eyebrow: 'TEAM PERFORMANCE',
    title: 'Follow each team one season at a time',
    intro: 'Statistics are separated by season and team, so Monday and Sunday squads never blend into one record. Only verified manager entries affect totals.',
    sections: [
      {
        title: 'Choose the season and team',
        body: 'Select a season first, then choose the available Goonsquad team for that season. A season may contain Monday, Sunday, or both teams.',
      },
      {
        title: 'Read the team result',
        body: 'Overview shows the official record, goals for and against, goal difference, latest results, and current scoring leaders.',
      },
      {
        title: 'Inspect games and players',
        body: 'Games preserves every opponent and score. Players separates field-player scoring from goaltender performance and calculates season totals from game lines.',
      },
      {
        title: 'Protect the record',
        body: 'Members can view statistics. Authorized statistics managers record results, maintain rosters, and enter player lines after each game.',
      },
    ],
    note: 'An empty table means no verified result has been entered. The app never estimates or fills missing team statistics.',
  },
  profile: {
    label: 'Profile',
    eyebrow: 'YOUR GOONSQUAD ID',
    title: 'Keep your plays and team history together',
    intro: 'Create one account with email or Google, then connect the squad record that belongs in your personal view.',
    sections: [
      {
        title: 'Create your account',
        body: 'Use email and password or continue with Google. Your saved plays, Create ownership, and profile follow the same account across devices.',
      },
      {
        title: 'Link your squad record',
        body: 'Choose yourself from the current roster. The link is immediate and only controls which official statistics appear on your profile.',
      },
      {
        title: 'Add older league records',
        body: 'Search all seasons when an older roster used a separate league identity. Records remain separate until you explicitly add them.',
      },
      {
        title: 'Use your profile',
        body: 'Review career totals, season history, recent appearances, the next game, saved plays, and shortcuts into Create and the playbook.',
      },
    ],
    note: 'Selecting a player never edits official statistics. Remove or change a linked record from the profile at any time.',
  },
  controls: {
    label: 'Controls',
    eyebrow: 'INPUT',
    title: 'Fast controls for review',
    intro: 'Buttons remain the primary controls. Keyboard and gesture shortcuts speed up repeated coaching review.',
    sections: [
      {
        title: 'Playback',
        shortcuts: [
          ['Space', 'Play or pause'],
          ['R', 'Restart from the beginning'],
          ['Left / Right', 'Previous or next authored moment'],
          ['Timeline', 'Seek to an exact point'],
        ],
      },
      {
        title: 'Library and view',
        shortcuts: [
          ['[ / ]', 'Previous or next play or strategy'],
          ['M', 'Mirror the 2D play court'],
          ['O', 'Show or hide opponents in 2D'],
          ['T', 'Toggle the color theme'],
        ],
      },
      {
        title: '3D camera',
        shortcuts: [
          ['Drag / arrows', 'Orbit the camera'],
          ['Shift + arrows', 'Pan the camera'],
          ['Wheel / pinch / + -', 'Zoom'],
          ['0', 'Recenter the camera'],
          ['F', 'Toggle action follow'],
        ],
      },
      {
        title: 'Guide',
        shortcuts: [
          ['?', 'Open or close this guide'],
          ['Esc', 'Close an open guide or tutorial'],
        ],
      },
    ],
    note: 'On touch screens, swipe only changes an authored moment when the gesture begins away from a control.',
  },
  terms: {
    label: 'Terms',
    eyebrow: 'GLOSSARY',
    title: 'Shared language for the playbook',
    intro: 'These terms appear across Plays, Strategy, 3D, and Create.',
    sections: [
      { title: 'Moment', body: 'One authored team shape on the timeline. Movement is blended from one moment to the next.' },
      { title: 'Carrier', body: 'The player with authoritative possession at the current moment.' },
      { title: 'Direct pass', body: 'A teammate-to-teammate ball flight without a board impact.' },
      { title: 'Boards pass', body: 'A pass whose authored target includes one controlled board impact before reception.' },
      { title: 'Loose ball', body: 'A ball target with no owner until a later authored possession event.' },
      { title: 'Role lens', body: 'A focused explanation for one position while the complete team remains visible.' },
      { title: 'Coaching layer', body: 'An optional 3D overlay for coverage, routes, the next ball lane, or next-position targets.' },
      { title: 'Readiness', body: 'Create validation for player movement, ball continuity, and a deterministic 3D replay.' },
    ],
    note: 'Position labels identify responsibility; the tactical cue should still explain the read, timing, and support relationship.',
  },
});

export function guideTopicForView(activeView) {
  return DEFAULT_GUIDE_TOPIC_BY_VIEW[activeView] ?? 'start';
}
