import importlib.util
import json
import re
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
MANUFACTURED_AUDIT_PATH = SCRIPT_DIR / 'audit_vnext_production_glove_manufactured.py'
MANUFACTURED_AUDIT_SPEC = importlib.util.spec_from_file_location(
    'vnext_glove_manufactured_audit',
    MANUFACTURED_AUDIT_PATH,
)
manufactured_audit = importlib.util.module_from_spec(MANUFACTURED_AUDIT_SPEC)
MANUFACTURED_AUDIT_SPEC.loader.exec_module(manufactured_audit)
audit = manufactured_audit.audit

FIT_REVISION = 'production-integrated-sewn-volume-fit-v5'
SCULPT_REVISION = 'integrated-sewn-volume-glove-v4'
MANUFACTURED_REVISION = 'anatomical-sewn-glove-shell-v3'


def output_report_path():
    arguments = sys.argv[sys.argv.index('--') + 1:]
    return Path(arguments[arguments.index('--output-report') + 1]).resolve()


def main():
    manufactured_audit.FIT_REVISION = FIT_REVISION
    manufactured_audit.MANUFACTURED_REVISION = SCULPT_REVISION
    manufactured_audit.main()

    report_path = output_report_path()
    report = json.loads(report_path.read_text(encoding='utf-8'))
    armor_vertices = []
    armor_polygons = []
    for variant in ('Home', 'Away'):
        for side in ('Left', 'Right'):
            for obj in audit.glove_objects(variant, side):
                if re.search(r'Production_(Index|Middle|Ring|Pinky)_Armor_[123]$', obj.name):
                    armor_vertices.append(len(obj.data.vertices))
                    armor_polygons.append(len(obj.data.polygons))

    sculpt_checks = {
        'sculptRevisionRecorded': report.get('fitRevision') == FIT_REVISION,
        'jointSpecificArmorHasSculptDensity': (
            len(armor_vertices) == 48
            and min(armor_vertices) >= 300
            and min(armor_polygons) >= 280
        ),
        'formedPalmMetacarpalAndThumbRemainContinuous': all(
            all(
                metrics is not None
                and metrics['connectedComponents'] == 1
                and metrics['nonManifoldEdges'] == 0
                for metrics in item['manufacturedTopology'].values()
            )
            for item in report['manufacturedInventories'].values()
        ),
        'formedPalmUsesMultiBoneBlend': all(
            len(item['palmSaddleVertexGroups']) >= 8
            for item in report['manufacturedInventories'].values()
        ),
        'thumbGuardUsesThumbChainBlend': all(
            sum('Thumb' in group for group in item['thumbSaddleVertexGroups']) >= 2
            for item in report['manufacturedInventories'].values()
        ),
    }
    report.update({
        'status': 'private-production-glove-sculpt-audited',
        'fitRevision': FIT_REVISION,
        'sculptRevision': SCULPT_REVISION,
        'manufacturedRevision': MANUFACTURED_REVISION,
        'sourceTopologyRevision': 'segmented-source-finger-shell-v2',
        'jointSpecificArmor': {
            'objectCountAcrossFits': len(armor_vertices),
            'minimumVertices': min(armor_vertices),
            'maximumVertices': max(armor_vertices),
            'minimumPolygons': min(armor_polygons),
            'maximumPolygons': max(armor_polygons),
        },
    })
    report['checks'].update(sculpt_checks)
    report['automatedPass'] = all(report['checks'].values())
    report['humanVisualApproval'] = False
    report['publicRuntimeAllowed'] = False
    report['reviewRule'] = (
        'Topology, weighting, shaft contact, and action stability cannot approve appearance. '
        'Hidden close review must still reject flat palm flow, broad smooth roots, repeated foam, '
        'faceted shell finish, implausible thumb hinging, clipping, or unstable edge construction.'
    )
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_SCULPT_AUDITED ' + str(report_path))
    if not report['automatedPass']:
        raise RuntimeError('The private integrated sewn-volume glove failed its automated audit.')


if __name__ == '__main__':
    main()
