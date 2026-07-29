import importlib.util
import json
import re
import sys
from pathlib import Path

import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
AUDIT_PATH = SCRIPT_DIR / 'audit_vnext_production_glove_fit.py'
AUDIT_SPEC = importlib.util.spec_from_file_location('vnext_glove_fit_audit', AUDIT_PATH)
audit = importlib.util.module_from_spec(AUDIT_SPEC)
AUDIT_SPEC.loader.exec_module(audit)

FIT_REVISION = 'production-segmented-source-fit-v3'


def parse_output_report():
    index = sys.argv.index('--') + 1
    arguments = sys.argv[index:]
    return Path(arguments[arguments.index('--output-report') + 1]).resolve()


def topology_inventory(variant, side):
    objects = audit.glove_objects(variant, side)
    names = [obj.name for obj in objects]
    bodies = [obj for obj in objects if re.search(r'Production_(Index|Middle|Ring|Pinky)_Finger_Body$', obj.name)]
    armor = [obj for obj in objects if re.search(r'Production_(Index|Middle|Ring|Pinky)_Armor_[123]$', obj.name)]
    channels = [obj for obj in objects if obj.name.endswith('Production_Palm_Channel')]
    legacy_pads = [name for name in names if re.search(r'Production_(Index|Middle|Ring|Pinky)_Pad_[123]$', name)]
    shell = next(obj for obj in objects if obj.name.endswith('ProductionShell'))
    shell_groups = sorted(group.name for group in shell.vertex_groups)
    return {
        'objectCount': len(objects),
        'fingerBodyCount': len(bodies),
        'dorsalArmorCount': len(armor),
        'palmChannelCount': len(channels),
        'legacySweepPadObjects': legacy_pads,
        'uvReadyObjects': sum(bool(obj.data.uv_layers) for obj in objects),
        'shellVertexGroups': shell_groups,
        'fingerBodyVertexGroups': {
            obj.name: sorted(group.name for group in obj.vertex_groups)
            for obj in bodies
        },
        'palmChannelVertexGroups': (
            sorted(group.name for group in channels[0].vertex_groups)
            if channels else []
        ),
    }


def main():
    audit.FIT_REVISION = FIT_REVISION
    audit.main()
    output_report = parse_output_report()
    report = json.loads(output_report.read_text(encoding='utf-8'))
    inventories = {
        f'{variant.lower()}-{side.lower()}': topology_inventory(variant, side)
        for variant in ('Home', 'Away')
        for side in ('Left', 'Right')
    }
    topology_checks = {
        'fourCompleteSegmentedSourceFits': all(
            item['objectCount'] == 30
            and item['fingerBodyCount'] == 4
            and item['dorsalArmorCount'] == 12
            and item['palmChannelCount'] == 1
            for item in inventories.values()
        ),
        'legacyHandBoundFingerLoopsRemoved': all(
            not any(
                token in group
                for group in item['shellVertexGroups']
                for token in ('Index', 'Mid', 'Ring', 'Pinky')
            )
            for item in inventories.values()
        ),
        'independentFingerBodiesUseSegmentChains': all(
            len(groups) >= 3
            and any('Hand' in group for group in groups)
            and sum(any(token in group for token in ('Index', 'Mid', 'Ring', 'Pinky')) for group in groups) >= 2
            for item in inventories.values()
            for groups in item['fingerBodyVertexGroups'].values()
        ),
        'dorsalArmorAndPalmStallsPresent': all(
            item['dorsalArmorCount'] == 12
            and len(item['palmChannelVertexGroups']) >= 8
            for item in inventories.values()
        ),
        'legacySweepPadsAbsent': all(
            not item['legacySweepPadObjects']
            for item in inventories.values()
        ),
        'allSourceObjectsUvReady': all(
            item['uvReadyObjects'] == item['objectCount']
            for item in inventories.values()
        ),
    }
    report.update({
        'status': 'private-production-glove-topology-audited',
        'fitRevision': FIT_REVISION,
        'sourceTopologyRevision': 'segmented-source-finger-shell-v2',
        'topologyInventories': inventories,
    })
    report['checks'].update(topology_checks)
    report['automatedPass'] = all(report['checks'].values())
    report['humanVisualApproval'] = False
    report['publicRuntimeAllowed'] = False
    report['reviewRule'] = (
        'Source topology, weights, UVs, and nine-action shaft proximity cannot approve appearance. '
        'Hidden close review must still reject floating armor, open palms, tube-like fingers, '
        'rigid joints, or unstable contact before export.'
    )
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_TOPOLOGY_AUDITED ' + str(output_report))
    if not report['automatedPass']:
        raise RuntimeError('The private production glove topology failed its automated audit.')


if __name__ == '__main__':
    main()
