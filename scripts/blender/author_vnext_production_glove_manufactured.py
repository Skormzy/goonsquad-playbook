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
TOPOLOGY_PATH = SCRIPT_DIR / 'author_vnext_production_glove_topology.py'
TOPOLOGY_SPEC = importlib.util.spec_from_file_location('vnext_glove_topology_author', TOPOLOGY_PATH)
topology = importlib.util.module_from_spec(TOPOLOGY_SPEC)
TOPOLOGY_SPEC.loader.exec_module(topology)
base = topology.base

MANUFACTURED_REVISION = 'anatomical-sewn-glove-shell-v3'
REPLACED_COMPONENT = re.compile(
    r'GS_Glove_(?:Index|Middle|Ring|Pinky)_(?:Finger_Body|Armor_[123])$'
    r'|GS_Glove_Palm_Channel$'
)


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


def anatomical_paths():
    source_fingers, thumb = topology.source_paths()
    fingers = {}
    for label, path in source_fingers.items():
        z = path[0].z
        reach = next(spec[-1] for spec in topology.FINGER_SPECS if spec[0] == label)
        root = [
            Vector((-0.031 + reach, 0.0010, z)),
            Vector((-0.025 + reach, 0.0020, z)),
            Vector((-0.019 + reach, 0.0035, z)),
            Vector((-0.014 + reach, 0.0055, z)),
        ]
        fingers[label] = root + list(path[1:])
    return fingers, thumb


def body_scale(progress):
    root_flare = 1.0 + 0.16 * (1.0 - smoothstep(progress / 0.20))
    joint_relief = 1.0
    for center, width, depth in ((0.34, 0.050, 0.11), (0.61, 0.046, 0.13)):
        joint_relief *= 1.0 - depth * math.exp(-((progress - center) / width) ** 2)
    tip = 1.0 - 0.34 * smoothstep((progress - 0.79) / 0.21)
    return root_flare * joint_relief * tip


def create_anatomical_finger_body(name, path, half_width, palm_depth, dorsal_depth, materials):
    profile = (
        (-0.54, -1.00),
        (0.54, -1.00),
        (0.88, -0.62),
        (1.00, -0.14),
        (0.92, 0.42),
        (0.62, 0.84),
        (0.00, 1.00),
        (-0.62, 0.84),
        (-0.92, 0.42),
        (-1.00, -0.14),
        (-0.88, -0.62),
    )
    vertices = []
    faces = []
    for index, point in enumerate(path):
        progress = index / max(len(path) - 1, 1)
        scale = body_scale(progress)
        lateral, outward = topology.finger_axes(point)
        center = point + outward * (0.0004 - 0.0007 * smoothstep(progress))
        for lateral_scale, outward_scale in profile:
            depth = dorsal_depth if outward_scale >= 0.0 else palm_depth
            sidewall_relief = 1.0 - 0.08 * abs(lateral_scale) * smoothstep(progress)
            vertices.append(tuple(
                center
                + lateral * lateral_scale * half_width * scale
                + outward * outward_scale * depth * scale * sidewall_relief
            ))
    profile_count = len(profile)
    for ring in range(len(path) - 1):
        first = ring * profile_count
        second = first + profile_count
        for edge in range(profile_count):
            next_edge = (edge + 1) % profile_count
            faces.append((first + edge, first + next_edge, second + next_edge, second + edge))
    faces.append(tuple(range(profile_count))[::-1])
    last = (len(path) - 1) * profile_count
    faces.append(tuple(last + index for index in range(profile_count)))

    obj = base.create_mesh_object(name, vertices, faces)
    obj.data.materials.append(materials['shell'])
    obj.data.materials.append(materials['palm'])
    obj.data.materials.append(materials['sidewall'])
    side_face_count = (len(path) - 1) * profile_count
    for polygon_index, polygon in enumerate(obj.data.polygons):
        if polygon_index >= side_face_count:
            polygon.material_index = 0
            continue
        edge = polygon_index % profile_count
        if edge in (0, 1, 9, 10):
            polygon.material_index = 1
        elif edge in (2, 3, 8):
            polygon.material_index = 2
        else:
            polygon.material_index = 0
    topology.add_uvs(obj)
    obj['glove_source_role'] = 'anatomical-sewn-finger-body'
    obj['integrated_palm_stall'] = True
    obj['integrated_sidewall'] = True
    obj['root_bridge_length_mm'] = 31.0
    obj['runtime_approved'] = False
    return obj


def create_contoured_armor(name, path, start, end, half_width, dorsal_depth, material, profile):
    stations = 7
    indices = [round((start + (end - start) * index / (stations - 1)) * (len(path) - 1)) for index in range(stations)]
    vertices = []
    faces = []
    for station, path_index in enumerate(indices):
        progress = path_index / max(len(path) - 1, 1)
        lateral, outward = topology.finger_axes(path[path_index])
        width_scale = profile[station]
        center = path[path_index] + outward * dorsal_depth * body_scale(progress) * 0.93
        crown = 0.0019 + 0.0007 * math.sin(math.pi * station / (stations - 1))
        left = center - lateral * half_width * width_scale
        right = center + lateral * half_width * width_scale
        vertices.extend((
            tuple(left),
            tuple(right),
            tuple(right + outward * crown),
            tuple(left + outward * crown),
        ))
    for station in range(stations - 1):
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
    topology.bevel_object(obj, 0.00045, segments=2)
    obj['glove_source_role'] = 'varied-contoured-dorsal-armor'
    obj['manufactured_panel_profile'] = list(profile)
    obj['runtime_approved'] = False
    return obj


def create_palm_saddle(material):
    z_stations = (-0.0350, -0.0290, -0.0200, -0.0100, 0.0, 0.0100, 0.0200, 0.0290, 0.0350)
    angles = [math.radians(-152.0 + index * 15.5) for index in range(9)]
    vertices = []
    faces = []
    for z_index, z in enumerate(z_stations):
        edge_scale = 0.92 + 0.08 * math.sin(math.pi * z_index / (len(z_stations) - 1))
        for angle in angles:
            radial = Vector((math.cos(angle), math.sin(angle), 0.0))
            inner_radius = 0.0156
            outer_radius = inner_radius + 0.0042 * edge_scale
            vertices.extend((
                tuple(base.SHAFT_CENTER + radial * inner_radius + Vector((0.0, 0.0, z))),
                tuple(base.SHAFT_CENTER + radial * outer_radius + Vector((0.0, 0.0, z))),
            ))
    angle_count = len(angles)
    for z_index in range(len(z_stations) - 1):
        for angle_index in range(angle_count - 1):
            current = (z_index * angle_count + angle_index) * 2
            across = current + 2
            next_z = current + angle_count * 2
            next_z_across = next_z + 2
            faces.extend((
                (current, next_z, next_z_across, across),
                (current + 1, across + 1, next_z_across + 1, next_z + 1),
            ))
    for z_index in range(len(z_stations) - 1):
        first = z_index * angle_count * 2
        next_z = first + angle_count * 2
        last = first + (angle_count - 1) * 2
        next_last = next_z + (angle_count - 1) * 2
        faces.extend(((first, first + 1, next_z + 1, next_z), (last, next_last, next_last + 1, last + 1)))
    first_ring = [index * 2 for index in range(angle_count)]
    first_outer = [index * 2 + 1 for index in range(angle_count)]
    last_start = (len(z_stations) - 1) * angle_count * 2
    last_ring = [last_start + index * 2 for index in range(angle_count)]
    last_outer = [last_start + index * 2 + 1 for index in range(angle_count)]
    for index in range(angle_count - 1):
        faces.extend((
            (first_ring[index], first_ring[index + 1], first_outer[index + 1], first_outer[index]),
            (last_ring[index], last_outer[index], last_outer[index + 1], last_ring[index + 1]),
        ))
    obj = base.create_mesh_object('GS_Glove_Palm_Saddle', vertices, faces)
    base.assign_material(obj, material)
    topology.bevel_object(obj, 0.00028, segments=2)
    obj['glove_source_role'] = 'continuous-anatomical-palm-saddle'
    obj['component_count'] = 1
    obj['integrated_shaft_channel'] = True
    obj['runtime_approved'] = False
    return obj


def create_root_yoke(material):
    x_stations = (-0.046, -0.036, -0.024, -0.012, 0.000, 0.011)
    y_stations = (0.0395, 0.0390, 0.0355, 0.0295, 0.0230, 0.0185)
    z_stations = (-0.038, -0.031, -0.021, -0.0105, 0.0, 0.0105, 0.021, 0.031, 0.038)
    vertices = []
    faces = []
    for x, y in zip(x_stations, y_stations):
        for z_index, z in enumerate(z_stations):
            edge_drop = 0.0022 * abs(z) / z_stations[-1]
            top = Vector((x, y - edge_drop, z))
            vertices.extend((tuple(top - Vector((0.0, 0.0060, 0.0))), tuple(top)))
    z_count = len(z_stations)
    for x_index in range(len(x_stations) - 1):
        for z_index in range(z_count - 1):
            current = (x_index * z_count + z_index) * 2
            across = current + 2
            next_x = current + z_count * 2
            next_x_across = next_x + 2
            faces.extend((
                (current, across, next_x_across, next_x),
                (current + 1, next_x + 1, next_x_across + 1, across + 1),
            ))
    for x_index in range(len(x_stations) - 1):
        first = x_index * z_count * 2
        next_x = first + z_count * 2
        last = first + (z_count - 1) * 2
        next_last = next_x + (z_count - 1) * 2
        faces.extend(((first, next_x, next_x + 1, first + 1), (last, last + 1, next_last + 1, next_last)))
    for z_index in range(z_count - 1):
        first = z_index * 2
        across = first + 2
        last = ((len(x_stations) - 1) * z_count + z_index) * 2
        last_across = last + 2
        faces.extend(((first, first + 1, across + 1, across), (last, last_across, last_across + 1, last + 1)))
    obj = base.create_mesh_object('GS_Glove_Finger_Root_Yoke', vertices, faces)
    base.assign_material(obj, material)
    topology.bevel_object(obj, 0.00055, segments=3)
    obj['glove_source_role'] = 'finger-root-backhand-yoke'
    obj['component_count'] = 1
    obj['runtime_approved'] = False
    return obj


def create_thumb_saddle(material):
    obj = base.panel_volume_mesh(
        'GS_Glove_Thumb_Saddle',
        (
            (-0.040, -0.030),
            (-0.024, -0.032),
            (-0.008, -0.026),
            (0.006, -0.017),
            (0.012, -0.009),
            (0.006, -0.004),
            (-0.010, -0.010),
            (-0.030, -0.020),
        ),
        center_y=-0.0330,
        thickness=0.0035,
    )
    base.assign_material(obj, material)
    topology.bevel_object(obj, 0.00065, segments=3)
    obj['glove_source_role'] = 'anatomical-thumb-saddle'
    obj['component_count'] = 1
    obj['runtime_approved'] = False
    return obj


def create_binding(name, points, material, role):
    obj = base.add_curve(name, points, 0.00062, material)
    obj['glove_source_role'] = role
    obj['runtime_approved'] = False
    return obj


def object_record(obj):
    metrics = base.mesh_metrics(obj) if obj.type == 'MESH' else {'object': obj.name, 'type': obj.type}
    return {
        **metrics,
        'materials': [material.name for material in obj.data.materials if material],
        'uvReady': bool(obj.data.uv_layers) if obj.type == 'MESH' else True,
        'role': obj.get('glove_source_role'),
    }


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    removed = []
    for obj in list(bpy.data.objects):
        if REPLACED_COMPONENT.fullmatch(obj.name):
            removed.append(obj.name)
            remove_object(obj)
    if len(removed) != 17:
        raise RuntimeError(f'Expected 17 superseded topology components, removed {len(removed)}.')

    materials = {
        'shell': bpy.data.materials['GS_Glove_Shell_Black'],
        'black': bpy.data.materials['GS_Glove_Armor_Black'],
        'red': bpy.data.materials['GS_Glove_Armor_Red'],
        'palm': bpy.data.materials['GS_Glove_Palm_Gray'],
        'binding': bpy.data.materials['GS_Glove_Binding_White'],
        'sidewall': bpy.data.materials['GS_Glove_Armor_Red'],
    }
    fingers, _ = anatomical_paths()
    bodies = []
    armor = []
    spans = ((0.025, 0.235), (0.315, 0.505), (0.590, 0.765))
    profiles = (
        (0.70, 0.88, 1.02, 1.08, 1.04, 0.90, 0.70),
        (0.64, 0.82, 0.96, 1.00, 0.94, 0.78, 0.58),
        (0.56, 0.74, 0.88, 0.93, 0.84, 0.66, 0.46),
    )
    for label, _, half_width, palm_depth, dorsal_depth, _, _ in topology.FINGER_SPECS:
        path = fingers[label]
        bodies.append(create_anatomical_finger_body(
            f'GS_Glove_{label}_Finger_Body',
            path,
            half_width,
            palm_depth * 0.92,
            dorsal_depth,
            materials,
        ))
        for segment, ((start, end), profile) in enumerate(zip(spans, profiles), start=1):
            armor.append(create_contoured_armor(
                f'GS_Glove_{label}_Armor_{segment}',
                path,
                start,
                end,
                half_width * (0.96 if segment == 1 else 0.88),
                dorsal_depth,
                materials['red'] if segment == 1 else materials['black'],
                profile,
            ))

    palm_saddle = create_palm_saddle(materials['palm'])
    root_yoke = create_root_yoke(materials['black'])
    thumb_saddle = create_thumb_saddle(materials['black'])

    source_objects = [
        obj for obj in bpy.data.objects
        if obj.type in {'MESH', 'CURVE'}
        and (obj.name == 'GS_Production_Glove_Base' or obj.name.startswith('GS_Glove_'))
        and 'Review_Shaft' not in obj.name
        and 'Studio' not in obj.name
    ]
    if len(source_objects) != 32:
        raise RuntimeError(f'Expected 32 manufactured source objects, found {len(source_objects)}.')
    bindings = [
        obj for obj in source_objects
        if 'Binding' in obj.name or obj.name.endswith('_Seam')
    ]

    bpy.context.scene['vnext_production_glove_manufactured_status'] = 'standalone-private-review'
    bpy.context.scene['vnext_production_glove_manufactured_revision'] = MANUFACTURED_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'standalone-anatomical-sewn-glove-authored',
        'decision': 'human-review-required',
        'manufacturedRevision': MANUFACTURED_REVISION,
        'sourceTopologyRevision': topology.TOPOLOGY_REVISION,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'outputWorkfile': str(output_workfile),
        'sourceObjectCount': len(source_objects),
        'removedSupersededComponents': removed,
        'fingerBodies': {obj.name: object_record(obj) for obj in bodies},
        'dorsalArmor': {obj.name: object_record(obj) for obj in armor},
        'palmSaddle': object_record(palm_saddle),
        'fingerRootYoke': object_record(root_yoke),
        'thumbSaddle': object_record(thumb_saddle),
        'edgeBindings': {obj.name: object_record(obj) for obj in bindings},
        'construction': {
            'independentlySkinnedFingerBodies': 4,
            'integratedFingerSidewalls': 4,
            'variedContouredArmorPanels': 12,
            'continuousPalmSaddleComponents': 1,
            'continuousFingerRootYokeComponents': 1,
            'anatomicalThumbSaddleComponents': 1,
            'edgeBindingPaths': 6,
            'legacyPalmChannelComponents': 0,
            'legacyHandBoundFingerLoops': 0,
            'sourceLevelArchitectureRetained': True,
        },
        'reviewBoundary': (
            'This manufactured source remains private until hidden close and all-action review '
            'approves palm closure, finger-root continuity, varied armor, thumb construction, and edge finish.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_MANUFACTURED_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
