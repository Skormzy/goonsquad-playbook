import argparse
import importlib.util
import json
import sys
from pathlib import Path

import bpy


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output-blend', required=True)
    parser.add_argument('--output-report', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def load_motion_pipeline(project_root):
    source = project_root / 'scripts' / 'blender' / 'normalize_player_rigs.py'
    spec = importlib.util.spec_from_file_location('goon_motion_pipeline', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    args = parse_args()
    output_blend = Path(args.output_blend).resolve()
    output_report = Path(args.output_report).resolve()
    project_root = Path(__file__).resolve().parents[2]

    armature = bpy.data.objects.get('GS_FieldPlayer_Rig')
    if armature is None:
        raise RuntimeError('The accepted vNext field-player rig is missing.')

    pipeline = load_motion_pipeline(project_root)
    report = pipeline.retarget_runner_required_clips()
    retargeted_names = [clip['clipName'] for clip in report['retargetedClips']]
    required_names = list(pipeline.RUNNER_REQUIRED_CLIPS)
    missing_actions = [name for name in required_names if name not in retargeted_names]

    output_blend.parent.mkdir(parents=True, exist_ok=True)
    output_report.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))

    result = {
        'status': 'audition-ready' if not missing_actions and not report['invalidMotionSources'] else 'blocked',
        'decision': 'not-production-approved',
        'publicRuntimeAllowed': False,
        'sourceWorkfile': bpy.data.filepath,
        'outputWorkfile': str(output_blend),
        'retargetedClipNames': retargeted_names,
        'requiredRetargetClipNames': required_names,
        'missingRetargetClipNames': missing_actions,
        'missingRequirementMotions': ['turn', 'stop'],
        'sourceQualityBoundary': 'The local BVHs are audition references derived from procedural key poses and cannot pass the vNext production motion gate without human visual approval.',
        'retargetReport': report,
    }
    output_report.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print('GOON_VNEXT_MOTION_AUDITION ' + str(output_report))


if __name__ == '__main__':
    main()
