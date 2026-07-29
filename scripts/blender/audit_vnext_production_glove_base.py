import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


SHAFT_CENTER = Vector((0.035, 0.0, 0.0))
SHAFT_RADIUS = 0.012


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--author-report', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def connected_components_and_manifold(mesh):
    bm = bmesh.new()
    bm.from_mesh(mesh)
    remaining = set(bm.verts)
    components = 0
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
    non_manifold = sum(not edge.is_manifold for edge in bm.edges)
    bm.free()
    return components, non_manifold


def shaft_contact(mesh):
    contact_angles = []
    penetration = 0
    closest_surface_distance = math.inf
    for vertex in mesh.vertices:
        coordinate = vertex.co
        radial_vector = Vector((coordinate.x - SHAFT_CENTER.x, coordinate.y, 0.0))
        radial = radial_vector.length
        if abs(coordinate.z) > 0.055:
            continue
        surface_distance = radial - SHAFT_RADIUS
        closest_surface_distance = min(closest_surface_distance, abs(surface_distance))
        if surface_distance < -0.0015:
            penetration += 1
        if abs(surface_distance) <= 0.0045:
            contact_angles.append(math.degrees(math.atan2(radial_vector.y, radial_vector.x)) % 360.0)
    if contact_angles:
        ordered = sorted(contact_angles)
        gaps = [
            (ordered[(index + 1) % len(ordered)] - ordered[index]) % 360.0
            for index in range(len(ordered))
        ]
        angular_coverage = 360.0 - max(gaps)
    else:
        angular_coverage = 0.0
    return {
        'verticesWithin4_5Mm': len(contact_angles),
        'penetratingVertices': penetration,
        'closestSurfaceDistanceMm': round(closest_surface_distance * 1000.0, 3),
        'angularCoverageDegrees': round(angular_coverage, 3),
    }


def main():
    args = parse_args()
    author_report = json.loads(Path(args.author_report).read_text(encoding='utf-8'))
    output_report = Path(args.output_report).resolve()
    output_report.parent.mkdir(parents=True, exist_ok=True)

    base = bpy.data.objects.get('GS_Production_Glove_Base')
    shaft = bpy.data.objects.get('GS_Glove_Review_Shaft')
    if base is None or base.type != 'MESH' or shaft is None:
        raise RuntimeError('The standalone production glove workfile is incomplete.')

    components, non_manifold = connected_components_and_manifold(base.data)
    detail_objects = [
        obj for obj in bpy.data.objects
        if obj.get('glove_detail_role') == 'manufactured-surface-detail'
    ]
    contact = shaft_contact(base.data)
    dimensions = [round(float(value), 5) for value in base.dimensions]
    checks = {
        'singleContinuousBase': components == 1,
        'watertightBase': non_manifold == 0,
        'productionTopologyRange': 12000 <= len(base.data.vertices) <= 180000,
        'credibleDimensions': (
            0.13 <= dimensions[0] <= 0.23
            and 0.08 <= dimensions[1] <= 0.15
            and 0.08 <= dimensions[2] <= 0.15
        ),
        'cuffOpeningAuthored': bool(base.get('cuff_opening_applied')),
        'manufacturedDetailsPresent': len(detail_objects) >= 28,
        'shaftProximityPresent': contact['verticesWithin4_5Mm'] >= 40,
        'shaftWrapCoverage': contact['angularCoverageDegrees'] >= 210.0,
        'shaftPenetrationBounded': contact['penetratingVertices'] <= 40,
        'runtimeStillClosed': (
            not bool(base.get('runtime_approved'))
            and not author_report['publicRuntimeAllowed']
            and not author_report['runtimeSelectorAdded']
        ),
        'segmentedApproachNotReused': not author_report['generatedSegmentedApproachReused'],
    }
    automated_pass = all(checks.values())
    if not automated_pass:
        failed = [name for name, passed in checks.items() if not passed]
        raise RuntimeError(f'Standalone glove base failed automated checks: {failed}')

    report = {
        'status': 'standalone-continuous-glove-base-audited',
        'decision': 'pending-human-close-review',
        'automatedPass': automated_pass,
        'humanVisualApproval': False,
        'publicRuntimeAllowed': False,
        'acceptedRuntimeAssetsChanged': False,
        'athleteFitAttempted': False,
        'baseObject': base.name,
        'baseRevision': base.get('glove_base_revision'),
        'vertices': len(base.data.vertices),
        'polygons': len(base.data.polygons),
        'connectedComponents': components,
        'nonManifoldEdges': non_manifold,
        'dimensionsM': dimensions,
        'manufacturedDetailObjects': len(detail_objects),
        'shaftContact': contact,
        'checks': checks,
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_BASE_AUDITED ' + str(output_report))


if __name__ == '__main__':
    main()
