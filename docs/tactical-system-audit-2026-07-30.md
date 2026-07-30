# Goon Squad Tactical System Audit

Date: July 30, 2026

## Decision

The coach's 1-2-2 Strong-Side Lock is the non-negotiable defensive identity.
Every active play and strategy now fits one of five game states instead of
teaching an isolated rule:

1. **Secure possession:** attack with short support and a high inside safety.
2. **Contested possession:** nobody runs past the ball; F3 protects the middle.
3. **Opponent control:** the ball-side winger becomes the 1 and all five recover
   into the 1-2-2.
4. **Defensive zone:** protect the house, contain from inside, and exchange jobs
   without crossing coverage.
5. **Special teams:** use the correct four- or five-player unit without applying
   even-strength positioning blindly.

This resolves the catalog's former contradiction. "Two forwards deep" is not a
standing rule. F2 may support low when possession and spacing justify it, but F3
must remain high and inside. A defender may step down only after F3 has covered
above the ball and the weak-side defender remains inside.

Only the 13 plays and 6 strategies listed below are active. The older 2-1-2
lesson remains archived and cannot be reached through browsing, search, or a
direct public route.

## Research Findings

### Why the 1-2-2 remains the right default

The Philadelphia Flyers' systems review distinguishes a layered 1-2-2 from a
more aggressive 2-1-2. The 2-1-2 can create more pressure, but it also increases
counterattack risk. The same review describes the 1-2-2 as multiple turnover
layers and a defensive-zone box-plus-one as protection of the middle and
"home-plate" scoring area:

- [Flyers systems overview](https://www.nhl.com/flyers/news/in-depth-flyers-systems-and-beyond)

That makes the coach's selection defensible for a team that wants predictable
middle protection. It is not objectively the only good system; it is the best
system for this app because it is the coach's chosen identity and all connected
decisions can now be taught consistently.

### Why F3 is the safety, not a third low attacker

NHL analysis of Ottawa's forecheck describes F3 as the high pass option and
safety. When F2 cannot arrive, F3 protects the middle. Responsible F3 depth also
allows a defender to activate without surrendering a counter:

- [NHL analysis of F3 support and safety](https://www.nhl.com/news/ottawa-senators-played-with-purpose-in-game-3-289504268)

The corrected `F3 High - Turnover Safety` play therefore teaches a state change:
secure attack, covered defender activation, immediate inside recovery, then the
coach's 1-2-2.

### Why gaps and coverage cannot be rigid matchups

USA Hockey emphasizes that transition defense depends on coordinated angles,
gaps, and backside pressure. Hockey Canada describes defensive-zone priorities
as limiting time and space, staying on the defensive side, protecting the path
to the net, and communicating:

- [USA Hockey transition, angling, and gaps](https://www.usahockey.com/news_article/show/988313-winning-in-transition-angling-gaps-and-creating-turnovers-in-today-s-game)
- [Hockey Canada developing defenders](https://cdn.hockeycanada.ca/hockey-canada/Hockey-Programs/Players/Downloads/2020/developing-defence-overview-e.pdf)

The catalog now teaches "protect the house, track your check" instead of blind
man chasing, and "close space, protect the middle" instead of a fixed distance
that ignores speed and support.

### Why entries must be read-first

USA Hockey's entry guidance stresses nearby support, lane filling, layered
attack, and reading available space. The Flyers' systems review similarly
distinguishes direct possession entries from placing the ball behind pressure
when the space and pursuit support exist:

- [USA Hockey zone entries and support](https://www.usahockey.com/news_article/show/775908)
- [Flyers systems overview](https://www.nhl.com/flyers/news/in-depth-flyers-systems-and-beyond)

The Zone Entry lesson now presents carry, short support, and placement behind
pressure as reads rather than a simplistic automatic command.

### Ball-hockey adaptation

ISBHF confirms that ball hockey is played on foot on a solid surface, normally
5 plus a goalie, with an orange ball and a floating blue line. The system keeps
the transferable spatial principles from hockey while using ball-hockey
terminology and the app's 5v5-plus-goalies geometry:

- [ISBHF street and ball hockey overview](https://www.isbhf.com/street-and-ball-hockey)

### Special teams

USA Hockey describes power-play success as movement, seams, net presence, and
creating local numerical advantages. It also stresses that a penalty-kill unit
must work together rather than remain stationary:

- [USA Hockey special-teams tactics](https://www.usahockey.com/news_article/show/567732-special-teams-tactics-with-mike-guentzel)

This supports retaining one power-play and one penalty-kill lesson as separate
critical states rather than trying to force 1-2-2 rules onto unequal numbers.

## Active Play Review

| Play | Decision | System fit |
| --- | --- | --- |
| 1-2-2 Strong-Side Lock | Keep | Primary opponent-control system |
| D-Zone Faceoff | Keep | Restart branches into breakout or house-first defense |
| Net-Front Defense | Rewrite | 1-2-2 handoff into house-first coverage |
| Backcheck into the 1-2-2 | Rewrite | Turnover recovery now rebuilds three layers |
| PK - Box Formation | Keep | Separate short-handed state |
| F3 High - Turnover Safety | Rewrite | Replaces blanket "two forwards deep" rule |
| Standard Breakout | Keep | Connected exit with boards, middle, and reverse reads |
| Zone Entry | Rewrite copy | Read-first carry, short support, or placement behind pressure |
| O-Zone Faceoff | Keep | Compact restart with clear win/loss branches |
| Open Slot Read | Keep | Punishes an overload while retaining high safety |
| Low Cycle | Keep | Sustained pressure that creates a middle opening |
| Point Shot | Keep | Net-front, rebound, and high safety layers |
| PP - Umbrella | Keep | Separate power-play state |

## Active Strategy Review

| Strategy | Decision | System fit |
| --- | --- | --- |
| 1-2-2 Strong-Side Lock | Keep | Primary team identity |
| Protect the House, Track Your Check | Rewrite | House-first coverage, no blind chasing |
| Close Space, Protect the Middle | Rewrite | Dynamic gap based on speed and support |
| Instant Recovery to the 1-2-2 | Rewrite | Turnover response connects directly to primary system |
| Triangle Spacing | Keep | Short support around secure possession |
| Cycling the Boards | Keep | Wall possession used to create the slot |

## Alternative Worth Discussing with the Coach

A 2-1-2 is the meaningful alternative if the team deliberately wants more
offensive-zone pressure. The source material also identifies its higher
counterattack risk. It should therefore be an optional game-state adjustment,
such as chasing a late goal, rather than a replacement default. This is a
coaching choice, not evidence that the coach's 1-2-2 is inferior.

## Automated Proof

The codebase now tests:

- every active play and strategy has an explicit system purpose;
- no active content contains the blanket "two forwards deep" instruction;
- F3 depth exists before defender activation;
- opponent-control phases restore an inside, goal-side 1-2-2;
- backchecking ends in the same three layers as the primary system;
- defensive-zone reversals exchange jobs without crossing coverage;
- every phase keeps 12 authored roster slots and valid spacing;
- coverage lines do not cross;
- primary passing lanes are clear;
- 2D and 3D use identical authored coordinates at every phase;
- 3D role coaching follows the active phase instead of reusing opening-phase
  instructions;
- desktop and mobile visual gates assert the intended phase title, 12 players,
  no horizontal overflow, clean browser logs, and a nonblank 3D canvas.
