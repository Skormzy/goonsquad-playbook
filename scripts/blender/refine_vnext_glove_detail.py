import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector


ARMATURE_NAME = 'GS_FieldPlayer_Rig'
REQUIRED_ACTIONS = (
    'ready',
    'jog',
    'jog-to-sprint-ik',
    'sprint',
    'turn',
    'stop',
    'receive',
    'pass',
    'shot',
)
FINGERS = ('Index', 'Mid', 'Ring', 'Pinky')
FINGER_CURL_DEGREES = {
    'Index': (62.0, 88.0, 58.0),
    'Mid': (66.0, 92.0, 62.0),
    'Ring': (70.0, 96.0, 66.0),
    'Pinky': (74.0, 100.0, 70.0),
    'Thumb': (34.0, 52.0, 32.0),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def rounded(vector, digits=4):
    return [round(float(value), digits) for value in vector]


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


def action_key_count(action):
    return sum(len(fcurve.keyframe_points) for fcurve in action_fcurves(action))


def finger_fcurve_count(action):
    return sum(
        any(token in fcurve.data_path for token in (*FINGERS, 'Thumb'))
        for fcurve in action_fcurves(action)
    )


def set_smooth(mesh):
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def ensure_uv(mesh):
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    layer = mesh.uv_layers.new(name='UVMap')
    minimum = Vector((min(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in mesh.vertices) for axis in range(3)))
    extent = maximum - minimum
    for polygon in mesh.polygons:
        normal = polygon.normal
        for loop_index in polygon.loop_indices:
            coordinate = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if abs(normal.z) >= max(abs(normal.x), abs(normal.y)):
                u = (coordinate.x - minimum.x) / max(extent.x, 1e-6)
                v = (coordinate.y - minimum.y) / max(extent.y, 1e-6)
            elif abs(normal.y) >= abs(normal.x):
                u = (coordinate.x - minimum.x) / max(extent.x, 1e-6)
                v = (coordinate.z - minimum.z) / max(extent.z, 1e-6)
            else:
                u = (coordinate.y - minimum.y) / max(extent.y, 1e-6)
                v = (coordinate.z - minimum.z) / max(extent.z, 1e-6)
            layer.data[loop_index].uv = (u, v)


def local_bounds(obj):
    minimum = Vector((min(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    maximum = Vector((max(vertex.co[axis] for vertex in obj.data.vertices) for axis in range(3)))
    return {
        'minimumCm': rounded(minimum),
        'maximumCm': rounded(maximum),
        'dimensionsCm': rounded(maximum - minimum),
    }


def hand_basis(bone):
    longitudinal = (bone.tail_local - bone.head_local).normalized()
    depth = Vector((0.0, 1.0, 0.0))
    depth -= longitudinal * depth.dot(longitudinal)
    depth.normalize()
    vertical = longitudinal.cross(depth).normalized()
    if vertical.z < 0.0:
        vertical.negate()
    return longitudinal, depth, vertical


def segment_basis(bone):
    longitudinal = (bone.tail_local - bone.head_local).normalized()
    depth = Vector((0.0, 1.0, 0.0))
    depth -= longitudinal * depth.dot(longitudinal)
    depth.normalize()
    cross = longitudinal.cross(depth).normalized()
    return longitudinal, depth, cross


def append_loft(vertices, faces, anchor, axes, stations, segments=20):
    start = len(vertices)
    for longitudinal, depth_offset, depth_radius, vertical_radius in stations:
        center = anchor + axes[0] * longitudinal + axes[1] * depth_offset
        for index in range(segments):
            angle = math.tau * index / segments
            point = (
                center
                + axes[1] * math.cos(angle) * depth_radius
                + axes[2] * math.sin(angle) * vertical_radius
            )
            vertices.append(tuple(point))
    for station in range(len(stations) - 1):
        first = start + station * segments
        second = first + segments
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append((
                first + index,
                first + next_index,
                second + next_index,
                second + index,
            ))
    faces.append(tuple(start + index for index in range(segments))[::-1])
    last = start + (len(stations) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    return list(range(start, len(vertices)))


def append_cuff_ring(vertices, faces, anchor, axes, segments=20):
    start = len(vertices)
    stations = (
        (-5.2, 5.7, 6.6, 3.9, 4.8),
        (-0.8, 4.5, 5.5, 3.2, 4.1),
    )
    for longitudinal, outer_depth, outer_vertical, inner_depth, inner_vertical in stations:
        center = anchor + axes[0] * longitudinal
        for depth_radius, vertical_radius in (
            (outer_depth, outer_vertical),
            (inner_depth, inner_vertical),
        ):
            for index in range(segments):
                angle = math.tau * index / segments
                point = (
                    center
                    + axes[1] * math.cos(angle) * depth_radius
                    + axes[2] * math.sin(angle) * vertical_radius
                )
                vertices.append(tuple(point))
    outer_first = start
    inner_first = start + segments
    outer_second = start + segments * 2
    inner_second = start + segments * 3
    for index in range(segments):
        next_index = (index + 1) % segments
        faces.extend((
            (outer_first + index, outer_first + next_index, outer_second + next_index, outer_second + index),
            (inner_second + index, inner_second + next_index, inner_first + next_index, inner_first + index),
            (outer_first + next_index, outer_first + index, inner_first + index, inner_first + next_index),
            (outer_second + index, outer_second + next_index, inner_second + next_index, inner_second + index),
        ))
    return list(range(start, len(vertices)))


def append_ellipsoid(vertices, faces, center, axes, radii, longitude_segments=14, latitude_segments=8):
    start = len(vertices)
    vertices.append(tuple(center + axes[2] * radii[2]))
    for latitude in range(1, latitude_segments):
        phi = math.pi * latitude / latitude_segments
        for longitude in range(longitude_segments):
            theta = math.tau * longitude / longitude_segments
            point = (
                center
                + axes[0] * math.sin(phi) * math.cos(theta) * radii[0]
                + axes[1] * math.sin(phi) * math.sin(theta) * radii[1]
                + axes[2] * math.cos(phi) * radii[2]
            )
            vertices.append(tuple(point))
    bottom = len(vertices)
    vertices.append(tuple(center - axes[2] * radii[2]))
    first_ring = start + 1
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((start, first_ring + longitude, first_ring + next_longitude))
    for latitude in range(latitude_segments - 2):
        first = first_ring + latitude * longitude_segments
        second = first + longitude_segments
        for longitude in range(longitude_segments):
            next_longitude = (longitude + 1) % longitude_segments
            faces.append((
                first + longitude,
                second + longitude,
                second + next_longitude,
                first + next_longitude,
            ))
    last_ring = first_ring + (latitude_segments - 2) * longitude_segments
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((bottom, last_ring + next_longitude, last_ring + longitude))
    return list(range(start, len(vertices)))


def signed_power(value, exponent):
    if abs(value) <= 1e-8:
        return 0.0
    return math.copysign(abs(value) ** exponent, value)


def append_rounded_box(
    vertices,
    faces,
    center,
    axes,
    radii,
    longitude_segments=16,
    latitude_segments=8,
    roundness=0.42,
):
    start = len(vertices)
    vertices.append(tuple(center + axes[2] * radii[2]))
    for latitude in range(1, latitude_segments):
        phi = math.pi * 0.5 - math.pi * latitude / latitude_segments
        cosine_phi = signed_power(math.cos(phi), roundness)
        sine_phi = signed_power(math.sin(phi), roundness)
        for longitude in range(longitude_segments):
            theta = math.tau * longitude / longitude_segments
            point = (
                center
                + axes[0] * cosine_phi * signed_power(math.cos(theta), roundness) * radii[0]
                + axes[1] * cosine_phi * signed_power(math.sin(theta), roundness) * radii[1]
                + axes[2] * sine_phi * radii[2]
            )
            vertices.append(tuple(point))
    bottom = len(vertices)
    vertices.append(tuple(center - axes[2] * radii[2]))
    first_ring = start + 1
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((start, first_ring + longitude, first_ring + next_longitude))
    for latitude in range(latitude_segments - 2):
        first = first_ring + latitude * longitude_segments
        second = first + longitude_segments
        for longitude in range(longitude_segments):
            next_longitude = (longitude + 1) % longitude_segments
            faces.append((
                first + longitude,
                second + longitude,
                second + next_longitude,
                first + next_longitude,
            ))
    last_ring = first_ring + (latitude_segments - 2) * longitude_segments
    for longitude in range(longitude_segments):
        next_longitude = (longitude + 1) % longitude_segments
        faces.append((bottom, last_ring + next_longitude, last_ring + longitude))
    return list(range(start, len(vertices)))


def create_skinned_object(name, collection, armature, vertices, faces, material, groups):
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    mesh.materials.append(material)
    ensure_uv(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    for bone_name, indices in groups.items():
        group = obj.vertex_groups.new(name=bone_name)
        group.add(indices, 1.0, 'REPLACE')
    modifier = obj.modifiers.new('GS_Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = True
    obj['equipment_group'] = 'glove'
    obj['glove_detail_revision'] = 'segmented-closed-grip-v2'
    obj['silhouette_revision'] = 'production-form-v2'
    return obj


def remove_existing_parts(prefix):
    removed = []
    for obj in list(bpy.data.objects):
        if not obj.name.startswith(prefix):
            continue
        removed.append(obj.name)
        mesh = obj.data if obj.type == 'MESH' else None
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    return removed


def rigid_component(name, collection, armature, material, bone_name, builder):
    vertices = []
    faces = []
    indices = builder(vertices, faces)
    return create_skinned_object(
        name,
        collection,
        armature,
        vertices,
        faces,
        material,
        {bone_name: indices},
    )


def build_glove(variant, label, armature, collection, materials):
    side_token = 'L' if label == 'Left' else 'R'
    hand_name = f'CC_Base_{side_token}_Hand'
    hand_bone = armature.data.bones.get(hand_name)
    if hand_bone is None:
        raise RuntimeError(f'Missing hand bone: {hand_name}')
    axes = hand_basis(hand_bone)
    prefix = f'GS_{variant}_Glove_{label}'
    removed = remove_existing_parts(prefix)

    core = rigid_component(
        prefix,
        collection,
        armature,
        materials['base'],
        hand_name,
        lambda vertices, faces: append_loft(
            vertices,
            faces,
            hand_bone.head_local,
            axes,
            (
                (-0.4, -0.2, 3.25, 4.2),
                (2.8, -0.55, 3.45, 4.45),
                (6.0, -0.7, 3.55, 4.55),
                (8.6, -0.65, 3.05, 4.0),
            ),
        ),
    )

    cuff = rigid_component(
        f'{prefix}_Cuff',
        collection,
        armature,
        materials['base'],
        hand_name,
        lambda vertices, faces: append_cuff_ring(vertices, faces, hand_bone.head_local, axes),
    )

    cuff_roll = rigid_component(
        f'{prefix}_Cuff_Roll',
        collection,
        armature,
        materials['accent'],
        hand_name,
        lambda vertices, faces: append_rounded_box(
            vertices,
            faces,
            hand_bone.head_local + axes[0] * -3.0 + axes[1] * -4.1,
            axes,
            (1.15, 0.5, 4.45),
            roundness=0.36,
        ),
    )

    def backhand_builder(vertices, faces):
        indices = []
        for longitudinal, length, width in ((1.1, 1.25, 3.85), (3.8, 1.35, 4.0), (6.6, 1.25, 3.7)):
            indices.extend(append_rounded_box(
                vertices,
                faces,
                hand_bone.head_local + axes[0] * longitudinal + axes[1] * -3.55,
                axes,
                (length, 0.42, width),
                longitude_segments=16,
                latitude_segments=8,
                roundness=0.38,
            ))
        return indices

    backhand = rigid_component(
        f'{prefix}_Backhand_Pads',
        collection,
        armature,
        materials['base'],
        hand_name,
        backhand_builder,
    )

    def palm_builder(vertices, faces):
        return append_rounded_box(
            vertices,
            faces,
            hand_bone.head_local + axes[0] * 4.5 + axes[1] * 3.2,
            axes,
            (4.7, 0.55, 3.9),
            longitude_segments=16,
            latitude_segments=8,
            roundness=0.5,
        )

    palm = rigid_component(
        f'{prefix}_Palm_Overlay',
        collection,
        armature,
        materials['palm'],
        hand_name,
        palm_builder,
    )

    finger_vertices = []
    finger_faces = []
    finger_groups = {}
    finger_segment_count = 0
    for finger in FINGERS:
        for segment in range(1, 4):
            bone_name = f'CC_Base_{side_token}_{finger}{segment}'
            bone = armature.data.bones.get(bone_name)
            if bone is None:
                raise RuntimeError(f'Missing finger bone: {bone_name}')
            segment_axes = segment_basis(bone)
            center = (bone.head_local + bone.tail_local) * 0.5
            width = {
                'Index': 0.98,
                'Mid': 1.04,
                'Ring': 0.98,
                'Pinky': 0.84,
            }[finger] * (1.0 - (segment - 1) * 0.12)
            indices = append_rounded_box(
                finger_vertices,
                finger_faces,
                center,
                segment_axes,
                (bone.length * 0.49, 1.05 - segment * 0.08, width),
                longitude_segments=14,
                latitude_segments=8,
                roundness=0.38,
            )
            finger_groups.setdefault(bone_name, []).extend(indices)
            finger_segment_count += 1
    fingers = create_skinned_object(
        f'{prefix}_Finger_Rolls',
        collection,
        armature,
        finger_vertices,
        finger_faces,
        materials['base'],
        finger_groups,
    )

    finger_pad_vertices = []
    finger_pad_faces = []
    finger_pad_groups = {}
    for finger in FINGERS:
        for segment in range(1, 4):
            bone_name = f'CC_Base_{side_token}_{finger}{segment}'
            bone = armature.data.bones[bone_name]
            segment_axes = segment_basis(bone)
            center = (bone.head_local + bone.tail_local) * 0.5 + segment_axes[1] * -0.86
            width = {
                'Index': 0.8,
                'Mid': 0.86,
                'Ring': 0.8,
                'Pinky': 0.7,
            }[finger] * (1.0 - (segment - 1) * 0.12)
            indices = append_rounded_box(
                finger_pad_vertices,
                finger_pad_faces,
                center,
                segment_axes,
                (bone.length * 0.43, 0.2, width),
                longitude_segments=12,
                latitude_segments=8,
                roundness=0.34,
            )
            finger_pad_groups.setdefault(bone_name, []).extend(indices)
    finger_pads = create_skinned_object(
        f'{prefix}_Finger_Pads',
        collection,
        armature,
        finger_pad_vertices,
        finger_pad_faces,
        materials['base'],
        finger_pad_groups,
    )

    thumb_vertices = []
    thumb_faces = []
    thumb_groups = {}
    for segment in range(1, 4):
        bone_name = f'CC_Base_{side_token}_Thumb{segment}'
        bone = armature.data.bones.get(bone_name)
        if bone is None:
            raise RuntimeError(f'Missing thumb bone: {bone_name}')
        segment_axes = segment_basis(bone)
        center = (bone.head_local + bone.tail_local) * 0.5
        indices = append_rounded_box(
            thumb_vertices,
            thumb_faces,
            center,
            segment_axes,
            (bone.length * 0.5, 1.2 - segment * 0.08, 1.15 - segment * 0.1),
            longitude_segments=14,
            latitude_segments=8,
            roundness=0.42,
        )
        thumb_groups.setdefault(bone_name, []).extend(indices)
    thumb = create_skinned_object(
        f'{prefix}_Flex_Thumb',
        collection,
        armature,
        thumb_vertices,
        thumb_faces,
        materials['base'],
        thumb_groups,
    )

    thumb_pad_vertices = []
    thumb_pad_faces = []
    thumb_pad_groups = {}
    for segment in (1, 2):
        bone_name = f'CC_Base_{side_token}_Thumb{segment}'
        bone = armature.data.bones[bone_name]
        segment_axes = segment_basis(bone)
        center = (bone.head_local + bone.tail_local) * 0.5 + segment_axes[1] * -0.92
        indices = append_rounded_box(
            thumb_pad_vertices,
            thumb_pad_faces,
            center,
            segment_axes,
            (bone.length * 0.42, 0.22, 0.94 - segment * 0.06),
            longitude_segments=12,
            latitude_segments=8,
            roundness=0.36,
        )
        thumb_pad_groups.setdefault(bone_name, []).extend(indices)
    thumb_pad = create_skinned_object(
        f'{prefix}_Thumb_Pads',
        collection,
        armature,
        thumb_pad_vertices,
        thumb_pad_faces,
        materials['base'],
        thumb_pad_groups,
    )

    objects = (core, cuff, cuff_roll, backhand, palm, fingers, finger_pads, thumb, thumb_pad)
    return {
        'removedObjects': removed,
        'handBone': hand_name,
        'fingerSegments': finger_segment_count,
        'thumbSegments': 3,
        'objects': {
            obj.name: {
                'vertices': len(obj.data.vertices),
                'polygons': len(obj.data.polygons),
                'bounds': local_bounds(obj),
                'materials': [material.name for material in obj.data.materials if material],
                'vertexGroups': sorted(group.name for group in obj.vertex_groups),
            }
            for obj in objects
        },
    }


def author_finger_curl(armature):
    armature.animation_data_create()
    actions = {}
    finger_bones = []
    for side in ('L', 'R'):
        for finger in (*FINGERS, 'Thumb'):
            for segment, degrees in enumerate(FINGER_CURL_DEGREES[finger], start=1):
                bone_name = f'CC_Base_{side}_{finger}{segment}'
                pose_bone = armature.pose.bones.get(bone_name)
                if pose_bone is None:
                    raise RuntimeError(f'Missing pose finger bone: {bone_name}')
                finger_bones.append((pose_bone, degrees))

    for action_name in REQUIRED_ACTIONS:
        action = bpy.data.actions.get(action_name)
        if action is None:
            raise RuntimeError(f'Missing required action: {action_name}')
        removed_finger_curves = 0
        legacy = getattr(action, 'fcurves', None)
        if legacy is not None:
            for fcurve in list(legacy):
                if any(token in fcurve.data_path for token in (*FINGERS, 'Thumb')):
                    legacy.remove(fcurve)
                    removed_finger_curves += 1
        else:
            for layer in getattr(action, 'layers', []):
                for strip in getattr(layer, 'strips', []):
                    for channelbag in getattr(strip, 'channelbags', []):
                        for fcurve in list(channelbag.fcurves):
                            if any(token in fcurve.data_path for token in (*FINGERS, 'Thumb')):
                                channelbag.fcurves.remove(fcurve)
                                removed_finger_curves += 1
        before = action_key_count(action)
        armature.animation_data.action = action
        start = int(math.floor(action.frame_range[0]))
        end = int(math.ceil(action.frame_range[1]))
        for frame in (start, end):
            bpy.context.scene.frame_set(frame)
            for pose_bone, degrees in finger_bones:
                pose_bone.rotation_mode = 'QUATERNION'
                pose_bone.rotation_quaternion = Quaternion((1.0, 0.0, 0.0), math.radians(degrees))
                pose_bone.keyframe_insert('rotation_quaternion', frame=frame, group=pose_bone.name)
        for fcurve in action_fcurves(action):
            if not any(token in fcurve.data_path for token in (*FINGERS, 'Thumb')):
                continue
            for keyframe in fcurve.keyframe_points:
                keyframe.interpolation = 'LINEAR'
        action['glove_grip_revision'] = 'segmented-closed-flex-v2'
        actions[action_name] = {
            'frameRange': [start, end],
            'keysBefore': before,
            'keysAfter': action_key_count(action),
            'fingerFcurves': finger_fcurve_count(action),
            'removedFingerFcurves': removed_finger_curves,
        }
    return actions


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    armature = bpy.data.objects.get(ARMATURE_NAME)
    if armature is None:
        raise RuntimeError(f'Missing armature: {ARMATURE_NAME}')
    material_names = {
        'base': 'GS_PBR_Leather_Black',
        'accent': 'GS_PBR_Leather_Red',
        'palm': 'GS_PBR_Fabric_Black',
        'awayBinding': 'GS_PBR_Rubber_White',
    }
    missing_materials = [name for name in material_names.values() if bpy.data.materials.get(name) is None]
    if missing_materials:
        raise RuntimeError(f'Missing glove materials: {missing_materials}')

    variants = {}
    for variant in ('Home', 'Away'):
        collection = bpy.data.collections.get(f'GS_Equipment_{variant}')
        if collection is None:
            raise RuntimeError(f'Missing equipment collection: {variant}')
        materials = {
            'base': bpy.data.materials[material_names['base']],
            'accent': bpy.data.materials[material_names['accent']],
            'palm': bpy.data.materials[material_names['palm']],
        }
        variants[variant.lower()] = {
            label.lower(): build_glove(variant, label, armature, collection, materials)
            for label in ('Left', 'Right')
        }

    actions = author_finger_curl(armature)
    bpy.context.scene['vnext_glove_detail_status'] = 'private-segmented-flex-review'
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'private-segmented-glove-authored',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': bpy.data.filepath,
        'outputWorkfile': str(output_workfile),
        'referenceFeatures': {
            'backhandPads': 3,
            'fingerSegmentsPerHand': 12,
            'thumbSegmentsPerHand': 3,
            'flexThumbPadsPerHand': 2,
            'cuffRoll': True,
            'palmOverlay': True,
        },
        'gripCurlDegrees': FINGER_CURL_DEGREES,
        'actions': actions,
        'variants': variants,
        'reviewRule': (
            'The segmented glove remains private until close renders and the complete 12-player '
            'runtime prove believable finger volume, shaft contact, cuff articulation, motion, and budget.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_GLOVE_DETAIL_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
