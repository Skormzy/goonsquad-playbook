import argparse
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
MANUFACTURED_PATH = SCRIPT_DIR / 'author_vnext_production_glove_manufactured.py'
MANUFACTURED_SPEC = importlib.util.spec_from_file_location(
    'vnext_glove_manufactured_author',
    MANUFACTURED_PATH,
)
manufactured = importlib.util.module_from_spec(MANUFACTURED_SPEC)
MANUFACTURED_SPEC.loader.exec_module(manufactured)
topology = manufactured.topology
base = manufactured.base

SCULPT_REVISION = 'integrated-sewn-volume-glove-v4'
REPLACED_COMPONENT = re.compile(
    r'GS_Glove_(?:Index|Middle|Ring|Pinky)_Armor_[123]$'
    r'|GS_Glove_Palm_Saddle$'
    r'|GS_Glove_Finger_Root_Yoke$'
    r'|GS_Glove_Thumb_Saddle$'
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


def soften_shell(shell):
    modifier = shell.modifiers.new('GS_Glove_Final_Sculpt_Soften', 'LAPLACIANSMOOTH')
    modifier.lambda_factor = 0.10
    modifier.iterations = 2
    modifier.use_volume_preserve = True
    modifier.use_normalized = True
    bpy.context.view_layer.objects.active = shell
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    base.smooth_mesh(shell.data)
    shell['glove_surface_revision'] = SCULPT_REVISION
    shell['subdivision_safe_normals'] = True


def create_panel_grid(name, x_stations, z_samples, station_shape, materials, role):
    vertices = []
    faces = []
    for x_index, x in enumerate(x_stations):
        progress = x_index / max(len(x_stations) - 1, 1)
        half_width, center_y, thickness, crown = station_shape(progress)
        for z_ratio in z_samples:
            edge = abs(z_ratio)
            z = half_width * z_ratio
            edge_relief = smoothstep((edge - 0.70) / 0.30)
            outer_y = center_y - thickness * 0.58 - crown * (1.0 - edge ** 1.8)
            inner_y = center_y + thickness * (0.42 - 0.16 * edge_relief)
            vertices.extend(((x, outer_y, z), (x, inner_y, z)))

    z_count = len(z_samples)
    for x_index in range(len(x_stations) - 1):
        for z_index in range(z_count - 1):
            current = (x_index * z_count + z_index) * 2
            across = current + 2
            next_x = current + z_count * 2
            next_x_across = next_x + 2
            faces.extend((
                (current, next_x, next_x_across, across),
                (current + 1, across + 1, next_x_across + 1, next_x + 1),
            ))
    for x_index in range(len(x_stations) - 1):
        first = x_index * z_count * 2
        next_x = first + z_count * 2
        last = first + (z_count - 1) * 2
        next_last = next_x + (z_count - 1) * 2
        faces.extend((
            (first, first + 1, next_x + 1, next_x),
            (last, next_last, next_last + 1, last + 1),
        ))
    for z_index in range(z_count - 1):
        first = z_index * 2
        across = first + 2
        last = ((len(x_stations) - 1) * z_count + z_index) * 2
        last_across = last + 2
        faces.extend((
            (first, across, across + 1, first + 1),
            (last, last + 1, last_across + 1, last_across),
        ))

    obj = base.create_mesh_object(name, vertices, faces)
    for material in materials:
        obj.data.materials.append(material)
    for polygon_index, polygon in enumerate(obj.data.polygons):
        polygon.material_index = 0 if polygon_index % 2 == 0 else min(1, len(materials) - 1)
    topology.bevel_object(obj, 0.00055, segments=3)
    obj['glove_source_role'] = role
    obj['component_count'] = 1
    obj['sculpt_revision'] = SCULPT_REVISION
    obj['runtime_approved'] = False
    return obj


def create_palm_saddle(materials):
    z_stations = tuple(-0.036 + index * 0.0036 for index in range(21))
    finger_centers = (-0.0255, -0.0087, 0.0087, 0.0260)
    angle_degrees = tuple(-158.0 + index * (136.0 / 12.0) for index in range(13))
    vertices = []
    faces = []
    for z_index, z in enumerate(z_stations):
        z_progress = z_index / (len(z_stations) - 1)
        edge_taper = 0.78 + 0.22 * math.sin(math.pi * z_progress) ** 0.72
        finger_lobe = max(math.exp(-((z - center) / 0.0058) ** 2) for center in finger_centers)
        for angle in angle_degrees:
            radians = math.radians(angle)
            heel_flare = smoothstep((-angle - 58.0) / 94.0)
            center_crown = math.sin(math.pi * z_progress) ** 0.72
            inner_radius = 0.0154 + 0.00035 * (1.0 - center_crown)
            depth = (
                (0.0032 + 0.0075 * heel_flare ** 1.35)
                * edge_taper
                * (0.30 + 0.70 * finger_lobe)
            )
            outer_radius = inner_radius + depth
            radial_x = math.cos(radians)
            radial_y = math.sin(radians)
            vertices.extend((
                (
                    base.SHAFT_CENTER.x + radial_x * inner_radius,
                    base.SHAFT_CENTER.y + radial_y * inner_radius,
                    z,
                ),
                (
                    base.SHAFT_CENTER.x + radial_x * outer_radius,
                    base.SHAFT_CENTER.y + radial_y * outer_radius,
                    z,
                ),
            ))
    angle_count = len(angle_degrees)
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
        faces.extend((
            (first, first + 1, next_z + 1, next_z),
            (last, next_last, next_last + 1, last + 1),
        ))
    for angle_index in range(angle_count - 1):
        first = angle_index * 2
        across = first + 2
        last = ((len(z_stations) - 1) * angle_count + angle_index) * 2
        last_across = last + 2
        faces.extend((
            (first, across, across + 1, first + 1),
            (last, last + 1, last_across + 1, last_across),
        ))
    obj = base.create_mesh_object('GS_Glove_Palm_Saddle', vertices, faces)
    base.assign_material(obj, materials['palm'])
    topology.bevel_object(obj, 0.00038, segments=3)
    obj['glove_source_role'] = 'formed-asymmetric-shaft-compression-saddle'
    obj['component_count'] = 1
    obj['sculpt_revision'] = SCULPT_REVISION
    obj['runtime_approved'] = False
    obj['integrated_shaft_channel'] = True
    obj['formed_leather_heel'] = True
    obj['formed_thumb_web'] = True
    return obj


def create_root_yoke(materials):
    x_stations = (-0.052, -0.043, -0.034, -0.025, -0.016, -0.007, 0.002, 0.010, 0.016)
    z_samples = tuple(-1.0 + index / 8.0 for index in range(17))
    widths = (0.039, 0.041, 0.042, 0.042, 0.041, 0.039, 0.037, 0.034, 0.031)
    centers = (0.037, 0.040, 0.041, 0.040, 0.038, 0.034, 0.030, 0.026, 0.022)

    def shape(progress):
        index = min(round(progress * (len(widths) - 1)), len(widths) - 1)
        flex_break = math.exp(-((progress - 0.70) / 0.075) ** 2)
        return widths[index], centers[index] - 0.0013 * flex_break, 0.0044, 0.0022 - 0.0008 * flex_break

    obj = create_panel_grid(
        'GS_Glove_Finger_Root_Yoke',
        x_stations,
        z_samples,
        shape,
        (materials['black'],),
        'sculpted-metacarpal-flex-yoke',
    )

    vertices = obj.data.vertices
    for vertex in vertices:
        normalized_z = vertex.co.z / max(0.028, 0.042 - 0.16 * max(vertex.co.x, 0.0))
        lane_centers = (-0.72, -0.24, 0.24, 0.72)
        lane_ridge = max(math.exp(-((normalized_z - center) / 0.17) ** 2) for center in lane_centers)
        groove = max(0.0, 1.0 - lane_ridge)
        if vertex.co.y > 0.0:
            vertex.co.y += 0.00068 * lane_ridge - 0.00025 * groove
    base.smooth_mesh(obj.data)
    obj['metacarpalFoamLanes'] = 4
    obj['articulatedFlexBreaks'] = 3
    return obj


def create_thumb_saddle(materials, _thumb_path):
    obj = base.panel_volume_mesh(
        'GS_Glove_Thumb_Saddle',
        (
            (-0.041, -0.030),
            (-0.031, -0.034),
            (-0.018, -0.032),
            (-0.004, -0.025),
            (0.008, -0.016),
            (0.012, -0.007),
            (0.006, -0.002),
            (-0.008, -0.008),
            (-0.023, -0.016),
            (-0.038, -0.022),
        ),
        center_y=-0.0340,
        thickness=0.0036,
    )
    base.assign_material(obj, materials['black'])
    topology.bevel_object(obj, 0.00078, segments=4)
    obj['glove_source_role'] = 'rounded-thumb-hinge-and-web-guard'
    obj['component_count'] = 1
    obj['thumbHingeZones'] = 3
    obj['sculpt_revision'] = SCULPT_REVISION
    obj['runtime_approved'] = False
    return obj


def create_foam_armor(name, path, start, end, half_width, dorsal_depth, materials, segment):
    station_count = 9
    indices = [
        round((start + (end - start) * index / (station_count - 1)) * (len(path) - 1))
        for index in range(station_count)
    ]
    lateral_samples = (-1.0, -0.68, -0.34, 0.0, 0.34, 0.68, 1.0)
    thicknesses = (0.0034, 0.0028, 0.0022)
    vertices = []
    faces = []
    for station, path_index in enumerate(indices):
        progress = path_index / max(len(path) - 1, 1)
        lateral, outward = topology.finger_axes(path[path_index])
        station_progress = station / (station_count - 1)
        end_taper = 0.72 + 0.28 * math.sin(math.pi * station_progress) ** 0.65
        width = half_width * manufactured.body_scale(progress) * end_taper
        thickness = thicknesses[segment - 1] * (0.82 + 0.18 * math.sin(math.pi * station_progress))
        base_center = path[path_index] + outward * dorsal_depth * manufactured.body_scale(progress) * 0.89
        for lateral_scale in lateral_samples:
            crown = (1.0 - abs(lateral_scale) ** 1.55)
            edge_lip = 0.00042 * (1.0 - crown)
            lower = base_center + lateral * width * lateral_scale - outward * edge_lip
            upper = lower + outward * thickness * (0.48 + 0.52 * crown)
            vertices.extend((tuple(lower), tuple(upper)))

    lateral_count = len(lateral_samples)
    for station in range(station_count - 1):
        for lateral_index in range(lateral_count - 1):
            current = (station * lateral_count + lateral_index) * 2
            across = current + 2
            next_station = current + lateral_count * 2
            next_across = next_station + 2
            faces.extend((
                (current, next_station, next_across, across),
                (current + 1, across + 1, next_across + 1, next_station + 1),
            ))
    for station in range(station_count - 1):
        first = station * lateral_count * 2
        next_station = first + lateral_count * 2
        last = first + (lateral_count - 1) * 2
        next_last = next_station + (lateral_count - 1) * 2
        faces.extend((
            (first, first + 1, next_station + 1, next_station),
            (last, next_last, next_last + 1, last + 1),
        ))
    for lateral_index in range(lateral_count - 1):
        first = lateral_index * 2
        across = first + 2
        last = ((station_count - 1) * lateral_count + lateral_index) * 2
        last_across = last + 2
        faces.extend((
            (first, across, across + 1, first + 1),
            (last, last + 1, last_across + 1, last_across),
        ))

    obj = base.create_mesh_object(name, vertices, faces)
    main_material = materials['red'] if segment == 1 else materials['black']
    obj.data.materials.append(main_material)
    obj.data.materials.append(materials['shell'])
    for polygon_index, polygon in enumerate(obj.data.polygons):
        polygon.material_index = 0 if polygon_index % 2 == 1 else 1
    topology.bevel_object(obj, 0.00042, segments=3)
    obj['glove_source_role'] = 'joint-specific-sculpted-foam-armor'
    obj['foamThicknessMm'] = round(thicknesses[segment - 1] * 1000.0, 2)
    obj['stitchedFlangeIntegrated'] = True
    obj['sculpt_revision'] = SCULPT_REVISION
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
    if len(removed) != 15:
        raise RuntimeError(f'Expected 15 manufactured components to resculpt, removed {len(removed)}.')

    shell = bpy.data.objects.get('GS_Production_Glove_Base')
    if shell is None:
        raise RuntimeError('The manufactured glove base shell is missing.')
    soften_shell(shell)

    materials = {
        'shell': bpy.data.materials['GS_Glove_Shell_Black'],
        'black': bpy.data.materials['GS_Glove_Armor_Black'],
        'red': bpy.data.materials['GS_Glove_Armor_Red'],
        'palm': bpy.data.materials['GS_Glove_Palm_Gray'],
    }
    fingers, thumb = manufactured.anatomical_paths()
    armor = []
    spans = ((0.028, 0.238), (0.318, 0.508), (0.592, 0.768))
    for label, _, half_width, _, dorsal_depth, _, _ in topology.FINGER_SPECS:
        for segment, (start, end) in enumerate(spans, start=1):
            armor.append(create_foam_armor(
                f'GS_Glove_{label}_Armor_{segment}',
                fingers[label],
                start,
                end,
                half_width * (0.98 if segment == 1 else 0.90),
                dorsal_depth,
                materials,
                segment,
            ))

    palm_saddle = create_palm_saddle(materials)
    root_yoke = create_root_yoke(materials)
    thumb_saddle = create_thumb_saddle(materials, thumb)

    source_objects = [
        obj for obj in bpy.data.objects
        if obj.type in {'MESH', 'CURVE'}
        and (obj.name == 'GS_Production_Glove_Base' or obj.name.startswith('GS_Glove_'))
        and 'Review_Shaft' not in obj.name
        and 'Studio' not in obj.name
    ]
    if len(source_objects) != 32:
        raise RuntimeError(f'Expected 32 sculpted source objects, found {len(source_objects)}.')

    bpy.context.scene['vnext_production_glove_sculpt_status'] = 'standalone-private-review'
    bpy.context.scene['vnext_production_glove_sculpt_revision'] = SCULPT_REVISION
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'standalone-integrated-sewn-volume-glove-authored',
        'decision': 'human-review-required',
        'sculptRevision': SCULPT_REVISION,
        'manufacturedRevision': manufactured.MANUFACTURED_REVISION,
        'sourceTopologyRevision': topology.TOPOLOGY_REVISION,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'runtimeSelectorAdded': False,
        'glbExported': False,
        'outputWorkfile': str(output_workfile),
        'sourceObjectCount': len(source_objects),
        'removedManufacturedComponents': sorted(removed),
        'shell': object_record(shell),
        'sculptedFoamArmor': {obj.name: object_record(obj) for obj in armor},
        'palmSaddle': object_record(palm_saddle),
        'fingerRootYoke': object_record(root_yoke),
        'thumbSaddle': object_record(thumb_saddle),
        'construction': {
            'independentlySkinnedFingerBodies': 4,
            'jointSpecificFoamArmorPanels': 12,
            'continuousFormedPalmHeelWebComponents': 1,
            'continuousFourLaneMetacarpalYokeComponents': 1,
            'layeredThumbHingeGuardComponents': 1,
            'subdivisionSafeShellNormals': True,
            'legacyFlatPalmSaddleComponents': 0,
            'legacyUniformArmorProfiles': 0,
            'sourceLevelSculptChange': True,
        },
        'reviewBoundary': (
            'This integrated sewn-volume source remains private until hidden close and all-action review '
            'approves the formed palm, metacarpal lanes, joint-specific foam, thumb hinge, edge finish, and deformation.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_SCULPT_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
