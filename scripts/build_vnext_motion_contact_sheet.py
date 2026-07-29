import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    input_dir = Path(args.input_dir).resolve()
    output = Path(args.output).resolve()
    clips = (
        'idle-ready',
        'jog-forward',
        'sprint-forward',
        'stick-handle',
        'receive-pass',
        'forehand-pass',
        'wrist-shot',
    )
    columns = 5
    tile_width = 220
    tile_height = 275
    label_width = 170
    row_height = tile_height
    sheet = Image.new('RGB', (label_width + columns * tile_width, len(clips) * row_height), '#11151b')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    small_font = ImageFont.load_default(size=11)

    for row, clip in enumerate(clips):
        sources = sorted(input_dir.glob(f'{clip}-*.png'))
        if len(sources) != columns:
            raise RuntimeError(f'Expected {columns} renders for {clip}, found {len(sources)}.')
        y = row * row_height
        draw.rectangle((0, y, label_width, y + row_height), fill='#11151b')
        draw.text((16, y + 22), clip.replace('-', ' ').upper(), fill='#dbe7f3', font=font)
        draw.text((16, y + 48), '5 sampled poses', fill='#6f879d', font=small_font)
        for column, source in enumerate(sources):
            image = Image.open(source).convert('RGB').resize((tile_width, tile_height), Image.Resampling.LANCZOS)
            x = label_width + column * tile_width
            sheet.paste(image, (x, y))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


if __name__ == '__main__':
    main()
