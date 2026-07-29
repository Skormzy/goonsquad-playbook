import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


SHAFT_CENTER = Vector((0.035, 0.0, 0.0))
SHAFT_HALF_WIDTH = 0.012
SHAFT_HALF_DEPTH = 0.009
BASE_REVISION = 'integrated-palm-wrist-shell-v5'


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for data_collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(data_collection):
            if block.users == 0:
                data_collection.remove(block)


def signed_power(value, exponent):
    if abs(value) < 1e-9:
        return 0.0
    return math.copysign(abs(value) ** exponent, value)


def smooth_mesh(mesh):
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def create_mesh_object(name, vertices, faces, collection=None):
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    smooth_mesh(mesh)
    obj = bpy.data.objects.new(name, mesh)
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def loft_mesh(name, stations, segments=40, exponent=0.62):
    vertices = []
    faces = []
    for x, center_y, center_z, radius_y, radius_z in stations:
        for index in range(segments):
            angle = math.tau * index / segments
            y = center_y + signed_power(math.cos(angle), exponent) * radius_y
            z = center_z + signed_power(math.sin(angle), exponent) * radius_z
            vertices.append((x, y, z))
    for station in range(len(stations) - 1):
        first = station * segments
        second = first + segments
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append((
                first + index,
                first + next_index,
                second + next_index,
                second + index,
            ))
    faces.append(tuple(range(segments))[::-1])
    last = (len(stations) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    return create_mesh_object(name, vertices, faces)


def panel_volume_mesh(name, outline, center_y, thickness):
    vertices = []
    for y in (center_y - thickness / 2.0, center_y + thickness / 2.0):
        vertices.extend((x, y, z) for x, z in outline)
    count = len(outline)
    faces = [
        tuple(range(count))[::-1],
        tuple(count + index for index in range(count)),
    ]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    return create_mesh_object(name, vertices, faces)


def catmull_rom(points, samples_per_segment=5):
    controls = [Vector(point) for point in points]
    padded = [controls[0], *controls, controls[-1]]
    samples = []
    for segment in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[segment - 1:segment + 3]
        for sample in range(samples_per_segment):
            t = sample / samples_per_segment
            t2 = t * t
            t3 = t2 * t
            point = 0.5 * (
                (2.0 * p1)
                + (-p0 + p2) * t
                + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
            )
            samples.append(point)
    samples.append(controls[-1])
    return samples


def sweep_mesh(
    name,
    points,
    radius,
    height,
    segments=24,
    taper_amount=0.12,
    profile_exponent=1.0,
    joint_dips=(),
    tip_scale=0.88,
):
    points = [Vector(point) for point in points]
    vertices = []
    faces = []
    previous_normal = None
    for index, point in enumerate(points):
        if index == 0:
            tangent = (points[1] - point).normalized()
        elif index == len(points) - 1:
            tangent = (point - points[index - 1]).normalized()
        else:
            tangent = (points[index + 1] - points[index - 1]).normalized()
        reference = Vector((0.0, 0.0, 1.0))
        if abs(tangent.dot(reference)) > 0.92:
            reference = Vector((0.0, 1.0, 0.0))
        normal = tangent.cross(reference).normalized()
        if previous_normal is not None and normal.dot(previous_normal) < 0.0:
            normal.negate()
        binormal = tangent.cross(normal).normalized()
        previous_normal = normal
        progress = index / max(len(points) - 1, 1)
        taper = 1.0 - taper_amount * progress
        for center, width, depth in joint_dips:
            taper *= 1.0 - depth * math.exp(-((progress - center) / width) ** 2)
        if progress > 0.86:
            tip_progress = (progress - 0.86) / 0.14
            taper *= 1.0 - (1.0 - tip_scale) * tip_progress * tip_progress
        for ring_index in range(segments):
            angle = math.tau * ring_index / segments
            position = (
                point
                + normal * signed_power(math.cos(angle), profile_exponent) * radius * taper
                + binormal * signed_power(math.sin(angle), profile_exponent) * height * taper
            )
            vertices.append(tuple(position))
    for ring in range(len(points) - 1):
        first = ring * segments
        second = first + segments
        for index in range(segments):
            next_index = (index + 1) % segments
            faces.append((
                first + index,
                first + next_index,
                second + next_index,
                second + index,
            ))
    faces.append(tuple(range(segments))[::-1])
    last = (len(points) - 1) * segments
    faces.append(tuple(last + index for index in range(segments)))
    return create_mesh_object(name, vertices, faces)


def make_material(name, color, roughness, noise_scale=42.0, bump_strength=0.16):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    noise = nodes.new('ShaderNodeTexNoise')
    bump = nodes.new('ShaderNodeBump')
    noise.inputs['Scale'].default_value = noise_scale
    noise.inputs['Detail'].default_value = 4.0
    noise.inputs['Roughness'].default_value = 0.62
    bump.inputs['Strength'].default_value = bump_strength
    bump.inputs['Distance'].default_value = 0.0007
    shader.inputs['Base Color'].default_value = (*color, 1.0)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Specular IOR Level'].default_value = 0.25
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    links.new(shader.outputs['BSDF'], output.inputs['Surface'])
    return material


def assign_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


def assign_base_material_regions(obj, shell_material, palm_material):
    obj.data.materials.clear()
    obj.data.materials.append(shell_material)
    obj.data.materials.append(palm_material)
    vertices = obj.data.vertices
    for polygon in obj.data.polygons:
        center = sum((vertices[index].co for index in polygon.vertices), Vector()) / len(polygon.vertices)
        palm_side = center.y < -0.012 and center.x > -0.077
        polygon.material_index = 1 if palm_side else 0


def add_uv_sphere(name, location, scale, material, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth_mesh(obj.data)
    assign_material(obj, material)
    return obj


def add_beveled_box(name, location, dimensions, bevel, material, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new(f'{name}_Edge_Radius', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 6
    modifier.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    smooth_mesh(obj.data)
    assign_material(obj, material)
    return obj


def add_panel(name, outline, center_y, thickness, bevel, material):
    vertices = []
    for y in (center_y - thickness / 2.0, center_y + thickness / 2.0):
        vertices.extend((x, y, z) for x, z in outline)
    count = len(outline)
    faces = [
        tuple(range(count))[::-1],
        tuple(count + index for index in range(count)),
    ]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    obj = create_mesh_object(name, vertices, faces)
    modifier = obj.modifiers.new(f'{name}_Soft_Edge', 'BEVEL')
    modifier.width = bevel
    modifier.segments = 5
    modifier.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    smooth_mesh(obj.data)
    assign_material(obj, material)
    return obj


def add_curve(name, points, bevel_depth, material, cyclic=False):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 2
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 4
    spline = curve.splines.new('NURBS')
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points):
        point.co = (*coordinate, 1.0)
    spline.order_u = min(3, len(points))
    spline.use_endpoint_u = not cyclic
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    curve.materials.append(material)
    return obj


def finger_path(z, radius=0.0235, root_y=0.007, reach=0.0):
    controls = [
        (-0.012 + reach, root_y, z),
        (0.002 + reach, root_y + 0.005, z),
        (0.014 + reach, root_y + 0.010, z),
    ]
    for angle_degrees in (126, 100, 73, 46, 18, -10, -38, -65, -88, -101):
        angle = math.radians(angle_degrees)
        controls.append((
            SHAFT_CENTER.x + math.cos(angle) * radius,
            SHAFT_CENTER.y + math.sin(angle) * radius,
            z,
        ))
    return catmull_rom(controls, samples_per_segment=4)


def create_glove_forms():
    forms = []
    forms.append(loft_mesh(
        'GS_Glove_Form_Cuff',
        (
            (-0.114, -0.001, 0.0, 0.032, 0.041),
            (-0.103, -0.001, 0.0, 0.034, 0.042),
            (-0.090, 0.000, 0.0, 0.033, 0.041),
            (-0.078, 0.001, -0.001, 0.031, 0.039),
            (-0.068, 0.001, -0.001, 0.030, 0.038),
        ),
        exponent=0.68,
    ))
    forms.append(loft_mesh(
        'GS_Glove_Form_Hand',
        (
            (-0.074, 0.001, -0.001, 0.031, 0.039),
            (-0.057, 0.002, 0.000, 0.034, 0.041),
            (-0.036, 0.004, 0.001, 0.034, 0.041),
            (-0.015, 0.005, 0.001, 0.031, 0.038),
            (0.005, 0.007, 0.000, 0.027, 0.035),
        ),
        exponent=0.68,
    ))

    forms.append(panel_volume_mesh(
        'GS_Glove_Form_Integrated_Palm',
        (
            (-0.073, -0.029),
            (-0.069, 0.026),
            (-0.054, 0.035),
            (-0.028, 0.037),
            (-0.006, 0.028),
            (0.009, 0.013),
            (0.003, -0.010),
            (-0.011, -0.029),
            (-0.041, -0.036),
        ),
        center_y=-0.025,
        thickness=0.019,
    ))

    finger_specs = (
        ('Index', 0.0260, 0.0086, 0.0072, 0.0245, -0.0005),
        ('Middle', 0.0087, 0.0090, 0.0074, 0.0242, 0.0010),
        ('Ring', -0.0087, 0.0086, 0.0071, 0.0238, 0.0000),
        ('Pinky', -0.0255, 0.0076, 0.0065, 0.0232, -0.0025),
    )
    finger_paths = {}
    for label, z, radius, height, wrap_radius, reach in finger_specs:
        path = finger_path(z, wrap_radius, reach=reach)
        finger_paths[label] = path
        forms.append(sweep_mesh(
            f'GS_Glove_Form_{label}',
            path,
            radius,
            height,
            segments=32,
            taper_amount=0.19,
            profile_exponent=0.54,
            joint_dips=((0.31, 0.042, 0.18), (0.57, 0.040, 0.20), (0.79, 0.036, 0.14)),
            tip_scale=0.68,
        ))

    thumb_controls = (
        (-0.043, -0.018, -0.026),
        (-0.025, -0.029, -0.024),
        (-0.006, -0.034, -0.019),
        (0.013, -0.032, -0.012),
        (0.030, -0.026, -0.004),
        (0.045, -0.017, 0.003),
        (0.051, -0.006, 0.007),
    )
    thumb_path = catmull_rom(thumb_controls, samples_per_segment=6)
    forms.append(sweep_mesh(
        'GS_Glove_Form_Thumb',
        thumb_path,
        0.0105,
        0.0090,
        segments=30,
        taper_amount=0.22,
        profile_exponent=0.72,
        joint_dips=((0.48, 0.08, 0.08), (0.73, 0.06, 0.10)),
        tip_scale=0.72,
    ))
    forms.append(panel_volume_mesh(
        'GS_Glove_Form_Integrated_Thumb_Web',
        (
            (-0.052, -0.030),
            (-0.036, -0.033),
            (-0.013, -0.024),
            (0.015, -0.006),
            (0.012, 0.010),
            (-0.008, 0.002),
            (-0.036, -0.014),
        ),
        center_y=-0.023,
        thickness=0.020,
    ))
    return forms, finger_paths, thumb_path


def join_and_remesh(forms):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in forms:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = forms[0]
    bpy.ops.object.join()
    base = bpy.context.object
    base.name = 'GS_Production_Glove_Base'
    base.data.name = 'GS_Production_Glove_Base_Mesh'
    base.data.remesh_voxel_size = 0.00125
    base.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()

    smooth = base.modifiers.new('GS_Sculpt_Soften', 'SMOOTH')
    smooth.factor = 0.34
    smooth.iterations = 4
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.modifier_apply(modifier=smooth.name)

    cutter = loft_mesh(
        'GS_Cuff_Opening_Cutter',
        (
            (-0.142, -0.001, 0.0, 0.0235, 0.0305),
            (-0.114, -0.001, 0.0, 0.0245, 0.0315),
            (-0.102, 0.0, 0.0, 0.0220, 0.0285),
            (-0.092, 0.0, 0.0, 0.0150, 0.0205),
            (-0.086, 0.0, 0.0, 0.0065, 0.0095),
        ),
        segments=48,
        exponent=0.72,
    )
    boolean = base.modifiers.new('GS_Cuff_Opening', 'BOOLEAN')
    boolean.operation = 'DIFFERENCE'
    boolean.solver = 'EXACT'
    boolean.object = cutter
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.modifier_apply(modifier=boolean.name)
    bpy.data.objects.remove(cutter, do_unlink=True)

    bpy.ops.mesh.primitive_cube_add(location=(SHAFT_CENTER.x, SHAFT_CENTER.y, 0.0))
    shaft_cutter = bpy.context.object
    shaft_cutter.name = 'GS_Shaft_Clearance_Cutter'
    shaft_cutter.scale = (SHAFT_HALF_WIDTH + 0.0007, SHAFT_HALF_DEPTH + 0.0007, 0.125)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    cutter_bevel = shaft_cutter.modifiers.new('GS_Shaft_Clearance_Radius', 'BEVEL')
    cutter_bevel.width = 0.0026
    cutter_bevel.segments = 5
    bpy.context.view_layer.objects.active = shaft_cutter
    bpy.ops.object.modifier_apply(modifier=cutter_bevel.name)
    shaft_boolean = base.modifiers.new('GS_Authored_Shaft_Clearance', 'BOOLEAN')
    shaft_boolean.operation = 'DIFFERENCE'
    shaft_boolean.solver = 'EXACT'
    shaft_boolean.object = shaft_cutter
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.modifier_apply(modifier=shaft_boolean.name)
    bpy.data.objects.remove(shaft_cutter, do_unlink=True)

    bevel = base.modifiers.new('GS_Product_Edge_Soften', 'BEVEL')
    bevel.width = 0.00035
    bevel.segments = 2
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = math.radians(42.0)
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    smooth_mesh(base.data)
    base['glove_base_revision'] = BASE_REVISION
    base['cuff_opening_applied'] = True
    base['shaft_clearance_applied'] = True
    base['runtime_approved'] = False
    return base


def create_details(materials, finger_paths, thumb_path):
    details = []

    cuff_backroll = add_beveled_box(
        'GS_Glove_Cuff_Backroll',
        (-0.090, 0.031, 0.006),
        (0.036, 0.007, 0.047),
        0.0035,
        materials['red'],
    )
    details.append(cuff_backroll)
    cuff_side_guard = add_beveled_box(
        'GS_Glove_Cuff_Side_Guard',
        (-0.089, -0.004, -0.035),
        (0.032, 0.044, 0.006),
        0.003,
        materials['black'],
        rotation=(math.radians(-7.0), 0.0, 0.0),
    )
    details.append(cuff_side_guard)

    for index, (z, height) in enumerate(((0.024, 0.017), (0.002, 0.018), (-0.021, 0.016))):
        pad = add_beveled_box(
            f'GS_Glove_Backhand_Pad_{index + 1}',
            (-0.028 + index * 0.001, 0.0365, z),
            (0.044, 0.009, height),
            0.0055,
            materials['black'] if index == 1 else materials['red'],
        )
        details.append(pad)

    for finger_index, (label, path) in enumerate(finger_paths.items()):
        sections = (path[4:15], path[16:27], path[28:39])
        for segment_index, segment in enumerate(sections):
            offset = []
            for point in segment:
                if point.x < 0.014:
                    outward = Vector((0.0, 1.0, 0.0))
                else:
                    outward = Vector((point.x - SHAFT_CENTER.x, point.y, 0.0))
                    outward.normalize()
                offset.append(point + outward * 0.0060)
            pad = sweep_mesh(
                f'GS_Glove_{label}_Pad_{segment_index + 1}',
                offset,
                0.0052 - finger_index * 0.00028,
                0.0039 - finger_index * 0.00020,
                segments=20,
                taper_amount=0.10,
                profile_exponent=0.58,
                tip_scale=0.82,
            )
            assign_material(
                pad,
                materials['red'] if segment_index in (0, 2) else materials['black'],
            )
            details.append(pad)

    for index, z in enumerate((0.0260, 0.0087, -0.0087, -0.0255)):
        knuckle = add_beveled_box(
            f'GS_Glove_Knuckle_Cap_{index + 1}',
            (-0.004, 0.0375, z),
            (0.018, 0.009, 0.0125 if index < 3 else 0.0115),
            0.0042,
            materials['red'] if index in (0, 3) else materials['black'],
        )
        details.append(knuckle)

    finger_roots = (0.0260, 0.0087, -0.0087, -0.0255)
    for index, (upper, lower) in enumerate(zip(finger_roots, finger_roots[1:])):
        gusset = add_beveled_box(
            f'GS_Glove_Finger_Gusset_{index + 1}',
            (0.002, 0.012, (upper + lower) / 2.0),
            (0.027, 0.008, abs(upper - lower) * 0.48),
            0.003,
            materials['palm'],
        )
        details.append(gusset)

    thumb_offset = []
    for point in thumb_path[8:27]:
        outward = Vector((0.0, -1.0, 0.25)).normalized()
        thumb_offset.append(point + outward * 0.0055)
    thumb_pad = sweep_mesh(
        'GS_Glove_Thumb_Guard',
        thumb_offset,
        0.0070,
        0.0055,
        segments=24,
        taper_amount=0.18,
    )
    assign_material(thumb_pad, materials['red'])
    details.append(thumb_pad)

    for index, z in enumerate((0.027, 0.0, -0.028)):
        points = []
        for angle in range(-75, 76, 15):
            radians = math.radians(angle)
            points.append((
                -0.028 + math.sin(radians) * 0.027,
                0.042 + math.cos(radians) * 0.0015,
                z + math.cos(radians) * 0.008,
            ))
        details.append(add_curve(
            f'GS_Glove_Backhand_Binding_{index + 1}',
            points,
            0.0011,
            materials['binding'],
        ))

    palm_seam = (
        (-0.061, -0.038, -0.025),
        (-0.052, -0.039, 0.004),
        (-0.034, -0.039, 0.022),
        (-0.010, -0.038, 0.026),
        (0.000, -0.036, 0.017),
    )
    details.append(add_curve(
        'GS_Glove_Palm_Contour_Seam',
        palm_seam,
        0.00075,
        materials['binding'],
    ))

    details.append(add_curve(
        'GS_Glove_Palm_Heel_Seam',
        (
            (-0.064, -0.033, -0.022),
            (-0.052, -0.034, -0.030),
            (-0.032, -0.034, -0.031),
            (-0.018, -0.033, -0.023),
        ),
        0.00065,
        materials['binding'],
    ))

    details.append(add_curve(
        'GS_Glove_Thumb_Web_Seam',
        (
            (-0.045, -0.034, -0.026),
            (-0.029, -0.035, -0.025),
            (-0.011, -0.034, -0.018),
            (0.004, -0.031, -0.008),
        ),
        0.00065,
        materials['binding'],
    ))

    for obj in details:
        obj['glove_detail_role'] = 'manufactured-surface-detail'
        obj['runtime_approved'] = False
    return details


def create_shaft(material):
    bpy.ops.mesh.primitive_cube_add(location=(SHAFT_CENTER.x, SHAFT_CENTER.y, 0.0))
    shaft = bpy.context.object
    shaft.name = 'GS_Glove_Review_Shaft'
    shaft.scale = (SHAFT_HALF_WIDTH, SHAFT_HALF_DEPTH, 0.16)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = shaft.modifiers.new('GS_Shaft_Edge_Radius', 'BEVEL')
    bevel.width = 0.003
    bevel.segments = 5
    bpy.context.view_layer.objects.active = shaft
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    smooth_mesh(shaft.data)
    assign_material(shaft, material)
    shaft['review_reference_only'] = True
    return shaft


def create_studio(materials):
    world = bpy.data.worlds.new('GS_Glove_Studio_World')
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.045, 0.052, 0.062, 1.0)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.10

    bpy.ops.mesh.primitive_plane_add(size=2.0, location=(0.0, 0.0, -0.10))
    floor = bpy.context.object
    floor.name = 'GS_Glove_Studio_Floor'
    floor_material = bpy.data.materials.new('GS_Glove_Studio_Floor_Material')
    floor_material.diffuse_color = (0.14, 0.16, 0.19, 1.0)
    floor.data.materials.append(floor_material)

    camera_data = bpy.data.cameras.new('GS_Glove_Review_Camera_Data')
    camera = bpy.data.objects.new('GS_Glove_Review_Camera', camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.data.lens = 72
    camera.data.sensor_width = 36
    camera.data.dof.use_dof = False
    bpy.context.scene.camera = camera

    lights = (
        ('GS_Glove_Key', (0.24, -0.28, 0.34), 14.0, 0.28, (1.0, 0.90, 0.82)),
        ('GS_Glove_Fill', (-0.30, 0.20, 0.18), 8.0, 0.34, (0.70, 0.84, 1.0)),
        ('GS_Glove_Rim', (0.05, 0.34, 0.30), 18.0, 0.22, (1.0, 0.25, 0.16)),
    )
    for name, location, energy, size, color in lights:
        light_data = bpy.data.lights.new(name, 'AREA')
        light_data.energy = energy
        light_data.shape = 'DISK'
        light_data.size = size
        light_data.color = color
        light = bpy.data.objects.new(name, light_data)
        bpy.context.scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (Vector((0.0, 0.0, 0.0)) - light.location).to_track_quat('-Z', 'Y').to_euler()


def mesh_metrics(obj):
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    components = 0
    remaining = set(bm.verts)
    while remaining:
        components += 1
        stack = [remaining.pop()]
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other in remaining:
                    remaining.remove(other)
                    stack.append(other)
    non_manifold_edges = sum(not edge.is_manifold for edge in bm.edges)
    bm.free()
    dimensions = obj.dimensions
    return {
        'vertices': len(mesh.vertices),
        'polygons': len(mesh.polygons),
        'connectedComponents': components,
        'nonManifoldEdges': non_manifold_edges,
        'dimensionsM': [round(float(value), 5) for value in dimensions],
    }


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    materials = {
        'shell': make_material('GS_Glove_Shell_Black', (0.018, 0.022, 0.029), 0.47),
        'black': make_material('GS_Glove_Armor_Black', (0.025, 0.029, 0.036), 0.38),
        'red': make_material('GS_Glove_Armor_Red', (0.48, 0.012, 0.018), 0.44),
        'palm': make_material('GS_Glove_Palm_Gray', (0.18, 0.20, 0.22), 0.66, 58.0, 0.11),
        'binding': make_material('GS_Glove_Binding_White', (0.82, 0.84, 0.86), 0.48, 34.0, 0.08),
        'shaft': make_material('GS_Glove_Shaft_Reference', (0.035, 0.042, 0.052), 0.28, 22.0, 0.05),
    }

    forms, finger_paths, thumb_path = create_glove_forms()
    base = join_and_remesh(forms)
    assign_base_material_regions(base, materials['shell'], materials['palm'])
    details = create_details(materials, finger_paths, thumb_path)
    shaft = create_shaft(materials['shaft'])
    create_studio(materials)

    base_metrics = mesh_metrics(base)
    bpy.context.scene['vnext_production_glove_base_status'] = 'standalone-private-review'
    bpy.context.scene['vnext_production_glove_runtime_approved'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'standalone-continuous-glove-base-authored',
        'decision': 'human-review-required',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'athleteFitAttempted': False,
        'runtimeSelectorAdded': False,
        'generatedSegmentedApproachReused': False,
        'outputWorkfile': str(output_workfile),
        'baseObject': base.name,
        'baseRevision': base['glove_base_revision'],
        'baseMetrics': base_metrics,
        'manufacturedDetailObjects': len(details),
        'detailObjects': [obj.name for obj in details],
        'shaftReference': {
            'object': shaft.name,
            'halfWidthM': SHAFT_HALF_WIDTH,
            'halfDepthM': SHAFT_HALF_DEPTH,
            'referenceOnly': True,
        },
        'construction': {
            'continuousAnatomicalShell': True,
            'voxelUnified': True,
            'taperedWristOpening': True,
            'integratedPalmVolume': True,
            'integratedThumbWeb': True,
            'separatePalmInsert': False,
            'detachedCuffBinding': False,
            'curledFingerChannels': 4,
            'fittedThumbPath': True,
            'backhandPads': 3,
            'fingerPadSections': 12,
            'fingerRootGussets': 3,
            'individualKnuckleCaps': 4,
            'articulatedFingerJointConstrictions': 12,
            'palmLeatherMaterialRegion': True,
            'anatomicalPalmOutline': True,
            'palmHeelSeam': True,
            'thumbWebSeam': True,
            'segmentedCuffPads': 2,
        },
        'reviewBoundary': (
            'The standalone base must pass backhand, palm, thumb, pinky, and cuff close review '
            'before fitting, skin weights, athlete export, or runtime exposure.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_BASE_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
