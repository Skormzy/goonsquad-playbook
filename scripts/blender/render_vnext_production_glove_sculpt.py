import importlib.util
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
MANUFACTURED_RENDER_PATH = SCRIPT_DIR / 'render_vnext_production_glove_manufactured.py'
MANUFACTURED_RENDER_SPEC = importlib.util.spec_from_file_location(
    'vnext_glove_manufactured_render',
    MANUFACTURED_RENDER_PATH,
)
manufactured_render = importlib.util.module_from_spec(MANUFACTURED_RENDER_SPEC)
MANUFACTURED_RENDER_SPEC.loader.exec_module(manufactured_render)

FIT_REVISION = 'production-integrated-sewn-volume-fit-v5'
SCULPT_REVISION = 'integrated-sewn-volume-glove-v4'
MANUFACTURED_REVISION = 'anatomical-sewn-glove-shell-v3'


def output_report_path():
    arguments = sys.argv[sys.argv.index('--') + 1:]
    return Path(arguments[arguments.index('--output-report') + 1]).resolve()


def main():
    manufactured_render.FIT_REVISION = FIT_REVISION
    manufactured_render.MANUFACTURED_REVISION = SCULPT_REVISION
    manufactured_render.main()

    report_path = output_report_path()
    report = json.loads(report_path.read_text(encoding='utf-8'))
    for output in report['outputs']:
        original = Path(output['path'])
        renamed = original.with_name(original.name.replace(
            'production-glove-manufactured',
            'production-glove-sculpt',
            1,
        ))
        original.replace(renamed)
        output['path'] = str(renamed)
    report.update({
        'status': 'rendered-for-private-production-glove-sculpt-review',
        'fitRevision': FIT_REVISION,
        'sculptRevision': SCULPT_REVISION,
        'manufacturedRevision': MANUFACTURED_REVISION,
        'sourceTopologyRevision': 'segmented-source-finger-shell-v2',
    })
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_SCULPT_REVIEW_RENDERED ' + str(report_path))


if __name__ == '__main__':
    main()
