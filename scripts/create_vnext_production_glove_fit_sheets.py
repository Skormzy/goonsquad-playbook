import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ACTIONS = {'ready': 1, 'pass': 16, 'shot': 20}
VIEWS = ('front', 'left-three-quarter', 'right-three-quarter')


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--prefix', default='production-glove-fit')
    return parser.parse_args()


def label_font():
    try:
        return ImageFont.truetype('arial.ttf', 18)
    except OSError:
        return ImageFont.load_default()


def make_home_sheet(input_dir, side, prefix):
    tile = 512
    label = 36
    gap = 8
    sheet = Image.new('RGB', (tile * 3 + gap * 4, (tile + label) * 3 + gap * 4), '#0b1220')
    draw = ImageDraw.Draw(sheet)
    font = label_font()
    for row, (action, frame) in enumerate(ACTIONS.items()):
        for column, view in enumerate(VIEWS):
            source = input_dir / (
                f'{prefix}-home-{side}-{action}-{view}-frame-{frame:03d}.png'
            )
            image = Image.open(source).convert('RGB')
            x = gap + column * (tile + gap)
            y = gap + row * (tile + label + gap)
            sheet.paste(image, (x, y))
            draw.text((x + 10, y + tile + 8), f'{action} / {view}', fill='#f8fafc', font=font)
    output = input_dir / f'{prefix}-home-{side}-contact-sheet.png'
    sheet.save(output, optimize=True)
    return output


def make_away_sheet(input_dir, prefix):
    tile = 512
    label = 36
    gap = 8
    sheet = Image.new('RGB', (tile * 2 + gap * 3, (tile + label) * 2 + gap * 3), '#0b1220')
    draw = ImageDraw.Draw(sheet)
    font = label_font()
    for row, side in enumerate(('left', 'right')):
        for column, view in enumerate(('front', 'left-three-quarter')):
            source = input_dir / (
                f'{prefix}-away-{side}-ready-{view}-frame-001.png'
            )
            image = Image.open(source).convert('RGB')
            x = gap + column * (tile + gap)
            y = gap + row * (tile + label + gap)
            sheet.paste(image, (x, y))
            draw.text((x + 10, y + tile + 8), f'{side} / {view}', fill='#f8fafc', font=font)
    output = input_dir / f'{prefix}-away-contact-sheet.png'
    sheet.save(output, optimize=True)
    return output


def main():
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    outputs = [
        make_home_sheet(input_dir, 'left', args.prefix),
        make_home_sheet(input_dir, 'right', args.prefix),
        make_away_sheet(input_dir, args.prefix),
    ]
    for output in outputs:
        print(output)


if __name__ == '__main__':
    main()
