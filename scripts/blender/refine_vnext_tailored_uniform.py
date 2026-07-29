import argparse
import json
import math
import sys
from collections import Counter, deque
from pathlib import Path

import bpy
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
SIDES = ('Home', 'Away')
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
TORSO_RINGS = (
    {'z': 96.0, 'x': 23.2, 'y': 14.2, 'center_y': 1.5},
    {'z': 104.0, 'x': 24.5, 'y': 14.5, 'center_y': 1.6},
    {'z': 116.0, 'x': 24.8, 'y': 14.7, 'center_y': 1.7},
    {'z': 130.0, 'x': 25.6, 'y': 15.0, 'center_y': 1.9},
    {'z': 143.0, 'x': 24.8, 'y': 14.5, 'center_y': 2.2},
    {'z': 151.5, 'x': 18.8, 'y': 11.8, 'center_y': 2.8},
    {'z': 157.0, 'x': 8.9, 'y': 6.4, 'center_y': 3.7},
)
SLEEVE_PROFILE = (
    {'x': 18.0, 'y': 5.7, 'z': 145.5, 'vertical': 3.6, 'depth': 4.5},
    {'x': 23.5, 'y': 6.4, 'z': 145.5, 'vertical': 5.6, 'depth': 5.4},
    {'x': 30.2, 'y': 6.5, 'z': 142.2, 'vertical': 7.2, 'depth': 6.3},
    {'x': 41.6, 'y': 6.45, 'z': 135.35, 'vertical': 6.8, 'depth': 6.0},
    {'x': 52.6, 'y': 6.2, 'z': 128.8, 'vertical': 5.9, 'depth': 5.3},
    {'x': 61.6, 'y': 6.0, 'z': 123.4, 'vertical': 5.0, 'depth': 4.6},
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def smoothstep(start, end, value):
    if end == start:
        return 0.0
    unit = max(0.0, min(1.0, (value - start) / (end - start)))
    return unit * unit * (3.0 - 2.0 * unit)


def set_smooth(mesh):
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def add_armature_modifier(obj, armature):
    modifier = obj.modifiers.new('GS_Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = True


def add_cloth_modifiers(obj):
    subdivision = obj.modifiers.new('GS_GarmentSubdivision', 'SUBSURF')
    subdivision.subdivision_type = 'CATMULL_CLARK'
    subdivision.levels = 1
    subdivision.render_levels = 1
    solidify = obj.modifiers.new('GS_ClothThickness', 'SOLIDIFY')
    solidify.thickness = 0.16
    solidify.offset = 0.0
    solidify.use_rim = True


def create_object(name, collection, armature, vertices, faces, materials):
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    for material in materials:
        mesh.materials.append(material)
    add_armature_modifier(obj, armature)
    add_cloth_modifiers(obj)
    obj['equipment_group'] = 'jersey'
    obj['uniform_refinement'] = 'tailored-raglan-garment-v2'
    return obj


def apply_weights(obj, weights_by_vertex):
    groups = {}
    for weights in weights_by_vertex:
        for name in weights:
            if name not in groups:
                groups[name] = obj.vertex_groups.new(name=name)
    for vertex_index, weights in enumerate(weights_by_vertex):
        total = sum(max(0.0, weight) for weight in weights.values())
        if total <= 0.0:
            raise RuntimeError(f'Unweighted garment vertex {vertex_index} on {obj.name}.')
        for name, weight in weights.items():
            if weight > 0.0:
                groups[name].add([vertex_index], weight / total, 'REPLACE')


def add_uvs(obj, ring_count, segments):
    uv_layer = obj.data.uv_layers.new(name='UVMap')
    denominator = max(1, ring_count - 1)
    for polygon in obj.data.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = obj.data.loops[loop_index].vertex_index
            ring = vertex_index // segments
            segment = vertex_index % segments
            uv_layer.data[loop_index].uv = (segment / segments, ring / denominator)


def torso_weights(z, x):
    absolute_x = abs(x)
    if z <= 108.0:
        return {'CC_Base_Waist': 0.38, 'CC_Base_Spine01': 0.62}
    if z <= 132.0:
        blend = smoothstep(108.0, 132.0, z)
        return {'CC_Base_Spine01': 1.0 - blend * 0.72, 'CC_Base_Spine02': blend * 0.72}
    if z <= 148.0:
        shoulder = smoothstep(12.0, 26.0, absolute_x) * smoothstep(136.0, 148.0, z)
        weights = {'CC_Base_Spine02': 1.0 - shoulder * 0.32}
        if x >= 0.0:
            weights['CC_Base_L_Clavicle'] = shoulder * 0.32
        else:
            weights['CC_Base_R_Clavicle'] = shoulder * 0.32
        return weights
    neck = smoothstep(148.0, 157.0, z)
    shoulder = smoothstep(7.0, 21.0, absolute_x)
    weights = {
        'CC_Base_Spine02': 0.78 - neck * 0.22 - shoulder * 0.18,
        'CC_Base_NeckTwist01': 0.04 + neck * 0.22,
    }
    if x >= 0.0:
        weights['CC_Base_L_Clavicle'] = 0.18 + shoulder * 0.18
    else:
        weights['CC_Base_R_Clavicle'] = 0.18 + shoulder * 0.18
    return weights


def superellipse_component(value, exponent):
    if abs(value) < 1e-9:
        return 0.0
    return math.copysign(abs(value) ** (2.0 / exponent), value)


def build_torso(side, collection, armature, torso_material, accent_material, segments=48):
    vertices = []
    weights = []
    for ring_index, ring in enumerate(TORSO_RINGS):
        for segment in range(segments):
            angle = math.tau * segment / segments
            cosine = math.cos(angle)
            sine = math.sin(angle)
            cloth_wave = 1.0 + 0.010 * math.sin(angle * 4.0 + ring_index * 0.85)
            x = ring['x'] * superellipse_component(cosine, 3.15) * cloth_wave
            y = ring['center_y'] + ring['y'] * superellipse_component(sine, 3.15) * cloth_wave
            z = ring['z']
            if ring_index == 0:
                front = smoothstep(-0.25, -0.95, sine)
                z -= front * 1.1
            vertices.append((x, y, z))
            weights.append(torso_weights(z, x))

    faces = []
    material_indices = []
    for ring_index in range(len(TORSO_RINGS) - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            face = (
                ring_index * segments + segment,
                ring_index * segments + next_segment,
                (ring_index + 1) * segments + next_segment,
                (ring_index + 1) * segments + segment,
            )
            faces.append(face)
            center = sum((Vector(vertices[index]) for index in face), Vector()) / 4.0
            raglan_threshold = 7.0 + max(0.0, 155.0 - center.z) * 0.78
            is_raglan = center.z >= 138.0 and abs(center.x) >= raglan_threshold
            is_hem = center.z <= 101.0
            material_indices.append(1 if is_raglan or is_hem else 0)

    obj = create_object(
        f'GS_{side}_Jersey',
        collection,
        armature,
        vertices,
        faces,
        (torso_material, accent_material),
    )
    apply_weights(obj, weights)
    add_uvs(obj, len(TORSO_RINGS), segments)
    for polygon, material_index in zip(obj.data.polygons, material_indices):
        polygon.material_index = material_index
    obj['garment_component'] = 'draped-torso-and-raglan-yoke'
    return obj


def sleeve_ring_basis(centers, index):
    if index == 0:
        tangent = (centers[1] - centers[0]).normalized()
    elif index == len(centers) - 1:
        tangent = (centers[-1] - centers[-2]).normalized()
    else:
        tangent = (centers[index + 1] - centers[index - 1]).normalized()
    depth = Vector((0.0, 1.0, 0.0))
    depth -= tangent * depth.dot(tangent)
    depth.normalize()
    vertical = tangent.cross(depth).normalized()
    if vertical.z < 0.0:
        vertical.negate()
    return depth, vertical


def sleeve_ring_weights(label, ring_index):
    prefix = 'L' if label == 'Left' else 'R'
    profiles = (
        {'CC_Base_Spine02': 0.45, f'CC_Base_{prefix}_Clavicle': 0.45, f'CC_Base_{prefix}_Upperarm': 0.10},
        {f'CC_Base_{prefix}_Clavicle': 0.55, f'CC_Base_{prefix}_Upperarm': 0.45},
        {f'CC_Base_{prefix}_UpperarmTwist01': 0.62, f'CC_Base_{prefix}_UpperarmTwist02': 0.38},
        {f'CC_Base_{prefix}_UpperarmTwist02': 0.42, f'CC_Base_{prefix}_ElbowShareBone': 0.18, f'CC_Base_{prefix}_ForearmTwist01': 0.40},
        {f'CC_Base_{prefix}_ForearmTwist01': 0.42, f'CC_Base_{prefix}_ForearmTwist02': 0.58},
        {f'CC_Base_{prefix}_ForearmTwist02': 0.82, f'CC_Base_{prefix}_Hand': 0.18},
    )
    return profiles[ring_index]


def build_sleeve(side, label, collection, armature, material, segments=32):
    sign = 1.0 if label == 'Left' else -1.0
    centers = [Vector((sign * ring['x'], ring['y'], ring['z'])) for ring in SLEEVE_PROFILE]
    vertices = []
    weights = []
    for ring_index, (profile, center) in enumerate(zip(SLEEVE_PROFILE, centers)):
        depth, vertical = sleeve_ring_basis(centers, ring_index)
        for segment in range(segments):
            angle = math.tau * segment / segments
            fold = 1.0 + 0.020 * math.sin(angle * 3.0 + ring_index * 1.15)
            point = (
                center
                + depth * math.cos(angle) * profile['depth'] * fold
                + vertical * math.sin(angle) * profile['vertical'] * fold
            )
            vertices.append(tuple(point))
            weights.append(sleeve_ring_weights(label, ring_index))

    faces = []
    for ring_index in range(len(SLEEVE_PROFILE) - 1):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            faces.append((
                ring_index * segments + segment,
                ring_index * segments + next_segment,
                (ring_index + 1) * segments + next_segment,
                (ring_index + 1) * segments + segment,
            ))

    obj = create_object(
        f'GS_{side}_Jersey_Sleeve_{label}',
        collection,
        armature,
        vertices,
        faces,
        (material,),
    )
    apply_weights(obj, weights)
    add_uvs(obj, len(SLEEVE_PROFILE), segments)
    obj['garment_component'] = f'tapered-{label.lower()}-sleeve'
    return obj


def local_bounds(obj):
    minimum = [min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    maximum = [max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)]
    return {
        'minimumCm': [round(value, 4) for value in minimum],
        'maximumCm': [round(value, 4) for value in maximum],
        'dimensionsCm': [round(maximum[index] - minimum[index], 4) for index in range(3)],
    }


def topology_summary(obj):
    adjacency = [[] for _ in obj.data.vertices]
    edge_faces = Counter()
    for edge in obj.data.edges:
        left, right = edge.vertices
        adjacency[left].append(right)
        adjacency[right].append(left)
    for polygon in obj.data.polygons:
        indices = list(polygon.vertices)
        for index, start in enumerate(indices):
            edge_faces[tuple(sorted((start, indices[(index + 1) % len(indices)])))] += 1
    remaining = set(range(len(obj.data.vertices)))
    components = 0
    while remaining:
        components += 1
        seed = remaining.pop()
        queue = deque([seed])
        while queue:
            current = queue.popleft()
            for neighbour in adjacency[current]:
                if neighbour in remaining:
                    remaining.remove(neighbour)
                    queue.append(neighbour)
    return {
        'vertices': len(obj.data.vertices),
        'faces': len(obj.data.polygons),
        'connectedComponents': components,
        'boundaryEdges': sum(count == 1 for count in edge_faces.values()),
        'unweightedVertices': sum(not vertex.groups for vertex in obj.data.vertices),
        'materials': [material.name if material else None for material in obj.data.materials],
        'modifiers': [modifier.type for modifier in obj.modifiers],
        'bounds': local_bounds(obj),
    }


def remove_previous_garment(side):
    exact_names = {
        f'GS_{side}_Jersey',
        f'GS_{side}_Jersey_Sleeve_Left',
        f'GS_{side}_Jersey_Sleeve_Right',
    }
    removed = []
    for name in exact_names:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            removed.append(name)
            bpy.data.objects.remove(obj, do_unlink=True)
    return sorted(removed)


def reposition_uniform_marks(side, torso):
    front = bpy.data.objects.get(f'GS_{side}_Jersey_Front_Mark')
    backs = [
        obj for obj in bpy.data.objects
        if obj.name.startswith(f'GS_{side}_Jersey_Back_Number')
    ]
    if front is None or not backs:
        raise RuntimeError(f'Missing {side} uniform marks.')
    front_y = min(vertex.co.y for vertex in torso.data.vertices) - 0.35
    back_y = max(vertex.co.y for vertex in torso.data.vertices) + 0.35
    front_delta = front_y - sum(vertex.co.y for vertex in front.data.vertices) / len(front.data.vertices)
    for vertex in front.data.vertices:
        vertex.co.y += front_delta
    front.data.update()
    for back in backs:
        back_delta = back_y - sum(vertex.co.y for vertex in back.data.vertices) / len(back.data.vertices)
        for vertex in back.data.vertices:
            vertex.co.y += back_delta
        back.data.update()
    return {
        'front': front.name,
        'frontSurfaceY': round(front_y, 4),
        'backs': [back.name for back in backs],
        'backSurfaceY': round(back_y, 4),
    }


def action_key_counts():
    def fcurves(action):
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

    return {
        name: sum(len(curve.keyframe_points) for curve in fcurves(bpy.data.actions[name]))
        for name in REQUIRED_ACTIONS
    }


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing {ARMATURE_NAME}.')
    missing_actions = [name for name in REQUIRED_ACTIONS if bpy.data.actions.get(name) is None]
    if missing_actions:
        raise RuntimeError('Missing actions: ' + ', '.join(missing_actions))

    armature.data.pose_position = 'REST'
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    counts_before = action_key_counts()
    variants = {}
    for side in SIDES:
        collection = bpy.data.collections.get(f'GS_Equipment_{side}')
        source_jersey = bpy.data.objects.get(f'GS_{side}_Jersey')
        if collection is None or source_jersey is None or len(source_jersey.data.materials) < 2:
            raise RuntimeError(f'Missing {side} source garment or materials.')
        torso_material = source_jersey.data.materials[0]
        accent_material = source_jersey.data.materials[1]
        before = topology_summary(source_jersey)
        removed = remove_previous_garment(side)
        torso = build_torso(side, collection, armature, torso_material, accent_material)
        left = build_sleeve(side, 'Left', collection, armature, accent_material)
        right = build_sleeve(side, 'Right', collection, armature, accent_material)
        marks = reposition_uniform_marks(side, torso)
        variants[side.lower()] = {
            'removedObjects': removed,
            'before': before,
            'torso': topology_summary(torso),
            'leftSleeve': topology_summary(left),
            'rightSleeve': topology_summary(right),
            'marks': marks,
        }

    counts_after = action_key_counts()
    if counts_after != counts_before:
        raise RuntimeError('Tailored uniform authoring changed animation key counts.')

    armature.data.pose_position = 'POSE'
    armature.animation_data_create()
    armature.animation_data.action = bpy.data.actions['ready']
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    bpy.context.scene['vnext_uniform_status'] = 'tailored-raglan-private-review'
    bpy.context.scene['vnext_uniform_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'tailored-raglan-uniform-authored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'construction': {
            'torsoRings': len(TORSO_RINGS),
            'torsoSegments': 48,
            'sleeveRings': len(SLEEVE_PROFILE),
            'sleeveSegments': 32,
            'method': 'structured-draped-torso-with-overlapped-weighted-raglan-sleeves',
        },
        'variants': variants,
        'actionKeyCounts': {
            name: {'before': counts_before[name], 'after': counts_after[name]}
            for name in sorted(counts_before)
        },
        'reviewBoundary': (
            'The new garment remains private until every action passes close front, rear, side, '
            'three-quarter, overlap, deformation, runtime, and explicit human visual review.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_TAILORED_UNIFORM_REFINED ' + str(output_report))


if __name__ == '__main__':
    main()
