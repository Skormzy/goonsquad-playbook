import importlib.util
import json
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
RENDER_PATH = SCRIPT_DIR / 'render_vnext_production_glove_fit.py'
RENDER_SPEC = importlib.util.spec_from_file_location('vnext_glove_fit_render', RENDER_PATH)
render = importlib.util.module_from_spec(RENDER_SPEC)
RENDER_SPEC.loader.exec_module(render)

FIT_REVISION = 'production-anatomical-sewn-fit-v4'
MANUFACTURED_REVISION = 'anatomical-sewn-glove-shell-v3'


def output_report_path():
    arguments = sys.argv[sys.argv.index('--') + 1:]
    return Path(arguments[arguments.index('--output-report') + 1]).resolve()


def main():
    render.FIT_REVISION = FIT_REVISION
    render.main()
    report_path = output_report_path()
    report = json.loads(report_path.read_text(encoding='utf-8'))
    for output in report['outputs']:
        original = Path(output['path'])
        renamed = original.with_name(original.name.replace(
            'production-glove-fit',
            'production-glove-manufactured',
            1,
        ))
        original.replace(renamed)
        output['path'] = str(renamed)
    report.update({
        'status': 'rendered-for-private-production-glove-manufactured-review',
        'fitRevision': FIT_REVISION,
        'manufacturedRevision': MANUFACTURED_REVISION,
        'sourceTopologyRevision': 'segmented-source-finger-shell-v2',
    })
    report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('GOON_VNEXT_PRODUCTION_GLOVE_MANUFACTURED_REVIEW_RENDERED ' + str(report_path))


if __name__ == '__main__':
    main()
