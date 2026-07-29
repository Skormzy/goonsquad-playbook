import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
ACTION_NAME = 'ready'
FRAME = 1
SURFACE_REVISION = 'closed-palm-cuff-transition-v7'
SIDES = (('Left', 'L'), ('Right', 'R'))
VARIANTS = ('Home', 'Away')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(values, digits=5):
    return [round(float(value), digits) for value in values]


def percentile(values, amount):
    ordered = sorted(values)
    if not ordered:
        return None
    index = min(len(ordered) - 1, round((len(ordered) - 1) * amount))
    return round(float(ordered[index]), 5)


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


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


def vertex_weights(obj, vertex, armature):
    weights = {
        obj.vertex_groups[membership.group].name: float(membership.weight)
        for membership in vertex.groups
        if obj.vertex_groups[membership.group].name in armature.pose.bones
        and membership.weight > 1e-7
    }
    total = sum(weights.values())
    if total <= 1e-7:
        raise RuntimeError(f'Unweighted fitted vertex: {obj.name}[{vertex.index}]')
    return {name: weight / total for name, weight in weights.items()}


def recalculate_normals(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


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


def wrist_frame(armature, side_token):
    hand = armature.pose.bones[f'CC_Base_{side_token}_Hand']
    forearm = armature.pose.bones[f'CC_Base_{side_token}_ForearmTwist02']
    axis = (forearm.head - hand.head).normalized()
    reference = Vector((0.0, 0.0, 1.0))
    if abs(axis.dot(reference)) > 0.92:
        reference = Vector((0.0, 1.0, 0.0))
    tangent = axis.cross(reference).normalized()
    bitangent = axis.cross(tangent).normalized()
    return {
        'origin': hand.head.copy(),
        'axis': axis,
        'tangent': tangent,
        'bitangent': bitangent,
    }


def wrist_profile(points, frame):
    distances = []
    radii = []
    for point in points:
        relative = point - frame['origin']
        distance = relative.dot(frame['axis'])
        radial = relative - frame['axis'] * distance
        distances.append(distance)
        radii.append(radial.length)
    return {
        'distanceMinimumCm': round(min(distances), 5),
        'distanceMaximumCm': round(max(distances), 5),
        'radialP50Cm': percentile(radii, 0.50),
        'radialP95Cm': percentile(radii, 0.95),
        'radialMaximumCm': round(max(radii), 5),
    }


def refine_cuff_shell(obj, armature, side_token):
    frame = wrist_frame(armature, side_token)
    forearm_name = f'CC_Base_{side_token}_ForearmTwist02'
    records = []
    for vertex in obj.data.vertices:
        weights = vertex_weights(obj, vertex, armature)
        forearm_weight = weights.get(forearm_name, 0.0)
        if forearm_weight <= 1e-7:
            continue
        matrix = weighted_matrix(armature, weights)
        pose_point = matrix @ vertex.co
        records.append((vertex, weights, matrix, pose_point, forearm_weight))
    if len(records) < 1_000:
        raise RuntimeError(f'Expected a weighted cuff region on {obj.name}.')

    before = wrist_profile([record[3] for record in records], frame)
    distance_minimum = before['distanceMinimumCm']
    distance_maximum = before['distanceMaximumCm']
    distance_range = max(distance_maximum - distance_minimum, 1e-5)

    for vertex, weights, matrix, pose_point, forearm_weight in records:
        relative = pose_point - frame['origin']
        distance = relative.dot(frame['axis'])
        radial = relative - frame['axis'] * distance
        progress = max(0.0, min(1.0, (distance - distance_minimum) / distance_range))
        target_distance = -0.45 + progress * 7.85
        target_radius = 6.65 - progress * 0.75
        target_radial = radial.copy()
        if radial.length > target_radius:
            target_radial *= target_radius / radial.length
        target_point = (
            frame['origin']
            + frame['axis'] * target_distance
            + target_radial
        )
        strength = smoothstep(forearm_weight / 0.72)
        desired_pose = pose_point.lerp(target_point, strength)
        vertex.co = matrix.inverted() @ desired_pose

    after_points = []
    for vertex, weights, _, _, _ in records:
        matrix = weighted_matrix(armature, weights)
        after_points.append(matrix @ vertex.co)
    after = wrist_profile(after_points, frame)
    recalculate_normals(obj.data)
    armature_modifiers = [
        modifier for modifier in obj.modifiers if modifier.type == 'ARMATURE'
    ]
    if not armature_modifiers:
        raise RuntimeError(f'Missing armature modifier on {obj.name}.')
    for modifier in armature_modifiers:
        modifier.use_deform_preserve_volume = False
    obj['production_glove_surface_revision'] = SURFACE_REVISION
    obj['cuff_profile_refined'] = True
    obj['skinning_mode'] = 'linear'
    return {
        'verticesAdjusted': len(records),
        'before': before,
        'after': after,
        'skinningMode': 'linear',
    }


def create_weighted_mesh(
    name,
    collection,
    armature,
    pose_vertices,
    faces,
    weights_per_vertex,
    material,
    vertex_uvs=None,
    bevel_width=0.0,
):
    rest_vertices = []
    normalized_weights = []
    for pose_point, weights in zip(pose_vertices, weights_per_vertex):
        total = sum(weights.values())
        normalized = {bone: value / total for bone, value in weights.items()}
        rest_vertices.append(weighted_matrix(armature, normalized).inverted() @ pose_point)
        normalized_weights.append(normalized)

    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(rest_vertices, [], faces)
    mesh.materials.append(material)
    if vertex_uvs:
        uv_layer = mesh.uv_layers.new(name='UVMap')
        for polygon in mesh.polygons:
            for loop_index in polygon.loop_indices:
                uv_layer.data[loop_index].uv = vertex_uvs[mesh.loops[loop_index].vertex_index]
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    recalculate_normals(mesh)

    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.matrix_basis.identity()

    used_groups = sorted({bone for weights in normalized_weights for bone in weights})
    groups = {bone: obj.vertex_groups.new(name=bone) for bone in used_groups}
    for index, weights in enumerate(normalized_weights):
        for bone, weight in weights.items():
            groups[bone].add([index], weight, 'REPLACE')

    modifier = obj.modifiers.new('GS_Production_Glove_Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = False
    if bevel_width > 0.0:
        bevel = obj.modifiers.new('GS_Surface_Edge_Soften', 'BEVEL')
        bevel.width = bevel_width
        bevel.segments = 2
        bevel.limit_method = 'ANGLE'
    obj['equipment_group'] = 'glove'
    obj['production_glove_surface_revision'] = SURFACE_REVISION
    obj['runtime_approved'] = False
    obj['skinning_mode'] = 'linear'
    return obj


def loft_faces(rings, segments, capped=True):
    faces = []
    for ring in range(rings - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            current = ring * segments + segment
            following = ring * segments + next_segment
            upper = (ring + 1) * segments + segment
            upper_following = (ring + 1) * segments + next_segment
            faces.append((current, following, upper_following, upper))
    if capped:
        first_center = rings * segments
        last_center = first_center + 1
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((first_center, next_segment, segment))
            start = (rings - 1) * segments
            faces.append((last_center, start + segment, start + next_segment))
    return faces


def create_palm_closure(name, collection, armature, side_token, material):
    hand = armature.pose.bones[f'CC_Base_{side_token}_Hand']
    hand_center = (hand.head + hand.tail) * 0.5
    finger_center = sum(
        (
            (armature.pose.bones[f'CC_Base_{side_token}_{finger}1'].head
             + armature.pose.bones[f'CC_Base_{side_token}_{finger}1'].tail) * 0.5
            for finger in ('Index', 'Mid', 'Ring', 'Pinky')
        ),
        Vector(),
    ) / 4.0
    shaft_start, shaft_end = stick_line_armature_space(armature)
    shaft_axis = (shaft_end - shaft_start).normalized()
    reference_center = hand_center.lerp(finger_center, 0.35)
    shaft_center = closest_point_on_segment(reference_center, shaft_start, shaft_end)
    palm_direction = reference_center - shaft_center
    palm_direction -= shaft_axis * palm_direction.dot(shaft_axis)
    if palm_direction.length <= 1e-5:
        palm_direction = Vector((1.0 if side_token == 'L' else -1.0, 0.0, 0.0))
    palm_direction.normalize()
    depth_direction = shaft_axis.cross(palm_direction).normalized()

    offsets = (-4.8, -3.1, -1.4, 0.4, 2.2, 4.0, 5.6)
    scales = (0.50, 0.82, 0.98, 1.00, 0.95, 0.76, 0.46)
    segments = 24
    vertices = []
    weights = []
    uvs = []
    hand_weight = {f'CC_Base_{side_token}_Hand': 1.0}
    for ring, (offset, scale) in enumerate(zip(offsets, scales)):
        ring_center = shaft_center + shaft_axis * offset + palm_direction * 3.40
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            cosine = math.cos(angle)
            width = 3.65 if cosine >= 0.0 else 2.30
            point = (
                ring_center
                + palm_direction * cosine * width * scale
                + depth_direction * math.sin(angle) * 1.75 * scale
            )
            vertices.append(point)
            weights.append(hand_weight)
            uvs.append((segment / segments, ring / (len(offsets) - 1)))
    vertices.extend((
        shaft_center + shaft_axis * offsets[0] + palm_direction * 3.40,
        shaft_center + shaft_axis * offsets[-1] + palm_direction * 3.40,
    ))
    weights.extend((hand_weight, hand_weight))
    uvs.extend(((0.5, 0.0), (0.5, 1.0)))
    obj = create_weighted_mesh(
        name,
        collection,
        armature,
        vertices,
        loft_faces(len(offsets), segments),
        weights,
        material,
        uvs,
        bevel_width=0.08,
    )
    obj['surface_role'] = 'closed-palm-saddle'
    return obj, {
        'rings': len(offsets),
        'segments': segments,
        'vertices': len(vertices),
        'shaftCenterCm': rounded(shaft_center),
        'nearestDesignedShaftClearanceMm': 11.0,
    }


def create_thumb_web(name, collection, armature, side_token, material):
    hand = armature.pose.bones[f'CC_Base_{side_token}_Hand']
    thumb1 = armature.pose.bones[f'CC_Base_{side_token}_Thumb1']
    thumb2 = armature.pose.bones[f'CC_Base_{side_token}_Thumb2']
    hand_center = (hand.head + hand.tail) * 0.5
    thumb1_center = (thumb1.head + thumb1.tail) * 0.5
    thumb2_center = (thumb2.head + thumb2.tail) * 0.5
    shaft_start, shaft_end = stick_line_armature_space(armature)
    shaft_axis = (shaft_end - shaft_start).normalized()

    rings = 7
    segments = 14
    vertices = []
    weights = []
    uvs = []
    for ring in range(rings):
        progress = ring / (rings - 1)
        inverse = 1.0 - progress
        center = (
            hand_center * (inverse * inverse)
            + thumb1_center * (2.0 * inverse * progress)
            + thumb2_center * (progress * progress)
        )
        tangent = (
            (thumb1_center - hand_center) * (2.0 * inverse)
            + (thumb2_center - thumb1_center) * (2.0 * progress)
        ).normalized()
        width_axis = tangent.cross(shaft_axis)
        if width_axis.length <= 1e-5:
            width_axis = Vector((0.0, 1.0, 0.0))
        width_axis.normalize()
        depth_axis = tangent.cross(width_axis).normalized()
        taper = 0.68 + math.sin(math.pi * progress) * 0.42
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            point = (
                center
                + width_axis * math.cos(angle) * 1.55 * taper
                + depth_axis * math.sin(angle) * 0.62 * taper
            )
            vertices.append(point)
            if progress <= 0.45:
                blend = smoothstep(progress / 0.45)
                vertex_weight = {
                    f'CC_Base_{side_token}_Hand': 1.0 - blend,
                    f'CC_Base_{side_token}_Thumb1': blend,
                }
            else:
                blend = smoothstep((progress - 0.45) / 0.55)
                vertex_weight = {
                    f'CC_Base_{side_token}_Thumb1': 1.0 - blend,
                    f'CC_Base_{side_token}_Thumb2': blend,
                }
            weights.append(vertex_weight)
            uvs.append((segment / segments, progress))
    vertices.extend((hand_center, thumb2_center))
    weights.extend((
        {f'CC_Base_{side_token}_Hand': 1.0},
        {f'CC_Base_{side_token}_Thumb2': 1.0},
    ))
    uvs.extend(((0.5, 0.0), (0.5, 1.0)))
    obj = create_weighted_mesh(
        name,
        collection,
        armature,
        vertices,
        loft_faces(rings, segments),
        weights,
        material,
        uvs,
        bevel_width=0.05,
    )
    obj['surface_role'] = 'thumb-web-gusset'
    return obj, {
        'rings': rings,
        'segments': segments,
        'vertices': len(vertices),
    }


def create_cuff_binding(name, collection, armature, side_token, material):
    frame = wrist_frame(armature, side_token)
    segments = 32
    distances = (-0.80, 0.50, 2.20, 3.80)
    tangent_radii = (4.75, 4.85, 4.65, 4.40)
    bitangent_radii = (3.95, 4.05, 3.90, 3.70)
    vertices = []
    weights = []
    uvs = []
    for ring, (distance, tangent_radius, bitangent_radius) in enumerate(zip(
        distances,
        tangent_radii,
        bitangent_radii,
    )):
        progress = ring / (len(distances) - 1)
        forearm_weight = 0.30 + progress * 0.55
        vertex_weight = {
            f'CC_Base_{side_token}_ForearmTwist02': forearm_weight,
            f'CC_Base_{side_token}_Hand': 1.0 - forearm_weight,
        }
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            point = (
                frame['origin']
                + frame['axis'] * distance
                + frame['tangent'] * math.cos(angle) * tangent_radius
                + frame['bitangent'] * math.sin(angle) * bitangent_radius
            )
            vertices.append(point)
            weights.append(vertex_weight)
            uvs.append((segment / segments, progress))
    obj = create_weighted_mesh(
        name,
        collection,
        armature,
        vertices,
        loft_faces(len(distances), segments, capped=False),
        weights,
        material,
        uvs,
        bevel_width=0.04,
    )
    obj['surface_role'] = 'open-cuff-to-sleeve-liner'
    return obj, {
        'rings': len(distances),
        'segments': segments,
        'vertices': len(vertices),
        'distancesCm': list(distances),
        'tangentRadiiCm': list(tangent_radii),
        'bitangentRadiiCm': list(bitangent_radii),
        'capped': False,
    }


def remove_oversized_cuff_details(variant, side_label):
    names = (
        f'GS_{variant}_Glove_{side_label}_Production_Cuff_Roll',
        f'GS_{variant}_Glove_{side_label}_Production_Cuff_Binding',
    )
    removed = []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        removed.append(name)
        data = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if data and data.users == 0:
            bpy.data.meshes.remove(data)
    return removed


def object_record(obj):
    return {
        'vertices': len(obj.data.vertices),
        'polygons': len(obj.data.polygons),
        'materials': [material.name for material in obj.data.materials if material],
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
        'surfaceRole': obj.get('surface_role'),
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
        'black': bpy.data.materials.get('GS_PBR_Leather_Black'),
        'fabric': bpy.data.materials.get('GS_PBR_Fabric_Black'),
        'red': bpy.data.materials.get('GS_PBR_Leather_Red'),
    }
    if not all(materials.values()):
        raise RuntimeError('Missing production glove surface materials.')

    report_variants = {}
    for variant in VARIANTS:
        collection = bpy.data.collections.get(f'GS_Equipment_{variant}')
        if collection is None:
            raise RuntimeError(f'Missing equipment collection for {variant}.')
        report_variants[variant.lower()] = {}
        for side_label, side_token in SIDES:
            shell = bpy.data.objects.get(
                f'GS_{variant}_Glove_{side_label}_ProductionShell',
            )
            if shell is None:
                raise RuntimeError(f'Missing fitted production shell for {variant} {side_label}.')
            removed = remove_oversized_cuff_details(variant, side_label)
            cuff_profile = refine_cuff_shell(shell, armature, side_token)
            palm, palm_record = create_palm_closure(
                f'GS_{variant}_Glove_{side_label}_Production_Palm_Closure',
                collection,
                armature,
                side_token,
                materials['fabric'],
            )
            thumb_web, thumb_record = create_thumb_web(
                f'GS_{variant}_Glove_{side_label}_Production_Thumb_Web',
                collection,
                armature,
                side_token,
                materials['black'],
            )
            cuff_binding, binding_record = create_cuff_binding(
                f'GS_{variant}_Glove_{side_label}_Production_Cuff_Transition',
                collection,
                armature,
                side_token,
                materials['fabric'],
            )
            created = (palm, thumb_web, cuff_binding)
            report_variants[variant.lower()][side_label.lower()] = {
                'removedOversizedCuffObjects': removed,
                'refinedShell': shell.name,
                'cuffProfile': cuff_profile,
                'createdObjects': {obj.name: object_record(obj) for obj in created},
                'palmClosure': palm_record,
                'thumbWeb': thumb_record,
                'cuffBinding': binding_record,
            }

    bpy.context.scene['vnext_production_glove_surface_status'] = 'private-surface-refinement'
    bpy.context.scene['vnext_production_glove_surface_revision'] = SURFACE_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'private-production-glove-surface-authored',
        'decision': 'human-review-required',
        'surfaceRevision': SURFACE_REVISION,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'action': ACTION_NAME,
        'frame': FRAME,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'generatedSegmentedGeometryReused': False,
        'variants': report_variants,
        'reviewBoundary': (
            'The refined fitted surfaces remain private until close and all-action review prove '
            'a closed palm around the shaft, a credible thumb web, a tapered cuff, and a clean '
            'cuff-to-sleeve transition without new clipping.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_SURFACE_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
