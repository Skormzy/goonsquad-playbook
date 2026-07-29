import argparse
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BASE_AUTHOR_PATH = SCRIPT_DIR / 'author_vnext_production_glove_base.py'
BASE_SPEC = importlib.util.spec_from_file_location('vnext_glove_base_author', BASE_AUTHOR_PATH)
base = importlib.util.module_from_spec(BASE_SPEC)
BASE_SPEC.loader.exec_module(base)

TOPOLOGY_REVISION = 'segmented-source-finger-shell-v2'
FINGER_SPECS = (
    ('Index', 0.0260, 0.0082, 0.0076, 0.0087, 0.0245, -0.0005),
    ('Middle', 0.0087, 0.0085, 0.0078, 0.0090, 0.0242, 0.0010),
    ('Ring', -0.0087, 0.0081, 0.0075, 0.0086, 0.0238, 0.0000),
    ('Pinky', -0.0255, 0.0072, 0.0068, 0.0078, 0.0232, -0.0025),
)
LEGACY_DETAIL = re.compile(
    r'GS_Glove_(?:Index|Middle|Ring|Pinky)_Pad_[123]'
    r'|GS_Glove_Knuckle_Cap_[1-4]'
    r'|GS_Glove_Finger_Gusset_[1-3]'
)


def source_paths():
    fingers = {}
    for label, z, _, _, _, wrap_radius, reach in FINGER_SPECS:
        full_path = base.finger_path(z, wrap_radius, reach=reach)
        retained = round((len(full_path) - 1) * 0.84) + 1
        fingers[label] = full_path[:retained]
    thumb = base.catmull_rom((
        (-0.043, -0.018, -0.026),
        (-0.025, -0.029, -0.024),
        (-0.006, -0.034, -0.019),
        (0.013, -0.032, -0.012),
        (0.030, -0.026, -0.004),
        (0.045, -0.017, 0.003),
        (0.051, -0.006, 0.007),
    ), samples_per_segment=6)
    return fingers, thumb


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def remove_object(obj):
    data = obj.data if obj.type in {'MESH', 'CURVE'} else None
    bpy.data.objects.remove(obj, do_unlink=True)
    if data and data.users == 0:
        if isinstance(data, bpy.types.Mesh):
            bpy.data.meshes.remove(data)
        elif isinstance(data, bpy.types.Curve):
            bpy.data.curves.remove(data)


def smoothstep(value):
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def finger_axes(point):
    radial = Vector((
        point.x - base.SHAFT_CENTER.x,
        point.y - base.SHAFT_CENTER.y,
        0.0,
    ))
    if radial.length_squared < 1e-10:
        radial = Vector((0.0, 1.0, 0.0))
    else:
        radial.normalize()
    root_blend = smoothstep((point.x - 0.002) / 0.022)
    outward = Vector((0.0, 1.0, 0.0)).lerp(radial, root_blend).normalized()
    return Vector((0.0, 0.0, 1.0)), outward


def add_uvs(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(58.0), island_margin=0.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)


def bevel_object(obj, width, segments=3):
    modifier = obj.modifiers.new(f'{obj.name}_Edge_Radius', 'BEVEL')
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = 'ANGLE'
    modifier.angle_limit = math.radians(28.0)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    base.smooth_mesh(obj.data)
    add_uvs(obj)


def body_taper(progress):
    taper = 1.04 - 0.22 * progress
    for center, width, depth in ((0.34, 0.055, 0.10), (0.67, 0.052, 0.11)):
        taper *= 1.0 - depth * math.exp(-((progress - center) / width) ** 2)
    if progress > 0.88:
        taper *= 1.0 - 0.25 * smoothstep((progress - 0.88) / 0.12)
    return taper


def create_finger_body(name, path, half_width, palm_depth, dorsal_depth, materials):
    profile = (
        (-0.50, -1.00),
        (0.50, -1.00),
        (0.94, -0.46),
        (1.00, 0.28),
        (0.66, 0.88),
        (0.00, 1.00),
        (-0.66, 0.88),
        (-1.00, 0.28),
        (-0.94, -0.46),
    )
    vertices = []
    faces = []
    for index, point in enumerate(path):
        progress = index / max(len(path) - 1, 1)
        taper = body_taper(progress)
        lateral, outward = finger_axes(point)
        center = point + outward * 0.00035
        for lateral_scale, outward_scale in profile:
            depth = dorsal_depth if outward_scale >= 0.0 else palm_depth
            vertices.append(tuple(
                center
                + lateral * lateral_scale * half_width * taper
                + outward * outward_scale * depth * taper
            ))
    profile_count = len(profile)
    for ring in range(len(path) - 1):
        first = ring * profile_count
        second = first + profile_count
        for profile_index in range(profile_count):
            next_index = (profile_index + 1) % profile_count
            faces.append((
                first + profile_index,
                first + next_index,
                second + next_index,
                second + profile_index,
            ))
    faces.append(tuple(range(profile_count))[::-1])
    last = (len(path) - 1) * profile_count
    faces.append(tuple(last + index for index in range(profile_count)))
    obj = base.create_mesh_object(name, vertices, faces)
    obj.data.materials.append(materials['shell'])
    obj.data.materials.append(materials['palm'])
    side_face_count = (len(path) - 1) * profile_count
    for polygon_index, polygon in enumerate(obj.data.polygons):
        edge = polygon_index % profile_count
        polygon.material_index = 1 if polygon_index < side_face_count and edge in (0, 1, 8) else 0
    add_uvs(obj)
    obj['glove_source_role'] = 'independently-skinned-finger-body'
    obj['integrated_palm_stall'] = True
    obj['runtime_approved'] = False
    return obj


def create_armor_plate(name, path, start, end, half_width, depth, material):
    indices = [
        round((start + (end - start) * amount / 5.0) * (len(path) - 1))
        for amount in range(6)
    ]
    vertices = []
    faces = []
    for station, path_index in enumerate(indices):
        progress = path_index / max(len(path) - 1, 1)
        taper = body_taper(progress)
        lateral, outward = finger_axes(path[path_index])
        end_taper = 0.88 + 0.12 * math.sin(math.pi * station / 5.0)
        width = half_width * taper * end_taper
        base_center = path[path_index] + outward * depth * taper * 0.88
        top_center = base_center + outward * 0.00235
        vertices.extend((
            tuple(base_center - lateral * width),
            tuple(base_center + lateral * width),
            tuple(top_center + lateral * width * 0.94),
            tuple(top_center - lateral * width * 0.94),
        ))
    for station in range(len(indices) - 1):
        first = station * 4
        second = first + 4
        faces.extend((
            (first, second, second + 1, first + 1),
            (first + 1, second + 1, second + 2, first + 2),
            (first + 2, second + 2, second + 3, first + 3),
            (first + 3, second + 3, second, first),
        ))
    faces.extend(((0, 1, 2, 3), (len(vertices) - 4, len(vertices) - 1, len(vertices) - 2, len(vertices) - 3)))
    obj = base.create_mesh_object(name, vertices, faces)
    base.assign_material(obj, material)
    bevel_object(obj, 0.00055, segments=2)
    obj['glove_source_role'] = 'bone-matched-dorsal-armor'
    obj['runtime_approved'] = False
    return obj


def append_sector_component(vertices, faces, z_center, half_width):
    start_index = len(vertices)
    angles = [math.radians(-140.0 + index * 15.0) for index in range(8)]
    inner_radius = 0.0154
    outer_radius = 0.0186
    for angle in angles:
        inner = Vector((
            base.SHAFT_CENTER.x + math.cos(angle) * inner_radius,
            base.SHAFT_CENTER.y + math.sin(angle) * inner_radius,
            z_center,
        ))
        outward = Vector((math.cos(angle), math.sin(angle), 0.0))
        outer = inner + outward * (outer_radius - inner_radius)
        vertices.extend((
            tuple(inner + Vector((0.0, 0.0, -half_width))),
            tuple(outer + Vector((0.0, 0.0, -half_width))),
            tuple(outer + Vector((0.0, 0.0, half_width))),
            tuple(inner + Vector((0.0, 0.0, half_width))),
        ))
    for angle_index in range(len(angles) - 1):
        first = start_index + angle_index * 4
        second = first + 4
        faces.extend((
            (first, second, second + 1, first + 1),
            (first + 1, second + 1, second + 2, first + 2),
            (first + 2, second + 2, second + 3, first + 3),
            (first + 3, second + 3, second, first),
        ))
    faces.extend((
        (start_index, start_index + 1, start_index + 2, start_index + 3),
        tuple(range(start_index + len(angles) * 4 - 4, start_index + len(angles) * 4))[::-1],
    ))


def create_palm_channel(material):
    vertices = []
    faces = []
    for z_center, half_width in ((0.0260, 0.0074), (0.0087, 0.0077), (-0.0087, 0.0075), (-0.0255, 0.0066)):
        append_sector_component(vertices, faces, z_center, half_width)
    obj = base.create_mesh_object('GS_Glove_Palm_Channel', vertices, faces)
    base.assign_material(obj, material)
    bevel_object(obj, 0.00035, segments=2)
    obj['glove_source_role'] = 'four-stall-shaft-compression-channel'
    obj['component_count'] = 4
    obj['runtime_approved'] = False
    return obj


def object_record(obj):
    metrics = base.mesh_metrics(obj)
    return {
        **metrics,
        'materials': [material.name for material in obj.data.materials if material],
        'uvReady': bool(obj.data.uv_layers),
        'role': obj.get('glove_source_role'),
    }


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    base.clear_scene()
    base.BASE_REVISION = TOPOLOGY_REVISION
    materials = {
        'shell': base.make_material('GS_Glove_Shell_Black', (0.018, 0.022, 0.029), 0.47),
        'black': base.make_material('GS_Glove_Armor_Black', (0.025, 0.029, 0.036), 0.38),
        'red': base.make_material('GS_Glove_Armor_Red', (0.48, 0.012, 0.018), 0.44),
        'palm': base.make_material('GS_Glove_Palm_Gray', (0.18, 0.20, 0.22), 0.66, 58.0, 0.11),
        'binding': base.make_material('GS_Glove_Binding_White', (0.82, 0.84, 0.86), 0.48, 34.0, 0.08),
        'shaft': base.make_material('GS_Glove_Shaft_Reference', (0.035, 0.042, 0.052), 0.28, 22.0, 0.05),
    }

    forms, _, _ = base.create_glove_forms()
    finger_paths, thumb_path = source_paths()
    finger_forms = [obj for obj in forms if re.search(r'_Form_(Index|Middle|Ring|Pinky)$', obj.name)]
    structural_forms = [obj for obj in forms if obj not in finger_forms]
    shell = base.join_and_remesh(structural_forms)
    base.assign_base_material_regions(shell, materials['shell'], materials['palm'])
    add_uvs(shell)
    for obj in finger_forms:
        remove_object(obj)

    inherited_details = base.create_details(materials, finger_paths, thumb_path)
    retained_details = []
    removed_details = []
    for obj in inherited_details:
        if LEGACY_DETAIL.fullmatch(obj.name):
            removed_details.append(obj.name)
            remove_object(obj)
        else:
            retained_details.append(obj)
    for obj in retained_details:
        if obj.type == 'MESH' and not obj.data.uv_layers:
            add_uvs(obj)

    finger_bodies = []
    armor = []
    for label, _, half_width, palm_depth, dorsal_depth, _, _ in FINGER_SPECS:
        path = finger_paths[label]
        body = create_finger_body(
            f'GS_Glove_{label}_Finger_Body',
            path,
            half_width,
            palm_depth,
            dorsal_depth,
            materials,
        )
        finger_bodies.append(body)
        for segment, (start, end) in enumerate(((0.04, 0.28), (0.34, 0.59), (0.65, 0.90)), start=1):
            plate_material = materials['red'] if segment == 1 else materials['black']
            armor.append(create_armor_plate(
                f'GS_Glove_{label}_Armor_{segment}',
                path,
                start,
                end,
                half_width * 0.82,
                dorsal_depth,
                plate_material,
            ))
    palm_channel = create_palm_channel(materials['palm'])
    shaft = base.create_shaft(materials['shaft'])
    base.create_studio(materials)

    source_objects = [shell, *retained_details, *finger_bodies, *armor, palm_channel]
    if len(source_objects) != 30:
        raise RuntimeError(f'Expected 30 source objects, found {len(source_objects)}.')
    shell['glove_source_role'] = 'finger-free-cuff-hand-thumb-shell'
    shell['integrated_finger_loops'] = 0
    shell['runtime_approved'] = False

    bpy.context.scene['vnext_production_glove_topology_status'] = 'standalone-private-review'
    bpy.context.scene['vnext_production_glove_topology_revision'] = TOPOLOGY_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'standalone-segmented-source-glove-authored',
        'decision': 'human-review-required',
        'topologyRevision': TOPOLOGY_REVISION,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'outputWorkfile': str(output_workfile),
        'sourceObjectCount': len(source_objects),
        'shell': object_record(shell),
        'fingerBodies': {obj.name: object_record(obj) for obj in finger_bodies},
        'dorsalArmor': {obj.name: object_record(obj) for obj in armor},
        'palmChannel': object_record(palm_channel),
        'retainedManufacturedDetails': [obj.name for obj in retained_details],
        'removedLegacyDetails': removed_details,
        'shaftReference': {
            'object': shaft.name,
            'halfWidthM': base.SHAFT_HALF_WIDTH,
            'halfDepthM': base.SHAFT_HALF_DEPTH,
            'referenceOnly': True,
        },
        'construction': {
            'integratedHandBoundFingerLoops': 0,
            'independentlySkinnedFingerBodies': 4,
            'integratedPalmStalls': 4,
            'boneMatchedDorsalArmorZones': 12,
            'shaftCompressionChannelComponents': 4,
            'fingerBodyMaterialRegions': ['shell-leather', 'palm-leather'],
            'legacySweepFingerPads': 0,
            'legacyRoundedKnuckleCaps': 0,
            'fingerRootOverlapIntoHand': True,
            'sourceLevelArchitectureChange': True,
        },
        'reviewBoundary': (
            'This source-level architecture must pass private fit, nine-action shaft contact, '
            'palm closure, deformation, and close human review before any GLB export or runtime use.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_TOPOLOGY_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
