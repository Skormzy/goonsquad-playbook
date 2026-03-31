# The Goonsquad Playbook — V3 Specification Addendum

## Changes from V2

### Full Opponent Coverage
Every single phase of every single play now includes **all 5 opponent skaters** (3 forwards + 2 defense for even strength). Offensive zone plays also include the **opponent goalie** as a 6th marker.

- Even strength phases: 5 opponent X-markers (3F + 2D)
- Powerplay phases: 4 PK X-markers + opponent goalie (square marker)
- Penalty kill phases: 5 PP X-markers
- Opponent goalie rendered as a **square** marker (distinct from X-marker skaters)

### Expanded Play Library — 33 Total Plays

**Defensive Zone (8):**
1. D-Zone Faceoff Left
2. D-Zone Faceoff Right
3. Standard Breakout
4. Reverse Breakout
5. Wheel Breakout
6. D-to-D Breakout
7. Net-Front Defense
8. Defending Dump & Chase

**Neutral Zone (4):**
9. NZ Faceoff — Center
10. 1-2-2 NZ Trap
11. NZ Regroup
12. Zone Entry (Carry vs Dump)

**Offensive Zone (5):**
13. O-Zone Faceoff Left
14. O-Zone Faceoff Right (referenced via mirror)
15. Low Cycle Left
16. Behind the Net Play
17. Point Shot & Screen

**Special Teams (6):**
18. PP — Umbrella (2-1-2) — Both D at points
19. PP Faceoff — O-Zone
20. PK — Box Formation
21. PK Faceoff — D-Zone
22. PK — Breakout & Clear
23. (PP Overload referenced for future)

**Transition (4):**
24. Forecheck 1-2-2
25. Forecheck 2-1-2 Aggressive
26. Quick Up — Fast Break
27. Backchecking Assignments

**Systems & IQ (6):**
28. Defending 2-on-1
29. Defending 3-on-2
30. Offensive 2-on-1 Rush
31. Offensive 3-on-2 Rush
32. Preventing Odd-Man Rushes
33. Line Change Strategy
34. D-Zone Recovery (bonus)

### UI Improvements
- **Speed control**: 0.5x, 1x, 2x playback speed selector
- **Keyboard shortcuts**: Arrow keys (phase), Space (play/pause), M (mirror), O (opponents), T (theme)
- **Category counts**: Each category shows number of plays in badge
- **Total play count**: Header shows "33 PLAYS"
- **Opponent goalie marker**: Square shape distinct from X-marker skaters
- **Improved opponent visibility**: X-markers for skaters, square for goalie, labels below each

### Data Format Updates
Opponent data is now generated via helper functions for consistency:
- `o5(a,b,c,d,e)` — 5 skaters for even strength in D-zone/NZ
- `o5g(a,b,c,d,e,g)` — 5 skaters + goalie for O-zone plays
- `o4g(a,b,c,d,g)` — 4 PK + goalie for PP plays
- `o5pp(a,b,c,d,e)` — 5 PP skaters for PK plays

Each opponent object: `{x, y, l}` where l is the label (e.g., "C", "LW", "D1", "Ball", "G")

### Terminology Verification
- All urgency values: "sprint", "run", "drift", "hold" — zero instances of "skate"
- All references use ball hockey terminology (floor, run, sport court)
