import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('player rig Blender source priority', () => {
  it('prefers original authoring files before previously exported GLB sources', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('EXTENSIONS = [".fbx", ".glb", ".gltf"]');
  });

  it('checks imported equipment before creating synthetic equipment materials', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('source_has_shorts = has_part(["short", "shorts"])');
    expect(script).toContain('source_has_footwear = has_part(["shoe", "sneaker", "footwear"])');
    expect(script).toContain('if not source_has_clothing:');
    expect(script).toContain('if not source_has_shorts:');
    expect(script).toContain('if not source_has_footwear:');
  });

  it('exports low-profile shoe tread and lace contact detail even when source footwear exists', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('RUNNER_SHOE_CONTACT_TREAD_WIDTH_FACTOR');
    expect(script).toContain('RUNNER_SHOE_CONTACT_TREAD_DEPTH_FACTOR');
    expect(script).toContain('RUNNER_SHOE_LACE_BRIDGE_LENGTH_FACTOR');
    expect(script).toContain('def add_horizontal_strip');
    expect(script).toContain('add_horizontal_strip(');
    expect(script).toContain('shoe_footwear_{side}_contact_tread_{tread_name}');
    expect(script).toContain('("toe", -0.116)');
    expect(script).toContain('("heel", 0.052)');
    expect(script).toContain('shoe_footwear_{side}_lace_bridge');
    expect(script).toContain('footwearContactDetail');
  });

  it('reports shoe contact detail evidence for every generated runner', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(runnerTargets.length).toBeGreaterThanOrEqual(2);

    for (const target of runnerTargets) {
      const detail = target.equipmentReport?.footwearContactDetail;

      expect(detail?.meshCount).toBeGreaterThanOrEqual(6);
      expect(detail?.meshNames).toEqual(expect.arrayContaining([
        'shoe_footwear_left_contact_tread_toe',
        'shoe_footwear_left_contact_tread_heel',
        'shoe_footwear_left_lace_bridge',
        'shoe_footwear_right_contact_tread_toe',
        'shoe_footwear_right_contact_tread_heel',
        'shoe_footwear_right_lace_bridge',
      ]));
      expect(typeof detail?.sourceHasFootwear).toBe('boolean');
    }
  });

  it('keeps generated runner shoe contact detail inside production vertex budget', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/player-rig-candidate-report.json', 'utf8'));
    const runnerCandidates = report.candidates.filter((candidate) => candidate.recommendedProfile === 'runner');

    expect(runnerCandidates.length).toBeGreaterThanOrEqual(2);

    for (const candidate of runnerCandidates) {
      const runnerProfile = candidate.profiles.find((profile) => profile.profile === 'runner');

      expect(runnerProfile?.uploadedVertices).toBeLessThanOrEqual(runnerProfile?.maxVertices);
      expect(runnerProfile?.issues ?? []).not.toContain(
        `Vertex budget exceeded: ${runnerProfile?.uploadedVertices} / ${runnerProfile?.maxVertices}`,
      );
    }
  });

  it('purges orphaned Blender data between generated home and away targets', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('def purge_orphan_data():');
    expect(script).toContain('bpy.data.actions');
    expect(script).toContain('purge_orphan_data()');
    expect(script).toContain('purge_orphan_data()\n    export_glb(output_path)');
  });

  it('retargets named runner action clips and prunes hidden face details for browser candidates', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('def retarget_runner_required_clips():');
    expect(script).toContain('RUNNER_HIDDEN_DETAIL_MESHES');
    expect(script).toContain('"cc_base_eye"');
    expect(script).toContain('"cornea"');
    expect(script).toContain('"nail"');
    expect(script).toContain('"eyelash"');
    expect(script).toContain('hidden_material_slots');
    expect(script).toContain('bmesh.ops.delete');
    expect(script).toContain('remove_runner_hidden_detail_meshes()');
    expect(script).toContain('bpy.data.actions.new(clip_name)');
  });

  it('retargets lowered runner arms instead of leaving imported athletes in a wide rest pose', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('NORMAL_UPPER_ARM_DROP_DEGREES = 15.9');
    expect(script).toContain('MIN_NORMAL_UPPER_ARM_DROP_DEGREES = 13.6');
    expect(script).toContain('MAX_NORMAL_UPPER_ARM_LIFT_DEGREES = 13.6');
    expect(script).toContain('MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES = 13.6');
    expect(script).toContain('clamp_stick_action_upper_arm_exposure');
  });

  it('retargets two-hand stick-contact mechanics into source runner clips', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('STICK_ACTION_MIN_TWO_HAND_CONTACT_FRAMES = {');
    expect(script).toContain('"stick-handle": 21');
    expect(script).toContain('"forehand-pass": 20');
    expect(script).toContain('"receive-pass": 20');
    expect(script).toContain('"wrist-shot": 21');
    expect(script).toContain('derive_forearm_rotation(left_upperarm, -1, clip_name)');
    expect(script).toContain('derive_hand_rotation(right_upperarm, 1, clip_name)');
    expect(script).toContain('STICK_ACTION_RETARGET_CONTACT_SUPPORT_FRAME_INDICES');
  });

  it('braces feet and legs during retargeted stick-contact clips for close-camera mechanics', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('STICK_ACTION_LEG_DRIVE_RETARGET_SCALE = {');
    expect(script).toContain('derive_foot_rotation(left_leg, -1)');
    expect(script).toContain('derive_calf_rotation(left_leg, -1, sprint)');
    expect(script).toContain('for bone_key in ["left_thigh", "right_thigh", "left_calf", "right_calf", "left_foot", "right_foot"]');
    expect(script).toContain('minimumRetargetedStickActionLowerBodyLeadFrames');
  });

  it('strips imported image textures so production runners stay inside browser budgets', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('def strip_material_textures(material):');
    expect(script).toContain('node.type == "TEX_IMAGE"');
    expect(script).toContain('material.name = "skin_body"');
  });

  it('prunes imported generic actions and ships only required runner clips', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('def prune_unneeded_actions(required):');
    expect(script).toContain('prune_unneeded_actions(target["required_clips"])');
  });

  it('removes imported shape keys so runner GLBs do not ship morph-target payloads', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('def remove_shape_keys():');
    expect(script).toContain('obj.data.shape_keys.key_blocks');
    expect(script).toContain('bpy.ops.object.shape_key_remove(all=True)');
    expect(script).toContain('shapeKeysRemoved');
  });

  it('adds visible ball hockey equipment silhouette pieces to production runners', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('sock_shin_guard');
    expect(script).toContain('shoulder_elbow_pad');
    expect(script).toContain('sock_shin_guard_{side}_stripe');
    expect(script).toContain('shoulder_elbow_pad_{side}_shoulder');
  });

  it('keeps generated runner shoulder and elbow pads tucked for broadcast silhouettes', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_SHOULDER_PAD_LATERAL_MULTIPLIER')).toBeLessThanOrEqual(1.3);
    expect(valueFor('RUNNER_ELBOW_PAD_LATERAL_MULTIPLIER')).toBeLessThanOrEqual(1.44);
    expect(valueFor('RUNNER_SHOULDER_PAD_WIDTH_FACTOR')).toBeLessThanOrEqual(0.082);
    expect(valueFor('RUNNER_ELBOW_PAD_WIDTH_FACTOR')).toBeLessThanOrEqual(0.058);
    expect(valueFor('RUNNER_SHOULDER_PAD_DEPTH_FACTOR')).toBeLessThanOrEqual(0.068);
    expect(valueFor('RUNNER_ELBOW_PAD_DEPTH_FACTOR')).toBeLessThanOrEqual(0.054);
  });

  it('exports shoulder cap and elbow strap details so arm pads hold up close', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_SHOULDER_PAD_CAP_STRAP_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.078);
    expect(valueFor('RUNNER_SHOULDER_PAD_CAP_STRAP_DEPTH_FACTOR')).toBeLessThanOrEqual(0.016);
    expect(valueFor('RUNNER_SHOULDER_PAD_CAP_STRAP_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.01);
    expect(valueFor('RUNNER_ELBOW_PAD_STRAP_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.052);
    expect(valueFor('RUNNER_ELBOW_PAD_STRAP_DEPTH_FACTOR')).toBeLessThanOrEqual(0.016);
    expect(valueFor('RUNNER_ELBOW_PAD_STRAP_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.01);
    expect(script).toContain('equipment_strap');
    expect(script).toContain('shoulder_elbow_pad_{side}_shoulder_cap_strap');
    expect(script).toContain('shoulder_elbow_pad_{side}_elbow_upper_strap');
    expect(script).toContain('shoulder_elbow_pad_{side}_elbow_lower_strap');
  });

  it('exports compact volumetric runner jersey sleeves instead of flat wide arm strips', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_JERSEY_SLEEVE_LATERAL_OFFSET_FACTOR')).toBeLessThanOrEqual(0.132);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_LENGTH_FACTOR')).toBeLessThanOrEqual(0.13);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_DEPTH_FACTOR')).toBeGreaterThanOrEqual(0.04);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.07);
    expect(script).toContain('RUNNER_JERSEY_SLEEVE_LENGTH_FACTOR');
    expect(script).toContain('add_rounded_box(');
    expect(script).not.toContain('sleeve.scale.y = 0.78');
  });

  it('exports jersey collar, yoke, and sleeve cuffs for close-camera uniform detail', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_JERSEY_COLLAR_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.12);
    expect(valueFor('RUNNER_JERSEY_COLLAR_DEPTH_FACTOR')).toBeLessThanOrEqual(0.024);
    expect(valueFor('RUNNER_JERSEY_COLLAR_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.018);
    expect(valueFor('RUNNER_JERSEY_YOKE_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.3);
    expect(valueFor('RUNNER_JERSEY_YOKE_DEPTH_FACTOR')).toBeLessThanOrEqual(0.016);
    expect(valueFor('RUNNER_JERSEY_YOKE_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.05);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_CUFF_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.09);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_CUFF_DEPTH_FACTOR')).toBeLessThanOrEqual(0.018);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_CUFF_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.018);
    expect(script).toContain('jersey_uniform_top_collar');
    expect(script).toContain('jersey_uniform_top_shoulder_yoke');
    expect(script).toContain('jersey_uniform_top_{side}_sleeve_cuff');
  });

  it('exports sleeve shoulder stripes so close cameras read uniform detail at the upper arm', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.088);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_WIDTH_FACTOR')).toBeLessThanOrEqual(0.112);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_DEPTH_FACTOR')).toBeLessThanOrEqual(0.014);
    expect(valueFor('RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.014);
    expect(script).toContain('jersey_uniform_top_{side}_sleeve_shoulder_stripe');
    expect(script).toContain('RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_HEIGHT_FACTOR');
  });

  it('exports shoulder seam tape so sleeve caps read connected to the jersey yoke', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_JERSEY_SHOULDER_SEAM_TAPE_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.06);
    expect(valueFor('RUNNER_JERSEY_SHOULDER_SEAM_TAPE_WIDTH_FACTOR')).toBeLessThanOrEqual(0.082);
    expect(valueFor('RUNNER_JERSEY_SHOULDER_SEAM_TAPE_DEPTH_FACTOR')).toBeLessThanOrEqual(0.012);
    expect(valueFor('RUNNER_JERSEY_SHOULDER_SEAM_TAPE_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.032);
    expect(script).toContain('jersey_uniform_top_{side}_shoulder_seam_tape');
    expect(script).toContain('RUNNER_JERSEY_SHOULDER_SEAM_TAPE_HEIGHT_FACTOR');
  });

  it('exports shoulder socket bridges so upper arms read connected in close cameras', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_SHOULDER_SOCKET_BRIDGE_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.048);
    expect(valueFor('RUNNER_SHOULDER_SOCKET_BRIDGE_WIDTH_FACTOR')).toBeLessThanOrEqual(0.064);
    expect(valueFor('RUNNER_SHOULDER_SOCKET_BRIDGE_DEPTH_FACTOR')).toBeLessThanOrEqual(0.014);
    expect(valueFor('RUNNER_SHOULDER_SOCKET_BRIDGE_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.07);
    expect(script).toContain('jersey_socket_bridge');
    expect(script).toContain('jersey_uniform_top_{side}_shoulder_socket_bridge');
    expect(script).toContain('shoulderSocketDetail');
  });

  it('reports shoulder socket detail evidence for every generated runner', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(runnerTargets.length).toBeGreaterThanOrEqual(2);

    for (const target of runnerTargets) {
      const detail = target.equipmentReport?.shoulderSocketDetail;

      expect(detail?.meshCount).toBeGreaterThanOrEqual(2);
      expect(detail?.meshNames).toEqual(expect.arrayContaining([
        'jersey_uniform_top_left_shoulder_socket_bridge',
        'jersey_uniform_top_right_shoulder_socket_bridge',
      ]));
      expect(detail?.bridgeWidthFactor).toBeGreaterThanOrEqual(0.048);
      expect(detail?.bridgeHeightFactor).toBeGreaterThanOrEqual(0.07);
    }
  });

  it('exports neck guard and chin straps so helmets read connected to the athlete', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_NECK_GUARD_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.06);
    expect(valueFor('RUNNER_NECK_GUARD_WIDTH_FACTOR')).toBeLessThanOrEqual(0.09);
    expect(valueFor('RUNNER_NECK_GUARD_DEPTH_FACTOR')).toBeLessThanOrEqual(0.06);
    expect(valueFor('RUNNER_NECK_GUARD_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.045);
    expect(valueFor('RUNNER_CHIN_STRAP_WIDTH_FACTOR')).toBeLessThanOrEqual(0.014);
    expect(valueFor('RUNNER_CHIN_STRAP_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.05);
    expect(script).toContain('neck_guard_collar');
    expect(script).toContain('helmet_cage_visor_chin_strap_{side}');
    expect(script).toContain('neckConnectionDetail');
  });

  it('exports upper-arm underarm gussets so shoulder sleeves do not reveal bare gaps', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_JERSEY_UNDERARM_GUSSET_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.032);
    expect(valueFor('RUNNER_JERSEY_UNDERARM_GUSSET_WIDTH_FACTOR')).toBeLessThanOrEqual(0.05);
    expect(valueFor('RUNNER_JERSEY_UNDERARM_GUSSET_DEPTH_FACTOR')).toBeLessThanOrEqual(0.022);
    expect(valueFor('RUNNER_JERSEY_UNDERARM_GUSSET_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.09);
    expect(script).toContain('jersey_underarm_gusset');
    expect(script).toContain('jersey_uniform_top_{side}_underarm_gusset');
  });

  it('exports compact runner gloves so broadcast arms read equipped, not blobbed', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_GLOVE_LATERAL_OFFSET_FACTOR')).toBeLessThanOrEqual(0.152);
    expect(valueFor('RUNNER_GLOVE_WIDTH_FACTOR')).toBeLessThanOrEqual(0.044);
    expect(valueFor('RUNNER_GLOVE_DEPTH_FACTOR')).toBeLessThanOrEqual(0.038);
    expect(valueFor('RUNNER_GLOVE_HEIGHT_FACTOR')).toBeLessThanOrEqual(0.05);
    expect(valueFor('RUNNER_GLOVE_CUFF_WIDTH_FACTOR')).toBeLessThanOrEqual(0.052);
    expect(valueFor('RUNNER_GLOVE_CUFF_DEPTH_FACTOR')).toBeLessThanOrEqual(0.036);
    expect(valueFor('RUNNER_GLOVE_CUFF_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.018);
    expect(valueFor('RUNNER_GLOVE_THUMB_GUARD_WIDTH_FACTOR')).toBeLessThanOrEqual(0.026);
    expect(valueFor('RUNNER_GLOVE_THUMB_GUARD_DEPTH_FACTOR')).toBeLessThanOrEqual(0.026);
    expect(valueFor('RUNNER_GLOVE_THUMB_GUARD_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.028);
    expect(valueFor('RUNNER_GLOVE_KNUCKLE_RIDGE_WIDTH_FACTOR')).toBeLessThanOrEqual(0.01);
    expect(valueFor('RUNNER_GLOVE_KNUCKLE_RIDGE_DEPTH_FACTOR')).toBeGreaterThanOrEqual(0.034);
    expect(valueFor('RUNNER_GLOVE_KNUCKLE_RIDGE_HEIGHT_FACTOR')).toBeLessThanOrEqual(0.01);
    expect(script).toContain('RUNNER_GLOVE_WIDTH_FACTOR');
    expect(script).toContain('glove_mitt_{side}_wrist_cuff');
    expect(script).toContain('glove_mitt_{side}_thumb_guard');
    expect(script).toContain('glove_mitt_{side}_knuckle_ridge');
  });

  it('exports glove palm grip and wrist tape so stick contact reads anchored', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_GLOVE_PALM_GRIP_WIDTH_FACTOR')).toBeLessThanOrEqual(0.03);
    expect(valueFor('RUNNER_GLOVE_PALM_GRIP_DEPTH_FACTOR')).toBeLessThanOrEqual(0.014);
    expect(valueFor('RUNNER_GLOVE_PALM_GRIP_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.024);
    expect(valueFor('RUNNER_GLOVE_WRIST_TAPE_WIDTH_FACTOR')).toBeLessThanOrEqual(0.056);
    expect(valueFor('RUNNER_GLOVE_WRIST_TAPE_DEPTH_FACTOR')).toBeLessThanOrEqual(0.018);
    expect(valueFor('RUNNER_GLOVE_WRIST_TAPE_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.008);
    expect(script).toContain('glove_grip_tape');
    expect(script).toContain('glove_mitt_{side}_palm_grip_pad');
    expect(script).toContain('glove_mitt_{side}_wrist_tape');
  });

  it('exports compact forearm sleeves so runner arms do not read as bare pale rods', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_FOREARM_SLEEVE_LATERAL_MULTIPLIER')).toBeGreaterThanOrEqual(1.26);
    expect(valueFor('RUNNER_FOREARM_SLEEVE_LATERAL_MULTIPLIER')).toBeLessThanOrEqual(1.32);
    expect(valueFor('RUNNER_FOREARM_SLEEVE_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.072);
    expect(valueFor('RUNNER_FOREARM_SLEEVE_WIDTH_FACTOR')).toBeLessThanOrEqual(0.088);
    expect(valueFor('RUNNER_FOREARM_SLEEVE_DEPTH_FACTOR')).toBeGreaterThanOrEqual(0.052);
    expect(valueFor('RUNNER_FOREARM_SLEEVE_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.16);
    expect(script).toContain('compression_sleeve_forearm');
    expect(script).toContain('compression_sleeve');
    expect(script).toContain('RUNNER_FOREARM_SLEEVE_HEIGHT_FACTOR');
  });

  it('exports elbow flex bands so upper-arm and forearm sleeves read connected', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_ELBOW_FLEX_BAND_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.062);
    expect(valueFor('RUNNER_ELBOW_FLEX_BAND_WIDTH_FACTOR')).toBeLessThanOrEqual(0.078);
    expect(valueFor('RUNNER_ELBOW_FLEX_BAND_DEPTH_FACTOR')).toBeLessThanOrEqual(0.018);
    expect(valueFor('RUNNER_ELBOW_FLEX_BAND_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.022);
    expect(script).toContain('compression_sleeve_{side}_elbow_flex_band');
    expect(script).toContain('RUNNER_ELBOW_FLEX_BAND_HEIGHT_FACTOR');
  });

  it('exports compact upper-arm compression sleeves to cover shoulder-to-elbow skin exposure', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(valueFor('RUNNER_UPPER_ARM_COMPRESSION_LATERAL_MULTIPLIER')).toBeGreaterThanOrEqual(1.16);
    expect(valueFor('RUNNER_UPPER_ARM_COMPRESSION_LATERAL_MULTIPLIER')).toBeLessThanOrEqual(1.22);
    expect(valueFor('RUNNER_UPPER_ARM_COMPRESSION_WIDTH_FACTOR')).toBeGreaterThanOrEqual(0.082);
    expect(valueFor('RUNNER_UPPER_ARM_COMPRESSION_WIDTH_FACTOR')).toBeLessThanOrEqual(0.102);
    expect(valueFor('RUNNER_UPPER_ARM_COMPRESSION_DEPTH_FACTOR')).toBeGreaterThanOrEqual(0.052);
    expect(valueFor('RUNNER_UPPER_ARM_COMPRESSION_HEIGHT_FACTOR')).toBeGreaterThanOrEqual(0.13);
    expect(script).toContain('compression_sleeve_upperarm');
    expect(script).toContain('RUNNER_UPPER_ARM_COMPRESSION_HEIGHT_FACTOR');
  });

  it('repaints skinned body arm faces as compression sleeves so weighted arms do not stay pale', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const valueFor = (name) => Number(script.match(new RegExp(`${name}\\s*=\\s*([0-9.]+)`))?.[1]);

    expect(script).toContain('def assign_runner_skinned_arm_compression_faces');
    expect(script).toContain('def compact_runner_skinned_arm_geometry');
    expect(script).toContain('compression_sleeve_skinned_arm');
    expect(script).toContain('face.material_index = compression_index');
    expect(script).toContain('skinArmGeometryCompaction');
    expect(script).toContain('assign_runner_skinned_arm_compression_faces(compression_mat)');
    expect(valueFor('RUNNER_SKIN_ARM_LATERAL_MIN_FACTOR')).toBeGreaterThanOrEqual(0.12);
    expect(valueFor('RUNNER_SKIN_ARM_LATERAL_MIN_FACTOR')).toBeLessThanOrEqual(0.128);
    expect(valueFor('RUNNER_SKIN_ARM_WIDTH_CAP_FACTOR')).toBeGreaterThanOrEqual(0.34);
    expect(valueFor('RUNNER_SKIN_ARM_WIDTH_CAP_FACTOR')).toBeLessThanOrEqual(0.38);
    expect(valueFor('RUNNER_SKIN_ARM_VERTICAL_MIN_FACTOR')).toBeLessThanOrEqual(0.48);
    expect(valueFor('RUNNER_SKIN_ARM_VERTICAL_MIN_FACTOR')).toBeLessThanOrEqual(0.42);
    expect(valueFor('RUNNER_SKIN_ARM_VERTICAL_MAX_FACTOR')).toBeGreaterThanOrEqual(0.76);
    expect(valueFor('RUNNER_SKIN_ARM_VERTICAL_MAX_FACTOR')).toBeGreaterThanOrEqual(0.82);
  });

  it('reports skinned-arm compression repaint evidence for every generated runner', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(runnerTargets.length).toBeGreaterThanOrEqual(2);

    for (const target of runnerTargets) {
      const cleanup = target.equipmentReport?.skinArmCompression;

      expect(cleanup?.facesRepainted).toBeGreaterThan(0);
      expect(cleanup?.facesRepainted).toBeGreaterThanOrEqual(3800);
      expect(cleanup?.objectCount).toBeGreaterThan(0);
      expect(cleanup?.lateralMinFactor).toBeGreaterThanOrEqual(0.12);
      expect(cleanup?.lateralMinFactor).toBeLessThanOrEqual(0.128);
      const compaction = target.equipmentReport?.skinArmGeometryCompaction;
      expect(compaction?.verticesCompacted).toBeGreaterThan(0);
      expect(compaction?.widthCapFactor).toBeGreaterThanOrEqual(0.34);
      expect(compaction?.widthCapFactor).toBeLessThanOrEqual(0.38);
      expect(target.scaleReport?.after?.width).toBeLessThanOrEqual(1.55);
      expect(cleanup?.verticalMinFactor).toBeLessThanOrEqual(0.48);
      expect(cleanup?.verticalMinFactor).toBeLessThanOrEqual(0.42);
      expect(cleanup?.verticalMaxFactor).toBeGreaterThanOrEqual(0.76);
      expect(cleanup?.verticalMaxFactor).toBeGreaterThanOrEqual(0.82);
    }
  });

  it('prunes runner skin weights to the glTF four-joint influence budget before export', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('GLTF_MAX_VERTEX_JOINT_INFLUENCES = 4');
    expect(script).toContain('def prune_runner_skin_weights_for_gltf():');
    expect(script).toContain('skinWeightPruning');
    expect(script).toContain('maxInfluencesAfter');
    expect(script).toContain('.remove([vertex.index])');
  });

  it('snapshots runner skin weights before pruning so Blender group handles do not go stale', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('vertex_group_weights = sorted(');
    expect(script).toContain('(group.group, group.weight)');
    expect(script).toContain('for group_index, _weight in removed:');
    expect(script).toContain('for group_index, weight in kept:');
    expect(script).not.toContain('obj.vertex_groups[group.group].add');
  });

  it('reports skin-weight pruning evidence for every generated runner', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(runnerTargets.length).toBeGreaterThanOrEqual(2);

    for (const target of runnerTargets) {
      const pruning = target.equipmentReport?.skinWeightPruning;

      expect(pruning?.maxAllowedInfluences).toBe(4);
      expect(pruning?.verticesVisited).toBeGreaterThan(0);
      expect(pruning?.maxInfluencesBefore).toBeGreaterThanOrEqual(pruning?.maxInfluencesAfter);
      expect(pruning?.maxInfluencesAfter).toBeLessThanOrEqual(4);
      expect(pruning?.objectCount).toBeGreaterThan(0);
    }
  });

  it('reports neck connection detail evidence for every generated runner', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(runnerTargets.length).toBeGreaterThanOrEqual(2);

    for (const target of runnerTargets) {
      const neckDetail = target.equipmentReport?.neckConnectionDetail;

      expect(neckDetail?.meshCount).toBeGreaterThanOrEqual(3);
      expect(neckDetail?.meshNames).toContain('neck_guard_collar');
      expect(neckDetail?.meshNames).toContain('helmet_cage_visor_chin_strap_left');
      expect(neckDetail?.meshNames).toContain('helmet_cage_visor_chin_strap_right');
    }
  });

  it('does not generate a detached static runner stick because the replay supplies the controlled stick', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).not.toContain('add_cylinder(\n        "stick_shaft_blade"');
    expect(script).not.toContain('add_cube(\n        "stick_blade"');
  });
});
