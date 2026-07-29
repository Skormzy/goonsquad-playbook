import argparse
import json
import math
import re
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
ACTION_NAME = 'ready'
FRAME = 1
FIT_REVISION = 'production-integrated-source-fit-v2'
FINISH_REVISION = 'tucked-sleeve-manufactured-finish-v1'
ARTICULATION_REVISION = 'asymmetric-finger-layered-palm-v1'
VARIANTS = ('Home', 'Away')
SIDES = (('Left', 'L'), ('Right', 'R'))
FINGERS = (
    ('Index', 'Index'),
    ('Middle', 'Mid'),
    ('Ring', 'Ring'),
    ('Pinky', 'Pinky'),
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(values, digits=5):
    return [round(float(value), digits) for value in values]


def deform_matrix(armature, bone_name):
    pose_bone = armature.pose.bones[bone_name]
    rest_bone = armature.data.bones[bone_name]
    return pose_bone.matrix @ rest_bone.matrix_local.inverted()


def weighted_matrix(armature, weights):
    matrix = Matrix(((0.0, 0.0, 0.0, 0.0),) * 4)
    for bone_name, weight in weights.items():
        deformation = deform_matrix(armature, bone_name)
        for row in range(4):
            for column in range(4):
                matrix[row][column] += deformation[row][column] * weight
    return matrix


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


def recalculate_normals(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def safe_axis(vector, fallback):
    if vector.length <= 1e-6:
        return fallback.normalized()
    return vector.normalized()


def remove_object(obj):
    data = obj.data if obj.type == 'MESH' else None
    bpy.data.objects.remove(obj, do_unlink=True)
    if data is not None and data.users == 0:
        bpy.data.meshes.remove(data)


def extract_and_remove_inherited_finger_pads(variant, side_label, side_token, armature):
    pattern = re.compile(
        rf'^GS_{variant}_Glove_{side_label}_Production_'
        r'(Index|Middle|Ring|Pinky)_Pad_([123])$'
    )
    removed = []
    anchors = {}
    for obj in list(bpy.data.objects):
        match = pattern.match(obj.name)
        if not match:
            continue
        source_name = match.group(1)
        segment = int(match.group(2))
        rig_name = 'Mid' if source_name == 'Middle' else source_name
        bone_name = f'CC_Base_{side_token}_{rig_name}{segment}'
        bone = armature.pose.bones[bone_name]
        matrix = deform_matrix(armature, bone_name)
        pose_points = [matrix @ vertex.co for vertex in obj.data.vertices]
        center = sum(pose_points, Vector()) / len(pose_points)
        bone_forward = safe_axis(bone.tail - bone.head, Vector((1.0, 0.0, 0.0)))
        bone_center = (bone.head + bone.tail) * 0.5
        coordinates = np.asarray([tuple(point) for point in pose_points], dtype=np.float64)
        covariance = np.cov(coordinates - coordinates.mean(axis=0), rowvar=False)
        eigenvalues, eigenvectors = np.linalg.eigh(covariance)
        order = np.argsort(eigenvalues)[::-1]
        forward = Vector(tuple(float(value) for value in eigenvectors[:, order[0]]))
        outward = Vector(tuple(float(value) for value in eigenvectors[:, order[2]]))
        if forward.dot(bone_forward) < 0.0:
            forward.negate()
        if outward.dot(center - bone_center) < 0.0:
            outward.negate()
        forward = safe_axis(forward, bone_forward)
        outward -= forward * outward.dot(forward)
        outward = safe_axis(outward, center - bone_center)
        across = safe_axis(outward.cross(forward), Vector((0.0, 0.0, 1.0)))
        forward_values = [(point - center).dot(forward) for point in pose_points]
        across_values = [(point - center).dot(across) for point in pose_points]
        anchors[(source_name, segment)] = {
            'center': center,
            'forward': forward,
            'outward': outward,
            'across': across,
            'length': max(forward_values) - min(forward_values),
            'width': max(across_values) - min(across_values),
            'sourceObject': obj.name,
        }
        removed.append(obj.name)
        remove_object(obj)
    if len(removed) != 12:
        raise RuntimeError(
            f'Expected 12 inherited finger pads for {variant} {side_label}, found {len(removed)}.'
        )
    if len(anchors) != 12:
        raise RuntimeError(
            f'Expected 12 finger-pad anchors for {variant} {side_label}, found {len(anchors)}.'
        )
    return sorted(removed), anchors


def append_crowned_plate(
    buffers,
    component_name,
    center,
    forward,
    across,
    outward,
    length,
    width,
    thickness,
    crown,
    weights,
    material_index,
    chamfer_ratio=0.18,
):
    forward = safe_axis(forward, Vector((1.0, 0.0, 0.0)))
    outward = outward - forward * outward.dot(forward)
    outward = safe_axis(outward, Vector((0.0, 1.0, 0.0)))
    across = across - forward * across.dot(forward) - outward * across.dot(outward)
    across = safe_axis(across, forward.cross(outward))

    half_length = length * 0.5
    half_width = width * 0.5
    chamfer = min(half_length, half_width) * chamfer_ratio
    outline = (
        (-half_length + chamfer, -half_width),
        (half_length - chamfer, -half_width),
        (half_length, -half_width + chamfer),
        (half_length, half_width - chamfer),
        (half_length - chamfer, half_width),
        (-half_length + chamfer, half_width),
        (-half_length, half_width - chamfer),
        (-half_length, -half_width + chamfer),
    )
    start = len(buffers['vertices'])
    for height, inset in ((-thickness * 0.5, 1.0), (thickness * 0.5, 0.92)):
        for along, lateral in outline:
            buffers['vertices'].append(
                center
                + forward * along * inset
                + across * lateral * inset
                + outward * height
            )
            buffers['weights'].append(weights)
            buffers['uvs'].append((
                0.5 + along / max(length, 1e-6),
                0.5 + lateral / max(width, 1e-6),
            ))
    top_center = start + 16
    buffers['vertices'].append(center + outward * (thickness * 0.5 + crown))
    buffers['weights'].append(weights)
    buffers['uvs'].append((0.5, 0.5))

    component_faces = [tuple(start + index for index in reversed(range(8)))]
    for index in range(8):
        following = (index + 1) % 8
        component_faces.append((
            start + index,
            start + following,
            start + 8 + following,
            start + 8 + index,
        ))
    for index in range(8):
        following = (index + 1) % 8
        component_faces.append((
            start + 8 + index,
            start + 8 + following,
            top_center,
        ))
    buffers['faces'].extend(component_faces)
    buffers['faceMaterials'].extend([material_index] * len(component_faces))
    buffers['components'].append({
        'name': component_name,
        'centerCm': rounded(center),
        'lengthCm': round(length, 5),
        'widthCm': round(width, 5),
        'thicknessCm': round(thickness, 5),
        'crownCm': round(crown, 5),
        'boneWeights': weights,
        'materialIndex': material_index,
    })


def create_skinned_mesh(name, collection, armature, buffers, materials, role):
    rest_vertices = []
    normalized_weights = []
    for pose_point, weights in zip(buffers['vertices'], buffers['weights']):
        total = sum(weights.values())
        if total <= 1e-8:
            raise RuntimeError(f'Unweighted authored vertex in {name}.')
        normalized = {bone: weight / total for bone, weight in weights.items()}
        rest_vertices.append(weighted_matrix(armature, normalized).inverted() @ pose_point)
        normalized_weights.append(normalized)

    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(rest_vertices, [], buffers['faces'])
    for material in materials:
        mesh.materials.append(material)
    for polygon, material_index in zip(mesh.polygons, buffers['faceMaterials']):
        polygon.material_index = material_index
        polygon.use_smooth = True
    uv_layer = mesh.uv_layers.new(name='UVMap')
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = buffers['uvs'][vertex_index]
    recalculate_normals(mesh)

    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.matrix_basis.identity()
    used_groups = sorted({bone for weights in normalized_weights for bone in weights})
    groups = {bone: obj.vertex_groups.new(name=bone) for bone in used_groups}
    for vertex_index, weights in enumerate(normalized_weights):
        for bone_name, weight in weights.items():
            groups[bone_name].add([vertex_index], weight, 'REPLACE')
    armature_modifier = obj.modifiers.new('GS_Production_Glove_Armature', 'ARMATURE')
    armature_modifier.object = armature
    armature_modifier.use_deform_preserve_volume = False
    bevel = obj.modifiers.new('GS_Manufactured_Edge_Radius', 'BEVEL')
    bevel.width = 0.07 if role == 'articulated-finger-armor' else 0.045
    bevel.segments = 2
    bevel.limit_method = 'ANGLE'
    obj['equipment_group'] = 'glove'
    obj['production_glove_articulation_revision'] = ARTICULATION_REVISION
    obj['surface_role'] = role
    obj['component_count'] = len(buffers['components'])
    obj['runtime_approved'] = False
    return obj


def new_buffers():
    return {
        'vertices': [],
        'faces': [],
        'weights': [],
        'uvs': [],
        'faceMaterials': [],
        'components': [],
    }


def create_articulated_finger_armor(
    variant,
    side_label,
    side_token,
    collection,
    armature,
    materials,
    anchors,
):
    widths = {
        'Index': (1.56, 1.39, 1.18),
        'Middle': (1.63, 1.45, 1.23),
        'Ring': (1.52, 1.35, 1.15),
        'Pinky': (1.31, 1.16, 0.98),
    }
    lateral_bias = {'Index': 0.09, 'Middle': -0.04, 'Ring': 0.05, 'Pinky': -0.08}
    material_pattern = {
        'Index': (0, 0, 0),
        'Middle': (1, 0, 1),
        'Ring': (0, 1, 0),
        'Pinky': (0, 0, 1),
    }
    buffers = new_buffers()
    for source_name, rig_name in FINGERS:
        for segment in (1, 2, 3):
            bone_name = f'CC_Base_{side_token}_{rig_name}{segment}'
            bone = armature.pose.bones[bone_name]
            anchor = anchors[(source_name, segment)]
            forward = anchor['forward']
            outward = anchor['outward']
            across = anchor['across']
            length = max(1.25, min(3.45, anchor['length'] * 0.90))
            width = max(
                widths[source_name][segment - 1],
                min(1.72, anchor['width'] * 1.06),
            )
            shift = (lateral_bias[source_name] + (segment - 2) * 0.025) * 0.32
            center = (
                anchor['center']
                + outward * 0.04
                + across * shift
                - forward * (0.08 if segment == 3 else 0.0)
            )
            append_crowned_plate(
                buffers,
                f'{source_name}-armor-{segment}',
                center,
                forward,
                across,
                outward,
                length,
                width,
                0.29 - (segment - 1) * 0.02,
                0.07 - (segment - 1) * 0.008,
                {bone_name: 1.0},
                material_pattern[source_name][segment - 1],
                chamfer_ratio=0.22 if segment == 1 else 0.18,
            )
    obj = create_skinned_mesh(
        f'GS_{variant}_Glove_{side_label}_Production_Articulated_Finger_Armor',
        collection,
        armature,
        buffers,
        (materials['red'], materials['shell']),
        'articulated-finger-armor',
    )
    return obj, buffers['components']


def create_layered_palm_channel(
    variant,
    side_label,
    side_token,
    collection,
    armature,
    materials,
):
    shaft_start, shaft_end = stick_line_armature_space(armature)
    shaft_axis = safe_axis(shaft_end - shaft_start, Vector((0.0, 0.0, 1.0)))
    hand = armature.pose.bones[f'CC_Base_{side_token}_Hand']
    hand_center = (hand.head + hand.tail) * 0.5
    first_bones = [
        armature.pose.bones[f'CC_Base_{side_token}_{rig_name}1']
        for _, rig_name in FINGERS
    ]
    finger_root_center = sum(
        ((bone.head + bone.tail) * 0.5 for bone in first_bones),
        Vector(),
    ) / len(first_bones)
    reference_center = hand_center.lerp(finger_root_center, 0.52)
    shaft_center = closest_point_on_segment(reference_center, shaft_start, shaft_end)
    palm_direction = reference_center - shaft_center
    palm_direction -= shaft_axis * palm_direction.dot(shaft_axis)
    palm_direction = safe_axis(palm_direction, Vector((0.0, 1.0, 0.0)))
    side_axis = safe_axis(shaft_axis.cross(palm_direction), Vector((1.0, 0.0, 0.0)))
    hand_weights = {f'CC_Base_{side_token}_Hand': 1.0}

    buffers = new_buffers()
    for sign, label in ((-1.0, 'lower-cheek'), (1.0, 'upper-cheek')):
        radial = safe_axis(
            palm_direction * 0.38 + side_axis * sign * 0.92,
            side_axis * sign,
        )
        cheek_across = safe_axis(shaft_axis.cross(radial), side_axis)
        append_crowned_plate(
            buffers,
            label,
            shaft_center + radial * 1.18 + shaft_axis * (0.10 * sign),
            shaft_axis,
            cheek_across,
            radial,
            4.75 - (0.18 if sign < 0.0 else 0.0),
            1.02,
            0.22,
            0.025,
            hand_weights,
            0,
            chamfer_ratio=0.14,
        )

    heel_across = safe_axis(shaft_axis.cross(palm_direction), side_axis)
    append_crowned_plate(
        buffers,
        'heel-reinforcement',
        shaft_center + palm_direction * 1.48 - shaft_axis * 0.32,
        shaft_axis,
        heel_across,
        palm_direction,
        3.75,
        2.42,
        0.20,
        0.025,
        hand_weights,
        0,
        chamfer_ratio=0.16,
    )

    stall_widths = {'Index': 1.05, 'Middle': 1.10, 'Ring': 1.04, 'Pinky': 0.92}
    for source_name, rig_name in FINGERS:
        bone_name = f'CC_Base_{side_token}_{rig_name}1'
        bone = armature.pose.bones[bone_name]
        forward = safe_axis(bone.tail - bone.head, shaft_axis)
        center = (bone.head + bone.tail) * 0.5
        shaft_point = closest_point_on_segment(center, shaft_start, shaft_end)
        inward = shaft_point - center
        inward -= forward * inward.dot(forward)
        inward = safe_axis(inward, -palm_direction)
        stall_across = safe_axis(forward.cross(inward), side_axis)
        append_crowned_plate(
            buffers,
            f'{source_name}-finger-stall',
            center + inward * 0.72,
            forward,
            stall_across,
            inward,
            max(1.45, min(2.85, bone.length * 0.62)),
            stall_widths[source_name],
            0.15,
            0.012,
            {bone_name: 1.0},
            0,
            chamfer_ratio=0.20,
        )

    for sign, label in ((-1.0, 'heel-stitch-lower'), (1.0, 'heel-stitch-upper')):
        append_crowned_plate(
            buffers,
            label,
            shaft_center
            + palm_direction * 1.595
            + heel_across * sign * 0.82
            - shaft_axis * 0.32,
            shaft_axis,
            heel_across,
            palm_direction,
            3.15,
            0.075,
            0.055,
            0.005,
            hand_weights,
            1,
            chamfer_ratio=0.25,
        )

    obj = create_skinned_mesh(
        f'GS_{variant}_Glove_{side_label}_Production_Layered_Palm_Channel',
        collection,
        armature,
        buffers,
        (materials['palm'], materials['thread']),
        'layered-palm-compression-channel',
    )
    return obj, buffers['components'], rounded(shaft_center)


def object_record(obj, components):
    return {
        'name': obj.name,
        'vertices': len(obj.data.vertices),
        'polygons': len(obj.data.polygons),
        'uvLayers': [layer.name for layer in obj.data.uv_layers],
        'materials': [material.name for material in obj.data.materials if material],
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
        'surfaceRole': obj.get('surface_role'),
        'componentCount': len(components),
        'components': components,
    }


def main():
    args = parse_args()
    source_workfile = bpy.data.filepath
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing field-player armature: {ARMATURE_NAME}')
    action = bpy.data.actions.get(ACTION_NAME)
    if action is None:
        raise RuntimeError(f'Missing action: {ACTION_NAME}')
    armature.animation_data_create()
    armature.animation_data.action = action
    bpy.context.scene.frame_set(FRAME)
    bpy.context.view_layer.update()

    materials = {
        'red': bpy.data.materials.get('GS_Production_Glove_Leather_Red'),
        'shell': bpy.data.materials.get('GS_Production_Glove_Leather_Black'),
        'palm': bpy.data.materials.get('GS_Production_Glove_Palm_Leather'),
        'thread': bpy.data.materials.get('GS_Production_Glove_Thread'),
    }
    if not all(materials.values()):
        raise RuntimeError('The retained manufactured glove materials are incomplete.')

    variants = {}
    for variant in VARIANTS:
        collection = bpy.data.collections.get(f'GS_Equipment_{variant}')
        if collection is None:
            raise RuntimeError(f'Missing equipment collection for {variant}.')
        variants[variant.lower()] = {}
        for side_label, side_token in SIDES:
            removed, anchors = extract_and_remove_inherited_finger_pads(
                variant,
                side_label,
                side_token,
                armature,
            )
            armor, armor_components = create_articulated_finger_armor(
                variant,
                side_label,
                side_token,
                collection,
                armature,
                materials,
                anchors,
            )
            palm, palm_components, shaft_center = create_layered_palm_channel(
                variant,
                side_label,
                side_token,
                collection,
                armature,
                materials,
            )
            variants[variant.lower()][side_label.lower()] = {
                'removedInheritedFingerPads': removed,
                'articulatedFingerArmor': object_record(armor, armor_components),
                'layeredPalmChannel': object_record(palm, palm_components),
                'readyShaftCenterCm': shaft_center,
            }

    bpy.context.scene['vnext_production_glove_articulation_status'] = (
        'private-finger-and-palm-refinement'
    )
    bpy.context.scene['vnext_production_glove_articulation_revision'] = ARTICULATION_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'private-production-glove-articulation-authored',
        'decision': 'human-review-required',
        'articulationRevision': ARTICULATION_REVISION,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'action': ACTION_NAME,
        'frame': FRAME,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'generatedSegmentedAthleteReused': False,
        'variants': variants,
        'reviewBoundary': (
            'The private candidate must show twelve independently weighted, asymmetric finger '
            'plates and a layered palm channel that compresses around the shaft without floating, '
            'penetrating, or returning to repeated tube-shaped armor in any authored action.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_ARTICULATION_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
