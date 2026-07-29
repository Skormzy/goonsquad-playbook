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
FIT_REVISION = 'production-integrated-source-fit-v2'
FINISH_REVISION = 'tucked-sleeve-manufactured-finish-v1'
SIDES = (('Left', 'L'), ('Right', 'R'))
VARIANTS = ('Home', 'Away')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(values, digits=5):
    return [round(float(value), digits) for value in values]


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
        raise RuntimeError(f'Unweighted vertex: {obj.name}[{vertex.index}]')
    return {name: weight / total for name, weight in weights.items()}


def recalculate_normals(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


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


def pose_profile(points, frame):
    distances = []
    radii = []
    for point in points:
        relative = point - frame['origin']
        distance = relative.dot(frame['axis'])
        radial = relative - frame['axis'] * distance
        distances.append(distance)
        radii.append(radial.length)
    return {
        'vertices': len(points),
        'distanceMinimumCm': round(min(distances), 5),
        'distanceMaximumCm': round(max(distances), 5),
        'radialMaximumCm': round(max(radii), 5),
        'radialMeanCm': round(sum(radii) / len(radii), 5),
    }


def tucked_sleeve_vertices(obj, armature, side_token):
    forearm_name = f'CC_Base_{side_token}_ForearmTwist02'
    hand_name = f'CC_Base_{side_token}_Hand'
    records = []
    for vertex in obj.data.vertices:
        weights = vertex_weights(obj, vertex, armature)
        cuff_weight = weights.get(forearm_name, 0.0) + weights.get(hand_name, 0.0)
        other_weight = 1.0 - cuff_weight
        if cuff_weight < 0.95 or other_weight > 0.05:
            continue
        matrix = weighted_matrix(armature, weights)
        records.append((vertex, weights, matrix, matrix @ vertex.co))
    if len(records) != 120:
        raise RuntimeError(
            f'Expected 120 final-cuff vertices on {obj.name}, found {len(records)}.'
        )
    return records


def refine_sleeve_overlap(obj, armature, side_token):
    frame = wrist_frame(armature, side_token)
    forearm_name = f'CC_Base_{side_token}_ForearmTwist02'
    hand_name = f'CC_Base_{side_token}_Hand'
    records = tucked_sleeve_vertices(obj, armature, side_token)
    before = pose_profile([record[3] for record in records], frame)
    forearm_group = obj.vertex_groups.get(forearm_name)
    if forearm_group is None:
        forearm_group = obj.vertex_groups.new(name=forearm_name)
    forearm_matrix = deform_matrix(armature, forearm_name)

    for vertex, weights, matrix, pose_point in records:
        relative = pose_point - frame['origin']
        distance = relative.dot(frame['axis'])
        radial = relative - frame['axis'] * distance
        hand_weight = weights.get(hand_name, 0.0)
        target_distance = 14.0 - hand_weight * 14.0
        target_radius = 4.40 - hand_weight * 1.60
        tucked_distance = target_distance
        tucked_radial = radial.copy()
        if radial.length > target_radius:
            tucked_radial *= target_radius / radial.length
        desired_pose = (
            frame['origin']
            + frame['axis'] * tucked_distance
            + tucked_radial
        )
        for group in obj.vertex_groups:
            group.remove([vertex.index])
        forearm_group.add([vertex.index], 1.0, 'REPLACE')
        vertex.co = forearm_matrix.inverted() @ desired_pose

    recalculate_normals(obj.data)
    for modifier in obj.modifiers:
        if modifier.type == 'ARMATURE':
            modifier.use_deform_preserve_volume = False
        elif modifier.type == 'SOLIDIFY':
            modifier.thickness = min(float(modifier.thickness), 0.10)
            modifier.offset = -0.55
    after_records = tucked_sleeve_vertices(obj, armature, side_token)
    after = pose_profile([record[3] for record in after_records], frame)
    obj['production_sleeve_overlap_revision'] = FINISH_REVISION
    obj['glove_overlap_role'] = 'tucked-inside-production-cuff'
    obj['runtime_approved'] = False
    return {
        'object': obj.name,
        'verticesAdjusted': len(records),
        'before': before,
        'after': after,
        'skinningMode': 'rigid-forearm-hidden-cuff',
        'solidifyMaximumCm': 0.10,
        'solidifyOffset': -0.55,
    }


def remove_material(name):
    material = bpy.data.materials.get(name)
    if material is not None and material.users == 0:
        bpy.data.materials.remove(material)


def make_finish_material(source_name, target_name, finish):
    source = bpy.data.materials.get(source_name)
    if source is None:
        raise RuntimeError(f'Missing source material: {source_name}')
    remove_material(target_name)
    material = source.copy()
    material.name = target_name
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = next(
        (node for node in nodes if node.type == 'BSDF_PRINCIPLED'),
        None,
    )
    if shader is None:
        raise RuntimeError(f'Missing Principled shader on {source_name}.')

    settings = {
        'shell': (185.0, 5.0, 0.68, 0.13, 0.025, 0.40, 0.56),
        'red': (165.0, 4.0, 0.64, 0.11, 0.022, 0.42, 0.57),
        'palm': (245.0, 6.0, 0.74, 0.08, 0.018, 0.62, 0.78),
        'thread': (120.0, 3.0, 0.60, 0.06, 0.012, 0.48, 0.62),
    }
    scale, detail, noise_roughness, strength, distance, rough_low, rough_high = settings[finish]
    texture = nodes.new('ShaderNodeTexCoord')
    texture.name = 'GS_Glove_Finish_Coordinates'
    noise = nodes.new('ShaderNodeTexNoise')
    noise.name = 'GS_Glove_Leather_Grain'
    noise.noise_dimensions = '3D'
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = detail
    noise.inputs['Roughness'].default_value = noise_roughness
    bump = nodes.new('ShaderNodeBump')
    bump.name = 'GS_Glove_Micro_Normal'
    bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.name = 'GS_Glove_Roughness_Variation'
    ramp.color_ramp.elements[0].position = 0.18
    ramp.color_ramp.elements[0].color = (rough_low, rough_low, rough_low, 1.0)
    ramp.color_ramp.elements[1].position = 0.82
    ramp.color_ramp.elements[1].color = (rough_high, rough_high, rough_high, 1.0)

    normal_input = shader.inputs.get('Normal')
    prior_normal = normal_input.links[0].from_socket if normal_input and normal_input.is_linked else None
    if normal_input and normal_input.is_linked:
        links.remove(normal_input.links[0])
    links.new(texture.outputs['Generated'], noise.inputs['Vector'])
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    if prior_normal is not None:
        links.new(prior_normal, bump.inputs['Normal'])
    links.new(bump.outputs['Normal'], normal_input)
    roughness_input = shader.inputs.get('Roughness')
    if roughness_input is not None:
        while roughness_input.links:
            links.remove(roughness_input.links[0])
        links.new(ramp.outputs['Color'], roughness_input)

    material['production_glove_finish_revision'] = FINISH_REVISION
    material['manufactured_surface'] = finish
    return material


def finish_materials():
    return {
        'shell': make_finish_material(
            'GS_PBR_Leather_Black',
            'GS_Production_Glove_Leather_Black',
            'shell',
        ),
        'red': make_finish_material(
            'GS_PBR_Leather_Red',
            'GS_Production_Glove_Leather_Red',
            'red',
        ),
        'palm': make_finish_material(
            'GS_PBR_Graphite',
            'GS_Production_Glove_Palm_Leather',
            'palm',
        ),
        'thread': make_finish_material(
            'GS_PBR_Rubber_White',
            'GS_Production_Glove_Thread',
            'thread',
        ),
    }


def material_replacement(material, materials):
    name = material.name if material else ''
    if 'Leather_Red' in name:
        return materials['red']
    if 'Graphite' in name or 'Palm' in name:
        return materials['palm']
    if 'Rubber_White' in name or 'Binding' in name:
        return materials['thread']
    return materials['shell']


def ensure_uv_layer(obj):
    if obj.data.uv_layers:
        return False
    vertices = obj.data.vertices
    minimum = Vector((min(vertex.co[axis] for vertex in vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in vertices) for axis in range(3)))
    dimensions = maximum - minimum
    axes = sorted(range(3), key=lambda axis: dimensions[axis], reverse=True)[:2]
    denominators = [max(float(dimensions[axis]), 1e-7) for axis in axes]
    uv_layer = obj.data.uv_layers.new(name='UVMap')
    for polygon in obj.data.polygons:
        for loop_index in polygon.loop_indices:
            vertex = vertices[obj.data.loops[loop_index].vertex_index]
            uv_layer.data[loop_index].uv = (
                (vertex.co[axes[0]] - minimum[axes[0]]) / denominators[0],
                (vertex.co[axes[1]] - minimum[axes[1]]) / denominators[1],
            )
    return True


def assign_finish_materials(variant, side_label, materials):
    prefix = f'GS_{variant}_Glove_{side_label}_'
    objects = [
        obj
        for obj in bpy.data.objects
        if obj.type == 'MESH'
        and obj.name.startswith(prefix)
        and obj.get('production_glove_fit_revision') == FIT_REVISION
    ]
    if len(objects) != 32:
        raise RuntimeError(
            f'Expected 32 integrated fitted objects for {variant} {side_label}, found {len(objects)}.'
        )
    replaced_slots = 0
    generated_uvs = 0
    for obj in objects:
        generated_uvs += int(ensure_uv_layer(obj))
        for index, material in enumerate(list(obj.data.materials)):
            obj.data.materials[index] = material_replacement(material, materials)
            replaced_slots += 1
        obj['production_glove_finish_revision'] = FINISH_REVISION
        obj['runtime_approved'] = False
    return {
        'objects': len(objects),
        'materialSlotsReplaced': replaced_slots,
        'uvReadyObjects': len(objects),
        'generatedUvObjects': generated_uvs,
    }


def segment_integrated_cuff(variant, side_label, side_token, armature, materials):
    shell = bpy.data.objects.get(f'GS_{variant}_Glove_{side_label}_ProductionShell')
    if shell is None:
        raise RuntimeError(f'Missing integrated shell for {variant} {side_label}.')
    red_index = next(
        (
            index
            for index, material in enumerate(shell.data.materials)
            if material == materials['red']
        ),
        None,
    )
    if red_index is None:
        shell.data.materials.append(materials['red'])
        red_index = len(shell.data.materials) - 1
    shell_index = next(
        index
        for index, material in enumerate(shell.data.materials)
        if material == materials['shell']
    )
    frame = wrist_frame(armature, side_token)
    forearm_name = f'CC_Base_{side_token}_ForearmTwist02'
    red_polygons = 0
    black_polygons = 0
    for polygon in shell.data.polygons:
        records = []
        for vertex_index in polygon.vertices:
            vertex = shell.data.vertices[vertex_index]
            weights = vertex_weights(shell, vertex, armature)
            records.append((vertex, weights, weighted_matrix(armature, weights) @ vertex.co))
        forearm_weight = sum(weights.get(forearm_name, 0.0) for _, weights, _ in records) / len(records)
        if forearm_weight < 0.35:
            continue
        center = sum((point for _, _, point in records), Vector()) / len(records)
        relative = center - frame['origin']
        distance = relative.dot(frame['axis'])
        radial = relative - frame['axis'] * distance
        angle = math.atan2(radial.dot(frame['bitangent']), radial.dot(frame['tangent']))
        integrated_red_panel = 2.2 <= distance <= 8.8 and math.cos(angle) >= 0.68
        polygon.material_index = red_index if integrated_red_panel else shell_index
        red_polygons += int(integrated_red_panel)
        black_polygons += int(not integrated_red_panel)
    if red_polygons < 50:
        raise RuntimeError(
            f'Integrated cuff segmentation was not visible on {shell.name}: {red_polygons} polygons.'
        )
    shell['production_glove_finish_revision'] = FINISH_REVISION
    shell['integrated_cuff_panel_polygons'] = red_polygons
    shell['floating_cuff_detail_geometry'] = False
    return {
        'shell': shell.name,
        'redPanelPolygons': red_polygons,
        'blackPanelPolygons': black_polygons,
        'floatingDetailGeometryCreated': False,
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

    materials = finish_materials()
    variants = {}
    for variant in VARIANTS:
        collection = bpy.data.collections.get(f'GS_Equipment_{variant}')
        if collection is None:
            raise RuntimeError(f'Missing equipment collection for {variant}.')
        variants[variant.lower()] = {}
        for side_label, side_token in SIDES:
            sleeve = bpy.data.objects.get(f'GS_{variant}_Jersey_Sleeve_{side_label}')
            if sleeve is None:
                raise RuntimeError(f'Missing jersey sleeve for {variant} {side_label}.')
            overlap = refine_sleeve_overlap(sleeve, armature, side_token)
            material_record = assign_finish_materials(variant, side_label, materials)
            cuff_segmentation = segment_integrated_cuff(
                variant,
                side_label,
                side_token,
                armature,
                materials,
            )
            variants[variant.lower()][side_label.lower()] = {
                'sleeveOverlap': overlap,
                'materialFinish': material_record,
                'integratedCuffSegmentation': cuff_segmentation,
            }

    bpy.context.scene['vnext_production_glove_finish_status'] = 'private-manufactured-finish'
    bpy.context.scene['vnext_production_glove_finish_revision'] = FINISH_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'private-production-glove-finish-authored',
        'decision': 'human-review-required',
        'finishRevision': FINISH_REVISION,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'action': ACTION_NAME,
        'frame': FRAME,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'generatedSegmentedAthleteReused': False,
        'materials': {
            key: {
                'name': material.name,
                'finish': material.get('manufactured_surface'),
                'revision': material.get('production_glove_finish_revision'),
            }
            for key, material in materials.items()
        },
        'variants': variants,
        'reviewBoundary': (
            'This private finish must prove that the jersey terminates inside the glove, the cuff '
            'reads as segmented protective equipment, and leather, palm, thread, grip, and action '
            'deformation hold up in close and all-action review before any GLB or runtime exposure.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_FINISH_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
