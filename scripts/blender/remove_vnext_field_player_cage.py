import argparse
import json
import sys
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-workfile', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def main():
    args = parse_args()
    output_workfile = Path(args.output_workfile).resolve()
    output_report = Path(args.output_report).resolve()
    output_workfile.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)

    source_workfile = bpy.data.filepath
    cage_objects = sorted(
        [
            obj for obj in list(bpy.data.objects)
            if '_Helmet_Cage_' in obj.name
        ],
        key=lambda obj: obj.name,
    )
    removed_names = [obj.name for obj in cage_objects]
    if len(cage_objects) != 12:
        raise RuntimeError(f'Expected 12 field-player cage objects, found {len(cage_objects)}.')

    for obj in cage_objects:
        bpy.data.objects.remove(obj, do_unlink=True)

    retained_shells = sorted(
        obj.name for obj in bpy.data.objects
        if obj.name.endswith('_Helmet_Shell')
    )
    retained_stripes = sorted(
        obj.name for obj in bpy.data.objects
        if obj.name.endswith('_Helmet_Center_Stripe')
    )
    remaining_cage_objects = sorted(
        obj.name for obj in bpy.data.objects
        if '_Helmet_Cage_' in obj.name
    )
    if len(retained_shells) != 2 or len(retained_stripes) != 2 or remaining_cage_objects:
        raise RuntimeError('The open-face helmet object contract is incomplete.')

    for shell_name in retained_shells:
        shell = bpy.data.objects[shell_name]
        shell['face_protection'] = 'none'
        shell['review_status'] = 'private-open-face-candidate'

    bpy.ops.wm.save_as_mainfile(filepath=str(output_workfile))

    report = {
        'status': 'open-face-helmet-authored-for-private-review',
        'decision': 'not-runtime-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': source_workfile,
        'outputWorkfile': str(output_workfile),
        'removedCageObjectCount': len(removed_names),
        'removedCageObjects': removed_names,
        'remainingCageObjects': remaining_cage_objects,
        'retainedHelmetShells': retained_shells,
        'retainedHelmetCenterStripes': retained_stripes,
        'motionActionsChanged': [],
        'handOrStickTransformsChanged': False,
        'reviewRule': (
            'The clean helmet shell must pass close and runtime human review; '
            'this private change does not approve the athlete.'
        ),
    }
    output_report.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_OPEN_FACE_HELMET_AUTHORED ' + str(output_report))


if __name__ == '__main__':
    main()
