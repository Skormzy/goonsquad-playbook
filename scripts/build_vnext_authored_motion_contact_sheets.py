import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def build_sheet(input_dir, output, view, clips):
    columns = 5
    tile_width = 220
    tile_height = 275
    label_width = 160
    sheet = Image.new('RGB', (label_width + columns * tile_width, len(clips) * tile_height), '#11151b')
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    small_font = ImageFont.load_default(size=11)

    for row, clip in enumerate(clips):
        sources = sorted(input_dir.glob(f'{clip}-{view}-*.png'))
        if len(sources) != columns:
            raise RuntimeError(f'Expected {columns} {view} renders for {clip}, found {len(sources)}.')
        y = row * tile_height
        draw.text((16, y + 22), clip.upper(), fill='#dbe7f3', font=font)
        draw.text((16, y + 48), view.replace('-', ' '), fill='#6f879d', font=small_font)
        for column, source in enumerate(sources):
            image = Image.open(source).convert('RGB').resize((tile_width, tile_height), Image.Resampling.LANCZOS)
            sheet.paste(image, (label_width + column * tile_width, y))

    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input-dir', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--clips', default='ready,jog,sprint,turn,stop,receive,pass,shot')
    args = parser.parse_args()
    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    clips = tuple(clip.strip() for clip in args.clips.split(',') if clip.strip())
    for view in ('three-quarter', 'side'):
        build_sheet(input_dir, output_dir / f'contact-sheet-{view}-2026-07-12.png', view, clips)


if __name__ == '__main__':
    main()
