import argparse
import json
import math
import sys
from collections import defaultdict, deque
from pathlib import Path

import bpy
import numpy as np


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

EQUIPMENT_COLLECTIONS = ('GS_Equipment_Home', 'GS_Equipment_Away')

SOURCE_TEXTURES = {
    'skin_head': ('Std_Skin_Head', 1024),
    'skin_body': ('Std_Skin_Body', 256),
    'skin_arm': ('Std_Skin_Arm', 256),
    'skin_leg': ('Std_Skin_Leg', 256),
    'eye': ('Std_Eye_R', 256),
    'teeth': ('Std_Upper_Teeth', 256),
    'tongue': ('Std_Tongue', 256),
    'eye_occlusion': ('Std_Eye_Occlusion_R', 128),
}

SURFACE_SPECS = {
    'fabric_black': ((0.018, 0.024, 0.034), 'fabric', 0.73, 0.0, 0.52),
    'fabric_white': ((0.76, 0.80, 0.84), 'fabric', 0.72, 0.0, 0.50),
    'fabric_red': ((0.56, 0.009, 0.018), 'fabric', 0.70, 0.0, 0.52),
    'leather_black': ((0.012, 0.017, 0.024), 'leather', 0.48, 0.0, 0.38),
    'leather_red': ((0.48, 0.008, 0.015), 'leather', 0.50, 0.0, 0.38),
    'plastic_black': ((0.006, 0.010, 0.017), 'plastic', 0.25, 0.0, 0.20),
    'plastic_white': ((0.72, 0.76, 0.81), 'plastic', 0.26, 0.0, 0.18),
    'plastic_red': ((0.58, 0.009, 0.018), 'plastic', 0.28, 0.0, 0.20),
    'knit_black': ((0.012, 0.017, 0.024), 'knit', 0.62, 0.0, 0.48),
    'rubber_red': ((0.39, 0.006, 0.012), 'rubber', 0.76, 0.0, 0.34),
    'rubber_white': ((0.58, 0.61, 0.65), 'rubber', 0.78, 0.0, 0.32),
    'graphite': ((0.019, 0.026, 0.036), 'graphite', 0.36, 0.18, 0.34),
    'grip_red': ((0.45, 0.006, 0.012), 'grip', 0.68, 0.0, 0.42),
    'ink_black': ((0.006, 0.009, 0.014), 'ink', 0.42, 0.0, 0.08),
    'ink_white': ((0.86, 0.89, 0.93), 'ink', 0.43, 0.0, 0.08),
    'ink_red': ((0.62, 0.008, 0.016), 'ink', 0.44, 0.0, 0.08),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    parser.add_argument('--texture-dir', required=True)
    parser.add_argument('--source-texture-dir', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


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
        action.name: sum(
            len(fcurve.keyframe_points)
            for fcurve in fcurves(action)
        )
        for action in bpy.data.actions
        if action.name in REQUIRED_ACTIONS
    }


def save_array_image(path, pixels, colorspace):
    height, width, _ = pixels.shape
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=True)
    image.colorspace_settings.name = colorspace
    image.pixels.foreach_set(np.asarray(pixels, dtype=np.float32).ravel())
    image.file_format = 'PNG'
    image.filepath_raw = str(path)
    image.save()
    return image


def tile_height(kind, size):
    axis = np.arange(size, dtype=np.float32) / float(size)
    x, y = np.meshgrid(axis, axis)
    tau = math.tau
    if kind == 'fabric':
        return (
            0.55 * np.sin(tau * 34 * x) * np.sin(tau * 34 * y)
            + 0.22 * np.sin(tau * 17 * (x + y))
        )
    if kind == 'knit':
        return (
            0.50 * np.sin(tau * 24 * (x + 0.35 * y))
            + 0.35 * np.sin(tau * 24 * (x - 0.35 * y))
        )
    if kind == 'leather':
        return (
            0.42 * np.sin(tau * 13 * x + 0.8 * np.sin(tau * 5 * y))
            * np.sin(tau * 11 * y)
            + 0.18 * np.sin(tau * 37 * (x + y))
        )
    if kind == 'plastic':
        return 0.55 * np.sin(tau * 19 * x) * np.sin(tau * 23 * y)
    if kind == 'rubber':
        return (
            0.45 * np.sin(tau * 16 * x) * np.sin(tau * 16 * y)
            + 0.30 * np.cos(tau * 8 * (x + y))
        )
    if kind == 'graphite':
        return (
            0.52 * np.sin(tau * 20 * (x + y))
            + 0.52 * np.sin(tau * 20 * (x - y))
        )
    if kind == 'grip':
        return 0.65 * np.sin(tau * 18 * (x + 0.18 * y))
    return 0.18 * np.sin(tau * 9 * x) * np.sin(tau * 9 * y)


def texture_arrays(color, kind, roughness, normal_strength, size):
    height = tile_height(kind, size).astype(np.float32)
    modulation = 1.0 + 0.055 * height
    rgb = np.clip(np.asarray(color, dtype=np.float32)[None, None, :] * modulation[:, :, None], 0.0, 1.0)
    alpha = np.ones((size, size, 1), dtype=np.float32)
    base = np.concatenate((rgb, alpha), axis=2)

    rough = np.clip(roughness + 0.045 * height, 0.02, 0.98)
    roughness_pixels = np.stack((rough, rough, rough, np.ones_like(rough)), axis=2)

    dx = 0.5 * (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1))
    dy = 0.5 * (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0))
    normal = np.stack((-dx * normal_strength, -dy * normal_strength, np.ones_like(height)), axis=2)
    normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), 1e-6)
    normal = normal * 0.5 + 0.5
    normal_pixels = np.concatenate((normal, alpha), axis=2)
    return base, roughness_pixels, normal_pixels


def create_surface_textures(texture_dir):
    texture_sets = {}
    for key, (color, kind, roughness, metallic, normal_strength) in SURFACE_SPECS.items():
        size = 128 if kind == 'ink' else 256
        base, rough, normal = texture_arrays(color, kind, roughness, normal_strength, size)
        paths = {
            'base': texture_dir / f'{key}-basecolor.png',
            'roughness': texture_dir / f'{key}-roughness.png',
            'normal': texture_dir / f'{key}-normal.png',
        }
        save_array_image(paths['base'], base, 'sRGB')
        save_array_image(paths['roughness'], rough, 'Non-Color')
        save_array_image(paths['normal'], normal, 'Non-Color')
        texture_sets[key] = {
            **paths,
            'metallic': metallic,
            'normalStrength': normal_strength,
            'size': size,
            'kind': kind,
        }
    return texture_sets


def source_file(source_dir, stem, channel):
    candidates = list(source_dir.glob(f'{stem}_{channel}.*'))
    if not candidates:
        raise RuntimeError(f'Missing licensed source texture: {stem}_{channel}')
    return sorted(candidates)[0]


def resized_source_image(source, output, size, colorspace):
    source_image = bpy.data.images.load(str(source), check_existing=False)
    _ = source_image.pixels[0]
    source_image.scale(size, size)
    pixels = np.empty(size * size * 4, dtype=np.float32)
    source_image.pixels.foreach_get(pixels)
    image = save_array_image(output, pixels.reshape((size, size, 4)), colorspace)
    bpy.data.images.remove(source_image)
    return image


def create_source_texture_sets(source_dir, texture_dir):
    texture_sets = {}
    for key, (stem, size) in SOURCE_TEXTURES.items():
        paths = {
            'base': texture_dir / f'{key}-basecolor.png',
            'roughness': texture_dir / f'{key}-roughness.png',
        }
        base = resized_source_image(source_file(source_dir, stem, 'diffuse'), paths['base'], size, 'sRGB')
        roughness = resized_source_image(
            source_file(source_dir, stem, 'roughness'), paths['roughness'], size, 'Non-Color'
        )
        normal_candidates = list(source_dir.glob(f'{stem}_normal.*'))
        normal = None
        if normal_candidates:
            paths['normal'] = texture_dir / f'{key}-normal.png'
            normal = resized_source_image(
                sorted(normal_candidates)[0], paths['normal'], size, 'Non-Color'
            )
        alpha_candidates = list(source_dir.glob(f'{stem}_opacity.*'))
        alpha = None
        if alpha_candidates:
            paths['alpha'] = texture_dir / f'{key}-opacity.png'
            alpha = resized_source_image(
                sorted(alpha_candidates)[0], paths['alpha'], size, 'Non-Color'
            )
        texture_sets[key] = {
            **paths,
            'loadedImages': [item for item in (base, roughness, normal, alpha) if item],
            'metallic': 0.0,
            'normalStrength': 0.42 if key.startswith('skin') else 0.30,
            'size': size,
            'kind': 'licensed-source',
        }
    return texture_sets


def image_for_path(path, colorspace):
    resolved = str(Path(path).resolve())
    image = next(
        (candidate for candidate in bpy.data.images if bpy.path.abspath(candidate.filepath) == resolved),
        None,
    )
    if image is None:
        image = bpy.data.images.load(resolved, check_existing=True)
    image.colorspace_settings.name = colorspace
    image.pack()
    return image


def create_pbr_material(name, texture_set, *, subsurface=0.0, alpha=1.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (620, 40)
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (320, 40)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Metallic'].default_value = texture_set.get('metallic', 0.0)
    bsdf.inputs['Roughness'].default_value = 0.6
    bsdf.inputs['IOR'].default_value = 1.46
    if bsdf.inputs.get('Subsurface Weight'):
        bsdf.inputs['Subsurface Weight'].default_value = subsurface
    if bsdf.inputs.get('Alpha'):
        bsdf.inputs['Alpha'].default_value = alpha

    base_node = nodes.new('ShaderNodeTexImage')
    base_node.name = 'GS_BaseColor_Texture'
    base_node.label = 'Base color (sRGB)'
    base_node.location = (-300, 180)
    base_node.image = image_for_path(texture_set['base'], 'sRGB')
    links.new(base_node.outputs['Color'], bsdf.inputs['Base Color'])

    rough_node = nodes.new('ShaderNodeTexImage')
    rough_node.name = 'GS_Roughness_Texture'
    rough_node.label = 'Roughness (linear)'
    rough_node.location = (-300, -20)
    rough_node.image = image_for_path(texture_set['roughness'], 'Non-Color')
    links.new(rough_node.outputs['Color'], bsdf.inputs['Roughness'])

    if texture_set.get('normal'):
        normal_texture = nodes.new('ShaderNodeTexImage')
        normal_texture.name = 'GS_Normal_Texture'
        normal_texture.label = 'Tangent normal (linear)'
        normal_texture.location = (-300, -220)
        normal_texture.image = image_for_path(texture_set['normal'], 'Non-Color')
        normal_map = nodes.new('ShaderNodeNormalMap')
        normal_map.location = (40, -180)
        normal_map.inputs['Strength'].default_value = texture_set.get('normalStrength', 0.35)
        links.new(normal_texture.outputs['Color'], normal_map.inputs['Color'])
        links.new(normal_map.outputs['Normal'], bsdf.inputs['Normal'])

    if texture_set.get('alpha'):
        alpha_node = nodes.new('ShaderNodeTexImage')
        alpha_node.name = 'GS_Opacity_Texture'
        alpha_node.location = (-300, -410)
        alpha_node.image = image_for_path(texture_set['alpha'], 'Non-Color')
        links.new(alpha_node.outputs['Color'], bsdf.inputs['Alpha'])
        material.surface_render_method = 'DITHERED'

    material['gs_pbr_surface'] = texture_set['kind']
    material['gs_pbr_texture_size'] = texture_set['size']
    material['gs_pbr_authored'] = True
    return material


def create_clear_material(name, alpha, roughness, color=(0.7, 0.78, 0.86, 1.0)):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0.0
    bsdf.inputs['Alpha'].default_value = alpha
    bsdf.inputs['IOR'].default_value = 1.38
    material.surface_render_method = 'DITHERED'
    material['gs_pbr_surface'] = 'clear-polymer'
    material['gs_pbr_authored'] = True
    return material


def configure_eye_material(material):
    shader = next(
        (node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'),
        None,
    )
    if shader is None:
        raise RuntimeError('The licensed eye material has no Principled shader.')
    roughness = shader.inputs['Roughness']
    for link in list(roughness.links):
        material.node_tree.links.remove(link)
    roughness.default_value = 0.24
    shader.inputs['IOR'].default_value = 1.38
    material['gs_eye_cornea_restored'] = True


def ensure_uv(obj):
    if obj.type != 'MESH' or obj.data.uv_layers:
        return False
    bpy.ops.object.select_all(action='DESELECT')
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    return True


def assign_single_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = 0


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


def assign_eye_materials(obj, eye_material, cornea_material):
    components = connected_components(obj.data)
    if len(components) != 4 or any(len(component) != 162 for component in components):
        raise RuntimeError('The licensed four-shell eye topology changed unexpectedly.')
    obj.data.materials.clear()
    obj.data.materials.append(eye_material)
    obj.data.materials.append(cornea_material)
    assignments = {}
    summary = []
    for side, sign in (('left', 1), ('right', -1)):
        candidates = []
        for component in components:
            coordinates = [obj.data.vertices[index].co for index in component]
            center_x = sum(coordinate.x for coordinate in coordinates) / len(coordinates)
            if (1 if center_x >= 0 else -1) != sign:
                continue
            spans = [
                max(coordinate[axis] for coordinate in coordinates)
                - min(coordinate[axis] for coordinate in coordinates)
                for axis in range(3)
            ]
            candidates.append((max(spans), component))
        if len(candidates) != 2:
            raise RuntimeError(f'The licensed {side} eye shells are incomplete.')
        candidates.sort(key=lambda item: item[0])
        for material_index, surface, (_, component) in (
            (0, 'inner-eye', candidates[0]),
            (1, 'cornea', candidates[1]),
        ):
            for vertex_index in component:
                assignments[vertex_index] = material_index
            summary.append({'side': side, 'surface': surface, 'vertices': len(component)})
    counts = [0, 0]
    for polygon in obj.data.polygons:
        material_index = assignments[polygon.vertices[0]]
        polygon.material_index = material_index
        counts[material_index] += 1
    return {
        'components': summary,
        'innerEyePolygons': counts[0],
        'corneaPolygons': counts[1],
    }


def assign_body_materials(obj, materials):
    obj.data.materials.clear()
    ordered = [materials[key] for key in ('skin_head', 'skin_body', 'skin_arm', 'skin_leg')]
    for material in ordered:
        obj.data.materials.append(material)
    coordinates = [vertex.co for vertex in obj.data.vertices]
    minimum_z = min(vector.z for vector in coordinates)
    maximum_z = max(vector.z for vector in coordinates)
    minimum_x = min(vector.x for vector in coordinates)
    maximum_x = max(vector.x for vector in coordinates)
    z_span = max(maximum_z - minimum_z, 1e-6)
    x_midpoint = 0.5 * (minimum_x + maximum_x)
    x_span = max(maximum_x - minimum_x, 1e-6)
    counts = [0, 0, 0, 0]
    for polygon in obj.data.polygons:
        center = sum((coordinates[index] for index in polygon.vertices), coordinates[polygon.vertices[0]].copy() * 0.0)
        center /= len(polygon.vertices)
        z_ratio = (center.z - minimum_z) / z_span
        x_ratio = abs(center.x - x_midpoint) / x_span
        if z_ratio >= 0.79:
            index = 0
        elif z_ratio <= 0.48:
            index = 3
        elif x_ratio >= 0.25:
            index = 2
        else:
            index = 1
        polygon.material_index = index
        counts[index] += 1
    return dict(zip(('head', 'body', 'arm', 'leg'), counts))


def set_object_slots(obj, material_keys, materials):
    if len(obj.material_slots) != len(material_keys):
        obj.data.materials.clear()
        for key in material_keys:
            obj.data.materials.append(materials[key])
        for polygon in obj.data.polygons:
            polygon.material_index = min(polygon.material_index, len(material_keys) - 1)
        return
    for slot, key in zip(obj.material_slots, material_keys):
        slot.material = materials[key]


def assign_equipment_materials(materials):
    assignments = {}
    for collection_name in EQUIPMENT_COLLECTIONS:
        collection = bpy.data.collections.get(collection_name)
        if collection is None:
            raise RuntimeError(f'Missing equipment collection: {collection_name}')
        for obj in collection.all_objects:
            if obj.type != 'MESH':
                continue
            ensure_uv(obj)
            name = obj.name
            away = name.startswith('GS_Away_')
            if '_Jersey_Front_Mark' in name:
                keys = ('ink_black' if away else 'ink_white',)
            elif '_Jersey_Back_Number_' in name:
                keys = ('ink_red',)
            elif name.endswith('_Jersey'):
                keys = ('fabric_white' if away else 'fabric_black', 'fabric_red')
            elif '_Glove_' in name and name.endswith('_Cuff'):
                keys = ('leather_red',)
            elif '_Glove_' in name:
                keys = ('leather_black',)
            elif '_Helmet_Center_Stripe' in name:
                keys = ('plastic_red',)
            elif '_Helmet_Shell' in name:
                keys = ('plastic_white' if away else 'plastic_black',)
            elif '_Shoe_' in name and name.endswith('_Upper'):
                keys = ('knit_black',)
            elif '_Shoe_' in name and name.endswith('_Sole'):
                keys = ('rubber_white' if away else 'rubber_red',)
            elif name.endswith('_Shorts'):
                keys = ('fabric_black',)
            elif name.endswith('_Shorts_Waistband'):
                keys = ('fabric_red',)
            elif name.endswith(('_Stick_Shaft', '_Stick_Blade')):
                keys = ('graphite',)
            elif name.endswith('_Stick_Grip'):
                keys = ('grip_red',)
            else:
                continue
            set_object_slots(obj, keys, materials)
            assignments[name] = list(keys)
    return assignments


def assign_source_materials(materials):
    body = bpy.data.objects.get('CC_Base_Body')
    eye = bpy.data.objects.get('CC_Base_Eye')
    eye_occlusion = bpy.data.objects.get('CC_Base_EyeOcclusion')
    tearline = bpy.data.objects.get('CC_Base_TearLine')
    teeth = bpy.data.objects.get('CC_Base_Teeth')
    tongue = bpy.data.objects.get('CC_Base_Tongue')
    if not all((body, eye, eye_occlusion, tearline, teeth, tongue)):
        raise RuntimeError('The Character Creator source meshes are incomplete.')

    body_counts = assign_body_materials(body, materials)
    eye_assignments = assign_eye_materials(eye, materials['eye'], materials['cornea'])
    assign_single_material(eye_occlusion, materials['eye_occlusion'])
    assign_single_material(tearline, materials['tearline'])
    assign_single_material(teeth, materials['teeth'])
    assign_single_material(tongue, materials['tongue'])
    restored_visibility = {}
    for obj in (eye, eye_occlusion, tearline, teeth, tongue):
        restored_visibility[obj.name] = {'before': obj.hide_render, 'after': False}
        obj.hide_render = False
    return {
        'bodyPolygonMaterialCounts': body_counts,
        'eye': materials['eye'].name,
        'cornea': materials['cornea'].name,
        'eyeAssignments': eye_assignments,
        'eyeOcclusion': materials['eye_occlusion'].name,
        'tearline': materials['tearline'].name,
        'teeth': materials['teeth'].name,
        'tongue': materials['tongue'].name,
        'restoredRenderVisibility': restored_visibility,
    }


def main():
    args = parse_args()
    source_workfile = bpy.data.filepath
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    texture_dir = Path(args.texture_dir).resolve()
    source_texture_dir = Path(args.source_texture_dir).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    texture_dir.mkdir(parents=True, exist_ok=True)

    before_keys = action_key_counts()
    if set(before_keys) != REQUIRED_ACTIONS:
        raise RuntimeError(f'Missing runtime actions: {sorted(REQUIRED_ACTIONS - set(before_keys))}')

    authored_sets = create_surface_textures(texture_dir)
    source_sets = create_source_texture_sets(source_texture_dir, texture_dir)
    materials = {
        key: create_pbr_material(f'GS_PBR_{key.title()}', texture_set)
        for key, texture_set in authored_sets.items()
    }
    materials.update({
        'skin_head': create_pbr_material('GS_PBR_Skin_Head', source_sets['skin_head'], subsurface=0.06),
        'skin_body': create_pbr_material('GS_PBR_Skin_Body', source_sets['skin_body'], subsurface=0.05),
        'skin_arm': create_pbr_material('GS_PBR_Skin_Arm', source_sets['skin_arm'], subsurface=0.05),
        'skin_leg': create_pbr_material('GS_PBR_Skin_Leg', source_sets['skin_leg'], subsurface=0.05),
        'eye': create_pbr_material('GS_PBR_Eye', source_sets['eye']),
        'cornea': create_clear_material('GS_PBR_Cornea', 0.045, 0.055, (1.0, 1.0, 1.0, 1.0)),
        'eye_occlusion': create_pbr_material('GS_PBR_Eye_Occlusion', source_sets['eye_occlusion'], alpha=0.45),
        'teeth': create_pbr_material('GS_PBR_Teeth', source_sets['teeth']),
        'tongue': create_pbr_material('GS_PBR_Tongue', source_sets['tongue'], subsurface=0.03),
        'tearline': create_clear_material('GS_PBR_Tearline', 0.12, 0.04),
    })
    configure_eye_material(materials['eye'])

    source_assignments = assign_source_materials(materials)
    equipment_assignments = assign_equipment_materials(materials)
    after_keys = action_key_counts()
    if after_keys != before_keys:
        raise RuntimeError('Material authoring changed animation key counts.')

    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))
    texture_files = sorted(texture_dir.glob('*.png'))
    report = {
        'status': 'private-pbr-materials-authored',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'licenseRecord': str(
            source_texture_dir.parents[3] / 'Read Me.txt'
        ),
        'licensedCharacterTextures': sorted(source_sets),
        'authoredEquipmentTextureSets': sorted(authored_sets),
        'textureFileCount': len(texture_files),
        'textureBytes': sum(path.stat().st_size for path in texture_files),
        'textureFiles': [str(path) for path in texture_files],
        'sourceAssignments': source_assignments,
        'equipmentAssignments': equipment_assignments,
        'pbrMaterialCount': sum(
            bool(material.get('gs_pbr_authored')) for material in bpy.data.materials
        ),
        'imageTextureNodeCount': sum(
            sum(node.type == 'TEX_IMAGE' for node in material.node_tree.nodes)
            for material in bpy.data.materials
            if material.use_nodes and material.node_tree and material.get('gs_pbr_authored')
        ),
        'actionKeyCounts': {
            name: {'before': before_keys[name], 'after': after_keys[name]}
            for name in sorted(before_keys)
        },
        'reviewBoundary': (
            'The candidate remains private until licensed materials, close-camera skin and equipment, '
            'runtime readability, deformation, grounding, motion, and the complete human visual gate pass.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PBR_MATERIALS_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
