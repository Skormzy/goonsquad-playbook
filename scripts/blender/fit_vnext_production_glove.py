import argparse
import json
import math
import re
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
FIT_ACTION = 'ready'
FIT_FRAME = 1
REQUIRED_ACTIONS = (
    'ready',
    'jog',
    'jog-to-sprint-ik',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
)
FINGERS = ('Index', 'Mid', 'Ring', 'Pinky')
SOURCE_FINGERS = ('Index', 'Middle', 'Ring', 'Pinky')
FINGER_CURL_DEGREES = {
    'Index': (62.0, 88.0, 58.0),
    'Mid': (66.0, 92.0, 62.0),
    'Ring': (70.0, 96.0, 66.0),
    'Pinky': (74.0, 100.0, 70.0),
    'Thumb': (34.0, 52.0, 32.0),
}
SOURCE_SHAFT_CENTER = Vector((0.035, 0.0, 0.0))
FIT_REVISION = 'production-integrated-source-fit-v2'
HAND_TARGET_X_CM = 5.5


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--glove-workfile', required=True)
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def action_fcurves(action):
    legacy = list(getattr(action, 'fcurves', []))
    if legacy:
        return legacy
    return [
        fcurve
        for layer in getattr(action, 'layers', [])
        for strip in getattr(layer, 'strips', [])
        for channelbag in getattr(strip, 'channelbags', [])
        for fcurve in channelbag.fcurves
    ]


def finger_fcurve_count(action):
    return sum(
        any(token in fcurve.data_path for token in (*FINGERS, 'Thumb'))
        for fcurve in action_fcurves(action)
    )


def rounded(values, digits=5):
    return [round(float(value), digits) for value in values]


def catmull_rom(points, samples_per_segment=5):
    controls = [Vector(point) for point in points]
    padded = [controls[0], *controls, controls[-1]]
    samples = []
    for segment in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[segment - 1:segment + 3]
        for sample in range(samples_per_segment):
            t = sample / samples_per_segment
            t2 = t * t
            t3 = t2 * t
            samples.append(0.5 * (
                (2.0 * p1)
                + (-p0 + p2) * t
                + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
            ))
    samples.append(controls[-1])
    return samples


def finger_path(z, radius=0.0235, root_y=0.007, reach=0.0):
    controls = [
        (-0.012 + reach, root_y, z),
        (0.002 + reach, root_y + 0.005, z),
        (0.014 + reach, root_y + 0.010, z),
    ]
    for angle_degrees in (126, 100, 73, 46, 18, -10, -38, -65, -88, -101):
        angle = math.radians(angle_degrees)
        controls.append((
            SOURCE_SHAFT_CENTER.x + math.cos(angle) * radius,
            SOURCE_SHAFT_CENTER.y + math.sin(angle) * radius,
            z,
        ))
    return catmull_rom(controls, samples_per_segment=4)


def source_paths():
    specs = (
        ('Index', 0.0260, 0.0245, -0.0005),
        ('Middle', 0.0087, 0.0242, 0.0010),
        ('Ring', -0.0087, 0.0238, 0.0000),
        ('Pinky', -0.0255, 0.0232, -0.0025),
    )
    fingers = {
        label: finger_path(z, radius, reach=reach)
        for label, z, radius, reach in specs
    }
    thumb = catmull_rom((
        (-0.043, -0.018, -0.026),
        (-0.025, -0.029, -0.024),
        (-0.006, -0.034, -0.019),
        (0.013, -0.032, -0.012),
        (0.030, -0.026, -0.004),
        (0.045, -0.017, 0.003),
        (0.051, -0.006, 0.007),
    ), samples_per_segment=6)
    return fingers, thumb


def remove_action_finger_curves(action):
    removed = 0
    for fcurve in list(action_fcurves(action)):
        if not any(token in fcurve.data_path for token in (*FINGERS, 'Thumb')):
            continue
        legacy = getattr(action, 'fcurves', None)
        if legacy is not None:
            legacy.remove(fcurve)
        else:
            for layer in action.layers:
                for strip in layer.strips:
                    for channelbag in getattr(strip, 'channelbags', []):
                        if fcurve in channelbag.fcurves[:]:
                            channelbag.fcurves.remove(fcurve)
                            break
        removed += 1
    return removed


def author_closed_grip(armature):
    armature.animation_data_create()
    pose_bones = []
    for side in ('L', 'R'):
        for finger in (*FINGERS, 'Thumb'):
            for segment, degrees in enumerate(FINGER_CURL_DEGREES[finger], start=1):
                bone_name = f'CC_Base_{side}_{finger}{segment}'
                pose_bone = armature.pose.bones.get(bone_name)
                if pose_bone is None:
                    raise RuntimeError(f'Missing grip bone: {bone_name}')
                axis = (
                    (0.0, 0.0, 1.0 if side == 'L' else -1.0)
                    if finger == 'Thumb'
                    else (1.0, 0.0, 0.0)
                )
                pose_bones.append((pose_bone, degrees, axis))

    records = {}
    for action_name in REQUIRED_ACTIONS:
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f'Missing required action: {action_name}')
        removed = remove_action_finger_curves(action)
        armature.animation_data.action = action
        start = int(math.floor(action.frame_range[0]))
        end = int(math.ceil(action.frame_range[1]))
        for frame in (start, end):
            bpy.context.scene.frame_set(frame)
            for pose_bone, degrees, axis in pose_bones:
                pose_bone.rotation_mode = 'QUATERNION'
                pose_bone.rotation_quaternion = Quaternion(
                    axis,
                    math.radians(degrees),
                )
                pose_bone.keyframe_insert(
                    'rotation_quaternion',
                    frame=frame,
                    group=pose_bone.name,
                )
        for fcurve in action_fcurves(action):
            if any(token in fcurve.data_path for token in (*FINGERS, 'Thumb')):
                for keyframe in fcurve.keyframe_points:
                    keyframe.interpolation = 'LINEAR'
        action['production_glove_grip_revision'] = 'closed-contact-v1'
        records[action_name] = {
            'frameRange': [start, end],
            'removedInheritedFingerFcurves': removed,
            'fingerFcurves': finger_fcurve_count(action),
            'fingerKeys': sum(
                len(fcurve.keyframe_points)
                for fcurve in action_fcurves(action)
                if any(token in fcurve.data_path for token in (*FINGERS, 'Thumb'))
            ),
        }
    return records


def refine_hand_target_offsets(armature):
    targets = {
        'GS_L_Hand_Target': HAND_TARGET_X_CM,
        'GS_R_Hand_Target': -HAND_TARGET_X_CM,
    }
    before = {}
    bpy.ops.object.select_all(action='DESELECT')
    armature.hide_set(False)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode='EDIT')
    for bone_name, target_x in targets.items():
        bone = armature.data.edit_bones.get(bone_name)
        if bone is None:
            raise RuntimeError(f'Missing private hand target: {bone_name}')
        before[bone_name] = {
            'headCm': rounded(bone.head),
            'tailCm': rounded(bone.tail),
        }
        offset = Vector((target_x - bone.head.x, 0.0, 0.0))
        bone.head += offset
        bone.tail += offset
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    return {
        'revision': 'opposed-shaft-wrist-offset-v1',
        'targetOffsetXcm': HAND_TARGET_X_CM,
        'before': before,
        'after': {
            bone_name: {
                'headCm': rounded(armature.data.bones[bone_name].head_local),
                'tailCm': rounded(armature.data.bones[bone_name].tail_local),
            }
            for bone_name in targets
        },
    }


def deform_matrix(armature, bone_name):
    pose_bone = armature.pose.bones[bone_name]
    rest_bone = armature.data.bones[bone_name]
    return pose_bone.matrix @ rest_bone.matrix_local.inverted()


def closest_point_on_segment(point, start, end):
    direction = end - start
    denominator = direction.length_squared
    if denominator <= 1e-8:
        return start.copy()
    amount = max(0.0, min(1.0, (point - start).dot(direction) / denominator))
    return start + direction * amount


def stick_line_armature_space(armature):
    matrix = deform_matrix(armature, 'GS_Stick_Control')
    return matrix @ Vector((0.0, 0.0, 6.0)), matrix @ Vector((0.0, 0.0, 159.0))


def solve_similarity(source_points, target_points, allow_reflection):
    source = np.asarray(source_points, dtype=np.float64)
    target = np.asarray(target_points, dtype=np.float64)
    source_center = source.mean(axis=0)
    target_center = target.mean(axis=0)
    source_zero = source - source_center
    target_zero = target - target_center
    covariance = source_zero.T @ target_zero
    left, singular, right_transpose = np.linalg.svd(covariance)
    rotation = right_transpose.T @ left.T
    if not allow_reflection and np.linalg.det(rotation) < 0.0:
        right_transpose[-1, :] *= -1.0
        rotation = right_transpose.T @ left.T
        singular[-1] *= -1.0
    unconstrained_scale = float(singular.sum() / max(np.square(source_zero).sum(), 1e-8))
    # Bone centers sit inside the manufactured shell, so an unconstrained point fit
    # incorrectly shrinks the approved 179 mm glove to hand-skeleton dimensions.
    scale = max(0.90, min(1.05, unconstrained_scale))
    translation = target_center - scale * rotation @ source_center
    fitted = (scale * (rotation @ source.T)).T + translation
    rms = float(np.sqrt(np.mean(np.sum(np.square(fitted - target), axis=1))))
    return rotation, scale, translation, rms


def anchor_fit(armature, side_token, fingers, thumb):
    source = []
    target = []
    hand = armature.pose.bones[f'CC_Base_{side_token}_Hand']
    source.extend(((-10.0, 0.0, 0.0), (-3.4, 0.4, 0.0)))
    target.extend((tuple(hand.head), tuple((hand.head + hand.tail) * 0.5)))

    source_to_rig = {'Index': 'Index', 'Middle': 'Mid', 'Ring': 'Ring', 'Pinky': 'Pinky'}
    for source_name, rig_name in source_to_rig.items():
        path = fingers[source_name]
        for segment, progress in enumerate((0.17, 0.50, 0.83), start=1):
            point = path[round(progress * (len(path) - 1))] * 100.0
            bone = armature.pose.bones[f'CC_Base_{side_token}_{rig_name}{segment}']
            source.append(tuple(point))
            target.append(tuple((bone.head + bone.tail) * 0.5))

    for segment, progress in enumerate((0.17, 0.50, 0.83), start=1):
        point = thumb[round(progress * (len(thumb) - 1))] * 100.0
        bone = armature.pose.bones[f'CC_Base_{side_token}_Thumb{segment}']
        source.append(tuple(point))
        target.append(tuple((bone.head + bone.tail) * 0.5))

    shaft_start, shaft_end = stick_line_armature_space(armature)
    finger_centers = [
        (armature.pose.bones[f'CC_Base_{side_token}_{finger}1'].head
         + armature.pose.bones[f'CC_Base_{side_token}_{finger}2'].tail) * 0.5
        for finger in FINGERS
    ]
    center = sum(finger_centers, Vector()) / len(finger_centers)
    shaft_center = closest_point_on_segment(center, shaft_start, shaft_end)
    shaft_axis = (shaft_end - shaft_start).normalized()
    for offset in (-3.5, 3.5):
        for _ in range(6):
            source.append(tuple((SOURCE_SHAFT_CENTER + Vector((0.0, 0.0, offset / 100.0))) * 100.0))
            target.append(tuple(shaft_center + shaft_axis * offset))

    rotation, scale, translation, rms = solve_similarity(
        source,
        target,
        allow_reflection=side_token == 'R',
    )
    return {
        'rotation': rotation,
        'scale': scale,
        'translation': translation,
        'rmsCm': rms,
        'reflection': bool(np.linalg.det(rotation) < 0.0),
        'anchorCount': len(source),
        'shaftCenterCm': rounded(shaft_center),
        'shaftAxis': rounded(shaft_axis),
    }


def source_to_pose(source_coordinate, fit):
    source_cm = np.asarray(tuple(source_coordinate * 100.0), dtype=np.float64)
    fitted = fit['scale'] * fit['rotation'] @ source_cm + fit['translation']
    return Vector(tuple(float(value) for value in fitted))


def segment_blend(side_token, family, progress):
    centers = (0.17, 0.50, 0.83)
    names = [f'CC_Base_{side_token}_{family}{index}' for index in (1, 2, 3)]
    if progress <= centers[0]:
        return {names[0]: 1.0}
    if progress >= centers[-1]:
        return {names[-1]: 1.0}
    for index in range(2):
        if centers[index] <= progress <= centers[index + 1]:
            amount = (progress - centers[index]) / (centers[index + 1] - centers[index])
            amount = amount * amount * (3.0 - 2.0 * amount)
            return {names[index]: 1.0 - amount, names[index + 1]: amount}
    return {names[1]: 1.0}


def nearest_path_progress(coordinate, path):
    distances = [(coordinate - point).length_squared for point in path]
    index = min(range(len(distances)), key=distances.__getitem__)
    return math.sqrt(distances[index]), index / max(len(path) - 1, 1)


def cuff_weights(side_token, x_coordinate):
    hand = f'CC_Base_{side_token}_Hand'
    forearm = f'CC_Base_{side_token}_ForearmTwist02'
    if x_coordinate >= -0.060:
        return {hand: 1.0}
    if x_coordinate <= -0.114:
        return {forearm: 0.86, hand: 0.14}
    amount = (x_coordinate + 0.114) / 0.054
    amount = amount * amount * (3.0 - 2.0 * amount)
    return {forearm: 0.86 * (1.0 - amount), hand: 0.14 + 0.86 * amount}


def object_weight_override(object_name, coordinate, side_token, fingers, thumb):
    hand = f'CC_Base_{side_token}_Hand'
    if object_name == 'GS_Production_Glove_Base':
        return cuff_weights(side_token, coordinate.x)
    pad_match = re.search(r'GS_Glove_(Index|Middle|Ring|Pinky)_Pad_([123])', object_name)
    if pad_match:
        family = 'Mid' if pad_match.group(1) == 'Middle' else pad_match.group(1)
        return {f'CC_Base_{side_token}_{family}{pad_match.group(2)}': 1.0}
    knuckle_match = re.search(r'GS_Glove_Knuckle_Cap_([1-4])', object_name)
    if knuckle_match:
        family = FINGERS[int(knuckle_match.group(1)) - 1]
        return {f'CC_Base_{side_token}_{family}1': 1.0}
    if 'Thumb_Guard' in object_name:
        _, progress = nearest_path_progress(coordinate, thumb)
        return segment_blend(side_token, 'Thumb', progress)
    if 'Cuff' in object_name:
        return cuff_weights(side_token, coordinate.x)
    return {hand: 1.0}


def weighted_inverse_coordinate(armature, desired_pose, weights):
    matrix = Matrix(((0.0, 0.0, 0.0, 0.0),) * 4)
    for bone_name, weight in weights.items():
        deformation = deform_matrix(armature, bone_name)
        for row in range(4):
            for column in range(4):
                matrix[row][column] += deformation[row][column] * weight
    return matrix.inverted() @ desired_pose


def mapped_material(source_material, materials):
    name = source_material.name if source_material else ''
    if 'Red' in name:
        return materials['red']
    if 'Binding' in name:
        return materials['white']
    if 'Palm' in name:
        return materials['palm']
    return materials['black']


def recalculate_normals(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def build_fitted_object(
    source_object,
    target_name,
    target_collection,
    armature,
    fit,
    side_token,
    materials,
    fingers,
    thumb,
):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = source_object.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
    mesh.name = f'{target_name}_Mesh'
    source_coordinates = [source_object.matrix_world @ vertex.co for vertex in mesh.vertices]
    all_weights = []
    used_groups = set()
    for vertex, source_coordinate in zip(mesh.vertices, source_coordinates):
        weights = object_weight_override(
            source_object.name,
            source_coordinate,
            side_token,
            fingers,
            thumb,
        )
        desired_pose = source_to_pose(source_coordinate, fit)
        vertex.co = weighted_inverse_coordinate(armature, desired_pose, weights)
        all_weights.append(weights)
        used_groups.update(weights)

    source_materials = list(source_object.data.materials)
    mesh.materials.clear()
    if source_materials:
        for source_material in source_materials:
            mesh.materials.append(mapped_material(source_material, materials))
    else:
        mesh.materials.append(materials['black'])
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        polygon.material_index = min(polygon.material_index, len(mesh.materials) - 1)
    recalculate_normals(mesh)

    obj = bpy.data.objects.new(target_name, mesh)
    target_collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.matrix_basis.identity()
    groups = {bone_name: obj.vertex_groups.new(name=bone_name) for bone_name in sorted(used_groups)}
    for vertex_index, weights in enumerate(all_weights):
        for bone_name, weight in weights.items():
            groups[bone_name].add([vertex_index], weight, 'REPLACE')
    modifier = obj.modifiers.new('GS_Production_Glove_Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = False
    obj['equipment_group'] = 'glove'
    obj['production_glove_fit_revision'] = FIT_REVISION
    obj['production_source_object'] = source_object.name
    obj['runtime_approved'] = False
    return obj


def remove_existing_glove_objects(variant, side_label):
    prefix = f'GS_{variant}_Glove_{side_label}'
    removed = []
    for obj in list(bpy.data.objects):
        if not obj.name.startswith(prefix):
            continue
        removed.append(obj.name)
        data = obj.data if obj.type in {'MESH', 'CURVE'} else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if data and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Curve):
                bpy.data.curves.remove(data)
    return removed


def load_source_objects(glove_workfile):
    with bpy.data.libraries.load(str(glove_workfile), link=False) as (source, target):
        target.objects = [
            name
            for name in source.objects
            if name == 'GS_Production_Glove_Base'
            or (
                name.startswith('GS_Glove_')
                and 'Review' not in name
                and 'Studio' not in name
            )
        ]
    collection = bpy.data.collections.new('GS_Production_Glove_Source_Temporary')
    bpy.context.scene.collection.children.link(collection)
    objects = []
    for obj in target.objects:
        if obj is None or obj.type not in {'MESH', 'CURVE'}:
            continue
        collection.objects.link(obj)
        objects.append(obj)
    if len(objects) < 30:
        raise RuntimeError(f'Expected the authored glove shell and details, found {len(objects)} objects.')
    return collection, objects


def mesh_record(obj):
    minimum = Vector((min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    armature_modifier = next(
        (modifier for modifier in obj.modifiers if modifier.type == 'ARMATURE'),
        None,
    )
    return {
        'vertices': len(obj.data.vertices),
        'polygons': len(obj.data.polygons),
        'dimensionsCm': rounded(maximum - minimum, 3),
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
        'material': obj.data.materials[0].name if obj.data.materials else None,
        'materials': [material.name for material in obj.data.materials if material],
        'armaturePreserveVolume': (
            bool(armature_modifier.use_deform_preserve_volume)
            if armature_modifier else None
        ),
    }


def main():
    args = parse_args()
    glove_workfile = Path(args.glove_workfile).resolve()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing field-player armature: {ARMATURE_NAME}')
    collections = {
        'Home': bpy.data.collections.get('GS_Equipment_Home'),
        'Away': bpy.data.collections.get('GS_Equipment_Away'),
    }
    if not all(collections.values()):
        raise RuntimeError('The home or away equipment collection is missing.')
    materials = {
        'black': bpy.data.materials.get('GS_PBR_Leather_Black'),
        'red': bpy.data.materials.get('GS_PBR_Leather_Red'),
        'fabric': bpy.data.materials.get('GS_PBR_Fabric_Black'),
        'palm': bpy.data.materials.get('GS_PBR_Graphite'),
        'white': bpy.data.materials.get('GS_PBR_Rubber_White'),
    }
    missing_materials = [name for name, material in materials.items() if material is None]
    if missing_materials:
        raise RuntimeError(f'Missing fitted-glove materials: {missing_materials}')

    hand_target_refinement = refine_hand_target_offsets(armature)
    action_records = author_closed_grip(armature)
    armature.animation_data.action = bpy.data.actions[FIT_ACTION]
    bpy.context.scene.frame_set(FIT_FRAME)
    bpy.context.view_layer.update()
    fingers, thumb = source_paths()
    fits = {
        'Left': anchor_fit(armature, 'L', fingers, thumb),
        'Right': anchor_fit(armature, 'R', fingers, thumb),
    }
    source_collection, source_objects = load_source_objects(glove_workfile)

    variants = {}
    for variant, target_collection in collections.items():
        variants[variant.lower()] = {}
        for side_label, side_token in (('Left', 'L'), ('Right', 'R')):
            removed = remove_existing_glove_objects(variant, side_label)
            created = []
            for source_object in source_objects:
                suffix = (
                    'ProductionShell'
                    if source_object.name == 'GS_Production_Glove_Base'
                    else 'Production_' + source_object.name.removeprefix('GS_Glove_')
                )
                target_name = f'GS_{variant}_Glove_{side_label}_{suffix}'
                created.append(build_fitted_object(
                    source_object,
                    target_name,
                    target_collection,
                    armature,
                    fits[side_label],
                    side_token,
                    materials,
                    fingers,
                    thumb,
                ))
            variants[variant.lower()][side_label.lower()] = {
                'removedObjects': removed,
                'createdObjectCount': len(created),
                'objects': {obj.name: mesh_record(obj) for obj in created},
            }

    for obj in list(source_objects):
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)
            elif isinstance(data, bpy.types.Curve):
                bpy.data.curves.remove(data)
    bpy.data.collections.remove(source_collection)

    bpy.context.scene['vnext_production_glove_fit_status'] = 'private-weighted-athlete-fit'
    bpy.context.scene['vnext_production_glove_fit_revision'] = FIT_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'private-production-glove-fit-authored',
        'decision': 'human-review-required',
        'fitRevision': FIT_REVISION,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'generatedSegmentedGeometryReused': False,
        'sourceAthleteWorkfile': bpy.data.filepath,
        'sourceGloveWorkfile': str(glove_workfile),
        'outputWorkfile': str(output_workfile),
        'fitAction': FIT_ACTION,
        'fitFrame': FIT_FRAME,
        'gripCurlDegrees': FINGER_CURL_DEGREES,
        'handTargetRefinement': hand_target_refinement,
        'actions': action_records,
        'fits': {
            side.lower(): {
                'scale': round(float(fit['scale']), 6),
                'rotation': [[round(float(value), 6) for value in row] for row in fit['rotation']],
                'translationCm': rounded(fit['translation']),
                'rmsAnchorErrorCm': round(float(fit['rmsCm']), 5),
                'reflection': fit['reflection'],
                'anchorCount': fit['anchorCount'],
                'shaftCenterCm': fit['shaftCenterCm'],
                'shaftAxis': fit['shaftAxis'],
            }
            for side, fit in fits.items()
        },
        'variants': variants,
        'weighting': {
            'continuousShellRegions': ['cuff', 'hand', 'four-finger-chains', 'thumb-chain'],
            'cuffBlend': ['ForearmTwist02', 'Hand'],
            'fingerChainsPerHand': 12,
            'thumbChainBonesPerHand': 3,
            'inverseBoundAtFitPose': True,
            'linearSkinning': True,
            'continuousWristBlend': True,
        },
        'reviewBoundary': (
            'This weighted athlete fit remains private until close and all-action renders prove '
            'credible hand volume, shaft wrap, cuff clearance, and deformation without clipping.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_FIT_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
