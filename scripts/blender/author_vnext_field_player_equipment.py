import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--logo', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def make_material(name, color, roughness=0.58, metallic=0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1.0)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    return material


def set_smooth(mesh):
    for polygon in mesh.polygons:
        polygon.use_smooth = True


def copy_weights(source, target, index_map):
    for group in source.vertex_groups:
        target.vertex_groups.new(name=group.name)
    for old_index, new_index in index_map.items():
        for membership in source.data.vertices[old_index].groups:
            target.vertex_groups[membership.group].add([new_index], membership.weight, 'REPLACE')


def add_armature_modifier(obj, armature):
    modifier = obj.modifiers.new('GS_Armature', 'ARMATURE')
    modifier.object = armature
    modifier.use_deform_preserve_volume = True


def surface_from_body(
    body,
    armature,
    collection,
    name,
    predicate,
    offset,
    material,
    transform=None,
    smooth_iterations=0,
):
    selected = []
    used_vertices = set()
    for polygon in body.data.polygons:
        center = polygon.center
        if predicate(center):
            selected.append(polygon)
            used_vertices.update(polygon.vertices)
    if not selected:
        raise RuntimeError(f'No source faces selected for {name}')

    old_indices = sorted(used_vertices)
    index_map = {old_index: new_index for new_index, old_index in enumerate(old_indices)}
    vertices = []
    for old_index in old_indices:
        source_vertex = body.data.vertices[old_index]
        coordinate = source_vertex.co + source_vertex.normal * offset
        if transform:
            coordinate = transform(coordinate.copy())
        vertices.append(tuple(coordinate))
    faces = [[index_map[index] for index in polygon.vertices] for polygon in selected]

    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    copy_weights(body, obj, index_map)
    add_armature_modifier(obj, armature)
    obj.data.materials.append(material)

    if smooth_iterations > 0:
        smooth = obj.modifiers.new('GS_ClothRelax', 'SMOOTH')
        smooth.factor = 0.42
        smooth.iterations = smooth_iterations

    solidify = obj.modifiers.new('GS_ClothThickness', 'SOLIDIFY')
    solidify.thickness = 0.22
    solidify.offset = 0.1
    solidify.use_rim = True
    return obj


def rigid_mesh(name, vertices, faces, armature, collection, material, bone_name=None, bevel=0.0):
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    set_smooth(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.data.materials.append(material)

    if bone_name:
        group = obj.vertex_groups.new(name=bone_name)
        group.add(range(len(mesh.vertices)), 1.0, 'REPLACE')
        add_armature_modifier(obj, armature)

    if bevel > 0:
        modifier = obj.modifiers.new('GS_EdgeBevel', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 3
    return obj


def box_geometry(center, size):
    cx, cy, cz = center
    sx, sy, sz = (value * 0.5 for value in size)
    vertices = [
        (cx - sx, cy - sy, cz - sz),
        (cx + sx, cy - sy, cz - sz),
        (cx + sx, cy + sy, cz - sz),
        (cx - sx, cy + sy, cz - sz),
        (cx - sx, cy - sy, cz + sz),
        (cx + sx, cy - sy, cz + sz),
        (cx + sx, cy + sy, cz + sz),
        (cx - sx, cy + sy, cz + sz),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (4, 0, 3, 7),
    ]
    return vertices, faces


def elliptical_band_geometry(center_z, outer_x, outer_y, inner_x, inner_y, height, segments=40):
    loops = []
    for z, radius_x, radius_y in [
        (center_z - height * 0.5, outer_x, outer_y),
        (center_z + height * 0.5, outer_x, outer_y),
        (center_z - height * 0.5, inner_x, inner_y),
        (center_z + height * 0.5, inner_x, inner_y),
    ]:
        loops.append([
            (math.cos(index * math.tau / segments) * radius_x,
             math.sin(index * math.tau / segments) * radius_y,
             z)
            for index in range(segments)
        ])
    vertices = [vertex for loop in loops for vertex in loop]
    faces = []
    for index in range(segments):
        next_index = (index + 1) % segments
        outer_bottom = index
        outer_top = segments + index
        inner_bottom = segments * 2 + index
        inner_top = segments * 3 + index
        faces.extend([
            (outer_bottom, next_index, segments + next_index, outer_top),
            (inner_bottom, inner_top, segments * 3 + next_index, segments * 2 + next_index),
            (outer_top, segments + next_index, segments * 3 + next_index, inner_top),
            (outer_bottom, inner_bottom, segments * 2 + next_index, next_index),
        ])
    return vertices, faces


def shoe_geometry(center_x, sole=False):
    if sole:
        sections = [
            (5.5, 4.1, 0.7, 2.8),
            (0.0, 4.6, 0.6, 2.9),
            (-7.0, 5.1, 0.5, 3.0),
            (-13.5, 4.9, 0.6, 2.9),
            (-18.0, 3.9, 0.8, 2.7),
        ]
    else:
        sections = [
            (5.0, 3.8, 2.2, 7.4),
            (0.0, 4.3, 2.2, 10.4),
            (-6.5, 5.0, 2.2, 9.0),
            (-13.0, 4.8, 2.1, 6.0),
            (-18.0, 3.8, 2.0, 4.5),
        ]
    vertices = []
    for y, radius_x, bottom, top in sections:
        middle = bottom + (top - bottom) * 0.48
        vertices.extend([
            (center_x - radius_x, y, bottom),
            (center_x + radius_x, y, bottom),
            (center_x + radius_x, y, middle),
            (center_x + radius_x * 0.68, y, top),
            (center_x - radius_x * 0.68, y, top),
            (center_x - radius_x, y, middle),
        ])
    ring_size = 6
    faces = []
    for section in range(len(sections) - 1):
        start = section * ring_size
        next_start = (section + 1) * ring_size
        for index in range(ring_size):
            next_index = (index + 1) % ring_size
            faces.append((start + index, start + next_index, next_start + next_index, next_start + index))
    faces.append(tuple(range(ring_size))[::-1])
    last_start = (len(sections) - 1) * ring_size
    faces.append(tuple(last_start + index for index in range(ring_size)))
    return vertices, faces


def cylinder_between(name, start, end, radius, armature, collection, material, bone_name=None, segments=16):
    start_vector = Vector(start)
    end_vector = Vector(end)
    direction = end_vector - start_vector
    matrix = Matrix.Translation((start_vector + end_vector) * 0.5)
    matrix @= direction.to_track_quat('Z', 'Y').to_matrix().to_4x4()

    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=direction.length,
        matrix=matrix,
    )
    mesh = bpy.data.meshes.new(f'{name}_Mesh')
    bm.to_mesh(mesh)
    bm.free()
    set_smooth(mesh)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.data.materials.append(material)
    if bone_name:
        group = obj.vertex_groups.new(name=bone_name)
        group.add(range(len(mesh.vertices)), 1.0, 'REPLACE')
        add_armature_modifier(obj, armature)
    return obj


def blade_geometry(x, y, z):
    profile = [
        (y, z + 7.0),
        (y - 3.0, z + 2.0),
        (y - 22.0, z - 2.5),
        (y - 31.0, z - 1.0),
        (y - 29.0, z + 5.0),
        (y - 8.0, z + 9.0),
    ]
    thickness = 1.7
    vertices = [(x - thickness, py, pz) for py, pz in profile]
    vertices += [(x + thickness, py, pz) for py, pz in profile]
    front = tuple(range(len(profile)))
    back = tuple(range(len(profile), len(profile) * 2))[::-1]
    faces = [front, back]
    for index in range(len(profile)):
        next_index = (index + 1) % len(profile)
        faces.append((index, next_index, next_index + len(profile), index + len(profile)))
    return vertices, faces


def add_text_mesh(name, text, location, rotation, size, extrude, armature, collection, material):
    curve = bpy.data.curves.new(f'{name}_Curve', 'FONT')
    curve.body = text
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = 0.05
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.parent = armature
    obj.matrix_parent_inverse.identity()
    obj.location = location
    obj.rotation_euler = rotation
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj


def make_uniform_variant(side, body, armature, parent_collection, materials):
    collection = bpy.data.collections.new(f'GS_Equipment_{side}')
    parent_collection.children.link(collection)
    prefix = f'GS_{side}'

    def relax_jersey(coordinate):
        if abs(coordinate.x) < 31:
            coordinate.x *= 1.065
            coordinate.y *= 1.14
        else:
            coordinate.y *= 1.085
        return coordinate

    def relax_shorts(coordinate):
        coordinate.x *= 1.10
        coordinate.y *= 1.16
        return coordinate

    jersey = surface_from_body(
        body,
        armature,
        collection,
        f'{prefix}_Jersey',
        lambda c: (92 < c.z < 157 and abs(c.x) < 29) or (113 < c.z < 151 and 18 < abs(c.x) < 67),
        1.55,
        materials['jersey'],
        transform=relax_jersey,
        smooth_iterations=8,
    )
    jersey['equipment_group'] = 'jersey'

    stripe = surface_from_body(
        body,
        armature,
        collection,
        f'{prefix}_Jersey_Sleeve_Stripes',
        lambda c: 118 < c.z < 148 and 43 < abs(c.x) < 52,
        1.92,
        materials['accent'],
        transform=relax_jersey,
        smooth_iterations=2,
    )
    stripe['equipment_group'] = 'jersey-accent'

    shorts = surface_from_body(
        body,
        armature,
        collection,
        f'{prefix}_Shorts',
        lambda c: 67 < c.z < 105 and abs(c.x) < 31,
        2.05,
        materials['shorts'],
        transform=relax_shorts,
        smooth_iterations=3,
    )
    shorts['equipment_group'] = 'shorts'

    waistband = surface_from_body(
        body,
        armature,
        collection,
        f'{prefix}_Shorts_Waistband',
        lambda c: 99 < c.z < 106 and abs(c.x) < 29,
        2.45,
        materials['accent'],
        transform=relax_shorts,
        smooth_iterations=4,
    )
    waistband['equipment_group'] = 'shorts-accent'

    for label, sign, foot_bone, hand_bone in [
        ('Left', 1, 'CC_Base_L_Foot', 'CC_Base_L_Hand'),
        ('Right', -1, 'CC_Base_R_Foot', 'CC_Base_R_Hand'),
    ]:
        shoe_vertices, shoe_faces = shoe_geometry(sign * 8.2)
        shoe = rigid_mesh(
            f'{prefix}_Shoe_{label}_Upper',
            shoe_vertices,
            shoe_faces,
            armature,
            collection,
            materials['shoe'],
            foot_bone,
            bevel=0.65,
        )
        shoe['equipment_group'] = 'shoe'
        sole_vertices, sole_faces = shoe_geometry(sign * 8.2, sole=True)
        sole = rigid_mesh(
            f'{prefix}_Shoe_{label}_Sole',
            sole_vertices,
            sole_faces,
            armature,
            collection,
            materials['sole'],
            foot_bone,
            bevel=0.42,
        )
        sole['equipment_group'] = 'shoe'

        glove = surface_from_body(
            body,
            armature,
            collection,
            f'{prefix}_Glove_{label}',
            lambda c, sign=sign: 109 < c.z < 136 and sign * c.x > 61,
            1.55,
            materials['glove'],
            smooth_iterations=3,
        )
        glove['equipment_group'] = 'glove'
        cuff = cylinder_between(
            f'{prefix}_Glove_{label}_Cuff',
            (sign * 59.0, 6.0, 122.0),
            (sign * 64.0, 6.0, 122.0),
            5.4,
            armature,
            collection,
            materials['accent'],
            hand_bone,
            segments=20,
        )
        cuff['equipment_group'] = 'glove'

    helmet = surface_from_body(
        body,
        armature,
        collection,
        f'{prefix}_Helmet_Shell',
        lambda c: c.z > 164 and (c.z > 174 or c.y > -8 or abs(c.x) > 7.0),
        1.1,
        materials['helmet'],
    )
    helmet['equipment_group'] = 'helmet'
    helmet_stripe = surface_from_body(
        body,
        armature,
        collection,
        f'{prefix}_Helmet_Center_Stripe',
        lambda c: c.z > 172 and abs(c.x) < 2.4 and c.y > -12,
        1.38,
        materials['accent'],
    )
    helmet_stripe['equipment_group'] = 'helmet-accent'

    cage_segments = [
        ((-8.0, -20.8, 173.0), (8.0, -20.8, 173.0)),
        ((-7.5, -21.2, 168.5), (7.5, -21.2, 168.5)),
        ((-7.3, -20.3, 175.5), (-6.2, -19.2, 164.0)),
        ((7.3, -20.3, 175.5), (6.2, -19.2, 164.0)),
        ((-3.0, -21.0, 173.2), (-2.4, -20.0, 165.0)),
        ((3.0, -21.0, 173.2), (2.4, -20.0, 165.0)),
    ]
    for index, (start, end) in enumerate(cage_segments):
        cage = cylinder_between(
            f'{prefix}_Helmet_Cage_{index + 1:02d}',
            start,
            end,
            0.46,
            armature,
            collection,
            materials['cage'],
            'CC_Base_Head',
            segments=12,
        )
        cage['equipment_group'] = 'helmet'

    shaft = cylinder_between(
        f'{prefix}_Stick_Shaft',
        (90.0, -8.0, 10.0),
        (90.0, -8.0, 163.0),
        1.15,
        armature,
        collection,
        materials['stick'],
        segments=16,
    )
    shaft['equipment_group'] = 'stick'
    grip = cylinder_between(
        f'{prefix}_Stick_Grip',
        (90.0, -8.0, 138.0),
        (90.0, -8.0, 164.0),
        1.48,
        armature,
        collection,
        materials['accent'],
        segments=16,
    )
    grip['equipment_group'] = 'stick'
    blade_vertices, blade_faces = blade_geometry(90.0, -8.0, 4.0)
    blade = rigid_mesh(
        f'{prefix}_Stick_Blade',
        blade_vertices,
        blade_faces,
        armature,
        collection,
        materials['stick'],
        bevel=0.65,
    )
    blade['equipment_group'] = 'stick'

    front_mark = add_text_mesh(
        f'{prefix}_Jersey_Front_Mark',
        'GS',
        (0, -20.1, 137.0),
        (math.pi / 2, 0, 0),
        12.5,
        0.18,
        armature,
        collection,
        materials['mark'],
    )
    front_mark['equipment_group'] = 'uniform-mark'
    number_segments = (
        ('One', (4.2, 20.8, 130.0), (4.2, 20.8, 144.0)),
        ('SevenTop', (-8.2, 20.8, 144.0), (-1.0, 20.8, 144.0)),
        ('SevenDiagonal', (-8.0, 20.8, 143.6), (-2.2, 20.8, 130.0)),
    )
    for segment_name, start, end in number_segments:
        segment = cylinder_between(
            f'{prefix}_Jersey_Back_Number_{segment_name}',
            start,
            end,
            0.72,
            armature,
            collection,
            materials['mark'],
            segments=12,
        )
        segment['equipment_group'] = 'uniform-mark'
    return collection


def main():
    args = parse_args()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    logo_path = Path(args.logo).resolve()
    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    if not logo_path.exists():
        raise FileNotFoundError(logo_path)

    body = bpy.data.objects.get('CC_Base_Body')
    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if body is None or armature is None:
        raise RuntimeError('The accepted field-player base is incomplete.')

    equipment_root = bpy.data.collections.new('GS_FieldPlayer_Equipment')
    bpy.context.scene.collection.children.link(equipment_root)

    skin = make_material('GS_Review_Skin', (0.51, 0.30, 0.20), 0.7)
    body.data.materials.clear()
    body.data.materials.append(skin)
    for name in ['CC_Base_Eye', 'CC_Base_EyeOcclusion', 'CC_Base_TearLine', 'CC_Base_Teeth', 'CC_Base_Tongue']:
        obj = bpy.data.objects.get(name)
        if obj:
            obj.hide_render = True

    home_materials = {
        'jersey': make_material('GS_Home_Jersey_Black', (0.018, 0.022, 0.030), 0.72),
        'accent': make_material('GS_Home_Accent_Red', (0.72, 0.012, 0.025), 0.56),
        'shorts': make_material('GS_Home_Shorts_Black', (0.012, 0.015, 0.022), 0.76),
        'shoe': make_material('GS_Home_Shoe_Black', (0.015, 0.018, 0.024), 0.48),
        'sole': make_material('GS_Home_Sole_Red', (0.48, 0.01, 0.02), 0.78),
        'glove': make_material('GS_Home_Glove_Black', (0.012, 0.015, 0.020), 0.54),
        'helmet': make_material('GS_Home_Helmet_Black', (0.008, 0.010, 0.014), 0.28),
        'cage': make_material('GS_Home_Cage_Steel', (0.18, 0.20, 0.23), 0.24, 0.78),
        'stick': make_material('GS_Home_Stick_Graphite', (0.025, 0.030, 0.038), 0.38, 0.42),
        'mark': make_material('GS_Home_Mark_White', (0.92, 0.94, 0.96), 0.54),
    }
    away_materials = {
        'jersey': make_material('GS_Away_Jersey_White', (0.88, 0.90, 0.91), 0.72),
        'accent': make_material('GS_Away_Accent_Red', (0.72, 0.012, 0.025), 0.56),
        'shorts': make_material('GS_Away_Shorts_Black', (0.012, 0.015, 0.022), 0.76),
        'shoe': make_material('GS_Away_Shoe_Black', (0.015, 0.018, 0.024), 0.48),
        'sole': make_material('GS_Away_Sole_White', (0.75, 0.78, 0.80), 0.78),
        'glove': make_material('GS_Away_Glove_Black', (0.012, 0.015, 0.020), 0.54),
        'helmet': make_material('GS_Away_Helmet_White', (0.82, 0.84, 0.86), 0.30),
        'cage': make_material('GS_Away_Cage_Steel', (0.16, 0.18, 0.21), 0.24, 0.78),
        'stick': make_material('GS_Away_Stick_Graphite', (0.025, 0.030, 0.038), 0.38, 0.42),
        'mark': make_material('GS_Away_Mark_Black', (0.012, 0.015, 0.020), 0.54),
    }

    home = make_uniform_variant('Home', body, armature, equipment_root, home_materials)
    away = make_uniform_variant('Away', body, armature, equipment_root, away_materials)
    home.hide_render = False
    away.hide_render = True

    bpy.context.scene['vnext_equipment_status'] = 'authored-for-human-review'
    bpy.context.scene['vnext_equipment_public_runtime_allowed'] = False
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    equipment_objects = [obj for obj in bpy.data.objects if obj.get('equipment_group')]
    groups = sorted(set(obj.get('equipment_group') for obj in equipment_objects))
    report = {
        'status': 'authored-for-human-review',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'outputWorkfile': str(output_blend),
        'logoReference': str(logo_path),
        'collections': [home.name, away.name],
        'equipmentObjectCount': len(equipment_objects),
        'equipmentGroups': groups,
        'requiredGroups': ['jersey', 'shorts', 'shoe', 'glove', 'helmet', 'stick'],
        'missingGroups': [name for name in ['jersey', 'shorts', 'shoe', 'glove', 'helmet', 'stick'] if name not in groups],
        'objects': sorted(obj.name for obj in equipment_objects),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
