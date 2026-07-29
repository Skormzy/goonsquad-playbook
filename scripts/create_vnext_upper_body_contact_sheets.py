import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ACTION_FRAMES = {
    'ready': 1,
    'jog': 17,
    'sprint': 15,
    'turn': 16,
    'stop': 16,
    'receive': 16,
    'pass': 16,
    'shot': 20,
    'jog-to-sprint-ik': 4,
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    return parser.parse_args()


def make_sheet(input_dir, view):
    tile_width = 360
    tile_height = 450
    label_height = 34
    gap = 8
    sheet = Image.new('RGB', (tile_width * 3 + gap * 4, (tile_height + label_height) * 3 + gap * 4), '#111827')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)

    for index, (action, frame) in enumerate(ACTION_FRAMES.items()):
        source = input_dir / f'upper-body-{action}-{view}-frame-{frame:03d}.png'
        image = Image.open(source).convert('RGB')
        column = index % 3
        row = index // 3
        x = gap + column * (tile_width + gap)
        y = gap + row * (tile_height + label_height + gap)
        sheet.paste(image, (x, y))
        draw.text((x + 10, y + tile_height + 7), action, fill='#f8fafc', font=font)

    output = input_dir / f'upper-body-{view}-contact-sheet.png'
    sheet.save(output, optimize=True)
    return output


def main():
    args = parse_args()
    input_dir = Path(args.input_dir).resolve()
    outputs = [make_sheet(input_dir, view) for view in ('front', 'rear', 'side')]
    for output in outputs:
        print(output)


if __name__ == '__main__':
    main()
