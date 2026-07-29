export const GUIDE_TOPIC_ORDER = Object.freeze([
  'start',
  'plays',
  'strategy',
  'three-d',
  'create',
  'stats',
  'game',
  'matchup',
  'player-stats',
  'profile',
  'account',
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
  account: 'account',
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
    note: 'The rink always shows 5v5 plus both goalies. Our net is at the bottom in 2D.',
  },
  plays: {
    label: 'Plays',
    eyebrow: 'PLAYBOOK',
    title: 'Learn a complete team sequence',
    intro: 'The Core 12 combine the most important team routes, ball decisions, and coaching cues. Both views teach the same tactical sequence.',
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
        body: 'Switch modes without changing the selected play or coaching intent. A 3D replay may expand an authored moment to make movement easier to read.',
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
        body: 'Use the team responsibilities below the rink to connect the principle to defenders, center, wingers, and goalie.',
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
    intro: 'Camera presets are starting angles, not locked views. Orbit, pan, and zoom remain available on desktop and touch interfaces.',
    sections: [
      {
        title: 'Pick the camera for the question',
        body: 'Broadcast shows team structure, Overhead shows lanes, and Bench shows depth. Role lets you choose an exact position, follows that player, tracks the ball off-ball, and turns toward the next receiver when carrying.',
      },
      {
        title: 'Navigate freely',
        body: 'Drag to look around, use the secondary drag or modifier controls to pan, and wheel or pinch to zoom. In Role view the camera keeps travelling with the selected player; Recenter restores the authored ball-aware view.',
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
        body: 'Drag or select all 12 players into the intended setup on the vertical rink. Set each player intent so the generated motion communicates the tactical job.',
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
        body: 'For a pass, select the receiving teammate explicitly. That identity drives the 2D intent line, destination possession, and generated 3D replay.',
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
    intro: 'Statistics are separated by season and team, so Monday and Sunday squads never blend into one record. Totals come from official league sync or authorized team entry.',
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
    note: 'An empty table means no result has been published from either trusted source. The app never estimates or fills missing team statistics.',
  },
  game: {
    label: 'Game result',
    eyebrow: 'GAME REVIEW',
    title: 'Read one game from score to player detail',
    intro: 'The game page keeps the final score, scoring sequence, penalties, and published player lines in one review.',
    sections: [
      {
        title: 'Start with the result',
        body: 'Confirm the opponent, date, league, venue, and final score before reading the details below.',
      },
      {
        title: 'Follow the game events',
        body: 'Read goals and penalties in order to understand when the game changed and which situations mattered.',
      },
      {
        title: 'Open a player',
        body: 'Select a player name in the game sheet to open that player profile and season history.',
      },
    ],
    note: 'A blank field means the official source did not publish that detail. It is not treated as zero.',
  },
  matchup: {
    label: 'Matchup',
    eyebrow: 'OPPONENT SCOUT',
    title: 'Prepare for the next opponent',
    intro: 'The matchup page combines upcoming fixture details with available head-to-head form and team trends.',
    sections: [
      {
        title: 'Confirm the fixture',
        body: 'Check the league, date, venue, and home or away status before sharing the matchup.',
      },
      {
        title: 'Read the history',
        body: 'Use completed meetings and recent form as context, not as a guarantee of the next result.',
      },
      {
        title: 'Turn the scout into a plan',
        body: 'Open the relevant play or strategy after identifying the pressure, spacing, or transition read to prepare.',
      },
    ],
    note: 'Only published results appear. Future games open this preparation view instead of an empty result page.',
  },
  'player-stats': {
    label: 'Player stats',
    eyebrow: 'PLAYER PROFILE',
    title: 'See one player across every published season',
    intro: 'Public player pages combine identity, current team context, career totals, season history, and recent games.',
    sections: [
      {
        title: 'Read the identity',
        body: 'Number and position appear only when the official record publishes them. Missing details stay clearly marked.',
      },
      {
        title: 'Compare seasons',
        body: 'Use season rows to separate schedules and roles instead of blending every appearance into one line.',
      },
      {
        title: 'Open recent games',
        body: 'Select a recent appearance to review the complete game page and published player line.',
      },
    ],
    note: 'Public profiles show official team records. They do not expose account details or private created plays.',
  },
  profile: {
    label: 'Profile',
    eyebrow: 'YOUR GOONSQUAD ID',
    title: 'Keep your plays and team history together',
    intro: 'Create one account with any email and a unique username, then connect the squad record that belongs in your personal view.',
    sections: [
      {
        title: 'Create your account',
        body: 'Register with any email, choose a username, and sign in later with either one. Your saved plays, Create ownership, and profile follow the same account across devices.',
      },
      {
        title: 'Request your player profile',
        body: 'Choose yourself from the current roster and send the request. A team admin confirms the match before official statistics appear on your profile.',
      },
      {
        title: 'Get assigned directly',
        body: 'An admin can link the correct player record to your account at any time, so you do not need to submit a request first.',
      },
      {
        title: 'Use your profile',
        body: 'Review career totals, season history, recent appearances, the next game, saved plays, and shortcuts into Create and the playbook.',
      },
    ],
    note: 'Player links only control which verified statistics appear on an account. They never edit the official team record.',
  },
  account: {
    label: 'Account',
    eyebrow: 'GOONSQUAD ID',
    title: 'Control your team identity',
    intro: 'Your account keeps favorites, profile links, and created plays attached to the same sign-in.',
    sections: [
      {
        title: 'Sign in your way',
        body: 'Sign in with your email or username and password. On your own device, keep the stay-signed-in option selected.',
      },
      {
        title: 'Keep your local work safe',
        body: 'If accounts are temporarily unavailable, local plays remain on this device and the playbook still works.',
      },
      {
        title: 'Manage your profile',
        body: 'Update your display name and username, then open your player profile to manage linked league records.',
      },
      {
        title: 'Team administration',
        body: 'Admins can approve player-profile requests, assign players directly, and manage member names, usernames, access levels, password reset emails, suspensions, and deletion.',
      },
    ],
    note: 'Account details and official team statistics are stored separately. Linking a player does not edit the team record.',
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
          ['M', 'Mirror the 2D rink'],
          ['O', 'Show or hide opponents in 2D'],
          ['T', 'Toggle the color theme'],
        ],
      },
      {
        title: '3D camera',
        shortcuts: [
          ['Drag / W A S D', 'Orbit while the 3D rink has focus'],
          ['P', 'Switch one-finger drag between orbit and pan'],
          ['Two fingers / Shift + arrows', 'Pan the camera'],
          ['Wheel / pinch / + -', 'Zoom'],
          ['0 / Home', 'Recenter the camera'],
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
    note: 'Play swipes change moments only in Plays 2D and only when the gesture begins away from a control. Two fingers pan the 3D camera.',
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
      { title: 'Readiness', body: 'Create validation for player movement, ball continuity, and a structured 3D replay.' },
      { title: 'Stats shorthand', body: 'GP is games played, G is goals, A is assists, PTS is points, and PIM is penalty minutes.' },
    ],
    note: 'Position labels identify responsibility; the tactical cue should still explain the read, timing, and support relationship.',
  },
});

export function guideTopicForView(activeView, search = '') {
  if (activeView === 'stats') {
    const params = new URLSearchParams(search);
    if (params.has('player')) return 'player-stats';
    if (params.has('game')) return 'game';
    if (params.has('opponent')) return 'matchup';
  }
  return DEFAULT_GUIDE_TOPIC_BY_VIEW[activeView] ?? 'start';
}
