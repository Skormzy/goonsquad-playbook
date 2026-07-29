import argparse
import json
import sys
from collections import defaultdict, deque
from pathlib import Path

import bpy


REQUIRED_ACTIONS = {
    'ready',
    'jog',
    'jog-to-sprint-ik',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
}
REVISION = 'licensed-eye-cornea-restoration-v1'


def parse_args():
    parser = argparse.ArgumentParser()
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


def action_key_counts():
    return {
        action.name: sum(len(fcurve.keyframe_points) for fcurve in action_fcurves(action))
        for action in bpy.data.actions
        if action.name in REQUIRED_ACTIONS
    }


def connected_components(mesh):
    adjacency = defaultdict(set)
    for edge in mesh.edges:
        first, second = edge.vertices
        adjacency[first].add(second)
        adjacency[second].add(first)
    remaining = set(range(len(mesh.vertices)))
    components = []
    while remaining:
        root = remaining.pop()
        queue = deque([root])
        component = {root}
        while queue:
            vertex = queue.popleft()
            for neighbor in adjacency[vertex]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        components.append(component)
    return sorted(components, key=len, reverse=True)


def component_metrics(obj, component):
    coordinates = [obj.data.vertices[index].co for index in component]
    minimum = [min(coordinate[axis] for coordinate in coordinates) for axis in range(3)]
    maximum = [max(coordinate[axis] for coordinate in coordinates) for axis in range(3)]
    center = [sum(coordinate[axis] for coordinate in coordinates) / len(coordinates) for axis in range(3)]
    return {
        'vertices': len(component),
        'minimumCm': [round(value, 6) for value in minimum],
        'maximumCm': [round(value, 6) for value in maximum],
        'centerCm': [round(value, 6) for value in center],
        'spanCm': [round(maximum[axis] - minimum[axis], 6) for axis in range(3)],
        'maximumSpanCm': max(maximum[axis] - minimum[axis] for axis in range(3)),
    }


def principled(material):
    return next(
        (node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'),
        None,
    )


def refine_inner_eye_material(material):
    if material is None or not material.use_nodes:
        raise RuntimeError('The private source is missing the licensed PBR eye material.')
    shader = principled(material)
    if shader is None:
        raise RuntimeError('The licensed PBR eye material has no Principled shader.')
    roughness = shader.inputs['Roughness']
    for link in list(roughness.links):
        material.node_tree.links.remove(link)
    roughness.default_value = 0.24
    shader.inputs['IOR'].default_value = 1.38
    material['gs_eye_revision'] = REVISION


def create_cornea_material():
    material = bpy.data.materials.get('GS_PBR_Cornea') or bpy.data.materials.new('GS_PBR_Cornea')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    shader.inputs['Base Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    shader.inputs['Roughness'].default_value = 0.055
    shader.inputs['Metallic'].default_value = 0.0
    shader.inputs['IOR'].default_value = 1.38
    shader.inputs['Alpha'].default_value = 0.045
    if shader.inputs.get('Coat Weight'):
        shader.inputs['Coat Weight'].default_value = 0.35
        shader.inputs['Coat Roughness'].default_value = 0.035
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    material.diffuse_color = (1.0, 1.0, 1.0, 0.045)
    material.surface_render_method = 'DITHERED'
    material['gs_pbr_surface'] = 'licensed-cornea-clearcoat'
    material['gs_pbr_authored'] = True
    material['gs_eye_revision'] = REVISION
    return material


def restore_eye_assignments(eye, eye_material, cornea_material):
    components = connected_components(eye.data)
    if len(components) != 4 or any(len(component) != 162 for component in components):
        raise RuntimeError('The licensed four-shell eye topology changed unexpectedly.')

    records = [
        {'indices': component, **component_metrics(eye, component)}
        for component in components
    ]
    assignments = []
    for side, sign in (('left', 1), ('right', -1)):
        side_records = [
            record for record in records
            if (1 if record['centerCm'][0] >= 0 else -1) == sign
        ]
        if len(side_records) != 2:
            raise RuntimeError(f'The licensed {side} eye must contain an inner and corneal shell.')
        side_records.sort(key=lambda record: record['maximumSpanCm'])
        side_records[0]['surface'] = 'inner-eye'
        side_records[0]['materialIndex'] = 0
        side_records[1]['surface'] = 'cornea'
        side_records[1]['materialIndex'] = 1
        assignments.extend(side_records)

    eye.data.materials.clear()
    eye.data.materials.append(eye_material)
    eye.data.materials.append(cornea_material)
    material_counts = [0, 0]
    assignment_by_vertex = {
        index: record['materialIndex']
        for record in assignments
        for index in record['indices']
    }
    for polygon in eye.data.polygons:
        material_index = assignment_by_vertex[polygon.vertices[0]]
        polygon.material_index = material_index
        material_counts[material_index] += 1

    return {
        'components': [
            {
                key: value
                for key, value in record.items()
                if key != 'indices' and key != 'maximumSpanCm'
            }
            for record in sorted(assignments, key=lambda item: (item['centerCm'][0], item['surface']))
        ],
        'innerEyePolygons': material_counts[0],
        'corneaPolygons': material_counts[1],
        'materialSlots': [material.name for material in eye.data.materials],
    }


def set_alert_eyelid_pose(body):
    keys = getattr(body.data, 'shape_keys', None)
    if keys is None:
        raise RuntimeError('The licensed body mesh has no facial shape keys.')
    values = {'Eye_Wide_L': 0.02, 'Eye_Wide_R': 0.02}
    for name, value in values.items():
        block = keys.key_blocks.get(name)
        if block is None:
            raise RuntimeError(f'Missing licensed facial shape key: {name}')
        block.value = value
    return values


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    eye = bpy.data.objects.get('CC_Base_Eye')
    body = bpy.data.objects.get('CC_Base_Body')
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    eye_material = bpy.data.materials.get('GS_PBR_Eye')
    if eye is None or body is None or armature is None:
        raise RuntimeError('The private athlete source is missing licensed face geometry or rig data.')

    counts_before = action_key_counts()
    if set(counts_before) != REQUIRED_ACTIONS:
        raise RuntimeError('The private athlete source is missing required runtime actions.')

    refine_inner_eye_material(eye_material)
    cornea_material = create_cornea_material()
    eye_assignments = restore_eye_assignments(eye, eye_material, cornea_material)
    eyelid_pose = set_alert_eyelid_pose(body)
    restored_visibility = {}
    for name in (
        'CC_Base_Eye',
        'CC_Base_EyeOcclusion',
        'CC_Base_TearLine',
        'CC_Base_Teeth',
        'CC_Base_Tongue',
    ):
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise RuntimeError(f'Missing licensed face object: {name}')
        restored_visibility[name] = {'before': obj.hide_render, 'after': False}
        obj.hide_render = False

    counts_after = action_key_counts()
    if counts_after != counts_before:
        raise RuntimeError('Face refinement changed animation key counts.')

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_face_status'] = 'licensed-eye-cornea-private-review'
    bpy.context.scene['vnext_face_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'licensed-eye-cornea-restored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'revision': REVISION,
        'eyeAssignments': eye_assignments,
        'innerEyeRoughness': 0.24,
        'cornea': {
            'material': cornea_material.name,
            'alpha': 0.045,
            'roughness': 0.055,
            'ior': 1.38,
        },
        'eyelidPose': eyelid_pose,
        'restoredRenderVisibility': restored_visibility,
        'actionKeyCounts': {
            name: {'before': counts_before[name], 'after': counts_after[name]}
            for name in sorted(counts_before)
        },
        'reviewBoundary': (
            'The licensed eye and cornea restoration remains private until close, all-action, '
            'export, runtime, cross-device, and explicit human visual review pass.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_FACE_POSE_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
