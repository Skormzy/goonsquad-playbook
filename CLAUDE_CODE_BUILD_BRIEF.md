# The Goonsquad Playbook — Claude Code Build Brief

## What to Build
A Progressive Web App (PWA) for a ball hockey team. Players select their position, browse 30 game situations, and see animated phase-by-phase breakdowns showing where every player (and every opponent) should be. Deployable to Vercel with a shareable URL.

## Reference Files (in this directory)
- **goonsquad-playbook.jsx** — WORKING PROTOTYPE. This is your visual reference for the entire UX. Open it, click through plays, study the interactions. The production app should look and feel like this but with proper component architecture and smoother animations.
- **SPEC.md** — Original architecture doc (component tree, data schema, design direction)
- **SPEC_V2_ADDENDUM.md** — Theme system, strategy panel, opponent toggle, terminology fixes
- **SPEC_V3_ADDENDUM.md** — Full opponent coverage, expanded play library, UI improvements

## Non-Negotiable Requirements

### 1. Ball Hockey Terminology
- Players RUN, they don't skate. Urgency levels: sprint, run, drift, hold.
- "Floor" not "ice." "Sport court" not "rink surface."
- Zero instances of "skate" anywhere in the app.

### 2. Branding
- App title: "THE GOONSQUAD PLAYBOOK"
- Bold condensed font for team name. Clean sans-serif for body.

### 3. Position System
- 6 positions: LW, C, RW, LD, RD, G
- Selected position ALWAYS highlighted (bigger circle, glow, accent color)
- Clicking any position in the selector updates the highlighted player AND the role panel

### 4. Rink (SVG)
- Vertical orientation (our goal at bottom, their goal at top)
- Full-width goal lines from board to board (like real hockey)
- Goalie always at y=8 (above goal line at y=6, inside crease)
- Space behind both goals (y=0-5 behind ours, y=95-100 behind theirs)
- Faceoff circles with HASH MARKS at 3 and 9 o'clock positions
- Faceoff circles must be clearly visible (thick stroke, decent opacity)
- Coordinate system: 0-100 percentage-based (x: left-right, y: own-goal to opponent-goal)

### 5. Player Rendering
- Our team: colored filled circles with position label inside
- Opponents: neon-bordered circles (#ff2d78 in dark mode) with position label inside (C, LW, RW, LD, RD, F1, F2, etc.) — NOT X marks
- Opponent toggle (show/hide)
- Ball: bright orange (#f97316), rendered LAST in SVG so it's ALWAYS visible on top of everything
- Ball position: at the EDGE of the ball carrier's circle, not in the center. Calculate direction from player toward ball data coordinate, place ball at circle edge + small gap.
- If no player has possession (e.g., faceoff dot), ball renders at its data coordinate.
- Players who have `ball: true` in their data — the ball indicator appears at their circle edge

### 6. Mirror/Flip Mode
- CRITICAL: When mirroring, LW must ALWAYS stay on the LEFT side of the screen
- Implementation: swap LW↔RW data and LD↔RD data, then flip all x coordinates
- The role panel must show the correct role for the visual position, not the data position
- Show "(FLIPPED)" in the phase title when mirror is active

### 7. Opponent Positioning
- Every phase of every play MUST include opponents
- Even strength: 5 opponent skaters (labeled C, LW, RW, LD, RD or F1-F3, D1-D2)
- Offensive zone plays: 5 skaters + goalie (G)
- Powerplay phases: 4 PK players + goalie
- Penalty kill phases: 5 PP players
- NO opponent should ever be labeled "Ball" — use position labels only
- Minimum 4-5% coordinate gap between our players and opponents to prevent overlap

### 8. Faceoff Plays
- Centers positioned AT the faceoff dot
- Wings at the hash marks, FACING their opposing wing across the mark
- Our players on the side closer to our goal, opponents on the side toward center
- Every faceoff has BOTH scenarios: ✅ WON phases (green phase dots) and ❌ LOST phases (red phase dots)

### 9. Phase System
- Every play has 2+ phases showing setup → execution → outcome
- Phase controls: Previous/Next buttons, Play/Pause auto-advance, phase dot indicators
- Speed control: 0.5x, 1x, 2x
- Phase dots colored: green for ✅ won, red for ❌ lost, accent for neutral
- Smooth animations between phases (Framer Motion, ~0.6s ease-out)
- Movement trails: dashed lines from previous position to current

### 10. Responsibility Panel
- Shows selected position's role text, urgency, key reads, communication callouts
- Key reads in yellow-bordered box
- Communication/callouts in green-bordered box with monospace font
- Below the panel: compact list of ALL positions with truncated roles (click to select)

### 11. Strategy Panel
- Each play has a `strat` field with detailed plain-English strategy explanation
- Accessed via "📋 Strategy" button
- Opens as a modal overlay
- Written conversationally, not technically

### 12. Light/Dark Theme
- Toggle in header
- Dark (default): bg #0a0e1a, surface #111827, accent #22d3ee, opponent neon #ff2d78
- Light: bg #f0f4f8, surface #fff, accent #0891b2, opponent #dc2626
- CSS variables or theme context for clean switching
- Opponents get neon glow filter in dark mode only

### 13. Categories
- 🛡 Defensive (8 plays)
- ⚖ Neutral Zone (4 plays)
- ⚔ Offensive (5 plays)
- ⭐ Special Teams (5 plays)
- 🔄 Transition (4 plays)
- 🧠 Systems & IQ (7 plays) — includes rush prevention, line changes, odd-man situations

### 14. Keyboard Shortcuts
- Arrow Left/Right: previous/next phase
- Space: play/pause
- M: mirror
- O: toggle opponents
- T: toggle theme

### 15. PWA / Deployment
- Vite PWA plugin for service worker and offline caching
- Web app manifest with Goonsquad branding
- Deploy to Vercel free tier
- Mobile-first responsive design (players will use this on phones at the arena)
- "Add to Home Screen" support

## Tech Stack
- React 18+ with hooks
- Vite
- Tailwind CSS
- Framer Motion (for player dot animations and phase transitions)
- SVG for rink (not Canvas)
- vite-plugin-pwa for PWA support

## Data Architecture
All play data lives in a separate JSON/JS module. The prototype has all 30 plays with complete phase data inline — extract this into `src/data/plays.js`. The data format is:

```
{
  id: string,
  n: string (name),
  cat: string (category),
  d: string (difficulty),
  desc: string (short description),
  strat: string (detailed strategy notes),
  phases: [{
    id: number,
    t: string (phase title),
    desc: string (phase description),
    pos: {
      LW: { x, y, role, u (urgency), ball?, key?, comm? },
      C: { ... }, RW: { ... }, LD: { ... }, RD: { ... }, G: { ... }
    },
    opp: [{ id, x, y, l (label) }, ...],
    ball: { x, y },
    lanes: [{ f (from position), t (to position), ty (primary|secondary|outlet) }, ...]
  }]
}
```

## Component Architecture
```
App
├── ThemeProvider
├── Header
│   ├── BrandLogo ("THE GOONSQUAD PLAYBOOK")
│   ├── PositionSelector (6 buttons)
│   └── ToolbarButtons (opponent toggle, mirror, theme)
├── Sidebar (play browser)
│   ├── CategoryFilter
│   └── PlayList → PlayCard
├── PlayViewer
│   ├── PlayTitle + StrategyButton
│   ├── PhaseInfo (phase number, title)
│   ├── RinkSVG
│   │   ├── RinkMarkings (lines, circles, goals, hash marks)
│   │   ├── MovementTrails
│   │   ├── PassingLanes
│   │   ├── PlayerDot (×6, our team)
│   │   ├── OpponentDot (×5-6, their team)
│   │   └── BallIndicator (ALWAYS last/on top)
│   ├── PhaseControls (prev, play/pause, next, speed)
│   ├── PhaseDots
│   └── ResponsibilityPanel
│       ├── YourRole (highlighted position)
│       ├── KeyRead (yellow box)
│       ├── CallOut (green box)
│       └── AllPositionsList
└── StrategyModal

```

## Build Steps
1. `npm create vite@latest goonsquad-playbook -- --template react`
2. Install deps: `npm install tailwindcss @tailwindcss/vite framer-motion vite-plugin-pwa`
3. Extract play data from prototype into `src/data/plays.js`
4. Build components from the tree above
5. Get the rink SVG rendering FIRST — this is the core
6. Add player dots with Framer Motion `animate` for smooth position transitions
7. Add opponent dots, ball indicator, trails, passing lanes
8. Build the UI shell (header, sidebar, controls, panels)
9. Add PWA manifest and service worker config
10. Deploy: `npx vercel`

## Critical Notes
- The prototype JSX file IS the source of truth for play data and positioning. Extract it carefully.
- Mobile layout is critical — most usage will be phones at the arena
- The rink should scale responsively but maintain aspect ratio
- Test faceoff alignments carefully — centers at dots, wings at hash marks
- Ball must NEVER be hidden under player circles
- Every play must have 2+ phases — no static single-frame plays
