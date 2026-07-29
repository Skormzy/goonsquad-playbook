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

FIT_REVISION = 'production-anatomical-sewn-fit-v4'
MANUFACTURED_REVISION = 'anatomical-sewn-glove-shell-v3'


def parse_output_report():
    arguments = sys.argv[sys.argv.index('--') + 1:]
    return Path(arguments[arguments.index('--output-report') + 1]).resolve()


def object_topology(obj):
    return audit.topology_metrics(obj)


def manufactured_inventory(variant, side):
    objects = audit.glove_objects(variant, side)
    names = [obj.name for obj in objects]
    bodies = [obj for obj in objects if re.search(r'Production_(Index|Middle|Ring|Pinky)_Finger_Body$', obj.name)]
    armor = [obj for obj in objects if re.search(r'Production_(Index|Middle|Ring|Pinky)_Armor_[123]$', obj.name)]
    palm = [obj for obj in objects if obj.name.endswith('Production_Palm_Saddle')]
    root_yoke = [obj for obj in objects if obj.name.endswith('Production_Finger_Root_Yoke')]
    thumb = [obj for obj in objects if obj.name.endswith('Production_Thumb_Saddle')]
    bindings = [
        obj for obj in objects
        if 'Production_' in obj.name and ('Binding' in obj.name or obj.name.endswith('_Seam'))
    ]
    shell = next(obj for obj in objects if obj.name.endswith('ProductionShell'))
    return {
        'objectCount': len(objects),
        'fingerBodyCount': len(bodies),
        'dorsalArmorCount': len(armor),
        'palmSaddleCount': len(palm),
        'fingerRootYokeCount': len(root_yoke),
        'thumbSaddleCount': len(thumb),
        'edgeBindingCount': len(bindings),
        'legacyPalmChannelCount': sum(name.endswith('Production_Palm_Channel') for name in names),
        'legacySweepPadObjects': [name for name in names if re.search(r'Production_(Index|Middle|Ring|Pinky)_Pad_[123]$', name)],
        'uvReadyObjects': sum(bool(obj.data.uv_layers) for obj in objects),
        'shellVertexGroups': sorted(group.name for group in shell.vertex_groups),
        'fingerBodyVertexGroups': {obj.name: sorted(group.name for group in obj.vertex_groups) for obj in bodies},
        'palmSaddleVertexGroups': sorted(group.name for group in palm[0].vertex_groups) if palm else [],
        'fingerRootYokeVertexGroups': sorted(group.name for group in root_yoke[0].vertex_groups) if root_yoke else [],
        'thumbSaddleVertexGroups': sorted(group.name for group in thumb[0].vertex_groups) if thumb else [],
        'manufacturedTopology': {
            'palmSaddle': object_topology(palm[0]) if palm else None,
            'fingerRootYoke': object_topology(root_yoke[0]) if root_yoke else None,
            'thumbSaddle': object_topology(thumb[0]) if thumb else None,
        },
    }


def main():
    audit.FIT_REVISION = FIT_REVISION
    audit.main()
    output_report = parse_output_report()
    report = json.loads(output_report.read_text(encoding='utf-8'))
    inventories = {
        f'{variant.lower()}-{side.lower()}': manufactured_inventory(variant, side)
        for variant in ('Home', 'Away')
        for side in ('Left', 'Right')
    }

    manufactured_checks = {
        'fourCompleteManufacturedFits': all(
            item['objectCount'] == 32
            and item['fingerBodyCount'] == 4
            and item['dorsalArmorCount'] == 12
            and item['palmSaddleCount'] == 1
            and item['fingerRootYokeCount'] == 1
            and item['thumbSaddleCount'] == 1
            and item['edgeBindingCount'] == 6
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
        'manufacturedSurfacesAreContinuous': all(
            all(
                metrics is not None
                and metrics['connectedComponents'] == 1
                and metrics['nonManifoldEdges'] == 0
                for metrics in item['manufacturedTopology'].values()
            )
            for item in inventories.values()
        ),
        'palmRootAndThumbUseArticulatedWeights': all(
            len(item['palmSaddleVertexGroups']) >= 8
            and any('Hand' in group for group in item['fingerRootYokeVertexGroups'])
            and sum(any(token in group for token in ('Index1', 'Mid1', 'Ring1', 'Pinky1')) for group in item['fingerRootYokeVertexGroups']) >= 3
            and any('Hand' in group for group in item['thumbSaddleVertexGroups'])
            and sum('Thumb' in group for group in item['thumbSaddleVertexGroups']) >= 1
            for item in inventories.values()
        ),
        'legacyChannelAndSweepPadsAbsent': all(
            item['legacyPalmChannelCount'] == 0 and not item['legacySweepPadObjects']
            for item in inventories.values()
        ),
        'allSourceObjectsUvReady': all(
            item['uvReadyObjects'] == item['objectCount']
            for item in inventories.values()
        ),
    }
    report.update({
        'status': 'private-production-glove-manufactured-audited',
        'fitRevision': FIT_REVISION,
        'manufacturedRevision': MANUFACTURED_REVISION,
        'sourceTopologyRevision': 'segmented-source-finger-shell-v2',
        'manufacturedInventories': inventories,
    })
    report['checks'].update(manufactured_checks)
    report['automatedPass'] = all(report['checks'].values())
    report['humanVisualApproval'] = False
    report['publicRuntimeAllowed'] = False
    report['reviewRule'] = (
        'Continuous source surfaces, articulated weights, UVs, and nine-action shaft proximity '
        'cannot approve appearance. Hidden close review must still reject a hollow palm, abrupt roots, '
        'uniform armor rhythm, faceting, implausible thumb construction, or unstable bindings.'
    )
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_MANUFACTURED_AUDITED ' + str(output_report))
    if not report['automatedPass']:
        raise RuntimeError('The private manufactured glove failed its automated audit.')


if __name__ == '__main__':
    main()
