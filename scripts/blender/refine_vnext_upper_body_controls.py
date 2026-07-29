import argparse
import json
import math
import sys
from collections import Counter
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
LEFT_TARGET = 'GS_L_Hand_Target'
RIGHT_TARGET = 'GS_R_Hand_Target'
LEFT_HAND = 'CC_Base_L_Hand'
RIGHT_HAND = 'CC_Base_R_Hand'
TARGET_HEADS_CM = {
    LEFT_TARGET: Vector((0.0, 0.0, 128.0)),
    RIGHT_TARGET: Vector((0.0, 0.0, 96.0)),
}
REQUIRED_ACTIONS = (
    'ready',
    'jog',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
    'jog-to-sprint-ik',
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def round_vector(vector):
    return [round(value, 4) for value in vector]


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def local_bounds(obj):
    minimum = Vector((min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    return {
        'minimumCm': round_vector(minimum),
        'maximumCm': round_vector(maximum),
        'dimensionsCm': round_vector(maximum - minimum),
    }


def vertex_weights(obj, vertex):
    return {
        obj.vertex_groups[membership.group].name: membership.weight
        for membership in vertex.groups
        if membership.weight > 1e-6
    }


def assign_weights(obj, vertex_index, weights):
    for group in obj.vertex_groups:
        group.remove([vertex_index])
    total = sum(weights.values())
    if total <= 1e-8:
        raise RuntimeError(f'No weights supplied for {obj.name} vertex {vertex_index}.')
    for name, weight in weights.items():
        if weight <= 0.001:
            continue
        group = obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
        group.add([vertex_index], weight / total, 'REPLACE')


def blend_weights(original, target, factor):
    combined = Counter()
    for name, weight in original.items():
        combined[name] += weight * (1.0 - factor)
    for name, weight in target.items():
        combined[name] += weight * factor
    return dict(combined)


def refine_shoulder_cap(jersey):
    adjusted = 0
    reshaped = 0
    maximum_drop = 0.0
    upperarm_weight_before = []
    upperarm_weight_after = []

    for vertex in jersey.data.vertices:
        distance = abs(vertex.co.x)
        if not (15.0 <= distance <= 32.0 and vertex.co.z >= 136.0):
            continue
        side = 'L' if vertex.co.x >= 0.0 else 'R'
        spine = 'CC_Base_Spine02'
        clavicle = f'CC_Base_{side}_Clavicle'
        upperarm = f'CC_Base_{side}_Upperarm'
        upper_twist_1 = f'CC_Base_{side}_UpperarmTwist01'
        upper_twist_2 = f'CC_Base_{side}_UpperarmTwist02'

        arm_mix = smoothstep((distance - 20.0) / 12.0)
        target = {
            spine: 0.42 * (1.0 - arm_mix),
            clavicle: 0.48 * (1.0 - arm_mix) + 0.43 * arm_mix,
            upperarm: 0.02 + 0.07 * arm_mix,
            upper_twist_1: 0.08 * (1.0 - arm_mix) + 0.40 * arm_mix,
            upper_twist_2: 0.08 * arm_mix,
        }
        original = vertex_weights(jersey, vertex)
        upperarm_weight_before.append(sum(
            original.get(name, 0.0)
            for name in (upperarm, upper_twist_1, upper_twist_2)
        ))
        blend = 0.88 * smoothstep((vertex.co.z - 136.0) / 18.0)
        updated = blend_weights(original, target, blend)
        assign_weights(jersey, vertex.index, updated)
        upperarm_weight_after.append(sum(
            updated.get(name, 0.0)
            for name in (upperarm, upper_twist_1, upper_twist_2)
        ) / sum(updated.values()))
        adjusted += 1

        cap_height = 155.0 - max(0.0, distance - 17.0) * 0.48
        if vertex.co.z > cap_height:
            drop = vertex.co.z - cap_height
            vertex.co.z = cap_height
            reshaped += 1
            maximum_drop = max(maximum_drop, drop)

    jersey.data.update()
    jersey['upper_body_refinement'] = 'stable-shoulder-cap-v2'
    return {
        'adjustedVertexCount': adjusted,
        'reshapedVertexCount': reshaped,
        'maximumRestDropCm': round(maximum_drop, 4),
        'meanUpperarmWeightBefore': round(
            sum(upperarm_weight_before) / max(1, len(upperarm_weight_before)),
            4,
        ),
        'meanUpperarmWeightAfter': round(
            sum(upperarm_weight_after) / max(1, len(upperarm_weight_after)),
            4,
        ),
    }


def mask_body_hands(body):
    faces_before = len(body.data.polygons)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    covered = []
    for face in bm.faces:
        center = face.calc_center_median()
        if (
            58.5 <= abs(center.x) <= 84.5
            and -8.0 <= center.y <= 13.5
            and 107.0 <= center.z <= 131.5
        ):
            covered.append(face)
    bmesh.ops.delete(bm, geom=covered, context='FACES')
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()
    body['glove_body_mask'] = 'glove-covered-hand-faces-v1'
    return {
        'method': body.get('glove_body_mask'),
        'facesBefore': faces_before,
        'facesAfter': len(body.data.polygons),
        'facesRemoved': faces_before - len(body.data.polygons),
    }


def resize_and_rigidify_glove(obj, hand_bone, scales):
    before = local_bounds(obj)
    anchor = hand_bone.head_local.copy()
    longitudinal = (hand_bone.tail_local - hand_bone.head_local).normalized()
    depth = Vector((0.0, 1.0, 0.0))
    depth -= longitudinal * depth.dot(longitudinal)
    depth.normalize()
    vertical = longitudinal.cross(depth).normalized()
    if vertical.z < 0.0:
        vertical.negate()
    for vertex in obj.data.vertices:
        offset = vertex.co - anchor
        vertex.co = (
            anchor
            + longitudinal * offset.dot(longitudinal) * scales[0]
            + depth * offset.dot(depth) * scales[1]
            + vertical * offset.dot(vertical) * scales[2]
        )
    obj.data.update()
    for group in list(obj.vertex_groups):
        obj.vertex_groups.remove(group)
    hand_group = obj.vertex_groups.new(name=hand_bone.name)
    hand_group.add(range(len(obj.data.vertices)), 1.0, 'REPLACE')
    obj['glove_refinement'] = 'scaled-rigid-existing-glove-v1'
    return {
        'method': obj.get('glove_refinement'),
        'rigidBone': hand_bone.name,
        'scales': {
            'longitudinal': scales[0],
            'depth': scales[1],
            'vertical': scales[2],
        },
        'before': before,
        'after': local_bounds(obj),
        'vertexCount': len(obj.data.vertices),
    }


def refine_gloves(armature):
    report = {}
    for side, hand_name in (
        ('Left', LEFT_HAND),
        ('Right', RIGHT_HAND),
    ):
        hand_bone = armature.data.bones.get(hand_name)
        if hand_bone is None:
            raise RuntimeError(f'Missing hand bone: {hand_name}')
        for variant in ('Home', 'Away'):
            glove_name = f'GS_{variant}_Glove_{side}'
            cuff_name = f'{glove_name}_Cuff'
            glove = bpy.data.objects.get(glove_name)
            cuff = bpy.data.objects.get(cuff_name)
            if glove is None or cuff is None:
                raise RuntimeError(f'Missing glove geometry: {glove_name}')

            report[glove_name] = {
                'glove': resize_and_rigidify_glove(glove, hand_bone, (0.84, 0.76, 0.80)),
                'cuff': resize_and_rigidify_glove(cuff, hand_bone, (0.88, 0.82, 0.84)),
            }
    return report


def retarget_hand_controls(armature):
    before = {}
    bpy.ops.object.select_all(action='DESELECT')
    armature.hide_set(False)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')
    for name, head in TARGET_HEADS_CM.items():
        bone = armature.data.edit_bones.get(name)
        if bone is None:
            raise RuntimeError(f'Missing hand target: {name}')
        before[name] = {
            'headCm': round_vector(bone.head),
            'tailCm': round_vector(bone.tail),
        }
        bone.head = head
        bone.tail = head + Vector((0.0, 0.0, 5.0))
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    after = {
        name: {
            'headCm': round_vector(armature.data.bones[name].head_local),
            'tailCm': round_vector(armature.data.bones[name].tail_local),
        }
        for name in TARGET_HEADS_CM
    }
    return {
        'before': before,
        'after': after,
        'beforeGripSeparationCm': round(
            (Vector(before[LEFT_TARGET]['headCm']) - Vector(before[RIGHT_TARGET]['headCm'])).length,
            4,
        ),
        'afterGripSeparationCm': round(
            (armature.data.bones[LEFT_TARGET].head_local - armature.data.bones[RIGHT_TARGET].head_local).length,
            4,
        ),
        'targetMidpointLoweringCm': 9.0,
    }


def validate_constraints(armature):
    constraints = []
    for hand_name, target_name in ((LEFT_HAND, LEFT_TARGET), (RIGHT_HAND, RIGHT_TARGET)):
        hand = armature.pose.bones.get(hand_name)
        if hand is None:
            raise RuntimeError(f'Missing pose hand: {hand_name}')
        matching = [
            constraint
            for constraint in hand.constraints
            if constraint.type == 'IK' and constraint.subtarget == target_name
        ]
        if len(matching) != 1:
            raise RuntimeError(f'Expected one {target_name} IK constraint, found {len(matching)}.')
        constraints.append({
            'hand': hand_name,
            'target': target_name,
            'chainCount': matching[0].chain_count,
            'influence': matching[0].influence,
        })
    return constraints


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing armature: {ARMATURE_NAME}')
    missing_actions = [name for name in REQUIRED_ACTIONS if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing required actions: ' + ', '.join(missing_actions))

    armature.data.pose_position = 'REST'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    hand_controls = retarget_hand_controls(armature)
    body = bpy.data.objects.get('CC_Base_Body')
    if body is None:
        raise RuntimeError('Missing licensed body mesh.')
    body_hand_mask = mask_body_hands(body)
    gloves = refine_gloves(armature)
    shoulders = {}
    for variant in ('Home', 'Away'):
        jersey = bpy.data.objects.get(f'GS_{variant}_Jersey')
        if jersey is None:
            raise RuntimeError(f'Missing {variant} jersey.')
        shoulders[variant.lower()] = refine_shoulder_cap(jersey)

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    constraints = validate_constraints(armature)

    bpy.context.scene['vnext_upper_body_status'] = 'private-natural-grip-review'
    bpy.context.scene['vnext_upper_body_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'natural-grip-authored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'armature': ARMATURE_NAME,
        'handControls': hand_controls,
        'bodyHandMask': body_hand_mask,
        'handConstraints': constraints,
        'gloves': gloves,
        'shoulders': shoulders,
        'motionActionsChanged': [],
        'stickControlKeyframesChanged': False,
        'reviewRule': (
            'The wider, lower grip, tailored gloves, and stabilized shoulder cap must pass '
            'all-action close review and private 12-player runtime review before promotion.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_NATURAL_GRIP_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
