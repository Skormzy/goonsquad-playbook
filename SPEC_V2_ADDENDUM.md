# The Goonsquad Playbook — V2 Specification Addendum

This addendum overrides and extends the original SPEC.md with all V2 changes.

---

## CRITICAL CHANGES FROM V1

### 1. Terminology: "Run" not "Skate"
This is BALL HOCKEY — players run, they don't skate. All references to "skate" in the codebase, data, and UI must use "run" instead. The urgency levels are:
- **sprint** — Full speed running
- **run** — Normal running pace  
- **drift** — Jogging/floating to a position
- **hold** — Stay in place

### 2. Branding: "The Goonsquad Playbook"
- App title: "THE GOONSQUAD PLAYBOOK"
- Use a bold, aggressive font for the team name
- Color accent should feel "tough" but clean — cyan/teal on dark works well

### 3. Rink Proportions — More Space Behind Goals
The V1 rink didn't have enough space behind the goal lines. In ball hockey, there IS playable space behind the net and we have plays that use it. 

**Fix:** The goal lines should be positioned at roughly y=6% and y=94% of the rink height (not at the very edges). This gives ~6% of the rink height as behind-net space on each end. The crease and net are drawn at the goal line, with visible space behind for player dots.

The coordinate system update:
- y=0 to y=5: Behind OUR net (valid positions for players behind goal line)
- y=6: Our goal line
- y=50: Center red line
- y=94: Their goal line
- y=95 to y=100: Behind THEIR net (valid positions for players behind goal line)

### 4. Opponent Team Toggle
Add a toggle button in the header: "Show Opponents" (on/off)
- When ON: Show opponent players as muted red/coral dots with labels (F1, F2, D1, D2, etc.)
- When OFF: Only show our team's dots
- Default: ON (opponents visible)
- Opponent data is stored in each phase's `opponents` array
- Opponent dots should be clearly distinguishable from team dots (hollow circles or different opacity)

### 5. Light Mode / Dark Mode Toggle
Implement a theme toggle with two complete themes:

**Dark Mode (default):**
- Background: #0a0e1a
- Surface: #111827
- Rink: #0f1729
- Text: #e2e8f0
- Accent: #22d3ee

**Light Mode:**
- Background: #f1f5f9
- Surface: #ffffff
- Rink: #e8edf4
- Text: #1e293b
- Accent: #0891b2

Use CSS variables or a theme context so the entire app switches cleanly.

### 6. Strategy Explanation Panel
Each play now has a `strategyNotes` field — a detailed plain-English explanation of WHY the play works and what to focus on. This should be accessible via:
- A "Read Full Strategy" button on each play view
- Opens a modal/drawer with the full strategy text
- Written in conversational tone, not technical jargon
- Covers: the concept, why it works, common mistakes, and what to watch for

### 7. Fixed Powerplay Formation
**DELETE the old PP — 1-3-1 Formation play.** Replace with:

**PP — Umbrella (2-1-2) Formation:**
- LD: Left point (quarterback)
- RD: Right point (distribution + shot)
- LW: Left half-wall (distributor/shooter)
- C: Right half-wall (one-timer position)
- RW: Net-front (screen, deflect, rebound)

Both D are positioned at the points where they belong. The ball moves LD → RD → half-wall → cross-floor for one-timers. The key play: LW receives on the half-wall, fires cross-floor to C for the one-timer while RW screens.

---

## NEW PLAYS TO ADD

### 8. Preventing Odd-Man Rushes (3-on-2, 4-on-2)
**Category:** systems | **Difficulty:** basic

THE most important system for The Goonsquad. The rules:
- Only 2 forwards go deep in the offensive zone. The 3rd forward (RW or whoever is weak-side) stays HIGH as insurance at the top of the offensive zone.
- Only 1 D pinches at a time. The other stays home.
- If we lose the ball, the high forward is already halfway back — no odd-man rush.

This play should show:
- Phase 0: Attacking with the "high forward" insurance position
- Phase 1: Turnover happens — high forward is already retreating, D is already back
- Phase 2: All 5 back in defensive shape — no odd-man rush created

### 9. Line Change Strategy
**Category:** systems | **Difficulty:** basic

Three phases showing:
- Phase 0: SAFE change — ball deep in their zone, weak-side forward changes first, then second forward, then D change together
- Phase 1: RISKY change — ball in neutral zone going their way (can change, but carefully)
- Phase 2: NEVER change here — ball coming toward our zone, everyone stays and defends

Include communication callouts: "CHANGE!", "ON!", "NO CHANGE!"

### 10. Defensive Zone Recovery
**Category:** systems | **Difficulty:** intermediate

How to recover defensive shape when caught up ice:
- Phase 0: Turnover, everyone sprinting back
- Phase 1: Everyone in recovered positions with tight gaps

---

## ADDITIONAL IMPROVEMENTS FOR V2

### 11. Situation Categories Update
Add a new category: **Systems & IQ** (🧠)
This contains the strategic/team-systems plays:
- Preventing Odd-Man Rushes
- Line Change Strategy
- Defensive Zone Recovery
- (Future: Shift Length Discipline, Communication Systems)

### 12. Behind-the-Net Play Coordinates
Update any play that involves going behind the net to use the extended coordinate range:
- Player behind OUR net: y values of 2-5
- Player behind THEIR net: y values of 95-98
These should render properly with the updated rink proportions.

### 13. Opponent Positioning in All Plays
Every phase of every play should include opponent positions in the `opponents` array. This gives context for WHY players need to be where they are. Show:
- Their forwards (labeled F1, F2, F3 or C, LW, RW)
- Their D (labeled D1, D2)
- Use labels that match the situation (e.g., "Ball" for ball carrier, "Net" for net-front, "Pt" for point)

### 14. Enhanced Data Schema
Add to the Play interface:
```typescript
interface Play {
  // ... existing fields ...
  strategyNotes: string;  // Detailed plain-English strategy explanation
}
```

Add to each Phase:
```typescript
interface Phase {
  // ... existing fields ...
  opponents: OpponentState[];  // Now REQUIRED, not optional
}
```

### 15. Keyboard Shortcuts
- Arrow Left/Right: Previous/Next phase
- Space: Play/Pause
- M: Toggle mirror mode
- O: Toggle opponents
- T: Toggle theme (light/dark)
- 1-6: Select position (1=LW, 2=C, 3=RW, 4=LD, 5=RD, 6=G)
- S: Open strategy panel

### 16. Mobile Touch Gestures
- Swipe left/right on rink: Next/Previous phase
- Long press on any player dot: Show that player's role tooltip
- Tap opponent dot: Show which of our players should be covering them

### 17. Printing Improvements
When printing/exporting a play:
- Show all phases side by side as static diagrams
- Include the strategy notes text
- Include opponent positions
- Show the team name and play name as header
- Export as image for sending to the team group chat

---

## UPDATED FILE STRUCTURE FOR CLAUDE CODE

```
src/
  components/
    App.jsx
    Header.jsx
    PositionSelector.jsx
    SituationBrowser.jsx
    PlayViewer.jsx
    RinkSVG.jsx
    PlayerDot.jsx
    OpponentDot.jsx
    BallIndicator.jsx
    MovementTrail.jsx
    PassingLane.jsx
    PhaseControls.jsx
    ResponsibilityPanel.jsx
    StrategyPanel.jsx        ← NEW
    ThemeToggle.jsx           ← NEW
    OpponentToggle.jsx        ← NEW
    QuizMode.jsx
    TeamSettings.jsx
  data/
    plays.json               ← Updated with all V2 plays
  context/
    AppContext.jsx
    ThemeContext.jsx           ← NEW
  utils/
    coordinates.js
    mirror.js
  styles/
    themes.js                 ← NEW (dark + light theme definitions)
```
