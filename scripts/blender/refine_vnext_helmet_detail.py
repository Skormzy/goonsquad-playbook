import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BASE_PATH = SCRIPT_DIR / 'refine_vnext_silhouette_geometry.py'
BASE_SPEC = importlib.util.spec_from_file_location('vnext_silhouette_base', BASE_PATH)
base = importlib.util.module_from_spec(BASE_SPEC)
BASE_SPEC.loader.exec_module(base)


SIDES = ('Home', 'Away')
HEAD_BONE = 'CC_Base_Head'
REVISION = 'open-face-manufacturing-detail-v1'
HELMET_CENTER = Vector((0.0, 1.4, 173.55))
HELMET_RADII = Vector((10.35, 11.6, 10.6))
HELMET_BROW_Z = 175.25
HELMET_OPENING_HALF_ANGLE = math.tau * 8.0 / 64.0


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def remove_previous_details(side):
    prefix = f'GS_{side}_Helmet_'
    removed = []
    for obj in list(bpy.data.objects):
        if obj.name.startswith(prefix) and obj.get('equipment_group') == 'helmet-detail':
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return sorted(removed)


def helmet_shell_geometry(longitudes=64, latitudes=32):
    vertices = []
    brow_phi = math.asin((HELMET_BROW_Z - HELMET_CENTER.z) / HELMET_RADII.z)
    lower_count = 13
    upper_count = latitudes - lower_count + 1
    lower_phis = [
        -0.96 + (brow_phi + 0.96) * latitude / (lower_count - 1)
        for latitude in range(lower_count)
    ]
    upper_phis = [
        brow_phi + (1.43 - brow_phi) * latitude / (upper_count - 1)
        for latitude in range(upper_count)
    ]
    phis = lower_phis + upper_phis[1:]
    for phi in phis:
        ring_scale = math.cos(phi)
        z = HELMET_CENTER.z + HELMET_RADII.z * math.sin(phi)
        for longitude in range(longitudes):
            theta = math.tau * longitude / longitudes
            vertices.append((
                HELMET_CENTER.x + HELMET_RADII.x * ring_scale * math.cos(theta),
                HELMET_CENTER.y + HELMET_RADII.y * ring_scale * math.sin(theta),
                z,
            ))
    top_index = len(vertices)
    vertices.append((HELMET_CENTER.x, HELMET_CENTER.y, HELMET_CENTER.z + HELMET_RADII.z))

    faces = []
    for latitude in range(latitudes - 1):
        upper_z = HELMET_CENTER.z + HELMET_RADII.z * math.sin(phis[latitude + 1])
        for longitude in range(longitudes):
            next_longitude = (longitude + 1) % longitudes
            theta = math.tau * (longitude + 0.5) / longitudes
            front_distance = abs(math.atan2(
                math.sin(theta + math.pi * 0.5),
                math.cos(theta + math.pi * 0.5),
            ))
            if upper_z <= HELMET_BROW_Z + 1e-4 and front_distance < HELMET_OPENING_HALF_ANGLE:
                continue
            faces.append((
                latitude * longitudes + longitude,
                latitude * longitudes + next_longitude,
                (latitude + 1) * longitudes + next_longitude,
                (latitude + 1) * longitudes + longitude,
            ))
    final_ring = (latitudes - 1) * longitudes
    for longitude in range(longitudes):
        next_longitude = (longitude + 1) % longitudes
        faces.append((final_ring + longitude, final_ring + next_longitude, top_index))
    return vertices, faces


def helmet_surface_point(phi, theta, offset=0.0):
    ring_scale = math.cos(phi)
    point = Vector((
        HELMET_CENTER.x + HELMET_RADII.x * ring_scale * math.cos(theta),
        HELMET_CENTER.y + HELMET_RADII.y * ring_scale * math.sin(theta),
        HELMET_CENTER.z + HELMET_RADII.z * math.sin(phi),
    ))
    if offset:
        point += (point - HELMET_CENTER).normalized() * offset
    return tuple(point)


def opening_trim_paths():
    brow_phi = math.asin((HELMET_BROW_Z - HELMET_CENTER.z) / HELMET_RADII.z)
    front = -math.pi * 0.5
    brow = tuple(
        helmet_surface_point(
            brow_phi,
            front - HELMET_OPENING_HALF_ANGLE
            + 2.0 * HELMET_OPENING_HALF_ANGLE * index / 10.0,
            0.16,
        )
        for index in range(11)
    )
    sides = {}
    lower_phi = math.asin((166.6 - HELMET_CENTER.z) / HELMET_RADII.z)
    for label, theta in (
        ('Left', front + HELMET_OPENING_HALF_ANGLE),
        ('Right', front - HELMET_OPENING_HALF_ANGLE),
    ):
        sides[label] = tuple(
            helmet_surface_point(
                brow_phi + (lower_phi - brow_phi) * index / 7.0,
                theta,
                0.16,
            )
            for index in range(8)
        )
    return brow, sides


def helmet_surface_top_z(x, y):
    radial = 1.0 - (x / HELMET_RADII.x) ** 2 - ((y - HELMET_CENTER.y) / HELMET_RADII.y) ** 2
    if radial <= 0.0:
        raise RuntimeError(f'Helmet surface sample lies outside the cap: {(x, y)}')
    return HELMET_CENTER.z + HELMET_RADII.z * math.sqrt(radial)


def helmet_stripe_geometry(steps=28):
    vertices = []
    start = -1.28
    end = 1.23
    half_width = 1.55
    for index in range(steps):
        angle = start + (end - start) * index / (steps - 1)
        y = HELMET_CENTER.y + HELMET_RADII.y * math.sin(angle)
        z = HELMET_CENTER.z + HELMET_RADII.z * math.cos(angle) + 0.18
        width_scale = max(0.72, math.cos(angle) ** 0.45)
        vertices.extend((
            (-half_width * width_scale, y, z),
            (half_width * width_scale, y, z),
        ))
    faces = []
    for index in range(steps - 1):
        start_index = index * 2
        faces.append((start_index, start_index + 1, start_index + 3, start_index + 2))
    return vertices, faces


def replace_rigid_surface(obj, vertices, faces, armature, thickness):
    before = base.local_bounds(obj)
    base.replace_mesh(obj, vertices, faces, armature, HEAD_BONE, 0.0)
    solidify = obj.modifiers.new('GS_HelmetThickness', 'SOLIDIFY')
    solidify.thickness = thickness
    solidify.offset = 0.0
    solidify.use_rim = True
    obj['head_detail_revision'] = REVISION
    return {'before': before, 'after': base.local_bounds(obj)}


def create_detail(name, collection, armature, vertices, faces, material, bevel=0.08):
    obj = base.create_rigid_detail(
        name,
        collection,
        armature,
        HEAD_BONE,
        vertices,
        faces,
        material,
        bevel,
    )
    obj['equipment_group'] = 'helmet-detail'
    obj['head_detail_revision'] = REVISION
    return obj


def oriented_tube(points, radius_x, radius_y=None, segments=10):
    radius_y = radius_x if radius_y is None else radius_y
    centers = [Vector(point) for point in points]
    vertices = []
    for index, center in enumerate(centers):
        if index == 0:
            tangent = (centers[1] - centers[0]).normalized()
        elif index == len(centers) - 1:
            tangent = (centers[-1] - centers[-2]).normalized()
        else:
            tangent = (centers[index + 1] - centers[index - 1]).normalized()
        reference = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((0.0, 1.0, 0.0))
        side = tangent.cross(reference).normalized()
        normal = side.cross(tangent).normalized()
        for segment in range(segments):
            angle = math.tau * segment / segments
            vertex = center + side * math.cos(angle) * radius_x + normal * math.sin(angle) * radius_y
            vertices.append(tuple(vertex))
    faces = []
    for ring in range(len(centers) - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((
                ring * segments + segment,
                ring * segments + next_segment,
                (ring + 1) * segments + next_segment,
                (ring + 1) * segments + segment,
            ))
    faces.append(tuple(range(segments))[::-1])
    last = (len(centers) - 1) * segments
    faces.append(tuple(last + segment for segment in range(segments)))
    return vertices, faces


def ellipsoid(center, radii, longitude_segments=20, latitude_segments=10):
    center = Vector(center)
    radii = Vector(radii)
    vertices = [tuple(center + Vector((0.0, 0.0, radii.z)))]
    for latitude in range(1, latitude_segments):
        phi = math.pi * latitude / latitude_segments
        for longitude in range(longitude_segments):
            theta = math.tau * longitude / longitude_segments
            vertices.append((
                center.x + radii.x * math.sin(phi) * math.cos(theta),
                center.y + radii.y * math.sin(phi) * math.sin(theta),
                center.z + radii.z * math.cos(phi),
            ))
    bottom = len(vertices)
    vertices.append(tuple(center - Vector((0.0, 0.0, radii.z))))
    faces = []
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((0, 1 + next_longitude, 1 + longitude))
    for latitude in range(latitude_segments - 2):
        ring = 1 + latitude * longitude_segments
        next_ring = ring + longitude_segments
        for longitude in range(longitude_segments):
            next_longitude = (longitude + 1) % longitude_segments
            faces.append((
                ring + longitude,
                ring + next_longitude,
                next_ring + next_longitude,
                next_ring + longitude,
            ))
    last_ring = 1 + (latitude_segments - 2) * longitude_segments
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((last_ring + longitude, last_ring + next_longitude, bottom))
    return vertices, faces


def add_tube_detail(side, label, points, radii, collection, armature, material, bevel=0.05):
    vertices, faces = oriented_tube(points, radii[0], radii[1])
    return create_detail(
        f'GS_{side}_Helmet_{label}',
        collection,
        armature,
        vertices,
        faces,
        material,
        bevel,
    )


def add_ellipsoid_detail(side, label, center, radii, collection, armature, material, bevel=0.04):
    vertices, faces = ellipsoid(center, radii)
    return create_detail(
        f'GS_{side}_Helmet_{label}',
        collection,
        armature,
        vertices,
        faces,
        material,
        bevel,
    )


def detail_summary(obj):
    return {
        'name': obj.name,
        'vertices': len(obj.data.vertices),
        'faces': len(obj.data.polygons),
        'uvLayers': len(obj.data.uv_layers),
        'unweightedVertices': sum(1 for vertex in obj.data.vertices if not vertex.groups),
        'materials': [material.name for material in obj.data.materials if material],
        'bounds': base.local_bounds(obj),
    }


def refine_variant(side, armature):
    collection = bpy.data.collections.get(f'GS_Equipment_{side}')
    shell = bpy.data.objects.get(f'GS_{side}_Helmet_Shell')
    stripe = bpy.data.objects.get(f'GS_{side}_Helmet_Center_Stripe')
    ear_cups = [
        bpy.data.objects.get(f'GS_{side}_Helmet_EarCup_Left'),
        bpy.data.objects.get(f'GS_{side}_Helmet_EarCup_Right'),
    ]
    if collection is None or shell is None or stripe is None or any(obj is None for obj in ear_cups):
        raise RuntimeError(f'Missing {side} helmet source geometry.')

    shell_material = shell.data.materials[0]
    trim_material = bpy.data.materials.get('GS_PBR_Leather_Black')
    red_material = bpy.data.materials.get('GS_PBR_Plastic_Red')
    if trim_material is None or red_material is None:
        raise RuntimeError('Helmet detail PBR materials are missing.')

    removed = remove_previous_details(side)
    shell_vertices, shell_faces = helmet_shell_geometry()
    stripe_vertices, stripe_faces = helmet_stripe_geometry()
    rebuilt = {
        'shell': replace_rigid_surface(shell, shell_vertices, shell_faces, armature, 0.24),
        'stripe': replace_rigid_surface(stripe, stripe_vertices, stripe_faces, armature, 0.11),
        'earCups': [],
    }
    for obj, sign in zip(ear_cups, (1.0, -1.0)):
        before = base.local_bounds(obj)
        vertices, faces = ellipsoid(
            (sign * 10.35, 2.2, 169.15),
            (0.72, 2.25, 2.55),
            longitude_segments=24,
            latitude_segments=12,
        )
        base.replace_mesh(obj, vertices, faces, armature, HEAD_BONE, 0.08)
        obj['head_detail_revision'] = REVISION
        rebuilt['earCups'].append({'before': before, 'after': base.local_bounds(obj)})

    details = []
    brow_trim, side_trims = opening_trim_paths()
    details.append(add_tube_detail(
        side,
        'EdgeTrim_Brow',
        brow_trim,
        (0.31, 0.22), collection, armature, trim_material,
    ))
    for label, sign in (('Left', 1.0), ('Right', -1.0)):
        details.append(add_tube_detail(
            side,
            f'EdgeTrim_{label}',
            side_trims[label],
            (0.31, 0.22), collection, armature, trim_material,
        ))
        details.append(add_ellipsoid_detail(
            side,
            f'EarPadding_{label}',
            (sign * 10.92, 2.0, 169.1),
            (0.17, 1.55, 1.72),
            collection, armature, trim_material,
        ))
        details.append(add_ellipsoid_detail(
            side,
            f'TempleFastener_{label}',
            (sign * 10.72, -1.7, 170.0),
            (0.18, 0.68, 0.68),
            collection, armature, red_material,
        ))

    for label, x, y_values in (
        ('Vent_Top_Left', -4.25, (-4.8, -3.8, -2.8, -1.8, -0.8)),
        ('Vent_Top_Right', 4.25, (-4.8, -3.8, -2.8, -1.8, -0.8)),
        ('Vent_Crown_Left', -5.0, (1.4, 2.3, 3.2, 4.1, 5.0)),
        ('Vent_Crown_Right', 5.0, (1.4, 2.3, 3.2, 4.1, 5.0)),
    ):
        points = tuple((x, y, helmet_surface_top_z(x, y) + 0.06) for y in y_values)
        details.append(add_tube_detail(
            side, label, points, (0.48, 0.09), collection, armature, trim_material, bevel=0.02,
        ))

    shell['head_detail_revision'] = REVISION
    shell['helmet_configuration'] = 'open-face-no-cage-no-visor'
    stripe['head_detail_revision'] = REVISION
    for obj in ear_cups:
        obj['head_detail_revision'] = REVISION
    return {
        'removedPreviousDetails': removed,
        'rebuilt': rebuilt,
        'details': [detail_summary(obj) for obj in details],
        'detailObjectCount': len(details),
        'configuration': 'open-face-no-cage-no-visor',
    }


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    armature = bpy.data.objects.get(base.ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing {base.ARMATURE_NAME}.')
    missing_actions = [name for name in base.REQUIRED_ACTIONS if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing actions: ' + ', '.join(missing_actions))
    cages = [obj.name for obj in bpy.data.objects if '_Helmet_Cage_' in obj.name]
    if cages:
        raise RuntimeError('Open-face source unexpectedly contains cage objects: ' + ', '.join(cages))

    armature.data.pose_position = 'REST'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    counts_before = base.action_key_counts()
    variants = {side.lower(): refine_variant(side, armature) for side in SIDES}
    counts_after = base.action_key_counts()
    if counts_before != counts_after:
        raise RuntimeError('Helmet detail authoring changed animation key counts.')

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_head_status'] = 'helmet-detail-private-review'
    bpy.context.scene['vnext_head_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'helmet-detail-authored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'revision': REVISION,
        'shellConstruction': {
            'centerCm': list(HELMET_CENTER),
            'radiiCm': list(HELMET_RADII),
            'longitudeSegments': 64,
            'latitudeSegments': 32,
            'method': 'clean-open-face-ellipsoid-cap-with-smooth-parametric-opening',
        },
        'construction': {
            'configuration': 'open-face-no-cage-no-visor',
            'detailFamilies': ['edge-trim', 'ear-padding', 'vents', 'fasteners'],
            'detailObjectsPerVariant': variants['home']['detailObjectCount'],
            'cageObjectCount': 0,
        },
        'variants': variants,
        'actionKeyCounts': {
            name: {'before': counts_before[name], 'after': counts_after[name]}
            for name in sorted(counts_before)
        },
        'reviewBoundary': (
            'The open-face helmet remains private until close front, rear, side, three-quarter, '
            'all-action, export, runtime, cross-device, and explicit human visual review pass.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_HELMET_DETAIL_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
