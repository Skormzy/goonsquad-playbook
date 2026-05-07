# 3D Playbook Flagship Replay Design

Date: 2026-05-07
Project: Goon Squad Playbook

## Goal

Build a realistic 3D ball hockey replay system for the existing Goon Squad plays and tactics. The first production slice is a polished, locked 3D replay of the existing `Standard Breakout` play connected to the `Breakout Patterns` tactical principle.

The quality target is close to modern sports-game presentation, while staying realistic for a browser app. Players should look like actual ball hockey players wearing Goon Squad-style jerseys. The replay should show real running, stick handling, passing, shooting mechanics where relevant, and believable ball behavior off the boards.

This is a deterministic replay system, not a live sports game. Each play is authored, reviewed, tuned, and then frozen so it plays the same way every time from multiple camera angles.

## Product Decisions

- Build approach: flagship replay pipeline first.
- First replay: `brk` Standard Breakout.
- First linked tactic: `breakout-patterns`.
- Asset approach: hybrid. Use mostly free/open-source assets where possible, with selective paid assets only when they materially improve realism.
- Player identity: realistic generic players in Goon Squad-style uniforms, not exact teammate likenesses.
- Device target: desktop, laptop, tablet, and mobile.
- Audio: out of scope for the first version.
- Replay editor: future possibility, not required for the first build.

## Analogy

The current 2D app is the coach's whiteboard. The new 3D replay is the filmed practice clip. We are not making the players improvise every time; we are filming one perfect version of the play, then letting users watch it from different angles.

## Architecture

### Existing Playbook Data

The current data in `src/data/plays.js` and `src/data/tactics.js` remains the source for play names, categories, teaching text, phase captions, role descriptions, and initial tactical coordinates.

The existing 2D playbook stays available. The 3D replay is added alongside it, not as an immediate replacement.

### Replay Data

Add a new replay data layer for authored 3D choreography. This layer describes:

- Replay id and linked 2D play/tactic ids.
- Timeline duration and phase markers.
- Player starting positions.
- Player paths over time.
- Player facing direction and body intent.
- Ball ownership.
- Pass, receive, carry, board bounce, and shot events.
- Camera markers and allowed camera modes.
- Caption references.
- Locked/reviewed status.

The existing 0-100 rink coordinates can seed the first draft, but the replay data becomes the final source for the polished 3D scene.

### 3D Replay Engine

Use the existing React + Vite app with React Three Fiber and Three.js. The scene engine owns:

- Sport-court surface.
- Boards and collision geometry.
- Nets and creases.
- Player models.
- Goalie models.
- Sticks and ball.
- Lighting and shadows.
- Camera rigs.
- Replay playback and scrubbing.

High-frequency scene updates should stay outside broad React state. React should coordinate viewer UI, selected camera, selected replay, playback speed, and captions.

### Deterministic Ball Physics

The ball should use realistic deterministic physics for passes, rolling, and board rebounds.

For board passes, the system must model:

- Incoming angle.
- Outgoing rebound angle.
- Ball speed.
- Speed loss from board impact.
- Rolling friction on sport court.
- Bounce height where appropriate.
- Spin or curve only if it is visually useful and controllable.

The result must be repeatable. The same replay should not drift or produce a different teaching outcome on each playback.

### Replay Viewer UI

The viewer should provide:

- Play/pause.
- Scrub timeline.
- Speed controls.
- Phase markers.
- Camera selector.
- Labels/trails toggle.
- Captions below the 3D scene.
- Return path to the 2D play/tactic.

The cinematic scene should look realistic, but training clarity has priority. Captions and explanations must not overlay the playing surface.

## Flagship Replay Scope

The first replay is the Standard Breakout.

Required scene content:

- 5v5 plus both goalies, 12 players total.
- Our net at the bottom, their net at the top.
- Sport-court floor, not ice.
- Full boards with useful rebound behavior.
- Goon Squad-style uniforms for our team.
- Opponent uniforms visually distinct.
- Goalies visibly distinct from runners.
- LD retrieves behind our net.
- LW runs up the boards as the primary outlet.
- C supports through the middle.
- RW stretches wide.
- RD supports behind or through the reverse lane.
- Opponents pressure realistic lanes.
- The goalie tracks the play.
- A board pass or board-assisted outlet demonstrates realistic ball rebound.

The flagship should prove the whole pipeline before adding more plays.

## Camera Modes

The first replay should support:

- Overhead tactical camera.
- Broadcast sideline camera.
- Behind-our-net breakout camera.
- Player-level follow camera.
- Free orbit inspection camera.

Each camera watches the same locked replay. Changing the camera never changes the play.

## Asset Pipeline

Shipping assets should use GLB or glTF 2.0, not raw FBX as the long-term runtime contract.

The asset pipeline should include:

- Source assets from free/open-source or selective paid sources.
- Blender cleanup where needed.
- Export to GLB.
- glTF Transform optimization.
- Texture compression and material reuse.
- Consistent units, pivots, and naming.
- Level-of-detail or lower-quality variants for mobile/tablet.

The existing `public/models/player.fbx` can inform prototyping, but production assets should be converted and optimized.

## Animation Requirements

The flagship replay needs believable ball hockey movement:

- Running movement only, with no glide-style motion.
- Starts and stops.
- Turns and cuts.
- Defensive pressure movement.
- Stick handling while running.
- Passing motion.
- Receiving motion.
- Board-pass follow-through.
- Goalie tracking and crease movement.

Animation should be reusable across future plays. Generic animation clips can be blended with authored paths and ball events.

## Responsive Quality Ladder

The replay should run across desktop, laptop, tablet, and mobile.

Desktop/laptop:

- Highest model detail.
- Better shadows.
- More post-processing if it helps realism.
- Wider camera options.

Tablet/mobile:

- Optimized models and textures.
- Reduced shadow/post-processing load.
- Camera presets tuned for smaller screens.
- Labels/trails available to preserve readability.

The replay content remains the same across devices; only rendering quality changes.

## Future Conversion Strategy

After the flagship replay meets the quality bar:

1. Convert the remaining existing plays in batches.
2. Convert linked tactics that reuse the same movement patterns.
3. Reuse animation clips, camera rigs, player models, and board physics.
4. Keep every replay locked once approved.

The future internal replay authoring/review tool can be considered later if raw data tuning becomes too slow. It is not part of the first implementation.

## Testing And Acceptance

The flagship replay is acceptable when:

- 12 players are visible and active.
- It uses ball hockey terminology and movement.
- The court does not look like ice.
- Our players wear Goon Squad-style uniforms.
- The Standard Breakout teaching point is clear.
- The board pass behaves believably.
- The same replay is deterministic across replays.
- Camera switching does not alter the play.
- Captions stay below the scene.
- Desktop/laptop/tablet/mobile layouts are usable.
- The 2D playbook remains intact.

## Out Of Scope For First Build

- Audio.
- Exact teammate faces or body scans.
- Full play editor.
- Live gameplay or user-controlled players.
- Converting all plays before the flagship quality bar is proven.
- Multiplayer or online simulation.
