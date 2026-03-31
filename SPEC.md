# The Goonsquad Playbook — Complete Build Specification

## Vision

A web app that serves as an interactive visual playbook for The Goonsquad ball hockey team. Players select their position and browse a library of game situations. For each situation, the app animates player positions phase-by-phase, highlighting the selected player's role with movement paths, responsibility callouts, and tactical context.

**The goal:** Every player on the team knows exactly where to be and why, in every situation.

**Team name:** The Goonsquad  
**App name:** The Goonsquad Playbook

---

## Core Concepts

### Ball Hockey vs Ice Hockey Differences
- Played on foot (running), not skating — movement is slower but more agile
- Played on sport court surface (not ice)
- Rink is typically smaller (~150-180ft × 65-80ft depending on facility)
- Most leagues: **no icing** rule
- Ball instead of puck — bounces, rolls differently
- Usually 5v5 (some leagues 4v4) plus goalies
- Boards are typically lower
- Game is more physical in corners due to running dynamics

### Positions
- **LW** — Left Wing
- **C** — Center  
- **RW** — Right Wing
- **LD** — Left Defense
- **RD** — Right Defense
- **G** — Goalie (shown but not interactive — always in/near crease)

### Situation Categories
1. **Defensive Zone** — Faceoffs, breakouts, defending against forecheck, net-front defense
2. **Neutral Zone** — Faceoffs, regroups, transition plays, forechecking systems
3. **Offensive Zone** — Faceoffs, cycle plays, shooting plays, net-front, entries
4. **Special Teams** — Powerplay formations, penalty kill formations, special teams faceoffs
5. **Transition** — Breakout-to-attack sequences, backchecking, turnovers

---

## Feature Requirements

### 1. Position Selector
- Large, prominent selector at the top of the app
- Six buttons (LW, C, RW, LD, RD, G) with position icons
- Selected position persists across all situation views
- The selected player is ALWAYS highlighted differently (bright color, glow effect, larger dot)
- Optionally allow entering player name/number for personalization

### 2. Situation Browser / Library
- Left sidebar or top nav with category tree:
  ```
  📂 Defensive Zone
    ├── Faceoff — Left Circle
    ├── Faceoff — Right Circle
    ├── Standard Breakout
    ├── Reverse Breakout
    ├── Wheel Breakout
    ├── D-to-D Breakout
    ├── Defending 1-2-2 Forecheck
    ├── Defending 2-1-2 Forecheck
    ├── Defending Aggressive Forecheck
    ├── Net-Front / Low Zone Defense
    └── Defensive Zone Recovery
  📂 Neutral Zone
    ├── Faceoff — Center
    ├── Faceoff — Left Side
    ├── Faceoff — Right Side  
    ├── 1-2-2 Neutral Zone Trap
    ├── Neutral Zone Regroup
    └── Zone Entry Plays
  📂 Offensive Zone
    ├── Faceoff — Left Circle
    ├── Faceoff — Right Circle
    ├── Low Cycle (Left)
    ├── Low Cycle (Right)
    ├── High Cycle / Umbrella
    ├── Point Shot / Screen Play
    ├── Net-Front Crash
    ├── Behind-the-Net Play
    └── Offensive Zone Pressure
  📂 Special Teams
    ├── PP — 1-3-1 Formation
    ├── PP — Overload Formation
    ├── PP — Umbrella Formation
    ├── PP — Faceoff (Offensive Zone)
    ├── PK — Box Formation
    ├── PK — Diamond / Aggressive
    ├── PK — Faceoff (Defensive Zone)
    └── PK — Breakout / Clear
  📂 Transition
    ├── D-Zone to Attack (Quick Up)
    ├── Forecheck — 1-2-2
    ├── Forecheck — 2-1-2
    ├── Forecheck — Aggressive (2-3)
    ├── Backchecking Assignments
    └── Turnover Recovery
  ```
- Each situation shows: name, difficulty badge (Basic/Intermediate/Advanced), and a brief description
- Filter by category AND by difficulty
- Search functionality

### 3. Rink Visualization (SVG)
- Top-down view of a ball hockey rink
- Full rink shown with:
  - Red/blue lines, center line, center circle
  - Faceoff circles and dots (all 5 spots)
  - Goals/creases at both ends
  - Corner markings
  - Board outline
- Clean, professional look — dark rink surface with bright lines
- Rink oriented VERTICALLY (attacking upward) — this is the natural "your end at bottom, their end at top" orientation
- Responsive — scales to fit the viewport

### 4. Player Dots & Animation System
- **Your team:** 5 colored dots + goalie (use consistent team color, e.g., blue)
- **Opponent team:** shown as gray/muted dots when relevant to illustrate what they're doing
- **Selected player:** Highlighted with bright accent color, glow effect, slightly larger, has a label
- **All players:** Show position abbreviation on/near each dot (LW, C, RW, LD, RD)

#### Phase-Based Animation
Each play is broken into **phases** (2-5 phases typically):
- **Phase 0:** Starting positions (where everyone lines up)
- **Phase 1:** First movement (e.g., "D picks up ball behind net")
- **Phase 2:** Second movement (e.g., "Center swings to boards, wings push wide")
- **Phase 3+:** Subsequent movements

For each phase:
- Player dots animate smoothly from old position to new position (CSS transitions or requestAnimationFrame)
- **Movement trails:** Dashed lines showing the PATH each player took (your player's trail in accent color, others in muted color)
- **Ball indicator:** Small circle showing where the ball is / should go
- **Passing lines:** Dotted arrows showing passing options

### 5. Play Controls
- **Phase stepper:** "← Previous Phase" / "Next Phase →" buttons
- **Play/Pause:** Auto-advance through all phases with ~2 second delay between
- **Phase indicator:** "Phase 2 of 4" with progress dots
- **Reset:** Return to Phase 0
- **Speed control:** 0.5x, 1x, 2x playback speed

### 6. Responsibility Panel
For each phase, show a text panel below or beside the rink:
- **Phase title:** e.g., "Phase 2: Center Swings Low"
- **Your role:** (highlighted) What the selected position should do — "Sprint to the left boards, call for the ball, look for the pass up to LW"
- **Key reads:** What to look for — "If their forward pressures the D, change to the reverse breakout option"
- **Communication:** What to call out — "BOARDS! BOARDS!" or "WHEEL!" or "REVERSE!"

### 7. Mirror Mode — Position Labels Swap
When mirror/flip is toggled, the play doesn't just flip x-coordinates — positions **swap labels** to match their side of the rink:
- LW ↔ RW (left wing becomes right wing and vice versa)
- LD ↔ RD (left defense becomes right defense and vice versa)
- C and G stay the same

This means: when you flip a D-Zone Faceoff Left, it becomes a proper D-Zone Faceoff Right where the RW is on the right boards and the RD is the draw target — not a weird mirror where "LW" is on the right side.

**Implementation:** Use a `mirrorPhase()` function that:
1. Swaps position data between LW↔RW and LD↔RD
2. Flips all x-coordinates (x → 100 - x) for team positions, opponents, and ball
3. Swaps passing lane references (e.g., LD→LW becomes RD→RW)

The mirroring happens at the **data level** before passing to components — the Rink SVG always renders left-to-right with no internal flipping.

### 8. Quiz Mode
- Toggle into quiz mode from any situation
- Shows the rink with all players EXCEPT the selected position
- Shows the current phase
- User taps/clicks where they think they should be
- App reveals correct position with distance feedback:
  - Green: Within target zone (close enough)
  - Yellow: Close but not ideal
  - Red: Wrong area
- Track score across multiple attempts
- Great for pre-game warmup review

### 9. Team Customization
- Settings panel to enter real player names and numbers
- Map names to positions
- Names appear on dots during visualization
- Optional team name and colors

### 10. Pre-Game Prep Mode
- Select opponent tendencies (e.g., "they forecheck aggressively", "they play a trap")
- App suggests which situations to review
- Creates a focused practice playlist of relevant plays

### 11. Print / Share
- Generate a printable PDF of any play showing all phases as static diagrams
- Share link for specific plays
- Export play card images for group chat

---

## Data Schema

Each play/situation is defined as a JSON object:

```typescript
interface Play {
  id: string;                          // e.g., "dzone-faceoff-left"
  name: string;                        // e.g., "Defensive Zone Faceoff — Left Circle"
  category: "defensive" | "neutral" | "offensive" | "special_teams" | "transition";
  subcategory: string;                 // e.g., "faceoff", "breakout", "forecheck"
  difficulty: "basic" | "intermediate" | "advanced";
  description: string;                 // Brief overview of the situation
  situation: string;                   // Context: when does this happen in a game?
  
  // Which half of the rink is the primary action in?
  zone: "defensive" | "neutral" | "offensive" | "full";
  
  // For special teams
  strength?: "even" | "powerplay" | "penalty_kill";
  
  phases: Phase[];
}

interface Phase {
  id: number;                          // 0, 1, 2, 3...
  title: string;                       // e.g., "Starting Positions"
  description: string;                 // What's happening in this phase
  
  // Per-position instructions
  positions: {
    LW: PlayerState;
    C: PlayerState;
    RW: PlayerState;
    LD: PlayerState;
    RD: PlayerState;
    G: PlayerState;
  };
  
  // Optional opponent positions (for context)
  opponents?: OpponentState[];
  
  // Ball position
  ball: { x: number; y: number };
  
  // Passing options shown as arrows
  passingLanes?: PassingLane[];
}

interface PlayerState {
  x: number;                           // 0-100 coordinate (% of rink width)
  y: number;                           // 0-100 coordinate (% of rink height, 0=own goal, 100=opponent goal)
  role: string;                        // What this player does in this phase
  communication?: string;              // What to yell
  keyRead?: string;                    // What to watch for
  urgency?: "sprint" | "skate" | "drift" | "hold";  // Movement speed/priority
  hasBall?: boolean;                   // Does this player have the ball?
}

interface OpponentState {
  id: string;
  x: number;
  y: number;
  label?: string;                      // e.g., "F1", "F2", "D1"
}

interface PassingLane {
  from: string;                        // Position ID or coordinate
  to: string;
  type: "primary" | "secondary" | "outlet";
}
```

### Coordinate System
- Rink is 100×100 (percentage-based for responsiveness)
- **x:** 0 = left boards, 50 = center, 100 = right boards
- **y:** 0 = own goal line, 50 = center red line, 100 = opponent goal line
- All coordinates from the perspective of attacking upward (toward y=100)

---

## UI/UX Design Direction

### Aesthetic: "Tactical Dark" 
Think: coaching tablet meets military briefing room. Dark backgrounds, crisp neon accents, clean sans-serif typography. The rink should feel like a heads-up display.

### Color Palette
- **Background:** Very dark gray/navy (#0a0e1a or similar)
- **Rink surface:** Dark matte (#1a2236)
- **Rink lines:** Crisp white/light blue for blue lines, red for goal lines, white for center
- **Your team dots:** Blue (#3b82f6)
- **Selected player:** Bright cyan/electric blue (#06b6d4) with glow
- **Opponent dots:** Muted red/coral (#94474b, low opacity)
- **Ball:** Bright orange (#f97316)
- **Movement trails:** Dashed, color-matched to player
- **Passing lanes:** Dotted arrows in yellow/gold (#eab308)
- **Text:** White primary, gray secondary
- **Accent for actions:** Bright green for "go here" indicators

### Typography
- Headers: Bold, condensed sans-serif (e.g., "Barlow Condensed", "Oswald", or similar)
- Body: Clean readable sans-serif (e.g., "Barlow", "Source Sans Pro")
- Position labels on dots: Bold, small caps
- Phase descriptions: Medium weight, good line height for readability

### Layout (Desktop)
```
┌──────────────────────────────────────────────────────┐
│  [Position Selector: LW  C  RW  LD  RD  G]          │
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│  Situation   │         RINK VISUALIZATION            │
│  Browser     │         (SVG, animated)               │
│              │                                       │
│  [Categories]│    [◀ Phase] [▶▶ Play] [Phase ▶]     │
│  [Search]    │    [Phase 2 of 4  ● ● ◉ ○]          │
│              │                                       │
│  ► Def Zone  ├───────────────────────────────────────┤
│    • Faceoff │  RESPONSIBILITY PANEL                 │
│    • Breakout│  Your Role: "Sprint to left boards,   │
│  ► Neu Zone  │   call for the ball..."               │
│  ► Off Zone  │  Key Read: "If F1 pressures, switch   │
│  ► Special   │   to reverse option"                  │
│  ► Transition│  Comms: "BOARDS!"                     │
│              │                                       │
└──────────────┴───────────────────────────────────────┘
```

### Layout (Mobile)
- Full-width rink at top
- Position selector as horizontal scrollable pills
- Situation browser as bottom sheet / accordion
- Responsibility panel below rink
- Phase controls as floating bar

### Interactions
- Tap/click any player dot to see their specific responsibility (temporary override of position selector)
- Swipe left/right on rink to advance/retreat phases
- Pinch-zoom on rink for detail
- Keyboard shortcuts: arrow keys for phase, space for play/pause

---

## Technical Architecture

### Stack
- **React 18+** with hooks
- **Vite** for bundling
- **Tailwind CSS** for utility styling
- **Framer Motion** for smooth player animations
- **SVG** for rink rendering (not canvas — SVG is better for this because each element is individually addressable and animatable)

### Component Tree
```
App
├── PositionSelector
├── MainLayout
│   ├── SituationBrowser
│   │   ├── CategoryFilter
│   │   ├── DifficultyFilter
│   │   ├── SearchBar
│   │   └── SituationList
│   │       └── SituationCard (×many)
│   ├── PlayViewer
│   │   ├── RinkSVG
│   │   │   ├── RinkBackground (lines, circles, goals)
│   │   │   ├── PlayerDot (×5 own team + goalie)
│   │   │   ├── OpponentDot (×optional)
│   │   │   ├── BallIndicator
│   │   │   ├── MovementTrail (×per player)
│   │   │   └── PassingLaneArrow (×per lane)
│   │   ├── PhaseControls
│   │   └── SpeedControl
│   └── ResponsibilityPanel
│       ├── PhaseTitle
│       ├── YourRole (highlighted)
│       ├── KeyReads
│       └── Communication
├── QuizMode
│   ├── RinkSVG (with hidden selected player)
│   ├── ClickZone (for user input)
│   └── ScoreTracker
├── TeamSettings
│   ├── PlayerNameInput (×6)
│   └── TeamColorPicker
└── PreGamePrep
    ├── OpponentTendencySelector
    └── SuggestedPlaylist
```

### State Management
Use React Context + useReducer for global state:
```typescript
interface AppState {
  selectedPosition: Position;
  currentPlay: Play | null;
  currentPhase: number;
  isPlaying: boolean;
  playbackSpeed: number;
  isMirrored: boolean;
  isQuizMode: boolean;
  teamSettings: TeamSettings;
  filters: {
    category: string | null;
    difficulty: string | null;
    search: string;
  };
}
```

### Key Technical Decisions
1. **SVG over Canvas:** Each player dot, trail, and arrow is a DOM element — easier to animate with CSS/Framer Motion, easier to make interactive (click handlers), and scales perfectly
2. **Percentage coordinates:** All positions stored as 0-100 percentages — the rink SVG viewBox handles scaling
3. **Phase-based animation:** Each phase is a discrete state — no complex timeline scrubbing, just smooth transitions between states
4. **Data-driven:** All play content lives in JSON data files — no plays are hardcoded into components. Adding new plays = adding data, not code.

---

## Complete Play Data Specification

Below is the FULL list of plays to implement with their phase-by-phase breakdowns. Coordinates use the percentage system (x: 0-100 left-to-right, y: 0-100 own-goal-to-opponent-goal).

### DEFENSIVE ZONE PLAYS

#### 1. Defensive Zone Faceoff — Left Circle
**Category:** defensive | **Subcategory:** faceoff | **Difficulty:** basic

**Phase 0 — Faceoff Alignment:**
- C: (35, 22) — At the dot, taking the draw. Role: "Win the draw back to LD. If you lose it, body their center off the ball."
- LW: (20, 28) — Left of center, boards side. Role: "Line up on hash marks. Be ready to tie up their RW. If we win the draw, sprint to near boards for outlet."
- RW: (60, 28) — High slot, weak side. Role: "Positioned high to cover the slot. Prevent any passes to the high slot. First to backcheck if turnover."
- LD: (30, 12) — Behind and left of center. Role: "Target for the draw. Receive the ball and look to move it quickly — reverse to RD or rim to LW."
- RD: (65, 10) — Net-front area, strong side post awareness. Role: "Protect net-front. If LD gets the draw, swing behind net to receive reverse pass."
- G: (50, 3) — In crease. Role: "Square to the ball. Communicate ice/time to D."

**Phase 1 — Win Draw Back (Ideal):**
- C: (30, 25) — After draw, box out their center. Role: "After winning draw, pivot and establish body position. Deny their center from chasing."
- LW: (10, 30) — Sprint to left boards. Role: "Fly to the near boards for the outlet pass. Get your stick on the sport court ready to receive."
- RW: (55, 32) — Shift slightly higher. Role: "Stay high. You're the safety valve. Do NOT collapse low."
- LD: (25, 14) — Collect the ball behind/beside the net. Role: "Settle the ball. Take a breath. Read the forecheck — how many are they sending?"
- RD: (55, 8) — Shift behind net. Role: "Swing behind the net for the D-to-D option. Call for it if you're open."
- Ball: (25, 14) — With LD

**Phase 2 — Breakout Initiation:**
- C: (25, 38) — Swing to middle/left. Role: "Provide middle-ice option. Cut through the middle of the zone, calling for the ball."
- LW: (8, 45) — Stretch up left boards. Role: "Push up the boards. Stretch the ice. You're the primary outlet — receive and go."
- RW: (65, 45) — Mirror high, far side. Role: "Stay wide, stay high. If LW gets it, you're the far-side option on the cross-rink pass."
- LD: (20, 18) — Moving ball to LW or C. Role: "Make the pass. Boards to LW is safe. Middle to C is riskier but breaks the forecheck."
- RD: (50, 15) — Shift to middle. Role: "Follow the play. Be ready if the pass to LW is cut off — LD can come back to you."
- Ball: Moving to LW or C

#### 2. Defensive Zone Faceoff — Right Circle
**Category:** defensive | **Subcategory:** faceoff | **Difficulty:** basic
*This is the MIRROR of Left Circle — all x-coordinates flip: x → (100 - x)*

**Phase 0 — Faceoff Alignment:**
- C: (65, 22) — At the dot. Role: "Win draw back to RD."
- RW: (80, 28) — Right boards, hash marks. Role: "Tie up their LW. Outlet option on boards."
- LW: (40, 28) — High slot, weak side. Role: "Cover the high slot. Prevent passes to the point."
- RD: (70, 12) — Behind and right of center. Role: "Target for draw. Receive and read forecheck."
- LD: (35, 10) — Net-front area. Role: "Protect net-front. Swing behind net for reverse option."
- G: (50, 3)

*(Phases 1-2 mirror the left circle version)*

#### 3. Standard Breakout
**Category:** defensive | **Subcategory:** breakout | **Difficulty:** basic

**Phase 0 — Ball Behind Net:**
- LD: (30, 8) — Behind the net, left side. Role: "You have the ball. Shoulder-check. Read the forecheck — are they sending 1, 2, or 3?"
- RD: (70, 8) — Behind the net, right side. Role: "Support option behind net. Call out what you see: 'TIME!' or 'PRESSURE!'"
- C: (50, 30) — Center ice, low. Role: "Hover in the middle. You're the safety valve and the through-the-middle option."
- LW: (12, 35) — Left boards, just above the hash. Role: "Hug the boards. Get open. Be ready for the rim or direct pass."
- RW: (88, 35) — Right boards, just above the hash. Role: "Stay wide right. You're the far-side stretch option."
- G: (50, 3) — In net. Role: "If D is in trouble, be ready to stop the ball behind the net. Communicate."
- Ball: (30, 8) — With LD

**Phase 1 — D Makes Decision:**
- LD: (20, 15) — Moving up with ball. Role: "You have 3 options: (1) Boards to LW, (2) Middle to C, (3) Reverse behind net to RD. Choose based on their forecheck."
- RD: (60, 12) — Shifts to middle. Role: "If LD goes boards, you trail the play through the middle. If LD reverses, receive behind net."
- C: (40, 35) — Drifts to LD's side. Role: "Get to the middle-low area. Give LD a short passing option. Keep your stick down."
- LW: (8, 42) — Pushing up boards. Role: "Sprint up the boards. Stretch the defense. Call 'BOARDS!' to let LD know you're open."
- RW: (85, 42) — Staying wide. Role: "Hold your lane. If the play comes to your side, you need to be wide and ready."
- Ball: (20, 15) — With LD
- PassingLanes: LD→LW (primary), LD→C (secondary), LD→RD (outlet)

**Phase 2 — Breakout Completion:**
- LD: (25, 30) — Follows play up. Role: "After your pass, jump into the play. Fill the left lane. You're now part of the rush."
- RD: (60, 25) — Trails through middle. Role: "Follow up through center ice. Provide support. You're the trailer on the rush."
- C: (45, 50) — Through neutral zone. Role: "Push through center. If LW has it on the boards, be the middle option through the neutral zone."
- LW: (10, 55) — Up the left boards with ball. Role: "Carry through neutral zone or dish to C in the middle. Read the D — can you beat them wide?"
- RW: (85, 55) — Far lane stretch. Role: "Sprint to the far side. Be the backside option. If the play comes across, you have a lane to the net."
- Ball: With LW or C in neutral zone

#### 4. Reverse Breakout
**Category:** defensive | **Subcategory:** breakout | **Difficulty:** intermediate

**Phase 0 — D Has Ball, Pressure on Boards Side:**
- LD: (25, 10) — Has ball, left side behind net. Role: "Forecheck is coming hard boards-side. You can't go left. Look to reverse."
- RD: (70, 10) — Far side of net. Role: "Call 'REVERSE!' Move to receive behind the net."
- C: (50, 25) — Low slot. Role: "Read the reverse. When the ball goes D-to-D, you swing to the RIGHT side of the ice."
- LW: (12, 35) — Left boards. Role: "They have your side covered. When you see the reverse, CUT to center ice."
- RW: (88, 35) — Right boards. Role: "Stay wide right. The play is coming to YOUR side now. Get ready."
- Ball: (25, 10) — With LD

**Phase 1 — Reverse Pass:**
- LD: (35, 6) — Passes behind net to RD. Role: "Pass behind the net. Then MOVE — don't stand still. Fill the middle or trail."
- RD: (60, 6) — Receives behind net. Role: "Receive the pass. Now YOU read the forecheck on the right side."
- C: (60, 28) — Swinging to right side. Role: "You're the key. By swinging to the right, you give RD a short option that the forecheck can't cover."
- LW: (45, 40) — Cutting to center. Role: "Cut through the middle. You're now the CENTER of the breakout since everyone shifted."
- RW: (88, 40) — Holding right boards. Role: "Stay wide. RD will look to you on the boards or C cutting through."
- Ball: Moving LD → RD

**Phase 2 — Exit Right Side:**
- LD: (40, 20) — Trailing play. Role: "Follow the play up. Be the safety valve in case it comes back."
- RD: (70, 18) — Moving ball up. Role: "Now execute the breakout on the right side. Boards to RW, middle to C, or skate it yourself if you have time."
- C: (55, 40) — Middle option. Role: "Cut through. You're the middle man. Call for it."
- LW: (40, 50) — Now filling the far lane. Role: "You've switched lanes. You're now the far-side option (normally RW's job)."
- RW: (90, 45) — Right boards. Role: "Primary outlet. Call 'BOARDS!'"
- Ball: With RD, moving to RW or C

#### 5. Wheel Breakout
**Category:** defensive | **Subcategory:** breakout | **Difficulty:** intermediate

**Phase 0 — Ball Behind Net:**
- LD: (35, 7) — Behind net with ball. Role: "They're clogging the middle and the boards. Time for the wheel."
- RD: (65, 7) — Other side of net. Role: "You know what's coming. Get ready to jump up."
- C: (50, 28) — Low center. Role: "When you hear 'WHEEL!', get to the far boards."
- LW: (15, 32) — Left boards. Role: "You're the wheel man. When LD rims it around the boards, you pick it up in the corner/boards."
- RW: (85, 32) — Right boards. Role: "Stay wide. After the wheel, push up your side."
- Ball: (35, 7) — With LD

**Phase 1 — Rim and Chase:**
- LD: (25, 12) — Rims ball hard around the left boards. Role: "Rim it hard around the boards toward the left corner. Then jump into the play."
- RD: (55, 14) — Shifts to middle. Role: "Cover the middle of the ice. You're the safety if the rim gets intercepted."
- C: (70, 35) — Swinging far side. Role: "Get to the far boards/middle. Give the play width."
- LW: (8, 40) — Picks up rimmed ball on boards. Role: "Timing is everything. Meet the ball at the boards, pick it up in stride, and GO."
- RW: (88, 40) — Pushing wide right. Role: "Stay wide. Stretch the defense. Be the cross-ice option."
- Ball: Rimming along left boards to LW

**Phase 2 — Up the Boards:**
- Same as Standard Breakout Phase 2 (LW carries or dishes)

#### 6. D-to-D Breakout
**Category:** defensive | **Subcategory:** breakout | **Difficulty:** intermediate

**Phase 0 — Ball Retrieved by LD:**
- LD: (20, 12) — Picks up ball in left corner. Role: "Get it, settle it. Look to pass to RD behind the net or across the zone."
- RD: (55, 8) — Shifting behind net. Role: "Get behind the net. Call for it."
- C: (50, 28) — Middle. Role: "Stay central. Give a middle option but also read the D-to-D to know which side to support."
- LW: (12, 35) — Left boards. Role: "Hold your lane. If LD passes to RD, start drifting to center — play is switching sides."
- RW: (88, 35) — Right boards. Role: "Stay wide right. The D-to-D means the puck is coming to your side."
- Ball: (20, 12)

**Phase 1 — Cross-Ice Pass:**
- LD: (22, 14) — Passes to RD. Role: "Quick, hard pass across. Don't float it — a soft pass gets picked off."
- RD: (72, 14) — Receives, reads forecheck. Role: "Receive, assess. The forecheck was overloaded on the left side — you should have time."
- C: (60, 30) — Shifts to support RD. Role: "Shift to RD's side. Be the short option."
- LW: (35, 40) — Moving to center/far lane. Role: "You're now the weak-side option cutting through."
- RW: (88, 38) — Ready on boards. Role: "Here we go. Primary outlet on the right."
- Ball: With RD

*(Phase 2 continues as standard breakout from the right side)*

#### 7. Net-Front / Low Zone Defense
**Category:** defensive | **Subcategory:** defending | **Difficulty:** basic

**Phase 0 — Opponent Has Ball Low:**
- LD: (25, 18) — Left side, challenging ball carrier. Role: "Stay between them and the net. Stick on the ball. Don't chase — contain."
- RD: (65, 12) — Net-front, strong side post. Role: "You have the net-front. NO ONE stands in front of our goalie unchecked."
- C: (45, 22) — High slot, reading play. Role: "Cover the high slot. If they pass up high, you're there. Don't get sucked low."
- LW: (20, 30) — Left boards/hash, covering point. Role: "You have their point man on this side. Don't let them walk into a shot."
- RW: (70, 30) — Right side, covering weak-side threat. Role: "Cover the back door. If they pass across the crease, you need to be there."
- G: (50, 3) — In crease, tracking ball. Role: "Stay square. Call out backdoor threats."

*(This play is more about positioning and responsibilities than movement — fewer phases)*

**Phase 1 — Ball Moves Behind Net:**
- LD: (35, 8) — Following ball carrier behind net. Role: "Stay tight but don't overcommit. Mirror them. If they come out your side, guide them wide."
- RD: (60, 8) — Opposite post. Role: "Stay at the post. If they try to wrap around, you're there."
- C: (50, 18) — Drops lower to slot. Role: "Protect the slot. This is the danger zone."
- LW: (25, 28) — Pinches in slightly. Role: "Tighten up but don't lose your point man."
- RW: (70, 28) — Tightens weak side. Role: "Close off the weak side. No easy passes out front."
- G: (50, 3) — Post to post tracking. Role: "Hug the post on the ball side. Quick push if they come out the other side."

#### 8. Defending Against 1-2-2 Forecheck
**Category:** defensive | **Subcategory:** defending | **Difficulty:** intermediate

**Phase 0 — Opponent Sends 1 Forechecker:**
- G: (50, 3) — Sets ball behind net. Role: "Leave the ball for D. Communicate: 'ONE GUY!'"
- LD: (30, 10) — Retrieves ball. Role: "You have time. One forechecker means they're backing off — take a breath and make a good pass."
- RD: (70, 10) — Support behind net. Role: "Be available. Call 'TIME!' if LD has space."
- C: (50, 30) — Central outlet. Role: "Give a middle option. Against a 1-2-2, the middle of the ice is available early."
- LW: (12, 40) — Left boards. Role: "Push up your boards quickly. Their 2-2 structure means the boards are available before their forwards recover."
- RW: (88, 40) — Right boards. Role: "Mirror LW. Get up your side. Speed kills a 1-2-2."

**Phase 1 — Quick Outlet:**
- LD: (22, 18) — Passes to LW or C. Role: "Against a 1-2-2, move the ball FAST. Don't hold it or their structure sets up. Quick to LW or C through the middle."
- RD: (60, 16) — Supporting. Role: "Follow the play up. Provide an option if LD is in trouble."
- C: (45, 38) — Receiving or supporting. Role: "If you get it in the middle, attack with speed. You're between their layers."
- LW: (10, 48) — Receiving on boards. Role: "Catch and go. Speed through the neutral zone. Don't slow down — that's what the 1-2-2 wants."
- RW: (85, 48) — Far lane. Role: "Sprint. Be the release valve on the far side."

#### 9. Defensive Zone Recovery
**Category:** defensive | **Subcategory:** defending | **Difficulty:** intermediate

**Phase 0 — Turnover in Neutral Zone, Opponents Rush:**
- LD: (30, 35) — Retreating. Role: "GET BACK. Hard. You need to be at the top of the circle before they enter the zone."
- RD: (65, 35) — Retreating. Role: "Match LD. Both D retreat together. Stay side by side — don't let them split you."
- C: (50, 40) — Backchecking. Role: "You're the first backchecker. Pick up the most dangerous forward — usually the one in the middle."
- LW: (25, 45) — Backchecking. Role: "Sprint back. Cover the left side. Get inside your man — between them and the net."
- RW: (75, 45) — Backchecking. Role: "Sprint back. Cover the right side. Don't ball-watch."
- G: (50, 3) — Preparing. Role: "Get to the top of your crease. Challenge the shooter."

**Phase 1 — Recovering Into Shape:**
- LD: (30, 18) — At the top of left circle. Role: "Set up at the top of the circle. Take the man on your side. Gap control — stay between them and the net but close enough to take away time."
- RD: (65, 18) — At the top of right circle. Role: "Mirror LD. Close the middle. DON'T get beaten wide."
- C: (50, 25) — Covering the slot. Role: "You've backchecked into the slot. Now you're the third defender. Cover the high danger area."
- LW: (20, 28) — Covering left point. Role: "Get to the hash marks. You have their point man."
- RW: (75, 28) — Covering right point. Role: "Mirror LW. Their point man is yours."

---

### NEUTRAL ZONE PLAYS

#### 10. Neutral Zone Faceoff — Center Ice
**Category:** neutral | **Subcategory:** faceoff | **Difficulty:** basic

**Phase 0 — Lineup:**
- C: (50, 50) — Center dot. Role: "Win the draw. Options: back to LD/RD, or forward to LW/RW."
- LW: (25, 52) — Left side, slightly ahead. Role: "Ready to jump. If we win forward, attack. If we lose, backcheck."
- RW: (75, 52) — Right side, slightly ahead. Role: "Mirror LW. Explode forward on a win."
- LD: (30, 42) — Left, behind center. Role: "Target for a draw back. Receive and move it quickly."
- RD: (70, 42) — Right, behind center. Role: "Mirror LD. Support option."

**Phase 1 — Win Forward (Attack):**
- C: (50, 55) — Pushes forward after winning. Role: "Drive to the net. You're the first attacker."
- LW: (15, 65) — Drives wide left. Role: "Attack the zone wide. Stretch their D."
- RW: (85, 65) — Drives wide right. Role: "Attack wide right. Force their D to spread."
- LD: (35, 52) — Jumps up. Role: "Join the rush as the trailer. Pinch up to the blue line."
- RD: (65, 52) — Jumps up. Role: "Mirror LD. Provide point support."

#### 11. 1-2-2 Neutral Zone Trap
**Category:** neutral | **Subcategory:** system | **Difficulty:** intermediate

**Phase 0 — Forechecking Structure:**
- C: (50, 65) — High, center ice. Role: "You're the '1' in 1-2-2. Don't chase — angle the ball carrier to one side. Force them to the boards."
- LW: (30, 52) — Left side, second layer. Role: "You and RW form the '2' at the top. Step up to the boards if they come your side. If not, hold your lane."
- RW: (70, 52) — Right side, second layer. Role: "Mirror LW. Close the middle. Force them wide."
- LD: (30, 40) — Left, third layer. Role: "You and RD are the last '2'. Stay home. Don't get pulled out of position."
- RD: (70, 40) — Right, third layer. Role: "Mirror LD. Blue line is your line. Don't back up further than you need to."

**Phase 1 — Ball Carrier Forced to Boards:**
- C: (40, 60) — Angling ball carrier left. Role: "You've done your job. They're going to the left boards. Now back off and clog the middle."
- LW: (18, 55) — Stepping up to boards. Role: "Here they come. Close on the ball carrier. Angling them to the wall. Take away the middle pass."
- RW: (55, 52) — Shifting to middle. Role: "Slide to the middle. Cover the center pass. If they try to go cross-ice, you pick it off."
- LD: (25, 42) — Staying disciplined. Role: "Hold your ground. If LW's check works, you pick up the loose ball. If they get past LW, you're the next wall."
- RD: (60, 42) — Providing depth. Role: "Stay central. Cover the weak side. Don't cheat toward the play."

#### 12. Zone Entry Plays
**Category:** neutral | **Subcategory:** zone_entry | **Difficulty:** intermediate

**Phase 0 — Approaching Blue Line With Ball:**
- LW: (10, 65) — Carrying ball up left boards. Role: "You have the ball. Read their D — are they backing up or challenging? If backing up, carry it in. If challenging, dish to C or dump it in."
- C: (40, 62) — Middle, slightly behind. Role: "Be the outlet. If LW is pressured, you receive in the middle and redistribute."
- RW: (85, 60) — Far wing, stretching. Role: "Push HARD to the far side. Stretch their D. Create space for LW."
- LD: (30, 55) — Trail play, left side. Role: "Pinch up to the blue line. You're the point option and the safety valve if entry fails."
- RD: (65, 52) — Holding back. Role: "Stay back. If we turn it over, you're the last man."

**Phase 1a — Carry-In (D is backing up):**
- LW: (12, 75) — Skating ball into zone. Role: "Walk it in. Drive wide then cut to the net or pass to C crashing the slot."
- C: (45, 72) — Driving the middle. Role: "Attack the slot area. If LW gets in, be ready for the pass."
- RW: (85, 72) — Far side, driving net. Role: "Crash the far post. If the ball comes across, bury it."
- LD: (30, 68) — At the point, left side. Role: "Hold the blue line. Keep it in the zone if the ball comes back."
- RD: (60, 60) — Blue line, middle-right. Role: "Hold the line. Provide width."

**Phase 1b — Dump and Chase (D is challenging):**
- LW: (12, 68) — Dumps ball into corner. Role: "Shoot it in deep, left corner. Then CHASE. First man on the ball."
- C: (35, 68) — Supporting the dump. Role: "Follow LW in. You're second on the ball. If LW gets it, be the outlet."
- RW: (75, 68) — Driving to net. Role: "Go to the net. If C gets the ball, you're the scoring option."
- LD: (30, 62) — Holds the line. Role: "Blue line. Keep the play alive."
- RD: (65, 58) — Safety. Role: "Hold back slightly. Cover if it comes out."

---

### OFFENSIVE ZONE PLAYS

#### 13. Offensive Zone Faceoff — Left Circle
**Category:** offensive | **Subcategory:** faceoff | **Difficulty:** basic

**Phase 0 — Lineup:**
- C: (35, 78) — At the dot. Role: "Win it back to LD at the point, or tie it up for LW."
- LW: (20, 82) — Left of C, near boards. Role: "If C ties it up, jump on the loose ball. Fight for it."
- RW: (55, 82) — Net-front. Role: "Get to the net. Screen the goalie. Be ready for a deflection."
- LD: (30, 68) — Left point. Role: "Target for the draw. If you get it, get a shot through. LW and RW should be at the net."
- RD: (65, 68) — Right point. Role: "D-to-D option. If LD gets it and the shot lane is blocked, it comes to you."

**Phase 1 — Draw Won Back:**
- C: (30, 80) — Battles for position. Role: "After the draw, crash the net or tie up their center."
- LW: (15, 85) — Goes to the corner/boards. Role: "Get low. Retrieve if the draw doesn't go clean."
- RW: (55, 85) — Net-front, screening. Role: "Screen, deflect. Don't move from here."
- LD: (28, 70) — Shot option. Role: "Receive, get the shot through QUICKLY. Low and hard."
- RD: (62, 70) — Supporting. Role: "Hold the line. Keep it in."

#### 14. Low Cycle — Left Side
**Category:** offensive | **Subcategory:** cycle | **Difficulty:** intermediate

**Phase 0 — Ball in Left Corner:**
- LW: (12, 88) — In the corner with ball. Role: "Protect the ball. Use your body. DON'T just throw it around the boards blindly. Look for C below the hash or a pass behind the net."
- C: (25, 82) — Low slot, supporting LW. Role: "Support position below the left hash marks. Give LW a short option. If you get it, look at the net."
- RW: (60, 85) — Net-front. Role: "Park yourself net-front. Stick on the sport court. Deflections, rebounds, screens — this is your world."
- LD: (25, 68) — Left point. Role: "Hold the blue line on the ball side. If it comes up high, get a quick shot low with traffic."
- RD: (60, 68) — Right point. Role: "Hold the line on the weak side. If their D pinches on LW, the ball might come to you."
- Ball: (12, 88) — With LW

**Phase 1 — Cycle to Center/Behind Net:**
- LW: (20, 92) — Passes to C and cycles behind net. Role: "Pass to C, then GO behind the net. You'll pop out the other side."
- C: (22, 83) — Receives, looks at net. Role: "Quick decision: shoot, pass to RW at net, or wait for LW to come around behind the net."
- RW: (55, 87) — Holding net-front. Role: "Stay planted. Be LOUD — call for it if you're open."
- LD: (25, 70) — Holding point. Role: "Patience. The cycle will create an opening. Be ready for the pass up."
- RD: (58, 70) — Holding point. Role: "Hold. Watch the weak side."
- Ball: With C

**Phase 2 — Play Develops:**
- LW: (70, 90) — Coming around behind net to right side. Role: "Pop out the other side. Their D will be confused about who covers you."
- C: (30, 83) — Still has ball or looking to pass. Role: "You have options everywhere. Behind the net to LW, high to LD, net-front to RW."
- RW: (55, 87) — STILL at net-front. Role: "DO NOT leave the net. Your job is here."
- LD: (28, 70) — Ready for high pass. Role: "C is looking at you. If you get it, ONE TIMER. Fast."
- RD: (55, 70) — Pinching slightly. Role: "Read the play. If LW pops out your side, shift to cover the point."

#### 15. Offensive Zone Pressure / Forecheck Recovery
**Category:** offensive | **Subcategory:** pressure | **Difficulty:** basic

**Phase 0 — Opponent Has Ball Behind Their Net:**
- C: (50, 85) — First forechecker. Role: "PRESSURE. Get on them. Force a decision. Angle them to one side."
- LW: (25, 80) — Left boards, second layer. Role: "If C pushes them right, cover the left boards. Don't let them get an easy outlet."
- RW: (75, 80) — Right boards, second layer. Role: "If C pushes them left, cover the right boards. Mirror LW."
- LD: (30, 68) — Left point. Role: "HOLD the line. If the ball comes up, keep it in. DO NOT get burned by a long pass."
- RD: (70, 68) — Right point. Role: "HOLD the line. Stay disciplined."

#### 16. Behind the Net Play
**Category:** offensive | **Subcategory:** set_play | **Difficulty:** advanced

**Phase 0 — Retrieve Ball Behind Opponent Net:**
- C: (50, 95) — Behind the net with ball. Role: "You're in control. Hold the ball. Make them come to you. Read which side opens up."
- LW: (20, 85) — Left of net, low. Role: "Be in the short-side area. If C sees you're open, quick give-and-go."
- RW: (80, 85) — Right of net, low. Role: "Mirror LW. Give C options on both sides."
- LD: (30, 70) — Left point. Role: "Top of the umbrella. Shot option if it comes up."
- RD: (70, 70) — Right point. Role: "Mirror LD."

**Phase 1 — Wrap-Around or Pass Out:**
- C: (55, 93) — Moves to one side. Role: "Make your move. Option 1: Quick wrap around the post. Option 2: Pass to RW cutting to the net. Option 3: Back up high to LD/RD."
- LW: (25, 83) — Shifts to slot. Role: "Drift to the slot. If C goes to the other side, you become the weak-side threat."
- RW: (70, 88) — Cutting to net. Role: "CUT to the front of the net. Call for it. Quick release."
- LD: (30, 72) — High left. Role: "Step in slightly. Create shooting lane."
- RD: (65, 72) — High right. Role: "If C comes to your side, be ready for the pass up."

---

### SPECIAL TEAMS

#### 17. Powerplay — 1-3-1 Formation
**Category:** special_teams | **Subcategory:** powerplay | **Difficulty:** intermediate
**Strength:** powerplay

**Phase 0 — Set Up in Zone:**
- LW: (50, 90) — Net-front / low. Role: "You're the '1' at the bottom. Net-front. Screens, deflections, rebounds. This is your bread and butter."
- C: (15, 78) — Left half-boards. Role: "You're the left flank of the '3'. Ball distribution hub. You receive and move — don't hold it."
- RW: (85, 78) — Right half-boards. Role: "Right flank of the '3'. Mirror C. Call for the cross-ice pass."
- LD: (50, 68) — Top of the umbrella. Role: "You're the quarterback. The '1' at the top. Everything flows through you. Move the ball side to side to open up shooting lanes."
- RD: — (Sits out on penalty kill or plays as extra option depending on league rules)

**Phase 1 — Ball Movement:**
- LD: (45, 70) — Has ball at the top. Role: "Move it to C on the left flank. Quick. Make their PK react."
- C: (18, 78) — Receives on the half-boards. Role: "Catch and make a decision: (1) Walk to the middle for a shot, (2) Pass low to LW, (3) Move it back up top to LD."
- RW: (82, 78) — Moving to shooting position. Role: "Call for the cross-ice pass. One-timer position. If it comes, SHOOT."
- LW: (50, 88) — Net-front, moving with the ball. Role: "Shift to the ball side. Screen the goalie. Deflect anything that comes."

**Phase 2 — Cross-Ice and Shoot:**
- LD: (50, 70) — Moves ball to RW. Role: "The cross-ice from C to RW or from you to RW is the money play. Fast, tape to tape."
- C: (25, 78) — Shifts to create passing lane. Role: "Open up the lane. Maybe pick to free RW."
- RW: (78, 78) — ONE TIMER. Role: "This is it. Quick release. Aim far side, low."
- LW: (55, 88) — Crashing the net. Role: "Go to the net for the rebound. RW's shot needs to get through — get any garbage."

#### 18. Powerplay — Overload Formation
**Category:** special_teams | **Subcategory:** powerplay | **Difficulty:** intermediate
**Strength:** powerplay

**Phase 0 — Overload Left Side:**
- C: (20, 88) — Deep left corner/boards. Role: "You're the low option. Ball protection. Start the cycle."
- LW: (18, 78) — Left half-boards. Role: "Primary distributor on the overload side. Receive from C, look high or cross-ice."
- RW: (50, 85) — Slot / net-front. Role: "Drift in the slot area. You're the scoring threat."
- LD: (35, 70) — Left point, shifted toward overload. Role: "Half-boards to point option. Get shots through."
- RD: (65, 70) — Right point, safety valve. Role: "Hold the right side. Weak-side one-timer option."

**Phase 1 — Ball Movement Creates Opening:**
- C: (15, 85) — Passes to LW. Role: "Quick up to LW. Then relocate — move to the front of the net or switch with RW."
- LW: (20, 78) — Receives, looks inside. Role: "KEY DECISION: pass to RW in slot (high danger), up to LD for shot, or back to C who's moving."
- RW: (48, 83) — Drifting in slot. Role: "Soft hands. Be ready for the pass into the slot. Quick release."
- LD: (32, 72) — Walking toward middle. Role: "Step toward the middle. If LW passes up, you have a shooting lane."
- RD: (62, 72) — Holding width. Role: "Stay wide. Prevent the easy clear to the right side."

#### 19. Penalty Kill — Box Formation
**Category:** special_teams | **Subcategory:** penalty_kill | **Difficulty:** basic
**Strength:** penalty_kill

**Phase 0 — Set Up the Box:**
- C: (35, 25) — Top left of box. Role: "You and LW/RW form the top of the box. Be ACTIVE — stick in passing lanes, pressure the ball. But DON'T chase."
- LW: (65, 25) — Top right of box. Role: "Mirror C. Stay disciplined. Move as a unit with C."
- LD: (35, 12) — Bottom left of box. Role: "Bottom of the box. Protect the slot. Clear rebounds. Block shots."
- RD: (65, 12) — Bottom right of box. Role: "Mirror LD. Net-front. No one stands in front unchecked."
- G: (50, 3)

*Note: In a standard PK (5v4), one forward is in the penalty box. The above shows the 4 PK players. The positions used depend on team preference — often it's C + one wing up top, with both D low.*

**Phase 1 — Ball at the Top, Shift the Box:**
- C: (40, 28) — Pressuring ball carrier at the point. Role: "Step up to the ball carrier. Force a decision. Don't fully commit — just take away time and space."
- LW: (60, 22) — Shifting toward the ball. Role: "Shift toward the ball side. Close the passing lane to the middle."
- LD: (38, 14) — Shifting toward ball. Role: "Shift toward the ball side. Stay tight to the net."
- RD: (58, 10) — Dropping to net-front. Role: "Collapse to protect the net. Cover the back door."

**Phase 2 — Ball Moves to the Half-Boards:**
- C: (25, 28) — Following ball to boards. Role: "Pressure down the boards. Take away the pass back up top."
- LW: (50, 22) — Shifting to middle. Role: "Slide to the middle. You now cover the high slot passing lane."
- LD: (30, 14) — Strong side low. Role: "Step toward the ball on the half-boards. You may need to challenge the carrier."
- RD: (55, 10) — Net-front. Role: "Stay at the net. Cover the cross-crease. This is the most dangerous area."

#### 20. Penalty Kill — Diamond / Aggressive
**Category:** special_teams | **Subcategory:** penalty_kill | **Difficulty:** advanced
**Strength:** penalty_kill

**Phase 0 — Diamond Setup:**
- C: (50, 30) — Top of diamond. Role: "You're the tip of the spear. Pressure the ball carrier hard. Force turnovers."
- LW: (30, 20) — Left side of diamond. Role: "Left flank. Be aggressive. Jump passes."
- RD: (70, 20) — Right side of diamond. Role: "Right flank. Mirror LW. Look for interception opportunities."
- LD: (50, 10) — Bottom of diamond. Role: "You're the safety net. Last man back. Protect the net at all costs."
- G: (50, 3)

#### 21. PK Faceoff — Defensive Zone
**Category:** special_teams | **Subcategory:** penalty_kill | **Difficulty:** basic
**Strength:** penalty_kill

**Phase 0 — Alignment:**
- C: (35, 22) — Taking the draw. Role: "Win it to LD or at least tie up their center. If you can clear it, clear it."
- LW: (20, 18) — Near-side boards. Role: "Jump on the loose ball if C ties it up. Get it OUT of the zone."
- LD: (40, 10) — Behind C. Role: "Target for the draw. If you get it, CLEAR. Up the boards, hard."
- RD: (60, 10) — Net-front. Role: "Protect the net. If the draw is lost, immediately set up in the box."
- G: (50, 3)

#### 22. PP Faceoff — Offensive Zone
**Category:** special_teams | **Subcategory:** powerplay | **Difficulty:** basic
**Strength:** powerplay

**Phase 0 — Alignment:**
- C: (35, 78) — Taking the draw. Role: "Win it back to LD. That's the play. Clean draw back."
- LW: (15, 82) — Near-side, ready to retrieve. Role: "If the draw is a battle, jump on the ball. Cycle it to gain control."
- RW: (55, 85) — Net-front. Role: "Screen. Tip. Score. Be ready for LD's shot."
- LD: (30, 70) — Target for draw. Role: "Receive and SHOOT. Don't admire it. Get it on net with bodies in front."
- RD: — (In penalty box or extra player depending on the situation)

---

### TRANSITION PLAYS

#### 23. Quick Up (D-Zone to Attack)
**Category:** transition | **Subcategory:** rush | **Difficulty:** basic

**Phase 0 — D Retrieves in Own Zone:**
- LD: (25, 12) — Has the ball. Role: "Look up FIRST. If wings are open, go quick. Don't default to slow breakout if you have the opportunity."
- RD: (70, 10) — Support. Role: "Be available but also be ready to jump into the rush."
- C: (50, 35) — Through the middle. Role: "Sprint. Fly through center ice. If LD looks up, you should be moving."
- LW: (8, 50) — Flying up the boards. Role: "GO. Sprint up the boards. Stretch the defense."
- RW: (88, 45) — Pushing wide. Role: "Drive wide. Create the 3-lane attack."

**Phase 1 — Quick Stretch Pass:**
- LD: (25, 18) — Fires it up to LW. Role: "Hit LW in stride. Hard, flat pass up the boards."
- RD: (60, 20) — Jumping into rush. Role: "Trail the play. You're the 4th man on the rush."
- C: (45, 55) — Driving the net. Role: "Get to the net. If LW enters the zone, you better be at the net."
- LW: (10, 65) — Receives in stride. Role: "Catch it. Decide: carry in or pass to C driving."
- RW: (80, 58) — Far lane. Role: "Wide right. Cross-ice option."

#### 24. Forechecking — 1-2-2 System
**Category:** transition | **Subcategory:** forecheck | **Difficulty:** basic

**Phase 0 — Opponent Gets the Ball in Their Zone:**
- C: (50, 82) — First forechecker. Role: "Angle. Don't just run at them. Take away one option and force them the other way."
- LW: (25, 72) — Second layer, left. Role: "Read C's angle. If C pushes them right, you shift right and take away the middle. If C pushes left, hold your boards."
- RW: (75, 72) — Second layer, right. Role: "Mirror LW. Move WITH the play. Stay connected."
- LD: (30, 60) — Third layer, left. Role: "Blue line. Gap control. Step up if the ball comes to you, but don't get caught deep."
- RD: (70, 60) — Third layer, right. Role: "Mirror LD. Hold the blue line. Prevent the stretch pass."

**Phase 1 — Forechecker Angles to Left Boards:**
- C: (35, 85) — Driving ball carrier to left boards. Role: "Good angle. You're pushing them into the corner. Stay on them."
- LW: (30, 75) — Closes the middle. Role: "You see C angling them left. Slide RIGHT to take away the middle pass. Trap them."
- RW: (60, 72) — Shifts to middle. Role: "Slide to center. You're covering the middle of the ice now."
- LD: (25, 62) — Shifts toward ball. Role: "Slight shift to the ball side. Ready to step up if the ball comes up the boards."
- RD: (65, 60) — Holds. Role: "Stay RIGHT. If they make a cross-ice pass, you have it."

#### 25. Forechecking — 2-1-2 Aggressive
**Category:** transition | **Subcategory:** forecheck | **Difficulty:** advanced

**Phase 0 — Send Two Deep:**
- LW: (30, 85) — First forechecker, left side. Role: "GO. You and C are the '2' going in hard. You take the boards side. CUT OFF the boards pass."
- C: (50, 82) — Second forechecker, middle. Role: "You're the second forward going hard. Take the middle. Between you and LW, trap the ball carrier."
- RW: (65, 70) — The '1' in the middle. Role: "You're the pivot. If they escape LW and C, you're the next line of defense. Also cover the middle pass."
- LD: (30, 58) — Left side, aggressive pinch. Role: "Tight gap. Step up aggressively. If the ball comes up the boards, jump on it."
- RD: (65, 58) — Right side. Role: "Hold. You're the safety. If everyone else gets beat, you MUST be back."

#### 26. Backchecking Assignments
**Category:** transition | **Subcategory:** backcheck | **Difficulty:** basic

**Phase 0 — Opponent Breaks Out, We're Getting Back:**
- C: (50, 55) — First backchecker. Role: "Pick up the most dangerous forward. Usually the guy in the middle. Get inside him — between him and the net."
- LW: (25, 50) — Left side backcheck. Role: "Your check is their right wing (your left). Get inside. Don't just follow — get between them and the net."
- RW: (75, 50) — Right side backcheck. Role: "Your check is their left wing. Inside position."
- LD: (30, 40) — Retreating to blue line. Role: "Get to the blue line, your side. Gap control — close on the ball carrier without getting beaten."
- RD: (70, 40) — Retreating to blue line. Role: "Mirror LD. Stay connected side to side."

**Phase 1 — Matched Up and Defending:**
- C: (50, 30) — Locked on their center. Role: "You have their center. Stay with them through the zone. Don't let them get a free shot in the slot."
- LW: (20, 35) — Covering their RW. Role: "You're inside your man. If they get the ball, you're in good position to pressure."
- RW: (75, 35) — Covering their LW. Role: "Mirror LW's discipline."
- LD: (30, 25) — Set up in the D-zone. Role: "You're in position. Take away time and space. Box out."
- RD: (65, 25) — Set up in the D-zone. Role: "Mirror LD. Stay with your man."

---

## Additional Play Data to Include

Add these additional situations with the same phase-based structure:

27. **High Cycle / Umbrella Offensive Play** — Using the points and high slot
28. **Point Shot / Screen Play** — D-man shooting with traffic
29. **PP — Umbrella Formation** — Classic 1-2-2 powerplay 
30. **PK — Breakout/Clear** — How to get the ball out when shorthanded
31. **Neutral Zone Regroup** — When the first attack fails and you need to reset
32. **Turnover Recovery (Own Zone)** — What to do when you lose it in your own zone
33. **Turnover Recovery (Neutral Zone)** — Losing it at center ice
34. **6-on-5 (Pulled Goalie)** — Extra attacker situation
35. **Defending 6-on-5** — Protecting the lead

---

## Implementation Priorities

### Phase 1 (MVP)
1. Position selector
2. Rink SVG rendering
3. Phase-based animation system with player dots
4. At least 10 core plays fully animated
5. Responsibility panel
6. Basic category navigation
7. Mobile responsive

### Phase 2
1. All plays from above
2. Mirror mode
3. Movement trails and passing lanes
4. Ball indicator
5. Quiz mode
6. Search and filtering

### Phase 3
1. Team customization
2. Pre-game prep mode
3. Print/share functionality
4. Urgency indicators (sprint/drift)
5. Communication callouts
6. Opponent dots for context

---

## Important Notes for Implementation

1. **The rink should be drawn as SVG, not an image.** This allows perfect scaling and individual element animation.

2. **Player animations should use CSS transitions or Framer Motion.** When phase changes, dots should smoothly glide from position A to position B over ~0.6s.

3. **The "Your Position" highlight is critical to the UX.** The selected position should ALWAYS stand out — bigger, glowing, different color. The whole point is "where do I need to be?"

4. **Movement trails should appear AFTER a phase transition.** Show a dashed path from where the player was to where they are now. Trails fade after 3 seconds or when the next phase starts.

5. **Ball hockey rink proportions:** Roughly 2.3:1 length-to-width ratio. Not exactly ice hockey proportions.

6. **Responsive design priority:** Many players will use this on their phones at the bench between shifts or in the locker room. Mobile MUST work well.

7. **Offline capability would be amazing** — Service worker for offline access so it works in arenas with poor signal.

8. **Data is king.** The play data should live in a separate JSON file or module. This makes it easy to add new plays without touching component code. The data format above should be followed exactly.

9. **Color consistency:** Each position should have a subtle color variation even within the team color, so experienced users can tell who's who at a glance even without labels.

10. **Transitions between plays should reset to Phase 0** with a brief animation of all players moving to starting positions.
