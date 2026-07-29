# 3D Player Asset Brief

The current replay uses a temporary animated runner rig so the play can move like a human while the production ball hockey rigs are sourced or authored.

## Production GLB Targets

- `public/models/players/goon-runner-home.glb`
- `public/models/players/goon-runner-away.glb`
- `public/models/players/goon-goalie-home.glb`
- `public/models/players/goon-goalie-away.glb`

## Required Look

- Adult ball hockey player proportions, not marker/capsule proportions.
- Running shoes, shorts, gloves, helmet, stick, and visible Goon Squad-style jersey striping.
- No ice blades, no ice-only equipment, no EA/NHL/team-owned branding.
- Home uniform: white jersey, blue accents, dark shorts.
- Away/opponent uniform: red jersey, light accents, dark shorts.
- Goalies need larger pads, blocker, glove, goalie stick, and ready stance.

## Required Runner Clips

- `idle-ready`
- `jog-forward`
- `sprint-forward`
- `stick-handle`
- `forehand-pass`
- `receive-pass`
- `wrist-shot`

## Required Goalie Clips

- `goalie-ready`
- `goalie-slide`

## Required Named Equipment Parts

The validator checks mesh, node, and material names so generic humanoid assets cannot pass as production ball hockey players.

Runner GLBs must include names matching these groups:

- jersey/shirt/uniform_top
- short/shorts
- shoe/sneaker/footwear
- helmet/cage/visor
- glove/mitt

Goalie GLBs must include names matching these groups:

- jersey/shirt/uniform_top
- shoe/sneaker/footwear
- helmet/mask/cage
- pad/legpad/leg_pad
- blocker
- catcher/glove
- stick/shaft/blade

## Runtime Contract

- GLB 2.0, one skinned humanoid hierarchy per file.
- Stable clip names matching the relevant runner or goalie list above.
- Forward axis and scale must match `animated-runner.glb`.
- Texture budget: 1024px max per material for repeated players.
- Mesh budget target: under 20k uploaded vertices per runner, under 35k per goalie.
- Export pivots at floor contact between shoes.
- Runner sticks are runtime-controlled replay equipment, not static GLB geometry.
- Goalie sticks can be separate child meshes, but must follow hand animation.

## Runtime Selection

- `npm run asset:player:sync` scans the production GLBs and updates `generatedPlayerRigAvailability.js`.
- The 3D replay now loads production GLBs first when all required clips and budgets validate.
- The current bridge model is only a fallback so the replay remains usable while final assets are missing.
- Production GLBs must include authored ball hockey gear; procedural gear is not part of the final runtime path.

## Import Workflow

1. Run `npm run asset:player:contract` to generate `asset-inbox/players/README.md` and `player-rig-contract.json`.
2. Place the four authored GLBs in `asset-inbox/players/` using the exact production filenames.
3. Run `npm run asset:player:import`.
4. The import command optimizes textures/geometry into `public/models/players/`, updates runtime availability, and runs strict production validation.
5. If strict validation fails, keep the bridge fallback active and fix the source GLBs instead of compensating in runtime code.

## Current Stopgap

The current runtime uses `goon-player.glb` for the higher-detail human body, clothing, and shoes, with Mixamo run clips retargeted from `animated-runner.glb`. Procedural helmets, sticks, gloves, and goalie gear are still layered on top only as a bridge.

This is not the final quality path. Final quality requires replacing the bridge with the four production GLBs above so each athlete and goalie ships with authored ball hockey equipment and clips.

## Validation

- `npm run asset:player:validate` verifies the current bridge assets and reports missing production rigs without failing.
- `npm run asset:player:validate:production` fails until all four production GLBs exist with the required clips.
