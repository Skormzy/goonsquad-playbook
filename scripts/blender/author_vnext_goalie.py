import argparse
import json
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from author_vnext_field_player_equipment import (
    add_armature_modifier,
    box_geometry,
    cylinder_between,
    make_material,
    rigid_mesh,
    shoe_geometry,
    surface_from_body,
)
from author_vnext_field_player_motion import (
    ANIMATED_BONES,
    aim_bone,
    bake_nonpenetration,
    evaluated_min_z,
    normalized,
    reset_pose,
    set_interpolation,
    with_overrides,
)


REQUIRED_ACTIONS = ('goalie-ready', 'goalie-shuffle', 'goalie-set', 'goalie-save-glove', 'goalie-save-blocker')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def ellipsoid_geometry(center, radii, segments=24, rings=12):
    cx, cy, cz = center
    rx, ry, rz = radii
    vertices = [(cx, cy, cz + rz)]
    for ring in range(1, rings):
        phi = math.pi * ring / rings
        for segment in range(segments):
            theta = math.tau * segment / segments
            vertices.append((
                cx + rx * math.sin(phi) * math.cos(theta),
                cy + ry * math.sin(phi) * math.sin(theta),
                cz + rz * math.cos(phi),
            ))
    vertices.append((cx, cy, cz - rz))
    top = 0
    bottom = len(vertices) - 1
    faces = []
    for segment in range(segments):
        next_segment = (segment + 1) % segments
        faces.append((top, 1 + next_segment, 1 + segment))
    for ring in range(rings - 2):
        start = 1 + ring * segments
        next_start = start + segments
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((start + segment, start + next_segment, next_start + next_segment, next_start + segment))
    last_start = 1 + (rings - 2) * segments
    for segment in range(segments):
        next_segment = (segment + 1) % segments
        faces.append((last_start + segment, last_start + next_segment, bottom))
    return vertices, faces


def tapered_pad_geometry(center_x, front_y=-10.5, back_y=6.0, bottom_z=6.5, top_z=78.0):
    bottom_half = 7.7
    top_half = 9.1
    vertices = [
        (center_x - bottom_half, front_y, bottom_z),
        (center_x + bottom_half, front_y, bottom_z),
        (center_x + top_half, front_y, top_z),
        (center_x - top_half, front_y, top_z),
        (center_x - bottom_half, back_y, bottom_z),
        (center_x + bottom_half, back_y, bottom_z),
        (center_x + top_half, back_y, top_z),
        (center_x - top_half, back_y, top_z),
    ]
    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (1, 2, 6, 5),
        (2, 3, 7, 6), (3, 0, 4, 7),
    ]
    return vertices, faces


def weighted_ellipsoid(name, center, radii, armature, collection, material, bone_name, bevel=0.0):
    vertices, faces = ellipsoid_geometry(center, radii)
    return rigid_mesh(name, vertices, faces, armature, collection, material, bone_name, bevel=bevel)


def weighted_box(name, center, size, armature, collection, material, bone_name, bevel=0.0):
    vertices, faces = box_geometry(center, size)
    return rigid_mesh(name, vertices, faces, armature, collection, material, bone_name, bevel=bevel)


def remove_collection_tree(collection):
    for child in list(collection.children):
        remove_collection_tree(child)
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)


def remove_field_equipment():
    root = bpy.data.collections.get('GS_FieldPlayer_Equipment')
    if root:
        remove_collection_tree(root)
    for obj in list(bpy.data.objects):
        if obj.get('equipment_group') or obj.name.startswith(('GS_Home_', 'GS_Away_')):
            bpy.data.objects.remove(obj, do_unlink=True)


def tag(obj, group):
    obj['goalie_equipment_group'] = group
    return obj


def build_goalie_variant(side, body, armature, parent, materials):
    collection = bpy.data.collections.new(f'GS_Goalie_{side}')
    parent.children.link(collection)
    prefix = f'GS_Goalie_{side}'

    def expand_jersey(coordinate):
        if abs(coordinate.x) < 31:
            coordinate.x *= 1.13
            coordinate.y *= 1.25
        else:
            coordinate.x *= 1.045
            coordinate.y *= 1.14
        return coordinate

    def expand_pants(coordinate):
        coordinate.x *= 1.27
        coordinate.y *= 1.34
        return coordinate

    tag(weighted_box(
        f'{prefix}_Chest_Protector', (0, 0.5, 129.0), (50.0, 18.0, 40.0),
        armature, collection, materials['jersey'], 'CC_Base_Spine02', bevel=4.2,
    ), 'chest-protector')
    tag(surface_from_body(
        body, armature, collection, f'{prefix}_Jersey',
        lambda c: (91 < c.z < 160 and abs(c.x) < 31) or (111 < c.z < 153 and 18 < abs(c.x) < 68),
        2.55, materials['jersey'], transform=expand_jersey, smooth_iterations=8,
    ), 'jersey')
    tag(surface_from_body(
        body, armature, collection, f'{prefix}_Jersey_Accent',
        lambda c: 124 < c.z < 151 and 44 < abs(c.x) < 54,
        2.95, materials['accent'], transform=expand_jersey, smooth_iterations=3,
    ), 'jersey-accent')
    tag(surface_from_body(
        body, armature, collection, f'{prefix}_Padded_Pants',
        lambda c: 57 < c.z < 106 and abs(c.x) < 34,
        3.15, materials['pants'], transform=expand_pants, smooth_iterations=5,
    ), 'padded-pants')

    for label, sign, calf_bone, foot_bone in [
        ('Left', 1, 'CC_Base_L_Calf', 'CC_Base_L_Foot'),
        ('Right', -1, 'CC_Base_R_Calf', 'CC_Base_R_Foot'),
    ]:
        center_x = sign * 9.1
        pad_vertices, pad_faces = tapered_pad_geometry(center_x)
        tag(rigid_mesh(
            f'{prefix}_Leg_Pad_{label}', pad_vertices, pad_faces, armature, collection,
            materials['pad'], calf_bone, bevel=2.6,
        ), 'leg-pad')
        for index, z in enumerate((43.0, 50.5, 58.0)):
            tag(cylinder_between(
                f'{prefix}_Knee_Roll_{label}_{index + 1}',
                (center_x - 7.4, -12.0, z), (center_x + 7.4, -12.0, z), 3.1,
                armature, collection, materials['pad'], calf_bone, segments=18,
            ), 'leg-pad')
        for index, x_offset in enumerate((-4.8, 0.0, 4.8)):
            tag(weighted_box(
                f'{prefix}_Pad_Channel_{label}_{index + 1}',
                (center_x + x_offset, -11.4, 27.0), (1.25, 1.1, 30.0),
                armature, collection, materials['pad-shadow'], calf_bone, bevel=0.45,
            ), 'leg-pad-detail')
        tag(weighted_box(
            f'{prefix}_Pad_Graphic_{label}',
            (center_x + sign * 4.4, -12.1, 25.0), (3.2, 1.0, 31.0),
            armature, collection, materials['accent'], calf_bone, bevel=0.75,
        ), 'leg-pad-graphic')
        shoe_vertices, shoe_faces = shoe_geometry(sign * 8.2)
        tag(rigid_mesh(
            f'{prefix}_Goalie_Shoe_{label}', shoe_vertices, shoe_faces, armature, collection,
            materials['shoe'], foot_bone, bevel=0.65,
        ), 'shoe')

    tag(weighted_ellipsoid(
        f'{prefix}_Catch_Glove', (68.0, -0.5, 119.0), (13.5, 7.0, 15.0),
        armature, collection, materials['glove'], 'CC_Base_L_Hand',
    ), 'catch-glove')
    tag(weighted_ellipsoid(
        f'{prefix}_Catch_Pocket', (72.0, -5.2, 121.5), (9.0, 2.2, 10.5),
        armature, collection, materials['pocket'], 'CC_Base_L_Hand',
    ), 'catch-glove')
    for index, offset in enumerate((-5.5, 0.0, 5.5)):
        tag(cylinder_between(
            f'{prefix}_Catch_Web_{index + 1}',
            (67.0 + offset, -7.5, 113.0), (72.5 + offset * 0.5, -7.5, 130.0), 0.65,
            armature, collection, materials['lace'], 'CC_Base_L_Hand', segments=10,
        ), 'catch-glove')
    tag(cylinder_between(
        f'{prefix}_Catch_Cuff', (57.0, 5.8, 122.0), (64.5, 5.8, 121.5), 7.6,
        armature, collection, materials['accent'], 'CC_Base_L_Hand', segments=20,
    ), 'catch-glove')

    tag(weighted_box(
        f'{prefix}_Blocker', (-68.0, -1.0, 119.0), (21.0, 9.0, 28.0),
        armature, collection, materials['blocker'], 'CC_Base_R_Hand', bevel=2.7,
    ), 'blocker')
    tag(weighted_box(
        f'{prefix}_Blocker_Graphic', (-68.0, -6.0, 119.0), (5.0, 1.0, 22.0),
        armature, collection, materials['accent'], 'CC_Base_R_Hand', bevel=1.1,
    ), 'blocker')

    tag(surface_from_body(
        body, armature, collection, f'{prefix}_Mask_Shell',
        lambda c: c.z > 163 and (c.z > 174 or c.y > -8 or abs(c.x) > 6.5),
        1.65, materials['mask'], smooth_iterations=2,
    ), 'mask')
    cage_segments = [
        ((-8.3, -21.7, 176.0), (8.3, -21.7, 176.0)),
        ((-8.6, -22.2, 171.8), (8.6, -22.2, 171.8)),
        ((-7.6, -21.8, 167.6), (7.6, -21.8, 167.6)),
        ((-8.0, -21.0, 178.8), (-6.2, -20.4, 164.8)),
        ((8.0, -21.0, 178.8), (6.2, -20.4, 164.8)),
        ((-3.0, -22.0, 178.0), (-2.4, -21.0, 164.5)),
        ((3.0, -22.0, 178.0), (2.4, -21.0, 164.5)),
        ((0.0, -22.2, 178.5), (0.0, -21.2, 164.3)),
    ]
    for index, (start, end) in enumerate(cage_segments):
        tag(cylinder_between(
            f'{prefix}_Mask_Cage_{index + 1:02d}', start, end, 0.55,
            armature, collection, materials['cage'], 'CC_Base_Head', segments=12,
        ), 'mask')
    tag(weighted_box(
        f'{prefix}_Throat_Guard', (0, -17.0, 158.5), (18.0, 2.8, 11.0),
        armature, collection, materials['protector'], 'CC_Base_NeckTwist01', bevel=2.5,
    ), 'throat-guard')

    tag(cylinder_between(
        f'{prefix}_Goalie_Stick_Shaft', (-69.0, -4.5, 7.0), (-69.0, 1.0, 137.0), 1.3,
        armature, collection, materials['stick'], 'CC_Base_R_Hand', segments=16,
    ), 'goalie-stick')
    tag(weighted_box(
        f'{prefix}_Goalie_Stick_Paddle', (-69.0, -5.4, 43.0), (8.5, 4.2, 56.0),
        armature, collection, materials['paddle'], 'CC_Base_R_Hand', bevel=1.4,
    ), 'goalie-stick')
    tag(weighted_box(
        f'{prefix}_Goalie_Stick_Blade', (-69.0, -19.0, 5.0), (8.0, 31.0, 7.0),
        armature, collection, materials['stick'], 'CC_Base_R_Hand', bevel=1.5,
    ), 'goalie-stick')

    tag(weighted_box(
        f'{prefix}_Chest_Mark', (0, -21.0, 137.0), (14.0, 1.4, 14.0),
        armature, collection, materials['mark'], 'CC_Base_Spine02', bevel=2.0,
    ), 'uniform-mark')
    tag(weighted_box(
        f'{prefix}_Chest_Mark_Core', (0, -22.0, 137.0), (7.0, 1.0, 7.0),
        armature, collection, materials['accent'], 'CC_Base_Spine02', bevel=1.4,
    ), 'uniform-mark')
    return collection


GOALIE_READY = {
    'CC_Base_Waist': normalized((0.0, -0.17, 0.985)),
    'CC_Base_Spine01': normalized((0.0, -0.21, 0.978)),
    'CC_Base_Spine02': normalized((0.0, -0.23, 0.973)),
    'CC_Base_Head': normalized((0.0, -0.03, 1.0)),
    'CC_Base_L_Upperarm': normalized((0.48, -0.46, -0.75)),
    'CC_Base_R_Upperarm': normalized((-0.42, -0.50, -0.75)),
    'CC_Base_L_Forearm': normalized((-0.18, -0.76, -0.63)),
    'CC_Base_R_Forearm': normalized((0.18, -0.80, -0.57)),
    'CC_Base_L_Hand': normalized((-0.08, -0.96, -0.28)),
    'CC_Base_R_Hand': normalized((0.08, -0.96, -0.28)),
    'CC_Base_L_Thigh': normalized((0.28, -0.30, -0.91)),
    'CC_Base_R_Thigh': normalized((-0.28, -0.30, -0.91)),
    'CC_Base_L_Calf': normalized((-0.11, 0.48, -0.87)),
    'CC_Base_R_Calf': normalized((0.11, 0.48, -0.87)),
    'CC_Base_L_Foot': normalized((0.15, -0.985, -0.08)),
    'CC_Base_R_Foot': normalized((-0.15, -0.985, -0.08)),
}


def key(frame, directions, lateral=0.0, forward=0.0, tag='contact'):
    return {'frame': frame, 'directions': directions, 'lateralCm': lateral, 'forwardCm': forward, 'flightCm': 0.0, 'tag': tag}


def action_specs():
    weight_left = with_overrides(GOALIE_READY, {
        'CC_Base_Waist': (-0.06, -0.17, 0.983),
        'CC_Base_L_Thigh': (0.31, -0.32, -0.895),
        'CC_Base_R_Thigh': (-0.25, -0.27, -0.93),
    })
    weight_right = with_overrides(GOALIE_READY, {
        'CC_Base_Waist': (0.06, -0.17, 0.983),
        'CC_Base_L_Thigh': (0.25, -0.27, -0.93),
        'CC_Base_R_Thigh': (-0.31, -0.32, -0.895),
    })
    shuffle_left = with_overrides(GOALIE_READY, {
        'CC_Base_L_Thigh': (0.40, -0.27, -0.875),
        'CC_Base_R_Thigh': (-0.13, -0.34, -0.93),
        'CC_Base_L_Calf': (-0.05, 0.35, -0.935),
        'CC_Base_R_Calf': (0.20, 0.52, -0.83),
        'CC_Base_L_Foot': (0.30, -0.95, -0.07),
        'CC_Base_R_Foot': (0.05, -0.995, -0.08),
    })
    shuffle_right = with_overrides(GOALIE_READY, {
        'CC_Base_L_Thigh': (0.13, -0.34, -0.93),
        'CC_Base_R_Thigh': (-0.40, -0.27, -0.875),
        'CC_Base_L_Calf': (-0.20, 0.52, -0.83),
        'CC_Base_R_Calf': (0.05, 0.35, -0.935),
        'CC_Base_L_Foot': (-0.05, -0.995, -0.08),
        'CC_Base_R_Foot': (-0.30, -0.95, -0.07),
    })
    deep_set = with_overrides(GOALIE_READY, {
        'CC_Base_Waist': (0.0, -0.25, 0.968),
        'CC_Base_Spine01': (0.0, -0.30, 0.954),
        'CC_Base_Spine02': (0.0, -0.32, 0.948),
        'CC_Base_L_Upperarm': (0.54, -0.54, -0.64),
        'CC_Base_R_Upperarm': (-0.48, -0.57, -0.67),
        'CC_Base_L_Thigh': (0.34, -0.42, -0.84),
        'CC_Base_R_Thigh': (-0.34, -0.42, -0.84),
        'CC_Base_L_Calf': (-0.14, 0.62, -0.77),
        'CC_Base_R_Calf': (0.14, 0.62, -0.77),
    })
    glove_load = with_overrides(deep_set, {
        'CC_Base_Waist': (-0.10, -0.23, 0.968),
        'CC_Base_Head': (0.18, -0.08, 0.98),
        'CC_Base_L_Upperarm': (0.58, -0.52, -0.62),
    })
    glove_save = with_overrides(deep_set, {
        'CC_Base_Waist': (0.18, -0.18, 0.967),
        'CC_Base_Spine01': (0.25, -0.20, 0.947),
        'CC_Base_Spine02': (0.32, -0.18, 0.931),
        'CC_Base_Head': (0.38, -0.12, 0.918),
        'CC_Base_L_Upperarm': (0.76, -0.50, -0.41),
        'CC_Base_L_Forearm': (0.56, -0.72, -0.39),
        'CC_Base_L_Hand': (0.30, -0.92, -0.24),
        'CC_Base_R_Upperarm': (-0.34, -0.57, -0.75),
        'CC_Base_L_Thigh': (0.42, -0.42, -0.80),
        'CC_Base_R_Thigh': (-0.24, -0.38, -0.89),
    })
    blocker_load = with_overrides(deep_set, {
        'CC_Base_Waist': (0.10, -0.23, 0.968),
        'CC_Base_Head': (-0.18, -0.08, 0.98),
        'CC_Base_R_Upperarm': (-0.58, -0.52, -0.62),
    })
    blocker_save = with_overrides(deep_set, {
        'CC_Base_Waist': (-0.18, -0.18, 0.967),
        'CC_Base_Spine01': (-0.25, -0.20, 0.947),
        'CC_Base_Spine02': (-0.32, -0.18, 0.931),
        'CC_Base_Head': (-0.38, -0.12, 0.918),
        'CC_Base_R_Upperarm': (-0.76, -0.50, -0.41),
        'CC_Base_R_Forearm': (-0.56, -0.72, -0.39),
        'CC_Base_R_Hand': (-0.30, -0.92, -0.24),
        'CC_Base_L_Upperarm': (0.34, -0.57, -0.75),
        'CC_Base_L_Thigh': (0.24, -0.38, -0.89),
        'CC_Base_R_Thigh': (-0.42, -0.42, -0.80),
    })
    return {
        'goalie-ready': [
            key(1, GOALIE_READY), key(11, weight_left, lateral=-1.0), key(21, GOALIE_READY),
            key(31, weight_right, lateral=1.0), key(41, GOALIE_READY),
        ],
        'goalie-shuffle': [
            key(1, GOALIE_READY), key(9, shuffle_left, lateral=-3.0), key(17, weight_left, lateral=-7.0),
            key(25, shuffle_right, lateral=-3.0), key(33, GOALIE_READY),
        ],
        'goalie-set': [
            key(1, GOALIE_READY), key(9, deep_set, forward=-1.0), key(17, deep_set, forward=-2.0, tag='set'),
            key(25, deep_set, forward=-1.0), key(33, GOALIE_READY),
        ],
        'goalie-save-glove': [
            key(1, GOALIE_READY), key(8, glove_load), key(16, glove_save, lateral=2.5, tag='save-contact'),
            key(23, glove_save, lateral=2.5, tag='save-hold'), key(31, deep_set), key(39, GOALIE_READY),
        ],
        'goalie-save-blocker': [
            key(1, GOALIE_READY), key(8, blocker_load), key(16, blocker_save, lateral=-2.5, tag='save-contact'),
            key(23, blocker_save, lateral=-2.5, tag='save-hold'), key(31, deep_set), key(39, GOALIE_READY),
        ],
    }


def key_pose(armature, ground_meshes, frame_spec, previous_quaternions):
    frame = frame_spec['frame']
    bpy.context.scene.frame_set(frame)
    reset_pose(armature)
    for bone_name in ANIMATED_BONES:
        aim_bone(armature, bone_name, frame_spec['directions'][bone_name])
    hip = armature.pose.bones.get('CC_Base_Hip')
    hip.location = (0.0, 0.0, 0.0)
    armature.location = (frame_spec['lateralCm'] / 100, frame_spec['forwardCm'] / 100, 0.0)
    bpy.context.view_layer.update()
    armature.location.z -= evaluated_min_z(ground_meshes)
    bpy.context.view_layer.update()
    hip.keyframe_insert('location', frame=frame)
    armature.keyframe_insert('location', frame=frame)
    for bone_name in ANIMATED_BONES:
        bone = armature.pose.bones[bone_name]
        quaternion = bone.rotation_quaternion.copy()
        previous = previous_quaternions.get(bone_name)
        if previous is not None and quaternion.dot(previous) < 0:
            quaternion.negate()
            bone.rotation_quaternion = quaternion
        previous_quaternions[bone_name] = quaternion.copy()
        bone.keyframe_insert('rotation_quaternion', frame=frame)
        bone.keyframe_insert('location', frame=frame)
    return {'frame': frame, 'tag': frame_spec['tag'], 'minimumWorldZ': round(evaluated_min_z(ground_meshes), 4)}


def main():
    args = parse_args()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    source_workfile = bpy.data.filepath

    body = bpy.data.objects.get('CC_Base_Body')
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if body is None or armature is None:
        raise RuntimeError('The accepted vNext human base and rig are required.')
    remove_field_equipment()
    armature.name = 'GS_Goalie_Rig'
    armature.data.name = 'GS_Goalie_Rig_Data'

    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    armature.animation_data_create()
    bpy.context.scene.render.fps = 30

    root = bpy.data.collections.new('GS_Goalie_Equipment')
    bpy.context.scene.collection.children.link(root)
    skin = make_material('GS_Goalie_Skin', (0.51, 0.30, 0.20), 0.7)
    body.data.materials.clear()
    body.data.materials.append(skin)

    home_materials = {
        'jersey': make_material('GS_Goalie_Home_Jersey', (0.014, 0.018, 0.026), 0.72),
        'accent': make_material('GS_Goalie_Home_Red', (0.75, 0.012, 0.025), 0.54),
        'pants': make_material('GS_Goalie_Home_Pants', (0.01, 0.013, 0.02), 0.78),
        'protector': make_material('GS_Goalie_Home_Protector', (0.045, 0.052, 0.065), 0.66),
        'pad': make_material('GS_Goalie_Home_Pad', (0.83, 0.85, 0.87), 0.68),
        'pad-shadow': make_material('GS_Goalie_Home_Pad_Channel', (0.16, 0.18, 0.21), 0.8),
        'shoe': make_material('GS_Goalie_Home_Shoe', (0.012, 0.015, 0.02), 0.5),
        'glove': make_material('GS_Goalie_Home_Glove', (0.025, 0.03, 0.04), 0.58),
        'pocket': make_material('GS_Goalie_Home_Pocket', (0.68, 0.70, 0.72), 0.75),
        'lace': make_material('GS_Goalie_Home_Lace', (0.82, 0.84, 0.86), 0.7),
        'blocker': make_material('GS_Goalie_Home_Blocker', (0.035, 0.04, 0.05), 0.62),
        'mask': make_material('GS_Goalie_Home_Mask', (0.012, 0.015, 0.022), 0.3),
        'cage': make_material('GS_Goalie_Home_Cage', (0.28, 0.30, 0.33), 0.22, 0.82),
        'stick': make_material('GS_Goalie_Home_Stick', (0.028, 0.032, 0.04), 0.38, 0.38),
        'paddle': make_material('GS_Goalie_Home_Paddle', (0.73, 0.75, 0.77), 0.62),
        'mark': make_material('GS_Goalie_Home_Mark', (0.92, 0.94, 0.96), 0.55),
    }
    away_materials = {
        'jersey': make_material('GS_Goalie_Away_Jersey', (0.86, 0.88, 0.90), 0.72),
        'accent': make_material('GS_Goalie_Away_Red', (0.75, 0.012, 0.025), 0.54),
        'pants': make_material('GS_Goalie_Away_Pants', (0.018, 0.022, 0.03), 0.78),
        'protector': make_material('GS_Goalie_Away_Protector', (0.10, 0.11, 0.13), 0.66),
        'pad': make_material('GS_Goalie_Away_Pad', (0.90, 0.91, 0.92), 0.68),
        'pad-shadow': make_material('GS_Goalie_Away_Pad_Channel', (0.20, 0.22, 0.25), 0.8),
        'shoe': make_material('GS_Goalie_Away_Shoe', (0.015, 0.018, 0.024), 0.5),
        'glove': make_material('GS_Goalie_Away_Glove', (0.80, 0.82, 0.84), 0.58),
        'pocket': make_material('GS_Goalie_Away_Pocket', (0.12, 0.14, 0.17), 0.75),
        'lace': make_material('GS_Goalie_Away_Lace', (0.12, 0.14, 0.17), 0.7),
        'blocker': make_material('GS_Goalie_Away_Blocker', (0.78, 0.80, 0.82), 0.62),
        'mask': make_material('GS_Goalie_Away_Mask', (0.80, 0.82, 0.84), 0.3),
        'cage': make_material('GS_Goalie_Away_Cage', (0.18, 0.20, 0.23), 0.22, 0.82),
        'stick': make_material('GS_Goalie_Away_Stick', (0.03, 0.035, 0.045), 0.38, 0.38),
        'paddle': make_material('GS_Goalie_Away_Paddle', (0.82, 0.84, 0.86), 0.62),
        'mark': make_material('GS_Goalie_Away_Mark', (0.02, 0.025, 0.035), 0.55),
    }
    home = build_goalie_variant('Home', body, armature, root, home_materials)
    away = build_goalie_variant('Away', body, armature, root, away_materials)
    home.hide_render = False
    away.hide_render = True

    ground_meshes = [body] + [obj for obj in home.all_objects if obj.get('goalie_equipment_group') == 'shoe']
    clips = []
    for clip_name, specs in action_specs().items():
        action = bpy.data.actions.new(clip_name)
        action.use_fake_user = True
        armature.animation_data.action = action
        previous_quaternions = {}
        keyframes = [key_pose(armature, ground_meshes, spec, previous_quaternions) for spec in specs]
        action.frame_range = (specs[0]['frame'], specs[-1]['frame'])
        set_interpolation(action)
        grounding = bake_nonpenetration(armature, ground_meshes, action, specs[0]['frame'], specs[-1]['frame'])
        set_interpolation(action)
        clips.append({
            'name': clip_name,
            'frameRange': [specs[0]['frame'], specs[-1]['frame']],
            'durationSeconds': round((specs[-1]['frame'] - specs[0]['frame']) / 30, 3),
            'keyframes': keyframes,
            'groundingBake': grounding,
        })

    armature.animation_data.action = bpy.data.actions.get('goalie-ready')
    bpy.context.scene.frame_set(1)
    bpy.context.scene['vnext_goalie_status'] = 'authored-for-human-review'
    bpy.context.scene['vnext_goalie_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    goalie_objects = [obj for obj in bpy.data.objects if obj.get('goalie_equipment_group')]
    groups = sorted(set(obj.get('goalie_equipment_group') for obj in goalie_objects))
    report = {
        'status': 'authored-for-human-review',
        'decision': 'not-public-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_blend),
        'rig': armature.name,
        'variants': [home.name, away.name],
        'requiredEquipmentGroups': ['jersey', 'padded-pants', 'leg-pad', 'shoe', 'catch-glove', 'blocker', 'mask', 'goalie-stick'],
        'equipmentGroups': groups,
        'missingEquipmentGroups': [group for group in ['jersey', 'padded-pants', 'leg-pad', 'shoe', 'catch-glove', 'blocker', 'mask', 'goalie-stick'] if group not in groups],
        'equipmentObjectCount': len(goalie_objects),
        'requiredActionNames': list(REQUIRED_ACTIONS),
        'missingActionNames': [name for name in REQUIRED_ACTIONS if bpy.data.actions.get(name) is None],
        'clips': clips,
        'approvalRule': 'Human multi-angle review is required. Authored geometry and motion metrics cannot approve the goalie by themselves.',
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_GOALIE_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
