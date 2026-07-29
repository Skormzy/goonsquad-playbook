import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BASE_PATH = SCRIPT_DIR / 'refine_vnext_tailored_uniform.py'
BASE_SPEC = importlib.util.spec_from_file_location('vnext_tailored_base', BASE_PATH)
base = importlib.util.module_from_spec(BASE_SPEC)
BASE_SPEC.loader.exec_module(base)


TORSO_RINGS = (
    {'z': 95.2, 'x': 22.8, 'front': 14.1, 'back': 13.2, 'center_y': 1.4, 'fold': 0.75},
    {'z': 99.0, 'x': 23.1, 'front': 14.0, 'back': 13.1, 'center_y': 1.4, 'fold': 0.65},
    {'z': 105.0, 'x': 22.7, 'front': 13.5, 'back': 12.8, 'center_y': 1.5, 'fold': 0.50},
    {'z': 112.0, 'x': 22.0, 'front': 13.0, 'back': 12.4, 'center_y': 1.6, 'fold': 0.38},
    {'z': 121.0, 'x': 22.2, 'front': 13.1, 'back': 12.5, 'center_y': 1.7, 'fold': 0.28},
    {'z': 131.0, 'x': 23.1, 'front': 13.8, 'back': 13.0, 'center_y': 1.8, 'fold': 0.20},
    {'z': 140.0, 'x': 24.2, 'front': 14.4, 'back': 13.4, 'center_y': 2.0, 'fold': 0.14},
    {'z': 147.0, 'x': 23.1, 'front': 13.7, 'back': 12.8, 'center_y': 2.3, 'fold': 0.10},
    {'z': 152.0, 'x': 19.5, 'front': 11.9, 'back': 11.2, 'center_y': 2.7, 'fold': 0.06},
    {'z': 155.4, 'x': 14.5, 'front': 9.2, 'back': 8.6, 'center_y': 3.2, 'fold': 0.03},
    {'z': 157.6, 'x': 9.0, 'front': 6.7, 'back': 6.2, 'center_y': 3.7, 'fold': 0.0},
)


SLEEVE_PROFILE = (
    {'x': 18.0, 'y': 5.8, 'z': 145.5, 'vertical': 3.0, 'depth': 3.8, 'gather': 0.00},
    {'x': 22.5, 'y': 6.1, 'z': 145.7, 'vertical': 5.8, 'depth': 5.7, 'gather': 0.01},
    {'x': 27.0, 'y': 6.3, 'z': 144.5, 'vertical': 7.4, 'depth': 6.6, 'gather': 0.02},
    {'x': 32.5, 'y': 6.4, 'z': 141.0, 'vertical': 7.3, 'depth': 6.5, 'gather': 0.02},
    {'x': 37.5, 'y': 6.4, 'z': 137.8, 'vertical': 6.9, 'depth': 6.1, 'gather': 0.035},
    {'x': 41.0, 'y': 6.4, 'z': 135.6, 'vertical': 7.6, 'depth': 6.7, 'gather': 0.065},
    {'x': 43.5, 'y': 6.4, 'z': 134.0, 'vertical': 6.1, 'depth': 5.7, 'gather': 0.085},
    {'x': 46.0, 'y': 6.35, 'z': 132.5, 'vertical': 7.2, 'depth': 6.4, 'gather': 0.070},
    {'x': 50.0, 'y': 6.3, 'z': 130.2, 'vertical': 6.2, 'depth': 5.6, 'gather': 0.045},
    {'x': 54.0, 'y': 6.2, 'z': 127.8, 'vertical': 5.8, 'depth': 5.2, 'gather': 0.025},
    {'x': 57.5, 'y': 6.1, 'z': 125.6, 'vertical': 5.3, 'depth': 4.8, 'gather': 0.015},
    {'x': 60.0, 'y': 6.0, 'z': 124.2, 'vertical': 5.0, 'depth': 4.5, 'gather': 0.00, 'cuff': True},
    {'x': 61.8, 'y': 6.0, 'z': 123.3, 'vertical': 4.5, 'depth': 4.2, 'gather': 0.00, 'cuff': True},
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def torso_point(ring, ring_index, segment, segments):
    angle = math.tau * segment / segments
    cosine = math.cos(angle)
    sine = math.sin(angle)
    x_component = base.superellipse_component(cosine, 2.28)
    y_component = base.superellipse_component(sine, 2.18)
    depth = ring['front'] if sine < 0.0 else ring['back']
    lower_drape = max(0.0, 1.0 - ring_index / 7.0)
    radial_fold = (
        math.sin(angle * 3.0 + ring_index * 0.42) * 0.56
        + math.sin(angle * 7.0 - ring_index * 0.31) * 0.26
    ) * ring['fold']
    side_fold = math.sin(angle * 2.0 + 0.7) * ring['fold'] * 0.12
    x = ring['x'] * x_component + side_fold * lower_drape
    y = ring['center_y'] + depth * y_component + radial_fold * lower_drape
    z = ring['z']
    if ring_index <= 1:
        z -= (abs(sine) ** 1.8) * (0.85 - ring_index * 0.25)
    return (x, y, z)


def build_torso(side, collection, armature, body_material, accent_material, segments=64):
    vertices = []
    weights = []
    for ring_index, ring in enumerate(TORSO_RINGS):
        for segment in range(segments):
            point = torso_point(ring, ring_index, segment, segments)
            vertices.append(point)
            weights.append(base.torso_weights(point[2], point[0]))

    faces = []
    material_indices = []
    for ring_index in range(len(TORSO_RINGS) - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            face = (
                ring_index * segments + segment,
                ring_index * segments + next_segment,
                (ring_index + 1) * segments + next_segment,
                (ring_index + 1) * segments + segment,
            )
            faces.append(face)
            center = sum((Vector(vertices[index]) for index in face), Vector()) / 4.0
            raglan_threshold = 7.4 + max(0.0, 155.5 - center.z) * 0.72
            raglan = center.z >= 138.0 and abs(center.x) >= raglan_threshold
            hem = center.z <= 98.0
            material_indices.append(1 if raglan or hem else 0)

    obj = base.create_object(
        f'GS_{side}_Jersey',
        collection,
        armature,
        vertices,
        faces,
        (body_material, accent_material),
    )
    obj['uniform_refinement'] = 'shaped-cloth-drape-v3'
    obj['garment_component'] = 'shaped-torso-raglan-yoke-and-draped-hem'
    obj['cloth_features'] = 'waist-taper, chest-volume, curved-hem, low-amplitude-drape-folds'
    base.apply_weights(obj, weights)
    base.add_uvs(obj, len(TORSO_RINGS), segments)
    for polygon, material_index in zip(obj.data.polygons, material_indices):
        polygon.material_index = material_index
    return obj


def sleeve_basis(centers, index):
    if index == 0:
        tangent = (centers[1] - centers[0]).normalized()
    elif index == len(centers) - 1:
        tangent = (centers[-1] - centers[-2]).normalized()
    else:
        tangent = (centers[index + 1] - centers[index - 1]).normalized()
    depth = Vector((0.0, 1.0, 0.0))
    depth -= tangent * depth.dot(tangent)
    depth.normalize()
    vertical = tangent.cross(depth).normalized()
    if vertical.z < 0.0:
        vertical.negate()
    return tangent, depth, vertical


def sleeve_weights(label, ring_index):
    prefix = 'L' if label == 'Left' else 'R'
    clavicle = f'CC_Base_{prefix}_Clavicle'
    upper = f'CC_Base_{prefix}_Upperarm'
    upper_one = f'CC_Base_{prefix}_UpperarmTwist01'
    upper_two = f'CC_Base_{prefix}_UpperarmTwist02'
    elbow = f'CC_Base_{prefix}_ElbowShareBone'
    forearm_one = f'CC_Base_{prefix}_ForearmTwist01'
    forearm_two = f'CC_Base_{prefix}_ForearmTwist02'
    hand = f'CC_Base_{prefix}_Hand'
    profiles = (
        {'CC_Base_Spine02': 0.48, clavicle: 0.44, upper: 0.08},
        {clavicle: 0.58, upper: 0.42},
        {clavicle: 0.18, upper_one: 0.58, upper_two: 0.24},
        {upper_one: 0.62, upper_two: 0.38},
        {upper_one: 0.24, upper_two: 0.66, elbow: 0.10},
        {upper_two: 0.45, elbow: 0.28, forearm_one: 0.27},
        {upper_two: 0.18, elbow: 0.46, forearm_one: 0.36},
        {elbow: 0.22, forearm_one: 0.58, forearm_two: 0.20},
        {forearm_one: 0.58, forearm_two: 0.42},
        {forearm_one: 0.30, forearm_two: 0.70},
        {forearm_two: 0.86, hand: 0.14},
        {forearm_two: 0.72, hand: 0.28},
        {forearm_two: 0.50, hand: 0.50},
    )
    return profiles[ring_index]


def build_sleeve(side, label, collection, armature, sleeve_material, cuff_material, segments=40):
    sign = 1.0 if label == 'Left' else -1.0
    centers = [Vector((sign * ring['x'], ring['y'], ring['z'])) for ring in SLEEVE_PROFILE]
    vertices = []
    weights = []
    for ring_index, (profile, center) in enumerate(zip(SLEEVE_PROFILE, centers)):
        tangent, depth, vertical = sleeve_basis(centers, ring_index)
        for segment in range(segments):
            angle = math.tau * segment / segments
            gather_wave = (
                math.sin(angle * 4.0 + ring_index * 0.73) * 0.68
                + math.sin(angle * 7.0 - ring_index * 0.41) * 0.32
            )
            radial_scale = 1.0 + profile['gather'] * gather_wave
            axial_crease = profile['gather'] * 4.2 * math.sin(angle * 3.0 + ring_index * 0.57)
            point = (
                center
                + tangent * axial_crease
                + depth * math.cos(angle) * profile['depth'] * radial_scale
                + vertical * math.sin(angle) * profile['vertical'] * radial_scale
            )
            vertices.append(tuple(point))
            weights.append(sleeve_weights(label, ring_index))

    faces = []
    material_indices = []
    for ring_index in range(len(SLEEVE_PROFILE) - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((
                ring_index * segments + segment,
                ring_index * segments + next_segment,
                (ring_index + 1) * segments + next_segment,
                (ring_index + 1) * segments + segment,
            ))
            material_indices.append(1 if SLEEVE_PROFILE[ring_index + 1].get('cuff') else 0)

    obj = base.create_object(
        f'GS_{side}_Jersey_Sleeve_{label}',
        collection,
        armature,
        vertices,
        faces,
        (sleeve_material, cuff_material),
    )
    obj['uniform_refinement'] = 'shaped-cloth-drape-v3'
    obj['garment_component'] = f'gathered-{label.lower()}-sleeve-and-ribbed-cuff'
    obj['cloth_features'] = 'upper-arm-volume, elbow-compression-rings, forearm-taper, integrated-cuff'
    base.apply_weights(obj, weights)
    base.add_uvs(obj, len(SLEEVE_PROFILE), segments)
    for polygon, material_index in zip(obj.data.polygons, material_indices):
        polygon.material_index = material_index
    return obj


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    armature = bpy.data.objects.get(base.ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing {base.ARMATURE_NAME}.')
    missing_actions = [name for name in base.REQUIRED_ACTIONS if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing actions: ' + ', '.join(missing_actions))

    armature.data.pose_position = 'REST'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    counts_before = base.action_key_counts()
    variants = {}
    for side in base.SIDES:
        collection = bpy.data.collections.get(f'GS_Equipment_{side}')
        source_jersey = bpy.data.objects.get(f'GS_{side}_Jersey')
        if collection is None or source_jersey is None or len(source_jersey.data.materials) < 2:
            raise RuntimeError(f'Missing {side} source garment or materials.')
        body_material = source_jersey.data.materials[0]
        accent_material = source_jersey.data.materials[1]
        before = base.topology_summary(source_jersey)
        removed = base.remove_previous_garment(side)
        torso = build_torso(side, collection, armature, body_material, accent_material)
        left = build_sleeve(side, 'Left', collection, armature, accent_material, body_material)
        right = build_sleeve(side, 'Right', collection, armature, accent_material, body_material)
        marks = base.reposition_uniform_marks(side, torso)
        variants[side.lower()] = {
            'removedObjects': removed,
            'before': before,
            'torso': base.topology_summary(torso),
            'leftSleeve': base.topology_summary(left),
            'rightSleeve': base.topology_summary(right),
            'marks': marks,
        }

    counts_after = base.action_key_counts()
    if counts_after != counts_before:
        raise RuntimeError('Cloth drape authoring changed animation key counts.')

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_uniform_status'] = 'shaped-cloth-drape-private-review'
    bpy.context.scene['vnext_uniform_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'shaped-cloth-drape-authored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'construction': {
            'torsoRings': len(TORSO_RINGS),
            'torsoSegments': 64,
            'sleeveRings': len(SLEEVE_PROFILE),
            'sleeveSegments': 40,
            'elbowCompressionRings': [5, 6, 7],
            'cuffRings': [11, 12],
            'method': 'shaped-drape-torso-with-gathered-elbow-sleeves-and-integrated-cuffs',
        },
        'variants': variants,
        'actionKeyCounts': {
            name: {'before': counts_before[name], 'after': counts_after[name]}
            for name in sorted(counts_before)
        },
        'reviewBoundary': (
            'The shaped garment remains private until all actions pass close front, rear, side, '
            'three-quarter, deformation, runtime, and explicit human visual review.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_CLOTH_DRAPE_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
