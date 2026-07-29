import argparse
import json
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
ACTION_NAME = 'ready'
FRAME = 1
TOKENS = ('Glove', 'Sleeve', 'Jersey', 'Uniform', 'Cuff', 'Arm', 'Hand')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(vector, digits=5):
    return [round(float(value), digits) for value in vector]


def evaluated_geometry_armature_space(obj, armature, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    transform = armature.matrix_world.inverted() @ evaluated.matrix_world
    coordinates = [transform @ vertex.co for vertex in mesh.vertices]
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    boundary_adjacency = {}
    for edge in bm.edges:
        if not edge.is_boundary:
            continue
        first = edge.verts[0].index
        second = edge.verts[1].index
        boundary_adjacency.setdefault(first, set()).add(second)
        boundary_adjacency.setdefault(second, set()).add(first)
    components = []
    remaining = set(boundary_adjacency)
    while remaining:
        seed = remaining.pop()
        component = {seed}
        stack = [seed]
        while stack:
            current = stack.pop()
            for neighbor in boundary_adjacency.get(current, ()):
                if neighbor in component:
                    continue
                component.add(neighbor)
                remaining.discard(neighbor)
                stack.append(neighbor)
        points = [coordinates[index] for index in component]
        center = sum(points, Vector()) / len(points)
        minimum = Vector((min(point[axis] for point in points) for axis in range(3)))
        maximum = Vector((max(point[axis] for point in points) for axis in range(3)))
        components.append({
            'vertices': len(points),
            'centerCm': rounded(center),
            'dimensionsCm': rounded(maximum - minimum),
        })
    components.sort(key=lambda component: component['vertices'], reverse=True)
    bm.free()
    evaluated.to_mesh_clear()
    return coordinates, components


def percentile(values, amount):
    ordered = sorted(values)
    if not ordered:
        return None
    index = min(len(ordered) - 1, round((len(ordered) - 1) * amount))
    return round(float(ordered[index]), 5)


def wrist_profile(coordinates, frame):
    samples = []
    for point in coordinates:
        relative = point - frame['origin']
        distance = relative.dot(frame['axis'])
        radial = (relative - frame['axis'] * distance).length
        samples.append((distance, radial))
    bins = []
    for start, end in ((-5, 0), (0, 3), (3, 6), (6, 10), (10, 15)):
        radii = [radial for distance, radial in samples if start <= distance < end]
        bins.append({
            'rangeCm': [start, end],
            'vertices': len(radii),
            'radialP50Cm': percentile(radii, 0.50),
            'radialP95Cm': percentile(radii, 0.95),
            'radialMaximumCm': round(max(radii), 5) if radii else None,
        })
    distances = [distance for distance, _ in samples]
    radii = [radial for _, radial in samples]
    return {
        'distanceMinimumCm': round(min(distances), 5),
        'distanceMaximumCm': round(max(distances), 5),
        'radialP95Cm': percentile(radii, 0.95),
        'radialMaximumCm': round(max(radii), 5),
        'bins': bins,
    }


def object_record(obj, armature, depsgraph, hand_centers, wrist_frames):
    coordinates, boundary_components = evaluated_geometry_armature_space(
        obj,
        armature,
        depsgraph,
    )
    minimum = Vector((min(point[axis] for point in coordinates) for axis in range(3)))
    maximum = Vector((max(point[axis] for point in coordinates) for axis in range(3)))
    nearest = {
        side: min((point - center).length for point in coordinates)
        for side, center in hand_centers.items()
    }
    side = 'L' if 'Left' in obj.name else 'R' if 'Right' in obj.name else None
    group_profiles = {}
    if side and 'ProductionShell' in obj.name:
        for group in obj.vertex_groups:
            if 'ForearmTwist02' not in group.name:
                continue
            indices = [
                vertex.index
                for vertex in obj.data.vertices
                if any(membership.group == group.index and membership.weight > 1e-5 for membership in vertex.groups)
            ]
            group_profiles[group.name] = {
                'vertices': len(indices),
                'wristProfile': wrist_profile(
                    [coordinates[index] for index in indices],
                    wrist_frames[side],
                ),
            }
    return {
        'name': obj.name,
        'vertices': len(coordinates),
        'boundsCm': {
            'minimum': rounded(minimum),
            'maximum': rounded(maximum),
            'dimensions': rounded(maximum - minimum),
        },
        'nearestHandDistanceCm': {
            side: round(distance, 5)
            for side, distance in nearest.items()
        },
        'materials': [material.name for material in obj.data.materials if material],
        'collections': sorted(collection.name for collection in obj.users_collection),
        'vertexGroups': sorted(group.name for group in obj.vertex_groups),
        'boundaryComponents': boundary_components,
        'wristProfile': wrist_profile(coordinates, wrist_frames[side]) if side else None,
        'groupProfiles': group_profiles,
    }


def main():
    args = parse_args()
    output_report = Path(args.output_report).resolve()
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

    bones = {}
    hand_centers = {}
    wrist_frames = {}
    for side in ('L', 'R'):
        names = (
            f'CC_Base_{side}_ForearmTwist02',
            f'CC_Base_{side}_Hand',
            f'CC_Base_{side}_Thumb1',
            f'CC_Base_{side}_Thumb2',
            f'CC_Base_{side}_Index1',
            f'CC_Base_{side}_Mid1',
            f'CC_Base_{side}_Ring1',
            f'CC_Base_{side}_Pinky1',
        )
        for name in names:
            bone = armature.pose.bones[name]
            bones[name] = {
                'headCm': rounded(bone.head),
                'tailCm': rounded(bone.tail),
                'centerCm': rounded((bone.head + bone.tail) * 0.5),
            }
        hand = armature.pose.bones[f'CC_Base_{side}_Hand']
        hand_centers[side] = (hand.head + hand.tail) * 0.5
        forearm = armature.pose.bones[f'CC_Base_{side}_ForearmTwist02']
        wrist_frames[side] = {
            'origin': hand.head.copy(),
            'axis': (forearm.head - hand.head).normalized(),
        }

    depsgraph = bpy.context.evaluated_depsgraph_get()
    records = []
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not any(token in obj.name for token in TOKENS):
            continue
        records.append(object_record(
            obj,
            armature,
            depsgraph,
            hand_centers,
            wrist_frames,
        ))
    records.sort(key=lambda record: min(record['nearestHandDistanceCm'].values()))

    report = {
        'status': 'private-glove-surface-probed',
        'sourceWorkfile': bpy.data.filepath,
        'action': ACTION_NAME,
        'frame': FRAME,
        'armature': {
            'location': rounded(armature.location),
            'rotationEuler': rounded(armature.rotation_euler),
            'scale': rounded(armature.scale),
        },
        'bones': bones,
        'objects': records,
        'publicRuntimeAllowed': False,
        'visibleBrowserWindowOpened': False,
        'visibleBlenderWindowOpened': False,
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_GLOVE_SURFACE_PROBED ' + str(output_report))


if __name__ == '__main__':
    main()
