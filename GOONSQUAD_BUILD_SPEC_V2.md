# Goon Squad Playbook — Unified Build Specification v2

## 1. What This Document Is

This is the complete build specification for the next iteration of the Goon Squad Playbook app. It covers two things: improvements to the existing Playbook (30 plays, 6 categories, currently deployed on Vercel) and a new Tactical IQ module that teaches the strategic principles behind the plays. Both live in the same app, same repo (`goonsquad-playbook`), same deploy.

This document is designed to be handed to a Claude Code session (or a series of them) for implementation. The existing codebase is at github.com/Skormzy/goonsquad-playbook (private repo).

---

## 2. Existing App: What's Already Built

**Stack:** Vite + React 18 + Tailwind CSS + Framer Motion  
**Hosting:** Vercel, auto-deploy from `main` branch  
**Theme:** Light mode default, dark mode toggle  
**Install command override:** `npm install --legacy-peer-deps` (vite-plugin-pwa compatibility)

### Current Features
- Vertical rink SVG (`RinkSVG.jsx`) with percentage-based coordinate system (0–100)
- Full rink markings: goal lines, creases, faceoff circles with hash marks, blue/center lines
- Team logo watermark at center ice (~10% opacity)
- 30 plays across 6 categories: Faceoffs, Breakouts, Powerplays, Penalty Kills, Forechecking, Transitions
- Player rendering: filled circles with position labels, per-position colors
- Opponent rendering: neon-bordered circles
- Ball: orange, rendered at carrier's edge
- Movement trails (dashed) and passing lanes (arrowed)
- Phase controls: prev/next, play/pause, auto-advance, 0.5x/1x/2x speed, phase dots
- 6-position selector (LW, C, RW, LD, RD, G) with role-specific responsibility panel
- Mirror mode (LW↔RW, LD↔RD x-flip)
- Opponent toggle
- Strategy modal overlay
- Keyboard shortcuts (arrows, space, m, o, t)
- PWA manifest for add-to-home-screen
- Sidebar play browser with category filters and difficulty badges

### Current Rink Coordinate System (existing Playbook)
The existing `RinkSVG.jsx` uses a **percentage-based** system (0–100 for both x and y):
- Our net: BOTTOM (y ≈ 94)
- Their net: TOP (y ≈ 6)

The Tactical IQ module should use the same coordinate system and ideally share the same `RinkSVG.jsx` component (or a refactored version of it) so everything looks consistent.

---

## 3. Existing Playbook: Improvements

These are changes to the Playbook section that's already built. They should be implemented alongside the Tactical IQ module.

### 3.1 Principle Links on Each Play
Every play should display 1–3 linked tactical principles at the bottom of its detail view. Tapping a link navigates to that principle in the Tactics section. This creates a two-way connection:
- "I'm studying a breakout play" → see the underlying principles
- "I'm studying backchecking" → see the specific plays that use it

### 3.2 Situational Groupings
Add a new way to browse plays beyond categories: by game situation.
- Tied game, need a goal
- Protecting a lead
- Down a player (PK situations)
- Up a player (PP situations)
- Faceoff in our zone (defensive draws)
- Faceoff in their zone (offensive draws)
- Need a clean breakout under pressure
- Opponent is forechecking hard

Each situation links to the 3–5 most relevant plays plus the 2–3 most relevant tactical principles.

### 3.3 Quick Study Mode
A flashcard-style mode for the existing plays:
- Show the play name and category
- User mentally recalls the formation and player responsibilities
- Tap to reveal the animated play
- Self-rate: "Got it" / "Need to review"
- Spaced repetition scheduling (same system as Tactics)

### 3.4 Play Search
Simple text search across play names and descriptions. On a team with 30 plays, finding the right one quickly matters.

### 3.5 Favorites / Game Day Playlist
Players can star plays to create a personal shortlist. Before a game, the captain or coach can select 5–8 plays as the "Game Day Playlist" that everyone reviews.

---

## 4. New Module: Tactical IQ

### 4.1 Core Concept

Each tactical principle is taught through **two animated scenarios shown side by side or as tabs**:

**Scenario A — "The Mistake"**
Shows what happens when the principle is violated. The animation plays through the full consequences: the defensive breakdown, the open pass, the scoring chance. Players see the cause-and-effect chain.

**Scenario B — "The Right Way"**
Shows the same situation with proper execution. The defense holds, the pass is denied, the play is broken up. Players see what success looks like.

Both scenarios use the same initial setup and the same 5v5 + goalies format. The difference is one player (or group) making the right or wrong read. This contrast is the core teaching mechanism — more effective than explanation alone.

### 4.2 Scenario Format

```
{
  id: string,
  category: "Defense" | "Offense" | "Transition" | "Special Teams",
  title: string,           // < 28 chars
  subtitle: string,        // one-line context
  principle: string,       // 2-3 sentence explanation
  why: string,             // consequences when ignored
  keyPoints: string[],     // 3-4 actionable takeaways
  mistakeScene: AnimationScene,  // what goes wrong
  correctScene: AnimationScene,  // what good looks like
  linkedPlays: string[],         // IDs of related plays in the Playbook
}
```

```
AnimationScene = {
  phases: [
    {
      duration: number,     // seconds for this phase
      players: PlayerPosition[],
      ball: { x, y },
      zones: ZoneOverlay[],
      arrows: Arrow[],
      caption: string,      // displayed BELOW the rink
    }
  ]
}
```

### 4.3 Animation Rules

**Players:**
- 5 skaters + 1 goalie per team = 12 players always visible
- Skaters: filled circles with 2-char position labels (LW, C, RW, LD, RD)
- Goalies: rounded rectangles labeled "G" — visually distinct
- Colors: Us on offense = blue (#2563eb), Us on good defense = green (#16a34a), Us making a mistake = amber (#d97706), Opponents = red (#dc2626)
- White stroke on all player shapes
- Every player has some movement — no frozen players
- Ball carrier gets a glow effect

**Rink:**
- Vertical orientation matching existing Playbook
- Same coordinate system as `RinkSVG.jsx`
- Our net at bottom, their net at top
- Full markings: boards, blue lines, center line/circle, faceoff dots/circles, creases, goals

**Captions:**
- Displayed BELOW the rink SVG, not overlaying it
- The entire rink must be visible at all times including both goalies
- Caption area: clean text below the rink, changes per phase
- Keep captions under 80 characters

**Controls:**
- Play/pause
- Speed: 0.5x, 1x, 2x
- Tab toggle: "The Mistake" / "The Right Way"
- Phase scrubber (dots or slider)

### 4.4 Tactical Principles: Full Content List

**Phase 1 — Core (5 principles, build first):**

1. **Watch Your Man, Not the Ball** (Defense)
   - Mistake: Everyone watches the ball in the corner → attacker walks into slot uncovered → pass → shot → goal
   - Correct: Each defender tracks their assignment → passing lane to slot denied → ball carrier forced into low-percentage play

2. **Protect the Middle, Force Outside** (Defense)
   - Mistake: First defender rushes straight at ball carrier → carrier cuts to the middle → open shot from the slot
   - Correct: Defender takes inside angle → carrier pushed to boards → low-percentage perimeter shot, defense holds shape

3. **Triangle Spacing & Support** (Offense)
   - Mistake: Forwards bunch together on one side → one defender covers two of them → no passing options → turnover
   - Correct: Forwards spread into a triangle → ball carrier always has two options → defense stretched → scoring chance created

4. **Instant Backchecking on Turnovers** (Transition)
   - Mistake: Players stand and watch after losing the ball → opponents rush with numbers → easy scoring chance
   - Correct: All five sprint back immediately → get goal-side of their checks → transition neutralized in the neutral zone

5. **Never Stop Moving Without the Ball** (Offense)
   - Mistake: Off-ball players stand still → defenders cover them easily → ball carrier has no options → forced play
   - Correct: Constant cutting and repositioning → defenders chase → passing lanes open → high-quality scoring chance

**Phase 2 — Expanded (15 principles, build after Phase 1):**

6. **Cycling the Ball Along the Boards** (Offense)
7. **Net-Front Presence & Screens** (Offense)
8. **The Give-and-Go** (Offense)
9. **Overloading One Side** (Offense)
10. **Gap Control** (Defense)
11. **Stick in the Passing Lane** (Defense)
12. **The Defensive Box / PK** (Special Teams)
13. **Umbrella Powerplay** (Special Teams)
14. **Faceoff Positioning** (Special Teams)
15. **Breakout Patterns** (Transition)
16. **Forechecking: 1-2-2 vs 2-1-2** (Transition)
17. **Neutral Zone Structure** (Transition)
18. **When to Dump vs Carry** (Transition)
19. **Communication on the Floor** (Defense)
20. **Shift Length Discipline** (General)

**Ball hockey adaptations to account for in all content:**
- No icing rule
- Running surface (affects fatigue, speed, transition timing)
- Smaller rink (tighter rotations, faster reads)
- Ball bounces differently than a puck off boards
- No body checking in most leagues — positioning is everything

### 4.5 Quiz System (Separate Section)

The quiz lives in its own tab — not embedded inline with the learning flow. It should feel like a standalone challenge mode, not a speed bump.

**Visual Quiz Format (primary):**
- Show a freeze-frame of a tactical scenario on the rink
- Ask "Where should [position] be right now?" or "What should [position] do next?"
- User taps a location on the rink or selects from visual options (not text-only multiple choice)
- Show the animated result of the correct answer playing out

**Spot the Mistake Format:**
- Animation plays showing one player out of position
- User taps the player making the error
- App reveals what was wrong and shows the correction
- Progressive difficulty: Bronze → Silver → Gold

**Knowledge Check Format (secondary, for variety):**
- Short-answer style questions with 3–4 options
- Options should all be plausible — no obviously wrong answers
- Each option's explanation teaches something, whether right or wrong
- Include a rink visual with the question when possible

**Scoring:**
- Track accuracy by category and principle
- Feed into spaced repetition system (Section 4.8)

### 4.6 Pre-Game Prep Mode

Select an opponent play style:
- Aggressive forecheck
- Trap / passive
- High-pace, low-structure
- Possession-based / skilled
- Physical / dump-and-chase

The app filters to the 5–8 most relevant principles and 3–5 most relevant plays for that matchup. Quick-review cards with key reminders. Optional focused quiz.

### 4.7 Team Roster & Positions

- Add players: name + primary position
- Each player gets a personalized study path (defenders see defensive content first, etc.)
- Per-player progress tracking
- Team-wide leaderboard (study streaks, quiz accuracy, principles mastered)

### 4.8 Spaced Repetition

Modified Leitner system:
- Box 1: Review every session (new or recently missed)
- Box 2: Review every 3 sessions
- Box 3: Review every 7 sessions (mastered)
- Correct answer → promote to next box
- Wrong answer → demote to Box 1

Applies to both Plays (flashcard mode) and Tactical Principles.

### 4.9 Communication Callouts

Library of standard calls with animated scenarios:
- "Man on!" — opponent closing on ball carrier
- "Time!" — ball carrier has space
- "Switch!" — switch coverage assignments
- "Back door!" — player cutting behind defense
- "Shot!" — take the shot
- "Wheel!" — circle behind the net

Each includes: the phrase, when to use it, and an animated rink scenario showing the moment it should be called.

---

## 5. App Architecture (Unified)

```
Goon Squad Playbook (single app)
│
├── /plays — Existing Playbook
│   ├── Browse by category (6 categories)
│   ├── Browse by situation (new)
│   ├── Play detail view (animated rink + responsibilities)
│   ├── Quick Study / Flashcard mode (new)
│   ├── Search (new)
│   └── Favorites / Game Day Playlist (new)
│
├── /tactics — Tactical IQ (new)
│   ├── Learn (dual-scenario: Mistake vs Correct)
│   ├── Quiz (visual + spot-the-mistake + knowledge check)
│   ├── Pre-Game Prep (opponent-based filtering)
│   └── Communication Callouts
│
├── /team — Team Management (new)
│   ├── Roster (names + positions)
│   ├── Progress (per-player mastery tracking)
│   └── Leaderboard
│
└── /settings
    ├── Theme (light/dark)
    └── Preferences
```

### Navigation
Bottom tab bar (mobile-first):
- **Plays** — the existing playbook
- **Tactics** — the new learning module
- **Team** — roster, progress, leaderboard
- **More** — settings, about

### Shared Components
The following should be shared between Plays and Tactics:
- `RinkSVG.jsx` (refactored to support both play phases and tactical animations)
- Player rendering (circles, labels, colors, goalie rectangles)
- Ball rendering
- Arrow/trail rendering
- Speed controls
- Theme system

---

## 6. Data Storage

**Recommended: Supabase** (the project already has Supabase MCP connected)

### Schema

```sql
-- Players on the team
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position TEXT CHECK (position IN ('LW','C','RW','LD','RD','G')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mastery tracking (plays + principles)
CREATE TABLE mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  content_type TEXT CHECK (content_type IN ('play','principle')),
  content_id TEXT NOT NULL,
  leitner_box INTEGER DEFAULT 1 CHECK (leitner_box BETWEEN 1 AND 3),
  last_reviewed TIMESTAMPTZ DEFAULT now(),
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,
  UNIQUE(player_id, content_type, content_id)
);

-- Quiz / study session results
CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ DEFAULT now()
);

-- Favorites / playlists
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id),
  play_id TEXT NOT NULL,
  is_gameday BOOLEAN DEFAULT false,
  UNIQUE(player_id, play_id)
);
```

Alternative for MVP: use the persistent storage API available in artifacts for browser-based tracking, migrate to Supabase when the team features are built.

---

## 7. Design & UX Guidelines

### Theme
- Light mode default (already implemented)
- Light rink surface (#e8eff8) with subtle grid
- Clean white cards with light borders
- Dark mode available via toggle

### Typography
- Use the existing font system from the Playbook app
- Position labels: monospace, bold
- Captions: monospace, regular
- Headings: sans-serif, heavy weight
- Body: sans-serif, regular

### Mobile-First
- All features must work on phone screens (360px width minimum)
- Rink SVG scales to container width
- Horizontal scroll for pill selectors
- Touch-friendly tap targets (minimum 44px)
- No hover-only interactions

### Tone & Voice
- Positive and instructional throughout
- Frame everything as "what good teams do" — not "what you're doing wrong"
- No explicit callouts of team-specific weaknesses in the UI
- Professional but accessible — imagine a coach explaining to a smart player
- Use ball hockey terminology, not ice hockey assumptions where they differ

---

## 8. Prototype Reference

A working prototype JSX exists that demonstrates the Tactical IQ animation system with 5 principles, a vertical rink, 5v5 + goalies, and speed controls. It was built iteratively in this project and can be referenced for:
- The animation engine pattern (phase-based lerp + oscillation)
- Player color system
- Rink rendering approach
- UI layout patterns

The prototype is NOT the final implementation — it's a concept demo. The actual build should integrate into the existing Playbook codebase, share the `RinkSVG.jsx` component, and follow the architecture in Section 5.

Key changes from prototype to final:
- Annotations move BELOW the rink (not overlaying it)
- Each principle gets TWO scenarios (Mistake + Correct) instead of one
- Mistake scenarios show full consequences (pass to open player, shot, goal)
- Quiz is a separate section, not inline
- Quiz uses visual/interactive format, not text-only multiple choice
- The module integrates into the existing app navigation

---

## 9. Implementation Order

1. **Refactor shared components** — Extract `RinkSVG.jsx` into a shared component that supports both play phases and tactical animation scenes. Add goalie rendering (rounded rectangles). Ensure the caption/annotation area is below the SVG, not overlaying it.

2. **Add navigation** — Bottom tab bar with Plays, Tactics, Team, More. The existing Playbook content becomes the Plays tab.

3. **Build the Tactics Learn mode** — Implement the dual-scenario viewer (Mistake/Correct tabs) with the first 5 principles. Each scenario shows full 5v5 + goalies, phase-based animation, captions below the rink.

4. **Build the Tactics Quiz mode** — Visual quiz format: freeze-frame + tap interaction. Spot the Mistake mode. Knowledge check as fallback.

5. **Add Playbook improvements** — Principle links on plays, situational groupings, search, favorites/playlist, quick study mode.

6. **Build Team section** — Roster, per-player progress tracking, leaderboard. Connect to Supabase.

7. **Build Pre-Game Prep** — Opponent style selector, filtered content, focused quiz.

8. **Add Communication Callouts** — Animated scenarios for each standard call.

9. **Expand to 20 principles** — Build out Phase 2 tactical content with dual scenarios for each.

10. **Polish** — Spaced repetition engine, difficulty tiers, season analytics.

---

## 10. QA Checklist

### Tactical Animations
- [ ] All 12 players visible in every scene (5 skaters + goalie per team)
- [ ] Our net at BOTTOM, their net at TOP
- [ ] Slot zones in front of the correct net
- [ ] Low-danger zones along the boards, never near a net
- [ ] Goalies in creases, visually distinct (rounded rectangles)
- [ ] Position labels match actual positions (LD on the left, RD on the right)
- [ ] Defensive scenes in our zone (bottom half)
- [ ] Offensive scenes in their zone (top half)
- [ ] Transitions move top-to-bottom
- [ ] No player overlaps at any animation phase
- [ ] Every player has visible movement
- [ ] Arrows accurate and correctly labeled
- [ ] Caption below rink, not overlaying it
- [ ] Full rink visible including both goalies at all times
- [ ] Mistake scenario shows clear consequences (pass, shot, goal)
- [ ] Correct scenario shows clear resolution (denied, broken up)
- [ ] Animation loops cleanly with no visual jumps
- [ ] Same initial setup for Mistake and Correct versions of each principle

### Playbook Integration
- [ ] Shared `RinkSVG.jsx` renders consistently in both Plays and Tactics
- [ ] Principle links on play detail views navigate correctly
- [ ] Situational groupings contain appropriate plays
- [ ] Search returns relevant results
- [ ] Favorites persist across sessions

### General UI
- [ ] Light mode is clean and readable
- [ ] Dark mode has no remnants of light theme
- [ ] Mobile layout works at 360px width
- [ ] Bottom navigation is accessible and clear
- [ ] Tab transitions feel smooth
- [ ] Speed controls work at all settings
- [ ] No horizontal overflow anywhere

### Content Tone
- [ ] All text is positive and instructional
- [ ] No condescending language
- [ ] No specific team weakness callouts in the UI
- [ ] Ball hockey terminology used correctly

---

## 11. Future Features (Backlog, Not in Scope for This Build)

Prioritized by impact:

1. **Interactive drag-to-position mode** — Freeze a scenario, drag a mispositioned player to where they should be
2. **Animated quiz results** — After answering, show the correct play developing as a mini-animation
3. **Game film tagging** — Upload clips, tag with principles, build a library of real examples
4. **Heat map generator** — Track where scoring chances come from across a season
5. **Voice-over narration** — Optional audio walkthrough of each principle
6. **Print mode** — One-page tactical cards for the locker room
7. **Export game plan PDF** — Summarize the 5 most relevant principles for an upcoming game
8. **Notification system** — Study reminders for players who haven't logged in
9. **Opponent scouting profiles** — Build detailed profiles with tendencies and weaknesses
10. **Season analytics dashboard** — Track team tactical improvement over time
11. **Conditioning links** — Connect tactical demands to physical training protocols
12. **Bench dashboard** — Game-time quick reference with shift timer and line matchups
13. **Watch party mode** — Screen-share walkthrough for team meetings with discussion prompts
14. **Multi-language support** — For teams with diverse rosters

---

*This specification covers the complete scope for the next major iteration of the Goon Squad Playbook. Implementation should follow the order in Section 9. The existing codebase at github.com/Skormzy/goonsquad-playbook is the starting point.*
